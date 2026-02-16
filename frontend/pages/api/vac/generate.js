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

    const { type, account_id, from, to } = req.body;

    if (!type || !['single', 'many'].includes(type)) {
      return res.status(400).json({ error: 'Type must be "single" or "many"' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    if (type === 'single') {
      // Single generation
      if (!account_id) {
        return res.status(400).json({ error: 'account_id is required for single generation' });
      }

      const accountIdNum = parseInt(account_id);
      if (isNaN(accountIdNum) || accountIdNum < 1) {
        return res.status(400).json({ error: 'Invalid account_id' });
      }

      // Check if VAC already exists
      const existingVAC = await db.collection('VAC').findOne({ account_id: accountIdNum });
      
      if (existingVAC) {
        // Regenerate existing VAC
        const code = generateVACCode();
        const shuffledCode = code.split('').sort(() => Math.random() - 0.5).join('');
        
        await db.collection('VAC').updateOne(
          { account_id: accountIdNum },
          { 
            $set: { 
              VAC: shuffledCode,
              VAC_activated: false
            } 
          }
        );

        return res.status(200).json({
          success: true,
          message: 'VAC regenerated successfully',
          VAC: shuffledCode,
          account_id: accountIdNum,
          existed: true
        });
      } else {
        // Create new VAC
        const code = generateVACCode();
        const shuffledCode = code.split('').sort(() => Math.random() - 0.5).join('');
        
        await db.collection('VAC').insertOne({
          account_id: accountIdNum,
          VAC: shuffledCode,
          VAC_activated: false
        });

        return res.status(201).json({
          success: true,
          message: 'VAC created successfully',
          VAC: shuffledCode,
          account_id: accountIdNum,
          existed: false
        });
      }
    } else {
      // Many generation
      if (!from || !to) {
        return res.status(400).json({ error: 'from and to are required for many generation' });
      }

      const fromNum = parseInt(from);
      const toNum = parseInt(to);

      if (isNaN(fromNum) || isNaN(toNum) || fromNum < 1 || toNum < 1) {
        return res.status(400).json({ error: 'Invalid from or to values' });
      }

      if (fromNum > toNum) {
        return res.status(400).json({ error: 'from must be less than or equal to to' });
      }

      // Get existing VACs in the range
      const existingVACs = await db.collection('VAC')
        .find({ account_id: { $gte: fromNum, $lte: toNum } })
        .project({ account_id: 1 })
        .toArray();

      const existingIds = new Set(existingVACs.map(vac => vac.account_id));
      const allIds = Array.from({ length: toNum - fromNum + 1 }, (_, i) => fromNum + i);
      const newIds = allIds.filter(id => !existingIds.has(id));
      const alreadyExistedIds = allIds.filter(id => existingIds.has(id)).sort((a, b) => a - b);

      if (newIds.length === 0) {
        return res.status(400).json({
          error: 'All IDs in the range already have VAC codes',
          alreadyExisted: alreadyExistedIds
        });
      }

      // Generate VACs for new IDs
      const newVACs = newIds.map(id => {
        const code = generateVACCode();
        const shuffledCode = code.split('').sort(() => Math.random() - 0.5).join('');
        return {
          account_id: id,
          VAC: shuffledCode,
          VAC_activated: false
        };
      });

      await db.collection('VAC').insertMany(newVACs);

      // Format message for already existed IDs
      let alreadyExistedMessage = undefined;
      if (alreadyExistedIds.length > 0) {
        if (alreadyExistedIds.length === 1) {
          alreadyExistedMessage = `ID ${alreadyExistedIds[0]} already exists`;
        } else {
          // Check if IDs are consecutive
          const isConsecutive = alreadyExistedIds.every((id, index) => 
            index === 0 || id === alreadyExistedIds[index - 1] + 1
          );
          if (isConsecutive) {
            alreadyExistedMessage = `IDs ${alreadyExistedIds[0]} to ${alreadyExistedIds[alreadyExistedIds.length - 1]} already exist`;
          } else {
            alreadyExistedMessage = `IDs ${alreadyExistedIds[0]} to ${alreadyExistedIds[alreadyExistedIds.length - 1]} (and others) already exist`;
          }
        }
      }

      return res.status(201).json({
        success: true,
        message: `${newVACs.length} VAC code(s) created successfully`,
        created: newVACs.length,
        alreadyExisted: alreadyExistedIds.length > 0 ? alreadyExistedIds : undefined,
        alreadyExistedMessage: alreadyExistedMessage
      });
    }
  } catch (error) {
    console.error('Generate VAC error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}

