// Inkweaver Core Logic - Expanded
const state = {
    currentView: 'editor',
    currentDraft: {
        title: "",
        content: ""
    },
    personas: [],
    worldBible: [],
    timeline: [],
    outline: [],
    proMode: false,
    settings: {
        aiProvider: localStorage.getItem('inkweaver_ai_provider') || 'gemini',
        geminiKey: localStorage.getItem('inkweaver_gemini_key') || '',
        ollamaModel: localStorage.getItem('inkweaver_ollama_model') || 'llama3'
    }
};

// Selectors
const editor = document.getElementById('editor');
const titleInput = document.querySelector('.title-input');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const saveSettings = document.getElementById('save-settings');
const aiBrainstormBtn = document.getElementById('ai-brainstorm');
const suggestionContainer = document.getElementById('suggestion-container');

// Initialization
function init() {
    loadAllData();
    setupEventListeners();
    renderAllViews();
}

// Event Listeners
function setupEventListeners() {
    // Editor sync
    editor.addEventListener('input', () => {
        state.currentDraft.content = editor.innerHTML;
        saveAllData();
    });

    titleInput.addEventListener('input', () => {
        state.currentDraft.title = titleInput.value;
        saveAllData();
    });

    // Sidebar View Switching
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.addEventListener('click', () => {
            const view = li.getAttribute('data-view');
            switchView(view);
            
            document.querySelector('.nav-links li.active').classList.remove('active');
            li.classList.add('active');

            if (view === 'family') renderFamilyTree();
        });
    });

    // New Item Buttons
    document.getElementById('add-character').addEventListener('click', () => createObject('persona'));
    document.getElementById('add-lore').addEventListener('click', () => createObject('world'));
    document.getElementById('add-plot-point').addEventListener('click', () => createObject('outline'));
    document.getElementById('add-event').addEventListener('click', () => createObject('timeline'));

    document.getElementById('ai-generate-character').addEventListener('click', aiGenerateCharacter);
    document.getElementById('analyze-btn').addEventListener('click', aiScanPlotHoles);
    document.getElementById('toggle-pro-mode').addEventListener('click', toggleProMode);
    document.getElementById('refresh-tree').addEventListener('click', renderFamilyTree);
    document.getElementById('start-ingest').addEventListener('click', startAIIngest);
    
    // Modals
    settingsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('hidden');
        document.getElementById('gemini-key').value = state.settings.geminiKey;
        document.getElementById('ai-provider').value = state.settings.aiProvider;
        document.getElementById('ollama-model').value = state.settings.ollamaModel;
    });

    saveSettings.addEventListener('click', () => {
        state.settings.geminiKey = document.getElementById('gemini-key').value;
        state.settings.aiProvider = document.getElementById('ai-provider').value;
        state.settings.ollamaModel = document.getElementById('ollama-model').value;
        
        localStorage.setItem('inkweaver_gemini_key', state.settings.geminiKey);
        localStorage.setItem('inkweaver_ai_provider', state.settings.aiProvider);
        localStorage.setItem('inkweaver_ollama_model', state.settings.ollamaModel);
        
        settingsModal.classList.add('hidden');
        updateAIStatus();
    });

    document.getElementById('test-ollama').addEventListener('click', testOllamaConnection);
    aiBrainstormBtn.addEventListener('click', generateIdea);
}

// View Management
function switchView(viewId) {
    state.currentView = viewId;
    document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
    
    const target = document.getElementById(`view-${viewId}`);
    if (target) {
        target.classList.add('active');
    }
}

// Data Handling
function saveAllData() {
    localStorage.setItem('inkweaver_full_state', JSON.stringify({
        currentDraft: state.currentDraft,
        personas: state.personas,
        worldBible: state.worldBible,
        timeline: state.timeline,
        outline: state.outline
    }));
}

function loadAllData() {
    const saved = localStorage.getItem('inkweaver_full_state');
    if (saved) {
        const data = JSON.parse(saved);
        state.currentDraft = data.currentDraft || { title: "", content: "" };
        state.personas = data.personas || [];
        state.worldBible = data.worldBible || [];
        state.timeline = data.timeline || [];
        state.outline = data.outline || [];

        // Apply to UI
        editor.innerHTML = state.currentDraft.content || "";
        titleInput.value = state.currentDraft.title || "";
    }
}

