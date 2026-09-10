/**
 * @file helpers - Common Utility Functions
 * @description Reusable helper functions for string manipulation, object operations, and filtering
 * @version 1.0.0
 */

/**
 * @function slugify
 * @description Converts a string to URL-friendly slug format
 * Removes special characters, converts to lowercase, replaces spaces with hyphens
 * @param {string} text - Text to slugify
 * @param {string} [separator='-'] - Separator character between words
 * @returns {string} Slugified text
 * @example
 * slugify('Hello World') → 'hello-world'
 * slugify('Dr. John O\'Brien') → 'dr-john-obrien'
 * slugify('COVID-19 Treatment Guide', '_') → 'covid-19-treatment-guide'
 */
const slugify = (text, separator = '-') => {
  if (typeof text !== 'string') return '';

  return (
    text
      .toLowerCase()
      .trim()
      // Remove or replace special characters
      .replace(/[^\w\s-]/g, '') // Remove special chars except hyphens
      // Replace spaces and multiple separators with single separator
      .replace(/[\s_-]+/g, separator)
      // Remove separator from start and end
      .replace(new RegExp(`^${separator}|${separator}$`, 'g'), '')
  );
};

/**
 * @function pick
 * @description Selects specified properties from an object
 * Creates a new object with only the specified keys
 * @param {Object} obj - Source object
 * @param {Array<string>} keys - Array of property names to pick
 * @returns {Object} New object with selected properties
 * @example
 * const user = { id: 1, name: 'John', email: 'john@example.com', password: 'secret' };
 * pick(user, ['id', 'name', 'email']) → { id: 1, name: 'John', email: 'john@example.com' }
 * pick(user, ['name', 'email']) → { name: 'John', email: 'john@example.com' }
 */
const pick = (obj, keys) => {
  if (!obj || typeof obj !== 'object') return {};
  if (!Array.isArray(keys)) return {};

  return keys.reduce((result, key) => {
    if (key in obj) {
      result[key] = obj[key];
    }
    return result;
  }, {});
};

/**
 * @function cleanObject
 * @description Removes null, undefined, and empty string values from an object
 * Performs shallow cleanup (nested objects are not recursively cleaned)
 * @param {Object} obj - Object to clean
 * @param {boolean} [removeEmptyArrays=false] - Also remove empty arrays
 * @returns {Object} Cleaned object
 * @example
 * const user = { name: 'John', email: null, phone: '', status: 'active', bio: undefined };
 * cleanObject(user) → { name: 'John', status: 'active' }
 * cleanObject(user, true) → { name: 'John', status: 'active' } (same result)
 */
const cleanObject = (obj, removeEmptyArrays = false) => {
  if (!obj || typeof obj !== 'object') return {};

  return Object.entries(obj).reduce((result, [key, value]) => {
    // Skip null, undefined, empty strings
    if (value === null || value === undefined || value === '') {
      return result;
    }

    // Optionally skip empty arrays
    if (removeEmptyArrays && Array.isArray(value) && value.length === 0) {
      return result;
    }

    result[key] = value;
    return result;
  }, {});
};

/**
 * @function buildSearchFilter
 * @description Builds MongoDB search filter for text-based queries
 * Creates case-insensitive regex filters across multiple fields
 * @param {string} searchTerm - Search text
 * @param {Array<string>} fields - Field names to search in
 * @returns {Object} MongoDB filter query or empty object if no term
 * @example
 * buildSearchFilter('john', ['name', 'email'])
 * → { $or: [{ name: { $regex: 'john', $options: 'i' } }, { email: { $regex: 'john', $options: 'i' } }] }
 *
 * buildSearchFilter('', ['name']) → {} // empty search returns empty filter
 *
 * @example // In controller
 * const searchTerm = req.query.search || '';
 * const filter = buildSearchFilter(searchTerm, ['name', 'email', 'phone']);
 * const patients = await Patient.find(filter);
 */
const buildSearchFilter = (searchTerm, fields = []) => {
  // Return empty filter if no search term or no fields
  if (!searchTerm || typeof searchTerm !== 'string' || !Array.isArray(fields) || fields.length === 0) {
    return {};
  }

  const trimmedTerm = searchTerm.trim();
  if (trimmedTerm.length === 0) {
    return {};
  }

  // Build $or filter for case-insensitive regex search
  return {
    $or: fields.map((field) => ({
      [field]: {
        $regex: trimmedTerm,
        $options: 'i', // case-insensitive
      },
    })),
  };
};

/**
 * @function formatPhoneNumber
 * @description Formats phone number to standard format
 * Removes all non-digit characters and formats as (XXX) XXX-XXXX
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number or empty string if invalid
 * @example
 * formatPhoneNumber('9876543210') → '(987) 654-3210'
 * formatPhoneNumber('+1 (987) 654-3210') → '(987) 654-3210'
 * formatPhoneNumber('abc123') → '' // invalid
 */
const formatPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return '';

  // Extract digits only
  const digits = phone.replace(/\D/g, '');

  // Validate phone number has 10+ digits
  if (digits.length < 10) {
    return '';
  }

  // Use last 10 digits (e.g., ignore country code)
  const lastTenDigits = digits.slice(-10);

  // Format: (XXX) XXX-XXXX
  return `(${lastTenDigits.slice(0, 3)}) ${lastTenDigits.slice(3, 6)}-${lastTenDigits.slice(6)}`;
};

