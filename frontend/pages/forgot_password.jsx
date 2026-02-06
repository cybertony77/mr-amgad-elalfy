import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Title from "../components/Title";
import apiClient from '../lib/axios';
import NeedHelp from '../components/NeedHelp';

// Access Denied Preloader Component (same as _app.js)
function AccessDeniedPreloader() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      color: 'white',
      fontSize: '1.2rem',
      fontWeight: 'bold',
      flexDirection: 'column',
      gap: '20px'
    }}>
      <div style={{
        width: '50px',
        height: '50px',
        border: '4px solid rgba(255, 255, 255, 0.3)',
        borderTop: '4px solid #1FA8DC',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
      <div>🔒 Access Denied</div>
      <div style={{ fontSize: '1rem', opacity: 0.8 }}>Redirecting to login...</div>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default function ForgotPassword() {
  const router = useRouter();
  const { id, sig } = router.query;
  const [form, setForm] = useState({ newPassword: "", confirmPassword: "" });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  // Verify HMAC signature
  useEffect(() => {
    const verifySignature = async () => {
      if (!id || !sig) {
        setShowAccessDenied(true);
        setTimeout(() => {
          setShowAccessDenied(false);
          router.push('/');
        }, 1500);
        return;
      }

      try {
        const response = await apiClient.post('/api/auth/forgot-password/verify-signature', {
          id: id,
          sig: sig
        });

        if (response.data.valid) {
          setIsAuthorized(true);
          // Save username/id to sessionStorage
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('forgot_password_username', id);
          }
        } else {
          // Invalid signature - show access denied preloader then redirect
          setShowAccessDenied(true);
          setTimeout(() => {
            setShowAccessDenied(false);
            router.push('/');
          }, 1500);
          return;
        }
      } catch (err) {
        // Invalid signature - show access denied preloader then redirect
        setShowAccessDenied(true);
        setTimeout(() => {
          setShowAccessDenied(false);
          router.push('/');
        }, 1500);
        return;
      } finally {
        setIsChecking(false);
      }
    };

    verifySignature();
  }, [id, sig, router]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(false);
        router.push('/');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, router]);

  const handleChange = (e) => {
    const newValue = e.target.value;
    setForm({ ...form, [e.target.name]: newValue });
    setError("");
    
    // Save password to sessionStorage when user types
    if (typeof window !== 'undefined') {
      if (e.target.name === 'newPassword') {
        if (newValue) {
          sessionStorage.setItem('forgot_password_password', newValue);
        } else {
          sessionStorage.removeItem('forgot_password_password');
        }
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Validation
    if (!form.newPassword || !form.confirmPassword) {
      setError("❌ All fields are required");
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError("❌ New password and confirm password do not match");
      return;
    }

    if (form.newPassword.length < 8) {
      setError("❌ New password must be at least 8 characters");
      return;
    }

    setIsSubmitting(true);

    try {
      await apiClient.post('/api/auth/forgot-password/reset', {
        id: id,
        newPassword: form.newPassword,
        sig: sig
      });

      setSuccess(true);
      setForm({ newPassword: "", confirmPassword: "" });
      // Keep password in sessionStorage for login page
    } catch (err) {
      setError(err.response?.data?.error || "❌ Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show access denied preloader
  if (showAccessDenied) {
    return <AccessDeniedPreloader />;
  }

  if (isChecking) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px", 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        <div className="verifying-container" style={{
          background: "rgba(255, 255, 255, 0.95)",
          borderRadius: "16px",
          padding: "40px",
          textAlign: "center",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)"
        }}>
          <p className="verifying-text" style={{ color: "#666", fontSize: "1rem", marginBottom: "20px" }}>Verifying signature...</p>
          <div className="verifying-spinner" style={{
            width: "50px",
            height: "50px",
            border: "4px solid rgba(31, 168, 220, 0.2)",
            borderTop: "4px solid #1FA8DC",
            borderRadius: "50%",
            margin: "0 auto",
            animation: "spin 1s linear infinite"
          }} />
          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div style={{ minHeight: "100vh", padding: "20px 5px 20px 5px" }}>
        <div style={{ maxWidth: 600, margin: "40px auto", padding: 24 }}>
          <div className="error-message">
            {error || 'Unauthorized. Please verify OTP first.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: "20px 5px 20px 5px"}}>
      <div className="forgot-password-wrapper" style={{ maxWidth: 600, margin: "40px auto", padding: 24 }}>
        <style jsx>{`
          .form-container {
            background: white;
            border-radius: 16px;
            padding: 32px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.1);
            border: 1px solid rgba(255,255,255,0.2);
          }
          .form-group {
            margin-bottom: 24px;
          }
          .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            color: #495057;
            font-size: 0.95rem;
          }
          .form-input {
            width: 100%;
            padding: 14px 16px;
            border: 2px solid #e9ecef;
            border-radius: 10px;
            font-size: 1rem;
            transition: all 0.3s ease;
            box-sizing: border-box;
            background: #ffffff;
            color: #000000;
          }
          .form-input:focus {
            outline: none;
            border-color: #667eea;
            background: white;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }
          .submit-btn {
            width: 100%;
            padding: 16px;
            background: linear-gradient(135deg, #87CEEB 0%, #B0E0E6 100%);
            color: white;
            border: none;
            border-radius: 10px;
            font-size: 1.1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(135, 206, 235, 0.3);
            margin-top: 8px;
          }
          .submit-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(135, 206, 235, 0.4);
          }
          .submit-btn:disabled {
            opacity: 0.7;
            cursor: not-allowed;
            transform: none;
            box-shadow: 0 2px 8px rgba(135, 206, 235, 0.2);
          }
          .success-message {
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            border-radius: 10px;
            padding: 16px;
            margin-top: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(40, 167, 69, 0.3);
          }
          .error-message {
            background: linear-gradient(135deg, #dc3545 0%, #e74c3c 100%);
            color: white;
            border-radius: 10px;
            padding: 16px;
            margin-top: 16px;
            text-align: center;
            font-weight: 600;
            box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3);
          }
          
          @media (max-width: 768px) {
            .form-container {
              padding: 24px !important;
            }
            
            .form-group {
              margin-bottom: 20px !important;
            }
            
            .form-group label {
              font-size: 0.9rem !important;
            }
            
            .form-input {
              padding: 12px 14px !important;
              font-size: 0.95rem !important;
            }
            
            .submit-btn {
              padding: 14px !important;
              font-size: 1rem !important;
            }
            
            .success-message,
            .error-message {
              padding: 14px !important;
              font-size: 0.9rem !important;
            }
          }
          
          @media (max-width: 480px) {
            .forgot-password-wrapper {
              padding: 10px !important;
              margin: 20px auto !important;
            }
            
            .verifying-container {
              padding: 30px 20px !important;
            }
            
            .verifying-text {
              font-size: 0.9rem !important;
              margin-bottom: 16px !important;
            }
            
            .verifying-spinner {
              width: 40px !important;
              height: 40px !important;
              border-width: 3px !important;
            }
            
            .form-container {
              padding: 20px !important;
              border-radius: 12px !important;
            }
            
            .form-group {
              margin-bottom: 18px !important;
            }
            
            .form-group label {
              font-size: 0.85rem !important;
              margin-bottom: 6px !important;
            }
            
            .form-input {
              padding: 12px 14px !important;
              font-size: 0.9rem !important;
              border-radius: 8px !important;
            }
            
            .submit-btn {
              padding: 14px !important;
              font-size: 0.95rem !important;
              border-radius: 8px !important;
            }
            
            .success-message,
            .error-message {
              padding: 12px !important;
              font-size: 0.85rem !important;
              border-radius: 8px !important;
            }
          }
          
          @media (max-width: 768px) {
            .forgot-password-wrapper {
              padding: 15px !important;
              margin: 30px auto !important;
            }
            
            .verifying-container {
              padding: 35px 25px !important;
            }
            
            .verifying-spinner {
              width: 45px !important;
              height: 45px !important;
            }
          }
        `}</style>
        <Title backText="Back to Login" href="/">Reset Password</Title>
        <div className="form-container">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  name="newPassword"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter your new password"
                  value={form.newPassword}
                  onChange={handleChange}
                  style={{ paddingRight: '50px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
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
                    src={showNewPassword ? "/hide.svg" : "/show.svg"} 
                    alt={showNewPassword ? "Hide password" : "Show password"}
                    style={{ width: '20px', height: '20px' }}
                  />
                </button>
              </div>
              <small style={{ color: '#6c757d', fontSize: '0.85rem', marginTop: '4px', display: 'block' }}>
                Must be at least 8 characters long
              </small>
            </div>
            <div className="form-group">
              <label>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your new password"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  style={{ paddingRight: '50px' }}
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
            <button 
              type="submit" 
              className="submit-btn" 
              disabled={isSubmitting || !form.newPassword || !form.confirmPassword}
            >
              {isSubmitting ? "Resetting Password..." : "Reset Password"}
            </button>
          </form>
          {success && <div className="success-message">✅ Password reset successfully!</div>}
          {error && <div className="error-message">{error}</div>}
          <NeedHelp />
        </div>
      </div>
    </div>
  );
}

