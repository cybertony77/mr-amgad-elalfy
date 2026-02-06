const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// Load environment variables from env.config (same as your app)
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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'topphysics';

console.log('🔗 Using Mongo URI:', MONGO_URI);

async function resetWeeksArray() {
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    console.log('Starting to reset weeks array to [] for all students...');
    
    // Get all students
    const students = await db.collection('students').find({}).toArray();
    
    let processedCount = 0;
    let updatedCount = 0;
    
    // Loop through each student
    for (const student of students) {
      processedCount++;
      
      // Check if student has weeks array
      if (!student.weeks || !Array.isArray(student.weeks)) {
        console.log(`Student ${student.id} (${student.name}) - No weeks array found, skipping...`);
        continue;
      }
      
      const originalLength = student.weeks.length;
      
      // Reset weeks array to empty array
      const result = await db.collection('students').updateOne(
        { id: student.id },
        { $set: { weeks: [] } }
      );
      
      if (result.modifiedCount > 0) {
        updatedCount++;
        console.log(`Student ${student.id} (${student.name}) - Reset weeks array from ${originalLength} weeks to 0 weeks`);
      }
    }
    
    console.log(`\nOperation completed!`);
    console.log(`Total students processed: ${processedCount}`);
    console.log(`Students updated: ${updatedCount}`);
    
    // Verify the changes
    console.log('\nVerifying changes...');
    const sampleStudents = await db.collection('students').find({}, { 
      projection: { id: 1, name: 1, weeks: 1 } 
    }).limit(5).toArray();
    
    for (const student of sampleStudents) {
      const weeksLength = student.weeks ? student.weeks.length : 0;
      console.log(`Student ${student.id} (${student.name}) - Now has ${weeksLength} weeks`);
    }
    
  } catch (error) {
    console.error('❌ Error resetting weeks array:', error);
  } finally {
    if (client) await client.close();
  }
}

// Run the function
resetWeeksArray();
