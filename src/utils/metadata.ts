/**
 * Response metadata utilities for Zambia Law MCP.
 */

import type Database from '@ansvar/mcp-sqlite';

export interface ResponseMetadata {
  data_source: string;
  jurisdiction: string;
  disclaimer: string;
  freshness?: string;
  note?: string;
  query_strategy?: string;
}

export interface ToolResponse<T> {
  results: T;
  _metadata: ResponseMetadata;
}

export function generateResponseMetadata(
  db: InstanceType<typeof Database>,
): ResponseMetadata {
  let freshness: string | undefined;
  try {
    const row = db.prepare(
      "SELECT value FROM db_metadata WHERE key = 'built_at'"
    ).get() as { value: string } | undefined;
    if (row) freshness = row.value;
  } catch {
    // Ignore
  }

  return {
    data_source: 'ZamLII (zambialii.org) — Zambia Legal Information Institute, hosted by AfricanLII',
    jurisdiction: 'ZM',
    disclaimer:
      'This data is sourced from ZamLII under free access principles. ' +
      'Government legislation is public domain under Zambian law. ' +
      'Always verify with the official Zambia Government Gazette or National Assembly of Zambia portal.',
    freshness,
  };
}
