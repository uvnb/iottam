import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/');
    });
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/');
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Đăng ký thành công! Vui lòng kiểm tra email để xác nhận (nếu có yêu cầu) hoặc Đăng nhập lại.');
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container" style={{ justifyContent: 'center', minHeight: '100vh', padding: '2rem' }}>
      
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '4rem', width: '100%', maxWidth: '1200px', alignItems: 'center' }}>
        
        {/* CỘT TRÁI: THÔNG TIN DỰ ÁN */}
        <div className="project-info" style={{ flex: '1 1 500px', textAlign: 'left', color: 'var(--text-main)' }}>
          <h1 style={{ color: 'var(--accent-normal)', fontSize: '3rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '2px', textShadow: '0 0 20px rgba(0, 210, 255, 0.5)' }}>DMT Smart Posture Shirt</h1>
          <h3 style={{ color: 'var(--accent-alert)', marginBottom: '2rem', fontSize: '1.4rem', fontWeight: 'normal', letterSpacing: '1px' }}>AIoT Wearable System for Real-Time Posture Detection</h3>
          
          <p style={{ lineHeight: '1.6', marginBottom: '2rem', fontSize: '1.1rem', color: 'var(--text-muted)' }}>
            The <strong>DMT Smart Posture Shirt</strong> is an intelligent wearable system developed as part of the <strong>CareBot AIoT project</strong>. The shirt uses <strong>5 MPU6050 motion sensors</strong> positioned across key areas of the upper body and spine to continuously capture body movement and posture data.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(0, 210, 255, 0.2)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
              <h4 style={{ color: 'var(--accent-normal)', marginBottom: '1rem', fontSize: '1.1rem' }}>📡 5 Sensor Positions</h4>
              <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.2rem', lineHeight: '1.8', margin: 0 }}>
                <li><strong>C7</strong> - Neck</li>
                <li><strong>Left/Right</strong> Shoulder</li>
                <li><strong>T5</strong> - Mid Back</li>
                <li><strong>L3</strong> - Lower Back</li>
              </ul>
            </div>

            <div style={{ background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(0, 210, 255, 0.2)', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
              <h4 style={{ color: 'var(--accent-normal)', marginBottom: '1rem', fontSize: '1.1rem' }}>🧠 AI Posture Recognition</h4>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.6', margin: 0 }}>
                <strong>18 input features</strong> via UART to the embedded AI platform.<br/><br/>
                Detects <strong>6 classes</strong>: Normal Idle, Bending, Lifting (Correct/Wrong), Bad Posture, Shoulder Asymmetry.
              </p>
            </div>
          </div>

          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)', marginBottom: '2rem' }}>
            <h4 style={{ color: '#10b981', marginBottom: '0.8rem', fontSize: '1.1rem' }}>⚙️ Embedded AIoT Architecture</h4>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1rem', lineHeight: '1.6', fontFamily: 'monospace', margin: 0 }}>
              5 Sensors → TCA9548 → ESP32 → UART → Embedded AI → BLE → Raspberry Pi 4 / CareBot System
            </p>
          </div>

          <blockquote style={{ borderLeft: '4px solid var(--accent-alert)', margin: 0, padding: '1.5rem', background: 'rgba(255, 51, 102, 0.05)', fontStyle: 'italic', color: 'var(--text-muted)', borderRadius: '0 12px 12px 0' }}>
            "DMT Smart Posture Shirt transforms body movement data into real-time AI insights, enabling intelligent posture monitoring as part of the CareBot AIoT ecosystem."<br/><br/>
            <strong style={{ color: 'var(--accent-alert)', fontStyle: 'normal', fontSize: '1.1rem' }}>DMT Technology — Smarter Health, Better Life.</strong>
          </blockquote>
        </div>

        {/* CỘT PHẢI: LOGIN FORM */}
        <div className="posture-card normal" style={{ flex: '1 1 350px', width: '100%', maxWidth: '450px', margin: '0 auto', padding: '3rem 2rem', background: 'rgba(3, 10, 22, 0.9)' }}>
          <h2 className="posture-name" style={{ marginBottom: '1rem', fontSize: '1.8rem' }}>SYSTEM PORTAL</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Please authenticate to access the dashboard.</p>
          
          {error && (
            <div style={{ color: 'var(--accent-alert)', marginBottom: '1.5rem', padding: '12px', border: '1px solid var(--accent-alert)', borderRadius: '8px', background: 'rgba(255,51,102,0.1)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>EMAIL ADDRESS</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%', padding: '14px', borderRadius: '8px', 
                  background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,210,255,0.3)',
                  color: 'var(--text-main)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.3s ease'
                }}
              />
            </div>
            <div>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>PASSWORD</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  width: '100%', padding: '14px', borderRadius: '8px', 
                  background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(0,210,255,0.3)',
                  color: 'var(--text-main)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.3s ease'
                }}
              />
            </div>
            
            <button type="submit" className="audio-btn" disabled={loading} style={{ width: '100%', marginTop: '1rem', position: 'static', padding: '16px', fontSize: '1.1rem' }}>
              {loading ? 'PROCESSING...' : (isLogin ? 'SECURE LOGIN' : 'CREATE ACCOUNT')}
            </button>
          </form>

          <p style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isLogin ? "No account yet?" : "Already registered?"}{' '}
            <span 
              onClick={() => setIsLogin(!isLogin)} 
              style={{ color: 'var(--accent-normal)', cursor: 'pointer', textDecoration: 'underline', fontWeight: 'bold' }}
            >
              {isLogin ? 'Register' : 'Login'}
            </span>
          </p>
        </div>

      </div>
    </div>
  );
}
