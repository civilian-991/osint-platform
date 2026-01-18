import type {
  NewsEvent,
  GDELTResponse,
  GDELTArticle,
  NewsLocation,
  NewsEntity,
} from '@/lib/types/news';
import { getCredibilityScore, NEWS_KEYWORDS } from '@/lib/types/news';

const GDELT_DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc';
const GDELT_GEO_API = 'https://api.gdeltproject.org/api/v2/geo/geo';

// Query parameters for Middle East aviation news
const DEFAULT_QUERY_PARTS = [
  // Locations
  '(lebanon OR israel OR syria OR iran OR iraq OR turkey OR egypt OR cyprus OR "gulf states" OR saudi OR uae OR qatar OR bahrain OR kuwait OR jordan)',
  // Topics
  'AND (military OR aircraft OR jet OR fighter OR bomber OR tanker OR awacs OR surveillance OR reconnaissance OR airforce OR "air force" OR aviation OR airstrike OR strike OR bombing OR missile OR drone)',
];

export class GDELTService {
  private docApiUrl: string;
  private geoApiUrl: string;

  constructor(docApiUrl = GDELT_DOC_API, geoApiUrl = GDELT_GEO_API) {
    this.docApiUrl = docApiUrl;
    this.geoApiUrl = geoApiUrl;
  }

  /**
   * Build GDELT query URL
   */
  private buildQueryUrl(options: {
    query?: string;
    mode?: 'artlist' | 'artgallery' | 'timelinevol' | 'timelinetone';
    timespan?: string;
    maxrecords?: number;
    format?: 'json' | 'html';
    sort?: 'date' | 'rel';
  }): string {
    const {
      query = DEFAULT_QUERY_PARTS.join(' '),
      mode = 'artlist',
      timespan = '24h',
      maxrecords = 250,
      format = 'json',
      sort = 'date',
    } = options;

    const params = new URLSearchParams({
      query,
      mode,
      timespan,
      maxrecords: maxrecords.toString(),
      format,
      sort,
    });

    return `${this.docApiUrl}?${params.toString()}`;
  }

  /**
   * Fetch news articles from GDELT
   */
  async fetchNews(options?: {
    query?: string;
    timespan?: string;
    maxrecords?: number;
  }): Promise<GDELTArticle[]> {
    try {
      const url = this.buildQueryUrl({
        ...options,
        mode: 'artlist',
        format: 'json',
      });

      const response = await fetch(url, {
        next: { revalidate: 900 }, // Cache for 15 minutes
      });

      if (!response.ok) {
        throw new Error(`GDELT API error: ${response.status}`);
      }

      const data: GDELTResponse = await response.json();
      return data.articles || [];
    } catch (error) {
      console.error('Error fetching GDELT news:', error);
      throw error;
    }
  }

  /**
   * Fetch military aviation news
   */
  async fetchMilitaryAviationNews(timespan = '24h'): Promise<GDELTArticle[]> {
    const query = DEFAULT_QUERY_PARTS.join(' ');
    return this.fetchNews({ query, timespan });
  }

  /**
   * Fetch news for a specific region
   */
  async fetchRegionNews(
    region: string,
    timespan = '24h'
  ): Promise<GDELTArticle[]> {
    const query = `${region} AND (military OR aircraft OR aviation OR airstrike OR strike)`;
    return this.fetchNews({ query, timespan });
  }

  /**
   * Convert GDELT article to our NewsEvent format
   */
  convertToNewsEvent(article: GDELTArticle): Omit<NewsEvent, 'id' | 'created_at'> {
    const domain = this.extractDomain(article.url);
    const countries = this.extractCountries(article.title);
    const locations = this.extractLocations(article.title);
    const entities = this.extractEntities(article.title);

    return {
      source: 'gdelt',
      source_id: this.generateSourceId(article),
      title: article.title,
      content: null, // GDELT doesn't provide full content
      url: article.url,
      published_at: this.parseGDELTDate(article.seendate),
      fetched_at: new Date().toISOString(),
      language: article.language || null,
      countries,
      locations,
      entities,
      categories: this.categorizeArticle(article.title),
      sentiment_score: article.tone ? article.tone / 100 : null,
      credibility_score: getCredibilityScore(domain),
      image_url: article.socialimage || null,
    };
  }

