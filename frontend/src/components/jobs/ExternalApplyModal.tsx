import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api } from '../../api/index';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import {
  ExternalLink,
  Mail,
  CheckCircle2,
  AlertTriangle,
  Building,
  Heart,
  Clock,
  ArrowRight,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import './JobApplyModals.css';

interface ExternalApplyModalProps {
  job: any;
  isOpen: boolean;
  onClose: () => void;
  onConfirmApplied?: (application: any) => void;
}

export const ExternalApplyModal: React.FC<ExternalApplyModalProps> = ({
  job,
  isOpen,
  onClose,
  onConfirmApplied
}) => {
  const { user } = useAuth();
  const { activeCandidate, showToast } = useApp();

  const [step, setStep] = useState<'redirect' | 'confirmation' | 'done'>('redirect');
  const [followCompany, setFollowCompany] = useState<boolean>(true);
  const [emailSent, setEmailSent] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedStatus, setConfirmedStatus] = useState<string>('');

  if (!isOpen || !job) return null;

  const candidateId = activeCandidate?.id || user?.id || 'cand-default-aarav';
  const companyName = job.company?.name || job.company || 'Employer';
  const targetUrl = job.applicationUrl || job.sourceUrl || job.company?.careersUrl || 'https://careers.google.com';

  const handleSendToEmail = async () => {
    try {
      setIsSubmitting(true);
      await api.trackExternal({
        jobId: job.id,
        candidateId,
        externalUrl: targetUrl,
        sentToEmail: true,
        notes: `Candidate requested job details via email at ${new Date().toLocaleTimeString()}`
      });
      setEmailSent(true);
      if (showToast) {
        showToast('Job details sent to your registered email!');
      }
    } catch (err: any) {
      if (showToast) {
        showToast(err.message || 'Could not send email');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProceedToWebsite = async () => {
    try {
      // Follow company if checked
      if (followCompany) {
        api.followCompany(candidateId, companyName).catch(() => {});
      }

      // Record external redirection click (initial status remains strictly 'Ready to Apply' / 'Visited')
      api.trackExternal({
        jobId: job.id,
        candidateId,
        externalUrl: targetUrl,
        sentToEmail: emailSent
      }).catch(() => {});

      // Open company website in a new tab
      window.open(targetUrl, '_blank', 'noopener,noreferrer');

      // Transition modal to confirmation prompt for when the user returns
      setStep('confirmation');
    } catch {
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      setStep('confirmation');
    }
  };

  const handleConfirmApplication = async (didApply: boolean) => {
    try {
      setIsSubmitting(true);
      const app = await api.trackExternal({
        jobId: job.id,
        candidateId,
        externalUrl: targetUrl,
        confirmedApplied: didApply,
        notes: didApply ? 'Candidate confirmed external submission' : 'Candidate marked apply later'
      });

      setConfirmedStatus(didApply ? 'Applied' : 'Saved for Later');
      setStep('done');

      if (showToast) {
        showToast(
          didApply ? 'Marked as Applied! Tracked in your applications.' : 'Saved in your applications pipeline.'
        );
      }

      if (onConfirmApplied) {
        onConfirmApplied(app);
      }
    } catch (err: any) {
      if (showToast) {
        showToast(err.message || 'Error updating status');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="External Application Redirection" maxWidth="md">
      <div className="external-apply-container">
        {step === 'redirect' && (
          <div className="ext-step-redirect">
            <div className="ext-icon-row">
              <div className="ext-icon-circle">
                <ExternalLink size={26} />
              </div>
            </div>

            <h3 className="ext-main-title">You will be taken to the company's website</h3>

            <p className="ext-main-desc">
              You are applying for <strong>{job.title || job.role}</strong> directly on{' '}
              <strong>{companyName}</strong>'s official career portal.
            </p>

            <div className="ext-disclaimer-box">
              <ShieldAlert size={18} className="disclaimer-icon" />
              <div className="disclaimer-text">
                Please note that JobPilot is an aggregator and is not responsible for the information you share on the employer's external platform.
              </div>
            </div>

            {/* Options */}
            <div className="ext-options-card">
              <label className="ext-checkbox-label">
                <input
                  type="checkbox"
                  checked={followCompany}
                  onChange={e => setFollowCompany(e.target.checked)}
                />
                <span className="checkbox-text">
                  Follow <strong>{companyName}</strong> to receive notifications of new openings
                </span>
              </label>
            </div>

            <div className="ext-actions-row">
              <Button
                variant="outline"
                onClick={handleSendToEmail}
                disabled={isSubmitting || emailSent}
                icon={<Mail size={16} />}
              >
                {emailSent ? 'Job Sent to Email' : 'Get Job on Email'}
              </Button>

              <Button
                variant="primary"
                onClick={handleProceedToWebsite}
                disabled={isSubmitting}
                icon={<ExternalLink size={16} />}
              >
                Proceed to Company Website
              </Button>
            </div>
          </div>
        )}

        {step === 'confirmation' && (
          <div className="ext-step-confirmation">
            <div className="ext-icon-circle waiting">
              <Clock size={28} />
            </div>

            <h3 className="ext-main-title">Did you complete your application?</h3>
            <p className="ext-main-desc">
              We opened <strong>{companyName}</strong>'s career portal in a new browser tab. Let JobPilot know your status to keep your tracker accurate.
            </p>

            <div className="ext-confirm-buttons">
              <Button
                variant="primary"
                onClick={() => handleConfirmApplication(true)}
                disabled={isSubmitting}
                icon={<CheckCircle2 size={16} />}
              >
                Yes, I Applied
              </Button>

              <Button
                variant="outline"
                onClick={() => handleConfirmApplication(false)}
                disabled={isSubmitting}
              >
                Apply Later
              </Button>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="ext-step-done">
            <div className="ext-icon-circle done">
              <CheckCircle2 size={36} />
            </div>

            <h3 className="ext-main-title">Status Updated</h3>
            <p className="ext-main-desc">
              This job has been logged as <strong>{confirmedStatus}</strong> in your Application Tracker.
            </p>

            <div className="ext-actions-center">
              <Button variant="primary" onClick={onClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
