import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import { useTranslation } from '../context/LanguageContext';
import { FiUser, FiStar, FiClock, FiFileText, FiCalendar, FiDollarSign, FiInfo, FiSettings, FiCloud, FiLogOut, FiCopy, FiShare2, FiCheck, FiBell } from 'react-icons/fi';
import { useNotifications } from '../hooks/useNotifications';
import GlobalSearch from './GlobalSearch';
/* eslint-disable react-hooks/preserve-manual-memoization */


export default function HeaderBar({ title = '', clinic: clinicProp, _onAddPatient, _onSwitchView }) {
  const navigate = useNavigate();
  const _location = useLocation();
  const { user } = useAuth();
  const api = useApiClient();
  const { addToast } = useToast();
  const { t } = useTranslation();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const [inviteCode] = useState('ABCD1234'); // removed unused setter
  const [inviteLink] = useState('https://drjaju.com/invite/ABCD1234'); // removed unused setter
  // storageSize value unused; only setter invoked
  const [_storageSize, setStorageSize] = useState(0); // in MB
  // copied flag not read elsewhere
  const [_copied, setCopied] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const notificationDropdownRef = useRef(null);
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [currentClinic, setCurrentClinic] = useState(clinicProp || 'Loading...');
  const [clinics, setClinics] = useState([]);
  const [showClinicSwitcher, setShowClinicSwitcher] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (notificationDropdownRef.current && !notificationDropdownRef.current.contains(event.target)) {
        setShowNotificationDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const fetchStorageSize = useCallback(async () => {
    try {
      const _res = await api.get('/api/patients?limit=1');
      // Mock calculation - in real app, calculate from actual data
      setStorageSize(125.5); // MB
    } catch (_err) {
      console.error('Failed to fetch storage size:', _err);
      setStorageSize(0);
    }
  }, [api]);

  useEffect(() => {
    if (showDropdown) {
      // Avoid calling setState synchronously inside effect body
      // by deferring the call so lint rule react-hooks/set-state-in-effect
      // is satisfied while preserving behavior.
      const t = setTimeout(() => fetchStorageSize(), 0);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [showDropdown, fetchStorageSize]);

  const fetchClinics = useCallback(async () => {
    try {
      const res = await api.get('/api/clinics');
      const clinicsList = res.data?.data?.clinics || res.data?.clinics || [];
      setClinics(clinicsList);

      const currentClinicId = user?.clinic_id;

      if (currentClinicId) {
        const clinic = clinicsList.find(c => c.id === currentClinicId);
        if (clinic) {
          setCurrentClinic(clinic.name);
        }
      } else if (clinicsList.length > 0) {
        setCurrentClinic(clinicsList[0].name);
      }
    } catch (_err) {
      console.error('Failed to fetch clinics:', _err);
    }
  }, [api, user?.clinic_id]);

  useEffect(() => {
    const t = setTimeout(() => fetchClinics(), 0);
    return () => clearTimeout(t);
  }, [fetchClinics]);

  const handleCopyInviteCode = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      addToast('Invite code copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('Failed to copy invite link', 'error');
    }
  };

  const _handleCopyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      addToast('Invite link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('Failed to copy invite link', 'error');
    }
  };

  const _handleShare = async () => {
    const shareData = {
      title: 'Join Us',
      text: `Use my invite code: ${inviteCode}`,
      url: inviteLink
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        addToast('Shared successfully!', 'success');
      } catch (err) {
        if (err.name !== 'AbortError') {
          handleCopyInviteCode();
        }
      }
    } else {
      handleCopyInviteCode();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/';
  };

  const displayName = user?.name || 'Dr. Jane Doe';
  const _ekaCredits = user?.eka_credits || 120;
  const isVerified = true;
  const userRole = user?.role || 'staff';
  const profileImage = user?.profile_image || user?.profilePic || null;

  return (
    <header className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-40">
      <div className="px-4 sm:px-6 lg:px-8 py-3">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-slate-500">{currentClinic}</p>
            {clinics.length > 1 && (
              <button
                onClick={() => setShowClinicSwitcher(!showClinicSwitcher)}
                className="text-xs text-blue-600 hover:text-blue-800"
                title={t('switch')}
              >
                {t('switch')}
              </button>
            )}
          </div>
          <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          {/* Notification Bell */}
          <div className="relative" ref={notificationDropdownRef}>
            <button
              onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
              className="relative px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition text-slate-600"
              title="Notifications"
            >
              <FiBell className="w-5 h-5 text-slate-700" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
            {showNotificationDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border z-50 max-h-96 overflow-y-auto">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{t('notifications')}</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {t('mark_all_as_read')}
                    </button>
                  )}
                </div>
                <div className="py-2">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      No notifications
                    </div>
                  ) : (
                    notifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          if (!notif.is_read) markAsRead(notif.id);
                          setShowNotificationDropdown(false);
                          if (notif.type === 'appointment') {
                            navigate('/queue');
                          }
                        }}
                        className={`px-4 py-3 border-b hover:bg-blue-50 cursor-pointer transition ${
                          !notif.is_read ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`flex-shrink-0 w-2 h-2 rounded-full mt-2 ${
                            !notif.is_read ? 'bg-blue-500' : 'bg-gray-300'
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{notif.title || 'Notification'}</p>
                            <p className="text-xs text-gray-600 mt-1">{notif.message || ''}</p>
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(notif.created_at).toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <div className="px-4 py-2 border-t text-center">
                    <button
                      onClick={() => {
                        navigate('/whats-new');
                        setShowNotificationDropdown(false);
                      }}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      {t('view_all')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-100/50 hover:bg-blue-200 rounded transition w-full sm:w-auto text-gray-700"
            >
              <div className="w-8 h-8 rounded-full bg-slate-200 flex-shrink-0 relative overflow-hidden">
                {profileImage ? (
                  <img 
                    src={profileImage} 
                    alt={displayName}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div 
                  className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold"
                  style={{ display: profileImage ? 'none' : 'flex' }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                  userRole === 'doctor' ? 'bg-green-500' : 
                  userRole === 'admin' ? 'bg-purple-500' : 
                  'bg-blue-500'
                }`}>
                  <FiCheck className="w-2 h-2 text-white" />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{displayName}</p>
                <p className="text-xs text-slate-500">
                  {isVerified ? 'Verified' : 'Pending'}
                </p>
              </div>
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg border z-50">
                {/* Profile Header - Large Profile Picture */}
                <div className="px-4 py-4 border-b bg-gradient-to-br from-blue-50 to-slate-50">
                  <div className="flex flex-col items-center gap-3 mb-3">
                    <div className="relative">
                      {profileImage ? (
                        <img 
                          src={profileImage} 
                          alt={displayName}
                          className="w-20 h-20 rounded-full object-cover shadow-lg border-2 border-white"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg"
                        style={{ display: profileImage ? 'none' : 'flex' }}
                      >
                        {displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 text-white text-[10px] font-bold px-2 py-0.5 rounded-full border-2 border-white ${
                        userRole === 'doctor' ? 'bg-green-600' : 
                        userRole === 'admin' ? 'bg-purple-600' : 
                        'bg-blue-600'
                      }`}>
                        {userRole === 'doctor' ? 'DR' : 
                         userRole === 'admin' ? 'ADMIN' : 
                         'STAFF'}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <p className="font-semibold text-lg">{displayName}</p>
                        {isVerified && (
                          <span className="text-green-600 text-lg" title="Verified">✓</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                </div>

                {/* Menu Items */}
                <div className="py-1 max-h-[400px] overflow-y-auto">
                  <a 
                    href="/profile" 
                    onClick={(e) => { e.preventDefault(); navigate('/profile'); setShowDropdown(false); }}
                    className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-50 transition"
                  >
                    <FiUser className="w-4 h-4 text-slate-600" />
                    <span>My Profile</span>
                  </a>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                  >
                    <FiLogOut className="w-4 h-4" />
                    <span>Log Out</span>
                  </button>
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t bg-slate-50 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <a href="/privacy" className="hover:underline">Privacy Policy</a>
                    <a href="/terms" className="hover:underline">Terms & Conditions</a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
      {/* Search bar removed */}

      {/* Clinic Switcher */}
      {showClinicSwitcher && clinics.length > 1 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">{t('switch_clinic') || 'Switch Clinic'}</h2>
            </div>
            <div className="p-6 space-y-2 max-h-96 overflow-y-auto">
              {clinics.map((clinic) => (
                <button
                  key={clinic.id}
                  onClick={async () => {
                    try {
                      await api.post('/api/clinics/switch', { clinic_id: clinic.id });
                      setCurrentClinic(clinic.name);
                      setShowClinicSwitcher(false);
                      addToast('Clinic switched successfully', 'success');
                      window.location.reload();
                    } catch (err) {
                      addToast(err.response?.data?.error || 'Failed to switch clinic', 'error');
                    }
                  }}
                  className={`w-full text-left p-4 border rounded-lg hover:bg-blue-100 transition ${
                    user?.clinic_id === clinic.id ? 'border-blue-500 bg-blue-50' : ''
                  }`}
                >
                  <div className="font-semibold">{clinic.name}</div>
                  <div className="text-sm text-gray-600">
                    {[clinic.city, clinic.state].filter(Boolean).join(', ')}
                  </div>
                  {user?.clinic_id === clinic.id && (
                    <div className="text-xs text-blue-600 mt-1">Current</div>
                  )}
                </button>
              ))}
            </div>
            <div className="p-6 border-t">
              <button
                onClick={() => setShowClinicSwitcher(false)}
                className="w-full px-4 py-2 border border-blue-200 rounded-lg hover:bg-blue-100 transition"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    <GlobalSearch open={showGlobalSearch} onClose={() => setShowGlobalSearch(false)} />
    </header>
  );
}