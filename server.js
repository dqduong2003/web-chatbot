const express = require('express');
const dotenv = require('dotenv');
const axios = require('axios');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Supabase setup
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUBABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// In-memory cache for conversation history (per conversation_id)
const conversationCache = {};

// Start a new conversation and return a unique conversation_id
app.post('/start', (req, res) => {
    const conversationId = uuidv4();
    conversationCache[conversationId] = [];
    res.json({ conversation_id: conversationId });
});

async function saveConversationToSupabase(conversationId, history) {
    const { error } = await supabase
        .from('conversations')
        .upsert([
            {
                conversation_id: conversationId,
                messages: history
            }
        ], { onConflict: ['conversation_id'] });
    if (error) {
        console.error('Supabase save error:', error);
    } else {
        console.log('Conversation saved to Supabase.');
    }
}

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

// Analyze a conversation and store the extracted info
app.post('/conversations/:id/analyze', async (req, res) => {
    const { id } = req.params;
    // Get the conversation messages
    const { data, error } = await supabase
        .from('conversations')
        .select('messages')
        .eq('conversation_id', id)
        .single();
    if (error || !data) {
        return res.status(404).json({ error: 'Conversation not found.' });
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
        // Try to parse the JSON from the response
        let analysis = null;
        try {
            analysis = JSON.parse(openaiRes.data.choices[0].message.content);
        } catch (e) {
            return res.status(500).json({ error: 'Failed to parse analysis JSON.' });
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
            return res.status(500).json({ error: 'Failed to update conversation with analysis.' });
        }
        res.json({ analysis });
    } catch (err) {
        console.error('OpenAI analysis error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to analyze conversation.' });
    }
});

app.post('/chat', async (req, res) => {
    const { message, conversation_id } = req.body;
    if (!conversation_id) {
        return res.status(400).json({ reply: 'Missing conversation_id.' });
    }
    if (!conversationCache[conversation_id]) {
        conversationCache[conversation_id] = [];
    }
    try {
        conversationCache[conversation_id].push({ role: 'user', content: message });
        const messages = [
            { role: 'system', content: `You are the MindTek AI Assistant — a friendly and helpful virtual assistant representing MindTek AI, a company that offers AI consulting and implementation services.
                Your goal is to guide users through a structured discovery conversation to understand their industry, challenges, and contact details, and recommend appropriate services.
                💬 Always keep responses short, helpful, and polite.
                💬 Always reply in the same language the user speaks.
                💬 Ask only one question at a time.
                🔍 RECOMMENDED SERVICES:
                - For real estate: Mention customer data extraction from documents, integration with CRM, and lead generation via 24/7 chatbots.
                - For education: Mention email automation and AI training.
                - For retail/customer service: Mention voice-based customer service chatbots, digital marketing, and AI training.
                - For other industries: Mention chatbots, process automation, and digital marketing.
                ✅ BENEFITS: Emphasize saving time, reducing costs, and improving customer satisfaction.
                💰 PRICING: Only mention 'starting from $1000 USD' if the user explicitly asks about pricing.
                🧠 CONVERSATION FLOW:
                1. Ask what industry the user works in.
                2. Then ask what specific challenges or goals they have.
                3. Based on that, recommend relevant MindTek AI services.
                4. Ask if they'd like to learn more about the solutions.
                5. If yes, collect their name → email → phone number (one at a time).
                6. Provide a more technical description of the solution and invite them to book a free consultation.
                7. Finally, ask if they have any notes or questions before ending the chat.
                ⚠️ OTHER RULES:
                - Be friendly but concise.
                - Do not ask multiple questions at once.
                - Do not mention pricing unless asked.
                - Stay on-topic and professional throughout the conversation.` },
            ...conversationCache[conversation_id]
        ];
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
        conversationCache[conversation_id].push({ role: 'assistant', content: reply });
        await saveConversationToSupabase(conversation_id, conversationCache[conversation_id]);
        res.json({ reply, history: conversationCache[conversation_id] });
    } catch (error) {
        console.error('OpenAI API error:', error.response?.data || error.message);
        res.status(500).json({ reply: 'Sorry, I could not process your request.' });
    }
});

// Get all conversations (for dashboard)
app.get('/conversations', async (req, res) => {
    const { data, error } = await supabase
        .from('conversations')
        .select('conversation_id, created_at, customerIndustry, customerConsultation, leadQuality')
        .order('created_at', { ascending: false });
    if (error) {
        return res.status(500).json({ error: 'Failed to fetch conversations.' });
    }
    res.json({ conversations: data });
});

// Get messages for a conversation
app.get('/conversations/:id', async (req, res) => {
    const { id } = req.params;
    const { data, error } = await supabase
        .from('conversations')
        .select('messages')
        .eq('conversation_id', id)
        .single();
    if (error || !data) {
        return res.status(404).json({ error: 'Conversation not found.' });
    }
    res.json({ messages: data.messages });
});

// Delete a conversation
app.delete('/conversations/:id', async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('conversation_id', id);
    if (error) {
        return res.status(500).json({ error: 'Failed to delete conversation.' });
    }
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
}); 