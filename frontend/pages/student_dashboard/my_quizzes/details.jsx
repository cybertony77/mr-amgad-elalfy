import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from '../../../components/Title';
import apiClient from '../../../lib/axios';
import { useProfile } from '../../../lib/api/auth';
import NeedHelp from '../../../components/NeedHelp';
import ZoomableImage from '../../../components/ZoomableImage';

export default function QuizDetails() {
  const router = useRouter();
  const { id } = router.query;
  const [quiz, setQuiz] = useState(null);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [questionImages, setQuestionImages] = useState({});
  const { data: profile } = useProfile();

  // Redirect if no ID is provided
  useEffect(() => {
    if (router.isReady && !id) {
      router.replace('/student_dashboard/my_quizzes');
      return;
    }
  }, [router.isReady, id, router]);

  useEffect(() => {
    if (!id || !profile?.id) return;

    const fetchDetails = async () => {
      try {
        setIsLoading(true);
        
        // Get quiz and saved result
        const response = await apiClient.get(`/api/students/${profile.id}/quiz-details?quiz_id=${id}`);
        if (response.data.success) {
          setQuiz(response.data.quiz);
          setResult(response.data.result);
        } else {
          // Quiz not found or no result - redirect immediately
          router.replace('/student_dashboard/my_quizzes');
          return;
        }
      } catch (err) {
        // Handle 404 or 403 silently (expected when quiz doesn't exist)
        if (err.response?.status === 404 || err.response?.status === 403) {
          // Silently redirect for expected errors
          router.replace('/student_dashboard/my_quizzes');
          return;
        }
        // Log unexpected errors
        console.error('Error fetching details:', err);
        router.replace('/student_dashboard/my_quizzes');
        return;
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [id, profile?.id, router]);

  // Fetch question images
  useEffect(() => {
    if (!quiz || !quiz.questions) return;

    const fetchImages = async () => {
      const imagePromises = {};
      
      for (const question of quiz.questions) {
        const imageField = question.question_image || question.question_picture;
        if (imageField) {
          try {
            const response = await apiClient.get(`/api/quizzes/image?public_id=${imageField}`);
            if (response.data.url) {
              // Use question_picture public_id as key (unique per question)
              imagePromises[imageField] = response.data.url;
            }
          } catch (err) {
            console.error(`Error fetching image for question: ${question.question}`, err);
          }
        }
      }
      
      setQuestionImages(imagePromises);
    };

    fetchImages();
  }, [quiz]);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 1000, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <Title backText="Back" href="/student_dashboard/my_quizzes">Quiz Details</Title>
          
          <div className="details-container" style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            textAlign: 'center'
          }}>
            <div style={{
              width: "50px",
              height: "50px",
              border: "4px solid rgba(31, 168, 220, 0.2)",
              borderTop: "4px solid #1FA8DC",
              borderRadius: "50%",
              margin: "0 auto 20px",
              animation: "spin 1s linear infinite"
            }} />
            <p style={{ color: "#6c757d", fontSize: "1rem" }}>Loading details...</p>
            <style jsx>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
          </div>
        </div>
      </div>
    );
  }

  if (!quiz || !result) {
    return null;
  }

  // Parse date string and calculate time difference
  const calculateTimeTaken = (dateOfStart, dateOfEnd) => {
    if (!dateOfStart || !dateOfEnd) return null;

    try {
      // Parse date strings: "12/23/2025 at 10:02:32 PM"
      const parseDate = (dateStr) => {
        const [datePart, timePart] = dateStr.split(' at ');
        const [month, day, year] = datePart.split('/');
        const [time, ampm] = timePart.split(' ');
        const [hours, minutes, seconds] = time.split(':');
        
        let hour24 = parseInt(hours);
        if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
        if (ampm === 'AM' && hour24 === 12) hour24 = 0;
        
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour24, parseInt(minutes), parseInt(seconds));
      };

      const start = parseDate(dateOfStart);
      const end = parseDate(dateOfEnd);
      const diffMs = end - start;
      
      if (diffMs < 0) return null; // Invalid if end is before start
      
      const totalSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      return { minutes, seconds };
    } catch (err) {
      console.error('Error calculating time taken:', err);
      return null;
    }
  };

  // Parse student answers from saved result
  const studentAnswers = result.student_answers || {};

  // Calculate statistics and build question results - match by index directly
  let correctCount = 0;
  let unansweredCount = 0;
  const questionResults = [];

  // Process all questions from quiz - match student answers by index
  quiz.questions.forEach((fullQuestion, questionIdx) => {
    // Match student answer by index: student_answers["0"] -> questions[0]
    const studentAnswerLetter = studentAnswers[questionIdx.toString()] || studentAnswers[questionIdx];
    const studentAnswer = studentAnswerLetter ? studentAnswerLetter.toUpperCase() : null;
    const correctAnswer = fullQuestion.correct_answer ? fullQuestion.correct_answer.toUpperCase() : null;
    const isCorrect = studentAnswer && correctAnswer && studentAnswer === correctAnswer;
    const isAnswered = studentAnswer !== null && studentAnswer !== undefined;

    if (isCorrect) correctCount++;
    if (!isAnswered) unansweredCount++;

    questionResults.push({
      question: fullQuestion,
      studentAnswer: studentAnswer || 'Not answered',
      correctAnswer: correctAnswer || 'N/A',
      isCorrect,
      isAnswered,
      wasShown: true
    });
  });

  // Use the number of questions from quiz
  const totalQuestions = quiz.questions.length;
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  
  // Ensure values are valid numbers
  const displayCorrectCount = typeof correctCount === 'number' ? correctCount : 0;
  const displayTotalQuestions = typeof totalQuestions === 'number' && totalQuestions > 0 ? totalQuestions : quiz.questions.length;

  return (
    <div className="page-wrapper" style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div className="page-content" style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
        <Title backText="Back" href="/student_dashboard/my_quizzes">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/details.svg" alt="Details" width={32} height={32} />
            Quiz Details
          </div>
        </Title>

        <div className="details-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '15px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          {/* Score Summary - Circular Percentage Display */}
          <div style={{
            border: '2px solid #e9ecef',
            borderRadius: '12px',
            padding: '32px',
            marginBottom: '24px',
            textAlign: 'center',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#1FA8DC';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(31, 168, 220, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#e9ecef';
            e.currentTarget.style.boxShadow = 'none';
          }}
          >
            <h2 style={{ margin: "0 0 24px 0", color: "#333", fontSize: "1.8rem" }}>
              {quiz.lesson_name}
            </h2>
            
            <div 
              style={{
                width: "150px",
                height: "150px",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 24px",
                fontSize: "2.5rem",
                fontWeight: "700",
                color: "white",
                background: percentage >= 75
                  ? "linear-gradient(135deg, #28a745 0%, #20c997 100%)"
                  : percentage >= 50
                  ? "linear-gradient(135deg, #ffc107 0%, #ff9800 100%)"
                  : "linear-gradient(135deg, #dc3545 0%, #c82333 100%)"
              }}
            >
              {percentage}%
            </div>

            <p style={{ fontSize: "1.2rem", color: "#666", marginBottom: "8px" }}>
              You got {displayCorrectCount} out of {displayTotalQuestions} questions correct{percentage === 100 ? " 🎉" : ""}
            </p>
            {(() => {
              const timeTaken = calculateTimeTaken(result.date_of_start, result.date_of_end);
              
              if (timeTaken) {
                return (
                  <p style={{ fontSize: "1rem", color: "#888", marginTop: "8px" }}>
                    You took {timeTaken.minutes} minute{timeTaken.minutes !== 1 ? 's' : ''} and {timeTaken.seconds} second{timeTaken.seconds !== 1 ? 's' : ''}.
                  </p>
                );
              }
              return null;
            })()}
          </div>

          {/* Questions List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {questionResults.map((item, idx) => {
              const question = item.question;
              const answerOptions = ['A', 'B', 'C', 'D'];
              const correctAnswerIdx = answerOptions.indexOf(item.correctAnswer);
              // Convert student answer letter to index (e.g., "A" -> 0, "B" -> 1)
              const studentAnswerIdx = item.isAnswered && item.studentAnswer !== 'Not answered' 
                ? answerOptions.indexOf(item.studentAnswer.toUpperCase()) 
                : -1;

              return (
                <div
                  key={idx}
                  style={{
                    borderTop: '2px solid #e9ecef',
                    padding: '15px 0px',
                    backgroundColor: '#fff'
                  }}
                >
                  {/* Question Number and Text */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: '600',
                      marginBottom: '12px',
                      color: '#212529'
                    }}>
                      Question {idx + 1}
                    </div>
                    
                    {/* Question Image (if exists) */}
                    {(question.question_image || question.question_picture) && questionImages[question.question_image || question.question_picture] && (
                      <div style={{ marginBottom: '16px' }}>
                        <ZoomableImage
                          src={questionImages[question.question_image || question.question_picture]}
                          alt="Question"
                        />
                      </div>
                    )}

                    {/* Question Text (if exists) */}
                    {question.question_text && question.question_text.trim() !== '' && (
                      <div style={{
                        fontSize: '1rem',
                        color: '#495057',
                        marginBottom: '16px',
                        lineHeight: '1.6',
                        padding: '12px 16px',
                        backgroundColor: '#f8f9fa',
                        borderRadius: '8px',
                        border: '2px solid #e9ecef'
                      }}>
                        {question.question_text}
                      </div>
                    )}
                  </div>

                  {/* Answers */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {question.answers.map((answer, ansIdx) => {
                      const isCorrect = ansIdx === correctAnswerIdx;
                      const isSelected = ansIdx === studentAnswerIdx;
                      const isWrong = isSelected && !isCorrect;
                      const showCorrect = !item.isAnswered || isCorrect;

                      let answerStyle = {
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '2px solid #e9ecef',
                        backgroundColor: '#fff',
                        fontSize: '0.95rem',
                        color: '#495057',
                        transition: 'all 0.2s ease'
                      };

                      if (isCorrect) {
                        answerStyle = {
                          ...answerStyle,
                          borderColor: '#28a745',
                          backgroundColor: '#d4edda',
                          color: '#155724',
                          fontWeight: '600'
                        };
                      } else if (isWrong) {
                        answerStyle = {
                          ...answerStyle,
                          borderColor: '#dc3545',
                          backgroundColor: '#f8d7da',
                          color: '#721c24'
                        };
                      }

                      return (
                        <div key={ansIdx} style={{
                          ...answerStyle,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px'
                        }}>
                          <div style={{
                            minWidth: '32px',
                            height: '32px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isCorrect ? '#28a745' : isWrong ? '#dc3545' : '#1fa8dc',
                            color: 'white',
                            borderRadius: '6px',
                            fontSize: '1rem',
                            fontWeight: '700'
                          }}>
                            {answer}
                          </div>
                          {question.answer_texts && question.answer_texts[ansIdx] && (
                            <span style={{ flex: 1, fontSize: '0.95rem' }}>
                              {question.answer_texts[ansIdx]}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Not Answered Indicator */}
                  {!item.isAnswered && (
                    <div style={{
                      marginTop: '12px',
                      padding: '8px 12px',
                      backgroundColor: '#fff3cd',
                      border: '1px solid #ffc107',
                      borderRadius: '6px',
                      color: '#856404',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}>
                      ⚠️ This question was not answered
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Help Text */}
          <NeedHelp style={{ padding: "20px", borderTop: "1px solid #e9ecef" }} />
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .page-wrapper {
            padding: 10px 5px;
          }
          .page-content {
            margin: 20px auto;
          }
          .details-container {
            padding: 16px;
          }
          
          .score-summary h2 {
            font-size: 1.5rem !important;
            margin-bottom: 20px !important;
          }
          
          .score-circle {
            width: 120px !important;
            height: 120px !important;
            font-size: 2rem !important;
            margin-bottom: 20px !important;
          }
          
          .score-text {
            font-size: 1rem !important;
            margin-bottom: 6px !important;
          }
          
          .time-text {
            font-size: 0.9rem !important;
          }
          
          .question-item {
            padding: 16px !important;
            margin-bottom: 16px !important;
          }
          
          .question-header {
            font-size: 1rem !important;
            margin-bottom: 10px !important;
          }
          
          .question-image {
            max-height: 800px !important;
            margin-bottom: 12px !important;
          }
          
          .question-text {
            font-size: 0.95rem !important;
            margin-bottom: 12px !important;
          }
          
          .answer-option {
            padding: 8px 12px !important;
            font-size: 0.9rem !important;
            margin-bottom: 8px !important;
          }
        }
        
        @media (max-width: 480px) {
          .page-wrapper {
            padding: 5px;
          }
          .page-content {
            margin: 10px auto;
          }
          .details-container {
            padding: 12px;
          }
          
          .score-summary {
            padding: 20px !important;
          }
          
          .score-summary h2 {
            font-size: 1.3rem !important;
            margin-bottom: 16px !important;
          }
          
          .score-circle {
            width: 100px !important;
            height: 100px !important;
            font-size: 1.8rem !important;
            margin-bottom: 16px !important;
          }
          
          .score-text {
            font-size: 0.95rem !important;
            margin-bottom: 4px !important;
          }
          
          .time-text {
            font-size: 0.85rem !important;
          }
          
          .question-item {
            padding: 12px !important;
            margin-bottom: 12px !important;
            border-radius: 10px !important;
          }
          
          .question-header {
            font-size: 0.95rem !important;
            margin-bottom: 8px !important;
          }
          
          .question-image {
            max-height: 800px !important;
            margin-bottom: 10px !important;
          }
          
          .question-text {
            font-size: 0.9rem !important;
            margin-bottom: 10px !important;
            line-height: 1.5 !important;
          }
          
          .answer-option {
            padding: 8px 12px !important;
            font-size: 0.85rem !important;
            margin-bottom: 6px !important;
          }
          
          .help-text {
            padding: 16px !important;
            font-size: 0.85rem !important;
            margin-top: 30px !important;
          }
        }
        
        @media (max-width: 360px) {
          .score-circle {
            width: 90px !important;
            height: 90px !important;
            font-size: 1.6rem !important;
          }
          
          .question-item {
            padding: 10px !important;
          }
          
          .answer-option {
            padding: 6px 10px !important;
            font-size: 0.8rem !important;
          }
        }
      `}</style>
    </div>
  );
}

