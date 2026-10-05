import React, { useEffect, useState } from 'react';
import { useApp } from "../context/AppContext";
import { Card } from "../components/common/Card";
import { Badge } from "../components/common/Badge";
import { Button } from "../components/common/Button";
import { ProgressBar } from "../components/common/ProgressBar";
import {
  Briefcase,
  CheckCircle2,
  Send,
  Headphones,
  ArrowRight,
  TrendingUp,
  MapPin,
  ExternalLink,
  Sparkles,
  Activity,
  BookOpen
} from 'lucide-react';
import { api } from "../api/index";
import { JobDescription, ApplicationRecord, SourceHealthStatus } from "../types/index";
import './DashboardPage.css';

interface DashboardPageProps {
  onNavigate: (tab: string, contextId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { activeCandidate } = useApp();
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [sourceHealth, setSourceHealth] = useState<SourceHealthStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [jobsList, appsList, healthList] = await Promise.all([
          api.getJobs(),
          api.getApplications(activeCandidate?.id),
          api.getSourceHealth().catch(() => [])
        ]);
        setSourceHealth(healthList || []);

        // Priority 11: Sort recommendations by candidate relevance/score
        const scoredJobs = jobsList.map(job => {
          let score = 0;
          if (activeCandidate) {
            const candSkills = new Set(
              [...activeCandidate.primarySkills, ...activeCandidate.secondarySkills, ...activeCandidate.technologies].map(s => s.toLowerCase())
            );
            const matchedSkills = job.mustHaveSkills.filter(s => candSkills.has(s.toLowerCase())).length;
            const skillScore = (matchedSkills / Math.max(1, job.mustHaveSkills.length)) * 40;

            // Career track alignment
            const candTrack = (activeCandidate.targetRoles[0] || '').toLowerCase();
            const jobTrack = (job.careerTrack || job.role).toLowerCase();
            let trackScore = 20;
            if (
              (candTrack.includes('project') || candTrack.includes('delivery') || candTrack.includes('agile')) &&
              (jobTrack.includes('project') || jobTrack.includes('delivery') || jobTrack.includes('agile') || jobTrack.includes('scrum'))
            ) {
              trackScore = 30;
            } else if (
              (candTrack.includes('qa') || candTrack.includes('test') || candTrack.includes('automation')) &&
              (jobTrack.includes('qa') || jobTrack.includes('test') || jobTrack.includes('automation'))
            ) {
              trackScore = 30;
            } else if (
              candTrack.includes('backend') && (jobTrack.includes('backend') || jobTrack.includes('java'))
            ) {
              trackScore = 30;
            }

            // Experience compatibility
            const expMatch = job.experienceRequired.match(/(\d+)/);
            const reqExp = expMatch ? parseInt(expMatch[1], 10) : 3;
            let expScore = 15;
            if (activeCandidate.yearsOfExperience >= reqExp) {
              expScore = 20;
            } else if (reqExp - activeCandidate.yearsOfExperience <= 2) {
              expScore = 12;
            } else {
              expScore = 5;
            }

            // Location compatibility
            let locScore = 5;
            const candLoc = activeCandidate.location.toLowerCase();
            const jobLoc = job.location.toLowerCase();
            if (jobLoc.includes('remote') || activeCandidate.workPreference === 'Remote' || jobLoc.includes(candLoc)) {
              locScore = 10;
            }

            score = Math.round(skillScore + trackScore + expScore + locScore);
          }
          return { job, relevanceScore: score };
        });

        scoredJobs.sort((a, b) => b.relevanceScore - a.relevanceScore);
        setJobs(scoredJobs.map(sj => sj.job));
        setApplications(appsList);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [activeCandidate]);

  // Derived stats
  const totalAnalyzed = jobs.length;
  const demoSubmittedCount = applications.filter(a => a.status === 'APPLIED_DEMO').length;
  const externalStartedCount = applications.filter(a => a.status === 'APPLICATION_STARTED').length;
  const totalAppliedCount = applications.filter(a => a.status === 'APPLIED' || a.status === 'APPLIED_DEMO').length;
  const interviewCount = applications.filter(a => a.status === 'INTERVIEW' || a.status === 'Interview').length;
  const strongMatchesCount = jobs.filter(j => {
    const skills = (activeCandidate?.primarySkills || []).map(s => s.toLowerCase());
    return j.mustHaveSkills.some(s => skills.includes(s.toLowerCase()));
  }).length;

