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

// Format date as DD/MM/YYYY
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

// Format date with time as DD/MM/YYYY at HH:MM AM/PM
function formatDateWithTime(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  
  return `${day}/${month}/${year} at ${hoursStr}:${minutes} ${ampm}`;
}

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

    const { id } = req.query;
    const student_id = parseInt(id);
    // For students, the ID is in assistant_id, for others it's in id
    // Handle both string and number types
    const getUserId = (val) => {
      if (val === null || val === undefined) return null;
      return typeof val === 'number' ? val : parseInt(val);
    };
    
    const userId = user.role === 'student' 
      ? getUserId(user.assistant_id) || getUserId(user.id)
      : getUserId(user.id) || getUserId(user.assistant_id);

    // Students can only update their own data
    if (user.role === 'student' && userId !== student_id) {
      console.error('❌ Student ID mismatch:', { 
        userId, 
        student_id, 
        assistant_id: user.assistant_id, 
        user_id: user.id,
        role: user.role 
      });
      return res.status(403).json({ 
        error: 'Forbidden: You can only update your own data',
        details: { userId, student_id, assistant_id: user.assistant_id, user_id: user.id }
      });
    }

    const { session_id, action, payment_state } = req.body; // action: 'view' or 'finish', payment_state: 'free' or 'paid'

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get student
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get session to get week and payment_state
    const session = await db.collection('online_sessions').findOne({ _id: new ObjectId(session_id) });
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Determine payment state from request body or session
    const isFreeVideo = payment_state === 'free' || session.payment_state === 'free';

    if (action === 'view') {
      // Just record that video was opened (no decrement)
      return res.status(200).json({ 
        success: true,
        message: 'Video view recorded'
      });
    } else if (action === 'finish') {
      // Add entry to student's online_sessions array (for both free and paid videos)
      {
        const onlineSessions = student.online_sessions || [];
        const sessionIdStr = typeof session_id === 'string' ? session_id : session_id.toString();
        
        // Check if entry already exists
        const existingEntry = onlineSessions.find(s => {
          const videoIdStr = typeof s.video_id === 'string' ? s.video_id : s.video_id?.toString();
          return videoIdStr === sessionIdStr;
        });

        if (!existingEntry) {
          // Add new entry for video (YouTube videos don't need VVC)
          const videoEntry = {
            video_id: sessionIdStr,
            date: formatDateWithTime(new Date())
          };
          
          await db.collection('students').updateOne(
            { id: student_id },
            { $push: { online_sessions: videoEntry } }
          );
          
          console.log('✅ Added video entry to student online_sessions:', videoEntry);
        } else {
          console.log('ℹ️ Video entry already exists in student online_sessions');
        }
      }

      // Mark attendance when video finishes
      const week = session.week;
      if (week !== null && week !== undefined) {
        const weeks = student.weeks || [];
        // Find the first matching week (in case of duplicates, update the first one)
        const weekIndex = weeks.findIndex(w => w && w.week === week);

        const attendanceDate = formatDate(new Date());
        const attendanceString = `${attendanceDate} in Online`;

        let attendanceMarked = false;
        
        if (weekIndex !== -1) {
          // Update existing week (this will update the first matching week)
          const updateResult = await db.collection('students').updateOne(
            { id: student_id, 'weeks.week': week },
            {
              $set: {
                'weeks.$.attended': true,
                'weeks.$.lastAttendance': attendanceString,
                'weeks.$.lastAttendanceCenter': 'Online'
              }
            }
          );
          attendanceMarked = updateResult.modifiedCount > 0 || updateResult.matchedCount > 0;
        } else {
          // Check if week already exists (handle race conditions)
          // Re-fetch student to get latest data
          const latestStudent = await db.collection('students').findOne({ id: student_id });
          const latestWeeks = latestStudent.weeks || [];
          const latestWeekIndex = latestWeeks.findIndex(w => w && w.week === week);
          
          if (latestWeekIndex === -1) {
            // Week doesn't exist, add new week entry
            const newWeek = {
              week: week,
              attended: true,
              lastAttendance: attendanceString,
              lastAttendanceCenter: 'Online',
              hwDone: false,
              quizDegree: null,
              comment: null,
              message_state: false
            };
            const pushResult = await db.collection('students').updateOne(
              { id: student_id },
              { $push: { weeks: newWeek } }
            );
            attendanceMarked = pushResult.modifiedCount > 0;
          } else {
            // Week exists (race condition - another request added it), update it
            const updateResult = await db.collection('students').updateOne(
              { id: student_id, 'weeks.week': week },
              {
                $set: {
                  'weeks.$.attended': true,
                  'weeks.$.lastAttendance': attendanceString,
                  'weeks.$.lastAttendanceCenter': 'Online'
                }
              }
            );
            attendanceMarked = updateResult.modifiedCount > 0 || updateResult.matchedCount > 0;
          }
        }

        // Create history record when attendance is marked (similar to scan page logic)
        if (attendanceMarked) {
          // Check if history record already exists to avoid duplicates
          const existingHistory = await db.collection('history').findOne({
            studentId: student_id,
            week: week
          });

          if (!existingHistory) {
            // Create simplified history record (only studentId and week)
            const historyRecord = {
              studentId: student.id,
              week: week
            };
            
            console.log('📝 Creating history record for video attendance:', historyRecord);
            const historyResult = await db.collection('history').insertOne(historyRecord);
            console.log('✅ History record created with ID:', historyResult.insertedId);
          } else {
            console.log('ℹ️ History record already exists for student', student_id, 'week', week);
          }
        }
      }

      return res.status(200).json({ 
        success: true,
        message: 'Video finished and attendance marked'
      });
    } else {
      return res.status(400).json({ error: 'Invalid action. Use "view" or "finish"' });
    }
  } catch (error) {
    console.error('❌ Error in watch-video API:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

