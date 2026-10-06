import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { SavedJobItem } from '../types/applications';
import {
  Bookmark,
  Building2,
  MapPin,
  ExternalLink,
  Trash2,
  ArrowRight,
  Send,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import './SavedJobsPage.css';

interface SavedJobsPageProps {
  onNavigate: (tab: string, contextId?: string) => void;
}

export const SavedJobsPage: React.FC<SavedJobsPageProps> = ({ onNavigate }) => {
  const [savedJobs, setSavedJobs] = useState<SavedJobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchSavedJobs = async () => {
    try {
      setLoading(true);
      setError(null);
      const list = await apiClient.listSavedJobs();
      setSavedJobs(list);
    } catch (err: any) {
      setError(err?.message || 'Failed to load saved jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedJobs();
  }, []);

  const handleRemoveSavedJob = async (jobId: string) => {
    try {
      setActionLoadingId(jobId);
      await apiClient.removeSavedJob(jobId);
      await fetchSavedJobs();
    } catch (err: any) {
      alert(err?.message || 'Failed to remove saved job');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartApplication = async (jobId: string, externalUrl?: string | null) => {
    try {
      setActionLoadingId(jobId);
      // Create application in READY_TO_APPLY status
      const created = await apiClient.createApplication({
        jobId,
        status: 'READY_TO_APPLY',
        externalUrl: externalUrl || undefined
      });
      // Navigate to application detail
      onNavigate('applications', created.id);
    } catch (err: any) {
      alert(err?.message || 'Failed to initialize application');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="saved-jobs-page">
      <div className="saved-jobs-header">
        <div>
          <h1 className="saved-jobs-title">Saved Jobs</h1>
          <p className="saved-jobs-subtitle">
            Jobs bookmarked for application preparation, tailoring, and tracking.
          </p>
        </div>
        <button className="refresh-saved-btn" onClick={fetchSavedJobs} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="saved-jobs-loading">
          <RefreshCw size={24} className="spin" />
          <p>Loading your bookmarked jobs...</p>
        </div>
      ) : error ? (
        <div className="saved-jobs-error">
          <AlertCircle size={32} />
          <p>{error}</p>
          <button onClick={fetchSavedJobs} className="retry-btn">
            Retry
          </button>
        </div>
      ) : savedJobs.length === 0 ? (
        <div className="saved-jobs-empty">
          <Bookmark size={40} />
          <h3>No Saved Jobs</h3>
          <p>You haven't saved any jobs yet. Browse available jobs and bookmark them to apply later.</p>
          <button className="browse-jobs-btn" onClick={() => onNavigate('jobs')}>
            Browse Job Openings
          </button>
        </div>
      ) : (
        <div className="saved-jobs-list">
          {savedJobs.map(item => {
            const { job, notes, savedAt } = item;
            const isActing = actionLoadingId === job.id;

            return (
              <div key={item.id} className="saved-job-card">
                <div className="saved-job-card-main">
                  <div className="saved-job-icon">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <h3 className="saved-job-title">{job?.title || 'Unknown Role'}</h3>
                    <div className="saved-job-meta">
                      <span className="saved-company">{job?.company?.name}</span>
                      {job?.location && <span className="meta-sep">•</span>}
                      {job?.location && (
                        <span className="saved-location">
                          <MapPin size={13} /> {job.location}
                        </span>
                      )}
                    </div>
                    {notes && <p className="saved-notes">Note: {notes}</p>}
                    <span className="saved-date">
                      Saved on {new Date(savedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="saved-job-card-actions">
                  <button
                    className="remove-saved-btn"
                    onClick={() => handleRemoveSavedJob(job.id)}
                    disabled={isActing}
                    title="Remove from saved jobs"
                  >
                    <Trash2 size={16} />
                  </button>

                  <button
                    className="analyze-fit-btn"
                    onClick={() => onNavigate('analysis', job.id)}
                  >
                    <span>Check Match Fit</span>
                  </button>

                  <button
                    className="start-apply-btn"
                    onClick={() => handleStartApplication(job.id, job.applicationUrl)}
                    disabled={isActing}
                  >
                    <Send size={15} />
                    <span>Apply / Track</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
