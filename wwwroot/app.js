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
    rules: [],
    bookmarks: [],
    scratchpad: "",
    chapters: [{ id: 'ch1', title: 'Chapter 1', content: "", points: [] }],
    currentChapterId: 'ch1',
    activeSidebar: null,
    proMode: false,
    settings: {
        aiProvider: localStorage.getItem('inkweaver_ai_provider') || 'gemini',
        geminiKey: localStorage.getItem('inkweaver_gemini_key') || '',
        ollamaModel: localStorage.getItem('inkweaver_ollama_model') || 'llama3',
        projectPath: localStorage.getItem('inkweaver_project_path') || '',
        dbPath: localStorage.getItem('inkweaver_db_path') || ''
    }
};

// Selectors
const editor = document.getElementById('editor');
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const aiBrainstormBtn = document.getElementById('ai-brainstorm');
const suggestionContainer = document.getElementById('suggestion-container');

function openSettings() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    document.getElementById('gemini-key').value = state.settings.geminiKey || "";
    document.getElementById('ai-provider').value = state.settings.aiProvider;
    document.getElementById('ollama-model').value = state.settings.ollamaModel;
    refreshOllamaModels();
}

window.openSettings = openSettings;

// Initialization
function init() {
    loadAllData();
    setupEventListeners();
    renderAllViews();
}

function safeOn(id, event, cb) {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, cb);
}

function setupEventListeners() {
    // Editor sync
    editor.addEventListener('input', () => {
        state.currentDraft.content = editor.innerHTML;
        
        // Dynamic Title Sync: First H1 becomes Chapter Title
        const h1 = editor.querySelector('h1');
        if (h1) {
            const newTitle = h1.innerText.trim() || "Untitled Chapter";
            if (newTitle !== state.currentDraft.title) {
                state.currentDraft.title = newTitle;
                const activeCh = state.chapters.find(c => c.id === state.currentChapterId);
                if (activeCh) activeCh.title = newTitle;
                
                // Sync to Outlines Sidebar if open
                const chOutline = document.querySelector(`.chapter-block[data-ch-id="${state.currentChapterId}"] .chapter-title-edit`);
                if (chOutline) chOutline.value = newTitle;
                
                renderEditorNav();
            }
        }
        
        saveAllData();
        updateWordCounts();
    });

    editor.addEventListener('mouseup', updateSelectionActions);
    document.addEventListener('selectionchange', updateSelectionActions);

    // Sidebar View Switching
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.addEventListener('click', () => {
            const view = li.getAttribute('data-view');
            switchView(view);
        });
    });

    // Unified Sidebar Buttons
    safeOn('add-character-btn-sw', 'click', () => createObject('persona'));
    safeOn('ai-generate-character-sw', 'click', generateAICharacter);
    safeOn('add-lore-btn-sw', 'click', () => createObject('world'));
    safeOn('add-plot-point', 'click', addPlotPointToChapter);
    safeOn('add-chapter-btn', 'click', addChapter);
    safeOn('add-event', 'click', () => createObject('timeline'));
    safeOn('add-rule', 'click', () => createObject('rule'));
    safeOn('ai-regroup-outline', 'click', aiSmartGroupOutline);
    safeOn('ai-suggest-scene', 'click', aiSuggestNextScene);
    safeOn('consistency-btn', 'click', aiCheckPlotIntegrity);
    safeOn('plot-integrity-btn', 'click', aiCheckPlotIntegrity);

    // Modals
    safeOn('refresh-models-btn', 'click', refreshOllamaModels);
    safeOn('test-ollama', 'click', testOllamaConnection);
    safeOn('ai-brainstorm', 'click', generateIdea);
    safeOn('test-ollama', 'click', testOllamaConnection);
    safeOn('ai-brainstorm', 'click', generateIdea);

    // Edit Modal Listeners - Removed in favor of direct HTML onclicks for stability
    
    // Misc
    safeOn('chapter-select', 'change', (e) => switchToChapter(e.target.value));
    safeOn('send-chat', 'click', handleAIChat);
    safeOn('chat-input', 'keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleAIChat();
        }
    });

    if (window.chrome?.webview) {
        window.chrome.webview.addEventListener('message', handleNativeMessage);
    }

    // Scratchpad sync
    safeOn('scratchpad-editor', 'input', (e) => {
        state.scratchpad = e.target.value;
        saveAllData();
    });

    // File Interop / DB
    safeOn('select-project-btn', 'click', () => openFilePicker({ mode: 'open', type: 'project', title: 'Open Project (.ink)' }));
    safeOn('new-project-btn', 'click', () => openFilePicker({ mode: 'save', type: 'project', title: 'Create New Project' }));
    safeOn('select-db-btn', 'click', () => openFilePicker({ mode: 'open', type: 'db', title: 'Link Existing SQLite Database' }));
    safeOn('create-db-btn', 'click', () => openFilePicker({ mode: 'save', type: 'db', title: 'Create New SQLite Database' }));
    
    // Picker UI
    safeOn('close-picker', 'click', closeFilePicker);
    safeOn('cancel-picker', 'click', closeFilePicker);
    safeOn('picker-up-btn', 'click', () => window.chrome.webview.postMessage("list_dir|UP"));
    safeOn('picker-home-btn', 'click', () => window.chrome.webview.postMessage("get_user_home"));
    safeOn('picker-drives-btn', 'click', () => window.chrome.webview.postMessage("list_dir|DRIVES"));
    // Nuclear Full Screen on First Click (Bypass Security Restrictions)
    document.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(e => console.warn("Fullscreen auto-trigger blocked: ", e));
        }
    }, { once: true });

    // Native Shell Full Screen on Load (with slight delay for shell readiness)
    if (window.chrome?.webview) {
        setTimeout(() => {
            window.chrome.webview.postMessage("window_state|fullscreen");
            window.chrome.webview.postMessage("window_maximize");
            window.chrome.webview.postMessage("maximize");
            window.chrome.webview.postMessage("window_state|maximized");
        }, 300); // 300ms for safety
    }
}

