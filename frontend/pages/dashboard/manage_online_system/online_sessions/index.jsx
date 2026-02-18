import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from '../../../../components/Title';
import AttendanceWeekSelect from '../../../../components/AttendanceWeekSelect';
import GradeSelect from '../../../../components/GradeSelect';
import OnlineSessionPaymentStateSelect from '../../../../components/OnlineSessionPaymentStateSelect';
import R2VideoPlayer from '../../../../components/R2VideoPlayer';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../../lib/axios';
import { useSystemConfig } from '../../../../lib/api/system';
import { TextInput, ActionIcon, useMantineTheme } from '@mantine/core';
import { IconSearch, IconArrowRight } from '@tabler/icons-react';

// Extract YouTube video ID from URL
function extractYouTubeId(url) {
  const match = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

// Extract week number from week string (e.g., "week 01" -> 1)
function extractWeekNumber(weekString) {
  if (!weekString) return null;
  const match = weekString.match(/week\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

// Convert week number to week string (e.g., 1 -> "week 01")
function weekNumberToString(weekNumber) {
  if (weekNumber === null || weekNumber === undefined) return '';
  return `week ${String(weekNumber).padStart(2, '0')}`;
}

// Build embed URL
function buildEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?controls=1&rel=0&modestbranding=1&disablekb=1&fs=1`;
}


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

export default function OnlineSessions() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: systemConfig } = useSystemConfig();
  const isOnlineVideosEnabled = systemConfig?.online_videos === true || systemConfig?.online_videos === 'true';
  const [videoPopupOpen, setVideoPopupOpen] = useState(false);
  
  // Redirect if feature is disabled
  useEffect(() => {
    if (systemConfig && !isOnlineVideosEnabled) {
      router.push('/dashboard/manage_online_system');
    }
  }, [systemConfig, isOnlineVideosEnabled, router]);
  
  // Don't render if feature is disabled
  if (systemConfig && !isOnlineVideosEnabled) {
    return null;
  }
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'session' | 'video', id: string, videoId?: string }
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  const [successMessage, setSuccessMessage] = useState('');
  const videoContainerRef = useRef(null);
  const successTimeoutRef = useRef(null);
  const errorTimeoutRef = useRef(null);
  const sessionItemRefs = useRef({});
  
  // Search and filter states
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  const [filterPaymentState, setFilterPaymentState] = useState('');
  const [filterGradeDropdownOpen, setFilterGradeDropdownOpen] = useState(false);
  const [filterWeekDropdownOpen, setFilterWeekDropdownOpen] = useState(false);
  const [filterPaymentStateDropdownOpen, setFilterPaymentStateDropdownOpen] = useState(false);

  // Fetch online sessions
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['online_sessions'],
    queryFn: async () => {
      const response = await apiClient.get('/api/online_sessions');
      return response.data;
    },
    refetchInterval: false, // No auto-refresh - only manual refresh
    refetchOnWindowFocus: true, // refetch on window focus
    refetchOnMount: true, // refetch on mount if data exists
    refetchOnReconnect: true, // refetch on reconnect
  });

  const sessions = sessionsData?.sessions || [];

  // Filter sessions based on search and filters
  const filteredSessions = sessions.filter(session => {
    // Search filter (contains, case-insensitive)
    if (searchTerm.trim()) {
      const lessonName = session.name || '';
      if (!lessonName.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
    }

    // Grade filter
    if (filterGrade) {
      if (session.grade !== filterGrade) {
        return false;
      }
    }

    // Week filter
    if (filterWeek) {
      const weekNumber = extractWeekNumber(filterWeek);
      if (session.week !== weekNumber) {
        return false;
      }
    }

    // Payment state filter
    if (filterPaymentState) {
      if (session.payment_state !== filterPaymentState) {
        return false;
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


  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiClient.delete(`/api/online_sessions?id=${id}`);
      return response.data;
    },
    onSuccess: () => {
      setSuccessMessage('✅ Session deleted successfully!');
      setConfirmDeleteOpen(false);
      setDeleteTarget(null);
      queryClient.invalidateQueries(['online_sessions']);
      
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage('');
      }, 6000);
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.error || 'Failed to delete session';
      const error = errorMsg.startsWith('❌') ? errorMsg : `❌ ${errorMsg}`;
      setErrors({ general: error });
      setConfirmDeleteOpen(false);
      
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
    },
  });

  // Toggle session expansion (only one can be open at a time)
  const toggleSession = (index) => {
    if (expandedSessions.has(index)) {
      // If clicking on an already expanded session, close it
      setExpandedSessions(new Set());
    } else {
      // If opening a new session, close all others and open only this one
      setExpandedSessions(new Set([index]));
    }
  };

  // Handle click outside to collapse expanded sessions (mobile only)
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Only handle on mobile (check if mobile layout is active)
      const isMobile = window.innerWidth <= 768;
      if (!isMobile) return;

      // Check if click is outside any session item
      let clickedInsideAnySession = false;
      Object.values(sessionItemRefs.current).forEach((ref) => {
        if (ref && ref.contains(event.target)) {
          clickedInsideAnySession = true;
        }
      });

      // If clicked outside all session items and any session is expanded, collapse all
      if (!clickedInsideAnySession && expandedSessions.size > 0) {
        setExpandedSessions(new Set());
      }
    };

    // Only add listener if on mobile and there are expanded sessions
    if (window.innerWidth <= 768 && expandedSessions.size > 0) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [expandedSessions]);

  // Open video popup
  const openVideoPopup = (session, videoId, videoType) => {
    // videoType: 'youtube' or 'vdocipher'
    // videoId: the video ID for that type
    setSelectedVideo({ ...session, video_ID: videoId, video_type: videoType || 'youtube' });
    setVideoPopupOpen(true);
  };

  // Close video popup
  const closeVideoPopup = () => {
    setVideoPopupOpen(false);
    setSelectedVideo(null);
  };

  // Open edit page
  const openEditPage = (session) => {
    router.push(`/dashboard/manage_online_system/online_sessions/edit?id=${session._id}`);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (deleteTarget && deleteTarget.type === 'session') {
      deleteSessionMutation.mutate(deleteTarget.id);
    }
  };

  // Open delete confirmation
  const openDeleteConfirm = (session) => {
    setDeleteTarget({ type: 'session', id: session._id });
    setConfirmDeleteOpen(true);
  };


  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="page-wrapper" style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div className="page-content" style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
        <Title backText="Back" href="/dashboard/manage_online_system">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/video.svg" alt="Videos" width={35} height={35} />
            Online Sessions
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
                  setFilterPaymentStateDropdownOpen(false);
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
                  setFilterPaymentStateDropdownOpen(false);
                }}
                onClose={() => setFilterWeekDropdownOpen(false)}
                placeholder="Select Week"
              />
            </div>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Payment State
              </label>
              <OnlineSessionPaymentStateSelect
                value={filterPaymentState || null}
                onChange={(state) => {
                  setFilterPaymentState(state || '');
                }}
                placeholder="Select Payment State"
                style={{ marginBottom: 0, hideLabel: true }}
                isOpen={filterPaymentStateDropdownOpen}
                onToggle={() => {
                  setFilterPaymentStateDropdownOpen(!filterPaymentStateDropdownOpen);
                  setFilterGradeDropdownOpen(false);
                  setFilterWeekDropdownOpen(false);
                }}
                onClose={() => setFilterPaymentStateDropdownOpen(false)}
              />
            </div>
          </div>
        </div>

        {/* White Background Container */}
        <div className="sessions-container">

      {/* Removed: Add and Edit Video Popups - Now using dedicated pages */}

      {/* Delete Confirmation Modal */}
      {confirmDeleteOpen && deleteTarget && (
        <div
          className="confirm-modal"
          style={{
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
              setConfirmDeleteOpen(false);
              setDeleteTarget(null);
            }
          }}
        >
          <div
            className="confirm-content"
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '16px', textAlign: 'center' }}>
              Confirm Delete
            </h3>
            <p style={{ textAlign: 'center', marginBottom: '24px', color: '#6c757d' }}>
              {(() => {
                const sessionToDelete = sessions.find(s => s._id === deleteTarget.id);
                return `Are you sure you want to delete "${sessionToDelete?.name || 'this session'}"? This action cannot be undone.`;
              })()}
            </p>
            <div className="confirm-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteSessionMutation.isLoading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: deleteSessionMutation.isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  opacity: deleteSessionMutation.isLoading ? 0.7 : 1
                }}
              >
                {deleteSessionMutation.isLoading ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setConfirmDeleteOpen(false);
                  setDeleteTarget(null);
                }}
                disabled={deleteSessionMutation.isLoading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: deleteSessionMutation.isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  opacity: deleteSessionMutation.isLoading ? 0.7 : 1
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Video Button */}
      <div className="add-video-btn-container" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          className="add-video-btn"
          onClick={() => router.push('/dashboard/manage_online_system/online_sessions/add')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#1FA8DC',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 8px rgba(31, 168, 220, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Image src="/plus.svg" alt="Add" width={23} height={23} style={{ marginRight: '6px', display: 'inline-block' }} />
          Add Video
        </button>
      </div>

      {/* Video List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>Loading sessions...</div>
      ) : filteredSessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
          {sessions.length === 0 ? 'No sessions yet. Add your first video!' : 'No sessions match your filters.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {filteredSessions.map((session, index) => {
            // Calculate video length (count of videos)
            let videoLength = 0;
            let videoIndex = 1;
            while (session[`video_ID_${videoIndex}`]) {
              videoLength++;
              videoIndex++;
            }
            
            return (
                <div
                  key={index}
                  ref={(el) => {
                    if (el) {
                      sessionItemRefs.current[index] = el;
                    } else {
                      delete sessionItemRefs.current[index];
                    }
                  }}
                  className="session-item"
                  onClick={() => toggleSession(index)}
                  style={{
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                    padding: '16px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Desktop Layout */}
              <div className="session-item-desktop">
              {/* Header with Edit/Delete buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#333', marginBottom: '4px' }}>
                    {[session.grade, session.week !== undefined && session.week !== null ? `Week ${session.week}` : null, session.name].filter(Boolean).join(' • ')}
                  </div>
                    <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '4px' }}>
                      {[session.payment_state || 'paid', `${videoLength} video${videoLength !== 1 ? 's' : ''}`, session.date].filter(Boolean).join(' • ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditPage(session); }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#1FA8DC',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Edit session"
                  >
                    <Image src="/edit.svg" alt="Edit" width={18} height={18} style={{ display: 'inline-block' }} />
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openDeleteConfirm(session); }}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Delete session"
                  >
                    <Image src="/trash2.svg" alt="Delete" width={18} height={18} style={{ display: 'inline-block' }} />
                    Delete
                    </button>
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                        color: '#1FA8DC',
                        cursor: 'pointer',
                        marginLeft: '8px'
                      }}
                    >
                    {expandedSessions.has(index) ? (
                      <Image src="/chevron-down.svg" alt="Collapse" width={20} height={20} />
                    ) : (
                      <Image src="/chevron-right.svg" alt="Expand" width={20} height={20} />
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {expandedSessions.has(index) && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #eee' }}>
                  {/* Get all video IDs from session */}
                  {(() => {
                    const videoIds = [];
                    let videoIndex = 1;
                      while (session[`video_ID_${videoIndex}`]) {
                        videoIds.push({
                          id: session[`video_ID_${videoIndex}`],
                          index: videoIndex,
                          name: session[`video_name_${videoIndex}`] || null
                        });
                        videoIndex++;
                      }
                      return videoIds.map((video, vidIndex) => {
                        // Get video type, default to 'youtube' for backward compatibility
                        const videoType = session[`video_type_${video.index}`] || 'youtube';
                        // Get video name, default to "Video {index}" if not set
                        const videoName = video.name || `Video ${video.index}`;
                        return (
                          <div key={vidIndex} style={{ marginBottom: vidIndex < videoIds.length - 1 ? '12px' : '0' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                              <div
                                onClick={(e) => { e.stopPropagation(); openVideoPopup(session, video.id, videoType); }}
                                style={{
                                  flex: 1,
                                  padding: '10px 15px',
                                  backgroundColor: '#1FA8DC',
                                  color: 'white',
                                  borderRadius: '6px',
                                  textAlign: 'center',
                                  fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                               <Image src="/play.svg" alt="Video" width={20} height={20} style={{ display: 'inline-block' }} />
                               {videoName}
                              </div>
                            </div>
                          </div>
                        );
                      });
                  })()}
                </div>
              )}
            </div>

              {/* Mobile Layout */}
              <div className="session-item-mobile">
                {/* Title with Toggle */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#333', flex: 1 }}>
                    {[session.grade, session.week !== undefined && session.week !== null ? `Week ${session.week}` : null, session.name].filter(Boolean).join(' • ')}
                  </div>
                  <div 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      width: '32px',
                      height: '32px',
                      color: '#1FA8DC',
                      cursor: 'pointer',
                      marginLeft: '8px'
                    }}
                  >
                    {expandedSessions.has(index) ? (
                      <Image src="/chevron-down.svg" alt="Collapse" width={20} height={20} />
                    ) : (
                      <Image src="/chevron-right.svg" alt="Expand" width={20} height={20} />
                    )}
                  </div>
                </div>
                {/* Metadata */}
                <div style={{ fontSize: '0.9rem', color: '#6c757d', marginBottom: '12px' }}>
                  {[session.payment_state || 'paid', `${videoLength} video${videoLength !== 1 ? 's' : ''}`, session.date].filter(Boolean).join(' • ')}
                </div>
                {/* Edit/Delete Buttons */}
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '15px' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditPage(session); }}
                    style={{
                      padding: '5px 20px',
                      backgroundColor: '#1FA8DC',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '500'
                    }}
                    title="Edit session"
                  >
                    <Image src="/edit.svg" alt="Edit" width={18} height={18} style={{ display: 'inline-block' }} />
                    Edit
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); openDeleteConfirm(session); }}
                    style={{
                      padding: '5px 20px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '500'
                    }}
                    title="Delete session"
                  >
                    <Image src="/trash2.svg" alt="Delete" width={18} height={18} style={{ display: 'inline-block' }} />
                    Delete
                  </button>
                </div>
                {/* Video Buttons - Collapsible on mobile */}
                {expandedSessions.has(index) && (
                  <div style={{ marginTop: '12px' }}>
                    {(() => {
                      const videoIds = [];
                      let videoIndex = 1;
                      while (session[`video_ID_${videoIndex}`]) {
                        videoIds.push({
                          id: session[`video_ID_${videoIndex}`],
                          index: videoIndex,
                          name: session[`video_name_${videoIndex}`] || null
                        });
                        videoIndex++;
                      }
                      return videoIds.map((video, vidIndex) => {
                        // Get video type, default to 'youtube' for backward compatibility
                        const videoType = session[`video_type_${video.index}`] || 'youtube';
                        // Get video name, default to "Video {index}" if not set
                        const videoName = video.name || `Video ${video.index}`;
                        return (
                          <div key={vidIndex} style={{ marginBottom: vidIndex < videoIds.length - 1 ? '12px' : '0' }}>
                            <div
                              onClick={(e) => { e.stopPropagation(); openVideoPopup(session, video.id, videoType); }}
                              style={{
                                width: '100%',
                                padding: '10px 15px',
                                backgroundColor: '#1FA8DC',
                                color: 'white',
                                borderRadius: '8px',
                                textAlign: 'center',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                fontSize: '1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px'
                              }}
                            >
                              <Image src="/play.svg" alt="Video" width={20} height={20} style={{ display: 'inline-block' }} />
                              {videoName}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>
          );
          })}
        </div>
      )}

          {/* Success message - at bottom */}
          {successMessage && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#d4edda',
              color: '#155724',
              borderRadius: '8px',
              marginTop: '24px',
              border: '1px solid #c3e6cb',
              textAlign: 'center'
            }}>
              {successMessage}
            </div>
          )}
        </div>

      {/* Video Player Popup */}
      {videoPopupOpen && selectedVideo && (
        <div
          className="video-popup-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeVideoPopup();
            }
          }}
        >
          <div
            ref={videoContainerRef}
            className="video-player-container"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: '900px',
              backgroundColor: '#000',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              WebkitTouchCallout: 'none',
              WebkitTapHighlightColor: 'transparent'
            }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
            onSelectStart={(e) => e.preventDefault()}
          >
            {/* Close Button */}
            <button
              onClick={closeVideoPopup}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                zIndex: 10,
                
                color: 'white',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s ease',
                lineHeight: '1',
                fontWeight: 'bold'
              }}
              onMouseEnter={(e) => {
                
                e.target.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
        
                e.target.style.transform = 'scale(1)';
              }}
            >
              <Image src="/close-cross.svg" alt="Close" width={35} height={35} />
            </button>

            {/* Video Title */}
            <div style={{
              padding: '16px',
              backgroundColor: '#1a1a1a',
              color: 'white',
              borderBottom: '1px solid #333'
            }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>{selectedVideo.name}</h3>
            </div>

            {/* Video Iframe */}
            <div 
              className="video-player-wrapper"
              style={{ 
                position: 'relative', 
                width: '100%',
                height: 'auto',
                maxHeight: '100vh',
                overflow: 'hidden',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                pointerEvents: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onContextMenu={(e) => e.preventDefault()}
              onDragStart={(e) => e.preventDefault()}
              onSelectStart={(e) => e.preventDefault()}
            >
              {selectedVideo.video_type === 'r2' ? (
                <R2VideoPlayer
                  r2Key={selectedVideo.video_ID || selectedVideo.video_ID_1 || ''}
                />
              ) : (
                <iframe
                  src={buildEmbedUrl(selectedVideo.video_ID || selectedVideo.video_ID_1 || '')}
                  frameBorder="0"
                  allow="encrypted-media; autoplay; fullscreen; picture-in-picture"
                  allowFullScreen={true}
                  playsInline={true}
                  style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '100vh',
                    aspectRatio: '16 / 9',
                    border: 'none',
                    outline: 'none'
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                  onSelectStart={(e) => e.preventDefault()}
                  draggable={false}
                />
              )}
            </div>

            {/* Video Description */}
            {selectedVideo.description && (
              <div style={{
                padding: '16px',
                backgroundColor: '#1a1a1a',
                color: '#ccc',
                fontSize: '0.9rem',
                lineHeight: '1.5'
              }}>
                {selectedVideo.description}
              </div>
            )}
          </div>
        </div>
      )}

        <style jsx>{`
          .sessions-container {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            overflow-x: auto;
          }
          
          .session-item-desktop {
            display: block;
          }
          
          .session-item-mobile {
            display: none;
          }
          
          .add-video-btn-container {
            display: flex;
            justify-content: flex-end;
          }
          
          .video-player-wrapper {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
            -webkit-touch-callout: none !important;
            -webkit-tap-highlight-color: transparent !important;
            pointer-events: auto;
          }
          
          .video-player-wrapper iframe {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
          }
          
          .video-player-container {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
            -webkit-touch-callout: none !important;
            -webkit-tap-highlight-color: transparent !important;
          }
          
          .video-player-container * {
            -webkit-user-select: none !important;
            -moz-user-select: none !important;
            -ms-user-select: none !important;
            user-select: none !important;
            -webkit-touch-callout: none !important;
          }
          
          @media print {
            .video-player-container,
            .video-player-wrapper {
              display: none !important;
            }
          }
          
          @media (max-width: 768px) {
            .page-wrapper {
              padding: 10px 5px 10px 5px !important;
            }
            
            .page-content {
              margin: 20px auto !important;
            }
            
            .filters-container {
              padding: 16px !important;
            }
            
            .filter-group {
              flex: 1 1 100% !important;
              min-width: 100% !important;
            }
            
            .sessions-container {
              padding: 16px !important;
            }
            
            .session-item-desktop {
              display: none !important;
            }
            
            .session-item-mobile {
              display: block !important;
            }
            
            .add-video-btn-container {
              justify-content: stretch;
            }
            
            .add-video-btn {
              width: 100% !important;
            }
            
            .add-video-popup-overlay {
              padding: 15px !important;
            }
            
            .add-video-popup {
              padding: 20px !important;
              max-width: 100% !important;
              margin: 10px;
            }
            
            .video-popup-overlay {
              padding: 10px !important;
            }
            
            .video-player-container {
              max-width: 100% !important;
              border-radius: 8px !important;
            }
            
            .video-player-container h3 {
              font-size: 1rem !important;
              padding: 12px !important;
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
              padding: 5px !important;
            }
            
            .page-content {
              margin: 10px auto !important;
            }
            
            .sessions-container {
              padding: 12px;
              border-radius: 12px !important;
            }
            
            .add-video-popup-overlay {
              padding: 10px !important;
            }
            
            .add-video-popup {
              padding: 16px !important;
              border-radius: 8px !important;
            }
            
            .add-video-popup h2 {
              font-size: 1.2rem !important;
              margin-bottom: 16px !important;
            }
            
            .video-popup-overlay {
              padding: 5px !important;
            }
            
            .video-player-container {
              border-radius: 0 !important;
            }
            
            .video-player-container h3 {
              font-size: 0.9rem !important;
              padding: 12px !important;
            }
            
            .confirm-modal-overlay {
              padding: 10px !important;
            }
            
            .confirm-modal {
              padding: 16px !important;
              border-radius: 8px !important;
            }
            
            .confirm-modal h3 {
              font-size: 1.1rem !important;
              margin-bottom: 12px !important;
            }
            
            .confirm-modal p {
              font-size: 0.9rem !important;
              margin-bottom: 20px !important;
            }
            
            .confirm-modal button {
              padding: 8px 16px !important;
              font-size: 0.9rem !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

