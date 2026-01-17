/**
 * Data cache utility for storing API responses
 * Prevents unnecessary API calls when navigating between pages
 */

const CACHE_DURATION = {
  DASHBOARD_STATS: 5 * 60 * 1000, // 5 minutes
  VIDEO_LIST: 2 * 60 * 1000, // 2 minutes
  DOCUMENT_DATA: 10 * 60 * 1000, // 10 minutes (document data rarely changes)
  USER_DATA: 5 * 60 * 1000, // 5 minutes
  DEFAULT: 2 * 60 * 1000 // 2 minutes default
};

class DataCache {
  constructor() {
    this.cache = new Map();
    // Auto-cleanup expired entries periodically (only on client-side)
    if (typeof window !== 'undefined') {
      this.cleanupInterval = setInterval(() => {
        this.cleanup();
      }, 60000); // Cleanup every minute
    }
  }

  /**
   * Cleanup expired cache entries
   */
  cleanup() {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cached data if it exists and is not expired
   * @param {string} key - Cache key
   * @returns {any|null} - Cached data or null if expired/not found
   */
  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now > cached.expiresAt) {
      // Cache expired, remove it
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set data in cache
   * @param {string} key - Cache key
   * @param {any} data - Data to cache
   * @param {number} duration - Cache duration in milliseconds
   */
  set(key, data, duration = CACHE_DURATION.DEFAULT) {
    const expiresAt = Date.now() + duration;
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Remove specific cache entry
   * @param {string} key - Cache key to remove
   */
  remove(key) {
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Clear cache by pattern (e.g., all dashboard-related cache)
   * @param {string} pattern - Pattern to match keys
   */
  clearByPattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Check if cache exists and is valid
   * @param {string} key - Cache key
   * @returns {boolean} - True if cache exists and is valid
   */
  has(key) {
    const cached = this.cache.get(key);
    if (!cached) return false;

    const now = Date.now();
    if (now > cached.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }
}

// Create singleton instance (only on client-side)
let dataCache;
if (typeof window !== 'undefined') {
  dataCache = new DataCache();
} else {
  // Server-side: create a minimal cache without setInterval
  dataCache = {
    cache: new Map(),
    get(key) { return null; },
    set(key, data, duration) {},
    remove(key) {},
    clear() {},
    clearByPattern(pattern) {},
    has(key) { return false; }
  };
}

// Export cache instance and duration constants
export default dataCache;
export { CACHE_DURATION };

