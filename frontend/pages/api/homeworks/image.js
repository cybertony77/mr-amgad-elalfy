import { getSignedImageUrlServer } from '../../../lib/cloudinary';
import { authMiddleware } from '../../../lib/authMiddleware';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify authentication
    const user = await authMiddleware(req);
    
    // Allow students, admins, developers, and assistants
    if (!['student', 'admin', 'developer', 'assistant'].includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const { public_id } = req.query;

    if (!public_id) {
      return res.status(400).json({ error: 'public_id is required' });
    }

    // Generate signed URL
    const signedUrl = await getSignedImageUrlServer(public_id);
    
    if (!signedUrl) {
      return res.status(500).json({ error: 'Failed to generate image URL' });
    }
    
    res.status(200).json({ url: signedUrl });
    
  } catch (error) {
    if (error.message === 'Unauthorized' || error.message === 'No token provided') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.error('Error getting signed URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

