import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';
import { faker } from '@faker-js/faker';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnvConfig() {
  try {
    const envPath = path.join(__dirname, '..', 'env.config');
    
    // Check if file exists
    if (!fs.existsSync(envPath)) {
      console.log(`⚠️  env.config not found at: ${envPath}`);
      console.log('   Using process.env as fallback');
      return {};
    }
    
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

    console.log('✅ Successfully loaded env.config');
    return envVars;
  } catch (error) {
    console.log('⚠️  Could not read env.config:', error.message);
    console.log('   Using process.env as fallback');
    return {};
  }
}

const envConfig = loadEnvConfig();
const MONGO_URI =
  envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/demo-attendance-system';
const DB_NAME =
  envConfig.DB_NAME || process.env.DB_NAME || 'demo-attendance-system';

if (!MONGO_URI) {
  throw new Error('❌ MONGO_URI not found in env.config');
}

console.log('🔗 Using Mongo URI:', MONGO_URI.replace(/\/\/.*@/, '//****@'));

function createWeeksArray() {
  // const weeks = [];
  // for (let i = 1; i <= 1; i++) {
  //   weeks.push({
  //     week: i,
  //     attended: false,
  //     lastAttendance: null,
  //     lastAttendanceCenter: null,
  //     hwDone: false,
  //     quizDegree: null,
  //     comment: null,
  //     message_state: false
  //   });
  // }
  // return weeks;
  return [];
}

async function ensureCollectionsExist(db) {
  console.log('🔍 Checking if collections exist...');
  
  // Get list of existing collections
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map(col => col.name);
  
  // Check and create students collection if it doesn't exist
  if (!collectionNames.includes('students')) {
    console.log('📚 Creating students collection...');
    await db.createCollection('students');
    console.log('✅ Students collection created');
  } else {
    console.log('✅ Students collection already exists');
  }
  
  // Check and create users collection if it doesn't exist
  if (!collectionNames.includes('users')) {
    console.log('👥 Creating users collection...');
    await db.createCollection('users');
    console.log('✅ Users collection created');
  } else {
    console.log('✅ Users collection already exists');
  }
  
  // Check and create history collection if it doesn't exist
  if (!collectionNames.includes('history')) {
    console.log('📖 Creating history collection...');
    await db.createCollection('history');
    console.log('✅ History collection created');
  } else {
    console.log('✅ History collection already exists');
  }
  
  // Check and create centers collection if it doesn't exist
  if (!collectionNames.includes('centers')) {
    console.log('🏢 Creating centers collection...');
    await db.createCollection('centers');
    console.log('✅ Centers collection created');
  } else {
    console.log('✅ Centers collection already exists');
  }

  // Check and create subscription collection if it doesn't exist
  if (!collectionNames.includes('subscription')) {
    console.log('🧾 Creating subscription collection...');
    await db.createCollection('subscription');
    console.log('✅ Subscription collection created');
  } else {
    console.log('✅ Subscription collection already exists');
  }

  // Check and create verification accounts codes collection if it doesn't exist
  if (!collectionNames.includes('VAC')) {
    console.log('🔐 Creating verification accounts codes collection...');
    await db.createCollection('VAC');
    console.log('✅ Verification accounts codes collection created');
  } else {
    console.log('✅ Verification accounts codes collection already exists');
  }

  // Check and create online sessions collection if it doesn't exist
  if (!collectionNames.includes('online_sessions')) {
    console.log('📹 Creating online sessions collection...');
    await db.createCollection('online_sessions');
    console.log('✅ Online sessions collection created');
  } else {
    console.log('✅ Online sessions collection already exists');
  }

  // Check and create verification video codes collection if it doesn't exist
  if (!collectionNames.includes('VVC')) {
    console.log('🎥 Creating verification video codes collection...');
    await db.createCollection('VVC');
    console.log('✅ Verification video codes collection created');
  } else {
    console.log('✅ Verification video codes collection already exists');
  }

  // Check and create verification homework codes collection if it doesn't exist
  if (!collectionNames.includes('VHC')) {
    console.log('📚 Creating verification homework codes collection...');
    await db.createCollection('VHC');
    console.log('✅ Verification homework codes collection created');
  } else {
    console.log('✅ Verification homework codes collection already exists');
  }

  // Check and create homeworks collection if it doesn't exist
  if (!collectionNames.includes('homeworks')) {
    console.log('📝 Creating homeworks collection...');
    await db.createCollection('homeworks');
    console.log('✅ Homeworks collection created');
  } else {
    console.log('✅ Homeworks collection already exists');
  }

  // Check and create quizzes collection if it doesn't exist
  if (!collectionNames.includes('quizzes')) {
    console.log('📊 Creating quizzes collection...');
    await db.createCollection('quizzes');
    console.log('✅ Quizzes collection created');
  } else {
    console.log('✅ Quizzes collection already exists');
  }

  // Check and create scoring_conditions collection if it doesn't exist
  if (!collectionNames.includes('scoring_system_conditions')) {
    console.log('📋 Creating scoring_system_conditions collection...');
    await db.createCollection('scoring_system_conditions');
    console.log('✅ Scoring system conditions collection created');
  } else {
    console.log('✅ Scoring system conditions collection already exists');
  }

  // Check and create homeworks_videos collection if it doesn't exist
  if (!collectionNames.includes('homeworks_videos')) {
    console.log('🎬 Creating homeworks_videos collection...');
    await db.createCollection('homeworks_videos');
    console.log('✅ Homeworks videos collection created');
  } else {
    console.log('✅ Homeworks videos collection already exists');
  }

  // Check and create join_whatsapp_group collection if it doesn't exist
  if (!collectionNames.includes('join_whatsapp_group')) {
    console.log('💬 Creating join_whatsapp_group collection...');
    await db.createCollection('join_whatsapp_group');
    console.log('✅ Join WhatsApp group collection created');
  } else {
    console.log('✅ Join WhatsApp group collection already exists');
  }
}

