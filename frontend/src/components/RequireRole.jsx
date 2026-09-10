import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RequireRole({ allowed = [], allowedRoles = null, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  const roles = Array.isArray(allowedRoles) ? allowedRoles : allowed;
  const userRole = String(user.role || '').toLowerCase();
  const normalizedRoles = roles.map((r) => String(r).toLowerCase());
  if (normalizedRoles.length && !normalizedRoles.includes(userRole)) {
    return <div className="p-4 text-sm text-red-600">You do not have access to this section.</div>;
  }
  return children;
}
