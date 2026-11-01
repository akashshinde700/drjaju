const { parseLabData, findMatchingLabTest } = require('../src/services/ocrExtractor');

describe('OCR clinical data safety', () => {
  test('parses values, units and Indian number formatting', () => {
    const rows = parseLabData('Hemoglobin: 14.2 g/dL\nPlatelets: 2,50,000 /uL\nAge: 42\nPatient: 123');
    expect(rows.map(r => r.value)).toEqual([14.2, 250000]);
    expect(rows[0].unit).toBe('g/dL');
  });
  test('retains legitimate tests beginning with header words', () => {
    expect(parseLabData('Random glucose: 120 mg/dL\nTotal cholesterol: 180 mg/dL')).toHaveLength(2);
  });
  test('does not turn malformed values into valid medical readings', () => {
    expect(parseLabData('Glucose: 1.2.3 mg/dL')).toEqual([]);
  });
  test('does not match distinct tests with shared keywords', async () => {
    expect(await findMatchingLabTest({testName: 'Direct bilirubin'}, [{id: 1, test_name: 'Total bilirubin'}])).toBeNull();
    expect(await findMatchingLabTest({testName: 'Glucose fasting'}, [{id: 1, test_name: 'Glucose random'}])).toBeNull();
  });
  test('matches unique normalized exact names only', async () => {
    const template = {id: 1, test_name: 'Hemoglobin (Hb)'};
    expect(await findMatchingLabTest({testName: 'hemoglobin Hb'}, [template])).toBe(template);
    expect(await findMatchingLabTest({testName: 'hemoglobin Hb'}, [template, template])).toBeNull();
    expect(await findMatchingLabTest({}, [{test_name: null}])).toBeNull();
  });
});