  return (
    <div className="dashboard-page">
      {/* Welcome Banner */}
      <div className="dash-hero">
        <div className="dash-hero-content">
          <Badge variant="indigo" size="sm">
            AI Job Copilot Active
          </Badge>
          <h2 className="dash-hero-title">
            Welcome back, {activeCandidate?.name || 'Candidate'}
          </h2>
          <p className="dash-hero-subtitle">
            Pilot Mama has synchronized your master profile. Review top role alignments, generate tailored ATS-optimized resumes, and prep for upcoming technical interviews.
          </p>
        </div>
        <div className="dash-hero-actions">
          <Button
            variant="primary"
            icon={<Sparkles size={16} />}
            onClick={() => onNavigate('jobs')}
          >
            Analyze New Job
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="kpi-grid">
        <Card className="kpi-card">
          <div className="kpi-icon-wrap kpi-blue">
            <Briefcase size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-val">{totalAnalyzed}</span>
            <span className="kpi-label">Jobs Discovered</span>
          </div>
        </Card>

        <Card className="kpi-card">
          <div className="kpi-icon-wrap kpi-emerald">
            <TrendingUp size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-val">{strongMatchesCount}</span>
            <span className="kpi-label">Strong Matches</span>
          </div>
        </Card>

        <Card className="kpi-card">
          <div className="kpi-icon-wrap kpi-indigo">
            <Send size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-val">{applications.length}</span>
            <span className="kpi-label">Tracked Applications ({demoSubmittedCount} Demo, {externalStartedCount} Ext)</span>
          </div>
        </Card>

        <Card className="kpi-card">
          <div className="kpi-icon-wrap kpi-amber">
            <Headphones size={22} />
          </div>
          <div className="kpi-data">
            <span className="kpi-val">{interviewCount}</span>
            <span className="kpi-label">Active Interviews</span>
          </div>
        </Card>
      </div>

      {/* Live Ingestion & Source Health Status Bar */}
      <Card className="source-health-banner">
        <div className="health-banner-header">
          <div className="health-banner-title">
            <Activity size={18} className="health-icon-pulse" />
            <span className="health-title-text">Live Ingestion & Job Connector Health</span>
          </div>
          <div className="health-actions">
            <Button variant="ghost" size="sm" icon={<BookOpen size={14} />} onClick={() => onNavigate('learning')}>
              Skill Gap & Learning Academy
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('settings')}>
              Manage Sources
            </Button>
          </div>
        </div>
        <div className="connector-chips-grid">
          {sourceHealth.length > 0 ? (
            sourceHealth.map((src) => (
              <div key={src.sourceKey} className="connector-status-chip">
                <span className={`status-dot dot-${src.status.toLowerCase()}`} />
                <span className="source-name">{src.name}</span>
                <span className="source-jobs-count">({src.jobsDiscovered} jobs)</span>
                <Badge variant={src.status === 'HEALTHY' ? 'emerald' : src.status === 'WARNING' ? 'amber' : 'rose'} size="sm">
                  {src.status}
                </Badge>
              </div>
            ))
          ) : (
            <div className="connector-fallback-status">
              <span className="status-dot dot-healthy" />
              <span>Connectors active: Codewalla, Lever, Ashby, Greenhouse (Ingestion Ready)</span>
            </div>
          )}
        </div>
      </Card>

      {/* Two Column Layout: Recommended Jobs & Recent Applications */}
      <div className="dash-columns">
        {/* Recommended Jobs */}
        <div className="dash-col">
          <div className="section-head">
            <h3 className="section-title">Recommended High-Match Opportunities</h3>
            <button className="link-action" onClick={() => onNavigate('jobs')}>
              View All ({jobs.length})
            </button>
          </div>

          <div className="jobs-list-flow">
            {jobs.slice(0, 4).map(job => (
              <Card key={job.id} className="job-overview-card" hoverable onClick={() => onNavigate('jobs', job.id)}>
                <div className="job-card-top">
                  <div>
                    <span className="job-company">{job.company}</span>
                    <h4 className="job-role">{job.role}</h4>
                  </div>
                  <Badge variant="emerald" size="sm">
                    {job.careerTrack}
                  </Badge>
                </div>

                <div className="job-meta">
                  <span className="meta-item">
                    <MapPin size={14} /> {job.location}
                  </span>
                  <span className="meta-item">
                    Exp: {job.experienceRequired}
                  </span>
                </div>

                <div className="job-skills-strip">
                  {job.mustHaveSkills.slice(0, 4).map(skill => (
                    <span key={skill} className="skill-chip">
                      {skill}
                    </span>
                  ))}
                  {job.mustHaveSkills.length > 4 && (
                    <span className="skill-chip-more">+{job.mustHaveSkills.length - 4}</span>
                  )}
                </div>

                <div className="job-card-bottom">
                  <span className="salary-tag">{job.salary || 'Competitive'}</span>
                  <span className="action-link">
                    Evaluate & Match <ArrowRight size={14} />
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Recent Applications Timeline */}
        <div className="dash-col">
          <div className="section-head">
            <h3 className="section-title">Application Status Tracker</h3>
            <button className="link-action" onClick={() => onNavigate('applications')}>
              View Applications ({applications.length})
            </button>
          </div>

          {applications.length === 0 ? (
            <Card className="empty-panel">
              <p>No applications logged yet for this candidate.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onNavigate('jobs')}
              >
                Explore & Apply
              </Button>
            </Card>
          ) : (
            <div className="applications-flow">
              {applications.slice(0, 4).map(app => (
                <Card key={app.id} className="app-history-card" hoverable onClick={() => onNavigate('applications', app.id)}>
                  <div className="app-history-header">
                    <div>
                      <h4 className="app-role">{app.role}</h4>
                      <span className="app-company">{app.company}</span>
                    </div>
                    <Badge
                      variant={
                        app.status === 'Interview'
                          ? 'emerald'
                          : app.status === 'Applied'
                          ? 'blue'
                          : 'amber'
                      }
                      size="sm"
                    >
                      {app.status}
                    </Badge>
                  </div>

                  <div className="app-sub-info">
                    <span>Applied: {app.applicationDate}</span>
                    {app.resumeVersionName && (
                      <span className="resume-version-badge">
                        Resume: {app.resumeVersionName}
                      </span>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
