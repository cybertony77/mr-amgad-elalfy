import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../lib/authMiddleware';

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

const envConfig = loadEnvConfig();
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI;
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME;

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  let client;
  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Verify authentication - only admins, assistants, and developers can view analytics
    const user = await authMiddleware(req);
    if (!['admin', 'assistant', 'developer'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    // Get homework by ID
    let homework;
    try {
      homework = await db.collection('homeworks').findOne({ _id: new ObjectId(id) });
    } catch (e) {
      return res.status(404).json({ error: 'Homework not found' });
    }
    
    if (!homework) {
      return res.status(404).json({ error: 'Homework not found' });
    }

    // Get homework grade
    const homeworkGrade = homework.grade;
    if (!homeworkGrade) {
      return res.json({
        success: true,
        analytics: {
          notAnswered: 0,
          lessThan50: 0,
          between50And100: 0,
          exactly100: 0,
          totalStudents: 0
        }
      });
    }

    // Normalize grade for comparison
    const normalizedHomeworkGrade = homeworkGrade.toLowerCase().replace(/\./g, '').trim();

    // Get all students with this grade
    const allStudents = await db.collection('students').find({}).toArray();
    const studentsInGrade = allStudents.filter(student => {
      if (!student.grade) return false;
      const normalizedStudentGrade = student.grade.toLowerCase().replace(/\./g, '').trim();
      return normalizedStudentGrade === normalizedHomeworkGrade;
    });

    const totalStudents = studentsInGrade.length;
    const homeworkIdStr = homework._id.toString();

    // Initialize counters and ID arrays
    let notAnswered = 0;
    let lessThan50 = 0;
    let between50And100 = 0;
    let exactly100 = 0;
    const notAnsweredIds = [];
    const lessThan50Ids = [];
    const between50And100Ids = [];
    const exactly100Ids = [];

    // Check each student's result for this homework
    studentsInGrade.forEach(student => {
      const studentId = student.id || student._id?.toString() || null;
      const onlineHomeworks = student.online_homeworks || [];
      const homeworkResult = onlineHomeworks.find(hw => {
        const hwId = hw.homework_id?.toString();
        return hwId === homeworkIdStr;
      });

      let percentage = 0;
      let hasResult = false;

      // First, try to get result from online_homeworks
      if (homeworkResult) {
        const percentageStr = homeworkResult.percentage?.toString().replace('%', '') || '0';
        percentage = parseInt(percentageStr, 10);
        hasResult = true;
      } else {
        // If no result in online_homeworks, check weeks array
        // Find the week that matches this homework's week
        const weeks = student.weeks || [];
        const weekData = weeks.find(w => w.week === homework.week);
        
        if (weekData && weekData.hwDegree) {
          // Parse hwDegree format like "50 / 120"
          const hwDegreeStr = String(weekData.hwDegree).trim();
          const match = hwDegreeStr.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
          
          if (match) {
            const obtained = parseFloat(match[1]);
            const total = parseFloat(match[2]);
            percentage = total > 0 ? Math.round((obtained / total) * 100) : 0;
            hasResult = true;
          }
        }
      }

      // Categorize based on percentage
      if (!hasResult || percentage === 0) {
        // Student didn't answer
        notAnswered++;
        if (studentId) notAnsweredIds.push(studentId);
      } else if (percentage === 100) {
        exactly100++;
        if (studentId) exactly100Ids.push(studentId);
      } else if (percentage >= 50 && percentage < 100) {
        between50And100++;
        if (studentId) between50And100Ids.push(studentId);
      } else if (percentage > 0 && percentage < 50) {
        lessThan50++;
        if (studentId) lessThan50Ids.push(studentId);
      }
    });

    res.json({
      success: true,
      analytics: {
        notAnswered,
        lessThan50,
        between50And100,
        exactly100,
        totalStudents,
        notAnsweredIds,
        lessThan50Ids,
        between50And100Ids,
        exactly100Ids
      }
    });
  } catch (error) {
    console.error('❌ Error fetching homework analytics:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
}

