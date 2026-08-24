/* ========================================================
   PHANTOM HQ - CORE SYSTEM (v6.5 - Feature Update)
   script.js
   - إضافة نظام ID الفريد، الطرد/الرجوع، عداد المتصلين، فلتر كلمات
   - تجهيز لدعم الإشعارات، المكالمات، والفيديو (Clips)
   ======================================================== */

"use strict";

/* ========================================================
   1. أدوات عامة ونظام الإشعارات
   ======================================================== */

function showToast(message, type = "info") {
    let container = getElement("phantom-toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "phantom-toast-container";
        container.style.cssText = `
            position: fixed;
            bottom: 90px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 99999;
            display: flex;
            flex-direction: column;
            gap: 10px;
            pointer-events: none;
            width: 90%;
            max-width: 400px;
        `;
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    const bgColor = type === "error" ? "rgba(255, 77, 77, 0.95)" : type === "success" ? "rgba(0, 255, 136, 0.95)" : "rgba(212, 175, 55, 0.95)";
    const textColor = type === "success" ? "#000" : "#fff";

    toast.style.cssText = `
        background: ${bgColor};
        color: ${textColor};
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 0.9rem;
        font-weight: bold;
        text-align: center;
        box-shadow: 0 4px 15px rgba(0,0,0,0.5);
        transition: all 0.3s ease;
        opacity: 0;
        transform: translateY(20px);
    `;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateY(0)";
    }, 10);

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateY(-10px)";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function getStorage(key, fallback) {
    try {
        const value = localStorage.getItem(key);
        if (value === null) return fallback;
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function setStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        return false;
    }
}

function removeStorage(key) {
    try {
        localStorage.removeItem(key);
        return true;
    } catch (error) {
        return false;
    }
}

function getSession(key, fallback = null) {
    try {
        const value = sessionStorage.getItem(key);
        if (value === null) return fallback;
        return JSON.parse(value);
    } catch (error) {
        return fallback;
    }
}

function setSession(key, value) {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        return false;
    }
}

function removeSession(key) {
    try {
        sessionStorage.removeItem(key);
        return true;
    } catch (error) {
        return false;
    }
}

function getElement(id) {
    return document.getElementById(id);
}

function escapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function shakeElement(element) {
    if (!element) return;
    element.classList.add("shake");
    setTimeout(() => element.classList.remove("shake"), 500);
}

function normalizeName(name) {
    if (!name) return "";
    return String(name)
        .toLowerCase()
        .replace(/[『』[\]{}()]/g, "")
        .replace(/ph/g, "")
        .replace(/[^a-z0-9أ-ي]/g, "")
        .trim();
}

// UPDATE: دالة توليد ID فريد (نقطة 5)
function generateUniqueId() {
    return 'PH_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

// UPDATE: طلب إذن الإشعارات (نقطة 7)
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.warn("هذا المتصفح لا يدعم الإشعارات.");
        return;
    }
    if (Notification.permission === "granted") return;
    if (Notification.permission !== "denied") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                console.log("✅ تم تفعيل الإشعارات.");
            }
        });
    }
}

// UPDATE: دالة تهيئة Push Notifications (تم تفعيلها الآن بمفاتيحك)
function setupPushNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.warn("🔔 الإشعارات غير مدعومة في هذا المتصفح.");
        return;
    }

    // ضع مفاتيحك هنا (اللي خدتها من موقع Firebase)
    const firebaseConfig = {
        apiKey: "AIzaSyB9BLwWu9Rwrxb8YTt2d9piYzpJSWUNJfs",
        authDomain: "phantom-eb05d.firebaseapp.com",
        projectId: "phantom-eb05d",
        storageBucket: "phantom-eb05d.firebasestorage.app",
        messagingSenderId: "140970616071",
        appId: "1:140970616071:web:8d30ef892b5b033ba711a2"
    };

    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
            console.log("✅ إذن الإشعارات تم منحه.");
            
            messaging.getToken({ vapidKey: "BFN_XhhCe98hG52WSgz2SzwcBjlQro0fzrF77lJ9vQXfB2HC92DMsxpn3a96CI1TAi3Lcpx2eS1FmdZb5UUeDYs" })
                .then((currentToken) => {
                    if (currentToken) {
                        console.log("✅ Token الجهاز (احفظه للاختبار):", currentToken);
                        localStorage.setItem("phantom_push_token", currentToken);
                    } else {
                        console.warn("⚠️ لم يتم الحصول على Token.");
                    }
                }).catch((err) => {
                    console.error("❌ خطأ في الحصول على Token:", err);
                });
        } else {
            console.warn("⚠️ تم رفض إذن الإشعارات.");
        }
    });

    messaging.onMessage((payload) => {
        console.log("📩 إشعار أثناء فتح التطبيق:", payload);
        showToast(payload.notification.body || "إشعار جديد", "info");
    });
}

/* ========================================================
   2. البيانات الأساسية
   ======================================================== */

function getBasicData() {
    if (typeof phantomData !== "undefined" && phantomData) {
        return phantomData;
    }
    console.warn("[PHANTOM] phantomData غير موجود — تأكد من تحميل data.js قبل script.js");
    return {
        sitePassword: "888888",
        adminPanelCode: "246810",
        founders: [],
        socialLinks: [],
        supportLinks: {},
        rooms: [],
        rules: { general: [], penalties: [], clearance: [] }
    };
}

// UPDATE: دوال مساعدة لنظام الطرد والرجوع (نقطة 4)
function getBannedUsers() {
    return getStorage("phantom_banned_users", {});
}

function setBannedUsers(data) {
    setStorage("phantom_banned_users", data);
}

function getRejoinRequests() {
    return getStorage("phantom_rejoin_requests", []);
}

function setRejoinRequests(data) {
    setStorage("phantom_rejoin_requests", data);
}

// UPDATE: دوال مساعدة لنظام النقاط والتصفير
function getLocalPoints() {
    return getStorage("phantom_user_points", {});
}

function setLocalPoints(points) {
    setStorage("phantom_user_points", points);
}

function resetSeasonPoints() {
    setLocalPoints({});
    // تصفير نقاط الصدارة في السيرفر أيضًا
    if (supabaseClient) {
        supabaseClient.from('leaderboard').delete().neq('id', 0).then(() => {
            console.log("✅ تم تصفير نقاط الموسم في السيرفر.");
        }).catch(err => console.warn("⚠️ فشل تصفير نقاط الموسم في السيرفر:", err));
    }
}

/* ========================================================
   3. Supabase API Layer (خالٍ تماماً من PHANTOM_API)
   ======================================================== */

const SUPABASE_URL = "https://dmbprvvjmgccgztrhkay.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_R9U_-JY91tV87uLBaZjCWQ_wRhVshA5";

let supabaseClient = null;
try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.warn("⚠️ فشل إنشاء عميل Supabase. سيتم استخدام localStorage كنسخة احتياطية.");
}

// دالة مساعدة للتحقق من اتصال Supabase
async function checkSupabaseConnection() {
    if (!supabaseClient) return false;
    try {
        const { error } = await supabaseClient.from('members').select('id').limit(1);
        return !error;
    } catch (e) {
        return false;
    }
}

// دوال مساعدة للتعامل مع Supabase مع fallback إلى localStorage
async function supabaseGet(table, orderBy = null) {
    if (!supabaseClient) return null;
    try {
        let query = supabaseClient.from(table).select('*');
        if (orderBy) query = query.order(orderBy, { ascending: true });
        const { data, error } = await query;
        if (error) throw error;
        return data;
    } catch (error) {
        console.warn(`⚠️ Supabase get ${table} error:`, error);
        return null;
    }
}

async function supabaseInsert(table, data) {
    if (!supabaseClient) return null;
    try {
        const { data: inserted, error } = await supabaseClient.from(table).insert(data);
        if (error) throw error;
        return inserted;
    } catch (error) {
        console.warn(`⚠️ Supabase insert ${table} error:`, error);
        return null;
    }
}

async function supabaseDelete(table, column, value) {
    if (!supabaseClient) return null;
    try {
        const { error } = await supabaseClient.from(table).delete().eq(column, value);
        if (error) throw error;
        return true;
    } catch (error) {
        console.warn(`⚠️ Supabase delete ${table} error:`, error);
        return null;
    }
}

// ------------------------------------------------------------
// استبدال دوال السيرفر القديمة
// ------------------------------------------------------------

async function serverGetMembers() {
    const result = await supabaseGet('members');
    return result || getStorage("phantom_server_members", []);
}

async function serverCreateMember(username, rank) {
    if (supabaseClient) {
        try {
            const { data: existing } = await supabaseClient.from('members').select('*').eq('name', username);
            if (existing && existing.length > 0) return existing[0];
        } catch (e) {}
    }

    const newMember = await supabaseInsert('members', [{ name: username, rank: rank || 'عضو' }]);
    if (newMember && newMember.length > 0) return newMember[0];

    // fallback: local storage
    const members = getStorage("phantom_custom_roster", []);
    const found = members.find(m => normalizeName(m.name) === normalizeName(username));
    if (found) return found;
    const localMember = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: username,
        rank: rank || 'عضو',
        status: 'موثق',
        points: 0,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        source: 'auto'
    };
    members.push(localMember);
    setStorage("phantom_custom_roster", members);
    return localMember;
}

async function serverUpdatePresence(memberId) { return true; }

async function serverGetChat() {
    const result = await supabaseGet('messages', 'timestamp');
    return result || getStorage(PHANTOM_MEMORY.chatStorageKey, []);
}

async function serverSendChat(message) {
    // تمت إزالة "id" من الرسالة ليتم إنشاؤه تلقائياً في السيرفر
    const result = await supabaseInsert('messages', [{ sender: message.sender, text: message.text, timestamp: message.timestamp }]);
    if (result) return result;
    // fallback: local storage
    const localChat = getStorage(PHANTOM_MEMORY.chatStorageKey, []);
    localChat.push(message);
    setStorage(PHANTOM_MEMORY.chatStorageKey, localChat.slice(-100));
    return [message];
}

async function serverGetLeaderboard() {
    const result = await supabaseGet('leaderboard');
    return result || [];
}

async function serverAddAttendance(memberId) { return true; }

async function serverCreateWarning(memberId, type, reason) {
    const data = { name: memberId, type, reason, date: new Date().toLocaleDateString('ar-EG') };
    const result = await supabaseInsert('warnings', [data]);
    if (result) return result;
    const warnings = getStorage("phantom_warnings", []);
    warnings.push({
        id: `warning_${Date.now()}`,
        name: memberId,
        type: type,
        reason: reason,
        date: new Date().toLocaleDateString('ar-EG')
    });
    setStorage("phantom_warnings", warnings);
    return [data];
}

async function serverGetWarnings() {
    const result = await supabaseGet('warnings');
    return result || getStorage("phantom_warnings", []);
}

async function serverDeleteWarning(id) {
    const result = await supabaseDelete('warnings', 'id', id);
    if (result) return result;
    let warnings = getStorage("phantom_warnings", []);
    warnings = warnings.filter(w => String(w.id) !== String(id));
    setStorage("phantom_warnings", warnings);
    return true;
}

async function serverGetPoll() {
    const polls = await supabaseGet('polls');
    if (polls && polls.length > 0) return polls[polls.length - 1];
    return getStorage(PHANTOM_MEMORY.pollStorageKey, null);
}

async function serverVotePoll(optionId) { return true; }

async function serverCancelPoll() {
    if (supabaseClient) {
        const polls = await supabaseGet('polls');
        if (polls && polls.length > 0) {
            const last = polls[polls.length - 1];
            await supabaseDelete('polls', 'id', last.id);
        }
    }
    removeStorage(PHANTOM_MEMORY.pollStorageKey);
    return true;
}

async function serverGetEvents() {
    const result = await supabaseGet('events');
    return result || getStorage(PHANTOM_MEMORY.eventsKey, []);
}

async function serverCreateEvent(data) {
    const result = await supabaseInsert('events', [data]);
    if (result) return result;
    const events = getStorage(PHANTOM_MEMORY.eventsKey, []);
    events.push(data);
    setStorage(PHANTOM_MEMORY.eventsKey, events);
    return [data];
}

async function serverDeleteEvent(id) {
    const result = await supabaseDelete('events', 'id', id);
    if (result) return result;
    let events = getStorage(PHANTOM_MEMORY.eventsKey, []);
    events = events.filter(e => String(e.id) !== String(id));
    setStorage(PHANTOM_MEMORY.eventsKey, events);
    return true;
}

async function serverGetUpdates() {
    const result = await supabaseGet('system_updates');
    return result || [];
}

async function checkServerConnection() {
    const online = await checkSupabaseConnection();
    localStorage.setItem("phantom_server_online", online ? "true" : "false");
    console.log(online ? "🟢 [SERVER] متصل" : "🟡 [SERVER] غير متصل - العمل محلياً عبر LocalStorage");
    return online;
}

async function syncCurrentUserWithServer(username) {
    if (!username) return null;
    try {
        const rank = isFounderSession() ? "رئيس" : "عضو";
        const member = await serverCreateMember(username, rank);
        if (member) {
            setStorage("phantom_current_server_member", member);
            return member;
        }
        return null;
    } catch (error) {
        return null;
    }
}

// ------------------------------------------------------------

/* ========================================================
   4. مفاتيح التخزين المؤقت
   ======================================================== */

const PHANTOM_MEMORY = {
    identityKey: "phantom_identity",
    identityVersion: 1,
    identityDurationDays: 30,
    founderSessionKey: "phantom_founder_session",
    chatStorageKey: "phantom_chat_messages",
    pollStorageKey: "phantom_active_poll",
    pollVoteKey: "phantom_user_voted_poll",
    presenceStorageKey: "phantom_site_presence",
    eventsKey: "phantom_events_list",
    heartsKey: "phantom_hearts",
    complaintsKey: "phantom_complaints",
    excusesKey: "phantom_excuses",
    attendanceRecordsKey: "phantom_attendance_records",
    nameChangeRequestsKey: "phantom_name_change_requests",
    privateMessagesKey: "phantom_private_messages",
    // UPDATE: مفاتيح جديدة
    clipsKey: "phantom_clips_data",
    commentsKey: "phantom_clips_comments"
};

/* ========================================================
   5. تشغيل النظام العام
   ======================================================== */

document.addEventListener("DOMContentLoaded", async () => {
    console.log("⚡ PHANTOM HQ SYSTEM STARTING...");

    await checkServerConnection();

    setupSeasonSystem();
    setupSecurityGate();
    setupNavigation();
    setupAdminPanel();
    setupEventsManager();
    setupChat();
    setupSeasonInfo();
    setupMemberInteraction();
    setupExcuseSystem();
    setupNameChange();
    setupPrivateMessages();

    // UPDATE: تشغيل الميزات الجديدة
    setupClips();
    setupVoiceCalls();
    setupPushNotifications();
    requestNotificationPermission();

    await loadServerData();

    renderAll();

    setupPresenceHeartbeat();
    setupChatRealtimeBridge();
    setupServiceWorker();

    const username = getCurrentUsername();
    if (username) updateUnreadCount(username);

    console.log("✅ PHANTOM HQ SYSTEM READY");
});

async function loadServerData() {
    try {
        const members = await serverGetMembers();
        if (Array.isArray(members)) setStorage("phantom_server_members", members);

        const warnings = await serverGetWarnings();
        if (Array.isArray(warnings)) setStorage("phantom_server_warnings", warnings);

        const poll = await serverGetPoll();
        if (poll !== null) setStorage(PHANTOM_MEMORY.pollStorageKey, poll);

        const chat = await serverGetChat();
        if (Array.isArray(chat)) setStorage(PHANTOM_MEMORY.chatStorageKey, chat);

        await serverGetEvents();
    } catch (error) {
        console.warn("[PHANTOM] Server data sync fallback activated.");
    }
}

/* ========================================================
   6. نظام الموسم
   ======================================================== */

function getArabicSeason(number) {
    const seasons = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
    return (number >= 1 && number <= 10) ? seasons[number - 1] : `الـ ${number}`;
}