// Object Creation
function createObject(type) {
    let newObj = { id: Date.now() };
    
    switch(type) {
        case 'persona':
            const parent = prompt("Parent character name (optional):", "");
            newObj = { ...newObj, name: "New Character", role: "Protagonist", traits: ["Brave"], parent: parent || null };
            state.personas.push(newObj);
            renderPersonas();
            break;
        case 'world':
            newObj = { ...newObj, name: "New Location", description: "Describe your location..." };
            state.worldBible.push(newObj);
            renderWorld();
            break;
        case 'outline':
            newObj = { ...newObj, content: "New Plot Point" };
            state.outline.push(newObj);
            renderOutline();
            break;
        case 'timeline':
            newObj = { ...newObj, date: "Year 1", event: "The Great War" };
            state.timeline.push(newObj);
            renderTimeline();
            break;
    }
    saveAllData();
}

// Renderers
function renderAllViews() {
    renderPersonas();
    renderWorld();
    renderOutline();
    renderTimeline();
    updateAIStatus();
}

function renderPersonas() {
    const container = document.getElementById('persona-list');
    if (state.personas.length === 0) {
        container.innerHTML = '<div class="empty-state">No characters yet.</div>';
        return;
    }
    container.innerHTML = state.personas.map(p => `
        <div class="persona-card" onclick="editPersona(${p.id})">
            <div class="persona-avatar">👤</div>
            <div class="persona-name">${p.name}</div>
            <div class="persona-role">${p.role}</div>
            <div class="persona-trait-tags">
                ${p.traits.map(t => `<span class="trait-tag">${t}</span>`).join('')}
            </div>
        </div>
    `).join('');
}

function renderWorld() {
    const container = document.getElementById('world-list');
    if (state.worldBible.length === 0) return;
    container.innerHTML = state.worldBible.map(w => `
        <div class="persona-card">
            <div class="persona-avatar">🌍</div>
            <div class="persona-name">${w.name}</div>
            <p style="font-size: 0.8rem; color: #94a3b8;">${w.description}</p>
        </div>
    `).join('');
}

function renderFamilyTree() {
    const container = document.getElementById('family-tree-container');
    if (state.personas.length === 0) return;

    // Build Mermaid graph structure
    let graph = 'graph TD\n';
    state.personas.forEach(p => {
        const safeName = p.name.replace(/\s/g, '_');
        graph += `  ${safeName}["${p.name}"]\n`;
        if (p.parent) {
            const safeParent = p.parent.replace(/\s/g, '_');
            graph += `  ${safeParent} --> ${safeName}\n`;
        }
    });

    container.innerHTML = `<pre class="mermaid">${graph}</pre>`;
    mermaid.init(undefined, container.querySelectorAll('.mermaid'));
}

function renderOutline() {
    const container = document.getElementById('outline-list');
    if (state.outline.length === 0) return;
    container.innerHTML = state.outline.map(o => `
        <div class="plot-point">
            <strong>${o.content}</strong>
        </div>
    `).join('');
}

function renderTimeline() {
    const container = document.getElementById('timeline-list');
    if (state.timeline.length === 0) return;
    container.innerHTML = state.timeline.map(t => `
        <div class="plot-point">
            <small>${t.date}</small>
            <div>${t.event}</div>
        </div>
    `).join('');
}

// AI Functions
async function aiGenerateCharacter() {
    const providerLabel = state.settings.aiProvider === 'gemini' ? 'Gemini' : `Ollama (${state.settings.ollamaModel})`;
    
    if (state.settings.aiProvider === 'gemini' && !state.settings.geminiKey) {
        addSuggestion("⚠️ Please add your Gemini API Key in Settings.", "error");
        return;
    }

    addSuggestion(`✨ Summoning a character via ${providerLabel}...`, "loading");

    try {
        const prompt = `Generate a unique character for a story. Return ONLY a JSON object: {"name": "Name", "role": "Role", "traits": ["Trait1", "Trait2"], "bio": "Bio"}`;
        const responseText = await callAI(prompt);
        
        // Extract JSON from response (handling potential markdown)
        const jsonMatch = responseText.match(/\{.*\}/s);
        if (jsonMatch) {
            const charData = JSON.parse(jsonMatch[0]);
            const newChar = { id: Date.now(), ...charData };
            state.personas.push(newChar);
            saveAllData();
            renderPersonas();
            removeLoading();
            addSuggestion(`Met <b>${newChar.name}</b>! Added to your personas.`, "idea");
        }
    } catch (err) {
        console.error(err);
        removeLoading();
        addSuggestion("❌ AI failed to generate character.", "error");
    }
}

