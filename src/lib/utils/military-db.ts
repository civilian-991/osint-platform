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

// Civilian type codes that should NEVER be flagged as military
// These might otherwise match military patterns (e.g., T154 matching trainer pattern)
const CIVILIAN_TYPE_CODES: string[] = [
  // Cessna (C-prefix would match C-17, C-130, etc.)
  'C150', 'C152', 'C162', 'C170', 'C172', 'C175', 'C177', 'C180', 'C182', 'C185',
  'C188', 'C190', 'C195', 'C206', 'C207', 'C208', 'C210', 'C303', 'C310', 'C320',
  'C335', 'C336', 'C337', 'C340', 'C401', 'C402', 'C404', 'C406', 'C408', 'C411',
  'C414', 'C421', 'C425', 'C441', 'C500', 'C501', 'C510', 'C525', 'C526', 'C550',
  'C551', 'C560', 'C56X', 'C680', 'C750', 'C25A', 'C25B', 'C25C', 'C25M',
  // Cirrus
  'SR20', 'SR22', 'SF50',
  // Piper (P-prefix could match P-8)
  'P28A', 'P28B', 'P28R', 'P28S', 'P28T', 'P28U', 'P32R', 'P32T', 'P46T',
  'PA18', 'PA22', 'PA23', 'PA24', 'PA27', 'PA28', 'PA30', 'PA31', 'PA32',
  'PA34', 'PA38', 'PA44', 'PA46', 'PA60',
  // Beechcraft
  'B58', 'BE58', 'BE55', 'BE35', 'BE36', 'BE33', 'BE76', 'BE18', 'BE20', 'BE30',
  'BE40', 'BE9L', 'BE99', 'B190', 'B350', 'B300', 'B200', 'B100',
  // Tupolev (T-prefix would match trainer pattern)
  'T154', 'T134', 'T204', 'T214', 'TU54', 'TU34',
  // Fokker (F-prefix would match fighter pattern)
  'F50', 'F70', 'F100', 'F27', 'F28',
  // Airbus
  'A318', 'A319', 'A320', 'A321', 'A20N', 'A21N',
  'A330', 'A332', 'A333', 'A338', 'A339',
  'A340', 'A342', 'A343', 'A345', 'A346',
  'A350', 'A359', 'A35K',
  'A380', 'A388',
  // Boeing
  'B731', 'B732', 'B733', 'B734', 'B735', 'B736', 'B737', 'B738', 'B739',
  'B37M', 'B38M', 'B39M', 'B3XM',
  'B741', 'B742', 'B743', 'B744', 'B748', 'B74S',
  'B752', 'B753', 'B757',
  'B762', 'B763', 'B764', 'B767',
  'B772', 'B773', 'B77L', 'B77W', 'B778', 'B779',
  'B781', 'B788', 'B789', 'B78X', 'B787',
  // Embraer regional jets
  'E170', 'E175', 'E190', 'E195', 'E75L', 'E75S', 'E290', 'E295',
  // Bombardier/CRJ
  'CRJ1', 'CRJ2', 'CRJ7', 'CRJ9', 'CRJX',
  'BCS1', 'BCS3', // A220
  // ATR
  'AT43', 'AT45', 'AT72', 'AT75', 'AT76', 'ATR4', 'ATR7',
  // Dash 8
  'DH8A', 'DH8B', 'DH8C', 'DH8D',
  // Antonov civilian cargo/passenger
  'A124', 'A148', 'A158',
  // Sukhoi Superjet (civilian)
  'SU95', 'SU9F',
  // COMAC
  'C919', 'ARJ2',
  // MD/DC (civilian)
  'MD11', 'MD80', 'MD81', 'MD82', 'MD83', 'MD87', 'MD88', 'MD90',
  'DC10', 'DC87', 'DC93', 'DC94', 'DC95',
];

