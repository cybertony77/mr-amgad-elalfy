import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from '../../../components/Title';
import { useStudents, useStudent } from '../../../lib/api/students';
import apiClient from '../../../lib/axios';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';

export default function DeleteStudentAccount() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [studentId, setStudentId] = useState("");
  const [searchId, setSearchId] = useState(""); // Separate state for search
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchResults, setSearchResults] = useState([]); // Store multiple search results
  const [showSearchResults, setShowSearchResults] = useState(false); // Show/hide search results

  // React Query hooks
  const { data: allStudents } = useStudents();
  const { data: student, isLoading: studentLoading, error: studentError } = useStudent(searchId, { enabled: !!searchId });

  // Get user account data to check if account exists
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
  });

  // Mutation for deleting student account
  const deleteStudentAccountMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiClient.delete(`/api/auth/students/${id}/delete-account`);
      return response.data;
    },
    onSuccess: () => {
      setDeleted(true);
      setShowConfirm(false);
      // Invalidate any relevant queries
      queryClient.invalidateQueries({ queryKey: ['students'] });
    },
    onError: (err) => {
      setError(err.response?.data?.error || "Error deleting student account. Please try again.");
    },
  });

  useEffect(() => {
    // Authentication is now handled by _app.js with HTTP-only cookies
    // This component will only render if user is authenticated
  }, [router]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Handle student errors from React Query
  useEffect(() => {
    if (studentError) {
      setError("Student with this ID does not exist");
    }
  }, [studentError]);

  // Check if student exists but account doesn't exist
  useEffect(() => {
    // Only check after account query has completed (not loading and has been executed)
    if (student && !accountLoading && searchId) {
      if (userAccount === null && !accountError) {
        // Student exists in students collection but account doesn't exist in users collection
        setError("There is no account yet for this student, student must be registered first");
      }
      // Note: Error is cleared at the start of checkStudent, so we don't need to clear it here
    }
  }, [student, userAccount, accountLoading, accountError, searchId]);

  const handleIdSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;

    setError("");
    setSearchResults([]);
    setShowSearchResults(false);
    
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
          setError(`❌ Found ${matchingStudents.length} students. Please select one.`);
        } else {
          setError(`❌ No student found with name starting with "${searchTerm}"`);
          setSearchId("");
        }
      } else {
        setError("❌ Student data not loaded. Please try again.");
      }
    }
  };

  const deleteStudentAccount = async () => {
    if (!student) return;

    setError("");
    deleteStudentAccountMutation.mutate(searchId);
  };

  const handleIdChange = (e) => {
    const value = e.target.value;
    setStudentId(value);
    setSearchId("");
    if (!value.trim()) {
      setError("");
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const resetForm = () => {
    setStudentId("");
    setSearchId(""); // Clear search ID to reset the query
    setError("");
    setDeleted(false);
    setSearchResults([]);
    setShowSearchResults(false);
  };

  // Handle student selection from search results
  const handleStudentSelect = (selectedStudent) => {
    setSearchId(selectedStudent.id.toString());
    setStudentId(selectedStudent.id.toString());
    setSearchResults([]);
    setShowSearchResults(false);
    setError("");
  };

  return (
    <div style={{ padding: "20px 5px 20px 5px" }}>
      <div style={{ maxWidth: 800, margin: "40px auto", padding: "25px" }}>
        <style jsx>{`
          .title {
            font-size: 2rem;
            font-weight: 700;
            color: #ffffff;
            text-align: center;
            margin-bottom: 32px;
          }
          .form-container {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
          }
          .form-group {
            margin-bottom: 24px;
          }
          .form-group label {
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
            box-sizing: border-box;
            background: #ffffff;
            color: #000000;
          }
          .form-input:focus {
            outline: none;
            border-color: #667eea;
            background: white;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          .form-input::placeholder {
            color: #adb5bd;
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
          .submit-btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(135, 206, 235, 0.3);
            margin-top: 8px;
          }
          .submit-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(135, 206, 235, 0.4);
          }
          .submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }
          .success-message {
            background: #d1fae5;
            color: #166534;
            border-radius: 10px;
            padding: 16px;
            margin-top: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(40, 167, 69, 0.08);
            border: 1.5px solid #6ee7b7;
            font-size: 1.1rem;
          }
          .error-message {
            background: #fee2e2;
            color: #991b1b;
            border-radius: 10px;
            padding: 16px;
            margin-top: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(220, 53, 69, 0.08);
            border: 1.5px solid #fca5a5;
            font-size: 1.1rem;
          }
          .student-info {
            background: #f8f9fa;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            padding: 16px;
            margin: 16px 0;
          }
          .student-info h3 {
            margin: 0 0 12px 0;
            color: #495057;
          }
          .student-info p {
            margin: 4px 0;
            color: #6c757d;
          }
          .confirm-modal {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }
          .confirm-content {
            background: #fff;
            border-radius: 12px;
            padding: 32px 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.15);
            max-width: 400px;
            width: calc(100% - 40px);
            text-align: center;
          }
          .confirm-buttons {
            display: flex;
            gap: 16px;
            margin-top: 24px;
            justify-content: center;
            flex-wrap: wrap;
          }
          .confirm-reset-btn {
            background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: background 0.2s;
            flex: 1;
            min-width: 140px;
          }
          .confirm-reset-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }
          .cancel-btn {
            background: #adb5bd;
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: background 0.2s;
            flex: 1;
            min-width: 140px;
          }
          @media (max-width: 768px) {
            .form-container {
              padding: 24px;
            }
            .form-group {
              margin-bottom: 20px;
            }
            .form-input, .fetch-input {
              padding: 14px 16px;
            }
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
            .confirm-content {
              padding: 24px 20px;
            }
            .confirm-buttons {
              flex-direction: column;
            }
            .confirm-reset-btn,
            .cancel-btn {
              width: 100%;
            }
          }
          @media (max-width: 480px) {
            .form-container {
              padding: 20px;
            }
            .form-group label {
              font-size: 0.9rem;
            }
            .form-input, .fetch-input {
              padding: 12px 14px;
              font-size: 0.95rem;
            }
            .submit-btn {
              padding: 14px;
              font-size: 1rem;
            }
            .confirm-content {
              padding: 20px 16px;
            }
          }
        `}</style>
        <Title backText="Back" href={"/dashboard/manage_online_system"}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/trash2.svg" alt="Delete Account" width={32} height={32} />
            Delete Student Account
          </div>
        </Title>
        {/* Only show the entire form container if not deleted */}
        {!deleted && (
          <div className="form-container">
            <form onSubmit={handleIdSubmit} className="fetch-form">
              <input
                className="fetch-input"
                type="text"
                placeholder="Enter student ID or Name"
                value={studentId}
                onChange={handleIdChange}
                disabled={studentLoading || accountLoading || deleteStudentAccountMutation.isPending}
                required
              />
              <button 
                type="submit"
                className="fetch-btn"
                disabled={studentLoading || accountLoading || deleteStudentAccountMutation.isPending}
              >
                {studentLoading || accountLoading ? "Loading..." : "🔍 Search"}
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
                      e.target.style.borderColor = "#dc3545";
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.background = "white";
                      e.target.style.borderColor = "#dee2e6";
                    }}
                  >
                    <div style={{ fontWeight: "600", color: "#dc3545" }}>
                      {student.name} (ID: {student.id})
                    </div>
                    <div style={{ fontSize: "0.9rem", color: "#6c757d" }}>
                      {student.grade} • {student.main_center}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="error-message">❌ {error}</div>
            )}

            {student && userAccount && (
              <div className="student-info">
                <h3>Student Found:</h3>
                <p><strong>Name:</strong> {student.name}</p>
                {student.age && <p><strong>Age:</strong> {student.age}</p>}
                <p><strong>Grade:</strong> {student.grade}</p>
                <p><strong>School:</strong> {student.school}</p>
                <p><strong>Phone:</strong> {student.phone}</p>
                <p><strong>Email:</strong> {userAccount?.email || "No Email"}</p>
                <p><strong>Parent's Phone:</strong> {student.parents_phone || student.parentsPhone}</p>
                <p><strong>Main Center:</strong> {student.main_center}</p>
                <p><strong>Main Comment:</strong> {student.main_comment || "No Comment"}</p>
                <div style={{ marginTop: "20px" }}>
                  <p style={{ color: "#dc3545", fontWeight: "bold", marginBottom: "16px" }}>
                    ⚠️ Are you sure you want to delete this student's account? This will delete their account and regenerate a new VAC code. This action cannot be undone.
                  </p>
                  <button 
                    className="submit-btn"
                    onClick={() => setShowConfirm(true)}
                    disabled={deleteStudentAccountMutation.isPending}
                  >
                    🗑️ Yes, Delete Account
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {showConfirm && (
          <div className="confirm-modal">
            <div className="confirm-content">
              <h3>Confirm Delete</h3>
              <p>Are you sure you want to delete the account for student <strong>{student?.name}</strong> (ID: {studentId})?</p>
              <p><strong>This action cannot be undone!</strong></p>
              <div className="confirm-buttons">
                <button
                  onClick={deleteStudentAccount}
                  disabled={deleteStudentAccountMutation.isPending}
                  className="confirm-reset-btn"
                >
                  {deleteStudentAccountMutation.isPending ? "Deleting..." : "Delete Account"}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={deleteStudentAccountMutation.isPending}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
        {deleted && (
          <div className="success-message" style={{ textAlign: "center", padding: "40px 20px" }}>
            <div style={{ fontSize: "4rem", marginBottom: "20px" }}>✅</div>
            <h2 style={{ color: "#28a745", marginBottom: "16px" }}>Student Account Deleted Successfully!</h2>
            <p style={{ color: "#6c757d", marginBottom: "24px" }}>
              Student account for ID <strong>{studentId}</strong> has been deleted from the users collection and a new VAC code has been regenerated.
            </p>
            <button 
              className="submit-btn"
              onClick={resetForm}
            >
              Delete Another Student Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

