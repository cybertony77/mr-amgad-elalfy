import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell
} from "recharts";

export default function QuizAnalyticsChart({ analyticsData }) {
  const data = useMemo(() => {
    if (!analyticsData) {
      return [];
    }

    return [
      {
        name: 'Not Answered',
        count: analyticsData.notAnswered || 0,
        color: '#a71e2a', // Dark red
        totalStudents: analyticsData.totalStudents || 0,
        studentIds: analyticsData.notAnsweredIds || []
      },
      {
        name: '< 50%',
        count: analyticsData.lessThan50 || 0,
        color: '#dc3545', // Red
        totalStudents: analyticsData.totalStudents || 0,
        studentIds: analyticsData.lessThan50Ids || []
      },
      {
        name: '50-99%',
        count: analyticsData.between50And100 || 0,
        color: '#17a2b8', // Blue
        totalStudents: analyticsData.totalStudents || 0,
        studentIds: analyticsData.between50And100Ids || []
      },
      {
        name: '100%',
        count: analyticsData.exactly100 || 0,
        color: '#28a745', // Green
        totalStudents: analyticsData.totalStudents || 0,
        studentIds: analyticsData.exactly100Ids || []
      }
    ];
  }, [analyticsData]);

  if (!analyticsData || data.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: '#6c757d',
        fontSize: '1.1rem',
        fontWeight: '500',
        background: '#f8f9fa',
        borderRadius: '8px',
        border: '1px solid #dee2e6'
      }}>
        📊 No analytics data available
      </div>
    );
  }

  // Find max value for Y-axis domain
  const maxCount = Math.max(
    analyticsData.notAnswered || 0,
    analyticsData.lessThan50 || 0,
    analyticsData.between50And100 || 0,
    analyticsData.exactly100 || 0,
    1 // At least 1 to show axis
  );

  return (
    <>
      <div className="analytics-chart-container" style={{ width: '100%', height: 400 }}>
        <ResponsiveContainer>
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e9ecef" />
            <XAxis
              dataKey="name"
              stroke="#6c757d"
              fontSize={12}
              tick={{ fill: '#495057', fontSize: 14 }}
              angle={-20}
              textAnchor="end"
              height={80}
            />
            <YAxis
              domain={[0, maxCount]}
              tick={{ fill: '#495057', fontSize: 14 }}
              stroke="#6c757d"
              label={{ value: 'Number of Students', angle: -90, position: 'insideLeft', offset: -5, style: { textAnchor: 'middle' } }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #dee2e6',
                borderRadius: '8px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontSize: '0.875rem'
              }}
              labelStyle={{ display: 'none' }}
              formatter={(value, name, props) => {
                const barName = props.payload.name;
                const count = value;
                const totalStudents = props.payload.totalStudents || 0;
                const percentage = totalStudents > 0 ? ((count / totalStudents) * 100).toFixed(1) : '0.0';
                const studentIds = props.payload.studentIds || [];
                
                // Format student IDs
                let idsDisplay = null;
                if (count > 0 && studentIds.length > 0) {
                  if (count <= 5) {
                    idsDisplay = `IDs: ${studentIds.join(', ')}`;
                  } else {
                    const firstFive = studentIds.slice(0, 5);
                    idsDisplay = `The First 5 IDs: ${firstFive.join(', ')}`;
                  }
                }
                
                return [
                  <div key="tooltip" style={{ color: '#000000' }}>
                    <div><strong style={{ color: '#000000' }}>Category:</strong> {barName}</div>
                    <div><strong style={{ color: '#000000' }}>Students No. :</strong> {count}</div>
                    <div><strong style={{ color: '#000000' }}>Percentage:</strong> {percentage}%</div>
                    {idsDisplay && (
                      <div><strong style={{ color: '#000000' }}>{idsDisplay}</strong></div>
                    )}
                  </div>
                ];
              }}
            />
            <Bar
              dataKey="count"
              radius={[6, 6, 0, 0]}
              maxBarSize={80}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <style jsx global>{`
        @media (max-width: 768px) {
          .analytics-chart-container {
            height: 350px !important;
            margin: 0 -10px !important;
          }
          .analytics-chart-container .recharts-cartesian-axis-tick text {
            font-size: 11px !important;
          }
          .analytics-chart-container .recharts-label {
            font-size: 11px !important;
          }
          .analytics-chart-container .recharts-bar {
            max-width: 60px !important;
          }
        }
        
        @media (max-width: 480px) {
          .analytics-chart-container {
            height: 300px !important;
            margin: 0 -5px !important;
          }
          .analytics-chart-container .recharts-cartesian-axis-tick text {
            font-size: 10px !important;
          }
          .analytics-chart-container .recharts-label {
            font-size: 10px !important;
          }
          .analytics-chart-container .recharts-bar {
            max-width: 50px !important;
          }
          .analytics-chart-container .recharts-cartesian-axis {
            font-size: 9px !important;
          }
        }
        
        @media (max-width: 360px) {
          .analytics-chart-container {
            height: 280px !important;
            margin: 0 -5px !important;
          }
          .analytics-chart-container .recharts-cartesian-axis-tick text {
            font-size: 9px !important;
          }
          .analytics-chart-container .recharts-label {
            font-size: 9px !important;
          }
          .analytics-chart-container .recharts-bar {
            max-width: 40px !important;
          }
          .analytics-chart-container .recharts-cartesian-axis {
            font-size: 8px !important;
          }
        }
      `}</style>
    </>
  );
}

