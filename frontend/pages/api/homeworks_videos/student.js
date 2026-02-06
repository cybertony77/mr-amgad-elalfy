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
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    // Verify authentication - allow students
    const user = await authMiddleware(req);
    if (!['student', 'admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get student's grade from students collection
    let studentGrade = null;
    if (user.role === 'student') {
      // JWT contains assistant_id, use that to find student
      const studentId = user.assistant_id || user.id;
      console.log('🔍 Homeworks Videos API - User from JWT:', { role: user.role, assistant_id: user.assistant_id, id: user.id, studentId });
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
      
      // Get all sessions and filter by normalized grade in JavaScript
      // This handles case differences: "2nd secondary" matches "2nd Secondary"
      const allSessions = await db.collection('homeworks_videos').find({}).toArray();
      
      // Filter sessions by normalized grade
      console.log('🔍 Filtering homeworks videos. Student normalized grade:', normalizedStudentGrade);
      console.log('🔍 Total sessions before filter:', allSessions.length);
      const filteredSessions = allSessions.filter(session => {
        if (!session.grade) {
          console.log('⚠️ Session has no grade:', session._id);
          return false;
        }
        const normalizedSessionGrade = session.grade.toLowerCase().replace(/\./g, '').trim();
        const matches = normalizedSessionGrade === normalizedStudentGrade;
        console.log(`🔍 Session grade: "${session.grade}" → normalized: "${normalizedSessionGrade}" | Matches: ${matches}`);
        return matches;
      });
      console.log('✅ Filtered sessions count:', filteredSessions.length);
      
      // Sort by week number (ascending), with null weeks at the end
      const sortedSessions = filteredSessions.sort((a, b) => {
        if (a.week === null || a.week === undefined) {
          if (b.week === null || b.week === undefined) {
            return new Date(b.date) - new Date(a.date);
          }
          return 1;
        }
        if (b.week === null || b.week === undefined) {
          return -1;
        }
        if (a.week !== b.week) {
          return a.week - b.week;
        }
        return new Date(b.date) - new Date(a.date);
      });
      
      res.json({ success: true, sessions: sortedSessions });
    } else {
      // If student has no grade, return empty array (don't show any sessions)
      return res.json({ success: true, sessions: [] });
    }
  } catch (error) {
    console.error('❌ Error in homeworks_videos/student API:', error);
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
