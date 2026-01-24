import axios from 'axios';
import { clearAuthData } from './auth';
import { RETRY_CONFIG } from './config';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9001';

// Global request limiter to prevent too many concurrent requests
let activeRequestCount = 0;
const MAX_CONCURRENT_REQUESTS = 5; // Maximum concurrent requests allowed

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 seconds - reduced to prevent request buildup
  headers: {
    'Content-Type': 'application/json',
  },
  // Performance optimizations
  maxRedirects: 5,
  validateStatus: (status) => {
    // Treat 401 as error so it goes to error interceptor for redirect handling
    // Other status codes can pass through normally
    if (status === 401) {
      return false; // This will make axios throw an error for 401
    }
    return status < 500; // Don't throw on other 4xx errors
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Limit concurrent requests to prevent browser overload
    if (activeRequestCount >= MAX_CONCURRENT_REQUESTS) {
      const error = new Error('Too many concurrent requests');
      error.code = 'TOO_MANY_REQUESTS';
      return Promise.reject(error);
    }
    
    activeRequestCount++;
    
    // Add auth token to requests if available
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor with retry logic
apiClient.interceptors.response.use(
  (response) => {
    // Decrement active request count on success
    activeRequestCount = Math.max(0, activeRequestCount - 1);
    
    // Extract and store request ID from response headers
    const requestId = response.headers['x-request-id'];
    if (requestId && typeof window !== 'undefined') {
      // Store in response for debugging
      response.requestId = requestId;
      
      // Optionally log to console in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`[API Request] ${response.config.method?.toUpperCase()} ${response.config.url} - Request ID: ${requestId}`);
      }
    }
    return response;
  },
  async (error) => {
    // Decrement active request count on error (always decrement, even if retrying)
    activeRequestCount = Math.max(0, activeRequestCount - 1);
    
    // Extract request ID from error response if available
    if (error.response?.headers) {
      const requestId = error.response.headers['x-request-id'];
      if (requestId) {
        error.requestId = requestId;
        // Include request ID in error message for debugging
        if (error.message && !error.message.includes(requestId)) {
          error.message = `${error.message} (Request ID: ${requestId})`;
        }
      }
    }
    const originalRequest = error.config;

    // Handle network errors (no response from server)
    // Note: Network errors will be handled by retry logic below if retryable
    if (!error.response) {
      // Check if it's a network error
      if (error.message === 'Network Error' || error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED') {
        // Enhance error message with more context
        error.networkError = true;
        error.enhancedMessage = `Unable to connect to the server at ${API_BASE_URL}. Please ensure:
1. The backend server is running
2. The API URL is correct (currently: ${API_BASE_URL})
3. There are no CORS or firewall issues blocking the connection`;
      }
    }

    // Enhanced retry logic with exponential backoff
    // Check if request has already been retried to prevent infinite loops
    const currentRetryCount = originalRequest._retryCount || 0;
    
    // Don't retry panel requests if they're timing out - prevents request queue buildup
    const isPanelRequest = originalRequest.url && originalRequest.url.includes('/api/videos/panel');
    
    const shouldRetry = (
      currentRetryCount < RETRY_CONFIG.maxRetries &&
      originalRequest.url !== '/api/upload' &&
      !isPanelRequest && // Don't retry panel requests - they're called frequently enough
      (
        // Network errors (but not timeout errors for panel requests)
        (!error.response && RETRY_CONFIG.retryableErrors.includes(error.code || error.message) && 
         !(isPanelRequest && (error.code === 'ECONNABORTED' || error.message === 'timeout'))) ||
        // Retryable status codes
        (error.response && RETRY_CONFIG.retryableStatuses.includes(error.response.status))
      )
    );

    if (shouldRetry) {
      const retryCount = currentRetryCount + 1;
      
      // Set retry count BEFORE making the retry to prevent duplicate retries
        originalRequest._retryCount = retryCount;
        
        // Calculate delay with exponential backoff
        let delay = RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, retryCount - 1);
        delay = Math.min(delay, RETRY_CONFIG.maxDelay);
        
        // For 429 rate limit, use retry-after header if available
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          if (retryAfter) {
            delay = parseInt(retryAfter) * 1000;
          }
        }
        
        // Log retry attempt
        console.log(`Retrying request (attempt ${retryCount}/${RETRY_CONFIG.maxRetries}): ${originalRequest.url} after ${delay}ms`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return apiClient(originalRequest);
    } else if (currentRetryCount >= RETRY_CONFIG.maxRetries) {
        // Max retries exceeded
        console.error(`Max retries (${RETRY_CONFIG.maxRetries}) exceeded for: ${originalRequest.url}`);
        error.maxRetriesExceeded = true;
      error.retryCount = currentRetryCount;
    }

    // Handle specific error cases
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Handle unauthorized - clear auth data and redirect to login
          if (typeof window !== 'undefined') {
            // Clear auth data first
            clearAuthData();
            
            // Only redirect if not already on auth page or login-related pages
            const currentPath = window.location.pathname;
            const authPages = ['/auth', '/auth/google', '/auth/google/callback'];
            const isOnAuthPage = authPages.some(page => currentPath.startsWith(page));
            
            if (!isOnAuthPage) {
              // Use window.location.replace for immediate redirect without adding to history
              // This prevents users from going back to the unauthorized page
              window.location.replace('/auth');
            }
          }
          // Reject the promise to prevent further processing
          return Promise.reject(error);
        case 403:
          // Handle forbidden
          break;
        case 404:
          // Handle not found
          break;
      }
    }

    return Promise.reject(error);
  }
);

