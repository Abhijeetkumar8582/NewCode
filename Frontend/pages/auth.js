import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import styles from '../styles/Auth.module.css';
import { login, signup, getGoogleAuthUrl } from '../lib/api';
import { isAuthenticated } from '../lib/auth';

export default function Auth() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: ''
  });

  // Redirect if already logged in
  useEffect(() => {
    if (router.isReady && isAuthenticated()) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isSignUp) {
        // Signup
        if (!formData.fullName || !formData.email || !formData.password) {
          setError('Please fill in all fields');
          setIsLoading(false);
          return;
        }
        if (formData.password.length < 4) {
          setError('Password must be at least 4 characters long');
          setIsLoading(false);
          return;
        }
        if (formData.password.length > 20) {
          setError('Password must be at most 20 characters long');
          setIsLoading(false);
          return;
        }
        await signup(formData.fullName, formData.email, formData.password);
        // After successful signup, switch to login mode
        setIsSignUp(false);
        setError('');
        setFormData({ fullName: '', email: '', password: '' });
        alert('Account created successfully! Please login.');
      } else {
        // Login
        if (!formData.email || !formData.password) {
          setError('Please fill in all fields');
          setIsLoading(false);
          return;
        }
        await login(formData.email, formData.password);
        // Redirect to dashboard on successful login
        router.push('/dashboard');
      }
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'An error occurred. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = () => {
    const redirectUri = typeof window !== 'undefined' ? `${window.location.origin}` : '';
    const googleAuthUrl = getGoogleAuthUrl(redirectUri);
    window.location.href = googleAuthUrl;
  };

  const toggleMode = () => {
    setIsTransitioning(true);
    // Smooth page transition - change content after a brief delay
    setTimeout(() => {
      setIsSignUp(!isSignUp);
      // Complete transition after animation
      setTimeout(() => {
        setIsTransitioning(false);
      }, 600);
    }, 50);
  };

  return (
    <>
      <Head>
        <title>{isSignUp ? 'Sign Up' : 'Login'} | Epiplex Document Processing</title>
        <meta name="description" content={isSignUp ? 'Create a new account' : 'Login to your account'} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className={styles.authContainer}>
        <div className={`${styles.authCard} ${isSignUp ? styles.signUpMode : ''} ${isTransitioning ? styles.transitioning : ''}`}>
          {isTransitioning && <div className={styles.transitionOverlay}></div>}
          {/* Left Section */}
          <div className={`${styles.section} ${styles.leftSection} ${isSignUp ? styles.blackSection : styles.whiteSection}`}>
            {isSignUp ? (
              <div className={styles.welcomeContent}>
                <h2 className={styles.welcomeTitle}>WELCOME BACK!</h2>
                <p className={styles.welcomeText}>
                  Lorem ipsum dolor sit amet consectetur adipisicing elit. Deleniti rem?
                </p>
              </div>
            ) : (
              <div className={styles.formContent}>
                <h1 className={styles.formTitle}>Login</h1>
                <div className={styles.titleUnderline}></div>
                
                <form onSubmit={handleSubmit} className={styles.form}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="login-email" className={styles.label}>Email</label>
                    <div className={styles.inputWrapper}>
                      <input
                        type="email"
                        id="login-email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={styles.input}
                        placeholder="Enter your email"
                        required
                      />
                      <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                    </div>
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="login-password" className={styles.label}>Password</label>
                    <div className={styles.inputWrapper}>
                      <input
                        type="password"
                        id="login-password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className={styles.input}
                        placeholder="Enter your password"
                        required
                      />
                      <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                  </div>

                  {error && !isSignUp && (
                    <div className={styles.errorMessage} style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>
                      {error}
                    </div>
                  )}

                  <button type="submit" className={styles.submitButton} disabled={isLoading}>
                    {isLoading ? 'Loading...' : 'Login'}
                  </button>

                  <button type="button" className={styles.googleButton} onClick={handleGoogleAuth} disabled={isLoading}>
                    <svg className={styles.googleIcon} width="20" height="20" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </button>

                  <div className={styles.switchLink}>
                    Don&apos;t have an account?{' '}
                    <button type="button" onClick={toggleMode} className={styles.linkButton}>
                      Sign up
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>

          {/* Right Section */}
          <div className={`${styles.section} ${styles.rightSection} ${isSignUp ? styles.whiteSection : styles.blackSection}`}>
            {isSignUp ? (
              <div className={styles.formContent}>
                <h1 className={styles.formTitle}>Sign Up</h1>
                <div className={styles.titleUnderline}></div>
                
                <form onSubmit={handleSubmit} className={styles.form}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="signup-fullName" className={styles.label}>Full Name</label>
                    <div className={styles.inputWrapper}>
                      <input
                        type="text"
                        id="signup-fullName"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        className={styles.input}
                        placeholder="Enter your full name"
                        required
                      />
                      <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                    </div>
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="signup-email" className={styles.label}>Email</label>
                    <div className={styles.inputWrapper}>
                      <input
                        type="email"
                        id="signup-email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={styles.input}
                        placeholder="Enter your email"
                        required
                      />
                      <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                      </svg>
                    </div>
                  </div>

                  <div className={styles.inputGroup}>
                    <label htmlFor="signup-password" className={styles.label}>Password</label>
                    <div className={styles.inputWrapper}>
                      <input
                        type="password"
                        id="signup-password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className={styles.input}
                        placeholder="Enter your password"
                        required
                      />
                      <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                  </div>

                  {error && isSignUp && (
                    <div className={styles.errorMessage} style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.875rem' }}>
                      {error}
                    </div>
                  )}

                  <button type="submit" className={styles.submitButton} disabled={isLoading}>
                    {isLoading ? 'Creating Account...' : 'Sign Up'}
                  </button>

                  <button type="button" className={styles.googleButton} onClick={handleGoogleAuth} disabled={isLoading}>
                    <svg className={styles.googleIcon} width="20" height="20" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </button>

                  <div className={styles.switchLink}>
                    Already have an account?{' '}
                    <button type="button" onClick={toggleMode} className={styles.linkButton}>
                      Login
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className={styles.welcomeContent}>
                <h2 className={styles.welcomeTitle}>WELCOME BACK!</h2>
                <p className={styles.welcomeText}>
                  Lorem ipsum dolor sit amet consectetur adipisicing elit. Deleniti rem?
                </p>
              </div>
            )}
          </div>

          {/* Diagonal Divider */}
          <div className={`${styles.diagonalDivider} ${isSignUp ? styles.dividerRight : styles.dividerLeft}`}></div>
        </div>
      </div>
    </>
  );
}

