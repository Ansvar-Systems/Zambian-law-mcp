/**
 * Akoma Ntoso HTML parser for Laws.Africa legislation
 *
 * Parses structured AKN HTML served by the Laws.Africa Content API.
 * The HTML uses semantic CSS classes:
 *   - akn-section: individual sections (with id and data-eid attributes)
 *   - akn-part / akn-chapter: grouping containers
 *   - akn-paragraph / akn-subsection: sub-elements within sections
 *   - akn-num: section/paragraph numbering
 *   - akn-heading / h3: section titles
 *   - akn-p: paragraph text content
 *   - akn-intro / akn-content / akn-wrapUp: structural wrappers
 *
 * This parser works with any Laws.Africa country (TZ, UG, ZM, NA, etc.)
 * since the AKN HTML structure is consistent across jurisdictions.
 */

export interface ActIndexEntry {
  id: string;
  title: string;
  titleEn: string;
  shortName: string;
  status: 'in_force' | 'amended' | 'repealed' | 'not_yet_in_force';
  issuedDate: string;
  inForceDate: string;
  url: string;
  description?: string;
}

export interface ParsedProvision {
  provision_ref: string;
  chapter?: string;
  section: string;
  title: string;
  content: string;
}

export interface ParsedDefinition {
  term: string;
  definition: string;
  source_provision?: string;
}

export interface ParsedAct {
  id: string;
  type: 'statute';
  title: string;
  title_en: string;
  short_name: string;
  status: string;
  issued_date: string;
  in_force_date: string;
  url: string;
  description?: string;
  provisions: ParsedProvision[];
  definitions: ParsedDefinition[];
}

/**
 * Strip HTML tags and decode common entities, normalising whitespace.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8220;/g, '\u201c')
    .replace(/&#8221;/g, '\u201d')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Determine the chapter/part container for a section from its AKN id.
 *
 * AKN section ids follow patterns like:
 *   part_I__sec_1          -> chapter = "Part I"
 *   part_VII__sec_35       -> chapter = "Part VII"
 *   chp_ONE__sec_1         -> chapter = "Chapter ONE"
 *   chp_III__sec_19        -> chapter = "Chapter III"
 *   chp_2__part_A__sec_5   -> chapter = "Chapter 2, Part A"
 *   sec_1                  -> chapter = undefined (top-level section)
 */
function extractChapter(sectionId: string): string | undefined {
  const parts: string[] = [];

  const chpMatch = sectionId.match(/chp_([^_]+)__/);
  if (chpMatch) parts.push(`Chapter ${chpMatch[1]}`);

  const partMatch = sectionId.match(/part_([^_]+)__/);
  if (partMatch) parts.push(`Part ${partMatch[1]}`);

  return parts.length > 0 ? parts.join(', ') : undefined;
}

/**
 * Extract the section number from heading text or from the AKN id.
 *
 * Heading patterns:
 *   "3. Short title"           -> "3"
 *   "25A. Special provisions"  -> "25A"
 *   "Section 3"                -> "3"
 *
 * AKN id fallback:
 *   "sec_3"                    -> "3"
 *   "part_I__sec_25A"          -> "25A"
 */
function extractSectionNumber(heading: string, sectionId: string): string | null {
  // Try heading first: "N. Title" or "NA. Title"
  const headingMatch = heading.match(/^(\d+[A-Za-z]*)\.\s/);
  if (headingMatch) return headingMatch[1];

  // Try "Section N" pattern
  const sectionMatch = heading.match(/^Section\s+(\d+[A-Za-z]*)/i);
  if (sectionMatch) return sectionMatch[1];

  // Fallback: extract from AKN id
  const idMatch = sectionId.match(/sec_(\d+[A-Za-z]*)$/);
  if (idMatch) return idMatch[1];

  return null;
}

/**
 * Extract the section title from heading text.
 * Strips the leading number and period, or "Section N" prefix.
 */
function extractSectionTitle(heading: string): string {
  return heading
    .replace(/^\d+[A-Za-z]*\.\s*/, '')
    .replace(/^Section\s+\d+[A-Za-z]*\.\s*/i, '')
    .trim();
}

/**
 * Parse Laws.Africa Akoma Ntoso HTML to extract provisions from a statute.
 *
 * The HTML contains <section class="akn-section" id="..." data-eid="..."> elements.
 * Each section has an <h3> with the section number and title, followed by
 * structural content using akn-intro, akn-paragraph, akn-subsection, akn-content,
 * akn-p, and akn-num elements.
 *
 * @param html   The full AKN HTML string from Laws.Africa
 * @param lawId  The law's stable ID (used only for logging)
 * @returns      Array of parsed provisions
 */