function handleNativeMessage(event) {
    const msg = event.data;
    if (msg.type === 'file_selected') {
        try {
            const data = JSON.parse(msg.data);
            applyProjectData(data);
            state.settings.projectPath = msg.path;
            localStorage.setItem('inkweaver_project_path', msg.path);
            document.getElementById('current-project-path').innerText = msg.path;
            addSuggestion("✅ Project loaded from: " + msg.path, "idea");
            closeFilePicker();
        } catch (e) {
            alert("Failed to parse project file: " + e.message);
            closeFilePicker();
        }
    } else if (msg.type === 'project_created') {
        state.settings.projectPath = msg.path;
        localStorage.setItem('inkweaver_project_path', msg.path);
        document.getElementById('current-project-path').innerText = msg.path;
        saveAllData();
        addSuggestion("🆕 New project created at: " + msg.path, "idea");
        closeFilePicker();
    } else if (msg.type === 'directory_list') {
        renderPickerList(msg.path, msg.entries);
    } else if (msg.type === 'directory_error') {
        alert("Error accessing folder: " + msg.message);
    } else if (msg.type === 'user_home') {
        state.pickerCurrentPath = msg.path;
        window.chrome.webview.postMessage(`list_dir|${msg.path}`);
    } else if (msg.type === 'db_selected') {
        state.settings.dbPath = msg.path;
        localStorage.setItem('inkweaver_db_path', msg.path);
        document.getElementById('current-db-path').innerText = msg.path;
        if (msg.data) {
            try {
                const data = JSON.parse(msg.data);
                applyProjectData(data);
                addSuggestion("🗄️ Database linked and data loaded.", "idea");
                closeFilePicker();
            } catch (e) {
                console.error("DB Parse Error:", e);
                alert("Database contains invalid data format. Starting fresh.");
                saveAllData();
                closeFilePicker();
            }
        } else {
            saveAllData(); // Seed the new DB
            addSuggestion("🗄️ New database created and initialized.", "idea");
            closeFilePicker();
        }
    }
}

// Picker Logic
state.pickerSession = null;
state.pickerCurrentPath = "";
state.pickerSelection = "";

function openFilePicker(options) {
    state.pickerSession = options;
    document.getElementById('picker-title').innerText = options.title;
    document.getElementById('file-picker-modal').classList.remove('hidden');
    
    if (options.mode === 'save') {
        document.getElementById('picker-save-ui').classList.remove('hidden');
        document.getElementById('picker-filename').value = options.type === 'db' ? 'my_project.db' : 'story.ink';
    } else {
        document.getElementById('picker-save-ui').classList.add('hidden');
    }

    if (window.chrome?.webview) {
        if (!state.pickerCurrentPath) {
            window.chrome.webview.postMessage("get_user_home");
        } else {
            window.chrome.webview.postMessage(`list_dir|${state.pickerCurrentPath}`);
        }
    } else {
        alert("File browsing requires the Desktop Shell.");
    }
}

function closeFilePicker() {
    document.getElementById('file-picker-modal').classList.add('hidden');
}

function renderPickerList(path, entries) {
    state.pickerCurrentPath = path;
    document.getElementById('current-picker-path').innerText = path;
    const list = document.getElementById('picker-list');
    
    // Sort directories first
    entries.sort((a,b) => b.isDir - a.isDir || a.name.localeCompare(b.name));

    list.innerHTML = entries.map(e => `
        <div class="picker-item" onclick="handlePickerClick('${e.path.replace(/\\/g, '\\\\')}', ${e.isDir}, event)">
            <span class="picker-icon">${e.isDir ? '📁' : '📄'}</span>
            <span class="picker-name">${e.name}</span>
        </div>
    `).join('');
}

window.handlePickerClick = (path, isDir, event) => {
    if (isDir) {
        window.chrome.webview.postMessage(`list_dir|${path}`);
    } else {
        // Toggle selection
        document.querySelectorAll('.picker-item').forEach(i => i.classList.remove('selected'));
        event.currentTarget.classList.add('selected');
        state.pickerSelection = path;
        
        if (state.pickerSession.mode === 'save') {
            document.getElementById('picker-filename').value = path.split(/[\\\/]/).pop();
        }
    }
};

function pickerNavigateUp() {
    const parts = state.pickerCurrentPath.split(/[\\\/]/);
    if (parts.length > 1) {
        parts.pop();
        const newPath = parts.join('\\') || parts.join('/');
        window.chrome.webview.postMessage(`list_dir|${newPath}`);
    }
}

function confirmPickerSelection() {
    if (state.pickerSession.mode === 'open') {
        if (!state.pickerSelection) return alert("Please select a file.");
        window.chrome.webview.postMessage(`read_file|${state.pickerSelection}|${state.pickerSession.type}`);
    } else {
        const filename = document.getElementById('picker-filename').value;
        if (!filename) return alert("Please enter a filename.");
        
        const fullPath = state.pickerCurrentPath + "\\" + filename;
        if (state.pickerSession.type === 'db') {
            // Shell handles creation when we "save" to it via the read_file logic if we want to follow existing flow,
            // or we just tell it to start a new DB chain.
            // Let's use save_sqlite directly if it exists, or update shell.
            state.settings.dbPath = fullPath;
            localStorage.setItem('inkweaver_db_path', fullPath);
            document.getElementById('current-db-path').innerText = fullPath;
            saveAllData();
            addSuggestion("🗄️ New database created and linked.", "idea");
            closeFilePicker();
        } else {
            state.settings.projectPath = fullPath;
            localStorage.setItem('inkweaver_project_path', fullPath);
            document.getElementById('current-project-path').innerText = fullPath;
            saveAllData();
            addSuggestion("🆕 New project path set.", "idea");
            closeFilePicker();
        }
    }
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
    const aiSidebar = document.querySelector('.ai-suggestions');
    const outlineSidebar = document.getElementById('outline-sidebar');
    const worldSidebar = document.getElementById('world-sidebar');

    const isTogglingOff = (state.activeSidebar === viewId) && viewId !== 'editor';

    if (isTogglingOff) {
        // Absolute Force-Retraction: Target DOM directly to ensure no CSS can override this
        aiSidebar.classList.remove('hidden');
        aiSidebar.style.display = 'flex';
        
        outlineSidebar.classList.add('hidden');
        outlineSidebar.style.setProperty('display', 'none', 'important');
        
        worldSidebar.classList.add('hidden');
        worldSidebar.style.setProperty('display', 'none', 'important');
        
        document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
        const editorNav = document.querySelector('[data-view="editor"]');
        if (editorNav) editorNav.classList.add('active');
        
        state.activeSidebar = null;
        return;
    }

    // Default Reset Sequence
    aiSidebar.style.display = 'flex';
    aiSidebar.classList.remove('hidden');
    
    outlineSidebar.style.display = 'none';
    outlineSidebar.classList.add('hidden');
    
    worldSidebar.style.display = 'none';
    worldSidebar.classList.add('hidden');

    const isSidebarView = ['outline', 'world', 'persona', 'family', 'timeline', 'rules'].includes(viewId);
    state.activeSidebar = isSidebarView ? viewId : null;

    if (isSidebarView) {
        aiSidebar.classList.add('hidden');
        aiSidebar.style.display = 'none';
        
        if (viewId === 'outline') {
            outlineSidebar.classList.remove('hidden');
            outlineSidebar.style.display = 'flex';
            renderOutline();
        } else {
            worldSidebar.classList.remove('hidden');
            worldSidebar.style.display = 'flex';
            const tabMap = { 
                'persona': { tab: 'personas', title: '🎭 Personas' }, 
                'world': { tab: 'lore', title: '🌍 World Bible' }, 
                'family': { tab: 'family', title: '🌳 Family Tree' },
                'timeline': { tab: 'timeline', title: '⏳ Story Timeline' },
                'rules': { tab: 'rules', title: '🏛️ World Rules' },
                'bookmarks': { tab: 'bookmarks', title: '🔖 Bookmarks' }
            };
            const config = tabMap[viewId] || { tab: 'personas', title: '🎭 Personas' };
            
            // Update the sidebar header dynamically
            const headerTitle = document.getElementById('sidebar-dynamic-title');
            if (headerTitle) headerTitle.innerText = config.title;
            
            switchWorldTab(config.tab);
        }
        
        // Force main view to editor
        state.currentView = 'editor';
        document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
        document.getElementById('view-editor').classList.add('active');
        
        // Highlight correct nav
        const allNavs = document.querySelectorAll('.nav-links li');
        allNavs.forEach(li => li.classList.remove('active'));
        const targetNav = document.querySelector(`[data-view="${viewId}"]`);
        if (targetNav) targetNav.classList.add('active');
        return;
    }

    state.currentView = viewId;
    document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
    
    // Hide all sidebars for 'true' full-page views
    if (['ingest', 'scratchpad'].includes(viewId)) {
        aiSidebar.classList.add('hidden');
        outlineSidebar.classList.add('hidden');
        worldSidebar.classList.add('hidden');
    }

    const target = document.getElementById(`view-${viewId}`);
    if (target) {
        target.classList.add('active');
        if (viewId === 'family') renderFamilyTree();
    }
}

