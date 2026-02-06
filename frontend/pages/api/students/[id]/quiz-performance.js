import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../../lib/authMiddleware';
import { verifySignature } from '../../../../lib/hmac';

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

  const { id, sig } = req.query;
  const student_id = parseInt(id);

  let client;
  let isPublicAccess = false;

  try {
    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);
    
    // Check if this is a public access request (with HMAC signature)
    if (sig) {
      const studentIdFromQuery = String(id || '').trim();
      const signature = String(sig).trim();
      if (studentIdFromQuery && signature && verifySignature(studentIdFromQuery, signature)) {
        isPublicAccess = true;
      } else {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    // If not public access, verify authentication
    if (!isPublicAccess) {
      // Verify authentication - allow students to view their own results, or admins/assistants/developers to view any student
      const user = await authMiddleware(req);
      const userId = user.assistant_id || user.id; // JWT contains assistant_id for students
      
      // Students can only view their own results
      if (user.role === 'student' && userId !== student_id) {
        return res.status(403).json({ error: 'Forbidden: You can only view your own results' });
      }
      
      // Admins, assistants, and developers can view any student's results
      if (!['student', 'admin', 'assistant', 'developer'].includes(user.role)) {
        return res.status(403).json({ error: 'Forbidden: Access denied' });
      }
    }

    // Get student data
    const student = await db.collection('students').findOne({ id: student_id });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get student's grade
    const studentGrade = student.grade;
    if (!studentGrade) {
      // If student has no grade, return empty array
      return res.json({ 
        success: true,
        chartData: []
      });
    }

    // Get all quiz results from online_quizzes
    const onlineQuizzes = student.online_quizzes || [];
    
    // Create a map of quiz_id to result data (percentage and result string)
    // Store with both original format and normalized ObjectId format for matching
    const resultMap = {};
    onlineQuizzes.forEach(quizResult => {
      if (quizResult.quiz_id) {
        const quizIdOriginal = quizResult.quiz_id.toString();
        const percentage = parseInt(quizResult.percentage?.toString().replace('%', '') || '0');
        const result = quizResult.result || '0 / 0'; // Format: "8 / 10"
        const resultData = { percentage, result };
        
        // Store with original format
        resultMap[quizIdOriginal] = resultData;
        
        // Also store with normalized ObjectId format if it's a valid ObjectId
        if (ObjectId.isValid(quizIdOriginal)) {
          try {
            const objId = new ObjectId(quizIdOriginal);
            resultMap[objId.toString()] = resultData;
          } catch (e) {
            // Ignore conversion errors
          }
        }
      }
    });

    // ALWAYS load from weeks array as well (even if online_quizzes exists)
    // This ensures we get all quiz data, including legacy entries
    const weeks = student.weeks || [];
    weeks.forEach(weekData => {
      if (weekData.week && weekData.quizDegree) {
        // Parse quizDegree format like "50 / 100" or "8 / 10"
        const quizDegreeStr = String(weekData.quizDegree).trim();
        const match = quizDegreeStr.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        
        if (match) {
          const obtained = parseFloat(match[1]);
          const total = parseFloat(match[2]);
          const percentage = total > 0 ? Math.round((obtained / total) * 100) : 0;
          const result = quizDegreeStr; // Keep original format "50 / 100"
          
          // Store by week number as key
          // Only override if not already set from online_quizzes
          if (!resultMap[`week_${weekData.week}`]) {
            resultMap[`week_${weekData.week}`] = { percentage, result };
          }
        }
      }
    });

    // Get ALL quizzes for this student's grade (not just completed ones)
    const normalizedStudentGrade = studentGrade.toLowerCase().replace(/\./g, '').trim();
    const allQuizzes = await db.collection('quizzes').find({}).toArray();
    
    // Filter quizzes by normalized grade
    const filteredQuizzes = allQuizzes.filter(qz => {
      if (!qz.grade || !qz.week) return false; // Only include quizzes with grade and week
      const normalizedQuizGrade = qz.grade.toLowerCase().replace(/\./g, '').trim();
      return normalizedQuizGrade === normalizedStudentGrade;
    });

    // Group all quizzes by week - show result directly from DB (no aggregation)
    // If multiple quizzes in same week, prioritize completed ones
    const weekDataMap = {};
    
    filteredQuizzes.forEach(quiz => {
      const week = quiz.week;
      // Normalize quiz._id to string for matching
      const quizIdStr = quiz._id.toString();
      // Find result data - should match since we stored both formats
      let resultData = resultMap[quizIdStr];
      
      // If no result from online_quizzes, check weeks fallback
      if (!resultData) {
        resultData = resultMap[`week_${week}`];
      }
      
      if (!weekDataMap[week]) {
        weekDataMap[week] = {
          weekNumber: week,
          week: `Week ${week}`,
          percentage: 0,
          result: '0 / 0'
        };
      }
      
      // If there's a result for this quiz, use it directly (don't aggregate)
      // Prioritize completed results (non-zero percentage) over incomplete ones
      if (resultData) {
        const isCompleted = resultData.percentage > 0;
        const currentIsCompleted = weekDataMap[week].percentage > 0;
        
        // Use this result if: it's completed, or if current is not completed
        if (isCompleted || !currentIsCompleted) {
          weekDataMap[week].percentage = resultData.percentage;
          weekDataMap[week].result = resultData.result; // Show result from DB as-is
        }
      }
    });

    // ALSO add weeks data that don't have corresponding quizzes in the database
    // This ensures all weeks with quizDegree are shown in the chart
    weeks.forEach(weekData => {
      if (weekData.week && weekData.quizDegree) {
        // Check if this week already has data from filteredQuizzes
        if (!weekDataMap[weekData.week]) {
          // Parse quizDegree format like "50 / 100"
          const quizDegreeStr = String(weekData.quizDegree).trim();
          const match = quizDegreeStr.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
          
          if (match) {
            const obtained = parseFloat(match[1]);
            const total = parseFloat(match[2]);
            const percentage = total > 0 ? Math.round((obtained / total) * 100) : 0;
            
            weekDataMap[weekData.week] = {
              weekNumber: weekData.week,
              week: `Week ${weekData.week}`,
              percentage: percentage,
              result: quizDegreeStr
            };
          }
        }
      }
    });

    // Convert to array and sort by week number
    const chartData = Object.values(weekDataMap)
      .sort((a, b) => a.weekNumber - b.weekNumber);

    // Always return success with chartData (empty array if no data)
    res.json({ 
      success: true,
      chartData: chartData
    });
  } catch (error) {
    console.error('❌ Error fetching quiz performance:', error);
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

