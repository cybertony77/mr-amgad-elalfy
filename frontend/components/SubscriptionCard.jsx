import { useState, useEffect, useRef } from 'react';
import { useSubscription, useExpireSubscription } from '../lib/api/subscription';

export default function SubscriptionCard() {
  const { data: subscription, isLoading, error, refetch } = useSubscription();
  const expireSubscription = useExpireSubscription();
  const [timeRemaining, setTimeRemaining] = useState(null);
  const hasExpiredRef = useRef(false); // Track if we've already expired this subscription
  const expireMutationRef = useRef(null); // Store mutation function to avoid dependency issues
  
  // Store mutation function in ref
  useEffect(() => {
    expireMutationRef.current = expireSubscription.mutate;
  }, [expireSubscription.mutate]);

  // Use cached data if available, even if refetching
  const displaySubscription = subscription || {
    subscription_duration: null,
    date_of_subscription: null,
    date_of_expiration: null,
    cost: null,
    note: null,
    active: false
  };

  // Store expiration date in a stable format for comparison
  const expirationTimestamp = displaySubscription?.date_of_expiration 
    ? new Date(displaySubscription.date_of_expiration).getTime()
    : null;
  const isActive = displaySubscription?.active ?? false;

  useEffect(() => {
    // Early return if no active subscription
    if (!isActive || !expirationTimestamp) {
      setTimeRemaining(null);
      // Reset expiration flag when subscription becomes inactive
      if (!isActive) {
        hasExpiredRef.current = null;
      }
      return;
    }

    // Create a stable key for this subscription based on expiration timestamp
    const expirationKey = expirationTimestamp.toString();

    // Don't run timer if we've already expired this subscription
    const expiredKey = `expired-${expirationKey}`;
    if (hasExpiredRef.current === expiredKey) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      // Check current subscription state from the latest subscription data
      const currentSubscription = subscription || displaySubscription;
      if (!currentSubscription?.active || !currentSubscription?.date_of_expiration) {
        setTimeRemaining(null);
        return;
      }

      const now = new Date();
      const expiration = new Date(currentSubscription.date_of_expiration);
      const diff = expiration - now;

      if (diff <= 0) {
        setTimeRemaining(null);
        
        // Auto-expire subscription in database if not already expired for this subscription
        if (hasExpiredRef.current !== expiredKey) {
          hasExpiredRef.current = expiredKey;
          
          // Call expiration mutation using ref to avoid dependency issues
          if (expireMutationRef.current) {
            expireMutationRef.current(undefined, {
              onSuccess: () => {
                // Success - mutation will invalidate queries, but we've already marked as expired
                // so the effect won't run again for this subscription
              },
              onError: (err) => {
                console.error('Error expiring subscription:', err);
                // Reset flag on error so we can retry
                hasExpiredRef.current = expirationKey;
              }
            });
          }
        }
        return;
      }

      let days = Math.floor(diff / (1000 * 60 * 60 * 24));
      let hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      let minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      let seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Redistribute time: if hours is 00 and days > 0, borrow 1 day to fill hours
      if (hours === 0 && days > 0) {
        days -= 1;
        hours = 24;
      }
      // If minutes is 00 and hours > 0, borrow 1 hour to fill minutes
      if (minutes === 0 && hours > 0) {
        hours -= 1;
        minutes = 60;
      }
      // If seconds is 00 and minutes > 0, borrow 1 minute to fill seconds
      if (seconds === 0 && minutes > 0) {
        minutes -= 1;
        seconds = 60;
      }

      // Check if all time components are zero
      if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
        setTimeRemaining(null);
        
        // Auto-expire subscription in database if not already expired for this subscription
        if (hasExpiredRef.current !== expiredKey) {
          hasExpiredRef.current = expiredKey;
          
          // Call expiration mutation using ref to avoid dependency issues
          if (expireMutationRef.current) {
            expireMutationRef.current(undefined, {
              onSuccess: () => {
                // Success - mutation will invalidate queries, but we've already marked as expired
                // so the effect won't run again for this subscription
              },
              onError: (err) => {
                console.error('Error expiring subscription:', err);
                // Reset flag on error so we can retry
                hasExpiredRef.current = expirationKey;
              }
            });
          }
        }
        return;
      }

      setTimeRemaining({ days, hours, minutes, seconds });
    };

    // Start the timer
    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
    // Only depend on expiration timestamp and active status, not the whole subscription object
    // The mutation function is stable, so we don't need to include it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expirationTimestamp, isActive]);

  // Show loading only on initial load, not on background refetches
  if (isLoading && subscription === undefined) {
    return (
      <>
        <div className="subscription-card">
          <div className="subscription-card-content">
            <div className="loading-container">
              <div className="loading-box">
                <div className="spinner-wrapper">
                  <div className="spinner"></div>
                </div>
                <div className="loading-text">Loading subscription data...</div>
              </div>
            </div>
          </div>
        </div>
        <style jsx>{`
          .subscription-card {
            position: relative;
            background: white;
            border-radius: 20px;
            padding: 6px;
            box-shadow: 0 10px 40px rgba(31, 168, 220, 0.3);
            margin: 30px 0;
            overflow: hidden;
          }

          .subscription-card::before {
            content: '';
            position: absolute;
            top: -150%;
            left: -150%;
            width: 400%;
            height: 400%;
            background: conic-gradient(
              from 0deg,
              #1FA8DC 0deg 80deg,
              transparent 80deg 180deg,
              #ef4a4a 180deg 260deg,
              transparent 260deg 360deg
            );
            animation: rotateGradient 6s linear infinite;
            z-index: 0;
          }

          .subscription-card::after {
            content: '';
            position: absolute;
            top: 6px;
            left: 6px;
            right: 6px;
            bottom: 6px;
            background: white;
            border-radius: 14px;
            z-index: 1;
          }

          @keyframes rotateGradient {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }

          .subscription-card-content {
            position: relative;
            background: white;
            border-radius: 15px;
            padding: 25px;
            min-height: 200px;
            z-index: 2;
          }

          .loading-container {
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 40px 20px;
            min-height: 200px;
          }

          .loading-box {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, rgba(31, 168, 220, 0.05) 0%, rgba(239, 74, 74, 0.05) 100%);
            border: 2px solid rgba(31, 168, 220, 0.2);
            border-radius: 16px;
            padding: 40px 30px;
            box-shadow: 0 8px 24px rgba(31, 168, 220, 0.15);
            max-width: 400px;
            width: 100%;
          }

          .spinner-wrapper {
            margin-bottom: 20px;
            position: relative;
          }

          .spinner {
            width: 60px;
            height: 60px;
            border: 5px solid rgba(31, 168, 220, 0.1);
            border-top: 5px solid #1FA8DC;
            border-right: 5px solid #ef4a4a;
            border-radius: 50%;
            animation: spin 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
            box-shadow: 0 0 20px rgba(31, 168, 220, 0.2);
          }

          .spinner::before {
            content: '';
            position: absolute;
            top: -5px;
            left: -5px;
            right: -5px;
            bottom: -5px;
            border: 3px solid transparent;
            border-top: 3px solid #1FA8DC;
            border-radius: 50%;
            animation: spin 0.8s linear infinite reverse;
          }

          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }

          .loading-text {
            text-align: center;
            background: linear-gradient(135deg, #1FA8DC 0%, #ef4a4a 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-size: 1.2rem;
            font-weight: 700;
            letter-spacing: 0.8px;
            animation: pulseText 2s ease-in-out infinite;
          }

          @keyframes pulseText {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.7;
            }
          }

          @media (max-width: 768px) {
            .subscription-card {
              padding: 20px;
              margin: 20px 0;
            }

            .subscription-card-content {
              padding: 20px;
              min-height: auto;
            }

            .loading-container {
              padding: 30px 15px;
            }

            .loading-box {
              padding: 30px 20px;
            }

            .spinner {
              width: 50px;
              height: 50px;
              border-width: 4px;
            }

            .spinner::before {
              border-width: 2px;
            }

            .loading-text {
              font-size: 1.1rem;
            }
          }

          @media (max-width: 480px) {
            .subscription-card {
              padding: 15px;
              margin: 15px 0;
              border-radius: 15px;
            }

            .subscription-card-content {
              padding: 15px;
              border-radius: 12px;
            }

            .loading-container {
              padding: 20px 10px;
            }

            .loading-box {
              padding: 25px 15px;
            }

            .spinner {
              width: 45px;
              height: 45px;
              border-width: 3px;
            }

            .loading-text {
              font-size: 1rem;
            }
          }
        `}</style>
      </>
    );
  }

  if (error) {
    const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Unknown error';
    const is403 = error.response?.status === 403;
    const is401 = error.response?.status === 401;
    
    return (
      <div className="subscription-card">
        <div className="subscription-card-content">
          <div className="error-text">
            {is403 ? (
              <>
                <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>Access Denied</div>
                <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                  This resource requires a developer role. If you recently had your role changed to developer, please log out and log back in to refresh your session.
                </div>
              </>
            ) : is401 ? (
              <>
                <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>Authentication Required</div>
                <div style={{ fontSize: '0.9rem', color: '#6c757d' }}>
                  Please log in to access this resource.
                </div>
              </>
            ) : (
              `Error loading subscription data: ${errorMessage}`
            )}
          </div>
        </div>
      </div>
    );
  }

  // Check if subscription is active - also check if expiration date hasn't passed
  const hasActiveSubscription = (() => {
    if (!displaySubscription?.active || !displaySubscription?.date_of_expiration) {
      return false;
    }
    
    // Double-check expiration date hasn't passed
    const now = new Date();
    const expiration = new Date(displaySubscription.date_of_expiration);
    if (now >= expiration) {
      return false;
    }
    
    return true;
  })();

  return (
    <div className="subscription-card">
      <div className="subscription-card-content">
        {hasActiveSubscription ? (
          <>
            <div className="subscription-field">
              <span className="field-label">Duration:</span>
              <span className="field-value">{displaySubscription.subscription_duration || 'N/A'}</span>
            </div>
            <div className="subscription-field">
              <span className="field-label">Date of Subscription:</span>
              <span className="field-value">
                {displaySubscription.date_of_subscription
                  ? new Date(displaySubscription.date_of_subscription).toLocaleString()
                  : 'N/A'}
              </span>
            </div>
            <div className="subscription-field">
              <span className="field-label">Date of Expiration:</span>
              <span className="field-value">
                {displaySubscription.date_of_expiration
                  ? new Date(displaySubscription.date_of_expiration).toLocaleString()
                  : 'N/A'}
              </span>
            </div>
            <div className="subscription-field">
              <span className="field-label">Cost:</span>
              <span className="field-value">
                {displaySubscription.cost !== null && displaySubscription.cost !== undefined
                  ? `${parseFloat(displaySubscription.cost).toFixed(2)} EGP`
                  : 'N/A'}
              </span>
            </div>
            {displaySubscription.note && (
              <div className="subscription-field">
                <span className="field-label">Note:</span>
                <span className="field-value">{displaySubscription.note}</span>
              </div>
            )}
            {timeRemaining && (
              <div className="subscription-timer">
                <div className="timer-label">Time Remaining:</div>
                <div className="timer-value">
                  <span style={{ color: '#1FA8DC' }}>{String(timeRemaining.days).padStart(2, '0')}</span>
                  <span style={{ color: '#ef4a4a' }}> days : </span>
                  <span style={{ color: '#1FA8DC' }}>{String(timeRemaining.hours).padStart(2, '0')}</span>
                  <span style={{ color: '#ef4a4a' }}> hours : </span>
                  <span style={{ color: '#1FA8DC' }}>{String(timeRemaining.minutes).padStart(2, '0')}</span>
                  <span style={{ color: '#ef4a4a' }}> min : </span>
                  <span style={{ color: '#1FA8DC' }}>{String(timeRemaining.seconds).padStart(2, '0')}</span>
                  <span style={{ color: '#ef4a4a' }}> sec</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="no-subscription">
            <div className="no-subscription-text">No subscription yet!</div>
          </div>
        )}
      </div>
      <style jsx>{`
        .subscription-card {
          position: relative;
          background: white;
          border-radius: 20px;
          padding: 6px;
          box-shadow: 0 10px 40px rgba(31, 168, 220, 0.3);
          margin: 30px 0;
          overflow: hidden;
        }

        .subscription-card::before {
          content: '';
          position: absolute;
          top: -150%;
          left: -150%;
          width: 400%;
          height: 400%;
          background: conic-gradient(
            from 0deg,
            #1FA8DC 0deg 80deg,
            transparent 80deg 180deg,
            #ef4a4a 180deg 260deg,
            transparent 260deg 360deg
          );
          animation: rotateGradient 6s linear infinite;
          z-index: 0;
        }

        .subscription-card::after {
          content: '';
          position: absolute;
          top: 6px;
          left: 6px;
          right: 6px;
          bottom: 6px;
          background: white;
          border-radius: 14px;
          z-index: 1;
        }

        @keyframes rotateGradient {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .subscription-card-content {
          position: relative;
          background: white;
          border-radius: 15px;
          padding: 25px;
          min-height: 200px;
          z-index: 2;
        }

        .subscription-field {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 0;
          border-bottom: 1px solid #e9ecef;
        }

        .subscription-field:last-of-type {
          border-bottom: none;
        }

        .field-label {
          font-weight: 700;
          color: #495057;
          font-size: 1rem;
        }

        .field-value {
          color: #1FA8DC;
          font-weight: 600;
          font-size: 1rem;
        }

        .subscription-timer {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 2px solid #e9ecef;
          text-align: center;
        }

        .timer-label {
          font-weight: 700;
          color: #495057;
          font-size: 1.1rem;
          margin-bottom: 10px;
        }

        .timer-value {
          font-size: 1.5rem;
          font-weight: 800;
          font-family: 'Courier New', monospace;
          letter-spacing: 2px;
        }

        .no-subscription {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 150px;
        }

        .no-subscription-text {
          font-size: 1.3rem;
          font-weight: 600;
          color: #6c757d;
          text-align: center;
          padding: 20px;
        }

        .loading-container {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          min-height: 200px;
        }

        .loading-box {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, rgba(31, 168, 220, 0.05) 0%, rgba(239, 74, 74, 0.05) 100%);
          border: 2px solid rgba(31, 168, 220, 0.2);
          border-radius: 16px;
          padding: 40px 30px;
          box-shadow: 0 8px 24px rgba(31, 168, 220, 0.15);
          max-width: 400px;
          width: 100%;
        }

        .spinner-wrapper {
          margin-bottom: 20px;
          position: relative;
        }

        .spinner {
          width: 60px;
          height: 60px;
          border: 5px solid rgba(31, 168, 220, 0.1);
          border-top: 5px solid #1FA8DC;
          border-right: 5px solid #ef4a4a;
          border-radius: 50%;
          animation: spin 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
          box-shadow: 0 0 20px rgba(31, 168, 220, 0.2);
        }

        .spinner::before {
          content: '';
          position: absolute;
          top: -5px;
          left: -5px;
          right: -5px;
          bottom: -5px;
          border: 3px solid transparent;
          border-top: 3px solid #1FA8DC;
          border-radius: 50%;
          animation: spin 0.8s linear infinite reverse;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .loading-text {
          text-align: center;
          background: linear-gradient(135deg, #1FA8DC 0%, #ef4a4a 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          font-size: 1.2rem;
          font-weight: 700;
          letter-spacing: 0.8px;
          animation: pulseText 2s ease-in-out infinite;
        }

        @keyframes pulseText {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }

        .error-text {
          text-align: center;
          color: #dc3545;
          font-size: 1.1rem;
          padding: 40px 0;
          font-weight: 600;
        }

        @media (max-width: 768px) {
          .subscription-card {
            padding: 20px;
            margin: 20px 0;
          }

          .subscription-card-content {
            padding: 20px;
            min-height: auto;
          }

          .subscription-field {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
            padding: 10px 0;
          }

          .field-label,
          .field-value {
            font-size: 0.9rem;
          }

          .timer-value {
            font-size: 1.2rem;
            letter-spacing: 1px;
          }

          .no-subscription-text {
            font-size: 1.2rem;
            padding: 15px;
          }

          .loading-container {
            padding: 30px 15px;
          }

          .loading-box {
            padding: 30px 20px;
          }

          .spinner {
            width: 50px;
            height: 50px;
            border-width: 4px;
          }

          .spinner::before {
            border-width: 2px;
          }

          .loading-text {
            font-size: 1.1rem;
          }
        }

        @media (max-width: 480px) {
          .subscription-card {
            padding: 15px;
            margin: 15px 0;
            border-radius: 15px;
          }

          .subscription-card-content {
            padding: 15px;
            border-radius: 12px;
          }

          .subscription-field {
            padding: 8px 0;
          }

          .field-label {
            font-size: 0.85rem;
          }

          .field-value {
            font-size: 0.85rem;
            word-break: break-word;
          }

          .timer-label {
            font-size: 1rem;
          }

          .timer-value {
            font-size: 1rem;
            letter-spacing: 0.5px;
          }

          .no-subscription-text {
            font-size: 1.1rem;
            padding: 12px;
          }

          .loading-container {
            padding: 25px 10px;
            min-height: 150px;
          }

          .loading-box {
            padding: 25px 15px;
          }

          .spinner {
            width: 45px;
            height: 45px;
            border-width: 4px;
          }

          .spinner::before {
            border-width: 2px;
          }

          .loading-text {
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
