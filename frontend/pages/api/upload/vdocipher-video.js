import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';

function loadEnvConfig() {
  try {
    // Try multiple paths for env.config
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
    // Authenticate user - only admin, developer, or assistant can upload
    let user;
    try {
      user = await authMiddleware(req);
      if (!user || !['admin', 'developer', 'assistant'].includes(user.role)) {
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

    // Get video file as base64 string (from client FormData)
    const { file, filename, fileType } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'Video file is required' });
    }

    // Validate file type
    if (!fileType || !fileType.startsWith('video/')) {
      return res.status(400).json({ error: 'Invalid file type. Only video files are allowed.' });
    }

    // Extract base64 data (remove data:video/...;base64, prefix if present)
    const base64Data = file.includes(',') ? file.split(',')[1] : file;
    
    // Validate file size (500 MB max, base64 is ~33% larger)
    const base64Size = Buffer.from(base64Data, 'base64').length;
    const maxBase64Size = 500 * 1024 * 1024 * 1.4; // 500MB * 1.4 for base64 overhead
    if (base64Size > maxBase64Size) {
      return res.status(400).json({ error: 'Video file size must be less than 500 MB' });
    }

    // Convert base64 to buffer
    const videoBuffer = Buffer.from(base64Data, 'base64');

    // Step 1: Get upload credentials from VdoCipher
    // VdoCipher API: Use PUT method with title as query parameter
    // According to VdoCipher docs: PUT https://dev.vdocipher.com/api/videos?title=videotitle
    const vdocipherBaseUrl = 'https://dev.vdocipher.com';
    const videoTitle = encodeURIComponent(filename || `Video_${Date.now()}`);
    const videosEndpoint = `${vdocipherBaseUrl}/api/videos?title=${videoTitle}`;
    
    console.log('📤 Requesting upload credentials from VdoCipher at:', videosEndpoint);
    let credentialsResponse;
    try {
      credentialsResponse = await fetch(videosEndpoint, {
        method: 'PUT',
        headers: {
          'Authorization': `Apisecret ${VDOCIPHER_API_SECRET}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (fetchError) {
      console.error('❌ Error calling VdoCipher credentials API:', fetchError);
      return res.status(500).json({ 
        error: 'Failed to connect to VdoCipher API',
        details: fetchError.message 
      });
    }

    if (!credentialsResponse.ok) {
      let errorData;
      try {
        errorData = await credentialsResponse.text();
      } catch (e) {
        errorData = 'Unknown error';
      }
      console.error('❌ VdoCipher credentials API error:', {
        status: credentialsResponse.status,
        statusText: credentialsResponse.statusText,
        error: errorData
      });
      return res.status(credentialsResponse.status).json({ 
        error: `VdoCipher API error (${credentialsResponse.status}): ${credentialsResponse.statusText}`,
        details: errorData
      });
    }

    let credentialsData;
    try {
      credentialsData = await credentialsResponse.json();
    } catch (parseError) {
      console.error('❌ Error parsing VdoCipher credentials response:', parseError);
      return res.status(500).json({ 
        error: 'Invalid response from VdoCipher API',
        details: parseError.message 
      });
    }

    // Extract videoId from top level
    const videoId = credentialsData?.videoId || credentialsData?.id || credentialsData?.video?.id;
    
    // Extract upload credentials from clientPayload (VdoCipher's response structure)
    const clientPayload = credentialsData?.clientPayload || credentialsData?.upload;
    
    // Fallback: try to get uploadLink from various possible locations
    let uploadLink = clientPayload?.uploadLink || credentialsData?.uploadLink || credentialsData?.upload?.link;
    
    if (!videoId) {
      console.error('❌ videoId missing from VdoCipher response:', credentialsData);
      return res.status(500).json({ 
        error: 'Invalid response from VdoCipher - videoId missing',
        details: JSON.stringify(credentialsData, null, 2)
      });
    }

    if (!clientPayload && !uploadLink) {
      console.error('❌ uploadLink/clientPayload missing from VdoCipher response:', credentialsData);
      return res.status(500).json({ 
        error: 'Invalid response from VdoCipher - upload credentials missing',
        details: JSON.stringify(credentialsData, null, 2)
      });
    }

    // Step 2: Upload video to VdoCipher's S3 endpoint
    // VdoCipher uses S3 with policy-based authentication (POST with multipart/form-data)
    let uploadResponse;
    
    if (clientPayload && clientPayload.uploadLink && clientPayload.key) {
      // VdoCipher's S3 upload with policy-based authentication
      // Use multipart/form-data POST request to S3
      console.log('📤 Uploading video to S3:', clientPayload.uploadLink);
      
      // Construct multipart/form-data body manually for S3 POST upload
      const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
      const CRLF = '\r\n';
      
      let formDataBody = '';
      
      // Add all required fields
      const fields = [
        { name: 'key', value: clientPayload.key },
        { name: 'policy', value: clientPayload.policy },
        { name: 'x-amz-signature', value: clientPayload['x-amz-signature'] },
        { name: 'x-amz-algorithm', value: clientPayload['x-amz-algorithm'] },
        { name: 'x-amz-date', value: clientPayload['x-amz-date'] },
        { name: 'x-amz-credential', value: clientPayload['x-amz-credential'] },
        { name: 'success_action_status', value: '200' },
        { name: 'success_action_redirect', value: '' }
      ];
      
      fields.forEach(field => {
        formDataBody += `--${boundary}${CRLF}`;
        formDataBody += `Content-Disposition: form-data; name="${field.name}"${CRLF}`;
        formDataBody += `${CRLF}`;
        formDataBody += `${field.value}${CRLF}`;
      });
      
      // Add file field (must be last)
      formDataBody += `--${boundary}${CRLF}`;
      formDataBody += `Content-Disposition: form-data; name="file"; filename="${filename || 'video.mp4'}"${CRLF}`;
      formDataBody += `Content-Type: ${fileType || 'video/mp4'}${CRLF}`;
      formDataBody += `${CRLF}`;
      
      // Convert form data header to buffer and append file buffer
      const formDataHeader = Buffer.from(formDataBody, 'utf8');
      const formDataFooter = Buffer.from(`${CRLF}--${boundary}--${CRLF}`, 'utf8');
      const formDataBuffer = Buffer.concat([formDataHeader, videoBuffer, formDataFooter]);

      uploadResponse = await fetch(clientPayload.uploadLink, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': formDataBuffer.length.toString()
        },
        body: formDataBuffer
      });
    } else if (uploadLink) {
      // Fallback: Simple PUT upload (older API format)
      console.log('📤 Uploading video via PUT:', uploadLink);
      uploadResponse = await fetch(uploadLink, {
        method: 'PUT',
        headers: {
          'Content-Type': fileType || 'video/mp4',
          'Content-Length': videoBuffer.length.toString()
        },
        body: videoBuffer
      });
    } else {
      return res.status(500).json({ 
        error: 'Invalid upload credentials format from VdoCipher',
        details: 'Unable to determine upload method'
      });
    }

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.text();
      console.error('❌ VdoCipher upload error:', errorData);
      return res.status(uploadResponse.status).json({ 
        error: 'Failed to upload video to VdoCipher',
        details: errorData
      });
    }

    return res.status(200).json({ 
      success: true,
      video_id: videoId,
      message: 'Video uploaded successfully to VdoCipher'
    });

  } catch (error) {
    console.error('❌ Error in VdoCipher upload API:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      details: error.message 
    });
  }
}

// Configure body parser
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '700mb', // Allow up to 700MB for base64 encoded videos (500MB file + ~33% base64 overhead)
    },
  },
};

