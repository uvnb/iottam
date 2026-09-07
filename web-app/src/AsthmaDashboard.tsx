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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* PEF HERO CARD */}
      <div style={{
        background: 'rgba(0, 210, 255, 0.05)',
        border: '1px solid rgba(0, 210, 255, 0.4)',
        borderRadius: '24px',
        padding: '2rem',
        textAlign: 'center',
        boxShadow: '0 0 30px rgba(0, 210, 255, 0.1)',
        backdropFilter: 'blur(10px)'
      }}>
        <h2 style={{ fontSize: '1.2rem', color: 'var(--text-muted)', margin: '0 0 1rem 0', letterSpacing: '2px' }}>PEF AI PREDICTION</h2>
        <div style={{ fontSize: '4rem', fontWeight: '900', color: 'var(--accent-normal)', textShadow: '0 0 20px rgba(0,210,255,0.5)' }}>
          {data ? data.pef.toFixed(1) : '0.0'} <span style={{ fontSize: '1.5rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>L/min</span>
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
