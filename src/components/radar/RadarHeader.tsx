'use client';

import { useState, useEffect } from 'react';
import { Info, Radio } from 'lucide-react';

interface RadarHeaderProps {
  trackingCount: number;
  updateInterval: number;
  isConnected: boolean;
}

export function RadarHeader({ trackingCount, updateInterval, isConnected }: RadarHeaderProps) {
  const [time, setTime] = useState<string>('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();
      const hours = now.getUTCHours().toString().padStart(2, '0');
      const minutes = now.getUTCMinutes().toString().padStart(2, '0');
      const seconds = now.getUTCSeconds().toString().padStart(2, '0');
      setTime(`${hours}:${minutes}:${seconds}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) {
    return (
      <header className="radar-header">
        <div className="radar-header-left">
          <div className="radar-logo">
            <Radio className="w-8 h-8 text-primary" />
            <div>
              <h1 className="radar-title">OSINT RADAR</h1>
              <span className="radar-version">V1.0</span>
            </div>
          </div>
          <button className="radar-info-btn">
            <Info className="w-4 h-4" />
          </button>
        </div>
        <div className="radar-header-right">
          <div className="radar-clock">
            <span className="radar-time">--:--:--</span>
            <span className="radar-time-label">UTC</span>
          </div>
          <div className="radar-status">
            <span className="radar-status-dot" />
            <span className="radar-status-text">CONNECTING</span>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="radar-header">
      <div className="radar-header-left">
        <div className="radar-logo">
          <Radio className="w-8 h-8 text-primary" />
          <div>
            <h1 className="radar-title">OSINT RADAR</h1>
            <span className="radar-version">V1.0</span>
          </div>
        </div>
        <button className="radar-info-btn" title="About">
          <Info className="w-4 h-4" />
        </button>
      </div>

      <div className="radar-header-center">
        <div className="radar-stats">
          <span className="radar-stat">
            TRACKING: <strong>{trackingCount}</strong>
          </span>
          <span className="radar-stat-divider">|</span>
          <span className="radar-stat">
            UPD: <strong>{updateInterval}S</strong>
          </span>
        </div>
      </div>

      <div className="radar-header-right">
        <div className="radar-clock">
          <span className="radar-time">{time}</span>
          <span className="radar-time-label">UTC</span>
        </div>
        <div className={`radar-status ${isConnected ? 'online' : 'offline'}`}>
          <span className="radar-status-dot" />
          <span className="radar-status-text">
            {isConnected ? 'SYSTEM ONLINE' : 'OFFLINE'}
          </span>
        </div>
      </div>
    </header>
  );
}
