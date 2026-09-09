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
        supabaseClient.from('leaderboard').delete().neq('id', 0).then(() => {
            console.log("✅ تم تصفير نقاط الموسم في السيرفر.");
        }).catch(err => console.warn("⚠️ فشل تصفير نقاط الموسم في السيرفر:", err));
    }
}

/* ========================================================
   3. Supabase API Layer
   ======================================================== */

const SUPABASE_URL = "https://dmbprvvjmgccgztrhkay.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_R9U_-JY91tV87uLBaZjCWQ_wRhVshA5";

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
    return null;
}

function getCurrentGameId() {
    const identity = getSavedIdentity();
    if (identity && identity.gameId) return identity.gameId;
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
                    supabaseClient.from('members').update({ rank: 'رئيس' }).eq('name', username)
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

// دالة مساعدة للتحقق من التواجد الفعلي
function isMemberOnline(username) {
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
        } else {
            ring.style.background = `conic-gradient(${frameColor} ${percentage}%, #1a222a ${percentage}%)`;
        }
        ring.style.border = `2px solid ${frameColor}`;
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

    // ✅ الخلفيات الجديدة (إضافة الحالات الـ 6 الجديدة)
    let bgCss = "";
    if (bgEffect === "neon_black") bgCss = "background: radial-gradient(circle at 50% 0%, #0a0d14, #070a10);";
    else if (bgEffect === "gold") bgCss = "background: linear-gradient(135deg, #2b2013, #0a0d14);";
    else if (bgEffect === "rainbow") bgCss = "background: linear-gradient(135deg, #0a0d14, #1a0a2e, #001a1a);";
    else if (bgEffect === "purple_galaxy") bgCss = "background: radial-gradient(circle at 50% 50%, #1a052a, #0a0d14);";
    else if (bgEffect === "red_fire") bgCss = "background: radial-gradient(circle at 50% 50%, #2a0505, #0a0d14);";
    else if (bgEffect === "green_forest") bgCss = "background: linear-gradient(135deg, #0a2e1a, #0a0d14);";
    else if (bgEffect === "blue_ocean") bgCss = "background: linear-gradient(135deg, #0a1a2e, #0a0d14);";
    else if (bgEffect === "pink") bgCss = "background: linear-gradient(135deg, #2e0a1a, #0a0d14);";
    else if (bgEffect === "dark_grey") bgCss = "background: linear-gradient(135deg, #1a1a1a, #0a0d14);";
    else if (bgEffect === "white_neon") bgCss = "background: radial-gradient(circle at 50% 50%, #2e2e2e, #0a0d14);";
    else if (bgEffect === "silver") bgCss = "background: linear-gradient(135deg, #1a1a2e, #0a0d14);";
    
    if (bgCss) {
        const hubContainer = document.querySelector('#profile-overlay .hub-container');
        if (hubContainer) hubContainer.style.cssText += bgCss;
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

    html = `
        <div class="clips-layout">
            <div class="clips-video-area">
                <video src="${escapeHTML(getDirectVideoUrl(data.videoUrl))}" controls style="width:100%; aspect-ratio:16/9; object-fit:cover; background:#000; display:block;"></video>
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
   29. نظام المكالمات الصوتية (Agora RTC)
   ======================================================== */

const AGORA_APP_ID = "129b4ba5126742d6973d17c9cbf2d5f3";

let agoraClient = null;
let agoraLocalStream = null;
let agoraRemoteStreams = {};
let isVoiceRoomActive = false;

function setupVoiceCalls() {
    const voiceCallBtn = document.getElementById("voice-call-btn");
    if (voiceCallBtn) {
        voiceCallBtn.addEventListener("click", toggleVoiceCall);
    }
    if (supabaseClient) {
        supabaseClient
            .channel('voice-room-notifications')
            .on('broadcast', { event: 'voice-room-active' }, (payload) => {
                showVoiceJoinPopup(payload.payload);
            })
            .subscribe();
    }
}

function toggleVoiceCall() {
    const currentUser = getCurrentUsername();
    if (!currentUser) { showToast("يجب تسجيل الدخول لإجراء المكالمات.", "error"); return; }
    
    if (isVoiceRoomActive) {
        leaveVoiceRoom();
        return;
    }

    showToast("📞 جارٍ إنشاء غرفة صوتية...", "info");
    startVoiceRoom(currentUser);
}

async function startVoiceRoom(creator) {
    if (!AgoraRTC) { showToast("⚠️ مكتبة Agora غير محملة. تأكد من تضمين SDK.", "error"); return; }
    
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    agoraClient = client;
    
    const localStream = AgoraRTC.createStream({ audio: true, video: false });
    agoraLocalStream = localStream;

    const uid = Math.floor(Math.random() * 100000);
    const token = await fetchToken("phantom_voice_room", uid);

    if (!token) {
        showToast("⚠️ تعذر الحصول على إذن الاتصال.", "error");
        return;
    }

    localStream.init(() => {
        const channelName = "phantom_voice_room";
        client.join(AGORA_APP_ID, channelName, token, uid, (uid) => {
            client.publish(localStream, (err) => {
                console.error("خطأ في نشر البث:", err);
            });
            isVoiceRoomActive = true;
            showToast("🎙️ تم بدء الغرفة الصوتية!", "success");
            showVoiceRoomPanel();
            
            if (supabaseClient) {
                supabaseClient.channel('voice-room-notifications')
                    .send({
                        type: 'broadcast',
                        event: 'voice-room-active',
                        payload: { creator: creator, active: true }
                    });
            }
        }, (err) => { console.error("خطأ في الانضمام للقناة:", err); showToast("فشل الاتصال بالمكالمة.", "error"); });
    }, (err) => { console.error("خطأ في تهيئة البث المحلي:", err); showToast("لا يمكن الوصول إلى الميكروفون.", "error"); });

    client.on("stream-added", (evt) => {
        const remoteStream = evt.stream;
        client.subscribe(remoteStream, (err) => { console.error("خطأ في الاشتراك بالبث البعيد:", err); });
    });

    client.on("stream-subscribed", (evt) => {
        const remoteStream = evt.stream;
        const remoteContainer = document.createElement("div");
        remoteContainer.id = `remote-stream-${remoteStream.getId()}`;
        remoteContainer.style.cssText = "display:none;";
        document.body.appendChild(remoteContainer);
        remoteStream.play(remoteContainer.id);
        updateVoiceMembersList(remoteStream.getId(), "متصل");
    });

    client.on("peer-leave", (evt) => {
        const remoteId = evt.uid;
        const container = document.getElementById(`remote-stream-${remoteId}`);
        if (container) container.remove();
        updateVoiceMembersList(remoteId, "غادر");
    });
}

function showVoiceJoinPopup(payload) {
    if (!payload || !payload.creator) return;
    const popup = document.getElementById("voice-join-popup");
    if (popup) {
        popup.style.display = "block";
        popup.querySelector("strong").textContent = `🎙️ غرفة صوتية نشطة - ${payload.creator}`;
    }
}

function joinVoiceRoom() {
    const currentUser = getCurrentUsername();
    if (!currentUser) { showToast("يجب تسجيل الدخول.", "error"); return; }
    if (isVoiceRoomActive) { showToast("أنت بالفعل في الغرفة.", "info"); return; }
    
    const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
    agoraClient = client;
    const localStream = AgoraRTC.createStream({ audio: true, video: false });
    agoraLocalStream = localStream;

    const uid = Math.floor(Math.random() * 100000);
    const token = fetchToken("phantom_voice_room", uid);

    if (!token) {
        showToast("⚠️ تعذر الحصول على إذن الاتصال.", "error");
        return;
    }

    localStream.init(() => {
        const channelName = "phantom_voice_room";
        client.join(AGORA_APP_ID, channelName, token, uid, (uid) => {
            client.publish(localStream, (err) => { if (err) console.error("خطأ في النشر:", err); });
            isVoiceRoomActive = true;
            showToast("🟢 انضممت إلى الغرفة الصوتية!", "success");
            showVoiceRoomPanel();
            
            if (supabaseClient) {
                supabaseClient.channel('voice-room-notifications')
                    .send({ type: 'broadcast', event: 'voice-room-joined', payload: { user: currentUser } });
            }
        }, (err) => { 
            console.error("خطأ في الانضمام:", err); 
            showToast("فشل الاتصال.", "error"); 
        });
    }, (err) => { 
        console.error("خطأ في تهيئة الميكروفون:", err); 
    });

    client.on("stream-added", (evt) => { client.subscribe(evt.stream); });
    client.on("stream-subscribed", (evt) => {
        const remoteStream = evt.stream;
        const container = document.createElement("div");
        container.id = `remote-stream-${remoteStream.getId()}`;
        container.style.display = "none";
        document.body.appendChild(container);
        remoteStream.play(container.id);
        updateVoiceMembersList(remoteStream.getId(), "متصل");
    });
    client.on("peer-leave", (evt) => {
        const container = document.getElementById(`remote-stream-${evt.uid}`);
        if (container) container.remove();
        updateVoiceMembersList(evt.uid, "غادر");
    });

    const popup = document.getElementById("voice-join-popup");
    if (popup) popup.style.display = "none";
}

function leaveVoiceRoom() {
    if (agoraClient) {
        agoraClient.leave(() => { console.log("تم الخروج من الغرفة."); });
        agoraClient = null;
    }
    if (agoraLocalStream) {
        agoraLocalStream.close();
        agoraLocalStream = null;
    }
    isVoiceRoomActive = false;
    hideVoiceRoomPanel();
    showToast("🚪 تم مغادرة الغرفة الصوتية.", "info");
}

function showVoiceRoomPanel() {
    const panel = document.getElementById("voice-room-panel");
    if (panel) panel.style.display = "block";
    updateVoiceMembersList(getCurrentUsername(), "أنت");
}

function hideVoiceRoomPanel() {
    const panel = document.getElementById("voice-room-panel");
    if (panel) panel.style.display = "none";
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

function setupVoiceJoinButton() {
    const joinBtn = document.getElementById("join-voice-room-btn");
    if (joinBtn) {
        joinBtn.addEventListener("click", joinVoiceRoom);
    }
}

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

            if (overlayId) {
                const overlay = document.getElementById(overlayId);
                if (overlay) {
                    overlay.style.display = 'flex';
                    if (overlayId === 'vault-overlay' && typeof loadVaultData === 'function') { loadVaultData(); }
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
            supabaseClient.from('members').update({ coins: points[username] }).eq('name', username).then(() => {
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

/* ========================================================
   🛒 نظام المتجر والمخزون (النسخة النهائية الموحدة)
   ======================================================== */

const PERMANENT_ITEM_IDS = [1, 2, 3, 4, 5]; 

async function getShopItems() {
    const data = await supabaseGet('shop_items');
    if (data && data.length > 0) {
        return data;
    }
    
    // النسخة الاحتياطية الكاملة (لو السيرفر فاضي)
    return [
        { id: 1, name: 'إطار نيون فضي', price: 150, type: 'frame', effect: 'silver', description: 'إطار بسيط لامع', icon: '🖼️' },
        { id: 2, name: 'إطار نيون ذهبي', price: 250, type: 'frame', effect: 'gold', description: 'إطار متوهج بالذهب', icon: '🖼️' },
        { id: 3, name: 'إطار نيون متحرك متعدد الألوان', price: 750, type: 'frame', effect: 'rainbow', description: 'إطار قوس قزح متحرك', icon: '🖼️' },
        { id: 4, name: 'إطار نيون البرق الأزرق', price: 250, type: 'frame', effect: 'blue', description: 'إطار أزرق', icon: '🖼️' },
        { id: 5, name: 'إطار نيون الذهب الأحمر', price: 500, type: 'frame', effect: 'red_gold', description: 'إطار أحمر وذهبي', icon: '🖼️' },
        { id: 6, name: 'لقب: عضو مميز', price: 150, type: 'title', effect: 'member', description: 'يظهر تحت اسمك', icon: '🏷️' },
        { id: 7, name: 'لقب: فارس PHANTOM', price: 300, type: 'title', effect: 'phantom_knight', description: 'يظهر تحت اسمك', icon: '🏷️' },
        { id: 8, name: 'لقب: قائد محتك', price: 450, type: 'title', effect: 'veteran', description: 'يظهر تحت اسمك', icon: '🏷️' },
        { id: 9, name: 'لقب: سفاح الروابط', price: 600, type: 'title', effect: 'assassin', description: 'يظهر تحت اسمك', icon: '🏷️' },
        { id: 10, name: 'لقب: العرب', price: 800, type: 'title', effect: 'arab', description: 'يظهر تحت اسمك', icon: '🏷️' },
        { id: 11, name: 'لقب: صياد النقاط', price: 200, type: 'title', effect: 'point_hunter', description: 'يظهر تحت اسمك', icon: '🏷️' },
        { id: 12, name: 'لقب: حارس المقر', price: 300, type: 'title', effect: 'guard', description: 'يظهر تحت اسمك', icon: '🏷️' },
        { id: 13, name: 'لقب: النمر الأسود', price: 450, type: 'title', effect: 'black_panther', description: 'يظهر تحت اسمك', icon: '🏷️' },
        { id: 14, name: 'لقب: مخترع الاستراتيجيات', price: 550, type: 'title', effect: 'strategist', description: 'يظهر تحت اسمك', icon: '🏷️' },
        { id: 23, name: 'لون اسم ذهبي', price: 300, type: 'name_color', effect: 'gold', description: 'اسمك يظهر بالذهبي في الشات', icon: '✨' },
        { id: 24, name: 'لون اسم فضي', price: 250, type: 'name_color', effect: 'silver', description: 'اسمك يظهر بالفضي في الشات', icon: '🥈' },
        { id: 25, name: 'لون اسم أزرق', price: 200, type: 'name_color', effect: 'blue', description: 'اسمك يظهر بالأزرق في الشات', icon: '💙' },
        { id: 26, name: 'لون اسم أحمر', price: 200, type: 'name_color', effect: 'red', description: 'اسمك يظهر بالأحمر في الشات', icon: '❤️' },
        { id: 27, name: 'لون اسم بنفسجي', price: 250, type: 'name_color', effect: 'purple', description: 'اسمك يظهر بالبنفسجي في الشات', icon: '💜' },
        { id: 28, name: 'خلفية نيون سوداء', price: 300, type: 'background', effect: 'neon_black', description: 'خلفية سوداء متوهجة للبروفايل', icon: '🌌' },
        { id: 29, name: 'خلفية ذهبية', price: 400, type: 'background', effect: 'gold', description: 'خلفية ذهبية للبروفايل', icon: '🌟' },
        { id: 30, name: 'خلفية قوس قزح', price: 600, type: 'background', effect: 'rainbow', description: 'خلفية متدرجة بألوان قوس قزح', icon: '🌈' },
        { id: 31, name: 'خلفية بنفسجية', price: 500, type: 'background', effect: 'purple_galaxy', description: 'خلفية بنفسجية فضائية', icon: '🔮' },
        { id: 32, name: 'خلفية حمراء نارية', price: 450, type: 'background', effect: 'red_fire', description: 'خلفية حمراء نارية', icon: '🔥' },
        { id: 33, name: 'خلفية خضراء غابة', price: 400, type: 'background', effect: 'green_forest', description: 'خلفية خضراء غابة', icon: '🌲' },
        { id: 34, name: 'خلفية زرقاء محيط', price: 400, type: 'background', effect: 'blue_ocean', description: 'خلفية زرقاء محيط', icon: '🌊' },
        { id: 35, name: 'خلفية وردية', price: 350, type: 'background', effect: 'pink', description: 'خلفية وردية ناعمة', icon: '🌺' },
        { id: 36, name: 'خلفية رمادية داكنة', price: 300, type: 'background', effect: 'dark_grey', description: 'خلفية رمادية داكنة', icon: '🪨' },
        { id: 37, name: 'خلفية بيضاء نيون', price: 500, type: 'background', effect: 'white_neon', description: 'خلفية بيضاء متوهجة', icon: '⚪' },
        { id: 38, name: 'خلفية فضية', price: 450, type: 'background', effect: 'silver', description: 'خلفية فضية لامعة', icon: '🥈' },
        { id: 39, name: 'تأثير حدود ذهبية', price: 350, type: 'chat_effect', effect: 'gold_border', description: 'فقاعات رسائلك بحدود ذهبية', icon: '💬' },
        { id: 40, name: 'تأثير فقاعة نيون', price: 400, type: 'chat_effect', effect: 'neon_bubble', description: 'فقاعات رسائلك متوهجة بالنيون', icon: '💠' },
        { id: 41, name: 'تأثير ظل متوهج', price: 350, type: 'chat_effect', effect: 'glow_shadow', description: 'رسائلك بظل متوهج', icon: '✨' },
        { id: 42, name: 'تأثير قلب نابض', price: 400, type: 'chat_effect', effect: 'heart_beat', description: 'رسائلك بنبض قلب', icon: '💓' },
        { id: 43, name: 'تأثير رسائل كبيرة', price: 500, type: 'chat_effect', effect: 'big_text', description: 'رسائلك بخط كبير', icon: '🔠' }
    ];
}

async function getUserInventory(userId) {
    if (!userId) return [];
    const data = await supabaseGet('user_inventory');
    let serverItems = [];
    if (data) serverItems = data.filter(item => item.user_id === userId);

    const localInv = getStorage("phantom_user_inventory", []);
    const localItems = localInv.filter(item => item.user_id === userId);

    const combined = [...serverItems, ...localItems];
    const seen = new Set();
    return combined.filter(item => {
        if (seen.has(item.item_id)) return false;
        seen.add(item.item_id);
        return true;
    });
}

function getDailyOfferItems(allItems) {
    const today = new Date().toISOString().split('T')[0];
    let seed = parseInt(today.replace(/-/g, ''));
    const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const eligibleItems = allItems.filter(item => !item.is_permanent);
    const shuffled = eligibleItems.sort(() => rand() - 0.5);
    return shuffled.slice(0, 4);
}

// ✅ استخدام item.type بدلاً من item.category
function createShopItemCard(item, isOwned, isEquipped = false) {
    let buttonHtml = '';
    if (isOwned) {
        if (item.type === 'frame' || item.type === 'title') {
            buttonHtml = isEquipped ? `<button class="shop-btn equipped" data-action="equipped">✅ مجهز</button>` : `<button class="shop-btn" data-action="equip" data-item-id="${item.id}" data-category="${item.type}">تجهيز</button>`;
        } else { buttonHtml = `<button class="shop-btn owned">✅ تمتلكه</button>`; }
    } else { buttonHtml = `<button class="shop-btn" data-action="buy" data-item-id="${item.id}">🛒 شراء الآن</button>`; }
    return `<div class="shop-item-card"><div class="item-icon">${item.icon || '📦'}</div><div class="item-title">${escapeHTML(item.name)}</div><div class="item-desc">${escapeHTML(item.description || '')}</div><div class="item-price">${item.price} نقطة</div>${buttonHtml}</div>`;
}

function attachShopEvents() {
    document.querySelectorAll('.shop-btn[data-action="buy"]').forEach(btn => {
        btn.addEventListener('click', () => buyItem(parseInt(btn.dataset.itemId)));
    });
    document.querySelectorAll('.shop-btn[data-action="equip"]').forEach(btn => {
        btn.addEventListener('click', () => useItem(parseInt(btn.dataset.itemId), btn.dataset.category, 'equip'));
    });
}

// ✅ تعديل الفلاتر لاستخدام item.type
async function renderShop(filter = "all") {
    const shopItems = await getShopItems();
    const userId = getCurrentUserId();
    const inventory = await getUserInventory(userId);
    const username = getCurrentUsername();
    const points = getLocalPoints();
    const balanceEl = document.getElementById('shop-user-balance');
    if (balanceEl) balanceEl.textContent = points[username] || 0;

    // الفلترة
    const filteredItems = shopItems.filter(item => filter === "all" || item.type === filter);

    const shopGrid = document.getElementById('shop-grid');
    if (!shopGrid) return;

    if (filteredItems.length === 0) {
        shopGrid.innerHTML = `<div class="empty-state">لا توجد منتجات في هذه الفئة.</div>`;
        return;
    }

    // إنشاء البطاقات
    shopGrid.innerHTML = filteredItems.map(item => {
        const isOwned = inventory.some(inv => inv.item_id === item.id);
        let buttonHtml = '';
        if (isOwned) {
            buttonHtml = `<button class="shop-btn owned">✅ تمتلكه</button>`;
        } else {
            buttonHtml = `<button class="shop-btn" data-action="buy" data-item-id="${item.id}">🛒 شراء الآن</button>`;
        }
        
        return `
            <div class="shop-item-card">
                <div class="item-icon" style="font-size: 2rem; text-align: center;">${item.icon || '📦'}</div>
                <div class="item-title" style="font-weight: 900; font-size: 0.95rem; margin-top: 8px; color: #fff; text-align: center;">${escapeHTML(item.name)}</div>
                <div class="item-desc" style="font-size: 0.75rem; color: #888; text-align: center; margin: 5px 0;">${escapeHTML(item.description || '')}</div>
                <div class="item-price" style="font-weight: 900; color: #ffd700; text-align: center; margin-bottom: 8px;">${item.price} نقطة</div>
                ${buttonHtml}
            </div>
        `;
    }).join('');

    // ربط زر الشراء
    document.querySelectorAll('.shop-btn[data-action="buy"]').forEach(btn => {
        btn.addEventListener('click', () => buyItem(parseInt(btn.dataset.itemId)));
    });

    // ✅ ربط زر الفلاتر الجديد
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

async function buyItem(itemId) {
    const username = getCurrentUsername();
    const userId = getCurrentUserId();
    if (!userId) return showToast('يجب تسجيل الدخول أولاً.', 'error');

    const shopItems = await getShopItems();
    const item = shopItems.find(i => i.id === itemId);
    if (!item) return showToast('العنصر غير موجود.', 'error');

    const points = getLocalPoints();
    const balance = points[username] || 0;
    if (balance < item.price) {
        showToast(`⚠️ رصيدك غير كافٍ (تحتاج ${item.price} نقطة).`, 'error');
        return;
    }

    points[username] = balance - item.price;
    setLocalPoints(points);

    let inventory = getStorage("phantom_user_inventory", []);
    inventory.push({ user_id: userId, item_id: itemId, purchased_at: Date.now() });
    setStorage("phantom_user_inventory", inventory);

    if (supabaseClient) {
        supabaseClient.from('members').update({ coins: points[username] }).eq('name', username).catch(err => console.warn(err));
        supabaseClient.from('user_inventory').insert([{ user_id: userId, item_id: itemId, purchased_at: new Date().toISOString() }]).catch(err => console.warn(err));
    }

    showToast(`✅ تم شراء "${item.name}" بنجاح!`, "success");
    renderShop();
    renderInventory();
    updateVaultBalanceUI();
}

async function useItem(itemId, category, action) {
    const username = getCurrentUsername();
    const userId = getCurrentUserId();
    if (!userId) return showToast('يجب تسجيل الدخول.', 'error');

    const shopItems = await getShopItems();
    const item = shopItems.find(i => i.id === itemId);
    if (!item) return showToast('العنصر غير موجود.', 'error');
    
    const type = item.type || category || 'other'; 
    const inventory = await getUserInventory(userId);
    const invItem = inventory.find(i => i.item_id === itemId);
    if (!invItem) return showToast('⚠️ هذا العنصر غير موجود في مخزونك.', 'error');

    // ✅ تجهيز الألقاب
    if (type === 'title') {
        const equipped = getStorage("phantom_user_equipped", {});
        if (!equipped[userId]) equipped[userId] = {};
        delete equipped[userId].titles;
        equipped[userId].title = itemId;
        setStorage("phantom_user_equipped", equipped);

        let serverMembers = getStorage("phantom_server_members", []);
        serverMembers = serverMembers.map(m => { if (m && m.name === username) m.equipped_title = itemId; return m; });
        setStorage("phantom_server_members", serverMembers);

        let customRoster = getStorage("phantom_custom_roster", []);
        customRoster = customRoster.map(m => { if (m && m.name === username) m.equipped_title = itemId; return m; });
        setStorage("phantom_custom_roster", customRoster);

        if (supabaseClient) await supabaseClient.from('members').update({ equipped_title: itemId }).eq('name', username);

        renderShop();
        renderInventory();
        renderChat();
        renderAll();
        showToast(`✅ تم تجهيز ${item.name}!`, 'success');
        return;
    }

    // ✅ تجهيز الإطارات
    if (type === 'frame') {
        const equipped = getStorage("phantom_user_equipped", {});
        if (!equipped[userId]) equipped[userId] = {};
        equipped[userId].frame = itemId;
        setStorage("phantom_user_equipped", equipped);

        if (supabaseClient) await supabaseClient.from('members').update({ equipped_frame: itemId }).eq('name', username);

        renderShop();
        renderInventory();
        renderAll();
        showToast(`✅ تم تجهيز ${item.name}!`, 'success');
        return;
    }

    // ✅ تجهيز ألوان الأسماء
    if (type === 'name_color') {
        const equipped = getStorage("phantom_user_equipped", {});
        if (!equipped[userId]) equipped[userId] = {};
        equipped[userId].name_color = itemId;
        setStorage("phantom_user_equipped", equipped);

        if (supabaseClient) await supabaseClient.from('members').update({ equipped_name_color: itemId }).eq('name', username);

        renderShop();
        renderInventory();
        renderChat();
        renderAll();
        showToast(`✅ تم تجهيز ${item.name}!`, 'success');
        return;
    }

    // ✅ تجهيز الخلفيات
    if (type === 'background') {
        const equipped = getStorage("phantom_user_equipped", {});
        if (!equipped[userId]) equipped[userId] = {};
        equipped[userId].background = itemId;
        setStorage("phantom_user_equipped", equipped);

        if (supabaseClient) await supabaseClient.from('members').update({ equipped_background: itemId }).eq('name', username);

        renderShop();
        renderInventory();
        openProfile(getCurrentUsername());
        showToast(`✅ تم تجهيز ${item.name}!`, 'success');
        return;
    }

    // ✅ تجهيز تأثيرات الرسائل
    if (type === 'chat_effect') {
        const equipped = getStorage("phantom_user_equipped", {});
        if (!equipped[userId]) equipped[userId] = {};
        equipped[userId].chat_effect = itemId;
        setStorage("phantom_user_equipped", equipped);

        if (supabaseClient) await supabaseClient.from('members').update({ equipped_chat_effect: itemId }).eq('name', username);

        renderShop();
        renderInventory();
        renderChat();
        renderAll();
        showToast(`✅ تم تجهيز ${item.name}!`, 'success');
        return;
    }

    // ✅ الكروت (كل التأثيرات)
    if (type === 'card') {
        const effect = item.effect || '';
        let message = '';

        if (effect === 'point_boost') { setStorage("phantom_point_boost", { active: true, expiresAt: Date.now() + 1800000 }); message = '🔥 تم تفعيل تضخيم النقاط!'; }
        else if (effect === 'double_points') { setStorage("phantom_double_points", { active: true, expiresAt: Date.now() + 3600000 }); message = '✨ تم تفعيل دبل نقاط!'; }
        else if (effect === 'quick_points') { const pts = getLocalPoints(); pts[username] = (pts[username] || 0) + 200; setLocalPoints(pts); message = '⚡ حصلت على 200 نقطة!'; }
        else if (effect === 'power_points') { const pts = getLocalPoints(); pts[username] = (pts[username] || 0) + 150; setLocalPoints(pts); message = '⚡ حصلت على 150 نقطة!'; }
        else if (effect === 'surprise_box') { const r = Math.floor(Math.random() * (200 - 20 + 1)) + 20; const pts = getLocalPoints(); pts[username] = (pts[username] || 0) + r; setLocalPoints(pts); message = `🎁 حصلت على ${r} نقطة!`; }
        else if (effect === 'fast_attendance') { let att = getStorage(PHANTOM_MEMORY.attendanceRecordsKey, {}); att[username] = (att[username] || 0) + 1; setStorage(PHANTOM_MEMORY.attendanceRecordsKey, att); message = '⏩ تم تسجيل حضور!'; }
        else if (effect === 'bonus_hearts') { let hearts = getStorage(PHANTOM_MEMORY.heartsKey, {}); hearts[username] = (hearts[username] || 0) + 3; setStorage(PHANTOM_MEMORY.heartsKey, hearts); message = '💛 حصلت على 3 قلوب!'; }
        else if (effect === 'camouflage') { setStorage("phantom_camouflage_until", Date.now() + 7200000); message = '🕶️ تم تفعيل التمويه!'; }
        else if (effect === 'invisibility') { setStorage("phantom_invisibility_until", Date.now() + 7200000); message = '🕶️ تم تفعيل عباءة الخفاء!'; }
        else if (effect === 'see_points') { setStorage("phantom_see_points", { active: true, expiresAt: Date.now() + 3600000 }); message = '👁️ يمكنك رؤية النقاط!'; }
        else if (effect === 'glow') { setStorage("phantom_glow_mode", { active: true, expiresAt: Date.now() + 1800000 }); message = '💡 تم تفعيل الإعلان المضيء!'; }
        else if (effect === 're_freeze') { setStorage("phantom_vault_bonus", true); message = '❄️ تم تفعيل إعادة التجميد!'; }
        else if (effect === 'transfer') { showTransferPointsModal(); message = '💳 تم فتح نافذة نقل النقاط!'; }
        else if (effect === 'warning_protect') { let w = getStorage("phantom_warnings", []); if (w.length > 0) { w.pop(); setStorage("phantom_warnings", w); message = '🛡️ تم إلغاء إنذار!'; } else { message = 'لا يوجد إنذارات.'; } }
        else { message = '✅ تم استخدام الكارت!'; }

        if (supabaseClient) await supabaseClient.from('user_inventory').delete().eq('user_id', userId).eq('item_id', itemId);
        let localInv = getStorage("phantom_user_inventory", []);
        localInv = localInv.filter(i => !(i.user_id === userId && i.item_id === itemId));
        setStorage("phantom_user_inventory", localInv);

        showToast(message, 'success');
        renderShop();
        renderInventory();
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
        const item = shopItems.find(i => i.id === inv.item_id);
        if (!item) return null;
        return { ...inv, ...item };
    }).filter(Boolean);

    let filtered = inventoryWithDetails;
    if (filter !== "all") {
        filtered = inventoryWithDetails.filter(item => item.type === filter);
    }

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="empty-state">لا توجد عناصر في هذه الفئة.</div>`;
        return;
    }

    // ✅ عرض البطاقات بشكل جديد
    grid.innerHTML = filtered.map(item => {
        const isEquipped = isItemEquipped(item.id, userId);
        const equippedClass = isEquipped ? ' equipped' : '';
        return `
            <div class="inv-item-card${equippedClass}" data-item-id="${item.id}">
                <div style="font-size:2rem;">${item.icon || '📦'}</div>
                <div style="color:var(--white); font-size:0.9rem; font-weight:bold; margin:5px 0;">${escapeHTML(item.name)}</div>
                <div style="color:var(--muted); font-size:0.7rem; margin-bottom:5px;">${escapeHTML(item.description || '')}</div>
                <button class="inv-use-btn${isEquipped ? ' equipped' : ''}" data-item-id="${item.id}">${isEquipped ? '✅ مجهز' : 'تجهيز'}</button>
            </div>
        `;
    }).join("");

    // ✅ ربط أزرار التجهيز
    document.querySelectorAll(".inv-use-btn:not(.equipped)").forEach(btn => {
        btn.addEventListener("click", async function() {
            const itemId = parseInt(this.dataset.itemId);
            selectedInventoryItem = itemId;
            await useSelectedInventoryItem();
            renderInventory(filter);
        });
    });
}

