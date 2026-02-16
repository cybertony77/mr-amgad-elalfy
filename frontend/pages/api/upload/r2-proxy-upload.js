import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

export const config = {
  api: { bodyParser: false },
};

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

let cachedS3Client = null;
let cachedBucketName = null;

function getS3Client() {
  if (cachedS3Client) return { client: cachedS3Client, bucketName: cachedBucketName };

  const envConfig = loadEnvConfig();
  const accountId = envConfig.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = envConfig.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = envConfig.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = envConfig.R2_BUCKET_NAME || process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    throw new Error('R2 configuration is missing');
  }

  cachedS3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
  cachedBucketName = bucketName;

  return { client: cachedS3Client, bucketName: cachedBucketName };
}

function parseForm(req) {
  return new Promise((resolve, reject) => {
    const form = formidable({
      maxFileSize: 5 * 1024 * 1024 * 1024, // 5GB
    });
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { fields, files } = await parseForm(req);

    // formidable v3 wraps files in arrays
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Get the R2 key from the form fields
    const key = Array.isArray(fields.key) ? fields.key[0] : fields.key;
    if (!key) {
      return res.status(400).json({ error: 'key field is required' });
    }

    const { client, bucketName } = getS3Client();

    const buffer = fs.readFileSync(file.filepath);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: buffer,
      ContentType: file.mimetype || 'application/octet-stream',
    });

    await client.send(command);

    // Clean up the temp file
    fs.unlinkSync(file.filepath);

    res.json({ success: true, key });
  } catch (error) {
    console.error('R2 proxy upload error:', error);
    res.status(500).json({ error: 'Upload failed', details: error.message });
  }
}
