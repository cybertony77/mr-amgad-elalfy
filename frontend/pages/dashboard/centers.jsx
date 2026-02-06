import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import apiClient from '../../lib/axios';
import Title from '../../components/Title';
import GradeSelect from '../../components/GradeSelect';
import PeriodSelect from '../../components/PeriodSelect';
import DaySelect from '../../components/DaySelect';

// API functions
const centersAPI = {
  getCenters: async () => {
    const response = await apiClient.get('/api/centers');
    return response.data.centers;
  },

  createCenter: async (data) => {
    const response = await apiClient.post('/api/centers', data);
    return response.data;
  },

  updateCenter: async (id, data) => {
    const response = await apiClient.put(`/api/centers/${id}`, data);
    return response.data;
  },

  deleteCenter: async (id) => {
    const response = await apiClient.delete(`/api/centers/${id}`);
    return response.data;
  }
};

export default function Centers() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCenterName, setNewCenterName] = useState('');
  const [newCenterLocation, setNewCenterLocation] = useState('');
  const [newCenterGrades, setNewCenterGrades] = useState([{ grade: '', timings: [{ day: '', time: '', period: 'PM', dayOpen: false, periodOpen: false }], gradeOpen: false }]);
  const [editingCenter, setEditingCenter] = useState(null);
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editGrades, setEditGrades] = useState([]);
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [centerToDelete, setCenterToDelete] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [centerDetails, setCenterDetails] = useState(null);
  const [showAddSuccess, setShowAddSuccess] = useState(false);
  const [showEditSuccess, setShowEditSuccess] = useState(false);

  // Authentication is now handled by _app.js with HTTP-only cookies

  // Fetch centers
  const { data: centers = [], isLoading, error: fetchError } = useQuery({
    queryKey: ['centers'],
    queryFn: () => centersAPI.getCenters(),
    retry: 3,
    retryDelay: 1000,
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
    staleTime: 0, // Always consider data stale
    onError: (error) => {
      console.error('❌ Centers fetch error:', error);
      console.error('❌ Error response:', error.response?.data);
      console.error('❌ Error status:', error.response?.status);
    }
  });

  // Create center mutation
  const createMutation = useMutation({
    mutationFn: (data) => centersAPI.createCenter(data),
    onSuccess: () => {
      console.log('🔄 Centers: Invalidating query after creating center');
      queryClient.invalidateQueries({ queryKey: ['centers'] });
      setShowAddSuccess(true);
      setError('');
      setTimeout(() => {
        setShowAddForm(false);
        setNewCenterName('');
        setNewCenterLocation('');
        setNewCenterGrades([{ grade: '', timings: [{ day: '', time: '', period: 'PM', dayOpen: false, periodOpen: false }], gradeOpen: false }]);
        setShowAddSuccess(false);
      }, 2000);
    },
    onError: (error) => {
      setError(error.response?.data?.error || 'Failed to create center');
    }
  });

  // Update center mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => centersAPI.updateCenter(id, data),
    onSuccess: () => {
      console.log('🔄 Centers: Invalidating query after updating center');
      queryClient.invalidateQueries({ queryKey: ['centers'] });
      setShowEditSuccess(true);
      setError('');
      // Don't close modal immediately, show success message first
      setTimeout(() => {
        setEditingCenter(null);
        setEditName('');
        setEditLocation('');
        setEditGrades([]);
        setShowEditSuccess(false);
      }, 2000);
    },
    onError: (error) => {
      setError(error.response?.data?.error || 'Failed to update center');
    }
  });

  // Delete center mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => centersAPI.deleteCenter(id),
    onSuccess: () => {
      console.log('🔄 Centers: Invalidating query after deleting center');
      queryClient.invalidateQueries({ queryKey: ['centers'] });
      setError('');
    },
    onError: (error) => {
      setError(error.response?.data?.error || 'Failed to delete center');
    }
  });

  // Auto-hide error message after 6 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Auto-hide add success message after 6 seconds
  useEffect(() => {
    if (showAddSuccess) {
      const timer = setTimeout(() => {
        setShowAddSuccess(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [showAddSuccess]);

  // Auto-hide edit success message after 6 seconds
  useEffect(() => {
    if (showEditSuccess) {
      const timer = setTimeout(() => {
        setShowEditSuccess(false);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [showEditSuccess]);

  // Helper function to process grades data
  const processGrades = (gradesData) => {
    return gradesData
      .filter(g => g.grade && g.grade.trim() !== '') // Only include grades with selected grade
      .map(g => ({
        grade: g.grade,
        timings: g.timings
          .filter(t => t.day && t.day.trim() !== '' && t.time !== '' && t.time != null && t.time.includes(':')) // Only include timings with valid day and time format
          .map(t => {
            // Format time with leading zeros (e.g., "2:5" -> "02:05")
            const timeParts = t.time.trim().split(':');
            const hours = timeParts[0] ? timeParts[0].padStart(2, '0') : '00';
            const minutes = timeParts[1] ? timeParts[1].padStart(2, '0') : '00';
            const formattedTime = `${hours}:${minutes}`;
            
            return {
              day: t.day.trim(),
              time: formattedTime, // Store as string like "02:05"
              period: t.period || 'AM'
            };
          })
      }))
      .filter(g => g.timings.length > 0); // Only include grades with at least one timing
  };

  const handleAddCenter = () => {
    if (!newCenterName.trim()) {
      setError('Center name is required');
      return;
    }
    
    const processedGrades = processGrades(newCenterGrades);
    createMutation.mutate({
      name: newCenterName.trim(),
      location: newCenterLocation.trim() || '',
      grades: processedGrades
    });
  };

  const handleEditCenter = (center) => {
    setEditingCenter(center);
    setEditName(center.name);
    setEditLocation(center.location || '');
    // Initialize edit grades from center data or empty array
    if (center.grades && center.grades.length > 0) {
      setEditGrades(center.grades.map(g => ({
        grade: g.grade,
        timings: g.timings.map(t => ({ 
          day: t.day || '',
          time: typeof t.time === 'number' ? `${t.time}:00` : (t.time || ''), 
          period: t.period || 'PM',
          dayOpen: false,
          periodOpen: false
        })),
        gradeOpen: false
      })));
    } else {
      setEditGrades([{ grade: '', timings: [{ day: '', time: '', period: 'PM', dayOpen: false, periodOpen: false }], gradeOpen: false }]);
    }
    setError('');
  };

  const handleUpdateCenter = () => {
    if (!editName.trim()) {
      setError('Center name is required');
      return;
    }
    
    const processedGrades = processGrades(editGrades);
    updateMutation.mutate({ 
      id: editingCenter.id, 
      data: {
        name: editName.trim(),
        location: editLocation.trim() || '',
        grades: processedGrades
      }
    });
  };

  const handleDeleteCenter = (center) => {
    setCenterToDelete(center);
    setShowConfirm(true);
  };

  const handleShowDetails = (center) => {
    setCenterDetails(center);
    setShowDetails(true);
  };

  const handleCloseDetails = () => {
    setShowDetails(false);
    setCenterDetails(null);
  };

  const confirmDelete = () => {
    if (centerToDelete) {
      deleteMutation.mutate(centerToDelete.id);
      setShowConfirm(false);
      setCenterToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirm(false);
    setCenterToDelete(null);
  };

  const cancelEdit = () => {
    setEditingCenter(null);
    setEditName('');
    setEditLocation('');
    setEditGrades([]);
    setError('');
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    setNewCenterName('');
    setNewCenterLocation('');
    setNewCenterGrades([{ grade: '', timings: [{ day: '', time: '', period: 'PM', dayOpen: false, periodOpen: false }], gradeOpen: false }]);
    setError('');
  };

  // Add new grade to add form
  const addNewGrade = () => {
    setNewCenterGrades([...newCenterGrades, { grade: '', timings: [{ day: '', time: '', period: 'PM', dayOpen: false, periodOpen: false }], gradeOpen: false }]);
  };

  // Add new grade to edit form
  const addEditGrade = () => {
    setEditGrades([...editGrades, { grade: '', timings: [{ day: '', time: '', period: 'PM', dayOpen: false, periodOpen: false }], gradeOpen: false }]);
  };

  // Remove grade section from add form
  const removeGradeFromAdd = (gradeIndex) => {
    const updated = [...newCenterGrades];
    updated.splice(gradeIndex, 1);
    // If no grades left, add one empty grade
    if (updated.length === 0) {
      updated.push({ grade: '', timings: [{ day: '', time: '', period: 'PM', dayOpen: false, periodOpen: false }], gradeOpen: false });
    }
    setNewCenterGrades(updated);
  };

  // Remove grade section from edit form
  const removeGradeFromEdit = (gradeIndex) => {
    const updated = [...editGrades];
    updated.splice(gradeIndex, 1);
    // If no grades left, add one empty grade
    if (updated.length === 0) {
      updated.push({ grade: '', timings: [{ day: '', time: '', period: 'PM', dayOpen: false, periodOpen: false }], gradeOpen: false });
    }
    setEditGrades(updated);
  };

  // Add timing to a grade in add form
  const addTimingToGrade = (gradeIndex) => {
    const updated = [...newCenterGrades];
    updated[gradeIndex].timings.push({ day: '', time: '', period: 'PM', dayOpen: false, periodOpen: false });
    setNewCenterGrades(updated);
  };

  // Add timing to a grade in edit form
  const addTimingToEditGrade = (gradeIndex) => {
    const updated = [...editGrades];
    updated[gradeIndex].timings.push({ day: '', time: '', period: 'PM', dayOpen: false, periodOpen: false });
    setEditGrades(updated);
  };

  // Remove timing from a grade in add form
  const removeTimingFromGrade = (gradeIndex, timingIndex) => {
    const updated = [...newCenterGrades];
    updated[gradeIndex].timings.splice(timingIndex, 1);
    // If no timings left, add one empty timing
    if (updated[gradeIndex].timings.length === 0) {
      updated[gradeIndex].timings.push({ day: '', time: '', period: 'PM', dayOpen: false, periodOpen: false });
    }
    setNewCenterGrades(updated);
  };

  // Remove timing from a grade in edit form
  const removeTimingFromEditGrade = (gradeIndex, timingIndex) => {
    const updated = [...editGrades];
    updated[gradeIndex].timings.splice(timingIndex, 1);
    // If no timings left, add one empty timing
    if (updated[gradeIndex].timings.length === 0) {
      updated[gradeIndex].timings.push({ day: '', time: '', period: 'PM', dayOpen: false, periodOpen: false });
    }
    setEditGrades(updated);
  };

  // Toggle period select in add form
  const togglePeriodSelectAdd = (gradeIndex, timingIndex) => {
    const updated = [...newCenterGrades];
    updated[gradeIndex].timings[timingIndex].periodOpen = !updated[gradeIndex].timings[timingIndex].periodOpen;
    // Close other period selects
    updated[gradeIndex].timings.forEach((t, idx) => {
      if (idx !== timingIndex) t.periodOpen = false;
    });
    setNewCenterGrades(updated);
  };

  // Toggle period select in edit form
  const togglePeriodSelectEdit = (gradeIndex, timingIndex) => {
    const updated = [...editGrades];
    updated[gradeIndex].timings[timingIndex].periodOpen = !updated[gradeIndex].timings[timingIndex].periodOpen;
    // Close other period selects
    updated[gradeIndex].timings.forEach((t, idx) => {
      if (idx !== timingIndex) t.periodOpen = false;
    });
    setEditGrades(updated);
  };

  // Toggle day select in add form
  const toggleDaySelectAdd = (gradeIndex, timingIndex) => {
    const updated = [...newCenterGrades];
    updated[gradeIndex].timings[timingIndex].dayOpen = !updated[gradeIndex].timings[timingIndex].dayOpen;
    // Close other day selects
    updated[gradeIndex].timings.forEach((t, idx) => {
      if (idx !== timingIndex) t.dayOpen = false;
    });
    setNewCenterGrades(updated);
  };

  // Toggle day select in edit form
  const toggleDaySelectEdit = (gradeIndex, timingIndex) => {
    const updated = [...editGrades];
    updated[gradeIndex].timings[timingIndex].dayOpen = !updated[gradeIndex].timings[timingIndex].dayOpen;
    // Close other day selects
    updated[gradeIndex].timings.forEach((t, idx) => {
      if (idx !== timingIndex) t.dayOpen = false;
    });
    setEditGrades(updated);
  };

  // Update grade selection in add form
  const updateGradeInAdd = (gradeIndex, grade) => {
    const updated = [...newCenterGrades];
    updated[gradeIndex].grade = grade;
    setNewCenterGrades(updated);
  };

  // Update grade selection in edit form
  const updateGradeInEdit = (gradeIndex, grade) => {
    const updated = [...editGrades];
    updated[gradeIndex].grade = grade;
    setEditGrades(updated);
  };

  // Update timing in add form
  const updateTimingInAdd = (gradeIndex, timingIndex, field, value) => {
    const updated = [...newCenterGrades];
    updated[gradeIndex].timings[timingIndex][field] = value;
    setNewCenterGrades(updated);
  };

  // Update timing in edit form
  const updateTimingInEdit = (gradeIndex, timingIndex, field, value) => {
    const updated = [...editGrades];
    updated[gradeIndex].timings[timingIndex][field] = value;
    setEditGrades(updated);
  };

  // Toggle grade select dropdown in add form
  const toggleGradeSelectAdd = (gradeIndex) => {
    const updated = [...newCenterGrades];
    updated[gradeIndex].gradeOpen = !updated[gradeIndex].gradeOpen;
    // Close other grade selects
    updated.forEach((g, idx) => {
      if (idx !== gradeIndex) g.gradeOpen = false;
    });
    setNewCenterGrades(updated);
  };

  // Toggle grade select dropdown in edit form
  const toggleGradeSelectEdit = (gradeIndex) => {
    const updated = [...editGrades];
    updated[gradeIndex].gradeOpen = !updated[gradeIndex].gradeOpen;
    // Close other grade selects
    updated.forEach((g, idx) => {
      if (idx !== gradeIndex) g.gradeOpen = false;
    });
    setEditGrades(updated);
  };



  // Authentication is handled by _app.js with HTTP-only cookies

  if (fetchError) {
    console.error('Centers fetch error:', fetchError);
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Error Loading Centers</h1>
        <p style={{ color: '#dc3545' }}>
          {typeof fetchError.response?.data?.error === 'string' 
            ? fetchError.response.data.error 
            : typeof fetchError.message === 'string'
            ? fetchError.message
            : 'Failed to load centers'}
        </p>
        {fetchError.response?.data?.details && (
          <p style={{ color: '#666', fontSize: '0.9rem', marginTop: '8px' }}>
            Details: {typeof fetchError.response.data.details === 'string' 
              ? fetchError.response.data.details 
              : JSON.stringify(fetchError.response.data.details)}
          </p>
        )}
        <button 
          onClick={() => router.push('/dashboard')}
          style={{
            padding: '12px 24px',
            backgroundColor: '#1FA8DC',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="centers-page-container" style={{ 
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      maxWidth: "800px",
      margin: "40px auto",
      padding: "20px 15px 20px 15px" 
    }}>
      <Title style={{ justifyContent: 'space-between', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image src="/center.svg" alt="Centers" width={32} height={32} />
          Centers Management
        </div>
      </Title>
      
      {/* Main Container */}
      <div className="main-container" style={{ 
        maxWidth: '800px', 
        margin: '0 auto',
        backgroundColor: 'white',
        borderRadius: '16px',
        padding: '30px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
        width: '100%'
      }}>
        {/* Container Header with Add Button */}
        <div className="container-header" style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '30px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>

          <div>
            <h2 style={{ 
              margin: 0, 
              color: '#333',
              fontSize: '1.8rem',
              fontWeight: 'bold'
            }}>
              Learning Centers
            </h2>
            <p style={{ 
              margin: '8px 0 0 0', 
              color: '#666',
              fontSize: '1rem'
            }}>
              Manage all learning centers
            </p>
          </div>
          
          <button
            className="add-center-btn"
            onClick={() => setShowAddForm(true)}
            style={{
              padding: '12px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#218838'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#28a745'}
          >
            <Image src="/plus.svg" alt="Add" width={20} height={20} />
            Add Center
          </button>
        </div>

        {/* Centers List */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ 
              fontSize: '1.2rem', 
              color: '#666',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px'
            }}>
              <div style={{
                width: '20px',
                height: '20px',
                border: '2px solid #f3f3f3',
                borderTop: '2px solid #007bff',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              Loading centers...
            </div>
          </div>
        ) : centers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h3 style={{ color: '#666', margin: '0 0 16px 0' }}>No Centers Found</h3>
            <p style={{ color: '#999', margin: 0 }}>
              Click "Add Center" to create your first center.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {centers.map((center) => (
              <div
                key={center.id}
                className="center-card"
                style={{
                  backgroundColor: '#f8f9fa',
                  padding: '20px',
                  borderRadius: '8px',
                  border: '1px solid #dee2e6',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div className="center-info" style={{ 
                  flex: 1, 
                  display: 'flex', 
                  flexDirection: 'column',
                  width: '100%'
                }}>
                  <h4 style={{ 
                    margin: '0 0 8px 0', 
                    color: '#333',
                    fontSize: '1.3rem'
                  }}>
                    {center.name}
                  </h4>
                  <p style={{ 
                    margin: '0 0 8px 0', 
                    color: '#666',
                    fontSize: '0.9rem'
                  }}>
                    Created: {new Date(center.createdAt).toLocaleDateString()}
                  </p>
                  {center.location && (
                    <p style={{ 
                      margin: 0, 
                      color: '#666',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      width: '100%'
                    }}>
                      <Image src="/maps.svg" alt="Location" width={20} height={20} />
                      <span
                        onClick={() => window.open(center.location, '_blank')}
                        className="location-link"
                        style={{
                          color: '#1FA8DC',
                          cursor: 'pointer',
                          textDecoration: 'none',
                          fontWeight: '600',
                          fontSize: '0.95rem',
                          transition: 'all 0.2s ease',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          backgroundColor: 'transparent',
                          display: 'inline-block'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.color = '#0d5a7a';
                          e.target.style.backgroundColor = '#e9ecef';
                          e.target.style.textDecoration = 'underline';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.color = '#1FA8DC';
                          e.target.style.backgroundColor = 'transparent';
                          e.target.style.textDecoration = 'none';
                        }}
                      >
                        Location
                      </span>
                    </p>
                  )}
                </div>
                <div className="center-actions" style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleShowDetails(center)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#17a2b8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Image src="/details.svg" alt="Details" width={18} height={18} />
                    Details
                  </button>
                  <button
                    onClick={() => handleEditCenter(center)}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Image src="/edit.svg" alt="Edit" width={18} height={18} />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteCenter(center)}
                    disabled={deleteMutation.isPending}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#dc3545',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: deleteMutation.isPending ? 'not-allowed' : 'pointer',
                      fontSize: '0.9rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      opacity: deleteMutation.isPending ? 0.6 : 1
                    }}
                  >
                    <Image src="/trash2.svg" alt="Delete" width={18} height={18} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error and Success Messages - at bottom */}
        {error && (
          <div style={{
            backgroundColor: '#f8d7da',
            color: '#721c24',
            padding: '12px 16px',
            borderRadius: '8px',
            marginTop: '20px',
            border: '1px solid #f5c6cb',
            textAlign: 'center',
            fontWeight: '600'
          }}>
            ❌ {typeof error === 'string' ? error : JSON.stringify(error)}
          </div>
        )}
        {showAddSuccess && (
          <div style={{
            background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
            color: 'white',
            borderRadius: '10px',
            padding: '16px',
            marginTop: '20px',
            textAlign: 'center',
            fontWeight: '600',
            boxShadow: '0 4px 16px rgba(40, 167, 69, 0.3)'
          }}>
            ✅ Center created successfully!
          </div>
        )}
        {showEditSuccess && (
          <div style={{
            background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
            color: 'white',
            borderRadius: '10px',
            padding: '16px',
            marginTop: '20px',
            textAlign: 'center',
            fontWeight: '600',
            boxShadow: '0 4px 16px rgba(40, 167, 69, 0.3)'
          }}>
            ✅ Center updated successfully!
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div 
          className="confirm-modal"
          onClick={(e) => {
            if (e.target.classList.contains('confirm-modal')) {
              cancelDelete();
            }
          }}
        >
          <div className="confirm-content" onClick={(e) => e.stopPropagation()}>
            <h3>Confirm Delete</h3>
            <p>Are you sure you want to delete center <strong>{centerToDelete?.name}</strong>?</p>
            <p><strong>This action cannot be undone!</strong></p>
            <div className="confirm-buttons">
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="confirm-delete-btn"
              >
                {deleteMutation.isPending ? "Deleting..." : "Yes, Delete Center"}
              </button>
              <button
                onClick={cancelDelete}
                disabled={deleteMutation.isPending}
                className="cancel-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Center Modal */}
      {showAddForm && (
        <div 
          className="add-center-modal"
          onClick={(e) => {
            if (e.target.classList.contains('add-center-modal')) {
              cancelAdd();
            }
          }}
        >
          <div className="add-center-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Image src="/plus.svg" alt="Add" width={24} height={24} />
                Add New Center
              </h3>
              <button
                type="button"
                onClick={cancelAdd}
                className="close-modal-btn"
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="add-center-form">
              {error && (
                <div className="error-message-popup">
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </div>
              )}
              {showAddSuccess && (
                <div className="success-message-popup">
                  ✅ Center created successfully!
                </div>
              )}
              <div className="form-field">
                <label>Center Name <span className="required-star">*</span></label>
              <input
                type="text"
                value={newCenterName}
                onChange={(e) => setNewCenterName(e.target.value)}
                placeholder="Enter center name"
                className="add-center-input"
                onKeyPress={(e) => e.key === 'Enter' && handleAddCenter()}
                autoFocus
                  required
                />
              </div>
              <div className="form-field">
                <label>Location</label>
                <input
                  type="text"
                  value={newCenterLocation}
                  onChange={(e) => setNewCenterLocation(e.target.value)}
                  placeholder="copy the location link from google maps and paste here"
                  className="add-center-input"
                />
              </div>

              {newCenterGrades.map((gradeData, gradeIndex) => (
                <div key={gradeIndex} className="grade-section">
                  <button
                    type="button"
                    onClick={() => removeGradeFromAdd(gradeIndex)}
                    className="remove-grade-btn"
                    title="Remove grade section"
                  >
                    ✕
                  </button>
                  <div className="form-field">
                    <label>Grade</label>
                    <GradeSelect
                      selectedGrade={gradeData.grade}
                      onGradeChange={(grade) => updateGradeInAdd(gradeIndex, grade)}
                      isOpen={gradeData.gradeOpen}
                      onToggle={() => toggleGradeSelectAdd(gradeIndex)}
                      onClose={() => {
                        const updated = [...newCenterGrades];
                        updated[gradeIndex].gradeOpen = false;
                        setNewCenterGrades(updated);
                      }}
                    />
                  </div>

                  {gradeData.grade && gradeData.grade.trim() !== '' && (
                    <>
                      {gradeData.timings.map((timing, timingIndex) => {
                        // Parse time string to hours and minutes
                        const timeParts = (timing.time || '').split(':');
                        const hours = timeParts[0] || '';
                        const minutes = timeParts[1] || '';
                        
                        return (
                          <div key={timingIndex} className="timing-row">
                            <div className="form-field day-field">
                              <label>Day</label>
                              <DaySelect
                                selectedDay={timing.day}
                                onDayChange={(day) => updateTimingInAdd(gradeIndex, timingIndex, 'day', day)}
                                isOpen={timing.dayOpen}
                                onToggle={() => toggleDaySelectAdd(gradeIndex, timingIndex)}
                                onClose={() => {
                                  const updated = [...newCenterGrades];
                                  updated[gradeIndex].timings[timingIndex].dayOpen = false;
                                  setNewCenterGrades(updated);
                                }}
                              />
                            </div>
                            <div className="form-field timing-field">
                              <label>Time</label>
                              <div className="time-inputs-container">
                                <input
                                  type="number"
                                  min="1"
                                  max="12"
                                  value={hours}
                                  onChange={(e) => {
                                    const hrs = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                                    const mins = minutes;
                                    const newTime = hrs + (mins ? ':' + mins : '');
                                    updateTimingInAdd(gradeIndex, timingIndex, 'time', newTime);
                                  }}
                                  placeholder="HH"
                                  className="time-hours-input"
                                />
                                <span className="time-separator">:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  value={minutes}
                                  onChange={(e) => {
                                    const mins = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                                    const hrs = hours;
                                    const newTime = hrs + (hrs ? ':' + mins : '');
                                    updateTimingInAdd(gradeIndex, timingIndex, 'time', newTime);
                                  }}
                                  placeholder="MM"
                                  className="time-minutes-input"
                                />
                              </div>
                            </div>
                            <div className="form-field period-field">
                              <label>Period</label>
                              <div className="period-container">
                                <PeriodSelect
                                  selectedPeriod={timing.period}
                                  onPeriodChange={(period) => updateTimingInAdd(gradeIndex, timingIndex, 'period', period)}
                                  isOpen={timing.periodOpen}
                                  onToggle={() => togglePeriodSelectAdd(gradeIndex, timingIndex)}
                                  onClose={() => {
                                    const updated = [...newCenterGrades];
                                    updated[gradeIndex].timings[timingIndex].periodOpen = false;
                                    setNewCenterGrades(updated);
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeTimingFromGrade(gradeIndex, timingIndex)}
                                  className="remove-timing-btn"
                                  title="Remove timing"
                                >
                                  <Image src="/trash2.svg" alt="Remove" width={18} height={18} />
                                </button>
                              </div>
                            </div>
                            {timingIndex === gradeData.timings.length - 1 && (
                              <button
                                type="button"
                                onClick={() => addTimingToGrade(gradeIndex)}
                                className="add-timing-btn"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Image src="/plus.svg" alt="Add" width={18} height={18} />
                                Add another timing
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                  {gradeIndex === newCenterGrades.length - 1 && (
                    <button
                      type="button"
                      onClick={addNewGrade}
                      className="add-grade-btn"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Image src="/plus.svg" alt="Add" width={18} height={18} />
                      Add another grade
                    </button>
                  )}
                </div>
              ))}

              <div className="add-center-buttons">
                <button
                  onClick={handleAddCenter}
                  disabled={createMutation.isPending}
                  className="add-center-btn"
                >
                  {createMutation.isPending ? 'Saving...' : 'Add Center'}
                </button>
                <button
                  onClick={cancelAdd}
                  disabled={createMutation.isPending}
                  className="cancel-add-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Center Modal */}
      {editingCenter && (
        <div 
          className="rename-center-modal"
          onClick={(e) => {
            if (e.target.classList.contains('rename-center-modal')) {
              cancelEdit();
            }
          }}
        >
          <div className="rename-center-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Image src="/edit.svg" alt="Edit" width={24} height={24} />
                Edit Center
              </h3>
              <button
                type="button"
                onClick={cancelEdit}
                className="close-modal-btn"
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="rename-center-form">
              {error && (
                <div className="error-message-popup">
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </div>
              )}
              {showEditSuccess && !error && (
                <div className="success-message-popup">
                  ✅ Center updated successfully!
                </div>
              )}
              <div className="form-field">
                <label>Center Name <span className="required-star">*</span></label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter center name"
                className="rename-center-input"
                onKeyPress={(e) => e.key === 'Enter' && handleUpdateCenter()}
                autoFocus
                  required
                />
              </div>
              <div className="form-field">
                <label>Location</label>
                <input
                  type="text"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                  placeholder="copy the location link from google maps and paste here"
                  className="rename-center-input"
                />
              </div>

              {editGrades.map((gradeData, gradeIndex) => (
                <div key={gradeIndex} className="grade-section">
                  <button
                    type="button"
                    onClick={() => removeGradeFromEdit(gradeIndex)}
                    className="remove-grade-btn"
                    title="Remove grade section"
                  >
                    ✕
                  </button>
                  <div className="form-field">
                    <label>Grade</label>
                    <GradeSelect
                      selectedGrade={gradeData.grade}
                      onGradeChange={(grade) => updateGradeInEdit(gradeIndex, grade)}
                      isOpen={gradeData.gradeOpen}
                      onToggle={() => toggleGradeSelectEdit(gradeIndex)}
                      onClose={() => {
                        const updated = [...editGrades];
                        updated[gradeIndex].gradeOpen = false;
                        setEditGrades(updated);
                      }}
                    />
                  </div>

                  {gradeData.grade && gradeData.grade.trim() !== '' && (
                    <>
                      {gradeData.timings.map((timing, timingIndex) => {
                        // Parse time string to hours and minutes
                        const timeParts = (timing.time || '').split(':');
                        const hours = timeParts[0] || '';
                        const minutes = timeParts[1] || '';
                        
                        return (
                          <div key={timingIndex} className="timing-row">
                            <div className="form-field day-field">
                              <label>Day</label>
                              <DaySelect
                                selectedDay={timing.day}
                                onDayChange={(day) => updateTimingInEdit(gradeIndex, timingIndex, 'day', day)}
                                isOpen={timing.dayOpen}
                                onToggle={() => toggleDaySelectEdit(gradeIndex, timingIndex)}
                                onClose={() => {
                                  const updated = [...editGrades];
                                  updated[gradeIndex].timings[timingIndex].dayOpen = false;
                                  setEditGrades(updated);
                                }}
                              />
                            </div>
                            <div className="form-field timing-field">
                              <label>Time</label>
                              <div className="time-inputs-container">
                                <input
                                  type="number"
                                  min="1"
                                  max="12"
                                  value={hours}
                                  onChange={(e) => {
                                    const hrs = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                                    const mins = minutes;
                                    const newTime = hrs + (mins ? ':' + mins : '');
                                    updateTimingInEdit(gradeIndex, timingIndex, 'time', newTime);
                                  }}
                                  placeholder="HH"
                                  className="time-hours-input"
                                />
                                <span className="time-separator">:</span>
                                <input
                                  type="number"
                                  min="0"
                                  max="59"
                                  value={minutes}
                                  onChange={(e) => {
                                    const mins = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                                    const hrs = hours;
                                    const newTime = hrs + (hrs ? ':' + mins : '');
                                    updateTimingInEdit(gradeIndex, timingIndex, 'time', newTime);
                                  }}
                                  placeholder="MM"
                                  className="time-minutes-input"
                                />
                              </div>
                            </div>
                            <div className="form-field period-field">
                              <label>Period</label>
                              <div className="period-container">
                                <PeriodSelect
                                  selectedPeriod={timing.period}
                                  onPeriodChange={(period) => updateTimingInEdit(gradeIndex, timingIndex, 'period', period)}
                                  isOpen={timing.periodOpen}
                                  onToggle={() => togglePeriodSelectEdit(gradeIndex, timingIndex)}
                                  onClose={() => {
                                    const updated = [...editGrades];
                                    updated[gradeIndex].timings[timingIndex].periodOpen = false;
                                    setEditGrades(updated);
                                  }}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeTimingFromEditGrade(gradeIndex, timingIndex)}
                                  className="remove-timing-btn"
                                  title="Remove timing"
                                >
                                  <Image src="/trash2.svg" alt="Remove" width={18} height={18} />
                                </button>
                              </div>
                            </div>
                            {timingIndex === gradeData.timings.length - 1 && (
                              <button
                                type="button"
                                onClick={() => addTimingToEditGrade(gradeIndex)}
                                className="add-timing-btn"
                                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                              >
                                <Image src="/plus.svg" alt="Add" width={18} height={18} />
                                Add another timing
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </>
                  )}

                  {gradeIndex === editGrades.length - 1 && (
                    <button
                      type="button"
                      onClick={addEditGrade}
                      className="add-grade-btn"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Image src="/plus.svg" alt="Add" width={18} height={18} />
                      Add another grade
                    </button>
                  )}
                </div>
              ))}

              <div className="rename-center-buttons">
                <button
                  onClick={handleUpdateCenter}
                  disabled={updateMutation.isPending}
                  className="rename-center-btn"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={updateMutation.isPending}
                  className="cancel-rename-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && centerDetails && (
        <div 
          className="details-modal"
          onClick={(e) => {
            if (e.target.classList.contains('details-modal')) {
              handleCloseDetails();
            }
          }}
        >
          <div className="details-content" onClick={(e) => e.stopPropagation()}>
            <div className="details-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Image src="/details.svg" alt="Details" width={24} height={24} />
                Center Details
              </h3>
              <button
                type="button"
                onClick={handleCloseDetails}
                className="close-details-btn"
                title="Close"
              >
                ✕
              </button>
            </div>
            <div className="details-body">
              <div className="details-info">
                <h4>{centerDetails.name}</h4>
                {centerDetails.location && (
                  <p style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Image src="/maps.svg" alt="Location" width={20} height={20} />
                    <span
                      onClick={() => window.open(centerDetails.location, '_blank')}
                      className="details-location-link"
                    >
                      {centerDetails.location}
                    </span>
                  </p>
                )}
              </div>
              
              {centerDetails.grades && centerDetails.grades.length > 0 ? (
                <div className="details-table-container">
                  <table className="details-table">
                    <thead>
                      <tr>
                        <th>Grade</th>
                        <th>Day</th>
                        <th>Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {centerDetails.grades.map((grade, gradeIndex) => {
                        if (grade.timings && grade.timings.length > 0) {
                          return grade.timings.map((timing, timingIndex) => (
                            <tr key={`${gradeIndex}-${timingIndex}`}>
                              {timingIndex === 0 && (
                                <td rowSpan={grade.timings.length}>{grade.grade}</td>
                              )}
                              <td>{timing.day}</td>
                              <td>{timing.time} {timing.period}</td>
                            </tr>
                          ));
                        }
                        return null;
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="no-grades-message">
                  <p>No grades or timings configured for this center.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .center-info {
          display: flex;
          flex-direction: column;
          width: 100%;
        }
        
        .confirm-modal {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.25);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
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
          flex-wrap: wrap;
        }
        .confirm-delete-btn {
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
        .confirm-delete-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .cancel-btn {
          background: #03a9f4;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: background 0.2s;
        }
        
        /* Add Center Modal Styles */
        .add-center-modal {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.25);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .add-center-content {
          background: #fff;
          border-radius: 12px;
          padding: 32px 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          max-width: 500px;
          width: 100%;
          max-height: 95vh;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }
        .modal-header h3 {
          margin: 0;
          color: #333;
          font-size: 1.5rem;
          font-weight: 600;
          text-align: left;
        }
        .close-modal-btn {
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-size: 18px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          padding: 0;
          line-height: 1;
          flex-shrink: 0;
        }
        .close-modal-btn:hover {
          background: #c82333;
          transform: scale(1.1);
        }
        .close-modal-btn:active {
          transform: scale(0.95);
        }
        .add-center-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .form-field {
          margin-bottom: 16px;
        }
        .form-field label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #333;
          font-size: 0.9rem;
        }
        .required-star {
          color: #dc3545 !important;
          font-weight: 700;
          font-size: 1.1rem;
        }
        .error-message-popup {
          background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
          color: white;
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 20px;
          text-align: center;
          font-weight: 600;
          box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3);
        }
        .success-message-popup {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border-radius: 10px;
          padding: 16px;
          margin-bottom: 20px;
          text-align: center;
          font-weight: 600;
          box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
        }
        .add-center-input, .rename-center-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .add-center-input:focus, .rename-center-input:focus {
          border-color: #007bff;
        }
        .grade-section {
          margin-top: 24px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
          border: 1px solid #e9ecef;
          position: relative;
        }
        .remove-grade-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          padding: 0;
          line-height: 1;
        }
        .remove-grade-btn:hover {
          background: #c82333;
          transform: scale(1.1);
        }
        .remove-grade-btn:active {
          transform: scale(0.95);
        }
        .timing-row {
          display: flex;
          gap: 12px;
          align-items: flex-end;
          margin-top: 12px;
          flex-wrap: wrap;
        }
        .day-field {
          flex: 1;
          min-width: 140px;
          margin-bottom: 0;
        }
        .timing-field {
          margin-bottom: 0;
        }
        .time-inputs-container {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .time-hours-input, .time-minutes-input {
          width: 60px;
          padding: 12px 8px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          text-align: center;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .time-hours-input:focus, .time-minutes-input:focus {
          border-color: #007bff;
        }
        .time-separator {
          font-size: 1.2rem;
          font-weight: 600;
          color: #333;
          padding: 0 4px;
        }
        .period-field {
          flex: 1;
          min-width: 120px;
          margin-bottom: 0;
        }
        .period-container {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .period-container > div {
          flex: 1;
        }
        .remove-timing-btn {
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 12px;
          cursor: pointer;
          font-size: 1rem;
          transition: background 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 44px;
          height: 44px;
        }
        .remove-timing-btn:hover {
          background: #c82333;
        }
        .remove-timing-btn:active {
          transform: scale(0.95);
        }
        .add-timing-btn, .add-grade-btn {
          background: #17a2b8;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 16px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .add-timing-btn:hover, .add-grade-btn:hover {
          background: #138496;
        }
        .add-timing-btn {
          margin-top: 0;
          margin-left: auto;
        }
        .add-center-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .add-center-btn {
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .add-center-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .cancel-add-btn {
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
        
        /* Rename Center Modal Styles */
        .rename-center-modal {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.25);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .rename-center-content {
          background: #fff;
          border-radius: 12px;
          padding: 32px 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.15);
          max-width: 500px;
          width: 100%;
          max-height: 95vh;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .rename-center-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .rename-center-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .rename-center-input:focus {
          border-color: #007bff;
        }
        .rename-center-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .rename-center-btn {
          background: linear-gradient(135deg, #007bff 0%, #0056b3 100%);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-weight: 600;
          font-size: 1rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .rename-center-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .cancel-rename-btn {
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
        
        /* Details Modal Styles */
        .details-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(5px);
          -webkit-backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .details-content {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          max-width: 800px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          overflow-x: hidden;
        }
        .details-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 24px 20px 24px;
          border-bottom: 1px solid #e9ecef;
        }
        .details-header h3 {
          margin: 0;
          color: #333;
          font-size: 1.5rem;
          font-weight: 600;
        }
        .close-details-btn {
          background: #dc3545;
          color: white;
          border: none;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          cursor: pointer;
          font-size: 18px;
          font-weight: 700;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          padding: 0;
          line-height: 1;
          flex-shrink: 0;
        }
        .close-details-btn:hover {
          background: #c82333;
          transform: scale(1.1);
        }
        .close-details-btn:active {
          transform: scale(0.95);
        }
        .details-body {
          padding: 24px;
        }
        .details-info {
          margin-bottom: 24px;
        }
        .details-info h4 {
          margin: 0 0 12px 0;
          color: #333;
          font-size: 1.3rem;
          font-weight: 600;
        }
        .details-info p {
          margin: 0;
          color: #666;
          font-size: 0.95rem;
        }
        .details-location-link {
          color: #1FA8DC;
          cursor: pointer;
          text-decoration: underline;
          transition: color 0.2s;
        }
        .details-location-link:hover {
          color: #0d5a7a;
        }
        .details-table-container {
          overflow-x: auto;
          border: 1px solid #e9ecef;
          border-radius: 8px;
        }
        .details-table {
          width: 100%;
          border-collapse: collapse;
          background: #fff;
        }
        .details-table thead {
          background: #f8f9fa;
        }
        .details-table th {
          padding: 12px 16px;
          text-align: center;
          font-weight: 600;
          color: #333;
          border-bottom: 2px solid #dee2e6;
          font-size: 0.95rem;
        }
        .details-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #e9ecef;
          color: #666;
          font-size: 0.9rem;
          text-align: center;
        }
        .details-table tbody tr:hover {
          background: #f8f9fa;
        }
        .details-table tbody tr:last-child td {
          border-bottom: none;
        }
        .no-grades-message {
          text-align: center;
          padding: 40px 20px;
          color: #999;
        }
        .no-grades-message p {
          margin: 0;
          font-size: 1rem;
        }
        
        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
          .centers-page-container {
            margin: 20px auto !important;
            padding: 15px 10px !important;
            max-width: 100% !important;
          }
          
          .main-container {
            margin: 20px auto !important;
            padding: 15px 10px !important;
            max-width: 95% !important;
          }
          
          .container-header {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 16px !important;
          }
          
          .container-header h2 {
            font-size: 1.5rem !important;
            text-align: center !important;
          }
          
          .container-header p {
            text-align: center !important;
          }
          
          .add-center-btn {
            width: 100% !important;
            justify-content: center !important;
          }
          
          .center-card {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 16px !important;
          }
          
          .center-info {
            text-align: center !important;
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            align-items: center !important;
          }
          
          .center-info p {
            display: flex !important;
            justify-content: center !important;
          }
          
          .center-actions {
            display: flex !important;
            gap: 8px !important;
            justify-content: center !important;
          }
          
          .center-actions button {
            flex: 1 !important;
            min-width: 0 !important;
            justify-content: center !important;
            text-align: center !important;
          }
          
          .confirm-content {
            margin: 20px;
            padding: 24px 16px;
          }
          
          .confirm-buttons {
            flex-direction: column !important;
            gap: 12px !important;
          }
          
          .confirm-buttons button {
            width: 100% !important;
          }
          
          .add-center-content, .rename-center-content {
            margin: 10px !important;
            padding: 20px 16px !important;
            max-width: calc(100% - 20px) !important;
          }
          
          .add-center-buttons, .rename-center-buttons {
            flex-direction: column !important;
            gap: 12px !important;
          }
          
          .add-center-buttons button, .rename-center-buttons button {
            width: 100% !important;
          }
          
          .timing-row {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          
          .day-field, .timing-field, .period-field {
            width: 100% !important;
            min-width: 100% !important;
          }
          
          .time-inputs-container {
            width: 100%;
            justify-content: center;
          }
          
          .time-hours-input, .time-minutes-input {
            flex: 1;
            min-width: 80px;
          }
          
          .period-container {
            width: 100%;
          }
          
          .remove-timing-btn {
            min-width: 50px;
          }
          
          .grade-section {
            padding: 12px !important;
          }
          
          .add-timing-btn, .add-grade-btn {
            width: 100% !important;
            justify-content: center !important;
            margin-left: 0 !important;
          }
          
          .center-info h4 {
            font-size: 1.1rem !important;
          }
          
          .center-info p {
            font-size: 0.85rem !important;
          }
          
          .location-link {
            font-size: 0.9rem !important;
            padding: 6px 10px !important;
            min-height: 32px !important;
            display: inline-flex !important;
            align-items: center !important;
          }
          
          .details-content {
            margin: 10px !important;
            padding: 0 !important;
            max-width: calc(100% - 20px) !important;
          }
          
          .details-header {
            padding: 20px 16px 16px 16px !important;
          }
          
          .details-header h3 {
            font-size: 1.3rem !important;
          }
          
          .details-body {
            padding: 16px !important;
          }
          
          .details-info h4 {
            font-size: 1.1rem !important;
          }
          
          .details-table {
            font-size: 0.85rem !important;
          }
          
          .details-table th,
          .details-table td {
            padding: 10px 12px !important;
          }
        }
        
        @media (max-width: 480px) {
          .centers-page-container {
            margin: 10px auto !important;
            padding: 10px 8px !important;
            max-width: 100% !important;
          }
          
          .main-container {
            margin: 10px auto !important;
            padding: 10px 8px !important;
          }
          
          .container-header h2 {
            font-size: 1.3rem !important;
          }
          
          .center-card {
            padding: 15px !important;
          }
          
          .center-actions {
            flex-direction: column !important;
            gap: 8px !important;
          }
          
          .center-info h4 {
            font-size: 1rem !important;
            margin-bottom: 6px !important;
          }
          
          .center-info p {
            font-size: 0.8rem !important;
            margin-bottom: 6px !important;
          }
          
          .location-link {
            font-size: 0.85rem !important;
            padding: 5px 8px !important;
            min-height: 30px !important;
          }
          
          .center-actions button {
            font-size: 0.85rem !important;
            padding: 10px 14px !important;
          }
          
          .details-content {
            margin: 5px !important;
            max-width: calc(100% - 10px) !important;
          }
          
          .details-header {
            padding: 16px 12px 12px 12px !important;
          }
          
          .details-header h3 {
            font-size: 1.2rem !important;
          }
          
          .details-body {
            padding: 12px !important;
          }
          
          .details-table th,
          .details-table td {
            padding: 8px 10px !important;
            font-size: 0.8rem !important;
          }
        }
      `}</style>
    </div>
  );
}

