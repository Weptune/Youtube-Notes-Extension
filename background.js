// background.js
// keep it minimal - service worker can be used for future features (notifications, sync, context menus)
self.addEventListener('install', () => {
    self.skipWaiting();
});
self.addEventListener('activate', () => {
    self.clients.claim();
});
