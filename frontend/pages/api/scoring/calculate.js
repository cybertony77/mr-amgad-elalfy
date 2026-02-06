import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { ZenEngine } from '@gorules/zen-engine';
import { authMiddleware } from '../../../lib/authMiddleware';

function loadEnvConfig() {
  try {
    const envPath = path.join(process.cwd(), '..', 'env.config');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const index = trimmed.indexOf('=');
        if (index !== -1) {
          const key = trimmed.substring(0, index).trim();
          let value = trimmed.substring(index + 1).trim();
          value = value.replace(/^"|"$/g, '');
          envVars[key] = value;
        }
      }
    });
    
    return envVars;
  } catch (error) {
    console.log('⚠️  Could not read env.config, using process.env as fallback');
    return {};
  }
}

const envConfig = loadEnvConfig();
const MONGO_URI = envConfig.MONGO_URI || process.env.MONGO_URI;
const DB_NAME = envConfig.DB_NAME || process.env.DB_NAME;
const SYSTEM_SCORING_SYSTEM = envConfig.SYSTEM_SCORING_SYSTEM === 'true' || process.env.SYSTEM_SCORING_SYSTEM === 'true';

// Initialize ZEN Engine
const engine = new ZenEngine();

// Convert scoring condition to ZEN Engine rule format
function convertConditionToZenRule(condition) {
  const { type, withDegree, rules, bonusRules } = condition;
  
  // Build decision table based on type
  let decisions = [];
  
  if (type === 'attendance') {
    // Attendance rules: match by key (status)
    decisions = rules.map(rule => ({
      key: rule.key,
      result: {
        points: rule.points
      }
    }));
  } else if (type === 'homework' && withDegree === true) {
    // Homework with degree: match by percentage range
    decisions = rules.map(rule => ({
      key: `range_${rule.min}_${rule.max}`,
      result: {
        points: rule.points,
        min: rule.min,
        max: rule.max
      }
    }));
  } else if (type === 'homework' && withDegree === false) {
    // Homework without degree: match by hwDone value
    decisions = rules.map(rule => ({
      key: `hwDone_${String(rule.hwDone)}`,
      result: {
        points: rule.points,
        hwDone: rule.hwDone
      }
    }));
  } else if (type === 'quiz') {
    // Quiz rules: match by percentage range
    decisions = rules.map(rule => ({
      key: `range_${rule.min}_${rule.max}`,
      result: {
        points: rule.points,
        min: rule.min,
        max: rule.max
      }
    }));
  }
  
  return {
    key: `${type}_${withDegree !== undefined ? withDegree : 'default'}`,
    name: `Scoring Rule for ${type}${withDegree !== undefined ? ` (${withDegree ? 'with' : 'without'} degree)` : ''}`,
    decisions: decisions,
    bonusRules: bonusRules || []
  };
}

// Evaluate rule using ZEN Engine
async function evaluateRule(zenRule, input) {
  try {
    // Create a simple decision table rule for ZEN Engine
    const ruleContent = {
      key: zenRule.key,
      name: zenRule.name,
      input: {
        type: 'string',
        default: ''
      },
      output: {
        type: 'number',
        default: 0
      },
      decisions: zenRule.decisions.map(decision => ({
        key: decision.key,
        conditions: [
          {
            all: [
              {
                fact: 'input',
                operator: 'equal',
                value: decision.key
              }
            ]
          }
        ],
        event: {
          type: 'set',
          params: {
            points: decision.result.points
          }
        }
      }))
    };
    
    // For range-based rules, we need custom evaluation
    if (zenRule.decisions[0]?.result?.min !== undefined) {
      // Range-based evaluation (homework with degree, quiz)
      const { percentage } = input;
      if (percentage !== undefined && percentage !== null) {
        const matchingDecision = zenRule.decisions.find(d => {
          const { min, max } = d.result;
          return percentage >= min && percentage <= max;
        });
        return matchingDecision ? matchingDecision.result.points : 0;
      }
      return 0;
    } else if (zenRule.decisions[0]?.result?.hwDone !== undefined) {
      // Homework without degree evaluation
      const { hwDone } = input;
      if (hwDone !== undefined && hwDone !== null) {
        const matchingDecision = zenRule.decisions.find(d => {
          const ruleHwDone = d.result.hwDone;
          if (ruleHwDone === hwDone) return true;
          return String(ruleHwDone) === String(hwDone);
        });
        return matchingDecision ? matchingDecision.result.points : 0;
      }
      return 0;
    } else {
      // Key-based evaluation (attendance)
      const { status } = input;
      if (status) {
        const matchingDecision = zenRule.decisions.find(d => d.key === status);
        return matchingDecision ? matchingDecision.result.points : 0;
      }
      return 0;
    }
  } catch (error) {
    console.error('Error evaluating ZEN rule:', error);
    return 0;
  }
}

