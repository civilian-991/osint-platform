// OpenSky Network Track API integration
// Docs: https://openskynetwork.github.io/opensky-api/rest.html#track-by-aircraft

export interface TrackPoint {
  timestamp: number;
  latitude: number;
  longitude: number;
  altitude: number | null;
  heading: number | null;
  onGround: boolean;
}

export interface AircraftTrack {
  icao24: string;
  callsign: string | null;
  startTime: number;
  endTime: number;
  path: TrackPoint[];
}

interface OpenSkyTrackResponse {
  icao24: string;
  callsign: string | null;
  startTime: number;
  endTime: number;
  path: Array<[number, number, number, number | null, number | null, boolean]>;
}

/**
 * Fetch track history for an aircraft from OpenSky Network
 * @param icao24 - ICAO 24-bit address (hex) of the aircraft
 * @param time - Unix timestamp to get track at (0 for current)
 */
export async function fetchAircraftTrack(icao24: string): Promise<AircraftTrack | null> {
  try {
    const url = `https://opensky-network.org/api/tracks/all?icao24=${icao24.toLowerCase()}&time=0`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
      // No auth required for basic access (rate limited)
    });

    if (!response.ok) {
      if (response.status === 404) {
        // No track data available
        return null;
      }
      throw new Error(`OpenSky API error: ${response.status}`);
    }

    const data: OpenSkyTrackResponse = await response.json();

    if (!data.path || data.path.length === 0) {
      return null;
    }

    // Transform path data
    const path: TrackPoint[] = data.path.map(point => ({
      timestamp: point[0],
      latitude: point[1],
      longitude: point[2],
      altitude: point[3],
      heading: point[4],
      onGround: point[5],
    }));

    return {
      icao24: data.icao24,
      callsign: data.callsign?.trim() || null,
      startTime: data.startTime,
      endTime: data.endTime,
      path,
    };
  } catch (error) {
    console.error('Failed to fetch aircraft track:', error);
    return null;
  }
}

/**
 * Convert track to coordinate array for map display
 */
export function trackToCoordinates(track: AircraftTrack): Array<[number, number]> {
  return track.path.map(point => [point.longitude, point.latitude]);
}
