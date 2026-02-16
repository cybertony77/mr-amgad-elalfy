import { MongoClient } from 'mongodb';
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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-george-magdy';

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
    const { page, limit, search, sortBy, sortOrder, vac_activated } = req.query;
    const hasPagination = page || limit;

    if (hasPagination) {
      // Paginated response
      const currentPage = parseInt(page) || 1;
      const pageSize = parseInt(limit) || 100;
      const searchTerm = search ? search.trim() : '';
      const sortField = sortBy || 'account_id';
      const sortDirection = sortOrder === 'desc' ? -1 : 1;

      // Build query filter for VAC collection
      let vacQueryFilter = {};
      let accountIdsToSearch = null;

      // Apply VAC activated filter
      if (vac_activated === 'true') {
        vacQueryFilter.VAC_activated = true;
      } else if (vac_activated === 'false') {
        vacQueryFilter.$or = [
          { VAC_activated: false },
          { VAC_activated: { $exists: false } }
        ];
      }

      if (searchTerm.trim()) {
        const search = searchTerm.trim();
        const isNumeric = /^\d+$/.test(search);

        if (isNumeric) {
          // Numeric search = search by account_id
          const accountId = parseInt(search);
          if (!isNaN(accountId)) {
            vacQueryFilter.account_id = accountId;
          }
        } else {
          // Non-numeric search = search by student name first, then get account_ids
          const nameSearchRegex = new RegExp(search, 'i');
          const studentsByName = await db.collection('students')
            .find({ name: nameSearchRegex })
            .project({ id: 1 })
            .toArray();
          
          accountIdsToSearch = studentsByName.map(s => s.id);
          
          if (accountIdsToSearch.length > 0) {
            vacQueryFilter.account_id = { $in: accountIdsToSearch };
          } else {
            // No students found with this name, return empty result
            return res.status(200).json({
              data: [],
              pagination: {
                currentPage,
                totalPages: 0,
                totalCount: 0,
                hasNextPage: false,
                hasPrevPage: false
              }
            });
          }
        }
      }

      // Get total count for pagination
      const totalCount = await db.collection('VAC').countDocuments(vacQueryFilter);
      const totalPages = Math.ceil(totalCount / pageSize);
      const skip = (currentPage - 1) * pageSize;

      // Get VAC records with pagination
      const vacRecords = await db.collection('VAC')
        .find(vacQueryFilter)
        .sort({ [sortField]: sortDirection })
        .skip(skip)
        .limit(pageSize)
        .toArray();

      // Get student names and phone numbers for each account_id
      const accountIds = vacRecords.map(vac => vac.account_id);
      const students = await db.collection('students')
        .find({ id: { $in: accountIds } })
        .project({ id: 1, name: 1, phone: 1, parentsPhone: 1 })
        .toArray();

      // Create a map of account_id to student data
      const studentMap = {};
      students.forEach(student => {
        studentMap[student.id] = {
          name: student.name,
          phone: student.phone || null,
          parents_phone: student.parentsPhone || null
        };
      });

      // Map VAC records with student names and phone numbers
      const mappedVACs = vacRecords.map(vac => ({
        account_id: vac.account_id,
        VAC: vac.VAC,
        VAC_activated: vac.VAC_activated || false,
        name: studentMap[vac.account_id]?.name || null,
        phone: studentMap[vac.account_id]?.phone || null,
        parents_phone: studentMap[vac.account_id]?.parents_phone || null
      }));

      return res.status(200).json({
        data: mappedVACs,
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
      const vacRecords = await db.collection('VAC').find({}).toArray();
      return res.status(200).json({ data: vacRecords });
    } catch (error) {
      console.error('VAC API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      if (client) await client.close();
    }
  } else if (req.method === 'DELETE') {
    // Delete VAC
    let client;
    try {
      // Verify authentication
      const user = await authMiddleware(req);
      
      // Check if user has required role (admin, developer, or assistant)
      if (!['admin', 'developer', 'assistant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }

      const { account_id } = req.query;

      if (!account_id) {
        return res.status(400).json({ error: 'account_id is required' });
      }

      const accountIdNum = parseInt(account_id);
      if (isNaN(accountIdNum)) {
        return res.status(400).json({ error: 'Invalid account_id' });
      }

      client = await MongoClient.connect(MONGO_URI);
      const db = client.db(DB_NAME);

      const result = await db.collection('VAC').deleteOne({ account_id: accountIdNum });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'VAC record not found' });
      }

      return res.status(200).json({
        success: true,
        message: 'VAC deleted successfully'
      });
    } catch (error) {
      console.error('VAC API error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    } finally {
      if (client) await client.close();
    }
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