function switchWorldTab(tab) {
    document.querySelectorAll('.world-sub-view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(`sub-${tab}`);
    if (target) target.classList.remove('hidden');
    
    if (tab === 'personas') renderPersonas();
    if (tab === 'lore') renderWorld();
    if (tab === 'timeline') renderTimeline();
    if (tab === 'rules') renderRules();
    if (tab === 'family') renderFamilyTree();
    if (tab === 'bookmarks') renderBookmarks();
}

window.switchWorldTab = switchWorldTab;

// Data Handling
function saveAllData() {
    // Sync current draft to current chapter in array before saving
    const ch = state.chapters.find(c => c.id === state.currentChapterId);
    if (ch) {
        ch.content = editor.innerHTML || "";
    }

    const fullData = {
        currentChapterId: state.currentChapterId,
        personas: state.personas,
        worldBible: state.worldBible,
        timeline: state.timeline,
        chapters: state.chapters,
        rules: state.rules,
        bookmarks: state.bookmarks,
        scratchpad: state.scratchpad
    };

    localStorage.setItem('inkweaver_full_state', JSON.stringify(fullData));

    // Also save to native file if linked
    if (state.settings.projectPath && window.chrome?.webview) {
        window.chrome.webview.postMessage(`save_file|${state.settings.projectPath}|${JSON.stringify(fullData)}`);
    }

    // SQLite Sync
    if (state.settings.dbPath && window.chrome?.webview) {
        window.chrome.webview.postMessage(`save_sqlite|${state.settings.dbPath}|${JSON.stringify(fullData)}`);
    }
}

function loadAllData() {
    if (state.settings.projectPath) {
        document.getElementById('current-project-path').innerText = state.settings.projectPath;
    }
    if (state.settings.dbPath) {
        document.getElementById('current-db-path').innerText = state.settings.dbPath;
        if (window.chrome?.webview) {
            window.chrome.webview.postMessage(`read_file|${state.settings.dbPath}|db`);
        }
    }

    const saved = localStorage.getItem('inkweaver_full_state');
    if (saved) {
        applyProjectData(JSON.parse(saved));
    }
}

function applyProjectData(data) {
    state.personas = data.personas || [];
    state.worldBible = data.worldBible || [];
    state.timeline = data.timeline || [];
    state.chapters = data.chapters || [{ id: 'ch1', title: 'Chapter 1', content: "", points: [] }];
    state.currentChapterId = data.currentChapterId || state.chapters[0].id;
    
    // Force editor to match the current chapter from the array
    const activeCh = state.chapters.find(c => c.id === state.currentChapterId) || state.chapters[0];
    state.currentChapterId = activeCh.id;
    state.currentDraft = { title: activeCh.title, content: activeCh.content || "" };
    
    state.rules = data.rules || [];
    state.bookmarks = data.bookmarks || [];
    state.scratchpad = data.scratchpad || "";

    // Apply to UI
    editor.innerHTML = state.currentDraft.content || "";
    document.getElementById('scratchpad-editor').value = state.scratchpad;
    renderAllViews();
    renderEditorNav();
    updateWordCounts();
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
        case 'rule':
            newObj = { ...newObj, name: "New Rule", interpretation: "1 year in heaven = 7 earth years", category: "Physics" };
            state.rules.push(newObj);
            renderRules();
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
    renderRules();
    renderBookmarks();
    updateAIStatus();
}

function createBookmarkFromSelection() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    const range = selection.getRangeAt(0);
    const id = "bm_" + Date.now();
    const name = prompt("Bookmark Name:", "Important Point") || "Bookmark";
    
    // Create Anchor Span
    const span = document.createElement('span');
    span.id = id;
    span.className = "bookmark-anchor";
    span.innerHTML = "🔖"; // Visual indicator in text
    span.contentEditable = false; // Don't let user type inside it easily
    
    range.insertNode(span);
    
    state.bookmarks.push({
        id: id,
        name: name,
        chapterId: state.currentChapterId
    });
    
    saveAllData();
    renderBookmarks();
    
    // Proactive UI: Switch to bookmarks view to show the user where it went
    switchWorldTab('bookmarks');
    const worldSidebar = document.getElementById('world-sidebar');
    if (worldSidebar.classList.contains('hidden')) {
        switchView('world');
    }

    addSuggestion(`🔖 Bookmark "${name}" created.`, "idea");
}

