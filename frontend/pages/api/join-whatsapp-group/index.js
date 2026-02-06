import { MongoClient, ObjectId } from 'mongodb';
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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI;
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME;

export default async function handler(req, res) {
  let client;
  
  try {
    const user = await authMiddleware(req);
    if (!['admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    if (req.method === 'GET') {
      // Get all WhatsApp groups
      const groups = await db.collection('join_whatsapp_group').find({}).toArray();
      
      return res.status(200).json({
        success: true,
        groups: groups.map(group => ({
          ...group,
          _id: group._id.toString()
        }))
      });
    } else if (req.method === 'POST') {
      // Create new WhatsApp group
      const { title, grade, center, gender, link } = req.body;

      if (!title || !grade || !center || !gender || !link) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      const newGroup = {
        title: title.trim(),
        grade: grade.trim(),
        center: center.trim(),
        gender: gender.trim(),
        link: link.trim(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await db.collection('join_whatsapp_group').insertOne(newGroup);
      
      return res.status(200).json({
        success: true,
        group: {
          ...newGroup,
          _id: result.insertedId.toString()
        }
      });
    } else if (req.method === 'PUT') {
      // Update WhatsApp group
      const { id, title, grade, center, gender, link } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Group ID is required' });
      }

      if (!title || !grade || !center || !gender || !link) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      let query;
      try {
        query = { _id: new ObjectId(id) };
      } catch (e) {
        query = { _id: id };
      }

      const updateData = {
        title: title.trim(),
        grade: grade.trim(),
        center: center.trim(),
        gender: gender.trim(),
        link: link.trim(),
        updatedAt: new Date()
      };

      const result = await db.collection('join_whatsapp_group').updateOne(
        query,
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Group not found' });
      }

      return res.status(200).json({
        success: true,
        group: {
          ...updateData,
          _id: id
        }
      });
    } else if (req.method === 'DELETE') {
      // Delete WhatsApp group
      const { id } = req.body || req.query;

      if (!id) {
        return res.status(400).json({ error: 'Group ID is required' });
      }

      let query;
      try {
        query = { _id: new ObjectId(id) };
      } catch (e) {
        query = { _id: id };
      }

      const result = await db.collection('join_whatsapp_group').deleteOne(query);

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Group not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Group deleted successfully'
      });
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in join-whatsapp-group API:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  } finally {
    if (client) await client.close();
  }
}
