import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { setAuthData } from '../../../lib/auth';
import prefetchService from '../../lib/prefetchService';

export default function GoogleCallback() {
  const router = useRouter();
  const [status, setStatus] = useState('processing');
  const [error, setError] = useState(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get code or tokens from URL query parameters
        const { code, token, session, error: urlError } = router.query;

        // Check for errors
        if (urlError) {
          setError(urlError);
          setStatus('error');
          // Redirect to auth page with error after 3 seconds
          setTimeout(() => {
            router.push(`/auth?error=oauth_failed&message=${encodeURIComponent(urlError)}`);
          }, 3000);
          return;
        }

        // If we have a code, exchange it for tokens via backend
        if (code) {
          try {
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9001';
            const response = await fetch(`${API_BASE_URL}/api/auth/google/token?code=${encodeURIComponent(code)}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              }
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({ detail: 'Failed to authenticate with Google' }));
              throw new Error(errorData.detail || 'Failed to authenticate with Google');
            }

            const data = await response.json();
            
            // Store tokens in localStorage
            if (typeof window !== 'undefined') {
              localStorage.setItem('access_token', data.access_token);
              localStorage.setItem('session_token', data.session_token);
              localStorage.setItem('user', JSON.stringify(data.user));
            }

            setStatus('success');
            
            // Start pre-fetching in background immediately after login
            // This runs while redirecting to dashboard
            prefetchService.prefetchAllData().catch(err => {
              console.error('Background prefetch failed:', err);
              // Don't block login if prefetch fails
            });
            
            // Redirect to dashboard after a brief delay
            setTimeout(() => {
              router.push('/dashboard');
            }, 1000);
            return;
          } catch (err) {
            console.error('Token exchange error:', err);
            setError(err.message || 'Failed to exchange authorization code');
            setStatus('error');
            setTimeout(() => {
              router.push('/auth?error=oauth_failed&message=Authentication failed');
            }, 3000);
            return;
          }
        }

        // If we have tokens directly (from backend redirect), use them
        if (token && session) {
          // Store tokens in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('access_token', token);
            localStorage.setItem('session_token', session);
            
            // Fetch user info to store in localStorage
            try {
              const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9001';
              const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });

              if (response.ok) {
                const userData = await response.json();
                localStorage.setItem('user', JSON.stringify(userData));
              }
            } catch (err) {
              console.error('Failed to fetch user info:', err);
              // Continue anyway - user can still login
            }

            setStatus('success');
            
            // Start pre-fetching in background immediately after login
            // This runs while redirecting to dashboard
            prefetchService.prefetchAllData().catch(err => {
              console.error('Background prefetch failed:', err);
              // Don't block login if prefetch fails
            });
            
            // Redirect to dashboard after a brief delay
            setTimeout(() => {
              router.push('/dashboard');
            }, 1000);
            return;
          }
        }

        // No code or tokens - error
        setError('Authorization code or tokens not received');
        setStatus('error');
        setTimeout(() => {
          router.push('/auth?error=oauth_failed&message=Authorization code not received');
        }, 3000);
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError(err.message || 'An error occurred during authentication');
        setStatus('error');
        setTimeout(() => {
          router.push('/auth?error=oauth_failed&message=Authentication failed');
        }, 3000);
      }
    };

    // Only process when router is ready and query params are available
    if (router.isReady) {
      handleCallback();
    }
  }, [router.isReady, router.query]);

  return (
    <>
      <Head>
        <title>Google Authentication | Epiplex</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          textAlign: 'center',
          maxWidth: '400px',
          width: '90%'
        }}>
          {status === 'processing' && (
            <>
              <div style={{
                width: '50px',
                height: '50px',
                border: '4px solid #f3f3f3',
                borderTop: '4px solid #3498db',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 1rem'
              }}></div>
              <h2 style={{ margin: '0 0 0.5rem', color: '#333' }}>Authenticating...</h2>
              <p style={{ color: '#666', margin: 0 }}>Please wait while we complete your Google sign-in.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: '#4caf50',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h2 style={{ margin: '0 0 0.5rem', color: '#333' }}>Success!</h2>
              <p style={{ color: '#666', margin: 0 }}>Redirecting to dashboard...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                backgroundColor: '#f44336',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem'
              }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </div>
              <h2 style={{ margin: '0 0 0.5rem', color: '#333' }}>Authentication Failed</h2>
              <p style={{ color: '#666', margin: '0 0 1rem' }}>{error || 'An error occurred during authentication.'}</p>
              <p style={{ color: '#999', fontSize: '0.875rem', margin: 0 }}>Redirecting to login page...</p>
            </>
          )}

          <style jsx>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    </>
  );
}

