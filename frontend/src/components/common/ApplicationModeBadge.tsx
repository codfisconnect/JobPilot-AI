import React from 'react';
import './ApplicationModeBadge.css';

export interface ApplicationModeBadgeProps {
  mode?: 'demo' | 'external' | string;
  isCodewalla?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ApplicationModeBadge: React.FC<ApplicationModeBadgeProps> = ({
  mode = 'demo',
  isCodewalla = false,
  className = '',
  size = 'md'
}) => {
  const isDemo = isCodewalla || mode?.toLowerCase() === 'demo';

  if (isDemo) {
    return (
      <span className={`app-mode-badge app-mode-demo size-${size} ${className}`} title="Simulated inside JobPilot. Zero submissions to external employers.">
        <span className="mode-dot dot-demo" />
        <span className="mode-text">DEMO APPLICATION</span>
      </span>
    );
  }

  return (
    <span className={`app-mode-badge app-mode-external size-${size} ${className}`} title="Direct career portal link. Submissions happen on the external portal.">
      <span className="mode-dot dot-external" />
      <span className="mode-text">EXTERNAL APPLICATION</span>
    </span>
  );
};
