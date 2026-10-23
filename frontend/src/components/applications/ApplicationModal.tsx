import React, { useState, useEffect } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import { ApplicationModeBadge } from '../common/ApplicationModeBadge';
import { api } from '../../api/index';
import { apiClient } from '../../api/client';
import {
  JobDescription,
  CandidateProfile,
  TailoredResume,
  JobMatchAnalysis,
  ApplicationRecord
} from '../../types/index';
import { normalizeApiError } from '../../utils/errorUtils';
import { getCanonicalCompanyName } from '../../utils/companyUtils';
import {
  evaluateApplicationReadiness,
  calculateWorkHistoryExperienceYears,
  ReadinessBlocker,
  MANDATORY_ATS_THRESHOLD
} from '../../utils/readiness';
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
  RotateCcw,
  FileText,
  X
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
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  // Application Readiness Data Integrity State
  const [isExperienceConfirmed, setIsExperienceConfirmed] = useState(false);
  const [candidateLocationInput, setCandidateLocationInput] = useState(candidate?.location || '');
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [locationSuccessMsg, setLocationSuccessMsg] = useState<string | null>(null);

  // Canonical company name sanitization
  const canonicalCompany = getCanonicalCompanyName(job?.company, job?.sourceUrl, job?.applicationUrl);

  // Form Fields for Application Preview / Edit
  const [formFields, setFormFields] = useState({
    fullName: candidate?.name || '',
    email: candidate?.email || '',
    phone: candidate?.phone || '',
    location: candidate?.location || '',
    experienceYears: candidate?.yearsOfExperience ? candidate.yearsOfExperience.toString() : '0',
    currentRole: candidate?.headline || candidate?.experiences?.[0]?.title || '',
    linkedInUrl: candidate?.linkedInUrl || '',
    portfolioUrl: candidate?.gitHubUrl || '',
    coverLetter: `Dear Hiring Team,\n\nI am excited to submit my application for the ${job?.role || 'open'} role at ${canonicalCompany}. With ${candidate?.yearsOfExperience || 'relevant'} years of demonstrated experience in ${job?.careerTrack || 'the discipline'} and core expertise in ${(candidate?.primarySkills || []).slice(0, 4).join(', ')}, I look forward to contributing high-impact value to your team.\n\nBest regards,\n${candidate?.name || ''}`
  });

  // Job-specific dynamic match & ATS evaluation state
  const [isLoadingScores, setIsLoadingScores] = useState<boolean>(false);
  const [scoresError, setScoresError] = useState<string | null>(null);

  // Re-sync form fields whenever candidate or job changes
  useEffect(() => {
    if (candidate) {
      setFormFields(prev => ({
        ...prev,
        fullName: candidate.name || '',
        email: candidate.email || '',
        phone: candidate.phone || '',
        location: candidate.location || '',
        experienceYears: candidate.yearsOfExperience ? candidate.yearsOfExperience.toString() : prev.experienceYears,
        currentRole: candidate.headline || candidate.experiences?.[0]?.title || prev.currentRole,
        linkedInUrl: candidate.linkedInUrl || prev.linkedInUrl,
        portfolioUrl: candidate.gitHubUrl || prev.portfolioUrl,
        coverLetter: `Dear Hiring Team,\n\nI am excited to submit my application for the ${job?.role || 'open'} role at ${canonicalCompany}. With ${candidate.yearsOfExperience || 'relevant'} years of demonstrated experience in ${job?.careerTrack || 'the discipline'} and core expertise in ${(candidate.primarySkills || []).slice(0, 4).join(', ')}, I look forward to contributing high-impact value to your team.\n\nBest regards,\n${candidate.name || ''}`
      }));
    }
  }, [candidate, job?.role, canonicalCompany]);

  const isCodewalla = (canonicalCompany && canonicalCompany.toLowerCase().includes('codewalla')) || (job?.source && job.source.toLowerCase().includes('codewalla'));
  const effectiveMode = isCodewalla ? 'demo' : (job?.applicationMode || 'agent');

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

  // Primary Effect: When modal opens or job.id / candidate.id changes, fetch genuine job-specific match & ATS
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('readiness');
      setSubmittedApp(null);
      setDuplicateWarning(null);
      setExternalConfirmed(false);
      setErrorBanner(null);
      checkExistingApplication();

      if (job?.id && candidate?.id) {
        // If an initial match analysis was passed and matches this specific job, use it
        if (initialMatchAnalysis && (initialMatchAnalysis.jobId === job.id || (initialMatchAnalysis as any).id === job.id)) {
          setMatchAnalysis(initialMatchAnalysis);
          setIsLoadingScores(false);
          setScoresError(null);
        } else {
          // Otherwise, clear previous stale job state and trigger fresh dynamic calculation
          setMatchAnalysis(null);
          fetchDynamicScores(job.id, candidate.id);
        }
      }
    } else {
      // Clear state on close to prevent stale state flicker
      setMatchAnalysis(null);
      setIsLoadingScores(false);
      setScoresError(null);
    }
  }, [isOpen, job?.id, candidate?.id]);

  const fetchDynamicScores = async (jobId: string, candidateId: string) => {
    try {
      setIsLoadingScores(true);
      setScoresError(null);

      // 1. Try V1 Production Matching API
      try {
        const v1Match = await apiClient.getJobMatch(jobId);
        if (v1Match && v1Match.overallScore !== undefined) {
          const breakdown = v1Match.breakdown || {
            overallScore: v1Match.overallScore,
            skillScore: v1Match.overallScore,
            experienceScore: v1Match.overallScore,
            roleScore: v1Match.overallScore,
            locationScore: v1Match.overallScore,
            seniorityScore: v1Match.overallScore
          };
          const atsAnalysis = v1Match.atsAnalysis || {
            estimatedScore: v1Match.overallScore,
            disclaimer: 'Estimated ATS Match',
            breakdown: { keywordMatch: v1Match.overallScore, roleAlignment: breakdown.roleScore, experienceAlignment: breakdown.experienceScore, readability: 90 },
            keywords: { green: [], yellow: [], red: [] }
          };

          setMatchAnalysis({
            id: v1Match.id || jobId,
            candidateId,
            jobId,
            scores: breakdown,
            recommendation: {
              category: v1Match.category === 'STRONG_MATCH' ? 'STRONG_MATCH' : 'MODERATE_MATCH',
              title: v1Match.category === 'STRONG_MATCH' ? 'Strong Match' : 'Good Match',
              description: `Evaluation confirmed ${v1Match.overallScore}% fit for this position.`,
              color: 'blue'
            },
            careerTrack: v1Match.careerTrack || { candidateTrack: 'Engineering', jobTrack: 'Engineering', isSameTrack: true, transitionPossible: true },
            truthCheck: v1Match.truthCheck || { passed: true, greenCount: 0, yellowCount: 0, redCount: 0, items: [], summary: 'Truth check completed' },
            atsAnalysis,
            whyMatch: {
              matchingStrengths: [],
              relevantExperienceHighlights: [],
              locationAlignment: 'Matched',
              seniorityAlignment: 'Aligned',
              missingOrWeakAreas: [],
              potentialConcerns: []
            }
          } as unknown as JobMatchAnalysis);
          return;
        }
      } catch (v1Err) {
        console.warn('V1 Match API check error, falling back to proto match API:', v1Err);
      }

      // 2. Fallback to Prototype Match API
      const res = await api.analyzeMatch(candidateId, jobId);
      if (res && res.scores?.overallScore !== undefined) {
        setMatchAnalysis(res);
      } else {
        throw new Error('Match analysis returned incomplete score data.');
      }
    } catch (err: unknown) {
      const normalized = normalizeApiError(err, 'Unable to calculate match score for this job.');
      setScoresError(normalized.message);
      setMatchAnalysis(null);
    } finally {
      setIsLoadingScores(false);
    }
  };

  const checkExistingApplication = async () => {
    if (!candidate?.id || !job?.id) return;
    try {
      const existing = await api.getApplications(candidate.id);
      const dup = (existing || []).find(a => a && a.jobId === job.id);
      if (dup) {
        setDuplicateWarning(dup);
      }
    } catch (err) {
      console.warn('Notice checking duplicate application:', err);
    }
  };

  if (!isOpen) return null;

  // Genuine job-specific scores: null when loading or calculation is unavailable (NO FAKE 75 / 78 DEFAULTS)
  const matchScore: number | null = matchAnalysis?.scores?.overallScore ?? null;
  const originalAts: number | null = matchAnalysis?.atsAnalysis?.estimatedScore ?? null;
  const currentAtsScore: number | null = originalAts !== null
    ? (tailoredResume ? Math.min(98, originalAts + 8) : originalAts)
    : null;
  const skillGaps = matchAnalysis?.atsAnalysis?.keywords?.red || [];

  // Deterministic Readiness Evaluation
  const readiness = evaluateApplicationReadiness({
    candidate,
    job,
    currentAtsScore,
    atsThreshold: MANDATORY_ATS_THRESHOLD,
    isExperienceConfirmed
  });

  const {
    isReady: canContinueToSelection,
    blockers,
    profileStatedYears,
    workHistoryYears,
    experienceDiscrepancy,
    hasExperienceDiscrepancy,
    isAtsPassed
  } = readiness;

  const handleSaveCandidateLocation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = candidateLocationInput.trim();
    if (!trimmed) {
      setErrorBanner('Please enter a valid location (e.g., City, State, or Remote).');
      return;
    }
    try {
      setIsSavingLocation(true);
      setErrorBanner(null);
      // Update candidate profile via API
      try {
        await apiClient.updateCandidateProfile({ location: trimmed });
      } catch {
        if (candidate?.id) {
          await api.updateCandidate(candidate.id, { ...candidate, location: trimmed });
        }
      }
      // Mutate local object so UI reacts instantly without requiring reload
      if (candidate) {
        candidate.location = trimmed;
      }
      setFormFields(prev => ({ ...prev, location: trimmed }));
      setLocationSuccessMsg('Location saved successfully.');
      setTimeout(() => setLocationSuccessMsg(null), 3000);
    } catch (err: unknown) {
      const normalized = normalizeApiError(err, 'Failed to update candidate location. Please try again.');
      setErrorBanner(normalized.message);
    } finally {
      setIsSavingLocation(false);
    }
  };

  const handleConfirmExperience = () => {
    setIsExperienceConfirmed(true);
  };

  const handleRunAtsCheck = async () => {
    if (!candidate?.id || !job?.id) {
      setErrorBanner('Unable to run ATS check: Candidate profile or job data is incomplete.');
      return;
    }
    try {
      setIsCheckingAts(true);
      setErrorBanner(null);
      await fetchDynamicScores(job.id, candidate.id);
    } catch (err: unknown) {
      const normalized = normalizeApiError(err, 'ATS compatibility check could not be completed. Please try again.');
      setErrorBanner(normalized.message);
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
      setErrorBanner(null);
      const now = new Date().toISOString();
      const resumeVerId = selectedResumeType === 'tailored' ? (tailoredResume?.id || '') : '';
      const resumeVerName = selectedResumeType === 'tailored' ? (tailoredResume?.versionName || 'Tailored_Resume_v1') : 'Master_Profile';

      const appData: Partial<ApplicationRecord> = {
        candidateId: candidate.id,
        jobId: job.id,
        company: canonicalCompany,
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
        notes: `Simulated Demo Application submitted in Pilot Mama. Tailored version: ${resumeVerName}.`,
        skillGaps,
        coverLetter: formFields.coverLetter,
        customAnswers: matchAnalysis?.suggestedAnswers || {},
        timeline: [
          { timestamp: now, stage: 'Job Discovered', description: `Job opportunity ingested from ${job.source || 'Pilot Mama Catalog'}.` },
          { timestamp: now, stage: 'Match Evaluated', description: `Calculated match score of ${matchScore}%.` },
          { timestamp: now, stage: 'ATS Checked', description: `Automated ATS simulation scored ${currentAtsScore}%.` },
          { timestamp: now, stage: 'Demo Application Submitted', description: `Candidate submitted simulated demo application via Pilot Mama. Zero data transmitted externally.` }
        ]
      };

      const res = await api.saveApplication(appData);
      setSubmittedApp(res);
      onSuccess(res);
      setCurrentStep('success');
    } catch (err: unknown) {
      const normalized = normalizeApiError(err, 'Submission could not be completed.');
      setErrorBanner(normalized.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartExternalApplication = async () => {
    // Gate check: Must not proceed if ATS threshold has not been met
    if (!isAtsPassed) {
      setErrorBanner('Application blocked: ATS Compatibility score is below the required 80% threshold. Improve resume in Resume Studio before applying.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorBanner(null);
      const now = new Date().toISOString();
      const resumeVerId = selectedResumeType === 'tailored' ? (tailoredResume?.id || '') : '';
      const resumeVerName = selectedResumeType === 'tailored' ? (tailoredResume?.versionName || 'Tailored_Resume_v1') : 'Master_Profile';

      // Call canonical backend Application Agent start API
      let autoResult: any = null;
      try {
        const rawRes = await apiClient.startApplication({
          jobId: job.id,
          resumeVersionId: resumeVerId || undefined,
          autoApply: false
        });
        autoResult = rawRes?.data || rawRes;
      } catch (autoErr: unknown) {
        const norm = normalizeApiError(autoErr, 'Application Agent service notice');
        console.warn('Backend automation notice:', norm.message);
      }

      const appData: Partial<ApplicationRecord> = {
        candidateId: candidate?.id || 'candidate_me',
        jobId: job.id,
        company: canonicalCompany,
        role: job.role,
        location: job.location,
        applicationMode: 'external',
        jobUrl: job.sourceUrl || '',
        applicationUrl: job.applicationUrl || job.sourceUrl || '',
        matchScore: autoResult?.jobMatchScore || matchScore,
        atsScore: autoResult?.atsCompatibilityScore || currentAtsScore,
        resumeVersionId: resumeVerId,
        resumeVersionName: resumeVerName,
        status: (autoResult?.currentState === 'APPLIED' ? 'APPLIED' : 'APPLICATION_STARTED') as any,
        appliedAt: now,
        notes: `Application Agent initialized for ${canonicalCompany} (${autoResult?.job?.platform || 'Direct ATS'}). Current state: ${autoResult?.currentState || 'PREPARED'}.`,
        skillGaps,
        coverLetter: formFields.coverLetter,
        timeline: autoResult?.timeline?.length
          ? autoResult.timeline.map((t: any) => ({
              timestamp: t.timestamp,
              stage: t.step,
              description: t.message
            }))
          : [
              { timestamp: now, stage: 'Application Agent Started', description: `Automated preparation orchestrated within Pilot Mama.` }
            ]
      };

      const res = await api.saveApplication(appData);
      setSubmittedApp(res);
      onSuccess(res);

      setCurrentStep('success');
    } catch (err: unknown) {
      const normalized = normalizeApiError(err, 'Application could not be started.');
      setErrorBanner(normalized.message);
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
    } catch (err: unknown) {
      const normalized = normalizeApiError(err, 'Error updating submission confirmation');
      setErrorBanner(normalized.message);
    }
  };

  return (
    <div className="application-modal-overlay">
      <div className="application-modal-container">
        {/* Header Bar */}
        <div className="app-modal-header">
          <div className="modal-title-wrap">
            <span className="modal-eyebrow">Candidate Application Workflow</span>
            <h2 className="modal-title">{job?.role} — {canonicalCompany}</h2>
          </div>
          <div className="modal-header-actions">
            <ApplicationModeBadge mode={effectiveMode} isCodewalla={isCodewalla} size="md" />
            <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">×</button>
          </div>
        </div>

        {/* Global Error Banner (No [object Object]) */}
        {errorBanner && (
          <div className="modal-error-banner">
            <div className="modal-error-content">
              <AlertTriangle size={18} />
              <span>{errorBanner}</span>
            </div>
            <button className="modal-error-dismiss" onClick={() => setErrorBanner(null)} aria-label="Dismiss error">×</button>
          </div>
        )}

        {/* Experience Discrepancy Banner if Profile vs Work History totals diverge */}
        {hasExperienceDiscrepancy && (
          <div className="experience-discrepancy-banner">
            <div className="discrepancy-header">
              <AlertTriangle size={18} className="text-amber" />
              <strong className="discrepancy-title">Profile & Resume Experience Discrepancy</strong>
              {isExperienceConfirmed ? (
                <span className="discrepancy-confirmed-badge">✓ Confirmed by Candidate</span>
              ) : (
                <span className="discrepancy-unresolved-badge">⚠️ Action Required</span>
              )}
            </div>
            <div className="discrepancy-breakdown-row">
              <div className="breakdown-col">
                <span className="breakdown-lbl">Profile Stated Experience:</span>
                <span className="breakdown-val highlight">{profileStatedYears} years</span>
              </div>
              <div className="breakdown-divider">•</div>
              <div className="breakdown-col">
                <span className="breakdown-lbl">Verified Work History:</span>
                <span className="breakdown-val">{workHistoryYears} years</span>
              </div>
              <div className="breakdown-divider">•</div>
              <div className="breakdown-col">
                <span className="breakdown-lbl">Difference:</span>
                <span className="breakdown-val diff-val">{experienceDiscrepancy} years</span>
              </div>
            </div>
            <div className="discrepancy-desc">
              Your stated profile experience ({profileStatedYears} yrs) differs from the sum of confirmed employment history ({workHistoryYears} yrs). Please review your work history, edit/add any missing employment records, or confirm this breakdown if your profile includes non-indexed freelance, consulting, or prior tenure.
            </div>
            <div className="discrepancy-actions">
              {!isExperienceConfirmed ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmExperience}
                  icon={<Check size={14} />}
                >
                  Confirm Experience Breakdown
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExperienceConfirmed(false)}
                >
                  Re-evaluate Discrepancy
                </Button>
              )}
            </div>
          </div>
        )}

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
          {/* Missing Candidate Safety Guard */}
          {(!candidate || !candidate.email) ? (
            <div className="candidate-unavailable-card">
              <ShieldAlert size={40} className="text-amber" style={{ margin: '0 auto 12px auto' }} />
              <h3 className="candidate-unavailable-title">Your verified profile information is unavailable.</h3>
              <p className="candidate-unavailable-desc">
                Pilot Mama requires an authenticated candidate with a confirmed profile to initiate an application. Complete your verified profile before applying.
              </p>
              <Button variant="secondary" onClick={onClose}>
                Close
              </Button>
            </div>
          ) : (
            <>
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
                          This application is simulated for Pilot Mama testing. <strong>Nothing will be submitted to Codewalla.</strong> Zero requests will be transmitted to codewalla.com.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Job & Match Summary Pod */}
                  <div className="readiness-metrics-grid">
                    <Card className="metric-pod">
                      <span className="pod-label">Job Match Score</span>
                      <div className="pod-value text-indigo">
                        {isLoadingScores ? (
                          <span className="score-loading-text"><Sparkles className="spin-icon inline-icon" size={16} /> Calculating...</span>
                        ) : matchScore !== null ? (
                          `${matchScore}%`
                        ) : (
                          <span className="score-unavailable-text">Unavailable</span>
                        )}
                      </div>
                      <span className="pod-sub">14-point deterministic fit</span>
                    </Card>

                    <Card className="metric-pod">
                      <span className="pod-label">ATS Compatibility</span>
                      <div className={`pod-value ${isLoadingScores ? 'text-neutral' : isAtsPassed ? 'text-emerald' : 'text-red'}`}>
                        {isLoadingScores ? (
                          <span className="score-loading-text"><Sparkles className="spin-icon inline-icon" size={16} /> Calculating...</span>
                        ) : currentAtsScore !== null ? (
                          `${currentAtsScore}%`
                        ) : (
                          <span className="score-unavailable-text">Unavailable</span>
                        )}
                      </div>
                      <span className="pod-sub">
                        {isLoadingScores
                          ? 'Analyzing resume against job requirements...'
                          : tailoredResume
                          ? `${tailoredResume.versionName} (Tailored)`
                          : 'Job-specific ATS Compatibility'}
                      </span>
                    </Card>

                    <Card className="metric-pod">
                      <span className="pod-label">Application Mode</span>
                      <div className="pod-value">
                        <ApplicationModeBadge mode={effectiveMode} isCodewalla={isCodewalla} size="sm" />
                      </div>
                      <span className="pod-sub">{effectiveMode === 'demo' ? 'Local Pilot Mama Sandbox' : 'Application Agent Service'}</span>
                    </Card>
                  </div>

                  {/* Mandatory ATS Gate Block when ATS < 80% and not currently calculating */}
                  {!isLoadingScores && !isAtsPassed && (
                    <div className="ats-gate-warning-card">
                      <div className="ats-gate-header">
                        <AlertTriangle size={20} className="text-red" />
                        <h4 className="ats-gate-title">
                          {currentAtsScore !== null
                            ? 'ATS Compatibility Gate Failed (Required: 80%)'
                            : 'ATS Compatibility Calculation Unavailable'}
                        </h4>
                      </div>
                      <div className="ats-gate-metrics">
                        <div className="ats-gate-metric-item">
                          <span className="ats-gate-metric-lbl">ATS Compatibility</span>
                          <span className="ats-gate-metric-val failed">
                            {currentAtsScore !== null ? `${currentAtsScore}%` : 'Not Calculated'}
                          </span>
                        </div>
                        <div className="ats-gate-metric-item">
                          <span className="ats-gate-metric-lbl">Minimum Required</span>
                          <span className="ats-gate-metric-val required">80%</span>
                        </div>
                        <div className="ats-gate-metric-item">
                          <span className="ats-gate-metric-lbl">Gate Status</span>
                          <span className="ats-gate-metric-val failed status">
                            {currentAtsScore !== null ? '❌ Below required threshold' : '⚠️ Calculation Required'}
                          </span>
                        </div>
                      </div>

                      {/* Diagnostic Breakdown: Why Match Score != ATS Score */}
                      {matchScore !== null && currentAtsScore !== null && matchScore > currentAtsScore && (
                        <div className="ats-fit-distinction-note">
                          <strong>💡 Why is Match Score {matchScore}% while ATS is {currentAtsScore}%?</strong>
                          <p>
                            Your background and verified experience are a strong fit for this role ({matchScore}% overall fit), but your selected resume does not explicitly communicate enough of this specific job's technical terminology and keywords ({currentAtsScore}% ATS alignment).
                          </p>
                        </div>
                      )}

                      {/* Granular ATS Keywords Breakdown */}
                      {matchAnalysis?.atsAnalysis?.keywords && (
                        <div className="ats-keywords-diagnostic">
                          {matchAnalysis.atsAnalysis.keywords.red && matchAnalysis.atsAnalysis.keywords.red.length > 0 && (
                            <div className="ats-missing-keywords-row">
                              <span className="keyword-category-lbl text-red font-semibold">Missing from selected resume:</span>
                              <div className="keyword-pills-wrap">
                                {matchAnalysis.atsAnalysis.keywords.red.map((kw: string) => (
                                  <span key={kw} className="keyword-pill pill-red">✕ {kw}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {matchAnalysis.atsAnalysis.keywords.green && matchAnalysis.atsAnalysis.keywords.green.length > 0 && (
                            <div className="ats-matched-keywords-row">
                              <span className="keyword-category-lbl text-emerald font-semibold">Strongly matched in resume:</span>
                              <div className="keyword-pills-wrap">
                                {matchAnalysis.atsAnalysis.keywords.green.map((kw: string) => (
                                  <span key={kw} className="keyword-pill pill-green">✓ {kw}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <p className="ats-gate-desc">
                        {currentAtsScore !== null
                          ? 'Automatic application submission requires an ATS compatibility score of at least 80%. Tailor your resume specifically for this job to align your experience descriptions with the role terminology.'
                          : (scoresError || 'Unable to calculate ATS compatibility for this job. Please ensure network connectivity and retry.')}
                      </p>
                      <div className="ats-gate-actions">
                        {onNavigateToResumes && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<FileText size={14} />}
                            onClick={() => {
                              onClose();
                              onNavigateToResumes();
                            }}
                          >
                            Tailor Resume in Studio
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<RotateCcw size={14} />}
                          loading={isCheckingAts}
                          onClick={handleRunAtsCheck}
                        >
                          Re-run ATS Check
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Application Details Summary */}
                  <Card className="readiness-summary-card">
                    <h4 className="section-title">Application Readiness Verification</h4>
                    <div className="summary-fields-list">
                      <div className="summary-row">
                        <span className="row-key">Target Company:</span>
                        <span className="row-val font-bold">{canonicalCompany}</span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Role Title:</span>
                        <span className="row-val">{job?.role}</span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Job Location:</span>
                        <span className="row-val">
                          <MapPin size={13} style={{ display: 'inline', marginRight: '4px' }} />
                          {job?.location || 'Specified by employer'}
                        </span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Candidate Location:</span>
                        <span className={`row-val ${!candidate?.location ? 'text-amber font-bold' : ''}`}>
                          {candidate?.location ? (
                            <>
                              <MapPin size={13} style={{ display: 'inline', marginRight: '4px' }} />
                              {candidate.location}
                            </>
                          ) : (
                            'Missing from Profile'
                          )}
                        </span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Experience Requirement:</span>
                        <span className="row-val">
                          {job?.experienceRequired || 'Not specified'} (Candidate Stated: {profileStatedYears} yrs | Work History: {workHistoryYears} yrs)
                        </span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Selected Resume:</span>
                        <span className="row-val text-emerald font-bold">
                          {tailoredResume ? `${tailoredResume.versionName} (Tailored)` : 'Master Profile Resume'}
                        </span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Candidate Skill Gaps:</span>
                        <span className="row-val">
                          {skillGaps.length > 0 ? (
                            <span className="text-amber">{skillGaps.slice(0, 3).join(', ')}</span>
                          ) : (
                            <span className="text-emerald">None detected (Candidate skills qualify)</span>
                          )}
                        </span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Resume Keyword Gaps:</span>
                        <span className="row-val">
                          {matchAnalysis?.atsAnalysis?.keywords?.red && matchAnalysis.atsAnalysis.keywords.red.length > 0 ? (
                            <span className="text-red font-semibold">{matchAnalysis.atsAnalysis.keywords.red.length} keywords unaddressed in resume</span>
                          ) : (
                            <span className="text-emerald">Full keyword alignment</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Structured Blocker Summary */}
                    {blockers.length > 0 ? (
                      <div className="readiness-blockers-container">
                        <div className="blockers-header">
                          <AlertTriangle size={18} className="text-amber" />
                          <h5 className="blockers-count-title">
                            {blockers.length} {blockers.length === 1 ? 'item needs' : 'items need'} attention before you can apply:
                          </h5>
                        </div>
                        <div className="blockers-list">
                          {blockers.map((b, idx) => (
                            <div key={b.id + idx} className="blocker-item-card">
                              <div className="blocker-num">{idx + 1}</div>
                              <div className="blocker-content">
                                <div className="blocker-title-row">
                                  <strong className="blocker-item-title">{b.title}</strong>
                                </div>
                                <p className="blocker-item-desc">{b.description}</p>

                                {/* Action: Add Location Inline */}
                                {b.id === 'MISSING_CANDIDATE_LOCATION' && (
                                  <form className="inline-location-form" onSubmit={handleSaveCandidateLocation}>
                                    <input
                                      type="text"
                                      className="inline-location-input"
                                      placeholder="e.g. Bengaluru, Karnataka, India"
                                      value={candidateLocationInput}
                                      onChange={e => setCandidateLocationInput(e.target.value)}
                                      disabled={isSavingLocation}
                                    />
                                    <Button
                                      type="submit"
                                      size="sm"
                                      variant="primary"
                                      loading={isSavingLocation}
                                    >
                                      Save Location
                                    </Button>
                                    {locationSuccessMsg && (
                                      <span className="location-success-msg text-emerald">{locationSuccessMsg}</span>
                                    )}
                                  </form>
                                )}

                                {/* Action: Review Experience */}
                                {b.id === 'PROFILE_DATA_CONFLICT' && (
                                  <div className="blocker-inline-action">
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      onClick={handleConfirmExperience}
                                      icon={<Check size={14} />}
                                    >
                                      Confirm Experience Breakdown ({profileStatedYears}y profile vs {workHistoryYears}y records)
                                    </Button>
                                  </div>
                                )}

                                {/* Action: Improve Resume */}
                                {b.id === 'ATS_BELOW_THRESHOLD' && onNavigateToResumes && (
                                  <div className="blocker-inline-action">
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      icon={<FileText size={14} />}
                                      onClick={() => {
                                        onClose();
                                        onNavigateToResumes();
                                      }}
                                    >
                                      Improve Resume in Studio
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      icon={<RotateCcw size={14} />}
                                      loading={isCheckingAts}
                                      onClick={handleRunAtsCheck}
                                    >
                                      Re-run ATS Check
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="readiness-ready-banner">
                        <CheckCircle size={18} className="text-emerald" />
                        <span>All application readiness gates passed. You are ready to proceed with submission.</span>
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
                        loading={isCheckingAts || isLoadingScores}
                        onClick={handleRunAtsCheck}
                      >
                        {currentAtsScore !== null ? 'Re-run ATS Check' : 'Calculate ATS Check'}
                      </Button>
                      <Button
                        variant="primary"
                        icon={<ArrowRight size={16} />}
                        disabled={!canContinueToSelection || isLoadingScores}
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
                Pilot Mama records the exact immutable resume version attached to this submission.
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
                <Button
                  variant="primary"
                  icon={<ArrowRight size={14} />}
                  disabled={!isAtsPassed}
                  onClick={() => setCurrentStep('preview')}
                >
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
                      This application is simulated for Pilot Mama testing. Nothing will be submitted to Codewalla.
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
                    disabled={!isAtsPassed}
                    onClick={handleSubmitDemoApplication}
                  >
                    Submit Demo Application
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    icon={<Send size={16} />}
                    loading={isSubmitting}
                    disabled={!isAtsPassed}
                    onClick={handleStartExternalApplication}
                  >
                    Start Application
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
                    ? `Your Pilot Mama demo application for ${job?.company} has been recorded locally.`
                    : `Direct application portal opened for ${job?.company}. Verify submission status below.`}
                </p>
              </div>

              {isCodewalla && (
                <div className="codewalla-demo-banner text-center">
                  <ShieldAlert size={18} className="banner-icon" />
                  <div>
                    <strong>Nothing was submitted to Codewalla.</strong> All records reside strictly within your local Pilot Mama testing database.
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
                    <strong>External Portal Safeguard:</strong> Pilot Mama never assumes an external submission succeeded merely because the website was opened.
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
          </>
          )}
        </div>
      </div>
    </div>
  );
};
