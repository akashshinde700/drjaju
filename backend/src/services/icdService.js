// backend/src/services/icdService.js
// WHO ICD (ICD-10/ICD-11) integration service with token management and local ICD-10 fallback

const axios = require('axios');
const { getDb } = require('../config/db');

// Env configuration
const WHO_TOKEN_URL = process.env.WHO_ICD_TOKEN_URL || 'https://icdaccessmanagement.who.int/connect/token';
const ICD_API_BASE_URL = (process.env.ICD_API_BASE_URL || process.env.WHO_ICD_API_URL || 'https://id.who.int/icd/release/11').replace(/\/$/, '');
const ICD11_LINEARIZATION = process.env.ICD11_LINEARIZATION || '2024-01';
const ICD11_CHAPTER = process.env.ICD11_CHAPTER || 'mms';
const ICD_API_TIMEOUT_MS = parseInt(process.env.ICD_API_TIMEOUT_MS || '10000', 10);
const ICD_LANG = process.env.ICD_LANG || 'en';

const WHO_CLIENT_ID = process.env.WHO_ICD_CLIENT_ID || '';
const WHO_CLIENT_SECRET = process.env.WHO_ICD_CLIENT_SECRET || '';

// Token cache
let tokenCache = {
  accessToken: null,
  expiresAt: 0, // epoch ms
};

async function fetchAccessToken() {
  if (!WHO_CLIENT_ID || !WHO_CLIENT_SECRET) {
    throw new Error('WHO ICD client credentials missing. Set WHO_ICD_CLIENT_ID and WHO_ICD_CLIENT_SECRET');
  }

  const body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');
  body.set('client_id', WHO_CLIENT_ID);
  body.set('client_secret', WHO_CLIENT_SECRET);
  body.set('scope', 'icdapi_access');

  const resp = await axios.post(WHO_TOKEN_URL, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000,
  });

  const accessToken = resp.data?.access_token;
  const expiresIn = parseInt(resp.data?.expires_in || '3600', 10);
  if (!accessToken) {
    throw new Error('Failed to obtain WHO ICD access token');
  }
  tokenCache.accessToken = accessToken;
  // Refresh a bit before actual expiry (60s buffer)
  tokenCache.expiresAt = Date.now() + (expiresIn - 60) * 1000;
  return accessToken;
}

async function getAccessToken() {
  if (tokenCache.accessToken && Date.now() < tokenCache.expiresAt) {
    return tokenCache.accessToken;
  }
  return fetchAccessToken();
}

function authHeaders(token) {
  return {
    'Accept': 'application/json',
    'Accept-Language': ICD_LANG,
    'Authorization': `Bearer ${token}`,
  };
}

function normalizeSearchResponse(data) {
  // ICD-11 API returns { destinationEntities: [...] }
  const items = Array.isArray(data?.destinationEntities)
    ? data.destinationEntities.map((e) => ({
        id: e.id || e.code || e.theCode || e.foundationUri || e.uri,
        code: e.code || e.theCode || null,
        title: e.title?.['@value'] || e.title || e.bestTitle?.['@value'] || e.bestTitle || e.preferredLabel || null,
        uri: e.uri || e.foundationUri || e.id || null,
      }))
    : [];
  return { items, raw: data };
}

// ICD-11 search via WHO API
async function searchICD11(q, opts = {}) {
  if (!q || typeof q !== 'string') {
    throw new Error('Query text (q) is required for ICD-11 search');
  }

  const linearization = opts.linearization || ICD11_LINEARIZATION;
  const chapter = opts.chapter || ICD11_CHAPTER;
  const limit = Number.isFinite(opts.limit) ? opts.limit : undefined;
  const offset = Number.isFinite(opts.offset) ? opts.offset : undefined;

  const token = await getAccessToken();
  const url = `${ICD_API_BASE_URL}/${encodeURIComponent(linearization)}/${encodeURIComponent(chapter)}/search`;

  const params = {
    q,
    flatResults: true,
    useFlexisearch: true,
    includeKeywordResult: true,
    highlightingEnabled: true,
  };
  if (typeof limit === 'number') params.limit = limit;
  if (typeof offset === 'number') params.offset = offset;

  const resp = await axios.get(url, {
    params,
    headers: authHeaders(token),
    timeout: ICD_API_TIMEOUT_MS,
  });

  const normalized = normalizeSearchResponse(resp.data);
  // Add version marker
  normalized.items = normalized.items.map(item => ({ ...item, version: 'icd11' }));
  return normalized;
}

// ICD-11 get single entity
async function getICD11Code(id, opts = {}) {
  if (!id) {
    throw new Error('ICD-11 code/id is required');
  }

  const linearization = opts.linearization || ICD11_LINEARIZATION;
  const chapter = opts.chapter || ICD11_CHAPTER;

  const token = await getAccessToken();
  const url = `${ICD_API_BASE_URL}/${encodeURIComponent(linearization)}/${encodeURIComponent(chapter)}/${encodeURIComponent(id)}`;

  const resp = await axios.get(url, {
    headers: authHeaders(token),
    timeout: ICD_API_TIMEOUT_MS,
  });

  const item = resp.data;
  return {
    ...item,
    version: 'icd11',
  };
}

