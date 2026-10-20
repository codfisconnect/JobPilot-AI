import React from 'react';
import './ApplicationModeBadge.css';

export interface ApplicationModeBadgeProps {
  mode?: 'demo' | 'external' | 'agent' | 'assisted' | string;
  isCodewalla?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ApplicationModeBadge: React.FC<ApplicationModeBadgeProps> = ({
  mode = 'agent',
  isCodewalla = false,
  className = '',
  size = 'md'
}) => {
  const isDemo = isCodewalla || mode?.toLowerCase() === 'demo';

  if (isDemo) {
    return (
      <span className={`app-mode-badge app-mode-demo size-${size} ${className}`} title="Simulated inside Pilot Mama. Zero submissions to external employers.">
        <span className="mode-dot dot-demo" />
        <span className="mode-text">DEMO APPLICATION</span>
      </span>
    );
  }

  const normalizedMode = mode?.toLowerCase();
  if (normalizedMode === 'agent' || normalizedMode === 'assisted' || normalizedMode === 'internal_automation' || normalizedMode === 'external') {
    return (
      <span className={`app-mode-badge app-mode-agent size-${size} ${className}`} title="Managed candidate workflow orchestrated by Pilot Mama Application Agent.">
        <span className="mode-dot dot-agent" />
        <span className="mode-text">APPLICATION AGENT</span>
      </span>
    );
  }

  return (
    <span className={`app-mode-badge app-mode-external size-${size} ${className}`} title="Direct career portal link. Submissions happen on the external portal.">
      <span className="mode-dot dot-external" />
      <span className="mode-text">EXTERNAL PORTAL</span>
    </span>
  );
};

