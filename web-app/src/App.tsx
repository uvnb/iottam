import React, { useState, useRef, useEffect } from 'react';
import './index.css';

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

import './index.css';

const POSTURE_DATA: Record<string, any> = {
  "normal_idle": {
    title: "TƯ THẾ ỔN ĐỊNH",
    subtitle: "Normal idle",
    alert: "POSTURE OK  •  KEEP A NEUTRAL SPINE  •  RELAX YOUR SHOULDERS",
    reminder: "Duy trì đầu ở vị trí trung tính, thả lỏng hai vai và đổi tư thế định kỳ.",
    affected: "Không có vùng cảnh báo nổi bật",
    safe: true
  },
  "bad_posture": {
    title: "TƯ THẾ GÙ / NGỒI SAI",
    subtitle: "Bad posture detected",
    alert: "POSTURE ALERT  •  NECK AND UPPER-BACK LOAD DETECTED  •  SIT TALL",
    reminder: "Nhẹ nhàng đưa đầu về sau, mở vai và tựa lưng. Không cố ưỡn quá mức.",
    affected: "Cổ gáy • cơ thang • vai • lưng trên",
    safe: false
  },
  "bending": {
    title: "CÚI NGƯỜI",
    subtitle: "Bending detected",
    alert: "BENDING ALERT  •  REDUCE PROLONGED FORWARD FLEXION  •  RESET POSTURE",
    reminder: "Rút ngắn thời gian cúi liên tục. Khi đứng lên, giữ chuyển động chậm và có kiểm soát.",
    affected: "Cổ gáy • lưng giữa • vùng thắt lưng",
    safe: false
  },
  "lifting_wrong_back": {
    title: "NÂNG VẬT SAI TƯ THẾ",
    subtitle: "Unsafe back lifting pattern",
    alert: "LIFTING ALERT  •  LOAD ON LOWER BACK  •  STOP AND RESET YOUR FORM",
    reminder: "Dừng động tác, đưa vật sát người và dùng chân hỗ trợ. Không xoay thân khi đang nâng.",
    affected: "Cơ dựng sống • lưng giữa • thắt lưng",
    safe: false
  },
  "shoulder_asymmetry": {
    title: "LỆCH VAI",
    subtitle: "Shoulder asymmetry detected",
    alert: "SHOULDER ALERT  •  UNEVEN SHOULDER POSITION  •  RELAX AND RE-CENTER",
    reminder: "Thả lỏng tay, cân lại hai vai và tránh mang tải lâu ở một bên.",
    affected: "Cơ thang • vai trái/phải • quanh xương bả vai",
    safe: false
  }
};

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

