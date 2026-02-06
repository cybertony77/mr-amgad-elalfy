import { MongoClient } from 'mongodb';
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

  const { id, sig } = req.body;

  if (!id || !sig) {
    return res.status(400).json({ error: 'ID and signature are required', valid: false });
  }

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Check if user exists
    const userId = /^\d+$/.test(id) ? Number(id) : id;
    const user = await db.collection('users').findOne({
      $or: [
        { id: userId },
        { id: id }
      ]
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found', valid: false });
    }

    // Verify HMAC signature
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
      return res.json({ valid: false, error: 'Invalid signature format' });
    }

    if (!isValid) {
      return res.json({ valid: false, error: 'Invalid signature' });
    }

    // Check if OTP has been used (used = true)
    // If used = true, deny access even if signature is valid
    const otpData = user.OTP_rest_password;
    if (otpData && otpData.used === true) {
      return res.json({ valid: false, error: 'OTP has already been used. Please request a new OTP.' });
    }

    // Check OTP expiration date
    // If expiration date is null or expiration date <= now (expired), deny access
    if (!otpData || !otpData.OTP_Expiration_Date) {
      // OTP expiration date is null or missing
      return res.json({ valid: false, error: 'OTP session has expired. Please request a new OTP.' });
    }
    
    const expirationDate = new Date(otpData.OTP_Expiration_Date);
    const now = new Date();
    if (now >= expirationDate) {
      // Current time is >= expiration date (expired)
      return res.json({ valid: false, error: 'OTP session has expired. Please request a new OTP.' });
    }

    // Signature is valid, OTP is not used, and expiration date is valid - allow access to reset password page
    // The signature proves that the OTP was successfully verified
    res.json({ valid: true });
  } catch (error) {
    console.error('Verify signature error:', error);
    res.status(500).json({ error: 'Failed to verify signature', valid: false });
  } finally {
    if (client) await client.close();
  }
}

