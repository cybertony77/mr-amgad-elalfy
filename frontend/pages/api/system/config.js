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
    console.log('⚠️  Could not read env.config, using process.env as fallback');
    return {};
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const envConfig = loadEnvConfig();
    const systemDomain = envConfig.SYSTEM_DOMAIN || process.env.SYSTEM_DOMAIN || '';
    const systemName = envConfig.SYSTEM_NAME || process.env.SYSTEM_NAME || 'Demo Attendance System';
    const scoringSystem = envConfig.SYSTEM_SCORING_SYSTEM === 'true' || process.env.SYSTEM_SCORING_SYSTEM === 'true';
    const whatsappJoinGroupBtn = envConfig.SYSTEM_WHATSAPP_JOIN_GROUP === 'true' || process.env.SYSTEM_WHATSAPP_JOIN_GROUP === 'true';
    const onlineVideos = envConfig.SYSTEM_ONLINE_VIDEOS === 'true' || process.env.SYSTEM_ONLINE_VIDEOS === 'true';
    const homeworksVideos = envConfig.SYSTEM_HOMEWORKS_VIDEOS === 'true' || process.env.SYSTEM_HOMEWORKS_VIDEOS === 'true';
    const homeworks = envConfig.SYSTEM_HOMEWORKS === 'true' || process.env.SYSTEM_HOMEWORKS === 'true';
    const quizzes = envConfig.SYSTEM_QUIZZES === 'true' || process.env.SYSTEM_QUIZZES === 'true';
    const cloudflareR2 = envConfig.SYSTEM_CLOUDFLARE_R2 === 'true' || process.env.SYSTEM_CLOUDFLARE_R2 === 'true';
    const subscription = envConfig.SYSTEM_SUBSCRIPTION !== 'false'; // Default to true if not set
    
    res.json({ 
      domain: systemDomain,
      name: systemName,
      scoring_system: scoringSystem,
      whatsapp_join_group_btn: whatsappJoinGroupBtn,
      online_videos: onlineVideos,
      homeworks_videos: homeworksVideos,
      homeworks: homeworks,
      quizzes: quizzes,
      cloudflare_r2: cloudflareR2,
      subscription: subscription
    });
  } catch (error) {
    console.error('Error fetching system config:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
