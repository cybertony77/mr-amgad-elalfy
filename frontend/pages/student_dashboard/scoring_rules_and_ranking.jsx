import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useQuery } from '@tanstack/react-query';
import { useProfile } from '../../lib/api/auth';
import { useStudent } from '../../lib/api/students';
import { useSystemConfig } from '../../lib/api/system';
import apiClient from '../../lib/axios';
import Title from '../../components/Title';
import NeedHelp from '../../components/NeedHelp';
import Image from 'next/image';
import LoadingSkeleton from '../../components/LoadingSkeleton';

export default function ScoringRulesAndRanking() {
  const router = useRouter();
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: systemConfig } = useSystemConfig();
  const isScoringEnabled = systemConfig?.scoring_system === true || systemConfig?.scoring_system === 'true';
  const isHomeworksEnabled = systemConfig?.homeworks === true || systemConfig?.homeworks === 'true';
  const isQuizzesEnabled = systemConfig?.quizzes === true || systemConfig?.quizzes === 'true';
  
  // Get student ID from profile and fetch student data
  const studentId = profile?.id ? profile.id.toString() : null;
  const { data: studentData, isLoading: studentLoading } = useStudent(studentId, { 
    enabled: !!studentId,
    refetchInterval: false, // Disabled to prevent auto-refresh - use manual refetch if needed
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false, // Disabled to prevent auto-refresh on window focus
  });

  // Fetch student rankings
  const { data: rankingsData, isLoading: rankingsLoading } = useQuery({
    queryKey: ['student-rankings', studentId],
    queryFn: async () => {
      if (!studentId) return null;
      
      try {
        const response = await apiClient.get('/api/scoring/student-rankings');
        return response.data;
      } catch (error) {
        console.error('Error fetching rankings:', error);
        return {
          centerRank: null,
          centerTotal: null,
          gradeRank: null,
          gradeTotal: null
        };
      }
    },
    enabled: !!studentId && isScoringEnabled,
    refetchInterval: 60000, // Auto-refetch every 1 minute (60,000 ms)
    refetchIntervalInBackground: true, // Continue refetching even when tab is in background
  });

  // Fetch scoring conditions (rules and bonus)
  const { data: conditionsData, isLoading: conditionsLoading } = useQuery({
    queryKey: ['scoring-conditions-public'],
    queryFn: async () => {
      const response = await apiClient.get('/api/scoring/conditions-public');
      return response.data;
    },
    enabled: isScoringEnabled,
  });

  const conditions = conditionsData?.conditions || [];

  const getConditionLabel = (condition) => {
    if (condition.type === 'attendance') {
      return 'Attendance';
    } else if (condition.type === 'homework' && condition.withDegree === true) {
      return 'Homework (with degree)';
    } else if (condition.type === 'homework' && condition.withDegree === false) {
      return 'Homework (without degree)';
    } else if (condition.type === 'quiz') {
      return 'Quiz';
    }
    return condition.type;
  };

  const isLoading = profileLoading || studentLoading || (isScoringEnabled && (rankingsLoading || conditionsLoading));

  // Redirect if scoring system is disabled
  useEffect(() => {
    if (!profileLoading && !systemConfig && isScoringEnabled === false) {
      router.push('/student_dashboard');
    }
  }, [profileLoading, systemConfig, isScoringEnabled, router]);

  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        padding: "20px 5px 20px 5px"
      }}>
        <div style={{ maxWidth: 800, margin: "40px auto", padding: "12px" }}>
          <Title backText="Back" href="/student_dashboard">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Image src="/stars.svg" alt="Scoring Rules and Ranking" width={32} height={32} />
              Scoring Rules and Ranking
            </div>
          </Title>
          <LoadingSkeleton type="table" rows={8} columns={1} />
        </div>
      </div>
    );
  }

  if (!isScoringEnabled) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <Title backText="Back" href="/student_dashboard">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/stars.svg" alt="Scoring Rules and Ranking" width={32} height={32} />
            Scoring Rules and Ranking
          </div>
        </Title>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '40px',
          marginTop: '20px',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}>
          <p style={{ color: '#6c757d', fontSize: '1.1rem' }}>
            Scoring system is currently disabled.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: "100vh", 
      padding: "20px 5px 20px 5px" 
    }}>
      <div style={{ maxWidth: 800, margin: "40px auto", padding: "12px" }}>
        <Title backText="Back" href="/student_dashboard">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Image src="/stars.svg" alt="Scoring Rules and Ranking" width={32} height={32} />
            Scoring Rules and Ranking
          </div>
        </Title>

        <style jsx>{`
          .score-display-card {
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 249, 250, 0.95) 100%);
            border-radius: 16px;
            padding: 32px;
            margin-bottom: 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
            border: 2px solid rgba(31, 168, 220, 0.2);
            text-align: center;
          }
          .score-label {
            font-size: 0.9rem;
            color: #6c757d;
            font-weight: 600;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
          }
          .score-value {
            font-size: 4rem;
            font-weight: 700;
            background: linear-gradient(135deg, #1FA8DC 0%, #87CEEB 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            line-height: 1;
            margin-bottom: 8px;
          }
          .rankings-container {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 24px;
          }
          .ranking-card {
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 249, 250, 0.95) 100%);
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(31, 168, 220, 0.2);
            text-align: center;
          }
          .ranking-label {
            font-size: 0.85rem;
            color: #6c757d;
            font-weight: 600;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .ranking-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #1FA8DC;
            line-height: 1.2;
          }
          .rules-container {
            background: linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 249, 250, 0.95) 100%);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
            border: 2px solid rgba(31, 168, 220, 0.2);
          }
          .rules-title {
            font-size: 1.5rem;
            font-weight: 700;
            color: #495057;
            margin-bottom: 20px;
            text-align: center;
            padding-bottom: 12px;
            border-bottom: 2px solid #e9ecef;
          }
          .condition-card {
            background: white;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            border: 1px solid #e9ecef;
            border-left: 4px solid #1FA8DC;
          }
          .condition-title {
            font-size: 1.25rem;
            font-weight: 700;
            color: #1FA8DC;
            margin-bottom: 16px;
          }
          .rules-section {
            margin-bottom: 16px;
          }
          .rules-section-label {
            font-size: 0.95rem;
            font-weight: 600;
            color: #495057;
            margin-bottom: 12px;
          }
          .rule-item {
            padding: 12px;
            background: #f8f9fa;
            border-radius: 8px;
            margin-bottom: 8px;
            font-size: 0.9rem;
            border-left: 3px solid #1FA8DC;
          }
          .bonus-item {
            padding: 12px;
            background: #28a745;
            color: white;
            border-radius: 8px;
            margin-bottom: 8px;
            font-size: 0.9rem;
            font-weight: 500;
          }
          @media (max-width: 768px) {
            .rankings-container {
              grid-template-columns: 1fr;
            }
            .score-display-card {
              padding: 24px;
            }
            .score-value {
              font-size: 3rem;
            }
            .rules-container {
              padding: 20px;
            }
          }
          @media (max-width: 480px) {
            .score-display-card {
              padding: 20px;
            }
            .score-value {
              font-size: 2.5rem;
            }
            .ranking-card {
              padding: 16px;
            }
            .ranking-value {
              font-size: 1.2rem;
            }
            .ranking-label {
              font-size: 0.75rem;
            }
            .rules-container {
              padding: 16px;
            }
            .condition-card {
              padding: 16px;
            }
            .condition-title {
              font-size: 1.1rem;
            }
            .rules-title {
              font-size: 1.25rem;
            }
            .rule-item {
              padding: 10px;
              font-size: 0.85rem;
            }
            .bonus-item {
              padding: 10px;
              font-size: 0.85rem;
            }
          }
          @media (max-width: 360px) {
            .score-display-card {
              padding: 16px;
            }
            .score-label {
              font-size: 0.8rem;
            }
            .score-value {
              font-size: 2rem;
            }
            .ranking-card {
              padding: 12px;
            }
            .ranking-label {
              font-size: 0.7rem;
            }
            .ranking-value {
              font-size: 1rem;
            }
            .rules-container {
              padding: 12px;
            }
            .rules-title {
              font-size: 1.1rem;
              padding-bottom: 8px;
              margin-bottom: 16px;
            }
            .condition-card {
              padding: 12px;
              margin-bottom: 16px;
            }
            .condition-title {
              font-size: 1rem;
              margin-bottom: 12px;
            }
            .rules-section {
              margin-bottom: 12px;
            }
            .rules-section-label {
              font-size: 0.9rem;
              margin-bottom: 8px;
            }
            .rule-item {
              padding: 8px;
              font-size: 0.8rem;
              margin-bottom: 6px;
            }
            .bonus-item {
              padding: 8px;
              font-size: 0.8rem;
              margin-bottom: 6px;
            }
          }
        `}</style>

        {/* Score Display */}
        <div className="score-display-card">
          <div className="score-label">Your Current Score</div>
          <div className="score-value">
            {studentData?.score !== null && studentData?.score !== undefined ? studentData.score : 0}
          </div>
          <div style={{
            fontSize: "0.9rem",
            color: "#6c757d",
            fontWeight: "500",
            textAlign: "center",
            marginTop: "8px"
          }}>
            Nice progress, keep going! 🚀✨
          </div>
        </div>

        {/* Rankings */}
        <div className="rankings-container">
          <div className="ranking-card">
            <div className="ranking-label">rank / {rankingsData?.mainCenter || 'Main Center'}</div>
            <div className="ranking-value">
              {rankingsData?.centerRank !== null && rankingsData?.centerRank !== undefined
                ? rankingsData.centerRank
                : '-'}
            </div>
          </div>
          <div className="ranking-card">
            <div className="ranking-label">rank / {rankingsData?.grade || 'Grade'}</div>
            <div className="ranking-value">
              {rankingsData?.gradeRank !== null && rankingsData?.gradeRank !== undefined
                ? rankingsData.gradeRank
                : '-'}
            </div>
          </div>
        </div>

        {/* Scoring Rules */}
        <div className="rules-container">
          <div className="rules-title">Scoring Rules</div>
          
          {conditions.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#6c757d', padding: '20px' }}>
              No scoring rules available.
            </div>
          ) : (
            conditions.map((condition) => (
              <div key={condition._id?.toString() || Math.random()} className="condition-card">
                <div className="condition-title">
                  {getConditionLabel(condition)}
                </div>

                {/* Rules Section */}
                {condition.rules && condition.rules.length > 0 && (
                  <div className="rules-section">
                    <div className="rules-section-label">Rules:</div>
                    {condition.rules.map((rule, idx) => (
                      <div key={idx} className="rule-item">
                        {condition.type === 'attendance' && (
                          <span>
                            Status: <strong style={{ color: '#1FA8DC' }}>{rule.key}</strong> → <strong>{rule.points >= 0 ? '+' : ''}{rule.points}</strong> points
                          </span>
                        )}
                        {(condition.type === 'homework' && condition.withDegree === true) || condition.type === 'quiz' ? (
                          <span>
                            Range: <strong style={{ color: '#1FA8DC' }}>{rule.min}% - {rule.max}%</strong> → <strong>{rule.points >= 0 ? '+' : ''}{rule.points}</strong> points
                          </span>
                        ) : condition.type === 'homework' && condition.withDegree === false ? (
                          <span>
                            Homework : <strong style={{ color: '#1FA8DC' }}>
                              {rule.hwDone === true ? 'Done' : rule.hwDone === false ? 'Not Done' : rule.hwDone === 'Not Completed' ? 'Not Completed' : String(rule.hwDone)}
                            </strong> → <strong>{rule.points >= 0 ? '+' : ''}{rule.points}</strong> points
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {/* Bonus Rules Section */}
                {condition.bonusRules && condition.bonusRules.length > 0 && (
                  <div className="rules-section">
                    <div className="rules-section-label">Bonus Rules:</div>
                    {condition.bonusRules.map((bonus, idx) => (
                      <div key={idx} className="bonus-item">
                        {condition.type === 'attendance' ? (
                          <span>
                            {bonus.condition.lastN} consecutive <strong>{bonus.condition.key}</strong> → <strong>+{bonus.points} points</strong>
                          </span>
                        ) : (condition.type === 'homework' && condition.withDegree === false) ? (
                          <span>
                            {bonus.condition.lastN} consecutive <strong>
                              {bonus.condition.hwDone === true ? 'Done' : bonus.condition.hwDone === false ? 'Not Done' : bonus.condition.hwDone === 'Not Completed' ? 'Not Completed' : String(bonus.condition.hwDone)}
                            </strong> → <strong>+{bonus.points} points</strong>
                          </span>
                        ) : (
                          <span>
                            {bonus.condition.lastN} constant weeks with degree <strong>{bonus.condition.percentage}%</strong> → <strong>+{bonus.points} points</strong>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}

          {/* NeedHelp Component */}
          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '2px solid #e9ecef' }}>
            <NeedHelp />
          </div>
        </div>
      </div>
    </div>
  );
}
