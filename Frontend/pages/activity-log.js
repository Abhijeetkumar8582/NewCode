import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import styles from '../styles/Dashboard.module.css';
import { logPageView } from '../lib/activityLogger';
import { getActivityLogs, getActivityActions } from '../lib/api';
import dataCache, { CACHE_DURATION } from '../lib/dataCache';

export default function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const pageSize = 50;
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [availableActions, setAvailableActions] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [filterCalendarMonth, setFilterCalendarMonth] = useState(new Date());
  const calendarRef = useRef(null);

  const getCacheKey = useCallback(() => {
    return `activity-log:page:${currentPage}:action:${selectedAction || 'all'}:search:${searchQuery || 'none'}:start:${startDate || 'none'}:end:${endDate || 'none'}`;
  }, [currentPage, selectedAction, searchQuery, startDate, endDate]);

  const fetchActivityActions = useCallback(async () => {
    try {
      const response = await getActivityActions();
      if (response && Array.isArray(response)) {
        setAvailableActions(response);
      }
    } catch (error) {
      console.error('Failed to fetch activity actions:', error);
      // Don't show error for actions - it's not critical, just set empty array
      setAvailableActions([]);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    const cacheKey = getCacheKey();
    
    // Check cache first
    const cachedData = dataCache.get(cacheKey);
    if (cachedData) {
      setLogs(cachedData.logs);
      setTotalRecords(cachedData.total);
      setTotalPages(cachedData.page_size ? Math.ceil(cachedData.total / cachedData.page_size) : 1);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const params = {
        page: currentPage,
        page_size: pageSize
      };
      
      if (selectedAction) params.action = selectedAction;
      if (searchQuery) params.search = searchQuery;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;

      const response = await getActivityLogs(params);
      
      console.log('Activity logs API response:', response);
      
      if (response && response.logs) {
        setLogs(response.logs);
        setTotalRecords(response.total || response.logs.length);
        setTotalPages(Math.ceil((response.total || response.logs.length) / pageSize));
        
        // Cache the data
        dataCache.set(cacheKey, {
          logs: response.logs,
          total: response.total || response.logs.length,
          page_size: pageSize
        }, CACHE_DURATION.VIDEO_LIST);
      } else if (response && Array.isArray(response)) {
        // Handle case where API returns array directly
        setLogs(response);
        setTotalRecords(response.length);
        setTotalPages(Math.ceil(response.length / pageSize));
      } else {
        setLogs([]);
        setTotalRecords(0);
        setTotalPages(1);
      }
    } catch (err) {
      console.error('Failed to fetch activity logs:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        response: err.response?.data,
        status: err.response?.status,
        config: err.config
      });
      
      // Better error message handling
      let errorMessage = 'Failed to load activity logs';
      
      if (err.networkError || err.code === 'ECONNABORTED' || err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED' || err.message === 'Network Error' || err.message.includes('Network')) {
        errorMessage = err.enhancedMessage || 'Network Error: Unable to connect to the server. Please check your internet connection and ensure the backend server is running.';
      } else if (err.response) {
        // Server responded with error status
        if (err.response.status === 401) {
          errorMessage = 'Authentication required. Please sign in again.';
        } else if (err.response.status === 403) {
          errorMessage = 'Access denied. You do not have permission to view activity logs.';
        } else if (err.response.status === 404) {
          errorMessage = 'Activity logs endpoint not found. Please check the API configuration.';
        } else if (err.response.status >= 500) {
          errorMessage = 'Server error. Please try again later or contact support.';
        } else {
          errorMessage = err.response.data?.detail || err.response.data?.message || `Error ${err.response.status}: ${err.response.statusText}`;
        }
      } else if (err.message) {
        errorMessage = `${errorMessage}: ${err.message}`;
      }
      
      setError(errorMessage);
      setLogs([]);
      setTotalRecords(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [getCacheKey, currentPage, selectedAction, searchQuery, startDate, endDate]);

  // Initial load and fetch activity actions
  useEffect(() => {
    logPageView('Activity Log');
    fetchActivityActions();
  }, [fetchActivityActions]);

  // Fetch logs when filters change
  useEffect(() => {
    fetchLogs();
  }, [currentPage, selectedAction, startDate, endDate, fetchLogs]);

  // Debounced search - separate effect to avoid triggering on every keystroke
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery !== undefined) {
        setCurrentPage(1);
        fetchLogs();
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, fetchLogs]);

  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target)) {
        setDatePickerOpen(false);
      }
    };

    if (datePickerOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [datePickerOpen]);

  // Group logs by date
  const groupedLogs = useMemo(() => {
    const groups = {};
    logs.forEach(log => {
      if (!log.created_at) return;
      
      const date = new Date(log.created_at);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const logDate = new Date(date);
      logDate.setHours(0, 0, 0, 0);
      
      let dateKey;
      if (logDate.getTime() === today.getTime()) {
        dateKey = 'Today';
      } else {
        dateKey = date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
      
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(log);
    });
    
    // Sort dates (Today first, then by date descending)
    const sortedGroups = Object.keys(groups).sort((a, b) => {
      if (a === 'Today') return -1;
      if (b === 'Today') return 1;
      return new Date(b) - new Date(a);
    });
    
    return sortedGroups.map(key => ({
      date: key,
      logs: groups[key].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }));
  }, [logs]);

  const handleDateSelect = (date) => {
    setSelectedDate(date);
    const dateStr = date.toISOString().split('T')[0];
    setStartDate(dateStr);
    setEndDate(dateStr);
    setDatePickerOpen(false);
    setCurrentPage(1);
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
      <div style={{
        background: '#ffffff',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        padding: '16px',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        minWidth: '280px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}>
          <button
            onClick={() => navigateMonth(-1)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
            {monthName} {year}
          </div>
          <button
            onClick={() => navigateMonth(1)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px',
          marginBottom: '8px'
        }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#6b7280',
              textAlign: 'center',
              padding: '4px'
            }}>
              {day}
            </div>
          ))}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '4px'
        }}>
          {days.map((dayObj, index) => (
            <button
              key={index}
              onClick={() => dayObj.isCurrentMonth && handleDateSelect(dayObj.date)}
              disabled={!dayObj.isCurrentMonth}
              style={{
                padding: '8px',
                background: isSelected(dayObj.date) ? '#3b82f6' : 'transparent',
                color: isSelected(dayObj.date) ? '#ffffff' : (dayObj.isCurrentMonth ? '#111827' : '#d1d5db'),
                border: 'none',
                borderRadius: '4px',
                fontSize: '12px',
                cursor: dayObj.isCurrentMonth ? 'pointer' : 'default',
                fontWeight: isSelected(dayObj.date) ? '600' : '400'
              }}
            >
              {dayObj.day}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const formatRelativeTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);
      
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      
      // Return formatted time for same day, or date for older
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) {
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      }
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    } catch (error) {
      return dateString;
    }
  };

  const formatTime = (dateString) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      
      if (isToday) {
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      }
      
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return dateString;
    }
  };

  const getActionColor = (action) => {
    const actionColors = {
      'LOGIN': '#10b981',
      'LOGOUT': '#ef4444',
      'UPLOAD_VIDEO': '#3b82f6',
      'VIEW_DOCUMENT': '#8b5cf6',
      'DELETE_VIDEO': '#f59e0b',
      'BULK_DELETE_VIDEO': '#f59e0b',
      'PAGE_VIEW': '#6b7280',
      'API_REQUEST': '#6366f1',
      'API_CALL': '#6366f1'
    };
    return actionColors[action] || '#6b7280';
  };

  const getMethodColor = (method) => {
    const methodColors = {
      'GET': '#10b981',
      'POST': '#3b82f6',
      'PUT': '#f59e0b',
      'PATCH': '#8b5cf6',
      'DELETE': '#ef4444'
    };
    return methodColors[method] || '#6b7280';
  };

  const getStatusColor = (statusCode) => {
    if (statusCode >= 200 && statusCode < 300) return '#10b981'; // Green for 2xx
    if (statusCode >= 400 && statusCode < 500) return '#f59e0b'; // Yellow for 4xx
    if (statusCode >= 500) return '#ef4444'; // Red for 5xx
    return '#6b7280'; // Gray for others
  };

  const copyToClipboard = (text) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        // Could show a toast notification here
        console.log('Copied to clipboard:', text);
      });
    }
  };

  const getUserInitials = (description) => {
    // Try to extract user name from description or use default
    const match = description?.match(/(?:User|user)\s+(\w+)/i);
    if (match) {
      return match[1].charAt(0).toUpperCase();
    }
    return 'U';
  };

  const getUserName = (log) => {
    // Extract user name from metadata or description
    if (log.metadata?.user_name) {
      return log.metadata.user_name;
    }
    if (log.metadata?.user) {
      return log.metadata.user;
    }
    // Try to extract from description
    const match = log.description?.match(/(?:User|user)\s+(\w+)/i);
    if (match) {
      return match[1];
    }
    return 'User';
  };

  const getStatusBadge = (log) => {
    const desc = log.description?.toLowerCase() || '';
    if (desc.includes('failed') || desc.includes('error')) {
      return { text: 'Failed', color: '#ef4444', bg: '#fee2e2' };
    }
    if (desc.includes('success') || desc.includes('completed')) {
      return { text: 'Resolved', color: '#10b981', bg: '#d1fae5' };
    }
    return { text: 'Active', color: '#3b82f6', bg: '#dbeafe' };
  };

  return (
    <Layout pageTitle="Activity Log">
      <SEO
        title="Activity Log"
        description="View your activity logs and track all your actions on Epiplex Document Processing."
      />
      <div className={styles.dashboard}>
        {/* Page Header */}
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: '#111827',
            margin: '0 0 24px 0'
          }}>
            Activity Log
          </h1>

          {/* Filter Tab - Only All Activities */}
          <div style={{ 
            display: 'flex', 
            gap: '24px', 
            borderBottom: '2px solid #e5e7eb',
            marginBottom: '24px'
          }}>
            <div style={{
              padding: '12px 0',
              borderBottom: '2px solid #3b82f6',
              color: '#3b82f6',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              position: 'relative',
              bottom: '-2px'
            }}>
              All Activities
              {totalRecords > 0 && (
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: '500',
                  background: '#dbeafe',
                  color: '#3b82f6'
                }}>
                  {totalRecords}
                </span>
              )}
            </div>
          </div>

          {/* Search and Filter Bar */}
          <div style={{ 
            display: 'flex', 
            gap: '12px', 
            marginBottom: '24px',
            alignItems: 'center',
            position: 'relative'
          }}>
            <div style={{ 
              flex: 1, 
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <svg 
                width="20" 
                height="20" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                style={{
                  position: 'absolute',
                  left: '12px',
                  color: '#9ca3af',
                  pointerEvents: 'none'
                }}
              >
                <circle cx="11" cy="11" r="8"></circle>
                <path d="m21 21-4.35-4.35"></path>
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search with Action, Description, IP Address, etc"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '10px 32px 10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                background: '#ffffff',
                cursor: 'pointer',
                outline: 'none',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 12 12' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2 4L6 8L10 4' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 12px center',
                paddingRight: '40px'
              }}
            >
              <option value="">All Actions</option>
              {availableActions.map((action) => (
                <option key={action} value={action}>
                  {action.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
            <button
              onClick={() => setDatePickerOpen(!datePickerOpen)}
              style={{
                padding: '10px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                background: '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: '#374151',
                fontWeight: '500'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="16" y1="2" x2="16" y2="6"></line>
                <line x1="8" y1="2" x2="8" y2="6"></line>
                <line x1="3" y1="10" x2="21" y2="10"></line>
              </svg>
              Calendar
            </button>
            {datePickerOpen && (
              <div 
                ref={calendarRef}
                style={{
                  position: 'absolute',
                  right: '0',
                  top: '100%',
                  marginTop: '8px',
                  zIndex: 1000
                }}
              >
                {renderFilterCalendar(filterCalendarMonth, setFilterCalendarMonth)}
              </div>
            )}
          </div>
        </div>

        {/* Timeline View */}
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>
            <div style={{ marginBottom: '12px' }}>
              <svg 
                width="48" 
                height="48" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                style={{ 
                  animation: 'spin 1s linear infinite',
                  display: 'inline-block'
                }}
              >
                <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"></path>
              </svg>
            </div>
            Loading activity logs...
          </div>
        ) : error ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center',
            maxWidth: '600px',
            margin: '0 auto'
          }}>
            <div style={{
              padding: '24px',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              color: '#991b1b'
            }}>
              <div style={{ 
                fontSize: '48px', 
                marginBottom: '16px' 
              }}>
                ⚠️
              </div>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                marginBottom: '12px',
                color: '#991b1b'
              }}>
                Unable to Load Activity Logs
              </h3>
              <p style={{ 
                fontSize: '14px', 
                color: '#7f1d1d',
                marginBottom: '20px',
                lineHeight: '1.6'
              }}>
                {error}
              </p>
              <button
                onClick={() => {
                  setError(null);
                  fetchLogs();
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
              >
                Retry
              </button>
            </div>
          </div>
        ) : groupedLogs.length === 0 ? (
          <div style={{ 
            padding: '40px', 
            textAlign: 'center',
            maxWidth: '500px',
            margin: '0 auto'
          }}>
            <div style={{
              padding: '32px',
              backgroundColor: '#f9fafb',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}>
              <div style={{ 
                fontSize: '48px', 
                marginBottom: '16px' 
              }}>
                📝
              </div>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: '600', 
                marginBottom: '8px',
                color: '#111827'
              }}>
                No Activity Logs Found
              </h3>
              <p style={{ 
                fontSize: '14px', 
                color: '#6b7280',
                lineHeight: '1.6'
              }}>
                {searchQuery || selectedAction || startDate || endDate
                  ? 'No activity logs match your current filters. Try adjusting your search criteria.'
                  : 'You haven\'t performed any activities yet. Activity logs will appear here as you use the application.'}
              </p>
              {(searchQuery || selectedAction || startDate || endDate) && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedAction('');
                    setStartDate('');
                    setEndDate('');
                    setSelectedDate(null);
                    setCurrentPage(1);
                  }}
                  style={{
                    marginTop: '16px',
                    padding: '8px 16px',
                    backgroundColor: '#ffffff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f4f6';
                    e.currentTarget.style.borderColor = '#9ca3af';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                    e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            {groupedLogs.map((group, groupIndex) => (
              <div key={group.date} style={{ marginBottom: '32px' }}>
                {/* Date Header */}
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  marginBottom: '16px',
                  position: 'relative'
                }}>
                  <h3 style={{ 
                    fontSize: '16px', 
                    fontWeight: '600', 
                    color: '#111827',
                    margin: 0,
                    marginRight: '16px'
                  }}>
                    {group.date}
                  </h3>
                  <span style={{
                    fontSize: '14px',
                    color: '#6b7280',
                    marginLeft: 'auto'
                  }}>
                    {group.logs.length}
                  </span>
                </div>

                {/* Timeline */}
                <div style={{ 
                  position: 'relative',
                  paddingLeft: '32px',
                  borderLeft: '2px solid #e5e7eb'
                }}>
                  {group.logs.map((log, logIndex) => {
                    const status = getStatusBadge(log);
                    const userName = getUserName(log);
                    const userInitial = getUserInitials(log.description);
                    const actionColor = getActionColor(log.action);
                    
                    return (
                      <div 
                        key={log.id || logIndex}
                        style={{
                          position: 'relative',
                          marginBottom: '24px',
                          paddingLeft: '24px'
                        }}
                      >
                        {/* Timeline Dot */}
                        <div style={{
                          position: 'absolute',
                          left: '-8px',
                          top: '8px',
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: actionColor,
                          border: '2px solid #ffffff',
                          boxShadow: '0 0 0 2px ' + actionColor
                        }} />

                        {/* Log Entry */}
                        <div style={{
                          background: '#ffffff',
                          borderRadius: '8px',
                          padding: '16px',
                          border: '1px solid #e5e7eb',
                          transition: 'box-shadow 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
                        onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
                        >
                          {/* Header Row */}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '12px',
                            marginBottom: '12px'
                          }}>
                            {/* Timestamp */}
                            <span style={{
                              fontSize: '13px',
                              color: '#6b7280',
                              fontWeight: '500'
                            }}>
                              {formatRelativeTime(log.created_at)}
                            </span>
                            
                            {/* User Avatar and Name */}
                            <div style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              gap: '8px',
                              marginLeft: 'auto'
                            }}>
                              <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: `linear-gradient(135deg, ${actionColor} 0%, ${actionColor}dd 100%)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#ffffff',
                                fontSize: '14px',
                                fontWeight: '600'
                              }}>
                                {userInitial}
                              </div>
                              <span style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                color: '#111827'
                              }}>
                                {userName}
                              </span>
                            </div>
                          </div>

                          {/* Action Description */}
                          <div style={{ 
                            marginBottom: '8px',
                            fontSize: '14px',
                            color: '#374151',
                            lineHeight: '1.5'
                          }}>
                            {/* Special rendering for API_REQUEST logs */}
                            {(log.action === 'API_REQUEST' || log.action === 'API_CALL') && log.metadata ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                  {/* HTTP Method Badge */}
                                  {log.metadata.method && (
                                    <span style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: '700',
                                      textTransform: 'uppercase',
                                      background: getMethodColor(log.metadata.method),
                                      color: '#ffffff',
                                      fontFamily: 'monospace'
                                    }}>
                                      {log.metadata.method}
                                    </span>
                                  )}
                                  
                                  {/* Endpoint Path */}
                                  <span style={{
                                    fontSize: '13px',
                                    fontFamily: 'monospace',
                                    color: '#374151',
                                    fontWeight: '500'
                                  }}>
                                    {log.metadata.path || 'N/A'}
                                  </span>
                                  
                                  {/* Status Code Badge */}
                                  {log.metadata.status_code && (
                                    <span style={{
                                      padding: '4px 8px',
                                      borderRadius: '4px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      background: getStatusColor(log.metadata.status_code) + '20',
                                      color: getStatusColor(log.metadata.status_code),
                                      border: `1px solid ${getStatusColor(log.metadata.status_code)}40`
                                    }}>
                                      {log.metadata.status_code}
                                    </span>
                                  )}
                                  
                                  {/* Response Time */}
                                  {log.metadata.response_time_ms !== undefined && (
                                    <span style={{
                                      fontSize: '12px',
                                      color: log.metadata.is_slow ? '#ef4444' : '#6b7280',
                                      fontWeight: log.metadata.is_slow ? '600' : '400'
                                    }}>
                                      {Math.round(log.metadata.response_time_ms)}ms
                                      {log.metadata.is_slow && ' ⚠️ Slow'}
                                    </span>
                                  )}
                                </div>
                                
                                {/* Request ID (copyable) */}
                                {log.metadata.request_id && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '11px', color: '#9ca3af' }}>Request ID:</span>
                                    <code style={{
                                      fontSize: '11px',
                                      fontFamily: 'monospace',
                                      color: '#6366f1',
                                      background: '#f3f4f6',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      cursor: 'pointer'
                                    }}
                                    onClick={() => copyToClipboard(log.metadata.request_id)}
                                    title="Click to copy">
                                      {log.metadata.request_id}
                                    </code>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <>
                                <span style={{ fontWeight: '500' }}>
                                  {log.action?.replace(/_/g, ' ')}:
                                </span>{' '}
                                {log.description || 'No description available'}
                              </>
                            )}
                          </div>

                          {/* Metadata Row */}
                          <div style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '16px',
                            flexWrap: 'wrap'
                          }}>
                            {/* Status Badge */}
                            <span style={{
                              padding: '4px 12px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '500',
                              background: status.bg,
                              color: status.color
                            }}>
                              {status.text}
                            </span>

                            {/* IP Address */}
                            {log.ip_address && (
                              <span style={{
                                fontSize: '12px',
                                color: '#6b7280',
                                fontFamily: 'monospace'
                              }}>
                                IP: {log.ip_address}
                              </span>
                            )}

                            {/* Time */}
                            <span style={{
                              fontSize: '12px',
                              color: '#6b7280'
                            }}>
                              {formatTime(log.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ 
                marginTop: '32px',
                padding: '16px',
                borderTop: '1px solid #e5e7eb',
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                background: '#ffffff',
                borderRadius: '8px'
              }}>
                <div style={{ color: '#6b7280', fontSize: '14px' }}>
                  Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, totalRecords)} of {totalRecords} logs
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      background: currentPage === 1 ? '#f3f4f6' : '#ffffff',
                      color: currentPage === 1 ? '#9ca3af' : '#374151',
                      fontSize: '14px',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Previous
                  </button>
                  <span style={{ padding: '8px 16px', color: '#374151', fontSize: '14px' }}>
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '8px 16px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      background: currentPage === totalPages ? '#f3f4f6' : '#ffffff',
                      color: currentPage === totalPages ? '#9ca3af' : '#374151',
                      fontSize: '14px',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
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