function renderBookmarks() {
    const container = document.getElementById('bookmarks-list');
    if (!container) return;
    
    if (state.bookmarks.length === 0) {
        container.innerHTML = '<div class="empty-state">No bookmarks set. Highlight text and click 🔖 in selection tools.</div>';
        return;
    }
    
    container.innerHTML = state.bookmarks.map(bm => {
        const chapter = state.chapters.find(c => c.id === bm.chapterId);
        return `
            <div class="sidebar-item-block" onclick="jumpToBookmark('${bm.id}')" style="cursor: pointer;">
                <div class="sidebar-item-header">
                    <div class="sidebar-item-icon">🔖</div>
                    <div class="sidebar-item-content">
                        <div class="sidebar-item-name">${bm.name}</div>
                        <div class="sidebar-item-sub">${chapter ? chapter.title : 'External'}</div>
                    </div>
                    <div class="sidebar-item-actions">
                        <button class="btn-mini" onclick="event.stopPropagation(); deleteBookmark('${bm.id}')">×</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function jumpToBookmark(id) {
    const bm = state.bookmarks.find(b => b.id === id);
    if (!bm) return;
    
    // 1. Switch chapter if needed
    if (bm.chapterId !== state.currentChapterId) {
        switchToChapter(bm.chapterId);
    }
    
    // 2. Scroll to anchor
    setTimeout(() => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            // Flash effect
            el.style.transition = "all 0.5s ease";
            el.style.transform = "scale(2.5)";
            setTimeout(() => el.style.transform = "scale(1)", 500);
        } else {
            addSuggestion("⚠️ Bookmark anchor not found in this chapter's text.", "error");
        }
    }, 100);
}

function deleteBookmark(id) {
    state.bookmarks = state.bookmarks.filter(b => b.id !== id);
    // Also remove from DOM if it exists in current view
    const el = document.getElementById(id);
    if (el) el.remove();
    
    saveAllData();
    renderBookmarks();
}

window.createBookmarkFromSelection = createBookmarkFromSelection;
window.jumpToBookmark = jumpToBookmark;
window.deleteBookmark = deleteBookmark;

function renderPersonas() {
    const container = document.getElementById('persona-list');
    if (state.personas.length === 0) {
        container.innerHTML = '<div class="empty-state">No characters yet.</div>';
        return;
    }
    container.innerHTML = state.personas.map(p => `
        <div class="sidebar-item-block">
            <div class="sidebar-item-header">
                <div class="sidebar-item-icon">👤</div>
                <div class="sidebar-item-content">
                    <div class="sidebar-item-name" contenteditable="true" onblur="updateItemField('personas', ${p.id}, 'name', this.innerText)">${p.name}</div>
                    <div class="sidebar-item-sub" contenteditable="true" onblur="updateItemField('personas', ${p.id}, 'role', this.innerText)">${p.role}</div>
                </div>
                <div class="sidebar-item-actions">
                    <button class="btn-mini" onclick="editPersona(${p.id})">⚙️</button>
                    <button class="btn-mini" onclick="deleteItem('personas', ${p.id})">×</button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderWorld() {
    const container = document.getElementById('world-list');
    if (state.worldBible.length === 0) {
        container.innerHTML = '<div class="empty-state">The world is empty. Create lore.</div>';
        return;
    }
    container.innerHTML = state.worldBible.map(w => `
        <div class="sidebar-item-block">
            <div class="sidebar-item-header">
                <div class="sidebar-item-icon">🌍</div>
                <div class="sidebar-item-content">
                    <div class="sidebar-item-name" contenteditable="true" onblur="updateItemField('worldBible', ${w.id}, 'name', this.innerText)">${w.name}</div>
                    <div class="sidebar-item-sub" contenteditable="true" onblur="updateItemField('worldBible', ${w.id}, 'description', this.innerText)">${w.description || ''}</div>
                </div>
                <div class="sidebar-item-actions">
                    <button class="btn-mini" onclick="editWorld(${w.id})">⚙️</button>
                    <button class="btn-mini" onclick="deleteItem('worldBible', ${w.id})">×</button>
                </div>
            </div>
        </div>
    `).join('');
}

let treeNetwork = null;

function renderFamilyTree() {
    const container = document.getElementById('family-tree-container');
    
    // 1. Filter: Only show people with at least one connection
    const personasWithLinks = state.personas.filter(p => {
        const hasParent = (p.parents && p.parents.length > 0) || p.parent;
        const hasSpouse = p.spouse && p.spouse.trim() !== "";
        const hasChildren = state.personas.some(child => 
            (child.parents && child.parents.some(pn => pn.toLowerCase() === p.name.toLowerCase())) ||
            (child.parent && child.parent.toLowerCase() === p.name.toLowerCase())
        );
        const hasRelationships = p.relationships && p.relationships.length > 0;
        return hasParent || hasSpouse || hasChildren || hasRelationships;
    });

    if (personasWithLinks.length === 0) {
        container.innerHTML = '<div class="empty-state">No connected characters yet. Add family members (Parents/Spouse) or relationships to see the tree. </div>';
        return;
    }

    // 2. Clear container and create board structure
    container.innerHTML = `
        <div class="tree-legend" style="position: absolute; top: 20px; right: 20px; z-index: 10; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(10px);">
            <div class="legend-item"><span class="line solid" style="background:#475569"></span> Lineage</div>
            <div class="legend-item"><span class="line dotted" style="border-top:2px dotted #fbbf24"></span> Spouse</div>
            <div class="legend-item"><span class="line dotted" style="border-top:2px dashed #ffffff"></span> Romance/Affair/ONS</div>
            <div class="legend-item"><span class="line thick" style="background:#10b981"></span> Ally/Friend</div>
            <div class="legend-item"><span class="line dash-arrow" style="border-top:2px dashed #ef4444"></span> Hostile/Enemy</div>
        </div>
        <div id="vis-network-container" class="tree-grid-bg" style="width: 100%; height: 800px; cursor: grab;"></div>
    `;

    const nodesArray = personasWithLinks.map(p => {
        const isLead = p.role?.toLowerCase().includes("pro") || p.role?.toLowerCase().includes("lead");
        
        // Auto-position if no coordinates exist (start from center)
        const x = p.treeX !== undefined ? p.treeX : (Math.random() * 200 - 100);
        const y = p.treeY !== undefined ? p.treeY : (Math.random() * 200 - 100);

        let label = `<b>${p.name}</b>`;
        if (p.role) label += `\n<i>${p.role}</i>`;
        if (p.location) label += `\n<small>📍 ${p.location}</small>`;

        return {
            id: p.id,
            label: label,
            shape: 'box',
            x: x,
            y: y,
            font: { 
                multi: 'html', 
                color: '#ffffff', 
                size: 14,
                face: 'Inter',
                bold: { color: '#ffffff', size: 16 },
                ital: { color: '#94a3b8', size: 12 }
            },
            color: {
                background: isLead ? '#6366f1' : '#1e293b',
                border: isLead ? '#818cf8' : '#475569',
                highlight: { background: '#4f46e5', border: '#818cf8' }
            },
            borderWidth: isLead ? 3 : 1,
            shadow: { enabled: true, color: 'rgba(0,0,0,0.5)', size: 10, x: 5, y: 5 },
            margin: 15
        };
    });

    const edgesArray = [];
    personasWithLinks.forEach(p => {
        const parents = p.parents || (p.parent ? [p.parent] : []);
        parents.forEach(parentName => {
            const parent = personasWithLinks.find(x => x.name.toLowerCase() === parentName.trim().toLowerCase());
            if (parent) {
                edgesArray.push({
                    from: parent.id,
                    to: p.id,
                    arrows: 'to',
                    width: 3,
                    color: { color: '#475569', opacity: 0.8 },
                    smooth: false // STRAIGHT LINES
                });
            }
        });

        if (p.spouse) {
            const spouse = personasWithLinks.find(x => x.name.toLowerCase() === p.spouse.trim().toLowerCase());
            if (spouse && spouse.id > p.id) {
                edgesArray.push({
                    from: p.id,
                    to: spouse.id,
                    dashes: true,
                    width: 4,
                    color: { color: '#fbbf24', opacity: 0.8 },
                    label: 'spouse',
                    font: { size: 10, color: '#fbbf24', align: 'middle' },
                    smooth: false // STRAIGHT LINES
                });
            }
        }

        if (p.relationships) {
            p.relationships.forEach(rel => {
                const target = personasWithLinks.find(x => x.name.toLowerCase() === rel.target.toLowerCase());
                if (target && target.id > p.id) {
                    const type = rel.type.toLowerCase();
                    let edgeColor = '#94a3b8'; // default gray
                    let edgeWidth = 3;
                    let dashed = false;

                    const hostileKeywords = ['enemy', 'foe', 'hates', 'hated', 'rival', 'hostile', 'conflict', 'opponent'];
                    const romanticKeywords = ['affair', 'ons', 'one night', 'relation', 'boyfriend', 'girlfriend', 'lover', 'loves', 'dating', 'romance'];
                    const friendlyKeywords = ['friend', 'ally', 'allied', 'loyal', 'assistant', 'mentor', 'disciple'];

                    if (hostileKeywords.some(k => type.includes(k))) {
                        edgeColor = '#ef4444';
                        edgeWidth = 4;
                        dashed = [5, 5];
                    } else if (friendlyKeywords.some(k => type.includes(k))) {
                        edgeColor = '#10b981';
                        edgeWidth = 4;
                    } else if (romanticKeywords.some(k => type.includes(k))) {
                        edgeColor = '#ffffff'; // White for romantic/spicy relations
                        dashed = [10, 5];
                        edgeWidth = 4;
                    }

                    edgesArray.push({ 
                        from: p.id, 
                        to: target.id, 
                        width: edgeWidth, 
                        color: edgeColor, 
                        dashes: dashed, 
                        label: rel.type, 
                        font: { color: edgeColor, strokeWidth: 0, size: 11 },
                        smooth: false // STRAIGHT LINES
                    });
                }
            });
        }
    });

    const nodes = new vis.DataSet(nodesArray);
    const edges = new vis.DataSet(edgesArray);
    const visContainer = document.getElementById('vis-network-container');
    const data = { nodes, edges };
    
    const options = {
        physics: { enabled: false },
        interaction: {
            dragNodes: true,
            dragView: true,
            zoomView: true,
            hover: true
        },
        edges: {
            smooth: false // GLOBAL STRAIGHT LINES
        }
    };

    treeNetwork = new vis.Network(visContainer, data, options);

    // SNAP TO GRID Logic
    const GRID_SIZE = 50;
    treeNetwork.on("dragEnd", function (params) {
        if (params.nodes.length > 0) {
            const nodeId = params.nodes[0];
            const nodePos = treeNetwork.getPositions([nodeId])[nodeId];
            
            // Calculate grid snap
            const snappedX = Math.round(nodePos.x / GRID_SIZE) * GRID_SIZE;
            const snappedY = Math.round(nodePos.y / GRID_SIZE) * GRID_SIZE;
            
            // Move node to grid
            nodes.update({ id: nodeId, x: snappedX, y: snappedY });
            
            // Save position to state
            const targetChar = state.personas.find(p => p.id === nodeId);
            if (targetChar) {
                targetChar.treeX = snappedX;
                targetChar.treeY = snappedY;
                saveAllData(); 
            }
        }
    });

    treeNetwork.on("doubleClick", function (params) {
        if (params.nodes.length > 0) editPersona(params.nodes[0]);
    });

    document.getElementById('reset-tree-view').addEventListener('click', () => {
        treeNetwork.fit();
    });
}

function renderOutline() {
    const container = document.getElementById('outline-list');
    if (!state.chapters) state.chapters = [{ id: 'ch1', title: 'Chapter 1', points: [] }];
    
    container.innerHTML = state.chapters.map((ch, chIdx) => `
        <div class="chapter-block ${ch.id === state.currentChapterId ? 'active' : ''}" data-ch-id="${ch.id}" onclick="switchToChapter('${ch.id}')" style="cursor: pointer;">
            <div class="chapter-header">
                <input type="text" class="chapter-title-edit" value="${ch.title}" onchange="updateChapterTitle('${ch.id}', this.value)" onclick="event.stopPropagation()">
                <button onclick="event.stopPropagation(); deleteChapter('${ch.id}')" class="btn-mini">🗑️</button>
            </div>
            <div class="plot-points-container" ondrop="drop(event, '${ch.id}')" ondragover="allowDrop(event)">
                ${ch.points.length === 0 ? '<div class="empty-drop">Drop points here...</div>' : ch.points.map((p, pIdx) => `
                    <div class="plot-point sortable ${p.isContradiction ? 'contradiction' : ''}" draggable="true" ondragstart="drag(event, '${ch.id}', ${pIdx})">
                        <div class="point-content">
                            <div contenteditable="true" onblur="updatePlotPointContent('${ch.id}', ${pIdx}, this.innerText)">${p.content}</div>
                            ${p.isContradiction ? `<div class="contradiction-note">⚠️ ${p.contradictionNote}</div>` : ''}
                        </div>
                        <div style="display: flex; gap: 5px; align-items: center;">
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
    renderEditorNav();
    
    // If we're editing the title of the CURRENTLY active chapter in the editor, update the internal state
    if (id === state.currentChapterId) {
        state.currentDraft.title = val;
    }
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

async function aiSmartGroupOutline() {
    addSuggestion("🧠 Re-organizing outline and checking for plot holes...", "loading");
    
    try {
        const context = getProjectContext();
        const currentOutline = state.chapters.map(ch => ({
            title: ch.title,
            points: ch.points.map(p => p.content)
        }));

        const prompt = `
            ${context}
            
            CURRENT OUTLINE:
            ${JSON.stringify(currentOutline, null, 2)}
            
            TASK:
            1. Group logically connected plot points into sensible chapters.
            2. Sort these chapters and points into a clear chronological narrative.
            3. Identify any points that CONTRADICT the characters' motivations, traits, previous events, OR the established WORLD RULES (e.g. time dilation, magic limits, etc).
            
            Return ONLY a JSON object:
            {
              "chapters": [
                {
                  "title": "Chapter Title",
                  "points": [
                    {
                      "content": "Scene description",
                      "isContradiction": false,
                      "contradictionNote": "Why it contradicts (if applicable)"
                    }
                  ]
                }
              ]
            }
        `;

        const responseText = await callAI(prompt);
        const data = parseAIJSON(responseText);
        
        if (data && data.chapters) {
            if (confirm("The AI has suggested a new structure for your outline. Apply changes?")) {
                state.chapters = data.chapters.map(ch => ({
                    id: 'ch_' + Date.now() + Math.random(),
                    title: ch.title,
                    points: ch.points
                }));
                saveAllData();
                renderOutline();
                addSuggestion("Outline re-organized and checked for consistency.", "idea");
            }
        }
        removeLoading();
    } catch (err) {
        removeLoading();
        addSuggestion("Re-grouping failed: " + err.message, "error");
    }
}

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
    if (!container) return;
    if (state.timeline.length === 0) {
        container.innerHTML = '<div class="empty-state">No events yet.</div>';
        return;
    }
    container.innerHTML = state.timeline.map(t => `
        <div class="sidebar-item-block">
            <div class="sidebar-item-header">
                <div class="sidebar-item-icon">📅</div>
                <div class="sidebar-item-content">
                    <div class="sidebar-item-name" contenteditable="true" onblur="updateItemField('timeline', ${t.id}, 'date', this.innerText)">${t.date}</div>
                    <div class="sidebar-item-sub" contenteditable="true" onblur="updateItemField('timeline', ${t.id}, 'event', this.innerText)">${t.event}</div>
                </div>
                <div class="sidebar-item-actions">
                    <button class="btn-mini" onclick="deleteItem('timeline', ${t.id})">×</button>
                </div>
            </div>
        </div>
    `).join('');
}

function renderRules() {
    const container = document.getElementById('rules-list');
    if (!container) return;
    if (state.rules.length === 0) {
        container.innerHTML = '<div class="empty-state">No rules defined.</div>';
        return;
    }
    container.innerHTML = state.rules.map(r => `
        <div class="sidebar-item-block">
            <div class="sidebar-item-header">
                <div class="sidebar-item-icon">🏛️</div>
                <div class="sidebar-item-content">
                    <div class="sidebar-item-name" contenteditable="true" onblur="updateItemField('rules', ${r.id}, 'name', this.innerText)">${r.name}</div>
                    <div class="sidebar-item-sub" contenteditable="true" onblur="updateItemField('rules', ${r.id}, 'interpretation', this.innerText)">${r.interpretation}</div>
                </div>
                <div class="sidebar-item-actions">
                    <button class="btn-mini" onclick="editRule(${r.id})">⚙️</button>
                    <button class="btn-mini" onclick="deleteItem('rules', ${r.id})">×</button>
                </div>
            </div>
        </div>
    `).join('');
}

window.updateItemField = (store, id, field, value) => {
    const list = state[store];
    const item = list.find(i => i.id == id);
    if (item) {
        item[field] = value;
        saveAllData();
    }
};

window.deleteItem = (store, id) => {
    if (!confirm("Delete this item?")) return;
    state[store] = state[store].filter(i => i.id != id);
    saveAllData();
    renderAllViews();
};

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
    document.getElementById('steckbrief-section').classList.remove('hidden');
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
    document.getElementById('edit-location').value = p.location || "";
}

function editWorld(id) {
    const w = state.worldBible.find(item => item.id === id);
    if (!w) return;
    
    currentEditingItem = w;
    currentEditingType = 'world';
    
    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('edit-modal-title').innerText = "Edit Lore: " + w.name;
    document.getElementById('persona-fields').classList.add('hidden');
    document.getElementById('steckbrief-section').classList.add('hidden');
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

function editRule(id) {
    const r = state.rules.find(item => item.id === id);
    if (!r) return;

    currentEditingItem = r;
    currentEditingType = 'rule';

    document.getElementById('edit-modal').classList.remove('hidden');
    document.getElementById('edit-modal-title').innerText = "Edit Rule: " + r.name;
    document.getElementById('persona-fields').classList.add('hidden');
    document.getElementById('steckbrief-section').classList.add('hidden');
    document.getElementById('edit-desc-label').innerText = "Interpretation";

    document.getElementById('edit-name').value = r.name || "";
    document.getElementById('edit-role').value = r.category || ""; // Re-use role field for category
    document.getElementById('edit-description').value = r.interpretation || "";
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
            if (parts.length === 2) {
                const p1 = parts[0].trim();
                const p2 = parts[1].trim();
                
                // Smart Detection: check if either part matches an existing character name (partial match included)
                const p1Match = state.personas.find(p => p.name.toLowerCase() === p1.toLowerCase() || p.name.toLowerCase().startsWith(p1.toLowerCase()));
                const p2Match = state.personas.find(p => p.name.toLowerCase() === p2.toLowerCase() || p.name.toLowerCase().startsWith(p2.toLowerCase()));

                if (p2Match && !p1Match) {
                    return { target: p2Match.name, type: p1 };
                }
                // Default to p1 as target, but use the full name if a match was found
                return { target: p1Match ? p1Match.name : p1, type: p2 };
            }
            return null;
        }).filter(r => r);
        currentEditingItem.location = document.getElementById('edit-location').value;
    }

    if (currentEditingType === 'rule') {
        currentEditingItem.category = document.getElementById('edit-role').value;
        currentEditingItem.interpretation = document.getElementById('edit-description').value;
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
    } else if (currentEditingType === 'world') {
        state.worldBible = state.worldBible.filter(w => w.id !== currentEditingItem.id);
    } else if (currentEditingType === 'rule') {
        state.rules = state.rules.filter(r => r.id !== currentEditingItem.id);
    } else {
        // Fallback for any other unhandled types, or if 'world' was previously caught here
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
    
    context += "\nWORLD RULES:\n";
    state.rules.forEach(r => {
        context += `- Rule: ${r.name}. Interpretation: ${r.interpretation} (Category: ${r.category})\n`;
    });

    context += "\nSCRATCHPAD / NOTES / LAWS:\n";
    context += state.scratchpad + "\n";

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
        const charData = parseAIJSON(responseText);
        
        if (charData) {
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

function parseAIJSON(text) {
    try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
             throw new Error("AI response did not contain a JSON block (curly braces missing).");
        }
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        console.error("Failed to parse AI JSON. Raw text:", text);
        // Fallback for minor syntax errors or truncated responses
        try {
            // Try to fix common issues like trailing commas or missing quotes for simple cases
            // (Minimal fix to avoid over-complicating)
            const cleaned = text.trim();
            if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
                return JSON.parse(cleaned);
            }
        } catch (e2) {}
        throw new Error("AI returned malformed data. Please try again.");
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

async function refreshOllamaModels() {
    const btn = document.getElementById('refresh-models-btn');
    const select = document.getElementById('ollama-model-select');
    btn.innerText = "⏳";

    try {
        const response = await fetch("http://127.0.0.1:11434/api/tags");
        if (!response.ok) throw new Error("Ollama not responding");
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
        
        addSuggestion("✅ Ollama models refreshed.", "idea");
    } catch (err) {
        addSuggestion("❌ Could not fetch Ollama models. Ensure it is running and CORS is enabled.", "error");
        console.error(err);
    } finally {
        btn.innerText = "🔄";
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
        Analyze the following story text (ideas, notes, or draft).

        TASK:
        1. Extract and Group: Organize these thoughts into characters, locations, and a chronological story outline.
        2. Identify Contradictions: Find any plot holes or logic gaps in the provided text.
        3. Fill the Gaps: Suggest new ideas to make the story more sensible and complete.

        Return ONLY a JSON object:
        {
          "characters": [{"name": "Name", "role": "Role", "traits": ["Trait1"], "bio": "Bio", "parent": "ParentName", "spouse": "SpouseName", "goal": "Goal", "conflict": "Conflict"}],
          "locations": [{"name": "Name", "description": "Description"}],
          "chapters": [{"title": "Chapter Name", "points": [{"content": "Scene beat", "isIdea": false}]}],
          "contradictions": [{"description": "Contradiction description", "impact": "minor/major"}],
          "suggestions": [{"content": "New idea to bridge a gap", "reason": "Why this was added"}]
        }

        IMPORTANT: 
        - The "chapters" should represent a sorted, sensible chronological story outline.
        - In the chapter "points", set "isIdea" to TRUE if the point is a suggested AI addition, and FALSE if it's based on existing text.
        - Use "contradictions" to highlight plot holes.

        Text to analyze:
        ${text}
    `;

    try {
        const responseText = await callAI(prompt);
        const data = parseAIJSON(responseText);
        
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

    if (data.contradictions?.length) {
        html += `<h4>Plot Holes & Contradictions</h4>`;
        data.contradictions.forEach((c, i) => {
            html += `<div class="staging-contradiction"><b>[${c.impact.toUpperCase()}]</b> ${c.description}</div>`;
        });
    }

    if (data.suggestions?.length) {
        html += `<h4>Brainstorming Suggestions</h4>`;
        data.suggestions.forEach((s, i) => {
            html += `<label class="staging-item staging-suggestion"><input type="checkbox" checked data-type="suggestion" data-idx="${i}"> <b>IDEA:</b> ${s.content}<br><small style="opacity: 0.7;">${s.reason}</small></label>`;
        });
    }

    if (data.chapters?.length) {
        html += `<h4>Sorted Story Outline</h4>`;
        data.chapters.forEach((ch, i) => {
            html += `
                <div class="staging-chapter">
                    <label><input type="checkbox" checked data-type="chapter" data-idx="${i}"> <b>${ch.title}</b></label>
                    <div style="margin-left: 20px; font-size: 0.8rem; color: var(--text-secondary);">
                        ${ch.points.map(p => `
                            <div>
                                ${p.isIdea ? '<span style="color: #a855f7; font-weight: bold;">[IDEA]</span>' : '•'} 
                                ${p.content}
                            </div>
                        `).join('')}
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
            // Mark ideas when importing to the actual state
            const processedPoints = ch.points.map(p => ({
                ...p,
                content: p.isIdea ? `✨ [IDEA] ${p.content}` : p.content
            }));
            state.chapters.push({ id: 'ch_' + Date.now() + Math.random(), title: ch.title, points: processedPoints });
        } else if (type === 'suggestion') {
            const s = stagedIngestData.suggestions[idx];
            let brainstormCh = state.chapters.find(c => c.title === "AI Brainstorming");
            if (!brainstormCh) {
                brainstormCh = { id: 'ch_brainstorm_' + Date.now(), title: "AI Brainstorming", points: [] };
                state.chapters.push(brainstormCh);
            }
            brainstormCh.points.push({ content: `✨ [IDEA] ${s.content}`, isIdea: true });
        }
    });

    // Handle contradictions by posting them to the suggestion container as warnings
    if (stagedIngestData.contradictions?.length) {
        stagedIngestData.contradictions.forEach(c => {
            addSuggestion(`⚠️ <b>Contradiction:</b> ${c.description}`, "error");
        });
    }

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
            1. Check for contradictions in traits, lore, OR World Rules (especially time/distance calculations).
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

window.toggleHeading = (tagName) => {
    editor.focus();
    // Check if current block is already the tag, if so, toggle back to div/p
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    
    let parent = selection.getRangeAt(0).commonAncestorContainer;
    if (parent.nodeType !== 1) parent = parent.parentNode;
    
    const isCurrent = parent.closest(tagName);
    if (isCurrent) {
        document.execCommand('formatBlock', false, 'div');
    } else {
        document.execCommand('formatBlock', false, tagName);
    }
};

window.insertMarkdown = (syntax) => {
    editor.focus();
    document.execCommand('insertText', false, syntax);
};

function updateWordCounts() {
    const chapterText = document.getElementById('editor').innerText || "";
    const chapterWords = chapterText.trim() ? chapterText.trim().split(/\s+/).length : 0;
    const chapterLetters = chapterText.length;

    document.getElementById('chapter-words').innerText = chapterWords;
    document.getElementById('chapter-letters').innerText = chapterLetters;

    // Document Totals
    let totalWords = chapterWords;
    let totalLetters = chapterLetters;

    state.chapters.forEach(ch => {
        // Skip current chapter if it's already in the state and we're editing it?
        // Actually, let's just sum up everything in state and add the editor if needed.
        // It's safer to just iterate everything saved.
        ch.points.forEach(p => {
            totalWords += (p.content || "").trim().split(/\s+/).length;
            totalLetters += (p.content || "").length;
        });
    });

    document.getElementById('document-words').innerText = totalWords;
    document.getElementById('document-letters').innerText = totalLetters;
}

async function handleAIChat() {
    const input = document.getElementById('chat-input');
    const query = input.value.trim();
    const useWeb = document.getElementById('ai-search-web').checked;

    if (!query) return;

    addSuggestion(`<b>You:</b> ${query}`, "idea");
    input.value = "";
    addSuggestion("🎬 Thinking...", "loading");

    try {
        const context = getProjectContext();
        let prompt = `
            Context: ${context}
            
            Current Question: ${query}
            
            TASK: Act as a research assistant and story companion. 
            If the user asked for specific facts/research, provide accurate info.
            ${useWeb ? "NOTE: The user has requested deep research. If you need 2024/2025 info, please specify you are using simulated up-to-date knowledge or suggest a search." : ""}
        `;

        const response = await callAI(prompt);
        removeLoading();
        addSuggestion(`<b>AI:</b> ${response}`, "idea");
    } catch (err) {
        removeLoading();
        addSuggestion(`❌ Chat Error: ${err.message}`, "error");
    }
}

async function aiRewriteSelection() {
    const selection = window.getSelection().toString();
    if (!selection) return alert("Please highlight some text first.");

    addSuggestion("✍️ Rewriting highlighted section...", "loading");
    try {
        const prompt = `Rewrite the following text from a story to be more engaging and polished, while keeping the meaning. Return only the rewritten text.\n\nText: "${selection}"`;
        const response = await callAI(prompt);
        removeLoading();
        addSuggestion(`<b>Rewritten:</b><br>${response}<br><button onclick="replaceSelectionWith('${response.replace(/'/g, "\\'")}')" class="btn-primary" style="margin-top:5px; font-size:0.7rem;">Apply Rewrite</button>`, "idea");
    } catch (err) {
        removeLoading();
        addSuggestion(`❌ Rewrite Error: ${err.message}`, "error");
    }
}

async function aiCheckSelection() {
    const selection = window.getSelection().toString();
    if (!selection) return alert("Please highlight some text first.");

    const userNote = prompt("What should the AI check for specifically? (e.g., consistency with character traits, world rules, or pacing/tone)", "Check for consistency and flow");
    if (userNote === null) return; // User cancelled

    addSuggestion(`🔍 Checking section: "${userNote}"`, "loading");
    try {
        const context = getProjectContext();
        const prompt = `
            ${context}
            
            SPECIFIC CONCERN: ${userNote}
            
            TEXT TO ANALYZE: "${selection}"
            
            TASK: Act as an expert editor. Analyze the provided text section specifically addressing the user's concern. Check for:
            1. Logical consistency with established characters and world bible.
            2. Adherence to World Rules.
            3. Tone, pacing, and flow within the context of the story.
            
            Return a brief, helpful analysis and actionable suggestions.
        `;
        const response = await callAI(prompt);
        removeLoading();
        addSuggestion("<b>AI Analysis & Feedback:</b><br>" + response, "idea");
    } catch (err) {
        removeLoading();
        addSuggestion(`❌ Check Error: ${err.message}`, "error");
    }
}

async function aiGetWordInfo(type) {
    const selection = window.getSelection().toString().trim();
    if (!selection) return;

    addSuggestion(`✨ Finding ${type} for "${selection}"...`, "loading");
    try {
        const prompt = `Provide a list of up to 10 ${type} for the word "${selection}". Return as a comma-separated list. No other text.`;
        const response = await callAI(prompt);
        removeLoading();
        addSuggestion(`<b>${type.charAt(0).toUpperCase() + type.slice(1)} for "${selection}":</b><br>${response}`, "idea");
    } catch (err) {
        removeLoading();
        addSuggestion(`❌ Error: ${err.message}`, "error");
    }
}

function updateSelectionActions() {
    const selection = window.getSelection().toString().trim();
    const actions = document.getElementById('selection-actions');
    const wordTools = document.getElementById('word-tools');
    const passageTools = document.getElementById('passage-tools');

    if (selection.length > 1) {
        actions.classList.remove('hidden');
        const isSingleWord = selection.split(/\s+/).length === 1;

        if (isSingleWord) {
            wordTools.classList.remove('hidden');
            passageTools.classList.add('hidden');
        } else {
            wordTools.classList.add('hidden');
            passageTools.classList.remove('hidden');
        }
    } else {
        actions.classList.add('hidden');
    }
}

window.replaceSelectionWith = (newText) => {
    const selection = window.getSelection();
    if (!selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    range.insertNode(document.createTextNode(newText));
    saveAllData();
    updateWordCounts();
};

function renderEditorNav() {
    const select = document.getElementById('chapter-select');
    if (!select) return;
    select.innerHTML = "";
    state.chapters.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch.id;
        opt.innerText = ch.title;
        if (state.currentChapterId === ch.id) opt.selected = true;
        select.appendChild(opt);
    });
}

function switchToChapter(id) {
    if (!id) return;
    
    // 1. Save current state to the chapter we're LEAVING
    const currentCh = state.chapters.find(c => c.id === state.currentChapterId);
    if (currentCh) {
        currentCh.content = editor.innerHTML || "";
        currentCh.title = titleInput.value || "";
    }

    // 2. Load the chapter we're ENTERING
    const nextCh = state.chapters.find(c => c.id === id);
    if (nextCh) {
        state.currentChapterId = id;
        state.currentDraft.title = nextCh.title || "Untitled Chapter";
        state.currentDraft.content = nextCh.content || "";
        
        // Push to DOM
        editor.innerHTML = state.currentDraft.content;
        
        // Update Analytics & UI
        renderEditorNav();
        updateWordCounts();
        saveAllData();

        // Jump to top
        titleInput.focus();
        titleInput.scrollIntoView({ behavior: 'smooth' });
    } else {
        console.error("Critical: Could not find chapter with ID", id);
    }
}

async function aiCheckPlotIntegrity() {
    addSuggestion("⚖️ Analyzing Project Integrity & Plot Holes...", "loading");
    try {
        const fullOutline = state.chapters.map(ch => ch.title + ": " + ch.points.map(p => p.content).join(", ")).join("\n");
        const allContext = getProjectContext();
        
        const prompt = `
            FULL PROJECT CONTEXT:
            ${allContext}
            
            OUTLINE SO FAR:
            ${fullOutline}
            
            TASK: Identify "Open Ends", "Unresolved Questions," and "Plot Holes" in this story. 
            Look for characters who vanished, plot threads that stopped without resolution, or logical contradictions.
            Return a structured list of actionable items.
        `;
        const response = await callAI(prompt);
        removeLoading();
        addSuggestion("<b>Story Integrity Report:</b><br>" + response, "idea");
    } catch (err) {
        removeLoading();
        addSuggestion(`❌ Integrity Scan Error: ${err.message}`, "error");
    }
}

document.getElementById('plot-integrity-btn').addEventListener('click', aiCheckPlotIntegrity);

// Export all critical editing functions to global window for HTML onclick access
function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
    currentEditingItem = null;
    currentEditingType = null;
}

