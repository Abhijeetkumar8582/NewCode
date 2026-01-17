import React from 'react';

const SkeletonLoader = ({ 
  type = 'text',
  width,
  height,
  count = 1,
  className = '',
  style = {}
}) => {
  const baseStyle = {
    background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    backgroundSize: '200% 100%',
    animation: 'skeleton-loading 1.5s ease-in-out infinite',
    borderRadius: '4px',
    ...style
  };

  const typeStyles = {
    text: {
      height: height || '16px',
      width: width || '100%',
      marginBottom: '8px'
    },
    title: {
      height: height || '24px',
      width: width || '60%',
      marginBottom: '12px'
    },
    avatar: {
      height: height || '40px',
      width: width || '40px',
      borderRadius: '50%'
    },
    button: {
      height: height || '40px',
      width: width || '120px',
      borderRadius: '6px'
    },
    card: {
      height: height || '200px',
      width: width || '100%',
      borderRadius: '8px',
      padding: '16px'
    }
  };

  const skeletonStyle = {
    ...baseStyle,
    ...typeStyles[type]
  };

  const items = Array.from({ length: count }, (_, index) => (
    <div
      key={index}
      className={className}
      style={skeletonStyle}
    />
  ));

  return (
    <>
      <style jsx>{`
        @keyframes skeleton-loading {
          0% {
            background-position: 200% 0;
          }
          100% {
            background-position: -200% 0;
          }
        }
      `}</style>
      {items}
    </>
  );
};

export default SkeletonLoader;


