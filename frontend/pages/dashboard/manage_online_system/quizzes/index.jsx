import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Title from '../../../../components/Title';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../../lib/axios';
import { useSystemConfig } from '../../../../lib/api/system';
import Image from 'next/image';
import GradeSelect from '../../../../components/GradeSelect';
import AttendanceWeekSelect from '../../../../components/AttendanceWeekSelect';
import TimerSelect from '../../../../components/TimerSelect';
import { TextInput, ActionIcon, useMantineTheme } from '@mantine/core';
import { IconSearch, IconArrowRight } from '@tabler/icons-react';
import QuizAnalyticsChart from '../../../../components/QuizAnalyticsChart';

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

export default function Quizzes() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: systemConfig } = useSystemConfig();
  const isQuizzesEnabled = systemConfig?.quizzes === true || systemConfig?.quizzes === 'true';
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  
  // Redirect if feature is disabled
  useEffect(() => {
    if (systemConfig && !isQuizzesEnabled) {
      router.push('/dashboard/manage_online_system');
    }
  }, [systemConfig, isQuizzesEnabled, router]);
  
  // Don't render if feature is disabled
  if (systemConfig && !isQuizzesEnabled) {
    return null;
  }
  const [selectedQuiz, setSelectedQuiz] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const successTimeoutRef = useRef(null);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [selectedQuizForAnalytics, setSelectedQuizForAnalytics] = useState(null);
  
  // Search and filter states
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  const [filterTimer, setFilterTimer] = useState('');
  const [filterGradeDropdownOpen, setFilterGradeDropdownOpen] = useState(false);
  const [filterWeekDropdownOpen, setFilterWeekDropdownOpen] = useState(false);
  const [filterTimerDropdownOpen, setFilterTimerDropdownOpen] = useState(false);

  // Fetch quizzes
  const { data: quizzesData, isLoading } = useQuery({
    queryKey: ['quizzes'],
    queryFn: async () => {
      const response = await apiClient.get('/api/quizzes');
      return response.data;
    },
    refetchInterval: 15 * 60 * 1000, // Auto-refresh every 15 minutes
    refetchIntervalInBackground: true, // refetch when tab is not active
    refetchOnWindowFocus: true, // Refetch on window focus
    refetchOnMount: true, // Refetch on mount
    refetchOnReconnect: true, // Refetch on reconnect
  });

  const quizzes = quizzesData?.quizzes || [];

  // Extract week number from week string (e.g., "week 01" -> 1)
  const extractWeekNumber = (weekString) => {
    if (!weekString) return null;
    const match = weekString.match(/week\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  };

  // Filter quizzes based on search and filters
  const filteredQuizzes = quizzes.filter(quiz => {
    // Search filter (contains, case-insensitive)
    if (searchTerm.trim()) {
      const lessonName = quiz.lesson_name || '';
      if (!lessonName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    // Grade filter
    if (filterGrade) {
      if (quiz.grade !== filterGrade) {
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

    // Timer filter
    if (filterTimer) {
      if (filterTimer === 'with timer') {
        if (!quiz.timer || quiz.timer === 0 || quiz.timer === null) {
          return false;
        }
      } else if (filterTimer === 'no timer') {
        if (quiz.timer && quiz.timer !== 0 && quiz.timer !== null) {
          return false;
        }
      }
    }

    return true;
  });

  // Automatically reset search when search input is cleared
  useEffect(() => {
    if (searchInput.trim() === "" && searchTerm !== "") {
      // If input is cleared but search term still has value, automatically clear search
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

  // Delete quiz mutation
  const deleteQuizMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiClient.delete(`/api/quizzes?id=${id}`);
      return response.data;
    },
    onSuccess: () => {
      setSuccessMessage('✅ Quiz deleted successfully!');
      setConfirmDeleteOpen(false);
      setSelectedQuiz(null);
      queryClient.invalidateQueries(['quizzes']);
      
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage('');
      }, 6000);
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.error || 'Failed to delete quiz';
      setSuccessMessage(errorMsg.startsWith('❌') ? errorMsg : `❌ ${errorMsg}`);
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage('');
      }, 6000);
    },
  });

  const openConfirmDeleteModal = (quiz) => {
    setSelectedQuiz(quiz);
    setConfirmDeleteOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (selectedQuiz) {
      deleteQuizMutation.mutate(selectedQuiz._id);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmDeleteOpen(false);
    setSelectedQuiz(null);
  };

  // Fetch analytics data
  const { data: analyticsData, isLoading: analyticsLoading } = useQuery({
    queryKey: ['quiz-analytics', selectedQuizForAnalytics?._id],
    queryFn: async () => {
      if (!selectedQuizForAnalytics?._id) return null;
      const response = await apiClient.get(`/api/quizzes/${selectedQuizForAnalytics._id}/analytics`);
      return response.data;
    },
    enabled: !!selectedQuizForAnalytics?._id && analyticsOpen,
  });

  const openAnalytics = (quiz) => {
    setSelectedQuizForAnalytics(quiz);
    setAnalyticsOpen(true);
  };

  const closeAnalytics = () => {
    setAnalyticsOpen(false);
    setSelectedQuizForAnalytics(null);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 800, margin: "40px auto", padding: "12px" }}>
          <Title backText="Back" href="/dashboard/manage_online_system">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/notepad.svg" alt="Quizzes" width={32} height={32} />
              Quizzes
            </div>
          </Title>
          
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
            <style jsx global>{`
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
        <Title backText="Back" href="/dashboard/manage_online_system">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/notepad.svg" alt="Quizzes" width={32} height={32} />
            Quizzes
          </div>
        </Title>

        {/* Search Bar */}
        <div className="search-bar-container" style={{ marginBottom: 20, width: '100%' }}>
          <InputWithButton
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            onButtonClick={handleSearch}
          />
        </div>

        {/* Filters */}
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
            marginBottom: 16,
            flexWrap: 'wrap'
          }}>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Grade
              </label>
              <GradeSelect
                selectedGrade={filterGrade}
                onGradeChange={(grade) => {
                  setFilterGrade(grade);
                }}
                isOpen={filterGradeDropdownOpen}
                onToggle={() => {
                  setFilterGradeDropdownOpen(!filterGradeDropdownOpen);
                  setFilterWeekDropdownOpen(false);
                  setFilterTimerDropdownOpen(false);
                }}
                onClose={() => setFilterGradeDropdownOpen(false)}
              />
            </div>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Week
              </label>
              <AttendanceWeekSelect
                selectedWeek={filterWeek}
                onWeekChange={(week) => {
                  setFilterWeek(week);
                }}
                isOpen={filterWeekDropdownOpen}
                onToggle={() => {
                  setFilterWeekDropdownOpen(!filterWeekDropdownOpen);
                  setFilterGradeDropdownOpen(false);
                  setFilterTimerDropdownOpen(false);
                }}
                onClose={() => setFilterWeekDropdownOpen(false)}
                placeholder="Select Week"
              />
            </div>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Timer
              </label>
              <TimerSelect
                value={filterTimer || null}
                onChange={(timer) => {
                  setFilterTimer(timer || '');
                }}
                placeholder="Select Timer"
                style={{ marginBottom: 0, hideLabel: true }}
                isOpen={filterTimerDropdownOpen}
                onToggle={() => {
                  setFilterTimerDropdownOpen(!filterTimerDropdownOpen);
                  setFilterGradeDropdownOpen(false);
                  setFilterWeekDropdownOpen(false);
                }}
                onClose={() => setFilterTimerDropdownOpen(false)}
              />
            </div>
          </div>
        </div>

        {/* White Background Container */}
        <div className="quizzes-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          {/* Add Button */}
          <div className="add-btn-container" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
            <button
              onClick={() => router.push('/dashboard/manage_online_system/quizzes/add')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#1FA8DC',
                color: 'white',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                fontSize: '1rem',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                boxShadow: '0 2px 8px rgba(31, 168, 220, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Image src="/plus.svg" alt="Add" width={23} height={23} style={{ marginRight: '6px', display: 'inline-block' }} />
              Add Quiz
            </button>
          </div>

          {/* Quizzes List */}
          {filteredQuizzes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              {quizzes.length === 0 ? '❌ No quizzes found. Click "Add Quiz" to create one.' : 'No quizzes match your filters.'}
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
                      {[quiz.grade, quiz.week !== undefined && quiz.week !== null ? `Week ${quiz.week}` : null, quiz.lesson_name].filter(Boolean).join(' • ')}
                    </div>
                    <div style={{ color: '#6c757d', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span>{quiz.questions?.length || 0} Question{quiz.questions?.length !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Image src="/clock.svg" alt="Timer" width={18} height={18} />
                        {quiz.timer ? `Timer ${quiz.timer} minute${quiz.timer !== 1 ? 's' : ''}` : 'No Timer'}
                      </span>
                      <span>•</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Image src="/clock.svg" alt="Deadline" width={18} height={18} />
                        {quiz.deadline_type === 'with_deadline' && quiz.deadline_date
                          ? (() => {
                              try {
                                // Parse date in local timezone to avoid timezone shift
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
                            })()
                          : 'With no deadline date'}
                      </span>
                    </div>
                  </div>
                  <div className="quiz-buttons" style={{ display: 'flex', gap: '12px' }}>
                    <button
                      onClick={() => openAnalytics(quiz)}
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
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Image src="/chart2.svg" alt="Analytics" width={18} height={18} style={{ display: 'inline-block' }} />
                      Analytics
                    </button>
                    <button
                      onClick={() => router.push(`/dashboard/manage_online_system/quizzes/edit?id=${quiz._id}`)}
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
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Image src="/edit.svg" alt="Edit" width={18} height={18} style={{ display: 'inline-block' }} />
                      Edit
                    </button>
                    <button
                      onClick={() => openConfirmDeleteModal(quiz)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: '600',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Image src="/trash2.svg" alt="Delete" width={18} height={18} style={{ display: 'inline-block' }} />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Success Message */}
          {successMessage && (
            <div style={{
              background: successMessage.startsWith('❌') ? '#fee2e2' : '#d4edda',
              color: successMessage.startsWith('❌') ? '#991b1b' : '#155724',
              borderRadius: 10,
              padding: 16,
              marginTop: 24,
              textAlign: 'center',
              fontWeight: 600,
              border: successMessage.startsWith('❌') ? '1.5px solid #fca5a5' : '1.5px solid #c3e6cb',
              fontSize: '1.1rem',
              boxShadow: successMessage.startsWith('❌') ? '0 4px 16px rgba(220, 53, 69, 0.08)' : '0 4px 16px rgba(40, 167, 69, 0.08)'
            }}>
              {successMessage}
            </div>
          )}
        </div>

        {/* Analytics Modal */}
        {analyticsOpen && (
          <div 
            className="analytics-modal-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  closeAnalytics();
                }
              }}
            >
              <div
                className="analytics-modal-content"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button 
                  className="analytics-close-btn" 
                  onClick={closeAnalytics} 
                  aria-label="Close"
                >
                  <Image src="/close-cross.svg" alt="Close" width={35} height={35} />
                </button>

              <div className="analytics-header">
                <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                  <Image src="/chart2.svg" alt="Analytics" width={32} height={32} />
                  Quiz Analytics
                </h2>
                {selectedQuizForAnalytics && (
                  <p className="analytics-subtitle">
                    {selectedQuizForAnalytics.grade} • Week {selectedQuizForAnalytics.week} • {selectedQuizForAnalytics.lesson_name}
                  </p>
                )}
              </div>
            
              {analyticsLoading ? (
                <div style={{ textAlign: 'center', padding: '60px 20px' }}>
                  <div style={{
                    width: "50px",
                    height: "50px",
                    border: "4px solid rgba(31, 168, 220, 0.2)",
                    borderTop: "4px solid #1FA8DC",
                    borderRadius: "50%",
                    margin: "0 auto 20px",
                    animation: "spin 1s linear infinite"
                  }} />
                  <p style={{ color: "#6c757d", fontSize: "1rem" }}>Loading analytics...</p>
                </div>
              ) : analyticsData?.analytics ? (
                <div style={{ marginBottom: '-25px' }}>
                  <QuizAnalyticsChart analyticsData={analyticsData.analytics} />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '60px 20px', color: '#6c757d' }}>
                  No analytics data available
                </div>
              )}

              {/* Statistics Grid - At the End */}
              {analyticsData?.analytics && !analyticsLoading && (
                <div className="analytics-stats-grid">
                  <div className="analytics-stat-item">
                    <div className="analytics-stat-value" style={{ color: '#a71e2a' }}>
                      {analyticsData.analytics.notAnswered}
                    </div>
                    <div className="analytics-stat-label">Not Answered</div>
                  </div>
                  <div className="analytics-stat-item">
                    <div className="analytics-stat-value" style={{ color: '#dc3545' }}>
                      {analyticsData.analytics.lessThan50}
                    </div>
                    <div className="analytics-stat-label">&lt; 50%</div>
                  </div>
                  <div className="analytics-stat-item">
                    <div className="analytics-stat-value" style={{ color: '#17a2b8' }}>
                      {analyticsData.analytics.between50And100}
                    </div>
                    <div className="analytics-stat-label">50-99%</div>
                  </div>
                  <div className="analytics-stat-item">
                    <div className="analytics-stat-value" style={{ color: '#28a745' }}>
                      {analyticsData.analytics.exactly100}
                    </div>
                    <div className="analytics-stat-label">100%</div>
                  </div>
                  <div className="analytics-stat-item">
                    <div className="analytics-stat-value" style={{ color: '#212529' }}>
                      {analyticsData.analytics.totalStudents}
                    </div>
                    <div className="analytics-stat-label">Total Students</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {confirmDeleteOpen && (
          <div className="confirm-modal" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handleDeleteCancel();
            }
          }}
          >
            <div
              className="confirm-content"
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '400px',
                width: '100%',
                boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: '16px', textAlign: 'center' }}>
                Confirm Delete
              </h3>
              <p style={{ textAlign: 'center', marginBottom: '24px', color: '#6c757d' }}>
                Are you sure you want to delete "{selectedQuiz?.lesson_name}"? This action cannot be undone.
              </p>
              <div className="confirm-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteQuizMutation.isLoading}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: deleteQuizMutation.isLoading ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    opacity: deleteQuizMutation.isLoading ? 0.7 : 1
                  }}
                >
                  {deleteQuizMutation.isLoading ? 'Deleting...' : 'Delete'}
                </button>
                <button
                  onClick={handleDeleteCancel}
                  disabled={deleteQuizMutation.isLoading}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: deleteQuizMutation.isLoading ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    opacity: deleteQuizMutation.isLoading ? 0.7 : 1
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .analytics-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
          padding: 20px;
        }
        .analytics-modal-content {
          position: relative;
          background: white;
          border-radius: 20px;
          padding: 40px;
          max-width: 900px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          animation: slideUp 0.3s ease;
          z-index: 10000;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        .analytics-close-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          border: none;
          font-size: 20px;
          color: white;
          cursor: pointer;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s ease;
          padding: 0;
          line-height: 1;
        }
        .analytics-close-btn:hover {
          transform: scale(1.1);
        }
        .analytics-close-btn:active {
          transform: scale(0.95);
        }
        .analytics-header {
          text-align: center;
          margin-bottom: 16px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e9ecef;
        }
        .analytics-header h2 {
          margin: 0 0 12px 0;
          font-size: 2rem;
          font-weight: 700;
          color: #1FA8DC;
          letter-spacing: -0.5px;
        }
        .analytics-subtitle {
          margin: 0;
          color: #6c757d;
          font-size: 1rem;
          font-weight: 500;
        }
        .analytics-stats-grid {
          padding: 24px;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-radius: 16px;
          display: flex;
          flex-direction: row;
          gap: 20px;
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.05);
          flex-wrap: wrap;
          justify-content: center;
        }
        .analytics-stat-item {
          text-align: center;
          padding: 16px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          transition: all 0.2s ease;
        }
        .analytics-stat-item:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
        }
        .analytics-stat-value {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 8px;
          line-height: 1;
        }
        .analytics-stat-label {
          font-size: 0.875rem;
          color: #6c757d;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        @media (max-width: 768px) {
          .analytics-modal-overlay {
            padding: 10px;
            align-items: center;
            justify-content: center;
          }
          .analytics-modal-content {
            padding: 30px 20px;
            border-radius: 16px;
            max-width: 100%;
            width: 100%;
            max-height: 95vh;
            margin: 0;
          }
          .analytics-close-btn {
            top: 15px;
            right: 15px;
            width: 32px;
            height: 32px;
            font-size: 18px;
          }
          .analytics-header {
            padding-bottom: 16px;
            margin-bottom: 12px;
          }
          .analytics-header h2 {
            font-size: 1.5rem;
            margin-bottom: 8px;
          }
          .analytics-subtitle {
            font-size: 0.9rem;
          }
          .analytics-stats-grid {
            gap: 12px;
            padding: 16px;
            flex-wrap: wrap;
          }
          .analytics-stat-item {
            padding: 12px;
            flex: 1 1 calc(50% - 6px);
            min-width: calc(50% - 6px);
            max-width: calc(50% - 6px);
          }
          .analytics-stat-value {
            font-size: 1.5rem;
          }
          .analytics-stat-label {
            font-size: 0.8rem;
          }
        }
        @media (max-width: 480px) {
          .analytics-modal-overlay {
            padding: 5px;
            align-items: center;
            justify-content: center;
          }
          .analytics-modal-content {
            padding: 24px 16px;
            max-height: 95vh;
            border-radius: 12px;
          }
          .analytics-close-btn {
            top: 10px;
            right: 10px;
            width: 28px;
            height: 28px;
            font-size: 16px;
          }
          .analytics-header {
            padding-bottom: 12px;
            margin-bottom: 10px;
          }
          .analytics-header h2 {
            font-size: 1.3rem;
            margin-bottom: 6px;
          }
          .analytics-subtitle {
            font-size: 0.85rem;
          }
          .analytics-stats-grid {
            gap: 10px;
            padding: 12px;
            flex-wrap: wrap;
            border-radius: 12px;
          }
          .analytics-stat-item {
            padding: 10px;
            flex: 1 1 calc(50% - 5px);
            min-width: calc(50% - 5px);
            max-width: calc(50% - 5px);
          }
          .analytics-stat-value {
            font-size: 1.3rem;
          }
          .analytics-stat-label {
            font-size: 0.75rem;
          }
        }
        @media (max-width: 768px) {
          .page-wrapper {
            padding: 10px 5px;
          }
          .page-content {
            padding: 8px;
            margin: 20px auto;
          }
          .filters-container {
            padding: 16px !important;
          }
          .filter-group {
            flex: 1 1 100% !important;
            min-width: 100% !important;
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
            flex-direction: column;
          }
          .quiz-buttons button {
            width: 100%;
          }
        }
        @media (min-width: 769px) and (max-width: 1024px) {
          .filter-group {
            flex: 1 1 calc(50% - 6px) !important;
            min-width: calc(50% - 6px) !important;
          }
        }
        @media (max-width: 480px) {
          .page-wrapper {
            padding: 5px;
          }
          .page-content {
            padding: 5px;
            margin: 10px auto;
          }
          .quizzes-container {
            padding: 12px;
          }
          .add-btn-container button {
            width: 100%;
            font-size: 0.9rem;
            padding: 10px 20px;
          }
          .confirm-modal {
            padding: 10px !important;
          }
          
          .confirm-content {
            margin: 5px;
          }
          
          .confirm-content h3 {
            font-size: 1.1rem !important;
            margin-bottom: 12px !important;
          }
          
          .confirm-content p {
            font-size: 0.9rem !important;
            margin-bottom: 20px !important;
          }
          
          .confirm-content button {
            padding: 8px 16px !important;
            font-size: 0.9rem !important;
          }
        }
        @media (max-width: 360px) {
          .analytics-modal-overlay {
            padding: 5px;
            align-items: center;
            justify-content: center;
          }
          .analytics-modal-content {
            padding: 20px 12px;
            border-radius: 10px;
          }
          .analytics-close-btn {
            top: 8px;
            right: 8px;
            width: 24px;
            height: 24px;
            font-size: 14px;
          }
          .analytics-header h2 {
            font-size: 1.1rem;
          }
          .analytics-subtitle {
            font-size: 0.8rem;
          }
          .analytics-stats-grid {
            gap: 8px;
            padding: 10px;
          }
          .analytics-stat-item {
            padding: 8px;
            flex: 1 1 100%;
            min-width: 100%;
            max-width: 100%;
          }
          .analytics-stat-value {
            font-size: 1.1rem;
          }
          .analytics-stat-label {
            font-size: 0.7rem;
          }
          .quizzes-container {
            padding: 10px;
          }
        }
      `}</style>
    </div>
  );
}

