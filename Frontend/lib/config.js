/**
 * Frontend Configuration
 * Configuration constants for retry logic, offline detection, etc.
 */

export const RETRY_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
  retryableErrors: ['ECONNABORTED', 'ERR_NETWORK', 'ECONNREFUSED', 'ETIMEDOUT']
};

export const LOADING_CONFIG = {
  defaultTimeout: 30000, // 30 seconds
  longRunningThreshold: 10000 // 10 seconds
};

