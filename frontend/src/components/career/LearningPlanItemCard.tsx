import React from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import { BookOpen, ExternalLink, CheckCircle2, Clock, Calendar } from 'lucide-react';

interface LearningPlanItemProps {
  item: {
    id: string;
    skillName: string;
    classification: 'MISSING' | 'PARTIAL';
    priority: string;
    rationale: string;
    suggestedAction: string;
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';
    targetDate?: string | null;
    verifiedResources?: any[];
    progress?: any[];
  };
  onUpdateStatus: (itemId: string, newStatus: string) => void;
  onLogHours?: (itemId: string, hours: number, notes: string) => void;
}

export const LearningPlanItemCard: React.FC<LearningPlanItemProps> = ({
  item,
  onUpdateStatus,
  onLogHours
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'emerald';
      case 'IN_PROGRESS': return 'blue';
      default: return 'neutral';
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p.toUpperCase()) {
      case 'HIGH': return 'rose';
      case 'MEDIUM': return 'amber';
      default: return 'neutral';
    }
  };

  const resources = item.verifiedResources || [];

  return (
    <Card className="career-card" style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-md)',
      padding: '18px 20px',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {item.skillName}
            </h4>
            <Badge variant={getPriorityBadge(item.priority)} size="sm">
              {item.priority} Priority
            </Badge>
            <Badge variant={item.classification === 'MISSING' ? 'rose' : 'amber'} size="sm">
              {item.classification === 'MISSING' ? 'Skill Gap' : 'Transferable'}
            </Badge>
          </div>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
            {item.rationale}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={item.status}
            onChange={(e) => onUpdateStatus(item.id, e.target.value)}
            style={{
              background: 'var(--input-bg)',
              border: '1px solid var(--border-primary)',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 12px',
              color: 'var(--text-primary)',
              fontSize: '0.82rem',
              fontWeight: 500,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="NOT_STARTED">Not Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
          </select>
        </div>
      </div>

      <div style={{ background: 'var(--bg-secondary)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.78rem', color: 'var(--accent-primary)', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
          Suggested Action:
        </span>
        <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
          {item.suggestedAction}
        </span>
      </div>

      {/* Verified Official Resources */}
      {resources.length > 0 && (
        <div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            Verified Reputable Resources (Official Documentation & Tutorials):
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {resources.map((res: any, idx: number) => (
              <a
                key={idx}
                href={res.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(99, 102, 241, 0.1)',
                  border: '1px solid rgba(99, 102, 241, 0.25)',
                  color: 'var(--accent-primary)',
                  padding: '5px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.82rem',
                  fontWeight: 500,
                  textDecoration: 'none'
                }}
              >
                <BookOpen size={13} />
                <span>{res.title || res.provider}</span>
                <ExternalLink size={12} />
              </a>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
