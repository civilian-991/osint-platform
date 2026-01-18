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

    const url = `${source.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'OSINT-Aviation-Platform/1.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as ADSBResponse;
    return data.ac || [];
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
   * Try to detect military aircraft that weren't flagged
   */
  private async enrichWithMilitaryDetection(aircraft: Map<string, ADSBAircraft>): Promise<void> {
    for (const [hex, ac] of aircraft) {
      if (!ac.mil) {
        const detection = detectMilitary(ac);
        if (detection.isMilitary) {
          ac.mil = true;
        }
      }
    }
  }

  /**
   * Fetch military aircraft in Middle East region
   */
  async fetchMiddleEastMilitary(): Promise<ADSBAircraft[]> {
    const allMilitary = await this.fetchMilitaryAircraft();

    return allMilitary.filter((aircraft) => {
      if (aircraft.lat === undefined || aircraft.lon === undefined) {
        return false;
      }

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
