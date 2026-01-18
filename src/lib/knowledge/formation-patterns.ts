/**
 * Formation Patterns Knowledge Library
 * Domain knowledge for military aircraft formation detection
 */

export interface FormationPattern {
  id: string;
  name: string;
  description: string;
  // Formation characteristics
  minAircraft: number;
  maxAircraft: number;
  typicalSpacingNm: { min: number; max: number };
  typicalAltitudeDiff: { min: number; max: number }; // feet
  typicalSpeedDiff: { min: number; max: number }; // knots
  // Aircraft type requirements
  requiredTypes?: string[][]; // Array of acceptable type combinations
  // Behavioral patterns
  typicalDuration: { min: number; max: number }; // minutes
  typicalFlightPattern?: string[];
  // Scoring weights
  weights: {
    spacing: number;
    altitude: number;
    speed: number;
    heading: number;
    typeMatch: number;
  };
  // Threat indicators
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  tacticalSignificance: string;
}

export const FORMATION_PATTERNS: FormationPattern[] = [
  {
    id: 'tanker_receiver',
    name: 'Tanker-Receiver',
    description: 'Aerial refueling operation with tanker and receiver aircraft',
    minAircraft: 2,
    maxAircraft: 4,
    typicalSpacingNm: { min: 0.1, max: 1.0 },
    typicalAltitudeDiff: { min: 0, max: 500 },
    typicalSpeedDiff: { min: 0, max: 30 },
    requiredTypes: [
      ['KC135', 'F15'], ['KC135', 'F16'], ['KC135', 'F18'], ['KC135', 'F22'], ['KC135', 'F35'],
      ['KC10', 'F15'], ['KC10', 'F16'], ['KC10', 'F18'], ['KC10', 'F22'], ['KC10', 'F35'],
      ['KC46', 'F15'], ['KC46', 'F16'], ['KC46', 'F22'], ['KC46', 'F35'],
      ['A332', 'F16'], ['A332', 'F15'], // NATO tankers
      ['KC30', 'F35'], ['KC30', 'F18'],
    ],
    typicalDuration: { min: 15, max: 60 },
    typicalFlightPattern: ['racetrack', 'orbit'],
    weights: {
      spacing: 0.25,
      altitude: 0.2,
      speed: 0.2,
      heading: 0.15,
      typeMatch: 0.2,
    },
    threatLevel: 'medium',
    tacticalSignificance: 'Indicates extended range operations, possible surge activity',
  },
  {
    id: 'escort',
    name: 'Escort Formation',
    description: 'Fighter escort protecting high-value aircraft',
    minAircraft: 2,
    maxAircraft: 6,
    typicalSpacingNm: { min: 1.0, max: 10.0 },
    typicalAltitudeDiff: { min: 0, max: 5000 },
    typicalSpeedDiff: { min: 0, max: 50 },
    requiredTypes: [
      ['E3TF', 'F15'], ['E3TF', 'F16'], ['E3TF', 'F22'],
      ['E7WW', 'F35'], ['E7WW', 'F18'],
      ['RC135', 'F15'], ['RC135', 'F16'],
      ['EP3', 'F18'],
      ['P8', 'F18'], ['P8A', 'F18'],
      ['C17', 'F15'], ['C17', 'F16'],
      ['C5M', 'F15'],
    ],
    typicalDuration: { min: 30, max: 240 },
    weights: {
      spacing: 0.2,
      altitude: 0.15,
      speed: 0.15,
      heading: 0.2,
      typeMatch: 0.3,
    },
    threatLevel: 'high',
    tacticalSignificance: 'High-value asset protection, indicates sensitive operations',
  },
  {
    id: 'strike_package',
    name: 'Strike Package',
    description: 'Coordinated strike formation with multiple fighter aircraft',
    minAircraft: 4,
    maxAircraft: 24,
    typicalSpacingNm: { min: 2.0, max: 20.0 },
    typicalAltitudeDiff: { min: 0, max: 10000 },
    typicalSpeedDiff: { min: 0, max: 100 },
    requiredTypes: [
      ['F15', 'F15', 'F15', 'F15'],
      ['F16', 'F16', 'F16', 'F16'],
      ['F35', 'F35', 'F35', 'F35'],
      ['F18', 'F18', 'F18', 'F18'],
      ['F15', 'F16'], // Mixed
      ['F22', 'F15'],
    ],
    typicalDuration: { min: 60, max: 180 },
    typicalFlightPattern: ['straight'],
    weights: {
      spacing: 0.15,
      altitude: 0.15,
      speed: 0.2,
      heading: 0.3,
      typeMatch: 0.2,
    },
    threatLevel: 'critical',
    tacticalSignificance: 'Potential offensive operation, highest priority alert',
  },
  {
    id: 'cap',
    name: 'Combat Air Patrol',
    description: 'Defensive patrol pattern, typically 2-4 fighters',
    minAircraft: 2,
    maxAircraft: 4,
    typicalSpacingNm: { min: 5.0, max: 30.0 },
    typicalAltitudeDiff: { min: 0, max: 5000 },
    typicalSpeedDiff: { min: 0, max: 50 },
    requiredTypes: [
      ['F15', 'F15'],
      ['F16', 'F16'],
      ['F22', 'F22'],
      ['F35', 'F35'],
      ['F18', 'F18'],
    ],
    typicalDuration: { min: 60, max: 240 },
    typicalFlightPattern: ['racetrack', 'orbit', 'holding'],
    weights: {
      spacing: 0.15,
      altitude: 0.15,
      speed: 0.15,
      heading: 0.15,
      typeMatch: 0.4,
    },
    threatLevel: 'medium',
    tacticalSignificance: 'Defensive posture, indicates elevated alert status',
  },
  {
    id: 'isr_support',
    name: 'ISR with Support',
    description: 'Intelligence aircraft with fighter support',
    minAircraft: 2,
    maxAircraft: 4,
    typicalSpacingNm: { min: 10.0, max: 50.0 },
    typicalAltitudeDiff: { min: 5000, max: 20000 },
    typicalSpeedDiff: { min: 50, max: 200 },
    requiredTypes: [
      ['RC135', 'F15'], ['RC135', 'F16'],
      ['RQ4', 'F22'], // MQ-4 with escort
      ['U2', 'F15'],
      ['EP3', 'F18'],
      ['GLEX', 'F16'], // Special missions
    ],
    typicalDuration: { min: 120, max: 480 },
    typicalFlightPattern: ['racetrack', 'orbit'],
    weights: {
      spacing: 0.1,
      altitude: 0.2,
      speed: 0.1,
      heading: 0.2,
      typeMatch: 0.4,
    },
    threatLevel: 'high',
    tacticalSignificance: 'Active intelligence collection, possible precursor to operations',
  },
  {
    id: 'transport_escort',
    name: 'Transport with Escort',
    description: 'Strategic transport with fighter escort',
    minAircraft: 2,
    maxAircraft: 6,
    typicalSpacingNm: { min: 2.0, max: 15.0 },
    typicalAltitudeDiff: { min: 0, max: 5000 },
    typicalSpeedDiff: { min: 0, max: 100 },
    requiredTypes: [
      ['C17', 'F15'], ['C17', 'F16'],
      ['C5M', 'F15'], ['C5M', 'F16'],
      ['C130', 'F16'],
      ['A400', 'F16'],
    ],
    typicalDuration: { min: 60, max: 300 },
    weights: {
      spacing: 0.15,
      altitude: 0.15,
      speed: 0.2,
      heading: 0.2,
      typeMatch: 0.3,
    },
    threatLevel: 'medium',
    tacticalSignificance: 'High-value cargo or personnel movement',
  },
];

