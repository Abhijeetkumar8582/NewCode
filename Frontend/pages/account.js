import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import styles from '../styles/Dashboard.module.css';
import { logPageView, logAccountUpdate } from '../lib/activityLogger';
import { getCurrentUser } from '../lib/api';
import dataCache, { CACHE_DURATION } from '../lib/dataCache';

export default function Account() {
  const [isEditMode, setIsEditMode] = useState(false);
  
  const [formData, setFormData] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Log page view
    logPageView('Account');
    
    // Fetch current user data
    fetchUserData();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return dateString;
    }
  };

  const initializeFormData = (userData) => {
    if (!userData) return;
    
    const initialData = {
      // Personal Details
      fullName: userData.full_name || 'N/A',
      email: userData.email || 'N/A',
      // Account Details
      role: userData.role ? userData.role.charAt(0).toUpperCase() + userData.role.slice(1) : 'User',
      accountStatus: userData.is_active ? 'Active' : 'Inactive',
      accountCreated: formatDate(userData.created_at),
      lastLogin: userData.last_login_at ? formatDateTime(userData.last_login_at) : 'Never',
      lastUpdated: formatDate(userData.updated_at),
      // Additional info
      userId: userData.id || 'N/A',
      hasOpenAIKey: userData.openai_api_key !== null ? 'Configured' : 'Not Configured',
      hasCustomPrompt: userData.frame_analysis_prompt ? 'Yes' : 'No'
    };
    
    setFormData(initialData);
  };

  const fetchUserData = async () => {
    const CACHE_KEY = 'account:userData';
    
    try {
      setLoading(true);
      
      // Check cache first
      const cachedData = dataCache.get(CACHE_KEY);
      if (cachedData) {
        setUser(cachedData);
        initializeFormData(cachedData);
        setLoading(false);
        return;
      }

      const userData = await getCurrentUser();
      setUser(userData);
      
      // Cache the data
      if (userData) {
        dataCache.set(CACHE_KEY, userData, CACHE_DURATION.USER_DATA);
      }
      
      // Initialize form data with real user data
      initializeFormData(userData);
    } catch (error) {
      console.error('Failed to fetch user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditMode(true);
  };

  const handleSave = async () => {
    // Here you would typically save to an API
    console.log('Saving data:', formData);
    
    // Log account update
    logAccountUpdate({
      fields_updated: Object.keys(formData).filter(key => formData[key] !== initialFormData[key])
    });
    
    setIsEditMode(false);
    // You can add a success message here
    alert('Account information saved successfully!');
  };

  const handleCancel = () => {
    if (user) {
      initializeFormData(user);
    }
    setIsEditMode(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const renderEditableField = (field, value, isBadge = false, badgeClass = '') => {
    if (isEditMode) {
      if (isBadge) {
        // For badge fields, use select dropdown
        return (
          <select
            className={`${styles.editableInput} ${styles.editableSelect}`}
            value={value}
            onChange={(e) => handleInputChange(field, e.target.value)}
          >
            <option value="Enabled">Enabled</option>
            <option value="Disabled">Disabled</option>
            <option value="Subscribed">Subscribed</option>
            <option value="Unsubscribed">Unsubscribed</option>
            <option value="Verified">Verified</option>
            <option value="Not Verified">Not Verified</option>
            <option value="Activated">Activated</option>
            <option value="Deactivated">Deactivated</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        );
      }
      return (
        <input
          type="text"
          className={styles.editableInput}
          value={value}
          onChange={(e) => handleInputChange(field, e.target.value)}
        />
      );
    } else {
      if (isBadge) {
        return <span className={`${styles.infoValue} ${styles.badge} ${badgeClass}`}>{value}</span>;
      }
      return <span className={styles.infoValue}>{value}</span>;
    }
  };

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Account - Epiplex',
    description: 'Manage your account settings, personal details, security preferences, and account information.',
    mainEntity: {
      '@type': 'Person',
      name: 'User Account'
    }
  };

  return (
    <>
      <SEO
        title="Account"
        description="Manage your account settings, personal details, security preferences, and account information on Epiplex Document Processing."
        keywords="account settings, profile, personal details, security settings, account preferences, user account"
        structuredData={structuredData}
      />
      <div className={styles.dashboard}>
        <Layout>
          <div className={styles.accountPage}>
            {/* Breadcrumbs */}
            <div className={styles.accountBreadcrumbs}>
              <button className={styles.breadcrumbLink}>My Account</button>
              <span className={styles.breadcrumbSeparator}>/</span>
              <span className={styles.breadcrumbActive}>Profile</span>
            </div>

            {/* Action Buttons */}
            <div className={styles.accountActions}>
              {!isEditMode ? (
                <button className={styles.editButton} onClick={handleEdit}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                  <span>Edit</span>
                </button>
              ) : (
                <div className={styles.saveCancelButtons}>
                  <button className={styles.saveButton} onClick={handleSave}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                      <polyline points="17 21 17 13 7 13 7 21"></polyline>
                      <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    <span>Save</span>
                  </button>
                  <button className={styles.cancelButton} onClick={handleCancel}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>

            {/* Profile Header */}
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div>Loading account information...</div>
              </div>
            ) : user && formData ? (
              <div className={styles.profileHeader}>
                <div className={styles.profileAvatar}>
                  <div className={styles.avatarPlaceholder} style={{
                    backgroundColor: '#3b82f6',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '32px',
                    fontWeight: '600'
                  }}>
                    {user.full_name ? 
                      user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) :
                      user.email ? user.email[0].toUpperCase() : 'U'
                    }
                  </div>
                </div>
                <div className={styles.profileInfo}>
                  <div className={styles.profileName}>
                    <span>{user.full_name || user.email || 'User'}</span>
                    {user.is_active && (
                      <svg className={styles.verifiedIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                      </svg>
                    )}
                  </div>
                  <div className={styles.profileEmail}>{user.email || 'No email'}</div>
                </div>
              </div>
            ) : null}

            {/* Content Sections */}
            {loading ? null : user && formData ? (
              <div className={styles.accountContent}>
                {/* Left Column */}
                <div className={styles.accountColumn}>
                  {/* Personal Details */}
                  <div className={styles.accountSection}>
                    <h2 className={styles.sectionTitle}>Personal Details</h2>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Full Name</span>
                        <span className={styles.infoValue}>{formData.fullName}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Email</span>
                        <span className={styles.infoValue}>{formData.email}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>User ID</span>
                        <span className={styles.infoValue}>{formData.userId}</span>
                      </div>
                    </div>
                  </div>

                  {/* Account Settings */}
                  <div className={styles.accountSection}>
                    <h2 className={styles.sectionTitle}>Account Settings</h2>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Account Status</span>
                        <span className={`${styles.infoValue} ${styles.badge} ${user.is_active ? styles.badgeGreen : styles.badgeRed}`}>
                          {formData.accountStatus}
                        </span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Role</span>
                        <span className={`${styles.infoValue} ${styles.badge} ${styles.badgeBlue}`}>
                          {formData.role}
                        </span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>OpenAI API Key</span>
                        <span className={`${styles.infoValue} ${styles.badge} ${formData.hasOpenAIKey === 'Configured' ? styles.badgeGreen : styles.badgeYellow}`}>
                          {formData.hasOpenAIKey}
                        </span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Custom GPT Prompt</span>
                        <span className={`${styles.infoValue} ${styles.badge} ${formData.hasCustomPrompt === 'Yes' ? styles.badgeGreen : styles.badgeGray}`}>
                          {formData.hasCustomPrompt}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className={styles.accountColumn}>
                  {/* Account Details */}
                  <div className={styles.accountSection}>
                    <h2 className={styles.sectionTitle}>Account Details</h2>
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Account Created</span>
                        <span className={styles.infoValue}>{formData.accountCreated}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Last Login</span>
                        <span className={styles.infoValue}>{formData.lastLogin}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Last Updated</span>
                        <span className={styles.infoValue}>{formData.lastUpdated}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <span className={styles.infoLabel}>Account Verification</span>
                        <span className={`${styles.infoValue} ${styles.badge} ${user.is_active ? styles.badgeGreen : styles.badgeRed}`}>
                          {user.is_active ? 'Verified' : 'Not Verified'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div>No account data available</div>
              </div>
            )}
          </div>
        </Layout>
      </div>
    </>
  );
}

