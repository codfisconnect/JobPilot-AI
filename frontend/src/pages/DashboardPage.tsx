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
  Sparkles
} from 'lucide-react';
import { api } from "../api/index";
import { JobDescription, ApplicationRecord } from "../types/index";
import './DashboardPage.css';

interface DashboardPageProps {
  onNavigate: (tab: string, contextId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { activeCandidate } = useApp();
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [jobsList, appsList] = await Promise.all([
          api.getJobs(),
          api.getApplications(activeCandidate?.id)
        ]);
        setJobs(jobsList);
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
  const appliedCount = applications.filter(a => a.status === 'Applied').length;
  const interviewCount = applications.filter(a => a.status === 'Interview').length;
  const strongMatchesCount = jobs.filter(j => {
    // Check if any matching skill overlap
    const skills = activeCandidate?.primarySkills || [];
    return j.mustHaveSkills.some(s => skills.includes(s));
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
            JobPilot has synchronized your master profile. Review top role alignments, generate tailored ATS-optimized resumes, and prep for upcoming technical interviews.
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
            <span className="kpi-label">Jobs Analyzed</span>
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
            <span className="kpi-label">Tracked Applications</span>
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
