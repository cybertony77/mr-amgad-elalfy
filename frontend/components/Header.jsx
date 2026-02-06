import Image from 'next/image';
import UserMenu from './UserMenu';
import { useRouter } from 'next/router';
import { useProfile } from '../lib/api/auth';
import { useSystemConfig } from '../lib/api/system';

export default function Header() {
  const router = useRouter();
  const isDashboard = router.pathname === '/dashboard';
  const { data: user } = useProfile();
  const { data: systemConfig } = useSystemConfig();
  const userRole = user?.role || '';
  const systemName = systemConfig?.name || 'Demo Attendance System';
  
  const handleLogoClick = () => {
    if (userRole === 'student') {
      router.push('/student_dashboard');
    } else {
      router.push('/dashboard');
    }
  };
  
  return (
    <header className="header" style={{
      width: '100%',
      background: 'transparent',
      padding: '18px 0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: 'none',
      borderBottom: '2px solid #e9ecef',
      gap: 18,
      position: 'relative',
      zIndex: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginLeft: 32 }}>
        <span onClick={handleLogoClick} style={{ cursor: 'pointer', display: 'inline-block' }}>
          <img
            src="/logo.png"
            alt={`${systemName} Logo`}
            width={50}
            height={50}
            style={{ 
              borderRadius: '50%', 
              background: 'white', 
              boxShadow: '0 2px 8px rgba(31,168,220,0.10)',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block'
            }}
            onError={(e) => {
              console.error('Logo failed to load:', e);
              // Fallback to a text-based logo if image fails
              e.target.style.display = 'none';
              const fallback = document.createElement('div');
              fallback.innerHTML = 'TP';
              fallback.style.cssText = `
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: linear-gradient(135deg, #1FA8DC 0%, #FEB954 100%);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 18px;
                box-shadow: 0 2px 8px rgba(31,168,220,0.10);
              `;
              e.target.parentNode.appendChild(fallback);
            }}
          />
        </span>
        <span style={{
          fontWeight: 900,
          fontSize: 26,
          color: '#FFFFFF',
          letterSpacing: 1.2,
          textShadow: '0 2px 8px rgba(31,168,220,0.10)'
        }}>
          {systemName}
        </span>
      </div>
      <UserMenu />
      <style jsx>{`
        @media (max-width: 768px) {
          span {
            font-size: 20px !important;
            letter-spacing: 0.8px !important;
          }
          img {
            width: 50px !important;
            height: 50px !important;
          }
        }
        @media (max-width: 480px) {
          span {
            font-size: 17px !important;
            letter-spacing: 0.5px !important;
          }
          img {
            width: 45px !important;
            height: 45px !important;
          }
        }
      `}</style>
    </header>
  );
} 