// ✅ دالة مساعدة للتحقق مما إذا كان العنصر مجهزاً
function isItemEquipped(itemId, userId) {
    const equipped = getStorage("phantom_user_equipped", {});
    const userEquipped = equipped[userId] || {};
    return (userEquipped.title === itemId || userEquipped.frame === itemId || userEquipped.name_color === itemId || userEquipped.background === itemId || userEquipped.chat_effect === itemId);
}

async function useSelectedInventoryItem() {
    if (!selectedInventoryItem) return showToast("اختر عنصراً أولاً.", "error");

    const itemId = parseInt(selectedInventoryItem);
    const userId = getCurrentUserId();
    if (!userId) return showToast("يجب تسجيل الدخول.", "error");

    const shopItems = await getShopItems();
    const item = shopItems.find(i => i.id === itemId);
    if (!item) return showToast("العنصر غير موجود.", "error");

    const username = getCurrentUsername();
    const equipped = getStorage("phantom_user_equipped", {});
    if (!equipped[userId]) equipped[userId] = {};

    // ✅ تجهيز اللقب
    if (item.type === 'title') {
        delete equipped[userId].titles;
        equipped[userId].title = itemId;
        setStorage("phantom_user_equipped", equipped);
        renderShop();
        renderInventory();
        renderChat();
        renderAll();
        showToast(`✅ تم تجهيز ${item.name}!`, "success");
        selectedInventoryItem = null;
        document.getElementById("use-inventory-item-btn").style.display = "none";
        return;
    }
    
    // ✅ تجهيز الإطار
    else if (item.type === 'frame') {
        equipped[userId].frame = itemId;
        setStorage("phantom_user_equipped", equipped);
        renderShop();
        renderInventory();
        renderAll();
        showToast(`✅ تم تجهيز ${item.name}!`, "success");
        selectedInventoryItem = null;
        document.getElementById("use-inventory-item-btn").style.display = "none";
        return;
    }

    // ✅ تجهيز لون الاسم
    else if (item.type === 'name_color') {
        equipped[userId].name_color = itemId;
        setStorage("phantom_user_equipped", equipped);
        renderShop();
        renderInventory();
        renderChat();
        showToast(`✅ تم تجهيز ${item.name}!`, "success");
        selectedInventoryItem = null;
        document.getElementById("use-inventory-item-btn").style.display = "none";
        return;
    }

    // ✅ تجهيز الخلفية
    else if (item.type === 'background') {
        equipped[userId].background = itemId;
        setStorage("phantom_user_equipped", equipped);
        renderShop();
        renderInventory();
        openProfile(username);
        showToast(`✅ تم تجهيز ${item.name}!`, "success");
        selectedInventoryItem = null;
        document.getElementById("use-inventory-item-btn").style.display = "none";
        return;
    }

    // ✅ تجهيز تأثير الرسائل
    else if (item.type === 'chat_effect') {
        equipped[userId].chat_effect = itemId;
        setStorage("phantom_user_equipped", equipped);
        renderShop();
        renderInventory();
        renderChat();
        showToast(`✅ تم تجهيز ${item.name}!`, "success");
        selectedInventoryItem = null;
        document.getElementById("use-inventory-item-btn").style.display = "none";
        return;
    }
    
    // ✅ استخدام الكروت
    else if (item.type === 'card') {
        if (supabaseClient) await supabaseClient.from('user_inventory').delete().eq('user_id', userId).eq('item_id', itemId);
        let localInv = getStorage("phantom_user_inventory", []);
        localInv = localInv.filter(i => !(i.user_id === userId && i.item_id === itemId));
        setStorage("phantom_user_inventory", localInv);
        
        const effect = item.effect || '';
        let message = '';

        if (effect === 'point_boost') { setStorage("phantom_point_boost", { active: true, expiresAt: Date.now() + 1800000 }); message = '🔥 تم تفعيل تضخيم النقاط!'; }
        else if (effect === 'double_points') { setStorage("phantom_double_points", { active: true, expiresAt: Date.now() + 3600000 }); message = '✨ تم تفعيل دبل نقاط!'; }
        else if (effect === 'quick_points') { const pts = getLocalPoints(); pts[username] = (pts[username] || 0) + 200; setLocalPoints(pts); message = '⚡ حصلت على 200 نقطة!'; }
        else if (effect === 'power_points') { const pts = getLocalPoints(); pts[username] = (pts[username] || 0) + 150; setLocalPoints(pts); message = '⚡ حصلت على 150 نقطة!'; }
        else if (effect === 'surprise_box') { const r = Math.floor(Math.random() * (200 - 20 + 1)) + 20; const pts = getLocalPoints(); pts[username] = (pts[username] || 0) + r; setLocalPoints(pts); message = `🎁 حصلت على ${r} نقطة!`; }
        else if (effect === 'fast_attendance') { let att = getStorage(PHANTOM_MEMORY.attendanceRecordsKey, {}); att[username] = (att[username] || 0) + 1; setStorage(PHANTOM_MEMORY.attendanceRecordsKey, att); message = '⏩ تم تسجيل حضور!'; }
        else if (effect === 'bonus_hearts') { let hearts = getStorage(PHANTOM_MEMORY.heartsKey, {}); hearts[username] = (hearts[username] || 0) + 3; setStorage(PHANTOM_MEMORY.heartsKey, hearts); message = '💛 حصلت على 3 قلوب!'; }
        else if (effect === 'camouflage') { setStorage("phantom_camouflage_until", Date.now() + 7200000); message = '🕶️ تم تفعيل التمويه!'; }
        else if (effect === 'invisibility') { setStorage("phantom_invisibility_until", Date.now() + 7200000); message = '🕶️ تم تفعيل عباءة الخفاء!'; }
        else if (effect === 'see_points') { setStorage("phantom_see_points", { active: true, expiresAt: Date.now() + 3600000 }); message = '👁️ يمكنك رؤية النقاط!'; }
        else if (effect === 'glow') { setStorage("phantom_glow_mode", { active: true, expiresAt: Date.now() + 1800000 }); message = '💡 تم تفعيل الإعلان المضيء!'; }
        else if (effect === 're_freeze') { setStorage("phantom_vault_bonus", true); message = '❄️ تم تفعيل إعادة التجميد!'; }
        else if (effect === 'transfer') { showTransferPointsModal(); message = '💳 تم فتح نافذة نقل النقاط!'; }
        else if (effect === 'warning_protect') { let w = getStorage("phantom_warnings", []); if (w.length > 0) { w.pop(); setStorage("phantom_warnings", w); message = '🛡️ تم إلغاء إنذار!'; } else { message = 'لا يوجد إنذارات.'; } }
        else { message = '✅ تم استخدام الكارت!'; }

        showToast(message, 'success');
        renderShop();
        renderInventory();
        selectedInventoryItem = null;
        document.getElementById("use-inventory-item-btn").style.display = "none";
        return;
    }
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
            supabaseClient.from('members').update({ equipped_title: 99 }).eq('name', username)
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
            supabaseClient.from('members').update({ coins: currentPoints }).eq('name', username)
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
    if (supabaseClient) { const userId = getCurrentUserId(); supabaseClient.from('members').update({ coins: points[username] }).eq('id', userId).then(() => { console.log("✅ تم خصم النقاط للشراء."); }).catch(err => console.warn("⚠️ فشل خصم النقاط:", err)); }
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
        if (supabaseClient) { const userId = getCurrentUserId(); const currentPoints = getLocalPoints()[username] || 0; supabaseClient.from('members').update({ coins: currentPoints }).eq('id', userId).then(() => { console.log("✅ تم تحديث النقاط في السيرفر من لعبة الثعبان."); }).catch(err => console.warn("⚠️ فشل تحديث النقاط من لعبة الثعبان:", err)); }
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
   ⚔️ PHANTOM BATTLE 1v1 SYSTEM
   ======================================================== */

let battleCurrentMember = null;
let battleState = { battleId: null, status: 'idle', timerInterval: null, endTime: null, playerA: null, playerB: null, votesA: 0, votesB: 0, myVote: null };

function initBattle() {
    const readyBtn = document.getElementById('battle-ready-btn'); const cancelBtn = document.getElementById('battle-cancel-btn');
    if (readyBtn) readyBtn.addEventListener('click', startMatching); if (cancelBtn) cancelBtn.addEventListener('click', cancelBattle);
    if (supabaseClient) {
        supabaseClient.channel('battle-updates').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'battles' }, (payload) => { if (payload.new.id === battleState.battleId) { updateBattleArenaUI(payload.new); checkBattleEnd(payload.new); } }).subscribe();
    }
}

