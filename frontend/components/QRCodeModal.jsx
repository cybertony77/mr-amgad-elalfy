import { useState, useEffect, useRef } from "react";
import { QRCode } from "react-qrcode-logo";
import html2canvas from "html2canvas";
import Image from 'next/image';
import { useProfile } from '../lib/api/auth';
import { useStudent } from '../lib/api/students';

export default function QRCodeModal({ isOpen, onClose }) {
  const { data: profile } = useProfile();
  const studentId = profile?.id ? profile.id.toString() : null;
  const { data: studentData, isLoading: studentDataLoading } = useStudent(studentId, {
    enabled: !!studentId && isOpen,
  });

  const [qrSize, setQrSize] = useState(350);
  const [logoSize, setLogoSize] = useState(85);
  const [isGenerating, setIsGenerating] = useState(true);
  const modalRef = useRef(null);

  // Handle responsive QR code sizing
  useEffect(() => {
    if (!isOpen) return;
    
    const computeResponsiveSizes = () => {
      if (typeof window === 'undefined') return;
      const vw = window.innerWidth || 1024;
      const available = Math.max(200, Math.min(400, Math.floor(vw * 0.7)));
      setQrSize(available);
      setLogoSize(Math.round(available * 0.24));
    };

    computeResponsiveSizes();
    window.addEventListener('resize', computeResponsiveSizes);
    return () => window.removeEventListener('resize', computeResponsiveSizes);
  }, [isOpen]);

  // Simulate QR generation delay and then show QR
  useEffect(() => {
    if (isOpen && studentData?.id) {
      setIsGenerating(true);
      // Small delay to show spinner
      const timer = setTimeout(() => {
        setIsGenerating(false);
      }, 500);
      return () => clearTimeout(timer);
    } else if (isOpen && !studentDataLoading && !studentData?.id) {
      setIsGenerating(false);
    }
  }, [isOpen, studentData, studentDataLoading]);

  // Close modal when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  // Close on Escape key
  useEffect(() => {
    function handleEscape(event) {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const downloadSingleQR = async () => {
    try {
      const container = document.querySelector('.qr-container-modal');
      if (!container) {
        alert("QR code not found. Please try again.");
        return;
      }
      const canvas = await html2canvas(container, {
        backgroundColor: null,
        useCORS: true
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `StudentID_${studentData?.id || studentId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
      alert("Download failed. Please try again.");
    }
  };

  const qrValue = studentData?.id 
    ? `https://linktr.ee/mr_amgad_elalfy/?id=${studentData.id}`
    : '';

  if (!isOpen) return null;

  return (
    <>
      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn 0.3s ease;
        }
        .modal-content {
          position: relative;
          border-radius: 20px;
          padding: 30px;
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          animation: slideUp 0.3s ease;
          z-index: 10000;
        }
        .spinner-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
        }
        .spinner {
          width: 50px;
          height: 50px;
          border: 4px solid #f3f3f3;
          border-top: 4px solid #1FA8DC;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .spinner-text {
          margin-top: 20px;
          color: #ffffff;
          font-size: 16px;
          font-weight: 600;
        }
        .qr-container-modal {
          border-radius: 25px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(90deg,rgba(119, 214, 224, 1) 50%, rgba(8, 156, 170, 1) 100%);
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          margin: 0 auto;
          text-align: center;
          width: 100%;
          max-width: 440px;
          min-height: 400px;
        }
        .qr-container-modal canvas,
        .qr-container-modal svg {
          max-width: 100%;
          height: auto !important;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
        .qr-id-text {
          margin-top: 15px;
          font-weight: 700;
          font-size: 1.4rem;
          color: #222;
          letter-spacing: 1px;
          text-align: center;
        }
        .download-btn {
          width: 200px;
          margin: 30px auto 0 auto;
          padding: 14px 24px;
          background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .download-btn:hover {
          background: linear-gradient(135deg, #1e7e34 0%, #17a2b8 100%);
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(40, 167, 69, 0.4);
        }
        .download-btn:active {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { 
            opacity: 0;
            transform: translateY(30px);
          }
          to { 
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (max-width: 768px) {
          .modal-content {
            padding: 20px;
            width: 95%;
          }
          .qr-container-modal {
            padding: 16px;
            max-width: 92%;
          }
          .qr-id-text {
            font-size: 1.2rem;
          }
        }
        @media (max-width: 480px) {
          .modal-content {
            padding: 15px;
          }
          .qr-container-modal {
            padding: 12px;
            max-width: 95%;
          }
          .qr-id-text {
            font-size: 1.1rem;
          }
        }
      `}</style>
      <div className="modal-overlay">
        <div className="modal-content" ref={modalRef}>
          {isGenerating || studentDataLoading ? (
            <div className="spinner-container">
              <div className="spinner"></div>
              <div className="spinner-text">Generating QR Code...</div>
            </div>
          ) : studentData?.id ? (
            <>
              <div className="qr-container-modal">
                <QRCode
                  id="student-qr-svg-modal"
                  value={qrValue}
                  size={qrSize}
                  ecLevel="H"
                  logoImage="/logo.png"
                  logoWidth={logoSize}
                  logoHeight={logoSize}
                  logoPadding={3}
                  logoPaddingStyle="square"
                  logoBackgroundColor="white"
                  logoBackgroundTransparent={false}
                  removeQrCodeBehindLogo={true}
                  logoPosition="center"
                />
                <div className="qr-id-text">{`ID No. ${studentData.id}`}</div>
              </div>
              <button className="download-btn" onClick={downloadSingleQR}>
                <Image src="/download.svg" alt="Download" width={20} height={20} />
                Download QR
              </button>
            </>
          ) : (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "#666" }}>
              Unable to load student information.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

