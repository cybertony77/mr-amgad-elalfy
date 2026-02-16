import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useProfile, useProfilePicture } from '../lib/api/auth';
import { useSubscription } from '../lib/api/subscription';
import { useStudent } from '../lib/api/students';
import { useSystemConfig } from '../lib/api/system';
import QRCodeModal from './QRCodeModal';
import InstallApp from './InstallApp';
import apiClient from '../lib/axios';
import Image from 'next/image';

export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showInstallApp, setShowInstallApp] = useState(false);
  const menuRef = useRef(null);
  const router = useRouter();
  
  // Use React Query to get user profile data
  const { data: user, isLoading, error } = useProfile();
  const { data: subscription } = useSubscription();
  const { data: profilePictureUrl } = useProfilePicture();
  const { data: systemConfig } = useSystemConfig();
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';
  const isSubscriptionEnabled = systemConfig?.subscription === true || systemConfig?.subscription === 'true';

  // Fallback user object if data is not available yet
  const userData = user || { name: '', id: '', phone: '', role: '' };
  
  // If user is a student, fetch student data from students collection
  const studentId = userData.role === 'student' && userData.id ? userData.id.toString() : null;
  const { data: studentData } = useStudent(studentId, { enabled: !!studentId });

  // Subscription countdown timer
  const [timeRemaining, setTimeRemaining] = useState(null);
  const hasLoggedOutRef = useRef(false); // Track if we've already called logout

  useEffect(() => {
    const isDeveloper = userData.role === 'developer';
    const isStudent = userData.role === 'student';

    // Don't show subscription timer for students
    if (isStudent) {
      setTimeRemaining(null);
      hasLoggedOutRef.current = false;
      return;
    }

    // Simple logic: if active = false AND date_of_expiration = null, show expired
    // Otherwise, if date_of_expiration exists, calculate timer
    if (!subscription || (subscription.active === false && !subscription.date_of_expiration)) {
      setTimeRemaining(null);
      hasLoggedOutRef.current = false;
      return;
    }

    // If date_of_expiration exists, calculate timer
    if (!subscription.date_of_expiration) {
      setTimeRemaining(null);
      hasLoggedOutRef.current = false;
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const expiration = new Date(subscription.date_of_expiration);
      const diff = expiration - now;

      // Calculate time components (use Math.max to ensure non-negative)
      let days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
      let hours = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
      let minutes = Math.max(0, Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)));
      let seconds = Math.max(0, Math.floor((diff % (1000 * 60)) / 1000));

      // Redistribute time: if hours is 00 and days > 0, borrow 1 day to fill hours
      if (hours === 0 && days > 0) {
        days -= 1;
        hours = 24;
      }
      // If minutes is 00 and hours > 0, borrow 1 hour to fill minutes
      if (minutes === 0 && hours > 0) {
        hours -= 1;
        minutes = 60;
      }
      // If seconds is 00 and minutes > 0, borrow 1 minute to fill seconds
      if (seconds === 0 && minutes > 0) {
        minutes -= 1;
        seconds = 60;
      }

      // Update timer with calculated values (always set, even if zero)
      setTimeRemaining({ days, hours, minutes, seconds });

      // Check if all time components are zero (00:00:00:00) or diff <= 0
      // Only auto-logout for non-developers
      if (!isDeveloper && (diff <= 0 || (days === 0 && hours === 0 && minutes === 0 && seconds === 0))) {
        // If timer reaches 00:00:00:00, delete token and redirect to login
        if (!hasLoggedOutRef.current) {
          hasLoggedOutRef.current = true;
          (async () => {
            try {
              await apiClient.post('/api/auth/logout', {}, {
                validateStatus: (status) => status < 500 // Accept 200-499 as success
              }).catch(() => {
                // Ignore errors - continue with redirect even if logout fails
              });
            } catch (err) {
              // Ignore errors - continue with redirect even if logout fails
              if (err.response?.status !== 400 && err.response?.status !== 401) {
                console.error('Error logging out (continuing anyway):', err);
              }
            }
            router.push('/');
          })();
        }
      }
    };

    // Calculate timer immediately
    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => {
      clearInterval(interval);
      hasLoggedOutRef.current = false; // Reset logout flag when effect cleans up
    };
  }, [subscription, userData.role, router]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleLogout = async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      router.push('/');
    }
  };

  const handleManageAssistants = () => {
    router.push('/manage_assistants');
  };

  const handleEditProfile = () => {
    router.push('/edit_my_profile');
  };

  const handleContactDeveloper = () => {
    router.push('/contact_developer');
  };

  const handleSubscriptionDashboard = () => {
    router.push('/subscription_dashboard');
  };

  const handleChangePassword = () => {
    router.push('/student_dashboard/change_password');
  };

  const handleMyQRCode = () => {
    setOpen(false); // Close the menu
    setShowQRModal(true);
  };

  const handleInstallApp = () => {
    setOpen(false); // Close the menu
    setShowInstallApp(true);
  };


  return (
    <div style={{ position: 'relative', marginRight: 32 }} ref={menuRef}>
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: '50%',
          background: profilePictureUrl ? 'transparent' : '#e9ecef',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: open ? '0 2px 8px rgba(31,168,220,0.15)' : 'none',
          border: open ? '2px solid #1FA8DC' : '2px solid #e9ecef',
          transition: 'box-shadow 0.2s, border 0.2s',
          overflow: 'hidden',
          position: 'relative'
        }}
        onClick={() => setOpen((v) => !v)}
        title={userData.name || userData.id}
      >
        {/* Use profile picture if available, else fallback to initial */}
        {profilePictureUrl ? (
          <Image
            src={profilePictureUrl}
            alt="Profile"
            fill
            style={{
              objectFit: 'cover',
              borderRadius: '50%'
            }}
            unoptimized
          />
        ) : (
        <span style={{ 
          fontWeight: 700, 
          fontSize: 22, 
          color: '#1FA8DC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          lineHeight: 1,
          textAlign: 'center'
        }}>
          {(() => {
            const displayName = userData.role === 'student' && studentData?.name 
              ? studentData.name 
              : userData.name;
            const displayId = userData.role === 'student' && studentData?.id 
              ? studentData.id.toString() 
              : userData.id?.toString();
            
            if (displayName && displayName.length > 0) {
              return displayName[0].toUpperCase();
            } else if (displayId && displayId.length > 0) {
              return displayId[0].toUpperCase();
            }
            return 'U';
          })()}
        </span>
        )}
      </div>
      {open && (
        <div style={{
          position: 'absolute',
          top: 54,
          right: 25,
          minWidth: 270,
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(31,168,220,0.18)',
          border: '1.5px solid #e9ecef',
          zIndex: 10000,
          padding: '0 0 8px 0',
        }}>
          <div style={{
            padding: '18px 20px 12px 20px',
            borderBottom: '1px solid #e9ecef',
            textAlign: 'left',
            marginBottom: 8
          }}>
            {userData.role === 'student' && studentData ? (
              <>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#1FA8DC', marginBottom: 8 }}>
                  {studentData.name || 'Student'}
                </div>
                <div style={{ color: '#495057', fontSize: 15, fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Image src="/user-circle3.svg" alt="User" width={18} height={18} />
                  ID: {studentData.id}
                </div>
                {studentData.grade && (
                  <div style={{ color: '#495057', fontSize: 15, fontWeight: 600 }}>
                    Grade: {studentData.grade}
                  </div>
                )}
              </>
            ) : (
              <>
                <div style={{ fontWeight: 800, fontSize: 18, color: '#1FA8DC', marginBottom: 2 }}>{userData.name || userData.id}</div>
                <div style={{ color: '#495057', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Image src="/user-circle3.svg" alt="User" width={18} height={18} />
                  {userData.id ? `Username: ${userData.id}` : 'No Username'}
                </div>
              </>
            )}
          </div>
          {isSubscriptionEnabled && subscription && userData.role !== 'student' && (
            <div style={{
              padding: '12px 20px',
              borderBottom: '1px solid #e9ecef',
              marginBottom: 8
            }}>
              {/* Show "Subscription Expired" only if active = false AND date_of_expiration = null */}
              {subscription.active === false && !subscription.date_of_expiration ? (
                <div style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#dc3545',
                  lineHeight: 1.4
                }}>
                  <Image src="/alert-triangle2.svg" alt="alert" width={20} height={20} style={{ marginRight: '5px' , transform: "translateY(5px)" }} />
                  Subscription Expired
                </div>
              ) : subscription.date_of_expiration && timeRemaining !== null ? (
                <div style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#495057',
                  lineHeight: 1.4
                }}>
                  <div style={{ marginBottom: 4, color: '#313437', fontSize: 15 }}>
                    <Image src="/clock.svg" alt="Clock" width={18} height={18} style={{ marginRight: '5px' , transform: "translateY(3px)" }} />
                    Subscription time remaining:</div>
                  <div style={{ 
                    fontFamily: 'Courier New, monospace',
                    letterSpacing: 0.5,
                    fontSize: 15
                  }}>
                    <span style={{ color: '#1fa8dc', fontSize: 15 }}>{String(timeRemaining.days || 0).padStart(2, '0')}</span>
                    <span style={{ color: '#ed2929', fontSize: 15 }}> days : </span>
                    <span style={{ color: '#1fa8dc', fontSize: 15 }}>{String(timeRemaining.hours || 0).padStart(2, '0')}</span>
                    <span style={{ color: '#ed2929', fontSize: 15 }}> hours : </span>
                    <span style={{ color: '#1fa8dc', fontSize: 15 }}>{String(timeRemaining.minutes || 0).padStart(2, '0')}</span>
                    <span style={{ color: '#ed2929', fontSize: 15 }}> min : </span>
                    <span style={{ color: '#1fa8dc', fontSize: 15 }}>{String(timeRemaining.seconds || 0).padStart(2, '0')}</span>
                    <span style={{ color: '#ed2929', fontSize: 15 }}> sec</span>
                  </div>
                </div>
              ) : null}
            </div>
          )}
          <button style={menuBtnStyle} onClick={handleLogout}>
            <Image src="/logout.svg" alt="Logout" width={20} height={20} style={{ marginRight: '8px', filter: 'brightness(0) saturate(100%) invert(27%) sepia(95%) saturate(6871%) hue-rotate(349deg) brightness(93%) contrast(86%)' }} />
            Logout
          </button>
          {userData.role === 'student' && (
            <>
              <button style={menuBtnStyle} onClick={handleChangePassword}>
                <Image src="/key2.svg" alt="Password" width={20} height={20} style={{ marginRight: '8px' }} />
                Change My Password
              </button>
              <button style={menuBtnStyle} onClick={handleMyQRCode}>
                <Image src="/qrcode3.svg" alt="QR Code" width={20} height={20} style={{ marginRight: '8px' }} />
                My Qr Code
              </button>
            </>
          )}
          {userData.role !== 'student' && (
            <>
              <button style={menuBtnStyle} onClick={handleEditProfile}>
                <Image src="/user-edit2.svg" alt="Edit Profile" width={20} height={20} style={{ marginRight: '8px' }} />
                Edit My Profile
              </button>
              <button style={menuBtnStyle} onClick={() => {
                setOpen(false);
                router.push('/dashboard/public_link_generator');
              }}>
                <Image src="/link.svg" alt="Link" width={20} height={20} style={{ marginRight: '8px' }} />
                Public Link Generator
              </button>
              {(userData.role === 'admin' || userData.role === 'developer') && (
                <button style={menuBtnStyle} onClick={handleManageAssistants}>
                  <Image src="/settings.svg" alt="Settings" width={18} height={18} style={{ marginRight: '8px' }} />
                  Manage Assistants
                </button>
              )}
              {(userData.role === 'admin' || userData.role === 'developer' || userData.role === 'assistant') && (
                <>
                  <button style={menuBtnStyle} onClick={() => {
                    setOpen(false);
                    router.push('/dashboard/manage_online_system');
                  }}>
                    <Image src="/settings2.svg" alt="Settings" width={20} height={20} style={{ marginRight: '8px' }} />
                    Manage Online System
                  </button>
                  {isScoringEnabled && (
                    <button style={menuBtnStyle} onClick={() => {
                      setOpen(false);
                      router.push('/dashboard/manage_scoring_system');
                    }}>
                      <Image src="/star4.svg" alt="Scoring System" width={20} height={20} style={{ marginRight: '8px' }} />
                      Manage Scoring System
                    </button>
                  )}
                </>
              )}
              {isSubscriptionEnabled && userData.role === 'developer' && (
                <button style={menuBtnStyle} onClick={handleSubscriptionDashboard}>
                  <Image src="/dollar.svg" alt="Dollar" width={20} height={20} style={{ marginRight: '8px' }} />
                  Subscription Dashboard
                </button>
              )}
            </>
          )}
          <button style={menuBtnStyle} onClick={handleContactDeveloper}>
            <Image src="/message2.svg" alt="Message" width={20} height={20} style={{ marginRight: '8px' }} />
            Contact Developer
          </button>
          <button style={menuBtnStyle} onClick={handleInstallApp}>
            <Image src="/download.svg" alt="Download" width={20} height={20} style={{ marginRight: '8px' }} />
            Install App
          </button>
        </div>
      )}
      <QRCodeModal isOpen={showQRModal} onClose={() => setShowQRModal(false)} />
      <InstallApp isOpen={showInstallApp} onClose={() => setShowInstallApp(false)} />
    </div>
  );
}

const menuBtnStyle = {
  width: '100%',
  background: 'none',
  border: 'none',
  color: '#1FA8DC',
  fontWeight: 700,
  fontSize: 16,
  padding: '10px 20px',
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: 8,
  transition: 'background 0.15s',
  marginBottom: 2,
  outline: 'none',
  display: 'flex',
  alignItems: 'center',
}; 