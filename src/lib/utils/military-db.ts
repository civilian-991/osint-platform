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
  /^IAF\d/i,      // Israeli Air Force
  /^IRIAF\d/i,    // Iranian Air Force
  /^THY\d/i,      // Turkish military (not THY airline)
  /^TUAF\d/i,     // Turkish Air Force
  /^UAF\d/i,      // UAE Air Force
  /^RSAF\d/i,     // Royal Saudi Air Force
  /^REAF\d/i,     // Royal Emirates Air Force
  /^QAF\d/i,      // Qatar Air Force
  /^KAF\d/i,      // Kuwait Air Force
  /^BAF\d/i,      // Bahrain Air Force
  /^OAF\d/i,      // Oman Air Force
  /^IQAF\d/i,     // Iraqi Air Force
  /^SJAF\d/i,     // Jordanian Air Force
  /^LAF\d/i,      // Lebanese Air Force
  /^EAF\d/i,      // Egyptian Air Force
];

// Callsign prefixes for CIVILIAN airlines (to exclude false positives)
const CIVILIAN_AIRLINE_PREFIXES: string[] = [
  'FDB',   // FlyDubai
  'UAE',   // Emirates
  'ETD',   // Etihad
  'QTR',   // Qatar Airways
  'GFA',   // Gulf Air
  'KAC',   // Kuwait Airways
  'SVA',   // Saudia
  'MEA',   // Middle East Airlines
  'THY',   // Turkish Airlines
  'PGT',   // Pegasus
  'AXB',   // Air Arabia
  'FJI',   // Fly Jordan
  'RJA',   // Royal Jordanian
  'MSR',   // EgyptAir
  'MSC',   // EgyptAir (alternate)
  'ELY',   // El Al
  'IRA',   // Iran Air
  'IRC',   // Iran Aseman
  'SYR',   // Syrian Air
  'LBN',   // Lebanese Airlines
  'CYP',   // Cyprus Airways
  'OMA',   // Oman Air
  'ABY',   // Air Arabia
  'NIA',   // Nile Air
  'AEE',   // Aegean
  'WZZ',   // Wizz Air
  'RYR',   // Ryanair
  'EZY',   // EasyJet
  'DLH',   // Lufthansa
  'BAW',   // British Airways
  'AFR',   // Air France
  'KLM',   // KLM
  'SWR',   // Swiss
  'AUA',   // Austrian
  'THA',   // Thai Airways
  'SIA',   // Singapore
  'CPA',   // Cathay Pacific
  'AAL',   // American
  'DAL',   // Delta
  'UAL',   // United
  'SWA',   // Southwest
  'FFT',   // Frontier
  'JBU',   // JetBlue
  'ASA',   // Alaska
  'ACA',   // Air Canada
  'JAL',   // Japan Airlines
  'ANA',   // All Nippon Airways
  'CES',   // China Eastern
  'CSN',   // China Southern
  'CCA',   // Air China
  'KAL',   // Korean Air
  'AAR',   // Asiana
  'TUI',   // TUI
  'ICE',   // Icelandair
  'FIN',   // Finnair
  'SAS',   // Scandinavian
  'TAP',   // TAP Portugal
  'IBE',   // Iberia
  'VLG',   // Vueling
  'AZA',   // Alitalia/ITA
  'ROT',   // TAROM
  'LOT',   // LOT Polish
  'CSA',   // Czech Airlines
  'AFL',   // Aeroflot
  'TRA',   // Transavia
  'EWG',   // Eurowings
  'BEL',   // Brussels Airlines
  'STW',   // Saudia Cargo (civilian)
  'LMU',   // Loong Air
  'AXY',   // Executive jets (often private)
  'AWG',   // Air Bucharest
  'ADY',   // Abu Dhabi Aviation
  'ETH',   // Ethiopian Airlines
  'KQA',   // Kenya Airways
  'SAA',   // South African Airways
  'RAM',   // Royal Air Maroc
  'TUN',   // Tunisair
  'ALK',   // SriLankan Airlines
  'PIA',   // Pakistan International
  'BIA',   // Royal Brunei
  'MAS',   // Malaysia Airlines
  'GIA',   // Garuda Indonesia
  'VNL',   // VietJet
  'HVN',   // Vietnam Airlines
  'CEB',   // Cebu Pacific
  'PAL',   // Philippine Airlines
  'AXM',   // AirAsia
  'AIQ',   // AirAsia India
  'JST',   // Jetstar
  'VOZ',   // Virgin Australia
  'QFA',   // Qantas
  'ANZ',   // Air New Zealand
  'FJA',   // Fiji Airways
  'UAE',   // Emirates (duplicate intentional)
  // NOTE: UAF = UAE Air Force - do NOT add to civilian list!
  'NSH',   // NAS Air / FlyNas
  'SAI',   // Shaheen Air
  'PHS',   // Philippine Sun
  'SXS',   // Sun Express
  'XAX',   // AirAsia X
  'SKW',   // SkyWest
  'ENY',   // Envoy Air
  'PDT',   // Piedmont Airlines
  'JIA',   // PSA Airlines
  'RPA',   // Republic Airways
  'TCX',   // Thomas Cook
  'MON',   // Monarch
  'NWG',   // Norwegian
  'DY',    // Norwegian (alternate)
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

// Check if callsign is a CIVILIAN airline (to exclude false positives)
export function isCallsignCivilian(callsign: string | null | undefined): boolean {
  if (!callsign) return false;

  const normalized = callsign.trim().toUpperCase();

  // Check against known civilian airline prefixes
  for (const prefix of CIVILIAN_AIRLINE_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return true;
    }
  }

  return false;
}

