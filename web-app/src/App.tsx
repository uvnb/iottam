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

const POSTURE_CLASSES = [
  "Bình thường", 
  "Gù lưng (Kyphosis)", 
  "Vẹo cột sống trái", 
  "Vẹo cột sống phải", 
  "Ngả người về trước", 
  "Ngả người ra sau" 
];

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const CHARACTERISTIC_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";

function App() {
  const [connectionStatus, setConnectionStatus] = useState<'Disconnected' | 'Connecting' | 'Connected' | 'Error'>('Disconnected');
  const [connectionType, setConnectionType] = useState<'USB' | 'BLE' | null>(null);
  
  const [currentPosture, setCurrentPosture] = useState<number>(0);
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

    // Hỗ trợ định dạng gốc của user: "[AI] class=4,posture=normal_idle,confidence=1.0000"
    if (line.includes('[AI] class=')) {
      const classMatch = line.match(/class=(\d+)/);
      const confMatch = line.match(/confidence=([\d\.]+)/);
      if (classMatch && confMatch) {
        let predIndex = parseInt(classMatch[1], 10);
        const conf = parseFloat(confMatch[1]);
        
        // Theo chuẩn ESP32 của user, class=4 có vẻ là normal_idle (Bình thường).
        // Ta cần map lại cho khớp với POSTURE_CLASSES (Bình thường = 0).
        if (line.includes('normal_idle')) predIndex = 0;

        setCurrentPosture(prev => {
          if (prev === 0 && predIndex !== 0) playAlertSound();
          return predIndex;
        });
        setConfidence(conf);
      }
      return;
    }

    // Hỗ trợ định dạng CSV do web sinh ra: "t_ms, angle1, ..., predIndex, label, confidence"
    if (line.startsWith('t_ms') || line.startsWith('#')) return;
    const parts = line.split(',');
    if (parts.length >= 14) {
      const predIndex = parseInt(parts[11], 10);
      const conf = parseFloat(parts[13]);

      if (!isNaN(predIndex) && !isNaN(conf)) {
        setCurrentPosture(prev => {
          if (prev === 0 && predIndex !== 0) playAlertSound();
          return predIndex;
        });
        setConfidence(conf);
      }
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
        
        // Chống kẹt bộ đệm nếu mạch gửi rác không có dấu xuống dòng
        if (buffer.length > 10000) {
          buffer = buffer.slice(-1000); 
        }

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        const now = Date.now();
        // Chỉ xử lý dòng cuối cùng hợp lệ để tránh bị dội bom render (Throttle 100ms)
        if (lines.length > 0 && now - lastRenderTime > 100) {
          // Lấy dòng gần nhất có chứa dữ liệu AI thay vì xử lý toàn bộ
          const validLines = lines.filter(l => l.includes('[AI] class=') || l.split(',').length >= 14);
          if (validLines.length > 0) {
            parseSerialLine(validLines[validLines.length - 1].trim());
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

  const isNormal = currentPosture === 0;
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
              parseSerialLine('[AI] class=1,posture=kyphosis,confidence=0.8500');
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
              {POSTURE_CLASSES[currentPosture] || "Chưa xác định"}
            </h2>
            <div className="confidence">
              Độ tin cậy: {(confidence * 100).toFixed(1)}%
            </div>
            
            <div className="sensor-info">
              <h3>Trạng thái 5 cảm biến (IMU):</h3>
              <ul>
                <li><span className="dot"></span> C7: Cổ/Gáy</li>
                <li><span className="dot"></span> T5: Giữa lưng</li>
                <li><span className="dot"></span> L3: Thắt lưng</li>
                <li><span className="dot"></span> LS: Bả vai trái</li>
                <li><span className="dot"></span> RS: Bả vai phải</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="connection-status">
        <div className={`status-dot ${connectionStatus === 'Connected' ? 'connected' : connectionStatus === 'Error' ? 'error' : ''}`}></div>
        <span>
          {connectionStatus === 'Disconnected' && 'Chưa kết nối'}
          {connectionStatus === 'Connecting' && `Đang kết nối ${connectionType}...`}
          {connectionStatus === 'Connected' && `Đã kết nối trực tiếp (${connectionType})`}
          {connectionStatus === 'Error' && 'Mất kết nối / Lỗi'}
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
