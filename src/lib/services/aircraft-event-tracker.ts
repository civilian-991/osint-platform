/**
 * Aircraft Event Tracker Service
 *
 * Tracks aircraft events and sends Telegram notifications:
 * - First appearance (new aircraft detected)
 * - Departure (aircraft took off)
 * - Landing (aircraft landed)
 * - Disappeared (aircraft signal lost)
 */

import { query, queryOne, execute } from '@/lib/db';
import { telegramBot } from './telegram-bot';
import { getAircraftPrior } from '@/lib/knowledge/aircraft-priors';
import { getMilitaryCategoryLabel } from '@/lib/utils/military-db';
import type { MilitaryCategory, ADSBAircraft } from '@/lib/types/aircraft';

interface AircraftState {
  icao_hex: string;
  on_ground: boolean;
  altitude: number | null;
  latitude: number;
  longitude: number;
  timestamp: Date;
}

interface TrackedAircraft {
  icao_hex: string;
  callsign: string | null;
  type_code: string | null;
  type_description: string | null;
  operator: string | null;
  military_category: MilitaryCategory | null;
  latitude: number;
  longitude: number;
  altitude: number | null;
  ground_speed: number | null;
  track: number | null;
  on_ground: boolean;
  first_seen_at: Date;
  last_on_ground_at: Date | null;
}

export type AircraftEventType =
  | 'first_appearance'
  | 'departure'
  | 'landing'
  | 'disappeared';

export interface AircraftEvent {
  type: AircraftEventType;
  aircraft: TrackedAircraft;
  timestamp: Date;
  details?: string;
}

// In-memory cache of aircraft states for detecting state changes
// This is refreshed on each cron run
const aircraftStateCache = new Map<string, AircraftState>();

// Time threshold for considering an aircraft as "disappeared" (10 minutes)
const DISAPPEARED_THRESHOLD_MS = 10 * 60 * 1000;

// Minimum altitude to consider as airborne (feet)
const AIRBORNE_ALTITUDE_THRESHOLD = 500;

