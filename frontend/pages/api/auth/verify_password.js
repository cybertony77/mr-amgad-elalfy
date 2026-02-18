import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
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
const MONGO_URI = envConfig.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-george-magdy';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    // Verify authentication
    const decoded = await authMiddleware(req);
    
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Get the current user from database
    const currentUser = await db.collection('users').findOne({ id: decoded.assistant_id });
    
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (!currentUser.password) {
      return res.status(400).json({ error: 'User has no password set' });
    }
    
    const { currentPassword } = req.body;
    
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }
    if (typeof currentPassword !== 'string') {
      return res.status(400).json({ error: 'Invalid password type' });
    }
    
    const isValid = await bcrypt.compare(currentPassword.trim(), currentUser.password);
    
    if (!isValid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    res.json({ success: true, message: 'Password verified' });
  } catch (error) {
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.error('Error verifying password:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}
