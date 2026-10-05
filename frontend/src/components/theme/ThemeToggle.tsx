import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import './ThemeToggle.css';

interface ThemeToggleProps {
  className?: string;
  showLabel?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  className = '',
  showLabel = false
}) => {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <button
      type="button"
      className={`theme-toggle-btn ${className}`}
      onClick={toggleTheme}
      title={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
      aria-label={`Switch to ${isLight ? 'Dark' : 'Light'} Mode`}
      aria-pressed={isLight}
    >
      <div className="theme-toggle-track">
        <span className={`theme-toggle-icon icon-sun ${isLight ? 'icon-active' : ''}`}>
          <Sun size={15} />
        </span>
        <span className={`theme-toggle-icon icon-moon ${!isLight ? 'icon-active' : ''}`}>
          <Moon size={15} />
        </span>
        <span className={`theme-toggle-slider ${isLight ? 'slider-light' : 'slider-dark'}`} />
      </div>
      {showLabel && (
        <span className="theme-toggle-text">
          {isLight ? 'Light Mode' : 'Dark Mode'}
        </span>
      )}
    </button>
  );
};