async function startMatching() {
    const username = getCurrentUsername(); 
    if (!username) return showToast("يجب تسجيل الدخول أولاً.", "error");
    
    showToast("⚔️ جاري البحث عن خصم...", "info");

    if (supabaseClient) {
        // ✅ تحقق من وجود معركة نشطة (active أو waiting)
        const { data: activeBattle } = await supabaseClient.from('battles').select('*').in('status', ['active', 'waiting']).limit(1);
        
        if (activeBattle && activeBattle.length > 0) {
            // لو في معركة موجودة، اعرض زر انضمام بدلاً من استعداد
            const lobby = document.getElementById('battle-lobby');
            if (lobby) {
                lobby.innerHTML = `
                    <div class="streak-header-box" style="text-align:center;">
                        <div class="streak-row" style="justify-content:center;"><span class="streak-icon" style="font-size:3rem;">⚔️</span></div>
                        <p style="color:var(--gold); font-weight:900; font-size:1.2rem; margin:10px 0 5px;">يوجد معركة نشطة حالياً!</p>
                        <div class="streak-hint">💡 يمكنك الانضمام للمعركة الموجودة.</div>
                    </div>
                    <button id="battle-join-btn" class="btn-primary pulse-active" style="width:100%; height:50px; font-size:1.1rem; border-radius:12px; margin-top:10px;">⚔️ انضم للمعركة</button>
                `;
                document.getElementById('battle-join-btn').addEventListener('click', () => joinActiveBattle(activeBattle[0]));
            }
            return; // نوقف بدء البحث عن معركة جديدة
        }
        
        // لو مفيش معركة موجودة، نكمل البحث العادي
        let { data: existing } = await supabaseClient.from('battles').select('*').eq('status', 'waiting').neq('player_a_id', getCurrentUserId()).limit(1);
        if (existing && existing.length > 0) { 
            const battle = existing[0]; 
            const endTime = new Date(Date.now() + 5 * 60 * 1000); 
            await supabaseClient.from('battles').update({ player_b_id: getCurrentUserId(), player_b_name: username, status: 'active', end_time: endTime }).eq('id', battle.id); 
            return; 
        }
        
        // لو مفيش خصم، ننشئ معركة جديدة
        const endTime = new Date(Date.now() + 5 * 60 * 1000);
        const { data: newBattle } = await supabaseClient.from('battles').insert([{ player_a_id: getCurrentUserId(), player_a_name: username, status: 'waiting', end_time: endTime }]).select();
        if (newBattle && newBattle.length > 0) {
            battleState.battleId = newBattle[0].id; 
            battleState.status = 'waiting';
            document.getElementById('battle-lobby').innerHTML = `<div class="streak-header-box" style="text-align:center;"><div class="streak-row" style="justify-content:center;"><span class="streak-icon" style="font-size:3rem;">⏳</span></div><p style="color:var(--cyan); font-weight:900; font-size:1.2rem; margin:10px 0 5px;">في انتظار خصم...</p><div class="streak-hint">💡 اشترك في اللعبة وسينضم خصم تلقائياً.</div></div><button id="battle-cancel-btn" class="btn-danger" style="width:100%; height:50px; font-size:1.1rem; margin-top:10px;">❌ إلغاء البحث</button>`;
            document.getElementById('battle-cancel-btn').onclick = cancelBattle; 
            startBattleTimer(endTime);
        }
    } else { 
        showToast("السيرفر غير متصل، لا يمكن بدء المعركة.", "error"); 
    }
}

