import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from '../../../components/Title';
import { useStudents, useStudent } from '../../../lib/api/students';
import { useQuery, useMutation } from '@tanstack/react-query';
import apiClient from '../../../lib/axios';

export default function ChangeStudentAccountPassword() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [searchId, setSearchId] = useState("");
  const [searchError, setSearchError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [stateMessageVisible, setStateMessageVisible] = useState(true);
  const searchErrorTimeoutRef = useRef(null);
  const passwordErrorTimeoutRef = useRef(null);
  const passwordSuccessTimeoutRef = useRef(null);

  // Get all students for name-based search
  const { data: allStudents } = useStudents();

  // Get student data
  const { data: student, isLoading: studentLoading, error: studentError } = useStudent(searchId, {
    enabled: !!searchId,
    retry: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchOnMount: false,
  });

  // Get user account data
  const { data: userAccount, isLoading: accountLoading, error: accountError } = useQuery({
    queryKey: ['student-account', searchId],
    queryFn: async () => {
      if (!searchId) return null;
      try {
        const response = await apiClient.get(`/api/auth/students/${searchId}/account`);
        return response.data;
      } catch (err) {
        if (err.response?.status === 404) {
          return null; // Account doesn't exist
        }
        throw err;
      }
    },
    enabled: !!searchId && !!student,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  // Update password mutation
  const updatePasswordMutation = useMutation({
    mutationFn: async ({ id, password }) => {
      const response = await apiClient.put(`/api/auth/students/${id}/password`, { password });
      return response.data;
    },
    onSuccess: () => {
      setPasswordSuccess("✅ Password updated successfully!");
      setPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSuccess(""), 6000);
    },
    onError: (err) => {
      const errorMsg = err.response?.data?.error || "Failed to update password";
      setPasswordError(errorMsg.startsWith("❌") ? errorMsg : `❌${errorMsg}`);
      setTimeout(() => setPasswordError(""), 6000);
    },
  });

  useEffect(() => {
    // Clear any existing timeout
    if (searchErrorTimeoutRef.current) {
      clearTimeout(searchErrorTimeoutRef.current);
      searchErrorTimeoutRef.current = null;
    }

    if (searchError) {
      searchErrorTimeoutRef.current = setTimeout(() => {
        setSearchError("");
        searchErrorTimeoutRef.current = null;
      }, 6000);
    }

    return () => {
      if (searchErrorTimeoutRef.current) {
        clearTimeout(searchErrorTimeoutRef.current);
        searchErrorTimeoutRef.current = null;
      }
    };
  }, [searchError]);

  useEffect(() => {
    // Clear any existing timeout
    if (passwordErrorTimeoutRef.current) {
      clearTimeout(passwordErrorTimeoutRef.current);
      passwordErrorTimeoutRef.current = null;
    }

    if (passwordError) {
      passwordErrorTimeoutRef.current = setTimeout(() => {
        setPasswordError("");
        passwordErrorTimeoutRef.current = null;
      }, 6000);
    }

    return () => {
      if (passwordErrorTimeoutRef.current) {
        clearTimeout(passwordErrorTimeoutRef.current);
        passwordErrorTimeoutRef.current = null;
      }
    };
  }, [passwordError]);

  useEffect(() => {
    // Clear any existing timeout
    if (passwordSuccessTimeoutRef.current) {
      clearTimeout(passwordSuccessTimeoutRef.current);
      passwordSuccessTimeoutRef.current = null;
    }

    if (passwordSuccess) {
      passwordSuccessTimeoutRef.current = setTimeout(() => {
        setPasswordSuccess("");
        passwordSuccessTimeoutRef.current = null;
      }, 6000);
    }

    return () => {
      if (passwordSuccessTimeoutRef.current) {
        clearTimeout(passwordSuccessTimeoutRef.current);
        passwordSuccessTimeoutRef.current = null;
      }
    };
  }, [passwordSuccess]);

  const handleIdSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;

    // Clear any existing timeout and error
    if (searchErrorTimeoutRef.current) {
      clearTimeout(searchErrorTimeoutRef.current);
      searchErrorTimeoutRef.current = null;
    }
    setSearchError("");
    setSearchResults([]);
    setShowSearchResults(false);
    setPassword("");
    setConfirmPassword("");
    setStateMessageVisible(true);

    const searchTerm = studentId.trim();

    // Check if it's a numeric ID
    if (/^\d+$/.test(searchTerm)) {
      setSearchId(searchTerm);
    } else {
      // It's a name, search through all students
      if (allStudents) {
        const matchingStudents = allStudents.filter(s =>
          s.name.toLowerCase().includes(searchTerm.toLowerCase())
        );

        if (matchingStudents.length === 1) {
          setSearchId(matchingStudents[0].id.toString());
          setStudentId(matchingStudents[0].id.toString());
        } else if (matchingStudents.length > 1) {
          setSearchResults(matchingStudents);
          setShowSearchResults(true);
          setSearchError(`❌ Found ${matchingStudents.length} students. Please select one.`);
        } else {
          setSearchError(`❌ No student found with name starting with "${searchTerm}"`);
          setSearchId("");
        }
      } else {
        setSearchError("❌ Student data not loaded. Please try again.");
      }
    }
  };

  const handleIdChange = (e) => {
    const value = e.target.value;
    setStudentId(value);
    setSearchId("");
    if (!value.trim()) {
      // Clear any existing timeout and error
      if (searchErrorTimeoutRef.current) {
        clearTimeout(searchErrorTimeoutRef.current);
        searchErrorTimeoutRef.current = null;
      }
      setSearchError("");
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleStudentSelect = (selectedStudent) => {
    setSearchId(selectedStudent.id.toString());
    setStudentId(selectedStudent.id.toString());
    setSearchResults([]);
    setShowSearchResults(false);
    setSearchError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!password || !confirmPassword) {
      setPasswordError("❌ All fields are required");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("❌ Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setPasswordError("❌ Password must be at least 8 characters long");
      return;
    }

    updatePasswordMutation.mutate({ id: searchId, password });
  };

  // Determine the state and message
  const getStateMessage = () => {
    if (!searchId) return null;

    if (studentLoading || accountLoading) {
      return { type: 'loading', message: 'Loading...' };
    }

    // Check if student exists in students collection
    const studentExists = student && !studentError;
    // Check if account exists in users collection
    const accountExists = userAccount && !accountError;

    // Case 1: Student not found in students collection
    if (!studentExists) {
      // If account also doesn't exist, show "Student not found"
      if (!accountExists) {
        return { type: 'error', message: '❌ Student not found' };
      }
      // This shouldn't happen normally, but handle it
      return { type: 'error', message: '❌ Student not found' };
    }

    // Case 2: Student exists but account doesn't exist
    if (studentExists && !accountExists) {
      return { type: 'error', message: '❌ There is no account yet for this student, student must be registered first' };
    }

    // Case 3: Both exist, check account_state from students collection
    if (studentExists && accountExists) {
      if (student.account_state === 'Deactivated') {
        return { type: 'error', message: '❌ Sorry, this account is deactivated' };
      }
      // Case 4: All good - show form
      return { type: 'success', message: null };
    }

    // Default fallback
    return null;
  };

  const stateMessage = getStateMessage();
  const canShowForm = stateMessage?.type === 'success' && student && userAccount;

  // Auto-hide state message after 6 seconds
  useEffect(() => {
    if (stateMessage && stateMessage.type !== 'success' && stateMessage.message) {
      setStateMessageVisible(true);
      const timer = setTimeout(() => setStateMessageVisible(false), 6000);
      return () => clearTimeout(timer);
    } else {
      setStateMessageVisible(true);
    }
  }, [stateMessage]);

  return (
    <div className="page-wrapper" style={{ padding: "20px 5px 20px 5px" }}>
      <div className="main-container" style={{ maxWidth: 800, margin: "40px auto", padding: "25px" }}>
        <style jsx>{`
          .page-wrapper {
            padding: 20px 5px 20px 5px;
          }
          .main-container {
            max-width: 1000px;
            margin: 40px auto;
            padding: 24px;
            width: 100%;
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
          }
          .fetch-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }
          .form-container {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            margin-bottom: 20px;
          }
          .info-container {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            margin-bottom: 20px;
          }
          .student-details {
            display: grid;
            grid-template-columns: 1fr 1fr;
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
          .form-group {
            margin-bottom: 20px;
          }
          .form-label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #495057;
            font-size: 0.95rem;
          }
          .form-input {
            width: 100%;
            padding: 14px 16px;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            font-size: 1rem;
            transition: all 0.3s ease;
            background: #ffffff;
            color: #000000;
            box-sizing: border-box;
          }
          .form-input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          .input-wrapper {
            position: relative;
          }
          .password-toggle {
            position: absolute;
            right: 12px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            cursor: pointer;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .signup-btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 1.1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 8px 24px rgba(40, 167, 69, 0.3);
          }
          .signup-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 32px rgba(40, 167, 69, 0.4);
            background: linear-gradient(90deg, #218838 0%, #1aa179 100%);
          }
          .signup-btn:active {
            transform: translateY(-1px);
          }
          .signup-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }
          @media (max-width: 768px) {
            .page-wrapper {
              padding: 15px 10px 15px 10px;
            }
            .main-container {
              padding: 20px;
              margin: 20px auto;
            }
            .fetch-form {
              flex-direction: column;
              gap: 12px;
            }
            .fetch-btn {
              width: 100%;
              padding: 14px 20px;
              font-size: 0.95rem;
              min-width: auto;
            }
            .fetch-input {
              width: 100%;
              font-size: 0.95rem;
              padding: 12px 14px;
            }
            .form-container, .info-container {
              padding: 20px;
            }
            .student-details {
              grid-template-columns: 1fr;
              gap: 12px;
            }
            .detail-item {
              padding: 16px;
            }
            .error-message, .success-message {
              padding: 14px;
              font-size: 0.95rem;
              margin-top: 12px;
            }
            .form-input {
              padding: 12px 14px;
              font-size: 0.95rem;
            }
            .form-label {
              font-size: 0.9rem;
            }
            .signup-btn {
              padding: 14px;
              font-size: 1rem;
            }
            .search-results-container {
              padding: 14px;
            }
            .search-results-title {
              font-size: 0.95rem;
            }
            .search-result-item {
              padding: 10px 14px !important;
            }
            .search-result-item div:first-child {
              font-size: 0.95rem;
            }
            .search-result-item div:last-child {
              font-size: 0.85rem;
            }
          }
          @media (max-width: 480px) {
            .page-wrapper {
              padding: 10px 8px 10px 8px;
            }
            .main-container {
              padding: 16px;
              margin: 15px auto;
            }
            .form-container, .info-container {
              padding: 16px;
              margin-bottom: 16px;
            }
            .fetch-form {
              gap: 10px;
              margin-bottom: 20px;
            }
            .fetch-btn {
              padding: 12px 16px;
              font-size: 0.9rem;
            }
            .fetch-input {
              padding: 12px;
              font-size: 0.9rem;
            }
            .student-details {
              gap: 10px;
              margin-bottom: 20px;
            }
            .detail-item {
              padding: 12px;
              border-radius: 10px;
            }
            .detail-label {
              font-size: 0.8rem;
              margin-bottom: 6px;
            }
            .detail-value {
              font-size: 0.95rem;
            }
            .error-message, .success-message {
              padding: 12px;
              font-size: 0.9rem;
              margin-top: 10px;
              border-radius: 8px;
            }
            .form-group {
              margin-bottom: 16px;
            }
            .form-label {
              font-size: 0.85rem;
              margin-bottom: 6px;
            }
            .form-input {
              padding: 12px 40px 12px 12px;
              font-size: 0.9rem;
            }
            .password-toggle {
              right: 10px;
              width: 20px;
              height: 20px;
            }
            .password-toggle img {
              width: 18px !important;
              height: 18px !important;
            }
            .signup-btn {
              padding: 14px;
              font-size: 0.95rem;
            }
            small {
              font-size: 0.8rem;
            }
            .search-results-container {
              padding: 12px;
            }
            .search-results-title {
              font-size: 0.9rem;
              margin-bottom: 10px;
            }
            .search-result-item {
              padding: 10px 12px !important;
              margin: 6px 0 !important;
            }
            .search-result-item div:first-child {
              font-size: 0.9rem;
            }
            .search-result-item div:last-child {
              font-size: 0.8rem;
            }
          }
          @media (max-width: 360px) {
            .page-wrapper {
              padding: 8px 5px 8px 5px;
            }
            .main-container {
              padding: 12px;
              margin: 10px auto;
            }
            .form-container, .info-container {
              padding: 12px;
            }
            .fetch-btn {
              padding: 10px 14px;
              font-size: 0.85rem;
            }
            .fetch-input {
              padding: 10px;
              font-size: 0.85rem;
            }
            .detail-item {
              padding: 10px;
            }
            .detail-label {
              font-size: 0.75rem;
            }
            .detail-value {
              font-size: 0.9rem;
            }
            .form-input {
              padding: 10px 36px 10px 10px;
              font-size: 0.85rem;
            }
            .signup-btn {
              padding: 12px;
              font-size: 0.9rem;
            }
            .search-results-container {
              padding: 10px;
            }
            .search-results-title {
              font-size: 0.85rem;
            }
            .search-result-item {
              padding: 8px 10px !important;
              margin: 5px 0 !important;
            }
            .search-result-item div:first-child {
              font-size: 0.85rem;
            }
            .search-result-item div:last-child {
              font-size: 0.75rem;
            }
          }
        `}</style>

        <Title backText="Back" href="/dashboard/manage_online_system">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/key.svg" alt="Change Password" width={32} height={32} />
            Change Student Account Password
          </div>
        </Title>

        <div className="form-container">
          <form onSubmit={handleIdSubmit} className="fetch-form">
            <input
              className="fetch-input"
              type="text"
              placeholder="Enter student ID or Name"
              value={studentId}
              onChange={handleIdChange}
              required
            />
            <button type="submit" className="fetch-btn" disabled={studentLoading || accountLoading}>
              {studentLoading || accountLoading ? "Loading..." : "🔍 Search"}
            </button>
          </form>

          {/* Show search results if multiple matches found */}
          {showSearchResults && searchResults.length > 0 && (
            <div className="search-results-container" style={{
              marginTop: "16px",
              padding: "16px",
              background: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #dee2e6"
            }}>
              <div className="search-results-title" style={{
                marginBottom: "12px",
                fontWeight: "600",
                color: "#495057"
              }}>
                Select a student:
              </div>
              {searchResults.map((s) => (
                <button
                  key={s.id}
                  className="search-result-item"
                  onClick={() => handleStudentSelect(s)}
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
                    {s.name} (ID: {s.id})
                  </div>
                  <div style={{ fontSize: "0.9rem", color: "#6c757d" }}>
                    {s.grade} • {s.main_center}
                  </div>
                </button>
              ))}
            </div>
          )}

        </div>

        {/* Search-related messages - outside container, under search input */}
        {searchError && (
          <div className="error-message" style={{ marginTop: '16px' }}>
            {searchError}
          </div>
        )}

        {/* Show state message - outside container */}
        {stateMessage && stateMessage.type !== 'success' && stateMessage.message && stateMessageVisible && (
          <div className="error-message" style={{ marginTop: '16px' }}>
            {stateMessage.message}
          </div>
        )}

        {/* Show student info and password form */}
        {canShowForm && (
          <>
            <div className="info-container">
              <div className="student-details">
                <div className="detail-item">
                  <div className="detail-label">Full Name</div>
                  <div className="detail-value">{student.name}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Grade</div>
                  <div className="detail-value">{student.grade}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Student Phone</div>
                  <div className="detail-value" style={{ fontFamily: 'monospace' }}>{student.phone}</div>
                </div>
                <div className="detail-item">
                  <div className="detail-label">Parent's Phone</div>
                  <div className="detail-value" style={{ fontFamily: 'monospace' }}>{student.parents_phone}</div>
                </div>
              </div>
            </div>

            <div className="form-container">
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <div className="input-wrapper">
                    <input
                      className="form-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ paddingRight: '50px' }}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <img
                        src={showPassword ? "/hide.svg" : "/show.svg"}
                        alt={showPassword ? "Hide password" : "Show password"}
                        style={{ width: '20px', height: '20px' }}
                      />
                    </button>
                  </div>
                  <small style={{ color: '#6c757d', fontSize: '0.85rem' }}>
                    Must be at least 8 characters long
                  </small>
                </div>

                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <div className="input-wrapper">
                    <input
                      className="form-input"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{ paddingRight: '50px' }}
                      required
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      <img
                        src={showConfirmPassword ? "/hide.svg" : "/show.svg"}
                        alt={showConfirmPassword ? "Hide password" : "Show password"}
                        style={{ width: '20px', height: '20px' }}
                      />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="signup-btn"
                  disabled={updatePasswordMutation.isPending || !password || !confirmPassword}
                >
                  {updatePasswordMutation.isPending ? "Updating Password..." : "Save Password"}
                </button>
              </form>

              {/* Password-related messages - outside container, under password form */}
              {passwordError && (
                <div className="error-message" style={{ marginTop: '16px' }}>
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="success-message" style={{ marginTop: '16px' }}>
                  {passwordSuccess}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

