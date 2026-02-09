import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from "../../../components/Title";
import { Table, ScrollArea } from '@mantine/core';
import { IconArrowRight, IconSearch, IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { ActionIcon, TextInput, useMantineTheme } from '@mantine/core';
import styles from '../../../styles/TableScrollArea.module.css';
import { useVACPaginated } from '../../../lib/api/vac';
import LoadingSkeleton from '../../../components/LoadingSkeleton';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../lib/axios';

export function InputWithButton({ onButtonClick, onKeyDown, ...props }) {
  const theme = useMantineTheme();
  
  const handleKeyDown = (e) => {
    if (onKeyDown) {
      onKeyDown(e);
    }
    if (props.onKeyDown) {
      props.onKeyDown(e);
    }
  };
  
  return (
    <TextInput
      radius="xl"
      size="md"
      placeholder="Search by Name or ID"
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

export default function VerificationAccountsCodes() {
  const router = useRouter();
  const containerRef = useRef(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;
  const [showPagePopup, setShowPagePopup] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const [selectedVacForDelete, setSelectedVacForDelete] = useState(null);
  const [regenerateError, setRegenerateError] = useState('');
  const [regenerateSuccess, setRegenerateSuccess] = useState('');
  const [generateType, setGenerateType] = useState('single'); // 'single' or 'many'
  const [formData, setFormData] = useState({
    account_id: '',
    from: '',
    to: ''
  });
  const [errors, setErrors] = useState({});
  const [idChecking, setIdChecking] = useState(false);
  const [idExists, setIdExists] = useState(null);
  const [copiedCodeId, setCopiedCodeId] = useState(null); // Track which code was copied
  const [systemName, setSystemName] = useState('Mr. Amgad El-Alfy Math Academy');
  const [studentSignupVideo, setStudentSignupVideo] = useState('');

  // Fetch config on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config');
        if (response.ok) {
          const config = await response.json();
          setSystemName(config.SYSTEM_NAME || 'Mr. Amgad El-Alfy Math Academy');
          setStudentSignupVideo(config.STUDENT_SIGNUP_VIDEO || '');
        }
      } catch (error) {
        console.error('Failed to load config:', error);
      }
    };
    fetchConfig();
  }, []);

  // React Query hook for fetching paginated VACs
  const { data: vacResponse, isLoading, error, refetch } = useVACPaginated({
    page: currentPage,
    limit: pageSize,
    search: searchTerm.trim() || undefined,
    sortBy: 'account_id',
    sortOrder: 'asc',
  }, {
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 2 * 60 * 1000,
  });

  // Extract VACs array and pagination info from response
  const vacs = vacResponse?.data || [];
  const pagination = vacResponse?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const queryClient = useQueryClient();

  // Check if account_id exists in VAC collection
  const checkAccountId = async (accountId) => {
    if (!accountId || accountId.trim() === '') {
      setIdExists(null);
      return;
    }

    const idNum = parseInt(accountId);
    if (isNaN(idNum) || idNum < 1) {
      setIdExists(false);
      return;
    }

    setIdChecking(true);
    try {
      const response = await apiClient.get(`/api/vac?page=1&limit=1&search=${idNum}`);
      const vacs = response.data?.data || [];
      const exists = vacs.some(vac => vac.account_id === idNum);
      setIdExists(exists);
    } catch (error) {
      setIdExists(null);
    } finally {
      setIdChecking(false);
    }
  };

  // Generate VAC mutation
  const generateVACMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post('/api/vac/generate', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['vac']);
      refetch();
      setShowAddPopup(false);
      setFormData({ account_id: '', from: '', to: '' });
      setGenerateType('single');
      setErrors({});
      setIdExists(null);
      
      // Only show success message if a new VAC was actually created
      // For single generation: only show success if existed: false
      // For many generation: show success if any new VACs were created
      if (data.existed === false || (data.created && data.created > 0)) {
        let message = data.message || 'VAC generated successfully';
        if (data.alreadyExistedMessage) {
          message += `. ${data.alreadyExistedMessage}`;
        }
        setRegenerateSuccess(message);
        setRegenerateError('');
        setTimeout(() => setRegenerateSuccess(''), 6000);
      } else {
        // If it was just a regeneration (existed: true), don't show success
        // Just close the popup silently
        setRegenerateSuccess('');
        setRegenerateError('');
      }
    },
    onError: (error) => {
      setRegenerateError(error.response?.data?.error || error.message || 'Error generating VAC');
      setRegenerateSuccess('');
      setTimeout(() => setRegenerateError(''), 6000);
    },
  });

  // Regenerate VAC mutation
  const regenerateMutation = useMutation({
    mutationFn: async (account_id) => {
      const response = await apiClient.post('/api/vac/regenerate', { account_id });
      return response.data;
    },
    onSuccess: () => {
      // Refetch the VAC data to update the table
      queryClient.invalidateQueries(['vac']);
      refetch();
      setShowConfirmModal(false);
      setSelectedAccountId(null);
      setRegenerateSuccess('VAC regenerated successfully!');
      setRegenerateError('');
      // Auto-hide success message after 6 seconds
      setTimeout(() => setRegenerateSuccess(''), 6000);
    },
    onError: (error) => {
      setRegenerateError(error.response?.data?.error || error.message || 'Error regenerating VAC');
      setRegenerateSuccess('');
      // Auto-hide error message after 6 seconds
      setTimeout(() => setRegenerateError(''), 6000);
    },
  });

  // Delete VAC mutation
  const deleteVACMutation = useMutation({
    mutationFn: async (account_id) => {
      const response = await apiClient.delete(`/api/vac?account_id=${account_id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vac']);
      refetch();
      setShowDeleteModal(false);
      setSelectedVacForDelete(null);
      setRegenerateSuccess('VAC deleted successfully!');
      setRegenerateError('');
      setTimeout(() => setRegenerateSuccess(''), 6000);
    },
    onError: (error) => {
      setRegenerateError(error.response?.data?.error || error.message || 'Error deleting VAC');
      setRegenerateSuccess('');
      setTimeout(() => setRegenerateError(''), 6000);
    },
  });

  // Reset to page 1 when search term changes
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
      setSearchTerm("");
      setCurrentPage(1);
    }
  }, [searchInput, searchTerm]);

  // Handle search button click
  const handleSearch = () => {
    const trimmedSearch = searchInput.trim();
    setSearchTerm(trimmedSearch);
    setCurrentPage(1);
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
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleNextPage = () => {
    if (pagination.hasNextPage) {
      setCurrentPage(prev => prev + 1);
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
      if (containerRef.current) {
        containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Handle copy code
  const handleCopyCode = async (code, codeId) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCodeId(codeId);
      setTimeout(() => setCopiedCodeId(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy code:', err);
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

  // Auto-refresh data every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 60000);
    
    return () => clearInterval(interval);
  }, [refetch]);

  // Handle add VAC
  const handleAddVAC = () => {
    setShowAddPopup(true);
    setFormData({ account_id: '', from: '', to: '' });
    setGenerateType('single');
    setErrors({});
    setIdExists(null);
    setRegenerateError('');
    setRegenerateSuccess('');
  };

  // Handle form submit (generate)
  const handleGenerateSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (generateType === 'single') {
      if (!formData.account_id || parseInt(formData.account_id) < 1) {
        newErrors.account_id = '❌ Student ID is required and must be at least 1';
      }
    } else {
      if (!formData.from || parseInt(formData.from) < 1) {
        newErrors.from = '❌ From is required and must be at least 1';
      }
      if (!formData.to || parseInt(formData.to) < 1) {
        newErrors.to = '❌ To is required and must be at least 1';
      }
      if (formData.from && formData.to && parseInt(formData.from) > parseInt(formData.to)) {
        newErrors.to = '❌ To must be greater than or equal to From';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (generateType === 'single') {
      generateVACMutation.mutate({
        type: 'single',
        account_id: parseInt(formData.account_id)
      });
    } else {
      generateVACMutation.mutate({
        type: 'many',
        from: parseInt(formData.from),
        to: parseInt(formData.to)
      });
    }
  };

  // Handle regenerate VAC button click
  const handleRegenerateVACClick = (account_id) => {
    setSelectedAccountId(account_id);
    setShowConfirmModal(true);
    setRegenerateError('');
    setRegenerateSuccess('');
  };

  // Handle confirm regenerate
  const handleConfirmRegenerate = () => {
    if (selectedAccountId) {
      regenerateMutation.mutate(selectedAccountId);
    }
  };

  // Handle delete VAC
  const handleDeleteVAC = (vac) => {
    setSelectedVacForDelete(vac);
    setShowDeleteModal(true);
    setRegenerateError('');
    setRegenerateSuccess('');
  };

  // Handle confirm delete
  const handleConfirmDelete = () => {
    if (selectedVacForDelete) {
      deleteVACMutation.mutate(selectedVacForDelete.account_id);
    }
  };

  // Handle WhatsApp send
  const handleSendWhatsApp = (vac) => {
    if (!vac.phone) {
      alert('Student phone number not available');
      return;
    }

    // Extract first name from full name
    const firstName = vac.name ? vac.name.split(' ')[0] : 'Student';
    
    // Get current domain from URL
    const domain = typeof window !== 'undefined' ? window.location.origin : '';
    const signUpUrl = `${domain}/sign-up`;

    // Create the message
    let message = `Dear Student, ${firstName}
This is Your Verification Account Code (VAC) :

*${vac.VAC}*

Please do not share this code with anyone.
To complete your sign-up, click the link below:

🖇 ${signUpUrl}`;

    // Add video link if STUDENT_SIGNUP_VIDEO is not empty
    if (studentSignupVideo && studentSignupVideo.trim() !== '') {
      message += `\n\n🎥 View this video to know how to sign up : ${studentSignupVideo}`;
    }

    message += `\n\nNote :- 
   • Your ID : ${vac.account_id}

Best regards
 – ${systemName}`;

    // Use phone number as stored in DB
    let phoneNumber = vac.phone.replace(/[^0-9]/g, '');
    
    // Validate phone number exists
    if (!phoneNumber || phoneNumber.length < 3) {
      alert('Invalid phone number format');
      return;
    }
    
    // Validate country code: if number starts with 012, 011, 010, or 015, allow without country code
    // Otherwise, require country code (starts with 20 for Egypt)
    const startsWithEgyptPrefix = phoneNumber.startsWith('012') || 
                                   phoneNumber.startsWith('011') || 
                                   phoneNumber.startsWith('010') || 
                                   phoneNumber.startsWith('015');
    
    const hasCountryCode = phoneNumber.startsWith('20');
    
    if (!startsWithEgyptPrefix && !hasCountryCode) {
      alert('Country code required. Please add country code (e.g., 20 for Egypt)');
      return;
    }
    
    // If number starts with 012/011/010/015, remove first 0 and prepend 20 (Egypt country code)
    if (startsWithEgyptPrefix && !hasCountryCode) {
      phoneNumber = '20' + phoneNumber.substring(1); // Remove first 0
    }
    
    // Create WhatsApp URL
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    
    // Open WhatsApp in a new tab
    window.open(whatsappUrl, '_blank');
  };

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <Title href="/dashboard/manage_online_system" backText="Back">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/lock-cog.svg" alt="VAC" width={32} height={32} />
              Verification Accounts Codes
            </div>
          </Title>
          <LoadingSkeleton type="table" rows={8} columns={4} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div ref={containerRef} style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
        <Title href="/dashboard/manage_online_system" backText="Back">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/lock-cog.svg" alt="VAC" width={32} height={32} />
            Verification Accounts Codes
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
          <div className="title-button-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
            <div className="title-spacer" style={{ flex: 1 }}></div>
            <div className="history-title" style={{ marginBottom: 0, flex: 1, textAlign: 'center' }}>
              Verification Accounts Codes ({pagination.totalCount} records)
            </div>
            <div className="add-button-wrapper" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              {/* Add Button */}
              <button
                className="add-vac-btn"
                onClick={handleAddVAC}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#1FA8DC',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 2px 8px rgba(31, 168, 220, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#1FA8DC';
                }}
              >
                <Image src="/plus.svg" alt="Add" width={23} height={23} style={{ marginRight: '6px', display: 'inline-block' }} />
                Add VAC
              </button>
            </div>
          </div>
          {vacs.length === 0 ? (
            <div className="no-results">
              {searchTerm
                ? "❌ No verification accounts codes found with the search term."
                : "❌ No verification accounts codes found."
              }
            </div>
          ) : (
            <ScrollArea h={400} type="hover" className={styles.scrolled}>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa'}}>
                  <Table.Tr>
                    <Table.Th style={{ width: '10%', textAlign: 'center' }}>ID</Table.Th>
                    <Table.Th style={{ width: '20%', textAlign: 'center' }}>Name</Table.Th>
                    <Table.Th style={{ width: '8%', textAlign: 'center' }}>Copy</Table.Th>
                    <Table.Th style={{ width: '15%', textAlign: 'center' }}>VAC</Table.Th>
                    <Table.Th style={{ width: '15%', textAlign: 'center' }}>VAC State</Table.Th>
                    <Table.Th style={{ width: '20%', textAlign: 'center' }}>Regenerate VAC</Table.Th>
                    <Table.Th style={{ width: '20%', textAlign: 'center' }}>Send To Student</Table.Th>
                    <Table.Th style={{ width: '10%', textAlign: 'center' }}>Delete</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {vacs.map((vac, index) => (
                    <Table.Tr key={`${vac.account_id}-${index}`}>
                      <Table.Td style={{ fontWeight: 'bold', color: '#1FA8DC', textAlign: 'center' }}>{vac.account_id}</Table.Td>
                      <Table.Td style={{ fontWeight: '600', textAlign: 'center' }}>
                        {vac.name ? (
                          vac.name
                        ) : (
                          <span style={{ color: '#dc3545', fontStyle: 'italic' }}>Not Exist Yet!</span>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleCopyCode(vac.VAC, vac.account_id?.toString() || vac._id?.toString())}
                          style={{
                            padding: '6px',
                            backgroundColor: copiedCodeId === (vac.account_id?.toString() || vac._id?.toString()) ? '#28a745' : '#d71d1d',
                            border: copiedCodeId === (vac.account_id?.toString() || vac._id?.toString()) ? '1px solid #28a745' : '1px solid #d71d1d',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease',
                            minWidth: '36px',
                            minHeight: '36px'
                          }}
                          onMouseEnter={(e) => {
                            if (copiedCodeId !== (vac.account_id?.toString() || vac._id?.toString())) {
                              e.target.style.borderColor = '#b91c1c';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (copiedCodeId !== (vac.account_id?.toString() || vac._id?.toString())) {
                              e.target.style.borderColor = '#d71d1d';
                            }
                          }}
                          title={copiedCodeId === (vac.account_id?.toString() || vac._id?.toString()) ? 'Copied!' : 'Copy code'}
                        >
                          <Image 
                            src="/copy2.svg" 
                            alt="Copy" 
                            width={18} 
                            height={18} 
                            style={{ display: 'inline-block' }} 
                          />
                        </button>
                      </Table.Td>
                      <Table.Td style={{ fontFamily: 'monospace', fontSize: '0.9rem', textAlign: 'center' }}>{vac.VAC}</Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        {vac.VAC_activated ? (
                          <span style={{ color: '#28a745', fontWeight: 'bold' }}>✅ Activated</span>
                        ) : (
                          <span style={{ color: '#dc3545', fontWeight: 'bold' }}>❌ Not Activated Yet!</span>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleRegenerateVACClick(vac.account_id)}
                          disabled={regenerateMutation.isLoading}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#1FA8DC',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: regenerateMutation.isLoading ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            opacity: regenerateMutation.isLoading ? 0.6 : 1,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            margin: '0 auto'
                          }}
                          onMouseLeave={(e) => {
                            if (!regenerateMutation.isLoading) {
                              e.target.style.backgroundColor = '#1FA8DC';
                            }
                          }}
                        >
                          <Image src="/refresh.svg" alt="Regenerate" width={18} height={18} style={{ display: 'inline-block' }} />
                          regenerate
                        </button>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        {vac.phone ? (
                          <button
                            onClick={() => handleSendWhatsApp(vac)}
                            style={{
                              backgroundColor: '#25D366',
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 12px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: '500',
                              transition: 'background-color 0.2s',
                              margin: '0 auto'
                            }}
                          >
                            <Image src="/whatsapp.svg" alt="WhatsApp" width={25} height={25} style={{ display: 'inline-block' }} />
                            Send
                          </button>
                        ) : (
                          <span style={{ color: '#6c757d', fontStyle: 'italic', fontSize: '0.85rem' }}>No phone</span>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <button
                          className="delete-vac-btn"
                          onClick={() => handleDeleteVAC(vac)}
                          disabled={deleteVACMutation.isLoading}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: deleteVACMutation.isLoading ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            opacity: deleteVACMutation.isLoading ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                        >
                          <Image src="/trash2.svg" alt="Delete" width={18} height={18} style={{ display: 'inline-block' }} />
                          Delete
                        </button>
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

          {/* Success and Error Messages - at bottom */}
          {regenerateSuccess && (
            <div style={{
              background: '#d4edda',
              color: '#155724',
              borderRadius: 10,
              padding: 16,
              marginTop: 24,
              textAlign: 'center',
              fontWeight: 600,
              border: '1.5px solid #c3e6cb',
              fontSize: '1.1rem',
              boxShadow: '0 4px 16px rgba(40, 167, 69, 0.08)'
            }}>
              ✅ {regenerateSuccess}
            </div>
          )}
          {regenerateError && (
            <div style={{
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: 10,
              padding: 16,
              marginTop: regenerateSuccess ? 12 : 24,
              textAlign: 'center',
              fontWeight: 600,
              border: '1.5px solid #fca5a5',
              fontSize: '1.1rem',
              boxShadow: '0 4px 16px rgba(220, 53, 69, 0.08)'
            }}>
              ❌ {regenerateError}
            </div>
          )}
          {error && (
            <div style={{
              background: '#fee2e2',
              color: '#991b1b',
              borderRadius: 10,
              padding: 16,
              marginTop: (regenerateSuccess || regenerateError) ? 12 : 24,
              textAlign: 'center',
              fontWeight: 600,
              border: '1.5px solid #fca5a5',
              fontSize: '1.1rem',
              boxShadow: '0 4px 16px rgba(220, 53, 69, 0.08)'
            }}>
              {error.message || "Failed to fetch VAC data"}
            </div>
          )}
        </div>

        {/* Add VAC Popup */}
        {showAddPopup && (
          <div className="confirm-modal">
            <div className="confirm-content" style={{ maxWidth: '500px', width: '90%', textAlign: 'left' }}>
              <h3 style={{ textAlign: 'center' }}>Add New VAC</h3>
              <form onSubmit={handleGenerateSubmit}>
                {/* Radio buttons for generation type */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', textAlign: 'left' }}>
                    Generation Type <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: generateType === 'single' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: generateType === 'single' ? '#f0f8ff' : 'white' }}>
                      <input
                        type="radio"
                        name="generateType"
                        value="single"
                        checked={generateType === 'single'}
                        onChange={(e) => {
                          setGenerateType(e.target.value);
                          setFormData({ account_id: '', from: '', to: '' });
                          setErrors({});
                          setIdExists(null);
                        }}
                        style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>Single Generate</span>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', padding: '10px', borderRadius: '8px', border: generateType === 'many' ? '2px solid #1FA8DC' : '2px solid #e9ecef', backgroundColor: generateType === 'many' ? '#f0f8ff' : 'white' }}>
                      <input
                        type="radio"
                        name="generateType"
                        value="many"
                        checked={generateType === 'many'}
                        onChange={(e) => {
                          setGenerateType(e.target.value);
                          setFormData({ account_id: '', from: '', to: '' });
                          setErrors({});
                          setIdExists(null);
                        }}
                        style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: '500' }}>Many Generate</span>
                    </label>
                  </div>
                </div>

                {/* Single Generate - Student ID Input */}
                {generateType === 'single' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                      Student ID <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.account_id}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData({ ...formData, account_id: value });
                        setErrors({ ...errors, account_id: '' });
                        if (value) {
                          checkAccountId(value);
                        } else {
                          setIdExists(null);
                        }
                      }}
                      placeholder="Enter Student ID"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: errors.account_id ? '2px solid #dc3545' : (idExists === true ? '2px solid #dc3545' : '2px solid #e9ecef'),
                        borderRadius: '10px',
                        fontSize: '1rem',
                        transition: 'border-color 0.3s ease'
                      }}
                    />
                    {idChecking && (
                      <div style={{ color: '#6c757d', fontSize: '0.875rem', marginTop: '4px' }}>
                        Checking...
                      </div>
                    )}
                    {!idChecking && idExists === true && (
                      <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px', fontWeight: '600' }}>
                        ❌ This ID already has a VAC code. It will be regenerated.
                      </div>
                    )}
                    {!idChecking && idExists === false && formData.account_id && (
                      <div style={{ color: '#28a745', fontSize: '0.875rem', marginTop: '4px', fontWeight: '600' }}>
                        ✅ This ID is available for VAC generation.
                      </div>
                    )}
                    {errors.account_id && (
                      <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                        {errors.account_id}
                      </div>
                    )}
                  </div>
                )}

                {/* Many Generate - From and To Inputs */}
                {generateType === 'many' && (
                  <>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                        From <span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.from}
                        onChange={(e) => {
                          setFormData({ ...formData, from: e.target.value });
                          setErrors({ ...errors, from: '' });
                        }}
                        placeholder="Enter starting ID"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: errors.from ? '2px solid #dc3545' : '2px solid #e9ecef',
                          borderRadius: '10px',
                          fontSize: '1rem',
                          transition: 'border-color 0.3s ease'
                        }}
                      />
                      {errors.from && (
                        <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                          {errors.from}
                        </div>
                      )}
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                        To <span style={{ color: 'red' }}>*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.to}
                        onChange={(e) => {
                          setFormData({ ...formData, to: e.target.value });
                          setErrors({ ...errors, to: '' });
                        }}
                        placeholder="Enter ending ID"
                        style={{
                          width: '100%',
                          padding: '12px 16px',
                          border: errors.to ? '2px solid #dc3545' : '2px solid #e9ecef',
                          borderRadius: '10px',
                          fontSize: '1rem',
                          transition: 'border-color 0.3s ease'
                        }}
                      />
                      {errors.to && (
                        <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                          {errors.to}
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'center' }}>
                  <button
                    type="submit"
                    disabled={generateVACMutation.isLoading}
                    style={{
                      background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontWeight: '600',
                      fontSize: '1rem',
                      cursor: generateVACMutation.isLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)',
                      opacity: generateVACMutation.isLoading ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!generateVACMutation.isLoading) {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 16px rgba(40, 167, 69, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!generateVACMutation.isLoading) {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)';
                      }
                    }}
                  >
                    {generateVACMutation.isLoading ? 'Generating...' : 'Generate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPopup(false);
                      setFormData({ account_id: '', from: '', to: '' });
                      setGenerateType('single');
                      setErrors({});
                      setIdExists(null);
                    }}
                    disabled={generateVACMutation.isLoading}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="confirm-modal">
            <div className="confirm-content">
              <h3>Confirm Regenerate VAC</h3>
              <p>Are you sure you want to regenerate the VAC code for ID <strong>{selectedAccountId}</strong>?</p>
              <div className="confirm-buttons">
                <button
                  onClick={handleConfirmRegenerate}
                  disabled={regenerateMutation.isLoading}
                  className="confirm-regenerate-btn"
                >
                  {regenerateMutation.isLoading ? "Regenerating..." : "Yes, Regenerate VAC"}
                </button>
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setSelectedAccountId(null);
                    setRegenerateError('');
                    setRegenerateSuccess('');
                  }}
                  disabled={regenerateMutation.isLoading}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && selectedVacForDelete && (
          <div className="confirm-modal">
            <div className="confirm-content">
              <h3>Confirm Delete VAC</h3>
              <p>Are you sure you want to delete VAC code <strong>{selectedVacForDelete.VAC}</strong> for ID <strong>{selectedVacForDelete.account_id}</strong>?</p>
              <div className="confirm-buttons">
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteVACMutation.isLoading}
                  className="confirm-regenerate-btn"
                >
                  {deleteVACMutation.isLoading ? "Deleting..." : "Yes, Delete VAC"}
                </button>
                <button
                  onClick={() => {
                    setShowDeleteModal(false);
                    setSelectedVacForDelete(null);
                    setRegenerateError('');
                    setRegenerateSuccess('');
                  }}
                  disabled={deleteVACMutation.isLoading}
                  className="cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

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
            .title-button-container {
              flex-direction: column;
              gap: 16px;
              align-items: stretch !important;
            }
            .title-spacer {
              display: none;
            }
            .add-button-wrapper {
              flex: none !important;
              justify-content: center !important;
            }
            .add-vac-btn {
              width: 100%;
            }
          }
          
          @media (max-width: 480px) {
            .history-container {
              padding: 12px;
            }
            .history-title {
              font-size: 1.2rem;
            }
            .title-button-container {
              marginBottom: 16px !important;
            }
            .add-vac-btn {
              padding: 10px 20px !important;
              font-size: 0.9rem !important;
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

          .confirm-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            backdrop-filter: blur(4px);
          }

          .confirm-content {
            background: #fff;
            border-radius: 16px;
            padding: 32px 24px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
            max-width: 450px;
            width: 90%;
            text-align: center;
          }

          .confirm-content h3 {
            font-size: 1.5rem;
            font-weight: 700;
            color: #495057;
            margin-bottom: 16px;
          }

          .confirm-content p {
            font-size: 1rem;
            color: #6c757d;
            margin-bottom: 8px;
            line-height: 1.5;
          }

          .confirm-buttons {
            display: flex;
            gap: 12px;
            margin-top: 24px;
            justify-content: center;
          }

          .confirm-regenerate-btn {
            background: linear-gradient(135deg, #1FA8DC 0%, #0d5a7a 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(31, 168, 220, 0.3);
          }

          .confirm-regenerate-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(31, 168, 220, 0.4);
          }

          .confirm-regenerate-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
          }

          .cancel-btn {
            background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
            color: white;
            border: none;
            border-radius: 8px;
            padding: 12px 24px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
          }

          .cancel-btn:hover:not(:disabled) {
            background: linear-gradient(135deg, #c82333 0%, #bd2130 100%);
            transform: translateY(-1px);
            box-shadow: 0 6px 16px rgba(220, 53, 69, 0.4);
          }

          .cancel-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
          }

          @media (max-width: 480px) {
            .confirm-content {
              padding: 24px 20px;
              max-width: 95%;
            }

            .confirm-content h3 {
              font-size: 1.3rem;
            }

            .confirm-buttons {
              flex-direction: column;
              gap: 10px;
            }

            .confirm-regenerate-btn,
            .cancel-btn {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

