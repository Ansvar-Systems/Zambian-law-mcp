#!/usr/bin/env tsx
/**
 * Zambia Law MCP -- Census Script (AfricanLII Direct Scraping)
 *
 * Scrapes the legislation listing pages from zambialii.org to enumerate
 * ALL acts. Writes data/census.json in golden standard format.
 *
 * No API key required -- scrapes the public listing pages directly.
 *
 * Source: https://zambialii.org/legislation
 * Note: zambialii.org does NOT use the /en/ prefix (unlike tanzlii/ulii).
 *
 * Usage:
 *   npx tsx scripts/census.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');

/* ----- Jurisdiction constants (change per country) ----- */
const COUNTRY_CODE = 'zm';
const JURISDICTION = 'ZM';
const JURISDICTION_NAME = 'Zambia';
const PORTAL = 'https://zambialii.org';
const LISTING_BASE = 'https://zambialii.org/legislation';
const AKN_PATH_PREFIX = '/akn/zm/';

/* ---------- Types ---------- */

interface CensusLawEntry {
  id: string;
  title: string;
  identifier: string;
  frbr_uri: string;
  url: string;
  year: string;
  number: string;
  status: 'in_force' | 'amended' | 'repealed';
  category: 'act';
  classification: 'ingestable' | 'excluded' | 'inaccessible';
  ingested: boolean;
  provision_count: number;
  ingestion_date: string | null;
}

interface CensusFile {
  schema_version: string;
  jurisdiction: string;
  jurisdiction_name: string;
  portal: string;
  census_date: string;
  agent: string;
  summary: {
    total_laws: number;
    ingestable: number;
    ocr_needed: number;
    inaccessible: number;
    excluded: number;
  };
  laws: CensusLawEntry[];
}

interface ScrapedAct {
  title: string;
  href: string;
  frbr_uri: string;
}

/* ---------- Helpers ---------- */

/**
 * Convert an AKN path into a stable kebab-case ID.
 * zambialii.org uses /akn/zm/ paths (no /en/ prefix).
 */