// دالة جديدة للانضمام لمعركة موجودة
async function joinActiveBattle(battle) {
    if (battle.status === 'active') {
        showToast("⚔️ انضممت كمتفرج للمعركة.", "success");
    } else if (battle.status === 'waiting') {
        const endTime = new Date(Date.now() + 5 * 60 * 1000);
        const { error } = await supabaseClient.from('battles').update({ 
            player_b_id: getCurrentUserId(), 
            player_b_name: getCurrentUsername(), 
            status: 'active', 
            end_time: endTime 
        }).eq('id', battle.id);
        
        if (!error) {
            battleState.battleId = battle.id;
            battleState.status = 'active';
            showToast("⚔️ تم الانضمام للمعركة!", "success");
            // يمكن تحديث الواجهة هنا لعرض المعركة
        } else {
            showToast("⚠️ فشل الانضمام للمعركة.", "error");
        }
    }
}

async function cancelBattle() { if (supabaseClient && battleState.battleId) { await supabaseClient.from('battles').delete().eq('id', battleState.battleId); } resetBattleUI(); showToast("❌ تم إلغاء المعركة.", "info"); }

function updateBattleArenaUI(data) {
    if (data.status === 'active') {
        document.getElementById('battle-lobby').style.display = 'none'; document.getElementById('battle-arena').style.display = 'flex';
        document.getElementById('fighter-name-a').textContent = data.player_a_name || 'اللاعب أ'; document.getElementById('fighter-name-b').textContent = data.player_b_name || 'اللاعب ب';
        document.getElementById('avatar-a').style.borderColor = "#9ca3af"; document.getElementById('avatar-b').style.borderColor = "#fbbf24";
        document.getElementById('fighter-points-a').textContent = `+${data.votes_a || 0}`; document.getElementById('fighter-points-b').textContent = `+${data.votes_b || 0}`;
        const total = (data.votes_a || 0) + (data.votes_b || 0); let percentA = total > 0 ? (data.votes_a / total) * 100 : 50; if (percentA < 1 && total > 0) percentA = 1;
        document.getElementById('pk-bar-fill').style.width = percentA + '%'; document.getElementById('pk-left-label').textContent = `${data.player_a_name || 'أ'} ${Math.round(percentA)}%`; document.getElementById('pk-right-label').textContent = `${data.player_b_name || 'ب'} ${Math.round(100 - percentA)}%`;
        document.getElementById('vote-btn-a').innerHTML = `🔵 صوّت لـ ${data.player_a_name || 'أ'}`; document.getElementById('vote-btn-b').innerHTML = `🔴 صوّت لـ ${data.player_b_name || 'ب'}`;
        const balance = getUserBalance(); document.getElementById('betting-balance').textContent = balance;
        document.getElementById('vote-btn-a').onclick = () => handleVote('A', data); document.getElementById('vote-btn-b').onclick = () => handleVote('B', data);
    }
}

