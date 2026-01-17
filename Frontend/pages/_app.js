import '../styles/globals.css'
import ErrorBoundary from '../components/ErrorBoundary'
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { logPageView } from '../lib/activityLogger'
import { isAuthenticated, requiresAuth } from '../lib/auth'
import { LoadingProvider } from '../lib/loadingState'
import prefetchService from '../lib/prefetchService'

export default function App({ Component, pageProps }) {
  const router = useRouter()
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    // Mark component as mounted (client-side only)
    setIsMounted(true)
  }, [])

  useEffect(() => {
    // Only run authentication checks on client-side after mount
    if (!isMounted || typeof window === 'undefined' || !router.isReady) return;

    const pathname = router.pathname;
    
    // Check if route requires authentication
    if (requiresAuth(pathname)) {
      // If not authenticated, redirect to auth page
      if (!isAuthenticated()) {
        router.replace('/auth');
        return;
      }
      
      // If authenticated and on a main page, ensure data is prefetched
      // This handles cases where user navigates directly or refreshes
      if (['/dashboard', '/process-data', '/document'].includes(pathname)) {
        // Pre-fetch in background (won't block if already cached)
        prefetchService.prefetchAllData().catch(err => {
          console.error('Background prefetch failed:', err);
        });
      }
    } else if (pathname === '/auth' && isAuthenticated()) {
      // If on auth page but already authenticated, redirect to dashboard
      router.replace('/dashboard');
      return;
    }

    // Log initial page view
    const logCurrentPage = () => {
      if (router.isReady) {
        const pageName = router.pathname === '/' ? 'Home' : router.pathname.replace('/', '').replace('-', ' ') || 'Unknown'
        logPageView(pageName, {
          path: router.asPath,
          query: router.query
        })
      }
    }

    // Log on mount (only when router is ready)
    if (router.isReady) {
      logCurrentPage()
    }

    // Log on route change
    const handleRouteChange = (url) => {
      // Check auth on route change
      const pathname = url.split('?')[0];
      if (requiresAuth(pathname) && !isAuthenticated()) {
        router.replace('/auth');
        return;
      }

      const pageName = pathname === '/' ? 'Home' : pathname.replace('/', '').replace(/-/g, ' ') || 'Unknown'
      logPageView(pageName, {
        path: url,
        previousPath: router.asPath
      })
    }

    // Only attach event listeners when router is ready
    if (router.isReady && router.events) {
      router.events.on('routeChangeComplete', handleRouteChange)
    }

    return () => {
      if (router.events) {
        router.events.off('routeChangeComplete', handleRouteChange)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, router.isReady, router.pathname, router.asPath])

  return (
    <>
      <Head>
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </Head>
      <ErrorBoundary>
        <LoadingProvider>
          <Component {...pageProps} />
        </LoadingProvider>
      </ErrorBoundary>
    </>
  )
}

