import React from 'react';
import './BentoGrid.css';

export interface BentoGridProps {
  children: React.ReactNode;
  className?: string;
}

export const BentoGrid: React.FC<BentoGridProps> = ({ children, className = '' }) => {
  return <div className={`bento-grid ${className}`}>{children}</div>;
};

export interface BentoTileProps {
  children: React.ReactNode;
  className?: string;
  size?: 'large' | 'medium' | 'small' | 'full';
  spanCols?: number; // 1 to 12 if custom span
  spanRows?: number;
  hoverable?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export const BentoTile: React.FC<BentoTileProps> = ({
  children,
  className = '',
  size = 'medium',
  spanCols,
  spanRows,
  hoverable = false,
  onClick,
  style = {}
}) => {
  const dynamicStyles: React.CSSProperties = { ...style };
  if (spanCols) {
    dynamicStyles.gridColumn = `span ${spanCols}`;
  }
  if (spanRows) {
    dynamicStyles.gridRow = `span ${spanRows}`;
  }

  return (
    <div
      className={`bento-tile bento-tile-${size} ${hoverable ? 'bento-tile-hoverable' : ''} ${className}`}
      onClick={onClick}
      style={dynamicStyles}
    >
      {children}
    </div>
  );
};
