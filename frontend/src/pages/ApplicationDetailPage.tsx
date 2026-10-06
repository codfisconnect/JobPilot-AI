import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { ApplicationItem, ApplicationStatus } from '../types/applications';
import { ApplicationStatusBadge } from '../components/applications/ApplicationStatusBadge';
import { ApplicationTimeline } from '../components/applications/ApplicationTimeline';
import { ApplicationNotes } from '../components/applications/ApplicationNotes';
import { ApplicationReminderWidget } from '../components/applications/ApplicationReminder';
import { StatusUpdateModal } from '../components/applications/StatusUpdateModal';
import {
  ArrowLeft,
  Building2,
  MapPin,
  ExternalLink,
  FileCheck,
  Calendar,
  Clock,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Send,
  Trash2
} from 'lucide-react';
import './ApplicationDetailPage.css';

interface ApplicationDetailPageProps {
  applicationId: string;
  onBack: () => void;
  onNavigateToJob?: (jobId: string) => void;
}

export const ApplicationDetailPage: React.FC<ApplicationDetailPageProps> = ({
  applicationId,
  onBack,
  onNavigateToJob
}) => {
  const [application, setApplication] = useState<ApplicationItem | null>(null);
  const [matchData, setMatchData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const fetchApplicationDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const appData = await apiClient.getApplicationById(applicationId);
      setApplication(appData);

      // Attempt to fetch Sprint 4 match data if available
      if (appData?.jobId) {
        try {
          const match = await apiClient.getJobMatch(appData.jobId);
          setMatchData(match);
        } catch {
          // Sprint 4 match is optional if not computed yet
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load application details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicationDetails();
  }, [applicationId]);

  const handleStatusUpdate = async (newStatus: ApplicationStatus, reason?: string) => {
    if (!application) return;
    await apiClient.updateApplicationStatus(application.id, newStatus, reason);
    await fetchApplicationDetails();
  };

  const handleAddNote = async (content: string) => {
    if (!application) return;
    await apiClient.addApplicationNote(application.id, content);
    await fetchApplicationDetails();
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!application) return;
    await apiClient.deleteApplicationNote(application.id, noteId);
    await fetchApplicationDetails();
  };

  const handleAddReminder = async (title: string, dueDate: string) => {
    if (!application) return;
    await apiClient.addApplicationReminder(application.id, title, dueDate);
    await fetchApplicationDetails();
  };

  const handleDeleteReminder = async (reminderId: string) => {
    if (!application) return;
    await apiClient.deleteApplicationReminder(application.id, reminderId);
    await fetchApplicationDetails();
  };

  if (loading) {
    return (
      <div className="app-detail-container">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Pipeline
        </button>
        <div className="detail-loading-state">
          <RefreshCw size={28} className="spin" />
          <p>Loading application intelligence...</p>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="app-detail-container">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Pipeline
        </button>
        <div className="detail-error-state">
          <AlertCircle size={32} />
          <h3>Application Not Found</h3>
          <p>{error || 'The requested application could not be located.'}</p>
          <button className="retry-btn" onClick={fetchApplicationDetails}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { job, resumeVersion, status, appliedAt, createdAt, notes, reminders, statusHistory, externalUrl } = application;
  const targetApplyUrl = externalUrl || job?.applicationUrl;

  return (
    <div className="app-detail-container">
      <div className="detail-top-nav">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={16} /> Back to Applications
        </button>
      </div>

      {/* Header Banner */}
      <div className="detail-header-card">
        <div className="detail-header-main">
          <div className="company-logo-avatar">
            <Building2 size={28} />
          </div>
          <div>
            <h1 className="detail-job-title">{job?.title || 'Unknown Position'}</h1>
            <div className="detail-company-meta">
              <span className="company-name">{job?.company?.name}</span>
              {job?.location && (
                <span className="meta-sep">•</span>
              )}
              {job?.location && (
                <span className="location-tag">
                  <MapPin size={14} /> {job.location}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="detail-header-actions">
          <div className="status-badge-wrapper" onClick={() => setIsStatusModalOpen(true)}>
            <ApplicationStatusBadge status={status} size="lg" />
            <button className="change-status-pill-btn">Change Stage</button>
          </div>

          {targetApplyUrl && (
            <a
              href={targetApplyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="external-apply-btn"
            >
              <span>Visit Employer Portal</span>
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      </div>

      {/* Main Grid */}
      <div className="detail-content-grid">
        {/* Left Column: Intelligence, Resume Version, Timeline */}
        <div className="detail-left-col">
          {/* Resume & Match Intelligence Card */}
          <div className="detail-section-card">
            <h3 className="section-title">Application Intelligence</h3>
            <div className="intel-items-row">
              <div className="intel-box">
                <span className="intel-box-label">Attached Resume Version</span>
                {resumeVersion ? (
                  <div className="resume-pill">
                    <FileCheck size={16} />
                    <span className="resume-name">{resumeVersion.versionName || resumeVersion.title}</span>
                  </div>
                ) : (
                  <span className="intel-empty-text">Standard Master Profile</span>
                )}
              </div>

              {matchData && (
                <div className="intel-box">
                  <span className="intel-box-label">Sprint 4 Match Score</span>
                  <div className="score-pill">
                    <Sparkles size={16} />
                    <span>{matchData.overallScore}% Fit</span>
                  </div>
                </div>
              )}

              {resumeVersion?.atsScore !== null && resumeVersion?.atsScore !== undefined && (
                <div className="intel-box">
                  <span className="intel-box-label">ATS Optimization</span>
                  <div className="score-pill ats">
                    <span>{resumeVersion.atsScore}% Score</span>
                  </div>
                </div>
              )}
            </div>

            <div className="application-timestamps">
              <div className="timestamp-item">
                <Calendar size={14} />
                <span>Created: {new Date(createdAt).toLocaleDateString()}</span>
              </div>
              {appliedAt && (
                <div className="timestamp-item">
                  <Clock size={14} />
                  <span>Applied: {new Date(appliedAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </div>

          {/* Status Timeline */}
          <div className="detail-section-card">
            <h3 className="section-title">Status Progression Timeline</h3>
            <ApplicationTimeline history={statusHistory || []} />
          </div>
        </div>

        {/* Right Column: Notes & Reminders */}
        <div className="detail-right-col">
          {/* Notes Section */}
          <div className="detail-section-card">
            <h3 className="section-title">Candidate Notes</h3>
            <ApplicationNotes
              notes={notes || []}
              onAddNote={handleAddNote}
              onDeleteNote={handleDeleteNote}
            />
          </div>

          {/* Reminders Section */}
          <div className="detail-section-card">
            <h3 className="section-title">Reminders & Follow-Ups</h3>
            <ApplicationReminderWidget
              reminders={reminders || []}
              onAddReminder={handleAddReminder}
              onDeleteReminder={handleDeleteReminder}
            />
          </div>
        </div>
      </div>

      {/* Status Update Modal */}
      <StatusUpdateModal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        currentStatus={status}
        onUpdateStatus={handleStatusUpdate}
      />
    </div>
  );
};
