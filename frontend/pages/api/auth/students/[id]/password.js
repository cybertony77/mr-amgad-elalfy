import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../../lib/authMiddleware';
import { sendPasswordChangeEmail } from '../../../lib/emailUtils';

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

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
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
    const { password } = req.body;

    if (!password || password.trim() === '') {
      return res.status(400).json({ error: 'Password is required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
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

      // Hash the new password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update password in users collection
      await db.collection('users').updateOne(
        { id: studentId, role: 'student' },
        { $set: { password: hashedPassword } }
      );

      // Send password change email notification
      if (userAccount.email) {
        // Get student name from students collection
        const student = await db.collection('students').findOne({ id: studentId });
        const userName = student?.name || userAccount.name || 'User';
        try {
          await sendPasswordChangeEmail(userAccount.email, userName, 'student');
        } catch (emailError) {
          console.error('Failed to send password change email:', emailError);
          // Don't fail the request if email fails
        }
      }

      res.status(200).json({ message: 'Password updated successfully' });

    } finally {
      if (client) await client.close();
    }

  } catch (error) {
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.error('Error updating student password:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

