import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import UAParser from 'ua-parser-js';

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
const JWT_SECRET = envConfig.JWT_SECRET || process.env.JWT_SECRET || 'topphysics_secret';
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-george-magdy';
const SUBSCRIPTION_ENABLED = envConfig.SYSTEM_SUBSCRIPTION === 'true' || process.env.SYSTEM_SUBSCRIPTION === 'true';
const DEVICE_LIMITATIONS_ENABLED =
  envConfig.SYSTEM_DEVICE_LIMITATIONS === 'true' || process.env.SYSTEM_DEVICE_LIMITATIONS === 'true';

console.log('🔗 Using Mongo URI:', MONGO_URI);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { assistant_id, password, device_id } = req.body;
  if (!assistant_id || !password) {
    return res.status(400).json({ error: 'assistant_id and password required' });
  }
  if (typeof assistant_id !== 'string' && typeof assistant_id !== 'number') {
    return res.status(400).json({ error: 'Invalid assistant_id' });
  }
  if (typeof password !== 'string') {
    return res.status(400).json({ error: 'Invalid password' });
  }
  const safeId = typeof assistant_id === 'number' ? assistant_id : String(assistant_id).replace(/[$]/g, '');
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    const assistant = await db.collection('users').findOne({ id: safeId });
    if (!assistant) {
      return res.status(401).json({ error: 'user_not_found' });
    }
    const valid = await bcrypt.compare(password, assistant.password);
    if (!valid) {
      return res.status(401).json({ error: 'wrong_password' });
    }
    
    // Check account_state based on role
    let accountState = null;
    
    if (assistant.role === 'student') {
      // For students, get account_state from students collection
      const student = await db.collection('students').findOne({ id: assistant.id });
      if (student) {
        // Use account_state if it exists, otherwise default to 'Deactivated'
        accountState = student.account_state || 'Deactivated';
      } else {
        // If student not found in students collection, treat as deactivated
        accountState = 'Deactivated';
      }
    } else {
      // For non-students, get account_state from users collection
      // Use account_state if it exists, otherwise default to 'Deactivated'
      accountState = assistant.account_state || 'Deactivated';
    }
    
    // Only allow login if account_state is "Activated"
    if (accountState !== 'Activated') {
      if (assistant.role === 'student') {
        return res.status(403).json({ error: 'student_account_deactivated' });
      } else {
        return res.status(403).json({ error: 'account_deactivated' });
      }
    }

    // Check subscription status (only if SYSTEM_SUBSCRIPTION is enabled)
    const isSubscriptionEnabled = envConfig.SYSTEM_SUBSCRIPTION !== 'false'; // Default to true if not set
    if (SUBSCRIPTION_ENABLED) {
      const subscription = await db.collection('subscription').findOne({});
      if (subscription) {
        const now = new Date();
        const expirationDate = subscription.date_of_expiration ? new Date(subscription.date_of_expiration) : null;
        
        // Compare full datetime (year, month, day, hour, minute, second) before deactivating
        if (expirationDate && subscription.active) {
          // Compare all datetime components to ensure accurate expiration check
          const nowTime = now.getTime();
          const expTime = expirationDate.getTime();
          
          // Only deactivate if current time has passed expiration time
          if (nowTime >= expTime) {
            console.log('⏰ Subscription expiration time reached, deactivating...');
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
            subscription.active = false;
          }
        }

        // If subscription is inactive, only allow developers and students
        if (!subscription.active) {
          if (assistant.role !== 'developer' && assistant.role !== 'student') {
            return res.status(403).json({ 
              error: 'subscription_inactive',
              message: 'Access unavailable: Subscription expired. Please contact Tony Joseph (developer) to renew.' 
            });
          }
        } else if (subscription.active && expirationDate) {
          // If subscription is active, check if expiration date/time has passed
          const nowTime = now.getTime();
          const expTime = expirationDate.getTime();
          
          if (nowTime >= expTime) {
            // Subscription expired, only allow developers and students
            if (assistant.role !== 'developer' && assistant.role !== 'student') {
              return res.status(403).json({ 
                error: 'subscription_expired',
                message: 'Access unavailable: Subscription expired. Please contact Tony Joseph (developer) to renew.' 
              });
            }
          }
          // If expiration time > current time, allow login
        }
      }
    }

    // Device limitations logic (only if enabled and role is NOT developer)
    if (DEVICE_LIMITATIONS_ENABLED && assistant.role !== 'developer') {
      const now = new Date();
      const nowFormatted = formatDateTime(now);

      // Derive device id (fallback to a deterministic string if missing)
      const incomingDeviceId =
        (typeof device_id === 'string' && device_id.trim() !== '')
          ? device_id.trim()
          : 'unknown-device';

      // Derive IP from headers / socket
      const forwardedFor = req.headers['x-forwarded-for'];
      const ipFromHeader = Array.isArray(forwardedFor)
        ? forwardedFor[0]
        : (forwardedFor || '').split(',')[0].trim();
      const ip =
        ipFromHeader ||
        (req.socket && req.socket.remoteAddress) ||
        'unknown';

      // Parse user-agent for browser / OS / device type
      const userAgent = req.headers['user-agent'] || '';
      let browser = 'Unknown';
      let os = 'Unknown';
      let deviceType = 'desktop';

      try {
        const parser = new UAParser(userAgent);
        const result = parser.getResult();
        if (result.browser && result.browser.name) {
          browser = result.browser.name;
        }
        if (result.os && result.os.name) {
          os = result.os.name;
        }
        if (result.device && result.device.type) {
          deviceType = result.device.type;
        }
      } catch (parseErr) {
        // Keep defaults if parsing fails
      }

      const existingLimitations = assistant.device_limitations || {};
      const allowedDevices =
        typeof existingLimitations.allowed_devices === 'number'
          ? existingLimitations.allowed_devices
          : 1;

      const devices = Array.isArray(existingLimitations.devices)
        ? [...existingLimitations.devices]
        : [];

      const existingIndex = devices.findIndex(
        (d) => d && d.device_id === incomingDeviceId
      );

      // If device not registered yet, enforce limit
      if (existingIndex === -1) {
        if (devices.length >= allowedDevices) {
          // Block login when maximum number of devices is reached
          return res.status(403).json({
            error: 'device_limit_reached',
          });
        }

        devices.push({
          device_id: incomingDeviceId,
          ip,
          browser,
          os,
          device_type: deviceType,
          first_login: nowFormatted,
          last_login: nowFormatted,
        });
      } else {
        // Update last_login for existing device
        devices[existingIndex] = {
          ...devices[existingIndex],
          ip: devices[existingIndex].ip || ip,
          browser: devices[existingIndex].browser || browser,
          os: devices[existingIndex].os || os,
          device_type: devices[existingIndex].device_type || deviceType,
          last_login: nowFormatted,
        };
      }

      const updatedLimitations = {
        allowed_devices: allowedDevices,
        last_login: nowFormatted,
        devices,
      };

      await db.collection('users').updateOne(
        { _id: assistant._id },
        { $set: { device_limitations: updatedLimitations } }
      );
    }
    
    const token = jwt.sign(
      { assistant_id: assistant.id, name: assistant.name, role: assistant.role },
      JWT_SECRET,
      { expiresIn: '6h' }
    );
    
    // Set HTTP-only cookie with the token
    res.setHeader('Set-Cookie', [
      `token=${token}; HttpOnly; Secure=false; SameSite=Strict; Path=/; Max-Age=${6 * 60 * 60}` // 6 hours
    ]);
    
    res.json({ success: true, message: 'Login successful', role: assistant.role });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
} 