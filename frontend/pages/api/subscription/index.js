import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';

// Load environment variables from env.config
function loadEnvConfig() {
  try {
    const envPath = path.join(process.cwd(), '..', 'env.config');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          let value = trimmed.substring(index + 1).trim();
          value = value.replace(/^"|"$/g, ''); // strip quotes
          envVars[key] = value;
        }
      }
    });
    
    return envVars;
  } catch (error) {
    console.log('⚠️  Could not read env.config, using process.env as fallback');
    return {};
  }
}

const envConfig = loadEnvConfig();
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-george-magdy';

console.log('🔗 Using Mongo URI:', MONGO_URI);

async function requireDeveloper(req) {
  try {
    const user = await authMiddleware(req);
    console.log('🔐 User role check:', { role: user.role, name: user.name, assistant_id: user.assistant_id });
    if (user.role !== 'developer') {
      console.log('❌ Access denied - user role:', user.role);
      throw new Error('Forbidden: Developers only');
    }
    return user;
  } catch (error) {
    if (error.message === 'No token provided' || error.message.includes('token')) {
      throw new Error('Unauthorized');
    }
    throw error;
  }
}

// Auto-expire subscription if expired
async function checkAndExpireSubscription(db) {
  const subscription = await db.collection('subscription').findOne({});
  if (subscription && subscription.active && subscription.date_of_expiration) {
    const now = new Date();
    const expirationDate = new Date(subscription.date_of_expiration);
    
    if (now >= expirationDate) {
      console.log('⏰ Subscription expired, auto-deactivating...');
      await db.collection('subscription').updateOne(
        {},
        {
          $set: {
            active: false,
            subscription_duration: null,
            date_of_subscription: null,
            date_of_expiration: null,
            cost: null,
            note: null
          }
        }
      );
      return true; // Subscription was expired
    }
  }
  return false; // Subscription is still active or doesn't exist
}

export default async function handler(req, res) {
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Auto-expire subscription if needed
    await checkAndExpireSubscription(db);
    
    if (req.method === 'GET') {
      // For GET requests, allow all authenticated users to read subscription status
      try {
        await authMiddleware(req); // Just verify authentication, not role
      } catch (error) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // Get subscription
      const subscription = await db.collection('subscription').findOne({});
      
      if (!subscription) {
        // Create default subscription if it doesn't exist
        const defaultSubscription = {
          subscription_duration: null,
          date_of_subscription: null,
          date_of_expiration: null,
          cost: null,
          note: null,
          active: false
        };
        await db.collection('subscription').insertOne(defaultSubscription);
        return res.json(defaultSubscription);
      }
      
      res.json(subscription);
    } else if (req.method === 'PATCH') {
      // For PATCH requests, allow authenticated users to auto-expire subscription
      // This is used when the timer reaches 00:00:00:00
      try {
        await authMiddleware(req); // Just verify authentication, not role
      } catch (error) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // Auto-expire subscription (set active to false and null all fields)
      const subscription = await db.collection('subscription').findOne({});
      
      if (subscription && subscription.active && subscription.date_of_expiration) {
        const now = new Date();
        const expirationDate = new Date(subscription.date_of_expiration);
        
        // Only allow expiration if the expiration date has passed or is exactly now
        if (now >= expirationDate) {
          await db.collection('subscription').updateOne(
            {},
            {
              $set: {
                active: false,
                subscription_duration: null,
                date_of_subscription: null,
                date_of_expiration: null,
                cost: null,
                note: null
              }
            }
          );
          return res.json({ success: true, message: 'Subscription expired' });
        } else {
          return res.status(400).json({ error: 'Subscription has not expired yet' });
        }
      }
      
      res.json({ success: true, message: 'No active subscription to expire' });
    } else if (req.method === 'POST') {
      // For POST/PUT requests, require developer access
      const developer = await requireDeveloper(req);
      
      // Create or update subscription
      const { subscription_duration, duration_type, cost, note, overwrite } = req.body;
      
      if (!subscription_duration || !cost) {
        return res.status(400).json({ error: 'Subscription duration and cost are required' });
      }
      
      // Check if there's an active subscription that hasn't expired
      const existingSubscription = await db.collection('subscription').findOne({});
      const now = new Date();
      
      if (!overwrite && existingSubscription && existingSubscription.active && existingSubscription.date_of_expiration) {
        const expirationDate = new Date(existingSubscription.date_of_expiration);
        if (now < expirationDate) {
          // Active subscription exists and hasn't expired
          return res.status(409).json({ 
            error: 'ACTIVE_SUBSCRIPTION_EXISTS',
            message: 'There is already a subscription and it\'s not expired yet'
          });
        }
      }
      
      // Calculate dates
      const date_of_subscription = new Date();
      const date_of_expiration = new Date(date_of_subscription);
      
      // Add duration based on type
      if (duration_type === 'yearly') {
        date_of_expiration.setFullYear(date_of_expiration.getFullYear() + parseInt(subscription_duration));
      } else if (duration_type === 'monthly') {
        date_of_expiration.setMonth(date_of_expiration.getMonth() + parseInt(subscription_duration));
      } else if (duration_type === 'daily') {
        date_of_expiration.setDate(date_of_expiration.getDate() + parseInt(subscription_duration));
      } else if (duration_type === 'hourly') {
        date_of_expiration.setHours(date_of_expiration.getHours() + parseInt(subscription_duration));
      } else if (duration_type === 'minutely') {
        date_of_expiration.setMinutes(date_of_expiration.getMinutes() + parseInt(subscription_duration));
      }
      
      // Update or create subscription
      const durationLabel = duration_type === 'yearly' ? 'year' : duration_type === 'monthly' ? 'month' : duration_type === 'daily' ? 'day' : duration_type === 'hourly' ? 'hour' : 'minute';
      const subscriptionData = {
        subscription_duration: `${subscription_duration} ${durationLabel}${parseInt(subscription_duration) > 1 ? 's' : ''}`,
        date_of_subscription: date_of_subscription,
        date_of_expiration: date_of_expiration,
        cost: parseFloat(cost),
        note: note && note.trim() !== '' ? note.trim() : null,
        active: true
      };
      
      await db.collection('subscription').updateOne(
        {},
        { $set: subscriptionData },
        { upsert: true }
      );
      
      res.json({ success: true, subscription: subscriptionData });
    } else if (req.method === 'PUT') {
      // For PUT requests, require developer access
      const developer = await requireDeveloper(req);
      
      // Cancel subscription
      await db.collection('subscription').updateOne(
        {},
        {
          $set: {
            subscription_duration: null,
            date_of_subscription: null,
            date_of_expiration: null,
            cost: null,
            note: null,
            active: false
          }
        }
      );
      
      res.json({ success: true });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('❌ Subscription API error:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized', message: 'Please log in to access this resource' });
    } else if (error.message === 'Forbidden: Developers only') {
      return res.status(403).json({ 
        error: 'Forbidden: Developers only', 
        message: 'This resource is only accessible to users with the developer role' 
      });
    } else {
      return res.status(500).json({ 
        error: 'Internal server error', 
        details: error.message 
      });
    }
  } finally {
    if (client) await client.close();
  }
}
