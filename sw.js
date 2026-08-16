/* ========================================================
   PHANTOM HQ - SERVICE WORKER
   PWA • Offline • Cache • Auto Update
   ======================================================== */

const CACHE_NAME = "phantom-hq-v3";

/* ========================================================
   📦 CORE FILES
   ======================================================== */
const CORE_ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./data.js",
    "./manifest.json"
];

/* ========================================================
   🚀 INSTALL
   ======================================================== */
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log("📦 PHANTOM HQ: Caching core assets...");
                return cache.addAll(CORE_ASSETS);
            })
            .then(() => {
                console.log("✅ PHANTOM HQ: Service Worker installed.");
                return self.skipWaiting();
            })
            .catch((error) => console.error("❌ PHANTOM HQ: Cache installation failed:", error))
    );
});

/* ========================================================
   🔄 ACTIVATE
   ======================================================== */
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName.startsWith("phantom-hq-") && cacheName !== CACHE_NAME) {
                            console.log("🗑️ Removing old cache:", cacheName);
                            return caches.delete(cacheName);
                        }
                        return null;
                    })
                );
            })
            .then(() => {
                console.log("✅ PHANTOM HQ: Service Worker activated.");
                return self.clients.claim();
            })
    );
});

/* ========================================================
   🌐 FETCH SYSTEM
   ======================================================== */
self.addEventListener("fetch", (event) => {
    const request = event.request;
    const url = new URL(request.url);

    /*
     * 1. استثناء طلبات API والطلبات غير التابعة لـ GET
     * يجب أن تمر مباشرة للشبكة بدون تخزين مؤقت
     */
    if (request.method !== "GET" || url.pathname.startsWith("/api/")) {
        return;
    }

    /*
     * 2. صفحات التنقل (HTML / Navigation)
     * Network First -> Cache Fallback
     */
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    if (response && response.ok) {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match("./index.html").then((cachedPage) => {
                        return cachedPage || new Response(
                            `<!DOCTYPE html>
                            <html lang="ar" dir="rtl">
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                <title>PHANTOM HQ</title>
                            </head>
                            <body>
                                <h2>PHANTOM HQ</h2>
                                <p>المنصة غير متاحة حاليًا بدون اتصال بالإنترنت.</p>
                            </body>
                            </html>`,
                            {
                                status: 503,
                                headers: { "Content-Type": "text/html; charset=utf-8" }
                            }
                        );
                    });
                })
        );
        return;
    }

    /*
     * 3. الملفات الثابتة (Static Assets)
     * Cache First + Background Network Revalidate
     */
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // تحديث النسخة في الخلفية
                fetch(request)
                    .then((networkResponse) => {
                        if (networkResponse && networkResponse.ok) {
                            const responseClone = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(request, responseClone);
                            });
                        }
                    })
                    .catch(() => {});

                return cachedResponse;
            }

            // إذا لم تكن موجودة في الكاش
            return fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.ok) {
                        const responseClone = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return new Response("PHANTOM HQ Offline", {
                        status: 503,
                        statusText: "Offline"
                    });
                });
        })
    );
});

/* ========================================================
   🧹 MESSAGE SYSTEM
   ======================================================== */
self.addEventListener("message", (event) => {
    if (!event.data) return;

    if (event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }

    if (event.data.type === "CLEAR_CACHE") {
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName.startsWith("phantom-hq-")) {
                        return caches.delete(cacheName);
                    }
                    return null;
                })
            );
        });
    }
});

/* ========================================================
   🛡️ ERROR SAFETY
   ======================================================== */
self.addEventListener("error", (event) => {
    console.error("❌ PHANTOM HQ Service Worker Error:", event.error);
});

self.addEventListener("unhandledrejection", (event) => {
    console.error("❌ PHANTOM HQ Service Worker Promise Error:", event.reason);
});