// Keywords that indicate civilian operators
const CIVILIAN_OPERATOR_KEYWORDS = [
  'AIRLINES', 'AIRWAYS', 'AIRLINE', 'AIRWAY',
  'AVIATION', 'CARGO', 'FREIGHT', 'EXPRESS',
  'JET', 'FLY', 'TRAVEL', 'TOUR',
  'PRIVATE', 'CHARTER', 'EXECUTIVE',
  'LEASING', 'RENTAL',
];

// Known civilian operators (check operator field, not callsign)
const CIVILIAN_OPERATORS = [
  'FLYDUBAI', 'FLY DUBAI',
  'EMIRATES', 'EMIRATES AIRLINE',
  'ETIHAD', 'ETIHAD AIRWAYS',
  'QATAR', 'QATAR AIRWAYS',
  'GULF AIR',
  'KUWAIT AIRWAYS',
  'SAUDIA', 'SAUDI ARABIAN',
  'MIDDLE EAST AIRLINES', 'MEA',
  'TURKISH AIRLINES', 'THY',
  'PEGASUS',
  'EGYPTAIR', 'EGYPT AIR',
  'EL AL', 'ELAL',
  'IRAN AIR',
  'ROYAL JORDANIAN',
  'OMAN AIR',
  'AIR ARABIA',
  'JAZEERA AIRWAYS',
  'FLYNAS', 'NASAIR',
  'LUFTHANSA',
  'BRITISH AIRWAYS',
  'AIR FRANCE',
  'KLM',
  'RYANAIR',
  'EASYJET',
  'WIZZ AIR',
  'DELTA', 'AMERICAN AIRLINES', 'UNITED AIRLINES',
  'SOUTHWEST',
];

// Check if operator indicates civilian
export function isOperatorCivilian(operator: string | null | undefined): boolean {
  if (!operator) return false;

  const normalized = operator.trim().toUpperCase();

  // Check against known civilian operators
  for (const civOp of CIVILIAN_OPERATORS) {
    if (normalized.includes(civOp)) {
      return true;
    }
  }

  // Check for civilian keywords
  for (const keyword of CIVILIAN_OPERATOR_KEYWORDS) {
    if (normalized.includes(keyword)) {
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
  // FIRST: Check if it's a known civilian airline - these are NEVER military
  // This catches false positives from upstream APIs that incorrectly flag civilian aircraft
  if (isCallsignCivilian(aircraft.flight)) {
    return {
      isMilitary: false,
      category: null,
      country: null,
      confidence: 'high',
    };
  }

  // Also check operator field for civilian indicators
  if (isOperatorCivilian(aircraft.ownOp)) {
    return {
      isMilitary: false,
      category: null,
      country: null,
      confidence: 'high',
    };
  }

  // Also check description field which sometimes contains operator info
  if (isOperatorCivilian(aircraft.desc)) {
    return {
      isMilitary: false,
      category: null,
      country: null,
      confidence: 'high',
    };
  }

  // Check type code - military aircraft types are reliable indicators
  const category = getMilitaryCategory(aircraft.t);
  if (category) {
    // But check if operator is civilian (some civilian ops use military-looking type codes)
    if (!isOperatorCivilian(aircraft.ownOp) && !isOperatorCivilian(aircraft.desc)) {
      return {
        isMilitary: true,
        category,
        country: null,
        confidence: 'high',
      };
    }
  }

  // Check callsign for military patterns
  if (isCallsignMilitary(aircraft.flight)) {
    return {
      isMilitary: true,
      category: category || null,
      country: null,
      confidence: 'medium',
    };
  }

  // Check ICAO hex range - but ONLY for USA military range (most reliable)
  // Other countries mix civilian and military in the same hex allocations
  const hexCheck = isHexMilitary(aircraft.hex);
  if (hexCheck.isMilitary && hexCheck.country === 'USA') {
    return {
      isMilitary: true,
      category: category || 'other',
      country: 'USA',
      confidence: 'high',
    };
  }

  // If upstream flagged as military AND we have supporting evidence (hex or type)
  if (aircraft.mil === true) {
    // Only trust upstream mil flag if hex is in a military range
    if (hexCheck.isMilitary) {
      return {
        isMilitary: true,
        category: category || 'other',
        country: hexCheck.country || null,
        confidence: 'medium',
      };
    }
    // Or if there's no civilian indicators at all and no callsign (unknown aircraft)
    if (!aircraft.flight && !aircraft.ownOp && !aircraft.desc) {
      return {
        isMilitary: true,
        category: category || 'other',
        country: null,
        confidence: 'low',
      };
    }
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
