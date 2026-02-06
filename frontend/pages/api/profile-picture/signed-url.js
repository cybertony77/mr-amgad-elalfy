import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';
import { getSignedImageUrlServer } from '../../../lib/cloudinary';

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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const user = await authMiddleware(req);
    
    let client;
    try {
      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);
      
      // Get user's profile_picture public_id
      const userDoc = await db.collection('users').findOne(
        { id: user.assistant_id || user.id },
        { projection: { profile_picture: 1 } }
      );
      
      if (!userDoc || !userDoc.profile_picture) {
        return res.status(200).json({ url: null });
      }
      
      // Generate signed URL
      const signedUrl = await getSignedImageUrlServer(userDoc.profile_picture);
      
      if (!signedUrl) {
        return res.status(500).json({ error: 'Failed to generate image URL' });
      }
      
      res.status(200).json({ url: signedUrl });
      
    } finally {
      if (client) await client.close();
    }
    
  } catch (error) {
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.error('Error getting signed URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

