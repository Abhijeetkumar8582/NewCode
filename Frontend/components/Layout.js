import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import styles from '../styles/Dashboard.module.css';
import { logout } from '../lib/api';
import { getCurrentUser } from '../lib/auth';

export default function Layout({ children, pageTitle = 'Dashboard' }) {
  const router = useRouter();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [theme, setTheme] = useState('dark');
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [user, setUser] = useState(null);
  const accountDropdownRef = useRef(null);

  // Load user data from localStorage
  useEffect(() => {
    const userData = getCurrentUser();
    setUser(userData);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target)) {
        setAccountDropdownOpen(false);
      }
    };

    if (accountDropdownOpen) {
      // Use a small delay to avoid immediate closing when opening
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside);
      }, 100);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [accountDropdownOpen]);

  const handleNavigation = (path) => {
    router.push(path);
  };

  const getActiveNav = () => {
    if (router.pathname === '/dashboard' || router.pathname === '/') return 'Dashboard';
    if (router.pathname === '/process-data') return 'Process Data';
    if (router.pathname === '/document') return 'Document';
    if (router.pathname === '/activity-log') return 'Activity Log';
    if (router.pathname === '/help') return 'Help';
    return 'Dashboard';
  };

  const activeNav = getActiveNav();

  const toggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };


  const mainNavItems = [
    { id: 'Dashboard', label: 'Dashboard', path: '/dashboard', icon: 'grid' },
    { id: 'Process Data', label: 'Process Data', path: '/process-data', icon: 'chart' },
    { id: 'Document', label: 'Document', path: '/document', icon: 'document' }
  ];

  const supportNavItems = [
    { id: 'Activity Log', label: 'Activity Log', path: '/activity-log', icon: 'activity' },
    { id: 'Help', label: 'Help & Support', path: '/help', icon: 'help' }
  ];

  const renderIcon = (iconType) => {
    switch (iconType) {
      case 'grid':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
          </svg>
        );
      case 'chart':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
          </svg>
        );
      case 'document':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
          </svg>
        );
      case 'help':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        );
      case 'activity':
        return (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <>
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${styles[`sidebar${theme.charAt(0).toUpperCase() + theme.slice(1)}`]} ${sidebarExpanded ? styles.sidebarExpanded : styles.sidebarCollapsed}`}>
        {/* Logo Section */}
        <div className={styles.sidebarLogo}>
          <button className={styles.menuToggle} onClick={toggleSidebar} aria-label="Toggle sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div className={styles.logoIcon}>
            <Image
              src="https://epiplex.ai/wp-content/uploads/2024/08/cropped-piplex-ai-logo.png"
              alt="Epiplex Logo"
              width={40}
              height={40}
              className={styles.logoImage}
              priority
            />
          </div>
          <h2 className={styles.appName}>Epiplex</h2>
        </div>
        
        {/* Main Navigation */}
        <nav className={styles.sidebarNav}>
          {sidebarExpanded && (
            <div className={styles.navSectionHeader}>MAIN</div>
          )}
          {mainNavItems.map((item) => (
            <div
              key={item.id}
              className={styles.navItemWrapper}
            >
              <button
                className={`${styles.navItem} ${activeNav === item.id ? styles.navItemActive : ''}`}
                onClick={() => handleNavigation(item.path)}
                title={item.label}
              >
                {renderIcon(item.icon)}
                {sidebarExpanded && <span>{item.label}</span>}
              </button>
            </div>
          ))}

          {sidebarExpanded && (
            <div className={styles.navSectionHeader}>SUPPORT</div>
          )}
          {supportNavItems.map((item) => (
            <div
              key={item.id}
              className={styles.navItemWrapper}
            >
              <button
                className={`${styles.navItem} ${activeNav === item.id ? styles.navItemActive : ''}`}
                onClick={() => handleNavigation(item.path)}
                title={item.label}
              >
                {renderIcon(item.icon)}
                {sidebarExpanded && <span>{item.label}</span>}
              </button>
            </div>
          ))}
        </nav>

        {/* User Profile Section */}
        <div className={styles.userProfileSection} ref={accountDropdownRef}>
          <button 
            className={styles.userProfileClickable}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setAccountDropdownOpen(!accountDropdownOpen);
            }}
            type="button"
          >
            <div className={styles.userAvatar}>
              {user?.full_name ? (
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '600'
                }}>
                  {user.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              )}
            </div>
            {sidebarExpanded && (
              <div className={styles.userInfo}>
                <div className={styles.userName}>
                  {user?.full_name || user?.email || 'User Name'}
                </div>
                <div className={styles.userRole}>
                  {user?.role ? `${user.role.charAt(0).toUpperCase() + user.role.slice(1)} - Epiplex` : 'User - Epiplex'}
                </div>
              </div>
            )}
            {sidebarExpanded && (
              <div 
                className={`${styles.userDropdown} ${accountDropdownOpen ? styles.userDropdownOpen : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setAccountDropdownOpen(!accountDropdownOpen);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>
            )}
          </button>
          {accountDropdownOpen && (
            <div className={`${styles.accountDropdownMenu} ${!sidebarExpanded ? styles.accountDropdownMenuCollapsed : ''}`}>
              <button 
                className={styles.accountMenuItem}
                onClick={() => {
                  setAccountDropdownOpen(false);
                  router.push('/account');
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <span>Account</span>
              </button>
              <button 
                className={styles.accountMenuItem}
                onClick={() => {
                  setAccountDropdownOpen(false);
                  logout();
                  router.push('/auth');
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
                <span>Signout</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className={`${styles.mainContent} ${sidebarExpanded ? styles.mainContentExpanded : styles.mainContentCollapsed}`}>
        {children}
      </main>
    </>
  );
}

