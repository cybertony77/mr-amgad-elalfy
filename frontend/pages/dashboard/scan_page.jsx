import { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import { AVAILABLE_CENTERS } from "../../constants/centers";
import Title from "../../components/Title";
import AttendanceWeekSelect from "../../components/AttendanceWeekSelect";
import CenterSelect from "../../components/CenterSelect";
import QRScanner from "../../components/QRScanner";
import { useStudents, useStudent, useToggleAttendance, useUpdateHomework, useUpdateHomeworkDegree, useUpdateQuizGrade, useUpdateWeekComment } from "../../lib/api/students";
import { useSystemConfig } from "../../lib/api/system";
import apiClient from "../../lib/axios";

// Helper to extract student ID from QR text (URL or plain number)
function extractStudentId(qrText) {
  try {
    // Try to parse as URL and extract id param
    const url = new URL(qrText);
    const id = url.searchParams.get('id');
    if (id) return id;
  } catch (e) {
    // Not a URL, fall through
  }
  // Fallback: if it's just a number
  if (/^\d+$/.test(qrText)) {
    return qrText;
  }
  return null;
}

export default function QR() {
  const { data: systemConfig } = useSystemConfig();
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';
  
  const containerRef = useRef(null);
  const [studentId, setStudentId] = useState("");
  const [searchId, setSearchId] = useState(""); // Separate state for search
  const [isFromURL, setIsFromURL] = useState(false); // Flag to track if ID came from URL
  const [error, setError] = useState("");
  const [attendSuccess, setAttendSuccess] = useState(false);
  const [hwSuccess, setHwSuccess] = useState("");
  const [attendanceSuccess, setAttendanceSuccess] = useState("");
  const [attendanceCenter, setAttendanceCenter] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [quizDegreeInput, setQuizDegreeInput] = useState("");
  const [quizDegreeOutOf, setQuizDegreeOutOf] = useState("");
  const [weekComment, setWeekComment] = useState("");
  const [commentSuccess, setCommentSuccess] = useState("");
  const [quizSuccess, setQuizSuccess] = useState("");
  const [notQuized, setNotQuized] = useState(false);
  const [noQuiz, setNoQuiz] = useState(false);
  const [noHomework, setNoHomework] = useState(false);
  const [notCompleted, setNotCompleted] = useState(false);
  const [homeworkDegree, setHomeworkDegree] = useState("");
  const [homeworkDegreeOutOf, setHomeworkDegreeOutOf] = useState("");
  const [homeworkDegreeSuccess, setHomeworkDegreeSuccess] = useState("");
  const [openDropdown, setOpenDropdown] = useState(null); // 'week', 'center', or null
  // Simple optimistic state for immediate UI feedback
  const [optimisticHwDone, setOptimisticHwDone] = useState(null);
  
  const [optimisticAttended, setOptimisticAttended] = useState(null);
  const [isQRScanned, setIsQRScanned] = useState(false); // Track if student was found via QR scan
  const [deactivatedErrorShown, setDeactivatedErrorShown] = useState(false); // Track if deactivated error was shown
  const [searchResults, setSearchResults] = useState([]); // Store multiple search results
  const [showSearchResults, setShowSearchResults] = useState(false); // Show/hide search results
  const router = useRouter();

  // Handle URL parameters for auto-filling student ID and triggering search
  useEffect(() => {
    if (!router.isReady) return;
    const { studentId: urlStudentId, autoSearch } = router.query;

    if (urlStudentId && autoSearch === 'true') {
      console.log('🔧 Setting student ID from URL:', urlStudentId);
      setStudentId(urlStudentId);
      setSearchId(urlStudentId);
      setIsFromURL(true);
    }
  }, [router.isReady, router.query]);

  // React Query hooks with enhanced real-time updates
  const { data: rawStudent, isLoading: studentLoading, error: studentError, refetch: refetchStudent } = useStudent(searchId, { 
    enabled: !!searchId,
    // Optimized for fast error responses - background updates only
    refetchInterval: false, // Disabled to prevent auto-refresh - use manual refetch if needed
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false, // Disabled to prevent auto-refresh on window focus
    staleTime: 2 * 60 * 1000, // Consider data fresh for 2 minutes
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
    retry: 1, // Only retry once to show errors faster
    retryDelay: 500, // Retry after 500ms instead of default longer delay
  });
  
  // Get all students for name-based search
  const { data: allStudents } = useStudents();
  const toggleAttendanceMutation = useToggleAttendance();
  const updateHomeworkMutation = useUpdateHomework();
  const updateHomeworkDegreeMutation = useUpdateHomeworkDegree();
  const updateQuizGradeMutation = useUpdateQuizGrade();
  const updateWeekCommentMutation = useUpdateWeekComment();

  // Load remembered values from sessionStorage
  useEffect(() => {
    const rememberedCenter = sessionStorage.getItem('lastAttendanceCenter');
    const rememberedWeek = sessionStorage.getItem('lastSelectedWeek');
    const rememberedQuizOutOf = sessionStorage.getItem('lastQuizOutOf');
    const rememberedHomeworkOutOf = sessionStorage.getItem('lastHomeworkOutOf');
    
    console.log('Loading from session storage:', { rememberedCenter, rememberedWeek, rememberedQuizOutOf, rememberedHomeworkOutOf });
    
    if (rememberedCenter) {
      setAttendanceCenter(rememberedCenter);
      console.log('Center loaded from session storage:', rememberedCenter);
    }
    if (rememberedWeek) {
      setSelectedWeek(rememberedWeek);
      console.log('Week loaded from session storage:', rememberedWeek);
    }
    if (rememberedQuizOutOf) {
      setQuizDegreeOutOf(rememberedQuizOutOf);
      console.log('Quiz out of loaded from session storage:', rememberedQuizOutOf);
    }
    if (rememberedHomeworkOutOf) {
      setHomeworkDegreeOutOf(rememberedHomeworkOutOf);
      console.log('Homework out of loaded from session storage:', rememberedHomeworkOutOf);
    }
  }, []);

  useEffect(() => {
    // Authentication is now handled by _app.js with HTTP-only cookies
    // This component will only render if user is authenticated
  }, [router]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpenDropdown(null);
        // Also blur any focused input to close browser autocomplete
        if (document.activeElement && document.activeElement.tagName === 'INPUT') {
          document.activeElement.blur();
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Helper function to convert week string to numeric index
  const getWeekNumber = (weekString) => {
    if (!weekString) return null;
    const match = weekString.match(/week (\d+)/);
    const result = match ? parseInt(match[1]) : null;
    console.log('🔧 Converting week string:', { weekString, result });
    return result;
  };

  // Helper function to get current week data
  const getCurrentWeekData = (student, weekString) => {
    if (!student.weeks || !weekString) return null;
    const weekNumber = getWeekNumber(weekString);
    if (!weekNumber) return null;
    // Find week by week number, not by array index
    return student.weeks.find(w => w && w.week === weekNumber) || null;
  };

  // Helper function to update student state with current week data
  const updateStudentWithWeekData = (student, weekString) => {
    const weekData = getCurrentWeekData(student, weekString);
    
    // If week data doesn't exist, return student with default week values (not attended)
    if (!weekData) {
      return {
        ...student,
        attended_the_session: false,
        lastAttendance: null,
        lastAttendanceCenter: null,
        hwDone: false,
        hwDegree: null,
        quizDegree: null,
        comment: null,
        message_state: false
      };
    }
    
    // Always load data from database, regardless of attendance status
    // Preserve the exact value from database, including boolean true
    const updatedStudent = {
      ...student,
      attended_the_session: weekData.attended !== undefined ? weekData.attended : false,
      lastAttendance: weekData.lastAttendance || null,
      lastAttendanceCenter: weekData.lastAttendanceCenter || null,
      // Preserve boolean true, false, or string values exactly as they are in DB
      hwDone: weekData.hwDone !== undefined ? weekData.hwDone : false,
      // Preserve hwDegree even if it's an empty string (use nullish coalescing)
      hwDegree: weekData.hwDegree !== undefined && weekData.hwDegree !== null ? weekData.hwDegree : null,
      quizDegree: weekData.quizDegree !== undefined && weekData.quizDegree !== null ? weekData.quizDegree : null,
      comment: weekData.comment || null,
      message_state: weekData.message_state !== undefined ? weekData.message_state : false
    };
    
    // Debug log to verify data loading - always log when there's interesting data
    console.log('📊 Loaded week data from DB:', {
      week: weekString,
      weekNumber: weekData.week,
      attended: weekData.attended,
      hwDone: weekData.hwDone,
      hwDoneType: typeof weekData.hwDone,
      hwDegree: weekData.hwDegree,
      quizDegree: weekData.quizDegree,
      updatedStudentHwDone: updatedStudent.hwDone,
      updatedStudentHwDegree: updatedStudent.hwDegree
    });
    
    return updatedStudent;
  };

  // Update student data with current week information using useMemo
  const student = useMemo(() => {
    if (rawStudent && selectedWeek) {
      const updated = updateStudentWithWeekData(rawStudent, selectedWeek);
      console.log('🔄 Student object updated:', {
        hasRawStudent: !!rawStudent,
        selectedWeek,
        updatedHwDone: updated?.hwDone,
        updatedHwDegree: updated?.hwDegree,
        updatedQuizDegree: updated?.quizDegree
      });
      return updated;
    }
    // If no selectedWeek, try to use week 1 as default if available
    if (rawStudent && rawStudent.weeks && rawStudent.weeks.length > 0) {
      const defaultWeek = rawStudent.weeks.find(w => w && w.week === 1) || rawStudent.weeks[0];
      if (defaultWeek) {
        console.log('⚠️ No selectedWeek, using default week data');
        return {
          ...rawStudent,
          attended_the_session: defaultWeek.attended || false,
          lastAttendance: defaultWeek.lastAttendance || null,
          lastAttendanceCenter: defaultWeek.lastAttendanceCenter || null,
          hwDone: defaultWeek.hwDone !== undefined ? defaultWeek.hwDone : false,
          hwDegree: defaultWeek.hwDegree !== undefined && defaultWeek.hwDegree !== null ? defaultWeek.hwDegree : null,
          quizDegree: defaultWeek.quizDegree !== undefined && defaultWeek.quizDegree !== null ? defaultWeek.quizDegree : null,
          comment: defaultWeek.comment || null,
          message_state: defaultWeek.message_state !== undefined ? defaultWeek.message_state : false
        };
      }
    }
    return rawStudent;
  }, [rawStudent, selectedWeek]);

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;
    
    const searchTerm = studentId.trim();
    
    // Mark that this is a manual search, not QR scan
    setIsQRScanned(false);
    setSearchResults([]);
    setShowSearchResults(false);
    setError(""); // Clear any previous errors
    setDeactivatedErrorShown(false); // Reset deactivated error flag
    
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

  // Handle student selection from search results
  const handleStudentSelect = (selectedStudent) => {
    setSearchId(selectedStudent.id.toString());
    setStudentId(selectedStudent.id.toString());
    setSearchResults([]);
    setShowSearchResults(false);
    setError("");
    setIsQRScanned(false); // Mark as manual search
  };

  useEffect(() => {
    // Authentication is now handled by _app.js with HTTP-only cookies
    // This component will only render if user is authenticated
    
  }, [studentId, student]);

  // Auto-attend student function (reuse main toggle logic so scoring & payment match manual clicks)
  const autoAttendStudent = async () => {
    try {
      console.log('🤖 Auto-attending student via QR scan:', student?.name, 'for week:', selectedWeek, 'center:', attendanceCenter);
      await toggleAttendance();
    } catch (error) {
      console.error('Error in auto-attend:', error);
    }
  };

  // Handle QR code scanned from the QRScanner component
  const handleQRCodeScanned = (scannedStudentId) => {
    setError("");
    setAttendSuccess(false);
    setDeactivatedErrorShown(false); // Reset deactivated error flag
    setStudentId(scannedStudentId);
    setSearchId(scannedStudentId);
    
    // Only mark as QR scanned if center and week are already selected
    // This prevents auto-attendance if student is scanned before selecting center/week
    if (attendanceCenter && selectedWeek) {
      setIsQRScanned(true); // Mark that this student was found via QR scan with conditions met
    } else {
      setIsQRScanned(false); // Don't auto-attend if conditions not met at scan time
    }
  };

  // Handle QR scanner errors
  const handleQRScannerError = (errorMessage) => {
    // Handle both Error objects and strings
    if (errorMessage instanceof Error) {
      console.log(errorMessage.message || 'An error occurred');
    } else {
      console.log(errorMessage);
    }
  };

  // Auto-hide error after 6 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError("") , 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Auto-hide comment success after 4 seconds
  useEffect(() => {
    if (commentSuccess) {
      const timer = setTimeout(() => setCommentSuccess("") , 4000);
      return () => clearTimeout(timer);
    }
  }, [commentSuccess]);

  // Auto-hide quiz success after 4 seconds
  useEffect(() => {
    if (quizSuccess) {
      const timer = setTimeout(() => setQuizSuccess("") , 4000);
      return () => clearTimeout(timer);
    }
  }, [quizSuccess]);

  // Auto-hide homework success after 4 seconds
  useEffect(() => {
    if (hwSuccess) {
      const timer = setTimeout(() => setHwSuccess("") , 4000);
      return () => clearTimeout(timer);
    }
  }, [hwSuccess]);

  // Auto-hide attendance success after 4 seconds
  useEffect(() => {
    if (attendanceSuccess) {
      const timer = setTimeout(() => setAttendanceSuccess("") , 4000);
      return () => clearTimeout(timer);
    }
  }, [attendanceSuccess]);

  // Handle student errors from React Query with immediate feedback
  useEffect(() => {
    if (studentError) {
      setError("Student not found or unauthorized.");
    }
  }, [studentError]);

  // Show immediate error when searchId changes but no student is found after a short delay
  useEffect(() => {
    if (searchId && !studentLoading) {
      const timer = setTimeout(() => {
        if (!rawStudent && !studentError) {
          setError("Student not found or unauthorized.");
        }
      }, 1000); // Show error after 1 second if no data and no error
      
      return () => clearTimeout(timer);
    }
  }, [searchId, studentLoading, rawStudent, studentError]);

  // Check for deactivated student account
  useEffect(() => {
    if (rawStudent && rawStudent.account_state === 'Deactivated' && !deactivatedErrorShown) {
      setError("Sorry you can't scan this student, this student is deactivated.");
      setDeactivatedErrorShown(true);
      // Don't clear the search - keep the ID in the input field
    }
  }, [rawStudent, deactivatedErrorShown]);

  // Simplified logic for error and warning handling
  useEffect(() => {
    if (!rawStudent) return;

    console.log('🔍 Student data loaded:', {
      studentName: rawStudent.name,
      accountState: rawStudent.account_state,
      selectedWeek,
      attendanceCenter
    });

    // If student is deactivated, always show deactivation error regardless of selectors
    if (rawStudent.account_state === "Deactivated") {
      console.log('❌ Deactivated student detected - showing error message');
      setError("Sorry you can't scan this student, this student is deactivated.");
      console.log('🔧 Error state set to:', "Sorry you can't scan this student, this student is deactivated.");
      return;
    }

    // For activated students, clear any errors
    console.log('✅ Activated student - clearing errors');
    setError("");
  }, [rawStudent, selectedWeek, attendanceCenter]);

  // Check for deactivated account immediately when student data is available
  useEffect(() => {
    if (rawStudent && rawStudent.account_state === 'Deactivated') {
      // Clear any success messages
      setAttendSuccess(false);
      setHwSuccess("");
      setQuizSuccess("");
    }
  }, [rawStudent]);

  // Clear optimistic state when student, week, or center changes
  useEffect(() => {
    setOptimisticHwDone(null);
    setOptimisticAttended(null);
    setNotQuized(false);
    setNoHomework(false);
    setNoQuiz(false);
    setNotCompleted(false);
    setWeekComment(""); // Clear week comment when context changes
    setHomeworkDegree(""); // Clear homework degree inputs when context changes
    // Only clear homeworkDegreeOutOf if there's no remembered value from session storage
    const rememberedHomeworkOutOf = sessionStorage.getItem('lastHomeworkOutOf');
    if (!rememberedHomeworkOutOf) {
      setHomeworkDegreeOutOf("");
    }
    
    // Load current week's comment from student when available
    try {
      // Always read directly from rawStudent.weeks as source of truth (like quiz badge does)
      let dbQuizDegree = null;
      let dbHwDone = null;
      let dbHwDegree = null;
      
      if (rawStudent?.weeks && selectedWeek) {
        const weekNumber = getWeekNumber(selectedWeek);
        if (weekNumber) {
          const weekData = rawStudent.weeks.find(w => w && w.week === weekNumber);
          if (weekData) {
            dbQuizDegree = weekData.quizDegree;
            dbHwDone = weekData.hwDone;
            dbHwDegree = weekData.hwDegree;
          }
        }
      }
      
      // Fallback to student object if rawStudent.weeks doesn't have it
      if (dbQuizDegree === null || dbQuizDegree === undefined) {
        dbQuizDegree = student?.quizDegree;
      }
      if (dbHwDone === null || dbHwDone === undefined) {
        dbHwDone = student?.hwDone;
      }
      if (dbHwDegree === null || dbHwDegree === undefined) {
        dbHwDegree = student?.hwDegree;
      }
      
      // Sync quiz degree inputs from database
      const degreeRaw = (dbQuizDegree ?? '').toString().trim();
      const normalized = degreeRaw.toLowerCase().replace(/[''`]/g, '');
    
      const didntAttendTarget = "didnt attend the quiz";
      const noQuizTarget = "no quiz";
    
      setNotQuized(normalized === didntAttendTarget);
      setNoQuiz(normalized === noQuizTarget);
    
      // Sync quiz inputs when value like "15 / 20"
      const match = degreeRaw.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/i);
      if (match) {
        setQuizDegreeInput(match[1]);
        setQuizDegreeOutOf(match[2]);
      } else if (normalized === didntAttendTarget || normalized === noQuizTarget || degreeRaw === '' || degreeRaw == null) {
        setQuizDegreeInput('');
        // Only clear quizDegreeOutOf if there's no remembered value from session storage
        const rememberedQuizOutOf = sessionStorage.getItem('lastQuizOutOf');
        if (!rememberedQuizOutOf) {
          setQuizDegreeOutOf('');
        }
      }

      // Sync "No Homework" and "Not Completed" checkboxes with database value
      setNoHomework(dbHwDone === "No Homework");
      setNotCompleted(dbHwDone === "Not Completed");

      // Sync homework degree inputs when value like "8 / 10" - read from rawStudent.weeks
      const homeworkDegreeRaw = (dbHwDegree ?? '').toString().trim();
      const homeworkMatch = homeworkDegreeRaw.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/i);
      if (homeworkMatch) {
        setHomeworkDegree(homeworkMatch[1]);
        setHomeworkDegreeOutOf(homeworkMatch[2]);
      } else if (homeworkDegreeRaw === '' || homeworkDegreeRaw == null) {
        setHomeworkDegree('');
        // Only clear homeworkDegreeOutOf if there's no remembered value from session storage
        const rememberedHomeworkOutOf = sessionStorage.getItem('lastHomeworkOutOf');
        if (!rememberedHomeworkOutOf) {
          setHomeworkDegreeOutOf('');
        }
      }
    } catch {
      console.error('Error syncing student data');
    }    
  }, [rawStudent, student?.id, selectedWeek, attendanceCenter]);

  // Load week comment from student data when week changes
  useEffect(() => {
    if (student && selectedWeek) {
      const weekData = getCurrentWeekData(student, selectedWeek);
      if (weekData && weekData.comment) {
        setWeekComment(weekData.comment);
      } else {
        setWeekComment("");
      }
    }
  }, [student, selectedWeek]);

  // Ensure quiz degree "out of" value is loaded from session storage when component mounts
  useEffect(() => {
    const rememberedQuizOutOf = sessionStorage.getItem('lastQuizOutOf');
    if (rememberedQuizOutOf && !quizDegreeOutOf) {
      setQuizDegreeOutOf(rememberedQuizOutOf);
      console.log('Quiz out of restored from session storage:', rememberedQuizOutOf);
    }
  }, [quizDegreeOutOf]);

  // Ensure homework degree "out of" value is loaded from session storage when component mounts
  useEffect(() => {
    const rememberedHomeworkOutOf = sessionStorage.getItem('lastHomeworkOutOf');
    if (rememberedHomeworkOutOf && !homeworkDegreeOutOf) {
      setHomeworkDegreeOutOf(rememberedHomeworkOutOf);
      console.log('Homework out of restored from session storage:', rememberedHomeworkOutOf);
    }
  }, [homeworkDegreeOutOf]);

  // Auto-hide homework degree success after 4 seconds
  useEffect(() => {
    if (homeworkDegreeSuccess) {
      const timer = setTimeout(() => setHomeworkDegreeSuccess("") , 4000);
      return () => clearTimeout(timer);
    }
  }, [homeworkDegreeSuccess]);

  // Auto-attend student when conditions are met (ONLY for QR scans with pre-selected center/week)
  useEffect(() => {
    // Only auto-attend if:
    // 1. Student data is loaded
    // 2. Center and week are selected
    // 3. Student is not already attended
    // 4. We haven't already set optimistic attendance
    // 5. Student was found via QR scan AND center/week were already selected at scan time
    if (student && attendanceCenter && selectedWeek && !student.attended_the_session && optimisticAttended === null && isQRScanned) {
      // Add a small delay to ensure UI is ready
      const timer = setTimeout(() => {
        autoAttendStudent();
      }, 800); // 800ms delay for better UX
      
      return () => clearTimeout(timer);
    }
  }, [student, attendanceCenter, selectedWeek, optimisticAttended, isQRScanned]);

  // Reset HW optimistic states when attendance becomes false
  useEffect(() => {
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student?.attended_the_session;
    if (currentAttended === false) {
      // If attendance is false, reset other optimistic states to false/null
      setOptimisticHwDone(false);
      
      // Clear quiz degree inputs as well
      setQuizDegreeInput("");
      // Only clear quizDegreeOutOf if there's no remembered value from session storage
      const rememberedQuizOutOf = sessionStorage.getItem('lastQuizOutOf');
      if (!rememberedQuizOutOf) {
        setQuizDegreeOutOf("");
      }
      // Note: Quiz degree in DB will be handled by the backend reset
    }
  }, [optimisticAttended, student?.attended_the_session]);




  const toggleAttendance = async () => {
    if (!student || !selectedWeek || !attendanceCenter) return;
    if (student.account_deactivated) return; // Don't allow attendance for deactivated accounts
    
    // Use current displayed state (optimistic if available, otherwise DB state)
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
    const newAttended = !currentAttended;
    setOptimisticAttended(newAttended);
    // If marking as absent, clear local comment and uncheck all checkboxes immediately to reflect reset
    if (!newAttended) {
      setWeekComment("");
      setNoHomework(false);
      setNotQuized(false);
      setNoQuiz(false);
      setNotCompleted(false);
    }
    
    const weekNumber = getWeekNumber(selectedWeek);
    if (!weekNumber) {
      console.error('❌ weekNumber is missing — skipping attendance update');
      setError('Please select a valid week before marking attendance.');
      return;
    }
    
    let attendanceData;
    if (newAttended) {
      // Mark as attended - create timestamp and center info
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const lastAttendance = `${day}/${month}/${year} in ${attendanceCenter}`;
      
      attendanceData = { 
        attended: true,
        lastAttendance, 
        lastAttendanceCenter: attendanceCenter, 
        attendanceWeek: weekNumber 
      };
    } else {
      // Mark as not attended - clear attendance info
      attendanceData = { 
        attended: false,
        lastAttendance: null, 
        lastAttendanceCenter: null, 
        attendanceWeek: weekNumber 
      };
    }
    
    console.log('🎯 Scan Page - Toggling attendance:', {
      studentId: student.id,
      studentName: student.name,
      newAttendedState: newAttended,
      weekNumber
    });

    toggleAttendanceMutation.mutate({
      id: student.id,
      attendanceData
    }, {
      onSuccess: async () => {
        setAttendanceSuccess(newAttended ? '✅ Student Marked as Attended' : '✅ Student Marked as Absent');
        // Clear optimistic state since the mutation succeeded
        setOptimisticAttended(null);
        // Disable QR auto-attend after a successful toggle so manual reversals work correctly
        setIsQRScanned(false);
        
        // Calculate score for attendance (only if scoring system is enabled)
        // If reversing to absent, get the last attendance history entry and reverse it
        // Otherwise, just apply the current action points
        if (isScoringEnabled) {
        try {
          if (!newAttended) {
              // Reversing to absent - get last attendance history entry and reverse it
              try {
                const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                  studentId: student.id,
                  type: 'attendance'
                });
                
                if (historyResponse.data.found && historyResponse.data.history) {
                  const lastHistory = historyResponse.data.history;
              const weekNumber = getWeekNumber(selectedWeek);
                  // Reverse the last attendance points and auto-reverse homework/quiz for this week
              await apiClient.post('/api/scoring/calculate', {
                studentId: student.id,
                type: 'attendance',
                    week: weekNumber,
                data: { 
                  status: 'absent',
                      previousStatus: lastHistory.data?.status || 'attend',
                      reverseOnly: true,
                      autoReverseHomework: true,
                      autoReverseQuiz: true
                }
              });
            } else {
                  // No previous attendance history, just apply absent
                  const weekNumber = getWeekNumber(selectedWeek);
                  await apiClient.post('/api/scoring/calculate', {
                    studentId: student.id,
                    type: 'attendance',
                    week: weekNumber,
                    data: { status: 'absent' }
                  });
                }
              } catch (historyErr) {
                console.error('Error getting attendance history:', historyErr);
                // Fallback: just apply absent
              await apiClient.post('/api/scoring/calculate', {
                studentId: student.id,
                type: 'attendance',
                data: { status: 'absent' }
              });
            }
          } else {
            // Marking as attended - just apply the points
              const weekNumber = getWeekNumber(selectedWeek);
            await apiClient.post('/api/scoring/calculate', {
              studentId: student.id,
              type: 'attendance',
                week: weekNumber,
              data: { status: 'attend' }
            });
          }
          // Refetch student data to update score
          if (refetchStudent) {
            refetchStudent();
          }
        } catch (err) {
          console.error('Error calculating attendance score:', err);
          }
        }
        
        // If attendance is reversed to absent, also reverse ALL points (homework, homework degree, quiz)
        // (since homework/quiz can only be done when student is attended)
        // The API automatically sets hwDone to false, hwDegree to null, and quizDegree to null
        if (!newAttended && isScoringEnabled) {
          try {
            const weekNumber = getWeekNumber(selectedWeek);
            
            // Check if there was previous data to reverse
            if (rawStudent?.weeks && selectedWeek) {
              const weekData = rawStudent.weeks.find(w => w && w.week === weekNumber);
              
              // Reverse homework done points using history
              try {
                const hwHistoryResponse = await apiClient.post('/api/scoring/get-last-history', {
                  studentId: student.id,
                  type: 'homework'
                });
                
                if (hwHistoryResponse.data.found && hwHistoryResponse.data.history) {
                  const lastHwHistory = hwHistoryResponse.data.history;
                  // Check if it's homework without degree (has hwDone in data)
                  if (lastHwHistory.data?.hwDone !== undefined) {
                    // Reverse homework without degree
                    await apiClient.post('/api/scoring/calculate', {
                      studentId: student.id,
                      type: 'homework',
                      week: weekNumber,
                      data: { 
                        hwDone: lastHwHistory.data.hwDone,
                        previousHwDone: lastHwHistory.data.hwDone,
                        reverseOnly: true
                      }
                    });
                  } else if (lastHwHistory.data?.percentage !== undefined) {
                    // Reverse homework with degree
                    await apiClient.post('/api/scoring/calculate', {
                      studentId: student.id,
                      type: 'homework',
                      week: weekNumber,
                      data: { 
                        percentage: lastHwHistory.data.percentage,
                        previousPercentage: lastHwHistory.data.percentage,
                        reverseOnly: true
                      }
                    });
                  }
                  }
                } catch (err) {
                console.error('Error reversing homework score:', err);
              }
              
              // Reverse quiz points using history
              try {
                const quizHistoryResponse = await apiClient.post('/api/scoring/get-last-history', {
                  studentId: student.id,
                  type: 'quiz'
                });
                
                if (quizHistoryResponse.data.found && quizHistoryResponse.data.history) {
                  const lastQuizHistory = quizHistoryResponse.data.history;
                  if (lastQuizHistory.data?.percentage !== undefined) {
                    // Reverse quiz points
                    await apiClient.post('/api/scoring/calculate', {
                      studentId: student.id,
                      type: 'quiz',
                      week: weekNumber,
                      data: { 
                        percentage: lastQuizHistory.data.percentage,
                        previousPercentage: lastQuizHistory.data.percentage,
                        reverseOnly: true
                      }
                    });
                  }
                  }
                } catch (err) {
                  console.error('Error reversing quiz score:', err);
              }
            }
            // Refetch student data to update score after reversing all points
            if (refetchStudent) {
              refetchStudent();
            }
          } catch (err) {
            console.error('Error reversing homework/quiz scores:', err);
          }
        }
      }
    });
  };

  const toggleHwDone = async () => {
    if (!student || !selectedWeek || !attendanceCenter) return;
    if (student.account_deactivated) return; // Don't allow homework updates for deactivated accounts
    
    // Check if student is attended - can't do homework if not attended
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
    if (!currentAttended) {
      setError("Student Must be Marked as Attended before homework can be updated.");
      return;
    }
    
    // Use current displayed state (optimistic if available, otherwise DB state)
    const currentHwDone = optimisticHwDone !== null ? optimisticHwDone : student.hwDone;
    
    // Determine the new homework state based on current state
    let newHwDone;
    if (currentHwDone === true) {
      newHwDone = false; // If done, mark as not done
    } else if (currentHwDone === "No Homework") {
      newHwDone = false; // If no homework, mark as not done
    } else if (currentHwDone === "Not Completed") {
      newHwDone = false; // If not completed, mark as not done
    } else {
      newHwDone = true; // If not done, mark as done
    }
    
    setOptimisticHwDone(newHwDone);
    
    const weekNumber = getWeekNumber(selectedWeek);
    
    // Capture previousHwDone BEFORE database update (to get the actual previous state)
    let previousHwDone = null;
    if (rawStudent?.weeks && selectedWeek) {
      const weekData = rawStudent.weeks.find(w => w && w.week === weekNumber);
      if (weekData && weekData.hwDone !== undefined && weekData.hwDone !== null) {
        previousHwDone = weekData.hwDone;
      }
    }
    // If no previous state found in weeks array, use currentHwDone only if it's explicitly set
    if (previousHwDone === null && currentHwDone !== undefined && currentHwDone !== null && currentHwDone !== false) {
      previousHwDone = currentHwDone;
    }
    
    // If marking as false, also clear homework degree
    // If marking as true, also clear homework degree (to avoid double scoring)
    // When using "hw done" button, we use "homework without degree" scoring only
    if (newHwDone === false || newHwDone === true) {
      // Clear homework degree inputs
      setHomeworkDegree("");
      setHomeworkDegreeOutOf("");
      // Clear homework degree in database
      updateHomeworkDegreeMutation.mutate({
        id: student.id,
        homeworkDegreeData: { hwDegree: null, week: weekNumber }
      });
    }
    
    updateHomeworkMutation.mutate({
      id: student.id,
      homeworkData: { hwDone: newHwDone, week: weekNumber }
    }, {
      onSuccess: async () => {
        setHwSuccess(newHwDone ? '✅ Homework Marked as Done' : '✅ Homework Marked as Not Done');
        // Clear optimistic state since the mutation succeeded
        setOptimisticHwDone(null);
        
        // Calculate score for homework WITHOUT degree (hw done button uses this)
        // Only use "homework without degree" scoring when clicking hw done button
        if (isScoringEnabled) {
        try {
            // Get last homework history to get the correct previous state (for this week)
          let actualPreviousHwDone = previousHwDone;
          let useReverseOnly = false;
          
          try {
            const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
              studentId: student.id,
              type: 'homework',
              week: weekNumber
            });
            
            if (historyResponse.data.found && historyResponse.data.history) {
              const lastHistory = historyResponse.data.history;
              // Only use history if it's homework without degree (has hwDone)
              if (lastHistory.data?.hwDone !== undefined) {
                actualPreviousHwDone = lastHistory.data.hwDone;
                // If going from "Not Completed" or true to false, use reverseOnly
                if (newHwDone === false && (actualPreviousHwDone === "Not Completed" || actualPreviousHwDone === true)) {
                  useReverseOnly = true;
                }
              }
            } else {
              // No history found, check if we're going from "Not Completed" to false
              if (newHwDone === false && (previousHwDone === "Not Completed" || previousHwDone === true)) {
                useReverseOnly = true;
              }
            }
          } catch (historyErr) {
            console.error('Error getting homework history, using captured previousHwDone:', historyErr);
            // Fallback: check if we're going from "Not Completed" to false
            if (newHwDone === false && (previousHwDone === "Not Completed" || previousHwDone === true)) {
              useReverseOnly = true;
            }
          }
          
          // Use homework WITHOUT degree scoring (hwDone button)
          await apiClient.post('/api/scoring/calculate', {
            studentId: student.id,
            type: 'homework',
              week: weekNumber,
              data: { 
                hwDone: newHwDone, 
                previousHwDone: actualPreviousHwDone,
                reverseOnly: useReverseOnly
              }
          });
          // Refetch student data to update score
          if (refetchStudent) {
            refetchStudent();
          }
        } catch (err) {
          console.error('Error calculating homework score:', err);
          }
        }
      }
    });
  };

  

  // Add form handler for homework degree
  const handleHomeworkDegreeFormSubmit = async (e) => {
    e.preventDefault();
    await handleHomeworkDegreeSubmit();
  };

  const handleHomeworkDegreeSubmit = async () => {
    if (!student || !selectedWeek || !attendanceCenter) return;
    if (student.account_deactivated) return; // Don't allow homework degree updates for deactivated accounts
    
    // Check if student is attended - can't enter homework degree if not attended
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
    if (!currentAttended) {
      setError("Student Must be Marked as Attended before homework degree can be entered.");
      return;
    }
    
    // If both inputs are empty, save null
    if (homeworkDegree === "" && homeworkDegreeOutOf === "") {
      const weekNumber = getWeekNumber(selectedWeek);
      updateHomeworkDegreeMutation.mutate(
        {
          id: student.id,
          homeworkDegreeData: { hwDegree: null, week: weekNumber }
        },
        {
          onSuccess: () => {
            setHomeworkDegreeSuccess('✅ Homework Degree cleared successfully');
          }
        }
      );
      return;
    }
    
    // If only one input is filled, show error
    if ((homeworkDegree === "" && homeworkDegreeOutOf !== "") || (homeworkDegree !== "" && homeworkDegreeOutOf === "")) {
      setError("Please fill both degree and out of fields, or leave both empty to clear.");
      return;
    }
    
    const homeworkDegreeValue = `${homeworkDegree} / ${homeworkDegreeOutOf}`;
    const weekNumber = getWeekNumber(selectedWeek);
    
    updateHomeworkDegreeMutation.mutate(
      {
        id: student.id,
        homeworkDegreeData: { hwDegree: homeworkDegreeValue, week: weekNumber }
      },
      {
        onSuccess: async () => {
          setHomeworkDegreeSuccess('✅ Homework Degree set successfully');
          
          // Calculate score for homework WITH degree (degree inputs use this)
          // Only use "homework with degree" scoring when submitting degree
          if (isScoringEnabled) {
          try {
            // Calculate percentage from homework degree
            const match = homeworkDegreeValue.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
            if (match) {
              const obtained = parseFloat(match[1]);
              const total = parseFloat(match[2]);
              const percentage = total > 0 ? Math.round((obtained / total) * 100) : 0;
              
              // Get previous homework degree percentage from history
              let previousPercentage = null;
              try {
                const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                  studentId: student.id,
                  type: 'homework'
                });
                
                if (historyResponse.data.found && historyResponse.data.history) {
                  const lastHistory = historyResponse.data.history;
                  // Only use history if it's homework with degree (has percentage)
                  if (lastHistory.data?.percentage !== undefined) {
                    previousPercentage = lastHistory.data.percentage;
                  }
                }
              } catch (historyErr) {
                console.error('Error getting homework history, calculating from current value:', historyErr);
                // Fallback: calculate from current value
              const currentHwDegree = student?.hwDegree ?? null;
              if (currentHwDegree && typeof currentHwDegree === 'string') {
                const prevMatch = String(currentHwDegree).trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
                if (prevMatch) {
                  const prevObtained = parseFloat(prevMatch[1]);
                  const prevTotal = parseFloat(prevMatch[2]);
                  previousPercentage = prevTotal > 0 ? Math.round((prevObtained / prevTotal) * 100) : null;
                  }
                }
              }
              
              // Use homework WITH degree scoring (degree inputs)
              await apiClient.post('/api/scoring/calculate', {
                studentId: student.id,
                type: 'homework',
                week: weekNumber,
                data: { percentage, previousPercentage }
              });
              // Refetch student data to update score
              if (refetchStudent) {
                refetchStudent();
              }
            }
          } catch (err) {
            console.error('Error calculating homework degree score:', err);
          }
          }
        }
      }
    );
    // Do not clear inputs; keep values visible after save
  };

  // Add form handler for quiz degree
  const handleQuizFormSubmit = async (e) => {
    e.preventDefault();
    await handleQuizDegreeSubmit();
  };

  const handleQuizDegreeSubmit = async () => {
    if (!student || !selectedWeek || !attendanceCenter) return;
    if (student.account_deactivated) return; // Don't allow quiz updates for deactivated accounts
    if (quizDegreeInput === "" || quizDegreeOutOf === "") return;
    
    // Check if student is attended - can't enter quiz if not attended
    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
    if (!currentAttended) {
      setError("Student Must be Marked as Attended before quiz degree can be entered.");
      return;
    }
    
    const quizDegreeValue = `${quizDegreeInput} / ${quizDegreeOutOf}`;
    const weekNumber = getWeekNumber(selectedWeek);
    
    updateQuizGradeMutation.mutate(
      {
        id: student.id,
        quizData: { quizDegree: quizDegreeValue, week: weekNumber }
      },
      {
        onSuccess: async () => {
          setQuizSuccess('✅ Quiz Degree set successfully');
          // Ensure the special checkbox is off when a numeric degree is saved
          setNotQuized(false);
          
          // Calculate score for quiz (quiz degree inputs use this)
          // Only use "quiz" scoring when submitting quiz degree
          if (isScoringEnabled) {
          try {
            // Calculate percentage from quiz degree
            const match = quizDegreeValue.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
            if (match) {
              const obtained = parseFloat(match[1]);
              const total = parseFloat(match[2]);
              const percentage = total > 0 ? Math.round((obtained / total) * 100) : 0;
              
              // Get previous quiz degree percentage from history (for this week)
              let previousPercentage = null;
              try {
                const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                  studentId: student.id,
                  type: 'quiz',
                  week: weekNumber
                });
                
                if (historyResponse.data.found && historyResponse.data.history) {
                  const lastHistory = historyResponse.data.history;
                  if (lastHistory.data?.percentage !== undefined) {
                    previousPercentage = lastHistory.data.percentage;
                  }
                }
              } catch (historyErr) {
                console.error('Error getting quiz history, calculating from current value:', historyErr);
                // Fallback: calculate from current value
              const currentQuizDegree = student?.quizDegree ?? null;
              if (currentQuizDegree && typeof currentQuizDegree === 'string' && currentQuizDegree !== "Didn't Attend The Quiz" && currentQuizDegree !== "No Quiz") {
                const prevMatch = String(currentQuizDegree).trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
                if (prevMatch) {
                  const prevObtained = parseFloat(prevMatch[1]);
                  const prevTotal = parseFloat(prevMatch[2]);
                  previousPercentage = prevTotal > 0 ? Math.round((prevObtained / prevTotal) * 100) : null;
                }
              } else if (currentQuizDegree === "Didn't Attend The Quiz") {
                previousPercentage = 0; // 0% for "Didn't Attend The Quiz"
                }
              }
              
              // If going from any percentage to 0% (Didn't Attend The Quiz), use reverseOnly to properly reverse
              // Also check if previousPercentage is 0 (Didn't Attend The Quiz) and we're setting it again
              let useReverseOnly = false;
              if (percentage === 0) {
                // If setting to 0% and there was a previous percentage (including 0%), use reverseOnly
                if (previousPercentage !== null && previousPercentage !== undefined) {
                  useReverseOnly = true;
                }
              }
              
              await apiClient.post('/api/scoring/calculate', {
                studentId: student.id,
                type: 'quiz',
                week: weekNumber,
                data: { 
                  percentage, 
                  previousPercentage,
                  reverseOnly: useReverseOnly
                }
              });
              // Refetch student data to update score
              if (refetchStudent) {
                refetchStudent();
              }
            }
          } catch (err) {
            console.error('Error calculating quiz score:', err);
          }
          }
        }
      }
    );
    // Do not clear inputs; keep values visible after save
  };



  const goBack = () => {
    router.push("/dashboard");
  };

  return (
    <div style={{ 
      minHeight: "100vh",
      padding: "20px 5px 20px 5px",
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
        .back-btn {
          background: linear-gradient(90deg, #6c757d 0%, #495057 100%);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .back-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .input-section {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          margin-bottom: 24px;
        }
        .input-group {
          display: flex;
          gap: 12px;
          align-items: center;
        }
        .manual-input {
          flex: 1;
          padding: 14px 16px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          font-size: 1rem;
          transition: all 0.3s ease;
          background: #ffffff;
          color: #000000;
        }
        .manual-input:focus {
          outline: none;
          border-color: #87CEEB;
          background: white;
          box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.1);
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
        .fetch-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: 0 2px 8px rgba(31, 168, 220, 0.2);
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
        .student-card {
          background: white;
          border-radius: 16px;
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          border: 1px solid rgba(255,255,255,0.2);
        }
        .student-name {
          font-size: 1.5rem;
          font-weight: 700;
          color: #495057;
          margin-bottom: 16px;
          border-bottom: 2px solid #e9ecef;
          padding-bottom: 12px;
        }
        .student-info {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-bottom: 30px;
        }
        .info-item {
          display: flex;
          flex-direction: column;
          background: #ffffff;
          padding: 20px;
          border-radius: 12px;
          border: 2px solid #e9ecef;
          border-left: 4px solid #1FA8DC;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          transition: all 0.3s ease;
        }
        .info-item.select-item {
          border-left: 2px solid #e9ecef;
        }
        .info-label {
          font-weight: 700;
          color: #6c757d;
          font-size: 0.85rem;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .info-value {
          color: #212529;
          font-size: 1.2rem;
          font-weight: 600;
          line-height: 1.4;
        }
        .status-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
        }
        .status-badge {
          padding: 8px 16px;
          border-radius: 25px;
          font-weight: 600;
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 6px;
          min-width: fit-content;
          white-space: nowrap;
        }
        .status-attended {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
        }
        .status-not-attended {
          background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
          color: white;
        }
        .status-incomplete {
          background: linear-gradient(135deg, #ffc107 0%, #ffb74d 100%);
          color: #856404;
          border: 1px solid #ffc107;
        }
        .status-no-homework {
          background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
          color: white;
        }
        .status-didnt-attend {
          background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
          color: white;
        }
        .homework-section {
          display: flex;
          flex-wrap: wrap;
          flex-direction: row;
          align-items: center;
          gap: 12px;
        }
        .homework-label {
          font-weight: 600;
          color: #6c757d;
          font-size: 13.5px;
        }
        .homework-checkbox-label {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-weight: 500;
          cursor: pointer;
          color: #6c757d;
          font-size: 13.5px;
        }
        .mark-attended-btn {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border: none;
          border-radius: 10px;
          padding: 14px 24px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
          width: 100%;
        }
        .mark-attended-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(40, 167, 69, 0.4);
        }
        .success-message {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border-radius: 10px;
          padding: 16px;
          margin-top: 16px;
          text-align: center;
          font-weight: 600;
          box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
        }
        .mark-hw-btn {
          transition: background 0.2s, color 0.2s;
        }
        .select-styled {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 10px;
          font-size: 1rem;
          background: #fff;
          color: #222;
          transition: border-color 0.2s, box-shadow 0.2s;
          margin-top: 4px;
          box-sizing: border-box;
        }
        .select-styled:focus {
          outline: none;
          border-color: #87CEEB;
          box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.1);
        }
        .quiz-row {
          display: flex;
          gap: 8px;
          align-items: center;
          margin-top: 10px;
          margin-bottom: 16px;
          width: 100%;
        }
        .quiz-input {
          width: 40%;
          min-width: 0;
        }
        .quiz-btn {
          width: 20%;
          min-width: 70px;
          padding-left: 0;
          padding-right: 0;
        }
        .quiz-inputs-container {
          display: flex;
          gap: 8px;
          width: 80%;
        }
        @media (max-width: 600px) {
          .quiz-row {
            flex-direction: column;
            gap: 8px;
          }
          .quiz-input, .quiz-btn {
            width: 100%;
          }
          .quiz-inputs-container {
            display: flex;
            gap: 8px;
            width: 100%;
          }
          .quiz-input {
            width: 50%;
          }
        }
        @media (max-width: 768px) {
          .student-info {
            gap: 12px;
          }
          .status-row {
            flex-direction: column;
            gap: 8px;
          }
          .status-badge {
            justify-content: center;
            width: 100%;
          }
          .info-item {
            padding: 16px;
          }
          .info-value {
            font-size: 1rem;
          }
          .input-group {
            flex-direction: column;
            gap: 12px;
          }
          .fetch-btn {
            width: 100%;
            padding: 14px 20px;
            font-size: 0.95rem;
          }
          .manual-input {
            width: 100%;
          }
          .qr-code-btn {
            font-size: 1rem !important;
            padding: 16px 20px !important;
          }
        }
        @media (max-width: 480px) {
          .student-info {
            gap: 10px;
          }
          .info-item {
            padding: 14px;
          }
          .info-label {
            font-size: 0.8rem;
          }
          .info-value {
            font-size: 0.95rem;
          }
          .status-badge {
            font-size: 0.8rem;
            padding: 6px 12px;
          }
          .homework-section {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 0 !important;
          }
          .homework-label {
            margin-bottom: 8px;
            font-size: 0.8rem;
          }
          .homework-checkbox-label {
            margin-bottom: 4px;
            font-size: 0.8rem;
          }
          .qr-code-btn {
            font-size: 0.95rem !important;
            padding: 16px !important;
            line-height: 1.3 !important;
          }
        }
        @media (max-width: 360px) {
          .qr-code-btn {
            font-size: 0.9rem !important;
            padding: 14px !important;
            line-height: 1.2 !important;
          }
        }
      `}</style>

             <Title>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <Image src="/scan.svg" alt="Scan" width={32} height={32} />
                 QR Code Scanner
               </div>
             </Title>

      <div className="input-section">
        <form onSubmit={handleManualSubmit} className="input-group">
                  <input
          className="manual-input"
          type="text"
          placeholder="Enter Student ID, Name, Phone Number"
          value={studentId}
          onChange={(e) => {
            setStudentId(e.target.value);
            // Always hide search results when input changes
            setShowSearchResults(false);
            setSearchResults([]);
            
            // Always clear search ID and reset states when input changes
            // This ensures student data disappears when user modifies input
            setSearchId(""); // Clear search ID to prevent auto-fetch
            setIsQRScanned(false); // Reset QR scan flag when input changes
            
            // Clear error and success when input changes
            if (e.target.value !== studentId) {
              setError("");
              setAttendSuccess(false);
            }
          }}
        />
          <button type="submit" className="fetch-btn">
            🔍 Search
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
                <div style={{ fontSize: "0.9rem", color: "#6c757d" }}>
                  {student.grade} • {student.main_center}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Week and Center Selection - Always visible */}
      <div style={{ 
        background: 'white', 
        borderRadius: 16, 
        padding: 24, 
        boxShadow: '0 8px 32px rgba(0,0,0,0.1)', 
        marginBottom: 24 
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Attendance Center */}
          <div>
            <div style={{ 
              fontWeight: 600, 
              color: '#6c757d', 
              fontSize: '0.9rem', 
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Attendance Center
            </div>
            <CenterSelect
              selectedCenter={attendanceCenter}
              onCenterChange={(center) => {
                setAttendanceCenter(center);
                // Remember the selected center
                if (center) {
                  sessionStorage.setItem('lastAttendanceCenter', center);
                } else {
                  // Clear selection - remove from sessionStorage
                  sessionStorage.removeItem('lastAttendanceCenter');
                }
              }}
            />
          </div>
          
          {/* Attendance Week */}
          <div>
            <div style={{ 
              fontWeight: 600, 
              color: '#6c757d', 
              fontSize: '0.9rem', 
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '1px'
            }}>
              Attendance Week
            </div>
            <AttendanceWeekSelect
              selectedWeek={selectedWeek}
              onWeekChange={(week) => {
                console.log('Week selected:', week);
                setSelectedWeek(week);
                // Save to session storage
                if (week) {
                  sessionStorage.setItem('lastSelectedWeek', week);
                  console.log('Week saved to session storage:', week);
                } else {
                  // Clear selection - remove from sessionStorage
                  sessionStorage.removeItem('lastSelectedWeek');
                  console.log('Week removed from session storage');
                }
              }}
              required={true}
            />
          </div>
        </div>
      </div>

      <QRScanner 
        onQRCodeScanned={handleQRCodeScanned}
        onError={handleQRScannerError}
      />

      {/* Warning box when week or center is not selected - for both activated and deactivated accounts */}
      {student && (!selectedWeek || !attendanceCenter) && (
        <>
          {console.log('⚠️ Warning box showing:', {
            studentName: student.name,
            accountState: rawStudent?.account_state,
            selectedWeek,
            attendanceCenter,
            showWarning: true
          })}
        <div style={{
          background: 'linear-gradient(135deg, #ff6b6b 0%, #ee5a52 50%, #dc3545 100%)',
          color: 'white',
          borderRadius: 20,
          padding: 'clamp(20px, 4vw, 32px) clamp(16px, 3vw, 24px)',
          marginBottom: 32,
          textAlign: 'center',
          fontWeight: 600,
          boxShadow: '0 8px 32px rgba(220, 53, 69, 0.4), 0 4px 16px rgba(0, 0, 0, 0.1)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          position: 'relative',
          overflow: 'hidden',
          backdropFilter: 'blur(10px)',
          maxWidth: '100%',
          width: '100%',
          boxSizing: 'border-box',
        }}>
          {/* Animated background pattern */}
          <div style={{
            position: 'absolute',
            top: '-50%',
            left: '-50%',
            width: '200%',
            height: '200%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
          }} />
          
          {/* Warning icon with enhanced styling */}
          <div style={{ 
            fontSize: 'clamp(32px, 8vw, 48px)', 
            marginBottom: 'clamp(16px, 3vw, 20px)',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
          }}>
            ⚠️
          </div>
          
          {/* Main warning text */}
          <div style={{ 
            fontSize: 'clamp(1.1rem, 4vw, 1.3rem)', 
            marginBottom: 'clamp(8px, 2vw, 12px)',
            fontWeight: '700',
            textShadow: '0 2px 4px rgba(0,0,0,0.3)',
            letterSpacing: '0.5px',
            lineHeight: '1.3'
          }}>
            Required Selections Missing
          </div>
          
          {/* Subtitle */}
          <div style={{ 
            fontSize: 'clamp(0.95rem, 3.5vw, 1.1rem)', 
            marginBottom: 'clamp(12px, 2.5vw, 16px)',
            fontWeight: '500',
            opacity: 0.95,
            lineHeight: '1.4',
            padding: '0 clamp(8px, 2vw, 16px)'
          }}>
            Please select both <strong>Week</strong> and <strong>Center</strong> to track students correctly
          </div>
          
          {/* Help text */}
          <div style={{ 
            fontSize: 'clamp(0.85rem, 3vw, 0.95rem)', 
            opacity: 0.85,
            fontStyle: 'italic',
            background: 'rgba(255, 255, 255, 0.1)',
            padding: 'clamp(10px, 2.5vw, 12px) clamp(12px, 3vw, 16px)',
            borderRadius: '12px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(5px)',
            margin: '0 clamp(4px, 1vw, 8px)'
          }}>
            💡 Student data will be shown once you make your selections above
          </div>
        </div>
        </>
      )}


      {student && selectedWeek && attendanceCenter && rawStudent?.account_state !== 'Deactivated' && (
        <div className="student-card">
          {console.log('📋 Student card rendering:', {
            studentName: student.name,
            accountState: rawStudent?.account_state,
            selectedWeek,
            attendanceCenter,
            showCard: true
          })}
          <div className="student-name">{student.name}</div>
          
                  
          <div className="student-info">
              {isScoringEnabled && (
              <div className="info-item">
                <span className="info-label">Score</span>
                <span className="info-value">{rawStudent?.score !== null && rawStudent?.score !== undefined ? rawStudent.score : 0}</span>
              </div>
              )}
              {student.grade && (
              <div className="info-item">
                <span className="info-label">Grade</span>
                <span className="info-value">{student.grade}</span>
              </div>
              )}
            {student.main_center && (
            <div className="info-item">
              <span className="info-label">Main Center</span>
              <span className="info-value">{student.main_center}</span>
            </div>
            )}
            {student.school && (
            <div className="info-item">
              <span className="info-label">School</span>
              <span className="info-value">{student.school}</span>
            </div>
            )}
            {student.main_comment && (
            <div className="info-item">
              <span className="info-label">Main Comment</span>
              <span className="info-value">{student.main_comment}</span>
            </div>
            )}
          </div>

          <div className="status-row">
            <span className={`status-badge ${(!attendanceCenter || !selectedWeek) 
              ? 'status-not-attended' 
              : (optimisticAttended !== null ? optimisticAttended : student.attended_the_session) 
                ? 'status-attended' 
                : 'status-not-attended'}`}>
              {(!attendanceCenter || !selectedWeek) 
                ? '❌ Absent' 
                : (optimisticAttended !== null ? optimisticAttended : student.attended_the_session) 
                  ? '✅ Attended' 
                  : '❌ Absent'}
            </span>
            <span className={`status-badge ${(() => {
              // Always read from database - try rawStudent.weeks first, then fallback to student object
              let dbHwDone = null;
              
              // Determine which week to use
              let weekNumber = null;
              if (selectedWeek) {
                weekNumber = getWeekNumber(selectedWeek);
              } else if (rawStudent?.weeks && rawStudent.weeks.length > 0) {
                // If no selectedWeek, try to use week 1 or first available week
                const week1Data = rawStudent.weeks.find(w => w && w.week === 1);
                if (week1Data) {
                  weekNumber = 1;
                } else {
                  // Use first week in array
                  const firstWeek = rawStudent.weeks[0];
                  if (firstWeek && firstWeek.week) {
                    weekNumber = firstWeek.week;
                  }
                }
              }
              
              if (rawStudent?.weeks && weekNumber) {
                const weekData = rawStudent.weeks.find(w => w && w.week === weekNumber);
                if (weekData) {
                  dbHwDone = weekData.hwDone;
                }
              }
              
              // Fallback to student object or optimistic update
              const currentHwDone = optimisticHwDone !== null ? optimisticHwDone : (dbHwDone ?? student?.hwDone ?? false);
              
              // Determine badge style based on database value
              if (currentHwDone === "No Homework") {
                return 'status-no-homework';
              }
              if (currentHwDone === "Not Completed") {
                return 'status-incomplete';
              }
              if (currentHwDone === true) {
                return 'status-attended'; // Green background for done
              }
              return 'status-not-attended'; // Red background for not done
            })()}`}>
              {(() => {
                // Always read from database - try rawStudent.weeks first, then fallback to student object
                let dbHwDone = null;
                let dbHwDegree = null;
                
                // Determine which week to use
                let weekToUse = selectedWeek;
                let weekNumber = null;
                
                if (weekToUse) {
                  weekNumber = getWeekNumber(weekToUse);
                } else if (rawStudent?.weeks && rawStudent.weeks.length > 0) {
                  // If no selectedWeek, try to use week 1 or first available week
                  const week1Data = rawStudent.weeks.find(w => w && w.week === 1);
                  if (week1Data) {
                    weekNumber = 1;
                  } else {
                    // Use first week in array
                    const firstWeek = rawStudent.weeks[0];
                    if (firstWeek && firstWeek.week) {
                      weekNumber = firstWeek.week;
                    }
                  }
                }
                
                // First, try to read directly from rawStudent.weeks (source of truth)
                if (rawStudent?.weeks && weekNumber) {
                  const weekData = rawStudent.weeks.find(w => w && w.week === weekNumber);
                  if (weekData) {
                    dbHwDone = weekData.hwDone;
                    dbHwDegree = weekData.hwDegree;
                  }
                }
                
                // Fallback to student object (which should be populated by updateStudentWithWeekData)
                if (dbHwDone === null || dbHwDone === undefined) {
                  dbHwDone = student?.hwDone;
                }
                if (dbHwDegree === null || dbHwDegree === undefined) {
                  dbHwDegree = student?.hwDegree;
                }
                
                // Use optimistic update if available, otherwise use database value
                const currentHwDone = optimisticHwDone !== null ? optimisticHwDone : (dbHwDone ?? false);
                const currentHwDegree = dbHwDegree ?? null;
                
                // Debug log to see what values we're working with
                console.log('🏷️ Homework badge rendering:', {
                  hasRawStudent: !!rawStudent,
                  hasWeeks: !!rawStudent?.weeks,
                  selectedWeek,
                  weekNumber,
                  weekData: rawStudent?.weeks?.find(w => w && w.week === weekNumber),
                  dbHwDone,
                  dbHwDoneType: typeof dbHwDone,
                  dbHwDegree,
                  studentHwDone: student?.hwDone,
                  studentHwDegree: student?.hwDegree,
                  optimisticHwDone,
                  currentHwDone,
                  currentHwDoneType: typeof currentHwDone,
                  currentHwDegree,
                  rawStudentWeeks: rawStudent?.weeks
                });
                
                // If no attendance center or week selected, still show database value if available
                if (!attendanceCenter || !selectedWeek) {
                  // Still try to show database value even if week/center not selected
                  if (currentHwDone === true) {
                    if (currentHwDegree && String(currentHwDegree).trim() !== '') {
                      return `✅ Homework: Done (${currentHwDegree})`;
                    }
                    return '✅ Homework: Done';
                  }
                  if (currentHwDone === "No Homework") {
                    return '🚫 Homework: No Homework';
                  }
                  if (currentHwDone === "Not Completed") {
                    return '⚠️ Homework: Not Completed';
                  }
                  return '❌ Homework: Not Done';
                }
                
                // Always check database value first
                if (currentHwDone === "No Homework") {
                  return '🚫 Homework: No Homework';
                }
                if (currentHwDone === "Not Completed") {
                  return '⚠️ Homework: Not Completed';
                }
                // Show homework degree if hwDone is true (from database or optimistic)
                // Check for boolean true explicitly - this is the key check
                if (currentHwDone === true) {
                  if (currentHwDegree && String(currentHwDegree).trim() !== '') {
                    return `✅ Homework: Done (${currentHwDegree})`;
                  }
                  return '✅ Homework: Done';
                }
                return '❌ Homework: Not Done';
              })()}
            </span>
            
            <span className={`status-badge ${(!attendanceCenter || !selectedWeek) 
              ? 'status-not-attended' 
              : (student?.quizDegree ?? '') === "Didn't Attend The Quiz"
                ? 'status-didnt-attend'
                : (student?.quizDegree ?? '') === "No Quiz"
                  ? 'status-no-homework'
                  : student?.quizDegree 
                    ? 'status-attended' 
                    : 'status-not-attended'}`}>
              {(!attendanceCenter || !selectedWeek) 
                ? '❌ Quiz: ...' 
                : (student?.quizDegree ?? '') === "Didn't Attend The Quiz"
                  ? '❌ Quiz: Didn\'t Attend'
                : (student?.quizDegree ?? '') === "No Quiz"
                  ? '🚫 Quiz: No Quiz'
                : student?.quizDegree 
                  ? `✅ Quiz: ${student.quizDegree}` 
                  : '❌ Quiz: ...'}
            </span>
          </div>

          {/* Show current attendance info if student is attended AND center/week are selected */}
          {(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) && student.lastAttendance && attendanceCenter && selectedWeek && (
            <div className="info-item">
              <div className="info-label">Attendance info:</div>
              <div className="info-value" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                {student.lastAttendance}
              </div>
            </div>
          )}
          

          {/* Warning message when week/center not selected */}
          {(!selectedWeek || !attendanceCenter) && (
            <div style={{
              background: 'linear-gradient(135deg, #ffc107 0%, #ffb74d 100%)',
              color: 'white',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 8,
              textAlign: 'center',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(255, 193, 7, 0.3)',
              fontSize: '0.9rem'
            }}>
              ⚠️ Please select both a attendance week and attendance center to enable tracking attendance
            </div>
          )}

          {/* Simple toggle buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            
            {/* Attendance Toggle Button - Always visible */}
            <button
              className="toggle-btn"
              onClick={toggleAttendance}
              disabled={!attendanceCenter || !selectedWeek || rawStudent?.account_state === 'Deactivated'}
              style={{
                width: '100%',
                background: (!attendanceCenter || !selectedWeek) 
                  ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' // Default "Not Attended" state
                  : (optimisticAttended !== null ? optimisticAttended : student.attended_the_session) 
                    ? 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)' 
                    : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: '1.1rem',
                padding: '14px 0',
                cursor: (!attendanceCenter || !selectedWeek) ? 'not-allowed' : 'pointer',
                opacity: (!attendanceCenter || !selectedWeek) ? 0.5 : 1,
                transition: 'all 0.3s ease'
              }}
            >
              {(!attendanceCenter || !selectedWeek) 
                ? '✅ Mark as Attended' 
                : (optimisticAttended !== null ? optimisticAttended : student.attended_the_session) 
                  ? '❌ Mark as Absent' 
                  : '✅ Mark as Attended'}
            </button>

            {/* Homework Status Controls */}
            <div className="homework-section">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="homework-label">HOMEWORK STATUS :</span>
                <label className="homework-checkbox-label">
              <input
                type="checkbox"
                checked={notCompleted}
                disabled={!attendanceCenter || !selectedWeek || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated'}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  setNotCompleted(checked);

                  if (!student || !selectedWeek || !attendanceCenter) {
                    setError('Please select student, week and center first.');
                    setNotCompleted(!checked);
                    return;
                  }

                  if (rawStudent?.account_state === 'Deactivated') {
                    setError('Cannot update homework for deactivated student.');
                    setNotCompleted(!checked);
                    return;
                  }

                  const currentAttended =
                    optimisticAttended !== null
                      ? optimisticAttended
                      : student.attended_the_session;

                  if (!currentAttended) {
                    setError('Student must be marked as attended before homework can be updated.');
                    setNotCompleted(!checked);
                    return;
                  }

                  const weekNumber = getWeekNumber(selectedWeek);

                  if (checked) {
                    // Uncheck "No Homework" if it's checked (mutually exclusive)
                    if (noHomework) {
                      setNoHomework(false);
                    }
                    // Clear homework degree inputs when "Not Completed" is selected
                    setHomeworkDegree("");
                    setHomeworkDegreeOutOf("");
                    // Clear homework degree in database
                    updateHomeworkDegreeMutation.mutate({
                      id: student.id,
                      homeworkDegreeData: { hwDegree: null, week: weekNumber }
                    });
                    // ✅ Save "Not Completed" to DB
                    updateHomeworkMutation.mutate({
                      id: student.id,
                      homeworkData: { hwDone: "Not Completed", week: weekNumber },
                    }, {
                      onSuccess: async () => {
                        setHwSuccess('✅ Not Completed status set');
                        
                        // Calculate score for homework (without degree, with previous state to reverse points)
                        if (isScoringEnabled) {
                        try {
                          // Get previous homework state from rawStudent.weeks
                          let previousHwDone = null;
                          if (rawStudent?.weeks && selectedWeek) {
                            const weekNumber = getWeekNumber(selectedWeek);
                            const weekData = rawStudent.weeks.find(w => w && w.week === weekNumber);
                            if (weekData && weekData.hwDone !== undefined && weekData.hwDone !== null) {
                              previousHwDone = weekData.hwDone;
                            }
                          }
                          
                          await apiClient.post('/api/scoring/calculate', {
                            studentId: student.id,
                            type: 'homework',
                              week: weekNumber,
                            data: { hwDone: "Not Completed", previousHwDone }
                          });
                          // Refetch student data to update score
                          if (refetchStudent) {
                            refetchStudent();
                          }
                        } catch (err) {
                          console.error('Error calculating homework score:', err);
                          }
                        }
                      }
                    });
                    setOptimisticHwDone(false);
                  } else {
                    // Unchecking "Not Completed" - reverse the points
                    // Get previous state from history
                    let previousHwDone = "Not Completed";
                    try {
                      const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                        studentId: student.id,
                        type: 'homework',
                        week: weekNumber
                      });
                      
                      if (historyResponse.data.found && historyResponse.data.history) {
                        const lastHistory = historyResponse.data.history;
                        if (lastHistory.data?.hwDone !== undefined) {
                          previousHwDone = lastHistory.data.hwDone;
                        }
                      }
                    } catch (historyErr) {
                      console.error('Error getting homework history for reverse:', historyErr);
                    }
                    
                    // Clear homework degree inputs when unchecked
                    setHomeworkDegree("");
                    setHomeworkDegreeOutOf("");
                    // Clear homework degree in database
                    updateHomeworkDegreeMutation.mutate({
                      id: student.id,
                      homeworkDegreeData: { hwDegree: null, week: weekNumber }
                    });
                    // ✅ Reset to false when unchecked
                    updateHomeworkMutation.mutate({
                      id: student.id,
                      homeworkData: { hwDone: false, week: weekNumber },
                    }, {
                      onSuccess: async () => {
                        setHwSuccess('✅ Homework status reset');
                        
                        // Reverse the previous homework points (if it was "Not Completed" or true)
                        // The API will use history to find the exact points to reverse
                        if ((previousHwDone === "Not Completed" || previousHwDone === true) && isScoringEnabled) {
                          try {
                            await apiClient.post('/api/scoring/calculate', {
                              studentId: student.id,
                              type: 'homework',
                              week: weekNumber,
                              data: { 
                                hwDone: false,
                                previousHwDone: previousHwDone,
                                reverseOnly: true
                              }
                            });
                            // Refetch student data to update score
                            if (refetchStudent) {
                              refetchStudent();
                            }
                          } catch (err) {
                            console.error('Error reversing homework score:', err);
                          }
                        }
                      }
                    });
                    setOptimisticHwDone(false);
                  }
                }}
              />
                <span>NOT COMPLETED</span>
              </label>
              </div>
              <label className="homework-checkbox-label">
              <input
                type="checkbox"
                checked={noHomework}
                disabled={!attendanceCenter || !selectedWeek || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated'}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  setNoHomework(checked);

                  if (!student || !selectedWeek || !attendanceCenter) {
                    setError('Please select student, week and center first.');
                    setNoHomework(!checked);
                    return;
                  }

                  if (rawStudent?.account_state === 'Deactivated') {
                    setError('Cannot update homework for deactivated student.');
                    setNoHomework(!checked);
                    return;
                  }

                  const currentAttended =
                    optimisticAttended !== null
                      ? optimisticAttended
                      : student.attended_the_session;

                  if (!currentAttended) {
                    setError('Student must be marked as attended before homework can be updated.');
                    setNoHomework(!checked);
                    return;
                  }

                  const weekNumber = getWeekNumber(selectedWeek);

                  if (checked) {
                    // Uncheck "Not Completed" if it's checked (mutually exclusive)
                    if (notCompleted) {
                      setNotCompleted(false);
                    }
                    // Clear homework degree inputs when "No Homework" is selected
                    setHomeworkDegree("");
                    setHomeworkDegreeOutOf("");
                    // Clear homework degree in database
                    updateHomeworkDegreeMutation.mutate({
                      id: student.id,
                      homeworkDegreeData: { hwDegree: null, week: weekNumber }
                    });
                    // ✅ Save "No Homework" to DB
                    updateHomeworkMutation.mutate({
                      id: student.id,
                      homeworkData: { hwDone: "No Homework", week: weekNumber },
                    }, {
                      onSuccess: async () => {
                        setHwSuccess('✅ No Homework status set');
                        
                        // Calculate score for homework (without degree) - "No Homework" doesn't affect score
                        // No scoring call needed for "No Homework" as it's not in the rules
                      }
                    });
                    setOptimisticHwDone(false);
                  } else {
                    // Clear homework degree inputs when unchecked
                    setHomeworkDegree("");
                    setHomeworkDegreeOutOf("");
                    // Clear homework degree in database
                    updateHomeworkDegreeMutation.mutate({
                      id: student.id,
                      homeworkDegreeData: { hwDegree: null, week: weekNumber }
                    });
                    // ✅ Reset to false when unchecked
                    updateHomeworkMutation.mutate({
                      id: student.id,
                      homeworkData: { hwDone: false, week: weekNumber },
                    }, {
                      onSuccess: () => {
                        setHwSuccess('✅ Homework status reset');
                      }
                    });
                    setOptimisticHwDone(false);
                  }
                }}
              />
                <span>NO HOMEWORK</span>
              </label>
            </div>
            {!noHomework && !notCompleted && (
              <button
                className="toggle-btn"
                onClick={toggleHwDone}
                disabled={!attendanceCenter || !selectedWeek || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated'}
                style={{
                  width: '100%',
                  background: (!attendanceCenter || !selectedWeek)
                    ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
                    : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)
                        ? ((optimisticHwDone !== null ? optimisticHwDone : student.hwDone) === true
                            ? 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)'
                            : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)')
                      : (optimisticHwDone !== null ? optimisticHwDone : student.hwDone)
                        ? 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)'
                        : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  fontWeight: 600,
                  fontSize: '1.1rem',
                  padding: '14px 0',
                  cursor: (!attendanceCenter || !selectedWeek || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'pointer',
                  opacity: (!attendanceCenter || !selectedWeek || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                  transition: 'all 0.3s ease'
                }}
              >
                {(() => {
                  if (!attendanceCenter || !selectedWeek) {
                    return '✅ Mark as H.W Done';
                  }
                  const currentAttended = optimisticAttended !== null ? optimisticAttended : (student?.attended_the_session ?? false);
                  // Always use database value, but allow optimistic updates when available
                  const currentHwDone = optimisticHwDone !== null ? optimisticHwDone : (student?.hwDone ?? false);
                  const currentHwDegree = student?.hwDegree ?? null;
                  
                  if (!currentAttended) {
                    // Show DB state even when not attended, but indicate it's disabled
                    if (currentHwDone === true) {
                      if (currentHwDegree && String(currentHwDegree).trim() !== '') {
                        return `❌ Mark as H.W Not Done (${currentHwDegree})`;
                      }
                      return '❌ Mark as H.W Not Done';
                    }
                    return '✅ Mark as H.W Done';
                  }
                  
                  // When attended, show current state
                  if (currentHwDone === true) {
                    // Show homework degree if it exists
                    if (currentHwDegree && String(currentHwDegree).trim() !== '') {
                      return `❌ Mark as H.W Not Done (${currentHwDegree})`;
                    }
                    return '❌ Mark as H.W Not Done';
                  }
                  return '✅ Mark as H.W Done';
                })()}
              </button>
            )}

            {/* Homework Degree Input Section - Show when homework is done (even if not attended, but disabled) */}
            {!noHomework && !notCompleted && (optimisticHwDone !== null ? optimisticHwDone : student.hwDone) === true && (
              <div
                className="info-label"
                style={{
                  marginBottom: 0,
                  marginTop: 0,
                  textAlign: 'start',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  gap: 12,
                  flexWrap: 'wrap',
                  rowGap: 6,
                  columnGap: 12,
                }}
              >
                <span>Homework Degree : (Optional)</span>
              </div>
            )}
            {!noHomework && !notCompleted && (optimisticHwDone !== null ? optimisticHwDone : student.hwDone) === true && (
              <form onSubmit={handleHomeworkDegreeFormSubmit} className="quiz-row">
                <div className="quiz-inputs-container">
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="manual-input quiz-input"
                    placeholder={
                      (!selectedWeek || !attendanceCenter) ? "Select week and center first..." 
                      : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? "Must attend first..."
                      : "degree ..."
                    }
                    value={homeworkDegree}
                    onChange={e => setHomeworkDegree(e.target.value)}
                    disabled={updateHomeworkDegreeMutation.isPending || !selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated'}
                    style={{
                      opacity: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                      cursor: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'text'
                    }}
                  />
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="manual-input quiz-input"
                    placeholder={
                      (!selectedWeek || !attendanceCenter) ? "Select week and center first..." 
                      : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? "Must attend first..."
                      : "out of ..."
                    }
                    value={homeworkDegreeOutOf}
                    onChange={e => {
                      const value = e.target.value;
                      setHomeworkDegreeOutOf(value);
                      // Save to session storage if value is not empty, otherwise remove it
                      if (value.trim() !== '') {
                        sessionStorage.setItem('lastHomeworkOutOf', value);
                        console.log('Homework out of saved to session storage:', value);
                      } else {
                        sessionStorage.removeItem('lastHomeworkOutOf');
                        console.log('Homework out of removed from session storage');
                      }
                    }}
                    disabled={updateHomeworkDegreeMutation.isPending || !selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated'}
                    style={{
                      opacity: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                      cursor: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'text'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  className="fetch-btn quiz-btn"
                  disabled={updateHomeworkDegreeMutation.isPending || (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated') || ((homeworkDegree === "" && homeworkDegreeOutOf !== "") || (homeworkDegree !== "" && homeworkDegreeOutOf === ""))}
                  style={{
                    opacity: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || ((homeworkDegree === "" && homeworkDegreeOutOf !== "") || (homeworkDegree !== "" && homeworkDegreeOutOf === ""))) ? 0.5 : 1,
                    cursor: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || ((homeworkDegree === "" && homeworkDegreeOutOf !== "") || (homeworkDegree !== "" && homeworkDegreeOutOf === ""))) ? 'not-allowed' : 'pointer',
                    transition: 'all 0.3s ease'
                  }}
                  title={
                    !selectedWeek ? 'Please select a week first' 
                    : !attendanceCenter ? 'Please select an attendance center first' 
                    : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? 'Student must attend first'
                    : ((homeworkDegree === "" && homeworkDegreeOutOf !== "") || (homeworkDegree !== "" && homeworkDegreeOutOf === "")) ? 'Please fill both fields or leave both empty' 
                    : ''
                  }
                >
                  {updateHomeworkDegreeMutation.isPending ? 'Saving...' : 'Save H.W Degree'}
                </button>
              </form>
            )}

            

          </div>

          {/* Quiz degree input section */}
          <div
            className="info-label"
            style={{
              marginBottom: 6,
              marginTop: 15,
              textAlign: 'start',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 12,
              flexWrap: 'wrap',
              rowGap: 6,
              columnGap: 12,
            }}
          >
            <span>Quiz Degree :</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500, cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={notQuized}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  setNotQuized(checked);
                  if (checked && noQuiz) {
                    // make them mutually exclusive
                    setNoQuiz(false);
                  }
                  if (checked) {
                    // Validate prerequisites
                    if (!student || !selectedWeek || !attendanceCenter) {
                      setError('Please select student, week and center first.');
                      setNotQuized(false);
                      return;
                    }

                    if (rawStudent?.account_state === 'Deactivated') {
                      setError('Cannot update quiz for deactivated student.');
                      setNotQuized(false);
                      return;
                    }
                    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
                    if (!currentAttended) {
                      setError('Student must be marked as attended before quiz degree can be entered.');
                      setNotQuized(false);
                      return;
                    }
                    // Submit "didn't attend the quiz"
                    const weekNumber = getWeekNumber(selectedWeek);
                    updateQuizGradeMutation.mutate(
                      {
                        id: student.id,
                        quizData: { quizDegree: "Didn't Attend The Quiz", week: weekNumber }
                      },
                      {
                        onSuccess: async () => {
                          setQuizSuccess('✅ Quiz Degree set successfully');
                          setQuizDegreeInput('');
                          setQuizDegreeOutOf('');
                          
                          // Calculate score for quiz ("Didn't Attend The Quiz" = 0% = -25 points, with previous percentage to reverse points)
                          try {
                            // Get previous quiz degree percentage
                            let previousPercentage = null;
                            const currentQuizDegree = student?.quizDegree ?? null;
                            if (currentQuizDegree && typeof currentQuizDegree === 'string' && currentQuizDegree !== "No Quiz") {
                              if (currentQuizDegree === "Didn't Attend The Quiz") {
                                previousPercentage = 0; // 0% for "Didn't Attend The Quiz"
                              } else {
                                const prevMatch = String(currentQuizDegree).trim().match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
                                if (prevMatch) {
                                  const prevObtained = parseFloat(prevMatch[1]);
                                  const prevTotal = parseFloat(prevMatch[2]);
                                  previousPercentage = prevTotal > 0 ? Math.round((prevObtained / prevTotal) * 100) : null;
                                }
                              }
                            }
                            
                            // "Didn't Attend The Quiz" is treated as 0% (-25 points)
                            await apiClient.post('/api/scoring/calculate', {
                              studentId: student.id,
                              type: 'quiz',
                              week: weekNumber,
                              data: { percentage: 0, previousPercentage }
                            });
                            // Refetch student data to update score
                            if (refetchStudent) {
                              refetchStudent();
                            }
                          } catch (err) {
                            console.error('Error calculating quiz score:', err);
                          }
                        }
                      }
                    );
                  } else {
                    // Unchecked: reset quiz degree to null and reverse the "Didn't Attend The Quiz" points
                    // Validate prerequisites
                    if (!student || !selectedWeek || !attendanceCenter) {
                      setError('Please select student, week and center first.');
                      return;
                    }
                    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
                    if (!currentAttended) {
                      setError('Student must be marked as attended before quiz degree can be updated.');
                      return;
                    }
                    const weekNumber = getWeekNumber(selectedWeek);
                    
                    // Get previous state from history
                    let previousPercentage = 0; // Default to 0% for "Didn't Attend The Quiz"
                    let shouldReverse = false;
                    try {
                      const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                        studentId: student.id,
                        type: 'quiz',
                        week: weekNumber
                      });
                      
                      if (historyResponse.data.found && historyResponse.data.history) {
                        const lastHistory = historyResponse.data.history;
                        if (lastHistory.data?.percentage !== undefined) {
                          previousPercentage = lastHistory.data.percentage;
                          // If the last history was for 0% (Didn't Attend The Quiz), we should reverse it
                          if (previousPercentage === 0) {
                            shouldReverse = true;
                          }
                        }
                      } else {
                        // If no history found, check if current quiz degree is "Didn't Attend The Quiz"
                        if (student?.quizDegree === "Didn't Attend The Quiz") {
                          shouldReverse = true;
                        }
                      }
                    } catch (historyErr) {
                      console.error('Error getting quiz history for reverse:', historyErr);
                      // Fallback: if current quiz degree is "Didn't Attend The Quiz", reverse it
                      if (student?.quizDegree === "Didn't Attend The Quiz") {
                        shouldReverse = true;
                      }
                    }
                    
                    updateQuizGradeMutation.mutate(
                      {
                        id: student.id,
                        quizData: { quizDegree: null, week: weekNumber }
                      },
                      {
                        onSuccess: async () => {
                          setQuizSuccess('✅ Quiz Degree reset');
                          
                          // Reverse the "Didn't Attend The Quiz" points
                          if (shouldReverse && isScoringEnabled) {
                            try {
                              await apiClient.post('/api/scoring/calculate', {
                                studentId: student.id,
                                type: 'quiz',
                                week: weekNumber,
                                data: { 
                                  percentage: 0,
                                  previousPercentage: previousPercentage,
                                  reverseOnly: true
                                }
                              });
                              // Refetch student data to update score
                              if (refetchStudent) {
                                refetchStudent();
                              }
                            } catch (err) {
                              console.error('Error reversing quiz score:', err);
                            }
                          }
                        }
                      }
                    );
                  }
                }}
              />
              <span>didn't attend the quiz</span>
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={noQuiz}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setNoQuiz(checked);
                  if (checked && notQuized) {
                    // make them mutually exclusive
                    setNotQuized(false);
                  }
                  if (checked) {
                    // Validate prerequisites
                    if (!student || !selectedWeek || !attendanceCenter) {
                      setError('Please select student, week and center first.');
                      setNoQuiz(false);
                      return;
                    }

                    if (rawStudent?.account_state === 'Deactivated') {
                      setError('Cannot update quiz for deactivated student.');
                      setNoQuiz(false);
                      return;
                    }
                    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
                    if (!currentAttended) {
                      setError('Student must be marked as attended before quiz degree can be entered.');
                      setNoQuiz(false);
                      return;
                    }
                    const weekNumber = getWeekNumber(selectedWeek);
                    updateQuizGradeMutation.mutate(
                      {
                        id: student.id,
                        quizData: { quizDegree: 'No Quiz', week: weekNumber }
                      },
                      {
                        onSuccess: async () => {
                          setQuizSuccess('✅ Quiz Degree set successfully');
                          setQuizDegreeInput('');
                          setQuizDegreeOutOf('');
                          
                          // "No Quiz" doesn't affect score - no scoring call needed
                        }
                      }
                    );
                  } else {
                    // Unchecked: reset to null
                    if (!student || !selectedWeek || !attendanceCenter) {
                      setError('Please select student, week and center first.');
                      return;
                    }
                    const currentAttended = optimisticAttended !== null ? optimisticAttended : student.attended_the_session;
                    if (!currentAttended) {
                      setError('Student must be marked as attended before quiz degree can be updated.');
                      return;
                    }
                    const weekNumber = getWeekNumber(selectedWeek);
                    updateQuizGradeMutation.mutate(
                      {
                        id: student.id,
                        quizData: { quizDegree: null, week: weekNumber }
                      },
                      {
                        onSuccess: () => {
                          setQuizSuccess('✅ Quiz Degree set successfully');
                        }
                      }
                    );
                  }
                }}
              />
              <span>No Quiz</span>
            </label>
          </div>
          {!(notQuized || noQuiz) && (
          <form onSubmit={handleQuizFormSubmit} className="quiz-row">
            <div className="quiz-inputs-container">
            <input
              type="number"
              step="any"
              min="0"
              className="manual-input quiz-input"
              placeholder={
                (!selectedWeek || !attendanceCenter) ? "Select week and center first..." 
                : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? "Must attend first..."
                : "degree ..."
              }
              value={quizDegreeInput}
              onChange={e => setQuizDegreeInput(e.target.value)}
              disabled={updateQuizGradeMutation.isPending || !selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated'}
              style={{
                opacity: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                cursor: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'text'
              }}
            />
            <input
              type="number"
              step="any"
              min="0"
              className="manual-input quiz-input"
              placeholder={
                (!selectedWeek || !attendanceCenter) ? "Select week and center first..." 
                : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? "Must attend first..."
                : "out of ..."
              }
              value={quizDegreeOutOf}
              onChange={e => {
                const value = e.target.value;
                setQuizDegreeOutOf(value);
                // Save to session storage if value is not empty, otherwise remove it
                if (value.trim() !== '') {
                  sessionStorage.setItem('lastQuizOutOf', value);
                  console.log('Quiz out of saved to session storage:', value);
                } else {
                  sessionStorage.removeItem('lastQuizOutOf');
                  console.log('Quiz out of removed from session storage');
                }
              }}
              disabled={updateQuizGradeMutation.isPending || !selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated'}
              style={{
                opacity: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                cursor: (!selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'text'
              }}
            />
            </div>
            <button
              type="submit"
              className="fetch-btn quiz-btn"
              disabled={updateQuizGradeMutation.isPending || quizDegreeInput === "" || quizDegreeOutOf === "" || !selectedWeek || !attendanceCenter || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) || rawStudent?.account_state === 'Deactivated'}
              style={{
                opacity: (!selectedWeek || !attendanceCenter || quizDegreeInput === "" || quizDegreeOutOf === "" || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 0.5 : 1,
                cursor: (!selectedWeek || !attendanceCenter || quizDegreeInput === "" || quizDegreeOutOf === "" || !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session)) ? 'not-allowed' : 'pointer',
                transition: 'all 0.3s ease'
              }}
              title={
                !selectedWeek ? 'Please select a week first' 
                : !attendanceCenter ? 'Please select an attendance center first' 
                : !(optimisticAttended !== null ? optimisticAttended : student.attended_the_session) ? 'Student must attend first'
                : (quizDegreeInput === "" || quizDegreeOutOf === "") ? 'Please fill both fields' 
                : ''
              }
            >
              {updateQuizGradeMutation.isPending ? 'Saving...' : 'Save Quiz Degree'}
            </button>
          </form>
          )}
          {/* quiz success shown below the student card */}

          {/* Weekly Comment */}
          <div className="info-label" style={{ marginBottom: 6, marginTop: 10, textAlign: 'start', fontWeight: 600 }}>
            Comment (optional)
          </div>
          <div className="quiz-row" style={{ alignItems: 'stretch' }}>
            <textarea
              className="manual-input"
              placeholder={(!selectedWeek || !attendanceCenter) ? "Select week and center first..." : "Write a comment for this student"}
              value={weekComment}
              onChange={(e) => setWeekComment(e.target.value)}
              disabled={!selectedWeek || !attendanceCenter}
              rows={3}
              style={{ width: '100%', resize: 'vertical', opacity: (!selectedWeek || !attendanceCenter) ? 0.5 : 1, cursor: (!selectedWeek || !attendanceCenter) ? 'not-allowed' : 'text' }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button
              className="fetch-btn"
              onClick={() => {
                if (!student || !selectedWeek || !attendanceCenter) return;
                const weekNumber = getWeekNumber(selectedWeek);
                updateWeekCommentMutation.mutate(
                  { id: student.id, comment: weekComment, week: weekNumber },
                  {
                    onSuccess: () => {
                      setCommentSuccess('✅ Comment set successfully');
                    }
                  }
                );
              }}
              disabled={!student || !selectedWeek || !attendanceCenter || updateWeekCommentMutation.isPending || rawStudent?.account_state === 'Deactivated'}
              style={{ opacity: (!student || !selectedWeek || !attendanceCenter) ? 0.5 : 1 }}
            >
              {updateWeekCommentMutation.isPending ? 'Saving...' : 'Save Comment'}
            </button>
          </div>
          
          {/* Create QR Code Button - inside student card */}
          <div style={{ marginTop: '16px' }}>
            <button 
              className="submit-btn qr-code-btn" 
              onClick={() => {
                if (student.id) {
                  router.push(`/dashboard/qr_generator?mode=single&id=${student.id}`);
                }
              }}
              style={{
                background: 'linear-gradient(135deg, #17a2b8 0%, #20c997 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: '1rem',
                padding: '14px 20px',
                cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(23, 162, 184, 0.3)',
                width: '100%',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px'
              }}
            >
              <Image src="/qrcode.svg" alt="QR Code" width={20} height={20} />
              Create QR Code for this student • ID: {student.id}
            </button>
          </div>
          {/* comment success shown below the student card */}
        </div>
      )}


      {/* Success messages displayed right after the student card */}
      {student && selectedWeek && attendanceCenter && (quizSuccess || commentSuccess || hwSuccess || attendanceSuccess || homeworkDegreeSuccess) && (
        <div style={{ maxWidth: 600, margin: '12px auto 0 auto' }}>
          {quizSuccess && (
            <div className="success-message">
              {quizSuccess}
            </div>
          )}
          {commentSuccess && (
            <div className="success-message" style={{ marginTop: 10 }}>
              {commentSuccess}
            </div>
          )}
          {hwSuccess && (
            <div className="success-message" style={{ marginTop: 10 }}>
              {hwSuccess}
            </div>
          )}
          {homeworkDegreeSuccess && (
            <div className="success-message" style={{ marginTop: 10 }}>
              {homeworkDegreeSuccess}
            </div>
          )}
          {attendanceSuccess && (
            <div className="success-message" style={{ marginTop: 10 }}>
              {attendanceSuccess}
            </div>
          )}
        </div>
      )}


      {/* Error message now appears below the student card */}
      {console.log('🔍 Error message condition check:', {
        hasStudent: !!student,
        accountState: rawStudent?.account_state,
        isDeactivated: rawStudent?.account_state === 'Deactivated',
        hasError: !!error,
        errorValue: error,
        shouldShowError: student && rawStudent?.account_state === 'Deactivated' && error
      })}
      {error && (
        <div className="error-message">
          {console.log('🚨 Error message displaying:', {
            studentName: student?.name,
            accountState: rawStudent?.account_state,
            errorMessage: error,
            showError: true
          })}
          ❌ {error}
        </div>
      )}
      </div>
    </div>
  );
}