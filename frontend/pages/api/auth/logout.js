import { clearCookie } from '../../../lib/cookies';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Clear the HTTP-only cookie
  clearCookie(res, 'token');
  
  res.json({ success: true, message: 'Logged out successfully' });
}








