export default function Demos({ activeTab, onClose }: { activeTab: 'posture' | 'asthma', onClose: () => void }) {
  const isPosture = activeTab === 'posture';
  
  const postureVideos = [
    { src: '/posture-demo-1.mp4', title: 'Demo 1: Posture Tracking' },
    { src: '/posture-demo-2.mp4', title: 'Demo 2: Real-time Analysis' },
    { src: '/posture-demo-3.mp4', title: 'Demo 3: Error Detection' }
  ];
  
  const asthmaVideos = [
    { src: '/asthma-demo-1.mp4', title: 'Demo 1: Asthma Monitor' },
    { src: '/asthma-demo-2.mp4', title: 'Demo 2: Real-time PEF Analysis' }
  ];
  
  const videos = isPosture ? postureVideos : asthmaVideos;
  
  return (
    <div className="app-container" style={{ minHeight: '80vh', maxWidth: '1200px', width: '100%', padding: '2rem' }}>
      <div className={`posture-card ${isPosture ? 'normal' : 'alert'}`} style={{ width: '100%', maxWidth: 'none', padding: '2rem', borderColor: isPosture ? 'rgba(0, 210, 255, 0.5)' : 'rgba(255, 51, 102, 0.5)', boxShadow: isPosture ? '0 0 40px rgba(0, 210, 255, 0.15)' : '0 0 40px rgba(255, 51, 102, 0.15)' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="posture-name" style={{ fontSize: '1.8rem', textAlign: 'left', margin: 0, color: isPosture ? 'var(--accent-normal)' : 'var(--accent-alert)' }}>
              {isPosture ? 'POSTURE AI DEMOS' : 'ASTHMA AI DEMOS'}
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', textAlign: 'left' }}>
              Real-world testing scenarios and system capabilities.
            </p>
          </div>
          <button onClick={onClose} className="audio-btn" style={{ position: 'static', background: 'rgba(255,255,255,0.1)', padding: '12px 24px', fontSize: '1rem' }}>
            ⬅ BACK
          </button>
        </div>

        {videos.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Coming Soon</h3>
            <p>Demo videos for this module are currently being prepared.</p>
          </div>
        ) : (
          <div className="demo-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '2rem',
            width: '100%'
          }}>
            {videos.map((vid, i) => (
              <div key={i} style={{ 
                background: 'rgba(0,0,0,0.4)', 
                borderRadius: '16px', 
                overflow: 'hidden',
                border: `1px solid ${isPosture ? 'rgba(0,210,255,0.2)' : 'rgba(255,51,102,0.2)'}`,
                boxShadow: '0 4px 15px rgba(0,0,0,0.3)'
              }}>
                <video 
                  src={vid.src} 
                  controls
                  preload="metadata"
                  style={{ width: '100%', aspectRatio: isPosture ? '16/9' : 'auto', maxHeight: isPosture ? 'auto' : '65vh', objectFit: 'contain', display: 'block', background: '#000' }} 
                />
                <div style={{ padding: '1.2rem', textAlign: 'center', background: 'rgba(255,255,255,0.03)' }}>
                  <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem', letterSpacing: '0.5px' }}>{vid.title}</h4>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
