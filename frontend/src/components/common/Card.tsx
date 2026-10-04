import React from 'react';
import './Card.css';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false,
  style
}) => {
  return (
    <div
      className={`card ${hoverable ? 'card-hoverable' : ''} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
};
