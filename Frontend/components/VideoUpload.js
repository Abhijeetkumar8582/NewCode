import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { uploadVideo } from '../lib/api';
import styles from '../styles/VideoUpload.module.css';

export default function VideoUpload({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    
    // Validate file type
    if (!file.type.startsWith('video/')) {
      setError('Please upload a video file');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadProgress(0);

    try {
      const response = await uploadVideo(file, (progress) => {
        setUploadProgress(progress);
      });

      if (response.data.job_id) {
        setTimeout(() => {
          onUploadSuccess(response.data.job_id);
        }, 500);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Please try again.');
      setUploading(false);
      setUploadProgress(0);
    }
  }, [onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    },
    multiple: false,
    disabled: uploading
  });

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.iconWrapper}>
          <svg className={styles.uploadIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="17 8 12 3 7 8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="12" y1="3" x2="12" y2="15" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2>Upload Your Video</h2>
        <p>Drag and drop or click to select a video file</p>
      </div>
      
      <div
        {...getRootProps()}
        className={`${styles.dropzone} ${isDragActive ? styles.active : ''} ${uploading ? styles.uploading : ''}`}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <div className={styles.uploadContent}>
            <div className={styles.uploadAnimation}>
              <div className={styles.spinner}></div>
              <div className={styles.uploadRing}></div>
            </div>
            <p className={styles.uploadText}>Uploading video...</p>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${uploadProgress}%` }}
              >
                <span className={styles.progressText}>{uploadProgress}%</span>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.uploadContent}>
            <div className={styles.uploadIconLarge}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className={styles.dropText}>
              {isDragActive
                ? 'Drop the video here...'
                : 'Drag & drop a video file here'}
            </p>
            <p className={styles.orText}>or</p>
            <button className={styles.browseButton}>Browse Files</button>
            <p className={styles.hint}>
              Supported formats: MP4, AVI, MOV, MKV, WebM
            </p>
          </div>
        )}
      </div>
      {error && (
        <div className={styles.errorMessage}>
          <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2"/>
            <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
