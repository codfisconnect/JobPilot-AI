import React from 'react';
import { Modal } from '../common/Modal';
import { NaukriJobDetail } from './NaukriJobDetail';

interface JobDetailModalProps {
  job: any | null;
  isOpen: boolean;
  onClose: () => void;
  onAnalyzeFit?: (jobId: string) => void;
  onApply?: (jobId: string) => void;
}

export const JobDetailModal: React.FC<JobDetailModalProps> = ({
  job,
  isOpen,
  onClose,
  onAnalyzeFit
}) => {
  if (!job) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${job.title || job.role} • ${job.company?.name || job.company}`}
      maxWidth="xl"
    >
      <NaukriJobDetail job={job} onClose={onClose} onAnalyzeFit={onAnalyzeFit} />
    </Modal>
  );
};
