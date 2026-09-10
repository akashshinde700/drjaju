import React, { useState } from 'react';
// import { FiBone, FiMapPin, FiActivity } from 'react-icons/fi';
import { FaBone, FaMapMarkerAlt, FaHeartbeat } from 'react-icons/fa';

const OrthopedicsModule = ({ onDataChange }) => {
  const [orthopedicsData, setOrthopedicsData] = useState({
    chiefComplaint: '',
    painScore: 5,
    affectedSide: '',
    traumaHistory: '',
    surgicalHistory: '',
    range: {
      flexion: '',
      extension: '',
      abduction: '',
      adduction: '',
      rotation: ''
    },
    specialTests: [],
    imaging: {
      xray: '',
      mri: '',
      ct: ''
    },
    diagnosis: '',
    treatment: '',
    bodyMap: [],
    notes: ''
  });

  // Body Map - Interactive body diagram
  const bodyParts = {
    head: { x: 175, y: 30, label: 'Head' },
    neck: { x: 175, y: 60, label: 'Neck' },
    leftShoulder: { x: 120, y: 80, label: 'L Shoulder' },
    rightShoulder: { x: 230, y: 80, label: 'R Shoulder' },
    leftElbow: { x: 90, y: 130, label: 'L Elbow' },
    rightElbow: { x: 260, y: 130, label: 'R Elbow' },
    leftWrist: { x: 70, y: 180, label: 'L Wrist' },
    rightWrist: { x: 280, y: 180, label: 'R Wrist' },
    leftHand: { x: 60, y: 210, label: 'L Hand' },
    rightHand: { x: 290, y: 210, label: 'R Hand' },
    spine: { x: 175, y: 140, label: 'Spine' },
    leftHip: { x: 150, y: 200, label: 'L Hip' },
    rightHip: { x: 200, y: 200, label: 'R Hip' },
    leftKnee: { x: 150, y: 270, label: 'L Knee' },
    rightKnee: { x: 200, y: 270, label: 'R Knee' },
    leftAnkle: { x: 150, y: 340, label: 'L Ankle' },
    rightAnkle: { x: 200, y: 340, label: 'R Ankle' },
    leftFoot: { x: 150, y: 370, label: 'L Foot' },
    rightFoot: { x: 200, y: 370, label: 'R Foot' }
  };

  const commonOrthopedicTests = [
    // Shoulder
    'Neer Test', 'Hawkins-Kennedy Test', 'Empty Can Test', 'Apprehension Test',
    // Knee
    'Lachman Test', 'Anterior Drawer Test', 'McMurray Test', 'Valgus/Varus Stress Test',
    // Hip
    'FABER Test', 'Thomas Test', 'Trendelenburg Test',
    // Spine
    'Straight Leg Raise', 'Spurling Test', 'Schober Test',
    // Wrist/Hand
    'Phalen Test', 'Tinel Sign', 'Finkelstein Test'
  ];

  const handleChange = (field, value) => {
    const updated = { ...orthopedicsData, [field]: value };
    setOrthopedicsData(updated);
    onDataChange && onDataChange(updated);
  };

  const handleRangeChange = (movement, value) => {
    const updated = {
      ...orthopedicsData,
      range: { ...orthopedicsData.range, [movement]: value }
    };
    setOrthopedicsData(updated);
    onDataChange && onDataChange(updated);
  };

  const toggleBodyPart = (part) => {
    const bodyMap = orthopedicsData.bodyMap.includes(part)
      ? orthopedicsData.bodyMap.filter(p => p !== part)
      : [...orthopedicsData.bodyMap, part];
    handleChange('bodyMap', bodyMap);
  };

  const toggleSpecialTest = (test) => {
    const tests = orthopedicsData.specialTests.includes(test)
      ? orthopedicsData.specialTests.filter(t => t !== test)
      : [...orthopedicsData.specialTests, test];
    handleChange('specialTests', tests);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 space-y-6">
      <div className="flex items-center gap-2 border-b pb-4">
        <FaBone className="text-2xl text-orange-500" />
        <h2 className="text-2xl font-bold text-gray-800">Orthopedic Assessment</h2>
      </div>

      {/* Chief Complaint & Pain Score */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Chief Complaint
          </label>
          <input
            type="text"
            value={orthopedicsData.chiefComplaint}
            onChange={(e) => handleChange('chiefComplaint', e.target.value)}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="e.g., Right knee pain for 2 weeks"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Pain Score (0-10)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="10"
              value={orthopedicsData.painScore}
              onChange={(e) => handleChange('painScore', parseInt(e.target.value))}
              className="w-full"
            />
            <span className="text-2xl font-bold text-red-600 min-w-[3rem] text-center">
              {orthopedicsData.painScore}
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Body Map */}
      <div className="bg-gradient-to-b from-blue-50 to-white p-6 rounded-lg border">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FaMapMarkerAlt className="text-blue-600" />
          Orthopedic Body Map - Click to Mark Pain/Injury
        </h3>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Body Diagram */}
          <div className="flex-1">
            <svg
              viewBox="0 0 350 400"
              className="w-full max-w-md mx-auto border-2 border-gray-300 rounded-lg bg-white"
            >
              {/* Head */}
              <circle cx="175" cy="30" r="20" fill="#FED7AA" stroke="#000" strokeWidth="2" />

              {/* Neck */}
              <rect x="165" y="50" width="20" height="20" fill="#FED7AA" stroke="#000" strokeWidth="2" />

              {/* Torso */}
              <rect x="145" y="70" width="60" height="90" fill="#FED7AA" stroke="#000" strokeWidth="2" rx="10" />

              {/* Arms */}
              <line x1="145" y1="80" x2="90" y2="130" stroke="#000" strokeWidth="8" strokeLinecap="round" />
              <line x1="90" y1="130" x2="70" y2="180" stroke="#000" strokeWidth="6" strokeLinecap="round" />
              <circle cx="60" cy="210" r="12" fill="#FED7AA" stroke="#000" strokeWidth="2" />

              <line x1="205" y1="80" x2="260" y2="130" stroke="#000" strokeWidth="8" strokeLinecap="round" />
              <line x1="260" y1="130" x2="280" y2="180" stroke="#000" strokeWidth="6" strokeLinecap="round" />
              <circle cx="290" cy="210" r="12" fill="#FED7AA" stroke="#000" strokeWidth="2" />

              {/* Spine */}
              <line x1="175" y1="70" x2="175" y2="160" stroke="#DC2626" strokeWidth="3" />

              {/* Pelvis */}
              <ellipse cx="175" cy="170" rx="40" ry="20" fill="#FED7AA" stroke="#000" strokeWidth="2" />

              {/* Legs */}
              <line x1="155" y1="180" x2="150" y2="270" stroke="#000" strokeWidth="10" strokeLinecap="round" />
              <line x1="150" y1="270" x2="150" y2="340" stroke="#000" strokeWidth="8" strokeLinecap="round" />
              <rect x="140" y="340" width="20" height="30" fill="#FED7AA" stroke="#000" strokeWidth="2" rx="5" />

              <line x1="195" y1="180" x2="200" y2="270" stroke="#000" strokeWidth="10" strokeLinecap="round" />
              <line x1="200" y1="270" x2="200" y2="340" stroke="#000" strokeWidth="8" strokeLinecap="round" />
              <rect x="190" y="340" width="20" height="30" fill="#FED7AA" stroke="#000" strokeWidth="2" rx="5" />

              {/* Interactive Points */}
              {Object.entries(bodyParts).map(([key, part]) => (
                <circle
                  key={key}
                  cx={part.x}
                  cy={part.y}
                  r="8"
                  fill={orthopedicsData.bodyMap.includes(key) ? '#EF4444' : '#3B82F6'}
                  stroke="#fff"
                  strokeWidth="2"
                  className="cursor-pointer hover:r-10 transition-all"
                  onClick={() => toggleBodyPart(key)}
                  style={{ cursor: 'pointer' }}
                >
                  <title>{part.label}</title>
                </circle>
              ))}
            </svg>
          </div>

          {/* Selected Body Parts */}
          <div className="flex-1">
            <h4 className="font-semibold mb-2">Affected Areas:</h4>
            {orthopedicsData.bodyMap.length === 0 ? (
              <p className="text-gray-500 italic">Click on body parts to mark affected areas</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {orthopedicsData.bodyMap.map(part => (
                  <span
                    key={part}
                    className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm flex items-center gap-2"
                  >
                    {bodyParts[part].label}
                    <button
                      onClick={() => toggleBodyPart(part)}
                      className="hover:text-red-900"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Affected Side
              </label>
              <select
                value={orthopedicsData.affectedSide}
                onChange={(e) => handleChange('affectedSide', e.target.value)}
                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select side</option>
                <option value="Left">Left</option>
                <option value="Right">Right</option>
                <option value="Bilateral">Bilateral</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Range of Motion */}
      <div>
        <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <FaHeartbeat className="text-green-500" />
          Range of Motion (degrees)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Flexion</label>
            <input
              type="number"
              value={orthopedicsData.range.flexion}
              onChange={(e) => handleRangeChange('flexion', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="0-180°"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Extension</label>
            <input
              type="number"
              value={orthopedicsData.range.extension}
              onChange={(e) => handleRangeChange('extension', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="0-180°"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Abduction</label>
            <input
              type="number"
              value={orthopedicsData.range.abduction}
              onChange={(e) => handleRangeChange('abduction', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="0-180°"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Adduction</label>
            <input
              type="number"
              value={orthopedicsData.range.adduction}
              onChange={(e) => handleRangeChange('adduction', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="0-90°"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Rotation</label>
            <input
              type="number"
              value={orthopedicsData.range.rotation}
              onChange={(e) => handleRangeChange('rotation', e.target.value)}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="0-90°"
            />
          </div>
        </div>
      </div>

      {/* Special Tests */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Special Orthopedic Tests</h3>
        <div className="flex flex-wrap gap-2">
          {commonOrthopedicTests.map(test => (
            <button
              key={test}
              onClick={() => toggleSpecialTest(test)}
              className={`px-3 py-2 rounded-md transition-colors text-sm ${
                orthopedicsData.specialTests.includes(test)
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {test}
            </button>
          ))}
        </div>
        {orthopedicsData.specialTests.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded-md">
            <p className="font-semibold text-sm text-blue-800">Selected Tests:</p>
            <p className="text-sm text-blue-700">{orthopedicsData.specialTests.join(', ')}</p>
          </div>
        )}
      </div>

      {/* History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Trauma History
          </label>
          <textarea
            value={orthopedicsData.traumaHistory}
            onChange={(e) => handleChange('traumaHistory', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Mechanism of injury, when, how..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Surgical History
          </label>
          <textarea
            value={orthopedicsData.surgicalHistory}
            onChange={(e) => handleChange('surgicalHistory', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Previous orthopedic surgeries..."
          />
        </div>
      </div>

      {/* Imaging */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Imaging Studies</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">X-Ray Findings</label>
            <textarea
              value={orthopedicsData.imaging.xray}
              onChange={(e) => handleChange('imaging', {
                ...orthopedicsData.imaging,
                xray: e.target.value
              })}
              rows={3}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Fracture, alignment, joint space..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">MRI Findings</label>
            <textarea
              value={orthopedicsData.imaging.mri}
              onChange={(e) => handleChange('imaging', {
                ...orthopedicsData.imaging,
                mri: e.target.value
              })}
              rows={3}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Soft tissue, ligaments, tendons..."
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">CT Scan Findings</label>
            <textarea
              value={orthopedicsData.imaging.ct}
              onChange={(e) => handleChange('imaging', {
                ...orthopedicsData.imaging,
                ct: e.target.value
              })}
              rows={3}
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Detailed bone assessment..."
            />
          </div>
        </div>
      </div>

      {/* Diagnosis & Treatment */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Diagnosis
          </label>
          <textarea
            value={orthopedicsData.diagnosis}
            onChange={(e) => handleChange('diagnosis', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Primary and differential diagnoses..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Treatment Plan
          </label>
          <textarea
            value={orthopedicsData.treatment}
            onChange={(e) => handleChange('treatment', e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
            placeholder="Conservative vs surgical, medications, physiotherapy..."
          />
        </div>
      </div>

      {/* Clinical Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Additional Clinical Notes
        </label>
        <textarea
          value={orthopedicsData.notes}
          onChange={(e) => handleChange('notes', e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500"
          placeholder="Additional observations, follow-up plan, restrictions..."
        />
      </div>
    </div>
  );
};

export default OrthopedicsModule;