export const uploadVideo = async (file, onUploadProgress, options = {}) => {
  const formData = new FormData();
  formData.append('file', file);
  
  // Add optional parameters
  if (options.name) formData.append('name', options.name);
  if (options.application_name) formData.append('application_name', options.application_name);
  if (options.tags) formData.append('tags', options.tags);
  if (options.language_code) formData.append('language_code', options.language_code);
  if (options.priority) formData.append('priority', options.priority);

  return apiClient.post('/api/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress && progressEvent.total) {
        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onUploadProgress(percentCompleted);
      }
    },
    timeout: 300000, // 5 minutes for upload
  });
};

export const getStatus = async (jobId) => {
  const response = await apiClient.get(`/api/status/${jobId}`);
  return response.data;
};

export const downloadDocument = async (jobId, format = 'docx') => {
  return apiClient.get(`/api/download/${jobId}?format=${format}`, {
    responseType: 'blob',
    timeout: 60000, // 1 minute for download
  });
};

// Authentication API functions
export const signup = async (fullName, email, password) => {
  const response = await apiClient.post('/api/auth/signup', {
    full_name: fullName,
    email: email,
    password: password
  });
  return response.data;
};

export const login = async (email, password) => {
  const response = await apiClient.post('/api/auth/login', {
    email: email,
    password: password
  });
  // Store token in localStorage
  if (response.data.access_token && typeof window !== 'undefined') {
    localStorage.setItem('access_token', response.data.access_token);
    localStorage.setItem('session_token', response.data.session_token);
    localStorage.setItem('user', JSON.stringify(response.data.user));
  }
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await apiClient.get('/api/auth/me');
  return response.data;
};

export const logout = () => {
  if (typeof window !== 'undefined') {
    clearAuthData();
    // Redirect to auth page after logout
    window.location.href = '/auth';
  }
};

export const getGoogleAuthUrl = (redirectUri) => {
  const baseUrl = API_BASE_URL;
  const redirectParam = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
  return `${baseUrl}/api/auth/google${redirectParam}`;
};

// Health & Status APIs
export const getHealth = async () => {
  const response = await apiClient.get('/health');
  return response.data;
};

export const getApiHealth = async () => {
  const response = await apiClient.get('/api/health');
  return response.data;
};

// Video Management APIs
export const getUploads = async (params = {}) => {
  const {
    page = 1,
    page_size = 20,
    status,
    include_deleted = false,
    application_name,
    language_code,
    priority,
    tags
  } = params;
  
  const queryParams = new URLSearchParams();
  queryParams.append('page', page.toString());
  queryParams.append('page_size', page_size.toString());
  queryParams.append('include_deleted', include_deleted.toString());
  
  if (status) queryParams.append('status', status);
  if (application_name) queryParams.append('application_name', application_name);
  if (language_code) queryParams.append('language_code', language_code);
  if (priority) queryParams.append('priority', priority);
  if (tags) queryParams.append('tags', tags);
  
  const response = await apiClient.get(`/api/uploads?${queryParams.toString()}`);
  return response.data;
};

