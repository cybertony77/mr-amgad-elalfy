import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import apiClient from '../lib/axios';
import NeedHelp from '../components/NeedHelp';

// API function to check VAC
const checkVAC = async (account_id, VAC) => {
  if (!account_id || !VAC || VAC.length !== 7) {
    return { exists: false, valid: false };
  }
  try {
    const response = await apiClient.post('/api/auth/check_vac', { account_id, VAC });
    return response.data;
  } catch (error) {
    return { exists: false, valid: false };
  }
};

export default function SignUp() {
  const router = useRouter();
  const [form, setForm] = useState({
    id: '',
    email: '',
    password: '',
    confirmPassword: '',
    vac: ['', '', '', '', '', '', ''],
    profile_picture: null
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const vacInputRefs = useRef([]);

  // VAC check query
  const vacCode = form.vac.join('');
  const { data: vacCheck, isLoading: vacChecking } = useQuery({
    queryKey: ['check-vac', form.id, vacCode],
    queryFn: () => checkVAC(form.id, vacCode),
    enabled: !!form.id && vacCode.length === 7,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Auto-hide messages after 6 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
        router.push('/');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === 'id') {
      // Only allow numbers for ID (account_id)
      const numericValue = value.replace(/[^0-9]/g, '');
      setForm({ ...form, [name]: numericValue });
      // Store in sessionStorage or remove if empty
      if (numericValue) {
        sessionStorage.setItem('student_id', numericValue);
      } else {
        sessionStorage.removeItem('student_id');
      }
    } else if (name === 'password') {
      setForm({ ...form, [name]: value });
      // Store in sessionStorage or remove if empty
      if (value) {
        sessionStorage.setItem('student_password', value);
      } else {
        sessionStorage.removeItem('student_password');
      }
    } else {
      setForm({ ...form, [name]: value });
    }
    setError('');
  };

  const handleVACChange = (e, index) => {
    const rawValue = e.target.value;
    const value = rawValue.replace(/[^a-zA-Z0-9]/g, '');

    if (!value) {
      const newVac = [...form.vac];
      newVac[index] = '';
      setForm({ ...form, vac: newVac });
      return;
    }

    const newVac = [...form.vac];

    // 🔥 If full code pasted into first input
    if (value.length >= 7 && index === 0) {
      const chars = value.slice(0, 7).split('');
      setForm({ ...form, vac: chars });

      setTimeout(() => {
        const lastInput = document.querySelector(`input[name="vac-6"]`);
        if (lastInput) lastInput.focus();
      }, 0);

      return;
    }

    // 🔥 If multiple characters pasted (partial paste)
    if (value.length > 1) {
      for (let i = 0; i < value.length && index + i < 7; i++) {
        newVac[index + i] = value[i];
      }

      setForm({ ...form, vac: newVac });

      const nextIndex = Math.min(index + value.length, 6);
      setTimeout(() => {
        const nextInput = document.querySelector(`input[name="vac-${nextIndex}"]`);
        if (nextInput) nextInput.focus();
      }, 0);

      return;
    }

    // Normal single character
    newVac[index] = value;
    setForm({ ...form, vac: newVac });

    if (index < 6) {
      const nextInput = document.querySelector(`input[name="vac-${index + 1}"]`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleVACPaste = (e, index) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const sanitized = pastedText.replace(/[^a-zA-Z0-9]/g, '').slice(0, 7);
    if (sanitized.length === 0) return;

    const newVac = [...form.vac];
    const startIdx = sanitized.length === 7 ? 0 : index;
    for (let i = 0; i < sanitized.length && (startIdx + i) < 7; i++) {
      newVac[startIdx + i] = sanitized[i];
    }
    setForm({ ...form, vac: newVac });
    setError('');
    const lastIndex = Math.min(startIdx + sanitized.length - 1, 6);
    vacInputRefs.current[lastIndex]?.focus();
  };

  const handleKeyDown = (e, index) => {
    if (e.key === 'Backspace' && !form.vac[index] && index > 0) {
      vacInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      vacInputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 6) {
      vacInputRefs.current[index + 1]?.focus();
    }
  };

  const processImageFile = async (file) => {
    if (!file) {
      setImagePreview(null);
      setForm({ ...form, profile_picture: null });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('❌ Please select an image file');
      return;
    }

    // Validate file size (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('❌ Sorry, Max profile picture size is 5 MB, Please try another picture');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload to Cloudinary
    setUploadingImage(true);
    setError('');
    
    try {
      // Convert file to base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await apiClient.post('/api/upload/profile-picture', {
        file: base64,
        fileName: file.name,
        fileType: file.type
      });

      console.log('Upload response:', response.data);

      if (response.data.success && response.data.public_id) {
        console.log('Profile picture uploaded, public_id:', response.data.public_id);
        setForm({ ...form, profile_picture: response.data.public_id });
      } else {
        console.error('Upload failed - invalid response:', response.data);
        throw new Error('Upload failed');
      }
    } catch (err) {
      setError(err.response?.data?.error || '❌ Failed to upload image. Please try again.');
      setImagePreview(null);
      setForm({ ...form, profile_picture: null });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    await processImageFile(file);
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploadingImage) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (uploadingImage) return;

    const file = e.dataTransfer.files?.[0];
    await processImageFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation
    if (!form.id || !form.password || !form.confirmPassword) {
      setError('❌ All fields are required');
      return;
    }

    if (!form.email || form.email.trim() === '') {
      setError('❌ Email is required');
      return;
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      setError('❌ Please enter a valid email address');
      return;
    }

    if (form.vac.some(char => !char)) {
      setError('❌ Please enter the complete verification account code');
      return;
    }

    if (form.password.length < 8) {
      setError('❌ Password must be at least 8 characters');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('❌ Password and confirm password do not match');
      return;
    }

    // Check VAC validity
    if (!vacCheck || !vacCheck.valid) {
      setError('❌ Invalid verification code. Please check your account ID and code.');
      return;
    }

    if (vacCheck.activated) {
      setError('❌ This verification code has already been used');
      return;
    }

    // Wait for image upload to complete if it's in progress
    if (uploadingImage) {
      setError('❌ Please wait for image upload to complete');
      return;
    }

    // Submit sign up
    setIsSubmitting(true);
    try {
      const signupData = {
        id: form.id.trim(),
        email: form.email.trim(),
        password: form.password,
        account_id: form.id,
        VAC: form.vac.join('')
      };

      // Only include profile_picture if it exists and is not empty
      if (form.profile_picture && typeof form.profile_picture === 'string' && form.profile_picture.trim() !== '') {
        signupData.profile_picture = form.profile_picture.trim();
        console.log('Including profile_picture in signup:', signupData.profile_picture);
      } else {
        console.log('No profile_picture to include. Current value:', form.profile_picture);
      }

      console.log('Signup data being sent:', { ...signupData, password: '***' });
      const response = await apiClient.post('/api/auth/signup', signupData);

      setSuccess('✅ Account created successfully!');
      // Wait 2 seconds before redirecting to login page
      setTimeout(() => {
        router.push('/');
      },2000);
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Failed to create account';
      setError(`❌ ${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      width: '100%',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '20px 5px 20px 5px',
    }}>
      <style jsx>{`
        .signup-container {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          max-width: 500px;
          width: 100%;
          position: relative;
          overflow: hidden;
        }
        .signup-container::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg,rgba(189, 189, 189, 1) 0%, rgba(119, 214, 224, 1) 50%, rgba(8, 156, 170, 1) 100%);
          background-size: 200% 100%;
          animation: gradientShift 3s ease infinite;
        }
        @keyframes gradientShift {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .logo-section {
          text-align: center;
          margin-bottom: 32px;
        }
        .logo-icon {
          width: 80px;
          height: 80px;
          margin-bottom: 16px;
          border-radius: 50%;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          object-fit: cover;
          background: transparent;
        }
        .title {
          font-size: 2.2rem;
          font-weight: 700;
          color: rgb(0, 0, 0);
          margin-bottom: 8px;
        }
        .subtitle {
          color: #6c757d;
          font-size: 1rem;
          margin-bottom: 0;
        }
        .form-group {
          margin-bottom: 24px;
        }
        .form-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #495057;
          font-size: 0.95rem;
        }
        .form-input {
          width: 100%;
          padding: 16px 20px;
          border: 2px solid #e9ecef;
          border-radius: 12px;
          font-size: 1rem;
          transition: all 0.3s ease;
          box-sizing: border-box;
          background: #ffffff;
          color: #000000;
        }
        .form-input:focus {
          outline: none;
          border-color: #87CEEB;
          box-shadow: 0 0 0 4px rgba(135, 206, 235, 0.1);
          transform: translateY(-2px);
        }
        .form-input.error-border {
          border-color: #dc3545 !important;
          box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1) !important;
        }
        .vac-inputs-container {
          display: flex;
          gap: 8px;
          justify-content: center;
        }
        .vac-input {
          width: 45px;
          height: 55px;
          text-align: center;
          font-size: 1.5rem;
          font-weight: 700;
          border: 2px solid #87CEEB;
          border-radius: 10px;
          background: #f8f9fa;
          color: #333;
          transition: all 0.3s ease;
          box-shadow: 0 2px 6px rgba(135, 206, 235, 0.2);
          outline: none;
        }
        .vac-input:focus {
          outline: none;
          border-color: #1FA8DC;
          box-shadow: 0 0 0 4px rgba(31, 168, 220, 0.2);
          background: #ffffff;
          transform: scale(1.05);
        }
        .vac-input.error-border {
          border-color: #dc3545 !important;
          box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.1) !important;
        }
        .vac-input.error-border:focus {
          border-color: #dc3545 !important;
          box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.1) !important;
        }
        .vac-feedback {
          margin-top: 8px;
          font-size: 0.85rem;
          font-weight: 500;
        }
        .vac-feedback.checking {
          color: #17a2b8;
        }
        .vac-feedback.valid {
          color: #28a745;
        }
        .vac-feedback.invalid {
          color: #dc3545;
        }
        .input-wrapper {
          position: relative;
        }
        .signup-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(90deg, #5F6DFE 0%, #6A82FB 100%);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 8px 24px rgba(95, 109, 254, 0.3);
        }
        .signup-btn:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(95, 109, 254, 0.4);
        }
        .signup-btn:active {
          transform: translateY(-1px);
        }
        .signup-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (max-width: 480px) {
          .signup-container {
            padding: 30px 20px;
            margin: 10px;
          }
          .title {
            font-size: 1.8rem;
          }
          .vac-input {
            width: 40px;
            height: 50px;
            font-size: 1.3rem;
          }
        }
        @media (max-height: 700px) {
          .signup-container {
            margin: 20px auto;
          }
        }
      `}</style>

      <div className="signup-container">
        <div className="logo-section">
          <Image src="/logo.png" alt="Logo" width={90} height={90} className="logo-icon" style={{ borderRadius: '50px' }} priority />
          <h1 className="title">Sign Up</h1>
          <p className="subtitle">Create new student account</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Profile Picture Upload */}
          <div className="form-group">
            <label className="form-label">Profile Picture</label>
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px'
            }}>
              {form.profile_picture && imagePreview ? (
                // Show uploaded image in circle
                <div
                  style={{
                    position: 'relative',
                    display: 'inline-block'
                  }}
                >
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className="profile-picture-container"
                    style={{
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      background: '#e9ecef',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isDragging ? '0 4px 16px rgba(31,168,220,0.4)' : '0 2px 8px rgba(31,168,220,0.15)',
                      border: isDragging ? '3px dashed #1FA8DC' : '2px solid #1FA8DC',
                      overflow: 'hidden',
                      position: 'relative',
                      transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                      transition: 'all 0.3s ease'
                    }}
                    title="Drag & drop new image"
                  >
                    <img
                      src={imagePreview}
                      alt="Profile preview"
                      className="profile-picture-image"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius: '50%'
                      }}
                    />
                  </div>
                  {/* Trash button in bottom right */}
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setForm({ ...form, profile_picture: null });
                      const fileInput = document.getElementById('profile-picture-upload');
                      if (fileInput) fileInput.value = '';
                    }}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      width: 36,
                      height: 36,
                      borderRadius: '50%',
                      background: '#dc3545',
                      border: '2px solid white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      transition: 'all 0.2s ease',
                      zIndex: 10
                    }}
                    onMouseEnter={(e) => {
                      e.target.style.transform = 'scale(1.1)';
                      e.target.style.boxShadow = '0 4px 12px rgba(220, 53, 69, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.transform = 'scale(1)';
                      e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
                    }}
                    title="Remove image"
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </div>
              ) : (
                // Show upload button when no image
                <label
                  htmlFor="profile-picture-upload"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: '50%',
                    background: uploadingImage 
                      ? 'linear-gradient(135deg, #6c757d 0%, #495057 100%)' 
                      : isDragging
                      ? 'linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%)'
                      : 'linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: uploadingImage ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    fontSize: '0.9rem',
                    textAlign: 'center',
                    transition: 'all 0.3s ease',
                    boxShadow: isDragging ? '0 6px 20px rgba(31, 168, 220, 0.5)' : '0 4px 12px rgba(135, 206, 235, 0.3)',
                    opacity: uploadingImage ? 0.7 : 1,
                    border: isDragging ? '3px dashed white' : '2px solid #1FA8DC',
                    flexDirection: 'column',
                    gap: '8px',
                    transform: isDragging ? 'scale(1.05)' : 'scale(1)'
                  }}
                  onMouseEnter={(e) => {
                    if (!uploadingImage) {
                      e.target.style.transform = 'translateY(-2px)';
                      e.target.style.boxShadow = '0 6px 16px rgba(135, 206, 235, 0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!uploadingImage) {
                      e.target.style.transform = 'translateY(0)';
                      e.target.style.boxShadow = '0 4px 12px rgba(135, 206, 235, 0.3)';
                    }
                  }}
                >
                  {uploadingImage ? (
                    <>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        border: '3px solid rgba(255,255,255,0.3)',
                        borderTop: '3px solid white',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }} />
                      <span style={{ fontSize: '0.75rem' }}>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <Image src="/upload.svg" alt="Upload" width={32} height={32} style={{ filter: 'brightness(0) invert(1)' }} />
                      <span style={{ fontSize: '0.75rem' }}>Upload Picture</span>
                    </>
                  )}
                </label>
              )}
              <input
                id="profile-picture-upload"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={uploadingImage}
                style={{ display: 'none' }}
              />
              <small style={{ color: '#6c757d', fontSize: '0.85rem', textAlign: 'center', marginTop: '4px' }}>
                Max size: 5 MB. Formats: JPEG, PNG, GIF, WEBP
              </small>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">ID <span style={{color: 'red'}}>*</span></label>
            <input
              className="form-input"
              name="id"
              type="text"
              placeholder="Enter your ID"
              value={form.id}
              onChange={handleChange}
              onKeyDown={(e) => {
                if (e.key === ' ') {
                  e.preventDefault();
                }
              }}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email <span style={{color: 'red'}}>*</span></label>
            <input
              className="form-input"
              name="email"
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password <span style={{color: 'red'}}>*</span></label>
            <div className="input-wrapper">
              <input
                className="form-input"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter password (min 8 characters)"
                value={form.password}
                onChange={handleChange}
                style={{ paddingRight: '50px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img 
                  src={showPassword ? "/hide.svg" : "/show.svg"} 
                  alt={showPassword ? "Hide password" : "Show password"}
                  style={{ width: '20px', height: '20px' }}
                />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password <span style={{color: 'red'}}>*</span></label>
            <div className="input-wrapper">
              <input
                className="form-input"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={form.confirmPassword}
                onChange={handleChange}
                style={{ paddingRight: '50px' }}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img 
                  src={showConfirmPassword ? "/hide.svg" : "/show.svg"} 
                  alt={showConfirmPassword ? "Hide password" : "Show password"}
                  style={{ width: '20px', height: '20px' }}
                />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Verification Account Code (VAC) <span style={{color: 'red'}}>*</span></label>
            <div className="vac-inputs-container">
              {form.vac.map((char, index) => (
                <input
                  key={index}
                  ref={(el) => (vacInputRefs.current[index] = el)}
                  name={`vac-${index}`}
                  className={`vac-input ${!vacChecking && vacCheck && !vacCheck.valid && form.id && form.vac.join('').length === 7 ? 'error-border' : ''}`}
                  type="text"
                  autoComplete="one-time-code"
                  inputMode="text"
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={char}
                  onChange={(e) => handleVACChange(e, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onPaste={(e) => handleVACPaste(e, index)}
                  onFocus={(e) => {
                    if (!e.target.classList.contains('error-border')) {
                      e.target.style.borderColor = '#1FA8DC';
                      e.target.style.boxShadow = '0 0 0 4px rgba(31, 168, 220, 0.2)';
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.transform = 'scale(1.05)';
                    }
                  }}
                  onBlur={(e) => {
                    const hasError = !vacChecking && vacCheck && !vacCheck.valid && form.id && form.vac.join('').length === 7;
                    e.target.style.borderColor = hasError ? '#dc3545' : '#87CEEB';
                    e.target.style.boxShadow = hasError ? '0 0 0 2px rgba(220, 53, 69, 0.1)' : '0 2px 6px rgba(135, 206, 235, 0.2)';
                    e.target.style.backgroundColor = '#f8f9fa';
                    e.target.style.transform = 'scale(1)';
                  }}
                  required
                />
              ))}
            </div>
            {/* VAC validation feedback */}
            {form.id && form.vac.join('').length === 7 && (
              <div>
                {vacChecking && (
                  <div className="vac-feedback checking">
                    🔍 Checking verification code...
                  </div>
                )}
                {!vacChecking && vacCheck && (
                  <>
                    {vacCheck.activated && vacCheck.valid && (
                      <div className="vac-feedback invalid">
                        ❌ This account is already exists
                      </div>
                    )}
                    {vacCheck.activated && !vacCheck.valid && (
                      <div className="vac-feedback invalid">
                        ❌ Verification account code is incorrect
                      </div>
                    )}
                    {!vacCheck.activated && vacCheck.valid && (
                      <div className="vac-feedback valid">
                        ✅ Verification code is valid
                      </div>
                    )}
                    {!vacCheck.activated && !vacCheck.valid && vacCheck.exists && (
                      <div className="vac-feedback invalid">
                        ❌ Verification account code is incorrect
                      </div>
                    )}
                    {!vacCheck.exists && (
                      <div className="vac-feedback invalid">
                        ❌ ID not found
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Error and Success Messages */}
          {error && (
            <div style={{
              marginBottom: '16px',
              background: 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
              color: 'white',
              borderRadius: '10px',
              padding: '16px 24px',
              boxShadow: '0 4px 16px rgba(220, 53, 69, 0.3)',
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '1rem'
            }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              marginBottom: '16px',
              background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)',
              color: 'white',
              borderRadius: '10px',
              padding: '16px 24px',
              boxShadow: '0 4px 16px rgba(40, 167, 69, 0.3)',
              textAlign: 'center',
              fontWeight: 600,
              fontSize: '1rem'
            }}>
              {success}
            </div>
          )}

          <button 
            type="submit" 
            className="signup-btn"
            disabled={vacChecking || (vacCheck && !vacCheck.valid) || isSubmitting}
          >
            {isSubmitting ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '3px solid rgba(255, 255, 255, 0.3)',
                  borderTop: '3px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }}></div>
                <span>Creating Account...</span>
              </div>
            ) : (
              'Sign Up'
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.95rem', color: '#495057' }}>
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              router.push('/');
            }}
            style={{
              color: '#007bff',
              textDecoration: 'none',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
          >
            <i className="fa fa-sign-in" aria-hidden="true" style={{ marginRight: '6px' }}></i>
            Back to login page
          </a>
          <NeedHelp />
        </div>
      </div>
    </div>
  );
}

