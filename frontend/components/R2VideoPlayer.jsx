import { useRef, useEffect, useState } from "react";

export default function R2VideoPlayer({ r2Key, videoId, onComplete }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const hasMarkedComplete = useRef(false);

  // Build the streaming URL directly — no API call needed.
  // The browser sends cookies automatically with the <video> GET request,
  // so the API route can authenticate the user.
  const videoUrl = r2Key ? `/api/videos/${r2Key}` : null;

  // Track video progress and mark complete at 90%
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoUrl) return;

    const handleTimeUpdate = () => {
      if (!video.duration || hasMarkedComplete.current) return;
      const percent = (video.currentTime / video.duration) * 100;

      if (percent >= 90) {
        hasMarkedComplete.current = true;
        if (onComplete) {
          onComplete(videoId, percent);
        }
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [videoUrl, videoId, onComplete]);

  // Reset completion flag when video changes
  useEffect(() => {
    hasMarkedComplete.current = false;
    setError(null);
  }, [r2Key]);

  if (!videoUrl) {
    return (
      <div style={{
        width: '100%',
        aspectRatio: '16 / 9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        color: '#fff',
        fontSize: '1rem',
      }}>
        No video available
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        width: '100%',
        aspectRatio: '16 / 9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        color: '#dc3545',
        fontSize: '1rem',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <div>{error}</div>
        <button
          onClick={() => {
            setError(null);
            // Force the video element to reload by remounting
            if (videoRef.current) {
              videoRef.current.load();
            }
          }}
          style={{
            padding: '8px 20px',
            backgroundColor: '#1FA8DC',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '0.9rem',
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={videoUrl}
      controls
      controlsList="nodownload"
      disablePictureInPicture
      playsInline
      onContextMenu={(e) => e.preventDefault()}
      onError={() => setError('Failed to load video. Please try again.')}
      style={{
        width: '100%',
        height: 'auto',
        maxHeight: '100vh',
        aspectRatio: '16 / 9',
        backgroundColor: '#000',
        outline: 'none',
        display: 'block',
      }}
    />
  );
}