function hrefToId(href: string): string {
  let cleaned = href.replace(/^\/en\//, '/');
  const aknMatch = cleaned.match(/\/akn\/([a-z]{2}\/act(?:\/[a-z]+)?\/\d{4}\/[a-zA-Z0-9]+)/);
  if (aknMatch) {
    return aknMatch[1].replace(/\//g, '-').toLowerCase();
  }
  cleaned = cleaned.replace(/^\/akn\//, '').replace(/\/eng@.*$/, '');
  return cleaned.replace(/\//g, '-').toLowerCase();
}

/**
 * Extract the FRBR URI from an href.
 */
function hrefToFrbrUri(href: string): string {
  let cleaned = href.replace(/^\/en\//, '/');
  cleaned = cleaned.replace(/\/eng@.*$/, '');
  return cleaned;
}

/**
 * Extract year and number from an FRBR URI.
 */
function extractYearNumber(frbrUri: string): { year: string; number: string } {
  const match = frbrUri.match(/\/(\d{4})\/([a-zA-Z0-9]+)$/);
  if (match) {
    return { year: match[1], number: match[2] };
  }
  return { year: 'unknown', number: 'unknown' };
}

/**
 * Scrape act entries from a single listing page HTML.
 */
function scrapeListingPage(html: string): ScrapedAct[] {
  const acts: ScrapedAct[] = [];
  const linkPattern = new RegExp(
    `<a\\s+href="(${AKN_PATH_PREFIX.replace(/\//g, '\\/')}[^"]+)"[^>]*>([^<]+)<\\/a>`,
    'g',
  );

  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(html)) !== null) {
    const href = match[1];
    const title = match[2]
      .replace(/&#x27;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    if (title.length > 0) {
      acts.push({
        title,
        href,
        frbr_uri: hrefToFrbrUri(href),
      });
    }
  }

  return acts;
}

/**
 * Load existing census for merge/resume (preserves ingestion data).
 */
function loadExistingCensus(): Map<string, CensusLawEntry> {
  const existing = new Map<string, CensusLawEntry>();
  if (fs.existsSync(CENSUS_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf-8')) as CensusFile;
      for (const law of data.laws) {
        if ('ingested' in law && 'frbr_uri' in law) {
          existing.set(law.id, law);
        }
      }
    } catch {
      // Ignore parse errors, start fresh
    }
  }
  return existing;
}

/* ---------- Main ---------- */

async function main(): Promise<void> {
  console.log(`${JURISDICTION_NAME} Law MCP -- Census (AfricanLII Scraping)`);
  console.log('='.repeat(55) + '\n');
  console.log(`  Jurisdiction:  ${JURISDICTION} (${JURISDICTION_NAME})`);
  console.log(`  Country code:  ${COUNTRY_CODE}`);
  console.log(`  Portal:        ${PORTAL}`);
  console.log(`  Listing URL:   ${LISTING_BASE}`);
  console.log();

  const existingEntries = loadExistingCensus();
  if (existingEntries.size > 0) {
    console.log(`  Loaded ${existingEntries.size} existing entries from previous census\n`);
  }

  const allScrapedActs: ScrapedAct[] = [];
  const seenHrefs = new Set<string>();
  let page = 1;
  let emptyPages = 0;

  console.log('  Scraping legislation listing pages...\n');

  while (emptyPages < 2) {
    const url = page === 1 ? LISTING_BASE : `${LISTING_BASE}?page=${page}`;
    process.stdout.write(`  Page ${page}...`);

    const result = await fetchWithRateLimit(url);

    if (result.status !== 200) {
      console.log(` HTTP ${result.status} -- stopping pagination`);
      break;
    }

    const pageActs = scrapeListingPage(result.body);
    const newActs = pageActs.filter(a => !seenHrefs.has(a.href));

    for (const act of newActs) {
      seenHrefs.add(act.href);
      allScrapedActs.push(act);
    }

    if (newActs.length === 0) {
      console.log(' 0 new acts (empty page)');
      emptyPages++;
    } else {
      console.log(` ${newActs.length} acts (total: ${allScrapedActs.length})`);
      emptyPages = 0;
    }

    page++;
  }

  console.log(`\n  Total acts scraped: ${allScrapedActs.length}\n`);

  const today = new Date().toISOString().split('T')[0];

  for (const scraped of allScrapedActs) {
    const id = hrefToId(scraped.href);
    const { year, number } = extractYearNumber(scraped.frbr_uri);

    const existing = existingEntries.get(id);

    const entry: CensusLawEntry = {
      id,
      title: scraped.title,
      identifier: `act/${year}/${number}`,
      frbr_uri: scraped.frbr_uri,
      url: `${PORTAL}${scraped.href}`,
      year,
      number,
      status: existing?.status ?? 'in_force',
      category: 'act',
      classification: 'ingestable',
      ingested: existing?.ingested ?? false,
      provision_count: existing?.provision_count ?? 0,
      ingestion_date: existing?.ingestion_date ?? null,
    };

    existingEntries.set(id, entry);
  }

  const allLaws = Array.from(existingEntries.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  const ingestable = allLaws.filter(l => l.classification === 'ingestable').length;
  const excluded = allLaws.filter(l => l.classification === 'excluded').length;
  const inaccessible = allLaws.filter(l => l.classification === 'inaccessible').length;

  const census: CensusFile = {
    schema_version: '1.0',
    jurisdiction: JURISDICTION,
    jurisdiction_name: JURISDICTION_NAME,
    portal: PORTAL,
    census_date: today,
    agent: 'africanlii-scraper',
    summary: {
      total_laws: allLaws.length,
      ingestable,
      ocr_needed: 0,
      inaccessible,
      excluded,
    },
    laws: allLaws,
  };

  fs.mkdirSync(path.dirname(CENSUS_PATH), { recursive: true });
  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));

  console.log('='.repeat(55));
  console.log('Census Complete');
  console.log('='.repeat(55) + '\n');
  console.log(`  Total acts:     ${allLaws.length}`);
  console.log(`  Ingestable:     ${ingestable}`);
  console.log(`  Excluded:       ${excluded}`);
  console.log(`  Inaccessible:   ${inaccessible}`);
  console.log(`\n  Output: ${CENSUS_PATH}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
