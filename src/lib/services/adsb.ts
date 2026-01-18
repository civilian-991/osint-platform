import type { ADSBResponse, ADSBAircraft, CoverageRegion, COVERAGE_REGIONS } from '@/lib/types/aircraft';
import { detectMilitary } from '@/lib/utils/military-db';
import { isWithinRadius } from '@/lib/utils/geo';

const ADSB_BASE_URL = 'https://api.adsb.lol/v2';

// Bounding box for Middle East region
const REGION_BOUNDS = {
  minLat: 10,   // South of the region
  maxLat: 42,   // North to Turkey
  minLon: 24,   // West to Egypt
  maxLon: 63,   // East to Iran/Gulf
};

export class ADSBService {
  private baseUrl: string;

  constructor(baseUrl = ADSB_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch all military aircraft globally
   */
  async fetchMilitaryAircraft(): Promise<ADSBAircraft[]> {
    try {
      const response = await fetch(`${this.baseUrl}/mil`, {
        next: { revalidate: 30 }, // Cache for 30 seconds
      });

      if (!response.ok) {
        throw new Error(`ADSB API error: ${response.status}`);
      }

      const data: ADSBResponse = await response.json();
      return data.ac || [];
    } catch (error) {
      console.error('Error fetching military aircraft:', error);
      throw error;
    }
  }

  /**
   * Fetch aircraft within a radius of a point
   */
  async fetchAircraftInRadius(
    lat: number,
    lon: number,
    radiusNm: number
  ): Promise<ADSBAircraft[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/point/${lat}/${lon}/${radiusNm}`,
        { next: { revalidate: 60 } }
      );

      if (!response.ok) {
        throw new Error(`ADSB API error: ${response.status}`);
      }

      const data: ADSBResponse = await response.json();
      return data.ac || [];
    } catch (error) {
      console.error('Error fetching aircraft in radius:', error);
      throw error;
    }
  }

  /**
   * Fetch specific aircraft by ICAO hex
   */
  async fetchAircraftByHex(hex: string): Promise<ADSBAircraft | null> {
    try {
      const response = await fetch(`${this.baseUrl}/hex/${hex}`, {
        next: { revalidate: 30 },
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`ADSB API error: ${response.status}`);
      }

      const data: ADSBResponse = await response.json();
      return data.ac?.[0] || null;
    } catch (error) {
      console.error('Error fetching aircraft by hex:', error);
      throw error;
    }
  }

  /**
   * Fetch military aircraft in the Middle East region
   */
  async fetchMiddleEastMilitary(): Promise<ADSBAircraft[]> {
    const allMilitary = await this.fetchMilitaryAircraft();

    // Filter to Middle East region
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
   * Fetch aircraft for all coverage regions
   */
  async fetchAllRegions(regions: CoverageRegion[]): Promise<Map<string, ADSBAircraft[]>> {
    const results = new Map<string, ADSBAircraft[]>();

    // Use Promise.allSettled for parallel requests
    const promises = regions.map(async (region) => {
      const aircraft = await this.fetchAircraftInRadius(
        region.lat,
        region.lon,
        region.radiusNm
      );
      return { region: region.name, aircraft };
    });

    const settled = await Promise.allSettled(promises);

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.set(result.value.region, result.value.aircraft);
      }
    }

    return results;
  }

  /**
   * Process aircraft data to enhance with military detection
   */
  processAircraft(aircraft: ADSBAircraft[]): ADSBAircraft[] {
    return aircraft.map((ac) => {
      const detection = detectMilitary(ac);
      return {
        ...ac,
        mil: detection.isMilitary,
        // Add custom fields for our processing
      };
    });
  }

  /**
   * Filter aircraft to only those with position data
   */
  filterWithPosition(aircraft: ADSBAircraft[]): ADSBAircraft[] {
    return aircraft.filter(
      (ac) => ac.lat !== undefined && ac.lon !== undefined
    );
  }

  /**
   * Group aircraft by military category
   */
  groupByCategory(aircraft: ADSBAircraft[]): Record<string, ADSBAircraft[]> {
    const groups: Record<string, ADSBAircraft[]> = {
      tanker: [],
      awacs: [],
      isr: [],
      transport: [],
      fighter: [],
      helicopter: [],
      trainer: [],
      other: [],
      civilian: [],
    };

    for (const ac of aircraft) {
      const detection = detectMilitary(ac);

      if (!detection.isMilitary) {
        groups.civilian.push(ac);
      } else if (detection.category) {
        groups[detection.category].push(ac);
      } else {
        groups.other.push(ac);
      }
    }

    return groups;
  }

  /**
   * Check if an aircraft is in a specific region
   */
  isInRegion(aircraft: ADSBAircraft, region: CoverageRegion): boolean {
    if (aircraft.lat === undefined || aircraft.lon === undefined) {
      return false;
    }

    return isWithinRadius(
      aircraft.lat,
      aircraft.lon,
      region.lat,
      region.lon,
      region.radiusNm
    );
  }

  /**
   * Get aircraft entering a region (comparing current vs previous positions)
   */
  detectRegionEntry(
    current: ADSBAircraft[],
    previous: Map<string, { lat: number; lon: number }>,
    region: CoverageRegion
  ): ADSBAircraft[] {
    const entering: ADSBAircraft[] = [];

    for (const aircraft of current) {
      if (aircraft.lat === undefined || aircraft.lon === undefined) {
        continue;
      }

      const prevPos = previous.get(aircraft.hex);
      const inRegionNow = this.isInRegion(aircraft, region);

      if (inRegionNow) {
        // Was it outside the region before?
        if (prevPos) {
          const wasInRegion = isWithinRadius(
            prevPos.lat,
            prevPos.lon,
            region.lat,
            region.lon,
            region.radiusNm
          );

          if (!wasInRegion) {
            entering.push(aircraft);
          }
        } else {
          // No previous position, consider it as entering if first seen
          entering.push(aircraft);
        }
      }
    }

    return entering;
  }
}

// Export singleton instance
export const adsbService = new ADSBService();

// Export convenience functions
export async function fetchMilitaryAircraft(): Promise<ADSBAircraft[]> {
  return adsbService.fetchMilitaryAircraft();
}

export async function fetchMiddleEastMilitary(): Promise<ADSBAircraft[]> {
  return adsbService.fetchMiddleEastMilitary();
}

export async function fetchAircraftByHex(hex: string): Promise<ADSBAircraft | null> {
  return adsbService.fetchAircraftByHex(hex);
}
