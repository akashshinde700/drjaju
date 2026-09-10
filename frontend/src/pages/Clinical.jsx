import { useState } from 'react';
import { FiClipboard, FiLayers, FiFileText, FiSettings, FiFile } from 'react-icons/fi';
import HeaderBar from '../components/HeaderBar';
import Tabs from '../components/Tabs';
import PrescriptionPad from './PrescriptionPad';
import LabTemplates from './LabTemplates';
import MedicalCertificates from './MedicalCertificates';
import PadConfiguration from './PadConfiguration';
import RxTemplateConfig from './RxTemplateConfig';

export default function Clinical() {
  const [activeTab, setActiveTab] = useState('prescriptions');

  const tabs = [
    { id: 'prescriptions', label: 'Prescriptions', icon: <FiClipboard /> },
    { id: 'lab-templates', label: 'Lab Templates', icon: <FiLayers /> },
    { id: 'certificates', label: 'Medical Certificates', icon: <FiFileText /> },
    { id: 'pad-config', label: 'Pad Config', icon: <FiSettings /> },
    { id: 'rx-template', label: 'Rx Template', icon: <FiFile /> }
  ];

  return (
    <div className="space-y-6">
      <HeaderBar title="Clinical Tools" />

      <div className="bg-white border rounded shadow-sm p-6">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'prescriptions' && (
          <div>
            <PrescriptionPad />
          </div>
        )}

        {activeTab === 'lab-templates' && (
          <div>
            <LabTemplates />
          </div>
        )}

        {activeTab === 'certificates' && (
          <div>
            <MedicalCertificates />
          </div>
        )}

        {activeTab === 'pad-config' && (
          <div>
            <PadConfiguration />
          </div>
        )}

        {activeTab === 'rx-template' && (
          <div>
            <RxTemplateConfig />
          </div>
        )}
      </div>
    </div>
  );
}
