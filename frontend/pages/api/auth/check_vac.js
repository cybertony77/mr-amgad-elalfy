import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';

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
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-george-magdy';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { account_id, VAC } = req.body;

  if (!account_id || !VAC) {
    return res.status(400).json({ error: 'account_id and VAC are required' });
  }
  if (typeof account_id !== 'string' && typeof account_id !== 'number') {
    return res.status(400).json({ error: 'Invalid account_id type' });
  }
  if (typeof VAC !== 'string') {
    return res.status(400).json({ error: 'Invalid VAC type' });
  }

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Find the VAC record
    const vacRecord = await db.collection('VAC').findOne({ account_id: Number(account_id) });

    if (!vacRecord) {
      return res.status(200).json({ 
        exists: false,
        valid: false,
        message: 'Account ID not found'
      });
    }

    // Check if VAC matches (case-sensitive)
    const isValid = vacRecord.VAC === VAC;

    // If VAC is incorrect AND VAC_activated is true, show incorrect message
    if (!isValid && vacRecord.VAC_activated) {
      return res.status(200).json({
        exists: true,
        valid: false,
        activated: true,
        message: 'Verification account code is incorrect'
      });
    }

    // If VAC is correct AND VAC_activated is true, show account exists message
    if (isValid && vacRecord.VAC_activated) {
      return res.status(200).json({
        exists: true,
        valid: true,
        activated: true,
        message: 'This account is already exists'
      });
    }

    // If VAC is incorrect and not activated, show incorrect message
    if (!isValid) {
      return res.status(200).json({
        exists: true,
        valid: false,
        activated: false,
        message: 'Verification account code is incorrect'
      });
    }

    // VAC is correct and not activated
    return res.status(200).json({
      exists: true,
      valid: true,
      activated: false,
      message: 'Verification code is valid'
    });

  } catch (error) {
    console.error('VAC check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}

