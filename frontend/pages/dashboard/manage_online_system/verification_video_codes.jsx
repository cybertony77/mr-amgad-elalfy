import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from "../../../components/Title";
import { Table, ScrollArea } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconSearch, IconArrowRight } from '@tabler/icons-react';
import { ActionIcon, TextInput, useMantineTheme } from '@mantine/core';
import styles from '../../../styles/TableScrollArea.module.css';
import { useVVCPaginated } from '../../../lib/api/vvc';
import LoadingSkeleton from '../../../components/LoadingSkeleton';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSystemConfig } from '../../../lib/api/system';
import apiClient from '../../../lib/axios';
import AccountStateSelect from '../../../components/AccountStateSelect';
import ViewedSelect from '../../../components/ViewedSelect';
import PaymentStateSelect from '../../../components/PaymentStateSelect';

function InputWithButton(props) {
  const theme = useMantineTheme();
  return (
    <TextInput
      radius="xl"
      size="md"
      placeholder="Search by VVC code or Made By Who"
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

export default function VerificationVideoCodes() {
  const router = useRouter();
  const { data: systemConfig } = useSystemConfig();
  const isOnlineVideosEnabled = systemConfig?.online_videos === true || systemConfig?.online_videos === 'true';
  const containerRef = useRef(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Redirect if feature is disabled
  useEffect(() => {
    if (systemConfig && !isOnlineVideosEnabled) {
      router.push('/dashboard/manage_online_system');
    }
  }, [systemConfig, isOnlineVideosEnabled, router]);
  
  // Don't render if feature is disabled
  if (systemConfig && !isOnlineVideosEnabled) {
    return null;
  }
  const pageSize = 100;
  const [showPagePopup, setShowPagePopup] = useState(false);
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedVVC, setSelectedVVC] = useState(null);
  const [formData, setFormData] = useState({
    number_of_codes: '',
    code_settings: 'number_of_views', // 'number_of_views' or 'deadline_date'
    number_of_views: '',
    deadline_date: '',
    code_state: 'Activated'
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  
  // Search and filter states
  const [searchInput, setSearchInput] = useState(''); // Input field value
  const [searchTerm, setSearchTerm] = useState(''); // Actual search term used in query
  const [filterViewed, setFilterViewed] = useState(null);
  const [filterCodeState, setFilterCodeState] = useState(null);
  const [filterPaymentState, setFilterPaymentState] = useState(null);
  const [copiedCodeId, setCopiedCodeId] = useState(null); // Track which code was copied

  // React Query hook for fetching paginated VVCs
  const { data: vvcResponse, isLoading, error, refetch } = useVVCPaginated({
    page: currentPage,
    limit: pageSize,
    sortBy: 'date',
    sortOrder: 'desc',
    search: searchTerm.trim() || undefined,
    viewed: filterViewed !== null ? filterViewed : undefined,
    code_state: filterCodeState || undefined,
    payment_state: filterPaymentState || undefined,
  }, {
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 2 * 60 * 1000,
  });
  
  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterViewed, filterCodeState, filterPaymentState]);

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
    setCurrentPage(1);
  };

  // Handle Enter key press
  const handleSearchKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // Extract VVCs array and pagination info from response
  const vvcs = vvcResponse?.data || [];
  const pagination = vvcResponse?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalCount: 0,
    hasNextPage: false,
    hasPrevPage: false,
  };

  const queryClient = useQueryClient();

  // Create VVC mutation
  const createVVCMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.post('/api/vvc', data);
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['vvc']);
      refetch();
      setShowAddPopup(false);
      setFormData({ number_of_codes: '', code_settings: 'number_of_views', number_of_views: '', deadline_date: '', code_state: 'Activated' });
      setErrors({});
      const count = data?.data?.length || 1;
      setSuccessMessage(`${count} VVC code(s) created successfully!`);
      setErrorMessage('');
      setTimeout(() => setSuccessMessage(''), 6000);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || error.message || 'Error creating VVC');
      setSuccessMessage('');
      setTimeout(() => setErrorMessage(''), 6000);
    },
  });

  // Update VVC mutation
  const updateVVCMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const response = await apiClient.put(`/api/vvc?id=${id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vvc']);
      refetch();
      setShowEditPopup(false);
      setSelectedVVC(null);
      setFormData({ number_of_views: '', code_state: 'Activated' });
      setErrors({});
      setSuccessMessage('VVC updated successfully!');
      setErrorMessage('');
      setTimeout(() => setSuccessMessage(''), 6000);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || error.message || 'Error updating VVC');
      setSuccessMessage('');
      setTimeout(() => setErrorMessage(''), 6000);
    },
  });

  // Update Payment State mutation
  const updatePaymentStateMutation = useMutation({
    mutationFn: async ({ id, payment_state }) => {
      const response = await apiClient.put(`/api/vvc?id=${id}`, { payment_state });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vvc']);
      refetch();
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || error.message || 'Error updating payment state');
      setSuccessMessage('');
      setTimeout(() => setErrorMessage(''), 6000);
    },
  });

  // Handle payment state toggle
  const handleTogglePaymentState = (vvc) => {
    const newPaymentState = vvc.payment_state === 'Not Paid' ? 'Paid' : 'Not Paid';
    updatePaymentStateMutation.mutate({ id: vvc._id, payment_state: newPaymentState });
  };

  // Delete VVC mutation
  const deleteVVCMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiClient.delete(`/api/vvc?id=${id}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['vvc']);
      refetch();
      setShowConfirmModal(false);
      setSelectedVVC(null);
      setSuccessMessage('VVC deleted successfully!');
      setErrorMessage('');
      setTimeout(() => setSuccessMessage(''), 6000);
    },
    onError: (error) => {
      setErrorMessage(error.response?.data?.error || error.message || 'Error deleting VVC');
      setSuccessMessage('');
      setTimeout(() => setErrorMessage(''), 6000);
    },
  });


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

  // Handle add VVC
  const handleAddVVC = () => {
    setShowAddPopup(true);
    setFormData({ number_of_codes: '', code_settings: 'number_of_views', number_of_views: '', deadline_date: '', code_state: 'Activated' });
    setErrors({});
    setSuccessMessage('');
    setErrorMessage('');
  };

  // Helper function to format date for input (YYYY-MM-DD)
  const formatDateForInput = (dateValue) => {
    if (!dateValue) return '';
    // If it's already a string in YYYY-MM-DD format, return it
    if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      return dateValue;
    }
    // If it's a Date object, format it as YYYY-MM-DD in local timezone
    if (dateValue instanceof Date) {
      const year = dateValue.getFullYear();
      const month = String(dateValue.getMonth() + 1).padStart(2, '0');
      const day = String(dateValue.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    // If it's a string in another format, try to parse it
    try {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    } catch (e) {
      // If parsing fails, return empty string
    }
    return '';
  };

  // Handle edit VVC
  const handleEditVVC = (vvc) => {
    setSelectedVVC(vvc);
    setFormData({
      code_settings: vvc.code_settings || 'number_of_views',
      number_of_views: vvc.number_of_views ? vvc.number_of_views.toString() : '',
      deadline_date: formatDateForInput(vvc.deadline_date),
      code_state: vvc.code_state || 'Activated'
    });
    setErrors({});
    setShowEditPopup(true);
    setSuccessMessage('');
    setErrorMessage('');
  };

  // Handle delete VVC
  const handleDeleteVVC = (vvc) => {
    setSelectedVVC(vvc);
    setShowConfirmModal(true);
    setSuccessMessage('');
    setErrorMessage('');
  };

  // Handle form submit (add)
  const handleAddSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!formData.number_of_codes || parseInt(formData.number_of_codes) < 1) {
      newErrors.number_of_codes = '❌ Number of codes must be at least 1';
    } else if (parseInt(formData.number_of_codes) > 50) {
      newErrors.number_of_codes = '❌ Number of codes cannot exceed 50';
    }

    if (formData.code_settings === 'number_of_views') {
      if (!formData.number_of_views || parseInt(formData.number_of_views) < 1) {
        newErrors.number_of_views = '❌ Number of views must be at least 1';
      }
    } else if (formData.code_settings === 'deadline_date') {
      if (!formData.deadline_date) {
        newErrors.deadline_date = '❌ Deadline date is required';
      } else {
        // Parse date in local timezone to avoid timezone shift
        if (/^\d{4}-\d{2}-\d{2}$/.test(formData.deadline_date)) {
          const [year, month, day] = formData.deadline_date.split('-').map(Number);
          const selectedDate = new Date(year, month - 1, day);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selectedDate <= today) {
            newErrors.deadline_date = '❌ Deadline date must be in the future';
          }
        }
      }
    }

    if (!formData.code_state) {
      newErrors.code_state = '❌ Code state is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const mutationData = {
      number_of_codes: parseInt(formData.number_of_codes),
      code_settings: formData.code_settings,
      code_state: formData.code_state
    };
    
    if (formData.code_settings === 'number_of_views') {
      mutationData.number_of_views = parseInt(formData.number_of_views);
    } else if (formData.code_settings === 'deadline_date') {
      mutationData.deadline_date = formData.deadline_date;
    }
    
    createVVCMutation.mutate(mutationData);
  };

  // Handle form submit (edit)
  const handleEditSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    if (formData.code_settings === 'number_of_views') {
      if (!formData.number_of_views || parseInt(formData.number_of_views) < 1) {
        newErrors.number_of_views = '❌ Number of views must be at least 1';
      }
    } else if (formData.code_settings === 'deadline_date') {
      if (!formData.deadline_date) {
        newErrors.deadline_date = '❌ Deadline date is required';
      } else {
        // Parse date in local timezone to avoid timezone shift
        if (/^\d{4}-\d{2}-\d{2}$/.test(formData.deadline_date)) {
          const [year, month, day] = formData.deadline_date.split('-').map(Number);
          const selectedDate = new Date(year, month - 1, day);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (selectedDate <= today) {
            newErrors.deadline_date = '❌ Deadline date must be in the future';
          }
        }
      }
    }

    if (!formData.code_state) {
      newErrors.code_state = '❌ Code state is required';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const updateData = {
      code_settings: formData.code_settings,
      code_state: formData.code_state
    };
    
    if (formData.code_settings === 'number_of_views') {
      updateData.number_of_views = parseInt(formData.number_of_views);
    } else if (formData.code_settings === 'deadline_date') {
      updateData.deadline_date = formData.deadline_date;
    }
    
    updateVVCMutation.mutate({
      id: selectedVVC._id,
      data: updateData
    });
  };

  // Handle confirm delete
  const handleConfirmDelete = () => {
    if (selectedVVC) {
      deleteVVCMutation.mutate(selectedVVC._id);
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

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <Title href="/dashboard/manage_online_system" backText="Back">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/lock-cog.svg" alt="VVC" width={32} height={32} />
              Verification Video Codes
            </div>
          </Title>
          <LoadingSkeleton type="table" rows={8} columns={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div ref={containerRef} className="page-content" style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
          <Title href="/dashboard/manage_online_system" backText="Back">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/lock-cog.svg" alt="VVC" width={32} height={32} />
              Verification Video Codes
            </div>
          </Title>

        {/* Search Bar */}
        <div className="search-bar-container" style={{ marginBottom: 20 }}>
          <InputWithButton
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={handleSearchKeyPress}
            onButtonClick={handleSearch}
          />
        </div>

        {/* Filters */}
        <div className="filters-container" style={{
          background: 'white',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          marginBottom: 24
        }}>
          <div className="filter-row" style={{
            display: 'flex',
            gap: 12,
            marginBottom: 16,
            flexWrap: 'wrap'
          }}>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Viewed
              </label>
              <ViewedSelect
                value={filterViewed}
                onChange={(value) => setFilterViewed(value)}
                placeholder="Select Viewed"
                style={{ marginBottom: 0, hideLabel: true }}
              />
            </div>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Code State
              </label>
              <AccountStateSelect
                value={filterCodeState}
                onChange={(value) => setFilterCodeState(value)}
                placeholder="Select Code State"
                style={{ marginBottom: 0, hideLabel: true }}
              />
            </div>
            <div className="filter-group" style={{ flex: 1, minWidth: 180 }}>
              <label className="filter-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#495057', fontSize: '0.95rem' }}>
                Filter by Payment State
              </label>
              <PaymentStateSelect
                value={filterPaymentState}
                onChange={(value) => setFilterPaymentState(value)}
                placeholder="Select Payment State"
                style={{ marginBottom: 0, hideLabel: true }}
              />
            </div>
          </div>
        </div>

        <div className="history-container">
          <div className="title-button-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', position: 'relative' }}>
            <div className="title-spacer" style={{ flex: 1 }}></div>
            <div className="history-title" style={{ marginBottom: 0, flex: 1, textAlign: 'center' }}>
              Verification Video Codes ({pagination.totalCount} records)
            </div>
            <div className="add-button-wrapper" style={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
              {/* Add Button */}
              <button
                className="add-vvc-btn"
                onClick={handleAddVVC}
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
                Add VVC
              </button>
            </div>
          </div>
          {successMessage && (
            <div style={{
              background: '#d4edda',
              color: '#155724',
              borderRadius: 10,
              padding: 16,
              marginBottom: 16,
              textAlign: 'center',
              fontWeight: 600,
              border: '1.5px solid #c3e6cb',
              fontSize: '1.1rem',
              boxShadow: '0 4px 16px rgba(40, 167, 69, 0.08)'
            }}>
              ✅ {successMessage}
            </div>
          )}
          {errorMessage && (
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
              ❌ {errorMessage}
            </div>
          )}
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
              {error.message || "Failed to fetch VVC data"}
            </div>
          )}
          {vvcs.length === 0 ? (
            <div className="no-results">
              ❌ No verification video codes found.
            </div>
          ) : (
            <ScrollArea h={400} type="hover" className={styles.scrolled}>
              <div style={{ overflowX: 'auto' }}>
                <Table striped highlightOnHover withTableBorder withColumnBorders style={{ minWidth: '800px' }}>
                <Table.Thead style={{ position: 'sticky', top: 0, backgroundColor: '#f8f9fa'}}>
                  <Table.Tr>
                    <Table.Th style={{ width: '8%', textAlign: 'center' }}>Copy</Table.Th>
                    <Table.Th style={{ width: '12%', textAlign: 'center' }}>VVC</Table.Th>
                    <Table.Th style={{ width: '15%', textAlign: 'center' }}>Code Settings</Table.Th>
                    <Table.Th style={{ width: '8%', textAlign: 'center' }}>Viewed</Table.Th>
                    <Table.Th style={{ width: '12%', textAlign: 'center' }}>Viewed By Who (ID)</Table.Th>
                    <Table.Th style={{ width: '12%', textAlign: 'center' }}>Code State</Table.Th>
                    <Table.Th style={{ width: '12%', textAlign: 'center' }}>Payment State</Table.Th>
                    <Table.Th style={{ width: '12%', textAlign: 'center' }}>Made By Who</Table.Th>
                    <Table.Th style={{ width: '15%', textAlign: 'center' }}>Date of Creation</Table.Th>
                    <Table.Th style={{ width: '9%', textAlign: 'center' }}>Edit</Table.Th>
                    <Table.Th style={{ width: '10%', textAlign: 'center' }}>Delete</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {vvcs.map((vvc, index) => {
                    const codeSettings = vvc.code_settings || 'number_of_views';
                    // Helper to format date string (YYYY-MM-DD) to MM/DD/YYYY
                    const formatDateString = (dateStr) => {
                      if (!dateStr) return 'N/A';
                      // If it's already in YYYY-MM-DD format, parse it directly
                      if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                        const [year, month, day] = dateStr.split('-');
                        return `${month}/${day}/${year}`;
                      }
                      // If it's a Date object, format it in local timezone
                      if (dateStr instanceof Date) {
                        const month = String(dateStr.getMonth() + 1).padStart(2, '0');
                        const day = String(dateStr.getDate()).padStart(2, '0');
                        const year = dateStr.getFullYear();
                        return `${month}/${day}/${year}`;
                      }
                      // Try to parse as date string
                      try {
                        const date = new Date(dateStr);
                        if (!isNaN(date.getTime())) {
                          const month = String(date.getMonth() + 1).padStart(2, '0');
                          const day = String(date.getDate()).padStart(2, '0');
                          const year = date.getFullYear();
                          return `${month}/${day}/${year}`;
                        }
                      } catch (e) {
                        // If parsing fails, return as is
                      }
                      return dateStr || 'N/A';
                    };
                    
                    const settingsDisplay = codeSettings === 'number_of_views' 
                      ? `Number Of Views : ${vvc.number_of_views || 0}`
                      : `Deadline Date : ${formatDateString(vvc.deadline_date)}`;
                    
                    return (
                    <Table.Tr key={`${vvc._id}-${index}`}>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleCopyCode(vvc.VVC, vvc._id.toString())}
                          style={{
                            padding: '6px',
                            backgroundColor: copiedCodeId === vvc._id.toString() ? '#28a745' : '#d71d1d',
                            border: copiedCodeId === vvc._id.toString() ? '1px solid #28a745' : '1px solid #d71d1d',
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
                            if (copiedCodeId !== vvc._id.toString()) {
                              e.target.style.backgroundColor = '#b91c1c';
                              e.target.style.borderColor = '#b91c1c';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (copiedCodeId !== vvc._id.toString()) {
                              e.target.style.backgroundColor = '#d71d1d';
                              e.target.style.borderColor = '#d71d1d';
                            }
                          }}
                          title={copiedCodeId === vvc._id.toString() ? 'Copied!' : 'Copy code'}
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
                      <Table.Td style={{ fontFamily: 'monospace', fontSize: '0.9rem', textAlign: 'center', fontWeight: 'bold' }}>{vvc.VVC}</Table.Td>
                      <Table.Td style={{ textAlign: 'center', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>{settingsDisplay}</Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        {vvc.viewed ? (
                          <span style={{ color: '#28a745', fontWeight: 'bold' }}>✅ Yes</span>
                        ) : (
                          <span style={{ color: '#dc3545', fontWeight: 'bold' }}>❌ No</span>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        {vvc.viewed_by_who || <span style={{ color: '#dc3545', fontWeight: 'bold' }}>❌ Not viewed yet</span>}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        {vvc.code_state === 'Activated' ? (
                          <span style={{ color: '#28a745', fontWeight: 'bold' }}>✅ Activated</span>
                        ) : (
                          <span style={{ color: '#dc3545', fontWeight: 'bold' }}>❌ Deactivated</span>
                        )}
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <button
                          className="payment-state-btn"
                          onClick={() => handleTogglePaymentState(vvc)}
                          disabled={updatePaymentStateMutation.isLoading}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: (vvc.payment_state || 'Not Paid') === 'Paid' ? '#28a745' : '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: updatePaymentStateMutation.isLoading ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            opacity: updatePaymentStateMutation.isLoading ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                            minWidth: '90px'
                          }}
                          onMouseEnter={(e) => {
                            if (!updatePaymentStateMutation.isLoading) {
                              e.target.style.transform = 'translateY(-1px)';
                              e.target.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!updatePaymentStateMutation.isLoading) {
                              e.target.style.transform = 'translateY(0)';
                              e.target.style.boxShadow = 'none';
                            }
                          }}
                        >
                          {(vvc.payment_state || 'Not Paid') === 'Paid' ? '✅ Paid' : '❌ Not Paid'}
                        </button>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>{vvc.made_by_who || 'N/A'}</Table.Td>
                      <Table.Td style={{ textAlign: 'center', fontSize: '0.9rem' }}>{vvc.date || 'N/A'}</Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <button
                          className="edit-vvc-btn"
                          onClick={() => handleEditVVC(vvc)}
                          disabled={updateVVCMutation.isLoading}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#1FA8DC',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: updateVVCMutation.isLoading ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            opacity: updateVVCMutation.isLoading ? 0.6 : 1,
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px'
                          }}
                          onMouseLeave={(e) => {
                            if (!updateVVCMutation.isLoading) {
                              e.target.style.backgroundColor = '#1FA8DC';
                            }
                          }}
                        >
                          <Image src="/edit.svg" alt="Edit" width={18} height={18} style={{ display: 'inline-block' }} />
                          Edit
                        </button>
                      </Table.Td>
                      <Table.Td style={{ textAlign: 'center' }}>
                        <button
                          className="delete-vvc-btn"
                          onClick={() => handleDeleteVVC(vvc)}
                          disabled={deleteVVCMutation.isLoading}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: deleteVVCMutation.isLoading ? 'not-allowed' : 'pointer',
                            fontSize: '0.9rem',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            opacity: deleteVVCMutation.isLoading ? 0.6 : 1,
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
                    );
                  })}
                </Table.Tbody>
              </Table>
              </div>
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

        {/* Add VVC Popup */}
        {showAddPopup && (
          <div className="confirm-modal">
            <div className="confirm-content" style={{ maxWidth: '500px', width: '90%', textAlign: 'left' }}>
              <h3 style={{ textAlign: 'center' }}>Add New VVC</h3>
              <form onSubmit={handleAddSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                    Number of Codes <span style={{ color: 'red' }}>*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={formData.number_of_codes}
                    onChange={(e) => setFormData({ ...formData, number_of_codes: e.target.value })}
                    placeholder="Enter number of codes (1-50)"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: errors.number_of_codes ? '2px solid #dc3545' : '2px solid #e9ecef',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      transition: 'border-color 0.3s ease'
                    }}
                  />
                  {errors.number_of_codes && (
                    <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                      {errors.number_of_codes}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                    Codes Settings <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input
                        type="radio"
                        name="code_settings"
                        value="number_of_views"
                        checked={formData.code_settings === 'number_of_views'}
                        onChange={(e) => setFormData({ ...formData, code_settings: e.target.value, deadline_date: '' })}
                        style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      Number of Views
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input
                        type="radio"
                        name="code_settings"
                        value="deadline_date"
                        checked={formData.code_settings === 'deadline_date'}
                        onChange={(e) => setFormData({ ...formData, code_settings: e.target.value, number_of_views: '' })}
                        style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      Deadline Date
                    </label>
                  </div>
                </div>

                {formData.code_settings === 'number_of_views' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                      Number of Views <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.number_of_views}
                      onChange={(e) => setFormData({ ...formData, number_of_views: e.target.value })}
                      placeholder="Enter number of views (at least 1)"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: errors.number_of_views ? '2px solid #dc3545' : '2px solid #e9ecef',
                        borderRadius: '10px',
                        fontSize: '1rem',
                        transition: 'border-color 0.3s ease'
                      }}
                    />
                    {errors.number_of_views && (
                      <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                        {errors.number_of_views}
                      </div>
                    )}
                  </div>
                )}

                {formData.code_settings === 'deadline_date' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                      Deadline Date <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.deadline_date}
                      onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: errors.deadline_date ? '2px solid #dc3545' : '2px solid #e9ecef',
                        borderRadius: '10px',
                        fontSize: '1rem',
                        transition: 'all 0.3s ease',
                        appearance: 'none',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                      onFocus={(e) => {
                        e.target.style.border = '2px solid #1FA8DC';
                        e.target.style.boxShadow = '0 0 0 3px rgba(31, 168, 220, 0.1)';
                      }}
                      onBlur={(e) => {
                        if (!errors.deadline_date) {
                          e.target.style.border = '2px solid #e9ecef';
                          e.target.style.boxShadow = 'none';
                        }
                      }}
                    />
                    {errors.deadline_date && (
                      <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                        {errors.deadline_date}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <AccountStateSelect
                    value={formData.code_state}
                    onChange={(value) => setFormData({ ...formData, code_state: value })}
                    placeholder="Select Code State"
                    required={true}
                  />
                  {errors.code_state && (
                    <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                      {errors.code_state}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'center' }}>
                  <button
                    type="submit"
                    disabled={createVVCMutation.isLoading}
                    style={{
                      background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontWeight: '600',
                      fontSize: '1rem',
                      cursor: createVVCMutation.isLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 12px rgba(40, 167, 69, 0.3)',
                      opacity: createVVCMutation.isLoading ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!createVVCMutation.isLoading) {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 16px rgba(40, 167, 69, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!createVVCMutation.isLoading) {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 12px rgba(40, 167, 69, 0.3)';
                      }
                    }}
                  >
                    {createVVCMutation.isLoading ? 'Generating...' : 'Generate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPopup(false);
                      setFormData({ number_of_codes: '', code_settings: 'number_of_views', number_of_views: '', deadline_date: '', code_state: 'Activated' });
                      setErrors({});
                    }}
                    disabled={createVVCMutation.isLoading}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit VVC Popup */}
        {showEditPopup && selectedVVC && (
          <div className="confirm-modal">
            <div className="confirm-content" style={{ maxWidth: '500px', width: '90%', textAlign: 'left' }}>
              <h3 style={{ textAlign: 'center' }}>Edit VVC</h3>
              <form onSubmit={handleEditSubmit}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                    Codes Settings <span style={{ color: 'red' }}>*</span>
                  </label>
                  <div style={{ display: 'flex', gap: '20px', marginBottom: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input
                        type="radio"
                        name="code_settings_edit"
                        value="number_of_views"
                        checked={formData.code_settings === 'number_of_views'}
                        onChange={(e) => setFormData({ ...formData, code_settings: e.target.value, deadline_date: '' })}
                        style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      Number of Views
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '0.95rem' }}>
                      <input
                        type="radio"
                        name="code_settings_edit"
                        value="deadline_date"
                        checked={formData.code_settings === 'deadline_date'}
                        onChange={(e) => setFormData({ ...formData, code_settings: e.target.value, number_of_views: '' })}
                        style={{ marginRight: '8px', width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      Deadline Date
                    </label>
                  </div>
                </div>

                {formData.code_settings === 'number_of_views' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                      Number of Views <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={formData.number_of_views}
                      onChange={(e) => setFormData({ ...formData, number_of_views: e.target.value })}
                      placeholder="Enter number of views (at least 1)"
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: errors.number_of_views ? '2px solid #dc3545' : '2px solid #e9ecef',
                        borderRadius: '10px',
                        fontSize: '1rem',
                        transition: 'border-color 0.3s ease'
                      }}
                    />
                    {errors.number_of_views && (
                      <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                        {errors.number_of_views}
                      </div>
                    )}
                  </div>
                )}

                {formData.code_settings === 'deadline_date' && (
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', textAlign: 'left' }}>
                      Deadline Date <span style={{ color: 'red' }}>*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.deadline_date}
                      onChange={(e) => setFormData({ ...formData, deadline_date: e.target.value })}
                      min={new Date().toISOString().split('T')[0]}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        border: errors.deadline_date ? '2px solid #dc3545' : '2px solid #e9ecef',
                        borderRadius: '10px',
                        fontSize: '1rem',
                        transition: 'all 0.3s ease',
                        backgroundColor: '#ffffff',
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                      onFocus={(e) => {
                        e.target.style.border = '2px solid #1FA8DC';
                        e.target.style.boxShadow = '0 0 0 3px rgba(31, 168, 220, 0.1)';
                      }}
                      onBlur={(e) => {
                        if (!errors.deadline_date) {
                          e.target.style.border = '2px solid #e9ecef';
                          e.target.style.boxShadow = 'none';
                        }
                      }}
                    />
                    {errors.deadline_date && (
                      <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                        {errors.deadline_date}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ marginBottom: '16px' }}>
                  <AccountStateSelect
                    value={formData.code_state}
                    onChange={(value) => setFormData({ ...formData, code_state: value })}
                    placeholder="Select Code State"
                    required={true}
                  />
                  {errors.code_state && (
                    <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
                      {errors.code_state}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'center' }}>
                  <button
                    type="submit"
                    disabled={updateVVCMutation.isLoading}
                    style={{
                      background: 'linear-gradient(135deg, #1FA8DC 0%, #0d5a7a 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '12px 24px',
                      fontWeight: '600',
                      fontSize: '1rem',
                      cursor: updateVVCMutation.isLoading ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 12px rgba(31, 168, 220, 0.3)',
                      opacity: updateVVCMutation.isLoading ? 0.7 : 1
                    }}
                    onMouseEnter={(e) => {
                      if (!updateVVCMutation.isLoading) {
                        e.target.style.transform = 'translateY(-2px)';
                        e.target.style.boxShadow = '0 6px 16px rgba(31, 168, 220, 0.4)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!updateVVCMutation.isLoading) {
                        e.target.style.transform = 'translateY(0)';
                        e.target.style.boxShadow = '0 4px 12px rgba(31, 168, 220, 0.3)';
                      }
                    }}
                  >
                    {updateVVCMutation.isLoading ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowEditPopup(false);
                      setSelectedVVC(null);
                      setFormData({ code_settings: 'number_of_views', number_of_views: '', deadline_date: '', code_state: 'Activated' });
                      setErrors({});
                    }}
                    disabled={updateVVCMutation.isLoading}
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
        {showConfirmModal && selectedVVC && (
          <div className="confirm-modal">
            <div className="confirm-content">
              <h3>Confirm Delete VVC</h3>
              <p>Are you sure you want to delete VVC code <strong>{selectedVVC.VVC}</strong>?</p>
              <div className="confirm-buttons">
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleteVVCMutation.isLoading}
                  className="confirm-regenerate-btn"
                >
                  {deleteVVCMutation.isLoading ? "Deleting..." : "Yes, Delete Code"}
                </button>
                <button
                  onClick={() => {
                    setShowConfirmModal(false);
                    setSelectedVVC(null);
                  }}
                  disabled={deleteVVCMutation.isLoading}
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
            .page-wrapper {
              padding: 10px 5px 10px 5px !important;
            }
            .page-content {
              margin: 20px auto !important;
              padding: 8px !important;
            }
            /* Search Bar */
            .search-bar-container {
              margin-bottom: 16px !important;
            }
            .search-bar-container :global(input) {
              font-size: 0.9rem !important;
            }
            /* Filters Container */
            .filters-container {
              padding: 16px !important;
              margin-bottom: 16px !important;
            }
            .filter-row {
              flex-direction: column !important;
              gap: 12px !important;
            }
            .filter-group {
              flex: none !important;
              min-width: 100% !important;
              width: 100% !important;
            }
            .filter-label {
              font-size: 0.9rem !important;
              margin-bottom: 6px !important;
            }
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
            .add-vvc-btn {
              width: 100%;
            }
            /* Payment State Button */
            .payment-state-btn {
              padding: 8px !important;
              font-size: 0.75rem !important;
              min-width: 70px !important;
            }
          }
          
          @media (max-width: 480px) {
            .page-wrapper {
              padding: 5px !important;
            }
            .page-content {
              margin: 10px auto !important;
              padding: 5px !important;
            }
            /* Search Bar */
            .search-bar-container {
              margin-bottom: 12px !important;
            }
            .search-bar-container :global(input) {
              font-size: 0.85rem !important;
              padding: 10px 14px !important;
            }
            .search-bar-container :global(button) {
              width: 36px !important;
              height: 36px !important;
            }
            /* Filters Container */
            .filters-container {
              padding: 12px !important;
              margin-bottom: 12px !important;
              border-radius: 12px !important;
            }
            .filter-row {
              gap: 10px !important;
            }
            .filter-label {
              font-size: 0.85rem !important;
              margin-bottom: 4px !important;
            }
            .history-container {
              padding: 12px;
            }
            .history-title {
              font-size: 1.1rem;
            }
            .title-button-container {
              marginBottom: 16px !important;
            }
            .add-vvc-btn {
              padding: 10px 20px !important;
              font-size: 0.9rem !important;
            }
            .edit-vvc-btn,
            .delete-vvc-btn {
              padding: 5px 10px !important;
              font-size: 0.8rem !important;
            }
            /* Payment State Button */
            .payment-state-btn {
              padding: 6px !important;
              font-size: 0.7rem !important;
              min-width: 60px !important;
            }
            .vvc-table {
              font-size: 0.85rem;
            }
            .vvc-table th {
              font-size: 0.85rem;
              padding: 8px 4px !important;
            }
            .vvc-table td {
              font-size: 0.85rem;
              padding: 8px 4px !important;
            }
            ScrollArea {
              max-height: 300px !important;
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

          @media (max-width: 768px) {
            .confirm-content {
              padding: 24px 20px;
              max-width: 95%;
              margin: 10px;
            }
            .confirm-content h3 {
              font-size: 1.3rem;
            }
          }

          @media (max-width: 480px) {
            .confirm-content {
              padding: 20px 16px;
              max-width: 95%;
              margin: 5px;
              border-radius: 12px;
            }

            .confirm-content h3 {
              font-size: 1.2rem;
              margin-bottom: 12px;
            }

            .confirm-content p {
              font-size: 0.9rem;
            }

            .confirm-buttons {
              flex-direction: column;
              gap: 10px;
            }

            .confirm-regenerate-btn,
            .cancel-btn {
              width: 100%;
              padding: 10px 20px !important;
              font-size: 0.9rem !important;
            }
          }

          @media (max-width: 360px) {
            .page-content {
              padding: 3px !important;
            }
            .history-container {
              padding: 10px;
              border-radius: 12px;
            }
            .history-title {
              font-size: 1rem;
            }
            .add-vvc-btn {
              padding: 8px 16px !important;
              font-size: 0.85rem !important;
            }
            .confirm-content {
              padding: 16px 12px;
              max-width: 98%;
            }
            .confirm-content h3 {
              font-size: 1.1rem;
            }
          }
        `}</style>
      </div>
    </div>
  );
}

