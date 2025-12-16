document.addEventListener('DOMContentLoaded', () => {
    const KEY = 'notesByVideo';
    const list = document.getElementById('list');
    const qInput = document.getElementById('q');
    const clearBtn = document.getElementById('clear');
    const exportBtn = document.getElementById('export');
    const importBtn = document.getElementById('import');
    const importFile = document.getElementById('importfile');
    const clearAllBtn = document.getElementById('clearAll');

    function formatTime(s) { s = Math.max(0, Math.floor(s)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return (h > 0 ? h + ':' : '') + String(m).padStart(h > 0 ? 2 : 1, '0') + ':' + String(sec).padStart(2, '0'); }
    function thumbUrl(vid) { return `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`; }
    function escapeHtml(s) { return (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    // helper to highlight query inside text (simple, case-insensitive)
    function highlight(text, q) {
        if (!q) return escapeHtml(text);
        try {
            const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`(${esc})`, 'ig');
            return escapeHtml(text).replace(re, '<mark style="background:rgba(79,195,247,0.18);padding:0 2px;border-radius:2px;color:inherit;">$1</mark>');
        } catch (e) { return escapeHtml(text); }
    }

    // render store object with optional query
    function render(store, query = '') {
        list.innerHTML = '';
        const videos = Object.values(store || {}).sort((a, b) => (b.notes?.length || 0) - (a.notes?.length || 0));
        if (videos.length === 0) { list.innerHTML = '<div class="empty">No notes yet — add some from YouTube.</div>'; return; }

        const q = (query || '').trim().toLowerCase();
        let totalMatches = 0;
        const groups = [];

        videos.forEach(v => {
            const notes = v.notes || [];
            const filtered = notes.filter(n => {
                if (!q) return true;
                const combined = `${v.title || ''} ${n.text || ''} ${formatTime(n.time)}`.toLowerCase();
                return combined.includes(q);
            });
            if (filtered.length) {
                totalMatches += filtered.length;
                groups.push({ video: v, notes: filtered });
            }
        });

        // header with count
        const header = document.createElement('div');
        header.style.marginBottom = '8px';
        header.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center;">
      <div style="font-size:13px;color:var(--muted)">${totalMatches} result${totalMatches !== 1 ? 's' : ''}</div>
      <div style="font-size:12px;color:var(--muted)">Filtered ${groups.length} video${groups.length !== 1 ? 's' : ''}</div>
    </div>`;
        list.appendChild(header);

        if (groups.length === 0) { list.innerHTML += '<div class="empty">No notes match your search.</div>'; return; }

        groups.forEach(g => {
            const v = g.video;
            const group = document.createElement('div'); group.className = 'video-group';
            const head = document.createElement('div'); head.className = 'video-head';
            const img = document.createElement('img'); img.className = 'thumb'; img.src = thumbUrl(v.videoId);
            const vm = document.createElement('div'); vm.className = 'vmeta';
            const vt = document.createElement('div'); vt.className = 'vtitle'; vt.innerHTML = highlight(v.title || 'Video', q);
            const vc = document.createElement('div'); vc.className = 'vcount'; vc.textContent = `${v.notes.length} total note${v.notes.length > 1 ? 's' : ''}`;
            vm.appendChild(vt); vm.appendChild(vc); head.appendChild(img); head.appendChild(vm);
            group.appendChild(head);

            g.notes.sort((a, b) => a.time - b.time).forEach(n => {
                const row = document.createElement('div'); row.className = 'note-row';
                const left = document.createElement('div'); left.className = 'note-left';
                const ts = document.createElement('div'); ts.className = 'ts'; ts.textContent = formatTime(n.time);
                ts.addEventListener('click', () => {
                    const url = `${v.url}${v.url.includes('?') ? '&' : '?'}t=${Math.floor(n.time)}s`;
                    chrome.tabs.create({ url });
                });
                const text = document.createElement('div'); text.className = 'note-text'; text.innerHTML = highlight(n.text, q);
                left.appendChild(ts); left.appendChild(text);

                const controls = document.createElement('div'); controls.className = 'note-controls';
                const edit = document.createElement('button'); edit.className = 'btn'; edit.textContent = 'Edit';
                edit.addEventListener('click', () => {
                    const newText = prompt('Edit note', n.text);
                    if (newText == null) return;
                    chrome.storage.local.get([KEY], r => {
                        const s = r[KEY] || {}; const e = s[v.videoId]; if (!e) return;
                        const nn = e.notes.find(x => x.id === n.id); if (nn) nn.text = newText; chrome.storage.local.set({ [KEY]: s }, () => { render(s, qInput.value); });
                    });
                });
                const del = document.createElement('button'); del.className = 'btn'; del.textContent = 'Delete';
                del.addEventListener('click', () => {
                    if (!confirm('Delete this note?')) return;
                    chrome.storage.local.get([KEY], r => {
                        const s = r[KEY] || {}; const e = s[v.videoId];
                        if (!e) return; e.notes = e.notes.filter(x => x.id !== n.id); s[v.videoId] = e;
                        chrome.storage.local.set({ [KEY]: s }, () => render(s, qInput.value));
                    });
                });
                controls.appendChild(edit); controls.appendChild(del);
                row.appendChild(left); row.appendChild(controls);
                group.appendChild(row);
            });

            list.appendChild(group);
        });
    }

    // load & render
    chrome.storage.local.get([KEY], res => render(res[KEY] || {}));

    // listen to storage changes to update UI
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (changes[KEY]) render(changes[KEY].newValue || {}, qInput.value);
    });

    // search debounce
    let timer = null;
    qInput.addEventListener('input', (e) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
            chrome.storage.local.get([KEY], res => render(res[KEY] || {}, e.target.value));
        }, 180);
    });
    clearBtn.addEventListener('click', () => { qInput.value = ''; qInput.dispatchEvent(new Event('input')); });

    // export
    exportBtn.addEventListener('click', () => {
        chrome.storage.local.get([KEY], res => {
            const data = res[KEY] || {};
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'youtube-notes.json'; a.click();
            URL.revokeObjectURL(url);
        });
    });

    // import
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
        const f = e.target.files[0]; if (!f) return;
        const r = new FileReader();
        r.onload = () => {
            try {
                const imported = JSON.parse(r.result);
                chrome.storage.local.get([KEY], res => {
                    const store = res[KEY] || {};
                    const merged = { ...store, ...imported }; // simple merge
                    chrome.storage.local.set({ [KEY]: merged }, () => { render(merged, qInput.value); alert('Imported'); });
                });
            } catch (err) { alert('Invalid JSON'); }
        };
        r.readAsText(f);
    });

    clearAllBtn.addEventListener('click', () => {
        if (!confirm('Clear all saved notes? This cannot be undone.')) return;
        chrome.storage.local.remove([KEY], () => { list.innerHTML = '<div class="empty">No notes yet — add some from YouTube.</div>'; });
    });
});
