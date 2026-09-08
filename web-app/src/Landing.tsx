import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectInfo from './ProjectInfo';
import AsthmaProjectInfo from './AsthmaProjectInfo';

export default function Landing() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'posture' | 'asthma'>('posture');

  useEffect(() => {
    if (activeTab === 'asthma') {
      document.body.classList.add('asthma-bg');
    } else {
      document.body.classList.remove('asthma-bg');
    }
  }, [activeTab]);

  return (
    <div className="app-container" style={{ justifyContent: 'center', minHeight: '100vh', padding: '2rem 1rem' }}>
      
      <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center' }}>
        
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', background: 'rgba(0,0,0,0.5)', padding: '0.5rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
          <button 
            onClick={() => setActiveTab('posture')}
            style={{
              background: activeTab === 'posture' ? 'rgba(0, 210, 255, 0.2)' : 'transparent',
              border: activeTab === 'posture' ? '1px solid var(--accent-normal)' : '1px solid transparent',
              color: activeTab === 'posture' ? 'var(--accent-normal)' : 'var(--text-muted)',
              padding: '0.8rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s', fontSize: '1.1rem'
            }}
          >
            POSTURE AI
          </button>
          <button 
            onClick={() => setActiveTab('asthma')}
            style={{
              background: activeTab === 'asthma' ? 'rgba(255, 51, 102, 0.2)' : 'transparent',
              border: activeTab === 'asthma' ? '1px solid var(--accent-alert)' : '1px solid transparent',
              color: activeTab === 'asthma' ? 'var(--accent-alert)' : 'var(--text-muted)',
              padding: '0.8rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s', fontSize: '1.1rem'
            }}
          >
            ASTHMA AI
          </button>
        </div>

        {activeTab === 'posture' ? <ProjectInfo /> : <AsthmaProjectInfo />}

        <button 
          onClick={() => navigate('/login')}
          className="audio-btn" 
          style={{ 
            padding: '1.2rem 3rem', 
            fontSize: '1.2rem', 
            borderRadius: '50px',
            boxShadow: activeTab === 'posture' ? '0 0 20px rgba(0, 210, 255, 0.4)' : '0 0 20px rgba(255, 51, 102, 0.4)',
            marginTop: '1rem',
            background: activeTab === 'posture' ? 'rgba(0, 210, 255, 0.15)' : 'rgba(255, 51, 102, 0.15)',
            backdropFilter: 'blur(10px)',
            border: `2px solid ${activeTab === 'posture' ? 'rgba(0, 210, 255, 0.5)' : 'rgba(255, 51, 102, 0.5)'}`,
            color: activeTab === 'posture' ? 'var(--accent-normal)' : 'var(--accent-alert)'
          }}
        >
          ACCESS {activeTab === 'posture' ? 'POSTURE' : 'ASTHMA'} SYSTEM
        </button>
        
      </div>
    </div>
  );
}
