class ComplianceService {
  static async logCompliance(payload) {
    return { logged: true, payload: payload || {} };
  }

  static async getComplianceReport(patientId) {
    return {
      patientId,
      overallCompliance: 85,
      medications: [
        {
          name: 'Sample Medication',
          prescribedFrequency: 'Twice daily',
          takenDoses: 15,
          totalDoses: 20,
          compliance: 75,
        },
      ],
      period: 'Last 30 days',
      generatedAt: new Date().toISOString(),
    };
  }
}

module.exports = ComplianceService;
