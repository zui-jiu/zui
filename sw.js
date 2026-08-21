/* 减脂菜单工作台 Service Worker —— 提供 PWA 可安装性 + 基础离线缓存 */
const CACHE = 'recipes-cache-v1';
const ASSETS = [
  './',
  './recipes.html',
  './manifest.json',
  './recipes-icon.png'
];

/* 安装：预缓存核心文件 */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

/* 激活：清理旧缓存 */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

/* 拦截请求：缓存优先，回退网络（离线也能打开） */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        // 成功的响应才缓存
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => caches.match('./recipes.html'));
    })
  );
});