import React, { useState, useEffect } from 'react';
import { useApp } from "../context/AppContext";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { api } from "../api/index";
import { TailoredResume, ResumeValidationResult } from "../types/index";
import {
  FileText,
  Clock,
  Sparkles,
  CheckCircle,
  Copy,
  Download,
  ArrowRight,
  ShieldAlert,
  Building,
  Briefcase,
  ShieldCheck,
  Printer,
  AlertTriangle,
  AlertCircle,
  History,
  FileCheck,
  Send
} from 'lucide-react';
import { ApplicationModal } from '../components/applications/ApplicationModal';
import { JobDescription, JobMatchAnalysis } from '../types/index';
import './ResumeStudioPage.css';

interface ResumeStudioPageProps {
  preselectedResumeId?: string;
  onNavigate: (tab: string, contextId?: string) => void;
}

export const ResumeStudioPage: React.FC<ResumeStudioPageProps> = ({
  preselectedResumeId,
  onNavigate
}) => {
  const { activeCandidate, showToast } = useApp();
  const [resumes, setResumes] = useState<TailoredResume[]>([]);
  const [selectedResume, setSelectedResume] = useState<TailoredResume | null>(null);
  const [validation, setValidation] = useState<ResumeValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [targetJob, setTargetJob] = useState<JobDescription | null>(null);
  const [matchAnalysis, setMatchAnalysis] = useState<JobMatchAnalysis | null>(null);
  const [isAppModalOpen, setIsAppModalOpen] = useState(false);

  useEffect(() => {
    async function loadResumes() {
      try {
        setLoading(true);
        const list = await api.getResumes();
        const candResumes = activeCandidate ? list.filter(r => r.candidateId === activeCandidate.id) : list;
        setResumes(candResumes);

        let initial: TailoredResume | null = null;
        if (preselectedResumeId) {
          const found = list.find(r => r.id === preselectedResumeId);
          if (found) initial = found;
          else if (candResumes.length > 0) initial = candResumes[0];
        } else if (candResumes.length > 0) {
          initial = candResumes[0];
        }
        setSelectedResume(initial);

        if (initial && activeCandidate) {
          runValidation(initial.id, activeCandidate.id);
          if (initial.jobId) {
            loadJobContext(initial.jobId, activeCandidate.id);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadResumes();
  }, [activeCandidate, preselectedResumeId]);

  const loadJobContext = async (jobId: string, candidateId: string) => {
    try {
      const jobData = await api.getJob(jobId);
      setTargetJob(jobData);
      const matchData = await api.getMatch(candidateId, jobId);
      setMatchAnalysis(matchData);
    } catch (err) {
      console.warn('Could not load linked job context:', err);
    }
  };

  const runValidation = async (resumeId: string, candidateId: string) => {
    try {
      setValidating(true);
      const res = await api.validateResume(resumeId, candidateId);
      setValidation(res);
    } catch (err) {
      console.error('Validation error:', err);
    } finally {
      setValidating(false);
    }
  };

  const handleSelectResume = (r: TailoredResume) => {
    setSelectedResume(r);
    if (activeCandidate) {
      runValidation(r.id, activeCandidate.id);
      if (r.jobId) {
        loadJobContext(r.jobId, activeCandidate.id);
      }
    }
  };

  const handleCopyText = () => {
    if (!selectedResume) return;
    const fullText = `
${activeCandidate?.name}
${activeCandidate?.headline || selectedResume.targetRole}
${activeCandidate?.email} | ${activeCandidate?.phone} | ${activeCandidate?.location}
${[activeCandidate?.linkedInUrl, activeCandidate?.gitHubUrl].filter(Boolean).join(' | ')}

PROFESSIONAL SUMMARY
${selectedResume.tailoredSummary}

TECHNICAL SKILLS
${selectedResume.orderedSkills.join(', ')}

PROFESSIONAL EXPERIENCE
${selectedResume.experiences.map(e => `
${e.title} — ${e.company} (${e.startDate} – ${e.endDate})
${(e.responsibilities || e.highlights || []).map(h => `• ${h}`).join('\n')}
`).join('\n')}

EDUCATION
${(selectedResume.education || activeCandidate?.education || []).map(edu => `• ${edu.degree} — ${edu.institution} (${edu.year || ''})`).join('\n')}

CERTIFICATIONS
${(selectedResume.certifications || activeCandidate?.certifications || []).map(c => `• ${c}`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(fullText);
    showToast('Clean ATS resume copied to clipboard!');
  };

  const handleExportTxt = async () => {
    if (!selectedResume) return;
    try {
      setExporting(true);
      const doc = await api.exportResume(selectedResume.id, 'txt');
      const blob = new Blob([doc.content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename || `${selectedResume.versionName}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Resume document exported successfully!');
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="resume-studio-page">
      <div className="studio-header">
        <div>
          <h2 className="studio-title">Resume Studio & Pre-Export Validation</h2>
          <p className="studio-sub">
            Review professional candidate resumes. Target company names are strictly excluded from candidate text to preserve canonical authenticity.
          </p>
        </div>
      </div>

      {resumes.length === 0 ? (
        <Card className="empty-studio-box">
          <FileText size={40} className="empty-icon" />
          <h3>No tailored resumes generated yet for this candidate.</h3>
          <p>Go to the Jobs catalog, select any opportunity, and generate your first job-specific resume.</p>
          <Button variant="primary" onClick={() => onNavigate('jobs')}>
            Browse Jobs
          </Button>
        </Card>
      ) : (
        <div className="studio-layout">
          {/* Left Column: Version History Selector */}
          <div className="studio-versions-list">
            <h3 className="versions-header-title">
              <History size={16} style={{ display: 'inline', marginRight: '6px' }} />
              Resume Version History
            </h3>
            {resumes.map(r => (
              <Card
                key={r.id}
                className={`version-card ${selectedResume?.id === r.id ? 'version-card-active' : ''}`}
                hoverable
                onClick={() => handleSelectResume(r)}
              >
                <div className="version-card-top">
                  <span className="version-name-tag">{r.versionName}</span>
                  <Badge variant="emerald" size="sm">Truth Verified</Badge>
                </div>
                <h4 className="version-role">{r.targetRole}</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span className="version-company" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Target: {r.targetCompany}</span>
                  <Badge variant="indigo" size="sm">{r.mode || 'TARGETED'}</Badge>
                </div>
                <span className="version-date">Created {new Date(r.createdAt).toLocaleDateString()}</span>
              </Card>
            ))}
          </div>

          {/* Right Column: Pre-Export Validation & Formatted Document */}
          {selectedResume && (
            <div className="studio-preview-pane">
              {/* 10-Point Pre-Export Validation Panel */}
              <Card className="validation-panel-card" style={{ border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(15, 23, 42, 0.7)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldCheck size={20} style={{ color: '#10b981' }} />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>
                      10-Point Automated Resume Validation
                    </h3>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Badge variant={validation?.canExport ? 'emerald' : 'amber'} size="sm">
                      {validation?.canExport ? 'READY TO EXPORT' : 'REVIEW REQUIRED'}
                    </Badge>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#818cf8' }}>
                      Completeness: {validation?.completenessScore || 90}%
                    </span>
                  </div>
                </div>

                <div className="validation-checks-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                  {validation?.checks.map(chk => (
                    <div key={chk.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.03)', padding: '8px 12px', borderRadius: '6px', fontSize: '0.82rem' }}>
                      {chk.status === 'PASS' && <CheckCircle size={15} style={{ color: '#10b981', flexShrink: 0 }} />}
                      {chk.status === 'WARN' && <AlertTriangle size={15} style={{ color: '#f59e0b', flexShrink: 0 }} />}
                      {chk.status === 'FAIL' && <AlertCircle size={15} style={{ color: '#ef4444', flexShrink: 0 }} />}
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main, #f1f5f9)' }}>{chk.label}</div>
                        {chk.details && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted, #94a3b8)' }}>{chk.details}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Transparent Tailoring Diff Card */}
              <Card className="diff-card">
                <div className="diff-card-head">
                  <h3 className="section-title">
                    <Sparkles size={18} /> Transparent Tailoring Rationale
                  </h3>
                  <Badge variant="emerald" size="sm">Zero Target Company References</Badge>
                </div>

                <div className="diff-items-container">
                  {selectedResume.modifications.map((mod, idx) => (
                    <div key={idx} className="diff-item">
                      <div className="diff-item-header">
                        <span className="diff-section-name">{mod.section}</span>
                        <span className="diff-reason-tag">{mod.reason}</span>
                      </div>

                      <div className="diff-split-view">
                        <div className="diff-side diff-original">
                          <span className="diff-lbl">Original Master Profile:</span>
                          <p>{mod.original}</p>
                        </div>
                        <div className="diff-side diff-tailored">
                          <span className="diff-lbl">Optimized Candidate Presentation:</span>
                          <p>{mod.tailored}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Formatted Tailored Resume Document */}
              <Card className="resume-sheet">
                <div className="sheet-top-bar">
                  <span className="sheet-label">Standard Experienced Professional Resume • {selectedResume.versionName}</span>
                  <div className="sheet-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <Button variant="secondary" size="sm" icon={<Copy size={14} />} onClick={handleCopyText}>
                      Copy Text
                    </Button>
                    <Button variant="secondary" size="sm" icon={<Printer size={14} />} onClick={handlePrint}>
                      Print / PDF
                    </Button>
                    <Button variant="outline" size="sm" icon={<Download size={14} />} loading={exporting} onClick={handleExportTxt}>
                      Export TXT
                    </Button>
                    {targetJob && (
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Send size={14} />}
                        onClick={() => setIsAppModalOpen(true)}
                        style={{ fontWeight: 700 }}
                      >
                        APPLY NOW
                      </Button>
                    )}
                  </div>
                </div>

                <div className="resume-paper" id="resume-printable-area">
                  <div className="resume-paper-header" style={{ textAlign: 'center', borderBottom: '2px solid #334155', paddingBottom: '16px', marginBottom: '20px' }}>
                    <h2 className="paper-name" style={{ fontSize: '1.6rem', fontWeight: 800, letterSpacing: '0.04em', margin: '0 0 4px', color: '#0f172a' }}>
                      {activeCandidate?.name}
                    </h2>
                    <p style={{ margin: '2px 0 6px', fontSize: '0.95rem', fontWeight: 600, color: '#334155' }}>
                      {activeCandidate?.headline || selectedResume.targetRole}
                    </p>
                    <p className="paper-contact" style={{ margin: '2px 0', fontSize: '0.85rem', color: '#475569' }}>
                      {activeCandidate?.email} • {activeCandidate?.phone} • {activeCandidate?.location}
                    </p>
                    {(activeCandidate?.linkedInUrl || activeCandidate?.gitHubUrl) && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: '#2563eb' }}>
                        {[activeCandidate.linkedInUrl, activeCandidate.gitHubUrl].filter(Boolean).join(' • ')}
                      </p>
                    )}
                  </div>

                  <div className="paper-section" style={{ marginBottom: '18px' }}>
                    <h3 className="paper-section-title" style={{ fontSize: '0.95rem', fontWeight: 800, borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '8px', color: '#1e293b' }}>
                      PROFESSIONAL SUMMARY
                    </h3>
                    <p className="paper-summary-text" style={{ fontSize: '0.88rem', lineHeight: '1.6', color: '#334155', margin: 0 }}>
                      {selectedResume.tailoredSummary}
                    </p>
                  </div>

                  <div className="paper-section" style={{ marginBottom: '18px' }}>
                    <h3 className="paper-section-title" style={{ fontSize: '0.95rem', fontWeight: 800, borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '8px', color: '#1e293b' }}>
                      CORE TECHNICAL COMPETENCIES
                    </h3>
                    <div className="paper-skills-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {selectedResume.orderedSkills.map(s => (
                        <span key={s} className="paper-skill-chip" style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: '4px', fontSize: '0.82rem', color: '#0f172a', fontWeight: 500 }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="paper-section" style={{ marginBottom: '18px' }}>
                    <h3 className="paper-section-title" style={{ fontSize: '0.95rem', fontWeight: 800, borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '8px', color: '#1e293b' }}>
                      PROFESSIONAL EXPERIENCE
                    </h3>
                    {selectedResume.experiences.map(exp => (
                      <div key={exp.id} className="paper-exp-item" style={{ marginBottom: '14px' }}>
                        <div className="paper-exp-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="paper-exp-title" style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{exp.title}</span>
                          <span className="paper-exp-dates" style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>{exp.startDate} – {exp.endDate}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span className="paper-exp-comp" style={{ fontSize: '0.84rem', color: '#2563eb', fontWeight: 600 }}>{exp.company}</span>
                          {exp.duration && <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>{exp.duration}</span>}
                        </div>
                        <ul className="paper-exp-bullets" style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '0.84rem', color: '#334155', lineHeight: '1.5' }}>
                          {(exp.responsibilities || exp.highlights || []).map((h, i) => (
                            <li key={i} style={{ marginBottom: '4px' }}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  {(selectedResume.education || activeCandidate?.education || []).length > 0 && (
                    <div className="paper-section" style={{ marginBottom: '18px' }}>
                      <h3 className="paper-section-title" style={{ fontSize: '0.95rem', fontWeight: 800, borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '8px', color: '#1e293b' }}>
                        EDUCATION
                      </h3>
                      {(selectedResume.education || activeCandidate?.education || []).map(edu => (
                        <div key={edu.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', color: '#334155', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600 }}>{edu.degree}</span>
                          <span>{edu.institution} {edu.year ? `(${edu.year})` : ''}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {(selectedResume.certifications || activeCandidate?.certifications || []).length > 0 && (
                    <div className="paper-section">
                      <h3 className="paper-section-title" style={{ fontSize: '0.95rem', fontWeight: 800, borderBottom: '1px solid #cbd5e1', paddingBottom: '4px', marginBottom: '8px', color: '#1e293b' }}>
                        CERTIFICATIONS & CREDENTIALS
                      </h3>
                      <ul style={{ margin: '4px 0 0 18px', padding: 0, fontSize: '0.84rem', color: '#334155', lineHeight: '1.5' }}>
                        {(selectedResume.certifications || activeCandidate?.certifications || []).map((c, i) => (
                          <li key={i}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Complete Apply Modal */}
      {targetJob && activeCandidate && selectedResume && (
        <ApplicationModal
          isOpen={isAppModalOpen}
          onClose={() => setIsAppModalOpen(false)}
          job={targetJob}
          candidate={activeCandidate}
          tailoredResume={selectedResume}
          matchAnalysis={matchAnalysis}
          onSuccess={(app) => {
            showToast(`Application successfully logged in ${app.applicationMode.toUpperCase()} mode!`);
          }}
          onNavigateToResumes={(resumeId) => onNavigate('resumes', resumeId)}
          onNavigateToApplications={(appId) => onNavigate('applications', appId)}
          onNavigateToLearning={() => onNavigate('learning')}
        />
      )}
    </div>
  );
};