export function parseAknHtml(html: string, lawId: string): ParsedProvision[] {
  const provisions: ParsedProvision[] = [];

  // Match <section class="akn-section" id="..." ...> boundaries.
  // The id attribute may come before or after class; data-eid is optional.
  const sectionPattern = /<section\s+[^>]*class="akn-section"[^>]*id="([^"]+)"[^>]*>|<section\s+[^>]*id="([^"]+)"[^>]*class="akn-section"[^>]*>/g;
  const sectionStarts: { id: string; index: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = sectionPattern.exec(html)) !== null) {
    const id = match[1] ?? match[2];
    sectionStarts.push({ id, index: match.index });
  }

  if (sectionStarts.length === 0) {
    // No akn-section elements found — log and return empty
    console.log(`    [parser] No akn-section elements found in ${lawId}`);
    return [];
  }

  for (let i = 0; i < sectionStarts.length; i++) {
    const start = sectionStarts[i];
    const endIndex = i + 1 < sectionStarts.length
      ? sectionStarts[i + 1].index
      : html.length;

    const sectionHtml = html.substring(start.index, endIndex);

    // Extract heading from <h3>...</h3>
    const headingMatch = sectionHtml.match(/<h3>([\s\S]*?)<\/h3>/);
    if (!headingMatch) continue;

    const headingText = stripHtml(headingMatch[1]);
    const sectionNum = extractSectionNumber(headingText, start.id);
    if (!sectionNum) continue;

    const title = extractSectionTitle(headingText);
    const chapter = extractChapter(start.id);

    // Provision reference: "s" prefix for sections (standard for Acts)
    const provisionRef = `s${sectionNum}`;

    // Extract the full text content, stripping HTML tags.
    // Remove the heading to avoid duplication in content.
    const contentHtml = sectionHtml.replace(/<h3>[\s\S]*?<\/h3>/, '');
    const content = stripHtml(contentHtml);

    if (content.length > 10) {
      provisions.push({
        provision_ref: provisionRef,
        chapter,
        section: sectionNum,
        title,
        content: content.substring(0, 12000), // Cap at 12K chars per section
      });
    }
  }

  return provisions;
}

/**
 * Extract term definitions from provision text.
 *
 * Definitions in AKN HTML typically appear in interpretation/definition
 * sections with patterns like:
 *   "term" means/includes definition text;
 *   "term" has the meaning assigned to it in ...
 */
export function extractDefinitions(
  provisions: ParsedProvision[],
): ParsedDefinition[] {
  const definitions: ParsedDefinition[] = [];
  const seen = new Set<string>();

  for (const prov of provisions) {
    // Only look in interpretation/definition sections
    const lowerTitle = prov.title.toLowerCase();
    if (
      !lowerTitle.includes('interpretation') &&
      !lowerTitle.includes('definition') &&
      !lowerTitle.includes('meaning')
    ) {
      continue;
    }

    // Match patterns: "term" means/includes definition
    const defPattern = /["\u201c]([^"\u201d]+)["\u201d]\s+(means|includes|has the meaning)\s+([^;]+)/gi;
    let defMatch: RegExpExecArray | null;

    while ((defMatch = defPattern.exec(prov.content)) !== null) {
      const term = defMatch[1].trim();
      const definition = defMatch[3].trim();

      if (term.length > 0 && definition.length > 5 && !seen.has(term.toLowerCase())) {
        seen.add(term.toLowerCase());
        definitions.push({
          term,
          definition,
          source_provision: prov.provision_ref,
        });
      }
    }
  }

  return definitions;
}

/**
 * Full act parser: combines provision extraction and definition extraction.
 * This is the main entry point used by ingest.ts.
 */
export function parseActHtml(html: string, act: ActIndexEntry): ParsedAct {
  const provisions = parseAknHtml(html, act.id);
  const definitions = extractDefinitions(provisions);

  return {
    id: act.id,
    type: 'statute',
    title: act.title,
    title_en: act.titleEn,
    short_name: act.shortName,
    status: act.status,
    issued_date: act.issuedDate,
    in_force_date: act.inForceDate,
    url: act.url,
    description: act.description,
    provisions,
    definitions,
  };
}
