#!/usr/bin/env tsx
/**
 * Zambia Law MCP -- Census Script (Laws.Africa API)
 *
 * Enumerates ALL acts for Zambia from the Laws.Africa Content API
 * and writes data/census.json in golden standard format.
 *
 * Requires: LAWS_AFRICA_TOKEN environment variable.
 *
 * Source: Laws.Africa Content API (https://api.laws.africa/v3)
 * Portal: https://zambialii.org
 *
 * Usage:
 *   LAWS_AFRICA_TOKEN=xxx npx tsx scripts/census.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { listActs, type Work } from './lib/laws-africa-api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');

/* ----- Jurisdiction constants (change per country) ----- */
const COUNTRY_CODE = 'zm';
const JURISDICTION = 'ZM';
const JURISDICTION_NAME = 'Zambia';
const PORTAL = 'https://zambialii.org';

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

/* ---------- Helpers ---------- */

/**
 * Convert a Laws.Africa Work into a stable kebab-case ID.
 * Uses the FRBR URI to generate a unique, deterministic ID.
 * E.g. "/akn/zm/act/2021/3" -> "zm-act-2021-3"
 */
function workToId(work: Work): string {
  return work.frbr_uri
    .replace(/^\/akn\//, '')
    .replace(/\//g, '-')
    .toLowerCase();
}

/**
 * Determine the legislative status from Laws.Africa Work metadata.
 */
function workToStatus(work: Work): 'in_force' | 'amended' | 'repealed' {
  if (work.repealed) return 'repealed';
  if (work.amended) return 'amended';
  return 'in_force';
}

/**
 * Determine classification: repealed acts are excluded, uncommenced acts
 * are excluded, everything else is ingestable.
 */
function workToClassification(work: Work): 'ingestable' | 'excluded' {
  if (work.repealed) return 'excluded';
  if (!work.commenced) return 'excluded';
  return 'ingestable';
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
  console.log(`${JURISDICTION_NAME} Law MCP -- Census (Laws.Africa API)`);
  console.log('='.repeat(55) + '\n');
  console.log(`  Jurisdiction:  ${JURISDICTION} (${JURISDICTION_NAME})`);
  console.log(`  Country code:  ${COUNTRY_CODE}`);
  console.log(`  Portal:        ${PORTAL}`);
  console.log(`  API:           https://api.laws.africa/v3`);
  console.log();

  const existingEntries = loadExistingCensus();
  if (existingEntries.size > 0) {
    console.log(`  Loaded ${existingEntries.size} existing entries from previous census\n`);
  }

  // Fetch all acts from Laws.Africa
  console.log('  Fetching acts from Laws.Africa API...\n');
  const works = await listActs(COUNTRY_CODE);

  console.log(`\n  Total acts from API: ${works.length}\n`);

  // Convert to census entries, merging with existing data
  const today = new Date().toISOString().split('T')[0];

  for (const work of works) {
    const id = workToId(work);
    const status = workToStatus(work);
    const classification = workToClassification(work);

    // Preserve ingestion data from existing census if available
    const existing = existingEntries.get(id);

    const entry: CensusLawEntry = {
      id,
      title: work.title,
      identifier: `act/${work.year}/${work.number}`,
      frbr_uri: work.frbr_uri,
      url: work.url,
      year: work.year,
      number: work.number,
      status,
      category: 'act',
      classification,
      ingested: existing?.ingested ?? false,
      provision_count: existing?.provision_count ?? 0,
      ingestion_date: existing?.ingestion_date ?? null,
    };

    existingEntries.set(id, entry);
  }

  // Build final census
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
    agent: 'laws-africa-api',
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
