import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import { useProfile } from '../../../lib/api/auth';
import { useSystemConfig } from '../../../lib/api/system';
import Title from '../../../components/Title';

export default function ManageOnlineSystem() {
  const router = useRouter();
  const { data: profile, isLoading } = useProfile();
  const { data: systemConfig } = useSystemConfig();
  const isOnlineVideosEnabled = systemConfig?.online_videos === true || systemConfig?.online_videos === 'true';
  const isHomeworksVideosEnabled = systemConfig?.homeworks_videos === true || systemConfig?.homeworks_videos === 'true';
  const isHomeworksEnabled = systemConfig?.homeworks === true || systemConfig?.homeworks === 'true';
  const isQuizzesEnabled = systemConfig?.quizzes === true || systemConfig?.quizzes === 'true';
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!isLoading && profile) {
      // Only allow admin, developer, or assistant roles
      const allowedRoles = ['admin', 'developer', 'assistant'];
      if (!allowedRoles.includes(profile.role)) {
        setAccessDenied(true);
      }
    }
  }, [profile, isLoading]);

  if (isLoading) {
    return (
      <div className="page-wrapper" style={{ 
        padding: "10px 35px 5px 35px",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh'
      }}>
        <div style={{ color: '#6c757d', fontSize: '1.1rem' }}>Loading...</div>
        <style jsx>{`
          @media (max-width: 480px) {
            .page-wrapper {
              padding: 10px 15px 5px 15px;
            }
          }
        `}</style>
      </div>
    );
  }

  if (accessDenied || !profile || !['admin', 'developer', 'assistant'].includes(profile.role)) {
    return (
      <div className="page-wrapper" style={{ 
        padding: "10px 35px 5px 35px",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '50vh'
      }}>
        <div className="access-denied-container" style={{
          background: 'white',
          borderRadius: '16px',
          padding: '40px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: 500,
          width: '100%',
          margin: '0 10px'
        }}>
          <div style={{ fontSize: '4rem', marginBottom: '20px' }}>🚫</div>
          <h2 style={{ color: '#dc3545', marginBottom: '16px', fontSize: '1.8rem' }}>Access Denied</h2>
          <p style={{ color: '#6c757d', fontSize: '1.1rem', lineHeight: '1.6' }}>
            You don't have permission to access this page. Only administrators, developers, and assistants can access the Online System Management.
          </p>
        </div>
        <style jsx>{`
          @media (max-width: 768px) {
            .page-wrapper {
              padding: 10px 20px 5px 20px;
            }
            .access-denied-container {
              padding: 30px 20px;
            }
            .access-denied-container h2 {
              font-size: 1.5rem !important;
            }
            .access-denied-container p {
              font-size: 1rem !important;
            }
          }
          @media (max-width: 480px) {
            .page-wrapper {
              padding: 10px 15px 5px 15px;
            }
            .access-denied-container {
              padding: 24px 16px;
              margin: 0 5px;
            }
            .access-denied-container div {
              font-size: 3rem !important;
              margin-bottom: 16px !important;
            }
            .access-denied-container h2 {
              font-size: 1.3rem !important;
              margin-bottom: 12px !important;
            }
            .access-denied-container p {
              font-size: 0.95rem !important;
            }
          }
          @media (max-width: 360px) {
            .access-denied-container {
              padding: 20px 12px;
            }
            .access-denied-container div {
              font-size: 2.5rem !important;
            }
            .access-denied-container h2 {
              font-size: 1.2rem !important;
            }
            .access-denied-container p {
              font-size: 0.9rem !important;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ 
      padding: "20px",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      paddingBottom: '20px'
    }}>
      <div className="main-container" style={{ maxWidth: 600, margin: "10px auto", textAlign: "center", width: '100%' }}>
        <Title
          backText="Back"
          href="/dashboard"
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
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/settings2.svg" alt="Settings" width={32} height={32} />
            Manage Online System
          </div>
        </Title>
        
        <style jsx>{`
          .page-wrapper {
            padding: 10px 35px 5px 35px;
          }
          
          .main-container {
            max-width: 600px;
            margin: 10px auto;
            text-align: center;
            width: 100%;
            padding: 0 10px;
          }
          
          .dashboard-btn {
            width: 100%;
            margin-bottom: 15px;
            padding: 16px 12px;
            background: linear-gradient(90deg, #87CEEB 0%, #B0E0E6 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 1.1rem;
            font-weight: 700;
            letter-spacing: 0.5px;
            box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            word-wrap: break-word;
            white-space: normal;
            line-height: 1.4;
          }
          .dashboard-btn:hover {
            background: linear-gradient(90deg, #5F9EA0 0%, #87CEEB 100%);
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(31, 168, 220, 0.4);
          }
          .dashboard-btn:active {
            transform: translateY(-1px);
          }
          .dashboard-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
            transform: none;
          }
          
          @media (max-width: 768px) {
            .page-wrapper {
              padding: 10px 20px 5px 20px;
            }
            
            .main-container {
              padding: 0 8px;
              margin: 10px auto;
            }
            
            .dashboard-btn {
              padding: 14px 0;
              font-size: 1rem;
              margin-bottom: 20px;
              letter-spacing: 0.3px;
            }
          }
          
          @media (max-width: 480px) {
            .page-wrapper {
              padding: 10px 15px 5px 15px;
            }
            
            .main-container {
              max-width: 100%;
              margin: 10px auto;
              padding: 0 5px;
            }
            
            .dashboard-btn {
              padding: 14px 0;
              font-size: 0.95rem;
              margin-bottom: 17px;
              letter-spacing: 0.2px;
              gap: 6px;
              border-radius: 10px;
            }
          }
          
          @media (max-width: 360px) {
            .page-wrapper {
              padding: 10px 10px 5px 10px;
            }
            
            .main-container {
              padding: 0;
            }
            
            .dashboard-btn {
              padding: 10px 0;
              font-size: 0.9rem;
              margin-bottom: 14px;
              letter-spacing: 0.1px;
              gap: 4px;
            }
          }
        `}</style>
        
        <div style={{ marginTop: 30, marginBottom: 20 }}>
          {isOnlineVideosEnabled && (
            <button
              className="dashboard-btn"
              onClick={() => router.push("/dashboard/manage_online_system/online_sessions")}
            >
              <Image src="/video.svg" alt="Videos" width={23} height={23} />
              Online Sessions
            </button>
          )}

          {isHomeworksVideosEnabled && (
            <button
              className="dashboard-btn"
              onClick={() => router.push("/dashboard/manage_online_system/homeworks_videos")}
            >
              <Image src="/play-pause.svg" alt="Play Pause" width={20} height={20} />
              Homeworks Videos
            </button>
          )}

          {isHomeworksEnabled && (
            <button
              className="dashboard-btn"
              onClick={() => router.push("/dashboard/manage_online_system/homeworks")}
            >
              <Image src="/books.svg" alt="Homeworks" width={20} height={20} />
              Homeworks
            </button>
          )}

          {isQuizzesEnabled && (
            <button
              className="dashboard-btn"
              onClick={() => router.push("/dashboard/manage_online_system/quizzes")}
            >
              <Image src="/notepad.svg" alt="Quizzes" width={20} height={20} />
              Quizzes
            </button>
          )}

          <button 
            className="dashboard-btn"
            onClick={() => router.push("/dashboard/manage_online_system/verification_accounts_codes")}
          >
            <Image src="/lock-cog.svg" alt="VAC" width={20} height={20} />
            Verification Accounts Codes (VAC)
          </button>

          {isOnlineVideosEnabled && (
            <button
              className="dashboard-btn"
              onClick={() => router.push("/dashboard/manage_online_system/verification_video_codes")}
            >
              <Image src="/lock-cog.svg" alt="VVC" width={20} height={20} />
              Verification Video Codes (VVC)
            </button>
          )}

          {isHomeworksVideosEnabled && (
            <button
              className="dashboard-btn"
              onClick={() => router.push("/dashboard/manage_online_system/verification_homework_codes")}
            >
              <Image src="/lock-cog.svg" alt="VHC" width={20} height={20} />
              Verification Homework Codes (VHC)
            </button>
          )}

          <button
            className="dashboard-btn"
            onClick={() => router.push("/dashboard/manage_online_system/change_student_account_password")}
          >
            <Image src="/key.svg" alt="Change Password" width={20} height={20} />
            Change Student Account Password
          </button>

          <button
            className="dashboard-btn"
            onClick={() => router.push("/dashboard/manage_online_system/delete_student_account")}
            style={{ background: "linear-gradient(90deg, #dc3545 0%, #ff6b6b 100%)" }}
          >
            <Image src="/trash2.svg" alt="Delete" width={20} height={20} />
            Delete Student Account
          </button>

          <button
            className="dashboard-btn"
            onClick={() => router.push("/dashboard/manage_online_system/preview_student_homeworks")}
          >
            <Image src="/books.svg" alt="Preview Homeworks" width={20} height={20} />
            Preview Student Homeworks
          </button>

          <button
            className="dashboard-btn"
            onClick={() => router.push("/dashboard/manage_online_system/preview_student_quizzes")}
          >
            <Image src="/notepad.svg" alt="Preview Quizzes" width={20} height={20} />
            Preview Student Quizzes
          </button>

        </div>
      </div>
    </div>
  );
}

