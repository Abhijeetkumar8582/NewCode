import { useState, useEffect, useMemo } from 'react';
import Layout from '../components/Layout';
import SEO from '../components/SEO';
import styles from '../styles/Dashboard.module.css';
import { logPageView } from '../lib/activityLogger';
import { getActivityStats, getVideoStats } from '../lib/api';
import dataCache, { CACHE_DURATION } from '../lib/dataCache';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [videoStats, setVideoStats] = useState(null);
  const [activityStats, setActivityStats] = useState(null);
  const [error, setError] = useState(null);

  const CACHE_KEY_VIDEO_STATS = 'dashboard:videoStats';
  const CACHE_KEY_ACTIVITY_STATS = 'dashboard:activityStats';

  useEffect(() => {
    // Log page view
    logPageView('Dashboard');
    
    // Fetch dashboard data
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Check cache first
      const cachedVideoStats = dataCache.get(CACHE_KEY_VIDEO_STATS);
      const cachedActivityStats = dataCache.get(CACHE_KEY_ACTIVITY_STATS);

      // Use cached data if available
      if (cachedVideoStats) {
        setVideoStats(cachedVideoStats);
      }

      if (cachedActivityStats) {
        setActivityStats(cachedActivityStats);
      }

      // If we have both cached, skip API calls
      if (cachedVideoStats && cachedActivityStats) {
        setLoading(false);
        return;
      }

      // Fetch only missing data
      const promises = [];
      if (!cachedVideoStats) {
        promises.push(getVideoStats());
      } else {
        promises.push(Promise.resolve(cachedVideoStats));
      }

      if (!cachedActivityStats) {
        promises.push(
          getActivityStats(30).catch(err => {
            console.warn('Failed to fetch activity stats:', err);
            return null;
          })
        );
      } else {
        promises.push(Promise.resolve(cachedActivityStats));
      }

      const [videoData, activityData] = await Promise.allSettled(promises);
      
      // Handle video stats
      if (videoData.status === 'fulfilled') {
        const data = videoData.value;
        setVideoStats(data);
        // Cache the data
        dataCache.set(CACHE_KEY_VIDEO_STATS, data, CACHE_DURATION.DASHBOARD_STATS);
      } else {
        throw videoData.reason;
      }
      
      // Handle activity stats
      if (activityData.status === 'fulfilled' && activityData.value) {
        const data = activityData.value;
        setActivityStats(data);
        // Cache the data
        dataCache.set(CACHE_KEY_ACTIVITY_STATS, data, CACHE_DURATION.DASHBOARD_STATS);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  const [dateRangePickerOpen, setDateRangePickerOpen] = useState(false);
  const [selectedStartDate, setSelectedStartDate] = useState(null);
  const [selectedEndDate, setSelectedEndDate] = useState(null);
  const [currentMonth1, setCurrentMonth1] = useState(new Date());
  const [currentMonth2, setCurrentMonth2] = useState(new Date(new Date().setMonth(new Date().getMonth() + 1)));
  const [startTime, setStartTime] = useState({ hours: '00', minutes: '00' });
  const [endTime, setEndTime] = useState({ hours: '23', minutes: '59' });
  const [dateRangeText, setDateRangeText] = useState('Oct 18 - Nov 18');

  // Format number for display
  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '0s';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  // Calculate KPI Cards Data from real stats (memoized)
  const kpiCards = useMemo(() => videoStats ? [
    {
      id: 'total-processed',
      title: 'Total Processed',
      value: formatNumber(videoStats.completedVideos || 0),
      change: (videoStats.momGrowth || 0) >= 0 ? `+${videoStats.momGrowth || 0}%` : `${videoStats.momGrowth || 0}%`,
      isPositive: (videoStats.momGrowth || 0) >= 0,
      description: (videoStats.momGrowth || 0) >= 0 
        ? `Up ${videoStats.momGrowth || 0}% compared to last month`
        : `Down ${Math.abs(videoStats.momGrowth || 0)}% compared to last month`,
      progress: (videoStats.totalVideos || 0) > 0 
        ? Math.min(100, ((videoStats.completedVideos || 0) / (videoStats.totalVideos || 1)) * 100)
        : 0
    },
    {
      id: 'total-documents',
      title: 'Total Videos',
      value: formatNumber(videoStats.totalVideos || 0),
      change: (videoStats.momGrowth || 0) >= 0 ? `+${videoStats.momGrowth || 0}%` : `${videoStats.momGrowth || 0}%`,
      isPositive: (videoStats.momGrowth || 0) >= 0,
      description: `${videoStats.currentMonthVideos || 0} videos this month`,
      progress: 100
    },
    {
      id: 'success-rate',
      title: 'Success Rate',
      value: `${((videoStats.successRate || 0).toFixed(1))}%`,
      change: (videoStats.successRate || 0) >= 95 ? '+0%' : '-0%',
      isPositive: (videoStats.successRate || 0) >= 95,
      description: `${videoStats.completedVideos || 0} completed out of ${videoStats.totalVideos || 0} total`,
      progress: videoStats.successRate || 0
    },
    {
      id: 'processing-queue',
      title: 'Processing Queue',
      value: (videoStats.processingVideos || 0).toString(),
      change: (videoStats.processingVideos || 0) > 0 ? 'Active' : 'Empty',
      isPositive: (videoStats.processingVideos || 0) === 0,
      description: `${videoStats.processingVideos || 0} videos in queue`,
      progress: (videoStats.totalVideos || 0) > 0 
        ? ((videoStats.processingVideos || 0) / (videoStats.totalVideos || 1)) * 100
        : 0
    }
  ] : [], [videoStats]);

  // Graph Cards Data from real stats (memoized)
  const graphCards = useMemo(() => videoStats ? [
    {
      id: 'monthly-processing',
      title: 'Monthly Processing',
      value: (videoStats.currentMonthVideos || 0).toString(),
      change: (videoStats.momGrowth || 0) >= 0 ? `+${videoStats.momGrowth || 0}% vs last month` : `${videoStats.momGrowth || 0}% vs last month`,
      isPositive: (videoStats.momGrowth || 0) >= 0,
      type: 'line',
      data: videoStats.monthlyData ? Object.entries(videoStats.monthlyData).reverse().map(([key, value]) => ({
        month: key,
        count: value || 0
      })) : []
    },
    {
      id: 'daily-processing',
      title: 'Daily Processing (30 days)',
      value: videoStats.dailyData ? Object.values(videoStats.dailyData).reduce((sum, val) => sum + (val || 0), 0).toString() : '0',
      change: `${videoStats.completedVideos || 0} completed videos`,
      isPositive: true,
      type: 'bar',
      data: videoStats.dailyData ? Object.entries(videoStats.dailyData).reverse().slice(0, 30).map(([key, value]) => ({
        date: key,
        count: value || 0
      })) : []
    }
  ] : [], [videoStats]);

  // Insight Cards Data from real stats
  const getTopApplication = () => {
    if (!videoStats || !videoStats.appDistribution) return null;
    const entries = Object.entries(videoStats.appDistribution);
    if (entries.length === 0) return null;
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return sorted[0];
  };

  const getTopLanguage = () => {
    if (!videoStats || !videoStats.languageDistribution) return null;
    const entries = Object.entries(videoStats.languageDistribution);
    if (entries.length === 0) return null;
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    return sorted[0];
  };

  const getBestMonth = () => {
    if (!videoStats || !videoStats.monthlyData) return null;
    const entries = Object.entries(videoStats.monthlyData);
    if (entries.length === 0) return null;
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const [monthKey, count] = sorted[0];
    const [year, month] = monthKey.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return { month: monthNames[parseInt(month) - 1], count };
  };

  const topApp = getTopApplication();
  const topLang = getTopLanguage();
  const bestMonth = getBestMonth();

  const insightCards = useMemo(() => videoStats ? [
    {
      id: 'status-distribution',
      title: 'Status Distribution',
      type: 'donut',
      data: {
        main: 'Completed',
        percentage: (videoStats.totalVideos || 0) > 0 
          ? Math.round(((videoStats.completedVideos || 0) / (videoStats.totalVideos || 1)) * 100)
          : 0,
        other: 100 - ((videoStats.totalVideos || 0) > 0 
          ? Math.round(((videoStats.completedVideos || 0) / (videoStats.totalVideos || 1)) * 100)
          : 0)
      }
    },
    {
      id: 'best-month',
      title: 'Best Month',
      value: bestMonth ? bestMonth.count.toString() : '0',
      label: bestMonth ? bestMonth.month : 'N/A'
    },
    {
      id: 'total-frames',
      title: 'Total Frames Analyzed',
      value: formatNumber(videoStats.totalFrames || 0),
      label: `${videoStats.frameAnalysisRate || 0}% with GPT`
    },
    {
      id: 'top-application',
      title: 'Top Application',
      value: topApp ? (topApp[0] || 'N/A') : 'N/A',
      percentage: topApp && (videoStats.totalVideos || 0) > 0
        ? `${Math.round(((topApp[1] || 0) / (videoStats.totalVideos || 1)) * 100)}% of total`
        : '0% of total'
    },
    {
      id: 'top-language',
      title: 'Top Language',
      value: topLang ? (topLang[0] || 'N/A').toUpperCase() : 'N/A',
      percentage: topLang && (videoStats.totalVideos || 0) > 0
        ? `${Math.round(((topLang[1] || 0) / (videoStats.totalVideos || 1)) * 100)}% of total`
        : '0% of total'
    }
  ] : [], [videoStats, topApp, topLang, bestMonth]);

  // Sample metrics data (keeping for structured data)
  const metrics = [
    {
      id: 'execution-time',
      title: 'Execution Time Analysis',
      mainValue: '71.74%',
      subValues: [
        { label: '174 Verified', value: '174' },
        { label: '31 Pending Check', value: '31' }
      ],
      progress: { value: 72, total: 100, type: 'circular' }
    },
    {
      id: 'step-duration',
      title: 'Step Duration Breakdown',
      mainValue: '56.1%',
      subValues: [
        { label: '65% Syncs', value: '65%' },
        { label: '82% Fetches', value: '82%' }
      ],
      progress: { value: 56, total: 100, type: 'chart' }
    },
    {
      id: 'bottleneck',
      title: 'Bottleneck Identification',
      mainValue: '82.6%',
      subValues: [
        { label: '34% Manuals', value: '34%' },
        { label: '12% Autosync', value: '12%' },
        { label: '84 Done', value: '84' },
        { label: '24% Active', value: '24%' }
      ],
      progress: { value: 83, total: 100, type: 'chart' }
    },
    {
      id: 'user-interaction',
      title: 'User Interaction Metrics',
      mainValue: '10.12%',
      subValues: [
        { label: '1.62k Detected', value: '1.62k' },
        { label: '13.7k Total Items', value: '13.7k' }
      ],
      progress: { value: 12, total: 100 }
    },
    {
      id: 'ui-heatmap',
      title: 'UI Element Heatmap',
      mainValue: '89.5%',
      subValues: [
        { label: '2.3k Interactions', value: '2.3k' },
        { label: '156 Hotspots', value: '156' }
      ],
      progress: { value: 90, total: 100 }
    },
    {
      id: 'transcript-insights',
      title: 'Transcript Insights',
      mainValue: '94.2%',
      subValues: [
        { label: '12.5k Transcribed', value: '12.5k' },
        { label: '98% Accuracy', value: '98%' }
      ],
      progress: { value: 94, total: 100 }
    },
    {
      id: 'version-comparison',
      title: 'Version Comparison',
      mainValue: '76.8%',
      subValues: [
        { label: '45 Versions', value: '45' },
        { label: '12 Active', value: '12' }
      ],
      progress: { value: 77, total: 100 }
    },
    {
      id: 'exception-error',
      title: 'Exception & Error Analysis',
      mainValue: '3.2%',
      subValues: [
        { label: '234 Errors', value: '234' },
        { label: '7.2k Total', value: '7.2k' }
      ],
      progress: { value: 3, total: 100 }
    },
    {
      id: 'variants-path',
      title: 'Variants & Path Analysis',
      mainValue: '68.4%',
      subValues: [
        { label: '89 Variants', value: '89' },
        { label: '23 Paths', value: '23' }
      ],
      progress: { value: 68, total: 100 }
    },
    {
      id: 'rework-editing',
      title: 'Rework & Editing Metrics',
      mainValue: '42.7%',
      subValues: [
        { label: '1.2k Reworks', value: '1.2k' },
        { label: '456 Edits', value: '456' }
      ],
      progress: { value: 43, total: 100 }
    },
    {
      id: 'usage-adoption',
      title: 'Usage & Adoption Stats',
      mainValue: '85.3%',
      subValues: [
        { label: '5.6k Users', value: '5.6k' },
        { label: '92% Adoption', value: '92%' }
      ],
      progress: { value: 85, total: 100 }
    },
    {
      id: 'document-export',
      title: 'Document Export Insights',
      mainValue: '91.8%',
      subValues: [
        { label: '8.9k Exported', value: '8.9k' },
        { label: '234 Failed', value: '234' }
      ],
      progress: { value: 92, total: 100 }
    },
    {
      id: 'quality-scores',
      title: 'Quality Scores',
      mainValue: '88.5%',
      subValues: [
        { label: 'Avg Score', value: '88.5' },
        { label: '1.2k Rated', value: '1.2k' }
      ],
      progress: { value: 89, total: 100 }
    },
    {
      id: 'ai-recommendations',
      title: 'AI Recommendations',
      mainValue: '73.6%',
      subValues: [
        { label: '456 Recommendations', value: '456' },
        { label: '89% Accepted', value: '89%' }
      ],
      progress: { value: 74, total: 100 }
    }
  ];

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'DashboardPage',
    name: 'Epiplex Dashboard',
    description: 'View comprehensive analytics and statistics for your document processing tasks',
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: metrics.length,
      itemListElement: metrics.map((metric, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: metric.title
      }))
    }
  };

  // Helper functions for calendar
  function getDaysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  function getFirstDayOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  }

  function formatDate(date) {
    if (!date) return '';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  }

  function isSameDay(date1, date2) {
    if (!date1 || !date2) return false;
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  }

  function handleDateClick(date) {
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
      setSelectedStartDate(date);
      setSelectedEndDate(null);
    } else if (selectedStartDate && !selectedEndDate) {
      if (date < selectedStartDate) {
        setSelectedEndDate(selectedStartDate);
        setSelectedStartDate(date);
      } else {
        setSelectedEndDate(date);
      }
    }
  }

  function handleQuickSelect(type) {
    const today = new Date();
    let start, end;

    switch (type) {
      case 'today':
        start = new Date(today);
        end = new Date(today);
        break;
      case 'yesterday':
        start = new Date(today);
        start.setDate(start.getDate() - 1);
        end = new Date(start);
        break;
      case 'last7days':
        start = new Date(today);
        start.setDate(start.getDate() - 6);
        end = new Date(today);
        break;
      case 'last30days':
        start = new Date(today);
        start.setDate(start.getDate() - 29);
        end = new Date(today);
        break;
      case 'thisMonth':
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today);
        break;
      case 'lastMonth':
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      default:
        return;
    }

    setSelectedStartDate(start);
    setSelectedEndDate(end);
    setCurrentMonth1(new Date(start));
    setCurrentMonth2(new Date(start.getFullYear(), start.getMonth() + 1, 1));
  }

  function handleSaveDateRange() {
    if (selectedStartDate && selectedEndDate) {
      const startText = formatDate(selectedStartDate);
      const endText = formatDate(selectedEndDate);
      setDateRangeText(`${startText} - ${endText}`);
      setDateRangePickerOpen(false);
    }
  }

  function renderCalendar(monthDate, setMonthDate, calendarIndex) {
    const daysInMonth = getDaysInMonth(monthDate);
    const firstDay = getFirstDayOfMonth(monthDate);
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

    return (
      <div key={calendarIndex} className={styles.calendar}>
        <div className={styles.calendarHeader}>
          {calendarIndex === 0 && (
            <button className={styles.calendarNavButton} onClick={() => navigateMonth(-1)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
          )}
          <div className={styles.calendarMonthYear}>
            {monthName} {year}
          </div>
          {calendarIndex === 1 && (
            <button className={styles.calendarNavButton} onClick={() => navigateMonth(1)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          )}
        </div>
        <div className={styles.calendarWeekdays}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className={styles.calendarWeekday}>{day}</div>
          ))}
        </div>
        <div className={styles.calendarDays}>
          {days.map((dayObj, index) => {
            const isSelected = (selectedStartDate && isSameDay(dayObj.date, selectedStartDate)) ||
                              (selectedEndDate && isSameDay(dayObj.date, selectedEndDate));
            const isInRange = selectedStartDate && selectedEndDate &&
                            dayObj.date >= selectedStartDate && dayObj.date <= selectedEndDate;
            
            return (
              <button
                key={index}
                className={`${styles.calendarDay} ${!dayObj.isCurrentMonth ? styles.calendarDayOtherMonth : ''} ${isSelected ? styles.calendarDaySelected : ''} ${isInRange ? styles.calendarDayInRange : ''}`}
                onClick={() => handleDateClick(dayObj.date)}
              >
                {dayObj.day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <>
      <SEO
        title="Dashboard - Epiplex Document Processing"
        description="Comprehensive analytics dashboard for document processing. Track KPIs, processing metrics, quarterly growth, and insights. Monitor total processed documents, success rates, and user activity."
        keywords="dashboard, analytics, document processing, KPI, metrics, business intelligence, data visualization, document analytics, processing insights"
        structuredData={structuredData}
      />
      <Layout>
        {/* Top Header */}
        <header className={styles.dashboardHeader}>
            <h1 className={styles.dashboardPageTitle}>Dashboard</h1>
            <div className={styles.headerActions}>
              <button 
                className={styles.headerActionButton}
                onClick={() => setDateRangePickerOpen(true)}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                <span>{dateRangeText}</span>
              </button>
              <button className={styles.headerActionButton}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                <span>Export</span>
              </button>
            </div>
          </header>

          <main className={styles.dashboardMain}>
            {loading && (
              <div className={styles.loadingContainer}>
                <div className={styles.loadingSpinner}>
                  <div className={styles.spinner}></div>
                </div>
                <p className={styles.loadingText}>Loading dashboard data...</p>
              </div>
            )}
            
            {error && (
              <div className={styles.errorContainer}>
                <div className={styles.errorIcon}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <h3 className={styles.errorTitle}>Unable to Load Dashboard</h3>
                <p className={styles.errorMessage}>{error}</p>
                <button 
                  onClick={fetchDashboardData}
                  className={styles.retryButton}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                  Retry
                </button>
              </div>
            )}

            {!loading && !error && videoStats && kpiCards && kpiCards.length > 0 && (
              <>
                {/* KPI Cards Section */}
                <section className={styles.kpiSection}>
                  <div className={styles.kpiGrid}>
                    {kpiCards.map((kpi) => {
                      // Get icon, gradient, and accent color based on KPI type
                      const getKpiConfig = () => {
                        switch(kpi.id) {
                          case 'total-processed':
                            return {
                              icon: (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                              ),
                              gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                              accent: '#f5576c'
                            };
                          case 'total-documents':
                            return {
                              icon: (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                  <polyline points="14 2 14 8 20 8"></polyline>
                                  <line x1="16" y1="13" x2="8" y2="13"></line>
                                  <line x1="16" y1="17" x2="8" y2="17"></line>
                                </svg>
                              ),
                              gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              accent: '#764ba2'
                            };
                          case 'success-rate':
                            return {
                              icon: (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                                </svg>
                              ),
                              gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                              accent: '#00f2fe'
                            };
                          case 'processing-queue':
                            return {
                              icon: (
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <polyline points="12 6 12 12 16 14"></polyline>
                                </svg>
                              ),
                              gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                              accent: '#fee140'
                            };
                          default:
                            return {
                              icon: null,
                              gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              accent: '#764ba2'
                            };
                        }
                      };

                      const config = getKpiConfig();

                      return (
                        <article key={kpi.id} className={styles.kpiCard}>
                          <div className={styles.kpiCardContent}>
                            <div className={styles.kpiIconWrapper} style={{ background: config.gradient }}>
                              {config.icon}
                            </div>
                            <div className={styles.kpiCardInfo}>
                              <h3 className={styles.kpiCardTitle}>{kpi.title}</h3>
                              <div className={styles.kpiCardValue}>{kpi.value}</div>
                              <div className={`${styles.kpiCardChange} ${kpi.isPositive ? styles.kpiChangePositive : styles.kpiChangeNegative}`}>
                                <span className={styles.kpiChangeIcon}>{kpi.isPositive ? '▲' : '▼'}</span>
                                <span>{kpi.change}</span>
                              </div>
                            </div>
                          </div>
                          <p className={styles.kpiCardDescription}>{kpi.description}</p>
                          <div className={styles.kpiProgressBar}>
                            <div className={styles.kpiProgressTrack}>
                              <div 
                                className={styles.kpiProgressFill}
                                style={{ width: `${kpi.progress}%`, background: config.gradient }}
                              ></div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                {/* Graph Cards Section */}
                <section className={styles.graphSection}>
                  <div className={styles.graphGrid}>
                    {graphCards && graphCards.length > 0 && graphCards.map((graph) => {
                      return (
                        <article key={graph.id} className={styles.graphCard}>
                          <div className={styles.graphCardHeader}>
                            <div>
                              <h3 className={styles.graphCardTitle}>{graph.title}</h3>
                              <div className={styles.graphCardValue}>{graph.value}</div>
                              <div className={styles.graphCardChange}>
                                <span className={styles.kpiChangeIcon}>{graph.isPositive ? '▲' : '▼'}</span>
                                <span>{graph.change}</span>
                              </div>
                            </div>
                            <div className={styles.graphCardIcon}>
                              {graph.type === 'line' ? (
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.9">
                                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline>
                                  <polyline points="17 6 23 6 23 12"></polyline>
                                </svg>
                              ) : (
                                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.9">
                                  <line x1="18" y1="20" x2="18" y2="10"></line>
                                  <line x1="12" y1="20" x2="12" y2="4"></line>
                                  <line x1="6" y1="20" x2="6" y2="14"></line>
                                </svg>
                              )}
                            </div>
                          </div>
                          <div className={styles.graphPlaceholder}>
                            {graph.type === 'line' && graph.data ? (
                              <svg width="100%" height="160" viewBox="0 0 400 160" preserveAspectRatio="none">
                                {(() => {
                                  const maxValue = Math.max(...graph.data.map(d => d.count), 1);
                                  const points = graph.data.map((d, i) => {
                                    const x = (i / (graph.data.length - 1 || 1)) * 400;
                                    const y = 160 - (d.count / maxValue) * 140;
                                    return `${x},${y}`;
                                  }).join(' ');
                                  
                                  return (
                                    <>
                                      <polyline
                                        points={points}
                                        fill="none"
                                        stroke="#3b82f6"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                      <polyline
                                        points={`0,160 ${points} 400,160`}
                                        fill={`url(#lineGradient-${graph.id})`}
                                        opacity="0.2"
                                      />
                                      <defs>
                                        <linearGradient id={`lineGradient-${graph.id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                                          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                                          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                                        </linearGradient>
                                      </defs>
                                    </>
                                  );
                                })()}
                              </svg>
                            ) : graph.type === 'bar' && graph.data ? (
                              <svg width="100%" height="160" viewBox="0 0 400 160" preserveAspectRatio="none">
                                {(() => {
                                  const maxValue = Math.max(...graph.data.map(d => d.count), 1);
                                  const barWidth = 380 / Math.min(graph.data.length, 30);
                                  return graph.data.slice(0, 30).map((d, i) => {
                                    const x = 10 + i * barWidth;
                                    const height = (d.count / maxValue) * 140;
                                    const y = 160 - height;
                                    return (
                                      <rect
                                        key={i}
                                        x={x}
                                        y={y}
                                        width={barWidth - 2}
                                        height={height}
                                        fill={d.count > 0 ? "#3b82f6" : "#e5e7eb"}
                                        rx="2"
                                      />
                                    );
                                  });
                                })()}
                              </svg>
                            ) : (
                              <svg width="100%" height="160" viewBox="0 0 400 160" preserveAspectRatio="none">
                                <rect x="20" y="100" width="60" height="60" fill="#e5e7eb" rx="3" />
                                <rect x="100" y="80" width="60" height="80" fill="#e5e7eb" rx="3" />
                                <rect x="180" y="40" width="60" height="120" fill="#3b82f6" rx="3" />
                                <rect x="260" y="70" width="60" height="90" fill="#e5e7eb" rx="3" />
                                <rect x="340" y="90" width="60" height="70" fill="#e5e7eb" rx="3" />
                              </svg>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                {/* Insight Cards Section */}
                <section className={styles.insightSection}>
                  <div className={styles.insightGrid}>
                    {insightCards && insightCards.length > 0 && insightCards.map((insight) => {
                      return (
                        <article key={insight.id} className={styles.insightCard}>
                          <h3 className={styles.insightCardTitle}>{insight.title}</h3>
                          {insight.type === 'donut' ? (
                            <div className={styles.donutChart}>
                              <svg width="100" height="100" viewBox="0 0 120 120">
                                <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="20" />
                                <circle
                                  cx="60"
                                  cy="60"
                                  r="50"
                                  fill="none"
                                  stroke="#3b82f6"
                                  strokeWidth="20"
                                  strokeDasharray={`${2 * Math.PI * 50 * (insight.data.percentage / 100)} ${2 * Math.PI * 50}`}
                                  strokeDashoffset={`${2 * Math.PI * 50 * 0.25}`}
                                  transform="rotate(-90 60 60)"
                                  strokeLinecap="round"
                                />
                                <text x="60" y="65" textAnchor="middle" fill="#111827" fontSize="20" fontWeight="700">
                                  {insight.data.percentage}%
                                </text>
                              </svg>
                              <div className={styles.donutLegend}>
                                <div className={styles.donutLegendItem}>
                                  <span className={styles.donutDot} style={{ backgroundColor: '#3b82f6' }}></span>
                                  <span>{insight.data.main}</span>
                                </div>
                                <div className={styles.donutLegendItem}>
                                  <span className={styles.donutDot} style={{ backgroundColor: '#e5e7eb' }}></span>
                                  <span>Others</span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className={styles.insightCardValue}>{insight.value}</div>
                              {insight.label && <div className={styles.insightCardLabel}>{insight.label}</div>}
                              {insight.breakdown && <div className={styles.insightCardBreakdown}>{insight.breakdown}</div>}
                              {insight.percentage && <div className={styles.insightCardPercentage}>{insight.percentage}</div>}
                            </>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              </>
            )}
          </main>

          {/* Date Range Picker Modal */}
          {dateRangePickerOpen && (
            <div className={styles.dateRangeOverlay} onClick={() => setDateRangePickerOpen(false)}>
              <div className={styles.dateRangePicker} onClick={(e) => e.stopPropagation()}>
                <div className={styles.dateRangeContent}>
                  {/* Two Calendars */}
                  <div className={styles.calendarsContainer}>
                    {renderCalendar(currentMonth1, setCurrentMonth1, 0)}
                    {renderCalendar(currentMonth2, setCurrentMonth2, 1)}
                  </div>

                  {/* Quick Selection Buttons */}
                  <div className={styles.quickSelectionButtons}>
                    <button className={styles.quickButton} onClick={() => handleQuickSelect('today')}>
                      Today
                    </button>
                    <button className={styles.quickButton} onClick={() => handleQuickSelect('yesterday')}>
                      Yesterday
                    </button>
                    <button className={styles.quickButton} onClick={() => handleQuickSelect('last7days')}>
                      Last 7 days
                    </button>
                    <button className={styles.quickButton} onClick={() => handleQuickSelect('last30days')}>
                      Last 30 days
                    </button>
                    <button className={styles.quickButton} onClick={() => handleQuickSelect('thisMonth')}>
                      This month
                    </button>
                    <button className={styles.quickButton} onClick={() => handleQuickSelect('lastMonth')}>
                      Last month
                    </button>
                  </div>
                </div>

                {/* Time Inputs */}
                <div className={styles.timeInputsContainer}>
                  <div className={styles.timeInputGroup}>
                    <input
                      type="text"
                      className={styles.timeInput}
                      value={startTime.hours}
                      onChange={(e) => setStartTime({ ...startTime, hours: e.target.value })}
                      maxLength="2"
                    />
                    <span className={styles.timeSeparator}>:</span>
                    <input
                      type="text"
                      className={styles.timeInput}
                      value={startTime.minutes}
                      onChange={(e) => setStartTime({ ...startTime, minutes: e.target.value })}
                      maxLength="2"
                    />
                  </div>
                  <span className={styles.timeDash}>-</span>
                  <div className={styles.timeInputGroup}>
                    <input
                      type="text"
                      className={styles.timeInput}
                      value={endTime.hours}
                      onChange={(e) => setEndTime({ ...endTime, hours: e.target.value })}
                      maxLength="2"
                    />
                    <span className={styles.timeSeparator}>:</span>
                    <input
                      type="text"
                      className={styles.timeInput}
                      value={endTime.minutes}
                      onChange={(e) => setEndTime({ ...endTime, minutes: e.target.value })}
                      maxLength="2"
                    />
                  </div>
                </div>

                {/* Save and Cancel Buttons */}
                <div className={styles.dateRangeFooter}>
                  <button className={styles.dateRangeCancelButton} onClick={() => setDateRangePickerOpen(false)}>
                    Cancel
                  </button>
                  <button className={styles.dateRangeSaveButton} onClick={handleSaveDateRange}>
                    Save
                  </button>
                </div>
              </div>
            </div>
          )}
        </Layout>
    </>
  );
}
