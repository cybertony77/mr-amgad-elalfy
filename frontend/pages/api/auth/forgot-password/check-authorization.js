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
          value = value.replace(/^"|"$/g, '');
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
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'topphysics';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: 'ID is required' });
  }
  if (typeof id !== 'string' && typeof id !== 'number') {
    return res.status(400).json({ error: 'Invalid ID type' });
  }

  const safeId = String(id).replace(/[$]/g, '');

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    const userId = /^\d+$/.test(safeId) ? Number(safeId) : safeId;
    const user = await db.collection('users').findOne({
      $or: [
        { id: userId },
        { id: safeId }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found', authorized: false });
    }

    // Check if OTP was verified (OTP should be null)
    const otpData = user.OTP_rest_password;
    const isAuthorized = otpData && 
                        (otpData.OTP === null || otpData.OTP === undefined) &&
                        (otpData.OTP_Expiration_Date === null || otpData.OTP_Expiration_Date === undefined);

    res.json({ authorized: isAuthorized });
  } catch (error) {
    console.error('Check authorization error:', error);
    res.status(500).json({ error: 'Failed to check authorization', authorized: false });
  } finally {
    if (client) await client.close();
  }
}

