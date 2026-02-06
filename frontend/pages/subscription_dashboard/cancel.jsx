import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Title from '../../components/Title';
import SubscriptionCard from '../../components/SubscriptionCard';
import { useSubscription, useCancelSubscription } from '../../lib/api/subscription';

export default function CancelSubscription() {
  const router = useRouter();
  const { data: subscription } = useSubscription();
  const cancelSubscription = useCancelSubscription();
  
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleCancel = async () => {
    try {
      setError('');
      setSuccess('');
      await cancelSubscription.mutateAsync();
      setShowConfirmPopup(false);
      setSuccess('Subscription cancelled successfully');
    } catch (err) {
      setShowConfirmPopup(false);
      setError(err.response?.data?.error || 'Failed to cancel subscription');
      console.error('Error cancelling subscription:', err);
    }
  };

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

  const hasActiveSubscription = subscription?.active && subscription?.date_of_expiration;

  return (
    <div style={{ minHeight: '100vh', padding: '20px' }}>
      <div style={{ maxWidth: 800, margin: '40px auto', padding: '12px' }}>
        <Title backText="Back" href="/subscription_dashboard">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/cross-circle.svg" alt="Cancel" width={32} height={32} />
            Cancel Subscription
          </div>
        </Title>

        <SubscriptionCard />

        {error && (
          <div className="error-message">❌ {error}</div>
        )}

        {success && (
          <div className="success-message">✅ {success}</div>
        )}

        {hasActiveSubscription && (
          <div className="cancel-section">
            <button
              className="cancel-subscription-btn"
              onClick={() => setShowConfirmPopup(true)}
              disabled={cancelSubscription.isPending}
            >
              {cancelSubscription.isPending ? 'Cancelling...' : 'Cancel Subscription'}
            </button>
          </div>
        )}

        {/* Confirmation Popup */}
        {showConfirmPopup && (
          <div className="popup-overlay" onClick={() => setShowConfirmPopup(false)}>
            <div className="popup-content" onClick={(e) => e.stopPropagation()}>
              <div className="popup-header">Confirm Cancel Subscription</div>
              <div className="popup-message">
                Are you sure you want to cancel subscription? This action cannot be undone!
              </div>
              <div className="popup-buttons">
                <button
                  className="popup-btn confirm"
                  onClick={handleCancel}
                  disabled={cancelSubscription.isPending}
                >
                  {cancelSubscription.isPending ? 'Cancelling...' : 'Yes, cancel subscription'}
                </button>
                <button
                  className="popup-btn cancel"
                  onClick={() => setShowConfirmPopup(false)}
                  disabled={cancelSubscription.isPending}
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
          }

          .cancel-section {
            margin-top: 30px;
            text-align: center;
          }

          .cancel-subscription-btn {
            padding: 16px 32px;
            background: linear-gradient(90deg, #dc3545 0%, #ff6b6b 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 1.2rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3);
          }

          .cancel-subscription-btn:hover:not(:disabled) {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(220, 53, 69, 0.4);
          }

          .cancel-subscription-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
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
            line-height: 1.6;
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

          .popup-btn.confirm:hover:not(:disabled) {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(220, 53, 69, 0.3);
          }

          .popup-btn.cancel {
            background: #adb5bd;
            color: white;
          }

          .popup-btn.cancel:hover:not(:disabled) {
            background: #98a2ac;
          }

          .popup-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          @media (max-width: 768px) {
            .cancel-section {
              margin-top: 20px;
            }

            .cancel-subscription-btn {
              padding: 14px 28px;
              font-size: 1.1rem;
            }

            .error-message,
            .success-message {
              padding: 14px;
              font-size: 0.95rem;
            }

            .popup-content {
              padding: 24px;
            }
          }

          @media (max-width: 480px) {
            .page-container {
              margin: 15px auto;
              padding: 5px;
            }

            .cancel-section {
              margin-top: 15px;
            }

            .cancel-subscription-btn {
              padding: 12px 24px;
              font-size: 1rem;
              border-radius: 10px;
            }

            .error-message,
            .success-message {
              padding: 12px;
              font-size: 0.9rem;
              border-radius: 8px;
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
