import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import './PilotMamaLogo.css';

interface PilotMamaLogoProps {
  variant?: 'full' | 'icon';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const PilotMamaLogo: React.FC<PilotMamaLogoProps> = ({
  variant = 'full',
  size = 'md',
  className = ''
}) => {
  const { theme } = useTheme();
  const isLight = theme === 'light';

  if (variant === 'icon') {
    const iconSrc = isLight
      ? '/brand/pilot-mama-icon-light.png'
      : '/brand/pilot-mama-icon-dark.png';

    return (
      <img
        src={iconSrc}
        alt="Pilot Mama"
        className={`pilot-mama-icon size-${size} ${className}`}
        loading="eager"
      />
    );
  }

  const logoSrc = isLight
    ? '/brand/pilot-mama-logo-light.png'
    : '/brand/pilot-mama-logo-dark.png';

  return (
    <div className={`pilot-mama-logo-wrap size-${size} ${className}`}>
      <img
        src={logoSrc}
        alt="Pilot Mama — AI Job Application Copilot"
        className={`pilot-mama-logo-img ${isLight ? 'logo-light-mode' : 'logo-dark-mode'}`}
        loading="eager"
      />
    </div>
  );
};
