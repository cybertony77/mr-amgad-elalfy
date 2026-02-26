import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import { TextInput, PasswordInput, Anchor, Group, Text, Modal } from '@mantine/core';
import { FloatingLabelInput } from '../components/FloatingLabelInput';
import { useLogin } from '../lib/api/auth';
import NeedHelp from '../components/NeedHelp';

export default function Login() {
  const [assistant_id, setAssistantId] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [redirectMessage, setRedirectMessage] = useState("");
  const [otpPopupOpen, setOtpPopupOpen] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '', '', '']);
  const [otpError, setOtpError] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [devToolsDetected, setDevToolsDetected] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const router = useRouter();
  
  // React Query login mutation
  const loginMutation = useLogin();

  // Initialize device_id for this browser (only persist later for non-developers)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      let storedId = localStorage.getItem('mr_amgad_elalfy_device_id');
      if (storedId) {
        // Reuse existing device id if it was previously stored (non-developer login)
        setDeviceId(storedId);
      } else {
        // Generate an in-memory device id candidate; will only be saved
        // to localStorage after a successful non-developer login
        let generatedId;
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
          generatedId = window.crypto.randomUUID();
        } else {
          generatedId = `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        }
        setDeviceId(generatedId);
      }
    } catch (e) {
      // If localStorage is unavailable, fall back to an in-memory id
      const fallbackId = `dev-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      setDeviceId(fallbackId);
    }
  }, []);

  // DevTools detection on login page (show for ALL users including developers)
  useEffect(() => {
    let checkInterval;
    
    // Check user role (but don't skip detection for developers on login page)
    const checkUserRole = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include'
        });
        if (response.ok) {
          const userData = await response.json();
          setUserRole(userData.role);
        }
      } catch (error) {
        // Ignore errors - user not logged in yet
      }
      
      // Run devtools detection for ALL users on login page
      const detectDevTools = () => {
        const widthDiff = window.outerWidth - window.innerWidth;
        const heightDiff = window.outerHeight - window.innerHeight;
        
        if (widthDiff > 160 || heightDiff > 160) {
          setDevToolsDetected(true);
          return;
        }

        const consoleStart = performance.now();
        console.log('%c', '');
        const consoleEnd = performance.now();
        
        if (consoleEnd - consoleStart > 1) {
          setDevToolsDetected(true);
          return;
        }

        setDevToolsDetected(false);
      };

      // Start detection for all users
      checkInterval = setInterval(detectDevTools, 500);
      detectDevTools();
    };
    
    checkUserRole();

    return () => {
      if (checkInterval) {
        clearInterval(checkInterval);
      }
    };
  }, []);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  useEffect(() => {
    if (forgotMsg) {
      const timer = setTimeout(() => setForgotMsg("") , 5000);
      return () => clearTimeout(timer);
    }
  }, [forgotMsg]);

  useEffect(() => {
    if (otpError) {
      const timer = setTimeout(() => setOtpError(""), 6000);
      return () => clearTimeout(timer);
    }
  }, [otpError]);

  useEffect(() => {
    // Load ID and password from sessionStorage
    const storedId = sessionStorage.getItem('student_id');
    const storedPassword = sessionStorage.getItem('student_password');
    
    if (storedId) {
      setAssistantId(storedId);
    }
    if (storedPassword) {
      setPassword(storedPassword);
    }

    // Check if user is already authenticated by making a request to the server
    const checkAuthStatus = async () => {
      try {
        // Make a request to check authentication status
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          credentials: 'include' // This will include HttpOnly cookies
        });
        
        if (response.ok) {
          const userData = await response.json();
          // User is authenticated, redirect based on role
          if (userData.role === 'student') {
            window.location.href = "/student_dashboard";
          } else {
            window.location.href = "/dashboard";
          }
          return;
        }
        // If response is not ok (401 or other), user is not authenticated, stay on login page
        // Don't log 401 errors as they're expected for unauthenticated users
      } catch (error) {
        // Error checking auth status, stay on login page
        // Suppress console errors for expected 401 responses
        if (error.name !== 'TypeError' || !error.message.includes('fetch')) {
        console.log('Auth check failed:', error);
        }
      }
    };

    // Check authentication status
    checkAuthStatus();

    // Load username/id and password from sessionStorage (from forgot password page)
    if (typeof window !== 'undefined') {
      const savedUsername = sessionStorage.getItem('forgot_password_username');
      const savedPassword = sessionStorage.getItem('forgot_password_password');
      
      if (savedUsername) {
        setAssistantId(savedUsername);
      }
      if (savedPassword) {
        setPassword(savedPassword);
      }
    }

    // Check if user was redirected from a protected page
    const cookies = document.cookie.split(';');
    const redirectCookie = cookies.find(cookie => cookie.trim().startsWith('redirectAfterLogin='));
    const redirectPath = redirectCookie ? redirectCookie.split('=')[1] : null;
    
    if (redirectPath && redirectPath !== "/" && redirectPath !== "/dashboard") {
      setRedirectMessage(`You must log in first to access: ${redirectPath}`);
    }
  }, []);

  useEffect(() => {
    if (redirectMessage) {
      const timer = setTimeout(() => setRedirectMessage(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [redirectMessage]);

  useEffect(() => {
    if (usernameError) {
      const timer = setTimeout(() => setUsernameError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [usernameError]);

  useEffect(() => {
    if (passwordError) {
      const timer = setTimeout(() => setPasswordError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [passwordError]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // Check resend_expiration from database when OTP popup opens
  useEffect(() => {
    const checkResendExpiration = async () => {
      if (!otpPopupOpen || !assistant_id || assistant_id.trim() === '') return;

      try {
        const response = await fetch('/api/auth/forgot-password/check-resend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: assistant_id.trim() })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.resend_expiration) {
            const expiration = new Date(data.resend_expiration);
            const now = new Date();
            const secondsRemaining = Math.max(0, Math.floor((expiration - now) / 1000));
            setResendCooldown(secondsRemaining);
          }
        }
      } catch (error) {
        console.error('Failed to check resend expiration:', error);
      }
    };

    checkResendExpiration();
  }, [otpPopupOpen, assistant_id]);

  const handleForgotPassword = async () => {
    if (!assistant_id || assistant_id.trim() === '') {
      setForgotMsg('Please Enter username or ID first');
      return;
    }

    // First, check if user exists and get resend_expiration status
    try {
      setIsSendingOtp(true);
      setOtpError('');
      setForgotMsg('');
      
      // Check user and resend expiration status
      const checkResponse = await fetch('/api/auth/forgot-password/check-resend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assistant_id.trim() })
      });
      
      const checkData = await checkResponse.json();
      
      if (!checkResponse.ok) {
        if (checkResponse.status === 404) {
          setForgotMsg('ACCOUNT_NOT_FOUND');
        } else {
          setForgotMsg(checkData.error || 'Failed to check user');
        }
        setIsSendingOtp(false);
        return;
      }

      // Check if we can send OTP (only if resend_expiration is null or has passed)
      const now = new Date();
      let canSendOtp = true;
      let secondsRemaining = 0;
      
      if (checkData.resend_expiration) {
        const expiration = new Date(checkData.resend_expiration);
        secondsRemaining = Math.max(0, Math.floor((expiration - now) / 1000));
        // Only allow sending if expiration has passed
        canSendOtp = expiration < now;
      }
      
      // Set cooldown timer
      setResendCooldown(secondsRemaining);
      
      // Open OTP popup
      setOtpPopupOpen(true);
      setOtp(['', '', '', '', '', '', '', '']);
      setForgotMsg('');
      
      // Only send OTP if resend_expiration is null or has passed
      if (canSendOtp) {
        console.log('📤 Sending OTP request for ID:', assistant_id.trim());
        
        const response = await fetch('/api/auth/forgot-password/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: assistant_id.trim() })
        });
        
        const data = await response.json();
        
        console.log('📥 OTP response:', { status: response.status, data });
        
        if (response.ok && data.success) {
          // Update resend cooldown from response
          if (data.resend_expiration) {
            const expiration = new Date(data.resend_expiration);
            const now = new Date();
            const secondsRemaining = Math.max(0, Math.floor((expiration - now) / 1000));
            setResendCooldown(secondsRemaining);
          }
        } else {
          // Handle error - show generic message for email sending errors
          console.error('❌ OTP send error:', data.error || data.details || 'Failed to send OTP');
          if (data.resend_expiration) {
            // Update cooldown even if email wasn't sent
            const expiration = new Date(data.resend_expiration);
            const now = new Date();
            const secondsRemaining = Math.max(0, Math.floor((expiration - now) / 1000));
            setResendCooldown(secondsRemaining);
          }
          setOtpError('Sorry, there was a problem sending the email. Please try again later.');
        }
      } else {
        // Cooldown is still active, don't send OTP but show message
        setOtpError("Please wait before requesting a new OTP.");
      }
    } catch (error) {
      console.error('❌ OTP send exception:', error);
      setOtpError('Sorry, there was a problem sending the email. Please try again later.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleOtpChange = (index, value) => {
    const rawValue = value;
    const sanitized = rawValue.replace(/[^0-9]/g, '');

    if (!sanitized) {
      const newOtp = [...otp];
      newOtp[index] = '';
      setOtp(newOtp);
      setOtpError('');
      return;
    }

    const newOtp = [...otp];

    // 🔥 If full code pasted into first input
    if (sanitized.length >= 8 && index === 0) {
      const digits = sanitized.slice(0, 8).split('');
      setOtp(digits);
      setOtpError('');

      setTimeout(() => {
        const lastInput = document.querySelector(`input[name="otp-7"]`);
        if (lastInput) lastInput.focus();
      }, 0);

      return;
    }

    // 🔥 If multiple characters pasted (partial paste)
    if (sanitized.length > 1) {
      for (let i = 0; i < sanitized.length && index + i < 8; i++) {
        newOtp[index + i] = sanitized[i];
      }

      setOtp(newOtp);
      setOtpError('');

      const nextIndex = Math.min(index + sanitized.length, 7);
      setTimeout(() => {
        const nextInput = document.querySelector(`input[name="otp-${nextIndex}"]`);
        if (nextInput) nextInput.focus();
      }, 0);

      return;
    }

    // Normal single character
    newOtp[index] = sanitized;
    setOtp(newOtp);
    setOtpError('');

    if (index < 7) {
      const nextInput = document.querySelector(`input[name="otp-${index + 1}"]`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleOtpPaste = (e, index) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    const sanitized = pastedText.replace(/[^0-9]/g, '').slice(0, 8);
    if (sanitized.length === 0) return;

    const newOtp = [...otp];
    const startIdx = sanitized.length === 8 ? 0 : index;
    for (let i = 0; i < sanitized.length && (startIdx + i) < 8; i++) {
      newOtp[startIdx + i] = sanitized[i];
    }
    setOtp(newOtp);
    setOtpError('');
    const lastIndex = Math.min(startIdx + sanitized.length - 1, 7);
    setTimeout(() => {
      const lastInput = document.querySelector(`input[name="otp-${lastIndex}"]`);
      if (lastInput) lastInput.focus();
    }, 0);
  };

  const handleOtpKeyDown = (e, index) => {
    // Handle Enter key to verify OTP
    if (e.key === 'Enter') {
      e.preventDefault();
      const otpCode = otp.join('');
      if (otpCode.length === 8 && !isVerifyingOtp) {
        handleVerifyOtp();
      }
      return;
    }
    // Handle backspace to move to previous input
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.querySelector(`input[name="otp-${index - 1}"]`);
      if (prevInput) prevInput.focus();
    }
    // Handle arrow keys
    else if (e.key === 'ArrowLeft' && index > 0) {
      const prevInput = document.querySelector(`input[name="otp-${index - 1}"]`);
      if (prevInput) prevInput.focus();
    } else if (e.key === 'ArrowRight' && index < 7) {
      const nextInput = document.querySelector(`input[name="otp-${index + 1}"]`);
      if (nextInput) nextInput.focus();
    }
    // Auto-advance to next input on character entry
    else if (e.key !== 'Backspace' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && otp[index] && index < 7) {
      const nextInput = document.querySelector(`input[name="otp-${index + 1}"]`);
      if (nextInput) nextInput.focus();
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    
    try {
      setIsSendingOtp(true);
      setOtpError('');
      
      const response = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: assistant_id.trim() })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Set cooldown from database resend_expiration
        if (data.resend_expiration) {
          const expiration = new Date(data.resend_expiration);
          const now = new Date();
          const secondsRemaining = Math.max(0, Math.floor((expiration - now) / 1000));
          setResendCooldown(secondsRemaining);
        } else {
          setResendCooldown(180); // 3 minutes = 180 seconds (fallback)
        }
        setOtpError('');
      } else {
        // Show generic message for email sending errors
        setOtpError('Sorry, there was a problem sending the email. Please try again later.');
      }
    } catch (error) {
      // Show generic message for email sending errors
      setOtpError('Sorry, there was a problem sending the email. Please try again later.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 8) {
      setOtpError('Please enter the complete OTP code');
      return;
    }

    setIsVerifyingOtp(true);
    setOtpError('');

    try {
      const response = await fetch('/api/auth/forgot-password/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          id: assistant_id.trim(),
          otp: otpCode
        })
      });

      const data = await response.json();

      if (response.ok) {
        // OTP verified, redirect to forgot password page with HMAC signature
        setOtpPopupOpen(false);
        const sig = data.sig; // HMAC signature from server
        router.push(`/forgot_password?id=${encodeURIComponent(assistant_id.trim())}&sig=${encodeURIComponent(sig)}`);
      } else {
        setOtpError(data.error || 'Invalid OTP');
      }
    } catch (error) {
      setOtpError('Failed to verify OTP. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage("");
    setUsernameError("");
    setPasswordError("");

    // Trim whitespaces from username before sending
    const trimmedUsername = assistant_id.trim();
    // If it's a pure numeric ID, send it as a Number (e.g. 1, not "1")
    const assistantIdForRequest = /^\d+$/.test(trimmedUsername)
      ? Number(trimmedUsername)
      : trimmedUsername;

    loginMutation.mutate(
      { assistant_id: assistantIdForRequest, password, device_id: deviceId || null },
      {
        onSuccess: (data) => {
          // Set user role for devtools check
          setUserRole(data.role);
          
          // Persist device_id only for non-developer roles
          if (typeof window !== 'undefined') {
            try {
              if (data.role !== 'developer' && deviceId) {
                localStorage.setItem('mr_amgad_elalfy_device_id', deviceId);
              }
            } catch (e) {
              // Ignore storage errors
            }
          }
          
          // Remove all sessionStorage items after successful login
          if (typeof window !== 'undefined') {
            sessionStorage.removeItem('student_id');
            sessionStorage.removeItem('student_password');
            sessionStorage.removeItem('forgot_password_username');
            sessionStorage.removeItem('forgot_password_password');
          }
          
          // Check if there's a redirect path saved in cookies
          const cookies = document.cookie.split(';');
          const redirectCookie = cookies.find(cookie => cookie.trim().startsWith('redirectAfterLogin='));
          const redirectPath = redirectCookie ? redirectCookie.split('=')[1] : null;
          
          // Determine redirect destination based on role
          const userRole = data.role;
          const defaultDashboard = userRole === 'student' ? '/student_dashboard' : '/dashboard';
          
          // Small delay to ensure token is stored and auth state updates
          setTimeout(() => {
            if (redirectPath && redirectPath !== "/" && redirectPath !== "/dashboard" && redirectPath !== "/student_dashboard") {
              // Clear the redirect cookie and redirect to intended page
              document.cookie = "redirectAfterLogin=; path=/; max-age=0";
              // Use window.location for more reliable redirect
              window.location.href = redirectPath;
            } else {
              // Default redirect based on role
              window.location.href = defaultDashboard;
            }
          }, 100);
        },
        onError: (err) => {
          if (err.response?.data?.error === 'user_not_found') {
            // Check if the input is numeric (ID)
            if (/^\d+$/.test(trimmedUsername)) {
              setMessage("ACCOUNT_NOT_FOUND_SIGNUP"); // Special marker for numeric ID not found
            } else {
              setMessage("Wrong username, ID and password");
            }
          } else if (err.response?.data?.error === 'wrong_password') {
            setPasswordError("Wrong password");
          } else if (err.response?.data?.error === 'account_deactivated') {
            setMessage("Access unavailable: This account is deactivated. Please contact Tony Joseph (developer).");
          } else if (err.response?.data?.error === 'student_account_deactivated') {
            setMessage("student_account_deactivated"); // Special marker for custom rendering
          } else if (err.response?.data?.error === 'device_limit_reached') {
            setMessage("device_limit_reached");
          } else if (err.response?.data?.error === 'subscription_inactive' || err.response?.data?.error === 'subscription_expired') {
            setMessage(err.response?.data?.message || "Access unavailable: Subscription expired. Please contact Tony Joseph (developer) to renew.");
          } else {
            setMessage("Wrong username, ID and password");
          }
        }
      }
    );
  };

  return (
    <div style={{ 
      height: '100vh',
      width: '100vw',
      position: 'fixed',
      top: 0,
      left: 0,
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '20px 5px 20px 5px',
      background: 'linear-gradient(90deg,rgba(158, 158, 158, 1) 0%, rgba(99, 191, 191, 1) 50%, rgba(8, 156, 170, 1) 100%)'
    }}>
        <style jsx>{`
          .login-container {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.3);
            max-width: 450px;
            width: 100%;
            position: relative;
            overflow: hidden;
          }
          .login-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 4px;
            background: linear-gradient(90deg,rgb(182, 182, 182) 0%, rgba(119, 214, 224, 1) 50%, rgba(8, 156, 170, 1) 100%);  
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
            color:rgb(0, 0, 0);
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
            position: relative;
            color: #000000;
          }
          .form-input:focus {
            outline: none;
            border-color: #87CEEB;
            background: white;
            box-shadow: 0 0 0 4px rgba(135, 206, 235, 0.1);
            transform: translateY(-2px);
          }
          .form-input::placeholder {
            color: #adb5bd;
          }
          .input-wrapper {
            position: relative;
          }
          .input-icon {
            position: absolute;
            left: 16px;
            top: 50%;
            transform: translateY(-50%);
            color: #6c757d;
            font-size: 1.1rem;
          }
          .input-with-icon {
            padding-left: 48px;
          }
          .login-btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 8px 24px rgba(135, 206, 235, 0.3);
            position: relative;
            overflow: hidden;
          }
          .login-btn::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s;
          }
          .login-btn:hover::before {
            left: 100%;
          }
          .login-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 12px 32px rgba(135, 206, 235, 0.4);
          }
          .login-btn:active {
            transform: translateY(-1px);
          }
          .error-message {
            background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
            color: white;
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3);
            animation: shake 0.5s ease-in-out;
          }
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            25% { transform: translateX(-5px); }
            75% { transform: translateX(5px); }
          }
          .form-input.error-border {
            border-color: #dc3545 !important;
            background: #fff5f5 !important;
          }
          @media (max-width: 480px) {
            .login-container {
              padding: 30px 20px;
              margin: 10px;
            }
            .title {
              font-size: 1.8rem;
            }
            .login-btn {
              padding: 18px;
              font-size: 1.2rem;
            }
          }
          
          @media (max-width: 768px) {
            .login-btn {
              padding: 16px;
              font-size: 1.1rem;
            }
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
          
          /* OTP Modal Responsive Styles */
          :global(.otp-modal-content) {
            max-width: 500px !important;
            margin: 10px !important;
          }
          
          :global(.otp-modal-body) {
            padding: 24px !important;
          }
          
          @media (max-width: 768px) {
            :global(.otp-modal-content) {
              max-width: 95% !important;
              margin: 5px !important;
            }
            
            :global(.otp-modal-body) {
              padding: 20px !important;
            }
            
            .vac-input {
              width: 38px !important;
              height: 48px !important;
              font-size: 1.3rem !important;
            }
          }
          
          @media (max-width: 480px) {
            :global(.otp-modal-content) {
              max-width: 98% !important;
              margin: 2px !important;
            }
            
            :global(.otp-modal-body) {
              padding: 16px !important;
            }
            
            .otp-title {
              font-size: 1.3rem !important;
              margin-bottom: 6px !important;
            }
            
            .otp-subtitle {
              font-size: 0.85rem !important;
            }
            
            .otp-inputs-container {
              gap: 6px !important;
              margin-bottom: 12px !important;
            }
            
            .vac-input {
              width: 35px !important;
              height: 45px !important;
              font-size: 1.2rem !important;
            }
            
            .otp-buttons-container {
              flex-direction: column !important;
              gap: 10px !important;
            }
            
            .otp-cancel-btn,
            .otp-verify-btn {
              width: 100% !important;
              padding: 12px !important;
              font-size: 0.95rem !important;
            }
            
            .otp-resend-container {
              margin-top: 12px !important;
            }
            
            .otp-resend-btn {
              width: 100% !important;
              padding: 10px !important;
              font-size: 0.85rem !important;
            }
          }
          
          @media (max-width: 768px) {
            .otp-buttons-container {
              gap: 10px !important;
            }
            
            .otp-cancel-btn,
            .otp-verify-btn {
              padding: 11px 20px !important;
              font-size: 0.95rem !important;
            }
            
            .otp-resend-btn {
              padding: 10px 18px !important;
              font-size: 0.88rem !important;
            }
          }
        `}</style>

        <div className="login-container">
          <div className="logo-section">
            <Image src="/logo.png" alt="Logo" width={90} height={90} className="logo-icon" style={{ borderRadius: '50px' }} priority />
            <h1 className="title">Application Login</h1>
            <p className="subtitle">Welcome back! Please sign in to continue</p>
          </div>

        <form onSubmit={handleLogin} autoComplete="off">
            <div className="form-group" style={{ marginBottom: usernameError ? 4 : 38 }}>
              <FloatingLabelInput
                label="Username, ID"
                value={assistant_id}
                onChange={e => {
                  // Remove spaces from username input
                  const value = e.target.value.replace(/\s/g, '');
                  setAssistantId(value);
                  
                  // Remove from sessionStorage if input is empty
                  if (typeof window !== 'undefined') {
                    if (value === '') {
                      sessionStorage.removeItem('forgot_password_username');
                    } else {
                      sessionStorage.setItem('forgot_password_username', value);
                    }
                  }
                }}
                onKeyDown={(e) => {
                  // Prevent space key from being entered
                  if (e.key === ' ') {
                    e.preventDefault();
                  }
                }}
                error={usernameError || undefined}
                autoComplete="username, id"
                type="text"
              />
            </div>
            <div className="form-group" style={{ marginBottom: passwordError ? 4 : 24 }}>
              <FloatingLabelInput
                label="Password"
                value={password}
                onChange={e => {
                  const value = e.target.value;
                  setPassword(value);
                  
                  // Remove from sessionStorage if password field is cleared
                  if (typeof window !== 'undefined') {
                    if (value === '') {
                      sessionStorage.removeItem('forgot_password_password');
                    } else {
                      sessionStorage.setItem('forgot_password_password', value);
                    }
                  }
                }}
                error={passwordError || undefined}
                autoComplete="current-password"
                type="password"
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 8 }}>
                <a
                  href="#"
                  style={{ color: '#00101f', cursor: 'pointer', fontWeight: 500, textDecoration: 'underline', fontSize: '0.85rem' }}
                  onClick={e => { 
                    e.preventDefault();
                    handleForgotPassword();
                  }}
                >
                  Forgot your password?
                </a>
              </div>
              {/* Remove duplicate message display */}
            </div>

            {/* Show redirect message */}
            {redirectMessage && (
              <div style={{
                background: 'linear-gradient(135deg, #17a2b8 0%, #20c997 100%)',
                color: 'white',
                borderRadius: 8,
                padding: '12px 16px',
                margin: '16px 0 0 0',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(23, 162, 184, 0.15)',
                textAlign: 'center',
                fontSize: '1rem',
                maxWidth: 400,
                marginLeft: 'auto',
                marginRight: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}>
                <span style={{ fontSize: 20 }}>🔒</span> {redirectMessage}
              </div>
            )}

            {/* Show error messages */}
            {(message || forgotMsg) && (
              <div style={{
                background: 'linear-gradient(135deg, #dc3545 0%, #e74c3c 100%)',
                color: 'white',
                borderRadius: 8,
                padding: '12px 16px',
                margin: '16px 0 0 0',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(220, 53, 69, 0.15)',
                textAlign: 'center',
                fontSize: '1rem',
                maxWidth: 400,
                marginLeft: 'auto',
                marginRight: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                flexWrap: 'nowrap'
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>❗</span> 
                {message === 'student_account_deactivated' ? (
                  <span>
                    Access unavailable: This account is deactivated. Please contact{' '}
                    <a
                      href="/contact_assistants"
                      onClick={(e) => {
                        e.preventDefault();
                        router.push('/contact_assistants');
                      }}
                      style={{
                        color: 'white',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: 700
                      }}
                    >
                      assistants
                    </a>
                    {' '}or{' '}
                    <a
                      href="/contact_developer"
                      onClick={(e) => {
                        e.preventDefault();
                        router.push('/contact_developer');
                      }}
                      style={{
                        color: 'white',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: 700
                      }}
                    >
                      developer
                    </a>
                  </span>
                ) : message === 'device_limit_reached' ? (
                  <span>
                    Access unavailable: You have reached the maximum number of allowed devices for your account. Contact{' '}
                    <a
                      href="/contact_assistants"
                      onClick={(e) => {
                        e.preventDefault();
                        router.push('/contact_assistants');
                      }}
                      style={{
                        color: 'white',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: 700
                      }}
                    >
                      assistants
                    </a>
                    {' '}or{' '}
                    <a
                      href="/contact_developer"
                      onClick={(e) => {
                        e.preventDefault();
                        router.push('/contact_developer');
                      }}
                      style={{
                        color: 'white',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontWeight: 700
                      }}
                    >
                      developer
                    </a>
                  </span>
                ) : message === 'ACCOUNT_NOT_FOUND_SIGNUP' ? (
                  <span>
                    Account Not Found, Please{' '}
                    <a
                      href="/sign-up"
                      style={{ 
                        color: 'white', 
                        textDecoration: 'underline', 
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        router.push('/sign-up');
                      }}
                    >
                      Sign up
                    </a>
                  </span>
                ) : forgotMsg === 'ACCOUNT_NOT_FOUND' ? (
                  <span>
                    Account Not Found, Please{' '}
                    <a
                      href="/sign-up"
                      style={{ 
                        color: 'white', 
                        textDecoration: 'underline', 
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        router.push('/sign-up');
                      }}
                    >
                      Sign up
                    </a>
                  </span>
                ) : forgotMsg ? (
                  <span>{forgotMsg}</span>
                ) : message && message.includes('developer') ? (
                    <span>
                      {message.split('(developer)').map((part, index, array) => {
                        if (index === array.length - 1) {
                          return part;
                        }
                        return (
                          <span key={index}>
                            {part}(
                            <a
                              href="/contact_developer"
                              style={{ 
                                color: 'white', 
                                textDecoration: 'underline', 
                                fontWeight: 'bold',
                                cursor: 'pointer'
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                router.push('/contact_developer');
                              }}
                            >
                              developer
                            </a>
                            )
                          </span>
                        );
                      })}
                    </span>
                  ) : (
                    message
                  )}
              </div>
            )}

            <button type="submit" className="login-btn" disabled={loginMutation.isPending} style={{ background: 'linear-gradient(90deg, #5F6DFE 0%, #6A82FB 100%)', fontWeight: 700, fontSize: '1.1rem', borderRadius: 12, marginTop: 10 }}>
              {loginMutation.isPending ? "Logging in..." : "Continue"}
            </button>
            
            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.95rem', color: '#495057' }}>
              Don't Have An Account?{' '}
              <a
                href="/sign-up"
                onClick={(e) => {
                  e.preventDefault();
                  router.push('/sign-up');
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
                Sign Up
              </a>
            </div>
          </form>

        </div>

        {/* OTP Popup Modal */}
        <Modal
          opened={otpPopupOpen}
          onClose={() => {
            setOtpPopupOpen(false);
            setOtp(['', '', '', '', '', '', '', '']);
            setOtpError('');
          }}
          title={null}
          centered
          radius="md"
          size="md"
          withCloseButton={false}
          overlayProps={{ opacity: 0.9, blur: 4 }}
          styles={{
            content: {
              background: '#ffffff',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
              border: '1px solid #e9ecef',
              maxWidth: '500px',
              margin: '10px',
            },
            header: {
              display: 'none',
            },
            body: {
              padding: '24px',
            }
          }}
          classNames={{
            content: 'otp-modal-content',
            body: 'otp-modal-body'
          }}
        >
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <h2 className="otp-title" style={{ fontSize: '1.5rem', fontWeight: '700', color: '#2c3e50', marginBottom: '8px' }}>
              Enter OTP Code
            </h2>
            <p className="otp-subtitle" style={{ color: '#6c757d', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              We've sent an 8-digit code to your <Image src="/mail.svg" alt="Email" width={20} height={20} /> email
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <div className="vac-inputs-container otp-inputs-container" style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              gap: '8px',
              marginBottom: '16px'
            }}>
              {otp.map((char, index) => (
                <input
                  key={index}
                  name={`otp-${index}`}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete={index === 0 ? "one-time-code" : "off"}
                  value={char}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(e, index)}
                  onPaste={(e) => handleOtpPaste(e, index)}
                  className={otpError ? 'vac-input error-border' : 'vac-input'}
                  onFocus={(e) => {
                    if (!e.target.classList.contains('error-border')) {
                      e.target.style.borderColor = '#1FA8DC';
                      e.target.style.boxShadow = '0 0 0 4px rgba(31, 168, 220, 0.2)';
                      e.target.style.backgroundColor = '#ffffff';
                      e.target.style.transform = 'scale(1.05)';
                    }
                  }}
                  onBlur={(e) => {
                    const hasError = otpError && otpError.trim() !== '';
                    e.target.style.borderColor = hasError ? '#dc3545' : '#87CEEB';
                    e.target.style.boxShadow = hasError ? '0 0 0 2px rgba(220, 53, 69, 0.1)' : '0 2px 6px rgba(135, 206, 235, 0.2)';
                    e.target.style.backgroundColor = '#f8f9fa';
                    e.target.style.transform = 'scale(1)';
                  }}
                />
              ))}
            </div>
            {otpError && (
              <div style={{
                color: '#dc3545',
                fontSize: '0.9rem',
                textAlign: 'center',
                marginTop: '8px',
                fontWeight: '500'
              }}>
                {otpError}
              </div>
            )}
            <div className="otp-resend-container" style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                className="otp-resend-btn"
                onClick={handleResendOtp}
                disabled={isSendingOtp || resendCooldown > 0}
                style={{
                  background: resendCooldown > 0 ? 'linear-gradient(135deg, #6c757d 0%, #495057 100%)' : 'linear-gradient(135deg, #1FA8DC 0%, #17a2b8 100%)',
                  border: 'none',
                  color: 'white',
                  cursor: (isSendingOtp || resendCooldown > 0) ? 'not-allowed' : 'pointer',
                  borderRadius: '8px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  padding: '10px 20px',
                  boxShadow: resendCooldown > 0 ? '0 2px 8px rgba(108, 117, 125, 0.3)' : '0 4px 12px rgba(31, 168, 220, 0.3)',
                  transition: 'all 0.3s ease',
                  opacity: (isSendingOtp || resendCooldown > 0) ? 0.7 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isSendingOtp && resendCooldown === 0) {
                    e.target.style.transform = 'translateY(-2px)';
                    e.target.style.boxShadow = '0 6px 16px rgba(31, 168, 220, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSendingOtp && resendCooldown === 0) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 12px rgba(31, 168, 220, 0.3)';
                  }
                }}
              >
                {isSendingOtp 
                  ? 'Sending...' 
                  : resendCooldown > 0 
                    ? `Resend OTP (${Math.floor(resendCooldown / 60)}:${String(resendCooldown % 60).padStart(2, '0')})`
                    : 'Resend OTP'
                }
              </button>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'center'
          }}>
            <button
              onClick={handleVerifyOtp}
              disabled={isVerifyingOtp || otp.join('').length !== 8}
              style={{
                padding: '12px 24px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: (isVerifyingOtp || otp.join('').length !== 8) ? 'not-allowed' : 'pointer',
                opacity: (isVerifyingOtp || otp.join('').length !== 8) ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              {isVerifyingOtp ? 'Verifying...' : 'Verify'}
            </button>
            <button
              onClick={() => {
                setOtpPopupOpen(false);
                setOtp(['', '', '', '', '', '', '', '']);
                setOtpError('');
              }}
              disabled={isVerifyingOtp}
              style={{
                padding: '12px 24px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                fontWeight: '600',
                cursor: isVerifyingOtp ? 'not-allowed' : 'pointer',
                opacity: isVerifyingOtp ? 0.6 : 1,
                transition: 'all 0.2s ease'
              }}
            >
              Cancel
            </button>
          </div>

          <NeedHelp style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #e9ecef' }} />
        </Modal>
    </div>
  );
}