export const getUploadById = async (uploadId) => {
  const response = await apiClient.get(`/api/uploads/${uploadId}`);
  return response.data;
};

export const updateUpload = async (uploadId, data) => {
  const response = await apiClient.patch(`/api/uploads/${uploadId}`, data);
  return response.data;
};

export const deleteUpload = async (uploadId, permanent = false) => {
  const response = await apiClient.delete(`/api/uploads/${uploadId}?permanent=${permanent}`);
  return response.data;
};

export const bulkDeleteUploads = async (uploadIds, permanent = false) => {
  const response = await apiClient.post('/api/uploads/bulk-delete', {
    upload_ids: uploadIds,
    permanent: permanent
  });
  return response.data;
};

export const restoreUpload = async (uploadId) => {
  const response = await apiClient.post(`/api/uploads/${uploadId}/restore`);
  return response.data;
};

export const retryUpload = async (uploadId) => {
  const response = await apiClient.post(`/api/uploads/${uploadId}/retry`);
  return response.data;
};

export const getJobStatus = async (jobId) => {
  const response = await apiClient.get(`/api/status/${jobId}`);
  return response.data;
};

export const getVideosPanel = async (params = {}, signal = null) => {
  const {
    page = 1,
    page_size = 20,
    status,
    application_name,
    language_code,
    priority,
    tags,
    sort_by = 'updated_at',
    sort_order = 'desc'
  } = params;
  
  const queryParams = new URLSearchParams();
  queryParams.append('page', page.toString());
  queryParams.append('page_size', page_size.toString());
  queryParams.append('sort_by', sort_by);
  queryParams.append('sort_order', sort_order);
  
  if (status) queryParams.append('status', status);
  if (application_name) queryParams.append('application_name', application_name);
  if (language_code) queryParams.append('language_code', language_code);
  if (priority) queryParams.append('priority', priority);
  if (tags) queryParams.append('tags', tags);
  
  const config = signal ? { signal } : {};
  const response = await apiClient.get(`/api/videos/panel?${queryParams.toString()}`, config);
  return response.data;
};

export const getVideoFrames = async (videoId, limit = null, offset = 0) => {
  const queryParams = new URLSearchParams();
  if (limit) queryParams.append('limit', limit.toString());
  queryParams.append('offset', offset.toString());
  
  const response = await apiClient.get(`/api/videos/${videoId}/frames?${queryParams.toString()}`);
  return response.data;
};

export const getVideoTranscript = async (videoId) => {
  const response = await apiClient.get(`/api/videos/${videoId}/transcript`);
  return response.data;
};

export const getGPTResponses = async (videoFileNumber) => {
  const response = await apiClient.get(`/api/videos/file-number/${videoFileNumber}/gpt-responses`);
  return response.data;
};

export const getVideoSummaries = async (videoId) => {
  const response = await apiClient.get(`/api/videos/${videoId}/summaries`);
  return response.data;
};

export const getDocument = async (videoFileNumber, includeImages = true) => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:372',message:'getDocument API call entry',data:{videoFileNumber,includeImages,url:`/api/videos/file-number/${videoFileNumber}/document`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  // By default, include images for display in document page
  // Set includeImages=false only when images are not needed (faster loading)
  try {
  const response = await apiClient.get(`/api/videos/file-number/${videoFileNumber}/document`, {
    params: {
      include_images: includeImages
    }
  });
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:380',message:'getDocument API call success',data:{status:response.status,hasData:!!response.data,dataKeys:response.data?Object.keys(response.data):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    return response.data;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:383',message:'getDocument API call error',data:{errorMessage:error.message,status:error.response?.status,errorData:error.response?.data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    throw error;
  }
};

export const getDocumentByVideoId = async (videoId, includeImages = true) => {
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:391',message:'getDocumentByVideoId API call entry',data:{videoId,includeImages,url:`/api/videos/${videoId}/document`},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  try {
    const response = await apiClient.get(`/api/videos/${videoId}/document`, {
      params: {
        include_images: includeImages
      }
    });
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:398',message:'getDocumentByVideoId API call success',data:{status:response.status,hasData:!!response.data,dataKeys:response.data?Object.keys(response.data):[],hasDetail:!!response.data?.detail},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    // If response has 'detail' field, it's likely an error response (even if status is 200)
    if (response.data && response.data.detail) {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:403',message:'getDocumentByVideoId response has detail (error)',data:{detail:response.data.detail,status:response.status},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const error = new Error(response.data.detail);
      error.response = { status: response.status || 404, data: response.data };
      throw error;
    }
  return response.data;
  } catch (error) {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.js:411',message:'getDocumentByVideoId API call error',data:{errorMessage:error.message,status:error.response?.status,errorData:error.response?.data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    throw error;
  }
};

