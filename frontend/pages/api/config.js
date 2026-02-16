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
          value = value.replace(/^["']|["']$/g, ''); // strip quotes
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
    const withPhysicalCard = envConfig.WITH_PHISICAL_CARD === 'true';
    const devtoolsBlock = envConfig.DEVTOOLS_BLOCK === 'true';
    const systemSubscription = envConfig.SYSTEM_SUBSCRIPTION !== 'false'; // Default to true if not set
    
    res.json({
      WITH_PHISICAL_CARD: withPhysicalCard,
      DEVTOOLS_BLOCK: devtoolsBlock,
      SYSTEM_SUBSCRIPTION: systemSubscription,
      SYSTEM_NAME: envConfig.SYSTEM_NAME || 'Mr. Amgad El-Alfy Math Academy',
      STUDENT_SIGNUP_VIDEO: envConfig.STUDENT_SIGNUP_VIDEO || ''
    });
  } catch (error) {
    console.error('❌ Config API error:', error);
    res.status(500).json({ 
      error: 'Failed to load configuration', 
      details: error.message 
    });
  }
}
