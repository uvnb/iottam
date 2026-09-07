import { useNavigate } from 'react-router-dom';
import ProjectInfo from './ProjectInfo';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="app-container" style={{ justifyContent: 'center', minHeight: '100vh', padding: '2rem 1rem' }}>
      
      <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '2rem', alignItems: 'center' }}>
        
        <ProjectInfo />

        <button 
          onClick={() => navigate('/login')}
          className="audio-btn" 
          style={{ 
            padding: '1.2rem 3rem', 
            fontSize: '1.2rem', 
            borderRadius: '50px',
            boxShadow: '0 0 20px rgba(0, 210, 255, 0.4)',
            marginTop: '1rem',
            background: 'rgba(0, 210, 255, 0.15)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(0, 210, 255, 0.5)'
          }}
        >
          ACCESS SYSTEM
        </button>
        
      </div>
    </div>
  );
}
