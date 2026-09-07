import { POSTURE_DATA } from './constants';

interface PostureDashboardProps {
  currentPosture: string;
  confidence: number;
  statusClass: string;
}

export default function PostureDashboard({ currentPosture, confidence, statusClass }: PostureDashboardProps) {
  const isNormal = currentPosture === 'normal_idle';
  const postureInfo = POSTURE_DATA[currentPosture] || POSTURE_DATA['normal_idle'];

  return (
    <div className="main-content" style={{ opacity: 1, filter: 'none', transition: 'all 0.5s' }}>
      <div className={`model-container ${statusClass}`}>
        <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <img src="/back_muscles.png" alt="Back Muscles" className="body-model" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '12px' }} />
          <div className="sensor-point c7"><div className="pulse"></div><span className="label">C7</span></div>
          <div className="sensor-point t5"><div className="pulse"></div><span className="label">T5</span></div>
          <div className="sensor-point l3"><div className="pulse"></div><span className="label">L3</span></div>
          <div className="sensor-point ls"><div className="pulse"></div><span className="label">LS</span></div>
          <div className="sensor-point rs"><div className="pulse"></div><span className="label">RS</span></div>
        </div>
      </div>

      <div className={`posture-card ${statusClass}`}>
        <div className="status-icon">
          {isNormal ? '✓' : '⚠️'}
        </div>
        <h2 className="posture-name" style={{ fontSize: '2rem', textTransform: 'uppercase' }}>
          <span>{postureInfo.subtitle}</span>
        </h2>
        <div className="confidence" style={{ marginBottom: '1.5rem' }}>
          <span>Confidence: {(confidence * 100).toFixed(1)}%</span>
        </div>
        
        <div className="posture-details" style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px' }}>
          
          <div style={{ marginBottom: '1.5rem', color: postureInfo.safe ? '#10b981' : '#f43f5e', fontSize: '1.05rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
            <span>{postureInfo.alert}</span>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <strong style={{ color: 'var(--text-muted)' }}><span>Affected regions:</span></strong> 
            <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.9rem' }}>{postureInfo.affected}</span>
          </div>
          <div>
            <strong style={{ color: 'var(--text-muted)' }}><span>Recommendation:</span></strong> 
            <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>{postureInfo.reminder}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
