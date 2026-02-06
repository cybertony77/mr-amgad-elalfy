import { MongoClient } from 'mongodb';
import { verifySignature } from '../../../../lib/hmac';
import fs from 'fs';
import path from 'path';

// Load environment variables from env.config
function loadEnvConfig() {
  try {
    // Try multiple possible paths for env.config
    const possiblePaths = [
      path.join(process.cwd(), '..', 'env.config'), // From frontend folder
      path.join(process.cwd(), '..', '..', 'env.config'), // From frontend/pages
      path.join(process.cwd(), '..', '..', '..', 'env.config'), // From frontend/pages/api
      path.join(process.cwd(), '..', '..', '..', '..', 'env.config'), // From frontend/pages/api/students
      path.join(process.cwd(), '..', '..', '..', '..', '..', 'env.config'), // From frontend/pages/api/students/public
      path.join(__dirname, '..', '..', '..', '..', '..', 'env.config'), // Using __dirname
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
    console.error('❌ Error loading env.config:', error.message);
    return {};
  }
}

const envConfig = loadEnvConfig();
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI;
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { id } = req.query;
  const { sig } = req.query;

  // Verify HMAC signature
  if (!verifySignature(id, sig)) {
    console.log('❌ Public API: Invalid HMAC signature');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    const studentsCollection = db.collection('students');

    let student;
    
    // Try to find by numeric ID first
    if (/^\d+$/.test(id)) {
      student = await studentsCollection.findOne({ id: parseInt(id) });
    }
    
    // If not found by numeric ID, try by MongoDB ObjectId
    if (!student) {
      try {
        const { ObjectId } = require('mongodb');
        student = await studentsCollection.findOne({ _id: new ObjectId(id) });
      } catch (error) {
        console.log('❌ Invalid ObjectId format:', id);
      }
    }

    if (!student) {
      console.log('❌ Public API: Student not found:', id);
      return res.status(404).json({ message: 'Student not found' });
    }

    console.log('✅ Public API: Student found:', { id: student.id, name: student.name });
    
    client.close();
    return res.status(200).json(student);
  } catch (error) {
    console.error('❌ Public API: Database error:', error);
    if (client) {
      client.close();
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}

