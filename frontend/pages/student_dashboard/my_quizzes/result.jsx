import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Title from '../../../components/Title';
import apiClient from '../../../lib/axios';
import { useProfile } from '../../../lib/api/auth';
import { useSystemConfig } from '../../../lib/api/system';

export default function QuizResult() {
  const { data: systemConfig } = useSystemConfig();
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';
  
  const router = useRouter();
  const { id } = router.query;
  const [quiz, setQuiz] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [results, setResults] = useState(null);
  const { data: profile } = useProfile();

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
      const diffMs = Math.abs(end - start); // Use absolute value to handle invalid dates
      
      if (diffMs < 0 || isNaN(diffMs)) return null;
      
      const totalSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      return { minutes, seconds };
    } catch (err) {
      console.error('Error calculating time taken:', err);
      return null;
    }
  };

  useEffect(() => {
    if (!id || !profile?.id) {
      if (!id) router.push('/student_dashboard/my_quizzes');
      return;
    }

    const fetchResults = async (retryCount = 0) => {
      try {
        setIsLoading(true);
        
        // Get quiz and saved result from database
        const response = await apiClient.get(`/api/students/${profile.id}/quiz-details?quiz_id=${id}`);
        
        if (response && response.data && response.data.success) {
          const qz = response.data.quiz;
          const savedResult = response.data.result;
          
          if (!qz || !savedResult) {
            console.error('Missing quiz or result data:', { qz: !!qz, savedResult: !!savedResult });
            setIsLoading(false);
            router.push('/student_dashboard/my_quizzes');
            return;
          }
          
          // Validate quiz has questions array
          if (!qz.questions || !Array.isArray(qz.questions) || qz.questions.length === 0) {
            console.error('Quiz missing questions array:', qz);
            setIsLoading(false);
            router.push('/student_dashboard/my_quizzes');
            return;
          }
          
          setQuiz(qz);

          // Get student answers from saved result
          const studentAnswers = savedResult.student_answers || {};

          // Parse result from database: "X / Y" format
          const resultMatch = (savedResult.result || "0 / 0").match(/(\d+)\s*\/\s*(\d+)/);
          const correctCount = resultMatch ? parseInt(resultMatch[1], 10) : 0;
          const totalQuestions = resultMatch ? parseInt(resultMatch[2], 10) : 0;
          
          // Parse percentage from database: "X%" format
          const percentageMatch = (savedResult.percentage || "0%").match(/(\d+)/);
          const percentage = percentageMatch ? parseInt(percentageMatch[1], 10) : 0;
          
          // Get points added from saved result
          const pointsAdded = savedResult.points_added !== undefined && savedResult.points_added !== null 
            ? savedResult.points_added 
            : null;

          // Build question results for display - match by index directly
          const questionResults = [];
          qz.questions.forEach((originalQ, questionIdx) => {
            // Match student answer by index: student_answers["0"] -> questions[0]
            const studentAnswerLetter = studentAnswers[questionIdx.toString()] || studentAnswers[questionIdx];
            const studentAnswer = studentAnswerLetter ? studentAnswerLetter.toUpperCase() : null;
            const correctAnswer = originalQ.correct_answer ? originalQ.correct_answer.toUpperCase() : null;
            const isCorrect = studentAnswer && correctAnswer && studentAnswer === correctAnswer;

            // Handle both 'question' and 'question_text' field names
            const questionText = originalQ.question || originalQ.question_text || '';

            questionResults.push({
              question: questionText,
              selectedAnswer: studentAnswer || 'Not answered',
              correctAnswer: correctAnswer || 'N/A',
              isCorrect
            });
          });
          
          setResults({
            correctCount,
            totalQuestions,
            percentage,
            questionResults,
            savedResult, // Store saved result for date access
            pointsAdded
          });
          
          // Clean up sessionStorage items since data is now saved in database
          // Remove all quiz-related sessionStorage items that were saved during start page
          if (id) {
            sessionStorage.removeItem(`quiz_${id}_answers`);
            sessionStorage.removeItem(`quiz_${id}_selectedAnswers`);
            sessionStorage.removeItem(`quiz_${id}_date_of_start`);
            sessionStorage.removeItem(`quiz_${id}_start_timestamp`);
            sessionStorage.removeItem(`quiz_${id}_date_of_end`);
            sessionStorage.removeItem(`quiz_${id}_timeRemaining`);
          }
          
          setIsLoading(false); // Stop loading after successfully setting results
        } else {
          // Response doesn't have success flag or data structure is unexpected
          console.error('Unexpected response structure:', response);
          setIsLoading(false);
          router.push('/student_dashboard/my_quizzes');
        }
      } catch (err) {
        console.error('Error fetching quiz results:', err);
        
        // If 404 and we haven't retried yet, wait a bit and retry (in case result is still being saved)
        if (err.response?.status === 404 && retryCount < 2) {
          console.log(`Retrying fetch (attempt ${retryCount + 1})...`);
          setTimeout(() => {
            fetchResults(retryCount + 1);
          }, 1000); // Wait 1 second before retry
          return;
        }
        
        // If still 404 after retries, or other error, redirect to quizzes list
        if (err.response?.status === 404) {
          console.log('Quiz result not found, redirecting to quizzes list');
          router.push('/student_dashboard/my_quizzes');
          return;
        }
        
        setIsLoading(false);
      }
    };

    fetchResults();
  }, [id, profile?.id, router]);

  // Result is already saved in database, no need to save again

  if (isLoading || !quiz || !results) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <Title backText="Back" href="/student_dashboard/my_quizzes">Quiz Results</Title>
          
          {/* White Background Container */}
          <div className="results-container" style={{
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
            <p style={{ color: "#6c757d", fontSize: "1rem" }}>Loading results...</p>
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

  return (
    <div className="page-wrapper" style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div className="page-content" style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
        <Title backText="Back" href="/student_dashboard/my_quizzes">Quiz Results</Title>

        {/* White Background Container */}
        <div className="results-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          {/* Score Summary */}
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
                background: results.percentage >= 75
                  ? "linear-gradient(135deg, #28a745 0%, #20c997 100%)"
                  : results.percentage >= 50
                  ? "linear-gradient(135deg, #ffc107 0%, #ff9800 100%)"
                  : "linear-gradient(135deg, #dc3545 0%, #c82333 100%)"
              }}
            >
              {results.percentage}%
            </div>

            <p style={{ fontSize: "1.2rem", color: "#666", marginBottom: "8px" }}>
              You got {results.correctCount} out of {results.totalQuestions} questions correct
              {isScoringEnabled && results.pointsAdded !== null && results.pointsAdded !== undefined && (
                <span style={{ 
                  color: results.pointsAdded >= 0 ? '#28a745' : '#dc3545',
                  fontWeight: 'bold',
                  marginLeft: '8px'
                }}>
                  ({results.pointsAdded >= 0 ? '+' : ''}{results.pointsAdded} pts)
                </span>
              )}
              {results.percentage === 100 ? " 🎉" : ""}
            </p>
            {(() => {
              const savedResult = results.savedResult;
              if (!savedResult || !savedResult.date_of_start || !savedResult.date_of_end) {
                console.log('Missing savedResult or dates:', { savedResult });
                return null;
              }
              
              const timeTaken = calculateTimeTaken(savedResult.date_of_start, savedResult.date_of_end);
              
              if (timeTaken) {
                return (
                  <p style={{ fontSize: "1rem", color: "#888", marginTop: "8px" }}>
                    You took {timeTaken.minutes} minute{timeTaken.minutes !== 1 ? 's' : ''} and {timeTaken.seconds} second{timeTaken.seconds !== 1 ? 's' : ''}.
                  </p>
                );
              } else {
                console.log('Time calculation failed:', { 
                  date_of_start: savedResult.date_of_start, 
                  date_of_end: savedResult.date_of_end 
                });
              }
              return null;
            })()}
          </div>

          {/* Question Results - All Questions in One List */}
          <div style={{
            border: '2px solid #e9ecef',
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px'
          }}>
            <h3 style={{ margin: "0 0 24px 0", color: "#333", fontSize: "1.5rem" }}>
              Question Results
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {results.questionResults.map((result, idx) => (
                <div 
                  key={idx}
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    textAlign: "left",
                    border: result.isCorrect ? "2px solid #28a745" : "2px solid #dc3545",
                    backgroundColor: result.isCorrect ? "#f0fff4" : "#fee2e2",
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <span style={{
                      fontSize: "1.5rem",
                      marginRight: "8px"
                    }}>
                      {result.isCorrect ? "✓" : "✗"}
                    </span>
                    <strong style={{ fontSize: "1.1rem", color: "#333" }}>
                      Question {idx + 1}
                    </strong>
                    <span style={{ marginLeft: "8px", fontSize: "0.9rem" }}>
                      <span style={{ color: result.isCorrect ? "#28a745" : "#dc3545", fontWeight: "600" }}>
                        Your answer: {result.selectedAnswer}
                      </span>
                      {!result.isCorrect && (
                        <span style={{ marginLeft: "12px", color: "#28a745", fontWeight: "600" }}>
                          Correct answer: {result.correctAnswer}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Back Button */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => {
                // Cleanup sessionStorage when going back (in case any items remain)
                if (id) {
                  sessionStorage.removeItem(`quiz_${id}_answers`);
                  sessionStorage.removeItem(`quiz_${id}_selectedAnswers`);
                  sessionStorage.removeItem(`quiz_${id}_date_of_start`);
                  sessionStorage.removeItem(`quiz_${id}_start_timestamp`);
                  sessionStorage.removeItem(`quiz_${id}_date_of_end`);
                  sessionStorage.removeItem(`quiz_${id}_timeRemaining`);
                }
                router.push('/student_dashboard/my_quizzes');
              }}
              style={{
                padding: "12px 24px",
                backgroundColor: "#1FA8DC",
                color: "white",
                border: "none",
                borderRadius: "12px",
                fontSize: "1rem",
                fontWeight: "600",
                cursor: "pointer",
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(31, 168, 220, 0.2)'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#0d5a7a';
                e.target.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#1FA8DC';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Back to Quizzes
            </button>
          </div>
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
          .results-container {
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
          
          .question-results h3 {
            font-size: 1.3rem !important;
            margin-bottom: 20px !important;
          }
          
          .question-result-item {
            padding: 14px !important;
            margin-bottom: 12px !important;
          }
          
          .question-result-header {
            font-size: 1rem !important;
            margin-bottom: 8px !important;
          }
          
          .question-result-text {
            font-size: 0.95rem !important;
            margin: 8px 0 !important;
          }
          
          .answer-info {
            font-size: 0.85rem !important;
            margin-top: 8px !important;
          }
        }
        
        @media (max-width: 480px) {
          .page-wrapper {
            padding: 5px;
          }
          .page-content {
            margin: 10px auto;
          }
          .results-container {
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
          
          .question-results {
            padding: 16px !important;
          }
          
          .question-results h3 {
            font-size: 1.1rem !important;
            margin-bottom: 16px !important;
          }
          
          .question-result-item {
            padding: 12px !important;
            margin-bottom: 10px !important;
            border-radius: 8px !important;
          }
          
          .question-result-header {
            font-size: 0.95rem !important;
            margin-bottom: 6px !important;
            flex-wrap: wrap !important;
          }
          
          .question-result-text {
            font-size: 0.9rem !important;
            margin: 6px 0 !important;
            line-height: 1.5 !important;
          }
          
          .answer-info {
            font-size: 0.8rem !important;
            margin-top: 6px !important;
            flex-direction: column !important;
            gap: 4px !important;
          }
          
          .back-button {
            padding: 10px 20px !important;
            font-size: 0.9rem !important;
          }
        }
        
        @media (max-width: 360px) {
          .results-container {
            padding: 10px;
          }
          
          .score-circle {
            width: 90px !important;
            height: 90px !important;
            font-size: 1.6rem !important;
          }
          
          .question-result-item {
            padding: 10px !important;
          }
          
          .question-result-header {
            font-size: 0.9rem !important;
          }
          
          .question-result-text {
            font-size: 0.85rem !important;
          }
        }
      `}</style>
    </div>
  );
}

