import React, { useState, useEffect } from 'react';
import { CanonicalJob } from '../types/job.types';
import { apiClient } from '../api/client';
import { JobCard } from '../components/jobs/JobCard';
import { JobDetailModal } from '../components/jobs/JobDetailModal';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { api } from '../api/index';
import {
  Search,
  Filter,
  RefreshCw,
  Plus,
  Briefcase,
  AlertCircle,
  FileText,
  Globe,
  Sparkles,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import './JobsPage.css';

interface JobsPageProps {
  onSelectJobForAnalysis?: (jobId: string) => void;
  preselectedJobId?: string;
}

export const JobsPage: React.FC<JobsPageProps> = ({
  onSelectJobForAnalysis,
  preselectedJobId
}) => {
  // Discovery and Query state
  const [jobs, setJobs] = useState<CanonicalJob[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter params
  const [searchQuery, setSearchQuery] = useState('');
  const [remoteFilter, setRemoteFilter] = useState('');
  const [employmentFilter, setEmploymentFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Syncing state
  const [isSyncing, setIsSyncing] = useState(false);

  // Detail Modal state
  const [selectedJob, setSelectedJob] = useState<CanonicalJob | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Add Job Modal state (Preserved prototype workflow)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [inputTab, setInputTab] = useState<'paste' | 'url'>('paste');
  const [pastedJD, setPastedJD] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchCanonicalJobs = async (targetPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getCanonicalJobs({
        query: searchQuery || undefined,
        remoteType: remoteFilter || undefined,
        employmentType: employmentFilter || undefined,
        sourceType: sourceFilter || undefined,
        page: targetPage,
        pageSize: 12
      });

      setJobs(res.data);
      if (res.pagination) {
        setPage(res.pagination.page);
        setTotalPages(res.pagination.totalPages);
        setTotalCount(res.pagination.total);
      }
    } catch (err: any) {
      console.error('Failed to load canonical jobs:', err);
      // Fallback: If DB table is empty or unauthenticated in dev, fetch prototype jobs gracefully
      try {
        const protoJobs = await api.getJobs();
        const mapped = protoJobs.map((pj: any) => ({
          id: pj.id,
          title: pj.role,
          company: { id: 'comp-' + pj.id, name: pj.company },
          description: pj.rawText || pj.role,
          responsibilities: pj.responsibilities || [],
          requirements: pj.qualifications || [],
          preferredQualifications: [],
          remoteType: (pj.workMode?.toUpperCase().includes('REMOTE') ? 'REMOTE' : 'ON_SITE') as any,
          employmentType: 'FULL_TIME' as any,
          status: 'ACTIVE' as any,
          sourceType: pj.source || 'PROTOTYPE',
          sourceName: pj.source || 'Predefined',
          sourceUrl: pj.sourceUrl || '#',
          applicationUrl: pj.applicationUrl || pj.sourceUrl,
          firstSeenAt: new Date().toISOString(),
          lastSeenAt: new Date().toISOString(),
          skills: (pj.mustHaveSkills || []).map((s: string) => ({ id: s, name: s, category: 'TECHNICAL', type: 'REQUIRED' as any }))
        }));
        setJobs(mapped);
        setTotalPages(1);
        setTotalCount(mapped.length);
      } catch (fErr: any) {
        setError(err.message || 'Unable to fetch job opportunities');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCanonicalJobs(1);
  }, [remoteFilter, employmentFilter, sourceFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCanonicalJobs(1);
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    try {
      await apiClient.syncJobs();
      await fetchCanonicalJobs(1);
    } catch (err) {
      console.warn('Sync notice:', err);
      // Run fallback codewalla sync
      await api.syncJobSource('codewalla').catch(() => {});
      await fetchCanonicalJobs(1);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOpenJobDetail = (job: CanonicalJob) => {
    setSelectedJob(job);
    setIsDetailOpen(true);
  };

  const handleAddJob = async () => {
    setModalError(null);
    setIsProcessing(true);
    try {
      if (inputTab === 'paste') {
        if (!pastedJD.trim()) {
          setModalError('Please paste the job description text.');
          setIsProcessing(false);
          return;
        }
        const created = await api.parseJob(pastedJD, 'pasted');
        await fetchCanonicalJobs(1);
        setIsAddModalOpen(false);
        setPastedJD('');
        if (onSelectJobForAnalysis) onSelectJobForAnalysis(created.id);
      } else {
        if (!jobUrl.trim()) {
          setModalError('Please enter a valid job URL.');
          setIsProcessing(false);
          return;
        }
        const res = await api.extractJobUrl(jobUrl);
        if (!res.success && res.fallbackRequired) {
          setModalError('Unable to extract job page automatically. Paste the job description text instead.');
          setInputTab('paste');
          setIsProcessing(false);
          return;
        }
        if (res.data) {
          await fetchCanonicalJobs(1);
          setIsAddModalOpen(false);
          setJobUrl('');
          if (onSelectJobForAnalysis) onSelectJobForAnalysis(res.data.id);
        }
      }
    } catch (err: any) {
      setModalError(err.message || 'Failed to process job opportunity');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="jobs-page">
      {/* Header & Main Ingestion Controls */}
      <div className="jobs-header-row">
        <div>
          <h2 className="jobs-page-title">Production Job Discovery Engine</h2>
          <p className="jobs-page-sub">
            Real-time multi-source job aggregation across Codewalla, Greenhouse, Lever, and Ashby with automated deduplication & source transparency.
          </p>
        </div>

        <div className="jobs-actions-group">
          <Button
            variant="outline"
            icon={<RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />}
            loading={isSyncing}
            onClick={handleSyncAll}
          >
            {isSyncing ? 'Synchronizing Sources...' : 'Sync Sources'}
          </Button>

          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Custom Job
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="search-filter-bar">
        <form className="search-input-wrap" onSubmit={handleSearchSubmit}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search titles, skills, or companies..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="filter-controls-row">
          <select
            className="filter-select"
            value={remoteFilter}
            onChange={e => setRemoteFilter(e.target.value)}
          >
            <option value="">All Work Modes</option>
            <option value="REMOTE">Remote</option>
            <option value="HYBRID">Hybrid</option>
            <option value="ON_SITE">On-Site</option>
          </select>

          <select
            className="filter-select"
            value={employmentFilter}
            onChange={e => setEmploymentFilter(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="FULL_TIME">Full Time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERNSHIP">Internship</option>
          </select>

          <select
            className="filter-select"
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value)}
          >
            <option value="">All Sources</option>
            <option value="CODEWALLA">Codewalla</option>
            <option value="GREENHOUSE">Greenhouse</option>
            <option value="LEVER">Lever</option>
            <option value="ASHBY">Ashby</option>
          </select>

          <Button variant="secondary" size="sm" onClick={() => fetchCanonicalJobs(1)}>
            Apply
          </Button>
        </div>
      </div>

      {/* Results Header */}
      <div className="jobs-results-meta">
        <span className="results-count-text">
          Showing <strong>{jobs.length}</strong> of <strong>{totalCount}</strong> opportunities
        </span>
      </div>

      {/* Loading & Error States */}
      {loading && (
        <div className="jobs-loading-state">
          <RefreshCw size={28} className="animate-spin" />
          <span>Discovering & validating canonical opportunities...</span>
        </div>
      )}

      {error && !loading && (
        <div className="jobs-error-banner">
          <AlertCircle size={20} />
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => fetchCanonicalJobs(1)}>
            Retry
          </Button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && jobs.length === 0 && (
        <div className="jobs-empty-state">
          <Briefcase size={40} className="empty-icon" />
          <h3>No matching job opportunities found</h3>
          <p>Try broadening your search keywords or reset filter parameters.</p>
          <Button variant="outline" size="sm" onClick={() => { setSearchQuery(''); setRemoteFilter(''); setEmploymentFilter(''); setSourceFilter(''); fetchCanonicalJobs(1); }}>
            Reset Filters
          </Button>
        </div>
      )}

      {/* Canonical Jobs Grid */}
      {!loading && jobs.length > 0 && (
        <div className="jobs-grid-display">
          {jobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onSelect={handleOpenJobDetail}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && !loading && (
        <div className="jobs-pagination-bar">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            icon={<ChevronLeft size={16} />}
            onClick={() => fetchCanonicalJobs(page - 1)}
          >
            Previous
          </Button>
          <span className="page-indicator">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            icon={<ChevronRight size={16} />}
            onClick={() => fetchCanonicalJobs(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Canonical Job Detail Modal */}
      <JobDetailModal
        job={selectedJob}
        isOpen={isDetailOpen}
        onClose={() => { setIsDetailOpen(false); setSelectedJob(null); }}
      />

      {/* Add / Parse Job Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add Opportunity for AI Evaluation"
        maxWidth="lg"
      >
        <div className="add-job-modal-flow">
          <div className="tab-switcher">
            <button
              className={`tab-btn ${inputTab === 'paste' ? 'tab-btn-active' : ''}`}
              onClick={() => { setInputTab('paste'); setModalError(null); }}
            >
              <FileText size={16} /> Paste Job Description
            </button>
            <button
              className={`tab-btn ${inputTab === 'url' ? 'tab-btn-active' : ''}`}
              onClick={() => { setInputTab('url'); setModalError(null); }}
            >
              <Globe size={16} /> Public Job URL
            </button>
          </div>

          {inputTab === 'paste' ? (
            <div className="input-group-area">
              <label>Paste Complete Job Description Text</label>
              <textarea
                rows={10}
                placeholder="Paste the full job post details, role title, required skills, and responsibilities..."
                value={pastedJD}
                onChange={e => setPastedJD(e.target.value)}
              />
            </div>
          ) : (
            <div className="input-group-area">
              <label>Publicly Accessible Job Page URL</label>
              <input
                type="url"
                placeholder="https://company.com/careers/job-opening-id"
                value={jobUrl}
                onChange={e => setJobUrl(e.target.value)}
              />
              <p className="helper-url-text">
                Pilot Mama securely inspects visible public page content. If blocked by authentication or anti-bot defenses, it will safely provide a paste-fallback.
              </p>
            </div>
          )}

          {modalError && (
            <div className="modal-error-notice">
              <AlertCircle size={16} />
              <span>{modalError}</span>
            </div>
          )}

          <div className="modal-action-row">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={isProcessing}
              icon={<Sparkles size={16} />}
              onClick={handleAddJob}
            >
              Analyze with Pilot Mama
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
