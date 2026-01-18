/**
 * Pattern detection math utilities
 * Provides geometric analysis functions for aircraft flight patterns
 */

export interface Point {
  lat: number;
  lon: number;
  timestamp?: number;
  heading?: number;
  altitude?: number;
}

export interface CircleFit {
  center: { lat: number; lon: number };
  radius: number;
  error: number;
  confidence: number;
}

export interface HeadingReversal {
  index: number;
  point: Point;
  headingBefore: number;
  headingAfter: number;
  angleDelta: number;
}

export interface AngularVelocityResult {
  averageVelocity: number; // degrees per minute
  direction: 'clockwise' | 'counterclockwise' | 'indeterminate';
  consistency: number; // 0-1, how consistent the turn rate is
}

// Earth's radius in nautical miles
const EARTH_RADIUS_NM = 3440.065;

/**
 * Convert degrees to radians
 */
export function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate distance between two points in nautical miles using Haversine formula
 */
export function haversineDistance(p1: Point, p2: Point): number {
  const lat1 = toRadians(p1.lat);
  const lat2 = toRadians(p2.lat);
  const dLat = toRadians(p2.lat - p1.lat);
  const dLon = toRadians(p2.lon - p1.lon);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_NM * c;
}

/**
 * Calculate bearing from point 1 to point 2
 */
export function calculateBearing(p1: Point, p2: Point): number {
  const lat1 = toRadians(p1.lat);
  const lat2 = toRadians(p2.lat);
  const dLon = toRadians(p2.lon - p1.lon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = toDegrees(Math.atan2(y, x));

  return (bearing + 360) % 360;
}

/**
 * Normalize angle difference to -180 to 180
 */
export function normalizeAngleDelta(delta: number): number {
  while (delta > 180) delta -= 360;
  while (delta < -180) delta += 360;
  return delta;
}

/**
 * Calculate the centroid of a set of points
 */
export function calculateCentroid(points: Point[]): Point {
  if (points.length === 0) {
    throw new Error('Cannot calculate centroid of empty point set');
  }

  // Convert to Cartesian for more accurate centroid
  let x = 0, y = 0, z = 0;

  for (const p of points) {
    const latRad = toRadians(p.lat);
    const lonRad = toRadians(p.lon);
    x += Math.cos(latRad) * Math.cos(lonRad);
    y += Math.cos(latRad) * Math.sin(lonRad);
    z += Math.sin(latRad);
  }

  const n = points.length;
  x /= n;
  y /= n;
  z /= n;

  const lon = Math.atan2(y, x);
  const hyp = Math.sqrt(x * x + y * y);
  const lat = Math.atan2(z, hyp);

  return {
    lat: toDegrees(lat),
    lon: toDegrees(lon),
  };
}

/**
 * Fit a circle to a set of points using least-squares method
 * Returns the center, radius, and fit quality
 */
export function fitCircle(points: Point[]): CircleFit {
  if (points.length < 3) {
    throw new Error('Need at least 3 points to fit a circle');
  }

  // Initial estimate: centroid as center
  const centroid = calculateCentroid(points);

  // Iterative refinement (simplified Levenberg-Marquardt)
  let centerLat = centroid.lat;
  let centerLon = centroid.lon;
  const maxIterations = 50;
  const convergenceThreshold = 0.001;

  for (let iter = 0; iter < maxIterations; iter++) {
    const center = { lat: centerLat, lon: centerLon };
    const distances = points.map(p => haversineDistance(center, p));
    const avgRadius = distances.reduce((a, b) => a + b, 0) / distances.length;

    // Calculate gradient
    let gradLat = 0, gradLon = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const d = distances[i];
      const error = d - avgRadius;
      const bearing = calculateBearing(center, p);
      const bearingRad = toRadians(bearing);

      gradLat += error * Math.cos(bearingRad) / distances.length;
      gradLon += error * Math.sin(bearingRad) / distances.length;
    }

    // Update center (with small step size)
    const stepSize = 0.1;
    const newLat = centerLat - gradLat * stepSize / 60; // Convert nm to degrees approx
    const newLon = centerLon - gradLon * stepSize / (60 * Math.cos(toRadians(centerLat)));

    if (Math.abs(newLat - centerLat) < convergenceThreshold &&
        Math.abs(newLon - centerLon) < convergenceThreshold) {
      break;
    }

    centerLat = newLat;
    centerLon = newLon;
  }

  // Calculate final radius and error
  const finalCenter = { lat: centerLat, lon: centerLon };
  const finalDistances = points.map(p => haversineDistance(finalCenter, p));
  const finalRadius = finalDistances.reduce((a, b) => a + b, 0) / finalDistances.length;

  // Calculate mean squared error
  const mse = finalDistances.reduce((sum, d) => sum + Math.pow(d - finalRadius, 2), 0) / points.length;
  const rmse = Math.sqrt(mse);

  // Calculate confidence based on RMSE relative to radius
  // Perfect circle has RMSE = 0, confidence = 1
  const relativeError = rmse / finalRadius;
  const confidence = Math.max(0, Math.min(1, 1 - relativeError * 2));

  return {
    center: finalCenter,
    radius: finalRadius,
    error: rmse,
    confidence,
  };
}

