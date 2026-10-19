import React, { useState, useEffect, useCallback } from 'react';
import { CanonicalJob } from '../types/job.types';
import { apiClient } from '../api/client';
import { JobCard } from '../components/jobs/JobCard';
import { JobDetailModal } from '../components/jobs/JobDetailModal';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import { api } from '../api/index';
import { normalizeApiError } from '../utils/errorUtils';
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
  ChevronRight,
  SlidersHorizontal,
  X,
  Building,
  MapPin,
  Calendar,
  Layers,
  ArrowUpDown
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
  const [countryFilter, setCountryFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [remoteFilter, setRemoteFilter] = useState('');
  const [employmentFilter, setEmploymentFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [postedDateFilter, setPostedDateFilter] = useState('');
  const [sortFilter, setSortFilter] = useState<'latest' | 'oldest' | 'company' | 'location' | 'salary'>('latest');

  // Dynamic available companies from canonical database
  const [availableCompanies, setAvailableCompanies] = useState<{ id: string; name: string }[]>([]);

  // Mobile Filter Drawer State
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

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

  // Load canonical company names once for filter dropdown
  useEffect(() => {
    let mounted = true;
    apiClient.listCompanies(100)
      .then(res => {
        if (mounted && Array.isArray(res)) {
          setAvailableCompanies(res.map(c => ({ id: c.id, name: c.name })));
        }
      })
      .catch(() => {
        // Graceful fallback for offline / mock
      });
    return () => {
      mounted = false;
    };
  }, []);

  const fetchCanonicalJobs = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getCanonicalJobs({
        query: searchQuery.trim() || undefined,
        country: countryFilter.trim() || undefined,
        location: locationFilter.trim() || undefined,
        remoteType: remoteFilter || undefined,
        employmentType: employmentFilter || undefined,
        sourceType: sourceFilter || undefined,
        companyName: companyFilter || undefined,
        postedDays: postedDateFilter || undefined,
        sortBy: sortFilter,
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
      const norm = normalizeApiError(err, 'Unable to fetch job opportunities');
      setError(norm.message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, countryFilter, locationFilter, remoteFilter, employmentFilter, sourceFilter, companyFilter, postedDateFilter, sortFilter]);

  // Initial and reactive fetch upon filter modifications
  useEffect(() => {
    fetchCanonicalJobs(1);
  }, [countryFilter, remoteFilter, employmentFilter, sourceFilter, companyFilter, postedDateFilter, sortFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCanonicalJobs(1);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setCountryFilter('');
    setLocationFilter('');
    setRemoteFilter('');
    setEmploymentFilter('');
    setSourceFilter('');
    setCompanyFilter('');
    setPostedDateFilter('');
    setSortFilter('latest');
    setIsMobileFilterOpen(false);
  };

  const activeFilterCount = [
    countryFilter,
    remoteFilter,
    employmentFilter,
    sourceFilter,
    companyFilter,
    postedDateFilter,
    locationFilter
  ].filter(Boolean).length;

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
      {/* Header & Main Controls */}
      <div className="jobs-header-row">
        <div>
          <h2 className="jobs-page-title">Explore Opportunities</h2>
          <p className="jobs-page-sub">
            <span className="desktop-only-text">Discover opportunities from connected company career sources with automated deduplication and source transparency.</span>
            <span className="mobile-only-text">Find verified jobs from trusted company sources.</span>
          </p>
        </div>

        <div className="jobs-actions-group">
          {/* Mobile Filter Button */}
          <button
            type="button"
            className="mobile-filter-btn"
            onClick={() => setIsMobileFilterOpen(true)}
            aria-label="Open Filter Drawer"
          >
            <SlidersHorizontal size={16} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="mobile-filter-badge">{activeFilterCount}</span>
            )}
          </button>

          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add Target Job
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="search-filter-bar">
        <form className="search-input-wrap" onSubmit={handleSearchSubmit}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search roles, skills, or companies..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </form>

        <div className="filter-controls-row desktop-only-filters">
          {/* Country */}
          <select
            className="filter-select"
            value={countryFilter}
            onChange={e => setCountryFilter(e.target.value)}
            aria-label="Country Filter"
          >
            <option value="">All Countries</option>
            <option value="India">India</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Germany">Germany</option>
            <option value="France">France</option>
            <option value="Australia">Australia</option>
            <option value="Canada">Canada</option>
            <option value="Colombia">Colombia</option>
            <option value="Romania">Romania</option>
            <option value="Costa Rica">Costa Rica</option>
            <option value="Mexico">Mexico</option>
          </select>

          {/* Work Mode */}
          <select
            className="filter-select"
            value={remoteFilter}
            onChange={e => setRemoteFilter(e.target.value)}
            aria-label="Work Mode"
          >
            <option value="">All Work Modes</option>
            <option value="REMOTE">Remote</option>
            <option value="HYBRID">Hybrid</option>
            <option value="ON_SITE">On-Site</option>
          </select>

          {/* Employment Type */}
          <select
            className="filter-select"
            value={employmentFilter}
            onChange={e => setEmploymentFilter(e.target.value)}
            aria-label="Employment Type"
          >
            <option value="">All Employment Types</option>
            <option value="FULL_TIME">Full Time</option>
            <option value="PART_TIME">Part Time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERNSHIP">Internship</option>
          </select>

          {/* Company */}
          <select
            className="filter-select"
            value={companyFilter}
            onChange={e => setCompanyFilter(e.target.value)}
            aria-label="Company Filter"
          >
            <option value="">All Companies</option>
            {availableCompanies.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* Posted Date */}
          <select
            className="filter-select"
            value={postedDateFilter}
            onChange={e => setPostedDateFilter(e.target.value)}
            aria-label="Posted Date Filter"
          >
            <option value="">Any Time</option>
            <option value="1">Past 24 Hours</option>
            <option value="3">Past 3 Days</option>
            <option value="7">Past Week</option>
            <option value="14">Past 14 Days</option>
            <option value="30">Past Month</option>
          </select>

          {/* Sort By */}
          <select
            className="filter-select sort-select"
            value={sortFilter}
            onChange={e => setSortFilter(e.target.value as any)}
            aria-label="Sort Options"
          >
            <option value="latest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="company">Company (A-Z)</option>
            <option value="location">Location (A-Z)</option>
            <option value="salary">Highest Salary</option>
          </select>

          <Button variant="secondary" size="sm" onClick={() => fetchCanonicalJobs(1)}>
            Search
          </Button>

          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {/* Active Filter Chips Bar */}
      {activeFilterCount > 0 && (
        <div className="active-filter-chips-row">
          <span className="chips-label">Filters:</span>
          {countryFilter && (
            <button className="filter-chip" onClick={() => setCountryFilter('')}>
              {countryFilter} <X size={12} />
            </button>
          )}
          {remoteFilter && (
            <button className="filter-chip" onClick={() => setRemoteFilter('')}>
              {remoteFilter.replace('_', ' ')} <X size={12} />
            </button>
          )}
          {employmentFilter && (
            <button className="filter-chip" onClick={() => setEmploymentFilter('')}>
              {employmentFilter.replace('_', ' ')} <X size={12} />
            </button>
          )}
          {companyFilter && (
            <button className="filter-chip" onClick={() => setCompanyFilter('')}>
              {companyFilter} <X size={12} />
            </button>
          )}
          {postedDateFilter && (
            <button className="filter-chip" onClick={() => setPostedDateFilter('')}>
              Past {postedDateFilter}d <X size={12} />
            </button>
          )}
          {locationFilter && (
            <button className="filter-chip" onClick={() => setLocationFilter('')}>
              {locationFilter} <X size={12} />
            </button>
          )}
          <button className="filter-clear-all-btn" onClick={handleResetFilters}>
            Clear all
          </button>
        </div>
      )}

      {/* Results Header */}
      <div className="jobs-results-meta">
        <span className="results-count-text">
          Showing <strong>{jobs.length}</strong> of <strong>{totalCount}</strong> opportunities
        </span>
        {activeFilterCount > 0 && (
          <span className="active-filter-indicator">
            {activeFilterCount} active filter{activeFilterCount > 1 ? 's' : ''} applied
          </span>
        )}
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
          <Button variant="outline" size="sm" onClick={handleResetFilters}>
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
        onAnalyzeFit={onSelectJobForAnalysis}
      />

      {/* Mobile Filter Drawer / Bottom Sheet */}
      {isMobileFilterOpen && (
        <div className="mobile-filter-drawer-overlay" onClick={() => setIsMobileFilterOpen(false)}>
          <div className="mobile-filter-drawer" onClick={e => e.stopPropagation()}>
            <div className="mobile-filter-drawer-header">
              <div className="drawer-title-wrap">
                <SlidersHorizontal size={18} />
                <h3>Filter Jobs</h3>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setIsMobileFilterOpen(false)}
                aria-label="Close Filter Drawer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mobile-filter-drawer-body">
              {/* Sort Order */}
              <div className="drawer-filter-group">
                <label><ArrowUpDown size={14} /> Sort By</label>
                <select
                  value={sortFilter}
                  onChange={e => setSortFilter(e.target.value as any)}
                >
                  <option value="latest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="company">Company (A-Z)</option>
                  <option value="location">Location (A-Z)</option>
                  <option value="salary">Highest Salary</option>
                </select>
              </div>

              {/* Country */}
              <div className="drawer-filter-group">
                <label><Globe size={14} /> Country</label>
                <select
                  value={countryFilter}
                  onChange={e => setCountryFilter(e.target.value)}
                >
                  <option value="">All Countries</option>
                  <option value="India">India</option>
                  <option value="United States">United States</option>
                  <option value="United Kingdom">United Kingdom</option>
                  <option value="Germany">Germany</option>
                  <option value="France">France</option>
                  <option value="Australia">Australia</option>
                  <option value="Canada">Canada</option>
                  <option value="Colombia">Colombia</option>
                  <option value="Romania">Romania</option>
                  <option value="Costa Rica">Costa Rica</option>
                  <option value="Mexico">Mexico</option>
                </select>
              </div>

              {/* Work Mode */}
              <div className="drawer-filter-group">
                <label><Building size={14} /> Work Mode</label>
                <select
                  value={remoteFilter}
                  onChange={e => setRemoteFilter(e.target.value)}
                >
                  <option value="">All Work Modes</option>
                  <option value="REMOTE">Remote</option>
                  <option value="HYBRID">Hybrid</option>
                  <option value="ON_SITE">On-Site</option>
                </select>
              </div>

              {/* Employment Type */}
              <div className="drawer-filter-group">
                <label><Briefcase size={14} /> Employment Type</label>
                <select
                  value={employmentFilter}
                  onChange={e => setEmploymentFilter(e.target.value)}
                >
                  <option value="">All Employment Types</option>
                  <option value="FULL_TIME">Full Time</option>
                  <option value="PART_TIME">Part Time</option>
                  <option value="CONTRACT">Contract</option>
                  <option value="INTERNSHIP">Internship</option>
                </select>
              </div>

              {/* Company */}
              <div className="drawer-filter-group">
                <label><Building size={14} /> Company</label>
                <select
                  value={companyFilter}
                  onChange={e => setCompanyFilter(e.target.value)}
                >
                  <option value="">All Companies</option>
                  {availableCompanies.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Posted Date */}
              <div className="drawer-filter-group">
                <label><Calendar size={14} /> Date Posted</label>
                <select
                  value={postedDateFilter}
                  onChange={e => setPostedDateFilter(e.target.value)}
                >
                  <option value="">Any Time</option>
                  <option value="1">Past 24 Hours</option>
                  <option value="3">Past 3 Days</option>
                  <option value="7">Past Week</option>
                  <option value="14">Past 14 Days</option>
                  <option value="30">Past Month</option>
                </select>
              </div>
            </div>

            <div className="mobile-filter-drawer-actions">
              <Button
                variant="outline"
                onClick={handleResetFilters}
              >
                Reset All
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setIsMobileFilterOpen(false);
                  fetchCanonicalJobs(1);
                }}
              >
                Apply Filters
              </Button>
            </div>
          </div>
        </div>
      )}

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

export default JobsPage;
