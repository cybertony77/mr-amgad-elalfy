import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';

function loadEnvConfig() {
  try {
    // Try multiple paths for env.config
    // process.cwd() in Next.js API routes is typically the project root (frontend/)
    // env.config is in the parent directory (demo/)
    const possiblePaths = [
      path.join(process.cwd(), '..', 'env.config'), // From frontend/ -> demo/env.config
      path.join(process.cwd(), 'env.config'), // Current directory
      path.resolve(process.cwd(), '..', 'env.config'), // Resolved parent directory
    ];
    
    for (const envPath of possiblePaths) {
      try {
        if (fs.existsSync(envPath)) {
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
        }
      } catch (err) {
        // Try next path
        continue;
      }
    }
    
    // If env.config not found, log warning but don't fail
    return {};
  } catch (error) {
    console.log('⚠️  Error loading env.config:', error.message);
    return {};
  }
}

const envConfig = loadEnvConfig();
const VDOCIPHER_API_SECRET = envConfig.VDOCIPHER_API_SECRET || process.env.VDOCIPHER_API_SECRET;

// Log for debugging (remove in production)
if (!VDOCIPHER_API_SECRET) {
  console.warn('⚠️ VDOCIPHER_API_SECRET not found in env.config or process.env');
} else {
  console.log('✅ VDOCIPHER_API_SECRET loaded (length:', VDOCIPHER_API_SECRET.length + ')');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user (students can also view videos)
    let user;
    try {
      user = await authMiddleware(req);
      if (!user || !['student', 'admin', 'developer', 'assistant'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }
    } catch (authError) {
      console.error('❌ Auth error:', authError);
      return res.status(401).json({ error: 'Authentication failed', details: authError.message });
    }

    if (!VDOCIPHER_API_SECRET) {
      console.error('❌ VDOCIPHER_API_SECRET is not configured');
      return res.status(500).json({ error: 'VdoCipher API secret is not configured. Please check your env.config file.' });
    }

    const { video_id } = req.body;
    
    if (!video_id || typeof video_id !== 'string') {
      return res.status(400).json({ error: 'Video ID is required and must be a string' });
    }

    // Generate OTP using VdoCipher API
    // OTP should expire after video duration + buffer time
    // For now, set expiry to 24 hours (86400 seconds)
    const expiry = Math.floor(Date.now() / 1000) + 86400;

    // Generate OTP from VdoCipher API
    let otpResponse;
    try {
      otpResponse = await fetch('https://dev.vdocipher.com/api/videos/' + encodeURIComponent(video_id) + '/otp', {
        method: 'POST',
        headers: {
          'Authorization': `Apisecret ${VDOCIPHER_API_SECRET}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ttl: expiry,
          restrictReferrer: false
        })
      });
    } catch (fetchError) {
      console.error('❌ Error calling VdoCipher API:', fetchError);
      return res.status(500).json({ 
        error: 'Failed to connect to VdoCipher API',
        details: fetchError.message 
      });
    }

    if (!otpResponse.ok) {
      let errorData;
      try {
        errorData = await otpResponse.text();
      } catch (e) {
        errorData = 'Unknown error';
      }
      
      // Handle specific error cases
      let errorMessage;
      if (otpResponse.status === 404) {
        errorMessage = 'Video not found in VdoCipher. Please check if the video ID is correct or if the video has been deleted.';
      } else if (otpResponse.status === 403) {
        errorMessage = 'Access denied for this video. The video may be private or you do not have permission to access it.';
      } else if (otpResponse.status === 401) {
        errorMessage = 'Authentication failed. Please check your VdoCipher API credentials.';
      } else {
        errorMessage = `VdoCipher API error (${otpResponse.status}): ${otpResponse.statusText}`;
      }
      
      console.error('❌ VdoCipher OTP API error:', {
        status: otpResponse.status,
        statusText: otpResponse.statusText,
        error: errorData,
        video_id,
        errorMessage
      });
      
      return res.status(otpResponse.status).json({ 
        error: errorMessage,
        details: errorData,
        video_not_found: otpResponse.status === 404
      });
    }

    let otpData;
    try {
      otpData = await otpResponse.json();
    } catch (parseError) {
      console.error('❌ Error parsing VdoCipher response:', parseError);
      return res.status(500).json({ 
        error: 'Invalid response from VdoCipher API',
        details: parseError.message 
      });
    }

    const { otp, playbackInfo: returnedPlaybackInfo } = otpData || {};

    if (!otp || typeof otp !== 'string') {
      console.error('❌ Invalid OTP in response:', { hasOtp: !!otp, otpType: typeof otp, response: otpData });
      return res.status(500).json({ 
        error: 'Invalid response from VdoCipher - OTP not found or invalid',
        details: 'The OTP response is missing or not a valid string'
      });
    }

    // Construct playbackInfo according to VdoCipher v2 player format
    // VdoCipher OTP endpoint returns playbackInfo as a base64-encoded string
    // This base64 string should be used directly (not decoded) when passing to the player
    let finalPlaybackInfo;
    
    if (returnedPlaybackInfo) {
      // VdoCipher returns playbackInfo as base64-encoded JSON string
      // We should use it directly as-is (base64 format is what the player expects)
      if (typeof returnedPlaybackInfo === 'string') {
        // Check if it's already base64 (VdoCipher format) or plain JSON
        // Base64 strings typically don't start with '{' and contain base64 characters
        if (returnedPlaybackInfo.startsWith('eyJ') || /^[A-Za-z0-9+/=]+$/.test(returnedPlaybackInfo)) {
          // It's base64-encoded, use as-is
          finalPlaybackInfo = returnedPlaybackInfo;
        } else {
          // It's plain JSON string, encode it to base64
          finalPlaybackInfo = Buffer.from(returnedPlaybackInfo).toString('base64');
        }
      } else {
        // It's an object, stringify then encode to base64
        finalPlaybackInfo = Buffer.from(JSON.stringify(returnedPlaybackInfo)).toString('base64');
      }
    } else {
      // Construct playbackInfo: create JSON object, then encode to base64
      const playbackObj = {
        videoId: String(video_id).trim()
      };
      finalPlaybackInfo = Buffer.from(JSON.stringify(playbackObj)).toString('base64');
    }

    return res.status(200).json({ 
      success: true,
      otp: otp,
      playbackInfo: finalPlaybackInfo
    });

  } catch (error) {
    console.error('❌ Error in VdoCipher get-otp API:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message || 'An unexpected error occurred',
      type: error.name || 'UnknownError'
    });
  }
}

