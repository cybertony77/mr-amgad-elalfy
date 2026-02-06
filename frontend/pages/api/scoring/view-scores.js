import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { authMiddleware } from '../../../lib/authMiddleware';

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

  let client;
  try {
    const user = await authMiddleware(req);
    if (!['admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const { page = 1, limit = 100, search, grade, center, score, sortBy = 'score', sortOrder = 'desc' } = req.query;

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get all students for ranking calculation (we need all students to calculate rankings correctly)
    const allStudents = await db.collection('students').find({}).toArray();

    // Calculate rankings for each student
    // Group students by main center and grade for efficient ranking
    const centerGroups = {};
    const gradeGroups = {};
    
    allStudents.forEach(student => {
      if (student.score !== null && student.score !== undefined) {
        // Group by main center
        const center = student.main_center || 'Unknown';
        if (!centerGroups[center]) {
          centerGroups[center] = [];
        }
        centerGroups[center].push(student);
        
        // Group by grade
        const grade = student.grade || 'Unknown';
        if (!gradeGroups[grade]) {
          gradeGroups[grade] = [];
        }
        gradeGroups[grade].push(student);
      }
    });
    
    // Sort each group by score descending
    Object.keys(centerGroups).forEach(center => {
      centerGroups[center].sort((a, b) => (b.score || 0) - (a.score || 0));
    });
    
    Object.keys(gradeGroups).forEach(grade => {
      gradeGroups[grade].sort((a, b) => (b.score || 0) - (a.score || 0));
    });
    
    // Calculate rankings for each student
    const studentsWithRankings = allStudents.map(student => {
      const center = student.main_center || 'Unknown';
      const grade = student.grade || 'Unknown';
      
      // Calculate rank within main center
      const sameCenterStudents = centerGroups[center] || [];
      const centerRank = sameCenterStudents.findIndex(s => s.id === student.id) + 1;
      const centerTotal = sameCenterStudents.length;

      // Calculate rank within grade
      const sameGradeStudents = gradeGroups[grade] || [];
      const gradeRank = sameGradeStudents.findIndex(s => s.id === student.id) + 1;
      const gradeTotal = sameGradeStudents.length;

      return {
        ...student,
        centerRank: centerRank > 0 ? centerRank : null,
        centerTotal: centerTotal > 0 ? centerTotal : null,
        gradeRank: gradeRank > 0 ? gradeRank : null,
        gradeTotal: gradeTotal > 0 ? gradeTotal : null
      };
    });

    // Apply filters to students with rankings
    let filteredStudents = studentsWithRankings.filter(student => {
      // Search filter: by student ID, student number (id), or name
      if (search) {
        const searchNum = parseInt(search, 10);
        if (!isNaN(searchNum)) {
          // Search by student ID or student number (both use the id field)
          if (student.id !== searchNum) return false;
        } else {
          // Search by name
          const searchLower = search.toLowerCase();
          if (!student.name?.toLowerCase().includes(searchLower)) {
            return false;
          }
        }
      }

      // Grade filter
      if (grade && student.grade !== grade) return false;
      
      // Center filter
      if (center && student.main_center !== center) return false;
      
      // Score filter: filter by score >= selected value
      if (score) {
        const scoreValue = parseInt(score.replace('+', ''), 10);
        if (!isNaN(scoreValue)) {
          if ((student.score || 0) < scoreValue) return false;
        }
      }

      return true;
    });

    // Sort students
    filteredStudents.sort((a, b) => {
      let aValue, bValue;
      
      if (sortBy === 'score') {
        aValue = a.score || 0;
        bValue = b.score || 0;
      } else if (sortBy === 'id') {
        aValue = a.id || 0;
        bValue = b.id || 0;
      } else if (sortBy === 'name') {
        aValue = (a.name || '').toLowerCase();
        bValue = (b.name || '').toLowerCase();
      } else if (sortBy === 'grade') {
        aValue = a.grade || '';
        bValue = b.grade || '';
      } else if (sortBy === 'school') {
        aValue = (a.school || '').toLowerCase();
        bValue = (b.school || '').toLowerCase();
      } else if (sortBy === 'main_center') {
        aValue = (a.main_center || '').toLowerCase();
        bValue = (b.main_center || '').toLowerCase();
      } else {
        aValue = a[sortBy] || 0;
        bValue = b[sortBy] || 0;
      }

      if (sortOrder === 'desc') {
        if (typeof aValue === 'string') {
          return bValue.localeCompare(aValue);
        }
        return bValue - aValue;
      } else {
        if (typeof aValue === 'string') {
          return aValue.localeCompare(bValue);
        }
        return aValue - bValue;
      }
    });

    // Pagination
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const skip = (pageNum - 1) * limitNum;
    const totalCount = filteredStudents.length;
    const totalPages = Math.ceil(totalCount / limitNum);
    const paginatedStudents = filteredStudents.slice(skip, skip + limitNum);

    // Convert ObjectId to string for JSON serialization
    const serializedStudents = paginatedStudents.map(student => ({
      ...student,
      _id: student._id?.toString() || student._id
    }));

    return res.status(200).json({
      success: true,
      data: serializedStudents,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Error fetching students with scores:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    if (client) await client.close();
  }
}
