import React from 'react';

const LoadingSpinner = ({ 
  size = 'medium', 
  color = '#3b82f6',
  className = '',
  style = {}
}) => {
  const sizeMap = {
    small: '16px',
    medium: '24px',
    large: '32px',
    xl: '48px'
  };

  const spinnerSize = sizeMap[size] || sizeMap.medium;

  return (
    <div
      className={className}
      style={{
        display: 'inline-block',
        width: spinnerSize,
        height: spinnerSize,
        border: `3px solid ${color}20`,
        borderTop: `3px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
        ...style
      }}
    >
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;


