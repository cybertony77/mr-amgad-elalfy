import { createPublicStudentUrl } from './hmac';

/**
 * Generate a public student info URL for testing
 * @param {number|string} studentId - The student ID
 * @returns {string} - The complete public URL
 */
export function generatePublicStudentLink(studentId) {
  // Get the current domain dynamically
  let baseUrl;
  
  if (typeof window !== 'undefined') {
    // Client-side: use current window location
    baseUrl = `${window.location.protocol}//${window.location.host}`;
  } else {
    // Server-side: use environment variable or default
    baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL || 'http://localhost:3000';
  }
  
  const path = createPublicStudentUrl(studentId);
  return `${baseUrl}${path}`;
}

// Example usage:
// console.log(generatePublicStudentLink(5));
// Output: https://yourdomain.com/dashboard/student_info?id=5&sig=a1b2c3d4e5f6...
// or http://localhost:3000/dashboard/student_info?id=5&sig=a1b2c3d4e5f6... (in development)

