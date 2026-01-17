import { useState } from 'react';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import styles from '../styles/Dashboard.module.css';
import { logPageView } from '../lib/activityLogger';
import { useEffect } from 'react';

export default function Help() {
  const [expandedSection, setExpandedSection] = useState(null);

  useEffect(() => {
    logPageView('Help & Support');
  }, []);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const helpSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: '🚀',
      content: (
        <div>
          <h3>Welcome to Epiplex!</h3>
          <p>Epiplex is an AI-powered platform that transforms your videos into comprehensive documents. Here&apos;s how to get started:</p>
          
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ marginBottom: '10px', color: '#3b82f6' }}>Step 1: Sign In</h4>
            <p>Use your Google account to sign in securely. Click the &quot;Sign in with Google&quot; button on the authentication page.</p>
            
            <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#3b82f6' }}>Step 2: Navigate to Process Data</h4>
            <p>Once logged in, go to the &quot;Process Data&quot; section from the sidebar to upload your first video.</p>
            
            <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#3b82f6' }}>Step 3: Upload Your Video</h4>
            <p>You can upload videos in two ways:</p>
            <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li><strong>File Upload:</strong> Drag and drop a video file or click to browse</li>
              <li><strong>Video Link:</strong> Paste a URL link to your video</li>
            </ul>
            
            <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#3b82f6' }}>Step 4: Wait for Processing</h4>
            <p>Your video will go through several processing steps. You can monitor the progress in real-time.</p>
            
            <h4 style={{ marginTop: '20px', marginBottom: '10px', color: '#3b82f6' }}>Step 5: View Your Document</h4>
            <p>Once processing is complete, navigate to the &quot;Document&quot; section to view and download your generated document.</p>
          </div>
        </div>
      )
    },
    {
      id: 'uploading-videos',
      title: 'Uploading Videos',
      icon: '📤',
      content: (
        <div>
          <h3>How to Upload Videos</h3>
          <p>Epiplex supports multiple ways to upload your videos for processing:</p>
          
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ marginBottom: '10px', color: '#3b82f6' }}>Method 1: File Upload</h4>
            <ol style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Go to the &quot;Process Data&quot; page</li>
              <li>Click the &quot;Upload Video&quot; button or the upload area</li>
              <li>Select your video file from your device</li>
              <li>Enter a name for your video (required)</li>
              <li>Click &quot;Upload&quot; to start the process</li>
            </ol>
            
            <div style={{ 
              marginTop: '15px', 
              padding: '12px', 
              backgroundColor: '#f0f9ff', 
              borderRadius: '8px',
              borderLeft: '4px solid #3b82f6'
            }}>
              <strong>💡 Tip:</strong> You can also drag and drop your video file directly onto the upload area for faster uploading.
            </div>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#3b82f6' }}>Method 2: Video Link</h4>
            <ol style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Go to the &quot;Process Data&quot; page</li>
              <li>Click &quot;Upload Video&quot;</li>
              <li>Select the &quot;Link&quot; tab in the upload dialog</li>
              <li>Paste your video URL in the link field</li>
              <li>Enter a name for your video (required)</li>
              <li>Click &quot;Upload&quot; to start processing</li>
            </ol>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#3b82f6' }}>Supported Formats</h4>
            <p>Epiplex supports common video formats including:</p>
            <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>MP4</li>
              <li>AVI</li>
              <li>MOV</li>
              <li>MKV</li>
              <li>And other standard video formats</li>
            </ul>
            
            <div style={{ 
              marginTop: '15px', 
              padding: '12px', 
              backgroundColor: '#fef3c7', 
              borderRadius: '8px',
              borderLeft: '4px solid #f59e0b'
            }}>
              <strong>⚠️ Note:</strong> Make sure your video file is not too large. Very large files may take longer to upload and process.
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'processing-steps',
      title: 'Understanding Processing Steps',
      icon: '⚙️',
      content: (
        <div>
          <h3>Video Processing Pipeline</h3>
          <p>Your video goes through several automated steps to create a comprehensive document:</p>
          
          <div style={{ marginTop: '20px' }}>
            <div style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              backgroundColor: '#f9fafb', 
              borderRadius: '8px',
              borderLeft: '4px solid #10b981'
            }}>
              <h4 style={{ marginBottom: '8px', color: '#10b981' }}>Step 1: Extracting Audio</h4>
              <p style={{ margin: 0 }}>The audio track is extracted from your video file. This is the first step in the transcription process.</p>
            </div>
            
            <div style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              backgroundColor: '#f9fafb', 
              borderRadius: '8px',
              borderLeft: '4px solid #3b82f6'
            }}>
              <h4 style={{ marginBottom: '8px', color: '#3b82f6' }}>Step 2: Transcribe</h4>
              <p style={{ margin: 0 }}>AI-powered transcription converts the audio into text. This creates a complete transcript of everything said in the video.</p>
            </div>
            
            <div style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              backgroundColor: '#f9fafb', 
              borderRadius: '8px',
              borderLeft: '4px solid #8b5cf6'
            }}>
              <h4 style={{ marginBottom: '8px', color: '#8b5cf6' }}>Step 3: Extract Keyframes</h4>
              <p style={{ margin: 0 }}>Important frames are extracted from the video at strategic intervals. These frames capture key visual moments.</p>
            </div>
            
            <div style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              backgroundColor: '#f9fafb', 
              borderRadius: '8px',
              borderLeft: '4px solid #f59e0b'
            }}>
              <h4 style={{ marginBottom: '8px', color: '#f59e0b' }}>Step 4: Analyze Frames</h4>
              <p style={{ margin: 0 }}>Each extracted frame is analyzed using AI to understand the visual content, objects, text, and context.</p>
            </div>
            
            
            <div style={{ 
              marginBottom: '20px', 
              padding: '15px', 
              backgroundColor: '#d1fae5', 
              borderRadius: '8px',
              borderLeft: '4px solid #10b981'
            }}>
              <h4 style={{ marginBottom: '8px', color: '#10b981' }}>Step 5: Ready</h4>
              <p style={{ margin: 0 }}>Your document is complete and ready to view, download, or share!</p>
            </div>
          </div>
          
          <div style={{ 
            marginTop: '20px', 
            padding: '12px', 
            backgroundColor: '#f0f9ff', 
            borderRadius: '8px',
            borderLeft: '4px solid #3b82f6'
          }}>
            <strong>⏱️ Processing Time:</strong> Processing time varies based on video length and complexity. Typically, a 10-minute video takes 5-15 minutes to process completely.
          </div>
        </div>
      )
    },
    {
      id: 'viewing-documents',
      title: 'Viewing & Managing Documents',
      icon: '📄',
      content: (
        <div>
          <h3>Working with Your Documents</h3>
          
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ marginBottom: '10px', color: '#3b82f6' }}>Accessing Documents</h4>
            <ol style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Navigate to the &quot;Document&quot; section from the sidebar</li>
              <li>You&apos;ll see a list of all your processed videos</li>
              <li>Click on any document to view its details</li>
            </ol>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#3b82f6' }}>Document View Features</h4>
            <p>When viewing a document, you have access to several tabs:</p>
            <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li><strong>Transcribe:</strong> View the complete text transcription of your video</li>
              <li><strong>Keyframes:</strong> Browse through extracted keyframes with their AI analysis</li>
              <li><strong>Summary:</strong> Read the AI-generated summary of your video content</li>
            </ul>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#3b82f6' }}>Downloading Documents</h4>
            <ol style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Open the document you want to download</li>
              <li>Look for the download button or export option</li>
              <li>Choose your preferred format (PDF is typically available)</li>
              <li>Your document will download to your device</li>
            </ol>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#3b82f6' }}>Managing Multiple Documents</h4>
            <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Use the search bar to find specific documents by name</li>
              <li>Select multiple documents using checkboxes for bulk operations</li>
              <li>Delete documents you no longer need</li>
              <li>Use pagination to navigate through large lists</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'dashboard',
      title: 'Using the Dashboard',
      icon: '📊',
      content: (
        <div>
          <h3>Dashboard Overview</h3>
          <p>The dashboard provides a comprehensive overview of your Epiplex activity and statistics.</p>
          
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ marginBottom: '10px', color: '#3b82f6' }}>Key Metrics</h4>
            <p>The dashboard displays important statistics including:</p>
            <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li><strong>Total Videos:</strong> Number of videos you&apos;ve uploaded</li>
              <li><strong>Processing Status:</strong> Breakdown of videos by status (processing, completed, failed)</li>
              <li><strong>Activity Statistics:</strong> Recent activity and usage trends</li>
            </ul>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#3b82f6' }}>Quick Actions</h4>
            <p>From the dashboard, you can quickly:</p>
            <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Navigate to upload a new video</li>
              <li>View your recent documents</li>
              <li>Check processing status of your videos</li>
              <li>Access activity logs</li>
            </ul>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#3b82f6' }}>Date Range Filtering</h4>
            <p>You can filter dashboard statistics by date range:</p>
            <ol style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Click on the date range selector</li>
              <li>Choose your start and end dates</li>
              <li>Statistics will update to show data for the selected period</li>
            </ol>
          </div>
        </div>
      )
    },
    {
      id: 'activity-log',
      title: 'Activity Log',
      icon: '📝',
      content: (
        <div>
          <h3>Tracking Your Activity</h3>
          <p>The Activity Log keeps a record of all your actions and system events.</p>
          
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ marginBottom: '10px', color: '#3b82f6' }}>What&apos;s Tracked</h4>
            <p>The activity log records:</p>
            <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Video uploads and processing status changes</li>
              <li>Document views and downloads</li>
              <li>Page navigation and user actions</li>
              <li>System events and errors</li>
            </ul>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#3b82f6' }}>Using the Activity Log</h4>
            <ol style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Navigate to &quot;Activity Log&quot; from the sidebar</li>
              <li>Browse through your recent activities</li>
              <li>Use filters to find specific events</li>
              <li>Review timestamps to track when actions occurred</li>
            </ol>
            
            <div style={{ 
              marginTop: '15px', 
              padding: '12px', 
              backgroundColor: '#f0f9ff', 
              borderRadius: '8px',
              borderLeft: '4px solid #3b82f6'
            }}>
              <strong>💡 Tip:</strong> The activity log is useful for troubleshooting issues or reviewing your usage history.
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'account-settings',
      title: 'Account & Settings',
      icon: '⚙️',
      content: (
        <div>
          <h3>Managing Your Account</h3>
          
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ marginBottom: '10px', color: '#3b82f6' }}>Account Information</h4>
            <p>View and manage your account details:</p>
            <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Access your profile information</li>
              <li>View your account role and permissions</li>
              <li>Check your account status</li>
            </ul>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#3b82f6' }}>Signing Out</h4>
            <ol style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Click on your profile avatar in the sidebar</li>
              <li>Select &quot;Signout&quot; from the dropdown menu</li>
              <li>You&apos;ll be redirected to the login page</li>
            </ol>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#3b82f6' }}>Privacy & Security</h4>
            <p>Your data is secure with Epiplex:</p>
            <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>All videos and documents are stored securely</li>
              <li>Authentication is handled through Google OAuth</li>
              <li>Your data is only accessible to you</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      icon: '🔧',
      content: (
        <div>
          <h3>Common Issues & Solutions</h3>
          
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ marginBottom: '10px', color: '#ef4444' }}>Upload Issues</h4>
            <div style={{ marginBottom: '15px' }}>
              <strong>Problem:</strong> Video upload fails or is slow
              <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                <li>Check your internet connection</li>
                <li>Ensure the video file is not corrupted</li>
                <li>Try uploading a smaller file or compressing the video</li>
                <li>Check if the file format is supported</li>
              </ul>
            </div>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#ef4444' }}>Processing Issues</h4>
            <div style={{ marginBottom: '15px' }}>
              <strong>Problem:</strong> Video processing is stuck or taking too long
              <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                <li>Processing time depends on video length - longer videos take more time</li>
                <li>Check the processing status in the &quot;Process Data&quot; section</li>
                <li>If stuck for more than 30 minutes, try retrying the upload</li>
                <li>Contact support if the issue persists</li>
              </ul>
            </div>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#ef4444' }}>Document View Issues</h4>
            <div style={{ marginBottom: '15px' }}>
              <strong>Problem:</strong> Can&apos;t view or download documents
              <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                <li>Ensure the video processing is complete (status should be &quot;Ready&quot;)</li>
                <li>Refresh the page and try again</li>
                <li>Check if you have the necessary permissions</li>
                <li>Try accessing the document from a different browser</li>
              </ul>
            </div>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#ef4444' }}>Authentication Issues</h4>
            <div style={{ marginBottom: '15px' }}>
              <strong>Problem:</strong> Can&apos;t sign in or session expired
              <ul style={{ marginLeft: '20px', marginTop: '5px' }}>
                <li>Clear your browser cache and cookies</li>
                <li>Try signing in again with your Google account</li>
                <li>Ensure cookies are enabled in your browser</li>
                <li>Check if pop-up blockers are interfering with the sign-in process</li>
              </ul>
            </div>
            
            <div style={{ 
              marginTop: '25px', 
              padding: '15px', 
              backgroundColor: '#fef3c7', 
              borderRadius: '8px',
              borderLeft: '4px solid #f59e0b'
            }}>
              <strong>💡 Still Need Help?</strong>
              <p style={{ marginTop: '8px', marginBottom: 0 }}>
                If you continue to experience issues, please contact our support team with details about the problem, 
                including error messages and steps to reproduce the issue.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'tips-tricks',
      title: 'Tips & Best Practices',
      icon: '💡',
      content: (
        <div>
          <h3>Getting the Most Out of Epiplex</h3>
          
          <div style={{ marginTop: '20px' }}>
            <h4 style={{ marginBottom: '10px', color: '#10b981' }}>Video Quality Tips</h4>
            <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Use clear audio for better transcription accuracy</li>
              <li>Ensure good lighting in videos for better frame analysis</li>
              <li>Videos with clear speech produce more accurate transcripts</li>
              <li>Consider video length - very long videos take longer to process</li>
            </ul>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#10b981' }}>Naming Your Videos</h4>
            <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Use descriptive names to easily identify your videos later</li>
              <li>Include dates or project names in video names</li>
              <li>Avoid special characters that might cause issues</li>
            </ul>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#10b981' }}>Organization Tips</h4>
            <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Regularly review and delete videos you no longer need</li>
              <li>Use the search function to quickly find specific documents</li>
              <li>Check the dashboard regularly to monitor your usage</li>
              <li>Keep track of processing status to know when documents are ready</li>
            </ul>
            
            <h4 style={{ marginTop: '25px', marginBottom: '10px', color: '#10b981' }}>Workflow Optimization</h4>
            <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
              <li>Upload videos during off-peak hours for faster processing</li>
              <li>Process multiple videos in batches if you have many to handle</li>
              <li>Download important documents as PDFs for offline access</li>
              <li>Use the activity log to track your workflow patterns</li>
            </ul>
            
            <div style={{ 
              marginTop: '25px', 
              padding: '15px', 
              backgroundColor: '#d1fae5', 
              borderRadius: '8px',
              borderLeft: '4px solid #10b981'
            }}>
              <strong>✨ Pro Tip:</strong> For best results, ensure your videos have clear audio and visual content. 
              Well-lit videos with clear speech produce the most accurate and comprehensive documents.
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <>
      <SEO
        title="Help & Support"
        description="Get help using Epiplex - Learn how to upload videos, process them, view documents, and more."
        keywords="epiplex help, video processing help, document generation guide, user guide"
      />
      <Layout pageTitle="Help & Support">
        <div className={styles.dashboard}>
          <div style={{
            padding: '40px',
            maxWidth: '1200px',
            margin: '0 auto'
          }}>
            {/* Header */}
            <div style={{
              marginBottom: '40px',
              textAlign: 'center'
            }}>
              <div style={{
                fontSize: '48px',
                marginBottom: '16px'
              }}>
                ❓
              </div>
              <h1 style={{
                fontSize: '36px',
                fontWeight: '700',
                marginBottom: '12px',
                color: '#111827'
              }}>
                Help & Support
              </h1>
              <p style={{
                fontSize: '18px',
                color: '#6b7280',
                maxWidth: '600px',
                margin: '0 auto'
              }}>
                Everything you need to know about using Epiplex to transform your videos into comprehensive documents
              </p>
            </div>

            {/* Help Sections */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {helpSections.map((section) => (
                <div
                  key={section.id}
                  style={{
                    backgroundColor: '#ffffff',
                    borderRadius: '12px',
                    border: '1px solid #e5e7eb',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    boxShadow: expandedSection === section.id 
                      ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                      : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)'
                  }}
                >
                  <button
                    onClick={() => toggleSection(section.id)}
                    style={{
                      width: '100%',
                      padding: '20px 24px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px'
                    }}>
                      <span style={{
                        fontSize: '24px'
                      }}>
                        {section.icon}
                      </span>
                      <h2 style={{
                        fontSize: '20px',
                        fontWeight: '600',
                        color: '#111827',
                        margin: 0
                      }}>
                        {section.title}
                      </h2>
                    </div>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{
                        transform: expandedSection === section.id ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.3s ease',
                        color: '#6b7280'
                      }}
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                  
                  {expandedSection === section.id && (
                    <div style={{
                      padding: '0 24px 24px 24px',
                      borderTop: '1px solid #e5e7eb',
                      marginTop: '0',
                      animation: 'fadeIn 0.3s ease'
                    }}>
                      <div style={{
                        paddingTop: '24px',
                        color: '#374151',
                        lineHeight: '1.6'
                      }}>
                        {section.content}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer Contact Section */}
            <div style={{
              marginTop: '40px',
              padding: '30px',
              backgroundColor: '#f9fafb',
              borderRadius: '12px',
              textAlign: 'center',
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{
                fontSize: '24px',
                fontWeight: '600',
                marginBottom: '12px',
                color: '#111827'
              }}>
                Still Have Questions?
              </h3>
              <p style={{
                fontSize: '16px',
                color: '#6b7280',
                marginBottom: '20px'
              }}>
                If you couldn&apos;t find the answer you&apos;re looking for, our support team is here to help.
              </p>
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => window.location.href = 'mailto:support@epiplex.ai'}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#2563eb';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#3b82f6';
                  }}
                >
                  Contact Support
                </button>
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </Layout>
    </>
  );
}

