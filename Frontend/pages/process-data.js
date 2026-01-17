import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import styles from '../styles/Dashboard.module.css';
import { logPageView, logVideoUpload } from '../lib/activityLogger';
import { uploadVideo, getStatus, getVideosPanel, deleteUpload, retryUpload, getJobStatus, bulkDeleteUploads, checkOpenAIKeyAvailability } from '../lib/api';
import dataCache, { CACHE_DURATION } from '../lib/dataCache';
import { getCurrentUser } from '../lib/auth';

export default function ProcessData() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [processingOpen, setProcessingOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState({
    name: '',
    link: '',
    file: null,
    files: [], // Support multiple files
    fileUrl: ''
  });
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const processingSteps = [
    { id: 1, label: 'Extracting audio', number: '1' },
    { id: 2, label: 'Transcribe', number: '2' },
    { id: 3, label: 'Extract Keyframes', number: '3' },
    { id: 4, label: 'Analyze Frames', number: '4' },
    { id: 5, label: 'Ready', number: '5' }
  ];

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'grid'
  const [sortBy, setSortBy] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterData, setFilterData] = useState({
    user: null,
    fileName: '',
    status: null,
    date: null
  });
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [filterCalendarMonth, setFilterCalendarMonth] = useState(new Date());

  // Real data from API
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newEntryId, setNewEntryId] = useState(null);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [processingStatus, setProcessingStatus] = useState(null);
  const [statusPollingInterval, setStatusPollingInterval] = useState(null);
  const backgroundRefreshIntervalRef = useRef(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 10;
  const [isInitialMount, setIsInitialMount] = useState(true);
  
  // Validation state
  const [nameError, setNameError] = useState(false);
  const [openAIKeyError, setOpenAIKeyError] = useState(null);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferProgress, setTransferProgress] = useState(0);
  const transferDialogTimeoutRef = useRef(null);
  
  // OpenAI key availability state
  const [hasOpenAIKey, setHasOpenAIKey] = useState(null); // null = not checked yet, false = no key, true = has key
  const [checkingOpenAIKey, setCheckingOpenAIKey] = useState(true);
  
  // Dropdown and status view state
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [viewStatusItem, setViewStatusItem] = useState(null);
  
  // Selection state
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);

  // Function to check OpenAI key availability (reusable)
  const checkOpenAIKey = useCallback(async () => {
    try {
      console.log('[OpenAI Check] Starting check...');
      setCheckingOpenAIKey(true);
      const keyCheck = await checkOpenAIKeyAvailability();
      const hasKey = Boolean(keyCheck?.has_key);
      console.log('[OpenAI Check] Result:', { has_key: hasKey, fullResponse: keyCheck });
      setHasOpenAIKey(hasKey);
      if (!hasKey) {
        const errorMsg = keyCheck?.message || "No OpenAI API key found. Please add your API key in Settings to process videos.";
        setOpenAIKeyError(errorMsg);
        console.log('[OpenAI Check] No key found, setting error message');
      } else {
        setOpenAIKeyError(null);
        console.log('[OpenAI Check] Key found, clearing error');
      }
    } catch (error) {
      console.error('[OpenAI Check] Error:', error);
      // If check fails, assume no key to be safe
      setHasOpenAIKey(false);
      setOpenAIKeyError("Failed to verify OpenAI API key. Please try again or add your API key in Settings.");
    } finally {
      setCheckingOpenAIKey(false);
      console.log('[OpenAI Check] Check completed');
    }
  }, []);

  useEffect(() => {
    // Log page view
    logPageView('Process Data');
    
    // OpenAI key check removed - backend handles API key configuration
    // checkOpenAIKey();
    
    // Fetch videos from API on initial load
    fetchVideos(1);
    setIsInitialMount(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkOpenAIKey]);

  // Re-check OpenAI key when window regains focus (user might have added key in another tab)
  useEffect(() => {
    const handleFocus = () => {
      checkOpenAIKey();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [checkOpenAIKey]);

  // Refetch when page changes (skip initial mount)
  useEffect(() => {
    if (!isInitialMount) {
      fetchVideos(currentPage);
      // Clear selection when page changes
      setSelectedItems(new Set());
      setSelectAll(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  // Update select all state when tableData or selection changes (memoized)
  const selectAllState = useMemo(() => {
    if (tableData.length > 0) {
      const allCurrentPageIds = tableData.map(v => v.id);
      return allCurrentPageIds.length > 0 && 
             allCurrentPageIds.every(id => selectedItems.has(id));
    }
    return false;
  }, [selectedItems, tableData]);

  useEffect(() => {
    setSelectAll(selectAllState);
  }, [selectAllState]);

  const getCacheKey = (page, status, fileName) => {
    return `process-data:videos:page:${page}:status:${status || 'all'}:fileName:${fileName || 'all'}`;
  };

  const fetchVideos = async (page = currentPage, forceRefresh = false, silent = false) => {
    const cacheKey = getCacheKey(page, filterData.status, filterData.fileName);
    
    // Get cached data for comparison
    const cachedData = dataCache.get(cacheKey);
    
    // If not forcing refresh and we have cached data, use it for initial render
    if (!forceRefresh && cachedData && !silent) {
      setTableData(cachedData.videos);
      setTotalRecords(cachedData.totalRecords);
      setTotalPages(cachedData.totalPages);
      setLoading(false);
    }

    try {
      // Always fetch fresh data from API to check for changes
      if (!silent) {
        setLoading(true);
      }
      
      const response = await getVideosPanel({ 
        page: page, 
        page_size: pageSize,
        sort_by: 'updated_at',
        sort_order: 'desc',
        status: filterData.status || null,
        application_name: filterData.fileName || null
      });
      
      if (response && response.videos) {
        // Map API response to table format
        const mappedData = response.videos.map((video) => {
          const createdDate = new Date(video.created_at);
          const updatedDate = new Date(video.updated_at);
          
          const formatDate = (date) => {
            const dateStr = date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              year: 'numeric' 
            });
            const timeStr = date.toLocaleTimeString('en-US', { 
              hour: 'numeric', 
              minute: '2-digit', 
              hour12: true 
            });
            return `${dateStr}, ${timeStr}`;
          };

          // Get first letter of name for recipient avatar
          const firstLetter = video.name ? video.name.charAt(0).toUpperCase() : 'U';
          
          return {
            id: video.id,
            name: video.name,
            created: formatDate(createdDate),
            lastActivity: formatDate(updatedDate),
            recipients: [firstLetter], // Show first letter as avatar
            status: video.status || 'uploaded',
            video_file_number: video.video_file_number,
            job_id: video.job_id || null
          };
        });
        
        // Update pagination info
        const totalRecords = response.total !== undefined ? response.total : 0;
        const totalPages = Math.ceil(totalRecords / pageSize);
        
        // Compare with cached data to detect changes
        let hasChanges = false;
        
        if (!cachedData) {
          // No cache - this is first load, always update
          hasChanges = true;
        } else {
          // Check for changes: new entries, status updates, or count changes
          const cachedVideos = cachedData.videos || [];
          
          // Check if count changed (new entries or deletions)
          if (mappedData.length !== cachedVideos.length) {
            hasChanges = true;
          } else {
            // Create maps for quick lookup
            const cachedMap = new Map(cachedVideos.map(v => [v.id, v]));
            const newMap = new Map(mappedData.map(v => [v.id, v]));
            
            // Check each video for changes
            for (const newVideo of mappedData) {
              const cachedVideo = cachedMap.get(newVideo.id);
              
              if (!cachedVideo) {
                // New entry
                hasChanges = true;
                break;
              }
              
              // Check if status changed
              if (cachedVideo.status !== newVideo.status) {
                hasChanges = true;
                break;
              }
              
              // Check if lastActivity changed (indicates update)
              if (cachedVideo.lastActivity !== newVideo.lastActivity) {
                hasChanges = true;
                break;
              }
            }
            
            // Also check for removed videos
            if (!hasChanges) {
              for (const cachedVideo of cachedVideos) {
                if (!newMap.has(cachedVideo.id)) {
                  hasChanges = true;
                  break;
                }
              }
            }
          }
        }
        
        // Only update table state if there are actual changes
        if (hasChanges) {
          setTableData(mappedData);
          setTotalRecords(totalRecords);
          setTotalPages(totalPages);
        }
        
        // Always update cache with fresh data (even if no UI update)
        dataCache.set(cacheKey, {
          videos: mappedData,
          totalRecords,
          totalPages
        }, CACHE_DURATION.VIDEO_LIST);
        
      } else {
        // Empty response - only update if we had data before
        if (cachedData && cachedData.videos && cachedData.videos.length > 0) {
          setTableData([]);
          setTotalRecords(0);
          setTotalPages(1);
        } else if (!cachedData) {
          // No cache and no data - first load
          setTableData([]);
          setTotalRecords(0);
          setTotalPages(1);
        }
      }
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      // Only update on error if we don't have cached data
      if (!cachedData) {
        setTableData([]);
        setTotalRecords(0);
        setTotalPages(1);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  // Sample users for dropdown
  const users = [
    'Abhi K',
    'admin admin',
    'Alina L',
    'anonymous anonymous',
    'Denny Morais',
    'dilshadsoraon09 soraon',
    'John Doe',
    'Jane Smith',
    'Mike Johnson'
  ];

  const statusOptions = ['uploaded', 'processing', 'completed', 'failed', 'cancelled'];

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Prevent row click
    
    // Confirm deletion
    if (!confirm('Are you sure you want to permanently delete this video? This action cannot be undone and the data will be removed from the database.')) {
      return;
    }
    
    try {
      // Call delete API endpoint with permanent=true to hard delete from database
      await deleteUpload(id, true);
      // Invalidate cache to ensure fresh data
      dataCache.clearByPattern('process-data:videos:');
      dataCache.clearByPattern('document:videos:');
      dataCache.clearByPattern('dashboard:');
      // Refresh the list
      await fetchVideos();
    } catch (error) {
      console.error('Failed to delete:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete item. Please try again.';
      alert(errorMessage);
    }
  };

  const handleViewStatus = async (e, item) => {
    e.stopPropagation();
    setOpenDropdownId(null);
    
    if (!item.job_id) {
      alert('No job ID found for this video');
      return;
    }
    
    try {
      // Get current job status
      const status = await getJobStatus(item.job_id);
      setViewStatusItem({ ...item, status });
      setProcessingOpen(true);
      setCurrentJobId(item.job_id);
      setProcessingStatus(status);
      
      // Update current step based on status
      if (status) {
        const stepProgress = status.step_progress || {};
        const currentStepName = status.current_step || 'upload';
        
        // Map backend steps to frontend steps (0-4)
        let stepIndex = 0;
        
        if (stepProgress.upload === 'completed') {
          stepIndex = 0;
        }
        if (stepProgress.extract_audio === 'processing' || stepProgress.extract_audio === 'completed') {
          stepIndex = 1;
        }
        if (stepProgress.transcribe === 'processing' || stepProgress.transcribe === 'completed') {
          stepIndex = 1;
        }
        if (stepProgress.extract_frames === 'processing' || stepProgress.extract_frames === 'completed') {
          stepIndex = 2;
        }
        if (stepProgress.analyze_frames === 'processing' || stepProgress.analyze_frames === 'completed') {
          stepIndex = 3;
        }
        if (stepProgress.complete === 'processing' || status.status === 'completed') {
          stepIndex = 4;
        }
        
        setCurrentStep(stepIndex);
      }
      
      // Start polling for status updates
      startStatusPolling(item.job_id);
    } catch (error) {
      console.error('Failed to get status:', error);
      alert('Failed to load status. Please try again.');
    }
  };

  const handleRetry = async (e, item) => {
    e.stopPropagation();
    setOpenDropdownId(null);
    
    if (!confirm('Are you sure you want to retry processing this video?')) {
      return;
    }
    
    try {
      await retryUpload(item.id);
      // Invalidate cache to ensure fresh data
      dataCache.clearByPattern('process-data:videos:');
      dataCache.clearByPattern('document:videos:');
      dataCache.clearByPattern('dashboard:');
      // Refresh the list
      await fetchVideos();
      alert('Video processing restarted successfully');
    } catch (error) {
      console.error('Failed to retry:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to retry processing. Please try again.';
      alert(errorMessage);
    }
  };

  const toggleDropdown = (e, itemId) => {
    e.stopPropagation();
    setOpenDropdownId(openDropdownId === itemId ? null : itemId);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdownId(null);
    };
    
    if (openDropdownId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openDropdownId]);

  const handleEdit = (id) => {
    console.log('Edit item:', id);
  };

  const handleCreateNew = async () => {
    // OpenAI key check removed - backend handles API key configuration
    setDialogOpen(true);
  };

  const handleCancel = () => {
    setDialogOpen(false);
    setFormData({ name: '', link: '', file: null, fileUrl: '' });
    setIsDragging(false);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      // Just store the file in state - don't upload yet
      setFormData(prev => ({ ...prev, file, fileUrl: '' })); // Clear fileUrl when file is selected
      setUploadProgress(0);
      setIsUploading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Just store the file in state - don't upload yet
      setFormData(prev => ({ ...prev, file, fileUrl: '' })); // Clear fileUrl when file is selected
      setUploadProgress(0);
      setIsUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setFormData(prev => ({ ...prev, file: null }));
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleUrlInputChange = (e) => {
    const value = e.target.value;
    // Clear file when URL is entered
    setFormData(prev => ({ ...prev, fileUrl: value, file: null }));
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleStart = async () => {
    // Clear previous errors
    setOpenAIKeyError(null);
    setNameError(false);
    
    // Validate name field
    if (!formData.name || formData.name.trim() === '') {
      setNameError(true);
      return;
    }
    
    // Get files to upload (support both single file and multiple files)
    const filesToUpload = formData.files && formData.files.length > 0 
      ? formData.files 
      : (formData.file ? [formData.file] : []);
    
    if (!formData.link && filesToUpload.length === 0 && !formData.fileUrl) {
      return;
    }

    // OpenAI API key check removed - backend handles API key configuration
    // Users can upload videos without frontend validation

    // If files are selected, upload them
    if (filesToUpload.length > 0) {
      try {
        // IMPORTANT: Do NOT show transfer dialog or start upload until validation passes
        // The OpenAI key check above must complete successfully first
        
        setIsUploading(true);
        setUploadProgress(0);
        
        // Show transfer dialog only after validation passes
        setShowTransferDialog(true);
        setTransferProgress(0);
        setDialogOpen(false);
        
        // Upload all files sequentially
        let lastEntryId = null;
        let lastJobId = null;
        
        for (let i = 0; i < filesToUpload.length; i++) {
          const file = filesToUpload[i];
          const fileName = filesToUpload.length > 1 
            ? `${formData.name || file.name} (${i + 1}/${filesToUpload.length})`
            : (formData.name || file.name);
          
          try {
            // Update progress for current file
            const fileProgress = (i / filesToUpload.length) * 100;
            setTransferProgress(fileProgress);
            
            const response = await uploadVideo(file, (progress) => {
              // Calculate overall progress across all files
              const overallProgress = fileProgress + (progress / filesToUpload.length);
              setUploadProgress(overallProgress);
              setTransferProgress(Math.min(90, overallProgress * 0.9));
            }, {
              name: fileName,
              application_name: formData.application_name,
              tags: formData.tags,
              language_code: formData.language_code,
              priority: formData.priority || 'normal'
            });
            
            lastEntryId = response.data?.id || Date.now();
            lastJobId = response.data?.job_id || null;
            
            // Log video upload (non-blocking)
            if (response.data && response.data.id) {
              try {
                logVideoUpload(response.data.id, {
                  name: fileName,
                  video_file_number: response.data.video_file_number
                });
              } catch (logError) {
                console.warn('Failed to log video upload:', logError);
              }
            }
          } catch (error) {
            console.error(`Failed to upload file ${i + 1}:`, error);
            // Continue with next file even if one fails
          }
        }
        
        // Complete transfer progress
        setTransferProgress(100);
        setUploadProgress(100);
        
        // Close transfer dialog
        setShowTransferDialog(false);
        
        // If we have multiple files, just close dialog and refresh list
        // Don't show processing dialog for multiple files (they're in queue)
        if (filesToUpload.length > 1) {
          setFormData({ name: '', link: '', file: null, files: [], fileUrl: '' });
          setIsUploading(false);
          setUploadProgress(0);
          setTransferProgress(0);
          setNameError(false);
          
          // Refresh the list to show all uploaded videos
          dataCache.clearByPattern('process-data:videos:');
          dataCache.clearByPattern('document:videos:');
          dataCache.clearByPattern('dashboard:');
          await fetchVideos();
        } else {
          // Single file - show processing dialog
          setNewEntryId(lastEntryId);
          setCurrentJobId(lastJobId);
          setProcessingOpen(true);
          setCurrentStep(0);
          setFormData({ name: '', link: '', file: null, files: [], fileUrl: '' });
          setIsUploading(false);
          setUploadProgress(0);
          setTransferProgress(0);
          setNameError(false);
          
          // Initialize processing status immediately
          setProcessingStatus({
            status: 'processing',
            message: 'Video uploaded successfully. Processing has started...',
            current_step: 'upload',
            step_progress: { upload: 'completed' },
            progress: 0
          });
          
          // Start polling for status if job_id is available
          if (lastJobId) {
            setTimeout(() => {
              startStatusPolling(lastJobId);
            }, 500);
          }
        }
        
        // Invalidate cache and refresh list in background (non-blocking)
        dataCache.clearByPattern('process-data:videos:');
        dataCache.clearByPattern('document:videos:');
        dataCache.clearByPattern('dashboard:');
        
        // Refresh the list in background
        fetchVideos().catch(err => {
          console.error('Background refresh failed:', err);
        });
        
        // Force refresh after delays
        // Single delayed refresh after upload (removed multiple refreshes)
        // The background refresh will handle ongoing updates
        setTimeout(async () => {
          try {
            dataCache.clearByPattern('process-data:videos:');
            await fetchVideos(currentPage);
          } catch (err) {
            console.error('Delayed refresh failed:', err);
          }
        }, 3000); // Single refresh after 3 seconds
      } catch (error) {
        console.error('Upload failed:', error);
        // Clear timeout on error
        if (transferDialogTimeoutRef.current) {
          clearTimeout(transferDialogTimeoutRef.current);
          transferDialogTimeoutRef.current = null;
        }
        setShowTransferDialog(false);
        setIsUploading(false);
        setUploadProgress(0);
        setTransferProgress(0);
        
        // Show detailed error message
        let errorMessage = 'Failed to upload video. Please try again.';
        if (error.response) {
          // Server responded with error
          errorMessage = error.response.data?.detail || error.response.data?.message || errorMessage;
          if (error.response.status === 401) {
            errorMessage = 'Authentication failed. Please log in again.';
          } else if (error.response.status === 413) {
            errorMessage = 'File is too large. Please choose a smaller file.';
          } else if (error.response.status === 400) {
            // Check if it's an OpenAI key error
            const detail = error.response.data?.detail || '';
            if (detail.toLowerCase().includes('openai') || detail.toLowerCase().includes('api key')) {
              // This is an OpenAI key error - show it in the dialog
              setOpenAIKeyError(errorMessage);
              setDialogOpen(true); // Reopen dialog to show error
              // Scroll to error message
              setTimeout(() => {
                const errorElement = document.querySelector(`[data-openai-error]`);
                if (errorElement) {
                  errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
              }, 100);
              return; // Don't show alert, error is already displayed
            }
            errorMessage = detail || 'Invalid file. Please check the file format and try again.';
          }
        } else if (error.request) {
          // Request was made but no response received
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        alert(errorMessage);
      }
    } else {
      // For URL or link-based uploads, create entry without file
      const entryId = Date.now();
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const formattedDate = `${dateStr}, ${timeStr}`;

      const newEntry = {
        id: entryId,
        name: formData.name,
        created: formattedDate,
        lastActivity: formattedDate,
        recipients: ['U'],
        status: 'Processing'
      };

      // Refresh the list to show the new entry
      await fetchVideos();
      
      setNewEntryId(entryId);
      setDialogOpen(false);
      setProcessingOpen(true);
      setCurrentStep(0);
      setFormData({ name: '', link: '', file: null, fileUrl: '' });
      setUploadProgress(0);
      setIsUploading(false);
    }
  };

  // Single polling mechanism that only updates videos with status "processing"
  // This replaces the old per-job polling to update only active processing videos
  const startProcessingVideoPolling = () => {
    // Clear any existing polling interval
    if (statusPollingInterval) {
      clearInterval(statusPollingInterval);
      setStatusPollingInterval(null);
    }
    
    // Use a ref to track the current interval ID to avoid closure issues
    // Store in a variable that persists across the closure
    const intervalRef = { current: null };
    
    const pollProcessingVideos = async () => {
      try {
        // Fetch all videos from panel
        const response = await getVideosPanel({ 
          page: currentPage, 
          page_size: pageSize,
          sort_by: 'updated_at',
          sort_order: 'desc',
          status: filterData.status || null,
          application_name: filterData.fileName || null
        });
        
        if (response && response.videos) {
          // Filter for videos with status "processing" only
          const processingVideos = response.videos.filter(video => video.status === 'processing');
          
          if (processingVideos.length > 0) {
            // Update only processing videos in the table data
            setTableData(prevData => {
              const updatedData = [...prevData];
              const processingMap = new Map(processingVideos.map(v => [v.id, v]));
              
              // Update only the processing videos
              updatedData.forEach((item, index) => {
                const processingVideo = processingMap.get(item.id);
                if (processingVideo) {
                  // Update status and lastActivity for this video only
                  const updatedDate = new Date(processingVideo.updated_at);
                  const formatDate = (date) => {
                    const dateStr = date.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    });
                    const timeStr = date.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit', 
                      hour12: true 
                    });
                    return `${dateStr}, ${timeStr}`;
                  };
                  
                  updatedData[index] = {
                    ...item,
                    status: processingVideo.status,
                    lastActivity: formatDate(updatedDate),
                    job_id: processingVideo.job_id || item.job_id
                  };
                }
              });
              
              return updatedData;
            });
            
            // If we have a current job ID being viewed, update its status
            if (currentJobId) {
              const currentVideo = processingVideos.find(v => v.job_id === currentJobId);
              if (currentVideo) {
                // Get detailed job status for the processing dialog
                try {
                  const jobStatus = await getJobStatus(currentJobId);
                  if (jobStatus) {
                    setProcessingStatus(jobStatus);
                    
                    // Update current step based on status
                    const stepProgress = jobStatus.step_progress || {};
                    let stepIndex = 0;
                    
                    if (stepProgress.upload === 'completed') {
                      stepIndex = 0;
                    }
                    if (stepProgress.transcribe === 'processing') {
                      stepIndex = 1;
                    } else if (stepProgress.transcribe === 'completed') {
                      stepIndex = 1;
                    }
                    if (stepProgress.extract_frames === 'processing') {
                      stepIndex = 2;
                    } else if (stepProgress.extract_frames === 'completed') {
                      stepIndex = 2;
                    }
                    if (stepProgress.analyze_frames === 'processing') {
                      stepIndex = 3;
                    } else if (stepProgress.analyze_frames === 'completed') {
                      stepIndex = 3;
                    }
                    if (jobStatus.status === 'completed') {
                      stepIndex = 4;
                    }
                    
                    setCurrentStep(stepIndex);
                    
                    // If completed or failed, stop polling and close dialog
                    if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
                      if (intervalRef.current) {
                        clearInterval(intervalRef.current);
                        intervalRef.current = null;
                        setStatusPollingInterval(null);
                      }
                      
                      // Wait a bit then close and refresh
                      setTimeout(async () => {
                        setProcessingOpen(false);
                        setCurrentStep(0);
                        setProcessingStatus(null);
                        setCurrentJobId(null);
                        
                        // Refresh the list to show updated status
                        await fetchVideos();
                        
                        if (newEntryId) {
                          setNewEntryId(null);
                        }
                      }, 2000);
                    }
                  }
                } catch (error) {
                  console.error('Failed to get job status:', error);
                }
              } else {
                // Current video is no longer processing, stop polling for it
                if (intervalRef.current) {
                  clearInterval(intervalRef.current);
                  intervalRef.current = null;
                  setStatusPollingInterval(null);
                }
              }
            }
          } else {
            // No processing videos found, stop polling
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
              setStatusPollingInterval(null);
            }
            
            // Refresh the list to show final status
            await fetchVideos();
          }
        }
      } catch (error) {
        console.error('Failed to poll processing videos:', error);
        // Continue polling even on error (might be temporary network issue)
      }
    };
    
    // Poll immediately
    pollProcessingVideos();
    
    // Then poll every 5 seconds
    const interval = setInterval(pollProcessingVideos, 5000);
    intervalRef.current = interval; // Store in ref for closure access
    setStatusPollingInterval(interval);
    
    // Store interval ID for cleanup
    return interval;
  };
  
  // Legacy function name for backward compatibility
  const startStatusPolling = (jobId) => {
    if (!jobId) {
      console.warn('Cannot start status polling: no jobId provided');
      return;
    }
    
    // Set current job ID and start the unified polling
    setCurrentJobId(jobId);
    startProcessingVideoPolling();
  };
  
  // Cleanup polling on unmount or when processing closes
  useEffect(() => {
    return () => {
      if (statusPollingInterval) {
        clearInterval(statusPollingInterval);
      }
      if (backgroundRefreshIntervalRef.current) {
        clearInterval(backgroundRefreshIntervalRef.current);
        backgroundRefreshIntervalRef.current = null;
      }
      if (transferDialogTimeoutRef.current) {
        clearTimeout(transferDialogTimeoutRef.current);
        transferDialogTimeoutRef.current = null;
      }
    };
  }, [statusPollingInterval]);
  
  // Stop polling when processing dialog closes
  useEffect(() => {
    if (!processingOpen && statusPollingInterval) {
      clearInterval(statusPollingInterval);
      setStatusPollingInterval(null);
      setProcessingStatus(null);
      setCurrentJobId(null);
      
      // Only refresh if we were actually polling (user was watching a specific video)
      // Don't force refresh - let background refresh handle it naturally
      if (currentJobId) {
        // Small delay to let status update propagate
        setTimeout(() => {
          dataCache.clearByPattern('process-data:videos:');
          fetchVideos(currentPage, false); // Use cache if available
        }, 1000);
      }
    }
  }, [processingOpen, statusPollingInterval, currentPage, currentJobId]);

  // Smart background refresh: only refresh when needed, with intelligent intervals
  // Also start unified polling for processing videos
  useEffect(() => {
    // Check if there are any processing items
    const processingItems = tableData.filter(item => 
      item.status === 'processing' || item.status === 'uploaded'
    );
    const hasProcessingItems = processingItems.length > 0;
    
    // Start unified polling if there are processing videos and polling is not already active
    // Use a ref to track if polling is active to avoid multiple intervals
    if (hasProcessingItems && !statusPollingInterval) {
      startProcessingVideoPolling();
    } else if (!hasProcessingItems && statusPollingInterval) {
      // Stop polling if no processing items
      clearInterval(statusPollingInterval);
      setStatusPollingInterval(null);
    }

    // Clear any existing interval first
    if (backgroundRefreshIntervalRef.current) {
      clearInterval(backgroundRefreshIntervalRef.current);
      backgroundRefreshIntervalRef.current = null;
    }

    if (hasProcessingItems) {
      // Use adaptive refresh interval based on number of processing items
      // More items = slightly more frequent, but still reasonable
      const refreshInterval = Math.max(10000, 15000 - (processingItems.length * 1000)); // 10-15 seconds
      
      // Set up smart background refresh
      // fetchVideos will automatically detect changes and only update table if needed
      const interval = setInterval(async () => {
        try {
          // Fetch fresh data silently (won't show loading, will only update if changes detected)
          // fetchVideos will compare with cache and only update table if there are changes
          await fetchVideos(currentPage, false, true); // silent mode - no loading indicator, change detection enabled
        } catch (error) {
          console.error('Background refresh failed:', error);
        }
      }, refreshInterval);

      backgroundRefreshIntervalRef.current = interval;

      return () => {
        if (backgroundRefreshIntervalRef.current) {
          clearInterval(backgroundRefreshIntervalRef.current);
          backgroundRefreshIntervalRef.current = null;
        }
      };
    } else {
      // No processing items - stop background refresh completely
      if (backgroundRefreshIntervalRef.current) {
        clearInterval(backgroundRefreshIntervalRef.current);
        backgroundRefreshIntervalRef.current = null;
      }
    }
  }, [tableData, currentPage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!event.target.closest(`.${styles.filterDropdownWrapper}`)) {
        setUserDropdownOpen(false);
        setStatusDropdownOpen(false);
        setDatePickerOpen(false);
      }
      // Close more button dropdown
      if (!event.target.closest(`.${styles.moreButtonContainer}`)) {
        setOpenDropdownId(null);
      }
    };

    if (userDropdownOpen || statusDropdownOpen || datePickerOpen || openDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [userDropdownOpen, statusDropdownOpen, datePickerOpen, openDropdownId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (name === 'name' && nameError) {
      setNameError(false);
    }
    // Clear OpenAI key error when user makes changes
    // OpenAI key error check removed
    if (false && openAIKeyError) {
      setOpenAIKeyError(null);
    }
  };

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return styles.statusCompleted;
      case 'uploaded':
      case 'draft':
        return styles.statusDraft;
      case 'processing':
        return styles.statusProcessing;
      case 'failed':
        return styles.statusPending;
      case 'cancelled':
        return styles.statusPending;
      default:
        return '';
    }
  };

  const formatStatus = (status) => {
    if (!status) return 'Uploaded';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleRemoveSort = () => {
    setSortBy(null);
  };

  const handleSelectAll = (e) => {
    e.stopPropagation();
    const isChecked = e.target.checked;
    
    if (isChecked && tableData.length > 0) {
      // Select all items on current page
      const allIds = new Set(tableData.map(item => item.id));
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        allIds.forEach(id => newSet.add(id));
        return newSet;
      });
    } else {
      // Deselect all items on current page only
      const currentPageIds = new Set(tableData.map(item => item.id));
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        currentPageIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  };

  const handleSelectItem = (e, id) => {
    e.stopPropagation();
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) {
      alert('Please select at least one item to delete.');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete ${selectedItems.size} item(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const uploadIds = Array.from(selectedItems);
      const response = await bulkDeleteUploads(uploadIds, true); // permanent delete
      
      // Clear cache
      dataCache.clearByPattern('process-data:videos:');
      dataCache.clearByPattern('dashboard:');
      
      // Clear selection
      setSelectedItems(new Set());
      setSelectAll(false);
      
      // Refresh the list
      await fetchVideos(currentPage);
      
      alert(response.message || `Successfully deleted ${response.deleted_count || selectedItems.size} item(s)`);
    } catch (error) {
      console.error('Failed to delete items:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete items. Please try again.';
      alert(errorMessage);
    }
  };

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    setFilterData({ ...filterData, date });
    setDatePickerOpen(false);
  };

  const renderFilterCalendar = (monthDate, setMonthDate) => {
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay();
    const monthName = monthDate.toLocaleString('default', { month: 'long' });
    const year = monthDate.getFullYear();
    const days = [];

    // Previous month days
    const prevMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: prevMonthDays - i, isCurrentMonth: false, date: new Date(prevMonth.getFullYear(), prevMonth.getMonth(), prevMonthDays - i) });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth(), i);
      days.push({ day: i, isCurrentMonth: true, date });
    }

    // Next month days
    const remainingCells = 42 - days.length;
    for (let i = 1; i <= remainingCells; i++) {
      const date = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, i);
      days.push({ day: i, isCurrentMonth: false, date });
    }

    const navigateMonth = (direction) => {
      const newDate = new Date(monthDate);
      newDate.setMonth(monthDate.getMonth() + direction);
      setMonthDate(newDate);
    };

    const isSelected = (date) => {
      if (!selectedDate) return false;
      return date.getDate() === selectedDate.getDate() &&
             date.getMonth() === selectedDate.getMonth() &&
             date.getFullYear() === selectedDate.getFullYear();
    };

    return (
      <div className={styles.filterCalendar}>
        <div className={styles.filterCalendarHeader}>
          <button className={styles.filterCalendarNavButton} onClick={() => navigateMonth(-1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <div className={styles.filterCalendarMonthYear}>
            {monthName} {year}
          </div>
          <button className={styles.filterCalendarNavButton} onClick={() => navigateMonth(1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
        <div className={styles.filterCalendarWeekdays}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className={styles.filterCalendarWeekday}>{day}</div>
          ))}
        </div>
        <div className={styles.filterCalendarDays}>
          {days.map((dayObj, index) => (
            <button
              key={index}
              className={`${styles.filterCalendarDay} ${!dayObj.isCurrentMonth ? styles.filterCalendarDayOtherMonth : ''} ${isSelected(dayObj.date) ? styles.filterCalendarDaySelected : ''}`}
              onClick={() => handleDateSelect(dayObj.date)}
            >
              {dayObj.day}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Process Data - Epiplex',
    description: 'Process and manage video data extraction tasks. Create new processing jobs, track status, and manage your document processing workflow.',
    mainEntity: {
      '@type': 'SoftwareApplication',
      name: 'Epiplex Process Data',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web'
    }
  };

  return (
    <>
      <SEO
        title="Process Data"
        description="Process and manage video data extraction tasks. Create new processing jobs, track status in real-time, and manage your document processing workflow efficiently."
        keywords="process data, video processing, data extraction, document processing, video to document, processing jobs, workflow management"
        structuredData={structuredData}
      />
      <div className={`${styles.dashboard} ${processingOpen ? styles.blurred : ''}`}>
        <Layout>
          {/* OpenAI Key Missing Notification - Removed */}
          
          {/* Top Header */}
          <div className={styles.processDataHeader}>
            <h1 className={styles.processDataTitle}>Process Data</h1>
            <div className={styles.headerRight}>
              <button 
                className={styles.createButton} 
                onClick={handleCreateNew}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                <span>Create</span>
              </button>
            </div>
          </div>

          {/* Filtering and Sorting Section */}
          <div className={styles.filterSection}>
            <div className={styles.filterLeft}>
              {sortBy && (
                <div className={styles.sortTag}>
                  <span>Sort By: Last Updated Des</span>
                  <button className={styles.sortTagRemove} onClick={handleRemoveSort}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                </div>
              )}
            </div>
            <div className={styles.filterRight} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {selectedItems.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  style={{
                    padding: '8px 16px',
                    background: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.background = '#dc2626'}
                  onMouseLeave={(e) => e.target.style.background = '#ef4444'}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  Delete Selected ({selectedItems.size})
                </button>
              )}
              <button className={styles.moreFiltersButton} onClick={() => setFilterOpen(!filterOpen)}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="4" y1="21" x2="4" y2="14"></line>
                  <line x1="4" y1="10" x2="4" y2="3"></line>
                  <line x1="12" y1="21" x2="12" y2="12"></line>
                  <line x1="12" y1="8" x2="12" y2="3"></line>
                  <line x1="20" y1="21" x2="20" y2="16"></line>
                  <line x1="20" y1="12" x2="20" y2="3"></line>
                  <line x1="1" y1="14" x2="7" y2="14"></line>
                  <line x1="9" y1="8" x2="15" y2="8"></line>
                  <line x1="17" y1="16" x2="23" y2="16"></line>
                </svg>
                <span>More Filters</span>
              </button>
            </div>
          </div>

          {/* Filter Panel */}
          {filterOpen && (
            <div className={styles.filterPanel}>
              <div className={styles.filterPanelContent}>
                {/* User Dropdown */}
                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>User</label>
                  <div className={styles.filterDropdownWrapper}>
                    <button
                      className={styles.filterDropdownButton}
                      onClick={() => {
                        setUserDropdownOpen(!userDropdownOpen);
                        setStatusDropdownOpen(false);
                        setDatePickerOpen(false);
                      }}
                    >
                      <span className={filterData.user ? styles.filterSelectedValue : styles.filterPlaceholder}>
                        {filterData.user || '--Please select an option--'}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points={userDropdownOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}></polyline>
                      </svg>
                    </button>
                    {userDropdownOpen && (
                      <div className={styles.filterDropdownMenu}>
                        <div className={styles.filterSearchBox}>
                          <svg className={styles.filterSearchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="11" cy="11" r="8"></circle>
                            <path d="m21 21-4.35-4.35"></path>
                          </svg>
                          <input
                            type="text"
                            className={styles.filterSearchInput}
                            placeholder="Search"
                            value={userSearchQuery}
                            onChange={(e) => setUserSearchQuery(e.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className={styles.filterDropdownList}>
                          {users
                            .filter(user => user.toLowerCase().includes(userSearchQuery.toLowerCase()))
                            .map((user, index) => (
                              <div
                                key={index}
                                className={styles.filterDropdownItem}
                                onClick={() => {
                                  setFilterData({ ...filterData, user });
                                  setUserDropdownOpen(false);
                                  setUserSearchQuery('');
                                }}
                              >
                                <input type="checkbox" checked={filterData.user === user} readOnly />
                                <span>{user}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* File Name Field */}
                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>File Name</label>
                  <input
                    type="text"
                    className={styles.filterInput}
                    placeholder="Enter file name"
                    value={filterData.fileName}
                    onChange={(e) => setFilterData({ ...filterData, fileName: e.target.value })}
                  />
                </div>

                {/* Status Dropdown */}
                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>Status</label>
                  <div className={styles.filterDropdownWrapper}>
                    <button
                      className={styles.filterDropdownButton}
                      onClick={() => {
                        setStatusDropdownOpen(!statusDropdownOpen);
                        setUserDropdownOpen(false);
                        setDatePickerOpen(false);
                      }}
                    >
                      <span className={filterData.status ? styles.filterSelectedValue : styles.filterPlaceholder}>
                        {filterData.status || '--Please select an option--'}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points={statusDropdownOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}></polyline>
                      </svg>
                    </button>
                    {statusDropdownOpen && (
                      <div className={styles.filterDropdownMenu}>
                        <div className={styles.filterDropdownList}>
                          {statusOptions.map((status, index) => (
                            <div
                              key={index}
                              className={styles.filterDropdownItem}
                              onClick={() => {
                                setFilterData({ ...filterData, status });
                                setStatusDropdownOpen(false);
                              }}
                            >
                              <input type="checkbox" checked={filterData.status === status} readOnly />
                              <span>{status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Date Field with Calendar */}
                <div className={styles.filterField}>
                  <label className={styles.filterLabel}>Date</label>
                  <div className={styles.filterDropdownWrapper}>
                    <button
                      className={styles.filterDropdownButton}
                      onClick={() => {
                        setDatePickerOpen(!datePickerOpen);
                        setUserDropdownOpen(false);
                        setStatusDropdownOpen(false);
                      }}
                    >
                      <span className={selectedDate ? styles.filterSelectedValue : styles.filterPlaceholder}>
                        {selectedDate ? selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '--Please select an option--'}
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points={datePickerOpen ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}></polyline>
                      </svg>
                    </button>
                    {datePickerOpen && (
                      <div className={styles.filterCalendarMenu}>
                        {renderFilterCalendar(filterCalendarMonth, setFilterCalendarMonth)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.filterPanelFooter}>
                <button className={styles.filterApplyButton} onClick={() => {
                  // Apply filter logic here
                  setFilterOpen(false);
                }}>
                  Apply
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className={styles.tableContainer}>
            <table className={styles.processDataTable}>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      aria-label="Select all items"
                    />
                  </th>
                  <th>Name</th>
                  <th>Last Activity</th>
                  <th>Recipients</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" className={styles.emptyState}>
                      Loading...
                    </td>
                  </tr>
                ) : tableData.length === 0 ? (
                  <tr>
                    <td colSpan="6" className={styles.emptyState}>
                      No data available
                    </td>
                  </tr>
                ) : (
                  tableData.map((item) => (
                    <tr key={item.id}>
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedItems.has(item.id)}
                          onChange={(e) => handleSelectItem(e, item.id)}
                          style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                          aria-label={`Select ${item.name}`}
                        />
                      </td>
                      <td>
                        <div className={styles.documentNameCell}>
                          <div className={styles.documentIcon}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                          </div>
                          <div className={styles.documentNameInfo}>
                            <div className={styles.documentName}>{item.name}</div>
                            <div className={styles.documentCreated}>Created: {item.created}</div>
                          </div>
                        </div>
                      </td>
                      <td className={styles.lastActivityCell}>{item.lastActivity}</td>
                      <td>
                        <div className={styles.recipientsContainer}>
                          {item.recipients.map((recipient, idx) => (
                            <div key={idx} className={styles.recipientAvatar}>
                              {recipient.length === 1 ? (
                                <span className={styles.recipientInitial}>{recipient}</span>
                              ) : recipient === '3+' ? (
                                <span className={styles.recipientMore}>{recipient}</span>
                              ) : (
                                <div className={styles.recipientIcon}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                    <circle cx="12" cy="7" r="4"></circle>
                                  </svg>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <span className={`${styles.statusBadge} ${getStatusClass(item.status)}`}>
                          {formatStatus(item.status)}
                        </span>
                      </td>
                      <td>
                        <div className={styles.tableActions}>
                          {/* View button - only show when status is completed */}
                          {item.status === 'completed' && (
                            <button 
                              className={styles.viewButton}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (item.video_file_number) {
                                  // Navigate with query parameter - this will trigger fresh data fetch in document page
                                  router.push({
                                    pathname: '/document',
                                    query: { video: item.video_file_number }
                                  }, undefined, { shallow: false });
                                } else {
                                  router.push(`/document`);
                                }
                              }}
                            >
                              View
                            </button>
                          )}
                          <button 
                            className={styles.deleteButton}
                            onClick={(e) => handleDelete(e, item.id)}
                            title="Delete video"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                          {/* 3-dot menu - only show when status is NOT completed */}
                          {item.status !== 'completed' && (
                            <div className={styles.moreButtonContainer}>
                              <button 
                                className={styles.moreButton}
                                onClick={(e) => toggleDropdown(e, item.id)}
                              >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <circle cx="12" cy="12" r="1"></circle>
                                  <circle cx="19" cy="12" r="1"></circle>
                                  <circle cx="5" cy="12" r="1"></circle>
                                </svg>
                              </button>
                              {openDropdownId === item.id && (
                                <div className={styles.dropdownMenu}>
                                  {/* View Status - show when processing or uploaded */}
                                  {(item.status === 'processing' || item.status === 'uploaded') && (
                                    <button
                                      className={styles.dropdownItem}
                                      onClick={(e) => handleViewStatus(e, item)}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <circle cx="12" cy="12" r="10"></circle>
                                        <polyline points="12 6 12 12 16 14"></polyline>
                                      </svg>
                                      View Status
                                    </button>
                                  )}
                                  {/* Retry - only show when failed */}
                                  {item.status === 'failed' && (
                                    <button
                                      className={styles.dropdownItem}
                                      onClick={(e) => handleRetry(e, item)}
                                    >
                                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="23 4 23 10 17 10"></polyline>
                                        <polyline points="1 20 1 14 7 14"></polyline>
                                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                                      </svg>
                                      Retry
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className={styles.paginationContainer}>
              <div className={styles.paginationInfo}>
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
              </div>
              <div className={styles.paginationControls}>
                <button
                  className={styles.paginationButton}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                  Previous
                </button>
                
                <div className={styles.paginationNumbers}>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <button
                        key={pageNum}
                        className={`${styles.paginationNumber} ${currentPage === pageNum ? styles.paginationNumberActive : ''}`}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>
                
                <button
                  className={styles.paginationButton}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="9 18 15 12 9 6"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </Layout>

        {/* Create New Dialog */}
        {dialogOpen && (
          <div className={styles.dialogOverlay} onClick={handleCancel}>
            <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
              <div className={styles.dialogHeader}>
                <h2 className={styles.dialogTitle}>Create New</h2>
                <button className={styles.dialogCloseButton} onClick={handleCancel} aria-label="Close">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              <div className={styles.dialogBody}>
                {/* Name Field */}
                <div className={styles.formGroup}>
                  <label htmlFor="name" className={styles.label}>Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`${styles.input} ${nameError ? styles.inputError : ''}`}
                    placeholder="Enter name"
                    required
                  />
                  {nameError && (
                    <div className={styles.errorMessage}>Name is required</div>
                  )}
<<<<<<< HEAD
                  {/* OpenAI API Key Error Display - Removed */}
=======
                  {openAIKeyError && (
                    <div 
                      data-openai-error
                      className={styles.errorMessage} 
                      style={{
                        marginTop: '12px',
                        marginBottom: '12px',
                        padding: '16px',
                        backgroundColor: '#fef2f2',
                        border: '2px solid #fecaca',
                        borderRadius: '8px',
                        color: '#991b1b',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                      }}
                    >
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: '700', marginBottom: '8px', fontSize: '16px' }}>
                          OpenAI API Key Required
                        </div>
                        <div style={{ fontSize: '14px', marginBottom: '12px', lineHeight: '1.5' }}>
                          {openAIKeyError}
                        </div>
                        <div style={{ 
                          padding: '12px', 
                          backgroundColor: '#fff', 
                          borderRadius: '6px',
                          border: '1px solid #fecaca',
                          marginBottom: '8px'
                        }}>
                          <div style={{ fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#7f1d1d' }}>
                            To upload and process videos:
                          </div>
                          <div style={{ fontSize: '13px', color: '#991b1b', lineHeight: '1.6' }}>
                            1. Go to Settings page<br/>
                            2. Find the &quot;OpenAI API Key&quot; section<br/>
                            3. Enter your OpenAI API key (starts with sk-)<br/>
                            4. Click &quot;Save&quot; to store your key
                          </div>
                        </div>
                        <Link 
                          href="/settings" 
                          style={{ 
                            display: 'inline-block',
                            padding: '8px 16px',
                            backgroundColor: '#991b1b',
                            color: '#fff',
                            textDecoration: 'none',
                            borderRadius: '6px',
                            fontSize: '14px',
                            fontWeight: '600',
                            marginTop: '8px'
                          }}
                        >
                          Go to Settings to Add API Key →
                        </Link>
                      </div>
                    </div>
                  )}
>>>>>>> 5c508a052f7c950dd7f055669a56ce6dfb935771
                </div>

                {/* File Upload Area - Hide when URL is entered */}
                {!formData.fileUrl && (
                  <>
                    <div 
                      className={`${styles.uploadArea} ${isDragging ? styles.uploadAreaDragging : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <svg className={styles.uploadIcon} width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                      </svg>
                      <p className={styles.uploadText}>
                        Drag & Drop or <button type="button" className={styles.uploadLink} onClick={() => document.getElementById('file-input').click()}>Choose file</button> to upload
                      </p>
                      <p className={styles.uploadFormats}>Supported formats: MP4, AVI, MOV, MP3, WAV</p>
                      <input
                        type="file"
                        id="file-input"
                        className={styles.fileInput}
                        onChange={handleFileSelect}
                        accept=".mp4,.avi,.mov,.mp3,.wav"
                        multiple
                      />
                    </div>

                    {/* Uploaded File Status */}
                    {formData.file && (
                      <div className={styles.uploadedFile}>
                        <div className={styles.uploadedFileIcon}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                          </svg>
                        </div>
                        <div className={styles.uploadedFileInfo}>
                          <div className={styles.uploadedFileName}>{formData.file.name}</div>
                          <div className={styles.uploadedFileSize}>{(formData.file.size / (1024 * 1024)).toFixed(2)} MB</div>
                          {isUploading && (
                            <div className={styles.uploadProgress}>
                              <div className={styles.uploadProgressBar}>
                                <div className={styles.uploadProgressFill} style={{ width: `${uploadProgress}%` }}></div>
                              </div>
                              <span className={styles.uploadProgressText}>{uploadProgress}%</span>
                            </div>
                          )}
                        </div>
                        <button className={styles.uploadedFileRemove} onClick={handleRemoveFile} aria-label="Remove file">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Separator - Only show when neither file nor URL is selected */}
                {!formData.file && !formData.fileUrl && (
                  <div className={styles.uploadSeparator}>
                    <span>or</span>
                  </div>
                )}

                {/* Import from URL - Hide when file is selected */}
                {!formData.file && (
                  <div className={styles.urlImportSection}>
                    <label htmlFor="fileUrl" className={styles.label}>Import from URL</label>
                    <div className={styles.urlInputGroup}>
                      <input
                        type="url"
                        id="fileUrl"
                        name="fileUrl"
                        value={formData.fileUrl}
                        onChange={handleUrlInputChange}
                        className={styles.urlInput}
                        placeholder="Add file URL"
                      />
                      <button type="button" className={styles.urlUploadButton}>Upload</button>
                    </div>
                  </div>
                )}
              </div>
              <div className={styles.dialogFooter}>
                <a href="#" className={styles.helpCenterLink}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                  </svg>
                  Help Center
                </a>
                <div className={styles.dialogFooterButtons}>
                  <button className={styles.cancelButton} onClick={handleCancel}>
                    Cancel
                  </button>
                  <button 
                    className={styles.startButton} 
                    onClick={handleStart}
                    disabled={isUploading || (uploadProgress > 0 && uploadProgress < 100) || !formData.file}
                    style={{
                      opacity: (isUploading || (uploadProgress > 0 && uploadProgress < 100) || !formData.file) ? 0.5 : 1,
                      cursor: (isUploading || (uploadProgress > 0 && uploadProgress < 100) || !formData.file) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isUploading && uploadProgress < 100 ? `Uploading... ${uploadProgress}%` : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Processing Animation */}
        {processingOpen && (
          <div className={styles.processingOverlay}>
            <div className={styles.processingContainer}>
              <div style={{ 
                position: 'relative', 
                width: '100%',
                marginBottom: '20px'
              }}>
                <h2 className={styles.processingTitle} style={{ marginBottom: 0 }}>Processing Video Extraction</h2>
                <button
                  onClick={() => {
                    setProcessingOpen(false);
                    setProcessingStatus(null);
                    setCurrentJobId(null);
                    setCurrentStep(0);
                    if (statusPollingInterval) {
                      clearInterval(statusPollingInterval);
                      setStatusPollingInterval(null);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    top: '0',
                    right: '0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                    transition: 'background-color 0.2s',
                    zIndex: 10
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  aria-label="Close processing dialog"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#6b7280' }}>
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
              
              {/* Show status message */}
              {processingStatus && processingStatus.message && (
                <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: processingStatus.progress !== undefined ? '8px' : '0' }}>
                    {processingStatus.message}
                  </div>
                  {processingStatus.progress !== undefined && (
                    <div style={{ fontSize: '18px', fontWeight: '600', color: '#374151' }}>
                      {processingStatus.progress}%
                    </div>
                  )}
                </div>
              )}
              
              {/* Show progress percentage if available but no message */}
              {processingStatus && processingStatus.progress !== undefined && !processingStatus.message && (
                <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#374151' }}>
                    {processingStatus.progress}%
                  </div>
                </div>
              )}
              
              {/* Show default message if no status yet */}
              {!processingStatus && (
                <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', color: '#6b7280' }}>
                    Initializing processing...
                  </div>
                </div>
              )}
              
              {/* Show error if failed */}
              {processingStatus && processingStatus.status === 'failed' && (
                <div style={{ 
                  marginBottom: '20px', 
                  padding: '12px', 
                  backgroundColor: '#fee2e2', 
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '14px'
                }}>
                  <strong>Error:</strong> {processingStatus.error || processingStatus.message || 'Processing failed'}
                </div>
              )}
              
              <div className={styles.currentStepContainer}>
                {processingSteps.map((step, index) => {
                  if (index === currentStep) {
                    const isLastStep = index === processingSteps.length - 1;
                    const isCompleted = processingStatus && processingStatus.status === 'completed';
                    return (
                      <div key={step.id} className={styles.singleStep}>
                        <div className={`${styles.stepCircle} ${styles.stepCircleActive} ${styles[`stepCircle${step.number}`]} ${isLastStep ? styles.stepCircleLast : ''} ${isCompleted ? styles.stepCircleCompleted : ''}`}>
                          <span className={styles.stepNumber}>{isCompleted && isLastStep ? '✓' : step.number}</span>
                        </div>
                        <div className={styles.stepLabelContainer}>
                          <span className={styles.stepLabelActive}>
                            {step.label}
                          </span>
                          {!isLastStep && !isCompleted && (
                            <div className={styles.loadingDots}>
                              <span></span>
                              <span></span>
                              <span></span>
                            </div>
                          )}
                          {isCompleted && isLastStep && (
                            <div style={{ color: '#10b981', fontSize: '14px', marginTop: '8px' }}>
                              Processing completed successfully!
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        )}

        {/* Data Transfer Dialog */}
        {showTransferDialog && (
          <div className={styles.transferDialogOverlay}>
            <div className={styles.transferDialog}>
              <div className={styles.transferHeader}>
                <h3 className={styles.transferTitle}>Storing Video to Database</h3>
              </div>
              <div className={styles.transferContent}>
                {/* Video Side */}
                <div className={styles.transferSide}>
                  <div className={styles.transferIconContainer}>
                    <div className={styles.videoIcon}>
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="23 7 16 12 23 17 23 7"></polygon>
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                      </svg>
                    </div>
                    <div className={styles.transferLabel}>Video File</div>
                    <div className={styles.transferFileName}>{formData.file?.name || 'Video.mp4'}</div>
                  </div>
                </div>

                {/* Animated Arrow */}
                <div className={styles.transferArrowContainer}>
                  <div className={styles.transferArrow}>
                    <svg width="80" height="40" viewBox="0 0 80 40" fill="none">
                      <path
                        d="M0 20 L60 20 M60 20 L50 10 M60 20 L50 30"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={styles.arrowPath}
                      />
                      {/* Animated dots */}
                      <circle cx="10" cy="20" r="3" className={styles.arrowDot} style={{ animationDelay: '0s' }}></circle>
                      <circle cx="30" cy="20" r="3" className={styles.arrowDot} style={{ animationDelay: '0.3s' }}></circle>
                      <circle cx="50" cy="20" r="3" className={styles.arrowDot} style={{ animationDelay: '0.6s' }}></circle>
                    </svg>
                  </div>
                  <div className={styles.transferProgress}>
                    <div className={styles.transferProgressBar}>
                      <div 
                        className={styles.transferProgressFill} 
                        style={{ width: `${transferProgress}%` }}
                      ></div>
                    </div>
                    <div className={styles.transferProgressText}>{transferProgress}%</div>
                  </div>
                </div>

                {/* Database Side */}
                <div className={styles.transferSide}>
                  <div className={styles.transferIconContainer}>
                    <div className={styles.databaseIcon}>
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
                        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
                        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
                      </svg>
                    </div>
                    <div className={styles.transferLabel}>Database</div>
                    <div className={styles.transferStatus}>
                      {transferProgress < 100 ? 'Storing...' : 'Stored ✓'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