/**
 * Match aircraft types against formation pattern requirements
 */
export function matchFormationTypes(
  aircraftTypes: string[],
  pattern: FormationPattern
): { matches: boolean; confidence: number } {
  if (!pattern.requiredTypes || pattern.requiredTypes.length === 0) {
    return { matches: true, confidence: 0.5 };
  }

  // Sort types for comparison
  const sortedTypes = [...aircraftTypes].sort();

  let bestScore = 0;

  for (const requirement of pattern.requiredTypes) {
    const sortedReq = [...requirement].sort();

    // Check if all required types are present
    let matchCount = 0;
    for (const reqType of sortedReq) {
      if (sortedTypes.some((t) => t.startsWith(reqType) || reqType.startsWith(t))) {
        matchCount++;
      }
    }

    const score = matchCount / Math.max(sortedReq.length, sortedTypes.length);
    bestScore = Math.max(bestScore, score);
  }

  return {
    matches: bestScore > 0.5,
    confidence: bestScore,
  };
}

/**
 * Score a potential formation against a pattern
 */
export function scoreFormationMatch(
  pattern: FormationPattern,
  data: {
    aircraftCount: number;
    avgSpacingNm: number;
    maxAltitudeDiff: number;
    maxSpeedDiff: number;
    headingVariance: number;
    aircraftTypes: string[];
  }
): { score: number; factors: Record<string, number> } {
  const factors: Record<string, number> = {};

  // Aircraft count check
  if (data.aircraftCount < pattern.minAircraft || data.aircraftCount > pattern.maxAircraft) {
    return { score: 0, factors: { aircraftCount: 0 } };
  }

  // Spacing score
  if (data.avgSpacingNm >= pattern.typicalSpacingNm.min &&
      data.avgSpacingNm <= pattern.typicalSpacingNm.max) {
    factors.spacing = 1.0;
  } else {
    const spacingRange = pattern.typicalSpacingNm.max - pattern.typicalSpacingNm.min;
    const deviation = data.avgSpacingNm < pattern.typicalSpacingNm.min
      ? pattern.typicalSpacingNm.min - data.avgSpacingNm
      : data.avgSpacingNm - pattern.typicalSpacingNm.max;
    factors.spacing = Math.max(0, 1 - deviation / spacingRange);
  }

  // Altitude difference score
  if (data.maxAltitudeDiff >= pattern.typicalAltitudeDiff.min &&
      data.maxAltitudeDiff <= pattern.typicalAltitudeDiff.max) {
    factors.altitude = 1.0;
  } else {
    const altRange = pattern.typicalAltitudeDiff.max - pattern.typicalAltitudeDiff.min;
    const deviation = data.maxAltitudeDiff < pattern.typicalAltitudeDiff.min
      ? pattern.typicalAltitudeDiff.min - data.maxAltitudeDiff
      : data.maxAltitudeDiff - pattern.typicalAltitudeDiff.max;
    factors.altitude = Math.max(0, 1 - deviation / Math.max(altRange, 1000));
  }

  // Speed difference score
  if (data.maxSpeedDiff >= pattern.typicalSpeedDiff.min &&
      data.maxSpeedDiff <= pattern.typicalSpeedDiff.max) {
    factors.speed = 1.0;
  } else {
    const speedRange = pattern.typicalSpeedDiff.max - pattern.typicalSpeedDiff.min;
    const deviation = data.maxSpeedDiff < pattern.typicalSpeedDiff.min
      ? pattern.typicalSpeedDiff.min - data.maxSpeedDiff
      : data.maxSpeedDiff - pattern.typicalSpeedDiff.max;
    factors.speed = Math.max(0, 1 - deviation / Math.max(speedRange, 50));
  }

  // Heading alignment score (lower variance = better)
  factors.heading = Math.max(0, 1 - data.headingVariance / 90);

  // Type match score
  const typeMatch = matchFormationTypes(data.aircraftTypes, pattern);
  factors.typeMatch = typeMatch.confidence;

  // Calculate weighted score
  let totalWeight = 0;
  let weightedSum = 0;

  for (const [key, weight] of Object.entries(pattern.weights)) {
    if (factors[key] !== undefined) {
      weightedSum += factors[key] * weight;
      totalWeight += weight;
    }
  }

  const score = totalWeight > 0 ? weightedSum / totalWeight : 0;

  return { score, factors };
}

