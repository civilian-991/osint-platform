/**
 * Multi-Source ADS-B Data Aggregator
 *
 * Fetches aircraft data from multiple sources and merges/deduplicates
 * for better coverage, especially for military aircraft.
 */

import type { ADSBAircraft, ADSBResponse } from '@/lib/types/aircraft';
import { detectMilitary } from '@/lib/utils/military-db';

interface DataSource {
  name: string;
  baseUrl: string;
  militaryEndpoint?: string;
  allEndpoint?: string;
  enabled: boolean;
  priority: number; // Higher = more trusted
  rateLimit: number; // Requests per minute
  lastRequest?: number;
  apiKey?: string; // For RapidAPI sources
  apiHost?: string; // For RapidAPI sources
  isOpenSky?: boolean; // OpenSky has different response format
}

// Configure multiple data sources
const DATA_SOURCES: DataSource[] = [
  {
    name: 'adsb.lol',
    baseUrl: 'https://api.adsb.lol/v2',
    militaryEndpoint: '/mil',
    allEndpoint: '/all',
    enabled: true,
    priority: 3,
    rateLimit: 60,
  },
  {
    name: 'airplanes.live',
    baseUrl: 'https://api.airplanes.live/v2',
    militaryEndpoint: '/mil',
    allEndpoint: '/all',
    enabled: true,
    priority: 3,
    rateLimit: 60,
  },
  {
    name: 'adsb.fi',
    baseUrl: 'https://opendata.adsb.fi/api/v2',
    militaryEndpoint: '/mil',
    allEndpoint: '/all',
    enabled: true,
    priority: 2,
    rateLimit: 30,
  },
  {
    name: 'adsbdb',
    baseUrl: 'https://api.adsbdb.com/v0',
    militaryEndpoint: '/aircraft/military',
    enabled: true,
    priority: 1,
    rateLimit: 20,
  },
  // ADSBexchange - Requires API key from RapidAPI
  // Sign up at: https://rapidapi.com/adsbexchange/api/adsbexchange-com1
  {
    name: 'adsbexchange',
    baseUrl: 'https://adsbexchange-com1.p.rapidapi.com/v2',
    militaryEndpoint: '/mil',
    allEndpoint: '/all',
    enabled: !!process.env.ADSBEXCHANGE_API_KEY,
    priority: 5, // Highest priority - best coverage
    rateLimit: 10, // RapidAPI free tier limit
    apiKey: process.env.ADSBEXCHANGE_API_KEY,
    apiHost: 'adsbexchange-com1.p.rapidapi.com',
  },
  // OpenSky Network - Free API with good global coverage
  {
    name: 'opensky',
    baseUrl: 'https://opensky-network.org/api',
    allEndpoint: '/states/all',
    enabled: true,
    priority: 4,
    rateLimit: 10, // 10 requests per minute for anonymous
    isOpenSky: true, // Special handling needed
  },
];

// Middle East bounding box
const REGION_BOUNDS = {
  minLat: 10,
  maxLat: 42,
  minLon: 24,
  maxLon: 63,
};

// High-interest areas for focused fetching (smaller boxes = more detail)
const FOCUS_AREAS = [
  { name: 'Lebanon-Israel', lat: 33.5, lon: 35.5, radius: 150 },
  { name: 'Persian Gulf', lat: 27, lon: 51, radius: 200 },
  { name: 'Iran', lat: 32, lon: 53, radius: 300 },
  { name: 'Syria', lat: 35, lon: 38, radius: 150 },
  { name: 'Red Sea', lat: 20, lon: 38, radius: 200 },
];

class MultiSourceADSBService {
  private sources: DataSource[];
  private cache: Map<string, { data: ADSBAircraft; timestamp: number; source: string }> = new Map();
  private readonly CACHE_TTL = 60000; // 60 seconds

  constructor() {
    this.sources = DATA_SOURCES.filter(s => s.enabled);
  }

