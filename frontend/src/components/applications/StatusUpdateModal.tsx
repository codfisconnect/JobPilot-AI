import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { ApplicationStatus } from '../../types/applications';
import { ApplicationStatusBadge } from './ApplicationStatusBadge';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import './StatusUpdateModal.css';

interface StatusUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatus: ApplicationStatus;
  onUpdateStatus: (newStatus: ApplicationStatus, reason?: string) => Promise<void>;
}

const ALL_STATUSES: { status: ApplicationStatus; label: string; desc: string }[] = [
  { status: 'SAVED', label: 'Saved', desc: 'Job bookmarked for future review' },
  { status: 'READY_TO_APPLY', label: 'Ready to Apply', desc: 'Tailored resume prepared and reviewed' },
  { status: 'APPLIED', label: 'Applied', desc: 'Application submitted to company' },
  { status: 'ASSESSMENT', label: 'Assessment', desc: 'Take-home assessment or test assigned' },
  { status: 'HR_SCREEN', label: 'HR Screen', desc: 'Initial recruiter phone interview' },
  { status: 'TECHNICAL', label: 'Technical Round', desc: 'Coding, system design, or engineering round' },
  { status: 'FINAL_ROUND', label: 'Final Round', desc: 'Executive or hiring manager panel interview' },
  { status: 'OFFER', label: 'Offer Received', desc: 'Formal offer extended' },
  { status: 'REJECTED', label: 'Rejected', desc: 'Application not moving forward' },
  { status: 'WITHDRAWN', label: 'Withdrawn', desc: 'Candidate withdrew application' }
];

export const StatusUpdateModal: React.FC<StatusUpdateModalProps> = ({
  isOpen,
  onClose,
  currentStatus,
  onUpdateStatus
}) => {
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus>(currentStatus);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setSelectedStatus(currentStatus);
    setReason('');
    setError(null);
  }, [currentStatus, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedStatus === currentStatus) {
      setError('Please select a different status to update.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onUpdateStatus(selectedStatus, reason.trim() || undefined);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update application status.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Application Stage" maxWidth="md">
      <form onSubmit={handleSubmit} className="status-modal-form">
        <div className="current-status-banner">
          <span className="banner-label">Current Stage:</span>
          <ApplicationStatusBadge status={currentStatus} size="md" />
        </div>

        {error && (
          <div className="status-modal-error">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="status-options-list">
          <label className="section-label">Select New Stage:</label>
          <div className="status-grid">
            {ALL_STATUSES.map(item => {
              const isSelected = selectedStatus === item.status;
              const isCurrent = currentStatus === item.status;

              return (
                <div
                  key={item.status}
                  className={`status-option-card ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
                  onClick={() => setSelectedStatus(item.status)}
                >
                  <div className="status-card-header">
                    <span className="status-card-title">{item.label}</span>
                    {isSelected && <CheckCircle2 size={16} className="selected-check" />}
                  </div>
                  <span className="status-card-desc">{item.desc}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="reason-field">
          <label className="section-label" htmlFor="status-reason">
            Reason or Context Note (Optional):
          </label>
          <textarea
            id="status-reason"
            className="reason-textarea"
            placeholder="e.g. Received recruiter email to schedule screen, Completed take home challenge..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={2}
          />
        </div>

        <div className="status-modal-actions">
          <button
            type="button"
            className="btn-cancel"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-save-status"
            disabled={submitting || selectedStatus === currentStatus}
          >
            {submitting ? 'Updating...' : 'Update Stage'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
