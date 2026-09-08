export default function AsthmaProjectInfo() {
  return (
    <div className="project-info-card" style={{
      background: 'rgba(5, 12, 25, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      padding: '3rem',
      borderRadius: '24px',
      border: '1px solid rgba(255, 51, 102, 0.2)',
      boxShadow: '0 30px 60px rgba(0,0,0,0.6), inset 0 0 20px rgba(255, 51, 102, 0.05)',
      textAlign: 'left',
      color: 'var(--text-main)',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem'
    }}>
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '2rem' }}>
        <h1 style={{ 
          color: 'var(--accent-alert)', 
          fontSize: '2.8rem', 
          marginBottom: '0.8rem', 
          textTransform: 'uppercase', 
          letterSpacing: '2px', 
          textShadow: '0 0 20px rgba(255, 51, 102, 0.4)',
          lineHeight: '1.2'
        }}>
          CAREBREATH AI
        </h1>
        <h3 style={{ 
          color: '#f59e0b', 
          fontSize: '1.3rem', 
          fontWeight: 'normal', 
          letterSpacing: '1px',
          opacity: 0.9
        }}>
          AI-Powered Asthma Risk Prediction • Breathe Safer. Live Better.
        </h3>
        
        <p style={{ lineHeight: '1.8', marginTop: '1.5rem', fontSize: '1.1rem', color: 'rgba(255,255,255,0.85)' }}>
          <strong>CAREBREATH AI</strong> is an intelligent system aimed at early prediction of asthma attack risks by combining <strong>environmental</strong> and <strong>physiological</strong> data, utilizing Edge AI to estimate Peak Expiratory Flow (PEF) and analyze its trend over time.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 51, 102, 0.15)', transition: 'transform 0.3s ease' }} className="hover-lift">
          <h4 style={{ color: 'var(--accent-alert)', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>🌍</span> SENSE: Environment & Physiology
          </h4>
          <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.2rem', lineHeight: '1.8', margin: 0, fontSize: '0.95rem' }}>
            <li><strong>PMS7003:</strong> PM1.0, PM2.5, PM10</li>
            <li><strong>ENS160:</strong> TVOC, eCO₂</li>
            <li><strong>AHT20:</strong> Temperature, Humidity</li>
            <li><strong>MAX30102:</strong> HR, SpO₂, PPG for Physiological status</li>
          </ul>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 51, 102, 0.15)', transition: 'transform 0.3s ease' }} className="hover-lift">
          <h4 style={{ color: 'var(--accent-alert)', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>🤖</span> UNDERSTAND: AI PEF Estimation
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.7', margin: 0 }}>
            CAREBREATH uses <strong>Edge AI (EFR32MG26)</strong> to estimate the Peak Expiratory Flow (PEF) from fused sensor data, looking for physiological changes combined with environmental exposure.
          </p>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 51, 102, 0.15)', transition: 'transform 0.3s ease' }} className="hover-lift">
          <h4 style={{ color: 'var(--accent-alert)', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>📉</span> PREDICT: Trend Analysis
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.7', margin: 0 }}>
            Instead of just looking at a single number, the AI monitors the <strong>decline trend of PEF</strong> over time, creating a Personalized Baseline to detect abnormalities specific to the user.
          </p>
        </div>
        
        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(255, 51, 102, 0.15)', transition: 'transform 0.3s ease' }} className="hover-lift">
          <h4 style={{ color: 'var(--accent-alert)', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span> EARLY WARNING
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.7', margin: 0 }}>
            Detect ➔ Predict ➔ Warn. Alerts are categorized into <strong>Low (Green), Moderate (Yellow), and High Risk (Red)</strong> to prompt immediate preventive actions before a severe attack occurs.
          </p>
        </div>
      </div>

      <div style={{ 
        background: 'linear-gradient(90deg, rgba(255, 51, 102, 0.15) 0%, rgba(255, 51, 102, 0.05) 100%)', 
        padding: '1.5rem 2rem', 
        borderRadius: '16px', 
        borderLeft: '4px solid #ff3366',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem'
      }}>
        <h4 style={{ color: '#ff3366', margin: 0, fontSize: '1.1rem', letterSpacing: '1px' }}>⚙️ SYSTEM DATA FLOW</h4>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.05rem', lineHeight: '1.6', fontFamily: 'monospace', margin: 0, overflowWrap: 'break-word' }}>
          Environment + Physiology ➔ Sensor Fusion ➔ Edge AI (EFR32) ➔ Estimated PEF ➔ Trend Analysis ➔ Risk Score ➔ Early Warning
        </p>
      </div>

      <blockquote style={{ 
        borderLeft: '4px solid #f59e0b', 
        margin: 0, 
        padding: '1.8rem', 
        background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0) 100%)', 
        fontStyle: 'italic', 
        color: 'rgba(255,255,255,0.9)', 
        borderRadius: '0 16px 16px 0',
        fontSize: '1.1rem',
        lineHeight: '1.6'
      }}>
        "CAREBREATH AI shifts the paradigm from simple MONITORING to UNDERSTANDING and PREDICTION. AI doesn't just look at one sensor — it finds the relationship between multiple signals to assess the real risk."
        <br/><br/>
        <strong style={{ color: '#f59e0b', fontStyle: 'normal', fontSize: '1.2rem', letterSpacing: '1px' }}>Smarter Data. Safer Breathing.</strong>
      </blockquote>
    </div>
  );
}
