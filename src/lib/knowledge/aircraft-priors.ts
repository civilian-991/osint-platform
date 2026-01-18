/**
 * Aircraft Priors Knowledge Library
 * Cold-start behavioral priors for new aircraft based on type and characteristics
 */

import type { MilitaryCategory } from '@/lib/types/aircraft';

export interface AircraftPrior {
  typeCode: string;
  name: string;
  category: MilitaryCategory;
  // Performance characteristics
  typicalAltitude: { min: number; max: number; cruise: number }; // feet
  typicalSpeed: { min: number; max: number; cruise: number }; // knots
  maxClimbRate: number; // feet per minute
  maxRange: number; // nautical miles
  // Behavioral priors
  typicalMissionDuration: { min: number; max: number }; // hours
  typicalPatterns: string[];
  operatingRegions: string[]; // region codes
  // Anomaly detection priors
  anomalyThresholds: {
    altitudeDeviation: number; // feet from typical
    speedDeviation: number; // knots from typical
    unusualRegion: boolean; // alert if outside typical regions
  };
  // Intent classification priors
  intentPriors: {
    reconnaissance: number;
    transport: number;
    training: number;
    combat: number;
    refueling: number;
    patrol: number;
  };
  // Additional metadata
  description: string;
  operators: string[];
}

