// Service Worker مشترك للـ 3 تطبيقات (admin/client/driver)
// الهدف: تثبيت PWA كامل + شاشة أوفلاين لطيفة بدل خطأ المتصفح — مش تخزين بيانات الطلبات
// (البيانات دي لازم تفضل لايف من Firestore، تخزينها هيبوظ التزامن)
const CACHE_NAME = 'hat-shell-v3';
const PRECACHE_URLS = [
  './admin.html',
  './client.html',
  './driver.html',
  './manifest-admin.json',
  './manifest-client.json',
  './manifest-pilot.json',
  './icon-192.png',
  './icon-512.png',
  './icon-192-maskable.png',
  './icon-512-maskable.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.all(PRECACHE_URLS.map(url =>
        cache.add(url).catch(() => {}) // لو ملف ناقص ماتوقفش التركيب كله بسببه
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return; // POST/PUT لـ Firebase تفضل زي ما هي

  const url = new URL(req.url);
  // مبنتدخلش خالص في نداءات فايربيز / جوجل / أي دومين تاني — لازم تفضل لايف
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // صفحة HTML: نت الأول (عشان النسخة الأحدث)، ولو مفيش نت هات من الكاش
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(() =>
        caches.match(req).then(cached => cached || caches.match('./' + url.pathname.split('/').pop()))
      )
    );
    return;
  }

  // أصول ثابتة (أيقونات، manifest): من الكاش الأول وتحديث في الخلفية
  event.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
