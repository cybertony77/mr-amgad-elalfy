import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function ensureCollectionExists(db) {
  console.log('🔍 Checking if scoring_system_conditions collection exists...');
  
  // Get list of existing collections
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(col => col.name);
  
  // Check and create scoring_system_conditions collection if it doesn't exist
  if (!collectionNames.includes('scoring_system_conditions')) {
    console.log('📋 Creating scoring_system_conditions collection...');
    await db.createCollection('scoring_system_conditions');
    console.log('✅ Scoring system conditions collection created');
  } else {
    console.log('✅ Scoring system conditions collection already exists');
  }
}

async function seedScoringSystem() {
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Ensure collection exists
    await ensureCollectionExists(db);
    
    // Check if conditions already exist
    const existing = await db.collection('scoring_system_conditions').find({}).toArray();
    if (existing.length > 0) {
      console.log('🗑️  Clearing existing scoring system conditions...');
      await db.collection('scoring_system_conditions').deleteMany({});
      console.log('✅ Existing conditions cleared');
    }
    
    // Insert scoring system conditions
    const conditions = [
      {
        type: "attendance",
        rules: [
          { key: "attend", points: 10 },
          { key: "absent", points: -5 }
        ]
      },
      {
        type: "homework",
        withDegree: true,
        rules: [
          { min: 100, max: 100, points: 20 },
          { min: 75, max: 99, points: 15 },
          { min: 50, max: 74, points: 10 },
          { min: 1, max: 49, points: 5 },
          { min: 0, max: 0, points: -20 }
        ],
        bonusRules: [
          {
            key: "four_100_hw_streak",
            condition: {
              lastN: 4,
              percentage: 100
            },
            points: 25
          }
        ]
      },
      {
        type: "homework",
        withDegree: false,
        rules: [
          { hwDone: true, points: 20 },
          { hwDone: "Not Completed", points: 10 },
          { hwDone: false, points: -20 }
        ]
      },
      {
        _id: "quiz",
        type: "quiz",
        rules: [
          { min: 100, max: 100, points: 25 },
          { min: 75, max: 99, points: 20 },
          { min: 50, max: 74, points: 15 },
          { min: 20, max: 49, points: 10 },
          { min: 1, max: 19, points: 5 },
          { min: 0, max: 0, points: -25 }
        ],
        bonusRules: [
          {
            key: "four_100_streak",
            condition: {
              lastN: 4,
              percentage: 100
            },
            points: 30
          }
        ]
      }
    ];

    console.log('📝 Inserting scoring system conditions...');
    await db.collection('scoring_system_conditions').insertMany(conditions);
    console.log(`✅ Successfully inserted ${conditions.length} scoring system conditions`);

    console.log('\n🎉 Scoring system seeded successfully!');
    console.log('\n📊 Summary:');
    console.log('- Attendance rules: attend (+10), late (+5), absent (-5)');
    console.log('- Homework with degree: 100% (+20), 75-99% (+15), 50-74% (+10), 1-49% (+5), 0% (-20)');
    console.log('- Homework without degree: done (+20), not completed (+10), not done (-20)');
    console.log('- Quiz: 100% (+25), 75-99% (+20), 50-74% (+15), 20-49% (+10), 1-19% (+5), 0% (-25)');
    console.log('- Bonus: 4 consecutive 100% homework scores (+25 points)');
    console.log('- Bonus: 4 consecutive 100% quiz scores (+30 points)');
    
  } catch (error) {
    console.error('❌ Error seeding scoring system:', error);
    throw error;
  } finally {
    if (client) await client.close();
  }
}

seedScoringSystem();