export const AIRCRAFT_PRIORS: Record<string, AircraftPrior> = {
  // ================================================
  // Tankers
  // ================================================
  KC135: {
    typeCode: 'KC135',
    name: 'KC-135 Stratotanker',
    category: 'tanker',
    typicalAltitude: { min: 25000, max: 40000, cruise: 35000 },
    typicalSpeed: { min: 350, max: 530, cruise: 460 },
    maxClimbRate: 3000,
    maxRange: 1500,
    typicalMissionDuration: { min: 3, max: 12 },
    typicalPatterns: ['racetrack', 'orbit'],
    operatingRegions: ['ME', 'EU', 'PAC'],
    anomalyThresholds: {
      altitudeDeviation: 10000,
      speedDeviation: 100,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.05,
      transport: 0.05,
      training: 0.15,
      combat: 0.05,
      refueling: 0.65,
      patrol: 0.05,
    },
    description: 'Primary USAF aerial refueling aircraft',
    operators: ['USAF', 'ANG', 'AFRC'],
  },
  KC10: {
    typeCode: 'KC10',
    name: 'KC-10 Extender',
    category: 'tanker',
    typicalAltitude: { min: 28000, max: 42000, cruise: 37000 },
    typicalSpeed: { min: 350, max: 550, cruise: 500 },
    maxClimbRate: 3500,
    maxRange: 4400,
    typicalMissionDuration: { min: 4, max: 14 },
    typicalPatterns: ['racetrack', 'orbit', 'straight'],
    operatingRegions: ['ME', 'EU', 'PAC'],
    anomalyThresholds: {
      altitudeDeviation: 8000,
      speedDeviation: 80,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.02,
      transport: 0.15,
      training: 0.08,
      combat: 0.05,
      refueling: 0.65,
      patrol: 0.05,
    },
    description: 'USAF aerial refueling and cargo aircraft',
    operators: ['USAF'],
  },
  KC46: {
    typeCode: 'KC46',
    name: 'KC-46A Pegasus',
    category: 'tanker',
    typicalAltitude: { min: 28000, max: 43000, cruise: 40000 },
    typicalSpeed: { min: 380, max: 570, cruise: 500 },
    maxClimbRate: 4000,
    maxRange: 6385,
    typicalMissionDuration: { min: 3, max: 12 },
    typicalPatterns: ['racetrack', 'orbit'],
    operatingRegions: ['ME', 'EU', 'PAC'],
    anomalyThresholds: {
      altitudeDeviation: 8000,
      speedDeviation: 80,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.02,
      transport: 0.10,
      training: 0.10,
      combat: 0.03,
      refueling: 0.70,
      patrol: 0.05,
    },
    description: 'USAF next-generation aerial refueling tanker',
    operators: ['USAF'],
  },

  // ================================================
  // AWACS / AEW&C
  // ================================================
  E3TF: {
    typeCode: 'E3TF',
    name: 'E-3 Sentry AWACS',
    category: 'awacs',
    typicalAltitude: { min: 25000, max: 35000, cruise: 30000 },
    typicalSpeed: { min: 300, max: 450, cruise: 380 },
    maxClimbRate: 2500,
    maxRange: 4600,
    typicalMissionDuration: { min: 6, max: 12 },
    typicalPatterns: ['racetrack', 'orbit'],
    operatingRegions: ['ME', 'EU', 'PAC'],
    anomalyThresholds: {
      altitudeDeviation: 8000,
      speedDeviation: 80,
      unusualRegion: true,
    },
    intentPriors: {
      reconnaissance: 0.40,
      transport: 0.0,
      training: 0.10,
      combat: 0.30,
      refueling: 0.0,
      patrol: 0.20,
    },
    description: 'Airborne Warning and Control System',
    operators: ['USAF', 'NATO', 'RAF', 'JASDF'],
  },
  E7WW: {
    typeCode: 'E7WW',
    name: 'E-7 Wedgetail',
    category: 'awacs',
    typicalAltitude: { min: 28000, max: 40000, cruise: 35000 },
    typicalSpeed: { min: 350, max: 500, cruise: 450 },
    maxClimbRate: 3500,
    maxRange: 4000,
    typicalMissionDuration: { min: 8, max: 14 },
    typicalPatterns: ['racetrack', 'orbit'],
    operatingRegions: ['ME', 'EU', 'PAC', 'AU'],
    anomalyThresholds: {
      altitudeDeviation: 7000,
      speedDeviation: 70,
      unusualRegion: true,
    },
    intentPriors: {
      reconnaissance: 0.45,
      transport: 0.0,
      training: 0.10,
      combat: 0.25,
      refueling: 0.0,
      patrol: 0.20,
    },
    description: 'Boeing 737 AEW&C aircraft',
    operators: ['RAAF', 'RAF', 'ROKAF', 'JASDF'],
  },

  // ================================================
  // ISR / Reconnaissance
  // ================================================
  RC135: {
    typeCode: 'RC135',
    name: 'RC-135 Rivet Joint',
    category: 'isr',
    typicalAltitude: { min: 30000, max: 45000, cruise: 38000 },
    typicalSpeed: { min: 380, max: 520, cruise: 460 },
    maxClimbRate: 3000,
    maxRange: 4500,
    typicalMissionDuration: { min: 8, max: 16 },
    typicalPatterns: ['racetrack', 'orbit'],
    operatingRegions: ['ME', 'EU', 'PAC', 'RU_BORDER'],
    anomalyThresholds: {
      altitudeDeviation: 10000,
      speedDeviation: 60,
      unusualRegion: true,
    },
    intentPriors: {
      reconnaissance: 0.85,
      transport: 0.0,
      training: 0.05,
      combat: 0.05,
      refueling: 0.0,
      patrol: 0.05,
    },
    description: 'SIGINT reconnaissance aircraft',
    operators: ['USAF', 'RAF'],
  },
  RQ4: {
    typeCode: 'RQ4',
    name: 'RQ-4 Global Hawk',
    category: 'isr',
    typicalAltitude: { min: 50000, max: 65000, cruise: 60000 },
    typicalSpeed: { min: 280, max: 380, cruise: 340 },
    maxClimbRate: 1500,
    maxRange: 8700,
    typicalMissionDuration: { min: 20, max: 36 },
    typicalPatterns: ['racetrack', 'orbit'],
    operatingRegions: ['ME', 'EU', 'PAC', 'RU_BORDER', 'CN_BORDER'],
    anomalyThresholds: {
      altitudeDeviation: 15000,
      speedDeviation: 50,
      unusualRegion: true,
    },
    intentPriors: {
      reconnaissance: 0.95,
      transport: 0.0,
      training: 0.02,
      combat: 0.0,
      refueling: 0.0,
      patrol: 0.03,
    },
    description: 'High-altitude ISR UAV',
    operators: ['USAF', 'USN', 'NATO', 'JASDF'],
  },
  U2: {
    typeCode: 'U2',
    name: 'U-2 Dragon Lady',
    category: 'isr',
    typicalAltitude: { min: 60000, max: 75000, cruise: 70000 },
    typicalSpeed: { min: 350, max: 450, cruise: 410 },
    maxClimbRate: 5000,
    maxRange: 6000,
    typicalMissionDuration: { min: 8, max: 12 },
    typicalPatterns: ['straight', 'orbit'],
    operatingRegions: ['ME', 'EU', 'PAC', 'CONUS'],
    anomalyThresholds: {
      altitudeDeviation: 10000,
      speedDeviation: 50,
      unusualRegion: true,
    },
    intentPriors: {
      reconnaissance: 0.90,
      transport: 0.0,
      training: 0.05,
      combat: 0.0,
      refueling: 0.0,
      patrol: 0.05,
    },
    description: 'High-altitude reconnaissance aircraft',
    operators: ['USAF'],
  },

  // ================================================
  // Fighters
  // ================================================
  F15: {
    typeCode: 'F15',
    name: 'F-15 Eagle/Strike Eagle',
    category: 'fighter',
    typicalAltitude: { min: 15000, max: 50000, cruise: 35000 },
    typicalSpeed: { min: 350, max: 650, cruise: 500 },
    maxClimbRate: 50000,
    maxRange: 1200,
    typicalMissionDuration: { min: 1, max: 4 },
    typicalPatterns: ['racetrack', 'orbit', 'straight'],
    operatingRegions: ['ME', 'EU', 'PAC', 'CONUS'],
    anomalyThresholds: {
      altitudeDeviation: 15000,
      speedDeviation: 150,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.05,
      transport: 0.0,
      training: 0.30,
      combat: 0.40,
      refueling: 0.0,
      patrol: 0.25,
    },
    description: 'Air superiority / strike fighter',
    operators: ['USAF', 'JASDF', 'RSAF', 'IAF'],
  },
  F16: {
    typeCode: 'F16',
    name: 'F-16 Fighting Falcon',
    category: 'fighter',
    typicalAltitude: { min: 10000, max: 50000, cruise: 30000 },
    typicalSpeed: { min: 350, max: 700, cruise: 500 },
    maxClimbRate: 50000,
    maxRange: 1200,
    typicalMissionDuration: { min: 1, max: 3 },
    typicalPatterns: ['racetrack', 'orbit', 'straight'],
    operatingRegions: ['ME', 'EU', 'PAC', 'CONUS'],
    anomalyThresholds: {
      altitudeDeviation: 15000,
      speedDeviation: 150,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.05,
      transport: 0.0,
      training: 0.35,
      combat: 0.35,
      refueling: 0.0,
      patrol: 0.25,
    },
    description: 'Multi-role fighter',
    operators: ['USAF', 'NATO', 'IAF', 'PAF'],
  },
  F22: {
    typeCode: 'F22',
    name: 'F-22 Raptor',
    category: 'fighter',
    typicalAltitude: { min: 20000, max: 60000, cruise: 45000 },
    typicalSpeed: { min: 400, max: 750, cruise: 550 },
    maxClimbRate: 62000,
    maxRange: 1600,
    typicalMissionDuration: { min: 1.5, max: 4 },
    typicalPatterns: ['racetrack', 'orbit'],
    operatingRegions: ['ME', 'EU', 'PAC', 'CONUS'],
    anomalyThresholds: {
      altitudeDeviation: 15000,
      speedDeviation: 150,
      unusualRegion: true,
    },
    intentPriors: {
      reconnaissance: 0.10,
      transport: 0.0,
      training: 0.25,
      combat: 0.45,
      refueling: 0.0,
      patrol: 0.20,
    },
    description: 'Stealth air superiority fighter',
    operators: ['USAF'],
  },
  F35: {
    typeCode: 'F35',
    name: 'F-35 Lightning II',
    category: 'fighter',
    typicalAltitude: { min: 15000, max: 50000, cruise: 35000 },
    typicalSpeed: { min: 350, max: 650, cruise: 500 },
    maxClimbRate: 40000,
    maxRange: 1200,
    typicalMissionDuration: { min: 1.5, max: 4 },
    typicalPatterns: ['racetrack', 'orbit', 'straight'],
    operatingRegions: ['ME', 'EU', 'PAC', 'CONUS'],
    anomalyThresholds: {
      altitudeDeviation: 15000,
      speedDeviation: 150,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.15,
      transport: 0.0,
      training: 0.25,
      combat: 0.40,
      refueling: 0.0,
      patrol: 0.20,
    },
    description: 'Multi-role stealth fighter',
    operators: ['USAF', 'USN', 'USMC', 'RAF', 'RAAF', 'IAF', 'JASDF'],
  },

  // ================================================
  // Transport
  // ================================================
  C17: {
    typeCode: 'C17',
    name: 'C-17 Globemaster III',
    category: 'transport',
    typicalAltitude: { min: 25000, max: 45000, cruise: 35000 },
    typicalSpeed: { min: 350, max: 500, cruise: 450 },
    maxClimbRate: 2900,
    maxRange: 2400,
    typicalMissionDuration: { min: 2, max: 12 },
    typicalPatterns: ['straight'],
    operatingRegions: ['GLOBAL'],
    anomalyThresholds: {
      altitudeDeviation: 10000,
      speedDeviation: 80,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.0,
      transport: 0.85,
      training: 0.05,
      combat: 0.0,
      refueling: 0.0,
      patrol: 0.10,
    },
    description: 'Strategic and tactical airlift',
    operators: ['USAF', 'RAF', 'RAAF', 'NATO'],
  },
  C130: {
    typeCode: 'C130',
    name: 'C-130 Hercules',
    category: 'transport',
    typicalAltitude: { min: 15000, max: 30000, cruise: 25000 },
    typicalSpeed: { min: 250, max: 360, cruise: 320 },
    maxClimbRate: 1900,
    maxRange: 2050,
    typicalMissionDuration: { min: 2, max: 10 },
    typicalPatterns: ['straight', 'orbit'],
    operatingRegions: ['GLOBAL'],
    anomalyThresholds: {
      altitudeDeviation: 10000,
      speedDeviation: 60,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.05,
      transport: 0.75,
      training: 0.10,
      combat: 0.0,
      refueling: 0.0,
      patrol: 0.10,
    },
    description: 'Tactical airlift',
    operators: ['USAF', 'USN', 'USMC', 'ANG', 'NATO'],
  },
};

