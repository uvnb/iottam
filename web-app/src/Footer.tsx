export default function Footer() {
  return (
    <footer style={{
      width: '100%',
      padding: '2rem 1rem',
      background: 'rgba(0, 0, 0, 0.4)',
      borderTop: '1px solid rgba(255, 255, 255, 0.05)',
      backdropFilter: 'blur(10px)',
      marginTop: 'auto',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1.5rem',
      color: 'var(--text-muted)',
      zIndex: 1000,
      position: 'relative'
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', justifyContent: 'center' }}>
        <a href="https://www.facebook.com/share/1K1sAZTm9m/" target="_blank" rel="noreferrer" className="footer-link">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M22.675 0H1.325C.593 0 0 .593 0 1.325v21.351C0 23.407.593 24 1.325 24H12.82v-9.294H9.692v-3.622h3.128V8.413c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12V24h6.116c.73 0 1.323-.593 1.323-1.325V1.325C24 .593 23.407 0 22.675 0z"/></svg>
          Facebook
        </a>
        <a href="https://www.tiktok.com/@_dmt_1611?_r=1&_t=ZS-99ml5usW2j6" target="_blank" rel="noreferrer" className="footer-link">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.12-3.44-3.17-3.8-5.46-.4-2.51.27-5.12 1.92-7.05 1.54-1.8 3.91-2.85 6.27-2.73.01 1.39.01 2.78.02 4.17-1.12-.13-2.31.06-3.17.84-1.07.97-1.41 2.58-.94 3.96.48 1.45 2.01 2.45 3.56 2.41 1.76-.05 3.23-1.48 3.23-3.26.02-4.1.02-8.21.02-12.31.01-.19-.01-.39-.02-.58z"/></svg>
          TikTok
        </a>
        <a href="mailto:Tam.DM2414361@sis.hust.edu.vn" className="footer-link">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
          Tam.DM2414361@sis.hust.edu.vn
        </a>
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.9rem', lineHeight: '1.6' }}>
        <p style={{ margin: '0 0 0.5rem 0', color: 'var(--accent-normal)' }}><strong>CareBot AIoT</strong> — Developed by DMT Technology</p>
        <p style={{ margin: '0' }}>© {new Date().getFullYear()} All rights reserved. Enhancing Biomechanical & Respiratory Health.</p>
      </div>
    </footer>
  );
}
