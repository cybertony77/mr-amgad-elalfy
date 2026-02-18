import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { sendPasswordChangeEmail } from '../../lib/emailUtils';

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

// Generate HMAC signature (same as verify-otp.js)
function generateHMAC(id) {
  const message = id + 'rest_pass_from_otp';
  return crypto.createHmac('sha256', JWT_SECRET).update(message).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, newPassword, sig } = req.body;

  if (!id || !newPassword) {
    return res.status(400).json({ error: 'ID and new password are required' });
  }
  if (typeof id !== 'string' && typeof id !== 'number') {
    return res.status(400).json({ error: 'Invalid ID type' });
  }
  if (typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'Invalid password type' });
  }
  if (typeof sig !== 'string') {
    return res.status(400).json({ error: 'Invalid signature type' });
  }

  if (!sig) {
    return res.status(400).json({ error: 'Signature is required. Please verify OTP first.' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
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

    // Verify HMAC signature (authorization check)
    // The signature itself proves that OTP was verified, since it's only generated after successful OTP verification
    const expectedSig = generateHMAC(user.id.toString());
    let isValid = false;
    try {
      isValid = crypto.timingSafeEqual(
        Buffer.from(sig),
        Buffer.from(expectedSig)
      );
    } catch (error) {
      console.error('Signature verification error:', error);
      return res.status(403).json({ error: 'Invalid signature format.' });
    }

    if (!isValid) {
      return res.status(403).json({ error: 'Unauthorized. Invalid signature. Please verify OTP first.' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password, set used to true, and clear OTP and expiration date
    await db.collection('users').updateOne(
      { id: user.id },
      {
        $set: {
          password: hashedPassword,
          'OTP_rest_password.OTP': null,
          'OTP_rest_password.OTP_Expiration_Date': null,
          'OTP_rest_password.used': true
        }
      }
    );

    // Send password change email notification
    if (user.email) {
      const userName = user.name || 'User';
      const userRole = user.role || 'student';
      try {
        await sendPasswordChangeEmail(user.email, userName, userRole);
      } catch (emailError) {
        console.error('Failed to send password change email:', emailError);
        // Don't fail the request if email fails
      }
    }

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password. Please try again.' });
  } finally {
    if (client) await client.close();
  }
}

