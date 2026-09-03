import React, { useState, useRef, useEffect } from 'react';
import './index.css';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import History from './History';

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

const POSTURE_DATA: Record<string, any> = {
  "normal_idle": {
    title: "STABLE POSTURE",
    subtitle: "Normal idle",
    alert: "POSTURE OK  •  KEEP A NEUTRAL SPINE  •  RELAX YOUR SHOULDERS",
    reminder: "Maintain your head in a neutral position, relax both shoulders, and change posture periodically.",
    affected: "No significant warning areas",
    safe: true
  },
  "bad_posture": {
    title: "SLOUCHING / BAD POSTURE",
    subtitle: "Bad posture detected",
    alert: "POSTURE ALERT  •  NECK AND UPPER-BACK LOAD DETECTED  •  SIT TALL",
    reminder: "Gently bring your head back, open your shoulders, and lean back. Avoid overarching.",
    affected: "Neck • Trapezius • Shoulders • Upper back",
    safe: false
  },
  "bending": {
    title: "BENDING",
    subtitle: "Bending detected",
    alert: "BENDING ALERT  •  REDUCE PROLONGED FORWARD FLEXION  •  RESET POSTURE",
    reminder: "Reduce continuous bending time. When standing up, keep movements slow and controlled.",
    affected: "Neck • Mid back • Lower back",
    safe: false
  },
  "lifting_wrong_back": {
    title: "UNSAFE LIFTING",
    subtitle: "Unsafe back lifting pattern",
    alert: "LIFTING ALERT  •  LOAD ON LOWER BACK  •  STOP AND RESET YOUR FORM",
    reminder: "Stop the movement, bring the object close to your body, and use your legs. Do not twist your torso while lifting.",
    affected: "Erector spinae • Mid back • Lower back",
    safe: false
  },
  "shoulder_asymmetry": {
    title: "SHOULDER ASYMMETRY",
    subtitle: "Shoulder asymmetry detected",
    alert: "SHOULDER ALERT  •  UNEVEN SHOULDER POSITION  •  RELAX AND RE-CENTER",
    reminder: "Relax your arms, level your shoulders, and avoid carrying loads on one side for too long.",
    affected: "Trapezius • Left/Right shoulders • Scapula area",
    safe: false
  }
};

const SERVICE_UUID = "12345678-1234-5678-1234-56789abc0001";
const CHARACTERISTIC_UUID = "12345678-1234-5678-1234-56789abc0001";

