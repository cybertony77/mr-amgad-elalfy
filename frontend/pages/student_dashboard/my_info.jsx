import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Title from "../../components/Title";
import { Table, ScrollArea, Modal } from '@mantine/core';
import styles from '../../styles/TableScrollArea.module.css';
import { useStudent } from '../../lib/api/students';
import { useProfile, useUpdateProfile, useProfilePicture } from '../../lib/api/auth';
import { useSystemConfig } from '../../lib/api/system';
import apiClient from '../../lib/axios';
import Image from 'next/image';
import NeedHelp from '../../components/NeedHelp';
import ChartTabs from '../../components/ChartTabs';

export default function MyInfo() {
  const { data: systemConfig } = useSystemConfig();
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';
  
  const containerRef = useRef(null);
  const [error, setError] = useState("");
  const [studentDeleted, setStudentDeleted] = useState(false);
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsType, setDetailsType] = useState('absent');
  const [detailsWeeks, setDetailsWeeks] = useState([]);
  const [detailsTitle, setDetailsTitle] = useState('');
  const [emailEditOpen, setEmailEditOpen] = useState(false);
  const [emailValue, setEmailValue] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);

  // Get current logged-in user profile
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: profilePictureUrl } = useProfilePicture();
  const updateProfileMutation = useUpdateProfile();
  
  // Profile picture state
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [profilePicturePublicId, setProfilePicturePublicId] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Get student ID from profile
  const studentId = profile?.id ? profile.id.toString() : null;
  
  // Initialize profile picture from profile data
  useEffect(() => {
    if (profile?.profile_picture) {
      setProfilePicturePublicId(profile.profile_picture);
    } else {
      setProfilePicturePublicId(null);
      setImagePreview(null);
    }
  }, [profile?.profile_picture]);
  
  // Set image preview from signed URL when available
  useEffect(() => {
    if (profilePictureUrl && profilePicturePublicId) {
      // Use signed URL for preview (this will update when profile picture changes)
      setImagePreview(profilePictureUrl);
    } else if (!profilePicturePublicId) {
      setImagePreview(null);
    }
  }, [profilePictureUrl, profilePicturePublicId]);
  
  // React Query hook with real-time updates - 5 second polling
  const { data: student, isLoading: studentLoading, error: studentError, refetch: refetchStudent, isRefetching, dataUpdatedAt } = useStudent(studentId, { 
    enabled: !!studentId,
    // Refetch settings
    refetchInterval: 30 * 60 * 1000, // Refetch every 30 minutes
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    refetchOnWindowFocus: true, // Immediate update when switching back to tab
    refetchOnReconnect: true, // Refetch when reconnecting to internet
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 1000, // Keep in cache for only 1 second
    refetchOnMount: true, // Always refetch when component mounts/page entered
  });

  // Debug logging for React Query status
  useEffect(() => {
    if (student && studentId) {
      console.log('🔄 My Info Page - Data Status:', {
        studentId: studentId,
        studentName: student.name,
        isRefetching,
        dataUpdatedAt: new Date(dataUpdatedAt).toLocaleTimeString(),
        attendanceStatus: student.weeks?.[0]?.attended || false
      });
    }
  }, [student, isRefetching, dataUpdatedAt, studentId]);

  useEffect(() => {
    if (error && !studentDeleted) {
      // Only auto-hide errors that are NOT "student deleted" errors
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, studentDeleted]);

  // Handle student error
  useEffect(() => {
    if (studentError) {
      if (studentError.response?.status === 404) {
        console.log('❌ My Info Page - Student not found:', {
          studentId,
          error: 'Student deleted or does not exist',
          timestamp: new Date().toLocaleTimeString()
        });
        setStudentDeleted(true);
        setError("Student not exists - This student may have been deleted");
      } else {
        console.log('❌ My Info Page - Error fetching student:', {
          studentId,
          error: studentError.message,
          timestamp: new Date().toLocaleTimeString()
        });
        setStudentDeleted(false);
        setError("Error fetching student data");
      }
    } else {
      // Clear error when student data loads successfully
      if (student && !studentError) {
        setStudentDeleted(false);
        setError("");
      }
    }
  }, [studentError, studentId, student]);

  // Helper function to get attendance status for a week
  const getWeekAttendance = (weekNumber) => {
    if (!student || !student.weeks) return { attended: false, hwDone: false, hwDegree: null, quizDegree: null, message_state: false, lastAttendance: null, view_homework_video: false };
    
    const weekData = student.weeks.find(w => w.week === weekNumber);
    if (!weekData) return { attended: false, hwDone: false, hwDegree: null, quizDegree: null, message_state: false, lastAttendance: null, view_homework_video: false };
    
    return {
      attended: weekData.attended || false,
      hwDone: weekData.hwDone || false,
      hwDegree: weekData.hwDegree || null,
      view_homework_video: weekData.view_homework_video || false,
      quizDegree: weekData.quizDegree || null,
      comment: weekData.comment || null,
      message_state: weekData.message_state || false,
      lastAttendance: weekData.lastAttendance || null
    };
  };

  // Helper function to get available weeks (all weeks that exist in the database)
  const getAvailableWeeks = () => {
    if (!student || !student.weeks || student.weeks.length === 0) return [];
    
    // Return all weeks that exist in the database, sorted by week number
    return student.weeks.sort((a, b) => a.week - b.week);
  };

  // Helper to compute totals for the student across all weeks
  const getTotals = () => {
    const weeks = Array.isArray(student?.weeks) ? student.weeks : [];
    const absent = weeks.filter(w => w && w.attended === false).length;
    const missingHW = weeks.filter(w => w && (w.hwDone === false || w.hwDone === "Not Completed" || w.hwDone === "not completed" || w.hwDone === "NOT COMPLETED")).length;
    const unattendQuiz = weeks.filter(w => w && (w.quizDegree === "Didn't Attend The Quiz" || w.quizDegree == null)).length;
    return { absent, missingHW, unattendQuiz };
  };

  // Process image file (shared by file input and drag & drop)
  const processImageFile = async (file) => {
    if (!file) {
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Sorry, Max profile picture size is 5 MB, Please try another picture');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary
    setUploadingImage(true);
    setError('');
    
    try {
      // Convert file to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await apiClient.post('/api/upload/profile-picture', {
        file: base64,
        fileName: file.name,
        fileType: file.type
      });

      if (response.data.success && response.data.public_id) {
        const newPublicId = response.data.public_id;
        setProfilePicturePublicId(newPublicId);
        
        // Keep the base64 preview temporarily while updating
        const tempPreview = imagePreview;
        
        // Update profile in database
        await updateProfileMutation.mutateAsync({ profile_picture: newPublicId });
        
        // The signed URL will be fetched and update the preview automatically
        // Keep the base64 preview until the signed URL is ready
      } else {
        throw new Error('Upload failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload image. Please try again.');
      setImagePreview(null);
      setProfilePicturePublicId(null);
    } finally {
      setUploadingImage(false);
    }
  };

  // Handle profile picture upload
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    await processImageFile(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploadingImage) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (uploadingImage) return;

    const file = e.dataTransfer.files?.[0];
    await processImageFile(file);
  };

  // Handle profile picture removal
  const handleRemoveImage = async () => {
    try {
      setUploadingImage(true);
      // Update profile to remove picture
      await updateProfileMutation.mutateAsync({ profile_picture: null });
      setProfilePicturePublicId(null);
      setImagePreview(null);
      const fileInput = document.getElementById('profile-picture-upload-myinfo');
      if (fileInput) fileInput.value = '';
    } catch (err) {
      setError('Failed to remove image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Helpers to build detailed week lists
  const getAbsentWeeks = (weeks) => {
    if (!Array.isArray(weeks)) return [];
    return weeks
      .map((w, idx) => ({ idx, w }))
      .filter(({ w }) => w && w.attended === false)
      .map(({ idx, w }) => ({
        week: (w.week ?? idx + 1),
        quizDegree: w.quizDegree
      }));
  };

  const getMissingHWWeeks = (weeks) => {
    if (!Array.isArray(weeks)) return [];
    return weeks
      .map((w, idx) => ({ idx, w }))
      .filter(({ w }) => w && (w.hwDone === false || w.hwDone === "Not Completed" || w.hwDone === "not completed" || w.hwDone === "NOT COMPLETED"))
      .map(({ idx, w }) => ({
        week: (w.week ?? idx + 1),
        hwDone: w.hwDone,
        quizDegree: w.quizDegree
      }));
  };

  const getUnattendQuizWeeks = (weeks) => {
    if (!Array.isArray(weeks)) return [];
    return weeks
      .map((w, idx) => ({ idx, w }))
      .filter(({ w }) => w && (w.quizDegree === "Didn't Attend The Quiz" || w.quizDegree == null))
      .map(({ idx, w }) => ({
        week: (w.week ?? idx + 1),
        quizDegree: w.quizDegree
      }));
  };

  const openDetails = (type) => {
    if (!student) return;
    let title = '';
    let weeksList = [];
    if (type === 'absent') {
      title = `Absent Sessions for ${student.name} • ID: ${student.id}`;
      weeksList = getAbsentWeeks(student.weeks);
    } else if (type === 'hw') {
      title = `Missing Homework for ${student.name} • ID: ${student.id}`;
      weeksList = getMissingHWWeeks(student.weeks);
    } else if (type === 'quiz') {
      title = `Unattended Quizzes for ${student.name} • ID: ${student.id}`;
      weeksList = getUnattendQuizWeeks(student.weeks);
    }
    setDetailsType(type);
    setDetailsWeeks(weeksList);
    setDetailsTitle(title);
    setDetailsOpen(true);
  };

  const handleSaveEmail = async () => {
    setEmailError('');
    
    if (!emailValue || emailValue.trim() === '') {
      setEmailError('Email is required');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailValue.trim())) {
      setEmailError('Please enter a valid email address');
      return;
    }

    setIsSavingEmail(true);
    try {
      await updateProfileMutation.mutateAsync({ email: emailValue.trim() });
      setEmailEditOpen(false);
      setEmailValue('');
      setError('');
    } catch (err) {
      setEmailError(err.response?.data?.error || 'Failed to update email. Please try again.');
    } finally {
      setIsSavingEmail(false);
    }
  };

  const isLoading = profileLoading || studentLoading;

  return (
    <div style={{ 
      padding: "20px 5px 20px 5px"
    }}>
      <div ref={containerRef} style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
        <style jsx>{`
          .error-message {
            background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
            color: white;
            border-radius: 10px;
            padding: 16px;
            margin-top: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3);
          }
          .info-container {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
          }
          .student-details {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-bottom: 30px;
          }
          .detail-item {
            padding: 20px;
            background: #ffffff;
            border-radius: 12px;
            border: 2px solid #e9ecef;
            border-left: 4px solid #1FA8DC;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            transition: all 0.3s ease;
          }
          .detail-label {
            font-weight: 700;
            color: #6c757d;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .detail-value {
            font-size: 1rem;
            color: #212529;
            font-weight: 600;
            line-height: 1.4;
          }
          .weeks-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #495057;
            margin-bottom: 20px;
            text-align: center;
            border-bottom: 2px solid #1FA8DC;
            padding-bottom: 10px;
          }
          
          @media (max-width: 768px) {
            .info-container {
              padding: 24px;
            }
            .student-details {
              gap: 12px;
            }
          }
          
          @media (max-width: 480px) {
            .info-container {
              padding: 20px;
            }
            .detail-item {
              padding: 12px;
            }
            .detail-label {
              font-size: 0.85rem;
            }
            .detail-value {
              font-size: 1rem;
            }
            .weeks-title {
              font-size: 1.3rem;
            }
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>

        <Title href="/student_dashboard/">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/user-circle3.svg" alt="User" width={35} height={35} />
            My Information
          </div>
        </Title>

        {isLoading ? (
          <div className="info-container" style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ color: '#6c757d', fontSize: '1.1rem' }}>Loading your information...</div>
          </div>
        ) : student && !studentDeleted ? (
          <div className="info-container">
            <div className="student-details">
              {/* Profile Picture Upload */}
              <div className="detail-item" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div className="detail-label" style={{ textAlign: 'center', width: '100%' }}>Profile Picture</div>
                {profilePicturePublicId && imagePreview ? (
                  // Show uploaded image in circle
                  <div
                    style={{
                      position: 'relative',
                      display: 'inline-block'
                    }}
                  >
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className="profile-picture-container"
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: '50%',
                        background: '#e9ecef',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isDragging ? '0 4px 16px rgba(31,168,220,0.4)' : '0 2px 8px rgba(31,168,220,0.15)',
                        border: isDragging ? '3px dashed #1FA8DC' : '2px solid #1FA8DC',
                        overflow: 'hidden',
                        position: 'relative',
                        transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                        transition: 'all 0.3s ease'
                      }}
                      title="Drag & drop new image"
                    >
                      <img
                        src={imagePreview}
                        alt="Profile preview"
                        className="profile-picture-image"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          borderRadius: '50%'
                        }}
                      />
                    </div>
                    {/* Trash button in bottom right */}
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        right: 0,
                        width: 36,
                        height: 36,
                        borderRadius: '50%',
                        background: '#dc3545',
                        border: '2px solid white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        transition: 'all 0.2s ease',
                        zIndex: 9
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.transform = 'scale(1.1)';
                        e.target.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.transform = 'scale(1)';
                        e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                      }}
                      title="Remove image"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  // Show upload button when no image
                  <label
                    htmlFor="profile-picture-upload-myinfo"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      background: uploadingImage 
                        ? 'linear-gradient(135deg, #6c757d 0%, #495057 100%)' 
                        : isDragging
                        ? 'linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%)'
                        : 'linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: uploadingImage ? 'not-allowed' : 'pointer',
                      fontWeight: '600',
                      fontSize: '0.9rem',
                      textAlign: 'center',
                      transition: 'all 0.3s ease',
                      boxShadow: isDragging ? '0 6px 20px rgba(31, 168, 220, 0.5)' : '0 4px 12px rgba(135, 206, 235, 0.3)',
                      opacity: uploadingImage ? 0.7 : 1,
                      border: isDragging ? '3px dashed white' : '2px solid #1FA8DC',
                      flexDirection: 'column',
                      gap: '8px',
                      transform: isDragging ? 'scale(1.05)' : 'scale(1)'
                    }}
                    onMouseEnter={(e) => {
                      if (!uploadingImage) {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 16px rgba(135, 206, 235, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!uploadingImage) {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 12px rgba(135, 206, 235, 0.3)';
                      }
                    }}
                  >
                    {uploadingImage ? (
                      <>
                        <div style={{
                          width: '24px',
                          height: '24px',
                          border: '3px solid rgba(255,255,255,0.3)',
                          borderTop: '3px solid white',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite'
                        }} />
                        <span style={{ fontSize: '0.75rem' }}>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Image src="/upload.svg" alt="Upload" width={32} height={32} style={{ filter: 'brightness(0) invert(1)' }} />
                        <span style={{ fontSize: '0.75rem' }}>Upload Picture</span>
                      </>
                    )}
                  </label>
                )}
                <input
                  id="profile-picture-upload-myinfo"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={uploadingImage}
                  style={{ display: 'none' }}
                />
                <small style={{ color: '#6c757d', fontSize: '0.85rem', textAlign: 'center', marginTop: '4px' }}>
                  Max size: 5 MB. Formats: JPEG, PNG, GIF, WEBP
                </small>
              </div>

              <div className="detail-item">
                <div className="detail-label">Full Name</div>
                <div className="detail-value">{student.name}</div>
              </div>
              {student?.gender && (
                <div className="detail-item">
                  <div className="detail-label">Gender</div>
                  <div className="detail-value">{student.gender}</div>
                </div>
              )}
              <div className="detail-item" style={{ position: 'relative' }}>
                <div className="detail-label">Email</div>
                <div className="detail-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '40px' }}>
                  <span>{profile?.email || 'N/A'}</span>
                  <button
                    onClick={() => {
                      setEmailValue(profile?.email || '');
                      setEmailError('');
                      setEmailEditOpen(true);
                    }}
                    style={{
                      position: 'absolute',
                      right: '20px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '4px',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.background = '#f0f0f0';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = 'none';
                    }}
                    title="Edit email"
                  >
                    <Image src="/edit3.svg" alt="Edit" width={20} height={20} />
                  </button>
                </div>
              </div>
              {student.age && (
                <div className="detail-item">
                  <div className="detail-label">Age</div>
                  <div className="detail-value">{student.age}</div>
                </div>
              )}
              {student.gender && (
                <div className="detail-item">
                  <div className="detail-label">Gender</div>
                  <div className="detail-value">{student.gender}</div>
                </div>
              )}
              <div className="detail-item">
                <div className="detail-label">Grade</div>
                <div className="detail-value">{student.grade}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">School</div>
                <div className="detail-value">{student.school || 'N/A'}</div>
              </div>
              {isScoringEnabled && (
              <div className="detail-item">
                <div className="detail-label">Score</div>
                <div className="detail-value" style={{ fontWeight: '700', color: '#1FA8DC' }}>{student?.score !== null && student?.score !== undefined ? student.score : 0}</div>
              </div>
              )}
              <div className="detail-item">
                <div className="detail-label">Student Phone</div>
                <div className="detail-value" style={{ fontFamily: 'monospace' }}>{student.phone}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Parent's Phone</div>
                <div className="detail-value" style={{ fontFamily: 'monospace' }}>{student.parents_phone}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Main Center</div>
                <div className="detail-value">{student.main_center}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Account Status</div>
                <div className="detail-value" style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                  {student.account_state === 'Activated' ? (
                    <span style={{ color: '#28a745' }}>✅ Activated</span>
                  ) : (
                    <span style={{ color: '#dc3545' }}>❌ Deactivated</span>
                  )}
                </div>
              </div>
              {(() => {
                const totals = getTotals();
                return (
                  <>
                    <div className="detail-item" onClick={() => openDetails('absent')} style={{ cursor: 'pointer' }}>
                      <div className="detail-label">Total Absent Sessions</div>
                      <div className="detail-value" style={{ color: '#dc3545', fontWeight: 600 }}>{totals.absent}</div>
                    </div>
                    <div className="detail-item" onClick={() => openDetails('hw')} style={{ cursor: 'pointer' }}>
                      <div className="detail-label">Total Missing Homework</div>
                      <div className="detail-value" style={{ color: '#fd7e14', fontWeight: 600 }}>{totals.missingHW}</div>
                    </div>
                    <div className="detail-item" onClick={() => openDetails('quiz')} style={{ cursor: 'pointer' }}>
                      <div className="detail-label">Total Unattend Quizzes</div>
                      <div className="detail-value" style={{ color: '#1FA8DC', fontWeight: 600 }}>{totals.unattendQuiz}</div>
                    </div>
                  </>
                );
              })()}
            </div>
            
            <div className="weeks-title">All Weeks Records - Available Weeks ({getAvailableWeeks().length} weeks)</div>
            {getAvailableWeeks().length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: '#6c757d',
                fontSize: '1.1rem',
                fontWeight: '500',
                background: '#f8f9fa',
                borderRadius: '8px',
                border: '1px solid #dee2e6'
              }}>
                📋 No weeks records found for this student
              </div>
            ) : (
              <ScrollArea h="calc(30rem * var(--mantine-scale))" type="hover" className={styles.scrolled}>
                <Table striped highlightOnHover withTableBorder withColumnBorders style={{ minWidth: '950px' }}>
                  <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa', zIndex: 10 }}>
                    <Table.Tr>
                      <Table.Th style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>Week</Table.Th>
                      <Table.Th style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>Attendance Info</Table.Th>
                      <Table.Th style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>Homework</Table.Th>
                      <Table.Th style={{ width: '140px', minWidth: '140px', textAlign: 'center' }}>Homework Video</Table.Th>
                      <Table.Th style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>Quiz Degree</Table.Th>
                      <Table.Th style={{ width: '200px', minWidth: '200px', textAlign: 'center' }}>Comment</Table.Th>
                      <Table.Th style={{ width: '130px', minWidth: '130px', textAlign: 'center' }}>Message Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {getAvailableWeeks().map((week) => {
                      const weekName = `week ${String(week.week).padStart(2, '0')}`;
                      const weekData = getWeekAttendance(week.week);
                      
                      return (
                        <Table.Tr key={weekName}>
                          <Table.Td style={{ fontWeight: 'bold', color: '#1FA8DC', width: '120px', minWidth: '120px', textAlign: 'center', fontSize: '1rem' }}>
                            {weekName}
                          </Table.Td>
                          <Table.Td style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>
                            <span style={{ 
                              color: weekData.attended ? (weekData.lastAttendance ? '#212529' : '#28a745') : '#dc3545',
                              fontWeight: 'bold',
                              fontSize: '1rem'
                            }}>
                              {weekData.attended ? (weekData.lastAttendance || '✅ Yes') : '❌ Absent'}
                            </span>
                          </Table.Td>
                          <Table.Td style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>
                            {(() => {
                              if (weekData.hwDone === "No Homework") {
                                return <span style={{ 
                                  color: '#dc3545',
                                  fontWeight: 'bold',
                                  fontSize: '1rem'
                                }}>🚫 No Homework</span>;
                              } else if (weekData.hwDone === "Not Completed" || weekData.hwDone === "not completed" || weekData.hwDone === "NOT COMPLETED") {
                                return <span style={{ 
                                  color: '#ffc107',
                                  fontWeight: 'bold',
                                  fontSize: '1rem'
                                }}>⚠️ Not Completed</span>;
                              } else if (weekData.hwDone === true) {
                                // Show homework degree if it exists
                                const hwDegree = weekData.hwDegree;
                                if (hwDegree && String(hwDegree).trim() !== '') {
                                  return <span style={{ 
                                    color: '#28a745',
                                    fontWeight: 'bold',
                                    fontSize: '1rem'
                                  }}>✅ Done ({hwDegree})</span>;
                                }
                                return <span style={{ 
                                  color: '#28a745',
                                  fontWeight: 'bold',
                                  fontSize: '1rem'
                                }}>✅ Done</span>;
                              } else {
                                return <span style={{ 
                                  color: '#dc3545',
                                  fontWeight: 'bold',
                                  fontSize: '1rem'
                                }}>❌ Not Done</span>;
                              }
                            })()}
                          </Table.Td>
                          <Table.Td style={{ width: '140px', minWidth: '140px', textAlign: 'center' }}>
                            {weekData.view_homework_video === true ? (
                              <span style={{ 
                                color: '#28a745',
                                fontWeight: 'bold',
                                fontSize: '1rem'
                              }}>✅ Viewed</span>
                            ) : (
                              <span style={{ 
                                color: '#dc3545',
                                fontWeight: 'bold',
                                fontSize: '1rem'
                              }}>❌ Not Viewed</span>
                            )}
                          </Table.Td>
                          <Table.Td style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>
                            {(() => {
                              const value = weekData.quizDegree !== null && weekData.quizDegree !== undefined && weekData.quizDegree !== '' ? weekData.quizDegree : '0/0';
                              if (value === "Didn't Attend The Quiz") {
                                return <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '1rem' }}>❌ Didn't Attend The Quiz</span>;
                              } else if (value === "No Quiz") {
                                return <span style={{ color: '#dc3545', fontWeight: 'bold', fontSize: '1rem' }}>🚫 No Quiz</span>;
                              }
                              return (
                                <span style={{ 
                                  fontWeight: 'bold',
                                  fontSize: '1rem',
                                  color: '#1FA8DC'
                                }}>
                                  {value}
                                </span>
                              );
                            })()}
                          </Table.Td>
                          <Table.Td style={{ width: '200px', minWidth: '200px', textAlign: 'center' }}>
                            {(() => {
                              const weekComment = weekData.comment;
                              const val = (weekComment && String(weekComment).trim() !== '') ? weekComment : 'No Comment';
                              return <span style={{ fontSize: '1rem' }}>{val}</span>;
                            })()}
                          </Table.Td>
                          <Table.Td style={{ width: '130px', minWidth: '130px', textAlign: 'center' }}>
                            <span style={{ 
                              color: weekData.message_state ? '#28a745' : '#dc3545',
                              fontWeight: 'bold',
                              fontSize: '1rem'
                            }}>
                              {weekData.message_state ? '✅ Sent' : '❌ Not Sent'}
                            </span>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </div>
        ) : null}
        
        {/* Charts Tabs Section - Separate Container */}
        {student && !studentDeleted && (
          <div className="info-container" style={{ marginTop: '24px' }}>
            <ChartTabs 
              studentId={student.id} 
              hasAuthToken={true} 
            />
            <NeedHelp style={{ padding: '16px', marginTop: '16px' }} />
          </div>
        )}
        
        <Modal
          opened={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          title={
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              padding: '8px 0',
              position: 'relative',
              paddingRight: '60px'
            }}>
              <div style={{
                width: '70px',
                height: '44px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                color: 'white',
              }}>
                {detailsType === 'absent' && '📅'}
                {detailsType === 'hw' && '📝'}
                {detailsType === 'quiz' && '📊'}
              </div>
              <div>
                <div style={{ 
                  fontSize: '1.2rem', 
                  fontWeight: '700', 
                  color: '#2c3e50'
                }}>
                  {detailsTitle}
                </div>
              </div>
            </div>
          }
          centered
          radius="md"
          size="lg"
          withCloseButton={false}
          overlayProps={{ opacity: 0.3, blur: 2 }}
          styles={{
            content: {
              background: '#ffffff',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              border: '1px solid #e9ecef',
              maxWidth: '95vw',
              maxHeight: '90vh',
              margin: '10px',
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              '@media (max-width: 768px)': {
                margin: '5px',
                maxWidth: '98vw',
                maxHeight: '95vh'
              }
            },
            header: {
              background: '#f8f9fa',
              borderBottom: '1px solid #dee2e6',
              padding: '16px 20px',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              flexShrink: 0,
              '@media (max-width: 768px)': {
                padding: '12px 16px'
              }
            },
            body: {
              padding: '0',
              overflow: 'auto',
              flex: 1,
              '@media (max-width: 768px)': {
                padding: '0'
              }
            }
          }}
        >
          <button
            onClick={() => setDetailsOpen(false)}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            style={{
              position: 'absolute',
              top: '16px',
              right: '16px',
              background: 'transparent',
              border: 'none',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '20px',
              zIndex: 1000,
              transition: 'transform 0.3s ease',
              transform: 'scale(1)',
              '@media (max-width: 768px)': {
                width: '36px',
                height: '36px',
                fontSize: '18px',
                top: '12px',
                right: '12px'
              }
            }}
            aria-label="Close details"
          >
            <Image src="/close-cross.svg" alt="Close" width={35} height={35} />
          </button>
          
          <div style={{ 
            padding: '20px', 
            display: 'flex', 
            flexDirection: 'column', 
            height: '100%',
            '@media (max-width: 768px)': { padding: '16px' } 
          }}>
            {(!detailsWeeks || detailsWeeks.length === 0) ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '60px 20px',
                background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                borderRadius: '12px',
                border: '2px dashed #dee2e6'
              }}>
                <div style={{
                  fontSize: '48px',
                  marginBottom: '16px',
                  opacity: 0.6
                }}>
                  🎉
                </div>
                <div style={{ 
                  color: '#28a745', 
                  fontWeight: '700',
                  fontSize: '1.2rem',
                  marginBottom: '8px'
                }}>
                  Excellent Performance!
                </div>
                <div style={{ 
                  color: '#6c757d', 
                  fontWeight: '500',
                  fontSize: '1rem'
                }}>
                  No {detailsType === 'absent' ? 'absent sessions' : 
                       detailsType === 'hw' ? 'missing homework' : 'unattended quizzes'} found.
                </div>
              </div>
            ) : (
              <div style={{ 
                background: 'white',
                borderRadius: '12px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
              }}>
                <div style={{ 
                  flex: 1, 
                  overflow: 'auto',
                  maxHeight: '400px'
                }}>
                  <Table 
                    withTableBorder 
                    withColumnBorders
                    striped
                    highlightOnHover
                    styles={{
                      root: {
                        border: 'none',
                        '@media (max-width: 768px)': {
                          fontSize: '0.85rem'
                        }
                      },
                      thead: {
                        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'
                      },
                      th: {
                        fontWeight: '700',
                        color: '#495057',
                        fontSize: '1rem',
                        padding: '16px 12px',
                        borderBottom: '2px solid #dee2e6',
                        '@media (max-width: 768px)': {
                          fontSize: '0.9rem',
                          padding: '12px 8px'
                        }
                      },
                      td: {
                        padding: '14px 12px',
                        fontSize: '0.95rem',
                        '@media (max-width: 768px)': {
                          padding: '10px 8px',
                          fontSize: '0.85rem'
                        }
                      }
                    }}
                  >
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: '140px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            📅 Week
                          </div>
                        </Table.Th>
                        <Table.Th style={{ textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            {detailsType === 'absent' && '❌ Attendance Status'}
                            {detailsType === 'hw' && '📝 Homework Status'}
                            {detailsType === 'quiz' && '📊 Quiz Status'}
                          </div>
                        </Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {detailsWeeks.map((info, index) => (
                        <Table.Tr key={`student-${studentId}-${info.week}`} style={{
                          background: index % 2 === 0 ? '#ffffff' : '#f8f9fa',
                          transition: 'all 0.2s ease'
                        }}>
                          <Table.Td style={{ 
                            textAlign: 'center',
                            fontWeight: '600',
                            color: '#495057',
                            background: 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                            border: '1px solid #90caf9'
                          }}>
                            <div style={{ 
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              borderRadius: '20px',
                              background: 'white',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}>
                              Week {String(info.week).padStart(2, '0')}
                            </div>
                          </Table.Td>
                          <Table.Td style={{ textAlign: 'center' }}>
                            {detailsType === 'absent' && (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 16px',
                                borderRadius: '20px',
                                background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)',
                                border: '1px solid #ef5350',
                                color: '#c62828',
                                fontWeight: '700',
                                fontSize: '0.95rem',
                                boxShadow: '0 2px 4px rgba(244, 67, 54, 0.2)'
                              }}>
                                ❌ Absent
                              </div>
                            )}
                            {detailsType === 'hw' && (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 16px',
                                borderRadius: '20px',
                                background: info.hwDone === "No Homework" ? 
                                  'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)' :
                                  (info.hwDone === "Not Completed" || info.hwDone === "not completed" || info.hwDone === "NOT COMPLETED") ? 
                                  'linear-gradient(135deg, #fff3cd 0%, #ffeaa7 100%)' :
                                  info.hwDone === false ? 
                                  'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)' :
                                  'linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%)',
                                border: info.hwDone === "No Homework" ? 
                                  '1px solid #ef5350' :
                                  (info.hwDone === "Not Completed" || info.hwDone === "not completed" || info.hwDone === "NOT COMPLETED") ? 
                                  '1px solid #ffc107' :
                                  info.hwDone === false ? 
                                  '1px solid #ef5350' : '1px solid #28a745',
                                color: info.hwDone === "No Homework" ? 
                                  '#c62828' :
                                  (info.hwDone === "Not Completed" || info.hwDone === "not completed" || info.hwDone === "NOT COMPLETED") ? 
                                  '#856404' :
                                  info.hwDone === false ? 
                                  '#c62828' : '#155724',
                                fontWeight: '700',
                                fontSize: '0.95rem',
                                boxShadow: info.hwDone === "No Homework" ? 
                                  '0 2px 4px rgba(244, 67, 54, 0.2)' :
                                  (info.hwDone === "Not Completed" || info.hwDone === "not completed" || info.hwDone === "NOT COMPLETED") ? 
                                  '0 2px 4px rgba(255, 193, 7, 0.2)' :
                                  info.hwDone === false ? 
                                  '0 2px 4px rgba(244, 67, 54, 0.2)' : '0 2px 4px rgba(40, 167, 69, 0.2)'
                              }}>
                                {info.hwDone === "No Homework" ? '🚫 No Homework' :
                                 (info.hwDone === "Not Completed" || info.hwDone === "not completed" || info.hwDone === "NOT COMPLETED") ? '⚠️ Not Completed' : '❌ Not Done'}
                              </div>
                            )}
                            {detailsType === 'quiz' && (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '8px 16px',
                                borderRadius: '20px',
                                background: info.quizDegree === "Didn't Attend The Quiz" ? 
                                  'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)' :
                                  info.quizDegree === "No Quiz" ?
                                  'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)' :
                                  'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)',
                                border: info.quizDegree === "Didn't Attend The Quiz" ? 
                                  '1px solid #ef5350' : 
                                  info.quizDegree === "No Quiz" ?
                                  '1px solid #ef5350' : '1px solid #42a5f5',
                                color: info.quizDegree === "Didn't Attend The Quiz" ? 
                                  '#c62828' : 
                                  info.quizDegree === "No Quiz" ?
                                  '#c62828' : '#1565c0',
                                fontWeight: '700',
                                fontSize: '0.95rem',
                                boxShadow: info.quizDegree === "Didn't Attend The Quiz" ? 
                                  '0 2px 4px rgba(244, 67, 54, 0.2)' : 
                                  info.quizDegree === "No Quiz" ?
                                  '0 2px 4px rgba(244, 67, 54, 0.2)' : '0 2px 4px rgba(66, 165, 245, 0.2)'
                              }}>
                                {info.quizDegree == null ? '0/0' : 
                                  info.quizDegree === "Didn't Attend The Quiz" ? '❌ Didn\'t Attend' : 
                                  info.quizDegree === "No Quiz" ? "🚫 No Quiz" : 
                                  String(info.quizDegree)}
                              </div>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
                
                <div style={{
                  background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
                  padding: '16px 20px',
                  borderTop: '2px solid #dee2e6',
                  textAlign: 'center',
                  flexShrink: 0,
                  position: 'sticky',
                  bottom: 0,
                  zIndex: 5
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '12px',
                    color: '#495057',
                    fontWeight: '600',
                    fontSize: '1rem'
                  }}>
                    <div style={{
                      padding: '6px 12px',
                      borderRadius: '15px',
                      background: 'white',
                      border: '1px solid #dee2e6',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                    }}>
                      📊 Total: {detailsWeeks.length} {detailsType === 'absent' ? 'absent sessions' : 
                                 detailsType === 'hw' ? 'missing homework' : 'unattended quizzes'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>

        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}
      </div>

      {/* Email Edit Modal */}
      <Modal
        opened={emailEditOpen}
        onClose={() => {
          setEmailEditOpen(false);
          setEmailValue('');
          setEmailError('');
        }}
        title={null}
        centered
        radius="md"
        size="md"
        withCloseButton={false}
        overlayProps={{ opacity: 1, blur: 4 }}
        styles={{
          content: {
            background: '#ffffff',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
            border: '1px solid #e9ecef',
            margin: '10px',
          },
          header: {
            display: 'none',
          },
          body: {
            padding: '20px',
          }
        }}
      >
        <div style={{ padding: '8px 0' }}>
          <label style={{
            display: 'block',
            marginBottom: '8px',
            fontWeight: '600',
            color: '#495057',
            fontSize: '0.95rem'
          }}>
            Email <span style={{color: 'red'}}>*</span>
          </label>
          <input
            type="email"
            value={emailValue}
            onChange={(e) => {
              setEmailValue(e.target.value);
              setEmailError('');
            }}
            placeholder="Enter your email"
            style={{
              width: '100%',
              padding: '12px 16px',
              border: emailError ? '2px solid #dc3545' : '2px solid #e9ecef',
              borderRadius: '8px',
              fontSize: '1rem',
              transition: 'border-color 0.3s ease',
              boxSizing: 'border-box'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSaveEmail();
              }
            }}
          />
          {emailError && (
            <div style={{
              marginTop: '8px',
              color: '#dc3545',
              fontSize: '0.85rem',
              fontWeight: '500'
            }}>
              {emailError}
            </div>
          )}
        </div>

        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          marginTop: '24px'
        }}>
          <button
            onClick={handleSaveEmail}
            disabled={isSavingEmail}
            style={{
              padding: '10px 24px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isSavingEmail ? 'not-allowed' : 'pointer',
              opacity: isSavingEmail ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isSavingEmail) {
                e.target.style.backgroundColor = '#218838';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSavingEmail) {
                e.target.style.backgroundColor = '#28a745';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            {isSavingEmail ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => {
              setEmailEditOpen(false);
              setEmailValue('');
              setEmailError('');
            }}
            disabled={isSavingEmail}
            style={{
              padding: '10px 24px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: isSavingEmail ? 'not-allowed' : 'pointer',
              opacity: isSavingEmail ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (!isSavingEmail) {
                e.target.style.backgroundColor = '#c82333';
                e.target.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSavingEmail) {
                e.target.style.backgroundColor = '#dc3545';
                e.target.style.transform = 'translateY(0)';
              }
            }}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
}