// Activity Logs APIs
export const getActivityLogs = async (params = {}) => {
  const {
    page = 1,
    page_size = 20,
    action,
    start_date,
    end_date,
    search
  } = params;
  
  const queryParams = new URLSearchParams();
  queryParams.append('page', page.toString());
  queryParams.append('page_size', page_size.toString());
  
  if (action) queryParams.append('action', action);
  if (start_date) queryParams.append('start_date', start_date);
  if (end_date) queryParams.append('end_date', end_date);
  if (search) queryParams.append('search', search);
  
  const response = await apiClient.get(`/api/activity-logs?${queryParams.toString()}`);
  return response.data;
};

export const getActivityLogById = async (logId) => {
  const response = await apiClient.get(`/api/activity-logs/${logId}`);
  return response.data;
};

export const getActivityStats = async (days = 30) => {
  const response = await apiClient.get(`/api/activity-logs/stats?days=${days}`);
  return response.data;
};

export const getActivityActions = async () => {
  const response = await apiClient.get('/api/activity-logs/actions');
  return response.data;
};

// Settings APIs
export const getUserPrompt = async () => {
  const response = await apiClient.get('/api/settings/prompt');
  return response.data;
};

export const updateUserPrompt = async (promptData) => {
  const response = await apiClient.put('/api/settings/prompt', promptData);
  return response.data;
};

export const getDefaultPrompt = async () => {
  const response = await apiClient.get('/api/settings/prompt/default');
  return response.data;
};

export const getUserOpenAIKey = async () => {
  const response = await apiClient.get('/api/settings/openai-key');
  return response.data;
};

export const updateUserOpenAIKey = async (keyData) => {
  const response = await apiClient.put('/api/settings/openai-key', keyData);
  return response.data;
};

export const checkOpenAIKeyAvailability = async () => {
  const response = await apiClient.get('/api/settings/openai-key/check');
  return response.data;
};

// Dashboard Analytics APIs
export const getDashboardStats = async (params = {}) => {
  const {
    page = 1,
    page_size = 100, // Max allowed by API
    start_date,
    end_date
  } = params;
  
  const queryParams = new URLSearchParams();
  queryParams.append('page', page.toString());
  queryParams.append('page_size', page_size.toString());
  queryParams.append('sort_by', 'created_at');
  queryParams.append('sort_order', 'desc');
  
  if (start_date) queryParams.append('start_date', start_date);
  if (end_date) queryParams.append('end_date', end_date);
  
  const response = await apiClient.get(`/api/videos/panel?${queryParams.toString()}`);
  return response.data;
};

