import React, { useState, useEffect } from 'react';
import { useApp } from "../context/AppContext";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { Badge } from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import { api } from "../api/index";
import { JobDescription } from "../types/index";
import {
  Briefcase,
  Search,
  Plus,
  Globe,
  FileText,
  MapPin,
  Clock,
  ArrowRight,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { ApplicationModeBadge } from "../components/common/ApplicationModeBadge";
import './JobsPage.css';

interface JobsPageProps {
  onSelectJobForAnalysis: (jobId: string) => void;
  preselectedJobId?: string;
}

export const JobsPage: React.FC<JobsPageProps> = ({
  onSelectJobForAnalysis,
  preselectedJobId
}) => {
  const { activeCandidate } = useApp();
  const [jobs, setJobs] = useState<JobDescription[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTrack, setFilterTrack] = useState('All');
  const [filterSource, setFilterSource] = useState<'All' | 'Predefined' | 'Codewalla'>('All');
  const [isSyncing, setIsSyncing] = useState(false);

  // Input Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [inputTab, setInputTab] = useState<'paste' | 'url'>('paste');
  const [pastedJD, setPastedJD] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchJobs = async () => {
    try {
      const list = await api.getJobs();
      setJobs(list);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSyncCodewalla = async () => {
    try {
      setIsSyncing(true);
      await api.syncJobSource('codewalla');
      await fetchJobs();
    } catch (err) {
      console.error('Failed to sync Codewalla jobs:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    if (preselectedJobId && jobs.length > 0) {
      onSelectJobForAnalysis(preselectedJobId);
    }
  }, [preselectedJobId, jobs]);

  const handleAddJob = async () => {
    setErrorMessage(null);
    setIsProcessing(true);

    try {
      if (inputTab === 'paste') {
        if (!pastedJD.trim()) {
          setErrorMessage('Please paste the job description text.');
          setIsProcessing(false);
          return;
        }
        const created = await api.parseJob(pastedJD, 'pasted');
        await fetchJobs();
        setIsAddModalOpen(false);
        setPastedJD('');
        onSelectJobForAnalysis(created.id);
      } else {
        if (!jobUrl.trim()) {
          setErrorMessage('Please enter a valid job URL.');
          setIsProcessing(false);
          return;
        }
        const res = await api.extractJobUrl(jobUrl);
        if (!res.success && res.fallbackRequired) {
          setErrorMessage('Unable to reliably extract this job page. Paste the job description instead.');
          setInputTab('paste');
          setIsProcessing(false);
          return;
        }
        if (res.data) {
          await fetchJobs();
          setIsAddModalOpen(false);
          setJobUrl('');
          onSelectJobForAnalysis(res.data.id);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process job opportunity');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtered jobs
  const filtered = jobs.filter(j => {
    const matchesSearch =
      j.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.mustHaveSkills.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesTrack =
      filterTrack === 'All' || j.careerTrack.toLowerCase().includes(filterTrack.toLowerCase());

    const matchesSource =
      filterSource === 'All'
        ? true
        : filterSource === 'Codewalla'
        ? j.source === 'Codewalla' || j.isExternal === true
        : !j.isExternal && j.source !== 'Codewalla';

    return matchesSearch && matchesTrack && matchesSource;
  });

  const tracks = ['All', 'QA Automation', 'Java Backend', 'Full Stack', 'Data Analytics', 'DevOps'];
  const sources: ('All' | 'Predefined' | 'Codewalla')[] = ['All', 'Predefined', 'Codewalla'];

  return (
    <div className="jobs-page">
      {/* Header and Controls */}
      <div className="jobs-header-row">
        <div>
          <h2 className="jobs-page-title">Jobs & Opportunities Catalog</h2>
          <p className="jobs-page-sub">
            Review live Codewalla and predefined opportunities. Run deep truth checking, ATS simulation, and resume tailoring.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="outline"
            icon={<Sparkles size={16} />}
            loading={isSyncing}
            onClick={handleSyncCodewalla}
          >
            {isSyncing ? 'Syncing...' : 'Sync Codewalla Jobs'}
          </Button>

          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setIsAddModalOpen(true)}
          >
            Add / Analyze New Job
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="search-filter-bar">
        <div className="search-input-wrap">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by role, company, or technology..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="track-pills" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Source:</span>
          {sources.map(s => (
            <button
              key={s}
              className={`track-pill ${filterSource === s ? 'track-pill-active' : ''}`}
              onClick={() => setFilterSource(s)}
            >
              {s === 'Codewalla' ? '🌐 Codewalla' : s === 'Predefined' ? '💼 Predefined' : 'All Sources'}
            </button>
          ))}
        </div>

        <div className="track-pills">
          {tracks.map(t => (
            <button
              key={t}
              className={`track-pill ${filterTrack === t ? 'track-pill-active' : ''}`}
              onClick={() => setFilterTrack(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Jobs Grid */}
      <div className="jobs-grid-display">
        {filtered.map(job => {
          // Check candidate match heuristic indicator
          const candSkills = activeCandidate?.primarySkills || [];
          const matches = job.mustHaveSkills.filter(s => candSkills.includes(s));
          const matchPercent = Math.round((matches.length / Math.max(1, job.mustHaveSkills.length)) * 100);

          return (
            <Card
              key={job.id}
              className="job-item-card"
              hoverable
              onClick={() => onSelectJobForAnalysis(job.id)}
            >
              <div className="job-top-meta">
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span className="job-company-pill">{job.company}</span>
                  <ApplicationModeBadge
                    mode={job.applicationMode}
                    isCodewalla={job.company.toLowerCase().includes('codewalla') || (job.source || '').toLowerCase().includes('codewalla')}
                    size="sm"
                  />
                  {job.source && (
                    <span style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: job.source === 'Codewalla' ? 'rgba(99, 102, 241, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                      color: job.source === 'Codewalla' ? '#818cf8' : 'var(--text-muted)',
                      border: `1px solid ${job.source === 'Codewalla' ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                      fontWeight: 600
                    }}>
                      Source: {job.source}
                    </span>
                  )}
                </div>
                <Badge
                  variant={
                    matchPercent >= 70 ? 'emerald' : matchPercent >= 40 ? 'blue' : 'amber'
                  }
                  size="sm"
                >
                  ~{matchPercent}% Skill Overlap
                </Badge>
              </div>

              <h3 className="job-title-text">{job.role}</h3>

              <div className="job-details-row">
                <span><MapPin size={13} /> {job.location}</span>
                <span><Clock size={13} /> {job.experienceRequired}</span>
              </div>

              <div className="job-tags-list">
                {job.mustHaveSkills.map(skill => {
                  const isVerified = candSkills.includes(skill);
                  return (
                    <span
                      key={skill}
                      className={`job-skill-chip ${isVerified ? 'skill-verified' : ''}`}
                    >
                      {skill} {isVerified && '✓'}
                    </span>
                  );
                })}
              </div>

              <div className="job-footer-row">
                <span className="job-salary">{job.salary || 'Competitive'}</span>
                <span className="analyze-action">
                  Launch AI Analysis <ArrowRight size={14} />
                </span>
              </div>
            </Card>
          );
        })}
      </div>

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
              onClick={() => { setInputTab('paste'); setErrorMessage(null); }}
            >
              <FileText size={16} /> Paste Job Description (Method A)
            </button>
            <button
              className={`tab-btn ${inputTab === 'url' ? 'tab-btn-active' : ''}`}
              onClick={() => { setInputTab('url'); setErrorMessage(null); }}
            >
              <Globe size={16} /> Public Job URL (Method B)
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
                JobPilot will securely inspect visible public page content. If blocked by authentication or anti-bot defenses, it will safely provide a paste-fallback.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="modal-error-notice">
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
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
              Analyze with JobPilot
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
