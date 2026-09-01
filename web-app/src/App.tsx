import { useState, useRef, useEffect } from 'react';
import './index.css';

// The 6 posture classes (matching typical posture AI)
const POSTURE_CLASSES = [
  "Bình thường", // 0
  "Gù lưng (Kyphosis)", // 1
  "Vẹo cột sống trái", // 2
  "Vẹo cột sống phải", // 3
  "Ngả người về trước", // 4
  "Ngả người ra sau" // 5
];

function App() {
  const [connectionStatus, setConnectionStatus] = useState<'Disconnected' | 'Connecting' | 'Connected' | 'Error'>('Disconnected');
  const [currentPosture, setCurrentPosture] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Web Serial Port Reference
  const portRef = useRef<any>(null);
  const readerRef = useRef<any>(null);

  // Initialize Web Audio API for a simple beep sound
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

  // -------------------------------------------------------------
  // WEB SERIAL API LOGIC
  // -------------------------------------------------------------
  const connectSerial = async () => {
    if (!('serial' in navigator)) {
      alert('Trình duyệt của bạn không hỗ trợ Web Serial API. Vui lòng sử dụng Google Chrome hoặc Microsoft Edge trên máy tính.');
      return;
    }

    try {
      setConnectionStatus('Connecting');
      
      // Prompt user to select an ESP32 port
      const port = await (navigator as any).serial.requestPort();
      await port.open({ baudRate: 115200 }); // ESP32 is set to 115200 in the .ino file
      
      portRef.current = port;
      setConnectionStatus('Connected');
      
      // Auto-enable audio context on user interaction (if not already enabled)
      if (!audioCtxRef.current) {
         initAudio();
      }

      readSerialData(port);
      
    } catch (err) {
      console.error('Lỗi kết nối Serial:', err);
      setConnectionStatus('Error');
    }
  };

  const disconnectSerial = async () => {
    if (readerRef.current) {
      await readerRef.current.cancel();
    }
    if (portRef.current) {
      await portRef.current.close();
    }
    portRef.current = null;
    setConnectionStatus('Disconnected');
  };

  const readSerialData = async (port: any) => {
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();
    readerRef.current = reader;

    let buffer = '';

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break; // reader has been canceled
        }
        
        buffer += value;
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          parseSerialLine(line.trim());
        }
      }
    } catch (error) {
      console.error('Lỗi đọc dữ liệu Serial:', error);
      setConnectionStatus('Error');
    } finally {
      reader.releaseLock();
    }
  };

  const parseSerialLine = (line: string) => {
    // Ignore headers and debug comments starting with #
    if (line.startsWith('t_ms') || line.startsWith('#') || line.length === 0) {
      return;
    }

    // Format expected (from PostureAI_Realtime_TFLM.ino):
    // t_ms, C7_pitch, C7_roll, LS_pitch, LS_roll, RS_pitch, RS_roll, T5_pitch, T5_roll, L3_pitch, L3_roll, predIndex, label, confidence
    const parts = line.split(',');
    
    // There are 1 time + 10 angles + 3 prediction details = 14 columns
    if (parts.length >= 14) {
      const predIndex = parseInt(parts[11], 10);
      // const label = parts[12];
      const conf = parseFloat(parts[13]);

      if (!isNaN(predIndex) && !isNaN(conf)) {
        setCurrentPosture(prev => {
          // If state changes from normal to abnormal, play sound
          if (prev === 0 && predIndex !== 0) {
            playAlertSound();
          }
          return predIndex;
        });
        setConfidence(conf);
      }
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (portRef.current) {
        disconnectSerial();
      }
    };
  }, []);

  const isNormal = currentPosture === 0;
  const statusClass = connectionStatus === 'Connected' ? (isNormal ? 'normal' : 'alert') : '';
  
  return (
    <div className="app-container">
      {/* Ask user to enable audio manually if they haven't */}
      {!audioEnabled && connectionStatus === 'Disconnected' && (
        <button className="audio-btn" onClick={initAudio} style={{ top: '6rem' }}>
          Mở Cấp Quyền Âm Thanh
        </button>
      )}

      <div className="header">
        <h1>CarePosture AI</h1>
        <p>Theo dõi 5 điểm cảm biến trên cơ lưng</p>
      </div>

      {connectionStatus !== 'Connected' ? (
        <div className="connect-prompt">
          <div className="status-icon" style={{ marginBottom: '2rem' }}>🔌</div>
          <h2>Chưa kết nối thiết bị</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Vui lòng cắm ESP32 vào cổng USB máy tính của bạn và bấm nút bên dưới.
          </p>
          <button 
            onClick={connectSerial} 
            className="audio-btn" 
            style={{ position: 'relative', top: 0, right: 0, fontSize: '1.2rem', padding: '15px 30px' }}
          >
            Kết Nối Thiết Bị (USB)
          </button>
        </div>
      ) : (
        <div className="main-content">
          {/* Left Side: 2D Model with Sensors */}
          <div className={`model-container ${statusClass}`}>
            <img src="/back_muscles.png" alt="Back Muscles" className="body-model" />
            
            {/* Sensor points mapped to the image */}
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
          {connectionStatus === 'Disconnected' && 'Chưa cắm USB'}
          {connectionStatus === 'Connecting' && 'Đang kết nối cổng COM...'}
          {connectionStatus === 'Connected' && 'Đã kết nối trực tiếp (115200 baud)'}
          {connectionStatus === 'Error' && 'Mất kết nối / Lỗi cổng'}
        </span>
        
        {connectionStatus === 'Connected' && (
          <button onClick={disconnectSerial} style={{ marginLeft: '10px', background: 'transparent', border: '1px solid white', color: 'white', borderRadius: '4px', cursor: 'pointer' }}>
            Ngắt kết nối
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
