/**
 * Loading State Management
 * Centralized loading state management using React Context
 */
import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';

const LoadingContext = createContext(null);

export const LoadingProvider = ({ children }) => {
  const [loadingStates, setLoadingStates] = useState(new Map());
  const [globalLoading, setGlobalLoading] = useState(false);
  const loadingTimeouts = useRef(new Map());

  const setLoading = useCallback((key, isLoading, timeout = 30000) => {
    setLoadingStates(prev => {
      const next = new Map(prev);
      if (isLoading) {
        next.set(key, { isLoading: true, startTime: Date.now() });
        
        // Set timeout to warn if loading takes too long
        if (timeout > 0) {
          const timeoutId = setTimeout(() => {
            setLoadingStates(current => {
              const updated = new Map(current);
              const state = updated.get(key);
              if (state && state.isLoading) {
                updated.set(key, { ...state, isLongRunning: true });
                return updated;
              }
              return current;
            });
          }, timeout);
          
          loadingTimeouts.current.set(key, timeoutId);
        }
      } else {
        next.delete(key);
        
        // Clear timeout if exists
        const timeoutId = loadingTimeouts.current.get(key);
        if (timeoutId) {
          clearTimeout(timeoutId);
          loadingTimeouts.current.delete(key);
        }
      }
      
      // Update global loading state
      const hasAnyLoading = next.size > 0;
      setGlobalLoading(hasAnyLoading);
      
      return next;
    });
  }, []);

  const isLoading = useCallback((key) => {
    return loadingStates.has(key) && loadingStates.get(key).isLoading;
  }, [loadingStates]);

  const getLoadingState = useCallback((key) => {
    return loadingStates.get(key) || { isLoading: false };
  }, [loadingStates]);

  const clearAll = useCallback(() => {
    // Clear all timeouts
    loadingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
    loadingTimeouts.current.clear();
    
    setLoadingStates(new Map());
    setGlobalLoading(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      loadingTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      loadingTimeouts.current.clear();
    };
  }, []);

  return (
    <LoadingContext.Provider
      value={{
        setLoading,
        isLoading,
        getLoadingState,
        clearAll,
        globalLoading,
        loadingCount: loadingStates.size
      }}
    >
      {children}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (!context) {
    throw new Error('useLoading must be used within LoadingProvider');
  }
  return context;
};

export const useLoadingState = (key, timeout = 30000) => {
  const { setLoading, isLoading, getLoadingState } = useLoading();
  
  const startLoading = useCallback(() => {
    setLoading(key, true, timeout);
  }, [key, setLoading, timeout]);
  
  const stopLoading = useCallback(() => {
    setLoading(key, false);
  }, [key, setLoading]);
  
  const loading = isLoading(key);
  const state = getLoadingState(key);
  
  return {
    loading,
    startLoading,
    stopLoading,
    isLongRunning: state.isLongRunning || false,
    duration: loading && state.startTime ? Date.now() - state.startTime : 0
  };
};