function getCurrentSeasonState() {
    // UPDATE: تاريخ بداية الموسم الأول 20-8-2026
    const seasonStartString = "2026-08-20";
    const durationMonths = 2;
    const breakDays = 4;
    const now = new Date();
    let seasonNumber = 1;
    let currentStart = new Date(`${seasonStartString}T00:00:00`);
    while (true) {
        let currentActiveEnd = new Date(currentStart);
        currentActiveEnd.setMonth(currentActiveEnd.getMonth() + durationMonths);
        let currentBreakEnd = new Date(currentActiveEnd);
        currentBreakEnd.setDate(currentBreakEnd.getDate() + breakDays);
        if (now < currentStart) {
            return { status: "upcoming", seasonNumber, startDate: currentStart, targetDate: currentStart, isPointsLocked: true };
        } else if (now >= currentStart && now < currentActiveEnd) {
            return { status: "active", seasonNumber, startDate: currentStart, activeEndDate: currentActiveEnd, targetDate: currentActiveEnd, isPointsLocked: false };
        } else if (now >= currentActiveEnd && now < currentBreakEnd) {
            return { status: "break", seasonNumber, startDate: currentStart, breakEndDate: currentBreakEnd, targetDate: currentBreakEnd, isPointsLocked: true };
        }
        currentStart = new Date(currentBreakEnd);
        seasonNumber++;
    }
}

function setupSeasonSystem() {
    const state = getCurrentSeasonState();
    const badge = getElement("season-display-badge");
    if (badge) badge.textContent = `الموسم ${getArabicSeason(state.seasonNumber)}`;
    const savedSeason = Number(localStorage.getItem("phantom_active_season")) || 0;
    if (state.seasonNumber > savedSeason) {
        localStorage.setItem("phantom_active_season", String(state.seasonNumber));
        // تصفير نقاط الموسم عند بداية موسم جديد
        resetSeasonPoints();
        addSystemUpdate("تحديث الموسم", "انتهى الموسم السابق وتصفّرت نقاط الصدارة.", true);
    }
    setSession("phantom_season_state", {
        seasonNumber: state.seasonNumber,
        status: state.status,
        isPointsLocked: state.isPointsLocked,
        targetDate: state.targetDate.toISOString()
    });
    updateSeasonRemaining(state);
    if (!window.phantomSeasonTimer) {
        window.phantomSeasonTimer = setInterval(() => {
            updateSeasonRemaining(getCurrentSeasonState());
        }, 60 * 1000);
    }
}

function updateSeasonRemaining(state) {
    const daysElement = getElement("season-days-remaining");
    if (!daysElement) return;
    const difference = state.targetDate.getTime() - Date.now();
    const days = Math.ceil(difference / (24 * 60 * 60 * 1000));
    if (state.status === "break") daysElement.textContent = `استراحة (${days} يوم)`;
    else if (state.status === "upcoming") daysElement.textContent = `يبدأ خلال ${days} يوم`;
    else daysElement.textContent = `${days} يوم`;
}

function setupSeasonInfo() {
    const badge = getElement("season-display-badge");
    const modal = getElement("season-info-modal");
    const overlay = getElement("season-info-overlay");
    const close = getElement("close-season-info-btn");
    if (!badge || !modal) return;
    badge.addEventListener("click", () => {
        const state = getCurrentSeasonState();
        const nameElement = getElement("season-name-display");
        if (nameElement) nameElement.textContent = `الموسم ${getArabicSeason(state.seasonNumber)}`;
        updateSeasonRemaining(state);
        modal.classList.add("active");
        modal.setAttribute("aria-hidden", "false");
    });
    const closeModal = () => {
        modal.classList.remove("active");
        modal.setAttribute("aria-hidden", "true");
    };
    if (close) close.addEventListener("click", closeModal);
    if (overlay) overlay.addEventListener("click", closeModal);
}

/* ========================================================
   7. هوية المستخدم (محدثة لدعم ID)
   ======================================================== */

function createIdentity(username, password = "", userId = null) {
    return {
        version: PHANTOM_MEMORY.identityVersion,
        username: username,
        password: password, // تخزين مؤقت للدخول التلقائي (اختياري)
        userId: userId || generateUniqueId(), // توليد ID تلقائي إذا لم يوجد
        createdAt: Date.now(),
        expiresAt: Date.now() + PHANTOM_MEMORY.identityDurationDays * 24 * 60 * 60 * 1000
    };
}

function saveIdentity(username, password = "", userId = null) {
    if (!username) return false;
    return setStorage(PHANTOM_MEMORY.identityKey, createIdentity(username, password, userId));
}

function getSavedIdentity() {
    const identity = getStorage(PHANTOM_MEMORY.identityKey, null);
    if (!identity || !identity.username) return null;
    if (identity.version !== PHANTOM_MEMORY.identityVersion) {
        removeStorage(PHANTOM_MEMORY.identityKey);
        return null;
    }
    if (identity.expiresAt && Date.now() > identity.expiresAt) {
        clearIdentity();
        return null;
    }
    return identity;
}

function clearIdentity() {
    removeStorage(PHANTOM_MEMORY.identityKey);
    removeStorage("phantom_active_username");
    removeSession(PHANTOM_MEMORY.founderSessionKey);
}

function getCurrentUsername() {
    const identity = getSavedIdentity();
    if (identity && identity.username) return identity.username;
    return localStorage.getItem("phantom_active_username") || "";
}

function getCurrentUserId() {
    const identity = getSavedIdentity();
    if (identity && identity.userId) return identity.userId;
    return null;
}

function updateCurrentUser(username) {
    const display = getElement("current-user-display");
    if (display) {
        const rank = isFounderSession() ? "رئيس" : "عضو";
        display.textContent = username ? `${rank}: ${username}` : "غير مسجل";
    }
}

function ensureUserIsMember(username) {
    if (!username) return null;
    const normalized = normalizeName(username);
    const serverMembers = getStorage("phantom_server_members", []);
    const localMembers = getStorage("phantom_custom_roster", []);
    const allMembers = [...serverMembers, ...localMembers];
    const existing = allMembers.find(m => m && m.name && normalizeName(m.name) === normalized);
    if (existing) return existing;
    const newMember = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: username,
        rank: "عضو",
        status: "موثق",
        points: 0,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        source: "auto"
    };
    localMembers.push(newMember);
    setStorage("phantom_custom_roster", localMembers);
    return newMember;
}

function promoteUserToFounder(username) {
    if (!username) return;
    const normalized = normalizeName(username);
    const localMembers = getStorage("phantom_custom_roster", []);
    localMembers.forEach(member => {
        if (member && normalizeName(member.name) === normalized) member.rank = "رئيس";
    });
    setStorage("phantom_custom_roster", localMembers);
    if (supabaseClient) {
        supabaseClient.from('members').update({ rank: 'رئيس' }).eq('name', username)
            .then(() => console.log(`✅ تم ترقية ${username} إلى رئيس في السيرفر`))
            .catch(err => console.warn("⚠️ فشل ترقية الرتبة في السيرفر:", err));
    }
}

function updateMemberLastSeen(username) {
    if (!username) return;
    const members = getStorage("phantom_custom_roster", []);
    const normalized = normalizeName(username);
    let changed = false;
    members.forEach(member => {
        if (member && member.name && normalizeName(member.name) === normalized) {
            member.lastSeen = Date.now();
            changed = true;
        }
    });
    if (changed) setStorage("phantom_custom_roster", members);
}

/* ========================================================
   8. بوابة الدخول (محدثة: ID، كاش، طرد/رجوع)
   ======================================================== */

function setupSecurityGate() {
    const gate = getElement("security-gate");
    const step1 = getElement("gate-step-1");
    const step2 = getElement("gate-step-2");
    const passForm = getElement("gate-pass-form");
    const passInput = getElement("passcode-input");
    const passError = getElement("gate-error-msg");
    const nameForm = getElement("gate-name-form");
    const nameInput = getElement("username-input");
    const nameError = getElement("name-error-msg");
    
    // UPDATE: عناصر جديدة للـ ID والرجوع
    const idDisplayArea = getElement("gate-id-area") || document.createElement("div");
    const rejoinArea = getElement("gate-rejoin-area") || document.createElement("div");

    if (!gate) return;
    
    // التحقق من وجود عناصر جديدة في HTML، وإن لم تكن موجودة نضيفها ديناميكياً
    if (!getElement("gate-id-area")) {
        idDisplayArea.id = "gate-id-area";
        idDisplayArea.style.cssText = "display:none; margin-top:15px; text-align:center;";
        idDisplayArea.innerHTML = `
            <div style="display:flex; gap:10px; justify-content:center; align-items:center; flex-wrap:wrap;">
                <div style="background:rgba(255,255,255,0.05); padding:10px 15px; border-radius:8px; border:1px solid var(--gold-main,#d4af37);">
                    <span style="font-size:0.8rem; color:var(--silver-muted,#aaa);">معرفك الفريد (ID):</span>
                    <strong id="user-generated-id" style="color:#fff; display:block; font-size:1.1rem; margin-top:4px;">---</strong>
                </div>
                <button id="copy-id-btn" class="btn-primary" style="padding:8px 16px; border-radius:6px; cursor:pointer;">📋 نسخ</button>
                <button id="enter-site-btn" class="btn-success" style="padding:8px 16px; border-radius:6px; cursor:pointer; opacity:0.5; pointer-events:none;">🚪 دخول الموقع</button>
            </div>
        `;
        gate.appendChild(idDisplayArea);
    }

    if (!getElement("gate-rejoin-area")) {
        rejoinArea.id = "gate-rejoin-area";
        rejoinArea.style.cssText = "display:none; margin-top:15px; text-align:center;";
        rejoinArea.innerHTML = `
            <div style="background:rgba(255,77,77,0.1); padding:15px; border-radius:8px; border:1px solid var(--red-danger,#ff4d4d);">
                <p style="color:var(--red-danger,#ff4d4d); font-weight:bold; margin-bottom:10px;">🚫 أنت مطرود من الكلان</p>
                <input id="rejoin-request-input" type="text" placeholder="اكتب طلبك للرجوع..." style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border); background:rgba(255,255,255,0.05); color:#fff; margin-bottom:8px;">
                <button id="send-rejoin-btn" class="btn-warning" style="padding:8px 16px; border-radius:6px; cursor:pointer;">إرسال طلب الرجوع</button>
            </div>
        `;
        gate.appendChild(rejoinArea);
    }

    const data = getBasicData();
    const correctPassword = String(data.sitePassword || "888888");
    const savedIdentity = getSavedIdentity();

    // UPDATE: التحقق من حالة الطرد عند الدخول التلقائي
    if (savedIdentity && savedIdentity.username) {
        const username = savedIdentity.username;
        const bannedUsers = getBannedUsers();
        if (bannedUsers[username] && bannedUsers[username].status === 'banned') {
            // إذا كان مطروداً، نعرض له شاشة الطرد
            gate.classList.remove("unlocked");
            step1.classList.remove("active");
            step2.classList.remove("active");
            showBannedScreen(username);
            return;
        }
        // إذا غير مطرود، ندخل بشكل طبيعي
        ensureUserIsMember(username);
        updateMemberLastSeen(username);
        updateCurrentUser(username);
        registerPresence(username);
        gate.classList.add("unlocked");
        syncCurrentUserWithServer(username).catch(() => {});
        return;
    }

    // عملية الدخول العادية
    if (passForm) {
        passForm.addEventListener("submit", event => {
            event.preventDefault();
            const entered = passInput ? passInput.value.trim() : "";
            if (entered === correctPassword) {
                if (step1) step1.classList.remove("active");
                if (step2) step2.classList.add("active");
                if (passError) passError.textContent = "";
                if (nameError) nameError.textContent = "";
                if (nameInput) setTimeout(() => nameInput.focus(), 150);
            } else {
                if (passError) passError.textContent = "❌ رمز الدخول غير صحيح";
                if (passInput) { passInput.value = ""; passInput.focus(); }
                shakeElement(passInput);
            }
        });
    }

    if (nameForm) {
        nameForm.addEventListener("submit", async event => {
            event.preventDefault();
            const username = nameInput ? nameInput.value.trim() : "";
            const password = passInput ? passInput.value.trim() : ""; // تخزين الباسوورد للكاش
            if (username.length < 2) {
                if (nameError) nameError.textContent = "اكتب اسمك بشكل صحيح.";
                shakeElement(nameInput);
                return;
            }

            // UPDATE: التحقق من حالة الطرد قبل إكمال الدخول
            const bannedUsers = getBannedUsers();
            if (bannedUsers[username] && bannedUsers[username].status === 'banned') {
                // إخفاء الخطوة 2 وإظهار شاشة الطرد
                if (step2) step2.classList.remove("active");
                showBannedScreen(username);
                return;
            }

            // إذا كان مسموحاً، نكمل عملية الدخول
            // توليد ID وحفظ البيانات في الكاش
            const userId = generateUniqueId();
            saveIdentity(username, password, userId);
            setStorage("phantom_active_username", username);

            // عرض الـ ID وزر النسخ وزر الدخول
            const idDisplay = document.getElementById("user-generated-id");
            const copyBtn = document.getElementById("copy-id-btn");
            const enterBtn = document.getElementById("enter-site-btn");
            const idArea = document.getElementById("gate-id-area");

            if (idArea) idArea.style.display = "block";
            if (idDisplay) idDisplay.textContent = userId;
            if (copyBtn) {
                copyBtn.onclick = function() {
                    navigator.clipboard.writeText(userId).then(() => {
                        showToast("✅ تم نسخ الـ ID بنجاح!", "success");
                        if (enterBtn) {
                            enterBtn.style.opacity = "1";
                            enterBtn.style.pointerEvents = "auto";
                        }
                    }).catch(() => {
                        // Fallback للنسخ
                        const textArea = document.createElement("textarea");
                        textArea.value = userId;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        showToast("✅ تم نسخ الـ ID!", "success");
                        if (enterBtn) {
                            enterBtn.style.opacity = "1";
                            enterBtn.style.pointerEvents = "auto";
                        }
                    });
                };
            }

            if (enterBtn) {
                enterBtn.onclick = async function() {
                    // بعد الضغط على دخول، نفتح البوابة ونخزن الكاش
                    const localMember = ensureUserIsMember(username);
                    updateMemberLastSeen(username);
                    updateCurrentUser(username);
                    registerPresence(username);
                    gate.classList.add("unlocked");
                    if (nameError) nameError.textContent = "";
                    const serverMember = await syncCurrentUserWithServer(username);
                    if (serverMember) {
                        let members = getStorage("phantom_server_members", []);
                        const index = members.findIndex(m => m && m.id === serverMember.id);
                        if (index === -1) members.push(serverMember);
                        else members[index] = serverMember;
                        setStorage("phantom_server_members", members);
                        setStorage("phantom_current_server_member", serverMember);
                    } else if (localMember) {
                        setStorage("phantom_current_server_member", localMember);
                    }
                    renderAll();
                };
            }
        });
    }
}

// UPDATE: دالة عرض شاشة الطرد والرجوع (نقطة 4)
function showBannedScreen(username) {
    const gate = getElement("security-gate");
    const rejoinArea = document.getElementById("gate-rejoin-area");
    const step1 = getElement("gate-step-1");
    const step2 = getElement("gate-step-2");

    if (step1) step1.classList.remove("active");
    if (step2) step2.classList.remove("active");
    if (gate) gate.classList.remove("unlocked");

    const bannedUsers = getBannedUsers();
    const userStatus = bannedUsers[username];

    // إذا كان مرفوضاً، اعرض لافتة حمراء
    if (userStatus && userStatus.status === 'rejected') {
        if (rejoinArea) {
            rejoinArea.style.display = "block";
            rejoinArea.innerHTML = `
                <div style="background:rgba(255,0,0,0.2); padding:20px; border-radius:8px; border:2px solid var(--red-danger,#ff4d4d); text-align:center;">
                    <h2 style="color:#ff4d4d; font-size:2rem;">🚫</h2>
                    <p style="color:#fff; font-weight:bold; font-size:1.2rem;">تم رفض طلبك للعودة</p>
                    <p style="color:var(--silver-muted,#aaa); font-size:0.9rem;">لا يمكنك الدخول إلا بموافقة المؤسسين</p>
                </div>
            `;
        }
        return;
    }

    // إذا كان مطروداً، اعرض نموذج طلب الرجوع
    if (rejoinArea) {
        rejoinArea.style.display = "block";
        const existingForm = rejoinArea.querySelector("#send-rejoin-btn");
        if (!existingForm) {
            rejoinArea.innerHTML = `
                <div style="background:rgba(255,77,77,0.1); padding:15px; border-radius:8px; border:1px solid var(--red-danger,#ff4d4d);">
                    <p style="color:var(--red-danger,#ff4d4d); font-weight:bold; margin-bottom:10px;">🚫 أنت مطرود من الكلان</p>
                    <input id="rejoin-request-input" type="text" placeholder="اكتب طلبك للرجوع..." style="width:100%; padding:10px; border-radius:6px; border:1px solid var(--border); background:rgba(255,255,255,0.05); color:#fff; margin-bottom:8px;">
                    <button id="send-rejoin-btn" class="btn-warning" style="padding:8px 16px; border-radius:6px; cursor:pointer;">إرسال طلب الرجوع</button>
                </div>
            `;
        }
        const sendBtn = document.getElementById("send-rejoin-btn");
        const input = document.getElementById("rejoin-request-input");
        if (sendBtn && input) {
            sendBtn.onclick = function() {
                const message = input.value.trim();
                if (!message) {
                    showToast("اكتب رسالة لطلب الرجوع.", "error");
                    return;
                }
                // إرسال الطلب إلى السيرفر/التخزين
                const requests = getRejoinRequests();
                requests.push({
                    id: `rejoin_${Date.now()}`,
                    username: username,
                    message: message,
                    timestamp: Date.now(),
                    status: 'pending' // pending, accepted, rejected
                });
                setRejoinRequests(requests);
                showToast("✅ تم إرسال طلب الرجوع للمؤسسين.", "success");
                input.value = "";
                // تحديث لوحة القيادة للمؤسسين تلقائياً
                renderFounderNotifications();
                // إظهار رسالة انتظار
                rejoinArea.innerHTML = `
                    <div style="background:rgba(212,175,55,0.1); padding:15px; border-radius:8px; border:1px solid var(--gold-main,#d4af37); text-align:center;">
                        <p style="color:var(--gold-main,#d4af37); font-weight:bold;">⏳ تم إرسال طلبك، في انتظار موافقة المؤسسين</p>
                    </div>
                `;
            };
        }
    }
}

