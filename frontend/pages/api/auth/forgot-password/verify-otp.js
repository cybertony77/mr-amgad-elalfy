import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

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
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'topphysics';
const JWT_SECRET = envConfig.JWT_SECRET || process.env.JWT_SECRET || 'topphysics_secret';

// Generate HMAC signature
function generateHMAC(id) {
  const message = id + 'rest_pass_from_otp';
  return crypto.createHmac('sha256', JWT_SECRET).update(message).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, otp } = req.body;

  if (!id || !otp) {
    return res.status(400).json({ error: 'ID and OTP are required' });
  }
  if (typeof id !== 'string' && typeof id !== 'number') {
    return res.status(400).json({ error: 'Invalid ID type' });
  }
  if (typeof otp !== 'string') {
    return res.status(400).json({ error: 'Invalid OTP type' });
  }

  if (otp.length !== 8) {
    return res.status(400).json({ error: 'OTP must be 8 digits' });
  }

  const safeId = String(id).replace(/[$]/g, '');

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    const userId = /^\d+$/.test(safeId) ? Number(safeId) : safeId;
    const user = await db.collection('users').findOne({
      $or: [
        { id: userId },
        { id: safeId }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if OTP exists
    if (!user.OTP_rest_password || !user.OTP_rest_password.OTP) {
      return res.status(400).json({ error: 'No OTP found. Please request a new one.' });
    }

    // Check if OTP has already been used
    if (user.OTP_rest_password.used === true) {
      return res.status(400).json({ error: 'This OTP has already been used. Please request a new one.' });
    }

    // Check expiration
    const expirationDate = new Date(user.OTP_rest_password.OTP_Expiration_Date);
    const now = new Date();

    if (now > expirationDate) {
      return res.status(400).json({ error: 'OTP Expired' });
    }

    // Verify OTP
    const isValid = await bcrypt.compare(otp, user.OTP_rest_password.OTP);

    if (!isValid) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // Clear OTP and set used to false, keep expiration and resend_expiration
    await db.collection('users').updateOne(
      { id: user.id },
      {
        $set: {
          'OTP_rest_password.OTP': null,
          'OTP_rest_password.used': false
        }
      }
    );

    // Generate HMAC signature
    const sig = generateHMAC(user.id.toString());

    res.json({ success: true, message: 'OTP Verified', sig });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Failed to verify OTP. Please try again.' });
  } finally {
    if (client) await client.close();
  }
}

