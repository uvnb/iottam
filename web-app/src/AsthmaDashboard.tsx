export interface AsthmaData {
  id: number;
  pm1: number;
  pm25: number;
  pm10: number;
  aqi: number;
  tvoc: number;
  eco2: number;
  temp: number;
  hum: number;
  finger: string;
  hr: number;
  spo2: number;
  rr: number;
  pef: number;
  rawLine: string;
}

interface AsthmaDashboardProps {
  data: AsthmaData | null;
  logs: string[];
}

export default function AsthmaDashboard({ data, logs }: AsthmaDashboardProps) {
  
  const getStatusColor = (val: number, thresholds: [number, number]) => {
    if (val <= thresholds[0]) return 'var(--accent-normal)'; // Safe
    if (val <= thresholds[1]) return '#f59e0b'; // Warning
    return 'var(--accent-alert)'; // Danger
  };

  const renderMetricCard = (label: string, value: string | number, unit: string, color: string) => (
    <div style={{
      background: 'rgba(3, 10, 22, 0.6)',
      border: `1px solid ${color === 'var(--accent-alert)' ? 'rgba(255, 51, 102, 0.5)' : 'rgba(0, 210, 255, 0.2)'}`,
      borderRadius: '12px',
      padding: '1.5rem 1rem',
      textAlign: 'center',
      boxShadow: color === 'var(--accent-alert)' ? '0 0 15px rgba(255,51,102,0.15)' : '0 0 10px rgba(0,0,0,0.5)'
    }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</div>
      <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: color }}>
        {value} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>{unit}</span>
      </div>
    </div>
  );

  const getPefStatus = (pef: number) => {
    if (pef === 0) return { color: 'var(--accent-normal)', text: 'CHỜ DỮ LIỆU (WAITING)', glow: 'rgba(0,210,255,0.5)', bg: 'rgba(0, 210, 255, 0.05)', border: 'rgba(0, 210, 255, 0.4)' };
    if (pef <= 300) return { color: 'var(--accent-alert)', text: 'NGUY CƠ CAO (HIGH RISK)', glow: 'rgba(255,51,102,0.6)', bg: 'rgba(255, 51, 102, 0.1)', border: 'rgba(255, 51, 102, 0.6)' };
    if (pef <= 400) return { color: '#f59e0b', text: 'CẢNH BÁO NHẸ (WARNING)', glow: 'rgba(245,158,11,0.5)', bg: 'rgba(245, 158, 11, 0.1)', border: 'rgba(245, 158, 11, 0.5)' };
    return { color: '#10b981', text: 'TỐT (GOOD)', glow: 'rgba(16,185,129,0.5)', bg: 'rgba(16, 185, 129, 0.1)', border: 'rgba(16, 185, 129, 0.5)' };
  };

  const pefValue = data ? data.pef : 0;
  const pefStatus = getPefStatus(pefValue);
  
  // Tính % vị trí của pointer (giả sử max PEF = 800)
  const maxPef = 800;
  let pointerPos = (pefValue / maxPef) * 100;
  if (pointerPos > 100) pointerPos = 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* PEF HERO CARD & RISK BAR */}
      <div style={{
        background: pefStatus.bg,
        border: `1px solid ${pefStatus.border}`,
        borderRadius: '24px',
        padding: '2rem',
        textAlign: 'center',
        boxShadow: `0 0 30px ${pefStatus.glow}`,
        backdropFilter: 'blur(10px)',
        transition: 'all 0.3s ease'
      }}>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--text-muted)', margin: '0 0 0.5rem 0', letterSpacing: '2px' }}>PEF AI PREDICTION</h2>
        <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: pefStatus.color, marginBottom: '1rem', letterSpacing: '1px', textShadow: `0 0 10px ${pefStatus.glow}` }}>
          {pefStatus.text}
        </div>
        <div style={{ fontSize: '4.5rem', fontWeight: '900', color: pefStatus.color, textShadow: `0 0 20px ${pefStatus.glow}`, lineHeight: '1', marginBottom: '2rem' }}>
          {pefValue.toFixed(1)} <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)', fontWeight: 'normal', textShadow: 'none' }}>L/min</span>
        </div>

        {/* Thanh cảnh báo (Risk Indicator Bar) */}
        <div style={{ width: '100%', maxWidth: '600px', margin: '0 auto', padding: '10px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#888', marginBottom: '8px', fontWeight: 'bold' }}>
            <span>0</span>
            <span style={{ color: 'var(--accent-alert)' }}>NGUY CƠ CAO</span>
            <span>300</span>
            <span style={{ color: '#f59e0b' }}>CẢNH BÁO</span>
            <span>400</span>
            <span style={{ color: '#10b981' }}>TỐT</span>
            <span>800+</span>
          </div>
          <div style={{
            position: 'relative',
            width: '100%',
            height: '16px',
            borderRadius: '8px',
            background: 'linear-gradient(90deg, rgba(255,51,102,1) 0%, rgba(255,51,102,1) 37.5%, rgba(245,158,11,1) 37.5%, rgba(245,158,11,1) 50%, rgba(16,185,129,1) 50%, rgba(16,185,129,1) 100%)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
          }}>
            {/* Marker / Pointer */}
            {pefValue > 0 && (
              <div style={{
                position: 'absolute',
                top: '-12px',
                left: `calc(${pointerPos}% - 10px)`,
                width: '0',
                height: '0',
                borderLeft: '10px solid transparent',
                borderRight: '10px solid transparent',
                borderTop: '12px solid white',
                transition: 'left 0.5s ease',
                filter: 'drop-shadow(0 0 5px rgba(255,255,255,0.8))'
              }} />
            )}
            {/* Ticks */}
            <div style={{ position: 'absolute', left: '37.5%', top: 0, bottom: 0, width: '2px', background: 'rgba(0,0,0,0.3)' }}></div>
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: 'rgba(0,0,0,0.3)' }}></div>
          </div>
        </div>
      </div>

      {/* METRICS GRID */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1.5rem'
      }}>
        {renderMetricCard('Heart Rate', data ? data.hr : 0, 'bpm', data ? getStatusColor(data.hr, [100, 120]) : 'var(--text-main)')}
        {renderMetricCard('SpO2', data ? data.spo2 : 0, '%', data && data.spo2 > 0 ? (data.spo2 >= 95 ? 'var(--accent-normal)' : 'var(--accent-alert)') : 'var(--text-main)')}
        {renderMetricCard('Resp. Rate', data ? data.rr : 0, 'rpm', data ? getStatusColor(data.rr, [20, 25]) : 'var(--text-main)')}
        {renderMetricCard('Temperature', data ? data.temp : 0, '°C', data ? getStatusColor(data.temp, [37.5, 38.5]) : 'var(--text-main)')}
        {renderMetricCard('Humidity', data ? data.hum : 0, '%', 'var(--text-main)')}
        {renderMetricCard('PM2.5', data ? data.pm25 : 0, 'µg/m³', data ? getStatusColor(data.pm25, [35, 75]) : 'var(--text-main)')}
        {renderMetricCard('AQI', data ? data.aqi : 0, '', data ? getStatusColor(data.aqi, [50, 100]) : 'var(--text-main)')}
        {renderMetricCard('TVOC', data ? data.tvoc : 0, 'ppb', data ? getStatusColor(data.tvoc, [220, 660]) : 'var(--text-main)')}
        {renderMetricCard('eCO2', data ? data.eco2 : 0, 'ppm', data ? getStatusColor(data.eco2, [1000, 2000]) : 'var(--text-main)')}
        {renderMetricCard('Finger Status', data ? data.finger : '0', '', 'var(--text-main)')}
      </div>

      {/* TERMINAL LOG */}
      <div style={{
        background: '#050505',
        border: '1px solid #333',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: 'inset 0 0 20px rgba(0,0,0,1)'
      }}>
        <div style={{ padding: '0.8rem 1rem', background: '#111', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#888', fontWeight: 'bold', letterSpacing: '1px' }}>LIVE RAW UART DEBUG LOG</span>
          {data && <span style={{ fontSize: '0.8rem', color: '#555' }}>Packet ID: {data.id}</span>}
        </div>
        <div style={{
          padding: '1rem',
          height: '250px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '0.85rem',
          color: '#0f0',
          lineHeight: '1.4',
          display: 'flex',
          flexDirection: 'column-reverse'
        }}>
          {logs.map((log, i) => (
            <div key={i} style={{ opacity: 1 - (i * 0.05) }}>{log}</div>
          ))}
          {logs.length === 0 && <div style={{ color: '#555' }}>Waiting for UART data...</div>}
        </div>
      </div>

    </div>
  );
}
