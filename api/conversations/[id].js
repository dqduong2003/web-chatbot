const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async function handler(req, res) {
  const { id } = req.query;
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('conversations')
      .select('messages')
      .eq('conversation_id', id)
      .single();
    if (error || !data) {
      res.status(404).json({ error: 'Conversation not found.' });
      return;
    }
    res.status(200).json({ messages: data.messages });
  } else if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('conversation_id', id);
    if (error) {
      res.status(500).json({ error: 'Failed to delete conversation.' });
      return;
    }
    res.status(200).json({ success: true });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}; 