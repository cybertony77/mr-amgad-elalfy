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
  const { quiz_id } = req.query;

  if (!quiz_id) {
    return res.status(400).json({ error: 'quiz_id is required' });
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

    // Get the quiz
    const quiz = await db.collection('quizzes').findOne({ _id: new ObjectId(quiz_id) });
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }

    // Check if show_details_after_submitting is enabled
    if (quiz.show_details_after_submitting !== true && quiz.show_details_after_submitting !== 'true') {
      return res.status(403).json({ error: 'Details are not available for this quiz. The teacher has disabled showing details after submitting.' });
    }

    // Find result that matches this quiz_id
    // Normalize both to strings for comparison (handles ObjectId vs string mismatch)
    const onlineQuizzes = student.online_quizzes || [];
    const quizIdStr = String(quiz_id);
    
    console.log('🔍 Searching for quiz result:', {
      student_id: student_id,
      quiz_id: quiz_id,
      quiz_id_str: quizIdStr,
      online_quizzes_count: onlineQuizzes.length,
      online_quizzes_ids: onlineQuizzes.map(qz => ({
        quiz_id: qz.quiz_id,
        quiz_id_type: typeof qz.quiz_id,
        quiz_id_str: qz.quiz_id ? String(qz.quiz_id) : null
      }))
    });
    
    const matchingResult = onlineQuizzes.find(qz => {
      const qzIdStr = qz.quiz_id ? String(qz.quiz_id) : null;
      return qzIdStr === quizIdStr;
    });
    
    if (!matchingResult) {
      console.log('❌ No matching result found');
      // Return quiz data even if no result exists, so frontend can handle gracefully
      return res.status(200).json({ 
        success: false,
        quiz: quiz,
        result: null,
        error: 'Quiz result not found. You may not have completed this quiz yet.',
        hasResult: false
      });
    }
    
    console.log('✅ Found matching result:', matchingResult);

    // Return quiz data and saved result
    res.json({ 
      success: true,
      quiz: quiz,
      result: matchingResult,
      hasResult: true
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

