import { getVideoStats, getActivityStats, getVideosPanel, checkOpenAIKeyAvailability } from './api';
import dataCache, { CACHE_DURATION } from './dataCache';

/**
 * Pre-fetch service that loads all common APIs after login
 * Stores responses in cache for instant access when navigating
 */
class PrefetchService {
  constructor() {
    this.isPrefetching = false;
    this.prefetchPromise = null;
  }

  /**
   * Pre-fetch all common APIs after user login
   * Runs in background while dashboard loads
   */
  async prefetchAllData() {
    // Prevent multiple simultaneous prefetch operations
    if (this.isPrefetching) {
      return this.prefetchPromise;
    }

    this.isPrefetching = true;
    
    this.prefetchPromise = (async () => {
      try {
        console.log('[Prefetch] Starting background data pre-fetch...');
        const startTime = Date.now();

        // Fetch all APIs in parallel for maximum speed
        const prefetchPromises = [
          // Dashboard APIs
          this.prefetchDashboardData(),
          
          // Process Data APIs (first page)
          this.prefetchProcessData(),
          
          // OpenAI Key check
          this.prefetchOpenAIKey(),
        ];

        // Wait for all prefetches to complete (don't fail if one fails)
        await Promise.allSettled(prefetchPromises);

        const duration = Date.now() - startTime;
        console.log(`[Prefetch] Completed in ${duration}ms`);
      } catch (error) {
        console.error('[Prefetch] Error during pre-fetch:', error);
      } finally {
        this.isPrefetching = false;
      }
    })();

    return this.prefetchPromise;
  }

  /**
   * Pre-fetch dashboard data
   */
  async prefetchDashboardData() {
    try {
      const cacheKeyVideoStats = 'dashboard:videoStats';
      const cacheKeyActivityStats = 'dashboard:activityStats';

      // Check if already cached
      if (dataCache.has(cacheKeyVideoStats) && dataCache.has(cacheKeyActivityStats)) {
        console.log('[Prefetch] Dashboard data already cached');
        return;
      }

      // Fetch in parallel
      const [videoStats, activityStats] = await Promise.allSettled([
        getVideoStats(),
        getActivityStats(30).catch(err => {
          console.warn('[Prefetch] Activity stats failed:', err);
          return null;
        })
      ]);

      // Cache video stats
      if (videoStats.status === 'fulfilled' && videoStats.value) {
        dataCache.set(cacheKeyVideoStats, videoStats.value, CACHE_DURATION.DASHBOARD_STATS);
        console.log('[Prefetch] Dashboard video stats cached');
      }

      // Cache activity stats
      if (activityStats.status === 'fulfilled' && activityStats.value) {
        dataCache.set(cacheKeyActivityStats, activityStats.value, CACHE_DURATION.DASHBOARD_STATS);
        console.log('[Prefetch] Dashboard activity stats cached');
      }
    } catch (error) {
      console.error('[Prefetch] Dashboard data error:', error);
    }
  }

  /**
   * Pre-fetch process data (videos panel - first page)
   */
  async prefetchProcessData() {
    try {
      const cacheKey = 'process-data:videos:page:1:status:null:fileName:null';
      
      // Check if already cached
      if (dataCache.has(cacheKey)) {
        console.log('[Prefetch] Process data already cached');
        return;
      }

      // Fetch first page of videos
      const response = await getVideosPanel({
        page: 1,
        page_size: 20,
        sort_by: 'updated_at',
        sort_order: 'desc'
      });

      if (response && response.videos) {
        // Cache the response
        dataCache.set(cacheKey, {
          videos: response.videos,
          totalRecords: response.total || 0,
          totalPages: Math.ceil((response.total || 0) / 20)
        }, CACHE_DURATION.VIDEO_LIST);
        console.log('[Prefetch] Process data cached');
      }
    } catch (error) {
      console.error('[Prefetch] Process data error:', error);
    }
  }

  /**
   * Pre-fetch OpenAI key availability
   */
  async prefetchOpenAIKey() {
    try {
      const cacheKey = 'openai:key:availability';
      
      // Check if already cached
      if (dataCache.has(cacheKey)) {
        console.log('[Prefetch] OpenAI key check already cached');
        return;
      }

      const keyCheck = await checkOpenAIKeyAvailability();
      
      // Cache for 5 minutes (key status doesn't change frequently)
      dataCache.set(cacheKey, keyCheck, 5 * 60 * 1000);
      console.log('[Prefetch] OpenAI key availability cached');
    } catch (error) {
      console.error('[Prefetch] OpenAI key check error:', error);
      // Don't cache errors - let it retry
    }
  }

  /**
   * Pre-fetch document data (first page)
   */
  async prefetchDocumentData() {
    try {
      const cacheKey = 'document:videos:page:1';
      
      if (dataCache.has(cacheKey)) {
        return;
      }

      const response = await getVideosPanel({
        page: 1,
        page_size: 10,
        sort_by: 'updated_at',
        sort_order: 'desc'
      });

      if (response && response.videos) {
        dataCache.set(cacheKey, {
          videos: response.videos,
          totalRecords: response.total || 0,
          totalPages: Math.ceil((response.total || 0) / 10)
        }, CACHE_DURATION.VIDEO_LIST);
        console.log('[Prefetch] Document data cached');
      }
    } catch (error) {
      console.error('[Prefetch] Document data error:', error);
    }
  }
}

// Create singleton instance
const prefetchService = new PrefetchService();

export default prefetchService;