  /**
   * Fetch military aircraft from all sources and merge
   */
  async fetchMilitaryAircraft(): Promise<ADSBAircraft[]> {
    const allAircraft = new Map<string, ADSBAircraft>();
    const fetchPromises: Promise<{ source: string; aircraft: ADSBAircraft[] }>[] = [];

    // Fetch from military endpoints
    for (const source of this.sources) {
      if (!source.militaryEndpoint) continue;

      fetchPromises.push(
        this.fetchFromSource(source, source.militaryEndpoint)
          .then(aircraft => ({ source: source.name, aircraft }))
          .catch(err => {
            console.error(`Error fetching from ${source.name}:`, err.message);
            return { source: source.name, aircraft: [] };
          })
      );
    }

    // Also fetch from focus areas to catch Mode S only aircraft
    for (const area of FOCUS_AREAS) {
      const source = this.sources[0]; // Use primary source for area queries
      if (source) {
        fetchPromises.push(
          this.fetchFromSource(source, `/point/${area.lat}/${area.lon}/${area.radius}`)
            .then(aircraft => ({ source: `${source.name}-${area.name}`, aircraft }))
            .catch(err => {
              console.error(`Error fetching ${area.name}:`, err.message);
              return { source: source.name, aircraft: [] };
            })
        );
      }
    }

    const results = await Promise.allSettled(fetchPromises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { source, aircraft } = result.value;

        for (const ac of aircraft) {
          if (!ac.hex) continue;

          // Normalize position: use lastPosition if top-level lat/lon is null
          this.normalizePosition(ac);

          const existing = allAircraft.get(ac.hex.toUpperCase());

          // Merge or add aircraft
          if (existing) {
            // Merge data, preferring non-null values
            allAircraft.set(ac.hex.toUpperCase(), this.mergeAircraft(existing, ac));
          } else {
            allAircraft.set(ac.hex.toUpperCase(), { ...ac, _source: source } as ADSBAircraft);
          }
        }
      }
    }

    // Detect military from all aircraft (including non-flagged ones)
    await this.enrichWithMilitaryDetection(allAircraft);

