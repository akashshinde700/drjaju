import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function UserProfile() {
  const { user, setToken, setUser } = useAuth();
  const navigate = useNavigate();
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState(() => {
    try {
      return localStorage.getItem('profilePicture');
    } catch (e) {
      return null;
    }
  });
  const [saved, setSaved] = useState(false);

  const profile = useMemo(() => {
    if (!user) return null;
    return {
      name: user.name || 'Dr. Jane Doe',
      email: user.email || '',
      role: user.role || 'doctor',
      phone: user.phone || '',
      verified: true,
      credits: user.credits || 120,
    };
  }, [user]);


  const handleLogout = () => {
    setToken('');
    setUser(null);
    navigate('/');
  };

  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setProfilePicture(file);
    const reader = new FileReader();
    reader.onloadend = () => setProfilePicturePreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSavePicture = () => {
    if (!profilePicturePreview) return;
    localStorage.setItem('profilePicture', profilePicturePreview);
    setProfilePicture(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const displayName    = profile?.name  || user?.name  || 'Dr. Jane Doe';
  const displayRole    = profile?.role  || user?.role  || 'doctor';
  const displayEmail   = user?.email    || profile?.email || '';
  const displayPhone   = user?.phone    || profile?.phone || '';
  const isVerified     = profile?.verified !== false;
  const initials       = displayName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero Banner ── */}
      <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 px-6 pt-8 pb-20 relative">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-blue-200 hover:text-white text-sm mb-4 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <h1 className="text-white text-xl font-bold">My Profile</h1>
        <p className="text-blue-200 text-sm mt-0.5">Manage your account details</p>
      </div>

      <div className="max-w-xl mx-auto px-4 -mt-14 pb-10 space-y-4">

        {/* ── Profile Card ── */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          {/* Avatar row */}
          <div className="flex flex-col items-center pt-6 pb-4 px-6 border-b border-gray-100">
            <div className="relative mb-3">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg overflow-hidden">
                {profilePicturePreview
                  ? <img src={profilePicturePreview} alt="Profile" className="w-full h-full object-cover" />
                  : initials}
              </div>
              <label
                htmlFor="profile-picture-input"
                className="absolute bottom-0 right-0 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center cursor-pointer shadow-md transition-colors"
                title="Change photo"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </label>
              <input id="profile-picture-input" type="file" accept="image/*"
                onChange={handleProfilePictureChange} className="hidden" />
            </div>

            {profilePicture && (
              <button
                onClick={handleSavePicture}
                className="mb-2 px-4 py-1.5 text-xs bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-medium"
              >
                {saved ? '✓ Saved' : 'Save Photo'}
              </button>
            )}

            <h2 className="text-lg font-bold text-gray-900">{displayName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full uppercase tracking-wide">
                {displayRole}
              </span>
              {isVerified && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-3.5 h-3.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Verified
                </span>
              )}
            </div>
          </div>

          {/* Info Grid */}
          <div className="divide-y divide-gray-50">
            {[
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                ),
                label: 'Full Name', value: displayName,
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                ),
                label: 'Email', value: displayEmail || '—',
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .18h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/>
                  </svg>
                ),
                label: 'Phone', value: displayPhone || '—',
              },
              {
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
                  </svg>
                ),
                label: 'Role', value: displayRole.charAt(0).toUpperCase() + displayRole.slice(1),
              },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-center gap-4 px-6 py-3.5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                  {icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 font-medium">{label}</p>
                  <p className="text-sm text-gray-800 font-medium truncate">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Log Out ── */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-6 py-4 text-red-600 hover:bg-red-50 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </div>
            <span className="font-medium text-sm">Log Out</span>
          </button>
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-center gap-6 text-xs text-gray-400 pt-2">
          <span className="hover:text-gray-600 transition-colors cursor-pointer">Privacy Policy</span>
          <span className="hover:text-gray-600 transition-colors cursor-pointer">Terms & Conditions</span>
        </div>

      </div>
    </div>
  );
}
