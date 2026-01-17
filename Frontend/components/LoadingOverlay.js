import React from 'react';
import LoadingSpinner from './LoadingSpinner';

const LoadingOverlay = ({ 
  isLoading, 
  message = 'Loading...',
  fullPage = false,
  transparent = false
}) => {
  if (!isLoading) return null;

  const overlayStyle = {
    position: fullPage ? 'fixed' : 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: transparent ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    backdropFilter: 'blur(2px)'
  };

  return (
    <div style={overlayStyle}>
      <LoadingSpinner size="large" />
      {message && (
        <p style={{
          marginTop: '16px',
          fontSize: '14px',
          color: '#6b7280',
          fontWeight: '500'
        }}>
          {message}
        </p>
      )}
    </div>
  );
};

export default LoadingOverlay;


