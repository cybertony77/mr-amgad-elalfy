import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../lib/axios';
import { useProfile } from '../../../lib/api/auth';
import { useStudents } from '../../../lib/api/students';
import Title from '../../../components/Title';
import LoadingSkeleton from '../../../components/LoadingSkeleton';
import Image from 'next/image';
import { IconPlus, IconMinus } from '@tabler/icons-react';
import { ActionIcon, Button } from '@mantine/core';

export default function ManageStudentScore() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [accessDenied, setAccessDenied] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [searchId, setSearchId] = useState("");
  const [error, setError] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    if (!profileLoading && profile) {
      const allowedRoles = ['admin', 'developer', 'assistant'];
      if (!allowedRoles.includes(profile.role)) {
        setAccessDenied(true);
      }
    }
  }, [profile, profileLoading]);

  // Get all students for name-based search
  const { data: allStudents } = useStudents({}, { 
    enabled: !!profile,
  });

  // Fetch student with rankings
  const { data: studentData, isLoading: studentLoading, refetch: refetchStudent } = useQuery({
    queryKey: ['student-with-rankings', searchId],
    queryFn: async () => {
      if (!searchId) return null;
      
      // First get the student
      const studentResponse = await apiClient.get(`/api/students/${searchId}`);
      const student = studentResponse.data;
      
      // Then get rankings
      const rankingsResponse = await apiClient.get(`/api/scoring/view-scores?page=1&limit=10000`);
      const allStudentsWithRankings = rankingsResponse.data.data || [];
      
      // Find this student in the rankings
      const studentWithRanking = allStudentsWithRankings.find(s => s.id === student.id);
      
      return {
        ...student,
        centerRank: studentWithRanking?.centerRank || null,
        centerTotal: studentWithRanking?.centerTotal || null,
        gradeRank: studentWithRanking?.gradeRank || null,
        gradeTotal: studentWithRanking?.gradeTotal || null
      };
    },
    enabled: !!searchId,
  });

  // Update score mutation
  const updateScoreMutation = useMutation({
    mutationFn: async ({ studentId, newScore }) => {
      const response = await apiClient.put(`/api/students/${studentId}`, {
        score: newScore
      });
      return response.data;
    },
    onSuccess: () => {
      // Refetch student data and rankings
      queryClient.invalidateQueries(['student-with-rankings', searchId]);
      queryClient.invalidateQueries(['scoring-view-scores']);
    },
  });

  const handleIdSubmit = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) return;
    
    setError("");
    setSearchResults([]);
    setShowSearchResults(false);
    
    const searchTerm = studentId.trim();
    
    // Check if it's a numeric ID
    if (/^\d+$/.test(searchTerm)) {
      // It's a numeric ID, search directly
      setSearchId(searchTerm);
    } else {
      // It's a name, search through all students
      if (allStudents) {
        const matchingStudents = allStudents.filter(student => 
          student.name.toLowerCase().includes(searchTerm.toLowerCase())
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
          setError(`❌ No student found with name "${searchTerm}"`);
          setSearchId("");
        }
      } else {
        setError("❌ Student data not loaded. Please try again.");
      }
    }
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

  const handleStudentSelect = (selectedStudent) => {
    setSearchId(selectedStudent.id.toString());
    setStudentId(selectedStudent.id.toString());
    setSearchResults([]);
    setShowSearchResults(false);
    setError("");
  };

  const handleScoreChange = async (delta) => {
    if (!studentData) return;
    
    const currentScore = studentData.score || 0;
    const newScore = Math.max(0, currentScore + delta); // Ensure score doesn't go below 0
    
    try {
      await updateScoreMutation.mutateAsync({
        studentId: studentData.id,
        newScore
      });
      
      // Refetch to get updated rankings
      await refetchStudent();
    } catch (error) {
      console.error('Error updating score:', error);
      setError('Failed to update score. Please try again.');
    }
  };

  if (profileLoading) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (accessDenied || !profile || !['admin', 'developer', 'assistant'].includes(profile.role)) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Access Denied</h2>
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div style={{ maxWidth: 800, margin: "40px auto", padding: "12px" }}>
        <Title backText="Back" href="/dashboard/manage_scoring_system">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/star2.svg" alt="Manage Student Score" width={32} height={32} />
            Manage Student Score
          </div>
        </Title>

        <style jsx>{`
          .form-container {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            margin-bottom: 24px;
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
          .fetch-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
            box-shadow: 0 2px 8px rgba(31, 168, 220, 0.2);
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
          .student-name {
            font-size: 1.8rem;
            font-weight: 700;
            color: #212529;
            margin-bottom: 24px;
            text-align: center;
            padding-bottom: 16px;
            border-bottom: 3px solid #1FA8DC;
          }
          .score-section {
            border-top: 3px solid #e9ecef;
            padding-top: 32px;
            margin-top: 32px;
          }
          .score-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #495057;
            margin-bottom: 24px;
            text-align: center;
          }
          .score-display {
            text-align: center;
            margin-bottom: 32px;
            padding: 24px;
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            border-radius: 16px;
            border: 3px solid #1FA8DC;
            box-shadow: 0 4px 16px rgba(31, 168, 220, 0.2);
          }
          .score-label {
            font-size: 0.9rem;
            color: #6c757d;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 8px;
          }
          .score-value {
            font-size: 3.5rem;
            font-weight: 700;
            color: #1FA8DC;
            line-height: 1;
          }
          .score-buttons-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }
          .score-buttons-row {
            display: flex;
            gap: 10px;
            justify-content: center;
            flex-wrap: wrap;
            align-items: center;
          }
          .score-btn {
            padding: 14px 20px;
            border: 2px solid;
            border-radius: 12px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.3s ease;
            min-width: 70px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            position: relative;
          }
          .score-btn-small {
            min-width: 60px;
            padding: 12px 16px;
            font-size: 0.95rem;
          }
          .score-btn-large {
            min-width: 85px;
            padding: 16px 24px;
            font-size: 1.1rem;
          }
          .score-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0,0,0,0.15);
          }
          .score-btn:active {
            transform: translateY(0);
          }
          .score-btn:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none;
          }
          .score-btn-positive {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            border-color: #28a745;
          }
          .score-btn-positive:hover:not(:disabled) {
            background: linear-gradient(135deg, #218838 0%, #1ea080 100%);
          }
          .score-btn-negative {
            background: linear-gradient(135deg, #dc3545 0%, #c82333 100%);
            color: white;
            border-color: #dc3545;
          }
          .score-btn-negative:hover:not(:disabled) {
            background: linear-gradient(135deg, #c82333 0%, #bd2130 100%);
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
              grid-template-columns: 1fr;
              gap: 12px;
            }
            .score-buttons-row {
              gap: 8px;
            }
            .score-btn {
              min-width: 65px;
              padding: 12px 18px;
              font-size: 0.9rem;
            }
            .score-btn-small {
              min-width: 55px;
              padding: 10px 14px;
              font-size: 0.85rem;
            }
            .score-btn-large {
              min-width: 75px;
              padding: 14px 22px;
              font-size: 1rem;
            }
          }
          @media (max-width: 480px) {
            .form-container, .info-container {
              padding: 16px;
            }
            .student-name {
              font-size: 1.4rem;
            }
            .detail-item {
              padding: 12px;
            }
            .detail-label {
              font-size: 0.8rem;
            }
            .detail-value {
              font-size: 0.95rem;
            }
            .score-section {
              padding-top: 24px;
              margin-top: 24px;
            }
            .score-title {
              font-size: 1.2rem;
            }
            .score-display {
              padding: 20px;
            }
            .score-value {
              font-size: 2.5rem;
            }
            .score-buttons-container {
              gap: 16px;
            }
            .score-buttons-row {
              gap: 6px;
            }
            .score-btn {
              min-width: 55px;
              padding: 10px 14px;
              font-size: 0.85rem;
            }
            .score-btn-small {
              min-width: 50px;
              padding: 8px 12px;
              font-size: 0.8rem;
            }
            .score-btn-large {
              min-width: 60px;
              padding: 12px 18px;
              font-size: 0.9rem;
            }
          }
          @media (max-width: 360px) {
            .form-container, .info-container {
              padding: 12px;
            }
            .student-name {
              font-size: 1.2rem;
            }
            .score-value {
              font-size: 2rem;
            }
            .score-btn {
              min-width: 50px;
              padding: 8px 12px;
              font-size: 0.8rem;
            }
            .score-btn-small {
              min-width: 45px;
              padding: 6px 10px;
              font-size: 0.75rem;
            }
            .score-btn-large {
              min-width: 55px;
              padding: 10px 16px;
              font-size: 0.85rem;
            }
          }
        `}</style>

        {/* Search Form */}
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
            <button type="submit" className="fetch-btn" disabled={studentLoading}>
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

        {error && (
          <div style={{
            background: '#fee2e2',
            color: '#991b1b',
            borderRadius: 10,
            padding: 16,
            marginBottom: 16,
            textAlign: 'center',
            fontWeight: 600,
            border: '1.5px solid #fca5a5',
            fontSize: '1.1rem',
            boxShadow: '0 4px 16px rgba(220, 53, 69, 0.08)'
          }}>
            {error}
          </div>
        )}

        {studentLoading && (
          <LoadingSkeleton type="table" rows={5} columns={1} />
        )}

        {studentData && !studentLoading && (
          <div className="info-container">
            {/* Student Name */}
            <div className="student-name">
              {studentData.name}
            </div>

            {/* Student Info - 2 columns per row */}
            <div className="student-details">
              <div className="detail-item">
                <div className="detail-label">Grade</div>
                <div className="detail-value">{studentData.grade || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Main Center</div>
                <div className="detail-value">{studentData.main_center || '-'}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Rank (Main Center)</div>
                <div className="detail-value">
                  {studentData.centerRank && studentData.centerTotal 
                    ? `${studentData.centerRank} / ${studentData.centerTotal}`
                    : '-'}
                </div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Rank (Grade)</div>
                <div className="detail-value">
                  {studentData.gradeRank && studentData.gradeTotal 
                    ? `${studentData.gradeRank} / ${studentData.gradeTotal}`
                    : '-'}
                </div>
              </div>
            </div>

            {/* Score Control Section */}
            <div className="score-section">
              <div className="score-title">Score Control</div>
              
              <div className="score-display">
                <div className="score-label">Current Score</div>
                <div className="score-value">
                  {studentData.score !== null && studentData.score !== undefined ? studentData.score : 0}
                </div>
              </div>

              <div className="score-buttons-container">
                {/* Positive buttons - arranged from small to big (left to right) */}
                <div className="score-buttons-row">
                  <button
                    className="score-btn score-btn-positive score-btn-small"
                    onClick={() => handleScoreChange(1)}
                    disabled={updateScoreMutation.isLoading}
                  >
                    +1
                  </button>
                  <button
                    className="score-btn score-btn-positive"
                    onClick={() => handleScoreChange(10)}
                    disabled={updateScoreMutation.isLoading}
                  >
                    +10
                  </button>
                  <button
                    className="score-btn score-btn-positive"
                    onClick={() => handleScoreChange(20)}
                    disabled={updateScoreMutation.isLoading}
                  >
                    +20
                  </button>
                  <button
                    className="score-btn score-btn-positive"
                    onClick={() => handleScoreChange(30)}
                    disabled={updateScoreMutation.isLoading}
                  >
                    +30
                  </button>
                  <button
                    className="score-btn score-btn-positive"
                    onClick={() => handleScoreChange(40)}
                    disabled={updateScoreMutation.isLoading}
                  >
                    +40
                  </button>
                  <button
                    className="score-btn score-btn-positive score-btn-large"
                    onClick={() => handleScoreChange(50)}
                    disabled={updateScoreMutation.isLoading}
                  >
                    +50
                  </button>
                </div>

                {/* Divider */}
                <div style={{
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent, #e9ecef 20%, #e9ecef 80%, transparent)',
                  margin: '8px 0'
                }}></div>

                {/* Negative buttons - arranged from small to big (left to right) */}
                <div className="score-buttons-row">
                  <button
                    className="score-btn score-btn-negative score-btn-small"
                    onClick={() => handleScoreChange(-1)}
                    disabled={updateScoreMutation.isLoading}
                  >
                    -1
                  </button>
                  <button
                    className="score-btn score-btn-negative"
                    onClick={() => handleScoreChange(-10)}
                    disabled={updateScoreMutation.isLoading}
                  >
                    -10
                  </button>
                  <button
                    className="score-btn score-btn-negative"
                    onClick={() => handleScoreChange(-20)}
                    disabled={updateScoreMutation.isLoading}
                  >
                    -20
                  </button>
                  <button
                    className="score-btn score-btn-negative"
                    onClick={() => handleScoreChange(-30)}
                    disabled={updateScoreMutation.isLoading}
                  >
                    -30
                  </button>
                  <button
                    className="score-btn score-btn-negative"
                    onClick={() => handleScoreChange(-40)}
                    disabled={updateScoreMutation.isLoading}
                  >
                    -40
                  </button>
                  <button
                    className="score-btn score-btn-negative score-btn-large"
                    onClick={() => handleScoreChange(-50)}
                    disabled={updateScoreMutation.isLoading}
                  >
                    -50
                  </button>
                </div>
              </div>
              
              {updateScoreMutation.isLoading && (
                <div style={{ textAlign: 'center', marginTop: '20px', color: '#6c757d', fontWeight: 600 }}>
                  Updating score...
                </div>
              )}
            </div>
          </div>
        )}

        {!studentData && !studentLoading && searchId && (
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
          }}>
            <div style={{ color: '#6c757d', fontSize: '1.1rem' }}>
            ❌ Student not found. Please search for a student.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
