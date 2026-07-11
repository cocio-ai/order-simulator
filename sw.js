const CACHE_NAME = 'order-simulator-v1';
const urlsToCache = [
    './index.html',
    './style.css',
    './main.js',
    './manifest.json',
    './icon-192.png'
];

// アプリの初回起動時にファイルをiPad内に保存（キャッシュ）
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
    );
});

// 画面を開くときの処理：まずは最新の情報を探しに行き、繋がらなければキャッシュを使う
self.addEventListener('fetch', (event) => {
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});
