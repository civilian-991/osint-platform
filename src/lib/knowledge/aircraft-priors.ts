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
  MQ4C: {
    typeCode: 'MQ4C',
    name: 'MQ-4C Triton',
    category: 'isr',
    typicalAltitude: { min: 50000, max: 60000, cruise: 55000 },
    typicalSpeed: { min: 280, max: 380, cruise: 340 },
    maxClimbRate: 1500,
    maxRange: 8200,
    typicalMissionDuration: { min: 24, max: 30 },
    typicalPatterns: ['racetrack', 'orbit'],
    operatingRegions: ['PAC', 'ME', 'ATLANTIC'],
    anomalyThresholds: {
      altitudeDeviation: 15000,
      speedDeviation: 50,
      unusualRegion: true,
    },
    intentPriors: {
      reconnaissance: 0.70,
      transport: 0.0,
      training: 0.05,
      combat: 0.0,
      refueling: 0.0,
      patrol: 0.25,
    },
    description: 'Maritime surveillance UAV based on Global Hawk platform',
    operators: ['USN', 'RAAF'],
  },
  P8: {
    typeCode: 'P8',
    name: 'P-8A Poseidon',
    category: 'isr',
    typicalAltitude: { min: 200, max: 41000, cruise: 25000 },
    typicalSpeed: { min: 180, max: 490, cruise: 400 },
    maxClimbRate: 3500,
    maxRange: 4500,
    typicalMissionDuration: { min: 4, max: 10 },
    typicalPatterns: ['racetrack', 'orbit', 'straight'],
    operatingRegions: ['PAC', 'ME', 'ATLANTIC', 'EU'],
    anomalyThresholds: {
      altitudeDeviation: 20000,
      speedDeviation: 100,
      unusualRegion: true,
    },
    intentPriors: {
      reconnaissance: 0.50,
      transport: 0.0,
      training: 0.10,
      combat: 0.15,
      refueling: 0.0,
      patrol: 0.25,
    },
    description: 'Maritime patrol and anti-submarine warfare aircraft',
    operators: ['USN', 'RAAF', 'RAF', 'JMSDF', 'RNoAF'],
  },
  MQ9: {
    typeCode: 'MQ9',
    name: 'MQ-9 Reaper',
    category: 'isr',
    typicalAltitude: { min: 15000, max: 50000, cruise: 25000 },
    typicalSpeed: { min: 150, max: 250, cruise: 200 },
    maxClimbRate: 1500,
    maxRange: 1150,
    typicalMissionDuration: { min: 14, max: 27 },
    typicalPatterns: ['orbit', 'racetrack'],
    operatingRegions: ['ME', 'AF', 'PAC'],
    anomalyThresholds: {
      altitudeDeviation: 15000,
      speedDeviation: 50,
      unusualRegion: true,
    },
    intentPriors: {
      reconnaissance: 0.60,
      transport: 0.0,
      training: 0.05,
      combat: 0.30,
      refueling: 0.0,
      patrol: 0.05,
    },
    description: 'Armed reconnaissance UAV',
    operators: ['USAF', 'RAF', 'RAAF', 'FAF'],
  },
  E8: {
    typeCode: 'E8',
    name: 'E-8 JSTARS',
    category: 'isr',
    typicalAltitude: { min: 30000, max: 42000, cruise: 38000 },
    typicalSpeed: { min: 350, max: 500, cruise: 450 },
    maxClimbRate: 3000,
    maxRange: 4600,
    typicalMissionDuration: { min: 8, max: 12 },
    typicalPatterns: ['racetrack', 'orbit'],
    operatingRegions: ['ME', 'EU', 'PAC'],
    anomalyThresholds: {
      altitudeDeviation: 10000,
      speedDeviation: 80,
      unusualRegion: true,
    },
    intentPriors: {
      reconnaissance: 0.75,
      transport: 0.0,
      training: 0.05,
      combat: 0.15,
      refueling: 0.0,
      patrol: 0.05,
    },
    description: 'Joint Surveillance Target Attack Radar System',
    operators: ['USAF', 'ANG'],
  },
  EP3: {
    typeCode: 'EP3',
    name: 'EP-3E Aries II',
    category: 'isr',
    typicalAltitude: { min: 20000, max: 35000, cruise: 28000 },
    typicalSpeed: { min: 280, max: 400, cruise: 350 },
    maxClimbRate: 2500,
    maxRange: 2800,
    typicalMissionDuration: { min: 8, max: 12 },
    typicalPatterns: ['racetrack', 'orbit'],
    operatingRegions: ['PAC', 'ME', 'EU'],
    anomalyThresholds: {
      altitudeDeviation: 10000,
      speedDeviation: 60,
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
    description: 'SIGINT reconnaissance aircraft',
    operators: ['USN'],
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
  F18: {
    typeCode: 'F18',
    name: 'F/A-18 Hornet/Super Hornet',
    category: 'fighter',
    typicalAltitude: { min: 15000, max: 50000, cruise: 35000 },
    typicalSpeed: { min: 350, max: 650, cruise: 500 },
    maxClimbRate: 45000,
    maxRange: 1250,
    typicalMissionDuration: { min: 1.5, max: 4 },
    typicalPatterns: ['racetrack', 'orbit', 'straight'],
    operatingRegions: ['ME', 'PAC', 'CONUS'],
    anomalyThresholds: {
      altitudeDeviation: 15000,
      speedDeviation: 150,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.10,
      transport: 0.0,
      training: 0.25,
      combat: 0.40,
      refueling: 0.0,
      patrol: 0.25,
    },
    description: 'Multi-role carrier-based fighter',
    operators: ['USN', 'USMC', 'RAAF', 'RSAF', 'KAF'],
  },
  A10: {
    typeCode: 'A10',
    name: 'A-10 Thunderbolt II',
    category: 'fighter',
    typicalAltitude: { min: 5000, max: 25000, cruise: 15000 },
    typicalSpeed: { min: 200, max: 400, cruise: 300 },
    maxClimbRate: 6000,
    maxRange: 800,
    typicalMissionDuration: { min: 2, max: 5 },
    typicalPatterns: ['orbit', 'racetrack'],
    operatingRegions: ['ME', 'EU', 'CONUS'],
    anomalyThresholds: {
      altitudeDeviation: 10000,
      speedDeviation: 100,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.05,
      transport: 0.0,
      training: 0.30,
      combat: 0.55,
      refueling: 0.0,
      patrol: 0.10,
    },
    description: 'Close air support attack aircraft',
    operators: ['USAF', 'ANG', 'AFRC'],
  },

  // ================================================
  // Bombers
  // ================================================
  B52: {
    typeCode: 'B52',
    name: 'B-52 Stratofortress',
    category: 'fighter',
    typicalAltitude: { min: 30000, max: 50000, cruise: 45000 },
    typicalSpeed: { min: 400, max: 550, cruise: 500 },
    maxClimbRate: 3500,
    maxRange: 8800,
    typicalMissionDuration: { min: 8, max: 20 },
    typicalPatterns: ['straight', 'orbit'],
    operatingRegions: ['ME', 'EU', 'PAC', 'CONUS'],
    anomalyThresholds: {
      altitudeDeviation: 10000,
      speedDeviation: 80,
      unusualRegion: true,
    },
    intentPriors: {
      reconnaissance: 0.05,
      transport: 0.0,
      training: 0.20,
      combat: 0.60,
      refueling: 0.0,
      patrol: 0.15,
    },
    description: 'Strategic bomber',
    operators: ['USAF'],
  },
  B1B: {
    typeCode: 'B1B',
    name: 'B-1B Lancer',
    category: 'fighter',
    typicalAltitude: { min: 25000, max: 50000, cruise: 40000 },
    typicalSpeed: { min: 450, max: 700, cruise: 550 },
    maxClimbRate: 10000,
    maxRange: 5100,
    typicalMissionDuration: { min: 6, max: 12 },
    typicalPatterns: ['straight', 'orbit'],
    operatingRegions: ['ME', 'EU', 'PAC', 'CONUS'],
    anomalyThresholds: {
      altitudeDeviation: 12000,
      speedDeviation: 100,
      unusualRegion: true,
    },
    intentPriors: {
      reconnaissance: 0.05,
      transport: 0.0,
      training: 0.25,
      combat: 0.60,
      refueling: 0.0,
      patrol: 0.10,
    },
    description: 'Supersonic strategic bomber',
    operators: ['USAF'],
  },
  B2: {
    typeCode: 'B2',
    name: 'B-2 Spirit',
    category: 'fighter',
    typicalAltitude: { min: 40000, max: 50000, cruise: 45000 },
    typicalSpeed: { min: 400, max: 550, cruise: 500 },
    maxClimbRate: 5000,
    maxRange: 6000,
    typicalMissionDuration: { min: 10, max: 30 },
    typicalPatterns: ['straight'],
    operatingRegions: ['GLOBAL'],
    anomalyThresholds: {
      altitudeDeviation: 10000,
      speedDeviation: 80,
      unusualRegion: true,
    },
    intentPriors: {
      reconnaissance: 0.10,
      transport: 0.0,
      training: 0.15,
      combat: 0.70,
      refueling: 0.0,
      patrol: 0.05,
    },
    description: 'Stealth strategic bomber',
    operators: ['USAF'],
  },

  // ================================================
  // Transport
  // ================================================
  C5: {
    typeCode: 'C5',
    name: 'C-5 Galaxy',
    category: 'transport',
    typicalAltitude: { min: 25000, max: 45000, cruise: 35000 },
    typicalSpeed: { min: 400, max: 520, cruise: 480 },
    maxClimbRate: 3500,
    maxRange: 4800,
    typicalMissionDuration: { min: 4, max: 16 },
    typicalPatterns: ['straight'],
    operatingRegions: ['GLOBAL'],
    anomalyThresholds: {
      altitudeDeviation: 10000,
      speedDeviation: 80,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.0,
      transport: 0.90,
      training: 0.05,
      combat: 0.0,
      refueling: 0.0,
      patrol: 0.05,
    },
    description: 'Heavy strategic airlift',
    operators: ['USAF', 'ANG', 'AFRC'],
  },
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
  A400: {
    typeCode: 'A400',
    name: 'A400M Atlas',
    category: 'transport',
    typicalAltitude: { min: 25000, max: 40000, cruise: 35000 },
    typicalSpeed: { min: 300, max: 450, cruise: 400 },
    maxClimbRate: 2500,
    maxRange: 4500,
    typicalMissionDuration: { min: 3, max: 12 },
    typicalPatterns: ['straight'],
    operatingRegions: ['EU', 'ME', 'AF'],
    anomalyThresholds: {
      altitudeDeviation: 10000,
      speedDeviation: 70,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.0,
      transport: 0.85,
      training: 0.05,
      combat: 0.0,
      refueling: 0.05,
      patrol: 0.05,
    },
    description: 'European tactical/strategic airlift',
    operators: ['RAF', 'FAF', 'GAF', 'SPAF', 'TuAF'],
  },

  // ================================================
  // Helicopters
  // ================================================
  UH60: {
    typeCode: 'UH60',
    name: 'UH-60 Black Hawk',
    category: 'helicopter',
    typicalAltitude: { min: 500, max: 10000, cruise: 5000 },
    typicalSpeed: { min: 100, max: 180, cruise: 150 },
    maxClimbRate: 1500,
    maxRange: 300,
    typicalMissionDuration: { min: 1, max: 4 },
    typicalPatterns: ['orbit', 'straight'],
    operatingRegions: ['GLOBAL'],
    anomalyThresholds: {
      altitudeDeviation: 5000,
      speedDeviation: 50,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.15,
      transport: 0.40,
      training: 0.20,
      combat: 0.15,
      refueling: 0.0,
      patrol: 0.10,
    },
    description: 'Utility helicopter',
    operators: ['USA', 'USN', 'USAF', 'USMC'],
  },
  AH64: {
    typeCode: 'AH64',
    name: 'AH-64 Apache',
    category: 'helicopter',
    typicalAltitude: { min: 200, max: 6000, cruise: 2000 },
    typicalSpeed: { min: 80, max: 160, cruise: 130 },
    maxClimbRate: 2500,
    maxRange: 260,
    typicalMissionDuration: { min: 1.5, max: 3 },
    typicalPatterns: ['orbit', 'straight'],
    operatingRegions: ['ME', 'EU', 'PAC', 'CONUS'],
    anomalyThresholds: {
      altitudeDeviation: 3000,
      speedDeviation: 40,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.20,
      transport: 0.0,
      training: 0.25,
      combat: 0.45,
      refueling: 0.0,
      patrol: 0.10,
    },
    description: 'Attack helicopter',
    operators: ['USA', 'IDF', 'AAC', 'JGSDF'],
  },
  CH47: {
    typeCode: 'CH47',
    name: 'CH-47 Chinook',
    category: 'helicopter',
    typicalAltitude: { min: 500, max: 10000, cruise: 6000 },
    typicalSpeed: { min: 100, max: 180, cruise: 150 },
    maxClimbRate: 1800,
    maxRange: 400,
    typicalMissionDuration: { min: 1.5, max: 5 },
    typicalPatterns: ['straight', 'orbit'],
    operatingRegions: ['GLOBAL'],
    anomalyThresholds: {
      altitudeDeviation: 5000,
      speedDeviation: 50,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.05,
      transport: 0.70,
      training: 0.15,
      combat: 0.0,
      refueling: 0.0,
      patrol: 0.10,
    },
    description: 'Heavy-lift cargo helicopter',
    operators: ['USA', 'RAF', 'JGSDF', 'IDF'],
  },
  V22: {
    typeCode: 'V22',
    name: 'V-22 Osprey',
    category: 'helicopter',
    typicalAltitude: { min: 1000, max: 25000, cruise: 15000 },
    typicalSpeed: { min: 150, max: 280, cruise: 250 },
    maxClimbRate: 3000,
    maxRange: 950,
    typicalMissionDuration: { min: 2, max: 6 },
    typicalPatterns: ['straight', 'orbit'],
    operatingRegions: ['ME', 'PAC', 'CONUS'],
    anomalyThresholds: {
      altitudeDeviation: 8000,
      speedDeviation: 60,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.10,
      transport: 0.60,
      training: 0.15,
      combat: 0.05,
      refueling: 0.0,
      patrol: 0.10,
    },
    description: 'Tiltrotor multi-mission aircraft',
    operators: ['USMC', 'USAF', 'USN', 'JGSDF'],
  },
  MH60: {
    typeCode: 'MH60',
    name: 'MH-60 Seahawk',
    category: 'helicopter',
    typicalAltitude: { min: 200, max: 8000, cruise: 3000 },
    typicalSpeed: { min: 100, max: 180, cruise: 150 },
    maxClimbRate: 1500,
    maxRange: 450,
    typicalMissionDuration: { min: 2, max: 5 },
    typicalPatterns: ['orbit', 'racetrack'],
    operatingRegions: ['ME', 'PAC', 'ATLANTIC'],
    anomalyThresholds: {
      altitudeDeviation: 4000,
      speedDeviation: 50,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.30,
      transport: 0.20,
      training: 0.15,
      combat: 0.20,
      refueling: 0.0,
      patrol: 0.15,
    },
    description: 'Naval multi-mission helicopter',
    operators: ['USN', 'JMSDF', 'ROKN', 'RAN'],
  },

  // ================================================
  // Trainers
  // ================================================
  T38: {
    typeCode: 'T38',
    name: 'T-38 Talon',
    category: 'trainer',
    typicalAltitude: { min: 10000, max: 45000, cruise: 30000 },
    typicalSpeed: { min: 300, max: 550, cruise: 450 },
    maxClimbRate: 30000,
    maxRange: 1000,
    typicalMissionDuration: { min: 1, max: 2.5 },
    typicalPatterns: ['racetrack', 'orbit', 'straight'],
    operatingRegions: ['CONUS'],
    anomalyThresholds: {
      altitudeDeviation: 15000,
      speedDeviation: 100,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.0,
      transport: 0.0,
      training: 0.90,
      combat: 0.0,
      refueling: 0.0,
      patrol: 0.10,
    },
    description: 'Supersonic jet trainer',
    operators: ['USAF', 'NASA'],
  },
  T6: {
    typeCode: 'T6',
    name: 'T-6 Texan II',
    category: 'trainer',
    typicalAltitude: { min: 5000, max: 25000, cruise: 18000 },
    typicalSpeed: { min: 150, max: 320, cruise: 270 },
    maxClimbRate: 3500,
    maxRange: 900,
    typicalMissionDuration: { min: 1, max: 3 },
    typicalPatterns: ['racetrack', 'orbit'],
    operatingRegions: ['CONUS', 'EU'],
    anomalyThresholds: {
      altitudeDeviation: 10000,
      speedDeviation: 80,
      unusualRegion: false,
    },
    intentPriors: {
      reconnaissance: 0.0,
      transport: 0.0,
      training: 0.95,
      combat: 0.0,
      refueling: 0.0,
      patrol: 0.05,
    },
    description: 'Primary trainer aircraft',
    operators: ['USAF', 'USN', 'NATO'],
  },
};

/**
 * Normalize type code for matching (remove hyphens, spaces, convert to uppercase)
 */
function normalizeTypeCode(typeCode: string): string {
  return typeCode.replace(/[-\s]/g, '').toUpperCase();
}

/**
 * Get aircraft prior by type code
 */
export function getAircraftPrior(typeCode: string): AircraftPrior | undefined {
  // Try exact match first
  if (AIRCRAFT_PRIORS[typeCode]) {
    return AIRCRAFT_PRIORS[typeCode];
  }

  // Normalize the input type code
  const normalized = normalizeTypeCode(typeCode);

  // Try normalized exact match
  if (AIRCRAFT_PRIORS[normalized]) {
    return AIRCRAFT_PRIORS[normalized];
  }

  // Try prefix match with normalization (e.g., F-15E -> F15, MQ-4C -> MQ4C)
  for (const [key, prior] of Object.entries(AIRCRAFT_PRIORS)) {
    const normalizedKey = normalizeTypeCode(key);
    if (normalized.startsWith(normalizedKey) || normalizedKey.startsWith(normalized)) {
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
