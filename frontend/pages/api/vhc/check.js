import { MongoClient, ObjectId } from 'mongodb';
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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI;
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME;

// Format date as DD/MM/YYYY
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}/${month}/${year}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let client;
  try {
    // Verify authentication - allow students
    const user = await authMiddleware(req);
    if (!['student', 'admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const { VHC, session_id } = req.body;

    if (!VHC || VHC.length !== 9) {
      return res.status(400).json({ 
        success: false,
        error: '❌ Sorry, this code is incorrect',
        valid: false 
      });
    }

    if (!session_id) {
      return res.status(400).json({ 
        success: false,
        error: 'Session ID is required',
        valid: false 
      });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get student ID (for students, it's in assistant_id) - ensure it's a number
    const studentId = parseInt(user.assistant_id || user.id);

    // Find the VHC record (case-insensitive comparison)
    const vhcRecord = await db.collection('VHC').findOne({ 
      VHC: { $regex: new RegExp(`^${VHC}$`, 'i') }
    });

    if (!vhcRecord) {
      return res.status(200).json({ 
        success: false,
        error: '❌ Sorry, This code is incorrect',
        valid: false 
      });
    }

    // Check if code is deactivated
    if (vhcRecord.code_state === 'Deactivated') {
      return res.status(200).json({ 
        success: false,
        error: '❌ Sorry, This code is deactivated',
        valid: false 
      });
    }

    // Check deadline date if code_settings is 'deadline_date'
    const codeSettings = vhcRecord.code_settings || 'number_of_views'; // Default to number_of_views for backward compatibility
    if (codeSettings === 'deadline_date') {
      if (vhcRecord.deadline_date) {
        // Parse date in local timezone to avoid timezone shift
        let deadlineDate;
        if (typeof vhcRecord.deadline_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(vhcRecord.deadline_date)) {
          // If it's a string in YYYY-MM-DD format, parse it in local timezone
          const [year, month, day] = vhcRecord.deadline_date.split('-').map(Number);
          deadlineDate = new Date(year, month - 1, day);
        } else if (vhcRecord.deadline_date instanceof Date) {
          // If it's already a Date object, use it directly
          deadlineDate = new Date(vhcRecord.deadline_date);
        } else {
          // Try to parse as date string
          deadlineDate = new Date(vhcRecord.deadline_date);
        }
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        deadlineDate.setHours(0, 0, 0, 0);
        
        if (deadlineDate <= today) {
          return res.status(200).json({ 
            success: false,
            error: '❌ Sorry, This code is expired',
            valid: false 
          });
        }
      }
    } else {
      // Check if code is already used or invalid (for number_of_views)
      // Error if: viewed === true OR (viewed_by_who != null AND viewed_by_who != user id) OR number_of_views <= 0
      // Valid if: viewed === false AND (viewed_by_who === null OR viewed_by_who === user id) AND number_of_views > 0
      if (vhcRecord.viewed === true) {
        return res.status(200).json({ 
          success: false,
          error: '❌ Sorry, This code is already used',
          valid: false 
        });
      }

      if (vhcRecord.number_of_views <= 0) {
        return res.status(200).json({ 
          success: false,
          error: '❌ Sorry, This code is already used',
          valid: false 
        });
      }

      // Check if viewed_by_who is not null and not equal to user id
      if (vhcRecord.viewed_by_who !== null && vhcRecord.viewed_by_who !== studentId) {
        return res.status(200).json({ 
          success: false,
          error: '❌ Sorry, This code is already used',
          valid: false 
        });
      }
    }

    // Format date as DD/MM/YYYY at hour:minute AM/PM
    function formatDateWithTime(date) {
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

    // VHC is valid - update it
    // For deadline_date: don't set viewed/viewed_by_who, allow unlimited views
    // For number_of_views: set viewed/viewed_by_who, but don't decrement views here (decrement when video opens)
    const updateData = {};
    if (codeSettings === 'number_of_views') {
      updateData.viewed = true;
      updateData.viewed_by_who = studentId;
    }
    // For deadline_date, we don't set viewed/viewed_by_who to allow unlimited views until deadline
    
    const updateResult = await db.collection('VHC').updateOne(
      { _id: vhcRecord._id },
      Object.keys(updateData).length > 0 ? { $set: updateData } : { $set: {} }
    );

    if (updateResult.modifiedCount === 0) {
      return res.status(500).json({ 
        success: false,
        error: 'Failed to update VHC',
        valid: false 
      });
    }

    // Get student
    const student = await db.collection('students').findOne({ id: studentId });
    if (!student) {
      return res.status(404).json({ 
        success: false,
        error: 'Student not found',
        valid: false 
      });
    }

    // Get homework video session to get week
    const session = await db.collection('homeworks_videos').findOne({ _id: new ObjectId(session_id) });
    if (!session) {
      return res.status(404).json({ 
        success: false,
        error: 'Homework video session not found',
        valid: false 
      });
    }

    const week = session.week;
    if (week !== null && week !== undefined) {
      const weeks = student.weeks || [];
      // Find the week entry
      const weekIndex = weeks.findIndex(w => w && w.week === week);

      if (weekIndex !== -1) {
        // Update existing week - set view_homework_video=true
        await db.collection('students').updateOne(
          { id: studentId, 'weeks.week': week },
          {
            $set: {
              'weeks.$.view_homework_video': true
            }
          }
        );
      } else {
        // Week doesn't exist, create it with view_homework_video=true
        const newWeek = {
          week: week,
          attended: false,
          hwDone: false,
          view_homework_video: true,
          quizDegree: null,
          comment: null,
          message_state: false
        };
        await db.collection('students').updateOne(
          { id: studentId },
          { $push: { weeks: newWeek } }
        );
      }
    }

    // Get current VHC to return relevant data
    const updatedVhc = await db.collection('VHC').findOne({ _id: vhcRecord._id });

    return res.status(200).json({ 
      success: true,
      valid: true,
      message: 'VHC validated successfully',
      vhc_id: vhcRecord._id.toString(),
      code_settings: codeSettings,
      number_of_views: updatedVhc.number_of_views || null,
      deadline_date: updatedVhc.deadline_date || null
    });
  } catch (error) {
    console.error('❌ Error in VHC check API:', error);
    return res.status(500).json({ 
      success: false,
      error: 'Internal server error', 
      valid: false,
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}
