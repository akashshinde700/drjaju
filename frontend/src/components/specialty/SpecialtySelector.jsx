import React, { useState } from 'react';
import { FaHeart, FaBaby, FaBone, FaEye, FaTimes } from 'react-icons/fa';
import CardiologyModule from './CardiologyModule';
import PediatricsModule from './PediatricsModule';
import OrthopedicsModule from './OrthopedicsModule';
import OphthalmologyModule from './OphthalmologyModule';

const SpecialtySelector = ({ patientData, onDataChange, onClose }) => {
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);

  const specialties = [
    {
      id: 'cardiology',
      name: 'Cardiology',
      icon: FaHeart,
      color: 'red',
      description: 'Cardiac assessments, ECG, ECHO, risk factors'
    },
    {
      id: 'pediatrics',
      name: 'Pediatrics',
      icon: FaBaby,
      color: 'pink',
      description: 'Pediatric vitals, growth charts, dose calculator'
    },
    {
      id: 'orthopedics',
      name: 'Orthopedics',
      icon: FaBone,
      color: 'orange',
      description: 'Body map, ROM, special tests, imaging'
    },
    {
      id: 'ophthalmology',
      name: 'Ophthalmology',
      icon: FaEye,
      color: 'blue',
      description: 'Visual acuity, refraction, IOP, fundus exam'
    }
  ];

  const renderSpecialtyModule = () => {
    switch (selectedSpecialty) {
      case 'cardiology':
        return <CardiologyModule onDataChange={onDataChange} />;
      case 'pediatrics':
        return (
          <PediatricsModule
            patientAge={patientData?.age}
            patientWeight={patientData?.weight}
            patientHeight={patientData?.height}
            onDataChange={onDataChange}
          />
        );
      case 'orthopedics':
        return <OrthopedicsModule onDataChange={onDataChange} />;
      case 'ophthalmology':
        return <OphthalmologyModule onDataChange={onDataChange} />;
      default:
        return null;
    }
  };

  if (!selectedSpecialty) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Select Specialty Module</h2>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <FaTimes className="text-xl" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {specialties.map((specialty) => {
            const Icon = specialty.icon;
            return (
              <button
                key={specialty.id}
                onClick={() => setSelectedSpecialty(specialty.id)}
                className={`p-6 border-2 rounded-lg hover:shadow-lg transition-all text-left group hover:border-${specialty.color}-500`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 bg-${specialty.color}-100 rounded-lg group-hover:bg-${specialty.color}-200 transition-colors`}>
                    <Icon className={`text-3xl text-${specialty.color}-600`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2 text-gray-800">
                      {specialty.name}
                    </h3>
                    <p className="text-sm text-gray-600">{specialty.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border-l-4 border-blue-500 rounded">
          <p className="text-sm text-blue-800">
            <strong>Tip:</strong> Select a specialty to access specialized assessment forms,
            calculators, and documentation templates tailored to that medical specialty.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <button
          onClick={() => setSelectedSpecialty(null)}
          className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
        >
          ← Back to Specialties
        </button>
        <h2 className="text-xl font-semibold text-gray-800">
          {specialties.find(s => s.id === selectedSpecialty)?.name} Module
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="ml-auto p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <FiX className="text-xl" />
          </button>
        )}
      </div>
      {renderSpecialtyModule()}
    </div>
  );
};

export default SpecialtySelector;
