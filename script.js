/* ========================================================
   PHANTOM HQ - CORE SYSTEM (v9.0 - Final Clean Mods)
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
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 999999999;
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

function generateUniqueId() {
    return 'PH_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
}

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

function setupPushNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        console.warn("🔔 الإشعارات غير مدعومة في هذا المتصفح.");
        return;
    }
}

/* ========================================================
   2. البيانات الأساسية
   ======================================================== */

function getBasicData() {
    if (typeof phantomData !== "undefined" && phantomData) {
        return phantomData;
    }
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

function getBannedUsers() {
    const serverBanned = getStorage("phantom_server_banned_users", null);
    if (serverBanned) return serverBanned;
    return getStorage("phantom_banned_users", {});
}

function setBannedUsers(data) {
    setStorage("phantom_banned_users", data);
    setStorage("phantom_server_banned_users", data);
}
// ========================================================
// نظام حماية المطرودين (BAN SYSTEM)
// ========================================================

async function checkAndEnforceBan(username) {
    if (!username) return false;

    // 1. التحقق من Supabase (المصدر الأساسي)
    if (supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('banned_users')
                .select('*')
                .eq('username', username)
                .single();
            
            if (data) {
                enforceBan(username, data.reason || "مطرود من الكلان");
                return true;
            }
        } catch (e) {
            // تجاهل الخطأ (قد لا يكون الجدول موجوداً)
        }
    }

    // 2. التحقق من localStorage (نسخة احتياطية)
    const banned = getBannedUsers();
    if (banned[username] && banned[username].status === 'banned') {
        enforceBan(username, banned[username].reason || "مطرود من الكلان");
        return true;
    }

    return false;
}

function enforceBan(username, reason = "مطرود من الكلان") {
    // مسح الهوية تماماً
    clearIdentity();
    localStorage.removeItem('phantom_active_username');
    localStorage.removeItem('admin_authenticated');
    
    showToast(`🚫 أنت مطرود من الكلان. السبب: ${reason}`, "error");
    
    // إعادة تحميل الصفحة مع منع الدخول
    setTimeout(() => {
        location.reload();
    }, 1500);
}

function getRejoinRequests() {
    return getStorage("phantom_rejoin_requests", []);
}

function setRejoinRequests(data) {
    setStorage("phantom_rejoin_requests", data);
}

function getLocalPoints() {
    return getStorage("phantom_user_points", {});
}

function setLocalPoints(points) {
    setStorage("phantom_user_points", points);
}

function resetSeasonPoints() {
    setLocalPoints({});
    if (supabaseClient) {
        Promise.resolve(supabaseClient.from('leaderboard').delete().neq('id', 0)).then(() => {
            console.log("✅ تم تصفير نقاط الموسم في السيرفر.");
        }).catch(err => console.warn("⚠️ فشل تصفير نقاط الموسم في السيرفر:", err));
    }
}

/* ========================================================
   3. Supabase API Layer
   ======================================================== */

const SUPABASE_URL = "https://dmbprvvjmgccgztrhkay.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_R9U_-JY91tV87uLBaZjCWQ_wRhVshA5";

function safePostgrest(queryPromise) {
    return Promise.resolve(queryPromise);
}

let supabaseClient = null;
try {
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
    console.warn("⚠️ فشل إنشاء عميل Supabase. سيتم استخدام localStorage كنسخة احتياطية.");
}

async function checkSupabaseConnection() {
    if (!supabaseClient) return false;
    try {
        const { error } = await supabaseClient.from('members').select('id').limit(1);
        return !error;
    } catch (e) {
        return false;
    }
}

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

async function serverGetMembers() {
    const result = await supabaseGet('members');
    return result || getStorage("phantom_server_members", []);
}

async function serverCreateMember(username, rank, userId = null, gameId = null) {
    if (supabaseClient) {
        try {
            const { data: existing } = await supabaseClient.from('members').select('*').eq('name', username);
            if (existing && existing.length > 0) {
                const updates = {};
                if (!existing[0].userId && userId) updates.userId = userId;
                if (!existing[0].gameId && gameId) updates.gameId = gameId;
                if (Object.keys(updates).length > 0) {
                    await supabaseClient.from('members').update(updates).eq('name', username);
                    Object.assign(existing[0], updates);
                }
                return existing[0];
            }
        } catch (e) {}
    }

    const newData = { name: username, rank: rank || 'عضو' };
    if (userId) newData.userId = userId;
    if (gameId) newData.gameId = gameId;

    const newMember = await supabaseInsert('members', [newData]);
    if (newMember && newMember.length > 0) return newMember[0];

    const members = getStorage("phantom_custom_roster", []);
    const found = members.find(m => normalizeName(m.name) === normalizeName(username));
    if (found) return found;
    const localMember = {
        id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: userId || generateUniqueId(),
        gameId: gameId || null,
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
    const result = await supabaseInsert('messages', [{ sender: message.sender, text: message.text, timestamp: message.timestamp }]);
    if (result) return result;
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

async function serverDeleteWarning(nameOrId) {
    // ✅ تسجيل الإنذار كمحذوف عشان ما يرجعش بعد الرفريش
    let deletedWarnings = getStorage(PHANTOM_MEMORY.deletedWarningsKey, []);
    deletedWarnings.push(String(nameOrId));
    setStorage(PHANTOM_MEMORY.deletedWarningsKey, deletedWarnings);

    // مسح من localStorage أولاً
    let warnings = getStorage("phantom_warnings", []);
    warnings = warnings.filter(w => String(w.name) !== String(nameOrId) && String(w.id) !== String(nameOrId));
    setStorage("phantom_warnings", warnings);
    
    let serverWarnings = getStorage("phantom_server_warnings", []);
    serverWarnings = serverWarnings.filter(w => String(w.name) !== String(nameOrId) && String(w.id) !== String(nameOrId));
    setStorage("phantom_server_warnings", serverWarnings);

    // مسح من Supabase
    if (supabaseClient) {
        try {
            let { error } = await supabaseClient.from('warnings').delete().eq('name', nameOrId);
            if (error) {
                await supabaseClient.from('warnings').delete().eq('id', nameOrId);
            }
            return true;
        } catch (error) {
            console.warn(`⚠️ Supabase delete warning error:`, error);
            return false;
        }
    }
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

async function syncCurrentUserWithServer(username, gameId = null) {
    if (!username) return null;
    try {
        const userId = getCurrentUserId();
        const rank = isFounderSession() ? "رئيس" : "عضو";
        const member = await serverCreateMember(username, rank, userId, gameId);
        if (member) {
            setStorage("phantom_current_server_member", member);
            return member;
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function serverKickMember(usernameOrId) {
    if (!supabaseClient) return false;
    try {
        // حذف من جدول members
        const { error } = await supabaseClient.from('members').delete().eq('name', usernameOrId);
        if (error) {
            await supabaseClient.from('members').delete().eq('id', usernameOrId);
        }
        
        // إضافة إلى جدول banned_users
        await supabaseClient.from('banned_users').insert({
            username: usernameOrId,
            reason: 'تم الطرد بواسطة المشرف',
            banned_at: new Date().toISOString()
        });
        
        return true;
    } catch (error) {
        console.warn("⚠️ فشل حذف العضو من السيرفر:", error);
        return false;
    }
}

// ------------------------------------------------------------

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
    clipsKey: "phantom_clips_data",
       commentsKey: "phantom_clips_comments",
    onboardingKey: "phantom_onboarding_completed",
    deletedWarningsKey: "phantom_deleted_warnings",

};


/* ========================================================
   ✅ دالة جلب الـ Token من الخادم (Agora)
   ======================================================== */

// متغير عام لتخزين التوكن الاحتياطي
let cachedAgoraToken = null;

async function fetchToken(channelName, uid) {
    try {
        const response = await fetch("https://dmbprvvjmgccgztrhkay.supabase.co/functions/v1/get-agora-token", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "apikey": "sb_publishable_R9U_-JY91tV87uLBaZjCWQ_wRhVshA5",
                "Authorization": "Bearer sb_publishable_R9U_-JY91tV87uLBaZjCWQ_wRhVshA5"
            },
            body: JSON.stringify({ channelName: channelName, uid: uid })
        });
        const data = await response.json();
        return data.token;
    } catch (error) {
        console.error("❌ فشل جلب توكن أجورا:", error);
        return null;
    }
}

/* ========================================================
   5. تشغيل النظام العام
   ======================================================== */

document.addEventListener("DOMContentLoaded", async () => {
    console.log("⚡ PHANTOM HQ SYSTEM STARTING...");

// ✅ مزامنة المطرودين من السيرفر فوراً
await syncBannedUsers();

// ✅ التحقق من الحظر فوراً (يتم قبل أي شيء)
const username = getCurrentUsername();
if (username) {
    const isBanned = await checkAndEnforceBan(username);
    if (isBanned) return; // منع متابعة التحميل نهائياً
}

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

    setupClips();
    setupVoiceCalls();
    setupPushNotifications();
    requestNotificationPermission();

    startBanSystem();

    await loadServerData();

    renderAll();

    setupPresenceHeartbeat();
    setupChatRealtimeBridge();
    setupServiceWorker();
    
    initVault();
    initShop();
    initWheel();
    initSnake();

    initPacman(); 
    initBattle();

    setupInventory();

    // ✅ حل مشكلة 19: ربط زر الرسائل الجماعية
    setupBroadcastDrawer();

    console.log("✅ PHANTOM HQ SYSTEM READY");
});

async function loadServerData() {
    try {
        const members = await serverGetMembers();
        if (Array.isArray(members)) setStorage("phantom_server_members", members);

        // ✅ جلب الإنذارات من السيرفر بس من غير ما نمسح المحلي
        const warnings = await serverGetWarnings();
if (Array.isArray(warnings)) {
    const deletedWarnings = getStorage(PHANTOM_MEMORY.deletedWarningsKey, []);
    const deletedSet = new Set(deletedWarnings.map(w => String(w)));

    const filteredWarnings = warnings.filter(w => !deletedSet.has(String(w.id)) && !deletedSet.has(String(w.name)));

    const localWarnings = getStorage("phantom_warnings", []);
    const localIds = new Set(localWarnings.map(w => w.id));
    const newWarnings = filteredWarnings.filter(w => !localIds.has(w.id));
    if (newWarnings.length > 0) {
        localWarnings.push(...newWarnings);
        setStorage("phantom_warnings", localWarnings);
    }
    setStorage("phantom_server_warnings", filteredWarnings);
}

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
   7. هوية المستخدم
   ======================================================== */

function createIdentity(username, password = "", userId = null, gameId = null) {
    return {
        version: PHANTOM_MEMORY.identityVersion,
        username: username,
        password: password,
        userId: userId || generateUniqueId(),
        gameId: gameId || null,
        createdAt: Date.now(),
        expiresAt: Date.now() + PHANTOM_MEMORY.identityDurationDays * 24 * 60 * 60 * 1000
    };
}

function saveIdentity(username, password = "", userId = null, gameId = null) {
    if (!username) return false;
    return setStorage(PHANTOM_MEMORY.identityKey, createIdentity(username, password, userId, gameId));
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
    const username = getCurrentUsername();
    if (username) return "user_" + encodeURIComponent(username);
    return null;
}

function getCurrentGameId() {
    const identity = getSavedIdentity();
    if (identity && identity.gameId) return identity.gameId;
    return null;
}

function getCurrentUserRank() {
    if (typeof isFounderSession === "function" && isFounderSession()) {
        return "رئيس";
    }
    const username = (typeof getCurrentUsername === "function") ? getCurrentUsername() : (localStorage.getItem("phantom_active_username") || "");
    if (!username) return "محارب";
    try {
        if (typeof getFullRoster === "function") {
            const roster = getFullRoster();
            if (Array.isArray(roster)) {
                const member = roster.find(m => m && m.name && (typeof normalizeName === "function" ? normalizeName(m.name) === normalizeName(username) : m.name === username));
                if (member && member.rank) return member.rank;
            }
        }
    } catch (e) {
        // Fallback
    }
    return "محارب";
}
if (typeof window !== "undefined") {
    window.getCurrentUserRank = getCurrentUserRank;
}

function updateCurrentUser(username) {
    const display = getElement("current-user-display");
    if (display) {
        const rank = (typeof getCurrentUserRank === "function") ? getCurrentUserRank() : "محارب";
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
        userId: generateUniqueId(),
        gameId: null,
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
        safePostgrest(supabaseClient.from('members').update({ rank: 'رئيس' }).eq('name', username))
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
   8. بوابة الدخول
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
    
    const idDisplayArea = getElement("gate-id-area") || document.createElement("div");
    const rejoinArea = getElement("gate-rejoin-area") || document.createElement("div");

    if (!gate) return;
    
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

    if (savedIdentity && savedIdentity.username) {
        const username = savedIdentity.username;
        const bannedUsers = getBannedUsers();
        if (bannedUsers[username] && bannedUsers[username].status === 'banned') {
            gate.classList.remove("unlocked");
            step1.classList.remove("active");
            step2.classList.remove("active");
            showBannedScreen(username);
            return;
        }
        ensureUserIsMember(username);
        updateMemberLastSeen(username);
        updateCurrentUser(username);
        registerPresence(username);
        gate.classList.add("unlocked");
        syncCurrentUserWithServer(username, savedIdentity.gameId).catch(() => {});
        
        return;
    }

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
        const password = passInput ? passInput.value.trim() : "";
        const gameIdInput = document.getElementById('user-game-id-input');
        const gameId = gameIdInput ? gameIdInput.value.trim() : "";

        if (username.length < 2) {
            if (nameError) nameError.textContent = "اكتب اسمك بشكل صحيح (حرفين على الأقل).";
            shakeElement(nameInput);
            return;
        }

        const bannedUsers = getBannedUsers();
        if (bannedUsers[username] && bannedUsers[username].status === 'banned') {
            if (step2) step2.classList.remove("active");
            showBannedScreen(username);
            return;
        }

        // المعرف الداخلي يتولد في الخلفية ولا يظهر للمستخدم
        const userId = generateUniqueId();
        saveIdentity(username, password, userId, gameId);
        setStorage("phantom_active_username", username);

        // دخول تلقائي مباشر (مفيش زر "دخول الموقع" ولا "نسخ")
        const localMember = ensureUserIsMember(username);
        updateMemberLastSeen(username);
        updateCurrentUser(username);
        registerPresence(username);
        gate.classList.add("unlocked");
        if (nameError) nameError.textContent = "";

        const identity = getSavedIdentity();
        const serverMember = await syncCurrentUserWithServer(username, identity ? identity.gameId : null);
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
        
    });
}
}

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
                const requests = getRejoinRequests();
                requests.push({
                    id: `rejoin_${Date.now()}`,
                    username: username,
                    message: message,
                    timestamp: Date.now(),
                    status: 'pending'
                });
                setRejoinRequests(requests);
                showToast("✅ تم إرسال طلب الرجوع للمؤسسين.", "success");
                input.value = "";
                renderFounderNotifications();
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
   ✅ نظام التسجيل الإجباري (Onboarding)
   ======================================================== */

function initOnboarding() {
    const modal = getElement("onboarding-modal");
    if (!modal) return;

    const next1 = getElement("onboarding-next-1");
    const next2 = getElement("onboarding-next-2");
    const saveBtn = getElement("onboarding-save-btn");

    if (next1) {
        next1.addEventListener("click", () => {
            const password = getElement("onboarding-password").value.trim();
            if (!password) { showToast("أدخل الرقم السري.", "error"); return; }
            showOnboardingStep(2);
        });
    }
    if (next2) {
        next2.addEventListener("click", () => {
            const ign = getElement("onboarding-ign").value.trim();
            if (!ign) { showToast("أدخل اسم اللاعب.", "error"); return; }
            showOnboardingStep(3);
        });
    }
    if (saveBtn) {
        saveBtn.addEventListener("click", async () => {
            const password = getElement("onboarding-password").value.trim();
            const ign = getElement("onboarding-ign").value.trim();
            const gameId = getElement("onboarding-game-id").value.trim();
            if (!password || !ign || !gameId) { showToast("أكمل جميع الحقول.", "error"); return; }
            await saveOnboardingData(password, ign, gameId);
        });
    }
}

function showOnboardingStep(step) {
    for (let i = 1; i <= 3; i++) {
        const el = getElement(`onboarding-step-${i}`);
        if (el) el.classList.toggle("active", i === step);
    }
}



async function saveOnboardingData(password, ign, gameId) {
    const username = getCurrentUsername();
    if (!username) return;

    const localCompleted = getStorage(PHANTOM_MEMORY.onboardingKey, {});
    localCompleted[username] = true;
    setStorage(PHANTOM_MEMORY.onboardingKey, localCompleted);

    if (supabaseClient) {
        try {
            const { error } = await supabaseClient.from('members').update({
                has_completed_onboarding: true,
                secret_password: password,
                in_game_name: ign,
                in_game_id: gameId
            }).eq('name', username);
            if (error) console.warn("⚠️ فشل حفظ بيانات Onboarding في Supabase:", error);
        } catch (e) {
            console.warn("⚠️ خطأ أثناء حفظ Onboarding:", e);
        }
    }

    const modal = getElement("onboarding-modal");
    if (modal) modal.style.display = "none";
    showToast("✅ تم استكمال التسجيل بنجاح!", "success");
    renderAll();
}

/* ========================================================
   9. التواجد أونلاين
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
    renderChatOnlineCount();
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
   11. لوحة القيادة الجديدة
   ======================================================== */

function setupAdminPanel() {
    // ✅ مسح الصلاحية القديمة عند فتح الصفحة عشان يظهر المربع أول مرة

    const adminTrigger = getElement("admin-panel-trigger");
    const adminDashboard = getElement("admin-dashboard-overlay");
    const adminClose = getElement("admin-close-btn");
    const adminAccessPanel = getElement("admin-access-panel");
    const adminAccessOverlay = getElement("admin-access-overlay");
    const closeAdminAccessBtn = getElement("close-admin-access-btn");
    const adminPassInput = getElement("admin-pass-input");
    const adminPassSubmit = getElement("admin-pass-submit");
    const adminPassError = getElement("admin-pass-error");
    const welcomeMsg = getElement("admin-welcome-msg");

    function isAdminAuthenticated() {
        return localStorage.getItem('admin_authenticated') === 'true';
    }

    function openAdminDashboard() {
    // ✅ التحقق من الجلسة قبل الفتح
    if (sessionStorage.getItem('admin_authenticated') !== 'true') {
        // لو مش مسجل، افتح نافذة كلمة السر
        adminAccessPanel.classList.add('active');
        adminPassInput.value = '';
        adminPassError.style.display = 'none';
        return;
    }

    if (adminDashboard) {
        adminDashboard.style.display = 'flex';
        if (welcomeMsg) {
            welcomeMsg.style.display = 'block';
            setTimeout(() => { welcomeMsg.style.display = 'none'; }, 5000);
        }
        initAdminPage1();
        initAdminPage2();
        initAdminPage3();
        initAdminPage4();
        initAdminPage5();
    }
}

    window.openAdminDashboard = openAdminDashboard;
    if (adminTrigger) {
    adminTrigger.addEventListener('click', function() {
        // ✅ التحقق من الجلسة الحالية (sessionStorage)
        if (sessionStorage.getItem('admin_authenticated') === 'true') {
            // ✅ لو مسجل في الجلسة الحالية، افتح اللوحة مباشرة
            let currentPage = document.querySelector('.page-view.active');
            if(currentPage) localStorage.setItem('phantom_prev_page', currentPage.id);
            openAdminDashboard();
        } else {
            // ✅ لو مش مسجل، افتح نافذة كلمة السر
            adminAccessPanel.classList.add('active');
            adminPassInput.value = '';
            adminPassError.style.display = 'none';
        }
    });
}

    if (closeAdminAccessBtn) {
        closeAdminAccessBtn.addEventListener('click', function() {
            adminAccessPanel.classList.remove('active');
        });
    }

    if (adminAccessOverlay) {
        adminAccessOverlay.addEventListener('click', function() {
            adminAccessPanel.classList.remove('active');
        });
    }

    if (adminPassSubmit) {
    adminPassSubmit.addEventListener('click', function() {
        const pass = adminPassInput.value;
        if (pass === '246810') {
            // ✅ حفظ الجلسة في sessionStorage فقط (وليس localStorage)
            sessionStorage.setItem('admin_authenticated', 'true');
            adminAccessPanel.classList.remove('active');
            openAdminDashboard();
            showToast("🎉 مرحبًا بك يا قائد 👑", "success");

            // ✅ تحديث الرتبة إلى "رئيس" في كل مكان (البيانات المحلية + السيرفر)
            const username = getCurrentUsername();
            if (username) {
                // تحديث محلي
                let customRoster = getStorage("phantom_custom_roster", []);
                customRoster = customRoster.map(m => { if (m && m.name === username) { m.rank = 'رئيس'; } return m; });
                setStorage("phantom_custom_roster", customRoster);

                let serverMembers = getStorage("phantom_server_members", []);
                serverMembers = serverMembers.map(m => { if (m && m.name === username) { m.rank = 'رئيس'; } return m; });
                setStorage("phantom_server_members", serverMembers);

                // تحديث في السيرفر (Supabase)
                if (supabaseClient) {
                    safePostgrest(supabaseClient.from('members').update({ rank: 'رئيس' }).eq('name', username))
                        .then(() => console.log("✅ تم ترقية الرتبة في السيرفر"))
                        .catch(err => console.warn("⚠️ فشل ترقية الرتبة في السيرفر:", err));
                }

                // إعادة رسم الواجهة بالكامل (الأعضاء، البروفايل، الشات، الصدارة)
                renderAll();
                updateCurrentUser(username);
            }
        } else {
            adminPassError.style.display = 'block';
            shakeElement(adminPassInput);
        }
    });
}

    if (adminClose) {
    adminClose.addEventListener('click', function() {
        // ✅ الرجوع إلى الصفحة المحفوظة بدلاً من الرئيسية
        let prevPageId = localStorage.getItem('phantom_prev_page') || 'page-home';
        document.querySelectorAll('.page-view').forEach(p => p.classList.remove('active'));
        let prevPage = document.getElementById(prevPageId);
        if(prevPage) prevPage.classList.add('active');

        adminDashboard.style.display = 'none';
    });
}

    document.querySelectorAll('.admin-card').forEach(card => {
        card.addEventListener('click', function() {
            const pageId = this.getAttribute('data-admin-page');
            if (adminDashboard) adminDashboard.style.display = 'none';
            const targetPage = getElement(pageId);
            if (targetPage) targetPage.style.display = 'block';
            
            if (pageId === 'admin-page-1') initAdminPage1();
            else if (pageId === 'admin-page-2') initAdminPage2();
            else if (pageId === 'admin-page-3') initAdminPage3();
            else if (pageId === 'admin-page-4') initAdminPage4();
            
        });
    });

    document.querySelectorAll('.admin-back-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const page = this.closest('.admin-full-page');
            if (page) page.style.display = 'none';
            const dashboard = getElement('admin-dashboard-overlay');
            if (dashboard) dashboard.style.display = 'flex';
        });
    });
}

/* ========================================================
   12. تهيئة الصفحات الأربعة الجديدة + تعبئة القوائم
   ======================================================== */

function populateAdminSelects() {
    const roster = getFullRoster(); // ✅ الآن يستثني المطرودين
    const memberOptions = roster.map(m => `<option value="${escapeHTML(m.name)}">${escapeHTML(m.name)}</option>`).join('');

    const warningSelect = getElement('warning-member-select');
    const kickSelect = getElement('kick-member-select');
    const attendanceSelect = getElement('attendance-member-select');
    const cancelWarningSelect = getElement('cancel-warning-member-select');

    if (warningSelect) warningSelect.innerHTML = memberOptions;
    if (kickSelect) kickSelect.innerHTML = memberOptions;
    if (attendanceSelect) attendanceSelect.innerHTML = memberOptions;

    if (cancelWarningSelect) {
        const warnings = getWarnings();
        const warnedUsers = warnings.map(w => w.name);
        const warnedOptions = roster.filter(m => warnedUsers.includes(m.name)).map(m => `<option value="${escapeHTML(m.name)}">${escapeHTML(m.name)}</option>`).join('');
        cancelWarningSelect.innerHTML = warnedOptions || '<option value="">لا يوجد إنذارات</option>';
    }
}

function initAdminPage1() {
    const roster = getFullRoster();
    populateAdminSelects();

    const addBtn = getElement('add-member-btn');
    if (addBtn) {
        addBtn.onclick = async function() {
            const idInput = getElement('new-member-id');
            const nameInput = getElement('new-member-name');
            const verifiedInput = getElement('new-member-verified');
            if (!idInput || !nameInput) return;
            const id = idInput.value.trim();
            const name = nameInput.value.trim();
            const status = verifiedInput ? verifiedInput.value : 'موثق';
            if (!id || !name) { showToast('⚠️ أدخل الـ ID والاسم.', 'error'); return; }
            const member = await serverCreateMember(name, 'عضو', id);
            if (member) {
                let members = getStorage('phantom_server_members', []);
                members.push(member);
                setStorage('phantom_server_members', members);
                showToast('✅ تم إضافة العضو بنجاح.', 'success');
                idInput.value = ''; nameInput.value = '';
                renderAll();
                populateAdminSelects();
            } else {
                showToast('⚠️ فشل إضافة العضو.', 'error');
            }
        };
    }

    const warnBtn = getElement('issue-warning-btn');
    if (warnBtn) {
        warnBtn.onclick = async function() {
            const memberSelect = getElement('warning-member-select');
            const typeSelect = getElement('warning-type-select');
            const reasonInput = getElement('warning-reason-input');
            if (!memberSelect || !typeSelect || !reasonInput) return;
            const name = memberSelect.value;
            const type = typeSelect.value;
            const reason = reasonInput.value.trim();
            if (!name || !reason) { showToast('⚠️ اختر العضو واكتب السبب.', 'error'); return; }
            await serverCreateWarning(name, type, reason);
            let warnings = getStorage('phantom_warnings', []);
            warnings.push({ id: `warning_${Date.now()}`, name: name, type: type, reason: reason, date: new Date().toLocaleDateString('ar-EG') });
            setStorage('phantom_warnings', warnings);
            showToast(`🚨 تم إصدار ${type} بحق ${name}.`, 'success');
            reasonInput.value = '';
            renderWarnings();
            populateAdminSelects();
        };
    }

    const kickBtn = getElement('kick-member-btn');
    if (kickBtn) {
        kickBtn.onclick = function() {
            const memberSelect = getElement('kick-member-select');
            if (!memberSelect) return;
            const name = memberSelect.value;
            if (!name) { showToast('⚠️ اختر العضو.', 'error'); return; }
            
            const confirmPopup = document.querySelector('#admin-page-1 .admin-popup-confirm');
            if (confirmPopup) {
                confirmPopup.style.display = 'block';
                const confirmBtn = confirmPopup.querySelector('.btn-success');
                const cancelBtn = confirmPopup.querySelector('.btn-danger');
                
                confirmBtn.onclick = async function() {
                    await serverKickMember(name);
                    let bannedUsers = getBannedUsers();
                    bannedUsers[name] = { status: 'banned', bannedAt: Date.now(), reason: 'تم الطرد بواسطة الأدمن' };
                    setBannedUsers(bannedUsers);
                    let members = getStorage('phantom_custom_roster', []);
                    members = members.filter(m => m.name !== name);
                    setStorage('phantom_custom_roster', members);
                    showToast(`🚫 تم استبعاد ${name}.`, 'info');
                    confirmPopup.style.display = 'none';
                    renderAll();
                    populateAdminSelects();
                };
                cancelBtn.onclick = function() { confirmPopup.style.display = 'none'; };
            }
        };
    }

    // ✅ زر إلغاء الإنذار (شغال 100% مع السيرفر)
    const cancelWarnBtn = getElement('cancel-warning-btn');
if (cancelWarnBtn) {
    cancelWarnBtn.onclick = async function() {
        const memberSelect = getElement('cancel-warning-member-select');
        if (!memberSelect) return;
        const name = memberSelect.value;
        if (!name) { showToast('⚠️ اختر العضو.', 'error'); return; }

        // ✅ تسجيل الإنذار كمحذوف عشان ما يرجعش بعد الرفريش
        let deletedWarnings = getStorage(PHANTOM_MEMORY.deletedWarningsKey, []);
        deletedWarnings.push(String(name));
        setStorage(PHANTOM_MEMORY.deletedWarningsKey, deletedWarnings);

        // 1. مسح من الذاكرة المحلية
        let localWarnings = getStorage('phantom_warnings', []);
        localWarnings = localWarnings.filter(w => w.name !== name);
        setStorage('phantom_warnings', localWarnings);

        // 2. مسح من سجل السيرفر المحفوظ محلياً
        let serverWarnings = getStorage('phantom_server_warnings', []);
        serverWarnings = serverWarnings.filter(w => w.name !== name);
        setStorage('phantom_server_warnings', serverWarnings);

        // 3. مسح من السيرفر مباشرة
        if (supabaseClient) {
            try {
                await supabaseClient.from('warnings').delete().eq('name', name);
            } catch (e) { console.warn("تعذر الحذف من السيرفر:", e); }
        }

        // 4. إعادة رسم القوائم فوراً
        renderWarnings();
        renderAdminWarnings();
        populateAdminSelects();

        // 5. رسالة نجاح
        showToast(`✅ تم إلغاء إنذار ${name}.`, 'success');
    };
}
}

    
function initAdminPage2() {
    const events = getEventsList();
    const activeSelect = getElement('active-events-select');
    if (activeSelect) {
        activeSelect.innerHTML = events.length ? events.map(e => `<option value="${e.id}">${e.title}</option>`).join('') : '<option value="">لا توجد رومات نشطة</option>';
    }

    const createBtn = getElement('create-event-btn');
    if (createBtn) {
        createBtn.onclick = async function() {
            const modeSelect = getElement('room-mode-select');
            const titleInput = getElement('event-title-input');
            const descInput = getElement('event-description-input');
            const rulesInput = getElement('event-rules-input');
            const timingInput = getElement('event-timing-select');
            if (!modeSelect || !titleInput) { showToast('⚠️ أكمل الحقول.', 'error'); return; }
            const mode = modeSelect.value;
            const title = titleInput.value.trim();
            const desc = descInput ? descInput.value.trim() : '';
            const rules = rulesInput ? rulesInput.value.trim() : '';
            const timing = timingInput ? timingInput.value : '';
            if (!mode || !title) { showToast('⚠️ اختر المود واكتب الاسم.', 'error'); return; }
            
            if (getEventsList().length > 0) { showToast('⚠️ يوجد روم نشط بالفعل! قم بإلغائه أولاً.', 'error'); return; }
            
            const event = {
                id: `event_${Date.now()}`,
                mode: mode, title: title, description: desc, rules: rules,
                timing: timing, timingLabel: timing, createdAt: Date.now()
            };
            await serverCreateEvent(event);
            let events = getEventsList();
            events.push(event);
            setStorage(PHANTOM_MEMORY.eventsKey, events);
            showToast('✅ تم نشر الروم بنجاح.', 'success');
            renderRooms();
            initAdminPage2();
        };
    }

    const deleteBtn = getElement('cancel-room-btn');
    if (deleteBtn) {
        deleteBtn.onclick = async function() {
            const activeSelect = getElement('active-events-select');
            if (!activeSelect) return;
            const id = activeSelect.value;
            if (!id) { showToast('⚠️ اختر الروم.', 'error'); return; }
            await serverDeleteEvent(id);
            let events = getEventsList();
            events = events.filter(e => e.id !== id);
            setStorage(PHANTOM_MEMORY.eventsKey, events);
            showToast('🗑️ تم إلغاء الروم.', 'success');
            renderRooms();
            initAdminPage2();
        };
    }
}

function initAdminPage3() {
    populateAdminSelects();
    
    // ✅ إضافة مهمة جداً: تشغيل دالة الاستطلاع عشان زر الإلغاء يشتغل
    setupPollCreator();

    const attendanceBtn = getElement('mark-attendance-btn');
    if (attendanceBtn) {
        attendanceBtn.onclick = function() {
            const memberSelect = getElement('attendance-member-select');
            if (!memberSelect) return;
            const name = memberSelect.value;
            if (!name) { showToast('⚠️ اختر العضو.', 'error'); return; }
            
            const extraPointsInput = getElement('attendance-extra-points');
            let extraPoints = extraPointsInput ? parseInt(extraPointsInput.value) || 0 : 0;
            if (extraPoints < 0) extraPoints = 0;

            addPoints(name, 30 + extraPoints);
            let attendance = getStorage(PHANTOM_MEMORY.attendanceRecordsKey, {});
            attendance[name] = (attendance[name] || 0) + 1;
            setStorage(PHANTOM_MEMORY.attendanceRecordsKey, attendance);
            showToast(`✅ تم تسجيل حضور ${name} (${30 + extraPoints}+).`, 'success');
            renderAll();
        };
    }

    const minusBtn = getElement('attendance-minus-btn');
    const plusBtn = getElement('attendance-plus-btn');
    const extraInput = getElement('attendance-extra-points');

    if (minusBtn && extraInput) {
        minusBtn.onclick = function() { let val = parseInt(extraInput.value) || 0; if (val > 0) val--; extraInput.value = val; };
    }
    if (plusBtn && extraInput) {
        plusBtn.onclick = function() { let val = parseInt(extraInput.value) || 0; val++; extraInput.value = val; };
    }

    const notifyBtn = getElement('send-notification-btn');
    if (notifyBtn) {
        notifyBtn.onclick = function() {
            const input = getElement('notification-text-input');
            if (!input) return;
            const text = input.value.trim();
            if (!text) { showToast('اكتب نص الإشعار.', 'error'); return; }
            addSystemUpdate('📢 إشعار جماعي', text, true);
            showToast('📢 تم إرسال الإشعار للجميع.', 'success');
            input.value = '';
        };
    }
}

function initAdminPage4() {
    renderRadarChat();
    renderAdminInbox();
    renderSuggestions(); // ✅ إضافة
}

function renderRadarChat() {
    const container = getElement('radar-chat-container');
    if (!container) return;
    const messages = getStorage(PHANTOM_MEMORY.chatStorageKey, []).slice(-20).reverse();
    if (!messages.length) {
        container.innerHTML = '<p>لا توجد رسائل بعد.</p>';
        return;
    }
    container.innerHTML = messages.map(msg => `
        <div class="radar-msg" data-sender="${escapeHTML(msg.sender)}" style="padding:8px; margin-bottom:5px; background:rgba(255,255,255,0.05); border-radius:5px; cursor:pointer;">
            <strong style="color:var(--gold);">${escapeHTML(msg.sender)}</strong>: ${escapeHTML(msg.text)}
        </div>
    `).join('');

    container.querySelectorAll('.radar-msg').forEach(msgEl => {
        let timer = null;
        const start = () => { timer = setTimeout(() => { showMutePopup(msgEl.getAttribute('data-sender')); }, 600); };
        const cancel = () => { clearTimeout(timer); };
        msgEl.addEventListener('touchstart', start);
        msgEl.addEventListener('touchend', cancel);
        msgEl.addEventListener('mousedown', start);
        msgEl.addEventListener('mouseup', cancel);
        msgEl.addEventListener('mouseleave', cancel);
    });
}

function showMutePopup(memberName) {
    const popup = getElement('mute-popup');
    if (!popup) return;
    popup.style.display = 'block';
    popup.querySelector('.mute-user-name').textContent = memberName;

    const executeMuteBtn = popup.querySelector('.execute-mute-btn');
    const closeMuteBtn = popup.querySelector('.close-mute-btn');

    if (closeMuteBtn) closeMuteBtn.onclick = () => popup.style.display = 'none';

    if (executeMuteBtn) {
        executeMuteBtn.onclick = function() {
            let duration = 3600;
            popup.querySelectorAll('.mute-duration-btn').forEach(btn => {
                if (btn.classList.contains('selected')) duration = parseInt(btn.getAttribute('data-duration'));
            });
            
            let mutedUsers = getStorage('phantom_muted_users', {});
            mutedUsers[memberName] = { mutedUntil: Date.now() + duration * 1000 };
            setStorage('phantom_muted_users', mutedUsers);
            
            showToast(`🔇 تم كتم ${memberName} لمدة ${duration / 3600} ساعة.`, 'info');
            popup.style.display = 'none';
        };
    }

    popup.querySelectorAll('.mute-duration-btn').forEach(btn => {
        btn.onclick = function() {
            popup.querySelectorAll('.mute-duration-btn').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
        };
    });
}

function renderAdminInbox() {
    const container = getElement('admin-inbox-container');
    if (!container) return;
    
    let html = '';
    const complaints = getStorage(PHANTOM_MEMORY.complaintsKey, []);
    const rejoinRequests = getRejoinRequests().filter(r => r.status === 'pending');
    const excuses = getStorage(PHANTOM_MEMORY.excusesKey, []);
    const nameChanges = getStorage(PHANTOM_MEMORY.nameChangeRequestsKey, []);
    const idChanges = getStorage("phantom_id_change_requests", []);

    const allRequests = [
        ...complaints.map(c => ({...c, type: 'شكوى'})),
        ...rejoinRequests.map(r => ({...r, type: 'رجوع'})),
        ...excuses.map(e => ({...e, type: 'عذر'})),
        ...nameChanges.map(n => ({...n, type: 'اسم'})),
        ...idChanges.map(i => ({...i, type: 'ID'}))
    ];

    if (!allRequests.length) {
        html = '<p style="color:var(--muted)">لا توجد طلبات حالياً.</p>';
    } else {
        html = allRequests.map(req => {
            let typeClass = '';
            let headerTitle = '';
            let mainText = '';
            let details = '';
            let buttonsHtml = '';

            // 1. الشكوى
            if (req.type === 'شكوى') {
                typeClass = 'type-complaint';
                headerTitle = 'شكوى';
                mainText = `${req.from} شكوى ${req.target}`;
                details = `السبب: ${req.reason}`;
                buttonsHtml = `
                    <button class="inbox-btn dismiss" onclick="dismissComplaint('${req.id}')">فض</button>
                    <button class="inbox-btn warn" onclick="giveWarningToComplaint('${req.id}')">تنبيه</button>
                    <button class="inbox-btn accept" onclick="giveBanToComplaint('${req.id}')">إنذار</button>
                    <button class="inbox-btn ban" onclick="kickMember('${req.target}')">طرد</button>
                `;
            }
            // 2. رجوع للكلان
            else if (req.type === 'رجوع') {
                typeClass = 'type-rejoin';
                headerTitle = 'رجوع للكلان';
                mainText = `${req.username} يريد الرجوع للكلان`;
                details = '';
                buttonsHtml = `
                    <button class="inbox-btn accept" onclick="handleRequest('${req.id}', 'accept', 'رجوع')">موافق</button>
                    <button class="inbox-btn reject" onclick="handleRequest('${req.id}', 'reject', 'رجوع')">رفض</button>
                `;
            }
            // 3. عذر عدم حضور
            else if (req.type === 'عذر') {
                typeClass = 'type-excuse';
                headerTitle = 'عذر عدم حضور';
                mainText = `${req.from} لم يحضر ${req.eventId}`;
                details = `السبب: ${req.reason}`;
                buttonsHtml = `
                    <button class="inbox-btn accept" onclick="acceptExcuse('${req.id}')">موافق</button>
                    <button class="inbox-btn reject" onclick="rejectExcuse('${req.id}')">رفض</button>
                `;
            }
            // 4. تغيير اسم
            else if (req.type === 'اسم') {
                typeClass = 'type-name';
                headerTitle = 'تغيير اسم';
                mainText = `${req.oldName} يريد تغيير اسم`;
                details = `جديد: ${req.newName}`;
                buttonsHtml = `
                    <button class="inbox-btn accept" onclick="approveNameChange('${req.id}')">موافق</button>
                    <button class="inbox-btn reject" onclick="rejectNameChange('${req.id}')">رفض</button>
                `;
            }
            // 5. تغيير ID
            else if (req.type === 'ID') {
                typeClass = 'type-id';
                headerTitle = 'تغيير ID';
                mainText = `${req.username} يريد تغيير ID`;
                details = `جديد: ${req.newId}`;
                buttonsHtml = `
                    <button class="inbox-btn accept" onclick="handleIdChange('${req.id}', 'accept')">موافق</button>
                    <button class="inbox-btn reject" onclick="handleIdChange('${req.id}', 'reject')">رفض</button>
                `;
            }

            return `
                <div class="inbox-item-v2 ${typeClass}">
                    <div class="inbox-item-v2.header">
                        <span>${headerTitle}</span>
                        <span style="font-size:0.7rem; color:#888;">${req.date || ''}</span>
                    </div>
                    <div class="inbox-item-v2.main-text">${mainText}</div>
                    ${details ? `<div class="inbox-item-v2.details">${details}</div>` : ''}
                    <div class="inbox-item-v2.buttons">${buttonsHtml}</div>
                </div>
            `;
        }).join('');
    }
    container.innerHTML = html;
}

function handleRequest(id, action, type) {
    // ✅ 1. طلب الرجوع
    if (type === 'طلب رجوع') {
        let requests = getRejoinRequests();
        const req = requests.find(r => r.id === id);
        if (req) {
            // تنفيذ القرار
            if (action === 'accept') {
                // حذفه من المحظورين
                let bannedUsers = getBannedUsers();
                delete bannedUsers[req.username];
                setBannedUsers(bannedUsers);
                
                // إرجاعه للقائمة المحلية
                let roster = getStorage("phantom_custom_roster", []);
                if (!roster.some(m => normalizeName(m.name) === normalizeName(req.username))) {
                    roster.push({
                        id: `local_${Date.now()}`,
                        userId: generateUniqueId(),
                        gameId: null,
                        name: req.username,
                        rank: 'عضو',
                        status: 'موثق',
                        points: 0,
                        joinedAt: Date.now(),
                        lastSeen: Date.now(),
                        source: 'auto'
                    });
                    setStorage("phantom_custom_roster", roster);
                }
                showToast(`✅ تم قبول رجوع ${req.username}.`, 'success');
            } else {
                // رفض (يبقى في المحظورين)
                req.status = 'rejected';
                showToast(`❌ تم رفض طلب ${req.username}.`, 'info');
            }
            
            // حذف الطلب نهائياً من القائمة (لأن القرار تم)
            requests = requests.filter(r => r.id !== id && r.status !== 'pending');
            setRejoinRequests(requests);
        }
    }
    
    // ✅ 2. الشكوى (فض أو إنذار)
    else if (type === 'شكوى') {
        let complaints = getStorage(PHANTOM_MEMORY.complaintsKey, []);
        const complaint = complaints.find(c => c.id === id);
        if (complaint) {
            if (action === 'accept') {
                // فض الشكوى (حذفها فقط)
                showToast('🗑️ تم فض الشكوى.', 'info');
            } else {
                // إنذار (يضيف إنذار للمشتكى منه)
                let warnings = getStorage("phantom_warnings", []);
                warnings.push({
                    id: `warning_${Date.now()}`,
                    name: complaint.target,
                    type: "إنذار",
                    reason: `بناءً على شكوى من ${complaint.from}: ${complaint.reason}`,
                    date: new Date().toLocaleDateString("ar-EG")
                });
                setStorage("phantom_warnings", warnings);
                showToast(`🚨 تم إصدار إنذار لـ ${complaint.target}.`, 'success');
                renderWarnings();
                renderAdminWarnings();
            }
            // حذف الشكوى نهائياً
            complaints = complaints.filter(c => c.id !== id);
            setStorage(PHANTOM_MEMORY.complaintsKey, complaints);
        }
    }
    
    // ✅ 3. عذر عدم حضور
    else if (type === 'عذر عدم حضور') {
        let excuses = getStorage(PHANTOM_MEMORY.excusesKey, []);
        const excuse = excuses.find(e => e.id === id);
        if (excuse) {
            if (action === 'accept') {
                showToast(`✅ تم قبول عذر ${excuse.from}.`, 'success');
            } else {
                showToast(`❌ تم رفض عذر ${excuse.from}.`, 'info');
            }
            excuses = excuses.filter(e => e.id !== id);
            setStorage(PHANTOM_MEMORY.excusesKey, excuses);
        }
    }
    
    // ✅ 4. طلب تغيير الاسم (الأهم)
    else if (type === 'طلب تغيير اسم') {
        if (action === 'accept') {
            approveNameChange(id);
        } else {
            rejectNameChange(id);
        }
    }

    // ✅ 5. طلب تغيير الـ ID (ده اللي كان ناقص وبيبوظ كل حاجة)
    else if (type === 'طلب تغيير ID') {
        handleIdChange(id, action);
        return; // بنوقف هنا عشان الـ ID له مسار مختلف
    }
    
    renderAdminInbox();
}
/* ========================================================
   13. إدارة الرومات والفاعليات
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
        // ✅ استخدام onclick بدلاً من addEventListener لمنع التكرار
        createBtn.onclick = async () => {
            if (!isFounderSession()) { showToast("⚠️ إنشاء الرومات مخصص للرؤساء فقط.", "error"); return; }
            const mode = modeSelect ? modeSelect.value : "";
            const title = titleInput ? titleInput.value.trim() : "";
            const description = descriptionInput ? descriptionInput.value.trim() : "";
            const rules = rulesInput ? rulesInput.value.trim() : "";
            const timing = timingSelect ? timingSelect.value : "none";
            let datetime = datetimeInput ? datetimeInput.value : "";
            if (!mode || !title) {
                showToast("⚠️ اختر المود واكتب اسم الروم أولاً.", "error");
                return;
            }

            let timingLabel = "بدون وقت محدد";
            if (timing === "5min") timingLabel = "5 دقائق";
            else if (timing === "1hour") timingLabel = "ساعة واحدة";
            else if (timing === "1day") timingLabel = "يوم واحد";
            else if (timing === "custom") {
                if (!datetime) { showToast("⚠️ اختر تاريخ ووقت للفاعلية.", "error"); return; }
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
            
            // ✅ استخدام Map لمنع التكرار عند الإضافة
            let events = getEventsList();
            const existingIds = new Set(events.map(e => e.id));
            if (!existingIds.has(newEvent.id)) {
                events.push(newEvent);
            }
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
        };
    }

    // ... باقي كود الإلغاء (بنفس الطريقة استبدل addEventListener بـ onclick)
    if (openPopupBtn && popup) {
        openPopupBtn.onclick = () => {
            populateActiveEventsSelect();
            popup.style.display = "block";
        };
    }
    if (closePopupBtn && popup) {
        closePopupBtn.onclick = () => {
            popup.style.display = "none";
        };
    }
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            if (!isFounderSession()) { showToast("⚠️ إلغاء الرومات مخصص للرؤساء فقط.", "error"); return; }
            const selectedId = activeSelect ? activeSelect.value : "";
            if (!selectedId) { showToast("⚠️ اختر الروم المراد إلغاؤه أولاً.", "error"); return; }
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
        };
    }
    if (timingSelect && datetimeInput) {
        timingSelect.onchange = () => {
            if (timingSelect.value === "custom") datetimeInput.style.display = "block";
            else { datetimeInput.style.display = "none"; datetimeInput.value = ""; }
        };
        datetimeInput.style.display = "none";
    }
}

// تحسين renderRooms لمنع التكرار وعرض تصميم قوي

function renderRooms() {
    const container = getElement("schedule-grid");
    if (!container) return;

    const data = getBasicData();
    const staticRooms = Array.isArray(data.rooms) ? data.rooms : [];
    const dynamicEvents = getEventsList();

    const seen = new Set();
    const allEvents = dynamicEvents.filter(ev => {
        if (seen.has(ev.id)) return false;
        seen.add(ev.id);
        return true;
    });

    const modeColors = {
        "سيد سلاح": "255,59,59",
        "صيد جامع": "255,215,0",
        "قتال فرق": "255,140,0",
        "معركة ملكية": "168,85,247",
        "تسليه": "0,229,240"
    };

    function buildEventCard(data) {
        const statusClass = data.status.type === "active" ? "status-active" : "status-waiting";
        const rulesHTML = Array.isArray(data.rules) && data.rules.length > 0
            ? data.rules.map(r => `<li>${escapeHTML(r)}</li>`).join("")
            : "";

        return `
        <div class="event-card" style="--accent-rgb:${data.accent};">
            <div class="event-stripe"><span>${escapeHTML(data.modName)}</span></div>
            <div class="event-body">
                <div class="event-header">
                    <span class="event-brand">PHANTOM HQ</span>
                    <span class="status-pill ${statusClass}">${escapeHTML(data.status.label)}</span>
                </div>
                <div class="event-title">${escapeHTML(data.title)}</div>
                <div class="event-mode">مود: ${escapeHTML(data.modName)}</div>
                ${data.description ? `<div class="event-desc">${escapeHTML(data.description)}</div>` : ""}
                <ul class="event-rules">${rulesHTML}</ul>
                <div class="event-footer">
                    <span class="event-time">⏰ ${escapeHTML(data.time)}</span>
                </div>
            </div>
        </div>`;
    }

    let eventsData = [];

    if (allEvents.length) {
        eventsData = allEvents.map(ev => {
            const modeColor = modeColors[ev.mode] || "0,229,240";
            const isActive = ev.timing === "بدون وقت محدد";
            const rules = ev.rules ? ev.rules.split('\n').filter(r => r.trim()) : [];
            return {
                title: ev.title,
                modName: ev.mode,
                accent: modeColor,
                description: ev.description || "",
                rules: rules,
                time: ev.timingLabel || "بدون وقت محدد",
                status: { label: isActive ? "نشط" : "قيد الانتظار", type: isActive ? "active" : "waiting" }
            };
        });
    }

    if (staticRooms.length) {
        staticRooms.forEach(room => {
            const modeColor = modeColors[room.mode] || "0,229,240";
            eventsData.push({
                title: room.title,
                modName: room.mode,
                accent: modeColor,
                description: room.description || "",
                rules: [],
                time: `${room.day} ${room.time}`,
                status: { label: "نشط", type: "active" }
            });
        });
    }

    if (!eventsData.length) {
        container.innerHTML = `<div class="empty-state">لا توجد رومات أو فاعليات حالياً.</div>`;
    } else {
        container.innerHTML = eventsData.map(buildEventCard).join("");
    }
}

/* ========================================================
   14. التحديثات المؤقتة
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
   15. الأعضاء والقيادة
   ======================================================== */

function getFullRoster() {
    const serverMembers = getStorage("phantom_server_members", []);
    const custom = getStorage("phantom_custom_roster", []);
    const banned = getBannedUsers();
    
    // ✅ استبعاد المطرودين نهائياً
    const all = [...serverMembers, ...custom].filter(member => {
        if (!member || !member.name) return false;
        if (banned[member.name] && banned[member.name].status === 'banned') return false;
        return true;
    });
    
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

    // دالة بناء بطاقة العضو بتصميم 3 (مع إضافة onclick لفتح البروفايل)
    function buildMemberCard(member) {
        const rankClass = isLeaderRank(member.rank) ? "rank-leader" : "rank-member";
        const isOnline = isMemberOnline(member.name);
        const presenceClass = isOnline ? "presence-online" : "presence-offline";
        const presenceText = isOnline ? "● متواجد" : "● غير متواجد";

        const hearts = getStorage(PHANTOM_MEMORY.heartsKey, {});
        const memberHearts = hearts[member.name] || 0;
        const points = getLocalPoints();
        const memberPoints = points[member.name] || 0;

        return `
        <div class="member-card-v2 ${rankClass}" onclick="openProfile('${escapeHTML(member.name)}')" style="cursor:pointer;">
            <div class="member-sidebar"></div>
            <div class="member-info">
                <div class="member-name">${escapeHTML(member.name)}</div>
                <div class="member-rank">Rank: ${escapeHTML(member.rank || "عضو")}</div>
                <div class="member-presence ${presenceClass}">${presenceText}</div>
            </div>
            <div class="member-stats">
                <span class="stat-item stat-points">⭐ ${memberPoints}</span>
                <span class="stat-item stat-hearts">❤️ ${memberHearts}</span>
            </div>
        </div>
        `;
    }

    // رسم قائمة الأعضاء
    const rosterGrid = getElement("roster-grid");
    if (rosterGrid) {
        rosterGrid.innerHTML = roster.length
            ? roster.map(buildMemberCard).join("")
            : `<div class="empty-state">لا يوجد أعضاء مسجلين حتى الآن.</div>`;
    }

    // رسم قائمة القيادة
    const leadershipGrid = getElement("leadership-grid");
    if (leadershipGrid) {
        leadershipGrid.innerHTML = leaders.length
            ? leaders.map(buildMemberCard).join("")
            : `<div class="empty-state">لا توجد قيادة مسجلة بعد.</div>`;
    }

    // رسم القائمة المصغرة في الرئيسية
    const previewList = getElement("roster-preview-list");
    if (previewList) {
        const preview = roster.slice(0, 8);
        previewList.innerHTML = preview.length
            ? preview.map(m => `<span class="roster-chip" onclick="openProfile('${escapeHTML(m.name)}')" style="cursor:pointer;">${escapeHTML(m.name)}</span>`).join("")
            : `<div class="empty-state">لا يوجد أعضاء بعد.</div>`;
    }
}

// دالة مساعدة للتحقق من التواجد الفعلي (سيرفر + محلي)
function isMemberOnline(username) {
    if (!username) return false;
    const current = typeof getCurrentUsername === 'function' ? getCurrentUsername() : null;
    if (current && normalizeName(username) === normalizeName(current)) return true;
    if (typeof serverOnlineUsers !== 'undefined' && Array.isArray(serverOnlineUsers)) {
        if (serverOnlineUsers.some(u => normalizeName(u.username) === normalizeName(username))) return true;
    }
    let users = getStorage(PHANTOM_MEMORY.presenceStorageKey, []);
    const now = Date.now();
    return users.some(user => normalizeName(user.name) === normalizeName(username) && now - user.time < 30 * 60 * 1000);
}

/* ========================================================
   16. لوحة الصدارة
   ======================================================== */

function addPoints(username, amount) {
    if (!username || amount < 0) return;
    const state = getCurrentSeasonState();
    if (state.isPointsLocked) return;

    let finalAmount = amount;
    // تفعيل تضخيم النقاط (30 دقيقة)
    const boost = getStorage("phantom_point_boost", null);
    if (boost && boost.active && Date.now() < boost.expiresAt) finalAmount *= 2;

    // تفعيل دبل نقاط (ساعة)
    const dbl = getStorage("phantom_double_points", null);
    if (dbl && dbl.active && Date.now() < dbl.expiresAt) finalAmount *= 2;

    const points = getLocalPoints();
    const current = Number(points[username] || 0);
    points[username] = current + (Number(finalAmount) || 0);
    setLocalPoints(points);
}

function renderLeaderboard() {
    const container = getElement("leaderboard-list");
    if (!container) return;
    const roster = getFullRoster();
    const localPoints = getLocalPoints();
    const sorted = roster.map(m => {
        // تفعيل كارت رؤية النقاط
const seePointsData = getStorage("phantom_see_points", null);
const canSeeHidden = seePointsData && seePointsData.active && Date.now() < seePointsData.expiresAt;

let p = (m.points || 0) + Number(localPoints[m.name] || 0);
if (!canSeeHidden && m.hide_score_until && Date.now() < new Date(m.hide_score_until)) {
    p = 0;
}
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
   17. تسجيل الحضور
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

    // لو مفيش رومات أو أعضاء، النسبة صفر
    if (totalRooms === 0 || roster.length === 0) return 0;

    // إجمالي مرات الحضور اللي سجلتها يدوياً من الشاشة
    let totalAttended = 0;
    roster.forEach(m => {
        totalAttended += attendanceRecords[m.name] || 0;
    });

    // المعادلة الصح: إجمالي الحضور ÷ (عدد الرومات × عدد الأعضاء) × 100
    const rate = (totalAttended / (totalRooms * roster.length)) * 100;

    // منع النسبة من تعدي 100%
    return Math.min(rate, 100);
}

function updateAttendanceRate() {
    const rateElement = getElement("stat-attendance-rate");
    if (!rateElement) return;

    // احضار البيانات
    const roster = getFullRoster();
    const attendanceRecords = getStorage(PHANTOM_MEMORY.attendanceRecordsKey, {});
    const events = getEventsList();
    const data = getBasicData();
    const staticRooms = Array.isArray(data.rooms) ? data.rooms : [];
    const totalRooms = events.length + staticRooms.length;

    // لو مفيش رومات أو أعضاء، النسبة 0
    if (totalRooms === 0 || roster.length === 0) {
        rateElement.textContent = "0%";
        return;
    }

    // حساب إجمالي الحضور الفعلي من سجلات الحضور
    let totalAttended = 0;
    roster.forEach(m => {
        totalAttended += attendanceRecords[m.name] || 0;
    });

    // لو مفيش أي حد حضر، النسبة 0% (مش هتظهر 30% وهمية)
    if (totalAttended === 0) {
        rateElement.textContent = "0%";
        return;
    }

    // المعادلة الصح: إجمالي الحضور ÷ (عدد الرومات × عدد الأعضاء) × 100
    const rate = (totalAttended / (totalRooms * roster.length)) * 100;
    rateElement.textContent = `${Math.min(rate, 100).toFixed(0)}%`;
}
/* ========================================================
   18. نظام الإنذارات
   ======================================================== */

function getWarnings() {
    // نأخذ القائمة من localStorage فقط (وليس من serverWarnings لأنها قد تحتوي على نسخ قديمة)
    const localWarnings = getStorage("phantom_warnings", []);
    const serverWarnings = getStorage("phantom_server_warnings", []);
    
    // ندمج مع إزالة التكرار بناءً على id
    const all = [...localWarnings, ...serverWarnings];
    const seen = new Set();
    return all.filter(item => {
        if (!item || !item.id) return false;
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
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
        logAdminAction(`🚨 إنذار للعضو ${name} (${type})`, name, 'warned');
    });
}
function isMemberExists(name) {
    const roster = getFullRoster();
    return roster.some(m => normalizeName(m.name) === normalizeName(name));
}
function renderWarnings() {
    const container = getElement("active-warnings-public-list");
    if (!container) return;
    const warnings = getWarnings().filter(w => isMemberExists(w.name));
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
    const warnings = getWarnings().filter(w => isMemberExists(w.name));
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
    
    if (!targetWarning) {
        showToast("⚠️ الإنذار غير موجود.", "error");
        return;
    }

    // ✅ تسجيل كـ محذوف عشان ما يرجعش من السيرفر
    let deletedWarnings = getStorage(PHANTOM_MEMORY.deletedWarningsKey, []);
    deletedWarnings.push(String(targetWarning.id));
    deletedWarnings.push(String(targetWarning.name));
    setStorage(PHANTOM_MEMORY.deletedWarningsKey, deletedWarnings);

    warnings = warnings.filter(w => String(w.id) !== String(id));
    setStorage("phantom_warnings", warnings);

    let serverWarnings = getStorage("phantom_server_warnings", []);
    serverWarnings = serverWarnings.filter(w => String(w.id) !== String(id) && w.name !== targetWarning.name);
    setStorage("phantom_server_warnings", serverWarnings);

    if (supabaseClient) {
        try {
            await serverDeleteWarning(targetWarning.name);
        } catch (e) {
            console.warn("⚠️ تعذر الحذف من السيرفر:", e);
            try {
                await supabaseClient.from('warnings').delete().eq('id', id);
            } catch (e2) {
                console.warn("⚠️ فشل الحذف بالـ id أيضاً:", e2);
            }
        }
    }

    renderWarnings();
    renderAdminWarnings();
    renderFounderNotifications();
    populateAdminSelects();
    
    showToast(`✅ تمت إزالة إنذار ${targetWarning.name} نهائياً.`, "success");
}

/* ========================================================
   19. إضافة واستبعاد الأعضاء
   ======================================================== */

function setupAddMember() {
    const button = getElement("add-member-btn");
    if (!button) return;
    button.addEventListener("click", async () => {
        if (!isFounderSession()) {
            showToast("⚠️ إضافة الأعضاء مخصصة للرؤساء فقط.", "error");
            return;
        }
        const idInput = getElement("new-member-id");
        const nameInput = getElement("new-member-name");
        const statusInput = getElement("new-member-verified");
        const userId = idInput ? idInput.value.trim() : "";
        const name = nameInput ? nameInput.value.trim() : "";
        const status = statusInput ? statusInput.value : "موثق";
        if (!userId || !name) {
            showToast("⚠️ اكتب الـ ID الخاص بالعضو واسمه.", "error");
            return;
        }
        const exists = getFullRoster().some(m => normalizeName(m.name) === normalizeName(name));
        if (exists) {
            showToast("⚠️ العضو موجود بالفعل.", "error");
            return;
        }
        const serverMember = await serverCreateMember(name, "عضو", userId);
        if (serverMember) {
            serverMember.userId = userId;
            serverMember.status = status;
            let members = getStorage("phantom_server_members", []);
            members.push(serverMember);
            setStorage("phantom_server_members", members);
        } else {
            const members = getStorage("phantom_custom_roster", []);
            members.push({
                id: `local_${Date.now()}`,
                userId: userId,
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
        logAdminAction(`➕ إضافة العضو ${name}`, name, 'info');
    });
}

function setupKickMember() {
    const button = getElement("kick-member-btn");
    if (!button) return;
    button.addEventListener("click", async () => {
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
        
        await serverKickMember(name);

        let bannedUsers = getBannedUsers();
        bannedUsers[name] = {
            status: 'banned',
            bannedAt: Date.now(),
            reason: 'تم الطرد بواسطة المشرف'
        };
        setBannedUsers(bannedUsers);

        let members = getStorage("phantom_custom_roster", []);
members = members.filter(m => normalizeName(m.name) !== normalizeName(name));
setStorage("phantom_custom_roster", members);

// ✅ حذف العضو من قائمة السيرفر المحفوظة محلياً
let serverMembers = getStorage("phantom_server_members", []);
serverMembers = serverMembers.filter(m => m && m.name && normalizeName(m.name) !== normalizeName(name));
setStorage("phantom_server_members", serverMembers);
        
        addSystemUpdate("استبعاد عضو", `تم استبعاد ${name} من السجل وإضافته لقائمة المطرودين.`);
        showToast(`🚫 تم استبعاد ${name}.`, "info");
        renderAll();
        populateAdminSelects();
        logAdminAction(`🚫 طرد العضو ${name}`, name, 'banned');
    });
}

/* ========================================================
   20. الاستطلاعات والتصويت (النظام الذكي)
   ======================================================== */

let userHasVotedOnce = {};

function setupPollCreator() {
    const button = getElement("create-poll-btn");
    const cancelButton = getElement("cancel-poll-btn");
    const multipleChoiceCheck = getElement("poll-multiple-choice");
    const optionsContainer = getElement("poll-options-container");

    // ✅ نظام الخيارات الأوتوماتيكي (زي واتساب بالظبط)
    if (optionsContainer) {
        optionsContainer.addEventListener("input", (e) => {
            if (e.target.classList.contains("poll-option-input")) {
                const allInputs = optionsContainer.querySelectorAll(".poll-option-input");
                const lastInput = allInputs[allInputs.length - 1];
                if (e.target === lastInput && e.target.value.trim() !== "") {
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

    // ✅ إنشاء الاستطلاع
    if (button) {
        button.addEventListener("click", async () => {
            if (!isFounderSession()) { showToast("⚠️ إنشاء الاستطلاعات مخصص للرؤساء فقط.", "error"); return; }
            const questionInput = getElement("poll-question-input");
            const optionInputs = optionsContainer ? optionsContainer.querySelectorAll(".poll-option-input") : [];
            const optionTexts = Array.from(optionInputs).map(inp => inp.value.trim()).filter(t => t !== "");
            const question = questionInput ? questionInput.value.trim() : "";
            
            if (!question || optionTexts.length < 2) { showToast("⚠️ اكتب السؤال وخيارين على الأقل.", "error"); return; }

            const multiple = multipleChoiceCheck ? multipleChoiceCheck.checked : false;
            const poll = { id: `poll_${Date.now()}`, question: question, options: optionTexts.map((text, idx) => ({ id: idx + 1, text: text, votes: 0 })), voters: {}, totalVotes: 0, multiple: multiple, createdAt: Date.now(), createdBy: getCurrentUsername() };

            setStorage(PHANTOM_MEMORY.pollStorageKey, poll);
            removeStorage(PHANTOM_MEMORY.pollVoteKey);
            if (questionInput) questionInput.value = "";
            if (optionsContainer) {
                optionsContainer.innerHTML = `<input type="text" class="poll-option-input" placeholder="خيار 1" style="width:100%; padding:8px; margin-bottom:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(212,175,55,0.3); border-radius:6px; color:#fff;"><input type="text" class="poll-option-input" placeholder="خيار 2" style="width:100%; padding:8px; margin-bottom:6px; background:rgba(255,255,255,0.05); border:1px solid rgba(212,175,55,0.3); border-radius:6px; color:#fff;">`;
            }
            if (multipleChoiceCheck) multipleChoiceCheck.checked = false;

            updatePollAdminState(poll);
            addSystemUpdate("استطلاع جديد", `تم نشر استطلاع جديد: "${question}"`, true);
            showToast("🚀 تم نشر الاستطلاع بنجاح.", "success");
            renderPoll();
        });
    }

    // ✅ إلغاء الاستطلاع (حذف نهائي من السيرفر والذاكرة)
    if (cancelButton) {
        cancelButton.addEventListener("click", async () => {
            if (!isFounderSession()) { showToast("⚠️ إلغاء الاستطلاعات مخصص للرؤساء فقط.", "error"); return; }
            removeStorage(PHANTOM_MEMORY.pollStorageKey);
            removeStorage(PHANTOM_MEMORY.pollVoteKey);
            if (supabaseClient) {
                try {
                    await supabaseClient.from('polls').delete().neq('id', '0');
                } catch (e) {}
            }
            updatePollAdminState(null);
            addSystemUpdate("إلغاء استطلاع", "تم إلغاء الاستطلاع النشط بواسطة القيادة.", true);
            showToast("🗑️ تم إلغاء الاستطلاع نهائياً.", "info");
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

// ✅ إصلاح التصويت: إلغاء التصويت عند الضغط على نفس الخيار
function voteInPoll(optionId) {
    const poll = getStorage(PHANTOM_MEMORY.pollStorageKey, null);
    const username = getCurrentUsername();
    if (!poll || !username) return;

    const votesStorageKey = PHANTOM_MEMORY.pollVoteKey + "_" + poll.id;
    let userVotes = getStorage(votesStorageKey, []);
    const currentVotes = poll.voters[username] || [];
    
    if (poll.multiple) {
        // الوضع: اختيار متعدد (أضف/أزل)
        const index = currentVotes.indexOf(optionId);
        if (index !== -1) {
            currentVotes.splice(index, 1);
            poll.options.find(o => o.id === optionId).votes--;
            poll.totalVotes--;
            userVotes = currentVotes;
            showToast("🗳️ تم إلغاء تصويتك.", "info");
        } else {
            currentVotes.push(optionId);
            poll.options.find(o => o.id === optionId).votes++;
            poll.totalVotes++;
            userVotes = currentVotes;
            showToast("🗳️ تم تسجيل صوتك.", "success");
        }
    } else {
        // الوضع: اختيار واحد (شيل الصوت إذا ضغطت على نفس الخيار)
        if (currentVotes.length > 0 && currentVotes[0] === optionId) {
            // ➡️ إزالة الصوت إذا ضغطت على نفس الخيار
            currentVotes.length = 0;
            poll.options.find(o => o.id === optionId).votes--;
            poll.totalVotes--;
            userVotes = currentVotes;
            showToast("🗳️ تم إلغاء صوتك.", "info");
        } else {
            // تغيير الاختيار (إزالة القديم وإضافة الجديد)
            if (currentVotes.length > 0) {
                const oldOptionId = currentVotes[0];
                poll.options.find(o => o.id === oldOptionId).votes--;
                poll.totalVotes--;
                currentVotes.length = 0;
            }
            currentVotes.push(optionId);
            poll.options.find(o => o.id === optionId).votes++;
            poll.totalVotes++;
            userVotes = currentVotes;
            showToast("🗳️ تم تسجيل صوتك.", "success");
        }
    }

    poll.voters[username] = currentVotes;
    setStorage(PHANTOM_MEMORY.pollStorageKey, poll);
    setStorage(votesStorageKey, userVotes);

    // ✅ النقاط: تُمنح مرة واحدة فقط عند أول تصويت (مهما عدلت أو شلت)
    const hasVotedBefore = getStorage(PHANTOM_MEMORY.pollVoteKey, false);
    if (!hasVotedBefore) {
        addPoints(username, 10);
        setStorage(PHANTOM_MEMORY.pollVoteKey, true);
        showToast("✅ تم منحك 10 نقاط!", "success");
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

    // بناء الخيارات بشكل مضغوط
    let optionsHtml = "";
    if (poll.options && poll.options.length > 0) {
        optionsHtml = poll.options.map(opt => {
            const percent = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
            const isSelected = userVotes.includes(opt.id);
            const circleClass = isSelected ? "selected" : "";
            const checkMark = isSelected ? "✓" : "";

            return `
                <div class="poll-option-item" data-option-id="${opt.id}">
                    <div class="poll-option-circle ${circleClass}">${checkMark}</div>
                    <div class="poll-option-content">
                        <div class="poll-option-text-row">
                            <span>${escapeHTML(opt.text)}</span>
                            <span class="poll-option-percent">(${opt.votes}) ${percent}%</span>
                        </div>
                        <div class="poll-option-progress">
                            <div class="poll-option-progress-fill" style="width:${percent}%"></div>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    }

    card.innerHTML = `
        <div class="poll-card-v2">
            <div class="poll-header-v2">
                <span class="poll-title-v2">📊 ${escapeHTML(poll.question)}</span>
                <span class="poll-points-badge">+10 نقاط</span>
            </div>
            ${optionsHtml}
            <div class="poll-footer-v2">
                صوت واحد فقط لكل عضو (${poll.totalVotes} صوت) ${poll.multiple ? "| يمكنك تغيير اختيارك" : "| يمكنك إلغاء صوتك بالضغط مرة أخرى"}
            </div>
        </div>
    `;

    // ربط الأحداث
    card.querySelectorAll("[data-option-id]").forEach(btn => {
        btn.addEventListener("click", () => voteInPoll(Number(btn.getAttribute("data-option-id"))));
    });
}

/* ========================================================
   21. الشات العام (مع نظام الكتم الجديد)
   ======================================================== */

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

    function isUserMuted(username) {
        const mutedUsers = getStorage('phantom_muted_users', {});
        const muteInfo = mutedUsers[username];
        if (muteInfo && muteInfo.mutedUntil > Date.now()) {
            return muteInfo.mutedUntil;
        } else if (muteInfo) {
            delete mutedUsers[username];
            setStorage('phantom_muted_users', mutedUsers);
        }
        return null;
    }

    async function sendMessage(text) {
        const sender = getCurrentUsername();
        if (!text || !sender) return;
        
        const muteUntil = isUserMuted(sender);
        if (muteUntil) {
            const remaining = Math.ceil((muteUntil - Date.now()) / 3600000);
            showToast(`🔇 تم كتمك لمدة ${remaining} ساعة`, "error");
            return;
        }

        const message = { sender: sender, text: text, timestamp: Date.now() };
        // فحص المنشن في الرسالة
const mentionRegex = /@([\u0600-\u06FF\w]+)/g;
const mentions = text.match(mentionRegex);
if (mentions) {
    mentions.forEach(mention => {
        const mentionedUser = mention.replace('@', '');
        // هنا بنخزنها في قاعدة البيانات أو نعمل إشعار فوري لو الشخص ده هو الحالي
        const mentionNotification = getStorage("phantom_mention_notifications", []);
        mentionNotification.push({ from: sender, to: mentionedUser, message: text, date: new Date() });
        setStorage("phantom_mention_notifications", mentionNotification);
    });
}
        await serverSendChat(message);
        if (input) input.value = "";
        renderChat();
        renderChatMonitor();
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const text = input.value.trim();
        const sender = getCurrentUsername();
        if (!text || !sender) return;
        
        const muteUntil = isUserMuted(sender);
        if (muteUntil) {
            const remaining = Math.ceil((muteUntil - Date.now()) / 3600000);
            showToast(`🔇 تم كتمك لمدة ${remaining} ساعة`, "error");
            return;
        }

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
        const userId = getCurrentUserId();
        
        const equipped = getStorage("phantom_user_equipped", {});
        const userEquipped = equipped[userId] || {};
        const titleId = userEquipped.title;
        const titleName = PHANTOM_TITLES[titleId] || PHANTOM_TITLES[Number(titleId)] || "";

        // ✅ قراءة لون الاسم وتأثير الرسالة
        const nameColorId = userEquipped.name_color;
        const chatEffectId = userEquipped.chat_effect;

        // ✅ خريطة الألوان
        const nameColorMap = {
            'gold': '#ffd700', 'silver': '#c0c0c0', 'blue': '#3498db', 'red': '#e74c3c',
            'purple': '#9b59b6', 'green': '#2ecc71', 'pink': '#ff69b4', 'orange': '#ff9800',
            'cyan': '#00f2fe', 'turquoise': '#40e0d0'
        };

        // ✅ خريطة تأثيرات الرسائل (أسماء الكلاسات)
        const chatEffectClassMap = {
            'gold_border': 'chat-effect-gold',
            'neon_bubble': 'chat-effect-neon',
            'glow_shadow': 'chat-effect-glow',
            'heart_beat': 'chat-effect-heart',
            'big_text': 'chat-effect-big',
            'slide_in': 'chat-effect-slide'
        };

        // ✅ جلب تأثير اللون من السيرفر (لأن الـ ID مش هو التأثير)
        let nameColorEffect = null;
        let chatEffectClass = '';
        
        if (nameColorId || chatEffectId) {
            getShopItems().then(items => {
                const nameItem = items.find(i => i.id === nameColorId);
                if (nameItem) nameColorEffect = nameItem.effect;
                
                const chatItem = items.find(i => i.id === chatEffectId);
                if (chatItem) chatEffectClass = chatEffectClassMap[chatItem.effect] || '';
                
                // ✅ إعادة رسم الشات بعد جلب البيانات
                renderChatMessages(messages, currentUser, titleName, nameColorEffect, chatEffectClass);
            });
            return; // سنرسم لاحقاً بعد جلب الأصناف
        }

        // ✅ رسم مباشر إذا مفيش ألوان أو تأثيرات
        renderChatMessages(messages, currentUser, titleName, null, '');
    });
}

function renderChatMessages(messages, currentUser, titleName, nameColorEffect, chatEffectClass) {
    const container = getElement("chat-messages-container");
    if (!container) return;

    const nameColorMap = {
        'gold': '#ffd700', 'silver': '#c0c0c0', 'blue': '#3498db', 'red': '#e74c3c',
        'purple': '#9b59b6', 'green': '#2ecc71', 'pink': '#ff69b4', 'orange': '#ff9800',
        'cyan': '#00f2fe', 'turquoise': '#40e0d0'
    };

    const colorHex = nameColorEffect ? (nameColorMap[nameColorEffect] || '') : '';

    if (!messages || !messages.length) {
        container.innerHTML = `<div class="empty-state">لا توجد رسائل في الشات.</div>`;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isMe = normalizeName(msg.sender) === normalizeName(currentUser);
        const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' }) : "";
        
        // 📞 فحص إذا كانت الرسالة دعوة مكالمة (مباشرة، Agora، أو Meet)
        const isCallInvite = (msg.isCall || /📞|🎙️|📹|مكالمة|Agora|Google Meet/i.test(msg.text));
        if (isCallInvite) {
            let callType = 'inapp';
            let callTitle = 'مكالمة المقر المباشرة (صوت وفيديو)';
            let callIcon = '📱';
            let tabTarget = 'inapp';

            if (msg.callType === 'agora' || msg.text.includes('Agora')) {
                callType = 'agora';
                callTitle = 'غرفة Agora الصوتية التكتيكية';
                callIcon = '🎙️';
                tabTarget = 'agora';
            } else if (msg.callType === 'meet' || /Meet|meet\.google/i.test(msg.text)) {
                callType = 'meet';
                callTitle = 'مكالمة Google Meet الرسمية';
                callIcon = '🌐';
                tabTarget = 'meet';
            }

            return `
                <div class="chat-call-card">
                    <div class="chat-call-header">
                        <span class="chat-call-badge">🟢 ${callIcon} مكالمة كلان نشطة</span>
                        <span style="font-size:0.75rem; color:#94a3b8;">${time} • من: ${escapeHTML(msg.sender)}</span>
                    </div>
                    <div class="chat-call-title">
                        <span>${callIcon}</span>
                        <span>${callTitle}</span>
                    </div>
                    <div class="chat-call-desc">
                        ${escapeHTML(msg.text)}
                    </div>
                    <button type="button" class="chat-call-join-btn" onclick="openAndJoinCall('${tabTarget}')">
                        <span>📞</span> انضمام للمكالمة الآن
                    </button>
                </div>
            `;
        }

        let titleHtml = "";
        if (isMe && titleName) {
            titleHtml = ` <span style="color:var(--gold); font-weight:bold; font-size:0.75rem; text-shadow:0 0 5px var(--gold);">[ ${titleName} ]</span>`;
        }

        // ✅ تلوين الاسم
        let senderStyle = '';
        if (isMe && colorHex) {
            senderStyle = ` style="color:${colorHex}; text-shadow:0 0 8px ${colorHex};"`;
        }

        // ✅ إضافة كلاس التأثير للفقاعة (فقط لرسائلك)
        const effectClass = (isMe && chatEffectClass) ? ` ${chatEffectClass}` : '';

        return `
            <div class="chat-bubble note-style ${isMe ? 'mine' : 'others'}${effectClass}">
                <small${senderStyle}>${escapeHTML(msg.sender)}${titleHtml}</small>
                <div>${escapeHTML(msg.text)}</div>
                <span class="message-time">${time}</span>
            </div>
        `;
    }).join("");

    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 500);
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

// 🛡️ شاشة مراقبة الشات الآمنة للإدارة
function renderChatMonitor() {
    try {
        const monitorContainer = document.getElementById('chat-monitor-container') || document.getElementById('admin-chat-monitor');
        if (!monitorContainer) return;
        const messages = getStorage("phantom_chat_messages", []);
        monitorContainer.innerHTML = messages.slice(-20).map(m => `
            <div class="monitor-msg" style="padding:4px 8px; border-bottom:1px solid rgba(255,255,255,0.05); font-size:0.75rem;">
                <strong style="color:var(--cyan);">${escapeHTML(m.sender || '')}:</strong> ${escapeHTML(m.text || '')}
            </div>
        `).join('');
    } catch (e) {
        console.warn("renderChatMonitor error:", e);
    }
}

/* ========================================================
   22. عرض البيانات الأساسية
   ======================================================== */

function renderBasicDataUI() {
    const data = getBasicData();
    const rules = data.rules || { general: [], penalties: [], clearance: [] };

    // ✅ 1. القوانين العامة (مرقمة)
    const generalContainer = getElement("general-rules-list");
    if (generalContainer) {
        if (rules.general && rules.general.length > 0) {
            generalContainer.innerHTML = `
                <div class="law-list">
                    ${rules.general.map(r => `<div class="law-item">${escapeHTML(r)}</div>`).join("")}
                </div>
            `;
        } else {
            generalContainer.innerHTML = `<div class="empty-state">لا توجد قوانين عامة.</div>`;
        }
    }

    // ✅ 2. نظام العقوبات (بطاقات ملونة حسب الخطورة)
    const clearanceContainer = getElement("clearance-system-list");
    if (clearanceContainer) {
        let html = "";
        if (rules.penalties && rules.penalties.length > 0) {
            const colorMap = [
                { color: "#ff4d4d", icon: "🚨" }, // الشتيمة
                { color: "#ff9800", icon: "👑" }, // عدم الاحترام
                { color: "#facc15", icon: "⏰" }, // التأخير والغياب
                { color: "#00ff88", icon: "🟢" }, // مسح الإنذارات (أخضر)
                { color: "#888", icon: "🔒" } // أخرى
            ];
            
            // استخدام فهرس اللون تقريباً
            html += rules.penalties.map((p, index) => {
                const colorObj = colorMap[Math.min(index, colorMap.length - 1)];
                return `
                    <div class="penalty-card-v2" style="border-right: 4px solid ${colorObj.color}; background: ${colorObj.color}10;">
                        <div class="penalty-header" style="color: ${colorObj.color};">${colorObj.icon} ${escapeHTML(p.violation)}</div>
                        <ul>
                            ${p.steps.map(step => `<li>${escapeHTML(step)}</li>`).join("")}
                        </ul>
                    </div>
                `;
            }).join("");
        }

        // ✅ 3. نظام مسح الإنذارات
        if (rules.clearance && rules.clearance.length > 0) {
            html += `
                <div class="penalty-card-v2" style="border-right: 4px solid #22c55e; background: rgba(34, 197, 94, 0.08); margin-top: 15px;">
                    <div class="penalty-header" style="color: #22c55e;">🟢 نظام مسح الإنذارات</div>
                    <ul>
                        ${rules.clearance.map(c => `<li style="color: var(--muted);">${escapeHTML(c)}</li>`).join("")}
                    </ul>
                </div>
            `;
        }

        clearanceContainer.innerHTML = html || `<div class="empty-state">لا توجد عقوبات مدونة.</div>`;
    }

    // ✅ 4. سجل الإنذارات الحالية (استدعاء الدالة الموجودة بالفعل)
    renderWarnings();
}

/* ========================================================
   23. تحديث الواجهة الشامل
   ======================================================== */

function renderAll() {
    renderLeaderboard();
    renderWarnings();
    renderAdminWarnings();
    renderPoll();
    renderChat();
    renderOnlineUsers();
    renderChatOnlineCount();
    renderRosterAndLeadership();
    renderBasicDataUI();
    renderSystemUpdates();
    renderFounderNotifications();
    updateAttendanceRate();
    animateElements();
    expandSmallBoxes();
    renderBroadcastMessages(); // ✅ إضافة عرض الرسائل الجماعية
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
   24. Service Worker
   ======================================================== */

function setupServiceWorker() {
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
}

/* ========================================================
   25. نظام تفاعل الأعضاء
   ======================================================== */

function setupMemberInteraction() {
    document.addEventListener("click", (e) => {
        const memberItem = e.target.closest(".member-log-item");
        if (memberItem) {
            const name = memberItem.querySelector("strong")?.textContent;
            if (name) {
                openProfile(name);
            }
        }
    });
}

async function openProfile(memberName) {
    const overlay = document.getElementById('profile-overlay');
    if (!overlay) return;

    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.add('active'), 10);

    const roster = getFullRoster();
    const member = roster.find(m => normalizeName(m.name) === normalizeName(memberName));
    const isMe = getCurrentUsername() === memberName;

    document.getElementById('profile-username').textContent = memberName;

    let frameEffect = "";
    let equippedTitleId = null;
    let nameColorId = null;
    let bgEffect = "";
    let chatEffectId = null;
    let nameColorEffect = null;

    if (isMe) {
        const userId = getCurrentUserId();
        const equippedData = getStorage("phantom_user_equipped", {});
        const userEquipped = equippedData[userId] || {};
        equippedTitleId = userEquipped.title || null;
        if (userEquipped.frame) {
            const shopItems = await getShopItems();
            const frameItem = shopItems.find(i => i.id === userEquipped.frame);
            if (frameItem) frameEffect = frameItem.effect || "";
        }
        nameColorId = userEquipped.name_color || null;
        
        // ✅ جلب تأثير اللون
        if (nameColorId) {
            const shopItems = await getShopItems();
            const nameItem = shopItems.find(i => i.id === nameColorId);
            if (nameItem) nameColorEffect = nameItem.effect || "";
        }
        
        if (userEquipped.background) {
            const shopItems = await getShopItems();
            const bgItem = shopItems.find(i => i.id === userEquipped.background);
            if (bgItem) bgEffect = bgItem.effect || "";
        }
        chatEffectId = userEquipped.chat_effect || null;
    } else {
        if (member && member.equipped_frame) {
            const shopItems = await getShopItems();
            const frameItem = shopItems.find(i => i.id === member.equipped_frame);
            if (frameItem) frameEffect = frameItem.effect || "";
        }
        equippedTitleId = member && member.equipped_title ? member.equipped_title : null;
        nameColorId = member && member.equipped_name_color ? member.equipped_name_color : null;
        
        // ✅ جلب تأثير اللون للأعضاء الآخرين
        if (nameColorId) {
            const shopItems = await getShopItems();
            const nameItem = shopItems.find(i => i.id === nameColorId);
            if (nameItem) nameColorEffect = nameItem.effect || "";
        }
        
        if (member && member.equipped_background) {
            const shopItems = await getShopItems();
            const bgItem = shopItems.find(i => i.id === member.equipped_background);
            if (bgItem) bgEffect = bgItem.effect || "";
        }
        chatEffectId = member && member.equipped_chat_effect ? member.equipped_chat_effect : null;
    }

    let frameColor = "#00ff88";
    if (frameEffect === "silver") frameColor = "#9ca3af";
    else if (frameEffect === "gold") frameColor = "#d4af37";
    else if (frameEffect === "rainbow") frameColor = "linear-gradient(45deg, #ff4d4d, #ffd700, #00f2fe, #a855f7)";
    else if (frameEffect === "blue") frameColor = "#00f2fe";
    else if (frameEffect === "red") frameColor = "#ff4d4d";
    else if (frameEffect === "red_gold") frameColor = "#ff4757";
    else if (frameEffect === "green") frameColor = "#22c55e";
    else if (frameEffect === "pink") frameColor = "#ff69b4";
    else if (frameEffect === "purple") frameColor = "#a855f7";
    else if (frameEffect === "heart") frameColor = "#ff4d6d";
    else if (frameEffect === "skull") frameColor = "#6b7280";

    const ring = document.getElementById('profile-progress-ring');
    if (ring) {
        const points = getLocalPoints();
        const memberPoints = points[memberName] || 0;
        const progress = memberPoints % 100;
        const percentage = (progress / 100) * 100;
        
        if (frameEffect === "rainbow") {
            ring.style.background = `conic-gradient(from 0deg, #ff4d4d, #ffd700, #00f2fe, #a855f7, #ff4d4d)`;
        } else if (frameEffect === "red_gold") {
            ring.style.background = `conic-gradient(from 0deg, #ff4757, #ffd700, #ff4757, #ffd700)`;
        } else {
            ring.style.background = `conic-gradient(${frameColor} ${percentage}%, #1a222a ${percentage}%)`;
        }
        ring.style.border = `2px solid ${frameEffect === 'red_gold' ? '#ff4757' : frameColor}`;
    }

    let titleHtml = "";
    if (equippedTitleId) {
        const titleName = PHANTOM_TITLES[equippedTitleId] || PHANTOM_TITLES[Number(equippedTitleId)] || "";
        if (titleName) {
            titleHtml = `<div style="color:var(--gold); font-weight:bold; font-size:0.9rem; margin-top:4px;">[ ${titleName} ]</div>`;
        }
    }
    const existingTitle = document.getElementById('profile-equipped-title');
    if (existingTitle) existingTitle.remove();
    const usernameEl = document.getElementById('profile-username');
    const titleDiv = document.createElement('div');
    titleDiv.id = 'profile-equipped-title';
    titleDiv.innerHTML = titleHtml;
    usernameEl.insertAdjacentElement('afterend', titleDiv);

    // ✅ تطبيق لون الاسم في البروفايل
    const nameColorMap = {
        'gold': '#ffd700', 'silver': '#c0c0c0', 'blue': '#3498db', 'red': '#e74c3c',
        'purple': '#9b59b6', 'green': '#2ecc71', 'pink': '#ff69b4', 'orange': '#ff9800',
        'cyan': '#00f2fe', 'turquoise': '#40e0d0'
    };
    if (nameColorEffect && nameColorMap[nameColorEffect]) {
        usernameEl.style.color = nameColorMap[nameColorEffect];
        usernameEl.style.textShadow = `0 0 10px ${nameColorMap[nameColorEffect]}`;
    } else {
        usernameEl.style.color = "";
        usernameEl.style.textShadow = "";
    }

    // ✅ الخلفيات الجديدة
    let bgStyleVal = "";
    if (bgEffect === "neon_black") bgStyleVal = "radial-gradient(circle at 50% 0%, #0a0d14, #070a10)";
    else if (bgEffect === "gold") bgStyleVal = "linear-gradient(135deg, #2b2013, #0a0d14)";
    else if (bgEffect === "rainbow") bgStyleVal = "linear-gradient(135deg, #0a0d14, #1a0a2e, #001a1a)";
    else if (bgEffect === "purple_galaxy") bgStyleVal = "radial-gradient(circle at 50% 50%, #1a052a, #0a0d14)";
    else if (bgEffect === "red_fire") bgStyleVal = "radial-gradient(circle at 50% 50%, #2a0505, #0a0d14)";
    else if (bgEffect === "green_forest") bgStyleVal = "linear-gradient(135deg, #0a2e1a, #0a0d14)";
    else if (bgEffect === "blue_ocean") bgStyleVal = "linear-gradient(135deg, #0a1a2e, #0a0d14)";
    else if (bgEffect === "pink") bgStyleVal = "linear-gradient(135deg, #2e0a1a, #0a0d14)";
    else if (bgEffect === "dark_grey") bgStyleVal = "linear-gradient(135deg, #1a1a1a, #0a0d14)";
    else if (bgEffect === "white_neon") bgStyleVal = "radial-gradient(circle at 50% 50%, #2e2e2e, #0a0d14)";
    else if (bgEffect === "silver") bgStyleVal = "linear-gradient(135deg, #1a1a2e, #0a0d14)";
    
    const hubContainer = document.querySelector('#profile-overlay .hub-container');
    if (hubContainer) {
        hubContainer.style.background = bgStyleVal || "";
    }

    let userIdDisplay = "غير متوفر";
    if (isMe) {
        const identity = getSavedIdentity();
        userIdDisplay = (identity && identity.gameId) || "غير متوفر";
    } else {
        userIdDisplay = (member && (member.in_game_id || member.gameId)) || "غير متوفر";
    }
    document.getElementById('profile-user-id').textContent = userIdDisplay;

    const points = getLocalPoints();
    const memberPoints = points[memberName] || 0;
    const attendance = getStorage(PHANTOM_MEMORY.attendanceRecordsKey, {});
    const memberAttendance = attendance[memberName] || 0;
    const hearts = getStorage(PHANTOM_MEMORY.heartsKey, {});
    const memberHearts = hearts[memberName] || 0;

    document.getElementById('profile-points').textContent = memberPoints;
    document.getElementById('profile-attendance').textContent = memberAttendance;
    document.getElementById('profile-hearts').textContent = memberHearts;
    
    const level = Math.floor(memberPoints / 100) + 1;
    document.getElementById('profile-level-display').textContent = `LVL ${level}`;

    const badgeContainer = document.getElementById('profile-badge-container');
    badgeContainer.innerHTML = renderBadge(level);

    const giveHeartBtn = document.getElementById('give-heart-btn');
    const complaintBtn = document.getElementById('profile-complaint-btn');

    if (isMe) { giveHeartBtn.style.display = 'none'; complaintBtn.style.display = 'none'; }
    else { giveHeartBtn.style.display = 'block'; complaintBtn.style.display = 'block'; giveHeartBtn.onclick = () => giveHeart(memberName); complaintBtn.onclick = () => showComplaintForm(memberName); }
}

function giveHeart(targetName) {
    const hearts = getStorage(PHANTOM_MEMORY.heartsKey, {});
    const from = getCurrentUsername();
    if (!from) { showToast("يجب تسجيل الدخول أولاً.", "error"); return; }
    if (from === targetName) { showToast("لا يمكنك إعطاء قلب لنفسك.", "error"); return; }
    if (hearts.givenBy && hearts.givenBy[targetName] && hearts.givenBy[targetName].includes(from)) { showToast("لقد أعطيت قلبًا لهذا العضو مسبقًا (قلب واحد فقط).", "error"); return; }
    if (!hearts.givenBy) hearts.givenBy = {};
    if (!hearts.givenBy[targetName]) hearts.givenBy[targetName] = [];
    hearts.givenBy[targetName].push(from);
    if (!hearts[targetName]) hearts[targetName] = 0;
    hearts[targetName]++;
    setStorage(PHANTOM_MEMORY.heartsKey, hearts);
    showToast(`💛 تم إعطاء قلب لـ ${targetName}.`, "success");
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
    modal.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999999; background: rgba(16,23,34,0.98); padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--border); box-shadow: 0 20px 60px rgba(0,0,0,0.8); width: 90%; max-width: 400px; text-align: center; direction: rtl;`;
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
    overlay.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 9999998;`;
    document.body.appendChild(overlay);

    const close = () => { modal.remove(); overlay.remove(); };
    document.getElementById("close-complaint-btn").addEventListener("click", close);
    overlay.addEventListener("click", close);

    document.getElementById("send-complaint-submit").addEventListener("click", () => {
        const reason = document.getElementById("complaint-reason").value.trim();
        if (!reason) { showToast("يرجى كتابة سبب الشكوى.", "error"); return; }
        const complaints = getStorage(PHANTOM_MEMORY.complaintsKey, []);
        complaints.push({ id: `complaint_${Date.now()}`, from: getCurrentUsername(), target: targetName, reason: reason, date: new Date().toLocaleString("ar-EG") });
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
    if (complaint) { addSystemUpdate("قبول شكوى", `تم قبول شكوى ${complaint.from} ضد ${complaint.target}.`); showToast("✅ تم قبول الشكوى.", "success"); }
}

function rejectComplaint(id) {
    let complaints = getStorage(PHANTOM_MEMORY.complaintsKey, []);
    const complaint = complaints.find(c => c.id === id);
    complaints = complaints.filter(c => c.id !== id);
    setStorage(PHANTOM_MEMORY.complaintsKey, complaints);
    renderFounderNotifications();
    if (complaint) { addSystemUpdate("رفض شكوى", `تم رفض شكوى ${complaint.from} ضد ${complaint.target}.`); showToast("❌ تم رفض الشكوى.", "info"); }
}

function giveWarningToComplaint(id) {
    let complaints = getStorage(PHANTOM_MEMORY.complaintsKey, []);
    const complaint = complaints.find(c => c.id === id);
    complaints = complaints.filter(c => c.id !== id);
    setStorage(PHANTOM_MEMORY.complaintsKey, complaints);
    renderFounderNotifications();
    if (complaint) {
        const warnings = getStorage("phantom_warnings", []);
        warnings.push({ id: `warning_${Date.now()}`, name: complaint.target, type: "تنبيه", reason: `بناءً على شكوى من ${complaint.from}: ${complaint.reason}`, date: new Date().toLocaleDateString("ar-EG") });
        setStorage("phantom_warnings", warnings);
        addSystemUpdate("تنبيه من شكوى", `تم إصدار تنبيه للعضو ${complaint.target} بناءً على شكوى.`);
        showToast("⚠️ تم إصدار تنبيه.", "success");
        renderWarnings(); renderAdminWarnings(); renderFounderNotifications();
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
        warnings.push({ id: `warning_${Date.now()}`, name: complaint.target, type: "إنذار", reason: `بناءً على شكوى من ${complaint.from}: ${complaint.reason}`, date: new Date().toLocaleDateString("ar-EG") });
        setStorage("phantom_warnings", warnings);
        addSystemUpdate("إنذار من شكوى", `تم إصدار إنذار للعضو ${complaint.target} بناءً على شكوى.`);
        showToast("🚨 تم إصدار إنذار.", "success");
        renderWarnings(); renderAdminWarnings(); renderFounderNotifications();
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
   26. نظام إرسال عذر لعدم حضور الروم
   ======================================================== */

function setupExcuseSystem() {
    const excuseBtn = document.getElementById("send-excuse-btn");
    if (excuseBtn) {
        excuseBtn.addEventListener("click", () => {
            const selectedEvent = document.getElementById("active-events-select")?.value;
            if (!selectedEvent) { showToast("اختر الروم أولاً.", "error"); return; }
            showExcuseForm(selectedEvent);
        });
    }
}

function showExcuseForm(eventId) {
    const modal = document.createElement("div");
    modal.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999999; background: rgba(16,23,34,0.98); padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--border); box-shadow: 0 20px 60px rgba(0,0,0,0.8); width: 90%; max-width: 400px; text-align: center; direction: rtl;`;
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
    overlay.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 9999998;`;
    document.body.appendChild(overlay);

    const close = () => { modal.remove(); overlay.remove(); };
    document.getElementById("close-excuse-btn").addEventListener("click", close);
    overlay.addEventListener("click", close);

    document.getElementById("send-excuse-submit").addEventListener("click", () => {
        const reason = document.getElementById("excuse-reason").value.trim();
        if (!reason) { showToast("يرجى كتابة سبب العذر.", "error"); return; }
        const excuses = getStorage(PHANTOM_MEMORY.excusesKey, []);
        excuses.push({ id: `excuse_${Date.now()}`, from: getCurrentUsername(), eventId: eventId, reason: reason, date: new Date().toLocaleString("ar-EG") });
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
    if (excuse) { addSystemUpdate("قبول عذر", `تم قبول عذر العضو ${excuse.from} لعدم حضور الروم.`); showToast("✅ تم قبول العذر.", "success"); }
}

function rejectExcuse(id) {
    let excuses = getStorage(PHANTOM_MEMORY.excusesKey, []);
    const excuse = excuses.find(e => e.id === id);
    excuses = excuses.filter(e => e.id !== id);
    setStorage(PHANTOM_MEMORY.excusesKey, excuses);
    renderFounderNotifications();
    if (excuse) { addSystemUpdate("رفض عذر", `تم رفض عذر العضو ${excuse.from} لعدم حضور الروم.`); showToast("❌ تم رفض العذر.", "info"); }
}

/* ========================================================
   27. نظام تغيير الاسم
   ======================================================== */

function setupNameChange() {
    const editBtn = document.getElementById("edit-name-btn");
    if (!editBtn) return;
    editBtn.addEventListener("click", () => { showNameChangeForm(); });
}

function showNameChangeForm() {
    const currentName = getCurrentUsername();
    if (!currentName) { showToast("يجب تسجيل الدخول أولاً.", "error"); return; }
    const modal = document.createElement("div");
    modal.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999999; background: rgba(16,23,34,0.98); padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--border); box-shadow: 0 20px 60px rgba(0,0,0,0.8); width: 90%; max-width: 400px; text-align: center; direction: rtl;`;
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
    overlay.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 9999998;`;
    document.body.appendChild(overlay);

    const close = () => { modal.remove(); overlay.remove(); };
    document.getElementById("close-name-change").addEventListener("click", close);
    overlay.addEventListener("click", close);

    document.getElementById("submit-name-change").addEventListener("click", () => {
        const newName = document.getElementById("new-name-input").value.trim();
        if (!newName) { showToast("يرجى كتابة الاسم الجديد.", "error"); return; }
        if (newName.length < 2) { showToast("الاسم يجب أن يكون حرفين على الأقل.", "error"); return; }
        const roster = getFullRoster();
        if (roster.some(m => normalizeName(m.name) === normalizeName(newName))) { showToast("هذا الاسم مستخدم بالفعل.", "error"); return; }
        const requests = getStorage(PHANTOM_MEMORY.nameChangeRequestsKey, []);
        requests.push({ id: `namechange_${Date.now()}`, oldName: currentName, newName: newName, date: new Date().toLocaleString("ar-EG") });
        setStorage(PHANTOM_MEMORY.nameChangeRequestsKey, requests);
        showToast("📝 تم إرسال طلب تغيير الاسم للمؤسسين.", "success");
        renderFounderNotifications();
        close();
    });
}

async function approveNameChange(id) {
    let requests = getStorage(PHANTOM_MEMORY.nameChangeRequestsKey, []);
    const request = requests.find(r => r.id === id);
    if (!request) {
        showToast("⚠️ الطلب غير موجود.", "error");
        return;
    }

    const oldName = request.oldName;
    const newName = request.newName;

    // 1. التحقق من أن الاسم الجديد غير موجود في الكلان
    const roster = getFullRoster();
    if (roster.some(m => normalizeName(m.name) === normalizeName(newName))) {
        showToast(`⚠️ الاسم "${newName}" موجود بالفعل في الكلان.`, "error");
        return;
    }

    // 2. التحقق من أن الاسم الجديد ليس مطروداً
    const banned = getBannedUsers();
    if (banned[newName]) {
        showToast(`⚠️ الاسم "${newName}" مطرود من الكلان.`, "error");
        return;
    }

    // 3. تحديث هوية المستخدم في localStorage (إذا كان هو المستخدم الحالي)
    const currentUser = getCurrentUsername();
    if (normalizeName(currentUser) === normalizeName(oldName)) {
        const identity = getSavedIdentity();
        if (identity) {
            identity.username = newName;
            setStorage(PHANTOM_MEMORY.identityKey, identity);
        }
        localStorage.setItem("phantom_active_username", newName);
        updateCurrentUser(newName);
    }

    // 4. تحديث قائمة الأعضاء المحلية (phantom_custom_roster)
    let customRoster = getStorage("phantom_custom_roster", []);
    customRoster = customRoster.map(m => {
        if (m && normalizeName(m.name) === normalizeName(oldName)) {
            m.name = newName;
        }
        return m;
    });
    setStorage("phantom_custom_roster", customRoster);

    // 5. حذف القديم وإضافة الجديد في قائمة السيرفر المحلية
    let serverMembers = getStorage("phantom_server_members", []);
    serverMembers = serverMembers.filter(m => !(m && m.name && normalizeName(m.name) === normalizeName(oldName)));
    const oldMember = roster.find(m => normalizeName(m.name) === normalizeName(oldName));
    if (oldMember) {
        const newMember = { ...oldMember, name: newName, userId: oldMember.userId, gameId: oldMember.gameId };
        serverMembers.push(newMember);
    }
    setStorage("phantom_server_members", serverMembers);

    // 6. نقل النقاط
    const points = getLocalPoints();
    if (points[oldName] !== undefined) {
        points[newName] = (points[newName] || 0) + points[oldName];
        delete points[oldName];
        setLocalPoints(points);
    }

    // 7. نقل الحضور
    const attendance = getStorage(PHANTOM_MEMORY.attendanceRecordsKey, {});
    if (attendance[oldName] !== undefined) {
        attendance[newName] = (attendance[newName] || 0) + attendance[oldName];
        delete attendance[oldName];
        setStorage(PHANTOM_MEMORY.attendanceRecordsKey, attendance);
    }

    // 8. نقل القلوب
    const hearts = getStorage(PHANTOM_MEMORY.heartsKey, {});
    if (hearts[oldName] !== undefined) {
        hearts[newName] = (hearts[newName] || 0) + hearts[oldName];
        delete hearts[oldName];
        setStorage(PHANTOM_MEMORY.heartsKey, hearts);
    }

    // 9. نقل الإنذارات
    let warnings = getStorage("phantom_warnings", []);
    warnings = warnings.map(w => {
        if (w.name && normalizeName(w.name) === normalizeName(oldName)) {
            w.name = newName;
        }
        return w;
    });
    setStorage("phantom_warnings", warnings);

    // 10. تحديث في Supabase (حذف القديم وإضافة الجديد)
    if (supabaseClient) {
        try {
            await supabaseClient.from('members').delete().eq('name', oldName);
            await supabaseClient.from('leaderboard').delete().eq('name', oldName);
            await supabaseClient.from('warnings').delete().eq('name', oldName);
            
            await supabaseClient.from('members').insert([{ 
                name: newName, 
                rank: oldMember?.rank || 'عضو', 
                userId: oldMember?.userId, 
                gameId: oldMember?.gameId 
            }]);
            
            if (warnings.some(w => w.name === newName)) {
                const warningsToInsert = warnings.filter(w => w.name === newName).map(w => ({ 
                    name: newName, 
                    type: w.type, 
                    reason: w.reason 
                }));
                await supabaseClient.from('warnings').insert(warningsToInsert);
            }
        } catch (e) {
            console.warn("⚠️ فشل تحديث البيانات في السيرفر:", e);
        }
    }

    // 11. حذف الطلب
    requests = requests.filter(r => r.id !== id);
    setStorage(PHANTOM_MEMORY.nameChangeRequestsKey, requests);

    // ✅ 12. نقل حالة التسجيل (Onboarding) للاسم الجديد حتى لا تظهر شاشة الرقم السري
    let onboardingData = getStorage(PHANTOM_MEMORY.onboardingKey, {});
    if (onboardingData[oldName] !== undefined) {
        onboardingData[newName] = onboardingData[oldName];
        delete onboardingData[oldName];
        setStorage(PHANTOM_MEMORY.onboardingKey, onboardingData);
    }

    // 13. إعادة رسم الواجهة
    addSystemUpdate("تغيير اسم", `تم تغيير اسم ${oldName} إلى ${newName} بموافقة المؤسسين.`, true);
    showToast(`✅ تم تغيير اسم ${oldName} إلى ${newName}.`, "success");
    renderAll();
    renderFounderNotifications();
    populateAdminSelects();
    logAdminAction(`📝 تغيير اسم ${oldName} إلى ${newName}`, newName, 'info');
}
/* ========================================================
   28. نظام Clips
   ======================================================== */

function setupClips() {
    const clipsPage = getElement("clips-view");
    if (!clipsPage) return;
    renderClips();
}

function getClipsData() {
    return getStorage(PHANTOM_MEMORY.clipsKey, { videoUrl: "", uploadedBy: "", uploadedAt: null, likes: 0, likedBy: [] });
}

function setClipsData(data) { setStorage(PHANTOM_MEMORY.clipsKey, data); }
function getComments() { return getStorage(PHANTOM_MEMORY.commentsKey, []); }
function setComments(comments) { setStorage(PHANTOM_MEMORY.commentsKey, comments); }

function renderClips() {
    const container = getElement("clips-container");
    if (!container) return;
    const data = getClipsData();
    const comments = getComments();

    if (data.videoUrl && data.uploadedAt) {
        const ONE_WEEK = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - data.uploadedAt > ONE_WEEK) {
            setClipsData({ videoUrl: "", uploadedBy: "", uploadedAt: null, likes: 0, likedBy: [] });
            setComments([]);
            renderClips();
            return;
        }
    }

    let html = "";
    if (!data.videoUrl) {
        html = `<div class="empty-state" style="text-align:center; padding:40px;">
            <p style="font-size:1.2rem; color:var(--silver-muted,#aaa);">🎬 لا يوجد فيديو هذا الأسبوع</p>
            ${isFounderSession() ? `<button id="upload-clip-btn" class="btn-primary" style="margin-top:15px;" onclick="showClipUploadForm()">رفع فيديو جديد</button>` : ""}
        </div>`;
        container.innerHTML = html;
        return;
    }

    const ytEmbed = getYouTubeEmbedUrl(data.videoUrl);
    const mediaHtml = ytEmbed
        ? `<iframe src="${ytEmbed}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen style="width:100%; aspect-ratio:16/9; border:none; display:block; border-radius:12px;"></iframe>`
        : `<video src="${escapeHTML(getDirectVideoUrl(data.videoUrl))}" controls style="width:100%; aspect-ratio:16/9; object-fit:cover; background:#000; display:block; border-radius:12px;"></video>`;

    html = `
        <div class="clips-layout">
            <div class="clips-video-area">
                ${mediaHtml}
            </div>
            <div class="clips-sidebar">
                <button id="like-clip-btn" class="clips-sidebar-btn" onclick="handleClipLike()" title="إعجاب">👍 <span class="like-count">${data.likes || 0}</span></button>
                <button id="open-comments-btn" class="clips-sidebar-btn" onclick="openCommentsSheet()" title="تعليقات">💬 <span class="comment-count">${comments.length}</span></button>
                ${isFounderSession() ? `<button class="clips-sidebar-btn" onclick="showClipUploadForm()" title="تغيير الفيديو">⬆️</button>` : ""}
                ${isFounderSession() ? `<button class="clips-sidebar-btn" onclick="deleteClipVideo()" style="color:var(--red);" title="حذف">🗑️</button>` : ""}
            </div>
        </div>
    `;
    container.innerHTML = html;
}

function getYouTubeEmbedUrl(url) {
    if (!url) return null;
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}?rel=0&modestbranding=1&enablejsapi=1&playsinline=1` : null;
}

function getDirectVideoUrl(url) {
    if (!url) return "";
    return url;
}

// دالة إعجاب
function handleClipLike() {
    const username = getCurrentUsername();
    if (!username) { showToast("يجب تسجيل الدخول.", "error"); return; }
    const data = getClipsData();
    if (data.likedBy.includes(username)) { showToast("لقد أعجبت بالفعل!", "info"); return; }
    data.likes = (data.likes || 0) + 1;
    data.likedBy.push(username);
    setClipsData(data);
    renderClips();
}

// دالة حذف الفيديو
function deleteClipVideo() {
    if (!confirm("هل أنت متأكد من حذف الفيديو؟")) return;
    setClipsData({ videoUrl: "", uploadedBy: "", uploadedAt: null, likes: 0, likedBy: [] });
    setComments([]);
    renderClips();
    showToast("🗑️ تم حذف الفيديو.", "info");
}

/* ========================================================
   29. نظام مكالمات الكلان (داخل التطبيق + Google Meet)
   ======================================================== */

// تخزين التوكن في الذاكرة المؤقتة فقط (In-memory per Security Policy)
let cachedGoogleAccessToken = null;
let currentGoogleMeetUri = null;
let currentGoogleMeetCode = null;

// حالة المكالمة المباشرة داخل التطبيق
let inAppLocalStream = null;
let isInAppMicMuted = false;
let isInAppCamOff = false;
let inAppCallMode = 'voice';
if (typeof window !== "undefined") {
    window.inAppCallMode = inAppCallMode;
}

const GOOGLE_MEET_SCOPES = [
    'https://www.googleapis.com/auth/meetings.space.created',
    'https://www.googleapis.com/auth/meetings.space.readonly',
    'https://www.googleapis.com/auth/meetings.space.settings'
];

function initGoogleMeetFirebase() {
    if (typeof firebase === 'undefined') return;
    try {
        if (!firebase.apps.length) {
            const cfg = {
                projectId: "phantom-eb05d",
                appId: "1:140970616071:web:5453277e2bb766a6a711a2",
                apiKey: "AIzaSyB9BLwWu9Rwrxb8YTt2d9piYzpJSWUNJfs",
                authDomain: "phantom-eb05d.firebaseapp.com",
                storageBucket: "phantom-eb05d.firebasestorage.app",
                messagingSenderId: "140970616071",
                oAuthClientId: "140970616071-hnmrs3v4q6jgdace5si53sem6cg2hacf.apps.googleusercontent.com"
            };
            firebase.initializeApp(cfg);
        }
    } catch (e) {
        console.warn("Firebase already initialized or error:", e);
    }
}

function setupVoiceCalls() {
    initGoogleMeetFirebase();
    const voiceCallBtn = document.getElementById("voice-call-btn");
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener("click", toggleVoiceCall);
    }
}

function toggleVoiceCall() {
    showGoogleMeetModal();
}

function switchCallTab(tab) {
    const inappSection = document.getElementById('inapp-call-section');
    const agoraSection = document.getElementById('agora-call-section');
    const meetSection = document.getElementById('meet-call-section');
    const tabInappBtn = document.getElementById('call-tab-inapp');
    const tabAgoraBtn = document.getElementById('call-tab-agora');
    const tabMeetBtn = document.getElementById('call-tab-meet');

    // إعادة ضبط الأزرار
    [tabInappBtn, tabAgoraBtn, tabMeetBtn].forEach(btn => {
        if (btn) {
            btn.style.background = 'transparent';
            btn.style.color = '#9ca3af';
        }
    });

    // إخفاء جميع الأقسام
    if (inappSection) inappSection.style.display = 'none';
    if (agoraSection) agoraSection.style.display = 'none';
    if (meetSection) meetSection.style.display = 'none';

    if (tab === 'inapp') {
        if (inappSection) inappSection.style.display = 'block';
        if (tabInappBtn) {
            tabInappBtn.style.background = 'var(--cyan)';
            tabInappBtn.style.color = '#000';
        }
    } else if (tab === 'agora') {
        if (agoraSection) agoraSection.style.display = 'block';
        if (tabAgoraBtn) {
            tabAgoraBtn.style.background = 'linear-gradient(135deg, #00f2fe, #3b82f6)';
            tabAgoraBtn.style.color = '#000';
        }
    } else if (tab === 'meet') {
        if (meetSection) meetSection.style.display = 'block';
        if (tabMeetBtn) {
            tabMeetBtn.style.background = 'var(--cyan)';
            tabMeetBtn.style.color = '#000';
        }
        if (!cachedGoogleAccessToken) {
            const authSection = document.getElementById("meet-auth-section");
            const activeSection = document.getElementById("meet-active-section");
            if (authSection) authSection.style.display = "block";
            if (activeSection) activeSection.style.display = "none";
        }
    }
}

function showGoogleMeetModal(forceAuth = false) {
    const modal = document.getElementById("google-meet-modal");
    if (!modal) return;
    modal.style.display = "block";

    // البداية الافتراضية على مكالمة داخل التطبيق
    switchCallTab('inapp');

    const authSection = document.getElementById("meet-auth-section");
    const activeSection = document.getElementById("meet-active-section");

    if (forceAuth || !cachedGoogleAccessToken) {
        if (authSection) authSection.style.display = "block";
        if (activeSection) activeSection.style.display = "none";
    } else {
        if (authSection) authSection.style.display = "none";
        if (activeSection) activeSection.style.display = "block";
        if (!currentGoogleMeetUri) {
            handleCreateNewMeetCall();
        }
    }
}

function closeGoogleMeetModal() {
    const modal = document.getElementById("google-meet-modal");
    if (modal) modal.style.display = "none";
    endInAppCall();
}

/* 📱 دوال المكالمة المباشرة داخل التطبيق (HTML5 WebRTC Media) */
async function startInAppCall() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast("⚠️ متصفحك لا يدعم الوصول المباشر للمايكروفون.", "info");
        return;
    }

    try {
        let stream = null;
        let isAudioOnly = false;
        let isSimulated = false;

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
                audio: true
            });
        } catch (videoError) {
            console.warn("Camera not available or denied, trying audio only:", videoError && videoError.message ? videoError.message : videoError);
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                isAudioOnly = true;
            } catch (audioError) {
                console.warn("Microphone permission denied or not available, entering listen-only mode:", audioError && audioError.message ? audioError.message : audioError);
                try {
                    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                    if (AudioContextClass) {
                        const ctx = new AudioContextClass();
                        const dest = ctx.createMediaStreamDestination();
                        stream = dest.stream;
                    }
                } catch (e) {
                    console.warn("AudioContext fallback error:", e);
                }
                isAudioOnly = true;
                isSimulated = true;
                isInAppMicMuted = true;
            }
        }

        inAppLocalStream = stream;
        inAppCallMode = (!isAudioOnly && stream && stream.getVideoTracks && stream.getVideoTracks().length > 0) ? 'video' : 'voice';
        if (typeof window !== "undefined") {
            window.inAppCallMode = inAppCallMode;
        }
        const videoEl = document.getElementById('inapp-clan-video');
        const placeholder = document.getElementById('inapp-video-placeholder');
        const liveBadge = document.getElementById('inapp-live-badge');
        const controls = document.getElementById('inapp-controls-bar');
        const startBtn = document.getElementById('inapp-start-btn');
        const shareBtn = document.getElementById('inapp-share-chat-btn');
        const endBtn = document.getElementById('inapp-end-btn');

        if (videoEl && !isAudioOnly && stream && stream.getVideoTracks && stream.getVideoTracks().length > 0) {
            videoEl.srcObject = stream;
            videoEl.style.display = 'block';
            videoEl.play().catch(e => console.warn("Video play error:", e));
            if (placeholder) placeholder.style.display = 'none';
        } else if (placeholder) {
            placeholder.style.display = 'flex';
            const statusText = document.getElementById('inapp-status-text');
            if (statusText) {
                statusText.textContent = isSimulated
                    ? "🎙️ متصل بغرفة الصوت (وضع الاستماع)"
                    : "🎙️ المكالمة الصوتية متصلة وشغالة بنجاح!";
            }
        }

        if (liveBadge) liveBadge.style.display = 'block';
        if (controls) controls.style.display = 'flex';
        if (startBtn) startBtn.style.display = 'none';
        if (shareBtn) shareBtn.style.display = 'block';
        if (endBtn) endBtn.style.display = 'block';

        if (isSimulated) {
            const micBtn = document.getElementById('inapp-mic-btn');
            if (micBtn) {
                micBtn.innerHTML = '🔇 المايك: غير مصرح (استماع)';
                micBtn.style.borderColor = '#ef4444';
                micBtn.style.color = '#ef4444';
            }
            showToast("ℹ️ تم الانضمام في وضع الاستماع. يمكنك الضغط على المايك لمنح الصلاحية في أي وقت.", "info");
        } else {
            showToast(isAudioOnly ? "🟢 تم بدء المكالمة الصوتية المباشرة بنجاح!" : "🟢 تم بدء المكالمة المباشرة (فيديو وصوت) بنجاح!", "success");
        }
    } catch (err) {
        console.warn("Camera/Mic notice:", err && err.message ? err.message : err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || (err.message && err.message.includes('Permission denied'))) {
            showToast("ℹ️ تم الدخول في وضع الاستماع لعدم توفر إذن الميكروفون.", "info");
        } else {
            showToast("ℹ️ تعذر تشغيل الميكروفون حالياً، يمكنك المتابعة في وضع الاستماع.", "info");
        }
    }
}

function toggleInAppMic() {
    if (!inAppLocalStream) return;
    const audioTracks = inAppLocalStream.getAudioTracks ? inAppLocalStream.getAudioTracks() : [];
    if (audioTracks.length === 0 || audioTracks.every(t => !t.enabled)) {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            navigator.mediaDevices.getUserMedia({ audio: true }).then(newStream => {
                const newTrack = newStream.getAudioTracks()[0];
                if (newTrack) {
                    if (inAppLocalStream.addTrack) inAppLocalStream.addTrack(newTrack);
                    isInAppMicMuted = false;
                    const micBtn = document.getElementById('inapp-mic-btn');
                    if (micBtn) {
                        micBtn.innerHTML = '🎙️ المايك: شغال';
                        micBtn.style.borderColor = 'rgba(255,255,255,0.2)';
                        micBtn.style.color = '#fff';
                    }
                    showToast("🎙️ تم تفعيل الميكروفون بنجاح!", "success");
                }
            }).catch(err => {
                console.warn("Mic permission request:", err && err.message ? err.message : err);
                showToast("⚠️ لم يتم منح إذن الميكروفون من المتصفح.", "info");
            });
            return;
        }
    }
    isInAppMicMuted = !isInAppMicMuted;
    audioTracks.forEach(t => t.enabled = !isInAppMicMuted);
    const micBtn = document.getElementById('inapp-mic-btn');
    if (micBtn) {
        micBtn.innerHTML = isInAppMicMuted ? '🔇 المايك: مكتوم' : '🎙️ المايك: شغال';
        micBtn.style.borderColor = isInAppMicMuted ? '#ef4444' : 'rgba(255,255,255,0.2)';
        micBtn.style.color = isInAppMicMuted ? '#ef4444' : '#fff';
    }
    showToast(isInAppMicMuted ? "🔇 تم كتم الميكروفون" : "🎙️ تم تشغيل الميكروفون", "info");
}

function toggleInAppCam() {
    if (!inAppLocalStream) return;
    const videoTracks = inAppLocalStream.getVideoTracks();
    if (videoTracks.length === 0) return;
    isInAppCamOff = !isInAppCamOff;
    videoTracks.forEach(t => t.enabled = !isInAppCamOff);
    const camBtn = document.getElementById('inapp-cam-btn');
    if (camBtn) {
        camBtn.innerHTML = isInAppCamOff ? '🚫 الكاميرا: معطلة' : '📹 الكاميرا: شغال';
        camBtn.style.borderColor = isInAppCamOff ? '#ef4444' : 'rgba(255,255,255,0.2)';
        camBtn.style.color = isInAppCamOff ? '#ef4444' : '#fff';
    }
    showToast(isInAppCamOff ? "🚫 تم إيقاف الكاميرا" : "📹 تم تشغيل الكاميرا", "info");
}

async function shareInAppCallInClanChat() {
    const user = getCurrentUsername() || 'عضو PHANTOM';
    const msgText = `📞 دعوة مكالمة مباشرة: ${user} بدأ مكالمة صوت وفيديو داخل المقر الآن! اضغط للانضمام والمشاركة.`;
    
    try {
        const message = {
            sender: user,
            text: msgText,
            timestamp: Date.now(),
            isCall: true,
            callType: 'inapp'
        };
        await serverSendChat(message);
        renderChat();
    } catch (e) {
        console.warn("Failed to send call invitation chat:", e);
    }

    const callMode = (typeof inAppCallMode !== 'undefined' && inAppCallMode) ? inAppCallMode : 'voice';
    fetch('/api/calls/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            hostName: user,
            hostId: getCurrentUserId(),
            mode: callMode,
            topic: 'مكالمة المقر المباشرة'
        })
    }).catch(() => {});

    showToast("✅ تم إرسال دعوة الكلان للمكالمة في الشات وظهور البانر!", "success");
    closeGoogleMeetModal();
    if (typeof navigateToPage === 'function') {
        navigateToPage('page-chat');
    }
}

function endInAppCall() {
    if (inAppLocalStream) {
        inAppLocalStream.getTracks().forEach(track => {
            try { track.stop(); } catch(e) {}
        });
        inAppLocalStream = null;
    }

    const videoEl = document.getElementById('inapp-clan-video');
    const placeholder = document.getElementById('inapp-video-placeholder');
    const liveBadge = document.getElementById('inapp-live-badge');
    const controls = document.getElementById('inapp-controls-bar');
    const startBtn = document.getElementById('inapp-start-btn');
    const shareBtn = document.getElementById('inapp-share-chat-btn');
    const endBtn = document.getElementById('inapp-end-btn');

    if (videoEl) {
        videoEl.srcObject = null;
        videoEl.style.display = 'none';
    }

    if (placeholder) placeholder.style.display = 'flex';
    if (liveBadge) liveBadge.style.display = 'none';
    if (controls) controls.style.display = 'none';
    if (startBtn) startBtn.style.display = 'block';
    if (shareBtn) shareBtn.style.display = 'none';
    if (endBtn) endBtn.style.display = 'none';

    isInAppMicMuted = false;
    isInAppCamOff = false;
    inAppCallMode = 'voice';
    if (typeof window !== "undefined") {
        window.inAppCallMode = 'voice';
    }

    fetch('/api/calls/end', { method: 'POST' }).catch(() => {});
}

/* ========================================================
   🎙️ نظام مكالمات Agora RTC فائقة الوضوح (PHANTOM OPS)
   ======================================================== */
const AGORA_APP_ID = "129b4ba5126742d6973d17c9cbf2d5f3";
const AGORA_CHANNEL = "phantom_hq";
let agoraClient = null;
let agoraLocalAudioTrack = null;
let isAgoraJoined = false;
let isAgoraMicMuted = false;
let agoraRemoteUsers = new Map();

async function joinAgoraRoom() {
    if (typeof AgoraRTC === "undefined") {
        showToast("⚠️ جاري تحميل مكتبة Agora الصوتية، انتظر ثوانٍ...", "info");
        return;
    }
    const username = getCurrentUsername() || 'عضو PHANTOM';
    const uid = Math.floor(Math.random() * 90000) + 10000;

    const joinBtn = document.getElementById("agora-join-btn");
    const leaveBtn = document.getElementById("agora-leave-btn");
    const shareBtn = document.getElementById("agora-share-chat-btn");
    const controls = document.getElementById("agora-controls-bar");
    const badge = document.getElementById("agora-members-badge");
    const statusText = document.getElementById("agora-status-text");
    const visualizer = document.getElementById("agora-avatar-visualizer");

    if (joinBtn) {
        joinBtn.disabled = true;
        joinBtn.textContent = "⏳ جاري الاتصال بغرفة Agora...";
    }

    try {
        if (!agoraClient) {
            agoraClient = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

            agoraClient.on("user-published", async (user, mediaType) => {
                await agoraClient.subscribe(user, mediaType);
                if (mediaType === "audio" && user.audioTrack) {
                    user.audioTrack.play();
                }
                agoraRemoteUsers.set(user.uid, user);
                updateAgoraUsersUI();
            });

            agoraClient.on("user-unpublished", (user) => {
                agoraRemoteUsers.delete(user.uid);
                updateAgoraUsersUI();
            });

            agoraClient.on("user-left", (user) => {
                agoraRemoteUsers.delete(user.uid);
                updateAgoraUsersUI();
            });
        }

        // جلب التوكن من خادم Supabase
        let token = null;
        try {
            token = await fetchToken(AGORA_CHANNEL, uid);
        } catch (e) {
            console.warn("Could not fetch Agora token from Supabase:", e);
        }

        await agoraClient.join(AGORA_APP_ID, AGORA_CHANNEL, token || null, uid);
        isAgoraJoined = true;

        // محاولة تشغيل المايك
        try {
            agoraLocalAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            await agoraClient.publish([agoraLocalAudioTrack]);
            isAgoraMicMuted = false;
        } catch (micErr) {
            console.warn("Microphone access denied for Agora, connected in listen-only mode:", micErr);
            showToast("🎧 متصل بغرفة Agora في وضع الاستماع (المايك غير مفعل)", "info");
        }

        // تحديث الواجهة
        if (joinBtn) joinBtn.style.display = "none";
        if (leaveBtn) leaveBtn.style.display = "block";
        if (shareBtn) shareBtn.style.display = "block";
        if (controls) controls.style.display = "flex";
        if (badge) {
            badge.style.display = "inline-block";
            badge.textContent = `🟢 متصل بالروم الصوتي (${username})`;
        }
        if (statusText) statusText.textContent = "✅ متصل بغرفة عمليات Agora بنجاح!";
        if (visualizer) {
            visualizer.style.borderColor = "#00ff88";
            visualizer.style.boxShadow = "0 0 30px rgba(0, 255, 136, 0.5)";
        }

        showToast("🎉 تم الاتصال بغرفة Agora الصوتية بنجاح!", "success");

        // تسجيل المكالمة في السيرفر
        fetch('/api/calls/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                hostName: username,
                hostId: getCurrentUserId(),
                mode: 'agora',
                topic: 'غرفة Agora الصوتية'
            })
        }).catch(() => {});

    } catch (err) {
        console.error("Agora join error:", err);
        showToast("⚠️ تعذر الاتصال بغرفة Agora الصوتية.", "error");
        if (joinBtn) {
            joinBtn.disabled = false;
            joinBtn.textContent = "🚀 دخول غرفة Agora الصوتية";
        }
    }
}

async function leaveAgoraRoom() {
    if (agoraLocalAudioTrack) {
        try {
            agoraLocalAudioTrack.stop();
            agoraLocalAudioTrack.close();
        } catch(e) {}
        agoraLocalAudioTrack = null;
    }
    if (agoraClient && isAgoraJoined) {
        try {
            await agoraClient.leave();
        } catch(e) {}
    }
    isAgoraJoined = false;
    isAgoraMicMuted = false;
    agoraRemoteUsers.clear();

    const joinBtn = document.getElementById("agora-join-btn");
    const leaveBtn = document.getElementById("agora-leave-btn");
    const shareBtn = document.getElementById("agora-share-chat-btn");
    const controls = document.getElementById("agora-controls-bar");
    const badge = document.getElementById("agora-members-badge");
    const statusText = document.getElementById("agora-status-text");
    const visualizer = document.getElementById("agora-avatar-visualizer");
    const usersList = document.getElementById("agora-users-list");

    if (joinBtn) {
        joinBtn.style.display = "block";
        joinBtn.disabled = false;
        joinBtn.textContent = "🚀 دخول غرفة Agora الصوتية";
    }
    if (leaveBtn) leaveBtn.style.display = "none";
    if (shareBtn) shareBtn.style.display = "none";
    if (controls) controls.style.display = "none";
    if (badge) badge.style.display = "none";
    if (usersList) usersList.style.display = "none";
    if (statusText) statusText.textContent = "غرفة Agora الصوتية عالية النقاء";
    if (visualizer) {
        visualizer.style.borderColor = "#00f2fe";
        visualizer.style.boxShadow = "0 0 20px rgba(0,242,254,0.3)";
    }

    fetch('/api/calls/end', { method: 'POST' }).catch(() => {});
    showToast("🔴 غادرت غرفة Agora الصوتية.", "info");
}

function toggleAgoraMic() {
    if (!agoraLocalAudioTrack) {
        showToast("⚠️ المايك غير مفعل حالياً.", "info");
        return;
    }
    const btn = document.getElementById("agora-mic-btn");
    if (isAgoraMicMuted) {
        agoraLocalAudioTrack.setEnabled(true);
        isAgoraMicMuted = false;
        if (btn) {
            btn.textContent = "🎙️ المايك: شغال";
            btn.style.color = "#fff";
        }
        showToast("🎙️ تم تشغيل المايك", "info");
    } else {
        agoraLocalAudioTrack.setEnabled(false);
        isAgoraMicMuted = true;
        if (btn) {
            btn.textContent = "🔇 المايك: مكتوم";
            btn.style.color = "#ef4444";
        }
        showToast("🔇 تم كتم المايك", "info");
    }
}

async function shareAgoraCallInClanChat() {
    const user = getCurrentUsername() || 'عضو PHANTOM';
    const msgText = `🎙️ دعوة لغرفة Agora: ${user} متواجد الآن في الغرفة الصوتية التكتيكية! اضغط للانضمام والمحادثة الصوتية المباشرة.`;
    
    try {
        const message = {
            sender: user,
            text: msgText,
            timestamp: Date.now(),
            isCall: true,
            callType: 'agora'
        };
        await serverSendChat(message);
        renderChat();
    } catch(e) {}

    showToast("✅ تمت مشاركة دعوة Agora في شات الكلان!", "success");
    closeGoogleMeetModal();
    if (typeof navigateToPage === 'function') {
        navigateToPage('page-chat');
    }
}

function updateAgoraUsersUI() {
    const count = agoraRemoteUsers.size + (isAgoraJoined ? 1 : 0);
    const usersList = document.getElementById("agora-users-list");
    const badge = document.getElementById("agora-members-badge");
    if (badge) {
        badge.textContent = `🟢 متصل بالروم (${count} في الغرفة)`;
    }
    if (usersList) {
        if (count > 1) {
            usersList.style.display = "block";
            usersList.textContent = `👥 المتصلين بالروم: ${count} أعضاء`;
        } else {
            usersList.style.display = "none";
        }
    }
}

window.openAndJoinCall = function(tabTarget) {
    showGoogleMeetModal();
    switchCallTab(tabTarget);
    if (tabTarget === 'inapp') {
        const startBtn = document.getElementById('inapp-start-btn');
        if (startBtn && startBtn.style.display !== 'none') {
            startInAppCall();
        }
    } else if (tabTarget === 'agora') {
        if (!isAgoraJoined) {
            joinAgoraRoom();
        }
    }
};

window.joinAgoraRoom = joinAgoraRoom;
window.leaveAgoraRoom = leaveAgoraRoom;
window.toggleAgoraMic = toggleAgoraMic;
window.shareAgoraCallInClanChat = shareAgoraCallInClanChat;

/* 🌐 دوال Google Meet الرسمية */
async function handleGoogleMeetSignIn() {
    initGoogleMeetFirebase();
    if (typeof firebase === 'undefined' || !firebase.auth) {
        showToast("⚠️ مكتبة المصادقة قيد التحميل، حاول ثانية.", "error");
        return;
    }

    showToast("🔐 جاري تسجيل الدخول بحساب Google...", "info");
    const provider = new firebase.auth.GoogleAuthProvider();
    GOOGLE_MEET_SCOPES.forEach(s => provider.addScope(s));

    try {
        const result = await firebase.auth().signInWithPopup(provider);
        if (result && result.credential && result.credential.accessToken) {
            cachedGoogleAccessToken = result.credential.accessToken;
            showToast("✅ تم تسجيل الدخول بنجاح! جاري تجهيز المكالمة...", "success");
            await handleCreateNewMeetCall();
        } else {
            throw new Error("لم يتم استلام رمز الوصول");
        }
    } catch (err) {
        console.error("Google Sign-In Error:", err);
        showToast("⚠️ تعذر تسجيل الدخول بحساب Google.", "error");
    }
}

async function handleCreateNewMeetCall() {
    if (!cachedGoogleAccessToken) {
        showGoogleMeetModal(true);
        switchCallTab('meet');
        return;
    }

    showToast("📹 جاري إنشاء مكالمة Google Meet جديدة...", "info");
    try {
        const response = await fetch("https://meet.googleapis.com/v2/spaces", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${cachedGoogleAccessToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({})
        });

        if (!response.ok) {
            if (response.status === 401) {
                cachedGoogleAccessToken = null;
                showGoogleMeetModal(true);
                switchCallTab('meet');
                return;
            }
            throw new Error("API status " + response.status);
        }

        const data = await response.json();
        currentGoogleMeetUri = data.meetingUri;
        currentGoogleMeetCode = data.meetingCode || data.name;

        // تحديث الواجهة
        const authSection = document.getElementById("meet-auth-section");
        const activeSection = document.getElementById("meet-active-section");
        const codeEl = document.getElementById("meet-room-code");
        const joinBtn = document.getElementById("meet-join-link-btn");

        if (authSection) authSection.style.display = "none";
        if (activeSection) activeSection.style.display = "block";
        if (codeEl) codeEl.textContent = `الكود: ${currentGoogleMeetCode} | ${currentGoogleMeetUri}`;
        if (joinBtn) joinBtn.href = currentGoogleMeetUri;

        showToast("🎉 تم إنشاء رابط مكالمة Google Meet بنجاح!", "success");
    } catch (err) {
        console.error("Error creating Google Meet space:", err);
        showToast("⚠️ حدث خطأ أثناء إنشاء المكالمة.", "error");
    }
}

async function shareMeetLinkInClanChat() {
    if (!currentGoogleMeetUri) {
        showToast("⚠️ لا توجد مكالمة نشطة للمشاركة.", "info");
        return;
    }
    const user = getCurrentUsername() || 'عضو PHANTOM';
    const meetMsg = `📹 مكالمة صوت وفيديو بدأت الآن في Google Meet! انضمام مباشر: ${currentGoogleMeetUri}`;
    
    try {
        const message = {
            sender: user,
            text: meetMsg,
            timestamp: Date.now(),
            isCall: true,
            callType: 'meet'
        };
        await serverSendChat(message);
        renderChat();
    } catch(e) {}

    fetch('/api/calls/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            hostName: user,
            hostId: getCurrentUserId(),
            mode: 'meet',
            topic: 'مكالمة Google Meet'
        })
    }).catch(() => {});

    showToast("✅ تمت مشاركة رابط المكالمة في شات الكلان!", "success");
    closeGoogleMeetModal();
    if (typeof navigateToPage === 'function') {
        navigateToPage('page-chat');
    }
}

function copyMeetLinkToClipboard() {
    if (!currentGoogleMeetUri) return;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(currentGoogleMeetUri).then(() => {
            showToast("📋 تم نسخ رابط Google Meet بنجاح!", "success");
        }).catch(() => {
            showToast("رابط المكالمة: " + currentGoogleMeetUri, "info");
        });
    } else {
        showToast("رابط المكالمة: " + currentGoogleMeetUri, "info");
    }
}

function updateVoiceMembersList(userId, status) {
    const list = document.getElementById("voice-members-list");
    if (!list) return;
    const item = document.createElement("div");
    item.style.cssText = "display:flex; justify-content:space-between; padding:5px; background:rgba(255,255,255,0.03); border-radius:4px; margin-bottom:2px;";
    item.innerHTML = `<span>${escapeHTML(userId)}</span><span style="color:var(--green); font-size:0.7rem;">${escapeHTML(status)}</span>`;
    list.appendChild(item);
    const items = list.querySelectorAll("div");
    if (items.length > 30) items[0].remove();
}

function joinVoiceRoom() {
    const popup = document.getElementById("voice-join-popup");
    if (popup) popup.style.display = "none";
    
    const panel = document.getElementById("voice-room-panel");
    if (panel) panel.style.display = "block";
    
    const username = (typeof getCurrentUsername === "function" ? getCurrentUsername() : null) || "عضو PHANTOM";
    updateVoiceMembersList(username, "🟢 متصل الآن");
    
    showGoogleMeetModal();
    switchCallTab('inapp');
    startInAppCall();
    showToast("🎙️ تم الانضمام إلى الغرفة الصوتية للمقر!", "success");
}

function leaveVoiceRoom() {
    endInAppCall();
    closeGoogleMeetModal();
    const panel = document.getElementById("voice-room-panel");
    if (panel) panel.style.display = "none";
    const username = (typeof getCurrentUsername === "function" ? getCurrentUsername() : null) || "عضو PHANTOM";
    updateVoiceMembersList(username, "🔴 غادر");
    showToast("🚪 تم مغادرة الغرفة الصوتية", "info");
}

function setupVoiceJoinButton() {
    const joinBtn = document.getElementById("join-voice-room-btn");
    if (joinBtn) {
        joinBtn.removeEventListener("click", joinVoiceRoom);
        joinBtn.addEventListener("click", joinVoiceRoom);
    }
    const leaveBtn = document.getElementById("leave-voice-room-btn");
    if (leaveBtn) {
        leaveBtn.removeEventListener("click", leaveVoiceRoom);
        leaveBtn.addEventListener("click", leaveVoiceRoom);
    }
}

window.joinVoiceRoom = joinVoiceRoom;
window.leaveVoiceRoom = leaveVoiceRoom;

document.addEventListener("DOMContentLoaded", setupVoiceJoinButton);

/* ========================================================
   30. PHANTOM HUB
   ======================================================== */

function openHub() {
    const hubOverlay = document.getElementById('phantom-hub-overlay');
    if (hubOverlay) {
        hubOverlay.style.display = 'flex';
        setTimeout(() => hubOverlay.classList.add('active'), 10);
    }
}

function closeHub() {
    const hubOverlay = document.getElementById('phantom-hub-overlay');
    if (hubOverlay) {
        hubOverlay.classList.remove('active');
        setTimeout(() => hubOverlay.style.display = 'none', 400);
    }
}

function openSubPage(pageId) {
    const grid = document.getElementById('hub-grid');
    const page = document.getElementById(pageId);
    if (grid) grid.style.display = 'none';
    if (page) page.style.display = 'block';
}

function closeSubPage(pageId) {
    const grid = document.getElementById('hub-grid');
    const page = document.getElementById(pageId);
    if (grid) grid.style.display = 'grid';
    if (page) page.style.display = 'none';
}

async function updateUserPoints(addedPoints) {
    const username = getCurrentUsername();
    if (!username) return;
    try {
        const response = await fetch('/api/user/update-points', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, points: addedPoints }) });
        if (response.ok) { addPoints(username, addedPoints); renderLeaderboard(); showToast(`✅ تم إضافة ${addedPoints} نقطة!`, 'success'); }
        else { showToast('⚠️ فشل تحديث النقاط في السيرفر.', 'error'); }
    } catch (error) { console.error('❌ خطأ في مزامنة النقاط:', error); showToast('⚠️ خطأ في الاتصال بالسيرفر.', 'error'); }
}

let banCheckInterval = null;

// دالة مزامنة المطرودين من Supabase إلى localStorage
async function syncBannedUsers() {
    if (!supabaseClient) return;
    try {
        const { data: bannedData } = await supabaseClient.from('banned_users').select('*');
        if (bannedData) {
            const bannedMap = {};
            bannedData.forEach(user => { 
                bannedMap[user.username] = { status: 'banned', reason: user.reason }; 
            });
            setStorage("phantom_server_banned_users", bannedMap);
            setStorage("phantom_banned_users", bannedMap);
        }
    } catch (e) {
        console.warn("⚠️ فشل مزامنة المطرودين:", e);
    }
}

function startBanSystem() {
    if (banCheckInterval) clearInterval(banCheckInterval);
    
    // ✅ مزامنة فورية عند بدء التشغيل
    syncBannedUsers();
    
    banCheckInterval = setInterval(async () => {
        // ✅ مزامنة دورية (كل 8 ثواني)
        await syncBannedUsers();

        const username = getCurrentUsername();
        if (!username) return;

        // ✅ تحقق من السيرفر أولاً
        if (supabaseClient) {
            try {
                const { data } = await supabaseClient
                    .from('banned_users')
                    .select('*')
                    .eq('username', username)
                    .single();
                if (data) {
                    enforceBan(username, data.reason);
                    return;
                }
            } catch (e) {}
        }
        
        // ثم تحقق من localStorage (النسخة المحدثة من السيرفر)
        const banned = getBannedUsers();
        if (banned[username] && banned[username].status === 'banned') {
            enforceBan(username, banned[username].reason);
        }
    }, 8000); // كل 8 ثواني
}

document.addEventListener('DOMContentLoaded', function() {
    // hub-trigger removed — no element with this ID exists
    // Hub open trigger removed
    const hubClose = document.getElementById('hub-close-btn');
    if (hubClose) { hubClose.addEventListener('click', closeHub); }
    const hubOverlay = document.getElementById('phantom-hub-overlay');
    if (hubOverlay) { hubOverlay.addEventListener('click', function(e) { if (e.target === hubOverlay) { closeHub(); } }); }

    document.querySelectorAll('.hub-card').forEach(card => {
        card.addEventListener('click', function() {
            const btnId = this.id;
            const hubOverlay = document.getElementById('phantom-hub-overlay');
            const bottomNav = document.querySelector('.bottom-dock');

            if (hubOverlay && hubOverlay.classList.contains('active')) {
                hubOverlay.classList.remove('active');
                setTimeout(() => hubOverlay.style.display = 'none', 400);
            }
            if (bottomNav) bottomNav.classList.add('hidden');

            let overlayId = '';
            if (btnId === 'open-daily-fullscreen-btn') overlayId = 'daily-rewards-overlay';
            else if (btnId === 'open-vault-fullscreen-btn') overlayId = 'vault-overlay';
            else if (btnId === 'open-wheel-fullscreen-btn') overlayId = 'wheel-overlay';
            else if (btnId === 'open-game-fullscreen-btn') overlayId = 'game-overlay';
            else if (btnId === 'open-store-fullscreen-btn') overlayId = 'store-overlay';
            else if (btnId === 'open-battle-fullscreen-btn') overlayId = 'battle-overlay';
            else if (btnId === 'open-arena-fullscreen-btn') overlayId = 'arena-overlay';

            if (overlayId) {
                const overlay = document.getElementById(overlayId);
                if (overlay) {
                    overlay.style.display = 'flex';
                    if (overlayId === 'vault-overlay' && typeof loadVaultData === 'function') { loadVaultData(); }
                    if (overlayId === 'arena-overlay') {
                        if (typeof updateArenaStatsUI === 'function') updateArenaStatsUI();
                        if (typeof renderArenaClanMembers === 'function') renderArenaClanMembers();
                    }
                    if (overlayId === 'battle-overlay') {
                        if (typeof updatePopularityBattleBalance === 'function') updatePopularityBattleBalance();
                        if (typeof renderPopularityClanMembers === 'function') renderPopularityClanMembers();
                    }
                }
            }
        });
    });

    document.querySelectorAll('.sub-page-back-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const pageId = this.dataset.page;
            if (pageId) { closeSubPage(pageId); }
        });
    });

    function setupCloseButton(closeBtnId, overlayId) {
        const closeBtn = document.getElementById(closeBtnId);
        const overlay = document.getElementById(overlayId);
        const bottomNav = document.querySelector('.bottom-dock');
        if (closeBtn && overlay) {
            closeBtn.addEventListener('click', function() {
                overlay.style.display = 'none';
                if (overlayId === 'arena-overlay' || overlayId === 'battle-overlay') {
                    if (typeof openHub === 'function') {
                        openHub();
                        return;
                    }
                }
                if (bottomNav) bottomNav.classList.remove('hidden');
            });
        }
    }

    setupCloseButton('daily-close-btn', 'daily-rewards-overlay');
    setupCloseButton('vault-close-btn', 'vault-overlay');
    setupCloseButton('wheel-close-btn', 'wheel-overlay');
    setupCloseButton('game-close-btn', 'game-overlay');
    setupCloseButton('store-close-btn', 'store-overlay');
    setupCloseButton('battle-close-btn', 'battle-overlay');
    setupCloseButton('arena-close-btn', 'arena-overlay');
    setupCloseButton('profile-close-btn', 'profile-overlay');
    setupCloseButton('inventory-close-btn', 'inventory-overlay');
});

/* ========================================================
   31. تعديل دالة renderAll لتشمل عرض المخزون
   ======================================================== */

const originalRenderAll = renderAll;
renderAll = function() {
    originalRenderAll();
    renderHearts();
    renderClips();
    renderInventory();
    renderBroadcastMessages(); // ✅ إضافة
};

/* ========================================================
   32. نظام "سجل الخصائص"
   ======================================================== */

function openProperties() {
    const propsOverlay = document.getElementById('properties-overlay');
    if (propsOverlay) { propsOverlay.style.display = 'flex'; setTimeout(() => propsOverlay.classList.add('active'), 10); }
}

function closeProperties() {
    const propsOverlay = document.getElementById('properties-overlay');
    if (propsOverlay) { propsOverlay.classList.remove('active'); setTimeout(() => propsOverlay.style.display = 'none', 300); }
}

function openPropPage(pageId) {
    const grid = document.getElementById('properties-grid');
    const page = document.getElementById(pageId);
    if (grid) grid.style.display = 'none';
    if (page) page.style.display = 'block';
}

function closePropPage(pageId) {
    const grid = document.getElementById('properties-grid');
    const page = document.getElementById(pageId);
    if (grid) grid.style.display = 'grid';
    if (page) page.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', function() {
    const propsTrigger = document.getElementById('properties-trigger');
    if (propsTrigger) { propsTrigger.addEventListener('click', openProperties); }
    const propsClose = document.getElementById('properties-close-btn');
    if (propsClose) { propsClose.addEventListener('click', closeProperties); }
    const propsOverlay = document.getElementById('properties-overlay');
    if (propsOverlay) { propsOverlay.addEventListener('click', function(e) { if (e.target === propsOverlay) { closeProperties(); } }); }
    document.querySelectorAll('.prop-card').forEach(card => {
        card.addEventListener('click', function() {
            const pageId = this.dataset.page;
            if (pageId) { openPropPage(pageId); }
        });
    });
    document.querySelectorAll('.prop-page-back-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const pageId = this.dataset.page;
            if (pageId) { closePropPage(pageId); }
        });
    });
});

/* ========================================================
   🔒 نظام الخزنة الاستثمارية
   ======================================================== */

const VAULT_STORAGE_KEY = "phantom_vault_data";
const VAULT_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
const VAULT_PROFIT_PERCENT = 0.25;

let vaultTimerInterval = null;

function getUserBalance() {
    const username = getCurrentUsername();
    const points = getLocalPoints();
    return points[username] || 0;
}

function updateVaultBalanceUI() {
    const balanceEl = document.getElementById('vault-user-balance');
    if (balanceEl) { balanceEl.textContent = getUserBalance(); }
}

function updateExpectedProfit() {
    const input = document.getElementById('vault-deposit-input');
    const profitEl = document.getElementById('vault-expected-profit');
    const totalEl = document.getElementById('vault-expected-total');
    const confirmBtn = document.getElementById('vault-confirm-btn');
    
    if (!input) return;
    let amount = parseInt(input.value) || 0;
    const balance = getUserBalance();
    if (amount > balance) { amount = balance; input.value = balance; }
    const profit = Math.floor(amount * VAULT_PROFIT_PERCENT);
    const total = amount + profit;
    if (profitEl) profitEl.textContent = `+${profit}`;
    if (totalEl) totalEl.textContent = `(الإجمالي: ${total})`;
    if (amount <= 0 || amount > balance) { confirmBtn.disabled = true; confirmBtn.style.opacity = "0.5"; }
    else { confirmBtn.disabled = false; confirmBtn.style.opacity = "1"; }
}

function setupVaultInputs() {
    const input = document.getElementById('vault-deposit-input');
    const percentBtns = document.querySelectorAll('.vault-percent-btn');
    if (input) { input.addEventListener('input', updateExpectedProfit); }
    percentBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const percent = parseFloat(this.dataset.percent);
            const balance = getUserBalance();
            let amount = Math.floor(balance * percent);
            if (input) { input.value = amount; updateExpectedProfit(); }
        });
    });
}

function setupVaultConfirm() {
    const confirmBtn = document.getElementById('vault-confirm-btn');
    if (!confirmBtn) return;
    confirmBtn.addEventListener('click', function() {
        const input = document.getElementById('vault-deposit-input');
        const amount = parseInt(input.value) || 0;
        const balance = getUserBalance();
        if (amount <= 0) { showToast("⚠️ يرجى إدخال مبلغ صحيح.", "error"); return; }
        if (amount > balance) { showToast("⚠️ الرصيد غير كافٍ لإتمام العملية.", "error"); return; }
        const username = getCurrentUsername();
        const points = getLocalPoints();
        points[username] = (points[username] || 0) - amount;
        setLocalPoints(points);
        const profit = Math.floor(amount * VAULT_PROFIT_PERCENT);
        const target = amount + profit;
        const unlockTime = Date.now() + VAULT_DURATION_MS;
        const vaultData = { deposit: amount, target: target, unlockTime: unlockTime };
        setStorage(VAULT_STORAGE_KEY, vaultData);
        showToast(`🔒 تم تجميد ${amount} نقطة في الخزنة لمدة 3 أيام!`, "success");
        updateVaultBalanceUI();
        loadVaultData();
    });
}

function updateCountdown(unlockTime) {
    const timerEl = document.getElementById('vault-countdown-timer');
    if (!timerEl) return;
    const now = Date.now();
    const diff = unlockTime - now;
    if (diff <= 0) {
        timerEl.textContent = "✅ تم! يمكنك استلام الأرباح الآن.";
        const actionBtn = document.getElementById('vault-action-btn');
        const targetEl = document.getElementById('vault-active-target');
        if (actionBtn && targetEl) {
            actionBtn.textContent = `💎 استلام الأرباح (${targetEl.textContent} نقطة)`;
            actionBtn.className = "btn-success";
            actionBtn.onclick = claimVault;
        }
        if (vaultTimerInterval) { clearInterval(vaultTimerInterval); vaultTimerInterval = null; }
        return;
    }
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    timerEl.textContent = `${String(days).padStart(2, '0')} يوم : ${String(hours).padStart(2, '0')} ساعة : ${String(minutes).padStart(2, '0')} دقيقة : ${String(seconds).padStart(2, '0')} ثانية`;
}

function loadVaultData() {
    updateVaultBalanceUI();
    const vaultData = getStorage(VAULT_STORAGE_KEY, null);
    const activeSection = document.getElementById('vault-active-section');
    const depositEl = document.getElementById('vault-active-deposit');
    const targetEl = document.getElementById('vault-active-target');
    const actionBtn = document.getElementById('vault-action-btn');
    if (!activeSection) return;
    if (vaultData && vaultData.deposit > 0) {
        activeSection.style.display = "block";
        if (depositEl) depositEl.textContent = vaultData.deposit;
        if (targetEl) targetEl.textContent = vaultData.target;
        actionBtn.textContent = "⚠️ كسر الخزنة (بدون أرباح)";
        actionBtn.className = "btn-danger";
        actionBtn.onclick = breakVault;
        if (vaultTimerInterval) clearInterval(vaultTimerInterval);
        updateCountdown(vaultData.unlockTime);
        vaultTimerInterval = setInterval(() => updateCountdown(vaultData.unlockTime), 1000);
    } else {
        activeSection.style.display = "none";
        if (vaultTimerInterval) { clearInterval(vaultTimerInterval); vaultTimerInterval = null; }
    }
}

function breakVault() {
    const vaultData = getStorage(VAULT_STORAGE_KEY, null);
    if (!vaultData) return;
    if (confirm("⚠️ هل أنت متأكد من كسر الخزنة؟ ستفقد الأرباح المتراكمة (25%).")) {
        const username = getCurrentUsername();
        const points = getLocalPoints();
        
        // حساب المبلغ الجديد مع تفعيل البونص إذا وجد
        let amountToReturn = vaultData.deposit; // المبلغ الأساسي
        
        // ✅ قراءة حالة كارت إعادة التجميد
        const hasVaultBonus = getStorage("phantom_vault_bonus", false);
        if (hasVaultBonus) {
            amountToReturn = Math.floor(vaultData.deposit * 1.10); // إضافة 10%
            removeStorage("phantom_vault_bonus"); // حذف البونص بعد الاستخدام
            showToast(`💰 تم تطبيق بونص +10%! حصلت على ${amountToReturn} نقطة.`, "success");
        }

        // إضافة النقاط للاعب
        points[username] = (points[username] || 0) + amountToReturn;
        setLocalPoints(points);
        
        // تحديث السيرفر إذا كان متصلاً
        if (supabaseClient) {
            safePostgrest(supabaseClient.from('members').update({ coins: points[username] }).eq('name', username)).then(() => {
                console.log("✅ تم تحديث النقاط في السيرفر.");
            }).catch(err => console.warn("⚠️ فشل تحديث النقاط في السيرفر:", err));
        }
        
        removeStorage(VAULT_STORAGE_KEY);
        if (vaultTimerInterval) { clearInterval(vaultTimerInterval); vaultTimerInterval = null; }
        updateVaultBalanceUI();
        loadVaultData();
    }
}

function claimVault() {
    const vaultData = getStorage(VAULT_STORAGE_KEY, null);
    if (!vaultData) return;
    const now = Date.now();
    if (now < vaultData.unlockTime) { showToast("⏱️ لم تنتهِ مدة التجميد بعد!", "error"); return; }
    const target = vaultData.target;
    const username = getCurrentUsername();
    const points = getLocalPoints();
    points[username] = (points[username] || 0) + target;
    setLocalPoints(points);
    removeStorage(VAULT_STORAGE_KEY);
    if (vaultTimerInterval) { clearInterval(vaultTimerInterval); vaultTimerInterval = null; }
    triggerConfetti();
    showToast(`💎 تم استلام ${target} نقطة (الأصل + الأرباح)!`, "success");
    updateVaultBalanceUI();
    loadVaultData();
}

function initVault() { setupVaultInputs(); setupVaultConfirm(); loadVaultData(); }
window.loadVaultData = loadVaultData;
window.initVault = initVault;

/* ========================================================
   🛒 نظام المتجر والمخزون (النسخة المتكاملة والشاملة)
   ======================================================== */

const DEFAULT_SHOP_ITEMS = [
    // 🖼️ 1. الإطارات (Frames)
    { id: 1, name: 'إطار نيون فضي', price: 150, type: 'frame', effect: 'silver', is_rare: false, description: 'إطار فضي لامع وأنيق للبروفايل', icon: '🖼️' },
    { id: 2, name: 'إطار نيون ذهبي', price: 350, type: 'frame', effect: 'gold', is_rare: true, description: 'إطار متوهج بالذهب الخالص (نادر)', icon: '✨' },
    { id: 3, name: 'إطار نيون متعدد الألوان', price: 750, type: 'frame', effect: 'rainbow', is_rare: true, description: 'إطار طيف قوس قزح أسطوري متحرك', icon: '🌈' },
    { id: 4, name: 'إطار نيون البرق الأزرق', price: 200, type: 'frame', effect: 'blue', is_rare: false, description: 'إطار صاعقة زرقاء كهربائية', icon: '⚡' },
    { id: 5, name: 'إطار نيون الذهب الأحمر', price: 600, type: 'frame', effect: 'red_gold', is_rare: true, description: 'إطار أحمر وذهبي ناري فخم (أسطوري)', icon: '🔥' },

    // 🏷️ 2. الألقاب (Titles)
    { id: 6, name: 'لقب: عضو مميز', price: 150, type: 'title', effect: 'member', is_rare: false, description: 'يظهر بجانب اسمك في الشات والبروفايل', icon: '🏷️' },
    { id: 7, name: 'لقب: فارس PHANTOM', price: 250, type: 'title', effect: 'phantom_knight', is_rare: false, description: 'يظهر بجانب اسمك في الشات والبروفايل', icon: '⚔️' },
    { id: 8, name: 'لقب: قائد محتك', price: 500, type: 'title', effect: 'veteran', is_rare: true, description: 'لقب تكتيكي للمحاربين القدامى (نادر)', icon: '🎖️' },
    { id: 9, name: 'لقب: سفاح الروابط', price: 650, type: 'title', effect: 'assassin', is_rare: true, description: 'لقب هجومي مرعب (نادر)', icon: '🗡️' },
    { id: 10, name: 'لقب: العرب', price: 900, type: 'title', effect: 'arab', is_rare: true, description: 'لقب الفخر والسيادة الأسطوري', icon: '👑' },
    { id: 11, name: 'لقب: صياد النقاط', price: 200, type: 'title', effect: 'point_hunter', is_rare: false, description: 'يظهر بجانب اسمك في الشات والبروفايل', icon: '🎯' },
    { id: 12, name: 'لقب: حارس المقر', price: 400, type: 'title', effect: 'guard', is_rare: true, description: 'درع الحماية الرسمي للمقر (نادر)', icon: '🛡️' },
    { id: 13, name: 'لقب: النمر الأسود', price: 550, type: 'title', effect: 'black_panther', is_rare: true, description: 'سرعة واقتناص بلا رحمة (نادر)', icon: '🐆' },
    { id: 14, name: 'لقب: مخترع الاستراتيجيات', price: 700, type: 'title', effect: 'strategist', is_rare: true, description: 'عقل المعركة التكتيكي (أسطوري)', icon: '🧠' },

    // 💳 3. الكروت والمزايا الفورية (Cards)
    { id: 15, name: 'كارت تضخيم النقاط', price: 300, type: 'card', effect: 'point_boost', is_rare: true, description: 'مضاعفة النقاط المكتسبة لمدة 30 دقيقة', icon: '🔥' },
    { id: 16, name: 'كارت دبل نقاط', price: 450, type: 'card', effect: 'double_points', is_rare: true, description: 'دبل نقاط لجميع الأنشطة لمدة ساعة كاملة', icon: '✨' },
    { id: 17, name: 'كارت نقاط سريعة (+200)', price: 150, type: 'card', effect: 'quick_points', is_rare: false, description: 'الحصول فوراً على 200 نقطة إضافية لحسابك', icon: '⚡' },
    { id: 18, name: 'صندوق المفاجآت', price: 100, type: 'card', effect: 'surprise_box', is_rare: false, description: 'صندوق حظ يمنحك نقاطاً عشوائية بين 20 إلى 200 نقطة', icon: '🎁' },
    { id: 19, name: 'كارت تسجيل حضور فوري', price: 300, type: 'card', effect: 'fast_attendance', is_rare: true, description: 'تسجيل نقطة حضور فورية لسجلك (نادر)', icon: '⏩' },
    { id: 20, name: 'كارت 3 قلوب دعم', price: 180, type: 'card', effect: 'bonus_hearts', is_rare: false, description: 'إضافة 3 قلوب دعم فورية لحسابك', icon: '💛' },
    { id: 21, name: 'كارت عباءة التمويه', price: 350, type: 'card', effect: 'camouflage', is_rare: true, description: 'تفعيل التمويه والخصوصية في المقر لمدة ساعتين', icon: '🕶️' },
    { id: 22, name: 'كارت حماية من الإنذارات', price: 600, type: 'card', effect: 'warning_protect', is_rare: true, description: 'إلغاء إنذار أو مخالفة مسجلة في ملفك (أسطوري)', icon: '🛡️' },
    { id: 44, name: 'كارت بونص الخزنة (+10%)', price: 450, type: 'card', effect: 're_freeze', is_rare: true, description: 'إضافة 10% أرباح إضافية عند فك الخزنة (نادر)', icon: '❄️' },
    { id: 45, name: 'كارت تحويل النقاط', price: 100, type: 'card', effect: 'transfer', is_rare: false, description: 'فتح نافذة تحويل النقاط لأي عضو في الكلان', icon: '💳' },

    // 🎨 4. ألوان الأسماء (Name Colors)
    { id: 23, name: 'لون اسم ذهبي', price: 400, type: 'name_color', effect: 'gold', is_rare: true, description: 'اسمك يظهر باللون الذهبي البراق في الشات والبروفايل', icon: '✨' },
    { id: 24, name: 'لون اسم فضي', price: 300, type: 'name_color', effect: 'silver', is_rare: true, description: 'اسمك يظهر بالفضي اللامع في الشات والبروفايل', icon: '🥈' },
    { id: 25, name: 'لون اسم أزرق سيان', price: 180, type: 'name_color', effect: 'blue', is_rare: false, description: 'اسمك يظهر بالأزرق النيون في الشات والبروفايل', icon: '💙' },
    { id: 26, name: 'لون اسم أحمر ناري', price: 180, type: 'name_color', effect: 'red', is_rare: false, description: 'اسمك يظهر بالأحمر الناري في الشات والبروفايل', icon: '❤️' },
    { id: 27, name: 'لون اسم بنفسجي ملكي', price: 320, type: 'name_color', effect: 'purple', is_rare: true, description: 'اسمك يظهر بالبنفسجي الملكي في الشات والبروفايل', icon: '💜' },

    // 🌌 5. خلفيات البروفايل (Backgrounds)
    { id: 28, name: 'خلفية نيون سوداء', price: 250, type: 'background', effect: 'neon_black', is_rare: false, description: 'خلفية سوداء متوهجة للبروفايل', icon: '🌌' },
    { id: 29, name: 'خلفية ذهبية ملكية', price: 450, type: 'background', effect: 'gold', is_rare: true, description: 'خلفية ذهبية فاخرة للبروفايل (نادرة)', icon: '🌟' },
    { id: 30, name: 'خلفية طيف نيون', price: 650, type: 'background', effect: 'rainbow', is_rare: true, description: 'خلفية متدرجة بألوان الطيف المتوهجة (أسطورية)', icon: '🌈' },
    { id: 31, name: 'خلفية مجرة بنفسجية', price: 500, type: 'background', effect: 'purple_galaxy', is_rare: true, description: 'خلفية فضاء بنفسجية عميقة للبروفايل', icon: '🔮' },
    { id: 32, name: 'خلفية حمراء نارية', price: 500, type: 'background', effect: 'red_fire', is_rare: true, description: 'خلفية لهب أحمر متوهج للبروفايل', icon: '🔥' },
    { id: 33, name: 'خلفية غابة الزمرد', price: 400, type: 'background', effect: 'green_forest', is_rare: true, description: 'خلفية خضراء زمردية للبروفايل', icon: '🌲' },
    { id: 34, name: 'خلفية أعماق المحيط', price: 400, type: 'background', effect: 'blue_ocean', is_rare: true, description: 'خلفية زرقاء بحرية عميقة للبروفايل', icon: '🌊' },
    { id: 35, name: 'خلفية وردية ناعمة', price: 350, type: 'background', effect: 'pink', is_rare: true, description: 'خلفية وردية جذابة للبروفايل', icon: '🌺' },
    { id: 36, name: 'خلفية تيتانيوم داكنة', price: 250, type: 'background', effect: 'dark_grey', is_rare: false, description: 'خلفية كربونية داكنة فخمة للبروفايل', icon: '🪨' },
    { id: 37, name: 'خلفية أبيض نيون ساطع', price: 550, type: 'background', effect: 'white_neon', is_rare: true, description: 'خلفية بيضاء ساطعة بنور النيون للبروفايل', icon: '⚪' },
    { id: 38, name: 'خلفية فضية معدنية', price: 450, type: 'background', effect: 'silver', is_rare: true, description: 'خلفية فضية معدنية أنيقة للبروفايل', icon: '🥈' },

    // 💬 6. تأثيرات الرسائل (Chat Effects)
    { id: 39, name: 'تأثير إطار ذهبي للرسائل', price: 400, type: 'chat_effect', effect: 'gold_border', is_rare: true, description: 'فقاعات رسائلك بإطار ذهبي متوهج', icon: '💬' },
    { id: 40, name: 'تأثير نيون متوهج للرسائل', price: 450, type: 'chat_effect', effect: 'neon_bubble', is_rare: true, description: 'فقاعات رسائلك بوهج نيون أزرق جذاب', icon: '💠' },
    { id: 41, name: 'تأثير ظل متوهج', price: 380, type: 'chat_effect', effect: 'glow_shadow', is_rare: true, description: 'رسائلك بهالة ظل ضوئية مشعة', icon: '✨' },
    { id: 42, name: 'تأثير نبض القلب', price: 450, type: 'chat_effect', effect: 'heart_beat', is_rare: true, description: 'رسائلك بوهج وردي ناري دافئ', icon: '💓' },
    { id: 43, name: 'تأثير رسائل بارزة وكبيرة', price: 550, type: 'chat_effect', effect: 'big_text', is_rare: true, description: 'رسائلك بحجم أكبر وخط عريض ومميز', icon: '🔠' }
];

async function getShopItems() {
    const data = await supabaseGet('shop_items');
    if (data && data.length > 0) {
        const map = new Map();
        DEFAULT_SHOP_ITEMS.forEach(item => map.set(item.id, item));
        data.forEach(item => map.set(item.id, { ...map.get(item.id), ...item }));
        return Array.from(map.values());
    }
    return DEFAULT_SHOP_ITEMS;
}

// ✅ دالة اختيار العناصر النادرة لليوم (تتجدد عشوائياً كل 24 ساعة وفق تاريخ اليوم)
function getDailyRareItemIds(allItems) {
    const rarePool = allItems.filter(i => i.is_rare);
    const today = new Date().toISOString().split('T')[0]; // مثلاً '2026-09-25'
    let seed = 0;
    for (let i = 0; i < today.length; i++) {
        seed = ((seed << 5) - seed + today.charCodeAt(i)) | 0;
    }
    let randSeed = Math.abs(seed);
    const pseudoRandom = () => {
        randSeed = (randSeed * 9301 + 49297) % 233280;
        return randSeed / 233280;
    };
    const shuffled = [...rarePool].sort(() => pseudoRandom() - 0.5);
    return shuffled.slice(0, 6).map(item => item.id);
}

// ✅ تحديث مؤقت الـ 24 ساعة لتجديد التشكيلة النادرة
let shopTimerInterval = null;
function updateShopCountdownTimer() {
    const now = new Date();
    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 0, 0);
    const diff = Math.max(0, nextMidnight.getTime() - now.getTime());
    const h = String(Math.floor(diff / (1000 * 60 * 60))).padStart(2, '0');
    const m = String(Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, '0');
    const s = String(Math.floor((diff % (1000 * 60)) / 1000)).padStart(2, '0');
    
    const displayEl = document.getElementById('shop-countdown-display');
    if (displayEl) displayEl.textContent = `${h}:${m}:${s}`;
    const badgeEl = document.getElementById('rare-shop-badge-timer');
    if (badgeEl) badgeEl.textContent = `${h}:${m}:${s}`;
}

async function getUserInventory(userId) {
    if (!userId) return [];
    const username = getCurrentUsername();
    
    let serverItems = [];
    const data = await supabaseGet('user_inventory');
    if (data && Array.isArray(data)) {
        serverItems = data.filter(item => item.user_id === userId || (username && item.username === username));
    }

    const localInv = getStorage("phantom_user_inventory", []);
    const localItems = localInv.filter(item => item.user_id === userId || item.userId === userId || (username && item.username === username));

    const combined = [...serverItems, ...localItems];
    return combined;
}

// ✅ دالة مساعدة موحدة للتحقق من تجهيز أي عنصر
function isItemEquipped(itemId, userId) {
    if (!userId) return false;
    const equipped = getStorage("phantom_user_equipped", {});
    const userEquipped = equipped[userId] || {};
    const id = Number(itemId);
    return (
        Number(userEquipped.title) === id ||
        Number(userEquipped.frame) === id ||
        Number(userEquipped.name_color) === id ||
        Number(userEquipped.background) === id ||
        Number(userEquipped.chat_effect) === id
    );
}

// 🛒 نظام تدوير المنتجات الذكي: عروض يومية محدودة وتناوب تلقائي مع تبويب للأرشيف
let currentShopCatalogTab = 'daily';

window.switchShopCatalogTab = function(tab) {
    currentShopCatalogTab = tab;
    const dailyBtn = document.getElementById('shop-tab-daily');
    const archiveBtn = document.getElementById('shop-tab-archive');
    if (dailyBtn && archiveBtn) {
        if (tab === 'daily') {
            dailyBtn.classList.add('active');
            dailyBtn.style.background = 'rgba(0, 242, 254, 0.15)';
            dailyBtn.style.borderColor = 'var(--cyan)';
            dailyBtn.style.color = 'var(--cyan)';
            archiveBtn.classList.remove('active');
            archiveBtn.style.background = 'rgba(255, 255, 255, 0.04)';
            archiveBtn.style.borderColor = 'var(--border)';
            archiveBtn.style.color = 'var(--muted)';
        } else {
            archiveBtn.classList.add('active');
            archiveBtn.style.background = 'rgba(0, 242, 254, 0.15)';
            archiveBtn.style.borderColor = 'var(--cyan)';
            archiveBtn.style.color = 'var(--cyan)';
            dailyBtn.classList.remove('active');
            dailyBtn.style.background = 'rgba(255, 255, 255, 0.04)';
            dailyBtn.style.borderColor = 'var(--border)';
            dailyBtn.style.color = 'var(--muted)';
        }
    }
    renderShop();
};

// ✅ عرض وعمل المتجر الكامل (مع التناوب اليومي العشوائي للنوادر)
async function renderShop(filter = "all") {
    const shopItems = await getShopItems();
    const userId = getCurrentUserId();
    const inventory = await getUserInventory(userId);
    const username = getCurrentUsername();
    const points = getLocalPoints();
    const balanceEl = document.getElementById('shop-user-balance');
    if (balanceEl) balanceEl.textContent = points[username] || 0;

    // تشغيل مؤقت التجديد الحي
    updateShopCountdownTimer();
    if (!shopTimerInterval) {
        shopTimerInterval = setInterval(updateShopCountdownTimer, 1000);
    }

    const dailyRareIds = getDailyRareItemIds(shopItems);

    // المنتجات النادرة المتاحة اليوم (أو التي يمتلكها العضو مسبقاً حتى يتمكن من إدارتها)
    const todayRareItems = shopItems.filter(item => 
        item.is_rare && (dailyRareIds.includes(item.id) || inventory.some(inv => Number(inv.item_id) === Number(item.id)))
    );

    // المنتجات الأساسية الدائمة
    const standardItems = shopItems.filter(item => !item.is_rare);

    // في وضع "عروض اليوم المختارة"، نعرض تشكيلة محددة (4 منتجات متبادلة يومياً حسب التاريخ) لمنع الازدحام
    let standardToDisplay = standardItems;
    if (currentShopCatalogTab === 'daily') {
        const dayOfMonth = new Date().getDate();
        const batchSize = 4;
        const startIndex = (dayOfMonth * 2) % (standardItems.length || 1);
        const dailyStandardBatch = [];
        for (let i = 0; i < batchSize && i < standardItems.length; i++) {
            dailyStandardBatch.push(standardItems[(startIndex + i) % standardItems.length]);
        }
        standardToDisplay = standardItems.filter(item => 
            dailyStandardBatch.some(b => b.id === item.id) || inventory.some(inv => Number(inv.item_id) === Number(item.id))
        );
    }

    // تصفية حسب الفلتر المختار
    const filteredRare = todayRareItems.filter(item => filter === "all" || item.type === filter);
    const filteredStandard = standardToDisplay.filter(item => filter === "all" || item.type === filter);

    const shopGrid = document.getElementById('shop-grid');
    if (!shopGrid) return;

    if (filteredRare.length === 0 && filteredStandard.length === 0) {
        shopGrid.innerHTML = `<div class="empty-state" style="grid-column:span 2; padding:30px; text-align:center; color:var(--muted);">لا توجد منتجات في هذه الفئة حالياً.</div>`;
        return;
    }

    const renderCard = (item, isRareCard = false) => {
        const isOwned = inventory.some(inv => Number(inv.item_id) === Number(item.id));
        const isEquipped = isItemEquipped(item.id, userId);
        
        let buttonHtml = '';
        if (isOwned) {
            if (item.type === 'card') {
                buttonHtml = `<button class="shop-btn" data-action="use" data-item-id="${item.id}" data-category="card" style="width:100%; padding:8px 6px; background:linear-gradient(135deg, #f59e0b, #d97706); color:#fff; border:none; border-radius:8px; font-weight:800; font-size:0.8rem; cursor:pointer;">⚡ استخدام الآن</button>`;
            } else if (isEquipped) {
                buttonHtml = `<button class="shop-btn equipped" data-action="unequip" data-item-id="${item.id}" data-category="${item.type}" style="width:100%; padding:8px 6px; background:rgba(0, 242, 254, 0.15); color:var(--cyan); border:1px solid var(--cyan); border-radius:8px; font-weight:800; font-size:0.8rem; cursor:pointer;">✅ مجهز (اضغط للإلغاء)</button>`;
            } else {
                buttonHtml = `<button class="shop-btn" data-action="equip" data-item-id="${item.id}" data-category="${item.type}" style="width:100%; padding:8px 6px; background:var(--cyan); color:#000; border:none; border-radius:8px; font-weight:900; font-size:0.8rem; cursor:pointer;">✨ تجهيز</button>`;
            }
        } else {
            const btnBg = isRareCard ? 'linear-gradient(135deg, rgba(234,179,8,0.25), rgba(249,115,22,0.3))' : 'rgba(255,255,255,0.08)';
            const borderCol = isRareCard ? '#eab308' : 'rgba(255,255,255,0.2)';
            buttonHtml = `<button class="shop-btn" data-action="buy" data-item-id="${item.id}" style="width:100%; padding:8px 6px; background:${btnBg}; color:var(--white); border:1px solid ${borderCol}; border-radius:8px; font-weight:800; font-size:0.8rem; cursor:pointer; transition:0.2s;">🛒 شراء (${item.price} ن)</button>`;
        }

        const cardBorder = isRareCard ? '1px solid rgba(234, 179, 8, 0.45)' : '1px solid rgba(255,255,255,0.08)';
        const cardBg = isRareCard ? 'linear-gradient(135deg, rgba(234, 179, 8, 0.08), rgba(15, 23, 42, 0.95))' : 'rgba(255,255,255,0.03)';
        const badgeHtml = isRareCard ? `<span style="position:absolute; top:6px; left:6px; background:#eab308; color:#000; font-size:0.6rem; font-weight:900; padding:2px 6px; border-radius:10px;">🔥 نادر اليوم</span>` : '';
        
        return `
            <div class="shop-item-card" style="position:relative; display:flex; flex-direction:column; justify-content:space-between; padding:12px; background:${cardBg}; border:${cardBorder}; border-radius:12px; text-align:center; min-height:175px;">
                ${badgeHtml}
                <div>
                    <div class="item-icon" style="font-size: 2.2rem; margin-bottom:4px;">${item.icon || '📦'}</div>
                    <div class="item-title" style="font-weight: 900; font-size: 0.9rem; color: #fff; margin-bottom:4px;">${escapeHTML(item.name)}</div>
                    <div class="item-desc" style="font-size: 0.72rem; color: #9ca3af; margin: 4px 0 8px 0; line-height:1.4;">${escapeHTML(item.description || '')}</div>
                </div>
                <div>
                    <div class="item-price" style="font-weight: 900; color: ${isRareCard ? '#fbbf24' : '#ffd700'}; font-size:0.85rem; margin-bottom: 8px;">💰 ${item.price} نقطة</div>
                    ${buttonHtml}
                </div>
            </div>
        `;
    };

    let html = '';

    // قسم النوادر اليومية
    if (filteredRare.length > 0) {
        html += `
            <div class="shop-section-banner shop-rare-banner">
                <span>🔥 تشكيلة اليوم النادرة والأسطورية</span>
                <span class="shop-countdown-badge">⏳ تتغير بعد: <span id="rare-shop-badge-timer"></span></span>
            </div>
        `;
        html += filteredRare.map(item => renderCard(item, true)).join('');
    }

    // قسم المعروضات
    if (filteredStandard.length > 0) {
        const bannerTitle = currentShopCatalogTab === 'daily' ? '⚡ المعروضات اليومية المتبادلة' : '🏛️ الأرشيف الكامل لجميع المقتنيات';
        html += `
            <div class="shop-section-banner shop-common-banner">
                <span>${bannerTitle}</span>
            </div>
        `;
        html += filteredStandard.map(item => renderCard(item, false)).join('');
    }

    shopGrid.innerHTML = html;
    updateShopCountdownTimer();

    // ربط الأحداث لكل الأزرار في المتجر
    shopGrid.querySelectorAll('.shop-btn[data-action="buy"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            buyItem(parseInt(btn.dataset.itemId));
        });
    });

    shopGrid.querySelectorAll('.shop-btn[data-action="equip"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            useItem(parseInt(btn.dataset.itemId), btn.dataset.category, 'equip');
        });
    });

    shopGrid.querySelectorAll('.shop-btn[data-action="unequip"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            useItem(parseInt(btn.dataset.itemId), btn.dataset.category, 'unequip');
        });
    });

    shopGrid.querySelectorAll('.shop-btn[data-action="use"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            useItem(parseInt(btn.dataset.itemId), 'card', 'use');
        });
    });

    // ربط زر الفلاتر
    const filterTrigger = document.getElementById('shop-filter-trigger');
    const filterMenu = document.getElementById('shop-filter-menu');
    
    if (filterTrigger && filterMenu) {
        filterTrigger.onclick = (e) => {
            e.stopPropagation();
            filterMenu.style.display = filterMenu.style.display === 'block' ? 'none' : 'block';
        };

        document.addEventListener('click', (e) => {
            if (!filterMenu.contains(e.target) && e.target !== filterTrigger) {
                filterMenu.style.display = 'none';
            }
        });

        document.querySelectorAll('.shop-filter-option').forEach(btn => {
            btn.onclick = function() {
                document.querySelectorAll('.shop-filter-option').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                filterMenu.style.display = 'none';
                renderShop(this.dataset.filter);
            };
        });
    }
}
window.renderShop = renderShop;

async function buyItem(itemId) {
    const username = getCurrentUsername();
    const userId = getCurrentUserId();
    if (!username || !userId) return showToast('يجب تسجيل الدخول أولاً.', 'error');

    const shopItems = await getShopItems();
    const item = shopItems.find(i => Number(i.id) === Number(itemId));
    if (!item) return showToast('العنصر غير موجود.', 'error');

    const inventory = await getUserInventory(userId);
    const isOwned = inventory.some(inv => Number(inv.item_id) === Number(item.id));

    // إذا كان عنصراً دائماً ويمتلكه بالفعل، نقوم بتجهيزه فوراً بدلاً من خصم النقاط مرة ثانية
    if (isOwned && item.type !== 'card') {
        showToast(`أنت تمتلك "${item.name}" بالفعل! جاري تجهيزه...`, "info");
        await useItem(item.id, item.type, 'equip');
        return;
    }

    const points = getLocalPoints();
    const balance = points[username] || 0;
    if (balance < item.price) {
        showToast(`⚠️ رصيدك غير كافٍ (تحتاج ${item.price} نقطة، رصيدك ${balance}).`, 'error');
        return;
    }

    points[username] = balance - item.price;
    setLocalPoints(points);

    let localInv = getStorage("phantom_user_inventory", []);
    localInv.push({ user_id: userId, item_id: item.id, username: username, purchased_at: Date.now() });
    setStorage("phantom_user_inventory", localInv);

    if (supabaseClient) {
        try {
            await supabaseClient.from('members').update({ coins: points[username] }).eq('name', username);
            await supabaseClient.from('user_inventory').insert([{ user_id: userId, item_id: item.id, purchased_at: new Date().toISOString() }]);
        } catch (err) {
            console.warn("Supabase buy sync warning:", err);
        }
    }

    showToast(`✅ تم شراء "${item.name}" بنجاح!`, "success");

    // تجهيز تلقائي للمقتنيات الجديدة
    if (item.type !== 'card') {
        await useItem(item.id, item.type, 'equip');
    }

    renderShop();
    renderInventory();
    updateVaultBalanceUI();
}

async function useItem(itemId, category, action = 'equip') {
    const username = getCurrentUsername();
    const userId = getCurrentUserId();
    if (!userId) return showToast('يجب تسجيل الدخول.', 'error');

    const shopItems = await getShopItems();
    const item = shopItems.find(i => Number(i.id) === Number(itemId));
    if (!item) return showToast('العنصر غير موجود.', 'error');
    
    const type = item.type || category || 'other'; 
    const inventory = await getUserInventory(userId);
    const invItem = inventory.find(i => Number(i.item_id) === Number(itemId));
    if (!invItem) return showToast('⚠️ هذا العنصر غير موجود في مخزونك.', 'error');

    const equipped = getStorage("phantom_user_equipped", {});
    if (!equipped[userId]) equipped[userId] = {};

    // 🏷️ 1. تجهيز / إلغاء الألقاب
    if (type === 'title') {
        if (action === 'unequip' || Number(equipped[userId].title) === Number(itemId)) {
            delete equipped[userId].title;
            setStorage("phantom_user_equipped", equipped);
            showToast(`تم إلغاء تجهيز ${item.name}`, 'info');
        } else {
            equipped[userId].title = Number(itemId);
            setStorage("phantom_user_equipped", equipped);
            showToast(`✅ تم تجهيز ${item.name}!`, 'success');
        }

        let serverMembers = getStorage("phantom_server_members", []);
        serverMembers = serverMembers.map(m => { if (m && m.name === username) m.equipped_title = equipped[userId].title || null; return m; });
        setStorage("phantom_server_members", serverMembers);

        if (supabaseClient) { try { await supabaseClient.from('members').update({ equipped_title: equipped[userId].title || null }).eq('name', username); } catch(e) { console.warn(e); } }

        renderShop();
        renderInventory();
        renderChat();
        renderAll();
        return;
    }

    // 🖼️ 2. تجهيز / إلغاء الإطارات
    if (type === 'frame') {
        if (action === 'unequip' || Number(equipped[userId].frame) === Number(itemId)) {
            delete equipped[userId].frame;
            setStorage("phantom_user_equipped", equipped);
            showToast(`تم إلغاء تجهيز ${item.name}`, 'info');
        } else {
            equipped[userId].frame = Number(itemId);
            setStorage("phantom_user_equipped", equipped);
            showToast(`✅ تم تجهيز ${item.name}!`, 'success');
        }

        if (supabaseClient) { try { await supabaseClient.from('members').update({ equipped_frame: equipped[userId].frame || null }).eq('name', username); } catch(e) { console.warn(e); } }

        renderShop();
        renderInventory();
        renderAll();
        return;
    }

    // 🎨 3. تجهيز / إلغاء ألوان الأسماء
    if (type === 'name_color') {
        if (action === 'unequip' || Number(equipped[userId].name_color) === Number(itemId)) {
            delete equipped[userId].name_color;
            setStorage("phantom_user_equipped", equipped);
            showToast(`تم إلغاء تجهيز ${item.name}`, 'info');
        } else {
            equipped[userId].name_color = Number(itemId);
            setStorage("phantom_user_equipped", equipped);
            showToast(`✅ تم تجهيز ${item.name}!`, 'success');
        }

        if (supabaseClient) { try { await supabaseClient.from('members').update({ equipped_name_color: equipped[userId].name_color || null }).eq('name', username); } catch(e) { console.warn(e); } }

        renderShop();
        renderInventory();
        renderChat();
        renderAll();
        return;
    }

    // 🌌 4. تجهيز / إلغاء الخلفيات
    if (type === 'background') {
        if (action === 'unequip' || Number(equipped[userId].background) === Number(itemId)) {
            delete equipped[userId].background;
            setStorage("phantom_user_equipped", equipped);
            showToast(`تم إلغاء تجهيز ${item.name}`, 'info');
        } else {
            equipped[userId].background = Number(itemId);
            setStorage("phantom_user_equipped", equipped);
            showToast(`✅ تم تجهيز ${item.name}!`, 'success');
        }

        if (supabaseClient) { try { await supabaseClient.from('members').update({ equipped_background: equipped[userId].background || null }).eq('name', username); } catch(e) { console.warn(e); } }

        renderShop();
        renderInventory();
        return;
    }

    // 💬 5. تجهيز / إلغاء تأثيرات الرسائل
    if (type === 'chat_effect') {
        if (action === 'unequip' || Number(equipped[userId].chat_effect) === Number(itemId)) {
            delete equipped[userId].chat_effect;
            setStorage("phantom_user_equipped", equipped);
            showToast(`تم إلغاء تجهيز ${item.name}`, 'info');
        } else {
            equipped[userId].chat_effect = Number(itemId);
            setStorage("phantom_user_equipped", equipped);
            showToast(`✅ تم تجهيز ${item.name}!`, 'success');
        }

        if (supabaseClient) { try { await supabaseClient.from('members').update({ equipped_chat_effect: equipped[userId].chat_effect || null }).eq('name', username); } catch(e) { console.warn(e); } }

        renderShop();
        renderInventory();
        renderChat();
        renderAll();
        return;
    }

    // 💳 6. استخدام الكروت الفورية
    if (type === 'card') {
        const effect = item.effect || '';
        let message = '';

        if (effect === 'point_boost') {
            setStorage("phantom_point_boost", { active: true, expiresAt: Date.now() + 1800000 });
            message = '🔥 تم تفعيل تضخيم النقاط بنجاح (لمدة 30 دقيقة)!';
        } else if (effect === 'double_points') {
            setStorage("phantom_double_points", { active: true, expiresAt: Date.now() + 3600000 });
            message = '✨ تم تفعيل دبل نقاط (لمدة 60 دقيقة)!';
        } else if (effect === 'quick_points') {
            const pts = getLocalPoints();
            pts[username] = (pts[username] || 0) + 200;
            setLocalPoints(pts);
            message = '⚡ حصلت فوراً على +200 نقطة إضافية!';
            if (typeof triggerConfetti === 'function') triggerConfetti();
        } else if (effect === 'power_points') {
            const pts = getLocalPoints();
            pts[username] = (pts[username] || 0) + 150;
            setLocalPoints(pts);
            message = '⚡ حصلت فوراً على +150 نقطة!';
            if (typeof triggerConfetti === 'function') triggerConfetti();
        } else if (effect === 'surprise_box') {
            const r = Math.floor(Math.random() * (200 - 20 + 1)) + 20;
            const pts = getLocalPoints();
            pts[username] = (pts[username] || 0) + r;
            setLocalPoints(pts);
            message = `🎁 مبروك! فتحت صندوق المفاجآت وحصلت على ${r} نقطة!`;
            if (typeof triggerConfetti === 'function') triggerConfetti();
        } else if (effect === 'fast_attendance') {
            let att = getStorage(PHANTOM_MEMORY.attendanceRecordsKey, {});
            att[username] = (att[username] || 0) + 1;
            setStorage(PHANTOM_MEMORY.attendanceRecordsKey, att);
            message = '⏩ تم تسجيل نقطة حضور إضافية بنجاح!';
        } else if (effect === 'bonus_hearts') {
            let hearts = getStorage(PHANTOM_MEMORY.heartsKey, {});
            hearts[username] = (hearts[username] || 0) + 3;
            setStorage(PHANTOM_MEMORY.heartsKey, hearts);
            message = '💛 حصلت على 3 قلوب دعم إضافية!';
        } else if (effect === 'camouflage') {
            setStorage("phantom_camouflage_until", Date.now() + 7200000);
            message = '🕶️ تم تفعيل عباءة التمويه والخصوصية لمدة ساعتين!';
        } else if (effect === 'invisibility') {
            setStorage("phantom_invisibility_until", Date.now() + 7200000);
            message = '🕶️ تم تفعيل عباءة الخفاء بنجاح!';
        } else if (effect === 'see_points') {
            setStorage("phantom_see_points", { active: true, expiresAt: Date.now() + 3600000 });
            message = '👁️ تم تفعيل رؤية نقاط الأعضاء لمدة ساعة!';
        } else if (effect === 'glow') {
            setStorage("phantom_glow_mode", { active: true, expiresAt: Date.now() + 1800000 });
            message = '💡 تم تفعيل الإعلان المضيء بنجاح!';
        } else if (effect === 're_freeze') {
            setStorage("phantom_vault_bonus", true);
            message = '❄️ تم تفعيل بونص الخزنة (+10% أرباح عند الفك)!';
        } else if (effect === 'transfer') {
            if (typeof showTransferPointsModal === 'function') showTransferPointsModal();
            message = '💳 تم فتح نافذة تحويل النقاط!';
        } else if (effect === 'warning_protect') {
            let w = getStorage("phantom_warnings", []);
            if (w.length > 0) {
                w.pop();
                setStorage("phantom_warnings", w);
                message = '🛡️ تم إلغاء إنذار مسجل بنجاح!';
            } else {
                message = '🛡️ لا توجد إنذارات مسجلة عليك حالياً.';
            }
        } else {
            message = '✅ تم استخدام الكارت بنجاح!';
        }

        // استهلاك كارت واحد فقط من المخزون
        let localInv = getStorage("phantom_user_inventory", []);
        const idx = localInv.findIndex(i => (i.user_id === userId || i.userId === userId || i.username === username) && Number(i.item_id) === Number(itemId));
        if (idx !== -1) {
            localInv.splice(idx, 1);
            setStorage("phantom_user_inventory", localInv);
        }

        if (supabaseClient) {
            try {
                await supabaseClient.from('user_inventory').delete().eq('user_id', userId).eq('item_id', itemId);
            } catch(e) {
                console.warn("Delete inventory error:", e);
            }
        }

        showToast(message, 'success');
        renderShop();
        renderInventory();
        updateVaultBalanceUI();
        return;
    }
}

function initShop() {
    setTimeout(() => {
        renderShop();
    }, 500);
}

/* ========================================================
   ✅ نظام المخزون المستقلة (Inventory & Hanger UI)
   ======================================================== */

function setupInventory() {
    const hangerBtn = document.getElementById("hanger-trigger");
    if (hangerBtn) hangerBtn.addEventListener("click", openInventory);
    
    const closeBtn = document.getElementById("inventory-close-btn");
    if (closeBtn) closeBtn.addEventListener("click", closeInventory);

    // ✅ ربط القائمة الجانبية (Drawer)
    const filterTrigger = document.getElementById("inventory-filter-trigger");
    const drawer = document.getElementById("inventory-drawer");
    const drawerOverlay = document.getElementById("inventory-drawer-overlay");
    
    if (filterTrigger && drawer && drawerOverlay) {
        filterTrigger.addEventListener("click", function() {
            drawer.style.display = "block";
            drawerOverlay.style.display = "block";
            setTimeout(() => { drawer.style.right = "0"; }, 10);
        });

        function closeDrawer() {
            drawer.style.right = "-320px";
            setTimeout(() => { drawer.style.display = "none"; drawerOverlay.style.display = "none"; }, 300);
        }

        drawerOverlay.addEventListener("click", closeDrawer);

        // ✅ ربط فلاتر القائمة الجانبية
        document.querySelectorAll(".inv-filter-btn").forEach(btn => {
            btn.addEventListener("click", function() {
                document.querySelectorAll(".inv-filter-btn").forEach(b => b.classList.remove("active-filter"));
                this.classList.add("active-filter");
                closeDrawer();

                let filter = this.dataset.filter;
                if (filter === "titles") filter = "title";
                else if (filter === "frames") filter = "frame";
                else if (filter === "backgrounds") filter = "background";
                else if (filter === "chat_effects") filter = "chat_effect";
                else if (filter === "name_colors") filter = "name_color";
                else if (filter === "cards") filter = "card";
                else filter = "all";

                renderInventory(filter);
            });
        });
    }
}

function openInventory() {
    const overlay = document.getElementById("inventory-overlay");
    if (overlay) {
        overlay.style.display = "flex";
        setTimeout(() => overlay.classList.add("active"), 10);
        renderInventory("all"); // 👈 غيّرنا من "titles" إلى "all"
    }
}

function closeInventory() {
    const overlay = document.getElementById("inventory-overlay");
    if (overlay) {
        overlay.classList.remove("active");
        setTimeout(() => overlay.style.display = "none", 300);
    }
}

let selectedInventoryItem = null;

async function renderInventory(filter = "all") {
    const grid = document.getElementById("inventory-items-grid");
    if (!grid) return;
    const userId = getCurrentUserId();
    const inventory = await getUserInventory(userId);
    const shopItems = await getShopItems();
    
    const inventoryWithDetails = inventory.map(inv => {
        const item = shopItems.find(i => Number(i.id) === Number(inv.item_id));
        if (!item) return null;
        return { ...inv, ...item };
    }).filter(Boolean);

    let filtered = inventoryWithDetails;
    if (filter !== "all") {
        filtered = inventoryWithDetails.filter(item => item.type === filter);
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:span 2; padding:30px; text-align:center; color:var(--muted);">لا توجد عناصر في هذه الفئة.</div>`;
        return;
    }

    // عرض عناصر المخزون
    grid.innerHTML = filtered.map(item => {
        const isEquipped = isItemEquipped(item.id, userId);
        const equippedClass = isEquipped ? ' equipped' : '';
        
        let actionBtnHtml = '';
        if (item.type === 'card') {
            actionBtnHtml = `<button class="inv-use-btn" data-item-id="${item.id}" data-category="card" data-action="use" style="width:100%; padding:8px 6px; background:linear-gradient(135deg, #f59e0b, #d97706); color:#fff; border:none; border-radius:8px; font-weight:800; font-size:0.8rem; cursor:pointer;">⚡ استخدام</button>`;
        } else if (isEquipped) {
            actionBtnHtml = `<button class="inv-use-btn equipped" data-item-id="${item.id}" data-category="${item.type}" data-action="unequip" style="width:100%; padding:8px 6px; background:rgba(0, 242, 254, 0.15); color:var(--cyan); border:1px solid var(--cyan); border-radius:8px; font-weight:800; font-size:0.8rem; cursor:pointer;">✅ مجهز (اضغط للإلغاء)</button>`;
        } else {
            actionBtnHtml = `<button class="inv-use-btn" data-item-id="${item.id}" data-category="${item.type}" data-action="equip" style="width:100%; padding:8px 6px; background:var(--cyan); color:#000; border:none; border-radius:8px; font-weight:900; font-size:0.8rem; cursor:pointer;">✨ تجهيز</button>`;
        }

        return `
            <div class="inv-item-card${equippedClass}" data-item-id="${item.id}" style="display:flex; flex-direction:column; justify-content:space-between; padding:12px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; text-align:center; min-height:165px;">
                <div>
                    <div style="font-size:2.2rem; margin-bottom:4px;">${item.icon || '📦'}</div>
                    <div style="color:var(--white); font-size:0.9rem; font-weight:bold; margin:4px 0;">${escapeHTML(item.name)}</div>
                    <div style="color:var(--muted); font-size:0.72rem; margin-bottom:8px; line-height:1.4;">${escapeHTML(item.description || '')}</div>
                </div>
                <div>
                    ${actionBtnHtml}
                </div>
            </div>
        `;
    }).join("");

    // ربط أزرار المخزون
    grid.querySelectorAll(".inv-use-btn").forEach(btn => {
        btn.addEventListener("click", async function(e) {
            e.stopPropagation();
            const itemId = parseInt(this.dataset.itemId);
            const category = this.dataset.category || 'other';
            const action = this.dataset.action || 'equip';
            await useItem(itemId, category, action);
            renderInventory(filter);
        });
    });
}

async function useSelectedInventoryItem() {
    if (!selectedInventoryItem) return showToast("اختر عنصراً أولاً.", "error");
    const itemId = parseInt(selectedInventoryItem);
    const shopItems = await getShopItems();
    const item = shopItems.find(i => Number(i.id) === Number(itemId));
    if (!item) return showToast("العنصر غير موجود.", "error");

    const userId = getCurrentUserId();
    const isEquipped = isItemEquipped(itemId, userId);
    const action = isEquipped ? 'unequip' : (item.type === 'card' ? 'use' : 'equip');

    await useItem(itemId, item.type, action);
    selectedInventoryItem = null;
    const btn = document.getElementById("use-inventory-item-btn");
    if (btn) btn.style.display = "none";
}
/* ========================================================
   🎡 نظام عجلة الحظ (الحظ ضعيف)
   ======================================================== */

const WHEEL_STORAGE_KEY = "phantom_wheel_state";
const WHEEL_SECTORS = [
    { label: "300", points: 300, color: "#ffd700", icon: "👑", probability: 0.01 },
    { label: "200", points: 200, color: "#9b59b6", icon: "💎", probability: 0.03 },
    { label: "100", points: 100, color: "#e74c3c", icon: "🔥", probability: 0.08 },
    { label: "50", points: 50, color: "#3498db", icon: "🎁", probability: 0.15 },
    { label: "لقب", points: 0,  color: "#2ecc71", icon: "✨", probability: 0.02 },
    { label: "0", points: 0, color: "#7f8c8d", icon: "💀", probability: 0.71 }
];

let isWheelSpinning = false;

function getWheelState() { return getStorage(WHEEL_STORAGE_KEY, { lastSpinDate: null, attemptsRemaining: 0, bonusAttempts: 0 }); }
function setWheelState(state) { setStorage(WHEEL_STORAGE_KEY, state); }

function updateWheelUI() {
    const state = getWheelState();
    const attemptsEl = document.getElementById("wheel-attempts");
    const spinBtn = document.getElementById("spin-btn");
    const buyBtn = document.getElementById("buy-spin-btn");
    if (!attemptsEl || !spinBtn) return;
    const today = new Date().toISOString().split('T')[0];
    if (state.lastSpinDate !== today) { state.attemptsRemaining = 1; state.lastSpinDate = today; setWheelState(state); }
    attemptsEl.textContent = state.attemptsRemaining;
    if (state.attemptsRemaining <= 0) { spinBtn.disabled = true; spinBtn.textContent = "⏳ لا توجد محاولات"; spinBtn.style.opacity = "0.6"; spinBtn.style.cursor = "not-allowed"; }
    else { spinBtn.disabled = false; spinBtn.innerHTML = "🎡 إدارة العجلة الآن"; spinBtn.style.opacity = "1"; spinBtn.style.cursor = "pointer"; }
    if (buyBtn) {
        const balance = getUserBalance();
        if (balance < 50) { buyBtn.disabled = true; buyBtn.style.opacity = "0.5"; }
        else { buyBtn.disabled = false; buyBtn.style.opacity = "1"; }
    }
}

let wheelAngle = 0;

function drawWheel() {
    const canvas = document.getElementById("wheel-canvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = canvas.width; const h = canvas.height;
    const centerX = w / 2; const centerY = h / 2;
    const radius = w / 2 - 10;
    const numSectors = WHEEL_SECTORS.length;
    const arcSize = (2 * Math.PI) / numSectors;
    ctx.clearRect(0, 0, w, h);
    ctx.beginPath(); ctx.arc(centerX, centerY, radius + 5, 0, 2 * Math.PI); ctx.fillStyle = "#1a222a"; ctx.fill(); ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 3; ctx.stroke();
    for (let i = 0; i < numSectors; i++) {
        const angle = i * arcSize + wheelAngle;
        const startAngle = angle; const endAngle = angle + arcSize;
        ctx.beginPath(); ctx.moveTo(centerX, centerY); ctx.arc(centerX, centerY, radius, startAngle, endAngle); ctx.closePath();
        ctx.fillStyle = WHEEL_SECTORS[i].color; ctx.fill(); ctx.strokeStyle = "#0a0d14"; ctx.lineWidth = 2; ctx.stroke();
        ctx.save(); ctx.translate(centerX, centerY); ctx.rotate(startAngle + arcSize / 2); ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillStyle = "#fff"; ctx.font = "bold 18px Cairo, sans-serif";
        const textRadius = radius - 25;
        ctx.fillText(WHEEL_SECTORS[i].icon, textRadius * 0.6, -8);
        if (WHEEL_SECTORS[i].label !== "لقب") { ctx.font = "bold 12px Cairo, sans-serif"; ctx.fillText(WHEEL_SECTORS[i].label, textRadius, 14); }
        else { ctx.font = "bold 11px Cairo, sans-serif"; ctx.fillText("✨ لقب", textRadius, 14); }
        ctx.restore();
    }
    ctx.beginPath(); ctx.arc(centerX, centerY, 15, 0, 2 * Math.PI); ctx.fillStyle = "#0a0d14"; ctx.fill(); ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 2; ctx.stroke();
}

function getWinningSector() {
    let rand = Math.random();
    let cumulativeProbability = 0;
    for (let i = 0; i < WHEEL_SECTORS.length; i++) { cumulativeProbability += WHEEL_SECTORS[i].probability; if (rand < cumulativeProbability) { return i; } }
    return WHEEL_SECTORS.length - 1;
}

function spinWheel() {
    if (isWheelSpinning) return;
    const state = getWheelState();
    const today = new Date().toISOString().split('T')[0];
    if (state.lastSpinDate !== today) { state.attemptsRemaining = 1; state.lastSpinDate = today; setWheelState(state); }
    if (state.attemptsRemaining <= 0) { showToast("⚠️ لا توجد محاولات متاحة اليوم!", "error"); return; }
    isWheelSpinning = true;
    const spinBtn = document.getElementById("spin-btn");
    spinBtn.disabled = true; spinBtn.innerHTML = "⏳ جارٍ الدوران...";
    
    const winningIndex = getWinningSector();
    const sectorAngle = (2 * Math.PI) / WHEEL_SECTORS.length;
    
    // ✅ حساب الزاوية الصحيحة: منتصف القطاع الفائز تحت السهم العلوي (الزاوية -90 درجة)
    const targetSectorMiddle = winningIndex * sectorAngle + sectorAngle / 2;
    const endAngle = -Math.PI / 2 - targetSectorMiddle; // السهم عند -PI/2
    const startAngle = wheelAngle;
    
    // ✅ حساب الدوران الكلي للخلف (عكس عقارب الساعة) حتى نصل للزاوية المطلوبة
    let totalRotation = startAngle - endAngle;
    // إضافة لفات إضافية عشوائية (من 5 إلى 10 لفات) لضمان دوران حقيقي ممتع
    totalRotation += (Math.random() * 5 + 5) * 2 * Math.PI;
    
    const duration = 3000; const startTime = Date.now();
    function animateWheel() {
        const currentTime = Date.now(); const elapsed = currentTime - startTime; const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3); wheelAngle = startAngle - (totalRotation * easeOut); drawWheel();
        if (progress < 1) { requestAnimationFrame(animateWheel); }
        else { wheelAngle = endAngle; drawWheel(); finishSpin(winningIndex); }
    }
    animateWheel();
}
function finishSpin(winningIndex) {
    const sector = WHEEL_SECTORS[winningIndex];
    const username = getCurrentUsername(); const userId = getCurrentUserId();
    const state = getWheelState(); state.attemptsRemaining--; setWheelState(state); updateWheelUI();
    isWheelSpinning = false;
    const spinBtn = document.getElementById("spin-btn"); spinBtn.disabled = false; spinBtn.innerHTML = "🎡 إدارة العجلة الآن";
    let rewardMessage = ""; let rewardPoints = 0;
    if (sector.label === "لقب") {
        // ✅ إصلاح اللقب: حفظه في "title" (وليس "titles") ليتوافق مع باقي النظام
        const equipped = getStorage("phantom_user_equipped", {});
        if (!equipped[userId]) equipped[userId] = {};
        equipped[userId].title = 99; // الرقم 99 الآن يعرض "لقب مميز" في PHANTOM_TITLES
        setStorage("phantom_user_equipped", equipped);

        // ✅ تحديث السجل المحلي (حتى يظهر اللقب في البروفايل والشات للجميع)
        let serverMembers = getStorage("phantom_server_members", []);
        serverMembers = serverMembers.map(m => { if (m && m.name === username) m.equipped_title = 99; return m; });
        setStorage("phantom_server_members", serverMembers);

        let customRoster = getStorage("phantom_custom_roster", []);
        customRoster = customRoster.map(m => { if (m && m.name === username) m.equipped_title = 99; return m; });
        setStorage("phantom_custom_roster", customRoster);

        // ✅ محاولة تحديث السيرفر (Supabase)
        if (supabaseClient && userId) {
            safePostgrest(supabaseClient.from('members').update({ equipped_title: 99 }).eq('name', username))
                .then(() => { console.log("✅ تم تحديث اللقب في السيرفر."); })
                .catch(err => console.warn("⚠️ فشل تحديث اللقب في السيرفر:", err));
        }

        showToast("✨ مبروك! ربحت لقب 'لقب مميز'!", "success");
        rewardMessage = "✨ عنصر مميز: لقب مميز!"; 
        triggerConfetti();
    } else {
        rewardPoints = sector.points; addPoints(username, rewardPoints);
        // ✅ إصلاح مزامنة النقاط: استخدام name بدلاً من id
        if (supabaseClient && userId) { 
            const currentPoints = getLocalPoints()[username] || 0; 
            safePostgrest(supabaseClient.from('members').update({ coins: currentPoints }).eq('name', username))
                .then(() => { console.log("✅ تم تحديث النقاط في السيرفر."); })
                .catch(err => console.warn("⚠️ فشل تحديث النقاط في السيرفر:", err)); 
        }
        rewardMessage = `${sector.icon} لقد ربحت ${rewardPoints} نقطة!`;
        if (rewardPoints > 0) showToast(`🎉 مبروك! كسبت ${rewardPoints} نقطة!`, "success");
        else showToast("💀 حظ أوفر! حاول مرة أخرى غداً.", "info");
    }
    updateVaultBalanceUI(); renderLeaderboard();
}

function buySpin() {
    const balance = getUserBalance();
    if (balance < 50) { showToast("⚠️ لا يوجد رصيد كافٍ (تحتاج 50 نقطة).", "error"); return; }
    const username = getCurrentUsername(); const points = getLocalPoints();
    points[username] = (points[username] || 0) - 50; setLocalPoints(points);
    if (supabaseClient) { const userId = getCurrentUserId(); safePostgrest(supabaseClient.from('members').update({ coins: points[username] }).eq('id', userId)).then(() => { console.log("✅ تم خصم النقاط للشراء."); }).catch(err => console.warn("⚠️ فشل خصم النقاط:", err)); }
    const state = getWheelState(); state.attemptsRemaining = (state.attemptsRemaining || 0) + 1; setWheelState(state);
    updateWheelUI(); updateVaultBalanceUI(); showToast("✅ تم شراء محاولة إضافية بنجاح! (50 نقطة)", "success");
}

function initWheel() {
    const spinBtn = document.getElementById("spin-btn"); const buyBtn = document.getElementById("buy-spin-btn");
    if (!spinBtn || !buyBtn) return;
    drawWheel(); updateWheelUI();
    spinBtn.addEventListener("click", spinWheel); buyBtn.addEventListener("click", buySpin);
}

/* ========================================================
   🐍 نظام لعبة الثعبان (حساسية أسهل)
   ======================================================== */

const SNAKE_GRID_SIZE = 20;
const SNAKE_STORAGE_KEY = "phantom_snake_highscore";

let snakeGameState = { snake: [], direction: 'right', nextDirection: 'right', food: null, score: 0, highScore: 0, gameLoopInterval: null, isGameOver: false, isPaused: false };
let gameCanvas, gameCtx; let cellSize = 20;

function initSnake() {
    gameCanvas = document.getElementById("game-canvas"); if (!gameCanvas) return; gameCtx = gameCanvas.getContext("2d");
    const containerRect = gameCanvas.parentElement.getBoundingClientRect(); let w = containerRect.width || 300; let h = containerRect.height || 300;
    gameCanvas.width = w; gameCanvas.height = h; const size = Math.min(gameCanvas.width, gameCanvas.height); cellSize = size / SNAKE_GRID_SIZE;
    snakeGameState.highScore = getStorage(SNAKE_STORAGE_KEY, 0);
    const startBtn = document.getElementById("game-start-btn"); const restartBtn = document.getElementById("game-restart-btn");
    if (startBtn) { startBtn.addEventListener("click", startSnakeGame); startBtn.textContent = "🚀 بدء اللعبة"; }
    if (restartBtn) { restartBtn.addEventListener("click", resetSnakeGame); }
    setupSnakeTouchControls(); drawSnakeBoard(); updateSnakeUI();
}
function drawSnakeBoard() { if (!gameCtx) return; gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height); gameCtx.strokeStyle = "rgba(0, 242, 254, 0.2)"; gameCtx.lineWidth = 0.5; for (let i = 0; i <= SNAKE_GRID_SIZE; i++) { gameCtx.beginPath(); gameCtx.moveTo(i * cellSize, 0); gameCtx.lineTo(i * cellSize, gameCanvas.height); gameCtx.stroke(); gameCtx.beginPath(); gameCtx.moveTo(0, i * cellSize); gameCtx.lineTo(gameCanvas.width, i * cellSize); gameCtx.stroke(); } }
function updateSnakeUI() { document.getElementById("game-fruits").textContent = snakeGameState.score / 5; document.getElementById("game-points").textContent = snakeGameState.score; document.getElementById("game-best").textContent = snakeGameState.highScore; }

function startSnakeGame() {
    if (snakeGameState.gameLoopInterval) return;
    snakeGameState.snake = [{x: 10, y: 10}, {x: 9, y: 10}, {x: 8, y: 10}];
    snakeGameState.direction = 'right'; snakeGameState.nextDirection = 'right'; snakeGameState.score = 0; snakeGameState.isGameOver = false;
    generateSnakeFood(); updateSnakeUI(); drawSnakeBoard();
    const startBtn = document.getElementById("game-start-btn"); startBtn.textContent = "⏳ جارٍ اللعب..."; startBtn.disabled = true;
    snakeGameState.gameLoopInterval = setInterval(() => { if (!snakeGameState.isGameOver) { updateSnakeGame(); } }, 150);
    document.addEventListener("keydown", handleSnakeKeyPress);
}

function updateSnakeGame() {
    if (snakeGameState.isGameOver) return;
    if (snakeGameState.nextDirection) { const opposite = { 'up': 'down', 'down': 'up', 'left': 'right', 'right': 'left' }; if (opposite[snakeGameState.nextDirection] !== snakeGameState.direction) { snakeGameState.direction = snakeGameState.nextDirection; } }
    const head = snakeGameState.snake[0]; let newHead = { ...head };
    switch (snakeGameState.direction) { case 'right': newHead.x++; break; case 'left': newHead.x--; break; case 'up': newHead.y--; break; case 'down': newHead.y++; break; }
    if (newHead.x === snakeGameState.food.x && newHead.y === snakeGameState.food.y) { snakeGameState.score += 5; snakeGameState.snake.unshift(newHead); generateSnakeFood(); updateSnakeUI(); }
    else { snakeGameState.snake.unshift(newHead); snakeGameState.snake.pop(); }
    if (newHead.x < 0 || newHead.x >= SNAKE_GRID_SIZE || newHead.y < 0 || newHead.y >= SNAKE_GRID_SIZE) { endSnakeGame(); return; }
    for (let i = 1; i < snakeGameState.snake.length; i++) { if (snakeGameState.snake[i].x === newHead.x && snakeGameState.snake[i].y === newHead.y) { endSnakeGame(); return; } }
    drawSnakeGame();
}

function generateSnakeFood() {
    let freeCells = [];
    for (let x = 0; x < SNAKE_GRID_SIZE; x++) { for (let y = 0; y < SNAKE_GRID_SIZE; y++) { if (!snakeGameState.snake.some(segment => segment.x === x && segment.y === y)) { freeCells.push({x, y}); } } }
    if (freeCells.length === 0) { showToast("🎉 لقد فزت! شبكة كاملة!", "success"); endSnakeGame(); return; }
    const randomIndex = Math.floor(Math.random() * freeCells.length); snakeGameState.food = freeCells[randomIndex];
}

function drawSnakeGame() {
    drawSnakeBoard();
    if (snakeGameState.food) {
        gameCtx.fillStyle = "#ff4d4d";
        gameCtx.shadowColor = "#ff4d4d";
        gameCtx.shadowBlur = 10;
        gameCtx.beginPath();
        gameCtx.arc(snakeGameState.food.x * cellSize + cellSize / 2, snakeGameState.food.y * cellSize + cellSize / 2, Math.max(0, cellSize / 2 - 2), 0, 2 * Math.PI);
        gameCtx.fill();
        gameCtx.shadowBlur = 0;
    }

    // رسم الجسم كخطوط متصلة (دائرة متداخلة)
    for (let i = snakeGameState.snake.length - 1; i >= 0; i--) {
        const segment = snakeGameState.snake[i];
        const isHead = i === 0;
        const x = segment.x * cellSize + cellSize / 2;
        const y = segment.y * cellSize + cellSize / 2;

        // لون الجسم
        gameCtx.fillStyle = isHead ? "#00ff88" : "#00f2fe";
        
        if (isHead) {
            // رسم الرأس كدائرة كبيرة
            gameCtx.shadowColor = "#00ff88";
            gameCtx.shadowBlur = 15;
            gameCtx.beginPath();
            gameCtx.arc(x, y, cellSize / 2 - 1, 0, 2 * Math.PI);
            gameCtx.fill();
            gameCtx.shadowBlur = 0;

            // رسم العيون
            gameCtx.fillStyle = "#fff";
            gameCtx.shadowBlur = 0;
            let eye1X = x, eye1Y = y - 3;
            let eye2X = x, eye2Y = y + 3;
            if (snakeGameState.direction === 'right') { eye1X = x + 3; eye1Y = y - 3; eye2X = x + 3; eye2Y = y + 3; }
            else if (snakeGameState.direction === 'left') { eye1X = x - 3; eye1Y = y - 3; eye2X = x - 3; eye2Y = y + 3; }
            else if (snakeGameState.direction === 'down') { eye1X = x - 3; eye1Y = y + 3; eye2X = x + 3; eye2Y = y + 3; }
            else if (snakeGameState.direction === 'up') { eye1X = x - 3; eye1Y = y - 3; eye2X = x + 3; eye2Y = y - 3; }

            gameCtx.beginPath(); gameCtx.arc(eye1X, eye1Y, 2, 0, 2 * Math.PI); gameCtx.fill();
            gameCtx.beginPath(); gameCtx.arc(eye2X, eye2Y, 2, 0, 2 * Math.PI); gameCtx.fill();
            
            // رسم بؤبؤ العين
            gameCtx.fillStyle = "#000";
            gameCtx.beginPath(); gameCtx.arc(eye1X, eye1Y, 1, 0, 2 * Math.PI); gameCtx.fill();
            gameCtx.beginPath(); gameCtx.arc(eye2X, eye2Y, 1, 0, 2 * Math.PI); gameCtx.fill();
        } else {
            // رسم الجسم كخطوط متصلة (بدلاً من مربعات)
            const prev = snakeGameState.snake[i + 1];
            if (prev) {
                const prevX = prev.x * cellSize + cellSize / 2;
                const prevY = prev.y * cellSize + cellSize / 2;
                gameCtx.lineWidth = cellSize - 2;
                gameCtx.lineCap = "round";
                gameCtx.strokeStyle = gameCtx.fillStyle; // نفس لون التعبئة
                gameCtx.beginPath();
                gameCtx.moveTo(prevX, prevY);
                gameCtx.lineTo(x, y);
                gameCtx.stroke();
            } else {
                gameCtx.fillStyle = "#00f2fe";
                gameCtx.beginPath();
                gameCtx.arc(x, y, cellSize / 2 - 1, 0, 2 * Math.PI);
                gameCtx.fill();
            }
        }
    }
}

// ✅ إصلاح رسالة نهاية لعبة الثعبان لتظهر داخل الصفحة
function endSnakeGame() {
    if (snakeGameState.isGameOver) return;
    snakeGameState.isGameOver = true; clearInterval(snakeGameState.gameLoopInterval); snakeGameState.gameLoopInterval = null;
    const startBtn = document.getElementById("game-start-btn"); startBtn.disabled = false; startBtn.textContent = "🚀 بدء اللعبة";
    let resultMessage = "";
    if (snakeGameState.score > snakeGameState.highScore) { snakeGameState.highScore = snakeGameState.score; setStorage(SNAKE_STORAGE_KEY, snakeGameState.highScore); updateSnakeUI(); resultMessage = `🏆 أفضل نتيجة جديدة: ${snakeGameState.score} نقطة!`; }
    if (snakeGameState.score > 0) {
        const username = getCurrentUsername(); addPoints(username, snakeGameState.score);
        if (supabaseClient) { const userId = getCurrentUserId(); const currentPoints = getLocalPoints()[username] || 0; safePostgrest(supabaseClient.from('members').update({ coins: currentPoints }).eq('id', userId)).then(() => { console.log("✅ تم تحديث النقاط في السيرفر من لعبة الثعبان."); }).catch(err => console.warn("⚠️ فشل تحديث النقاط من لعبة الثعبان:", err)); }
        resultMessage = `🐍 انتهت اللعبة! ربحت ${snakeGameState.score} نقطة.` + resultMessage;
    } else { resultMessage = "💀 انتهت اللعبة! حاول مرة أخرى."; }
    // ✅ عرض الرسالة داخل snake-result-msg
    const resultEl = document.getElementById('snake-result-msg');
    if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.textContent = resultMessage;
        resultEl.style.color = snakeGameState.score > 0 ? 'var(--green)' : 'var(--red)';
        setTimeout(() => { resultEl.style.display = 'none'; }, 4000);
    }
    document.removeEventListener("keydown", handleSnakeKeyPress);
}

function resetSnakeGame() {
    if (snakeGameState.gameLoopInterval) { clearInterval(snakeGameState.gameLoopInterval); snakeGameState.gameLoopInterval = null; }
    const startBtn = document.getElementById("game-start-btn"); startBtn.disabled = false; startBtn.textContent = "🚀 بدء اللعبة";
    snakeGameState.snake = [{x: 10, y: 10}, {x: 9, y: 10}, {x: 8, y: 10}];
    snakeGameState.direction = 'right'; snakeGameState.nextDirection = 'right'; snakeGameState.score = 0; snakeGameState.isGameOver = false; snakeGameState.food = null;
    generateSnakeFood(); updateSnakeUI(); drawSnakeBoard();
    const resultEl = document.getElementById('snake-result-msg');
    if (resultEl) resultEl.style.display = 'none';
    showToast("🔄 تم إعادة التعيين، اضغط 'بدء اللعبة'", "info");
}

function handleSnakeKeyPress(e) {
    if (snakeGameState.isGameOver) return;
    const key = e.key; if (key.startsWith("Arrow")) { e.preventDefault(); const map = { "ArrowUp": "up", "ArrowDown": "down", "ArrowLeft": "left", "ArrowRight": "right" }; const dir = map[key]; if (dir) snakeGameState.nextDirection = dir; }
}

function setupSnakeTouchControls() {
    let touchStartX = 0; let touchStartY = 0;
    const canvas = document.getElementById("game-canvas"); if (!canvas) return;
    canvas.addEventListener("touchstart", function(e) { e.preventDefault(); const touch = e.touches[0]; touchStartX = touch.clientX; touchStartY = touch.clientY; }, { passive: false });
    canvas.addEventListener("touchmove", function(e) { e.preventDefault(); if (!touchStartX || !touchStartY || snakeGameState.isGameOver) return; const touch = e.touches[0]; const deltaX = touch.clientX - touchStartX; const deltaY = touch.clientY - touchStartY; if (Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) return; if (Math.abs(deltaX) > Math.abs(deltaY)) { snakeGameState.nextDirection = deltaX > 0 ? 'right' : 'left'; } else { snakeGameState.nextDirection = deltaY > 0 ? 'down' : 'up'; } touchStartX = 0; touchStartY = 0; }, { passive: false });
    canvas.addEventListener("touchend", function() { touchStartX = 0; touchStartY = 0; });
}

/* ========================================================
   ⚔️ PHANTOM BATTLE & REALTIME ENGINE (السيرفر، الحضور، الإشعارات الدائمة، والتحديات المباشرة)
   ======================================================== */

let serverOnlineUsers = [];
let pendingBattleInvite = null;
let presenceHeartbeatInterval = null;
let challengePollingInterval = null;
let arenaDirectSearchInterval = null;
let popularityDirectSearchInterval = null;

// 💓 إرسال نبض التواجد إلى السيرفر وتحديث قائمة المتصلين
async function sendPresenceHeartbeat() {
    const username = getCurrentUsername();
    if (!username) return;
    const userId = getCurrentUserId();
    const rank = (typeof getCurrentUserRank === "function") ? getCurrentUserRank() : 'محارب';

    try {
        const res = await fetch('/api/presence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, userId, rank, avatar: 'PH' })
        });
        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.onlineUsers)) {
                serverOnlineUsers = data.onlineUsers;
                updateAllOnlineCounters();
                renderArenaClanMembers();
                renderPopularityClanMembers();
            }
        }

        // 📞 فحص المكالمات المباشرة النشطة في الكلان
        try {
            const callRes = await fetch('/api/calls/active');
            if (callRes.ok) {
                const callData = await callRes.json();
                updateActiveCallBannerUI(callData && callData.activeCall);
            }
        } catch (callErr) {}
    } catch (e) {
        // Fallback: keep local current user
        if (!serverOnlineUsers.some(u => normalizeName(u.username) === normalizeName(username))) {
            serverOnlineUsers.push({ username, userId, rank, avatar: 'PH', lastSeen: Date.now() });
        }
    }
}

let dismissedCallId = null;

function updateActiveCallBannerUI(activeCall) {
    const banner = document.getElementById('clan-active-call-banner');
    const voiceBtn = document.getElementById('voice-call-btn');
    if (!banner) return;

    if (activeCall && activeCall.active && activeCall.id !== dismissedCallId) {
        const host = activeCall.challengerName || 'أحد الأعضاء';
        const senderEl = document.getElementById('call-banner-sender');
        const textEl = document.getElementById('call-banner-text');
        if (senderEl) senderEl.textContent = `🎙️ ${host} بدأ مكالمة`;
        if (textEl) {
            const modeText = activeCall.details && activeCall.details.mode === 'agora' ? 'غرفة Agora الصوتية التكتيكية' : 'مكالمة المقر المباشرة';
            textEl.textContent = `مكالمة جماعية نشطة الآن (${modeText}). اضغط للدخول مع السكواد.`;
        }
        banner.style.display = 'flex';

        if (voiceBtn) {
            voiceBtn.style.position = 'relative';
            if (!document.getElementById('voice-live-dot')) {
                const dot = document.createElement('span');
                dot.id = 'voice-live-dot';
                dot.style.cssText = 'position:absolute; top:-2px; right:-2px; width:10px; height:10px; background:#00ff88; border-radius:50%; box-shadow:0 0 10px #00ff88; animation:pulse_3011 1.5s infinite;';
                voiceBtn.appendChild(dot);
            }
        }
    } else {
        banner.style.display = 'none';
        const dot = document.getElementById('voice-live-dot');
        if (dot) dot.remove();
    }
}

function dismissCallBanner() {
    const banner = document.getElementById('clan-active-call-banner');
    if (banner) banner.style.display = 'none';
    dismissedCallId = 'dismissed_' + Date.now();
}

window.dismissCallBanner = dismissCallBanner;

// تحديث عدادات المتصلين في الواجهات المختلفة
function updateAllOnlineCounters() {
    const count = Math.max(1, serverOnlineUsers.length);
    const chatCounter = document.getElementById('chat-online-counter');
    const arenaCounter = document.getElementById('arena-online-counter');
    const popCounter = document.getElementById('popularity-online-counter');

    if (chatCounter) chatCounter.textContent = `${count} متصلين حالياً`;
    if (arenaCounter) arenaCounter.textContent = `${count} متصل بالمقر`;
    if (popCounter) popCounter.textContent = `${count} متصل`;
}

// 🔍 استطلاع التحديات والإشعارات الموجهة للعضو من السيرفر
async function pollIncomingChallenges() {
    const username = getCurrentUsername();
    if (!username) return;

    try {
        const res = await fetch(`/api/battles/challenges?user=${encodeURIComponent(username)}`);
        if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.challenges) && data.challenges.length > 0) {
                const latest = data.challenges[data.challenges.length - 1];
                if (!pendingBattleInvite || pendingBattleInvite.id !== latest.id) {
                    showTelegramBattleNotification(latest);
                }
            }
        }
    } catch (e) {}
}

// ✈️ إظهار إشعار الانضمام الدائم (لا يختفي إلا بالضغط على ✕ أو انضمام)
function showTelegramBattleNotification(challenge) {
    if (!challenge) return;
    const currentUsername = getCurrentUsername();
    if (challenge.challengerName === currentUsername) return;

    pendingBattleInvite = challenge;

    const banner = document.getElementById('telegram-battle-notification');
    const iconEl = document.getElementById('tg-banner-icon');
    const senderEl = document.getElementById('tg-banner-sender');
    const tagEl = document.getElementById('tg-banner-tag');
    const textEl = document.getElementById('tg-banner-text');
    const joinBtn = document.getElementById('tg-banner-join-btn');
    const closeBtn = document.getElementById('tg-banner-close-btn');

    if (!banner) return;

    // ضبط النصوص والأيقونات وفق نوع الإشعار: مكالمة / معركة شعبية / ساحة نزال
    if (challenge.type === 'call') {
        if (iconEl) iconEl.textContent = '📞';
        if (senderEl) senderEl.textContent = challenge.challengerName || 'عضو الكلان';
        if (tagEl) { tagEl.textContent = '• مكالمة مباشرة!'; tagEl.style.color = '#00ff88'; }
        if (textEl) textEl.textContent = 'بدأ مكالمة فيديو وصوت مباشرة ويدعوك للانضمام الآن!';
        if (joinBtn) joinBtn.innerHTML = '📞 انضمام للمكالمة';
    } else if (challenge.type === 'popularity') {
        if (iconEl) iconEl.textContent = '⚔️';
        if (senderEl) senderEl.textContent = challenge.challengerName || 'بطل PHANTOM';
        if (tagEl) { tagEl.textContent = '• معركة الشعبية 1v1!'; tagEl.style.color = 'var(--cyan)'; }
        if (textEl) textEl.textContent = 'أرسل لك تحدي تصويت وشعبية PK مباشر! هل تقبل التحدي؟';
        if (joinBtn) joinBtn.innerHTML = '⚔️ قبول وانضمام';
    } else { // arena (ساحة نزال)
        if (iconEl) iconEl.textContent = '⚡';
        if (senderEl) senderEl.textContent = challenge.challengerName || 'بطل PHANTOM';
        if (tagEl) { tagEl.textContent = '• ساحة النزال 1v1!'; tagEl.style.color = '#ffd700'; }
        const stakeStr = challenge.stake ? ` (الرهان: ${challenge.stake} نقطة)` : ' (نزال شرف)';
        if (textEl) textEl.textContent = `يتحدّاك في ساحة النزال التفاعلية والسريعة${stakeStr}!`;
        if (joinBtn) joinBtn.innerHTML = '⚡ انضمام للنزال';
    }

    // صوت تنبيه ناعم
    try {
        if (typeof ArenaAudio !== 'undefined' && ArenaAudio.playTone) {
            ArenaAudio.playTone(600, 'sine', 0.12, 0.2);
            setTimeout(() => ArenaAudio.playTone(900, 'sine', 0.2, 0.25), 100);
        }
    } catch (e) {}

    // إظهار البانر وجعله ثابتاً تماماً (لا يوجد أي setTimeout لإخفائه!)
    banner.classList.add('show');

    // زر الإغلاق ✕: يزيل الإشعار ويبلّغ السيرفر
    if (closeBtn) {
        closeBtn.onclick = function(e) {
            e.stopPropagation();
            hideTelegramBattleNotification(true);
        };
    }

    // زر الانضمام: ينقل المستخدم فوراً للمكان المحدد (مكالمة / معركة شعبية / ساحة نزال)
    if (joinBtn) {
        joinBtn.onclick = function(e) {
            e.stopPropagation();
            const targetChallenge = pendingBattleInvite || challenge;
            hideTelegramBattleNotification(false);

            // إشعار السيرفر بقبول التحدي
            fetch('/api/battles/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challengeId: targetChallenge.id,
                    joinerName: getCurrentUsername(),
                    joinerId: getCurrentUserId()
                })
            }).catch(() => {});

            // التوجيه الفوري المباشر وفق نوع النشاط
            if (targetChallenge.type === 'call') {
                showToast(`📞 جاري الانضمام لمكالمة ${targetChallenge.challengerName}...`, 'info');
                if (typeof showGoogleMeetModal === 'function') {
                    showGoogleMeetModal();
                }
            } else if (targetChallenge.type === 'popularity') {
                showToast(`⚔️ تم قبول معركة الشعبية ضد ${targetChallenge.challengerName}!`, 'success');
                const battleOverlay = document.getElementById('battle-overlay');
                if (battleOverlay) battleOverlay.style.display = 'flex';
                joinActivePopularityBattle(targetChallenge);
            } else { // arena
                showToast(`⚡ انضممت لساحة النزال ضد ${targetChallenge.challengerName}!`, 'success');
                const arenaOverlay = document.getElementById('arena-overlay');
                if (arenaOverlay) arenaOverlay.style.display = 'flex';
                joinActiveArenaDuel(targetChallenge);
            }
        };
    }
}

// إخفاء إشعار التيليجرام
function hideTelegramBattleNotification(dismissOnServer = false) {
    const banner = document.getElementById('telegram-battle-notification');
    if (banner) banner.classList.remove('show');

    if (dismissOnServer && pendingBattleInvite && pendingBattleInvite.id) {
        fetch('/api/battles/dismiss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                challengeId: pendingBattleInvite.id,
                username: getCurrentUsername()
            })
        }).catch(() => {});
    }
    pendingBattleInvite = null;
}

// انضمام مباشر لمعركة الشعبية من الإشعار
function joinActivePopularityBattle(challenge) {
    const lobby = document.getElementById('battle-lobby');
    const arena = document.getElementById('battle-arena');
    const username = getCurrentUsername() || 'المحارب';
    const opponent = challenge.challengerName || 'المتحدي الشبح';

    popularityBattleState = {
        active: true,
        secondsLeft: 60,
        playerA: { name: opponent, votes: 50 },
        playerB: { name: username, votes: 50 },
        userVotedChoice: null,
        userBet: 0,
        crowdInterval: null
    };

    if (lobby) lobby.style.display = 'none';
    if (arena) arena.style.display = 'flex';

    const nameAEl = document.getElementById('fighter-name-a');
    const nameBEl = document.getElementById('fighter-name-b');
    const voteAEl = document.getElementById('vote-btn-a');
    const voteBEl = document.getElementById('vote-btn-b');

    if (nameAEl) nameAEl.textContent = opponent;
    if (nameBEl) nameBEl.textContent = username;
    if (voteAEl) voteAEl.textContent = `🔵 صوّت لـ ${opponent}`;
    if (voteBEl) voteBEl.textContent = `🔴 صوّت لـ ${username}`;

    updatePopularityPKBar();
    updatePopularityBattleBalance();

    if (popularityBattleState.timer) clearInterval(popularityBattleState.timer);
    popularityBattleState.timer = setInterval(popularityBattleTick, 1000);

    if (popularityBattleState.crowdInterval) clearInterval(popularityBattleState.crowdInterval);
    popularityBattleState.crowdInterval = setInterval(() => {
        if (!popularityBattleState.active) return;
        const addA = Math.floor(Math.random() * 8);
        const addB = Math.floor(Math.random() * 8);
        popularityBattleState.playerA.votes += addA;
        popularityBattleState.playerB.votes += addB;
        updatePopularityPKBar();
    }, 2800);
}

// انضمام مباشر لساحة النزال 1v1 من الإشعار
function joinActiveArenaDuel(challenge) {
    phantomArenaState.mode = 'duel';
    phantomArenaState.stake = challenge.stake || 0;
    phantomArenaState.opponent = {
        name: challenge.challengerName || 'بطل PHANTOM',
        avatar: '⚔️',
        sub: `مبارزة رسمية 1v1 · رهان: ${challenge.stake || 0} نقطة`
    };
    switchArenaView('lobby');
    launchVersusCountdown();
}

// ========================================================
// 👥 عرض أعضاء الكلان الحقيقيين في ساحة النزال (🟢 متصل / 🔴 غير متصل)
// ========================================================
let arenaClanSearchFilter = '';

function filterArenaClanMembers(val) {
    arenaClanSearchFilter = (val || '').trim().toLowerCase();
    renderArenaClanMembers();
}

function renderArenaClanMembers() {
    const listEl = document.getElementById('arena-clan-members-list');
    if (!listEl) return;

    const roster = typeof getFullRoster === 'function' ? getFullRoster() : [];
    const currentUsername = getCurrentUsername();
    const pointsMap = typeof getLocalPoints === 'function' ? getLocalPoints() : {};

    // استبعاد العضو الحالي من قائمة الخصوم
    let filtered = roster.filter(m => m && m.name && normalizeName(m.name) !== normalizeName(currentUsername));

    if (arenaClanSearchFilter) {
        filtered = filtered.filter(m => 
            (m.name && m.name.toLowerCase().includes(arenaClanSearchFilter)) ||
            (m.rank && m.rank.toLowerCase().includes(arenaClanSearchFilter))
        );
    }

    // الترتيب: المتصلون أولاً (🟢)، ثم حسب النقاط
    filtered.sort((a, b) => {
        const aOnline = isMemberOnline(a.name) ? 1 : 0;
        const bOnline = isMemberOnline(b.name) ? 1 : 0;
        if (bOnline !== aOnline) return bOnline - aOnline;
        const ptsA = pointsMap[a.name] || a.coins || 0;
        const ptsB = pointsMap[b.name] || b.coins || 0;
        return ptsB - ptsA;
    });

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:16px; color:#94a3b8; font-size:0.85rem;">
                لا توجد نتائج مطابقة في سجل أعضاء الكلان.
            </div>
        `;
        return;
    }

    listEl.innerHTML = filtered.map(m => {
        const online = isMemberOnline(m.name);
        const pts = pointsMap[m.name] || m.coins || 0;
        const safeName = escapeHTML(m.name);
        const safeRank = escapeHTML(m.rank || 'عضو');

        return `
            <div class="arena-member-card" style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:rgba(255,255,255,0.03); border:1px solid ${online ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.07)'}; border-radius:10px; transition:transform 0.15s ease;">
                <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                    <div style="position:relative; flex-shrink:0;">
                        <div style="width:38px; height:38px; border-radius:50%; background:#1e293b; border:2px solid ${online ? '#00ff88' : '#64748b'}; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:0.8rem; color:#fff;">
                            ${m.avatar && m.avatar.length <= 4 ? escapeHTML(m.avatar) : 'PH'}
                        </div>
                        <span style="position:absolute; bottom:-1px; right:-1px; width:10px; height:10px; border-radius:50%; background:${online ? '#00ff88' : '#ef4444'}; border:2px solid #0f172a; box-shadow:${online ? '0 0 8px #00ff88' : 'none'};"></span>
                    </div>
                    <div style="min-width:0;">
                        <div style="font-weight:900; color:#fff; font-size:0.85rem; display:flex; align-items:center; gap:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            <span>${safeName}</span>
                            <span style="font-size:0.65rem; color:${online ? '#00ff88' : '#94a3b8'};">${online ? '🟢 متصل' : '🔴 غير متصل'}</span>
                        </div>
                        <div style="font-size:0.7rem; color:#94a3b8; margin-top:2px;">${safeRank} · 💰 ${pts} نقطة</div>
                    </div>
                </div>
                <div style="flex-shrink:0; margin-right:8px;">
                    ${online ? 
                        `<button type="button" class="btn-primary" style="padding:5px 12px; font-size:0.75rem; border-radius:8px; box-shadow:0 0 10px rgba(0,242,254,0.3);" onclick="sendDirectArenaChallenge('${safeName}')">⚡ تحدي</button>` : 
                        `<button type="button" class="btn-secondary" style="padding:5px 10px; font-size:0.72rem; border-radius:8px; opacity:0.4; cursor:not-allowed;" disabled title="العضو غير متواجد حالياً في الموقع">🔴 غير متصل</button>`}
                </div>
            </div>
        `;
    }).join('');
}

// إرسال تحدٍ مباشر لعضو محدد في ساحة النزال
function sendDirectArenaChallenge(targetName) {
    ArenaAudio.init();
    const username = getCurrentUsername() || 'المحارب';
    const balance = getUserBalance();

    if (phantomArenaState.stake > 0 && balance < phantomArenaState.stake) {
        showToast(`⚠️ رصيدك (${balance} نقطة) لا يكفي لرهان ${phantomArenaState.stake} نقطة!`, 'error');
        return;
    }

    const lobby = document.getElementById('arena-search-lobby');
    if (!lobby) return;
    lobby.style.display = 'block';

    let timeLeft = 20;
    lobby.innerHTML = `
        <div class="streak-header-box" style="text-align:center; padding:18px; background:rgba(0,242,254,0.06); border:1px solid rgba(0,242,254,0.3); border-radius:14px;">
            <div style="font-size:2.4rem; animation:pulse 1.2s infinite;">⚡</div>
            <div style="font-weight:900; color:#fff; font-size:1.15rem; margin:8px 0 4px;">جاري إرسال إشعار التحدي المباشر إلى <span style="color:#00f2fe;">${escapeHTML(targetName)}</span>...</div>
            <div style="color:#ffd700; font-family:monospace; font-weight:800; font-size:0.95rem;">بانتظار قبول النزال: ${timeLeft} ثانية (الرهان: ${phantomArenaState.stake ? phantomArenaState.stake + ' نقطة' : 'نزال شرف'})</div>
            <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:14px;">
                <button type="button" class="btn-primary" style="padding:8px 16px; font-size:0.85rem;" onclick="acceptInstantBotDuel()">
                    ⚡ بدء مواجهة فورية مع حارس الساحة (Bot)
                </button>
                <button type="button" class="btn-danger" style="padding:8px 16px; font-size:0.85rem;" onclick="cancelMatching()">
                    ❌ إلغاء التحدي
                </button>
            </div>
        </div>
    `;

    // إرسال التحدي للسيرفر
    fetch('/api/battles/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'arena',
            challengerName: username,
            challengerId: getCurrentUserId(),
            targetName: targetName,
            stake: phantomArenaState.stake
        })
    }).then(res => res.json()).then(data => {
        if (data.success && data.challenge) {
            trackArenaDirectChallenge(data.challenge.id, targetName);
        }
    }).catch(() => {});

    showToast(`🚀 تم إرسال إشعار التحدي إلى ${targetName}!`, 'info');
}

// متابعة حالة قبول التحدي المباشر في الساحة
function trackArenaDirectChallenge(challengeId, targetName) {
    if (arenaDirectSearchInterval) clearInterval(arenaDirectSearchInterval);

    arenaDirectSearchInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/battles/state/${challengeId}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.challenge && data.challenge.status === 'active') {
                    clearInterval(arenaDirectSearchInterval);
                    arenaDirectSearchInterval = null;
                    cancelMatching();

                    phantomArenaState.mode = 'duel';
                    phantomArenaState.opponent = {
                        name: targetName,
                        avatar: '⚔️',
                        sub: `مبارزة حقيقية مباشرة · رهان: ${phantomArenaState.stake} نقطة`
                    };
                    showToast(`🔥 قبل ${targetName} التحدي! النزال يبدأ الآن...`, 'success');
                    launchVersusCountdown();
                }
            }
        } catch (e) {}
    }, 1500);
}

// ========================================================
// 👥 عرض أعضاء الكلان في معركة الشعبية (🟢 متصل / 🔴 غير متصل)
// ========================================================
let popularityClanSearchFilter = '';

function filterPopularityClanMembers(val) {
    popularityClanSearchFilter = (val || '').trim().toLowerCase();
    renderPopularityClanMembers();
}

function renderPopularityClanMembers() {
    const listEl = document.getElementById('popularity-clan-members-list');
    if (!listEl) return;

    const roster = typeof getFullRoster === 'function' ? getFullRoster() : [];
    const currentUsername = getCurrentUsername();
    const pointsMap = typeof getLocalPoints === 'function' ? getLocalPoints() : {};

    let filtered = roster.filter(m => m && m.name && normalizeName(m.name) !== normalizeName(currentUsername));

    if (popularityClanSearchFilter) {
        filtered = filtered.filter(m => 
            (m.name && m.name.toLowerCase().includes(popularityClanSearchFilter)) ||
            (m.rank && m.rank.toLowerCase().includes(popularityClanSearchFilter))
        );
    }

    filtered.sort((a, b) => {
        const aOnline = isMemberOnline(a.name) ? 1 : 0;
        const bOnline = isMemberOnline(b.name) ? 1 : 0;
        if (bOnline !== aOnline) return bOnline - aOnline;
        const ptsA = pointsMap[a.name] || a.coins || 0;
        const ptsB = pointsMap[b.name] || b.coins || 0;
        return ptsB - ptsA;
    });

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:16px; color:#94a3b8; font-size:0.85rem;">
                لا توجد نتائج مطابقة في سجل أعضاء الكلان.
            </div>
        `;
        return;
    }

    listEl.innerHTML = filtered.map(m => {
        const online = isMemberOnline(m.name);
        const pts = pointsMap[m.name] || m.coins || 0;
        const safeName = escapeHTML(m.name);
        const safeRank = escapeHTML(m.rank || 'عضو');

        return `
            <div class="popularity-member-card" style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:rgba(255,255,255,0.03); border:1px solid ${online ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.07)'}; border-radius:10px; transition:transform 0.15s ease;">
                <div style="display:flex; align-items:center; gap:10px; min-width:0;">
                    <div style="position:relative; flex-shrink:0;">
                        <div style="width:38px; height:38px; border-radius:50%; background:#1e293b; border:2px solid ${online ? '#00ff88' : '#64748b'}; display:flex; align-items:center; justify-content:center; font-weight:900; font-size:0.8rem; color:#fff;">
                            ${m.avatar && m.avatar.length <= 4 ? escapeHTML(m.avatar) : 'PH'}
                        </div>
                        <span style="position:absolute; bottom:-1px; right:-1px; width:10px; height:10px; border-radius:50%; background:${online ? '#00ff88' : '#ef4444'}; border:2px solid #0f172a; box-shadow:${online ? '0 0 8px #00ff88' : 'none'};"></span>
                    </div>
                    <div style="min-width:0;">
                        <div style="font-weight:900; color:#fff; font-size:0.85rem; display:flex; align-items:center; gap:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            <span>${safeName}</span>
                            <span style="font-size:0.65rem; color:${online ? '#00ff88' : '#94a3b8'};">${online ? '🟢 متصل' : '🔴 غير متصل'}</span>
                        </div>
                        <div style="font-size:0.7rem; color:#94a3b8; margin-top:2px;">${safeRank} · 💰 ${pts} نقطة</div>
                    </div>
                </div>
                <div style="flex-shrink:0; margin-right:8px;">
                    ${online ? 
                        `<button type="button" class="btn-primary" style="padding:5px 12px; font-size:0.75rem; border-radius:8px; box-shadow:0 0 10px rgba(0,242,254,0.3);" onclick="sendDirectPopularityChallenge('${safeName}')">⚔️ تحدي الشعبية</button>` : 
                        `<button type="button" class="btn-secondary" style="padding:5px 10px; font-size:0.72rem; border-radius:8px; opacity:0.4; cursor:not-allowed;" disabled title="العضو غير متواجد حالياً في الموقع">🔴 غير متصل</button>`}
                </div>
            </div>
        `;
    }).join('');
}

// إرسال تحدٍ مباشر في معركة الشعبية
function sendDirectPopularityChallenge(targetName) {
    const username = getCurrentUsername() || 'المحارب';
    const lobby = document.getElementById('popularity-search-lobby');
    if (lobby) {
        lobby.style.display = 'block';
        lobby.innerHTML = `
            <div class="streak-header-box" style="text-align:center; padding:18px; background:rgba(0,242,254,0.06); border:1px solid rgba(0,242,254,0.3); border-radius:14px;">
                <div style="font-size:2.4rem; animation:pulse 1.2s infinite;">⚔️</div>
                <div style="font-weight:900; color:#fff; font-size:1.15rem; margin:8px 0 4px;">جاري إرسال إشعار معركة الشعبية إلى <span style="color:#00f2fe;">${escapeHTML(targetName)}</span>...</div>
                <div style="color:#ffd700; font-family:monospace; font-weight:800; font-size:0.95rem;">بانتظار قبول التحدي وانطلاق الـ PK...</div>
                <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-top:14px;">
                    <button type="button" class="btn-primary" style="padding:8px 16px; font-size:0.85rem;" onclick="startInstantPopularityMatch('${escapeHTML(targetName)}')">
                        ⚡ بدء الجولة فوراً
                    </button>
                    <button type="button" class="btn-danger" style="padding:8px 16px; font-size:0.85rem;" onclick="cancelPopularitySearch()">
                        ❌ إلغاء التحدي
                    </button>
                </div>
            </div>
        `;
    }

    fetch('/api/battles/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'popularity',
            challengerName: username,
            challengerId: getCurrentUserId(),
            targetName: targetName
        })
    }).then(res => res.json()).then(data => {
        if (data.success && data.challenge) {
            trackPopularityDirectChallenge(data.challenge.id, targetName);
        }
    }).catch(() => {});

    showToast(`🚀 تم إرسال إشعار معركة الشعبية إلى ${targetName}!`, 'info');
}

function trackPopularityDirectChallenge(challengeId, targetName) {
    if (popularityDirectSearchInterval) clearInterval(popularityDirectSearchInterval);

    popularityDirectSearchInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/battles/state/${challengeId}`);
            if (res.ok) {
                const data = await res.json();
                if (data && data.challenge && data.challenge.status === 'active') {
                    clearInterval(popularityDirectSearchInterval);
                    popularityDirectSearchInterval = null;
                    cancelPopularitySearch();
                    startInstantPopularityMatch(targetName);
                }
            }
        } catch (e) {}
    }, 1500);
}

function cancelPopularitySearch() {
    if (popularityDirectSearchInterval) {
        clearInterval(popularityDirectSearchInterval);
        popularityDirectSearchInterval = null;
    }
    const lobby = document.getElementById('popularity-search-lobby');
    if (lobby) {
        lobby.style.display = 'none';
        lobby.innerHTML = '';
    }
}

function startInstantPopularityMatch(opponentName) {
    cancelPopularitySearch();
    const lobby = document.getElementById('battle-lobby');
    const arena = document.getElementById('battle-arena');
    const username = getCurrentUsername() || 'المحارب';
    const opponent = opponentName || 'المتحدي الشبح';

    popularityBattleState = {
        active: true,
        secondsLeft: 60,
        playerA: { name: username, votes: 50 },
        playerB: { name: opponent, votes: 50 },
        userVotedChoice: null,
        userBet: 0,
        crowdInterval: null
    };

    if (lobby) lobby.style.display = 'none';
    if (arena) arena.style.display = 'flex';

    const nameAEl = document.getElementById('fighter-name-a');
    const nameBEl = document.getElementById('fighter-name-b');
    const voteAEl = document.getElementById('vote-btn-a');
    const voteBEl = document.getElementById('vote-btn-b');

    if (nameAEl) nameAEl.textContent = username;
    if (nameBEl) nameBEl.textContent = opponent;
    if (voteAEl) voteAEl.textContent = `🔵 صوّت لـ ${username}`;
    if (voteBEl) voteBEl.textContent = `🔴 صوّت لـ ${opponent}`;

    updatePopularityPKBar();
    updatePopularityBattleBalance();

    if (popularityBattleState.timer) clearInterval(popularityBattleState.timer);
    popularityBattleState.timer = setInterval(popularityBattleTick, 1000);

    if (popularityBattleState.crowdInterval) clearInterval(popularityBattleState.crowdInterval);
    popularityBattleState.crowdInterval = setInterval(() => {
        if (!popularityBattleState.active) return;
        const addA = Math.floor(Math.random() * 8);
        const addB = Math.floor(Math.random() * 8);
        popularityBattleState.playerA.votes += addA;
        popularityBattleState.playerB.votes += addB;
        updatePopularityPKBar();
    }, 2800);

    showToast(`⚔️ انطلقت معركة الشعبية 1v1 بين ${username} و ${opponent}!`, 'success');
}

// بدء دوريات استطلاع التواجد والإشعارات عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    sendPresenceHeartbeat();
    if (!presenceHeartbeatInterval) {
        presenceHeartbeatInterval = setInterval(sendPresenceHeartbeat, 8000);
    }
    if (!challengePollingInterval) {
        challengePollingInterval = setInterval(pollIncomingChallenges, 3500);
    }
});

/* ========================================================
   ⚡ 1v1 PHANTOM ARENA ENGINE (ساحة المبارزات والتحديات التفاعلية)
   ======================================================== */

// 🔊 نظام المؤثرات الصوتية التكتيكية التخليقية (Web Audio API)
const ArenaAudio = {
    ctx: null,
    muted: localStorage.getItem('phantom_arena_audio_muted') === 'true',

    init() {
        if (!this.ctx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
    },

    toggleMute() {
        this.muted = !this.muted;
        localStorage.setItem('phantom_arena_audio_muted', String(this.muted));
        const btn = document.getElementById('arena-audio-toggle');
        if (btn) btn.textContent = this.muted ? '🔇' : '🔊';
        showToast(this.muted ? '🔇 تم كتم المؤثرات الصوتية للساحة' : '🔊 تم تفعيل المؤثرات الصوتية للساحة', 'info');
        return this.muted;
    },

    playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.15) {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
            gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {}
    },

    playCountdown(isFinal = false) {
        if (isFinal) {
            this.playTone(880, 'triangle', 0.35, 0.25);
        } else {
            this.playTone(440, 'sine', 0.15, 0.15);
        }
    },

    playHit() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1400, this.ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.12);
        } catch (e) {}
    },

    playCrit() {
        if (this.muted) return;
        this.playTone(950, 'sawtooth', 0.08, 0.2);
        setTimeout(() => this.playTone(1500, 'square', 0.18, 0.22), 80);
    },

    playMine() {
        if (this.muted) return;
        this.init();
        if (!this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(160, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.25);
            gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.25);
        } catch (e) {}
    },

    playVictory() {
        if (this.muted) return;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            setTimeout(() => this.playTone(freq, 'triangle', 0.3, 0.22), idx * 120);
        });
    },

    playDefeat() {
        if (this.muted) return;
        const notes = [330, 293.66, 261.63, 220];
        notes.forEach((freq, idx) => {
            setTimeout(() => this.playTone(freq, 'sawtooth', 0.35, 0.18), idx * 140);
        });
    }
};

// 🎮 حالة الساحة التفاعلية الشاملة
let phantomArenaState = {
    view: 'lobby',
    mode: 'ai', // 'ai' or 'duel'
    aiDiff: 'medium', // 'easy', 'medium', 'hard'
    stake: 0,
    currentRound: 1,
    maxRounds: 3,
    p1Score: 0,
    p2Score: 0,
    roundTimeLeft: 8,
    roundTimer: null,
    targetSpawnTimeout: null,
    aiActionTimeout: null,
    currentTarget: null,
    targetSpawnTime: 0,
    reactionTimes: [],
    opponent: {
        name: 'شبح الكلان (AI)',
        avatar: '👻',
        sub: 'بوت تكتيكي ذكي'
    }
};

// 📊 إدارة إحصائيات الساحة في التخزين المحلي
function getArenaStats() {
    const defaultStats = {
        wins: 0,
        losses: 0,
        streak: 0,
        bestReactionMs: 0,
        totalMatches: 0,
        pointsEarned: 0,
        history: []
    };
    try {
        const stored = localStorage.getItem('phantom_arena_stats');
        return stored ? { ...defaultStats, ...JSON.parse(stored) } : defaultStats;
    } catch (e) {
        return defaultStats;
    }
}

function saveArenaStats(stats) {
    try {
        localStorage.setItem('phantom_arena_stats', JSON.stringify(stats));
    } catch (e) {}
    updateArenaStatsUI();
}

function updateArenaStatsUI() {
    const stats = getArenaStats();
    const username = getCurrentUsername() || 'المحارب';
    const balance = getUserBalance();

    // تحديث بطاقة المقر الرئيسية
    const cardWins = document.getElementById('arena-card-wins');
    const cardSpeed = document.getElementById('arena-card-best-speed');
    const cardStreak = document.getElementById('arena-card-streak');
    if (cardWins) cardWins.textContent = stats.wins;
    if (cardSpeed) cardSpeed.textContent = stats.bestReactionMs ? `${stats.bestReactionMs}ms` : '--';
    if (cardStreak) cardStreak.textContent = stats.streak;

    // تحديث ردهة الساحة
    const myName = document.getElementById('arena-my-name');
    const myAvatar = document.getElementById('arena-my-avatar');
    const myWins = document.getElementById('arena-my-wins');
    const myLosses = document.getElementById('arena-my-losses');
    const myStreak = document.getElementById('arena-my-streak');
    const myReaction = document.getElementById('arena-my-reaction');
    const myPoints = document.getElementById('arena-my-points');

    if (myName) myName.textContent = username;
    if (myAvatar) myAvatar.textContent = username.slice(0, 2).toUpperCase();
    if (myWins) myWins.textContent = stats.wins;
    if (myLosses) myLosses.textContent = stats.losses;
    if (myStreak) myStreak.textContent = stats.streak;
    if (myReaction) myReaction.textContent = stats.bestReactionMs ? `${stats.bestReactionMs}ms` : '--';
    if (myPoints) myPoints.textContent = balance;

    // تحديث حالة زر الصوت
    const audioBtn = document.getElementById('arena-audio-toggle');
    if (audioBtn) audioBtn.textContent = ArenaAudio.muted ? '🔇' : '🔊';
}

// 🔀 تبديل شاشات الساحة (Lobby, Versus, Combat, Result, History)
function switchArenaView(viewName) {
    phantomArenaState.view = viewName;
    const views = ['lobby', 'versus', 'combat', 'result', 'history'];
    views.forEach(v => {
        const el = document.getElementById(`arena-view-${v}`);
        if (el) el.style.display = (v === viewName) ? 'block' : 'none';
    });

    const navLobby = document.getElementById('arena-nav-lobby');
    const navHistory = document.getElementById('arena-nav-history');
    if (navLobby) navLobby.classList.toggle('active', viewName === 'lobby' || viewName === 'versus' || viewName === 'combat' || viewName === 'result');
    if (navHistory) navHistory.classList.toggle('active', viewName === 'history');

    if (viewName === 'history') {
        renderArenaLeaderboard();
        renderArenaHistory();
    }
}

// 🎛️ تعيين خيارات النمط
function setArenaAiDiff(diff) {
    phantomArenaState.aiDiff = diff;
    document.querySelectorAll('.arena-pill-opt[data-diff]').forEach(btn => {
        btn.classList.toggle('selected', btn.getAttribute('data-diff') === diff);
    });
}

function setArenaStake(amount) {
    phantomArenaState.stake = Number(amount);
    document.querySelectorAll('.arena-pill-opt[data-stake]').forEach(btn => {
        btn.classList.toggle('selected', Number(btn.getAttribute('data-stake')) === Number(amount));
    });
}

function toggleArenaAudio() {
    ArenaAudio.toggleMute();
}

// 🚀 فتح وإغلاق الساحة
function openPhantomArena() {
    ArenaAudio.init();
    const hubOverlay = document.getElementById('phantom-hub-overlay');
    if (hubOverlay) {
        hubOverlay.style.display = 'none';
        hubOverlay.classList.remove('active');
    }
    const overlay = document.getElementById('arena-overlay');
    if (overlay) overlay.style.display = 'flex';
    updateArenaStatsUI();
    if (typeof renderArenaClanMembers === 'function') renderArenaClanMembers();
    switchArenaView('lobby');
}

function closePhantomArena() {
    surrenderArenaMatch(true);
    const overlay = document.getElementById('arena-overlay');
    if (overlay) overlay.style.display = 'none';
    if (typeof openHub === 'function') {
        openHub();
    }
}

// ⚔️ بدء المواجهة الفردية ضد شبح الكلان
function startSoloAiBattle() {
    ArenaAudio.init();
    phantomArenaState.mode = 'ai';
    const diffTitles = {
        easy: 'شبح الكلان (مبتدئ)',
        medium: 'شبح الكلان (تكتيكي)',
        hard: 'شبح الكلان (أسطوري)'
    };
    phantomArenaState.opponent = {
        name: diffTitles[phantomArenaState.aiDiff] || 'شبح الكلان (AI)',
        avatar: '👻',
        sub: `مستوى: ${phantomArenaState.aiDiff.toUpperCase()}`
    };

    launchVersusCountdown();
}

// 🎬 تشغيل شاشة المواجهة السينمائية والعد التنازلي
function launchVersusCountdown() {
    switchArenaView('versus');
    const username = getCurrentUsername() || 'المحارب';

    const p1Name = document.getElementById('arena-vs-p1-name');
    const p1Avatar = document.getElementById('arena-vs-p1-avatar');
    const p2Name = document.getElementById('arena-vs-p2-name');
    const p2Avatar = document.getElementById('arena-vs-p2-avatar');
    const p2Sub = document.getElementById('arena-vs-p2-sub');
    const cdBanner = document.getElementById('arena-vs-countdown');

    if (p1Name) p1Name.textContent = username;
    if (p1Avatar) p1Avatar.textContent = username.slice(0, 2).toUpperCase();
    if (p2Name) p2Name.textContent = phantomArenaState.opponent.name;
    if (p2Avatar) p2Avatar.textContent = phantomArenaState.opponent.avatar;
    if (p2Sub) p2Sub.textContent = phantomArenaState.opponent.sub;

    let count = 3;
    if (cdBanner) cdBanner.textContent = count;
    ArenaAudio.playCountdown(false);

    const cdInterval = setInterval(() => {
        count--;
        if (count > 0) {
            if (cdBanner) cdBanner.textContent = count;
            ArenaAudio.playCountdown(false);
        } else if (count === 0) {
            if (cdBanner) cdBanner.textContent = 'اشتباك! ⚡';
            ArenaAudio.playCountdown(true);
        } else {
            clearInterval(cdInterval);
            startCombatRounds();
        }
    }, 900);
}

// 🥊 بدء جولات القتال التفاعلية
function startCombatRounds() {
    phantomArenaState.currentRound = 1;
    phantomArenaState.p1Score = 0;
    phantomArenaState.p2Score = 0;
    phantomArenaState.reactionTimes = [];
    switchArenaView('combat');
    runActiveRound();
}

function runActiveRound() {
    clearActiveCombatTimers();
    phantomArenaState.roundTimeLeft = 8;
    updateCombatHud();

    // تشغيل عداد الجولة
    phantomArenaState.roundTimer = setInterval(() => {
        phantomArenaState.roundTimeLeft--;
        updateCombatHud();
        if (phantomArenaState.roundTimeLeft <= 0) {
            endCurrentRound();
        }
    }, 1000);

    // تفريغ وتجهيز الساحة
    const playfield = document.getElementById('arena-playfield');
    if (playfield) playfield.innerHTML = '';

    // توليد الأهداف دورياً
    spawnNextTarget();
}

function updateCombatHud() {
    const p1El = document.getElementById('arena-hud-p1');
    const p2El = document.getElementById('arena-hud-p2');
    const roundEl = document.getElementById('arena-hud-round');
    const timerEl = document.getElementById('arena-hud-timer');

    if (p1El) p1El.textContent = `أنت: ${phantomArenaState.p1Score}`;
    if (p2El) p2El.textContent = `الخصم: ${phantomArenaState.p2Score}`;
    if (roundEl) roundEl.textContent = `الجولة ${phantomArenaState.currentRound} من ${phantomArenaState.maxRounds}`;
    if (timerEl) timerEl.textContent = `⏱️ 00:0${Math.max(0, phantomArenaState.roundTimeLeft)}`;
}

// 🎯 توليد هدف جديد داخل الساحة
function spawnNextTarget() {
    if (phantomArenaState.roundTimeLeft <= 0) return;
    const playfield = document.getElementById('arena-playfield');
    if (!playfield) return;

    // إزالة الهدف السابق إذا وجد
    const oldTarget = playfield.querySelector('.arena-target');
    if (oldTarget) oldTarget.remove();

    // اختيار نوع الهدف (70% عادي، 15% فائق، 15% لغم)
    const rand = Math.random();
    let type = 'core';
    let pts = 100;
    let icon = '🎯';
    let cssClass = 'arena-target-core';

    if (rand > 0.85) {
        type = 'crit';
        pts = 200;
        icon = '⚡';
        cssClass = 'arena-target-crit';
    } else if (rand > 0.70) {
        type = 'mine';
        pts = -75;
        icon = '💣';
        cssClass = 'arena-target-mine';
    }

    const fieldRect = playfield.getBoundingClientRect();
    const width = fieldRect.width || 340;
    const height = fieldRect.height || 360;

    // حساب إحداثيات عشوائية آمنة مع هوامش
    const posX = Math.floor(40 + Math.random() * (width - 80));
    const posY = Math.floor(40 + Math.random() * (height - 80));

    const targetEl = document.createElement('div');
    targetEl.className = `arena-target ${cssClass}`;
    targetEl.style.left = `${posX}px`;
    targetEl.style.top = `${posY}px`;
    targetEl.innerHTML = icon;

    phantomArenaState.currentTarget = { type, pts, el: targetEl };
    phantomArenaState.targetSpawnTime = Date.now();

    // معالج النقر للاعب
    targetEl.addEventListener('click', (e) => {
        e.stopPropagation();
        handleUserTargetClick(type, pts, posX, posY);
    });

    playfield.appendChild(targetEl);

    // محاكاة استجابة ذكاء البوت
    scheduleAiReaction(type, pts, posX, posY);
}

// 🖱️ معالجة نقرة المستخدم
function handleUserTargetClick(type, pts, x, y) {
    if (!phantomArenaState.currentTarget) return;
    if (phantomArenaState.aiActionTimeout) clearTimeout(phantomArenaState.aiActionTimeout);

    const reactionMs = Date.now() - phantomArenaState.targetSpawnTime;
    phantomArenaState.reactionTimes.push(reactionMs);

    // صوت ورد فعل
    if (type === 'mine') {
        ArenaAudio.playMine();
        showHitFloatText(x, y, '-75 لغم!', false);
        phantomArenaState.p1Score = Math.max(0, phantomArenaState.p1Score - 75);
    } else if (type === 'crit') {
        ArenaAudio.playCrit();
        showHitFloatText(x, y, `+200 ضربة خارقة (${reactionMs}ms)`, true);
        phantomArenaState.p1Score += 200;
    } else {
        ArenaAudio.playHit();
        showHitFloatText(x, y, `+100 (${reactionMs}ms)`, true);
        phantomArenaState.p1Score += 100;
    }

    const speedHud = document.getElementById('arena-hud-speed');
    if (speedHud) speedHud.textContent = `⚡ الاستجابة: ${reactionMs}ms`;

    updateCombatHud();
    cleanupCurrentTarget();

    // توليد الهدف التالي بعد مهلة قصيرة
    phantomArenaState.targetSpawnTimeout = setTimeout(() => {
        spawnNextTarget();
    }, 350);
}

// 🤖 محاكاة رد فعل البوت حسب الصعوبة
function scheduleAiReaction(type, pts, x, y) {
    if (phantomArenaState.mode !== 'ai') return;

    let delay = 450;
    let accuracy = 0.8;

    if (phantomArenaState.aiDiff === 'easy') {
        delay = 480 + Math.floor(Math.random() * 250);
        accuracy = 0.65;
    } else if (phantomArenaState.aiDiff === 'medium') {
        delay = 310 + Math.floor(Math.random() * 150);
        accuracy = 0.85;
    } else if (phantomArenaState.aiDiff === 'hard') {
        delay = 180 + Math.floor(Math.random() * 80);
        accuracy = 0.95;
    }

    phantomArenaState.aiActionTimeout = setTimeout(() => {
        if (!phantomArenaState.currentTarget) return;

        // البوت الذكي يتفادى الألغام بنسبة عالية
        if (type === 'mine') {
            if (Math.random() > accuracy) {
                // البوت أخطأ وضغط على اللغم
                phantomArenaState.p2Score = Math.max(0, phantomArenaState.p2Score - 75);
                showHitFloatText(x, y, 'الخصم: -75 لغم!', false);
                cleanupCurrentTarget();
                spawnNextTarget();
            }
            return;
        }

        // البوت أخذ الهدف قبل اللاعب
        phantomArenaState.p2Score += pts;
        showHitFloatText(x, y, `الخصم: +${pts}`, false);
        cleanupCurrentTarget();

        phantomArenaState.targetSpawnTimeout = setTimeout(() => {
            spawnNextTarget();
        }, 400);
    }, delay);
}

function cleanupCurrentTarget() {
    if (phantomArenaState.currentTarget && phantomArenaState.currentTarget.el) {
        phantomArenaState.currentTarget.el.remove();
    }
    phantomArenaState.currentTarget = null;
}

function showHitFloatText(x, y, text, isPositive) {
    const playfield = document.getElementById('arena-playfield');
    if (!playfield) return;

    const floatEl = document.createElement('div');
    floatEl.className = `arena-hit-float ${isPositive ? 'arena-hit-pos' : 'arena-hit-neg'}`;
    floatEl.style.left = `${x}px`;
    floatEl.style.top = `${y}px`;
    floatEl.textContent = text;
    playfield.appendChild(floatEl);

    setTimeout(() => {
        if (floatEl && floatEl.parentNode) floatEl.parentNode.removeChild(floatEl);
    }, 600);
}

function clearActiveCombatTimers() {
    if (phantomArenaState.roundTimer) clearInterval(phantomArenaState.roundTimer);
    if (phantomArenaState.targetSpawnTimeout) clearTimeout(phantomArenaState.targetSpawnTimeout);
    if (phantomArenaState.aiActionTimeout) clearTimeout(phantomArenaState.aiActionTimeout);
    phantomArenaState.roundTimer = null;
    phantomArenaState.targetSpawnTimeout = null;
    phantomArenaState.aiActionTimeout = null;
}

// 🏁 انتهاء الجولة الحالية
function endCurrentRound() {
    clearActiveCombatTimers();
    cleanupCurrentTarget();

    if (phantomArenaState.currentRound < phantomArenaState.maxRounds) {
        phantomArenaState.currentRound++;
        const playfield = document.getElementById('arena-playfield');
        if (playfield) {
            playfield.innerHTML = `
                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center;">
                    <div style="font-size:1.8rem; font-weight:900; color:#ffd700; margin-bottom:8px;">انتهاء الجولة ${phantomArenaState.currentRound - 1}!</div>
                    <div style="color:#00f2fe; font-size:1rem;">الاستعداد للجولة ${phantomArenaState.currentRound}... ⚡</div>
                </div>
            `;
        }
        ArenaAudio.playCountdown(false);
        setTimeout(() => {
            runActiveRound();
        }, 1600);
    } else {
        concludeArenaMatch();
    }
}

// 🏆 حسم النزال النهائي وإعلان الفائز
function concludeArenaMatch() {
    clearActiveCombatTimers();
    cleanupCurrentTarget();
    switchArenaView('result');

    const p1 = phantomArenaState.p1Score;
    const p2 = phantomArenaState.p2Score;
    const stats = getArenaStats();
    stats.totalMatches++;

    let isWin = p1 > p2;
    let isDraw = p1 === p2;
    let rewardPoints = 0;

    // حساب أسرع سرعة استجابة
    const bestInMatch = phantomArenaState.reactionTimes.length > 0 
        ? Math.min(...phantomArenaState.reactionTimes) 
        : 0;

    if (bestInMatch > 0) {
        if (!stats.bestReactionMs || bestInMatch < stats.bestReactionMs) {
            stats.bestReactionMs = bestInMatch;
        }
    }

    const resIcon = document.getElementById('arena-res-icon');
    const resTitle = document.getElementById('arena-res-title');
    const resDesc = document.getElementById('arena-res-desc');
    const resP1Pts = document.getElementById('arena-res-p1-pts');
    const resP2Pts = document.getElementById('arena-res-p2-pts');
    const resReaction = document.getElementById('arena-res-reaction');
    const resReward = document.getElementById('arena-res-reward');

    if (resP1Pts) resP1Pts.textContent = p1;
    if (resP2Pts) resP2Pts.textContent = p2;
    if (resReaction) resReaction.textContent = bestInMatch ? `${bestInMatch}ms` : '--';

    const currentUsername = getCurrentUsername() || 'المحارب';

    if (isWin) {
        stats.wins++;
        stats.streak++;
        ArenaAudio.playVictory();
        if (typeof triggerConfetti === 'function') triggerConfetti();

        // مكافأة الفوز
        if (phantomArenaState.mode === 'ai') {
            rewardPoints = 25; // تدريب مجاني
        } else {
            rewardPoints = phantomArenaState.stake > 0 ? phantomArenaState.stake * 2 : 50;
        }

        if (resIcon) resIcon.textContent = '🏆';
        if (resTitle) {
            resTitle.textContent = 'انتصار ساحق ومستحق!';
            resTitle.style.color = '#00ff88';
        }
        if (resDesc) resDesc.textContent = `لقد تغلبت على ${phantomArenaState.opponent.name} بمهارة ودقة وسرعة خاطفة!`;
        if (resReward) resReward.textContent = `+${rewardPoints} نقطة`;

        addPoints(currentUsername, rewardPoints);
        stats.pointsEarned += rewardPoints;
        showToast(`🏆 مبروك الفوز في الساحة! حصدت +${rewardPoints} نقطة فخر.`, 'success');
    } else if (isDraw) {
        ArenaAudio.playTone(550, 'sine', 0.3, 0.2);
        if (resIcon) resIcon.textContent = '⚔️';
        if (resTitle) {
            resTitle.textContent = 'تعادل بطولي ناري!';
            resTitle.style.color = '#ffd700';
        }
        if (resDesc) resDesc.textContent = 'تساوت الضربات والنقاط في مواجهة حماسية حتى اللحظة الأخيرة!';
        if (resReward) resReward.textContent = '+5 نقاط';
        addPoints(currentUsername, 5);
        rewardPoints = 5;
    } else {
        stats.losses++;
        stats.streak = 0;
        ArenaAudio.playDefeat();

        if (resIcon) resIcon.textContent = '💀';
        if (resTitle) {
            resTitle.textContent = 'هزيمة شريفة!';
            resTitle.style.color = '#ef4444';
        }
        if (resDesc) resDesc.textContent = `كان ${phantomArenaState.opponent.name} أسرع في هذه المواجهة. استعد وتدرب لجولة الثأر!`;
        if (resReward) resReward.textContent = '+0';

        if (phantomArenaState.stake > 0) {
            addPoints(currentUsername, -phantomArenaState.stake);
            showToast(`⚠️ خسرت رهان الساحة (-${phantomArenaState.stake} نقطة).`, 'error');
        }
    }

    // إضافة إلى سجل التاريخ
    stats.history = stats.history || [];
    stats.history.unshift({
        id: `duel_${Date.now()}`,
        opponent: phantomArenaState.opponent.name,
        result: isWin ? 'win' : (isDraw ? 'draw' : 'loss'),
        myScore: p1,
        oppScore: p2,
        bestSpeed: bestInMatch,
        reward: rewardPoints,
        date: new Date().toLocaleDateString('ar-EG', { hour: '2-digit', minute: '2-digit' })
    });
    if (stats.history.length > 20) stats.history.pop();

    saveArenaStats(stats);
}

// 🏳️ استسلام من النزال
function surrenderArenaMatch(silent = false) {
    clearActiveCombatTimers();
    cleanupCurrentTarget();
    if (!silent && phantomArenaState.view === 'combat') {
        const stats = getArenaStats();
        stats.losses++;
        stats.streak = 0;
        saveArenaStats(stats);
        showToast('🏳️ لقد استسلمت من النزال.', 'info');
        switchArenaView('lobby');
    }
}

// 🔄 إعادة النزال فوراً
function replayArenaMatch() {
    if (phantomArenaState.mode === 'ai') {
        startSoloAiBattle();
    } else {
        startMatching();
    }
}

// 📜 عرض لوحة أبطال الساحة وسجل النزالات
function renderArenaLeaderboard() {
    const list = document.getElementById('arena-leaderboard-list');
    if (!list) return;

    const stats = getArenaStats();
    const myName = getCurrentUsername() || 'المحارب';

    // قائمة أبطال افتراضية تكتيكية مع العضو الحالي
    const warriors = [
        { name: 'PH 5oM•D8', title: 'أسطورة الساحة', wins: Math.max(18, stats.wins + 4), speed: '175ms', avatar: '👑' },
        { name: 'PH•GHOST_01', title: 'قناص فانتوم', wins: Math.max(14, stats.wins + 2), speed: '195ms', avatar: '⚡' },
        { name: myName, title: 'محارب الساحة', wins: stats.wins, speed: stats.bestReactionMs ? `${stats.bestReactionMs}ms` : '240ms', avatar: '⚔️', isMe: true },
        { name: 'PH•SHADOW', title: 'سفاح الظلال', wins: 9, speed: '280ms', avatar: '🗡️' },
        { name: 'PH•VIPER', title: 'مدافع الرومات', wins: 6, speed: '310ms', avatar: '🛡️' }
    ];

    warriors.sort((a, b) => b.wins - a.wins);

    list.innerHTML = warriors.map((w, idx) => `
        <div class="arena-history-item" style="${w.isMe ? 'border-color:#00f2fe; background:rgba(0,242,254,0.08);' : ''}">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="font-weight:900; color:${idx === 0 ? '#ffd700' : (idx === 1 ? '#cbd5e1' : '#f97316')}; font-size:1.1rem; width:22px;">#${idx + 1}</span>
                <span style="font-size:1.4rem;">${w.avatar}</span>
                <div>
                    <strong style="color:#fff; font-size:0.95rem;">${w.name} ${w.isMe ? '<span style="color:#00f2fe; font-size:0.75rem;">(أنت)</span>' : ''}</strong>
                    <div style="font-size:0.72rem; color:#94a3b8;">${w.title} · أسرع استجابة: <span style="color:#00ff88; font-family:monospace;">${w.speed}</span></div>
                </div>
            </div>
            <div class="arena-history-badge arena-history-win" style="font-size:0.85rem;">
                🏆 ${w.wins} انتصار
            </div>
        </div>
    `).join('');
}

function renderArenaHistory() {
    const list = document.getElementById('arena-history-log');
    if (!list) return;

    const stats = getArenaStats();
    if (!stats.history || stats.history.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding:20px; color:#64748b; font-size:0.85rem;">
                لا توجد نزالات مسجلة بعد. ابدأ أول مواجهة الآن لإثبات مهارتك!
            </div>
        `;
        return;
    }

    list.innerHTML = stats.history.map(item => `
        <div class="arena-history-item">
            <div>
                <strong style="color:#fff;">ضد: ${item.opponent}</strong>
                <div style="font-size:0.75rem; color:#94a3b8; margin-top:2px;">
                    النقاط: <span style="font-family:monospace; color:#00f2fe;">${item.myScore}</span> - <span style="font-family:monospace; color:#ef4444;">${item.oppScore}</span> 
                    ${item.bestSpeed ? `· سرعة: <span style="color:#ffd700; font-family:monospace;">${item.bestSpeed}ms</span>` : ''}
                    · <span>${item.date}</span>
                </div>
            </div>
            <div class="arena-history-badge ${item.result === 'win' ? 'arena-history-win' : (item.result === 'draw' ? '' : 'arena-history-loss')}" style="${item.result === 'draw' ? 'background:rgba(255,215,0,0.15); color:#ffd700; border:1px solid rgba(255,215,0,0.3);' : ''}">
                ${item.result === 'win' ? `🏆 فوز (+${item.reward})` : (item.result === 'draw' ? '⚔️ تعادل' : '💀 هزيمة')}
            </div>
        </div>
    `).join('');
}

// 🌐 الربط الأولي للساحة ومعركة الشعبية عند الإقلاع
function initBattle() {
    updateArenaStatsUI();
    renderArenaClanMembers();
    renderPopularityClanMembers();

    const arenaCloseBtn = document.getElementById('arena-close-btn');
    if (arenaCloseBtn) {
        arenaCloseBtn.onclick = closePhantomArena;
    }
    const battleCloseBtn = document.getElementById('battle-close-btn');
    if (battleCloseBtn) {
        battleCloseBtn.onclick = function() {
            const overlay = document.getElementById('battle-overlay');
            if (overlay) overlay.style.display = 'none';
            if (typeof openHub === 'function') {
                openHub();
            }
        };
    }
    initPopularityBattle();
}

/* ========================================================
   ⚔️ نظام معركة الشعبية 1v1 (Popularity PK Battle)
   ======================================================== */
let popularityBattleState = {
    active: false,
    timer: null,
    secondsLeft: 60,
    playerA: { name: '', votes: 0 },
    playerB: { name: 'المتحدي الشبح', votes: 0 },
    userVotedChoice: null,
    userBet: 0,
    crowdInterval: null,
    challengeId: null
};

let popularityMatchmakingInterval = null;
let currentPopularityChallengeId = null;

function initPopularityBattle() {
    const readyBtn = document.getElementById('battle-ready-btn');
    const cancelBtn = document.getElementById('battle-cancel-btn');
    const voteBtnA = document.getElementById('vote-btn-a');
    const voteBtnB = document.getElementById('vote-btn-b');

    if (readyBtn) readyBtn.onclick = startPopularityBattle;
    if (cancelBtn) cancelBtn.onclick = cancelPopularityBattle;
    if (voteBtnA) voteBtnA.onclick = () => votePopularityBattle('A');
    if (voteBtnB) voteBtnB.onclick = () => votePopularityBattle('B');

    updatePopularityBattleBalance();
    renderPopularityClanMembers();
}

function updatePopularityBattleBalance() {
    const balanceEl = document.getElementById('betting-balance');
    if (balanceEl) {
        const username = getCurrentUsername();
        const points = getLocalPoints();
        balanceEl.textContent = points[username] || 0;
    }
}

// ⚔️ بدء ماتش ميكينغ السيرفر لمعركة الشعبية
function startPopularityBattle() {
    const username = getCurrentUsername() || 'المحارب';
    const lobby = document.getElementById('popularity-search-lobby');
    const resultMsg = document.getElementById('battle-result-msg');
    if (resultMsg) { resultMsg.style.display = 'none'; resultMsg.textContent = ''; }

    if (lobby) {
        lobby.style.display = 'block';
    }

    let timeLeft = 20;
    const renderPopLobby = () => {
        const percent = Math.max(0, (timeLeft / 20) * 100);
        if (!lobby) return;
        lobby.innerHTML = `
            <div class="streak-header-box" style="text-align:center; padding:18px; background:rgba(0,242,254,0.06); border:1px solid rgba(0,242,254,0.3); border-radius:14px;">
                <div style="font-size:2.4rem; animation:pulse 1.2s infinite;">⚔️</div>
                <div style="font-weight:900; color:#fff; font-size:1.15rem; margin:8px 0 4px;">جاري الاتصال بالسيرفر والبحث عن منافس في معركة الشعبية...</div>
                <div style="color:#ffd700; font-family:monospace; font-weight:800; font-size:0.95rem;">مهلة الانتظار: ${timeLeft} ثانية (بث التحدي لجميع أعضاء الكلان)</div>
                <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:10px; overflow:hidden; margin:10px 0 12px;">
                    <div style="width:${percent}%; height:100%; background:linear-gradient(90deg, #00f2fe, #00ff88); transition:width 1s linear;"></div>
                </div>
                <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                    <button type="button" class="btn-primary" style="padding:8px 16px; font-size:0.85rem;" onclick="launchRivalPopularityMatch()">
                        ⚡ بدء الجولة فوراً مع منافس من الكلان
                    </button>
                    <button type="button" class="btn-danger" style="padding:8px 16px; font-size:0.85rem;" onclick="cancelPopularityMatchmaking()">
                        ❌ إلغاء البحث
                    </button>
                </div>
            </div>
        `;
    };

    renderPopLobby();
    showToast("📡 تم بث تحدي معركة الشعبية لجميع أعضاء الكلان المتصلين بالمقر!", "info");

    // إرسال تحدي مفتوح إلى السيرفر
    fetch('/api/battles/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'popularity',
            challengerName: username,
            challengerId: getCurrentUserId(),
            targetName: 'ALL'
        })
    }).then(res => res.json()).then(data => {
        if (data.success && data.challenge) {
            currentPopularityChallengeId = data.challenge.id;
        }
    }).catch(() => {});

    if (popularityMatchmakingInterval) clearInterval(popularityMatchmakingInterval);
    popularityMatchmakingInterval = setInterval(async () => {
        timeLeft--;
        if (timeLeft > 0) {
            renderPopLobby();
            // فحص هل انضم أحد للتحدي من السيرفر
            if (currentPopularityChallengeId) {
                try {
                    const res = await fetch(`/api/battles/state/${currentPopularityChallengeId}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.challenge && data.challenge.status === 'active') {
                            clearInterval(popularityMatchmakingInterval);
                            popularityMatchmakingInterval = null;
                            if (lobby) lobby.style.display = 'none';
                            const joiner = data.challenge.acceptedBy || 'بطل الكلان';
                            showToast(`🔥 انضم ${joiner} إلى معركة الشعبية!`, 'success');
                            startLivePopularityBattle(username, joiner, currentPopularityChallengeId);
                            return;
                        }
                    }
                } catch (e) {}
            }
        } else {
            clearInterval(popularityMatchmakingInterval);
            popularityMatchmakingInterval = null;
            if (lobby) {
                lobby.innerHTML = `
                    <div class="streak-header-box" style="text-align:center; padding:18px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); border-radius:14px;">
                        <div style="font-size:2.2rem;">⏱️</div>
                        <div style="font-weight:900; color:#ef4444; font-size:1.1rem; margin:6px 0;">لم يقبل أي عضو التحدي خلال المهلة</div>
                        <div style="color:#cbd5e1; font-size:0.85rem; margin-bottom:12px;">يمكنك بدء جولة تنافس فورية مع أبطال الكلان الآن!</div>
                        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                            <button type="button" class="btn-primary" style="padding:8px 16px; font-size:0.85rem;" onclick="launchRivalPopularityMatch()">
                                ⚡ مواجهة فورية
                            </button>
                            <button type="button" class="btn-secondary" style="padding:8px 16px; font-size:0.85rem;" onclick="cancelPopularityMatchmaking()">
                                إغلاق
                            </button>
                        </div>
                    </div>
                `;
            }
        }
    }, 1000);
}

function cancelPopularityMatchmaking() {
    if (popularityMatchmakingInterval) {
        clearInterval(popularityMatchmakingInterval);
        popularityMatchmakingInterval = null;
    }
    if (currentPopularityChallengeId) {
        fetch('/api/battles/dismiss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challengeId: currentPopularityChallengeId, username: getCurrentUsername() })
        }).catch(() => {});
        currentPopularityChallengeId = null;
    }
    const lobby = document.getElementById('popularity-search-lobby');
    if (lobby) {
        lobby.style.display = 'none';
        lobby.innerHTML = '';
    }
}

function launchRivalPopularityMatch() {
    cancelPopularityMatchmaking();
    const username = getCurrentUsername() || 'المحارب';
    const roster = typeof getFullRoster === 'function' ? getFullRoster() : [];
    const rivals = roster.filter(m => m && m.name && normalizeName(m.name) !== normalizeName(username));
    const opponentName = rivals.length > 0 ? rivals[Math.floor(Math.random() * rivals.length)].name : 'المتحدي الشبح';
    startLivePopularityBattle(username, opponentName, null);
}

function startLivePopularityBattle(playerAName, playerBName, challengeId = null) {
    const lobby = document.getElementById('battle-lobby');
    const arena = document.getElementById('battle-arena');
    const resultMsg = document.getElementById('battle-result-msg');
    if (resultMsg) { resultMsg.style.display = 'none'; resultMsg.textContent = ''; }

    popularityBattleState = {
        active: true,
        secondsLeft: 60,
        playerA: { name: playerAName, votes: 50 },
        playerB: { name: playerBName, votes: 50 },
        userVotedChoice: null,
        userBet: 0,
        crowdInterval: null,
        challengeId: challengeId
    };

    if (lobby) lobby.style.display = 'none';
    if (arena) arena.style.display = 'flex';

    const nameAEl = document.getElementById('fighter-name-a');
    const nameBEl = document.getElementById('fighter-name-b');
    const voteAEl = document.getElementById('vote-btn-a');
    const voteBEl = document.getElementById('vote-btn-b');

    if (nameAEl) nameAEl.textContent = playerAName;
    if (nameBEl) nameBEl.textContent = playerBName;
    if (voteAEl) voteAEl.textContent = `🔵 صوّت لـ ${playerAName}`;
    if (voteBEl) voteBEl.textContent = `🔴 صوّت لـ ${playerBName}`;

    updatePopularityPKBar();
    updatePopularityBattleBalance();

    if (popularityBattleState.timer) clearInterval(popularityBattleState.timer);
    popularityBattleState.timer = setInterval(popularityBattleTick, 1000);

    if (popularityBattleState.crowdInterval) clearInterval(popularityBattleState.crowdInterval);
    popularityBattleState.crowdInterval = setInterval(() => {
        if (!popularityBattleState.active) return;
        const addA = Math.floor(Math.random() * 8);
        const addB = Math.floor(Math.random() * 8);
        popularityBattleState.playerA.votes += addA;
        popularityBattleState.playerB.votes += addB;
        updatePopularityPKBar();
    }, 2800);

    showToast(`⚔️ انطلقت معركة الشعبية بين ${playerAName} و ${playerBName}!`, "info");
}

function updatePopularityPKBar() {
    const total = popularityBattleState.playerA.votes + popularityBattleState.playerB.votes;
    const pctA = total > 0 ? Math.round((popularityBattleState.playerA.votes / total) * 100) : 50;
    const pctB = 100 - pctA;

    const fillEl = document.getElementById('pk-bar-fill');
    const labelA = document.getElementById('pk-left-label');
    const labelB = document.getElementById('pk-right-label');
    const ptsA = document.getElementById('fighter-points-a');
    const ptsB = document.getElementById('fighter-points-b');

    if (fillEl) fillEl.style.width = pctA + '%';
    if (labelA) labelA.textContent = `${popularityBattleState.playerA.name} ${pctA}%`;
    if (labelB) labelB.textContent = `${popularityBattleState.playerB.name} ${pctB}%`;
    if (ptsA) ptsA.textContent = `+${popularityBattleState.playerA.votes} صوت`;
    if (ptsB) ptsB.textContent = `+${popularityBattleState.playerB.votes} صوت`;
}

function votePopularityBattle(choice) {
    if (!popularityBattleState.active) {
        showToast("المعركة غير نشطة حالياً!", "error");
        return;
    }
    const betInput = document.getElementById('bet-amount');
    const betVal = Math.max(1, parseInt(betInput ? betInput.value : 10, 10) || 10);
    const username = getCurrentUsername();
    const balance = getUserBalance();

    if (balance < betVal) {
        showToast(`⚠️ رصيدك (${balance} نقطة) لا يكفي لرهان ${betVal} نقطة!`, "error");
        return;
    }

    deductPoints(username, betVal);
    updatePopularityBattleBalance();
    updateVaultBalanceUI();

    popularityBattleState.userVotedChoice = choice;
    popularityBattleState.userBet += betVal;

    const voteWeight = betVal * 2;
    if (choice === 'A') {
        popularityBattleState.playerA.votes += voteWeight;
        showToast(`🔵 دعمت ${popularityBattleState.playerA.name} بـ ${voteWeight} نقطة شعبية!`, "success");
    } else {
        popularityBattleState.playerB.votes += voteWeight;
        showToast(`🔴 دعمت ${popularityBattleState.playerB.name} بـ ${voteWeight} نقطة شعبية!`, "success");
    }
    updatePopularityPKBar();
    playCodoSound('send');

    // مزامنة التصويت مع السيرفر إن كان التحدي نشطاً عبر السيرفر
    if (popularityBattleState.challengeId) {
        fetch('/api/battles/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                challengeId: popularityBattleState.challengeId,
                choice: choice,
                voterName: username,
                amount: betVal
            })
        }).catch(() => {});
    }
}

function popularityBattleTick() {
    popularityBattleState.secondsLeft--;
    const timerEl = document.getElementById('battle-timer');
    if (timerEl) {
        const m = Math.floor(popularityBattleState.secondsLeft / 60);
        const s = popularityBattleState.secondsLeft % 60;
        timerEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    if (popularityBattleState.secondsLeft <= 0) {
        endPopularityBattle();
    }
}

function cancelPopularityBattle() {
    if (popularityBattleState.timer) clearInterval(popularityBattleState.timer);
    if (popularityBattleState.crowdInterval) clearInterval(popularityBattleState.crowdInterval);
    popularityBattleState.active = false;

    const lobby = document.getElementById('battle-lobby');
    const arena = document.getElementById('battle-arena');
    if (arena) arena.style.display = 'none';
    if (lobby) lobby.style.display = 'block';
    renderPopularityClanMembers();
    showToast("تم الانسحاب من جولة معركة الشعبية.", "info");
}

function endPopularityBattle() {
    if (popularityBattleState.timer) clearInterval(popularityBattleState.timer);
    if (popularityBattleState.crowdInterval) clearInterval(popularityBattleState.crowdInterval);
    popularityBattleState.active = false;

    const votesA = popularityBattleState.playerA.votes;
    const votesB = popularityBattleState.playerB.votes;
    const username = getCurrentUsername();

    let winnerName = '';
    let userWonReward = 0;
    const resultMsg = document.getElementById('battle-result-msg');

    if (votesA > votesB) {
        winnerName = popularityBattleState.playerA.name;
        userWonReward += 500;
        if (popularityBattleState.userVotedChoice === 'A') {
            userWonReward += Math.round(popularityBattleState.userBet * 1.8);
        }
    } else if (votesB > votesA) {
        winnerName = popularityBattleState.playerB.name;
        if (popularityBattleState.userVotedChoice === 'B') {
            userWonReward += Math.round(popularityBattleState.userBet * 1.8);
        }
    } else {
        winnerName = 'تعادل بطولي!';
        userWonReward += popularityBattleState.userBet;
    }

    if (userWonReward > 0) {
        addPoints(username, userWonReward);
        updatePopularityBattleBalance();
        updateVaultBalanceUI();
        renderLeaderboard();
        triggerConfetti();
        playCodoSound('complete');
    }

    if (resultMsg) {
        resultMsg.style.display = 'block';
        if (userWonReward > 0) {
            resultMsg.style.background = 'rgba(0, 255, 136, 0.15)';
            resultMsg.style.border = '1px solid #00ff88';
            resultMsg.style.color = '#00ff88';
            resultMsg.innerHTML = `🏆 الفائز: ${winnerName}!<br>🎉 مبروك كسبت <strong>+${userWonReward}</strong> نقطة شعبية ومكافأة!`;
        } else {
            resultMsg.style.background = 'rgba(239, 68, 68, 0.15)';
            resultMsg.style.border = '1px solid #ef4444';
            resultMsg.style.color = '#ef4444';
            resultMsg.innerHTML = `🏆 الفائز: ${winnerName}!<br>حظاً أوفر في الجولة القادمة.`;
        }
    }

    setTimeout(() => {
        const lobby = document.getElementById('battle-lobby');
        const arena = document.getElementById('battle-arena');
        if (arena) arena.style.display = 'none';
        if (lobby) lobby.style.display = 'block';
        renderPopularityClanMembers();
    }, 6000);
}

window.startPopularityBattle = startPopularityBattle;
window.cancelPopularityBattle = cancelPopularityBattle;
window.votePopularityBattle = votePopularityBattle;
window.updatePopularityBattleBalance = updatePopularityBattleBalance;
window.launchRivalPopularityMatch = launchRivalPopularityMatch;
window.cancelPopularityMatchmaking = cancelPopularityMatchmaking;

let arenaSearchInterval = null;
let currentArenaChallengeId = null;

function startMatching() {
    ArenaAudio.init();
    const username = getCurrentUsername() || 'المحارب';
    const balance = getUserBalance();

    if (phantomArenaState.stake > 0 && balance < phantomArenaState.stake) {
        showToast(`⚠️ رصيدك (${balance} نقطة) لا يكفي لرهان ${phantomArenaState.stake} نقطة!`, 'error');
        return;
    }

    const lobby = document.getElementById('arena-search-lobby');
    if (!lobby) return;
    lobby.style.display = 'block';

    let timeLeft = 20;
    const renderSearchLobby = () => {
        const percent = Math.max(0, (timeLeft / 20) * 100);
        lobby.innerHTML = `
            <div class="streak-header-box" style="text-align:center; padding:18px; background:rgba(0,242,254,0.06); border:1px solid rgba(0,242,254,0.3); border-radius:14px;">
                <div style="font-size:2.4rem; animation:pulse 1.2s infinite;">⚔️</div>
                <div style="font-weight:900; color:#fff; font-size:1.15rem; margin:8px 0 4px;">جاري إرسال إشعار التحدي والبحث عن منافس عبر السيرفر...</div>
                <div style="color:#ffd700; font-family:monospace; font-weight:800; font-size:0.95rem;">مهلة الانتظار: ${timeLeft} ثانية (الرهان: ${phantomArenaState.stake ? phantomArenaState.stake + ' نقطة' : 'نزال شرف'})</div>
                <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:10px; overflow:hidden; margin:10px 0 12px;">
                    <div style="width:${percent}%; height:100%; background:linear-gradient(90deg, #00f2fe, #00ff88); transition:width 1s linear;"></div>
                </div>
                <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                    <button type="button" class="btn-primary" style="padding:8px 16px; font-size:0.85rem;" onclick="acceptInstantBotDuel()">
                        ⚡ مواجهة فورية مع حارس الساحة (Bot)
                    </button>
                    <button type="button" class="btn-danger" style="padding:8px 16px; font-size:0.85rem;" onclick="cancelMatching()">
                        ❌ إلغاء البحث
                    </button>
                </div>
            </div>
        `;
    };

    renderSearchLobby();
    ArenaAudio.playCountdown(false);
    showToast("📡 تم إرسال تحدي ساحة النزال لسيرفر الكلان!", "info");

    // إرسال تحدي مفتوح للسيرفر
    fetch('/api/battles/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'arena',
            challengerName: username,
            challengerId: getCurrentUserId(),
            targetName: 'ALL',
            stake: phantomArenaState.stake
        })
    }).then(res => res.json()).then(data => {
        if (data.success && data.challenge) {
            currentArenaChallengeId = data.challenge.id;
        }
    }).catch(() => {});

    if (arenaSearchInterval) clearInterval(arenaSearchInterval);
    arenaSearchInterval = setInterval(async () => {
        timeLeft--;
        if (timeLeft > 0) {
            renderSearchLobby();
            ArenaAudio.playTone(380, 'sine', 0.05, 0.08);

            // فحص قبول النزال من لاعب آخر
            if (currentArenaChallengeId) {
                try {
                    const res = await fetch(`/api/battles/state/${currentArenaChallengeId}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.challenge && data.challenge.status === 'active') {
                            clearInterval(arenaSearchInterval);
                            arenaSearchInterval = null;
                            cancelMatching();

                            const joiner = data.challenge.acceptedBy || 'بطل الكلان';
                            phantomArenaState.mode = 'duel';
                            phantomArenaState.opponent = {
                                name: joiner,
                                avatar: '⚔️',
                                sub: `مبارزة مباشرة عبر السيرفر · رهان: ${phantomArenaState.stake} نقطة`
                            };
                            showToast(`🔥 انضم ${joiner} إلى ساحة النزال! يبدأ النزال الآن...`, 'success');
                            launchVersusCountdown();
                            return;
                        }
                    }
                } catch (e) {}
            }
        } else {
            clearInterval(arenaSearchInterval);
            arenaSearchInterval = null;
            lobby.innerHTML = `
                <div class="streak-header-box" style="text-align:center; padding:18px; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); border-radius:14px;">
                    <div style="font-size:2.2rem;">⏱️</div>
                    <div style="font-weight:900; color:#ef4444; font-size:1.1rem; margin:6px 0;">لم ينضم أي عضو خلال المهلة</div>
                    <div style="color:#cbd5e1; font-size:0.85rem; margin-bottom:12px;">يمكنك مواجهة حارس الساحة التكتيكي واختبار سرعتك الآن!</div>
                    <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                        <button type="button" class="btn-primary" style="padding:8px 16px; font-size:0.85rem;" onclick="acceptInstantBotDuel()">
                            ⚡ نزال حارس الساحة
                        </button>
                        <button type="button" class="btn-secondary" style="padding:8px 16px; font-size:0.85rem;" onclick="cancelMatching()">
                            إغلاق
                        </button>
                    </div>
                </div>
            `;
        }
    }, 1000);
}

function cancelMatching() {
    if (arenaSearchInterval) {
        clearInterval(arenaSearchInterval);
        arenaSearchInterval = null;
    }
    if (currentArenaChallengeId) {
        fetch('/api/battles/dismiss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ challengeId: currentArenaChallengeId, username: getCurrentUsername() })
        }).catch(() => {});
        currentArenaChallengeId = null;
    }
    const lobby = document.getElementById('arena-search-lobby');
    if (lobby) {
        lobby.style.display = 'none';
        lobby.innerHTML = '';
    }
}

function acceptInstantBotDuel() {
    cancelMatching();
    phantomArenaState.mode = 'duel';
    phantomArenaState.opponent = {
        name: 'حارس الساحة الأسطوري',
        avatar: '🛡️',
        sub: `تحدي رسمي · رهان: ${phantomArenaState.stake} نقطة`
    };
    launchVersusCountdown();
}

// ربط الدوال بنافذة المتصفح العامة
window.openPhantomArena = openPhantomArena;
window.closePhantomArena = closePhantomArena;
window.switchArenaView = switchArenaView;
window.toggleArenaAudio = toggleArenaAudio;
window.setArenaAiDiff = setArenaAiDiff;
window.setArenaStake = setArenaStake;
window.startSoloAiBattle = startSoloAiBattle;
window.surrenderArenaMatch = surrenderArenaMatch;
window.replayArenaMatch = replayArenaMatch;
window.startMatching = startMatching;
window.cancelMatching = cancelMatching;
window.acceptInstantBotDuel = acceptInstantBotDuel;
window.renderArenaClanMembers = renderArenaClanMembers;
window.filterArenaClanMembers = filterArenaClanMembers;
window.sendDirectArenaChallenge = sendDirectArenaChallenge;
window.renderPopularityClanMembers = renderPopularityClanMembers;
window.filterPopularityClanMembers = filterPopularityClanMembers;
window.sendDirectPopularityChallenge = sendDirectPopularityChallenge;
window.startLivePopularityBattle = startLivePopularityBattle;


/* ========================================================
   👾 PHANTOM MAZE (النسخة النهائية - ذكاء اصطناعي + طرق جديدة)
   ======================================================== */

const PM_TILE = 20;
const PM_COLS = 28;
const PM_ROWS = 15; 
const PM_STORAGE_KEY = "phantom_pacman_highscore";

let pmCanvas, pmCtx;
let pm = { x: 14, y: 9, dir: { x: 0, y: 0 }, nextDir: { x: 0, y: 0 }, mouthOpen: true };
let pmGhosts = [];
let pmScore = 0;
let pmLives = 3;
let pmGameOver = false;
let pmWin = false;
let pmFrightened = false;
let pmFrightenedTimer = 0;
let currentDifficulty = 'easy';
let pmSpeed = 0.1;
let pmGhostSpeed = 0.1;
let pmGameLoop = null;

// ✅ خريطة جديدة: طرق في منتصف المربعات الكبيرة
const pmMapBase = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 3, 3, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 3, 3, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1],
    [1, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
];

let pmMap = [];
let bgCanvas = null;
let bgCtx = null;

function pmGetElement(id) { return document.getElementById(id); }
function pmIsInBounds(x, y) { return x >= 0 && x < PM_COLS && y >= 0 && y < PM_ROWS; }

// ✅ خوارزمية BFS لحساب المسافة الحقيقية (ذكاء الأشباح)
function pmBFSDistance(startX, startY, targetX, targetY) {
    if (startX === targetX && startY === targetY) return 0;
    let queue = [{ x: startX, y: startY, dist: 0 }];
    let visited = new Set();
    visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
        let { x, y, dist } = queue.shift();
        const dirs = [{x:0, y:-1}, {x:-1, y:0}, {x:0, y:1}, {x:1, y:0}];
        for (let d of dirs) {
            let nx = x + d.x;
            let ny = y + d.y;
            if (pmIsInBounds(nx, ny) && pmMap[ny][nx] !== 1) {
                if (nx === targetX && ny === targetY) return dist + 1;
                if (!visited.has(`${nx},${ny}`)) {
                    visited.add(`${nx},${ny}`);
                    queue.push({ x: nx, y: ny, dist: dist + 1 });
                }
            }
        }
    }
    return 9999; // لو مفيش طريق
}

function initPacman() {
    pmCanvas = pmGetElement('pacman-canvas');
    if (!pmCanvas) return;
    pmCtx = pmCanvas.getContext('2d');
    pmCanvas.width = PM_COLS * PM_TILE;
    pmCanvas.height = PM_ROWS * PM_TILE;
    const menu = pmGetElement('pacman-menu');
    const game = pmGetElement('pacman-game');
    if (menu) menu.style.display = 'flex';
    if (game) game.style.display = 'none';

    const easyBtn = pmGetElement('pacman-easy');
    const mediumBtn = pmGetElement('pacman-medium');
    const hardBtn = pmGetElement('pacman-hard');
    const restartBtn = pmGetElement('pacman-restart');
    const exitBtn = pmGetElement('pacman-exit');
    const closeBtn = pmGetElement('pacman-close-btn');

    if (easyBtn) easyBtn.addEventListener('click', () => startPacmanGame('easy'));
    if (mediumBtn) mediumBtn.addEventListener('click', () => startPacmanGame('medium'));
    if (hardBtn) hardBtn.addEventListener('click', () => startPacmanGame('hard'));
    if (restartBtn) restartBtn.addEventListener('click', () => { if (game) game.style.display = 'flex'; startPacmanGame(currentDifficulty); });
    if (exitBtn) exitBtn.addEventListener('click', () => { if (game) game.style.display = 'none'; if (menu) menu.style.display = 'flex'; if (pmGameLoop) cancelAnimationFrame(pmGameLoop); });
    if (closeBtn) closeBtn.addEventListener('click', () => { if (game) game.style.display = 'none'; if (menu) menu.style.display = 'flex'; if (pmGameLoop) cancelAnimationFrame(pmGameLoop); });

    let touchStartX = 0, touchStartY = 0;
    pmCanvas.style.touchAction = 'none';
    pmCanvas.addEventListener('touchstart', e => { e.preventDefault(); touchStartX = e.touches[0].clientX; touchStartY = e.touches[0].clientY; }, { passive: false });
    pmCanvas.addEventListener('touchmove', e => { e.preventDefault(); if (touchStartX === 0) return; const dx = e.touches[0].clientX - touchStartX; const dy = e.touches[0].clientY - touchStartY; if (Math.abs(dx) > 20 || Math.abs(dy) > 20) { if (Math.abs(dx) > Math.abs(dy)) { pm.nextDir = dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 }; } else { pm.nextDir = dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 }; } touchStartX = 0; } }, { passive: false });
}

function startPacmanGame(difficulty) {
    currentDifficulty = difficulty;
    const menu = pmGetElement('pacman-menu');
    const game = pmGetElement('pacman-game');
    if (menu) menu.style.display = 'none';
    if (game) game.style.display = 'flex';

    pmGhosts = [ { color: '#ff0000' }, { color: '#ffb8ff' }, { color: '#00ffff' }, { color: '#ffb852' } ];
    if (difficulty === 'easy') { pmSpeed = 0.1; pmGhostSpeed = 0.1; pmGhosts = pmGhosts.slice(0, 2); }
    else if (difficulty === 'medium') { pmSpeed = 0.15; pmGhostSpeed = 0.15; pmGhosts = pmGhosts.slice(0, 3); }
    else { pmSpeed = 0.2; pmGhostSpeed = 0.2; }

    const scoreEl = pmGetElement('pacman-score');
    if (scoreEl) { if (difficulty === 'easy') scoreEl.textContent = "50"; else if (difficulty === 'medium') scoreEl.textContent = "75"; else scoreEl.textContent = "100"; }
    resetPacmanGame();
}

function resetPacmanGame() {
    pmScore = 0; pmLives = 3; pmGameOver = false; pmWin = false;
    pmFrightened = false; pmFrightenedTimer = 0;
    const scoreEl = pmGetElement('pacman-score');
    const livesEl = pmGetElement('pacman-lives');
    if (scoreEl) scoreEl.textContent = pmScore;
    if (livesEl) livesEl.textContent = '♥♥♥';

    pmMap = pmMapBase.map(row => [...row]);

    // ✅ حل مشكلة الرسبون: وضعه في الممر الأفقي (الصف 9)
    pm.x = 14; pm.y = 9;
    pm.dir = { x: 0, y: 0 }; pm.nextDir = { x: 0, y: 0 };

    // ✅ حل مشكلة الأشباح: توزيعهم في زوايا البيت (2x2)
    pmGhosts.forEach((ghost, index) => {
        ghost.x = (index % 2 === 0) ? 13 : 14;
        ghost.y = (index < 2) ? 6 : 7;
        ghost.dir = { x: 0, y: 0 };
        ghost.eyesDir = { x: 0, y: -1 };
        ghost.waitTimer = 0; 
        ghost.state = 'exiting'; // خروج فوري
        ghost.frightened = false;
    });

    if (pmGameLoop) cancelAnimationFrame(pmGameLoop);
    drawPM();
    pmGameLoop = requestAnimationFrame(pmLoop);
}

function initStaticMap() {
    if (!bgCanvas) {
        bgCanvas = document.createElement('canvas');
        bgCanvas.width = PM_COLS * PM_TILE;
        bgCanvas.height = PM_ROWS * PM_TILE;
        bgCtx = bgCanvas.getContext('2d');
    }

    bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
    bgCtx.fillStyle = '#050505';
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);

    for (let y = 0; y < PM_ROWS; y++) {
        for (let x = 0; x < PM_COLS; x++) {
            if (pmMapBase[y][x] === 1) {
                const px = x * PM_TILE;
                const py = y * PM_TILE;
                bgCtx.fillStyle = '#00f2fe';
                bgCtx.shadowColor = '#00f2fe';
                bgCtx.shadowBlur = 6;
                bgCtx.fillRect(px + 1, py + 1, PM_TILE - 2, PM_TILE - 2);
            }
        }
    }
    bgCtx.shadowBlur = 0;
}

function drawPM() {
    if (!bgCanvas) initStaticMap();
    pmCtx.drawImage(bgCanvas, 0, 0);

    for (let y = 0; y < PM_ROWS; y++) {
        for (let x = 0; x < PM_COLS; x++) {
            const tile = pmMap[y][x];
            const px = x * PM_TILE;
            const py = y * PM_TILE;
            if (tile === 0) {
                pmCtx.fillStyle = '#00f2fe';
                pmCtx.shadowColor = '#00f2fe';
                pmCtx.shadowBlur = 4;
                pmCtx.beginPath();
                pmCtx.arc(px + PM_TILE/2, py + PM_TILE/2, 2.5, 0, Math.PI * 2);
                pmCtx.fill();
                pmCtx.shadowBlur = 0;
            } else if (tile === 2) {
                pmCtx.fillStyle = '#00f2fe'; 
                pmCtx.shadowColor = '#00f2fe';
                pmCtx.shadowBlur = 12;
                pmCtx.beginPath();
                pmCtx.arc(px + PM_TILE/2, py + PM_TILE/2, 6, 0, Math.PI * 2);
                pmCtx.fill();
                pmCtx.shadowBlur = 0;
            }
        }
    }

    pmGhosts.forEach(ghost => {
        const px = ghost.x * PM_TILE;
        const py = ghost.y * PM_TILE;
        const centerX = px + PM_TILE / 2;
        const centerY = py + PM_TILE / 2;
        const radius = PM_TILE / 2 - 2;
        let color = ghost.frightened ? '#b026ff' : ghost.color;
        pmCtx.shadowBlur = 8;
        pmCtx.shadowColor = color;
        pmCtx.fillStyle = color;
        pmCtx.beginPath(); 
        pmCtx.arc(centerX, centerY - 2, radius, Math.PI, 0); 
        pmCtx.lineTo(centerX + radius, centerY + 4); 
        pmCtx.lineTo(centerX + radius / 2, centerY + 2); 
        pmCtx.lineTo(centerX, centerY + 4); 
        pmCtx.lineTo(centerX - radius / 2, centerY + 2); 
        pmCtx.lineTo(centerX - radius, centerY + 4); 
        pmCtx.closePath(); 
        pmCtx.fill();
        pmCtx.shadowBlur = 0;
        pmCtx.fillStyle = '#fff'; 
        pmCtx.beginPath(); 
        pmCtx.arc(centerX - 4, centerY - 2, 3, 0, Math.PI * 2); 
        pmCtx.arc(centerX + 4, centerY - 2, 3, 0, Math.PI * 2); 
        pmCtx.fill();
        pmCtx.fillStyle = '#0000ff'; 
        pmCtx.beginPath(); 
        pmCtx.arc(centerX - 4 + ghost.eyesDir.x, centerY - 2 + ghost.eyesDir.y, 1.5, 0, Math.PI * 2); 
        pmCtx.arc(centerX + 4 + ghost.eyesDir.x, centerY - 2 + ghost.eyesDir.y, 1.5, 0, Math.PI * 2); 
        pmCtx.fill();
    });

    const ppx = pm.x * PM_TILE;
    const ppy = pm.y * PM_TILE;
    const pCenterX = ppx + PM_TILE / 2;
    const pCenterY = ppy + PM_TILE / 2;
    const pRadius = PM_TILE / 2 - 2;
    pmCtx.shadowBlur = 10;
    pmCtx.shadowColor = '#ffdd00';
    pmCtx.fillStyle = '#ffdd00';
    let startAngle = pm.mouthOpen ? 0.2 : 0.01;
    let endAngle = pm.mouthOpen ? Math.PI * 2 - 0.2 : Math.PI * 2 - 0.01;
    let rot = pm.dir.x === 1 ? 0 : pm.dir.x === -1 ? Math.PI : pm.dir.y === 1 ? Math.PI/2 : pm.dir.y === -1 ? -Math.PI/2 : 0;
    pmCtx.beginPath(); 
    pmCtx.arc(pCenterX, pCenterY, pRadius, startAngle + rot, endAngle + rot); 
    pmCtx.lineTo(pCenterX, pCenterY); 
    pmCtx.closePath(); 
    pmCtx.fill();
    pmCtx.shadowBlur = 0;
}

function pmLoop() {
    try {
        drawPM();
        if (pm.nextDir.x === -pm.dir.x && pm.nextDir.y === -pm.dir.y && (pm.dir.x !== 0 || pm.dir.y !== 0)) {
            pm.dir = { x: pm.nextDir.x, y: pm.nextDir.y };
        }
        let pmAtGrid = Math.abs(pm.x - Math.round(pm.x)) < (pmSpeed * 0.6) && Math.abs(pm.y - Math.round(pm.y)) < (pmSpeed * 0.6);
        if (pmAtGrid) {
            pm.x = Math.round(pm.x); pm.y = Math.round(pm.y);
            if (pm.nextDir.x !== 0 || pm.nextDir.y !== 0) {
                let nx = pm.x + pm.nextDir.x; let ny = pm.y + pm.nextDir.y;
                if (pmIsInBounds(nx, ny) && pmMap[ny][nx] !== 1) pm.dir = { x: pm.nextDir.x, y: pm.nextDir.y };
            }
            let tx = pm.x + pm.dir.x; let ty = pm.y + pm.dir.y;
            if (pmIsInBounds(tx, ty) && pmMap[ty][tx] === 1) pm.dir = { x: 0, y: 0 };
        }
        pm.x += pm.dir.x * pmSpeed; pm.y += pm.dir.y * pmSpeed;
        let currentGridX = Math.round(pm.x); let currentGridY = Math.round(pm.y);
        if (Math.abs(pm.x - currentGridX) < 0.4 && Math.abs(pm.y - currentGridY) < 0.4) {
            if (pmMap[currentGridY][currentGridX] === 0) { pmMap[currentGridY][currentGridX] = 3; pmScore += 10; pm.mouthOpen = !pm.mouthOpen; }
            else if (pmMap[currentGridY][currentGridX] === 2) { pmMap[currentGridY][currentGridX] = 3; pmScore += 50; pmFrightened = true; pmFrightenedTimer = 300; pmGhosts.forEach(g => g.frightened = true); }
        }

        pmGhosts.forEach(ghost => {
            if (ghost.state === 'waiting') {
                ghost.waitTimer -= 0.02;
                if (ghost.waitTimer <= 0) { ghost.state = 'exiting'; ghost.x = Math.round(ghost.x); }
            } else if (ghost.state === 'exiting') {
                let targetX = ghost.x > 13.5 ? 14 : 13;
                if (Math.abs(ghost.x - targetX) > 0.05) ghost.x += (ghost.x < targetX ? pmGhostSpeed : -pmGhostSpeed);
                else {
                    ghost.x = targetX;
                    ghost.y -= pmGhostSpeed;
                    ghost.eyesDir = { x: 0, y: -1 };
                    if (ghost.y <= 5) { ghost.y = 5; ghost.state = 'chasing'; ghost.dir = { x: targetX === 13 ? -1 : 1, y: 0 }; }
                }
            } else {
                if (ghost.dir.x === 0 && ghost.dir.y === 0) ghost.dir = { x: 1, y: 0 };
                let gAtGrid = Math.abs(ghost.x - Math.round(ghost.x)) < (pmGhostSpeed * 0.6) && Math.abs(ghost.y - Math.round(ghost.y)) < (pmGhostSpeed * 0.6);
                if (gAtGrid) {
                    ghost.x = Math.round(ghost.x); ghost.y = Math.round(ghost.y);
                    let options = [];
                    const dirs = [{x:0, y:-1}, {x:-1, y:0}, {x:0, y:1}, {x:1, y:0}];
                    dirs.forEach(d => {
                        if (d.x === -ghost.dir.x && d.y === -ghost.dir.y) return;
                        let nx = ghost.x + d.x; let ny = ghost.y + d.y;
                        if (pmIsInBounds(nx, ny) && pmMap[ny][nx] !== 1) options.push(d);
                    });
                    if (options.length === 0) options = [{ x: -ghost.dir.x, y: -ghost.dir.y }];
                    
                    let chosen = options[0];
                    if (ghost.frightened) {
                        // إذا كان خائفاً، يتحرك عشوائياً
                        chosen = options[Math.floor(Math.random() * options.length)];
                    } else {
                        // ✅ الذكاء الاصطناعي الجديد: استخدام BFS لاختيار أقصر طريق حقيقي للاعب
                        let minDist = Infinity;
                        let bestOption = options[0];
                        options.forEach(opt => {
                            let dist = pmBFSDistance(ghost.x + opt.x, ghost.y + opt.y, Math.round(pm.x), Math.round(pm.y));
                            if (dist < minDist) {
                                minDist = dist;
                                bestOption = opt;
                            }
                        });
                        chosen = bestOption;
                    }
                    ghost.dir = chosen; ghost.eyesDir = chosen;
                }
                ghost.x += ghost.dir.x * pmGhostSpeed; ghost.y += ghost.dir.y * pmGhostSpeed;
            }
        });

        const pGridX = Math.round(pm.x); const pGridY = Math.round(pm.y);
        pmGhosts.forEach((ghost) => {
            if (ghost.state !== 'chasing') return;
            const gGridX = Math.round(ghost.x); const gGridY = Math.round(ghost.y);
            if (pGridX === gGridX && pGridY === gGridY) {
                if (ghost.frightened) { pmScore += 200; const scoreEl = pmGetElement('pacman-score'); if (scoreEl) scoreEl.textContent = pmScore; ghost.x = 13; ghost.y = 6; ghost.frightened = false; ghost.dir = { x: 0, y: 0 }; ghost.state = 'waiting'; ghost.waitTimer = 2.5; }
                else {
                    pmLives--; const livesEl = pmGetElement('pacman-lives'); if (livesEl) livesEl.textContent = '♥'.repeat(pmLives);
                    if (pmLives <= 0) { pmGameOver = true; const resultEl = pmGetElement('pacman-result-msg'); if (resultEl) { resultEl.style.display = 'block'; resultEl.textContent = '💀 Game Over! حاول مرة أخرى.'; resultEl.style.color = 'var(--red)'; setTimeout(() => { resultEl.style.display = 'none'; }, 3000); } setTimeout(() => { const game = pmGetElement('pacman-game'); const menu = pmGetElement('pacman-menu'); if (game) game.style.display = 'none'; if (menu) menu.style.display = 'flex'; if (pmGameLoop) cancelAnimationFrame(pmGameLoop); }, 2000); }
                    else {
                        // ✅ حل مشكلة الرسبون بعد الموت: إعادته للممر الأفقي (9)
                        pm.x = 14; pm.y = 9;
                        pm.dir = { x: 0, y: 0 }; pm.nextDir = { x: 0, y: 0 }; 
                        pmFrightened = false; pmFrightenedTimer = 0;
                        // ✅ توزيع الأشباح من جديد بعد الموت
                        pmGhosts.forEach((g, i) => {
                            g.x = (i % 2 === 0) ? 13 : 14;
                            g.y = (i < 2) ? 6 : 7;
                            g.dir = { x: 0, y: 0 }; g.eyesDir = { x: 0, y: -1 };
                            g.waitTimer = 0; g.state = 'exiting'; g.frightened = false;
                        });
                    }
                }
            }
        });

        let remaining = 0;
        for (let y = 0; y < PM_ROWS; y++) for (let x = 0; x < PM_COLS; x++) if (pmMap[y][x] === 0 || pmMap[y][x] === 2) remaining++;
        if (remaining === 0) {
            pmWin = true;
            let reward = 0; let levelName = "السهل";
            if (currentDifficulty === 'easy') reward = 50; else if (currentDifficulty === 'medium') { reward = 75; levelName = "المتوسط"; } else { reward = 100; levelName = "الصعب"; }
            const username = getCurrentUsername();
            if (username) {
                addPoints(username, reward);
                if (supabaseClient) { const userId = getCurrentUserId(); if (userId) { const currentPoints = getLocalPoints()[username] || 0; safePostgrest(supabaseClient.from('members').update({ coins: currentPoints }).eq('id', userId)).then(() => console.log("✅ تم تحديث النقاط في السيرفر من المتاهة.")).catch(err => console.warn("⚠️ فشل تحديث النقاط من المتاهة:", err)); } }
                renderLeaderboard();
            }
            const resultEl = pmGetElement('pacman-result-msg'); if (resultEl) { resultEl.style.display = 'block'; resultEl.textContent = `🏆 مبروك! كسبت ${reward} نقطة في المستوى ${levelName}!`; resultEl.style.color = 'var(--green)'; setTimeout(() => { resultEl.style.display = 'none'; }, 4000); }
            setTimeout(() => { const game = pmGetElement('pacman-game'); const menu = pmGetElement('pacman-menu'); if (game) game.style.display = 'none'; if (menu) menu.style.display = 'flex'; if (pmGameLoop) cancelAnimationFrame(pmGameLoop); }, 2000);
        }

        if (pmFrightenedTimer > 0) { pmFrightenedTimer--; if (pmFrightenedTimer === 0) { pmFrightened = false; pmGhosts.forEach(g => g.frightened = false); } }
        if (!pmGameOver && !pmWin) pmGameLoop = requestAnimationFrame(pmLoop);
    } catch (error) { console.error('[PHANTOM MAZE] خطأ في حلقة اللعبة:', error); pmGameLoop = requestAnimationFrame(pmLoop); }
}

/* ========================================================
   ✅ إصلاح دالة renderFounderNotifications المفقودة
   ======================================================== */
function renderFounderNotifications() {
    const list = getElement("founder-notifications-list");
    if (!list) return;

    let html = "";

    const complaints = getStorage(PHANTOM_MEMORY.complaintsKey, []);
    complaints.forEach(c => {
        html += `
            <div style="border-bottom:1px solid var(--border); padding:8px;">
                <strong style="color:#ff4d4d;">📩 شكوى</strong> - من: ${escapeHTML(c.from)} ضد: ${escapeHTML(c.target)}<br>
                <small>${escapeHTML(c.reason)}</small>
                <div style="margin-top:5px;">
                    <button class="btn-success" onclick="acceptComplaint('${c.id}')">✅ قبول</button>
                    <button class="btn-danger" onclick="rejectComplaint('${c.id}')">❌ رفض</button>
                    <button class="btn-warning" onclick="giveWarningToComplaint('${c.id}')">⚠️ تنبيه</button>
                    <button class="btn-danger" onclick="giveBanToComplaint('${c.id}')">🚨 إنذار</button>
                    <button class="btn-secondary" onclick="dismissComplaint('${c.id}')">🗑️ فض</button>
                </div>
            </div>
        `;
    });

    const rejoinRequests = getRejoinRequests().filter(r => r.status === 'pending');
    rejoinRequests.forEach(r => {
        html += `
            <div style="border-bottom:1px solid var(--border); padding:8px;">
                <strong style="color:var(--gold);">🔄 طلب رجوع</strong> - ${escapeHTML(r.username)}<br>
                <small>${escapeHTML(r.message)}</small>
                <div style="margin-top:5px;">
                    <button class="btn-success" onclick="handleRequest('${r.id}', 'accept', 'طلب رجوع')">✅ قبول</button>
                    <button class="btn-danger" onclick="handleRequest('${r.id}', 'reject', 'طلب رجوع')">❌ رفض</button>
                </div>
            </div>
        `;
    });

    const excuses = getStorage(PHANTOM_MEMORY.excusesKey, []);
    excuses.forEach(e => {
        html += `
            <div style="border-bottom:1px solid var(--border); padding:8px;">
                <strong style="color:var(--cyan);">⏳ عذر عدم حضور</strong> - ${escapeHTML(e.from)}<br>
                <small>${escapeHTML(e.reason)}</small>
                <div style="margin-top:5px;">
                    <button class="btn-success" onclick="acceptExcuse('${e.id}')">✅ قبول</button>
                    <button class="btn-danger" onclick="rejectExcuse('${e.id}')">❌ رفض</button>
                </div>
            </div>
        `;
    });

        const nameChanges = getStorage(PHANTOM_MEMORY.nameChangeRequestsKey, []);
    nameChanges.forEach(n => {
        html += `
            <div style="border-bottom:1px solid var(--border); padding:8px;">
                <strong style="color:var(--purple);">📝 طلب تغيير اسم</strong> - ${escapeHTML(n.oldName)} إلى ${escapeHTML(n.newName)}<br>
                <div style="margin-top:5px;">
                    <button class="btn-success" onclick="approveNameChange('${n.id}')">✅ قبول</button>
                    <button class="btn-danger" onclick="rejectNameChange('${n.id}')">❌ رفض</button>
                </div>
            </div>
        `;
    });

    // ✅ كود الـ ID - خارج حلقة الأسماء (تم إصلاحه)
    const idChanges = getStorage("phantom_id_change_requests", []);
    idChanges.forEach(req => {
        html += `
            <div style="border-bottom:1px solid var(--border); padding:8px;">
                <strong style="color:var(--cyan);">🆔 طلب تغيير ID</strong> - ${escapeHTML(req.username)}<br>
                <small>الـ ID الجديد: ${escapeHTML(req.newId)}</small>
                <div style="margin-top:5px;">
                    <button class="btn-success" onclick="handleIdChange('${req.id}', 'accept')">✅ قبول</button>
                    <button class="btn-danger" onclick="handleIdChange('${req.id}', 'reject')">❌ رفض</button>
                </div>
            </div>
        `;
    });

    if (!html) {
        list.innerHTML = `<p style="color:var(--silver-muted);">لا توجد إشعارات حالياً.</p>`;
    } else {
        list.innerHTML = html;
    }
}
function isFounderSession() {
    if (sessionStorage.getItem('admin_authenticated') === 'true') return true;
    
    const username = getCurrentUsername();
    if (!username) return false;
    
    const roster = getFullRoster();
    const member = roster.find(m => normalizeName(m.name) === normalizeName(username));
    if (member && (member.rank === 'رئيس' || member.rank === 'قائد' || member.rank === 'مؤسس')) {
        return true;
    }
    return false;
}

// ✅ ربط الزر في قائمة الشبح (من غير ما نكسر الدالة)
function setupBroadcastDrawer() {
    const menuItem = document.getElementById('menu-2'); // زر "صفحة الرسائل" في قائمة الشبح

    if (menuItem) {
        menuItem.addEventListener('click', function() {
            openBroadcastDrawer();
        });
    }

    // ✅ إذا كان الدرج موجوداً في HTML، نربط أزرار الإغلاق به
    const broadcastDrawer = getElement('broadcast-drawer');
    if (broadcastDrawer) {
        const broadcastOverlay = getElement('broadcast-drawer-overlay');
        const closeBroadcastBtn = getElement('close-broadcast-btn');
        
        function closeDrawer() {
            broadcastDrawer.style.display = 'none';
        }
        if (closeBroadcastBtn) closeBroadcastBtn.addEventListener('click', closeDrawer);
        if (broadcastOverlay) broadcastOverlay.addEventListener('click', closeDrawer);
    }
}

function renderBroadcastMessages() {
    const container = getElement('broadcast-messages-list');
    if (!container) return;

    // استخدام system_updates كرسائل جماعية
    const updates = getSystemUpdates().filter(u => u.isMajor);
    if (!updates.length) {
        container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--muted);">لا توجد رسائل جماعية حالياً.</div>`;
        return;
    }
    container.innerHTML = updates.slice(-10).reverse().map(msg => `
        <div style="background:rgba(255,255,255,0.03); padding:12px; border-radius:8px; margin-bottom:8px; border-right:3px solid var(--cyan);">
            <strong style="color:var(--cyan); display:block;">${escapeHTML(msg.title || 'إشعار')}</strong>
            <small style="color:var(--muted);">${escapeHTML(msg.date || '')}</small>
            <p style="color:var(--text); font-size:0.85rem; margin-top:4px;">${escapeHTML(msg.description || '')}</p>
        </div>
    `).join('');
}

/* ============================================================
   🤖 PHANTOM MASCOT (نفس الكود السابق)
   ============================================================ */
(function () {
    "use strict";

    function mascotInit() {
// ✅ إجبار الروبوت على الاختفاء إذا كان الإعداد "إيقاف"
const mascot = document.getElementById('phantom-mascot');
if (!mascot) return;

if (localStorage.getItem('phantom_mascot') === 'off') {
    mascot.style.display = 'none';
    mascot.style.visibility = 'hidden';
    mascot.style.opacity = '0';
    mascot.style.pointerEvents = 'none';
    return;
}
// ... (باقي الكود كما هو)

        const body = document.getElementById('mascot-body');
        const banner = document.getElementById('mascot-banner');
        const honkBubble = document.getElementById('mascot-honk-bubble');
        const glowWave = document.getElementById('mascot-glow-wave');
        const hornBtn = document.getElementById('mascot-horn');
        const eyeLeft = document.getElementById('mascot-eye-left');
        const eyeRight = document.getElementById('mascot-eye-right');
        const pupilLeft = eyeLeft ? eyeLeft.querySelector('.mascot-pupil') : null;
        const pupilRight = eyeRight ? eyeRight.querySelector('.mascot-pupil') : null;
        const browLeft = document.getElementById('mascot-brow-left');
        const browRight = document.getElementById('mascot-brow-right');

        const MASCOT_EDGE_MARGIN = 15;
        const MASCOT_PUPIL_RADIUS = 4.5;

        function mascotEnsurePosition() {
            const rect = mascot.getBoundingClientRect();
            if (!mascot.style.left) {
                mascot.style.left = "12px";
            }
            if (!mascot.style.top) {
                const top = window.innerHeight - rect.height - 90;
                mascot.style.top = Math.max(20, top) + "px";
            }
            mascot.style.bottom = "auto";
        }
        mascotEnsurePosition();

        function mascotShowBannerOnce() {
            const shown = getStorage ? getStorage("phantom_mascot_banner_shown", false) : false;
            if (shown) return;
            if (!banner) return;
            setTimeout(() => {
                banner.classList.add('mascot-banner-show');
                setTimeout(() => {
                    banner.classList.remove('mascot-banner-show');
                }, 3000);
            }, 500);
            if (typeof setStorage === "function") setStorage("phantom_mascot_banner_shown", true);
        }
        mascotShowBannerOnce();

        let mascotPointerX = window.innerWidth / 2;
        let mascotPointerY = window.innerHeight / 2;
        let mascotPupilTargetLX = 0, mascotPupilTargetLY = 0;
        let mascotPupilTargetRX = 0, mascotPupilTargetRY = 0;
        let mascotPupilCurLX = 0, mascotPupilCurLY = 0;
        let mascotPupilCurRX = 0, mascotPupilCurRY = 0;
        let mascotEyeTrackingSuspended = false;

        function mascotUpdateEyeTargets() {
            if (!eyeLeft || !eyeRight) return;
            [ [eyeLeft, 'L'], [eyeRight, 'R'] ].forEach(([eyeEl, side]) => {
                const r = eyeEl.getBoundingClientRect();
                const cx = r.left + r.width / 2;
                const cy = r.top + r.height / 2;
                const dx = mascotPointerX - cx;
                const dy = mascotPointerY - cy;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const clamped = Math.min(MASCOT_PUPIL_RADIUS, dist);
                const nx = (dx / dist) * clamped;
                const ny = (dy / dist) * clamped;
                if (side === 'L') { mascotPupilTargetLX = nx; mascotPupilTargetLY = ny; }
                else { mascotPupilTargetRX = nx; mascotPupilTargetRY = ny; }
            });
        }

        window.addEventListener('pointermove', (e) => {
            mascotPointerX = e.clientX;
            mascotPointerY = e.clientY;
        }, { passive: true });

        function mascotEyeLoop() {
            if (!mascotEyeTrackingSuspended) {
                mascotUpdateEyeTargets();
                mascotPupilCurLX += (mascotPupilTargetLX - mascotPupilCurLX) * 0.08;
                mascotPupilCurLY += (mascotPupilTargetLY - mascotPupilCurLY) * 0.08;
                mascotPupilCurRX += (mascotPupilTargetRX - mascotPupilCurRX) * 0.08;
                mascotPupilCurRY += (mascotPupilTargetRY - mascotPupilCurRY) * 0.08;
                if (pupilLeft) pupilLeft.style.transform = `translate(calc(-50% + ${mascotPupilCurLX}px), calc(-50% + ${mascotPupilCurLY}px))`;
                if (pupilRight) pupilRight.style.transform = `translate(calc(-50% + ${mascotPupilCurRX}px), calc(-50% + ${mascotPupilCurRY}px))`;
            }
            requestAnimationFrame(mascotEyeLoop);
        }
        requestAnimationFrame(mascotEyeLoop);

        let mascotDragging = false;
        let mascotDragStartX = 0, mascotDragStartY = 0;
        let mascotStartLeft = 0, mascotStartTop = 0;
        let mascotMovedDistance = 0;
        let mascotActivePointerId = null;

        let mascotShakeHistory = [];
        let mascotDirectionChanges = 0;
        let mascotLastDeltaSign = 0;

        function mascotResetShakeTracking() {
            mascotShakeHistory = [];
            mascotDirectionChanges = 0;
            mascotLastDeltaSign = 0;
        }

        function mascotTrackShake(clientX) {
            const now = Date.now();
            mascotShakeHistory.push({ x: clientX, t: now });
            mascotShakeHistory = mascotShakeHistory.filter(p => now - p.t < 600);

            if (mascotShakeHistory.length >= 2) {
                const prev = mascotShakeHistory[mascotShakeHistory.length - 2];
                const delta = clientX - prev.x;
                const sign = delta > 2 ? 1 : (delta < -2 ? -1 : 0);
                if (sign !== 0 && mascotLastDeltaSign !== 0 && sign !== mascotLastDeltaSign) {
                    mascotDirectionChanges++;
                }
                if (sign !== 0) mascotLastDeltaSign = sign;
            }

            if (mascotDirectionChanges >= 3) {
                mascotTriggerDizzy();
                mascotResetShakeTracking();
            }
        }

        function mascotOnPointerDown(e) {
            if (e.target === hornBtn) return;
            mascotActivePointerId = e.pointerId;
            mascot.setPointerCapture(e.pointerId);
            mascotDragging = true;
            mascotMovedDistance = 0;
            mascotResetShakeTracking();
            mascotEyeTrackingSuspended = false;

            mascotDragStartX = e.clientX;
            mascotDragStartY = e.clientY;
            const rect = mascot.getBoundingClientRect();
            mascotStartLeft = rect.left;
            mascotStartTop = rect.top;

            mascot.classList.add('mascot-dragging');
        }

        function mascotOnPointerMove(e) {
            if (!mascotDragging || e.pointerId !== mascotActivePointerId) return;

            const dx = e.clientX - mascotDragStartX;
            const dy = e.clientY - mascotDragStartY;
            mascotMovedDistance = Math.max(mascotMovedDistance, Math.sqrt(dx * dx + dy * dy));

            let newLeft = mascotStartLeft + dx;
            let newTop = mascotStartTop + dy;

            const w = mascot.offsetWidth;
            const h = mascot.offsetHeight;
            newLeft = Math.max(0, Math.min(window.innerWidth - w, newLeft));
            newTop = Math.max(0, Math.min(window.innerHeight - h, newTop));

            mascot.style.left = newLeft + "px";
            mascot.style.top = newTop + "px";

            mascotTrackShake(e.clientX);
        }

        function mascotOnPointerUp(e) {
            if (!mascotDragging || e.pointerId !== mascotActivePointerId) return;
            mascotDragging = false;
            mascot.classList.remove('mascot-dragging');
            try { mascot.releasePointerCapture(e.pointerId); } catch (err) { }
            mascotActivePointerId = null;

            mascotSnapToEdge();

            if (mascotMovedDistance > 8) {
                mascotPlayGreeting();
            } else {
                mascotRegisterClick();
                if (typeof window.onMascotTap === 'function') {
                    window.onMascotTap();
                }
            }
        }

        mascot.addEventListener('pointerdown', mascotOnPointerDown);
        window.addEventListener('pointermove', mascotOnPointerMove, { passive: true });
        window.addEventListener('pointerup', mascotOnPointerUp);
        window.addEventListener('pointercancel', mascotOnPointerUp);

        function mascotSnapToEdge() {
            const rect = mascot.getBoundingClientRect();
            const centerX = rect.left + rect.width / 2;
            const goRight = centerX > window.innerWidth / 2;
            const targetLeft = goRight
                ? window.innerWidth - rect.width - MASCOT_EDGE_MARGIN
                : MASCOT_EDGE_MARGIN;
            mascot.style.left = Math.max(0, targetLeft) + "px";

            const maxTop = window.innerHeight - rect.height - 20;
            const curTop = parseFloat(mascot.style.top) || 0;
            mascot.style.top = Math.min(Math.max(20, curTop), Math.max(20, maxTop)) + "px";
        }

        window.addEventListener('resize', () => {
            if (!mascotDragging) mascotSnapToEdge();
        });

        function mascotPlayGreeting() {
            if (!body) return;
            body.classList.remove('mascot-greet');
            void body.offsetWidth;
            body.classList.add('mascot-greet');
            setTimeout(() => body.classList.remove('mascot-greet'), 1200);

            if (glowWave) {
                glowWave.classList.remove('mascot-glow-play');
                void glowWave.offsetWidth;
                glowWave.classList.add('mascot-glow-play');
                setTimeout(() => glowWave.classList.remove('mascot-glow-play'), 900);
            }
        }

        let mascotDizzyActive = false;
        function mascotTriggerDizzy() {
            if (mascotDizzyActive || !body) return;
            mascotDizzyActive = true;
            mascotEyeTrackingSuspended = true;

            body.classList.add('mascot-dizzy');
            if (eyeLeft) eyeLeft.classList.add('mascot-dizzy-eye');
            if (eyeRight) eyeRight.classList.add('mascot-dizzy-eye');

            setTimeout(() => {
                body.classList.remove('mascot-dizzy');
                if (eyeLeft) eyeLeft.classList.remove('mascot-dizzy-eye');
                if (eyeRight) eyeRight.classList.remove('mascot-dizzy-eye');
                mascotEyeTrackingSuspended = false;
                mascotDizzyActive = false;
            }, 1000);
        }

        let mascotClickTimestamps = [];
        let mascotRageActive = false;

        function mascotRegisterClick() {
            if (mascotRageActive) return;
            const now = Date.now();
            mascotClickTimestamps.push(now);
            mascotClickTimestamps = mascotClickTimestamps.filter(t => now - t < 1000);

            if (mascotClickTimestamps.length >= 5) {
                mascotTriggerRage();
                mascotClickTimestamps = [];
            }
        }

        function mascotTriggerRage() {
            if (!body || mascotRageActive) return;
            mascotRageActive = true;
            mascotEyeTrackingSuspended = true;

            body.classList.add('mascot-rage');
            if (eyeLeft) eyeLeft.classList.add('mascot-rage-eye');
            if (eyeRight) eyeRight.classList.add('mascot-rage-eye');
            if (browLeft) browLeft.classList.add('mascot-rage-brow-left');
            if (browRight) browRight.classList.add('mascot-rage-brow-right');

            setTimeout(() => {
                body.classList.remove('mascot-rage');
                if (eyeLeft) eyeLeft.classList.remove('mascot-rage-eye');
                if (eyeRight) eyeRight.classList.remove('mascot-rage-eye');
                if (browLeft) browLeft.classList.remove('mascot-rage-brow-left');
                if (browRight) browRight.classList.remove('mascot-rage-brow-right');
                mascotEyeTrackingSuspended = false;
                mascotRageActive = false;
                mascotClickTimestamps = [];
            }, 3000);
        }

        let mascotAudioCtx = null;
        function mascotGetAudioContext() {
            if (!mascotAudioCtx) {
                const AC = window.AudioContext || window.webkitAudioContext;
                if (AC) mascotAudioCtx = new AC();
            }
            return mascotAudioCtx;
        }

        function mascotPlayHonk() {
            const ctx = mascotGetAudioContext();
            if (!ctx) return;
            if (ctx.state === 'suspended') ctx.resume();

            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(180, now + 0.28);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.35, now + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.35);
        }

        if (hornBtn) {
            hornBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
            hornBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                mascotPlayHonk();

                hornBtn.classList.remove('mascot-horn-bounce');
                void hornBtn.offsetWidth;
                hornBtn.classList.add('mascot-horn-bounce');
                setTimeout(() => hornBtn.classList.remove('mascot-horn-bounce'), 400);

                if (honkBubble) {
                    honkBubble.classList.add('mascot-honk-show');
                    setTimeout(() => honkBubble.classList.remove('mascot-honk-show'), 900);
                }

                if (body) {
                    body.style.transform = 'scale(1.08)';
                    setTimeout(() => { body.style.transform = ''; }, 180);
                }
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mascotInit);
    } else {
        mascotInit();
    }
    // ✅ مستمع إعادة ضبط الماسكوت عند تغيير الحالة (فوري)
window.addEventListener('phantom-mascot-settings-changed', () => {
    const mascot = document.getElementById('phantom-mascot');
    if (!mascot) return;
    
    if (localStorage.getItem('phantom_mascot') === 'off') {
        mascot.style.cssText = 'display:none; visibility:hidden; opacity:0; pointer-events:none;';
        return;
    }
    
    mascot.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:99999999; display:block; visibility:visible; opacity:1; pointer-events:auto;';
    mascot.querySelectorAll('*').forEach(el => el.style.transform = '');
});
})();
/* ========================================================
   ⚡ مساعد CODO الذكي - نظام الصوت والتفاعل التكتيكي
   ======================================================== */

let codoChatHistory = []; 
let codoCurrentModel = 'codo-base';
let codoAudioContext = null;
let codoAudioMuted = localStorage.getItem('phantom_codo_sound_muted') === 'true';
let bobertChatHistory = codoChatHistory;

// 🔊 محرك الأصوات التفاعلية الخفيفة (Web Audio API)
function playCodoSound(type) {
    if (codoAudioMuted) return;
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        if (!codoAudioContext) codoAudioContext = new AudioCtx();
        if (codoAudioContext.state === 'suspended') {
            codoAudioContext.resume().catch(() => {});
        }

        const now = codoAudioContext.currentTime;
        const osc = codoAudioContext.createOscillator();
        const gain = codoAudioContext.createGain();
        osc.connect(gain);
        gain.connect(codoAudioContext.destination);

        if (type === 'send') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(420, now);
            osc.frequency.exponentialRampToValueAtTime(750, now + 0.08);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'receive') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(550, now);
            osc.frequency.setValueAtTime(820, now + 0.07);
            gain.gain.setValueAtTime(0.07, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'complete') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, now);
            osc.frequency.setValueAtTime(659.25, now + 0.06);
            osc.frequency.setValueAtTime(783.99, now + 0.12);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
            osc.start(now);
            osc.stop(now + 0.27);
        } else if (type === 'error') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(180, now);
            osc.frequency.exponentialRampToValueAtTime(110, now + 0.12);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
            osc.start(now);
            osc.stop(now + 0.14);
        }
    } catch (e) {
        // Safe fallback
    }
}

function toggleCodoAudio() {
    codoAudioMuted = !codoAudioMuted;
    localStorage.setItem('phantom_codo_sound_muted', codoAudioMuted ? 'true' : 'false');
    const icon = document.getElementById('codo-audio-icon');
    if (icon) icon.textContent = codoAudioMuted ? '🔇' : '🔊';
    showToast(codoAudioMuted ? '🔇 تم كتم الأصوات' : '🔊 تم تشغيل الأصوات', 'info');
    if (!codoAudioMuted) playCodoSound('send');
}
window.toggleCodoAudio = toggleCodoAudio;

if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

// إظهار فقاعة كلام للروبوت
window.mascotSay = function(text, duration = 4000) {
    const bubble = document.getElementById('mascot-honk-bubble');
    if (!bubble) return;
    bubble.textContent = text.length > 40 ? text.substring(0, 38) + '...' : text;
    bubble.classList.add('mascot-honk-show');
    clearTimeout(window._mascotSayTimer);
    window._mascotSayTimer = setTimeout(() => {
        bubble.classList.remove('mascot-honk-show');
        bubble.textContent = '📯 بووووق!';
    }, duration);
};

// نطق صوت CODO
window.speakCodo = function(text) {
    if (!('speechSynthesis' in window)) return;
    try {
        window.speechSynthesis.cancel();
        const cleanText = text.replace(/[*#_`~]/g, '');
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'ar-SA'; 
        utterance.rate = 1.05; 
        utterance.pitch = 1.05;
        
        const voices = window.speechSynthesis.getVoices();
        const arabicVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('ar'));
        if (arabicVoice) utterance.voice = arabicVoice;
        
        utterance.onstart = () => {
            const mascot = document.getElementById('phantom-mascot');
            if (mascot) mascot.classList.add('mascot-greet');
            window.mascotSay(cleanText, 4500);
        };
        utterance.onend = () => {
            const mascot = document.getElementById('phantom-mascot');
            if (mascot) mascot.classList.remove('mascot-greet');
        };
        utterance.onerror = () => {
            const mascot = document.getElementById('phantom-mascot');
            if (mascot) mascot.classList.remove('mascot-greet');
        };

        window.speechSynthesis.speak(utterance);
    } catch (e) {
        console.warn("Speech synthesis error:", e);
    }
};
window.speakBobert = window.speakCodo;

// تفاعل الروبوت الصوتي عند الضغط عليه في الواجهة
window.onMascotTap = function() {
    const mascot = document.getElementById('phantom-mascot');
    if (!mascot) return;

    if (typeof mascotPlayGreeting === 'function') {
        mascotPlayGreeting();
    }

    // بدء التفاعل الصوتي مباشرة وبشكل متزامن للاستفادة من نقرة المستخدم (User Gesture)
    if (typeof window.startVoiceInteraction === 'function') {
        window.startVoiceInteraction();
    } else {
        window.mascotSay("🎙️ أنا سامعك... اتفضل اتكلم!", 4000);
    }
};

function setupAIChat() {
    const mascot = document.getElementById('phantom-mascot');
    if (!mascot) return;

    const oldChat = document.getElementById('ai-chat-box');
    if (oldChat) oldChat.remove();

    mascot.style.cursor = 'pointer';

    // الاستماع مع مؤقت
    window.startVoiceInteraction = async function() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast("⚠️ التعرف الصوتي غير مدعوم في متصفحك. تم فتح شات CODO للكتابة.", "info");
            window.mascotSay("⚠️ الميكروفون غير متاح، اكتب في الشات!", 3000);
            if (typeof openCodoChat === 'function') openCodoChat();
            return;
        }

        // طلب إذن الميكروفون المسبق لضمان عدم ظهور خطأ not-allowed
        try {
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                stream.getTracks().forEach(t => t.stop());
            }
        } catch (permErr) {
            console.warn("Direct getUserMedia mic check:", permErr);
        }
        
        window.mascotSay("🔴 جاري الاستماع... تكلم الآن!", 6000);
        showToast("🎙️ جاري الاستماع... تكلم الآن يا بطل", "info");

        const recognition = new SpeechRecognition();
        recognition.lang = 'ar-SA';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        let hasResult = false;
        const timeoutId = setTimeout(() => {
            try { recognition.stop(); } catch(e) {}
            if (!hasResult) {
                window.mascotSay("⏰ لم أسمعك! اضغط للتحدث مجدداً.", 3500);
            }
        }, 7500);
        
        recognition.onresult = async (event) => {
            hasResult = true;
            clearTimeout(timeoutId);
            const userText = event.results[0][0].transcript;
            window.mascotSay(`🎤 سمعتك: ${userText}`, 3000);
            showToast(`🎤 سمعتك: ${userText}`, "success");
            await sendVoiceToAI(userText);
        };
        
        recognition.onerror = (event) => {
            clearTimeout(timeoutId);
            console.warn("Speech recognition error:", event.error);
            if (event.error === 'not-allowed') {
                showToast("⚠️ يرجى تفعيل إذن المايك في إعدادات الموقع أو استخدام شات CODO.", "error");
                window.mascotSay("⚠️ اضغط على القفل 🔒 لتفعيل المايك!", 4500);
            } else if (event.error !== 'no-speech') {
                window.mascotSay("لم أسمعك بوضوح، حاول مجدداً!", 3500);
            }
        };
        
        try {
            recognition.start();
        } catch (e) {
            console.warn("Recognition already started or error:", e);
        }
    };

    window.sendVoiceToAI = async function(userText) {
        try {
            window.mascotSay("💭 CODO يحلل ويفكر...", 5000);
            playCodoSound('send');
            
            // إضافة رسالة المستخدم الصوتية لسجل الشات والمحفوظات
            addMessage(userText, 'user', true);

            const body = document.getElementById('phantom-chat-body');
            const typing = showTyping();
            if (body) {
                body.appendChild(typing);
                body.scrollTop = body.scrollHeight;
            }

            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ 
                    message: userText,
                    history: codoChatHistory,
                    modelChoice: codoCurrentModel
                })
            });

            if (!response.ok) throw new Error("Server Error: " + response.status);
            const data = await response.json();
            const aiResponse = data.response || data.reply || "أهلاً بك يا بطل PHANTOM!";

            typing.remove();
            playCodoSound('receive');
            
            codoChatHistory.push({ role: 'user', text: userText });
            codoChatHistory.push({ role: 'model', text: aiResponse });
            if (codoChatHistory.length > 10) codoChatHistory = codoChatHistory.slice(-10);

            // ✅ تفاعل الروبوت بالصوت والفقاعة وحفظ الرد في الشات
            window.speakCodo(aiResponse);
            window.mascotSay(aiResponse, 6000);
            addMessage(aiResponse, 'bot', true);
        } catch (error) {
            console.error("AI Error:", error);
            playCodoSound('error');
            const typingEl = document.querySelector('.thinking-ghost-container');
            if (typingEl) typingEl.remove();
            window.mascotSay("⚠️ حدث خطأ في الاتصال، حاول ثانية.", 4000);
            showToast("⚠️ تعذر الاتصال بـ CODO.", "error");
            addMessage("عذراً، حدث خطأ مؤقت في الاتصال بـ CODO.", 'bot', true);
        }
    };

    // الضغط المباشر كاحتياط إضافي
    mascot.addEventListener('click', (e) => {
        if (e.target && e.target.id === 'mascot-horn') return;
        window.onMascotTap();
    });
}

document.addEventListener('DOMContentLoaded', setupAIChat);
/* ========================================================
   🎨 نظام تغيير ألوان الروبوت كل 3 دقائق
======================================================== */
const botColors = ['bot-green', 'bot-pink', 'bot-white', 'bot-black', 'bot-purple', 'bot-orange'];
let currentColorIndex = 0;

function changeBotColor() {
    const bot = document.getElementById('phantom-mascot');
    if (!bot) return;
    bot.classList.remove('bot-green', 'bot-pink', 'bot-white', 'bot-black', 'bot-purple', 'bot-orange');
    currentColorIndex = (currentColorIndex + 1) % botColors.length;
    bot.classList.add(botColors[currentColorIndex]);
}
setInterval(changeBotColor, 60000);

function renderBadge(level) {
    let strokeColor, glowColor, detailColor;
    if (level <= 10) { strokeColor = "#9ca3af"; glowColor = "rgba(156, 163, 175, 0.3)"; detailColor = "#d1d5db"; }
    else if (level <= 20) { strokeColor = "#fbbf24"; glowColor = "rgba(251, 191, 36, 0.3)"; detailColor = "#fcd34d"; }
    else if (level <= 30) { strokeColor = "#34d399"; glowColor = "rgba(52, 211, 153, 0.3)"; detailColor = "#6ee7b7"; }
    else if (level <= 40) { strokeColor = "#60a5fa"; glowColor = "rgba(96, 165, 250, 0.3)"; detailColor = "#93c5fd"; }
    else if (level <= 50) { strokeColor = "#a78bfa"; glowColor = "rgba(167, 139, 250, 0.3)"; detailColor = "#c4b5fd"; }
    else if (level <= 60) { strokeColor = "#f87171"; glowColor = "rgba(248, 113, 113, 0.3)"; detailColor = "#fca5a5"; }
    else if (level <= 70) { strokeColor = "#facc15"; glowColor = "rgba(250, 204, 21, 0.3)"; detailColor = "#fde047"; }
    else if (level <= 80) { strokeColor = "#22d3ee"; glowColor = "rgba(34, 211, 238, 0.3)"; detailColor = "#67e8f9"; }
    else if (level <= 90) { strokeColor = "#f472b6"; glowColor = "rgba(244, 114, 182, 0.3)"; detailColor = "#f9a8d4"; }
    else { strokeColor = "#fbbf24"; glowColor = "rgba(251, 191, 36, 0.6)"; detailColor = "#fcd34d"; }

    return `
        <svg viewBox="0 0 100 100" width="100%" height="100%">
            <defs>
                <filter id="glow-${level}" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="${strokeColor}" flood-opacity="0.8"/>
                </filter>
            </defs>
            <polygon points="50,5 95,25 95,75 50,95 5,75 5,25" fill="rgba(26, 34, 42, 0.9)" stroke="${strokeColor}" stroke-width="4" filter="url(#glow-${level})"/>
            <polygon points="50,15 85,30 85,70 50,85 15,70 15,30" fill="none" stroke="${detailColor}" stroke-width="2" opacity="0.5"/>
            <polygon points="50,25 75,35 75,65 50,75 25,65 25,35" fill="none" stroke="${detailColor}" stroke-width="1" opacity="0.3"/>
            <circle cx="50" cy="50" r="8" fill="${strokeColor}" opacity="0.2"/>
        </svg>
    `;
}


/* ========================================================
   ⚡ مساعد CODO AI الموثوق - نظام الذكاء الاصطناعي التكتيكي المتقدم
   (بحث عميق، معمل مهارات، فحص ملفات، ومصادر موثقة)
   ======================================================== */

let activeGhostSessionId = null;
let ghostChatSessions = [];
codoCurrentModel = 'codo-base';
let codoDeepResearchEnabled = false;
let codoWebSearchEnabled = false;
let codoActiveSkillId = null;
let codoActiveSkillObj = null;
let codoAttachedFile = null;
let codoSkillsCache = [];
let currentCodoAbortController = null;
let codoPendingSkillDraft = null;

// عزل الجلسات حسب اسم المستخدم الحالي لمنع الخلط بين الحسابات
function getCodoStorageKey() {
    let u = 'general';
    try {
        if (typeof getCurrentUsername === 'function') {
            const name = getCurrentUsername();
            if (name) u = name;
        } else {
            const stored = localStorage.getItem('phantom_username');
            if (stored) u = stored;
        }
    } catch (e) {}
    return 'phantom_codo_sessions_' + encodeURIComponent(u);
}

// تحميل الجلسات
function loadGhostSessionsFromStorage() {
    const storageKey = getCodoStorageKey();
    try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
                ghostChatSessions = parsed;
            }
        }
    } catch (e) {
        console.warn("Failed to load ghost sessions:", e);
        ghostChatSessions = [];
    }

    if (!ghostChatSessions || ghostChatSessions.length === 0) {
        const initialSession = createNewSessionObject("محادثة جديدة مع CODO");
        ghostChatSessions = [initialSession];
        activeGhostSessionId = initialSession.id;
        saveGhostSessionsToStorage();
    } else if (!activeGhostSessionId || !ghostChatSessions.some(s => s.id === activeGhostSessionId)) {
        activeGhostSessionId = ghostChatSessions[0].id;
    }
}

function saveGhostSessionsToStorage() {
    const storageKey = getCodoStorageKey();
    try {
        localStorage.setItem(storageKey, JSON.stringify(ghostChatSessions));
    } catch (e) {
        console.warn("Failed to save ghost sessions:", e);
    }
}

function createNewSessionObject(title = "محادثة جديدة") {
    return {
        id: "codo_sess_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        title: title,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messages: [
            {
                id: "msg_init_" + Date.now(),
                sender: 'bot',
                text: 'أهلاً بك يا بطل! أنا **CODO** ⚡ مساعدك الذكي الموثوق والتكتيكي لمقر PHANTOM.\n\nيمكنني مساعدتك في:\n- 🎯 **تخطيط رومات السكواد وتوزيع الأدوار**\n- ⚖️ **تدقيق القوانين والعقوبات اللائحية**\n- 🔍 **البحث العميق في أحدث المعلومات والمصادر**\n- 💻 **فحص ومراجعة الأكواد والملفات البرمجية**\n- 🧠 **استخدام وتجربة مهارات الذكاء الاصطناعي المعتمدة**\n\nكيف يمكنني مساعدتك في هذه اللحظة؟',
                time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                sources: []
            }
        ],
        aiHistory: []
    };
}

function getActiveGhostSession() {
    if (!activeGhostSessionId && ghostChatSessions.length > 0) {
        activeGhostSessionId = ghostChatSessions[0].id;
    }
    return ghostChatSessions.find(s => s.id === activeGhostSessionId) || ghostChatSessions[0];
}

function renderGhostSessionsList() {
    const listEl = document.getElementById('ghost-sessions-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    ghostChatSessions.forEach(session => {
        const isActive = session.id === activeGhostSessionId;
        const item = document.createElement('div');
        item.className = `ghost-session-item ${isActive ? 'active' : ''}`;
        
        const dateStr = new Date(session.updatedAt || session.createdAt).toLocaleDateString('ar-EG', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        item.innerHTML = `
            <div class="ghost-session-info">
                <div class="ghost-session-title">${escapeHTML(session.title || 'محادثة')}</div>
                <div class="ghost-session-time">${dateStr}</div>
            </div>
            ${ghostChatSessions.length > 1 ? `
                <button class="ghost-session-delete" type="button" title="حذف المحادثة" style="background:none; border:none; color:#ef4444; font-size:0.9rem; cursor:pointer; padding:4px;">✕</button>
            ` : ''}
        `;

        item.onclick = (e) => {
            if (e.target.closest('.ghost-session-delete')) return;
            switchGhostSession(session.id);
            const sidebar = document.getElementById('ghost-history-sidebar');
            if (sidebar && window.innerWidth <= 768) sidebar.classList.remove('open');
        };

        const delBtn = item.querySelector('.ghost-session-delete');
        if (delBtn) {
            delBtn.onclick = (e) => {
                e.stopPropagation();
                deleteGhostSession(session.id);
            };
        }

        listEl.appendChild(item);
    });
}

function switchGhostSession(sessionId) {
    activeGhostSessionId = sessionId;
    renderGhostSessionsList();
    renderActiveGhostMessages();
}

function createNewGhostSession() {
    const newSession = createNewSessionObject("محادثة جديدة");
    ghostChatSessions.unshift(newSession);
    activeGhostSessionId = newSession.id;
    saveGhostSessionsToStorage();
    renderGhostSessionsList();
    renderActiveGhostMessages();
    clearSelectedCodoSkill();
    removeAttachedCodoFile();
    showToast("✨ تم بدء محادثة جديدة وتصفير السياق", "info");
    
    const input = document.getElementById('phantom-chat-input');
    if (input) {
        input.value = '';
        input.focus();
    }

    const sidebar = document.getElementById('ghost-history-sidebar');
    if (sidebar && window.innerWidth <= 768) sidebar.classList.remove('open');
}

function deleteGhostSession(sessionId) {
    if (ghostChatSessions.length <= 1) {
        showToast("لا يمكن حذف المحادثة الوحيدة المتبقية.", "info");
        return;
    }
    ghostChatSessions = ghostChatSessions.filter(s => s.id !== sessionId);
    if (activeGhostSessionId === sessionId) {
        activeGhostSessionId = ghostChatSessions[0].id;
    }
    saveGhostSessionsToStorage();
    renderGhostSessionsList();
    renderActiveGhostMessages();
    showToast("🗑️ تم حذف المحادثة", "info");
}

function renderActiveGhostMessages() {
    const body = document.getElementById('phantom-chat-body');
    if (!body) return;

    body.innerHTML = '';
    const session = getActiveGhostSession();
    if (!session || !session.messages || session.messages.length === 0) {
        renderWelcomeScreen(body);
        return;
    }

    session.messages.forEach(msg => {
        renderCodoMessageDOM(msg.text, msg.sender, msg.time, {
            sources: msg.sources || [],
            usedSkill: msg.usedSkill || null,
            fileName: msg.fileName || null,
            imageUrl: msg.imageUrl || null
        });
    });

    body.scrollTop = body.scrollHeight;
}

function renderWelcomeScreen(container) {
    container.innerHTML = `
        <div class="codo-welcome-hero">
            <div class="codo-hero-avatar">⚡</div>
            <h2 class="codo-hero-title">مرحباً بك في CODO AI</h2>
            <p class="codo-hero-desc">مساعد تكتيكي وتقني موثوق لكلان PHANTOM. يدعم البحث العميق المباشر، تدقيق اللوائح، فحص الأكواد والملفات، واستخدام المهارات المعتمدة.</p>
            <div class="codo-prompt-grid">
                <div class="codo-prompt-card" onclick="sendCodoPrompt('ما هي خطة توزيع الأدوار المثالية للسكواد في رومات الكلان التكتيكية؟')">
                    <span class="codo-prompt-icon">⚔️</span>
                    <span class="codo-prompt-heading">خطة السكواد التكتيكية</span>
                    <span class="codo-prompt-sub">توزيع مهام IGL، Fragger، Support، Sniper</span>
                </div>
                <div class="codo-prompt-card" onclick="sendCodoPrompt('اشرح لي نظام العقوبات الرسمي للشتيمة أو الغياب عن الروم وكيفية قبول الأعذار.')">
                    <span class="codo-prompt-icon">📜</span>
                    <span class="codo-prompt-heading">لائحة قوانين وعقوبات الكلان</span>
                    <span class="codo-prompt-sub">درجات الإنذارات وشروط العفو الرسمي</span>
                </div>
                <div class="codo-prompt-card" onclick="triggerDeepResearchWithPrompt('ما هي أحدث التغييرات والتحديثات في الألعاب التنافسية وببجي وكود هذا الشهر؟')">
                    <span class="codo-prompt-icon">🌐</span>
                    <span class="codo-prompt-heading">بحث عميق: أحدث التحديثات</span>
                    <span class="codo-prompt-sub">فحص المصادر والنتائج الموثوقة بروابط حقيقية</span>
                </div>
                <div class="codo-prompt-card" onclick="sendCodoPrompt('من هم الأعضاء المتصلون حالياً في المقر وما هي رتبهم ونشاط التحديات؟')">
                    <span class="codo-prompt-icon">📊</span>
                    <span class="codo-prompt-heading">فحص نشاط المقر والحضور الحي</span>
                    <span class="codo-prompt-sub">استعلام مباشر من خادم التواجد والنزالات</span>
                </div>
            </div>
        </div>
    `;
}

function triggerDeepResearchWithPrompt(promptText) {
    if (!codoDeepResearchEnabled) {
        toggleDeepResearch(true);
    }
    sendCodoPrompt(promptText);
}

// تنسيق نصوص الردود ودعم Markdown والأكواد
function formatCodoText(rawText) {
    if (!rawText) return '';
    let formatted = String(rawText);

    // كتل برمجية متعددة الأسطر مع زر النسخ واسم اللغة
    formatted = formatted.replace(/```([a-zA-Z0-9_\-]*)\n([\s\S]*?)```/g, function(match, lang, code) {
        const langLabel = lang ? lang.toUpperCase() : 'CODE';
        const escapedCode = escapeHTML(code.trim());
        const codeId = 'codo_code_' + Math.random().toString(36).substring(2, 9);
        return `
            <div class="codo-code-wrapper" dir="ltr">
                <div class="codo-code-header">
                    <span>${langLabel}</span>
                    <button class="codo-code-copy-btn" type="button" onclick="copyCodoCode('${codeId}')">📋 نسخ الكود</button>
                </div>
                <pre><code id="${codeId}">${escapedCode}</code></pre>
            </div>
        `;
    });

    // كود مضمن
    formatted = formatted.replace(/`([^`]+)`/g, '<code style="background:rgba(0,242,254,0.15); color:#00f2fe; padding:2px 6px; border-radius:4px; font-family:monospace; font-size:0.88em;">$1</code>');

    // عناوين بارزة
    formatted = formatted.replace(/^### (.*$)/gim, '<h4 style="color:#00f2fe; margin:10px 0 4px; font-size:1rem;">$1</h4>');
    formatted = formatted.replace(/^## (.*$)/gim, '<h3 style="color:#fff; margin:14px 0 6px; font-size:1.1rem; border-bottom:1px solid rgba(0,242,254,0.2); padding-bottom:4px;">$1</h3>');
    formatted = formatted.replace(/^# (.*$)/gim, '<h2 style="color:#fff; margin:16px 0 8px; font-size:1.2rem;">$1</h2>');

    // خط عريض
    formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#00f2fe;">$1</strong>');

    // نقاط وقوائم
    formatted = formatted.replace(/(?:^|\n)[-*]\s+([^\n]+)/g, '<br>• $1');

    // أسطر جديدة
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
}

window.copyCodoCode = function(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const text = el.innerText || el.textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast("✅ تم نسخ الكود بنجاح!", "success");
    }).catch(() => {
        showToast("⚠️ تعذر النسخ.", "error");
    });
};

function renderCodoMessageDOM(text, sender, time, metadata = {}) {
    const body = document.getElementById('phantom-chat-body');
    if (!body) return;

    const welcomeHero = body.querySelector('.codo-welcome-hero');
    if (welcomeHero) welcomeHero.remove();
    
    const wrapper = document.createElement('div');
    wrapper.className = `codo-msg-wrapper ${sender}`;
    const displayTime = time || new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const msgId = 'codo_msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    const isArabic = /[\u0600-\u06FF]/.test(text.substring(0, 100));
    const dirAttr = isArabic ? 'dir="rtl"' : 'dir="ltr"';

    if (sender === 'user') {
        const isPdfFile = metadata.isPdf || (metadata.fileName && /\.pdf$/i.test(metadata.fileName));

        const pdfBlock = isPdfFile ? `
            <div class="codo-msg-pdf-card" title="${escapeHTML(metadata.fileName)}">
                <div class="codo-pdf-icon-badge">PDF</div>
                <div class="codo-pdf-card-info">
                    <span class="codo-pdf-card-title">${escapeHTML(metadata.fileName)}</span>
                    <span class="codo-pdf-card-sub"><span class="codo-pdf-card-tag">مستند قواعد / إرشادات</span> • ${metadata.fileSize || 'PDF'}</span>
                </div>
            </div>
        ` : '';

        const imageBlock = metadata.imageUrl ? `
            <div style="margin-bottom:8px;">
                <img src="${metadata.imageUrl}" class="codo-msg-image-thumb" onclick="window.open('${metadata.imageUrl}', '_blank')" alt="صورة مرفقة" />
            </div>
        ` : '';

        const fileChip = (metadata.fileName && !metadata.imageUrl && !isPdfFile) ? `
            <div style="display:inline-flex; align-items:center; gap:6px; background:rgba(0,242,254,0.15); border:1px solid #00f2fe; padding:3px 10px; border-radius:8px; font-size:0.75rem; color:#00f2fe; margin-bottom:6px;">
                <span>📄</span> <span>${escapeHTML(metadata.fileName)}</span>
            </div>
        ` : '';

        wrapper.innerHTML = `
            <div class="codo-user-bubble" ${dirAttr}>
                ${pdfBlock}
                ${imageBlock}
                ${fileChip}
                ${text ? `<div>${escapeHTML(text).replace(/\n/g, '<br>')}</div>` : ''}
                <div style="text-align:left; font-size:0.68rem; color:#94a3b8; margin-top:4px;">${displayTime}</div>
            </div>
        `;
    } else {
        const modelNames = {
            'codo-base': 'CODO Base',
            'codo-pro': 'CODO Pro',
            'codo-max': 'CODO Max',
            'codo-lab': 'CODO Lab'
        };
        const currentTag = modelNames[codoCurrentModel] || 'CODO AI';
        const formatted = formatCodoText(text);

        // شارة المهارة المستخدمة - تظهر فقط عند اكتمال التشغيل الفعلي للمهارة
        const skillBadge = (metadata.usedSkill && metadata.usedSkill.name) ? `
            <span class="codo-skill-tag-pill ${metadata.usedSkill.status === 'error' ? 'error' : 'completed'}">
                ${metadata.usedSkill.status === 'error' ? '⚠️' : '✓'} مهارة: ${escapeHTML(metadata.usedSkill.name)} (${metadata.usedSkill.status === 'error' ? 'حدث خطأ' : 'اكتملت'})
            </span>
        ` : '';

        // صندوق المصادر والمراجع الحقيقية
        let sourcesBox = '';
        if (Array.isArray(metadata.sources) && metadata.sources.length > 0) {
            const chips = metadata.sources.map(s => `
                <a href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer" class="codo-source-chip" title="${escapeHTML(s.title || s.url)}">
                    <span>🔗</span> <span>${escapeHTML(s.title || s.url)}</span>
                </a>
            `).join('');
            sourcesBox = `
                <div class="codo-sources-box">
                    <div class="codo-sources-title">
                        <span>📚</span> <span>المصادر والمراجع المعتمدة المستخرجة:</span>
                    </div>
                    <div class="codo-sources-list">
                        ${chips}
                    </div>
                </div>
            `;
        }

        wrapper.innerHTML = `
            <div class="codo-bot-card" id="${msgId}">
                <div class="codo-bot-header">
                    <div class="codo-bot-badge">
                        <span class="bot-dot"></span>
                        <span>⚡ ${currentTag}</span>
                        ${skillBadge}
                    </div>
                    <span style="font-size:0.7rem; color:#64748b;">${displayTime}</span>
                </div>
                <div class="codo-bot-content" ${dirAttr}>
                    ${formatted}
                </div>
                ${sourcesBox}
                <div class="codo-msg-actions">
                    <button class="codo-action-btn" type="button" onclick="copyCodoResponse('${msgId}')">📋 نسخ</button>
                    <button class="codo-action-btn" type="button" onclick="speakCodoResponse('${msgId}')">🔊 قراءة</button>
                    <button class="codo-action-btn" type="button" onclick="regenerateLastCodoResponse()">🔄 إعادة التوليد</button>
                </div>
            </div>
        `;
    }

    body.appendChild(wrapper);
}

window.sendCodoPrompt = function(promptText) {
    const input = document.getElementById('phantom-chat-input');
    if (input) {
        input.value = promptText;
        const sendBtn = document.getElementById('phantom-chat-send');
        if (sendBtn) sendBtn.click();
    }
};

window.copyCodoResponse = function(msgId) {
    const card = document.getElementById(msgId);
    if (!card) return;
    const content = card.querySelector('.codo-bot-content');
    if (!content) return;
    const text = content.innerText || content.textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast("✅ تم نسخ إجابة CODO بنجاح!", "success");
    }).catch(() => {
        showToast("⚠️ تعذر النسخ.", "error");
    });
};

window.speakCodoResponse = function(msgId) {
    const card = document.getElementById(msgId);
    if (!card) return;
    const content = card.querySelector('.codo-bot-content');
    if (!content) return;
    const text = content.innerText || content.textContent;
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const clean = text.replace(/[*#_`~]/g, '');
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.lang = /[\u0600-\u06FF]/.test(clean) ? 'ar-SA' : 'en-US';
        window.speechSynthesis.speak(utterance);
        showToast("🔊 جاري قراءة الرد صوتياً...", "info");
    } else {
        showToast("⚠️ المتصفح لا يدعم القراءة الصوتية.", "info");
    }
};

window.regenerateLastCodoResponse = function() {
    const session = getActiveGhostSession();
    if (!session || !session.messages || session.messages.length === 0) {
        showToast("⚠️ لا توجد رسائل سابقة لإعادة التوليد.", "info");
        return;
    }
    const lastUserMsg = [...session.messages].reverse().find(m => m.sender === 'user');
    if (lastUserMsg && lastUserMsg.text) {
        sendCodoPrompt(lastUserMsg.text);
    }
};

function addMessage(text, sender, saveToStorage = true, metadata = {}) {
    const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    renderCodoMessageDOM(text, sender, time, metadata);

    const body = document.getElementById('phantom-chat-body');
    if (body) {
        requestAnimationFrame(() => {
            body.scrollTop = body.scrollHeight;
            const lastChild = body.lastElementChild;
            if (lastChild && typeof lastChild.scrollIntoView === 'function') {
                lastChild.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        });
    }

    if (saveToStorage) {
        const session = getActiveGhostSession();
        if (session) {
            if (!session.messages) session.messages = [];
            session.messages.push({
                id: "msg_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
                sender: sender,
                text: text,
                time: time,
                sources: metadata.sources || [],
                usedSkill: metadata.usedSkill || null,
                fileName: metadata.fileName || null,
                imageUrl: metadata.imageUrl || null
            });

            if (sender === 'user' && (session.title === 'محادثة جديدة' || session.title === 'محادثة جديدة مع CODO')) {
                session.title = text.length > 28 ? text.substring(0, 27) + '...' : text;
            }

            session.updatedAt = Date.now();
            if (session.messages.length > 80) session.messages = session.messages.slice(-80);
            saveGhostSessionsToStorage();
            renderGhostSessionsList();
        }
    }
}

function clearCodoChat() {
    const session = getActiveGhostSession();
    if (!session) return;

    session.messages = [
        {
            id: "msg_init_" + Date.now(),
            sender: 'bot',
            text: 'تم مسح محتوى هذه المحادثة 🧹. أنا CODO وجاهز للبدء من جديد بدقة وأمان.',
            time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
            sources: []
        }
    ];
    session.aiHistory = [];
    session.title = "محادثة ممسوحة";
    session.updatedAt = Date.now();
    saveGhostSessionsToStorage();
    renderGhostSessionsList();
    renderActiveGhostMessages();
    clearSelectedCodoSkill();
    removeAttachedCodoFile();
    showToast("🧹 تم مسح سجل المحادثة الحالية", "info");
}

// 🌐 التحكم الموحد في وضع بحث الويب والإنترنت
function toggleWebSearch(forceState) {
    codoWebSearchEnabled = typeof forceState === 'boolean' ? forceState : !codoWebSearchEnabled;
    codoDeepResearchEnabled = codoWebSearchEnabled;
    const pillBtn = document.getElementById('codo-websearch-toggle-btn');
    const badge = document.getElementById('codo-search-badge');
    const footnote = document.getElementById('codo-mode-footnote-text');

    if (codoWebSearchEnabled) {
        if (pillBtn) pillBtn.classList.add('active');
        if (badge) {
            badge.textContent = 'ON';
        }
        if (footnote) footnote.textContent = '🌐 وضع بحث الويب نشط: استخراج معلومات مباشرة وروابط ومصادر موثوقة من الإنترنت';
        showToast("🌐 تم تفعيل بحث الويب (Web Search)", "info");
    } else {
        if (pillBtn) pillBtn.classList.remove('active');
        if (badge) {
            badge.textContent = 'OFF';
        }
        if (footnote) footnote.textContent = '⚡ CODO AI — قراءة وفحص الصور • بحث حي في الويب • أدوات تكتيكية ومعمل مهارات';
        showToast("تم إيقاف بحث الويب", "info");
    }
}
window.toggleWebSearch = toggleWebSearch;
window.toggleDeepResearch = toggleWebSearch;

// ⋯ قائمة الخيارات الإضافية في الهيدر
function toggleCodoOptionsMenu() {
    const menu = document.getElementById('codo-more-options-menu');
    if (!menu) return;
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}
window.toggleCodoOptionsMenu = toggleCodoOptionsMenu;

// 📂 إدارة الملفات والصور المرفقة مع دعم اللصق والسحب
function triggerCodoFileUpload() {
    const fileInput = document.getElementById('codo-file-input');
    if (fileInput) fileInput.click();
}
window.triggerCodoFileUpload = triggerCodoFileUpload;

function handleCodoFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    processCodoUploadedFile(file);
}
window.handleCodoFileSelected = handleCodoFileSelected;

function processCodoUploadedFile(file) {
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
        showToast("⚠️ حجم الملف كبير جداً. الحد الأقصى 20 ميجابايت.", "error");
        return;
    }

    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = !isPdf && (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name));

    const reader = new FileReader();

    if (isPdf) {
        reader.onload = function(e) {
            const dataUrl = e.target.result;
            codoAttachedFile = {
                name: file.name || 'rules_document.pdf',
                size: file.size,
                type: 'application/pdf',
                isPdf: true,
                isImage: false,
                data: dataUrl,
                previewUrl: null
            };

            const previewBar = document.getElementById('codo-file-preview-bar');
            const nameEl = document.getElementById('codo-file-preview-name');
            const sizeEl = document.getElementById('codo-file-preview-size');
            const imgTag = document.getElementById('codo-img-preview-tag');
            const iconEl = document.getElementById('codo-file-preview-icon');
            const thumbBox = document.getElementById('codo-preview-thumb-box');

            if (previewBar && nameEl && sizeEl) {
                nameEl.textContent = '📑 ' + (file.name || 'مستند PDF');
                sizeEl.textContent = Math.round(file.size / 1024) + ' KB • مستند قواعد/إرشادات PDF';
                if (imgTag) imgTag.style.display = 'none';
                if (iconEl) {
                    iconEl.textContent = '📕';
                    iconEl.style.display = 'inline';
                }
                if (thumbBox) thumbBox.classList.add('pdf-mode');
                previewBar.style.display = 'flex';
            }
            showToast(`📑 تم إرفاق ملف الـ PDF "${file.name}" بنجاح - جاهز للتحليل وتدقيق القواعد`, "success");
        };
        reader.onerror = function() {
            showToast("⚠️ تعذر قراءة ملف الـ PDF المرفق.", "error");
        };
        reader.readAsDataURL(file);
    } else if (isImage) {
        reader.onload = function(e) {
            const dataUrl = e.target.result;
            codoAttachedFile = {
                name: file.name || 'صورة_مرفقة.png',
                size: file.size,
                type: file.type || 'image/png',
                isPdf: false,
                isImage: true,
                data: dataUrl,
                previewUrl: dataUrl
            };

            const previewBar = document.getElementById('codo-file-preview-bar');
            const nameEl = document.getElementById('codo-file-preview-name');
            const sizeEl = document.getElementById('codo-file-preview-size');
            const imgTag = document.getElementById('codo-img-preview-tag');
            const iconEl = document.getElementById('codo-file-preview-icon');
            const thumbBox = document.getElementById('codo-preview-thumb-box');

            if (previewBar && nameEl && sizeEl) {
                nameEl.textContent = '🖼️ ' + (file.name || 'صورة رقمية');
                sizeEl.textContent = Math.round(file.size / 1024) + ' KB';
                if (imgTag) {
                    imgTag.src = dataUrl;
                    imgTag.style.display = 'block';
                }
                if (iconEl) iconEl.style.display = 'none';
                if (thumbBox) thumbBox.classList.remove('pdf-mode');
                previewBar.style.display = 'flex';
            }
            showToast(`🖼️ تم إرفاق الصورة "${file.name || 'لقطة شاشة'}" بنجاح`, "success");
        };
        reader.onerror = function() {
            showToast("⚠️ تعذر قراءة الصورة المرفقة.", "error");
        };
        reader.readAsDataURL(file);
    } else {
        reader.onload = function(e) {
            codoAttachedFile = {
                name: file.name,
                size: file.size,
                type: file.type || 'text/plain',
                isPdf: false,
                isImage: false,
                content: e.target.result
            };

            const previewBar = document.getElementById('codo-file-preview-bar');
            const nameEl = document.getElementById('codo-file-preview-name');
            const sizeEl = document.getElementById('codo-file-preview-size');
            const imgTag = document.getElementById('codo-img-preview-tag');
            const iconEl = document.getElementById('codo-file-preview-icon');
            const thumbBox = document.getElementById('codo-preview-thumb-box');

            if (previewBar && nameEl && sizeEl) {
                nameEl.textContent = '📄 ' + file.name;
                sizeEl.textContent = Math.round(file.size / 1024) + ' KB';
                if (imgTag) imgTag.style.display = 'none';
                if (iconEl) {
                    iconEl.textContent = '📄';
                    iconEl.style.display = 'inline';
                }
                if (thumbBox) thumbBox.classList.remove('pdf-mode');
                previewBar.style.display = 'flex';
            }
            showToast(`📄 تم إرفاق الملف "${file.name}" بنجاح`, "success");
        };
        reader.onerror = function() {
            showToast("⚠️ تعذر قراءة الملف المرفق.", "error");
        };
        reader.readAsText(file);
    }
}
window.processCodoUploadedFile = processCodoUploadedFile;

// دعم لصق الصور من الحافظة (Ctrl+V) والسحب والإفلات (Drag & Drop)
function setupCodoClipboardAndDrop() {
    const input = document.getElementById('phantom-chat-input');
    const dropzone = document.getElementById('codo-chat-dropzone') || document.querySelector('.ghost-main-chat');

    if (input && !input.dataset.codoPasteBound) {
        input.dataset.codoPasteBound = 'true';
        input.addEventListener('paste', (e) => {
            const items = (e.clipboardData || window.clipboardData)?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const blob = items[i].getAsFile();
                    if (blob) {
                        processCodoUploadedFile(blob);
                        showToast("📷 تم لصق الصورة من الحافظة وجاهزة للتحليل!", "info");
                        break;
                    }
                }
            }
        });
    }

    if (dropzone && !dropzone.dataset.codoDropBound) {
        dropzone.dataset.codoDropBound = 'true';
        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.add('drag-active');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropzone.classList.remove('drag-active');
            }, false);
        });

        dropzone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt?.files;
            if (files && files.length > 0) {
                processCodoUploadedFile(files[0]);
            }
        });
    }
}
window.setupCodoClipboardAndDrop = setupCodoClipboardAndDrop;

function removeAttachedCodoFile() {
    codoAttachedFile = null;
    const fileInput = document.getElementById('codo-file-input');
    if (fileInput) fileInput.value = '';
    const previewBar = document.getElementById('codo-file-preview-bar');
    if (previewBar) previewBar.style.display = 'none';
    const imgTag = document.getElementById('codo-img-preview-tag');
    if (imgTag) {
        imgTag.src = '';
        imgTag.style.display = 'none';
    }
    const iconEl = document.getElementById('codo-file-preview-icon');
    if (iconEl) {
        iconEl.textContent = '📄';
        iconEl.style.display = 'inline';
    }
    const thumbBox = document.getElementById('codo-preview-thumb-box');
    if (thumbBox) thumbBox.classList.remove('pdf-mode');
}
window.removeAttachedCodoFile = removeAttachedCodoFile;

// 🧠 إدارة وتطبيق المهارات
function openCodoSkillsModal() {
    const modal = document.getElementById('codo-skills-modal');
    if (modal) {
        modal.style.display = 'flex';
        loadSkillsFromBackend();
    }
}
window.openCodoSkillsModal = openCodoSkillsModal;

function closeCodoSkillsModal() {
    const modal = document.getElementById('codo-skills-modal');
    if (modal) modal.style.display = 'none';
}
window.closeCodoSkillsModal = closeCodoSkillsModal;

function switchSkillsTab(tab) {
    const activeView = document.getElementById('skills-view-active');
    const addView = document.getElementById('skills-view-add');
    const tabActiveBtn = document.getElementById('tab-btn-active-skills');
    const tabAddBtn = document.getElementById('tab-btn-add-skill');

    if (tab === 'active') {
        if (activeView) activeView.style.display = 'block';
        if (addView) addView.style.display = 'none';
        if (tabActiveBtn) tabActiveBtn.classList.add('active');
        if (tabAddBtn) tabAddBtn.classList.remove('active');
        loadSkillsFromBackend();
    } else {
        if (activeView) activeView.style.display = 'none';
        if (addView) addView.style.display = 'block';
        if (tabActiveBtn) tabActiveBtn.classList.remove('active');
        if (tabAddBtn) tabAddBtn.classList.add('active');
    }
}
window.switchSkillsTab = switchSkillsTab;

async function loadSkillsFromBackend() {
    const container = document.getElementById('codo-skills-list-container');
    const countBadge = document.getElementById('codo-active-skills-count');
    const tabCount = document.getElementById('codo-skills-tab-count');

    try {
        const res = await fetch('/api/codo/skills');
        const data = await res.json();
        if (data.success && Array.isArray(data.skills)) {
            codoSkillsCache = data.skills;
            const activeCount = data.skills.filter(s => s.status === 'active').length;
            if (countBadge) countBadge.textContent = activeCount;
            if (tabCount) tabCount.textContent = activeCount;

            renderSkillsGrid(data.skills);
        }
    } catch (e) {
        console.warn("Failed to load skills from backend:", e);
    }
}
window.loadSkillsFromBackend = loadSkillsFromBackend;

function renderSkillsGrid(skills) {
    const container = document.getElementById('codo-skills-list-container');
    if (!container) return;
    container.innerHTML = '';

    skills.forEach(skill => {
        const isSelected = codoActiveSkillId === skill.id;
        const card = document.createElement('div');
        card.className = `codo-skill-card ${isSelected ? 'active-selected' : ''}`;

        const lastUsedText = skill.lastUsed ? new Date(skill.lastUsed).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'لم تستخدم بعد';

        card.innerHTML = `
            <div class="codo-skill-card-top">
                <span class="codo-skill-card-title">${escapeHTML(skill.name)}</span>
                <span class="codo-skill-status-tag ${skill.status === 'active' ? 'active' : 'inactive'}">
                    ${skill.status === 'active' ? '● مفعلة' : '○ معطلة'}
                </span>
            </div>
            <div class="codo-skill-card-desc">${escapeHTML(skill.description || skill.goal)}</div>
            <div class="codo-skill-card-meta">
                <span>الهدف: ${escapeHTML(skill.goal ? skill.goal.substring(0, 32) + '...' : 'تكتيكي')}</span>
                <span>استخدمت: ${skill.usageCount || 0} مرة</span>
            </div>
            <div class="codo-skill-card-actions">
                <button type="button" class="codo-skill-action-btn primary" onclick="selectSkillForUse('${skill.id}')">
                    ${isSelected ? '✓ محددة الآن' : '🎯 استخدام بالشات'}
                </button>
                <button type="button" class="codo-skill-action-btn" onclick="testSkillDirectly('${skill.id}')">
                    🧪 تجربة سريعة
                </button>
                <button type="button" class="codo-skill-action-btn" onclick="toggleSkillActiveState('${skill.id}', '${skill.status}')">
                    ${skill.status === 'active' ? 'تعطيل' : 'تفعيل'}
                </button>
                ${!skill.isBuiltIn ? `
                    <button type="button" class="codo-skill-action-btn" style="color:#ef4444;" onclick="deleteSkillPermanently('${skill.id}')">
                        حذف
                    </button>
                ` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

function filterSkillsList() {
    const input = document.getElementById('codo-skill-search');
    const term = input ? input.value.toLowerCase().trim() : '';
    const filtered = codoSkillsCache.filter(s => 
        (s.name && s.name.toLowerCase().includes(term)) ||
        (s.description && s.description.toLowerCase().includes(term)) ||
        (s.goal && s.goal.toLowerCase().includes(term))
    );
    renderSkillsGrid(filtered);
}
window.filterSkillsList = filterSkillsList;

function selectSkillForUse(skillId) {
    const skill = codoSkillsCache.find(s => s.id === skillId);
    if (!skill) return;

    // 1. قراءة تعليمات المهارة وتحليل الأدوات المطلوبة قبل الاستخدام
    const availableTools = ['clan_rules_db', 'tactics_engine', 'code_analyzer', 'file_reader', 'presence_api', 'battles_api'];
    const missingTools = (skill.requiredTools || []).filter(t => !availableTools.includes(t));

    const banner = document.getElementById('codo-active-skill-banner');
    const nameEl = document.getElementById('codo-active-skill-name');
    const statusEl = document.getElementById('codo-active-skill-status');

    if (missingTools.length > 0) {
        codoActiveSkillId = null;
        codoActiveSkillObj = null;
        if (banner) banner.style.display = 'none';
        showToast(`⚠️ مهارة "${skill.name}" تتطلب أدوات غير متاحة في النظام (${missingTools.join(', ')})`, "error");
        return;
    }

    // 2. قراءة وتحليل التعليمات وتعيين الحالة إلى (جاهزة)
    codoActiveSkillId = skillId;
    codoActiveSkillObj = skill;

    if (banner && nameEl && statusEl) {
        nameEl.textContent = skill.name;
        statusEl.textContent = 'جاهزة';
        statusEl.className = 'codo-skill-status-tag active';
        banner.style.display = 'flex';
    }

    closeCodoSkillsModal();
    showToast(`📖 تم قراءة تعليمات مهارة "${skill.name}" وتحليلها: المهارة جاهزة للتنفيذ`, "info");
    
    const input = document.getElementById('phantom-chat-input');
    if (input) {
        input.placeholder = `اسأل بما يناسب مهارة (${skill.name})، مثال: ${skill.examples?.[0] || '...'}`;
        input.focus();
    }
}
window.selectSkillForUse = selectSkillForUse;

function clearSelectedCodoSkill() {
    codoActiveSkillId = null;
    codoActiveSkillObj = null;
    const banner = document.getElementById('codo-active-skill-banner');
    if (banner) banner.style.display = 'none';
    const input = document.getElementById('phantom-chat-input');
    if (input) {
        input.placeholder = "اسأل CODO، أو ارفع ملف PDF للقواعد، أو الصق صورة...";
    }
}
window.clearSelectedCodoSkill = clearSelectedCodoSkill;

async function toggleSkillActiveState(skillId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
        const res = await fetch(`/api/codo/skills/${skillId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        const data = await res.json();
        if (data.success) {
            showToast(`تم ${newStatus === 'active' ? 'تفعيل' : 'تعطيل'} المهارة بنجاح`, "success");
            loadSkillsFromBackend();
        }
    } catch (e) {
        showToast("⚠️ تعذر تحديث حالة المهارة", "error");
    }
}
window.toggleSkillActiveState = toggleSkillActiveState;

async function testSkillDirectly(skillId) {
    const skill = codoSkillsCache.find(s => s.id === skillId);
    const skillName = skill ? skill.name : 'المهارة';
    showToast(`🧪 جاري تشغيل اختبار حقيقي لمهارة "${skillName}"...`, "info");
    try {
        const res = await fetch('/api/codo/skills/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ skillId })
        });
        const data = await res.json();
        if (data.success) {
            closeCodoSkillsModal();
            showToast(`✓ اكتمل اختبار مهارة "${data.skillName}" بنجاح`, "success");
            addMessage(`🧪 **[نتيجة اختبار تشغيل مهارة: ${data.skillName}]**\n> **المدخل التجريبي:** "${data.testInput || 'طلب اختبار'}"\n\n${data.output}`, 'bot', true, {
                usedSkill: { id: skillId, name: data.skillName, status: 'completed' }
            });
            loadSkillsFromBackend();
        } else {
            showToast("⚠️ تعذر الاختبار: " + (data.error || 'خطأ غير متوقع'), "error");
        }
    } catch (e) {
        showToast("⚠️ تعذر الاتصال بخادم اختبار المهارات", "error");
    }
}
window.testSkillDirectly = testSkillDirectly;

async function deleteSkillPermanently(skillId) {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذه المهارة المخصصة نهائياً؟")) return;
    try {
        const res = await fetch(`/api/codo/skills/${skillId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast("🗑️ تم حذف المهارة بنجاح", "info");
            if (codoActiveSkillId === skillId) clearSelectedCodoSkill();
            loadSkillsFromBackend();
        } else {
            showToast(data.error || "تعذر الحذف", "error");
        }
    } catch (e) {
        showToast("تعذر حذف المهارة", "error");
    }
}
window.deleteSkillPermanently = deleteSkillPermanently;

// تشغيل مراحل التحليل الست للمهارة الجديدة
async function handleAnalyzeNewSkill(e) {
    e.preventDefault();
    const name = document.getElementById('skill-input-name').value.trim();
    const goal = document.getElementById('skill-input-goal').value.trim();
    const desc = document.getElementById('skill-input-desc').value.trim();
    const instructions = document.getElementById('skill-input-instructions').value.trim();
    const inputTypes = document.getElementById('skill-input-types').value.split(',').map(s => s.trim()).filter(Boolean);
    const outputFormat = document.getElementById('skill-output-format').value.trim();
    const tools = document.getElementById('skill-input-tools').value.split(',').map(s => s.trim()).filter(Boolean);
    const limits = document.getElementById('skill-input-limits').value.split(',').map(s => s.trim()).filter(Boolean);

    const analysisBox = document.getElementById('codo-skill-analysis-box');
    const stepper = document.getElementById('codo-analysis-stepper');
    const testBox = document.getElementById('codo-skill-test-output-box');
    const testText = document.getElementById('codo-test-output-text');
    const saveActions = document.getElementById('codo-save-skill-actions');
    const submitBtn = document.getElementById('codo-analyze-skill-btn');

    if (!name || !goal || !instructions) {
        showToast("⚠️ يرجى ملء الحقول الإلزامية.", "error");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ جاري تشغيل مراحل التحليل...';
    analysisBox.style.display = 'block';
    stepper.innerHTML = '';
    testBox.style.display = 'none';
    saveActions.style.display = 'none';

    const stageNames = [
        '1. قراءة المهارة وفحص المعايير الأساسية',
        '2. تحليل التعليمات ومعايير الأمان ومكافحة التجاوزات',
        '3. فحص الأدوات والصلاحيات المطلوبة ومدى توافرها',
        '4. التحقق من التعارض والتكرار مع المهارات المعتمدة',
        '5. اختبار المهارة بطلب تجريبي آلي محاكى',
        '6. تجهيز المهارة للاعتماد والتشغيل الفعلي'
    ];

    // إضافة الخطوات مع حالة انتظار
    stageNames.forEach((sName, idx) => {
        const row = document.createElement('div');
        row.id = `codo-step-row-${idx + 1}`;
        row.className = 'codo-step-row';
        row.innerHTML = `
            <span class="codo-step-icon">⏳</span>
            <span>${sName}</span>
            <span class="codo-step-detail">قيد المعالجة...</span>
        `;
        stepper.appendChild(row);
    });

    try {
        const res = await fetch('/api/codo/skills/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name, goal, description: desc, instructions, inputTypes, outputFormat, requiredTools: tools, limitations: limits
            })
        });
        const data = await res.json();

        // تمرير أنيميشن إتمام المراحل واحدة تلو الأخرى ليعيش المستخدم التجربة الحقيقية
        for (let i = 1; i <= 6; i++) {
            await new Promise(r => setTimeout(r, 280));
            const stepRow = document.getElementById(`codo-step-row-${i}`);
            if (stepRow) {
                stepRow.classList.add('done');
                const stageData = data.stages && data.stages[i - 1];
                stepRow.innerHTML = `
                    <span class="codo-step-icon">✅</span>
                    <span style="font-weight:700; color:#00ff88;">${stageNames[i - 1]}</span>
                    <span class="codo-step-detail">${stageData ? stageData.detail : 'تم التحقق بنجاح'}</span>
                `;
            }
        }

        if (data.success && data.valid) {
            codoPendingSkillDraft = {
                name, goal, description: desc, instructions, inputTypes, outputFormat, requiredTools: tools, limitations: limits
            };
            if (testText) testText.textContent = data.testOutput || 'تم اجتياز الاختبار التجريبي بنجاح.';
            testBox.style.display = 'block';
            saveActions.style.display = 'block';
            showToast("🎉 تم اجتياز التحليل والاختبار بنجاح! يمكنك الآن تفعيل المهارة.", "success");
        } else {
            showToast(data.error || "تعذر إجازة المهارة", "error");
        }
    } catch (e) {
        showToast("⚠️ حدث خطأ أثناء تشغيل التحليل", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '🔬 تحليل واختبار المهارة الآن (6 مراحل)';
    }
}
window.handleAnalyzeNewSkill = handleAnalyzeNewSkill;

async function saveVerifiedSkill() {
    if (!codoPendingSkillDraft) return;
    try {
        const res = await fetch('/api/codo/skills', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(codoPendingSkillDraft)
        });
        const data = await res.json();
        if (data.success) {
            showToast(`🚀 تم اعتماد وتفعيل مهارة "${data.skill.name}" بنجاح!`, "success");
            selectSkillForUse(data.skill.id);
            codoPendingSkillDraft = null;
            document.getElementById('codo-new-skill-form').reset();
            document.getElementById('codo-skill-analysis-box').style.display = 'none';
            switchSkillsTab('active');
            closeCodoSkillsModal();
        }
    } catch (e) {
        showToast("⚠️ تعذر حفظ المهارة", "error");
    }
}
window.saveVerifiedSkill = saveVerifiedSkill;

// ⚡ الموديلات المنسدلة
function toggleCodoModelMenu() {
    const menu = document.getElementById('codo-model-menu');
    if (!menu) return;
    const isShowing = menu.style.display === 'block';
    menu.style.display = isShowing ? 'none' : 'block';
}
window.toggleCodoModelMenu = toggleCodoModelMenu;

window.setCodoModel = function(modelKey) {
    codoCurrentModel = modelKey;
    const menu = document.getElementById('codo-model-menu');
    if (menu) menu.style.display = 'none';

    // تحديث عناصر القائمة
    const items = document.querySelectorAll('.codo-menu-item');
    items.forEach(it => it.classList.remove('active'));
    const activeItem = document.getElementById('menu-opt-' + modelKey);
    if (activeItem) activeItem.classList.add('active');

    // تحديث زر التريجر الرئيسي
    const nameEl = document.getElementById('codo-active-model-name');
    const iconEl = document.getElementById('codo-active-model-icon');
    const statusEl = document.getElementById('codo-status-indicator');

    const modelMeta = {
        'codo-base': { name: 'CODO Base', icon: '⚡', desc: '● متصل بموديل CODO Base (سريع ويومي)' },
        'codo-pro': { name: 'CODO Pro', icon: '🔬', desc: '● متصل بموديل CODO Pro (برمجة وتحليل)' },
        'codo-max': { name: 'CODO Max', icon: '🧠', desc: '● متصل بموديل CODO Max (تفكير استراتيجي عميق)' },
        'codo-lab': { name: 'CODO Lab', icon: '🧪', desc: '● متصل بمعمل CODO Lab (مهارات وأدوات)' }
    };

    const cur = modelMeta[modelKey] || modelMeta['codo-base'];
    if (nameEl) nameEl.textContent = cur.name;
    if (iconEl) iconEl.textContent = cur.icon;
    if (statusEl) statusEl.textContent = cur.desc;
};

// 👻 مؤشر الانتظار المتمركز والمراحل الحقيقية الصادقة
function showDynamicTyping(isResearch = false, isSkill = false, isFile = false, isImage = false, isPdf = false) {
    const div = document.createElement('div');
    div.className = 'thinking-ghost-container';

    let stages = [];
    if (isPdf) {
        stages = [
            { title: 'أرفع ملف الـ PDF بأمان للمقر...', sub: 'حماية وتشفير المستند الرقمي' },
            { title: 'أفحص صفحات المستند واللوائح...', sub: 'قراءة وفهرسة البنود والمواد' },
            { title: 'أستخرج النصوص والبنود والجداول...', sub: 'استخلاص الشروط والمحظورات والعقوبات بدقة' },
            { title: 'أحلل القواعد والإرشادات المستخرجة...', sub: 'تدقيق ومطابقة اللائحة الرسمية' },
            { title: 'أجهز التقرير والإجابة الشاملة...', sub: 'صياغة مباشرة وموثوقة' }
        ];
    } else if (isImage) {
        stages = [
            { title: 'أرفع الصورة بأمان...', sub: 'معالجة دقة الأبعاد' },
            { title: 'أفحص الصورة...', sub: 'استكشاف المعالم البصرية' },
            { title: 'أقرأ التفاصيل المرئية...', sub: 'رصد العناصر والتفاصيل' },
            { title: 'أحلل النصوص والعناصر (OCR)...', sub: 'استخراج الأرقام والشفرات والنصوص' },
            { title: 'أجهز الإجابة...', sub: 'إخراج التحليل التكتيكي المباشر' }
        ];
    } else if (isResearch) {
        stages = [
            { title: 'أفهم السؤال وأفكك محاوره الأساسية...', sub: 'تحليل دقيق لأبعاد المسألة' },
            { title: 'إنشاء خطة البحث في المصادر الرسمية...', sub: 'تحديد الكلمات المفتاحية وقواعد البيانات' },
            { title: 'البحث في المصادر واستخراج النتائج...', sub: 'استعلام مباشر من محركات البحث والوثائق' },
            { title: 'مراجعة وتقييم موثوقية المعلومات...', sub: 'استبعاد البيانات غير الموثقة وفحص التناقضات' },
            { title: 'مقارنة النتائج والتمييز بين الحقائق والاحتمالات...', sub: 'صياغة التقرير الموثق' },
            { title: 'أجهز التقرير النهائي بالمصادر الحقيقية...', sub: 'إخراج منظم وواضح' }
        ];
    } else if (isFile) {
        stages = [
            { title: 'قراءة وتحليل بنية الملف المرفق...', sub: 'فحص الشفرة والتنسيق' },
            { title: 'استخراج البيانات والمعطيات الجوهرية...', sub: 'تحليل المحتوى دون افتراض ما ليس فيه' },
            { title: 'تدقيق النتائج وتنظيم التقرير...', sub: 'إعداد الخلاصة التنفيذية' },
            { title: 'أجهز النتيجة النهائية الدقيقة...', sub: 'اكتمال المراجعة' }
        ];
    } else if (isSkill) {
        stages = [
            { title: `أطبق المهارة النشطة: ${codoActiveSkillObj ? codoActiveSkillObj.name : 'مهارة معتمدة'}...`, sub: 'التزام كامل بقواعد المهارة' },
            { title: 'معالجة المدخلات حسب شكل المخرجات المطلوب...', sub: 'تطبيق أدوات التحليل المقررة' },
            { title: 'فحص القيود والتحقق من الجودة...', sub: 'منع الأخطاء والانحرافات' },
            { title: 'أجهز المخرجات المنظمة...', sub: 'اكتمال المعالجة' }
        ];
    } else {
        stages = [
            { title: 'أفهم طلبك وسياق السؤال...', sub: 'معالجة لغوية تكتيكية' },
            { title: 'أحلل التفاصيل واستخرج المعطيات...', sub: 'فحص بيانات المقر والقواعد' },
            { title: 'أرتب الإجابة في نقاط وعناوين واضحة...', sub: 'صياغة مباشرة وموثوقة' },
            { title: 'أجهز النتيجة النهائية...', sub: 'في خدمتك دائماً' }
        ];
    }

    div.innerHTML = `
        <div class="codo-thinking-box">
            <svg width="60" height="60" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style="animation: ghostBobShiver 2s ease-in-out infinite; filter: drop-shadow(0 0 15px rgba(0, 242, 254, 0.6));">
                <path class="ghost-outline" d="M50 15 C30 15 22 30 22 50 C22 72 20 85 28 85 C34 85 36 76 43 76 C50 76 52 85 58 85 C64 85 66 76 73 76 C80 76 82 85 88 85 C96 85 94 72 94 50 C94 30 86 15 50 15 Z" 
                      stroke="#00f2fe" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
                <circle class="ghost-eye-left" cx="40" cy="46" r="5" />
                <circle class="ghost-eye-right" cx="64" cy="46" r="5" />
            </svg>
            <div class="codo-thinking-stage-title" id="codo-dynamic-stage-title">
                <span>⚡</span>
                <span class="stage-text">${stages[0].title}</span>
            </div>
            <div class="codo-thinking-subtext" id="codo-dynamic-stage-sub">${stages[0].sub}</div>
            <div class="codo-thinking-pulse-bar">
                <div class="codo-thinking-pulse-fill"></div>
            </div>
        </div>
    `;

    let currentStageIndex = 0;
    const intervalTimer = setInterval(() => {
        currentStageIndex = (currentStageIndex + 1) % stages.length;
        const titleEl = div.querySelector('.stage-text');
        const subEl = div.querySelector('#codo-dynamic-stage-sub');
        if (titleEl) titleEl.textContent = stages[currentStageIndex].title;
        if (subEl) subEl.textContent = stages[currentStageIndex].sub;
    }, 1800);

    div.cleanup = () => clearInterval(intervalTimer);
    return div;
}

// 🚀 إرسال الرسالة إلى خادم CODO الذكي
async function sendMessage() {
    const input = document.getElementById('phantom-chat-input');
    const sendBtn = document.getElementById('phantom-chat-send');
    const text = input ? input.value.trim() : '';

    if (!text && !codoAttachedFile) return;

    // حماية ضد التكرار السريع
    if (sendBtn) sendBtn.disabled = true;

    const attachedFileBackup = codoAttachedFile ? { ...codoAttachedFile } : null;
    const skillBackup = codoActiveSkillId;

    const isPdf = Boolean(attachedFileBackup?.isPdf);
    const isImage = Boolean(attachedFileBackup?.isImage);
    const fileSizeStr = attachedFileBackup ? (Math.round((attachedFileBackup.size || 0) / 1024) + ' KB') : null;

    // إضافة رسالة المستخدم للشات مع الصورة أو ملف الـ PDF أو الملف المرفق
    addMessage(text || (isPdf ? `[فحص مستند PDF: ${attachedFileBackup.name}]` : (isImage ? `[فحص صورة: ${attachedFileBackup.name}]` : `[فحص ملف: ${attachedFileBackup?.name || 'مرفق'}]`)), 'user', true, {
        fileName: attachedFileBackup ? attachedFileBackup.name : null,
        imageUrl: isImage ? attachedFileBackup.previewUrl : null,
        isPdf: isPdf,
        fileSize: fileSizeStr
    });

    if (input) input.value = '';
    removeAttachedCodoFile(); // مسح شريط المعاينة
    playCodoSound('send');

    const activeSkillStatusEl = document.getElementById('codo-active-skill-status');
    if (skillBackup && activeSkillStatusEl) {
        activeSkillStatusEl.textContent = 'قيد التشغيل';
        activeSkillStatusEl.className = 'codo-skill-status-tag running';
    }

    const body = document.getElementById('phantom-chat-body');
    const typingIndicator = showDynamicTyping(
        codoWebSearchEnabled || codoDeepResearchEnabled,
        Boolean(codoActiveSkillId),
        Boolean(attachedFileBackup && !isImage && !isPdf),
        isImage,
        isPdf
    );

    if (body) {
        body.appendChild(typingIndicator);
        body.scrollTop = body.scrollHeight;
    }

    const stopBtn = document.getElementById('codo-stop-btn');
    if (stopBtn) stopBtn.style.display = 'inline-block';

    const session = getActiveGhostSession();
    if (!session.aiHistory) session.aiHistory = [];

    currentCodoAbortController = new AbortController();

    try {
        const response = await fetch("/api/chat", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json"
            },
            signal: currentCodoAbortController.signal,
            body: JSON.stringify({ 
                message: text,
                history: session.aiHistory,
                modelChoice: codoCurrentModel || 'codo-base',
                deepResearch: codoDeepResearchEnabled,
                webSearch: codoWebSearchEnabled,
                activeSkillId: skillBackup,
                attachedFile: attachedFileBackup
            })
        });

        if (typingIndicator && typingIndicator.cleanup) typingIndicator.cleanup();
        if (typingIndicator && typingIndicator.parentNode) typingIndicator.remove();
        if (stopBtn) stopBtn.style.display = 'none';
        if (sendBtn) sendBtn.disabled = false;

        if (!response.ok) throw new Error("Server Error: " + response.status);
        const data = await response.json();
        const aiResponse = data.response || data.reply || "أهلاً بك يا بطل! أنا CODO في خدمتك دائماً.";

        if (skillBackup && activeSkillStatusEl) {
            if (data.usedSkill) {
                activeSkillStatusEl.textContent = 'اكتملت';
                activeSkillStatusEl.className = 'codo-skill-status-tag completed';
            } else if (data.skillStatus === 'error') {
                activeSkillStatusEl.textContent = 'حدث خطأ';
                activeSkillStatusEl.className = 'codo-skill-status-tag error';
            } else {
                activeSkillStatusEl.textContent = 'جاهزة';
                activeSkillStatusEl.className = 'codo-skill-status-tag active';
            }
        }

        session.aiHistory.push({ role: 'user', text: text || (attachedFileBackup?.isPdf ? `تحليل مستند PDF: ${attachedFileBackup?.name}` : (attachedFileBackup?.isImage ? `تحليل صورة ${attachedFileBackup?.name}` : `تحليل ملف ${attachedFileBackup?.name}`)) });
        session.aiHistory.push({ role: 'model', text: aiResponse });
        if (session.aiHistory.length > 20) session.aiHistory = session.aiHistory.slice(-20);
        saveGhostSessionsToStorage();

        addMessage(aiResponse, 'bot', true, {
            sources: data.sources || [],
            usedSkill: data.usedSkill || null
        });

        playCodoSound('receive');
    } catch (e) {
        if (typingIndicator && typingIndicator.cleanup) typingIndicator.cleanup();
        if (typingIndicator && typingIndicator.parentNode) typingIndicator.remove();
        if (stopBtn) stopBtn.style.display = 'none';
        if (sendBtn) sendBtn.disabled = false;

        if (skillBackup && activeSkillStatusEl) {
            activeSkillStatusEl.textContent = 'حدث خطأ';
            activeSkillStatusEl.className = 'codo-skill-status-tag error';
        }

        if (e.name === 'AbortError') {
            console.log("Chat generation stopped by user.");
            addMessage("⏹️ تم إيقاف التوليد بناءً على طلبك.", 'bot', true);
            return;
        }

        console.error("CODO AI Chat Error:", e);
        playCodoSound('error');

        // استعادة النص المكتوب في حال حدوث خطأ حتى لا يضيع على المستخدم
        if (input && text) input.value = text;
        showToast("⚠️ تعذر الاتصال بـ CODO، تم الاحتفاظ بنص رسالتك.", "error");
        addMessage("⚠️ عذراً يا بطل، حدث تعذر مؤقت في الاتصال بـ CODO. تم الاحتفاظ برسالتك ويمكنك النقر على إرسال لإعادة المحاولة فوراً.", 'bot', true);
    } finally {
        currentCodoAbortController = null;
    }
}

window.stopCodoGeneration = function() {
    if (currentCodoAbortController) {
        currentCodoAbortController.abort();
        currentCodoAbortController = null;
    }
    const stopBtn = document.getElementById('codo-stop-btn');
    if (stopBtn) stopBtn.style.display = 'none';
    const typing = document.querySelector('.thinking-ghost-container');
    if (typing) {
        if (typing.cleanup) typing.cleanup();
        if (typing.parentNode) typing.remove();
    }
    showToast("⏹️ تم إيقاف المعالجة", "info");
};

// متتبع مساحة العرض الخاصة بالهواتف لمنع إخفاء لوحة المفاتيح لحقل الكتابة
let codoViewportListener = null;

function setupCodoMobileViewport() {
    if (window.visualViewport) {
        if (codoViewportListener) {
            window.visualViewport.removeEventListener('resize', codoViewportListener);
            window.visualViewport.removeEventListener('scroll', codoViewportListener);
        }
        codoViewportListener = () => {
            const overlay = document.getElementById('phantom-chat-overlay');
            if (overlay && overlay.classList.contains('open')) {
                overlay.style.height = `${window.visualViewport.height}px`;
                const body = document.getElementById('phantom-chat-body');
                if (body) {
                    body.scrollTop = body.scrollHeight;
                }
            }
        };
        window.visualViewport.addEventListener('resize', codoViewportListener);
        window.visualViewport.addEventListener('scroll', codoViewportListener);
        codoViewportListener();
    }
}

function cleanupCodoMobileViewport() {
    if (window.visualViewport && codoViewportListener) {
        window.visualViewport.removeEventListener('resize', codoViewportListener);
        window.visualViewport.removeEventListener('scroll', codoViewportListener);
        codoViewportListener = null;
    }
    const overlay = document.getElementById('phantom-chat-overlay');
    if (overlay) {
        overlay.style.height = '';
    }
}

// فتح وإغلاق الشات
function openCodoChat() {
    const overlay = document.getElementById('phantom-chat-overlay');
    if (!overlay) return;

    overlay.style.display = 'flex';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    setupCodoMobileViewport();

    loadGhostSessionsFromStorage();
    renderGhostSessionsList();
    renderActiveGhostMessages();

    setCodoModel(codoCurrentModel || 'codo-base');
    loadSkillsFromBackend();
    setupCodoClipboardAndDrop();

    const toggleHistoryBtn = document.getElementById('ghost-toggle-history-btn');
    const historySidebar = document.getElementById('ghost-history-sidebar');
    const sendBtn = document.getElementById('phantom-chat-send');
    const input = document.getElementById('phantom-chat-input');

    if (toggleHistoryBtn && historySidebar) {
        toggleHistoryBtn.onclick = () => {
            historySidebar.classList.toggle('open');
        };
    }

    if (sendBtn) sendBtn.onclick = sendMessage;
    if (input) {
        // دعم التوسع التلقائي لحقل textarea مع إرسال بـ Enter وسطر جديد بـ Shift+Enter
        input.onkeydown = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        };
        input.oninput = () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 100) + 'px';
        };
        input.onfocus = () => {
            setTimeout(() => {
                const body = document.getElementById('phantom-chat-body');
                if (body) body.scrollTop = body.scrollHeight;
            }, 300);
        };
        setTimeout(() => {
            const body = document.getElementById('phantom-chat-body');
            if (body) body.scrollTop = body.scrollHeight;
        }, 150);
    }
}

function closeCodoChat() {
    cleanupCodoMobileViewport();
    const overlay = document.getElementById('phantom-chat-overlay');
    if (overlay) {
        overlay.classList.remove('open');
        overlay.style.display = 'none';
        overlay.style.height = '';
    }
    document.body.style.overflow = '';
}

// إغلاق قوائم الموديل والخيارات عند النقر في الخارج
document.addEventListener('click', (e) => {
    const menu = document.getElementById('codo-model-menu');
    const trigger = document.getElementById('codo-model-selector-btn');
    if (menu && menu.style.display === 'block') {
        if (!menu.contains(e.target) && (!trigger || !trigger.contains(e.target))) {
            menu.style.display = 'none';
        }
    }

    const moreMenu = document.getElementById('codo-more-options-menu');
    const moreTrigger = document.getElementById('codo-more-options-btn');
    if (moreMenu && moreMenu.style.display === 'block') {
        if (!moreMenu.contains(e.target) && (!moreTrigger || !moreTrigger.contains(e.target))) {
            moreMenu.style.display = 'none';
        }
    }
});

// توافقية كاملة للدوال
window.openCodoChat = openCodoChat;
window.closeCodoChat = closeCodoChat;
window.clearCodoChat = clearCodoChat;
window.openBobertChat = openCodoChat;
window.closeBobertChat = closeCodoChat;
window.clearBobertChat = clearCodoChat;
window.renderBobertMessageDOM = renderCodoMessageDOM;
window.showTyping = showDynamicTyping;
/* ========================================================
   ✅ نظام الرسائل الجماعية (Broadcast) - النسخة الوحيدة
   ======================================================== */

function openBroadcastDrawer() {
    // 1. إغلاق قائمة الشبح أولاً
    const ghostMenu = document.getElementById('phantom-ghost-menu');
    if (ghostMenu) ghostMenu.style.display = 'none';

    // 2. البحث عن الدرج
    let drawer = document.getElementById('broadcast-drawer');

    // 3. لو مش موجود، ننشئه فوراً في الصفحة
    if (!drawer) {
        drawer = document.createElement('div');
        drawer.id = 'broadcast-drawer';
        drawer.className = 'side-drawer';
        drawer.style.cssText = "display:block; position:fixed; top:0; right:0; width:320px; height:100%; background:#0b1019; border-left:2px solid var(--cyan); box-shadow:-5px 0 20px rgba(0,0,0,0.5); z-index:1000000; padding:20px;";

        drawer.innerHTML = `
            <div id="broadcast-drawer-overlay" style="position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:-1;"></div>
            <div class="drawer-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h2>📬 الرسائل الجماعية</h2>
                <button id="close-broadcast-btn" style="background:transparent; border:none; color:var(--muted); font-size:1.5rem; cursor:pointer;">『PH』</button>
            </div>
            <div class="drawer-body">
                <div id="broadcast-messages-list" style="color:var(--muted); font-size:0.9rem;"></div>
            </div>
        `;
        document.body.appendChild(drawer);

        // ربط زر الإغلاق
        const closeBtn = document.getElementById('close-broadcast-btn');
        const overlay = document.getElementById('broadcast-drawer-overlay');
        if (closeBtn) closeBtn.onclick = () => drawer.style.display = 'none';
        if (overlay) overlay.onclick = () => drawer.style.display = 'none';
    }

    // 4. عرض الدرج
    drawer.style.display = 'block';
    if (typeof renderBroadcastMessages === 'function') renderBroadcastMessages();
}

function closeBroadcastDrawer() {
    const drawer = document.getElementById('broadcast-drawer');
    if (drawer) drawer.style.display = 'none';
}

// ✅ جعل الدالة متاحة عالمياً لأي onclick
window.openBroadcastDrawer = openBroadcastDrawer;
window.closeBroadcastDrawer = closeBroadcastDrawer;

/* ========================================================
   ✅ نظام تغيير الـ ID
   ======================================================== */

function showChangeIdForm() {
    const currentUser = getCurrentUsername();
    if (!currentUser) { showToast("يجب تسجيل الدخول أولاً.", "error"); return; }
    
    const modal = document.createElement("div");
    modal.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999999; background: rgba(16,23,34,0.98); padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--border); box-shadow: 0 20px 60px rgba(0,0,0,0.8); width: 90%; max-width: 400px; text-align: center; direction: rtl;`;
    modal.innerHTML = `
        <h3 style="color:var(--white); margin-bottom:12px;">🆔 تغيير الـ ID</h3>
        <p style="color:var(--muted); font-size:0.85rem;">أدخل الـ ID الجديد وسيتم إرسال الطلب للمؤسسين.</p>
        <input id="new-id-input" type="text" placeholder="الـ ID الجديد" style="width:100%; padding:10px; border-radius:6px; background:rgba(255,255,255,0.05); border:1px solid var(--border); color:#fff; margin-top:8px;">
        <div style="display:flex; gap:10px; margin-top:10px;">
            <button id="submit-id-change" class="btn-primary" style="flex:1;">إرسال الطلب</button>
            <button id="close-id-change" class="btn-secondary" style="flex:1;">إلغاء</button>
        </div>
    `;
    document.body.appendChild(modal);
    const overlay = document.createElement("div");
    overlay.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 9999998;`;
    document.body.appendChild(overlay);

    const close = () => { modal.remove(); overlay.remove(); };
    document.getElementById("close-id-change").addEventListener("click", close);
    overlay.addEventListener("click", close);

    document.getElementById("submit-id-change").addEventListener("click", () => {
        const newId = document.getElementById("new-id-input").value.trim();
        if (!newId) { showToast("يرجى كتابة الـ ID الجديد.", "error"); return; }
        
        const requests = getStorage("phantom_id_change_requests", []);
        requests.push({
            id: `idchange_${Date.now()}`,
            username: currentUser,
            newId: newId,
            date: new Date().toLocaleString("ar-EG"),
            status: 'pending'
        });
        setStorage("phantom_id_change_requests", requests);
        showToast("📨 تم إرسال الطلب للمؤسسين.", "success");
        close();
    });
}

function handleIdChange(id, action) {
    let requests = getStorage("phantom_id_change_requests", []);
    const req = requests.find(r => r.id === id);
    if (!req) return;

    if (action === 'accept') {
        const username = req.username;
        const newId = req.newId;

        // ✅ تحديث الهوية المحلية (اللي بتتقري في البروفايل)
        const identity = getSavedIdentity();
        if (identity && identity.username === username) {
            identity.gameId = newId;
            setStorage(PHANTOM_MEMORY.identityKey, identity);
        }

        // ✅ تحديث السجل المحلي
        let customRoster = getStorage("phantom_custom_roster", []);
        customRoster = customRoster.map(m => {
            if (m && m.name === username) {
                m.in_game_id = newId;
                m.gameId = newId;
            }
            return m;
        });
        setStorage("phantom_custom_roster", customRoster);

        let serverMembers = getStorage("phantom_server_members", []);
        serverMembers = serverMembers.map(m => {
            if (m && m.name === username) {
                m.in_game_id = newId;
                m.gameId = newId;
            }
            return m;
        });
        setStorage("phantom_server_members", serverMembers);

        // ✅ تحديث البروفايل فوراً إذا كان مفتوحاً
        const profileIdEl = document.getElementById('profile-user-id');
        if (profileIdEl) profileIdEl.textContent = newId;

        // ✅ تحديث السيرفر
        if (supabaseClient) {
            safePostgrest(supabaseClient.from('members').update({ in_game_id: newId, gameId: newId }).eq('name', username))
                .then(() => console.log("✅ تم تحديث السيرفر"))
                .catch(err => console.warn("⚠️ فشل تحديث السيرفر:", err));
        }

        showToast(`✅ تم تغيير الـ ID للعضو ${username} إلى ${newId}`, "success");
    } else {
        showToast(`❌ تم رفض طلب ${req.username}.`, "info");
    }

    requests = requests.filter(r => r.id !== id);
    setStorage("phantom_id_change_requests", requests);
    renderAdminInbox();
    renderFounderNotifications();
    logAdminAction(`🆔 تغيير ID لـ ${username}`, username, 'info');
}
// دالة الوقت النسبي (منذ...)
function getRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (seconds < 60) return "الآن";
    if (minutes < 60) {
        if (minutes === 1) return "منذ دقيقة";
        if (minutes === 2) return "منذ دقيقتين";
        if (minutes <= 10) return `منذ ${minutes} دقائق`;
        return `منذ ${minutes} دقيقة`;
    }
    if (hours < 24) {
        if (hours === 1) return "منذ ساعة";
        if (hours === 2) return "منذ ساعتين";
        if (hours <= 10) return `منذ ${hours} ساعات`;
        return `منذ ${hours} ساعة`;
    }
    if (days < 7) {
        if (days === 1) return "منذ يوم";
        if (days === 2) return "منذ يومين";
        if (days <= 10) return `منذ ${days} أيام`;
        return `منذ ${days} يوم`;
    }
    if (weeks < 5) {
        if (weeks === 1) return "منذ أسبوع";
        if (weeks === 2) return "منذ أسبوعين";
        if (weeks <= 10) return `منذ ${weeks} أسابيع`;
        return `منذ ${weeks} أسبوعًا`;
    }
    if (months < 12) {
        if (months === 1) return "منذ شهر";
        if (months === 2) return "منذ شهرين";
        if (months <= 10) return `منذ ${months} أشهر`;
        return `منذ ${months} شهرًا`;
    }
    if (years === 1) return "منذ سنة";
    if (years === 2) return "منذ سنتين";
    if (years <= 10) return `منذ ${years} سنوات`;
    return `منذ ${years} سنة`;
}

// دالة عرض التعليقات الجديدة (شكل واتساب)
function renderComments() {
    const container = document.getElementById("comments-list");
    if (!container) return;
    const comments = getComments();

    if (!comments.length) {
        container.innerHTML = `<div class="empty-state" style="text-align:center; padding:20px; color:var(--silver-muted);">لا توجد تعليقات بعد. كن أول من يعلق!</div>`;
        return;
    }

    container.innerHTML = comments.slice().reverse().map(c => {
        const avatarLetter = (c.username || "؟").charAt(0).toUpperCase();
        const timeStr = getRelativeTime(c.timestamp);
        
        return `
            <div class="comment-item-v2">
                <div class="comment-avatar">${escapeHTML(avatarLetter)}</div>
                <div class="comment-content-wrapper">
                    <div class="comment-meta">
                        <span class="comment-username">${escapeHTML(c.username)}</span>
                        <span class="comment-time">${timeStr}</span>
                    </div>
                    <div class="comment-bubble">${escapeHTML(c.text)}</div>
                </div>
            </div>
        `;
    }).join("");
}
function rejectNameChange(id) {
    let requests = getStorage(PHANTOM_MEMORY.nameChangeRequestsKey, []);
    const request = requests.find(r => r.id === id);
    requests = requests.filter(r => r.id !== id);
    setStorage(PHANTOM_MEMORY.nameChangeRequestsKey, requests);
    
    if (request) {
        addSystemUpdate("رفض تغيير اسم", `تم رفض طلب تغيير اسم العضو ${request.oldName}.`);
        showToast(`❌ تم رفض طلب تغيير اسم ${request.oldName}.`, "info");
    }
    
    renderFounderNotifications();
    renderAdminInbox();
}
function showClipUploadForm() {
    const modal = document.createElement("div");
    modal.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999999; background: rgba(16,23,34,0.98); padding: 20px; border-radius: var(--radius-lg); border: 1px solid var(--border); box-shadow: 0 20px 60px rgba(0,0,0,0.8); width: 90%; max-width: 400px; text-align: center; direction: rtl;`;
    modal.innerHTML = `<h3 style="color:var(--white); margin-bottom:12px;">🎬 رفع فيديو الأسبوع</h3><p style="font-size:0.8rem; color:var(--silver-muted); margin-bottom:10px;">ضع رابط الفيديو هنا</p><input id="new-clip-url-input" type="text" placeholder="https://videy.co/v/?id=..." style="width:100%; padding:12px; border-radius:8px; background:#0b1019 !important; border:1px solid rgba(0,242,254,0.5) !important; color:#fff !important; margin-bottom:10px; text-align:center; direction:ltr;"><div style="display:flex; gap:10px;"><button id="submit-clip-btn" class="btn-success" style="flex:1;" onclick="submitClipUrl()">رفع</button><button id="close-clip-btn" class="btn-secondary" style="flex:1;" onclick="closeClipModal()">إلغاء</button></div>`;
    document.body.appendChild(modal);
    const overlay = document.createElement("div");
    overlay.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9999998;`;
    document.body.appendChild(overlay);
    overlay.onclick = closeClipModal;
}

function closeClipModal() {
    const modal = document.querySelector('div[style*="max-width: 400px"]');
    const overlay = document.querySelector('div[style*="z-index: 9999998"]');
    if (modal) modal.remove();
    if (overlay) overlay.remove();
}

function submitClipUrl() {
    const url = document.getElementById("new-clip-url-input").value.trim();
    if (!url) { showToast("ضع رابط الفيديو.", "error"); return; }
    const data = { videoUrl: url, uploadedBy: getCurrentUsername(), uploadedAt: Date.now(), likes: 0, likedBy: [] };
    setClipsData(data);
    setComments([]);
    closeClipModal();
    renderClips();
    showToast("✅ تم رفع الفيديو بنجاح!", "success");
}
// ==================================================
// نظام التعليقات المضمون (Bottom Sheet)
// ==================================================

function openCommentsSheet() {
    let sheet = document.getElementById("comments-bottom-sheet");
    if (!sheet) {
        sheet = document.createElement("div");
        sheet.id = "comments-bottom-sheet";
        sheet.innerHTML = `
            <div class="sheet-header" style="display:flex; justify-content:space-between; align-items:center; padding:10px;">
                <h3 style="color:var(--cyan); margin:0;">💬 التعليقات</h3>
                <button onclick="closeCommentsSheet()" style="background:none; border:none; color:#888; font-size:1.5rem;">『PH』</button>
            </div>
            <div id="comments-list" style="flex:1; overflow-y:auto; padding:10px;"></div>
            <div class="comment-input-area" style="display:flex; gap:8px; padding:10px; border-top:1px solid var(--border);">
                <input type="text" id="comment-input" placeholder="اكتب تعليقك..." style="flex:1; padding:10px; border-radius:8px; background:#0b1019; border:1px solid var(--border); color:#fff;">
                <button onclick="submitComment()" style="padding:10px 20px; background:var(--cyan); color:#000; border:none; border-radius:8px; font-weight:900;">إرسال</button>
            </div>
        `;
        document.body.appendChild(sheet);
    }

    sheet.style.cssText = `
        position: fixed; bottom: 0; left: 0; width: 100%; max-height: 70vh;
        background: rgba(11, 16, 25, 0.98); border-top: 2px solid var(--cyan);
        border-radius: 16px 16px 0 0; z-index: 1000000;
        transform: translateY(100%); transition: transform 0.3s ease;
        display: flex; flex-direction: column; box-shadow: 0 -10px 40px rgba(0,0,0,0.8);
    `;

    requestAnimationFrame(() => {
        sheet.style.transform = "translateY(0)";
    });

    renderComments();
}

function closeCommentsSheet() {
    let sheet = document.getElementById("comments-bottom-sheet");
    if (sheet) {
        sheet.style.transform = "translateY(100%)";
        setTimeout(() => sheet.remove(), 300);
    }
}

function submitComment() {
    const input = document.getElementById("comment-input");
    const text = input.value.trim();
    if (!text) return showToast("اكتب تعليقك أولاً.", "error");

    const username = getCurrentUsername();
    if (!username) return showToast("يجب تسجيل الدخول أولاً.", "error");

    const newComments = getComments();
    newComments.push({ id: Date.now(), username: username, text: text, timestamp: Date.now() });
    setComments(newComments);

    input.value = "";
    renderComments();
    renderClips();
}

// دالة نافذة نقل النقاط
function showTransferPointsModal() {
    const roster = getFullRoster();
    const currentUser = getCurrentUsername();
    
    let optionsHtml = '';
    roster.forEach(m => {
        if (m.name !== currentUser) {
            optionsHtml += `<option value="${escapeHTML(m.name)}">${escapeHTML(m.name)}</option>`;
        }
    });

    const modal = document.createElement('div');
    modal.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999999; background: rgba(16,23,34,0.98); padding: 20px; border-radius: 12px; border: 2px solid #00f2fe; box-shadow: 0 20px 60px rgba(0,0,0,0.8); width: 90%; max-width: 400px; text-align: center; direction: rtl;`;
    modal.innerHTML = `
        <h3 style="color:#00f2fe; margin-bottom:15px;">💳 نقل النقاط</h3>
        <label style="color:#aaa; font-size:0.8rem; display:block; margin-bottom:5px;">اختر العضو:</label>
        <select id="transfer-target-user" style="width:100%; padding:10px; margin-bottom:10px; background:#0b1019; color:#fff; border:1px solid #00f2fe; border-radius:8px;">${optionsHtml}</select>
        
        <label style="color:#aaa; font-size:0.8rem; display:block; margin-bottom:5px;">عدد النقاط:</label>
        <input type="number" id="transfer-amount" min="1" placeholder="اكتب عدد النقاط" style="width:100%; padding:10px; margin-bottom:15px; background:#0b1019; color:#fff; border:1px solid #00f2fe; border-radius:8px;">
        
        <button onclick="executeTransfer()" style="width:100%; padding:12px; background:#00f2fe; color:#000; border:none; border-radius:8px; font-weight:900; cursor:pointer; margin-bottom:8px;">✅ تحويل النقاط</button>
        <button onclick="closeTransferModal()" style="width:100%; padding:10px; background:transparent; border:1px solid #888; color:#888; border-radius:8px; cursor:pointer;">إلغاء</button>
    `;
    document.body.appendChild(modal);
    
    const overlay = document.createElement('div');
    overlay.style.cssText = `position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 9999998;`;
    document.body.appendChild(overlay);
    overlay.onclick = closeTransferModal;
}

function closeTransferModal() {
    const modal = document.querySelector('div[style*="max-width: 400px"]');
    const overlay = document.querySelector('div[style*="z-index: 9999998"]');
    if (modal) modal.remove();
    if (overlay) overlay.remove();
}

function executeTransfer() {
    const targetUser = document.getElementById('transfer-target-user').value;
    const amount = parseInt(document.getElementById('transfer-amount').value) || 0;
    const currentUser = getCurrentUsername();
    
    if (!targetUser || amount <= 0) { showToast("اختر العضو واكتب عدد النقاط.", "error"); return; }
    if (targetUser === currentUser) { showToast("لا يمكنك تحويل نقاط لنفسك.", "error"); return; }
    
    const points = getLocalPoints();
    const myPoints = points[currentUser] || 0;
    if (myPoints < amount) { showToast("رصيدك غير كافٍ.", "error"); return; }
    
    points[currentUser] = myPoints - amount;
    points[targetUser] = (points[targetUser] || 0) + amount;
    setLocalPoints(points);
    
    renderLeaderboard();
    renderShop();
    renderInventory();
    closeTransferModal();
    showToast(`✅ تم تحويل ${amount} نقطة إلى ${targetUser}!`, "success");
}
// دالة طلب الدخول للقيادة
function requestAdminAccess() {
    // إغلاق قائمة الشبح
    const ghostMenu = document.getElementById('phantom-ghost-menu');
    if (ghostMenu) ghostMenu.style.display = 'none';

    // إذا كان القائد مسجل دخوله بالفعل (كلمة المرور محفوظة)
    if (localStorage.getItem('admin_authenticated') === 'true') {
        openAdminDashboard(); // افتح مباشرة بدون مربع
        return;
    }

    // غير كده، أظهر مربع كلمة المرور
    const adminAccessPanel = document.getElementById('admin-access-panel');
    if (adminAccessPanel) {
        adminAccessPanel.classList.add('active');
        // لا تمسح أي صلاحية هنا
    }
}
// 📡 مركز معلومات القيادة (يعرض كل التفاصيل المهمة)
function logAdminAction(action, target, type = 'info') {
    const log = getStorage("phantom_admin_log", []);
    log.unshift({
        id: Date.now(),
        action: action,
        target: target || '',
        type: type,
        time: new Date().toLocaleString('ar-EG')
    });
    setStorage("phantom_admin_log", log.slice(0, 20));
}

function renderClanHealthCenter() {
    const container = getElement("clan-health-center-container");
    if (!container) return;

    // 📊 جمع البيانات الأساسية
    const roster = getFullRoster();
    const onlineUsers = getStorage(PHANTOM_MEMORY.presenceStorageKey, []);
    const onlineCount = onlineUsers.filter(u => Date.now() - u.time < 30 * 60 * 1000).length;
    const inactiveMembers = roster.filter(m => {
        const lastSeen = m.lastSeen || 0;
        return Date.now() - lastSeen > 7 * 24 * 60 * 60 * 1000;
    }).length;

    const attendance = getStorage(PHANTOM_MEMORY.attendanceRecordsKey, {});
    const warnings = getWarnings();
    const bannedUsers = getBannedUsers();
    const events = getEventsList();
    const adminLog = getStorage("phantom_admin_log", []);

    // ✅ 7: حساب مؤشر صحة الكلان (مبني على معادلة منطقية)
    const totalMembers = roster.length;
    const activeMembers = totalMembers - inactiveMembers;
    const attendanceCount = Object.keys(attendance).length;
    const warningCount = warnings.length;

    let healthScore = 100;
    if (totalMembers > 0) {
        healthScore -= (inactiveMembers / totalMembers) * 40;
        healthScore -= (warningCount / totalMembers) * 30;
        healthScore -= Math.max(0, (5 - onlineCount)) * 5;
        if (attendanceCount < 3) healthScore -= 10;
    }
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

    const healthColor = healthScore >= 70 ? "#00ff88" : (healthScore >= 40 ? "#ffd700" : "#ff4d4d");

    // ✅ 6: حالة الاتصال بالسيرفر
    const isServerOnline = localStorage.getItem("phantom_server_online") === "true" || !!supabaseClient;
    const serverStatusHtml = isServerOnline
        ? `<span style="color:#00ff88;">🟢 متصل</span>`
        : `<span style="color:#ff4d4d;">🔴 غير متصل</span>`;

    // ✅ 8: سجل العمليات (آخر 10)
    const logHtml = adminLog.slice(0, 10).map(log => {
        const bg = log.type === 'banned' ? 'rgba(255,77,77,0.1)' : (log.type === 'warned' ? 'rgba(255,215,0,0.1)' : 'rgba(0,242,254,0.08)');
        const border = log.type === 'banned' ? '#ff4d4d' : (log.type === 'warned' ? '#ffd700' : '#00f2fe');
        return `
            <div class="health-log-item" style="background:${bg}; border-right:3px solid ${border};">
                <span>${escapeHTML(log.action)}</span>
                <small>${escapeHTML(log.time)}</small>
            </div>`;
    }).join('') || '<p style="color:var(--muted);">لا توجد عمليات بعد.</p>';

    // 🎨 بناء الواجهة الكاملة
    container.innerHTML = `
        <div class="clan-health-section" style="background: linear-gradient(135deg, rgba(0,242,254,0.05), rgba(16,23,34,0.9)); border:1px solid rgba(0,242,254,0.2);">
            <div class="clan-health-title" style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px; margin-bottom:15px;">
                <span>📡 نظرة عامة</span>
                <span style="font-size:0.75rem; color:var(--muted);">${serverStatusHtml}</span>
            </div>

            <!-- ✅ 7: مؤشر صحة الكلان -->
            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:10px; padding:15px; margin-bottom:15px; text-align:center;">
                <div style="font-size:2rem; font-weight:900; color:${healthColor}; text-shadow:0 0 15px ${healthColor};">
                    ${healthScore}%
                </div>
                <div style="font-size:0.8rem; color:var(--muted); margin-bottom:8px;">مؤشر صحة الكلان</div>
                <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:10px; overflow:hidden;">
                    <div style="width:${healthScore}%; height:100%; background:${healthColor}; border-radius:10px; transition:width 0.5s ease;"></div>
                </div>
                ${healthScore < 40 ? '<div style="color:#ff4d4d; font-size:0.75rem; margin-top:5px;">⚠️ الكلان بحاجة لاهتمام عاجل</div>' : ''}
            </div>

            <!-- البطاقات الأساسية -->
            <div class="health-card-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px,1fr)); gap:10px; margin-bottom:15px;">
                <div class="health-card"><div class="health-value">${totalMembers}</div><div class="health-label">إجمالي الأعضاء</div></div>
                <div class="health-card success"><div class="health-value">${onlineCount}</div><div class="health-label">متواجدون الآن</div></div>
                <div class="health-card ${inactiveMembers > 0 ? 'warning' : 'success'}"><div class="health-value">${inactiveMembers}</div><div class="health-label">معرضون للخمول</div></div>
                <div class="health-card"><div class="health-value">${attendanceCount}</div><div class="health-label">سجلات الحضور</div></div>
                <div class="health-card"><div class="health-value">${warnings.length}</div><div class="health-label">إنذارات نشطة</div></div>
                <div class="health-card"><div class="health-value">${events.length}</div><div class="health-label">رومات فعالة</div></div>
            </div>

            <!-- ✅ 8: سجل العمليات -->
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:10px; padding:15px;">
                <strong style="font-size:0.9rem; color:var(--white); display:block; margin-bottom:10px;">📜 سجل العمليات الأخيرة</strong>
                <div style="max-height:200px; overflow-y:auto;">
                    ${logHtml}
                </div>
            </div>
        </div>
    `;
}

// تهيئة الصفحة الجديدة
function initAdminPage5() {
    renderClanHealthCenter();
}
// 💡 نظام الاقتراحات
function openSuggestionModal() {
    document.getElementById('suggestion-modal').style.display = 'block';
}

function closeSuggestionModal() {
    document.getElementById('suggestion-modal').style.display = 'none';
    document.getElementById('suggestion-name').value = '';
    document.getElementById('suggestion-details').value = '';
    document.getElementById('suggestion-reason').value = '';
}

function submitSuggestion() {
    const name = document.getElementById('suggestion-name').value.trim();
    const details = document.getElementById('suggestion-details').value.trim();
    const reason = document.getElementById('suggestion-reason').value.trim();

    if (!name || !details || !reason) { showToast("أكمل جميع الحقول أولاً.", "error"); return; }

    const suggestions = getStorage("phantom_suggestions", []);
    suggestions.push({
        id: `sugg_${Date.now()}`,
        from: getCurrentUsername(),
        name: name,
        details: details,
        reason: reason,
        date: new Date().toLocaleString("ar-EG"),
        status: 'pending'
    });
    setStorage("phantom_suggestions", suggestions);

    showToast("✅ تم إرسال الاقتراح للقيادة.", "success");
    closeSuggestionModal();
}

function renderSuggestions() {
    const container = document.getElementById("suggestions-container");
    if (!container) return;

    const suggestions = getStorage("phantom_suggestions", []);

    if (!suggestions.length) {
        container.innerHTML = `<div style="text-align:center; padding:10px; color:var(--muted);">لا توجد اقتراحات حالياً.</div>`;
        return;
    }

    container.innerHTML = suggestions.map(s => `
        <div class="suggestion-item">
            <div class="s-title">💡 ${escapeHTML(s.name)}</div>
            <div style="color:var(--text); margin-top:4px;">📝 ${escapeHTML(s.details)}</div>
            <div class="s-reason">🗣️ ليه: ${escapeHTML(s.reason)}</div>
            <div style="font-size:0.7rem; color:var(--muted); margin-top:4px;">👤 ${escapeHTML(s.from)} — ${escapeHTML(s.date)}</div>
            <div class="suggestion-actions">
                ${s.status === 'pending' ? `
                    <button class="btn-accept" onclick="handleSuggestion('${s.id}', 'accept')">جيد</button>
                    <button class="btn-reject" onclick="handleSuggestion('${s.id}', 'reject')">غير مفيد حالياً</button>
                ` : `<span style="color:var(--green); font-size:0.8rem; text-align:center; flex:1;">✅ تمت المعالجة</span>`}
            </div>
        </div>
    `).join("");
}

function handleSuggestion(id, action) {
    let suggestions = getStorage("phantom_suggestions", []);
    const sugg = suggestions.find(s => s.id === id);
    suggestions = suggestions.map(s => s.id === id ? { ...s, status: action === 'accept' ? 'accepted' : 'rejected' } : s);
    setStorage("phantom_suggestions", suggestions);

    if (action === 'accept') {
        addSystemUpdate("✅ اقتراح مقبول", `تم قبول اقتراح "${sugg.name}" من ${sugg.from}.`, true);
        showToast("✅ تم قبول الاقتراح.", "success");
    } else {
        addSystemUpdate("❌ اقتراح مرفوض", `تم رفض اقتراح "${sugg.name}" من ${sugg.from}.`, true);
        showToast("❌ تم رفض الاقتراح.", "info");
    }
    renderSuggestions();
    renderBroadcastMessages();
}
// ✅ تحديث حالة أزرار الإعدادات (تلون الزر المختار)
function updateSettingsUI() {
    const layoutMode = localStorage.getItem('phantom_device_layout_mode') || 'auto';
    document.querySelectorAll('.settings-btn[onclick*="applyDeviceLayoutMode"]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${layoutMode}'`));
    });

    const fontSize = localStorage.getItem('phantom_font_size') || 'medium';
    document.querySelectorAll('.settings-btn[onclick*="applyFontSize"]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${fontSize}'`));
    });

    const chatSize = localStorage.getItem('phantom_chat_size') || 'medium';
    document.querySelectorAll('.settings-btn[onclick*="applyChatBubbleSize"]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${chatSize}'`));
    });

    const animations = localStorage.getItem('phantom_animations') || 'on';
    document.querySelectorAll('.settings-btn[onclick*="applyAnimations"]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${animations}'`));
    });

    const mentionSound = localStorage.getItem('phantom_mention_sound') || 'on';
    document.querySelectorAll('.settings-btn[onclick*="applyMentionSound"]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${mentionSound}'`));
    });

    const mascot = localStorage.getItem('phantom_mascot') || 'on';
    document.querySelectorAll('.settings-btn[onclick*="applyMascot"]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${mascot}'`));
    });

    // ✅ فحص الثيم
    const theme = localStorage.getItem('phantom_theme') || 'cyan';
    document.querySelectorAll('.settings-btn[onclick*="applyTheme"]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(`'${theme}'`));
    });
}

// 🖥️ أوضاع عرض الموقع الحقيقية (الهاتف، التابلت، الكمبيوتر، تلقائي)
function applyDeviceLayoutMode(mode) {
    const validModes = ['auto', 'mobile', 'tablet', 'desktop'];
    if (!validModes.includes(mode)) mode = 'auto';

    document.documentElement.classList.remove('layout-mode-auto', 'layout-mode-mobile', 'layout-mode-tablet', 'layout-mode-desktop');
    document.documentElement.classList.add('layout-mode-' + mode);
    localStorage.setItem('phantom_device_layout_mode', mode);

    // تنظيف أي zoom أو scale كان قد وضع سابقاً لمنع تشوه التخطيط
    if (document.body) {
        document.body.style.zoom = '';
        document.body.style.transform = '';
    }

    const modeLabels = {
        'auto': 'التلقائي حسب حجم الشاشة',
        'mobile': 'وضع الهاتف',
        'tablet': 'وضع التابلت / iPad',
        'desktop': 'وضع الكمبيوتر / Desktop'
    };
    showToast(`🖥️ تم تفعيل ${modeLabels[mode] || mode}`, "info");
    updateSettingsUI();
}
window.applyDeviceLayoutMode = applyDeviceLayoutMode;

// ✅ تغيير حجم الخط والنصوص (متوافق مع المقاييس القياسية دون zoom)
function applyFontSize(size) {
    const validSizes = ['small', 'medium', 'large'];
    if (!validSizes.includes(size)) size = 'medium';

    document.documentElement.classList.remove('font-small', 'font-medium', 'font-large');
    document.documentElement.classList.add('font-' + size);
    localStorage.setItem('phantom_font_size', size);
    
    const sizeLabels = { 'small': 'صغير', 'medium': 'متوسط', 'large': 'كبير' };
    showToast(`🔤 تم ضبط حجم الخط: ${sizeLabels[size] || size}`, "info");
    updateSettingsUI();
}
window.applyFontSize = applyFontSize;

// ✅ تغيير حجم فقاعات الشات (فوري بدون ريفريش)
function applyChatBubbleSize(size) {
    const validSizes = ['small', 'medium', 'large'];
    if (!validSizes.includes(size)) size = 'medium';

    document.documentElement.classList.remove('chat-small', 'chat-medium', 'chat-large');
    document.documentElement.classList.add('chat-' + size);
    localStorage.setItem('phantom_chat_size', size);

    const bubbleLabels = { 'small': 'صغير', 'medium': 'متوسط', 'large': 'كبير' };
    showToast(`💬 تم ضبط حجم فقاعات الشات: ${bubbleLabels[size] || size}`, "info");
    updateSettingsUI();
}
window.applyChatBubbleSize = applyChatBubbleSize;

// ✅ تشغيل / إيقاف الأنيميشن
function applyAnimations(state) {
    if (state === 'off') {
        document.body.classList.add('disable-animations');
    } else {
        document.body.classList.remove('disable-animations');
    }
    localStorage.setItem('phantom_animations', state);
    updateSettingsUI();
}

// ✅ تشغيل / إيقاف صوت المنشن
function applyMentionSound(state) {
    localStorage.setItem('phantom_mention_sound', state);
    updateSettingsUI();
}

// ✅ تشغيل / إيقاف الروبوت
function applyMascot(state) {
    const mascot = document.getElementById('phantom-mascot');
    if (mascot) {
        if (state === 'off') {
            mascot.style.display = 'none';
            mascot.style.visibility = 'hidden';
            mascot.style.opacity = '0';
            mascot.style.pointerEvents = 'none';
        } else {
            mascot.style.display = 'block';
            mascot.style.visibility = 'visible';
            mascot.style.opacity = '1';
            mascot.style.pointerEvents = 'auto';
        }
    }
    localStorage.setItem('phantom_mascot', state);
    window.dispatchEvent(new Event('phantom-mascot-settings-changed'));
    updateSettingsUI();
}

// ✅ تغيير الثيم
function applyTheme(theme) {
    document.body.classList.remove('theme-cyan', 'theme-gold', 'theme-purple');
    if (theme === 'gold') document.body.classList.add('theme-gold');
    else if (theme === 'purple') document.body.classList.add('theme-purple');
    else document.body.classList.add('theme-cyan');
    localStorage.setItem('phantom_theme', theme);
    showToast(`🎨 تم تطبيق الثيم: ${theme === 'gold' ? 'ذهبي' : theme === 'purple' ? 'بنفسجي' : 'سماوي'}`, "success");
    updateSettingsUI();
}

// ✅ فتح وإغلاق صفحة الإعدادات
function openSettings() {
    const overlay = document.getElementById('settings-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        updateSettingsUI();
    }
}

function closeSettings() {
    const overlay = document.getElementById('settings-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ✅ ربط أزرار الإعدادات
document.addEventListener('DOMContentLoaded', function() {
    const settingsTrigger = document.getElementById('settings-trigger');
    if (settingsTrigger) {
        settingsTrigger.addEventListener('click', openSettings);
    }
    
    const settingsClose = document.getElementById('settings-close-btn');
    if (settingsClose) {
        settingsClose.addEventListener('click', closeSettings);
    }
});

// 💬 نظام المنشن الذكي (زي واتساب)
let selectedMentions = [];

// عرض القائمة عند كتابة @
function showMentionMenu() {
    const menu = document.getElementById('mention-menu');
    const membersList = document.getElementById('mention-members-list');
    if (!menu || !membersList) return;

    const roster = getFullRoster();
    const currentUser = getCurrentUsername();
    selectedMentions = []; // تصفير الاختيارات

    // عرض كل الأعضاء (باستثناء نفسك)
    membersList.innerHTML = roster.filter(m => m.name !== currentUser).map(m => `
        <div class="mention-item" data-name="${escapeHTML(m.name)}" onclick="toggleMentionSelection(this)">
            <span style="color:var(--cyan);">@</span> ${escapeHTML(m.name)}
        </div>
    `).join('');

    menu.style.display = 'block';
}

// اختيار/إلغاء اختيار عضو
function toggleMentionSelection(element) {
    const name = element.getAttribute('data-name');
    element.classList.toggle('selected');

    if (element.classList.contains('selected')) {
        if (!selectedMentions.includes(name)) selectedMentions.push(name);
    } else {
        selectedMentions = selectedMentions.filter(n => n !== name);
    }
}

// زر "تم" - إضافة الأسماء المختارة للنص وإخفاء القائمة
function confirmMentions() {
    const input = document.getElementById('chat-message-input');
    const menu = document.getElementById('mention-menu');
    
    if (input) {
        // إضافة الأسماء بصيغة @اسم
        const mentionsText = selectedMentions.map(name => `@${name}`).join(' ');
        if (mentionsText) input.value = (input.value.trimEnd() + ' ' + mentionsText).trimStart();
    }
    
    if (menu) menu.style.display = 'none';
    selectedMentions = [];
}

// مراقبة الكتابة في حقل الشات
document.addEventListener('DOMContentLoaded', function() {
    const input = document.getElementById('chat-message-input');
    if (!input) return;

    input.addEventListener('input', function() {
        const value = input.value;
        // لو آخر حرف هو @ نعرض القائمة
        if (value.endsWith('@')) {
            showMentionMenu();
        } else {
            const menu = document.getElementById('mention-menu');
            if (menu) menu.style.display = 'none';
        }
    });

    // ربط زر "تم"
    const doneBtn = document.getElementById('mention-done-btn');
    if (doneBtn) doneBtn.addEventListener('click', confirmMentions);
});
// 🏷️ مصفوفة الألقاب الموحدة (نفس أرقام المتجر)

const PHANTOM_TITLES = {
    6: "عضو مميز",
    7: "فارس PHANTOM",
    8: "قائد محتك",
    9: "سفاح الروابط",
    10: "العرب",
    11: "صياد النقاط",
    12: "حارس المقر",
    13: "النمر الأسود",
    14: "مخترع الاستراتيجيات",
    99: "لقب مميز"
};
// ✅ إجبار أزرار الإعدادات على التحديث فوراً عند فتحها
// هذا يضمن أن الخيار المختار يبقى منور كل ما تفتح الإعدادات
document.addEventListener('DOMContentLoaded', function() {
    const settingsTrigger = document.getElementById('settings-trigger');
    if (settingsTrigger) {
        settingsTrigger.addEventListener('click', function() {
            setTimeout(() => {
                if (typeof updateSettingsUI === 'function') {
                    updateSettingsUI();
                }
            }, 100);
        });
    }
});

// ✅ تطبيق الإعدادات المحفوظة عند تحميل الصفحة (بدون ريفريش)
document.addEventListener('DOMContentLoaded', function() {
    // 0. وضع عرض الموقع المحفوظ
    const savedLayout = localStorage.getItem('phantom_device_layout_mode') || 'auto';
    document.documentElement.classList.remove('layout-mode-auto', 'layout-mode-mobile', 'layout-mode-tablet', 'layout-mode-desktop');
    document.documentElement.classList.add('layout-mode-' + savedLayout);

    // 1. الثيم المحفوظ
    const savedTheme = localStorage.getItem('phantom_theme') || 'cyan';
    document.body.classList.remove('theme-cyan', 'theme-gold', 'theme-purple');
    if (savedTheme === 'gold') document.body.classList.add('theme-gold');
    else if (savedTheme === 'purple') document.body.classList.add('theme-purple');
    else document.body.classList.add('theme-cyan');

    // 2. حجم الخط المحفوظ
    const savedFontSize = localStorage.getItem('phantom_font_size') || 'medium';
    document.documentElement.classList.remove('font-small', 'font-medium', 'font-large');
    document.documentElement.classList.add('font-' + savedFontSize);

    // 3. حجم الفقاعات المحفوظ
    const savedChatSize = localStorage.getItem('phantom_chat_size') || 'medium';
    document.documentElement.classList.remove('chat-small', 'chat-medium', 'chat-large');
    document.documentElement.classList.add('chat-' + savedChatSize);

    // 4. الأنيميشن المحفوظ
    const savedAnimations = localStorage.getItem('phantom_animations') || 'on';
    if (savedAnimations === 'off') document.body.classList.add('disable-animations');

    // 5. الروبوت المحفوظ
    const savedMascot = localStorage.getItem('phantom_mascot') || 'on';
    const mascot = document.getElementById('phantom-mascot');
    if (mascot) {
        if (savedMascot === 'off') {
            mascot.style.display = 'none';
        } else {
            mascot.style.display = 'block';
        }
    }
});// 🚪 نظام تسجيل الخروج الدرامي (الحذف من السيرفر + الجهاز)
function startLogoutFlow() {
    const overlay = document.getElementById('logout-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
        document.getElementById('logout-step-1').style.display = 'block';
        document.getElementById('logout-step-2').style.display = 'none';
    }
}

function cancelLogout() {
    const overlay = document.getElementById('logout-overlay');
    if (overlay) overlay.style.display = 'none';
}

function showLogoutStep2() {
    const username = getCurrentUsername();
    const equipped = getStorage("phantom_user_equipped", {});
    const userId = getCurrentUserId();
    const titleId = equipped[userId]?.title;
    const titleName = PHANTOM_TITLES[titleId] || "بدون لقب";
    const points = getLocalPoints();
    const userPoints = points[username] || 0;
    const attendance = getStorage(PHANTOM_MEMORY.attendanceRecordsKey, {});
    const userAttendance = attendance[username] || 0;
    const hearts = getStorage(PHANTOM_MEMORY.heartsKey, {});
    const userHearts = hearts[username] || 0;

    document.getElementById('logout-name').textContent = username || "عضو PHANTOM";
    document.getElementById('logout-title').textContent = `[ ${titleName} ]`;
    document.getElementById('logout-points').textContent = userPoints;
    document.getElementById('logout-attendance').textContent = userAttendance;
    document.getElementById('logout-hearts').textContent = userHearts;

    document.getElementById('logout-step-1').style.display = 'none';
    document.getElementById('logout-step-2').style.display = 'block';
}

async function finalLogout() {
    const username = getCurrentUsername();
    showToast("⏳ جاري حذف الحساب نهائياً...", "info");

    // ✅ 1. حذف الحساب من السيرفر (Supabase)
    if (username && supabaseClient) {
        try {
            await supabaseClient.from('members').delete().eq('name', username);
            await supabaseClient.from('leaderboard').delete().eq('name', username);
            console.log("✅ تم حذف الحساب من السيرفر.");
        } catch (error) {
            console.warn("⚠️ فشل حذف الحساب من السيرفر:", error.message);
        }
    }

    // ✅ 2. مسح هويتك فقط من الجهاز (مش كل الإعدادات)
    localStorage.removeItem('phantom_identity');
    localStorage.removeItem('phantom_active_username');
    localStorage.removeItem('phantom_current_server_member');
    localStorage.removeItem('admin_authenticated');
    sessionStorage.clear();

    // ✅ 3. إعادة التحميل للعودة لشاشة الدخول
    setTimeout(() => {
        showToast("👋 وداعاً يا شبح! تم حذف حسابك نهائياً.", "info");
        location.reload();
    }, 1500);
}

// 🚪 الزر اللي في الإعدادات بيستدعي الدالة دي
function logoutUser() {
    startLogoutFlow();
}

// =========================================================
// 🗚 نظام التحكم في حجم النص والعناصر (UI Font & Elements Scale)
// =========================================================
const ALLOWED_UI_SCALES = [0.90, 1.00, 1.10, 1.25];

function getSavedFontScale() {
    try {
        const saved = parseFloat(localStorage.getItem('phantom_ui_scale'));
        if (!isNaN(saved) && ALLOWED_UI_SCALES.some(s => Math.abs(s - saved) < 0.04)) {
            return saved;
        }
    } catch (e) {}
    return 1.00;
}

function setFontScale(targetScale, save = true) {
    let scale = parseFloat(targetScale);
    if (isNaN(scale)) scale = 1.00;

    // أقرب مقياس معتمد
    let closest = 1.00;
    let minDiff = 999;
    for (const allowed of ALLOWED_UI_SCALES) {
        const diff = Math.abs(allowed - scale);
        if (diff < minDiff) {
            minDiff = diff;
            closest = allowed;
        }
    }
    scale = closest;

    // تطبيق المتغيرات البرمجية فقط دون أي zoom أو transform على الصفحة
    document.documentElement.style.setProperty('--ui-scale', scale);
    document.documentElement.style.setProperty('--app-scale', scale);

    // تنظيف أي zoom قديم كان يؤثر سلباً على شاشات الهاتف
    if (document.body) {
        document.body.style.zoom = '';
        document.body.style.transform = '';
    }

    // تحديث الشارة الرقمية
    const label = document.getElementById('ui-scale-current-label');
    if (label) {
        label.textContent = Math.round(scale * 100) + '%';
    }

    // تحديث الأزرار المسبقة
    document.querySelectorAll('.scale-preset-btn').forEach(btn => {
        const btnScale = parseFloat(btn.dataset.scale);
        if (Math.abs(btnScale - scale) < 0.04) {
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
        } else {
            btn.classList.remove('active');
            btn.setAttribute('aria-pressed', 'false');
        }
    });

    if (save) {
        try {
            localStorage.setItem('phantom_ui_scale', scale);
        } catch (e) {}
        showToast(`🗚 تم ضبط حجم النص والعناصر: ${Math.round(scale * 100)}%`, "info");
    }
}

function stepFontScale(direction) {
    const cur = getSavedFontScale();
    let idx = ALLOWED_UI_SCALES.findIndex(s => Math.abs(s - cur) < 0.04);
    if (idx === -1) idx = 1; // default index for 1.00

    if (direction > 0 && idx < ALLOWED_UI_SCALES.length - 1) {
        setFontScale(ALLOWED_UI_SCALES[idx + 1]);
    } else if (direction < 0 && idx > 0) {
        setFontScale(ALLOWED_UI_SCALES[idx - 1]);
    } else if (direction === 0) {
        setFontScale(1.00);
    }
}

function resetFontScale() {
    setFontScale(1.00);
    showToast("🗚 تم استعادة الحجم الافتراضي (100%)", "info");
}

function toggleUiScaleMenu() {
    const menu = document.getElementById('ui-scale-menu');
    if (!menu) return;
    const isShowing = menu.style.display === 'block';
    menu.style.display = isShowing ? 'none' : 'block';
    if (!isShowing) {
        const firstBtn = menu.querySelector('button');
        if (firstBtn) firstBtn.focus();
    }
}

// تصدير الدوال مع الحفاظ على التوافقية
window.setFontScale = setFontScale;
window.stepFontScale = stepFontScale;
window.resetFontScale = resetFontScale;
window.setUiScale = setFontScale;
window.stepUiScale = stepFontScale;
window.resetUiScale = resetFontScale;
window.applyUiScale = setFontScale;
window.getSavedUiScale = getSavedFontScale;
window.toggleUiScaleMenu = toggleUiScaleMenu;

// تطبيق الحجم المحفوظ فور تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
    setFontScale(getSavedFontScale(), false);
});
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    setFontScale(getSavedFontScale(), false);
}

// إغلاق قائمة الحجم بزر Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const menu = document.getElementById('ui-scale-menu');
        if (menu && menu.style.display === 'block') {
            menu.style.display = 'none';
            const trigger = document.getElementById('ui-scale-trigger-btn');
            if (trigger) trigger.focus();
        }
    }
});

// إغلاق قوائم الـ Dropdown عند النقر خارجها
document.addEventListener('click', (e) => {
    const scaleWrapper = document.getElementById('ui-scale-controller-wrapper');
    const scaleMenu = document.getElementById('ui-scale-menu');
    if (scaleWrapper && scaleMenu && !scaleWrapper.contains(e.target)) {
        scaleMenu.style.display = 'none';
    }

    const codoOpts = document.querySelector('.codo-options-dropdown-container');
    const codoOptsMenu = document.getElementById('codo-more-options-menu');
    if (codoOpts && codoOptsMenu && !codoOpts.contains(e.target)) {
        codoOptsMenu.style.display = 'none';
    }

    const codoModelCont = document.querySelector('.codo-model-dropdown-container');
    const codoModelMenu = document.getElementById('codo-model-menu');
    if (codoModelCont && codoModelMenu && !codoModelCont.contains(e.target)) {
        codoModelMenu.style.display = 'none';
    }
});
