(() => {
    const KEY = 'notesByVideo';
    const formatTime = s => {
        s = Math.max(0, Math.floor(s));
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
        return (h > 0 ? h + ':' : '') + String(m).padStart(h > 0 ? 2 : 1, '0') + ':' + String(sec).padStart(2, '0');
    };
    const uid = () => 'n_' + Math.random().toString(36).slice(2, 10);
    const escapeHtml = s => (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function getContainer() {
        return document.querySelector('#movie_player') || document.querySelector('.html5-video-player') || document.body;
    }

    function ensureMarkerStyles() {
        if (document.getElementById('ytnote-markers-style')) return;
        const css = `
    /* timeline markers */
    .ytnote-markers-wrap { position: absolute; left:0; right:0; top:0; bottom:0; pointer-events:none; }
    .ytnote-marker {
      position: absolute;
      bottom: 0;
      width: 8px;
      height: 8px;
      transform: translateX(-50%) translateY(0);
      border-radius: 2px;
      background: #4fc3f7;
      box-shadow: 0 2px 6px rgba(79,195,247,0.25);
      pointer-events: auto;
      cursor: pointer;
      opacity: .95;
      transition: transform .12s ease, opacity .12s ease;
    }
    .ytnote-marker:hover { transform: translateX(-50%) translateY(-6px) scale(1.15); opacity:1; }
    .ytnote-marker .ytnote-tip {
      position: absolute;
      bottom: 14px;
      left: 50%;
      transform: translateX(-50%);
      min-width: 140px;
      max-width: 300px;
      font-size: 12px;
      padding: 8px;
      border-radius: 8px;
      background: rgba(20,20,20,0.95);
      color: #eaf4fb;
      box-shadow: 0 6px 20px rgba(0,0,0,0.45);
      white-space: pre-wrap;
      display: none;
      z-index: 2147483647;
    }
    .ytnote-marker:hover .ytnote-tip { display:block; }
    /* ensure markers container sits over the progress rail only */
    .ytnote-progress-container { position: absolute; inset: 0; pointer-events: none; }
    .ytnote-progress-rail { position: absolute; left:0; right:0; top:0; bottom:0; pointer-events: none; }
    `;
        const style = document.createElement('style');
        style.id = 'ytnote-markers-style';
        style.textContent = css;
        document.head && document.head.appendChild(style);
    }

    function createUI(videoEl, videoId) {
        const container = getContainer();
        if (!container) return;
        if (container.querySelector('.ytnote-fab')) return; // already attached

        ensureMarkerStyles();

        const fab = document.createElement('button');
        fab.className = 'ytnote-fab';
        fab.setAttribute('aria-label', 'YouTube Notes');
        fab.innerHTML = '<span class="icon">✎</span>';
        container.appendChild(fab);

        const panel = document.createElement('div'); panel.className = 'ytnote-panel';
        panel.innerHTML = `
      <div class="head">
        <h4>Your Notes</h4>
        <div class="meta">Video notes</div>
      </div>
      <div class="ytnote-entry" style="margin-top:6px;">
        <div class="time ts-input" title="click to seek">00:00</div>
        <textarea placeholder="Write a note"></textarea>
        <div class="actions">
          <button class="ytnote-btn save">Save</button>
        </div>
      </div>
      <div class="ytnote-list"></div>
      <div class="ytnote-empty" style="display:none;">No notes yet — add one with the button above.</div>
    `;
        container.appendChild(panel);

        if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

        fab.addEventListener('click', () => {
            panel.classList.toggle('open');
            const ta = panel.querySelector('textarea'); ta.focus();
            updateTimeDisplay(panel, videoEl);
            renderList(panel, videoId);
        });

        document.addEventListener('click', (e) => {
            if (!panel.contains(e.target) && !fab.contains(e.target)) panel.classList.remove('open');
        });

        function updateTimeDisplay(panel, video) {
            const el = panel.querySelector('.ts-input');
            const t = video && typeof video.currentTime === 'number' ? video.currentTime : 0;
            el.textContent = formatTime(t);
        }

        panel.querySelector('.ts-input').addEventListener('click', () => {
            if (videoEl) { videoEl.currentTime = Math.max(0, videoEl.currentTime || 0); videoEl.play(); updateTimeDisplay(panel, videoEl); }
        });

        const textarea = panel.querySelector('textarea');

        function keyBlocker(e) { e.stopPropagation(); }

        textarea.addEventListener('focus', () => {
            window.addEventListener('keydown', keyBlocker, true);
            window.addEventListener('keypress', keyBlocker, true);
            window.addEventListener('keyup', keyBlocker, true);
        });

        textarea.addEventListener('blur', () => {
            window.removeEventListener('keydown', keyBlocker, true);
            window.removeEventListener('keypress', keyBlocker, true);
            window.removeEventListener('keyup', keyBlocker, true);
        });

        textarea.addEventListener('paste', (e) => e.stopPropagation());
        textarea.addEventListener('cut', (e) => e.stopPropagation());

        panel.querySelector('.save').addEventListener('click', () => {
            const ta = panel.querySelector('textarea'); const text = ta.value.trim();
            if (!text) { ta.focus(); return; }
            const t = videoEl ? Math.round((videoEl.currentTime || 0) * 100) / 100 : 0;
            const newNote = { id: uid(), time: t, text, createdAt: Date.now() };
            chrome.storage.local.get([KEY], res => {
                const store = res[KEY] || {};
                const entry = store[videoId] || { videoId, title: document.title, url: location.href.split('&')[0], notes: [] };
                entry.title = document.title; entry.url = location.href.split('&')[0];
                entry.notes.push(newNote);
                store[videoId] = entry;
                chrome.storage.local.set({ [KEY]: store }, () => {
                    ta.value = '';
                    renderList(panel, videoId);
                });
            });
        });

        let timeTick = null;
        const startTick = () => {
            if (timeTick) return;
            timeTick = setInterval(() => { if (panel.classList.contains('open')) updateTimeDisplay(panel, videoEl); else stopTick(); }, 800);
        };
        const stopTick = () => { clearInterval(timeTick); timeTick = null; };
        fab.addEventListener('mouseenter', startTick);
        fab.addEventListener('focus', startTick);
        panel.addEventListener('mouseenter', startTick);
        panel.addEventListener('mouseleave', stopTick);

        renderMarkersForVideo(videoId, videoEl);
    }

    function renderList(panel, videoId) {
        const listEl = panel.querySelector('.ytnote-list');
        const emptyEl = panel.querySelector('.ytnote-empty');
        listEl.innerHTML = '';
        chrome.storage.local.get([KEY], res => {
            const store = res[KEY] || {};
            const entry = store[videoId];
            if (!entry || !entry.notes || entry.notes.length === 0) {
                emptyEl.style.display = 'block';
                removeMarkers(videoId);
                return;
            }
            emptyEl.style.display = 'none';

            entry.notes.sort((a, b) => a.time - b.time).forEach(note => {
                const item = document.createElement('div'); item.className = 'ytnote-item';
                item.innerHTML = `
          <div class="left">
            <div class="ts" title="seek">${formatTime(note.time)}</div>
            <div class="meta">${new Date(note.createdAt).toLocaleDateString()}</div>
          </div>
          <div class="body">
            <div class="text">${escapeHtml(note.text)}</div>
            <div class="meta">
              <button class="ytnote-link edit">Edit</button>
              <button class="ytnote-link del">Delete</button>
            </div>
          </div>
        `;

                item.querySelector('.ts').addEventListener('click', () => {
                    const videoEl = document.querySelector('video');
                    if (videoEl) { videoEl.currentTime = note.time; videoEl.play(); }
                    else window.open(`${entry.url}${entry.url.includes('?') ? '&' : '?'}t=${Math.floor(note.time)}s`, '_blank');
                });

                item.querySelector('.edit').addEventListener('click', () => {
                    const newText = prompt('Edit note', note.text);
                    if (newText == null) return;
                    chrome.storage.local.get([KEY], r => {
                        const s = r[KEY] || {}; const e = s[videoId];
                        if (!e) return;
                        const n = e.notes.find(x => x.id === note.id);
                        if (n) { n.text = newText; n.updatedAt = Date.now(); }
                        chrome.storage.local.set({ [KEY]: s }, () => renderList(panel, videoId));
                    });
                });

                // delete
                item.querySelector('.del').addEventListener('click', () => {
                    if (!confirm('Delete this note?')) return;
                    chrome.storage.local.get([KEY], r => {
                        const s = r[KEY] || {}; const e = s[videoId];
                        if (!e) return;
                        e.notes = e.notes.filter(x => x.id !== note.id);
                        s[videoId] = e;
                        chrome.storage.local.set({ [KEY]: s }, () => {
                            renderList(panel, videoId);
                        });
                    });
                });

                listEl.appendChild(item);
            });

            renderMarkersForVideo(videoId, document.querySelector('video'));
        });
    }

    function findProgressBarContainer() {
        const player = document.querySelector('#movie_player');
        if (!player) return null;
        const rail = player.querySelector('.ytp-progress-bar') || player.querySelector('.ytp-progress-holder') || player.querySelector('.ytp-time-control');
        return rail || player;
    }

    function renderMarkersForVideo(videoId, videoEl) {
        removeAllMarkers();

        chrome.storage.local.get([KEY], res => {
            const store = res[KEY] || {};
            const entry = store[videoId];
            if (!entry || !entry.notes || entry.notes.length === 0) return;

            const railEl = findProgressBarContainer();
            if (!railEl) return;

            const wrap = document.createElement('div');
            wrap.className = 'ytnote-markers-wrap';
            wrap.dataset.videoId = videoId;

            const overlay = document.createElement('div');
            overlay.className = 'ytnote-progress-container';
            wrap.appendChild(overlay);

            const parentToAttach = railEl.parentElement || (document.querySelector('#movie_player') || document.body);
            parentToAttach.appendChild(wrap);

            function positionOverlay() {
                const railRect = railEl.getBoundingClientRect();
                const parentRect = parentToAttach.getBoundingClientRect();
                const left = railRect.left - parentRect.left;
                const top = railRect.top - parentRect.top;
                overlay.style.position = 'absolute';
                overlay.style.left = `${left}px`;
                overlay.style.top = `${top}px`;
                overlay.style.width = `${railRect.width}px`;
                overlay.style.height = `${railRect.height}px`;
                overlay.style.pointerEvents = 'none';
            }

            const duration = (videoEl && videoEl.duration && isFinite(videoEl.duration)) ? videoEl.duration : null;

            const ensureRender = () => {
                const dur = (videoEl && videoEl.duration && isFinite(videoEl.duration)) ? videoEl.duration : null;
                if (!dur) {
                    if (videoEl) {
                        videoEl.addEventListener('loadedmetadata', () => renderMarkersForVideo(videoId, videoEl), { once: true });
                    }
                    return;
                }
                entry.notes.forEach(note => {
                    const percent = Math.min(100, Math.max(0, (note.time / dur) * 100));
                    const m = document.createElement('div');
                    m.className = 'ytnote-marker';
                    m.style.left = `${percent}%`;
                    m.title = `${formatTime(note.time)} — ${note.text}`;
                    m.style.pointerEvents = 'auto';
                    const tip = document.createElement('div'); tip.className = 'ytnote-tip';
                    tip.textContent = `${formatTime(note.time)} — ${note.text}`;
                    m.appendChild(tip);

                    m.addEventListener('click', (ev) => {
                        ev.stopPropagation();
                        const vid = document.querySelector('video');
                        if (vid) { vid.currentTime = note.time; vid.play(); }
                        else window.open(`${entry.url}${entry.url.includes('?') ? '&' : '?'}t=${Math.floor(note.time)}s`, '_blank');
                    });

                    overlay.appendChild(m);
                });
                positionOverlay();
            };

            positionOverlay();
            ensureRender();

            const onResize = () => positionOverlay();
            window.addEventListener('resize', onResize);
            wrap.__ytnote_cleanup = () => {
                window.removeEventListener('resize', onResize);
            };
        });
    }

    function removeAllMarkers() {
        const existing = document.querySelectorAll('.ytnote-markers-wrap');
        existing.forEach(w => {
            if (w.__ytnote_cleanup) try { w.__ytnote_cleanup(); } catch (e) { }
            w.remove();
        });
    }

    function removeMarkers(videoId) {
        const nodes = document.querySelectorAll('.ytnote-markers-wrap');
        nodes.forEach(n => {
            if (n.dataset.videoId === videoId) n.remove();
        });
    }

    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local') return;
        if (!changes[KEY]) return;
        const vidId = (new URL(location.href)).searchParams.get('v');
        if (!vidId) return;
        renderMarkersForVideo(vidId, document.querySelector('video'));
        const panel = document.querySelector('.ytnote-panel');
        if (panel) {
            try {
                const fab = document.querySelector('.ytnote-fab');
                if (fab && panel.classList.contains('open')) {
                    panel.dispatchEvent(new CustomEvent('ytnote-refresh'));
                }
            } catch (e) { }
        }
    });

    document.addEventListener('DOMContentLoaded', () => { /*noop*/ });
    const panelRefreshObserver = new MutationObserver(() => {
        const panel = document.querySelector('.ytnote-panel');
        if (panel && !panel.__ytnote_refresh_attached) {
            panel.addEventListener('ytnote-refresh', () => {
                const vidId = (new URL(location.href)).searchParams.get('v');
                if (vidId) {
                    (function (panelEl, vId) {
                        const listEl = panelEl.querySelector('.ytnote-list');
                        const emptyEl = panelEl.querySelector('.ytnote-empty');
                        listEl.innerHTML = '';
                        chrome.storage.local.get([KEY], res => {
                            const store = res[KEY] || {};
                            const entry = store[vId];
                            if (!entry || !entry.notes || entry.notes.length === 0) {
                                emptyEl.style.display = 'block';
                                removeMarkers(vId);
                                return;
                            }
                            emptyEl.style.display = 'none';
                            entry.notes.sort((a, b) => a.time - b.time).forEach(note => {
                                const item = document.createElement('div'); item.className = 'ytnote-item';
                                item.innerHTML = `
                  <div class="left">
                    <div class="ts" title="seek">${formatTime(note.time)}</div>
                    <div class="meta">${new Date(note.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div class="body">
                    <div class="text">${escapeHtml(note.text)}</div>
                    <div class="meta">
                      <button class="ytnote-link edit">Edit</button>
                      <button class="ytnote-link del">Delete</button>
                    </div>
                  </div>
                `;
                                item.querySelector('.ts').addEventListener('click', () => {
                                    const videoEl = document.querySelector('video');
                                    if (videoEl) { videoEl.currentTime = note.time; videoEl.play(); }
                                    else window.open(`${entry.url}${entry.url.includes('?') ? '&' : '?'}t=${Math.floor(note.time)}s`, '_blank');
                                });
                                item.querySelector('.edit').addEventListener('click', () => {
                                    const newText = prompt('Edit note', note.text);
                                    if (newText == null) return;
                                    chrome.storage.local.get([KEY], r => {
                                        const s = r[KEY] || {}; const e = s[vId];
                                        if (!e) return;
                                        const n = e.notes.find(x => x.id === note.id);
                                        if (n) { n.text = newText; n.updatedAt = Date.now(); }
                                        chrome.storage.local.set({ [KEY]: s }, () => { panelEl.dispatchEvent(new CustomEvent('ytnote-refresh')); });
                                    });
                                });
                                item.querySelector('.del').addEventListener('click', () => {
                                    if (!confirm('Delete this note?')) return;
                                    chrome.storage.local.get([KEY], r => {
                                        const s = r[KEY] || {}; const e = s[vId];
                                        if (!e) return;
                                        e.notes = e.notes.filter(x => x.id !== note.id);
                                        s[vId] = e;
                                        chrome.storage.local.set({ [KEY]: s }, () => { panelEl.dispatchEvent(new CustomEvent('ytnote-refresh')); });
                                    });
                                });
                                listEl.appendChild(item);
                            });
                            renderMarkersForVideo(vId, document.querySelector('video'));
                        });
                    })(panel, (new URL(location.href)).searchParams.get('v'));
                }
            });
            panel.__ytnote_refresh_attached = true;
        }
    });
    panelRefreshObserver.observe(document, { childList: true, subtree: true });

    let currentVid = null;
    function ensure() {
        const vidId = (new URL(location.href)).searchParams.get('v');
        if (!vidId || vidId === currentVid) return;
        currentVid = vidId;
        const videoEl = document.querySelector('video');
        setTimeout(() => createUI(videoEl, vidId), 450);
    }

    ensure();

    let lastHref = location.href;
    const mo = new MutationObserver(() => {
        if (location.href !== lastHref) { lastHref = location.href; ensure(); removeAllMarkers(); }
    });
    mo.observe(document, { childList: true, subtree: true });

    let tries = 0; const poll = setInterval(() => { tries++; ensure(); if (tries > 18) clearInterval(poll); }, 800);
})();
