export default function Tabs({ tabs, activeTab, onChange }) {
  return (
    <div className="border-b border-gray-200 mb-6">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }
            `}
          >
            {tab.icon && <span className="text-lg">{tab.icon}</span>}
            {tab.label}
            {tab.badge && (
              <span className="ml-2 py-0.5 px-2 rounded text-xs bg-primary/10 text-primary">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
