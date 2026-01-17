import { useEffect, useState } from 'react';
import styles from '../styles/ProcessingStatus.module.css';

const STEPS = [
  { id: 'upload', label: 'Upload', icon: '📤', description: 'Video uploaded' },
  { id: 'extract_audio', label: 'Extract Audio', icon: '🎵', description: 'Extracting audio from video' },
  { id: 'transcribe', label: 'Transcribe', icon: '🔍', description: 'Transcribing audio' },
  { id: 'extract_frames', label: 'Extract Keyframes', icon: '🎬', description: 'Extracting frames' },
  { id: 'analyze_frames', label: 'Analyze Frames', icon: '⚙️', description: 'Analyzing frames with GPT' },
  { id: 'complete', label: 'Complete', icon: '✅', description: 'Processing complete' },
];

export default function ProcessingStatus({ status }) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [expandedStep, setExpandedStep] = useState(null);

  useEffect(() => {
    if (!status || !status.step_progress) return;

    const stepIds = STEPS.map(s => s.id);
    const currentIndex = stepIds.findIndex(id => 
      status.step_progress[id] === 'processing' || 
      (status.step_progress[id] === 'completed' && 
       stepIds.indexOf(status.current_step) === stepIds.indexOf(id))
    );
    
    if (currentIndex !== -1) {
      setCurrentStepIndex(currentIndex);
    }
  }, [status]);

  if (!status) return null;

  const getStepStatus = (stepId) => {
    if (!status.step_progress) return 'pending';
    return status.step_progress[stepId] || 'pending';
  };

  const toggleStep = (stepId) => {
    setExpandedStep(expandedStep === stepId ? null : stepId);
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2>Processing Your Video</h2>
        <p className={styles.subtitle}>{status.message}</p>
      </div>

      <div className={styles.stepsContainer}>
        {STEPS.map((step, index) => {
          const stepStatus = getStepStatus(step.id);
          const isActive = index === currentStepIndex && stepStatus === 'processing';
          const isCompleted = stepStatus === 'completed';
          const isPending = stepStatus === 'pending';
          const isExpanded = expandedStep === step.id;

          return (
            <div key={step.id} className={styles.stepWrapper}>
              <div 
                className={`${styles.stepContent} ${isCompleted ? styles.completedStep : ''}`}
                onClick={() => isCompleted && toggleStep(step.id)}
                style={{ cursor: isCompleted ? 'pointer' : 'default' }}
              >
                <div
                  className={`${styles.stepIcon} ${
                    isCompleted ? styles.completed :
                    isActive ? styles.active :
                    isPending ? styles.pending : ''
                  }`}
                >
                  {isCompleted ? (
                    <svg className={styles.checkIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <polyline points="20 6 9 17 4 12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : (
                    <span className={styles.stepEmoji}>{step.icon}</span>
                  )}
                  {isActive && <div className={styles.pulseRing}></div>}
                </div>
                <div className={styles.stepInfo}>
                  <h3 className={styles.stepLabel}>{step.label}</h3>
                  <p className={styles.stepDescription}>
                    {isActive ? status.message : step.description}
                  </p>
                </div>
                {isCompleted && (
                  <svg 
                    className={`${styles.expandIcon} ${isExpanded ? styles.expanded : ''}`}
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor"
                  >
                    <polyline points="6 9 12 15 18 9" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>

              {/* Show transcript when transcribe step is completed */}
              {isExpanded && step.id === 'transcribe' && status.transcript && (
                <div className={styles.stepData}>
                  <h4>Transcript</h4>
                  <div className={styles.transcriptContainer}>
                    <p className={styles.transcriptText}>{status.transcript}</p>
                  </div>
                </div>
              )}

              {/* Show audio info when extract_audio step is completed */}
              {isExpanded && step.id === 'extract_audio' && (
                <div className={styles.stepData}>
                  <h4>Audio Extraction</h4>
                  <div className={styles.transcriptContainer}>
                    <p className={styles.transcriptText}>
                      Audio has been successfully extracted from the video and is ready for transcription.
                    </p>
                  </div>
                </div>
              )}

              {/* Show frame analyses when extract_frames step is completed */}
              {isExpanded && step.id === 'extract_frames' && status.frame_analyses && status.frame_analyses.length > 0 && (
                <div className={styles.stepData}>
                  <h4>Frame Analyses ({status.frame_analyses.length} frames)</h4>
                  <div className={styles.framesContainer}>
                    {status.frame_analyses.slice(0, 10).map((frame, idx) => (
                      <div key={idx} className={styles.frameItem}>
                        <div className={styles.frameTimestamp}>{frame.timestamp}</div>
                        <div className={styles.frameDescription}>{frame.description}</div>
                      </div>
                    ))}
                    {status.frame_analyses.length > 10 && (
                      <p className={styles.moreFrames}>+ {status.frame_analyses.length - 10} more frames</p>
                    )}
                  </div>
                </div>
              )}

              {index < STEPS.length - 1 && (
                <div className={`${styles.stepConnector} ${
                  isCompleted ? styles.connectorActive : ''
                }`}>
                  <div className={styles.connectorLine}></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {status.status === 'processing' && (
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${status.progress}%` }}
            >
              <span className={styles.progressText}>{status.progress}%</span>
            </div>
          </div>
        </div>
      )}

      {status.status === 'completed' && status.output_files && (
        <div className={styles.outputFiles}>
          <div className={styles.successMessage}>
            <svg className={styles.successIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <polyline points="22 4 12 14.01 9 11.01" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <h3>Processing Complete!</h3>
          </div>
          <p className={styles.outputLabel}>Generated Files:</p>
          <div className={styles.fileList}>
            {Object.entries(status.output_files).map(([format, path]) => (
              <div key={format} className={styles.fileItem}>
                <span className={styles.fileFormat}>{format.toUpperCase()}</span>
                <span className={styles.fileName}>{path.split('/').pop()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {status.status === 'failed' && (
        <div className={styles.errorContainer}>
          <svg className={styles.errorIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2"/>
            <line x1="12" y1="8" x2="12" y2="12" strokeWidth="2" strokeLinecap="round"/>
            <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className={styles.errorText}>{status.message}</p>
        </div>
      )}
    </div>
  );
}
