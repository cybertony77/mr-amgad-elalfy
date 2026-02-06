import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Title from "../../components/Title";
import { Table, ScrollArea } from '@mantine/core';
import { IconArrowRight, IconSearch, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { ActionIcon, TextInput, useMantineTheme } from '@mantine/core';
import styles from '../../styles/TableScrollArea.module.css';
import { useAssistantsPaginated } from '../../lib/api/assistants';
import LoadingSkeleton from '../../components/LoadingSkeleton';

// Removed token-based checks; authentication is handled globally in _app.js

export function InputWithButton({ onButtonClick, onKeyDown, ...props }) {
  const theme = useMantineTheme();
  
  const handleKeyDown = (e) => {
    // Call the provided onKeyDown handler
    if (onKeyDown) {
      onKeyDown(e);
    }
    // Also call onKeyDown from props if provided
    if (props.onKeyDown) {
      props.onKeyDown(e);
    }
  };
  
  return (
    <TextInput
      radius="xl"
      size="md"
      placeholder="Search by Username or Name"
      rightSectionWidth={42}
      leftSection={<IconSearch size={18} stroke={1.5} />}
      rightSection={
        <ActionIcon 
          size={32} 
          radius="xl" 
          color={theme.primaryColor} 
          variant="filled"
          onClick={onButtonClick}
          style={{ cursor: 'pointer' }}
          aria-label="Search"
        >
          <IconArrowRight size={18} stroke={1.5} />
        </ActionIcon>
      }
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

export default function AllAssistants() {
  const router = useRouter();
  const containerRef = useRef(null);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [searchInput, setSearchInput] = useState(""); // What user types in the input
  const [searchTerm, setSearchTerm] = useState(""); // Actual search term used in API query
  const [isMobile, setIsMobile] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100; // Display 100 assistants per page
  const [showPagePopup, setShowPagePopup] = useState(false);

  // React Query hook for fetching paginated assistants
  const { data: assistantsResponse, isLoading, error, refetch } = useAssistantsPaginated({
    page: currentPage,
    limit: pageSize,
    search: searchTerm.trim() || undefined,
    sortBy: 'id',
    sortOrder: 'asc',
  }, {
    // Optimized settings for large datasets
    refetchInterval: 60 * 1000, // Refetch every 60 seconds
    refetchIntervalInBackground: false, // Don't refetch when tab is not active
    refetchOnWindowFocus: true, // Immediate update when switching back to tab
    staleTime: 2 * 60 * 1000, // Consider data stale after 2 minutes
  });

  // Extract assistants array and pagination info from response
  const assistantsRaw = assistantsResponse?.data || [];
  // Only include supported roles
  const assistants = assistantsRaw.filter(a =>
    ['admin', 'assistant', 'developer'].includes(a.role)
  );
  const pagination = assistantsResponse?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Reset to page 1 when search term becomes empty
  useEffect(() => {
    if (searchTerm === "") {
      setCurrentPage(1);
    }
  }, [searchTerm]);

  // Automatically reset search and go to page 1 when search input is cleared
  useEffect(() => {
    if (searchInput.trim() === "" && searchTerm !== "") {
      // If input is cleared but search term still has value, automatically clear search
      setSearchTerm("");
      setCurrentPage(1);
    }
  }, [searchInput, searchTerm]);

  // Handle search button click
  const handleSearch = () => {
    const trimmedSearch = searchInput.trim();
    setSearchTerm(trimmedSearch);
    setCurrentPage(1); // Reset to first page when searching
  };

  // Handle Enter key press in search input
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  // Handle pagination navigation
  const handlePreviousPage = () => {
    if (pagination.hasPrevPage) {
      setCurrentPage(prev => Math.max(1, prev - 1));
      // Scroll to top of table
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      setCurrentPage(prev => prev + 1);
      // Scroll to top of table
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Handle page number click from popup
  const handlePageClick = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= pagination.totalPages) {
      setCurrentPage(pageNumber);
      setShowPagePopup(false);
      // Scroll to top of table
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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

  useEffect(() => {
    // Authentication is now handled by _app.js with HTTP-only cookies
    // This component will only render if user is authenticated
    
    // Check if mobile
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  }, [router]);

  // Note: Filtering is now handled server-side via API parameters
  // The assistants array already contains the filtered results for the current page

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

  // Auto-refresh assistants data every 60 seconds (reduced frequency for large datasets)
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 60000); // 60 seconds
    
    return () => clearInterval(interval);
  }, [refetch]);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{ 
          width: "100%", 
          maxWidth: "900px",
          padding: "0 10px"
        }}>
          <LoadingSkeleton />
        </div>
        <style jsx>{`
          @media (max-width: 768px) {
            div[style*="padding: 20px 10px"] {
              padding: 15px 8px !important;
            }
            div[style*="maxWidth: 900px"] {
              padding: 0 5px !important;
              maxWidth: 100% !important;
            }
          }
          
          @media (max-width: 480px) {
            div[style*="padding: 20px 10px"] {
              padding: 10px 5px !important;
            }
            div[style*="maxWidth: 900px"] {
              padding: 0 !important;
              maxWidth: 100% !important;
            }
          }
          
          @media (max-width: 360px) {
            div[style*="padding: 20px 10px"] {
              padding: 8px 3px !important;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div ref={containerRef} style={{ maxWidth: 800, margin: "40px auto", padding: "12px" }}>
        <Title 
          backText="Back" 
          href="/manage_assistants" 
          backButtonStyle={{
            background: 'linear-gradient(90deg, rgb(108, 117, 125) 0%, rgb(73, 80, 87) 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: '0.3s',
            boxShadow: 'rgba(0, 0, 0, 0.2) 0px 4px 16px',
            fontSize: 15,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginLeft: 25
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/users.svg" alt="All Assistants" width={32} height={32} />
            All Assistants
          </div>
        </Title>
        {/* Search Bar */}
        <div style={{ marginBottom: 20 }}>
          <InputWithButton
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            onButtonClick={handleSearch}
          />
        </div>
        <div className="history-container">
          <div className="history-title">
            All Assistants ({pagination.totalCount} records)
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
              {error.message || "Failed to fetch assistants data"}
            </div>
          )}
          {assistants.length === 0 ? (
            <div className="no-results">
              {searchTerm
                ? "❌ No assistants found with the search term."
                : "❌ No assistants found."
              }
            </div>
          ) : (
            <ScrollArea h={400} type="hover" className={styles.scrolled}>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa' }}>
                  <Table.Tr>
                    <Table.Th style={{ width: '10%', textAlign: 'center' }}>Username</Table.Th>
                    <Table.Th style={{ width: '15%', textAlign: 'center' }}>Name</Table.Th>
                    <Table.Th style={{ width: '15%', textAlign: 'center' }}>Phone Number</Table.Th>
                    <Table.Th style={{ width: '18%', textAlign: 'center' }}>Email</Table.Th>
                    <Table.Th style={{ width: '12%', textAlign: 'center' }}>Role</Table.Th>
                    <Table.Th style={{ width: '12%', textAlign: 'center' }}>Account Status</Table.Th>
                    <Table.Th style={{ width: '18%', textAlign: 'center' }}>Added to Contact Assistants Page</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {assistants.map(assistant => (
                    <Table.Tr key={assistant.id}>
                      <Table.Td style={{ fontWeight: 'bold', color: '#1FA8DC', textAlign: 'center' }}>{assistant.id}</Table.Td>
                      <Table.Td style={{ fontWeight: '600', textAlign: 'center' }}>{assistant.name}</Table.Td>
                      <Table.Td style={{ fontFamily: 'monospace', fontSize: '0.9rem', textAlign: 'center' }}>{assistant.phone}</Table.Td>
                      <Table.Td style={{ 
                        fontSize: '0.9rem', 
                        textAlign: 'center', 
                        color: assistant.email ? '#495057' : '#6c757d',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        maxWidth: '18%'
                      }}>
                        {assistant.email || 'No Email'}
                      </Table.Td>
                      <Table.Td style={{ 
                        fontWeight: '600',
                        color: assistant.role === 'admin' ? '#dc3545' : (assistant.role === 'developer' ? '#28a745' : (assistant.role === 'assistant' ? '#3175b1' : '#6c757d')),
                        textAlign: 'center'
                      }}>{assistant.role}</Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        {assistant.account_state === 'Deactivated' ? (
                          <span style={{ color: '#dc3545', fontWeight: 'bold' }}>❌ Deactivated</span>
                        ) : (
                          <span style={{ color: '#28a745', fontWeight: 'bold' }}>✅ Activated</span>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        {assistant.ATCA === 'yes' ? (
                          <span style={{ color: '#28a745', fontWeight: 'bold' }}>✅ Yes</span>
                        ) : (
                          <span style={{ color: '#dc3545', fontWeight: 'bold' }}>❌ No</span>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
          
          {/* Pagination Controls */}
          {pagination.totalCount > 0 && (
            <div className="pagination-container">
              <button
                className="pagination-button"
                onClick={handlePreviousPage}
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
        </div>
        <style jsx>{`
          .history-container {
            background: white;
            border-radius: 16px;
            padding: 24px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            overflow-x: auto;
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
          .phone-number {
            font-family: monospace;
            font-size: 0.9rem;
          }
          .role-admin {
            color: #dc3545; /* Red for admin */
          }
          .role-assistant {
            color: #28a745; /* Green for assistant */
          }
          
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
            transition: all 0.3s ease;
            font-weight: 600;
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
            z-index: 1000;
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
          
          @media (max-width: 768px) {
            .history-container {
              padding: 16px;
            }
            .history-title {
              font-size: 1.3rem;
            }
          }
          
          @media (max-width: 480px) {
            .history-container {
              padding: 12px;
            }
            .history-title {
              font-size: 1.2rem;
            }
            
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
      </div>
    </div>
  );
} 