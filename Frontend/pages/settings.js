import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import styles from '../styles/Dashboard.module.css';
import { logPageView } from '../lib/activityLogger';
import { getUserPrompt, updateUserPrompt, getDefaultPrompt, getUserOpenAIKey, updateUserOpenAIKey } from '../lib/api';

export default function Settings() {
  const [analysisRules, setAnalysisRules] = useState('');
  const [defaultAnalysisRules, setDefaultAnalysisRules] = useState('');
  const [fullPrompt, setFullPrompt] = useState('');
  const [hasCustomPrompt, setHasCustomPrompt] = useState(false);
  const [openAIKey, setOpenAIKey] = useState('');
  const [maskedOpenAIKey, setMaskedOpenAIKey] = useState('');
  const [hasOpenAIKey, setHasOpenAIKey] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [keyError, setKeyError] = useState(null);
  const [keySuccess, setKeySuccess] = useState(null);
  const [showFullPrompt, setShowFullPrompt] = useState(false);

  useEffect(() => {
    logPageView('Settings');
    fetchPrompt();
    fetchDefaultPrompt();
    fetchOpenAIKey();
  }, []);

  const fetchPrompt = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getUserPrompt();
      setAnalysisRules(response.analysis_rules || '');
      setDefaultAnalysisRules(response.default_analysis_rules || '');
      setHasCustomPrompt(response.has_custom_prompt || false);
    } catch (err) {
      console.error('Failed to fetch prompt:', err);
      setError('Failed to load your custom analysis rules. Using default.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDefaultPrompt = async () => {
    try {
      const response = await getDefaultPrompt();
      setFullPrompt(response.full_prompt || '');
      setDefaultAnalysisRules(response.analysis_rules || '');
    } catch (err) {
      console.error('Failed to fetch default prompt:', err);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      const response = await updateUserPrompt({ analysis_rules: analysisRules });
      setAnalysisRules(response.analysis_rules || '');
      setHasCustomPrompt(response.has_custom_prompt || false);
      setSuccess('Analysis rules saved successfully! Your custom rules will be used for future video processing.');
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to save analysis rules:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to save analysis rules. Please try again.');
      setSuccess(null);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset to the default analysis rules? Your custom rules will be deleted.')) {
      try {
        setSaving(true);
        setError(null);
        setSuccess(null);
        
        const response = await updateUserPrompt({ analysis_rules: '' });
        setAnalysisRules(response.analysis_rules || '');
        setHasCustomPrompt(false);
        setSuccess('Analysis rules reset to default successfully!');
        
        setTimeout(() => setSuccess(null), 5000);
      } catch (err) {
        console.error('Failed to reset analysis rules:', err);
        setError(err.response?.data?.detail || err.message || 'Failed to reset analysis rules. Please try again.');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleLoadDefault = () => {
    if (defaultAnalysisRules) {
      setAnalysisRules(defaultAnalysisRules);
      setSuccess('Default analysis rules loaded. Click "Save" to use them as your custom rules.');
      setTimeout(() => setSuccess(null), 5000);
    }
  };

  const fetchOpenAIKey = async () => {
    try {
      const response = await getUserOpenAIKey();
      setHasOpenAIKey(response.has_key || false);
      setMaskedOpenAIKey(response.masked_key || '');
      // Don't set the actual key, only show masked version
    } catch (err) {
      console.error('Failed to fetch OpenAI key:', err);
    }
  };

  const handleSaveOpenAIKey = async () => {
    try {
      setSavingKey(true);
      setKeyError(null);
      setKeySuccess(null);
      
      const response = await updateUserOpenAIKey({ api_key: openAIKey });
      setHasOpenAIKey(response.has_key || false);
      setMaskedOpenAIKey(response.masked_key || '');
      setOpenAIKey(''); // Clear the input field after saving
      setShowOpenAIKey(false);
      setKeySuccess(response.message || 'OpenAI API key saved successfully!');
      
      setTimeout(() => setKeySuccess(null), 5000);
    } catch (err) {
      console.error('Failed to save OpenAI key:', err);
      setKeyError(err.response?.data?.detail || err.message || 'Failed to save OpenAI key. Please try again.');
      setKeySuccess(null);
    } finally {
      setSavingKey(false);
    }
  };

  const handleRemoveOpenAIKey = async () => {
    if (confirm('Are you sure you want to remove your OpenAI API key? The system default will be used instead.')) {
      try {
        setSavingKey(true);
        setKeyError(null);
        setKeySuccess(null);
        
        const response = await updateUserOpenAIKey({ api_key: '' });
        setHasOpenAIKey(false);
        setMaskedOpenAIKey('');
        setOpenAIKey('');
        setShowOpenAIKey(false);
        setKeySuccess(response.message || 'OpenAI API key removed successfully!');
        
        setTimeout(() => setKeySuccess(null), 5000);
      } catch (err) {
        console.error('Failed to remove OpenAI key:', err);
        setKeyError(err.response?.data?.detail || err.message || 'Failed to remove OpenAI key. Please try again.');
      } finally {
        setSavingKey(false);
      }
    }
  };

  return (
    <Layout pageTitle="Settings">
      <SEO
        title="Settings"
        description="Manage your Epiplex settings including custom GPT prompts for video processing."
      />
      <div className={styles.dashboard}>
        <div style={{ padding: '40px', maxWidth: '1200px', margin: '0 auto' }}>
          {/* Page Header */}
          <div style={{ marginBottom: '32px' }}>
            <h1 style={{ 
              fontSize: '32px', 
              fontWeight: '700', 
              color: '#111827',
              margin: '0 0 8px 0'
            }}>
              Settings
            </h1>
            <p style={{ 
              fontSize: '16px', 
              color: '#6b7280',
              margin: 0
            }}>
              Customize your video processing settings and GPT prompts
            </p>
          </div>

          {/* GPT Prompt Section */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            padding: '32px',
            marginBottom: '24px'
          }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <div>
                  <h2 style={{ 
                    fontSize: '20px', 
                    fontWeight: '600', 
                    color: '#111827',
                    margin: '0 0 4px 0'
                  }}>
                    Frame Analysis Prompt
                  </h2>
                  <p style={{ 
                    fontSize: '14px', 
                    color: '#6b7280',
                    margin: 0
                  }}>
                    You can only customize the <strong>ANALYSIS RULES</strong> section. The rest of the prompt (output format, prohibitions, etc.) is fixed and cannot be modified.
                  </p>
                </div>
                {hasCustomPrompt && (
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    backgroundColor: '#dbeafe',
                    color: '#1e40af'
                  }}>
                    Custom Prompt Active
                  </span>
                )}
              </div>

              {/* Status Messages */}
              {error && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  color: '#991b1b',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}

              {success && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#d1fae5',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  color: '#065f46',
                  fontSize: '14px'
                }}>
                  {success}
                </div>
              )}

              {/* Read-only Prompt Sections */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px'
                  }}>
                    Fixed Sections (Read-Only)
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: '#6b7280',
                    lineHeight: '1.6'
                  }}>
                    The header, output format, prohibitions, goal, and response format sections are fixed and cannot be modified. Only the ANALYSIS RULES section below can be customized.
                  </div>
                </div>
              </div>

              {/* Editable ANALYSIS RULES Section */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#111827',
                  marginBottom: '12px'
                }}>
                  ANALYSIS RULES Section
                  <span style={{ 
                    display: 'inline-block',
                    marginLeft: '8px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: '500',
                    backgroundColor: '#dbeafe',
                    color: '#1e40af',
                    borderRadius: '4px'
                  }}>
                    EDITABLE CONTENT ONLY
                  </span>
                </label>
                
                {/* Read-only Header */}
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderBottom: 'none',
                  borderTopLeftRadius: '8px',
                  borderTopRightRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ fontWeight: '600' }}>### 🔍 **ANALYSIS RULES**</span>
                  <span style={{ 
                    fontSize: '10px', 
                    textTransform: 'uppercase',
                    color: '#9ca3af'
                  }}>
                    Fixed Header
                  </span>
                </div>
                
                {/* Editable Content */}
                {loading ? (
                  <div style={{
                    padding: '40px',
                    textAlign: 'center',
                    color: '#6b7280',
                    border: '2px solid #3b82f6',
                    borderTop: 'none',
                    borderBottom: 'none',
                    backgroundColor: '#f9fafb'
                  }}>
                    Loading analysis rules...
                  </div>
                ) : (
                  <textarea
                    value={analysisRules}
                    onChange={(e) => setAnalysisRules(e.target.value)}
                    placeholder={`1. **Description**

   * Provide a **concise but detailed factual description** of what is visible
   * Focus on **UI elements, layout, visible text presence, and visual state**
   * Describe **only what is visible**
   * No assumptions, no inferred behavior

2. **Meta Tags**

   * Return **exactly 3 short, relevant tags**
   * Tags must represent **key visual concepts** in the frame
   * Use **lowercase**
   * No spaces (use hyphens if needed)
   * Examples:
     \`login-screen\`, \`error-message\`, \`dashboard-ui\`, \`form-input\`, \`settings-page\`

3. **Timestamp**

   * Return the timestamp **exactly as provided**
   * Number only (seconds)`}
                    style={{
                      width: '100%',
                      minHeight: '350px',
                      padding: '16px',
                      border: '2px solid #3b82f6',
                      borderTop: 'none',
                      borderBottom: 'none',
                      borderLeft: '2px solid #3b82f6',
                      borderRight: '2px solid #3b82f6',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      lineHeight: '1.6',
                      resize: 'vertical',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      backgroundColor: '#ffffff'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#2563eb';
                      e.currentTarget.style.borderTopColor = '#3b82f6';
                      e.currentTarget.style.borderBottomColor = '#3b82f6';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = '#3b82f6';
                      e.currentTarget.style.borderTopColor = '#3b82f6';
                      e.currentTarget.style.borderBottomColor = '#3b82f6';
                    }}
                  />
                )}
                
                {/* Read-only Separator */}
                <div style={{
                  padding: '8px 16px',
                  backgroundColor: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderTop: 'none',
                  borderBottomLeftRadius: '8px',
                  borderBottomRightRadius: '8px',
                  fontSize: '14px',
                  fontFamily: 'monospace',
                  color: '#6b7280',
                  textAlign: 'center'
                }}>
                  <span>---</span>
                  <span style={{ 
                    marginLeft: '12px',
                    fontSize: '10px', 
                    textTransform: 'uppercase',
                    color: '#9ca3af'
                  }}>
                    Fixed Separator
                  </span>
                </div>
                
                <div style={{
                  marginTop: '8px',
                  fontSize: '12px',
                  color: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>{analysisRules.length} characters</span>
                  <span style={{ color: '#9ca3af' }}>•</span>
                  <span style={{ color: '#9ca3af', fontSize: '11px' }}>
                    Only the content between the header and separator is editable
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={handleSave}
                  disabled={loading || saving}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: saving ? '#9ca3af' : '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: loading || saving ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading && !saving) {
                      e.currentTarget.style.backgroundColor = '#2563eb';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading && !saving) {
                      e.currentTarget.style.backgroundColor = '#3b82f6';
                    }
                  }}
                >
                  {saving ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                        <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                        <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                      </svg>
                      Save Analysis Rules
                    </>
                  )}
                </button>

                {hasCustomPrompt && (
                  <button
                    onClick={handleReset}
                    disabled={loading || saving}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#ffffff',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: loading || saving ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading && !saving) {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                        e.currentTarget.style.borderColor = '#9ca3af';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading && !saving) {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.borderColor = '#d1d5db';
                      }
                    }}
                  >
                    Reset to Default
                  </button>
                )}

                <button
                  onClick={() => setShowFullPrompt(!showFullPrompt)}
                  disabled={loading}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                      e.currentTarget.style.borderColor = '#9ca3af';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }
                  }}
                >
                  {showFullPrompt ? 'Hide' : 'Show'} Full Prompt Preview
                </button>

                {defaultAnalysisRules && (
                  <button
                    onClick={handleLoadDefault}
                    disabled={loading || saving}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#ffffff',
                      color: '#3b82f6',
                      border: '1px solid #3b82f6',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: loading || saving ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading && !saving) {
                        e.currentTarget.style.backgroundColor = '#eff6ff';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!loading && !saving) {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                      }
                    }}
                  >
                    Load Default Rules
                  </button>
                )}
              </div>

              {/* Full Prompt Preview */}
              {showFullPrompt && fullPrompt && (
                <div style={{
                  marginTop: '24px',
                  padding: '20px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    color: '#111827',
                    margin: '0 0 12px 0'
                  }}>
                    Full Prompt Preview (Read-Only)
                  </h3>
                  <div style={{
                    padding: '16px',
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                    fontSize: '13px',
                    fontFamily: 'monospace',
                    lineHeight: '1.6',
                    color: '#374151',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: '500px',
                    overflow: 'auto',
                    position: 'relative'
                  }}>
                    {fullPrompt.split('### 🔍 **ANALYSIS RULES**').map((part, index) => {
                      if (index === 0) {
                        return <span key={index} style={{ color: '#6b7280' }}>{part}</span>;
                      }
                      const [rules, rest] = part.split('---', 2);
                      return (
                        <span key={index}>
                          <span style={{ 
                            color: '#3b82f6', 
                            fontWeight: '600',
                            backgroundColor: '#eff6ff',
                            padding: '2px 4px',
                            borderRadius: '3px'
                          }}>
                            ### 🔍 **ANALYSIS RULES**
                            {rules}
                          </span>
                          {rest && <span style={{ color: '#6b7280' }}>---{rest}</span>}
                        </span>
                      );
                    })}
                  </div>
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    backgroundColor: '#fef3c7',
                    border: '1px solid #fde68a',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#92400e'
                  }}>
                    <strong>Note:</strong> Only the highlighted ANALYSIS RULES section can be customized. All other sections are fixed.
                  </div>
                </div>
              )}

              {/* Info Box */}
              <div style={{
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px'
              }}>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <div style={{ fontSize: '14px', color: '#1e40af', lineHeight: '1.6' }}>
                    <strong>How it works:</strong>
                    <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                      <li>You can only customize the <strong>ANALYSIS RULES</strong> section</li>
                      <li>All other sections (output format, prohibitions, goal, etc.) are fixed and cannot be modified</li>
                      <li>Your custom ANALYSIS RULES will be combined with the fixed sections to create the full prompt</li>
                      <li>If you don&apos;t set custom rules, the default ANALYSIS RULES will be used</li>
                      <li>You can reset to the default ANALYSIS RULES at any time</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* OpenAI API Key Section */}
          <div style={{
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            border: '1px solid #e5e7eb',
            padding: '32px',
            marginBottom: '24px'
          }}>
            <div style={{ marginBottom: '24px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                marginBottom: '12px'
              }}>
                <div>
                  <h2 style={{ 
                    fontSize: '20px', 
                    fontWeight: '600', 
                    color: '#111827',
                    margin: '0 0 4px 0'
                  }}>
                    OpenAI API Key
                  </h2>
                  <p style={{ 
                    fontSize: '14px', 
                    color: '#6b7280',
                    margin: 0
                  }}>
                    Add your personal OpenAI API key to use your own quota. If not set, the system default key will be used.
                  </p>
                </div>
                {hasOpenAIKey && (
                  <span style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '500',
                    backgroundColor: '#d1fae5',
                    color: '#065f46'
                  }}>
                    Custom Key Active
                  </span>
                )}
              </div>

              {/* Status Messages */}
              {keyError && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  color: '#991b1b',
                  fontSize: '14px'
                }}>
                  {keyError}
                </div>
              )}

              {keySuccess && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#d1fae5',
                  border: '1px solid #86efac',
                  borderRadius: '8px',
                  marginBottom: '16px',
                  color: '#065f46',
                  fontSize: '14px'
                }}>
                  {keySuccess}
                </div>
              )}

              {/* Current Key Display */}
              {hasOpenAIKey && !showOpenAIKey && (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <div>
                      <div style={{
                        fontSize: '12px',
                        fontWeight: '500',
                        color: '#6b7280',
                        marginBottom: '4px'
                      }}>
                        Current API Key
                      </div>
                      <div style={{
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        color: '#111827',
                        wordBreak: 'break-all'
                      }}>
                        {maskedOpenAIKey}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowOpenAIKey(true)}
                      style={{
                        padding: '8px 16px',
                        backgroundColor: '#ffffff',
                        color: '#374151',
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                        e.currentTarget.style.borderColor = '#9ca3af';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                        e.currentTarget.style.borderColor = '#d1d5db';
                      }}
                    >
                      Update Key
                    </button>
                  </div>
                </div>
              )}

              {/* API Key Input */}
              {(showOpenAIKey || !hasOpenAIKey) && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: '#374151',
                    marginBottom: '8px'
                  }}>
                    OpenAI API Key
                    <span style={{ color: '#6b7280', fontWeight: '400', marginLeft: '4px' }}>
                      (starts with sk-)
                    </span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showOpenAIKey ? 'text' : 'password'}
                      value={openAIKey}
                      onChange={(e) => setOpenAIKey(e.target.value)}
                      placeholder="sk-..."
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        paddingRight: showOpenAIKey ? '40px' : '16px',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontFamily: 'monospace',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                      onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                    />
                    {showOpenAIKey && (
                      <button
                        type="button"
                        onClick={() => setShowOpenAIKey(false)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#6b7280'
                        }}
                        title="Hide key"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                          <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                      </button>
                    )}
                    {!showOpenAIKey && openAIKey && (
                      <button
                        type="button"
                        onClick={() => setShowOpenAIKey(true)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          color: '#6b7280'
                        }}
                        title="Show key"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      </button>
                    )}
                  </div>
                  <div style={{
                    marginTop: '8px',
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>
                    {openAIKey.length > 0 ? `${openAIKey.length} characters` : 'Enter your OpenAI API key (starts with sk-)'}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                {(showOpenAIKey || !hasOpenAIKey) && (
                  <button
                    onClick={handleSaveOpenAIKey}
                    disabled={savingKey || !openAIKey.trim()}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: (savingKey || !openAIKey.trim()) ? '#9ca3af' : '#3b82f6',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: (savingKey || !openAIKey.trim()) ? 'not-allowed' : 'pointer',
                      transition: 'background-color 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseEnter={(e) => {
                      if (!savingKey && openAIKey.trim()) {
                        e.currentTarget.style.backgroundColor = '#2563eb';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!savingKey && openAIKey.trim()) {
                        e.currentTarget.style.backgroundColor = '#3b82f6';
                      }
                    }}
                  >
                    {savingKey ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                          <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                          <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                          <polyline points="17 21 17 13 7 13 7 21"></polyline>
                          <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        Save API Key
                      </>
                    )}
                  </button>
                )}

                {hasOpenAIKey && (
                  <button
                    onClick={handleRemoveOpenAIKey}
                    disabled={savingKey}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#ffffff',
                      color: '#dc2626',
                      border: '1px solid #dc2626',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: savingKey ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!savingKey) {
                        e.currentTarget.style.backgroundColor = '#fef2f2';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!savingKey) {
                        e.currentTarget.style.backgroundColor = '#ffffff';
                      }
                    }}
                  >
                    Remove Key
                  </button>
                )}

                {hasOpenAIKey && !showOpenAIKey && (
                  <button
                    onClick={() => {
                      setShowOpenAIKey(true);
                      setOpenAIKey('');
                    }}
                    style={{
                      padding: '12px 24px',
                      backgroundColor: '#ffffff',
                      color: '#374151',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                      e.currentTarget.style.borderColor = '#9ca3af';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#ffffff';
                      e.currentTarget.style.borderColor = '#d1d5db';
                    }}
                  >
                    Update Key
                  </button>
                )}
              </div>

              {/* Info Box */}
              <div style={{
                marginTop: '24px',
                padding: '16px',
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                borderRadius: '8px'
              }}>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start'
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="16" x2="12" y2="12"></line>
                    <line x1="12" y1="8" x2="12.01" y2="8"></line>
                  </svg>
                  <div style={{ fontSize: '14px', color: '#92400e', lineHeight: '1.6' }}>
                    <strong>Security & Usage:</strong>
                    <ul style={{ margin: '8px 0 0 20px', padding: 0 }}>
                      <li>Your API key is stored securely and will be used for all your video processing requests</li>
                      <li>If you don&apos;t set a custom key, the system default key will be used</li>
                      <li>Your API key is masked in the interface for security</li>
                      <li>You can update or remove your key at any time</li>
                      <li>Make sure your API key has sufficient quota/credits for video processing</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </Layout>
  );
}

