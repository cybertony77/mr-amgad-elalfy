import { MongoClient } from 'mongodb';
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

// Format date as MM/DD/YYYY at hour:minute:second AM/PM
function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursStr = String(hours).padStart(2, '0');
  
  return `${month}/${day}/${year} at ${hoursStr}:${minutes}:${seconds} ${ampm}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const student_id = parseInt(id);
  const { week, percentage, result, student_answers, quiz_id, date_of_start, date_of_end, points_added } = req.body;

  if (week === undefined || percentage === undefined || !result || !student_answers || !quiz_id) {
    return res.status(400).json({ error: 'Missing required fields: week, percentage, result, student_answers, quiz_id' });
  }

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication - only student can save their own results
    const user = await authMiddleware(req);
    const userId = user.assistant_id || user.id; // JWT contains assistant_id for students
    if (user.role !== 'student' || userId !== student_id) {
      return res.status(403).json({ error: 'Forbidden: You can only save your own results' });
    }

    // Check if student exists
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Prepare quiz result object
    // Ensure percentage is a number (strip % if present)
    const percentageNum = typeof percentage === 'string' ? percentage.replace('%', '') : percentage;
    const quizResult = {
      quiz_id: quiz_id,
      week: week !== null && week !== undefined ? parseInt(week) : null,
      percentage: `${percentageNum}%`,
      result: result,
      student_answers: student_answers,
      date_of_start: date_of_start || formatDate(new Date()),
      date_of_end: date_of_end || formatDate(new Date()),
      points_added: points_added !== undefined && points_added !== null ? points_added : null
    };

    // Ensure online_quizzes array exists, then push the result
    // MongoDB $push will create the array if it doesn't exist, but we'll ensure it explicitly
    if (!student.online_quizzes || !Array.isArray(student.online_quizzes)) {
      await db.collection('students').updateOne(
        { id: student_id },
        { $set: { online_quizzes: [] } }
      );
    }

    // Push the quiz result
    const updateResult = await db.collection('students').updateOne(
      { id: student_id },
      { $push: { online_quizzes: quizResult } }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Update weeks array if week is provided
    const weekNumber = week !== null && week !== undefined ? parseInt(week) : null;
    if (weekNumber !== null) {
      const weeks = student.weeks || [];
      const weekIndex = weeks.findIndex(w => w && w.week === weekNumber);

      if (weekIndex !== -1) {
        // Update existing week: set quizDegree
        await db.collection('students').updateOne(
          { id: student_id, 'weeks.week': weekNumber },
          {
            $set: {
              'weeks.$.quizDegree': result
            }
          }
        );
      } else {
        // Check if week already exists (handle race conditions)
        // Re-fetch student to get latest data
        const latestStudent = await db.collection('students').findOne({ id: student_id });
        const latestWeeks = latestStudent.weeks || [];
        const latestWeekIndex = latestWeeks.findIndex(w => w && w.week === weekNumber);
        
        if (latestWeekIndex === -1) {
          // Week doesn't exist, add new week entry
          const newWeek = {
            week: weekNumber,
            attended: false,
            lastAttendance: null,
            lastAttendanceCenter: null,
            hwDone: false,
            quizDegree: result,
            comment: null,
            message_state: false
          };
          
          await db.collection('students').updateOne(
            { id: student_id },
            { $push: { weeks: newWeek } }
          );
        } else {
          // Week was added by another request, update it
          await db.collection('students').updateOne(
            { id: student_id, 'weeks.week': weekNumber },
            {
              $set: {
                'weeks.$.quizDegree': result
              }
            }
          );
        }
      }
    }

    res.json({ success: true, message: 'Quiz result saved successfully' });
  } catch (error) {
    console.error('❌ Error saving quiz result:', error);
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

