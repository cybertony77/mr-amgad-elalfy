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
  const { hwDone, week } = req.body;
  
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication
    const user = await authMiddleware(req);
    
    // Get the current student data
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) return res.status(404).json({ error: 'Student not found' });
    
    // Determine which week to update
    const weekNumber = week || 1;
    
    // Find the week in the weeks array
    const weeks = student.weeks || [];
    const weekIndex = weeks.findIndex(w => w && w.week === weekNumber);
    
    // Handle both boolean and string values for hwDone
    let hwValue;
    if (hwDone === "No Homework") {
      hwValue = "No Homework";
    } else if (hwDone === "Not Completed") {
      hwValue = "Not Completed";
    } else {
      hwValue = !!hwDone; // Convert to boolean for true/false values
    }
    
    if (weekIndex !== -1) {
      // Update existing week
      const updateFields = {};
      updateFields[`weeks.${weekIndex}.hwDone`] = hwValue;
      
      // If hwDone is false, "No Homework", or "Not Completed", clear hwDegree
      if (hwValue === false || hwValue === "No Homework" || hwValue === "Not Completed") {
        updateFields[`weeks.${weekIndex}.hwDegree`] = null;
      }
      
      const result = await db.collection('students').updateOne(
        { id: student_id },
        { $set: updateFields }
      );
      
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Student not found' });
    } else {
      // Week doesn't exist, create it
      const newWeek = {
        week: weekNumber,
        attended: false,
        lastAttendance: null,
        lastAttendanceCenter: null,
        hwDone: hwValue,
        hwDegree: (hwValue === false || hwValue === "No Homework" || hwValue === "Not Completed") ? null : null,
        quizDegree: null,
        comment: null,
        message_state: false
      };
      
    const result = await db.collection('students').updateOne(
      { id: student_id },
        { $push: { weeks: newWeek } }
    );
    
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Student not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      res.status(401).json({ error: error.message });
    } else {
      console.error('Error updating homework:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } finally {
    if (client) await client.close();
  }
} 