async function handleVote(target, data) {
    if (battleState.myVote === target) return showToast("لقد صوتّ مسبقاً لهذا اللاعب!", "error");
    const amount = parseInt(document.getElementById('bet-amount').value) || 0; if (amount <= 0) return showToast("اكتب عدد النقاط للتصويت.", "error");
    const balance = getUserBalance(); if (amount > balance) return showToast("⚠️ رصيدك غير كافٍ لهذا التصويت.", "error");
    addPoints(getCurrentUsername(), -amount); document.getElementById('betting-balance').textContent = getUserBalance();
    const fieldToUpdate = target === 'A' ? 'votes_a' : 'votes_b'; const newVotes = (data[fieldToUpdate] || 0) + amount; battleState.myVote = target; battleState.myBetAmount = amount;
    if (supabaseClient) { await supabaseClient.from('battles').update({ [fieldToUpdate]: newVotes }).eq('id', data.id); }
    showToast(`✅ تم التصويت بـ ${amount} نقطة لصالح ${target === 'A' ? data.player_a_name : data.player_b_name}!`, "success");
}

function startBattleTimer(endTime) {
    if (battleState.timerInterval) clearInterval(battleState.timerInterval); battleState.endTime = new Date(endTime);
    battleState.timerInterval = setInterval(() => {
        const now = Date.now(); const diff = Math.max(0, battleState.endTime.getTime() - now);
        if (diff <= 0) { clearInterval(battleState.timerInterval); supabaseClient.from('battles').select('*').eq('id', battleState.battleId).single().then(({data}) => { if(data) resolveBattle(data); }); return; }
        const m = Math.floor(diff / 60000); const s = Math.floor((diff % 60000) / 1000);
        document.getElementById('battle-timer').textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    }, 1000);
}