/**
 * Get aircraft prior by type code
 */
export function getAircraftPrior(typeCode: string): AircraftPrior | undefined {
  // Try exact match first
  if (AIRCRAFT_PRIORS[typeCode]) {
    return AIRCRAFT_PRIORS[typeCode];
  }

  // Try prefix match (e.g., F15E -> F15)
  for (const [key, prior] of Object.entries(AIRCRAFT_PRIORS)) {
    if (typeCode.startsWith(key) || key.startsWith(typeCode)) {
      return prior;
    }
  }

  return undefined;
}

/**
 * Get default prior for a military category
 */
export function getDefaultPriorByCategory(category: MilitaryCategory): Partial<AircraftPrior> {
  const defaults: Record<MilitaryCategory, Partial<AircraftPrior>> = {
    tanker: {
      typicalAltitude: { min: 25000, max: 40000, cruise: 35000 },
      typicalSpeed: { min: 350, max: 520, cruise: 450 },
      intentPriors: { reconnaissance: 0.05, transport: 0.10, training: 0.10, combat: 0.05, refueling: 0.65, patrol: 0.05 },
    },
    awacs: {
      typicalAltitude: { min: 25000, max: 38000, cruise: 32000 },
      typicalSpeed: { min: 320, max: 480, cruise: 400 },
      intentPriors: { reconnaissance: 0.40, transport: 0.0, training: 0.10, combat: 0.25, refueling: 0.0, patrol: 0.25 },
    },
    isr: {
      typicalAltitude: { min: 30000, max: 60000, cruise: 45000 },
      typicalSpeed: { min: 300, max: 500, cruise: 400 },
      intentPriors: { reconnaissance: 0.85, transport: 0.0, training: 0.05, combat: 0.05, refueling: 0.0, patrol: 0.05 },
    },
    transport: {
      typicalAltitude: { min: 20000, max: 40000, cruise: 32000 },
      typicalSpeed: { min: 280, max: 480, cruise: 400 },
      intentPriors: { reconnaissance: 0.0, transport: 0.80, training: 0.05, combat: 0.0, refueling: 0.0, patrol: 0.15 },
    },
    fighter: {
      typicalAltitude: { min: 15000, max: 50000, cruise: 35000 },
      typicalSpeed: { min: 350, max: 650, cruise: 500 },
      intentPriors: { reconnaissance: 0.05, transport: 0.0, training: 0.30, combat: 0.35, refueling: 0.0, patrol: 0.30 },
    },
    helicopter: {
      typicalAltitude: { min: 500, max: 10000, cruise: 5000 },
      typicalSpeed: { min: 80, max: 180, cruise: 140 },
      intentPriors: { reconnaissance: 0.20, transport: 0.30, training: 0.20, combat: 0.15, refueling: 0.0, patrol: 0.15 },
    },
    trainer: {
      typicalAltitude: { min: 5000, max: 25000, cruise: 15000 },
      typicalSpeed: { min: 200, max: 450, cruise: 350 },
      intentPriors: { reconnaissance: 0.0, transport: 0.0, training: 0.90, combat: 0.0, refueling: 0.0, patrol: 0.10 },
    },
    other: {
      typicalAltitude: { min: 10000, max: 40000, cruise: 30000 },
      typicalSpeed: { min: 250, max: 500, cruise: 400 },
      intentPriors: { reconnaissance: 0.20, transport: 0.20, training: 0.20, combat: 0.20, refueling: 0.0, patrol: 0.20 },
    },
  };

  return defaults[category];
}

