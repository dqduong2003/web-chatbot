const API_URL = '';
const conversationList = document.getElementById('conversation-list');
const messagesView = document.getElementById('messages-view');

let allConversations = [];

function getUniqueIndustries(conversations) {
    const set = new Set();
    conversations.forEach(c => {
        if (c.customerIndustry) set.add(c.customerIndustry);
    });
    return Array.from(set);
}

function applyFilters() {
    const industry = document.getElementById('filter-industry').value;
    const consultation = document.getElementById('filter-consultation').value;
    const leadQuality = document.getElementById('filter-leadquality').value;
    let filtered = allConversations;
    if (industry) filtered = filtered.filter(c => c.customerIndustry === industry);
    if (consultation) filtered = filtered.filter(c => String(c.customerConsultation) === consultation);
    if (leadQuality) filtered = filtered.filter(c => c.leadQuality === leadQuality);
    renderConversations(filtered);
}

async function fetchConversations() {
    const res = await fetch(`/api/conversations`);
    const data = await res.json();
    allConversations = data.conversations;
    // Populate industry dropdown
    const industrySelect = document.getElementById('filter-industry');
    const industries = getUniqueIndustries(allConversations);
    industrySelect.innerHTML = '<option value="">All</option>' + industries.map(i => `<option value="${i}">${i}</option>`).join('');
    renderConversations(allConversations);
}

async function fetchMessages(conversationId) {
    const res = await fetch(`/api/conversations/${conversationId}`);
    const data = await res.json();
    return data.messages;
}

async function deleteConversation(conversationId) {
    try {
        const res = await fetch(`/api/conversations/${conversationId}`, {
            method: 'DELETE'
        });
        if (!res.ok) throw new Error('Failed to delete conversation');
        await fetchConversations();
        applyFilters();
    } catch (err) {
        console.error('Delete error:', err);
        alert('Failed to delete conversation.');
    }
}

function renderConversations(conversations) {
    conversationList.innerHTML = '';
    messagesView.innerHTML = '';
    conversations.forEach(conv => {
        const li = document.createElement('li');
        const infoDiv = document.createElement('div');
        li.textContent = `ID: ${conv.conversation_id} | Created: ${new Date(conv.created_at).toLocaleString()}`;
        li.onclick = async (e) => {
            if (e.target.tagName === 'BUTTON') return;
            const messages = await fetchMessages(conv.conversation_id);
            renderMessages(messages, conv.conversation_id);
        };
        // Delete button
        const delBtn = document.createElement('button');
        delBtn.textContent = 'Delete';
        delBtn.className = 'delete-btn';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm('Delete this conversation?')) {
                deleteConversation(conv.conversation_id);
            }
        };
        // Analyze button
        const analyzeBtn = document.createElement('button');
        analyzeBtn.textContent = 'Analyze';
        analyzeBtn.className = 'analyze-btn';
        analyzeBtn.onclick = async (e) => {
            e.stopPropagation();
            infoDiv.textContent = 'Analyzing...';
            try {
                const res = await fetch(`/api/conversations/${conv.conversation_id}/analyze`, { method: 'POST' });
                const data = await res.json();
                if (data.analysis) {
                    infoDiv.innerHTML = renderAnalysis(data.analysis);
                } else {
                    infoDiv.textContent = 'Analysis failed.';
                    console.error('Analysis error:', data.error);
                }
            } catch (err) {
                infoDiv.textContent = 'Analysis failed.';
                console.error('Analysis error:', err);
                alert('Failed to analyze conversation.');
            }
        };
        // Button container
        const btnContainer = document.createElement('span');
        btnContainer.appendChild(analyzeBtn);
        btnContainer.appendChild(delBtn);
        li.appendChild(btnContainer);
        li.appendChild(infoDiv);
        conversationList.appendChild(li);
    });
}

function renderMessages(messages, conversationId) {
    messagesView.innerHTML = `<h3>Messages for Conversation ${conversationId}</h3>`;
    messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.role}`;
        div.innerHTML = `<span class="bubble">[${msg.role}] ${msg.content}</span>`;
        messagesView.appendChild(div);
    });
}

function renderAnalysis(analysis) {
    return `
        <div style="margin-top:10px; background:#f8f9fa; padding:10px; border-radius:6px;">
            <b>Name:</b> ${analysis.customerName || '-'}<br>
            <b>Email:</b> ${analysis.customerEmail || '-'}<br>
            <b>Phone:</b> ${analysis.customerPhone || '-'}<br>
            <b>Industry:</b> ${analysis.customerIndustry || '-'}<br>
            <b>Problem/Needs/Goals:</b> ${analysis.customerProblem || '-'}<br>
            <b>Availability:</b> ${analysis.customerAvailability || '-'}<br>
            <b>Consultation Booked:</b> ${analysis.customerConsultation ? 'Yes' : 'No'}<br>
            <b>Special Notes:</b> ${analysis.specialNotes || '-'}<br>
            <b>Lead Quality:</b> <span style="font-weight:bold; color:${analysis.leadQuality==='good'?'green':analysis.leadQuality==='ok'?'orange':'red'}">${analysis.leadQuality}</span>
        </div>
    `;
}

// Initial load
fetchConversations();

// Attach filter listeners
window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('filter-industry').addEventListener('change', applyFilters);
    document.getElementById('filter-consultation').addEventListener('change', applyFilters);
    document.getElementById('filter-leadquality').addEventListener('change', applyFilters);
}); 