function Dashboard({ session }: { session: Session }) {
  const [showHistory, setShowHistory] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'Disconnected' | 'Connecting' | 'Connected' | 'Error'>('Disconnected');
  const [connectionType, setConnectionType] = useState<'USB' | 'BLE' | null>(null);
  
  const [currentPosture, setCurrentPosture] = useState<string>('normal_idle');
  const [confidence, setConfidence] = useState<number>(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastBeepRef = useRef<number>(0);
  const sessionIdRef = useRef<string>('');
  const lastLogTimeRef = useRef<number>(0);
  const currentConnTypeRef = useRef<string>('UNKNOWN');
  const currentPostureRef = useRef<string>('normal_idle');

  // USB Refs
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  
  // BLE Refs
  const bleDeviceRef = useRef<any>(null);
  const bleCharRef = useRef<any>(null);
  const bleBufferRef = useRef<string>('');
  
  // WebSocket Bridge Ref
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

    // Google Text-to-Speech
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'en-US';
      utterance.rate = 1.1; // Nói nhanh hơn 1 chút
      window.speechSynthesis.speak(utterance);
    }
  };

  const parseSerialLine = (line: string) => {
    if (line.length === 0) return;

    let postureKey = '';
    let conf = 0;
    let valid = false;

    // Hỗ trợ trường hợp chip gửi dữ liệu JSON (đã ghép chuỗi thành công hoặc từ WebSocket Bridge)
    if (line.startsWith('{')) {
      try {
        const payload = JSON.parse(line);
        
        // Format từ WebSocket Bridge
        if (payload.type === 'posture' && payload.data) {
          postureKey = payload.data.posture;
          conf = parseFloat(payload.data.confidence);
          valid = true;
        } 
        // Format BLE JSON trực tiếp
        else if (payload.posture && payload.confidence !== undefined) {
          postureKey = payload.posture;
          conf = parseFloat(payload.confidence);
          valid = true;
        }
      } catch (e) {}
    }

    // Hỗ trợ trường hợp UART gửi chuỗi text [AI]
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
        
        if (!isSafe) {
          // Tăng thời gian giãn cách lên 5 giây để AI đọc xong câu
          if (prev === 'normal_idle' || now - lastBeepRef.current > 5000) {
            playAlertSound(POSTURE_DATA[postureKey].subtitle);
            
            // Gửi thông báo hệ thống (hiện lên khi đang xem tab khác)
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('CarePosture Alert', {
                body: POSTURE_DATA[postureKey].subtitle,
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
              if (error) {
                console.error('Supabase Sync Error:', error);
                alert(`Lỗi đồng bộ Cloud: ${error.message}\n(Gợi ý: Kiểm tra xem bảng posture_logs đã được tạo trên Supabase chưa)`);
              }
            });
          }
          lastLogTimeRef.current = now;
        }

        currentPostureRef.current = postureKey;
        setCurrentPosture(postureKey);
        setConfidence(conf);
      }
  };

  const connectBLE = async () => {
    if (!('bluetooth' in navigator)) {
      alert('Browser does not support Web Bluetooth API. Please use Chrome/Edge on PC or Android.');
      return;
    }
    
    if (!audioCtxRef.current) initAudio();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    try {
      setConnectionStatus('Connecting');
      setConnectionType('BLE');
      currentConnTypeRef.current = 'BLE';
      sessionIdRef.current = Date.now().toString();
      
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ name: 'CAREBOT AI' }],
        optionalServices: [SERVICE_UUID, "4fafc201-1fb5-459e-8fcc-c5c9c331914b"]
      });

      bleDeviceRef.current = device;

      device.addEventListener('gattserverdisconnected', () => {
        setConnectionStatus('Disconnected');
        setConnectionType(null);
      });

      const server = await device.gatt.connect();
      
      let service;
      try {
        service = await server.getPrimaryService(SERVICE_UUID);
      } catch (e) {
        // Fallback nếu firmware dùng Service UUID cũ
        service = await server.getPrimaryService("4fafc201-1fb5-459e-8fcc-c5c9c331914b");
      }
      
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      bleCharRef.current = characteristic;

      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(value);
        
        // Cần nối chuỗi vì BLE giới hạn độ dài gói tin, làm JSON bị cắt nhỏ
        bleBufferRef.current += text;
        const lines = bleBufferRef.current.split('\n');
        bleBufferRef.current = lines.pop() || '';
        
        for (const line of lines) {
          parseSerialLine(line.trim());
        }
      });

      await characteristic.startNotifications();
      setConnectionStatus('Connected');
    } catch (err) {
      console.error('BLE Error:', err);
      setConnectionStatus('Error');
    }
  };

  const disconnectBLE = async () => {
    if (bleCharRef.current) {
      try { await bleCharRef.current.stopNotifications(); } catch(e){}
    }
    if (bleDeviceRef.current && bleDeviceRef.current.gatt.connected) {
      bleDeviceRef.current.gatt.disconnect();
    }
    bleDeviceRef.current = null;
    bleCharRef.current = null;
    setConnectionStatus('Disconnected');
    setConnectionType(null);
  };

  const connectBridge = () => {
    if (!audioCtxRef.current) initAudio();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    setConnectionStatus('Connecting');
    setConnectionType('BLE'); // Hiện chữ BLE cho user đỡ rối
    currentConnTypeRef.current = 'BRIDGE_WS';
    sessionIdRef.current = Date.now().toString();

    // Nếu đang chạy trên vercel thì trỏ về máy tính cục bộ (127.0.0.1)
    const host = window.location.hostname.includes('vercel.app') ? '127.0.0.1' : window.location.hostname;
    const ws = new WebSocket(`ws://${host}:8000/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnectionStatus('Connected');
    };

    ws.onmessage = (event) => {
      // Bridge gửi text JSON
      parseSerialLine(event.data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      setConnectionStatus('Error');
      alert('Không thể kết nối đến WebSocket Bridge.\nHãy đảm bảo bạn đang chạy file ble_web_server.py trên máy tính này (port 8000).');
    };

    ws.onclose = () => {
      if (wsRef.current) { // Nếu tự đóng thì không tính là lỗi
        setConnectionStatus('Disconnected');
      }
    };
  };

  const disconnectBridge = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnectionStatus('Disconnected');
    setConnectionType(null);
  };

  const connectSerial = async () => {
    if (!('serial' in navigator)) {
      alert('Browser does not support Web Serial API.');
      return;
    }
    
    if (!audioCtxRef.current) initAudio();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    try {
      setConnectionStatus('Connecting');
      setConnectionType('USB');
      currentConnTypeRef.current = 'USB';
      sessionIdRef.current = Date.now().toString();
      
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      setConnectionStatus('Connected');
      
      readSerialData(port);
    } catch (err: any) {
      console.error('Serial Error:', err);
      setConnectionStatus('Error');
      if (err.toString().includes('NetworkError') || err.toString().includes('Failed to open')) {
        alert('Error: USB port is currently in use!\n\nPlease close the Serial Monitor in Arduino IDE or any other software using the COM port, then try again.');
      }
    }
  };

  const readSerialData = async (port: any) => {
    const textDecoder = new TextDecoderStream();
    port.readable.pipeTo(textDecoder.writable).catch(console.error);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    let buffer = '';
    let lastRenderTime = 0;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        
        if (buffer.length > 10000) {
          buffer = buffer.slice(-1000); 
        }

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        const now = Date.now();
        if (lines.length > 0 && now - lastRenderTime > 100) {
          const aiLines = lines.filter(l => l.includes('[AI] class='));
          if (aiLines.length > 0) {
            parseSerialLine(aiLines[aiLines.length - 1].trim());
            lastRenderTime = now;
          }
        }
      }
    } catch (error) {
      console.error('Serial Read Error:', error);
      setConnectionStatus('Error');
    } finally {
      reader.releaseLock();
    }
  };

  const disconnectSerial = async () => {
    if (readerRef.current) await readerRef.current.cancel();
    if (portRef.current) await portRef.current.close();
    portRef.current = null;
    setConnectionStatus('Disconnected');
    setConnectionType(null);
  };

  const disconnectAll = () => {
    if (currentConnTypeRef.current === 'BLE') disconnectBLE();
    if (currentConnTypeRef.current === 'USB') disconnectSerial();
    if (currentConnTypeRef.current === 'BRIDGE_WS') disconnectBridge();
    
    // Fallback dọn dẹp
    disconnectBLE();
    disconnectSerial();
    disconnectBridge();
  };

  useEffect(() => {
    return () => {
      disconnectAll();
    };
  }, []);

  const isNormal = currentPosture === 'normal_idle';
  const postureInfo = POSTURE_DATA[currentPosture] || POSTURE_DATA['normal_idle'];
  const statusClass = connectionStatus === 'Connected' ? (isNormal ? 'normal' : 'alert') : '';
  
  return (
    <div className="app-container">
      {!audioEnabled && connectionStatus === 'Disconnected' && (
        <button className="audio-btn" onClick={initAudio} style={{ top: '6rem' }}>
          Enable Audio Alerts
        </button>
      )}

      <div className="header">
        <h1>CarePosture AI</h1>
        <p>Wireless BLE & Wired USB Support</p>
      </div>

      {showHistory && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999, background: 'rgba(0,0,0,0.85)', overflowY: 'auto' }}>
          <History session={session} onClose={() => setShowHistory(false)} />
        </div>
      )}

      {connectionStatus !== 'Connected' ? (
        <div className="connect-prompt">
          <div className="status-icon" style={{ marginBottom: '2rem' }}>📡</div>
          <h2>Device not connected</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Please turn on ESP32 or plug it into your computer, then select a connection method.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={connectBridge} className="audio-btn" style={{ position: 'relative', top: 0, right: 0, fontSize: '1.1rem', padding: '12px 24px', background: 'rgba(139, 92, 246, 0.2)', borderColor: '#8b5cf6', color: '#c4b5fd' }}>
              📡 CONNECT BLE (WIRELESS)
            </button>
            <button onClick={connectSerial} className="audio-btn" style={{ position: 'relative', top: 0, right: 0, fontSize: '1.1rem', padding: '12px 24px' }}>
              🔌 CONNECT USB (WIRED)
            </button>
          </div>
        </div>
      ) : (
        <div className="main-content">
          <div className={`model-container ${statusClass}`}>
            <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <img src="/back_muscles.png" alt="Back Muscles" className="body-model" style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '12px' }} />
              <div className="sensor-point c7"><div className="pulse"></div><span className="label">C7</span></div>
              <div className="sensor-point t5"><div className="pulse"></div><span className="label">T5</span></div>
              <div className="sensor-point l3"><div className="pulse"></div><span className="label">L3</span></div>
              <div className="sensor-point ls"><div className="pulse"></div><span className="label">LS</span></div>
              <div className="sensor-point rs"><div className="pulse"></div><span className="label">RS</span></div>
            </div>
          </div>

          <div className={`posture-card ${statusClass}`}>
            <div className="status-icon">
              {isNormal ? '✓' : '⚠️'}
            </div>
            <h2 className="posture-name" style={{ fontSize: '2rem', textTransform: 'uppercase' }}>
              <span>{postureInfo.subtitle}</span>
            </h2>
            <div className="confidence" style={{ marginBottom: '1.5rem' }}>
              <span>Confidence: {(confidence * 100).toFixed(1)}%</span>
            </div>
            
            <div className="posture-details" style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px' }}>
              
              <div style={{ marginBottom: '1.5rem', color: postureInfo.safe ? '#10b981' : '#f43f5e', fontSize: '1.05rem', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                <span>{postureInfo.alert}</span>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: 'var(--text-muted)' }}><span>Affected regions:</span></strong> 
                <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.9rem' }}>{postureInfo.affected}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-muted)' }}><span>Recommendation:</span></strong> 
                <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>{postureInfo.reminder}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="connection-status">
        <button onClick={() => setShowHistory(true)} style={{ marginRight: 'auto', background: 'rgba(0,210,255,0.2)', border: '1px solid var(--accent-normal)', color: 'var(--accent-normal)', borderRadius: '4px', cursor: 'pointer', padding: '0.4rem 0.8rem', fontWeight: 'bold' }}>
          📊 Xem Lịch Sử
        </button>
        <div className={`status-dot ${connectionStatus === 'Connected' ? 'connected' : connectionStatus === 'Error' ? 'error' : ''}`}></div>
        <span>
          {connectionStatus === 'Disconnected' && <span>Disconnected</span>}
          {connectionStatus === 'Connecting' && <span>Connecting {connectionType}...</span>}
          {connectionStatus === 'Connected' && <span>Connected via {connectionType}</span>}
          {connectionStatus === 'Error' && <span>Disconnected / Error</span>}
        </span>
        
        {connectionStatus === 'Connected' && (
          <button onClick={disconnectAll} style={{ marginLeft: '10px', background: 'transparent', border: '1px solid white', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>
            Disconnect
          </button>
        )}
        <button onClick={() => supabase.auth.signOut()} style={{ marginLeft: '15px', background: 'rgba(255,51,102,0.1)', border: '1px solid var(--accent-alert)', color: 'var(--accent-alert)', borderRadius: '4px', cursor: 'pointer', padding: '0.2rem 0.5rem' }}>
          Logout ({session.user?.email})
        </button>
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
