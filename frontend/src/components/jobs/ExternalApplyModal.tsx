import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api } from '../../api/index';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import {
  ExternalLink,
  Mail,
  CheckCircle2,
  Building,
  Clock,
  ArrowRight,
  ShieldAlert,
  Loader2,
  FileText,
  AlertTriangle,
  ArrowLeft,
  Sparkles,
  Maximize2
} from 'lucide-react';
import './JobApplyModals.css';

export interface ExternalApplyModalProps {
  job: any;
  isOpen: boolean;
  onClose: () => void;
  onConfirmApplied?: (application: any) => void;
  onTailorResume?: (jobId: string) => void;
}

type ModalStep = 'prepare' | 'iframe_view' | 'return_prompt' | 'done';

const SESSION_STORAGE_KEY = 'pilotmama_external_apply_context';

export const ExternalApplyModal: React.FC<ExternalApplyModalProps> = ({
  job,
  isOpen,
  onClose,
  onConfirmApplied,
  onTailorResume
}) => {
  const { user } = useAuth();
  const { activeCandidate, showToast } = useApp();

  const [step, setStep] = useState<ModalStep>('prepare');
  const [selectedResumeId, setSelectedResumeId] = useState<string>('master');
  const [candidateResumes, setCandidateResumes] = useState<any[]>([]);
  const [loadingResumes, setLoadingResumes] = useState(false);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [candidateNotes, setCandidateNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedStatus, setConfirmedStatus] = useState<string>('');
  const [iframeBlocked, setIframeBlocked] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  if (!isOpen || !job) return null;

  const candidateId = activeCandidate?.id || user?.id || 'cand-default';
  const companyName = job.company?.name || job.company || 'Employer';
  const targetUrl = job.applicationUrl || job.sourceUrl || job.company?.careersUrl || '';

  // Validate URL safety (HTTPS or safe HTTP, prevent javascript: or data:)
  const isUrlSafe = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  };

  // Load candidate resumes on modal open
  useEffect(() => {
    if (isOpen) {
      setStep('prepare');
      setIframeBlocked(false);
      setIframeLoading(true);
      setReferenceNumber('');
      setCandidateNotes('');

      // Fetch saved resume versions
      setLoadingResumes(true);
      api.getCandidates()
        .then(() => {
          // Check if candidate profile has versions
          const cand = activeCandidate as any;
          const usr = user as any;
          if (cand?.resumes || usr?.resumes) {
            setCandidateResumes(cand?.resumes || usr?.resumes || []);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingResumes(false));
    }
  }, [isOpen, job?.id]);

  /**
   * Persist full navigation context to sessionStorage before leaving or embedding
   */
  const saveApplicationContext = (action: 'EXTERNAL_SITE_OPENED' | 'MODAL_EMBEDDED') => {
    const context = {
      jobId: job.id,
      jobTitle: job.title || job.role,
      companyName,
      targetUrl,
      selectedResumeId,
      timestamp: new Date().toISOString(),
      action,
      url: window.location.href,
      search: window.location.search
    };
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(context));
    } catch (e) {
      console.warn('Unable to write to sessionStorage:', e);
    }
  };

  /**
   * Primary Action: Attempt same-tab embedding or same-tab redirect
   */
  const handleProceedToExternalApply = async () => {
    if (!isUrlSafe(targetUrl)) {
      if (showToast) showToast('Invalid or unsafe application URL.');
      return;
    }

    try {
      setIsSubmitting(true);

      // Record EXTERNAL_SITE_OPENED in application tracker
      saveApplicationContext('EXTERNAL_SITE_OPENED');

      await api.trackExternal({
        jobId: job.id,
        candidateId,
        externalUrl: targetUrl,
        notes: `External application initiated with resume: ${selectedResumeId}`
      }).catch(() => {});

      // Switch to iframe attempt view
      setStep('iframe_view');
      setIframeLoading(true);
      setIframeBlocked(false);
    } catch (err: any) {
      if (showToast) showToast(err?.message || 'Error initializing application');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Fallback: Navigate the current tab directly to the employer site (same tab, NOT window.open)
   */
  const handleSameTabRedirect = () => {
    if (!isUrlSafe(targetUrl)) {
      if (showToast) showToast('Invalid application URL');
      return;
    }

    saveApplicationContext('EXTERNAL_SITE_OPENED');

    // Notify backend
    api.trackExternal({
      jobId: job.id,
      candidateId,
      externalUrl: targetUrl,
      notes: 'Navigated same-tab to employer career website'
    }).catch(() => {});

    // Navigate current window tab
    window.location.href = targetUrl;
  };

  /**
   * Handle candidate submission follow-up response
   */
  const handleConfirmApplication = async (statusChoice: 'APPLIED_CONFIRMED' | 'NOT_APPLIED' | 'APPLICATION_STATUS_UNKNOWN') => {
    try {
      setIsSubmitting(true);

      let statusLabel = 'Confirmation Pending';
      let confirmedApplied = false;

      if (statusChoice === 'APPLIED_CONFIRMED') {
        statusLabel = 'Applied';
        confirmedApplied = true;
      } else if (statusChoice === 'NOT_APPLIED') {
        statusLabel = 'Saved (Not Applied)';
        confirmedApplied = false;
      }

      const noteText = statusChoice === 'APPLIED_CONFIRMED'
        ? `Candidate confirmed submission.${referenceNumber ? ` Ref #: ${referenceNumber.trim()}` : ''}`
        : statusChoice === 'NOT_APPLIED'
          ? 'Candidate indicated application was not submitted.'
          : 'Candidate marked application confirmation as pending.';

      const app = await api.trackExternal({
        jobId: job.id,
        candidateId,
        externalUrl: targetUrl,
        confirmedApplied,
        notes: noteText
      });

      setConfirmedStatus(statusLabel);
      setStep('done');

      // Clear pending session context
      sessionStorage.removeItem(SESSION_STORAGE_KEY);

      if (showToast) {
        showToast(
          statusChoice === 'APPLIED_CONFIRMED'
            ? 'Marked as Applied! Tracked in your applications.'
            : 'Application status updated.'
        );
      }

      if (onConfirmApplied) {
        onConfirmApplied(app);
      }
    } catch (err: any) {
      if (showToast) {
        showToast(err.message || 'Error updating status');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        step === 'iframe_view'
          ? `Employer Application: ${companyName}`
          : 'Apply on External Site'
      }
      maxWidth={step === 'iframe_view' ? 'xl' : 'md'}
    >
      <div className={`external-apply-container ${step === 'iframe_view' ? 'iframe-mode' : ''}`}>
        
        {/* STEP 1: PREPARATION & RESUME SELECTION */}
        {step === 'prepare' && (
          <div className="ext-step-prepare">
            <div className="apply-job-header-strip">
              <div className="apply-company-icon">
                <Building size={24} />
              </div>
              <div className="apply-job-details">
                <h3 className="apply-job-role">{job.title || job.role}</h3>
                <span className="apply-job-company">{companyName} • {job.location || 'Remote'}</span>
              </div>
            </div>

            <div className="ext-disclaimer-box">
              <ShieldAlert size={20} className="disclaimer-icon" />
              <div className="disclaimer-text">
                You are about to apply on <strong>{companyName}</strong>'s official application site.
                PilotMama will track your application progress while respecting employer security boundaries.
              </div>
            </div>

            {/* Resume Selection */}
            <div className="ext-resume-selection-section">
              <label className="ext-section-title">Select Resume for This Application</label>
              <div className="ext-resume-options">
                <label className={`ext-resume-card ${selectedResumeId === 'master' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="resume_choice"
                    value="master"
                    checked={selectedResumeId === 'master'}
                    onChange={() => setSelectedResumeId('master')}
                  />
                  <div className="ext-resume-info">
                    <div className="ext-resume-title-row">
                      <FileText size={16} />
                      <strong>Master Profile Resume</strong>
                    </div>
                    <span className="ext-resume-desc">Standard verified profile resume</span>
                  </div>
                </label>

                {candidateResumes.map((r: any) => (
                  <label key={r.id} className={`ext-resume-card ${selectedResumeId === r.id ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="resume_choice"
                      value={r.id}
                      checked={selectedResumeId === r.id}
                      onChange={() => setSelectedResumeId(r.id)}
                    />
                    <div className="ext-resume-info">
                      <div className="ext-resume-title-row">
                        <FileText size={16} />
                        <strong>{r.title || r.versionName || 'Tailored Resume'}</strong>
                      </div>
                      <span className="ext-resume-desc">
                        {r.atsScore ? `${r.atsScore}% ATS Match • ` : ''}Tailored for {job.title || job.role}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              {onTailorResume && (
                <button
                  type="button"
                  className="ext-tailor-link-btn"
                  onClick={() => {
                    onClose();
                    onTailorResume(job.id);
                  }}
                >
                  <Sparkles size={14} /> Tailor a new resume for this job first
                </button>
              )}
            </div>

            {/* Actions */}
            <div className="ext-actions-row">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleProceedToExternalApply}
                disabled={isSubmitting || !targetUrl}
                icon={<ExternalLink size={16} />}
              >
                Apply on external site
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: SAME-TAB IFRAME ATTEMPT WITH FALLBACK */}
        {step === 'iframe_view' && (
          <div className="ext-iframe-wrapper">
            <div className="ext-iframe-banner">
              <div className="ext-iframe-banner-left">
                <span>Applying to <strong>{companyName}</strong></span>
              </div>
              <div className="ext-iframe-banner-actions">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSameTabRedirect}
                  icon={<Maximize2 size={14} />}
                >
                  Open Direct in Current Tab
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setStep('return_prompt')}
                  icon={<CheckCircle2 size={14} />}
                >
                  I'm Finished Applying
                </Button>
              </div>
            </div>

            {iframeBlocked ? (
              <div className="ext-iframe-fallback-card">
                <AlertTriangle size={32} className="warning-icon" />
                <h4>Employer portal restricts embedded viewing</h4>
                <p>
                  <strong>{companyName}</strong>'s security policies require applications to be completed directly on their portal.
                  Click below to navigate directly in this tab. Your search and application details will be saved when you return.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleSameTabRedirect}
                  icon={<ExternalLink size={18} />}
                >
                  Continue to {companyName} Portal
                </Button>
              </div>
            ) : (
              <div className="ext-iframe-container">
                {iframeLoading && (
                  <div className="ext-iframe-loader">
                    <Loader2 size={32} className="spinning" />
                    <p>Connecting to {companyName} application site...</p>
                  </div>
                )}
                <iframe
                  ref={iframeRef}
                  src={targetUrl}
                  title={`${companyName} Application`}
                  className="ext-application-iframe"
                  onLoad={() => setIframeLoading(false)}
                  onError={() => {
                    setIframeBlocked(true);
                    setIframeLoading(false);
                  }}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
              </div>
            )}
          </div>
        )}

        {/* STEP 3: RETURN TRACKING PROMPT */}
        {step === 'return_prompt' && (
          <div className="ext-step-return-prompt">
            <div className="ext-icon-circle waiting">
              <Clock size={32} />
            </div>

            <h3 className="ext-main-title">Did you complete your application?</h3>
            <p className="ext-main-desc">
              Let PilotMama know your application status for <strong>{job.title || job.role}</strong> at <strong>{companyName}</strong> to keep your tracker accurate.
            </p>

            <div className="ext-ref-field">
              <label htmlFor="ext-app-ref" className="ext-field-label">
                Application Reference Number (Optional)
              </label>
              <input
                id="ext-app-ref"
                type="text"
                className="ext-text-input"
                placeholder="e.g. APP-948210 or Req #8491"
                value={referenceNumber}
                onChange={e => setReferenceNumber(e.target.value)}
                disabled={isSubmitting}
              />
              <span className="ext-field-hint">If provided by the employer confirmation email or screen.</span>
            </div>

            <div className="ext-confirm-buttons-3col">
              <Button
                variant="primary"
                onClick={() => handleConfirmApplication('APPLIED_CONFIRMED')}
                disabled={isSubmitting}
                icon={<CheckCircle2 size={16} />}
              >
                Yes, I submitted
              </Button>

              <Button
                variant="outline"
                onClick={() => handleConfirmApplication('NOT_APPLIED')}
                disabled={isSubmitting}
              >
                No, I did not submit
              </Button>

              <Button
                variant="outline"
                onClick={() => handleConfirmApplication('APPLICATION_STATUS_UNKNOWN')}
                disabled={isSubmitting}
              >
                I am not sure
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: CONFIRMATION DONE */}
        {step === 'done' && (
          <div className="ext-step-done">
            <div className="ext-icon-circle done">
              <CheckCircle2 size={36} />
            </div>

            <h3 className="ext-main-title">Application Tracker Updated</h3>
            <p className="ext-main-desc">
              Your application for <strong>{job.title || job.role}</strong> at <strong>{companyName}</strong> is now tracked as <strong>{confirmedStatus}</strong>.
            </p>

            {referenceNumber && (
              <div className="ext-saved-ref-box">
                <span>Reference Number: <strong>{referenceNumber}</strong></span>
              </div>
            )}

            <div className="ext-actions-center">
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}

      </div>
    </Modal>
  );
};