function App() {
  const [connectionStatus, setConnectionStatus] = useState<'Disconnected' | 'Connecting' | 'Connected' | 'Error'>('Disconnected');
  const [connectionType, setConnectionType] = useState<'USB' | 'BLE' | null>(null);
  
  const [currentPosture, setCurrentPosture] = useState<string>('normal_idle');
  const [confidence, setConfidence] = useState<number>(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // USB Refs
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);
  
  // BLE Refs
  const bleDeviceRef = useRef<any>(null);
  const bleCharRef = useRef<any>(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    setAudioEnabled(true);
  };

  const playAlertSound = () => {
    if (!audioCtxRef.current || !audioEnabled) return;
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
  };

  const parseSerialLine = (line: string) => {
    if (line.length === 0) return;

    if (line.includes('[AI] class=')) {
      const postureMatch = line.match(/posture=([a-z_]+)/);
      const confMatch = line.match(/confidence=([\d\.]+)/);
      if (postureMatch && confMatch) {
        let postureKey = postureMatch[1];
        const conf = parseFloat(confMatch[1]);
        
        // Theo chuẩn ESP32, đôi khi nó có thể gửi class=4 kèm posture=normal_idle. 
        // Bằng cách dùng trực tiếp key chuỗi chữ, ta không cần lo về class ID nữa!
        if (!POSTURE_DATA[postureKey]) postureKey = 'normal_idle';

        setCurrentPosture(prev => {
          if (prev === 'normal_idle' && postureKey !== 'normal_idle') playAlertSound();
          return postureKey;
        });
        setConfidence(conf);
      }
      return;
    }

  };

  // -------------------------------------------------------------
  // WEB BLUETOOTH API (BLE)
  // -------------------------------------------------------------
  const connectBLE = async () => {
    if (!('bluetooth' in navigator)) {
      alert('Trình duyệt không hỗ trợ Web Bluetooth API. Hãy dùng Chrome/Edge trên PC hoặc Android.');
      return;
    }

    try {
      setConnectionStatus('Connecting');
      setConnectionType('BLE');
      
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ namePrefix: 'CarePosture' }],
        optionalServices: [SERVICE_UUID]
      });

      bleDeviceRef.current = device;

      device.addEventListener('gattserverdisconnected', () => {
        setConnectionStatus('Disconnected');
        setConnectionType(null);
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID);
      bleCharRef.current = characteristic;

      characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(value);
        // BLE packets might be chunks, but here we assume our short CSV fits or is handled by ESP32 GATT
        parseSerialLine(text.trim());
      });

      await characteristic.startNotifications();
      setConnectionStatus('Connected');
      
      if (!audioCtxRef.current) initAudio();

    } catch (err) {
      console.error('Lỗi BLE:', err);
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

  // -------------------------------------------------------------
  // WEB SERIAL API (USB)
  // -------------------------------------------------------------
  const connectSerial = async () => {
    if (!('serial' in navigator)) {
      alert('Trình duyệt không hỗ trợ Web Serial API.');
      return;
    }

    try {
      setConnectionStatus('Connecting');
      setConnectionType('USB');
      
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 });
      portRef.current = port;
      setConnectionStatus('Connected');
      
      if (!audioCtxRef.current) initAudio();
      readSerialData(port);
      
    } catch (err: any) {
      console.error('Lỗi Serial:', err);
      setConnectionStatus('Error');
      if (err.toString().includes('NetworkError') || err.toString().includes('Failed to open')) {
        alert('Lỗi: Cổng USB đang bị chiếm dụng!\n\nVui lòng TẮT Serial Monitor trên Arduino IDE hoặc các phần mềm khác đang mở cổng COM, sau đó thử lại.');
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
          // Chỉ lấy đúng dòng [AI] class= để đọc độ tin cậy và tư thế
          const aiLines = lines.filter(l => l.includes('[AI] class='));
          if (aiLines.length > 0) {
            parseSerialLine(aiLines[aiLines.length - 1].trim());
            lastRenderTime = now;
          }
        }
      }
    } catch (error) {
      console.error('Lỗi đọc Serial:', error);
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
    if (connectionType === 'BLE') disconnectBLE();
    if (connectionType === 'USB') disconnectSerial();
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
          Mở Cấp Quyền Âm Thanh
        </button>
      )}

      <div className="header">
        <h1>CarePosture AI</h1>
        <p>Hỗ trợ BLE Không Dây và Cáp USB</p>
      </div>

      {connectionStatus !== 'Connected' ? (
        <div className="connect-prompt">
          <div className="status-icon" style={{ marginBottom: '2rem' }}>📡</div>
          <h2>Chưa kết nối thiết bị</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Vui lòng bật ESP32 hoặc cắm vào máy tính, sau đó chọn phương thức kết nối.
          </p>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={connectBLE} className="audio-btn" style={{ position: 'relative', top: 0, right: 0, fontSize: '1.1rem', padding: '12px 24px', background: 'rgba(16, 185, 129, 0.2)', borderColor: 'rgba(16, 185, 129, 0.5)', color: '#10b981' }}>
              📡 Kết Nối BLE (Không dây)
            </button>
            <button onClick={connectSerial} className="audio-btn" style={{ position: 'relative', top: 0, right: 0, fontSize: '1.1rem', padding: '12px 24px' }}>
              🔌 Kết Nối USB (Có dây)
            </button>
            <button onClick={() => {
              setConnectionStatus('Connected');
              setConnectionType('USB');
              parseSerialLine('[AI] class=1,posture=bad_posture,confidence=0.8500');
            }} className="audio-btn" style={{ position: 'relative', top: 0, right: 0, fontSize: '1.1rem', padding: '12px 24px', background: '#3b82f6', borderColor: '#2563eb' }}>
              🧪 Test Giao Diện (Mock)
            </button>
          </div>
        </div>
      ) : (
        <div className="main-content">
          {/* Left Side: 2D Model */}
          <div className={`model-container ${statusClass}`}>
            <img src="/back_muscles.png" alt="Back Muscles" className="body-model" />
            <div className="sensor-point c7"><div className="pulse"></div><span className="label">C7</span></div>
            <div className="sensor-point t5"><div className="pulse"></div><span className="label">T5</span></div>
            <div className="sensor-point l3"><div className="pulse"></div><span className="label">L3</span></div>
            <div className="sensor-point ls"><div className="pulse"></div><span className="label">LS</span></div>
            <div className="sensor-point rs"><div className="pulse"></div><span className="label">RS</span></div>
          </div>

          {/* Right Side: Posture Status */}
          <div className={`posture-card ${statusClass}`}>
            <div className="status-icon">
              {isNormal ? '✓' : '⚠️'}
            </div>
            <h2 className="posture-name">
              <span>{postureInfo.title}</span>
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', marginTop: '-1rem', marginBottom: '1.5rem', fontWeight: 500 }}>
              <span>{postureInfo.subtitle}</span>
            </p>
            <div className="confidence" style={{ marginBottom: '1.5rem' }}>
              <span>Độ tin cậy: {(confidence * 100).toFixed(1)}%</span>
            </div>
            
            <div className="posture-details" style={{ textAlign: 'left', background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '12px' }}>
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: postureInfo.safe ? '#10b981' : '#f43f5e' }}>
                  <span>Cảnh báo:</span>
                </strong> 
                <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.9rem', lineHeight: '1.5', letterSpacing: '0.5px' }}>{postureInfo.alert}</span>
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <strong style={{ color: 'var(--text-muted)' }}><span>Vùng ảnh hưởng:</span></strong> 
                <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.9rem' }}>{postureInfo.affected}</span>
              </div>
              <div>
                <strong style={{ color: 'var(--text-muted)' }}><span>Lời khuyên:</span></strong> 
                <span style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.9rem', lineHeight: '1.5' }}>{postureInfo.reminder}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="connection-status">
        <div className={`status-dot ${connectionStatus === 'Connected' ? 'connected' : connectionStatus === 'Error' ? 'error' : ''}`}></div>
        <span>
          {connectionStatus === 'Disconnected' && <span>Chưa kết nối</span>}
          {connectionStatus === 'Connecting' && <span>Đang kết nối {connectionType}...</span>}
          {connectionStatus === 'Connected' && <span>Đã kết nối trực tiếp ({connectionType})</span>}
          {connectionStatus === 'Error' && <span>Mất kết nối / Lỗi</span>}
        </span>
        
        {connectionStatus === 'Connected' && (
          <button onClick={disconnectAll} style={{ marginLeft: '10px', background: 'transparent', border: '1px solid white', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>
            Ngắt kết nối
          </button>
        )}
      </div>
    </div>
  );
}

export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
