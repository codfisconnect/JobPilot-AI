import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, AlertCircle, ArrowRight, ShieldCheck, Sparkles, ExternalLink, Loader2 } from 'lucide-react';
import { apiClient } from '../../api/client';
import './ApplyDialog.css';

export interface ApplyDialogProps {
  isOpen: boolean;
  onClose: () => void;
  job: {
    id: string;
    title?: string;
    role?: string;
    company?: any;
    location?: string;
    applicationUrl?: string;
    sourceUrl?: string;
  };
  candidate?: any;
  onSuccess?: (app: any) => void;
  onNavigateToApplications?: (appId?: string) => void;
}

type DialogView = 'choose' | 'progress' | 'missing_info' | 'success' | 'failure';

interface ProgressStep {
  id: string;
  label: string;
}

const ORCHESTRATION_STEPS: ProgressStep[] = [
  { id: 'JOB_ANALYZED', label: 'Reading job requirements' },
  { id: 'CANDIDATE_DATA', label: 'Preparing candidate information' },
  { id: 'RESUME_SELECTED', label: 'Preparing resume' },
  { id: 'FORM_FILLED', label: 'Completing employer form' },
  { id: 'RESUME_UPLOADED', label: 'Uploading resume' },
  { id: 'SUBMITTING', label: 'Submitting application' },
  { id: 'SUBMITTED', label: 'Verifying submission' }
];

