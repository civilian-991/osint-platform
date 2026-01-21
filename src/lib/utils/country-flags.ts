/**
 * Country flag utility based on ICAO hex ranges
 * Returns emoji flag based on aircraft ICAO hex code
 */

interface CountryRange {
  start: number;
  end: number;
  country: string;
  flag: string;
}

// ICAO hex ranges by country (comprehensive list)
const ICAO_COUNTRY_RANGES: CountryRange[] = [
  // United States
  { start: 0xA00000, end: 0xAFFFFF, country: 'United States', flag: '🇺🇸' },
  // Russia
  { start: 0x100000, end: 0x1FFFFF, country: 'Russia', flag: '🇷🇺' },
  // China
  { start: 0x780000, end: 0x7FFFFF, country: 'China', flag: '🇨🇳' },
  // United Kingdom
  { start: 0x400000, end: 0x43FFFF, country: 'United Kingdom', flag: '🇬🇧' },
  // Germany
  { start: 0x3C0000, end: 0x3FFFFF, country: 'Germany', flag: '🇩🇪' },
  // France
  { start: 0x380000, end: 0x3BFFFF, country: 'France', flag: '🇫🇷' },
  // Italy
  { start: 0x300000, end: 0x33FFFF, country: 'Italy', flag: '🇮🇹' },
  // Spain
  { start: 0x340000, end: 0x37FFFF, country: 'Spain', flag: '🇪🇸' },
  // Australia
  { start: 0x7C0000, end: 0x7FFFFF, country: 'Australia', flag: '🇦🇺' },
  // Japan
  { start: 0x840000, end: 0x87FFFF, country: 'Japan', flag: '🇯🇵' },
  // South Korea
  { start: 0x710000, end: 0x717FFF, country: 'South Korea', flag: '🇰🇷' },
  // India
  { start: 0x800000, end: 0x83FFFF, country: 'India', flag: '🇮🇳' },
  // Canada
  { start: 0xC00000, end: 0xC3FFFF, country: 'Canada', flag: '🇨🇦' },
  // Brazil
  { start: 0xE40000, end: 0xE7FFFF, country: 'Brazil', flag: '🇧🇷' },
  // Israel
  { start: 0x738000, end: 0x73FFFF, country: 'Israel', flag: '🇮🇱' },
  // Turkey
  { start: 0x4B0000, end: 0x4B7FFF, country: 'Turkey', flag: '🇹🇷' },
  // Saudi Arabia
  { start: 0x710000, end: 0x713FFF, country: 'Saudi Arabia', flag: '🇸🇦' },
  // UAE
  { start: 0x896000, end: 0x896FFF, country: 'UAE', flag: '🇦🇪' },
  // Qatar
  { start: 0x06A000, end: 0x06AFFF, country: 'Qatar', flag: '🇶🇦' },
  // Kuwait
  { start: 0x706000, end: 0x706FFF, country: 'Kuwait', flag: '🇰🇼' },
  // Egypt
  { start: 0x010000, end: 0x017FFF, country: 'Egypt', flag: '🇪🇬' },
  // Iran
  { start: 0x730000, end: 0x737FFF, country: 'Iran', flag: '🇮🇷' },
  // Iraq
  { start: 0x728000, end: 0x72FFFF, country: 'Iraq', flag: '🇮🇶' },
  // Pakistan
  { start: 0x760000, end: 0x767FFF, country: 'Pakistan', flag: '🇵🇰' },
  // Netherlands
  { start: 0x480000, end: 0x487FFF, country: 'Netherlands', flag: '🇳🇱' },
  // Belgium
  { start: 0x448000, end: 0x44FFFF, country: 'Belgium', flag: '🇧🇪' },
  // Poland
  { start: 0x488000, end: 0x48FFFF, country: 'Poland', flag: '🇵🇱' },
  // Sweden
  { start: 0x4A0000, end: 0x4A7FFF, country: 'Sweden', flag: '🇸🇪' },
  // Norway
  { start: 0x478000, end: 0x47FFFF, country: 'Norway', flag: '🇳🇴' },
  // Denmark
  { start: 0x458000, end: 0x45FFFF, country: 'Denmark', flag: '🇩🇰' },
  // Greece
  { start: 0x468000, end: 0x46FFFF, country: 'Greece', flag: '🇬🇷' },
  // Singapore
  { start: 0x768000, end: 0x76FFFF, country: 'Singapore', flag: '🇸🇬' },
  // Indonesia
  { start: 0x8A0000, end: 0x8AFFFF, country: 'Indonesia', flag: '🇮🇩' },
  // Malaysia
  { start: 0x750000, end: 0x757FFF, country: 'Malaysia', flag: '🇲🇾' },
  // Thailand
  { start: 0x880000, end: 0x887FFF, country: 'Thailand', flag: '🇹🇭' },
  // Vietnam
  { start: 0x888000, end: 0x88FFFF, country: 'Vietnam', flag: '🇻🇳' },
  // Philippines
  { start: 0x758000, end: 0x75FFFF, country: 'Philippines', flag: '🇵🇭' },
  // South Africa
  { start: 0x008000, end: 0x00FFFF, country: 'South Africa', flag: '🇿🇦' },
  // Mexico
  { start: 0x0D0000, end: 0x0D7FFF, country: 'Mexico', flag: '🇲🇽' },
  // Argentina
  { start: 0xE00000, end: 0xE3FFFF, country: 'Argentina', flag: '🇦🇷' },
  // Ukraine
  { start: 0x508000, end: 0x50FFFF, country: 'Ukraine', flag: '🇺🇦' },
  // Czech Republic
  { start: 0x498000, end: 0x49FFFF, country: 'Czech Republic', flag: '🇨🇿' },
  // Portugal
  { start: 0x490000, end: 0x497FFF, country: 'Portugal', flag: '🇵🇹' },
  // Switzerland
  { start: 0x4B8000, end: 0x4BFFFF, country: 'Switzerland', flag: '🇨🇭' },
  // Austria
  { start: 0x440000, end: 0x447FFF, country: 'Austria', flag: '🇦🇹' },
  // Finland
  { start: 0x460000, end: 0x467FFF, country: 'Finland', flag: '🇫🇮' },
  // Ireland
  { start: 0x4C0000, end: 0x4C7FFF, country: 'Ireland', flag: '🇮🇪' },
  // New Zealand
  { start: 0xC80000, end: 0xC87FFF, country: 'New Zealand', flag: '🇳🇿' },
  // Morocco
  { start: 0x060000, end: 0x067FFF, country: 'Morocco', flag: '🇲🇦' },
  // Algeria
  { start: 0x0A0000, end: 0x0A7FFF, country: 'Algeria', flag: '🇩🇿' },
  // Jordan
  { start: 0x740000, end: 0x747FFF, country: 'Jordan', flag: '🇯🇴' },
  // Lebanon
  { start: 0x748000, end: 0x74FFFF, country: 'Lebanon', flag: '🇱🇧' },
  // Syria
  { start: 0x778000, end: 0x77FFFF, country: 'Syria', flag: '🇸🇾' },
  // Oman
  { start: 0x704000, end: 0x704FFF, country: 'Oman', flag: '🇴🇲' },
  // Bahrain
  { start: 0x894000, end: 0x894FFF, country: 'Bahrain', flag: '🇧🇭' },
  // NATO/International
  { start: 0x0E0000, end: 0x0EFFFF, country: 'NATO', flag: '🔷' },
];

/**
 * Get country info from ICAO hex code
 */
export function getCountryFromHex(hex: string): { country: string; flag: string } | null {
  if (!hex) return null;

  const hexNum = parseInt(hex, 16);
  if (isNaN(hexNum)) return null;

  for (const range of ICAO_COUNTRY_RANGES) {
    if (hexNum >= range.start && hexNum <= range.end) {
      return { country: range.country, flag: range.flag };
    }
  }

  return null;
}

/**
 * Get just the flag emoji for an ICAO hex
 */
export function getFlagFromHex(hex: string): string {
  const info = getCountryFromHex(hex);
  return info?.flag || '🌐';
}

/**
 * Get country name from ICAO hex
 */
export function getCountryNameFromHex(hex: string): string {
  const info = getCountryFromHex(hex);
  return info?.country || 'Unknown';
}