/**
 * Detect best matching formation pattern for a group of aircraft
 */
export function detectFormationPattern(
  data: {
    aircraftCount: number;
    avgSpacingNm: number;
    maxAltitudeDiff: number;
    maxSpeedDiff: number;
    headingVariance: number;
    aircraftTypes: string[];
  }
): {
  pattern: FormationPattern | null;
  score: number;
  factors: Record<string, number>;
  allScores: Array<{ patternId: string; score: number }>;
} {
  let bestPattern: FormationPattern | null = null;
  let bestScore = 0;
  let bestFactors: Record<string, number> = {};
  const allScores: Array<{ patternId: string; score: number }> = [];

  for (const pattern of FORMATION_PATTERNS) {
    const { score, factors } = scoreFormationMatch(pattern, data);
    allScores.push({ patternId: pattern.id, score });

    if (score > bestScore) {
      bestScore = score;
      bestPattern = pattern;
      bestFactors = factors;
    }
  }

  // Only return a match if score is above threshold
  if (bestScore < 0.5) {
    return { pattern: null, score: bestScore, factors: bestFactors, allScores };
  }

  return { pattern: bestPattern, score: bestScore, factors: bestFactors, allScores };
}

/**
 * Get formation pattern by ID
 */
export function getFormationPattern(id: string): FormationPattern | undefined {
  return FORMATION_PATTERNS.find((p) => p.id === id);
}

/**
 * Get all formation patterns
 */
export function getAllFormationPatterns(): FormationPattern[] {
  return [...FORMATION_PATTERNS];
}
