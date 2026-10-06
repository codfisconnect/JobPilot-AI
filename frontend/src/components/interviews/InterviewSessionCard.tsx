import React from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { Sparkles, CheckCircle2, ChevronRight, Calendar, Building2 } from 'lucide-react';

interface InterviewSessionCardProps {
  session: {
    id: string;
    title: string;
    status: string;
    createdAt: string;
    job?: {
      id: string;
      title: string;
      company?: {
        name: string;
      };
    };
    questions?: any[];
  };
  onSelect: (sessionId: string) => void;
}

export const InterviewSessionCard: React.FC<InterviewSessionCardProps> = ({ session, onSelect }) => {
  const answeredCount = session.questions?.filter(q => q.answers && q.answers.length > 0).length || 0;
  const totalCount = session.questions?.length || 0;
  const progressPercent = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  return (
    <Card className="interview-session-card" style={{
      background: 'rgba(30, 41, 59, 0.7)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '20px',
      marginBottom: '16px',
      transition: 'all 0.2s ease',
      cursor: 'pointer'
    }} onClick={() => onSelect(session.id)}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              display: 'inline-flex',
              padding: '4px 8px',
              borderRadius: '6px',
              fontSize: '0.75rem',
              fontWeight: 600,
              background: 'rgba(99, 102, 241, 0.15)',
              color: '#818cf8',
              border: '1px solid rgba(99, 102, 241, 0.3)'
            }}>
              {session.job?.company?.name || 'Company'}
            </span>
            <Badge variant={session.status === 'COMPLETED' ? 'emerald' : 'blue'} size="sm">
              {session.status}
            </Badge>
          </div>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
            {session.title}
          </h4>
        </div>

        <Button size="sm" variant="outline" icon={<ChevronRight size={14} />} onClick={(e) => {
          e.stopPropagation();
          onSelect(session.id);
        }}>
          Practice
        </Button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.82rem', color: '#94a3b8' }}>
          <span>{totalCount} Questions</span>
          <span>•</span>
          <span>{answeredCount} Answered</span>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Calendar size={13} /> {new Date(session.createdAt).toLocaleDateString()}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '120px' }}>
          <div style={{
            flex: 1,
            height: '6px',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '999px',
            overflow: 'hidden'
          }}>
            <div style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #6366f1, #10b981)',
              borderRadius: '999px'
            }} />
          </div>
          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#cbd5e1' }}>{progressPercent}%</span>
        </div>
      </div>
    </Card>
  );
};
