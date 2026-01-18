import type { MilitaryCategory, ADSBAircraft } from '@/lib/types/aircraft';

// ICAO hex ranges for military aircraft by country
const MILITARY_HEX_RANGES: Array<{
  country: string;
  start: number;
  end: number;
}> = [
  // United States Military
  { country: 'USA', start: 0xADF7C7, end: 0xAFFFFF },
  // United Kingdom Military
  { country: 'UK', start: 0x43C000, end: 0x43CFFF },
  // France Military
  { country: 'France', start: 0x3B0000, end: 0x3BFFFF },
  // Germany Military
  { country: 'Germany', start: 0x3F0000, end: 0x3FFFFF },
  // Israel Military
  { country: 'Israel', start: 0x738A00, end: 0x738AFF },
  // Turkey Military
  { country: 'Turkey', start: 0x4B8000, end: 0x4B8FFF },
  // Saudi Arabia Military
  { country: 'Saudi Arabia', start: 0x710000, end: 0x710FFF },
  // UAE Military
  { country: 'UAE', start: 0x896000, end: 0x896FFF },
  // Egypt Military
  { country: 'Egypt', start: 0x010000, end: 0x010FFF },
  // Iran Military
  { country: 'Iran', start: 0x730000, end: 0x730FFF },
  // Russia Military
  { country: 'Russia', start: 0x150000, end: 0x15FFFF },
  // China Military
  { country: 'China', start: 0x780000, end: 0x787FFF },
];

// Type codes for military aircraft categories
const MILITARY_TYPE_PATTERNS: Record<MilitaryCategory, RegExp[]> = {
  tanker: [
    /^KC\d{2,3}/i,
    /^A33[02]/i,
    /^A400/i,
    /MRTT/i,
  ],
  awacs: [
    /^E-?3/i,
    /^E-?7/i,
    /^E767/i,
    /AWACS/i,
  ],
  isr: [
    /^RC-?135/i,
    /^EP-?3/i,
    /^P-?8/i,
    /^RQ-?\d/i,
    /^MQ-?\d/i,
    /^U-?2/i,
    /^E-?8/i,
    /JSTARS/i,
    /SENTINEL/i,
    /HAWK/i,
    /REAPER/i,
  ],
  transport: [
    /^C-?17/i,
    /^C-?5/i,
    /^C-?130/i,
    /^C-?30J/i,
    /^A400/i,
    /^AN-?\d{2}/i,
    /^IL-?76/i,
  ],
  fighter: [
    /^F-?\d{2}/i,
    /^FA-?18/i,
    /^F-?22/i,
    /^F-?35/i,
    /^SU-?\d{2}/i,
    /^MIG/i,
    /^TYPHOON/i,
    /^RAFALE/i,
    /^TORNADO/i,
  ],
  helicopter: [
    /^H-?60/i,
    /^UH-?60/i,
    /^AH-?64/i,
    /^CH-?47/i,
    /^V-?22/i,
    /^MH-?53/i,
    /^HH-?60/i,
    /APACHE/i,
    /BLACKHAWK/i,
    /CHINOOK/i,
    /OSPREY/i,
  ],
  trainer: [
    /^T-?\d{1,2}/i,
    /TEXAN/i,
    /HAWK/i,
  ],
  other: [],
};

// Callsign prefixes that indicate military
const MILITARY_CALLSIGN_PATTERNS: RegExp[] = [
  /^RCH\d/i,      // Reach (USAF airlift)
  /^DUKE\d/i,     // Special Ops
  /^EVAC\d/i,     // Medical
  /^JAKE\d/i,     // Tanker
  /^SHELL\d/i,    // Tanker
  /^TEXAN\d/i,    // Tanker
  /^PETRO\d/i,    // Tanker
  /^AWACS\d/i,    // AWACS
  /^SENTRY\d/i,   // AWACS
  /^MAGIC\d/i,    // AWACS
  /^COBRA\d/i,    // ISR
  /^RIVET\d/i,    // ISR
  /^OLIVE\d/i,    // ISR
  /^GIANT\d/i,    // C-5
  /^MOOSE\d/i,    // C-17
  /^NAVY\d/i,     // US Navy
  /^ARMY\d/i,     // US Army
  /^CHAOS\d/i,    // Marines
  /^IRON\d/i,     // Various
  /^STEEL\d/i,    // Various
  /^VIPER\d/i,    // F-16
  /^EAGLE\d/i,    // F-15
  /^RAPTOR\d/i,   // F-22
  /^LIGHTNING\d/i, // F-35
  /^HAWG\d/i,     // A-10
  /^BOXER\d/i,    // KC-10
  /^PACK\d/i,     // KC-135
  /^QUID\d/i,     // E-3
];

