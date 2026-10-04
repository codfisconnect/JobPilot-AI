import React, { useState, useEffect } from 'react';
import { useApp } from "../context/AppContext";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { api } from "../api/index";
import { TailoredResume } from "../types/index";
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
  Briefcase
} from 'lucide-react';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadResumes() {
      try {
        setLoading(true);
        const list = await api.getResumes();
        const candResumes = activeCandidate ? list.filter(r => r.candidateId === activeCandidate.id) : list;
        setResumes(candResumes);

        if (preselectedResumeId) {
          const found = list.find(r => r.id === preselectedResumeId);
          if (found) setSelectedResume(found);
          else if (candResumes.length > 0) setSelectedResume(candResumes[0]);
        } else if (candResumes.length > 0) {
          setSelectedResume(candResumes[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadResumes();
  }, [activeCandidate, preselectedResumeId]);

  const handleCopyText = () => {
    if (!selectedResume) return;
    const fullText = `
${activeCandidate?.name}
${activeCandidate?.email} | ${activeCandidate?.phone} | ${activeCandidate?.location}

PROFESSIONAL SUMMARY
${selectedResume.tailoredSummary}

TECHNICAL SKILLS
${selectedResume.orderedSkills.join(', ')}

PROFESSIONAL EXPERIENCE
${selectedResume.experiences.map(e => `
${e.title} - ${e.company} (${e.startDate} - ${e.endDate})
${e.highlights.map(h => `• ${h}`).join('\n')}
`).join('\n')}
    `.trim();

    navigator.clipboard.writeText(fullText);
    showToast('Complete tailored resume copied to clipboard!');
  };

  return (
    <div className="resume-studio-page">
      <div className="studio-header">
        <div>
          <h2 className="studio-title">Resume Studio & Diff Comparison</h2>
          <p className="studio-sub">
            Review job-specific tailored resume versions. Inspect transparent wording edits and verify zero skill fabrication.
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
            <h3 className="versions-header-title">Resume Version History</h3>
            {resumes.map(r => (
              <Card
                key={r.id}
                className={`version-card ${selectedResume?.id === r.id ? 'version-card-active' : ''}`}
                hoverable
                onClick={() => setSelectedResume(r)}
              >
                <div className="version-card-top">
                  <span className="version-name-tag">{r.versionName}</span>
                  <Badge variant="emerald" size="sm">Truth Verified</Badge>
                </div>
                <h4 className="version-role">{r.targetRole}</h4>
                <span className="version-company">{r.targetCompany}</span>
                <span className="version-date">Created {new Date(r.createdAt).toLocaleDateString()}</span>
              </Card>
            ))}
          </div>

          {/* Right Column: Comparison Diff & Full Document Preview */}
          {selectedResume && (
            <div className="studio-preview-pane">
              {/* Modifications Diff Card */}
              <Card className="diff-card">
                <div className="diff-card-head">
                  <h3 className="section-title">
                    <Sparkles size={18} /> Transparent Tailoring Diff & Rationale
                  </h3>
                  <Badge variant="emerald" size="sm">Strict Truth Enforcement Active</Badge>
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
                          <span className="diff-lbl">Original Master Resume:</span>
                          <p>{mod.original}</p>
                        </div>
                        <div className="diff-side diff-tailored">
                          <span className="diff-lbl">Job-Tailored Optimization:</span>
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
                  <span className="sheet-label">Formatted Tailored Document • {selectedResume.versionName}</span>
                  <div className="sheet-actions">
                    <Button variant="secondary" size="sm" icon={<Copy size={14} />} onClick={handleCopyText}>
                      Copy Resume Text
                    </Button>
                  </div>
                </div>

                <div className="resume-paper">
                  <div className="resume-paper-header">
                    <h2 className="paper-name">{activeCandidate?.name}</h2>
                    <p className="paper-contact">
                      {activeCandidate?.email} | {activeCandidate?.phone} | {activeCandidate?.location}
                    </p>
                  </div>

                  <div className="paper-section">
                    <h3 className="paper-section-title">PROFESSIONAL SUMMARY</h3>
                    <p className="paper-summary-text">{selectedResume.tailoredSummary}</p>
                  </div>

                  <div className="paper-section">
                    <h3 className="paper-section-title">CORE TECHNICAL COMPETENCIES</h3>
                    <div className="paper-skills-grid">
                      {selectedResume.orderedSkills.map(s => (
                        <span key={s} className="paper-skill-chip">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="paper-section">
                    <h3 className="paper-section-title">PROFESSIONAL WORK HISTORY</h3>
                    {selectedResume.experiences.map(exp => (
                      <div key={exp.id} className="paper-exp-item">
                        <div className="paper-exp-header">
                          <span className="paper-exp-title">{exp.title}</span>
                          <span className="paper-exp-dates">{exp.startDate} – {exp.endDate}</span>
                        </div>
                        <span className="paper-exp-comp">{exp.company}</span>
                        <ul className="paper-exp-bullets">
                          {exp.highlights.map((h, i) => (
                            <li key={i}>{h}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
