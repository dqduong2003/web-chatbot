import { v4 as uuidv4 } from 'uuid';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const conversationId = uuidv4();
  res.status(200).json({ conversation_id: conversationId });
} 