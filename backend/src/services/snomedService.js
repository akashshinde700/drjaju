const axios = require('axios');

const SNOMED_BASE_URL = process.env.SNOMED_SNOWSTORM_BASE_URL || 'http://localhost:8080';
const SNOMED_BRANCH = process.env.SNOMED_BRANCH || 'MAIN';
const SNOMED_API_TIMEOUT = parseInt(process.env.SNOMED_API_TIMEOUT_MS || '10000', 10);

function buildUrl(path) {
  return `${SNOMED_BASE_URL}${path}`;
}

async function searchConcepts({ term, activeFilter = true, limit = 20, offset = 0, language = 'en', semanticFilter, ecl }) {
  if (!term && !ecl) {
    throw new Error('Either term or ecl is required');
  }
  const params = {
    term,
    activeFilter,
    limit,
    offset,
    lang: language,
  };
  if (semanticFilter) params.semanticTag = semanticFilter;
  if (ecl) params.ecl = ecl;

  const url = buildUrl(`/browser/${encodeURIComponent(SNOMED_BRANCH)}/concepts`);
  const { data } = await axios.get(url, { params, timeout: SNOMED_API_TIMEOUT });
  return data;
}

async function getConcept(conceptId, { language = 'en' } = {}) {
  if (!conceptId) throw new Error('conceptId is required');
  const url = buildUrl(`/browser/${encodeURIComponent(SNOMED_BRANCH)}/concepts/${encodeURIComponent(conceptId)}`);
  const { data } = await axios.get(url, { params: { lang: language }, timeout: SNOMED_API_TIMEOUT });
  return data;
}

async function eclQuery(ecl, { limit = 50, offset = 0 } = {}) {
  if (!ecl) throw new Error('ecl is required');
  const url = buildUrl(`/${encodeURIComponent(SNOMED_BRANCH)}/concepts`);
  const { data } = await axios.get(url, { params: { ecl, limit, offset }, timeout: SNOMED_API_TIMEOUT });
  return data;
}

async function mapToICD10(conceptId) {
  if (!conceptId) throw new Error('conceptId is required');
  const referenceSet = process.env.SNOMED_ICD10_MAP_REFSET || '447562003'; // ICD-10 complex map refset (international)
  const url = buildUrl(`/${encodeURIComponent(SNOMED_BRANCH)}/members`);
  const params = { referenceSet, referencedComponentId: conceptId, limit: 100 };
  const { data } = await axios.get(url, { params, timeout: SNOMED_API_TIMEOUT });
  const items = Array.isArray(data?.items) ? data.items : [];
  return items
    .map(m => ({
      code: m.additionalFields?.mapTarget || null,
      mapGroup: m.additionalFields?.mapGroup ? Number(m.additionalFields.mapGroup) : undefined,
      mapPriority: m.additionalFields?.mapPriority ? Number(m.additionalFields.mapPriority) : undefined,
      mapRule: m.additionalFields?.mapRule || null,
      mapAdvice: m.additionalFields?.mapAdvice || null,
      correlationId: m.additionalFields?.correlationId || null,
    }))
    .filter(x => x.code);
}

async function validateConcept(conceptId) {
  const concept = await getConcept(conceptId);
  return !!(concept && concept.conceptId && concept.active);
}

module.exports = {
  searchConcepts,
  getConcept,
  eclQuery,
  mapToICD10,
  validateConcept,
};
