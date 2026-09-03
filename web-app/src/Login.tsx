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
    <div className="app-container" style={{ justifyContent: 'center', minHeight: '80vh' }}>
      <div className="posture-card normal" style={{ width: '100%', maxWidth: '400px', margin: '0 auto', flex: 'none', padding: '3rem 2rem' }}>
        <h2 className="posture-name" style={{ marginBottom: '2rem', fontSize: '1.8rem' }}>CAREPOSTURE AI</h2>
        
        {error && (
          <div style={{ color: 'var(--accent-alert)', marginBottom: '1rem', padding: '10px', border: '1px solid var(--accent-alert)', borderRadius: '8px', background: 'rgba(255,51,102,0.1)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', textAlign: 'left' }}>
          <div>
            <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem', display: 'block' }}>EMAIL</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', 
                background: 'rgba(3,10,22,0.8)', border: '1px solid rgba(0,210,255,0.3)',
                color: 'var(--text-main)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box'
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
                width: '100%', padding: '12px', borderRadius: '8px', 
                background: 'rgba(3,10,22,0.8)', border: '1px solid rgba(0,210,255,0.3)',
                color: 'var(--text-main)', fontSize: '1rem', outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          
          <button type="submit" className="audio-btn" disabled={loading} style={{ width: '100%', marginTop: '1rem', position: 'static' }}>
            {loading ? 'PROCESSING...' : (isLogin ? 'SYSTEM LOGIN' : 'CREATE ACCOUNT')}
          </button>
        </form>

        <p style={{ marginTop: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          {isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"}{' '}
          <span 
            onClick={() => setIsLogin(!isLogin)} 
            style={{ color: 'var(--accent-normal)', cursor: 'pointer', textDecoration: 'underline' }}
          >
            {isLogin ? 'Đăng ký ngay' : 'Đăng nhập'}
          </span>
        </p>
      </div>
    </div>
  );
}
