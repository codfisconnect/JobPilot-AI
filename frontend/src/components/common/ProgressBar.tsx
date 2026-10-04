import React from 'react';
import './ProgressBar.css';

interface ProgressBarProps {
  value: number; // 0 to 100
  label?: string;
  showValue?: boolean;
  color?: 'emerald' | 'blue' | 'amber' | 'rose' | 'indigo';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  label,
  showValue = true,
  color = 'indigo'
}) => {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className="progress-container">
      {(label || showValue) && (
        <div className="progress-header">
          {label && <span className="progress-label">{label}</span>}
          {showValue && <span className="progress-value">{clamped}%</span>}
        </div>
      )}
      <div className="progress-track">
        <div
          className={`progress-fill progress-fill-${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
};
