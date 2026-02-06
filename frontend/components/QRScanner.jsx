import { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader } from '@zxing/browser';
import Image from 'next/image';

const QRScanner = ({ onQRCodeScanned, onError }) => {
  const videoRef = useRef(null);
  const codeReaderRef = useRef(null);
  const sessionRef = useRef(0); // 🔑 cancels stale callbacks
  const fileInputRef = useRef(null);

  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState('');
  const [videoReady, setVideoReady] = useState(false);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);

  const extractStudentId = (qrText) => {
    try {
      const url = new URL(qrText);
      const id = url.searchParams.get('id');
      if (id) return id;
    } catch {}
    if (/^\d+$/.test(qrText)) return qrText;
    return null;
  };

  // Check camera support when component mounts
  useEffect(() => {
    const checkCameraSupport = () => {
      const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
      setCameraSupported(supported);
      
      if (!supported) {
        console.log('Camera not supported in this browser. Please use a modern browser with camera support.');
      }
    };
    
    checkCameraSupport();
  }, []);

  const startCameraProcess = async () => {
    const mySession = ++sessionRef.current; // start a fresh session
    try {
      if (!videoRef.current) throw new Error('Video element not available');

      // Check if MediaDevices API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser. Please use a modern browser with camera support.');
      }

      // getUserMedia first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment', 
          width: { ideal: 1280, min: 640 }, 
          height: { ideal: 720, min: 480 } 
        }
      });

      // attach stream
      videoRef.current.srcObject = stream;

      // wait for playback and ensure dimensions are available
      await new Promise((resolve, reject) => {
        const video = videoRef.current;
        const onLoaded = () => {
          // Ensure video has valid dimensions before proceeding
          if (video.videoWidth === 0 || video.videoHeight === 0) {
            reject(new Error('Video dimensions not available'));
            return;
          }
          
          video.play().then(resolve).catch(reject);
        };
        video.onloadedmetadata = onLoaded;
        video.onerror = reject;
        setTimeout(() => reject(new Error('Video loading timeout')), 8000); // Increased timeout
      });

      // Double-check dimensions after loading
      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        throw new Error('Video dimensions could not be determined');
      }

      // create reader with error handling
      try {
        codeReaderRef.current = new BrowserQRCodeReader();
      } catch (readerErr) {
        throw new Error(`Failed to initialize QR reader: ${readerErr.message}`);
      }

      // ⚠️ Mark camera started BEFORE kicking off decode to avoid re-entrancy
      setCameraStarted(true);

      // Start decoding with better error handling
      try {
        codeReaderRef.current.decodeFromVideoElement(
          videoRef.current,
          (result, err) => {
            // Ignore any callbacks from older/aborted sessions
            if (mySession !== sessionRef.current) return;

                        if (result) {
              const text = result.text ?? (result.getText?.() || '');
              const studentId = extractStudentId(text);
              if (studentId) {
                // Only pass valid student IDs to the callback
                onQRCodeScanned?.(studentId);
                stopCamera(); // stop after first valid scan
              } else {
                // QR code doesn't contain a valid student ID - show to user
                setError(`This QR Code Dont Have id Parameter, ${text}`);
              }
            }

            // Handle specific ZXing errors - only log to console, don't show to user
            if (err) {
              if (err.name === 'NotFoundException') {
                // This is normal - no QR code detected yet
                return;
              } else {
                // Log all QR scanning errors to console only
                console.warn('QR scanning warning:', err);
              }
            }
          }
        );
      } catch (decodeErr) {
        throw new Error(`QR decoding failed: ${decodeErr.message}`);
      }
    } catch (err) {
      if (onError) onError(err);
      console.error('Camera error:', err);
      
      // Only show critical permission errors to user, log everything else to console
      if (err.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and try again.');
      } else {
        // Log all other camera errors to console only
        console.warn('Camera initialization warning:', err);
      }
      
      setIsScanning(false);
      setVideoReady(false);
      setCameraStarted(false);
    }
  };

  const startCamera = () => {
    if (!cameraSupported) {
      setError('Camera not supported in this browser. Please use a modern browser with camera support.');
      return;
    }
    
    setError('');
    setIsScanning(true);
    setVideoReady(false);
    setCameraStarted(false);
  };

  const stopCamera = () => {
    // Invalidate any in-flight decode callbacks
    sessionRef.current++;

    try {
      // Stop zxing and release workers
      if (codeReaderRef.current) {
        try { codeReaderRef.current.reset(); } catch {}
        codeReaderRef.current = null;
      }

      // Stop the video stream
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(t => t.stop());
        videoRef.current.srcObject = null;
      }
    } catch (err) {
      console.error('Error stopping camera:', err);
    } finally {
      setIsScanning(false);
      setVideoReady(false);
      setCameraStarted(false);
      setError('');
    }
  };

  const handleUploadClick = () => {
    try {
      setError('');
      if (fileInputRef.current) fileInputRef.current.click();
    } catch (err) {
      console.error('Upload click error:', err);
    }
  };

  const handleFileChange = async (e) => {
    try {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = reader.result;
          const qrReader = new BrowserQRCodeReader();
          const result = await qrReader.decodeFromImageUrl(dataUrl);
          const text = result.text ?? (result.getText?.() || '');
          const studentId = extractStudentId(text);
          if (studentId) {
            onQRCodeScanned?.(studentId);
          } else {
            setError(`This QR Code Dont Have id Parameter, ${text}`);
          }
        } catch (err) {
          console.error('Image decode error:', err);
          setError('Could not decode QR from image');
          if (onError) onError(err);
        } finally {
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('File read error:', err);
      setError('Failed to read the selected file');
    }
  };

  // Mark video ready once available
  useEffect(() => {
    if (isScanning && videoRef.current && !videoReady) setVideoReady(true);
  }, [isScanning, videoReady]);

  // Only start when scanning is on, video is ready and camera not started
  useEffect(() => {
    if (isScanning && videoReady && videoRef.current && !cameraStarted) {
      startCameraProcess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning, videoReady, cameraStarted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-hide error after 5s
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(''), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 24, boxShadow: '0 8px 32px rgba(0,0,0,0.1)', marginBottom: 24 }}>
      {!isScanning ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 300, background: '#f8f9fa', borderRadius: 12, border: '2px dashed #dee2e6', padding: 20, textAlign: 'center', gap: 16 }}>
          <div style={{ color: '#6c757d', fontSize: '1rem', fontWeight: 500, marginBottom: 8, display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}><Image src="/scan2.svg" alt="Scan" width={20} height={20} /> Choose how to scan QR code</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button 
              onClick={startCamera} 
              disabled={!cameraSupported}
              style={{ 
                padding: '16px 45px', 
                border: 'none', 
                borderRadius: 12, 
                fontSize: '1.1rem', 
                fontWeight: '600', 
                cursor: cameraSupported ? 'pointer' : 'not-allowed', 
                transition: 'all 0.3s ease', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                minWidth: 160, 
                justifyContent: 'center', 
                background: cameraSupported 
                  ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' 
                  : 'linear-gradient(135deg, #6c757d 0%, #495057 100%)', 
                color: 'white', 
                boxShadow: cameraSupported 
                  ? '0 4px 16px rgba(40, 167, 69, 0.3)' 
                  : '0 2px 8px rgba(108, 117, 125, 0.2)',
                opacity: cameraSupported ? 1 : 0.6
              }}
            >
              <Image src="/camera2.svg" alt="Camera" width={20} height={20} /> {cameraSupported ? 'Open Camera' : 'Camera Not Supported'}
            </button>
            <button
              onClick={handleUploadClick}
              style={{
                padding: '16px 32px',
                border: 'none',
                borderRadius: 12,
                fontSize: '1.1rem',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 160,
                justifyContent: 'center',
                background: 'linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%)',
                color: 'white',
                boxShadow: '0 4px 16px rgba(31, 168, 220, 0.3)'
              }}
            >
              <Image src="/folder.svg" alt="Upload" width={20} height={20} /> Upload QR Code
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ width: 300, height: 300, margin: '0 auto', borderRadius: 12, overflow: 'hidden', border: '2px solid #e9ecef' }}>
            <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} autoPlay playsInline muted />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', padding: '0 20px' }}>
            <button onClick={stopCamera} style={{ padding: '16px 32px', border: 'none', borderRadius: 12, fontSize: '1.1rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s ease', display: 'flex', alignItems: 'center', gap: 8, minWidth: 160, justifyContent: 'center', background: 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)', color: 'white', boxShadow: '0 4px 16px rgba(220, 53, 69, 0.3)' }}>
              ❌ Stop Camera
            </button>
          </div>
        </div>
      )}

      {error && (
        <div style={{ background: 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)', color: 'white', borderRadius: 10, padding: 16, marginTop: 16, textAlign: 'center', fontWeight: 600, boxShadow: '0 4px 16px rgba(220, 53, 69, 0.3)' }}>
          ❌ {error}
        </div>
      )}
    </div>
  );
};

export default QRScanner;