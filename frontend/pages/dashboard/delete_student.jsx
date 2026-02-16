import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import BackToDashboard from "../../components/BackToDashboard";
import Title from '../../components/Title';
import { useStudents, useStudent, useDeleteStudent } from '../../lib/api/students';
import apiClient from '../../lib/axios';
import { useQuery } from '@tanstack/react-query';

export default function DeleteStudent() {
  const router = useRouter();
  const [studentId, setStudentId] = useState("");
  const [searchId, setSearchId] = useState(""); // Separate state for search
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState("");
  const [lastCheckedId, setLastCheckedId] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [searchResults, setSearchResults] = useState([]); // Store multiple search results
  const [showSearchResults, setShowSearchResults] = useState(false); // Show/hide search results

  // React Query hooks
  const { data: allStudents } = useStudents();
  const { data: student, isLoading: studentLoading, error: studentError } = useStudent(searchId, { enabled: !!searchId });
  const deleteStudentMutation = useDeleteStudent();

  // Get user account data to get email from users collection
  const { data: userAccount, isLoading: accountLoading } = useQuery({
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

  const checkStudent = async () => {
    if (!studentId.trim()) {
      setError("Please enter a student ID or name");
      return;
    }

    setError("");
    setSearchResults([]);
    setShowSearchResults(false);
    
    const searchTerm = studentId.trim();
    setLastCheckedId(searchTerm);
    
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
          setLastCheckedId(foundStudent.id.toString());
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
          setLastCheckedId(foundStudent.id.toString());
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

  const deleteStudent = async () => {
    if (!student) return;

    setError("");

    deleteStudentMutation.mutate(searchId, {
      onSuccess: () => {
        setDeleted(true);
        setShowConfirm(false); // Hide the modal after success
      },
      onError: (err) => {
        setError("Error deleting student. Please try again.");
      }
    });
  };

  const resetForm = () => {
    setStudentId("");
    setSearchId(""); // Clear search ID to reset the query
    setError("");
    setDeleted(false);
    setLastCheckedId("");
    setSearchResults([]);
    setShowSearchResults(false);
  };

  // Handle student selection from search results
  const handleStudentSelect = (selectedStudent) => {
    setSearchId(selectedStudent.id.toString());
    setStudentId(selectedStudent.id.toString());
    setLastCheckedId(selectedStudent.id.toString());
    setSearchResults([]);
    setShowSearchResults(false);
    setError("");
  };

  return (
    <div style={{ padding: "20px 5px 20px 5px" }}>
      <div style={{ maxWidth: 600, margin: "40px auto", padding: 24 }}>
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
            background: rgba(0,0,0,0.25);
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
            width: 100%;
            text-align: center;
          }
          .confirm-buttons {
            display: flex;
            gap: 16px;
            margin-top: 24px;
            justify-content: center;
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
              padding: 16px;
              font-size: 1rem;
            }
          }
        `}</style>
        <Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/trash2.svg" alt="Delete Student" width={32} height={32} />
            Delete Student
          </div>
        </Title>
        {/* Only show the entire form container if not deleted */}
        {!deleted && (
          <div className="form-container">
            <form onSubmit={(e) => { e.preventDefault(); checkStudent(); }} className="fetch-form">
              <input
                className="fetch-input"
                type="text"
                value={studentId}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setStudentId(newValue);
                  setSearchId(""); // Clear search ID to prevent auto-fetch
                  // Clear student info and error if input changes
                  if (newValue.trim() !== lastCheckedId) {
                    setError("");
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }
                }}
                placeholder="Enter Student ID, Name, Phone Number"
                disabled={studentLoading || deleteStudentMutation.isPending}
                required
              />
              <button 
                type="submit"
                className="fetch-btn"
                disabled={studentLoading || deleteStudentMutation.isPending}
              >
                {studentLoading ? "Loading..." : "🔍 Search"}
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
                  Select a student to delete:
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

            {student && (
              <div className="student-info">
                <h3>Student Found:</h3>
                <p><strong>Name:</strong> {student.name}</p>
                {student.age && <p><strong>Age:</strong> {student.age}</p>}
                {student.gender && <p><strong>Gender:</strong> {student.gender}</p>}
                <p><strong>Grade:</strong> {student.grade}</p>
                <p><strong>School:</strong> {student.school}</p>
                <p><strong>Phone:</strong> {student.phone}</p>
                <p><strong>Email:</strong> {userAccount?.email || student.email || 'No Email'}</p>
                <p><strong>Parent's Phone:</strong> {student.parents_phone || student.parentsPhone}</p>
                <p><strong>Main Center:</strong> {student.main_center}</p>
                <p><strong>Main Comment:</strong> {student.main_comment ||"No Comment"}</p>
                
                <div style={{ marginTop: "20px" }}>
                  <p style={{ color: "#dc3545", fontWeight: "bold", marginBottom: "16px" }}>
                    {userAccount ? (
                      <>⚠️ Are you sure you want to delete this student's account? This will delete their account and regenerate a new VAC code. This action cannot be undone.</>
                    ) : (
                      <>⚠️ Are you sure you want to delete this student? This action cannot be undone.</>
                    )}
                  </p>
                  <button 
                    className="submit-btn"
                    onClick={() => setShowConfirm(true)}
                    disabled={deleteStudentMutation.isPending || accountLoading}
                  >
                    🗑️ Yes, Delete Student
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
              {userAccount ? (
                <>
                  <p>Are you sure you want to delete student <strong>{student?.name}</strong> (ID: {studentId})?</p>
                  <p>This will delete their account and regenerate a new VAC code.</p>
                  <p><strong>This action cannot be undone!</strong></p>
                </>
              ) : (
                <>
              <p>Are you sure you want to delete student <strong>{student?.name}</strong> (ID: {studentId})?</p>
              <p><strong>This action cannot be undone!</strong></p>
                </>
              )}
              <div className="confirm-buttons">
                <button
                  onClick={deleteStudent}
                  disabled={deleteStudentMutation.isPending}
                  className="confirm-reset-btn"
                >
                  {deleteStudentMutation.isPending ? "Deleting..." : "Yes, Delete Student"}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={deleteStudentMutation.isPending}
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
            <div style={{ fontSize: "4rem" }}><Image src="/success-mark3.svg" alt="Delete" width={80} height={80} /></div>
            <h2 style={{ color: "#28a745", marginBottom: "16px" }}>Student Deleted Successfully!</h2>
            <p style={{ color: "#6c757d", marginBottom: "24px" }}>
              Student ID <strong>{studentId}</strong> has been permanently deleted from the database.
            </p>
            <button 
              className="submit-btn"
              onClick={resetForm}
            >
              Delete Another Student
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 