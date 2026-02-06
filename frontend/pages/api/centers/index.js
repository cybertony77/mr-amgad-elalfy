import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';

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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI;
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME;
const JWT_SECRET = envConfig.JWT_SECRET || process.env.JWT_SECRET;

// Auth middleware is now imported from shared utility

export default async function handler(req, res) {
  let client;
  let db;

  try {
    console.log('🔍 Centers API called:', { method: req.method, url: req.url });
    console.log('📁 Current working directory:', process.cwd());
    
    // Validate environment variables
    console.log('🔧 Environment variables check:', { 
      MONGO_URI: !!MONGO_URI, 
      DB_NAME: !!DB_NAME, 
      JWT_SECRET: !!JWT_SECRET,
      MONGO_URI_VALUE: MONGO_URI ? `${MONGO_URI.substring(0, 20)}...` : 'undefined',
      DB_NAME_VALUE: DB_NAME || 'undefined'
    });
    
    if (!MONGO_URI || !DB_NAME || !JWT_SECRET) {
      console.error('❌ Missing environment variables:', { 
        MONGO_URI: !!MONGO_URI, 
        DB_NAME: !!DB_NAME, 
        JWT_SECRET: !!JWT_SECRET 
      });
      return res.status(500).json({ 
        error: 'Server configuration error', 
        details: 'Missing required environment variables',
        missing: {
          MONGO_URI: !MONGO_URI,
          DB_NAME: !DB_NAME,
          JWT_SECRET: !JWT_SECRET
        }
      });
    }

    console.log('🔗 Connecting to MongoDB...');
    try {
      client = await MongoClient.connect(MONGO_URI);
      db = client.db(DB_NAME);
      console.log('✅ Connected to database:', DB_NAME);
    } catch (dbError) {
      console.error('❌ MongoDB connection failed:', dbError);
      return res.status(500).json({ 
        error: 'Database connection failed', 
        details: dbError.message 
      });
    }

    // Authenticate user
    console.log('🔐 Authenticating user...');
    const user = await authMiddleware(req);
    console.log('✅ User authenticated:', user.id);

    if (req.method === 'GET') {
      // Get all centers
      console.log('📋 Fetching centers from database...');
      const centers = await db.collection('centers').find({}).sort({ id: 1 }).toArray();
      console.log(`✅ Found ${centers.length} centers:`, centers.map(c => ({ id: c.id, name: c.name })));
      res.json({ centers });

    } else if (req.method === 'POST') {
      // Create new center
      const { name, location, grades } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Center name is required' });
      }

      // Check if center already exists
      const existingCenter = await db.collection('centers').findOne({ name: name.trim() });
      if (existingCenter) {
        return res.status(400).json({ error: 'Center already exists' });
      }

      // Get next ID
      const lastCenter = await db.collection('centers').findOne({}, { sort: { id: -1 } });
      const nextId = lastCenter ? lastCenter.id + 1 : 1;

      const newCenter = {
        id: nextId,
        name: name.trim(),
        location: location && location.trim() ? location.trim() : '',
        grades: grades && Array.isArray(grades) ? grades : [],
        createdAt: new Date()
      };

      await db.collection('centers').insertOne(newCenter);
      res.json({ success: true, center: newCenter });

    } else {
      res.setHeader('Allow', ['GET', 'POST']);
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Centers API error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    if (error.message === 'No token provided') {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    // Log more details for debugging
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    if (client) await client.close();
  }
}
