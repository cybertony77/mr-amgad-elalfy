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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    const user = await authMiddleware(req);
    if (!['admin', 'developer', 'assistant', 'student'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const { studentId, type, week } = req.body;
    
    // Students can only get their own history
    if (user.role === 'student') {
      const studentIdFromToken = parseInt(user.assistant_id || user.id);
      if (studentIdFromToken !== parseInt(studentId)) {
        return res.status(403).json({ error: 'Forbidden: Students can only access their own history' });
      }
    }

    if (!studentId || !type) {
      return res.status(400).json({ error: 'Student ID and type are required' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Build query
    const query = {
      student_id: parseInt(studentId),
      type: type
    };
    
    // Add week filter if provided
    if (week !== undefined && week !== null) {
      query.process_week = parseInt(week);
    }

    // Get the last scoring history entry for this student and type (and week if provided)
    const lastHistory = await db.collection('scoring_system_history')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(1)
      .toArray();

    if (lastHistory.length === 0) {
      return res.status(200).json({
        success: true,
        found: false,
        history: null
      });
    }

    return res.status(200).json({
      success: true,
      found: true,
      history: lastHistory[0]
    });

  } catch (error) {
    console.error('Error getting scoring history:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    if (client) await client.close();
  }
}
