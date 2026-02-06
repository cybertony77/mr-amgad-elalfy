import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../lib/authMiddleware';
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

async function requireAdmin(req) {
  const user = await authMiddleware(req);
  if (user.role !== 'admin' && user.role !== 'developer') {
    throw new Error('Forbidden: Admins or Developers only');
  }
  return user;
}

export default async function handler(req, res) {
  const { id } = req.query;
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify admin access
    const admin = await requireAdmin(req);
    
    if (req.method === 'GET') {
      // Get assistant by ID (exclude password for security)
      const assistant = await db.collection('users')
        .findOne({ id }, { projection: { password: 0 } }); // Exclude password field
      if (!assistant) return res.status(404).json({ error: 'Assistant not found' });
      res.json({ 
        ...assistant,
        account_state: assistant.account_state || "Activated", // Default to Activated
        ATCA: assistant.ATCA || "no" // Default to no
      });
    } else if (req.method === 'PUT') {
      // Edit assistant - handle partial updates properly
      const { id: newId, name, phone, email, password, role, account_state, ATCA } = req.body;
      
      // Build update object with only defined values (not null or undefined)
      const update = {};
      
      if (name !== undefined && name !== null && name.trim() !== '') {
        update.name = name;
      }
      if (phone !== undefined && phone !== null && phone.trim() !== '') {
        update.phone = phone;
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
      if (role !== undefined && role !== null && role.trim() !== '') {
        update.role = role;
      }
      if (password !== undefined && password !== null && password.trim() !== '') {
        update.password = await bcrypt.hash(password, 10);
      }
      if (newId && newId !== id && newId.trim() !== '') {
        // Check for unique new ID
        const exists = await db.collection('users').findOne({ id: newId });
        if (exists) {
          return res.status(409).json({ error: 'Assistant ID already exists' });
        }
        update.id = newId;
      }
      if (account_state !== undefined && account_state !== null) {
        update.account_state = account_state;
      }
      if (ATCA !== undefined && ATCA !== null) {
        update.ATCA = ATCA;
      }
      
      // Only proceed if there are fields to update
      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }
      
      // Check if password was changed
      const passwordChanged = update.password !== undefined;
      
      const result = await db.collection('users').updateOne({ id }, { $set: update });
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Assistant not found' });
      
      // Send password change email notification if password was changed
      if (passwordChanged) {
        const assistant = await db.collection('users').findOne({ id });
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
    } else if (req.method === 'DELETE') {
      // Delete assistant
      const result = await db.collection('users').deleteOne({ id });
      if (result.deletedCount === 0) return res.status(404).json({ error: 'Assistant not found' });
      res.json({ success: true });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    if (error.message === 'Unauthorized') {
      res.status(401).json({ error: 'Unauthorized' });
    } else if (error.message === 'Forbidden: Admins only') {
      res.status(403).json({ error: 'Forbidden: Admins only' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  } finally {
    if (client) await client.close();
  }
} 