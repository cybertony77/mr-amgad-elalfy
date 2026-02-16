import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../../lib/authMiddleware';

// Load environment variables from env.config
function loadEnvConfig() {
  try {
    // Try multiple possible paths for env.config
    const possiblePaths = [
      path.join(process.cwd(), '..', 'env.config'), // From frontend folder
      path.join(process.cwd(), '..', '..', 'env.config'), // From frontend/pages
      path.join(process.cwd(), '..', '..', '..', 'env.config'), // From frontend/pages/api
      path.join(process.cwd(), '..', '..', '..', '..', 'env.config'), // From frontend/pages/api/auth
      path.join(process.cwd(), '..', '..', '..', '..', '..', 'env.config'), // From frontend/pages/api/auth/students
      path.join(process.cwd(), '..', '..', '..', '..', '..', '..', 'env.config'), // From frontend/pages/api/auth/students/[id]
    ];
    
    let envPath = null;
    for (const testPath of possiblePaths) {
      if (fs.existsSync(testPath)) {
        envPath = testPath;
        break;
      }
    }
    
    if (!envPath) {
      throw new Error('env.config file not found in any expected location');
    }
    
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};

    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          let value = trimmed.substring(index + 1).trim();
          // Remove quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          envVars[key] = value;
        }
      }
    });

    return envVars;
  } catch (error) {
    console.log('⚠️  Could not read env.config, using process.env as fallback:', error.message);
    return {};
  }
}

const envConfig = loadEnvConfig();
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/demo-attendance-system';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'demo-attendance-system';

// Log connection info for debugging (without exposing credentials)
if (MONGO_URI) {
  const uriWithoutAuth = MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');
  console.log('🔗 Delete Account API - Using Mongo URI:', uriWithoutAuth);
  console.log('🔗 Delete Account API - Using DB Name:', DB_NAME);
}

// Helper function to generate VAC code (7 chars: 3 numbers, 2 uppercase, 2 lowercase)
const generateVACCode = () => {
  const numbers = '123456789';
  const uppercase = 'ABDEFGHJKMNPQRTUVWXYZ';
  const lowercase = 'abdefghjkmnpqrtuvwxyz';
  
  // Generate 3 random numbers
  const numPart = Array.from({ length: 3 }, () => 
    numbers[Math.floor(Math.random() * numbers.length)]
  ).join('');
  
  // Generate 2 random uppercase letters
  const upperPart = Array.from({ length: 2 }, () => 
    uppercase[Math.floor(Math.random() * uppercase.length)]
  ).join('');
  
  // Generate 2 random lowercase letters
  const lowerPart = Array.from({ length: 2 }, () => 
    lowercase[Math.floor(Math.random() * lowercase.length)]
  ).join('');
  
  // Combine and shuffle to randomize order
  const code = (numPart + upperPart + lowerPart).split('');
  for (let i = code.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [code[i], code[j]] = [code[j], code[i]];
  }
  
  return code.join('');
};

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication (admin, developer, or assistant only)
    const user = await authMiddleware(req);
    const allowedRoles = ['admin', 'developer', 'assistant'];
    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const { id } = req.query;
    const studentId = parseInt(id);

    if (isNaN(studentId)) {
      return res.status(400).json({ error: 'Invalid student ID' });
    }

    let client;
    try {
      // Connect to MongoDB with proper error handling
      client = await MongoClient.connect(MONGO_URI, {
        serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      });
      const db = client.db(DB_NAME);

      // Test connection by pinging the database
      await db.admin().ping();

      // Check if student account exists in users collection
      const userAccount = await db.collection('users').findOne({
        id: studentId,
        role: 'student'
      });

      if (!userAccount) {
        return res.status(404).json({ error: 'Student account not found' });
      }

      // Delete the student account from users collection
      const deleteResult = await db.collection('users').deleteOne({
        id: studentId,
        role: 'student'
      });

      if (deleteResult.deletedCount === 0) {
        return res.status(404).json({ error: 'Student account not found' });
      }

      // Generate new VAC code
      const code = generateVACCode();
      // Shuffle the code again for extra randomness (same as seed_db.js)
      const shuffledCode = code.split('').sort(() => Math.random() - 0.5).join('');

      // Update or create VAC record with new code
      const vacResult = await db.collection('VAC').updateOne(
        { account_id: studentId },
        { 
          $set: { 
            VAC: shuffledCode,
            VAC_activated: false
          } 
        },
        { upsert: true } // Create if doesn't exist
      );

      res.status(200).json({ 
        success: true,
        message: 'Student account deleted and VAC regenerated successfully',
        VAC: shuffledCode
      });

    } finally {
      if (client) await client.close();
    }

  } catch (error) {
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.error('Error deleting student account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

