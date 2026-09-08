import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';
import DashboardWrapper from './Dashboard';
import Login from './Login';
import './index.css';

import Landing from './Landing';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', color: 'var(--accent-normal)' }}>
        <h2>LOADING SECURE SYSTEM...</h2>
      </div>
    );
  }

  return (
    <>
      <video autoPlay loop muted playsInline id="bg-video">
        <source src="/background.mp4" type="video/mp4" />
      </video>
      <video autoPlay loop muted playsInline id="bg-video-asthma">
        <source src="/video-asthma.mp4" type="video/mp4" />
      </video>
      <div id="overlay"></div>

      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '3rem',
        padding: '0.8rem 2rem',
        background: 'rgba(3, 10, 22, 0.4)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid rgba(0, 210, 255, 0.2)',
        position: 'relative',
        zIndex: 1000,
        flexWrap: 'wrap'
      }}>
        <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', marginRight: '1rem', fontSize: '1.1rem' }}>PARTNERS & SPONSORS:</span>
        <img src="/bk.jpeg" alt="Bach Khoa" style={{ height: '65px', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))', transition: 'all 0.3s' }} className="sponsor-logo" />
        <img src="/fpt.png" alt="FPT" style={{ height: '65px', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))', transition: 'all 0.3s' }} className="sponsor-logo" />
        <img src="/silicon.png" alt="Silicon Labs" style={{ height: '65px', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))', transition: 'all 0.3s' }} className="sponsor-logo" />
        <img src="/dmt.jpeg" alt="DMT Team" style={{ height: '65px', objectFit: 'contain', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.2))', transition: 'all 0.3s' }} className="sponsor-logo" />
      </div>

      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/dashboard" />} />
          <Route path="/dashboard" element={session ? <DashboardWrapper session={session} /> : <Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </>
  );
}
