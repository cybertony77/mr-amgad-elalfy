import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Title from "../../components/Title";
import { Table, ScrollArea, Modal } from '@mantine/core';
import { weeks } from "../../constants/weeks";
import styles from '../../styles/TableScrollArea.module.css';
import { useStudents, useStudent, useStudentPublic } from '../../lib/api/students';
import LoadingSkeleton from '../../components/LoadingSkeleton';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/axios';
import Image from 'next/image';
import { verifySignature } from '../../lib/hmac';
import ChartTabs from '../../components/ChartTabs';
import { useSystemConfig } from '../../lib/api/system';

// Helper function to check if user has token by making API call
const hasToken = async () => {
  if (typeof window === 'undefined') return false;
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include'
    });
    return response.ok;
  } catch (error) {
    return false;
  }
};

export default function StudentInfo() {
  const containerRef = useRef(null);
  const [studentId, setStudentId] = useState("");
  const [searchId, setSearchId] = useState(""); // Separate state for search
  const [error, setError] = useState("");
  const [studentDeleted, setStudentDeleted] = useState(false);
  const [searchResults, setSearchResults] = useState([]); // Store multiple search results
  const [showSearchResults, setShowSearchResults] = useState(false); // Show/hide search results
  const [isValidSignature, setIsValidSignature] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAuthToken, setHasAuthToken] = useState(null);
  const router = useRouter();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsType, setDetailsType] = useState('absent');
  const [detailsWeeks, setDetailsWeeks] = useState([]);
  const [detailsTitle, setDetailsTitle] = useState('');

  // Check authentication status and user role
  useEffect(() => {
    const checkAuth = async () => {
      const isAuthenticated = await hasToken();
      setHasAuthToken(isAuthenticated);
      
      // If authenticated, check if user is a student and redirect to my_info
      if (isAuthenticated) {
        try {
          const response = await fetch('/api/auth/me', {
            credentials: 'include'
          });
          if (response.ok) {
            const userData = await response.json();
            // If user is a student and on public student_info page, redirect to my_info
            if (userData.role === 'student' && router.pathname === '/dashboard/student_info') {
              router.push('/student_dashboard/my_info');
            }
          }
        } catch (error) {
          // Ignore errors
        }
      }
    };
    checkAuth();
  }, [router]);

  // Handle URL parameters and HMAC verification
  useEffect(() => {
    if (!router.isReady || hasAuthToken === null) {
      return;
    }
    
    const { id, sig } = router.query;
    
    // Reset states quickly
    setIsLoading(false);
    setIsValidSignature(false);
    setStudentId("");
    
    // Check if signature is provided in URL - verify it regardless of token status
    if (sig) {
      const studentIdFromUrl = String(id || '').trim();
      const signature = String(sig).trim();
      
      // Validate parameters are not empty
      if (!studentIdFromUrl || !signature) {
        console.log('❌ Empty URL parameters with signature');
        router.push('/student_not_found');
        return;
      }
      
      console.log('🔍 Verifying HMAC signature:', { studentIdFromUrl, signature, hasToken: hasAuthToken });
      
      try {
        // Verify the signature
        const isValid = verifySignature(studentIdFromUrl, signature);
        
        if (isValid) {
          console.log('✅ HMAC signature is valid');
          setStudentId(studentIdFromUrl);
          setIsValidSignature(true);
  
          // If user has token, also set searchId to fetch via authenticated API
          if (hasAuthToken) {
            setSearchId(studentIdFromUrl);
          }
        } else {
          console.log('❌ HMAC signature is invalid');
          setIsValidSignature(false);
          router.push('/student_not_found');
        }
      } catch (error) {
        console.error('❌ Error verifying signature:', error);
        setIsValidSignature(false);
        router.push('/student_not_found');
      }
      return;
    }
    
    // No signature in URL - handle based on token status
    if (hasAuthToken) {
      // If authenticated and have ID, put it in search bar
      if (id) {
        setStudentId(String(id));
        setSearchId(String(id));
      }
      return;
    }
    
    // No token and no signature - redirect to login
    console.log('❌ No authentication token and no signature');
    router.push('/');
  }, [router.isReady, router.query.id, router.query.sig, router, hasAuthToken]);

  // Get system configuration
  const { data: systemConfig } = useSystemConfig();
  const systemName = systemConfig?.name || '';
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';

  // Get all students for name-based search (only if authenticated)
  const { data: allStudents } = useStudents({}, { 
    enabled: !!hasAuthToken,
  });
  
  // React Query hook with real-time updates
  const { data: student, isLoading: studentLoading, error: studentError, refetch: refetchStudent, isRefetching, dataUpdatedAt } = useStudent(searchId, { 
    enabled: !!searchId && !!hasAuthToken,
    // Real-time settings for live updates
    refetchInterval: 3 * 1000, // Refetch every 3 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue when tab is not active
    refetchOnWindowFocus: true, // Immediate update when switching back to tab
    refetchOnReconnect: true, // Refetch when reconnecting to internet
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 1000, // Keep in cache for 1 second
    refetchOnMount: true, // Always refetch when component mounts/page entered
    retry: 2, // Retry twice for better reliability
    retryDelay: 1000, // 1 second retry delay
  });

  // Public student hook for HMAC access with real-time updates
  const { data: publicStudent, isLoading: publicStudentLoading, error: publicStudentError, refetch: refetchPublicStudent } = useStudentPublic(studentId, router.query.sig, { 
    enabled: !!studentId && !!isValidSignature && !!router.query.sig && !hasAuthToken,
    // Real-time settings for live updates
    refetchInterval: 3 * 1000, // Refetch every 3 seconds for real-time updates
    refetchIntervalInBackground: true, // Continue when tab is not active
    refetchOnWindowFocus: true, // Immediate update when switching back to tab
    refetchOnReconnect: true, // Refetch when reconnecting to internet
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 1000, // Keep in cache for 1 second
    refetchOnMount: true, // Always refetch when component mounts/page entered
    retry: 2, // Retry twice for better reliability
    retryDelay: 1000, // 1 second retry delay
  });

  // Determine which student data to use
  const currentStudent = hasAuthToken ? student : publicStudent;
  const currentStudentLoading = hasAuthToken ? studentLoading : publicStudentLoading;
  const currentStudentError = hasAuthToken ? studentError : publicStudentError;

  // Get student profile picture - use searchId if authenticated, studentId if public
  const profilePictureStudentId = hasAuthToken ? searchId : studentId;
  const profilePictureSignature = !hasAuthToken && isValidSignature && router.query.sig ? String(router.query.sig).trim() : null;
  
  // Debug logging for profile picture query
  useEffect(() => {
    if (profilePictureStudentId) {
      console.log('🖼️ Profile Picture Query State:', {
        profilePictureStudentId,
        profilePictureSignature,
        hasAuthToken,
        isValidSignature,
        routerSig: router.query.sig,
        enabled: !!profilePictureStudentId && (hasAuthToken || (isValidSignature && !!router.query.sig))
      });
    }
  }, [profilePictureStudentId, profilePictureSignature, hasAuthToken, isValidSignature, router.query.sig]);
  
  const { data: profilePictureData, error: profilePictureError, refetch: refetchProfilePicture } = useQuery({
    queryKey: ['student-profile-picture', profilePictureStudentId, profilePictureSignature, isValidSignature, hasAuthToken],
    queryFn: async () => {
      if (!profilePictureStudentId) {
        console.log('❌ Profile picture query: No student ID');
        return { url: null };
      }
      try {
        // Include signature in query params if public access
        const url = profilePictureSignature 
          ? `/api/profile-picture/student/${profilePictureStudentId}?sig=${encodeURIComponent(profilePictureSignature)}`
          : `/api/profile-picture/student/${profilePictureStudentId}`;
        console.log('📸 Profile picture API request:', { url, hasSignature: !!profilePictureSignature });
        const response = await apiClient.get(url);
        console.log('✅ Profile picture API response:', response.data);
        return response.data;
      } catch (err) {
        console.error('❌ Profile picture API error:', {
          message: err.message,
          status: err.response?.status,
          data: err.response?.data,
          url: err.config?.url
        });
        // Return null on error (401, 403, etc.) - profile picture is optional
        return { url: null };
      }
    },
    enabled: !!profilePictureStudentId && (hasAuthToken || (isValidSignature && !!router.query.sig)),
    staleTime: 50 * 60 * 1000, // 50 minutes
    retry: 1,
  });

  // Refetch profile picture when signature validation completes
  useEffect(() => {
    if (!hasAuthToken && isValidSignature && profilePictureStudentId && router.query.sig && profilePictureData === undefined) {
      console.log('🔄 Refetching profile picture after signature validation', {
        isValidSignature,
        profilePictureStudentId,
        hasSig: !!router.query.sig,
        currentData: profilePictureData
      });
      // Small delay to ensure state is fully updated
      setTimeout(() => {
        refetchProfilePicture();
      }, 100);
    }
  }, [isValidSignature, hasAuthToken, profilePictureStudentId, router.query.sig, refetchProfilePicture, profilePictureData]);

  const profilePictureUrl = profilePictureData?.url || null;

  // Get user email from users collection - use searchId if authenticated, studentId if public
  const emailStudentId = hasAuthToken ? searchId : studentId;
  const emailSignature = !hasAuthToken && isValidSignature && router.query.sig ? String(router.query.sig).trim() : null;
  const { data: userEmailData, refetch: refetchEmail } = useQuery({
    queryKey: ['user-email', emailStudentId, emailSignature, isValidSignature, hasAuthToken],
    queryFn: async () => {
      if (!emailStudentId) return { email: null };
      try {
        // Include signature in query params if public access
        const url = emailSignature 
          ? `/api/users/${emailStudentId}/email?sig=${encodeURIComponent(emailSignature)}`
          : `/api/users/${emailStudentId}/email`;
        const response = await apiClient.get(url);
        return response.data;
      } catch (err) {
        console.error('❌ User email API error:', err);
        return { email: null };
      }
    },
    enabled: !!emailStudentId && (hasAuthToken || (isValidSignature && !!router.query.sig)),
    staleTime: 50 * 60 * 1000, // 50 minutes
    retry: 1,
  });

  const userEmail = userEmailData?.email || null;

  // Refetch email when signature validation completes
  useEffect(() => {
    if (!hasAuthToken && isValidSignature && emailStudentId && router.query.sig && userEmailData === undefined) {
      console.log('🔄 Refetching email after signature validation');
      setTimeout(() => {
        refetchEmail();
      }, 100);
    }
  }, [isValidSignature, hasAuthToken, emailStudentId, router.query.sig, refetchEmail, userEmailData]);
  
  // Debug logging
  useEffect(() => {
    if (searchId) {
      console.log('🖼️ Profile picture state:', {
        searchId,
        profilePictureData,
        profilePictureUrl,
        error: profilePictureError
      });
    }
  }, [searchId, profilePictureData, profilePictureUrl, profilePictureError]);

  // Debug logging for React Query status
  useEffect(() => {
    if (currentStudent && (searchId || studentId)) {
      console.log('🔄 Student Info Page - Data Status:', {
        studentId: searchId || studentId,
        studentName: currentStudent.name,
        isRefetching,
        dataUpdatedAt: new Date(dataUpdatedAt).toLocaleTimeString(),
        attendanceStatus: currentStudent.weeks?.[0]?.attended || false,
        hasAuthToken,
        isPublicAccess: !hasAuthToken
      });
    }
  }, [currentStudent, isRefetching, dataUpdatedAt, searchId, studentId, hasAuthToken]);

  useEffect(() => {
    if (error && !studentDeleted) {
      // Only auto-hide errors that are NOT "student deleted" errors
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error, studentDeleted]);

  // Handle student error
  useEffect(() => {
    if (currentStudentError) {
      if (currentStudentError.response?.status === 404) {
        console.log('❌ Student Info Page - Student not found:', {
          searchId: searchId || studentId,
          error: 'Student deleted or does not exist',
          timestamp: new Date().toLocaleTimeString()
        });
        setStudentDeleted(true);
        setError("Student not exists - This student may have been deleted");
      } else {
        console.log('❌ Student Info Page - Error fetching student:', {
          searchId: searchId || studentId,
          error: currentStudentError.message || currentStudentError,
          timestamp: new Date().toLocaleTimeString()
        });
        setStudentDeleted(false);
        setError("Error fetching student data");
      }
    } else {
      // Clear error when student data loads successfully
      if (currentStudent && !currentStudentError) {
        setStudentDeleted(false);
        setError("");
      }
    }
  }, [currentStudentError, searchId, currentStudent]);

  useEffect(() => {
    // Authentication is now handled by _app.js with HTTP-only cookies
    // This component will only render if user is authenticated
  }, [router]);

  // Force refetch student data when searchId changes (when student is searched)
  useEffect(() => {
    if (searchId && refetchStudent) {
      refetchStudent();
    }
  }, [searchId, refetchStudent]);

  const handleIdSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;
    
    setError("");
    setStudentDeleted(false); // Reset deletion state for new search
    setSearchResults([]);
    setShowSearchResults(false);
    
    const searchTerm = studentId.trim();
    
    // Check if it's a numeric ID
    if (/^\d+$/.test(searchTerm)) {
      if (allStudents) {
        // First check for exact student ID match
        const exactIdMatch = allStudents.find(s => s.id.toString() === searchTerm);
        if (exactIdMatch) {
          setSearchId(searchTerm);
          return;
        }
        // No exact ID match, search by phone number (student phone & parent phone)
        const phoneMatches = allStudents.filter(s =>
          (s.phone && s.phone.includes(searchTerm)) ||
          (s.parents_phone && s.parents_phone.includes(searchTerm)) ||
          (s.parentsPhone && s.parentsPhone.includes(searchTerm))
        );
        if (phoneMatches.length === 1) {
          const foundStudent = phoneMatches[0];
          setSearchId(foundStudent.id.toString());
          setStudentId(foundStudent.id.toString());
        } else if (phoneMatches.length > 1) {
          setSearchResults(phoneMatches);
          setShowSearchResults(true);
          setError(`Found ${phoneMatches.length} students. Please select one.`);
        } else {
          // No phone match either, try as student ID anyway
          setSearchId(searchTerm);
        }
      } else {
        setSearchId(searchTerm);
      }
    } else {
      // Not purely numeric - search by name AND phone number
      if (allStudents) {
        const matchingStudents = allStudents.filter(student => 
          student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (student.phone && student.phone.includes(searchTerm)) ||
          (student.parents_phone && student.parents_phone.includes(searchTerm)) ||
          (student.parentsPhone && student.parentsPhone.includes(searchTerm))
        );
        
        if (matchingStudents.length === 1) {
          // Single match, use it directly
          const foundStudent = matchingStudents[0];
          setSearchId(foundStudent.id.toString());
          setStudentId(foundStudent.id.toString());
        } else if (matchingStudents.length > 1) {
          // Multiple matches, show selection
          setSearchResults(matchingStudents);
          setShowSearchResults(true);
          setError(`Found ${matchingStudents.length} students. Please select one.`);
        } else {
          setError(`No student found matching "${searchTerm}"`);
          setSearchId("");
        }
      } else {
        setError("Student data not loaded. Please try again.");
      }
    }
  };

  // Clear student data when ID input is emptied
  const handleIdChange = (e) => {
    const value = e.target.value;
    setStudentId(value);
    setSearchId(""); // Clear search ID to prevent auto-fetch
    if (!value.trim()) {
      setError("");
      setStudentDeleted(false); // Reset deletion state when clearing input
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  // Handle student selection from search results
  const handleStudentSelect = (selectedStudent) => {
    setSearchId(selectedStudent.id.toString());
    setStudentId(selectedStudent.id.toString());
    setSearchResults([]);
    setShowSearchResults(false);
    setError("");
  };

  // Helper function to get attendance status for a week
  const getWeekAttendance = (weekNumber) => {
    if (!currentStudent || !currentStudent.weeks) return { attended: false, hwDone: false, hwDegree: null, quizDegree: null, message_state: false, lastAttendance: null, view_homework_video: false };
    
    const weekData = currentStudent.weeks.find(w => w.week === weekNumber);
    if (!weekData) return { attended: false, hwDone: false, hwDegree: null, quizDegree: null, message_state: false, lastAttendance: null, view_homework_video: false };
    
    return {
      attended: weekData.attended || false,
      hwDone: weekData.hwDone || false,
      hwDegree: weekData.hwDegree || null,
      quizDegree: weekData.quizDegree || null,
      comment: weekData.comment || null,
      message_state: weekData.message_state || false,
      lastAttendance: weekData.lastAttendance || null,
      view_homework_video: weekData.view_homework_video || false
    };
  };

  // Helper function to get available weeks (all weeks that exist in the database)
  const getAvailableWeeks = () => {
    if (!currentStudent || !currentStudent.weeks || currentStudent.weeks.length === 0) return [];
    
    // Return all weeks that exist in the database, sorted by week number
    return currentStudent.weeks.sort((a, b) => a.week - b.week);
  };

  // Helper to compute totals for the student across all weeks
  const getTotals = () => {
    const weeks = Array.isArray(currentStudent?.weeks) ? currentStudent.weeks : [];
    const absent = weeks.filter(w => w && w.attended === false).length;
    const missingHW = weeks.filter(w => w && (w.hwDone === false || w.hwDone === "Not Completed" || w.hwDone === "not completed" || w.hwDone === "NOT COMPLETED")).length;
    const unattendQuiz = weeks.filter(w => w && (w.quizDegree === "Didn't Attend The Quiz" || w.quizDegree == null)).length;
    return { absent, missingHW, unattendQuiz };
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
    if (!currentStudent) return;
    let title = '';
    let weeksList = [];
    if (type === 'absent') {
      title = `Absent Sessions for ${currentStudent.name} • ID: ${currentStudent.id}`;
      weeksList = getAbsentWeeks(currentStudent.weeks);
    } else if (type === 'hw') {
      title = `Missing Homework for ${currentStudent.name} • ID: ${currentStudent.id}`;
      weeksList = getMissingHWWeeks(currentStudent.weeks);
    } else if (type === 'quiz') {
      title = `Unattended Quizzes for ${currentStudent.name} • ID: ${currentStudent.id}`;
      weeksList = getUnattendQuizWeeks(currentStudent.weeks);
    }
    setDetailsType(type);
    setDetailsWeeks(weeksList);
    setDetailsTitle(title);
    setDetailsOpen(true);
  };

  return (
    <div style={{ 
      padding: "20px 5px 20px 5px"
    }}>
      <div ref={containerRef} style={{ maxWidth: 600, margin: "40px auto", padding: 24 }}>
        <style jsx>{`
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
          }
          .title {
            font-size: 2rem;
            font-weight: 700;
            color: #ffffff;
          }
          .fetch-form {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-bottom: 24px;
          }
          .fetch-input {
            flex: 1;
            padding: 14px 16px;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            font-size: 1rem;
            transition: all 0.3s ease;
            background: #ffffff;
            color: #000000;
          }
          .fetch-input:focus {
            outline: none;
            border-color: #667eea;
            background: white;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          .fetch-btn {
            background: linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%);
            color: white;
            border: none;
            border-radius: 12px;
            padding: 16px 28px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
            display: flex;
            align-items: center;
            gap: 8px;
            min-width: 140px;
            justify-content: center;
          }
          .fetch-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(31, 168, 220, 0.4);
            background: linear-gradient(135deg, #0d8bc7 0%, #5bb8e6 100%);
          }
          .fetch-btn:active {
            transform: translateY(-1px);
            box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
          }
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
          .form-container {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
          }
          .info-container {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            margin-top: 20px;
          }
          .student-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 30px;
          }
          
          /* Only make last item full width if it's the only item */
          .student-details .detail-item:only-child {
            grid-column: 1 / -1;
          }
          
          /* For last odd item: only make it full width if previous item is also odd */
          /* This allows even-odd pairs (like items 2-3) to stay side by side */
          /* Exclude position 3 (where previous is even) - they should pair */
          /* Only apply to positions where previous is odd: 1, 5, 7, 9, etc. */
          .student-details .detail-item:nth-child(1):last-child,
          .student-details .detail-item:nth-child(5):last-child,
          .student-details .detail-item:nth-child(7):last-child,
          .student-details .detail-item:nth-child(9):last-child,
          .student-details .detail-item:nth-child(11):last-child {
            grid-column: 1 / -1;
          }
          
          @media (max-width: 768px) {
            .student-details {
              grid-template-columns: 1fr;
            }
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
            .fetch-form {
              flex-direction: column;
              gap: 12px;
            }
            .fetch-btn {
              width: 100%;
              padding: 14px 20px;
              font-size: 0.95rem;
            }
            .fetch-input {
              width: 100%;
            }
            .form-container, .info-container {
              padding: 24px;
            }
            .student-details {
              gap: 12px;
            }
          }
          
          @media (max-width: 480px) {
            .form-container, .info-container {
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
        `}</style>

        {/* Only show title if authenticated */}
        {hasAuthToken && (
          <Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/user2.svg" alt="Student Info" width={32} height={32} />
              Student Info
            </div>
          </Title>
        )}

        {/* Only show search form if authenticated */}
        {hasAuthToken && (
        <div className="form-container">
          <form onSubmit={handleIdSubmit} className="fetch-form">
            <input
              className="fetch-input"
              type="text"
                placeholder="Enter Student ID, Name, Phone Number"
              value={studentId}
              onChange={handleIdChange}
              required
            />
              <button type="submit" className="fetch-btn" disabled={currentStudentLoading}>
                {currentStudentLoading ? "Loading..." : "🔍 Search"}
        </button>
          </form>
          
          {/* Show search results if multiple matches found */}
          {showSearchResults && searchResults.length > 0 && (
            <div style={{ 
              marginTop: "16px", 
              padding: "16px", 
              background: "#f8f9fa", 
              borderRadius: "8px", 
              border: "1px solid #dee2e6" 
            }}>
              <div style={{ 
                marginBottom: "12px", 
                fontWeight: "600", 
                color: "#495057" 
              }}>
                Select a student:
              </div>
              {searchResults.map((student) => (
                <button
                  key={student.id}
                  onClick={() => handleStudentSelect(student)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "12px 16px",
                    margin: "8px 0",
                    background: "white",
                    border: "1px solid #dee2e6",
                    borderRadius: "6px",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.background = "#e9ecef";
                    e.target.style.borderColor = "#1FA8DC";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.background = "white";
                    e.target.style.borderColor = "#dee2e6";
                  }}
                >
                  <div style={{ fontWeight: "600", color: "#1FA8DC" }}>
                    {student.name} (ID: {student.id})
                  </div>
                    <div style={{ fontSize: "0.9rem", color: "#495057", marginTop: 4 }}>
                      <span style={{ fontFamily: 'monospace' }}>{student.phone || 'N/A'}</span>
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#6c757d", marginTop: 2 }}>
                    {student.grade} • {student.main_center}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        )}
        
        {/* Welcome title for public access (no token) */}
        {currentStudent && !studentDeleted && !hasAuthToken && (
          <div style={{
            textAlign: "center",
            marginBottom: "24px"
          }}>
            <h1 style={{
              fontSize: "2.5rem",
              fontWeight: "700",
              color: "white",
              margin: "0",
              textShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}            >
              {systemName ? `Welcome to ${systemName}!` : 'Welcome!'}
            </h1>
          </div>
        )}

        {currentStudent && !studentDeleted && (
          <div className="info-container">
            <div className="student-details">
              {/* Profile Picture Preview - Read Only - Full Row - Only show if authenticated */}
              {hasAuthToken && (
                <div className="detail-item" style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  gap: '12px',
                  gridColumn: '1 / -1'
                }}>
                <div className="detail-label" style={{ textAlign: 'center', width: '100%' }}>Profile Picture</div>
                {profilePictureUrl ? (
                  <div
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      background: '#e9ecef',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(31,168,220,0.15)',
                      border: '2px solid #1FA8DC',
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                  >
                    <img
                      src={profilePictureUrl}
                      alt="Profile"
                      onError={(e) => {
                          console.error('❌ Image failed to load (404):', profilePictureUrl);
                          // Hide the img element and show placeholder instead
                          const container = e.target.closest('div');
                          if (container) {
                        e.target.style.display = 'none';
                            // Show placeholder with first letter
                            const placeholder = document.createElement('span');
                            placeholder.style.cssText = `
                              fontWeight: 700;
                              fontSize: 36;
                              color: #adb5bd;
                              display: flex;
                              alignItems: center;
                              justifyContent: center;
                              width: 100%;
                              height: 100%;
                              lineHeight: 1;
                              textAlign: center;
                            `;
                            placeholder.textContent = currentStudent?.name && currentStudent.name.length > 0 
                              ? currentStudent.name[0].toUpperCase() 
                              : '?';
                            container.appendChild(placeholder);
                          }
                      }}
                      onLoad={() => {
                        console.log('✅ Image loaded successfully:', profilePictureUrl);
                      }}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '50%'
                      }}
                    />
                  </div>
                ) : (
                  <div
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      background: '#e9ecef',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(31,168,220,0.15)',
                      border: '2px solid #e9ecef',
                      position: 'relative'
                    }}
                  >
                    <span style={{ 
                      fontWeight: 700, 
                      fontSize: 36, 
                      color: '#adb5bd',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%',
                      lineHeight: 1,
                      textAlign: 'center'
                    }}>
                        {currentStudent?.name && currentStudent.name.length > 0 ? currentStudent.name[0].toUpperCase() : '?'}
                    </span>
                  </div>
                )}
              </div>
              )}

              {/* Only show Student ID if user doesn't have token */}
              {!hasAuthToken && (
              <div className="detail-item">
                  <div className="detail-label">Student ID</div>
                  <div className="detail-value">{currentStudent.id}</div>
                </div>
              )}
              <div className="detail-item">
                <div className="detail-label">Student Name</div>
                <div className="detail-value">{currentStudent.name}</div>
              </div>
              {currentStudent?.gender && (
                <div className="detail-item">
                  <div className="detail-label">Gender</div>
                  <div className="detail-value">{currentStudent.gender}</div>
                </div>
              )}
              {currentStudent?.age && (
                <div className="detail-item">
                  <div className="detail-label">Age</div>
                  <div className="detail-value">{currentStudent.age}</div>
                </div>
              )}
              <div className="detail-item">
                <div className="detail-label">Student Phone</div>
                <div className="detail-value" style={{ fontFamily: 'monospace' }}>{currentStudent.phone}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Parent's Phone</div>
                <div className="detail-value" style={{ fontFamily: 'monospace' }}>{currentStudent.parents_phone || currentStudent.parentsPhone || 'N/A'}</div>
              </div>
              {userEmail && (
                <div className="detail-item">
                  <div className="detail-label">Email</div>
                  <div className="detail-value" style={{ fontFamily: 'monospace', wordWrap: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal' }}>{userEmail}</div>
                </div>
              )}
                <div className="detail-item">
                <div className="detail-label">School</div>
                <div className="detail-value">{currentStudent.school || 'N/A'}</div>
                </div>
              {isScoringEnabled && (
              <div className="detail-item">
                <div className="detail-label">Score</div>
                <div className="detail-value" style={{ fontWeight: '700', color: '#1FA8DC' }}>{currentStudent?.score !== null && currentStudent?.score !== undefined ? currentStudent.score : 0}</div>
              </div>
              )}
              {currentStudent?.address && (
              <div className="detail-item">
                  <div className="detail-label">Address</div>
                  <div className="detail-value">{currentStudent.address || 'N/A'}</div>
              </div>
              )}
              <div className="detail-item">
                <div className="detail-label">Main Center</div>
                <div className="detail-value">{currentStudent.main_center}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Grade</div>
                <div className="detail-value">{currentStudent.grade || currentStudent.course || 'N/A'}</div>
              </div>
              {currentStudent?.courseType && (
              <div className="detail-item">
                  <div className="detail-label">Course Type</div>
                  <div className="detail-value">{currentStudent.courseType || 'N/A'}</div>
              </div>
              )}
              {hasAuthToken && currentStudent?.payment?.numberOfSessions !== undefined && (
              <div className="detail-item">
                  <div className="detail-label">Available Number of Sessions</div>
                  <div className="detail-value" style={{ 
                    color: (currentStudent.payment?.numberOfSessions || 0) <= 2 ? '#dc3545' : '#212529',
                    fontWeight: 'bold',
                    fontSize: '16px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                  }}>
                    <span style={{ 
                      fontSize: '18px', 
                      fontWeight: '800',
                      lineHeight: '1.2'
                    }}>
                      {(currentStudent.payment?.numberOfSessions || 0)}
                    </span>
                    <span style={{ 
                      fontSize: '17px', 
                      fontWeight: '600',
                      opacity: '0.9',
                      textTransform: 'lowercase'
                    }}>
                      sessions
                    </span>
              </div>
                </div>
              )}
              {hasAuthToken && (
              <div className="detail-item">
                  <div className="detail-label">Hidden Comment</div>
                  <div className="detail-value" style={{ fontSize: '1rem' }}>
                    {currentStudent.main_comment || 'No Comment'}
                  </div>
              </div>
              )}
              {hasAuthToken && (
              <div className="detail-item">
                <div className="detail-label">Account Status</div>
                <div className="detail-value" style={{ fontSize: '1rem', fontWeight: 'bold' }}>
                    {currentStudent.account_state === 'Deactivated' ? (
                    <span style={{ color: '#dc3545' }}>❌ Deactivated</span>
                  ) : (
                    <span style={{ color: '#28a745' }}>✅ Activated</span>
                  )}
                </div>
              </div>
              )}
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
            
            <div className="weeks-title">All Weeks Records - Available Weeks ({getAvailableWeeks().length} {getAvailableWeeks().length === 1 ? 'week' : 'weeks'})</div>
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
                <Table striped highlightOnHover withTableBorder withColumnBorders style={{ minWidth: '1090px' }}>
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
        )}
        
        {/* Charts Tabs Section - Separate Container */}
        {currentStudent && !studentDeleted && (
          <div className="info-container" style={{ marginTop: '24px' }}>
            <ChartTabs 
              studentId={currentStudent.id} 
              hasAuthToken={hasAuthToken} 
            />
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
              paddingRight: '60px' // Add space for the close button
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
          {/* Absolutely positioned close button */}
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
                        <Table.Tr key={`student-${searchId}-${info.week}`} style={{
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
                                 (info.quizDegree === "Didn't Attend The Quiz" ? "❌ Didn't Attend" : 
                                  info.quizDegree === "No Quiz" ? "🚫 No Quiz" : String(info.quizDegree))}
                              </div>
                            )}
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </div>
                
                {/* Fixed Summary Footer */}
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
    </div>
  );
}

// Modal rendering
// Keep component-level return uncluttered by adding modal just before closing tags

