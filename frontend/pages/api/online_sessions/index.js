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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI;
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME;
const JWT_SECRET = envConfig.JWT_SECRET || process.env.JWT_SECRET;

// Extract YouTube video ID from URL
function extractYouTubeId(url) {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

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
  let client;
  let db;

  try {
    // Validate environment variables
    if (!MONGO_URI || !DB_NAME || !JWT_SECRET) {
      console.error('❌ Missing environment variables');
      return res.status(500).json({ 
        error: 'Server configuration error', 
        details: 'Missing required environment variables'
      });
    }

    // Connect to MongoDB
    client = await MongoClient.connect(MONGO_URI);
    db = client.db(DB_NAME);

    // Authenticate user - only admin, developer, or assistant can access
    const user = await authMiddleware(req);
    if (!['admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    if (req.method === 'GET') {
      // Get all online sessions, sorted by week ascending, then date descending
      const sessions = await db.collection('online_sessions')
        .find({})
        .sort({ week: 1, date: -1 })
        .toArray();
      
      res.json({ sessions });

    } else if (req.method === 'POST') {
      // Create new online session
      const { name, video_urls, videos, description, week, grade, payment_state } = req.body;

      // Validate required fields
      if (!grade || !grade.trim()) {
        return res.status(400).json({ error: 'Grade is required' });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }

      // Validate payment_state
      if (!payment_state || (payment_state !== 'paid' && payment_state !== 'free')) {
        return res.status(400).json({ error: 'Video Payment State is required and must be "paid" or "free"' });
      }

      // Handle both old format (video_urls) and new format (videos array)
      // YouTube and R2 video types are supported
      let videoData = {};
      
      if (videos && Array.isArray(videos) && videos.length > 0) {
        // New format: videos array with video_type and video_id
        for (let index = 0; index < videos.length; index++) {
          const video = videos[index];
          if (video && video.video_type && video.video_id) {
            if (video.video_type === 'youtube') {
              videoData[`video_ID_${index + 1}`] = video.video_id;
              videoData[`video_type_${index + 1}`] = 'youtube';
              if (video.video_name && video.video_name.trim()) {
                videoData[`video_name_${index + 1}`] = video.video_name.trim();
              }
            } else if (video.video_type === 'r2') {
              videoData[`video_ID_${index + 1}`] = video.video_id;
              videoData[`video_type_${index + 1}`] = 'r2';
              if (video.video_name && video.video_name.trim()) {
                videoData[`video_name_${index + 1}`] = video.video_name.trim();
              }
            } else {
              return res.status(400).json({ error: `Invalid video type at position ${index + 1}. Only YouTube and R2 are supported.` });
            }
          } else if (video && video.video_id) {
            // If no video_type specified, assume YouTube and extract ID from URL if needed
            let videoId = video.video_id;
            // Check if it's a URL and extract ID
            if (videoId.includes('youtube.com') || videoId.includes('youtu.be')) {
              videoId = extractYouTubeId(videoId);
              if (!videoId) {
                return res.status(400).json({ error: `Invalid YouTube URL at position ${index + 1}` });
              }
            }
            videoData[`video_ID_${index + 1}`] = videoId;
            videoData[`video_type_${index + 1}`] = 'youtube';
            // Add video_name if provided
            if (video.video_name && video.video_name.trim()) {
              videoData[`video_name_${index + 1}`] = video.video_name.trim();
            }
          } else {
            return res.status(400).json({ error: `Invalid video data at position ${index + 1}` });
          }
        }
      } else if (video_urls && Array.isArray(video_urls) && video_urls.length > 0) {
        // Old format: video_urls array (YouTube only)
        for (let index = 0; index < video_urls.length; index++) {
          const url = video_urls[index];
          if (url && url.trim()) {
            const videoId = extractYouTubeId(url.trim());
            if (videoId) {
              videoData[`video_ID_${index + 1}`] = videoId;
              videoData[`video_type_${index + 1}`] = 'youtube';
            } else {
              return res.status(400).json({ error: `Invalid YouTube URL at position ${index + 1}` });
            }
          }
        }
      } else {
        return res.status(400).json({ error: 'At least one video is required' });
      }

      if (Object.keys(videoData).length === 0) {
        return res.status(400).json({ error: 'At least one valid video is required' });
      }

      // Create session document
      const session = {
        week: week !== undefined && week !== null ? parseInt(week) : null,
        grade: grade.trim(),
        payment_state: payment_state,
        name: name.trim(),
        ...videoData,
        description: description && description.trim() ? description.trim() : null,
        date: formatDate(new Date())
      };

      // Insert into database
      const result = await db.collection('online_sessions').insertOne(session);
      
      res.status(201).json({ 
        success: true, 
        session: { ...session, _id: result.insertedId }
      });

    } else if (req.method === 'PUT') {
      // Update online session
      const { id } = req.query;
      const { name, video_urls, videos, description, week, grade, payment_state } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      // Validate required fields
      if (!grade || !grade.trim()) {
        return res.status(400).json({ error: 'Grade is required' });
      }

      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name is required' });
      }

      // Validate payment_state
      if (!payment_state || (payment_state !== 'paid' && payment_state !== 'free')) {
        return res.status(400).json({ error: 'Video Payment State is required and must be "paid" or "free"' });
      }

      // Handle both old format (video_urls) and new format (videos array)
      // YouTube and R2 video types are supported
      let videoData = {};
      
      if (videos && Array.isArray(videos) && videos.length > 0) {
        // New format: videos array with video_type and video_id
        for (let index = 0; index < videos.length; index++) {
          const video = videos[index];
          if (video && video.video_type && video.video_id) {
            if (video.video_type === 'youtube') {
              videoData[`video_ID_${index + 1}`] = video.video_id;
              videoData[`video_type_${index + 1}`] = 'youtube';
              if (video.video_name && video.video_name.trim()) {
                videoData[`video_name_${index + 1}`] = video.video_name.trim();
              }
            } else if (video.video_type === 'r2') {
              videoData[`video_ID_${index + 1}`] = video.video_id;
              videoData[`video_type_${index + 1}`] = 'r2';
              if (video.video_name && video.video_name.trim()) {
                videoData[`video_name_${index + 1}`] = video.video_name.trim();
              }
            } else {
              return res.status(400).json({ error: `Invalid video type at position ${index + 1}. Only YouTube and R2 are supported.` });
            }
          } else if (video && video.video_id) {
            // If no video_type specified, assume YouTube and extract ID from URL if needed
            let videoId = video.video_id;
            // Check if it's a URL and extract ID
            if (videoId.includes('youtube.com') || videoId.includes('youtu.be')) {
              videoId = extractYouTubeId(videoId);
              if (!videoId) {
                return res.status(400).json({ error: `Invalid YouTube URL at position ${index + 1}` });
              }
            }
            videoData[`video_ID_${index + 1}`] = videoId;
            videoData[`video_type_${index + 1}`] = 'youtube';
            // Add video_name if provided
            if (video.video_name && video.video_name.trim()) {
              videoData[`video_name_${index + 1}`] = video.video_name.trim();
            }
          } else {
            return res.status(400).json({ error: `Invalid video data at position ${index + 1}` });
          }
        }
      } else if (video_urls && Array.isArray(video_urls) && video_urls.length > 0) {
        // Old format: video_urls array (YouTube only)
        for (let index = 0; index < video_urls.length; index++) {
          const url = video_urls[index];
          if (url && url.trim()) {
            const videoId = extractYouTubeId(url.trim());
            if (videoId) {
              videoData[`video_ID_${index + 1}`] = videoId;
              videoData[`video_type_${index + 1}`] = 'youtube';
            } else {
              return res.status(400).json({ error: `Invalid YouTube URL at position ${index + 1}` });
            }
          }
        }
      } else {
        return res.status(400).json({ error: 'At least one video is required' });
      }

      if (Object.keys(videoData).length === 0) {
        return res.status(400).json({ error: 'At least one valid video is required' });
      }

      // Get existing session to clean up old video fields
      const session = await db.collection('online_sessions').findOne({ _id: new ObjectId(id) });
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Update session document
      const updateData = {
        week: week !== undefined && week !== null ? parseInt(week) : null,
        grade: grade.trim(),
        payment_state: payment_state,
        name: name.trim(),
        ...videoData,
        description: description && description.trim() ? description.trim() : null,
        date: formatDate(new Date())
      };

      // Remove old video_ID, video_type, and video_name fields that are not in the new list
      const keysToRemove = Object.keys(session).filter(key => 
        (key.startsWith('video_ID_') || key.startsWith('video_type_') || key.startsWith('video_name_')) && 
        !videoData[key]
      );
      
      const updateQuery = { $set: updateData };
      if (keysToRemove.length > 0) {
        const unsetFields = {};
        keysToRemove.forEach(key => {
          unsetFields[key] = '';
        });
        updateQuery.$unset = unsetFields;
      }

      const result = await db.collection('online_sessions').updateOne(
        { _id: new ObjectId(id) },
        updateQuery
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({ success: true, message: 'Session updated successfully' });

    } else if (req.method === 'DELETE') {
      // Delete online session
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const result = await db.collection('online_sessions').deleteOne(
        { _id: new ObjectId(id) }
      );

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({ success: true, message: 'Session deleted successfully' });

    } else {
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      res.status(405).json({ error: 'Method not allowed' });
    }

  } catch (error) {
    console.error('❌ Error in online_sessions API:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

