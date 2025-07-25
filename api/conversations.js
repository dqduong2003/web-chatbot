import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const { data, error } = await supabase
    .from('conversations')
    .select('conversation_id, created_at, customerIndustry, customerConsultation, leadQuality')
    .order('created_at', { ascending: false });
  if (error) {
    res.status(500).json({ error: 'Failed to fetch conversations.' });
    return;
  }
  res.status(200).json({ conversations: data });
} 