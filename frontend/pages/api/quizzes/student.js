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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-george-magdy';

export default async function handler(req, res) {
  let client;
  try {
    // Verify authentication - allow students
    const user = await authMiddleware(req);
    
    // Allow students, admins, developers, and assistants
    if (!['student', 'admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    if (req.method === 'GET') {
      // Get student's grade from students collection
      let studentGrade = null;
      if (user.role === 'student') {
        // JWT contains assistant_id, use that to find student
        const studentId = user.assistant_id || user.id;
        console.log('🔍 Quiz API - User from JWT:', { role: user.role, assistant_id: user.assistant_id, id: user.id, studentId });
        if (studentId) {
          const student = await db.collection('students').findOne({ id: studentId });
          console.log('🔍 Student found:', student ? { id: student.id, grade: student.grade } : 'NOT FOUND');
          if (student && student.grade) {
            studentGrade = student.grade;
            console.log('✅ Using student grade:', studentGrade);
          }
        }
      }

      // Build query filter - ALWAYS filter by grade for students
      if (studentGrade) {
        // Normalize student grade: lowercase, remove periods, trim
        const normalizedStudentGrade = studentGrade.toLowerCase().replace(/\./g, '').trim();
        
        // Get all quizzes and filter by normalized grade in JavaScript
        // This handles case differences: "2nd secondary" matches "2nd Secondary"
        const allQuizzes = await db.collection('quizzes').find({}).toArray();
        
        // Filter quizzes by normalized grade
        console.log('🔍 Filtering quizzes. Student normalized grade:', normalizedStudentGrade);
        console.log('🔍 Total quizzes before filter:', allQuizzes.length);
        const filteredQuizzes = allQuizzes.filter(quiz => {
          if (!quiz.grade) {
            console.log('⚠️ Quiz has no grade:', quiz._id);
            return false;
          }
          const normalizedQuizGrade = quiz.grade.toLowerCase().replace(/\./g, '').trim();
          const matches = normalizedQuizGrade === normalizedStudentGrade;
          console.log(`🔍 Quiz grade: "${quiz.grade}" → normalized: "${normalizedQuizGrade}" | Matches: ${matches}`);
          return matches;
        });
        console.log('✅ Filtered quizzes count:', filteredQuizzes.length);
        
        // Sort by week number (ascending), with null weeks at the end
        const sortedQuizzes = filteredQuizzes.sort((a, b) => {
          if (a.week === null || a.week === undefined) {
            if (b.week === null || b.week === undefined) {
              return b._id.toString().localeCompare(a._id.toString());
            }
            return 1;
          }
          if (b.week === null || b.week === undefined) {
            return -1;
          }
          if (a.week !== b.week) {
            return a.week - b.week;
          }
          return b._id.toString().localeCompare(a._id.toString());
        });
        
        // Remove correct_answer from questions for students
        const sanitizedQuizzes = sortedQuizzes.map(quiz => ({
          _id: quiz._id,
          grade: quiz.grade || null,
          lesson_name: quiz.lesson_name,
          week: quiz.week || null,
          quiz_type: 'questions', // Always questions type
          deadline_type: quiz.deadline_type || 'no_deadline',
          deadline_date: quiz.deadline_date || null,
          timer: quiz.timer,
          shuffle_questions_and_answers: quiz.shuffle_questions_and_answers || false,
          show_details_after_submitting: quiz.show_details_after_submitting || false,
          questions: (quiz.questions || []).map(q => ({
            question_text: q.question_text || '',
            question_picture: q.question_picture || null,
            answers: q.answers || [],
            answer_texts: q.answer_texts || []
            // Note: correct_answer is intentionally excluded for students
          }))
        }));
        
        return res.status(200).json({ success: true, quizzes: sanitizedQuizzes });
      } else {
        // If student has no grade, return empty array (don't show any quizzes)
        return res.status(200).json({ success: true, quizzes: [] });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Student Quizzes API error:', error);
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}

