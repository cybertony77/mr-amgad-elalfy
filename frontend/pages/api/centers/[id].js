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
  const { id } = req.query;
  const centerId = parseInt(id);
  let client;

  try {
    // Validate environment variables
    if (!MONGO_URI || !DB_NAME || !JWT_SECRET) {
      console.error('Missing environment variables:', { MONGO_URI: !!MONGO_URI, DB_NAME: !!DB_NAME, JWT_SECRET: !!JWT_SECRET });
      return res.status(500).json({ error: 'Server configuration error' });
    }

    if (isNaN(centerId)) {
      return res.status(400).json({ error: 'Invalid center ID' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Authenticate user
    const user = await authMiddleware(req);

    if (req.method === 'PUT') {
      // Update center
      const { name, location, grades } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Center name is required' });
      }

      // Check if center exists
      const center = await db.collection('centers').findOne({ id: centerId });
      if (!center) {
        return res.status(404).json({ error: 'Center not found' });
      }

      // Check if new name already exists (excluding current center)
      const existingCenter = await db.collection('centers').findOne({ 
        name: name.trim(),
        id: { $ne: centerId }
      });
      if (existingCenter) {
        return res.status(400).json({ error: 'Center name already exists' });
      }

      // Prepare update object
      const updateData = {
        name: name.trim(),
        location: location && location.trim() ? location.trim() : '',
        updatedAt: new Date()
      };

      // Add grades if provided
      if (grades !== undefined) {
        updateData.grades = Array.isArray(grades) ? grades : [];
      }

      // Update center in centers collection
      await db.collection('centers').updateOne(
        { id: centerId },
        { $set: updateData }
      );

      // Update center name in students collection if name changed
      if (center.name !== name.trim()) {
        await db.collection('students').updateMany(
          { main_center: center.name },
          { $set: { main_center: name.trim() } }
        );
      }

      res.json({ success: true });

    } else if (req.method === 'DELETE') {
      // Delete center
      const center = await db.collection('centers').findOne({ id: centerId });
      if (!center) {
        return res.status(404).json({ error: 'Center not found' });
      }

      // Check if center is being used by students
      const studentsUsingCenter = await db.collection('students').countDocuments({ main_center: center.name });
      if (studentsUsingCenter > 0) {
        return res.status(400).json({ 
          error: `Cannot delete center. ${studentsUsingCenter} student(s) are assigned to this center.` 
        });
      }

      await db.collection('centers').deleteOne({ id: centerId });
      res.json({ success: true });

    } else {
      res.setHeader('Allow', ['PUT', 'DELETE']);
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('Center API error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}


