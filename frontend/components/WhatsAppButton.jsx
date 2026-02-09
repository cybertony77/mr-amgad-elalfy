import React, { useState } from 'react';
import Image from 'next/image';
import { useUpdateMessageState } from '../lib/api/students';
import { generatePublicStudentLink } from '../lib/generatePublicLink';
import { useSystemConfig } from '../lib/api/system';
import apiClient from '../lib/axios';

const WhatsAppButton = ({ student, onMessageSent, onScoreUpdate }) => {
  const { data: systemConfig } = useSystemConfig();
  const systemName = systemConfig?.name || 'Demo Attendance System';
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';
  const [message, setMessage] = useState('');
  const updateMessageStateMutation = useUpdateMessageState();

  const handleWhatsAppClick = () => {
    setMessage('');

    try {
      // Get phone number from DB (should already include country code, e.g., "201211172756")
      let parentNumber = student.parents_phone ? student.parents_phone.replace(/[^0-9]/g, '') : null;
      
      // Validate phone number exists
      if (!parentNumber || parentNumber.length < 3) {
        setMessage('Missing or invalid parent phone number');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }
      
      // Validate country code: if number starts with 012, 011, 010, or 015, allow without country code
      // Otherwise, require country code (starts with 20 for Egypt)
      const startsWithEgyptPrefix = parentNumber.startsWith('012') || 
                                     parentNumber.startsWith('011') || 
                                     parentNumber.startsWith('010') || 
                                     parentNumber.startsWith('015');
      
      const hasCountryCode = parentNumber.startsWith('20');
      
      if (!startsWithEgyptPrefix && !hasCountryCode) {
        setMessage('Country code required. Please add country code (e.g., 20 for Egypt)');
        setTimeout(() => setMessage(''), 3000);
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }
      
      // If number starts with 012/011/010/015, remove first 0 and prepend 20 (Egypt country code)
      if (startsWithEgyptPrefix && !hasCountryCode) {
        parentNumber = '20' + parentNumber.substring(1); // Remove first 0
      }

      // Validate student data
      if (!student.name) {
        setMessage('Student data incomplete - missing name');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        const weekNumber = student.currentWeekNumber || 1;
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }

      // Get current week data - assume we're working with the current week data
      const currentWeekNumber = student.currentWeekNumber || 1;
      const weekNumber = currentWeekNumber; // Use for scoring API
      const weekIndex = currentWeekNumber - 1;
      const weekData = student.weeks && student.weeks[weekIndex];
      const currentWeek = {
        attended: student.attended_the_session || false,
        lastAttendance: student.lastAttendance || 'N/A',
        hwDone: student.hwDone || false,
        hwDegree: student.hwDegree || (weekData ? weekData.hwDegree : null) || null,
        quizDegree: student.quizDegree ?? null
      };


      // Create the message using the specified format
      // Extract first name from full name
      const firstName = student.name ? student.name.split(' ')[0] : 'Student';
      let whatsappMessage = `Follow up Message:

Dear, ${firstName}'s Parent
We want to inform you that we are in:

  • Week: ${student.currentWeekNumber || 1}
  • Attendance Info: ${currentWeek.attended ? `${currentWeek.lastAttendance}` : 'Absent'}`;

      // Only show attendance-related info if student attended
      if (currentWeek.attended) {
        // Format homework status properly
        let homeworkStatus = '';
        if (student.hwDone === true) {
          // Show homework degree if it exists
          const hwDegree = currentWeek.hwDegree;
          if (hwDegree && String(hwDegree).trim() !== '') {
            homeworkStatus = `Done (${hwDegree})`;
          } else {
          homeworkStatus = 'Done';
          }
        } else if (student.hwDone === false) {
          homeworkStatus = 'Not Done';
        } else if (student.hwDone === 'No Homework') {
          homeworkStatus = 'No Homework';
        } else if (student.hwDone === 'Not Completed') {
          homeworkStatus = 'Not Completed';
        } else {
          homeworkStatus = 'Not Done'; // Default fallback
        }
        
        whatsappMessage += `
  • Homework: ${homeworkStatus}`;
  
        if (currentWeek.quizDegree !== null && String(currentWeek.quizDegree).trim() !== '') {
          whatsappMessage += `
  • Quiz Degree: ${currentWeek.quizDegree}`;
        }
      }
      
      // Add comment if it exists and is not null/undefined
      // Get comment from the current week data (reuse variables from above)
      const weekComment = weekData ? weekData.comment : null;
      
      if (weekComment && weekComment.trim() !== '' && weekComment !== 'undefined') {
        whatsappMessage += `
  • Comment: ${weekComment}`;
      }

      // Generate public link with HMAC
      const publicLink = generatePublicStudentLink(student.id.toString());

      whatsappMessage += `

Please visit the following link to check ${firstName}'s grades and progress: ⬇️

🖇️ ${publicLink}

Note :-
  • ${firstName}'s ID: ${student.id}

We wish ${firstName} gets high scores 😊❤

– ${systemName}`;

      // Create WhatsApp URL with the formatted message
      const whatsappUrl = `https://wa.me/${parentNumber}?text=${encodeURIComponent(whatsappMessage)}`;
      
      // Log the final phone number for debugging
      console.log('Attempting to send WhatsApp to:', parentNumber, 'Original:', student.parents_phone);
      
      // Try to open WhatsApp in a new tab/window
      const whatsappWindow = window.open(whatsappUrl, '_blank');
      
      // Check if window was blocked or failed to open
      if (!whatsappWindow || whatsappWindow.closed || typeof whatsappWindow.closed == 'undefined') {
        setMessage('Popup blocked - please allow popups and try again');
        setTimeout(() => setMessage(''), 3000);
        // Update database to mark as failed
        updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: weekNumber });
        return;
      }
      
      // Additional check: if the window opened but immediately closed, it might be an invalid number
      setTimeout(() => {
        if (whatsappWindow.closed) {
          console.log('WhatsApp window closed immediately - possibly invalid number');
          // Note: We can't reliably detect this, so we'll rely on user feedback
        }
      }, 1000);
      
      // If we reach here, everything was successful
      setMessage('WhatsApp opened successfully!');
      
      // Update message state in database
      console.log('Updating message state in database for student:', student.id, 'week:', weekNumber);
      console.log('Student data:', { id: student.id, currentWeekNumber: student.currentWeekNumber, name: student.name });
      console.log('Student weeks data:', student.weeks);
      
      updateMessageStateMutation.mutate(
        { id: student.id, message_state: true, week: weekNumber },
        {
          onSuccess: async () => {
            console.log('Message state updated successfully in database');
            // Also call the parent callback for any additional local state management
            if (onMessageSent) {
              onMessageSent(student.id, true);
            }
            
            // Calculate score for absent student (when message is sent to parent)
            // Only if student is absent and scoring system is enabled
            if (!currentWeek.attended && isScoringEnabled) {
              try {
                // Get previous attendance status from history
                let previousStatus = null;
                try {
                  const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                    studentId: student.id,
                    type: 'attendance',
                    week: weekNumber
                  });
                  
                  if (historyResponse.data.found && historyResponse.data.history) {
                    previousStatus = historyResponse.data.history.data?.status;
                  }
                } catch (historyErr) {
                  console.error('Error getting attendance history:', historyErr);
                }
                
                await apiClient.post('/api/scoring/calculate', {
                  studentId: student.id,
                  type: 'attendance',
                  week: weekNumber,
                  data: { 
                    status: 'absent',
                    previousStatus: previousStatus
                  }
                });
                // Trigger score update callback
                if (onScoreUpdate) {
                  onScoreUpdate();
                }
              } catch (err) {
                console.error('Error calculating absent score:', err);
              }
            }
            
            // Calculate score for homework "Not Done" (when hwDone is false)
            // Only if hwDone is false (not "Not Completed" or "No Homework") and scoring system is enabled
            if (currentWeek.hwDone === false && isScoringEnabled) {
              try {
                // Get previous homework state from history
                let previousHwDone = null;
                try {
                  const historyResponse = await apiClient.post('/api/scoring/get-last-history', {
                    studentId: student.id,
                    type: 'homework',
                    week: weekNumber
                  });
                  
                  if (historyResponse.data.found && historyResponse.data.history) {
                    const lastHistory = historyResponse.data.history;
                    if (lastHistory.data?.hwDone !== undefined) {
                      previousHwDone = lastHistory.data.hwDone;
                    }
                  }
                } catch (historyErr) {
                  console.error('Error getting homework history:', historyErr);
                }
                
                await apiClient.post('/api/scoring/calculate', {
                  studentId: student.id,
                  type: 'homework',
                  week: weekNumber,
                  data: { 
                    hwDone: false,
                    previousHwDone: previousHwDone
                  }
                });
                console.log('Homework "Not Done" score calculated for student:', student.id);
                // Trigger score update callback
                if (onScoreUpdate) {
                  onScoreUpdate();
                }
              } catch (err) {
                console.error('Error calculating homework "Not Done" score:', err);
              }
            }
          },
          onError: (error) => {
            console.error('Failed to update message state in database:', error);
            console.error('Error details:', error.response?.data || error.message);
            setMessage('WhatsApp sent but failed to update status');
            setTimeout(() => setMessage(''), 3000);
            // Don't call onMessageSent if database update fails
          }
        }
      );
      
      setTimeout(() => setMessage(''), 3000);

    } catch (error) {
      // Handle any unexpected errors
      console.error('WhatsApp sending error:', error);
      setMessage('Error occurred while opening WhatsApp');
      setTimeout(() => setMessage(''), 3000);
      // Update database to mark as failed
      updateMessageStateMutation.mutate({ id: student.id, message_state: false, week: student.currentWeekNumber || 1 });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <button
        onClick={handleWhatsAppClick}
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
          transition: 'all 0.3s ease',
          boxShadow: '0 2px 4px rgba(37, 211, 102, 0.2)'
        }}
        onMouseEnter={(e) => {
          e.target.style.backgroundColor = '#128C7E';
          e.target.style.transform = 'translateY(-1px)';
          e.target.style.boxShadow = '0 4px 8px rgba(37, 211, 102, 0.3)';
        }}
        onMouseLeave={(e) => {
          e.target.style.backgroundColor = '#25D366';
          e.target.style.transform = 'translateY(0)';
          e.target.style.boxShadow = '0 2px 4px rgba(37, 211, 102, 0.2)';
        }}
      >
        <Image src="/whatsapp.svg" alt="WhatsApp" width={30} height={30} />
        Send
      </button>
      
      {message && (
        <div style={{
          fontSize: '10px',
          color: message.includes('success') ? '#28a745' : '#dc3545',
          textAlign: 'center'
        }}>
          {message}
        </div>
      )}
    </div>
  );
};

export default WhatsAppButton; 