class AircraftEventTracker {
  /**
   * Check if this is the first time we're seeing an aircraft
   */
  async isNewAircraft(icaoHex: string): Promise<boolean> {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM aircraft WHERE icao_hex = $1`,
      [icaoHex.toUpperCase()]
    );
    return !existing;
  }

  /**
   * Get the previous state of an aircraft from positions
   */
  async getPreviousState(icaoHex: string): Promise<AircraftState | null> {
    // First check cache
    if (aircraftStateCache.has(icaoHex.toUpperCase())) {
      return aircraftStateCache.get(icaoHex.toUpperCase())!;
    }

    // Otherwise query from database - get the most recent position
    const state = await queryOne<{
      on_ground: boolean;
      altitude: number | null;
      latitude: number;
      longitude: number;
      timestamp: string;
    }>(
      `SELECT on_ground, altitude, latitude, longitude, timestamp
       FROM positions_latest
       WHERE icao_hex = $1`,
      [icaoHex.toUpperCase()]
    );

    if (state) {
      return {
        icao_hex: icaoHex.toUpperCase(),
        on_ground: state.on_ground,
        altitude: state.altitude,
        latitude: state.latitude,
        longitude: state.longitude,
        timestamp: new Date(state.timestamp),
      };
    }

    return null;
  }

  /**
   * Update the state cache for an aircraft
   */
  updateStateCache(icaoHex: string, state: AircraftState): void {
    aircraftStateCache.set(icaoHex.toUpperCase(), state);
  }

  /**
   * Detect events for an aircraft based on current and previous state
   */
  async detectEvents(
    aircraft: ADSBAircraft,
    militaryCategory: MilitaryCategory | null
  ): Promise<AircraftEvent[]> {
    const events: AircraftEvent[] = [];
    const icaoHex = aircraft.hex.toUpperCase();
    const currentOnGround = aircraft.alt_baro === 'ground' ||
      (typeof aircraft.alt_baro === 'number' && aircraft.alt_baro < AIRBORNE_ALTITUDE_THRESHOLD);
    const currentAltitude = typeof aircraft.alt_baro === 'number' ? aircraft.alt_baro : null;

    // Check if this is a new aircraft (first appearance)
    const isNew = await this.isNewAircraft(icaoHex);

    if (isNew && aircraft.lat !== undefined && aircraft.lon !== undefined) {
      events.push({
        type: 'first_appearance',
        aircraft: {
          icao_hex: icaoHex,
          callsign: aircraft.flight?.trim() || null,
          type_code: aircraft.t || null,
          type_description: aircraft.desc || null,
          operator: aircraft.ownOp || null,
          military_category: militaryCategory,
          latitude: aircraft.lat,
          longitude: aircraft.lon,
          altitude: currentAltitude,
          ground_speed: aircraft.gs ? Math.round(aircraft.gs) : null,
          track: aircraft.track ? Math.round(aircraft.track) : null,
          on_ground: currentOnGround,
          first_seen_at: new Date(),
          last_on_ground_at: currentOnGround ? new Date() : null,
        },
        timestamp: new Date(),
        details: `New ${militaryCategory ? getMilitaryCategoryLabel(militaryCategory) : 'military'} aircraft detected`,
      });
    }

    // Check for state changes (departure/landing)
    const previousState = await this.getPreviousState(icaoHex);

    if (previousState && aircraft.lat !== undefined && aircraft.lon !== undefined) {
      // Detect departure: was on ground, now airborne
      if (previousState.on_ground && !currentOnGround) {
        events.push({
          type: 'departure',
          aircraft: {
            icao_hex: icaoHex,
            callsign: aircraft.flight?.trim() || null,
            type_code: aircraft.t || null,
            type_description: aircraft.desc || null,
            operator: aircraft.ownOp || null,
            military_category: militaryCategory,
            latitude: aircraft.lat,
            longitude: aircraft.lon,
            altitude: currentAltitude,
            ground_speed: aircraft.gs ? Math.round(aircraft.gs) : null,
            track: aircraft.track ? Math.round(aircraft.track) : null,
            on_ground: false,
            first_seen_at: new Date(),
            last_on_ground_at: previousState.timestamp,
          },
          timestamp: new Date(),
          details: `Aircraft departed from ${this.formatLocation(previousState.latitude, previousState.longitude)}`,
        });
      }

      // Detect landing: was airborne, now on ground
      if (!previousState.on_ground && currentOnGround) {
        events.push({
          type: 'landing',
          aircraft: {
            icao_hex: icaoHex,
            callsign: aircraft.flight?.trim() || null,
            type_code: aircraft.t || null,
            type_description: aircraft.desc || null,
            operator: aircraft.ownOp || null,
            military_category: militaryCategory,
            latitude: aircraft.lat,
            longitude: aircraft.lon,
            altitude: currentAltitude,
            ground_speed: aircraft.gs ? Math.round(aircraft.gs) : null,
            track: aircraft.track ? Math.round(aircraft.track) : null,
            on_ground: true,
            first_seen_at: new Date(),
            last_on_ground_at: new Date(),
          },
          timestamp: new Date(),
          details: `Aircraft landed at ${this.formatLocation(aircraft.lat, aircraft.lon)}`,
        });
      }
    }

    // Update the state cache
    if (aircraft.lat !== undefined && aircraft.lon !== undefined) {
      this.updateStateCache(icaoHex, {
        icao_hex: icaoHex,
        on_ground: currentOnGround,
        altitude: currentAltitude,
        latitude: aircraft.lat,
        longitude: aircraft.lon,
        timestamp: new Date(),
      });
    }

    return events;
  }

  /**
   * Send Telegram notification for an aircraft event
   */
  async sendEventNotification(event: AircraftEvent): Promise<boolean> {
    const { type, aircraft, details } = event;

    const prior = aircraft.type_code ? getAircraftPrior(aircraft.type_code) : undefined;
    const aircraftName = prior?.name || aircraft.type_description || aircraft.type_code || 'Unknown';
    const categoryLabel = getMilitaryCategoryLabel(aircraft.military_category);

    const mapsUrl = `https://maps.google.com/?q=${aircraft.latitude},${aircraft.longitude}`;
    const adsbUrl = `https://globe.adsbexchange.com/?icao=${aircraft.icao_hex.toLowerCase()}`;

    let emoji: string;
    let title: string;
    let statusLine: string;

    switch (type) {
      case 'first_appearance':
        emoji = '🆕';
        title = 'NEW AIRCRAFT DETECTED';
        statusLine = aircraft.on_ground ? '📍 On Ground' : `✈️ Airborne at ${aircraft.altitude?.toLocaleString() || 'Unknown'} ft`;
        break;
      case 'departure':
        emoji = '🛫';
        title = 'AIRCRAFT DEPARTURE';
        statusLine = `📈 Climbing - ${aircraft.altitude?.toLocaleString() || 'Unknown'} ft`;
        break;
      case 'landing':
        emoji = '🛬';
        title = 'AIRCRAFT LANDING';
        statusLine = '📍 On Ground';
        break;
      case 'disappeared':
        emoji = '📡';
        title = 'AIRCRAFT SIGNAL LOST';
        statusLine = `Last seen at ${aircraft.altitude?.toLocaleString() || 'Unknown'} ft`;
        break;
      default:
        emoji = '✈️';
        title = 'AIRCRAFT EVENT';
        statusLine = '';
    }

    // Build route info if available
    let routeInfo = '';
    if (aircraft.track !== null) {
      const heading = this.getHeadingDirection(aircraft.track);
      routeInfo = `\n🧭 <b>Heading:</b> ${heading} (${aircraft.track}°)`;
    }
    if (aircraft.ground_speed) {
      routeInfo += `\n⚡ <b>Speed:</b> ${aircraft.ground_speed} kts`;
    }

    // Build mission info from priors
    let missionInfo = '';
    if (prior?.description) {
      missionInfo = `\n📋 <b>Role:</b> ${prior.description}`;
    }

    const text = `
${emoji} <b>${title}</b> ${emoji}

<b>Callsign:</b> ${aircraft.callsign || 'N/A'}
<b>ICAO:</b> <code>${aircraft.icao_hex}</code>
<b>Type:</b> ${aircraftName}
<b>Category:</b> ${categoryLabel}
${aircraft.operator ? `<b>Operator:</b> ${aircraft.operator}` : ''}

${statusLine}${routeInfo}${missionInfo}

${details ? `ℹ️ ${details}\n` : ''}
📍 <a href="${mapsUrl}">View Location</a> | <a href="${adsbUrl}">Track on ADS-B</a>
⏰ ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Beirut' })}

#${type.replace('_', '')} #${categoryLabel.replace(/[\/\s]/g, '')} #Military
`.trim();

    return telegramBot.sendMessage({
      chat_id: process.env.TELEGRAM_ALERT_CHAT_ID!,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    });
  }