    return Array.from(allAircraft.values());
  }

  /**
   * Fetch from a single source
   */
  private async fetchFromSource(source: DataSource, endpoint: string): Promise<ADSBAircraft[]> {
    // Rate limiting
    const now = Date.now();
    if (source.lastRequest) {
      const minInterval = 60000 / source.rateLimit;
      const elapsed = now - source.lastRequest;
      if (elapsed < minInterval) {
        await new Promise(resolve => setTimeout(resolve, minInterval - elapsed));
      }
    }
    source.lastRequest = Date.now();

    // Handle OpenSky separately - different format
    if (source.isOpenSky) {
      return this.fetchFromOpenSky(endpoint);
    }

    const url = `${source.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'User-Agent': 'OSINT-Aviation-Platform/1.0',
      'Accept': 'application/json',
    };

    // Add RapidAPI headers if needed
    if (source.apiKey && source.apiHost) {
      headers['X-RapidAPI-Key'] = source.apiKey;
      headers['X-RapidAPI-Host'] = source.apiHost;
    }

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as ADSBResponse;
    return data.ac || [];
  }

  /**
   * Fetch from OpenSky Network and convert to standard format
   * OpenSky returns: [icao24, callsign, origin_country, time_position, last_contact,
   *                   longitude, latitude, baro_altitude, on_ground, velocity,
   *                   true_track, vertical_rate, sensors, geo_altitude, squawk,
   *                   spi, position_source, category]
   */
  private async fetchFromOpenSky(endpoint: string): Promise<ADSBAircraft[]> {
    // OpenSky bounding box for Middle East
    const url = `https://opensky-network.org/api/states/all?lamin=${REGION_BOUNDS.minLat}&lomin=${REGION_BOUNDS.minLon}&lamax=${REGION_BOUNDS.maxLat}&lomax=${REGION_BOUNDS.maxLon}`;

    const headers: Record<string, string> = {
      'User-Agent': 'OSINT-Aviation-Platform/1.0',
      'Accept': 'application/json',
    };

    // Add auth if credentials available (increases rate limit)
    if (process.env.OPENSKY_USERNAME && process.env.OPENSKY_PASSWORD) {
      const auth = Buffer.from(`${process.env.OPENSKY_USERNAME}:${process.env.OPENSKY_PASSWORD}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    const response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(15000), // OpenSky can be slow
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as { time: number; states: (string | number | boolean | null)[][] };

    if (!data.states) return [];

    // Convert OpenSky format to our standard format
    return data.states.map((state): ADSBAircraft => {
      const [
        icao24,      // 0: ICAO24 address
        callsign,    // 1: Callsign
        origin,      // 2: Origin country
        _timePos,    // 3: Time position
        lastContact, // 4: Last contact
        lon,         // 5: Longitude
        lat,         // 6: Latitude
        baroAlt,     // 7: Barometric altitude
        onGround,    // 8: On ground
        velocity,    // 9: Velocity
        track,       // 10: True track
        vertRate,    // 11: Vertical rate
        _sensors,    // 12: Sensors
        geoAlt,      // 13: Geometric altitude
        squawk,      // 14: Squawk
        _spi,        // 15: SPI
        _posSource,  // 16: Position source
        category,    // 17: Category
      ] = state;

      return {
        hex: (icao24 as string)?.toUpperCase() || '',
        flight: (callsign as string)?.trim() || undefined,
        lat: lat as number | undefined,
        lon: lon as number | undefined,
        alt_baro: baroAlt ? Math.round(baroAlt as number * 3.28084) : undefined, // Convert m to ft
        alt_geom: geoAlt ? Math.round(geoAlt as number * 3.28084) : undefined,
        gs: velocity ? Math.round((velocity as number) * 1.944) : undefined, // Convert m/s to knots
        track: track as number | undefined,
        baro_rate: vertRate ? Math.round((vertRate as number) * 196.85) : undefined, // Convert m/s to ft/min
        squawk: squawk as string | undefined,
        seen: lastContact ? Math.round(Date.now() / 1000 - (lastContact as number)) : undefined,
        category: category as string | undefined,
        ownOp: origin as string | undefined,
        _source: 'opensky',
      } as ADSBAircraft;
    }).filter(ac => ac.hex && ac.lat !== undefined && ac.lon !== undefined);
  }

  /**
   * Merge two aircraft records, preferring non-null values
   */
  private mergeAircraft(a: ADSBAircraft, b: ADSBAircraft): ADSBAircraft {
    // Merge all properties, preferring non-null values from either source
    const merged: Record<string, unknown> = { ...b, ...a };

    // Explicitly handle key fields
    merged.hex = a.hex || b.hex;
    merged.flight = a.flight || b.flight;
    merged.r = a.r || b.r;
    merged.t = a.t || b.t;
    merged.desc = a.desc || b.desc;
    merged.ownOp = a.ownOp || b.ownOp;
    merged.lat = a.lat ?? b.lat;
    merged.lon = a.lon ?? b.lon;
    merged.alt_baro = a.alt_baro ?? b.alt_baro;
    merged.alt_geom = a.alt_geom ?? b.alt_geom;
    merged.gs = a.gs ?? b.gs;
    merged.track = a.track ?? b.track;
    merged.baro_rate = a.baro_rate ?? b.baro_rate;
    merged.squawk = a.squawk || b.squawk;
    merged.category = a.category || b.category;
    merged.seen = Math.min((a.seen as number) ?? Infinity, (b.seen as number) ?? Infinity);
    merged.seen_pos = Math.min((a.seen_pos as number) ?? Infinity, (b.seen_pos as number) ?? Infinity);
    merged.mil = a.mil || b.mil;

    // Track sources
    const aAny = a as unknown as Record<string, unknown>;
    const bAny = b as unknown as Record<string, unknown>;
    const existingSources = (aAny._sources as string[]) || [aAny._source as string || 'unknown'];
    merged._sources = [...existingSources, bAny._source as string || 'unknown'].filter(Boolean);

    return merged as unknown as ADSBAircraft;
  }

  /**
   * Normalize aircraft position data
   * Some APIs return lat/lon as null but include position in lastPosition object
   * This extracts the position from lastPosition when needed
   */
  private normalizePosition(ac: ADSBAircraft): void {
    const acAny = ac as unknown as Record<string, unknown>;
    const lastPos = acAny.lastPosition as { lat?: number; lon?: number; seen_pos?: number } | undefined;

    // If top-level lat/lon is null/undefined but lastPosition exists, use it
    if ((ac.lat == null || ac.lon == null) && lastPos) {
      if (lastPos.lat != null && lastPos.lon != null) {
        ac.lat = lastPos.lat;
        ac.lon = lastPos.lon;
        // Also track how stale the position is
        if (lastPos.seen_pos != null) {
          ac.seen_pos = lastPos.seen_pos;
        }
      }
    }
  }

  /**
   * Validate and detect military aircraft
   * - Detects military aircraft that weren't flagged
   * - Also removes false positives (civilian aircraft incorrectly flagged as military)
   */
  private async enrichWithMilitaryDetection(aircraft: Map<string, ADSBAircraft>): Promise<void> {
    for (const [hex, ac] of aircraft) {
      const detection = detectMilitary(ac);

      // If detection says it's not military, remove the flag (fixes false positives)
      // If detection says it's military, add the flag
      ac.mil = detection.isMilitary;

      // Also add the category if detected
      if (detection.category) {
        (ac as unknown as Record<string, unknown>)._militaryCategory = detection.category;
      }
      if (detection.country) {
        (ac as unknown as Record<string, unknown>)._militaryCountry = detection.country;
      }
    }
  }

  /**
   * Fetch military aircraft in Middle East region
   */
  async fetchMiddleEastMilitary(): Promise<ADSBAircraft[]> {
    const allAircraft = await this.fetchMilitaryAircraft();

    // Filter to ONLY military aircraft in the Middle East region
    return allAircraft.filter((aircraft) => {
      // Must be flagged as military
      if (!aircraft.mil) {
        return false;
      }

      // Must have valid position (check for both null and undefined)
      if (aircraft.lat == null || aircraft.lon == null) {
        return false;
      }

      // Must be in Middle East region
      return (
        aircraft.lat >= REGION_BOUNDS.minLat &&
        aircraft.lat <= REGION_BOUNDS.maxLat &&
        aircraft.lon >= REGION_BOUNDS.minLon &&
        aircraft.lon <= REGION_BOUNDS.maxLon
      );
    });
  }

  /**
   * Fetch specific aircraft by hex from all sources
   */
  async fetchAircraftByHex(hex: string): Promise<ADSBAircraft | null> {
    // Check cache first
    const cached = this.cache.get(hex.toUpperCase());
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const fetchPromises = this.sources.map(async source => {
      try {
        const response = await fetch(`${source.baseUrl}/hex/${hex}`, {
          headers: { 'User-Agent': 'OSINT-Aviation-Platform/1.0' },
          signal: AbortSignal.timeout(5000),
        });

        if (!response.ok) return null;

        const data = await response.json() as ADSBResponse;
        return data.ac?.[0] || null;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(fetchPromises);
    const validResults = results.filter(Boolean) as ADSBAircraft[];

    if (validResults.length === 0) return null;

    // Merge all valid results
    const merged = validResults.reduce((acc, ac) => this.mergeAircraft(acc, ac));

    // Cache the result
    this.cache.set(hex.toUpperCase(), {
      data: merged,
      timestamp: Date.now(),
      source: 'merged',
    });

    return merged;
  }

  /**
   * Fetch ALL aircraft in Middle East region (military + civilian)
   * This provides coverage similar to ADSBexchange globe view
   */
  async fetchAllAircraftInRegion(): Promise<ADSBAircraft[]> {
    const allAircraft = new Map<string, ADSBAircraft>();
    const fetchPromises: Promise<{ source: string; aircraft: ADSBAircraft[] }>[] = [];

    // Fetch from all endpoints (not just military)
    for (const source of this.sources) {
      if (!source.allEndpoint && !source.isOpenSky) continue;

      fetchPromises.push(
        this.fetchFromSource(source, source.allEndpoint || '')
          .then(aircraft => ({ source: source.name, aircraft }))
          .catch(err => {
            console.error(`Error fetching all from ${source.name}:`, err.message);
            return { source: source.name, aircraft: [] };
          })
      );
    }

    // Also fetch from point queries for better local coverage
    for (const area of FOCUS_AREAS) {
      const source = this.sources.find(s => s.enabled && !s.isOpenSky);
      if (source) {
        fetchPromises.push(
          this.fetchFromSource(source, `/point/${area.lat}/${area.lon}/${area.radius}`)
            .then(aircraft => ({ source: `${source.name}-${area.name}`, aircraft }))
            .catch(() => ({ source: source.name, aircraft: [] }))
        );
      }
    }

    const results = await Promise.allSettled(fetchPromises);

    for (const result of results) {
      if (result.status === 'fulfilled') {
        const { source, aircraft } = result.value;

        for (const ac of aircraft) {
          if (!ac.hex) continue;

          // Filter to Middle East region
          if (ac.lat !== undefined && ac.lon !== undefined) {
            if (
              ac.lat < REGION_BOUNDS.minLat ||
              ac.lat > REGION_BOUNDS.maxLat ||
              ac.lon < REGION_BOUNDS.minLon ||
              ac.lon > REGION_BOUNDS.maxLon
            ) {
              continue;
            }
          }

          const existing = allAircraft.get(ac.hex.toUpperCase());
          if (existing) {
            allAircraft.set(ac.hex.toUpperCase(), this.mergeAircraft(existing, ac));
          } else {
            allAircraft.set(ac.hex.toUpperCase(), { ...ac, _source: source } as ADSBAircraft);
          }
        }
      }
    }

    // Enrich with military detection
    await this.enrichWithMilitaryDetection(allAircraft);

    const aircraftArray = Array.from(allAircraft.values());
    console.log(`[MultiSource] Fetched ${aircraftArray.length} total aircraft in region`);

    return aircraftArray;
  }

  /**
   * Get source statistics
   */
  getSourceStats(): { name: string; enabled: boolean; priority: number }[] {
    return this.sources.map(s => ({
      name: s.name,
      enabled: s.enabled,
      priority: s.priority,
    }));
  }
}

export const multiSourceADSB = new MultiSourceADSBService();

// Convenience exports
export async function fetchMilitaryAircraftMultiSource(): Promise<ADSBAircraft[]> {
  return multiSourceADSB.fetchMilitaryAircraft();
}

export async function fetchMiddleEastMilitaryMultiSource(): Promise<ADSBAircraft[]> {
  return multiSourceADSB.fetchMiddleEastMilitary();
}
