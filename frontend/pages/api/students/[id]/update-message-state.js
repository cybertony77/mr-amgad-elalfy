import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../lib/authMiddleware';

// Load environment variables from env.config
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
          value = value.replace(/^"|"$/g, ''); // strip quotes
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
const JWT_SECRET = envConfig.JWT_SECRET || process.env.JWT_SECRET || 'topphysics_secret';
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'topphysics';

console.log('🔗 Using Mongo URI:', MONGO_URI);

// Auth middleware is now imported from shared utility

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { id } = req.query;
  const student_id = parseInt(id);
  const { message_state, week } = req.body;
  
  console.log('📱 Updating message state for student:', student_id);
  console.log('📅 Message state data:', { message_state, week });
  
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication
    const user = await authMiddleware(req);
    console.log('✅ Authentication successful for user:', user.assistant_id);
    
    // Get the current student data
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) {
      console.log('❌ Student not found:', student_id);
      return res.status(404).json({ error: 'Student not found' });
    }
    console.log('✅ Found student:', student.name);
    
    // Check if student account is deactivated
    if (student.account_state === 'Deactivated') {
      console.log('❌ Student account is deactivated:', student_id);
      return res.status(403).json({ error: 'Student account is deactivated' });
    }
    
    // Determine which week to update
    const weekNumber = week || 1;
    const weekIndex = weekNumber - 1; // Convert to array index
    
    // Ensure the target week exists; if not, create weeks up to that index with default schema
    const ensureWeeksExist = async () => {
      const currentLength = Array.isArray(student.weeks) ? student.weeks.length : 0;
      if (currentLength > weekIndex) return; // already exists

      const start = currentLength + 1; // weeks are 1-based
      const end = weekNumber; // inclusive
      const additions = [];
      for (let w = start; w <= end; w++) {
        additions.push({
          week: w,
          attended: false,
          lastAttendance: null,
          lastAttendanceCenter: null,
          hwDone: false,
          quizDegree: null,
          comment: null,
          message_state: false,
        });
      }
      if (additions.length > 0) {
        console.log(`🧩 Creating missing weeks ${start}..${end} for student ${student_id}`);
        await db.collection('students').updateOne(
          { id: student_id },
          { $push: { weeks: { $each: additions } } }
        );
        // Refresh student in-memory reference minimally by extending weeks length
        student.weeks = (student.weeks || []).concat(additions);
      }
    };

    await ensureWeeksExist();
    
    // Update the message state for the specific week
    const updateQuery = {
      [`weeks.${weekIndex}.message_state`]: !!message_state
    };
    
    const result = await db.collection('students').updateOne(
      { id: student_id },
      { $set: updateQuery }
    );
    
    if (result.matchedCount === 0) {
      console.log('❌ Failed to update student:', student_id);
      return res.status(404).json({ error: 'Student not found' });
    }
    console.log('✅ Message state updated for student', student_id, 'week', weekNumber, 'to', !!message_state);
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error in update-message-state endpoint:', error);
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      res.status(401).json({ error: error.message });
    } else {
      console.error('Error updating message state:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } finally {
    if (client) await client.close();
  }
} 