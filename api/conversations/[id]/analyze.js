import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ANALYSIS_SYSTEM_PROMPT = `Extract the following customer details from the transcript:
- Name
- Email address
- Phone number
- Industry
- Problems, needs, and goals summary
- Availability
- Whether they have booked a consultation (true/false)
- Any special notes
- Lead quality (categorize as 'good', 'ok', or 'spam')
Format the response using this JSON schema:
{
  "type": "object",
  "properties": {
    "customerName": { "type": "string" },
    "customerEmail": { "type": "string" },
    "customerPhone": { "type": "string" },
    "customerIndustry": { "type": "string" },
    "customerProblem": { "type": "string" },
    "customerAvailability": { "type": "string" },
    "customerConsultation": { "type": "boolean" },
    "specialNotes": { "type": "string" },
    "leadQuality": { "type": "string", "enum": ["good", "ok", "spam"] }
  },
  "required": ["customerName", "customerEmail", "customerProblem", "leadQuality"]
}
If the user provided contact details, set lead quality to "good"; otherwise, "spam".`;

export default async function handler(req, res) {
  const { id } = req.query;
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  // Get the conversation messages
  const { data, error } = await supabase
    .from('conversations')
    .select('messages')
    .eq('conversation_id', id)
    .single();
  if (error || !data) {
    res.status(404).json({ error: 'Conversation not found.' });
    return;
  }
  const transcript = data.messages.map(m => `[${m.role}] ${m.content}`).join('\n');
  try {
    const openaiRes = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
          { role: 'user', content: transcript }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    let analysis = null;
    try {
      analysis = JSON.parse(openaiRes.data.choices[0].message.content);
    } catch (e) {
      res.status(500).json({ error: 'Failed to parse analysis JSON.' });
      return;
    }
    // Update the conversation row with the extracted info
    const { error: updateError } = await supabase
      .from('conversations')
      .update({
        customerName: analysis.customerName,
        customerEmail: analysis.customerEmail,
        customerPhone: analysis.customerPhone,
        customerIndustry: analysis.customerIndustry,
        customerProblem: analysis.customerProblem,
        customerAvailability: analysis.customerAvailability,
        customerConsultation: analysis.customerConsultation,
        specialNotes: analysis.specialNotes,
        leadQuality: analysis.leadQuality
      })
      .eq('conversation_id', id);
    if (updateError) {
      res.status(500).json({ error: 'Failed to update conversation with analysis.' });
      return;
    }
    res.status(200).json({ analysis });
  } catch (err) {
    console.error('OpenAI analysis error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to analyze conversation.' });
  }
} 