// Service Worker - 个人综合工作台
// 缓存核心文件，支持离线访问和PWA安装

var CACHE_NAME = 'workbench-v1';
var ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  './css/styles.css',
  './js/store.js',
  './js/timer.js',
  './js/app.js',
  './js/dashboard.js',
  './js/exercise.js',
  './js/study.js',
  './js/checklist.js',
  './js/accounting.js',
  './js/records.js'
];

// 安装：缓存核心文件
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

// 激活：清理旧缓存
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        if (key !== CACHE_NAME) {
          return caches.delete(key);
        }
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

// 请求拦截：缓存优先，网络兜底
self.addEventListener('fetch', function (event) {
  // 只处理 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        // 缓存新获取的文件
        if (response && response.status === 200 && response.type === 'basic') {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function () {
        // 离线兜底
        return caches.match('./index.html');
      });
    })
  );
});
