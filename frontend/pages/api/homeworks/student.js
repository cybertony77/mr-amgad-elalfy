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
        console.log('🔍 Student API - User from JWT:', { role: user.role, assistant_id: user.assistant_id, id: user.id, studentId });
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
        
        // Get all homeworks and filter by normalized grade in JavaScript
        // This handles case differences: "2nd secondary" matches "2nd Secondary"
        const allHomeworks = await db.collection('homeworks').find({}).toArray();
        
        // Filter homeworks by normalized grade
        console.log('🔍 Filtering homeworks. Student normalized grade:', normalizedStudentGrade);
        console.log('🔍 Total homeworks before filter:', allHomeworks.length);
        const filteredHomeworks = allHomeworks.filter(hw => {
          if (!hw.grade) {
            console.log('⚠️ Homework has no grade:', hw._id);
            return false;
          }
          const normalizedHwGrade = hw.grade.toLowerCase().replace(/\./g, '').trim();
          const matches = normalizedHwGrade === normalizedStudentGrade;
          console.log(`🔍 Homework grade: "${hw.grade}" → normalized: "${normalizedHwGrade}" | Matches: ${matches}`);
          return matches;
        });
        console.log('✅ Filtered homeworks count:', filteredHomeworks.length);
        
        // Sort by week number (ascending), with null weeks at the end
        const sortedHomeworks = filteredHomeworks.sort((a, b) => {
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
        const sanitizedHomeworks = sortedHomeworks.map(hw => {
          const sanitized = {
            _id: hw._id,
            grade: hw.grade || null,
            lesson_name: hw.lesson_name,
            week: hw.week || null,
            homework_type: hw.homework_type || 'questions',
            deadline_type: hw.deadline_type || 'no_deadline',
            deadline_date: hw.deadline_date || null,
            timer: hw.timer || null,
            shuffle_questions_and_answers: hw.shuffle_questions_and_answers || false,
            show_details_after_submitting: hw.show_details_after_submitting || false
          };

          // Add pages_from_book fields if applicable
          if (hw.homework_type === 'pages_from_book') {
            sanitized.book_name = hw.book_name || '';
            sanitized.from_page = hw.from_page || null;
            sanitized.to_page = hw.to_page || null;
          }

          // Add questions if applicable (only for questions type)
          if (hw.homework_type === 'questions' && hw.questions && Array.isArray(hw.questions)) {
            sanitized.questions = hw.questions.map(q => ({
              question_text: q.question_text || '',
              question_picture: q.question_picture || null,
              answers: q.answers || [],
              answer_texts: q.answer_texts || []
              // Note: correct_answer is intentionally excluded for students
            }));
          } else {
            sanitized.questions = [];
          }

          return sanitized;
        });
        
        return res.status(200).json({ success: true, homeworks: sanitizedHomeworks });
      } else {
        // If student has no grade, return empty array (don't show any homeworks)
        return res.status(200).json({ success: true, homeworks: [] });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Student Homeworks API error:', error);
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}

