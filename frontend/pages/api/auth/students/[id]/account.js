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
  console.log('🔗 Account API - Using Mongo URI:', uriWithoutAuth);
  console.log('🔗 Account API - Using DB Name:', DB_NAME);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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
    
    if (!id) {
      return res.status(400).json({ error: 'Student ID is required' });
    }
    
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

      // Return account info (excluding password)
      return res.status(200).json({
        id: userAccount.id,
        role: userAccount.role,
        account_state: userAccount.account_state || 'Activated',
        email: userAccount.email || null
      });

    } catch (dbError) {
      console.error('Database error:', dbError);
      
      // Provide more specific error messages
      if (dbError.code === 13 || dbError.codeName === 'Unauthorized') {
        return res.status(500).json({ 
          error: 'Database authentication failed. Please check MongoDB connection credentials.',
          details: 'MongoDB requires authentication but connection string may be missing credentials.'
        });
      }
      
      return res.status(500).json({ 
        error: 'Database error occurred',
        details: dbError.message 
      });
    } finally {
      if (client) {
        try {
          await client.close();
        } catch (closeError) {
          console.error('Error closing database connection:', closeError);
        }
      }
    }

  } catch (error) {
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.error('Error getting student account:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