/**
 * @function normalizeEmail
 * @description Normalizes email by converting to lowercase and trimming whitespace
 * @param {string} email - Email to normalize
 * @returns {string} Normalized email
 * @example
 * normalizeEmail('  John@EXAMPLE.COM  ') → 'john@example.com'
 */
const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  return email.toLowerCase().trim();
};

/**
 * @function generateUniqueId
 * @description Generates a unique ID based on timestamp and random string
 * Suitable for non-critical unique identifiers (not cryptographic)
 * @param {string} [prefix=''] - Optional prefix for ID
 * @returns {string} Unique identifier
 * @example
 * generateUniqueId() → '1709527823145_a8b3f2x9'
 * generateUniqueId('APT_') → 'APT_1709527823145_k2m7f9p1'
 */
const generateUniqueId = (prefix = '') => {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 10);
  return `${prefix}${timestamp}_${randomStr}`;
};

/**
 * @function isValidObjectId
 * @description Checks if string is valid MongoDB ObjectId format
 * @param {string} id - String to validate
 * @returns {boolean} True if valid ObjectId format
 * @example
 * isValidObjectId('507f1f77bcf86cd799439011') → true
 * isValidObjectId('invalid-id') → false
 */
const isValidObjectId = (id) => {
  if (!id || typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * @function getInitials
 * @description Extracts initials from a name
 * Caps at 2 initials (first and last name)
 * @param {string} name - Full name
 * @returns {string} Initials in uppercase
 * @example
 * getInitials('John Doe') → 'JD'
 * getInitials('Jane Marie Smith') → 'JS'
 * getInitials('A') → 'A'
 */
const getInitials = (name) => {
  if (!name || typeof name !== 'string') return '';

  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

  return (
    (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
  );
};

/**
 * @function truncateText
 * @description Truncates text to specified length and adds ellipsis
 * @param {string} text - Text to truncate
 * @param {number} [length=50] - Maximum length
 * @param {string} [suffix='...'] - Suffix to append if truncated
 * @returns {string} Truncated text
 * @example
 * truncateText('This is a long text', 10) → 'This is a ...'
 * truncateText('Short', 50) → 'Short' // not truncated
 * truncateText('Hello World', 8, '>>') → 'Hello W>>'
 */
const truncateText = (text, length = 50, suffix = '...') => {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= length) return text;
  return text.substring(0, length - suffix.length) + suffix;
};

/**
 * @function capitalizeWords
 * @description Capitalizes first letter of each word
 * @param {string} text - Text to capitalize
 * @returns {string} Capitalized text
 * @example
 * capitalizeWords('hello world') → 'Hello World'
 * capitalizeWords('the quick brown fox') → 'The Quick Brown Fox'
 */
const capitalizeWords = (text) => {
  if (!text || typeof text !== 'string') return '';
  return text.replace(/\b\w/g, (char) => char.toUpperCase());
};

/**
 * @function delay
 * @description Delays execution for specified milliseconds
 * Useful for testing, retries, or controlled delays
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>} Resolves after delay
 * @example
 * async function retryWithDelay() {
 *   for (let i = 0; i < 3; i++) {
 *     try {
 *       return await connectToDatabase();
 *     } catch (error) {
 *       if (i < 2) await delay(1000); // Wait 1s before retry
 *     }
 *   }
 * }
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @function groupBy
 * @description Groups array items by a specified key or function
 * @param {Array} array - Array to group
 * @param {string|Function} keyOrFn - Property name or function to group by
 * @returns {Object} Object with groups as keys
 * @example
 * const users = [
 *   { id: 1, role: 'admin' },
 *   { id: 2, role: 'user' },
 *   { id: 3, role: 'admin' }
 * ];
 * groupBy(users, 'role')
 * → { admin: [...], user: [...] }
 *
 * groupBy(users, u => u.role === 'admin' ? 'admin' : 'other')
 * → { admin: [...], other: [...] }
 */
const groupBy = (array, keyOrFn) => {
  if (!Array.isArray(array)) return {};

  return array.reduce((result, item) => {
    const key = typeof keyOrFn === 'function' ? keyOrFn(item) : item[keyOrFn];
    if (!result[key]) result[key] = [];
    result[key].push(item);
    return result;
  }, {});
};

/**
 * patient_chronic_conditions.clinic_id is NOT NULL. Some JWT users have no clinic_id — use the patient's clinic.
 */
const resolveClinicIdForPatient = async (db, patientId, userClinicId) => {
  if (userClinicId != null && userClinicId !== '') {
    const n = Number(userClinicId);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  const [rows] = await db.execute('SELECT clinic_id FROM patients WHERE id = ? LIMIT 1', [patientId]);
  if (rows.length && rows[0].clinic_id != null) {
    return rows[0].clinic_id;
  }
  return null;
};

module.exports = {
  slugify,
  pick,
  cleanObject,
  buildSearchFilter,
  formatPhoneNumber,
  normalizeEmail,
  generateUniqueId,
  isValidObjectId,
  getInitials,
  truncateText,
  capitalizeWords,
  delay,
  groupBy,
  resolveClinicIdForPatient,
};
