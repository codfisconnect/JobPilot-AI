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
    <Card style={{
      background: 'rgba(30, 41, 59, 0.7)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '12px',
      padding: '24px',
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: '0 0 4px 0' }}>
            Skill Readiness Matrix
          </h3>
          <p style={{ margin: 0, fontSize: '0.82rem', color: '#94a3b8' }}>
            Truthful breakdown of core market skills based on verified candidate history and target market requirements.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            {skillsData.summary.verifiedCount} Verified
          </span>
          <span style={{ fontSize: '0.78rem', background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(251, 191, 36, 0.2)' }}>
            {skillsData.summary.partialCount} Transferable
          </span>
          <span style={{ fontSize: '0.78rem', background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185', padding: '4px 8px', borderRadius: '4px', border: '1px solid rgba(244, 63, 94, 0.2)' }}>
            {skillsData.summary.missingCount} Missing
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {skillsData.skills.map((item, idx) => (
          <div key={idx} style={{
            background: 'rgba(15, 23, 42, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            borderRadius: '8px',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {getStatusIcon(item.status)}
                <span style={{ fontWeight: 600, color: '#f1f5f9', fontSize: '0.9rem' }}>
                  {item.skill}
                </span>
              </div>
              {getStatusBadge(item.status)}
            </div>

            <p style={{ margin: 0, fontSize: '0.78rem', color: '#94a3b8', lineHeight: 1.4 }}>
              {item.evidence || (item.status === 'VERIFIED' ? 'Verified in candidate experience' : 'Identified in analyzed market demands')}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
};
