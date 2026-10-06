import React, { useState, useEffect } from 'react';
import { apiClient } from '../api/client';
import { ApplicationItem, ApplicationStatus, ApplicationStats } from '../types/applications';
import { ApplicationCard } from '../components/applications/ApplicationCard';
import { ApplicationFilters } from '../components/applications/ApplicationFilters';
import { ApplicationStatsWidget } from '../components/applications/ApplicationStats';
import { StatusUpdateModal } from '../components/applications/StatusUpdateModal';
import { ApplicationDetailPage } from './ApplicationDetailPage';
import {
  FileText,
  Bookmark,
  Briefcase,
  AlertCircle,
  RefreshCw,
  Plus
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
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [stats, setStats] = useState<ApplicationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selected for detail view
  const [selectedAppId, setSelectedAppId] = useState<string | null>(preselectedAppId || null);

  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Status modal
  const [modalApp, setModalApp] = useState<ApplicationItem | null>(null);

  const fetchApplicationsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [appsResult, statsResult] = await Promise.all([
        apiClient.listApplications({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: search || undefined
        }),
        apiClient.getApplicationStats()
      ]);

      setApplications(appsResult.data || []);
      setStats(statsResult);
    } catch (err: any) {
      setError(err?.message || 'Failed to load applications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplicationsData();
  }, [statusFilter, search]);

  useEffect(() => {
    if (preselectedAppId) {
      setSelectedAppId(preselectedAppId);
    }
  }, [preselectedAppId]);

  const handleStatusUpdate = async (newStatus: ApplicationStatus, reason?: string) => {
    if (!modalApp) return;
    await apiClient.updateApplicationStatus(modalApp.id, newStatus, reason);
    await fetchApplicationsData();
  };

  // If viewing details of a specific application
  if (selectedAppId) {
    return (
      <ApplicationDetailPage
        applicationId={selectedAppId}
        onBack={() => {
          setSelectedAppId(null);
          fetchApplicationsData();
        }}
        onNavigateToJob={jobId => onNavigate('jobs', jobId)}
      />
    );
  }

  return (
    <div className="applications-page-container">
      {/* Header Bar */}
      <div className="applications-page-header">
        <div>
          <h1 className="applications-title">Applications Intelligence & Pipeline</h1>
          <p className="applications-subtitle">
            Track status progression, manage candidate notes, and link tailored resume versions across all your job applications.
          </p>
        </div>
        <div className="header-actions">
          <button
            className="saved-jobs-nav-btn"
            onClick={() => onNavigate('saved-jobs')}
          >
            <Bookmark size={16} />
            <span>Saved Jobs</span>
          </button>
          <button
            className="browse-jobs-header-btn"
            onClick={() => onNavigate('jobs')}
          >
            <Briefcase size={16} />
            <span>Explore Jobs</span>
          </button>
        </div>
      </div>

      {/* Analytics Summary */}
      <ApplicationStatsWidget stats={stats} loading={loading} />

      {/* Filter and Search Bar */}
      <ApplicationFilters
        search={search}
        onSearchChange={setSearch}
        status={statusFilter}
        onStatusChange={setStatusFilter}
        onRefresh={fetchApplicationsData}
        loading={loading}
      />

      {/* Applications List */}
      {loading ? (
        <div className="applications-loading-state">
          <RefreshCw size={28} className="spin" />
          <p>Loading application pipeline...</p>
        </div>
      ) : error ? (
        <div className="applications-error-state">
          <AlertCircle size={32} />
          <h3>Error Loading Applications</h3>
          <p>{error}</p>
          <button className="retry-btn" onClick={fetchApplicationsData}>
            Retry
          </button>
        </div>
      ) : applications.length === 0 ? (
        <div className="applications-empty-state">
          <FileText size={44} />
          <h3>No Applications Found</h3>
          <p>
            {statusFilter !== 'ALL' || search
              ? 'No applications match your active filters or search terms.'
              : 'You haven’t started tracking any job applications yet.'}
          </p>
          <button className="browse-jobs-empty-btn" onClick={() => onNavigate('jobs')}>
            Browse Jobs & Start Applying
          </button>
        </div>
      ) : (
        <div className="applications-cards-grid">
          {applications.map(app => (
            <ApplicationCard
              key={app.id}
              application={app}
              onClick={() => setSelectedAppId(app.id)}
              onStatusClick={e => {
                e.stopPropagation();
                setModalApp(app);
              }}
            />
          ))}
        </div>
      )}

      {/* Status Update Modal */}
      {modalApp && (
        <StatusUpdateModal
          isOpen={Boolean(modalApp)}
          onClose={() => setModalApp(null)}
          currentStatus={modalApp.status}
          onUpdateStatus={handleStatusUpdate}
        />
      )}
    </div>
  );
};
