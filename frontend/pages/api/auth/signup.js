import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-george-magdy';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, email, password, account_id, VAC, profile_picture } = req.body;

  console.log('Signup request received. profile_picture:', profile_picture, 'type:', typeof profile_picture);

  if (!id || !email || !password || !account_id || !VAC) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Validate password length
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Convert id to number if it's numeric for checking
    const studentId = /^\d+$/.test(id) ? Number(id) : id;

    // Check if student ID exists in students collection
    const student = await db.collection('students').findOne({ id: studentId });
    if (!student) {
      return res.status(404).json({ error: 'Sorry, ID not found' });
    }

    // Verify VAC
    const vacRecord = await db.collection('VAC').findOne({ account_id: Number(account_id) });

    if (!vacRecord) {
      return res.status(404).json({ error: 'Account ID not found' });
    }

    // Check if VAC matches first (case-sensitive)
    if (vacRecord.VAC !== VAC) {
      return res.status(401).json({ error: 'Verification account code is incorrect' });
    }

    // If VAC is correct but already activated, reject
    if (vacRecord.VAC_activated) {
      return res.status(409).json({ error: 'This account is already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Convert id to number if it's numeric
    const userId = /^\d+$/.test(id) ? Number(id) : id;

    // Check if user ID already exists (check both as number and string)
    const existingUser = await db.collection('users').findOne({ 
      $or: [
        { id: userId },
        { id: id }
      ]
    });
    if (existingUser) {
      return res.status(409).json({ error: 'User ID already exists' });
    }

    // Create user account
    const newUser = {
      id: userId,
      email: email.trim(),
      role: 'student',
      password: hashedPassword
    };

    // Only add profile_picture if it exists and is not empty
    if (profile_picture && profile_picture.trim() !== '') {
      newUser.profile_picture = profile_picture;
      console.log('Adding profile_picture to user:', profile_picture);
    } else {
      console.log('No profile_picture provided or empty');
    }

    console.log('Creating user with data:', { ...newUser, password: '***' });

    await db.collection('users').insertOne(newUser);

    // Mark VAC as activated
    await db.collection('VAC').updateOne(
      { account_id: Number(account_id) },
      { $set: { VAC_activated: true } }
    );

    // Send welcome email to student
    try {
      const { sendWelcomeEmail } = await import('../lib/emailUtils');
      const studentName = student.name || 'Student';
      const studentDriveLink = envConfig.STUDENT_DRIVE_LINK || process.env.STUDENT_DRIVE_LINK || '';
      await sendWelcomeEmail(email.trim(), studentName, 'student', studentDriveLink);
      console.log('✅ Welcome email sent to student:', email);
    } catch (emailError) {
      console.error('⚠️  Failed to send welcome email (non-critical):', emailError);
      // Don't fail the signup if email fails
    }

    return res.status(201).json({ 
      success: true, 
      message: 'Account created successfully',
      user_id: id
    });

  } catch (error) {
    console.error('Sign up error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}

