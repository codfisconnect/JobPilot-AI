import React from 'react';
import { CanonicalJob } from '../../types/job.types';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { MapPin, Briefcase, ExternalLink, Building, DollarSign } from 'lucide-react';

interface JobCardProps {
  job: CanonicalJob;
  onSelect: (job: CanonicalJob) => void;
  onOpenSourceUrl?: (url: string) => void;
}

export const JobCard: React.FC<JobCardProps> = ({ job, onSelect, onOpenSourceUrl }) => {
  const formatSalary = () => {
    if (job.salaryMin && job.salaryMax) {
      return `${job.salaryCurrency || '$'}${Number(job.salaryMin).toLocaleString()} - ${Number(job.salaryMax).toLocaleString()}`;
    }
    if (job.salaryMin) {
      return `From ${job.salaryCurrency || '$'}${Number(job.salaryMin).toLocaleString()}`;
    }
    return 'Salary Not Disclosed';
  };

  const getRemoteBadgeClass = (type: string) => {
    switch (type) {
      case 'REMOTE':
        return 'badge-remote';
      case 'HYBRID':
        return 'badge-hybrid';
      case 'ON_SITE':
        return 'badge-onsite';
      default:
        return 'badge-unknown';
    }
  };

  const getSourceBadgeClass = (sourceType: string) => {
    switch (sourceType.toUpperCase()) {
      case 'CODEWALLA':
        return 'source-codewalla';
      case 'GREENHOUSE':
        return 'source-greenhouse';
      case 'LEVER':
        return 'source-lever';
      case 'ASHBY':
        return 'source-ashby';
      default:
        return 'source-default';
    }
  };

  return (
    <Card className="canonical-job-card" hoverable onClick={() => onSelect(job)}>
      <div className="job-card-header">
        <div className="job-company-info">
          <Building size={16} className="company-icon" />
          <span className="job-company-name">{job.company?.name || 'Company'}</span>
        </div>
        <div className="job-badges-row">
          <span className={`remote-badge ${getRemoteBadgeClass(job.remoteType)}`}>
            {job.remoteType ? job.remoteType.replace('_', ' ') : 'Flexible'}
          </span>
        </div>
      </div>

      <h3 className="job-title-heading">{job.title}</h3>

      <div className="job-meta-details">
        <div className="meta-item">
          <MapPin size={14} />
          <span>{job.location || job.city || 'Location unlisted'}</span>
        </div>
        <div className="meta-item">
          <Briefcase size={14} />
          <span>{job.employmentType.replace('_', ' ')}</span>
        </div>
        {job.salaryMin && (
          <div className="meta-item salary-highlight">
            <DollarSign size={14} />
            <span>{formatSalary()}</span>
          </div>
        )}
      </div>

      {job.skills && job.skills.length > 0 && (
        <div className="job-skills-container">
          {job.skills.slice(0, 4).map(s => (
            <span key={s.id || s.name} className={`job-skill-chip ${s.type === 'REQUIRED' ? 'skill-required' : ''}`}>
              {s.name}
            </span>
          ))}
          {job.skills.length > 4 && (
            <span className="job-skill-chip-more">+{job.skills.length - 4} more</span>
          )}
        </div>
      )}

      <div className="job-card-actions">
        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onSelect(job); }}>
          View Details
        </Button>
        <Button
          variant="primary"
          size="sm"
          icon={<ExternalLink size={14} />}
          onClick={(e) => {
            e.stopPropagation();
            const targetUrl = job.applicationUrl || job.sourceUrl;
            if (onOpenSourceUrl) {
              onOpenSourceUrl(targetUrl);
            } else {
              window.open(targetUrl, '_blank', 'noopener,noreferrer');
            }
          }}
        >
          View / Apply
        </Button>
      </div>
    </Card>
  );
};