// Calculate bonus points for streaks (keeps existing logic)
function calculateBonusPoints(condition, student, type, currentWeek = null) {
  let bonusPoints = 0;
  const bonusWeeks = []; // Track which weeks are involved in bonuses
  
  if (!condition.bonusRules || condition.bonusRules.length === 0) {
    return { bonusPoints: 0, bonusWeeks: [] };
  }
  
  const weeks = student.weeks || [];
  const weekPercentageMap = new Map();
  
  if (type === 'homework' && condition.withDegree === true) {
    const onlineHomeworks = student.online_homeworks || [];
    
    // Get percentages from weeks.hwDegree
    weeks.forEach(w => {
      if (w.week && w.hwDegree && typeof w.hwDegree === 'string') {
        const hwDegreeStr = String(w.hwDegree).trim();
        const match = hwDegreeStr.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        if (match) {
          const obtained = parseFloat(match[1]);
          const total = parseFloat(match[2]);
          const percentage = total > 0 ? Math.round((obtained / total) * 100) : 0;
          const weekNum = typeof w.week === 'number' ? w.week : parseInt(w.week, 10);
          if (!isNaN(weekNum) && !weekPercentageMap.has(weekNum)) {
            weekPercentageMap.set(weekNum, percentage);
          }
        }
      }
    });
    
    // Get percentages from online_homeworks (these take precedence)
    onlineHomeworks.forEach(ohw => {
      if (ohw.week && ohw.result && typeof ohw.result === 'string') {
        const resultStr = String(ohw.result).trim();
        const match = resultStr.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        if (match) {
          const obtained = parseFloat(match[1]);
          const total = parseFloat(match[2]);
          const percentage = total > 0 ? Math.round((obtained / total) * 100) : 0;
          const weekNum = typeof ohw.week === 'number' ? ohw.week : parseInt(ohw.week, 10);
          if (!isNaN(weekNum)) {
            weekPercentageMap.set(weekNum, percentage);
          }
        }
      }
    });
  } else if (type === 'quiz') {
    const onlineQuizzes = student.online_quizzes || [];
    
    // Get percentages from weeks.quizDegree
    weeks.forEach(w => {
      if (w.week && w.quizDegree && typeof w.quizDegree === 'string' && 
          w.quizDegree !== "Didn't Attend The Quiz" && w.quizDegree !== "No Quiz") {
        const quizDegreeStr = String(w.quizDegree).trim();
        const match = quizDegreeStr.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        if (match) {
          const obtained = parseFloat(match[1]);
          const total = parseFloat(match[2]);
          const percentage = total > 0 ? Math.round((obtained / total) * 100) : 0;
          const weekNum = typeof w.week === 'number' ? w.week : parseInt(w.week, 10);
          if (!isNaN(weekNum) && !weekPercentageMap.has(weekNum)) {
            weekPercentageMap.set(weekNum, percentage);
          }
        }
      }
    });
    
    // Get percentages from online_quizzes (these take precedence)
    onlineQuizzes.forEach(oqz => {
      if (oqz.week && oqz.result && typeof oqz.result === 'string') {
        const resultStr = String(oqz.result).trim();
        const match = resultStr.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
        if (match) {
          const obtained = parseFloat(match[1]);
          const total = parseFloat(match[2]);
          const percentage = total > 0 ? Math.round((obtained / total) * 100) : 0;
          const weekNum = typeof oqz.week === 'number' ? oqz.week : parseInt(oqz.week, 10);
          if (!isNaN(weekNum)) {
            weekPercentageMap.set(weekNum, percentage);
          }
        }
      }
    });
  }
  
  // Check bonus rules for groups of 4 consecutive weeks (1-4, 5-8, 9-12, etc.)
  for (const bonusRule of condition.bonusRules) {
    if (bonusRule.condition?.lastN && bonusRule.condition?.percentage) {
      const lastN = bonusRule.condition.lastN;
      const requiredPercentage = bonusRule.condition.percentage;
      
      const allWeekNumbers = Array.from(weekPercentageMap.keys()).sort((a, b) => a - b);
      
      if (allWeekNumbers.length >= lastN) {
        const maxWeek = Math.max(...allWeekNumbers);
        
        for (let startWeek = 1; startWeek <= maxWeek; startWeek += lastN) {
          const endWeek = startWeek + lastN - 1;
          const groupWeeks = [];
          
          let allMatch = true;
          for (let week = startWeek; week <= endWeek; week++) {
            if (!weekPercentageMap.has(week)) {
              allMatch = false;
              break;
            }
            const percentage = weekPercentageMap.get(week);
            if (percentage !== requiredPercentage) {
              allMatch = false;
              break;
            }
            groupWeeks.push(week);
          }
          
          if (allMatch && groupWeeks.length === lastN) {
            // Only count bonus if current week is part of this group or if no current week specified
            if (currentWeek === null || groupWeeks.includes(currentWeek)) {
              bonusPoints += bonusRule.points;
              bonusWeeks.push(...groupWeeks);
              console.log(`[SCORING] Bonus (${type} streak): +${bonusRule.points} points for weeks ${startWeek}-${endWeek} (all ${requiredPercentage}%)`);
            }
          }
        }
      }
    }
  }
  
  // Remove duplicates from bonusWeeks
  const uniqueBonusWeeks = [...new Set(bonusWeeks)].sort((a, b) => a - b);
  
  return { bonusPoints, bonusWeeks: uniqueBonusWeeks };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if scoring system is enabled
  if (!SYSTEM_SCORING_SYSTEM) {
    return res.status(200).json({
      success: true,
      pointsAdded: 0,
      basePoints: 0,
      bonusPoints: 0,
      previousScore: 0,
      newScore: 0,
      processId: null,
      message: 'Scoring system is disabled'
    });
  }

  let client;
  try {
    const user = await authMiddleware(req);
    // Allow students to update their own score, and admins/developers/assistants to update any
    if (!['admin', 'developer', 'assistant', 'student'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const { studentId, type, data, week } = req.body;
    
    // Students can only update their own score
    if (user.role === 'student') {
      const studentIdFromToken = parseInt(user.assistant_id || user.id);
      if (studentIdFromToken !== parseInt(studentId)) {
        return res.status(403).json({ error: 'Forbidden: Students can only update their own score' });
      }
    }

    if (!studentId || !type) {
      return res.status(400).json({ error: 'Student ID and type are required' });
    }

    client = await MongoClient.connect(MONGO_URI);
    const db = client.db(DB_NAME);

    // Get student
    const student = await db.collection('students').findOne({ id: parseInt(studentId) });
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get scoring system conditions
    const conditions = await db.collection('scoring_system_conditions').find({}).toArray();
    if (conditions.length === 0) {
      return res.status(404).json({ error: 'Scoring system conditions not found. Please seed the database first.' });
    }

    let pointsToAdd = 0;
    let bonusPoints = 0;

    // Find relevant condition for the type
    let condition;
    if (type === 'homework') {
      // Check if data has percentage (withDegree) or hwDone (without degree)
      const hasPercentage = data?.percentage !== undefined && data?.percentage !== null;
      if (hasPercentage) {
        condition = conditions.find(c => c.type === type && c.withDegree === true);
      } else {
        condition = conditions.find(c => c.type === type && c.withDegree === false);
      }
    } else {
      condition = conditions.find(c => c.type === type);
    }
    
    if (!condition) {
      return res.status(400).json({ error: `No scoring condition found for type: ${type}` });
    }

    // Convert condition to ZEN Engine rule format
    const zenRule = convertConditionToZenRule(condition);

    // Calculate points based on type using ZEN Engine
    if (type === 'attendance') {
      const { status, previousStatus, reverseOnly, autoReverseHomework, autoReverseQuiz } = data;
      
      if (reverseOnly && previousStatus) {
        // Reverse previous points only
        const previousPoints = await evaluateRule(zenRule, { status: previousStatus });
        pointsToAdd = -previousPoints;
        const pointsSign = pointsToAdd >= 0 ? '+' : '';
        console.log(`[SCORING] Attendance (reverse only): ${previousStatus} → ${pointsSign}${pointsToAdd} points (reversing ${previousPoints} points)`);
      } else {
        // Apply current status points
        pointsToAdd = await evaluateRule(zenRule, { status });
        const pointsSign = pointsToAdd >= 0 ? '+' : '';
        console.log(`[SCORING] Attendance: ${status} → ${pointsSign}${pointsToAdd} points`);
      }
    } else if (type === 'homework') {
      if (condition.withDegree === true) {
        // Homework with degree (percentage)
        const { percentage, previousPercentage, reverseOnly } = data;
        
        if (reverseOnly && previousPercentage !== undefined && previousPercentage !== null) {
          // Reverse previous points only
          // Try to get from history to also reverse bonuses
          let previousPoints = 0;
          try {
            let lastHistory = null;
            if (week !== undefined && week !== null) {
              lastHistory = await db.collection('scoring_system_history')
                .findOne(
                  { 
                    student_id: parseInt(studentId), 
                    type: 'homework',
                    process_week: parseInt(week)
                  },
                  { sort: { timestamp: -1 } }
                );
            }
            
            if (!lastHistory) {
              lastHistory = await db.collection('scoring_system_history')
                .findOne(
                  { 
                    student_id: parseInt(studentId), 
                    type: 'homework'
                  },
                  { sort: { timestamp: -1 } }
                );
            }
            
            if (lastHistory) {
              if (lastHistory.base_points !== 0) {
                previousPoints = lastHistory.base_points;
              } else if (lastHistory.score_added !== 0) {
                previousPoints = lastHistory.score_added;
              } else {
                previousPoints = await evaluateRule(zenRule, { percentage: previousPercentage });
              }
              
              // Reverse bonus points if they were applied
              if (lastHistory.bonus_points && lastHistory.bonus_points !== 0) {
                bonusPoints = -lastHistory.bonus_points;
                data.bonusWeeks = lastHistory.bonus_weeks || [];
                console.log(`[SCORING] Reversing homework bonus points: ${bonusPoints} for weeks ${data.bonusWeeks.join(', ')}`);
              }
            } else {
              previousPoints = await evaluateRule(zenRule, { percentage: previousPercentage });
            }
          } catch (historyErr) {
            console.error('Error getting history for homework reverse, using rule evaluation:', historyErr);
            previousPoints = await evaluateRule(zenRule, { percentage: previousPercentage });
          }
          
          pointsToAdd = -previousPoints;
          const pointsSign = pointsToAdd >= 0 ? '+' : '';
          console.log(`[SCORING] Homework (with degree, reverse only): ${previousPercentage}% → ${pointsSign}${pointsToAdd} points (reversing ${previousPoints} points)`);
        } else if (percentage !== undefined && percentage !== null) {
          // Calculate new points and reverse previous
          const newPoints = await evaluateRule(zenRule, { percentage });
          let previousPoints = 0;
          if (previousPercentage !== undefined && previousPercentage !== null) {
            previousPoints = await evaluateRule(zenRule, { percentage: previousPercentage });
          }
          pointsToAdd = newPoints - previousPoints;
          const pointsSign = pointsToAdd >= 0 ? '+' : '';
          console.log(`[SCORING] Homework (with degree): ${percentage}% → ${pointsSign}${pointsToAdd} points (new: ${newPoints}, previous: ${previousPoints})`);
          
          // Calculate bonus points
          const bonusResult = calculateBonusPoints(condition, student, type, week !== undefined && week !== null ? parseInt(week) : null);
          bonusPoints = bonusResult.bonusPoints;
          data.bonusWeeks = bonusResult.bonusWeeks;
        }
      } else {
        // Homework without degree (boolean/status)
        const { hwDone, previousHwDone, reverseOnly } = data;
        
        if (reverseOnly && previousHwDone !== undefined && previousHwDone !== null) {
          // Reverse previous points only
          // Always reverse regardless of state (true, false, "Not Completed", etc.)
          // Use the actual points from history if available, otherwise evaluate
          let previousPoints = 0;
          
          // Try to get the actual points from the last history entry
          // First try with week, then without week if not found
          try {
            let lastHistory = null;
            
            // Try with week first
            if (week !== undefined && week !== null) {
              lastHistory = await db.collection('scoring_system_history')
                .findOne(
                  { 
                    student_id: parseInt(studentId), 
                    type: 'homework',
                    process_week: parseInt(week)
                  },
                  { sort: { timestamp: -1 } }
                );
              console.log(`[SCORING] History lookup with week ${week}:`, lastHistory ? 'found' : 'not found');
            }
            
            // If not found with week, try without week filter
            if (!lastHistory) {
              lastHistory = await db.collection('scoring_system_history')
                .findOne(
                  { 
                    student_id: parseInt(studentId), 
                    type: 'homework'
                  },
                  { sort: { timestamp: -1 } }
                );
              console.log(`[SCORING] History lookup without week:`, lastHistory ? 'found' : 'not found');
            }
            
            if (lastHistory) {
              // Use the actual base_points from history (this is the net change that was applied)
              // If base_points is 0, use score_added instead (which includes bonus points)
              if (lastHistory.base_points !== 0) {
                previousPoints = lastHistory.base_points;
              } else if (lastHistory.score_added !== 0) {
                previousPoints = lastHistory.score_added;
              } else {
                // Fallback to rule evaluation if history has 0 points
                previousPoints = await evaluateRule(zenRule, { hwDone: previousHwDone });
                console.log(`[SCORING] History had 0 points, using rule evaluation: ${previousPoints}`);
              }
              
              // Reverse bonus points if they were applied
              if (lastHistory.bonus_points && lastHistory.bonus_points !== 0) {
                bonusPoints = -lastHistory.bonus_points;
                data.bonusWeeks = lastHistory.bonus_weeks || [];
                console.log(`[SCORING] Reversing bonus points: ${bonusPoints} for weeks ${data.bonusWeeks.join(', ')}`);
              }
              
              console.log(`[SCORING] Using history for reverse: base_points=${lastHistory.base_points}, score_added=${lastHistory.score_added}, bonus_points=${lastHistory.bonus_points}, data=${JSON.stringify(lastHistory.data)}, using=${previousPoints}`);
            } else {
              // No history found, use rule evaluation
              previousPoints = await evaluateRule(zenRule, { hwDone: previousHwDone });
              console.log(`[SCORING] No history found for student ${studentId}, type homework, week ${week}, using rule evaluation for ${previousHwDone}: ${previousPoints}`);
            }
          } catch (historyErr) {
            console.error('Error getting history for reverse, using rule evaluation:', historyErr);
            previousPoints = await evaluateRule(zenRule, { hwDone: previousHwDone });
            console.log(`[SCORING] Error in history lookup, using rule evaluation: ${previousPoints}`);
          }
          
          // Reverse the points (negative of what was applied)
          pointsToAdd = -previousPoints;
          const pointsSign = pointsToAdd >= 0 ? '+' : '';
          console.log(`[SCORING] Homework (reverse only): hwDone=${previousHwDone} → ${pointsSign}${pointsToAdd} points (reversing ${previousPoints} points)`);
        } else {
          // Calculate new points and reverse previous
          // Special case: If going from true/NotCompleted to false, only reverse previous points
          // Don't apply the negative points for false because those are for students who never did homework
          if (hwDone === false && previousHwDone !== undefined && previousHwDone !== null && 
              (previousHwDone === true || previousHwDone === "Not Completed")) {
            // Only reverse the previous positive points, don't apply negative false state
            const previousPoints = await evaluateRule(zenRule, { hwDone: previousHwDone });
            pointsToAdd = -previousPoints;
            const pointsSign = pointsToAdd >= 0 ? '+' : '';
            console.log(`[SCORING] Homework (without degree, ${previousHwDone}→false): Only reversing ${previousPoints} points → ${pointsSign}${pointsToAdd} points`);
          } else {
            // Normal flow: apply new state and reverse previous
            // Special case: If hwDone is false and previousHwDone is null (student never had homework),
            // don't apply the negative points. The -20 penalty is only for students who had homework and then didn't do it.
            if (hwDone === false && (previousHwDone === null || previousHwDone === undefined)) {
              // Don't apply negative points when there's no previous state
              pointsToAdd = 0;
              console.log(`[SCORING] Homework (without degree): hwDone=false with no previous state → 0 points (not applying -20 penalty)`);
            } else {
              const newPoints = await evaluateRule(zenRule, { hwDone });
              let previousPoints = 0;
              if (previousHwDone !== undefined && previousHwDone !== null) {
                // Only reverse if previous state had positive points
                // Don't reverse if previous was false (negative points were never applied)
                if (previousHwDone === true || previousHwDone === "Not Completed") {
                  previousPoints = await evaluateRule(zenRule, { hwDone: previousHwDone });
                }
              }
              pointsToAdd = newPoints - previousPoints;
              const pointsSign = pointsToAdd >= 0 ? '+' : '';
              console.log(`[SCORING] Homework (without degree): hwDone=${hwDone} → ${pointsSign}${pointsToAdd} points (new: ${newPoints}, previous: ${previousPoints})`);
            }
          }
        }
      }
    } else if (type === 'quiz') {
      const { percentage, previousPercentage, reverseOnly } = data;
      
      if (reverseOnly && previousPercentage !== undefined && previousPercentage !== null) {
        // Reverse previous points only
        // Use the actual points from history if available, otherwise evaluate
        let previousPoints = 0;
        
          // Try to get the actual points from the last history entry
          // First try with week, then without week if not found
          try {
            let lastHistory = null;
            
            // Try with week first
            if (week !== undefined && week !== null) {
              lastHistory = await db.collection('scoring_system_history')
                .findOne(
                  { 
                    student_id: parseInt(studentId), 
                    type: 'quiz',
                    process_week: parseInt(week)
                  },
                  { sort: { timestamp: -1 } }
                );
              console.log(`[SCORING] Quiz history lookup with week ${week}:`, lastHistory ? 'found' : 'not found');
            }
            
            // If not found with week, try without week filter
            if (!lastHistory) {
              lastHistory = await db.collection('scoring_system_history')
                .findOne(
                  { 
                    student_id: parseInt(studentId), 
                    type: 'quiz'
                  },
                  { sort: { timestamp: -1 } }
                );
              console.log(`[SCORING] Quiz history lookup without week:`, lastHistory ? 'found' : 'not found');
            }
            
            if (lastHistory) {
              // Use the actual base_points from history (this is the net change that was applied)
              // Always use base_points if it's not 0, even if negative (for 0% quiz which gives -25)
              if (lastHistory.base_points !== 0) {
                previousPoints = lastHistory.base_points;
              } else if (lastHistory.score_added !== 0) {
                previousPoints = lastHistory.score_added;
              } else {
                // Fallback to rule evaluation if history has 0 points
                previousPoints = await evaluateRule(zenRule, { percentage: previousPercentage });
                console.log(`[SCORING] Quiz history had 0 points, using rule evaluation: ${previousPoints}`);
              }
              
              // Reverse bonus points if they were applied
              if (lastHistory.bonus_points && lastHistory.bonus_points !== 0) {
                bonusPoints = -lastHistory.bonus_points;
                data.bonusWeeks = lastHistory.bonus_weeks || [];
                console.log(`[SCORING] Reversing quiz bonus points: ${bonusPoints} for weeks ${data.bonusWeeks.join(', ')}`);
              }
              
              console.log(`[SCORING] Using history for quiz reverse: base_points=${lastHistory.base_points}, score_added=${lastHistory.score_added}, bonus_points=${lastHistory.bonus_points}, data=${JSON.stringify(lastHistory.data)}, using=${previousPoints}`);
            } else {
              // No history found, use rule evaluation
              // For 0% (Didn't Attend The Quiz), this should return -25 points
              previousPoints = await evaluateRule(zenRule, { percentage: previousPercentage });
              console.log(`[SCORING] No quiz history found for student ${studentId}, type quiz, week ${week}, using rule evaluation for ${previousPercentage}%: ${previousPoints}`);
            }
          } catch (historyErr) {
            console.error('Error getting history for quiz reverse, using rule evaluation:', historyErr);
            previousPoints = await evaluateRule(zenRule, { percentage: previousPercentage });
            console.log(`[SCORING] Error in quiz history lookup, using rule evaluation: ${previousPoints}`);
          }
        
        // Reverse the points (negative of what was applied)
        pointsToAdd = -previousPoints;
        const pointsSign = pointsToAdd >= 0 ? '+' : '';
        console.log(`[SCORING] Quiz (reverse only): ${previousPercentage}% → ${pointsSign}${pointsToAdd} points (reversing ${previousPoints} points)`);
      } else if (percentage !== undefined && percentage !== null) {
        // Calculate new points and reverse previous
        // Special case: If going from any percentage to 0% (Didn't Attend The Quiz), only reverse previous points
        // Don't apply the negative points for 0% because those are for students who never took the quiz
        if (percentage === 0 && previousPercentage !== undefined && previousPercentage !== null && previousPercentage > 0) {
          // Only reverse the previous positive points, don't apply negative 0% state
          const previousPoints = await evaluateRule(zenRule, { percentage: previousPercentage });
          pointsToAdd = -previousPoints;
          const pointsSign = pointsToAdd >= 0 ? '+' : '';
          console.log(`[SCORING] Quiz (${previousPercentage}%→0%): Only reversing ${previousPoints} points → ${pointsSign}${pointsToAdd} points`);
        } else {
          const newPoints = await evaluateRule(zenRule, { percentage });
          let previousPoints = 0;
          if (previousPercentage !== undefined && previousPercentage !== null) {
            previousPoints = await evaluateRule(zenRule, { percentage: previousPercentage });
          }
          // Special case: If previous was 0% (Didn't Attend The Quiz) and new is positive, 
          // only apply the new points, don't reverse the negative 0% points
          // This is because 0% penalty is only for students who never took the quiz
          if (previousPercentage === 0 && percentage > 0) {
            pointsToAdd = newPoints; // Only apply new points, don't reverse 0% penalty
            const pointsSign = pointsToAdd >= 0 ? '+' : '';
            console.log(`[SCORING] Quiz (0%→${percentage}%): Only applying ${newPoints} points (not reversing 0% penalty) → ${pointsSign}${pointsToAdd} points`);
          } else {
            pointsToAdd = newPoints - previousPoints;
            const pointsSign = pointsToAdd >= 0 ? '+' : '';
            console.log(`[SCORING] Quiz: ${percentage}% → ${pointsSign}${pointsToAdd} points (new: ${newPoints}, previous: ${previousPoints})`);
          }
          
          // Calculate bonus points
          const bonusResult = calculateBonusPoints(condition, student, type, week !== undefined && week !== null ? parseInt(week) : null);
          bonusPoints = bonusResult.bonusPoints;
          data.bonusWeeks = bonusResult.bonusWeeks;
        }
      } else {
        pointsToAdd = 0;
      }
    }

    let totalPoints = pointsToAdd + bonusPoints;
    const currentScore = student.score || 0;
    let newScore = Math.max(0, currentScore + totalPoints); // Score cannot go below 0
    
    // Console log final score change
    const totalPointsSign = totalPoints >= 0 ? '+' : '';
    console.log(`[SCORING] Student ${studentId} (${student.name}): ${currentScore} → ${newScore} (${totalPointsSign}${totalPoints} points)`);

    // Generate process ID and process name
    const processId = `${studentId}_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let processName = '';
    
    // Build process name based on type and data
    if (type === 'attendance') {
      processName = `Attendance: ${data.status || 'unknown'}`;
    } else if (type === 'homework') {
      if (condition.withDegree === true) {
        processName = `Homework (with degree): ${data.percentage || 0}%`;
      } else {
        processName = `Homework (without degree): ${String(data.hwDone || 'unknown')}`;
      }
    } else if (type === 'quiz') {
      processName = `Quiz: ${data.percentage || 0}%`;
    }
    
    // Save to scoring_system_history collection (always save, even if points are 0)
    try {
      // Calculate base_points (points for current state only, not net change)
      let basePointsForHistory = pointsToAdd;
      if (type === 'quiz' && data.percentage !== undefined && data.percentage !== null && !data.reverseOnly) {
        // For quiz, base_points should be the points for the current percentage only
        const currentStatePoints = await evaluateRule(zenRule, { percentage: data.percentage });
        basePointsForHistory = currentStatePoints;
      } else if (type === 'homework' && data.hwDone !== undefined && !data.reverseOnly) {
        // For homework, base_points should be the points for the current hwDone state only
        // Special case: If hwDone is false and there's no previous state, base_points should be 0
        // (not -20) because we don't apply the penalty for students who never had homework
        if (data.hwDone === false && (data.previousHwDone === null || data.previousHwDone === undefined)) {
          basePointsForHistory = 0;
        } else {
          const currentStatePoints = await evaluateRule(zenRule, { hwDone: data.hwDone });
          basePointsForHistory = currentStatePoints;
        }
      } else if (type === 'attendance' && data.status !== undefined && !data.reverseOnly) {
        // For attendance, base_points should be the points for the current status only
        const currentStatePoints = await evaluateRule(zenRule, { status: data.status });
        basePointsForHistory = currentStatePoints;
      } else if (type === 'homework' && condition.withDegree === true && data.percentage !== undefined && data.percentage !== null && !data.reverseOnly) {
        // For homework with degree, base_points should be the points for the current percentage only
        const currentStatePoints = await evaluateRule(zenRule, { percentage: data.percentage });
        basePointsForHistory = currentStatePoints;
      }
      
      const historyEntry = {
        student_id: parseInt(studentId),
        process_id: processId,
        process_name: processName,
        process_week: week !== undefined && week !== null ? parseInt(week) : null,
        score_before_process: currentScore,
        score_added: totalPoints, // Net change (includes reversing previous)
        score_after_process: newScore,
        type: type,
        data: data,
        bonus_points: bonusPoints,
        bonus_weeks: data.bonusWeeks || [], // Weeks involved in bonus calculation
        base_points: basePointsForHistory, // Points for current state only
        timestamp: new Date()
      };
      
      await db.collection('scoring_system_history').insertOne(historyEntry);
      console.log(`[SCORING] History saved: ${JSON.stringify(historyEntry)}`);
    } catch (historyError) {
      console.error('Error saving scoring history:', historyError);
      // Don't fail the request if history save fails
    }

    // Auto-reverse homework and quiz if attendance is being reversed and week is provided
    if (type === 'attendance' && data.reverseOnly && week !== undefined && week !== null) {
      try {
        // Get last homework history for this week
        if (data.autoReverseHomework !== false) {
          const hwHistory = await db.collection('scoring_system_history')
            .findOne(
              { 
                student_id: parseInt(studentId), 
                type: 'homework',
                process_week: parseInt(week)
              },
              { sort: { timestamp: -1 } }
            );
          
          if (hwHistory && hwHistory.base_points !== 0) {
            console.log(`[SCORING] Auto-reversing homework for week ${week} from attendance reversal`);
            const hwReversePoints = -hwHistory.base_points;
            const scoreBeforeHwReverse = newScore; // Score before reversing homework
            newScore = Math.max(0, newScore + hwReversePoints);
            totalPoints += hwReversePoints;
            
            // Save reverse history
            await db.collection('scoring_system_history').insertOne({
              student_id: parseInt(studentId),
              process_id: `${studentId}_homework_auto_reverse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              process_name: `Homework (auto-reverse from attendance): ${hwHistory.data?.hwDone !== undefined ? hwHistory.data.hwDone : `${hwHistory.data?.percentage || 0}%`}`,
              process_week: parseInt(week),
              score_before_process: scoreBeforeHwReverse,
              score_added: hwReversePoints,
              score_after_process: newScore,
              type: 'homework',
              data: hwHistory.data ? { ...hwHistory.data, reverseOnly: true, autoReversedBy: 'attendance' } : { reverseOnly: true, autoReversedBy: 'attendance' },
              bonus_points: 0,
              base_points: hwReversePoints,
              timestamp: new Date()
            });
            console.log(`[SCORING] Auto-reversed homework: ${scoreBeforeHwReverse} → ${newScore} (${hwReversePoints >= 0 ? '+' : ''}${hwReversePoints} points)`);
          }
        }
        
        // Get last quiz history for this week
        if (data.autoReverseQuiz !== false) {
          const quizHistory = await db.collection('scoring_system_history')
            .findOne(
              { 
                student_id: parseInt(studentId), 
                type: 'quiz',
                process_week: parseInt(week)
              },
              { sort: { timestamp: -1 } }
            );
          
          if (quizHistory && quizHistory.base_points !== 0) {
            console.log(`[SCORING] Auto-reversing quiz for week ${week} from attendance reversal`);
            const quizReversePoints = -quizHistory.base_points;
            const scoreBeforeQuizReverse = newScore; // Score before reversing quiz
            newScore = Math.max(0, newScore + quizReversePoints);
            totalPoints += quizReversePoints;
            
            // Save reverse history
            await db.collection('scoring_system_history').insertOne({
              student_id: parseInt(studentId),
              process_id: `${studentId}_quiz_auto_reverse_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              process_name: `Quiz (auto-reverse from attendance): ${quizHistory.data?.percentage || 0}%`,
              process_week: parseInt(week),
              score_before_process: scoreBeforeQuizReverse,
              score_added: quizReversePoints,
              score_after_process: newScore,
              type: 'quiz',
              data: quizHistory.data ? { ...quizHistory.data, reverseOnly: true, autoReversedBy: 'attendance' } : { percentage: 0, reverseOnly: true, autoReversedBy: 'attendance' },
              bonus_points: 0,
              base_points: quizReversePoints,
              timestamp: new Date()
            });
            console.log(`[SCORING] Auto-reversed quiz: ${scoreBeforeQuizReverse} → ${newScore} (${quizReversePoints >= 0 ? '+' : ''}${quizReversePoints} points)`);
          }
        }
      } catch (autoReverseError) {
        console.error('Error auto-reversing homework/quiz:', autoReverseError);
        // Don't fail the request if auto-reverse fails
      }
    }

    // Update student score
    await db.collection('students').updateOne(
      { id: parseInt(studentId) },
      { $set: { score: newScore } }
    );

    // Log final summary
    console.log(`[SCORING] Final summary for student ${studentId}: ${currentScore} → ${newScore} (total change: ${totalPoints >= 0 ? '+' : ''}${totalPoints} points)`);
    if (type === 'attendance' && data.reverseOnly) {
      console.log(`[SCORING] Attendance reversal completed with auto-reverse for homework and quiz`);
    }

    return res.status(200).json({
      success: true,
      pointsAdded: totalPoints,
      basePoints: pointsToAdd,
      bonusPoints: bonusPoints,
      previousScore: currentScore,
      newScore: newScore,
      processId: processId
    });

  } catch (error) {
    console.error('Error calculating score:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  } finally {
    if (client) await client.close();
  }
}
