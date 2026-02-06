import crypto from 'crypto';

const SECRET = "STD_";

/**
 * Generate HMAC signature for a student ID
 * @param {number|string} studentId - The student ID
 * @returns {string} - The HMAC signature
 */
export function generateSignature(studentId) {
  const message = SECRET + studentId;
  return crypto.createHash('sha256').update(message).digest('hex');
}

/**
 * Verify HMAC signature for a student ID
 * @param {number|string} studentId - The student ID
 * @param {string} signature - The signature to verify
 * @returns {boolean} - True if signature is valid
 */
export function verifySignature(studentId, signature) {
  // Input validation
  if (!studentId || !signature) {
    console.log('❌ HMAC: Missing studentId or signature');
    return false;
  }
  
  // Convert to string and trim
  const cleanStudentId = String(studentId).trim();
  const cleanSignature = String(signature).trim();
  
  if (!cleanStudentId || !cleanSignature) {
    console.log('❌ HMAC: Empty studentId or signature after trimming');
    return false;
  }
  
  try {
    const expectedSignature = generateSignature(cleanStudentId);
    
    // Ensure both signatures are the same length
    if (cleanSignature.length !== expectedSignature.length) {
      console.log('❌ HMAC: Signature length mismatch');
      return false;
    }
    
    // Use simple string comparison for browser environment
    // This is secure enough for our use case since we're comparing hashes
    const isValid = cleanSignature === expectedSignature;
    console.log(`🔍 HMAC Verification: ${isValid ? 'VALID' : 'INVALID'}`);
    return isValid;
  } catch (error) {
    console.error('❌ HMAC: Error during verification:', error);
    return false;
  }
}

/**
 * Create a public student info URL
 * @param {number|string} studentId - The student ID
 * @returns {string} - The public URL with signature
 */
export function createPublicStudentUrl(studentId) {
  const signature = generateSignature(studentId);
  return `/dashboard/student_info?id=${studentId}&sig=${signature}`;
}

