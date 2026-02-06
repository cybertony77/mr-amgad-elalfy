import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Title from '../../components/Title';
import DurationSelect from '../../components/DurationSelect';
import { useSubscription, useCreateSubscription } from '../../lib/api/subscription';

export default function DailySubscription() {
  const router = useRouter();
  const { data: subscription } = useSubscription();
  const createSubscription = useCreateSubscription();
  
  const [duration, setDuration] = useState(1);
  const [cost, setCost] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    if (subscription?.active && subscription?.date_of_expiration) {
      const now = new Date();
      const expiration = new Date(subscription.date_of_expiration);
      if (now < expiration) {
        // Active subscription exists
      }
    }
  }, [subscription]);

  // Auto-hide success message after 6 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess('');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Auto-hide error message after 6 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError('');
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!cost || cost.trim() === '' || isNaN(parseFloat(cost))) {
      setError('Cost is required and must be a valid number');
      return;
    }

    if (subscription?.active && subscription?.date_of_expiration) {
      const now = new Date();
      const expiration = new Date(subscription.date_of_expiration);
      if (now < expiration) {
        setShowPopup(true);
        return;
      }
    }

    await createSubscriptionMutation();
  };

  const createSubscriptionMutation = async (overwrite = false) => {
    try {
      const result = await createSubscription.mutateAsync({
        subscription_duration: duration,
        duration_type: 'daily',
        cost: parseFloat(cost),
        note: note.trim() || null,
        overwrite: overwrite
      });

      if (result.success) {
        setSuccess(`Successfully subscribed ${duration} day${duration > 1 ? 's' : ''}`);
        setDuration(1);
        setCost('');
        setNote('');
      }
    } catch (err) {
      if (err.response?.data?.error === 'ACTIVE_SUBSCRIPTION_EXISTS') {
        setShowPopup(true);
      } else {
        setError(err.response?.data?.error || 'Failed to create subscription');
      }
    }
  };

  const handleOverwriteSubscription = async () => {
    setShowPopup(false);
    await createSubscriptionMutation(true);
  };

  const days = Array.from({ length: 29 }, (_, i) => i + 1);

  return (
    <div style={{ minHeight: '100vh', padding: '20px' }}>
      <div className="page-container">
        <Title backText="Back" href="/subscription_dashboard">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/notes5.svg" alt="Daily" width={32} height={32} />
            Daily Subscription
          </div>
        </Title>

        <div className="subscription-form-container">
          <form onSubmit={handleSubmit} className="subscription-form">
            <div className="form-group">
              <label className="form-label">Duration (Days) <span className="required-asterisk">*</span></label>
              <DurationSelect
                selectedValue={duration}
                onValueChange={(value) => setDuration(value ? parseInt(value) : 1)}
                options={days.map(day => ({ value: day }))}
                placeholder="Select days"
                formatOption={(val) => `${val} ${val === 1 ? 'Day' : 'Days'}`}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Cost <span className="required-asterisk">*</span></label>
              <input
                type="number"
                className="form-input"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="Enter cost"
                step="0.01"
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Note (Optional)</label>
              <textarea
                className="form-textarea"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Enter optional note"
                rows="4"
              />
            </div>

            {error && (
              <div className="error-message">❌ {error}</div>
            )}

            {success && (
              <div className="success-message">✅ {success}</div>
            )}

            <button type="submit" className="submit-btn" disabled={createSubscription.isPending}>
              {createSubscription.isPending ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </div>

        {showPopup && (
          <div className="popup-overlay" onClick={() => setShowPopup(false)}>
            <div className="popup-content" onClick={(e) => e.stopPropagation()}>
              <div className="popup-header">Active Subscription Exists</div>
              <div className="popup-message">
                There is already a subscription and it's not expired yet.
              </div>
              <div className="popup-buttons">
                <button
                  className="popup-btn confirm"
                  onClick={handleOverwriteSubscription}
                >
                  Cancel the current subscription and set this new subscription
                </button>
                <button
                  className="popup-btn cancel"
                  onClick={() => setShowPopup(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <style jsx>{`
          .page-container {
            max-width: 800px;
            margin: 40px auto;
            padding: 12px;
            width: 100%;
            box-sizing: border-box;
          }

          .subscription-form-container {
            background: white;
            border-radius: 16px;
            padding: 30px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            margin-top: 30px;
            width: 100%;
            box-sizing: border-box;
          }

          .subscription-form {
            display: flex;
            flex-direction: column;
            gap: 20px;
          }

          .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
          }

          .form-label {
            font-weight: 700;
            color: #495057;
            font-size: 1rem;
          }

          .required-asterisk {
            color: #dc3545;
            font-weight: 700;
          }


          .form-input,
          .form-textarea {
            padding: 12px 16px;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            font-size: 1rem;
            transition: border-color 0.2s;
          }

          .form-input:focus,
          .form-textarea:focus {
            outline: none;
            border-color: #1FA8DC;
          }

          .form-textarea {
            resize: vertical;
            font-family: inherit;
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

          .submit-btn {
            padding: 14px 24px;
            background: linear-gradient(90deg, #1FA8DC 0%, #87CEEB 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1.1rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
          }

          .submit-btn:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(31, 168, 220, 0.4);
          }

          .submit-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .popup-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
          }

          .popup-content {
            background: white;
            border-radius: 16px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          }

          .popup-header {
            font-size: 1.5rem;
            font-weight: 700;
            color: #495057;
            margin-bottom: 16px;
            text-align: center;
          }

          .popup-message {
            font-size: 1.1rem;
            color: #6c757d;
            margin-bottom: 24px;
            text-align: center;
          }

          .popup-buttons {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }

          .popup-btn {
            padding: 12px 20px;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .popup-btn.confirm {
            background: linear-gradient(90deg, #dc3545 0%, #ff6b6b 100%);
            color: white;
          }

          .popup-btn.confirm:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
          }

          .popup-btn.cancel {
            background: #adb5bd;
            color: white;
          }

          .popup-btn.cancel:hover {
            background: #98a2ac;
          }

          @media (max-width: 768px) {
            .subscription-form-container {
              padding: 20px;
              margin-top: 20px;
            }

            .form-label {
              font-size: 0.95rem;
            }

            .form-input,
            .form-textarea {
              font-size: 0.95rem;
            }

            .submit-btn {
              padding: 12px 20px;
              font-size: 1rem;
            }

            .popup-content {
              padding: 24px;
            }
          }

          @media (max-width: 768px) {
            .page-container {
              margin: 20px auto;
              padding: 8px;
            }
          }

          @media (max-width: 480px) {
            .page-container {
              margin: 15px auto;
              padding: 5px;
            }

            .subscription-form-container {
              padding: 15px;
              margin-top: 15px;
              border-radius: 12px;
            }

            .form-group {
              gap: 6px;
            }

            .form-label {
              font-size: 0.9rem;
            }

            .form-input,
            .form-textarea {
              padding: 10px 14px;
              font-size: 0.9rem;
            }

            .submit-btn {
              padding: 12px 18px;
              font-size: 0.95rem;
            }

            .error-message,
            .success-message {
              padding: 12px;
              font-size: 0.9rem;
            }

            .popup-content {
              padding: 20px;
              width: 95%;
            }

            .popup-header {
              font-size: 1.3rem;
            }

            .popup-message {
              font-size: 1rem;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
