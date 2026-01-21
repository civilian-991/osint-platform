'use client';

import { X } from 'lucide-react';
import { getFlagFromHex, getCountryNameFromHex } from '@/lib/utils/country-flags';
import { getAircraftPrior } from '@/lib/knowledge/aircraft-priors';
import type { PositionLatest } from '@/lib/types/aircraft';

interface AircraftInfoPanelProps {
  position: PositionLatest | null;
  onClose: () => void;
}

export function AircraftInfoPanel({ position, onClose }: AircraftInfoPanelProps) {
  if (!position) {
    return (
      <div className="aircraft-panel empty">
        <div className="aircraft-panel-header">
          <span className="aircraft-panel-title">N/A</span>
        </div>
        <div className="aircraft-panel-subtitle">
          <span className="hex">HEX: N/A</span>
        </div>
        <div className="aircraft-panel-telemetry">
          <div className="telemetry-box">
            <span className="telemetry-label">ALT</span>
            <span className="telemetry-value">---</span>
          </div>
          <div className="telemetry-box">
            <span className="telemetry-label">SPD</span>
            <span className="telemetry-value">---</span>
          </div>
          <div className="telemetry-box">
            <span className="telemetry-label">SQK</span>
            <span className="telemetry-value">---</span>
          </div>
          <div className="telemetry-box">
            <span className="telemetry-label">HDG</span>
            <span className="telemetry-value">---</span>
          </div>
        </div>
        <div className="aircraft-panel-details">
          <div className="detail-row">
            <span className="detail-label">Type:</span>
            <span className="detail-value"></span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Reg:</span>
            <span className="detail-value"></span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Op:</span>
            <span className="detail-value"></span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Pos:</span>
            <span className="detail-value"></span>
          </div>
        </div>
      </div>
    );
  }

  const flag = getFlagFromHex(position.icao_hex || '');
  const countryName = getCountryNameFromHex(position.icao_hex || '');
  const typeCode = position.aircraft?.type_code || '';
  const prior = getAircraftPrior(typeCode);
  const aircraftName = prior?.name || position.aircraft?.type_description || typeCode;

  return (
    <div className="aircraft-panel">
      <div className="aircraft-panel-header">
        <div className="aircraft-panel-title-row">
          <span className="flag">{flag}</span>
          <span className="aircraft-panel-title">
            {position.callsign || 'N/A'}
          </span>
        </div>
        <button className="aircraft-panel-close" onClick={onClose}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="aircraft-panel-subtitle">
        <span className="hex">HEX: {position.icao_hex || 'N/A'}</span>
        {aircraftName && (
          <span className="aircraft-name">| {aircraftName}</span>
        )}
      </div>

      <div className="aircraft-panel-telemetry">
        <div className="telemetry-box">
          <span className="telemetry-label">ALT</span>
          <span className="telemetry-value">
            {position.altitude?.toLocaleString() || '---'}
          </span>
        </div>
        <div className="telemetry-box">
          <span className="telemetry-label">SPD</span>
          <span className="telemetry-value">
            {position.ground_speed || '---'}
          </span>
        </div>
        <div className="telemetry-box">
          <span className="telemetry-label">SQK</span>
          <span className="telemetry-value">
            {position.squawk || '---'}
          </span>
        </div>
        <div className="telemetry-box">
          <span className="telemetry-label">HDG</span>
          <span className="telemetry-value">
            {position.track?.toFixed(1) || '---'}
          </span>
        </div>
      </div>

      <div className="aircraft-panel-details">
        <div className="detail-row">
          <span className="detail-label">Type:</span>
          <span className="detail-value type-value">{typeCode || '-'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Reg:</span>
          <span className="detail-value">{position.aircraft?.registration || '-'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Op:</span>
          <span className="detail-value">{position.aircraft?.operator || countryName}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Pos:</span>
          <span className="detail-value">
            {position.latitude && position.longitude
              ? `${position.latitude.toFixed(4)}, ${position.longitude.toFixed(4)}`
              : '-'}
          </span>
        </div>
      </div>

      {position.vertical_rate && Math.abs(position.vertical_rate) > 100 && (
        <div className="aircraft-panel-vrate">
          <span className={position.vertical_rate > 0 ? 'climbing' : 'descending'}>
            {position.vertical_rate > 0 ? '↑' : '↓'} {Math.abs(position.vertical_rate).toLocaleString()} ft/min
          </span>
        </div>
      )}
    </div>
  );
}
