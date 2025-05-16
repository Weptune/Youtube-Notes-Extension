let currentVideoId = null;

function getVideoId() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("v");
}

function waitForPlayer() {
  const container = document.querySelector('#above-the-fold #player') || document.querySelector('#player');
  const video = document.querySelector('video');

  if (container && video) {
    console.log('[YT Notes] Player and video found');
    setupNoteUI(container);
    observeUrlChange();
  } else {
    console.log('[YT Notes] Waiting for player...');
    setTimeout(waitForPlayer, 1000);
  }
}

function observeUrlChange() {
  let lastUrl = location.href;
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      console.log('[YT Notes] URL changed:', lastUrl);
      handleUrlChange();
    }
  }, 1000);
}

function handleUrlChange() {
  const newVideoId = getVideoId();
  if (newVideoId !== currentVideoId) {
    currentVideoId = newVideoId;
    clearNotesUI();
    const container = document.querySelector('#above-the-fold #player') || document.querySelector('#player');
    if (container) setupNoteUI(container);
  }
}

function setupNoteUI(container) {
  currentVideoId = getVideoId();
  if (!currentVideoId) {
    console.warn('[YT Notes] No video ID found.');
    return;
  }

  if (document.getElementById('yt-note-btn')) return;

  console.log('[YT Notes] Setting up notes UI for video:', currentVideoId);

  const addNoteBtn = document.createElement('button');
  addNoteBtn.textContent = '📒 Add Note';
  addNoteBtn.id = 'yt-note-btn';

  const toggleBtn = document.createElement('button');
  toggleBtn.textContent = '🧾 Toggle Notes';
  toggleBtn.id = 'yt-toggle-btn';

  const noteBox = document.createElement('div');
  noteBox.id = 'yt-notes';

  Object.assign(noteBox.style, {
    position: 'absolute',
    top: '100px',
    right: '20px',
    backgroundColor: 'white',
    padding: '10px',
    border: '1px solid gray',
    zIndex: 9999,
    maxWidth: '300px',
  });

  [addNoteBtn, toggleBtn].forEach(btn => {
    Object.assign(btn.style, {
      position: 'absolute',
      right: '20px',
      zIndex: 9999,
      padding: '5px 10px',
    });
  });

  addNoteBtn.style.top = '20px';
  toggleBtn.style.top = '60px';

  container.appendChild(addNoteBtn);
  container.appendChild(toggleBtn);
  container.appendChild(noteBox);

  addNoteBtn.addEventListener('click', () => {
    const video = document.querySelector('video');
    const time = video.currentTime;
    const noteText = prompt("Enter your note:");
    if (noteText) {
      const note = { timestamp: time, text: noteText };
      saveNote(note);
    }
  });

  toggleBtn.addEventListener('click', () => {
    noteBox.style.display = noteBox.style.display === 'none' ? 'block' : 'none';
  });

  loadNotes();
}

function clearNotesUI() {
  const elements = ['yt-note-btn', 'yt-toggle-btn', 'yt-notes'];
  elements.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
  });
}

function saveNote(note) {
  chrome.storage.local.get([currentVideoId], (result) => {
    const notes = result[currentVideoId] || [];
    notes.push(note);
    chrome.storage.local.set({ [currentVideoId]: notes }, loadNotes);
  });
}

function loadNotes() {
  chrome.storage.local.get([currentVideoId], (result) => {
    const notes = result[currentVideoId] || [];
    console.log(`[YT Notes] Loaded ${notes.length} notes for`, currentVideoId);
    renderNotes(notes);
  });
}

function renderNotes(notes) {
  const container = document.getElementById('yt-notes');
  if (!container) return;

  container.innerHTML = '';

  notes.forEach((note, index) => {
    const wrapper = document.createElement('div');
    wrapper.style.marginBottom = '10px';

    const timeLink = document.createElement('div');
    timeLink.textContent = `🕒 ${formatTime(note.timestamp)}`;
    timeLink.style.cursor = 'pointer';
    timeLink.style.fontWeight = 'bold';
    timeLink.onclick = () => {
      document.querySelector('video').currentTime = note.timestamp;
    };

    const body = document.createElement('div');
    body.textContent = note.text;
    body.style.marginLeft = '10px';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '10px';

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️';
    editBtn.onclick = () => {
      const newText = prompt('Edit note:', note.text);
      if (newText) {
        note.text = newText;
        updateNote(index, note);
      }
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '❌';
    deleteBtn.onclick = () => deleteNote(index);

    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);

    wrapper.appendChild(timeLink);
    wrapper.appendChild(body);
    wrapper.appendChild(actions);

    container.appendChild(wrapper);
  });
}

function updateNote(index, newNote) {
  chrome.storage.local.get([currentVideoId], (result) => {
    const notes = result[currentVideoId] || [];
    notes[index] = newNote;
    chrome.storage.local.set({ [currentVideoId]: notes }, loadNotes);
  });
}

function deleteNote(index) {
  chrome.storage.local.get([currentVideoId], (result) => {
    const notes = result[currentVideoId] || [];
    notes.splice(index, 1);
    chrome.storage.local.set({ [currentVideoId]: notes }, loadNotes);
  });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

waitForPlayer();
