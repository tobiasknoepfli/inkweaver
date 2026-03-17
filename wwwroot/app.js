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
    chapters: [{ id: 'ch1', title: 'Chapter 1', points: [] }],
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
    document.getElementById('add-plot-point').addEventListener('click', addPlotPointToChapter);
    document.getElementById('add-chapter-btn').addEventListener('click', addChapter);
    document.getElementById('add-event').addEventListener('click', () => createObject('timeline'));
    document.getElementById('ai-suggest-scene').addEventListener('click', aiSuggestNextScene);

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
        
        const manualModel = document.getElementById('ollama-model').value;
        const selectModel = document.getElementById('ollama-model-select').value;
        state.settings.ollamaModel = manualModel || selectModel;
        
        localStorage.setItem('inkweaver_gemini_key', state.settings.geminiKey);
        localStorage.setItem('inkweaver_ai_provider', state.settings.aiProvider);
        localStorage.setItem('inkweaver_ollama_model', state.settings.ollamaModel);
        
        settingsModal.classList.add('hidden');
        updateAIStatus();
    });

    document.getElementById('refresh-models-btn').addEventListener('click', refreshOllamaModels);
    document.getElementById('ollama-model-select').addEventListener('change', (e) => {
        document.getElementById('ollama-model').value = e.target.value;
    });

    document.getElementById('test-ollama').addEventListener('click', testOllamaConnection);
    aiBrainstormBtn.addEventListener('click', generateIdea);

    // Edit Modal Listeners
    document.getElementById('close-edit').addEventListener('click', () => document.getElementById('edit-modal').classList.add('hidden'));
    document.getElementById('save-edit').addEventListener('click', saveEdit);
    document.getElementById('delete-btn').addEventListener('click', deleteCurrentItem);
    document.getElementById('merge-btn').addEventListener('click', openMergeModal);
    document.getElementById('close-merge').addEventListener('click', () => document.getElementById('merge-modal').classList.add('hidden'));
    document.getElementById('confirm-merge').addEventListener('click', confirmMerge);
    
    document.getElementById('consistency-btn').addEventListener('click', aiCheckConsistency);

    // Zoom/Pan for Tree
    let zoomLevel = 1;
    document.getElementById('family-tree-container').addEventListener('wheel', (e) => {
        if (e.ctrlKey) {
            e.preventDefault();
            zoomLevel += e.deltaY * -0.001;
            zoomLevel = Math.min(Math.max(0.2, zoomLevel), 3);
            const wrap = document.querySelector('.mermaid-wrap');
            if (wrap) wrap.style.transform = `scale(${zoomLevel})`;
        }
    });

    // Sidebar Tabs
    document.getElementById('tab-ai').addEventListener('click', () => switchSidebarTab('ai'));
    document.getElementById('tab-ref').addEventListener('click', () => switchSidebarTab('ref'));

    // Dialogue tagging
    editor.addEventListener('blur', processDialogueAttribution);
}

function switchSidebarTab(tab) {
    const aiTab = document.getElementById('tab-ai');
    const refTab = document.getElementById('tab-ref');
    const aiCont = document.getElementById('suggestion-container');
    const refCont = document.getElementById('reference-container');

    if (tab === 'ai') {
        aiTab.classList.add('active');
        aiTab.style.color = 'white';
        refTab.classList.remove('active');
        refTab.style.color = 'var(--text-secondary)';
        aiCont.classList.remove('hidden');
        refCont.classList.add('hidden');
    } else {
        refTab.classList.add('active');
        refTab.style.color = 'white';
        aiTab.classList.remove('active');
        aiTab.style.color = 'var(--text-secondary)';
        refCont.classList.remove('hidden');
        aiCont.classList.add('hidden');
        renderReferenceList();
    }
}