/* ========================================================
   9. التواجد أونلاين (محدث لعرض العدد فقط في الشات)
   ======================================================== */

function registerPresence(username) {
    if (!username) return;
    let users = getStorage(PHANTOM_MEMORY.presenceStorageKey, []);
    const now = Date.now();
    users = users.filter(user => user && user.time && now - user.time < 30 * 60 * 1000);
    const normalized = normalizeName(username);
    const index = users.findIndex(user => normalizeName(user.name) === normalized);
    if (index !== -1) {
        users[index].name = username;
        users[index].time = now;
    } else {
        users.push({ name: username, time: now });
    }
    setStorage(PHANTOM_MEMORY.presenceStorageKey, users);
    updateMemberLastSeen(username);
    renderOnlineUsers();
    renderChatOnlineCount(); // تحديث عداد الشات
}

function setupPresenceHeartbeat() {
    const username = getCurrentUsername();
    if (!username) return;
    registerPresence(username);
    setInterval(() => {
        const currentUser = getCurrentUsername();
        if (currentUser) registerPresence(currentUser);
    }, 60 * 1000);
}

function renderOnlineUsers() {
    const container = getElement("online-members-list");
    const badge = getElement("online-count-badge");
    if (!container) return;
    let users = getStorage(PHANTOM_MEMORY.presenceStorageKey, []);
    const now = Date.now();
    users = users.filter(user => user && user.time && now - user.time < 30 * 60 * 1000);
    setStorage(PHANTOM_MEMORY.presenceStorageKey, users);
    if (badge) badge.textContent = `${users.length} متواجد الآن`;
    if (!users.length) {
        container.innerHTML = `<div class="empty-state">لا يوجد أعضاء متواجدون حالياً.</div>`;
        return;
    }
    container.innerHTML = users.map(user => `
        <div class="online-user-item">
            <div>
                <div class="online-user-name">${escapeHTML(user.name)}</div>
                <div class="online-user-status">يتصفح مقر PHANTOM</div>
            </div>
            <span style="color:var(--green-online,#00ff88); font-size:.7rem; font-weight:800;">● متواجد</span>
        </div>
    `).join("");
}

// UPDATE: عرض عدد المتصلين في الشات فقط (بدون أسماء) (نقطة 1)
function renderChatOnlineCount() {
    const chatCounter = getElement("chat-online-counter");
    if (!chatCounter) return;
    let users = getStorage(PHANTOM_MEMORY.presenceStorageKey, []);
    const now = Date.now();
    users = users.filter(user => user && user.time && now - user.time < 30 * 60 * 1000);
    chatCounter.textContent = `${users.length} متصلين حالياً`;
}

/* ========================================================
   10. التنقل بين الصفحات
   ======================================================== */

