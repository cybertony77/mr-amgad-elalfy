import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    // Verify authentication
    const user = await authMiddleware(req);
    
    // Check if user has required role (admin, developer, or assistant)
    if (!['admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const { account_id } = req.body;

    if (!account_id) {
      return res.status(400).json({ error: 'account_id is required' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Generate new VAC code
    const code = generateVACCode();
    // Shuffle the code again for extra randomness (same as seed_db.js)
    const shuffledCode = code.split('').sort(() => Math.random() - 0.5).join('');

    // Update VAC record
    const result = await db.collection('VAC').updateOne(
      { account_id: Number(account_id) },
      { 
        $set: { 
          VAC: shuffledCode,
          VAC_activated: false
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'VAC record not found' });
    }

    return res.status(200).json({ 
      success: true,
      message: 'VAC regenerated successfully',
      VAC: shuffledCode
    });
  } catch (error) {
    console.error('Regenerate VAC error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}

