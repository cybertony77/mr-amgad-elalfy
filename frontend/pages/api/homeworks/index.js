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
      // Get all homeworks, sorted by week ascending, then date descending
      const homeworks = await db.collection('homeworks')
        .find({})
        .sort({ week: 1, date: -1 })
        .toArray();
      
      return res.status(200).json({ success: true, homeworks });
    }

    if (req.method === 'POST') {
      // Create new homework
      const { lesson_name, timer, questions, week, grade, homework_type, deadline_type, deadline_date, book_name, from_page, to_page, shuffle_questions_and_answers } = req.body;

      if (!lesson_name || lesson_name.trim() === '') {
        return res.status(400).json({ error: '❌ Lesson name is required' });
      }

      if (!homework_type || !['questions', 'pages_from_book'].includes(homework_type)) {
        return res.status(400).json({ error: '❌ Homework type must be "questions" or "pages_from_book"' });
      }

      // Validate based on homework type
      if (homework_type === 'pages_from_book') {
        if (!book_name || book_name.trim() === '') {
          return res.status(400).json({ error: '❌ Book name is required' });
        }
        if (!from_page || parseInt(from_page) < 1) {
          return res.status(400).json({ error: '❌ From page must be at least 1' });
        }
        if (!to_page || parseInt(to_page) < 1) {
          return res.status(400).json({ error: '❌ To page must be at least 1' });
        }
        if (parseInt(from_page) > parseInt(to_page)) {
          return res.status(400).json({ error: '❌ To page must be greater than or equal to from page' });
        }
      } else if (homework_type === 'questions') {
        if (!Array.isArray(questions) || questions.length === 0) {
          return res.status(400).json({ error: '❌ At least one question is required' });
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
        }
      }

      // Validate deadline date if with deadline is selected
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

      // Validate grade and week combination uniqueness (only if week is provided)
      const weekNumber = week !== undefined && week !== null ? parseInt(week) : null;
      if (weekNumber !== null && grade && grade.trim()) {
        const existingHomework = await db.collection('homeworks').findOne({ 
          week: weekNumber,
          grade: grade.trim()
        });
        if (existingHomework) {
          return res.status(400).json({ error: `❌ A homework with this grade and week already exists.` });
        }
      }

      const homework = {
        week: weekNumber,
        grade: grade.trim(),
        lesson_name: lesson_name.trim(),
        homework_type: homework_type,
        deadline_type: deadline_type || 'no_deadline',
        deadline_date: deadline_type === 'with_deadline' ? deadline_date : null,
        timer: homework_type === 'questions' && timer !== null && timer !== undefined ? parseInt(timer) : null,
        shuffle_questions_and_answers: homework_type === 'questions' ? (shuffle_questions_and_answers === true || shuffle_questions_and_answers === 'true') : false,
      };

      if (homework_type === 'pages_from_book') {
        homework.book_name = book_name.trim();
        homework.from_page = parseInt(from_page);
        homework.to_page = parseInt(to_page);
      } else if (homework_type === 'questions') {
        homework.questions = questions.map(q => {
          const hasText = q.answer_texts && q.answer_texts.length > 0 && q.answer_texts.some(text => text && text.trim() !== '');
          // Handle both string and array formats for correct_answer
          const correctAnswerLetter = Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer;
          const correctAnswerLetterLower = correctAnswerLetter.toLowerCase();
          const correctAnswerIdx = q.answers.indexOf(correctAnswerLetterLower.toUpperCase());
          const correctAnswerText = (correctAnswerIdx !== -1 && q.answer_texts && q.answer_texts[correctAnswerIdx]) 
            ? q.answer_texts[correctAnswerIdx] 
            : null;
          
          return {
            question_text: q.question_text || '',
            question_picture: q.question_picture || null,
            answers: q.answers,
            answer_texts: q.answer_texts || [],
            correct_answer: hasText && correctAnswerText 
              ? [correctAnswerLetterLower, correctAnswerText]
              : correctAnswerLetterLower,
            question_explanation: q.question_explanation || ''
          };
        });
      }

      const result = await db.collection('homeworks').insertOne(homework);
      
      return res.status(201).json({ 
        success: true, 
        message: 'Homework created successfully',
        homework: { ...homework, _id: result.insertedId }
      });
    }

    if (req.method === 'PUT') {
      // Update homework
      const { id } = req.query;
      const { lesson_name, timer, questions, week, grade, homework_type, deadline_type, deadline_date, book_name, from_page, to_page, shuffle_questions_and_answers } = req.body;

      if (!id) {
        return res.status(400).json({ error: '❌ Homework ID is required' });
      }

      if (!grade || grade.trim() === '') {
        return res.status(400).json({ error: '❌ Grade is required' });
      }

      if (!lesson_name || lesson_name.trim() === '') {
        return res.status(400).json({ error: '❌ Lesson name is required' });
      }

      if (!homework_type || !['questions', 'pages_from_book'].includes(homework_type)) {
        return res.status(400).json({ error: '❌ Homework type must be "questions" or "pages_from_book"' });
      }

      // Validate based on homework type
      if (homework_type === 'pages_from_book') {
        if (!book_name || book_name.trim() === '') {
          return res.status(400).json({ error: '❌ Book name is required' });
        }
        if (!from_page || parseInt(from_page) < 1) {
          return res.status(400).json({ error: '❌ From page must be at least 1' });
        }
        if (!to_page || parseInt(to_page) < 1) {
          return res.status(400).json({ error: '❌ To page must be at least 1' });
        }
        if (parseInt(from_page) > parseInt(to_page)) {
          return res.status(400).json({ error: '❌ To page must be greater than or equal to from page' });
        }
      } else if (homework_type === 'questions') {
        if (!Array.isArray(questions) || questions.length === 0) {
          return res.status(400).json({ error: '❌ At least one question is required' });
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
        }
      }

      // Validate deadline date if with deadline is selected
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

      // Validate grade and week combination uniqueness (only if week is provided and different from current)
      const weekNumber = week !== undefined && week !== null ? parseInt(week) : null;
      if (weekNumber !== null && grade && grade.trim()) {
        const existingHomework = await db.collection('homeworks').findOne({ 
          week: weekNumber,
          grade: grade.trim(),
          _id: { $ne: new ObjectId(id) } // Exclude current homework
        });
        if (existingHomework) {
          return res.status(400).json({ error: `❌ A homework with this grade and week already exists.` });
        }
      }

      const updateData = {
        week: weekNumber,
        grade: grade.trim(),
        lesson_name: lesson_name.trim(),
        homework_type: homework_type,
        deadline_type: deadline_type || 'no_deadline',
        deadline_date: deadline_type === 'with_deadline' ? deadline_date : null,
        timer: homework_type === 'questions' && timer !== null && timer !== undefined ? parseInt(timer) : null,
        shuffle_questions_and_answers: homework_type === 'questions' ? (shuffle_questions_and_answers === true || shuffle_questions_and_answers === 'true') : false,
      };

      if (homework_type === 'pages_from_book') {
        updateData.book_name = book_name.trim();
        updateData.from_page = parseInt(from_page);
        updateData.to_page = parseInt(to_page);
        // Remove questions field if switching from questions to pages_from_book
        updateData.$unset = { questions: '' };
      } else if (homework_type === 'questions') {
        updateData.questions = questions.map(q => {
          const hasText = q.answer_texts && q.answer_texts.length > 0 && q.answer_texts.some(text => text && text.trim() !== '');
          // Handle both string and array formats for correct_answer
          const correctAnswerLetter = Array.isArray(q.correct_answer) ? q.correct_answer[0] : q.correct_answer;
          const correctAnswerLetterLower = correctAnswerLetter.toLowerCase();
          const correctAnswerIdx = q.answers.indexOf(correctAnswerLetterLower.toUpperCase());
          const correctAnswerText = (correctAnswerIdx !== -1 && q.answer_texts && q.answer_texts[correctAnswerIdx]) 
            ? q.answer_texts[correctAnswerIdx] 
            : null;
          
          return {
            question_text: q.question_text || '',
            question_picture: q.question_picture || null,
            answers: q.answers,
            answer_texts: q.answer_texts || [],
            correct_answer: hasText && correctAnswerText 
              ? [correctAnswerLetterLower, correctAnswerText]
              : correctAnswerLetterLower,
            question_explanation: q.question_explanation || ''
          };
        });
        // Remove pages_from_book fields if switching from pages_from_book to questions
        updateData.$unset = { 
          ...(updateData.$unset || {}),
          book_name: '',
          from_page: '',
          to_page: ''
        };
      }

      // Handle $unset separately if it exists
      const unsetData = updateData.$unset;
      delete updateData.$unset;

      const result = await db.collection('homeworks').updateOne(
        { _id: new ObjectId(id) },
        { 
          $set: updateData,
          ...(unsetData ? { $unset: unsetData } : {})
        }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({ error: '❌ Homework not found' });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Homework updated successfully' 
      });
    }

    if (req.method === 'DELETE') {
      // Delete homework
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ error: '❌ Homework ID is required' });
      }

      const result = await db.collection('homeworks').deleteOne(
        { _id: new ObjectId(id) }
      );

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: '❌ Homework not found' });
      }

      return res.status(200).json({ 
        success: true, 
        message: 'Homework deleted successfully' 
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Homeworks API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  } finally {
    if (client) await client.close();
  }
}

