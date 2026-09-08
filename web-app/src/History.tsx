import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function History({ session, activeTab = 'posture', onClose }: { session: Session, activeTab?: 'posture' | 'asthma', onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
  }, [activeTab]);

  const fetchLogs = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const tableName = activeTab === 'asthma' ? 'asthma_logs' : 'posture_logs';

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .gte('timestamp', startOfToday.toISOString())
        .order('timestamp', { ascending: false })
        .limit(500);

      if (error) {
        setErrorMsg(error.message);
        throw error;
      }
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    let headers: string[] = [];
    let rows: any[] = [];

    if (activeTab === 'posture') {
      headers = ['Timestamp', 'Session ID', 'Posture', 'Confidence', 'Connection Type'];
      rows = logs.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.session_id,
        log.posture_key,
        `${(log.confidence * 100).toFixed(1)}%`,
        log.device_type
      ]);
    } else {
      headers = ['Timestamp', 'Session ID', 'PEF (L/min)', 'HR (bpm)', 'SpO2 (%)', 'PM2.5', 'AQI', 'Temp', 'Hum', 'Connection Type'];
      rows = logs.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.session_id,
        log.pef,
        log.hr,
        log.spo2,
        log.pm25,
        log.aqi,
        log.temp,
        log.hum,
        log.device_type
      ]);
    }
    
    const csvContent = headers.join(',') + '\n' + rows.map(e => e.join(',')).join('\n');
    // Thêm BOM \uFEFF để Excel đọc đúng UTF-8
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const fileName = activeTab === 'posture' ? 'CarePosture_Daily_Report' : 'Asthma_Daily_Report';
    link.setAttribute('download', `${fileName}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getPostureChartData = () => {
    const counts: Record<string, number> = {};
    logs.forEach(log => {
      counts[log.posture_key] = (counts[log.posture_key] || 0) + 1;
    });

    const badColors = ['#ff3366', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6'];
    let badIdx = 0;

    return Object.entries(counts).map(([key, value]) => {
      let color = '#10b981'; // normal_idle is green
      if (key !== 'normal_idle') {
        color = badColors[badIdx % badColors.length];
        badIdx++;
      }
      return {
        name: key.replace(/_/g, ' ').toUpperCase(),
        value,
        color
      };
    });
  };

  const getAsthmaChartData = () => {
    // Reverse logs to show chronological order on chart (left to right)
    return [...logs].reverse().map(log => ({
      time: new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      pef: log.pef,
      hr: log.hr,
      spo2: log.spo2
    }));
  };

  const isPosture = activeTab === 'posture';

  return (
    <div className="app-container" style={{ minHeight: '80vh', maxWidth: '1000px', width: '100%' }}>
      <div className={`posture-card ${isPosture ? 'normal' : 'alert'}`} style={{ width: '100%', maxWidth: 'none', padding: '2rem', borderColor: isPosture ? 'rgba(0, 210, 255, 0.5)' : 'rgba(255, 51, 102, 0.5)', boxShadow: isPosture ? '0 0 40px rgba(0, 210, 255, 0.15)' : '0 0 40px rgba(255, 51, 102, 0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className="posture-name" style={{ fontSize: '1.8rem', textAlign: 'left', margin: 0, color: isPosture ? 'var(--accent-normal)' : 'var(--accent-alert)' }}>
              {isPosture ? 'POSTURE HISTORY' : 'ASTHMA HISTORY'}
            </h2>
            <p style={{ color: 'var(--text-muted)', margin: '0.5rem 0 0 0', textAlign: 'left' }}>Account: {session.user?.email}</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={onClose} className="audio-btn" style={{ position: 'static', background: 'rgba(255,255,255,0.1)' }}>
              ⬅ BACK
            </button>
            <button onClick={exportCSV} className="audio-btn" style={{ position: 'static', background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', color: '#10b981' }}>
              ⬇ EXPORT (.CSV)
            </button>
          </div>
        </div>

        {errorMsg ? (
          <div style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '8px', border: '1px solid #ef4444' }}>
            <p><strong>DATA FETCH ERROR:</strong> {errorMsg}</p>
            <p>Please ensure you have created the <code>{isPosture ? 'posture_logs' : 'asthma_logs'}</code> table in Supabase!</p>
          </div>
        ) : loading ? (
          <p>Loading data from Cloud...</p>
        ) : logs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No records found for today. Please connect the device and try using it.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Biểu đồ */}
            <div style={{ height: '300px', background: 'rgba(0,0,0,0.5)', borderRadius: '12px', padding: '1rem', border: `1px solid ${isPosture ? 'rgba(0, 210, 255, 0.2)' : 'rgba(255, 51, 102, 0.2)'}` }}>
              {isPosture ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={getPostureChartData()}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                    >
                      {getPostureChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#030a16', borderColor: '#00d2ff', borderRadius: '8px' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={getAsthmaChartData()} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="time" stroke="#88a0b5" tick={{fontSize: 10}} />
                    <YAxis yAxisId="left" stroke="var(--accent-alert)" />
                    <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" />
                    <Tooltip contentStyle={{ backgroundColor: '#1a0505', borderColor: '#ff3366', borderRadius: '8px' }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="pef" name="PEF (L/min)" stroke="var(--accent-alert)" activeDot={{ r: 8 }} strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="hr" name="Heart Rate" stroke="#f59e0b" strokeWidth={2} />
                    <Line yAxisId="right" type="monotone" dataKey="spo2" name="SpO2 (%)" stroke="#10b981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bảng chi tiết */}
            <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.5)', borderRadius: '12px', border: `1px solid ${isPosture ? 'rgba(0, 210, 255, 0.2)' : 'rgba(255, 51, 102, 0.2)'}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: isPosture ? '600px' : '800px' }}>
                <thead>
                  <tr style={{ background: isPosture ? 'rgba(0, 210, 255, 0.1)' : 'rgba(255, 51, 102, 0.1)', color: isPosture ? 'var(--accent-normal)' : 'var(--accent-alert)' }}>
                    <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>TIME</th>
                    {isPosture ? (
                      <>
                        <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>POSTURE</th>
                        <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>CONFIDENCE</th>
                        <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>CONNECTION</th>
                      </>
                    ) : (
                      <>
                        <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>PEF</th>
                        <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>HR</th>
                        <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>SpO2</th>
                        <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>PM2.5</th>
                        <th style={{ padding: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>AQI</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem' }}>{new Date(log.timestamp).toLocaleTimeString()}</td>
                      {isPosture ? (
                        <>
                          <td style={{ padding: '1rem', color: log.posture_key === 'normal_idle' ? 'var(--accent-normal)' : 'var(--accent-alert)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                            {log.posture_key.replace(/_/g, ' ')}
                          </td>
                          <td style={{ padding: '1rem' }}>{(log.confidence * 100).toFixed(1)}%</td>
                          <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{log.device_type}</td>
                        </>
                      ) : (
                        <>
                          <td style={{ padding: '1rem', color: log.pef <= 300 ? 'var(--accent-alert)' : (log.pef <= 400 ? '#f59e0b' : '#10b981'), fontWeight: 'bold' }}>
                            {log.pef} L/min
                          </td>
                          <td style={{ padding: '1rem' }}>{log.hr} bpm</td>
                          <td style={{ padding: '1rem', color: log.spo2 < 95 ? 'var(--accent-alert)' : '#10b981' }}>{log.spo2}%</td>
                          <td style={{ padding: '1rem' }}>{log.pm25}</td>
                          <td style={{ padding: '1rem' }}>{log.aqi}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
