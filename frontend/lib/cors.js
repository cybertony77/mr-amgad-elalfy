/**
 * CORS helper utility for Next.js API routes
 * This provides a helper function to set CORS headers in API route handlers
 */

/**
 * Sets CORS headers on the response object
 * @param {Object} res - Next.js response object
 * @param {string|string[]} allowedOrigins - Allowed origins (default: '*')
 */
export function setCorsHeaders(res, allowedOrigins = '*') {
  const origin = Array.isArray(allowedOrigins) 
    ? allowedOrigins.join(', ') 
    : allowedOrigins;

  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

/**
 * Handles OPTIONS preflight requests
 * @param {Object} res - Next.js response object
 * @param {string|string[]} allowedOrigins - Allowed origins (default: '*')
 * @returns {boolean} - Returns true if request was handled
 */
export function handleCorsPreflight(req, res, allowedOrigins = '*') {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res, allowedOrigins);
    res.status(200).end();
    return true;
  }
  return false;
}