// ✅ إصلاح رسالة نهاية المعركة لتظهر داخل الصفحة
async function resolveBattle(data) {
    if (data.status === 'ended') return; await supabaseClient.from('battles').update({ status: 'ended' }).eq('id', data.id);
    let winnerName = null; let winnerId = null;
    if (data.votes_a > data.votes_b) { winnerName = data.player_a_name; winnerId = data.player_a_id; } else if (data.votes_b > data.votes_a) { winnerName = data.player_b_name; winnerId = data.player_b_id; }
    let resultMessage = "";
    if (winnerName) {
        const currentPoints = getLocalPoints(); currentPoints[winnerName] = (currentPoints[winnerName] || 0) + 500; setLocalPoints(currentPoints);
        if (supabaseClient) { await supabaseClient.from('members').update({ coins: currentPoints[winnerName] }).eq('name', winnerName); }
        resultMessage = `🏆 ${winnerName} فاز بالمعركة! +500 نقطة`;
    } else {
        resultMessage = "⚔️ انتهت المعركة بالتعادل!";
    }
    if (battleState.myVote === 'A' && data.votes_a > data.votes_b) { const payout = (battleState.myBetAmount || 0) * 2; addPoints(getCurrentUsername(), payout); resultMessage += `\n💰 لقد ربحت الرهان! +${payout} نقطة`; triggerConfetti(); }
    else if (battleState.myVote === 'B' && data.votes_b > data.votes_a) { const payout = (battleState.myBetAmount || 0) * 2; addPoints(getCurrentUsername(), payout); resultMessage += `\n💰 لقد ربحت الرهان! +${payout} نقطة`; triggerConfetti(); }
    else if (battleState.myVote) { resultMessage += `\n💔 خسرت الرهان.`; }
    // ✅ عرض الرسالة داخل battle-result-msg
    const resultEl = document.getElementById('battle-result-msg');
    if (resultEl) {
        resultEl.style.display = 'block';
        resultEl.textContent = resultMessage;
        resultEl.style.color = winnerName ? 'var(--green)' : 'var(--gold)';
        setTimeout(() => { resultEl.style.display = 'none'; }, 6000);
    }
    setTimeout(() => resetBattleUI(), 5000);
}

