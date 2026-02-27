#!/usr/bin/env tsx
/**
 * Zambia Law MCP -- Census-Driven Ingestion Pipeline (AfricanLII Scraping)
 *
 * Reads data/census.json (produced by census.ts via AfricanLII scraping)
 * and fetches + parses every ingestable Act directly from zambialii.org.
 *
 * Features:
 *   - Resume support: skips Acts that already have a seed JSON file
 *   - Census update: writes provision counts + ingestion dates back to census.json
 *   - Rate limiting: 500ms minimum between requests (via fetcher.ts)
 *
 * Usage:
 *   npm run ingest                 # Full ingestion
 *   npm run ingest -- --limit 5    # Test with 5 acts
 *   npm run ingest -- --skip-fetch # Reuse cached HTML
 *   npm run ingest -- --force      # Re-ingest all
 *   npm run ingest -- --resume     # Same as default (skip existing)
 *
 * Data source: zambialii.org (AfricanLII / Laws.Africa Peachjam platform)
 * Format: AKN (Akoma Ntoso) structured HTML embedded in detail pages
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { fetchWithRateLimit } from './lib/fetcher.js';
import { parseActHtml, type ActIndexEntry, type ParsedAct } from './lib/parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SOURCE_DIR = path.resolve(__dirname, '../data/source');
const SEED_DIR = path.resolve(__dirname, '../data/seed');
const CENSUS_PATH = path.resolve(__dirname, '../data/census.json');

/* ----- Jurisdiction constants (change per country) ----- */
const JURISDICTION_NAME = 'Zambia';
const SOURCE_LABEL = 'zambialii.org (AfricanLII direct scraping)';

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

function parseArgs(): { limit: number | null; skipFetch: boolean; force: boolean } {
  const args = process.argv.slice(2);
  let limit: number | null = null;
  let skipFetch = false;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--limit' && args[i + 1]) {
      limit = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--skip-fetch') {
      skipFetch = true;
    } else if (args[i] === '--force') {
      force = true;
    } else if (args[i] === '--resume') {
      // Default behavior
    }
  }

  return { limit, skipFetch, force };
}

function censusToActEntry(law: CensusLawEntry): ActIndexEntry {
  return {
    id: law.id,
    title: law.title,
    titleEn: law.title,
    shortName: law.title.length > 30 ? law.title.substring(0, 27) + '...' : law.title,
    status: law.status === 'in_force' ? 'in_force' : law.status === 'amended' ? 'amended' : 'repealed',
    issuedDate: '',
    inForceDate: '',
    url: law.url,
  };
}

/* ---------- Main ---------- */

