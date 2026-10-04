import React, { useState, useEffect } from 'react';
import { useApp } from "../context/AppContext";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { ProgressBar } from "../components/common/ProgressBar";
import { api } from "../api/index";
import {
  JobDescription,
  JobMatchAnalysis,
  TailoredResume
} from "../types/index";
import {
  ArrowLeft,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Target,
  FileCheck,
  Send,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building2,
  MapPin,
  Clock,
  Layers
} from 'lucide-react';
import './JobAnalysisPage.css';

interface JobAnalysisPageProps {
  jobId: string;
  onBack: () => void;
  onNavigate: (tab: string, contextId?: string) => void;
}

export const JobAnalysisPage: React.FC<JobAnalysisPageProps> = ({
  jobId,
  onBack,
  onNavigate
}) => {
  const { activeCandidate, showToast } = useApp();
  const [job, setJob] = useState<JobDescription | null>(null);
  const [analysis, setAnalysis] = useState<JobMatchAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTailoring, setIsTailoring] = useState(false);
  const [tailoredResume, setTailoredResume] = useState<TailoredResume | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    async function loadAnalysis() {
      if (!activeCandidate) return;
      try {
        setIsLoading(true);
        const jobData = await api.getJob(jobId);
        setJob(jobData);

        // Fetch or calculate match
        let existingMatch = await api.getMatch(activeCandidate.id, jobId);
        if (!existingMatch) {
          existingMatch = await api.analyzeMatch(activeCandidate.id, jobId);
        }
        setAnalysis(existingMatch);
      } catch (err) {
        console.error('Error loading job analysis:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadAnalysis();
  }, [jobId, activeCandidate]);

  if (isLoading || !job || !analysis || !activeCandidate) {
    return (
      <div className="analysis-loading-state">
        <Sparkles className="spin-icon" size={32} />
        <h3>JobPilot AI is executing 14-point evaluation...</h3>
        <p>Scanning career track alignment, truth-checking candidate skills, and simulating ATS algorithms.</p>
      </div>
    );
  }

  const { scores, recommendation, whyMatch, careerTrack, truthCheck, atsAnalysis, suggestedAnswers } = analysis;

  const handleGenerateTailoredResume = async () => {
    try {
      setIsTailoring(true);
      const res = await api.tailorResume(activeCandidate.id, job.id);
      setTailoredResume(res);
      showToast(`Tailored resume generated: ${res.versionName}!`);
    } catch (err: any) {
      alert(`Tailoring failed: ${err.message}`);
    } finally {
      setIsTailoring(false);
    }
  };

  const handleContinueApplication = async () => {
    try {
      setIsApplying(true);
      await api.saveApplication({
        candidateId: activeCandidate.id,
        jobId: job.id,
        resumeVersionId: tailoredResume?.id || '',
        resumeVersionName: tailoredResume?.versionName || 'Master_Profile',
        company: job.company,
        role: job.role,
        location: job.location,
        jobUrl: job.sourceUrl || '',
        matchScore: scores.overallScore,
        status: 'Ready to Apply',
        notes: `Application initialized via JobPilot match evaluation (${scores.overallScore}% score).`,
        customAnswers: suggestedAnswers
      });
      showToast('Application logged to Tracker under "Ready to Apply"!');
      onNavigate('applications');
    } catch (err: any) {
      alert(`Failed to save application: ${err.message}`);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="job-analysis-page">
      {/* Top Header */}
      <div className="analysis-top-nav">
        <Button variant="ghost" size="sm" icon={<ArrowLeft size={16} />} onClick={onBack}>
          Back to Jobs Catalog
        </Button>
        <div className="source-info">
          <span>Source: {job.sourceType.toUpperCase()}</span>
          {job.sourceUrl && (
            <a href={job.sourceUrl} target="_blank" rel="noreferrer" className="external-link-btn">
              Job Page <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {/* Role Header Banner */}
      <div className="analysis-hero-card">
        <div className="hero-main">
          <div className="hero-tags">
            <span className="hero-company">{job.company}</span>
            <Badge variant="indigo" size="sm">{job.careerTrack}</Badge>
          </div>
          <h2 className="hero-role-title">{job.role}</h2>
          <div className="hero-sub-meta">
            <span><MapPin size={14} /> {job.location}</span>
            <span><Clock size={14} /> {job.experienceRequired}</span>
            <span>Salary: {job.salary || 'Competitive'}</span>
          </div>
        </div>

        {/* Big Overall Match Score Ring Card */}
        <div className="hero-score-pod">
          <div className="score-pod-circle">
            <span className="score-pod-number">{scores.overallScore}%</span>
            <span className="score-pod-label">Match Score</span>
          </div>
          <Badge variant={recommendation.color as any} size="md">
            {recommendation.level}
          </Badge>
          <p className="recommendation-desc">{recommendation.description}</p>
        </div>
      </div>

      {/* 2-Column Evaluation Dashboard */}
      <div className="analysis-grid-layout">
        {/* Left Column: Breakdown, Why Match, Career Track, Suggested Answers */}
        <div className="analysis-left-pane">
          {/* Detailed Score Dimensions */}
          <Card className="analysis-block">
            <h3 className="block-title">
              <Target size={18} /> Transparent Scoring Dimensions
            </h3>
            <p className="block-sub">
              Deterministic comparison weighted against verified candidate profile history.
            </p>

            <div className="score-bars-list">
              <ProgressBar value={scores.skillScore} label="Technical Skill Alignment" color="indigo" />
              <ProgressBar value={scores.experienceScore} label="Years of Experience Match" color="emerald" />
              <ProgressBar value={scores.roleScore} label="Target Role Fit" color="blue" />
              <ProgressBar value={scores.locationScore} label="Location & Work Preference" color="emerald" />
              <ProgressBar value={scores.seniorityScore} label="Seniority Level Fit" color="amber" />
            </div>
          </Card>

          {/* Career Track Alignment */}
          <Card className="analysis-block">
            <h3 className="block-title">
              <Layers size={18} /> Career Track Alignment
            </h3>
            <div className="track-compare-box">
              <div className="track-side">
                <span className="track-side-label">Candidate Track</span>
                <span className="track-val">{careerTrack.candidateTrack}</span>
              </div>
              <div className="track-arrow">→</div>
              <div className="track-side">
                <span className="track-side-label">Target Role Track</span>
                <span className="track-val">{careerTrack.jobTrack}</span>
              </div>
            </div>

            {careerTrack.isSameTrack ? (
              <div className="track-status-alert same-track">
                <CheckCircle size={16} /> Direct Track Alignment: Candidate experience maps seamlessly onto this role.
              </div>
            ) : (
              <div className="track-status-alert cross-track">
                <AlertTriangle size={16} /> Cross-Track Transition: {careerTrack.transitionGapExplanation}
              </div>
            )}
          </Card>

          {/* Why This Job Analysis */}
          <Card className="analysis-block">
            <h3 className="block-title">Why Candidate Fits / Potential Gaps</h3>

            <div className="why-section">
              <h4 className="why-subhead text-success">
                <CheckCircle size={15} /> Key Matching Strengths
              </h4>
              <ul className="why-bullet-list">
                {whyMatch.matchingStrengths.map((str, idx) => (
                  <li key={idx}>{str}</li>
                ))}
              </ul>
            </div>

            <div className="why-section">
              <h4 className="why-subhead text-danger">
                <AlertTriangle size={15} /> Identified Gaps & Missing Skills
              </h4>
              <ul className="why-bullet-list">
                {whyMatch.missingOrWeakAreas.map((gap, idx) => (
                  <li key={idx}>{gap}</li>
                ))}
              </ul>
            </div>

            <div className="why-section">
              <h4 className="why-subhead text-warning">
                Potential Recruitment Concerns
              </h4>
              <ul className="why-bullet-list">
                {whyMatch.potentialConcerns.map((c, idx) => (
                  <li key={idx}>{c}</li>
                ))}
              </ul>
            </div>
          </Card>

          {/* Suggested Application Answers */}
          <Card className="analysis-block">
            <h3 className="block-title">Suggested Application Form Answers</h3>
            <p className="block-sub">
              Editable responses derived from master candidate profile for quick copy-paste into application portals.
            </p>
            <div className="answers-faq-list">
              {Object.entries(suggestedAnswers).map(([q, a], idx) => (
                <div key={idx} className="faq-answer-item">
                  <span className="faq-question">{q}</span>
                  <p className="faq-answer-text">{a}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right Column: Truth Check & ATS Simulation & Tailoring Action */}
        <div className="analysis-right-pane">
          {/* Strict Truth Check */}
          <Card className="analysis-block">
            <div className="truth-check-head">
              <h3 className="block-title">
                <ShieldCheck size={18} /> Candidate Truth Check
              </h3>
              <Badge variant={truthCheck.passed ? 'emerald' : 'amber'} size="sm">
                {truthCheck.passed ? 'Verified Genuine' : 'Review Required'}
              </Badge>
            </div>
            <p className="truth-rule-desc">
              Strict Rule: JobPilot never invents unverified experience. RED skills will not be injected onto the resume.
            </p>

            <div className="truth-summary-pills">
              <span className="pill green-pill">GREEN: {truthCheck.greenCount} Confirmed</span>
              <span className="pill yellow-pill">YELLOW: {truthCheck.yellowCount} Transferable</span>
              <span className="pill red-pill">RED: {truthCheck.redCount} Missing</span>
            </div>

            <div className="truth-items-list">
              {truthCheck.items.map((item, idx) => (
                <div key={idx} className={`truth-row truth-status-${item.status.toLowerCase()}`}>
                  <div className="truth-row-top">
                    <span className="truth-tech-name">{item.requirement}</span>
                    <span className={`status-tag status-${item.status.toLowerCase()}`}>
                      {item.status}
                    </span>
                  </div>
                  <span className="truth-evidence">{item.evidence}</span>
                  <span className="truth-note">{item.note}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* ATS Analyzer Simulation */}
          <Card className="analysis-block">
            <div className="ats-header">
              <div>
                <h3 className="block-title">Estimated ATS Match</h3>
                <span className="ats-score-badge">{atsAnalysis.estimatedScore}% Estimated Index</span>
              </div>
              <Badge variant="blue" size="sm">Simulation</Badge>
            </div>

            <p className="ats-disclaimer">{atsAnalysis.disclaimer}</p>

            <div className="ats-breakdown-grid">
              <div className="ats-mini-stat">
                <span className="mini-val">{atsAnalysis.breakdown.keywordMatch}%</span>
                <span className="mini-lbl">Keyword Match</span>
              </div>
              <div className="ats-mini-stat">
                <span className="mini-val">{atsAnalysis.breakdown.roleAlignment}%</span>
                <span className="mini-lbl">Role Alignment</span>
              </div>
              <div className="ats-mini-stat">
                <span className="mini-val">{atsAnalysis.breakdown.experienceAlignment}%</span>
                <span className="mini-lbl">Experience Fit</span>
              </div>
              <div className="ats-mini-stat">
                <span className="mini-val">{atsAnalysis.breakdown.readability}%</span>
                <span className="mini-lbl">Readability</span>
              </div>
            </div>

            {/* Keyword categorization */}
            <div className="ats-keywords-section">
              <div className="kw-category">
                <span className="kw-title text-success">Strongly Represented ({atsAnalysis.keywords.green.length})</span>
                <div className="kw-chips">
                  {atsAnalysis.keywords.green.map(k => (
                    <span key={k} className="kw-chip kw-green">{k}</span>
                  ))}
                </div>
              </div>

              {atsAnalysis.keywords.red.length > 0 && (
                <div className="kw-category">
                  <span className="kw-title text-danger">Missing from Profile ({atsAnalysis.keywords.red.length})</span>
                  <div className="kw-chips">
                    {atsAnalysis.keywords.red.map(k => (
                      <span key={k} className="kw-chip kw-red">{k}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Action Center: Tailor Resume & Continue Application */}
          <Card className="analysis-action-pod">
            <h3 className="block-title">
              <FileCheck size={18} /> Next Application Steps
            </h3>
            <p className="action-pod-desc">
              Generate a tailored resume version reordering bullets and highlighting matching skills without fabrication.
            </p>

            {tailoredResume ? (
              <div className="tailored-ready-box">
                <CheckCircle size={18} className="ready-icon" />
                <div>
                  <span className="ready-title">Resume Ready: {tailoredResume.versionName}</span>
                  <p className="ready-desc">{tailoredResume.modifications.length} tailored enhancements applied.</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate('resumes', tailoredResume.id)}
                >
                  View Diff
                </Button>
              </div>
            ) : (
              <Button
                variant="primary"
                icon={<Sparkles size={16} />}
                loading={isTailoring}
                onClick={handleGenerateTailoredResume}
              >
                Generate Job-Specific Tailored Resume
              </Button>
            )}

            <div className="action-button-divider" />

            <div className="continue-app-strip">
              <p className="safe-policy-note">
                JobPilot V1 assists you directly without unauthorized automated submission.
              </p>
              <Button
                variant="secondary"
                icon={<Send size={16} />}
                loading={isApplying}
                onClick={handleContinueApplication}
              >
                Continue Application & Track
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