export const ApplyDialog: React.FC<ApplyDialogProps> = ({
  isOpen,
  onClose,
  job,
  candidate,
  onSuccess,
  onNavigateToApplications
}) => {
  const [view, setView] = useState<DialogView>('choose');
  const [resumeChoice, setResumeChoice] = useState<'master' | 'tailored'>('master');
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [orchestratorState, setOrchestratorState] = useState<any>(null);
  const [missingField, setMissingField] = useState<any>(null);
  const [missingFieldValue, setMissingFieldValue] = useState('');
  const [isSubmittingField, setIsSubmittingField] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submittedApp, setSubmittedApp] = useState<any>(null);

  const pollIntervalRef = useRef<any>(null);

  // Reset state when modal is opened for a job
  useEffect(() => {
    if (isOpen) {
      setView('choose');
      setResumeChoice('master');
      setAttemptId(null);
      setOrchestratorState(null);
      setMissingField(null);
      setMissingFieldValue('');
      setErrorMessage(null);
      setSubmittedApp(null);
    } else {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    }
  }, [isOpen, job?.id]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  if (!isOpen) return null;

  const jobTitle = job.title || job.role || 'Job Opportunity';
  const companyName = typeof job.company === 'string' ? job.company : (job.company?.name || 'Employer');
  const locationText = job.location || 'Remote / Flexible';

  // Handle Start Application
  const handleStartApply = async () => {
    setView('progress');
    setErrorMessage(null);

    try {
      const res = await apiClient.startApplicationOrchestration({
        jobId: job.id,
        resumeChoice
      });

      const attempt = res?.data ?? res;
      if (attempt && (attempt.attemptId || attempt.id || attempt.state || attempt.status)) {
        setAttemptId(attempt.attemptId || attempt.id);
        handleAttemptUpdate(attempt);
      } else {
        setView('failure');
        setErrorMessage(res?.message || 'Failed to initialize application orchestrator.');
      }
    } catch (err: any) {
      setView('failure');
      setErrorMessage(err?.message || 'Application orchestrator error occurred.');
    }
  };

  // Handle state updates from polling or immediate response
  const handleAttemptUpdate = (attempt: any) => {
    setOrchestratorState(attempt);
    const currentState = attempt.state || attempt.status;

    if (currentState === 'SUBMITTED') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setSubmittedApp(attempt.submissionResult || attempt);
      setView('success');
      if (onSuccess) {
        onSuccess({
          id: attempt.attemptId || attempt.id,
          role: jobTitle,
          company: companyName,
          status: 'APPLIED',
          appliedAt: new Date().toISOString(),
          confirmationNumber: attempt.submissionResult?.confirmationNumber
        });
      }
    } else if (currentState === 'WAITING_FOR_CANDIDATE') {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setMissingField(attempt.missingField);
      setView('missing_info');
    } else if (['FAILED', 'UNSUPPORTED', 'BLOCKED_BY_CAPTCHA', 'BLOCKED_BY_AUTH'].includes(currentState)) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      setView('failure');
      const errText = attempt.error?.factualReason || attempt.error?.message || attempt.lastError || attempt.submissionResult?.reason || 'Employer application could not be completed automatically.';
      setErrorMessage(errText);
    } else {
      // In progress - start polling if not already started
      if (!pollIntervalRef.current && (attempt.attemptId || attempt.id)) {
        startPolling(attempt.attemptId || attempt.id);
      }
    }
  };

  const startPolling = (attId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const res = await apiClient.getApplicationOrchestrationStatus(attId);
        const attempt = res?.data ?? res;
        if (attempt && (attempt.attemptId || attempt.id || attempt.state || attempt.status)) {
          handleAttemptUpdate(attempt);
        }
      } catch (err) {
        // Retry silently on temporary poll error
      }
    }, 1500);
  };

  // Submit missing field
  const handleContinueWithField = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!attemptId || !missingField) return;

    if (!missingFieldValue.trim()) return;

    setIsSubmittingField(true);
    try {
      const res = await apiClient.respondMissingField(attemptId, missingField.fieldKey, missingFieldValue.trim());
      setIsSubmittingField(false);
      setMissingFieldValue('');
      setMissingField(null);
      setView('progress');

      const attempt = res?.data ?? res;
      if (attempt && (attempt.attemptId || attempt.id || attempt.state || attempt.status)) {
        handleAttemptUpdate(attempt);
      } else {
        startPolling(attemptId);
      }
    } catch (err: any) {
      setIsSubmittingField(false);
      setErrorMessage(err?.message || 'Failed to submit response.');
      setView('failure');
    }
  };

  // Check progress step status
  const getStepStatus = (stepId: string) => {
    const currentState = orchestratorState?.status;
    const history = orchestratorState?.stateHistory || [];

    if (currentState === 'SUBMITTED') return 'done';

    const stepOrder = [
      'PREPARING',
      'JOB_ANALYZED',
      'CANDIDATE_DATA',
      'RESUME_SELECTED',
      'FORM_DISCOVERED',
      'FORM_FILLED',
      'RESUME_UPLOADED',
      'READY_TO_SUBMIT',
      'SUBMITTING',
      'SUBMITTED'
    ];

    const currentIdx = stepOrder.indexOf(currentState);
    const stepTargetIdx = stepOrder.indexOf(stepId);

    if (currentIdx > stepTargetIdx || history.some((h: any) => h.toState === stepId)) {
      return 'done';
    }
    if (currentIdx === stepTargetIdx) {
      return 'running';
    }
    return 'pending';
  };

  return (
    <div className="apply-dialog-overlay" onClick={onClose}>
      <div className="apply-dialog-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="apply-dialog-header">
          <div className="apply-dialog-header-text">
            <h3 className="apply-dialog-title">
              {view === 'success' ? 'Application Confirmed' : `Apply to ${jobTitle}`}
            </h3>
            <div className="apply-dialog-subtitle">
              <span className="apply-dialog-subtitle-company">{companyName}</span>
              <span>•</span>
              <span>{locationText}</span>
            </div>
          </div>
          <button
            type="button"
            className="apply-dialog-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* View 1: Choose Resume */}
        {view === 'choose' && (
          <>
            <div className="apply-dialog-body">
              <div className="apply-section-label">Choose Resume</div>
              <div className="apply-resume-options" role="radiogroup">
                {/* Master Resume (Default / Free) */}
                <div
                  className={`apply-resume-option ${resumeChoice === 'master' ? 'selected' : ''}`}
                  onClick={() => setResumeChoice('master')}
                  role="radio"
                  aria-checked={resumeChoice === 'master'}
                >
                  <div className="apply-radio-dot">
                    {resumeChoice === 'master' && <div className="apply-radio-dot-inner" />}
                  </div>
                  <div className="apply-resume-details">
                    <div className="apply-resume-title-row">
                      <span className="apply-resume-name">Master Resume</span>
                      <span className="apply-resume-badge">Default</span>
                    </div>
                    <p className="apply-resume-desc">
                      Apply immediately with your primary verified candidate resume.
                    </p>
                  </div>
                </div>

                {/* Tailored Resume (Optional Enhancement) */}
                <div
                  className={`apply-resume-option ${resumeChoice === 'tailored' ? 'selected' : ''}`}
                  onClick={() => setResumeChoice('tailored')}
                  role="radio"
                  aria-checked={resumeChoice === 'tailored'}
                >
                  <div className="apply-radio-dot">
                    {resumeChoice === 'tailored' && <div className="apply-radio-dot-inner" />}
                  </div>
                  <div className="apply-resume-details">
                    <div className="apply-resume-title-row">
                      <span className="apply-resume-name">Tailored Resume</span>
                      <span className="apply-resume-badge-opt">Optional</span>
                    </div>
                    <p className="apply-resume-desc">
                      Optimizes emphasis for this specific job's verified requirements.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="apply-dialog-footer">
              <button
                type="button"
                className="apply-btn-primary"
                onClick={handleStartApply}
              >
                <span>Apply Now</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* View 2: Lightweight Progress State */}
        {view === 'progress' && (
          <div className="apply-dialog-body apply-progress-view">
            <div className="apply-progress-header">
              <div className="apply-progress-spinner" />
              <h4 className="apply-progress-title">Preparing your application...</h4>
            </div>

            <div className="apply-steps-list">
              {ORCHESTRATION_STEPS.map(s => {
                const status = getStepStatus(s.id);
                return (
                  <div key={s.id} className={`apply-step-item ${status}`}>
                    <div className={`apply-step-icon ${status}`}>
                      {status === 'done' ? (
                        <CheckCircle2 size={16} />
                      ) : status === 'running' ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <span style={{ fontSize: 12, opacity: 0.5 }}>○</span>
                      )}
                    </div>
                    <span>{s.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* View 3: Mandatory Missing Field Only */}
        {view === 'missing_info' && missingField && (
          <form onSubmit={handleContinueWithField}>
            <div className="apply-dialog-body apply-missing-view">
              <div className="apply-missing-alert">
                <strong>Information Required:</strong> {missingField.prompt || 'The employer requires a mandatory field to complete submission.'}
              </div>

              <div className="apply-input-group">
                <label className="apply-input-label" htmlFor="missing-field-input">
                  {missingField.label || 'Your Value'}
                </label>
                <input
                  id="missing-field-input"
                  className="apply-input-field"
                  type={missingField.type === 'phone' ? 'tel' : 'text'}
                  placeholder={missingField.placeholder || 'Enter required value...'}
                  value={missingFieldValue}
                  onChange={e => setMissingFieldValue(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="apply-dialog-footer">
              <button
                type="submit"
                className="apply-btn-primary"
                disabled={!missingFieldValue.trim() || isSubmittingField}
              >
                {isSubmittingField ? 'Submitting...' : 'Continue Application'}
              </button>
            </div>
          </form>
        )}

        {/* View 4: Application Submitted Successfully */}
        {view === 'success' && (
          <>
            <div className="apply-dialog-body apply-success-view">
              <div className="apply-success-icon-wrap">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="apply-success-title">Application Submitted Successfully</h3>
              <p className="apply-success-subtitle">
                Pilot Mama completed and confirmed your application with the employer.
              </p>

              <div className="apply-summary-card">
                <div className="apply-summary-row">
                  <span className="apply-summary-label">Role:</span>
                  <span className="apply-summary-value">{jobTitle}</span>
                </div>
                <div className="apply-summary-row">
                  <span className="apply-summary-label">Company:</span>
                  <span className="apply-summary-value">{companyName}</span>
                </div>
                <div className="apply-summary-row">
                  <span className="apply-summary-label">Resume Used:</span>
                  <span className="apply-summary-value">
                    {resumeChoice === 'tailored' ? 'Tailored Resume' : 'Master Resume'}
                  </span>
                </div>
                <div className="apply-summary-row">
                  <span className="apply-summary-label">Application Date:</span>
                  <span className="apply-summary-value">
                    {new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </span>
                </div>
                {submittedApp?.confirmationNumber && (
                  <div className="apply-summary-row">
                    <span className="apply-summary-label">Confirmation:</span>
                    <span className="apply-summary-conf">{submittedApp.confirmationNumber}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="apply-dialog-footer">
              <button
                type="button"
                className="apply-btn-secondary"
                onClick={onClose}
              >
                Close
              </button>
              <button
                type="button"
                className="apply-btn-primary"
                onClick={() => {
                  onClose();
                  if (onNavigateToApplications) {
                    onNavigateToApplications(submittedApp?.applicationId || attemptId || undefined);
                  }
                }}
              >
                <span>View Application</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* View 5: Truthful Failure / Blocked */}
        {view === 'failure' && (
          <>
            <div className="apply-dialog-body apply-failure-view">
              <div className={`apply-failure-icon-wrap ${orchestratorState?.status === 'BLOCKED_BY_CAPTCHA' ? 'blocked' : ''}`}>
                <AlertCircle size={30} />
              </div>
              <h4 className="apply-failure-title">Application could not be completed</h4>
              <div className="apply-failure-reason">
                {errorMessage || 'Employer site unavailable or rejected automated submission.'}
              </div>

              {(job.applicationUrl || job.sourceUrl) && (
                <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: 4 }}>
                  You can still complete this application directly on the employer site.
                </p>
              )}
            </div>

            <div className="apply-dialog-footer">
              <button
                type="button"
                className="apply-btn-secondary"
                onClick={onClose}
              >
                Close
              </button>
              {(job.applicationUrl || job.sourceUrl) && (
                <a
                  href={job.applicationUrl || job.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="apply-btn-primary"
                  style={{ textDecoration: 'none' }}
                >
                  <span>Open Employer Site</span>
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
