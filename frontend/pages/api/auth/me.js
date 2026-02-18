import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';
import { sendPasswordChangeEmail } from '../lib/emailUtils';

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
const MONGO_URI = envConfig.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-george-magdy';

console.log('🔗 Using Mongo URI:', MONGO_URI);

async function getAssistantFromToken(req) {
  try {
    const user = await authMiddleware(req);
    return user;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    const decoded = await getAssistantFromToken(req);
    if (!decoded) return res.status(401).json({ error: 'Unauthorized' });
    if (req.method === 'GET') {
      const assistant = await db.collection('users').findOne({ id: decoded.assistant_id });
      if (!assistant) return res.status(404).json({ error: 'Assistant not found' });
      res.json({
        id: assistant.id,
        name: assistant.name,
        phone: assistant.phone,
        password: assistant.password,
        role: assistant.role,
        email: assistant.email || null,
        profile_picture: assistant.profile_picture || null
      });
    } else if (req.method === 'PUT') {
      const { name, id, phone, password, profile_picture, email } = req.body;
      
      const update = {};
      
      if (name !== undefined && name !== null && typeof name === 'string' && name.trim() !== '') {
        update.name = name.replace(/[$]/g, '');
      }
      if (id !== undefined && id !== null && typeof id === 'string' && id.trim() !== '') {
        update.id = id.replace(/[$]/g, '');
      }
      if (phone !== undefined && phone !== null && typeof phone === 'string' && phone.trim() !== '') {
        update.phone = phone.replace(/[$]/g, '');
      }
      if (password !== undefined && password !== null && typeof password === 'string' && password.trim() !== '') {
        update.password = await bcrypt.hash(password, 10);
      }
      if (email !== undefined) {
        // Validate email format if provided
        if (email === null || email === '') {
          update.email = null;
        } else if (typeof email === 'string' && email.trim() !== '') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email.trim())) {
            return res.status(400).json({ error: 'Invalid email format' });
          }
          update.email = email.trim();
        }
      }
      // Handle profile_picture: can be set to a string (public_id) or null to remove
      if (profile_picture !== undefined) {
        if (profile_picture === null || profile_picture === '') {
          // Remove profile picture
          update.profile_picture = null;
        } else if (typeof profile_picture === 'string' && profile_picture.trim() !== '') {
          // Set new profile picture
          update.profile_picture = profile_picture.trim();
        }
      }
      
      // Only proceed if there are fields to update
      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      
      // Check if password was changed
      const passwordChanged = update.password !== undefined;
      
      await db.collection('users').updateOne(
        { id: decoded.assistant_id },
        { $set: update }
      );
      
      // Send password change email notification if password was changed
      if (passwordChanged) {
        const assistant = await db.collection('users').findOne({ id: decoded.assistant_id });
        if (assistant && assistant.email) {
          const userName = assistant.name || 'User';
          const userRole = assistant.role || 'assistant';
          try {
            await sendPasswordChangeEmail(assistant.email, userName, userRole);
          } catch (emailError) {
            console.error('Failed to send password change email:', emailError);
            // Don't fail the request if email fails
          }
        }
      }
      
      res.json({ success: true });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
} 