async function seedDatabase() {
  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Ensure collections exist before proceeding
    await ensureCollectionsExist(db);
    
    console.log('🗑️ Clearing existing data...');
    await db.collection('students').deleteMany({});
    await db.collection('users').deleteMany({});
    await db.collection('history').deleteMany({});
    await db.collection('centers').deleteMany({});
    await db.collection('subscription').deleteMany({});
    await db.collection('VAC').deleteMany({});
    await db.collection('online_sessions').deleteMany({});
    await db.collection('VVC').deleteMany({});
    await db.collection('VHC').deleteMany({});
    await db.collection('homeworks').deleteMany({});
    await db.collection('quizzes').deleteMany({});
    await db.collection('scoring_system_conditions').deleteMany({});
    await db.collection('homeworks_videos').deleteMany({});
    await db.collection('join_whatsapp_group').deleteMany({});
    
    console.log('✅ Database cleared');
    
    // Helper function to generate phone number in format 012 + 8 random digits
    const generatePhoneNumber = () => {
      const randomDigits = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
      return '012' + randomDigits;
    };

    // Helper function to generate VAC code (7 chars: 3 numbers, 2 uppercase, 2 lowercase)
    const generateVACCode = () => {
      const numbers = '0123456789';
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      
      // Generate 3 random numbers
      const numPart = Array.from({ length: 3 }, () => 
        numbers[Math.floor(Math.random() * numbers.length)]
      ).join('');
      
      // Generate 2 random uppercase letters
      const upperPart = Array.from({ length: 2 }, () => 
        uppercase[Math.floor(Math.random() * uppercase.length)]
      ).join('');
      
      // Generate 2 random lowercase letters
      const lowerPart = Array.from({ length: 2 }, () => 
        lowercase[Math.floor(Math.random() * lowercase.length)]
      ).join('');
      
      // Combine and shuffle to randomize order
      const code = (numPart + upperPart + lowerPart).split('');
      for (let i = code.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [code[i], code[j]] = [code[j], code[i]];
      }
      
      return code.join('');
    };

    // Helper function to generate VVC code (9 chars: 5 numbers, 2 uppercase, 2 lowercase)
    const generateVVCCode = () => {
      const numbers = '0123456789';
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      
      // Generate 5 random numbers
      const numPart = Array.from({ length: 5 }, () => 
        numbers[Math.floor(Math.random() * numbers.length)]
      ).join('');
      
      // Generate 2 random uppercase letters
      const upperPart = Array.from({ length: 2 }, () => 
        uppercase[Math.floor(Math.random() * uppercase.length)]
      ).join('');
      
      // Generate 2 random lowercase letters
      const lowerPart = Array.from({ length: 2 }, () => 
        lowercase[Math.floor(Math.random() * lowercase.length)]
      ).join('');
      
      // Combine and shuffle to randomize order
      const code = (numPart + upperPart + lowerPart).split('');
      for (let i = code.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [code[i], code[j]] = [code[j], code[i]];
      }
      
      return code.join('');
    };

    // Helper function to generate VHC code (9 chars: 5 numbers, 2 uppercase, 2 lowercase)
    const generateVHCCode = () => {
      const numbers = '0123456789';
      const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const lowercase = 'abcdefghijklmnopqrstuvwxyz';
      
      // Generate 5 random numbers
      const numPart = Array.from({ length: 5 }, () => 
        numbers[Math.floor(Math.random() * numbers.length)]
      ).join('');
      
      // Generate 2 random uppercase letters
      const upperPart = Array.from({ length: 2 }, () => 
        uppercase[Math.floor(Math.random() * uppercase.length)]
      ).join('');
      
      // Generate 2 random lowercase letters
      const lowerPart = Array.from({ length: 2 }, () => 
        lowercase[Math.floor(Math.random() * lowercase.length)]
      ).join('');
      
      // Combine and shuffle to randomize order
      const code = (numPart + upperPart + lowerPart).split('');
      for (let i = code.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [code[i], code[j]] = [code[j], code[i]];
      }
      
      return code.join('');
    };

    // Helper function to format date as MM/DD/YYYY at hour:minute AM/PM
    const formatDate = (date) => {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      
      let hours = date.getHours();
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      const hoursStr = String(hours).padStart(2, '0');
      
      return `${month}/${day}/${year} at ${hoursStr}:${minutes} ${ampm}`;
    };
    
    // Create users (assistants/admin/developer) with unique passwords
    const assistants = [
      {
        id: 'tony',
        name: 'Tony Joseph',
        phone: "201211172756",
        email: 'tony.joseph.business1717@gmail.com',
        role: 'developer',
        password: await bcrypt.hash('tony', 10),
        account_state: 'Activated'
      }
    ];
    
    console.log('👥 Creating users...');
    await db.collection('users').insertMany(assistants);
    console.log(`✅ Created ${assistants.length} users`);
    
    // Create centers collection with data from centers.js
    const centersData = [
      // { id: 1, name: 'Egypt Center', location: '', grades: [], createdAt: new Date() },
      // { id: 2, name: 'Kayan Center', location: '', grades: [], createdAt: new Date() },
      // { id: 3, name: 'Hany Pierre Center', location: '', grades: [], createdAt: new Date() },
      // { id: 4, name: 'Tabark Center', location: '', grades: [], createdAt: new Date() },
      // { id: 5, name: 'EAY Center', location: '', grades: [], createdAt: new Date() },
      // { id: 6, name: 'St. Mark Church', location: '', grades: [], createdAt: new Date() }
    ];
    
    console.log('🏢 Creating centers...');
    if (centersData.length > 0) {
      await db.collection('centers').insertMany(centersData);
      console.log(`✅ Created ${centersData.length} centers`);
    } else {
      console.log('✅ No centers to create (array is empty)');
    }
    
    const students = [];
    // const centers = [
    //   'Egypt Center',
    //   'Kayan Center', 
    //   'Hany Pierre Center',
    //   'Tabark Center',
    //   'EAY Center',
    //   'St. Mark Church'
    // ];
    // const grades = ['1st secondary', '2nd secondary', '3rd secondary'];
    
    // for (let i = 1; i <= 500; i++) {
    //   const center = centers[Math.floor(Math.random() * centers.length)];
    //   const weeks = createWeeksArray();
      
    //   students.push({
    //     id: i,
    //     name: faker.person.fullName(),
    //     age: Math.floor(Math.random() * 6) + 10,
    //     grade: grades[Math.floor(Math.random() * grades.length)],
    //     school: faker.company.name() + ' School',
    //     phone: generatePhoneNumber(),
    //     parentsPhone: generatePhoneNumber(),
    //     main_center: center,
    //     main_comment: null,
    //     account_state: 'Activated',
    //     weeks: weeks,
    //     online_sessions: [],
    //     online_homeworks: [],
    //     online_quizzes: [],
    //   });
    // }
    
    console.log('👨‍🎓 Creating students...');
    if (students.length > 0) {
      await db.collection('students').insertMany(students);
      console.log(`✅ Created ${students.length} students`);
    } else {
      console.log('✅ No students to create (array is empty)');
    }

    // Initialize subscription collection with default document
    console.log('🧾 Initializing subscription collection...');
    const subscriptionDoc = {
      subscription_duration: null,
      date_of_subscription: null,
      date_of_expiration: null,
      cost: null,
      note: null,
      active: false
    };
    await db.collection('subscription').insertOne(subscriptionDoc);
    console.log('✅ Subscription collection initialized with default document');

    // Create verification accounts codes collection
    console.log('🔐 Creating verification accounts codes...');
    const verificationCodes = [];
    // for (let account_id = 1; account_id <= 10; account_id++) {
    //   const code = generateVACCode();
    //   // Shuffle the code again for extra randomness
    //   const shuffledCode = code.split('').sort(() => Math.random() - 0.5).join('');
      
    //   verificationCodes.push({
    //     account_id: account_id,
    //     VAC: shuffledCode,
    //     VAC_activated: false
    //   });
    // }
    if (verificationCodes.length > 0) {
      await db.collection('VAC').insertMany(verificationCodes);
      console.log(`✅ Created ${verificationCodes.length} verification account codes`);
    } else {
      console.log('✅ No verification account codes to create (array is empty)');
    }

    // Create verification video codes collection
    console.log('🎥 Creating verification video codes...');
    const verificationVideoCodes = [];
    // for (let i = 1; i <= 10; i++) {
    //   const code = generateVVCCode();
    //   const currentDate = new Date();
    //   const formattedDate = formatDate(currentDate);
      
    //   verificationVideoCodes.push({
    //     VVC: code,
    //     number_of_views: Math.floor(Math.random() * 3) + 1, // Random 1-3
    //     viewed: false,
    //     viewed_by_who: null,
    //     code_state: 'Activated',
    //     payment_state: 'Not Paid',
    //     made_by_who: 'tony',
    //     date: formattedDate
    //   });
    // }
    if (verificationVideoCodes.length > 0) {
      await db.collection('VVC').insertMany(verificationVideoCodes);
      console.log(`✅ Created ${verificationVideoCodes.length} verification video codes`);
    } else {
      console.log('✅ No verification video codes to create (array is empty)');
    }

    // Create verification homework codes collection
    console.log('📚 Creating verification homework codes...');
    const verificationHomeworkCodes = [];
    // for (let i = 1; i <= 10; i++) {
    //   const code = generateVHCCode();
    //   const currentDate = new Date();
    //   const formattedDate = formatDate(currentDate);
      
    //   verificationHomeworkCodes.push({
    //     VHC: code,
    //     number_of_views: Math.floor(Math.random() * 3) + 1, // Random 1-3
    //     viewed: false,
    //     viewed_by_who: null,
    //     code_state: 'Activated',
    //     payment_state: 'Not Paid',
    //     made_by_who: 'tony',
    //     date: formattedDate
    //   });
    // }
    if (verificationHomeworkCodes.length > 0) {
      await db.collection('VHC').insertMany(verificationHomeworkCodes);
      console.log(`✅ Created ${verificationHomeworkCodes.length} verification homework codes`);
    } else {
      console.log('✅ No verification homework codes to create (array is empty)');
    }

    console.log('🎉 Database seeded successfully!');
    console.log('\n📊 Summary:');
    console.log(`- ${assistants.length} assistants created`);
    console.log(`- ${students.length} students created`);
    console.log(`- ${centersData.length} centers created`);
    console.log('- History collection cleared (no initial records)');
    console.log('- Subscription collection initialized with default document');
    console.log(`- ${verificationCodes.length} verification account codes created`);
    console.log(`- ${verificationVideoCodes.length} verification video codes created`);
    console.log(`- ${verificationHomeworkCodes.length} verification homework codes created`);
    console.log('- Online sessions collection cleared (no initial records)');
    console.log('- Homeworks collection cleared (no initial records)');
    console.log('- Quizzes collection cleared (no initial records)');
    console.log('- Scoring system conditions collection cleared (no initial records)');
    console.log('- Homeworks videos collection cleared (no initial records)');
    console.log('- Join WhatsApp group collection cleared (no initial records)');
    console.log('\n🔑 Demo Login Credentials:');
    console.log('Admin ID: admin, Password: admin');
    console.log('Tony ID: tony, Password: tony');
    console.log('Assistant 1 ID: assistant1, Password: assistant');
    console.log('Assistant 2 ID: assistant2, Password: assistant');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
  } finally {
    if (client) await client.close();
  }
}

seedDatabase();