/**
 * Find heading reversals (180° turns) in a track
 */
export function findHeadingReversals(
  points: Point[],
  minReversalAngle: number = 150,
  maxReversalAngle: number = 210
): HeadingReversal[] {
  const reversals: HeadingReversal[] = [];

  if (points.length < 3) return reversals;

  // Calculate headings between consecutive points
  const headings: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    headings.push(calculateBearing(points[i], points[i + 1]));
  }

  // Find significant heading changes
  const windowSize = 3; // Look at heading change over 3 segments
  for (let i = windowSize; i < headings.length - windowSize; i++) {
    const headingBefore = headings.slice(i - windowSize, i).reduce((a, b) => a + b, 0) / windowSize;
    const headingAfter = headings.slice(i, i + windowSize).reduce((a, b) => a + b, 0) / windowSize;

    const delta = Math.abs(normalizeAngleDelta(headingAfter - headingBefore));

    if (delta >= minReversalAngle && delta <= maxReversalAngle) {
      reversals.push({
        index: i,
        point: points[i],
        headingBefore,
        headingAfter,
        angleDelta: delta,
      });
    }
  }

  return reversals;
}

/**
 * Calculate angular velocity (turn rate) from position track
 */
export function calculateAngularVelocity(points: Point[]): AngularVelocityResult {
  if (points.length < 3 || !points[0].timestamp || !points[points.length - 1].timestamp) {
    return {
      averageVelocity: 0,
      direction: 'indeterminate',
      consistency: 0,
    };
  }

  // Calculate heading changes and their directions
  const headingChanges: number[] = [];
  const timeDeltas: number[] = [];

  for (let i = 1; i < points.length; i++) {
    const bearing1 = i > 1 ? calculateBearing(points[i - 2], points[i - 1]) : (points[i - 1].heading || 0);
    const bearing2 = calculateBearing(points[i - 1], points[i]);

    const delta = normalizeAngleDelta(bearing2 - bearing1);
    headingChanges.push(delta);

    if (points[i].timestamp && points[i - 1].timestamp) {
      timeDeltas.push((points[i].timestamp - points[i - 1].timestamp) / 60000); // Convert to minutes
    }
  }

  // Calculate average angular velocity
  let totalAngleChange = 0;
  let totalTime = 0;
  const instantVelocities: number[] = [];

  for (let i = 0; i < headingChanges.length; i++) {
    totalAngleChange += headingChanges[i];
    if (i < timeDeltas.length && timeDeltas[i] > 0) {
      totalTime += timeDeltas[i];
      instantVelocities.push(headingChanges[i] / timeDeltas[i]);
    }
  }

  const averageVelocity = totalTime > 0 ? Math.abs(totalAngleChange / totalTime) : 0;

  // Determine direction
  const positiveChanges = headingChanges.filter(c => c > 0).length;
  const negativeChanges = headingChanges.filter(c => c < 0).length;
  const direction: 'clockwise' | 'counterclockwise' | 'indeterminate' =
    positiveChanges > negativeChanges * 1.5 ? 'clockwise' :
    negativeChanges > positiveChanges * 1.5 ? 'counterclockwise' : 'indeterminate';

  // Calculate consistency (standard deviation relative to mean)
  if (instantVelocities.length < 2) {
    return { averageVelocity, direction, consistency: 0 };
  }

  const mean = instantVelocities.reduce((a, b) => a + b, 0) / instantVelocities.length;
  const variance = instantVelocities.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / instantVelocities.length;
  const stdDev = Math.sqrt(variance);
  const consistency = mean !== 0 ? Math.max(0, Math.min(1, 1 - stdDev / Math.abs(mean))) : 0;

  return {
    averageVelocity,
    direction,
    consistency,
  };
}

