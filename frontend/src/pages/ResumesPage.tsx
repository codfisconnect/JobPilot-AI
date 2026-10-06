import React, { useState } from 'react';
import { ResumeUploadManager } from '../components/profile/ResumeUploadManager';
import { Card } from '../components/common/Card';
import { FileText, ShieldCheck, Layers } from 'lucide-react';
import './ResumeStudioPage.css';

interface ResumesPageProps {
  onNavigate?: (tab: string, contextId?: string) => void;
}

export const ResumesPage: React.FC<ResumesPageProps> = ({ onNavigate }) => {
  return (
    <div className="resumes-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div className="resumes-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            Resume Vault & Version Management
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Upload, parse, verify, and store immutable snapshots of your canonical Master Resume.
          </p>
        </div>
      </div>

      {/* Highlights Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <Card style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '8px', color: '#818cf8' }}>
            <FileText size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Master Resume Source</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Verified ground truth for all applications</div>
          </div>
        </Card>

        <Card style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '8px', color: '#34d399' }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Zero-Fabrication Parser</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Candidate review required before persistence</div>
          </div>
        </Card>

        <Card style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ padding: '10px', background: 'rgba(245, 158, 11, 0.15)', borderRadius: '8px', color: '#fbbf24' }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)' }}>Immutable Snapshots</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Tamper-proof version history</div>
          </div>
        </Card>
      </div>

      {/* Production Resume Upload & Vault Manager */}
      <ResumeUploadManager />
    </div>
  );
};
