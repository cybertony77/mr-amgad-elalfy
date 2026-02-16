import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

export default function VideoInput({
  index,
  video,
  onVideoNameChange,
  onYouTubeUrlChange,
  onR2Upload,
  onRemove,
  canRemove,
  errors,
  showUploadTab,
}) {
  const [activeTab, setActiveTab] = useState(video.video_source === 'r2' && showUploadTab ? 'upload' : 'youtube');
  const [uploadProgress, setUploadProgress] = useState(video.upload_progress || 0);
  const [uploadStatus, setUploadStatus] = useState(video.upload_status || 'idle'); // idle | uploading | done | error
  const [uploadFileName, setUploadFileName] = useState(video.upload_file_name || '');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);
  const xhrRef = useRef(null);

  // Sync activeTab when video data changes (e.g. edit page loads session data async)
  useEffect(() => {
    if (video.video_source === 'r2' && showUploadTab) {
      setActiveTab('upload');
      setUploadStatus(video.upload_status || (video.r2_key ? 'done' : 'idle'));
      setUploadProgress(video.upload_progress || (video.r2_key ? 100 : 0));
      setUploadFileName(video.upload_file_name || '');
    } else {
      setActiveTab('youtube');
    }
  }, [video.video_source, video.r2_key, showUploadTab]);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    // When switching tabs, clear the other tab's data
    if (tab === 'youtube') {
      // If switching to youtube, clear R2 data
      if (uploadStatus !== 'done') {
        onR2Upload(index, '', '');
      }
    } else {
      // If switching to upload, clear youtube data
      onYouTubeUrlChange(index, '');
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Invalid file type. Please upload a video file (MP4, WebM, OGG, MOV, AVI, MKV).');
      return;
    }

    // Validate file size (max 5GB)
    if (file.size > 5 * 1024 * 1024 * 1024) {
      setUploadError('File size exceeds 5GB limit.');
      return;
    }

    setUploadError('');
    setUploadFileName(file.name);
    setUploadStatus('uploading');
    setUploadProgress(0);

    try {
      // Step 1: Get the R2 key from our API
      const { data } = await axios.post('/api/upload/r2-signed-url', {
        fileName: file.name,
        contentType: file.type,
      });

      const { key } = data;

      // Step 2: Upload via proxy API using FormData (same-origin, no CORS issues).
      // formidable on the server parses the file and uploads it to R2.
      const formData = new FormData();
      formData.append('file', file);
      formData.append('key', key);

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelled'));
        });

        xhr.open('POST', '/api/upload/r2-proxy-upload');
        xhr.send(formData);
      });

      // Step 3: Success - save the R2 key
      setUploadStatus('done');
      setUploadProgress(100);
      onR2Upload(index, key, file.name);

    } catch (error) {
      if (error.message === 'Upload cancelled') {
        setUploadStatus('idle');
        setUploadProgress(0);
        setUploadFileName('');
      } else {
        setUploadStatus('error');
        setUploadError(error.message || 'Upload failed. Please try again.');
      }
    }
  };

  const handleCancelUpload = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
  };

  const handleRemoveUpload = () => {
    setUploadStatus('idle');
    setUploadProgress(0);
    setUploadFileName('');
    setUploadError('');
    onR2Upload(index, '', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const tabStyle = (isActive) => ({
    flex: 1,
    padding: '10px 16px',
    border: 'none',
    borderBottom: isActive ? '3px solid #1FA8DC' : '3px solid transparent',
    backgroundColor: isActive ? '#f0f8ff' : 'transparent',
    color: isActive ? '#1FA8DC' : '#666',
    fontWeight: isActive ? '600' : '400',
    fontSize: '0.95rem',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    borderRadius: '6px 6px 0 0',
  });

  return (
    <div style={{
      marginBottom: '24px',
      padding: '20px',
      border: '2px solid #e9ecef',
      borderRadius: '8px',
      backgroundColor: '#f8f9fa'
    }}>
      {/* Header with Video number and Remove button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, color: '#333' }}>Video {index + 1}</h4>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            style={{
              padding: '6px 12px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '0.875rem',
              cursor: 'pointer'
            }}
          >
            Remove
          </button>
        )}
      </div>

      {/* Tabs - only show if upload is enabled */}
      {showUploadTab && (
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e9ecef',
          marginBottom: '16px',
          gap: '4px',
        }}>
          <button
            type="button"
            onClick={() => handleTabSwitch('youtube')}
            style={tabStyle(activeTab === 'youtube')}
          >
            YouTube
          </button>
          <button
            type="button"
            onClick={() => handleTabSwitch('upload')}
            style={tabStyle(activeTab === 'upload')}
          >
            Upload
          </button>
        </div>
      )}

      {/* Video Name Input - shown in both tabs */}
      <div style={{ marginBottom: '16px' }}>
        <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
          Video Name
        </label>
        <input
          type="text"
          value={video.video_name || ''}
          onChange={(e) => onVideoNameChange(index, e.target.value)}
          placeholder={`Video ${index + 1}`}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid #ddd',
            borderRadius: '6px',
            fontSize: '1rem',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* YouTube Tab Content */}
      {activeTab === 'youtube' && (
        <div style={{ marginBottom: '0' }}>
          <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
            YouTube URL <span style={{ color: 'red' }}>*</span>
          </label>
          <input
            type="text"
            value={video.youtube_url || ''}
            onChange={(e) => onYouTubeUrlChange(index, e.target.value)}
            placeholder="Enter YouTube Video URL"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: errors[`video_${index}_youtube_url`] ? '2px solid #dc3545' : '1px solid #ddd',
              borderRadius: '6px',
              fontSize: '1rem',
              boxSizing: 'border-box'
            }}
          />
          {errors[`video_${index}_youtube_url`] && (
            <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
              {errors[`video_${index}_youtube_url`]}
            </div>
          )}
        </div>
      )}

      {/* Upload Tab Content */}
      {activeTab === 'upload' && showUploadTab && (
        <div>
          <label style={{ display: 'block', marginBottom: '8px', color: '#333', fontWeight: '500' }}>
            Upload Video <span style={{ color: 'red' }}>*</span>
          </label>

          {/* Upload area */}
          {uploadStatus === 'idle' && (
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: errors[`video_${index}_upload`] ? '2px dashed #dc3545' : '2px dashed #ccc',
                borderRadius: '8px',
                padding: '32px 20px',
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: '#fff',
                transition: 'border-color 0.2s ease',
              }}
              onMouseOver={(e) => { if (!errors[`video_${index}_upload`]) e.currentTarget.style.borderColor = '#1FA8DC'; }}
              onMouseOut={(e) => { if (!errors[`video_${index}_upload`]) e.currentTarget.style.borderColor = '#ccc'; }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px', color: '#999' }}>
                +
              </div>
              <div style={{ color: '#666', fontSize: '0.95rem' }}>
                Click to select a video file
              </div>
              <div style={{ color: '#999', fontSize: '0.8rem', marginTop: '4px' }}>
                MP4, WebM, OGG, MOV, AVI, MKV (max 5GB)
              </div>
            </div>
          )}

          {/* Uploading state with progress bar */}
          {uploadStatus === 'uploading' && (
            <div style={{
              border: '2px solid #1FA8DC',
              borderRadius: '8px',
              padding: '20px',
              backgroundColor: '#fff',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <span style={{ color: '#333', fontSize: '0.9rem', fontWeight: '500' }}>
                  Uploading: {uploadFileName}
                </span>
                <button
                  type="button"
                  onClick={handleCancelUpload}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
              {/* Progress bar */}
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  backgroundColor: '#1FA8DC',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <div style={{ textAlign: 'right', marginTop: '6px', color: '#666', fontSize: '0.85rem' }}>
                {uploadProgress}%
              </div>
            </div>
          )}

          {/* Upload done state */}
          {uploadStatus === 'done' && (
            <div style={{
              border: '2px solid #28a745',
              borderRadius: '8px',
              padding: '16px 20px',
              backgroundColor: '#f0fff4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ color: '#28a745', fontWeight: '600', fontSize: '0.9rem' }}>
                  Uploaded successfully
                </div>
                <div style={{ color: '#666', fontSize: '0.85rem', marginTop: '2px' }}>
                  {uploadFileName}
                </div>
              </div>
              <button
                type="button"
                onClick={handleRemoveUpload}
                style={{
                  padding: '6px 12px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          )}

          {/* Upload error state */}
          {uploadStatus === 'error' && (
            <div style={{
              border: '2px solid #dc3545',
              borderRadius: '8px',
              padding: '16px 20px',
              backgroundColor: '#fff5f5',
            }}>
              <div style={{ color: '#dc3545', fontWeight: '500', fontSize: '0.9rem', marginBottom: '8px' }}>
                Upload failed: {uploadError}
              </div>
              <button
                type="button"
                onClick={() => {
                  setUploadStatus('idle');
                  setUploadProgress(0);
                  setUploadFileName('');
                  setUploadError('');
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                style={{
                  padding: '6px 14px',
                  backgroundColor: '#1FA8DC',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          {errors[`video_${index}_upload`] && (
            <div style={{ color: '#dc3545', fontSize: '0.875rem', marginTop: '4px' }}>
              {errors[`video_${index}_upload`]}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
