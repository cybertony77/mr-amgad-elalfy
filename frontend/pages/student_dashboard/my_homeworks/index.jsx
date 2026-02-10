import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from '../../../components/Title';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../lib/axios';
import { useProfile } from '../../../lib/api/auth';
import { useSystemConfig } from '../../../lib/api/system';
import NeedHelp from '../../../components/NeedHelp';
import HomeworkPerformanceChart from '../../../components/HomeworkPerformanceChart';
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

export default function MyHomeworks() {
  const { data: systemConfig } = useSystemConfig();
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';
  const isHomeworksEnabled = systemConfig?.homeworks === true || systemConfig?.homeworks === 'true';
  
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Redirect if feature is disabled
  useEffect(() => {
    if (systemConfig && !isHomeworksEnabled) {
      router.push('/student_dashboard');
    }
  }, [systemConfig, isHomeworksEnabled, router]);
  
  // Don't render if feature is disabled
  if (systemConfig && !isHomeworksEnabled) {
    return null;
  }
  const { data: profile } = useProfile();
  const [completedHomeworks, setCompletedHomeworks] = useState(new Set());
  const [errorMessage, setErrorMessage] = useState('');
  const [studentWeeks, setStudentWeeks] = useState([]);
  const [onlineHomeworks, setOnlineHomeworks] = useState([]);
  
  // Check for error message in URL query
  useEffect(() => {
    if (router.query.error) {
      setErrorMessage(router.query.error);
      // Clear error from URL
      router.replace('/student_dashboard/my_homeworks', undefined, { shallow: true });
    }
  }, [router.query.error]);

  // Fetch homeworks
  const { data: homeworksData, isLoading } = useQuery({
    queryKey: ['homeworks-student'],
    queryFn: async () => {
      const response = await apiClient.get('/api/homeworks/student');
      return response.data;
    },
    refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 minutes
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    refetchOnWindowFocus: true, // Refetch on window focus
    refetchOnMount: true, // Refetch on mount
    refetchOnReconnect: true, // Refetch on reconnect
  });

  const homeworks = homeworksData?.homeworks || [];

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

  // Get available weeks from homeworks (only weeks that exist in the data)
  const getAvailableWeeks = () => {
    const weekSet = new Set();
    homeworks.forEach(homework => {
      if (homework.week !== undefined && homework.week !== null) {
        weekSet.add(weekNumberToString(homework.week));
      }
    });
    return Array.from(weekSet).sort((a, b) => {
      const aNum = extractWeekNumber(a);
      const bNum = extractWeekNumber(b);
      return (aNum || 0) - (bNum || 0);
    });
  };

  const availableWeeks = getAvailableWeeks();

  // Filter homeworks based on search and filters
  const filteredHomeworks = homeworks.filter(homework => {
    // Search filter (by lesson name - case-insensitive)
    if (searchTerm.trim()) {
      const lessonName = homework.lesson_name || '';
      if (!lessonName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    // Week filter
    if (filterWeek) {
      const weekNumber = extractWeekNumber(filterWeek);
      if (homework.week !== weekNumber) {
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

  // Fetch homework performance chart data - always fetch even if no homeworks
  const { data: performanceData, isLoading: isChartLoading, refetch: refetchChart } = useQuery({
    queryKey: ['homework-performance', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return { chartData: [] };
      try {
        const response = await apiClient.get(`/api/students/${profile.id}/homework-performance`);
        return response.data || { chartData: [] };
      } catch (error) {
        console.error('Error fetching homework performance:', error);
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
        queryClient.invalidateQueries({ queryKey: ['homework-performance', profile.id] });
        queryClient.invalidateQueries({ queryKey: ['homeworks-student'] });
      }
    };

    const handleVisibilityChange = () => {
      // Refetch when page becomes visible
      if (document.visibilityState === 'visible' && profile?.id) {
        refetchChart();
        queryClient.invalidateQueries({ queryKey: ['homeworks-student'] });
      }
    };

    // Refetch when component mounts (user returns to page)
    if (profile?.id) {
      queryClient.invalidateQueries({ queryKey: ['homework-performance', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['homeworks-student'] });
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

  // Fetch student's weeks data and online_homeworks to check hwDone and degree
  useEffect(() => {
    if (!profile?.id) return;

    const fetchStudentData = async () => {
      try {
        const response = await apiClient.get(`/api/students/${profile.id}`);
        if (response.data) {
          if (Array.isArray(response.data.weeks)) {
            setStudentWeeks(response.data.weeks);
          }
          if (Array.isArray(response.data.online_homeworks)) {
            setOnlineHomeworks(response.data.online_homeworks);
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

  // Check which homeworks exist in online_homeworks array
  useEffect(() => {
    if (!profile?.id || homeworks.length === 0 || !Array.isArray(onlineHomeworks)) return;

    const checkCompletions = () => {
      const completed = new Set();
      for (const homework of homeworks) {
        // Check if homework exists in online_homeworks array
        const exists = onlineHomeworks.some(ohw => {
          const hwId = ohw.homework_id?.toString();
          const targetId = homework._id?.toString();
          return hwId === targetId;
        });
        if (exists) {
          completed.add(homework._id);
        }
      }
      setCompletedHomeworks(completed);
    };

    checkCompletions();
  }, [profile?.id, homeworks, onlineHomeworks]);

  // Helper function to check if hwDone indicates completion for a given week
  // Returns true if hwDone is true, "Not Completed", or "No Homework" (protected values)
  const isHwDone = (weekNumber) => {
    if (weekNumber === null || weekNumber === undefined) return false;
    // Ensure both values are compared as numbers
    const weekNum = typeof weekNumber === 'number' ? weekNumber : parseInt(weekNumber, 10);
    if (isNaN(weekNum)) return false;
    
    const weekData = studentWeeks.find(w => {
      const wWeek = typeof w.week === 'number' ? w.week : parseInt(w.week, 10);
      return !isNaN(wWeek) && wWeek === weekNum;
    });
    
    if (!weekData) return false;
    
    // Check for protected values that indicate some status (not just false)
    const protectedValues = [true, "Not Completed", "No Homework"];
    return protectedValues.includes(weekData.hwDone);
  };

  // Helper function to get hwDone status text for display
  const getHwDoneStatus = (weekNumber) => {
    if (weekNumber === null || weekNumber === undefined) return null;
    const weekNum = typeof weekNumber === 'number' ? weekNumber : parseInt(weekNumber, 10);
    if (isNaN(weekNum)) return null;
    
    const weekData = studentWeeks.find(w => {
      const wWeek = typeof w.week === 'number' ? w.week : parseInt(w.week, 10);
      return !isNaN(wWeek) && wWeek === weekNum;
    });
    
    if (!weekData) return null;
    
    return weekData.hwDone;
  };

  // Helper function to get hwDegree for a given week and homework_id
  const getHwDegree = (weekNumber, homeworkId = null) => {
    // First, try to get from weeks array
    if (weekNumber !== null && weekNumber !== undefined) {
      const weekNum = typeof weekNumber === 'number' ? weekNumber : parseInt(weekNumber, 10);
      if (!isNaN(weekNum)) {
        const weekData = studentWeeks.find(w => {
          const wWeek = typeof w.week === 'number' ? w.week : parseInt(w.week, 10);
          return !isNaN(wWeek) && wWeek === weekNum;
        });
        
        if (weekData?.hwDegree) {
          return weekData.hwDegree;
        }
      }
    }
    
    // If not found in weeks, try online_homeworks
    if (homeworkId && Array.isArray(onlineHomeworks)) {
      const homeworkResult = onlineHomeworks.find(hw => {
        const hwId = hw.homework_id?.toString();
        const targetId = homeworkId.toString();
        return hwId === targetId;
      });
      
      if (homeworkResult?.result) {
        return homeworkResult.result; // Format: "1 / 1" or "8 / 10"
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
  // Track which homeworks have already had deadline penalties applied (to prevent duplicate scoring)
  const deadlinePenaltiesAppliedRef = useRef(new Set());
  
  // Check deadlines and update student weeks if needed
  useEffect(() => {
    if (!profile?.id || homeworks.length === 0) return;
    // Wait for studentWeeks to be loaded at least once before checking deadlines
    if (!weeksLoaded) return;

    const checkDeadlines = async () => {
      for (const homework of homeworks) {
        // Only check if homework has deadline and is not completed
        if (
          homework.deadline_type === 'with_deadline' &&
          homework.deadline_date &&
          !completedHomeworks.has(homework._id) &&
          homework.week !== null &&
          homework.week !== undefined
        ) {
          if (isDeadlinePassed(homework.deadline_date)) {
            const weekNum = typeof homework.week === 'number' ? homework.week : parseInt(homework.week, 10);
            if (!isNaN(weekNum)) {
              // Check current week data to see if we need to update
              const weekData = studentWeeks.find(w => {
                const wWeek = typeof w.week === 'number' ? w.week : parseInt(w.week, 10);
                return !isNaN(wWeek) && wWeek === weekNum;
              });
              
              // Protected values that should never be overwritten
              const protectedHwDoneValues = [true, "Not Completed", "No Homework"];
              
              // Create unique key for this homework deadline check
              const deadlineKey = `homework_${homework._id}_week_${weekNum}`;
              
              // Only update if:
              // 1. We haven't already applied deadline update for this homework (tracked in ref)
              // 2. hwDone is NOT already false (deadline already applied)
              // 3. Protected values (true, "Not Completed", "No Homework") should not be overwritten
              const shouldApplyDeadlineUpdate = !deadlinePenaltiesAppliedRef.current.has(deadlineKey) &&
                                                (!weekData || 
                                                 (!protectedHwDoneValues.includes(weekData.hwDone) && 
                                                  weekData.hwDone !== false));
              
              if (shouldApplyDeadlineUpdate) {
                try {
                  // Check history to see if deadline penalty was already applied (only if scoring is enabled)
                  let alreadyApplied = false;
                  if (isScoringEnabled) {
                    try {
                      const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                        studentId: profile.id,
                        type: 'homework',
                        week: weekNum
                      });
                      
                      if (historyResponse.data.found && historyResponse.data.history) {
                        const lastHistory = historyResponse.data.history;
                        // Check if this is a deadline penalty (hwDone: false) for this week
                        if (lastHistory.data?.hwDone === false && lastHistory.process_week === weekNum) {
                          // Check if it was applied recently (within last hour) to avoid duplicates
                          const historyTime = new Date(lastHistory.timestamp);
                          const now = new Date();
                          const timeDiff = now - historyTime;
                          if (timeDiff < 3600000) { // 1 hour
                            alreadyApplied = true;
                            console.log(`[DEADLINE] Deadline penalty already applied for homework ${homework._id}, week ${weekNum}`);
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
                  
                  console.log(`[DEADLINE] Setting hwDone to false for homework ${homework._id}, week ${weekNum}`);
                  
                    // Get previous homework state from history (only if scoring is enabled)
                    let previousHwDone = null;
                    if (isScoringEnabled) {
                      try {
                        const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                          studentId: profile.id,
                          type: 'homework',
                          week: weekNum
                        });
                        
                        if (historyResponse.data.found && historyResponse.data.history) {
                          const lastHistory = historyResponse.data.history;
                          if (lastHistory.data?.hwDone !== undefined) {
                            previousHwDone = lastHistory.data.hwDone;
                          }
                        }
                      } catch (historyErr) {
                        console.error('Error getting homework history for deadline:', historyErr);
                      }
                    }
                    
                    // Update hwDone to false (always apply this, regardless of scoring system)
                  await apiClient.put(`/api/students/${profile.id}`, {
                    weeks_update: {
                      week: weekNum,
                      hwDone: false
                    }
                  });
                    
                    // Recalculate score with hwDone: false rule (only if scoring is enabled)
                    if (isScoringEnabled) {
                      try {
                        await apiClient.post('/api/scoring/calculate', {
                          studentId: profile.id,
                          type: 'homework',
                          week: weekNum,
                          data: { 
                            hwDone: false,
                            previousHwDone: previousHwDone
                          }
                        });
                        console.log(`[DEADLINE] Score recalculated for homework deadline penalty`);
                      } catch (scoreErr) {
                        console.error('Error calculating score for deadline penalty:', scoreErr);
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
  }, [profile?.id, homeworks, completedHomeworks, weeksLoaded]); // Removed studentWeeks from deps to prevent re-runs

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <Title backText="Back" href="/student_dashboard">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/books.svg" alt="Books" width={32} height={32} />
              My Homeworks
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
          <div className="homeworks-container" style={{
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
            <p style={{ color: "#6c757d", fontSize: "1rem" }}>Loading homeworks...</p>
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
            <Image src="/books.svg" alt="Books" width={32} height={32} />
            My Homeworks
          </div>
        </Title>

        {/* Homework Performance Chart - Outside container, under Title */}
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
            Homework Performance by Week
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
            <HomeworkPerformanceChart chartData={chartData} height={400} />
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
        {homeworks.length > 0 && (
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
        <div className="homeworks-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          {/* Homeworks List */}
          {filteredHomeworks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              {homeworks.length === 0 ? '❌ No homeworks available.' : 'No homeworks match your filters.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredHomeworks.map((homework) => (
                <div
                  key={homework._id}
                  className="homework-item"
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
                      {[homework.week !== undefined && homework.week !== null ? `Week ${homework.week}` : null, homework.lesson_name].filter(Boolean).join(' • ')}
                    </div>
                    {homework.homework_type === 'pages_from_book' ? (
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
                        <strong>From page {homework.from_page} to page {homework.to_page} in {homework.book_name}</strong>
                      </div>
                    ) : (
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
                          <span>{homework.questions?.length || 0} Question{homework.questions?.length !== 1 ? 's' : ''}</span>
                          <span>•</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Image src="/clock.svg" alt="Timer" width={18} height={18} />
                            {homework.timer ? `Timer ${homework.timer} minute${homework.timer !== 1 ? 's' : ''}` : 'No Timer'}
                          </span>
                          {homework.deadline_type === 'with_deadline' && homework.deadline_date && (
                            <>
                              <span>•</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Image src="/clock.svg" alt="Deadline" width={18} height={18} />
                                {homework.deadline_date ? (() => {
                                  try {
                                    // Parse date in local timezone
                                    let deadline;
                                    if (typeof homework.deadline_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(homework.deadline_date)) {
                                      const [year, month, day] = homework.deadline_date.split('-').map(Number);
                                      deadline = new Date(year, month - 1, day);
                                    } else {
                                      deadline = new Date(homework.deadline_date);
                                    }
                                    return `With deadline date : ${deadline.toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' })}`;
                                  } catch (e) {
                                    return `With deadline date : ${homework.deadline_date}`;
                                  }
                                })() : 'With no deadline date'}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="homework-buttons" style={{ display: 'flex', gap: '12px' }}>
                    {(() => {
                      // Get hwDone status from weeks database (for display purposes only)
                      const hwDoneStatus = getHwDoneStatus(homework.week);
                      
                      // IMPORTANT: Only hide Start button if homework exists in online_homeworks
                      // Don't hide Start button just because weeks array says hwDone is true
                      // If homework is in online_homeworks, show Details and Done buttons
                      if (completedHomeworks.has(homework._id)) {
                        return (
                          <>
                            {(homework.show_details_after_submitting === true || homework.show_details_after_submitting === 'true') && (
                              <button
                                onClick={() => router.push(`/student_dashboard/my_homeworks/details?id=${homework._id}`)}
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
                              ✅ Done{getHwDegree(homework.week, homework._id) ? ` (${getHwDegree(homework.week, homework._id)})` : ''}
                            </button>
                          </>
                        );
                      }
                      
                      // If hwDone is "Not Completed" or "No Homework", show that status
                      // (but still allow Start button if not in online_homeworks)
                      if (hwDoneStatus === "Not Completed" || hwDoneStatus === "No Homework") {
                        return (
                          <button
                            style={{
                              padding: '8px 16px',
                              backgroundColor: hwDoneStatus === "No Homework" ? '#dc3545' : '#ffc107',
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
                            {hwDoneStatus === "No Homework" ? '🚫 No Homework' : '⚠️ Not Completed'}
                          </button>
                        );
                      }
                      
                      // Check if deadline has passed and homework not submitted
                      if (homework.deadline_type === 'with_deadline' && 
                          homework.deadline_date && 
                          isDeadlinePassed(homework.deadline_date)) {
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
                            ❌ Not Done
                          </button>
                        );
                      }
                      
                      // Default: show Start button or pages_from_book display
                      // (Even if weeks array says hwDone is true, if not in online_homeworks, show Start)
                      if (homework.homework_type === 'pages_from_book') {
                        const hwStatus = getHwDoneStatus(homework.week);
                        return (
                          <button
                            style={{
                              padding: '8px 16px',
                              backgroundColor: hwStatus === true ? '#28a745' : hwStatus === "No Homework" ? '#dc3545' : hwStatus === "Not Completed" ? '#ffc107' : '#dc3545',
                              color: 'white',
                              border: 'none',
                              borderRadius: '20px',
                              cursor: 'default',
                              fontSize: '0.9rem',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {hwStatus === true 
                              ? `✅ Done${getHwDegree(homework.week, homework._id) ? ` (${getHwDegree(homework.week, homework._id)})` : ''}` 
                              : hwStatus === "No Homework" 
                              ? '🚫 No Homework'
                              : hwStatus === "Not Completed"
                              ? '⚠️ Not Completed'
                              : '❌ Not Done'}
                          </button>
                        );
                      }
                      
                      // Show Start button for questions type
                      return (
                        <button
                          onClick={() => router.push(`/student_dashboard/my_homeworks/start?id=${homework._id}`)}
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
          .homeworks-container {
            padding: 16px;
          }
          .homework-item {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 16px;
          }
          .homework-buttons {
            width: 100%;
          }
          .homework-buttons button {
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
          .homeworks-container {
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
          .homeworks-container {
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