function setupNavigation() {
    const elements = document.querySelectorAll("[data-target]");
    const pages = document.querySelectorAll(".page-view");
    const dock = document.querySelectorAll(".dock-item");
    elements.forEach(element => {
        element.addEventListener("click", event => {
            event.preventDefault();
            const target = element.getAttribute("data-target");
            if (!target) return;
            pages.forEach(page => page.classList.toggle("active", page.id === target));
            dock.forEach(item => item.classList.toggle("active", item.getAttribute("data-target") === target));
            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });
}

/* ========================================================
   11. لوحة القيادة (محدثة: إشعارات الشكاوي + طلبات الرجوع)
   ======================================================== */

function setupAdminPanel() {
    const trigger = getElement("admin-panel-trigger");
    const modal = getElement("admin-modal");
    const overlay = getElement("admin-overlay");
    const close = getElement("close-admin-btn");
    const login = getElement("admin-login-btn");
    const input = getElement("admin-pass-input");
    const error = getElement("admin-auth-error");
    const authStep = getElement("admin-auth-step");
    const toolsStep = getElement("admin-tools-step");
    if (trigger && modal) {
        trigger.addEventListener("click", () => {
            modal.classList.add("active");
            if (input) setTimeout(() => input.focus(), 200);
            populateAdminSelects();
            checkAdminPermissions();
            renderFounderNotifications();
            renderChatMonitor();
        });
    }
    if (close && modal) close.addEventListener("click", () => modal.classList.remove("active"));
    if (overlay && modal) overlay.addEventListener("click", () => modal.classList.remove("active"));
    if (login) {
        login.addEventListener("click", async () => {
            const entered = input ? input.value.trim() : "";
            const data = getBasicData();
            const correctCode = String(data.adminPanelCode || "246810");
            if (entered === correctCode) {
                const currentUser = getCurrentUsername();
                promoteUserToFounder(currentUser);
                setSession(PHANTOM_MEMORY.founderSessionKey, {
                    active: true,
                    username: currentUser,
                    grantedAt: Date.now()
                });
                if (currentUser) {
                    await syncCurrentUserWithServer(currentUser).catch(() => {});
                    updateCurrentUser(currentUser);
                }
                if (authStep) authStep.style.display = "none";
                if (toolsStep) toolsStep.style.display = "block";
                if (error) error.textContent = "";
                if (input) input.value = "";
                addSystemUpdate("ترقية قيادية", `تم تسجيل دخول ${currentUser} إلى لوحة الرؤساء.`, true);
                populateAdminSelects();
                checkAdminPermissions();
                renderFounderNotifications();
                renderChatMonitor();
                renderAll();
                showToast(`تم التحقق بنجاح. مرحباً بك يا رئيس (${currentUser}).`, "success");
            } else {
                if (error) error.textContent = "❌ رمز الرؤساء غير صحيح";
                if (input) { input.value = ""; input.focus(); }
                shakeElement(input);
            }
        });
    }
    setupAttendance();
    setupWarnings();
    setupPollCreator();
    setupAddMember();
    setupKickMember();
}

function isFounderSession() {
    const session = getSession(PHANTOM_MEMORY.founderSessionKey, null);
    return !!(session && session.active === true);
}

function checkAdminPermissions() {
    const restricted = getElement("restricted-kick-section");
    if (!restricted) return;
    restricted.style.display = isFounderSession() ? "block" : "none";
}

// UPDATE: عرض إشعارات الشكاوي وطلبات الرجوع (نقطة 3 و 4)
function renderFounderNotifications() {
    const list = getElement("founder-notifications-list");
    const count = getElement("founder-alert-count");
    if (!list) return;
    const warnings = getWarnings();
    const nameRequests = getStorage(PHANTOM_MEMORY.nameChangeRequestsKey, []);
    const complaints = getStorage(PHANTOM_MEMORY.complaintsKey, []);
    const excuses = getStorage(PHANTOM_MEMORY.excusesKey, []);
    const rejoinRequests = getRejoinRequests(); // طلبات الرجوع
    const total = warnings.length + nameRequests.length + complaints.length + excuses.length + rejoinRequests.length;
    if (count) count.textContent = String(total);
    let html = `
        <div class="admin-mini-item">
            <span>🛡️ حالة القيادة</span>
            <strong>${isFounderSession() ? "رئيس نشط" : "عضو عادي"}</strong>
        </div>
        <div class="admin-mini-item">
            <span>🚨 إنذارات نشطة</span>
            <strong>${warnings.length}</strong>
        </div>
    `;
    nameRequests.forEach(req => {
        html += `
            <div class="admin-mini-item" style="border-right:3px solid var(--cyan);">
                <span><strong>📝 طلب تغيير اسم:</strong> ${escapeHTML(req.oldName)} → ${escapeHTML(req.newName)}</span>
                <span>
                    <button class="btn-success" style="padding:2px 8px;font-size:0.7rem;" onclick="approveNameChange('${req.id}')">موافق</button>
                    <button class="btn-danger" style="padding:2px 8px;font-size:0.7rem;" onclick="rejectNameChange('${req.id}')">رفض</button>
                </span>
            </div>
        `;
    });
    complaints.forEach(comp => {
        html += `
            <div class="admin-mini-item" style="border-right:3px solid var(--red);">
                <span><strong>📩 شكوى من ${escapeHTML(comp.from)} ضد ${escapeHTML(comp.target)}:</strong> ${escapeHTML(comp.reason)}</span>
                <div style="display:flex; flex-wrap:wrap; gap:4px; margin-top:4px;">
                    <button class="btn-success" style="padding:2px 6px;font-size:0.6rem;" onclick="acceptComplaint('${comp.id}')">قبول</button>
                    <button class="btn-danger" style="padding:2px 6px;font-size:0.6rem;" onclick="rejectComplaint('${comp.id}')">رفض</button>
                    <button class="btn-warning" style="padding:2px 6px;font-size:0.6rem;" onclick="giveWarningToComplaint('${comp.id}')">تنبيه</button>
                    <button class="btn-danger" style="padding:2px 6px;font-size:0.6rem;" onclick="giveBanToComplaint('${comp.id}')">إنذار</button>
                    <button class="btn-secondary" style="padding:2px 6px;font-size:0.6rem;" onclick="dismissComplaint('${comp.id}')">فض</button>
                </div>
            </div>
        `;
    });
    excuses.forEach(exc => {
        html += `
            <div class="admin-mini-item" style="border-right:3px solid var(--yellow);">
                <span><strong>⏳ عذر من ${escapeHTML(exc.from)}:</strong> ${escapeHTML(exc.reason)}</span>
                <span>
                    <button class="btn-success" style="padding:2px 8px;font-size:0.7rem;" onclick="acceptExcuse('${exc.id}')">قبول</button>
                    <button class="btn-danger" style="padding:2px 8px;font-size:0.7rem;" onclick="rejectExcuse('${exc.id}')">رفض</button>
                </span>
            </div>
        `;
    });
    // عرض طلبات الرجوع للكلان (نقطة 4)
    rejoinRequests.forEach(req => {
        if (req.status === 'pending') {
            html += `
                <div class="admin-mini-item" style="border-right:3px solid var(--gold-main); background:rgba(212,175,55,0.05);">
                    <span><strong>🔁 طلب رجوع من ${escapeHTML(req.username)}:</strong> ${escapeHTML(req.message)}</span>
                    <div style="display:flex; gap:4px; margin-top:4px;">
                        <button class="btn-success" style="padding:2px 8px;font-size:0.7rem;" onclick="approveRejoin('${req.id}')">✅ قبول</button>
                        <button class="btn-danger" style="padding:2px 8px;font-size:0.7rem;" onclick="rejectRejoin('${req.id}')">❌ رفض</button>
                    </div>
                </div>
            `;
        }
    });
    list.innerHTML = html;
}

// UPDATE: دوال معالجة طلبات الرجوع (قبول/رفض + 4 ساعات + تصفير نقاط)
function approveRejoin(id) {
    let requests = getRejoinRequests();
    const request = requests.find(r => r.id === id);
    if (!request) return;
    request.status = 'accepted';
    request.acceptedAt = Date.now();
    setRejoinRequests(requests);

    // جدولة تفعيل الحساب بعد 4 ساعات
    const reactivationTime = Date.now() + 4 * 60 * 60 * 1000;
    setStorage(`rejoin_reactivation_${request.username}`, reactivationTime);

    // إزالة من قائمة المطرودين مؤقتاً (سيتم تفعيلها بعد 4 ساعات)
    let bannedUsers = getBannedUsers();
    if (bannedUsers[request.username]) {
        bannedUsers[request.username].status = 'pending_reactivation';
        bannedUsers[request.username].reactivationTime = reactivationTime;
        setBannedUsers(bannedUsers);
    }

    addSystemUpdate("قبول رجوع", `تم قبول طلب رجوع ${request.username}. سيتم تفعيل الحساب بعد 4 ساعات.`, true);
    showToast(`✅ تم قبول طلب ${request.username}، سيتم تفعيله بعد 4 ساعات.`, "success");
    renderFounderNotifications();

    // تصفير نقاط الموسم عند التفعيل (سيتم تنفيذه عند التفعيل الفعلي)
    // سنضع مؤقتاً للتحقق
    setTimeout(() => {
        activateRejoinUser(request.username);
    }, 4 * 60 * 60 * 1000);
}

function activateRejoinUser(username) {
    let bannedUsers = getBannedUsers();
    if (bannedUsers[username] && bannedUsers[username].status === 'pending_reactivation') {
        delete bannedUsers[username]; // إزالة الحظر
        setBannedUsers(bannedUsers);
        // تصفير النقاط
        resetSeasonPoints();
        // إضافة إشعار
        addSystemUpdate("تفعيل حساب", `تم تفعيل حساب ${username} بعد الموافقة، وتم تصفير نقاط الموسم.`, true);
        showToast(`✅ تم تفعيل حساب ${username} و تصفير نقاطه.`, "success");
        // إزالة جدولة التفعيل
        removeStorage(`rejoin_reactivation_${username}`);
    }
}

function rejectRejoin(id) {
    let requests = getRejoinRequests();
    const request = requests.find(r => r.id === id);
    if (!request) return;
    request.status = 'rejected';
    setRejoinRequests(requests);

    // تحديث حالة العضو إلى مرفوض نهائياً
    let bannedUsers = getBannedUsers();
    if (bannedUsers[request.username]) {
        bannedUsers[request.username].status = 'rejected';
        setBannedUsers(bannedUsers);
    }

    addSystemUpdate("رفض رجوع", `تم رفض طلب رجوع ${request.username}.`, true);
    showToast(`❌ تم رفض طلب ${request.username}.`, "info");
    renderFounderNotifications();
}

function renderChatMonitor() {
    const container = getElement("chat-monitor-container");
    if (!container) return;
    const messages = getStorage(PHANTOM_MEMORY.chatStorageKey, []).slice(-15).reverse();
    if (!messages.length) {
        container.innerHTML = `<span style="font-size:.75rem; color:var(--silver-muted,#aaa);">لا توجد رسائل بعد.</span>`;
        return;
    }
    container.innerHTML = messages.map(msg => `
        <div class="admin-mini-item">
            <span><strong>${escapeHTML(msg.sender)}</strong>: ${escapeHTML(msg.text)}</span>
        </div>
    `).join("");
}

/* ========================================================
   12. إدارة الرومات والفاعليات (إنشاء + إلغاء عبر Popup)
   ======================================================== */

function getEventsList() {
    return getStorage(PHANTOM_MEMORY.eventsKey, []);
}

function setupEventsManager() {
    const createBtn = getElement("create-event-btn");
    const modeSelect = getElement("room-mode-select");
    const titleInput = getElement("event-title-input");
    const descriptionInput = getElement("event-description-input");
    const rulesInput = getElement("event-rules-input");
    const timingSelect = getElement("event-timing-select");
    const datetimeInput = getElement("event-datetime-input");
    const openPopupBtn = getElement("open-cancel-room-btn");
    const popup = getElement("cancel-room-popup");
    const activeSelect = getElement("active-events-select");
    const emptyMsg = getElement("cancel-room-empty-msg");
    const confirmBtn = getElement("confirm-cancel-event-btn");
    const closePopupBtn = getElement("close-cancel-room-popup-btn");
    if (createBtn) {
        createBtn.addEventListener("click", async () => {
            if (!isFounderSession()) {
                showToast("⚠️ إنشاء الرومات مخصص للرؤساء فقط.", "error");
                return;
            }
            const mode = modeSelect ? modeSelect.value : "";
            const title = titleInput ? titleInput.value.trim() : "";
            const description = descriptionInput ? descriptionInput.value.trim() : "";
            const rules = rulesInput ? rulesInput.value.trim() : "";
            const timing = timingSelect ? timingSelect.value : "none";
            let datetime = datetimeInput ? datetimeInput.value : "";
            if (!mode || !title) {
                showToast("⚠️ اختر المود واكتب اسم الروم أولاً.", "error");
                if (modeSelect && !mode) shakeElement(modeSelect);
                if (titleInput && !title) shakeElement(titleInput);
                return;
            }
            let timingLabel = "بدون وقت محدد";
            if (timing === "5min") timingLabel = "5 دقائق";
            else if (timing === "1hour") timingLabel = "ساعة واحدة";
            else if (timing === "1day") timingLabel = "يوم واحد";
            else if (timing === "custom") {
                if (!datetime) {
                    showToast("⚠️ اختر تاريخ ووقت للفاعلية.", "error");
                    return;
                }
                timingLabel = `محدد: ${new Date(datetime).toLocaleString("ar-EG")}`;
            }
            const newEvent = {
                id: `event_${Date.now()}`,
                mode: mode,
                title: title,
                description: description,
                rules: rules,
                timing: timing,
                timingLabel: timingLabel,
                datetime: datetime,
                createdAt: Date.now(),
                createdBy: getCurrentUsername()
            };
            await serverCreateEvent(newEvent);
            const events = getEventsList();
            events.push(newEvent);
            setStorage(PHANTOM_MEMORY.eventsKey, events);
            if (modeSelect) modeSelect.selectedIndex = 0;
            if (titleInput) titleInput.value = "";
            if (descriptionInput) descriptionInput.value = "";
            if (rulesInput) rulesInput.value = "";
            if (timingSelect) timingSelect.selectedIndex = 0;
            if (datetimeInput) datetimeInput.value = "";
            const announcement = `📢 فاعلية جديدة: ${title}\n📝 الوصف: ${description || "بدون وصف"}\n📜 القوانين: ${rules || "بدون قوانين خاصة"}\n⏰ التوقيت: ${timingLabel}\n🎮 المود: ${mode}`;
            addSystemUpdate("فاعلية جديدة", announcement, true);
            showToast(`🎯 تم إنشاء روم "${title}" بنجاح!`, "success");
            renderRooms();
        });
    }
    if (openPopupBtn && popup) {
        openPopupBtn.addEventListener("click", () => {
            populateActiveEventsSelect();
            popup.style.display = "block";
        });
    }
    if (closePopupBtn && popup) {
        closePopupBtn.addEventListener("click", () => {
            popup.style.display = "none";
        });
    }
    if (confirmBtn) {
        confirmBtn.addEventListener("click", async () => {
            if (!isFounderSession()) {
                showToast("⚠️ إلغاء الرومات مخصص للرؤساء فقط.", "error");
                return;
            }
            const selectedId = activeSelect ? activeSelect.value : "";
            if (!selectedId) {
                showToast("⚠️ اختر الروم المراد إلغاؤه أولاً.", "error");
                return;
            }
            await serverDeleteEvent(selectedId);
            let events = getEventsList();
            const target = events.find(e => String(e.id) === String(selectedId));
            events = events.filter(e => String(e.id) !== String(selectedId));
            setStorage(PHANTOM_MEMORY.eventsKey, events);
            if (target) addSystemUpdate("إلغاء روم", `تم إلغاء الروم: "${target.title}".`, true);
            showToast("🗑️ تم إلغاء الروم بنجاح.", "success");
            populateActiveEventsSelect();
            renderRooms();
            if (popup) popup.style.display = "none";
        });
    }
    if (timingSelect && datetimeInput) {
        timingSelect.addEventListener("change", () => {
            if (timingSelect.value === "custom") {
                datetimeInput.style.display = "block";
            } else {
                datetimeInput.style.display = "none";
                datetimeInput.value = "";
            }
        });
        datetimeInput.style.display = "none";
    }
}

function populateActiveEventsSelect() {
    const select = getElement("active-events-select");
    const emptyMsg = getElement("cancel-room-empty-msg");
    if (!select) return;
    const events = getEventsList();
    if (!events.length) {
        select.style.display = "none";
        if (emptyMsg) emptyMsg.style.display = "block";
        select.innerHTML = `<option value="">اختر الروم المراد حذفه</option>`;
        return;
    }
    select.style.display = "block";
    if (emptyMsg) emptyMsg.style.display = "none";
    select.innerHTML = `<option value="">اختر الروم المراد حذفه</option>` + events.map(event => `
        <option value="${escapeHTML(event.id)}">
            🎮 ${escapeHTML(event.title)} — ${escapeHTML(event.mode)}
        </option>
    `).join("");
}

function renderRooms() {
    const container = getElement("schedule-grid");
    if (!container) return;
    const data = getBasicData();
    const staticRooms = Array.isArray(data.rooms) ? data.rooms : [];
    const dynamicEvents = getEventsList();
    let html = "";
    if (dynamicEvents.length) {
        html += dynamicEvents.map(ev => `
            <div class="event-card-item" style="padding:12px; background:rgba(212,175,55,0.08); border-right:4px solid var(--gold-main,#d4af37); margin-bottom:10px; border-radius:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:#fff; font-size:1.05rem;">🎯 ${escapeHTML(ev.title)}</strong>
                    <span style="font-size:0.75rem; background:var(--gold-main,#d4af37); color:#000; padding:2px 6px; border-radius:4px; font-weight:bold;">${escapeHTML(ev.mode)}</span>
                </div>
                ${ev.description ? `<p style="font-size:0.85rem; color:var(--silver-muted,#aaa); margin-top:4px;">📝 ${escapeHTML(ev.description)}</p>` : ""}
                ${ev.rules ? `<p style="font-size:0.8rem; color:var(--gold-main,#d4af37); margin-top:2px;">📜 قوانين الفاعلية: ${escapeHTML(ev.rules)}</p>` : ""}
                ${ev.timingLabel ? `<small style="color:var(--silver-muted,#aaa); display:block; margin-top:4px;">⏰ ${escapeHTML(ev.timingLabel)}</small>` : ""}
                ${ev.datetime ? `<small style="color:var(--silver-muted,#aaa); display:block; margin-top:2px;">📅 ${escapeHTML(new Date(ev.datetime).toLocaleString("ar-EG"))}</small>` : ""}
            </div>
        `).join("");
    }
    if (staticRooms.length) {
        html += staticRooms.map(room => `
            <div class="schedule-card" style="padding:12px; background:rgba(255,255,255,0.03); border-right:3px solid var(--gold-main,#d4af37); margin-bottom:8px; border-radius:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:#fff; font-size:1rem;">${escapeHTML(room.title)}</strong>
                    <span style="font-size:0.7rem; color:var(--silver-muted,#aaa);">${escapeHTML(room.status || "")}</span>
                </div>
                <small style="color:var(--silver-muted,#aaa); font-size:0.85rem; display:block; margin-top:4px;">🎮 ${escapeHTML(room.mode)} — 📅 ${escapeHTML(room.day)} ⏰ ${escapeHTML(room.time)}</small>
                ${room.description ? `<p style="font-size:0.8rem; color:var(--silver-muted,#aaa); margin-top:6px;">${escapeHTML(room.description)}</p>` : ""}
            </div>
        `).join("");
    }
    if (!html) {
        html = `<div class="empty-state">لا توجد رومات أو فاعليات حالياً.</div>`;
    }
    container.innerHTML = html;
}

/* ========================================================
   13. التحديثات المؤقتة (تُحذف تلقائياً)
   ======================================================== */

function getSystemUpdates() {
    const updates = getStorage("phantom_system_updates", []);
    const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const validUpdates = updates.filter(update => !update.timestamp || (now - update.timestamp) < ONE_WEEK);
    if (validUpdates.length !== updates.length) setStorage("phantom_system_updates", validUpdates);
    return validUpdates;
}

function addSystemUpdate(title, description, isMajor = false) {
    const updates = getSystemUpdates();
    updates.push({
        id: Date.now(),
        timestamp: Date.now(),
        title: title,
        description: description,
        date: new Date().toLocaleString("ar-EG"),
        isMajor: isMajor
    });
    setStorage("phantom_system_updates", updates.slice(-50));
    renderSystemUpdates();
}

async function renderSystemUpdates() {
    const area = getElement("system-updates-list");
    if (!area) return;
    let updates = getSystemUpdates();
    const serverUpdates = await serverGetUpdates();
    if (Array.isArray(serverUpdates) && serverUpdates.length) {
        const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
        const now = Date.now();
        updates = [...updates, ...serverUpdates.filter(u => !u.timestamp || (now - u.timestamp) < ONE_WEEK)];
    }
    updates = updates.filter(u => u.isMajor === true);
    if (!updates.length) {
        area.innerHTML = `<div class="admin-mini-item"><span>لا توجد تحديثات كبيرة حالياً.</span></div>`;
        return;
    }
    area.innerHTML = updates.slice(-20).reverse().map(update => `
        <div class="admin-mini-item">
            <div>
                <strong>${escapeHTML(update.title || "تحديث")}</strong><br>
                <small>${escapeHTML(update.description || "")}</small><br>
                <small style="color:var(--silver-muted,#aaa); font-size:0.65rem;">${escapeHTML(update.date || "")}</small>
            </div>
        </div>
    `).join("");
}

/* ========================================================
   14. الأعضاء والقيادة (روستر ديناميكي كامل)
   ======================================================== */

function getFullRoster() {
    const serverMembers = getStorage("phantom_server_members", []);
    const custom = getStorage("phantom_custom_roster", []);
    const all = [...serverMembers, ...custom];
    const map = new Map();
    all.forEach(member => {
        if (member && member.name) map.set(normalizeName(member.name), member);
    });
    return Array.from(map.values());
}

function isLeaderRank(rank) {
    return rank === "رئيس" || rank === "قائد" || rank === "مؤسس";
}

function renderRosterAndLeadership() {
    const roster = getFullRoster();
    const leaders = roster.filter(m => isLeaderRank(m.rank));
    const regularCount = roster.length;
    const totalBadge = getElement("total-count-badge");
    const leadersBadge = getElement("stat-leaders-count");
    const rosterTotal = getElement("roster-total-count");
    if (totalBadge) totalBadge.textContent = String(regularCount);
    if (leadersBadge) leadersBadge.textContent = String(leaders.length);
    if (rosterTotal) rosterTotal.textContent = String(regularCount);
    const memberCard = (member) => `
        <div class="member-log-item" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; margin-bottom:6px; background:rgba(255,255,255,0.03); border-radius:6px;">
            <div>
                <strong style="color:var(--gold-main,#d4af37);">${escapeHTML(member.name)}</strong>
                <span style="font-size:0.75rem; color:var(--silver-muted,#aaa); margin-right:6px;">(${escapeHTML(member.rank || "عضو")})</span>
            </div>
            <span style="font-size:0.7rem; color:var(--green-online,#00ff88);">● ${escapeHTML(member.status || "موثق")}</span>
        </div>
    `;
    const rosterGrid = getElement("roster-grid");
    if (rosterGrid) {
        rosterGrid.innerHTML = roster.length
            ? roster.map(memberCard).join("")
            : `<div class="empty-state">لا يوجد أعضاء مسجلين حتى الآن.</div>`;
    }
    const previewList = getElement("roster-preview-list");
    if (previewList) {
        const preview = roster.slice(0, 8);
        previewList.innerHTML = preview.length
            ? preview.map(m => `<span class="roster-chip">${escapeHTML(m.name)}</span>`).join("")
            : `<div class="empty-state">لا يوجد أعضاء بعد.</div>`;
    }
    const leadershipGrid = getElement("leadership-grid");
    if (leadershipGrid) {
        leadershipGrid.innerHTML = leaders.length
            ? leaders.map(memberCard).join("")
            : `<div class="empty-state">لا توجد قيادة مسجلة بعد.</div>`;
    }
    renderMostActiveMembers();
}

function renderMostActiveMembers() {
    const container = getElement("most-active-container");
    if (!container) return;
    const roster = getFullRoster();
    const attendanceRecords = getStorage(PHANTOM_MEMORY.attendanceRecordsKey, {});
    const localPoints = getLocalPoints();
    const activityScore = roster.map(m => {
        const attendances = attendanceRecords[m.name] || 0;
        const votes = localPoints[m.name] || 0;
        const score = attendances * 2 + votes;
        return { name: m.name, score };
    }).sort((a, b) => b.score - a.score);
    const top5 = activityScore.slice(0, 5);
    if (!top5.length) {
        container.innerHTML = `<div class="empty-state">لا توجد بيانات نشاط بعد.</div>`;
        return;
    }
    container.innerHTML = top5.map((member, idx) => `
        <div class="member-log-item" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; margin-bottom:6px; background:rgba(255,255,255,0.03); border-radius:6px;">
            <div>
                <strong style="color:var(--gold-main,#d4af37);">#${idx+1} ${escapeHTML(member.name)}</strong>
                <span style="font-size:0.75rem; color:var(--silver-muted,#aaa); margin-right:6px;">(نشاط: ${member.score})</span>
            </div>
        </div>
    `).join("");
}

function populateAdminSelects() {
    const roster = getFullRoster();
    const selects = ["attendance-member-select", "warning-member-select", "kick-member-select"];
    const html = roster.length ? roster.map(member => `
        <option value="${escapeHTML(member.name)}">${escapeHTML(member.name)} ${member.rank ? `(${escapeHTML(member.rank)})` : ""}</option>
    `).join("") : `<option value="">لا يوجد أعضاء</option>`;
    selects.forEach(id => {
        const select = getElement(id);
        if (select) select.innerHTML = html;
    });
    renderAdminWarnings();
}

/* ========================================================
   15. لوحة الصدارة (جدول 30 مركزاً، المركز 30 فارغ)
   ======================================================== */

function addPoints(username, amount) {
    if (!username) return;
    if (amount < 0) return;
    // UPDATE: التحقق من فترة الاستراحة (نقطة 11)
    const state = getCurrentSeasonState();
    if (state.isPointsLocked) {
        // إذا كان في استراحة، لا نضيف نقاط ونعرض رسالة
        showToast("⏳ فترة الاستراحة: لا يمكن اكتساب نقاط حالياً.", "info");
        return;
    }
    const points = getLocalPoints();
    const current = Number(points[username] || 0);
    points[username] = current + (Number(amount) || 0);
    setLocalPoints(points);
}

function renderLeaderboard() {
    const container = getElement("leaderboard-list");
    if (!container) return;
    const roster = getFullRoster();
    const localPoints = getLocalPoints();
    const sorted = roster.map(m => {
        const p = (m.points || 0) + Number(localPoints[m.name] || 0);
        return { name: m.name, rank: m.rank || "عضو", points: p };
    }).sort((a, b) => b.points - a.points);
    const data = getBasicData();
    const founders = Array.isArray(data.founders) ? data.founders : [];
    const founderName = founders.length > 0 ? founders[0] : "المؤسس";
    let html = "";
    const maxSlots = 30;
    for (let i = 1; i <= maxSlots; i++) {
        let slotContent = "";
        let rankClass = "";
        let crownIcon = "";
        if (i === maxSlots) {
            slotContent = `
                <div class="player-info">
                    <div class="player-name" style="color:var(--silver-muted,#aaa);">—</div>
                    <div class="player-rank" style="color:var(--silver-muted,#aaa);">فارغ</div>
                </div>
                <div class="points-badge"><span style="color:var(--silver-muted,#aaa);">0</span><small>نقطة</small></div>
            `;
            rankClass = "rank-empty";
        } else {
            const member = sorted[i-1];
            if (member) {
                if (i === 1) { crownIcon = "👑 "; rankClass = "rank-1"; }
                else if (i === 2) { crownIcon = "🥈 "; rankClass = "rank-2"; }
                else if (i === 3) { crownIcon = "🥉 "; rankClass = "rank-3"; }
                slotContent = `
                    <div class="player-info">
                        <div class="player-name">${crownIcon}${escapeHTML(member.name)}</div>
                        <div class="player-rank">${escapeHTML(member.rank)}</div>
                    </div>
                    <div class="points-badge"><span>${member.points}</span><small>نقطة</small></div>
                `;
            } else {
                slotContent = `
                    <div class="player-info">
                        <div class="player-name" style="color:var(--silver-muted,#aaa);">—</div>
                        <div class="player-rank" style="color:var(--silver-muted,#aaa);">فارغ</div>
                    </div>
                    <div class="points-badge"><span style="color:var(--silver-muted,#aaa);">0</span><small>نقطة</small></div>
                `;
                rankClass = "rank-empty";
            }
        }
        html += `
            <div class="leaderboard-card ${rankClass}">
                <div class="rank-badge">#${i}</div>
                ${slotContent}
            </div>
        `;
    }
    if (!sorted.length) {
        html = `<div class="empty-state">لا يوجد أعضاء في الصدارة بعد.</div>`;
    }
    container.innerHTML = html;
}

/* ========================================================
   16. تسجيل الحضور (مع حساب نسبة الحضور)
   ======================================================== */

function setupAttendance() {
    const button = getElement("mark-attendance-btn");
    if (!button) return;
    button.addEventListener("click", async () => {
        if (!isFounderSession()) {
            showToast("⚠️ تسجيل الحضور مخصص للرؤساء فقط.", "error");
            return;
        }
        const select = getElement("attendance-member-select");
        const selectedUsernames = select ? Array.from(select.selectedOptions).map(opt => opt.value).filter(Boolean) : [];
        if (!selectedUsernames.length) {
            showToast("⚠️ اختر عضواً واحداً على الأقل.", "error");
            return;
        }
        const roster = getFullRoster();
        const attendanceRecords = getStorage(PHANTOM_MEMORY.attendanceRecordsKey, {});
        for (const username of selectedUsernames) {
            const member = roster.find(item => normalizeName(item.name) === normalizeName(username));
            if (member && member.id && !String(member.id).startsWith("local_")) {
                await serverAddAttendance(member.id);
            }
            attendanceRecords[username] = (attendanceRecords[username] || 0) + 1;
            addPoints(username, 30);
            addSystemUpdate("تسجيل حضور", `تم تسجيل حضور العضو ${username} ومنحه +30 نقطة.`);
        }
        setStorage(PHANTOM_MEMORY.attendanceRecordsKey, attendanceRecords);
        showToast(`✅ تم تسجيل حضور (${selectedUsernames.join(", ")}) بنجاح.`, "success");
        renderAll();
        updateAttendanceRate();
    });
}

function calculateAttendanceRate() {
    const roster = getFullRoster();
    const attendanceRecords = getStorage(PHANTOM_MEMORY.attendanceRecordsKey, {});
    const events = getEventsList();
    const data = getBasicData();
    const staticRooms = Array.isArray(data.rooms) ? data.rooms : [];
    const totalRooms = events.length + staticRooms.length;
    if (totalRooms === 0) return 0;
    let totalAttended = 0;
    roster.forEach(m => {
        totalAttended += attendanceRecords[m.name] || 0;
    });
    const averageAttended = totalAttended / roster.length || 0;
    const averageRooms = totalRooms;
    const rate = (averageAttended / averageRooms) * 100;
    return Math.min(rate, 100);
}

function updateAttendanceRate() {
    const rateElement = getElement("stat-attendance-rate");
    if (rateElement) {
        const rate = calculateAttendanceRate();
        rateElement.textContent = `${Math.round(rate)}%`;
    }
}

/* ========================================================
   17. نظام الإنذارات (خيارات: إنذار، تنبيه، طرد)
   ======================================================== */

function getWarnings() {
    const serverWarnings = getStorage("phantom_server_warnings", null);
    if (Array.isArray(serverWarnings)) return serverWarnings;
    return getStorage("phantom_warnings", []);
}

function setupWarnings() {
    const button = getElement("issue-warning-btn");
    if (!button) return;
    button.addEventListener("click", async () => {
        if (!isFounderSession()) {
            showToast("⚠️ إصدار الإنذارات مخصص للرؤساء فقط.", "error");
            return;
        }
        const memberSelect = getElement("warning-member-select");
        const typeSelect = getElement("warning-type-select");
        const reasonInput = getElement("warning-reason-input");
        const name = memberSelect ? memberSelect.value : "";
        const type = typeSelect ? typeSelect.value : "إنذار";
        const reason = reasonInput ? reasonInput.value.trim() : "";
        if (!name || !reason) {
            showToast("⚠️ اختر العضو واكتب سبب الإنذار.", "error");
            return;
        }
        const roster = getFullRoster();
        const member = roster.find(item => normalizeName(item.name) === normalizeName(name));
        if (member && member.id && !String(member.id).startsWith("local_")) {
            const response = await serverCreateWarning(member.id, type, reason);
            if (response && response.success) {
                const warnings = await serverGetWarnings();
                setStorage("phantom_server_warnings", warnings);
            }
        }
        const warnings = getStorage("phantom_warnings", []);
        warnings.push({
            id: `warning_${Date.now()}`,
            name: name,
            type: type,
            reason: reason,
            date: new Date().toLocaleDateString("ar-EG")
        });
        setStorage("phantom_warnings", warnings);
        if (reasonInput) reasonInput.value = "";
        addSystemUpdate("إنذار جديد", `تم إصدار ${type} بحق العضو ${name}. السبب: ${reason}`);
        showToast(`🚨 تم إصدار ${type} بحق ${name}.`, "success");
        renderWarnings();
        renderAdminWarnings();
        renderFounderNotifications();
    });
}

function renderWarnings() {
    const container = getElement("active-warnings-public-list");
    if (!container) return;
    const warnings = getWarnings();
    if (!warnings.length) {
        container.innerHTML = `<div class="empty-state">✅ لا توجد إنذارات نشطة حالياً.</div>`;
        return;
    }
    container.innerHTML = warnings.map(warning => `
        <div class="warning-card-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,0,0,0.08); border-right:4px solid var(--red-danger,#ff4d4d); margin-bottom:8px; border-radius:6px;">
            <div>
                <strong style="color:var(--gold-main,#d4af37); font-size:1rem;">${escapeHTML(warning.name || "")}</strong>
                <br>
                <small style="color:var(--silver-muted,#aaa); font-size:0.75rem;">السبب: ${escapeHTML(warning.reason || "غير محدد")} | ${escapeHTML(warning.date || "")}</small>
            </div>
            <span class="warning-badge" style="background:var(--red-danger,#ff4d4d); color:#fff; padding:2px 8px; border-radius:4px; font-size:0.7rem;">${escapeHTML(warning.type || "إنذار")}</span>
        </div>
    `).join("");
}

function renderAdminWarnings() {
    const container = getElement("admin-warnings-manage-list");
    if (!container) return;
    const warnings = getWarnings();
    if (!warnings.length) {
        container.innerHTML = `<span style="font-size:.75rem; color:var(--silver-muted,#aaa);">لا توجد إنذارات لإزالتها.</span>`;
        return;
    }
    container.innerHTML = warnings.map(warning => `
        <div class="admin-mini-item" style="display:flex; justify-content:space-between; align-items:center;">
            <span><strong>${escapeHTML(warning.name || "")}</strong> - ${escapeHTML(warning.type || "إنذار")}</span>
            <button class="admin-del-btn" type="button" data-warning-id="${escapeHTML(warning.id)}" style="background:var(--red-danger,#ff4d4d); color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;">إزالة 🗑️</button>
        </div>
    `).join("");
    container.querySelectorAll("[data-warning-id]").forEach(button => {
        button.addEventListener("click", async () => {
            if (!isFounderSession()) {
                showToast("⚠️ صلاحية إزالة الإنذار مخصصة للرؤساء فقط.", "error");
                return;
            }
            await removeWarning(button.getAttribute("data-warning-id"));
        });
    });
}

async function removeWarning(id) {
    let warnings = getStorage("phantom_warnings", []);
    const targetWarning = warnings.find(w => String(w.id) === String(id));
    warnings = warnings.filter(w => String(w.id) !== String(id));
    setStorage("phantom_warnings", warnings);
    let serverWarnings = getStorage("phantom_server_warnings", []);
    serverWarnings = serverWarnings.filter(w => String(w.id) !== String(id));
    setStorage("phantom_server_warnings", serverWarnings);
    await serverDeleteWarning(id);
    if (targetWarning) addSystemUpdate("إزالة إنذار", `تمت إزالة الإنذار عن العضو ${targetWarning.name}.`);
    showToast("✅ تمت إزالة الإنذار بنجاح.", "success");
    renderWarnings();
    renderAdminWarnings();
    renderFounderNotifications();
}

/* ========================================================
   18. إضافة واستبعاد الأعضاء (محدثة: ID بدل رتبة)
   ======================================================== */

function setupAddMember() {
    const button = getElement("add-member-btn");
    if (!button) return;
    button.addEventListener("click", async () => {
        if (!isFounderSession()) {
            showToast("⚠️ إضافة الأعضاء مخصصة للرؤساء فقط.", "error");
            return;
        }
        const idInput = getElement("new-member-id"); // بدلاً من rank
        const nameInput = getElement("new-member-name");
        const statusInput = getElement("new-member-verified");
        const userId = idInput ? idInput.value.trim() : "";
        const name = nameInput ? nameInput.value.trim() : "";
        const status = statusInput ? statusInput.value : "موثق";
        if (!userId || !name) {
            showToast("⚠️ اكتب الـ ID الخاص بالعضو واسمه.", "error");
            return;
        }
        // التحقق من وجود الـ ID في النظام (يمكن ربطه بالسيرفر لاحقاً)
        const exists = getFullRoster().some(m => normalizeName(m.name) === normalizeName(name));
        if (exists) {
            showToast("⚠️ العضو موجود بالفعل.", "error");
            return;
        }
        // إضافة العضو بالـ ID بدلاً من الرتبة
        const serverMember = await serverCreateMember(name, "عضو");
        if (serverMember) {
            serverMember.userId = userId; // ربط الـ ID
            serverMember.status = status;
            let members = getStorage("phantom_server_members", []);
            members.push(serverMember);
            setStorage("phantom_server_members", members);
        } else {
            const members = getStorage("phantom_custom_roster", []);
            members.push({
                id: `local_${Date.now()}`,
                userId: userId, // تخزين الـ ID
                name: name,
                rank: "عضو",
                status: status,
                points: 0,
                joinedAt: Date.now(),
                lastSeen: null,
                source: "founder"
            });
            setStorage("phantom_custom_roster", members);
        }
        if (idInput) idInput.value = "";
        if (nameInput) nameInput.value = "";
        addSystemUpdate("إضافة عضو", `تمت إضافة ${name} (ID: ${userId}) إلى سجل PHANTOM.`);
        showToast(`✅ تمت إضافة ${name} بنجاح.`, "success");
        renderAll();
        populateAdminSelects();
    });
}

function setupKickMember() {
    const button = getElement("kick-member-btn");
    if (!button) return;
    button.addEventListener("click", () => {
        if (!isFounderSession()) {
            showToast("⚠️ استبعاد الأعضاء مخصص للرؤساء فقط.", "error");
            return;
        }
        const select = getElement("kick-member-select");
        const name = select ? select.value : "";
        if (!name) {
            showToast("⚠️ اختر عضواً أولاً.", "error");
            return;
        }
        // إضافة العضو إلى قائمة المطرودين (نقطة 4)
        let bannedUsers = getBannedUsers();
        bannedUsers[name] = {
            status: 'banned',
            bannedAt: Date.now(),
            reason: 'تم الطرد بواسطة المشرف'
        };
        setBannedUsers(bannedUsers);

        // إزالة من القائمة النشطة
        let members = getStorage("phantom_custom_roster", []);
        members = members.filter(m => normalizeName(m.name) !== normalizeName(name));
        setStorage("phantom_custom_roster", members);
        
        addSystemUpdate("استبعاد عضو", `تم استبعاد ${name} من السجل وإضافته لقائمة المطرودين.`);
        showToast(`🚫 تم استبعاد ${name}.`, "info");
        renderAll();
        populateAdminSelects();
    });
}

/* ========================================================
   19. الاستطلاعات والتصويت (ديناميكية: إضافة خيارات تلقائية + اختيار متعدد)
   ======================================================== */

let userHasVotedOnce = {};

function setupPollCreator() {
    const button = getElement("create-poll-btn");
    const cancelButton = getElement("cancel-poll-btn");
    const multipleChoiceCheck = getElement("poll-multiple-choice");
    const optionsContainer = getElement("poll-options-container");
    if (optionsContainer) {
        optionsContainer.addEventListener("input", (e) => {
            const target = e.target;
            if (target.classList.contains("poll-option-input")) {
                const allInputs = optionsContainer.querySelectorAll(".poll-option-input");
                const lastInput = allInputs[allInputs.length - 1];
                if (lastInput === target && target.value.trim() !== "") {
                    const newInput = document.createElement("input");
                    newInput.type = "text";
                    newInput.className = "poll-option-input";
                    newInput.placeholder = `خيار ${allInputs.length + 1}`;
                    newInput.style.cssText = "width:100%; padding:8px; margin-bottom:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(212,175,55,0.3); border-radius:6px; color:#fff;";
                    optionsContainer.appendChild(newInput);
                }
            }
        });
    }
    if (button) {
        button.addEventListener("click", async () => {
            if (!isFounderSession()) {
                showToast("⚠️ إنشاء الاستطلاعات مخصص للرؤساء فقط.", "error");
                return;
            }
            const questionInput = getElement("poll-question-input");
            const optionInputs = optionsContainer ? optionsContainer.querySelectorAll(".poll-option-input") : [];
            const optionTexts = Array.from(optionInputs).map(inp => inp.value.trim()).filter(t => t !== "");
            const question = questionInput ? questionInput.value.trim() : "";
            if (!question || optionTexts.length < 2) {
                showToast("⚠️ اكتب السؤال وخيارين على الأقل.", "error");
                return;
            }
            const multiple = multipleChoiceCheck ? multipleChoiceCheck.checked : false;
            const poll = {
                id: `poll_${Date.now()}`,
                question: question,
                options: optionTexts.map((text, idx) => ({ id: idx + 1, text: text, votes: 0 })),
                voters: {},
                totalVotes: 0,
                multiple: multiple,
                createdAt: Date.now(),
                createdBy: getCurrentUsername()
            };
            setStorage(PHANTOM_MEMORY.pollStorageKey, poll);
            removeStorage(PHANTOM_MEMORY.pollVoteKey);
            if (questionInput) questionInput.value = "";
            if (optionsContainer) {
                optionsContainer.innerHTML = `
                    <input type="text" class="poll-option-input" placeholder="خيار 1" style="width:100%; padding:8px; margin-bottom:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(212,175,55,0.3); border-radius:6px; color:#fff;">
                    <input type="text" class="poll-option-input" placeholder="خيار 2" style="width:100%; padding:8px; margin-bottom:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(212,175,55,0.3); border-radius:6px; color:#fff;">
                `;
            }
            if (multipleChoiceCheck) multipleChoiceCheck.checked = false;
            updatePollAdminState(poll);
            addSystemUpdate("استطلاع جديد", `تم نشر استطلاع جديد: "${question}"`, true);
            showToast("🚀 تم نشر الاستطلاع بنجاح.", "success");
            renderPoll();
        });
    }
    if (cancelButton) {
        cancelButton.addEventListener("click", async () => {
            if (!isFounderSession()) {
                showToast("⚠️ إلغاء الاستطلاعات مخصص للرؤساء فقط.", "error");
                return;
            }
            const poll = getStorage(PHANTOM_MEMORY.pollStorageKey, null);
            if (!poll) { updatePollAdminState(null); return; }
            removeStorage(PHANTOM_MEMORY.pollStorageKey);
            removeStorage(PHANTOM_MEMORY.pollVoteKey);
            await serverCancelPoll();
            updatePollAdminState(null);
            addSystemUpdate("إلغاء استطلاع", "تم إلغاء الاستطلاع النشط بواسطة القيادة.", true);
            showToast("تم إلغاء الاستطلاع بنجاح.", "info");
            renderPoll();
        });
    }
    updatePollAdminState(getStorage(PHANTOM_MEMORY.pollStorageKey, null));
}

function updatePollAdminState(poll) {
    const button = getElement("cancel-poll-btn");
    const status = getElement("poll-admin-status");
    if (button) button.disabled = !poll;
    if (!status) return;
    status.innerHTML = poll
        ? `<span style="color:var(--green-online,#00ff88);">🟢 يوجد استطلاع نشط: ${escapeHTML(poll.question)}</span>`
        : `<span style="color:var(--silver-muted,#aaa);">⚪ لا يوجد استطلاع نشط حالياً.</span>`;
}

function voteInPoll(optionId) {
    const poll = getStorage(PHANTOM_MEMORY.pollStorageKey, null);
    const username = getCurrentUsername();
    if (!poll || !username) return;
    if (!poll.voters[username]) poll.voters[username] = [];
    const userVotes = poll.voters[username];
    if (poll.multiple) {
        const index = userVotes.indexOf(optionId);
        if (index !== -1) {
            userVotes.splice(index, 1);
            poll.options.find(o => o.id === optionId).votes--;
            poll.totalVotes--;
        } else {
            userVotes.push(optionId);
            poll.options.find(o => o.id === optionId).votes++;
            poll.totalVotes++;
        }
    } else {
        if (userVotes.length > 0) {
            const oldOptionId = userVotes[0];
            poll.options.find(o => o.id === oldOptionId).votes--;
            poll.totalVotes--;
        }
        userVotes.length = 0;
        userVotes.push(optionId);
        poll.options.find(o => o.id === optionId).votes++;
        poll.totalVotes++;
    }
    setStorage(PHANTOM_MEMORY.pollStorageKey, poll);
    if (!userHasVotedOnce[username]) {
        userHasVotedOnce[username] = true;
        addPoints(username, 10);
        showToast("🗳️ تم تسجيل صوتك ومنحك +10 نقاط!", "success");
    } else {
        showToast("🗳️ تم تغيير تصويتك (لا نقاط إضافية).", "info");
    }
    renderPoll();
    renderLeaderboard();
}

function renderPoll() {
    const wrapper = getElement("poll-section-wrapper");
    const card = getElement("active-poll-card");
    if (!wrapper || !card) return;
    const poll = getStorage(PHANTOM_MEMORY.pollStorageKey, null);
    updatePollAdminState(poll);
    if (!poll) {
        wrapper.style.display = "none";
        card.innerHTML = "";
        return;
    }
    wrapper.style.display = "block";
    const username = getCurrentUsername();
    const userVotes = poll.voters[username] || [];
    const hasVoted = userVotes.length > 0;
    card.innerHTML = `
        <div class="poll-question" style="font-weight:bold; font-size:1.1rem; margin-bottom:12px;">${escapeHTML(poll.question)}</div>
        ${poll.multiple ? `<small style="color:var(--cyan); display:block; margin-bottom:8px;">✅ هذا الاستطلاع يسمح باختيار متعدد (يمكنك تغيير اختياراتك في أي وقت).</small>` : ''}
        <div class="poll-options">
            ${poll.options.map(opt => {
                const percent = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
                const isSelected = userVotes.includes(opt.id);
                return `
                    <button class="poll-opt-btn ${isSelected ? 'selected' : ''}" data-option-id="${opt.id}" style="width:100%; margin-bottom:8px; padding:10px; border-radius:6px; position:relative; overflow:hidden; ${isSelected ? 'border-color:var(--cyan); background:rgba(0,242,254,0.15);' : ''}">
                        <div class="poll-bar" style="position:absolute; top:0; right:0; bottom:0; width:${percent}%; background:rgba(212,175,55,0.2); transition:width 0.4s ease;"></div>
                        <span style="position:relative; z-index:2; display:flex; justify-content:space-between;">
                            <span>${isSelected ? '✅ ' : ''}${escapeHTML(opt.text)}</span>
                            <strong>${percent}% (${opt.votes})</strong>
                        </span>
                    </button>
                `;
            }).join("")}
        </div>
        <small style="color:var(--silver-muted,#aaa); margin-top:8px; display:block;">إجمالي الأصوات: ${poll.totalVotes} | ${poll.multiple ? 'يمكنك اختيار عدة خيارات' : 'صوت واحد فقط لكل عضو'} (+10 نقاط للمصوت الأول)</small>
    `;
    card.querySelectorAll("[data-option-id]").forEach(btn => {
        btn.addEventListener("click", () => voteInPoll(Number(btn.getAttribute("data-option-id"))));
    });
}

/* ========================================================
   20. الشات العام (محدث: فلتر كلمات كامل، مسح الإدخال)
   ======================================================== */

// UPDATE: قائمة الكلمات الممنوعة الكاملة (نقطة 12)
const FORBIDDEN_WORDS = [
    "خول", "يا خول", "يا معرص", "كسمك", "ابن شرموطه", "ابن متناكه", "ابن لبوه", "ابن فاجره", 
    "زبي", "كسك", "يا معرص", "عرص", "يا عرض", "يبن المره الوسخه", "يبن كوم الزواني", "يابن الجزمه",
    "سب الدين", "سب الرسول", "سب الله", "كفر", "ملحد",
    "سبك", "غبي", "هاك", "تشفير", "كسم", "طيز", "زبي", "شرموطة", "قحبة", "منيوك",
    "ابن وسخه", "ابن ورمة", "كسمك", "منيوك", "لعنة", "ملعون", "حرام", "نجس", "خنزير", "كلب", "عاهرة"
];

let blockedMessage = null;

function setupChat() {
    const form = getElement("chat-input-form");
    const input = getElement("chat-message-input");
    const sendBtn = getElement("chat-send-btn");
    const editContainer = getElement("chat-edit-container");
    const editInput = getElement("chat-edit-input");
    const editSaveBtn = getElement("chat-edit-save-btn");
    const editCancelBtn = getElement("chat-edit-cancel-btn");
    const warningIcon = getElement("chat-warning-icon");
    if (!form || !input) return;

    function containsForbiddenWords(text) {
        const lower = text.toLowerCase();
        for (let word of FORBIDDEN_WORDS) {
            if (lower.includes(word)) return true;
        }
        const patterns = [
            /ابن\s*(وسخه|ورمه|كلب|خنزير)/i,
            /كسم\s*(ك|ك)/i,
            /منيوك/i
        ];
        for (let pattern of patterns) {
            if (pattern.test(text)) return true;
        }
        return false;
    }

    async function sendMessage(text) {
        const sender = getCurrentUsername();
        if (!text || !sender) return;
        const message = { sender: sender, text: text, timestamp: Date.now() };
        await serverSendChat(message);
        // UPDATE: مسح مربع الكتابة بعد الإرسال (نقطة 2)
        if (input) input.value = "";
        renderChat();
        renderChatMonitor();
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const text = input.value.trim();
        const sender = getCurrentUsername();
        if (!text || !sender) return;
        if (containsForbiddenWords(text)) {
            blockedMessage = { sender, text, original: text };
            if (editContainer) editContainer.style.display = "block";
            if (editInput) editInput.value = text;
            if (warningIcon) warningIcon.style.display = "inline-block";
            if (sendBtn) sendBtn.disabled = true;
            return;
        }
        await sendMessage(text);
    });

    if (editSaveBtn && editInput) {
        editSaveBtn.addEventListener("click", async () => {
            const newText = editInput.value.trim();
            if (!newText) {
                showToast("⚠️ اكتب رسالة معدلة.", "error");
                return;
            }
            if (containsForbiddenWords(newText)) {
                showToast("⚠️ لا تزال هناك كلمات مسيئة، حاول مجدداً.", "error");
                return;
            }
            if (editContainer) editContainer.style.display = "none";
            if (warningIcon) warningIcon.style.display = "none";
            if (sendBtn) sendBtn.disabled = false;
            await sendMessage(newText);
            if (blockedMessage) {
                const notification = `🚨 تنبيه شات: العضو ${blockedMessage.sender} حاول إرسال رسالة مسيئة.\nالرسالة الأصلية: "${blockedMessage.original}"\nالرسالة بعد التعديل: "${newText}"`;
                addSystemUpdate("فلترة شات", notification);
                renderFounderNotifications();
            }
            blockedMessage = null;
        });
    }

    if (editCancelBtn && editContainer) {
        editCancelBtn.addEventListener("click", () => {
            editContainer.style.display = "none";
            if (warningIcon) warningIcon.style.display = "none";
            if (sendBtn) sendBtn.disabled = false;
            blockedMessage = null;
            showToast("تم إلغاء التعديل، يمكنك إرسال رسالة جديدة.", "info");
        });
    }

    if (input && sendBtn) {
        input.addEventListener("input", () => {
            if (sendBtn.disabled && !blockedMessage) {
            } else {
                sendBtn.disabled = !input.value.trim();
            }
        });
    }
}

function renderChat() {
    const container = getElement("chat-messages-container");
    if (!container) return;
    serverGetChat().then(messages => {
        const currentUser = getCurrentUsername();
        if (!messages || !messages.length) {
            container.innerHTML = `<div class="empty-state">لا توجد رسائل في الشات. كن أول من يتحدث!</div>`;
            return;
        }
        container.innerHTML = messages.map(msg => {
            const isMe = normalizeName(msg.sender) === normalizeName(currentUser);
            const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' }) : "";
            // UPDATE: تنسيق محسن للرسائل (نقطة 9) - سيتم تطبيق الأنماط في CSS
            return `
                <div class="chat-bubble ${isMe ? 'mine' : 'others'} note-style" style="margin-bottom:8px; align-self:${isMe ? 'flex-end' : 'flex-start'};">
                    <small style="font-weight:bold; color:var(--gold-main,#d4af37); display:block;">${escapeHTML(msg.sender)} <span style="font-weight:normal; color:var(--silver-muted,#aaa); font-size:0.7rem;">🕒 ${time}</span></small>
                    <div style="font-size:0.95rem; line-height:1.6;">${escapeHTML(msg.text)}</div>
                </div>
            `;
        }).join("");
        container.scrollTop = container.scrollHeight;
    });
}

function setupChatRealtimeBridge() {
    if (supabaseClient) {
        supabaseClient
            .channel('public:messages')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
                renderChat();
                renderChatMonitor();
            })
            .subscribe();
    }
}

