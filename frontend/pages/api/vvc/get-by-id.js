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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    // Verify authentication - allow students
    const user = await authMiddleware(req);
    if (!['student', 'admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const { vvc_id } = req.body;

    if (!vvc_id) {
      return res.status(400).json({ 
        success: false,
        error: 'VVC ID is required'
      });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get student ID
    const studentId = parseInt(user.assistant_id || user.id);

    // Find the VVC record
    const vvcRecord = await db.collection('VVC').findOne({ _id: new ObjectId(vvc_id) });

    if (!vvcRecord) {
      return res.status(404).json({ 
        success: false,
        error: 'VVC record not found'
      });
    }

    // Check if code is deactivated
    if (vvcRecord.code_state === 'Deactivated') {
      return res.status(200).json({ 
        success: false,
        error: '❌ Sorry, This code is deactivated',
        valid: false 
      });
    }

    // Check if code belongs to another student (for number_of_views)
    const codeSettings = vvcRecord.code_settings || 'number_of_views';
    if (codeSettings === 'number_of_views') {
      // Check if code belongs to another student
      if (vvcRecord.viewed_by_who !== null && vvcRecord.viewed_by_who !== studentId) {
        return res.status(200).json({ 
          success: false,
          error: '❌ Sorry, this code is already used by another student',
          valid: false 
        });
      }
      
      // Check if views are remaining
      if (vvcRecord.number_of_views === null || vvcRecord.number_of_views <= 0) {
        return res.status(200).json({ 
          success: false,
          error: '❌ Sorry, this code has no views remaining',
          valid: false 
        });
      }
    }

    return res.status(200).json({ 
      success: true,
      valid: true,
      vvc_id: vvcRecord._id.toString(),
      code_settings: codeSettings,
      number_of_views: vvcRecord.number_of_views || null,
      deadline_date: vvcRecord.deadline_date || null,
      code_lesson: vvcRecord.code_lesson || 'All'
    });
  } catch (error) {
    console.error('❌ Error in VVC get-by-id API:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error', 
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}
