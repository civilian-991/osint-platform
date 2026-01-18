export interface Aircraft {
  id: string;
  icao_hex: string;
  registration: string | null;
  type_code: string | null;
  type_description: string | null;
  operator: string | null;
  country: string | null;
  is_military: boolean;
  military_category: MilitaryCategory | null;
  watchlist_category: WatchlistCategory | null;
  created_at: string;
  updated_at: string;
}

export type MilitaryCategory =
  | 'tanker'
  | 'awacs'
  | 'isr'
  | 'transport'
  | 'fighter'
  | 'helicopter'
  | 'trainer'
  | 'other';

export type WatchlistCategory =
  | 'high_priority'
  | 'medium_priority'
  | 'low_priority'
  | null;

export interface Position {
  id: string;
  aircraft_id: string;
  icao_hex: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  ground_speed: number | null;
  track: number | null;
  vertical_rate: number | null;
  squawk: string | null;
  on_ground: boolean;
  timestamp: string;
  source: string;
}

export interface PositionLatest extends Position {
  aircraft: Aircraft | null;
}

export interface Flight {
  id: string;
  aircraft_id: string;
  callsign: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  departure_airport: string | null;
  arrival_airport: string | null;
  route_geom: GeoJSON.LineString | null;
  max_altitude: number | null;
  flight_type: FlightType | null;
  pattern_detected: FlightPattern | null;
  created_at: string;
}

export type FlightType =
  | 'transit'
  | 'training'
  | 'patrol'
  | 'refueling'
  | 'surveillance'
  | 'unknown';

export type FlightPattern =
  | 'orbit'
  | 'racetrack'
  | 'holding'
  | 'tanker_track'
  | 'straight'
  | null;

export interface ADSBResponse {
  ac: ADSBAircraft[];
  msg: string;
  now: number;
  total: number;
  ctime: number;
  ptime: number;
}

export interface ADSBAircraft {
  hex: string;
  type?: string;
  flight?: string;
  r?: string;
  t?: string;
  desc?: string;
  ownOp?: string;
  year?: string;
  alt_baro?: number | 'ground';
  alt_geom?: number;
  gs?: number;
  track?: number;
  baro_rate?: number;
  squawk?: string;
  emergency?: string;
  category?: string;
  lat?: number;
  lon?: number;
  nic?: number;
  rc?: number;
  seen_pos?: number;
  seen?: number;
  rssi?: number;
  nav_modes?: string[];
  mil?: boolean;
  dst?: number;
  dir?: number;
}

export interface CoverageRegion {
  name: string;
  lat: number;
  lon: number;
  radiusNm: number;
}

export const COVERAGE_REGIONS: CoverageRegion[] = [
  { name: 'Lebanon', lat: 33.85, lon: 35.86, radiusNm: 100 },
  { name: 'Israel', lat: 31.77, lon: 35.23, radiusNm: 100 },
  { name: 'Cyprus', lat: 35.13, lon: 33.43, radiusNm: 80 },
  { name: 'Syria', lat: 34.80, lon: 38.99, radiusNm: 150 },
  { name: 'Iran', lat: 32.43, lon: 53.69, radiusNm: 400 },
  { name: 'Iraq', lat: 33.31, lon: 44.37, radiusNm: 200 },
  { name: 'Turkey', lat: 39.93, lon: 32.86, radiusNm: 300 },
  { name: 'Egypt', lat: 26.82, lon: 30.80, radiusNm: 250 },
  { name: 'GCC', lat: 24.47, lon: 54.37, radiusNm: 400 },
];

export const MILITARY_TYPE_CODES: Record<MilitaryCategory, string[]> = {
  tanker: ['KC135', 'KC10', 'KC46', 'A332', 'A339', 'KC30'],
  awacs: ['E3TF', 'E3CF', 'E767', 'E737', 'E7WW'],
  isr: ['RC135', 'EP3', 'P8', 'P8A', 'GLEX', 'RQ4', 'MQ9', 'U2'],
  transport: ['C17', 'C5M', 'C130', 'C30J', 'A400', 'C2'],
  fighter: ['F16', 'F15', 'F18', 'F22', 'F35', 'FA18', 'TYP'],
  helicopter: ['H60', 'UH60', 'AH64', 'CH47', 'V22'],
  trainer: ['T38', 'T6', 'T45'],
  other: [],
};

export const MILITARY_CALLSIGN_PREFIXES = [
  'RCH',   // Reach (USAF)
  'DUKE',  // Special Ops
  'EVAC',  // Medical Evacuation
  'JAKE',  // Tanker
  'SHELL', // Tanker
  'TEXAN', // Tanker
  'PETRO', // Tanker
  'AWACS', // AWACS
  'SENTRY',// AWACS
  'MAGIC', // AWACS
  'COBRA', // ISR
  'RIVET', // ISR
  'OLIVE', // ISR
  'GIANT', // C-5
  'MOOSE', // C-17
];
