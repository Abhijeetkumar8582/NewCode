import { logActivity } from './api';

/**
 * Activity Logger Utility
 * Provides functions to log user activities throughout the application
 */

// Activity action types
export const ActivityActions = {
  PAGE_VIEW: 'PAGE_VIEW',
  VIEW_DOCUMENT: 'VIEW_DOCUMENT',
  UPLOAD_VIDEO: 'UPLOAD_VIDEO',
  DELETE_VIDEO: 'DELETE_VIDEO',
  UPDATE_VIDEO: 'UPDATE_VIDEO',
  EXPORT_DOCUMENT: 'EXPORT_DOCUMENT',
  UPDATE_ACCOUNT: 'UPDATE_ACCOUNT',
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  SIGNUP: 'SIGNUP'
};

/**
 * Get client IP address (if available)
 */
const getClientIP = () => {
  // In a real application, this might be obtained from a service
  // For now, we'll return null as the backend will handle IP detection
  return null;
};

/**
 * Get current page path
 */
const getCurrentPath = () => {
  if (typeof window === 'undefined') return null;
  return window.location.pathname;
};

/**
 * Log a page view activity
 * @param {string} pageName - Name of the page being viewed
 * @param {object} metadata - Additional metadata about the page view
 */
export const logPageView = async (pageName, metadata = {}) => {
  try {
    await logActivity(
      ActivityActions.PAGE_VIEW,
      `User viewed page: ${pageName}`,
      {
        page: pageName,
        path: getCurrentPath(),
        ...metadata
      }
    );
  } catch (error) {
    // Non-blocking - don't fail if activity logging fails
    console.warn('Failed to log page view:', error);
  }
};

/**
 * Log a document view activity
 * @param {string} documentId - ID of the document being viewed
 * @param {object} metadata - Additional metadata
 */
export const logDocumentView = async (documentId, metadata = {}) => {
  try {
    await logActivity(
      ActivityActions.VIEW_DOCUMENT,
      `User viewed document: ${documentId}`,
      {
        document_id: documentId,
        ...metadata
      }
    );
  } catch (error) {
    console.warn('Failed to log document view:', error);
  }
};

/**
 * Log a video upload activity
 * @param {string} videoId - ID of the uploaded video
 * @param {object} metadata - Additional metadata (file size, name, etc.)
 */
export const logVideoUpload = async (videoId, metadata = {}) => {
  try {
    await logActivity(
      ActivityActions.UPLOAD_VIDEO,
      `User uploaded video: ${videoId}`,
      {
        video_id: videoId,
        ...metadata
      }
    );
  } catch (error) {
    console.warn('Failed to log video upload:', error);
  }
};

/**
 * Log a video delete activity
 * @param {string} videoId - ID of the deleted video
 * @param {object} metadata - Additional metadata
 */
export const logVideoDelete = async (videoId, metadata = {}) => {
  try {
    await logActivity(
      ActivityActions.DELETE_VIDEO,
      `User deleted video: ${videoId}`,
      {
        video_id: videoId,
        ...metadata
      }
    );
  } catch (error) {
    console.warn('Failed to log video delete:', error);
  }
};

/**
 * Log a video update activity
 * @param {string} videoId - ID of the updated video
 * @param {object} metadata - Additional metadata (what was updated)
 */
export const logVideoUpdate = async (videoId, metadata = {}) => {
  try {
    await logActivity(
      ActivityActions.UPDATE_VIDEO,
      `User updated video: ${videoId}`,
      {
        video_id: videoId,
        ...metadata
      }
    );
  } catch (error) {
    console.warn('Failed to log video update:', error);
  }
};

/**
 * Log a document export activity
 * @param {string} documentId - ID of the exported document
 * @param {string} format - Export format (docx, pdf, html)
 * @param {object} metadata - Additional metadata
 */
export const logDocumentExport = async (documentId, format, metadata = {}) => {
  try {
    await logActivity(
      ActivityActions.EXPORT_DOCUMENT,
      `User exported document: ${documentId} as ${format}`,
      {
        document_id: documentId,
        format,
        ...metadata
      }
    );
  } catch (error) {
    console.warn('Failed to log document export:', error);
  }
};

/**
 * Log an account update activity
 * @param {object} metadata - Information about what was updated
 */
export const logAccountUpdate = async (metadata = {}) => {
  try {
    await logActivity(
      ActivityActions.UPDATE_ACCOUNT,
      'User updated account settings',
      metadata
    );
  } catch (error) {
    console.warn('Failed to log account update:', error);
  }
};

/**
 * Generic activity logger
 * @param {string} action - Action type
 * @param {string} description - Description of the activity
 * @param {object} metadata - Additional metadata
 */
export const logCustomActivity = async (action, description, metadata = {}) => {
  try {
    await logActivity(action, description, metadata);
  } catch (error) {
    console.warn('Failed to log custom activity:', error);
  }
};

