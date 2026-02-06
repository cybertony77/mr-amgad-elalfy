import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/demo-attendance-system';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'demo-attendance-system';

// Default values
const DEFAULT_PHONE = '201211172756';
const DEFAULT_EMAIL = 'tony.joseph.business1717@gmail.com';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Get Tony's credentials from users collection
    const tony = await db.collection('users').findOne({ id: 'tony' });
    
    // Use phone and email from DB, or defaults if not found
    // Phone: use as stored in DB (with country code), or default
    const phone = (tony && tony.phone) ? tony.phone.replace(/[^0-9]/g, '') : DEFAULT_PHONE;
    // Use Tony's actual email from database
    const email = (tony && tony.email) ? tony.email : DEFAULT_EMAIL;
    
    res.json({ phone, email });
  } catch (error) {
    console.error('Error fetching developer contact:', error);
    // Return defaults on error
    res.json({ phone: DEFAULT_PHONE, email: DEFAULT_EMAIL });
  } finally {
    if (client) await client.close();
  }
}
