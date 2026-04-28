'use client';

import { ThemeProvider } from '@/context/ThemeContext';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/common/Navbar';
import Footer from '@/components/common/Footer';
import HistoryRibbon from '@/components/common/HistoryRibbon/HistoryRibbon';
import AdRibbon from '@/components/common/AdRibbon/AdRibbon';

export default function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Navbar />
        <HistoryRibbon />
        <AdRibbon />
        <main style={{ paddingTop: '64px', minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1 }}>
          <div style={{ flex: 1 }}>
            {children}
          </div>
          <Footer />
        </main>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              borderRadius: '10px',
              background: '#333',
              color: '#fff',
              fontSize: '0.9rem',
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
