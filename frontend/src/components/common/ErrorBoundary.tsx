import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, X } from 'lucide-react';
import { Button } from './Button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
  onClose?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            padding: '24px',
            margin: '16px auto',
            maxWidth: '520px',
            borderRadius: '12px',
            background: 'var(--color-bg-secondary, #1e293b)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
            color: 'var(--color-text-primary, #f8fafc)',
            fontFamily: 'inherit',
            textAlign: 'left'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ef4444',
                flexShrink: 0
              }}
            >
              <AlertCircle size={22} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600 }}>
                {this.props.fallbackTitle || 'Application Agent could not start.'}
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
                {this.state.error?.message || 'An unexpected runtime issue occurred while loading this module.'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            {this.props.onClose && (
              <Button variant="secondary" size="sm" icon={<X size={14} />} onClick={this.props.onClose}>
                Close
              </Button>
            )}
            <Button variant="primary" size="sm" icon={<RotateCcw size={14} />} onClick={this.handleReset}>
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