function renderReferenceList() {
    const container = document.getElementById('reference-container');
    if (state.personas.length === 0 && state.worldBible.length === 0) {
        container.innerHTML = '<div class="empty-state">No characters or lore to reference.</div>';
        return;
    }

    let html = '<h4>Personas</h4>';
    html += state.personas.map(p => `
        <div class="ref-item" style="padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer;" onclick="editPersona(${p.id})">
            <b style="color: var(--accent-blue)">${p.name}</b><br>
            <small>${p.role}</small>
        </div>
    `).join('');

    html += '<h4 style="margin-top: 20px;">World Bible</h4>';
    html += state.worldBible.map(w => `
        <div class="ref-item" style="padding: 10px; border-bottom: 1px solid var(--border-color); cursor: pointer;" onclick="editWorld(${w.id})">
            <b style="color: var(--accent-blue)">${w.name}</b>
        </div>
    `).join('');

    container.innerHTML = html;
}

async function refreshOllamaModels() {
    const select = document.getElementById('ollama-model-select');
    const btn = document.getElementById('refresh-models-btn');
    btn.innerText = "⏳";
    
    try {
        const response = await fetch("http://127.0.0.1:11434/api/tags");
        const data = await response.json();
        
        select.innerHTML = '<option value="">Select a model...</option>';
        data.models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.name;
            opt.innerText = m.name;
            select.appendChild(opt);
        });
        
        if (state.settings.ollamaModel) {
            select.value = state.settings.ollamaModel;
        }
    } catch (err) {
        console.error("Ollama Fetch Error:", err);
        alert(`Could not fetch models.\n\nError: ${err.message}\n\n1. Is Ollama running?\n2. Is OLLAMA_ORIGINS set to * and restarted?`);
    } finally {
        btn.innerText = "🔄";
        if (select.options.length <= 1 && select.innerText.includes('Select')) {
            alert("No models found. Please download a model like 'llama3' via the Ollama app or terminal.");
        }
    }
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
        state.chapters = data.chapters || [{ id: 'ch1', title: 'Chapter 1', points: [] }];

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
    if (state.worldBible.length === 0) {
        container.innerHTML = '<div class="empty-state">The world is empty. Create your locations and lore.</div>';
        return;
    }
    container.innerHTML = state.worldBible.map(w => `
        <div class="persona-card" onclick="editWorld(${w.id})">
            <div class="persona-avatar">🌍</div>
            <div class="persona-name">${w.name}</div>
            <p style="font-size: 0.8rem; color: #94a3b8;">${w.description || 'No description yet.'}</p>
        </div>
    `).join('');
}

function renderFamilyTree() {
    const container = document.getElementById('family-tree-container');
    if (state.personas.length === 0) {
        container.innerHTML = '<div class="empty-state">No characters yet.</div>';
        return;
    }

    // Configure Mermaid for a nicer wide layout
    mermaid.initialize({ 
        startOnLoad: false, 
        theme: 'dark',
        flowchart: { useMaxWidth: false, htmlLabels: true, curve: 'basis' },
        securityLevel: 'loose'
    });

    let graph = 'graph LR\n'; // Left-to-Right layout is usually better for wide trees
    
    // Nodes
    state.personas.forEach((p, index) => {
        const nodeId = `char_${index}`;
        const cleanName = p.name.replace(/[^a-zA-Z0-9]/g, '_'); // Very safe ID
        graph += `  ${nodeId}["${p.name}"]\n`;
    });

    // Relationships
    state.personas.forEach((p, index) => {
        const nodeId = `char_${index}`;
        
        // Parents (Solid lines - Supporting Multiple)
        const parentsList = p.parents || (p.parent ? [p.parent] : []);
        parentsList.forEach(parentName => {
            const cleanParentName = parentName.trim().toLowerCase();
            const parentIdx = state.personas.findIndex(x => x.name.toLowerCase() === cleanParentName);
            if (parentIdx !== -1) {
                graph += `  char_${parentIdx} --> ${nodeId}\n`;
            }
        });
        
        // Spouses (Dotted lines for relationships)
        if (p.spouse) {
            const spouseName = p.spouse.trim().toLowerCase();
            const spouseIdx = state.personas.findIndex(x => x.name.toLowerCase() === spouseName);
            if (spouseIdx !== -1 && spouseIdx > index) {
                graph += `  char_${spouseIdx} --- ${nodeId}\n`; // Use 3 dashes for a link without arrow
            }
        }

        // Relationships (Heatmap)
        if (p.relationships) {
            p.relationships.forEach(rel => {
                const targetIdx = state.personas.findIndex(x => x.name.toLowerCase() === rel.target.toLowerCase());
                if (targetIdx !== -1 && targetIdx > index) {
                    const type = rel.type.toLowerCase();
                    let style = "---";
                    if (type.includes("enemy") || type.includes("rival")) style = "-. enemy .->";
                    else if (type.includes("friend") || type.includes("ally")) style = "== friend ==>";
                    graph += `  char_${index} ${style} char_${targetIdx}\n`;
                }
            });
        }
    });

    // Custom Styles for Heatmap
    graph += `  linkStyle default stroke:#475569,stroke-width:1px;\n`;
    // We can't easily target specific link indices here without more complex logic, but Mermaid will auto-render the link types.

    // Clear and Redraw
    container.innerHTML = `<div class="mermaid-wrap" style="transform-origin: 0 0; transition: transform 0.2s;"><pre class="mermaid">${graph}</pre></div>`;
    
    try {
        mermaid.init(undefined, container.querySelectorAll('.mermaid'));
    } catch (err) {
        console.error(err);
        container.innerHTML += `<div class="error">Graph rendering issue.</div>`;
    }
}