async function aiScanPlotHoles() {
    if (!state.settings.geminiKey) {
        addSuggestion("⚠️ Need Gemini Key for scanning.", "error");
        return;
    }

    addSuggestion("🕵️ Parsing story for plot holes...", "loading");

    try {
        const storyContext = editor.innerText;
        const worldContext = JSON.stringify(state.worldBible);
        const characters = JSON.stringify(state.personas);

        const prompt = `
            Act as a professional editor. Analyze this story for plot holes or inconsistencies.
            Characters: ${characters}
            World: ${worldContext}
            Story: ${storyContext}
            
            Identify any contradictions or logic gaps. Be brief but specific.
        `;

        const response = await callAI(prompt);
        removeLoading();
        addSuggestion("<b>Scan Results:</b><br>" + response, "idea");
    } catch (err) {
        removeLoading();
        addSuggestion(`❌ Analysis failed: ${err.message}`, "error");
    }
}

async function generateIdea() {
    if (state.settings.aiProvider === 'gemini' && !state.settings.geminiKey) {
        addSuggestion("⚠️ Please add your Gemini API Key in Settings.", "error");
        return;
    }

    addSuggestion("✨ Analyzing your story...", "loading");

    try {
        const response = await callAI(`
            Suggest 3 creative next steps for: "${editor.innerText.slice(-1000)}"
        `);
        removeLoading();
        addSuggestion(response, "idea");
    } catch (err) {
        removeLoading();
        addSuggestion(`❌ AI Error: ${err.message}`, "error");
    }
}

async function callAI(prompt) {
    if (state.settings.aiProvider === 'gemini') {
        return await callGemini(prompt);
    } else {
        return await callOllama(prompt);
    }
}

async function callOllama(prompt) {
    const url = "http://127.0.0.1:11434/api/generate";
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                model: state.settings.ollamaModel,
                prompt: prompt,
                stream: false
            })
        });
        const data = await response.json();
        return data.response;
    } catch (err) {
        throw new Error("Ollama not found. Is it running? (http://localhost:11434)");
    }
}

async function testOllamaConnection() {
    const btn = document.getElementById('test-ollama');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Testing...";
    
    try {
        const response = await fetch("http://127.0.0.1:11434/api/tags");
        const data = await response.json();
        alert("✅ Success! Inkweaver can see Ollama.\nModels available: " + data.models.map(m => m.name).join(', '));
    } catch (err) {
        alert("❌ Failed to connect.\n\nPotential reasons:\n1. OLLAMA_ORIGINS is not set to *\n2. Ollama was not restarted after setting the variable.\n3. A firewall is blocking the port.");
    } finally {
        btn.innerText = originalText;
    }
}

async function callGemini(prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${state.settings.geminiKey}`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(`Gemini API Error: ${data.error.message}`);
        }

        if (!data.candidates || data.candidates.length === 0) {
            // Check for safety ratings
            if (data.promptFeedback?.blockReason) {
                throw new Error(`Content Blocked: The AI blocked this request due to safety filters (${data.promptFeedback.blockReason}). Try rephrasing.`);
            }
            throw new Error("No response generated. The AI might have found the content sensitive or complex.");
        }

        return data.candidates[0].content.parts[0].text;
    } catch (err) {
        throw err;
    }
}

function addSuggestion(text, type) {
    const container = document.getElementById('suggestion-container');
    if (container.querySelector('.empty-state')) container.innerHTML = "";

    const div = document.createElement('div');
    div.className = `suggestion-card ${type}`;
    div.innerHTML = `
        <div class="card-content">${text.replace(/\n/g, '<br>')}</div>
        <div class="card-actions">
            <button onclick="this.parentElement.parentElement.remove()">Dismiss</button>
        </div>
    `;
    if (type === 'loading') div.id = 'ai-loading-card';
    container.prepend(div);
}

function removeLoading() {
    const loader = document.getElementById('ai-loading-card');
    if (loader) loader.remove();
}

function updateAIStatus() {
    const statusText = document.querySelector('.ai-status span');
    const indicator = document.querySelector('.status-indicator');
    
    if (state.settings.aiProvider === 'gemini') {
        if (state.settings.geminiKey) {
            statusText.innerText = "AI Ready (Gemini)";
            indicator.className = "status-indicator online";
        } else {
            statusText.innerText = "AI No Key (Gemini)";
            indicator.className = "status-indicator";
        }
    } else {
        statusText.innerText = `AI Ready (Local ${state.settings.ollamaModel})`;
        indicator.className = "status-indicator online";
    }
}

// Export Function
function exportMarkdown() {
    const content = `# ${state.currentDraft.title}\n\n${editor.innerText}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.currentDraft.title || 'Draft'}.md`;
    a.click();
}

