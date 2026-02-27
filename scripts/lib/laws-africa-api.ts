/**
 * Laws.Africa Content API adapter
 *
 * Provides paginated access to legislation from Laws.Africa's structured
 * Akoma Ntoso API (https://api.laws.africa/v3).
 *
 * Auth: requires LAWS_AFRICA_TOKEN environment variable.
 * Rate limiting: 500ms minimum between requests, exponential backoff on 429.
 *
 * Exports:
 *   - listActs(countryCode)   — paginate through all acts for a country
 *   - fetchActHtml(frbrUri)   — fetch the English HTML of a specific act
 */

const BASE_URL = 'https://api.laws.africa/v3';
const USER_AGENT = 'ansvar-law-mcp/1.0 (https://github.com/Ansvar-Systems; hello@ansvar.ai)';
const MIN_DELAY_MS = 500;

let lastRequestTime = 0;

/* ---------- Types ---------- */

export interface Work {
  frbr_uri: string;
  title: string;
  expression_date: string;
  commenced: boolean;
  repealed: boolean;
  amended: boolean;
  type_name: string;
  nature: string;
  number: string;
  year: string;
  publication_date: string;
  url: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/* ---------- Internal helpers ---------- */

function getToken(): string {
  const token = process.env['LAWS_AFRICA_TOKEN'];
  if (!token) {
    throw new Error(
      'LAWS_AFRICA_TOKEN environment variable is required.\n' +
      'Get an API token at https://edit.laws.africa/accounts/profile/api/',
    );
  }
  return token;
}

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Make an authenticated request to the Laws.Africa API.
 * Handles rate limiting (500ms between requests) and retries on 429
 * using the Retry-After header with exponential backoff fallback.
 */
async function apiRequest(url: string, accept: string, maxRetries = 3): Promise<Response> {
  const token = getToken();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await rateLimit();

    const response = await fetch(url, {
      headers: {
        'Authorization': `Token ${token}`,
        'Accept': accept,
        'User-Agent': USER_AGENT,
      },
      redirect: 'follow',
    });

    if (response.status === 429) {
      if (attempt < maxRetries) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.pow(2, attempt + 1) * 1000;
        console.log(`  429 rate-limited on ${url}, waiting ${waitMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        continue;
      }
    }

    if (response.status >= 500) {
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
    }

    return response;
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

/* ---------- Public API ---------- */

/**
 * List all acts for a country code by paginating through the API.
 *
 * @param countryCode  ISO 3166-1 alpha-2 code (lowercase), e.g. "tz", "ug"
 * @returns            Array of all Work objects for that country's acts
 */
export async function listActs(countryCode: string): Promise<Work[]> {
  const allWorks: Work[] = [];
  let url: string | null = `${BASE_URL}/akn/${countryCode}/.json?nature=act`;
  let page = 1;

  while (url) {
    process.stdout.write(`  Fetching page ${page}...`);
    const response = await apiRequest(url, 'application/json');

    if (!response.ok) {
      throw new Error(
        `Laws.Africa API returned HTTP ${response.status} for ${url}: ${await response.text()}`,
      );
    }

    const data = (await response.json()) as PaginatedResponse<Work>;
    allWorks.push(...data.results);
    console.log(` ${data.results.length} acts (total: ${allWorks.length}/${data.count})`);

    url = data.next;
    page++;
  }

  return allWorks;
}

/**
 * Fetch the English HTML content of a specific act.
 *
 * The Laws.Africa API serves Akoma Ntoso HTML at the expression URL
 * with Accept: text/html.
 *
 * @param frbrUri  FRBR URI of the work, e.g. "/akn/tz/act/2015/4"
 * @returns        HTML string of the act content
 */
export async function fetchActHtml(frbrUri: string): Promise<string> {
  // The HTML endpoint is the FRBR URI under the API base
  const url = `${BASE_URL}${frbrUri}.html`;
  const response = await apiRequest(url, 'text/html');

  if (!response.ok) {
    throw new Error(
      `Laws.Africa API returned HTTP ${response.status} for ${frbrUri}: ${response.statusText}`,
    );
  }

  return await response.text();
}
