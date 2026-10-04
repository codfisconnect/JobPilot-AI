import React, { useState, useEffect } from 'react';
import { useApp } from "../context/AppContext";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
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
  Edit3
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

  // Status edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ApplicationStatus>('Applied');
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

  const statuses: ApplicationStatus[] = [
    'Saved',
    'Ready to Apply',
    'Applied',
    'Interview',
    'Selected',
    'Rejected',
    'Withdrawn',
    'Skipped'
  ];

  return (
    <div className="applications-page">
      <div className="apps-header">
        <div>
          <h2 className="apps-title">Job Application Pipeline Tracker</h2>
          <p className="apps-sub">
            Track submitted applications with exact resume versions, questions answers, and interview milestones.
          </p>
        </div>
      </div>

      {applications.length === 0 ? (
        <Card className="empty-apps-card">
          <Send size={40} className="empty-icon" />
          <h3>No applications tracked yet.</h3>
          <p>Analyze any job post to create tailored resumes and continue to the application pipeline.</p>
          <Button variant="primary" onClick={() => onNavigate('jobs')}>
            Analyze Jobs
          </Button>
        </Card>
      ) : (
        <div className="apps-grid">
          {/* Applications Table / Cards */}
          <div className="apps-cards-list">
            {applications.map(app => (
              <Card
                key={app.id}
                className={`app-item-card ${selectedApp?.id === app.id ? 'app-card-active' : ''}`}
                hoverable
                onClick={() => loadAppDetails(app)}
              >
                <div className="app-card-top-row">
                  <span className="app-comp-name">{app.company}</span>
                  <Badge
                    variant={
                      app.status === 'Interview'
                        ? 'emerald'
                        : app.status === 'Applied'
                        ? 'blue'
                        : app.status === 'Ready to Apply'
                        ? 'indigo'
                        : 'amber'
                    }
                    size="sm"
                  >
                    {app.status}
                  </Badge>
                </div>

                <h4 className="app-card-role">{app.role}</h4>

                <div className="app-card-meta">
                  <span>Match: {app.matchScore}%</span>
                  <span>Date: {app.applicationDate}</span>
                </div>

                <div className="app-card-resume-tag">
                  Resume: {app.resumeVersionName || 'Master Profile'}
                </div>
              </Card>
            ))}
          </div>

          {/* Details & Exact History Pane */}
          {selectedApp && (
            <div className="app-detail-pane">
              <Card className="app-detail-card">
                <div className="detail-head-row">
                  <div>
                    <span className="detail-comp-tag">{selectedApp.company}</span>
                    <h3 className="detail-role-title">{selectedApp.role}</h3>
                    <div className="detail-sub-meta">
                      <span><MapPin size={13} /> {selectedApp.location}</span>
                      <span><Calendar size={13} /> Applied: {selectedApp.applicationDate}</span>
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

                {/* Job URL Banner */}
                {selectedApp.jobUrl && (
                  <div className="job-portal-bar">
                    <span>Job Source URL:</span>
                    <a href={selectedApp.jobUrl} target="_blank" rel="noreferrer" className="portal-url">
                      {selectedApp.jobUrl} <ExternalLink size={12} />
                    </a>
                  </div>
                )}

                {/* Exact Resume History */}
                <div className="detail-section">
                  <h4 className="section-subheading">
                    <FileText size={16} /> Exact Resume Version Used
                  </h4>
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
                        variant="outline"
                        onClick={() => onNavigate('resumes', fullDetails.tailoredResume.id)}
                      >
                        Inspect Full Tailored Resume
                      </Button>
                    )}
                  </div>
                </div>

                {/* Application Notes */}
                <div className="detail-section">
                  <h4 className="section-subheading">Application Notes & History</h4>
                  <div className="notes-display-box">
                    {selectedApp.notes || 'No specific notes logged yet.'}
                  </div>
                </div>

                {/* Suggested / Custom Answers */}
                {selectedApp.customAnswers && Object.keys(selectedApp.customAnswers).length > 0 && (
                  <div className="detail-section">
                    <h4 className="section-subheading">Application Questions & Answers</h4>
                    <div className="answers-review-list">
                      {Object.entries(selectedApp.customAnswers).map(([q, a], idx) => (
                        <div key={idx} className="qa-pair-box">
                          <span className="qa-q">{q}</span>
                          <span className="qa-a">{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
            >
              {statuses.map(st => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Update Notes (e.g. interview rounds, contact recruiter, etc.)</label>
            <textarea
              rows={4}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Received email from HR recruiter scheduling technical screening on Monday."
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