window.exportMarkdown = exportMarkdown;

// Placeholder for edits
async function startAIIngest() {
    const text = document.getElementById('ingest-text').value;
    if (!text.trim()) {
        addSuggestion("⚠️ Please paste some text first.", "error");
        return;
    }

    addSuggestion("🧠 AI is deep-diving into your story...", "loading");

    const prompt = `
        Analyze the following story text and extract characters, world locations/lore, and plot points.
        Return ONLY a JSON object with this exact structure:
        {
          "characters": [{"name": "Name", "role": "Role", "traits": ["Trait1", "Trait2"], "bio": "Bio"}],
          "locations": [{"name": "Name", "description": "Description"}],
          "plot_points": [{"content": "Summary of event"}]
        }
        
        Text to analyze:
        ${text}
    `;

    try {
        const responseText = await callAI(prompt);
        if (!responseText) throw new Error("AI returned an empty response.");

        // Extract JSON (handling markdown or raw JSON)
        const jsonMatch = responseText.match(/\{.*\}/s);
        const jsonString = jsonMatch ? jsonMatch[0] : responseText;
        
        try {
            const data = JSON.parse(jsonString);
            
            // Process Characters
            if (data.characters) {
                data.characters.forEach(c => {
                    if (!state.personas.some(p => p.name === c.name)) {
                        state.personas.push({ id: Date.now() + Math.random(), ...c });
                    }
                });
            }
            
            // Process Locations
            if (data.locations) {
                data.locations.forEach(l => {
                    if (!state.worldBible.some(w => w.name === l.name)) {
                        state.worldBible.push({ id: Date.now() + Math.random(), ...l });
                    }
                });
            }
            
            // Process Plot Points
            if (data.plot_points) {
                data.plot_points.forEach(p => {
                    state.outline.push({ id: Date.now() + Math.random(), ...p });
                });
            }
            
            saveAllData();
            renderAllViews();
            removeLoading();
            
            const resultsDiv = document.getElementById('ingest-results');
            const summaryList = document.getElementById('ingest-summary-list');
            resultsDiv.classList.remove('hidden');
            summaryList.innerHTML = `
                <ul style="color: #10b981; list-style: none;">
                    <li>✅ Found ${data.characters?.length || 0} characters</li>
                    <li>✅ Found ${data.locations?.length || 0} locations</li>
                    <li>✅ Found ${data.plot_points?.length || 0} plot points</li>
                </ul>
                <p style="margin-top: 10px; font-size: 0.9rem;">Everything has been added to your Outlines, World Bible, and Personas tabs!</p>
            `;
            
            addSuggestion("✅ Ingest Complete! Check your sidebar tabs.", "idea");
        } catch (parseErr) {
            throw new Error("AI returned data in an incorrect format. Try re-running or using a different model.");
        }
    } catch (err) {
        console.error(err);
        removeLoading();
        addSuggestion(`❌ Ingest failed: ${err.message}`, "error");
    }
}

// Pro Mode & Markdown
function toggleProMode() {
    state.proMode = !state.proMode;
    const btn = document.getElementById('toggle-pro-mode');
    const proToolbar = document.getElementById('pro-toolbar');
    const preview = document.getElementById('markdown-preview');
    
    if (state.proMode) {
        btn.innerText = "💻 Pro Mode: ON";
        btn.classList.add('active');
        editor.classList.add('pro-mode');
        proToolbar.classList.remove('hidden');
        preview.classList.remove('hidden');
        
        // Initial render
        updateMarkdown();
        editor.addEventListener('input', updateMarkdown);
    } else {
        btn.innerText = "💻 Pro Mode: OFF";
        btn.classList.remove('active');
        editor.classList.remove('pro-mode');
        proToolbar.classList.add('hidden');
        preview.classList.add('hidden');
        editor.removeEventListener('input', updateMarkdown);
    }
}

function updateMarkdown() {
    const rawText = editor.innerText;
    document.getElementById('markdown-preview').innerHTML = marked.parse(rawText);
}

window.insertMarkdown = (syntax) => {
    editor.focus();
    document.execCommand('insertText', false, syntax);
};

// Start
init();
