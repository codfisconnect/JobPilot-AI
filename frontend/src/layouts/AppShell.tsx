import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { UploadCloud, CheckCircle, AlertCircle } from 'lucide-react';
import { api } from '../api';
import { useApp } from '../context/AppContext';
import './AppShell.css';

interface AppShellProps {
  children: React.ReactNode;
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  currentTab,
  onSelectTab
}) => {
  const { refreshCandidates, setActiveCandidate, showToast, toastMessage } = useApp();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Prevent background scrolling when mobile navigation drawer is open & support Escape key
  React.useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsMobileMenuOpen(false);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [isMobileMenuOpen]);

  const handleUpload = async () => {
    if (!uploadFile) return;
    try {
      setIsUploading(true);
      setUploadError(null);
      const newCand = await api.uploadResume(uploadFile);
      await refreshCandidates();
      setActiveCandidate(newCand);
      setIsUploadOpen(false);
      setUploadFile(null);
      showToast(`Master profile successfully extracted for ${newCand.name}!`);
      onSelectTab('profile');
    } catch (err: any) {
      setUploadError(err.message || 'Failed to upload and parse resume');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={onSelectTab}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      <div className="app-main-viewport">
        <TopBar
          onOpenUpload={() => setIsUploadOpen(true)}
          isMobileMenuOpen={isMobileMenuOpen}
          onToggleMobileMenu={() => setIsMobileMenuOpen(prev => !prev)}
        />
        <main className="app-page-content">{children}</main>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="app-toast">
          <CheckCircle size={18} className="toast-icon" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Resume Upload Modal */}
      <Modal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Candidate Master Resume"
      >
        <div className="upload-modal-content">
          <p className="upload-desc">
            Upload your master resume in PDF or DOCX format. Pilot Mama will extract your complete work history, verified technologies, and credentials without fabricating skills.
          </p>

          <label className="upload-dropzone">
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="dropzone-input"
              onChange={e => {
                if (e.target.files?.[0]) setUploadFile(e.target.files[0]);
              }}
            />
            <UploadCloud size={44} className="dropzone-icon" />
            <span className="dropzone-text">
              {uploadFile ? uploadFile.name : 'Click to select or drag PDF / DOCX file here'}
            </span>
            <span className="dropzone-sub">Supports PDF and Word up to 10MB</span>
          </label>

          {uploadError && (
            <div className="upload-error">
              <AlertCircle size={16} />
              <span>{uploadError}</span>
            </div>
          )}

          <div className="upload-actions">
            <Button variant="secondary" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!uploadFile}
              loading={isUploading}
              onClick={handleUpload}
            >
              Parse Resume & Create Profile
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
