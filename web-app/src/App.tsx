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
    
    // Create a harsh beep sound for bad posture
    const oscillator = audioCtxRef.current.createOscillator();
    const gainNode = audioCtxRef.current.createGain();
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(440, audioCtxRef.current.currentTime); // 440Hz
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
    // Connect to a public MQTT broker (using WebSockets)
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
  
  return (
    <div className={`app-container`}>
      {/* Ask user to enable audio (browsers block autoplay) */}
      {!audioEnabled && (
        <button className="audio-btn" onClick={initAudio}>
          Bật Âm Thanh Cảnh Báo
        </button>
      )}
      {audioEnabled && (
        <div className="audio-btn enabled">Âm thanh đã bật</div>
      )}

      <div className="header">
        <h1>CarePosture AI</h1>
        <p>Hệ thống giám sát và cảnh báo tư thế thời gian thực</p>
      </div>

      <div className={`posture-card ${isNormal ? 'normal' : 'alert'}`}>
        <div className="status-icon">
          {isNormal ? '✓' : '⚠️'}
        </div>
        <h2 className="posture-name">
          {POSTURE_CLASSES[currentPosture] || "Chưa xác định"}
        </h2>
        <div className="confidence">
          Độ tin cậy: {(confidence * 100).toFixed(1)}%
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