/* ========================================================
   21. عرض البيانات الأساسية (قوانين + عقوبات + لينكات)
   ======================================================== */

function renderBasicDataUI() {
    const data = getBasicData();
    const rules = data.rules || { general: [], penalties: [], clearance: [] };
    const generalContainer = getElement("general-rules-list");
    if (generalContainer) {
        generalContainer.innerHTML = (rules.general && rules.general.length)
            ? rules.general.map(r => `<li>${escapeHTML(r)}</li>`).join("")
            : `<li class="empty-state">لا توجد قوانين عامة.</li>`;
    }
    const penaltiesContainer = getElement("clearance-system-list");
    if (penaltiesContainer) {
        const penaltiesHTML = (rules.penalties && rules.penalties.length)
            ? rules.penalties.map(p => `
                <div class="penalty-card" style="padding:10px 12px; margin-bottom:8px; background:rgba(255,77,77,0.06); border-right:3px solid var(--red-danger,#ff4d4d); border-radius:6px;">
                    <strong style="color:#fff;">${escapeHTML(p.violation)}</strong>
                    <ul style="margin:6px 0 0; padding-right:16px; font-size:0.85rem; color:var(--silver-muted,#aaa);">
                        ${p.steps.map(step => `<li>${escapeHTML(step)}</li>`).join("")}
                    </ul>
                </div>
            `).join("")
            : `<div class="empty-state">لا توجد عقوبات مدونة.</div>`;
        const clearanceHTML = (rules.clearance && rules.clearance.length) ? `
            <div class="clearance-note" style="margin-top:10px; padding:10px 12px; background:rgba(0,255,136,0.06); border-right:3px solid var(--green-online,#00ff88); border-radius:6px; font-size:0.8rem;">
                <strong style="display:block; margin-bottom:6px;">🟢 نظام مسح الإنذارات</strong>
                <ul style="padding-right:16px; margin:0;">
                    ${rules.clearance.map(c => `<li>${escapeHTML(c)}</li>`).join("")}
                </ul>
            </div>
        ` : "";
        penaltiesContainer.innerHTML = penaltiesHTML + clearanceHTML;
    }
    const linksContainer = getElement("links-grid");
    if (linksContainer) {
        const links = Array.isArray(data.socialLinks) ? data.socialLinks : [];
        linksContainer.innerHTML = links.length ? links.map(link => `
            <a href="${escapeHTML(link.url)}" target="_blank" class="social-link-btn" style="display:flex; align-items:center; gap:8px; padding:12px 16px; margin-bottom:8px; background:rgba(255,255,255,0.05); border:1px solid rgba(212,175,55,0.3); border-radius:8px; color:#fff; text-decoration:none;">
                <span style="font-size:1.2rem;">${escapeHTML(link.icon || "🔗")}</span>
                <span>${escapeHTML(link.name)}</span>
            </a>
        `).join("") : `<div class="empty-state">لا توجد روابط بعد.</div>`;
    }
    renderRooms();
    updateAttendanceRate();
}

