import { useState, useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import { useApiClient } from '../api/client';

export default function RxTemplateConfig() {
  const { addToast } = useToast();
  const api = useApiClient();
  const [activeTab, setActiveTab] = useState('print');
  const [selectedClinic, setSelectedClinic] = useState('Metropolis Vidhyavihar');
  const [autoFitHeight, setAutoFitHeight] = useState(false);
  const [spaceSaverLayout, setSpaceSaverLayout] = useState(false);
  const [letterheadFile, setLetterheadFile] = useState(null);
  const [headerFile, setHeaderFile] = useState(null);
  const [footerFile, setFooterFile] = useState(null);
  const [loading, setLoading] = useState(false);

  // Margin & content area config
  const [margins, setMargins] = useState(() => {
    try {
      const saved = localStorage.getItem('rxTemplateMargins');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return { top: 10, bottom: 10, left: 10, right: 10, contentTop: 0, contentBottom: 0 };
  });

  const updateMargin = (key, value) => {
    // Content padding needs a larger ceiling than page margins: a pre-printed
    // letterhead band is routinely 35-45mm.
    const max = key === 'contentTop' || key === 'contentBottom' ? 200 : 80;
    const num = Math.max(0, Math.min(max, parseInt(value) || 0));
    setMargins(prev => ({ ...prev, [key]: num }));
  };

  // These values drive the SERVER-rendered PDF, so the server is the source of
  // truth — localStorage alone could never change what actually prints.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/pad-config/print-layout');
        const layout = res.data?.layout;
        if (!cancelled && layout && typeof layout === 'object') {
          setMargins(prev => ({ ...prev, ...layout }));
        }
      } catch {
        /* keep whatever is on screen; save will surface any real problem */
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  const sections = [
    { name: 'Diagnosis', icon: '🔬', color: 'text-purple-600', bgColor: 'bg-purple-50' },
    { name: 'Medical History', icon: '📚', color: 'text-red-600', bgColor: 'bg-red-50' },
    { name: 'Medications', icon: '💊', color: 'text-pink-600', bgColor: 'bg-pink-50' },
    { name: 'Custom Section', icon: '✏️', color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { name: 'Prescribed Lab Tests', icon: '🧪', color: 'text-brown-600', bgColor: 'bg-amber-50' },
    { name: 'Referred To', icon: '➡️', color: 'text-blue-400', bgColor: 'bg-blue-50' },
    { name: 'Investigative Readings', icon: '🔥', color: 'text-orange-600', bgColor: 'bg-orange-50' },
    { name: 'Examination Findings', icon: '🩺', color: 'text-green-600', bgColor: 'bg-green-50' },
    { name: 'Advices', icon: '💬', color: 'text-gray-600', bgColor: 'bg-gray-50' },
    { name: 'Follow Up', icon: '🔄', color: 'text-indigo-600', bgColor: 'bg-indigo-50' }
  ];

  const handleFileUpload = (type, file) => {
    if (file) {
      switch (type) {
        case 'letterhead':
          setLetterheadFile(file);
          addToast('Letterhead uploaded successfully', 'success');
          break;
        case 'header':
          setHeaderFile(file);
          addToast('Header uploaded successfully', 'success');
          break;
        case 'footer':
          setFooterFile(file);
          addToast('Footer uploaded successfully', 'success');
          break;
      }
    }
  };

  const handleDownload = (type) => {
    // Mock download functionality
    addToast(`${type} download initiated`, 'info');
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Persist server-side FIRST — the PDF generator reads it from there.
      // This used to only write localStorage (which the server cannot see) and
      // then report success, so print output never changed.
      const res = await api.post('/api/pad-config/print-layout', { layout: margins });
      const saved = res.data?.layout;
      if (saved && typeof saved === 'object') setMargins(prev => ({ ...prev, ...saved }));
      localStorage.setItem('rxTemplateMargins', JSON.stringify(saved || margins));
      addToast('Print layout saved — new prescriptions will print with these margins', 'success');
    } catch (err) {
      addToast(err?.response?.data?.error || 'Failed to save configuration', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    const defaults = { top: 10, bottom: 10, left: 10, right: 10, contentTop: 0, contentBottom: 0 };
    setMargins(defaults);
    setAutoFitHeight(false);
    setSpaceSaverLayout(false);
    setLetterheadFile(null);
    setHeaderFile(null);
    setFooterFile(null);
    addToast('Configuration reset to defaults', 'info');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Rx Template Configuration</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="spaceSaver"
              checked={spaceSaverLayout}
              onChange={(e) => setSpaceSaverLayout(e.target.checked)}
              className="h-4 w-4"
            />
            <label htmlFor="spaceSaver" className="text-sm font-medium">
              Introducing Space Saver Layout
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded shadow-sm p-6 space-y-6">
        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b pb-4">
          <button
            className={`px-4 py-2 text-sm font-medium rounded ${
              activeTab === 'print'
                ? 'bg-primary text-white'
                : 'border hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab('print')}
          >
            Print Rx Template
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium rounded ${
              activeTab === 'digital'
                ? 'bg-primary text-white'
                : 'border hover:bg-gray-50'
            }`}
            onClick={() => setActiveTab('digital')}
          >
            Digital Rx Template
          </button>
          <select
            className="px-3 py-2 border rounded ml-4"
            value={selectedClinic}
            onChange={(e) => setSelectedClinic(e.target.value)}
          >
            <option>Select Clinic: Metropolis Vidhyavihar</option>
            <option>Apollo Hospitals</option>
            <option>Max Healthcare</option>
          </select>
        </div>

        {/* Patient Details Section */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-3">Patient Details Configuration</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="h-4 w-4" />
                <span className="text-sm">Show Patient Name</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="h-4 w-4" />
                <span className="text-sm">Show Age & Gender</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" />
                <span className="text-sm">Show Contact Number</span>
              </label>
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" />
                <span className="text-sm">Show Address</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked className="h-4 w-4" />
                <span className="text-sm">Show UHID</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" />
                <span className="text-sm">Show Visit Date</span>
              </label>
            </div>
          </div>
        </div>

        {/* Template Sections */}
        <div>
          <h3 className="font-semibold mb-4">Template Sections</h3>
          <div className="grid md:grid-cols-3 gap-3">
            {sections.map((section) => (
              <div key={section.name} className={`p-4 border rounded ${section.bgColor} hover:shadow-md transition-shadow`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{section.icon}</span>
                  <div>
                    <p className={`font-medium text-sm ${section.color}`}>{section.name}</p>
                    <p className="text-xs text-gray-500">Configure section settings</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input type="checkbox" defaultChecked className="h-3 w-3" />
                  <span className="text-xs">Enabled</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Letterhead & Layout Options */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Letterhead Upload */}
          <div className="space-y-3">
            <h3 className="font-semibold">Letterhead Configuration</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <div className="text-center">
                <div className="text-4xl mb-2">📄</div>
                <p className="text-sm text-gray-600 mb-2">
                  {letterheadFile ? letterheadFile.name : 'Upload Letterhead'}
                </p>
                <div className="flex gap-2 justify-center">
                  <label className="px-3 py-1 bg-green-600 text-white text-xs rounded cursor-pointer hover:bg-green-700">
                    Upload
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*,.pdf"
                      onChange={(e) => handleFileUpload('letterhead', e.target.files[0])}
                    />
                  </label>
                  <button
                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    onClick={() => handleDownload('Letterhead')}
                  >
                    Download
                  </button>
                </div>
                <p className="text-xs text-green-600 mt-2 font-medium">Instant Setup Available</p>
              </div>
            </div>
          </div>

          {/* Header/Footer */}
          <div className="space-y-3">
            <h3 className="font-semibold">Header & Footer</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded">
                <span className="text-sm">Header Image</span>
                <div className="flex gap-2 items-center">
                  <label className="px-2 py-1 bg-green-600 text-white text-xs rounded cursor-pointer hover:bg-green-700">
                    Upload
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleFileUpload('header', e.target.files[0])}
                    />
                  </label>
                  {headerFile && (
                    <span className="text-xs text-gray-600 truncate max-w-[140px]">{headerFile.name}</span>
                  )}
                  <button
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    onClick={() => handleDownload('Header')}
                  >
                    Download
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 border rounded">
                <span className="text-sm">Footer Image</span>
                <div className="flex gap-2 items-center">
                  <label className="px-2 py-1 bg-green-600 text-white text-xs rounded cursor-pointer hover:bg-green-700">
                    Upload
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => handleFileUpload('footer', e.target.files[0])}
                    />
                  </label>
                  {footerFile && (
                    <span className="text-xs text-gray-600 truncate max-w-[140px]">{footerFile.name}</span>
                  )}
                  <button
                    className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                    onClick={() => handleDownload('Footer')}
                  >
                    Download
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Layout Options */}
        <div className="bg-gray-50 p-4 rounded-lg space-y-5">
          <h3 className="font-semibold">Layout Options</h3>

          {/* AutoFit */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={autoFitHeight}
                onChange={(e) => setAutoFitHeight(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm">AutoFit Height</span>
            </label>
            <span className="text-xs text-gray-500">
              Automatically adjust section heights to fit content
            </span>
          </div>

          {/* Page Margins */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Page Margins <span className="text-xs text-gray-400 font-normal">(mm — blank space around the page edge)</span></p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { key: 'top', label: 'Top' },
                { key: 'bottom', label: 'Bottom' },
                { key: 'left', label: 'Left' },
                { key: 'right', label: 'Right' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label} Margin (mm)</label>
                  <div className="flex items-center border rounded bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => updateMargin(key, margins[key] - 1)}
                      className="px-2 py-1.5 text-gray-500 hover:bg-gray-100 text-sm font-bold"
                    >−</button>
                    <input
                      type="number"
                      min="0"
                      max="80"
                      value={margins[key]}
                      onChange={(e) => updateMargin(key, e.target.value)}
                      className="w-full text-center text-sm py-1.5 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateMargin(key, margins[key] + 1)}
                      className="px-2 py-1.5 text-gray-500 hover:bg-gray-100 text-sm font-bold"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Content Area Padding */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">Content Area Padding <span className="text-xs text-gray-400 font-normal">(mm — extra space inside page for pre-printed letterhead)</span></p>
            <p className="text-xs text-gray-400 mb-2">Use this when your paper already has a printed header/footer — set how much space to leave blank for it</p>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              {[
                { key: 'contentTop', label: 'Content Top Padding' },
                { key: 'contentBottom', label: 'Content Bottom Padding' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">{label} (mm)</label>
                  <div className="flex items-center border rounded bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => updateMargin(key, margins[key] - 1)}
                      className="px-2 py-1.5 text-gray-500 hover:bg-gray-100 text-sm font-bold"
                    >−</button>
                    <input
                      type="number"
                      min="0"
                      max="200"
                      value={margins[key]}
                      onChange={(e) => updateMargin(key, Math.max(0, Math.min(200, parseInt(e.target.value) || 0)))}
                      className="w-full text-center text-sm py-1.5 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateMargin(key, margins[key] + 1)}
                      className="px-2 py-1.5 text-gray-500 hover:bg-gray-100 text-sm font-bold"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Preview Label */}
          <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded px-3 py-2 w-fit">
            <span>📄</span>
            <span>Margins: Top {margins.top}mm · Bottom {margins.bottom}mm · Left {margins.left}mm · Right {margins.right}mm &nbsp;|&nbsp; Content Padding: Top {margins.contentTop}mm · Bottom {margins.contentBottom}mm</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            className="px-4 py-2 border rounded hover:bg-gray-50"
            onClick={handleReset}
          >
            Reset
          </button>
          <button
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90 disabled:opacity-50"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}

