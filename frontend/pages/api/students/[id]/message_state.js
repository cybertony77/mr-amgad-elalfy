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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI;
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME;
const JWT_SECRET = envConfig.JWT_SECRET || process.env.JWT_SECRET;

// Auth middleware is now imported from shared utility

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { id } = req.query;
  const student_id = parseInt(id);
  const { message_state, week } = req.body;
  
  if (message_state === undefined) {
    return res.status(400).json({ error: 'message_state required' });
  }
  
  if (isNaN(student_id)) {
    return res.status(400).json({ error: 'Invalid student ID' });
  }
  
  let client;
  try {
    // Validate environment variables
    if (!MONGO_URI || !DB_NAME || !JWT_SECRET) {
      console.error('Missing environment variables:', { MONGO_URI: !!MONGO_URI, DB_NAME: !!DB_NAME, JWT_SECRET: !!JWT_SECRET });
      return res.status(500).json({ error: 'Server configuration error' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication
    const user = await authMiddleware(req);
    console.log('Authenticated user:', user.assistant_id);
    
    // Get the current student data
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) {
      console.error(`Student not found: ${student_id}`);
      return res.status(404).json({ error: 'Student not found' });
    }
    
    // Determine which week to update
    const weekNumber = week || 1;
    const weekIndex = weekNumber - 1; // Convert to array index
    
    console.log(`Updating message_state for student ${student_id}, week ${weekNumber} (index ${weekIndex}) to:`, message_state);
    
    // Validate weeks array exists
    if (!student.weeks || !Array.isArray(student.weeks)) {
      console.error(`Student ${student_id} has no weeks array:`, student.weeks);
      return res.status(400).json({ error: 'Student has no weeks data' });
    }
    
    // Validate week index is within bounds
    if (weekIndex < 0 || weekIndex >= student.weeks.length) {
      console.error(`Week index ${weekIndex} out of bounds for student ${student_id}. Weeks array length: ${student.weeks.length}`);
      return res.status(400).json({ error: `Week ${weekNumber} is out of range` });
    }
    
    // Update the specific week in the weeks array
    const result = await db.collection('students').updateOne(
      { id: student_id },
      { $set: { [`weeks.${weekIndex}.message_state`]: !!message_state } }
    );
    
    if (result.matchedCount === 0) {
      console.error(`Failed to update student ${student_id}`);
      return res.status(404).json({ error: 'Student not found' });
    }
    
    console.log(`Successfully updated message_state for student ${student_id}, week ${weekNumber}`);
    
    res.json({ success: true });
  } catch (error) {
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
