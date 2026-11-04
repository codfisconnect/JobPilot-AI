import React from 'react';
import { CanonicalJob } from '../../types/job.types';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { MapPin, Briefcase, Building, ExternalLink, Calendar, CheckCircle2, ShieldCheck, Send, AlertTriangle } from 'lucide-react';
import { resolveApplicationTarget } from '../../utils/targetUrlResolver';

interface JobDetailModalProps {
  job: CanonicalJob | null;
  isOpen: boolean;
  onClose: () => void;
  onAnalyzeFit?: (jobId: string) => void;
  onApply?: (jobId: string) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({ job, isOpen, onClose, onAnalyzeFit, onApply }) => {
  if (!job) return null;

  const resolvedTarget = resolveApplicationTarget({
    applicationUrl: job.applicationUrl,
    jobDetailUrl: job.jobDetailUrl,
    sourceUrl: job.sourceUrl,
    companyCareersUrl: job.company?.careersUrl
  });
  const targetUrl = resolvedTarget.url;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={job.title} maxWidth="lg">
      <div className="canonical-job-detail-modal">
        {/* Company Header */}
        <div className="job-detail-company-strip">
          <div>
            <h3 className="company-title">{job.company?.name || 'Company'}</h3>
            {job.company?.officialDomain && (
              <span className="company-domain">{job.company.officialDomain}</span>
            )}
          </div>
          <div className="source-transparency-pill">
            <ShieldCheck size={14} />
            <span>Verified Career Opening</span>
          </div>
        </div>

        {/* Quick Highlights */}
        <div className="job-highlights-grid">
          <div className="highlight-item">
            <MapPin size={16} />
            <div>
              <span className="hl-label">Location</span>
              <span className="hl-value">{job.location || job.city || 'Unlisted'}</span>
            </div>
          </div>
          <div className="highlight-item">
            <Briefcase size={16} />
            <div>
              <span className="hl-label">Remote / Work Mode</span>
              <span className="hl-value">{job.remoteType.replace('_', ' ')}</span>
            </div>
          </div>
          <div className="highlight-item">
            <Calendar size={16} />
            <div>
              <span className="hl-label">Employment Type</span>
              <span className="hl-value">{job.employmentType.replace('_', ' ')}</span>
            </div>
          </div>
          {job.salaryMin && (
            <div className="highlight-item">
              <span className="hl-symbol">$</span>
              <div>
                <span className="hl-label">Compensation</span>
                <span className="hl-value">
                  {job.salaryCurrency || '$'}{Number(job.salaryMin).toLocaleString()}
                  {job.salaryMax ? ` - ${Number(job.salaryMax).toLocaleString()}` : ''}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Competencies / Skills */}
        {job.skills && job.skills.length > 0 && (
          <div className="job-detail-section">
            <h4 className="detail-section-title">Required Competencies & Skills</h4>
            <div className="skills-badge-list">
              {job.skills.map(s => (
                <span key={s.id || s.name} className={`detail-skill-tag ${s.type === 'REQUIRED' ? 'tag-required' : 'tag-preferred'}`}>
                  {s.type === 'REQUIRED' ? <CheckCircle2 size={12} /> : null}
                  {s.name} ({s.type})
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Responsibilities */}
        {job.responsibilities && job.responsibilities.length > 0 && (
          <div className="job-detail-section">
            <h4 className="detail-section-title">Core Responsibilities</h4>
            <ul className="detail-bullet-list">
              {job.responsibilities.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Requirements */}
        {job.requirements && job.requirements.length > 0 && (
          <div className="job-detail-section">
            <h4 className="detail-section-title">Requirements & Qualifications</h4>
            <ul className="detail-bullet-list">
              {job.requirements.map((req, i) => (
                <li key={i}>{req}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Preferred Qualifications */}
        {job.preferredQualifications && job.preferredQualifications.length > 0 && (
          <div className="job-detail-section">
            <h4 className="detail-section-title">Preferred Qualifications</h4>
            <ul className="detail-bullet-list">
              {job.preferredQualifications.map((pq, i) => (
                <li key={i}>{pq}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Education & Experience Details if present */}
        {(job.education || (job.experienceMin !== undefined && job.experienceMin !== null)) && (
          <div className="job-detail-section">
            <h4 className="detail-section-title">Education & Seniority</h4>
            <div className="job-highlights-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
              {job.education && (
                <div className="highlight-item">
                  <div>
                    <span className="hl-label">Education</span>
                    <span className="hl-value">{job.education}</span>
                  </div>
                </div>
              )}
              {job.experienceMin !== undefined && job.experienceMin !== null && (
                <div className="highlight-item">
                  <div>
                    <span className="hl-label">Required Experience</span>
                    <span className="hl-value">
                      {job.experienceMin}
                      {job.experienceMax ? ` - ${job.experienceMax}` : '+'} years
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Clean Job Description (Safe Text) */}
        <div className="job-detail-section">
          <h4 className="detail-section-title">Job Overview & Description</h4>
          <p className="detail-body-text">{job.description}</p>
        </div>

        {/* Original Job Posting Link */}
        {targetUrl && (
          <div className="job-detail-section" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
            {resolvedTarget.isExact ? (
              <a
                href={targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="original-job-link"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}
              >
                <span>View Original Job Posting on Employer Site</span>
                <ExternalLink size={14} />
              </a>
            ) : (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: '#fbbf24', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={13} /> Exact job posting link unavailable.
                </span>
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="original-job-link"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8125rem', color: '#94a3b8', textDecoration: 'underline' }}
                >
                  <span>Open Employer Careers Page</span>
                  <ExternalLink size={13} />
                </a>
              </div>
            )}
          </div>
        )}

        {/* Candidate Action Footer */}
        <div className="job-detail-footer">
          <div className="source-disclaimer">
            <p>
              Verified career opportunity. External links open directly on employer career sites with zero automated submission.
            </p>
          </div>
          <div className="detail-actions">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
            {onAnalyzeFit && (
              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  onAnalyzeFit(job.id);
                }}
              >
                Analyze Job Fit
              </Button>
            )}
            <Button
              variant="primary"
              icon={<Send size={16} />}
              onClick={() => {
                onClose();
                if (onApply) {
                  onApply(job.id);
                } else if (onAnalyzeFit) {
                  onAnalyzeFit(job.id);
                }
              }}
            >
              Apply
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
