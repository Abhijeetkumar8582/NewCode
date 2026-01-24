import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import styles from '../styles/Dashboard.module.css';
import { logPageView, logDocumentView } from '../lib/activityLogger';
import { getVideosPanel, getDocument, getDocumentByVideoId, bulkDeleteUploads, getVideoFrames, getVideoTranscript } from '../lib/api';
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
  const [framesData, setFramesData] = useState([]);
  const [framesLoading, setFramesLoading] = useState(false);
  const [transcriptData, setTranscriptData] = useState(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  
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

  // Fetch frames data when Steps tab is active
  useEffect(() => {
    const fetchFrames = async () => {
      if (activeTab === 'steps' && selectedDocument) {
        // Get video ID - prioritize video_id, then id
        const videoId = selectedDocument.video_id || selectedDocument.id;
        
        if (!videoId) {
          console.warn('No video ID found in selectedDocument:', selectedDocument);
          setFramesData([]);
          setFramesLoading(false);
          return;
        }
        
        try {
          setFramesLoading(true);
          console.log('Fetching frames from frame_analyses for video ID:', videoId, 'Document:', selectedDocument);
          
          // Fetch frames from frame_analyses table
          const framesResponse = await getVideoFrames(videoId);
          
          console.log('Frames API response:', framesResponse);
          
          if (framesResponse && framesResponse.frames && Array.isArray(framesResponse.frames)) {
            console.log(`Loaded ${framesResponse.frames.length} frames from frame_analyses table`);
            setFramesData(framesResponse.frames);
          } else {
            console.log('No frames data in response. Response structure:', framesResponse);
            setFramesData([]);
          }
        } catch (error) {
          console.error('Failed to fetch frames from frame_analyses:', error);
          console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
          });
          setFramesData([]);
        } finally {
          setFramesLoading(false);
        }
      } else if (activeTab !== 'steps') {
        // Clear frames data when switching away from Steps tab
        setFramesData([]);
      }
    };

    fetchFrames();
  }, [activeTab, selectedDocument]);

  // Fetch transcript data when Transcribe tab is active
  useEffect(() => {
    const fetchTranscript = async () => {
      if (activeTab === 'transcribe' && selectedDocument) {
        // Get video ID - prioritize video_id, then id
        const videoId = selectedDocument.video_id || selectedDocument.id;
        
        if (!videoId) {
          console.warn('No video ID found for transcript fetch:', selectedDocument);
          setTranscriptData(null);
          setTranscriptLoading(false);
          return;
        }
        
        try {
          setTranscriptLoading(true);
          console.log('Fetching transcript from job_status for video ID:', videoId);
          
          // Fetch transcript from job_status table
          const transcriptResponse = await getVideoTranscript(videoId);
          
          console.log('Transcript API response:', transcriptResponse);
          
          if (transcriptResponse && transcriptResponse.transcript) {
            console.log('Transcript loaded from job_status');
            setTranscriptData(transcriptResponse.transcript);
          } else {
            console.log('No transcript data in response');
            setTranscriptData(null);
          }
        } catch (error) {
          console.error('Failed to fetch transcript from job_status:', error);
          console.error('Error details:', {
            message: error.message,
            response: error.response?.data,
            status: error.response?.status
          });
          setTranscriptData(null);
        } finally {
          setTranscriptLoading(false);
        }
      } else if (activeTab !== 'transcribe') {
        // Clear transcript data when switching away from Transcribe tab
        setTranscriptData(null);
      }
    };

    fetchTranscript();
  }, [activeTab, selectedDocument]);

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
        const         mappedVideos = response.videos.map((video, index) => {
          // Use original_input (user-entered name) for display, fallback to name if not available
          const displayName = video.original_input || video.name || 'Untitled Video';
          const mapped = {
          id: video.id,
          documentId: video.video_file_number || `DOC-${String((page - 1) * pageSize + index + 1).padStart(3, '0')}`,
            name: displayName, // Use original_input as the display name
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
          };
          // #region agent log
          if (index === 0) { // Log first video only to avoid too many logs
            fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:144',message:'Video mapping',data:{originalVideoFileNumber:video.video_file_number,mappedVideoFileNumber:mapped.video_file_number,hasVideoFileNumber:!!video.video_file_number},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
          }
          // #endregion
          return mapped;
        });
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
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:207',message:'fetchDocumentData entry',data:{videoFileNumber,forceRefresh},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (!videoFileNumber) {
      console.warn('fetchDocumentData called without videoFileNumber');
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:211',message:'fetchDocumentData: videoFileNumber is null/undefined',data:{videoFileNumber},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
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
        const cachedVideoNumber = cachedData.video_file_number;
        if (cachedVideoNumber === videoFileNumber) {
          // Use cached data (already transformed)
      setDocumentData(cachedData);
      
          // Summaries are not in the new format
        setSummaries([]);
        setSummariesLoading(false);
      
          // Update selected document with cached data
      setSelectedDocument(prev => {
            if (prev && prev.video_file_number === videoFileNumber && cachedData) {
              const frames = cachedData.frames || [];
          return {
            ...prev,
                name: prev.name || 'Untitled Video',
                id: cachedData.video_id || prev.id,
                video_id: cachedData.video_id || prev.video_id,
                transcript: null,
                transcribe: frames.map((frame, index) => ({
                  id: frame.frame_id || index + 1,
                  text: frame.description || '',
                  timestamp: formatTimestamp(frame.timestamp)
                })),
                voiceExtraction: frames.map(f => f.description || '').filter(Boolean).join(' ') || 'No voice extraction available',
                summary: 'No summary available',
                steps: frames.map((frame, index) => ({
                  id: frame.frame_id || index + 1,
                  step_number: frame.step_number || index + 1,
                  timestamp: formatTimestamp(frame.timestamp),
                  description: frame.description || 'Step description',
                  metaTags: ['documentation', 'step'],
                  imageDataUrl: frame.base64_image ? `data:image/jpeg;base64,${frame.base64_image}` : null
                }))
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
      console.log('[fetchDocumentData] Fetching fresh document data for video:', videoFileNumber);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:272',message:'Before API call',data:{videoFileNumber},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const data = await getDocument(videoFileNumber, true); // Include images
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:275',message:'After API call - response received',data:{hasData:!!data,dataKeys:data?Object.keys(data):[],docDataLength:data?.documentation_data?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      console.log('[fetchDocumentData] Document data received:', data);
      console.log('[fetchDocumentData] Document data keys:', data ? Object.keys(data) : 'null');
      console.log('[fetchDocumentData] Document data documentation_data:', data?.documentation_data?.length || 0);
      
      // Verify the data matches the requested video
      const dataVideoNumber = data?.video_file_number;
      if (data && dataVideoNumber === videoFileNumber) {
        // Transform documentation_data to frames format for compatibility
        const frames = (data.documentation_data && Array.isArray(data.documentation_data))
          ? data.documentation_data.map((step, index) => ({
              frame_id: step.step_number || index + 1,
              step_number: step.step_number || index + 1,
              timestamp: (step.step_number || index + 1) * 1.0, // Approximate timestamp based on step number
              description: step.description || '',
              base64_image: step.image || null,
              image: step.image || null,
              ocr_text: null, // Not available in new format
              gpt_response: null // Not available in new format
            }))
          : [];
        
        // Create a transformed data object for compatibility
        const transformedData = {
          ...data,
          frames: frames,
          // For backward compatibility, also keep documentation_data
          documentation_data: data.documentation_data || []
        };
        
        console.log('Setting document data:', {
          hasDocumentationData: !!data.documentation_data,
          documentationDataCount: data.documentation_data?.length || 0,
          framesCount: frames.length,
          numImages: data.num_images
        });
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:309',message:'Before setDocumentData',data:{hasDocumentationData:!!data.documentation_data,docDataCount:data.documentation_data?.length||0,framesCount:frames.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        setDocumentData(transformedData);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:310',message:'After setDocumentData',data:{transformedDataKeys:Object.keys(transformedData)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        
        // Cache the transformed data
        dataCache.set(cacheKey, transformedData, CACHE_DURATION.DOCUMENT_DATA);
        
        // Summaries are not in the new format, set empty
          setSummaries([]);
          setSummariesLoading(false);
      
      // Update selected document with real data including name
      setSelectedDocument(prev => {
          if (prev && prev.video_file_number === videoFileNumber && data) {
          return {
            ...prev,
            name: prev.name || 'Untitled Video', // Keep existing name
            id: data.video_id || prev.id,
            video_id: data.video_id || prev.video_id,
            transcript: null, // Not available in new format
            transcribe: frames.map((frame, index) => ({
                  id: frame.frame_id || index + 1,
                  text: frame.description || '',
                  timestamp: formatTimestamp(frame.timestamp)
                })),
            voiceExtraction: frames.map(f => f.description || '').filter(Boolean).join(' ') || 'No voice extraction available',
            summary: 'No summary available',
            steps: frames.map((frame, index) => ({
                    id: frame.frame_id || index + 1,
                  step_number: frame.step_number || index + 1,
                    timestamp: formatTimestamp(frame.timestamp),
                  description: frame.description || 'Step description',
                  metaTags: ['documentation', 'step'],
                  imageDataUrl: frame.base64_image ? `data:image/jpeg;base64,${frame.base64_image}` : null
                }))
          };
        }
        return prev;
      });
      } else {
        // Data doesn't match requested video
        console.warn('[fetchDocumentData] Fetched data does not match requested video:', {
          requested: videoFileNumber,
          received: dataVideoNumber,
          data: data
        });
        setDocumentData(null);
      }
    } catch (error) {
      console.error('[fetchDocumentData] Failed to fetch document:', error);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:355',message:'API call error',data:{errorMessage:error.message,status:error.response?.status,errorData:error.response?.data,url:error.config?.url},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      console.error('[fetchDocumentData] Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        url: error.config?.url
      });
      
      // If it's a 404, that's expected if documentation doesn't exist
      if (error.response?.status === 404) {
        console.log('[fetchDocumentData] Documentation not found (404) - this is expected if documentation has not been generated');
        setDocumentData(null);
      } else {
        // Other errors
      setDocumentData(null);
      // You might want to show a toast/notification here
      }
    }
  }, []);

  // Fetch documentation by video ID (fallback when video_file_number is missing)
  const fetchDocumentDataByVideoId = useCallback(async (videoId, forceRefresh = false) => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:403',message:'fetchDocumentDataByVideoId entry',data:{videoId,forceRefresh},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (!videoId) {
      console.warn('fetchDocumentDataByVideoId called without videoId');
      setDocumentData(null);
      return;
    }
    
    const cacheKey = `document:data:video_id:${videoId}`;
    
    if (forceRefresh) {
      dataCache.remove(cacheKey);
    }
    
    try {
      console.log('[fetchDocumentDataByVideoId] Fetching fresh document data for video_id:', videoId);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:413',message:'Before API call (by video_id)',data:{videoId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      const data = await getDocumentByVideoId(videoId, true); // Include images
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:416',message:'After API call (by video_id) - response received',data:{hasData:!!data,dataKeys:data?Object.keys(data):[],docDataLength:data?.documentation_data?.length||0,hasDetail:!!data?.detail},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
      // #endregion
      console.log('[fetchDocumentDataByVideoId] Document data received:', data);
      
      // Check if response is an error (has 'detail' field from 404/error response)
      if (data && data.detail) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:420',message:'API returned error detail (likely 404)',data:{detail:data.detail},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        console.log('[fetchDocumentDataByVideoId] API returned error:', data.detail);
        setDocumentData(null);
        setSummaries([]);
        setSummariesLoading(false);
        return;
      }
      
      if (data && data.documentation_data) {
        // Transform documentation_data to frames format for compatibility
        const frames = (data.documentation_data && Array.isArray(data.documentation_data))
          ? data.documentation_data.map((step, index) => ({
              frame_id: step.step_number || index + 1,
              step_number: step.step_number || index + 1,
              timestamp: (step.step_number || index + 1) * 1.0,
              description: step.description || '',
              base64_image: step.image || null,
              image: step.image || null,
              ocr_text: null,
              gpt_response: null
            }))
          : [];
        
        const transformedData = {
          ...data,
          frames: frames,
          documentation_data: data.documentation_data || []
        };
        
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:433',message:'Before setDocumentData (by video_id)',data:{hasDocumentationData:!!data.documentation_data,docDataCount:data.documentation_data?.length||0,framesCount:frames.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
        // #endregion
        setDocumentData(transformedData);
        dataCache.set(cacheKey, transformedData, CACHE_DURATION.DOCUMENT_DATA);
        setSummaries([]);
        setSummariesLoading(false);
      }
    } catch (error) {
      console.error('[fetchDocumentDataByVideoId] Failed to fetch document:', error);
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:444',message:'API call error (by video_id)',data:{errorMessage:error.message,status:error.response?.status,errorData:error.response?.data},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      if (error.response?.status === 404) {
        console.log('[fetchDocumentDataByVideoId] Documentation not found (404)');
      }
      setDocumentData(null);
    }
  }, []);

  // Removed dummy data - using real data from API

  const handleRowClick = useCallback(async (document, forceRefresh = true) => {
    if (!document) return;
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:398',message:'handleRowClick entry',data:{hasDocument:!!document,documentKeys:document?Object.keys(document):[],videoFileNumber:document?.video_file_number,id:document?.id},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    // Clear previous data immediately when switching documents
    setDocumentData(null);
    setSummaries([]);
    setSelectedDocument(document);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:404',message:'setSelectedDocument called',data:{videoFileNumber:document?.video_file_number},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
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

  // Process documentData when it loads (new format uses documentation_data)
  useEffect(() => {
    if (documentData) {
      console.log('[useEffect] documentData updated:', {
        hasDocumentationData: !!documentData.documentation_data,
        documentationDataCount: documentData.documentation_data?.length || 0,
        hasFrames: !!documentData.frames,
        framesCount: documentData.frames?.length || 0,
        numImages: documentData.num_images
      });
      
      // New format doesn't have summaries, set empty
            setSummaries([]);
        setSummariesLoading(false);
    } else {
      // Document data is being fetched, show loading
      setSummariesLoading(true);
    }
  }, [documentData]);

  // Fetch documentation when Documentation tab is active and documentData is null
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:429',message:'useEffect for documentation tab',data:{activeTab,hasDocumentData:!!documentData,hasSelectedDocument:!!selectedDocument,videoFileNumber:selectedDocument?.video_file_number},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion
    if (activeTab === 'documentation' && !documentData && selectedDocument) {
      // Try video_file_number first, then fall back to video_id
      const videoFileNumber = selectedDocument?.video_file_number;
      const videoId = selectedDocument?.id || selectedDocument?.video_id;
      if (videoFileNumber) {
        console.log('[useEffect] Documentation tab active but no data, fetching...', videoFileNumber);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:433',message:'Calling fetchDocumentData from useEffect (by file_number)',data:{videoFileNumber},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        fetchDocumentData(videoFileNumber, true);
      } else if (videoId) {
        console.log('[useEffect] Documentation tab active but no data, fetching by video_id...', videoId);
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:440',message:'Calling fetchDocumentDataByVideoId from useEffect (fallback)',data:{videoId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
        // #endregion
        fetchDocumentDataByVideoId(videoId, true);
      }
    }
  }, [activeTab, documentData, selectedDocument?.video_file_number, selectedDocument?.id, selectedDocument?.video_id, fetchDocumentData, fetchDocumentDataByVideoId]);

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
                    : (selectedDocument?.name || 'Document')}
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
                <button
                  className={`${styles.tabButton} ${activeTab === 'documentation' ? styles.tabActive : ''}`}
                  onClick={() => {
                    // #region agent log
                    fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:850',message:'Documentation tab clicked',data:{hasDocumentData:!!documentData,hasSelectedDocument:!!selectedDocument,videoFileNumber:selectedDocument?.video_file_number,selectedDocKeys:selectedDocument?Object.keys(selectedDocument):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                    // #endregion
                    setActiveTab('documentation');
                    // If documentData is null and we have a selected document, try to fetch it
                    if (!documentData && selectedDocument) {
                      // Try video_file_number first, then fall back to video_id
                      const videoFileNumber = selectedDocument?.video_file_number;
                      const videoId = selectedDocument?.id || selectedDocument?.video_id;
                      if (videoFileNumber) {
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:856',message:'Calling fetchDocumentData from onClick (by file_number)',data:{videoFileNumber},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                        // #endregion
                        fetchDocumentData(videoFileNumber, true);
                      } else if (videoId) {
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:861',message:'Calling fetchDocumentDataByVideoId from onClick (fallback)',data:{videoId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                        // #endregion
                        fetchDocumentDataByVideoId(videoId, true);
                      } else {
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:866',message:'Cannot fetch: no identifier found',data:{selectedDocumentKeys:Object.keys(selectedDocument||{}),hasVideoFileNumber:!!selectedDocument?.video_file_number,hasVideoId:!!videoId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                        // #endregion
                      }
                    }
                  }}
                  role="tab"
                  aria-selected={activeTab === 'documentation'}
                  aria-controls="documentation-panel"
                >
                  Documentation
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
                      <div className={styles.transcriptContainer}>
                        <div className={styles.transcriptHeader}>
                          <h3 className={styles.transcriptTitle}>Transcription</h3>
                          {transcriptData && transcriptData.trim() && (
                            <div className={styles.transcriptStats}>
                              <span className={styles.transcriptStatBadge}>
                                {transcriptData.split(/\n+/).filter(line => line.trim()).length} segments
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {transcriptLoading ? (
                          <div className={styles.transcriptLoadingState}>
                            <div className={styles.transcriptSpinner}></div>
                            <p className={styles.transcriptLoadingText}>Loading transcript...</p>
                          </div>
                        ) : transcriptData && transcriptData.trim() ? (
                          <div className={styles.transcriptContent}>
                      {(() => {
                              // Parse transcript into chunks with timestamps
                              const lines = transcriptData.split('\n').filter(line => line.trim());
                              const chunks = [];
                              let currentChunk = null;
                              
                              lines.forEach((line, index) => {
                                // Check if line is a chunk header (e.g., [Chunk 1 ~0.0 min])
                                const chunkMatch = line.match(/\[Chunk\s+(\d+)\s*~([\d.]+)\s*min\]/i);
                                
                                if (chunkMatch) {
                                  // Save previous chunk if exists
                                  if (currentChunk) {
                                    chunks.push(currentChunk);
                                  }
                                  // Start new chunk
                                  currentChunk = {
                                    number: parseInt(chunkMatch[1]),
                                    timestamp: parseFloat(chunkMatch[2]),
                                    text: []
                                  };
                                } else if (currentChunk) {
                                  // Add line to current chunk
                                  currentChunk.text.push(line);
                                } else {
                                  // No chunk header found, treat as regular text
                                  if (chunks.length === 0 || chunks[chunks.length - 1].number === undefined) {
                                    // Create a default chunk for text without headers
                                    if (!currentChunk) {
                                      currentChunk = { number: 1, timestamp: 0, text: [] };
                                    }
                                    currentChunk.text.push(line);
                                  } else {
                                    chunks[chunks.length - 1].text.push(line);
                                  }
                                }
                        });
                        
                              // Add last chunk
                              if (currentChunk && currentChunk.text.length > 0) {
                                chunks.push(currentChunk);
                              }
                              
                              // If no chunks found, treat all lines as one chunk
                              if (chunks.length === 0) {
                                chunks.push({
                                  number: 1,
                                  timestamp: 0,
                                  text: lines
                                });
                              }
                              
                              return chunks.map((chunk, chunkIndex) => (
                                <div key={chunkIndex} className={styles.transcriptChunk}>
                                  <div className={styles.transcriptChunkHeader}>
                                    <span className={styles.transcriptChunkNumber}>
                                      Chunk {chunk.number}
                                    </span>
                                    <span className={styles.transcriptChunkTimestamp}>
                                      ~{chunk.timestamp.toFixed(1)} min
                                    </span>
                                  </div>
                                  <div className={styles.transcriptChunkText}>
                                    {chunk.text.map((textLine, lineIndex) => (
                                      <p key={lineIndex}>{textLine || '\u00A0'}</p>
                                ))}
                              </div>
                            </div>
                              ));
                            })()}
                              </div>
                        ) : (
                          <div className={styles.transcriptEmptyState}>
                            <div className={styles.transcriptEmptyIcon}>🎤</div>
                            <p className={styles.transcriptEmptyText}>video doesn&apos;t have any voice</p>
                            <p className={styles.transcriptEmptySubtext}>No transcript available for this video</p>
                            </div>
                        )}
                      </div>
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
                        const videoId = selectedDocument?.id || selectedDocument?.video_id || documentData?.video_id;
                        const summaryPdfUrl = selectedDocument?.summary_pdf_url || null;
                        const videoFileNumber = selectedDocument?.video_file_number || documentData?.video_file_number;
                        
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
                            const fallbackVideoId = documentData?.video_id || selectedDocument?.video_id;
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

                {/* Documentation Tab */}
                {activeTab === 'documentation' && (
                  <section 
                    id="documentation-panel"
                    className={styles.tabPanel}
                    role="tabpanel"
                    aria-labelledby="documentation-tab"
                  >
                    <div className={styles.documentationContainer}>
                      {(() => {
                        // Get documentation data
                        const docData = documentData?.documentation_data || documentData?.frames || [];
                        // #region agent log
                        fetch('http://127.0.0.1:7243/ingest/de7026f9-1d05-470c-8f09-5c0f5e04f9b0',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'document.js:1077',message:'Documentation tab render',data:{hasDocumentData:!!documentData,docDataLength:docData.length,hasDocDataProp:!!documentData?.documentation_data,hasFramesProp:!!documentData?.frames,activeTab},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                        // #endregion
                        if (!docData || docData.length === 0) {
                          return (
                            <div className={styles.emptyState}>
                              <p>No documentation available.</p>
                              <p style={{ fontSize: '0.9em', color: '#666', marginTop: '8px' }}>
                                {documentData ? 'The video documentation may not have been generated yet.' : 'Loading document data...'}
                              </p>
                            </div>
                          );
                        }
                        
                        return (
                          <div className={styles.documentationContent}>
                            <div className={styles.documentationHeader}>
                              <h3 className={styles.documentationTitle}>Video Documentation</h3>
                              <p className={styles.documentationSubtitle}>
                                {docData.length} step{docData.length !== 1 ? 's' : ''} documented
                              </p>
                            </div>
                            
                            <div className={styles.documentationSteps}>
                              {docData.map((step, index) => {
                                const stepNumber = step.step_number || index + 1;
                                const description = step.description || 'No description available';
                                const image = step.image || step.base64_image;
                                
                                // Construct base64 image data URL
                                let imageDataUrl = null;
                                if (image) {
                                  if (image.startsWith('data:')) {
                                    imageDataUrl = image;
                                  } else {
                                    imageDataUrl = `data:image/jpeg;base64,${image}`;
                                  }
                                }
                                
                                return (
                                  <div key={`doc-step-${stepNumber}-${index}`} className={styles.documentationStepCard}>
                                    <div className={styles.documentationStepHeader}>
                                      <div className={styles.documentationStepNumber}>
                                        <span className={styles.stepNumberBadge}>Step {stepNumber}</span>
                                      </div>
                                    </div>
                                    
                                    <div className={styles.documentationStepContent}>
                                      {imageDataUrl && (
                                        <div className={styles.documentationStepImage}>
                                          <img 
                                            src={imageDataUrl}
                                            alt={`Documentation step ${stepNumber}`}
                                            style={{
                                              width: '100%',
                                              height: 'auto',
                                              maxHeight: '400px',
                                              objectFit: 'contain',
                                              borderRadius: '8px',
                                              border: '1px solid #e0e0e0',
                                              cursor: 'pointer',
                                              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                            }}
                                            onClick={() => {
                                              // Open image in new tab for full size
                                              const newWindow = window.open();
                                              if (newWindow) {
                                                newWindow.document.write(`
                                                  <html>
                                                    <head>
                                                      <title>Step ${stepNumber} - Documentation</title>
                                                      <style>
                                                        body { 
                                                          margin: 0; 
                                                          padding: 20px; 
                                                          background: #f5f5f5; 
                                                          display: flex; 
                                                          justify-content: center; 
                                                          align-items: center; 
                                                          min-height: 100vh;
                                                        }
                                                        img { 
                                                          max-width: 100%; 
                                                          height: auto; 
                                                          border-radius: 8px;
                                                          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                                                        }
                                                      </style>
                                                    </head>
                                                    <body>
                                                      <img src="${imageDataUrl}" alt="Step ${stepNumber}" />
                                                    </body>
                                                  </html>
                                                `);
                                              }
                                            }}
                                            onError={(e) => {
                                              e.target.style.display = 'none';
                                            }}
                                          />
                                        </div>
                                      )}
                                      
                                      <div className={styles.documentationStepDescription}>
                                        <div className={styles.descriptionText}>
                                          {description.split('\n').map((paragraph, pIndex) => (
                                            paragraph.trim() ? (
                                              <p key={pIndex} style={{ marginBottom: '1em', lineHeight: '1.6' }}>
                                                {paragraph}
                                              </p>
                                            ) : null
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            {/* Show sprite sheet if available */}
                            {documentData?.sprite_sheet_base64 && (
                              <div className={styles.spriteSheetSection}>
                                <h4 className={styles.spriteSheetTitle}>Sprite Sheet</h4>
                                <div className={styles.spriteSheetImage}>
                                  <img 
                                    src={`data:image/jpeg;base64,${documentData.sprite_sheet_base64}`}
                                    alt="Sprite sheet"
                                    style={{
                                      width: '100%',
                                      height: 'auto',
                                      maxHeight: '500px',
                                      objectFit: 'contain',
                                      borderRadius: '8px',
                                      border: '1px solid #e0e0e0',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => {
                                      const newWindow = window.open();
                                      if (newWindow) {
                                        newWindow.document.write(`
                                          <html>
                                            <head>
                                              <title>Sprite Sheet</title>
                                              <style>
                                                body { 
                                                  margin: 0; 
                                                  padding: 20px; 
                                                  background: #f5f5f5; 
                                                  display: flex; 
                                                  justify-content: center; 
                                                  align-items: center; 
                                                  min-height: 100vh;
                                                }
                                                img { 
                                                  max-width: 100%; 
                                                  height: auto; 
                                                  border-radius: 8px;
                                                  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                                                }
                                              </style>
                                            </head>
                                            <body>
                                              <img src="data:image/jpeg;base64,${documentData.sprite_sheet_base64}" alt="Sprite Sheet" />
                                            </body>
                                          </html>
                                        `);
                                      }
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
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
                      <div className={styles.stepsHeader}>
                        <h3 className={styles.stepsTitle}>Video Steps</h3>
                        <p className={styles.stepsSubtitle}>
                          {framesLoading ? 'Loading...' : `${framesData.length} step${framesData.length !== 1 ? 's' : ''} documented`}
                        </p>
                      </div>
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
                            if (framesLoading) {
                              return (
                                <tr>
                                  <td colSpan="4" className={styles.emptyState}>
                                    <p>Loading frame analyses...</p>
                                  </td>
                                </tr>
                              );
                                }
                                
                            if (!framesData || framesData.length === 0) {
                              return (
                                <tr>
                                  <td colSpan="4" className={styles.emptyState}>
                                    <p>No step data available.</p>
                                    <p style={{ fontSize: '0.9em', color: '#666', marginTop: '8px' }}>
                                      The video processing may not have completed frame analysis yet, or no frames have been analyzed.
                                    </p>
                                  </td>
                                </tr>
                              );
                            }
                            
                            // Process frames from frame_analyses database
                            return framesData.map((frame, index) => {
                              // Construct base64 image data URL
                              let imageDataUrl = null;
                              if (frame.base64_image) {
                                if (frame.base64_image.startsWith('data:')) {
                                  imageDataUrl = frame.base64_image;
                                } else {
                                  imageDataUrl = `data:image/jpeg;base64,${frame.base64_image}`;
                                }
                              }
                              
                              return (
                                <tr key={`frame-${frame.id || index}-${frame.timestamp || index}`}>
                                <td className={styles.stepImage}>
                                    {imageDataUrl ? (
                                    <img 
                                        src={imageDataUrl}
                                        alt={`Frame at ${formatTimestamp(frame.timestamp)}`}
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
                                            newWindow.document.write(`<img src="${imageDataUrl}" style="max-width: 100%; height: auto;" />`);
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
                                  <td className={styles.stepTimestamp}>{formatTimestamp(frame.timestamp)}</td>
                                  <td className={styles.stepDescription}>{frame.description || 'Frame analysis'}</td>
                                <td className={styles.stepMetaTags}>
                                  <div className={styles.metaTagsContainer}>
                                      <span className={styles.metaTag}>frame #{frame.frame_number || index + 1}</span>
                                      {frame.gpt_response && <span className={styles.metaTag}>GPT analyzed</span>}
                                      {frame.ocr_text && <span className={styles.metaTag}>OCR</span>}
                                      {frame.description && <span className={styles.metaTag}>described</span>}
                                  </div>
                                  {frame.ocr_text && (
                                    <div style={{ marginTop: '8px', fontSize: '0.85em', color: '#666', fontStyle: 'italic' }}>
                                      OCR: {frame.ocr_text.substring(0, 100)}{frame.ocr_text.length > 100 ? '...' : ''}
                                    </div>
                                  )}
                                </td>
                              </tr>
                              );
                            });
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
