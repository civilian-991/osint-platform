// Constants
const EARTH_RADIUS_NM = 3440.065; // Earth radius in nautical miles
const NM_TO_METERS = 1852;
const METERS_TO_NM = 1 / NM_TO_METERS;

// Convert degrees to radians
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Convert radians to degrees
function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

// Calculate distance between two points in nautical miles (Haversine formula)
export function distanceNm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_NM * c;
}

// Calculate bearing between two points
export function bearing(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);

  const x = Math.cos(lat2Rad) * Math.sin(dLon);
  const y =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);

  let bearing = toDegrees(Math.atan2(x, y));
  return (bearing + 360) % 360;
}

// Calculate destination point given start point, bearing, and distance
export function destination(
  lat: number,
  lon: number,
  bearingDeg: number,
  distanceNm: number
): { lat: number; lon: number } {
  const latRad = toRadians(lat);
  const lonRad = toRadians(lon);
  const bearingRad = toRadians(bearingDeg);
  const angularDistance = distanceNm / EARTH_RADIUS_NM;

  const destLatRad = Math.asin(
    Math.sin(latRad) * Math.cos(angularDistance) +
      Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(bearingRad)
  );

  const destLonRad =
    lonRad +
    Math.atan2(
      Math.sin(bearingRad) * Math.sin(angularDistance) * Math.cos(latRad),
      Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(destLatRad)
    );

  return {
    lat: toDegrees(destLatRad),
    lon: toDegrees(destLonRad),
  };
}

// Check if a point is within a circle
export function isWithinRadius(
  pointLat: number,
  pointLon: number,
  centerLat: number,
  centerLon: number,
  radiusNm: number
): boolean {
  return distanceNm(pointLat, pointLon, centerLat, centerLon) <= radiusNm;
}

// Create a bounding box around a center point
export function boundingBox(
  centerLat: number,
  centerLon: number,
  radiusNm: number
): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} {
  const latDelta = radiusNm / 60; // 1 degree of latitude ≈ 60 nm
  const lonDelta = radiusNm / (60 * Math.cos(toRadians(centerLat)));

  return {
    minLat: centerLat - latDelta,
    maxLat: centerLat + latDelta,
    minLon: centerLon - lonDelta,
    maxLon: centerLon + lonDelta,
  };
}

// Convert nautical miles to meters
export function nmToMeters(nm: number): number {
  return nm * NM_TO_METERS;
}

// Convert meters to nautical miles
export function metersToNm(meters: number): number {
  return meters * METERS_TO_NM;
}

// Format coordinates for display
export function formatCoordinates(
  lat: number,
  lon: number,
  format: 'decimal' | 'dms' = 'decimal'
): string {
  if (format === 'decimal') {
    return `${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
  }

  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';

  const formatDMS = (value: number): string => {
    const abs = Math.abs(value);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = ((minFloat - min) * 60).toFixed(1);
    return `${deg}°${min}'${sec}"`;
  };

  return `${formatDMS(lat)}${latDir} ${formatDMS(lon)}${lonDir}`;
}

// Format altitude for display
export function formatAltitude(altitudeFeet: number | null): string {
  if (altitudeFeet === null) return 'N/A';
  if (altitudeFeet === 0) return 'Ground';
  if (altitudeFeet >= 18000) {
    return `FL${Math.round(altitudeFeet / 100)}`;
  }
  return `${altitudeFeet.toLocaleString()} ft`;
}

// Format speed for display
export function formatSpeed(speedKnots: number | null): string {
  if (speedKnots === null) return 'N/A';
  return `${speedKnots} kts`;
}

// Create GeoJSON point
export function createGeoJSONPoint(
  lat: number,
  lon: number
): GeoJSON.Point {
  return {
    type: 'Point',
    coordinates: [lon, lat],
  };
}

// Create GeoJSON LineString from positions
export function createGeoJSONLineString(
  positions: Array<{ lat: number; lon: number }>
): GeoJSON.LineString {
  return {
    type: 'LineString',
    coordinates: positions.map((p) => [p.lon, p.lat]),
  };
}
