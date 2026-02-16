import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../lib/authMiddleware';

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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI;
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME;

// Helper function to generate VHC code (9 chars: 5 numbers, 2 uppercase, 2 lowercase)
const generateVHCCode = () => {
  const numbers = '123456789';
  const uppercase = 'ABDEFGHJKMNPQRTUVWXYZ';
  const lowercase = 'abdefghjkmnpqrtuvwxyz';
  
  // Generate 5 random numbers
  const numPart = Array.from({ length: 5 }, () => 
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

// Format date as MM/DD/YYYY at hour:minute AM/PM
function formatDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();
  
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursStr = String(hours).padStart(2, '0');
  
  return `${month}/${day}/${year} at ${hoursStr}:${minutes} ${ampm}`;
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    let client;
    try {
      // Verify authentication
      const user = await authMiddleware(req);
      
      // Check if user has required role (admin, developer, or assistant)
      if (!['admin', 'developer', 'assistant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }

      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);

      // Check if pagination parameters are provided
      const { page, limit, search, sortBy, sortOrder, viewed, code_state, payment_state } = req.query;
      const hasPagination = page || limit;

      if (hasPagination) {
        // Paginated response
        const currentPage = parseInt(page) || 1;
        const pageSize = parseInt(limit) || 100;
        const searchTerm = search ? search.trim() : '';
        const sortField = sortBy || 'date';
        const sortDirection = sortOrder === 'desc' ? -1 : 1;

        // Build query filter for VHC collection
        let vhcQueryFilter = {};

        // Search: VHC code starts with OR made_by_who contains
        if (searchTerm.trim()) {
          const search = searchTerm.trim();
          vhcQueryFilter.$or = [
            { VHC: { $regex: `^${search}`, $options: 'i' } }, // VHC code starts with
            { made_by_who: { $regex: search, $options: 'i' } } // made_by_who contains
          ];
        }

        // Filter: viewed
        if (viewed !== undefined && viewed !== '') {
          const viewedValue = viewed === 'true';
          vhcQueryFilter.viewed = viewedValue;
        }

        // Filter: code_state
        if (code_state && code_state !== '') {
          vhcQueryFilter.code_state = code_state;
        }

        // Filter: payment_state
        if (payment_state && payment_state !== '') {
          vhcQueryFilter.payment_state = payment_state;
        }

        // Get total count for pagination
        const totalCount = await db.collection('VHC').countDocuments(vhcQueryFilter);
        const totalPages = Math.ceil(totalCount / pageSize);
        const skip = (currentPage - 1) * pageSize;

        // Get VHC records with pagination
        const vhcRecords = await db.collection('VHC')
          .find(vhcQueryFilter)
          .sort({ [sortField]: sortDirection })
          .skip(skip)
          .limit(pageSize)
          .toArray();

        // Normalize deadline_date to string format (YYYY-MM-DD) if it's a Date object
        const normalizedRecords = vhcRecords.map(record => {
          if (record.deadline_date) {
            if (record.deadline_date instanceof Date) {
              // Convert Date object to YYYY-MM-DD string in local timezone
              const year = record.deadline_date.getFullYear();
              const month = String(record.deadline_date.getMonth() + 1).padStart(2, '0');
              const day = String(record.deadline_date.getDate()).padStart(2, '0');
              record.deadline_date = `${year}-${month}-${day}`;
            } else if (typeof record.deadline_date === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(record.deadline_date)) {
              // If it's a string but not in YYYY-MM-DD format, try to parse and normalize
              try {
                const date = new Date(record.deadline_date);
                if (!isNaN(date.getTime())) {
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  record.deadline_date = `${year}-${month}-${day}`;
                }
              } catch (e) {
                // If parsing fails, keep original value
              }
            }
          }
          return record;
        });

        return res.status(200).json({
          data: normalizedRecords,
          pagination: {
            currentPage,
            totalPages,
            totalCount,
            hasNextPage: currentPage < totalPages,
            hasPrevPage: currentPage > 1
          }
        });
      }

      // Non-paginated response (for backward compatibility)
      const vhcRecords = await db.collection('VHC').find({}).toArray();
      
      // Normalize deadline_date to string format (YYYY-MM-DD) if it's a Date object
      const normalizedRecords = vhcRecords.map(record => {
        if (record.deadline_date) {
          if (record.deadline_date instanceof Date) {
            // Convert Date object to YYYY-MM-DD string in local timezone
            const year = record.deadline_date.getFullYear();
            const month = String(record.deadline_date.getMonth() + 1).padStart(2, '0');
            const day = String(record.deadline_date.getDate()).padStart(2, '0');
            record.deadline_date = `${year}-${month}-${day}`;
          } else if (typeof record.deadline_date === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(record.deadline_date)) {
            // If it's a string but not in YYYY-MM-DD format, try to parse and normalize
            try {
              const date = new Date(record.deadline_date);
              if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                record.deadline_date = `${year}-${month}-${day}`;
              }
            } catch (e) {
              // If parsing fails, keep original value
            }
          }
        }
        return record;
      });
      
      return res.status(200).json({ data: normalizedRecords });
    } catch (error) {
      console.error('VHC API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      if (client) await client.close();
    }
  } else if (req.method === 'POST') {
    // Create new VHC
    let client;
    try {
      // Verify authentication
      const user = await authMiddleware(req);
      
      // Check if user has required role (admin, developer, or assistant)
      if (!['admin', 'developer', 'assistant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }

      const { number_of_codes, code_settings, number_of_views, deadline_date, code_state } = req.body;

      // Validation
      const codesCount = number_of_codes ? parseInt(number_of_codes) : 1;
      if (codesCount < 1 || codesCount > 50) {
        return res.status(400).json({ error: 'Number of codes must be between 1 and 50' });
      }

      if (!code_settings || !['number_of_views', 'deadline_date'].includes(code_settings)) {
        return res.status(400).json({ error: 'Code settings must be number_of_views or deadline_date' });
      }

      if (code_settings === 'number_of_views') {
        if (!number_of_views || number_of_views < 1) {
          return res.status(400).json({ error: 'Number of views must be at least 1' });
        }
      } else if (code_settings === 'deadline_date') {
        if (!deadline_date) {
          return res.status(400).json({ error: 'Deadline date is required' });
        }
        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline_date)) {
          return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
        }
        // Parse date in local timezone to avoid timezone shift
        const [year, month, day] = deadline_date.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate <= today) {
          return res.status(400).json({ error: 'Deadline date must be in the future' });
        }
      }

      if (!code_state || !['Activated', 'Deactivated'].includes(code_state)) {
        return res.status(400).json({ error: 'Code state must be Activated or Deactivated' });
      }

      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);

      const currentDate = new Date();
      const formattedDate = formatDate(currentDate);
      const madeByWho = user.assistant_id || user.id || 'unknown';

      // Generate multiple VHC codes
      const newVHCs = [];
      for (let i = 0; i < codesCount; i++) {
        const code = generateVHCCode();
        const vhcData = {
          VHC: code,
          code_settings: code_settings,
          viewed: false,
          viewed_by_who: null,
          code_state: code_state,
          payment_state: 'Not Paid',
          made_by_who: madeByWho,
          date: formattedDate
        };
        
        if (code_settings === 'number_of_views') {
          vhcData.number_of_views = parseInt(number_of_views);
        } else if (code_settings === 'deadline_date') {
          // Ensure date is stored as string in YYYY-MM-DD format
          vhcData.deadline_date = String(deadline_date).trim();
        }
        
        newVHCs.push(vhcData);
      }

      const result = await db.collection('VHC').insertMany(newVHCs);

      return res.status(201).json({
        success: true,
        message: `${codesCount} VHC code(s) created successfully`,
        data: newVHCs.map((vhc, index) => ({ ...vhc, _id: result.insertedIds[index] }))
      });
    } catch (error) {
      console.error('Create VHC error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      if (client) await client.close();
    }
  } else if (req.method === 'PUT') {
    // Update VHC
    let client;
    try {
      // Verify authentication
      const user = await authMiddleware(req);
      
      // Check if user has required role (admin, developer, or assistant)
      if (!['admin', 'developer', 'assistant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }

      const { id } = req.query;
      const { code_settings, number_of_views, deadline_date, code_state, payment_state } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'VHC ID is required' });
      }

      // Validation
      if (code_settings && !['number_of_views', 'deadline_date'].includes(code_settings)) {
        return res.status(400).json({ error: 'Code settings must be number_of_views or deadline_date' });
      }

      if (code_settings === 'number_of_views' && number_of_views !== undefined) {
        if (number_of_views < 1) {
          return res.status(400).json({ error: 'Number of views must be at least 1' });
        }
      }

      if (code_settings === 'deadline_date' && deadline_date !== undefined) {
        if (!deadline_date) {
          return res.status(400).json({ error: 'Deadline date is required' });
        }
        // Validate date format (YYYY-MM-DD)
        if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline_date)) {
          return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
        }
        // Parse date in local timezone to avoid timezone shift
        const [year, month, day] = deadline_date.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate <= today) {
          return res.status(400).json({ error: 'Deadline date must be in the future' });
        }
      }

      if (code_state && !['Activated', 'Deactivated'].includes(code_state)) {
        return res.status(400).json({ error: 'Code state must be Activated or Deactivated' });
      }

      if (payment_state && !['Paid', 'Not Paid'].includes(payment_state)) {
        return res.status(400).json({ error: 'Payment state must be Paid or Not Paid' });
      }

      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);

      // Build update object
      const update = {};
      if (code_settings !== undefined) {
        update.code_settings = code_settings;
        // Clear the other field when switching settings
        if (code_settings === 'number_of_views') {
          update.deadline_date = null;
        } else if (code_settings === 'deadline_date') {
          update.number_of_views = null;
        }
      }
      if (number_of_views !== undefined && code_settings === 'number_of_views') {
        update.number_of_views = parseInt(number_of_views);
      }
      if (deadline_date !== undefined && code_settings === 'deadline_date') {
        // Ensure date is stored as string in YYYY-MM-DD format
        update.deadline_date = String(deadline_date).trim();
      }
      if (code_state !== undefined) {
        update.code_state = code_state;
      }
      if (payment_state !== undefined) {
        update.payment_state = payment_state;
      }

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      // Update VHC record
      const result = await db.collection('VHC').updateOne(
        { _id: new ObjectId(id) },
        { $set: update }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'VHC record not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'VHC updated successfully'
      });
    } catch (error) {
      console.error('Update VHC error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      if (client) await client.close();
    }
  } else if (req.method === 'DELETE') {
    // Delete VHC
    let client;
    try {
      // Verify authentication
      const user = await authMiddleware(req);
      
      // Check if user has required role (admin, developer, or assistant)
      if (!['admin', 'developer', 'assistant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }

      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'VHC ID is required' });
      }

      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);

      // Delete VHC record
      const result = await db.collection('VHC').deleteOne({ _id: new ObjectId(id) });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'VHC record not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'VHC deleted successfully'
      });
    } catch (error) {
      console.error('Delete VHC error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      if (client) await client.close();
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}
