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

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication
    await authMiddleware(req);

    // Get student data
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const onlineQuizzes = student.online_quizzes || [];
    
    // Fetch quiz details for each quiz_id
    const quizzesWithDetails = await Promise.all(
      onlineQuizzes.map(async (quizResult) => {
        try {
          const quiz = await db.collection('quizzes').findOne({ 
            _id: new ObjectId(quizResult.quiz_id) 
          });
          return {
            ...quizResult,
            quiz: quiz ? {
              _id: quiz._id,
              lesson_name: quiz.lesson_name,
              week: quiz.week,
              timer: quiz.timer,
              questions: quiz.questions ? quiz.questions.length : 0
            } : null
          };
        } catch (err) {
          console.error(`Error fetching quiz ${quizResult.quiz_id}:`, err);
          return {
            ...quizResult,
            quiz: null
          };
        }
      })
    );

    res.json({ 
      success: true,
      quizzes: quizzesWithDetails
    });
  } catch (error) {
    console.error('❌ Error fetching online quizzes:', error);
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

