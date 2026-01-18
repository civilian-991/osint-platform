/**
 * Position Interpolator Service
 * Provides smooth interpolation between position frames for aircraft playback
 */

import type { PlaybackPosition, PlaybackFrame } from '@/lib/stores/playback-store';

// Earth radius in nautical miles
const EARTH_RADIUS_NM = 3440.065;

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Normalize angle to 0-360 range
 */
function normalizeAngle(angle: number): number {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

/**
 * Interpolate between two angles (handling wraparound)
 */
function interpolateAngle(a1: number, a2: number, t: number): number {
  // Normalize angles
  a1 = normalizeAngle(a1);
  a2 = normalizeAngle(a2);

  // Find the shortest path
  let diff = a2 - a1;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  return normalizeAngle(a1 + diff * t);
}

/**
 * Spherical interpolation between two lat/lon points
 * Uses great circle path for accurate geographic interpolation
 */
export function sphericalInterpolate(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  t: number
): { lat: number; lon: number } {
  // Convert to radians
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const lambda1 = toRadians(lon1);
  const lambda2 = toRadians(lon2);

  // Calculate angular distance
  const deltaPhi = phi2 - phi1;
  const deltaLambda = lambda2 - lambda1;

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const d = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // If points are very close, use linear interpolation
  if (d < 0.0001) {
    return {
      lat: lat1 + (lat2 - lat1) * t,
      lon: lon1 + (lon2 - lon1) * t,
    };
  }

  // Spherical interpolation
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);

  const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2);
  const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2);
  const z = A * Math.sin(phi1) + B * Math.sin(phi2);

  const phi = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lambda = Math.atan2(y, x);

  return {
    lat: toDegrees(phi),
    lon: toDegrees(lambda),
  };
}

/**
 * Linear interpolation between two values
 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate a single aircraft position between two frames
 */
export function interpolatePosition(
  p1: PlaybackPosition,
  p2: PlaybackPosition,
  t: number
): PlaybackPosition {
  // Interpolate geographic position using spherical interpolation
  const { lat, lon } = sphericalInterpolate(
    p1.latitude,
    p1.longitude,
    p2.latitude,
    p2.longitude,
    t
  );

  return {
    ...p1,
    latitude: lat,
    longitude: lon,
    altitude:
      p1.altitude !== null && p2.altitude !== null
        ? Math.round(lerp(p1.altitude, p2.altitude, t))
        : p1.altitude,
    ground_speed:
      p1.ground_speed !== null && p2.ground_speed !== null
        ? Math.round(lerp(p1.ground_speed, p2.ground_speed, t))
        : p1.ground_speed,
    track:
      p1.track !== null && p2.track !== null
        ? Math.round(interpolateAngle(p1.track, p2.track, t))
        : p1.track,
    // Use the later timestamp for interpolated positions
    timestamp: new Date(
      lerp(new Date(p1.timestamp).getTime(), new Date(p2.timestamp).getTime(), t)
    ).toISOString(),
  };
}

/**
 * Find matching positions between two frames by ICAO hex
 */
export function matchPositions(
  frame1: PlaybackFrame,
  frame2: PlaybackFrame
): Map<string, { p1: PlaybackPosition; p2: PlaybackPosition }> {
  const matches = new Map<string, { p1: PlaybackPosition; p2: PlaybackPosition }>();

  const frame2Map = new Map(frame2.positions.map((p) => [p.icao_hex, p]));

  for (const p1 of frame1.positions) {
    const p2 = frame2Map.get(p1.icao_hex);
    if (p2) {
      matches.set(p1.icao_hex, { p1, p2 });
    }
  }

  return matches;
}

/**
 * Interpolate between two frames at a given time
 * Returns interpolated positions for all aircraft present in both frames
 */
export function interpolateFrame(
  frame1: PlaybackFrame,
  frame2: PlaybackFrame,
  targetTime: number
): PlaybackPosition[] {
  const t1 = frame1.timestamp;
  const t2 = frame2.timestamp;

  // Calculate interpolation factor (0 = frame1, 1 = frame2)
  const t = (targetTime - t1) / (t2 - t1);

  if (t <= 0) return frame1.positions;
  if (t >= 1) return frame2.positions;

  const matches = matchPositions(frame1, frame2);
  const interpolated: PlaybackPosition[] = [];

  // Interpolate matched positions
  for (const { p1, p2 } of matches.values()) {
    interpolated.push(interpolatePosition(p1, p2, t));
  }

  // Include positions from frame1 that aren't in frame2 (aircraft that left)
  // with a fade-out effect (only if t < 0.5)
  if (t < 0.5) {
    const frame2Hexes = new Set(frame2.positions.map((p) => p.icao_hex));
    for (const p of frame1.positions) {
      if (!frame2Hexes.has(p.icao_hex)) {
        interpolated.push(p);
      }
    }
  }

  // Include positions from frame2 that aren't in frame1 (new aircraft)
  // with a fade-in effect (only if t > 0.5)
  if (t > 0.5) {
    const frame1Hexes = new Set(frame1.positions.map((p) => p.icao_hex));
    for (const p of frame2.positions) {
      if (!frame1Hexes.has(p.icao_hex)) {
        interpolated.push(p);
      }
    }
  }

  return interpolated;
}

/**
 * Calculate the distance between two points in nautical miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_NM * c;
}

/**
 * Calculate bearing from point 1 to point 2
 */
export function calculateBearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);

  const x = Math.cos(phi2) * Math.sin(deltaLambda);
  const y =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  return normalizeAngle(toDegrees(Math.atan2(x, y)));
}

/**
 * Smooth a series of positions using moving average
 */
export function smoothPositions(
  positions: PlaybackPosition[],
  windowSize: number = 3
): PlaybackPosition[] {
  if (positions.length <= windowSize) return positions;

  const smoothed: PlaybackPosition[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < positions.length; i++) {
    const start = Math.max(0, i - halfWindow);
    const end = Math.min(positions.length - 1, i + halfWindow);
    const window = positions.slice(start, end + 1);

    // Average the positions
    let latSum = 0;
    let lonSum = 0;
    let altSum = 0;
    let altCount = 0;
    let speedSum = 0;
    let speedCount = 0;

    for (const p of window) {
      latSum += p.latitude;
      lonSum += p.longitude;
      if (p.altitude !== null) {
        altSum += p.altitude;
        altCount++;
      }
      if (p.ground_speed !== null) {
        speedSum += p.ground_speed;
        speedCount++;
      }
    }

    smoothed.push({
      ...positions[i],
      latitude: latSum / window.length,
      longitude: lonSum / window.length,
      altitude: altCount > 0 ? Math.round(altSum / altCount) : null,
      ground_speed: speedCount > 0 ? Math.round(speedSum / speedCount) : null,
    });
  }

  return smoothed;
}