// Type codes for military aircraft categories
// IMPORTANT: Patterns must be specific to avoid matching civilian aircraft
const MILITARY_TYPE_PATTERNS: Record<MilitaryCategory, RegExp[]> = {
  tanker: [
    /^KC-?\d{2,3}/i,  // KC-135, KC-10, KC-46
    /^MRTT/i,         // Multi Role Tanker Transport
    /^A330.*MRTT/i,   // A330 MRTT specifically
  ],
  awacs: [
    /^E-?3[A-Z]?$/i,  // E-3 Sentry (AWACS) - must be E-3 only, not E300
    /^E-?7[A-Z]?$/i,  // E-7 Wedgetail
    /^E767/i,         // E-767
    /AWACS/i,
  ],
  isr: [
    /^RC-?135/i,      // RC-135 variants
    /^EP-?3/i,        // EP-3 Aries
    /^P-?8/i,         // P-8 Poseidon
    /^RQ-?\d/i,       // RQ-4 Global Hawk, etc.
    /^MQ-?\d/i,       // MQ-9 Reaper, etc.
    /^U-?2/i,         // U-2 Dragon Lady
    /^E-?8/i,         // E-8 JSTARS
    /JSTARS/i,
    /SENTINEL/i,
    /REAPER/i,
    /^GLEX$/i,        // Global Express (often ISR)
  ],
  transport: [
    /^C-?17/i,        // C-17 Globemaster
    /^C-?5[AM]?$/i,   // C-5 Galaxy (C-5A, C-5M)
    /^C-?130/i,       // C-130 Hercules
    /^C-?30J/i,       // C-130J
    /^C-?27/i,        // C-27 Spartan
    /^C-?2[A]?$/i,    // C-2 Greyhound
    /^A400/i,         // A400M Atlas
    /^IL-?76/i,       // Il-76 (mostly military in Middle East)
  ],
  fighter: [
    // Specific US fighters (not generic F-\d{2} which matches F50 Fokker!)
    /^F-?14/i,        // F-14 Tomcat
    /^F-?15/i,        // F-15 Eagle
    /^F-?16/i,        // F-16 Fighting Falcon
    /^F-?18/i,        // F/A-18 Hornet
    /^FA-?18/i,       // F/A-18
    /^F-?22/i,        // F-22 Raptor
    /^F-?35/i,        // F-35 Lightning II
    /^F-?4/i,         // F-4 Phantom
    /^F-?5/i,         // F-5 Tiger
    /^A-?10/i,        // A-10 Warthog
    // Russian/Soviet fighters
    /^SU-?27/i,       // Su-27 Flanker
    /^SU-?30/i,       // Su-30
    /^SU-?33/i,       // Su-33
    /^SU-?34/i,       // Su-34
    /^SU-?35/i,       // Su-35
    /^SU-?57/i,       // Su-57
    /^MIG-?\d{2}/i,   // MiG variants
    // European fighters
    /TYPHOON/i,       // Eurofighter Typhoon
    /^EF2K/i,         // Eurofighter 2000
    /RAFALE/i,        // Dassault Rafale
    /TORNADO/i,       // Panavia Tornado
    /GRIPEN/i,        // JAS 39 Gripen
    /MIRAGE/i,        // Dassault Mirage
    // Chinese fighters
    /^J-?\d{1,2}/i,   // J-10, J-11, J-20, etc.
  ],
  helicopter: [
    /^H-?60/i,        // H-60 family
    /^UH-?60/i,       // UH-60 Black Hawk
    /^AH-?64/i,       // AH-64 Apache
    /^CH-?47/i,       // CH-47 Chinook
    /^CH-?53/i,       // CH-53 Sea Stallion
    /^V-?22/i,        // V-22 Osprey
    /^MH-?53/i,       // MH-53 Pave Low
    /^MH-?60/i,       // MH-60 variants
    /^HH-?60/i,       // HH-60 Pave Hawk
    /^AH-?1/i,        // AH-1 Cobra
    /^OH-?58/i,       // OH-58 Kiowa
    /APACHE/i,
    /BLACKHAWK/i,
    /CHINOOK/i,
    /OSPREY/i,
    /^KA-?52/i,       // Ka-52 Alligator
    /^MI-?24/i,       // Mi-24 Hind
    /^MI-?28/i,       // Mi-28 Havoc
    /^MI-?35/i,       // Mi-35
  ],
  trainer: [
    // Specific trainer aircraft only (NOT generic T-\d which matches Tupolev!)
    /^T-?38/i,        // T-38 Talon
    /^T-?6[A-Z]?$/i,  // T-6 Texan II (but not T600 etc)
    /^T-?45/i,        // T-45 Goshawk
    /^T-?50/i,        // T-50 Golden Eagle
    /^T-?1[A-Z]?$/i,  // T-1 Jayhawk
    /^T-?37/i,        // T-37 Tweet
    /^PC-?21/i,       // Pilatus PC-21
    /^PC-?9/i,        // Pilatus PC-9
    /^HAWK/i,         // BAE Hawk trainer
    /TEXAN/i,
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
  // === MIDDLE EAST & NORTH AFRICA (Primary Focus) ===
  'FDB',   // FlyDubai
  'UAE',   // Emirates
  'ETD',   // Etihad
  'QTR',   // Qatar Airways
  'GFA',   // Gulf Air
  'KAC',   // Kuwait Airways
  'SVA',   // Saudia
  'MEA',   // Middle East Airlines
  'THY',   // Turkish Airlines
  'TK',    // Turkish Airlines (IATA)
  'PGT',   // Pegasus Airlines
  'PC',    // Pegasus (IATA)
  'AXB',   // Air Arabia
  'ABY',   // Air Arabia Abu Dhabi
  'G9',    // Air Arabia (IATA)
  'RJA',   // Royal Jordanian
  'RJ',    // Royal Jordanian (IATA)
  'MSR',   // EgyptAir
  'MS',    // EgyptAir (IATA)
  'MSC',   // EgyptAir Cargo
  'ELY',   // El Al
  'LY',    // El Al (IATA)
  'IRA',   // Iran Air
  'IR',    // Iran Air (IATA)
  'IRC',   // Iran Aseman Airlines
  'EP',    // Iran Aseman (IATA)
  'IRZ',   // SAHA Airlines (Iran)
  'IRM',   // Mahan Air (Iran)
  'W5',    // Mahan Air (IATA)
  'IRK',   // Kish Air (Iran)
  'SYR',   // Syrian Air
  'RB',    // Syrian Air (IATA)
  'CYP',   // Cyprus Airways
  'OMA',   // Oman Air
  'WY',    // Oman Air (IATA)
  'SAW',   // Salam Air (Oman)
  'OV',    // Salam Air (IATA)
  'NIA',   // Nile Air
  'JZR',   // Jazeera Airways (Kuwait)
  'J9',    // Jazeera Airways (IATA)
  'NAS',   // Flynas (Saudi)
  'XY',    // Flynas (IATA)
  'NSH',   // NAS Air / Flynas
  'ADY',   // Abu Dhabi Aviation
  'IAW',   // Iraqi Airways
  'IA',    // Iraqi Airways (IATA)
  'YMN',   // Yemenia
  'IY',    // Yemenia (IATA)
  'LBT',   // Nouvelair (Tunisia)
  'TUN',   // Tunisair
  'TU',    // Tunisair (IATA)
  'TAR',   // Tunis Air
  'LBY',   // Libyan Airlines
  'DAH',   // Air Algerie
  'AH',    // Air Algerie (IATA)
  'RAM',   // Royal Air Maroc
  'AT',    // Royal Air Maroc (IATA)
  'EAL',   // ALIA (former Royal Jordanian)
  'AMC',   // Air Malta

  // === TURKEY ===
  'SXS',   // Sun Express
  'XQ',    // Sun Express (IATA)
  'AJA',   // AtlasGlobal (Turkey)
  'KK',    // AtlasGlobal (IATA)
  'OHY',   // Onur Air
  '8Q',    // Onur Air (IATA)
  'THU',   // Turkish Airlines (alternate)
  'TJK',   // Corendon Airlines Turkey

  // === EUROPE ===
  'AEE',   // Aegean Airlines
  'A3',    // Aegean (IATA)
  'WZZ',   // Wizz Air
  'W6',    // Wizz Air (IATA)
  'RYR',   // Ryanair
  'FR',    // Ryanair (IATA)
  'EZY',   // EasyJet
  'U2',    // EasyJet (IATA)
  'EJU',   // EasyJet Europe
  'DLH',   // Lufthansa
  'LH',    // Lufthansa (IATA)
  'BAW',   // British Airways
  'BA',    // British Airways (IATA)
  'AFR',   // Air France
  'AF',    // Air France (IATA)
  'KLM',   // KLM
  'KL',    // KLM (IATA)
  'SWR',   // Swiss
  'LX',    // Swiss (IATA)
  'AUA',   // Austrian Airlines
  'OS',    // Austrian (IATA)
  'SAS',   // Scandinavian Airlines
  'SK',    // SAS (IATA)
  'TAP',   // TAP Portugal
  'TP',    // TAP (IATA)
  'IBE',   // Iberia
  'IB',    // Iberia (IATA)
  'VLG',   // Vueling
  'VY',    // Vueling (IATA)
  'AZA',   // ITA Airways (former Alitalia)
  'AZ',    // ITA (IATA)
  'ROT',   // TAROM
  'RO',    // TAROM (IATA)
  'LOT',   // LOT Polish
  'LO',    // LOT (IATA)
  'CSA',   // Czech Airlines
  'OK',    // Czech Airlines (IATA)
  'AFL',   // Aeroflot
  'SU',    // Aeroflot (IATA)
  'TRA',   // Transavia
  'HV',    // Transavia (IATA)
  'EWG',   // Eurowings
  'EW',    // Eurowings (IATA)
  'BEL',   // Brussels Airlines
  'SN',    // Brussels Airlines (IATA)
  'NWG',   // Norwegian
  'DY',    // Norwegian (IATA)
  'FIN',   // Finnair
  'AY',    // Finnair (IATA)
  'ICE',   // Icelandair
  'FI',    // Icelandair (IATA)
  'TUI',   // TUI Airways

  // === ASIA ===
  'THA',   // Thai Airways
  'TG',    // Thai Airways (IATA)
  'SIA',   // Singapore Airlines
  'SQ',    // Singapore (IATA)
  'CPA',   // Cathay Pacific
  'CX',    // Cathay (IATA)
  'JAL',   // Japan Airlines
  'JL',    // JAL (IATA)
  'ANA',   // All Nippon Airways
  'NH',    // ANA (IATA)
  'CES',   // China Eastern
  'MU',    // China Eastern (IATA)
  'CSN',   // China Southern
  'CZ',    // China Southern (IATA)
  'CCA',   // Air China
  'CA',    // Air China (IATA)
  'KAL',   // Korean Air
  'KE',    // Korean Air (IATA)
  'AAR',   // Asiana Airlines
  'OZ',    // Asiana (IATA)
  'MAS',   // Malaysia Airlines
  'MH',    // Malaysia Airlines (IATA)
  'GIA',   // Garuda Indonesia
  'GA',    // Garuda (IATA)
  'VNL',   // VietJet Air
  'VJ',    // VietJet (IATA)
  'HVN',   // Vietnam Airlines
  'VN',    // Vietnam Airlines (IATA)
  'CEB',   // Cebu Pacific
  '5J',    // Cebu Pacific (IATA)
  'PAL',   // Philippine Airlines
  'PR',    // Philippine Airlines (IATA)
  'AXM',   // AirAsia
  'AK',    // AirAsia (IATA)
  'AIQ',   // AirAsia India
  'XAX',   // AirAsia X
  'D7',    // AirAsia X (IATA)
  'ALK',   // SriLankan Airlines
  'UL',    // SriLankan (IATA)
  'PIA',   // Pakistan International Airlines
  'PK',    // PIA (IATA)
  'LMU',   // Loong Air (China)

  // === AMERICAS ===
  'AAL',   // American Airlines
  'AA',    // American Airlines (IATA)
  'DAL',   // Delta Air Lines
  'DL',    // Delta (IATA)
  'UAL',   // United Airlines
  'UA',    // United (IATA)
  'SWA',   // Southwest Airlines
  'WN',    // Southwest (IATA)
  'FFT',   // Frontier Airlines
  'F9',    // Frontier (IATA)
  'JBU',   // JetBlue Airways
  'B6',    // JetBlue (IATA)
  'ASA',   // Alaska Airlines
  'AS',    // Alaska (IATA)
  'ACA',   // Air Canada
  'AC',    // Air Canada (IATA)
  'SKW',   // SkyWest Airlines
  'OO',    // SkyWest (IATA)
  'ENY',   // Envoy Air
  'MQ',    // Envoy (IATA)
  'PDT',   // Piedmont Airlines
  'JIA',   // PSA Airlines
  'RPA',   // Republic Airways

  // === AFRICA ===
  'ETH',   // Ethiopian Airlines
  'ET',    // Ethiopian (IATA)
  'KQA',   // Kenya Airways
  'KQ',    // Kenya Airways (IATA)
  'SAA',   // South African Airways
  'SA',    // SAA (IATA)

  // === OCEANIA ===
  'JST',   // Jetstar
  'JQ',    // Jetstar (IATA)
  'VOZ',   // Virgin Australia
  'VA',    // Virgin Australia (IATA)
  'QFA',   // Qantas
  'QF',    // Qantas (IATA)
  'ANZ',   // Air New Zealand
  'NZ',    // Air New Zealand (IATA)
  'FJA',   // Fiji Airways
  'FJ',    // Fiji Airways (IATA)

  // === SOUTH ASIA ===
  'BIA',   // Royal Brunei Airlines
  'BI',    // Royal Brunei (IATA)

  // === CARGO (Civilian) ===
  'STW',   // Saudia Cargo
  'FDX',   // FedEx
  'UPS',   // UPS Airlines
  'GTI',   // Atlas Air
  'CLX',   // Cargolux
  'ADB',   // Antonov Design Bureau (civilian cargo ops)

  // === CHARTERS & PRIVATE ===
  'AXY',   // Executive jets
  'AWG',   // Air Bucharest
  'TCX',   // Thomas Cook (defunct but still in data)
  'MON',   // Monarch (defunct but still in data)
  'SAI',   // Shaheen Air
  'PHS',   // Philippine Sun

  // NOTE: DO NOT ADD:
  // - UAF (UAE Air Force)
  // - Any military callsigns
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

// Check if type code is a known CIVILIAN aircraft (prevents false positives)
export function isTypeCivilian(typeCode: string | null | undefined): boolean {
  if (!typeCode) return false;

  const normalized = typeCode.trim().toUpperCase();

  // Direct match against civilian type codes
  if (CIVILIAN_TYPE_CODES.includes(normalized)) {
    return true;
  }

  // Also check without dashes (e.g., A320 vs A-320)
  const withoutDash = normalized.replace(/-/g, '');
  if (CIVILIAN_TYPE_CODES.includes(withoutDash)) {
    return true;
  }

  return false;
}

// Get military category from type code
export function getMilitaryCategory(typeCode: string | null | undefined): MilitaryCategory | null {
  if (!typeCode) return null;

  // FIRST: Check if it's a known civilian type code
  if (isTypeCivilian(typeCode)) {
    return null;
  }

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

  // Check if type code is a known CIVILIAN aircraft (e.g., A320, B738, T154)
  // This prevents false positives where civilian type codes might match military patterns
  if (isTypeCivilian(aircraft.t)) {
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
