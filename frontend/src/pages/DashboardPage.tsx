import React, { useEffect, useState, useCallback } from 'react';
import { BentoGrid, BentoTile } from '../components/bento/BentoGrid';
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { useAuth } from "../context/AuthContext";
import { useApp } from "../context/AppContext";
import { apiClient } from "../api/client";
import {
  User,
  FileText,
  Briefcase,
  Layers,
  ArrowRight,
  Upload,
  CheckCircle2,
  Clock,
  Sparkles,
  MapPin,
  ExternalLink,
  AlertCircle,
  Bookmark,
  Send,
  Zap,
  Target,
  GraduationCap,
  RefreshCw,
  Search,
  SlidersHorizontal,
  ChevronRight,
  Award,
  TrendingUp,
  Cpu
} from 'lucide-react';
import './DashboardPage.css';

interface DashboardPageProps {
  onNavigate: (tab: string, contextId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { activeCandidate } = useApp();
  
  // Independent State Streams
  const [latestJobs, setLatestJobs] = useState<any[]>([]);
  const [jobsLoading, setJobsLoading] = useState<boolean>(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const [profile, setProfile] = useState<any>(null);
  const [resumes, setResumes] = useState<any[]>([]);
  const [appStats, setAppStats] = useState<any>({
    SAVED: 0,
    APPLIED: 0,
    INTERVIEW: 0,
    OFFER: 0,
    REJECTED: 0
  });
  const [skillGaps, setSkillGaps] = useState<any[]>([]);
  const [secondaryLoading, setSecondaryLoading] = useState<boolean>(true);

  // 1. HIGH-PRIORITY: Load Recommended Jobs (or Fallback to Latest if New)
  const loadLatestJobs = useCallback(async () => {
    try {
      setJobsLoading(true);
      setJobsError(null);
      // Attempt to load personalized recommendations first
      const recRes = await apiClient.getRecommendedJobs({ pageSize: 6 });
      if (recRes && recRes.items && recRes.items.length > 0) {
        setLatestJobs(recRes.items);
      } else {
        // Fallback to latest canonical jobs
        const res = await apiClient.getCanonicalJobs({ pageSize: 6, sortBy: 'latest' });
        setLatestJobs(res?.data || []);
      }
    } catch (err: any) {
      console.warn('Could not load recommended jobs directly, falling back:', err);
      try {
        const res = await apiClient.getCanonicalJobs({ pageSize: 6, sortBy: 'latest' });
        setLatestJobs(res?.data || []);
      } catch (fallbackErr: any) {
        setJobsError(fallbackErr?.message || 'Unable to load opportunities');
      }
    } finally {
      setJobsLoading(false);
    }
  }, []);

  // 2. PROGRESSIVE BACKGROUND: Load Supporting Profile, Resume, Applications, & Skill Intelligence
  const loadSupportingData = useCallback(async () => {
    let active = true;
    try {
      setSecondaryLoading(true);

      const [profileRes, resumesRes, appsRes] = await Promise.allSettled([
        apiClient.getCandidateProfile(),
        apiClient.listResumes(),
        apiClient.listApplications({ pageSize: 100 })
      ]);

      if (!active) return;

      let profData: any = null;
      if (profileRes.status === 'fulfilled') {
        profData = profileRes.value;
        setProfile(profData);
      }

      let resData: any[] = [];
      if (resumesRes.status === 'fulfilled') {
        resData = resumesRes.value || [];
        setResumes(resData);
      }

      if (appsRes.status === 'fulfilled') {
        const appsData = appsRes.value?.data || [];
        const counts = { SAVED: 0, APPLIED: 0, INTERVIEW: 0, OFFER: 0, REJECTED: 0 };
        appsData.forEach((app: any) => {
          const s = (app.status || '').toUpperCase();
          if (s === 'SAVED') counts.SAVED++;
          else if (s === 'APPLIED' || s === 'APPLICATION_STARTED') counts.APPLIED++;
          else if (s.includes('INTERVIEW') || s === 'HR_SCREEN' || s === 'TECHNICAL') counts.INTERVIEW++;
          else if (s === 'OFFER') counts.OFFER++;
          else if (s === 'REJECTED') counts.REJECTED++;
        });
        setAppStats(counts);
      }

      // Compute Top Skill Gaps if candidate profile and jobs are available
      const candidateSkills = new Set(
        (profData?.skills || []).map((s: any) => (s.skill?.name || s.name || '').toLowerCase())
      );

      const gapMap = new Map<string, number>();
      latestJobs.forEach((job: any) => {
        (job.skills || []).forEach((sk: any) => {
          const skillName = sk.name || sk.skill?.name;
          if (skillName && !candidateSkills.has(skillName.toLowerCase())) {
            gapMap.set(skillName, (gapMap.get(skillName) || 0) + 1);
          }
        });
      });

      const sortedGaps = Array.from(gapMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({
          name,
          count,
          recommendation: `Target ${name} to unlock matching opportunities`
        }));

      setSkillGaps(sortedGaps);
    } catch {
      // Graceful fallback
    } finally {
      if (active) {
        setSecondaryLoading(false);
      }
    }

    return () => {
      active = false;
    };
  }, [latestJobs]);

  // Trigger high-priority latest jobs on mount
  useEffect(() => {
    loadLatestJobs();
  }, [loadLatestJobs]);

  // Trigger secondary background supporting data
  useEffect(() => {
    loadSupportingData();
  }, [loadSupportingData, user?.id]);

  // Compute profile completeness score based on candidate fields
  let completionPoints = 0;
  if (profile?.fullName) completionPoints += 15;
  if (profile?.email) completionPoints += 10;
  if (profile?.headline) completionPoints += 15;
  if (profile?.summary) completionPoints += 15;
  if ((profile?.experiences?.length || 0) > 0) completionPoints += 15;
  if ((profile?.skills?.length || 0) > 0) completionPoints += 15;
  if ((profile?.educations?.length || 0) > 0) completionPoints += 10;
  if ((profile?.certifications?.length || 0) > 0 || (profile?.projects?.length || 0) > 0) completionPoints += 5;
  const completeness = Math.min(100, completionPoints);

  const candidateName = activeCandidate?.name || profile?.fullName || user?.candidateProfile?.fullName || user?.email?.split('@')[0] || 'Candidate';
  const masterResume = resumes.find(r => r.isMaster) || resumes[0];

  const formatRelativeDate = (dateStr?: string) => {
    if (!dateStr) return 'Recently posted';
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return 'Recently posted';
    const diffHours = Math.floor((Date.now() - time) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Posted just now';
    if (diffHours < 24) return `Posted ${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Posted yesterday';
    if (diffDays < 30) return `Posted ${diffDays}d ago`;
    return 'Posted 1mo+ ago';
  };

  return (
    <div className="dashboard-page" style={{ position: 'relative' }}>
      {/* Compact Top Greet & Instant Job Search Bar */}
      <div className="dashboard-top-bar">
        <div className="dash-compact-greeting">
          <span className="dash-greeting-label">Welcome back,</span>
          <span className="dash-greeting-name">{candidateName}</span>
        </div>

        {/* Quick Job Search & Filter Controls */}
        <div className="dash-search-row">
          <div className="dash-search-input-wrap" onClick={() => onNavigate('jobs')}>
            <Search size={16} className="dash-search-icon" />
            <input
              type="text"
              readOnly
              placeholder="Search jobs, skills, companies..."
              onClick={() => onNavigate('jobs')}
              className="dash-search-input"
            />
          </div>
          <button
            type="button"
            className="dash-quick-filter-btn"
            onClick={() => onNavigate('jobs')}
          >
            <SlidersHorizontal size={14} />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* ============================================================== */}
      {/* BENTO GRID ARCHITECTURE (Jobs-First Dominance + Supporting Tiles) */}
      {/* ============================================================== */}
      <BentoGrid className="dashboard-bento-grid">

        {/* 1. LARGE FEATURE TILE (DOMINANT): Latest Job Opportunities */}
        <BentoTile size="large" className="bento-tile-jobs-hero">
          <div className="bento-jobs-header">
            <div className="bento-jobs-title-wrap">
              <div className="live-indicator-wrap">
                <span className="live-pulse-dot" />
                <h2 className="bento-section-title">Latest Opportunities</h2>
              </div>
              <p className="bento-section-sub desktop-only-text">
                Verified real-time roles from direct company portals. Newest first.
              </p>
            </div>
            <div className="bento-jobs-actions">
              <button className="bento-action-link" onClick={() => onNavigate('jobs')}>
                <span>View all jobs</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Quick Category Filter Pills */}
          <div className="bento-quick-pills">
            <button className="bento-pill bento-pill-active" onClick={() => onNavigate('jobs')}>
              All Roles
            </button>
            <button className="bento-pill" onClick={() => onNavigate('jobs')}>
              Remote
            </button>
            <button className="bento-pill" onClick={() => onNavigate('jobs')}>
              Full Time
            </button>
            <button className="bento-pill" onClick={() => onNavigate('jobs')}>
              Engineering
            </button>
            <button className="bento-pill" onClick={() => onNavigate('jobs')}>
              Product
            </button>
          </div>

          {/* Jobs Loading Stream: 6 Realistic Bento Skeleton Cards */}
          {jobsLoading && (
            <div className="bento-jobs-cards-grid">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <div key={n} className="job-skeleton-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div className="skeleton-shimmer" style={{ height: '14px', width: '38%' }} />
                      <div className="skeleton-shimmer" style={{ height: '18px', width: '22%', borderRadius: '12px' }} />
                    </div>
                    <div className="skeleton-shimmer" style={{ height: '20px', width: '75%', marginBottom: '14px' }} />
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                      <div className="skeleton-shimmer" style={{ height: '14px', width: '28%' }} />
                      <div className="skeleton-shimmer" style={{ height: '14px', width: '22%' }} />
                      <div className="skeleton-shimmer" style={{ height: '14px', width: '24%' }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <div className="skeleton-shimmer" style={{ height: '28px', width: '60px', borderRadius: '6px' }} />
                    <div className="skeleton-shimmer" style={{ height: '28px', width: '110px', borderRadius: '6px' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Jobs Error Stream (Recoverable) */}
          {jobsError && !jobsLoading && (
            <div className="bento-jobs-error-box">
              <AlertCircle size={28} className="bento-error-icon" />
              <p className="bento-error-text">{jobsError}</p>
              <Button variant="outline" size="sm" onClick={loadLatestJobs}>
                Retry Opportunities
              </Button>
            </div>
          )}

          {/* Real Canonical Jobs Bento Grid */}
          {!jobsLoading && !jobsError && latestJobs.length > 0 && (
            <div className="bento-jobs-cards-grid">
              {latestJobs.map((job) => (
                <div key={job.id} className="bento-job-card" onClick={() => onNavigate('jobs', job.id)}>
                  <div className="bento-job-card-top">
                    <div className="bento-job-company-badge">
                      <span className="bento-job-company">
                        {job.company?.name || 'Verified Company'}
                      </span>
                    </div>
                    <Badge variant="indigo" size="sm">
                      {formatRelativeDate(job.postedAt || job.firstSeenAt)}
                    </Badge>
                  </div>

                  <h3 className="bento-job-title" title={job.title}>
                    {job.title}
                  </h3>

                  <div className="bento-job-meta">
                    <span className="bento-meta-item">
                      <MapPin size={12} />
                      <span className="bento-meta-text">{job.location || job.city || 'Remote'}</span>
                    </span>
                    <span className="bento-meta-item">
                      <Briefcase size={12} />
                      <span className="bento-meta-text">{job.remoteType ? job.remoteType.replace('_', ' ') : 'Flexible'}</span>
                    </span>
                    <span className="bento-meta-item">
                      <Clock size={12} />
                      <span className="bento-meta-text">{job.employmentType ? job.employmentType.replace('_', ' ') : 'Full Time'}</span>
                    </span>
                  </div>

                  <div className="bento-job-card-bottom" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="bento-job-save-btn"
                      title="Save Job"
                      onClick={(e) => {
                        e.stopPropagation();
                        apiClient.createApplication({ jobId: job.id, status: 'SAVED' })
                          .then(() => alert('Job saved to your applications!'))
                          .catch(() => alert('Job already saved.'));
                      }}
                    >
                      <Bookmark size={14} />
                      <span>Save</span>
                    </button>

                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Send size={14} />}
                      onClick={() => onNavigate('analysis', job.id)}
                    >
                      <span>Apply</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!jobsLoading && !jobsError && latestJobs.length === 0 && (
            <div className="bento-jobs-empty">
              <Briefcase size={36} className="bento-empty-icon" />
              <h4>No active opportunities yet</h4>
              <p>Canonical job sources will populate opportunities as sync runs.</p>
              <Button variant="outline" size="sm" onClick={() => onNavigate('jobs')}>
                Explore Full Catalog
              </Button>
            </div>
          )}
        </BentoTile>

        {/* 2. MEDIUM TILE: Profile Readiness */}
        <BentoTile size="medium" hoverable className="bento-tile-profile" onClick={() => onNavigate('profile')}>
          <div className="bento-tile-header">
            <div className="bento-tile-title-group">
              <div className="bento-tile-icon-wrap bento-icon-blue">
                <User size={18} />
              </div>
              <div>
                <h3 className="bento-tile-title">Profile Readiness</h3>
                <p className="bento-tile-subtitle">Impacts job match precision</p>
              </div>
            </div>
            <span className="bento-score-badge">{completeness}%</span>
          </div>

          <div className="bento-progress-wrap">
            <div className="bento-progress-track">
              <div
                className="bento-progress-fill"
                style={{
                  width: `${completeness}%`,
                  background: completeness > 75 ? 'var(--color-success)' : completeness > 40 ? 'var(--accent-primary)' : 'var(--color-warning)'
                }}
              />
            </div>
          </div>

          <div className="bento-profile-checklist">
            <div className="bento-check-row">
              <span className={`bento-check-dot ${profile?.fullName ? 'dot-active' : ''}`} />
              <span className="bento-check-label">Identity & Headline</span>
            </div>
            <div className="bento-check-row">
              <span className={`bento-check-dot ${(profile?.experiences?.length || 0) > 0 ? 'dot-active' : ''}`} />
              <span className="bento-check-label">Verified Experience</span>
            </div>
            <div className="bento-check-row">
              <span className={`bento-check-dot ${(profile?.skills?.length || 0) > 0 ? 'dot-active' : ''}`} />
              <span className="bento-check-label">Core Competencies</span>
            </div>
          </div>

          <div className="bento-tile-footer">
            <span className="bento-footer-action">
              <span>Improve Profile</span>
              <ChevronRight size={14} />
            </span>
          </div>
        </BentoTile>

        {/* 3. MEDIUM TILE: Master Resume Vault */}
        <BentoTile size="medium" hoverable className="bento-tile-resume" onClick={() => onNavigate('resumes')}>
          <div className="bento-tile-header">
            <div className="bento-tile-title-group">
              <div className="bento-tile-icon-wrap bento-icon-emerald">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="bento-tile-title">Resume Vault</h3>
                <p className="bento-tile-subtitle">Canonical ATS source document</p>
              </div>
            </div>
            <Badge variant={masterResume ? 'emerald' : 'amber'} size="sm">
              {masterResume ? 'Master Active' : 'No Resume'}
            </Badge>
          </div>

          <div className="bento-resume-status-card">
            {masterResume ? (
              <div className="bento-resume-doc-row">
                <FileText size={24} className="bento-doc-icon" />
                <div className="bento-doc-info">
                  <h4 className="bento-doc-title">{masterResume.originalFilename || 'Master_Resume.pdf'}</h4>
                  <span className="bento-doc-meta">
                    Active snapshot • {formatRelativeDate(masterResume.createdAt)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bento-resume-empty-prompt">
                <p>Upload your master PDF or DOCX to unlock automated tailoring.</p>
              </div>
            )}
          </div>

          <div className="bento-tile-footer">
            <span className="bento-footer-action">
              <span>Manage Resumes</span>
              <ChevronRight size={14} />
            </span>
          </div>
        </BentoTile>

        {/* 4. SMALL TILE: Application Pipeline */}
        <BentoTile size="small" hoverable className="bento-tile-pipeline" onClick={() => onNavigate('applications')}>
          <div className="bento-tile-header">
            <div className="bento-tile-icon-wrap bento-icon-indigo">
              <Send size={18} />
            </div>
            <span className="bento-stat-hero">{appStats.APPLIED}</span>
          </div>
          <h3 className="bento-tile-title">Applications</h3>
          <p className="bento-stat-sub">Active submissions</p>
          <div className="bento-pipeline-mini-stats">
            <span className="mini-stat-item">{appStats.INTERVIEW} Interview</span>
            <span className="mini-stat-sep">•</span>
            <span className="mini-stat-item">{appStats.OFFER} Offer</span>
          </div>
        </BentoTile>

        {/* 5. SMALL TILE: Saved Opportunities */}
        <BentoTile size="small" hoverable className="bento-tile-saved" onClick={() => onNavigate('applications')}>
          <div className="bento-tile-header">
            <div className="bento-tile-icon-wrap bento-icon-amber">
              <Bookmark size={18} />
            </div>
            <span className="bento-stat-hero">{appStats.SAVED}</span>
          </div>
          <h3 className="bento-tile-title">Saved Jobs</h3>
          <p className="bento-stat-sub">Bookmarked for review</p>
          <div className="bento-tile-footer" style={{ marginTop: 'auto', paddingTop: '10px' }}>
            <span className="bento-footer-action">
              <span>View Saved</span>
              <ChevronRight size={14} />
            </span>
          </div>
        </BentoTile>

        {/* 6. MEDIUM TILE (SPAN 6): High-Impact Skill Gaps */}
        <BentoTile size="medium" hoverable className="bento-tile-skill-gaps" onClick={() => onNavigate('career')}>
          <div className="bento-tile-header">
            <div className="bento-tile-title-group">
              <div className="bento-tile-icon-wrap bento-icon-purple">
                <Target size={18} />
              </div>
              <div>
                <h3 className="bento-tile-title">High-Impact Skill Gaps</h3>
                <p className="bento-tile-subtitle">Market demand from verified openings</p>
              </div>
            </div>
            <span className="bento-action-link" style={{ fontSize: '0.8125rem' }}>
              Career Lab →
            </span>
          </div>

          <div className="bento-skill-gaps-list">
            {skillGaps.length > 0 ? (
              skillGaps.map((gap, i) => (
                <div key={i} className="bento-skill-gap-item">
                  <div className="bento-skill-gap-top">
                    <span className="bento-skill-name">{gap.name}</span>
                    <Badge variant="indigo" size="sm">
                      +{gap.count} {gap.count === 1 ? 'match' : 'matches'}
                    </Badge>
                  </div>
                  <span className="bento-skill-rec">{gap.recommendation}</span>
                </div>
              ))
            ) : (
              <div className="bento-skills-aligned-box">
                <CheckCircle2 size={24} style={{ color: 'var(--color-success)', margin: '0 auto 6px' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Skills Closely Aligned
                </span>
                <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Profile skills match current job requirements in your domain.
                </p>
              </div>
            )}
          </div>
        </BentoTile>

        {/* 7. SMALL TILE (OR SPAN 3): Interview Studio Shortcut */}
        <BentoTile size="small" hoverable className="bento-tile-interview" onClick={() => onNavigate('interview')}>
          <div className="bento-tile-header">
            <div className="bento-tile-icon-wrap bento-icon-blue">
              <GraduationCap size={18} />
            </div>
            <Badge variant="indigo" size="sm">AI Prep</Badge>
          </div>
          <h3 className="bento-tile-title">Interview Prep</h3>
          <p className="bento-stat-sub">Targeted role simulations</p>
          <div className="bento-tile-footer" style={{ marginTop: 'auto', paddingTop: '10px' }}>
            <span className="bento-footer-action">
              <span>Start Studio</span>
              <ChevronRight size={14} />
            </span>
          </div>
        </BentoTile>

        {/* 8. SMALL TILE: Universal Discovery Sources */}
        <BentoTile size="small" hoverable className="bento-tile-discovery" onClick={() => onNavigate('jobs')}>
          <div className="bento-tile-header">
            <div className="bento-tile-icon-wrap bento-icon-emerald">
              <Cpu size={18} />
            </div>
            <span className="bento-pulse-badge">Live</span>
          </div>
          <h3 className="bento-tile-title">Job Discovery</h3>
          <p className="bento-stat-sub">Codewalla, Greenhouse, Lever</p>
          <div className="bento-tile-footer" style={{ marginTop: 'auto', paddingTop: '10px' }}>
            <span className="bento-footer-action">
              <span>Sync Status</span>
              <ChevronRight size={14} />
            </span>
          </div>
        </BentoTile>

      </BentoGrid>
    </div>
  );
};

export default DashboardPage;
