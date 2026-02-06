import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from '../../components/Title';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import { useProfile } from '../../lib/api/auth';
import { useSystemConfig } from '../../lib/api/system';
import NeedHelp from '../../components/NeedHelp';
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

// Build embed URL
function buildEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}?controls=1&rel=0&modestbranding=1&disablekb=1&fs=1`;
}


export default function OnlineSessions() {
  const { data: systemConfig } = useSystemConfig();
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';
  const isOnlineVideosEnabled = systemConfig?.online_videos === true || systemConfig?.online_videos === 'true';
  
  const router = useRouter();
  const { data: profile } = useProfile();
  
  // Redirect if feature is disabled
  useEffect(() => {
    if (systemConfig && !isOnlineVideosEnabled) {
      router.push('/student_dashboard');
    }
  }, [systemConfig, isOnlineVideosEnabled, router]);
  
  // Don't render if feature is disabled
  if (systemConfig && !isOnlineVideosEnabled) {
    return null;
  }
  const [expandedSessions, setExpandedSessions] = useState(new Set());
  const [videoPopupOpen, setVideoPopupOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const videoContainerRef = useRef(null);
  const videoStartTimeRef = useRef(null); // Track when video was opened
  const isClosingVideoRef = useRef(false); // Prevent multiple close calls
  const [vvcPopupOpen, setVvcPopupOpen] = useState(false);
  const [vvc, setVvc] = useState('');
  const [vvcError, setVvcError] = useState('');
  const [isCheckingVvc, setIsCheckingVvc] = useState(false);
  const [pendingVideo, setPendingVideo] = useState(null); // Store video info while waiting for VVC
  const [unlockedSessions, setUnlockedSessions] = useState(new Map()); // Store unlocked sessions with VVC info

  // Fetch online sessions
  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ['online_sessions-student'],
    queryFn: async () => {
      const response = await apiClient.get('/api/online_sessions/student');
      return response.data;
    },
    refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 minutes
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    refetchOnWindowFocus: true, // Refetch on window focus
    refetchOnMount: true, // Refetch on mount
    refetchOnReconnect: true, // Refetch on reconnect
  });

  const sessions = sessionsData?.sessions || [];

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

  // Get available weeks from sessions (only weeks that exist in the data)
  const getAvailableWeeks = () => {
    const weekSet = new Set();
    sessions.forEach(session => {
      if (session.week !== undefined && session.week !== null) {
        weekSet.add(weekNumberToString(session.week));
      }
    });
    return Array.from(weekSet).sort((a, b) => {
      const aNum = extractWeekNumber(a);
      const bNum = extractWeekNumber(b);
      return (aNum || 0) - (bNum || 0);
    });
  };

  const availableWeeks = getAvailableWeeks();

  // Filter sessions based on search and filters
  const filteredSessions = sessions.filter(session => {
    // Search filter (by lesson name - case-insensitive)
    if (searchTerm.trim()) {
      const lessonName = session.name || '';
      if (!lessonName.toLowerCase().includes(searchTerm.toLowerCase())) {
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


  // Toggle session expansion (only one can be open at a time)
  const toggleSession = (sessionId) => {
    if (expandedSessions.has(sessionId)) {
      // If clicking on an already expanded session, close it
      setExpandedSessions(new Set());
    } else {
      // If opening a new session, close all others and open only this one
      setExpandedSessions(new Set([sessionId]));
    }
  };


  // Helper function to check if video is unlocked
  const isVideoUnlocked = (session) => {
    if (session.payment_state === 'free') {
      return true; // Free videos are always unlocked
    } else if (session.payment_state === 'paid') {
      // Check if session is in unlockedSessions
      const sessionId = session._id?.toString() || session._id;
      const unlockedInfo = unlockedSessions.get(sessionId);
      
      if (!unlockedInfo) {
        return false; // Not unlocked yet
      }
      
      // Check deadline date if code_settings is 'deadline_date'
      if (unlockedInfo.code_settings === 'deadline_date' && unlockedInfo.deadline_date) {
        const deadlineDate = new Date(unlockedInfo.deadline_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        deadlineDate.setHours(0, 0, 0, 0);
        
        if (deadlineDate <= today) {
          // Expired - remove from unlocked sessions
          const newUnlocked = new Map(unlockedSessions);
          newUnlocked.delete(sessionId);
          setUnlockedSessions(newUnlocked);
          return false;
        }
      } else if (unlockedInfo.code_settings === 'number_of_views') {
        // Check if views are remaining
        if (unlockedInfo.number_of_views <= 0) {
          // No views remaining - remove from unlocked sessions
          const newUnlocked = new Map(unlockedSessions);
          newUnlocked.delete(sessionId);
          setUnlockedSessions(newUnlocked);
          return false;
        }
      }
      
      return true; // Unlocked and valid
    }
    return false; // Default to locked
  };

  // Handle VVC submission
  const handleVVCSubmit = async () => {
    if (!vvc || vvc.length !== 9) {
      setVvcError('❌ VVC code must be 9 characters');
      return;
    }

    if (!pendingVideo) {
      setVvcError('❌ No video pending');
      return;
    }

    setIsCheckingVvc(true);
    setVvcError('');

    try {
      const sessionId = typeof pendingVideo.session._id === 'string' 
        ? pendingVideo.session._id 
        : pendingVideo.session._id.toString();

      const response = await apiClient.post('/api/vvc/check', {
        VVC: vvc,
        session_id: sessionId
      });

      if (response.data.valid) {
        // VVC is valid - unlock video
        const sessionId = typeof pendingVideo.session._id === 'string' 
          ? pendingVideo.session._id 
          : pendingVideo.session._id.toString();
        
        // Store unlocked session info
        const newUnlocked = new Map(unlockedSessions);
        newUnlocked.set(sessionId, {
          vvc_id: response.data.vvc_id,
          code_settings: response.data.code_settings || 'number_of_views',
          number_of_views: response.data.number_of_views || null,
          deadline_date: response.data.deadline_date || null
        });
        setUnlockedSessions(newUnlocked);
        
        setVvcPopupOpen(false);
        setSelectedVideo({ 
          ...pendingVideo.session, 
          video_ID: pendingVideo.videoId, 
          video_type: pendingVideo.videoType,
          vvc_id: response.data.vvc_id,
          code_settings: response.data.code_settings || 'number_of_views',
          number_of_views: response.data.number_of_views || null,
          deadline_date: response.data.deadline_date || null
        });
        setVideoPopupOpen(true);
        videoStartTimeRef.current = Date.now();
        setPendingVideo(null);
        setVvc('');
        
        // Decrement views if code_settings is 'number_of_views'
        if (response.data.code_settings === 'number_of_views' && response.data.vvc_id) {
          try {
            await apiClient.post('/api/vvc/decrement-views', {
              vvc_id: response.data.vvc_id
            });
            // Update unlocked sessions with new view count
            const updatedUnlocked = new Map(newUnlocked);
            const sessionInfo = updatedUnlocked.get(sessionId);
            if (sessionInfo && sessionInfo.number_of_views > 0) {
              sessionInfo.number_of_views -= 1;
              updatedUnlocked.set(sessionId, sessionInfo);
              setUnlockedSessions(updatedUnlocked);
            }
          } catch (err) {
            console.error('Failed to decrement views:', err);
          }
        }
      } else {
        setVvcError(response.data.error || '❌ Invalid VVC code');
      }
    } catch (err) {
      setVvcError(err.response?.data?.error || '❌ Failed to verify VVC code');
    } finally {
      setIsCheckingVvc(false);
    }
  };

  // Close VVC popup
  const closeVvcPopup = () => {
    setVvcPopupOpen(false);
    setPendingVideo(null);
    setVvc('');
    setVvcError('');
  };

  // Open video popup
  const openVideoPopup = async (session, videoId, videoIndex) => {
    // Get video type, default to 'youtube' for backward compatibility
    const videoType = session[`video_type_${videoIndex}`] || 'youtube';
    
    // Check if video is unlocked
    if (isVideoUnlocked(session)) {
      // Video is unlocked - check deadline date and decrement views if needed
      const sessionId = session._id?.toString() || session._id;
      const unlockedInfo = unlockedSessions.get(sessionId);
      
      if (unlockedInfo) {
        // Check deadline date expiration
        if (unlockedInfo.code_settings === 'deadline_date' && unlockedInfo.deadline_date) {
          const deadlineDate = new Date(unlockedInfo.deadline_date);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          deadlineDate.setHours(0, 0, 0, 0);
          
          if (deadlineDate <= today) {
            // Expired
            setVvcError('❌ Sorry, This code is expired');
            const newUnlocked = new Map(unlockedSessions);
            newUnlocked.delete(sessionId);
            setUnlockedSessions(newUnlocked);
            return;
          }
        }
        
        // Decrement views if code_settings is 'number_of_views'
        if (unlockedInfo.code_settings === 'number_of_views' && unlockedInfo.vvc_id) {
          try {
            const decrementResponse = await apiClient.post('/api/vvc/decrement-views', {
              vvc_id: unlockedInfo.vvc_id
            });
            
            if (decrementResponse.data.success) {
              // Update unlocked sessions with new view count
              const updatedUnlocked = new Map(unlockedSessions);
              const sessionInfo = updatedUnlocked.get(sessionId);
              if (sessionInfo) {
                sessionInfo.number_of_views = decrementResponse.data.number_of_views;
                if (sessionInfo.number_of_views <= 0) {
                  // No views remaining - remove from unlocked
                  updatedUnlocked.delete(sessionId);
                } else {
                  updatedUnlocked.set(sessionId, sessionInfo);
                }
                setUnlockedSessions(updatedUnlocked);
              }
            }
          } catch (err) {
            console.error('Failed to decrement views:', err);
            if (err.response?.data?.error?.includes('no views remaining')) {
              // Remove from unlocked sessions
              const newUnlocked = new Map(unlockedSessions);
              newUnlocked.delete(sessionId);
              setUnlockedSessions(newUnlocked);
              setVvcError('❌ Sorry, this code has no views remaining');
              return;
            }
          }
        }
      }
      
      // Video is unlocked - open directly
      setSelectedVideo({ 
        ...session, 
        video_ID: videoId, 
        video_type: videoType,
        vvc_id: unlockedInfo?.vvc_id,
        code_settings: unlockedInfo?.code_settings,
        number_of_views: unlockedInfo?.number_of_views,
        deadline_date: unlockedInfo?.deadline_date
      });
      setVideoPopupOpen(true);
      videoStartTimeRef.current = Date.now();
    } else {
      // Video is locked - require VVC
      setPendingVideo({ session, videoId, videoIndex, videoType });
      setVvcPopupOpen(true);
      setVvc('');
      setVvcError('');
    }
  };

  // Close video popup and mark attendance
  const closeVideoPopup = async () => {
    // Prevent multiple calls
    if (isClosingVideoRef.current) {
      return;
    }
    
    // Only decrement views and mark attendance if video was actually watched
    // (at least 5 seconds to prevent accidental closes)
    const minWatchTime = 5000; // 5 seconds in milliseconds
    const watchTime = videoStartTimeRef.current ? Date.now() - videoStartTimeRef.current : 0;
    
    // Close popup immediately (UI feedback)
    const currentVideo = selectedVideo;
    setVideoPopupOpen(false);
    setSelectedVideo(null);
    videoStartTimeRef.current = null;
    
    // Call watch-video API for both free and paid videos (mark attendance and create history)
    if (currentVideo && profile?.id && currentVideo._id && watchTime >= minWatchTime) {
      isClosingVideoRef.current = true;
      try {
        // Convert _id to string if it's an ObjectId
        const sessionId = typeof currentVideo._id === 'string' 
          ? currentVideo._id 
          : currentVideo._id.toString();
        
        await apiClient.post(`/api/students/${profile.id}/watch-video`, {
          session_id: sessionId,
          action: 'finish',
          payment_state: currentVideo.payment_state // Pass payment state to API
        });
        
        // Calculate score for attendance (watching full video = attend)
        // Check history first to avoid duplicate scoring (only if scoring is enabled)
        if (isScoringEnabled) {
          try {
            // Get session week if available
          const sessionWeek = currentVideo.week !== undefined && currentVideo.week !== null ? currentVideo.week : null;
          
          // Check if attendance was already scored for this session
          let alreadyScored = false;
          try {
            const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
              studentId: profile.id,
              type: 'attendance',
              week: sessionWeek
            });
            
            if (historyResponse.data.found && historyResponse.data.history) {
              const lastHistory = historyResponse.data.history;
              // Check if this is attendance for the same week and was scored recently (within last hour)
              if (lastHistory.data?.status === 'attend' && 
                  (sessionWeek === null || lastHistory.process_week === sessionWeek)) {
                const historyTime = new Date(lastHistory.timestamp);
                const now = new Date();
                const timeDiff = now - historyTime;
                if (timeDiff < 3600000) { // 1 hour
                  alreadyScored = true;
                  console.log(`[ONLINE SESSIONS] Attendance already scored for session ${sessionId}, skipping`);
                }
              }
            }
          } catch (historyErr) {
            console.error('Error checking attendance history:', historyErr);
          }
          
          if (!alreadyScored) {
            // Get previous attendance status from history
            let previousStatus = null;
            try {
              const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                studentId: profile.id,
                type: 'attendance',
                week: sessionWeek
              });
              
              if (historyResponse.data.found && historyResponse.data.history) {
                previousStatus = historyResponse.data.history.data?.status;
              }
            } catch (historyErr) {
              console.error('Error getting attendance history:', historyErr);
            }
            
            await apiClient.post('/api/scoring/calculate', {
              studentId: profile.id,
              type: 'attendance',
              week: sessionWeek,
              data: { 
                status: 'attend',
                previousStatus: previousStatus
              }
            });
            console.log(`[ONLINE SESSIONS] Attendance score calculated for session ${sessionId}`);
          }
          } catch (err) {
            console.error('Error calculating attendance score:', err);
          }
        }
      } catch (err) {
        console.error('Failed to mark video as finished:', err);
      } finally {
        isClosingVideoRef.current = false;
      }
    }
  };


  return (
    <div className="page-wrapper" style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div className="page-content" style={{ maxWidth: 800, margin: "40px auto", padding: "12px" }}>
        <Title backText="Back" href="/student_dashboard">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/video.svg" alt="Videos" width={35} height={35} />
            Online Sessions
          </div>
        </Title>

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
        {sessions.length > 0 && (
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
        <div className="sessions-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>

          {/* Sessions List */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>Loading sessions...</div>
          ) : filteredSessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
              {sessions.length === 0 ? 'No sessions available.' : 'No sessions match your filters.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {filteredSessions.map((session, index) => {
                const sessionId = session._id?.toString() || `${session.name}-${session.week}-${index}`;
                const isExpanded = expandedSessions.has(sessionId);
                return (
                <div
                  key={sessionId}
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
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); toggleSession(sessionId); }}>
                      <div style={{ fontWeight: '600', fontSize: '1.1rem', color: '#333', marginBottom: '4px' }}>
                        {[session.week !== undefined && session.week !== null ? `Week ${session.week}` : null, session.name].filter(Boolean).join(' • ')}
                      </div>
                      {session.description && (
                        <div style={{ fontSize: '0.9rem', color: '#6c757d', marginTop: '4px' }}>
                          {session.description}
                        </div>
                      )}
                      <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '8px' }}>
                        {session.date}
                      </div>
                    </div>
                    <div 
                      onClick={(e) => { e.stopPropagation(); toggleSession(sessionId); }}
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
                      {isExpanded ? (
                        <Image src="/chevron-down.svg" alt="Collapse" width={20} height={20} />
                      ) : (
                        <Image src="/chevron-right.svg" alt="Expand" width={20} height={20} />
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
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
                          // All videos are YouTube now
                          const videoType = 'youtube';
                          // Get video name, default to "Video {index}" if not set
                          const videoName = video.name || `Video ${video.index}`;
                          const isUnlocked = isVideoUnlocked(session);
                          return (
                            <div key={vidIndex} style={{ marginBottom: vidIndex < videoIds.length - 1 ? '12px' : '0' }}>
                              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                <div
                                  onClick={() => openVideoPopup(session, video.id, video.index)}
                                  style={{
                                    flex: 1,
                                    padding: '10px 15px',
                                    backgroundColor: isUnlocked ? '#28a745' : '#6c757d',
                                    color: 'white',
                                    borderRadius: '6px',
                                    textAlign: 'center',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = isUnlocked ? '#218838' : '#5a6268';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = isUnlocked ? '#28a745' : '#6c757d';
                                  }}
                                >
                                  <Image 
                                    src={isUnlocked ? "/unlock.svg" : "/lock.svg"} 
                                    alt={isUnlocked ? "Unlocked" : "Locked"} 
                                    width={20} 
                                    height={20} 
                                    style={{ display: 'inline-block' }} 
                                  />
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
                );
              })}
            </div>
          )}

          {/* Help Text */}
          <NeedHelp style={{ padding: "20px", borderTop: "1px solid #e9ecef" }} />
        </div>

        {/* VVC Popup */}
        {vvcPopupOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2000,
              padding: '20px'
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                closeVvcPopup();
              }
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)',
                borderRadius: '20px',
                padding: '40px',
                maxWidth: '450px',
                width: '100%',
                boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.2)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{ 
                margin: '0 0 12px 0', 
                fontSize: '1.75rem', 
                color: '#212529',
                fontWeight: '700',
                textAlign: 'center',
                letterSpacing: '-0.5px'
              }}>
                Enter VVC Code
              </h2>
              <p style={{ 
                margin: '0 0 28px 0', 
                color: '#6c757d', 
                fontSize: '1rem',
                textAlign: 'center',
                lineHeight: '1.5'
              }}>
                This video requires a VVC code. Please enter your 9-character code below.
              </p>
              <input
                type="text"
                value={vvc}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 9);
                  setVvc(value);
                  setVvcError('');
                }}
                placeholder="Enter VVC Code"
                style={{
                  width: '100%',
                  padding: '16px',
                  fontSize: '1.3rem',
                  textAlign: 'center',
                  letterSpacing: '6px',
                  border: vvcError ? '3px solid #dc3545' : '2px solid #dee2e6',
                  borderRadius: '12px',
                  marginBottom: '12px',
                  fontFamily: 'monospace',
                  fontWeight: '600',
                  backgroundColor: '#ffffff',
                  transition: 'all 0.3s ease',
                  boxShadow: vvcError ? '0 0 0 4px rgba(220, 53, 69, 0.1)' : '0 2px 8px rgba(0,0,0,0.08)',
                  outline: 'none'
                }}
                onFocus={(e) => {
                  e.target.style.border = '3px solid #1FA8DC';
                  e.target.style.boxShadow = '0 0 0 4px rgba(31, 168, 220, 0.15)';
                }}
                onBlur={(e) => {
                  if (!vvcError) {
                    e.target.style.border = '2px solid #dee2e6';
                    e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleVVCSubmit();
                  }
                }}
                autoFocus
              />
              {vvcError && (
                <div style={{ 
                  color: '#dc3545', 
                  fontSize: '0.95rem', 
                  marginBottom: '20px', 
                  textAlign: 'center',
                  fontWeight: '500',
                  padding: '8px',
                  backgroundColor: '#fff5f5',
                  borderRadius: '8px',
                  border: '1px solid #fecaca'
                }}>
                  {vvcError}
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', flexDirection: 'row-reverse' }}>
                <button
                  onClick={closeVvcPopup}
                  style={{
                    flex: 1,
                    padding: '14px 20px',
                    border: 'none',
                    borderRadius: '10px',
                    background: 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)',
                    color: 'white',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 12px rgba(220, 53, 69, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(220, 53, 69, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.3)';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleVVCSubmit}
                  disabled={isCheckingVvc || !vvc || vvc.length !== 9}
                  style={{
                    flex: 1,
                    padding: '14px 20px',
                    border: 'none',
                    borderRadius: '10px',
                    background: isCheckingVvc || !vvc || vvc.length !== 9 
                      ? 'linear-gradient(135deg, #ccc 0%, #bbb 100%)' 
                      : 'linear-gradient(135deg, #28a745 0%, #218838 100%)',
                    color: 'white',
                    cursor: isCheckingVvc || !vvc || vvc.length !== 9 ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    transition: 'all 0.3s ease',
                    boxShadow: isCheckingVvc || !vvc || vvc.length !== 9 
                      ? 'none' 
                      : '0 4px 12px rgba(40, 167, 69, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    if (!isCheckingVvc && vvc && vvc.length === 9) {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 16px rgba(40, 167, 69, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isCheckingVvc && vvc && vvc.length === 9) {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)';
                    }
                  }}
                >
                  {isCheckingVvc ? 'Verifying...' : 'Submit'}
                </button>
              </div>
            </div>
          </div>
        )}

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
            
            .sessions-container {
              padding: 16px;
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
            
            .video-player-container button {
              width: 32px !important;
              height: 32px !important;
              font-size: 18px !important;
              top: 8px !important;
              right: 8px !important;
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
            
            
            .video-popup-overlay {
              padding: 5px !important;
            }
            
            .video-player-container {
              border-radius: 0 !important;
            }
            
            .video-player-container h3 {
              font-size: 0.9rem !important;
              padding: 10px !important;
            }
            
            .video-player-container button {
              width: 28px !important;
              height: 28px !important;
              font-size: 16px !important;
              top: 5px !important;
              right: 5px !important;
            }
          }
          
        `}</style>
      </div>
    </div>
  );
}

