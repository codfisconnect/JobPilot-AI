import React from 'react';
import { useApp } from '../context/AppContext';
import { Button } from '../components/common/Button';
import { Upload, Bell, Sparkles } from 'lucide-react';
import './TopBar.css';

interface TopBarProps {
  onOpenUpload: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenUpload }) => {
  const { activeCandidate } = useApp();

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <h1 className="topbar-title">JobPilot Application Workspace</h1>
        <p className="topbar-sub">
          Active: <span className="highlight-name">{activeCandidate?.name || 'No Profile'}</span>
          {activeCandidate && ` • ${activeCandidate.yearsOfExperience} yrs exp • ${activeCandidate.targetRoles[0] || ''}`}
        </p>
      </div>

      <div className="topbar-actions">
        <Button
          variant="secondary"
          size="sm"
          icon={<Upload size={15} />}
          onClick={onOpenUpload}
        >
          Upload Resume
        </Button>
      </div>
    </header>
  );
};
