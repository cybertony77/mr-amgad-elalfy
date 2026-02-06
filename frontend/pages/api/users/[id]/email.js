import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from "../../../../lib/authMiddleware";
import { verifySignature } from '../../../../lib/hmac';

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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/demo-attendance-system';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'demo-attendance-system';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, sig } = req.query;
    
    // Check if this is a public access request (with HMAC signature)
    let isPublicAccess = false;
    if (sig) {
      const studentIdFromQuery = String(id || '').trim();
      const signature = String(sig).trim();
      
      if (studentIdFromQuery && signature) {
        isPublicAccess = verifySignature(studentIdFromQuery, signature);
        if (!isPublicAccess) {
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }
    }
    
    // If not public access, verify authentication
    if (!isPublicAccess) {
      try {
        await authMiddleware(req);
      } catch (authError) {
        if (!sig) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    
    if (!id) {
      return res.status(400).json({ error: 'User ID is required' });
    }
    
    const userId = parseInt(id);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    let client;
    try {
      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);
      
      // Get user email from users collection
      const user = await db.collection('users').findOne({ id: userId });
      if (!user) {
        return res.status(200).json({ email: null });
      }
      
      res.json({ email: user.email || null });
    } finally {
      if (client) await client.close();
    }
  } catch (error) {
    console.error('Error getting user email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

