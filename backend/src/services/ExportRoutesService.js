class ExportRoutesService {
  static getFormat(req) {
    return String(req.query.format || 'excel').toLowerCase();
  }

  static normalizeAllPatientsQuery(req) {
    req.query.allPatients = 'true';
    return req;
  }
}

module.exports = ExportRoutesService;
