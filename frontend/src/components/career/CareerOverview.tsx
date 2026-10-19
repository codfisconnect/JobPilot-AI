import React from 'react';
import { Card } from '../common/Card';
import { Badge } from '../common/Badge';
import { Compass, Target, CheckCircle2, AlertTriangle, ShieldCheck, ArrowRight } from 'lucide-react';

interface CareerOverviewProps {
  profileData: {
    fullName: string;
    headline: string;
    currentTrack: string;
    targetTrack: string;
    readinessScore: number;
    isSameTrack: boolean;
    transitionGapExplanation: string;
    verifiedStrengths: string[];
    transferableSkills: string[];
    missingPriorities: string[];
    recommendations: string[];
    evidenceBasis?: string[];
  };
}

export const CareerOverview: React.FC<CareerOverviewProps> = ({ profileData }) => {
  return (
    <div className="career-overview-grid">
      {/* Track & Readiness Card */}
      <Card className="career-card" style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Compass size={18} style={{ color: 'var(--accent-primary)' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Career Track Alignment
              </span>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              {profileData.currentTrack}
            </h3>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Readiness Score</span>
            <span style={{ fontSize: '1.85rem', fontWeight: 800, color: profileData.readinessScore >= 75 ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {profileData.readinessScore}%
            </span>
          </div>
        </div>

        {/* Transition Summary */}
        <div style={{
          background: 'var(--bg-secondary)',
          padding: '14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <Badge variant={profileData.isSameTrack ? 'emerald' : 'amber'} size="sm">
              {profileData.isSameTrack ? 'Direct Alignment' : 'Cross-Track Transition'}
            </Badge>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Target: {profileData.targetTrack}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {profileData.transitionGapExplanation}
          </p>
        </div>

        {/* Recommendations */}
        <div>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Targeted Next Actions
          </h4>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.86rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {profileData.recommendations.map((rec, idx) => (
              <li key={idx} style={{ marginBottom: '4px' }}>{rec}</li>
            ))}
          </ul>
        </div>
      </Card>

      {/* Verified Evidence Basis & Skill Distribution */}
      <Card className="career-card" style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-lg)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <ShieldCheck size={20} style={{ color: 'var(--color-success)' }} />
          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Resume-Truth Evidence Basis
          </h4>
        </div>

        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
          Assessments are grounded strictly in your verified experiences and skill profiles. No experiences or competencies are fabricated.
        </p>

        {/* Breakdown Chips */}
        <div style={{ marginBottom: '14px' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--color-success)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            VERIFIED STRENGTHS ({profileData.verifiedStrengths.length})
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {profileData.verifiedStrengths.map(s => (
              <span key={s} style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', border: '1px solid var(--color-success)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 500 }}>
                {s}
              </span>
            ))}
          </div>
        </div>

        {profileData.transferableSkills.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-warning)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              TRANSFERABLE / ADJACENT ({profileData.transferableSkills.length})
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {profileData.transferableSkills.map(s => (
                <span key={s} style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)', border: '1px solid var(--color-warning)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 500 }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {profileData.missingPriorities.length > 0 && (
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-danger)', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              PRIORITIZED SKILL GAPS ({profileData.missingPriorities.length})
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {profileData.missingPriorities.map(s => (
                <span key={s} style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 500 }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