/**
 * Check if altitude is anomalous for aircraft type
 */
export function isAltitudeAnomalous(
  typeCode: string,
  altitude: number,
  category?: MilitaryCategory
): { anomalous: boolean; deviation: number; threshold: number } {
  const prior = getAircraftPrior(typeCode);
  const defaults = category ? getDefaultPriorByCategory(category) : undefined;
  const typicalAlt = prior?.typicalAltitude || defaults?.typicalAltitude || { min: 10000, max: 45000, cruise: 30000 };
  const threshold = prior?.anomalyThresholds?.altitudeDeviation || 15000;

  const deviation = altitude < typicalAlt.min
    ? typicalAlt.min - altitude
    : altitude > typicalAlt.max
      ? altitude - typicalAlt.max
      : 0;

  return {
    anomalous: deviation > threshold,
    deviation,
    threshold,
  };
}

/**
 * Check if speed is anomalous for aircraft type
 */
export function isSpeedAnomalous(
  typeCode: string,
  speed: number,
  category?: MilitaryCategory
): { anomalous: boolean; deviation: number; threshold: number } {
  const prior = getAircraftPrior(typeCode);
  const defaults = category ? getDefaultPriorByCategory(category) : undefined;
  const typicalSpeed = prior?.typicalSpeed || defaults?.typicalSpeed || { min: 250, max: 550, cruise: 400 };
  const threshold = prior?.anomalyThresholds?.speedDeviation || 100;

  const deviation = speed < typicalSpeed.min
    ? typicalSpeed.min - speed
    : speed > typicalSpeed.max
      ? speed - typicalSpeed.max
      : 0;

  return {
    anomalous: deviation > threshold,
    deviation,
    threshold,
  };
}

