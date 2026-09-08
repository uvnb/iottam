import React, { useState, useRef, useEffect } from 'react';
import './index.css';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import History from './History';
import PostureDashboard from './PostureDashboard';
import AsthmaDashboard, { type AsthmaData } from './AsthmaDashboard';
import { POSTURE_DATA } from './constants';
class ErrorBoundary extends React.Component<any, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ color: 'red', padding: '20px', background: '#fff' }}>
          <h2>Đã xảy ra lỗi giao diện (Crash):</h2>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function Dashboard({ session }: { session: Session }) {
  const [showHistory, setShowHistory] = useState(false);
  const [postureConnectionStatus, setPostureConnectionStatus] = useState<'Disconnected' | 'Connecting' | 'Connected' | 'Error'>('Disconnected');
  const [asthmaConnectionStatus, setAsthmaConnectionStatus] = useState<'Disconnected' | 'Connecting' | 'Connected' | 'Error'>('Disconnected');
  const [postureConnectionType, setPostureConnectionType] = useState<'USB' | 'BLE' | null>(null);
  const [asthmaConnectionType, setAsthmaConnectionType] = useState<'WIFI' | null>(null);
  
  const [activeTab, setActiveTab] = useState<'posture' | 'asthma'>('posture');

  const connectionStatus = activeTab === 'posture' ? postureConnectionStatus : asthmaConnectionStatus;
  const connectionType = activeTab === 'posture' ? postureConnectionType : asthmaConnectionType;
  
  const [currentPosture, setCurrentPosture] = useState<string>('normal_idle');
  const [confidence, setConfidence] = useState<number>(0);
  const [audioEnabled, setAudioEnabled] = useState(false);

  // Asthma States
  const [asthmaData, setAsthmaData] = useState<AsthmaData | null>(null);
  const [asthmaLogs, setAsthmaLogs] = useState<string[]>([]);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastBeepRef = useRef<number>(0);
  const lastAsthmaBeepRef = useRef<number>(0);
  const sessionIdRef = useRef<string>('');
  const lastLogTimeRef = useRef<number>(0);
  const currentConnTypeRef = useRef<string>('UNKNOWN');
  const currentPostureRef = useRef<string>('normal_idle');

  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    setAudioEnabled(true);
  };

  const playAlertSound = (textToSpeak: string) => {
    if (!audioEnabled) return;

    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
      
      const oscillator = audioCtxRef.current.createOscillator();
      const gainNode = audioCtxRef.current.createGain();
      
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(440, audioCtxRef.current.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, audioCtxRef.current.currentTime + 0.1);
      
      gainNode.gain.setValueAtTime(0, audioCtxRef.current.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, audioCtxRef.current.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.5);
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtxRef.current.destination);
      
      oscillator.start();
      oscillator.stop(audioCtxRef.current.currentTime + 0.5);
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'en-US';
      utterance.rate = 1.1;
      window.speechSynthesis.speak(utterance);
    }
  };

  const parseSerialLine = (line: string) => {
    if (line.length === 0) return;

    // --- ASTHMA DATA PARSING ---
    if (line.startsWith('DATA,ID=')) {
      try {
        const parts = line.split(',');
        const dataMap: any = {};
        parts.forEach(part => {
          const [key, val] = part.split('=');
          if (key && val !== undefined) {
            dataMap[key.trim()] = val.trim();
          }
        });

        if (dataMap['ID']) {
          const newData: AsthmaData = {
            id: parseInt(dataMap['ID']) || 0,
            pm1: parseInt(dataMap['PM1']) || 0,
            pm25: parseInt(dataMap['PM25']) || 0,
            pm10: parseInt(dataMap['PM10']) || 0,
            aqi: parseInt(dataMap['AQI']) || 0,
            tvoc: parseInt(dataMap['TVOC']) || 0,
            eco2: parseInt(dataMap['ECO2']) || 0,
            temp: parseFloat(dataMap['TEMP']) || 0,
            hum: parseFloat(dataMap['HUM']) || 0,
            finger: dataMap['FINGER'] || '0',
            hr: parseFloat(dataMap['HR']) || 0,
            spo2: parseFloat(dataMap['SPO2']) || 0,
            rr: parseFloat(dataMap['RR']) || 0,
            pef: parseFloat(dataMap['PEF']) || 0,
            rawLine: line
          };
          
          setAsthmaData(newData);
          setAsthmaLogs(prev => {
            const newLogs = [line, ...prev];
            if (newLogs.length > 50) newLogs.pop();
            return newLogs;
          });

          // --- ASTHMA ALERT LOGIC ---
          if (newData.pef > 0 && newData.pef <= 300) {
            const now = Date.now();
            if (now - lastAsthmaBeepRef.current > 10000) {
              playAlertSound("Cảnh báo! Lưu lượng đỉnh quá thấp, nguy cơ lên cơn hen suyễn.");
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('⚠️ CẢNH BÁO HEN SUYỄN', {
                  body: `Nguy cơ cao! Lưu lượng đỉnh (PEF) giảm xuống mức ${newData.pef.toFixed(1)} L/min.`,
                  tag: 'asthma-alert',
                  renotify: true
                } as any);
              }
              lastAsthmaBeepRef.current = now;
            }
          }

        }
      } catch (e) {
        console.error("Parse Asthma error", e);
      }
      return; 
    }

    // --- POSTURE DATA PARSING ---
    let postureKey = '';
    let conf = 0;
    let valid = false;

    if (line.startsWith('{')) {
      try {
        const payload = JSON.parse(line);
        if (payload.type === 'posture' && payload.data) {
          postureKey = payload.data.posture;
          conf = parseFloat(payload.data.confidence);
          valid = true;
        } 
        else if (payload.posture && payload.confidence !== undefined) {
          postureKey = payload.posture;
          conf = parseFloat(payload.confidence);
          valid = true;
        }
      } catch (e) {}
    }

    if (!valid && line.includes('[AI] class=')) {
      const postureMatch = line.match(/posture=([a-z_]+)/);
      const confMatch = line.match(/confidence=([\d\.]+)/);
      if (postureMatch && confMatch) {
        postureKey = postureMatch[1];
        conf = parseFloat(confMatch[1]);
        valid = true;
      }
    }

    if (valid) {
      if (!POSTURE_DATA[postureKey]) postureKey = 'normal_idle';
      const isSafe = POSTURE_DATA[postureKey].safe;
      const now = Date.now();
      const prev = currentPostureRef.current;
      
      if (!isSafe && postureKey !== 'normal_idle') {
        if (prev === 'normal_idle' || now - lastBeepRef.current > 5000) {
          const alertText = postureKey.replace(/_/g, ' ');
          playAlertSound(alertText);
          
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('CarePosture Alert', {
              body: alertText,
              tag: 'posture-alert',
              renotify: true
            } as any);
          }
          lastBeepRef.current = now;
        }
      }

      if (postureKey !== prev || now - lastLogTimeRef.current > 5000) {
        if (sessionIdRef.current) {
          supabase.from('posture_logs').insert([{
            user_id: session.user.id,
            session_id: sessionIdRef.current,
            posture_key: postureKey,
            confidence: conf,
            device_type: currentConnTypeRef.current
          }]).then(({ error }) => {
            if (error) console.error('Supabase Sync Error:', error);
          });
        }
        lastLogTimeRef.current = now;
      }

      currentPostureRef.current = postureKey;
      setCurrentPosture(postureKey);
      setConfidence(conf);
    }
  };

  const disconnectBLE = () => {};

  const connectBridge = () => {
    if (!audioCtxRef.current) initAudio();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    setPostureConnectionStatus('Connecting');
    setPostureConnectionType('BLE'); 
    currentConnTypeRef.current = 'BRIDGE_WS';
    sessionIdRef.current = Date.now().toString();

    const host = window.location.hostname.includes('vercel.app') ? '127.0.0.1' : window.location.hostname;
    const ws = new WebSocket(`ws://${host}:8000/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setPostureConnectionStatus('Connected');
    };

    ws.onmessage = (event) => {
      const line = event.data;
      parseSerialLine(line);
    };

    ws.onclose = () => {
      setPostureConnectionStatus('Disconnected');
    };

    ws.onerror = () => {
      setPostureConnectionStatus('Error');
    };
  };

  const connectSerial = async () => {
    if (!audioCtxRef.current) initAudio();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    try {
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      setPostureConnectionStatus('Connected');
      setPostureConnectionType('USB');
      currentConnTypeRef.current = 'USB_SERIAL';
      sessionIdRef.current = Date.now().toString();

      const textDecoder = new TextDecoderStream();
      port.readable.pipeTo(textDecoder.writable);
      const reader = textDecoder.readable.getReader();
      readerRef.current = reader;

      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        for (let i = 0; i < lines.length - 1; i++) {
          parseSerialLine(lines[i].trim());
        }
        buffer = lines[lines.length - 1];
      }
    } catch (e) {
      console.error(e);
      setPostureConnectionStatus('Error');
    }
  };

  const wifiIntervalRef = useRef<any>(null);

  const connectWiFi = () => {
    const ip = prompt("Nhập địa chỉ IP của ESP (Ví dụ: 192.168.137.95)\nLưu ý: Bạn đang dùng web HTTPS, trình duyệt sẽ chặn kết nối tới HTTP IP (Lỗi Mixed Content). Hãy click vào ổ khoá bảo mật trên thanh địa chỉ -> Site Settings -> Insecure content -> Allow.", "192.168.137.95");
    if (!ip) return;
    
    if (!audioCtxRef.current) initAudio();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    setAsthmaConnectionStatus('Connecting');
    setAsthmaConnectionType('WIFI'); 
    currentConnTypeRef.current = 'WIFI_IP';
    sessionIdRef.current = Date.now().toString();

    fetch(`http://${ip}/api`)
      .then(res => res.json())
      .then(data => {
        setAsthmaConnectionStatus('Connected');
        if (data.lastLine) parseSerialLine(data.lastLine);
        
        wifiIntervalRef.current = setInterval(() => {
          fetch(`http://${ip}/api`)
            .then(res => res.json())
            .then(d => {
              if (d.lastLine) parseSerialLine(d.lastLine);
            })
            .catch(e => console.error("WiFi Poll error:", e));
        }, 1000);
      })
      .catch(e => {
        console.error(e);
        setAsthmaConnectionStatus('Error');
        alert("Lỗi kết nối WiFi!\n\nChi tiết:\n1. Kiểm tra IP đã đúng chưa.\n2. Lỗi Mixed Content: Trình duyệt chặn HTTPS kết nối tới HTTP. Hãy chọn 'Allow Insecure Content' trong cài đặt trang hoặc dùng localhost.");
      });
  };

  const disconnectBridge = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setPostureConnectionStatus('Disconnected');
  };

  const disconnectSerial = async () => {
    if (readerRef.current) await readerRef.current.cancel();
    if (portRef.current) await portRef.current.close();
    setPostureConnectionStatus('Disconnected');
  };

  const disconnectAll = () => {
    if (activeTab === 'posture') {
      disconnectBLE();
      disconnectSerial();
      disconnectBridge();
      setPostureConnectionStatus('Disconnected');
    } else {
      if (wifiIntervalRef.current) {
        clearInterval(wifiIntervalRef.current);
        wifiIntervalRef.current = null;
      }
      setAsthmaConnectionStatus('Disconnected');
    }
  };

  useEffect(() => {
    return () => disconnectAll();
  }, []);

  useEffect(() => {
    if (activeTab === 'asthma') {
      document.body.classList.add('asthma-bg');
    } else {
      document.body.classList.remove('asthma-bg');
    }
  }, [activeTab]);

  const isNormal = currentPosture === 'normal_idle';
  const statusClass = connectionStatus === 'Connected' ? (isNormal ? 'normal' : 'alert') : '';
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%' }}>
      <header className={`top-header ${statusClass}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="header-left">
          <h1 className="header-title">CAREBOT SYSTEM</h1>
          
          <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '1rem' }}>
            <button 
              onClick={() => setActiveTab('posture')}
              style={{
                background: activeTab === 'posture' ? 'rgba(0, 210, 255, 0.2)' : 'transparent',
                border: activeTab === 'posture' ? '1px solid var(--accent-normal)' : '1px solid rgba(255,255,255,0.2)',
                color: activeTab === 'posture' ? 'var(--accent-normal)' : 'var(--text-muted)',
                padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s'
              }}
            >
              POSTURE AI
            </button>
            <button 
              onClick={() => setActiveTab('asthma')}
              style={{
                background: activeTab === 'asthma' ? 'rgba(0, 210, 255, 0.2)' : 'transparent',
                border: activeTab === 'asthma' ? '1px solid var(--accent-normal)' : '1px solid rgba(255,255,255,0.2)',
                color: activeTab === 'asthma' ? 'var(--accent-normal)' : 'var(--text-muted)',
                padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.3s'
              }}
            >
              ASTHMA AI
            </button>
          </div>
        </div>
        
        <div className="header-center" style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(0,0,0,0.4)', padding: '0.5rem 1.5rem', borderRadius: '50px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className={`status-dot ${connectionStatus === 'Connected' ? 'connected' : connectionStatus === 'Error' ? 'error' : ''}`}></div>
            <span style={{ fontSize: '0.95rem' }}>
              {connectionStatus === 'Disconnected' && 'System Offline'}
              {connectionStatus === 'Connecting' && `Connecting ${connectionType}...`}
              {connectionStatus === 'Connected' && `Connected via ${connectionType}`}
              {connectionStatus === 'Error' && 'Connection Error'}
            </span>
            {connectionStatus === 'Connected' && (
              <button onClick={disconnectAll} style={{ marginLeft: '10px', background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', color: 'white', borderRadius: '4px', cursor: 'pointer', padding: '2px 8px', fontSize: '0.8rem' }}>
                DISCONNECT
              </button>
            )}
          </div>
        </div>

        <div className="header-right">
          <button onClick={() => setShowHistory(true)} style={{ background: 'rgba(0,210,255,0.2)', border: '1px solid var(--accent-normal)', color: 'var(--accent-normal)', borderRadius: '4px', cursor: 'pointer', padding: '0.4rem 0.8rem', fontWeight: 'bold' }}>
            📊 History
          </button>
          <button onClick={() => supabase.auth.signOut()} style={{ background: 'rgba(255,51,102,0.1)', border: '1px solid var(--accent-alert)', color: 'var(--accent-alert)', borderRadius: '4px', cursor: 'pointer', padding: '0.4rem 0.8rem' }}>
            Logout ({session.user?.email?.split('@')[0]})
          </button>
        </div>
      </header>

      <div className="app-container" style={{ position: 'relative', flex: 1, padding: '2rem', width: '100%', maxWidth: '100%' }}>
        
        {!audioEnabled && connectionStatus === 'Disconnected' && (
          <button className="audio-btn" onClick={initAudio} style={{ position: 'absolute', top: '1rem', zIndex: 10 }}>
            ENABLE AUDIO ALERTS
          </button>
        )}

        {showHistory && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999, background: 'rgba(0,0,0,0.85)', overflowY: 'auto' }}>
            <History session={session} onClose={() => setShowHistory(false)} />
          </div>
        )}

        {connectionStatus === 'Connected' && (
          <div style={{ transition: 'all 0.5s', width: '100%', display: 'flex', justifyContent: 'center' }}>
            {activeTab === 'posture' ? (
               <PostureDashboard currentPosture={currentPosture} confidence={confidence} statusClass={statusClass} />
            ) : (
               <AsthmaDashboard data={asthmaData} logs={asthmaLogs} />
            )}
          </div>
        )}

        {connectionStatus !== 'Connected' && (
          <div className="connect-modal-overlay">
            <div className="connect-prompt">
              <div className="status-icon" style={{ marginBottom: '1.5rem', width: '80px', height: '80px', fontSize: '2.5rem' }}>📡</div>
              <h2 style={{ fontSize: '1.8rem', marginBottom: '1rem' }}>System Offline</h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: '1.6' }}>
                Please power on the CareBot shirt and select a secure connection method to begin real-time analysis.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {activeTab === 'posture' && (
                  <>
                    <button onClick={connectBridge} className="audio-btn" style={{ fontSize: '1.05rem', padding: '12px 20px', borderColor: '#00d2ff' }}>
                      📡 CONNECT BLE (WIRELESS)
                    </button>
                    <button onClick={connectSerial} className="audio-btn" style={{ fontSize: '1.05rem', padding: '12px 20px' }}>
                      🔌 CONNECT USB (WIRED)
                    </button>
                  </>
                )}
                {activeTab === 'asthma' && (
                  <button onClick={connectWiFi} className="audio-btn" style={{ fontSize: '1.05rem', padding: '12px 20px', borderColor: '#ff3366' }}>
                    🌐 CONNECT WIFI (ESP IP)
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

export default function DashboardWrapper({ session }: { session: Session }) {
  return (
    <ErrorBoundary>
      <Dashboard session={session} />
    </ErrorBoundary>
  );
}