// ICD-10 local database search
async function searchICD10Local(q, opts = {}) {
  if (!q || typeof q !== 'string') {
    throw new Error('Query text (q) is required for ICD-10 search');
  }

  const limit = Number.isFinite(opts.limit) ? opts.limit : 20;
  const offset = Number.isFinite(opts.offset) ? opts.offset : 0;
  const db = getDb();
  const like = `%${q}%`;

  try {
    // Full-text search in ICD codes
    const [results] = await db.execute(
      `SELECT 
         icd_code as code,
         primary_description as title,
         secondary_description,
         short_description,
         chapter_code,
         group_code,
         status,
         billable
       FROM icd_codes 
       WHERE (icd_code LIKE ? OR primary_description LIKE ? OR secondary_description LIKE ?)
       ORDER BY 
         CASE 
           WHEN icd_code LIKE CONCAT(?, '%') THEN 1
           ELSE 2
         END,
         usage_count DESC,
         primary_description ASC
       LIMIT ${limit} OFFSET ${offset}`,
      [like, like, like, q]
    );

    // Format results to match ICD-11 format
    const items = results.map(row => ({
      id: row.code,
      code: row.code,
      title: row.title,
      secondaryDescription: row.secondary_description,
      shortDescription: row.short_description,
      chapterCode: row.chapter_code,
      groupCode: row.group_code,
      status: row.status,
      billable: row.billable,
      version: 'icd10'
    }));

    return { items };
  } catch (error) {
    console.error('ICD-10 search error:', error);
    throw new Error(`ICD-10 search failed: ${error.message}`);
  }
}

// Get ICD-10 code from local database
async function getICD10CodeLocal(code) {
  if (!code) {
    throw new Error('code is required');
  }

  const db = getDb();
  
  try {
    const [results] = await db.execute(
      `SELECT 
         icd_code as code,
         primary_description as title,
         secondary_description,
         short_description,
         chapter_code,
         group_code,
         status,
         billable,
         created_at,
         updated_at
       FROM icd_codes 
       WHERE icd_code = ?
       LIMIT 1`,
      [code]
    );

    if (results.length === 0) {
      const err = new Error('ICD-10 code not found');
      err.status = 404;
      throw err;
    }

    return {
      ...results[0],
      version: 'icd10'
    };
  } catch (error) {
    console.error('Get ICD-10 code error:', error);
    throw error;
  }
}

// ICD-11 local database search
async function searchICD11Local(q, opts = {}) {
  if (!q || typeof q !== 'string') {
    throw new Error('Query text (q) is required for ICD-11 search');
  }

  const limit = Number.isFinite(opts.limit) ? opts.limit : 20;
  const offset = Number.isFinite(opts.offset) ? opts.offset : 0;
  const db = getDb();
  const like = `%${q}%`;

  try {
    // Full-text search in ICD-11 codes
    const [results] = await db.execute(
      `SELECT 
         icd11_code as code,
         preferred_label as title,
         full_title,
         short_definition,
         chapter_code,
         block_code,
         linearization,
         classification_status,
         billable,
         usage_count
       FROM icd11_codes 
       WHERE (icd11_code LIKE ? OR preferred_label LIKE ? OR full_title LIKE ?)
       ORDER BY 
         CASE 
           WHEN icd11_code LIKE CONCAT(?, '%') THEN 1
           ELSE 2
         END,
         usage_count DESC,
         preferred_label ASC
       LIMIT ${limit} OFFSET ${offset}`,
      [like, like, like, q]
    );

    // Format results to match ICD-11 format
    const items = results.map(row => ({
      id: row.code,
      code: row.code,
      title: row.title,
      fullTitle: row.full_title,
      shortDefinition: row.short_definition,
      chapterCode: row.chapter_code,
      blockCode: row.block_code,
      linearization: row.linearization,
      classificationStatus: row.classification_status,
      billable: row.billable,
      usageCount: row.usage_count,
      version: 'icd11'
    }));

    return { items };
  } catch (error) {
    console.error('ICD-11 search error:', error);
    throw new Error(`ICD-11 search failed: ${error.message}`);
  }
}

// Get ICD-11 code from local database
async function getICD11CodeLocal(code) {
  if (!code) {
    throw new Error('code is required');
  }

  const db = getDb();
  
  try {
    const [results] = await db.execute(
      `SELECT 
         icd11_code as code,
         preferred_label as title,
         full_title,
         short_definition,
         chapter_code,
         block_code,
         linearization,
         classification_status,
         billable,
         usage_count,
         created_at,
         updated_at
       FROM icd11_codes 
       WHERE icd11_code = ?
       LIMIT 1`,
      [code]
    );

    if (results.length === 0) {
      const err = new Error('ICD-11 code not found');
      err.status = 404;
      throw err;
    }

    return {
      ...results[0],
      version: 'icd11'
    };
  } catch (error) {
    console.error('Get ICD-11 code error:', error);
    throw error;
  }
}

// Search both ICD-10 and ICD-11 local databases
// NOTE: ICD-11 local table (icd11_codes) not available in live DB, so only ICD-10 is searched
async function searchICDAll(q, opts = {}) {
  if (!q || typeof q !== 'string') {
    throw new Error('Query text (q) is required for ICD search');
  }

  const limit = Number.isFinite(opts.limit) ? opts.limit : 20;
  const offset = Number.isFinite(opts.offset) ? opts.offset : 0;
  
  try {
    const [icd10Results, icd11Results] = await Promise.all([
      searchICD10Local(q, { limit, offset }),
      (async () => {
        try {
          return await searchICD11Local(q, { limit, offset });
        } catch (e) {
          return { items: [] };
        }
      })()
    ]);

    const merged = [...(icd10Results.items || []), ...(icd11Results.items || [])];

    return {
      items: merged,
      total: merged.length
    };
  } catch (error) {
    console.error('ICD all search error:', error);
    throw new Error(`ICD search failed: ${error.message}`);
  }
}

module.exports = {
  searchICD11,
  getICD11Code,
  searchICD10Local,
  getICD10CodeLocal,
  searchICD11Local,
  getICD11CodeLocal,
  searchICDAll,
};
