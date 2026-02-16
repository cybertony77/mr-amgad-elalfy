import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
          value = value.replace(/^"|"$/g, '');
          envVars[key] = value;
        }
      }
    });
    
    return envVars;
  } catch (error) {
    console.log('Could not read env.config, using process.env as fallback');
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const envConfig = loadEnvConfig();

    const accountId = envConfig.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
    const accessKeyId = envConfig.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = envConfig.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = envConfig.R2_BUCKET_NAME || process.env.R2_BUCKET_NAME;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return res.status(500).json({ error: 'R2 configuration is missing' });
    }

    const { fileName, contentType } = req.body;

    if (!fileName || !contentType) {
      return res.status(400).json({ error: 'fileName and contentType are required' });
    }

    // Generate a unique key for the file
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 10);
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const key = `videos/${timestamp}_${randomStr}_${sanitizedName}`;

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true,
    });

    // AWS SDK v3.989+ automatically adds CRC32 checksum query params to presigned URLs.
    // The SDK computes the checksum for an empty body, but the browser sends the real file,
    // causing R2 to reject the upload with ERR_CONNECTION_ABORTED.
    // This middleware removes checksum params BEFORE signing, so the signature stays valid
    // and the final URL is clean.
    s3Client.middlewareStack.add(
      (next) => async (args) => {
        if (args.request?.query) {
          delete args.request.query['x-amz-checksum-crc32'];
          delete args.request.query['x-amz-sdk-checksum-algorithm'];
        }
        if (args.request?.headers) {
          delete args.request.headers['x-amz-checksum-crc32'];
          delete args.request.headers['x-amz-sdk-checksum-algorithm'];
        }
        return next(args);
      },
      {
        step: 'build',
        name: 'removeChecksumForR2',
        priority: 'low',
      }
    );

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    // Generate presigned URL valid for 1 hour
    const signedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    res.json({
      signedUrl,
      key,
    });
  } catch (error) {
    console.error('R2 signed URL error:', error);
    res.status(500).json({ error: 'Failed to generate signed URL', details: error.message });
  }
}
