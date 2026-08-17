/* ========================================================
   PHANTOM HQ - SERVICE WORKER
   PWA • Offline • Cache • Auto Update • Push Notifications (v5)
   ======================================================== */

// --- استيراد مكتبات Firebase للإشعارات ---
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

const CACHE_NAME = "phantom-hq-v5";

/* ========================================================
   📦 CORE FILES
   ======================================================== */
const CORE_ASSETS = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./data.js",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png"
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

    if (request.method !== "GET") {
        return;
    }

    if (url.pathname.startsWith("/api/") || url.hostname.includes("supabase.co")) {
        return;
    }

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

    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
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
   🔔 FIREBASE BACKGROUND MESSAGING (جديد - مهم جداً)
   ======================================================== */
// تهيئة Firebase داخل الـ Service Worker
firebase.initializeApp({
    apiKey: "AIzaSyB9BLwWu9Rwrxb8YTt2d9piYzpJSWUNJfs",
    authDomain: "phantom-eb05d.firebaseapp.com",
    projectId: "phantom-eb05d",
    storageBucket: "phantom-eb05d.firebasestorage.app",
    messagingSenderId: "140970616071",
    appId: "1:140970616071:web:8d30ef892b5b033ba711a2"
});

const messaging = firebase.messaging();

// استقبال الإشعارات عندما يكون التطبيق في الخلفية (مقفول)
messaging.onBackgroundMessage((payload) => {
    console.log('📩 [SW] إشعار خلفية وصل:', payload);
    
    const notificationTitle = payload.notification.title || "PHANTOM HQ";
    const notificationOptions = {
        body: payload.notification.body || "لديك إشعار جديد!",
        icon: "./icon-192.png",
        badge: "./icon-192.png",
        vibrate: [200, 100, 200],
        data: {
            url: payload.data?.url || "./index.html"
        }
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

/* ========================================================
   👆 PUSH EVENT (للتأكد من عمل الإشعارات مع كودك القديم)
   ======================================================== */
self.addEventListener("push", function(event) {
    let data = {};
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data = { title: event.data.text() };
        }
    }

    const title = data.title || "PHANTOM HQ";
    const body = data.body || "لديك إشعار جديد!";
    const icon = data.icon || "./icon-192.png";
    const badge = data.badge || "./icon-192.png";
    const tag = data.tag || "phantom-notification";
    const url = data.url || "./index.html";

    const options = {
        body: body,
        icon: icon,
        badge: badge,
        tag: tag,
        vibrate: [200, 100, 200],
        data: {
            url: url,
            timestamp: Date.now()
        }
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

/* ========================================================
   👆 NOTIFICATION CLICK
   ======================================================== */
self.addEventListener("notificationclick", function(event) {
    event.notification.close();

    const urlToOpen = event.notification.data.url || "./index.html";

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then((windowClients) => {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === urlToOpen && "focus" in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
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