export const getVideoStats = async () => {
  try {
    // Fetch all videos with pagination (max 100 per page)
    let allVideos = [];
    let currentPage = 1;
    let hasMore = true;
    const pageSize = 100;
    
    while (hasMore) {
      const response = await getDashboardStats({ page: currentPage, page_size: pageSize });
      const videos = response.videos || [];
      allVideos = [...allVideos, ...videos];
      
      // Check if there are more pages
      const total = response.total || 0;
      hasMore = allVideos.length < total && videos.length === pageSize;
      currentPage++;
      
      // Safety limit to prevent infinite loops
      if (currentPage > 100) break;
    }
    
    const videos = allVideos;
    
    // Calculate statistics
    const totalVideos = videos.length;
    const completedVideos = videos.filter(v => v.status === 'completed').length;
    const processingVideos = videos.filter(v => v.status === 'processing' || v.status === 'uploaded').length;
    const failedVideos = videos.filter(v => v.status === 'failed').length;
    const cancelledVideos = videos.filter(v => v.status === 'cancelled').length;
    
    // Calculate success rate
    const successRate = totalVideos > 0 ? ((completedVideos / totalVideos) * 100).toFixed(1) : 0;
    
    // Calculate total video duration and size
    const totalDuration = videos.reduce((sum, v) => sum + (v.video_length_seconds || 0), 0);
    const totalSize = videos.reduce((sum, v) => sum + (v.video_size_bytes || 0), 0);
    const avgDuration = totalVideos > 0 ? totalDuration / totalVideos : 0;
    const avgSize = totalVideos > 0 ? totalSize / totalVideos : 0;
    
    // Calculate frame statistics
    const totalFrames = videos.reduce((sum, v) => sum + (v.total_frames || 0), 0);
    const framesWithGpt = videos.reduce((sum, v) => sum + (v.frames_with_gpt || 0), 0);
    const frameAnalysisRate = totalFrames > 0 ? ((framesWithGpt / totalFrames) * 100).toFixed(1) : 0;
    
    // Status distribution
    const statusDistribution = {
      completed: completedVideos,
      processing: processingVideos,
      failed: failedVideos,
      cancelled: cancelledVideos,
      uploaded: videos.filter(v => v.status === 'uploaded').length
    };
    
    // Application distribution
    const appDistribution = {};
    videos.forEach(v => {
      const app = v.application_name || 'Unknown';
      appDistribution[app] = (appDistribution[app] || 0) + 1;
    });
    
    // Language distribution
    const languageDistribution = {};
    videos.forEach(v => {
      const lang = v.language_code || 'Unknown';
      languageDistribution[lang] = (languageDistribution[lang] || 0) + 1;
    });
    
    // Priority distribution
    const priorityDistribution = {
      high: videos.filter(v => v.priority === 'high').length,
      normal: videos.filter(v => v.priority === 'normal' || !v.priority).length
    };
    
    // Monthly processing (last 12 months)
    const monthlyData = {};
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = 0;
    }
    
    videos.forEach(v => {
      if (v.created_at) {
        const date = new Date(v.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyData.hasOwnProperty(monthKey)) {
          monthlyData[monthKey]++;
        }
      }
    });
    
    // Daily processing (last 30 days)
    const dailyData = {};
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dayKey = date.toISOString().split('T')[0];
      dailyData[dayKey] = 0;
    }
    
    videos.forEach(v => {
      if (v.created_at) {
        const date = new Date(v.created_at);
        const dayKey = date.toISOString().split('T')[0];
        if (dailyData.hasOwnProperty(dayKey)) {
          dailyData[dayKey]++;
        }
      }
    });
    
    // Calculate month-over-month growth
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const currentMonthVideos = videos.filter(v => {
      if (!v.created_at) return false;
      const date = new Date(v.created_at);
      return date >= currentMonth;
    }).length;
    const lastMonthVideos = videos.filter(v => {
      if (!v.created_at) return false;
      const date = new Date(v.created_at);
      return date >= lastMonth && date < currentMonth;
    }).length;
    
    const momGrowth = lastMonthVideos > 0 
      ? (((currentMonthVideos - lastMonthVideos) / lastMonthVideos) * 100).toFixed(1)
      : currentMonthVideos > 0 ? '100.0' : '0.0';
    
    return {
      totalVideos,
      completedVideos,
      processingVideos,
      failedVideos,
      cancelledVideos,
      successRate: parseFloat(successRate),
      totalDuration,
      totalSize,
      avgDuration,
      avgSize,
      totalFrames,
      framesWithGpt,
      frameAnalysisRate: parseFloat(frameAnalysisRate),
      statusDistribution,
      appDistribution,
      languageDistribution,
      priorityDistribution,
      monthlyData,
      dailyData,
      currentMonthVideos,
      lastMonthVideos,
      momGrowth: parseFloat(momGrowth)
    };
  } catch (error) {
    console.error('Failed to get video stats:', error);
    throw error;
  }
};

// Helper function to log activity (creates activity log via backend)
// Note: This requires a backend endpoint that accepts activity logs from frontend
// For now, we'll use a POST endpoint if it exists, otherwise this is a placeholder
export const logActivity = async (action, description = null, metadata = null) => {
  try {
    // This would need a backend endpoint like POST /api/activity-logs
    // For now, we'll just log to console and return
    // The actual activity logging should be done on the backend when actions occur
    console.log('Activity log:', { action, description, metadata });
    return { success: true };
  } catch (error) {
    console.error('Failed to log activity:', error);
    return { success: false, error: error.message };
  }
};

export default apiClient;

