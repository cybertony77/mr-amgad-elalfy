import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Title from '../../../../components/Title';
import AttendanceWeekSelect from '../../../../components/AttendanceWeekSelect';
import GradeSelect from '../../../../components/GradeSelect';
import OnlineSessionPaymentStateSelect from '../../../../components/OnlineSessionPaymentStateSelect';
import VideoInput from '../../../../components/VideoInput';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../../lib/axios';
import Image from 'next/image';

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

export default function EditHomeworkVideo() {
  const router = useRouter();
  const { id } = router.query;
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    videos: [{
      video_name: '',
      youtube_url: '',
      video_source: 'youtube',
      r2_key: '',
      upload_file_name: '',
      upload_progress: 0,
      upload_status: ''
    }]
  });
  const [selectedGrade, setSelectedGrade] = useState('');
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [paymentState, setPaymentState] = useState('paid');
  const [errors, setErrors] = useState({});
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const errorTimeoutRef = useRef(null);

  // Fetch system config
  const { data: systemConfig } = useQuery({
    queryKey: ['system-config'],
    queryFn: async () => {
      const response = await apiClient.get('/api/system/config');
      return response.data;
    },
  });
  const showUploadTab = systemConfig?.cloudflare_r2 === true;

  // Fetch session data
  const { data: sessionsData } = useQuery({
    queryKey: ['homeworks_videos'],
    queryFn: async () => {
      const response = await apiClient.get('/api/homeworks_videos');
      return response.data;
    },
  });

  const sessions = sessionsData?.sessions || [];
  const selectedSession = sessions.find(s => s._id === id);

  // Load session data when available
  useEffect(() => {
    if (selectedSession && isLoadingSession) {
      // Extract videos from session
      const videos = [];
      let videoIndex = 1;
      while (selectedSession[`video_ID_${videoIndex}`]) {
        const videoId = selectedSession[`video_ID_${videoIndex}`];
        const videoType = selectedSession[`video_type_${videoIndex}`] || 'youtube';
        
        if (videoType === 'r2') {
          videos.push({
            video_name: selectedSession[`video_name_${videoIndex}`] || '',
            youtube_url: '',
            video_source: 'upload',
            r2_key: videoId,
            upload_file_name: videoId.split('/').pop() || '',
            upload_progress: 100,
            upload_status: 'complete'
          });
        } else {
          videos.push({
            video_name: selectedSession[`video_name_${videoIndex}`] || '',
            youtube_url: `https://www.youtube.com/watch?v=${videoId}`,
            video_source: 'youtube',
            r2_key: '',
            upload_file_name: '',
            upload_progress: 0,
            upload_status: ''
          });
        }
        videoIndex++;
      }

      setFormData({
        name: selectedSession.name || '',
        description: selectedSession.description || '',
        videos: videos.length > 0 ? videos : [{
          video_name: '',
          youtube_url: '',
          video_source: 'youtube',
          r2_key: '',
          upload_file_name: '',
          upload_progress: 0,
          upload_status: ''
        }]
      });
      setSelectedWeek(selectedSession.week ? weekNumberToString(selectedSession.week) : '');
      setSelectedGrade(selectedSession.grade || '');
      setPaymentState(selectedSession.payment_state || 'paid');
      setIsLoadingSession(false);
    }
  }, [selectedSession, isLoadingSession]);

  // Auto-hide errors after 6 seconds
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
      errorTimeoutRef.current = setTimeout(() => {
        setErrors({});
      }, 6000);
    }
    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [errors]);

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.put(`/api/homeworks_videos?id=${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['homeworks_videos']);
      router.push('/dashboard/manage_online_system/homeworks_videos');
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.error || 'Failed to update session';
      setErrors({ general: errorMsg.startsWith('❌') ? errorMsg : `❌ ${errorMsg}` });
    },
  });

  // Add video row
  const addVideo = () => {
    setFormData(prev => ({
      ...prev,
      videos: [...prev.videos, {
        video_name: '',
        youtube_url: '',
        video_source: 'youtube',
        r2_key: '',
        upload_file_name: '',
        upload_progress: 0,
        upload_status: ''
      }]
    }));
  };

  // Remove video row
  const removeVideo = (index) => {
    setFormData(prev => {
      if (prev.videos.length <= 1) return prev;
      return { ...prev, videos: prev.videos.filter((_, i) => i !== index) };
    });
    setErrors(prev => {
      const newErrors = { ...prev };
      Object.keys(newErrors).forEach(key => {
        if (key.startsWith(`video_${index}_`)) {
          delete newErrors[key];
        }
      });
      return newErrors;
    });
  };

  // Handle video name change
  const handleVideoNameChange = (index, name) => {
    setFormData(prev => {
      const newVideos = [...prev.videos];
      newVideos[index] = { ...newVideos[index], video_name: name };
      return { ...prev, videos: newVideos };
    });
  };

  // Handle YouTube URL change
  const handleYouTubeUrlChange = (index, url) => {
    setFormData(prev => {
      const newVideos = [...prev.videos];
      newVideos[index] = { ...newVideos[index], youtube_url: url };
      return { ...prev, videos: newVideos };
    });
    if (errors[`video_${index}_youtube_url`]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`video_${index}_youtube_url`];
        return newErrors;
      });
    }
  };

  // Handle R2 upload complete
  const handleR2Upload = (index, r2Key, fileName) => {
    setFormData(prev => {
      const newVideos = [...prev.videos];
      newVideos[index] = {
        ...newVideos[index],
        r2_key: r2Key,
        upload_file_name: fileName,
        upload_progress: 100,
        upload_status: 'complete',
        video_source: 'upload'
      };
      return { ...prev, videos: newVideos };
    });
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`video_${index}_youtube_url`];
      return newErrors;
    });
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
    if (errors.general) {
      setErrors({ ...errors, general: '' });
    }
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!selectedGrade || selectedGrade.trim() === '') {
      newErrors.grade = '❌ Grade is required';
    }

    if (!selectedWeek || selectedWeek.trim() === '') {
      newErrors.week = '❌ Attendance week is required';
    }

    if (!paymentState || (paymentState !== 'paid' && paymentState !== 'free' && paymentState !== 'free_if_attended')) {
      newErrors.paymentState = '❌ Video Payment State is required';
    }

    if (!formData.name.trim()) {
      newErrors.name = '❌ Name is required';
    }

    const validVideos = formData.videos.filter(video => {
      return (video.r2_key && video.r2_key.trim()) || (video.youtube_url && video.youtube_url.trim());
    });

    if (validVideos.length === 0) {
      newErrors.videos = '❌ At least one valid video is required';
    }

    // Validate each video
    for (let index = 0; index < formData.videos.length; index++) {
      const video = formData.videos[index];
      if (video.r2_key && video.r2_key.trim()) {
        // R2 video is valid, no further check needed
      } else if (video.youtube_url && video.youtube_url.trim()) {
        const videoId = extractYouTubeId(video.youtube_url.trim());
        if (!videoId) {
          newErrors[`video_${index}_youtube_url`] = '❌ Invalid YouTube URL';
        }
      } else if (validVideos.length === 0 || formData.videos.some((v, i) => i !== index && ((v.r2_key && v.r2_key.trim()) || (v.youtube_url && v.youtube_url.trim())))) {
        newErrors[`video_${index}_youtube_url`] = '❌ Video URL or upload is required';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const weekNumber = extractWeekNumber(selectedWeek);
    if (!weekNumber) {
      newErrors.week = '❌ Invalid week selection';
      setErrors(newErrors);
      return;
    }

    // Check for duplicate grade and week combination (exclude current session)
    const duplicateSession = sessions.find(
      session => session._id !== id && session.grade === selectedGrade.trim() && session.week === weekNumber
    );
    if (duplicateSession) {
      newErrors.general = '❌ A session with this grade and week already exists';
      setErrors(newErrors);
      return;
    }

    // Prepare video data for API
    const finalVideoData = [];

    for (let i = 0; i < formData.videos.length; i++) {
      const video = formData.videos[i];
      
      if (video.r2_key && video.r2_key.trim()) {
        finalVideoData.push({
          video_type: 'r2',
          video_id: video.r2_key.trim(),
          video_name: video.video_name && video.video_name.trim() ? video.video_name.trim() : null,
        });
      } else if (video.youtube_url && video.youtube_url.trim()) {
        const videoId = extractYouTubeId(video.youtube_url.trim());
        if (videoId) {
          finalVideoData.push({
            video_type: 'youtube',
            video_id: videoId,
            video_name: video.video_name && video.video_name.trim() ? video.video_name.trim() : null,
          });
        }
      }
    }

    // Submit form
    updateSessionMutation.mutate({
      name: formData.name.trim(),
      grade: selectedGrade.trim(),
      week: weekNumber,
      videos: finalVideoData,
      description: formData.description.trim() || null,
      payment_state: paymentState
    });
  };

  if (isLoadingSession || !selectedSession) {
    return (
      <div className="page-wrapper" style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px" 
      }}>
        <div className="page-content" style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
            Loading session data...
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
        <Title backText="Back" href="/dashboard/manage_online_system/homeworks_videos">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/edit.svg" alt="Edit" width={32} height={32} />
            Edit Online Session
          </div>
        </Title>

        <div className="form-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '24px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          marginTop: '24px'
        }}>
          <form onSubmit={handleSubmit}>
            {/* Video Grade */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                Video Grade <span style={{ color: 'red' }}>*</span>
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

            {/* Video Week */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                Video Week <span style={{ color: 'red' }}>*</span>
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
                placeholder="Select Video Week"
              />
              {errors.week && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                  {errors.week}
                </div>
              )}
            </div>

            {/* Video Payment State Radio */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'left' }}>
                Video Payment State <span style={{ color: 'red' }}>*</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: paymentState === 'paid' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: paymentState === 'paid' ? '#f0f8ff' : 'white' }}>
                  <input
                    type="radio"
                    name="payment_state"
                    value="paid"
                    checked={paymentState === 'paid'}
                    onChange={(e) => {
                      setPaymentState(e.target.value);
                      if (errors.paymentState) {
                        setErrors({ ...errors, paymentState: '' });
                      }
                    }}
                    style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: '500' }}>Paid</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: paymentState === 'free' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: paymentState === 'free' ? '#f0f8ff' : 'white' }}>
                  <input
                    type="radio"
                    name="payment_state"
                    value="free"
                    checked={paymentState === 'free'}
                    onChange={(e) => {
                      setPaymentState(e.target.value);
                      if (errors.paymentState) {
                        setErrors({ ...errors, paymentState: '' });
                      }
                    }}
                    style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: '500' }}>Free</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: paymentState === 'free_if_attended' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: paymentState === 'free_if_attended' ? '#f0f8ff' : 'white' }}>
                  <input
                    type="radio"
                    name="payment_state"
                    value="free_if_attended"
                    checked={paymentState === 'free_if_attended'}
                    onChange={(e) => {
                      setPaymentState(e.target.value);
                      if (errors.paymentState) {
                        setErrors({ ...errors, paymentState: '' });
                      }
                    }}
                    style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontWeight: '500' }}>Free if attended the session</span>
                </label>
              </div>
              {errors.paymentState && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                  {errors.paymentState}
                </div>
              )}
            </div>

            {/* Name Input */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                Name <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter Session Name"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: errors.name ? '2px solid #dc3545' : '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
              {errors.name && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                  {errors.name}
                </div>
              )}
            </div>

            {/* Videos Section */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '12px', color: '#333', fontWeight: '500' }}>
                Videos <span style={{ color: 'red' }}>*</span>
              </label>
              
              {formData.videos.map((video, index) => (
                <VideoInput
                  key={index}
                  index={index}
                  video={video}
                  onVideoNameChange={handleVideoNameChange}
                  onYouTubeUrlChange={handleYouTubeUrlChange}
                  onR2Upload={handleR2Upload}
                  onRemove={removeVideo}
                  canRemove={formData.videos.length > 1}
                  errors={errors}
                  showUploadTab={showUploadTab}
                />
              ))}

              <button
                type="button"
                onClick={addVideo}
                style={{
                  marginTop: '16px',
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Image src="/plus.svg" alt="Add" width={20} height={20} style={{ display: 'inline-block' }} />
                Add Another Video
              </button>

              {errors.videos && (
                <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '8px' }}>
                  {errors.videos}
                </div>
              )}
            </div>

            {/* Description Textarea */}
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter Description if you want..."
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {/* General Error */}
            {errors.general && (
              <div style={{
                color: '#dc3545',
                fontSize: '0.875rem',
                marginBottom: '16px',
                padding: '8px 12px',
                backgroundColor: '#f8d7da',
                borderRadius: '6px',
                border: '1px solid #f5c6cb',
                textAlign: 'center'
              }}>
                {errors.general}
              </div>
            )}

            {/* Submit Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="submit"
                disabled={updateSessionMutation.isPending}
                style={{
                  padding: '12px 24px',
                  backgroundColor: updateSessionMutation.isPending ? '#6c757d' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: updateSessionMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: updateSessionMutation.isPending ? 0.6 : 1
                }}
              >
                {updateSessionMutation.isPending ? 'Updating...' : 'Update Session'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/manage_online_system/homeworks_videos')}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        <style jsx>{`
          
          @media (max-width: 768px) {
            .page-wrapper {
              padding: 10px 5px 10px 5px !important;
            }
            
            .page-content {
              margin: 20px auto !important;
              padding: 10px 5px 10px 5px !important;
              max-width: 100% !important;
            }
            
            .form-container {
              padding: 16px !important;
              margin-top: 16px !important;
            }
            
            .form-container input[type="text"],
            .form-container input[type="url"],
            .form-container textarea {
              font-size: 16px !important; /* Prevents zoom on iOS */
            }
            
            .form-container button {
              width: 100% !important;
              margin-bottom: 8px !important;
            }
            
            .form-container > form > div:last-child {
              flex-direction: column !important;
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
              border-radius: 12px !important;
            }
            
            .form-container label {
              font-size: 0.9rem !important;
            }
            
            .form-container input,
            .form-container textarea {
              font-size: 16px !important;
              padding: 8px 10px !important;
            }
          }
          
          @media (max-width: 360px) {
            .form-container {
              padding: 10px !important;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

