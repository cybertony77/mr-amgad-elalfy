import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';

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
  
  let client;
  let db;
  try {
    console.log('🔄 Reset All API called - optimizing for large datasets...');
    
    // Validate environment variables
    if (!MONGO_URI || !DB_NAME || !JWT_SECRET) {
      console.error('❌ Missing environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error', 
        details: 'Missing required environment variables'
      });
    }

    console.log('🔗 Connecting to MongoDB...');
    client = await MongoClient.connect(MONGO_URI);
    db = client.db(DB_NAME);
    console.log('✅ Connected to database:', DB_NAME);
    
    // Verify authentication
    console.log('🔐 Authenticating user...');
    const user = await authMiddleware(req);
    console.log('✅ User authenticated:', user.assistant_id || user.id);
    
    // Create reset weeks array (optimized structure)
    console.log('📋 Creating reset weeks template...');
    const resetWeeks = [];
    for (let i = 1; i <= 20; i++) {
      resetWeeks.push({
        week: i,
        attended: false,
        lastAttendance: null,
        lastAttendanceCenter: null,
        hwDone: false,
        quizDegree: null,
        comment: null,
        message_state: false
      });
    }
    
    // Get total student count first for progress tracking
    console.log('📊 Getting student count...');
    const totalStudents = await db.collection('students').countDocuments();
    console.log(`📈 Found ${totalStudents} students to reset`);
    
    if (totalStudents === 0) {
      return res.json({ 
        success: true, 
        message: 'No students found to reset',
        modifiedCount: 0
      });
    }
    
    // Use bulk operations for better performance with large datasets
    console.log('🚀 Starting bulk reset operation...');
    const startTime = Date.now();
    
    // For very large datasets, we'll use updateMany with proper indexing
    // This is more efficient than individual updates
    const result = await db.collection('students').updateMany(
      {}, // Match all documents
      { $set: { weeks: resetWeeks } },
      { 
        // Add options for better performance
        writeConcern: { w: 1, j: false }, // Don't wait for journaling for better performance
        ordered: false // Allow parallel processing
      }
    );
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log(`✅ Reset operation completed in ${duration}ms`);
    console.log(`📊 Modified ${result.modifiedCount} students`);
    
    // Also clear the history collection since we're resetting all data
    console.log('🗑️ Clearing history collection...');
    const historyResult = await db.collection('history').deleteMany({});
    console.log(`🗑️ Removed ${historyResult.deletedCount} history records`);
    
    res.json({ 
      success: true, 
      message: `Reset data for ${result.modifiedCount} students successfully in ${duration}ms`,
      modifiedCount: result.modifiedCount,
      historyCleared: historyResult.deletedCount,
      duration: `${duration}ms`
    });
    
  } catch (error) {
    console.error('❌ Reset All API error:', error);
    
    if (error.message.includes('Unauthorized') || error.message.includes('Invalid token')) {
      return res.status(401).json({ error: error.message });
    }
    
    if (error.message === 'No token provided') {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    res.status(500).json({ 
      error: 'Failed to reset student data', 
      details: error.message 
    });
  } finally {
    if (client) await client.close();
  }
} 