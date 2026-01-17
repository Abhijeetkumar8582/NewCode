import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import styles from '../styles/Dashboard.module.css';
import { logPageView, logDocumentView } from '../lib/activityLogger';
import { getVideosPanel, getDocument, bulkDeleteUploads } from '../lib/api';
import dataCache, { CACHE_DURATION } from '../lib/dataCache';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9001';

export default function Document() {
  const router = useRouter();
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('transcribe');
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [documentData, setDocumentData] = useState(null);
  const [summaries, setSummaries] = useState([]);
  const [summariesLoading, setSummariesLoading] = useState(false);
  
  // Get user's first name from localStorage
  const getUserFirstName = () => {
    if (typeof window !== 'undefined') {
      try {
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          const fullName = user.full_name || user.name || '';
          return fullName.split(' ')[0] || 'U'; // Get first name, fallback to 'U'
        }
      } catch (e) {
        console.warn('Failed to parse user from localStorage:', e);
      }
    }
    return 'U'; // Default fallback
  };
  
  // Selection state
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [selectAll, setSelectAll] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 10;
  const [isInitialMount, setIsInitialMount] = useState(true);

  useEffect(() => {
    // Log page view
    logPageView('Documents');
    
    // Fetch videos on initial load
    fetchVideos(1);
    setIsInitialMount(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Update select all state when videos or selection changes
  useEffect(() => {
    if (videos.length > 0) {
      const allCurrentPageIds = videos.map(v => v.id);
      const allSelected = allCurrentPageIds.length > 0 && 
                         allCurrentPageIds.every(id => selectedItems.has(id));
      setSelectAll(allSelected);
    } else {
      setSelectAll(false);
    }
  }, [selectedItems, videos]);

  // Handle query parameter to open specific document
  useEffect(() => {
    const videoFileNumber = router.query.video;
    
    if (videoFileNumber) {
      // Clear previous data immediately when video parameter changes
      setDocumentData(null);
      setSummaries([]);
      setSelectedDocument(null);
      
      // Always fetch fresh data when video parameter changes
      const fetchVideoData = async () => {
        // Try to find video in current videos list first
        let video = null;
        if (videos && videos.length > 0) {
          video = videos.find(v => v.video_file_number === videoFileNumber);
        }
        
        // If video found in list, use it; otherwise create temp object
        const documentToLoad = video || {
          id: null,
          video_file_number: videoFileNumber,
          name: 'Loading...'
        };
        
        // Always force fresh fetch
        await handleRowClick(documentToLoad, true);
      };
      
      fetchVideoData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.video]);

  const getCacheKey = (page) => `document:videos:page:${page}`;

  const fetchVideos = async (page = currentPage) => {
    const cacheKey = getCacheKey(page);
    
    // Check cache first
    const cachedData = dataCache.get(cacheKey);
    if (cachedData) {
      setVideos(cachedData.videos);
      setTotalRecords(cachedData.totalRecords);
      setTotalPages(cachedData.totalPages);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await getVideosPanel({ 
        page: page, 
        page_size: pageSize,
        sort_by: 'updated_at',
        sort_order: 'desc'
      });
      if (response && response.videos && Array.isArray(response.videos)) {
        // Map API response to document format
        const mappedVideos = response.videos.map((video, index) => ({
          id: video.id,
          documentId: video.video_file_number || `DOC-${String((page - 1) * pageSize + index + 1).padStart(3, '0')}`,
          name: video.name || 'Untitled Video',
          type: 'Video',
          access: 'Public',
          fileSize: video.video_size_bytes ? `${(video.video_size_bytes / (1024 * 1024)).toFixed(1)} MB` : 'N/A',
          description: video.application_name || 'Video document',
          createdBy: 'You',
          createdDate: video.created_at ? new Date(video.created_at).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          }) : 'N/A',
          createdOn: video.created_at ? new Date(video.created_at).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          }) : 'N/A',
          avatar: 'https://ui-avatars.com/api/?name=You&background=random',
          video_file_number: video.video_file_number,
          status: video.status,
          video_id: video.id
        }));
        setVideos(mappedVideos);
        
        // Update pagination info
        const totalRecords = response.total !== undefined ? response.total : 0;
        const totalPages = Math.ceil(totalRecords / pageSize);
        
        setTotalRecords(totalRecords);
        setTotalPages(totalPages);

        // Cache the data
        dataCache.set(cacheKey, {
          videos: mappedVideos,
          totalRecords,
          totalPages
        }, CACHE_DURATION.VIDEO_LIST);
      } else {
        // Set empty array if no videos
        setVideos([]);
        setTotalRecords(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Failed to fetch videos:', error);
      // Set empty array on error
      setVideos([]);
      setTotalRecords(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (seconds) => {
    if (!seconds && seconds !== 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const fetchDocumentData = useCallback(async (videoFileNumber, forceRefresh = false) => {
    if (!videoFileNumber) {
      console.warn('fetchDocumentData called without videoFileNumber');
      setDocumentData(null);
      return;
    }
    
    const cacheKey = `document:data:${videoFileNumber}`;
    
    // If force refresh, clear cache and fetch fresh data
    if (forceRefresh) {
      dataCache.remove(cacheKey);
    } else {
    // Check cache first
    const cachedData = dataCache.get(cacheKey);
    if (cachedData) {
        // Verify cached data matches the requested video
        const cachedVideoNumber = cachedData.video_file_number || cachedData.video_metadata?.video_file_number;
        if (cachedVideoNumber === videoFileNumber) {
      setDocumentData(cachedData);
      
      // Extract summaries from cached data (summaries are now included in document response)
      if (cachedData.summaries && Array.isArray(cachedData.summaries)) {
        console.log('[fetchDocumentData] Found summaries in cached data:', cachedData.summaries.length);
        setSummaries(cachedData.summaries);
        setSummariesLoading(false);
      } else {
        console.log('[fetchDocumentData] No summaries in cached data');
        setSummaries([]);
        setSummariesLoading(false);
      }
      
      // Update selected document with cached data including name
      setSelectedDocument(prev => {
            if (prev && prev.video_file_number === videoFileNumber && cachedData) {
          return {
            ...prev,
            name: cachedData.video_metadata?.name || cachedData.name || prev.name || 'Untitled Video', // Update name from cached data
            id: cachedData.video_metadata?.video_id || prev.id, // Ensure id is set
            video_id: cachedData.video_metadata?.video_id || prev.video_id, // Ensure video_id is set
            transcript: cachedData.transcript || null,
            transcribe: (cachedData.frames && Array.isArray(cachedData.frames)) 
              ? cachedData.frames.map((frame, index) => ({
                  id: frame.frame_id || index + 1,
                  text: frame.description || frame.ocr_text || '',
                  timestamp: formatTimestamp(frame.timestamp)
                }))
              : [],
            voiceExtraction: (cachedData.frames && Array.isArray(cachedData.frames))
              ? cachedData.frames.map(f => f.description || f.ocr_text || '').filter(Boolean).join(' ') 
              : 'No voice extraction available',
            summary: cachedData.summary || 'No summary available',
            steps: (cachedData.frames && Array.isArray(cachedData.frames))
                  ? cachedData.frames.map((frame, index) => {
                      // Extract meta_tags from GPT response dynamically - always use what GPT returns
                      let metaTags = [];
                      
                      // First, check if meta_tags exists directly in gpt_response (primary source)
                      if (frame.gpt_response && frame.gpt_response.meta_tags !== undefined && frame.gpt_response.meta_tags !== null) {
                        // Use meta_tags directly from GPT response (even if empty array)
                        if (Array.isArray(frame.gpt_response.meta_tags)) {
                          metaTags = frame.gpt_response.meta_tags;
                        } else if (typeof frame.gpt_response.meta_tags === 'string') {
                          metaTags = [frame.gpt_response.meta_tags];
                        }
                      }
                      // Also check if meta_tags exists at top level of frame (fallback check)
                      else if (frame.meta_tags !== undefined && frame.meta_tags !== null) {
                        if (Array.isArray(frame.meta_tags)) {
                          metaTags = frame.meta_tags;
                        } else if (typeof frame.meta_tags === 'string') {
                          metaTags = [frame.meta_tags];
                        }
                      }
                      
                      // Only use fallback if GPT didn't provide meta_tags at all
                      // If meta_tags is an empty array, that means GPT was called but returned no tags - keep it empty
                      if (metaTags.length === 0) {
                        const hasGptResponse = frame.gpt_response !== undefined && frame.gpt_response !== null;
                        const hasMetaTagsInGpt = hasGptResponse && frame.gpt_response.meta_tags !== undefined && frame.gpt_response.meta_tags !== null;
                        
                        // Only use fallback if GPT response doesn't exist OR meta_tags is truly missing (not empty array)
                        if (!hasGptResponse || !hasMetaTagsInGpt) {
                          // Fallback: use OCR or generic tags only if GPT didn't provide meta_tags
                          if (frame.ocr_text) {
                            metaTags = ['ocr', 'text'];
                          } else if (hasGptResponse) {
                            // GPT was called but no meta_tags field - use generic
                            metaTags = ['gpt', 'analysis'];
                          } else {
                            // No GPT response at all
                            metaTags = ['frame', 'analysis'];
                          }
                        }
                        // If hasGptResponse and hasMetaTagsInGpt but metaTags.length === 0, 
                        // that means GPT returned empty array - keep it empty (don't use fallback)
                      }
                      
                      return {
                  id: frame.frame_id || index + 1,
                  timestamp: formatTimestamp(frame.timestamp),
                  description: frame.description || frame.ocr_text || 'Frame analysis',
                        metaTags: metaTags
                      };
                    })
              : []
          };
        }
        return prev;
      });
      return;
        } else {
          // Cached data doesn't match, clear it
          dataCache.remove(cacheKey);
        }
      }
    }

    try {
      console.log('Fetching fresh document data for video:', videoFileNumber);
      const data = await getDocument(videoFileNumber, true); // Include images
      console.log('Document data received:', data);
      console.log('Document data frames:', data?.frames?.length || 0);
      console.log('Document data transcript:', data?.transcript ? 'Present' : 'Missing');
      console.log('Document data summaries:', data?.summaries?.length || 0);
      
      // Verify the data matches the requested video
      const dataVideoNumber = data?.video_file_number || data?.video_metadata?.video_file_number;
      if (data && dataVideoNumber === videoFileNumber) {
        console.log('Setting document data:', {
          hasFrames: !!data.frames,
          framesCount: data.frames?.length || 0,
          hasTranscript: !!data.transcript,
          hasSummaries: !!data.summaries,
          summariesCount: data.summaries?.length || 0
        });
      setDocumentData(data || null);
      
      // Cache the data
        dataCache.set(cacheKey, data, CACHE_DURATION.DOCUMENT_DATA);
        
        // Extract summaries from document data (summaries are now included in document response)
        if (data.summaries && Array.isArray(data.summaries)) {
          console.log('[fetchDocumentData] Found summaries in document response:', data.summaries.length);
          setSummaries(data.summaries);
          setSummariesLoading(false);
        } else {
          console.log('[fetchDocumentData] No summaries in document response');
          setSummaries([]);
          setSummariesLoading(false);
        }
      
      // Update selected document with real data including name
      setSelectedDocument(prev => {
          if (prev && prev.video_file_number === videoFileNumber && data) {
          return {
            ...prev,
            name: data.video_metadata?.name || data.name || prev.name || 'Untitled Video', // Update name from documentData
            id: data.video_metadata?.video_id || prev.id, // Ensure id is set from documentData
            video_id: data.video_metadata?.video_id || prev.video_id, // Ensure video_id is set
            transcript: data.transcript || null,
            transcribe: (data.frames && Array.isArray(data.frames)) 
              ? data.frames.map((frame, index) => ({
                  id: frame.frame_id || index + 1,
                  text: frame.description || frame.ocr_text || '',
                  timestamp: formatTimestamp(frame.timestamp)
                }))
              : [],
            voiceExtraction: (data.frames && Array.isArray(data.frames))
              ? data.frames.map(f => f.description || f.ocr_text || '').filter(Boolean).join(' ') 
              : 'No voice extraction available',
            summary: data.summary || 'No summary available',
            steps: (data.frames && Array.isArray(data.frames))
              ? data.frames.map((frame, index) => {
                      // Extract meta_tags from GPT response dynamically - always use what GPT returns
                      let metaTags = [];
                      
                      // Check if gpt_response exists and has meta_tags
                  if (frame.gpt_response) {
                        // GPT was called, check for meta_tags
                        if (frame.gpt_response.meta_tags !== undefined && frame.gpt_response.meta_tags !== null) {
                          // Use meta_tags directly from GPT response (even if empty array)
                    if (Array.isArray(frame.gpt_response.meta_tags)) {
                      metaTags = frame.gpt_response.meta_tags;
                          } else if (typeof frame.gpt_response.meta_tags === 'string') {
                      metaTags = [frame.gpt_response.meta_tags];
                    }
                  }
                      }
                      
                      // Only use fallback if GPT didn't provide meta_tags at all
                      // If meta_tags is an empty array, that means GPT was called but returned no tags - keep it empty
                      if (metaTags.length === 0) {
                        const hasGptResponse = frame.gpt_response !== undefined && frame.gpt_response !== null;
                        const hasMetaTagsInGpt = hasGptResponse && frame.gpt_response.meta_tags !== undefined && frame.gpt_response.meta_tags !== null;
                        
                        // Only use fallback if GPT response doesn't exist OR meta_tags is truly missing (not empty array)
                        if (!hasGptResponse || !hasMetaTagsInGpt) {
                          // Fallback: use OCR or generic tags only if GPT didn't provide meta_tags
                          if (frame.ocr_text) {
                            metaTags = ['ocr', 'text'];
                          } else if (hasGptResponse) {
                            // GPT was called but no meta_tags field - use generic
                            metaTags = ['gpt', 'analysis'];
                          } else {
                            // No GPT response at all
                            metaTags = ['frame', 'analysis'];
                          }
                        }
                        // If hasGptResponse and hasMetaTagsInGpt but metaTags.length === 0, 
                        // that means GPT returned empty array - keep it empty (don't use fallback)
                  }
                  
                  return {
                    id: frame.frame_id || index + 1,
                    timestamp: formatTimestamp(frame.timestamp),
                    description: frame.description || frame.ocr_text || 'Frame analysis',
                    metaTags: metaTags
                  };
                })
              : []
          };
        }
        return prev;
      });
      } else {
        // Data doesn't match requested video
        console.warn('Fetched data does not match requested video:', {
          requested: videoFileNumber,
          received: dataVideoNumber,
          data: data
        });
        setDocumentData(null);
      }
    } catch (error) {
      console.error('Failed to fetch document:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status
      });
      // Set empty data on error but show a message
      setDocumentData(null);
      // You might want to show a toast/notification here
    }
  }, []);

  // Removed dummy data - using real data from API

  const handleRowClick = useCallback(async (document, forceRefresh = true) => {
    if (!document) return;
    
    // Clear previous data immediately when switching documents
    setDocumentData(null);
    setSummaries([]);
    setSelectedDocument(document);
    setDetailViewOpen(true);
    setActiveTab('transcribe'); // Reset to first tab when opening
    
    // Log document view
    if (document && document.video_file_number) {
      logDocumentView(document.video_file_number, {
        video_id: document.id,
        name: document.name || 'Unknown'
      });
      
      console.log('Fetching fresh document data for:', document.video_file_number, 'forceRefresh:', forceRefresh);
      
      // Always fetch fresh document data (force refresh by default)
      await fetchDocumentData(document.video_file_number, forceRefresh);
      
      // Summaries are included in documentData response, they will be extracted when documentData loads
      console.log('[handleRowClick] Summaries will be extracted from documentData when it loads');
    } else {
      // If no video_file_number, set empty data
      setDocumentData(null);
      setSummaries([]);
    }
  }, [fetchDocumentData]);

  // Extract summaries from documentData when it loads (summaries are included in document response)
  useEffect(() => {
    if (documentData) {
      console.log('[useEffect] documentData updated:', {
        hasSummaries: !!documentData.summaries,
        summariesType: typeof documentData.summaries,
        summariesIsArray: Array.isArray(documentData.summaries),
        summariesLength: documentData.summaries?.length || 0,
        hasSummaryText: !!documentData.summary_text,
        summaryTextLength: documentData.summary_text?.length || 0
      });
      
      // Set loading state based on whether documentData is still being fetched
      if (documentData.summaries !== undefined) {
        // Summaries field exists (could be array or null)
        if (Array.isArray(documentData.summaries) && documentData.summaries.length > 0) {
          console.log('[useEffect] Found summaries in documentData:', documentData.summaries.length);
          setSummaries(documentData.summaries);
        } else {
          // Summaries is null or empty array - check if summary_text exists
          if (documentData.summary_text && documentData.summary_text.trim()) {
            console.log('[useEffect] No summaries array but summary_text exists, creating summary object');
            // Create a summary object from summary_text
            setSummaries([{
              batch_number: 1,
              total_batches: 1,
              summary_text: documentData.summary_text,
              batch_start_frame: 1,
              batch_end_frame: documentData.total_frames || 1
            }]);
          } else {
            console.log('[useEffect] No summaries in documentData (null or empty)');
            setSummaries([]);
          }
        }
        setSummariesLoading(false);
      } else {
        // Document data loaded but summaries field not present - check summary_text
        if (documentData.summary_text && documentData.summary_text.trim()) {
          console.log('[useEffect] summaries field not present but summary_text exists');
          setSummaries([{
            batch_number: 1,
            total_batches: 1,
            summary_text: documentData.summary_text,
            batch_start_frame: 1,
            batch_end_frame: documentData.total_frames || 1
          }]);
        } else {
          console.log('[useEffect] documentData loaded but summaries field not present');
          setSummaries([]);
        }
        setSummariesLoading(false);
      }
    } else {
      // Document data is being fetched, show loading
      setSummariesLoading(true);
    }
  }, [documentData]);

  const handleCloseDetail = () => {
    setDetailViewOpen(false);
    setSelectedDocument(null);
  };

  const handleSelectAll = (e) => {
    e.stopPropagation();
    const isChecked = e.target.checked;
    
    if (isChecked && videos.length > 0) {
      // Select all items on current page
      const allIds = new Set(videos.map(video => video.id));
      setSelectedItems(prev => {
        const newSet = new Set(prev);
        allIds.forEach(id => newSet.add(id));
        return newSet;
      });
    } else {
      // Deselect all items on current page only
      const currentPageIds = new Set(videos.map(video => video.id));
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
    setSelectAll(newSelected.size === videos.length && videos.length > 0);
  };

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) {
      alert('Please select at least one document to delete.');
      return;
    }

    if (!confirm(`Are you sure you want to permanently delete ${selectedItems.size} document(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      const uploadIds = Array.from(selectedItems);
      const response = await bulkDeleteUploads(uploadIds, true); // permanent delete
      
      // Clear cache
      dataCache.clearByPattern('document:videos:');
      dataCache.clearByPattern('dashboard:');
      
      // Clear selection
      setSelectedItems(new Set());
      setSelectAll(false);
      
      // Refresh the list
      await fetchVideos(currentPage);
      
      alert(response.message || `Successfully deleted ${response.deleted_count || selectedItems.size} document(s)`);
    } catch (error) {
      console.error('Failed to delete documents:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete documents. Please try again.';
      alert(errorMessage);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Prevent row click
    if (!confirm('Are you sure you want to permanently delete this document? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await bulkDeleteUploads([id], true); // permanent delete
      
      // Clear cache
      dataCache.clearByPattern('document:videos:');
      dataCache.clearByPattern('dashboard:');
      
      // Refresh the list
      await fetchVideos(currentPage);
      
      alert(response.message || 'Document deleted successfully');
    } catch (error) {
      console.error('Failed to delete:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to delete document. Please try again.';
      alert(errorMessage);
    }
  };

  const handleEdit = useCallback(async (e, document) => {
    e.stopPropagation(); // Prevent row click
    
    // Use handleRowClick to ensure consistent behavior and fresh data fetch
    await handleRowClick(document, true);
  }, [handleRowClick]);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Documents - Epiplex',
    description: 'Browse and manage your processed documents. View transcriptions, voice extractions, summaries, and PDF documents.',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: videos?.length || 0,
      itemListElement: (videos || []).map((doc, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'Document',
          name: doc.name,
          description: doc.description || ''
        }
      }))
    }
  };

  return (
    <>
      <SEO
        title="Documents"
        description="Browse and manage your processed documents. View detailed transcriptions, voice extractions, AI-generated summaries, and access PDF documents from your video processing tasks."
        keywords="documents, processed documents, transcriptions, voice extraction, document management, PDF documents, video transcripts"
        structuredData={structuredData}
      />
      <div className={styles.dashboard}>
        <Layout>
          <div className={styles.contentHeader}>
            <h1 className={styles.pageTitle}>My Documents</h1>
          </div>

          {/* Filter and Action Section */}
          <div className={styles.filterSection} style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
            <div className={styles.filterLeft}>
              {/* Filter options can be added here */}
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
            </div>
          </div>

          <div className={styles.tableContainer}>
            <table className={styles.documentTable}>
              <thead>
                <tr>
                  <th style={{ width: '40px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                      aria-label="Select all documents"
                    />
                  </th>
                  <th>Name</th>
                  <th>Document Id</th>
                  <th>Type</th>
                  <th>Access</th>
                  <th>File Size</th>
                  <th>Username</th>
                  <th>Created On</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" className={styles.emptyState}>
                      Loading documents...
                    </td>
                  </tr>
                ) : !videos || videos.length === 0 ? (
                  <tr>
                    <td colSpan="9" className={styles.emptyState}>
                      No documents available
                    </td>
                  </tr>
                ) : (
                  videos.map((item, index) => (
                    <tr 
                      key={item.id} 
                      className={styles.documentTableRow}
                      onClick={() => handleRowClick(item)}
                    >
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
                              <line x1="16" y1="13" x2="8" y2="13"></line>
                              <line x1="16" y1="17" x2="8" y2="17"></line>
                            </svg>
                          </div>
                          <div className={styles.documentNameInfo}>
                            <div className={styles.documentName}>{item.name}</div>
                            <div className={styles.documentUploadDate}>Uploaded {item.createdOn}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={styles.documentId}>{item.documentId}</span>
                      </td>
                      <td>
                        <span className={styles.documentType}>{item.type}</span>
                      </td>
                      <td>
                        <span className={`${styles.documentAccess} ${item.access === 'Public' ? styles.documentAccessPublic : styles.documentAccessPrivate}`}>
                          {item.access}
                        </span>
                      </td>
                      <td>
                        <span className={styles.documentFileSize}>{item.fileSize}</span>
                      </td>
                      <td>
                        <div className={styles.documentUsernameCell}>
                          <div 
                            className={styles.documentUserAvatar}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: '#3b82f6',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#ffffff',
                              fontSize: '14px',
                              fontWeight: '600',
                              flexShrink: 0
                            }}
                            title={getUserFirstName()}
                          >
                            {getUserFirstName().charAt(0).toUpperCase()}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={styles.documentCreatedOn}>{item.createdOn}</span>
                      </td>
                      <td>
                        <div className={styles.documentTableActions}>
                          <button
                            className={styles.documentTableEditButton}
                            onClick={(e) => handleEdit(e, item)}
                            title="Edit"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          <button
                            className={styles.documentTableDeleteButton}
                            onClick={(e) => handleDelete(e, item.id)}
                            title="Delete"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalRecords > 0 && (
            <div className={styles.paginationContainer}>
              <div className={styles.paginationInfo}>
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} records
              </div>
              {totalPages > 1 && (
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
              )}
            </div>
          )}
        </Layout>

        {/* Document Detail View */}
        {detailViewOpen && selectedDocument && selectedDocument !== null && (
          <div className={styles.detailOverlay} onClick={handleCloseDetail}>
            <div className={styles.detailContainer} onClick={(e) => e.stopPropagation()}>
              <div className={styles.detailHeader}>
                <h2 className={styles.detailTitle}>
                  {selectedDocument?.name && selectedDocument.name !== 'Loading...' 
                    ? selectedDocument.name 
                    : (documentData?.video_metadata?.name || documentData?.name || 'Document')}
                </h2>
                <button className={styles.closeButton} onClick={handleCloseDetail}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>

              {/* Tab Navigation */}
              <nav className={styles.tabNavigation} role="tablist" aria-label="Document sections">
                <button
                  className={`${styles.tabButton} ${activeTab === 'transcribe' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('transcribe')}
                  role="tab"
                  aria-selected={activeTab === 'transcribe'}
                  aria-controls="transcribe-panel"
                >
                  Transcribe
                </button>
                <button
                  className={`${styles.tabButton} ${activeTab === 'steps' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('steps')}
                  role="tab"
                  aria-selected={activeTab === 'steps'}
                  aria-controls="steps-panel"
                >
                  Steps
                </button>
                <button
                  className={`${styles.tabButton} ${activeTab === 'pdf' ? styles.tabActive : ''}`}
                  onClick={() => setActiveTab('pdf')}
                  role="tab"
                  aria-selected={activeTab === 'pdf'}
                  aria-controls="pdf-panel"
                >
                  PDF
                </button>
              </nav>

              <article className={styles.detailContent}>
                {/* Transcribe Tab */}
                {activeTab === 'transcribe' && (
                  <section 
                    id="transcribe-panel"
                    className={styles.tabPanel}
                    role="tabpanel"
                    aria-labelledby="transcribe-tab"
                  >
                    <div className={styles.transcribeContainer} role="region" aria-label="Transcription content">
                      {(() => {
                        // Get transcript from documentData or selectedDocument
                        const transcript = documentData?.transcript || selectedDocument?.transcript;
                        
                        console.log('[Transcribe Tab] Transcript check:', {
                          hasDocumentData: !!documentData,
                          transcriptFromDocumentData: !!documentData?.transcript,
                          transcriptFromSelected: !!selectedDocument?.transcript,
                          transcriptLength: transcript?.length || 0
                        });
                        
                        // If transcript exists (even if it's the default message), display it
                        if (transcript && transcript.trim()) {
                          return (
                            <div className={styles.transcriptContainer}>
                              <h3 className={styles.transcriptTitle}>Transcription</h3>
                              <div className={styles.transcriptText}>
                                {transcript.split('\n').map((line, index) => (
                                  <p key={index}>{line || '\u00A0'}</p>
                                ))}
                              </div>
                            </div>
                          );
                        } else {
                          // If no transcript in DB, show default message
                          return (
                            <div className={styles.transcriptContainer}>
                              <h3 className={styles.transcriptTitle}>Transcription</h3>
                              <div className={styles.transcriptText}>
                                <p>video doesn&apos;t have any voice</p>
                              </div>
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </section>
                )}

                {/* PDF Tab */}
                {activeTab === 'pdf' && (
                  <section 
                    id="pdf-panel"
                    className={styles.tabPanel}
                    role="tabpanel"
                    aria-labelledby="pdf-tab"
                  >
                    <div className={styles.pdfContainer}>
                      {(() => {
                        // Try multiple ways to get video ID and PDF URL
                        const videoId = selectedDocument?.id || selectedDocument?.video_id || documentData?.video_metadata?.video_id || documentData?.video_id;
                        const summaryPdfUrl = documentData?.summary_pdf_url || 
                                              documentData?.video_metadata?.summary_pdf_url ||
                                              selectedDocument?.summary_pdf_url;
                        const videoFileNumber = selectedDocument?.video_file_number || documentData?.video_metadata?.video_file_number;
                        
                        console.log('PDF Tab Debug:', {
                          videoId,
                          summaryPdfUrl,
                          videoFileNumber,
                          hasDocumentData: !!documentData,
                          hasSelectedDocument: !!selectedDocument,
                          documentDataKeys: documentData ? Object.keys(documentData) : [],
                          selectedDocumentKeys: selectedDocument ? Object.keys(selectedDocument) : []
                        });
                        
                        // Check if summaryPdfUrl is a direct S3 URL (starts with https and contains s3 or epiplex bucket)
                        let pdfUrl = null;
                        if (summaryPdfUrl && (summaryPdfUrl.startsWith('https://') && (summaryPdfUrl.includes('s3') || summaryPdfUrl.includes('epiplex')))) {
                          // Direct S3 URL - use API endpoint to get presigned URL for private objects
                        if (videoId) {
                            pdfUrl = `${API_BASE_URL || 'http://localhost:9001'}/api/videos/${videoId}/summary-pdf`;
                            console.log('Using API endpoint for S3 PDF (will get presigned URL):', pdfUrl);
                          } else {
                            // Fallback to direct S3 URL if no videoId (may not work if bucket is private)
                            pdfUrl = summaryPdfUrl;
                            console.log('Using direct S3 URL (may require public access):', pdfUrl);
                          }
                        } else if (videoId) {
                          // Use API endpoint which will handle both S3 and local files
                          pdfUrl = `${API_BASE_URL || 'http://localhost:8000'}/api/videos/${videoId}/summary-pdf`;
                          console.log('Constructed PDF URL from videoId:', pdfUrl);
                        } else if (summaryPdfUrl) {
                          // Fallback: if we have a direct URL, use it
                          if (summaryPdfUrl.startsWith('http')) {
                            pdfUrl = summaryPdfUrl;
                            console.log('Using summaryPdfUrl as direct URL:', pdfUrl);
                          } else {
                            // Relative path - try to construct API URL if we can get videoId from documentData
                            const fallbackVideoId = documentData?.video_metadata?.video_id || documentData?.video_id;
                            if (fallbackVideoId) {
                              pdfUrl = `${API_BASE_URL || 'http://localhost:8000'}/api/videos/${fallbackVideoId}/summary-pdf`;
                              console.log('Constructed PDF URL from fallback videoId:', pdfUrl);
                            }
                          }
                        }
                        
                        if (!pdfUrl && !videoId) {
                          return (
                            <div className={styles.emptyState}>
                              <p>No PDF available. The video may still be processing or the summary PDF has not been generated yet.</p>
                            </div>
                          );
                        }
                          
                        if (pdfUrl) {
                          // Add token to PDF URL for iframe authentication
                          const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
                          const pdfUrlWithAuth = token ? `${pdfUrl}?token=${encodeURIComponent(token)}` : pdfUrl;
                          
                          return (
                            <>
                                <div style={{ width: '100%', height: '800px', border: '1px solid #ddd', borderRadius: '8px', overflow: 'hidden', marginBottom: '16px' }}>
                                  <iframe
                                  src={pdfUrlWithAuth}
                                    style={{ width: '100%', height: '100%', border: 'none' }}
                                    title={`PDF viewer for ${selectedDocument?.name || 'document'}`}
                                  />
                                </div>
                              <div className={styles.pdfActions} style={{ marginTop: '16px' }}>
                                <a
                                  href={pdfUrl || '#'}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.pdfLink}
                                  download={`${videoFileNumber || 'summary'}_summary.pdf`}
                                  aria-label={`Download PDF for ${selectedDocument?.name || 'document'}`}
                                  style={{ 
                                    display: 'inline-block',
                                    padding: '10px 20px',
                                    background: '#667eea',
                                    color: 'white',
                                    textDecoration: 'none',
                                    borderRadius: '6px',
                                    fontWeight: '500'
                                  }}
                                >
                                  Download PDF
                                </a>
                              </div>
                            </>
                          );
                        } else {
                          return (
                            <div className={styles.emptyState}>
                              PDF not available. The document may still be processing or summary PDF has not been generated yet.
                            </div>
                          );
                        }
                      })()}
                    </div>
                  </section>
                )}

                {/* Steps Tab */}
                {activeTab === 'steps' && (
                  <section 
                    id="steps-panel"
                    className={styles.tabPanel}
                    role="tabpanel"
                    aria-labelledby="steps-tab"
                  >
                    <div className={styles.stepTableContainer}>
                      <table className={styles.stepTable}>
                        <thead>
                          <tr>
                            <th>Image</th>
                            <th>Timestamp</th>
                            <th>Description</th>
                            <th>Meta Tags</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // Use documentData if available, otherwise use selectedDocument
                            let stepsData = [];
                            
                            console.log('[Steps Tab] Data check:', {
                              hasDocumentData: !!documentData,
                              framesCount: documentData?.frames?.length || 0,
                              hasSelectedDocument: !!selectedDocument,
                              selectedStepsCount: selectedDocument?.steps?.length || 0
                            });
                            
                            if (documentData?.frames && Array.isArray(documentData.frames) && documentData.frames.length > 0) {
                              // Ensure we process ALL frames, not just the last one
                              stepsData = documentData.frames.map((frame, index) => {
                                // Extract meta_tags from GPT response dynamically - always use what GPT returns
                                let metaTags = [];
                                
                                // First, check if meta_tags exists directly in gpt_response (primary source)
                                if (frame.gpt_response && frame.gpt_response.meta_tags !== undefined && frame.gpt_response.meta_tags !== null) {
                                  // Use meta_tags directly from GPT response (even if empty array)
                                  if (Array.isArray(frame.gpt_response.meta_tags)) {
                                    metaTags = frame.gpt_response.meta_tags;
                                  } else if (typeof frame.gpt_response.meta_tags === 'string') {
                                    metaTags = [frame.gpt_response.meta_tags];
                                  }
                                }
                                // Also check if meta_tags exists at top level of frame (fallback check)
                                else if (frame.meta_tags !== undefined && frame.meta_tags !== null) {
                                  if (Array.isArray(frame.meta_tags)) {
                                    metaTags = frame.meta_tags;
                                  } else if (typeof frame.meta_tags === 'string') {
                                    metaTags = [frame.meta_tags];
                                  }
                                }
                                
                                // Only use fallback if GPT didn't provide meta_tags at all
                                // If meta_tags is an empty array, that means GPT was called but returned no tags - keep it empty
                                if (metaTags.length === 0) {
                                  const hasGptResponse = frame.gpt_response !== undefined && frame.gpt_response !== null;
                                  const hasMetaTagsInGpt = hasGptResponse && frame.gpt_response.meta_tags !== undefined && frame.gpt_response.meta_tags !== null;
                                  
                                  // Only use fallback if GPT response doesn't exist OR meta_tags is truly missing (not empty array)
                                  if (!hasGptResponse || !hasMetaTagsInGpt) {
                                    // Fallback: use OCR or generic tags only if GPT didn't provide meta_tags
                                    if (frame.ocr_text) {
                                      metaTags = ['ocr', 'text'];
                                    } else if (hasGptResponse) {
                                      // GPT was called but no meta_tags field - use generic
                                      metaTags = ['gpt', 'analysis'];
                                    } else {
                                      // No GPT response at all
                                      metaTags = ['frame', 'analysis'];
                                    }
                                  }
                                  // If hasGptResponse and hasMetaTagsInGpt but metaTags.length === 0, 
                                  // that means GPT returned empty array - keep it empty (don't use fallback)
                                }
                                
                                // Construct base64 image data URL
                                let imageDataUrl = null;
                                if (frame.base64_image) {
                                  imageDataUrl = `data:image/jpeg;base64,${frame.base64_image}`;
                                }
                                
                                return {
                                id: frame.frame_id || index + 1,
                                timestamp: formatTimestamp(frame.timestamp),
                                description: frame.description || frame.ocr_text || 'Frame analysis',
                                  metaTags: metaTags,
                                  imageDataUrl: imageDataUrl
                                };
                              });
                            } else if (selectedDocument?.steps && Array.isArray(selectedDocument.steps)) {
                              stepsData = selectedDocument.steps;
                            }
                            
                            if (!stepsData || stepsData.length === 0) {
                              return (
                                <tr>
                                  <td colSpan="4" className={styles.emptyState}>
                                    <p>No step data available.</p>
                                    <p style={{ fontSize: '0.9em', color: '#666', marginTop: '8px' }}>
                                      {documentData ? 'The video processing may not have completed frame analysis yet.' : 'Loading document data...'}
                                    </p>
                                  </td>
                                </tr>
                              );
                            }
                            
                            return stepsData.map((step, index) => (
                              <tr key={`step-${step.id || index}-${step.timestamp || index}`}>
                                <td className={styles.stepImage}>
                                  {step.imageDataUrl ? (
                                    <img 
                                      src={step.imageDataUrl}
                                      alt={`Frame at ${step.timestamp}`}
                                      style={{
                                        width: '150px',
                                        height: 'auto',
                                        maxHeight: '100px',
                                        objectFit: 'contain',
                                        borderRadius: '4px',
                                        border: '1px solid #e0e0e0',
                                        cursor: 'pointer'
                                      }}
                                      onClick={() => {
                                        // Open image in new tab
                                        const newWindow = window.open();
                                        if (newWindow) {
                                          newWindow.document.write(`<img src="${step.imageDataUrl}" style="max-width: 100%; height: auto;" />`);
                                        }
                                      }}
                                      onError={(e) => {
                                        e.target.style.display = 'none';
                                      }}
                                    />
                                  ) : (
                                    <span style={{ color: '#999', fontSize: '12px' }}>No image</span>
                                  )}
                                </td>
                                <td className={styles.stepTimestamp}>{step.timestamp || '0:00'}</td>
                                <td className={styles.stepDescription}>{step.description || 'Frame analysis'}</td>
                                <td className={styles.stepMetaTags}>
                                  <div className={styles.metaTagsContainer}>
                                    {step.metaTags && Array.isArray(step.metaTags) && step.metaTags.length > 0 ? (
                                      step.metaTags.map((tag, tagIndex) => (
                                        <span key={tagIndex} className={styles.metaTag}>
                                          {tag}
                                        </span>
                                      ))
                                    ) : (
                                      <span className={styles.metaTag}>frame</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </section>
                )}

              </article>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
