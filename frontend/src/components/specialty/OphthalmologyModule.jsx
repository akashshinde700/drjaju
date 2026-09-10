import React, { useState } from 'react';
import { FiEye, FiActivity, FiAlertCircle } from 'react-icons/fi';

const OphthalmologyModule = ({ onDataChange }) => {
  const [ophthalmologyData, setOphthalmologyData] = useState({
    chiefComplaint: '',
    visualAcuity: {
      rightEye: { uncorrected: '', corrected: '', pinhole: '' },
      leftEye: { uncorrected: '', corrected: '', pinhole: '' }
    },
    refraction: {
      rightEye: { sphere: '', cylinder: '', axis: '', add: '' },
      leftEye: { sphere: '', cylinder: '', axis: '', add: '' }
    },
    intraocularPressure: {
      rightEye: '',
      leftEye: ''
    },
    pupils: {
      rightEye: { size: '', reaction: '' },
      leftEye: { size: '', reaction: '' }
    },
    anteriorSegment: {
      rightEye: { lids: '', conjunctiva: '', cornea: '', anteriorChamber: '', iris: '', lens: '' },
      leftEye: { lids: '', conjunctiva: '', cornea: '', anteriorChamber: '', iris: '', lens: '' }
    },
    posteriorSegment: {
      rightEye: { vitreous: '', opticDisc: '', macula: '', vessels: '', periphery: '' },
      leftEye: { vitreous: '', opticDisc: '', macula: '', vessels: '', periphery: '' }
    },
    extraocularMovements: {
      rightEye: '',
      leftEye: ''
    },
    colorVision: '',
    contrastSensitivity: '',
    diagnosis: '',
    treatment: '',
    notes: ''
  });

  const handleChange = (section, subsection, field, value) => {
    let updated;
    if (subsection) {
      updated = {
        ...ophthalmologyData,
        [section]: {
          ...ophthalmologyData[section],
          [subsection]: {
            ...ophthalmologyData[section][subsection],
            [field]: value
          }
        }
      };
    } else if (field) {
      updated = {
        ...ophthalmologyData,
        [section]: {
          ...ophthalmologyData[section],
          [field]: value
        }
      };
    } else {
      updated = {
        ...ophthalmologyData,
        [section]: subsection
      };
    }
    setOphthalmologyData(updated);
    onDataChange && onDataChange(updated);
  };

  const pupilReactions = ['PERRL', 'Sluggish', 'Fixed', 'APD Present'];
  const commonDiagnoses = [
    'Myopia', 'Hyperopia', 'Astigmatism', 'Presbyopia',
    'Cataract', 'Glaucoma', 'Diabetic Retinopathy', 'AMD',
    'Conjunctivitis', 'Dry Eye', 'Corneal Ulcer', 'Uveitis'
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div className="flex items-center gap-2 border-b pb-4">
        <FiEye className="text-2xl text-blue-500" />
        <h2 className="text-2xl font-bold text-gray-800">Ophthalmology Assessment</h2>
      </div>

      {/* Chief Complaint */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Chief Complaint
        </label>
        <input
          type="text"
          value={ophthalmologyData.chiefComplaint}
          onChange={(e) => handleChange('chiefComplaint', e.target.value)}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="e.g., Blurred vision, redness, pain..."
        />
      </div>

      {/* Visual Acuity */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FiActivity className="text-green-500" />
          Visual Acuity
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Right Eye */}
          <div className="border rounded-lg p-4 bg-red-50">
            <h4 className="font-semibold mb-3 text-red-800">Right Eye (OD)</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Uncorrected (UCVA)</label>
                <input
                  type="text"
                  value={ophthalmologyData.visualAcuity.rightEye.uncorrected}
                  onChange={(e) => handleChange('visualAcuity', 'rightEye', 'uncorrected', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="6/6, 6/9, 6/12..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Corrected (BCVA)</label>
                <input
                  type="text"
                  value={ophthalmologyData.visualAcuity.rightEye.corrected}
                  onChange={(e) => handleChange('visualAcuity', 'rightEye', 'corrected', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="6/6, 6/9, 6/12..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Pinhole</label>
                <input
                  type="text"
                  value={ophthalmologyData.visualAcuity.rightEye.pinhole}
                  onChange={(e) => handleChange('visualAcuity', 'rightEye', 'pinhole', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="6/6, 6/9, 6/12..."
                />
              </div>
            </div>
          </div>

          {/* Left Eye */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h4 className="font-semibold mb-3 text-blue-800">Left Eye (OS)</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Uncorrected (UCVA)</label>
                <input
                  type="text"
                  value={ophthalmologyData.visualAcuity.leftEye.uncorrected}
                  onChange={(e) => handleChange('visualAcuity', 'leftEye', 'uncorrected', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="6/6, 6/9, 6/12..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Corrected (BCVA)</label>
                <input
                  type="text"
                  value={ophthalmologyData.visualAcuity.leftEye.corrected}
                  onChange={(e) => handleChange('visualAcuity', 'leftEye', 'corrected', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="6/6, 6/9, 6/12..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Pinhole</label>
                <input
                  type="text"
                  value={ophthalmologyData.visualAcuity.leftEye.pinhole}
                  onChange={(e) => handleChange('visualAcuity', 'leftEye', 'pinhole', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="6/6, 6/9, 6/12..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Refraction */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Refraction</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Right Eye */}
          <div className="border rounded-lg p-4 bg-red-50">
            <h4 className="font-semibold mb-3 text-red-800">Right Eye (OD)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Sphere (SPH)</label>
                <input
                  type="text"
                  value={ophthalmologyData.refraction.rightEye.sphere}
                  onChange={(e) => handleChange('refraction', 'rightEye', 'sphere', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="+2.00, -1.50..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Cylinder (CYL)</label>
                <input
                  type="text"
                  value={ophthalmologyData.refraction.rightEye.cylinder}
                  onChange={(e) => handleChange('refraction', 'rightEye', 'cylinder', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="-0.75, -1.00..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Axis</label>
                <input
                  type="text"
                  value={ophthalmologyData.refraction.rightEye.axis}
                  onChange={(e) => handleChange('refraction', 'rightEye', 'axis', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="90, 180..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Add (Near)</label>
                <input
                  type="text"
                  value={ophthalmologyData.refraction.rightEye.add}
                  onChange={(e) => handleChange('refraction', 'rightEye', 'add', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="+2.00..."
                />
              </div>
            </div>
          </div>

          {/* Left Eye */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h4 className="font-semibold mb-3 text-blue-800">Left Eye (OS)</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Sphere (SPH)</label>
                <input
                  type="text"
                  value={ophthalmologyData.refraction.leftEye.sphere}
                  onChange={(e) => handleChange('refraction', 'leftEye', 'sphere', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="+2.00, -1.50..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Cylinder (CYL)</label>
                <input
                  type="text"
                  value={ophthalmologyData.refraction.leftEye.cylinder}
                  onChange={(e) => handleChange('refraction', 'leftEye', 'cylinder', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="-0.75, -1.00..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Axis</label>
                <input
                  type="text"
                  value={ophthalmologyData.refraction.leftEye.axis}
                  onChange={(e) => handleChange('refraction', 'leftEye', 'axis', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="90, 180..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Add (Near)</label>
                <input
                  type="text"
                  value={ophthalmologyData.refraction.leftEye.add}
                  onChange={(e) => handleChange('refraction', 'leftEye', 'add', e.target.value)}
                  className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="+2.00..."
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* IOP & Pupils */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Intraocular Pressure */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Intraocular Pressure (IOP) mmHg</h3>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm text-gray-700 mb-1">Right Eye (OD)</label>
              <input
                type="number"
                value={ophthalmologyData.intraocularPressure.rightEye}
                onChange={(e) => handleChange('intraocularPressure', 'rightEye', null, e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="10-21 normal"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-700 mb-1">Left Eye (OS)</label>
              <input
                type="number"
                value={ophthalmologyData.intraocularPressure.leftEye}
                onChange={(e) => handleChange('intraocularPressure', 'leftEye', null, e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="10-21 normal"
              />
            </div>
          </div>
        </div>

        {/* Pupils */}
        <div>
          <h3 className="text-lg font-semibold mb-3">Pupils</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-700 mb-1">OD Size (mm)</label>
              <input
                type="number"
                step="0.5"
                value={ophthalmologyData.pupils.rightEye.size}
                onChange={(e) => handleChange('pupils', 'rightEye', 'size', e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="2-8mm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">OS Size (mm)</label>
              <input
                type="number"
                step="0.5"
                value={ophthalmologyData.pupils.leftEye.size}
                onChange={(e) => handleChange('pupils', 'leftEye', 'size', e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
                placeholder="2-8mm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">OD Reaction</label>
              <select
                value={ophthalmologyData.pupils.rightEye.reaction}
                onChange={(e) => handleChange('pupils', 'rightEye', 'reaction', e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select</option>
                {pupilReactions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-700 mb-1">OS Reaction</label>
              <select
                value={ophthalmologyData.pupils.leftEye.reaction}
                onChange={(e) => handleChange('pupils', 'leftEye', 'reaction', e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select</option>
                {pupilReactions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Anterior Segment Examination */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Anterior Segment Examination</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Right Eye */}
          <div className="border rounded-lg p-4 bg-red-50">
            <h4 className="font-semibold mb-3 text-red-800">Right Eye (OD)</h4>
            <div className="space-y-2">
              {Object.keys(ophthalmologyData.anteriorSegment.rightEye).map(field => (
                <div key={field}>
                  <label className="block text-xs text-gray-700 mb-1 capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type="text"
                    value={ophthalmologyData.anteriorSegment.rightEye[field]}
                    onChange={(e) => handleChange('anteriorSegment', 'rightEye', field, e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Normal, findings..."
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Left Eye */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h4 className="font-semibold mb-3 text-blue-800">Left Eye (OS)</h4>
            <div className="space-y-2">
              {Object.keys(ophthalmologyData.anteriorSegment.leftEye).map(field => (
                <div key={field}>
                  <label className="block text-xs text-gray-700 mb-1 capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type="text"
                    value={ophthalmologyData.anteriorSegment.leftEye[field]}
                    onChange={(e) => handleChange('anteriorSegment', 'leftEye', field, e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Normal, findings..."
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Posterior Segment Examination (Fundus) */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Posterior Segment Examination (Fundus)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Right Eye */}
          <div className="border rounded-lg p-4 bg-red-50">
            <h4 className="font-semibold mb-3 text-red-800">Right Eye (OD)</h4>
            <div className="space-y-2">
              {Object.keys(ophthalmologyData.posteriorSegment.rightEye).map(field => (
                <div key={field}>
                  <label className="block text-xs text-gray-700 mb-1 capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type="text"
                    value={ophthalmologyData.posteriorSegment.rightEye[field]}
                    onChange={(e) => handleChange('posteriorSegment', 'rightEye', field, e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Normal, findings..."
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Left Eye */}
          <div className="border rounded-lg p-4 bg-blue-50">
            <h4 className="font-semibold mb-3 text-blue-800">Left Eye (OS)</h4>
            <div className="space-y-2">
              {Object.keys(ophthalmologyData.posteriorSegment.leftEye).map(field => (
                <div key={field}>
                  <label className="block text-xs text-gray-700 mb-1 capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}
                  </label>
                  <input
                    type="text"
                    value={ophthalmologyData.posteriorSegment.leftEye[field]}
                    onChange={(e) => handleChange('posteriorSegment', 'leftEye', field, e.target.value)}
                    className="w-full px-2 py-1 text-sm border rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Normal, findings..."
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Tests */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Extraocular Movements (OD)
          </label>
          <input
            type="text"
            value={ophthalmologyData.extraocularMovements.rightEye}
            onChange={(e) => handleChange('extraocularMovements', 'rightEye', null, e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Full in all gazes"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Extraocular Movements (OS)
          </label>
          <input
            type="text"
            value={ophthalmologyData.extraocularMovements.leftEye}
            onChange={(e) => handleChange('extraocularMovements', 'leftEye', null, e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Full in all gazes"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Color Vision
          </label>
          <input
            type="text"
            value={ophthalmologyData.colorVision}
            onChange={(e) => handleChange('colorVision', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Ishihara, normal..."
          />
        </div>
      </div>

      {/* Diagnosis & Treatment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Diagnosis
          </label>
          <textarea
            value={ophthalmologyData.diagnosis}
            onChange={(e) => handleChange('diagnosis', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Primary and differential diagnoses..."
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {commonDiagnoses.map(dx => (
              <button
                key={dx}
                onClick={() => handleChange('diagnosis', ophthalmologyData.diagnosis
                  ? `${ophthalmologyData.diagnosis}, ${dx}`
                  : dx
                )}
                className="px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
              >
                + {dx}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Treatment Plan
          </label>
          <textarea
            value={ophthalmologyData.treatment}
            onChange={(e) => handleChange('treatment', e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Medications, surgery, follow-up..."
          />
        </div>
      </div>

      {/* Clinical Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Additional Clinical Notes
        </label>
        <textarea
          value={ophthalmologyData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Additional observations, follow-up plan..."
        />
      </div>
    </div>
  );
};

export default OphthalmologyModule;
