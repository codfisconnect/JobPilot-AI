import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { api } from '../api/index';
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
  AlertCircle,
  Globe,
  Search,
  UserCheck,
  Send,
  ShieldCheck
} from 'lucide-react';
import './EmployerPage.css';

interface EmployerPageProps {
  onNavigate?: (tab: string, id?: string) => void;
  activeSection?: string;
  onSelectSection?: (section: string) => void;
}

export const EmployerPage: React.FC<EmployerPageProps> = ({ activeSection, onSelectSection }) => {
  const [internalTab, setInternalTab] = useState<'jobs' | 'careers' | 'candidates' | 'team'>('jobs');
  const activeTab = (activeSection as any) || internalTab;
  const setActiveTab = (tab: 'jobs' | 'careers' | 'candidates' | 'team') => {
    if (onSelectSection) onSelectSection(tab);
    setInternalTab(tab);
  };

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [org, setOrg] = useState<EmployerOrganization | null>(null);
  const [member, setMember] = useState<EmployerMember | null>(null);
  const [metrics, setMetrics] = useState<EmployerDashboardMetrics | null>(null);
  const [jobs, setJobs] = useState<EmployerJob[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<any[]>([]);

  // Careers URL Connection State
  const [careersUrlInput, setCareersUrlInput] = useState<string>('');
  const [connectingCareers, setConnectingCareers] = useState<boolean>(false);
  const [careersConnectionResult, setCareersConnectionResult] = useState<any | null>(null);

  // Candidate Search State
  const [candidateSearchQuery, setCandidateSearchQuery] = useState<string>('');
  const [candidateSkillFilter, setCandidateSkillFilter] = useState<string>('');
  const [candidateLocationFilter, setCandidateLocationFilter] = useState<string>('');
  const [searchedCandidates, setSearchedCandidates] = useState<any[]>([]);
  const [searchingCandidates, setSearchingCandidates] = useState<boolean>(false);

  // Team Management State
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState<string>('');
  const [inviteRole, setInviteRole] = useState<string>('RECRUITER');
  const [inviteTitle, setInviteTitle] = useState<string>('');
  const [invitingMember, setInvitingMember] = useState<boolean>(false);

  // Onboarding Form State
  const [onboardingName, setOnboardingName] = useState<string>('');
  const [onboardingDomain, setOnboardingDomain] = useState<string>('');
  const [onboardingSubmitting, setOnboardingSubmitting] = useState<boolean>(false);

  // New Job Modal State
  const [showJobModal, setShowJobModal] = useState<boolean>(false);
  const [newJobTitle, setNewJobTitle] = useState<string>('');
  const [newJobDesc, setNewJobDesc] = useState<string>('');
  const [newJobLoc, setNewJobLoc] = useState<string>('Bangalore, India');
  const [newJobDept, setNewJobDept] = useState<string>('Engineering');
  const [newJobRoleCategory, setNewJobRoleCategory] = useState<string>('Software Development');
  const [newJobWorkMode, setNewJobWorkMode] = useState<string>('Hybrid');
  const [newJobExperience, setNewJobExperience] = useState<string>('2 - 5 years');
  const [newJobSalary, setNewJobSalary] = useState<string>('₹ 12,00,000 - 18,00,000 P.A.');
  const [newJobOpenings, setNewJobOpenings] = useState<string>('2');
  const [newJobSkills, setNewJobSkills] = useState<string>('Java, Selenium, Automation Testing, CI/CD');
  const [newJobScreeningQuestions, setNewJobScreeningQuestions] = useState<string>('How many years of relevant experience do you have?, What is your current notice period?');


  const loadEmployerData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getEmployerOrg();
      // Handle both unwrapped { organization, currentMember } and envelope { success, data }
      const orgData = (res as any)?.data !== undefined ? (res as any).data : res;
      if (orgData && orgData.organization) {
        setOrg(orgData.organization);
        setMember(orgData.currentMember);

        // Fetch metrics and jobs
        try {
          const [metricRes, jobsRes] = await Promise.all([
            apiClient.getEmployerDashboard(),
            apiClient.getEmployerJobs()
          ]);

          const mData = (metricRes as any)?.data !== undefined ? (metricRes as any).data : metricRes;
          const jData = (jobsRes as any)?.data !== undefined ? (jobsRes as any).data : jobsRes;
          if (mData) setMetrics(mData);
          if (Array.isArray(jData)) setJobs(jData);
        } catch (secondaryErr: any) {
          console.warn('Could not load secondary employer metrics/jobs:', secondaryErr);
        }
      } else {
        // Authenticated user with no employer organization yet
        setOrg(null);
        setMember(null);
      }
    } catch (err: any) {
      if (err.status === 403 || err.status === 404 || err.code === 'FORBIDDEN' || err.code === 'NOT_FOUND') {
        // No employer organization exists for this user -> show onboarding
        setOrg(null);
        setMember(null);
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
      // 1. Direct JobPilot Catalogue & SQLite persistence
      await api.createJob({
        role: newJobTitle,
        company: org?.name || 'ABC Technologies',
        location: newJobLoc || 'Bangalore, India',
        department: newJobDept,
        roleCategory: newJobRoleCategory,
        workMode: newJobWorkMode,
        experienceRequired: newJobExperience,
        salary: newJobSalary,
        openingsCount: Number(newJobOpenings) || 1,
        mustHaveSkills: newJobSkills.split(',').map(s => s.trim()).filter(Boolean),
        responsibilities: [newJobDesc],
        rawText: `${newJobTitle} at ${org?.name || 'Company'}\n\n${newJobDesc}`,
        screeningQuestions: newJobScreeningQuestions.split(',').map(q => q.trim()).filter(Boolean),
        applicationType: 'INTERNAL'
      });

      // 2. Also register in employer client store
      try {
        await apiClient.createEmployerJob({
          title: newJobTitle,
          description: newJobDesc,
          location: newJobLoc || 'Bangalore, India',
          requirements: newJobSkills.split(',').map(s => s.trim()).filter(Boolean),
          responsibilities: [newJobDesc]
        });
      } catch {
        // Fallback gracefully
      }

      setShowJobModal(false);
      setNewJobTitle('');
      setNewJobDesc('');
      setActionSuccess(`Job "${newJobTitle}" successfully published! Candidates can apply directly.`);
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
      const [v1Res, repoApps] = await Promise.allSettled([
        apiClient.getJobApplicants(jobId),
        api.getEmployerApplicants(org?.name || '')
      ]);

      let combined: any[] = [];
      if (repoApps.status === 'fulfilled' && Array.isArray(repoApps.value)) {
        combined = repoApps.value.map((a: any) => ({
          id: a.id,
          candidateProfile: {
            fullName: a.candidateName || 'Candidate',
            headline: `${a.candidateDesignation || 'Professional'} • ${a.candidateExperience || 3} yrs exp`,
            email: a.candidateEmail,
            phone: a.candidatePhone,
            location: a.candidateLocation
          },
          resumeVersion: {
            versionName: a.resumeId || a.tailoredResumeId || 'Tailored Resume'
          },
          screeningAnswers: a.screeningAnswers,
          appliedAt: a.createdAt,
          stage: a.status || 'SUBMITTED',
          employerNotes: a.employerNotes || '',
          reviews: [{ stage: a.status || 'SUBMITTED' }]
        }));
      }

      if (v1Res.status === 'fulfilled') {
        const appData = (v1Res.value as any)?.data !== undefined ? (v1Res.value as any).data : v1Res.value;
        if (Array.isArray(appData) && appData.length > 0) {
          combined = [...appData, ...combined];
        }
      }

      setApplicants(combined);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch applicants');
    }
  };

  const handleUpdateApplicantStage = async (applicantId: string, newStage: string) => {
    try {
      await api.updateEmployerApplicationStatus(applicantId, { status: newStage });
      setApplicants(prev => prev.map(a => a.id === applicantId ? { ...a, stage: newStage, reviews: [{ stage: newStage }] } : a));
      setActionSuccess(`Candidate application moved to ${newStage}`);
    } catch (err: any) {
      alert(err.message || 'Failed to update applicant status');
    }
  };

  const handleConnectCareers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!careersUrlInput.trim()) return;
    try {
      setConnectingCareers(true);
      setError(null);
      setActionSuccess(null);
      const res = await apiClient.connectEmployerCareersUrl(careersUrlInput.trim());
      const connData = (res as any)?.data !== undefined ? (res as any).data : res;
      setCareersConnectionResult(connData);
      setActionSuccess('Careers URL connected successfully. Jobs imported and mapped to your organization.');
      await loadEmployerData();
    } catch (err: any) {
      setError(err.message || 'Failed to connect careers URL');
    } finally {
      setConnectingCareers(false);
    }
  };

  const handleSearchCandidates = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      setSearchingCandidates(true);
      setError(null);
      const res = await apiClient.searchEmployerCandidates({
        query: candidateSearchQuery || undefined,
        skills: candidateSkillFilter || undefined,
        location: candidateLocationFilter || undefined
      });
      const candList = (res as any)?.candidates || (Array.isArray(res) ? res : (res as any)?.data || []);
      setSearchedCandidates(candList);
    } catch (err: any) {
      setError(err.message || 'Failed to search candidate talent pool');
    } finally {
      setSearchingCandidates(false);
    }
  };

  const handleLoadTeam = async () => {
    try {
      const res = await apiClient.getEmployerMembers();
      const teamData = (res as any)?.data !== undefined ? (res as any).data : res;
      if (Array.isArray(teamData)) {
        setTeamMembers(teamData);
      }
    } catch (err: any) {
      console.error('Failed to load team members:', err);
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    try {
      setInvitingMember(true);
      setError(null);
      setActionSuccess(null);
      await apiClient.inviteEmployerMember({
        email: inviteEmail.trim(),
        role: inviteRole,
        title: inviteTitle.trim() || undefined
      });
      setActionSuccess(`Invited ${inviteEmail} to team.`);
      setInviteEmail('');
      setInviteTitle('');
      await handleLoadTeam();
    } catch (err: any) {
      setError(err.message || 'Failed to invite team member');
    } finally {
      setInvitingMember(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'candidates' && searchedCandidates.length === 0) {
      handleSearchCandidates();
    }
    if (activeTab === 'team') {
      handleLoadTeam();
    }
  }, [activeTab]);

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

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
        <button
          onClick={() => setActiveTab('jobs')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'jobs' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'jobs' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Briefcase size={16} />
          <span>Job Openings ({jobs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('careers')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'careers' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'careers' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Globe size={16} />
          <span>Connect Careers Page</span>
        </button>

        <button
          onClick={() => setActiveTab('candidates')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'candidates' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'candidates' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <UserCheck size={16} />
          <span>Candidate Discovery</span>
        </button>

        <button
          onClick={() => setActiveTab('team')}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            border: 'none',
            background: activeTab === 'team' ? 'var(--accent-primary)' : 'transparent',
            color: activeTab === 'team' ? '#fff' : 'var(--text-secondary)',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={16} />
          <span>Team & Roles</span>
        </button>
      </div>

      {actionSuccess && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(34, 197, 94, 0.1)', color: '#16a34a', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* TAB 1: Organization Jobs & Applicant Pipeline */}
      {activeTab === 'jobs' && (
        <>
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
                No jobs posted yet. Connect your careers page or create your first role directly.
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
                          <span className={`status-badge status-${job.organizationJobStatus?.toLowerCase() || 'published'}`}>
                            {job.organizationJobStatus || 'PUBLISHED'}
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
                        <th>Contact & Location</th>
                        <th>Submitted Resume</th>
                        <th>Screening Answers</th>
                        <th>Recruitment Stage</th>
                        <th>Applied Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applicants.map((app) => (
                        <tr key={app.id}>
                          <td style={{ fontWeight: 600 }}>
                            <div>{app.candidateProfile.fullName}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{app.candidateProfile.headline || '—'}</div>
                          </td>
                          <td style={{ fontSize: '0.8125rem' }}>
                            <div>{app.candidateProfile.email || '—'}</div>
                            <div style={{ color: 'var(--text-muted)' }}>{app.candidateProfile.phone || app.candidateProfile.location || '—'}</div>
                          </td>
                          <td style={{ fontSize: '0.8125rem' }}>
                            <span style={{ fontWeight: 600 }}>{app.resumeVersion?.versionName || 'Master Resume'}</span>
                          </td>
                          <td style={{ fontSize: '0.75rem', maxWidth: '200px' }}>
                            {app.screeningAnswers && Object.keys(app.screeningAnswers).length > 0 ? (
                              Object.entries(app.screeningAnswers).map(([k, v], idx) => (
                                <div key={idx} style={{ marginBottom: '2px' }}>
                                  <strong>{k.slice(0, 25)}...:</strong> {String(v)}
                                </div>
                              ))
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>None required</span>
                            )}
                          </td>
                          <td>
                            <select
                              value={app.stage || app.reviews?.[0]?.stage || 'SUBMITTED'}
                              onChange={(e) => handleUpdateApplicantStage(app.id, e.target.value)}
                              style={{
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-primary)',
                                background: 'var(--bg-surface)',
                                color: 'var(--text-primary)',
                                fontSize: '0.8125rem',
                                fontWeight: 600
                              }}
                            >
                              <option value="Submitted">Submitted</option>
                              <option value="Viewed">Viewed</option>
                              <option value="Under Review">Under Review</option>
                              <option value="Shortlisted">Shortlisted</option>
                              <option value="Interview Scheduled">Interview Scheduled</option>
                              <option value="Selected">Selected</option>
                              <option value="Rejected">Rejected</option>
                            </select>
                          </td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
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
        </>
      )}

      {/* TAB 2: Connect Careers Page */}
      {activeTab === 'careers' && (
        <div className="employer-section">
          <div className="section-head-bar">
            <div>
              <h2 className="section-title">Connect Careers Page</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Pilot Mama analyzes your company careers site, discovers open roles automatically, and synchronizes jobs continuously.
              </p>
            </div>
          </div>

          <form onSubmit={handleConnectCareers} style={{ maxWidth: '640px', marginTop: '1rem' }}>
            <div className="form-field">
              <label className="form-label">Company Careers URL</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="form-input"
                  type="url"
                  required
                  placeholder="https://company.com/careers"
                  value={careersUrlInput}
                  onChange={(e) => setCareersUrlInput(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={connectingCareers}
                  className="action-btn action-primary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  {connectingCareers ? 'Analyzing & Syncing...' : 'Connect & Import'}
                </button>
              </div>
            </div>
          </form>

          {careersConnectionResult && (
            <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>
                Source Discovery Summary
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Detected Platform: <strong>{careersConnectionResult.discovery?.atsType || careersConnectionResult.discovery?.detectedType}</strong> • Strategy: <strong>{careersConnectionResult.discovery?.strategy}</strong>
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Jobs Found: <strong>{careersConnectionResult.discovery?.jobCount}</strong> • Sync Status: <strong>Complete</strong>
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Candidate Talent Discovery */}
      {activeTab === 'candidates' && (
        <div className="employer-section">
          <div className="section-head-bar">
            <div>
              <h2 className="section-title">Candidate Talent Discovery</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Search verified candidate profiles who have opted into employer discovery.
              </p>
            </div>
          </div>

          <form onSubmit={handleSearchCandidates} style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <input
              className="form-input"
              style={{ flex: 1, minWidth: '200px' }}
              placeholder="Search by role, keyword, or summary..."
              value={candidateSearchQuery}
              onChange={(e) => setCandidateSearchQuery(e.target.value)}
            />
            <input
              className="form-input"
              style={{ width: '180px' }}
              placeholder="Skills (e.g. React, Python)"
              value={candidateSkillFilter}
              onChange={(e) => setCandidateSkillFilter(e.target.value)}
            />
            <input
              className="form-input"
              style={{ width: '180px' }}
              placeholder="Location (e.g. Bengaluru)"
              value={candidateLocationFilter}
              onChange={(e) => setCandidateLocationFilter(e.target.value)}
            />
            <button
              type="submit"
              disabled={searchingCandidates}
              className="action-btn action-primary"
            >
              {searchingCandidates ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchedCandidates.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              No candidates found matching filters.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {searchedCandidates.map((c) => (
                <div
                  key={c.id}
                  style={{
                    padding: '1.25rem',
                    background: 'var(--bg-canvas)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <h4 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.25rem' }}>
                    {c.fullName}
                  </h4>
                  <div style={{ color: 'var(--accent-primary)', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                    {c.headline || 'Software Professional'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
                    {c.location || 'Remote'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {c.skills?.map((s: any, idx: number) => (
                      <span
                        key={idx}
                        style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          background: 'rgba(99, 102, 241, 0.1)',
                          color: 'var(--accent-primary)',
                          borderRadius: '4px'
                        }}
                      >
                        {s.skill?.name || s.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: Team & Roles */}
      {activeTab === 'team' && (
        <div className="employer-section">
          <div className="section-head-bar">
            <div>
              <h2 className="section-title">Team Members & Access Control</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Manage recruitment permissions across recruiters, hiring managers, and administrators.
              </p>
            </div>
          </div>

          <form onSubmit={handleInviteMember} style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem', flexWrap: 'wrap', maxWidth: '720px' }}>
            <input
              className="form-input"
              type="email"
              required
              style={{ flex: 1, minWidth: '220px' }}
              placeholder="Teammate Email..."
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
            <input
              className="form-input"
              style={{ width: '160px' }}
              placeholder="Title (e.g. Senior Recruiter)"
              value={inviteTitle}
              onChange={(e) => setInviteTitle(e.target.value)}
            />
            <select
              className="form-input"
              style={{ width: '150px' }}
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <option value="RECRUITER">Recruiter</option>
              <option value="HIRING_MANAGER">Hiring Manager</option>
              <option value="ADMIN">Admin</option>
            </select>
            <button
              type="submit"
              disabled={invitingMember}
              className="action-btn action-primary"
            >
              {invitingMember ? 'Inviting...' : 'Invite'}
            </button>
          </form>

          <table className="job-table">
            <thead>
              <tr>
                <th>Member Email</th>
                <th>Role</th>
                <th>Title</th>
                <th>Joined Date</th>
              </tr>
            </thead>
            <tbody>
              {teamMembers.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{m.user?.email}</td>
                  <td>
                    <span className="status-badge status-published">{m.role}</span>
                  </td>
                  <td>{m.title || m.role}</td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {new Date(m.joinedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {/* Create Job Modal */}
      {showJobModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem', overflowY: 'auto' }}>
          <div style={{ background: 'var(--bg-surface)', padding: '2rem', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.35rem', fontWeight: 700, marginBottom: '1.25rem' }}>
              Post a New Job Opening (Internal Job)
            </h3>
            <form onSubmit={handleCreateJob} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div className="form-field">
                <label className="form-label">Job Title / Role</label>
                <input
                  className="form-input"
                  required
                  placeholder="e.g. Senior QA Automation Engineer"
                  value={newJobTitle}
                  onChange={(e) => setNewJobTitle(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-field">
                  <label className="form-label">Department</label>
                  <input
                    className="form-input"
                    placeholder="Engineering & QA"
                    value={newJobDept}
                    onChange={(e) => setNewJobDept(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Role Category</label>
                  <input
                    className="form-input"
                    placeholder="Software Testing / QA"
                    value={newJobRoleCategory}
                    onChange={(e) => setNewJobRoleCategory(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-field">
                  <label className="form-label">Location</label>
                  <input
                    className="form-input"
                    placeholder="Bengaluru, Karnataka, India"
                    value={newJobLoc}
                    onChange={(e) => setNewJobLoc(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Work Mode</label>
                  <select
                    className="form-input"
                    value={newJobWorkMode}
                    onChange={(e) => setNewJobWorkMode(e.target.value)}
                  >
                    <option value="Hybrid">Hybrid</option>
                    <option value="Remote">Remote</option>
                    <option value="Onsite">Onsite</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-field">
                  <label className="form-label">Experience Required</label>
                  <input
                    className="form-input"
                    placeholder="3 - 6 Years"
                    value={newJobExperience}
                    onChange={(e) => setNewJobExperience(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Salary Range</label>
                  <input
                    className="form-input"
                    placeholder="₹ 14,00,000 - 22,00,000 P.A."
                    value={newJobSalary}
                    onChange={(e) => setNewJobSalary(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Openings Count</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    value={newJobOpenings}
                    onChange={(e) => setNewJobOpenings(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-field">
                <label className="form-label">Required Skills (Comma-separated)</label>
                <input
                  className="form-input"
                  placeholder="Java, Selenium, Playwright, CI/CD"
                  value={newJobSkills}
                  onChange={(e) => setNewJobSkills(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="form-label">Screening Questions (Comma-separated)</label>
                <input
                  className="form-input"
                  placeholder="How many years of test automation experience do you possess?, What is your current notice period?"
                  value={newJobScreeningQuestions}
                  onChange={(e) => setNewJobScreeningQuestions(e.target.value)}
                />
              </div>

              <div className="form-field">
                <label className="form-label">Job Description & Responsibilities</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '100px' }}
                  required
                  placeholder="Detail responsibilities, tech stack, and key qualifications..."
                  value={newJobDesc}
                  onChange={(e) => setNewJobDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
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
                  Publish Role to JobPilot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
