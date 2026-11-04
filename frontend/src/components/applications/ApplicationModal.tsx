import React from 'react';
import { ApplyDialog, type ApplyDialogProps } from './ApplyDialog';
import type { JobDescription } from '../../types';
import type { CanonicalJob } from '../../types/job.types';

export interface ApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  job: JobDescription | CanonicalJob | any;
  candidate?: any;
  tailoredResume?: any;
  matchAnalysis?: any;
  onSuccess?: (app: any) => void;
  onNavigateToResumes?: (resumeId?: string) => void;
  onNavigateToApplications?: (appId?: string) => void;
  onNavigateToLearning?: () => void;
}

/**
 * ApplicationModal (One-Click Apply Modal)
 * Replaces the legacy 4-step wizard with the streamlined, compact ApplyDialog experience.
 */
export const ApplicationModal: React.FC<ApplicationModalProps> = ({
  isOpen,
  onClose,
  job,
  candidate,
  onSuccess,
  onNavigateToApplications
}) => {
  return (
    <ApplyDialog
      isOpen={isOpen}
      onClose={onClose}
      job={job}
      candidate={candidate}
      onSuccess={onSuccess}
      onNavigateToApplications={onNavigateToApplications}
    />
  );
};

export { ApplyDialog };
