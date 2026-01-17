import { useEffect } from 'react';
import { useRouter } from 'next/router';
import SEO from '../components/SEO';
import { isAuthenticated } from '../lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    if (router.isReady) {
      // Check if user is authenticated
      if (isAuthenticated()) {
        router.push('/dashboard');
      } else {
        router.push('/auth');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Epiplex Document Processing',
    description: 'AI-powered video to document conversion platform',
    url: process.env.NEXT_PUBLIC_BASE_URL || 'https://epiplex.com',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD'
    }
  };

  return (
    <>
      <SEO
        title="Home"
        description="Epiplex Document Processing - Transform videos into comprehensive documents with AI-powered transcription, keyframe extraction, and intelligent summarization."
        keywords="video processing, document conversion, AI transcription, video to document, keyframe extraction, video summarization"
        structuredData={structuredData}
      />
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Redirecting...</p>
      </div>
    </>
  );
}
