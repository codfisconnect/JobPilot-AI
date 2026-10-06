import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Send, Sparkles, CheckCircle2 } from 'lucide-react';

interface AnswerEditorProps {
  questionId: string;
  questionText: string;
  existingAnswer?: string;
  isSubmitting?: boolean;
  onSubmit: (answerText: string) => void;
}

export const AnswerEditor: React.FC<AnswerEditorProps> = ({
  questionId,
  questionText,
  existingAnswer = '',
  isSubmitting = false,
  onSubmit
}) => {
  const [answer, setAnswer] = useState(existingAnswer);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim().length >= 10) {
      onSubmit(answer.trim());
    }
  };

  return (
    <Card className="answer-editor-card" style={{
      background: 'rgba(30, 41, 59, 0.7)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '20px',
      marginTop: '16px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
          Your Prepared Answer
        </h4>
        <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
          {answer.length} characters (minimum 10)
        </span>
      </div>

      <form onSubmit={handleSubmit}>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Structure your answer clearly (e.g. STAR method: Situation, Task, Action, Result). Mention real technologies and measurable results from your experience..."
          rows={6}
          style={{
            width: '100%',
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '8px',
            padding: '12px',
            color: '#f8fafc',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            resize: 'vertical',
            fontFamily: 'inherit',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b' }}>
            Answer evaluation adheres to strict truth guidelines and evaluates clarity, relevance, and evidence.
          </p>

          <Button
            type="submit"
            variant="primary"
            icon={<Send size={15} />}
            loading={isSubmitting}
            disabled={answer.trim().length < 10 || isSubmitting}
          >
            Submit & Evaluate
          </Button>
        </div>
      </form>
    </Card>
  );
};
