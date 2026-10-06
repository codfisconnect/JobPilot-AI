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
    <Card style={{
      background: 'rgba(30, 41, 59, 0.6)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '10px',
      padding: '18px',
      marginBottom: '14px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc' }}>
              {item.skillName}
            </h4>
            <Badge variant={getPriorityBadge(item.priority)} size="sm">
              {item.priority} Priority
            </Badge>
            <Badge variant={item.classification === 'MISSING' ? 'rose' : 'amber'} size="sm">
              {item.classification === 'MISSING' ? 'Skill Gap' : 'Transferable'}
            </Badge>
          </div>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.4 }}>
            {item.rationale}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={item.status}
            onChange={(e) => onUpdateStatus(item.id, e.target.value)}
            style={{
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              padding: '6px 10px',
              color: '#f8fafc',
              fontSize: '0.8rem',
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

      <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '10px 14px', borderRadius: '6px', marginBottom: '12px' }}>
        <span style={{ fontSize: '0.78rem', color: '#818cf8', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
          Suggested Action:
        </span>
        <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
          {item.suggestedAction}
        </span>
      </div>

      {/* Verified Official Resources */}
      {resources.length > 0 && (
        <div>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
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
                  color: '#818cf8',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.8rem',
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
