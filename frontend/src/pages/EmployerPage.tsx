import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import type {
  EmployerOrganization,
  EmployerMember,
  EmployerDashboardMetrics,
  EmployerJob,
  EmployerApplicant
} from '../types/employer';
import {
  Briefcase,
  Users,
  CheckCircle,
  Clock,
  PlusCircle,
  Building,
  AlertCircle
} from 'lucide-react';
import './EmployerPage.css';

interface EmployerPageProps {
  onNavigate?: (tab: string, id?: string) => void;
}

export const EmployerPage: React.FC<EmployerPageProps> = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [org, setOrg] = useState<EmployerOrganization | null>(null);
  const [member, setMember] = useState<EmployerMember | null>(null);
  const [metrics, setMetrics] = useState<EmployerDashboardMetrics | null>(null);
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<EmployerApplicant[]>([]);

  // Onboarding Form State
  const [onboardingName, setOnboardingName] = useState<string>('');
  const [onboardingDomain, setOnboardingDomain] = useState<string>('');
  const [onboardingSubmitting, setOnboardingSubmitting] = useState<boolean>(false);

  // New Job Modal State
  const [showJobModal, setShowJobModal] = useState<boolean>(false);
  const [newJobTitle, setNewJobTitle] = useState<string>('');
  const [newJobDesc, setNewJobDesc] = useState<string>('');
  const [newJobLoc, setNewJobLoc] = useState<string>('');

  const loadEmployerData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getEmployerOrg();
      if (res.success && res.data) {
        setOrg(res.data.organization);
        setMember(res.data.currentMember);

        // Fetch metrics and jobs
        const [metricRes, jobsRes] = await Promise.all([
          apiClient.getEmployerDashboard(),
          apiClient.getEmployerJobs()
        ]);

        if (metricRes.success) setMetrics(metricRes.data);
        if (jobsRes.success) setJobs(jobsRes.data);
      }
    } catch (err: any) {
      if (err.status === 403 || err.status === 404) {
        setOrg(null);
      } else {
        setError(err.message || 'Failed to load employer workspace');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEmployerData();
  }, []);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setOnboardingSubmitting(true);
      setError(null);
      await apiClient.createEmployerOrg({
        name: onboardingName,
        domain: onboardingDomain || undefined
      });
      await loadEmployerData();
    } catch (err: any) {
      setError(err.message || 'Failed to register employer organization');
    } finally {
      setOnboardingSubmitting(false);
    }
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.createEmployerJob({
        title: newJobTitle,
        description: newJobDesc,
        location: newJobLoc || 'Remote',
        requirements: ['Relevant experience'],
        responsibilities: ['Core product delivery']
      });
      setShowJobModal(false);
      setNewJobTitle('');
      setNewJobDesc('');
      setNewJobLoc('');
      await loadEmployerData();
    } catch (err: any) {
      alert(err.message || 'Failed to create job');
    }
  };

  const handleJobLifecycle = async (jobId: string, action: 'publish' | 'pause' | 'close') => {
    try {
      await apiClient.updateEmployerJobStatus(jobId, action);
      await loadEmployerData();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const handleViewApplicants = async (jobId: string) => {
    try {
      setSelectedJobId(jobId);
      const res = await apiClient.getJobApplicants(jobId);
      if (res.success) {
        setApplicants(res.data);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to fetch applicants');
    }
  };

  if (loading) {
    return (
      <div className="employer-page">
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <div className="spinner" />
          <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
            Loading employer workspace...
          </p>
        </div>
      </div>
    );
  }

  // Not on-boarded yet
  if (!org) {
    return (
      <div className="employer-page">
        <div className="onboarding-box">
          <Building size={48} color="var(--accent-primary)" style={{ margin: '0 auto 1.5rem' }} />
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.75rem' }}>
            Register Employer Organization
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
            Set up your organization tenant to post jobs, manage recruitment pipelines, and review verified candidate applications.
          </p>

          {error && (
            <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleCreateOrg}>
            <div className="form-field">
              <label className="form-label">Company / Organization Name</label>
              <input
                className="form-input"
                type="text"
                required
                placeholder="e.g. Acme Corporation"
                value={onboardingName}
                onChange={(e) => setOnboardingName(e.target.value)}
              />
            </div>
            <div className="form-field">
              <label className="form-label">Official Domain (Optional)</label>
              <input
                className="form-input"
                type="text"
                placeholder="e.g. acmeworks.com"
                value={onboardingDomain}
                onChange={(e) => setOnboardingDomain(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={onboardingSubmitting}
              className="action-btn action-primary"
              style={{ width: '100%', padding: '0.875rem', marginTop: '1rem' }}
            >
              {onboardingSubmitting ? 'Registering...' : 'Complete Organization Setup'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="employer-page">
      <div className="employer-header">
        <h1 className="employer-title">
          <Building size={28} />
          {org.name} Workspace
        </h1>
        <p className="employer-subtitle">
          Recruitment Portal • Member Role: <strong>{member?.role}</strong>
        </p>
      </div>

      {metrics && (
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-icon-wrap">
              <Briefcase size={24} />
            </div>
            <div>
              <div className="metric-val">{metrics.jobs.active}</div>
              <div className="metric-label">Active Job Openings</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon-wrap">
              <Users size={24} />
            </div>
            <div>
              <div className="metric-val">{metrics.applicants.total}</div>
              <div className="metric-label">Total Applicants</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon-wrap">
              <Clock size={24} />
            </div>
            <div>
              <div className="metric-val">{metrics.jobs.draft}</div>
              <div className="metric-label">Draft Roles</div>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-icon-wrap">
              <CheckCircle size={24} />
            </div>
            <div>
              <div className="metric-val">{metrics.applicants.new}</div>
              <div className="metric-label">New Submissions</div>
            </div>
          </div>
        </div>
      )}

      {/* Organization Jobs */}
      <div className="employer-section">
        <div className="section-head-bar">
          <h2 className="section-title">Job Openings ({jobs.length})</h2>
          <button
            onClick={() => setShowJobModal(true)}
            className="action-btn action-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <PlusCircle size={16} />
            Create Role
          </button>
        </div>

        {jobs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No jobs posted yet. Create your first role to start accepting candidates.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="job-table">
              <thead>
                <tr>
                  <th>Job Title</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Applicants</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td style={{ fontWeight: 600 }}>{job.title}</td>
                    <td>{job.location || 'Remote'}</td>
                    <td>
                      <span className={`status-badge status-${job.organizationJobStatus.toLowerCase()}`}>
                        {job.organizationJobStatus}
                      </span>
                    </td>
                    <td>{job.applicantCount || 0}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleViewApplicants(job.id)}
                          className="action-btn action-outline"
                        >
                          View Pipeline
                        </button>
                        {job.organizationJobStatus === 'DRAFT' && (
                          <button
                            onClick={() => handleJobLifecycle(job.id, 'publish')}
                            className="action-btn action-primary"
                          >
                            Publish
                          </button>
                        )}
                        {job.organizationJobStatus === 'PUBLISHED' && (
                          <button
                            onClick={() => handleJobLifecycle(job.id, 'pause')}
                            className="action-btn action-outline"
                          >
                            Pause
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Applicant Detail View */}
      {selectedJobId && (
        <div className="employer-section">
          <div className="section-head-bar">
            <h2 className="section-title">
              Candidate Pipeline ({applicants.length} Applicants)
            </h2>
            <button
              onClick={() => setSelectedJobId(null)}
              className="action-btn action-outline"
            >
              Close Pipeline
            </button>
          </div>

          {applicants.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
              No applications received for this job posting yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="job-table">
                <thead>
                  <tr>
                    <th>Candidate</th>
                    <th>Headline</th>
                    <th>Submitted Resume</th>
                    <th>Stage</th>
                    <th>Applied Date</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.map((app) => (
                    <tr key={app.id}>
                      <td style={{ fontWeight: 600 }}>
                        {app.candidateProfile.fullName}
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        {app.candidateProfile.headline || '—'}
                      </td>
                      <td>
                        {app.resumeVersion?.versionName || 'Standard Version'}
                      </td>
                      <td>
                        <span className="status-badge status-published">
                          {app.reviews?.[0]?.stage || 'NEW'}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>
                        {app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : 'Recent'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Job Modal */}
      {showJobModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '550px' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1.25rem' }}>
              Create Job Opening
            </h3>
            <form onSubmit={handleCreateJob}>
              <div className="form-field">
                <label className="form-label">Job Title</label>
                <input
                  className="form-input"
                  required
                  placeholder="e.g. Lead Machine Learning Engineer"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Location / Work Arrangement</label>
                <input
                  className="form-input"
                  placeholder="e.g. Bengaluru, India (Hybrid)"
                  value={newJobLoc}
                  onChange={(e) => setNewJobLoc(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label className="form-label">Job Description</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '120px' }}
                  required
                  placeholder="Detail responsibilities and technical expectations..."
                  value={newJobDesc}
                  onChange={(e) => setNewJobDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowJobModal(false)}
                  className="action-btn action-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="action-btn action-primary"
                >
                  Save Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
