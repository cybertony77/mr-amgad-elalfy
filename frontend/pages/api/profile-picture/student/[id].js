import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../lib/authMiddleware';
import { getSignedImageUrlServer } from '../../../../lib/cloudinary';
import { verifySignature } from '../../../../lib/hmac';

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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/demo-attendance-system';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'demo-attendance-system';

console.log('🔗 Profile Picture API - Env Config:', {
  hasMongoUri: !!envConfig.MONGO_URI,
  hasDbName: !!envConfig.DB_NAME,
  mongoUri: MONGO_URI,
  dbName: DB_NAME
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, sig } = req.query;
    
    console.log('📸 Profile Picture API Request:', { id, hasSig: !!sig });
    
    // Check if this is a public access request (with HMAC signature)
    let isPublicAccess = false;
    if (sig) {
      const studentIdFromQuery = String(id || '').trim();
      const signature = String(sig).trim();
      
      console.log('🔍 Verifying profile picture signature:', { studentIdFromQuery, signatureLength: signature.length });
      
      if (studentIdFromQuery && signature) {
        isPublicAccess = verifySignature(studentIdFromQuery, signature);
        console.log('🔍 Profile picture signature verification result:', isPublicAccess);
        if (!isPublicAccess) {
          console.log('❌ Profile picture: Invalid signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      } else {
        console.log('❌ Profile picture: Missing studentId or signature');
      }
    } else {
      console.log('📸 Profile picture: No signature provided, checking authentication');
    }
    
    // If not public access, verify authentication (admin/assistant/developer only)
    let user = null;
    if (!isPublicAccess) {
      try {
        user = await authMiddleware(req);
        
        // Only allow admin, assistant, or developer to view student profile pictures
        if (user.role !== 'admin' && user.role !== 'assistant' && user.role !== 'developer') {
          return res.status(403).json({ error: 'Forbidden' });
        }
      } catch (authError) {
        // If authentication fails and no signature provided, return 401
        if (!sig) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        // If signature is provided but invalid, already handled above
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    
    if (!id) {
      return res.status(400).json({ error: 'Student ID is required' });
    }
    
    let client;
    try {
      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);
      
      // Get student's profile_picture public_id from users collection
      // Convert id to number (students collection uses numeric IDs)
      const userId = /^\d+$/.test(id) ? Number(id) : id;
      
      console.log('🔍 Looking for student profile picture:', { 
        originalId: id, 
        userId,
        idType: typeof id,
        userIdType: typeof userId
      });
      
      // Find user with numeric ID (ID is stored as number in users collection)
      const userDoc = await db.collection('users').findOne(
        { 
          id: userId,
          role: 'student'
        },
        { projection: { profile_picture: 1, id: 1, role: 1 } }
      );
      
      console.log('📋 User document found:', { 
        found: !!userDoc, 
        hasProfilePicture: !!userDoc?.profile_picture,
        profilePicture: userDoc?.profile_picture,
        userId: userDoc?.id
      });
      
      if (!userDoc || !userDoc.profile_picture) {
        console.log('❌ No profile picture found for student:', id);
        return res.status(200).json({ url: null });
      }
      
      // Generate signed URL - use the same method for both authenticated and public access
      const publicId = userDoc.profile_picture;
      
      console.log('🖼️ Generating signed URL for public_id:', publicId, {
        isPublicAccess,
        hasAuth: !!user
      });
      
      try {
        // Use the same URL generation for both authenticated and public access
        const signedUrl = await getSignedImageUrlServer(publicId);
        
        if (!signedUrl) {
          console.error('❌ Failed to generate signed URL - getSignedImageUrlServer returned null');
          return res.status(500).json({ error: 'Failed to generate image URL' });
        }
        
        console.log('✅ Signed URL generated successfully');
        console.log('🔗 Generated URL:', signedUrl);
        console.log('🔍 URL details:', {
          publicId,
          urlLength: signedUrl.length,
          hasSignature: signedUrl.includes('/s--'),
          isPublicAccess
        });
        
        res.status(200).json({ url: signedUrl });
      } catch (urlError) {
        console.error('❌ Error generating signed URL:', {
          error: urlError.message,
          stack: urlError.stack,
          publicId: publicId,
          isPublicAccess
        });
        return res.status(500).json({ error: 'Failed to generate image URL', details: urlError.message });
      }
      
    } finally {
      if (client) await client.close();
    }
    
  } catch (error) {
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    if (error.message === 'Forbidden') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    console.error('Error getting student profile picture:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