function renderOutline() {
    const container = document.getElementById('outline-list');
    if (!state.chapters) state.chapters = [{ id: 'ch1', title: 'Chapter 1', points: [] }];
    
    container.innerHTML = state.chapters.map((ch, chIdx) => `
        <div class="chapter-block" data-ch-id="${ch.id}">
            <div class="chapter-header">
                <input type="text" class="chapter-title-edit" value="${ch.title}" onchange="updateChapterTitle('${ch.id}', this.value)">
                <button onclick="deleteChapter('${ch.id}')" class="btn-mini">🗑️</button>
            </div>
            <div class="plot-points-container" ondrop="drop(event, '${ch.id}')" ondragover="allowDrop(event)">
                ${ch.points.length === 0 ? '<div class="empty-drop">Drop points here...</div>' : ch.points.map((p, pIdx) => `
                    <div class="plot-point sortable" draggable="true" ondragstart="drag(event, '${ch.id}', ${pIdx})">
                        <div class="point-content" contenteditable="true" onblur="updatePlotPointContent('${ch.id}', ${pIdx}, this.innerText)">${p.content}</div>
                        <div style="display: flex; gap: 5px;">
                            <button onclick="aiDraftScene('${ch.id}', ${pIdx})" class="btn-mini" title="Draft Prose">✍️</button>
                            <button onclick="deletePlotPoint('${ch.id}', ${pIdx})" class="btn-mini">×</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('');
}

// Drag & Drop
let draggedItem = null;
window.allowDrop = (ev) => ev.preventDefault();
window.drag = (ev, chId, idx) => {
    draggedItem = { chId, idx };
    ev.dataTransfer.setData("text", chId + "|" + idx);
};
window.drop = (ev, targetChId) => {
    ev.preventDefault();
    const source = draggedItem;
    if (!source) return;

    const sourceCh = state.chapters.find(c => c.id === source.chId);
    const targetCh = state.chapters.find(c => c.id === targetChId);
    
    const [item] = sourceCh.points.splice(source.idx, 1);
    targetCh.points.push(item);
    
    saveAllData();
    renderOutline();
};

function addChapter() {
    state.chapters.push({ id: 'ch_' + Date.now(), title: 'New Chapter', points: [] });
    saveAllData();
    renderOutline();
}

function deleteChapter(id) {
    if (!confirm("Delete this chapter and all its points?")) return;
    state.chapters = state.chapters.filter(c => c.id !== id);
    saveAllData();
    renderOutline();
}

function updateChapterTitle(id, val) {
    const ch = state.chapters.find(c => c.id === id);
    if (ch) ch.title = val;
    saveAllData();
}

function addPlotPointToChapter() {
    if (state.chapters.length === 0) addChapter();
    state.chapters[0].points.push({ content: "New scene or beat..." });
    saveAllData();
    renderOutline();
}

function updatePlotPointContent(chId, idx, val) {
    const ch = state.chapters.find(c => c.id === chId);
    if (ch && ch.points[idx]) ch.points[idx].content = val;
    saveAllData();
}

function deletePlotPoint(chId, idx) {
    const ch = state.chapters.find(c => c.id === chId);
    if (ch) ch.points.splice(idx, 1);
    saveAllData();
    renderOutline();
}

async function aiSuggestNextScene() {
    addSuggestion("🔮 Consultating the weaver for next scene...", "loading");
    try {
        const context = getProjectContext();
        const lastPoints = state.chapters[state.chapters.length -1]?.points.slice(-3).map(p => p.content).join(' -> ');
        
        const prompt = `${context}\n\nExisting outline sequence: ${lastPoints}\n\nTASK: Based on the existing character lineages and world lore, suggest ONE compelling next scene for the outline. Keep it strictly relevant to character motivations. Return only the scene description.`;
        
        const response = await callAI(prompt);
        removeLoading();
        addSuggestion("<b>Suggested Scene:</b><br>" + response + `<br><button onclick="addSceneFromAI('${response.replace(/'/g, "\\'")}')">➕ Add to Outline</button>`, "idea");
    } catch (err) {
        removeLoading();
        addSuggestion("Error: " + err.message, "error");
    }
}

window.addSceneFromAI = (txt) => {
    if (state.chapters.length === 0) addChapter();
    state.chapters[state.chapters.length-1].points.push({ content: txt });
    saveAllData();
    renderOutline();
};

async function aiDraftScene(chId, pIdx) {
    const ch = state.chapters.find(c => c.id === chId);
    const point = ch.points[pIdx];
    
    addSuggestion(`✍️ Drafting prose for: "${point.content.substring(0, 30)}..."`, "loading");
    
    try {
        const context = getProjectContext();
        const prompt = `
            ${context}
            
            TASK: Write a 500-word prose scene based on this plot beat: "${point.content}".
            
            GUIDELINES:
            - Focus on the internal conflicts and active goals of the characters involved.
            - Maintain the established lineage and relationships.
            - Use a rich, descriptive tone appropriate for the world bible.
            - Return ONLY the drafted prose.
        `;
        
        const response = await callAI(prompt);
        removeLoading();
        
        // Open in a preview or just append to editor
        if (confirm("Scene drafted! Append to the end of your current draft?")) {
            editor.innerHTML += `<br><br><i>--- New Scene ---</i><br>${response.replace(/\n/g, '<br>')}`;
            state.currentDraft.content = editor.innerHTML;
            saveAllData();
            addSuggestion("Scene appended to editor.", "idea");
        }
    } catch (err) {
        removeLoading();
        addSuggestion("Drafting failed: " + err.message, "error");
    }
}

async function processDialogueAttribution() {
    const text = editor.innerText;
    const quotes = text.match(/["'](.*?)["']/g);
    if (!quotes) return;

    console.log("Processing dialogue tags...");
    // Heuristic: Look for names from state.personas near the quote
    const lines = text.split('\n');
    let updatedHtml = editor.innerHTML;

    // This is a heavy operation, so we only do it on blur or specific trigger
    // For now, let's add a button to the toolbar for "Auto-Tag Dialogue"
}

async function aiTagDialogue() {
    addSuggestion("🎙️ AI is identifying speakers in your draft...", "loading");
    
    try {
        const text = editor.innerText;
        const charList = state.personas.map(p => p.name).join(', ');
        
        const prompt = `
            Characters: ${charList}
            Story: ${text}
            
            TASK: Identify who is speaking in every quoted dialogue block. 
            Return the text but insert a marker like [Speaker: Name] immediately before every opening quote.
            If unsure, use [Speaker: Unknown].
            Return the FULL text with markers.
        `;
        
        const response = await callAI(prompt);
        removeLoading();
        
        if (confirm("AI has tagged the speakers. Update your draft?")) {
            editor.innerText = response;
            state.currentDraft.content = editor.innerHTML;
            saveAllData();
        }
    } catch (err) {
        removeLoading();
        addSuggestion("Tagging failed: " + err.message, "error");
    }
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

// Editing System
let currentEditingItem = null;
let currentEditingType = null;

function editPersona(id) {
    const p = state.personas.find(item => item.id === id);
    if (!p) return;
    
    currentEditingItem = p;
    currentEditingType = 'persona';
    
    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('edit-modal-title').innerText = "Edit Character: " + p.name;
    document.getElementById('persona-fields').classList.remove('hidden');
    document.getElementById('edit-desc-label').innerText = "Biography";
    
    document.getElementById('edit-name').value = p.name || "";
    document.getElementById('edit-role').value = p.role || "";
    document.getElementById('edit-traits').value = p.traits ? p.traits.join(', ') : "";
    document.getElementById('edit-description').value = p.bio || p.description || "";
    
    // Steckbrief
    document.getElementById('edit-appearance').value = p.appearance || "";
    document.getElementById('edit-motivation').value = p.motivation || "";
    document.getElementById('edit-flaws').value = p.flaws || "";
    document.getElementById('edit-history').value = p.history || "";
    document.getElementById('edit-parent').value = p.parents ? p.parents.join(', ') : (p.parent || "");
    document.getElementById('edit-spouse').value = p.spouse || "";
    document.getElementById('edit-goal').value = p.goal || "";
    document.getElementById('edit-conflict').value = p.conflict || "";
    document.getElementById('edit-relationships').value = p.relationships ? p.relationships.map(r => `${r.target}: ${r.type}`).join(', ') : "";
}

function editWorld(id) {
    const w = state.worldBible.find(item => item.id === id);
    if (!w) return;
    
    currentEditingItem = w;
    currentEditingType = 'world';
    
    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('edit-modal-title').innerText = "Edit Lore: " + w.name;
    document.getElementById('persona-fields').classList.add('hidden');
    document.getElementById('edit-desc-label').innerText = "Description";
    
    document.getElementById('edit-name').value = w.name || "";
    document.getElementById('edit-description').value = w.description || "";

    // Clear Character specifics
    document.getElementById('edit-appearance').value = "";
    document.getElementById('edit-motivation').value = "";
    document.getElementById('edit-flaws').value = "";
    document.getElementById('edit-history').value = "";
    document.getElementById('edit-parent').value = "";
}

function saveEdit() {
    if (!currentEditingItem) return;
    
    currentEditingItem.name = document.getElementById('edit-name').value;
    currentEditingItem.description = document.getElementById('edit-description').value;

    if (currentEditingType === 'persona') {
        currentEditingItem.role = document.getElementById('edit-role').value;
        currentEditingItem.traits = document.getElementById('edit-traits').value.split(',').map(t => t.trim()).filter(t => t);
        currentEditingItem.bio = currentEditingItem.description;
        
        currentEditingItem.appearance = document.getElementById('edit-appearance').value;
        currentEditingItem.motivation = document.getElementById('edit-motivation').value;
        currentEditingItem.flaws = document.getElementById('edit-flaws').value;
        currentEditingItem.history = document.getElementById('edit-history').value;
        currentEditingItem.parents = document.getElementById('edit-parent').value.split(',').map(s => s.trim()).filter(s => s);
        currentEditingItem.parent = currentEditingItem.parents[0] || ""; // Keep for legacy
        currentEditingItem.spouse = document.getElementById('edit-spouse').value;
        currentEditingItem.goal = document.getElementById('edit-goal').value;
        currentEditingItem.conflict = document.getElementById('edit-conflict').value;
        
        // Relationships parsing: "Name: Type"
        const relStr = document.getElementById('edit-relationships').value;
        currentEditingItem.relationships = relStr.split(',').map(r => {
            const parts = r.split(':');
            if (parts.length === 2) return { target: parts[0].trim(), type: parts[1].trim() };
            return null;
        }).filter(r => r);
    }

    saveAllData();
    renderAllViews();
    document.getElementById('edit-modal').classList.add('hidden');
}

function deleteCurrentItem() {
    if (!currentEditingItem) return;
    if (!confirm("Are you sure you want to delete this?")) return;
    
    if (currentEditingType === 'persona') {
        state.personas = state.personas.filter(p => p.id !== currentEditingItem.id);
    } else {
        state.worldBible = state.worldBible.filter(w => w.id !== currentEditingItem.id);
    }
    
    saveAllData();
    renderAllViews();
    document.getElementById('edit-modal').classList.add('hidden');
}

function openMergeModal() {
    const modal = document.getElementById('merge-modal');
    const select = document.getElementById('merge-target-list');
    modal.classList.remove('hidden');
    
    let list = currentEditingType === 'persona' ? state.personas : state.worldBible;
    select.innerHTML = list
        .filter(item => item.id !== currentEditingItem.id)
        .map(item => `<option value="${item.id}">${item.name}</option>`)
        .join('');
}

function confirmMerge() {
    const targetId = parseFloat(document.getElementById('merge-target-list').value);
    let list = currentEditingType === 'persona' ? state.personas : state.worldBible;
    const targetItem = list.find(item => item.id === targetId);
    
    if (targetItem && currentEditingItem) {
        // Append data
        targetItem.description = (targetItem.description || "") + "\n\n--- Merged from " + currentEditingItem.name + " ---\n" + (currentEditingItem.description || currentEditingItem.bio || "");
        if (currentEditingType === 'persona') {
            targetItem.traits = [...new Set([...(targetItem.traits || []), ...(currentEditingItem.traits || [])])];
            targetItem.bio = targetItem.description;
            targetItem.appearance = (targetItem.appearance || "") + " " + (currentEditingItem.appearance || "");
            targetItem.history = (targetItem.history || "") + " " + (currentEditingItem.history || "");
        }
        
        // Delete source
        if (currentEditingType === 'persona') {
            state.personas = state.personas.filter(p => p.id !== currentEditingItem.id);
        } else {
            state.worldBible = state.worldBible.filter(w => w.id !== currentEditingItem.id);
        }
        
        saveAllData();
        renderAllViews();
        document.getElementById('merge-modal').classList.add('hidden');
        document.getElementById('edit-modal').classList.add('hidden');
        alert("Merged successfully into " + targetItem.name);
    }
}

// AI Functions with Project Context
function getProjectContext() {
    let context = "PROJECT CONTEXT:\n\n";
    
    context += "CHARACTERS:\n";
    state.personas.forEach(p => {
        context += `- ${p.name} (Role: ${p.role}). Traits: ${p.traits?.join(', ')}. Bio: ${p.bio || p.description}\n`;
        if (p.appearance) context += `  Appearance: ${p.appearance}\n`;
        if (p.motivation) context += `  Motivation: ${p.motivation}\n`;
        if (p.history) context += `  Background: ${p.history}\n`;
        if (p.spouse) context += `  Spouse: ${p.spouse}\n`;
        const pList = p.parents || (p.parent ? [p.parent] : []);
        if (pList.length > 0) context += `  Parents: ${pList.join(', ')}\n`;
    });
    
    context += "\nWORLD LORE & LOCATIONS:\n";
    state.worldBible.forEach(w => {
        context += `- ${w.name}: ${w.description}\n`;
    });
    
    context += "\nSTORY TIMELINE:\n";
    state.timeline.forEach(t => {
        context += `- ${t.date}: ${t.event}\n`;
    });
    
    return context;
}
async function aiGenerateCharacter() {
    const providerLabel = state.settings.aiProvider === 'gemini' ? 'Gemini' : `Ollama (${state.settings.ollamaModel})`;
    
    if (state.settings.aiProvider === 'gemini' && !state.settings.geminiKey) {
        addSuggestion("⚠️ Please add your Gemini API Key in Settings.", "error");
        return;
    }

    addSuggestion(`✨ Summoning a character via ${providerLabel}...`, "loading");

    try {
        const prompt = `Generate a unique character for a story. 
        Return ONLY a JSON object: {
            "name": "Name", 
            "role": "Role", 
            "traits": ["Trait1", "Trait2"], 
            "bio": "Bio",
            "parent": "Name of an existing character if applicable or leave empty"
        }`;
        const responseText = await callAI(prompt);
        
        // Extract JSON from response (handling potential markdown)
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const charData = JSON.parse(jsonMatch[0]);
            const newChar = { id: Date.now(), ...charData };
            state.personas.push(newChar);
            saveAllData();
            renderPersonas();
            removeLoading();
            addSuggestion(`Met <b>${newChar.name}</b>! Added to your personas.`, "idea");
        } else {
            throw new Error("AI did not return valid JSON format.");
        }
    } catch (err) {
        console.error(err);
        removeLoading();
        addSuggestion(`❌ Generation failed: ${err.message}`, "error");
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

    addSuggestion("✨ Analyzing your story and project context...", "loading");

    try {
        const context = getProjectContext();
        const storyText = editor.innerText.slice(-2000);
        
        const response = await callAI(`
            ${context}
            
            Current Story Content: "${storyText}"
            
            TASK: Suggest 3 creative next steps for the story. Ensure they follow character motivations and world rules documented above.
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
    if (!state.settings.ollamaModel) {
        throw new Error("No Ollama model selected. Please select a model in Settings.");
    }
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
        if (data.error) throw new Error(data.error);
        return data.response || data.message?.content || "";
    } catch (err) {
        throw new Error(`Ollama Error: ${err.message}. Is it running? (http://localhost:11434)`);
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
    // Try v1beta first as it's more inclusive for flash models
    const model = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${state.settings.geminiKey}`;
    
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
            // Check for safety ratings or errors in the response body
            if (data.promptFeedback?.blockReason) {
                throw new Error(`Content Blocked: The AI blocked this request due to safety filters (${data.promptFeedback.blockReason}). Try rephrasing.`);
            }
            if (data.error) {
                throw new Error(`Gemini Error: ${data.error.message || 'Unknown Error'}`);
            }
            throw new Error("No response generated. The AI might have found the content sensitive or complex.");
        }

        const candidate = data.candidates[0];
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            const finishReason = candidate.finishReason || "Unknown";
            throw new Error(`AI failed to provide content. Finish Reason: ${finishReason}`);
        }

        return candidate.content.parts[0].text || "";
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
let stagedIngestData = null;

async function startAIIngest() {
    const text = document.getElementById('ingest-text').value;
    if (!text.trim()) {
        addSuggestion("⚠️ Please paste some text first.", "error");
        return;
    }

    addSuggestion("🧠 AI is deep-diving, mapping family structures, and suggesting chapters...", "loading");

    const prompt = `
        Analyze the following story text. 
        1. Extract characters: Include FULL family mapping (who is whose parent/child/spouse).
        2. Extract locations.
        3. Suggest a chapter structure.
        
        Return ONLY a JSON object:
        {
          "characters": [{"name": "Name", "role": "Role", "traits": ["Trait1"], "bio": "Bio", "parent": "ParentName", "spouse": "SpouseName", "goal": "Goal", "conflict": "Conflict"}],
          "locations": [{"name": "Name", "description": "Description"}],
          "chapters": [{"title": "Chapter Name", "points": [{"content": "Scene beat"}]}]
        }
        
        IMPORTANT: In the "parent" and "spouse" fields, use names from THIS extracted list if they are mentioned together.
        
        Text to analyze:
        ${text}
    `;

    try {
        const responseText = await callAI(prompt);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : responseText;
        const data = JSON.parse(jsonString);
        
        stagedIngestData = data;
        renderStagingArea(data);
        
        document.getElementById('ingest-results').classList.remove('hidden');
        removeLoading();
        addSuggestion("Analysis complete! Review the list below to choose what to import.", "idea");
    } catch (err) {
        removeLoading();
        addSuggestion(`❌ Ingest failed: ${err.message}`, "error");
    }
}

function renderStagingArea(data) {
    const area = document.getElementById('ingest-staging-area');
    let html = "";

    if (data.characters?.length) {
        html += `<h4>Characters</h4>`;
        data.characters.forEach((c, i) => {
            html += `<label class="staging-item"><input type="checkbox" checked data-type="persona" data-idx="${i}"> ${c.name} (${c.role})</label>`;
        });
    }

    if (data.locations?.length) {
        html += `<h4>World Bible</h4>`;
        data.locations.forEach((l, i) => {
            html += `<label class="staging-item"><input type="checkbox" checked data-type="world" data-idx="${i}"> ${l.name}</label>`;
        });
    }

    if (data.chapters?.length) {
        html += `<h4>Suggested Chapters</h4>`;
        data.chapters.forEach((ch, i) => {
            html += `
                <div class="staging-chapter">
                    <label><input type="checkbox" checked data-type="chapter" data-idx="${i}"> <b>${ch.title}</b></label>
                    <div style="margin-left: 20px; font-size: 0.8rem; color: var(--text-secondary);">
                        ${ch.points.map(p => `• ${p.content}`).join('<br>')}
                    </div>
                </div>`;
        });
    }

    area.innerHTML = html;
}

document.getElementById('confirm-ingest-btn').addEventListener('click', confirmIngest);

function confirmIngest() {
    if (!stagedIngestData) return;
    
    const selected = Array.from(document.querySelectorAll('#ingest-staging-area input:checked'));
    
    selected.forEach(input => {
        const type = input.getAttribute('data-type');
        const idx = parseInt(input.getAttribute('data-idx'));
        
        if (type === 'persona') {
            const c = stagedIngestData.characters[idx];
            state.personas.push({ id: Date.now() + Math.random(), ...c });
        } else if (type === 'world') {
            const l = stagedIngestData.locations[idx];
            state.worldBible.push({ id: Date.now() + Math.random(), ...l });
        } else if (type === 'chapter') {
            const ch = stagedIngestData.chapters[idx];
            state.chapters.push({ id: 'ch_' + Date.now() + Math.random(), ...ch });
        }
    });

    saveAllData();
    renderAllViews();
    document.getElementById('ingest-results').classList.add('hidden');
    document.getElementById('ingest-text').value = "";
    addSuggestion("✅ Imported selected items successfully!", "idea");
}


async function aiCheckConsistency() {
    if (state.settings.aiProvider === 'gemini' && !state.settings.geminiKey) {
        addSuggestion("⚠️ Please add your Gemini API Key in Settings.", "error");
        return;
    }

    addSuggestion("⚖️ Checking consistency with characters and lore...", "loading");

    try {
        const context = getProjectContext();
        const storyText = editor.innerText.slice(-3000); // Check a larger chunk
        
        const response = await callAI(`
            ${context}
            
            Current Draft Section: "${storyText}"
            
            TASK: Act as a continuity and character arc editor. 
            1. Check for contradictions in traits or lore.
            2. Evaluate Character Progression: Are characters moving toward their listed GOALS? Are they facing their CONFLICTS?
            3. Archetype Check: Is the character behavior consistent with their established role?
            
            If everything is flawless, say "The draft is consistent." 
            Otherwise, list specific issues and suggestions for improvement.
        `);
        removeLoading();
        addSuggestion("<b>Consistency Check:</b><br>" + response, "idea");
    } catch (err) {
        removeLoading();
        addSuggestion(`❌ AI Error: ${err.message}`, "error");
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
