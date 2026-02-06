import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';

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
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify admin access
    const admin = await requireAdmin(req);
    
    if (req.method === 'GET') {
      // Check if pagination parameters are provided
      const { page, limit, search, sortBy, sortOrder } = req.query;
      const hasPagination = page || limit;
      
      if (hasPagination) {
        // Paginated response for large datasets
        console.log('📊 Building paginated response...');
        
        // Parse pagination parameters
        const currentPage = parseInt(page) || 1;
        const pageSize = parseInt(limit) || 50;
        const searchTerm = search ? search.trim() : '';
        const sortField = sortBy || 'id';
        const sortDirection = sortOrder === 'desc' ? -1 : 1;
        
        console.log('📋 Pagination params:', { currentPage, pageSize, searchTerm, sortField, sortDirection });
        
        // Build query filter (only include supported roles)
        let queryFilter = {
          role: { $in: ['admin', 'assistant', 'developer'] }
        };
        
        if (searchTerm.trim()) {
          const search = searchTerm.trim();
          const isNumeric = /^\d+$/.test(search);
          
          if (isNumeric) {
            // If search term is numeric, search by ID (exact match)
            const assistantId = parseInt(search);
            if (!isNaN(assistantId)) {
              queryFilter.id = assistantId;
            }
          } else {
            // Non-numeric search = text search in name
            const searchRegex = new RegExp(search, 'i');
            queryFilter.name = searchRegex;
          }
        }
        
        console.log('🔍 Query filter:', JSON.stringify(queryFilter, null, 2));
        
        // Get total count for pagination
        const totalCount = await db.collection('users').countDocuments(queryFilter);
        const totalPages = Math.ceil(totalCount / pageSize);
        const skip = (currentPage - 1) * pageSize;
        
        console.log(`📊 Found ${totalCount} assistants matching filters`);
        console.log(`📄 Page ${currentPage} of ${totalPages} (${pageSize} per page)`);
        
        // Get assistants with pagination (exclude password field for security)
        const assistants = await db.collection('users')
          .find(queryFilter, { projection: { password: 0 } }) // Exclude password field
          .sort({ [sortField]: sortDirection })
          .skip(skip)
          .limit(pageSize)
          .toArray();
        
        console.log(`✅ Retrieved ${assistants.length} assistants for page ${currentPage}`);
        
        // Map assistants with default account_state and ATCA (password already excluded via projection)
        const mappedAssistants = assistants.map(assistant => ({
          ...assistant,
          account_state: assistant.account_state || "Activated", // Default to Activated
          ATCA: assistant.ATCA || "no" // Default to no
        }));
        
        res.json({
          data: mappedAssistants,
          pagination: {
            currentPage: currentPage,
            totalPages: totalPages,
            totalCount: totalCount,
            limit: pageSize,
            hasNextPage: currentPage < totalPages,
            hasPrevPage: currentPage > 1,
            nextPage: currentPage < totalPages ? currentPage + 1 : null,
            prevPage: currentPage > 1 ? currentPage - 1 : null
          },
          filters: {
            search: searchTerm,
            sortBy: sortField,
            sortOrder: sortOrder === 'desc' ? 'desc' : 'asc'
          }
        });
      } else {
        // Legacy: Get all assistants (for backward compatibility) - exclude password for security
        const assistants = await db.collection('users')
          .find(
            { role: { $in: ['admin', 'assistant', 'developer'] } },
            { projection: { password: 0 } }
          ) // Exclude password field
          .toArray();
        const mappedAssistants = assistants.map(assistant => ({
          ...assistant,
          account_state: assistant.account_state || "Activated", // Default to Activated
          ATCA: assistant.ATCA || "no" // Default to no
        }));
        res.json(mappedAssistants);
      }
    } else if (req.method === 'POST') {
      // Create new assistant
      const { id, name, phone, email, password, role, account_state, ATCA } = req.body;
      if (!id || !name || !phone || !password || !role) {
        return res.status(400).json({ error: 'All fields are required' });
      }
      
      // Validate email format if provided
      if (email && email.trim() !== '') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
          return res.status(400).json({ error: 'Invalid email format' });
        }
      }
      
      const exists = await db.collection('users').findOne({ id });
      if (exists) {
        return res.status(409).json({ error: 'Assistant ID already exists' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const assistantData = { 
        id, 
        name, 
        phone, 
        email: email && email.trim() !== '' ? email.trim() : '',
        password: hashedPassword, 
        role, 
        account_state: account_state || "Activated", 
        ATCA: ATCA || "no"
      };
      
      await db.collection('users').insertOne(assistantData);
      
      // Send welcome email to assistant/admin if email is provided and role is assistant or admin
      if (email && email.trim() !== '' && (role === 'assistant' || role === 'admin')) {
        try {
          const { sendWelcomeEmail } = await import('../lib/emailUtils');
          const assistantDriveLink = envConfig.ASSISTANT_DRIVE_LINK || process.env.ASSISTANT_DRIVE_LINK || '';
          await sendWelcomeEmail(email.trim(), name, role, assistantDriveLink);
          console.log('✅ Welcome email sent to assistant/admin:', email);
        } catch (emailError) {
          console.error('⚠️  Failed to send welcome email (non-critical):', emailError);
          // Don't fail the creation if email fails
        }
      }
      
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