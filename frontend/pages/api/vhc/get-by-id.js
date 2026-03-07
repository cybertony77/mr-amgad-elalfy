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

    const { vhc_id } = req.body;

    if (!vhc_id) {
      return res.status(400).json({ 
        success: false,
        error: 'VHC ID is required'
      });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get student ID
    const studentId = parseInt(user.assistant_id || user.id);

    // Find the VHC record
    const vhcRecord = await db.collection('VHC').findOne({ _id: new ObjectId(vhc_id) });

    if (!vhcRecord) {
      return res.status(404).json({ 
        success: false,
        error: 'VHC record not found'
      });
    }

    // Check if code is deactivated
    if (vhcRecord.code_state === 'Deactivated') {
      return res.status(200).json({ 
        success: false,
        error: '❌ Sorry, This code is deactivated',
        valid: false 
      });
    }

    // Check if code belongs to another student (for number_of_views)
    const codeSettings = vhcRecord.code_settings || 'number_of_views';
    if (codeSettings === 'number_of_views') {
      // Check if code belongs to another student
      if (vhcRecord.viewed_by_who !== null && vhcRecord.viewed_by_who !== studentId) {
        return res.status(200).json({ 
          success: false,
          error: '❌ Sorry, this code is already used by another student',
          valid: false 
        });
      }
      
      // Check if views are remaining
      if (vhcRecord.number_of_views === null || vhcRecord.number_of_views <= 0) {
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
      vhc_id: vhcRecord._id.toString(),
      code_settings: codeSettings,
      number_of_views: vhcRecord.number_of_views || null,
      deadline_date: vhcRecord.deadline_date || null,
      code_lesson: vhcRecord.code_lesson || 'All'
    });
  } catch (error) {
    console.error('❌ Error in VHC get-by-id API:', error);
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