function resetBattleUI() {
    if (battleState.timerInterval) clearInterval(battleState.timerInterval); battleState = { battleId: null, status: 'idle', timerInterval: null, endTime: null, playerA: null, playerB: null, votesA: 0, votesB: 0, myVote: null };
    document.getElementById('battle-arena').style.display = 'none'; document.getElementById('battle-lobby').style.display = 'block';
    document.getElementById('battle-lobby').innerHTML = `<div class="streak-header-box" style="text-align:center;"><div class="streak-row" style="justify-content:center;"><span class="streak-icon" style="font-size:3rem;">⚔️</span></div><p style="color:var(--white); font-weight:900; font-size:1.3rem; margin:10px 0 5px;">انضم لساحة المعركة</p><div class="streak-hint">💡 اضغط "استعد" لبدء البحث عن خصم وابدأ المواجهة!</div></div><button id="battle-ready-btn" class="btn-primary pulse-active" style="width:100%; height:50px; font-size:1.1rem; border-radius:12px; margin-top:10px;">⚔️ استعد</button>`;
    document.getElementById('battle-ready-btn').addEventListener('click', startMatching);
}

document.addEventListener('DOMContentLoaded', function() { initBattle(); });

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
                if (supabaseClient) { const userId = getCurrentUserId(); if (userId) { const currentPoints = getLocalPoints()[username] || 0; supabaseClient.from('members').update({ coins: currentPoints }).eq('id', userId).then(() => console.log("✅ تم تحديث النقاط في السيرفر من المتاهة.")).catch(err => console.warn("⚠️ فشل تحديث النقاط من المتاهة:", err)); } }
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
   🤖 بوبرت الذكي - تفاعل صوتي (مع مؤقت للكتابة)
   ======================================================== */

const PHANTOM_AI_KEY = "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"; 

if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
}