async function main(): Promise<void> {
  const { limit, skipFetch, force } = parseArgs();

  console.log(`${JURISDICTION_NAME} Law MCP -- Ingestion Pipeline (AfricanLII Scraping)`);
  console.log('='.repeat(62) + '\n');
  console.log(`  Source: ${SOURCE_LABEL}`);

  if (limit) console.log(`  --limit ${limit}`);
  if (skipFetch) console.log(`  --skip-fetch`);
  if (force) console.log(`  --force (re-ingest all)`);

  if (!fs.existsSync(CENSUS_PATH)) {
    console.error(`\nERROR: Census file not found at ${CENSUS_PATH}`);
    console.error('Run "npx tsx scripts/census.ts" first.');
    process.exit(1);
  }

  const census: CensusFile = JSON.parse(fs.readFileSync(CENSUS_PATH, 'utf-8'));
  const ingestable = census.laws.filter(l => l.classification === 'ingestable');
  const acts = limit ? ingestable.slice(0, limit) : ingestable;

  console.log(`\n  Census: ${census.summary.total_laws} total, ${ingestable.length} ingestable`);
  console.log(`  Processing: ${acts.length} acts\n`);

  fs.mkdirSync(SOURCE_DIR, { recursive: true });
  fs.mkdirSync(SEED_DIR, { recursive: true });

  let processed = 0;
  let ingested = 0;
  let skipped = 0;
  let failed = 0;
  let totalProvisions = 0;
  let totalDefinitions = 0;
  const results: { act: string; provisions: number; definitions: number; status: string }[] = [];

  const censusMap = new Map<string, CensusLawEntry>();
  for (const law of census.laws) {
    censusMap.set(law.id, law);
  }

  const today = new Date().toISOString().split('T')[0];

  for (const law of acts) {
    const act = censusToActEntry(law);
    const sourceFile = path.join(SOURCE_DIR, `${act.id}.html`);
    const seedFile = path.join(SEED_DIR, `${act.id}.json`);

    if (!force && fs.existsSync(seedFile)) {
      try {
        const existing = JSON.parse(fs.readFileSync(seedFile, 'utf-8')) as ParsedAct;
        const provCount = existing.provisions?.length ?? 0;
        const defCount = existing.definitions?.length ?? 0;
        totalProvisions += provCount;
        totalDefinitions += defCount;

        const entry = censusMap.get(law.id);
        if (entry) {
          entry.ingested = true;
          entry.provision_count = provCount;
          entry.ingestion_date = entry.ingestion_date ?? today;
        }

        results.push({ act: act.shortName, provisions: provCount, definitions: defCount, status: 'resumed' });
        skipped++;
        processed++;
        continue;
      } catch {
        // Corrupt seed file, re-ingest
      }
    }

    try {
      let html: string;

      if (fs.existsSync(sourceFile) && skipFetch) {
        html = fs.readFileSync(sourceFile, 'utf-8');
        console.log(`  [${processed + 1}/${acts.length}] Using cached ${act.id} (${(html.length / 1024).toFixed(0)} KB)`);
      } else {
        process.stdout.write(`  [${processed + 1}/${acts.length}] Fetching ${act.id}...`);

        try {
          const result = await fetchWithRateLimit(law.url);
          if (result.status !== 200) {
            throw new Error(`HTTP ${result.status} from ${law.url}`);
          }
          html = result.body;
        } catch (fetchError) {
          const msg = fetchError instanceof Error ? fetchError.message : String(fetchError);
          console.log(` FETCH ERROR: ${msg}`);

          const entry = censusMap.get(law.id);
          if (entry) {
            entry.classification = 'inaccessible';
          }

          results.push({ act: act.shortName, provisions: 0, definitions: 0, status: `FETCH ERROR: ${msg.substring(0, 80)}` });
          failed++;
          processed++;
          continue;
        }

        fs.writeFileSync(sourceFile, html);
        console.log(` OK (${(html.length / 1024).toFixed(0)} KB)`);
      }

      const parsed = parseActHtml(html, act);
      fs.writeFileSync(seedFile, JSON.stringify(parsed, null, 2));
      totalProvisions += parsed.provisions.length;
      totalDefinitions += parsed.definitions.length;
      console.log(`    -> ${parsed.provisions.length} provisions, ${parsed.definitions.length} definitions`);

      const entry = censusMap.get(law.id);
      if (entry) {
        entry.ingested = true;
        entry.provision_count = parsed.provisions.length;
        entry.ingestion_date = today;
      }

      results.push({
        act: act.shortName,
        provisions: parsed.provisions.length,
        definitions: parsed.definitions.length,
        status: 'OK',
      });
      ingested++;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`  ERROR parsing ${act.id}: ${msg}`);
      results.push({ act: act.shortName, provisions: 0, definitions: 0, status: `ERROR: ${msg.substring(0, 80)}` });
      failed++;
    }

    processed++;

    if (processed % 50 === 0) {
      writeCensus(census, censusMap);
      console.log(`  [checkpoint] Census updated at ${processed}/${acts.length}`);
    }
  }

  writeCensus(census, censusMap);

  console.log(`\n${'='.repeat(70)}`);
  console.log('Ingestion Report');
  console.log('='.repeat(70));
  console.log(`\n  Source:      ${SOURCE_LABEL}`);
  console.log(`  Processed:   ${processed}`);
  console.log(`  New:         ${ingested}`);
  console.log(`  Resumed:     ${skipped}`);
  console.log(`  Failed:      ${failed}`);
  console.log(`  Total provisions:  ${totalProvisions}`);
  console.log(`  Total definitions: ${totalDefinitions}`);

  const failures = results.filter(r => r.status.startsWith('HTTP') || r.status.startsWith('FETCH') || r.status.startsWith('ERROR'));
  if (failures.length > 0) {
    console.log(`\n  Failed acts:`);
    for (const f of failures) {
      console.log(`    ${f.act}: ${f.status}`);
    }
  }

  const zeroProv = results.filter(r => r.provisions === 0 && r.status === 'OK');
  if (zeroProv.length > 0) {
    console.log(`\n  Zero-provision acts (${zeroProv.length}):`);
    for (const z of zeroProv.slice(0, 20)) {
      console.log(`    ${z.act}`);
    }
    if (zeroProv.length > 20) {
      console.log(`    ... and ${zeroProv.length - 20} more`);
    }
  }

  console.log('');
}

function writeCensus(census: CensusFile, censusMap: Map<string, CensusLawEntry>): void {
  census.laws = Array.from(censusMap.values()).sort((a, b) =>
    a.title.localeCompare(b.title),
  );

  census.summary.total_laws = census.laws.length;
  census.summary.ingestable = census.laws.filter(l => l.classification === 'ingestable').length;
  census.summary.inaccessible = census.laws.filter(l => l.classification === 'inaccessible').length;
  census.summary.excluded = census.laws.filter(l => l.classification === 'excluded').length;

  fs.writeFileSync(CENSUS_PATH, JSON.stringify(census, null, 2));
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
