import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import apiClient from '../../../lib/axios';
import { useProfile } from '../../../lib/api/auth';
import ZoomableImage from '../../../components/ZoomableImage';

export default function HomeworkStart() {
  const router = useRouter();
  const { id } = router.query;
  const [homework, setHomework] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [questions, setQuestions] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const timerRef = useRef(null);
  const [imageUrls, setImageUrls] = useState({});
  const [showWarning, setShowWarning] = useState(false);
  const warningTimeoutRef = useRef(null);
  const warningShownRef = useRef(false);
  const isSubmittingRef = useRef(false); // Prevent duplicate submissions
  const startTimeRef = useRef(null); // Store start time as timestamp (milliseconds)
  const { data: profile } = useProfile();

  // Format date as MM/DD/YYYY at hour:minute:second AM/PM
  const formatDate = (date) => {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const hoursStr = String(hours).padStart(2, '0');
    
    return `${month}/${day}/${year} at ${hoursStr}:${minutes}:${seconds} ${ampm}`;
  };

  // Redirect if no ID is provided
  useEffect(() => {
    if (router.isReady && !id) {
      router.replace('/student_dashboard/my_homeworks');
      return;
    }
  }, [router.isReady, id, router]);

  // Check if homework is already completed and fetch homework data
  useEffect(() => {
    if (!id || !profile?.id) return;

    const fetchHomework = async () => {
      try {
        setIsLoading(true);
        
        // First, check if student has already completed this homework
        try {
          const checkResponse = await apiClient.get(`/api/students/${profile.id}/check-homework?homework_id=${id}`);
          if (checkResponse.data.success && checkResponse.data.hasResult) {
            // Already completed - redirect with error message
            router.push({
              pathname: '/student_dashboard/my_homeworks',
              query: { error: 'You already answered this homework' }
            });
            return;
          }
        } catch (checkErr) {
          // If check fails, continue anyway (might be first time)
          console.log('Could not check homework status:', checkErr);
        }
        
        // Get student version (without correct answers)
        const studentResponse = await apiClient.get('/api/homeworks/student');
        
        if (studentResponse.data.success) {
          const hw = studentResponse.data.homeworks.find(h => h._id === id);
          
          if (!hw) {
            router.push('/student_dashboard/my_homeworks');
            return;
          }
          
          setHomework(hw);
          
          // Store start time as timestamp (milliseconds) - only set once
          if (!startTimeRef.current) {
            const startTimestamp = Date.now();
            startTimeRef.current = startTimestamp;
            // Also store formatted date for display/backward compatibility
            const startDate = formatDate(new Date(startTimestamp));
            sessionStorage.setItem(`homework_${id}_date_of_start`, startDate);
            sessionStorage.setItem(`homework_${id}_start_timestamp`, startTimestamp.toString());
          } else {
            // Restore from sessionStorage if exists
            const savedTimestamp = sessionStorage.getItem(`homework_${id}_start_timestamp`);
            if (savedTimestamp) {
              startTimeRef.current = parseInt(savedTimestamp, 10);
            }
          }
          
          // Initialize timer if exists
          if (hw.timer) {
            const timerKey = `homework_${id}_timeRemaining`;
            const savedTime = sessionStorage.getItem(timerKey);
            
            if (savedTime !== null) {
              // Restore timer from sessionStorage
              const savedSeconds = parseInt(savedTime, 10);
              if (savedSeconds > 0) {
                setTimeRemaining(savedSeconds);
              } else {
                // Timer expired, use full timer
                const totalSeconds = hw.timer * 60;
                setTimeRemaining(totalSeconds);
              }
            } else {
              // First time, start with full timer
              const totalSeconds = hw.timer * 60;
              setTimeRemaining(totalSeconds);
            }
          }
          
          // Load selected answers from sessionStorage if exists
          const answersKey = `homework_${id}_selectedAnswers`;
          const savedAnswers = sessionStorage.getItem(answersKey);
          if (savedAnswers) {
            try {
              const parsedAnswers = JSON.parse(savedAnswers);
              setSelectedAnswers(parsedAnswers);
            } catch (err) {
              console.error('Error parsing saved answers:', err);
            }
          }

          // Display questions in their original order (no shuffling)
          setQuestions([...hw.questions]);
          
          // Load image URLs - map by question_picture public_id (unique per question)
          const urlPromises = hw.questions.map(async (q, index) => {
            if (q.question_picture) {
              try {
                const imgResponse = await apiClient.get(`/api/homeworks/image?public_id=${q.question_picture}`);
                if (imgResponse.data?.url) {
                  // Use question_picture public_id as key (unique per question)
                  const key = q.question_picture;
                  setImageUrls(prev => ({ ...prev, [key]: imgResponse.data.url }));
                }
              } catch (err) {
                console.error(`Failed to load image for question:`, err);
              }
            }
          });
          await Promise.all(urlPromises);
        }
      } catch (err) {
        console.error('Error fetching homework:', err);
        router.push('/student_dashboard/my_homeworks');
      } finally {
        setIsLoading(false);
      }
    };

    fetchHomework();
  }, [id, profile?.id, router]);

  // Prevent page refresh warning (but allow refresh - timer will restore from sessionStorage)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Warning message (custom message won't show in modern browsers, but still triggers confirmation)
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timeRemaining === null || timeRemaining <= 0) return;

      const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          // Time's up - auto submit
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          // Clear sessionStorage
          if (id) {
            sessionStorage.removeItem(`homework_${id}_timeRemaining`);
            sessionStorage.removeItem(`homework_${id}_selectedAnswers`);
            sessionStorage.removeItem(`homework_${id}_date_of_start`);
            sessionStorage.removeItem(`homework_${id}_start_timestamp`);
          }
          // Save result and redirect (only if not already submitting)
          if (!isSubmittingRef.current) {
            saveResultAndRedirect();
          }
          return 0;
        }
        const newTime = prev - 1;
        // Save timer to sessionStorage every second
        if (id) {
          sessionStorage.setItem(`homework_${id}_timeRemaining`, newTime.toString());
        }
        return newTime;
      });
    }, 1000);

    timerRef.current = interval;
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [timeRemaining, id, selectedAnswers, questions, router, profile, homework]);

  // Prevent page refresh warning (but allow refresh - timer will restore from sessionStorage)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Warning message (custom message won't show in modern browsers, but still triggers confirmation)
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Show warning when less than 1 minute left
  useEffect(() => {
    if (timeRemaining !== null && timeRemaining < 60 && timeRemaining > 0) {
      // Only show warning once when it first goes below 60 seconds
      if (!warningShownRef.current) {
        warningShownRef.current = true;
        setShowWarning(true);
        
        // Hide warning after 6 seconds from when it first appears
        warningTimeoutRef.current = setTimeout(() => {
          setShowWarning(false);
          warningTimeoutRef.current = null;
        }, 6000);
      }
    } else if (timeRemaining !== null && timeRemaining >= 60) {
      // Reset the flag when time goes back above 60 (shouldn't happen, but just in case)
      warningShownRef.current = false;
      setShowWarning(false);
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
        warningTimeoutRef.current = null;
      }
    }

    // Don't clear timeout in cleanup - let it run to completion
    return () => {
      // Only clear if we're resetting (time >= 60), not on every render
    };
  }, [timeRemaining]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleAnswerSelect = (questionIndex, answerLetter) => {
    // answerLetter is now directly the letter (A, B, C, D) from the answers array
    setSelectedAnswers(prev => {
      const newAnswers = {
        ...prev,
        [questionIndex]: answerLetter.toLowerCase() // Store as lowercase for consistency
      };
      // Save selected answers to sessionStorage
      if (id) {
        sessionStorage.setItem(`homework_${id}_selectedAnswers`, JSON.stringify(newAnswers));
      }
      return newAnswers;
    });
  };

  // Answers are now already letters (A, B, C, D), so we don't need this function
  // But keeping for compatibility with existing code
  const getAnswerLetter = (index) => {
    return String.fromCharCode(65 + index); // A, B, C, etc.
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const saveResultAndRedirect = async () => {
    // Prevent duplicate submissions
    if (isSubmittingRef.current) {
      return;
    }
    
    if (!profile?.id || !homework) {
      router.push('/student_dashboard/my_homeworks');
      return;
    }

    // Mark as submitting to prevent duplicate calls
    isSubmittingRef.current = true;

    try {
      // Fetch full homework data with correct answers for validation
      const fullHomeworkResponse = await apiClient.get(`/api/homeworks/result?id=${id}`);
      const fullHomework = fullHomeworkResponse.data.homework;
      
      if (!fullHomework) {
        console.error('Could not fetch full homework data');
        router.push('/student_dashboard/my_homeworks');
        return;
      }

      // Calculate results - match answers by index directly to questions array
      let correctCount = 0;
      const totalQuestions = questions.length;
      
      questions.forEach((questionItem, idx) => {
        // Match by index: questions[idx] corresponds to selectedAnswers[idx]
        const originalQ = fullHomework.questions[idx];
        
        if (originalQ && originalQ.correct_answer) {
          const selectedAnswer = selectedAnswers[idx];
          if (selectedAnswer !== undefined && selectedAnswer !== null) {
            // selectedAnswer is already a letter (lowercase) like "a", "b", "c", "d"
            const correctAnswer = originalQ.correct_answer.toLowerCase();
            const isCorrect = selectedAnswer === correctAnswer;
            
            if (isCorrect) correctCount++;
          }
        }
      });

      const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

      // Format student_answers as object with indices as keys
      const studentAnswersObj = {};
      Object.keys(selectedAnswers).forEach((idx) => {
        const answerLetter = selectedAnswers[idx];
        // answerLetter is already a lowercase letter (a, b, c, d)
        if (answerLetter !== undefined && answerLetter !== null) {
          studentAnswersObj[idx] = answerLetter;
        }
      });

      // Get dates - ensure start time is always before end time
      let startTimestamp = startTimeRef.current;
      
      // Fallback: try to get from sessionStorage if ref is null
      if (!startTimestamp) {
        const savedTimestamp = sessionStorage.getItem(`homework_${id}_start_timestamp`);
        if (savedTimestamp) {
          startTimestamp = parseInt(savedTimestamp, 10);
        } else {
          // Last resort: use current time minus 1 second to ensure it's different
          startTimestamp = Date.now() - 1000;
        }
      }
      
      // Ensure end time is at least 1 second after start time
      const endTimestamp = Math.max(Date.now(), startTimestamp + 1000);
      
      const startDate = formatDate(new Date(startTimestamp));
      const endDate = formatDate(new Date(endTimestamp));
      sessionStorage.setItem(`homework_${id}_date_of_end`, endDate);

      // Calculate score for homework with degree (check for previous result to reverse)
      // IMPORTANT: Calculate score BEFORE saving result so we can include points_added
      let pointsAdded = null;
      try {
        // Get previous homework result percentage from history
        let previousPercentage = null;
        const weekNum = fullHomework.week !== undefined && fullHomework.week !== null ? fullHomework.week : null;
        
        try {
          const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
            studentId: profile.id,
            type: 'homework',
            week: weekNum
          });
          
          if (historyResponse.data.found && historyResponse.data.history) {
            const lastHistory = historyResponse.data.history;
            // Only use history if it's homework with degree (has percentage)
            if (lastHistory.data?.percentage !== undefined) {
              previousPercentage = lastHistory.data.percentage;
            }
          }
        } catch (historyErr) {
          console.error('Error getting homework history, checking online_homeworks:', historyErr);
          // Fallback: check online_homeworks
          const studentResponse = await apiClient.get(`/api/students/${profile.id}`);
          if (studentResponse.data && studentResponse.data.online_homeworks) {
            const previousResult = studentResponse.data.online_homeworks.find(
              ohw => {
                const hwIdStr = ohw.homework_id ? String(ohw.homework_id) : null;
                const fullHwIdStr = fullHomework._id.toString();
                return hwIdStr === fullHwIdStr;
              }
            );
            if (previousResult && previousResult.percentage) {
              // Extract percentage from "X%" format
              const prevPercentageStr = String(previousResult.percentage).replace('%', '');
              previousPercentage = parseInt(prevPercentageStr, 10);
            }
          }
        }
        
        const scoringResponse = await apiClient.post('/api/scoring/calculate', {
          studentId: profile.id,
          type: 'homework',
          week: weekNum,
          data: { percentage, previousPercentage }
        });
        
        // Get points added from scoring response
        if (scoringResponse.data && scoringResponse.data.pointsAdded !== undefined) {
          pointsAdded = scoringResponse.data.pointsAdded;
        }
      } catch (err) {
        console.error('Error calculating homework score:', err);
      }

      // Save result to database (no questions_order needed - use homework_id to fetch questions)
      // Now pointsAdded is calculated and can be included
      const saveResponse = await apiClient.post(`/api/students/${profile.id}/homework-result`, {
        homework_id: fullHomework._id.toString(),
        week: fullHomework.week !== undefined && fullHomework.week !== null ? fullHomework.week : null,
        percentage: percentage,
        result: `${correctCount} / ${totalQuestions}`,
        student_answers: studentAnswersObj,
        date_of_start: startDate,
        date_of_end: endDate,
        points_added: pointsAdded
      });

      // Verify the result was saved successfully
      if (!saveResponse.data || !saveResponse.data.success) {
        console.error('Failed to save homework result:', saveResponse.data);
        throw new Error('Failed to save homework result');
      }

      // Store in sessionStorage for backward compatibility
      sessionStorage.setItem(`homework_${id}_answers`, JSON.stringify(selectedAnswers));

      // Small delay to ensure database write is complete before redirecting
      // This helps prevent race conditions where the result page loads before the save is visible
      await new Promise(resolve => setTimeout(resolve, 500));

      // Redirect to result page
      router.push(`/student_dashboard/my_homeworks/result?id=${id}`);
    } catch (err) {
      console.error('Error saving homework result:', err);
      // Still redirect even if save fails
      router.push(`/student_dashboard/my_homeworks/result?id=${id}`);
    } finally {
      // Reset the flag after a delay to allow navigation
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1000);
    }
  };

  const handleSubmit = async () => {
    // Prevent duplicate submissions
    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsSubmitting(true);
    try {
      await saveResultAndRedirect();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !homework) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{
          background: "rgba(255, 255, 255, 0.95)",
          borderRadius: "16px",
          padding: "40px",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
        }}>
          <p style={{ color: "#666", fontSize: "1rem", marginBottom: "20px" }}>Loading...</p>
          <div style={{
            width: "50px",
            height: "50px",
            border: "4px solid rgba(31, 168, 220, 0.2)",
            borderTop: "4px solid #1FA8DC",
            borderRadius: "50%",
            margin: "0 auto",
            animation: "spin 1s linear infinite"
          }} />
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) {
    return <div>No questions available</div>;
  }

  const isFirstQuestion = currentQuestionIndex === 0;
  const isLastQuestion = currentQuestionIndex === questions.length - 1;
  const questionNumber = currentQuestionIndex + 1;
  const totalQuestions = questions.length;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      padding: "20px 5px 20px 5px",
    }}>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Timer at top center */}
      {homework.timer && timeRemaining !== null && (
        <div className="timer-container" style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "20px 0",
          marginBottom: "20px"
        }}>
          <div className="timer-display" style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "1.5rem",
            fontWeight: "600",
            color: timeRemaining < 60 ? "#dc3545" : "#333",
            background: "#f8f9fa",
            padding: "12px 24px",
            borderRadius: "12px",
            border: "2px solid #e9ecef"
          }}>
            <Image 
              src="/clock.svg" 
              alt="Timer" 
              width={30} 
              height={30}
              style={{ 
                filter: timeRemaining < 60 ? "brightness(0) saturate(100%) invert(27%) sepia(95%) saturate(1352%) hue-rotate(331deg) brightness(93%) contrast(86%)" : "none"
              }}
            />
            {formatTime(timeRemaining)}
          </div>
          
          {/* Warning message when less than 1 minute */}
          {showWarning && timeRemaining < 60 && (
            <div className="warning-message" style={{
              marginTop: "12px",
              padding: "10px 20px",
              background: "#fff3cd",
              color: "#856404",
              borderRadius: "8px",
              border: "1px solid #ffc107",
              fontSize: "0.95rem",
              fontWeight: "600",
              animation: "fadeIn 0.3s ease-in"
            }}>
              Less than 1 minute left. Hurry up!
            </div>
          )}
        </div>
      )}

      {/* Question and Navigation Container */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        width: "100%"
      }}>
        {/* Question Container */}
        <div className="question-container" style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "20px 0",
          overflow: "auto",
          maxWidth: "900px",
          width: "100%",
          margin: "0 auto"
        }}>
          <div className="question-card" style={{
            background: "linear-gradient(135deg,rgb(63, 58, 58) 0%,rgb(87, 81, 81) 100%)",
            borderRadius: "20px",
            padding: "40px",
            width: "100%",
            maxWidth: "850px",
            boxShadow: "0 8px 32px rgba(31, 168, 220, 0.15)",
            border: "2px solid #e9ecef",
            marginBottom: "24px"
          }}>
          {/* Question Number */}
          <div className="question-number" style={{ 
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            marginBottom: "20px"
          }}>
            <span style={{
              background: "linear-gradient(135deg, #1FA8DC 0%, #0d5a7a 100%)",
              color: "white",
              padding: "8px 16px",
              borderRadius: "20px",
              fontSize: "0.85rem",
              fontWeight: "700",
              boxShadow: "0 4px 12px rgba(31, 168, 220, 0.3)"
            }}>
              Question {questionNumber} of {totalQuestions}
            </span>
          </div>
          
          {/* Question Image (if exists) */}
          {currentQuestion.question_picture && imageUrls[currentQuestion.question_picture] && (
            <div style={{ marginBottom: "24px" }}>
              <ZoomableImage
                key={`question-${currentQuestionIndex}-${currentQuestion.question_picture}`}
                src={imageUrls[currentQuestion.question_picture]}
                alt="Question Image"
              />
            </div>
          )}

          {/* Question Text (if exists) */}
          {currentQuestion.question_text && currentQuestion.question_text.trim() !== '' && (
            <div style={{
              marginBottom: "24px",
              padding: "16px 20px",
              backgroundColor: "#f8f9fa",
              borderRadius: "12px",
              border: "2px solid #e9ecef",
              fontSize: "1.1rem",
              lineHeight: "1.6",
              color: "#212529"
            }}>
              {currentQuestion.question_text}
            </div>
          )}

          {/* Answers */}
          <div style={{ 
            width: "100%",
            marginBottom: "20px"
          }}>
            {currentQuestion.answers.map((answer, aIdx) => {
              // answer is now a letter like "A", "B", "C", "D"
              const isSelected = selectedAnswers[currentQuestionIndex] === answer.toLowerCase();
              
              return (
                <label
                  key={aIdx}
                  className="answer-option"
                  onClick={() => handleAnswerSelect(currentQuestionIndex, answer)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 16px",
                    marginBottom: "10px",
                    borderRadius: "12px",
                    border: isSelected ? "2px solid #1fa8dc" : "2px solid #e9ecef",
                    backgroundColor: isSelected ? "linear-gradient(135deg, #f0fff4 0%, #e8f5e9 100%)" : "#fff",
                    background: isSelected ? "linear-gradient(135deg, #f0fff4 0%, #e8f5e9 100%)" : "#fff",
                    cursor: "pointer",
                    boxShadow: isSelected ? "0 4px 12px rgba(40, 167, 69, 0.2)" : "0 2px 8px rgba(0, 0, 0, 0.05)"
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = "#1FA8DC";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(31, 168, 220, 0.15)";
                      e.currentTarget.style.transform = "translateX(4px)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.borderColor = "#e9ecef";
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.05)";
                      e.currentTarget.style.transform = "translateX(0)";
                    }
                  }}
                >
                  <input
                    type="radio"
                    name={`question_${currentQuestionIndex}`}
                    checked={isSelected}
                    onChange={() => handleAnswerSelect(currentQuestionIndex, answer)}
                    style={{
                      marginRight: "12px",
                      width: "20px",
                      height: "20px",
                      cursor: "pointer"
                    }}
                  />
                  <div style={{
                    minWidth: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "#1FA8DC",
                    color: "white",
                    borderRadius: "6px",
                    fontSize: "1rem",
                    fontWeight: "700",
                    marginRight: "16px"
                  }}>
                    {answer}
                  </div>
                  {currentQuestion.answer_texts && currentQuestion.answer_texts[aIdx] && (
                    <span style={{ flex: 1, fontSize: "1rem", color: "#212529" }}>
                      {currentQuestion.answer_texts[aIdx]}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="navigation-buttons" style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        padding: "20px 0",
        maxWidth: "500px",
        margin: "0 auto"
      }}>
        {!isFirstQuestion && (
          <button
            onClick={handlePrevious}
            style={{
              padding: "12px 24px",
              backgroundColor: "#6c757d",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              flex: "1 1 calc(50% - 6px)",
              maxWidth: "244px"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#5a6268";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#6c757d";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <Image src="/chevron-left2.svg" alt="Previous" width={20} height={20} />
            Previous
          </button>
        )}

        {!isLastQuestion && selectedAnswers[currentQuestionIndex] !== undefined && (
          <button
            onClick={handleNext}
            style={{
              padding: "12px 24px",
              backgroundColor: "#007bff",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              flex: isFirstQuestion ? "1 1 100%" : "1 1 calc(50% - 6px)",
              maxWidth: isFirstQuestion ? "500px" : "244px"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#0056b3";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#007bff";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            Next
            <Image src="/chevron-right2.svg" alt="Next" width={20} height={20} />
          </button>
        )}

        {isLastQuestion && (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              padding: "12px 24px",
              background: isSubmitting 
                ? "linear-gradient(135deg, #6c757d 0%, #495057 100%)"
                : "linear-gradient(135deg, #28a745 0%, #20c997 100%)",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: "600",
              cursor: isSubmitting ? "not-allowed" : "pointer",
              boxShadow: isSubmitting 
                ? "0 2px 8px rgba(108, 117, 125, 0.3)"
                : "0 4px 16px rgba(40, 167, 69, 0.3)",
              opacity: isSubmitting ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: isFirstQuestion ? "1 1 100%" : "1 1 calc(50% - 6px)",
              maxWidth: isFirstQuestion ? "500px" : "244px"
            }}
            onMouseEnter={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 6px 20px rgba(40, 167, 69, 0.4)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isSubmitting) {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 16px rgba(40, 167, 69, 0.3)";
              }
            }}
          >
            {isSubmitting ? "Submitting..." : "✅ Submit"}
          </button>
        )}
      </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .page-wrapper {
            padding: 10px 5px !important;
          }
          
          .page-content {
            margin: 20px auto !important;
          }
          
          .timer-container {
            padding: 10px 0 !important;
            margin-bottom: 15px !important;
          }
          
          .timer-display {
            font-size: 1.2rem !important;
            padding: 8px 16px !important;
          }
          
          .timer-display svg,
          .timer-display img {
            width: 18px !important;
            height: 18px !important;
          }
          
          .warning-message {
            font-size: 0.85rem !important;
            padding: 8px 16px !important;
          }
          
          .question-container {
            max-width: 100% !important;
          }
          
          .question-card {
            padding: 24px !important;
            border-radius: 25px !important;
          }
          
          .question-number {
            margin-bottom: 16px !important;
          }
          
          .question-number span {
            font-size: 0.75rem !important;
            padding: 6px 12px !important;
          }
          
          .question-text {
            font-size: 0.95rem !important;
            margin-bottom: 16px !important;
          }
          
          .answer-option {
            padding: 10px 14px !important;
            font-size: 0.9rem !important;
          }
          
          .answer-option input {
            width: 18px !important;
            height: 18px !important;
            margin-right: 10px !important;
          }
          
          .navigation-buttons {
            padding: 15px 0 !important;
            gap: 10px !important;
          }
          
          .navigation-buttons button {
            font-size: 0.9rem !important;
          }
        }
        
        @media (max-width: 480px) {
          .page-wrapper {
            padding: 5px !important;
          }
          
          .page-content {
            margin: 10px auto !important;
          }
          
          .timer-container {
            padding: 8px 0 !important;
            margin-bottom: 12px !important;
          }
          
          .timer-display {
            font-size: 1rem !important;
            padding: 8px 16px !important;
            border-radius: 8px !important;
          }
          
          .timer-display svg,
          .timer-display img {
            width: 16px !important;
            height: 16px !important;
          }
          
          .warning-message {
            font-size: 0.8rem !important;
            padding: 6px 12px !important;
            margin-top: 8px !important;
          }
          
          .question-card {
            padding: 16px !important;
            border-radius: 25px !important;
          }
          
          .question-number {
            margin-bottom: 12px !important;
          }
          
          .question-number span {
            font-size: 0.7rem !important;
            padding: 5px 10px !important;
          }
          
          .question-text {
            font-size: 0.9rem !important;
            margin-bottom: 12px !important;
            line-height: 1.5 !important;
          }
          
          .answer-option {
            padding: 8px 12px !important;
            font-size: 0.85rem !important;
            margin-bottom: 8px !important;
          }
          
          .answer-option input {
            width: 16px !important;
            height: 16px !important;
            margin-right: 8px !important;
          }
          
          .navigation-buttons {
            padding: 12px 0 !important;
            gap: 8px !important;
          }
          
          .navigation-buttons button {
            font-size: 0.9rem !important;
            justify-content: center !important;
          }
        }
        
        @media (max-width: 360px) {
          .timer-display {
            font-size: 0.9rem !important;
            padding: 6px 12px !important;
          }
          
          .question-card {
            padding: 12px !important;
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

