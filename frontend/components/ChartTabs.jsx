import { useState } from "react";
import { useRouter } from "next/router";
import { useQuery } from '@tanstack/react-query';
import apiClient from '../lib/axios';
import { useProfile } from '../lib/api/auth';
import HomeworkPerformanceChart from "./HomeworkPerformanceChart";
import QuizPerformanceChart from "./QuizPerformanceChart";

export default function ChartTabs({ studentId, hasAuthToken = true }) {
  const router = useRouter();
  const [active, setActive] = useState('homeworks'); // Default to homeworks tab

  return (
    <div className="chart-tabs-wrapper" style={{ marginTop: 24 }}>
      <div className="chart-tabs-buttons" style={{ display: 'flex', gap: 0, marginBottom: 12 }}>
        <button
          onClick={() => setActive('homeworks')}
          className="chart-tab-button"
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '8px 0 0 0',
            border: active === 'homeworks' ? '2px solid #1FA8DC' : '1px solid #dee2e6',
            background: active === 'homeworks' ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' : 'white',
            color: active === 'homeworks' ? '#1FA8DC' : '#6c757d',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '1rem',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (active !== 'homeworks') {
              e.target.style.background = '#f8f9fa';
            }
          }}
          onMouseLeave={(e) => {
            if (active !== 'homeworks') {
              e.target.style.background = 'white';
            }
          }}
        >
          Homeworks
        </button>
        <button
          onClick={() => setActive('quizzes')}
          className="chart-tab-button"
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '0 8px 8px 0',
            border: active === 'quizzes' ? '2px solid #1FA8DC' : '1px solid #dee2e6',
            background: active === 'quizzes' ? 'linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%)' : 'white',
            color: active === 'quizzes' ? '#1FA8DC' : '#6c757d',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: '1rem',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (active !== 'quizzes') {
              e.target.style.background = '#f8f9fa';
            }
          }}
          onMouseLeave={(e) => {
            if (active !== 'quizzes') {
              e.target.style.background = 'white';
            }
          }}
        >
          Quizzes
        </button>
      </div>

      <div className="chart-tabs-content" style={{ background: 'white', border: '1px solid #dee2e6', borderRadius: 12, padding: 20 }}>
        {active === 'homeworks' ? (
          <ChartContent type="homeworks" studentId={studentId} hasAuthToken={hasAuthToken} />
        ) : (
          <ChartContent type="quizzes" studentId={studentId} hasAuthToken={hasAuthToken} />
        )}
      </div>
      <style jsx>{`
        @media (max-width: 768px) {
          .chart-tabs-wrapper {
            margin-top: 16px !important;
          }
          .chart-tabs-buttons {
            gap: 0 !important;
          }
          .chart-tab-button {
            padding: 10px 12px !important;
            font-size: 0.9rem !important;
          }
          .chart-tabs-content {
            padding: 16px !important;
            border-radius: 8px !important;
          }
        }
        
        @media (max-width: 480px) {
          .chart-tabs-wrapper {
            margin-top: 12px !important;
          }
          .chart-tab-button {
            padding: 8px 10px !important;
            font-size: 0.85rem !important;
          }
          .chart-tabs-content {
            padding: 12px !important;
            border-radius: 8px !important;
          }
        }
        
        @media (max-width: 360px) {
          .chart-tab-button {
            padding: 8px 8px !important;
            font-size: 0.8rem !important;
          }
          .chart-tabs-content {
            padding: 10px !important;
          }
        }
      `}</style>
    </div>
  );
}

// Separate component to handle data fetching and chart rendering
function ChartContent({ type, studentId, hasAuthToken }) {
  const router = useRouter();
  
  // Get student ID - prefer passed studentId prop, fallback to profile ID if authenticated
  const { data: profile } = hasAuthToken ? useProfile() : { data: null };
  const targetStudentId = studentId || (hasAuthToken ? profile?.id : null);
  
  // Get signature from URL query params for public access
  const signature = router.isReady ? (router.query?.sig || null) : null;

  // Fetch performance chart data
  const { data: performanceData, isLoading: isChartLoading } = useQuery({
    queryKey: [`${type}-performance`, targetStudentId, signature],
    queryFn: async () => {
      if (!targetStudentId) return { chartData: [] };
      try {
        let endpoint = type === 'homeworks' 
          ? `/api/students/${targetStudentId}/homework-performance`
          : `/api/students/${targetStudentId}/quiz-performance`;
        
        // Add signature to query params if it's public access
        if (!hasAuthToken && signature) {
          endpoint += `?sig=${signature}`;
        }
        
        const response = await apiClient.get(endpoint);
        return response.data || { chartData: [] };
      } catch (error) {
        console.error(`Error fetching ${type} performance:`, error);
        return { chartData: [] };
      }
    },
    enabled: !!targetStudentId && router.isReady && (hasAuthToken || !!signature),
    refetchInterval: 10 * 60 * 1000, // Auto-refresh every 10 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    retry: 1,
  });

  const chartData = performanceData?.chartData || [];

  if (isChartLoading) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: '#6c757d',
        fontSize: '1.1rem',
        fontWeight: '500'
      }}>
        Loading chart data...
      </div>
    );
  }

  if (type === 'homeworks') {
    return <HomeworkPerformanceChart chartData={chartData} height={400} />;
  } else {
    return <QuizPerformanceChart chartData={chartData} height={400} />;
  }
}

