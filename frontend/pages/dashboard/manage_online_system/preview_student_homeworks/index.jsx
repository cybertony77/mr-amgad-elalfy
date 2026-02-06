import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/router";
import Title from '../../../../components/Title';
import HomeworkPerformanceChart from '../../../../components/HomeworkPerformanceChart';
import { useStudents, useStudent } from '../../../../lib/api/students';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../../lib/axios';
import Image from 'next/image';

export default function PreviewStudentHomeworks() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [studentId, setStudentId] = useState("");
  const [searchId, setSearchId] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [resettingId, setResettingId] = useState(null);
  const searchErrorTimeoutRef = useRef(null);

  // Get all students for name-based search
  const { data: allStudents } = useStudents();

  // Get student data
  const { data: student, isLoading: studentLoading, error: studentError } = useStudent(searchId, {
    enabled: !!searchId,
  });

  // Get online homeworks
  const { data: homeworksData, isLoading: homeworksLoading, refetch: refetchHomeworks } = useQuery({
    queryKey: ['student-online-homeworks', searchId],
    queryFn: async () => {
      if (!searchId) return null;
      const response = await apiClient.get(`/api/students/${searchId}/online-homeworks`);
      return response.data;
    },
    enabled: !!searchId && !!student,
  });

  // Fetch homework performance chart data using API endpoint
  const { data: performanceData, isLoading: isChartLoading } = useQuery({
    queryKey: ['homework-performance', searchId],
    queryFn: async () => {
      if (!searchId) return { chartData: [] };
      try {
        const response = await apiClient.get(`/api/students/${searchId}/homework-performance`);
        return response.data || { chartData: [] };
      } catch (error) {
        console.error('Error fetching homework performance:', error);
        return { chartData: [] };
      }
    },
    enabled: !!searchId && !!student,
    refetchInterval: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 1,
  });

  const chartData = performanceData?.chartData || [];

  // Reset homework mutation
  const resetHomeworkMutation = useMutation({
    mutationFn: async ({ studentId, homeworkId }) => {
      const response = await apiClient.delete(`/api/students/${studentId}/reset-homework`, {
        data: { homework_id: homeworkId }
      });
      return response.data;
    },
    onSuccess: () => {
      refetchHomeworks();
      // Invalidate and refetch chart data
      queryClient.invalidateQueries({ queryKey: ['homework-performance', searchId] });
      setResettingId(null);
    },
    onError: (err) => {
      console.error('Error resetting homework:', err);
      setResettingId(null);
    },
  });

  useEffect(() => {
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

  // Handle student error (when numeric ID doesn't exist)
  useEffect(() => {
    if (studentError && searchId) {
      if (studentError.response?.status === 404) {
        setSearchError("❌ Sorry, This student not found");
        setSearchId("");
      }
    }
  }, [studentError, searchId]);

  const handleIdSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;

    if (searchErrorTimeoutRef.current) {
      clearTimeout(searchErrorTimeoutRef.current);
      searchErrorTimeoutRef.current = null;
    }
    setSearchError("");
    setSearchResults([]);
    setShowSearchResults(false);

    const searchTerm = studentId.trim();

    if (/^\d+$/.test(searchTerm)) {
      setSearchId(searchTerm);
    } else {
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
          setSearchError("❌ Sorry, This student not found");
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

  const handleReset = async (homeworkId) => {
    if (!searchId) return;
    setResettingId(homeworkId);
    resetHomeworkMutation.mutate({ studentId: searchId, homeworkId });
  };

  // Calculate time taken from date strings
  const calculateTimeTaken = (dateOfStart, dateOfEnd) => {
    if (!dateOfStart || !dateOfEnd) return null;

    try {
      const parseDate = (dateStr) => {
        const [datePart, timePart] = dateStr.split(' at ');
        const [month, day, year] = datePart.split('/');
        const [time, ampm] = timePart.split(' ');
        const [hours, minutes, seconds] = time.split(':');
        
        let hour24 = parseInt(hours);
        if (ampm === 'PM' && hour24 !== 12) hour24 += 12;
        if (ampm === 'AM' && hour24 === 12) hour24 = 0;
        
        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), hour24, parseInt(minutes), parseInt(seconds));
      };

      const start = parseDate(dateOfStart);
      const end = parseDate(dateOfEnd);
      const diffMs = end - start;
      
      if (diffMs < 0) return null;
      
      const totalSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      
      return { minutes, seconds };
    } catch (err) {
      console.error('Error calculating time taken:', err);
      return null;
    }
  };

  const homeworks = homeworksData?.homeworks || [];
  const isLoading = studentLoading || homeworksLoading;



  return (
    <div className="page-wrapper" style={{ padding: "20px 5px 20px 5px" }}>
      <div className="main-container" style={{ maxWidth: 800, margin: "40px auto", padding: "25px" }}>
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .page-wrapper {
            padding: 20px 5px 20px 5px;
          }
          .main-container {
            max-width: 800px;
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
          .homeworks-container {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          }
          .homework-item {
            border: 2px solid #e9ecef;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 16px;
            transition: all 0.2s ease;
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
          .btn-details {
            padding: 8px 16px;
            backgroundColor: '#1FA8DC';
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            fontSize: 0.9rem;
            fontWeight: 600;
            transition: all 0.2s ease;
          }
          .btn-reset {
            padding: 8px 16px;
            backgroundColor: '#dc3545';
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            fontSize: 0.9rem;
            fontWeight: 600;
            transition: all 0.2s ease;
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
            .form-container, .homeworks-container, .info-container {
              padding: 20px;
            }
            .info-container {
              padding: 16px !important;
              margin-bottom: 16px !important;
            }
            .info-container h3 {
              font-size: 1.3rem !important;
              margin-bottom: 16px !important;
            }
            .student-details {
              grid-template-columns: 1fr;
              gap: 12px;
            }
            .detail-item {
              padding: 16px;
            }
            .homework-item {
              flex-direction: column;
              gap: 16px;
              padding: 16px;
            }
            .homework-buttons {
              width: 100%;
              flex-direction: column;
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
            .form-container, .homeworks-container, .info-container {
              padding: 16px;
            }
            .info-container {
              padding: 12px !important;
              margin-bottom: 12px !important;
            }
            .info-container h3 {
              font-size: 1.3rem !important;
              margin-bottom: 12px !important;
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
            .homework-item {
              padding: 12px;
            }
          }
          @media (max-width: 360px) {
            .main-container {
              padding: 10px !important;
            }
            .info-container {
              padding: 10px !important;
            }
            .info-container h3 {
              font-size: 1.3rem !important;
            }
            .homeworks-container {
              padding: 10px !important;
            }
          }
        `}</style>

        <Title backText="Back" href="/dashboard/manage_online_system">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/books.svg" alt="Preview Homeworks" width={32} height={32} />
            Preview Student Homeworks
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
            <button type="submit" className="fetch-btn" disabled={isLoading}>
              {isLoading ? "Loading..." : "🔍 Search"}
            </button>
          </form>

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

        {searchError && (
          <div className="error-message" style={{ marginTop: '16px' }}>
            {searchError}
          </div>
        )}

        {searchId && student && (
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

            {/* Chart Section - Always show if student is selected */}
            {!isLoading && student && (
              <div className="homeworks-container" style={{ marginBottom: '20px' }}>
                <h3 style={{ marginBottom: '24px', fontSize: '1.3rem', fontWeight: '600', color: '#212529' }}>
                  Homework Performance by Week
                </h3>
                {isChartLoading ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    color: '#6c757d',
                    fontSize: '1.1rem',
                    fontWeight: '500'
                  }}>
                    Loading chart data...
                  </div>
                ) : (
                  <HomeworkPerformanceChart chartData={chartData} height={400} />
                )}
              </div>
            )}

            {isLoading ? (
              <div className="homeworks-container">
                <div style={{
                  textAlign: 'center',
                  padding: '40px'
                }}>
                  <div style={{
                    width: "50px",
                    height: "50px",
                    border: "4px solid rgba(31, 168, 220, 0.2)",
                    borderTop: "4px solid #1FA8DC",
                    borderRadius: "50%",
                    margin: "0 auto 20px",
                    animation: "spin 1s linear infinite"
                  }} />
                  <p style={{ color: "#6c757d", fontSize: "1rem" }}>Loading homeworks...</p>
                </div>
              </div>
            ) : homeworks.length === 0 ? (
              <div className="homeworks-container">
                <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d', fontSize: '1rem' }}>
                  This student has no online homeworks
                </div>
              </div>
            ) : (
              <div className="homeworks-container">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {homeworks.map((hwResult) => {
                    const homework = hwResult.homework;
                    if (!homework) return null;
                    
                    const timeTaken = calculateTimeTaken(hwResult.date_of_start, hwResult.date_of_end);
                    
                    return (
                      <div
                        key={hwResult.homework_id}
                        className="homework-item"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#1FA8DC';
                          e.currentTarget.style.boxShadow = '0 4px 12px rgba(31, 168, 220, 0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e9ecef';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                          <div style={{ flex: 1, minWidth: '200px' }}>
                            <div style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '8px' }}>
                              {hwResult.week !== undefined && hwResult.week !== null ? `Week ${hwResult.week} • ` : ''}{homework.lesson_name}
                            </div>
                            <div style={{ color: '#6c757d', fontSize: '0.95rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span>{homework.questions || 0} Question{homework.questions !== 1 ? 's' : ''}</span>
                              <span>•</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Image src="/clock.svg" alt="Timer" width={18} height={18} />
                                {homework.timer ? `${homework.timer} minute${homework.timer !== 1 ? 's' : ''}` : 'No Timer'}
                              </span>
                            </div>
                            <div style={{ color: '#6c757d', fontSize: '0.9rem', marginBottom: '4px' }}>
                              <strong>Percentage:</strong> {hwResult.percentage}
                            </div>
                            <div style={{ color: '#6c757d', fontSize: '0.9rem', marginBottom: '4px' }}>
                              <strong>Result:</strong> {hwResult.result}
                            </div>
                            {timeTaken && (
                              <div style={{ color: '#6c757d', fontSize: '0.9rem' }}>
                                <strong>Taken Time:</strong> {timeTaken.minutes} minute{timeTaken.minutes !== 1 ? 's' : ''} and {timeTaken.seconds} second{timeTaken.seconds !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                          <div className="homework-buttons" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button
                              onClick={() => router.push(`/dashboard/manage_online_system/preview_student_homeworks/details?student_id=${searchId}&homework_id=${hwResult.homework_id}`)}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: '#1FA8DC',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                              }}
                              onMouseEnter={(e) => {
                                e.target.style.backgroundColor = '#0d8bc7';
                                e.target.style.transform = 'translateY(-2px)';
                              }}
                              onMouseLeave={(e) => {
                                e.target.style.backgroundColor = '#1FA8DC';
                                e.target.style.transform = 'translateY(0)';
                              }}
                            >
                              <Image src="/details.svg" alt="Details" width={18} height={18} />
                              Details
                            </button>
                            <button
                              onClick={() => handleReset(hwResult.homework_id)}
                              disabled={resettingId === hwResult.homework_id}
                              style={{
                                padding: '8px 16px',
                                backgroundColor: resettingId === hwResult.homework_id ? '#6c757d' : '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: resettingId === hwResult.homework_id ? 'not-allowed' : 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: '600',
                                transition: 'all 0.2s ease',
                                opacity: resettingId === hwResult.homework_id ? 0.7 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                              }}
                              onMouseEnter={(e) => {
                                if (resettingId !== hwResult.homework_id) {
                                  e.target.style.backgroundColor = '#c82333';
                                  e.target.style.transform = 'translateY(-2px)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (resettingId !== hwResult.homework_id) {
                                  e.target.style.backgroundColor = '#dc3545';
                                  e.target.style.transform = 'translateY(0)';
                                }
                              }}
                            >
                              <Image src="/refresh.svg" alt="Reset" width={18} height={18} />
                              {resettingId === hwResult.homework_id ? 'Resetting...' : 'Reset'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

