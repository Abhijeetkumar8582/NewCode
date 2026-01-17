import { useState } from 'react';
import { downloadDocument } from '../lib/api';
import styles from '../styles/DocumentExport.module.css';

const FORMATS = [
  { id: 'transcript', label: 'Transcript (Audio)', icon: '🎵', color: '#9f7aea', isAudio: true },
  { id: 'docx', label: 'DOCX', icon: '📄', color: '#2b6cb0' },
  { id: 'pdf', label: 'PDF', icon: '📑', color: '#c53030' },
  { id: 'html', label: 'HTML', icon: '🌐', color: '#38a169' },
];

export default function DocumentExport({ jobId, onReset, transcript }) {
  const [downloading, setDownloading] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState(null);
  const [error, setError] = useState(null);
  const [playingAudio, setPlayingAudio] = useState(false);

  const handleDownload = async (format) => {
    if (format === 'transcript') {
      // Handle audio playback for transcript
      if (transcript) {
        handlePlayTranscript();
      }
      return;
    }

    setDownloading(true);
    setDownloadingFormat(format);
    setError(null);

    try {
      const response = await downloadDocument(jobId, format);

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `document_${jobId}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setDownloadingFormat(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Download failed. Please try again.');
    } finally {
      setDownloading(false);
      setDownloadingFormat(null);
    }
  };

  const handlePlayTranscript = () => {
    if (!transcript) return;
    
    // Use Web Speech API to read transcript
    if ('speechSynthesis' in window) {
      if (playingAudio) {
        window.speechSynthesis.cancel();
        setPlayingAudio(false);
      } else {
        const utterance = new SpeechSynthesisUtterance(transcript);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        
        utterance.onend = () => setPlayingAudio(false);
        utterance.onerror = () => setPlayingAudio(false);
        
        window.speechSynthesis.speak(utterance);
        setPlayingAudio(true);
      }
    } else {
      alert('Your browser does not support text-to-speech. Please use a modern browser.');
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <div className={styles.successIconWrapper}>
          <svg className={styles.successIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points="22 4 12 14.01 9 11.01" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h2>Your Document is Ready!</h2>
        <p>Download your processed document in your preferred format</p>
      </div>
      
      <div className={styles.formatsGrid}>
        {FORMATS.map((format) => {
          const isAudio = format.isAudio;
          const isPlaying = isAudio && playingAudio;
          const isDisabled = isAudio ? !transcript : downloading;
          
          return (
            <button
              key={format.id}
              className={`${styles.formatCard} ${
                downloadingFormat === format.id ? styles.downloading : ''
              } ${isPlaying ? styles.playing : ''}`}
              onClick={() => handleDownload(format.id)}
              disabled={isDisabled}
              style={{ '--format-color': format.color }}
            >
              <div className={styles.formatIcon}>{format.icon}</div>
              <div className={styles.formatContent}>
                <h3>{format.label}</h3>
                {downloadingFormat === format.id ? (
                  <div className={styles.downloadSpinner}></div>
                ) : isAudio ? (
                  <p>{isPlaying ? 'Stop' : 'Play'}</p>
                ) : (
                  <p>Download</p>
                )}
              </div>
              {!isAudio && (
                <div className={styles.downloadArrow}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <polyline points="7 10 12 15 17 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    <line x1="12" y1="15" x2="12" y2="3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
              {isAudio && isPlaying && (
                <div className={styles.audioWave}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              )}
            </button>
          );
        })}
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

      <div className={styles.resetSection}>
        <button
          className={styles.resetButton}
          onClick={onReset}
          disabled={downloading}
        >
          <svg className={styles.resetIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <polyline points="23 4 23 10 17 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Process Another Video
        </button>
      </div>
    </div>
  );
}
