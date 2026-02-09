import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';

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

// Configure Cloudinary
cloudinary.config({
  cloud_name: envConfig.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
  api_key: envConfig.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
  api_secret: envConfig.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
});

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB in bytes (original file size)
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Check if file is present
    if (!req.body || !req.body.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Parse the base64 file
    const { file, fileName, fileType } = req.body;
    
    // Validate file type
    if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType)) {
      return res.status(400).json({ 
        error: 'Invalid file type. Only image formats (JPEG/JPG, PNG, GIF, SVG, WEBP, ICO) are allowed.' 
      });
    }

    // Extract base64 data (remove data:image/...;base64, prefix if present)
    const base64Data = file.includes(',') ? file.split(',')[1] : file;
    
    // Validate file size (base64 is ~33% larger than original)
    // Account for base64 encoding overhead (~33% increase)
    const base64Size = Buffer.from(base64Data, 'base64').length;
    const maxBase64Size = MAX_FILE_SIZE * 1.4; // Allow 40% overhead for base64 encoding
    if (base64Size > maxBase64Size) {
      return res.status(400).json({ 
        error: 'Sorry, Max image size is 10 MB, Please try another picture' 
      });
    }

    // Upload to Cloudinary as private
    // Cloudinary accepts data URI format: data:[<mediatype>][;base64],<data>
    const uploadResult = await cloudinary.uploader.upload(file, {
      folder: 'homeworks-questions-images',
      resource_type: 'image',
      type: 'private', // Store as private
      overwrite: false,
      invalidate: true,
      timeout: 60000, // 60 second timeout for large files
    });

    // Return only the public_id
    res.status(200).json({ 
      success: true,
      public_id: uploadResult.public_id 
    });

  } catch (error) {
    console.error('Cloudinary upload error:', error);
    console.error('Error details:', {
      message: error.message,
      http_code: error.http_code,
      name: error.name,
      stack: error.stack
    });
    
    // Handle specific Cloudinary errors
    if (error.http_code === 400) {
      if (error.message && (error.message.includes('File size') || error.message.includes('size') || error.message.includes('too large'))) {
        return res.status(400).json({ error: 'Sorry, Max image size is 10 MB, Please try another picture' });
      }
      if (error.message && (error.message.includes('Invalid') || error.message.includes('format') || error.message.includes('unsupported'))) {
        return res.status(400).json({ error: 'Invalid file format. Only images are allowed.' });
      }
      return res.status(400).json({ error: error.message || 'Invalid image file. Please try another picture.' });
    }
    
    if (error.http_code === 401 || error.http_code === 403) {
      return res.status(500).json({ error: 'Cloudinary authentication error. Please contact support.' });
    }
    
    if (error.message && (error.message.includes('File size') || error.message.includes('size'))) {
      return res.status(400).json({ error: 'Sorry, Max image size is 10 MB, Please try another picture' });
    }
    
    if (error.message && (error.message.includes('Invalid') || error.message.includes('format'))) {
      return res.status(400).json({ error: 'Invalid file format. Only images are allowed.' });
    }
    
    // Return more detailed error message
    const errorMessage = error.message || 'Failed to upload image. Please try again.';
    res.status(500).json({ error: errorMessage });
  }
}

// Configure body parser
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb', // Allow up to 15MB for base64 encoded images (10MB file + ~33% base64 overhead)
    },
  },
};