/**
 * Check if points form a confined area (for holding pattern detection)
 */
export function checkAreaConfinement(
  points: Point[],
  maxAreaNm2: number = 100
): { confined: boolean; boundingBox: { width: number; height: number }; area: number } {
  if (points.length < 2) {
    return { confined: false, boundingBox: { width: 0, height: 0 }, area: 0 };
  }

  // Find bounding box
  const lats = points.map(p => p.lat);
  const lons = points.map(p => p.lon);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  // Calculate approximate dimensions in nm
  const heightNm = haversineDistance({ lat: minLat, lon: (minLon + maxLon) / 2 }, { lat: maxLat, lon: (minLon + maxLon) / 2 });
  const avgLat = (minLat + maxLat) / 2;
  const widthNm = haversineDistance({ lat: avgLat, lon: minLon }, { lat: avgLat, lon: maxLon });

  const area = widthNm * heightNm;
  const confined = area <= maxAreaNm2;

  return {
    confined,
    boundingBox: { width: widthNm, height: heightNm },
    area,
  };
}

/**
 * Detect racetrack pattern parameters
 */
export function detectRacetrackParams(points: Point[]): {
  detected: boolean;
  legLength: number;
  legWidth: number;
  heading1: number;
  heading2: number;
  numLegs: number;
  confidence: number;
} | null {
  const reversals = findHeadingReversals(points);

  if (reversals.length < 2) {
    return null;
  }

  // Check if reversals are roughly 180° apart and consistent
  const headings: number[] = [];
  for (const r of reversals) {
    headings.push(r.headingBefore);
    headings.push(r.headingAfter);
  }

  // Group headings into two clusters (should be ~180° apart for racetrack)
  const heading1 = headings[0];
  const cluster1 = headings.filter(h => Math.abs(normalizeAngleDelta(h - heading1)) < 30);
  const cluster2 = headings.filter(h => Math.abs(normalizeAngleDelta(h - heading1)) >= 150);

  if (cluster2.length < 2) {
    return null;
  }

  const avgHeading1 = cluster1.reduce((a, b) => a + b, 0) / cluster1.length;
  const avgHeading2 = cluster2.reduce((a, b) => a + b, 0) / cluster2.length;

  // Calculate leg lengths (distance between consecutive reversals)
  const legLengths: number[] = [];
  for (let i = 1; i < reversals.length; i++) {
    legLengths.push(haversineDistance(reversals[i - 1].point, reversals[i].point));
  }

  const avgLegLength = legLengths.reduce((a, b) => a + b, 0) / legLengths.length;

  // Calculate leg width from bounding box
  const confinement = checkAreaConfinement(points);

  // Calculate confidence based on heading consistency and leg length consistency
  const headingDiff = Math.abs(normalizeAngleDelta(avgHeading2 - avgHeading1));
  const headingConfidence = headingDiff >= 170 && headingDiff <= 190 ? 1 : Math.max(0, 1 - Math.abs(headingDiff - 180) / 30);

  const legLengthVariance = legLengths.reduce((sum, l) => sum + Math.pow(l - avgLegLength, 2), 0) / legLengths.length;
  const legLengthStdDev = Math.sqrt(legLengthVariance);
  const legConsistency = avgLegLength > 0 ? Math.max(0, 1 - legLengthStdDev / avgLegLength) : 0;

  const confidence = (headingConfidence * 0.6 + legConsistency * 0.4);

  return {
    detected: confidence > 0.5,
    legLength: avgLegLength,
    legWidth: Math.min(confinement.boundingBox.width, confinement.boundingBox.height),
    heading1: avgHeading1,
    heading2: avgHeading2,
    numLegs: reversals.length + 1,
    confidence,
  };
}
