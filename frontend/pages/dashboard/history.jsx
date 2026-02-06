import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import { AVAILABLE_CENTERS } from "../../constants/centers";
import { weeks } from "../../constants/weeks";
import Title from "../../components/Title";
import GradeSelect from "../../components/GradeSelect";
import CenterSelect from "../../components/CenterSelect";
import AttendanceWeekSelect from "../../components/AttendanceWeekSelect";
import { Table, ScrollArea } from '@mantine/core';
import styles from '../../styles/TableScrollArea.module.css';
import { IconArrowRight, IconSearch, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { ActionIcon, TextInput, useMantineTheme } from '@mantine/core';
import { useStudentsHistory } from '../../lib/api/students';
import LoadingSkeleton from '../../components/LoadingSkeleton';

export function InputWithButton(props) {
  const theme = useMantineTheme();
  return (
    <TextInput
      radius="xl"
      size="md"
      placeholder="Search by ID, Name, School, Student Phone or Parent Phone"
      rightSectionWidth={42}
      leftSection={<IconSearch size={18} stroke={1.5} />}
      rightSection={
        <ActionIcon size={32} radius="xl" color={theme.primaryColor} variant="filled" onClick={props.onButtonClick}>
          <IconArrowRight size={18} stroke={1.5} />
        </ActionIcon>
      }
      {...props}
    />
  );
}

// No client-side token handling; auth is enforced in _app.js

export default function History() {
  const router = useRouter();
  const containerRef = useRef(null);
  const [selectedGrade, setSelectedGrade] = useState("");
  const [selectedCenter, setSelectedCenter] = useState("");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null); // 'grade', 'center', 'week', or null
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 50; // Display 50 records per page
  const [showPagePopup, setShowPagePopup] = useState(false);

  // Load remembered filter values from sessionStorage
  useEffect(() => {
    const rememberedGrade = sessionStorage.getItem('historySelectedGrade');
    const rememberedCenter = sessionStorage.getItem('historySelectedCenter');
    const rememberedWeek = sessionStorage.getItem('historySelectedWeek');
    
    if (rememberedGrade) {
      setSelectedGrade(rememberedGrade);
    }
    if (rememberedCenter) {
      setSelectedCenter(rememberedCenter);
    }
    if (rememberedWeek) {
      setSelectedWeek(rememberedWeek);
    }
  }, []);

  // React Query hook with real-time updates - 5 second polling
  const { data: students = [], isLoading, error, refetch, isRefetching, dataUpdatedAt } = useStudentsHistory({
    // Refetch settings
    refetchInterval: 30 * 60 * 1000, // Refetch every 30 minutes
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    refetchOnWindowFocus: true, // Immediate update when switching back to tab
    refetchOnReconnect: true, // Refetch when reconnecting to internet
    staleTime: 0, // Always consider data stale to force refetch
    gcTime: 1000, // Keep in cache for only 1 second
    refetchOnMount: true, // Always refetch when component mounts/page entered
  });

  // Debug: Log React Query status
  useEffect(() => {
    console.log('React Query Status:', {
      isLoading,
      isRefetching,
      dataUpdatedAt: new Date(dataUpdatedAt).toLocaleTimeString(),
      studentsCount: students.length,
      timestamp: new Date().toLocaleTimeString()
    });
  }, [isLoading, isRefetching, dataUpdatedAt, students.length]);

  useEffect(() => {
    // Authentication is now handled by _app.js with HTTP-only cookies
    // This component will only render if user is authenticated
  }, [router]);

  useEffect(() => {
    filterStudents();
  }, [students, selectedGrade, selectedCenter, selectedWeek, searchTerm]);

  // Debug: Log when data changes to confirm real-time updates
  useEffect(() => {
    if (students.length > 0) {
      console.log(`History data updated: ${students.length} records at ${new Date().toLocaleTimeString()}`);
    }
  }, [students]);

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);



  const filterStudents = () => {
    let filtered = students;

    // Pre-filter by searchTerm first to ensure ID/phone searches are not lost
    if (searchTerm.trim() !== "") {
      const term = searchTerm.trim();
      if (/^\d+$/.test(term)) {
        // Digits only: prioritize exact ID match, then phone matches
        filtered = filtered.filter(student => {
          // Convert both to strings for comparison to handle any type differences
          const studentId = String(student.id || '');
          const studentPhone = String(student.phone || '');
          const parentPhone = String(student.parentsPhone || '');
          
          // If search term starts with "01", treat it as phone number search
          if (term.startsWith('01')) {
            return studentId === term ||
                   studentPhone.includes(term) ||
                   parentPhone.includes(term);
          }
          
          // If search term is short (1-3 digits), prioritize exact ID match
          if (term.length <= 3) {
            return studentId === term;
          }
          
          // For longer numeric searches, search in ID and phone fields
          return studentId === term ||
                 studentPhone.includes(term) ||
                 parentPhone.includes(term);
        });
      } else {
        // Text: search in name, school, and phone fields (case-insensitive for text fields)
        filtered = filtered.filter(student =>
          (student.name && student.name.toLowerCase().includes(term.toLowerCase())) ||
          (student.school && student.school.toLowerCase().includes(term.toLowerCase())) ||
          (student.phone && student.phone.includes(term)) ||
          (student.parentsPhone && student.parentsPhone.includes(term))
        );
      }
    }

    // Show all students who have history records
    filtered = filtered.filter(student => 
      student.historyRecords && student.historyRecords.length > 0
    );

    // Create filtered records for each student
    filtered = filtered.map(student => {
      let filteredRecords = [...student.historyRecords];

      if (selectedGrade) {
        // Filter by current student grade, not the grade stored in history record
        // This ensures that when a student's grade is edited, filtering works with the updated grade
        if (student.grade.toLowerCase() === selectedGrade.toLowerCase()) {
          // Keep all records for this student since their current grade matches the filter
        } else {
          // Filter out all records for this student since their current grade doesn't match
          filteredRecords = [];
        }
      }

      if (selectedCenter) {
        filteredRecords = filteredRecords.filter(record => 
          record.center && record.center.toLowerCase() === selectedCenter.toLowerCase()
        );
      }

      if (selectedWeek && selectedWeek !== '') {
        filteredRecords = filteredRecords.filter(record => {
          const recordWeek = record.week || 'n/a';
          // Convert week string to number for comparison
          const weekMatch = selectedWeek.match(/week (\d+)/);
          const selectedWeekNumber = weekMatch ? parseInt(weekMatch[1]) : null;
          return selectedWeekNumber && recordWeek === selectedWeekNumber;
        });
      }

      return {
        ...student,
        historyRecords: filteredRecords
      };
    });

    // Only keep students who have matching records after filtering
    filtered = filtered.filter(student => student.historyRecords.length > 0);

    setFilteredStudents(filtered);
  };

  // Flatten all history records for pagination
  const allHistoryRecords = filteredStudents.flatMap(student => 
    student.historyRecords.map((record, index) => ({
      student,
      record,
      key: `${student.id}-${index}`
    }))
  );

  // Pagination helper function
  const getPaginationInfo = (totalItems, currentPage, pageSize) => {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;
    
    return {
      totalPages,
      startIndex,
      endIndex,
      hasNextPage,
      hasPrevPage,
      currentPage,
      totalCount: totalItems
    };
  };

  // Pagination for history records
  const pagination = getPaginationInfo(allHistoryRecords.length, currentPage, pageSize);
  const paginatedRecords = allHistoryRecords.slice(pagination.startIndex, pagination.endIndex);

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedGrade, selectedCenter, selectedWeek, searchTerm]);

  // Pagination handlers
  const handlePageClick = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= pagination.totalPages) {
      setCurrentPage(pageNumber);
      setShowPagePopup(false);
    }
  };

  const handlePrevPage = () => {
    if (pagination.hasPrevPage) {
      setCurrentPage(prev => Math.max(1, prev - 1));
    }
  };

  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showPagePopup && !event.target.closest('.pagination-page-info') && !event.target.closest('.page-popup')) {
        setShowPagePopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPagePopup]);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{ 
          width: "100%", 
          maxWidth: "800px", 
          margin: "0 auto",
          padding: "0 15px" 
        }}>
          <LoadingSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div ref={containerRef} style={{ maxWidth: 800, margin: "40px auto", padding: "20px 15px 20px 15px" }}>
        <div style={{ marginBottom: 20 }}>
          <Title>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/history.svg" alt="History" width={32} height={32} />
              History
            </div>
          </Title>
        </div>
        
        {/* Search Bar */}
        <div style={{ marginBottom: 20 }}>
          <InputWithButton
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <style jsx>{`
          @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
          }
          
          .filters-container {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            margin-bottom: 24px;
          }
          .filter-row {
            display: flex;
            gap: 12px;
            margin-bottom: 16px;
            flex-wrap: wrap;
          }
          .filter-group {
            flex: 1;
            min-width: 180px;
          }
          .filter-label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #495057;
            font-size: 0.95rem;
          }
          .filter-select {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            font-size: 1rem;
            transition: all 0.3s ease;
            background: #ffffff;
            color: #000000;
          }
          .filter-select:focus {
            outline: none;
            border-color: #87CEEB;
            box-shadow: 0 0 0 3px rgba(135, 206, 235, 0.1);
          }
          .history-container {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          }
          .history-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #495057;
            margin-bottom: 20px;
            text-align: center;
          }
          .no-results {
            text-align: center;
            color: #6c757d;
            font-style: italic;
            padding: 40px 20px;
          }

          /* Pagination Styles */
          .pagination-container {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 16px;
            margin-top: 24px;
            padding-top: 24px;
            border-top: 2px solid #e9ecef;
          }
          
          .pagination-button {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            border: 2px solid #1FA8DC;
            background: white;
            color: #1FA8DC;
            border-radius: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 8px rgba(31, 168, 220, 0.1);
          }
          
          .pagination-button:hover:not(:disabled) {
            background: #1FA8DC;
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(31, 168, 220, 0.3);
          }
          
          .pagination-button:active:not(:disabled) {
            transform: translateY(0);
          }
          
          .pagination-button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
            border-color: #adb5bd;
            color: #adb5bd;
            box-shadow: none;
          }
          
          .pagination-page-info {
            font-size: 1.1rem;
            font-weight: 600;
            color: #495057;
            min-width: 120px;
            text-align: center;
            padding: 8px 16px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
            transition: all 0.2s ease;
            position: relative;
            z-index: 9999;
          }
          
          .pagination-page-info.clickable:hover {
            background: #e9ecef;
            border-color: #1FA8DC;
            transform: translateY(-1px);
          }
          
          .page-popup {
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            margin-bottom: 8px;
            z-index: 10000;
          }
          
          .page-popup-content {
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            border: 2px solid #1FA8DC;
            padding: 16px;
            min-width: 300px;
            max-width: 500px;
            max-height: 400px;
            overflow-y: auto;
            position: relative;
            z-index: 10001;
          }
          
          .page-popup-header {
            font-size: 1.1rem;
            font-weight: 700;
            color: #495057;
            margin-bottom: 12px;
            text-align: center;
            padding-bottom: 8px;
            border-bottom: 2px solid #e9ecef;
          }
          
          .page-popup-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
            gap: 8px;
            max-height: 300px;
            overflow-y: auto;
          }
          
          .page-number-btn {
            padding: 10px;
            border: 2px solid #e9ecef;
            background: white;
            color: #495057;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 0.95rem;
            transition: all 0.2s ease;
          }
          
          .page-number-btn:hover {
            background: #1FA8DC;
            color: white;
            border-color: #1FA8DC;
            transform: translateY(-2px);
            box-shadow: 0 4px 8px rgba(31, 168, 220, 0.3);
          }
          
          .page-number-btn.active {
            background: #1FA8DC;
            color: white;
            border-color: #1FA8DC;
            font-weight: 700;
          }
          
          @media (max-width: 480px) {
            .pagination-container {
              gap: 12px;
              margin-top: 20px;
              padding-top: 20px;
            }
            
            .pagination-button {
              width: 40px;
              height: 40px;
            }
            
            .pagination-page-info {
              font-size: 1rem;
              min-width: 100px;
              padding: 6px 12px;
            }
            
            .page-popup {
              left: 50%;
              right: auto;
              width: calc(100vw - 40px);
              max-width: 400px;
            }
            
            .page-popup-content {
              min-width: auto;
              max-width: 100%;
              padding: 12px;
              max-height: 300px;
            }
            
            .page-popup-header {
              font-size: 1rem;
              margin-bottom: 10px;
              padding-bottom: 6px;
            }
            
            .page-popup-grid {
              grid-template-columns: repeat(auto-fill, minmax(40px, 1fr));
              gap: 6px;
              max-height: 250px;
            }
            
            .page-number-btn {
              padding: 8px;
              font-size: 0.85rem;
            }
          }
          
          @media (max-width: 360px) {
            .page-popup {
              width: calc(100vw - 20px);
            }
            
            .page-popup-grid {
              grid-template-columns: repeat(auto-fill, minmax(35px, 1fr));
              gap: 5px;
            }
            
            .page-number-btn {
              padding: 6px;
              font-size: 0.8rem;
            }
          }
        `}</style>

        <div className="filters-container">
          <div className="filter-row">
            <div className="filter-group">
              <label className="filter-label">Filter by Grade</label>
              <GradeSelect
                selectedGrade={selectedGrade}
                onGradeChange={(grade) => {
                  setSelectedGrade(grade);
                  // Remember the selected grade
                  if (grade) {
                    sessionStorage.setItem('historySelectedGrade', grade);
                  } else {
                    sessionStorage.removeItem('historySelectedGrade');
                  }
                }}
                isOpen={openDropdown === 'grade'}
                onToggle={() => setOpenDropdown(openDropdown === 'grade' ? null : 'grade')}
                onClose={() => setOpenDropdown(null)}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">Filter by Center</label>
              <CenterSelect
                selectedCenter={selectedCenter}
                onCenterChange={(center) => {
                  setSelectedCenter(center);
                  // Remember the selected center
                  if (center) {
                    sessionStorage.setItem('historySelectedCenter', center);
                  } else {
                    sessionStorage.removeItem('historySelectedCenter');
                  }
                }}
                isOpen={openDropdown === 'center'}
                onToggle={() => setOpenDropdown(openDropdown === 'center' ? null : 'center')}
                onClose={() => setOpenDropdown(null)}
              />
            </div>
            <div className="filter-group">
              <label className="filter-label">Filter by Week</label>
              <AttendanceWeekSelect
                selectedWeek={selectedWeek}
                onWeekChange={(week) => {
                  setSelectedWeek(week);
                  // Remember the selected week
                  if (week) {
                    sessionStorage.setItem('historySelectedWeek', week);
                  } else {
                    sessionStorage.removeItem('historySelectedWeek');
                  }
                }}
                isOpen={openDropdown === 'week'}
                onToggle={() => setOpenDropdown(openDropdown === 'week' ? null : 'week')}
                onClose={() => setOpenDropdown(null)}
              />
            </div>
          </div>
        </div>

        <div className="history-container">
          <div className="history-title">
            Attendance History ({allHistoryRecords.length} records)
          </div>
          
          {error && (
            <div style={{
              background: 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
              color: 'white',
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
              textAlign: 'center',
              fontWeight: 600
            }}>
              {error}
            </div>
          )}

          {allHistoryRecords.length === 0 ? (
            <div className="no-results">
              {selectedGrade || selectedCenter || selectedWeek 
                ? "No students found with the selected filters."
                : "No attendance records found."
              }
            </div>
          ) : (
            <>
            <ScrollArea h={400} type="hover" className={styles.scrolled}>
              <Table striped highlightOnHover withTableBorder withColumnBorders style={{ minWidth: '1400px' }}>
                <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa' }}>
                  <Table.Tr>
                    <Table.Th style={{ width: '60px', minWidth: '60px', textAlign: 'center' }}>ID</Table.Th>
                    <Table.Th style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>Name</Table.Th>
                    <Table.Th style={{ width: '100px', minWidth: '100px', textAlign: 'center' }}>Grade</Table.Th>
                    <Table.Th style={{ width: '180px', minWidth: '180px', textAlign: 'center' }}>School</Table.Th>
                    <Table.Th style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>Phone</Table.Th>
                    <Table.Th style={{ width: '130px', minWidth: '130px', textAlign: 'center' }}>Parent Phone</Table.Th>
                    <Table.Th style={{ width: '100px', minWidth: '100px', textAlign: 'center' }}>Attendance Week</Table.Th>
                    <Table.Th style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>Main Center</Table.Th>
                    <Table.Th style={{ width: '140px', minWidth: '140px', textAlign: 'center' }}>Attendance Info</Table.Th>
                    <Table.Th style={{ width: '100px', minWidth: '100px', textAlign: 'center' }}>HW Status</Table.Th>
                    <Table.Th style={{ width: '100px', minWidth: '100px', textAlign: 'center' }}>Quiz Degree</Table.Th>
                    <Table.Th style={{ width: '160px', minWidth: '160px', textAlign: 'center' }}>Main Comment</Table.Th>
                    <Table.Th style={{ width: '160px', minWidth: '160px', textAlign: 'center' }}>Week Comment</Table.Th>
                    <Table.Th style={{ width: '100px', minWidth: '100px', textAlign: 'center' }}>Message State</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                    {paginatedRecords.map(({ student, record, key }) => (
                      <Table.Tr key={key}>
                        <Table.Td style={{ fontWeight: 'bold', color: '#1FA8DC', width: '60px', minWidth: '60px', textAlign: 'center' }}>{student.id}</Table.Td>
                        <Table.Td style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>{student.name}</Table.Td>
                        <Table.Td style={{ width: '100px', minWidth: '100px', textAlign: 'center' }}>{student.grade || 'N/A'}</Table.Td>
                        <Table.Td style={{ width: '180px', minWidth: '180px', wordWrap: 'break-word', textAlign: 'center' }}>{student.school || 'N/A'}</Table.Td>
                        <Table.Td style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>{student.phone || 'N/A'}</Table.Td>
                        <Table.Td style={{ width: '130px', minWidth: '130px', textAlign: 'center' }}>{student.parentsPhone || 'N/A'}</Table.Td>
                        <Table.Td style={{ width: '100px', minWidth: '100px', textAlign: 'center' }}>
                          {(() => {
                            const week = record.week || 1; // Default to week 1 if not present
                            return `week ${String(week).padStart(2, '0')}`;
                          })()}
                        </Table.Td>
                        <Table.Td style={{ width: '120px', minWidth: '120px', textAlign: 'center' }}>{record.main_center || 'N/A'}</Table.Td>
                        <Table.Td style={{ width: '140px', minWidth: '140px', textAlign: 'center' }}>{record.attendanceDate || 'N/A'}</Table.Td>
                        <Table.Td style={{ width: '100px', minWidth: '100px', textAlign: 'center' }}>
                          {(() => {
                            if (record.hwDone === "No Homework") {
                              return <span style={{ 
                                color: '#dc3545',
                                fontWeight: 'bold'
                              }}>🚫 No Homework</span>;
                            } else if (record.hwDone === "Not Completed") {
                              return <span style={{ 
                                color: '#856404',
                                fontWeight: 'bold'
                              }}>⚠️ Not Completed</span>;
                            } else if (record.hwDone === true) {
                              // Show homework degree if it exists
                              const hwDegree = record.hwDegree;
                              if (hwDegree && String(hwDegree).trim() !== '') {
                                return <span style={{ 
                                  color: '#28a745',
                                  fontWeight: 'bold'
                                }}>✅ Done ({hwDegree})</span>;
                              }
                              return <span style={{ 
                                color: '#28a745',
                                fontWeight: 'bold'
                              }}>✅ Done</span>;
                            } else {
                              return <span style={{ 
                                color: '#dc3545',
                                fontWeight: 'bold'
                              }}>❌ Not Done</span>;
                            }
                          })()}
                        </Table.Td>
                        
                        <Table.Td style={{ width: '100px', minWidth: '100px', textAlign: 'center' }}>
                          {(() => {
                            const value = (record.quizDegree !== undefined && record.quizDegree !== null && record.quizDegree !== '') ? record.quizDegree : '0/0';
                            if (value === "Didn't Attend The Quiz") {
                              return <span style={{ color: '#dc3545', fontWeight: 'bold' }}>✗ Didn't Attend The Quiz</span>;
                            } else if (value === "No Quiz") {
                              return <span style={{ color: '#dc3545', fontWeight: 'bold' }}>🚫 No Quiz</span>;
                            }
                            return value;
                          })()}
                        </Table.Td>
                        <Table.Td style={{ width: '160px', minWidth: '160px', textAlign: 'center' }}>
                          {(() => {
                            try {
                              const mainComment = (student.main_comment ?? '').toString();
                              return mainComment.trim() !== '' ? mainComment : 'No Comment';
                            } catch {
                              return 'No Comment';
                            }
                          })()}
                        </Table.Td>
                        <Table.Td style={{ width: '160px', minWidth: '160px', textAlign: 'center' }}>
                          {(() => {
                            try {
                              const weekIndex = ((record?.week ?? 0) - 1);
                              const weekComment = (Array.isArray(student.weeks) && weekIndex >= 0)
                                ? (student.weeks[weekIndex]?.comment ?? '').toString()
                                : '';
                              return weekComment.trim() !== '' ? weekComment : 'No Comment';
                            } catch {
                              return 'No Comment';
                            }
                          })()}
                        </Table.Td>
                        <Table.Td style={{ width: '100px', minWidth: '100px', textAlign: 'center' }}>
                          <span style={{ 
                            color: record.message_state ? '#28a745' : '#dc3545',
                            fontWeight: 'bold'
                          }}>
                            {record.message_state ? '✓ Sent' : '✗ Not Sent'}
                          </span>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
              
              {/* Pagination Controls */}
              {allHistoryRecords.length > 0 && (
                <div className="pagination-container">
                  <button
                    className="pagination-button"
                    onClick={handlePrevPage}
                    disabled={!pagination.hasPrevPage}
                    aria-label="Previous page"
                  >
                    <IconChevronLeft size={20} stroke={2} />
                  </button>
                  
                  <div 
                    className={`pagination-page-info ${pagination.totalPages > 1 ? 'clickable' : ''}`}
                    onClick={() => pagination.totalPages > 1 && setShowPagePopup(!showPagePopup)}
                    style={{ position: 'relative', cursor: pagination.totalPages > 1 ? 'pointer' : 'default' }}
                  >
                    Page {pagination.currentPage} of {pagination.totalPages}
                    
                    {/* Page Number Popup */}
                    {showPagePopup && pagination.totalPages > 1 && (
                      <div className="page-popup">
                        <div className="page-popup-content">
                          <div className="page-popup-header">Select Page</div>
                          <div className="page-popup-grid">
                            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(pageNum => (
                              <button
                                key={pageNum}
                                className={`page-number-btn ${pageNum === pagination.currentPage ? 'active' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePageClick(pageNum);
                                }}
                              >
                                {pageNum}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <button
                    className="pagination-button"
                    onClick={handleNextPage}
                    disabled={!pagination.hasNextPage}
                    aria-label="Next page"
                  >
                    <IconChevronRight size={20} stroke={2} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 