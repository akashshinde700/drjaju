import { useState } from 'react';
import { FiUser, FiSettings, FiShield, FiDatabase, FiFileText } from 'react-icons/fi';
import HeaderBar from '../components/HeaderBar';
import Tabs from '../components/Tabs';
import UserProfile from './UserProfile';
import ClinicManagement from './ClinicManagement';
import RoleManagement from './RoleManagement';
import BackupRestore from './BackupRestore';
import AuditLogs from './AuditLogs';
import { useAuth } from '../hooks/useAuth';

export default function Settings() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <FiUser /> },
    { id: 'clinics', label: 'Clinics', icon: <FiSettings /> },
    { id: 'backup', label: 'Backup', icon: <FiDatabase />, adminOnly: true },
    { id: 'audit', label: 'Audit Logs', icon: <FiFileText />, adminOnly: true }
  ].filter(tab => !tab.adminOnly || user?.role === 'admin');

  return (
    <div className="space-y-6">
      <HeaderBar title="Settings" />

      <div className="bg-white border rounded shadow-sm p-6">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

        {activeTab === 'profile' && (
          <div>
            <UserProfile />
          </div>
        )}

        {activeTab === 'clinics' && (
          <div>
            <ClinicManagement />
          </div>
        )}

        {activeTab === 'backup' && user?.role === 'admin' && (
          <div>
            <BackupRestore />
          </div>
        )}

        {activeTab === 'audit' && user?.role === 'admin' && (
          <div>
            <AuditLogs />
          </div>
        )}
      </div>
    </div>
  );
}
