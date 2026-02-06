import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Title from '../../components/Title';

export default function ManageAssistants() {
  const router = useRouter();

  useEffect(() => {
    // Authentication is now handled by _app.js with HTTP-only cookies
    // This component will only render if user is authenticated
    
    // Admin access is now handled by _app.js
  }, []);

  return (
    <div className="page-wrapper" style={{ 
      padding: "20px",
      display: 'flex',
      flexDirection: 'column',
      overflow: 'auto',
      paddingBottom: '20px',
      marginTop: '20px'
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
            <Image src="/settings.svg" alt="Settings" width={32} height={32} />
            Manage Assistants
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
          }
          .dashboard-btn:hover {
            background: linear-gradient(90deg, #5F9EA0 0%, #87CEEB 100%);
            transform: translateY(-2px) scale(1.03);
          }
          
          @media (max-width: 768px) {
            .dashboard-btn {
              padding: 12px 0;
              font-size: 1rem;
              margin-bottom: 12px;
            }
          }
          
          @media (max-width: 480px) {
            .page-wrapper {
              padding: 10px 15px 5px 15px;
            }
            .dashboard-btn {
              padding: 10px 0;
              font-size: 0.95rem;
              margin-bottom: 10px;
            }
          }
        `}</style>
          <button
            className="dashboard-btn"
            onClick={() => router.push('/manage_assistants/all_assistants')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Image src="/users.svg" alt="All Assistants" width={20} height={20} />
            All Assistants
          </button>
          <button
            className="dashboard-btn"
            onClick={() => router.push('/manage_assistants/add_assistant')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Image src="/user-plus2.svg" alt="Add Assistant" width={20} height={20} />
            Add Assistant
          </button>
          <button
            className="dashboard-btn"
            onClick={() => router.push('/manage_assistants/edit_assistant')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Image src="/user-edit2.svg" alt="Edit Assistant" width={20} height={20} />
            Edit Assistant
          </button>
          <button
            className="dashboard-btn"
            style={{ background: 'linear-gradient(90deg, #dc3545 0%, #ff6b6b 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            onClick={() => router.push('/manage_assistants/delete_assistant')}
          >
            <Image src="/trash2.svg" alt="Delete Assistant" width={20} height={20} />
            Delete Assistant
          </button>
      </div>
    </div>
  );
} 