// Check if ICAO hex is in military range
export function isHexMilitary(hex: string): { isMilitary: boolean; country?: string } {
  const hexNum = parseInt(hex, 16);

  for (const range of MILITARY_HEX_RANGES) {
    if (hexNum >= range.start && hexNum <= range.end) {
      return { isMilitary: true, country: range.country };
    }
  }

  return { isMilitary: false };
}

// Get military category from type code
export function getMilitaryCategory(typeCode: string | null | undefined): MilitaryCategory | null {
  if (!typeCode) return null;

  for (const [category, patterns] of Object.entries(MILITARY_TYPE_PATTERNS) as [MilitaryCategory, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(typeCode)) {
        return category;
      }
    }
  }

  return null;
}

// Check if callsign indicates military
export function isCallsignMilitary(callsign: string | null | undefined): boolean {
  if (!callsign) return false;

  const normalized = callsign.trim().toUpperCase();

  for (const pattern of MILITARY_CALLSIGN_PATTERNS) {
    if (pattern.test(normalized)) {
      return true;
    }
  }

  return false;
}

// Comprehensive military detection
export function detectMilitary(aircraft: ADSBAircraft): {
  isMilitary: boolean;
  category: MilitaryCategory | null;
  country: string | null;
  confidence: 'high' | 'medium' | 'low';
} {
  // If ADSB.lol already flagged it as military
  if (aircraft.mil === true) {
    const category = getMilitaryCategory(aircraft.t);
    return {
      isMilitary: true,
      category: category || 'other',
      country: null,
      confidence: 'high',
    };
  }

  // Check ICAO hex range
  const hexCheck = isHexMilitary(aircraft.hex);
  if (hexCheck.isMilitary) {
    const category = getMilitaryCategory(aircraft.t);
    return {
      isMilitary: true,
      category: category || 'other',
      country: hexCheck.country || null,
      confidence: 'high',
    };
  }

  // Check type code
  const category = getMilitaryCategory(aircraft.t);
  if (category) {
    return {
      isMilitary: true,
      category,
      country: null,
      confidence: 'medium',
    };
  }

  // Check callsign
  if (isCallsignMilitary(aircraft.flight)) {
    return {
      isMilitary: true,
      category: null,
      country: null,
      confidence: 'low',
    };
  }

  return {
    isMilitary: false,
    category: null,
    country: null,
    confidence: 'low',
  };
}

// Get display name for military category
export function getMilitaryCategoryLabel(category: MilitaryCategory | null): string {
  if (!category) return 'Unknown';

  const labels: Record<MilitaryCategory, string> = {
    tanker: 'Tanker/Refueler',
    awacs: 'AWACS/AEW',
    isr: 'ISR/Surveillance',
    transport: 'Transport',
    fighter: 'Fighter/Attack',
    helicopter: 'Helicopter',
    trainer: 'Trainer',
    other: 'Military',
  };

  return labels[category];
}

// Get color for military category (for map markers)
export function getMilitaryCategoryColor(category: MilitaryCategory | null): string {
  if (!category) return '#dc2626'; // red for unknown military

  const colors: Record<MilitaryCategory, string> = {
    tanker: '#f59e0b',    // amber
    awacs: '#8b5cf6',     // purple
    isr: '#06b6d4',       // cyan
    transport: '#22c55e', // green
    fighter: '#ef4444',   // red
    helicopter: '#3b82f6', // blue
    trainer: '#a855f7',   // purple
    other: '#6b7280',     // gray
  };

  return colors[category];
}