/**
 * Get intent priors for aircraft type
 */
export function getIntentPriors(
  typeCode: string,
  category?: MilitaryCategory
): Record<string, number> {
  const prior = getAircraftPrior(typeCode);
  const defaults = category ? getDefaultPriorByCategory(category) : undefined;

  return prior?.intentPriors || defaults?.intentPriors || {
    reconnaissance: 0.2,
    transport: 0.2,
    training: 0.2,
    combat: 0.2,
    refueling: 0.0,
    patrol: 0.2,
  };
}

/**
 * Apply aircraft prior to create initial behavioral profile values
 * Used for cold-start when no historical data exists
 */
export function applyPriorToProfile(prior: AircraftPrior): {
  typical_patterns: Array<{ pattern: string; frequency: number }>;
  altitude_min: number;
  altitude_max: number;
  altitude_avg: number;
  speed_min: number;
  speed_max: number;
  speed_avg: number;
} {
  // Convert typical patterns to frequency distribution
  const patternCount = prior.typicalPatterns.length;
  const typical_patterns = prior.typicalPatterns.map((pattern) => ({
    pattern,
    frequency: 1.0 / patternCount, // Equal distribution initially
  }));

  return {
    typical_patterns,
    altitude_min: prior.typicalAltitude.min,
    altitude_max: prior.typicalAltitude.max,
    altitude_avg: prior.typicalAltitude.cruise,
    speed_min: prior.typicalSpeed.min,
    speed_max: prior.typicalSpeed.max,
    speed_avg: prior.typicalSpeed.cruise,
  };
}
