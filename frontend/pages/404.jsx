import { useRouter } from 'next/router';
import Image from 'next/image';

export default function Custom404() {
  const router = useRouter();
  
  // Get the page that user tried to access
  const requestedPage = router.asPath || 'unknown page';

  return (
    <div style={{ 
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Background decorative elements */}
      <div style={{
        position: "absolute",
        top: "-50%",
        left: "-50%",
        width: "200%",
        height: "100%",
        background: "radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)",
        animation: "float 20s ease-in-out infinite"
      }} />
      
      <div style={{
        position: "absolute",
        top: "20%",
        right: "10%",
        width: "200px",
        height: "200px",
        background: "radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)",
        borderRadius: "50%",
        animation: "pulse 15s ease-in-out infinite"
      }} />
      
      <div style={{
        position: "absolute",
        bottom: "20%",
        left: "10%",
        width: "150px",
        height: "150px",
        background: "radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 70%)",
        borderRadius: "50%",
        animation: "float 25s ease-in-out infinite reverse"
      }} />

      {/* Main content */}
      <div style={{ 
        maxWidth: 700, 
        textAlign: "center",
        background: "rgba(255, 255, 255, 0.98)",
        backdropFilter: "blur(20px)",
        borderRadius: "24px",
        padding: "60px 40px",
        boxShadow: "0 25px 80px rgba(0, 0, 0, 0.15)",
        border: "1px solid rgba(255, 255, 255, 0.2)",
        position: "relative",
        zIndex: 10
      }}>
        <style jsx>{`
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
          }
          
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.1); opacity: 0.8; }
          }
          
          @keyframes slideInUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          
          .logo-container {
            margin-bottom: 10px;
            animation: slideInUp 0.8s ease-out;
          }
          
          .logo {
            border-radius: 50%;
            box-shadow: 0 12px 32px rgba(31, 168, 220, 0.25);
            transition: transform 0.3s ease;
          }
          
          .logo:hover {
            transform: scale(1.05);
          }
          
          .error-code {
            font-size: 8rem;
            font-weight: 900;
            background: linear-gradient(90deg,rgba(158, 158, 158, 1) 0%, rgba(99, 191, 191, 1) 50%, rgba(8, 156, 170, 1) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            margin: 0;
            text-shadow: none;
            line-height: 1;
            animation: slideInUp 0.8s ease-out 0.2s both;
            position: relative;
          }
          
          .error-code::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 50%;
            transform: translateX(-50%);
            width: 80px;
            height: 4px;
            background: linear-gradient(90deg,rgba(158, 158, 158, 1) 0%, rgba(99, 191, 191, 1) 50%, rgba(8, 156, 170, 1) 100%);
            border-radius: 2px;
          }
          
          .error-title {
            font-size: 2.5rem;
            font-weight: 800;
            color: #2d3748;
            margin: 30px 0 20px 0;
            animation: slideInUp 0.8s ease-out 0.4s both;
          }
          
          .error-message {
            font-size: 1.2rem;
            color: #718096;
            margin-bottom: 40px;
            line-height: 1.7;
            animation: slideInUp 0.8s ease-out 0.6s both;
            max-width: 500px;
            margin-left: auto;
            margin-right: auto;
          }
          
          .requested-page-highlight {
            color: #1FA8DC;
            font-weight: 700;
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            background: rgba(31, 168, 220, 0.1);
            padding: 4px 8px;
            border-radius: 6px;
            border: 1px solid rgba(31, 168, 220, 0.2);
          }
          
          .action-buttons {
            display: flex;
            gap: 20px;
            justify-content: center;
            flex-wrap: wrap;
            animation: slideInUp 0.8s ease-out 0.8s both;
          }
          
          .btn {
            padding: 16px 32px;
            border: none;
            border-radius: 16px;
            font-size: 1.1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            gap: 12px;
            position: relative;
            overflow: hidden;
            min-width: 180px;
            justify-content: center;
          }
          
          .btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s;
          }
          
          .btn:hover::before {
            left: 100%;
          }
          
          .btn-primary {
            background: linear-gradient(90deg,rgba(158, 158, 158, 1) 0%, rgba(99, 191, 191, 1) 50%, rgba(8, 156, 170, 1) 100%);
            color: white;
            box-shadow: 0 8px 25px rgba(31, 168, 220, 0.4);
          }
          
          .btn-primary:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 35px rgba(31, 168, 220, 0.5);
          }
          
          .btn-secondary {
            background: linear-gradient(135deg, #718096 0%, #a0aec0 100%);
            color: white;
            box-shadow: 0 8px 25px rgba(113, 128, 150, 0.4);
          }
          
          .btn-secondary:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 35px rgba(113, 128, 150, 0.5);
          }
          
          .btn-contact {
            background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
            color: white;
            box-shadow: 0 8px 25px rgba(34, 197, 94, 0.4);
          }
          
          .btn-contact:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 35px rgba(34, 197, 94, 0.5);
          }
          
          .icon {
            font-size: 1.1rem;
            filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
          }
          
          @media (max-width: 768px) {
            .error-code {
              font-size: 6rem;
            }
            .error-title {
              font-size: 2rem;
            }
            .error-message {
              font-size: 1.1rem;
            }
            .action-buttons {
              flex-direction: column;
              align-items: center;
            }
            .btn {
              width: 100%;
              max-width: 280px;
            }
          }
          
          @media (max-width: 480px) {
            .error-code {
              font-size: 5rem;
            }
            .error-title {
              font-size: 1.8rem;
            }
            .error-message {
              font-size: 1rem;
            }
            .btn {
              padding: 14px 28px;
              font-size: 1rem;
            }
          }
        `}</style>

        <div className="logo-container">
          <Image
            src="/logo.png"
            alt="TopPhysics Logo"
            width={90}
            height={90}
            className="logo"
            style={{
              borderRadius: "50%",
              objectFit: "cover",
              background: "transparent"
            }}
          />
        </div>

        <h1 className="error-code">404</h1>
        <h2 className="error-title">Page Not Found</h2>
        <p className="error-message">
          We couldn't find the <span className="requested-page-highlight">{requestedPage}</span> page you're looking for. 
          It might have been moved, deleted, or you entered an incorrect URL.
        </p>

        <div className="action-buttons">
          <button 
            className="btn btn-contact"
            onClick={() => router.push('/contact_developer')}
          >
            <Image src="/message.svg" alt="Contact" style={{ transform: "translateY(4px)" }} width={20} height={20} />
            Contact Developer
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => router.push('/')}
          >
            <Image src="/lock.svg" alt="lock" style={{ transform: "translateY(4px)" }} width={20} height={20} />
            Go to Login
          </button>
          <button 
            className="btn btn-secondary"
            onClick={() => {
              // Check if we can go back to a valid page
              if (window.history.length > 1) {
                // Try to go back
                router.back();
              } else {
                // If no history, go to login
                router.push('/');
              }
            }}
          >
            <Image src="/arrow-left.svg" alt="Back" style={{ transform: "translateY(4px)" }} width={20} height={20} />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
} 