/* ========================================================
   22. تحديث الواجهة الشامل + أنيميشن
   ======================================================== */

function renderAll() {
    renderLeaderboard();
    renderWarnings();
    renderAdminWarnings();
    renderPoll();
    renderChat();
    renderOnlineUsers();
    renderChatOnlineCount(); // تحديث عداد الشات
    renderRosterAndLeadership();
    renderBasicDataUI();
    renderSystemUpdates();
    renderFounderNotifications();
    updateAttendanceRate();
    animateElements();
    expandSmallBoxes();
}

function animateElements() {
    const cards = document.querySelectorAll(".leaderboard-card, .event-card-item, .member-log-item, .admin-mini-item, .chat-bubble");
    cards.forEach((card, index) => {
        card.style.opacity = "0";
        card.style.transform = "translateY(10px)";
        card.style.transition = "all 0.3s ease";
        setTimeout(() => {
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";
        }, index * 30);
    });
}

function expandSmallBoxes() {
    const smallBoxes = document.querySelectorAll(".small-box, .dashboard-small-card");
    smallBoxes.forEach(box => {
        box.style.transform = "scale(1.05)";
        box.style.transition = "transform 0.3s ease";
        setTimeout(() => {
            box.style.transform = "scale(1)";
        }, 300);
    });
}

/* ========================================================
   23. Service Worker
   ======================================================== */

function setupServiceWorker() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
}

/* ========================================================
   24. نظام تفاعل الأعضاء (قلب وشكوى) - محدث: قلب واحد فقط + عرض ID
   ======================================================== */

function setupMemberInteraction() {
    document.addEventListener("click", (e) => {
        const memberItem = e.target.closest(".member-log-item");
        if (memberItem) {
            const name = memberItem.querySelector("strong")?.textContent;
            if (name) {
                openMemberActionModal(name);
            }
        }
    });
}

