import React, { useEffect, useState, useCallback } from 'react';
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { useAuth } from "../context/AuthContext";
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
  RefreshCw
} from 'lucide-react';
import './DashboardPage.css';

interface DashboardPageProps {
  onNavigate: (tab: string, contextId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  
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

  // 1. HIGH-PRIORITY: Load Latest Jobs Immediately
  const loadLatestJobs = useCallback(async () => {
    try {
      setJobsLoading(true);
      setJobsError(null);
      const res = await apiClient.getCanonicalJobs({ pageSize: 6, sortBy: 'latest' });
      setLatestJobs(res?.data || []);
    } catch (err: any) {
      console.warn('Could not load latest jobs directly:', err);
      setJobsError(err?.message || 'Unable to load latest opportunities');
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
          recommendation: `Recommended: Complete a guided project or study ${name} fundamentals`
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

  const candidateName = profile?.fullName || user?.candidateProfile?.fullName || user?.email?.split('@')[0] || 'Candidate';
  const masterResume = resumes.find(r => r.isMaster) || resumes[0];

  const formatRelativeDate = (dateStr?: string) => {
    if (!dateStr) return 'Recently posted';
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return 'Recently posted';
    const diffHours = Math.floor((Date.now() - time) / (1000 * 60 * 60));
    if (diffHours < 1) return 'Posted just now';
    if (diffHours < 24) return `Posted ${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Posted yesterday';
    if (diffDays < 30) return `Posted ${diffDays} days ago`;
    return 'Posted over a month ago';
  };

  return (
    <div className="dashboard-page" style={{ position: 'relative' }}>
      {/* 1. Action-Oriented Hero Banner */}
      <div className="dash-hero">
        <div className="dash-hero-content">
          <Badge variant="indigo" size="sm">
            Personal Career Operating System
          </Badge>
          <h2 className="dash-hero-title">
            Welcome back, {candidateName}
          </h2>
          <p className="dash-hero-subtitle">
            Discover real career opportunities instantly, build verified resumes, and track your applications.
          </p>
        </div>
        <div className="dash-hero-actions" style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="outline"
            icon={<User size={16} />}
            onClick={() => onNavigate('profile')}
          >
            My Profile
          </Button>
          <Button
            variant="primary"
            icon={<Briefcase size={16} />}
            onClick={() => onNavigate('jobs')}
          >
            Explore All Jobs
          </Button>
        </div>
      </div>

      {/* 2. JOBS-FIRST SECTION: Latest Real Canonical Opportunities (Highest Priority) */}
      <div className="dashboard-jobs-first-section">
        <div className="section-head" style={{ marginBottom: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }} />
              <h3 className="section-title" style={{ fontSize: '1.25rem', fontWeight: 800 }}>
                Latest Verified Job Opportunities
              </h3>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Real-time openings from connected company career sources. Newest first.
            </p>
          </div>
          <button className="link-action" onClick={() => onNavigate('jobs')}>
            Browse Full Catalog →
          </button>
        </div>

        {/* Jobs Loading Stream */}
        {jobsLoading && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {[1, 2, 3].map(n => (
              <Card key={n} style={{ padding: '24px', minHeight: '180px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ height: '14px', width: '40%', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px' }} />
                <div style={{ height: '22px', width: '80%', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '4px' }} />
                <div style={{ height: '14px', width: '60%', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '4px', marginTop: 'auto' }} />
              </Card>
            ))}
          </div>
        )}

        {/* Jobs Error Stream (Recoverable without blocking page) */}
        {jobsError && !jobsLoading && (
          <Card style={{ padding: '24px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <AlertCircle size={28} style={{ color: '#f87171', margin: '0 auto 8px' }} />
            <p style={{ color: 'var(--text-primary)', fontWeight: 600, margin: '0 0 6px' }}>{jobsError}</p>
            <Button variant="outline" size="sm" onClick={loadLatestJobs}>
              Retry Opportunities
            </Button>
          </Card>
        )}

        {/* Jobs List Grid */}
        {!jobsLoading && !jobsError && latestJobs.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {latestJobs.map((job) => (
              <Card key={job.id} className="job-overview-card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div className="job-card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <span className="job-company" style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                      {job.company?.name || 'Verified Company'}
                    </span>
                    <Badge variant="indigo" size="sm">
                      {formatRelativeDate(job.postedAt || job.firstSeenAt)}
                    </Badge>
                  </div>

                  <h4 className="job-role" style={{ margin: '0 0 10px', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                    {job.title}
                  </h4>

                  <div className="job-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                    <span className="meta-item" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={13} /> {job.location || job.city || 'Location unlisted'}
                    </span>
                    <span className="meta-item">
                      {job.remoteType ? job.remoteType.replace('_', ' ') : 'Flexible'}
                    </span>
                    <span className="meta-item">
                      {job.employmentType ? job.employmentType.replace('_', ' ') : 'Full Time'}
                    </span>
                  </div>
                </div>

                <div className="job-card-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Bookmark size={14} />}
                    onClick={(e) => {
                      e.stopPropagation();
                      apiClient.createApplication({ jobId: job.id, status: 'SAVED' })
                        .then(() => alert('Job saved to your applications!'))
                        .catch(() => alert('Job already saved.'));
                    }}
                  >
                    Save
                  </Button>

                  <Button
                    variant="primary"
                    size="sm"
                    icon={<ArrowRight size={14} />}
                    onClick={() => onNavigate('jobs', job.id)}
                  >
                    View Job / Apply
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!jobsLoading && !jobsError && latestJobs.length === 0 && (
          <Card className="empty-panel" style={{ padding: '36px', textAlign: 'center' }}>
            <Briefcase size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
            <h4 style={{ margin: '0 0 6px', color: 'var(--text-primary)' }}>No active job opportunities yet</h4>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: '14px' }}>
              Opportunities will appear as job sources synchronize canonical openings.
            </p>
            <Button variant="outline" size="sm" onClick={() => onNavigate('jobs')}>
              Explore Catalog
            </Button>
          </Card>
        )}
      </div>

      {/* 3. SECONDARY SUPPORTING SUMMARY CARDS (Progressively Populated) */}
      <div className="kpi-grid">
        {/* Profile Completion Card (Contextual encouragement, never blocking) */}
        <Card className="kpi-card" hoverable onClick={() => onNavigate('profile')}>
          <div className="kpi-icon-wrap kpi-blue">
            <User size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-val">{completeness}%</span>
            <span className="kpi-label">Profile Readiness</span>
          </div>
        </Card>

        {/* Master Resume Status */}
        <Card className="kpi-card" hoverable onClick={() => onNavigate('resumes')}>
          <div className="kpi-icon-wrap kpi-emerald">
            <FileText size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-val" style={{ fontSize: '1.15rem' }}>
              {masterResume ? 'Master Active' : 'Pending Upload'}
            </span>
            <span className="kpi-label">
              {masterResume ? `Verified Document` : 'Upload Resume'}
            </span>
          </div>
        </Card>

        {/* Active Application Pipeline */}
        <Card className="kpi-card" hoverable onClick={() => onNavigate('applications')}>
          <div className="kpi-icon-wrap kpi-indigo">
            <Send size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-val">{appStats.APPLIED}</span>
            <span className="kpi-label">Applied ({appStats.SAVED} Saved)</span>
          </div>
        </Card>

        {/* Interview Readiness */}
        <Card className="kpi-card" hoverable onClick={() => onNavigate('interview')}>
          <div className="kpi-icon-wrap kpi-amber">
            <Sparkles size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-val">{appStats.INTERVIEW + appStats.OFFER}</span>
            <span className="kpi-label">{appStats.INTERVIEW} Interview • {appStats.OFFER} Offer</span>
          </div>
        </Card>
      </div>

      {/* 4. LOWER PROGRESSION: High-Impact Skill Gaps & Interview Prep Intelligence */}
      <div className="dash-columns">
        {/* High-Impact Skill Gaps */}
        <div className="dash-col">
          <div className="section-head">
            <div>
              <h3 className="section-title">High-Impact Skill Gaps</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Target these competencies to increase match probability.
              </p>
            </div>
            <button className="link-action" onClick={() => onNavigate('career')}>
              View Career
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {skillGaps.length > 0 ? (
              skillGaps.map((gap, i) => (
                <Card key={i} style={{ padding: '16px 18px', borderLeft: '4px solid #6366f1' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {gap.name}
                    </h4>
                    <Badge variant="indigo" size="sm">
                      Unlocks {gap.count} {gap.count === 1 ? 'match' : 'matches'}
                    </Badge>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {gap.recommendation}
                  </p>
                </Card>
              ))
            ) : (
              <Card style={{ padding: '24px', textAlign: 'center' }}>
                <CheckCircle2 size={32} style={{ color: '#34d399', margin: '0 auto 8px' }} />
                <h4 style={{ margin: '0 0 4px', fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  Skills Well Aligned
                </h4>
                <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                  Your profile competencies match active job requirements in your domain.
                </p>
              </Card>
            )}
          </div>
        </div>

        {/* Supporting Modules Summary */}
        <div className="dash-col">
          <div className="section-head">
            <div>
              <h3 className="section-title">Preparation & Intelligence</h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Tools to accelerate your application journey.
              </p>
            </div>
          </div>

          <Card style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ padding: '8px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '6px', color: '#818cf8' }}>
                <GraduationCap size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Interview Preparation Intelligence
              </h4>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              Practice targeted behavioral and technical questions customized to verified job postings.
            </p>
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowRight size={14} />}
              onClick={() => onNavigate('interview')}
            >
              Start Interview Prep
            </Button>
          </Card>

          <Card style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.15)', borderRadius: '6px', color: '#34d399' }}>
                <FileText size={18} />
              </div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Resume Version Vault
              </h4>
            </div>
            <p style={{ margin: '0 0 14px', fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
              Inspect and manage immutable snapshots of your canonical Master Resume.
            </p>
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowRight size={14} />}
              onClick={() => onNavigate('resumes')}
            >
              Manage Resumes
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
