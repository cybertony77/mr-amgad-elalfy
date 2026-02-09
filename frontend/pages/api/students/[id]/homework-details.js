import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../lib/authMiddleware';

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

  const { id } = req.query;
  const student_id = parseInt(id);
  const { homework_id } = req.query;

  if (!homework_id) {
    return res.status(400).json({ error: 'homework_id is required' });
  }

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication - only student can view their own results
    const user = await authMiddleware(req);
    const userId = user.assistant_id || user.id; // JWT contains assistant_id for students
    if (user.role !== 'student' || userId !== student_id) {
      return res.status(403).json({ error: 'Forbidden: You can only view your own results' });
    }

    // Get student data
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get the homework
    const homework = await db.collection('homeworks').findOne({ _id: new ObjectId(homework_id) });
    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }

    // Find result that matches this homework_id
    // Normalize both to strings for comparison (handles ObjectId vs string mismatch)
    const onlineHomeworks = student.online_homeworks || [];
    const homeworkIdStr = String(homework_id);
    
    console.log('🔍 Searching for homework result:', {
      student_id: student_id,
      homework_id: homework_id,
      homework_id_str: homeworkIdStr,
      online_homeworks_count: onlineHomeworks.length,
      online_homeworks_ids: onlineHomeworks.map(hw => ({
        homework_id: hw.homework_id,
        homework_id_type: typeof hw.homework_id,
        homework_id_str: hw.homework_id ? String(hw.homework_id) : null
      }))
    });
    
    const matchingResult = onlineHomeworks.find(hw => {
      const hwIdStr = hw.homework_id ? String(hw.homework_id) : null;
      return hwIdStr === homeworkIdStr;
    });
    
    if (!matchingResult) {
      console.log('❌ No matching result found');
      // Return homework data even if no result exists, so frontend can handle gracefully
      return res.status(200).json({ 
        success: false,
        homework: homework,
        result: null,
        error: 'Homework result not found. You may not have completed this homework yet.',
        hasResult: false
      });
    }
    
    console.log('✅ Found matching result:', matchingResult);

    // Return homework data and saved result
    res.json({ 
      success: true,
      homework: homework,
      result: matchingResult,
      hasResult: true
    });
  } catch (error) {
    console.error('❌ Error fetching homework details:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

