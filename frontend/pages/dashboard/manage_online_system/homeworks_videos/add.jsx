import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Title from '../../../../components/Title';
import AttendanceWeekSelect from '../../../../components/AttendanceWeekSelect';
import GradeSelect from '../../../../components/GradeSelect';
import OnlineSessionPaymentStateSelect from '../../../../components/OnlineSessionPaymentStateSelect';
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

export default function AddHomeworkVideo() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    videos: [{
      video_name: '',
      youtube_url: ''
    }]
  });
  const [selectedGrade, setSelectedGrade] = useState('');
  const [gradeDropdownOpen, setGradeDropdownOpen] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [weekDropdownOpen, setWeekDropdownOpen] = useState(false);
  const [paymentState, setPaymentState] = useState('paid');
  const [errors, setErrors] = useState({});
  const errorTimeoutRef = useRef(null);

  // Fetch all sessions for duplicate validation
  const { data: sessionsData } = useQuery({
    queryKey: ['homeworks_videos'],
    queryFn: async () => {
      const response = await apiClient.get('/api/homeworks_videos');
      return response.data;
    },
  });

  const sessions = sessionsData?.sessions || [];

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

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post('/api/homeworks_videos', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['homeworks_videos']);
      router.push('/dashboard/manage_online_system/homeworks_videos');
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.error || 'Failed to add session';
      setErrors({ general: errorMsg.startsWith('❌') ? errorMsg : `❌ ${errorMsg}` });
    },
  });

  // Add video row
  const addVideo = () => {
    setFormData({
      ...formData,
      videos: [...formData.videos, {
        video_name: '',
        youtube_url: ''
      }]
    });
  };

  // Remove video row
  const removeVideo = (index) => {
    if (formData.videos.length > 1) {
      const newVideos = formData.videos.filter((_, i) => i !== index);
      setFormData({ ...formData, videos: newVideos });
      // Clear errors for removed video
      const newErrors = { ...errors };
      Object.keys(newErrors).forEach(key => {
        if (key.startsWith(`video_${index}_`)) {
          delete newErrors[key];
        }
      });
      setErrors(newErrors);
    }
  };

  // Handle video name change
  const handleVideoNameChange = (index, name) => {
    const newVideos = [...formData.videos];
    newVideos[index].video_name = name;
    setFormData({ ...formData, videos: newVideos });
  };

  // Handle YouTube URL change
  const handleYouTubeUrlChange = (index, url) => {
    const newVideos = [...formData.videos];
    newVideos[index].youtube_url = url;
    setFormData({ ...formData, videos: newVideos });
    // Clear error
    if (errors[`video_${index}_youtube_url`]) {
      const newErrors = { ...errors };
      delete newErrors[`video_${index}_youtube_url`];
      setErrors(newErrors);
    }
  };

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    // Clear error
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

    // Validate grade
    if (!selectedGrade || selectedGrade.trim() === '') {
      newErrors.grade = '❌ Grade is required';
    }

    // Validate week
    if (!selectedWeek || selectedWeek.trim() === '') {
      newErrors.week = '❌ Attendance week is required';
    }

    // Validate payment state
    if (!paymentState || (paymentState !== 'paid' && paymentState !== 'free' && paymentState !== 'free_if_attended')) {
      newErrors.paymentState = '❌ Video Payment State is required';
    }

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = '❌ Name is required';
    }

    // Validate videos
    const validVideos = formData.videos.filter(video => {
      return video.youtube_url && video.youtube_url.trim();
    });

    if (validVideos.length === 0) {
      newErrors.videos = '❌ At least one valid video is required';
    }

    // Validate each video
    for (let index = 0; index < formData.videos.length; index++) {
      const video = formData.videos[index];
      if (video.youtube_url && video.youtube_url.trim()) {
        const videoId = extractYouTubeId(video.youtube_url.trim());
        if (!videoId) {
          newErrors[`video_${index}_youtube_url`] = '❌ Invalid YouTube URL';
        }
      } else if (validVideos.length === 0 || formData.videos.some((v, i) => i !== index && v.youtube_url && v.youtube_url.trim())) {
        newErrors[`video_${index}_youtube_url`] = '❌ YouTube URL is required';
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
    const duplicateSession = sessions.find(
      session => session.grade === selectedGrade.trim() && session.week === weekNumber
    );
    if (duplicateSession) {
      newErrors.general = '❌ A session with this grade and week already exists';
      setErrors(newErrors);
      return;
    }

    // Prepare video data for API
    const videoData = [];

    for (let i = 0; i < formData.videos.length; i++) {
      const video = formData.videos[i];
      
      if (video.youtube_url && video.youtube_url.trim()) {
        const videoId = extractYouTubeId(video.youtube_url.trim());
        if (videoId) {
          videoData.push({
            video_type: 'youtube',
            video_id: videoId,
            video_name: video.video_name && video.video_name.trim() ? video.video_name.trim() : null
          });
        }
      }
    }

    // All videos are YouTube
    const finalVideoData = videoData.map(video => ({
      video_type: video.video_type,
      video_id: video.video_id,
      video_name: video.video_name
    }));

    // Submit form
    createSessionMutation.mutate({
      name: formData.name.trim(),
      grade: selectedGrade.trim(),
      week: weekNumber,
      videos: finalVideoData,
      description: formData.description.trim() || null,
      payment_state: paymentState
    });
  };

  return (
    <div className="page-wrapper" style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div className="page-content" style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
        <Title backText="Back" href="/dashboard/manage_online_system/homeworks_videos">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/plus.svg" alt="Add" width={32} height={32} />
            Add Online Session
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
                <div key={index} style={{
                  marginBottom: index < formData.videos.length - 1 ? '24px' : '0',
                  padding: '20px',
                  border: '2px solid #e9ecef',
                  borderRadius: '8px',
                  backgroundColor: '#f8f9fa'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <h4 style={{ margin: 0, color: '#333' }}>Video {index + 1}</h4>
                    {formData.videos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeVideo(index)}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '0.875rem',
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Video Name Input */}
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                      Video Name
                    </label>
                    <input
                      type="text"
                      value={video.video_name || ''}
                      onChange={(e) => handleVideoNameChange(index, e.target.value)}
                      placeholder={`Video ${index + 1}`}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  {/* YouTube URL Input */}
                  <div style={{ marginBottom: '0' }}>
                    <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
                      YouTube URL <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={video.youtube_url}
                      onChange={(e) => handleYouTubeUrlChange(index, e.target.value)}
                      placeholder="Enter YouTube Video URL"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        border: errors[`video_${index}_youtube_url`] ? '2px solid #dc3545' : '1px solid #ddd',
                        borderRadius: '6px',
                        fontSize: '1rem',
                        boxSizing: 'border-box'
                      }}
                    />
                    {errors[`video_${index}_youtube_url`] && (
                      <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                        {errors[`video_${index}_youtube_url`]}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Add Video Button */}
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
                disabled={createSessionMutation.isPending}
                style={{
                  padding: '12px 24px',
                  backgroundColor: createSessionMutation.isPending ? '#6c757d' : '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '1rem',
                  fontWeight: '500',
                  cursor: createSessionMutation.isPending ? 'not-allowed' : 'pointer',
                  opacity: createSessionMutation.isPending ? 0.6 : 1
                }}
              >
                {createSessionMutation.isPending ? 'Creating...' : 'Create Session'}
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

