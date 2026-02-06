const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Load environment variables from env.config
function loadEnvConfig() {
  try {
    const envPath = path.join(__dirname, '..', 'env.config');
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
const MONGO_URI =
  envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/demo-attendance-system';
const DB_NAME =
  envConfig.DB_NAME || process.env.DB_NAME || 'demo-attendance-system';

console.log('🔗 Using Mongo URI:', MONGO_URI);

async function seedSubscription() {
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    console.log('🗑️ Clearing existing subscription data...');
    await db.collection('subscription').deleteMany({});
    
    console.log('✅ Subscription collection cleared');
    
    // Create initial subscription document with default values
    const subscription = {
      subscription_duration: null,
      date_of_subscription: null,
      date_of_expiration: null,
      cost: null,
      note: null,
      active: false
    };
    
    console.log('📝 Creating subscription document...');
    await db.collection('subscription').insertOne(subscription);
    console.log('✅ Subscription document created with default values');
    
    console.log('🎉 Subscription database seeded successfully!');
    console.log('\n📊 Subscription State:');
    console.log('- Active: false');
    console.log('- All fields set to null');
    console.log('- Ready for subscription creation');
    
  } catch (error) {
    console.error('❌ Error seeding subscription database:', error);
  } finally {
    if (client) await client.close();
  }
}

seedSubscription();
