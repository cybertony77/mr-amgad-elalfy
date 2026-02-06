import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Title from '../../../../components/Title';
import AttendanceWeekSelect from '../../../../components/AttendanceWeekSelect';
import GradeSelect from '../../../../components/GradeSelect';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../../lib/axios';
import Image from 'next/image';
import ZoomableImage from '../../../../components/ZoomableImage';

// Extract week number from week string (e.g., "week 01" -> 1)
function extractWeekNumber(weekString) {
  if (!weekString) return null;
  const match = weekString.match(/week\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

export default function AddHomework() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    lesson_name: '',
    deadline_type: 'no_deadline', // 'no_deadline' or 'with_deadline'
    deadline_date: '',
    homework_type: 'questions', // 'questions' or 'pages_from_book'
    book_name: '',
    from_page: '',
    to_page: '',
    timer_type: 'no_timer',
    timer: null,
    questions: [{
      question_text: '',
      question_picture: null,
      answers: ['A', 'B'],
      answer_texts: ['', ''], // Text for each answer option
      correct_answer: ''
    }]
  });
  const [activeTab, setActiveTab] = useState(formData.homework_type || 'questions'); // 'questions' or 'pages_from_book'
  const [selectedGrade, setSelectedGrade] = useState('');
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [errors, setErrors] = useState({});
  const [uploadingImages, setUploadingImages] = useState({});
  const [imagePreviews, setImagePreviews] = useState({});
  const [dragOverIndex, setDragOverIndex] = useState(null);
  const errorTimeoutRef = useRef(null);

  // Fetch all homeworks for duplicate validation
  const { data: homeworksData } = useQuery({
    queryKey: ['homeworks'],
    queryFn: async () => {
      const response = await apiClient.get('/api/homeworks');
      return response.data;
    },
  });

  const homeworks = homeworksData?.homeworks || [];

  // Auto-hide errors after 6 seconds
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      // Clear any existing timeout
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      // Set new timeout to clear errors after 6 seconds
      errorTimeoutRef.current = setTimeout(() => {
        setErrors({});
      }, 6000);
    }
    // Cleanup on unmount
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [errors]);

  const createHomeworkMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post('/api/homeworks', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['homeworks']);
      router.push('/dashboard/manage_online_system/homeworks');
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.error || 'Failed to create homework';
      setErrors({ general: errorMsg.startsWith('❌') ? errorMsg : `❌ ${errorMsg}` });
    },
  });

  // Handle image upload
  const handleImageUpload = async (questionIndex, file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setErrors(prev => ({ ...prev, [`question_${questionIndex}_image`]: '❌ Please select an image file' }));
      return;
    }

    // Validate file size (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrors(prev => ({ ...prev, [`question_${questionIndex}_image`]: '❌ Sorry, Max image size is 10 MB, Please try another picture' }));
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreviews(prev => ({ ...prev, [questionIndex]: reader.result }));
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary
    setUploadingImages(prev => ({ ...prev, [questionIndex]: true }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`question_${questionIndex}_image`];
      return newErrors;
    });
    
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await apiClient.post('/api/upload/homework-question-image', {
        file: base64,
        fileName: file.name,
        fileType: file.type
      });

      if (response.data.success && response.data.public_id) {
        const newPublicId = response.data.public_id;
        setFormData(prev => {
          const newQuestions = [...prev.questions];
          newQuestions[questionIndex] = {
            ...newQuestions[questionIndex],
            question_picture: newPublicId
          };
          return { ...prev, questions: newQuestions };
        });
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      let errorMessage = '❌ Failed to upload image. Please try again.';
      
      if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
        if (!errorMessage.startsWith('❌')) {
          errorMessage = `❌ ${errorMessage}`;
        }
      } else if (err.message?.includes('ERR_CONNECTION_RESET') || err.message?.includes('Network Error') || err.code === 'ECONNRESET') {
        errorMessage = '❌ Connection error. The image may be too large. Please try a smaller image (max 10 MB).';
      } else if (err.message) {
        errorMessage = `❌ ${err.message}`;
      }
      
      setErrors(prev => ({ ...prev, [`question_${questionIndex}_image`]: errorMessage }));
      setImagePreviews(prev => {
        const newPreviews = { ...prev };
        delete newPreviews[questionIndex];
        return newPreviews;
      });
    } finally {
      setUploadingImages(prev => {
        const newUploading = { ...prev };
        delete newUploading[questionIndex];
        return newUploading;
      });
    }
  };

  // Handle remove image
  const handleRemoveImage = (questionIndex) => {
    setFormData(prev => {
      const newQuestions = [...prev.questions];
      newQuestions[questionIndex] = {
        ...newQuestions[questionIndex],
        question_picture: null
      };
      return { ...prev, questions: newQuestions };
    });
    setImagePreviews(prev => {
      const newPreviews = { ...prev };
      delete newPreviews[questionIndex];
      return newPreviews;
    });
  };

  // Drag and drop handlers
  const handleDragOver = (e, questionIndex) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(questionIndex);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
  };

  const handleDrop = (e, questionIndex) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageUpload(questionIndex, file);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  };

  const handleTimerTypeChange = (e) => {
    const timerType = e.target.value;
    setFormData(prev => ({
      ...prev,
      timer_type: timerType,
      timer: timerType === 'no_timer' ? null : prev.timer
    }));
  };

  const handleQuestionChange = (questionIndex, field, value) => {
    setFormData(prev => {
      const newQuestions = [...prev.questions];
      newQuestions[questionIndex] = {
        ...newQuestions[questionIndex],
        [field]: value
      };
      return { ...prev, questions: newQuestions };
    });
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`question_${questionIndex}_${field}`];
      return newErrors;
    });
  };

  // Removed handleAnswerChange - answers are now just letters, managed by addAnswer/removeAnswer

  const addAnswer = (questionIndex) => {
    setFormData(prev => {
      const newQuestions = [...prev.questions];
      const currentAnswers = newQuestions[questionIndex].answers;
      const currentAnswerTexts = newQuestions[questionIndex].answer_texts || [];
      const nextLetter = String.fromCharCode(65 + currentAnswers.length); // A=65, B=66, C=67, etc.
      newQuestions[questionIndex] = {
        ...newQuestions[questionIndex],
        answers: [...currentAnswers, nextLetter],
        answer_texts: [...currentAnswerTexts, '']
      };
      return { ...prev, questions: newQuestions };
    });
  };

  const removeAnswer = (questionIndex, answerIndex) => {
    if (answerIndex < 2) return; // Can't remove A or B
    
    setFormData(prev => {
      const newQuestions = [...prev.questions];
      const currentAnswers = newQuestions[questionIndex].answers;
      const currentAnswerTexts = newQuestions[questionIndex].answer_texts || [];
      const removedLetter = currentAnswers[answerIndex];
      const correctAnswer = newQuestions[questionIndex].correct_answer;
      
      // Remove the answer at the specified index
      const newAnswers = currentAnswers.filter((_, idx) => idx !== answerIndex);
      const newAnswerTexts = currentAnswerTexts.filter((_, idx) => idx !== answerIndex);
      
      // Reorder answers to be sequential (A, B, C, D, ...)
      const reorderedAnswers = newAnswers.map((_, idx) => String.fromCharCode(65 + idx));
      
      // Update correct_answer if the removed answer was the correct one
      let newCorrectAnswer = correctAnswer;
      if (correctAnswer === removedLetter.toLowerCase()) {
        newCorrectAnswer = '';
      } else if (correctAnswer) {
        // Find the new position of the correct answer after reordering
        const correctLetterUpper = correctAnswer.toUpperCase();
        const oldIndex = currentAnswers.indexOf(correctLetterUpper);
        if (oldIndex > answerIndex) {
          // The correct answer was after the removed one, so it moves up by 1
          const newLetter = String.fromCharCode(65 + oldIndex - 1).toLowerCase();
          newCorrectAnswer = newLetter;
        }
        // If oldIndex < answerIndex, the correct answer stays the same letter
      }
      
      newQuestions[questionIndex] = {
        ...newQuestions[questionIndex],
        answers: reorderedAnswers,
        answer_texts: newAnswerTexts,
        correct_answer: newCorrectAnswer
      };
      return { ...prev, questions: newQuestions };
    });
  };

  const addQuestion = () => {
    setFormData(prev => ({
      ...prev,
      questions: [...prev.questions, {
        question_text: '',
        question_picture: null,
        answers: ['A', 'B'],
        answer_texts: ['', ''],
        correct_answer: ''
      }]
    }));
  };

  const removeQuestion = (questionIndex) => {
    if (formData.questions.length === 1) {
      setErrors({ general: '❌ At least one question is required' });
      return;
    }
    
    setFormData(prev => ({
      ...prev,
      questions: prev.questions.filter((_, idx) => idx !== questionIndex)
    }));
    setImagePreviews(prev => {
      const newPreviews = { ...prev };
      delete newPreviews[questionIndex];
      return newPreviews;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    // Check if any images are still uploading
    const isUploading = Object.keys(uploadingImages).length > 0;
    if (isUploading) {
      setErrors({ general: '❌ Please wait for all images to finish uploading before saving' });
      return;
    }

    // Validate grade
    if (!selectedGrade || selectedGrade.trim() === '') {
      newErrors.grade = '❌ Grade is required';
    }

    // Validate week
    if (!selectedWeek || selectedWeek.trim() === '') {
      newErrors.week = '❌ Homework week is required';
    }

    // Validate lesson name
    if (!formData.lesson_name || formData.lesson_name.trim() === '') {
      newErrors.lesson_name = '❌ Lesson name is required';
    }

    // Validate homework type
    if (formData.homework_type === 'pages_from_book') {
      if (!formData.book_name || formData.book_name.trim() === '') {
        newErrors.book_name = '❌ Book name is required';
      }
      if (!formData.from_page || parseInt(formData.from_page) < 1) {
        newErrors.from_page = '❌ From page must be at least 1';
      }
      if (!formData.to_page || parseInt(formData.to_page) < 1) {
        newErrors.to_page = '❌ To page must be at least 1';
      }
      if (formData.from_page && formData.to_page && parseInt(formData.from_page) > parseInt(formData.to_page)) {
        newErrors.to_page = '❌ To page must be greater than or equal to from page';
      }
    } else if (formData.homework_type === 'questions') {
      // Validate timer if with timer is selected
      if (formData.timer_type === 'with_timer') {
        if (!formData.timer || parseInt(formData.timer) < 1) {
          newErrors.timer = '❌ Timer must be at least 1 minute';
        }
      }
      // Validate questions
      formData.questions.forEach((q, qIdx) => {
        // Each question must have at least question text OR image (or both)
        const hasQuestionText = q.question_text && q.question_text.trim() !== '';
        const hasQuestionImage = q.question_picture;
        if (!hasQuestionText && !hasQuestionImage) {
          newErrors[`question_${qIdx}_text_or_image`] = '❌ Question must have at least question text or image (or both)';
        }
        if (!q.answers || q.answers.length < 2) {
          newErrors[`question_${qIdx}_answers`] = '❌ At least 2 answers (A and B) are required';
        }
        if (!q.correct_answer) {
          newErrors[`question_${qIdx}_correct`] = '❌ Please select the correct answer';
        }
      });
    }

    // Validate deadline date if with deadline is selected
    if (formData.deadline_type === 'with_deadline') {
      if (!formData.deadline_date) {
        newErrors.deadline_date = '❌ Deadline date is required';
      } else {
        const selectedDate = new Date(formData.deadline_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (selectedDate <= today) {
          newErrors.deadline_date = '❌ Deadline date must be in the future';
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Extract week number from week string
    const weekNumber = extractWeekNumber(selectedWeek);
    if (!weekNumber) {
      newErrors.week = '❌ Invalid week selection';
      setErrors(newErrors);
      return;
    }

    // Check for duplicate grade and week combination
    const duplicateHomework = homeworks.find(
      homework => homework.grade === selectedGrade.trim() && homework.week === weekNumber
    );
    if (duplicateHomework) {
      newErrors.general = '❌ A homework with this grade and week already exists';
      setErrors(newErrors);
      
      // Clear error after 6 seconds
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => {
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.general;
          return newErrors;
        });
      }, 6000);
      return;
    }

    // Prepare data for API
    const submitData = {
      lesson_name: formData.lesson_name.trim(),
      grade: selectedGrade.trim(),
      week: weekNumber,
      deadline_type: formData.deadline_type,
      deadline_date: formData.deadline_type === 'with_deadline' ? formData.deadline_date : null,
      homework_type: formData.homework_type,
      timer: formData.homework_type === 'questions' && formData.timer_type === 'with_timer' ? parseInt(formData.timer) : null,
    };

    if (formData.homework_type === 'pages_from_book') {
      submitData.book_name = formData.book_name.trim();
      submitData.from_page = parseInt(formData.from_page);
      submitData.to_page = parseInt(formData.to_page);
    } else if (formData.homework_type === 'questions') {
      submitData.questions = formData.questions.map(q => ({
        question_text: q.question_text || '',
        question_picture: q.question_picture,
        answers: q.answers,
        answer_texts: q.answer_texts || [],
        correct_answer: q.correct_answer
      }));
    }

    createHomeworkMutation.mutate(submitData);
  };

  return (
    <div style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
        <Title backText="Back" href="/dashboard/manage_online_system/homeworks">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/plus.svg" alt="Add" width={32} height={32} />
            Add Homework
          </div>
        </Title>

        <div className="form-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <form onSubmit={handleSubmit}>
            {/* Homework Grade */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                Homework Grade <span style={{ color: 'red' }}>*</span>
              </label>
              <GradeSelect
                selectedGrade={selectedGrade}
                onGradeChange={(grade) => {
                  setSelectedGrade(grade);
                  if (errors.grade) {
                    setErrors({ ...errors, grade: '' });
                  }
                }}
                isOpen={gradeDropdownOpen}
                onToggle={() => setGradeDropdownOpen(!gradeDropdownOpen)}
                onClose={() => setGradeDropdownOpen(false)}
                required={true}
              />
              {errors.grade && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                  {errors.grade}
                </div>
              )}
            </div>

            {/* Homework Week */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                Homework Week <span style={{ color: 'red' }}>*</span>
              </label>
              <AttendanceWeekSelect
                selectedWeek={selectedWeek}
                onWeekChange={(week) => {
                  setSelectedWeek(week);
                  if (errors.week) {
                    setErrors({ ...errors, week: '' });
                  }
                }}
                isOpen={weekDropdownOpen}
                onToggle={() => setWeekDropdownOpen(!weekDropdownOpen)}
                onClose={() => setWeekDropdownOpen(false)}
                required={true}
                placeholder="Select Homework Week"
              />
              {errors.week && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                  {errors.week}
                </div>
              )}
            </div>

            {/* Lesson Name */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                Lesson Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                name="lesson_name"
                value={formData.lesson_name}
                onChange={handleInputChange}
                placeholder="Enter Lesson Name"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: errors.lesson_name ? '2px solid #dc3545' : '2px solid #e9ecef',
                  borderRadius: '10px',
                  fontSize: '1rem'
                }}
              />
              {errors.lesson_name && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                  {errors.lesson_name}
                </div>
              )}
            </div>

            {/* Tabs Container (Questions / Pages from Book) */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e9ecef', marginBottom: '20px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('questions');
                    setFormData({ 
                      ...formData, 
                      homework_type: 'questions',
                      book_name: '',
                      from_page: '',
                      to_page: ''
                    });
                  }}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    borderBottom: activeTab === 'questions' ? '3px solid #1FA8DC' : '3px solid transparent',
                    backgroundColor: 'transparent',
                    color: activeTab === 'questions' ? '#1FA8DC' : '#6c757d',
                    fontWeight: activeTab === 'questions' ? '600' : '500',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Questions
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('pages_from_book');
                    setFormData({ 
                      ...formData, 
                      homework_type: 'pages_from_book',
                      questions: [{
                        question_text: '',
                        question_picture: null,
                        answers: ['A', 'B'],
                        answer_texts: ['', ''],
                        correct_answer: ''
                      }],
                      timer_type: 'no_timer',
                      timer: null
                    });
                  }}
                  style={{
                    padding: '12px 24px',
                    border: 'none',
                    borderBottom: activeTab === 'pages_from_book' ? '3px solid #1FA8DC' : '3px solid transparent',
                    backgroundColor: 'transparent',
                    color: activeTab === 'pages_from_book' ? '#1FA8DC' : '#6c757d',
                    fontWeight: activeTab === 'pages_from_book' ? '600' : '500',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Pages from Book
                </button>
              </div>

              {/* Pages from Book Content */}
              {activeTab === 'pages_from_book' && (
                <div style={{ padding: '20px', border: '2px solid #e9ecef', borderRadius: '12px', backgroundColor: '#f8f9fa' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                      Book Name <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.book_name}
                      onChange={(e) => setFormData({ ...formData, book_name: e.target.value })}
                      placeholder="Enter Book Name"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: errors.book_name ? '2px solid #dc3545' : '2px solid #e9ecef',
                        borderRadius: '10px',
                        fontSize: '1rem'
                      }}
                    />
                    {errors.book_name && (
                      <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                        {errors.book_name}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                        From Page <span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.from_page}
                        onChange={(e) => setFormData({ ...formData, from_page: e.target.value })}
                        placeholder="From"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: errors.from_page ? '2px solid #dc3545' : '2px solid #e9ecef',
                          borderRadius: '10px',
                          fontSize: '1rem'
                        }}
                      />
                      {errors.from_page && (
                        <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                          {errors.from_page}
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                        To Page <span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.to_page}
                        onChange={(e) => setFormData({ ...formData, to_page: e.target.value })}
                        placeholder="To"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: errors.to_page ? '2px solid #dc3545' : '2px solid #e9ecef',
                          borderRadius: '10px',
                          fontSize: '1rem'
                        }}
                      />
                      {errors.to_page && (
                        <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                          {errors.to_page}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Questions Content */}
            {activeTab === 'questions' && (
              <>
                {/* Deadline Radio */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'left' }}>
                    Deadline
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: formData.deadline_type === 'no_deadline' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: formData.deadline_type === 'no_deadline' ? '#f0f8ff' : 'white' }}>
                      <input
                        type="radio"
                        name="deadline_type"
                        value="no_deadline"
                        checked={formData.deadline_type === 'no_deadline'}
                        onChange={(e) => setFormData({ ...formData, deadline_type: e.target.value, deadline_date: '' })}
                        style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>No Deadline Date</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: formData.deadline_type === 'with_deadline' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: formData.deadline_type === 'with_deadline' ? '#f0f8ff' : 'white' }}>
                      <input
                        type="radio"
                        name="deadline_type"
                        value="with_deadline"
                        checked={formData.deadline_type === 'with_deadline'}
                        onChange={(e) => setFormData({ ...formData, deadline_type: e.target.value })}
                        style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>With Deadline Date</span>
                    </label>
                  </div>
                </div>

                {/* Deadline Date Input (if with deadline) */}
                {formData.deadline_type === 'with_deadline' && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                      Deadline Date <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.deadline_date}
                      onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: errors.deadline_date ? '2px solid #dc3545' : '2px solid #e9ecef',
                        borderRadius: '10px',
                        fontSize: '1rem',
                        transition: 'all 0.3s ease',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                      onFocus={(e) => {
                        e.target.style.border = '2px solid #1FA8DC';
                        e.target.style.boxShadow = '0 0 0 3px rgba(31, 168, 220, 0.1)';
                      }}
                      onBlur={(e) => {
                        if (!errors.deadline_date) {
                          e.target.style.border = '2px solid #e9ecef';
                          e.target.style.boxShadow = 'none';
                        }
                      }}
                    />
                    {errors.deadline_date && (
                      <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                        {errors.deadline_date}
                      </div>
                    )}
                  </div>
                )}

                {/* Timer Radio */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'left' }}>
                    Timer <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: formData.timer_type === 'no_timer' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: formData.timer_type === 'no_timer' ? '#f0f8ff' : 'white' }}>
                      <input
                        type="radio"
                        name="timer_type"
                        value="no_timer"
                        checked={formData.timer_type === 'no_timer'}
                        onChange={handleTimerTypeChange}
                        style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>No Timer</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: formData.timer_type === 'with_timer' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: formData.timer_type === 'with_timer' ? '#f0f8ff' : 'white' }}>
                      <input
                        type="radio"
                        name="timer_type"
                        value="with_timer"
                        checked={formData.timer_type === 'with_timer'}
                        onChange={handleTimerTypeChange}
                        style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>With Timer</span>
                    </label>
                  </div>
                </div>

                {/* Timer Input (if with timer) */}
                {formData.timer_type === 'with_timer' && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                      Enter time in minutes <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="number"
                      name="timer"
                      min="1"
                      value={formData.timer || ''}
                      onChange={handleInputChange}
                      placeholder="Enter time in minutes"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: errors.timer ? '2px solid #dc3545' : '2px solid #e9ecef',
                        borderRadius: '10px',
                        fontSize: '1rem'
                      }}
                    />
                    {errors.timer && (
                      <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                        {errors.timer}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Questions Content */}
            {activeTab === 'questions' && formData.questions.map((question, qIdx) => (
              <div key={qIdx} className="question-section" style={{ marginBottom: '32px', padding: '20px', border: '2px solid #e9ecef', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <label style={{ fontWeight: '600', fontSize: '1.1rem', textAlign: 'left' }}>
                    Question {qIdx + 1}
                  </label>
                  {formData.questions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeQuestion(qIdx)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Image src="/trash2.svg" alt="Remove" width={18} height={18} style={{ display: 'inline-block' }} />
                      Remove Question
                    </button>
                  )}
                </div>

                {/* Question Image Upload (first) */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                    Question Image
                  </label>
                  <div style={{ fontSize: '0.875rem', color: '#6c757d', marginBottom: '8px' }}>
                    Max size: 10 MB
                  </div>
                  {question.question_picture || imagePreviews[qIdx] ? (
                    <div
                      className="question-image-container"
                      style={{
                        position: 'relative',
                        width: '100%',
                        transition: 'all 0.3s ease'
                      }}
                    >
                      <ZoomableImage
                        src={imagePreviews[qIdx] || `/api/profile-picture/student/${question.question_picture}`}
                        alt="Question"
                      />
                      {/* Trash icon overlay - shown on hover */}
                      <div
                        className="question-image-trash"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveImage(qIdx);
                        }}
                        style={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: 72,
                          height: 72,
                          borderRadius: '50%',
                          background: '#dc3545',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          transition: 'opacity 0.3s ease',
                          zIndex: 100,
                          cursor: 'pointer',
                          pointerEvents: 'none'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.opacity = '1';
                          e.currentTarget.style.pointerEvents = 'auto';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.opacity = '0';
                          e.currentTarget.style.pointerEvents = 'none';
                        }}
                        title="Click to remove image"
                      >
                        <svg
                          width="32"
                          height="32"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </div>
                      {/* Uploading spinner overlay */}
                      {uploadingImages[qIdx] && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 64,
                            height: 64,
                            borderRadius: '50%',
                            background: 'rgba(0, 0, 0, 0.7)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            zIndex: 20
                          }}
                        >
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              border: '4px solid rgba(255, 255, 255, 0.3)',
                              borderTop: '4px solid white',
                              borderRadius: '50%',
                              animation: 'spin 1s linear infinite'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => handleDragOver(e, qIdx)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, qIdx)}
                      style={{
                        border: `2px dashed ${dragOverIndex === qIdx ? '#1FA8DC' : '#e9ecef'}`,
                        borderRadius: '12px',
                        padding: '40px 20px',
                        textAlign: 'center',
                        backgroundColor: dragOverIndex === qIdx ? '#f0f8ff' : 'white',
                        transition: 'all 0.3s ease',
                        cursor: uploadingImages[qIdx] ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <div style={{ marginBottom: '16px' }}>
                        <svg
                          width="48"
                          height="48"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#1FA8DC"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{ margin: '0 auto', display: 'block' }}
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="17 8 12 3 7 8"></polyline>
                          <line x1="12" y1="3" x2="12" y2="15"></line>
                        </svg>
                      </div>
                      <p style={{ 
                        margin: '0 0 12px 0', 
                        fontSize: '1rem', 
                        fontWeight: '500',
                        color: '#333'
                      }}>
                        Drag your file here
                      </p>
                      <p style={{ 
                        margin: '0 0 16px 0', 
                        fontSize: '0.875rem', 
                        color: '#6c757d'
                      }}>
                        or
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(qIdx, file);
                        }}
                        style={{ display: 'none' }}
                        id={`question-image-${qIdx}`}
                        disabled={uploadingImages[qIdx]}
                      />
                      <label
                        htmlFor={`question-image-${qIdx}`}
                        style={{
                          display: 'inline-block',
                          padding: '12px 24px',
                          backgroundColor: uploadingImages[qIdx] ? '#6c757d' : '#1FA8DC',
                          color: 'white',
                          borderRadius: '8px',
                          cursor: uploadingImages[qIdx] ? 'not-allowed' : 'pointer',
                          fontSize: '0.9rem',
                          fontWeight: '600',
                          opacity: uploadingImages[qIdx] ? 0.7 : 1,
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          if (!uploadingImages[qIdx]) {
                            e.target.style.backgroundColor = '#0d5a7a';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!uploadingImages[qIdx]) {
                            e.target.style.backgroundColor = '#1FA8DC';
                          }
                        }}
                      >
                        {uploadingImages[qIdx] ? 'Uploading...' : 'Browse'}
                      </label>
                    </div>
                  )}
                  {errors[`question_${qIdx}_image`] && (
                    <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                      {errors[`question_${qIdx}_image`]}
                    </div>
                  )}
                </div>

                {/* Question Text Input (after image) */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                    Question Text
                  </label>
                  <textarea
                    value={question.question_text || ''}
                    onChange={(e) => handleQuestionChange(qIdx, 'question_text', e.target.value)}
                    placeholder="Enter question text (optional)"
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: errors[`question_${qIdx}_text`] ? '2px solid #dc3545' : '2px solid #e9ecef',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      fontFamily: 'inherit',
                      resize: 'vertical'
                    }}
                  />
                  {errors[`question_${qIdx}_text`] && (
                    <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                      {errors[`question_${qIdx}_text`]}
                    </div>
                  )}
                </div>

                {/* Answers */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'left' }}>
                    Answers
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {question.answers.map((answerLetter, aIdx) => {
                      const isLastAnswer = aIdx === question.answers.length - 1;
                      const hasTrashButton = aIdx >= 2;
                      const showAddButton = isLastAnswer && (aIdx === 1 || hasTrashButton);
                      const answerText = question.answer_texts && question.answer_texts[aIdx] ? question.answer_texts[aIdx] : '';
                      
                      return (
                        <div key={aIdx} className="answer-option-row" style={{ 
                          display: 'flex', 
                          gap: '12px', 
                          alignItems: 'center',
                          padding: '12px',
                          border: '2px solid #e9ecef',
                          borderRadius: '8px',
                          backgroundColor: '#f8f9fa'
                        }}>
                          <div style={{ 
                            minWidth: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#1FA8DC',
                            color: 'white',
                            borderRadius: '6px',
                            fontSize: '1rem',
                            fontWeight: '700'
                          }}>
                            {answerLetter}
                          </div>
                          
                          <input
                            type="text"
                            value={answerText}
                            onChange={(e) => {
                              const newAnswerTexts = [...(question.answer_texts || [])];
                              newAnswerTexts[aIdx] = e.target.value;
                              handleQuestionChange(qIdx, 'answer_texts', newAnswerTexts);
                            }}
                            placeholder={`Option ${answerLetter} text (optional)`}
                            style={{
                              flex: 1,
                              padding: '10px 12px',
                              border: '2px solid #e9ecef',
                              borderRadius: '8px',
                              fontSize: '0.95rem'
                            }}
                          />
                          
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {hasTrashButton && (
                              <button
                                type="button"
                                onClick={() => removeAnswer(qIdx, aIdx)}
                                style={{
                                  padding: '8px 16px',
                                  backgroundColor: '#dc3545',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <Image src="/trash2.svg" alt="Remove" width={18} height={18} style={{ display: 'inline-block' }} />
                                Remove
                              </button>
                            )}
                            {showAddButton && (
                              <button
                                type="button"
                                onClick={() => addAnswer(qIdx)}
                                style={{
                                  padding: '8px 16px',
                                  backgroundColor: '#28a745',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                  fontWeight: '600',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px'
                                }}
                              >
                                <Image src="/plus.svg" alt="Add" width={18} height={18} style={{ display: 'inline-block' }} />
                                Add Option
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Correct Answer Radio */}
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                    Correct Answer <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div className="correct-answer-radio" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {question.answers.map((answerLetter, aIdx) => {
                      const answerText = question.answer_texts && question.answer_texts[aIdx] ? question.answer_texts[aIdx] : '';
                      return (
                        <label key={aIdx} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '12px', borderRadius: '8px', border: question.correct_answer === answerLetter.toLowerCase() ? '2px solid #28a745' : '2px solid #e9ecef', backgroundColor: question.correct_answer === answerLetter.toLowerCase() ? '#f0fff4' : 'white' }}>
                          <input
                            type="radio"
                            name={`correct_answer_${qIdx}`}
                            value={answerLetter.toLowerCase()}
                            checked={question.correct_answer === answerLetter.toLowerCase()}
                            onChange={(e) => handleQuestionChange(qIdx, 'correct_answer', e.target.value)}
                            style={{ marginRight: '12px', width: '20px', height: '20px', cursor: 'pointer' }}
                          />
                          <div style={{
                            minWidth: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#1FA8DC',
                            color: 'white',
                            borderRadius: '6px',
                            fontSize: '1rem',
                            fontWeight: '700',
                            marginRight: '12px'
                          }}>
                            {answerLetter}
                          </div>
                          {answerText && (
                            <span style={{ flex: 1, marginLeft: '8px', fontSize: '0.95rem' }}>
                              {answerText}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                  {errors[`question_${qIdx}_correct`] && (
                    <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                      {errors[`question_${qIdx}_correct`]}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Add Question Button (only show when questions tab is active) */}
            {activeTab === 'questions' && (
              <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={addQuestion}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  <Image src="/plus.svg" alt="Add" width={20} height={20} style={{ display: 'inline-block' }} />
                  Add Question
                </button>
              </div>
            )}

            {/* Error Message */}
            {errors.general && (
              <div style={{
                background: '#fee2e2',
                color: '#991b1b',
                borderRadius: 10,
                padding: 16,
                marginBottom: 24,
                textAlign: 'center',
                fontWeight: 600,
                border: '1.5px solid #fca5a5',
                fontSize: '1.1rem'
              }}>
                {errors.general}
              </div>
            )}

            {/* Submit Button */}
            <div className="submit-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="submit"
                disabled={createHomeworkMutation.isPending || Object.keys(uploadingImages).length > 0}
                style={{
                  padding: '12px 24px',
                  background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: (createHomeworkMutation.isPending || Object.keys(uploadingImages).length > 0) ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  opacity: (createHomeworkMutation.isPending || Object.keys(uploadingImages).length > 0) ? 0.7 : 1
                }}
              >
                {createHomeworkMutation.isPending ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/manage_online_system/homeworks')}
                disabled={createHomeworkMutation.isPending}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: createHomeworkMutation.isPending ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  opacity: createHomeworkMutation.isPending ? 0.7 : 1
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .question-image-container:hover .zoomable-image {
          filter: blur(4px);
        }
        .question-image-container:hover .question-image-trash {
          opacity: 1 !important;
          pointer-events: auto !important;
        }
        @media (max-width: 768px) {
          .page-wrapper {
            padding: 10px 5px !important;
          }
          .page-content {
            margin: 20px auto !important;
            padding: 8px !important;
          }
          .form-container {
            padding: 16px !important;
          }
          .submit-buttons {
            flex-direction: column;
            gap: 10px;
          }
          .submit-buttons button {
            width: 100%;
          }
          .answer-input-row {
            align-items: flex-end !important;
          }
          .answer-buttons {
            margin-top: 0 !important;
          }
        }
        @media (max-width: 480px) {
          .page-wrapper {
            padding: 5px !important;
          }
          .page-content {
            margin: 10px auto !important;
            padding: 5px !important;
          }
          .form-container {
            padding: 12px !important;
          }
          .question-section {
            padding: 16px !important;
            margin-bottom: 20px !important;
          }
          .question-label, .answer-label {
            font-size: 0.9rem;
          }
          input[type="text"], textarea, select {
            font-size: 0.9rem !important;
            padding: 10px 12px !important;
          }
          .upload-image-label {
            font-size: 0.85rem !important;
            padding: 10px 20px !important;
          }
          .correct-answer-radio label {
            padding: 6px !important;
            font-size: 0.9rem;
          }
          .correct-answer-radio span {
            font-size: 0.85rem;
          }
        }
        @media (max-width: 360px) {
          .form-container {
            padding: 10px !important;
          }
          .question-section {
            padding: 12px !important;
          }
          input[type="text"], textarea, select {
            font-size: 0.85rem !important;
            padding: 8px 10px !important;
          }
        }
      `}</style>
    </div>
  );
}

