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
  if (req.method === 'GET') {
    // Get all scoring conditions
    let client;
    try {
      const user = await authMiddleware(req);
      if (!['admin', 'developer', 'assistant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }

      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);

      const conditions = await db.collection('scoring_system_conditions').find({}).toArray();
      
      // Convert ObjectId to string for JSON serialization
      const serializedConditions = conditions.map(condition => ({
        ...condition,
        _id: condition._id?.toString() || condition._id
      }));
      
      return res.status(200).json({
        success: true,
        conditions: serializedConditions
      });
    } catch (error) {
      console.error('Error fetching scoring conditions:', error);
      return res.status(500).json({ error: 'Internal server error', details: error.message });
    } finally {
      if (client) await client.close();
    }
  } else if (req.method === 'POST') {
    // Create new scoring condition
    let client;
    try {
      const user = await authMiddleware(req);
      if (!['admin', 'developer', 'assistant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }

      const { type, withDegree, rules, bonusRules } = req.body;

      if (!type || !rules || !Array.isArray(rules) || rules.length === 0) {
        return res.status(400).json({ error: 'Type and rules array are required' });
      }

      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);

      const condition = {
        type,
        ...(withDegree !== undefined && { withDegree }),
        rules,
        ...(bonusRules && Array.isArray(bonusRules) && bonusRules.length > 0 && { bonusRules })
      };

      const result = await db.collection('scoring_system_conditions').insertOne(condition);
      
      return res.status(200).json({
        success: true,
        id: result.insertedId,
        condition: condition
      });
    } catch (error) {
      console.error('Error creating scoring condition:', error);
      return res.status(500).json({ error: 'Internal server error', details: error.message });
    } finally {
      if (client) await client.close();
    }
  } else if (req.method === 'PUT') {
    // Update existing scoring condition
    let client;
    try {
      const user = await authMiddleware(req);
      if (!['admin', 'developer', 'assistant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }

      const { id, type, withDegree, rules, bonusRules } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Condition ID is required' });
      }

      if (!type || !rules || !Array.isArray(rules) || rules.length === 0) {
        return res.status(400).json({ error: 'Type and rules array are required' });
      }

      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);

      const updateData = {
        type,
        ...(withDegree !== undefined && { withDegree }),
        rules,
        ...(bonusRules && Array.isArray(bonusRules) && bonusRules.length > 0 ? { bonusRules } : { bonusRules: [] })
      };

      // Handle both ObjectId and string IDs
      let query;
      try {
        // Try to convert to ObjectId
        query = { _id: new ObjectId(id) };
      } catch (e) {
        // If it fails, use as string
        query = { _id: id };
      }
      
      const result = await db.collection('scoring_system_conditions').updateOne(
        query,
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Condition not found' });
      }

      return res.status(200).json({
        success: true,
        condition: updateData
      });
    } catch (error) {
      console.error('Error updating scoring condition:', error);
      return res.status(500).json({ error: 'Internal server error', details: error.message });
    } finally {
      if (client) await client.close();
    }
  } else if (req.method === 'DELETE') {
    // Delete scoring condition
    let client;
    try {
      const user = await authMiddleware(req);
      if (!['admin', 'developer', 'assistant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }

      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Condition ID is required' });
      }

      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);

      // Handle both ObjectId and string IDs
      let query;
      try {
        // Try to convert to ObjectId
        query = { _id: new ObjectId(id) };
      } catch (e) {
        // If it fails, use as string
        query = { _id: id };
      }
      
      const result = await db.collection('scoring_system_conditions').deleteOne(query);

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Condition not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'Condition deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting scoring condition:', error);
      return res.status(500).json({ error: 'Internal server error', details: error.message });
    } finally {
      if (client) await client.close();
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
