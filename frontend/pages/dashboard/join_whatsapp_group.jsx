import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Image from 'next/image';
import apiClient from '../../lib/axios';
import Title from '../../components/Title';
import GradeSelect from '../../components/GradeSelect';
import CenterSelect from '../../components/CenterSelect';
import { useSystemConfig } from '../../lib/api/system';

// API functions
const whatsappGroupAPI = {
  getGroups: async () => {
    const response = await apiClient.get('/api/join-whatsapp-group');
    return response.data.groups;
  },

  createGroup: async (data) => {
    const response = await apiClient.post('/api/join-whatsapp-group', data);
    return response.data;
  },

  updateGroup: async (id, data) => {
    const response = await apiClient.put('/api/join-whatsapp-group', { id, ...data });
    return response.data;
  },

  deleteGroup: async (id) => {
    const response = await apiClient.delete('/api/join-whatsapp-group', { data: { id } });
    return response.data;
  }
};

// Custom GenderSelect with "Both" option
function GenderSelectWithBoth({ selectedGender, onGenderChange, isOpen, onToggle, onClose }) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleGenderSelect = (gender) => {
    onGenderChange(gender);
    onClose();
  };

  const genders = ["Male", "Female", "Both"];

  return (
    <div ref={dropdownRef} style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          padding: '14px 16px',
          border: isOpen ? '2px solid #1FA8DC' : '2px solid #e9ecef',
          borderRadius: '10px',
          backgroundColor: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '1rem',
          color: selectedGender ? '#000000' : '#adb5bd',
          transition: 'all 0.3s ease',
          boxShadow: isOpen ? '0 0 0 3px rgba(31, 168, 220, 0.1)' : 'none'
        }}
        onClick={onToggle}
      >
        <span>{selectedGender || 'Select Gender'}</span>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          backgroundColor: '#ffffff',
          border: '2px solid #e9ecef',
          borderRadius: '10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
          zIndex: 1000,
          maxHeight: '200px',
          overflowY: 'auto',
          marginTop: '4px'
        }}>
          <div
            style={{
              padding: '12px 16px',
              cursor: 'pointer',
              borderBottom: '1px solid #f8f9fa',
              transition: 'background-color 0.2s ease',
              color: '#dc3545',
              fontWeight: '500'
            }}
            onClick={() => handleGenderSelect('')}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#fff5f5'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
          >
            ✕ Clear selection
          </div>
          {genders.map((gender) => (
            <div
              key={gender}
              style={{
                padding: '12px 16px',
                cursor: 'pointer',
                borderBottom: '1px solid #f8f9fa',
                transition: 'background-color 0.2s ease',
                color: '#000000'
              }}
              onClick={() => handleGenderSelect(gender)}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f8f9fa'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#ffffff'}
            >
              {gender}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function JoinWhatsappGroup() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: systemConfig } = useSystemConfig();
  const isWhatsAppJoinGroupEnabled = systemConfig?.whatsapp_join_group_btn === true || systemConfig?.whatsapp_join_group_btn === 'true';
  
  // Redirect if feature is disabled
  useEffect(() => {
    if (systemConfig && !isWhatsAppJoinGroupEnabled) {
      router.push('/dashboard');
    }
  }, [systemConfig, isWhatsAppJoinGroupEnabled, router]);
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newGrade, setNewGrade] = useState('');
  const [newCenter, setNewCenter] = useState('');
  const [newGender, setNewGender] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newGradeOpen, setNewGradeOpen] = useState(false);
  const [newCenterOpen, setNewCenterOpen] = useState(false);
  const [newGenderOpen, setNewGenderOpen] = useState(false);
  
  const [editingGroup, setEditingGroup] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editCenter, setEditCenter] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editLink, setEditLink] = useState('');
  const [editGradeOpen, setEditGradeOpen] = useState(false);
  const [editCenterOpen, setEditCenterOpen] = useState(false);
  const [editGenderOpen, setEditGenderOpen] = useState(false);
  
  const [error, setError] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState(null);
  const [showAddSuccess, setShowAddSuccess] = useState(false);
  const [showEditSuccess, setShowEditSuccess] = useState(false);

  // Fetch groups
  const { data: groups = [], isLoading, error: fetchError } = useQuery({
    queryKey: ['whatsapp-groups'],
    queryFn: () => whatsappGroupAPI.getGroups(),
    retry: 3,
    retryDelay: 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // Create group mutation
  const createMutation = useMutation({
    mutationFn: (data) => whatsappGroupAPI.createGroup(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      setShowAddSuccess(true);
      setError('');
      setTimeout(() => {
        setShowAddForm(false);
        setNewTitle('');
        setNewGrade('');
        setNewCenter('');
        setNewGender('');
        setNewLink('');
        setShowAddSuccess(false);
      }, 2000);
    },
    onError: (error) => {
      setError(error.response?.data?.error || 'Failed to create group');
    }
  });

  // Update group mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => whatsappGroupAPI.updateGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      setShowEditSuccess(true);
      setError('');
      setTimeout(() => {
        setEditingGroup(null);
        setEditTitle('');
        setEditGrade('');
        setEditCenter('');
        setEditGender('');
        setEditLink('');
        setShowEditSuccess(false);
      }, 2000);
    },
    onError: (error) => {
      setError(error.response?.data?.error || 'Failed to update group');
    }
  });

  // Delete group mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => whatsappGroupAPI.deleteGroup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-groups'] });
      setError('');
    },
    onError: (error) => {
      setError(error.response?.data?.error || 'Failed to delete group');
    }
  });

  // Auto-hide error message
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Auto-hide success messages
  useEffect(() => {
    if (showAddSuccess) {
      const timer = setTimeout(() => setShowAddSuccess(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [showAddSuccess]);

  useEffect(() => {
    if (showEditSuccess) {
      const timer = setTimeout(() => setShowEditSuccess(false), 6000);
      return () => clearTimeout(timer);
    }
  }, [showEditSuccess]);

  const handleAddGroup = () => {
    if (!newTitle.trim() || !newGrade || !newGender || !newLink.trim()) {
      setError('Title, Grade, Gender, and Link are required');
      return;
    }
    
    if (!newLink.trim().startsWith('https://chat.whatsapp.com')) {
      setError('Group link must start with https://chat.whatsapp.com');
      return;
    }
    
    createMutation.mutate({
      title: newTitle.trim(),
      grade: newGrade,
      center: newCenter || '',
      gender: newGender,
      link: newLink.trim()
    });
  };

  const handleEditGroup = (group) => {
    setEditingGroup(group);
    setEditTitle(group.title || '');
    setEditGrade(group.grade || '');
    setEditCenter(group.center || '');
    setEditGender(group.gender || '');
    setEditLink(group.link || '');
    setError('');
  };

  const handleUpdateGroup = () => {
    if (!editTitle.trim() || !editGrade || !editGender || !editLink.trim()) {
      setError('Title, Grade, Gender, and Link are required');
      return;
    }
    
    if (!editLink.trim().startsWith('https://chat.whatsapp.com')) {
      setError('Group link must start with https://chat.whatsapp.com');
      return;
    }
    
    updateMutation.mutate({ 
      id: editingGroup._id, 
      data: {
        title: editTitle.trim(),
        grade: editGrade,
        center: editCenter || '',
        gender: editGender,
        link: editLink.trim()
      }
    });
  };

  const handleDeleteGroup = (group) => {
    setGroupToDelete(group);
    setShowConfirm(true);
  };

  const confirmDelete = () => {
    if (groupToDelete) {
      deleteMutation.mutate(groupToDelete._id);
      setShowConfirm(false);
      setGroupToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowConfirm(false);
    setGroupToDelete(null);
  };

  const cancelEdit = () => {
    setEditingGroup(null);
    setEditTitle('');
    setEditGrade('');
    setEditCenter('');
    setEditGender('');
    setEditLink('');
    setError('');
  };

  const cancelAdd = () => {
    setShowAddForm(false);
    setNewTitle('');
    setNewGrade('');
    setNewCenter('');
    setNewGender('');
    setNewLink('');
    setError('');
  };

  // Don't render if feature is disabled
  if (systemConfig && !isWhatsAppJoinGroupEnabled) {
    return null;
  }

  if (fetchError) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>Error Loading WhatsApp Groups</h1>
        <p style={{ color: '#dc3545' }}>
          {fetchError.response?.data?.error || fetchError.message || 'Failed to load groups'}
        </p>
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
    <div className="whatsapp-groups-page-container" style={{ 
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      maxWidth: "800px",
      margin: "40px auto",
      padding: "20px 15px 20px 15px" 
    }}>
      <Title style={{ justifyContent: 'space-between', gap: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image src="/message.svg" alt="WhatsApp Groups" width={32} height={32} />
          Join WhatsApp Group
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
              WhatsApp Groups
            </h2>
            <p style={{ 
              margin: '8px 0 0 0', 
              color: '#666',
              fontSize: '1rem'
            }}>
              Manage WhatsApp groups for students
            </p>
          </div>
          
          <button
            className="add-group-btn"
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
            Add Group
          </button>
        </div>

        {/* Groups List */}
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
              Loading groups...
            </div>
          </div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <h3 style={{ color: '#666', margin: '0 0 16px 0' }}>No Groups Found</h3>
            <p style={{ color: '#999', margin: 0 }}>
              Click "Add Group" to create your first WhatsApp group.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '16px' }}>
            {groups.map((group) => (
              <div
                key={group._id}
                className="group-card"
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
                <div className="group-info" style={{ 
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
                    {group.title}
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>
                      <strong>Grade:</strong> {group.grade}
                    </span>
                    {group.center && group.center.trim() !== '' && (
                      <span style={{ color: '#666', fontSize: '0.9rem' }}>
                        <strong>Center:</strong> {group.center}
                      </span>
                    )}
                    <span style={{ color: '#666', fontSize: '0.9rem' }}>
                      <strong>Gender:</strong> {group.gender}
                    </span>
                  </div>
                  {group.link && (
                    <a
                      href={group.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#1FA8DC',
                        textDecoration: 'none',
                        fontWeight: '600',
                        fontSize: '0.95rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'all 0.2s ease',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'transparent'
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
                      <Image src="/message.svg" alt="Link" width={18} height={18} />
                      Join Group
                    </a>
                  )}
                </div>
                <div className="group-actions" style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => handleEditGroup(group)}
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
                    onClick={() => handleDeleteGroup(group)}
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

        {/* Error and Success Messages */}
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
            ✅ Group created successfully!
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
            ✅ Group updated successfully!
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
            <p>Are you sure you want to delete group <strong>{groupToDelete?.title}</strong>?</p>
            <p><strong>This action cannot be undone!</strong></p>
            <div className="confirm-buttons">
              <button
                onClick={confirmDelete}
                disabled={deleteMutation.isPending}
                className="confirm-delete-btn"
              >
                {deleteMutation.isPending ? "Deleting..." : "Yes, Delete Group"}
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

      {/* Add Group Modal */}
      {showAddForm && (
        <div 
          className="add-group-modal"
          onClick={(e) => {
            if (e.target.classList.contains('add-group-modal')) {
              cancelAdd();
            }
          }}
        >
          <div className="add-group-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Image src="/plus.svg" alt="Add" width={24} height={24} />
                Add New WhatsApp Group
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
            <div className="add-group-form">
              <div className="form-field">
                <label>Title <span className="required-star">*</span></label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Enter group title"
                  className="add-group-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddGroup()}
                  autoFocus
                  required
                />
              </div>
              
              <div className="form-field">
                <label>Grade <span className="required-star">*</span></label>
                <GradeSelect
                  selectedGrade={newGrade}
                  onGradeChange={(grade) => {
                    setNewGrade(grade);
                    setNewGradeOpen(false);
                  }}
                  isOpen={newGradeOpen}
                  onToggle={() => {
                    setNewGradeOpen(!newGradeOpen);
                    setNewCenterOpen(false);
                    setNewGenderOpen(false);
                  }}
                  onClose={() => setNewGradeOpen(false)}
                />
              </div>
              
              <div className="form-field">
                <label>Center</label>
                <CenterSelect
                  selectedCenter={newCenter}
                  onCenterChange={(center) => {
                    setNewCenter(center);
                    setNewCenterOpen(false);
                  }}
                  isOpen={newCenterOpen}
                  onToggle={() => {
                    setNewCenterOpen(!newCenterOpen);
                    setNewGradeOpen(false);
                    setNewGenderOpen(false);
                  }}
                  onClose={() => setNewCenterOpen(false)}
                />
              </div>
              
              <div className="form-field">
                <label>Gender <span className="required-star">*</span></label>
                <GenderSelectWithBoth
                  selectedGender={newGender}
                  onGenderChange={(gender) => {
                    setNewGender(gender);
                    setNewGenderOpen(false);
                  }}
                  isOpen={newGenderOpen}
                  onToggle={() => {
                    setNewGenderOpen(!newGenderOpen);
                    setNewGradeOpen(false);
                    setNewCenterOpen(false);
                  }}
                  onClose={() => setNewGenderOpen(false)}
                />
              </div>
              
              <div className="form-field">
                <label>Whatsapp Group Link <span className="required-star">*</span></label>
                <input
                  type="url"
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="add-group-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddGroup()}
                  required
                />
              </div>

              {error && (
                <div className="error-message-popup">
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </div>
              )}
              {showAddSuccess && (
                <div className="success-message-popup">
                  ✅ Group created successfully!
                </div>
              )}

              <div className="add-group-buttons">
                <button
                  onClick={handleAddGroup}
                  disabled={createMutation.isPending}
                  className="add-group-btn"
                >
                  {createMutation.isPending ? 'Saving...' : 'Save'}
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

      {/* Edit Group Modal */}
      {editingGroup && (
        <div 
          className="edit-group-modal"
          onClick={(e) => {
            if (e.target.classList.contains('edit-group-modal')) {
              cancelEdit();
            }
          }}
        >
          <div className="edit-group-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Image src="/edit.svg" alt="Edit" width={24} height={24} />
                Edit WhatsApp Group
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
            <div className="edit-group-form">
              <div className="form-field">
                <label>Title <span className="required-star">*</span></label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Enter group title"
                  className="edit-group-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleUpdateGroup()}
                  autoFocus
                  required
                />
              </div>
              
              <div className="form-field">
                <label>Grade <span className="required-star">*</span></label>
                <GradeSelect
                  selectedGrade={editGrade}
                  onGradeChange={(grade) => {
                    setEditGrade(grade);
                    setEditGradeOpen(false);
                  }}
                  isOpen={editGradeOpen}
                  onToggle={() => {
                    setEditGradeOpen(!editGradeOpen);
                    setEditCenterOpen(false);
                    setEditGenderOpen(false);
                  }}
                  onClose={() => setEditGradeOpen(false)}
                />
              </div>
              
              <div className="form-field">
                <label>Center</label>
                <CenterSelect
                  selectedCenter={editCenter}
                  onCenterChange={(center) => {
                    setEditCenter(center);
                    setEditCenterOpen(false);
                  }}
                  isOpen={editCenterOpen}
                  onToggle={() => {
                    setEditCenterOpen(!editCenterOpen);
                    setEditGradeOpen(false);
                    setEditGenderOpen(false);
                  }}
                  onClose={() => setEditCenterOpen(false)}
                />
              </div>
              
              <div className="form-field">
                <label>Gender <span className="required-star">*</span></label>
                <GenderSelectWithBoth
                  selectedGender={editGender}
                  onGenderChange={(gender) => {
                    setEditGender(gender);
                    setEditGenderOpen(false);
                  }}
                  isOpen={editGenderOpen}
                  onToggle={() => {
                    setEditGenderOpen(!editGenderOpen);
                    setEditGradeOpen(false);
                    setEditCenterOpen(false);
                  }}
                  onClose={() => setEditGenderOpen(false)}
                />
              </div>
              
              <div className="form-field">
                <label>Whatsapp Group Link <span className="required-star">*</span></label>
                <input
                  type="url"
                  value={editLink}
                  onChange={(e) => setEditLink(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="edit-group-input"
                  onKeyPress={(e) => e.key === 'Enter' && handleUpdateGroup()}
                  required
                />
              </div>

              {error && (
                <div className="error-message-popup">
                  {typeof error === 'string' ? error : JSON.stringify(error)}
                </div>
              )}
              {showEditSuccess && !error && (
                <div className="success-message-popup">
                  ✅ Group updated successfully!
                </div>
              )}

              <div className="edit-group-buttons">
                <button
                  onClick={handleUpdateGroup}
                  disabled={updateMutation.isPending}
                  className="edit-group-btn"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={updateMutation.isPending}
                  className="cancel-edit-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .group-info {
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
        
        /* Add/Edit Group Modal Styles */
        .add-group-modal, .edit-group-modal {
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
        .add-group-content, .edit-group-content {
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
        .add-group-form, .edit-group-form {
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
        .add-group-input, .edit-group-input {
          width: 100%;
          padding: 12px 16px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 1rem;
          outline: none;
          transition: border-color 0.2s;
          box-sizing: border-box;
        }
        .add-group-input:focus, .edit-group-input:focus {
          border-color: #007bff;
        }
        .add-group-buttons, .edit-group-buttons {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .add-group-btn, .edit-group-btn {
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
        .add-group-btn:disabled, .edit-group-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .cancel-add-btn, .cancel-edit-btn {
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
        
        /* Mobile Responsive Styles */
        @media (max-width: 768px) {
          .whatsapp-groups-page-container {
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
          
          .add-group-btn {
            width: 100% !important;
            justify-content: center !important;
          }
          
          .group-card {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 16px !important;
          }
          
          .group-info {
            text-align: center !important;
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            align-items: center !important;
          }
          
          .group-actions {
            display: flex !important;
            gap: 8px !important;
            justify-content: center !important;
          }
          
          .group-actions button {
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
          
          .add-group-content, .edit-group-content {
            margin: 10px !important;
            padding: 20px 16px !important;
            max-width: calc(100% - 20px) !important;
          }
          
          .add-group-buttons, .edit-group-buttons {
            flex-direction: column !important;
            gap: 12px !important;
          }
          
          .add-group-buttons button, .edit-group-buttons button {
            width: 100% !important;
          }
          
          .group-info h4 {
            font-size: 1.1rem !important;
          }
          
          .group-info span {
            font-size: 0.85rem !important;
          }
        }
        
        @media (max-width: 480px) {
          .whatsapp-groups-page-container {
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
          
          .group-card {
            padding: 15px !important;
          }
          
          .group-actions {
            flex-direction: column !important;
            gap: 8px !important;
          }
          
          .group-info h4 {
            font-size: 1rem !important;
            margin-bottom: 6px !important;
          }
          
          .group-info span {
            font-size: 0.8rem !important;
            margin-bottom: 6px !important;
          }
          
          .group-actions button {
            font-size: 0.85rem !important;
            padding: 10px 14px !important;
          }
        }
      `}</style>
    </div>
  );
}
