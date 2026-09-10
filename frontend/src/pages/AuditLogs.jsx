import { useEffect, useState, useCallback } from 'react';
import HeaderBar from '../components/HeaderBar';
import { useApiClient } from '../api/client';
import { useToast } from '../hooks/useToast';
import RequireRole from '../components/RequireRole';

export default function AuditLogs() {
  const api = useApiClient();
  const { addToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    userId: '',
    action: '',
    entity: '',
    entityId: '',
    startDate: '',
    endDate: ''
  });
  const [pagination, setPagination] = useState({ limit: 50, offset: 0, total: 0 });

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        ...filters,
        limit: pagination.limit,
        offset: pagination.offset
      };
      
      // Remove empty values
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      const res = await api.get('/api/audit', { params });
      const logsData = res.data?.data?.logs || res.data?.logs || [];
      setLogs(logsData);
      // Note: Backend doesn't return total, so we'll estimate based on results
      if (logsData.length < pagination.limit) {
        setPagination(prev => ({ ...prev, total: prev.offset + logsData.length }));
      }
    } catch (err) {
      console.error('Fetch audit logs error:', err);
      const errorMsg = err.response?.data?.error || 'Unable to load audit logs';
      setError(errorMsg);
      if (err.response?.status === 403) {
        addToast('Access denied. Admin role required to view audit logs.', 'error');
      } else if (err.response?.status === 500) {
        addToast('Server error while fetching audit logs', 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [api, filters, pagination.limit, pagination.offset, addToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const clearFilters = () => {
    setFilters({
      userId: '',
      action: '',
      entity: '',
      entityId: '',
      startDate: '',
      endDate: ''
    });
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const getActionColor = (action) => {
    if (action.includes('CREATE') || action.includes('ADD')) return 'bg-green-100 text-green-800';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'bg-blue-100 text-blue-800';
    if (action.includes('DELETE') || action.includes('REMOVE')) return 'bg-red-100 text-red-800';
    if (action.includes('LOGIN') || action.includes('AUTH')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatDetails = (details) => {
    if (!details) return 'N/A';
    try {
      const parsed = JSON.parse(details);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return details;
    }
  };

  return (
    <RequireRole allowed={['admin']}>
      <div className="min-h-screen bg-gray-50">
        <HeaderBar />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
            <p className="text-gray-600 mt-1">Track all user actions and system events</p>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">User ID</label>
                <input
                  type="number"
                  value={filters.userId}
                  onChange={(e) => handleFilterChange('userId', e.target.value)}
                  placeholder="Filter by user ID"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Action</label>
                <input
                  type="text"
                  value={filters.action}
                  onChange={(e) => handleFilterChange('action', e.target.value)}
                  placeholder="e.g., CREATE, UPDATE"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Entity</label>
                <input
                  type="text"
                  value={filters.entity}
                  onChange={(e) => handleFilterChange('entity', e.target.value)}
                  placeholder="e.g., patient, appointment"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Entity ID</label>
                <input
                  type="text"
                  value={filters.entityId}
                  onChange={(e) => handleFilterChange('entityId', e.target.value)}
                  placeholder="Entity ID"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={fetchLogs}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Apply Filters
                </button>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* Logs Table */}
          {loading ? (
            <div className="text-center py-12">
              <div className="text-lg text-gray-600">Loading audit logs...</div>
            </div>
          ) : logs.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <p className="text-gray-600">No audit logs found</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Entity ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP Address</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{log.username || 'N/A'}</div>
                          <div className="text-sm text-gray-500">{log.email || ''}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getActionColor(log.action)}`}>
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.entity || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {log.entity_id || 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                          <div className="truncate" title={formatDetails(log.details)}>
                            {log.details ? (log.details.length > 50 ? log.details.substring(0, 50) + '...' : log.details) : 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {log.ip_address || 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination */}
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing {pagination.offset + 1} to {pagination.offset + logs.length} of {pagination.total || 'many'} logs
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                    disabled={pagination.offset === 0}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                    disabled={logs.length < pagination.limit}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </RequireRole>
  );
}

