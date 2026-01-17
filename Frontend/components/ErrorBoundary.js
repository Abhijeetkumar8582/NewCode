import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null,
      errorHistory: [],
      showDetails: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Store error in state
    this.setState({
      errorInfo: errorInfo,
      errorHistory: [
        ...this.state.errorHistory.slice(-9), // Keep last 10 errors
        {
          error: error.toString(),
          errorInfo: errorInfo.componentStack,
          timestamp: new Date().toISOString()
        }
      ]
    });
    
    // Send error to backend in production
    if (process.env.NODE_ENV === 'production') {
      this.reportError(error, errorInfo);
    }
  }

  componentDidMount() {
    // Catch unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    
    // Catch console errors
    const originalError = console.error;
    console.error = (...args) => {
      originalError.apply(console, args);
      // Could log to backend here if needed
    };
  }

  componentWillUnmount() {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
  }

  handleUnhandledRejection = (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    // Could show error boundary for critical promise rejections
  };

  reportError = async (error, errorInfo) => {
    try {
      // Try to send error to backend logging endpoint
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9001';
      await fetch(`${API_BASE_URL}/api/errors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: error.toString(),
          stack: error.stack,
          componentStack: errorInfo?.componentStack,
          userAgent: navigator.userAgent,
          url: window.location.href,
          timestamp: new Date().toISOString()
        })
      }).catch(() => {
        // Silently fail if backend is unavailable
      });
    } catch (e) {
      // Silently fail
      console.warn('Failed to report error:', e);
    }
  };

  handleRetry = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null,
      showDetails: false
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    // Clear localStorage and reload
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = '/';
  };

  getErrorType = () => {
    const { error } = this.state;
    if (!error) return 'unknown';
    
    const errorMessage = error.toString().toLowerCase();
    
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'network';
    }
    if (errorMessage.includes('chunk') || errorMessage.includes('loading')) {
      return 'loading';
    }
    if (errorMessage.includes('permission') || errorMessage.includes('access')) {
      return 'permission';
    }
    return 'application';
  };

  getErrorMessage = () => {
    const errorType = this.getErrorType();
    
    const messages = {
      network: {
        title: 'Connection Error',
        description: 'Unable to connect to the server. Please check your internet connection and try again.',
        action: 'Retry Connection'
      },
      loading: {
        title: 'Loading Error',
        description: 'Failed to load required resources. This might be a temporary issue.',
        action: 'Reload Page'
      },
      permission: {
        title: 'Access Denied',
        description: 'You don\'t have permission to access this resource.',
        action: 'Go Home'
      },
      application: {
        title: 'Something went wrong',
        description: 'An unexpected error occurred. Our team has been notified.',
        action: 'Try Again'
      }
    };
    
    return messages[errorType] || messages.application;
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, showDetails, errorHistory } = this.state;
      const errorMessage = this.getErrorMessage();
      
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px',
          padding: '40px 20px',
          textAlign: 'center',
          background: '#f9fafb'
        }}>
          <div style={{
            maxWidth: '600px',
            width: '100%',
            background: '#ffffff',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e5e7eb'
          }}>
            {/* Error Icon */}
            <div style={{
              fontSize: '64px',
              marginBottom: '24px'
            }}>
              ⚠️
            </div>
            
            {/* Error Title */}
            <h2 style={{
              fontSize: '24px',
              fontWeight: '700',
              color: '#111827',
              margin: '0 0 12px 0'
            }}>
              {errorMessage.title}
            </h2>
            
            {/* Error Description */}
            <p style={{
              fontSize: '16px',
              color: '#6b7280',
              margin: '0 0 32px 0',
              lineHeight: '1.6'
            }}>
              {errorMessage.description}
            </p>
            
            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginBottom: '24px'
            }}>
              <button
                onClick={this.handleRetry}
                style={{
                  padding: '12px 24px',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
              >
                {errorMessage.action}
              </button>
              
              <button
                onClick={this.handleReload}
                style={{
                  padding: '12px 24px',
                  background: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#4b5563'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#6b7280'}
              >
                Reload Page
              </button>
              
              {this.getErrorType() === 'application' && (
                <button
                  onClick={this.handleReset}
                  style={{
                    padding: '12px 24px',
                    background: '#ef4444',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#dc2626'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#ef4444'}
                >
                  Reset App
                </button>
              )}
            </div>
            
            {/* Error Details Toggle (for developers) */}
            {(process.env.NODE_ENV === 'development' || showDetails) && (
              <div style={{
                marginTop: '24px',
                padding: '16px',
                background: '#f3f4f6',
                borderRadius: '8px',
                textAlign: 'left'
              }}>
                <button
                  onClick={() => this.setState({ showDetails: !showDetails })}
                  style={{
                    width: '100%',
                    padding: '8px',
                    background: 'transparent',
                    border: 'none',
                    color: '#6b7280',
                    fontSize: '12px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginBottom: showDetails ? '12px' : '0'
                  }}
                >
                  {showDetails ? '▼' : '▶'} Error Details {showDetails ? '(Click to hide)' : '(Click to show)'}
                </button>
                
                {showDetails && (
                  <div style={{
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    color: '#374151',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '300px',
                    overflow: 'auto'
                  }}>
                    <div style={{ marginBottom: '12px', fontWeight: '600' }}>Error:</div>
                    <div style={{ marginBottom: '16px', color: '#dc2626' }}>
                      {error?.toString() || 'Unknown error'}
                    </div>
                    
                    {error?.stack && (
                      <>
                        <div style={{ marginBottom: '12px', fontWeight: '600' }}>Stack Trace:</div>
                        <div style={{ marginBottom: '16px', color: '#6b7280' }}>
                          {error.stack}
                        </div>
                      </>
                    )}
                    
                    {errorInfo?.componentStack && (
                      <>
                        <div style={{ marginBottom: '12px', fontWeight: '600' }}>Component Stack:</div>
                        <div style={{ color: '#6b7280' }}>
                          {errorInfo.componentStack}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
            
            {/* Error History (if available) */}
            {errorHistory.length > 0 && (
              <div style={{
                marginTop: '16px',
                padding: '12px',
                background: '#fef3c7',
                borderRadius: '6px',
                fontSize: '12px',
                color: '#92400e'
              }}>
                <strong>Note:</strong> This is error #{errorHistory.length} in this session.
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
