import Image from "next/image";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Title from "../components/Title";
import apiClient from "../lib/axios";
import { useSystemConfig } from "../lib/api/system";

export default function ContactDeveloperPage() {
  const router = useRouter();
  const { data: systemConfig } = useSystemConfig();
  const systemName = systemConfig?.name || 'Math Academy';
  const [hasToken, setHasToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [developerPhone, setDeveloperPhone] = useState('201211172756');
  const [developerEmail, setDeveloperEmail] = useState('tony.joseph.business1717@gmail.com');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await apiClient.get("/api/auth/me");
        if (res.status === 200) {
          setHasToken(true);
        } else {
          setHasToken(false);
        }
      } catch (err) {
        setHasToken(false);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const fetchDeveloperContact = async () => {
      try {
        const res = await fetch('/api/developer/contact');
        if (res.ok) {
          const data = await res.json();
          if (data.phone) setDeveloperPhone(data.phone);
          if (data.email) setDeveloperEmail(data.email);
        }
      } catch (err) {
        console.error('Error fetching developer contact:', err);
        // Use defaults if fetch fails
      }
    };
    fetchDeveloperContact();
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(90deg,rgba(158, 158, 158, 1) 0%, rgba(99, 191, 191, 1) 50%, rgba(8, 156, 170, 1) 100%)",
        display: "flex",
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
          height: "200%",
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

        {/* Loading Card */}
        <div style={{
          background: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(20px)",
          borderRadius: "24px",
          padding: "60px 40px",
          border: "1px solid rgba(255, 255, 255, 0.2)",
          textAlign: "center",
          position: "relative",
          zIndex: 10,
          maxWidth: 500,
          width: "100%",
          boxShadow: "0 25px 80px rgba(0, 0, 0, 0.15)"
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
            
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
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
            
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            
            .loading-container {
              animation: slideInUp 0.8s ease-out;
            }
            
            .loading-logo {
              animation: pulse 2s ease-in-out infinite;
            }
            
            .loading-spinner {
              animation: spin 1s linear infinite;
            }
            
            .loading-text {
              background: linear-gradient(
                90deg,
                #1FA8DC 0%,
                #FEB954 50%,
                #1FA8DC 100%
              );
              background-size: 200% 100%;
              animation: shimmer 2s ease-in-out infinite;
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
              background-clip: text;
            }
            
            .loading-dots {
              animation: pulse 1.5s ease-in-out infinite;
            }
            
            .loading-dots::after {
              content: '';
              animation: pulse 1.5s ease-in-out infinite 0.2s;
            }
            
            .loading-dots::before {
              content: '';
              animation: pulse 1.5s ease-in-out infinite 0.4s;
            }
          `}</style>

          <div className="loading-container">
            {/* Logo */}
            <div style={{
              width: "100px",
              height: "100px",
              borderRadius: "50%",
              overflow: "hidden",
              margin: "0 auto 24px auto",
              boxShadow: "0 8px 24px rgba(31,168,220,0.15)",
              background: "#e9ecef",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative"
            }} className="loading-logo">
              <Image 
                src="/logo.png" 
                alt="Math Academy Logo" 
                width={100} 
                height={100} 
                style={{ objectFit: "cover" }} 
              />
            </div>
            
            {/* Loading Spinner */}
            <div style={{
              width: "50px",
              height: "50px",
              border: "4px solid rgba(31, 168, 220, 0.2)",
              borderTop: "4px solid #1FA8DC",
              borderRadius: "50%",
              margin: "0 auto 24px auto",
              animation: "spin 1s linear infinite"
            }} className="loading-spinner" />
            
            {/* Loading Text */}
            <h2 style={{ 
              color: "#1FA8DC", 
              fontWeight: 700, 
              marginBottom: 16, 
              fontSize: "1.8rem",
              letterSpacing: 0.5
            }} className="loading-text">
              Checking Session
            </h2>
            
            <p style={{ 
              color: "#6c757d", 
              fontSize: "1rem", 
              fontWeight: 500,
              marginBottom: 24,
              lineHeight: 1.5
            }}>
              Verifying your authentication status...
            </p>
            
            {/* Loading Dots */}
            <div style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
              marginTop: "16px"
            }}>
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#1FA8DC",
                animation: "pulse 1.5s ease-in-out infinite"
              }} />
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#FEB954",
                animation: "pulse 1.5s ease-in-out infinite 0.2s"
              }} />
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#1FA8DC",
                animation: "pulse 1.5s ease-in-out infinite 0.4s"
              }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px",
      position: "relative",
      overflow: "hidden"
    }}>
      {/* Background decorative elements */}
      <div style={{
        position: "absolute",
        top: "-50%",
        left: "-50%",
        width: "200%",
        height: "200%",
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
        margin: "0 auto", 
        position: "relative",
        zIndex: 2
      }}>
        {/* Show Title component only if user has token */}
        {hasToken && (
          <Title backText="Back" href={null}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              Contact Developer
            </div>
          </Title>
        )}
        
        <div className="contact-card-container">
          <style jsx>{`
            .contact-card-container {
              position: relative;
              background: #2a3037;
              backdrop-filter: blur(20px);
              border-radius: 24px;
              padding: 0;
              border: 10px solid #2a3037;
              text-align: center;
              overflow: visible;
            }

            .cover-image-container {
              height: 300px;
            }
            
            .profile-image-container {
              width: 160px;
              height: 160px;
              top: 210px;
            }
            
            .profile-image-container img {
              width: 100%;
              height: 100%;
            }
            
            @media (max-width: 768px) {
              div[style*="padding: 50px 40px"] {
                padding: 40px 30px !important;
              }
              
              .cover-image-container {
                height: 250px !important;
              }
              
              .profile-image-container {
                width: 140px !important;
                height: 140px !important;
                top: 185px !important;
              }
              
              div[style*="paddingTop: 110px"] {
                padding-top: 95px !important;
              }
            }
            
            @media (max-width: 480px) {
              div[style*="padding: 50px 40px"] {
                padding: 30px 20px !important;
              }
              
              .cover-image-container {
                height: 200px !important;
              }
              
              .profile-image-container {
                width: 120px !important;
                height: 120px !important;
                top: 150px !important;
              }
              
              div[style*="paddingTop: 110px"] {
                padding-top: 80px !important;
              }
            }
            
            @media (max-width: 360px) {
              div[style*="padding: 50px 40px"] {
                padding: 25px 15px !important;
              }
              
              .cover-image-container {
                height: 180px !important;
              }
              
              .profile-image-container {
                width: 100px !important;
                height: 100px !important;
                top: 135px !important;
              }
              
              div[style*="paddingTop: 110px"] {
                padding-top: 70px !important;
              }
            }
            
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
            
            .profile-container {
              animation: slideInUp 0.8s ease-out;
            }
            
            .contact-info {
              animation: slideInUp 0.8s ease-out 0.2s both;
            }
            
            .contact-methods {
              animation: slideInUp 0.8s ease-out 0.4s both;
            }
            
            .description {
              animation: slideInUp 0.8s ease-out 0.6s both;
            }
            
            .contact-item {
              background: linear-gradient(135deg, rgba(31, 168, 220, 0.1) 0%, rgba(254, 185, 84, 0.1) 100%);
              border: 2px solid rgba(31, 168, 220, 0.2);
              border-radius: 16px;
              padding: 20px;
              margin: 20px 0;
              transition: all 0.3s ease;
              position: relative;
              overflow: hidden;
            }
            
            .contact-item::before {
              content: '';
              position: absolute;
              top: 0;
              left: -100%;
              width: 100%;
              height: 100%;
              background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
              transition: left 0.5s;
            }
            
            .contact-item:hover::before {
              left: 100%;
            }
            
            .contact-item:hover {
              transform: translateY(-3px);
              box-shadow: 0 8px 25px rgba(31, 168, 220, 0.2);
              border-color: rgba(31, 168, 220, 0.4);
            }
            
            .contact-icon {
              width: 60px;
              height: 60px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 24px;
              margin: 0 auto 16px auto;
              transition: transform 0.3s ease;
            }
            
            .contact-item:hover .contact-icon {
              transform: scale(1.1);
            }
            
            .phone-icon {
              background: linear-gradient(135deg, #dc3545 0%, #ff6b6b 100%);
              color: white;
            }
            
            .email-icon {
              background: linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%);
              color: white;
            }
            
            .contact-link {
              color: inherit;
              text-decoration: none;
              font-weight: 700;
              transition: all 0.3s ease;
              display: inline-block;
              padding: 8px 16px;
              border-radius: 8px;
              background: #24292f;
              border: 1px solid rgba(31, 168, 220, 0.2);
            }
            
            .contact-link:hover {
              background: #262c2f;
              transform: translateY(-2px);
              box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
            }
            
            .profile-image {
              border-radius: 50%;
              box-shadow: 0 12px 32px rgba(31, 168, 220, 0.25);
              transition: transform 0.3s ease;
              border: 4px solid rgba(255, 255, 255, 0.8);
            }
            
            .profile-image:hover {
              transform: scale(1.05);
            }
            
            @media (max-width: 768px) {
              .profile-container h1 {
                font-size: 2.5rem !important;
              }
              
              .contact-item {
                padding: 16px;
                margin: 20px 0;
              }
              
              .contact-icon {
                width: 50px;
                height: 50px;
                font-size: 20px;
              }
              
              .contact-link {
                font-size: 0.9rem;
                padding: 6px 12px;
                word-break: break-word;
                max-width: 100%;
                display: inline-block;
              }
            }
            
            @media (max-width: 480px) {
              .profile-container h1 {
                font-size: 2rem !important;
              }
              
              .contact-item {
                padding: 14px;
                margin: 20px 0;
              }
              
              .contact-icon {
                width: 55px;
                height: 55px;
                font-size: 18px;
              }
              
              .contact-link {
                font-size: 0.85rem;
                padding: 5px 10px;
                word-break: break-word;
                max-width: 100%;
                display: inline-block;
              }
              
              .profile-container div {
                font-size: 1.1rem !important;
                padding: 6px 16px !important;
              }
            }
            
            @media (max-width: 360px) {
              .profile-container h1 {
                font-size: 1.8rem !important;
              }
              
              .contact-link {
                font-size: 0.8rem;
                padding: 4px 8px;
                word-break: break-all;
              }
              
              .profile-container div {
                font-size: 1rem !important;
                padding: 5px 12px !important;
              }
            }
          `}</style>
          {/* Cover Image Banner - positioned at top of card, full width */}
          <div className="cover-image-container" style={{
            position: "relative",
            width: "100%",
            height: "300px",
            borderRadius: "25px",
            overflow: "hidden",
            margin: 0,
            zIndex: 2
          }}>
            {/* Cover Image */}
            <Image 
              src="/tony_joseph_cover.jpg" 
              alt="Tony Joseph Cover" 
              fill
              style={{ 
                objectFit: "cover"
              }} 
              priority
            />
          </div>
          
          {/* Profile Image Overlay - 50% above cover bottom (80px), 50% below (80px) */}
          <div className="profile-image-container" style={{
            position: "absolute",
            top: "210px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "160px",
            height: "160px",
            borderRadius: "50%",
            overflow: "hidden",
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            background: "black",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "6px solid #2a3037",
            zIndex: 3
          }}>
            <Image 
              src="/tony_joseph.jpg" 
              alt="Tony Joseph" 
              width={160} 
              height={160} 
              className="profile-image"
              style={{ objectFit: "cover" }} 
            />
          </div>
          
          {/* Inner content container */}
          <div style={{
            padding: "50px 10px",
            paddingTop: "100px",
            position: "relative",
            zIndex: 2
          }}>

          {/* Profile Section */}
          <div className="profile-container" style={{ marginBottom: "32px" }}>
            
            {/* Title below profile */}
            <div style={{ 
              color: "#FEB954", 
              fontWeight: 700, 
              fontSize: "1.3rem", 
              marginBottom: 32, 
              letterSpacing: 0.5,
              background: "rgba(254, 185, 84, 0.1)",
              padding: "8px 20px",
              borderRadius: "20px",
              border: "2px solid rgba(254, 185, 84, 0.2)",
              textAlign: "center"
            }}>
              🚀 Senior Software Developer
            </div>
          </div>

          {/* Contact Methods */}
          <div className="contact-methods">
            {/* Phone Section */}
            <div className="contact-item">
              <div className="contact-icon phone-icon">
                <Image src="/phone-incoming.svg" alt="Phone" width={32} height={32} />
              </div>
              <h3 style={{ 
                color: "#dc3545", 
                fontWeight: 800, 
                marginBottom: 16, 
                fontSize: "1.4rem" 
              }}>
                Phone Numbers
              </h3>
              <div>
                <a 
                  href={`tel:${developerPhone}`}
                  className="contact-link"
                  style={{ color: "#dc3545" }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Image src="/phone-incoming.svg" alt="Phone" width={20} height={20} />
                    {developerPhone.startsWith('2') ? developerPhone.substring(1) : developerPhone}
                  </span>
                </a>
              </div>
            </div>

            {/* WhatsApp Section */}
            <div className="contact-item">
              <div className="contact-icon" style={{
                background: "#25d366",
                color: "white"
              }}>
                <Image src="/whatsapp.svg" alt="WhatsApp" width={40} height={40} />
              </div>
              <h3 style={{ 
                color: "#25d366", 
                fontWeight: 800, 
                marginBottom: 16, 
                fontSize: "1.4rem" 
              }}>
                WhatsApp
              </h3>
              <div>
                <a 
                  href={`https://wa.me/${developerPhone}?text=${encodeURIComponent(`Hello Tony, I need help in the ${systemName}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-link"
                  style={{ color: "#25d366" }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                    <Image src="/message-dots.svg" alt="Message" width={20} height={20} />
                    Message me on WhatsApp
                  </span>
                </a>
              </div>
            </div>
              
            {/* Email Section */}
            <div className="contact-item">
              <div className="contact-icon email-icon">
                <Image src="/mail.svg" alt="Email" width={32} height={32} />
              </div>
              <h3 style={{ 
                color: "#1FA8DC", 
                fontWeight: 800, 
                marginBottom: 16, 
                fontSize: "1.4rem" 
              }}>
                Email Address
              </h3>
              <div>
                <a 
                  href={`mailto:${developerEmail}`}
                  className="contact-link"
                  style={{ color: "#1FA8DC" }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Image src="/mail.svg" alt="Email" width={20} height={20} />
                    {developerEmail}
                  </span>
                </a>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="description" style={{ 
            marginTop: 32, 
            color: "#ededed", 
            fontSize: "1.1rem", 
            fontWeight: 500,
            lineHeight: 1.6,
            background: "rgba(31, 168, 220, 0.05)",
            padding: "20px",
            borderRadius: "16px",
            border: "1px solid rgba(31, 168, 220, 0.1)"
          }}>
            💡 Feel free to contact me for any technical support, bug reports, feature requests, or urgent issues regarding the {systemName}. I'm here to help ensure the system runs smoothly for all users.
          </div>

          {/* Action Buttons */}
          <div style={{ 
            display: "flex", 
            gap: "12px", 
            marginTop: "24px",
            flexDirection: "column"
          }}>
            {/* Show Login and Go Back buttons only if user doesn't have token */}
            {!hasToken && (
              <>
                {/* Login Button */}
                <button 
                  onClick={() => router.push('/')}
                  style={{
                    width: "100%",
                    background: "linear-gradient(135deg, #28a745 0%, #20c997 100%)",
                    border: "none",
                    borderRadius: "16px",
                    height: "50px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(40, 167, 69, 0.3)",
                    transition: "all 0.3s ease",
                    fontSize: "1.1rem",
                    color: "white",
                    fontWeight: "600",
                    position: "relative",
                    overflow: "hidden"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 6px 20px rgba(40, 167, 69, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 16px rgba(40, 167, 69, 0.3)";
                  }}
                >
                  <Image src="/lock.svg" style={{ transform: "translateY(0px) !important" }} alt="Lock" width={20} height={20} />
                  <span style={{ marginLeft: "8px" }}>Go to Login</span>
                </button>

                {/* Back Button */}
                <button 
                  onClick={() => router.back()}
                  style={{
                    width: "100%",
                    background: "linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%)",
                    border: "none",
                    borderRadius: "16px",
                    height: "50px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    boxShadow: "0 4px 16px rgba(31, 168, 220, 0.3)",
                    transition: "all 0.3s ease",
                    fontSize: "1.1rem",
                    color: "white",
                    fontWeight: "600",
                    position: "relative",
                    overflow: "hidden"
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = "translateY(-2px)";
                    e.target.style.boxShadow = "0 6px 20px rgba(31, 168, 220, 0.4)";
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = "translateY(0)";
                    e.target.style.boxShadow = "0 4px 16px rgba(31, 168, 220, 0.3)";
                  }}
                >
                  <Image src="/arrow-left.svg" style={{ transform: "translateY(0px) !important" }} alt="Back" width={20} height={20} />
                  <span style={{ marginLeft: "8px" }}>Go Back</span>
                </button>
              </>
            )}


          </div>
          </div>
        </div>
      </div>
    </div>
  );
} 