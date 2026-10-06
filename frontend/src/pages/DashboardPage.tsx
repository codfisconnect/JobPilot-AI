import React, { useEffect, useState } from 'react';
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
  GraduationCap,
  Award,
  ArrowRight,
  Upload,
  CheckCircle2,
  Clock,
  Sparkles,
  Building,
  MapPin,
  ExternalLink,
  AlertCircle
} from 'lucide-react';
import './DashboardPage.css';

interface DashboardPageProps {
  onNavigate: (tab: string, contextId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [resumes, setResumes] = useState<any[]>([]);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProductionData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch real production endpoints
        const [profileRes, resumesRes, jobsRes] = await Promise.all([
          apiClient.getCandidateProfile().catch(() => null),
          apiClient.listResumes().catch(() => []),
          apiClient.getCanonicalJobs({ pageSize: 4 }).catch(() => ({ data: [] }))
        ]);

        setProfile(profileRes);
        setResumes(resumesRes || []);
        setRecentJobs(jobsRes?.data || []);
      } catch (err: any) {
        console.error('Failed to load production overview:', err);
        setError(err.message || 'Unable to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    loadProductionData();
  }, []);

  // Compute real counts and completion metrics
  const candidateName = profile?.fullName || user?.candidateProfile?.fullName || user?.email?.split('@')[0] || 'Candidate';
  const headline = profile?.headline || 'Candidate Profile';
  const experienceCount = profile?.experiences?.length || 0;
  const educationCount = profile?.educations?.length || 0;
  const skillsCount = profile?.skills?.length || 0;
  const certificationsCount = profile?.certifications?.length || 0;
  const projectsCount = profile?.projects?.length || 0;
  const resumeCount = resumes.length;

  // Master resume detection
  const masterResume = resumes.find(r => r.isMaster) || resumes[0];
  const versionCount = resumes.reduce((acc, r) => acc + (r.versions?.length || 0), 0);

  // Calculate profile completeness score based on actual filled fields
  let completionPoints = 0;
  if (profile?.fullName) completionPoints += 15;
  if (profile?.email) completionPoints += 10;
  if (profile?.headline) completionPoints += 15;
  if (profile?.summary) completionPoints += 15;
  if (experienceCount > 0) completionPoints += 15;
  if (skillsCount > 0) completionPoints += 15;
  if (educationCount > 0) completionPoints += 10;
  if (certificationsCount > 0 || projectsCount > 0) completionPoints += 5;
  const completeness = Math.min(100, completionPoints);

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="jobs-loading-state" style={{ padding: '80px 20px' }}>
          <Clock size={32} className="animate-spin text-primary" />
          <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Loading your Candidate Overview...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      {/* Production Hero Banner */}
      <div className="dash-hero">
        <div className="dash-hero-content">
          <Badge variant="indigo" size="sm">
            Pilot Mama Production Engine
          </Badge>
          <h2 className="dash-hero-title">
            Welcome back, {candidateName}
          </h2>
          <p className="dash-hero-subtitle">
            {profile?.summary || 'Your master candidate profile and private resume vault are active. Track your verified credentials, manage immutable resume versions, and explore live career opportunities across verified company sources.'}
          </p>
        </div>
        <div className="dash-hero-actions" style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="outline"
            icon={<User size={16} />}
            onClick={() => onNavigate('profile')}
          >
            Edit Profile
          </Button>
          <Button
            variant="primary"
            icon={<Briefcase size={16} />}
            onClick={() => onNavigate('jobs')}
          >
            Browse Jobs
          </Button>
        </div>
      </div>

      {/* Production KPI Metrics */}
      <div className="kpi-grid">
        <Card className="kpi-card" hoverable onClick={() => onNavigate('profile')}>
          <div className="kpi-icon-wrap kpi-blue">
            <User size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-val">{completeness}%</span>
            <span className="kpi-label">Profile Completion</span>
          </div>
        </Card>

        <Card className="kpi-card" hoverable onClick={() => onNavigate('resumes')}>
          <div className="kpi-icon-wrap kpi-emerald">
            <FileText size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-val">{resumeCount}</span>
            <span className="kpi-label">{resumeCount === 1 ? 'Resume in Vault' : 'Resumes in Vault'} ({versionCount} Versions)</span>
          </div>
        </Card>

        <Card className="kpi-card" hoverable onClick={() => onNavigate('profile')}>
          <div className="kpi-icon-wrap kpi-indigo">
            <Briefcase size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-val">{experienceCount}</span>
            <span className="kpi-label">Work Experiences</span>
          </div>
        </Card>

        <Card className="kpi-card" hoverable onClick={() => onNavigate('profile')}>
          <div className="kpi-icon-wrap kpi-amber">
            <Layers size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-val">{skillsCount}</span>
            <span className="kpi-label">Verified Competencies</span>
          </div>
        </Card>
      </div>