  /**
   * Process events and send notifications
   */
  async processAndNotify(
    aircraft: ADSBAircraft,
    militaryCategory: MilitaryCategory | null,
    options: {
      notifyFirstAppearance?: boolean;
      notifyDeparture?: boolean;
      notifyLanding?: boolean;
    } = {}
  ): Promise<AircraftEvent[]> {
    const {
      notifyFirstAppearance = true,
      notifyDeparture = true,
      notifyLanding = false,
    } = options;

    const events = await this.detectEvents(aircraft, militaryCategory);

    for (const event of events) {
      // Store event in database for history
      await this.storeEvent(event);

      // Send notification based on event type and settings
      const shouldNotify =
        (event.type === 'first_appearance' && notifyFirstAppearance) ||
        (event.type === 'departure' && notifyDeparture) ||
        (event.type === 'landing' && notifyLanding);

      if (shouldNotify) {
        await this.sendEventNotification(event);
      }
    }

    return events;
  }

  /**
   * Store event in database
   */
  private async storeEvent(event: AircraftEvent): Promise<void> {
    try {
      await execute(
        `INSERT INTO alerts (alert_type, severity, title, description, data)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          `aircraft_${event.type}`,
          event.type === 'first_appearance' ? 'medium' : 'low',
          `${this.getEventTitle(event.type)}: ${event.aircraft.callsign || event.aircraft.icao_hex}`,
          event.details || '',
          JSON.stringify({
            icao_hex: event.aircraft.icao_hex,
            callsign: event.aircraft.callsign,
            type_code: event.aircraft.type_code,
            military_category: event.aircraft.military_category,
            latitude: event.aircraft.latitude,
            longitude: event.aircraft.longitude,
            altitude: event.aircraft.altitude,
            ground_speed: event.aircraft.ground_speed,
            track: event.aircraft.track,
            on_ground: event.aircraft.on_ground,
          }),
        ]
      );
    } catch (error) {
      console.error('Error storing aircraft event:', error);
    }
  }

  private getEventTitle(type: AircraftEventType): string {
    switch (type) {
      case 'first_appearance':
        return 'New Aircraft Detected';
      case 'departure':
        return 'Aircraft Departed';
      case 'landing':
        return 'Aircraft Landed';
      case 'disappeared':
        return 'Aircraft Signal Lost';
      default:
        return 'Aircraft Event';
    }
  }

  private formatLocation(lat: number, lon: number): string {
    const latDir = lat >= 0 ? 'N' : 'S';
    const lonDir = lon >= 0 ? 'E' : 'W';
    return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lon).toFixed(2)}°${lonDir}`;
  }

  private getHeadingDirection(track: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(track / 22.5) % 16;
    return directions[index];
  }

  /**
   * Clear stale entries from cache
   */
  cleanupCache(): void {
    const now = Date.now();
    for (const [key, state] of aircraftStateCache.entries()) {
      if (now - state.timestamp.getTime() > DISAPPEARED_THRESHOLD_MS) {
        aircraftStateCache.delete(key);
      }
    }
  }

  /**
   * Get cache stats for monitoring
   */
  getCacheStats(): { size: number; oldestEntry: Date | null } {
    let oldest: Date | null = null;
    for (const state of aircraftStateCache.values()) {
      if (!oldest || state.timestamp < oldest) {
        oldest = state.timestamp;
      }
    }
    return { size: aircraftStateCache.size, oldestEntry: oldest };
  }
}

export const aircraftEventTracker = new AircraftEventTracker();