function openMemberActionModal(memberName) {
    const modal = document.createElement("div");
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 99999;
        background: rgba(16,23,34,0.98);
        padding: 20px;
        border-radius: var(--radius-lg);
        border: 1px solid var(--border);
        box-shadow: 0 20px 60px rgba(0,0,0,0.8);
        width: 90%;
        max-width: 400px;
        text-align: center;
        direction: rtl;
    `;
    // UPDATE: إضافة الـ ID الخاص باللاعب في النافذة (نقطة 6)
    const roster = getFullRoster();
    const member = roster.find(m => normalizeName(m.name) === normalizeName(memberName));
    const userId = member ? (member.userId || "غير متوفر") : "غير متوفر";
    
    modal.innerHTML = `
        <h3 style="color:var(--white); margin-bottom:8px;">تفاعل مع ${escapeHTML(memberName)}</h3>
        <div style="font-size:0.8rem; color:var(--silver-muted,#aaa); margin-bottom:12px; background:rgba(255,255,255,0.03); padding:6px; border-radius:4px;">
            🆔 المعرف الفريد: <strong style="color:var(--cyan);">${escapeHTML(userId)}</strong>
        </div>
        <div style="display:flex; gap:10px; justify-content:center;">
            <button id="give-heart-btn" class="btn-accent" style="flex:1;">💛 إعطاء قلب</button>
            <button id="send-complaint-btn" class="btn-danger" style="flex:1;">📩 تقديم شكوى</button>
        </div>
        <button id="close-modal-btn" class="btn-secondary" style="margin-top:12px; width:100%;">إغلاق</button>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(4px);
        z-index: 99998;
    `;
    document.body.appendChild(overlay);

    const closeModal = () => {
        modal.remove();
        overlay.remove();
    };
    document.getElementById("close-modal-btn").addEventListener("click", closeModal);
    overlay.addEventListener("click", closeModal);

    document.getElementById("give-heart-btn").addEventListener("click", () => {
        giveHeart(memberName);
        closeModal();
    });

    document.getElementById("send-complaint-btn").addEventListener("click", () => {
        showComplaintForm(memberName);
        closeModal();
    });
}

function giveHeart(targetName) {
    const hearts = getStorage(PHANTOM_MEMORY.heartsKey, {});
    const from = getCurrentUsername();
    if (!from) {
        showToast("يجب تسجيل الدخول أولاً.", "error");
        return;
    }
    if (from === targetName) {
        showToast("لا يمكنك إعطاء قلب لنفسك.", "error");
        return;
    }
    if (hearts.givenBy && hearts.givenBy[targetName] && hearts.givenBy[targetName].includes(from)) {
        showToast("لقد أعطيت قلبًا لهذا العضو مسبقًا (قلب واحد فقط).", "error");
        return;
    }
    if (!hearts.givenBy) hearts.givenBy = {};
    if (!hearts.givenBy[targetName]) hearts.givenBy[targetName] = [];
    hearts.givenBy[targetName].push(from);
    if (!hearts[targetName]) hearts[targetName] = 0;
    hearts[targetName]++;
    setStorage(PHANTOM_MEMORY.heartsKey, hearts);
    showToast(`💛 تم إعطاء قلب لـ ${targetName}.`, "success");
    addPrivateMessage(targetName, `💛 تلقيت قلباً من ${from}.`);
    renderHearts();
}

function renderHearts() {
    const hearts = getStorage(PHANTOM_MEMORY.heartsKey, {});
    const memberItems = document.querySelectorAll(".member-log-item");
    memberItems.forEach(item => {
        const name = item.querySelector("strong")?.textContent;
        if (name && hearts[name]) {
            let heartSpan = item.querySelector(".heart-count");
            if (!heartSpan) {
                heartSpan = document.createElement("span");
                heartSpan.className = "heart-count";
                heartSpan.style.cssText = "font-size:0.8rem; color:var(--red); margin-right:6px;";
                item.querySelector("div").appendChild(heartSpan);
            }
            heartSpan.textContent = `💛 ${hearts[name]}`;
        }
    });
}

function showComplaintForm(targetName) {
    const modal = document.createElement("div");
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 99999;
        background: rgba(16,23,34,0.98);
        padding: 20px;
        border-radius: var(--radius-lg);
        border: 1px solid var(--border);
        box-shadow: 0 20px 60px rgba(0,0,0,0.8);
        width: 90%;
        max-width: 400px;
        text-align: center;
        direction: rtl;
    `;
    modal.innerHTML = `
        <h3 style="color:var(--white); margin-bottom:12px;">📩 تقديم شكوى ضد ${escapeHTML(targetName)}</h3>
        <textarea id="complaint-reason" placeholder="اكتب سبب الشكوى..." style="width:100%; height:80px; padding:10px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:#fff; resize:none;"></textarea>
        <div style="display:flex; gap:10px; margin-top:10px;">
            <button id="send-complaint-submit" class="btn-danger" style="flex:1;">إرسال الشكوى</button>
            <button id="close-complaint-btn" class="btn-secondary" style="flex:1;">إلغاء</button>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(4px);
        z-index: 99998;
    `;
    document.body.appendChild(overlay);

    const close = () => { modal.remove(); overlay.remove(); };
    document.getElementById("close-complaint-btn").addEventListener("click", close);
    overlay.addEventListener("click", close);

    document.getElementById("send-complaint-submit").addEventListener("click", () => {
        const reason = document.getElementById("complaint-reason").value.trim();
        if (!reason) {
            showToast("يرجى كتابة سبب الشكوى.", "error");
            return;
        }
        const complaints = getStorage(PHANTOM_MEMORY.complaintsKey, []);
        complaints.push({
            id: `complaint_${Date.now()}`,
            from: getCurrentUsername(),
            target: targetName,
            reason: reason,
            date: new Date().toLocaleString("ar-EG")
        });
        setStorage(PHANTOM_MEMORY.complaintsKey, complaints);
        showToast("📩 تم إرسال الشكوى للمؤسسين.", "success");
        renderFounderNotifications();
        close();
    });
}

function acceptComplaint(id) {
    let complaints = getStorage(PHANTOM_MEMORY.complaintsKey, []);
    const complaint = complaints.find(c => c.id === id);
    complaints = complaints.filter(c => c.id !== id);
    setStorage(PHANTOM_MEMORY.complaintsKey, complaints);
    renderFounderNotifications();
    if (complaint) {
        addSystemUpdate("قبول شكوى", `تم قبول شكوى ${complaint.from} ضد ${complaint.target}.`);
        showToast("✅ تم قبول الشكوى.", "success");
        addPrivateMessage(complaint.target, `📩 تم قبول شكوى مقدمة من ${complaint.from} ضدك.`);
    }
}

function rejectComplaint(id) {
    let complaints = getStorage(PHANTOM_MEMORY.complaintsKey, []);
    const complaint = complaints.find(c => c.id === id);
    complaints = complaints.filter(c => c.id !== id);
    setStorage(PHANTOM_MEMORY.complaintsKey, complaints);
    renderFounderNotifications();
    if (complaint) {
        addSystemUpdate("رفض شكوى", `تم رفض شكوى ${complaint.from} ضد ${complaint.target}.`);
        showToast("❌ تم رفض الشكوى.", "info");
        addPrivateMessage(complaint.from, `❌ تم رفض شكواك ضد ${complaint.target}.`);
    }
}

function giveWarningToComplaint(id) {
    let complaints = getStorage(PHANTOM_MEMORY.complaintsKey, []);
    const complaint = complaints.find(c => c.id === id);
    complaints = complaints.filter(c => c.id !== id);
    setStorage(PHANTOM_MEMORY.complaintsKey, complaints);
    renderFounderNotifications();
    if (complaint) {
        const warnings = getStorage("phantom_warnings", []);
        warnings.push({
            id: `warning_${Date.now()}`,
            name: complaint.target,
            type: "تنبيه",
            reason: `بناءً على شكوى من ${complaint.from}: ${complaint.reason}`,
            date: new Date().toLocaleDateString("ar-EG")
        });
        setStorage("phantom_warnings", warnings);
        addSystemUpdate("تنبيه من شكوى", `تم إصدار تنبيه للعضو ${complaint.target} بناءً على شكوى.`);
        showToast("⚠️ تم إصدار تنبيه.", "success");
        addPrivateMessage(complaint.target, `⚠️ تلقيت تنبيه بناءً على شكوى من ${complaint.from}.`);
        renderWarnings();
        renderAdminWarnings();
        renderFounderNotifications();
    }
}

function giveBanToComplaint(id) {
    let complaints = getStorage(PHANTOM_MEMORY.complaintsKey, []);
    const complaint = complaints.find(c => c.id === id);
    complaints = complaints.filter(c => c.id !== id);
    setStorage(PHANTOM_MEMORY.complaintsKey, complaints);
    renderFounderNotifications();
    if (complaint) {
        const warnings = getStorage("phantom_warnings", []);
        warnings.push({
            id: `warning_${Date.now()}`,
            name: complaint.target,
            type: "إنذار",
            reason: `بناءً على شكوى من ${complaint.from}: ${complaint.reason}`,
            date: new Date().toLocaleDateString("ar-EG")
        });
        setStorage("phantom_warnings", warnings);
        addSystemUpdate("إنذار من شكوى", `تم إصدار إنذار للعضو ${complaint.target} بناءً على شكوى.`);
        showToast("🚨 تم إصدار إنذار.", "success");
        addPrivateMessage(complaint.target, `🚨 تلقيت إنذاراً بناءً على شكوى من ${complaint.from}.`);
        renderWarnings();
        renderAdminWarnings();
        renderFounderNotifications();
    }
}

function dismissComplaint(id) {
    let complaints = getStorage(PHANTOM_MEMORY.complaintsKey, []);
    complaints = complaints.filter(c => c.id !== id);
    setStorage(PHANTOM_MEMORY.complaintsKey, complaints);
    renderFounderNotifications();
    showToast("🗑️ تم فض الشكوى.", "info");
}

/* ========================================================
   25. نظام إرسال عذر لعدم حضور الروم
   ======================================================== */

function setupExcuseSystem() {
    const excuseBtn = document.getElementById("send-excuse-btn");
    if (excuseBtn) {
        excuseBtn.addEventListener("click", () => {
            const selectedEvent = document.getElementById("active-events-select")?.value;
            if (!selectedEvent) {
                showToast("اختر الروم أولاً.", "error");
                return;
            }
            showExcuseForm(selectedEvent);
        });
    }
}

function showExcuseForm(eventId) {
    const modal = document.createElement("div");
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 99999;
        background: rgba(16,23,34,0.98);
        padding: 20px;
        border-radius: var(--radius-lg);
        border: 1px solid var(--border);
        box-shadow: 0 20px 60px rgba(0,0,0,0.8);
        width: 90%;
        max-width: 400px;
        text-align: center;
        direction: rtl;
    `;
    modal.innerHTML = `
        <h3 style="color:var(--white); margin-bottom:12px;">⏳ إرسال عذر لعدم الحضور</h3>
        <textarea id="excuse-reason" placeholder="اكتب سبب عدم الحضور..." style="width:100%; height:80px; padding:10px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:#fff; resize:none;"></textarea>
        <div style="display:flex; gap:10px; margin-top:10px;">
            <button id="send-excuse-submit" class="btn-success" style="flex:1;">إرسال العذر</button>
            <button id="close-excuse-btn" class="btn-secondary" style="flex:1;">إلغاء</button>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(4px);
        z-index: 99998;
    `;
    document.body.appendChild(overlay);

    const close = () => { modal.remove(); overlay.remove(); };
    document.getElementById("close-excuse-btn").addEventListener("click", close);
    overlay.addEventListener("click", close);

    document.getElementById("send-excuse-submit").addEventListener("click", () => {
        const reason = document.getElementById("excuse-reason").value.trim();
        if (!reason) {
            showToast("يرجى كتابة سبب العذر.", "error");
            return;
        }
        const excuses = getStorage(PHANTOM_MEMORY.excusesKey, []);
        excuses.push({
            id: `excuse_${Date.now()}`,
            from: getCurrentUsername(),
            eventId: eventId,
            reason: reason,
            date: new Date().toLocaleString("ar-EG")
        });
        setStorage(PHANTOM_MEMORY.excusesKey, excuses);
        showToast("⏳ تم إرسال العذر للمؤسسين.", "success");
        renderFounderNotifications();
        close();
    });
}

function acceptExcuse(id) {
    let excuses = getStorage(PHANTOM_MEMORY.excusesKey, []);
    const excuse = excuses.find(e => e.id === id);
    excuses = excuses.filter(e => e.id !== id);
    setStorage(PHANTOM_MEMORY.excusesKey, excuses);
    renderFounderNotifications();
    if (excuse) {
        addSystemUpdate("قبول عذر", `تم قبول عذر العضو ${excuse.from} لعدم حضور الروم.`);
        showToast("✅ تم قبول العذر.", "success");
        addPrivateMessage(excuse.from, `✅ تم قبول عذرك لعدم حضور الروم.`);
    }
}

function rejectExcuse(id) {
    let excuses = getStorage(PHANTOM_MEMORY.excusesKey, []);
    const excuse = excuses.find(e => e.id === id);
    excuses = excuses.filter(e => e.id !== id);
    setStorage(PHANTOM_MEMORY.excusesKey, excuses);
    renderFounderNotifications();
    if (excuse) {
        addSystemUpdate("رفض عذر", `تم رفض عذر العضو ${excuse.from} لعدم حضور الروم.`);
        showToast("❌ تم رفض العذر.", "info");
        addPrivateMessage(excuse.from, `❌ تم رفض عذرك لعدم حضور الروم.`);
    }
}

/* ========================================================
   26. نظام تغيير الاسم (بموافقة المؤسسين)
   ======================================================== */

function setupNameChange() {
    const editBtn = document.getElementById("edit-name-btn");
    if (!editBtn) return;
    editBtn.addEventListener("click", () => {
        showNameChangeForm();
    });
}

function showNameChangeForm() {
    const currentName = getCurrentUsername();
    if (!currentName) {
        showToast("يجب تسجيل الدخول أولاً.", "error");
        return;
    }
    const modal = document.createElement("div");
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 99999;
        background: rgba(16,23,34,0.98);
        padding: 20px;
        border-radius: var(--radius-lg);
        border: 1px solid var(--border);
        box-shadow: 0 20px 60px rgba(0,0,0,0.8);
        width: 90%;
        max-width: 400px;
        text-align: center;
        direction: rtl;
    `;
    modal.innerHTML = `
        <h3 style="color:var(--white); margin-bottom:12px;">📝 تغيير الاسم</h3>
        <p style="color:var(--muted); font-size:0.85rem;">الاسم الحالي: <strong>${escapeHTML(currentName)}</strong></p>
        <input id="new-name-input" type="text" placeholder="الاسم الجديد" style="width:100%; padding:10px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:#fff; margin-top:8px;">
        <div style="display:flex; gap:10px; margin-top:10px;">
            <button id="submit-name-change" class="btn-primary" style="flex:1;">إرسال الطلب</button>
            <button id="close-name-change" class="btn-secondary" style="flex:1;">إلغاء</button>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(4px);
        z-index: 99998;
    `;
    document.body.appendChild(overlay);

    const close = () => { modal.remove(); overlay.remove(); };
    document.getElementById("close-name-change").addEventListener("click", close);
    overlay.addEventListener("click", close);

    document.getElementById("submit-name-change").addEventListener("click", () => {
        const newName = document.getElementById("new-name-input").value.trim();
        if (!newName) {
            showToast("يرجى كتابة الاسم الجديد.", "error");
            return;
        }
        if (newName.length < 2) {
            showToast("الاسم يجب أن يكون حرفين على الأقل.", "error");
            return;
        }
        const roster = getFullRoster();
        if (roster.some(m => normalizeName(m.name) === normalizeName(newName))) {
            showToast("هذا الاسم مستخدم بالفعل.", "error");
            return;
        }
        const requests = getStorage(PHANTOM_MEMORY.nameChangeRequestsKey, []);
        requests.push({
            id: `namechange_${Date.now()}`,
            oldName: currentName,
            newName: newName,
            date: new Date().toLocaleString("ar-EG")
        });
        setStorage(PHANTOM_MEMORY.nameChangeRequestsKey, requests);
        showToast("📝 تم إرسال طلب تغيير الاسم للمؤسسين.", "success");
        renderFounderNotifications();
        close();
    });
}

function approveNameChange(id) {
    let requests = getStorage(PHANTOM_MEMORY.nameChangeRequestsKey, []);
    const request = requests.find(r => r.id === id);
    if (!request) return;
    const roster = getStorage("phantom_custom_roster", []);
    let changed = false;
    roster.forEach(m => {
        if (normalizeName(m.name) === normalizeName(request.oldName)) {
            m.name = request.newName;
            changed = true;
        }
    });
    if (changed) setStorage("phantom_custom_roster", roster);
    if (getCurrentUsername() === request.oldName) {
        const identity = getSavedIdentity();
        if (identity) {
            identity.username = request.newName;
            setStorage(PHANTOM_MEMORY.identityKey, identity);
        }
        localStorage.setItem("phantom_active_username", request.newName);
        updateCurrentUser(request.newName);
    }
    requests = requests.filter(r => r.id !== id);
    setStorage(PHANTOM_MEMORY.nameChangeRequestsKey, requests);
    addSystemUpdate("تغيير اسم", `تم تغيير اسم ${request.oldName} إلى ${request.newName} بموافقة المؤسسين.`, true);
    showToast(`✅ تم تغيير اسم ${request.oldName} إلى ${request.newName}.`, "success");
    renderAll();
    renderFounderNotifications();
    addPrivateMessage(request.newName, `📝 تم تغيير اسمك من ${request.oldName} إلى ${request.newName}.`);
}

function rejectNameChange(id) {
    let requests = getStorage(PHANTOM_MEMORY.nameChangeRequestsKey, []);
    const request = requests.find(r => r.id === id);
    requests = requests.filter(r => r.id !== id);
    setStorage(PHANTOM_MEMORY.nameChangeRequestsKey, requests);
    addSystemUpdate("رفض تغيير اسم", `تم رفض طلب تغيير اسم العضو ${request.oldName}.`);
    showToast(`❌ تم رفض طلب تغيير اسم ${request.oldName}.`, "info");
    renderFounderNotifications();
    addPrivateMessage(request.oldName, `❌ تم رفض طلب تغيير اسمك إلى ${request.newName}.`);
}

