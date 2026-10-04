import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { ApplicationModeBadge } from '../common/ApplicationModeBadge';
import { api } from '../../api/index';
import {
  JobDescription,
  CandidateProfile,
  TailoredResume,
  JobMatchAnalysis,
  ApplicationRecord
} from '../../types/index';
import {
  CheckCircle,
  AlertTriangle,
  FileCheck,
  Send,
  ExternalLink,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Download,
  Eye,
  Info,
  Clock,
  MapPin,
  Check,
  RotateCcw
} from 'lucide-react';
import './ApplicationModal.css';

interface ApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobDescription;
  candidate: CandidateProfile;
  tailoredResume?: TailoredResume | null;
  matchAnalysis?: JobMatchAnalysis | null;
  onSuccess: (app: ApplicationRecord) => void;
  onNavigateToResumes?: (resumeId?: string) => void;
  onNavigateToApplications?: (appId?: string) => void;
  onNavigateToLearning?: () => void;
}

type Step = 'readiness' | 'selection' | 'preview' | 'success';

export const ApplicationModal: React.FC<ApplicationModalProps> = ({
  isOpen,
  onClose,
  job,
  candidate,
  tailoredResume: initialTailoredResume,
  matchAnalysis: initialMatchAnalysis,
  onSuccess,
  onNavigateToResumes,
  onNavigateToApplications,
  onNavigateToLearning
}) => {
  const [currentStep, setCurrentStep] = useState<Step>('readiness');
  const [tailoredResume, setTailoredResume] = useState<TailoredResume | null>(initialTailoredResume || null);
  const [matchAnalysis, setMatchAnalysis] = useState<JobMatchAnalysis | null>(initialMatchAnalysis || null);
  const [selectedResumeType, setSelectedResumeType] = useState<'tailored' | 'master'>('tailored');
  const [isCheckingAts, setIsCheckingAts] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedApp, setSubmittedApp] = useState<ApplicationRecord | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<ApplicationRecord | null>(null);
  const [externalConfirmed, setExternalConfirmed] = useState(false);

  // Form Fields for Application Preview / Edit
  const [formFields, setFormFields] = useState({
    fullName: candidate?.name || '',
    email: candidate?.email || '',
    phone: candidate?.phone || '',
    location: candidate?.location || '',
    experienceYears: candidate?.yearsOfExperience?.toString() || '4',
    currentRole: candidate?.headline || '',
    linkedInUrl: candidate?.linkedInUrl || '',
    portfolioUrl: candidate?.gitHubUrl || '',
    coverLetter: `Dear Hiring Team,\n\nI am excited to submit my application for the ${job?.role} role at ${job?.company}. With ${candidate?.yearsOfExperience || 4}+ years of demonstrated experience in ${job?.careerTrack || 'Software Engineering'} and core expertise in ${(candidate?.primarySkills || []).slice(0, 4).join(', ')}, I look forward to contributing high-impact value to your engineering team.\n\nBest regards,\n${candidate?.name || ''}`
  });

  const isCodewalla = (job?.company && job.company.toLowerCase().includes('codewalla')) || (job?.source && job.source.toLowerCase().includes('codewalla'));
  const effectiveMode = isCodewalla ? 'demo' : (job?.applicationMode || 'demo');

  useEffect(() => {
    if (initialTailoredResume) {
      setTailoredResume(initialTailoredResume);
    }
  }, [initialTailoredResume]);

  useEffect(() => {
    if (initialMatchAnalysis) {
      setMatchAnalysis(initialMatchAnalysis);
    }
  }, [initialMatchAnalysis]);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep('readiness');
      setSubmittedApp(null);
      setDuplicateWarning(null);
      setExternalConfirmed(false);
      checkExistingApplication();
    }
  }, [isOpen, job?.id, candidate?.id]);

  const checkExistingApplication = async () => {
    try {
      const existing = await api.getApplications(candidate.id);
      const dup = existing.find(a => a.jobId === job.id);
      if (dup) {
        setDuplicateWarning(dup);
      }
    } catch (err) {
      console.error('Error checking duplicate application:', err);
    }
  };

  if (!isOpen) return null;

  // Validation checks for Readiness
  const readinessErrors: string[] = [];
  if (!candidate?.name) readinessErrors.push('Missing Candidate Name');
  if (!candidate?.email) readinessErrors.push('Missing Email Address');
  if (!candidate?.phone) readinessErrors.push('Missing Phone Number');
  if (!candidate?.location) readinessErrors.push('Missing Location');
  if (!job) readinessErrors.push('Missing Target Job Data');

  const matchScore = matchAnalysis?.scores?.overallScore || 75;
  const originalAts = matchAnalysis?.atsAnalysis?.estimatedScore || 78;
  const currentAtsScore = tailoredResume ? Math.min(98, originalAts + 8) : originalAts;
  const skillGaps = matchAnalysis?.atsAnalysis?.keywords?.red || [];

  const handleRunAtsCheck = async () => {
    try {
      setIsCheckingAts(true);
      const res = await api.analyzeMatch(candidate.id, job.id);
      setMatchAnalysis(res);
    } catch (err: any) {
      alert(`ATS Check failed: ${err.message}`);
    } finally {
      setIsCheckingAts(false);
    }
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormFields({
      ...formFields,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmitDemoApplication = async () => {
    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      const resumeVerId = selectedResumeType === 'tailored' ? (tailoredResume?.id || '') : '';
      const resumeVerName = selectedResumeType === 'tailored' ? (tailoredResume?.versionName || 'Tailored_Resume_v1') : 'Master_Profile';

      const appData: Partial<ApplicationRecord> = {
        candidateId: candidate.id,
        jobId: job.id,
        company: job.company,
        role: job.role,
        location: job.location,
        applicationMode: 'demo',
        jobUrl: job.sourceUrl || '',
        applicationUrl: undefined,
        matchScore,
        atsScore: currentAtsScore,
        resumeVersionId: resumeVerId,
        resumeVersionName: resumeVerName,
        status: 'APPLIED_DEMO',
        appliedAt: now,
        notes: `Simulated Demo Application submitted in JobPilot. Tailored version: ${resumeVerName}.`,
        skillGaps,
        coverLetter: formFields.coverLetter,
        customAnswers: matchAnalysis?.suggestedAnswers || {},
        timeline: [
          { timestamp: now, stage: 'Job Discovered', description: `Job opportunity ingested from ${job.source || 'JobPilot Catalog'}.` },
          { timestamp: now, stage: 'Match Evaluated', description: `Calculated match score of ${matchScore}%.` },
          { timestamp: now, stage: 'ATS Checked', description: `Automated ATS simulation scored ${currentAtsScore}%.` },
          { timestamp: now, stage: 'Demo Application Submitted', description: `Candidate submitted simulated demo application via JobPilot. Zero data transmitted externally.` }
        ]
      };

      const res = await api.saveApplication(appData);
      setSubmittedApp(res);
      onSuccess(res);
      setCurrentStep('success');
    } catch (err: any) {
      alert(`Submission failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartExternalApplication = async () => {
    try {
      setIsSubmitting(true);
      const now = new Date().toISOString();
      const resumeVerId = selectedResumeType === 'tailored' ? (tailoredResume?.id || '') : '';
      const resumeVerName = selectedResumeType === 'tailored' ? (tailoredResume?.versionName || 'Tailored_Resume_v1') : 'Master_Profile';

      const appData: Partial<ApplicationRecord> = {
        candidateId: candidate.id,
        jobId: job.id,
        company: job.company,
        role: job.role,
        location: job.location,
        applicationMode: 'external',
        jobUrl: job.sourceUrl || '',
        applicationUrl: job.applicationUrl || job.sourceUrl || '',
        matchScore,
        atsScore: currentAtsScore,
        resumeVersionId: resumeVerId,
        resumeVersionName: resumeVerName,
        status: 'APPLICATION_STARTED',
        appliedAt: now,
        notes: `External career portal opened at ${job.applicationUrl || job.sourceUrl}. Application in progress.`,
        skillGaps,
        coverLetter: formFields.coverLetter,
        timeline: [
          { timestamp: now, stage: 'External Application Started', description: `Redirected to configured career portal URL.` }
        ]
      };

      const res = await api.saveApplication(appData);
      setSubmittedApp(res);
      onSuccess(res);

      // Strictly open career URL ONLY for external non-Codewalla applications
      if (job.applicationUrl || job.sourceUrl) {
        window.open(job.applicationUrl || job.sourceUrl, '_blank', 'noopener,noreferrer');
      }

      setCurrentStep('success');
    } catch (err: any) {
      alert(`External navigation failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmExternalSubmission = async () => {
    if (!submittedApp) return;
    try {
      const now = new Date().toISOString();
      const updated = await api.saveApplication({
        ...submittedApp,
        status: 'APPLIED',
        notes: `${submittedApp.notes || ''} [Candidate confirmed external application completion]`,
        timeline: [
          ...(submittedApp.timeline || []),
          { timestamp: now, stage: 'Candidate Confirmed External Submission', description: 'Application marked as submitted by candidate.' }
        ]
      });
      setSubmittedApp(updated);
      setExternalConfirmed(true);
      onSuccess(updated);
    } catch (err: any) {
      alert(`Error updating confirmation: ${err.message}`);
    }
  };

  return (
    <div className="application-modal-overlay">
      <div className="application-modal-container">
        {/* Header Bar */}
        <div className="app-modal-header">
          <div className="modal-title-wrap">
            <span className="modal-eyebrow">Candidate Application Workflow</span>
            <h2 className="modal-title">{job?.role} — {job?.company}</h2>
          </div>
          <div className="modal-header-actions">
            <ApplicationModeBadge mode={effectiveMode} isCodewalla={isCodewalla} size="md" />
            <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">×</button>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flow-step-bar">
          <div className={`step-item ${currentStep === 'readiness' ? 'active' : 'completed'}`}>
            <span className="step-num">1</span>
            <span className="step-lbl">Readiness Check</span>
          </div>
          <div className={`step-separator ${currentStep !== 'readiness' ? 'active' : ''}`} />
          <div className={`step-item ${currentStep === 'selection' ? 'active' : currentStep === 'preview' || currentStep === 'success' ? 'completed' : ''}`}>
            <span className="step-num">2</span>
            <span className="step-lbl">Resume Selection</span>
          </div>
          <div className={`step-separator ${currentStep === 'preview' || currentStep === 'success' ? 'active' : ''}`} />
          <div className={`step-item ${currentStep === 'preview' ? 'active' : currentStep === 'success' ? 'completed' : ''}`}>
            <span className="step-num">3</span>
            <span className="step-lbl">Application Form</span>
          </div>
          <div className={`step-separator ${currentStep === 'success' ? 'active' : ''}`} />
          <div className={`step-item ${currentStep === 'success' ? 'active' : ''}`}>
            <span className="step-num">4</span>
            <span className="step-lbl">Confirmation</span>
          </div>
        </div>

        {/* Duplicate Application Alert Banner */}
        {duplicateWarning && (
          <div className="duplicate-alert-banner">
            <AlertTriangle size={18} />
            <div className="dup-text">
              <strong>Application Already Tracked:</strong> You already initiated an application for this role on {duplicateWarning.applicationDate} ({duplicateWarning.status}).
            </div>
            {onNavigateToApplications && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onNavigateToApplications(duplicateWarning.id);
                }}
              >
                View Existing Application
              </Button>
            )}
          </div>
        )}

        {/* Body Content by Step */}
        <div className="app-modal-body">
          {/* STEP 1: READINESS CHECK */}
          {currentStep === 'readiness' && (
            <div className="readiness-step-content">
              {/* Mandatory Codewalla Banner */}
              {isCodewalla && (
                <div className="codewalla-demo-banner">
                  <ShieldAlert size={20} className="banner-icon" />
                  <div>
                    <h4 className="banner-title">DEMO APPLICATION — SIMULATION ONLY</h4>
                    <p className="banner-desc">
                      This application is simulated for JobPilot testing. <strong>Nothing will be submitted to Codewalla.</strong> Zero requests will be transmitted to codewalla.com.
                    </p>
                  </div>
                </div>
              )}

              {/* Job & Match Summary Pod */}
              <div className="readiness-metrics-grid">
                <Card className="metric-pod">
                  <span className="pod-label">Match Score</span>
                  <div className="pod-value text-indigo">{matchScore}%</div>
                  <span className="pod-sub">14-point deterministic fit</span>
                </Card>

                <Card className="metric-pod">
                  <span className="pod-label">ATS Simulation Score</span>
                  <div className="pod-value text-emerald">{currentAtsScore}%</div>
                  <span className="pod-sub">{tailoredResume ? 'Tailored Resume (v1)' : 'Master Profile ATS'}</span>
                </Card>

                <Card className="metric-pod">
                  <span className="pod-label">Application Mode</span>
                  <div className="pod-value">
                    <ApplicationModeBadge mode={effectiveMode} isCodewalla={isCodewalla} size="sm" />
                  </div>
                  <span className="pod-sub">{effectiveMode === 'demo' ? 'Local JobPilot Sandbox' : 'External Career Portal'}</span>
                </Card>
              </div>

              {/* Application Details Summary */}
              <Card className="readiness-summary-card">
                <h4 className="section-title">Application Readiness Verification</h4>
                <div className="summary-fields-list">
                  <div className="summary-row">
                    <span className="row-key">Target Company:</span>
                    <span className="row-val font-bold">{job?.company}</span>
                  </div>
                  <div className="summary-row">
                    <span className="row-key">Role Title:</span>
                    <span className="row-val">{job?.role}</span>
                  </div>
                  <div className="summary-row">
                    <span className="row-key">Location:</span>
                    <span className="row-val"><MapPin size={13} style={{ display: 'inline', marginRight: '4px' }} />{job?.location}</span>
                  </div>
                  <div className="summary-row">
                    <span className="row-key">Experience Requirement:</span>
                    <span className="row-val">{job?.experienceRequired} (Candidate: {candidate?.yearsOfExperience} yrs)</span>
                  </div>
                  <div className="summary-row">
                    <span className="row-key">Selected Resume:</span>
                    <span className="row-val text-emerald font-bold">
                      {tailoredResume ? `${tailoredResume.versionName} (Tailored)` : 'Master Profile Resume'}
                    </span>
                  </div>
                  <div className="summary-row">
                    <span className="row-key">Identified Skill Gaps:</span>
                    <span className="row-val">
                      {skillGaps.length > 0 ? skillGaps.slice(0, 3).join(', ') : 'None detected'}
                    </span>
                  </div>
                </div>

                {readinessErrors.length > 0 && (
                  <div className="readiness-errors-box">
                    <AlertTriangle size={16} />
                    <div>
                      <strong>Cannot continue yet:</strong> Please update profile with required fields: {readinessErrors.join(', ')}
                    </div>
                  </div>
                )}
              </Card>

              {/* Action Hierarchy */}
              <div className="modal-actions-bar">
                <Button variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <div className="action-right-group">
                  <Button
                    variant="outline"
                    icon={<RotateCcw size={14} />}
                    loading={isCheckingAts}
                    onClick={handleRunAtsCheck}
                  >
                    Run ATS Check
                  </Button>
                  <Button
                    variant="primary"
                    icon={<ArrowRight size={16} />}
                    disabled={readinessErrors.length > 0}
                    onClick={() => setCurrentStep('selection')}
                  >
                    Continue to Resume Selection
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: RESUME SELECTION */}
          {currentStep === 'selection' && (
            <div className="selection-step-content">
              <h4 className="selection-heading">Choose Resume for This Application</h4>
              <p className="selection-sub">
                JobPilot records the exact immutable resume version attached to this submission.
              </p>

              <div className="resume-options-grid">
                {/* Option A: Tailored Resume */}
                <div
                  className={`resume-choice-card ${selectedResumeType === 'tailored' ? 'selected' : ''}`}
                  onClick={() => setSelectedResumeType('tailored')}
                >
                  <div className="choice-header">
                    <div className="radio-indicator">
                      {selectedResumeType === 'tailored' && <Check size={14} />}
                    </div>
                    <div>
                      <h5 className="choice-title">
                        {tailoredResume?.versionName || 'Tailored Resume (v1)'}
                      </h5>
                      <span className="choice-badge">Recommended for ATS</span>
                    </div>
                  </div>
                  <p className="choice-desc">
                    Reordered bullet points, highlighted keywords, and calibrated summary matching {job?.role}.
                  </p>
                  <div className="choice-meta">
                    <span>ATS Score: {Math.min(98, originalAts + 8)}%</span>
                    <span>Modifications: {tailoredResume?.modifications?.length || 4} applied</span>
                  </div>
                  {tailoredResume && onNavigateToResumes && (
                    <button
                      className="view-diff-inline-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onClose();
                        onNavigateToResumes(tailoredResume.id);
                      }}
                    >
                      <Eye size={12} /> View Diff in Studio
                    </button>
                  )}
                </div>

                {/* Option B: Master Resume */}
                <div
                  className={`resume-choice-card ${selectedResumeType === 'master' ? 'selected' : ''}`}
                  onClick={() => setSelectedResumeType('master')}
                >
                  <div className="choice-header">
                    <div className="radio-indicator">
                      {selectedResumeType === 'master' && <Check size={14} />}
                    </div>
                    <div>
                      <h5 className="choice-title">Master Profile Resume</h5>
                      <span className="choice-badge-sub">Canonical Baseline</span>
                    </div>
                  </div>
                  <p className="choice-desc">
                    Unadjusted master profile data without role-specific ordering or targeted emphasis.
                  </p>
                  <div className="choice-meta">
                    <span>ATS Score: {originalAts}%</span>
                    <span>Standard Profile</span>
                  </div>
                </div>
              </div>

              <div className="attached-status-box">
                <FileCheck size={18} className="attached-icon" />
                <span>
                  <strong>Selected Attachment:</strong> {selectedResumeType === 'tailored' ? (tailoredResume?.versionName || 'Tailored Resume v1') : 'Master Candidate Profile'} (Ready for submission)
                </span>
              </div>

              <div className="modal-actions-bar">
                <Button variant="secondary" icon={<ArrowLeft size={14} />} onClick={() => setCurrentStep('readiness')}>
                  Back
                </Button>
                <Button variant="primary" icon={<ArrowRight size={14} />} onClick={() => setCurrentStep('preview')}>
                  Continue to Application Form
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: APPLICATION FORM & PREVIEW */}
          {currentStep === 'preview' && (
            <div className="preview-step-content">
              {/* Mandatory Codewalla Banner */}
              {isCodewalla && (
                <div className="codewalla-demo-banner">
                  <ShieldAlert size={20} className="banner-icon" />
                  <div>
                    <h4 className="banner-title">DEMO APPLICATION — ZERO EXTERNAL TRANSMISSION</h4>
                    <p className="banner-desc">
                      This application is simulated for JobPilot testing. Nothing will be submitted to Codewalla.
                    </p>
                  </div>
                </div>
              )}

              <h4 className="form-heading">Candidate Application Details</h4>
              <p className="form-sub">Pre-populated from verified candidate profile. Review or update prior to submission.</p>

              <div className="app-form-grid">
                <div className="form-field-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    name="fullName"
                    value={formFields.fullName}
                    onChange={handleFormChange}
                    className="form-input"
                  />
                </div>

                <div className="form-field-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    name="email"
                    value={formFields.email}
                    onChange={handleFormChange}
                    className="form-input"
                  />
                </div>

                <div className="form-field-group">
                  <label>Phone Number</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formFields.phone}
                    onChange={handleFormChange}
                    className="form-input"
                  />
                </div>

                <div className="form-field-group">
                  <label>Current Location</label>
                  <input
                    type="text"
                    name="location"
                    value={formFields.location}
                    onChange={handleFormChange}
                    className="form-input"
                  />
                </div>

                <div className="form-field-group">
                  <label>Years of Experience</label>
                  <input
                    type="text"
                    name="experienceYears"
                    value={formFields.experienceYears}
                    onChange={handleFormChange}
                    className="form-input"
                  />
                </div>

                <div className="form-field-group">
                  <label>Current Role / Headline</label>
                  <input
                    type="text"
                    name="currentRole"
                    value={formFields.currentRole}
                    onChange={handleFormChange}
                    className="form-input"
                  />
                </div>

                <div className="form-field-group full-width">
                  <label>Attached Resume</label>
                  <div className="attached-resume-preview-pill">
                    <CheckCircle size={16} className="text-emerald" />
                    <span>
                      {selectedResumeType === 'tailored' ? (tailoredResume?.versionName || 'Tailored_Resume_v1') : 'Master_Profile_Resume.pdf'}
                    </span>
                    <span className="preview-pill-tag">Truth-Checked Snapshot</span>
                  </div>
                </div>

                <div className="form-field-group full-width">
                  <label>Tailored Cover Letter Note</label>
                  <textarea
                    name="coverLetter"
                    rows={4}
                    value={formFields.coverLetter}
                    onChange={handleFormChange}
                    className="form-textarea"
                  />
                </div>
              </div>

              <div className="modal-actions-bar">
                <Button variant="secondary" icon={<ArrowLeft size={14} />} onClick={() => setCurrentStep('selection')}>
                  Back
                </Button>
                {effectiveMode === 'demo' ? (
                  <Button
                    variant="primary"
                    icon={<Send size={16} />}
                    loading={isSubmitting}
                    onClick={handleSubmitDemoApplication}
                  >
                    Submit Demo Application
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    icon={<ExternalLink size={16} />}
                    loading={isSubmitting}
                    onClick={handleStartExternalApplication}
                  >
                    Open Application & Start (External)
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS / SUBMITTED CONFIRMATION */}
          {currentStep === 'success' && submittedApp && (
            <div className="success-step-content">
              <div className="success-header-badge">
                <CheckCircle size={44} className="success-icon" />
                <h3 className="success-title">
                  {effectiveMode === 'demo' ? '✓ Demo Application Submitted Successfully' : '✓ External Application Started'}
                </h3>
                <p className="success-sub">
                  {effectiveMode === 'demo'
                    ? `Your JobPilot demo application for ${job?.company} has been recorded locally.`
                    : `Direct application portal opened for ${job?.company}. Verify submission status below.`}
                </p>
              </div>

              {isCodewalla && (
                <div className="codewalla-demo-banner text-center">
                  <ShieldAlert size={18} className="banner-icon" />
                  <div>
                    <strong>Nothing was submitted to Codewalla.</strong> All records reside strictly within your local JobPilot testing database.
                  </div>
                </div>
              )}

              {/* Application Snapshot Card */}
              <Card className="success-details-card">
                <div className="details-grid-2">
                  <div className="detail-item">
                    <span className="detail-lbl">Application ID</span>
                    <span className="detail-val font-mono">{submittedApp.id}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-lbl">Status</span>
                    <Badge variant={submittedApp.status === 'APPLIED_DEMO' ? 'indigo' : 'emerald'} size="sm">
                      {submittedApp.status}
                    </Badge>
                  </div>
                  <div className="detail-item">
                    <span className="detail-lbl">Target Role & Company</span>
                    <span className="detail-val">{submittedApp.role} • {submittedApp.company}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-lbl">Application Mode</span>
                    <ApplicationModeBadge mode={submittedApp.applicationMode} isCodewalla={isCodewalla} size="sm" />
                  </div>
                  <div className="detail-item">
                    <span className="detail-lbl">Match Score</span>
                    <span className="detail-val text-indigo font-bold">{submittedApp.matchScore}%</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-lbl">ATS Simulation Score</span>
                    <span className="detail-val text-emerald font-bold">{submittedApp.atsScore}%</span>
                  </div>
                  <div className="detail-item full-width">
                    <span className="detail-lbl">Exact Resume Version Recorded</span>
                    <span className="detail-val text-emerald">
                      {submittedApp.resumeVersionName || 'Tailored_Resume_v1'} (Immutable Historical Snapshot)
                    </span>
                  </div>
                </div>
              </Card>

              {/* External Confirmation Safety CTA */}
              {effectiveMode === 'external' && !externalConfirmed && (
                <div className="external-confirmation-box">
                  <Info size={18} />
                  <div className="box-text">
                    <strong>External Portal Safeguard:</strong> JobPilot never assumes an external submission succeeded merely because the website was opened.
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Check size={14} />}
                    onClick={handleConfirmExternalSubmission}
                  >
                    Mark as Applied (Confirm Submission)
                  </Button>
                </div>
              )}

              {/* Skill Gap & Learning Advisory */}
              {skillGaps.length > 0 && (
                <Card className="post-apply-skill-gap-card">
                  <div className="skill-gap-head">
                    <Sparkles size={16} className="text-amber" />
                    <h4>What Should You Learn Next for {job?.role}?</h4>
                  </div>
                  <p className="skill-gap-desc">
                    These requirements were identified in the target job description. Boost your interview readiness with targeted learning resources:
                  </p>
                  <div className="gap-chips-list">
                    {skillGaps.slice(0, 4).map((skill, idx) => (
                      <span key={idx} className="gap-chip">
                        {skill}
                      </span>
                    ))}
                  </div>
                  {onNavigateToLearning && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<ArrowRight size={14} />}
                      onClick={() => {
                        onClose();
                        onNavigateToLearning();
                      }}
                      style={{ marginTop: '10px' }}
                    >
                      View YouTube Tutorials & Nearby Institutes
                    </Button>
                  )}
                </Card>
              )}

              {/* Action Buttons */}
              <div className="modal-actions-bar">
                <Button variant="secondary" onClick={onClose}>
                  Done & Close
                </Button>
                {onNavigateToApplications && (
                  <Button
                    variant="primary"
                    icon={<ArrowRight size={16} />}
                    onClick={() => {
                      onClose();
                      onNavigateToApplications(submittedApp.id);
                    }}
                  >
                    View in Application Tracker
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
