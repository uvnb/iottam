import { useEffect, useState, useRef } from 'react';
import mqtt from 'mqtt';
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
  const [connectionStatus, setConnectionStatus] = useState<'Connecting' | 'Connected' | 'Error'>('Connecting');
  const [currentPosture, setCurrentPosture] = useState<number>(0);
  const [confidence, setConfidence] = useState<number>(0);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

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

  useEffect(() => {
    // Connect to a public MQTT broker
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt');

    client.on('connect', () => {
      setConnectionStatus('Connected');
      // Subscribe to a unique topic for this device
      client.subscribe('iottam/posture/live');
    });

    client.on('message', (topic, message) => {
      if (topic === 'iottam/posture/live') {
        try {
          const data = JSON.parse(message.toString());
          const newPosture = parseInt(data.posture, 10);
          const newConfidence = parseFloat(data.confidence || 0);
          
          setCurrentPosture(newPosture);
          setConfidence(newConfidence);
          
          // Play sound if not normal
          if (newPosture !== 0) {
            playAlertSound();
          }
        } catch (e) {
          console.error("Invalid MQTT message format", e);
        }
      }
    });

    client.on('error', () => {
      setConnectionStatus('Error');
    });

    client.on('offline', () => {
      setConnectionStatus('Connecting');
    });

    return () => {
      client.end();
    };
  }, [audioEnabled]);

  const isNormal = currentPosture === 0;
  const statusClass = isNormal ? 'normal' : 'alert';
  
  return (
    <div className="app-container">
      {/* Ask user to enable audio */}
      {!audioEnabled && (
        <button className="audio-btn" onClick={initAudio}>
          Bật Âm Thanh Cảnh Báo
        </button>
      )}

      <div className="header">
        <h1>CarePosture AI</h1>
        <p>Theo dõi 5 điểm cảm biến trên cơ lưng</p>
      </div>

      <div className="main-content">
        {/* Left Side: 2D Model with Sensors */}
        <div className={`model-container ${statusClass}`}>
          <img src="/back_muscles.png" alt="Back Muscles" className="body-model" />
          
          {/* Sensor points mapped to the image */}
          {/* C7 - Đốt sống cổ 7 */}
          <div className="sensor-point c7">
            <div className="pulse"></div>
            <span className="label">C7</span>
          </div>
          
          {/* T5 - Đốt sống ngực 5 */}
          <div className="sensor-point t5">
            <div className="pulse"></div>
            <span className="label">T5</span>
          </div>
          
          {/* L3 - Đốt sống thắt lưng 3 */}
          <div className="sensor-point l3">
            <div className="pulse"></div>
            <span className="label">L3</span>
          </div>
          
          {/* LS - Vai trái (Left Shoulder) */}
          <div className="sensor-point ls">
            <div className="pulse"></div>
            <span className="label">LS</span>
          </div>
          
          {/* RS - Vai phải (Right Shoulder) */}
          <div className="sensor-point rs">
            <div className="pulse"></div>
            <span className="label">RS</span>
          </div>
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

      <div className="connection-status">
        <div className={`status-dot ${connectionStatus === 'Connected' ? 'connected' : connectionStatus === 'Error' ? 'error' : ''}`}></div>
        <span>
          {connectionStatus === 'Connecting' && 'Đang kết nối MQTT...'}
          {connectionStatus === 'Connected' && 'Đã kết nối trực tiếp'}
          {connectionStatus === 'Error' && 'Mất kết nối'}
        </span>
      </div>
    </div>
  );
}

export default App;