/* ========================================================
   27. نظام الرسائل الخاصة (Inbox) - Side Drawer - محسن
   ======================================================== */

function setupPrivateMessages() {
    const menuBtn = document.getElementById("menu-btn");
    if (menuBtn) {
        menuBtn.addEventListener("click", () => {
            openPrivateMessages();
        });
    }
    const username = getCurrentUsername();
    if (username) updateUnreadCount(username);
}

function getPrivateMessages(username) {
    const allMessages = getStorage(PHANTOM_MEMORY.privateMessagesKey, {});
    return allMessages[username] || [];
}

function addPrivateMessage(username, message) {
    const allMessages = getStorage(PHANTOM_MEMORY.privateMessagesKey, {});
    if (!allMessages[username]) allMessages[username] = [];
    allMessages[username].push({
        id: Date.now(),
        text: message,
        timestamp: Date.now(),
        read: false
    });
    setStorage(PHANTOM_MEMORY.privateMessagesKey, allMessages);
    updateUnreadCount(username);
    showToast(`📩 لديك رسالة جديدة: "${message}"`, "info");
}

function updateUnreadCount(username) {
    const messages = getPrivateMessages(username);
    const unread = messages.filter(m => !m.read).length;
    const badge = document.getElementById("unread-badge");
    if (badge) {
        badge.textContent = unread > 0 ? unread : "";
        badge.style.display = unread > 0 ? "block" : "none";
    }
}

function openPrivateMessages() {
    const username = getCurrentUsername();
    if (!username) {
        showToast("يجب تسجيل الدخول أولاً.", "error");
        return;
    }
    const messages = getPrivateMessages(username);
    let drawer = document.getElementById("private-messages-drawer");
    if (!drawer) {
        drawer = document.createElement("div");
        drawer.id = "private-messages-drawer";
        drawer.className = "side-drawer";
        drawer.innerHTML = `
            <div class="drawer-overlay" id="private-msg-overlay"></div>
            <div class="drawer-content">
                <div class="drawer-header">
                    <h2>📩 رسائلك الخاصة</h2>
                    <button id="close-private-msg-btn" class="drawer-close-btn" type="button">×</button>
                </div>
                <div class="drawer-body" id="private-msg-body">
                    <!-- المحتوى سيتم توليده هنا -->
                </div>
            </div>
        `;
        document.body.appendChild(drawer);
        const overlay = document.getElementById("private-msg-overlay");
        const closeBtn = document.getElementById("close-private-msg-btn");
        const close = () => {
            drawer.classList.remove("active");
            drawer.setAttribute("aria-hidden", "true");
        };
        if (overlay) overlay.addEventListener("click", close);
        if (closeBtn) closeBtn.addEventListener("click", close);
    }

    const body = document.getElementById("private-msg-body");
    if (!body) return;
    let messagesHtml = "";
    if (messages.length === 0) {
        messagesHtml = `<div class="empty-state">لا توجد رسائل خاصة.</div>`;
    } else {
        messagesHtml = messages.slice().reverse().map(msg => {
            const time = new Date(msg.timestamp).toLocaleString("ar-EG", { hour: '2-digit', minute: '2-digit' });
            return `
                <div class="admin-mini-item" style="border-right:3px solid ${msg.read ? 'var(--cyan)' : 'var(--yellow)'}; margin-bottom:8px; padding:10px; border-radius:6px; background:rgba(255,255,255,0.03);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.85rem;">${escapeHTML(msg.text)}</span>
                        <small style="color:var(--silver-muted,#aaa); font-size:0.65rem;">🕒 ${time}</small>
                    </div>
                </div>
            `;
        }).join("");
    }
    body.innerHTML = messagesHtml;

    const allMessages = getStorage(PHANTOM_MEMORY.privateMessagesKey, {});
    if (allMessages[username]) {
        allMessages[username].forEach(m => m.read = true);
        setStorage(PHANTOM_MEMORY.privateMessagesKey, allMessages);
        updateUnreadCount(username);
    }

    drawer.classList.add("active");
    drawer.setAttribute("aria-hidden", "false");
}

/* ========================================================
   28. نظام Clips (أفضل فيديو في الأسبوع) - نقطة 10
   ======================================================== */

function setupClips() {
    const clipsPage = getElement("clips-view");
    if (!clipsPage) return;
    
    // تحميل الفيديو الحالي
    renderClips();
}

function getClipsData() {
    return getStorage(PHANTOM_MEMORY.clipsKey, {
        videoUrl: "",
        uploadedBy: "",
        uploadedAt: null,
        likes: 0,
        likedBy: []
    });
}

function setClipsData(data) {
    setStorage(PHANTOM_MEMORY.clipsKey, data);
}

function getComments() {
    return getStorage(PHANTOM_MEMORY.commentsKey, []);
}

function setComments(comments) {
    setStorage(PHANTOM_MEMORY.commentsKey, comments);
}

function renderClips() {
    const container = getElement("clips-container");
    if (!container) return;
    const data = getClipsData();
    const comments = getComments();
    
    let html = "";
    if (!data.videoUrl) {
        html = `
            <div class="empty-state" style="text-align:center; padding:40px;">
                <p style="font-size:1.2rem; color:var(--silver-muted,#aaa);">🎬 لا يوجد فيديو هذا الأسبوع</p>
                ${isFounderSession() ? `<button id="upload-clip-btn" class="btn-primary" style="margin-top:15px;">رفع فيديو جديد</button>` : ""}
            </div>
        `;
        container.innerHTML = html;
        const uploadBtn = document.getElementById("upload-clip-btn");
        if (uploadBtn) {
            uploadBtn.addEventListener("click", () => showClipUploadForm());
        }
        return;
    }

    // عرض الفيديو
    html = `
        <div style="width:100%; max-width:600px; margin:0 auto; position:relative;">
            <video src="${escapeHTML(data.videoUrl)}" controls style="width:100%; border-radius:12px; background:#000; display:block;" poster=""></video>
            <div style="display:flex; justify-content:center; gap:20px; margin-top:12px;">
                <button id="like-clip-btn" class="btn-accent" style="padding:8px 16px; border-radius:8px;">
                    👍 ${data.likes || 0}
                </button>
                <button id="open-comments-btn" class="btn-secondary" style="padding:8px 16px; border-radius:8px;">
                    💬 تعليقات (${comments.length})
                </button>
            </div>
            ${isFounderSession() ? `<button id="change-clip-btn" class="btn-warning" style="margin-top:10px; width:100%; padding:8px; border-radius:8px;">تغيير الفيديو</button>` : ""}
        </div>
    `;
    container.innerHTML = html;

    // تفاعل الإعجاب
    const likeBtn = document.getElementById("like-clip-btn");
    if (likeBtn) {
        likeBtn.addEventListener("click", () => {
            const username = getCurrentUsername();
            if (!username) { showToast("يجب تسجيل الدخول.", "error"); return; }
            const data = getClipsData();
            if (data.likedBy.includes(username)) {
                showToast("لقد أعجبت بالفعل!", "info");
                return;
            }
            data.likes = (data.likes || 0) + 1;
            data.likedBy.push(username);
            setClipsData(data);
            renderClips();
        });
    }

    // فتح التعليقات (Bottom Sheet)
    const commentsBtn = document.getElementById("open-comments-btn");
    if (commentsBtn) {
        commentsBtn.addEventListener("click", () => {
            openCommentsSheet();
        });
    }

    // تغيير الفيديو (للمؤسسين)
    const changeBtn = document.getElementById("change-clip-btn");
    if (changeBtn) {
        changeBtn.addEventListener("click", () => showClipUploadForm());
    }
}

function showClipUploadForm() {
    const modal = document.createElement("div");
    modal.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 99999;
        background: rgba(16,23,34,0.98);
        padding: 20px;
        border-radius: var(--radius-lg);
        border: 1px solid var(--border);
        box-shadow: 0 20px 60px rgba(0,0,0,0.8);
        width: 90%;
        max-width: 400px;
        text-align: center;
        direction: rtl;
    `;
    modal.innerHTML = `
        <h3 style="color:var(--white); margin-bottom:12px;">🎬 رفع فيديو الأسبوع</h3>
        <p style="font-size:0.8rem; color:var(--silver-muted); margin-bottom:10px;">انسخ رابط الفيديو وضعه هنا (سيتم عرضه مباشرة)</p>
        <input id="clip-url-input" type="url" placeholder="رابط الفيديو..." style="width:100%; padding:10px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:#fff; margin-bottom:10px;">
        <div style="display:flex; gap:10px;">
            <button id="submit-clip-btn" class="btn-success" style="flex:1;">رفع</button>
            <button id="close-clip-btn" class="btn-secondary" style="flex:1;">إلغاء</button>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement("div");
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.7);
        backdrop-filter: blur(4px);
        z-index: 99998;
    `;
    document.body.appendChild(overlay);

    const close = () => { modal.remove(); overlay.remove(); };
    document.getElementById("close-clip-btn").addEventListener("click", close);
    overlay.addEventListener("click", close);

    document.getElementById("submit-clip-btn").addEventListener("click", () => {
        const url = document.getElementById("clip-url-input").value.trim();
        if (!url) {
            showToast("ضع رابط الفيديو.", "error");
            return;
        }
        // حفظ الفيديو
        const data = {
            videoUrl: url,
            uploadedBy: getCurrentUsername(),
            uploadedAt: Date.now(),
            likes: 0,
            likedBy: []
        };
        setClipsData(data);
        // تصفير التعليقات عند تغيير الفيديو
        setComments([]);
        showToast("✅ تم رفع الفيديو بنجاح!", "success");
        close();
        renderClips();
    });
}

function openCommentsSheet() {
    const comments = getComments();
    let sheet = document.getElementById("comments-bottom-sheet");
    if (!sheet) {
        sheet = document.createElement("div");
        sheet.id = "comments-bottom-sheet";
        sheet.style.cssText = `
            position: fixed;
            bottom: 0;
            left: 0;
            width: 100%;
            max-height: 70vh;
            background: rgba(16,23,34,0.98);
            border-radius: 16px 16px 0 0;
            border: 1px solid var(--border);
            box-shadow: 0 -10px 40px rgba(0,0,0,0.8);
            z-index: 99999;
            transform: translateY(100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: flex;
            flex-direction: column;
            padding: 20px;
            direction: rtl;
        `;
        sheet.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; border-bottom:1px solid var(--border); padding-bottom:10px;">
                <h3 style="color:#fff; margin:0;">💬 التعليقات</h3>
                <button id="close-comments-sheet" style="background:none; border:none; color:#fff; font-size:1.5rem; cursor:pointer;">×</button>
            </div>
            <div id="comments-list" style="flex:1; overflow-y:auto; margin-bottom:15px; padding:0 5px;"></div>
            <div style="display:flex; gap:10px; align-items:center; border-top:1px solid var(--border); padding-top:10px;">
                <input id="comment-input" type="text" placeholder="ضع تعليق هنا ..." style="flex:1; padding:10px; border-radius:8px; border:1px solid var(--border); background:rgba(255,255,255,0.05); color:#fff;">
                <button id="send-comment-btn" class="btn-primary" disabled style="padding:10px 16px; border-radius:8px; opacity:0.5; pointer-events:none;">إرسال</button>
            </div>
        `;
        document.body.appendChild(sheet);
        
        // إضافة الأحداث
        const closeBtn = document.getElementById("close-comments-sheet");
        closeBtn.addEventListener("click", () => {
            sheet.style.transform = "translateY(100%)";
        });

        const input = document.getElementById("comment-input");
        const sendBtn = document.getElementById("send-comment-btn");
        input.addEventListener("input", () => {
            if (input.value.trim()) {
                sendBtn.disabled = false;
                sendBtn.style.opacity = "1";
                sendBtn.style.pointerEvents = "auto";
            } else {
                sendBtn.disabled = true;
                sendBtn.style.opacity = "0.5";
                sendBtn.style.pointerEvents = "none";
            }
        });

        sendBtn.addEventListener("click", () => {
            const text = input.value.trim();
            if (!text) return;
            const username = getCurrentUsername();
            if (!username) { showToast("يجب تسجيل الدخول.", "error"); return; }
            const newComments = getComments();
            newComments.push({
                id: Date.now(),
                username: username,
                text: text,
                timestamp: Date.now()
            });
            setComments(newComments);
            input.value = "";
            sendBtn.disabled = true;
            sendBtn.style.opacity = "0.5";
            sendBtn.style.pointerEvents = "none";
            renderComments();
        });
    }

    // إظهار الشيت
    sheet.style.transform = "translateY(0)";
    renderComments();
}

function renderComments() {
    const container = document.getElementById("comments-list");
    if (!container) return;
    const comments = getComments();
    if (!comments.length) {
        container.innerHTML = `<div class="empty-state" style="text-align:center; padding:20px; color:var(--silver-muted);">لا توجد تعليقات بعد. كن أول من يعلق!</div>`;
        return;
    }
    container.innerHTML = comments.reverse().map(c => `
        <div style="margin-bottom:10px; padding:10px; background:rgba(255,255,255,0.03); border-radius:8px; border-right:2px solid var(--gold-main);">
            <strong style="color:var(--gold-main);">${escapeHTML(c.username)}</strong>
            <span style="font-size:0.7rem; color:var(--silver-muted); margin-right:8px;">${new Date(c.timestamp).toLocaleString("ar-EG")}</span>
            <div style="margin-top:4px; color:#fff;">${escapeHTML(c.text)}</div>
        </div>
    `).join("");
}

/* ========================================================
   29. نظام المكالمات الصوتية (Voice Calls) - نقطة 8
   ======================================================== */

function setupVoiceCalls() {
    // هنا يتم تهيئة مكتبة WebRTC الخارجية (Agora/Twilio) لاحقاً
    console.log("📞 نظام المكالمات الصوتية جاهز للربط.");
    // إضافة عناصر وهمية للواجهة
    const voiceCallBtn = document.getElementById("voice-call-btn");
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener("click", () => {
            toggleVoiceCall();
        });
    }
}

function toggleVoiceCall() {
    // دالة مؤقتة للتبديل بين الحالات (ستُستبدل بكود WebRTC)
    const currentUser = getCurrentUsername();
    if (!currentUser) {
        showToast("يجب تسجيل الدخول لإجراء المكالمات.", "error");
        return;
    }
    showToast("📞 جارٍ الاتصال... (سيتم تفعيل المكالمات الصوتية عبر خدمة خارجية)", "info");
    
    // عرض واجهة المكالمة (مشابهة لواتساب)
    const callModal = document.createElement("div");
    callModal.id = "voice-call-modal";
    callModal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.95);
        z-index: 99999;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: #fff;
        direction: rtl;
    `;
    callModal.innerHTML = `
        <div style="text-align:center;">
            <div style="width:80px; height:80px; background:var(--gold-main); border-radius:50%; display:flex; justify-content:center; align-items:center; font-size:2rem; margin:0 auto 15px;">🎧</div>
            <h3>مكالمة جماعية</h3>
            <p style="color:var(--silver-muted);">${escapeHTML(currentUser)} - متصل</p>
            <div style="margin-top:30px; display:flex; gap:20px;">
                <button id="mute-call-btn" style="background:rgba(255,255,255,0.1); border:none; color:#fff; padding:15px; border-radius:50%; font-size:1.2rem; cursor:pointer;">🔇</button>
                <button id="end-call-btn" style="background:#ff4d4d; border:none; color:#fff; padding:15px 20px; border-radius:50%; font-size:1.2rem; cursor:pointer;">📞</button>
            </div>
        </div>
    `;
    document.body.appendChild(callModal);

    document.getElementById("end-call-btn").addEventListener("click", () => {
        callModal.remove();
        showToast("تم إنهاء المكالمة.", "info");
    });

    // هنا سيتم وضع كود ربط WebRTC الحقيقي بعدين
}

/* ========================================================
   30. تعديل دالة renderAll لتشمل تحديث القلوب والرسائل و Clips
   ======================================================== */

const originalRenderAll = renderAll;
renderAll = function() {
    originalRenderAll();
    renderHearts();
    const username = getCurrentUsername();
    if (username) updateUnreadCount(username);
    renderClips(); // تحديث واجهة الفيديو
};
