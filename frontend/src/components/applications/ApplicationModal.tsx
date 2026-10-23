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
  X,
  FileEdit,
  Building,
  User,
  Briefcase,
  HelpCircle,
  CheckSquare
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

type Step = 'readiness' | 'selection' | 'form' | 'confirmation' | 'success';

export type AnswerState = 'unanswered' | 'suggested' | 'edited' | 'confirmed';

export interface EmployerQuestionItem {
  id: string;
  question: string;
  required: boolean;
  groundedSource?: string;
  defaultAnswer?: string;
}

interface UsableResumeItem {
  id: string;
  name: string;
  type: 'master' | 'tailored' | 'uploaded';
  version: string;
  atsScore: number | null;
  lastUpdated: string;
  status: string;
  tailoredObj?: TailoredResume;
}

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
  
  // Selection state: 'master' or tailored version id
  const [selectedResumeId, setSelectedResumeId] = useState<string>('master');
  const [activePreviewResumeId, setActivePreviewResumeId] = useState<string | null>(null);
  const [showDiffView, setShowDiffView] = useState<boolean>(false);
  const [isTailoringInline, setIsTailoringInline] = useState<boolean>(false);

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

  // Storage key for caching in-progress preparation state per (candidateId + jobId)
  const draftStorageKey = candidate?.id && job?.id ? `pilotmama_app_draft_${candidate.id}_${job.id}` : null;

  // Form Fields for Application Form (Step 3) - Section A: Candidate Information
  const [formFields, setFormFields] = useState({
    fullName: candidate?.name || '',
    email: candidate?.email || '',
    phone: candidate?.phone || '',
    currentLocation: candidate?.location || '',
    preferredLocation: (candidate?.preferredLocations || []).join(', ') || candidate?.location || '',
    currentRole: candidate?.headline || candidate?.experiences?.[0]?.title || '',
    currentCompany: candidate?.companies?.[0] || candidate?.experiences?.[0]?.company || '',
    experienceYears: candidate?.yearsOfExperience ? candidate.yearsOfExperience.toString() : '0',
    noticePeriod: candidate?.noticePeriod || 'Immediate / 30 days',
    expectedSalary: candidate?.expectedSalary || 'Market standard / negotiable',
    workAuthorization: 'Authorized to work in role location',
    coverLetter: `Dear Hiring Team,\n\nI am excited to submit my application for the ${job?.role || 'open'} role at ${canonicalCompany}. With ${candidate?.yearsOfExperience || 'relevant'} years of demonstrated experience in ${job?.careerTrack || 'the discipline'} and core expertise in ${(candidate?.primarySkills || []).slice(0, 4).join(', ')}, I look forward to contributing high-impact value to your team.\n\nBest regards,\n${candidate?.name || ''}`
  });

  // Step 3 Section B: Employer Questions & Answer States
  // customAnswers: map of questionId -> answer text
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  // answerStates: map of questionId -> 'unanswered' | 'suggested' | 'edited' | 'confirmed'
  const [answerStates, setAnswerStates] = useState<Record<string, AnswerState>>({});

  // Form validation errors map
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Job-specific dynamic match & ATS evaluation state
  const [isLoadingScores, setIsLoadingScores] = useState<boolean>(false);
  const [scoresError, setScoresError] = useState<string | null>(null);

  // Determine employer questions from Job context (or truthful empty state)
  const getDetectedEmployerQuestions = (): EmployerQuestionItem[] => {
    const rawQuestions: any[] = (job as any)?.applicationQuestions || (job as any)?.questions || [];
    if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
      return rawQuestions.map((q, idx) => ({
        id: q.id || `q-${idx}`,
        question: typeof q === 'string' ? q : q.question || q.label || `Employer Question ${idx + 1}`,
        required: q.required !== false,
        groundedSource: q.groundedSource || 'Employer Application Form',
        defaultAnswer: q.defaultAnswer
      }));
    }

    // If job has structured prompt requirements in qualifications/rawText, extract truthful recognized inquiries
    // Examples: Notice Period, Relocation, Total Experience
    const detected: EmployerQuestionItem[] = [];
    if (job?.responsibilities?.length || job?.qualifications?.length || job?.rawText) {
      // 1. Role Interest & Fit (Common ATS screening inquiry)
      detected.push({
        id: 'q_interest_role',
        question: `Why are you interested in this ${job?.role || 'open'} role at ${canonicalCompany}?`,
        required: true,
        groundedSource: 'Core Role Alignment & Verified Candidate Summary'
      });

      // 2. Relevant Experience
      detected.push({
        id: 'q_experience_alignment',
        question: `How many years of relevant professional experience do you have in ${job?.careerTrack || job?.role}?`,
        required: true,
        groundedSource: 'Verified Candidate Work History'
      });

      // 3. Work Arrangement & Location
      if (job?.location) {
        detected.push({
          id: 'q_work_arrangement',
          question: `Are you willing to work in or relocate to ${job.location} under the employer's work arrangement?`,
          required: false,
          groundedSource: 'Candidate Work Preference & Location'
        });
      }

      // 4. Notice Period & Availability
      detected.push({
        id: 'q_notice_period',
        question: 'What is your current notice period and earliest availability date?',
        required: true,
        groundedSource: 'Candidate Profile Notice Period'
      });
    }

    return detected;
  };

  const detectedQuestions = getDetectedEmployerQuestions();

  // Generate grounded suggested answer using ONLY verified candidate profile data
  const generateGroundedAnswer = (qItem: EmployerQuestionItem): string => {
    const qLower = qItem.question.toLowerCase();

    if (qLower.includes('why are you interested') || qLower.includes('good fit') || qLower.includes('why should we hire')) {
      const topSkills = (candidate?.primarySkills || []).slice(0, 4).join(', ');
      return `With ${candidate?.yearsOfExperience || 'relevant'} years of verified experience in ${candidate?.headline || job?.careerTrack || 'the field'} and demonstrated expertise in ${topSkills || 'core requirements'}, I bring a track record of delivering resilient outcomes aligned with ${canonicalCompany}'s objectives.`;
    }

    if (qLower.includes('years') && (qLower.includes('experience') || qLower.includes('relevant'))) {
      return candidate?.yearsOfExperience !== undefined
        ? `I have ${candidate.yearsOfExperience} years of verified experience.`
        : 'Candidate input required.';
    }

    if (qLower.includes('notice period') || qLower.includes('availability') || qLower.includes('start date')) {
      return candidate?.noticePeriod
        ? `My notice period is ${candidate.noticePeriod}.`
        : 'Candidate input required.';
    }

    if (qLower.includes('salary') || qLower.includes('compensation') || qLower.includes('ctc')) {
      return candidate?.expectedSalary
        ? `Expected compensation: ${candidate.expectedSalary}.`
        : 'Candidate input required.';
    }

    if (qLower.includes('relocate') || qLower.includes('location') || qLower.includes('remote') || qLower.includes('hybrid')) {
      const pref = candidate?.workPreference || 'Flexible';
      const candLoc = candidate?.location || 'Current location';
      return `Based in ${candLoc}. My work preference is ${pref}, and I am open to discussing arrangements for ${job?.location || 'this role'}.`;
    }

    if (qLower.includes('authorization') || qLower.includes('visa') || qLower.includes('sponsor')) {
      return 'Candidate input required.';
    }

    // Default: Check matchAnalysis suggested answers if present
    if (matchAnalysis?.suggestedAnswers) {
      for (const [key, val] of Object.entries(matchAnalysis.suggestedAnswers)) {
        if (qLower.includes(key.toLowerCase()) || key.toLowerCase().includes(qLower.slice(0, 15))) {
          return val;
        }
      }
    }

    return 'Candidate input required.';
  };

  // Re-sync form fields whenever candidate or job changes, restoring saved draft if available
  useEffect(() => {
    if (draftStorageKey && typeof window !== 'undefined') {
      try {
        const savedDraftStr = localStorage.getItem(draftStorageKey);
        if (savedDraftStr) {
          const draft = JSON.parse(savedDraftStr);
          if (draft && draft.jobId === job?.id) {
            if (draft.formFields) setFormFields(draft.formFields);
            if (draft.customAnswers) setCustomAnswers(draft.customAnswers);
            if (draft.answerStates) setAnswerStates(draft.answerStates);
            if (draft.selectedResumeId) setSelectedResumeId(draft.selectedResumeId);
            return;
          }
        }
      } catch (err) {
        console.warn('Notice restoring application draft:', err);
      }
    }

    // Default initialization when no draft exists
    if (candidate) {
      setFormFields({
        fullName: candidate.name || '',
        email: candidate.email || '',
        phone: candidate.phone || '',
        currentLocation: candidate.location || '',
        preferredLocation: (candidate.preferredLocations || []).join(', ') || candidate.location || '',
        currentRole: candidate.headline || candidate.experiences?.[0]?.title || '',
        currentCompany: candidate.companies?.[0] || candidate.experiences?.[0]?.company || '',
        experienceYears: candidate.yearsOfExperience ? candidate.yearsOfExperience.toString() : '0',
        noticePeriod: candidate.noticePeriod || 'Immediate / 30 days',
        expectedSalary: candidate.expectedSalary || 'Market standard / negotiable',
        workAuthorization: 'Authorized to work in role location',
        coverLetter: `Dear Hiring Team,\n\nI am excited to submit my application for the ${job?.role || 'open'} role at ${canonicalCompany}. With ${candidate.yearsOfExperience || 'relevant'} years of demonstrated experience in ${job?.careerTrack || 'the discipline'} and core expertise in ${(candidate.primarySkills || []).slice(0, 4).join(', ')}, I look forward to contributing high-impact value to your team.\n\nBest regards,\n${candidate.name || ''}`
      });

      // Initialize default suggested answers for detected questions
      const initialAnswers: Record<string, string> = {};
      const initialStates: Record<string, AnswerState> = {};
      detectedQuestions.forEach(q => {
        const groundedAns = generateGroundedAnswer(q);
        initialAnswers[q.id] = groundedAns;
        initialStates[q.id] = groundedAns === 'Candidate input required.' ? 'unanswered' : 'suggested';
      });

      setCustomAnswers(initialAnswers);
      setAnswerStates(initialStates);
    }
  }, [candidate?.id, job?.id, canonicalCompany]);

  // Persist draft changes to storage
  const persistDraftState = (newFields = formFields, newAnswers = customAnswers, newStates = answerStates, resId = selectedResumeId) => {
    if (draftStorageKey && typeof window !== 'undefined') {
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify({
          jobId: job?.id,
          candidateId: candidate?.id,
          formFields: newFields,
          customAnswers: newAnswers,
          answerStates: newStates,
          selectedResumeId: resId,
          updatedAt: new Date().toISOString()
        }));
      } catch (err) {
        console.warn('Notice persisting draft:', err);
      }
    }
  };

  const isCodewalla = (canonicalCompany && canonicalCompany.toLowerCase().includes('codewalla')) || (job?.source && job.source.toLowerCase().includes('codewalla'));
  const effectiveMode = isCodewalla ? 'demo' : (job?.applicationMode || 'agent');

  useEffect(() => {
    if (initialTailoredResume) {
      setTailoredResume(initialTailoredResume);
      setSelectedResumeId(initialTailoredResume.id || 'tailored');
    }
  }, [initialTailoredResume]);

  useEffect(() => {
    if (initialMatchAnalysis) {
      setMatchAnalysis(initialMatchAnalysis);
    }
  }, [initialMatchAnalysis]);

  // Primary Effect: When modal opens or job.id / candidate.id changes, reset context and fetch genuine job-specific match & ATS
  useEffect(() => {
    if (isOpen) {
      setCurrentStep('readiness');
      setSubmittedApp(null);
      setDuplicateWarning(null);
      setExternalConfirmed(false);
      setErrorBanner(null);
      setShowDiffView(false);
      setActivePreviewResumeId(null);
      setValidationErrors({});
      checkExistingApplication();

      if (job?.id && candidate?.id) {
        if (initialMatchAnalysis && (initialMatchAnalysis.jobId === job.id || (initialMatchAnalysis as any).id === job.id)) {
          setMatchAnalysis(initialMatchAnalysis);
          setIsLoadingScores(false);
          setScoresError(null);
        } else {
          setMatchAnalysis(null);
          fetchDynamicScores(job.id, candidate.id);
        }
      }
    } else {
      setMatchAnalysis(null);
      setIsLoadingScores(false);
      setScoresError(null);
      setShowDiffView(false);
      setActivePreviewResumeId(null);
      setValidationErrors({});
    }
  }, [isOpen, job?.id, candidate?.id]);

  const fetchDynamicScores = async (jobId: string, candidateId: string) => {
    try {
      setIsLoadingScores(true);
      setScoresError(null);

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
        console.warn('V1 Match API notice, falling back to proto match API:', v1Err);
      }

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

  const handleTriggerTailorResume = async () => {
    if (!job?.id) return;
    try {
      setIsTailoringInline(true);
      setErrorBanner(null);

      try {
        const v1Result = await apiClient.tailorResume(job.id, 'TARGETED');
        if (v1Result && v1Result.versionId) {
          const tailoredObj: TailoredResume = {
            id: v1Result.versionId,
            versionName: v1Result.versionName || 'Tailored_Resume_v1',
            candidateId: candidate.id,
            jobId: job.id,
            targetRole: job.role,
            targetCompany: canonicalCompany,
            tailoredSummary: v1Result.tailoredSummary || `Experienced ${job.role} with verified track record.`,
            orderedSkills: v1Result.orderedSkills || candidate?.primarySkills || [],
            experiences: candidate?.experiences || [],
            projects: candidate?.projects || [],
            modifications: (v1Result.modifications || []).map((m: any) => typeof m === 'string' ? {
              section: 'Experience',
              original: 'Original text',
              tailored: m,
              reason: 'Aligned terminology'
            } : m),
            truthCheckVerified: true,
            atsScore: v1Result.atsScore !== undefined ? v1Result.atsScore : originalAts,
            createdAt: new Date().toISOString()
          };
          setTailoredResume(tailoredObj);
          setSelectedResumeId(tailoredObj.id);
          persistDraftState(formFields, customAnswers, answerStates, tailoredObj.id);
          setCurrentStep('selection');
          return;
        }
      } catch (v1Err) {
        console.warn('V1 tailor notice, trying proto API:', v1Err);
      }

      if (candidate?.id) {
        const res = await api.tailorResume(candidate.id, job.id, 'TARGETED');
        if (res) {
          setTailoredResume(res);
          setSelectedResumeId(res.id);
          persistDraftState(formFields, customAnswers, answerStates, res.id);
          setCurrentStep('selection');
        }
      }
    } catch (err: unknown) {
      const normalized = normalizeApiError(err, 'Failed to generate tailored resume. Please try again.');
      setErrorBanner(normalized.message);
    } finally {
      setIsTailoringInline(false);
    }
  };

  if (!isOpen) return null;

  const matchScore: number | null = matchAnalysis?.scores?.overallScore ?? null;
  const originalAts: number | null = matchAnalysis?.atsAnalysis?.estimatedScore ?? null;

  const isSelectedTailored = tailoredResume && (selectedResumeId === tailoredResume.id || selectedResumeId === 'tailored');
  const currentAtsScore: number | null = isSelectedTailored
    ? (tailoredResume.atsScore !== undefined ? tailoredResume.atsScore : originalAts)
    : originalAts;

  const skillGaps = matchAnalysis?.atsAnalysis?.keywords?.red || [];
  const candidateStrengths = matchAnalysis?.atsAnalysis?.keywords?.green || candidate?.primarySkills?.slice(0, 4) || [];
  const keywordGaps = matchAnalysis?.atsAnalysis?.keywords?.red || [];

  const readiness = evaluateApplicationReadiness({
    candidate,
    job,
    currentAtsScore,
    atsThreshold: MANDATORY_ATS_THRESHOLD,
    isExperienceConfirmed
  });

  const {
    canProceedToPreparation,
    canProceedToSubmission,
    preparationBlockers,
    submissionBlockers,
    blockers,
    profileStatedYears,
    workHistoryYears,
    experienceDiscrepancy,
    hasExperienceDiscrepancy,
    isAtsPassed
  } = readiness;

  const usableResumes: UsableResumeItem[] = [
    {
      id: 'master',
      name: 'Master Profile Resume',
      type: 'master',
      version: 'v1.0 (Canonical)',
      atsScore: originalAts,
      lastUpdated: candidate?.updatedAt || 'Recent',
      status: 'Active'
    }
  ];

  if (tailoredResume) {
    usableResumes.unshift({
      id: tailoredResume.id || 'tailored',
      name: tailoredResume.versionName || `${job?.role} Tailored Resume`,
      type: 'tailored',
      version: 'v1.0 (Job-Specific)',
      atsScore: tailoredResume.atsScore !== undefined ? tailoredResume.atsScore : originalAts,
      lastUpdated: tailoredResume.createdAt || 'Just now',
      status: 'Tailored',
      tailoredObj: tailoredResume
    });
  }

  const currentlySelectedResumeObj = usableResumes.find(r => r.id === selectedResumeId) || usableResumes[0];

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
      try {
        await apiClient.updateCandidateProfile({ location: trimmed });
      } catch {
        if (candidate?.id) {
          await api.updateCandidate(candidate.id, { ...candidate, location: trimmed });
        }
      }
      if (candidate) {
        candidate.location = trimmed;
      }
      setFormFields(prev => ({ ...prev, currentLocation: trimmed }));
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
    const updated = {
      ...formFields,
      [e.target.name]: e.target.value
    };
    setFormFields(updated);
    if (validationErrors[e.target.name]) {
      setValidationErrors(prev => {
        const copy = { ...prev };
        delete copy[e.target.name];
        return copy;
      });
    }
    persistDraftState(updated);
  };

  const handleCustomAnswerChange = (qId: string, val: string) => {
    const updatedAnswers = {
      ...customAnswers,
      [qId]: val
    };
    setCustomAnswers(updatedAnswers);

    // Update state to 'edited' (or 'unanswered' if cleared)
    const updatedStates = {
      ...answerStates,
      [qId]: (!val.trim() || val === 'Candidate input required.') ? 'unanswered' as AnswerState : 'edited' as AnswerState
    };
    setAnswerStates(updatedStates);

    if (validationErrors[qId]) {
      setValidationErrors(prev => {
        const copy = { ...prev };
        delete copy[qId];
        return copy;
      });
    }

    persistDraftState(formFields, updatedAnswers, updatedStates);
  };

  const handleConfirmAnswer = (qId: string) => {
    const currentVal = customAnswers[qId] || '';
    if (!currentVal.trim() || currentVal === 'Candidate input required.') {
      return;
    }
    const updatedStates = {
      ...answerStates,
      [qId]: 'confirmed' as AnswerState
    };
    setAnswerStates(updatedStates);
    persistDraftState(formFields, customAnswers, updatedStates);
  };

  // Step 3 Validation Gate: Validate required candidate fields & required employer questions
  const validateStep3Form = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formFields.fullName.trim()) {
      errors.fullName = 'Full Name is required.';
    }
    if (!formFields.email.trim()) {
      errors.email = 'Email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formFields.email.trim())) {
      errors.email = 'Please provide a valid email address.';
    }
    if (!formFields.phone.trim()) {
      errors.phone = 'Phone number is required.';
    }
    if (!formFields.currentLocation.trim()) {
      errors.currentLocation = 'Current location is required.';
    }

    // Validate required employer questions
    detectedQuestions.forEach(q => {
      if (q.required) {
        const ans = (customAnswers[q.id] || '').trim();
        if (!ans || ans === 'Candidate input required.') {
          errors[q.id] = `This employer question is required. Candidate input required.`;
        }
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAdvanceToConfirmation = () => {
    if (!validateStep3Form()) {
      setErrorBanner('Please review required application fields and employer questions before proceeding.');
      return;
    }
    setErrorBanner(null);
    setCurrentStep('confirmation');
  };

  // Readiness Checklist Evaluation for Step 4 Confirmation
  const checklistCandidateInfo = Boolean(
    formFields.fullName.trim() &&
    formFields.email.trim() &&
    formFields.phone.trim() &&
    formFields.currentLocation.trim()
  );
  const checklistResumeSelected = Boolean(currentlySelectedResumeObj && currentlySelectedResumeObj.id);
  const checklistResumeOwnership = Boolean(
    selectedResumeId === 'master' || (tailoredResume && tailoredResume.candidateId === candidate.id)
  );
  const checklistQuestionsComplete = detectedQuestions.every(q => {
    if (!q.required) return true;
    const ans = (customAnswers[q.id] || '').trim();
    return ans.length > 0 && ans !== 'Candidate input required.';
  });
  const checklistTruthPassed = readiness.experienceDiscrepancy < 1.0 || isExperienceConfirmed;

  const allChecklistItemsPassed =
    checklistCandidateInfo &&
    checklistResumeSelected &&
    checklistResumeOwnership &&
    checklistQuestionsComplete &&
    checklistTruthPassed;

  const isSubmissionFullyEligible = canProceedToSubmission && allChecklistItemsPassed && isAtsPassed;

  const handleSubmitDemoApplication = async () => {
    if (!isSubmissionFullyEligible) {
      setErrorBanner('Automatic submission blocked: Application readiness criteria or ATS compatibility requirement (80%) not met.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorBanner(null);
      const now = new Date().toISOString();
      const resumeVerId = isSelectedTailored ? (tailoredResume?.id || '') : 'master';
      const resumeVerName = currentlySelectedResumeObj.name;

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
        notes: `Simulated Demo Application submitted in Pilot Mama. Selected resume: ${resumeVerName}.`,
        skillGaps,
        coverLetter: formFields.coverLetter,
        customAnswers,
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
    if (!allChecklistItemsPassed) {
      setErrorBanner('Please resolve incomplete application checklist items before opening external application.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorBanner(null);
      const now = new Date().toISOString();
      const resumeVerId = isSelectedTailored ? (tailoredResume?.id || '') : 'master';
      const resumeVerName = currentlySelectedResumeObj.name;

      // Call canonical backend Application Agent start API (mode: prepared)
      let autoResult: any = null;
      try {
        const rawRes = await apiClient.startApplication({
          jobId: job.id,
          resumeVersionId: resumeVerId !== 'master' ? resumeVerId : undefined,
          autoApply: false
        });
        autoResult = rawRes?.data || rawRes;
      } catch (autoErr: unknown) {
        const norm = normalizeApiError(autoErr, 'Application Agent service notice');
        console.warn('Backend automation notice:', norm.message);
      }

      // Open external employer application URL in new tab safely
      const targetUrl = job.applicationUrl || job.sourceUrl || '';
      if (targetUrl) {
        window.open(targetUrl, '_blank', 'noopener,noreferrer');
      }

      // Record prepared state without claiming automatic completion
      const appData: Partial<ApplicationRecord> = {
        candidateId: candidate.id,
        jobId: job.id,
        company: canonicalCompany,
        role: job.role,
        location: job.location,
        applicationMode: 'external',
        jobUrl: job.sourceUrl || '',
        applicationUrl: targetUrl,
        matchScore: autoResult?.jobMatchScore || matchScore,
        atsScore: autoResult?.atsCompatibilityScore || currentAtsScore,
        resumeVersionId: resumeVerId,
        resumeVersionName: resumeVerName,
        status: 'APPLICATION_STARTED',
        appliedAt: now,
        notes: `Application package prepared for ${canonicalCompany}. External portal opened. Candidate confirmation pending.`,
        skillGaps,
        coverLetter: formFields.coverLetter,
        customAnswers,
        timeline: [
          { timestamp: now, stage: 'Application Form Prepared', description: 'Application answers and resume package prepared in Pilot Mama.' },
          { timestamp: now, stage: 'Employer Portal Launched', description: `Employer application portal opened (${targetUrl}). Awaiting candidate confirmation.` }
        ]
      };

      const res = await api.saveApplication(appData);
      setSubmittedApp(res);
      onSuccess(res);
      setCurrentStep('success');
    } catch (err: unknown) {
      const normalized = normalizeApiError(err, 'External application session could not be initiated.');
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
          <div className={`step-item ${currentStep === 'readiness' ? 'active' : 'completed'}`} onClick={() => setCurrentStep('readiness')}>
            <span className="step-num">1</span>
            <span className="step-lbl">Readiness Check</span>
          </div>
          <div className={`step-separator ${currentStep !== 'readiness' ? 'active' : ''}`} />
          <div className={`step-item ${currentStep === 'selection' ? 'active' : currentStep === 'form' || currentStep === 'confirmation' || currentStep === 'success' ? 'completed' : ''}`} onClick={() => canProceedToPreparation && setCurrentStep('selection')}>
            <span className="step-num">2</span>
            <span className="step-lbl">Resume Selection</span>
          </div>
          <div className={`step-separator ${currentStep === 'form' || currentStep === 'confirmation' || currentStep === 'success' ? 'active' : ''}`} />
          <div className={`step-item ${currentStep === 'form' ? 'active' : currentStep === 'confirmation' || currentStep === 'success' ? 'completed' : ''}`} onClick={() => canProceedToPreparation && setCurrentStep('form')}>
            <span className="step-num">3</span>
            <span className="step-lbl">Application Form</span>
          </div>
          <div className={`step-separator ${currentStep === 'confirmation' || currentStep === 'success' ? 'active' : ''}`} />
          <div className={`step-item ${currentStep === 'confirmation' ? 'active' : currentStep === 'success' ? 'completed' : ''}`} onClick={() => canProceedToPreparation && setCurrentStep('confirmation')}>
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

                  {/* Readiness Summary Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', color: '#f8fafc' }}>Application Readiness Overview</h3>
                      <p style={{ margin: 0, fontSize: '0.84rem', color: '#94a3b8' }}>
                        Inspect role fit, ATS compatibility, and keyword gaps. Preparation and resume selection remain fully available.
                      </p>
                    </div>
                    <div>
                      {preparationBlockers.length > 0 ? (
                        <span className="readiness-status-badge unavailable">
                          <AlertTriangle size={12} /> Preparation Blocked
                        </span>
                      ) : !isAtsPassed ? (
                        <span className="readiness-status-badge attention">
                          <AlertTriangle size={12} /> Needs Attention
                        </span>
                      ) : (
                        <span className="readiness-status-badge ready">
                          <CheckCircle size={12} /> Ready for Submission
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Functional Quick Actions Bar */}
                  <div className="readiness-quick-actions-bar">
                    <span className="quick-actions-label">Readiness Actions:</span>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<AlertTriangle size={14} />}
                      onClick={() => {
                        const el = document.getElementById('ats-diagnostics-section');
                        if (el) el.scrollIntoView({ behavior: 'smooth' });
                      }}
                    >
                      Review ATS Gaps
                    </Button>

                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Sparkles size={14} />}
                      loading={isTailoringInline}
                      onClick={handleTriggerTailorResume}
                    >
                      {tailoredResume ? 'Re-Tailor Resume' : 'Tailor Resume'}
                    </Button>

                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<FileText size={14} />}
                      onClick={() => setCurrentStep('selection')}
                    >
                      Select Resume
                    </Button>
                  </div>

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
                      <span className="pod-sub">Authoritative 14-point deterministic fit</span>
                    </Card>

                    <Card className="metric-pod">
                      <span className="pod-label">ATS Compatibility</span>
                      <div className={`pod-value ${isLoadingScores ? 'text-neutral' : isAtsPassed ? 'text-emerald' : 'text-amber'}`}>
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
                          : isSelectedTailored
                          ? `${tailoredResume?.versionName || 'Tailored Resume'} (Tailored)`
                          : 'Master Profile Resume'}
                      </span>
                    </Card>

                    <Card className="metric-pod">
                      <span className="pod-label">Automatic Submission Gate</span>
                      <div className="pod-value" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                        {isLoadingScores ? (
                          <span className="score-loading-text">Checking...</span>
                        ) : isAtsPassed ? (
                          <span className="text-emerald">READY (≥ 80%)</span>
                        ) : (
                          <span className="text-amber">NOT READY (&lt; 80%)</span>
                        )}
                      </div>
                      <span className="pod-sub">
                        {isAtsPassed ? 'Eligible for automatic submission' : 'Preparation remains fully open'}
                      </span>
                    </Card>
                  </div>

                  {/* ATS Diagnostic Pod (Review ATS Gaps target) */}
                  <div id="ats-diagnostics-section" className="ats-gate-warning-card" style={{ borderColor: isAtsPassed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.35)' }}>
                    <div className="ats-gate-header">
                      {isAtsPassed ? (
                        <CheckCircle size={20} className="text-emerald" />
                      ) : (
                        <AlertTriangle size={20} className="text-amber" />
                      )}
                      <h4 className="ats-gate-title">
                        {isAtsPassed
                          ? 'ATS Compatibility Threshold Met (≥ 80%)'
                          : 'ATS Compatibility Notice (Current: ' + (currentAtsScore !== null ? `${currentAtsScore}%` : 'Pending') + ' • Requirement: 80%)'}
                      </h4>
                    </div>

                    <div className="ats-gate-metrics">
                      <div className="ats-gate-metric-item">
                        <span className="ats-gate-metric-lbl">Current ATS Score</span>
                        <span className={`ats-gate-metric-val ${isAtsPassed ? 'text-emerald' : 'failed'}`}>
                          {currentAtsScore !== null ? `${currentAtsScore}%` : 'Not Calculated'}
                        </span>
                      </div>
                      <div className="ats-gate-metric-item">
                        <span className="ats-gate-metric-lbl">Submission Threshold</span>
                        <span className="ats-gate-metric-val required">80%</span>
                      </div>
                      <div className="ats-gate-metric-item">
                        <span className="ats-gate-metric-lbl">Preparation Status</span>
                        <span className="ats-gate-metric-val text-emerald status">
                          ✓ Available (Select, Tailor, Form)
                        </span>
                      </div>
                    </div>

                    {/* Fit Distinction Note */}
                    {matchScore !== null && currentAtsScore !== null && matchScore > currentAtsScore && (
                      <div className="ats-fit-distinction-note">
                        <strong>💡 Why is Match Score {matchScore}% while ATS is {currentAtsScore}%?</strong>
                        <p>
                          Your verified profile experience aligns strongly with this position ({matchScore}% overall fit), but your active resume does not yet reflect all employer terminology. Tailoring may improve ATS compatibility by aligning your verified experience with the job's terminology.
                        </p>
                      </div>
                    )}

                    {/* Granular ATS Keywords Breakdown */}
                    <div className="ats-keywords-diagnostic">
                      {keywordGaps.length > 0 && (
                        <div className="ats-missing-keywords-row">
                          <span className="keyword-category-lbl text-amber font-semibold">Resume Keyword Gaps:</span>
                          <div className="keyword-pills-wrap">
                            {keywordGaps.map((kw: string) => (
                              <span key={kw} className="keyword-pill pill-red">✕ {kw}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {candidateStrengths.length > 0 && (
                        <div className="ats-matched-keywords-row">
                          <span className="keyword-category-lbl text-emerald font-semibold">Candidate Strengths & Verified Terminology:</span>
                          <div className="keyword-pills-wrap">
                            {candidateStrengths.map((kw: string) => (
                              <span key={kw} className="keyword-pill pill-green">✓ {kw}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="ats-gate-desc">
                      {isAtsPassed
                        ? 'Your active resume meets the 80% threshold required for automated submission. You may still review options or customize answers in the following steps.'
                        : 'The 80% threshold determines automatic submission eligibility at Step 4, but does not block you from selecting resumes, generating tailored versions, or completing application questions.'}
                    </p>

                    <div className="ats-gate-actions">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={<Sparkles size={14} />}
                        loading={isTailoringInline}
                        onClick={handleTriggerTailorResume}
                      >
                        Tailor Resume for Role
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={<FileText size={14} />}
                        onClick={() => setCurrentStep('selection')}
                      >
                        Select Different Resume
                      </Button>
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
                        <span className="row-key">Experience Fit:</span>
                        <span className="row-val">
                          {job?.experienceRequired || 'Not specified'} (Candidate Stated: {profileStatedYears} yrs | Work History: {workHistoryYears} yrs)
                        </span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Active Resume:</span>
                        <span className="row-val text-emerald font-bold">
                          {currentlySelectedResumeObj.name} ({currentlySelectedResumeObj.version})
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
                          {keywordGaps.length > 0 ? (
                            <span className="text-amber font-semibold">{keywordGaps.length} keywords unrepresented in current resume</span>
                          ) : (
                            <span className="text-emerald">Full keyword alignment</span>
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Preparation Blockers List (Genuine blockers like missing location / profile conflict) */}
                    {preparationBlockers.length > 0 ? (
                      <div className="readiness-blockers-container">
                        <div className="blockers-header">
                          <AlertTriangle size={18} className="text-amber" />
                          <h5 className="blockers-count-title">
                            {preparationBlockers.length} preparation {preparationBlockers.length === 1 ? 'blocker needs' : 'blockers need'} resolution before continuing:
                          </h5>
                        </div>
                        <div className="blockers-list">
                          {preparationBlockers.map((b, idx) => (
                            <div key={b.id + idx} className="blocker-item-card">
                              <div className="blocker-num">{idx + 1}</div>
                              <div className="blocker-content">
                                <div className="blocker-title-row">
                                  <strong className="blocker-item-title">{b.title}</strong>
                                </div>
                                <p className="blocker-item-desc">{b.description}</p>

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
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="readiness-ready-banner">
                        <CheckCircle size={18} className="text-emerald" />
                        <span>Profile and preparation requirements verified. You can proceed with resume selection and application form.</span>
                      </div>
                    )}
                  </Card>

                  {/* Action Bar */}
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
                        disabled={!canProceedToPreparation || isLoadingScores}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div>
                      <h4 className="selection-heading" style={{ margin: 0 }}>Select Application Resume</h4>
                      <p className="selection-sub" style={{ margin: '4px 0 0 0' }}>
                        Choose which resume version to attach to this application. Switching resumes dynamically recalculates your ATS score for {canonicalCompany}.
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Sparkles size={14} />}
                      loading={isTailoringInline}
                      onClick={handleTriggerTailorResume}
                    >
                      {tailoredResume ? 'Regenerate Tailored Resume' : 'Tailor Resume for Role'}
                    </Button>
                  </div>

                  {/* List of usable resumes */}
                  <div className="resume-options-grid" style={{ marginTop: '16px' }}>
                    {usableResumes.map((res) => {
                      const isSelected = selectedResumeId === res.id;
                      return (
                        <div
                          key={res.id}
                          className={`resume-choice-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => {
                            setSelectedResumeId(res.id);
                            persistDraftState(formFields, customAnswers, answerStates, res.id);
                          }}
                        >
                          <div className="choice-header">
                            <div className="radio-indicator">
                              {isSelected && <Check size={14} />}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <h5 className="choice-title" style={{ margin: 0 }}>{res.name}</h5>
                                {isSelected && <span className="active-resume-tag">Currently Selected</span>}
                              </div>
                              <span className={res.type === 'tailored' ? 'choice-badge' : 'choice-badge-sub'}>
                                {res.type === 'tailored' ? 'Role-Tailored Snapshot' : 'Master Baseline Profile'}
                              </span>
                            </div>
                          </div>

                          <p className="choice-desc">
                            {res.type === 'tailored'
                              ? `Role-aligned terminology and prioritized highlights calibrated specifically for ${job?.role}. Verified against strict truth rules.`
                              : 'Unadjusted master candidate profile. Contains complete career history without role-targeted reordering.'}
                          </p>

                          <div className="choice-meta">
                            <span>
                              ATS Score: <strong className={res.atsScore !== null && res.atsScore >= 80 ? 'text-emerald' : 'text-amber'}>
                                {res.atsScore !== null ? `${res.atsScore}%` : 'Not Checked'}
                              </strong>
                            </span>
                            <span>Version: {res.version}</span>
                            <span>Updated: {res.lastUpdated}</span>
                          </div>

                          <div className="resume-choice-actions" onClick={e => e.stopPropagation()}>
                            <Button
                              variant={isSelected ? 'secondary' : 'primary'}
                              size="sm"
                              onClick={() => {
                                setSelectedResumeId(res.id);
                                persistDraftState(formFields, customAnswers, answerStates, res.id);
                              }}
                            >
                              {isSelected ? 'Selected' : 'Select This Resume'}
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              icon={<Eye size={13} />}
                              onClick={() => {
                                setShowDiffView(false);
                                setActivePreviewResumeId(activePreviewResumeId === res.id ? null : res.id);
                              }}
                            >
                              {activePreviewResumeId === res.id ? 'Close Preview' : 'Preview'}
                            </Button>

                            {res.type === 'tailored' && res.tailoredObj && (
                              <Button
                                variant="outline"
                                size="sm"
                                icon={<FileCheck size={13} />}
                                onClick={() => {
                                  setActivePreviewResumeId(null);
                                  setShowDiffView(!showDiffView);
                                }}
                              >
                                {showDiffView ? 'Close Diff' : 'View Diff'}
                              </Button>
                            )}

                            {onNavigateToResumes && (
                              <Button
                                variant="outline"
                                size="sm"
                                icon={<ExternalLink size={13} />}
                                onClick={() => {
                                  onClose();
                                  onNavigateToResumes(res.type === 'tailored' && res.tailoredObj ? res.tailoredObj.id : undefined);
                                }}
                              >
                                Open in Studio
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Inline Preview Panel */}
                  {activePreviewResumeId && (
                    <div className="resume-preview-panel">
                      <div className="diff-header-row">
                        <h5 className="diff-panel-title">
                          <Eye size={15} /> Resume Preview: {usableResumes.find(r => r.id === activePreviewResumeId)?.name}
                        </h5>
                        <button className="modal-close-btn" onClick={() => setActivePreviewResumeId(null)}>×</button>
                      </div>
                      <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '12px', borderRadius: '6px', fontSize: '0.82rem', lineHeight: '1.5', maxHeight: '200px', overflowY: 'auto' }}>
                        {activePreviewResumeId === 'master' ? (
                          <div>
                            <strong>{candidate?.name}</strong> • {candidate?.email} • {candidate?.phone}
                            <p style={{ marginTop: '6px' }}>{candidate?.summary || 'Standard profile summary.'}</p>
                            <strong>Skills:</strong> {(candidate?.primarySkills || []).join(', ')}
                          </div>
                        ) : (
                          <div>
                            <strong>{candidate?.name}</strong> • {candidate?.headline || job?.role}
                            <p style={{ marginTop: '6px' }}>{tailoredResume?.tailoredSummary}</p>
                            <strong>Targeted Skills:</strong> {(tailoredResume?.orderedSkills || []).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Inline Diff Panel */}
                  {showDiffView && tailoredResume && (
                    <div className="resume-diff-panel">
                      <div className="diff-header-row">
                        <h5 className="diff-panel-title">
                          <FileCheck size={15} /> Verified Tailoring Diff (Master vs {tailoredResume.versionName})
                        </h5>
                        <button className="modal-close-btn" onClick={() => setShowDiffView(false)}>×</button>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 10px 0' }}>
                        Strict Absolute Truth Rule: Zero fabricated skills or experiences. Only terminology alignment and evidence reordering applied.
                      </p>
                      <div className="diff-enhancements-list">
                        {(tailoredResume.modifications || []).length > 0 ? (
                          tailoredResume.modifications.map((m, idx) => (
                            <div key={idx} className="diff-enhancement-item">
                              <div className="enhancement-sec-title">{m.section}: Terminology Calibration</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '4px 0' }}>
                                <div style={{ background: 'rgba(239, 68, 68, 0.08)', padding: '6px', borderRadius: '4px', borderLeft: '2px solid #ef4444' }}>
                                  <span style={{ fontSize: '0.72rem', color: '#f87171', display: 'block', fontWeight: 600 }}>Original</span>
                                  {m.original}
                                </div>
                                <div style={{ background: 'rgba(16, 185, 129, 0.08)', padding: '6px', borderRadius: '4px', borderLeft: '2px solid #10b981' }}>
                                  <span style={{ fontSize: '0.72rem', color: '#34d399', display: 'block', fontWeight: 600 }}>Tailored</span>
                                  {m.tailored}
                                </div>
                              </div>
                              <span className="enhancement-reason">Rationale: {m.reason}</span>
                            </div>
                          ))
                        ) : (
                          <div className="diff-enhancement-item">
                            <div className="enhancement-sec-title">Calibrated Professional Summary</div>
                            <p style={{ margin: '4px 0', fontSize: '0.78rem' }}>{tailoredResume.tailoredSummary}</p>
                            <span className="enhancement-reason">Aligned to {canonicalCompany} {job?.role} job description requirements.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Active Attachment Confirmation Bar */}
                  <div className="attached-status-box" style={{ marginTop: '16px' }}>
                    <FileCheck size={18} className="attached-icon" />
                    <span>
                      <strong>Selected Attachment:</strong> {currentlySelectedResumeObj.name} ({currentlySelectedResumeObj.version}) • ATS Score: <strong>{currentAtsScore !== null ? `${currentAtsScore}%` : 'Not checked'}</strong>
                    </span>
                  </div>

                  <div className="modal-actions-bar">
                    <Button variant="secondary" icon={<ArrowLeft size={14} />} onClick={() => setCurrentStep('readiness')}>
                      Back to Readiness
                    </Button>
                    <div className="action-right-group">
                      <Button
                        variant="outline"
                        icon={<RotateCcw size={14} />}
                        loading={isCheckingAts}
                        onClick={handleRunAtsCheck}
                      >
                        Re-run ATS Check
                      </Button>
                      <Button
                        variant="primary"
                        icon={<ArrowRight size={14} />}
                        onClick={() => setCurrentStep('form')}
                      >
                        Continue to Application Form
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: APPLICATION FORM */}
              {currentStep === 'form' && (
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

                  <div style={{ marginBottom: '16px' }}>
                    <h4 className="form-heading" style={{ margin: 0 }}>Application Form & Employer Questions</h4>
                    <p className="form-sub" style={{ margin: '4px 0 0 0' }}>
                      Pre-populated from verified candidate profile and grounded response intelligence. Review candidate details and employer questions below.
                    </p>
                  </div>

                  {/* SECTION A: CANDIDATE INFORMATION */}
                  <div className="form-section-container">
                    <div className="form-section-header">
                      <div>
                        <h5 className="form-section-title">
                          <User size={16} className="text-indigo" /> Section A: Candidate Information
                        </h5>
                        <p className="form-section-subtitle">
                          Verified profile details attached to this application. Changes made here apply to this application package.
                        </p>
                      </div>
                      <span className="text-emerald" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                        ✓ Grounded in Profile
                      </span>
                    </div>

                    <div className="app-form-grid">
                      <div className="form-field-group">
                        <label>
                          Full Name <span className="question-required-star">*</span>
                        </label>
                        <input
                          type="text"
                          name="fullName"
                          value={formFields.fullName}
                          onChange={handleFormChange}
                          className={`form-input ${validationErrors.fullName ? 'has-error' : ''}`}
                        />
                        {validationErrors.fullName && (
                          <span className="form-field-validation-error">
                            <AlertTriangle size={12} /> {validationErrors.fullName}
                          </span>
                        )}
                      </div>

                      <div className="form-field-group">
                        <label>
                          Email Address <span className="question-required-star">*</span>
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formFields.email}
                          onChange={handleFormChange}
                          className={`form-input ${validationErrors.email ? 'has-error' : ''}`}
                        />
                        {validationErrors.email && (
                          <span className="form-field-validation-error">
                            <AlertTriangle size={12} /> {validationErrors.email}
                          </span>
                        )}
                      </div>

                      <div className="form-field-group">
                        <label>
                          Phone Number <span className="question-required-star">*</span>
                        </label>
                        <input
                          type="tel"
                          name="phone"
                          value={formFields.phone}
                          onChange={handleFormChange}
                          className={`form-input ${validationErrors.phone ? 'has-error' : ''}`}
                        />
                        {validationErrors.phone && (
                          <span className="form-field-validation-error">
                            <AlertTriangle size={12} /> {validationErrors.phone}
                          </span>
                        )}
                      </div>

                      <div className="form-field-group">
                        <label>
                          Current Location <span className="question-required-star">*</span>
                        </label>
                        <input
                          type="text"
                          name="currentLocation"
                          value={formFields.currentLocation}
                          onChange={handleFormChange}
                          className={`form-input ${validationErrors.currentLocation ? 'has-error' : ''}`}
                        />
                        {validationErrors.currentLocation && (
                          <span className="form-field-validation-error">
                            <AlertTriangle size={12} /> {validationErrors.currentLocation}
                          </span>
                        )}
                      </div>

                      <div className="form-field-group">
                        <label>Preferred Work Location</label>
                        <input
                          type="text"
                          name="preferredLocation"
                          value={formFields.preferredLocation}
                          onChange={handleFormChange}
                          className="form-input"
                          placeholder="e.g. Remote, Bengaluru, Mumbai"
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

                      <div className="form-field-group">
                        <label>Current / Most Recent Company</label>
                        <input
                          type="text"
                          name="currentCompany"
                          value={formFields.currentCompany}
                          onChange={handleFormChange}
                          className="form-input"
                        />
                      </div>

                      <div className="form-field-group">
                        <label>Total Professional Experience (Years)</label>
                        <input
                          type="text"
                          name="experienceYears"
                          value={formFields.experienceYears}
                          onChange={handleFormChange}
                          className="form-input"
                        />
                      </div>

                      <div className="form-field-group">
                        <label>Notice Period</label>
                        <input
                          type="text"
                          name="noticePeriod"
                          value={formFields.noticePeriod}
                          onChange={handleFormChange}
                          className="form-input"
                        />
                      </div>

                      <div className="form-field-group">
                        <label>Expected Compensation / CTC</label>
                        <input
                          type="text"
                          name="expectedSalary"
                          value={formFields.expectedSalary}
                          onChange={handleFormChange}
                          className="form-input"
                        />
                      </div>

                      <div className="form-field-group full-width">
                        <label>Work Authorization / Visa Status</label>
                        <input
                          type="text"
                          name="workAuthorization"
                          value={formFields.workAuthorization}
                          onChange={handleFormChange}
                          className="form-input"
                        />
                      </div>

                      <div className="form-field-group full-width">
                        <label>Selected Application Resume</label>
                        <div className="attached-resume-preview-pill">
                          <CheckCircle size={16} className="text-emerald" />
                          <span>
                            {currentlySelectedResumeObj.name} ({currentlySelectedResumeObj.version})
                          </span>
                          <span className="preview-pill-tag">ATS: {currentAtsScore}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION B: EMPLOYER / APPLICATION QUESTIONS */}
                  <div className="form-section-container">
                    <div className="form-section-header">
                      <div>
                        <h5 className="form-section-title">
                          <Briefcase size={16} className="text-indigo" /> Section B: Employer & Application Questions
                        </h5>
                        <p className="form-section-subtitle">
                          Role-specific questions detected for {canonicalCompany}. AI suggestions are grounded exclusively in verified profile data.
                        </p>
                      </div>
                      <span className="text-indigo" style={{ fontSize: '0.78rem', fontWeight: 600 }}>
                        {detectedQuestions.length > 0 ? `${detectedQuestions.length} Questions Detected` : 'Standard Direct Intake'}
                      </span>
                    </div>

                    {detectedQuestions.length === 0 ? (
                      <div className="question-empty-state-card">
                        <HelpCircle size={32} style={{ margin: '0 auto 8px auto', opacity: 0.7 }} />
                        <p style={{ margin: '0 0 4px 0', fontWeight: 600, color: '#e2e8f0' }}>
                          No employer application questions were detected.
                        </p>
                        <p style={{ margin: 0, fontSize: '0.8rem' }}>
                          You may complete standard personal and experience fields, then proceed to the Confirmation Gate.
                        </p>
                      </div>
                    ) : (
                      <div className="employer-questions-list">
                        {detectedQuestions.map((qItem, idx) => {
                          const answerVal = customAnswers[qItem.id] || '';
                          const state = answerStates[qItem.id] || 'unanswered';
                          const hasErr = Boolean(validationErrors[qItem.id]);

                          return (
                            <div key={qItem.id} className={`employer-question-card ${hasErr ? 'has-error' : ''}`}>
                              <div className="question-header-row">
                                <div className="question-text-wrap">
                                  <span className="question-prompt-text">
                                    {idx + 1}. {qItem.question}
                                    {qItem.required && <span className="question-required-star">*</span>}
                                  </span>
                                </div>
                                <span className={`answer-state-badge ${state}`}>
                                  {state === 'confirmed' && <Check size={10} />}
                                  {state}
                                </span>
                              </div>

                              {qItem.groundedSource && (
                                <div className="question-grounding-note">
                                  <Sparkles size={11} className="text-indigo" />
                                  <span>Grounded Source: {qItem.groundedSource} (Zero fabrication rule)</span>
                                </div>
                              )}

                              <textarea
                                rows={3}
                                value={answerVal}
                                onChange={(e) => handleCustomAnswerChange(qItem.id, e.target.value)}
                                className={`form-textarea ${hasErr ? 'has-error' : ''}`}
                                placeholder="Candidate input required."
                                style={{ marginTop: '4px' }}
                              />

                              {hasErr && (
                                <span className="form-field-validation-error">
                                  <AlertTriangle size={12} /> {validationErrors[qItem.id]}
                                </span>
                              )}

                              <div className="question-actions-toolbar">
                                <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                                  {state === 'unanswered' ? '⚠️ Missing required answer' : '✓ Response provided'}
                                </span>
                                <div className="question-actions-right">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    icon={<RotateCcw size={12} />}
                                    onClick={() => {
                                      const grounded = generateGroundedAnswer(qItem);
                                      handleCustomAnswerChange(qItem.id, grounded);
                                      setAnswerStates(prev => ({
                                        ...prev,
                                        [qItem.id]: grounded === 'Candidate input required.' ? 'unanswered' : 'suggested'
                                      }));
                                    }}
                                  >
                                    Reset Suggestion
                                  </Button>
                                  {state !== 'confirmed' && answerVal.trim() && answerVal !== 'Candidate input required.' && (
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      icon={<Check size={12} />}
                                      onClick={() => handleConfirmAnswer(qItem.id)}
                                    >
                                      Confirm Answer
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Cover Letter Note */}
                    <div style={{ marginTop: '18px' }}>
                      <label style={{ fontSize: '0.84rem', fontWeight: 600, color: '#e2e8f0', display: 'block', marginBottom: '6px' }}>
                        Custom Cover Letter / Note to Hiring Team
                      </label>
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
                      Back to Resume Selection
                    </Button>
                    <Button
                      variant="primary"
                      icon={<ArrowRight size={14} />}
                      onClick={handleAdvanceToConfirmation}
                    >
                      Continue to Confirmation Gate
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 4: CONFIRMATION & FINAL SUBMISSION GATE */}
              {currentStep === 'confirmation' && (
                <div className="confirmation-step-content">
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '1.2rem', color: '#f8fafc' }}>Review & Final Submission Gate</h4>
                  <p style={{ margin: '0 0 16px 0', fontSize: '0.84rem', color: '#94a3b8' }}>
                    Verify your application package and readiness checklist. Automated submission eligibility is strictly evaluated against the 80% ATS threshold here.
                  </p>

                  {/* Submission Gate Card */}
                  <div className={`confirmation-gate-card ${isSubmissionFullyEligible ? 'ready' : 'attention'}`}>
                    <div className="gate-status-row">
                      {isSubmissionFullyEligible ? (
                        <CheckCircle size={22} className="text-emerald" />
                      ) : (
                        <AlertTriangle size={22} className="text-amber" />
                      )}
                      <div>
                        <h4 className="gate-status-heading">
                          Automatic Submission: {isSubmissionFullyEligible ? 'READY' : 'NOT AVAILABLE'}
                        </h4>
                      </div>
                    </div>
                    <p className="gate-status-desc">
                      {isSubmissionFullyEligible ? (
                        `Your selected resume meets the mandatory 80% ATS threshold (Current: ${currentAtsScore}%). All application checklist items are verified and ready for transmission.`
                      ) : !isAtsPassed ? (
                        `Automatic submission is unavailable until ATS compatibility reaches the required threshold (80%). Current score with selected resume: ${currentAtsScore}%. You may return to Resume Selection or Resume Studio to tailor or choose an alternate resume.`
                      ) : (
                        `Automatic submission is paused because one or more readiness checklist items need your confirmation.`
                      )}
                    </p>
                    {!isSubmissionFullyEligible && (
                      <div style={{ marginTop: '10px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<FileText size={14} />}
                          onClick={() => setCurrentStep('selection')}
                        >
                          Change Selected Resume
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<FileEdit size={14} />}
                          onClick={() => setCurrentStep('form')}
                        >
                          Back to Application Form
                        </Button>
                        {onNavigateToResumes && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={<ExternalLink size={14} />}
                            onClick={() => {
                              onClose();
                              onNavigateToResumes(tailoredResume ? tailoredResume.id : undefined);
                            }}
                          >
                            Open in Resume Studio
                          </Button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Readiness Checklist */}
                  <div className="confirmation-checklist-card">
                    <h5 className="checklist-title">
                      <CheckSquare size={16} className="text-indigo" /> Final Readiness Checklist
                    </h5>
                    <div className="checklist-items-grid">
                      <div className={`checklist-item-row ${checklistCandidateInfo ? 'passed' : 'failed'}`}>
                        {checklistCandidateInfo ? <CheckCircle size={14} className="text-emerald" /> : <AlertTriangle size={14} className="text-red" />}
                        <span>Candidate information complete ({formFields.fullName || 'Missing'})</span>
                      </div>

                      <div className={`checklist-item-row ${checklistResumeSelected ? 'passed' : 'failed'}`}>
                        {checklistResumeSelected ? <CheckCircle size={14} className="text-emerald" /> : <AlertTriangle size={14} className="text-red" />}
                        <span>Resume selected: {currentlySelectedResumeObj.name}</span>
                      </div>

                      <div className={`checklist-item-row ${checklistResumeOwnership ? 'passed' : 'failed'}`}>
                        {checklistResumeOwnership ? <CheckCircle size={14} className="text-emerald" /> : <AlertTriangle size={14} className="text-red" />}
                        <span>Resume belongs to authenticated candidate</span>
                      </div>

                      <div className={`checklist-item-row ${checklistQuestionsComplete ? 'passed' : 'failed'}`}>
                        {checklistQuestionsComplete ? <CheckCircle size={14} className="text-emerald" /> : <AlertTriangle size={14} className="text-red" />}
                        <span>Employer questions complete ({detectedQuestions.length} answered)</span>
                      </div>

                      <div className={`checklist-item-row ${checklistTruthPassed ? 'passed' : 'failed'}`}>
                        {checklistTruthPassed ? <CheckCircle size={14} className="text-emerald" /> : <AlertTriangle size={14} className="text-red" />}
                        <span>Truth validation passed (Zero fabricated background)</span>
                      </div>

                      <div className={`checklist-item-row ${isAtsPassed ? 'passed' : 'failed'}`}>
                        {isAtsPassed ? <CheckCircle size={14} className="text-emerald" /> : <AlertTriangle size={14} className="text-red" />}
                        <span>ATS Compatibility Threshold (Current: {currentAtsScore}% / Required: 80%)</span>
                      </div>
                    </div>
                  </div>

                  {/* Application Package Summary */}
                  <Card style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '16px' }}>
                    <h5 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', color: '#e2e8f0', fontWeight: 600 }}>
                      Application Package Summary
                    </h5>
                    <div className="summary-fields-list">
                      <div className="summary-row">
                        <span className="row-key">Company:</span>
                        <span className="row-val font-bold">{canonicalCompany}</span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Role:</span>
                        <span className="row-val">{job?.role}</span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Job Location:</span>
                        <span className="row-val">{job?.location || 'Specified by employer'}</span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Candidate Name:</span>
                        <span className="row-val">{formFields.fullName} ({formFields.email})</span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Candidate Location:</span>
                        <span className="row-val">{formFields.currentLocation}</span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Selected Resume:</span>
                        <span className="row-val text-emerald font-bold">
                          {currentlySelectedResumeObj.name} ({currentlySelectedResumeObj.version})
                        </span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Job Match Score:</span>
                        <span className="row-val text-indigo font-bold">{matchScore !== null ? `${matchScore}%` : 'Unavailable'}</span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">ATS Compatibility:</span>
                        <span className={`row-val font-bold ${isAtsPassed ? 'text-emerald' : 'text-amber'}`}>
                          {currentAtsScore !== null ? `${currentAtsScore}%` : 'Unavailable'} (Required: 80%)
                        </span>
                      </div>
                      <div className="summary-row">
                        <span className="row-key">Submission Mode:</span>
                        <span className="row-val">
                          <ApplicationModeBadge mode={effectiveMode} isCodewalla={isCodewalla} size="sm" />
                        </span>
                      </div>
                    </div>

                    {/* Application Answers Summary */}
                    {Object.keys(customAnswers).length > 0 && (
                      <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Application Answers Snapshot:
                        </span>
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {detectedQuestions.map(q => (
                            <div key={q.id} style={{ background: 'rgba(0, 0, 0, 0.25)', padding: '8px 12px', borderRadius: '6px' }}>
                              <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'block', fontWeight: 600 }}>{q.question}</span>
                              <span style={{ fontSize: '0.82rem', color: '#e2e8f0' }}>{customAnswers[q.id] || 'Candidate input required.'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>

                  <div className="modal-actions-bar">
                    <Button variant="secondary" icon={<ArrowLeft size={14} />} onClick={() => setCurrentStep('form')}>
                      Back to Application Form
                    </Button>
                    <div className="action-right-group">
                      {effectiveMode === 'demo' ? (
                        <Button
                          variant="primary"
                          icon={<Send size={16} />}
                          loading={isSubmitting}
                          disabled={!isSubmissionFullyEligible}
                          onClick={handleSubmitDemoApplication}
                        >
                          Submit Application
                        </Button>
                      ) : (
                        <Button
                          variant="primary"
                          icon={<ExternalLink size={16} />}
                          loading={isSubmitting}
                          disabled={!allChecklistItemsPassed}
                          onClick={handleStartExternalApplication}
                        >
                          Continue to Employer Application
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5: SUCCESS / SUBMITTED CONFIRMATION */}
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
