import React, { useState, useEffect } from 'react';
import { useApp } from "../context/AppContext";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import { ApplicationModeBadge } from "../components/common/ApplicationModeBadge";
import { api } from "../api/index";
import { ApplicationRecord, ApplicationStatus } from "../types/index";
import {
  Send,
  Calendar,
  Building2,
  MapPin,
  ExternalLink,
  FileText,
  Clock,
  CheckCircle2,
  Headphones,
  Edit3,
  Search,
  Filter,
  Download,
  Sparkles,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import './ApplicationsPage.css';

interface ApplicationsPageProps {
  onNavigate: (tab: string, contextId?: string) => void;
  preselectedAppId?: string;
}

export const ApplicationsPage: React.FC<ApplicationsPageProps> = ({
  onNavigate,
  preselectedAppId
}) => {
  const { activeCandidate, showToast } = useApp();
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [selectedApp, setSelectedApp] = useState<ApplicationRecord | null>(null);
  const [fullDetails, setFullDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'All' | 'demo' | 'external'>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'latest' | 'oldest' | 'highest_match' | 'highest_ats'>('latest');

  // Status edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ApplicationStatus>('APPLIED_DEMO');
  const [notes, setNotes] = useState('');

  const fetchApps = async () => {
    try {
      setLoading(true);
      const list = await api.getApplications(activeCandidate?.id);
      setApplications(list);
      if (preselectedAppId) {
        const found = list.find(a => a.id === preselectedAppId);
        if (found) loadAppDetails(found);
        else if (list.length > 0) loadAppDetails(list[0]);
      } else if (list.length > 0) {
        loadAppDetails(list[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, [activeCandidate, preselectedAppId]);

  const loadAppDetails = async (app: ApplicationRecord) => {
    setSelectedApp(app);
    try {
      const details = await api.getApplicationDetails(app.id);
      setFullDetails(details);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedApp) return;
    try {
      const updated = await api.saveApplication({
        ...selectedApp,
        status: newStatus,
        notes
      });
      await fetchApps();
      loadAppDetails(updated);
      setIsEditModalOpen(false);
      showToast('Application status updated successfully!');
    } catch (err: any) {
      alert(`Error updating status: ${err.message}`);
    }
  };

  const handleDownloadSubmittedResume = async () => {
    if (!selectedApp) return;
    try {
      if (selectedApp.resumeVersionId) {
        const doc = await api.exportResume(selectedApp.resumeVersionId, 'txt');
        const blob = new Blob([doc.content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.filename || `${selectedApp.resumeVersionName || 'Submitted_Resume'}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Submitted resume downloaded!');
      } else {
        // Fallback export master profile
        showToast('Downloading master profile record...');
      }
    } catch (err: any) {
      alert(`Failed to download resume: ${err.message}`);
    }
  };

  const handleConfirmExternalApplied = async () => {
    if (!selectedApp) return;
    try {
      const now = new Date().toISOString();
      const updated = await api.saveApplication({
        ...selectedApp,
        status: 'APPLIED',
        notes: `${selectedApp.notes || ''} [Candidate confirmed external application completion]`,
        timeline: [
          ...(selectedApp.timeline || []),
          { timestamp: now, stage: 'Candidate Confirmed External Submission', description: 'Application marked as submitted.' }
        ]
      });
      await fetchApps();
      loadAppDetails(updated);
      showToast('Application marked as Confirmed APPLIED!');
    } catch (err: any) {
      alert(`Error updating: ${err.message}`);
    }
  };

  const statusesList: ApplicationStatus[] = [
    'READY_TO_APPLY',
    'APPLICATION_STARTED',
    'APPLIED_DEMO',
    'APPLIED',
    'WAITING_FOR_RESPONSE',
    'INTERVIEW',
    'SELECTED',
    'REJECTED',
    'FAILED'
  ];

  // Filtering and Sorting
  const filteredApps = applications.filter(app => {
    const matchesSearch =
      app.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.location.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesMode =
      filterMode === 'All' ? true : app.applicationMode === filterMode;

    const matchesStatus =
      filterStatus === 'All' ? true : app.status === filterStatus;

    return matchesSearch && matchesMode && matchesStatus;
  });

  filteredApps.sort((a, b) => {
    if (sortBy === 'latest') return new Date(b.createdAt || b.applicationDate).getTime() - new Date(a.createdAt || a.applicationDate).getTime();
    if (sortBy === 'oldest') return new Date(a.createdAt || a.applicationDate).getTime() - new Date(b.createdAt || b.applicationDate).getTime();
    if (sortBy === 'highest_match') return (b.matchScore || 0) - (a.matchScore || 0);
    if (sortBy === 'highest_ats') return (b.atsScore || 0) - (a.atsScore || 0);
    return 0;
  });

  const getStatusBadgeVariant = (status: ApplicationStatus) => {
    switch (status) {
      case 'APPLIED_DEMO':
      case 'APPLIED':
        return 'emerald';
      case 'INTERVIEW':
      case 'SELECTED':
        return 'emerald';
      case 'APPLICATION_STARTED':
      case 'READY_TO_APPLY':
        return 'indigo';
      case 'WAITING_FOR_RESPONSE':
        return 'blue';
      case 'REJECTED':
      case 'FAILED':
        return 'rose';
      default:
        return 'amber';
    }
  };

  return (
    <div className="applications-page">
      <div className="apps-header">
        <div>
          <h2 className="apps-title">Job Application Pipeline Tracker</h2>
          <p className="apps-sub">
            Track submitted demo and external career applications with exact resume versions, ATS history, and audit logs.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="apps-toolbar-card">
        <div className="apps-search-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by company, role, or location..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="apps-search-input"
          />
        </div>

        <div className="apps-filter-group">
          <div className="filter-pill-wrap">
            <span className="filter-lbl">Mode:</span>
            {(['All', 'demo', 'external'] as const).map(mode => (
              <button
                key={mode}
                className={`filter-pill ${filterMode === mode ? 'active' : ''}`}
                onClick={() => setFilterMode(mode)}
              >
                {mode === 'demo' ? 'Demo' : mode === 'external' ? 'External' : 'All Modes'}
              </button>
            ))}
          </div>

          <div className="filter-pill-wrap">
            <span className="filter-lbl">Status:</span>
            <select
              className="filter-select"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="All">All Statuses</option>
              {statusesList.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="filter-pill-wrap">
            <span className="filter-lbl">Sort:</span>
            <select
              className="filter-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
            >
              <option value="latest">Latest</option>
              <option value="oldest">Oldest</option>
              <option value="highest_match">Highest Match Score</option>
              <option value="highest_ats">Highest ATS Score</option>
            </select>
          </div>
        </div>
      </div>

      {applications.length === 0 ? (
        <Card className="empty-apps-card">
          <Send size={40} className="empty-icon" />
          <h3>No applications tracked yet.</h3>
          <p>Analyze any job post to create tailored resumes and continue through the Apply flow.</p>
          <Button variant="primary" onClick={() => onNavigate('jobs')}>
            Analyze Jobs
          </Button>
        </Card>
      ) : (
        <div className="apps-grid">
          {/* Applications Cards List */}
          <div className="apps-cards-list">
            {filteredApps.length === 0 ? (
              <Card className="no-matches-card">
                <p>No applications match your current filters.</p>
              </Card>
            ) : (
              filteredApps.map(app => (
                <Card
                  key={app.id}
                  className={`app-item-card ${selectedApp?.id === app.id ? 'app-card-active' : ''}`}
                  hoverable
                  onClick={() => loadAppDetails(app)}
                >
                  <div className="app-card-top-row">
                    <span className="app-comp-name">{app.company}</span>
                    <ApplicationModeBadge
                      mode={app.applicationMode}
                      isCodewalla={app.company.toLowerCase().includes('codewalla')}
                      size="sm"
                    />
                  </div>

                  <h4 className="app-card-role">{app.role}</h4>

                  <div className="app-card-meta">
                    <span className="meta-match">Match: {app.matchScore}%</span>
                    <span className="meta-ats">ATS: {app.atsScore || 85}%</span>
                    <Badge variant={getStatusBadgeVariant(app.status)} size="sm">
                      {app.status}
                    </Badge>
                  </div>

                  <div className="app-card-bottom-row">
                    <span className="app-card-resume-tag">
                      {app.resumeVersionName || 'Master Profile'}
                    </span>
                    <span className="app-card-date">
                      {app.applicationDate || 'Recent'}
                    </span>
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Details & Exact History Pane */}
          {selectedApp && (
            <div className="app-detail-pane">
              <Card className="app-detail-card">
                <div className="detail-head-row">
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                      <span className="detail-comp-tag">{selectedApp.company}</span>
                      <ApplicationModeBadge
                        mode={selectedApp.applicationMode}
                        isCodewalla={selectedApp.company.toLowerCase().includes('codewalla')}
                        size="sm"
                      />
                      <Badge variant={getStatusBadgeVariant(selectedApp.status)} size="sm">
                        {selectedApp.status}
                      </Badge>
                    </div>
                    <h3 className="detail-role-title">{selectedApp.role}</h3>
                    <div className="detail-sub-meta">
                      <span><MapPin size={13} /> {selectedApp.location}</span>
                      <span><Calendar size={13} /> Applied: {selectedApp.applicationDate}</span>
                      <span>Match: <strong>{selectedApp.matchScore}%</strong></span>
                      <span>ATS: <strong>{selectedApp.atsScore || 85}%</strong></span>
                    </div>
                  </div>

                  <div className="detail-actions">
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<Edit3 size={14} />}
                      onClick={() => {
                        setNewStatus(selectedApp.status);
                        setNotes(selectedApp.notes || '');
                        setIsEditModalOpen(true);
                      }}
                    >
                      Update Status
                    </Button>
                  </div>
                </div>

                {/* External Status Confirmation Safeguard */}
                {selectedApp.applicationMode === 'external' && selectedApp.status === 'APPLICATION_STARTED' && (
                  <div className="external-safeguard-banner">
                    <Sparkles size={18} className="text-indigo" />
                    <div>
                      <strong>External Submission Confirmation:</strong> Application was started externally. Please confirm when you complete submitting on the employer portal.
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<Check size={14} />}
                      onClick={handleConfirmExternalApplied}
                    >
                      Mark as Applied
                    </Button>
                  </div>
                )}

                {/* Job Portal Banner */}
                {selectedApp.jobUrl && (
                  <div className="job-portal-bar">
                    <span>Job Source URL:</span>
                    <a href={selectedApp.jobUrl} target="_blank" rel="noreferrer" className="portal-url">
                      {selectedApp.jobUrl} <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                {/* Exact Resume History & Download */}
                <div className="detail-section">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 className="section-subheading">
                      <FileText size={16} /> Exact Resume Version Used
                    </h4>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Download size={14} />}
                      onClick={handleDownloadSubmittedResume}
                    >
                      Download Submitted Resume
                    </Button>
                  </div>

                  <div className="exact-resume-pod">
                    <div className="resume-pod-info">
                      <span className="resume-name-text">
                        {selectedApp.resumeVersionName || 'Master Candidate Profile'}
                      </span>
                      <p className="resume-desc-text">
                        Stored immutable snapshot ensuring you always know what information was presented.
                      </p>
                    </div>
                    {fullDetails?.tailoredResume && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onNavigate('resumes', fullDetails.tailoredResume.id)}
                      >
                        Inspect Full Tailored Resume
                      </Button>
                    )}
                  </div>
                </div>

                {/* Application Audit Timeline */}
                {selectedApp.timeline && selectedApp.timeline.length > 0 && (
                  <div className="detail-section">
                    <h4 className="section-subheading">
                      <Clock size={16} /> Application Audit Timeline
                    </h4>
                    <div className="app-timeline-list">
                      {selectedApp.timeline.map((event, idx) => (
                        <div key={idx} className="timeline-item">
                          <div className="timeline-dot" />
                          <div className="timeline-content">
                            <div className="timeline-top">
                              <span className="timeline-stage">{event.stage}</span>
                              <span className="timeline-time">{new Date(event.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="timeline-desc">{event.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Skill Gaps & What to Learn Next */}
                {selectedApp.skillGaps && selectedApp.skillGaps.length > 0 && (
                  <div className="detail-section skill-gap-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 className="section-subheading text-amber">
                        <Sparkles size={16} /> Skill Gaps & Recommended Learning for {selectedApp.role}
                      </h4>
                      <Button
                        size="sm"
                        variant="outline"
                        icon={<BookOpen size={14} />}
                        onClick={() => onNavigate('learning')}
                      >
                        Learning Academy
                      </Button>
                    </div>
                    <p className="skill-gap-sub">
                      Historical application resume remains untouched. Strengthen your candidacy for upcoming interview stages:
                    </p>
                    <div className="chips-list">
                      {selectedApp.skillGaps.map((skill, idx) => (
                        <span key={idx} className="gap-skill-chip">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Application Notes */}
                <div className="detail-section">
                  <h4 className="section-subheading">Application Notes & History</h4>
                  <div className="notes-display-box">
                    {selectedApp.notes || 'No specific notes logged yet.'}
                  </div>
                </div>

                {/* Quick Launch Interview Prep */}
                <div className="detail-prep-cta">
                  <div>
                    <h4 className="prep-cta-title">Prepare for Upcoming Interview</h4>
                    <p className="prep-cta-sub">
                      Generate tailored questions built from this exact JD and your submitted resume.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    icon={<Headphones size={16} />}
                    onClick={() => onNavigate('interview', selectedApp.jobId)}
                  >
                    Open Interview Prep
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Edit Status Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Update Application Status"
      >
        <div className="status-modal-content">
          <div className="form-group">
            <label>Select Stage</label>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value as ApplicationStatus)}
              className="form-input"
            >
              {statusesList.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Update Notes (e.g. recruiter interview feedback, rounds completed)</label>
            <textarea
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Received email from HR recruiter scheduling technical screening on Monday."
              className="form-textarea"
            />
          </div>

          <div className="modal-action-row">
            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleUpdateStatus}>
              Save Updates
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
