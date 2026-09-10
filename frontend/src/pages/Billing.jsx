import { useState } from 'react';
import { FiDollarSign, FiFileText, FiLayout } from 'react-icons/fi';
import HeaderBar from '../components/HeaderBar';
import Tabs from '../components/Tabs';
import Payments from './Payments';
import Receipts from './Receipts';
import ReceiptTemplates from './ReceiptTemplates';

export default function Billing() {
  const [activeTab, setActiveTab] = useState('payments');

  const tabs = [
    { id: 'payments', label: 'Payments', icon: <FiDollarSign /> },
    { id: 'receipts', label: 'Receipts', icon: <FiFileText /> },
    { id: 'templates', label: 'Templates', icon: <FiLayout /> }
  ];

  return (
    <div className="space-y-4">
      <HeaderBar title="Billing" />

      {/* Top-level tab bar */}
      <div className="bg-white border rounded shadow-sm px-4 pb-0 overflow-hidden">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Tab content — each sub-page manages its own card layout */}
      {activeTab === 'payments'  && <Payments />}
      {activeTab === 'receipts'  && <Receipts />}
      {activeTab === 'templates' && <ReceiptTemplates />}
    </div>
  );
}
