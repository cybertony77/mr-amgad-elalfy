import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import Title from "../../components/Title";
import { useProfile, useUpdateProfile } from '../../lib/api/auth';
import apiClient from '../../lib/axios';
import NeedHelp from '../../components/NeedHelp';

export default function ChangePassword() {
  const router = useRouter();
  const { data: profile } = useProfile();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const updateProfileMutation = useUpdateProfile();

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
        setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError(""); // Clear error when user starts typing
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    // Validation
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirm password do not match');
      return;
    }

    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    // Trim whitespace and compare
    if (form.currentPassword.trim() === form.newPassword.trim()) {
      setError('New password must be different from current password');
      return;
    }

    // Verify current password using dedicated endpoint
    try {
      await apiClient.post('/api/auth/verify_password', {
        currentPassword: form.currentPassword
      });
    } catch (verifyError) {
      const errorMessage = verifyError.response?.data?.error || 'Current password is incorrect';
      // Remove ❌ if it's already in the error message
      setError(errorMessage.replace(/^❌\s*/, ''));
      return;
    }

    // Update password
    updateProfileMutation.mutate(
      { password: form.newPassword },
      {
        onSuccess: () => {
          setSuccess(true);
          setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        },
        onError: (err) => {
          const errorMessage = err.response?.data?.error || 'Failed to update password';
          // Remove ❌ if it's already in the error message
          setError(errorMessage.replace(/^❌\s*/, ''));
        }
      }
    );
  };

  return (
    <div style={{ minHeight: "100vh", padding: "20px 5px 20px 5px"}}>
      <div style={{ maxWidth: 800, margin: "40px auto", padding: "20px 5px 20px 5px" }}>
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
        `}</style>
        <Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/key2.svg" alt="Key" width={32} height={32} />
            Change My Password
          </div>
        </Title>
        <div className="form-container">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Current Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="form-input"
                  name="currentPassword"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Enter your current password"
                  value={form.currentPassword}
                  onChange={handleChange}
                  style={{ paddingRight: '50px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
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
                    src={showCurrentPassword ? "/hide.svg" : "/show.svg"} 
                    alt={showCurrentPassword ? "Hide password" : "Show password"}
                    style={{ width: '20px', height: '20px' }}
                  />
                </button>
              </div>
            </div>
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
              disabled={updateProfileMutation.isPending || !form.currentPassword || !form.newPassword || !form.confirmPassword}
            >
              {updateProfileMutation.isPending ? "Changing Password..." : "Change Password"}
            </button>
          </form>
          {success && <div className="success-message">✅ Password changed successfully!</div>}
          {error && <div className="error-message">{typeof error === 'string' ? `❌ ${error}` : error}</div>}
          <NeedHelp style={{ padding: '16px' }} />
        </div>
      </div>
    </div>
  );
}

