class ExportRoutesFormatsService {
  static getAvailableFormats() {
    return [
      {
        format: 'pdf',
        label: 'PDF (Printable)',
        description: 'Professional formatted PDF document',
        supportsSinglePatient: true,
        supportsAllPatients: false,
        fileExtension: '.pdf'
      },
      {
        format: 'excel',
        label: 'Excel (Spreadsheet)',
        description: 'Multi-sheet Excel workbook with formatted data',
        supportsSinglePatient: true,
        supportsAllPatients: true,
        fileExtension: '.xlsx'
      },
      {
        format: 'json',
        label: 'JSON (Data)',
        description: 'Structured JSON data for system integration',
        supportsSinglePatient: true,
        supportsAllPatients: true,
        fileExtension: '.json'
      }
    ];
  }
}

module.exports = ExportRoutesFormatsService;
