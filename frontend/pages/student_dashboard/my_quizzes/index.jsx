import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from '../../../components/Title';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../lib/axios';
import { useProfile } from '../../../lib/api/auth';
import { useSystemConfig } from '../../../lib/api/system';
import NeedHelp from '../../../components/NeedHelp';
import QuizPerformanceChart from '../../../components/QuizPerformanceChart';
import { TextInput, ActionIcon, useMantineTheme } from '@mantine/core';
import { IconSearch, IconArrowRight } from '@tabler/icons-react';

// Input with Button Component (matching manage online system style)
function InputWithButton(props) {
  const theme = useMantineTheme();
  return (
    <TextInput
      radius="xl"
      size="md"
      placeholder="Search by lesson name..."
      rightSectionWidth={42}
      leftSection={<IconSearch size={18} stroke={1.5} />}
      rightSection={
        <ActionIcon size={32} radius="xl" color={theme.primaryColor} variant="filled" onClick={props.onButtonClick}>
          <IconArrowRight size={18} stroke={1.5} />
        </ActionIcon>
      }
      {...props}
    />
  );
}

// Custom Week Select for Student Dashboard (only shows available weeks)
function StudentWeekSelect({ availableWeeks = [], selectedWeek, onWeekChange, isOpen, onToggle, onClose, placeholder = 'Select Week' }) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleWeekSelect = (week) => {
    onWeekChange(week);
    onClose();
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          padding: '14px 16px',
          border: isOpen ? '2px solid #1FA8DC' : '2px solid #e9ecef',
          borderRadius: '10px',
          backgroundColor: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '1rem',
          color: selectedWeek && selectedWeek !== 'n/a' ? '#000000' : '#adb5bd',
          transition: 'all 0.3s ease',
          boxShadow: isOpen ? '0 0 0 3px rgba(31, 168, 220, 0.1)' : 'none'
        }}
        onClick={onToggle}
      >
        <span>{selectedWeek && selectedWeek !== 'n/a' ? selectedWeek : placeholder}</span>
        <Image
          src={isOpen ? "/chevron-down.svg" : "/chevron-right.svg"}
          alt={isOpen ? "Close" : "Open"}
          width={20}
          height={20}
          style={{
            transition: 'transform 0.2s ease'
          }}
        />

      </div>
      
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: '#ffffff',
          border: '2px solid #e9ecef',
          borderRadius: '10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          zIndex: 1000,
          maxHeight: '200px',
          overflowY: 'auto',
          marginTop: '4px'
        }}>
          {/* Clear selection option */}
          <div
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              borderBottom: '1px solid #f8f9fa',
              transition: 'background-color 0.2s ease',
              color: '#dc3545',
              fontWeight: '500'
            }}
            onClick={() => handleWeekSelect('')}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#fff5f5'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
          >
            ✕ Clear selection
          </div>
          {availableWeeks.map((week) => (
            <div
              key={week}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f8f9fa',
                transition: 'background-color 0.2s ease',
                color: '#000000'
              }}
              onClick={() => handleWeekSelect(week)}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
            >
              {week}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyQuizzes() {
  const { data: systemConfig } = useSystemConfig();
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';
  const isQuizzesEnabled = systemConfig?.quizzes === true || systemConfig?.quizzes === 'true';
  
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Redirect if feature is disabled
  useEffect(() => {
    if (systemConfig && !isQuizzesEnabled) {
      router.push('/student_dashboard');
    }
  }, [systemConfig, isQuizzesEnabled, router]);
  
  // Don't render if feature is disabled
  if (systemConfig && !isQuizzesEnabled) {
    return null;
  }
  const { data: profile } = useProfile();
  const [completedQuizzes, setCompletedQuizzes] = useState(new Set());
  const [errorMessage, setErrorMessage] = useState('');
  const [studentWeeks, setStudentWeeks] = useState([]);
  const [onlineQuizzes, setOnlineQuizzes] = useState([]);
  
  // Check for error message in URL query
  useEffect(() => {
    if (router.query.error) {
      setErrorMessage(router.query.error);
      // Clear error from URL
      router.replace('/student_dashboard/my_quizzes', undefined, { shallow: true });
    }
  }, [router.query.error]);

  // Fetch quizzes
  const { data: quizzesData, isLoading } = useQuery({
    queryKey: ['quizzes-student'],
    queryFn: async () => {
      const response = await apiClient.get('/api/quizzes/student');
      return response.data;
    },
    refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 minutes
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    refetchOnWindowFocus: true, // Refetch on window focus
    refetchOnMount: true, // Refetch on mount
    refetchOnReconnect: true, // Refetch on reconnect
  });

  const quizzes = quizzesData?.quizzes || [];

  // Search and filter states
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  const [filterWeekDropdownOpen, setFilterWeekDropdownOpen] = useState(false);

  // Extract week number from week string (e.g., "week 01" -> 1)
  const extractWeekNumber = (weekString) => {
    if (!weekString) return null;
    const match = weekString.match(/week\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  };

  // Convert week number to week string (e.g., 1 -> "week 01")
  const weekNumberToString = (weekNumber) => {
    if (weekNumber === null || weekNumber === undefined) return '';
    return `week ${String(weekNumber).padStart(2, '0')}`;
  };

  // Get available weeks from quizzes (only weeks that exist in the data)
  const getAvailableWeeks = () => {
    const weekSet = new Set();
    quizzes.forEach(quiz => {
      if (quiz.week !== undefined && quiz.week !== null) {
        weekSet.add(weekNumberToString(quiz.week));
      }
    });
    return Array.from(weekSet).sort((a, b) => {
      const aNum = extractWeekNumber(a);
      const bNum = extractWeekNumber(b);
      return (aNum || 0) - (bNum || 0);
    });
  };

  const availableWeeks = getAvailableWeeks();

  // Filter quizzes based on search and filters
  const filteredQuizzes = quizzes.filter(quiz => {
    // Search filter (by lesson name - case-insensitive)
    if (searchTerm.trim()) {
      const lessonName = quiz.lesson_name || '';
      if (!lessonName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    // Week filter
    if (filterWeek) {
      const weekNumber = extractWeekNumber(filterWeek);
      if (quiz.week !== weekNumber) {
        return false;
      }
    }

    return true;
  });

  // Automatically reset search when search input is cleared
  useEffect(() => {
    if (searchInput.trim() === "" && searchTerm !== "") {
      setSearchTerm("");
    }
  }, [searchInput, searchTerm]);

  // Handle search
  const handleSearch = () => {
    const trimmedSearch = searchInput.trim();
    setSearchTerm(trimmedSearch);
  };

  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // Fetch quiz performance chart data - always fetch even if no quizzes
  const { data: performanceData, isLoading: isChartLoading, refetch: refetchChart } = useQuery({
    queryKey: ['quiz-performance', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return { chartData: [] };
      try {
        const response = await apiClient.get(`/api/students/${profile.id}/quiz-performance`);
        return response.data || { chartData: [] };
      } catch (error) {
        console.error('Error fetching quiz performance:', error);
        return { chartData: [] }; // Return empty array on error
      }
    },
    enabled: !!profile?.id,
    refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 1, // Retry once on failure
  });

  const chartData = performanceData?.chartData || [];

  // Refetch chart data when returning to this page
  useEffect(() => {
    const handleRouteChange = () => {
      // Invalidate and refetch chart data when route changes
      if (profile?.id) {
        queryClient.invalidateQueries({ queryKey: ['quiz-performance', profile.id] });
        queryClient.invalidateQueries({ queryKey: ['quizzes-student'] });
      }
    };

    const handleVisibilityChange = () => {
      // Refetch when page becomes visible
      if (document.visibilityState === 'visible' && profile?.id) {
        refetchChart();
        queryClient.invalidateQueries({ queryKey: ['quizzes-student'] });
      }
    };

    // Refetch when component mounts (user returns to page)
    if (profile?.id) {
      queryClient.invalidateQueries({ queryKey: ['quiz-performance', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['quizzes-student'] });
    }

    // Listen for route changes
    router.events.on('routeChangeComplete', handleRouteChange);
    // Listen for visibility changes
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router, queryClient, profile?.id, refetchChart]);

  // Fetch student's weeks data and online_quizzes to check quizDegree
  useEffect(() => {
    if (!profile?.id) return;

    const fetchStudentData = async () => {
      try {
        const response = await apiClient.get(`/api/students/${profile.id}`);
        if (response.data) {
          if (Array.isArray(response.data.weeks)) {
            setStudentWeeks(response.data.weeks);
          }
          if (Array.isArray(response.data.online_quizzes)) {
            setOnlineQuizzes(response.data.online_quizzes);
          }
          setWeeksLoaded(true); // Mark as loaded
        }
      } catch (err) {
        console.error('Error fetching student data:', err);
        setWeeksLoaded(true); // Mark as loaded even on error to prevent infinite waiting
      }
    };

    fetchStudentData();
  }, [profile?.id]);

  // Check which quizzes exist in online_quizzes array
  useEffect(() => {
    if (!profile?.id || quizzes.length === 0 || !Array.isArray(onlineQuizzes)) return;

    const checkCompletions = () => {
      const completed = new Set();
      for (const quiz of quizzes) {
        // Check if quiz exists in online_quizzes array
        const exists = onlineQuizzes.some(oqz => {
          const qzId = oqz.quiz_id?.toString();
          const targetId = quiz._id?.toString();
          return qzId === targetId;
        });
        if (exists) {
          completed.add(quiz._id);
        }
      }
      setCompletedQuizzes(completed);
    };

    checkCompletions();
  }, [profile?.id, quizzes, onlineQuizzes]);

  // Helper function to get quizDegree for a given week and quiz_id
  const getQuizDegree = (weekNumber, quizId = null) => {
    // First, try to get from weeks array
    if (weekNumber !== null && weekNumber !== undefined) {
      const weekNum = typeof weekNumber === 'number' ? weekNumber : parseInt(weekNumber, 10);
      if (!isNaN(weekNum)) {
        const weekData = studentWeeks.find(w => {
          const wWeek = typeof w.week === 'number' ? w.week : parseInt(w.week, 10);
          return !isNaN(wWeek) && wWeek === weekNum;
        });
        
        if (weekData?.quizDegree) {
          return weekData.quizDegree;
        }
      }
    }
    
    // If not found in weeks, try online_quizzes
    if (quizId && Array.isArray(onlineQuizzes)) {
      const quizResult = onlineQuizzes.find(qz => {
        const qzId = qz.quiz_id?.toString();
        const targetId = quizId.toString();
        return qzId === targetId;
      });
      
      if (quizResult?.result) {
        return quizResult.result; // Format: "1 / 1" or "8 / 10"
      }
    }
    
    return null;
  };

  // Helper function to check if deadline has passed
  const isDeadlinePassed = (deadlineDate) => {
    if (!deadlineDate) return false;
    
    try {
      // Parse date in local timezone to avoid timezone shift
      let deadline;
      if (typeof deadlineDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(deadlineDate)) {
        // If it's a string in YYYY-MM-DD format, parse it in local timezone
        const [year, month, day] = deadlineDate.split('-').map(Number);
        deadline = new Date(year, month - 1, day);
      } else if (deadlineDate instanceof Date) {
        deadline = new Date(deadlineDate);
      } else {
        deadline = new Date(deadlineDate);
      }
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      deadline.setHours(0, 0, 0, 0);
      
      return deadline <= today; // Deadline passed if deadline <= today
    } catch (e) {
      return false;
    }
  };

  // Track if we've loaded student weeks data at least once
  const [weeksLoaded, setWeeksLoaded] = useState(false);
  // Track which quizzes have already had deadline penalties applied (to prevent duplicate scoring)
  const deadlinePenaltiesAppliedRef = useRef(new Set());
  
  // Check deadlines and update student weeks if needed
  useEffect(() => {
    if (!profile?.id || quizzes.length === 0) return;
    // Wait for studentWeeks to be loaded at least once before checking deadlines
    if (!weeksLoaded) return;

    const checkDeadlines = async () => {
      for (const quiz of quizzes) {
        // Only check if quiz has deadline and is not completed
        if (
          quiz.deadline_type === 'with_deadline' &&
          quiz.deadline_date &&
          !completedQuizzes.has(quiz._id) &&
          quiz.week !== null &&
          quiz.week !== undefined
        ) {
          if (isDeadlinePassed(quiz.deadline_date)) {
            const weekNum = typeof quiz.week === 'number' ? quiz.week : parseInt(quiz.week, 10);
            if (!isNaN(weekNum)) {
              // Check current week data to see if we need to update
              const weekData = studentWeeks.find(w => {
                const wWeek = typeof w.week === 'number' ? w.week : parseInt(w.week, 10);
                return !isNaN(wWeek) && wWeek === weekNum;
              });
              
              // Create unique key for this quiz deadline check
              const deadlineKey = `quiz_${quiz._id}_week_${weekNum}`;
              
              // Only update and apply scoring if:
              // 1. We haven't already applied penalty for this quiz (tracked in ref)
              // 2. quizDegree is NOT already "Didn't Attend The Quiz"
              const shouldApplyDeadlinePenalty = !deadlinePenaltiesAppliedRef.current.has(deadlineKey) &&
                                                 (!weekData || 
                                                  weekData.quizDegree === null || 
                                                  weekData.quizDegree === undefined ||
                                                  weekData.quizDegree !== "Didn't Attend The Quiz");
              
              if (shouldApplyDeadlinePenalty) {
                try {
                  // Check history first to see if deadline penalty was already applied (only if scoring is enabled)
                  let alreadyApplied = false;
                  if (isScoringEnabled) {
                    try {
                      const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                        studentId: profile.id,
                        type: 'quiz',
                        week: weekNum
                      });
                      
                      if (historyResponse.data.found && historyResponse.data.history) {
                        const lastHistory = historyResponse.data.history;
                        // Check if this is already a deadline penalty (0%) for this week
                        if (lastHistory.data?.percentage === 0 && lastHistory.process_week === weekNum) {
                          // Check if it was applied recently (within last hour) to avoid duplicates
                          const historyTime = new Date(lastHistory.timestamp);
                          const now = new Date();
                          const timeDiff = now - historyTime;
                          if (timeDiff < 3600000) { // 1 hour
                            alreadyApplied = true;
                            console.log(`[DEADLINE] Deadline penalty already applied for quiz ${quiz._id}, week ${weekNum}`);
                          }
                        }
                      }
                    } catch (historyErr) {
                      console.error('Error checking history for deadline penalty:', historyErr);
                    }
                  }
                  
                  if (!alreadyApplied) {
                  // Mark as applied immediately to prevent duplicate calls
                  deadlinePenaltiesAppliedRef.current.add(deadlineKey);
                  
                  // Get previous percentage ONLY from online_quizzes (actual submissions)
                  // Don't check weeks.quizDegree as that might have "Didn't Attend The Quiz" from deadline
                  let previousPercentage = null;
                    if (isScoringEnabled) {
                  const studentResponseBefore = await apiClient.get(`/api/students/${profile.id}`);
                  
                  // Only check online_quizzes for previous result (actual quiz submission)
                  if (studentResponseBefore.data && studentResponseBefore.data.online_quizzes) {
                    const previousResult = studentResponseBefore.data.online_quizzes.find(
                      oqz => {
                        const qzIdStr = oqz.quiz_id ? String(oqz.quiz_id) : null;
                        const targetIdStr = quiz._id.toString();
                        return qzIdStr === targetIdStr;
                      }
                    );
                    if (previousResult && previousResult.percentage) {
                      // Extract percentage from "X%" format
                      const prevPercentageStr = String(previousResult.percentage).replace('%', '');
                      previousPercentage = parseInt(prevPercentageStr, 10);
                        }
                    }
                  }
                  
                  console.log(`[DEADLINE] Applying quiz deadline penalty for quiz ${quiz._id}, week ${weekNum}, previousPercentage: ${previousPercentage}`);
                  
                    // Update weeks first (always apply this, regardless of scoring system)
                  await apiClient.put(`/api/students/${profile.id}`, {
                    weeks_update: {
                      week: weekNum,
                      quizDegree: "Didn't Attend The Quiz"
                    }
                  });
                  
                    // Apply scoring: 0% = -25 points (only if scoring is enabled)
                    if (isScoringEnabled) {
                      // Get previous percentage from history (for this week)
                      let actualPreviousPercentage = previousPercentage;
                      try {
                        const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                          studentId: profile.id,
                          type: 'quiz',
                          week: weekNum
                        });
                        
                        if (historyResponse.data.found && historyResponse.data.history) {
                          const lastHistory = historyResponse.data.history;
                          if (lastHistory.data?.percentage !== undefined) {
                            actualPreviousPercentage = lastHistory.data.percentage;
                          }
                        }
                      } catch (historyErr) {
                        console.error('Error getting quiz history, using provided previousPercentage:', historyErr);
                      }
                      
                  // If previousPercentage is null (no previous submission), it will just apply -25
                  // If previousPercentage exists, it will reverse those points and apply -25
                  try {
                    const scoringResponse = await apiClient.post('/api/scoring/calculate', {
                      studentId: profile.id,
                      type: 'quiz',
                          week: weekNum,
                          data: { percentage: 0, previousPercentage: actualPreviousPercentage }
                    });
                    console.log(`[DEADLINE] Scoring response:`, scoringResponse.data);
                  } catch (scoreErr) {
                    console.error('Error calculating quiz score:', scoreErr);
                    // Remove from ref if scoring failed so it can be retried
                    deadlinePenaltiesAppliedRef.current.delete(deadlineKey);
                      }
                  }
                  
                  // Refetch student data to update state
                  const response = await apiClient.get(`/api/students/${profile.id}`);
                  if (response.data && Array.isArray(response.data.weeks)) {
                    setStudentWeeks(response.data.weeks);
                    }
                  }
                } catch (err) {
                  console.error('Error updating student weeks:', err);
                  // Remove from ref if update failed so it can be retried
                  deadlinePenaltiesAppliedRef.current.delete(deadlineKey);
                }
              }
            }
          }
        }
      }
    };

    checkDeadlines();
  }, [profile?.id, quizzes, completedQuizzes, weeksLoaded]); // Removed studentWeeks from deps to prevent re-runs

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <Title backText="Back" href="/student_dashboard">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/notepad.svg" alt="Notepad" width={32} height={32} />
              My Quizzes
            </div>
          </Title>
          
          {/* Error Message */}
          {errorMessage && (
            <div style={{
              background: '#f8d7da',
              color: '#721c24',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '20px',
              border: '1px solid #f5c6cb',
              textAlign: 'center',
              fontWeight: '500'
            }}>
              {errorMessage}
            </div>
          )}
          
          {/* White Background Container */}
          <div className="quizzes-container" style={{
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
            <p style={{ color: "#6c757d", fontSize: "1rem" }}>Loading quizzes...</p>
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
        <Title backText="Back" href="/student_dashboard">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/notepad.svg" alt="Notepad" width={32} height={32} />
            My Quizzes
          </div>
        </Title>

        {/* Quiz Performance Chart - Outside container, under Title */}
        <div style={{
          marginBottom: '24px',
          padding: '24px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <h2 style={{
            margin: '0 0 20px 0',
            fontSize: '1.3rem',
            fontWeight: '700',
            color: '#212529'
          }}>
            Quiz Performance by Week
          </h2>
          {isChartLoading ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: '#6c757d',
              fontSize: '1.1rem',
              fontWeight: '500'
            }}>
              Loading chart data...
            </div>
          ) : (
            <QuizPerformanceChart chartData={chartData} height={400} />
          )}
        </div>

        {/* Search Bar */}
        <div className="search-bar-container" style={{ marginBottom: 20, width: '100%' }}>
          <InputWithButton
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            onButtonClick={handleSearch}
          />
        </div>

        {/* Filters */}
        {quizzes.length > 0 && (
          <div className="filters-container" style={{
            background: 'white',
            borderRadius: 16,
            padding: '24px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            marginBottom: 24,
            width: '100%',
            boxSizing: 'border-box'
          }}>
            <div className="filter-row" style={{
              display: 'flex',
              gap: 12,
              flexWrap: 'wrap'
            }}>
              <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
                <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                  Filter by Week
                </label>
                <StudentWeekSelect
                  availableWeeks={availableWeeks}
                  selectedWeek={filterWeek}
                  onWeekChange={(week) => {
                    setFilterWeek(week);
                  }}
                  isOpen={filterWeekDropdownOpen}
                  onToggle={() => {
                    setFilterWeekDropdownOpen(!filterWeekDropdownOpen);
                  }}
                  onClose={() => setFilterWeekDropdownOpen(false)}
                  placeholder="Select Week"
                />
              </div>
            </div>
          </div>
        )}

        {/* White Background Container */}
        <div className="quizzes-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          {/* Quizzes List */}
          {filteredQuizzes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              {quizzes.length === 0 ? 'No quizzes available.' : 'No quizzes match your filters.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredQuizzes.map((quiz) => (
                <div
                  key={quiz._id}
                  className="quiz-item"
                  style={{
                    border: '2px solid #e9ecef',
                    borderRadius: '12px',
                    padding: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
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
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>
                      {[quiz.week !== undefined && quiz.week !== null ? `Week ${quiz.week}` : null, quiz.lesson_name].filter(Boolean).join(' • ')}
                    </div>
                    <div style={{
                      padding: '12px 16px',
                      backgroundColor: '#ffffff',
                      border: '2px solid #e9ecef',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      color: '#495057',
                      textAlign: 'left',
                      display: 'inline-block',
                      maxWidth: '350px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span>{quiz.questions?.length || 0} Question{quiz.questions?.length !== 1 ? 's' : ''}</span>
                        <span>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Image src="/clock.svg" alt="Timer" width={18} height={18} />
                          {quiz.timer ? `Timer ${quiz.timer} minute${quiz.timer !== 1 ? 's' : ''}` : 'No Timer'}
                        </span>
                        {quiz.deadline_type === 'with_deadline' && quiz.deadline_date && (
                          <>
                            <span>•</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Image src="/clock.svg" alt="Deadline" width={18} height={18} />
                              {quiz.deadline_date ? (() => {
                                try {
                                  // Parse date in local timezone
                                  let deadline;
                                  if (typeof quiz.deadline_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(quiz.deadline_date)) {
                                    const [year, month, day] = quiz.deadline_date.split('-').map(Number);
                                    deadline = new Date(year, month - 1, day);
                                  } else {
                                    deadline = new Date(quiz.deadline_date);
                                  }
                                  return `With deadline date : ${deadline.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}`;
                                } catch (e) {
                                  return `With deadline date : ${quiz.deadline_date}`;
                                }
                              })() : 'With no deadline date'}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="quiz-buttons" style={{ display: 'flex', gap: '12px' }}>
                    {(() => {
                      // Get quizDegree from weeks database (for display purposes only)
                      const quizDegree = getQuizDegree(quiz.week, quiz._id);
                      
                      // IMPORTANT: Only hide Start button if quiz exists in online_quizzes
                      // Don't hide Start button just because weeks array has quizDegree
                      // If quiz is in online_quizzes, show Details and Done buttons
                      if (completedQuizzes.has(quiz._id)) {
                        return (
                          <>
                            {(quiz.show_details_after_submitting === true || quiz.show_details_after_submitting === 'true') && (
                              <button
                                onClick={() => router.push(`/student_dashboard/my_quizzes/details?id=${quiz._id}`)}
                                style={{
                                  padding: '8px 16px',
                                  backgroundColor: '#1FA8DC',
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.9rem',
                                  fontWeight: '600',
                                  transition: 'all 0.2s ease',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
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
                                <Image src="/details.svg" alt="Details" width={18} height={18} />
                                Details
                              </button>
                            )}
                            <button
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '20px',
                                cursor: 'default',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px'
                              }}
                            >
                              ✅ Done{quizDegree ? ` (${quizDegree})` : ''}
                            </button>
                          </>
                        );
                      }
                      
                      // If quizDegree is "Didn't Attend The Quiz" or "No Quiz", show that status
                      // (but still allow Start button if not in online_quizzes)
                      if (quizDegree === "Didn't Attend The Quiz" || quizDegree === "No Quiz") {
                        return (
                          <button
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '20px',
                              cursor: 'default',
                              fontSize: '0.9rem',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            {quizDegree === "No Quiz" ? '🚫 No Quiz' : "❌ Didn't Attend The Quiz"}
                          </button>
                        );
                      }
                      
                      // Check if deadline has passed and quiz not submitted
                      if (quiz.deadline_type === 'with_deadline' && 
                          quiz.deadline_date && 
                          isDeadlinePassed(quiz.deadline_date)) {
                        return (
                          <button
                            style={{
                              padding: '8px 16px',
                              backgroundColor: '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '20px',
                              cursor: 'default',
                              fontSize: '0.9rem',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px'
                            }}
                          >
                            ❌ Didn't Attend The Quiz
                          </button>
                        );
                      }
                      
                      // Default: show Start button
                      // (Even if weeks array has quizDegree, if not in online_quizzes, show Start)
                      return (
                        <button
                          onClick={() => router.push(`/student_dashboard/my_quizzes/start?id=${quiz._id}`)}
                          style={{
                            padding: '8px 16px',
                            backgroundColor: '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#218838';
                            e.target.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#28a745';
                            e.target.style.transform = 'translateY(0)';
                          }}
                        >
                          <Image src="/play.svg" alt="Play" width={16} height={16} />
                          Start
                        </button>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>
          )}

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
            padding: 8px;
          }
          .quizzes-container {
            padding: 16px;
          }
          .quiz-item {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px;
          }
          .quiz-buttons {
            width: 100%;
          }
          .quiz-buttons button {
            width: 100%;
            justify-content: center;
          }
          /* Chart container responsive */
          .page-content > div:first-of-type {
            padding: 16px !important;
            margin-bottom: 16px !important;
          }
          .page-content > div:first-of-type h2 {
            font-size: 1.3rem !important;
            margin-bottom: 16px !important;
          }
        }
        @media (max-width: 480px) {
          .page-wrapper {
            padding: 5px;
          }
          .page-content {
            margin: 10px auto;
            padding: 5px;
          }
          .quizzes-container {
            padding: 12px;
          }
          /* Chart container responsive */
          .page-content > div:first-of-type {
            padding: 12px !important;
            margin-bottom: 12px !important;
          }
          .page-content > div:first-of-type h2 {
            font-size: 1.3rem !important;
            margin-bottom: 12px !important;
          }
        }
        @media (max-width: 360px) {
          .quizzes-container {
            padding: 10px;
          }
          /* Chart container responsive */
          .page-content > div:first-of-type {
            padding: 10px !important;
          }
          .page-content > div:first-of-type h2 {
            font-size: 1.3rem !important;
          }
        }
      `}</style>
    </div>
  );
}

