import { useRouter } from 'next/router';
import Image from 'next/image';
import Title from '../../components/Title';
import SubscriptionCard from '../../components/SubscriptionCard';

export default function SubscriptionDashboard() {
  const router = useRouter();

  return (
    <div style={{ 
      minHeight: '100vh', 
      padding: '20px'
    }}>
      <div className="page-container">
        <Title backText="Back" href="/dashboard">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/dollar.svg" alt="Subscription" width={32} height={32} />
            Subscription Dashboard
          </div>
        </Title>

        <div className="subscription-buttons">
          <button
            className="subscription-btn"
            onClick={() => router.push('/subscription_dashboard/yearly')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Image src="/calendar.svg" alt="Yearly" width={20} height={20} />
            Yearly Subscription
          </button>
          <button
            className="subscription-btn"
            onClick={() => router.push('/subscription_dashboard/monthly')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Image src="/calendar3.svg" alt="Monthly" width={20} height={20} />
            Monthly Subscription
          </button>
          <button
            className="subscription-btn"
            onClick={() => router.push('/subscription_dashboard/daily')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Image src="/notes5.svg" alt="Daily" width={20} height={20} />
            Daily Subscription
          </button>
          <button
            className="subscription-btn"
            onClick={() => router.push('/subscription_dashboard/hourly')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Image src="/clock2.svg" alt="Hourly" width={20} height={20} />
            Hourly Subscription
          </button>
          <button
            className="subscription-btn"
            onClick={() => router.push('/subscription_dashboard/minutely')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Image src="/timer.svg" alt="Minutely" width={20} height={20} />
            Minutely Subscription
          </button>
          <button
            className="subscription-btn cancel-btn"
            onClick={() => router.push('/subscription_dashboard/cancel')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Image src="/cross-circle.svg" alt="Cancel" width={25} height={25} />
            Cancel Subscription
          </button>
        </div>

        <SubscriptionCard />

        <style jsx>{`
          .page-container {
            max-width: 800px;
            margin: 40px auto;
            padding: 12px;
          }

          .subscription-buttons {
            display: flex;
            flex-direction: column;
            gap: 16px;
            margin-top: 30px;
          }

          .subscription-btn {
            width: 100%;
            padding: 18px 24px;
            background: linear-gradient(90deg, #1FA8DC 0%, #87CEEB 100%);
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 1.2rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(31, 168, 220, 0.3);
          }

          .subscription-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(31, 168, 220, 0.4);
          }

          .subscription-btn:active {
            transform: translateY(-1px);
          }

          .cancel-btn {
            background: linear-gradient(90deg, #dc3545 0%, #ff6b6b 100%);
            box-shadow: 0 4px 16px rgba(220, 53, 69, 0.3);
          }

          .cancel-btn:hover {
            box-shadow: 0 8px 25px rgba(220, 53, 69, 0.4);
          }

          @media (max-width: 768px) {
            .page-container {
              margin: 20px auto;
              padding: 8px;
            }

            .subscription-btn {
              padding: 16px 20px;
              font-size: 1.1rem;
            }
          }

          @media (max-width: 480px) {
            .page-container {
              margin: 15px auto;
              padding: 5px;
            }

            .subscription-buttons {
              gap: 12px;
              margin-top: 20px;
            }

            .subscription-btn {
              padding: 14px 18px;
              font-size: 1rem;
              border-radius: 10px;
            }
          }

          @media (max-width: 360px) {
            .subscription-btn {
              padding: 12px 16px;
              font-size: 0.95rem;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
