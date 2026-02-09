import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../lib/axios';
import { useProfile } from '../../../lib/api/auth';
import Title from '../../../components/Title';
import { Button, TextInput, NumberInput, Select, ActionIcon } from '@mantine/core';
import { IconEdit, IconTrash, IconPlus } from '@tabler/icons-react';
import Image from 'next/image';

export default function ManageDefaults() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const [accessDenied, setAccessDenied] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [formData, setFormData] = useState({
    type: '',
    withDegree: undefined,
    rules: [],
    bonusRules: []
  });
  const [editingRuleIndex, setEditingRuleIndex] = useState(null);
  const [editingBonusIndex, setEditingBonusIndex] = useState(null);
  const [ruleForm, setRuleForm] = useState({});
  const [bonusForm, setBonusForm] = useState({});

  useEffect(() => {
    if (!profileLoading && profile) {
      const allowedRoles = ['admin', 'developer'];
      if (!allowedRoles.includes(profile.role)) {
        setAccessDenied(true);
      }
    }
  }, [profile, profileLoading]);

  // Fetch scoring conditions
  const { data: conditionsData, isLoading } = useQuery({
    queryKey: ['scoring-conditions'],
    queryFn: async () => {
      const response = await apiClient.get('/api/scoring/conditions');
      return response.data;
    },
  });

  const conditions = conditionsData?.conditions || [];

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiClient.put('/api/scoring/conditions', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['scoring-conditions']);
      setEditModalOpen(false);
      setSelectedCondition(null);
      resetForm();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const response = await apiClient.delete('/api/scoring/conditions', { data: { id } });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['scoring-conditions']);
      setDeleteModalOpen(false);
      setSelectedCondition(null);
    },
  });

  const resetForm = () => {
    setFormData({
      type: '',
      withDegree: undefined,
      rules: [],
      bonusRules: []
    });
    setRuleForm({});
    setBonusForm({});
    setEditingRuleIndex(null);
    setEditingBonusIndex(null);
  };

  const handleEdit = (condition) => {
    setSelectedCondition(condition);
    setFormData({
      type: condition.type,
      withDegree: condition.withDegree,
      rules: condition.rules || [],
      bonusRules: condition.bonusRules || []
    });
    setEditModalOpen(true);
  };

  const handleDelete = (condition) => {
    setSelectedCondition(condition);
    setDeleteModalOpen(true);
  };

  const handleSave = () => {
    if (selectedCondition) {
      // Validate bonus rules if they exist
      if (formData.bonusRules && formData.bonusRules.length > 0) {
        for (const bonus of formData.bonusRules) {
          if (!bonus.condition?.lastN || bonus.condition?.lastN === '' || bonus.condition?.lastN === null || bonus.condition?.lastN === undefined) {
            alert('Please fill all required fields in bonus rules (Number Of Weeks, Required Percentage, Bonus Points)');
            return;
          }
          if (!bonus.condition?.percentage || bonus.condition?.percentage === '' || bonus.condition?.percentage === null || bonus.condition?.percentage === undefined) {
            alert('Please fill all required fields in bonus rules (Number Of Weeks, Required Percentage, Bonus Points)');
            return;
          }
          if (!bonus.points || bonus.points === '' || bonus.points === null || bonus.points === undefined) {
            alert('Please fill all required fields in bonus rules (Number Of Weeks, Required Percentage, Bonus Points)');
            return;
          }
        }
      }
      
      updateMutation.mutate({
        id: selectedCondition._id,
        ...formData
      });
    }
  };

  const handleDeleteConfirm = () => {
    if (selectedCondition) {
      deleteMutation.mutate(selectedCondition._id);
    }
  };

  const addRule = () => {
    const newRule = getDefaultRule(formData.type, formData.withDegree);
    setFormData({
      ...formData,
      rules: [...formData.rules, newRule]
    });
    setRuleForm({});
  };

  const editRule = (index) => {
    setEditingRuleIndex(index);
    setRuleForm({ ...formData.rules[index] });
  };

  const saveRule = () => {
    const updatedRules = [...formData.rules];
    updatedRules[editingRuleIndex] = ruleForm;
    setFormData({
      ...formData,
      rules: updatedRules
    });
    setEditingRuleIndex(null);
    setRuleForm({});
  };

  const deleteRule = (index) => {
    const updatedRules = formData.rules.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      rules: updatedRules
    });
  };

  const addBonusRule = () => {
    const newBonus = {
      condition: {
        lastN: 4,
        percentage: 100
      },
      points: 25
    };
    setFormData({
      ...formData,
      bonusRules: [...(formData.bonusRules || []), newBonus]
    });
    setBonusForm({});
  };

  const editBonusRule = (index) => {
    setEditingBonusIndex(index);
    const bonus = formData.bonusRules[index];
    // Exclude key field when editing
    setBonusForm({ 
      condition: bonus.condition,
      points: bonus.points
    });
  };

  const saveBonusRule = () => {
    // Validate required fields
    if (!bonusForm.condition?.lastN || bonusForm.condition?.lastN === '' || bonusForm.condition?.lastN === null || bonusForm.condition?.lastN === undefined) {
      return; // Don't save if Number Of Weeks is missing
    }
    if (!bonusForm.condition?.percentage || bonusForm.condition?.percentage === '' || bonusForm.condition?.percentage === null || bonusForm.condition?.percentage === undefined) {
      return; // Don't save if Required Percentage is missing
    }
    if (!bonusForm.points || bonusForm.points === '' || bonusForm.points === null || bonusForm.points === undefined) {
      return; // Don't save if Bonus Points is missing
    }
    
    const updatedBonusRules = [...(formData.bonusRules || [])];
    updatedBonusRules[editingBonusIndex] = bonusForm;
    setFormData({
      ...formData,
      bonusRules: updatedBonusRules
    });
    setEditingBonusIndex(null);
    setBonusForm({});
  };

  const deleteBonusRule = (index) => {
    const updatedBonusRules = formData.bonusRules.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      bonusRules: updatedBonusRules
    });
  };

  const getDefaultRule = (type, withDegree) => {
    if (type === 'attendance') {
      return { key: 'attend', points: 10 };
    } else if (type === 'homework' && withDegree === true) {
      return { min: 0, max: 100, points: 0 };
    } else if (type === 'homework' && withDegree === false) {
      return { hwDone: true, points: 20 };
    } else if (type === 'quiz') {
      return { min: 0, max: 100, points: 0 };
    }
    return {};
  };

  const getConditionLabel = (condition) => {
    if (condition.type === 'attendance') {
      return 'Attendance';
    } else if (condition.type === 'homework' && condition.withDegree === true) {
      return 'Homework (with degree)';
    } else if (condition.type === 'homework' && condition.withDegree === false) {
      return 'Homework (without degree)';
    } else if (condition.type === 'quiz') {
      return 'Quiz';
    }
    return condition.type;
  };

  if (profileLoading || isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ 
          maxWidth: 800, 
          margin: "0 auto", 
          width: '100%',
          padding: '20px'
        }}>
          <Title backText="Back" href="/dashboard/manage_scoring_system">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/settings.svg" alt="Manage Scoring Defaults" width={32} height={32} />
              Manage Scoring Defaults
            </div>
          </Title>
          <div style={{
            background: 'white',
            borderRadius: '16px',
            padding: '60px 40px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            textAlign: 'center',
            marginTop: '40px',
            border: '1px solid #e9ecef'
          }}>
            <div style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 24px',
              border: '4px solid #e9ecef',
              borderTop: '4px solid #1FA8DC',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: '700',
              color: '#495057',
              marginBottom: '12px',
              marginTop: 0
            }}>
              Loading Scoring Conditions
            </h3>
            <p style={{
              fontSize: '1rem',
              color: '#6c757d',
              margin: 0,
              lineHeight: '1.6'
            }}>
              Please wait while we fetch the scoring system defaults...
            </p>
          </div>
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
            @media (max-width: 768px) {
              .loading-container {
                padding: 40px 20px !important;
              }
              .loading-spinner {
                width: 50px !important;
                height: 50px !important;
              }
              .loading-title {
                font-size: 1.3rem !important;
              }
            }
            @media (max-width: 480px) {
              .loading-container {
                padding: 30px 16px !important;
              }
              .loading-spinner {
                width: 40px !important;
                height: 40px !important;
              }
              .loading-title {
                font-size: 1.1rem !important;
              }
              .loading-text {
                font-size: 0.9rem !important;
              }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (accessDenied || !profile || !['admin', 'developer'].includes(profile.role)) {
    return (
      <div style={{ padding: "30px", textAlign: "center", maxWidth: 800, margin: "0 auto" }}>
        <h2>Access Denied</h2>
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "30px", maxWidth: 800, margin: "0 auto" }}>
      <style jsx>{`
        @media (max-width: 768px) {
          .main-container {
            padding: 10px !important;
            max-width: 100% !important;
          }
          .condition-card {
            padding: 16px !important;
          }
          .condition-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 12px !important;
          }
          .condition-buttons {
            width: 100% !important;
            justify-content: space-between !important;
          }
          .condition-buttons button {
            flex: 1 !important;
          }
          .modal-content {
            max-width: calc(100vw - 40px) !important;
            padding: 20px !important;
            margin: 10px !important;
          }
          .modal-buttons {
            flex-direction: column !important;
            gap: 10px !important;
          }
          .modal-buttons button {
            width: 100% !important;
          }
        }
        @media (max-width: 480px) {
          .main-container {
            padding: 5px !important;
          }
          .condition-card {
            padding: 12px !important;
          }
          .condition-title {
            font-size: 1.1rem !important;
          }
          .modal-content {
            max-width: calc(100vw - 20px) !important;
            padding: 16px !important;
            margin: 5px !important;
          }
          .modal-title {
            font-size: 1.1rem !important;
          }
        }
      `}</style>
      <Title backText="Back" href="/dashboard/manage_scoring_system">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Image src="/settings.svg" alt="Manage Scoring Defaults" width={32} height={32} />
          Manage Scoring Defaults
        </div>
      </Title>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
        {conditions.map((condition) => (
          <div
            key={condition._id?.toString() || Math.random()}
            className="condition-card"
            style={{
              backgroundColor: '#f8f9fa',
              borderRadius: '12px',
              padding: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              transition: 'all 0.2s ease',
              border: '1px solid #e9ecef'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div className="condition-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="condition-title" style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700', color: '#1FA8DC' }}>
                {getConditionLabel(condition)}
              </h3>
              <div className="condition-buttons" style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleEdit(condition)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#1FA8DC',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a8fc7'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1FA8DC'}
                >
                  <IconEdit size={16} />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(condition)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.875rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
                >
                  <IconTrash size={16} />
                  Delete
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#495057', marginBottom: '12px' }}>Rules:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {condition.rules?.map((rule, idx) => (
                  <div key={idx} style={{ 
                    padding: '12px', 
                    background: 'white', 
                    borderRadius: '8px',
                    border: '1px solid #e9ecef',
                    fontSize: '0.9rem'
                  }}>
                    {condition.type === 'attendance' && (
                      <span>Status: <strong style={{ color: '#1FA8DC' }}>{rule.key}</strong> → <strong>{rule.points >= 0 ? '+' : ''}{rule.points}</strong> points</span>
                    )}
                    {(condition.type === 'homework' && condition.withDegree === true) || condition.type === 'quiz' ? (
                      <span>Range: <strong style={{ color: '#1FA8DC' }}>{rule.min}% - {rule.max}%</strong> → <strong>{rule.points >= 0 ? '+' : ''}{rule.points}</strong> points</span>
                    ) : condition.type === 'homework' && condition.withDegree === false ? (
                      <span>Homework : <strong style={{ color: '#1FA8DC' }}>
                        {rule.hwDone === true ? 'Done' : rule.hwDone === false ? 'Not Done' : rule.hwDone === 'Not Completed' ? 'Not Completed' : String(rule.hwDone)}
                      </strong> → <strong>{rule.points >= 0 ? '+' : ''}{rule.points}</strong> points</span>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            {condition.bonusRules && condition.bonusRules.length > 0 && (
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#495057', marginBottom: '12px' }}>Bonus Rules:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {condition.bonusRules.map((bonus, idx) => (
                    <div key={idx} style={{ 
                      padding: '12px', 
                      background: '#28a745', 
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}>
                      <span>
                        {((condition.type === 'homework' && condition.withDegree === true) || condition.type === 'quiz') ? (
                          <>{bonus.condition.lastN} constant weeks with degree <strong>{bonus.condition.percentage}%</strong> → <strong style={{ marginLeft: '4px' }}>+{bonus.points} points</strong></>
                        ) : condition.type === 'homework' && condition.withDegree === false ? (
                          <>{bonus.condition.lastN} consecutive <strong>
                            {bonus.condition.hwDone === true ? 'Done' : bonus.condition.hwDone === false ? 'Not Done' : bonus.condition.hwDone === 'Not Completed' ? 'Not Completed' : String(bonus.condition.hwDone)}
                          </strong> → <strong style={{ marginLeft: '4px' }}>+{bonus.points} points</strong></>
                        ) : (
                          <>{bonus.condition.lastN} consecutive {bonus.condition.percentage}% scores → <strong style={{ marginLeft: '4px' }}>+{bonus.points} points</strong></>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Edit Modal - Custom styled like online_sessions */}
      {editModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            overflowY: 'auto'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditModalOpen(false);
              setSelectedCondition(null);
              resetForm();
            }
          }}
        >
          <div
            className="modal-content"
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '700px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              margin: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="modal-title" style={{ marginTop: 0, marginBottom: '24px', fontSize: '1.5rem', fontWeight: '700', color: '#1FA8DC' }}>
              Edit {getConditionLabel(selectedCondition || { type: formData.type, withDegree: formData.withDegree })} Scoring Condition
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>


              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ fontSize: '1rem', fontWeight: '600', color: '#495057' }}>Rules</div>
                  {(formData.type === 'homework' && formData.withDegree === true) || formData.type === 'quiz' ? (
                    <Button size="sm" onClick={addRule} leftSection={<IconPlus size={14} />} style={{ backgroundColor: '#1FA8DC' }}>
                      Add Rule
                    </Button>
                  ) : null}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {formData.rules.map((rule, idx) => (
                    <div key={idx} style={{ border: '2px solid #e9ecef', padding: '16px', borderRadius: '8px', background: '#f8f9fa' }}>
                      {editingRuleIndex === idx ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {formData.type === 'attendance' ? (
                            <>
                              <Select
                                label="Status"
                                value={ruleForm.key || ''}
                                onChange={(value) => setRuleForm({ ...ruleForm, key: value })}
                                data={[
                                  { value: 'attend', label: 'Attend' },
                                  { value: 'absent', label: 'Absent' }
                                ]}
                                styles={{ label: { fontWeight: 600, marginBottom: '8px' } }}
                              />
                              <NumberInput
                                label="Points"
                                value={ruleForm.points}
                                onChange={(value) => setRuleForm({ ...ruleForm, points: value })}
                                styles={{ label: { fontWeight: 600, marginBottom: '8px' } }}
                              />
                            </>
                          ) : (formData.type === 'homework' && formData.withDegree === true) || formData.type === 'quiz' ? (
                            <>
                              <NumberInput
                                label="Min Percentage"
                                value={ruleForm.min}
                                onChange={(value) => setRuleForm({ ...ruleForm, min: value })}
                                styles={{ label: { fontWeight: 600, marginBottom: '8px' } }}
                              />
                              <NumberInput
                                label="Max Percentage"
                                value={ruleForm.max}
                                onChange={(value) => setRuleForm({ ...ruleForm, max: value })}
                                styles={{ label: { fontWeight: 600, marginBottom: '8px' } }}
                              />
                              <NumberInput
                                label="Points"
                                value={ruleForm.points}
                                onChange={(value) => setRuleForm({ ...ruleForm, points: value })}
                                styles={{ label: { fontWeight: 600, marginBottom: '8px' } }}
                              />
                            </>
                          ) : formData.type === 'homework' && formData.withDegree === false ? (
                            <>
                              <Select
                                label="hwDone Value"
                                value={ruleForm.hwDone === true ? 'true' : ruleForm.hwDone === false ? 'false' : ruleForm.hwDone === 'Not Completed' ? 'Not Completed' : ''}
                                onChange={(value) => {
                                  let parsedValue = value;
                                  if (value === 'true') parsedValue = true;
                                  else if (value === 'false') parsedValue = false;
                                  else if (value === 'Not Completed') parsedValue = 'Not Completed';
                                  setRuleForm({ ...ruleForm, hwDone: parsedValue });
                                }}
                                data={[
                                  { value: 'true', label: 'True' },
                                  { value: 'false', label: 'False' },
                                  { value: 'Not Completed', label: 'Not Completed' }
                                ]}
                                styles={{ label: { fontWeight: 600, marginBottom: '8px' } }}
                              />
                              <NumberInput
                                label="Points"
                                value={ruleForm.points}
                                onChange={(value) => setRuleForm({ ...ruleForm, points: value })}
                                styles={{ label: { fontWeight: 600, marginBottom: '8px' } }}
                              />
                            </>
                          ) : null}
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <Button size="sm" onClick={saveRule} style={{ backgroundColor: '#1FA8DC' }}>Save</Button>
                            <Button size="sm" variant="subtle" onClick={() => {
                              setEditingRuleIndex(null);
                              setRuleForm({});
                            }}>Cancel</Button>
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.95rem' }}>
                            {formData.type === 'attendance' && `${rule.key} → ${rule.points >= 0 ? '+' : ''}${rule.points} pts`}
                            {(formData.type === 'homework' && formData.withDegree === true) || formData.type === 'quiz' ? 
                              `${rule.min}%-${rule.max}% → ${rule.points >= 0 ? '+' : ''}${rule.points} pts` :
                              formData.type === 'homework' && formData.withDegree === false ?
                              `hwDone: ${String(rule.hwDone)} → ${rule.points >= 0 ? '+' : ''}${rule.points} pts` : null}
                          </span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <ActionIcon size="md" onClick={() => editRule(idx)} style={{ backgroundColor: '#1FA8DC', color: 'white' }}>
                              <IconEdit size={16} />
                            </ActionIcon>
                            <ActionIcon size="md" color="red" onClick={() => deleteRule(idx)}>
                              <IconTrash size={16} />
                            </ActionIcon>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Only show bonus section for homework with degree and quiz */}
              {((formData.type === 'homework' && formData.withDegree === true) || formData.type === 'quiz') && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ fontSize: '1rem', fontWeight: '600', color: '#495057' }}>Bonus Rules</div>
                    <Button size="sm" onClick={addBonusRule} leftSection={<IconPlus size={14} />} style={{ backgroundColor: '#28a745' }}>
                      Add Bonus Rule
                    </Button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(formData.bonusRules || []).map((bonus, idx) => (
                      <div key={idx} style={{ border: '2px solid #28a745', padding: '16px', borderRadius: '8px', background: '#28a745', color: 'white' }}>
                        {editingBonusIndex === idx ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <NumberInput
                            label="Number Of Weeks"
                            value={bonusForm.condition?.lastN}
                            onChange={(value) => setBonusForm({
                              ...bonusForm,
                              condition: { ...bonusForm.condition, lastN: value }
                            })}
                            styles={{ label: { fontWeight: 600, marginBottom: '8px', color: 'white' }, input: { background: 'white' } }}
                          />
                          <NumberInput
                            label="Required Percentage"
                            value={bonusForm.condition?.percentage}
                            onChange={(value) => setBonusForm({
                              ...bonusForm,
                              condition: { ...bonusForm.condition, percentage: value }
                            })}
                            styles={{ label: { fontWeight: 600, marginBottom: '8px', color: 'white' }, input: { background: 'white' } }}
                          />
                          <NumberInput
                            label="Bonus Points"
                            value={bonusForm.points}
                            onChange={(value) => setBonusForm({ ...bonusForm, points: value })}
                            styles={{ label: { fontWeight: 600, marginBottom: '8px', color: 'white' }, input: { background: 'white' } }}
                          />
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <Button 
                              size="sm" 
                              onClick={saveBonusRule} 
                              disabled={!bonusForm.condition?.lastN || bonusForm.condition?.lastN === '' || bonusForm.condition?.lastN === null || bonusForm.condition?.lastN === undefined ||
                                       !bonusForm.condition?.percentage || bonusForm.condition?.percentage === '' || bonusForm.condition?.percentage === null || bonusForm.condition?.percentage === undefined ||
                                       !bonusForm.points || bonusForm.points === '' || bonusForm.points === null || bonusForm.points === undefined}
                              style={{ 
                                backgroundColor: (!bonusForm.condition?.lastN || bonusForm.condition?.lastN === '' || bonusForm.condition?.lastN === null || bonusForm.condition?.lastN === undefined ||
                                                 !bonusForm.condition?.percentage || bonusForm.condition?.percentage === '' || bonusForm.condition?.percentage === null || bonusForm.condition?.percentage === undefined ||
                                                 !bonusForm.points || bonusForm.points === '' || bonusForm.points === null || bonusForm.points === undefined) ? '#6c757d' : 'white', 
                                color: (!bonusForm.condition?.lastN || bonusForm.condition?.lastN === '' || bonusForm.condition?.lastN === null || bonusForm.condition?.lastN === undefined ||
                                        !bonusForm.condition?.percentage || bonusForm.condition?.percentage === '' || bonusForm.condition?.percentage === null || bonusForm.condition?.percentage === undefined ||
                                        !bonusForm.points || bonusForm.points === '' || bonusForm.points === null || bonusForm.points === undefined) ? 'white' : '#28a745',
                                cursor: (!bonusForm.condition?.lastN || bonusForm.condition?.lastN === '' || bonusForm.condition?.lastN === null || bonusForm.condition?.lastN === undefined ||
                                         !bonusForm.condition?.percentage || bonusForm.condition?.percentage === '' || bonusForm.condition?.percentage === null || bonusForm.condition?.percentage === undefined ||
                                         !bonusForm.points || bonusForm.points === '' || bonusForm.points === null || bonusForm.points === undefined) ? 'not-allowed' : 'pointer'
                              }}
                            >
                              Save
                            </Button>
                            <Button size="sm" variant="subtle" onClick={() => {
                              setEditingBonusIndex(null);
                              setBonusForm({});
                            }} style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}>Cancel</Button>
                          </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: '500' }}>
                              {((formData.type === 'homework' && formData.withDegree === true) || formData.type === 'quiz') ? (
                                <>{bonus.condition.lastN} constant weeks with degree {bonus.condition.percentage || 100}% → +{bonus.points} pts</>
                              ) : formData.type === 'homework' && formData.withDegree === false ? (
                                <>{bonus.condition.lastN} consecutive {bonus.condition.hwDone === true ? 'Done' : bonus.condition.hwDone === false ? 'Not Done' : bonus.condition.hwDone === 'Not Completed' ? 'Not Completed' : String(bonus.condition.hwDone)} → +{bonus.points} pts</>
                              ) : (
                                <>{bonus.condition.lastN} consecutive {bonus.condition.percentage || 100}% → +{bonus.points} pts</>
                              )}
                            </span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <ActionIcon size="md" onClick={() => editBonusRule(idx)} style={{ backgroundColor: '#1FA8DC', color: 'white' }}>
                                <IconEdit size={16} />
                              </ActionIcon>
                              <ActionIcon size="md" onClick={() => deleteBonusRule(idx)} style={{ backgroundColor: '#dc3545', color: 'white' }}>
                                <IconTrash size={16} />
                              </ActionIcon>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-buttons" style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'center' }}>
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isLoading}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: updateMutation.isLoading ? '#6c757d' : '#28a745',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: updateMutation.isLoading ? 'not-allowed' : 'pointer',
                    opacity: updateMutation.isLoading ? 0.6 : 1
                  }}
                >
                  {updateMutation.isLoading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditModalOpen(false);
                    setSelectedCondition(null);
                    resetForm();
                  }}
                  disabled={updateMutation.isLoading}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '1rem',
                    fontWeight: '500',
                    cursor: updateMutation.isLoading ? 'not-allowed' : 'pointer',
                    opacity: updateMutation.isLoading ? 0.6 : 1
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDeleteModalOpen(false);
              setSelectedCondition(null);
            }
          }}
        >
          <div
            className="modal-content"
            style={{
              background: 'white',
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '400px',
              width: '100%',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modal-title" style={{ marginTop: 0, marginBottom: '16px', textAlign: 'center', fontSize: '1.25rem', fontWeight: '700' }}>
              Confirm Delete
            </h3>
            <p style={{ textAlign: 'center', marginBottom: '24px', color: '#6c757d', fontSize: '1rem' }}>
              Are you sure you want to delete the condition for <strong>{selectedCondition && getConditionLabel(selectedCondition)}</strong>? This action cannot be undone.
            </p>
            <div className="modal-buttons" style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={handleDeleteConfirm}
                disabled={deleteMutation.isLoading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: deleteMutation.isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  opacity: deleteMutation.isLoading ? 0.7 : 1
                }}
              >
                {deleteMutation.isLoading ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={() => {
                  setDeleteModalOpen(false);
                  setSelectedCondition(null);
                }}
                disabled={deleteMutation.isLoading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: deleteMutation.isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600',
                  opacity: deleteMutation.isLoading ? 0.7 : 1
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
