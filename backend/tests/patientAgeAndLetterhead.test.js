let mockDb;

jest.mock('../src/config/db', () => ({
  getDb: jest.fn(() => mockDb),
}));

jest.mock('../src/utils/uhidHelper', () => ({
  generateUHID: jest.fn().mockResolvedValue('UHID-TEST'),
}));

const PatientService = require('../src/services/PatientService');
const { savePadConfiguration } = require('../src/controllers/padConfigurationController');
const { resolvePrescriptionLetterhead } = require('../src/services/PdfGeneratorService');

const mockRows = (rows) => [rows, []];

describe('PatientService age persistence', () => {
  beforeEach(() => {
    mockDb = { execute: jest.fn() };
  });

  test('persists an explicitly entered age when DOB is absent', async () => {
    mockDb.execute
      .mockResolvedValueOnce(mockRows([{ id: 1 }]))
      .mockResolvedValueOnce([{ insertId: 42 }, []])
      .mockResolvedValueOnce(mockRows([{ id: 42, age_years: 37 }]));

    const patient = await PatientService.create({
      name: 'Test Patient',
      clinic_id: 1,
      age_years: 37,
    });

    expect(patient.age_years).toBe(37);
    expect(mockDb.execute.mock.calls[1][1][5]).toBe(37);
  });

  test('keeps age zero as a valid value', async () => {
    mockDb.execute
      .mockResolvedValueOnce(mockRows([{ id: 1 }]))
      .mockResolvedValueOnce([{ insertId: 43 }, []])
      .mockResolvedValueOnce(mockRows([{ id: 43, age_years: 0 }]));

    await PatientService.create({ name: 'Newborn', clinic_id: 1, age_years: 0 });

    expect(mockDb.execute.mock.calls[1][1][5]).toBe(0);
  });

  test('uses DOB-derived age when DOB and an explicit age are both provided', async () => {
    mockDb.execute
      .mockResolvedValueOnce(mockRows([{ id: 1 }]))
      .mockResolvedValueOnce([{ insertId: 44 }, []])
      .mockResolvedValueOnce(mockRows([{ id: 44 }]));

    await PatientService.create({
      name: 'DOB Patient',
      clinic_id: 1,
      dob: '1980-01-01',
      age_years: 5,
    });

    expect(mockDb.execute.mock.calls[1][1][5]).toBe(PatientService._calculateAge('1980-01-01'));
  });

  test('rejects non-integer and out-of-range ages', async () => {
    await expect(PatientService.create({ name: 'Invalid', clinic_id: 1, age_years: 151 }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(mockDb.execute).not.toHaveBeenCalled();
  });
});

describe('prescription letterhead resolution', () => {
  beforeEach(() => {
    mockDb = { execute: jest.fn() };
  });

  test('prefers the selected template and returns header/footer text and images', async () => {
    mockDb.execute.mockResolvedValueOnce(mockRows([{
      id: 7,
      template_name: 'Selected template',
      header_image: 'data:image/jpeg;base64,header',
      header_content: '<div>Clinic header</div>',
      footer_image: 'footer-image-base64',
      footer_content: '<div>Clinic footer</div>',
    }]));

    const letterhead = await resolvePrescriptionLetterhead(
      mockDb,
      { template_id: 7, doctor_user_id: 12, clinic_id: 3 },
    );

    expect(letterhead).toMatchObject({
      source: 'template',
      template_id: 7,
      template_name: 'Selected template',
      header_image: 'data:image/jpeg;base64,header',
      header_content: '<div>Clinic header</div>',
      footer_image: 'data:image/png;base64,footer-image-base64',
      footer_content: '<div>Clinic footer</div>',
    });
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
  });

  test('falls back to the doctor pad configuration when the selected template has no letterhead', async () => {
    mockDb.execute
      .mockResolvedValueOnce(mockRows([]))
      .mockResolvedValueOnce(mockRows([{
        header_image: 'pad-header-base64',
        header_content: 'Doctor header',
        footer_image: null,
        footer_content: 'Doctor footer',
      }]));

    const letterhead = await resolvePrescriptionLetterhead(
      mockDb,
      { template_id: 7, doctor_user_id: 12, clinic_id: 3 },
    );

    expect(letterhead).toMatchObject({
      source: 'pad',
      header_image: 'data:image/png;base64,pad-header-base64',
      header_content: 'Doctor header',
      footer_content: 'Doctor footer',
    });
    expect(mockDb.execute).toHaveBeenCalledTimes(2);
  });

  test('falls back to the clinic default template when no selected or pad letterhead exists', async () => {
    mockDb.execute
      .mockResolvedValueOnce(mockRows([]))
      .mockResolvedValueOnce(mockRows([]))
      .mockResolvedValueOnce(mockRows([{
        id: 9,
        template_name: 'Clinic default',
        header_image: null,
        header_content: 'Default header',
        footer_image: null,
        footer_content: 'Default footer',
      }]));

    const letterhead = await resolvePrescriptionLetterhead(
      mockDb,
      { template_id: 7, doctor_user_id: 12, clinic_id: 3 },
    );

    expect(letterhead).toMatchObject({
      source: 'default_template',
      template_id: 9,
      header_content: 'Default header',
      footer_content: 'Default footer',
    });
  });
});

describe('pad configuration persistence', () => {
  beforeEach(() => {
    mockDb = { execute: jest.fn() };
  });

  test('saving a header image updates only the submitted pad field', async () => {
    mockDb.execute
      .mockResolvedValueOnce(mockRows([{ id: 5 }]))
      .mockResolvedValueOnce([{ affectedRows: 1 }, []]);
    const req = {
      user: { id: 12 },
      body: { header_image: 'data:image/png;base64,header-image' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await savePadConfiguration(req, res);

    expect(mockDb.execute).toHaveBeenCalledTimes(2);
    expect(mockDb.execute.mock.calls[1][0]).toContain(
      'UPDATE pad_configurations SET header_image = ?, updated_at = NOW() WHERE doctor_id = ?',
    );
    expect(mockDb.execute.mock.calls[1][1]).toEqual([
      'data:image/png;base64,header-image',
      12,
    ]);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
