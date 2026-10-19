import React from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { CheckCircle2, AlertTriangle, AlertCircle, Shield } from 'lucide-react';

interface SkillReadinessProps {
  skillsData: {
    summary: {
      verifiedCount: number;
      partialCount: number;
      missingCount: number;
    };
    skills: Array<{
      skill: string;
      status: 'VERIFIED' | 'PARTIAL' | 'MISSING';
      category?: string;
      evidence?: string;
      proficiency?: string;
    }>;
  };
}

export const SkillReadiness: React.FC<SkillReadinessProps> = ({ skillsData }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED': return <Badge variant="emerald" size="sm">VERIFIED / GREEN</Badge>;
      case 'PARTIAL': return <Badge variant="amber" size="sm">TRANSFERABLE / YELLOW</Badge>;
      case 'MISSING': return <Badge variant="rose" size="sm">MISSING / RED</Badge>;
      default: return null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'VERIFIED': return <CheckCircle2 size={16} style={{ color: '#34d399' }} />;
      case 'PARTIAL': return <AlertTriangle size={16} style={{ color: '#fbbf24' }} />;
      case 'MISSING': return <AlertCircle size={16} style={{ color: '#fb7185' }} />;
      default: return null;
    }
  };

  return (
    <Card className="career-card" style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-lg)',
      padding: '24px',
      marginBottom: '24px',
      boxShadow: 'var(--shadow-sm)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
            Skill Readiness Matrix
          </h3>
          <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            Truthful breakdown of core market skills based on verified candidate history and target market requirements.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', background: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-success)', fontWeight: 600 }}>
            {skillsData.summary.verifiedCount} Verified
          </span>
          <span style={{ fontSize: '0.78rem', background: 'var(--color-warning-bg)', color: 'var(--color-warning)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-warning)', fontWeight: 600 }}>
            {skillsData.summary.partialCount} Transferable
          </span>
          <span style={{ fontSize: '0.78rem', background: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-danger)', fontWeight: 600 }}>
            {skillsData.summary.missingCount} Missing
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {skillsData.skills.map((item, idx) => (
          <div key={idx} style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getStatusIcon(item.status)}
                <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                  {item.skill}
                </span>
              </div>
              {getStatusBadge(item.status)}
            </div>

            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              {item.evidence || (item.status === 'VERIFIED' ? 'Verified in candidate experience' : 'Identified in analyzed market demands')}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
};
