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
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/topphysics';
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME || 'mr-george-magdy';

export default async function handler(req, res) {
  let client;
  try {
    // Verify authentication
    const user = await authMiddleware(req);
    
    // Check if user has required role (admin, developer, or assistant)
    if (!['admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    if (req.method === 'GET') {
      // Get all quizzes, sorted by week ascending, then date descending
      const quizzes = await db.collection('quizzes')
        .find({})
        .sort({ week: 1, date: -1 })
        .toArray();
      
      return res.status(200).json({ success: true, quizzes });
    }

    if (req.method === 'POST') {
      // Create new quiz (always questions type)
      const { lesson_name, timer, questions, week, grade, deadline_type, deadline_date, shuffle_questions_and_answers } = req.body;

      if (!grade || grade.trim() === '') {
        return res.status(400).json({ error: '❌ Grade is required' });
      }

      if (!lesson_name || lesson_name.trim() === '') {
        return res.status(400).json({ error: '❌ Lesson name is required' });
      }

      // Validate questions
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: '❌ At least one question is required' });
      }

      // Validate deadline if with deadline
      if (deadline_type === 'with_deadline') {
        if (!deadline_date) {
          return res.status(400).json({ error: '❌ Deadline date is required' });
        }
        const selectedDate = new Date(deadline_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate <= today) {
          return res.status(400).json({ error: '❌ Deadline date must be in the future' });
        }
      }

      // Validate questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        // Each question must have at least question text OR image (or both)
        const hasQuestionText = q.question_text && q.question_text.trim() !== '';
        const hasQuestionImage = q.question_picture;
        if (!hasQuestionText && !hasQuestionImage) {
          return res.status(400).json({ error: `❌ Question ${i + 1}: Question must have at least question text or image (or both)` });
        }
        if (!Array.isArray(q.answers) || q.answers.length < 2) {
          return res.status(400).json({ error: `❌ Question ${i + 1}: At least 2 answers (A and B) are required` });
        }
        // Validate answers are letters (A, B, C, D, etc.)
        for (let j = 0; j < q.answers.length; j++) {
          const expectedLetter = String.fromCharCode(65 + j); // A=65, B=66, etc.
          if (q.answers[j] !== expectedLetter) {
            return res.status(400).json({ error: `❌ Question ${i + 1}: Answers must be letters A, B, C, D, etc. in order` });
          }
        }
        // Validate correct_answer is a valid letter (a, b, c, etc.) that corresponds to an answer
        if (!q.correct_answer) {
          return res.status(400).json({ error: `❌ Question ${i + 1}: Correct answer is required` });
        }
        // Handle both string and array formats for correct_answer
        const correctAnswerLetter = Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer;
        const correctLetterUpper = correctAnswerLetter.toUpperCase();
        if (!q.answers.includes(correctLetterUpper)) {
          return res.status(400).json({ error: `❌ Question ${i + 1}: Correct answer must be one of the provided answers` });
        }
        // Validate answer_texts array matches answers array length
        if (q.answer_texts && Array.isArray(q.answer_texts) && q.answer_texts.length !== q.answers.length) {
          return res.status(400).json({ error: `❌ Question ${i + 1}: Answer texts array must match answers array length` });
        }
      }

      // Check for duplicate grade and week combination
      const existingQuiz = await db.collection('quizzes').findOne({
        grade: grade.trim(),
        week: week
      });

      if (existingQuiz) {
        return res.status(400).json({ error: '❌ A quiz with this grade and week already exists' });
      }

      // Prepare quiz document (always questions type)
      const quizDoc = {
        lesson_name: lesson_name.trim(),
        grade: grade.trim(),
        week: week,
        quiz_type: 'questions',
        deadline_type: deadline_type || 'no_deadline',
        deadline_date: deadline_type === 'with_deadline' ? deadline_date : null,
        timer: timer || null,
        shuffle_questions_and_answers: shuffle_questions_and_answers === true || shuffle_questions_and_answers === 'true',
        show_details_after_submitting: show_details_after_submitting === true || show_details_after_submitting === 'true',
        date: new Date(),
        questions: questions.map(q => ({
          question_text: q.question_text || '',
          question_picture: q.question_picture,
          answers: q.answers,
          answer_texts: q.answer_texts || [],
          correct_answer: q.correct_answer,
          question_explanation: q.question_explanation || ''
        })),
        questions_count: questions.length,
        questions_with_images: questions.filter(q => q.question_picture).length
      };

      const result = await db.collection('quizzes').insertOne(quizDoc);
      
      return res.status(201).json({ 
        success: true, 
        message: 'Quiz created successfully',
        quiz: { ...quizDoc, _id: result.insertedId }
      });
    }

    if (req.method === 'PUT') {
      // Update quiz (always questions type)
      const { id } = req.query;
      const { lesson_name, timer, questions, week, grade, deadline_type, deadline_date, shuffle_questions_and_answers } = req.body;

      if (!id) {
        return res.status(400).json({ error: '❌ Quiz ID is required' });
      }

      if (!grade || grade.trim() === '') {
        return res.status(400).json({ error: '❌ Grade is required' });
      }

      if (!lesson_name || lesson_name.trim() === '') {
        return res.status(400).json({ error: '❌ Lesson name is required' });
      }

      // Validate questions
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: '❌ At least one question is required' });
      }

      // Validate deadline if with deadline
      if (deadline_type === 'with_deadline') {
        if (!deadline_date) {
          return res.status(400).json({ error: '❌ Deadline date is required' });
        }
        const selectedDate = new Date(deadline_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate <= today) {
          return res.status(400).json({ error: '❌ Deadline date must be in the future' });
        }
      }

      // Validate questions
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        // Each question must have at least question text OR image (or both)
        const hasQuestionText = q.question_text && q.question_text.trim() !== '';
        const hasQuestionImage = q.question_picture;
        if (!hasQuestionText && !hasQuestionImage) {
          return res.status(400).json({ error: `❌ Question ${i + 1}: Question must have at least question text or image (or both)` });
        }
        if (!Array.isArray(q.answers) || q.answers.length < 2) {
          return res.status(400).json({ error: `❌ Question ${i + 1}: At least 2 answers (A and B) are required` });
        }
        // Validate answers are letters (A, B, C, D, etc.)
        for (let j = 0; j < q.answers.length; j++) {
          const expectedLetter = String.fromCharCode(65 + j); // A=65, B=66, etc.
          if (q.answers[j] !== expectedLetter) {
            return res.status(400).json({ error: `❌ Question ${i + 1}: Answers must be letters A, B, C, D, etc. in order` });
          }
        }
        // Validate correct_answer is a valid letter (a, b, c, etc.) that corresponds to an answer
        if (!q.correct_answer) {
          return res.status(400).json({ error: `❌ Question ${i + 1}: Correct answer is required` });
        }
        // Handle both string and array formats for correct_answer
        const correctAnswerLetter = Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer;
        const correctLetterUpper = correctAnswerLetter.toUpperCase();
        if (!q.answers.includes(correctLetterUpper)) {
          return res.status(400).json({ error: `❌ Question ${i + 1}: Correct answer must be one of the provided answers` });
        }
        // Validate answer_texts array matches answers array length
        if (q.answer_texts && Array.isArray(q.answer_texts) && q.answer_texts.length !== q.answers.length) {
          return res.status(400).json({ error: `❌ Question ${i + 1}: Answer texts array must match answers array length` });
        }
      }

      // Validate grade and week combination uniqueness (only if week is provided and different from current)
      const weekNumber = week !== undefined && week !== null ? parseInt(week) : null;
      if (weekNumber !== null && grade && grade.trim()) {
        const existingQuiz = await db.collection('quizzes').findOne({ 
          week: weekNumber,
          grade: grade.trim(),
          _id: { $ne: new ObjectId(id) } // Exclude current quiz
        });
        if (existingQuiz) {
          return res.status(400).json({ error: `❌ A quiz with this grade and week already exists.` });
        }
      }

      // Prepare update data (always questions type)
      const updateData = {
        week: weekNumber,
        grade: grade.trim(),
        lesson_name: lesson_name.trim(),
        quiz_type: 'questions',
        deadline_type: deadline_type || 'no_deadline',
        deadline_date: deadline_type === 'with_deadline' ? deadline_date : null,
        timer: timer === null || timer === undefined ? null : parseInt(timer),
        shuffle_questions_and_answers: shuffle_questions_and_answers === true || shuffle_questions_and_answers === 'true',
        questions: questions.map(q => ({
          question_text: q.question_text || '',
          question_picture: q.question_picture,
          answers: q.answers,
          answer_texts: q.answer_texts || [],
          correct_answer: (() => {
            const hasText = q.answer_texts && q.answer_texts.length > 0 && q.answer_texts.some(text => text && text.trim() !== '');
            // Handle both string and array formats for correct_answer
            const correctAnswerLetter = Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer;
            const correctAnswerLetterLower = correctAnswerLetter.toLowerCase();
            const correctAnswerIdx = q.answers.indexOf(correctAnswerLetterLower.toUpperCase());
            const correctAnswerText = (correctAnswerIdx !== -1 && q.answer_texts && q.answer_texts[correctAnswerIdx]) 
              ? q.answer_texts[correctAnswerIdx] 
              : null;
            return hasText && correctAnswerText 
              ? [correctAnswerLetterLower, correctAnswerText]
              : correctAnswerLetterLower;
          })(),
          question_explanation: q.question_explanation || ''
        })),
        questions_count: questions.length,
        questions_with_images: questions.filter(q => q.question_picture).length
      };

      // Remove old pages_from_book fields if they exist
      const updateQuery = { 
        $set: updateData,
        $unset: { book_name: '', from_page: '', to_page: '' }
      };

      const result = await db.collection('quizzes').updateOne(
        { _id: new ObjectId(id) },
        updateQuery
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: '❌ Quiz not found' });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Quiz updated successfully' 
      });
    }

    if (req.method === 'DELETE') {
      // Delete quiz
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: '❌ Quiz ID is required' });
      }

      const result = await db.collection('quizzes').deleteOne(
        { _id: new ObjectId(id) }
      );

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: '❌ Quiz not found' });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Quiz deleted successfully' 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Quizzes API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}