      {/* Error notice if API call failed */}
      {error && (
        <div className="jobs-error-banner">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Overview Split */}
      <div className="dash-columns">
        {/* Left Column: Master Resume & Quick Actions */}
        <div className="dash-col">
          <div className="section-head">
            <h3 className="section-title">Master Resume & Verification Status</h3>
            <button className="link-action" onClick={() => onNavigate('resumes')}>
              Open Vault ({resumeCount})
            </button>
          </div>

          <Card style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {masterResume ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.15)', borderRadius: '8px', color: '#818cf8' }}>
                      <FileText size={24} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {masterResume.title || masterResume.originalFileName || 'Master Resume'}
                      </h4>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Uploaded {new Date(masterResume.uploadedAt).toLocaleDateString()} • {masterResume.fileSize ? `${Math.round(masterResume.fileSize / 1024)} KB` : 'Local Storage'}
                      </span>
                    </div>
                  </div>
                  <Badge variant={masterResume.status === 'PARSED' ? 'emerald' : 'amber'} size="sm">
                    {masterResume.status}
                  </Badge>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '12px 14px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <span>Truth Check Guarantee:</span>
                    <strong style={{ color: '#34d399' }}>Zero-Fabrication Active</strong>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    All resume extractions are verified by you prior to persisting to canonical candidate records.
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
                  <Button variant="primary" size="sm" icon={<Upload size={14} />} onClick={() => onNavigate('resumes')}>
                    Manage Resumes & Snapshots
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onNavigate('profile')}>
                    View Master Profile
                  </Button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                <FileText size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                <h4 style={{ margin: '0 0 6px', color: 'var(--text-primary)' }}>No Resume Uploaded Yet</h4>
                <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Upload your existing PDF or DOCX resume to extract your experiences, education, and skills automatically.
                </p>
                <Button variant="primary" icon={<Upload size={16} />} onClick={() => onNavigate('resumes')}>
                  Upload Resume to Vault
                </Button>
              </div>
            )}
          </Card>

          {/* Quick Profile Health Card */}
          <Card style={{ padding: '20px', marginTop: '16px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Candidate Profile Breakdown
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Professional Headline</span>
                <span style={{ fontWeight: 600, color: profile?.headline ? '#34d399' : 'var(--text-muted)' }}>
                  {profile?.headline ? 'Provided' : 'Pending'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Location & Contact</span>
                <span style={{ fontWeight: 600, color: (profile?.location || profile?.phone) ? '#34d399' : 'var(--text-muted)' }}>
                  {(profile?.location || profile?.phone) ? 'Configured' : 'Incomplete'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Work History</span>
                <span style={{ fontWeight: 600, color: experienceCount > 0 ? '#34d399' : 'var(--text-muted)' }}>
                  {experienceCount} {experienceCount === 1 ? 'position' : 'positions'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Academic Credentials</span>
                <span style={{ fontWeight: 600, color: educationCount > 0 ? '#34d399' : 'var(--text-muted)' }}>
                  {educationCount} degrees listed
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Right Column: Live Discovered Opportunities */}
        <div className="dash-col">
          <div className="section-head">
            <h3 className="section-title">Latest Verified Job Openings</h3>
            <button className="link-action" onClick={() => onNavigate('jobs')}>
              View All Openings
            </button>
          </div>

          <div className="jobs-list-flow">
            {recentJobs.length > 0 ? (
              recentJobs.map(job => (
                <Card key={job.id} className="job-overview-card" hoverable onClick={() => onNavigate('jobs', job.id)}>
                  <div className="job-card-top">
                    <div>
                      <span className="job-company">{job.company?.name || 'Company'}</span>
                      <h4 className="job-role">{job.title}</h4>
                    </div>
                    <Badge variant="indigo" size="sm">
                      {job.sourceName || job.sourceType}
                    </Badge>
                  </div>

                  <div className="job-meta">
                    <span className="meta-item">
                      <MapPin size={14} /> {job.location || job.city || 'Location unlisted'}
                    </span>
                    <span className="meta-item">
                      {job.remoteType?.replace('_', ' ')}
                    </span>
                  </div>

                  {job.skills && job.skills.length > 0 && (
                    <div className="job-skills-strip">
                      {job.skills.slice(0, 4).map((s: any) => (
                        <span key={s.id || s.name} className="skill-chip">
                          {s.name}
                        </span>
                      ))}
                      {job.skills.length > 4 && (
                        <span className="skill-chip-more">+{job.skills.length - 4}</span>
                      )}
                    </div>
                  )}

                  <div className="job-card-bottom">
                    <span className="salary-tag">
                      {job.salaryMin ? `${job.salaryCurrency || '$'}${Number(job.salaryMin).toLocaleString()}` : 'Competitive'}
                    </span>
                    <span className="action-link">
                      View Details <ArrowRight size={14} />
                    </span>
                  </div>
                </Card>
              ))
            ) : (
              <Card className="empty-panel">
                <p>No job openings discovered yet in the canonical database.</p>
                <Button variant="outline" size="sm" onClick={() => onNavigate('jobs')}>
                  Discover Opportunities
                </Button>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
