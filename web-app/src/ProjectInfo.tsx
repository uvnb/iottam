import React from 'react';

export default function ProjectInfo() {
  return (
    <div className="project-info-card" style={{
      background: 'rgba(5, 12, 25, 0.85)',
      backdropFilter: 'blur(16px)',
      WebkitBackdropFilter: 'blur(16px)',
      padding: '3rem',
      borderRadius: '24px',
      border: '1px solid rgba(0, 210, 255, 0.2)',
      boxShadow: '0 30px 60px rgba(0,0,0,0.6), inset 0 0 20px rgba(0, 210, 255, 0.05)',
      textAlign: 'left',
      color: 'var(--text-main)',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      gap: '2rem'
    }}>
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '2rem' }}>
        <h1 style={{ 
          color: 'var(--accent-normal)', 
          fontSize: '2.8rem', 
          marginBottom: '0.8rem', 
          textTransform: 'uppercase', 
          letterSpacing: '2px', 
          textShadow: '0 0 20px rgba(0, 210, 255, 0.4)',
          lineHeight: '1.2'
        }}>
          DMT Smart Posture Shirt
        </h1>
        <h3 style={{ 
          color: 'var(--accent-alert)', 
          fontSize: '1.3rem', 
          fontWeight: 'normal', 
          letterSpacing: '1px',
          opacity: 0.9
        }}>
          Next-Generation AIoT Wearable System for Real-Time Biomechanical Analysis
        </h3>
        
        <p style={{ 
          lineHeight: '1.8', 
          marginTop: '1.5rem', 
          fontSize: '1.1rem', 
          color: 'rgba(255,255,255,0.85)' 
        }}>
          The <strong>DMT Smart Posture Shirt</strong> is a cutting-edge wearable ecosystem developed as the core of the <strong>CareBot AIoT project</strong>. Unlike traditional rigid braces, our smart fabric incorporates <strong>5 ultra-precise MPU6050 motion sensors</strong> strategically placed along the kinetic chain of your upper body. It acts as a digital twin of your spine, continuously monitoring your biomechanics with zero discomfort.
        </p>
        
        <p style={{ 
          lineHeight: '1.8', 
          marginTop: '1rem', 
          fontSize: '1.1rem', 
          color: 'rgba(255,255,255,0.85)' 
        }}>
          Powered by an embedded <strong>Edge AI platform (TinyML)</strong>, the system analyzes complex spatio-temporal data in real-time, instantly identifying biomechanical deviations before they cause chronic pain. The seamless Bluetooth Low Energy (BLE) integration ensures zero-latency transmission to the CareBot dashboard, providing actionable insights for physical therapy, ergonomic correction, and long-term musculoskeletal health.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(0, 210, 255, 0.15)', transition: 'transform 0.3s ease' }} className="hover-lift">
          <h4 style={{ color: 'var(--accent-normal)', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>📡</span> 5-Point Biomechanical Sensing
          </h4>
          <ul style={{ color: 'var(--text-muted)', paddingLeft: '1.2rem', lineHeight: '1.8', margin: 0, fontSize: '0.95rem' }}>
            <li><strong>C7 (Neck):</strong> Cervical stress tracking</li>
            <li><strong>Left/Right Shoulders:</strong> Asymmetry & load distribution</li>
            <li><strong>T5 (Mid Back):</strong> Thoracic kyphosis monitoring</li>
            <li><strong>L3 (Lower Back):</strong> Lumbar flexion & lifting mechanics</li>
          </ul>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(0, 210, 255, 0.15)', transition: 'transform 0.3s ease' }} className="hover-lift">
          <h4 style={{ color: 'var(--accent-normal)', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>🧠</span> Edge AI TinyML Processing
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.7', margin: 0 }}>
            Computes <strong>18 complex motion features</strong> directly on the ESP32 microcontroller via UART. By running inference locally, it eliminates cloud latency and ensures complete data privacy for the user.
          </p>
        </div>

        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(0, 210, 255, 0.15)', transition: 'transform 0.3s ease' }} className="hover-lift">
          <h4 style={{ color: 'var(--accent-normal)', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>🎯</span> 6-Class Posture Recognition
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.7', margin: 0 }}>
            Accurately classifies <strong>Normal Idle, Bending, Correct Lifting, Hazardous Lifting, Bad Posture, and Shoulder Asymmetry</strong> with laboratory-tested high precision.
          </p>
        </div>
        
        <div style={{ background: 'rgba(0,0,0,0.5)', padding: '1.5rem', borderRadius: '16px', border: '1px solid rgba(0, 210, 255, 0.15)', transition: 'transform 0.3s ease' }} className="hover-lift">
          <h4 style={{ color: 'var(--accent-normal)', marginBottom: '1rem', fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '1.5rem' }}>⚡</span> Ultra-Low Latency Ecosystem
          </h4>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: '1.7', margin: 0 }}>
            Real-time I2C multiplexing (TCA9548) and BLE bridging feeds instant feedback to the CareBot visual dashboard, enabling immediate postural correction.
          </p>
        </div>
      </div>

      <div style={{ 
        background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)', 
        padding: '1.5rem 2rem', 
        borderRadius: '16px', 
        borderLeft: '4px solid #10b981',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.8rem'
      }}>
        <h4 style={{ color: '#10b981', margin: 0, fontSize: '1.1rem', letterSpacing: '1px' }}>⚙️ FULL SYSTEM ARCHITECTURE</h4>
        <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: '1.05rem', lineHeight: '1.6', fontFamily: 'monospace', margin: 0, overflowWrap: 'break-word' }}>
          [5x MPU6050] ➔ (I²C) ➔ [TCA9548] ➔ (I²C) ➔ [ESP32 Core] ➔ (UART) ➔ [TinyML Engine] ➔ (BLE) ➔ [CareBot Server / Web App]
        </p>
      </div>

      <blockquote style={{ 
        borderLeft: '4px solid var(--accent-alert)', 
        margin: 0, 
        padding: '1.8rem', 
        background: 'linear-gradient(90deg, rgba(255, 51, 102, 0.1) 0%, rgba(255, 51, 102, 0) 100%)', 
        fontStyle: 'italic', 
        color: 'rgba(255,255,255,0.9)', 
        borderRadius: '0 16px 16px 0',
        fontSize: '1.1rem',
        lineHeight: '1.6'
      }}>
        "The DMT Smart Posture Shirt transforms raw biomechanical data into real-time AI insights, enabling intelligent, proactive posture monitoring as a foundational pillar of the CareBot AIoT ecosystem."
        <br/><br/>
        <strong style={{ color: 'var(--accent-alert)', fontStyle: 'normal', fontSize: '1.2rem', letterSpacing: '1px' }}>DMT TECHNOLOGY — SMARTER HEALTH, BETTER LIFE.</strong>
      </blockquote>
    </div>
  );
}
