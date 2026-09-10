const { ApiResponse, asyncHandler } = require('../utils');
const SearchService = require('../services/SearchService');

/**
 * Advanced search across multiple entities
 * Supported entities: patients, appointments, labs, prescriptions
 * Query params:
 *  - q: string search term (required for cross-entity search)
 *  - types: comma-separated list of entity types (patients,appointments,labs,prescriptions)
 *  - patientId: filter by patient_id (applies to all entity types)
 *  - doctorId: filter by doctor_id (appointments, prescriptions)
 *  - from, to: ISO date range filter (applies to date fields on each entity)
 *  - page, limit: pagination (defaults page=1, limit=10)
 */
const advancedSearch = asyncHandler(async (req, res) => {
  const {
    q = '',
    types = 'patients,appointments,labs,prescriptions',
    patientId,
    doctorId,
    from,
    to,
    page = 1,
    limit = 10,
  } = req.query;

  const result = await SearchService.advancedSearch({
    q,
    types,
    patientId,
    doctorId,
    from,
    to,
    page,
    limit,
  });

  res.json(ApiResponse.success(result, 'Search results'));
});

module.exports = { advancedSearch };

exports.advancedSearch = advancedSearch;
