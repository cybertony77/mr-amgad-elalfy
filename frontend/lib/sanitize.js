/**
 * Input sanitization utilities to prevent NoSQL injection attacks.
 * 
 * MongoDB operator injection occurs when an attacker sends an object like
 * { "$ne": null } instead of a string, turning a simple equality check
 * into a query that matches all documents.
 */

function stripMongoOperators(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/[$]/g, '').replace(/\.\./g, '.');
}

function sanitizeString(value, fieldName = 'field') {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') {
    throw new Error(`Invalid ${fieldName}: expected string, got ${typeof value}`);
  }
  return stripMongoOperators(value);
}

function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item));

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('$')) continue;
    const cleanKey = key.replace(/[$]/g, '').replace(/\.\./g, '.');
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const hasOperator = Object.keys(value).some(k => k.startsWith('$'));
      if (hasOperator) continue;
      sanitized[cleanKey] = sanitizeObject(value);
    } else {
      sanitized[cleanKey] = value;
    }
  }
  return sanitized;
}

module.exports = { sanitizeString, sanitizeObject, stripMongoOperators };
