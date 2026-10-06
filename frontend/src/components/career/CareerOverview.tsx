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
    <div className="career-overview-grid" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px', marginBottom: '24px' }}>
      {/* Track & Readiness Card */}
      <Card style={{
        background: 'rgba(30, 41, 59, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Compass size={18} style={{ color: '#818cf8' }} />
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#818cf8', textTransform: 'uppercase' }}>
                Career Track Alignment
              </span>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              {profileData.currentTrack}
            </h3>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', display: 'block' }}>Readiness Score</span>
            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: profileData.readinessScore >= 75 ? '#34d399' : '#fbbf24' }}>
              {profileData.readinessScore}%
            </span>
          </div>
        </div>

        {/* Transition Summary */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.6)',
          padding: '14px',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <Badge variant={profileData.isSameTrack ? 'emerald' : 'amber'} size="sm">
              {profileData.isSameTrack ? 'Direct Alignment' : 'Cross-Track Transition'}
            </Badge>
            <span style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Target: {profileData.targetTrack}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
            {profileData.transitionGapExplanation}
          </p>
        </div>

        {/* Recommendations */}
        <div>
          <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#94a3b8', marginBottom: '8px', textTransform: 'uppercase' }}>
            Targeted Next Actions
          </h4>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.6 }}>
            {profileData.recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      </Card>

      {/* Verified Evidence Basis & Skill Distribution */}
      <Card style={{
        background: 'rgba(30, 41, 59, 0.7)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <ShieldCheck size={18} style={{ color: '#34d399' }} />
          <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
            Resume-Truth Evidence Basis
          </h4>
        </div>

        <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '16px', lineHeight: 1.5 }}>
          Assessments are grounded strictly in your verified experiences and skill profiles. No experiences or competencies are fabricated.
        </p>

        {/* Breakdown Chips */}
        <div style={{ marginBottom: '14px' }}>
          <span style={{ fontSize: '0.78rem', color: '#34d399', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
            VERIFIED STRENGTHS ({profileData.verifiedStrengths.length})
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {profileData.verifiedStrengths.map(s => (
              <span key={s} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.78rem' }}>
                {s}
              </span>
            ))}
          </div>
        </div>

        {profileData.transferableSkills.length > 0 && (
          <div style={{ marginBottom: '14px' }}>
            <span style={{ fontSize: '0.78rem', color: '#fbbf24', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              TRANSFERABLE / ADJACENT ({profileData.transferableSkills.length})
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {profileData.transferableSkills.map(s => (
                <span key={s} style={{ background: 'rgba(251, 191, 36, 0.1)', color: '#fbbf24', border: '1px solid rgba(251, 191, 36, 0.25)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.78rem' }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {profileData.missingPriorities.length > 0 && (
          <div>
            <span style={{ fontSize: '0.78rem', color: '#fb7185', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              PRIORITIZED SKILL GAPS ({profileData.missingPriorities.length})
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {profileData.missingPriorities.map(s => (
                <span key={s} style={{ background: 'rgba(244, 63, 94, 0.1)', color: '#fb7185', border: '1px solid rgba(244, 63, 94, 0.25)', padding: '3px 8px', borderRadius: '4px', fontSize: '0.78rem' }}>
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
