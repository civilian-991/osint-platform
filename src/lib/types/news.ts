export interface NewsEvent {
  id: string;
  source: NewsSource;
  source_id: string;
  title: string;
  content: string | null;
  url: string;
  published_at: string;
  fetched_at: string;
  language: string | null;
  countries: string[];
  locations: NewsLocation[];
  entities: NewsEntity[];
  categories: string[];
  sentiment_score: number | null;
  credibility_score: number;
  image_url: string | null;
  created_at: string;
}

export type NewsSource =
  | 'gdelt'
  | 'newsdata'
  | 'social'
  | 'wire'
  | 'other';

export interface NewsLocation {
  name: string;
  type: 'country' | 'city' | 'region' | 'landmark';
  latitude?: number;
  longitude?: number;
  relevance?: number;
}

export interface NewsEntity {
  name: string;
  type: 'person' | 'organization' | 'location' | 'aircraft' | 'military' | 'event';
  relevance?: number;
}

export interface GDELTResponse {
  articles: GDELTArticle[];
}

export interface GDELTArticle {
  url: string;
  title: string;
  seendate: string;
  socialimage: string;
  domain: string;
  language: string;
  sourcecountry: string;
  tone: number;
}

export interface NewsDataResponse {
  status: string;
  totalResults: number;
  results: NewsDataArticle[];
  nextPage?: string;
}

export interface NewsDataArticle {
  article_id: string;
  title: string;
  link: string;
  keywords: string[] | null;
  creator: string[] | null;
  video_url: string | null;
  description: string | null;
  content: string | null;
  pubDate: string;
  image_url: string | null;
  source_id: string;
  source_priority: number;
  source_url: string;
  source_icon: string | null;
  language: string;
  country: string[];
  category: string[];
  sentiment?: string;
  ai_tag?: string[];
}

export const NEWS_KEYWORDS = [
  // Locations
  'lebanon', 'israel', 'syria', 'iran', 'iraq', 'turkey', 'egypt', 'cyprus',
  'gulf', 'saudi', 'uae', 'qatar', 'bahrain', 'kuwait', 'jordan',
  // Military
  'military', 'aircraft', 'jet', 'fighter', 'bomber', 'tanker', 'awacs',
  'surveillance', 'reconnaissance', 'airforce', 'air force', 'aviation',
  'airstrike', 'strike', 'bombing', 'missile', 'drone',
  // Operations
  'deployment', 'exercise', 'operation', 'patrol', 'intercept',
  'refueling', 'sortie', 'mission',
  // Countries/Military
  'idf', 'iaf', 'usaf', 'raf', 'turkish air force', 'iranian air force',
  'hezbollah', 'hamas', 'houthi', 'irgc',
];

export const CREDIBILITY_FACTORS: Record<string, number> = {
  'reuters.com': 0.95,
  'apnews.com': 0.95,
  'bbc.com': 0.90,
  'bbc.co.uk': 0.90,
  'aljazeera.com': 0.85,
  'timesofisrael.com': 0.85,
  'jpost.com': 0.80,
  'haaretz.com': 0.85,
  'dailystar.com.lb': 0.75,
  'naharnet.com': 0.75,
  'sana.sy': 0.50,
  'tasnimnews.com': 0.50,
  'presstv.ir': 0.45,
  'twitter.com': 0.40,
  'x.com': 0.40,
  'telegram': 0.35,
};

export function getCredibilityScore(domain: string): number {
  const normalized = domain.toLowerCase().replace(/^www\./, '');
  return CREDIBILITY_FACTORS[normalized] ?? 0.60;
}
