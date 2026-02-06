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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI;
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const student_id = parseInt(id);
  const { quiz_id } = req.query;

  if (!quiz_id) {
    return res.status(400).json({ error: 'quiz_id is required' });
  }

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication - allow admin/assistant/developer
    await authMiddleware(req);

    // Get student data
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get the quiz
    const quiz = await db.collection('quizzes').findOne({ _id: new ObjectId(quiz_id) });
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Find result that matches this quiz_id
    const onlineQuizzes = student.online_quizzes || [];
    const matchingResult = onlineQuizzes.find(qz => qz.quiz_id === quiz_id);
    
    if (!matchingResult) {
      return res.status(404).json({ error: 'Quiz result not found' });
    }

    // Return quiz data and saved result
    res.json({ 
      success: true,
      quiz: quiz,
      result: matchingResult
    });
  } catch (error) {
    console.error('❌ Error fetching quiz details:', error);
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

