import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import type { Session } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function History({ session }: { session: Session }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('posture_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Thời gian', 'Phiên làm việc', 'Tư thế', 'Độ tin cậy', 'Kết nối'];
    const rows = logs.map(log => [
      new Date(log.timestamp).toLocaleString(),
      log.session_id,
      log.posture_key,
      `${(log.confidence * 100).toFixed(1)}%`,
      log.device_type
    ]);
    
    const csvContent = headers.join(',') + '\n' + rows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `CarePosture_History_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getChartData = () => {
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

  const chartData = getChartData();

  return (
    <div className="app-container" style={{ minHeight: '80vh', maxWidth: '1000px', width: '100%' }}>
      <div className="posture-card normal" style={{ width: '100%', maxWidth: 'none', padding: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <h2 className="posture-name" style={{ fontSize: '1.8rem', textAlign: 'left', margin: 0 }}>DỮ LIỆU LỊCH SỬ (HISTORY)</h2>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button onClick={() => navigate('/')} className="audio-btn" style={{ position: 'static', background: 'rgba(255,255,255,0.1)' }}>
              ⬅ QUAY LẠI
            </button>
            <button onClick={exportCSV} className="audio-btn" style={{ position: 'static', background: 'rgba(16, 185, 129, 0.2)', borderColor: '#10b981', color: '#10b981' }}>
              ⬇ XUẤT FILE EXCEL (.CSV)
            </button>
          </div>
        </div>

        {loading ? (
          <p>Đang tải dữ liệu từ Cloud...</p>
        ) : logs.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>Chưa có dữ liệu nào được ghi nhận. Hãy kết nối thiết bị và sử dụng thử.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* Biểu đồ tròn thống kê */}
            <div style={{ height: '300px', background: 'rgba(0,0,0,0.5)', borderRadius: '12px', padding: '1rem', border: '1px solid rgba(0, 210, 255, 0.2)' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#030a16', borderColor: '#00d2ff', borderRadius: '8px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Bảng chi tiết */}
            <div style={{ overflowX: 'auto', background: 'rgba(0,0,0,0.5)', borderRadius: '12px', border: '1px solid rgba(0, 210, 255, 0.2)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
              <thead>
                <tr style={{ background: 'rgba(0, 210, 255, 0.1)', color: 'var(--accent-normal)' }}>
                  <th style={{ padding: '1rem', borderBottom: '1px solid rgba(0,210,255,0.2)' }}>THỜI GIAN</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid rgba(0,210,255,0.2)' }}>TƯ THẾ</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid rgba(0,210,255,0.2)' }}>ĐỘ TIN CẬY</th>
                  <th style={{ padding: '1rem', borderBottom: '1px solid rgba(0,210,255,0.2)' }}>THIẾT BỊ</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '1rem' }}>{new Date(log.timestamp).toLocaleString()}</td>
                    <td style={{ padding: '1rem', color: log.posture_key === 'normal_idle' ? 'var(--accent-normal)' : 'var(--accent-alert)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                      {log.posture_key.replace(/_/g, ' ')}
                    </td>
                    <td style={{ padding: '1rem' }}>{(log.confidence * 100).toFixed(1)}%</td>
                    <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{log.device_type}</td>
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
