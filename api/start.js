const { v4: uuidv4 } = require('uuid');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const conversationId = uuidv4();
  res.status(200).json({ conversation_id: conversationId });
}; 