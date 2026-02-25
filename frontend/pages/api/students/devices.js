import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';

// Load environment variables from env.config
function loadEnvConfig() {
  try {
    const envPath = path.join(process.cwd(), '..', 'env.config');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};

    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          let value = trimmed.substring(index + 1).trim();
          value = value.replace(/^["']|["']$/g, '');
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
const MONGO_URI =
  envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-george-magdy';
const DEVICE_LIMITATIONS_ENABLED =
  envConfig.SYSTEM_DEVICE_LIMITATIONS === 'true' ||
  process.env.SYSTEM_DEVICE_LIMITATIONS === 'true';

// Format date as DD/MM/YYYY at HH:MM AM/PM
function formatDateTime(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');

  return `${day}/${month}/${year} at ${hoursStr}:${minutes} ${ampm}`;
}

export default async function handler(req, res) {
  let client;

  if (!DEVICE_LIMITATIONS_ENABLED) {
    return res.status(400).json({ error: 'device_limitations_disabled' });
  }

  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Authenticate user
    const user = await authMiddleware(req);
    if (!user || !['admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }

    if (req.method === 'GET') {
      const { page, limit, search } = req.query;

      const currentPage = parseInt(page, 10) || 1;
      const pageSize = parseInt(limit, 10) || 50;
      const searchTerm = search ? search.trim() : '';

      // If there is a search term, find matching student IDs from students collection
      let idFilter = null;
      if (searchTerm) {
        const isNumeric = /^\d+$/.test(searchTerm);
        const studentsFilter = {};

        if (isNumeric) {
          if (searchTerm.length <= 4) {
            const studentId = parseInt(searchTerm, 10);
            if (!Number.isNaN(studentId)) {
              studentsFilter.id = studentId;
            }
          } else {
            // Search by student phone
            const phoneRegex = new RegExp(searchTerm, 'i');
            studentsFilter.phone = phoneRegex;
          }
        } else {
          // Search by student name
          const nameRegex = new RegExp(searchTerm, 'i');
          studentsFilter.name = nameRegex;
        }

        const matchedStudents = await db
          .collection('students')
          .find(studentsFilter, { projection: { id: 1 } })
          .toArray();

        const matchedIds = matchedStudents.map((s) => s.id);
        if (matchedIds.length === 0) {
          return res.json({
            data: [],
            pagination: {
              currentPage,
              totalPages: 0,
              totalCount: 0,
              limit: pageSize,
              hasNextPage: false,
              hasPrevPage: false,
              nextPage: null,
              prevPage: null,
            },
          });
        }
        idFilter = { $in: matchedIds };
      }

      const usersFilter = {
        role: 'student',
      };
      if (idFilter) {
        usersFilter.id = idFilter;
      }

      const totalCount = await db.collection('users').countDocuments(usersFilter);
      const totalPages = Math.ceil(totalCount / pageSize);
      const skip = (currentPage - 1) * pageSize;

      const userDocs = await db
        .collection('users')
        .find(usersFilter, {
          projection: {
            id: 1,
            device_limitations: 1,
          },
        })
        .sort({ id: 1 })
        .skip(skip)
        .limit(pageSize)
        .toArray();

      const ids = userDocs.map((u) => u.id);
      const studentsDocs = await db
        .collection('students')
        .find(
          { id: { $in: ids } },
          {
            projection: {
              id: 1,
              name: 1,
              phone: 1,
            },
          }
        )
        .toArray();

      const studentMap = new Map();
      studentsDocs.forEach((s) => {
        studentMap.set(s.id, s);
      });

      const data = userDocs.map((u) => {
        const student = studentMap.get(u.id) || {};
        const limitations = u.device_limitations || {};

        let lastLogin = limitations.last_login || null;
        if (lastLogin instanceof Date) {
          lastLogin = formatDateTime(lastLogin);
        }

        const devicesArray = Array.isArray(limitations.devices) ? limitations.devices : [];
        const devices = devicesArray.map((d) => {
          let firstLogin = d.first_login || null;
          let deviceLastLogin = d.last_login || null;

          if (firstLogin instanceof Date) {
            firstLogin = formatDateTime(firstLogin);
          }
          if (deviceLastLogin instanceof Date) {
            deviceLastLogin = formatDateTime(deviceLastLogin);
          }

          return {
            device_id: d.device_id || 'unknown-device',
            ip: d.ip || 'unknown',
            browser: d.browser || 'Unknown',
            os: d.os || 'Unknown',
            device_type: d.device_type || 'desktop',
            first_login: firstLogin,
            last_login: deviceLastLogin,
          };
        });

        const allowedDevices =
          typeof limitations.allowed_devices === 'number' ? limitations.allowed_devices : 1;

        return {
          id: u.id,
          name: student.name || 'Unknown',
          phone: student.phone || '',
          allowed_devices: allowedDevices,
          last_login: lastLogin,
          devices,
        };
      });

      return res.json({
        data,
        pagination: {
          currentPage,
          totalPages,
          totalCount,
          limit: pageSize,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
          nextPage: currentPage < totalPages ? currentPage + 1 : null,
          prevPage: currentPage > 1 ? currentPage - 1 : null,
        },
      });
    }

    if (req.method === 'PATCH') {
      const { id, allowed_devices } = req.body;
      const numericId = parseInt(id, 10);
      const allowed = parseInt(allowed_devices, 10);

      if (!numericId || Number.isNaN(numericId)) {
        return res.status(400).json({ error: 'invalid_id' });
      }
      if (!Number.isFinite(allowed) || allowed <= 0) {
        return res.status(400).json({ error: 'invalid_allowed_devices' });
      }

      await db.collection('users').updateOne(
        { id: numericId, role: 'student' },
        {
          $set: {
            'device_limitations.allowed_devices': allowed,
          },
        }
      );

      return res.json({ success: true });
    }

    if (req.method === 'DELETE') {
      const { id, device_id } = req.query;
      const numericId = parseInt(id, 10);

      if (!numericId || Number.isNaN(numericId) || !device_id) {
        return res.status(400).json({ error: 'invalid_parameters' });
      }

      await db.collection('users').updateOne(
        { id: numericId, role: 'student' },
        {
          $pull: {
            'device_limitations.devices': { device_id },
          },
        }
      );

      return res.json({ success: true });
    }

    // Method not allowed
    res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in students/devices API:', error);
    return res.status(500).json({ error: 'internal_server_error' });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

