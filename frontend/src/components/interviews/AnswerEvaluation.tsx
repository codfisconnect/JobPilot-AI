import React from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { CheckCircle2, AlertCircle, Sparkles, TrendingUp, HelpCircle } from 'lucide-react';

interface AnswerEvaluationProps {
  evaluation: {
    clarityScore: number;
    accuracyScore: number;
    relevanceScore: number;
    structureScore: number;
    overallScore: number;
    strengths: string[];
    missingPoints: string[];
    suggestions: string[];
    feedback: string;
    evaluatedAt: string;
  };
  suggestedAnswerGuide?: string | null;
}

export const AnswerEvaluation: React.FC<AnswerEvaluationProps> = ({
  evaluation,
  suggestedAnswerGuide
}) => {
  const getScoreBadge = (score: number) => {
    if (score >= 80) return 'emerald';
    if (score >= 60) return 'amber';
    return 'rose';
  };

  return (
    <Card className="answer-evaluation-card" style={{
      background: 'rgba(30, 41, 59, 0.85)',
      border: '1px solid rgba(99, 102, 241, 0.25)',
      borderRadius: '12px',
      padding: '20px',
      marginTop: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={18} style={{ color: '#818cf8' }} />
          <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
            AI Answer Evaluation & Feedback
          </h4>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Overall Score:</span>
          <Badge variant={getScoreBadge(evaluation.overallScore)} size="sm">
            {evaluation.overallScore} / 100
          </Badge>
        </div>
      </div>

      {/* Score Dimensions Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '12px',
        marginBottom: '16px',
        padding: '12px',
        background: 'rgba(15, 23, 42, 0.6)',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.05)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>{evaluation.clarityScore}</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Clarity</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>{evaluation.structureScore}</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Structure</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>{evaluation.relevanceScore}</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Relevance</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc' }}>{evaluation.accuracyScore}</div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Accuracy</div>
        </div>
      </div>

      {/* Overall Qualitative Feedback */}
      <p style={{ fontSize: '0.88rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '16px' }}>
        {evaluation.feedback}
      </p>

      {/* Strengths & Missing Points */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Strengths */}
        <div style={{ background: 'rgba(16, 185, 129, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#34d399', fontSize: '0.85rem', fontWeight: 600 }}>
            <CheckCircle2 size={15} /> Demonstrated Strengths
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
            {evaluation.strengths.map((s, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{s}</li>
            ))}
          </ul>
        </div>

        {/* Missing Points */}
        <div style={{ background: 'rgba(244, 63, 94, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#fb7185', fontSize: '0.85rem', fontWeight: 600 }}>
            <AlertCircle size={15} /> Areas for Improvement
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
            {evaluation.missingPoints.map((m, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{m}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Suggestions */}
      {evaluation.suggestions.length > 0 && (
        <div style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: '#818cf8', fontSize: '0.85rem', fontWeight: 600 }}>
            <TrendingUp size={15} /> Recommended Next Revisions
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.82rem', color: '#cbd5e1', lineHeight: 1.5 }}>
            {evaluation.suggestions.map((sug, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{sug}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested Answer Guide (Interviewer Expectations) */}
      {suggestedAnswerGuide && (
        <div style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', color: '#94a3b8', fontSize: '0.82rem', fontWeight: 600 }}>
            <HelpCircle size={14} /> Interviewer Guide / Key Points Expected
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b', lineHeight: 1.5 }}>
            {suggestedAnswerGuide}
          </p>
        </div>
      )}
    </Card>
  );
};