function setupAIChat() {
    const mascot = document.getElementById('phantom-mascot');
    if (!mascot) return;

    const oldChat = document.getElementById('ai-chat-box');
    if (oldChat) oldChat.remove();

    mascot.style.cursor = 'pointer';

    // النطق
    window.speakBobert = function(text) {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA'; 
        utterance.rate = 1; 
        utterance.pitch = 1;
        const voices = window.speechSynthesis.getVoices();
        const arabicVoice = voices.find(v => v.lang.startsWith('ar'));
        if (arabicVoice) utterance.voice = arabicVoice;
        window.speechSynthesis.speak(utterance);
    };

    // نافذة الكتابة الاحتياطية
   window.promptTextInput = function() {
    // لا تفعل شيئاً (منع التهنيج وفتح الشات تلقائياً)
    console.log("بوبرت لم يسمعك، الرجاء استخدام زر الشات يدوياً.");
};


    // الاستماع مع مؤقت
    window.startVoiceInteraction = function() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast("⚠️ التعرف الصوتي غير مدعوم. اكتب رسالتك.", "error");
            promptTextInput();
            return;
        }
        
        showToast("🔴 جاري الاستماع... تكلم الآن", "info");
        const recognition = new SpeechRecognition();
        recognition.lang = 'ar-SA';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        // 👇 مؤقت: إذا لم يسمع شيئاً خلال 6 ثواني، افتح الكتابة
        const timeoutId = setTimeout(() => {
            recognition.stop();
            showToast("⏰ لم أسمعك. اكتب رسالتك.", "info");
            promptTextInput();
        }, 6000);
        
        recognition.onresult = async (event) => {
            clearTimeout(timeoutId);
            const userText = event.results[0][0].transcript;
            showToast(`🎤 سمعتك: ${userText}`, "success");
            await sendVoiceToAI(userText);
        };
        
        recognition.onerror = (event) => {
            clearTimeout(timeoutId);
            showToast("⚠️ لم أستطع سماعك. حاول بالكتابة.", "error");
            promptTextInput();
        };
        
        recognition.start();
    };

  window.sendVoiceToAI = async function(userText) {
    try {
        const body = document.getElementById('phantom-chat-body');
        const typing = showTyping();
        body.appendChild(typing);

        const response = await fetch("https://dmbprvvjmgccgztrhkay.supabase.co/functions/v1/Bobert-ai-", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "apikey": "sb_publishable_R9U_-JY91tV87uLBaZjCWQ_wRhVshA5",
                "Authorization": "Bearer sb_publishable_R9U_-JY91tV87uLBaZjCWQ_wRhVshA5"
            },
            body: JSON.stringify({ message: userText })
        });

        if (!response.ok) throw new Error("Edge Function Error");
        const data = await response.json();
        const aiResponse = data.response || data.reply || "عذراً، لم أستطع الفهم.";

        typing.remove();
        
        // ✅ نطق الرد (تأكد أنك سمحت للميكروفون!)
        window.speakBobert(aiResponse);
        addMessage(aiResponse, 'bot');

        if (userText.includes("العب معي") || userText.includes("العاب")) {
            setTimeout(() => {
                if (typeof openGamesPage === 'function') openGamesPage();
                else showToast("⚠️ صفحة الألعاب لم تُنشأ بعد.", "info");
            }, 1000);
        }
    } catch (error) {
        console.error("AI Error:", error);
        typing.remove();
        showToast("⚠️ تعذر الاتصال بالذكاء الاصطناعي.", "error");
        addMessage("عذراً، حدث خطأ في الاتصال.", 'bot');
    }
};

    // ضغطة واحدة: استماع، ضغطتين: كتابة
    let clickCount = 0;
    mascot.addEventListener('click', () => {
        clickCount++;
        if (clickCount === 1) {
            setTimeout(() => {
                if (clickCount === 1) startVoiceInteraction();
                clickCount = 0;
            }, 400);
        } else if (clickCount === 2) {
            clickCount = 0;
            promptTextInput();
        }
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


/* 💬 بوبرت شات - Bottom Sheet (تصميم 4) */

let chatSheet = null;
let chatOverlay = null;

function openBobertChat() {
    chatSheet = document.getElementById('phantom-chat-sheet');
    chatOverlay = document.getElementById('phantom-chat-overlay');
    if (!chatSheet || !chatOverlay) return;
    
    chatSheet.classList.add('open');
    chatOverlay.classList.add('open');
    
    // رسالة ترحيب تلقائية
    const body = document.getElementById('phantom-chat-body');
    if (body && body.children.length === 0) {
        addMessage('أهلاً يا شبح. أنا بوبرت. وش تبي نبدأ؟', 'bot');
    }
    
    // ربط الأحداث
    const closeBtn = chatSheet.querySelector('.phantom-chat-close');
    const sendBtn = document.getElementById('phantom-chat-send');
    const input = document.getElementById('phantom-chat-input');
    
    if (closeBtn) closeBtn.onclick = closeBobertChat;
    if (chatOverlay) chatOverlay.onclick = closeBobertChat;
    
    if (sendBtn) sendBtn.onclick = sendMessage;
    if (input) input.onkeypress = (e) => {
        if (e.key === 'Enter') sendMessage();
    };
}

function closeBobertChat() {
    if (chatSheet) chatSheet.classList.remove('open');
    if (chatOverlay) chatOverlay.classList.remove('open');
}

function addMessage(text, sender) {
    const body = document.getElementById('phantom-chat-body');
    if (!body) return;
    
    const div = document.createElement('div');
    div.className = `msg ${sender}`;
    
    const time = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<b>${sender === 'user' ? 'أنت' : 'بوبرت'}</b><br>${text}<span class="time">${time}</span>`;
    
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('phantom-chat-input');
    const text = input.value.trim();
    if (!text) return;

    addMessage(text, 'user');
    input.value = '';

    const body = document.getElementById('phantom-chat-body');
    const typing = showTyping();
    body.appendChild(typing);
    body.scrollTop = body.scrollHeight;

    try {
        // ✅ الرابط الصحيح مع الـ Authorization
        const response = await fetch("https://dmbprvvjmgccgztrhkay.supabase.co/functions/v1/Bobert-ai-", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "apikey": "sb_publishable_R9U_-JY91tV87uLBaZjCWQ_wRhVshA5",
                "Authorization": "Bearer sb_publishable_R9U_-JY91tV87uLBaZjCWQ_wRhVshA5"
            },
            body: JSON.stringify({ message: text })
        });

        if (!response.ok) throw new Error("Server Error: " + response.status);
        const data = await response.json();
        const aiResponse = data.response || "عذراً، لم أستطع الفهم.";

        typing.remove();
        addMessage(aiResponse, 'bot');
        window.speakBobert(aiResponse);
    } catch (error) {
        typing.remove();
        console.error("AI Error:", error);
        showToast("⚠️ تعذر الاتصال بالذكاء الاصطناعي.", "error");
        addMessage("عذراً، حدث خطأ في الاتصال.", 'bot');
    }
}
// ✅ دالة مؤشر الكتابة (فضلت زي ما هي بالظبط)
function showTyping() {
    const div = document.createElement('div');
    div.className = 'thinking-ghost-container';
    div.innerHTML = `
        <div class="thinking-ghost">
            <svg viewBox="0 0 100 100" width="60" height="60">
                <path class="ghost-outline" d="M50 10 C30 10 20 20 20 40 V70 L30 60 L40 70 L50 60 L60 70 L70 60 L80 70 V40 C80 20 70 10 50 10 Z" fill="transparent" stroke="#00E5F0" stroke-width="5" stroke-linejoin="round" />
                <circle class="ghost-eye-left" cx="38" cy="45" r="6" fill="transparent" />
                <circle class="ghost-eye-right" cx="62" cy="45" r="6" fill="transparent" />
            </svg>
            <div class="thinking-text">
                بوبرت يكتب<span class="dots"><span>.</span><span>.</span><span>.</span></span>
            </div>
        </div>
    `;
    return div;
}
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
            supabaseClient.from('members').update({ in_game_id: newId, gameId: newId }).eq('name', username)
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
// ✅ تحديث حالة أزرار // ✅ تحديث حالة أزرار الإعدادات (تلون الزر المختار)
function updateSettingsUI() {
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

// ✅ تغيير حجم الخط (فوري بدون ريفريش)
function applyFontSize(size) {
    document.documentElement.classList.remove('font-small', 'font-medium', 'font-large');
    document.documentElement.classList.add('font-' + size);
    localStorage.setItem('phantom_font_size', size);
    updateSettingsUI();
}

// ✅ تغيير حجم فقاعات الشات (فوري بدون ريفريش)
function applyChatBubbleSize(size) {
    document.documentElement.classList.remove('chat-small', 'chat-medium', 'chat-large');
    document.documentElement.classList.add('chat-' + size);
    localStorage.setItem('phantom_chat_size', size);
    updateSettingsUI();
}

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
// ✅ فتح وإغلاق صفحة الإعدادات
function openSettings() {
    const overlay = document.getElementById('settings-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

function closeSettings() {
    const overlay = document.getElementById('settings-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

// ✅ ربط زر الإعدادات
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


           