  /**
   * Parse GDELT date format (YYYYMMDDTHHMMSSZ)
   */
  private parseGDELTDate(dateStr: string): string {
    try {
      // GDELT format: 20250118T120000Z
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const hour = dateStr.substring(9, 11);
      const minute = dateStr.substring(11, 13);
      const second = dateStr.substring(13, 15);

      return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    } catch {
      return new Date().toISOString();
    }
  }

  /**
   * Extract domain from URL
   */
  private extractDomain(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace(/^www\./, '');
    } catch {
      return 'unknown';
    }
  }

  /**
   * Generate unique source ID for deduplication
   */
  private generateSourceId(article: GDELTArticle): string {
    // Create a hash-like ID from URL and date
    const base = `${article.url}-${article.seendate}`;
    // Simple hash for deduplication
    let hash = 0;
    for (let i = 0; i < base.length; i++) {
      const char = base.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `gdelt-${Math.abs(hash).toString(36)}`;
  }

  /**
   * Extract countries mentioned in text
   */
  private extractCountries(text: string): string[] {
    const countryPatterns: Record<string, RegExp> = {
      lebanon: /\blebanon\b/i,
      israel: /\bisrael\b/i,
      syria: /\bsyria\b/i,
      iran: /\biran\b/i,
      iraq: /\biraq\b/i,
      turkey: /\bturkey\b|\bturkish\b/i,
      egypt: /\begypt\b/i,
      cyprus: /\bcyprus\b/i,
      jordan: /\bjordan\b/i,
      saudi_arabia: /\bsaudi\b/i,
      uae: /\buae\b|\bemirati\b|\bdubai\b|\babu dhabi\b/i,
      qatar: /\bqatar\b/i,
      bahrain: /\bbahrain\b/i,
      kuwait: /\bkuwait\b/i,
      usa: /\bunited states\b|\bamerica\b|\bpentagon\b|\bwashington\b/i,
      uk: /\bbrit\w*\b|\buk\b|\bunited kingdom\b/i,
      russia: /\brussia\b|\brussian\b|\bmoscow\b/i,
    };

    const found: string[] = [];

    for (const [country, pattern] of Object.entries(countryPatterns)) {
      if (pattern.test(text)) {
        found.push(country);
      }
    }

    return found;
  }

  /**
   * Extract location entities from text
   */
  private extractLocations(text: string): NewsLocation[] {
    const locationPatterns: Array<{
      pattern: RegExp;
      name: string;
      type: 'city' | 'region' | 'country';
      lat?: number;
      lon?: number;
    }> = [
      { pattern: /\bbeirut\b/i, name: 'Beirut', type: 'city', lat: 33.89, lon: 35.50 },
      { pattern: /\btel aviv\b/i, name: 'Tel Aviv', type: 'city', lat: 32.09, lon: 34.78 },
      { pattern: /\bjerusalem\b/i, name: 'Jerusalem', type: 'city', lat: 31.77, lon: 35.23 },
      { pattern: /\bdamascus\b/i, name: 'Damascus', type: 'city', lat: 33.51, lon: 36.29 },
      { pattern: /\baleppo\b/i, name: 'Aleppo', type: 'city', lat: 36.20, lon: 37.16 },
      { pattern: /\btehran\b/i, name: 'Tehran', type: 'city', lat: 35.69, lon: 51.39 },
      { pattern: /\bbaghdad\b/i, name: 'Baghdad', type: 'city', lat: 33.31, lon: 44.37 },
      { pattern: /\bankara\b/i, name: 'Ankara', type: 'city', lat: 39.93, lon: 32.86 },
      { pattern: /\bcairo\b/i, name: 'Cairo', type: 'city', lat: 30.04, lon: 31.24 },
      { pattern: /\bgaza\b/i, name: 'Gaza', type: 'region', lat: 31.52, lon: 34.45 },
      { pattern: /\bwest bank\b/i, name: 'West Bank', type: 'region', lat: 31.95, lon: 35.30 },
      { pattern: /\bgolan\b/i, name: 'Golan Heights', type: 'region', lat: 33.00, lon: 35.75 },
      { pattern: /\bsinai\b/i, name: 'Sinai', type: 'region', lat: 29.50, lon: 34.00 },
    ];

    const found: NewsLocation[] = [];

    for (const loc of locationPatterns) {
      if (loc.pattern.test(text)) {
        found.push({
          name: loc.name,
          type: loc.type,
          latitude: loc.lat,
          longitude: loc.lon,
        });
      }
    }

    return found;
  }

  /**
   * Extract entities (organizations, military terms)
   */
  private extractEntities(text: string): NewsEntity[] {
    const entityPatterns: Array<{
      pattern: RegExp;
      name: string;
      type: NewsEntity['type'];
    }> = [
      { pattern: /\bidf\b/i, name: 'IDF', type: 'military' },
      { pattern: /\biaf\b/i, name: 'IAF', type: 'military' },
      { pattern: /\busaf\b/i, name: 'USAF', type: 'military' },
      { pattern: /\braf\b/i, name: 'RAF', type: 'military' },
      { pattern: /\bnato\b/i, name: 'NATO', type: 'organization' },
      { pattern: /\bhezbollah\b/i, name: 'Hezbollah', type: 'organization' },
      { pattern: /\bhamas\b/i, name: 'Hamas', type: 'organization' },
      { pattern: /\bhouthi\b/i, name: 'Houthi', type: 'organization' },
      { pattern: /\birgc\b/i, name: 'IRGC', type: 'military' },
      { pattern: /\bpentagon\b/i, name: 'Pentagon', type: 'organization' },
      { pattern: /\bf-?35\b/i, name: 'F-35', type: 'aircraft' },
      { pattern: /\bf-?16\b/i, name: 'F-16', type: 'aircraft' },
      { pattern: /\bf-?15\b/i, name: 'F-15', type: 'aircraft' },
      { pattern: /\bkc-?135\b/i, name: 'KC-135', type: 'aircraft' },
      { pattern: /\bawacs\b/i, name: 'AWACS', type: 'aircraft' },
      { pattern: /\bdrone\b/i, name: 'Drone', type: 'aircraft' },
      { pattern: /\buav\b/i, name: 'UAV', type: 'aircraft' },
    ];

    const found: NewsEntity[] = [];

    for (const entity of entityPatterns) {
      if (entity.pattern.test(text)) {
        found.push({
          name: entity.name,
          type: entity.type,
        });
      }
    }

    return found;
  }

  /**
   * Categorize article based on content
   */
  private categorizeArticle(text: string): string[] {
    const categories: string[] = [];
    const lowerText = text.toLowerCase();

    if (/airstrike|strike|bombing|attack/.test(lowerText)) {
      categories.push('airstrike');
    }
    if (/missile|rocket/.test(lowerText)) {
      categories.push('missile');
    }
    if (/drone|uav|unmanned/.test(lowerText)) {
      categories.push('drone');
    }
    if (/fighter|jet|aircraft|plane/.test(lowerText)) {
      categories.push('aircraft');
    }
    if (/tanker|refuel/.test(lowerText)) {
      categories.push('tanker');
    }
    if (/surveillance|reconnaissance|spy/.test(lowerText)) {
      categories.push('surveillance');
    }
    if (/exercise|drill|training/.test(lowerText)) {
      categories.push('exercise');
    }
    if (/deployment|deploy/.test(lowerText)) {
      categories.push('deployment');
    }

    return categories;
  }

  /**
   * Filter articles by relevance score
   */
  filterByRelevance(
    articles: GDELTArticle[],
    minRelevance = 0.5
  ): GDELTArticle[] {
    return articles.filter((article) => {
      let relevanceScore = 0;
      const lowerTitle = article.title.toLowerCase();

      // Score based on keyword matches
      for (const keyword of NEWS_KEYWORDS) {
        if (lowerTitle.includes(keyword.toLowerCase())) {
          relevanceScore += 0.1;
        }
      }

      // Boost for specific terms
      if (/military|airstrike|fighter jet|missile/.test(lowerTitle)) {
        relevanceScore += 0.3;
      }

      return relevanceScore >= minRelevance;
    });
  }
}

// Export singleton instance
export const gdeltService = new GDELTService();

// Export convenience functions
export async function fetchMilitaryAviationNews(
  timespan = '24h'
): Promise<GDELTArticle[]> {
  return gdeltService.fetchMilitaryAviationNews(timespan);
}

export async function fetchRegionNews(
  region: string,
  timespan = '24h'
): Promise<GDELTArticle[]> {
  return gdeltService.fetchRegionNews(region, timespan);
}
