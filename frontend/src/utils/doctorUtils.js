/**
 * Utility functions for doctor selection in admin mode
 */

/**
 * Get selected doctor ID from localStorage
 * If admin has selected a doctor, return that doctor's ID
 * Otherwise return null
 */
export function getSelectedDoctorId() {
  const selectedDoctorId = localStorage.getItem('selectedDoctorId');
  return selectedDoctorId ? parseInt(selectedDoctorId) : null;
}

/**
 * Get selected doctor object from localStorage
 */
export function getSelectedDoctor() {
  const selectedDoctor = localStorage.getItem('selectedDoctor');
  return selectedDoctor ? JSON.parse(selectedDoctor) : null;
}

/**
 * Clear selected doctor from localStorage
 */
export function clearSelectedDoctor() {
  localStorage.removeItem('selectedDoctorId');
  localStorage.removeItem('selectedDoctor');
}

/**
 * Check if user is admin
 */
export function isAdmin(user) {
  return user && user.role === 'admin';
}