window.saveEdit = saveEdit;
window.closeEditModal = closeEditModal;
window.deleteCurrentItem = deleteCurrentItem;
window.openMergeModal = openMergeModal;
window.editPersona = editPersona;
window.editWorld = editWorld;
window.editRule = editRule;
window.addChapter = addChapter;
window.deleteChapter = deleteChapter;
window.confirmPickerSelection = confirmPickerSelection;
window.confirmMerge = confirmMerge;
window.saveSettings = function() {
    state.settings.geminiKey = document.getElementById('gemini-key').value;
    state.settings.aiProvider = document.getElementById('ai-provider').value;
    state.settings.ollamaModel = document.getElementById('ollama-model').value || document.getElementById('ollama-model-select').value;
    localStorage.setItem('inkweaver_gemini_key', state.settings.geminiKey);
    localStorage.setItem('inkweaver_ai_provider', state.settings.aiProvider);
    localStorage.setItem('inkweaver_ollama_model', state.settings.ollamaModel);
    document.getElementById('settings-modal').classList.add('hidden');
    updateAIStatus();
};
window.closeMergeModal = function() {
    document.getElementById('merge-modal').classList.add('hidden');
};
window.closeFilePicker = closeFilePicker;

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });
        if (window.chrome?.webview) {
            window.chrome.webview.postMessage("window_state|fullscreen");
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
        if (window.chrome?.webview) {
            window.chrome.webview.postMessage("window_state|normal");
        }
    }
}

function updateAIStatus() {
    const statusText = document.querySelector('.ai-status span');
    if (!statusText) return;
    const provider = state.settings.aiProvider === 'ollama' ? 'Ollama' : 'Gemini';
    statusText.innerText = `AI Ready (${provider})`;
}

window.updateAIStatus = updateAIStatus;
window.toggleFullScreen = toggleFullScreen;

// Start
init();
updateWordCounts();
renderEditorNav();
