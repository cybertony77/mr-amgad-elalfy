import { useState, useEffect, useRef } from "react";
import Image from 'next/image';
import { QRCode } from "react-qrcode-logo";
import JSZip from "jszip";
import { useRouter } from "next/router";
import html2canvas from "html2canvas";
import Title from "../../components/Title";

export default function QRGenerator() {
  const router = useRouter();
  const [mode, setMode] = useState("");
  const [singleId, setSingleId] = useState("");
  const [showQR, setShowQR] = useState(false);
  const [manyFrom, setManyFrom] = useState("");
  const [manyTo, setManyTo] = useState("");
  const [zipUrl, setZipUrl] = useState("");
  const [manyGenerating, setManyGenerating] = useState(false);
  const [qrIds, setQrIds] = useState([]);
  const [qrSize, setQrSize] = useState(350);
  const [logoSize, setLogoSize] = useState(85);

  const inputRef = useRef(null);

  // Handle responsive QR code sizing
  useEffect(() => {
    const computeResponsiveSizes = () => {
      if (typeof window === 'undefined') return;
      const vw = window.innerWidth || 1024;
      // Leave comfortable padding around the QR container on small screens
      const available = Math.max(180, Math.min(360, Math.floor(vw * 0.82)));
      setQrSize(available);
      // Keep logo roughly a quarter of QR size for good readability
      setLogoSize(Math.round(available * 0.24));
    };

    computeResponsiveSizes();
    window.addEventListener('resize', computeResponsiveSizes);
    return () => window.removeEventListener('resize', computeResponsiveSizes);
  }, []);

  useEffect(() => {
    if (router.isReady) {
      const { mode, id } = router.query;
      if (mode === "single") {
        setMode("single");
        if (id) {
          setSingleId(id);
          setShowQR(false);
          setTimeout(() => {
            if (inputRef.current) inputRef.current.focus();
          }, 100);
        }
      }
    }
  }, [router.isReady, router.query]);

  // Single QR download
  const downloadSingleQR = async () => {
    try {
      const container = document.querySelector('.qr-container');
      if (!container) {
        alert("QR code not found. Please generate a QR code first.");
        return;
      }
      // Use html2canvas to capture the container
      const canvas = await html2canvas(container, {
        backgroundColor: null, // preserve transparency if any
        useCORS: true
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `StudentID_${singleId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
      alert("Download failed. Please try again.");
    }
  };

  // Many QR download
  const generateManyQRCodes = async () => {
    try {
      setManyGenerating(true);
      setZipUrl("");
      const zip = new JSZip();
      const from = parseInt(manyFrom, 10);
      const to = parseInt(manyTo, 10);
      const ids = [];
      for (let i = from; i <= to; i++) ids.push(i);
      setQrIds(ids);
      
      // Wait for QR codes to render
      await new Promise((resolve) => setTimeout(resolve, 1000));
      
      const containers = document.querySelectorAll('.hidden-qr .qr-container');
      if (containers.length === 0) {
        alert("No QR codes found. Please try again.");
        setManyGenerating(false);
        return;
      }
      
      const qrElements = [];
      containers.forEach(container => {
        const element = container.querySelector('canvas, svg');
        if (element) qrElements.push(element);
      });
      
      if (qrElements.length === 0) {
        alert("No QR code elements found. Please try again.");
        setManyGenerating(false);
        return;
      }
      
      for (let i = 0; i < ids.length; i++) {
        const element = qrElements[i];
        if (!element) continue;
        
        try {
          // Check if it's canvas or SVG
          if (element.tagName.toLowerCase() === 'canvas') {
            const container = element.closest('.qr-container');
            if (container) {
              const canvas = document.createElement("canvas");
              const ctx = canvas.getContext("2d");
              const scale = 7;
              // Use compact dimensions for downloaded QR codes
              const containerWidth = 280; // Narrower width for smaller left/right sides
              const containerHeight = 280; // Compact height
              const idText = `ID No. ${ids[i]}`;
              const idFontSize = 28;
              const idMargin = 15;
              const extraHeight = idFontSize + idMargin;
              
              canvas.width = containerWidth * scale;
              canvas.height = (containerHeight + extraHeight) * scale;
              ctx.scale(scale, scale);
              
              // Create gradient background
              const gradient = ctx.createLinearGradient(0, 0, 0, containerHeight + extraHeight);
              gradient.addColorStop(0, '#089CAA');
              gradient.addColorStop(1, '#63BFBF');
              
              const radius = 20; // Smaller radius for compact design
              ctx.fillStyle = gradient;
              ctx.beginPath();
              ctx.moveTo(radius, 0);
              ctx.lineTo(containerWidth - radius, 0);
              ctx.quadraticCurveTo(containerWidth, 0, containerWidth, radius);
              ctx.lineTo(containerWidth, containerHeight + extraHeight - radius);
              ctx.quadraticCurveTo(containerWidth, containerHeight + extraHeight, containerWidth - radius, containerHeight + extraHeight);
              ctx.lineTo(radius, containerHeight + extraHeight);
              ctx.quadraticCurveTo(0, containerHeight + extraHeight, 0, containerHeight + extraHeight - radius);
              ctx.lineTo(0, radius);
              ctx.quadraticCurveTo(0, 0, radius, 0);
              ctx.closePath();
              ctx.fill();
              
              // Draw QR code
              const qrSize = 250; // Smaller QR for compact design
              const qrX = (containerWidth - qrSize) / 2;
              const qrY = (containerHeight - qrSize) / 2;
              const qrCanvas = element;
              ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
              
              // Draw ID text
              ctx.font = `${idFontSize}px Arial`;
              ctx.fillStyle = '#222';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'top';
              ctx.fillText(idText, containerWidth / 2, containerHeight + idMargin / 2);
              
              const dataUrl = canvas.toDataURL("image/png");
              zip.file(`StudentID_${ids[i]}.png`, dataUrl.split(",")[1], { base64: true });
            } else {
              const dataUrl = element.toDataURL("image/png");
              zip.file(`StudentID_${ids[i]}.png`, dataUrl.split(",")[1], { base64: true });
            }
          } else {
            // SVG handling (existing code)
            const svgClone = element.cloneNode(true);
            const styleElements = svgClone.querySelectorAll('style');
            styleElements.forEach(style => style.remove());
            
            const serializer = new XMLSerializer();
            const svgString = serializer.serializeToString(svgClone);
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new window.Image();
            
            canvas.width = 350;
            canvas.height = 350;
            
            const svg64 = btoa(unescape(encodeURIComponent(svgString)));
            const image64 = "data:image/svg+xml;base64," + svg64;
            
            await new Promise((resolve, reject) => {
              img.onload = function () {
                try {
                  ctx.clearRect(0, 0, canvas.width, canvas.height);
                  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                                const dataUrl = canvas.toDataURL("image/png");
              zip.file(`StudentID_${ids[i]}.png`, dataUrl.split(",")[1], { base64: true });
                  resolve();
                } catch (error) {
                  console.error(`Error processing QR code ${ids[i]}:`, error);
                  reject(error);
                }
              };
              img.onerror = function() {
                reject(new Error(`Failed to load QR code ${ids[i]}`));
              };
              img.src = image64;
            });
          }
        } catch (error) {
          console.error(`Error with QR code ${ids[i]}:`, error);
        }
      }
      
      const blob = await zip.generateAsync({ type: "blob" });
      setZipUrl(URL.createObjectURL(blob));
      setManyGenerating(false);
      setQrIds([]); // clear after done
    } catch (error) {
      console.error("Batch generation error:", error);
      alert("Error generating QR codes. Please try again.");
      setManyGenerating(false);
      setQrIds([]);
    }
  };

  return (
    <div style={{ 
      minHeight: "100vh",
      padding: "20px"
    }}>
      <div style={{ 
        maxWidth: 600, 
        margin: "40px auto", 
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch"
      }}>
      <style jsx>{`
        .qr-btn {
          width: 100%;
          margin-bottom: 16px;
          padding: 16px 0;
          background: linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 700;
          letter-spacing: 1px;
          box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .qr-btn:hover {
          background: linear-gradient(135deg, #0d8bc7 0%, #5bb8e6 100%);
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(31, 168, 220, 0.4);
        }
        .qr-btn:active {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
        }
        .qr-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
          box-shadow: 0 2px 8px rgba(31, 168, 220, 0.2);
        }
        .qr-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          margin-top: 24px;
          width: 100%;
        }
        .qr-form label {
          font-weight: 600;
          color: #495057;
          font-size: 0.95rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .hidden-qr {
          position: absolute;
          left: -9999px;
          top: -9999px;
          visibility: hidden;
        }
        .hidden-qr .qr-container {
          background: linear-gradient(90deg,rgba(119, 214, 224, 1) 50%, rgba(8, 156, 170, 1) 100%);
          padding: 10px;
          border-radius: 20px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          width: fit-content;
          min-height: 320px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          margin: 0 auto;
        }
        .hidden-qr .qr-id-text {
          margin-top: 2px !important;
          font-weight: 700;
          font-size: 1.2rem;
          color: #222;
          letter-spacing: 1px;
          text-align: center;
        }
        .qr-container {
          border-radius: 25px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(90deg,rgba(119, 214, 224, 1) 50%, rgba(8, 156, 170, 1) 100%);
          padding: 24px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.1);
          margin-left: auto;
          margin-right: auto;
          text-align: center;
          width: 100%;
          max-width: 440px;
          min-height: 400px;
        }
        /* Ensure QR canvas/SVG scales with container on small screens */
        .qr-container canvas,
        .qr-container svg {
          max-width: 100%;
          height: auto !important;
          display: block;
          margin-left: auto;
          margin-right: auto;
        }
        .qr-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          margin: 25px 0 0 0;
          width: 100%;
          text-align: center;
          margin-left: auto;
          margin-right: auto;
        }
        .qr-center-wrapper {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
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
          margin: 40px auto 0 auto;
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
          text-decoration: none;
        }
        .download-btn:hover {
          background: linear-gradient(135deg, #1e7e34 0%, #17a2b8 100%);
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(40, 167, 69, 0.4);
          text-decoration: none;
          color: white;
        }
        .download-btn:active {
          transform: translateY(-1px);
          box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
        }
        input {
          width: 100%;
          padding: 16px 18px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 1rem;
          transition: all 0.3s ease;
          box-sizing: border-box;
          background: #ffffff;
          color: #000000;
        }
        input:focus {
          outline: none;
          border-color: #1FA8DC;
          background: white;
          box-shadow: 0 0 0 3px rgba(31, 168, 220, 0.1);
        }
        input::placeholder {
          color: #adb5bd;
        }
        .range-inputs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        @media (max-width: 768px) {
          .qr-container {
            padding: 16px;
            margin: 0 auto;
            max-width: 92vw;
          }
          .qr-center-wrapper {
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-left: auto;
            margin-right: auto;
          }
          .qr-display {
            width: 100%;
            margin-left: auto;
            margin-right: auto;
          }
          .qr-btn {
            padding: 14px 0;
            font-size: 1rem;
          }
          .download-btn {
            width: 100%;
            max-width: 250px;
            margin: 20px auto 0 auto;
          }
          .range-inputs {
            grid-template-columns: 1fr;
            gap: 8px;
          }
          .qr-id-text {
            font-size: 1.2rem;
          }
        }
        @media (max-width: 480px) {
          .qr-container {
            padding: 12px;
            max-width: 92vw;
          }
          .qr-center-wrapper {
            width: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            margin-left: auto;
            margin-right: auto;
          }
          .qr-display {
            width: 100%;
            margin-left: auto;
            margin-right: auto;
          }
          .qr-btn {
            padding: 12px 0;
            font-size: 0.95rem;
          }
          input {
            padding: 14px 16px;
            font-size: 0.95rem;
          }
          .qr-id-text {
            font-size: 1.1rem;
          }
          .download-btn {
            margin: 30px auto 0 auto;
          }
        }
      `}</style>
             <Title>
               <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <Image src="/qrcode.svg" alt="QR Code" width={32} height={32} />
                 QR Code Generator
               </div>
             </Title>
      <button className="qr-btn" onClick={() => setMode("single")}>Single QR Code Generator</button>
      <button className="qr-btn" onClick={() => setMode("many")}>Many QR Codes Generator</button>
      {mode === "single" && (
        <div className="qr-form">
          <label>Enter Student ID (QR Content):</label>
          <input
            type="number"
            value={singleId}
            onChange={e => { setSingleId(e.target.value); setShowQR(false); }}
            placeholder="e.g., 1"
            ref={inputRef}
            min="1"
            step="1"
            onInput={e => {
              // Remove any non-numeric characters
              e.target.value = e.target.value.replace(/[^0-9]/g, '');
            }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                setShowQR(true);
              }
            }}
          />
          <button className="qr-btn" onClick={e => { e.preventDefault(); setShowQR(true); }}>Generate QR</button>
          {showQR && singleId && (
            <div className="qr-center-wrapper">
              <div className="qr-display">
                <div className="qr-container">
                  <QRCode
                    id="single-qr-svg"
                    value={`https://linktr.ee/mr_amgad_elalfy/id=${singleId}`}
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
                  <div className="qr-id-text">{`ID No. ${singleId}`}</div>
                </div>
                <button className="download-btn" onClick={downloadSingleQR} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <Image src="/download.svg" alt="Download" width={20} height={20} />
                  Download QR
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {mode === "many" && (
        <div className="qr-form">
          <label>Enter Range (From - To):</label>
          <div className="range-inputs">
            <input
              type="number"
              value={manyFrom}
              onChange={e => setManyFrom(e.target.value)}
              placeholder="From (e.g., 1)"
              min="1"
              step="1"
              onInput={e => {
                // Remove any non-numeric characters
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
              }}
            />
            <input
              type="number"
              value={manyTo}
              onChange={e => setManyTo(e.target.value)}
              placeholder="To (e.g., 20)"
              min="1"
              step="1"
              onInput={e => {
                // Remove any non-numeric characters
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
              }}
            />
          </div>
          <button className="qr-btn" onClick={e => { e.preventDefault(); generateManyQRCodes(); }} disabled={manyGenerating} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            {manyGenerating ? "Generating..." : (
              <>
                <Image src="/zip-file.svg" alt="ZIP" width={20} height={20} />
                Generate & Download ZIP
              </>
            )}
          </button>
          {zipUrl && (
            <div className="qr-center-wrapper">
              <div className="qr-display">
                <a 
                  href={zipUrl} 
                  download={`QrCodes_From_${manyFrom}_To_${manyTo}.zip`} 
                  className="download-btn"
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  <Image src="/zip-file.svg" alt="Download ZIP" width={20} height={20} />
                  Download ZIP
                </a>
              </div>
            </div>
          )}
          {/* Hidden QR codes for export */}
          <div className="hidden-qr">
            {qrIds.map((id) => (
              <div className="qr-container" key={id}>
                <QRCode
                  id={`hidden-qr-${id}`}
                  value={`https://linktr.ee/mr_amgad_elalfy/?id=${id}`}
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
                <div className="qr-id-text">{`ID No. ${id}`}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </div>
  );
} 