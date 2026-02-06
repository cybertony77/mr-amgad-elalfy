// Utility functions for Cloudinary signed URLs

/**
 * Generate a signed URL for a private Cloudinary image
 * @param {string} publicId - The Cloudinary public_id
 * @returns {string} - Signed URL for the image
 */
export function getSignedImageUrl(publicId) {
  if (!publicId) return null;
  
  // Load Cloudinary config from env.config
  const fs = require('fs');
  const path = require('path');
  
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
      return {};
    }
  }
  
  const envConfig = loadEnvConfig();
  const cloudName = envConfig.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME;
  const apiSecret = envConfig.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET;
  
  if (!cloudName || !apiSecret) {
    console.error('Cloudinary configuration missing');
    return null;
  }
  
  // Generate signature for signed URL (expires in 1 hour)
  const timestamp = Math.round(new Date().getTime() / 1000);
  const expiration = timestamp + 3600; // 1 hour from now
  
  // Create signature
  const crypto = require('crypto');
  const signature = crypto
    .createHash('sha1')
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest('hex');
  
  // Build signed URL
  const url = `https://res.cloudinary.com/${cloudName}/image/private/s--${signature}--/t_${timestamp}/${publicId}`;
  
  return url;
}

/**
 * Generate a signed URL for a private Cloudinary image (server-side)
 * This version uses the Cloudinary SDK for more reliable signing
 */
export async function getSignedImageUrlServer(publicId) {
  if (!publicId) return null;
  
  try {
    const { v2: cloudinary } = require('cloudinary');
    const fs = require('fs');
    const path = require('path');
    
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
        return {};
      }
    }
    
    const envConfig = loadEnvConfig();
    
    cloudinary.config({
      cloud_name: envConfig.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_CLOUD_NAME,
      api_key: envConfig.CLOUDINARY_API_KEY || process.env.CLOUDINARY_API_KEY,
      api_secret: envConfig.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_API_SECRET,
    });
    
    // First, try to verify the image exists (but don't fail if we can't verify)
    let imageExists = true;
    try {
      const resource = await cloudinary.api.resource(publicId, {
        type: 'private',
        resource_type: 'image'
      });
      console.log('✅ Image verified in Cloudinary:', { publicId, format: resource.format });
    } catch (apiError) {
      if (apiError.http_code === 404) {
        console.error('❌ Image not found in Cloudinary:', publicId);
        imageExists = false;
        // Don't return null yet - try to generate URL anyway in case it's a permission issue
      } else {
        console.warn('⚠️ Could not verify image (might be permission issue):', apiError.message);
        // Continue - might be a permission issue with api.resource but URL generation might work
      }
    }
    
    // Generate signed URL - use the same method as authenticated access
    // Cloudinary SDK automatically handles signing and versioning
    const url = cloudinary.url(publicId, {
      type: 'private',
      sign_url: true,
      expires_at: Math.round(new Date().getTime() / 1000) + 3600, // 1 hour
      secure: true,
      resource_type: 'image',
    });
    
    console.log('🔗 Generated Cloudinary URL:', { 
      publicId, 
      url,
      cloudName: cloudinary.config().cloud_name,
      imageExists,
      urlFormat: url.includes('/s--') ? 'signed' : 'unsigned'
    });
    
    // If we confirmed the image doesn't exist, return null
    if (!imageExists) {
      console.error('❌ Returning null - image confirmed not to exist in Cloudinary');
      return null;
    }
    
    return url;
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
}

