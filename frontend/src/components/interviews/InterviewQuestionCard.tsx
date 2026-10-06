import React from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { HelpCircle, Lightbulb, BookOpen } from 'lucide-react';

interface InterviewQuestionCardProps {
  question: {
    id: string;
    type: string;
    difficulty: string;
    question: string;
    context?: string | null;
    suggestedAnswerGuide?: string | null;
    sourceSkill?: string | null;
    displayOrder: number;
    answers?: any[];
  };
  isActive?: boolean;
  onSelect?: () => void;
}

export const InterviewQuestionCard: React.FC<InterviewQuestionCardProps> = ({
  question,
  isActive = false,
  onSelect
}) => {
  const isAnswered = question.answers && question.answers.length > 0;
  const latestAnswer = isAnswered ? question.answers![0] : null;
  const hasEvaluation = latestAnswer && latestAnswer.evaluation;

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'EASY': return 'emerald';
      case 'MEDIUM': return 'amber';
      case 'HARD': return 'rose';
      default: return 'blue';
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'TECHNICAL': return 'indigo';
      case 'BEHAVIORAL': return 'indigo';
      case 'RESUME_BASED': return 'emerald';
      case 'SKILL_GAP': return 'amber';
      default: return 'blue';
    }
  };

  return (
    <Card
      className={`interview-question-card ${isActive ? 'active' : ''}`}
      style={{
        background: isActive ? 'rgba(99, 102, 241, 0.08)' : 'rgba(30, 41, 59, 0.6)',
        border: isActive ? '1px solid rgba(99, 102, 241, 0.5)' : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '18px',
        marginBottom: '14px',
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'all 0.2s ease'
      }}
      onClick={onSelect}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.1)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#f8fafc'
          }}>
            {question.displayOrder}
          </span>
          <Badge variant={getTypeBadge(question.type)} size="sm">
            {question.type.replace('_', ' ')}
          </Badge>
          <Badge variant={getDifficultyColor(question.difficulty)} size="sm">
            {question.difficulty}
          </Badge>
          {question.sourceSkill && (
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>
              Skill: {question.sourceSkill}
            </span>
          )}
        </div>

        {isAnswered && (
          <Badge variant="emerald" size="sm">
            {hasEvaluation ? `Score: ${latestAnswer.evaluation.overallScore}/100` : 'Answered'}
          </Badge>
        )}
      </div>

      <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#f1f5f9', margin: '0 0 8px 0', lineHeight: 1.4 }}>
        {question.question}
      </h4>

      {question.context && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '6px',
          background: 'rgba(0, 0, 0, 0.2)',
          padding: '8px 12px',
          borderRadius: '6px',
          fontSize: '0.8rem',
          color: '#94a3b8',
          marginTop: '8px'
        }}>
          <HelpCircle size={14} style={{ marginTop: '2px', flexShrink: 0, color: '#818cf8' }} />
          <span>{question.context}</span>
        </div>
      )}
    </Card>
  );
};
