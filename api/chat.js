const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { message, conversation_id } = req.body;
  if (!conversation_id) {
    res.status(400).json({ reply: 'Missing conversation_id.' });
    return;
  }
  // Fetch history
  let history = [];
  const { data: convo, error: fetchError } = await supabase
    .from('conversations')
    .select('messages')
    .eq('conversation_id', conversation_id)
    .single();
  if (convo && convo.messages) history = convo.messages;
  history.push({ role: 'user', content: message });
  const messages = [
    { role: 'system', content: 'You are a helpful and funny assistant.' },
    ...history
  ];
  try {
    const openaiRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4.1-mini',
        messages
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    const reply = openaiRes.data.choices[0].message.content.trim();
    history.push({ role: 'assistant', content: reply });
    // Upsert conversation
    await supabase.from('conversations').upsert([
      { conversation_id, messages: history }
    ], { onConflict: ['conversation_id'] });
    res.status(200).json({ reply, history });
  } catch (error) {
    console.error('OpenAI API error:', error.response?.data || error.message);
    res.status(500).json({ reply: 'Sorry, I could not process your request.' });
  }
}; 