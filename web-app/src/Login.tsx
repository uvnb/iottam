import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import ProjectInfo from './ProjectInfo';

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
      
      <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '4rem', width: '100%', maxWidth: '1400px', alignItems: 'flex-start' }}>
        
        {/* CỘT TRÁI: THÔNG TIN DỰ ÁN */}
        <div style={{ flex: '1 1 600px', minWidth: '300px' }}>
          <ProjectInfo />
        </div>

        {/* CỘT PHẢI: LOGIN FORM */}
        <div className="posture-card normal" style={{ flex: '1 1 400px', width: '100%', maxWidth: '500px', margin: '0 auto', padding: '3rem 2.5rem', background: 'rgba(3, 10, 22, 0.95)', border: '1px solid rgba(0, 210, 255, 0.3)', boxShadow: '0 0 30px rgba(0, 210, 255, 0.1)', borderRadius: '24px' }}>
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
