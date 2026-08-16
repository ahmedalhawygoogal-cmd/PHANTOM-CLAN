/* ========================================================
   PHANTOM HQ - CORE SYSTEM (v3.0 - Server First Architecture)
   script.js
   توزيع العمل:
   - 60% سيرفر (الأعضاء، الشات، الاستطلاع، القيادة، الرومات، الفاعليات، الإنذارات، الصدارة، التواجد)
   - 20% داتا أساسية (القوانين، اللينكات والدعم)
   - 20% داتا مؤقته (الموسم، التحديثات المؤقتة 12h)
   ======================================================== */

"use strict";

/* ========================================================
   1. أدوات عامة ونظام الإشعارات الداخلي (بديل Alert المتصفح)
   ======================================================== */

function showToast(message, type = "info") {
    let container = getElement("phantom-toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "phantom-toast-container";
        container.style.cssText = `
            position: fixed;
            bottom: 20px;
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

/* ========================================================
   2. Server API Layer (60% - الاعتماد الرئيسي على السيرفر)
   ======================================================== */

const PHANTOM_SERVER = {
    enabled: true,
    baseURL: "/api",
    timeout: 8000,
    isOnline: false
};

function buildServerUrl(endpoint) {
    const base = PHANTOM_SERVER.baseURL.replace(/\/+$/, "");
    const path = String(endpoint).replace(/^\/+/, "");
    return `${base}/${path}`;
}

async function serverRequest(endpoint, options = {}) {
    if (!PHANTOM_SERVER.enabled) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PHANTOM_SERVER.timeout);

    try {
        const requestOptions = {
            method: options.method || "GET",
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            },
            signal: controller.signal
        };

        if (options.body !== undefined) {
            requestOptions.body = typeof options.body === "string" 
                ? options.body 
                : JSON.stringify(options.body);
        }

        const response = await fetch(buildServerUrl(endpoint), requestOptions);
        const contentType = response.headers.get("content-type") || "";
        const data = contentType.includes("application/json") 
            ? await response.json() 
            : await response.text();

        if (!response.ok) {
            throw new Error(data && data.message ? data.message : `HTTP ${response.status}`);
        }

        return data;

    } catch (error) {
        console.warn(`[PHANTOM SERVER OFFLINE] Endpoint: ${endpoint}`);
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

const PHANTOM_API = {
    health: () => serverRequest("/health"),
    getMembers: () => serverRequest("/members"),
    createMember: (data) => serverRequest("/members", { method: "POST", body: data }),
    updatePresence: (id) => serverRequest(`/members/${encodeURIComponent(id)}/presence`, { method: "POST" }),
    updateRank: (id, rank) => serverRequest(`/members/${encodeURIComponent(id)}/rank`, { method: "POST", body: { rank } }),
    getChat: () => serverRequest("/chat"),
    sendChat: (data) => serverRequest("/chat", { method: "POST", body: data }),
    getLeaderboard: () => serverRequest("/leaderboard"),
    addAttendance: (memberId) => serverRequest("/attendance", { method: "POST", body: { memberId } }),
    getWarnings: () => serverRequest("/warnings"),
    createWarning: (data) => serverRequest("/warnings", { method: "POST", body: data }),
    deleteWarning: (id) => serverRequest(`/warnings/${encodeURIComponent(id)}`, { method: "DELETE" }),
    getPoll: () => serverRequest("/poll"),
    votePoll: (optionId) => serverRequest("/poll/vote", { method: "POST", body: { optionId } }),
    cancelPoll: () => serverRequest("/poll", { method: "DELETE" }),
    getEvents: () => serverRequest("/events"),
    createEvent: (data) => serverRequest("/events", { method: "POST", body: data }),
    deleteEvent: (id) => serverRequest(`/events/${encodeURIComponent(id)}`, { method: "DELETE" }),
    getUpdates: () => serverRequest("/updates")
};

async function checkServerConnection() {
    const result = await PHANTOM_API.health();
    const online = !!(result && result.success);
    PHANTOM_SERVER.isOnline = online;
    localStorage.setItem("phantom_server_online", online ? "true" : "false");
    
    if (online) {
        console.log("🟢 [60% SERVER] متصل بنجاح - الاعتماد التلقائي على السيرفر");
    } else {
        console.warn("🟡 [60% SERVER] غير متصل - استخدام المزامنة المؤقتة مع توضيح السبب");
    }
    return online;
}

async function serverGetMembers() {
    const result = await PHANTOM_API.getMembers();
    if (!result || !Array.isArray(result.members)) return getStorage("phantom_server_members", []);
    setStorage("phantom_server_members", result.members);
    return result.members;
}

async function serverCreateMember(username, rank = "عضو") {
    if (!username) return null;
    
    const result = await PHANTOM_API.createMember({
        name: username,
        rank: rank,
        status: "موثق"
    });

    if (result && result.success && result.member) {
        return result.member;
    }

    const members = await serverGetMembers();
    const normalized = normalizeName(username);
    return members.find(m => m && normalizeName(m.name) === normalized) || null;
}

async function serverUpdatePresence(memberId) {
    if (!memberId) return null;
    return await PHANTOM_API.updatePresence(memberId);
}

async function syncCurrentUserWithServer(username) {
    if (!username) return null;
    try {
        const rank = isFounderSession() ? "رئيس" : "عضو";
        const member = await serverCreateMember(username, rank);
        if (!member) return null;
        
        await serverUpdatePresence(member.id);
        setStorage("phantom_current_server_member", member);
        return member;
    } catch (error) {
        return null;
    }
}

async function serverSendChat(message) {
    if (!message || !message.text) return null;
    return await PHANTOM_API.sendChat({ sender: message.sender, text: message.text });
}

async function serverGetChat() {
    const result = await PHANTOM_API.getChat();
    return (result && Array.isArray(result.messages)) ? result.messages : getStorage(PHANTOM_MEMORY.chatStorageKey, []);
}

async function serverGetLeaderboard() {
    const result = await PHANTOM_API.getLeaderboard();
    return (result && Array.isArray(result.leaderboard)) ? result.leaderboard : [];
}

async function serverAddAttendance(memberId) {
    if (!memberId) return null;
    return await PHANTOM_API.addAttendance(memberId);
}

async function serverCreateWarning(memberId, type, reason) {
    if (!memberId || !reason) return null;
    return await PHANTOM_API.createWarning({ memberId, type: type || "إنذار", reason });
}

async function serverGetWarnings() {
    const result = await PHANTOM_API.getWarnings();
    return (result && Array.isArray(result.warnings)) ? result.warnings : getStorage("phantom_warnings", []);
}

async function serverGetPoll() {
    const result = await PHANTOM_API.getPoll();
    return result ? (result.poll || null) : null;
}

async function serverGetUpdates() {
    const result = await PHANTOM_API.getUpdates();
    return (result && Array.isArray(result.updates)) ? result.updates : [];
}

async function serverGetEvents() {
    const result = await PHANTOM_API.getEvents();
    if (result && Array.isArray(result.events)) {
        setStorage(PHANTOM_MEMORY.eventsKey, result.events);
        return result.events;
    }
    return getStorage(PHANTOM_MEMORY.eventsKey, []);
}

/* ========================================================
   3. بيانات النظام الثابتة (20% - البيانات الأساسية)
   ======================================================== */

function getBasicData() {
    if (typeof phantomData !== "undefined" && phantomData) {
        return phantomData;
    }

    return {
        sitePassword: "888888",
        adminPanelCode: "246810",
        
        schedule: [
            { day: "الجمعة", time: "09:00 مساءً", title: "روم قتال الفرق الأسبوعي" },
            { day: "الثلاثاء", time: "08:00 مساءً", title: "تصفية السكوادات الداخلي" }
        ],

        rules: {
            general: [
                "الالتزام بالاحترام المتبادل بين جميع الأعضاء داخل وخارج اللعبة.",
                "ممنوع استخدام أي وسائل غش أو برامج خارجية تؤدي للتحظير.",
                "الالتزام بمواعيد رومات قتال الفرق والأنشطة المعلنة."
            ],
            penalties: [
                "تراكم 3 إنذارات تؤدي إلى الاستبعاد المباشر من الكلان.",
                "الغياب عن رومات الفرق بدون عذر مسبق يترتب عليه إنذار رسمي."
            ]
        },

        socialLinks: [
            { name: "WhatsApp", icon: "💬", url: "https://whatsapp.com" },
            { name: "Discord", icon: "🎮", url: "https://discord.gg" },
            { name: "TikTok", icon: "🎵", url: "https://tiktok.com" }
        ],

        supportLinks: {
            whatsapp: "https://whatsapp.com",
            discord: "https://discord.gg"
        }
    };
}

/* ========================================================
   4. البيانات المؤقتة (20% - الموسم والتحديثات المؤقتة)
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
    supportLinksKey: "phantom_support_links"
};

/* ========================================================
   5. تشغيل النظام العام
   ======================================================== */

document.addEventListener("DOMContentLoaded", async () => {
    console.log("⚡ PHANTOM HQ SYSTEM STARTING...");

    const isOnline = await checkServerConnection();

    setupSeasonSystem();
    setupSecurityGate();
    setupNavigation();
    setupAdminPanel();
    setupSupportLinks();
    setupEventsManager();
    setupChat();
    setupSeasonInfo();

    await loadServerData();

    renderAll();

    setupPresenceHeartbeat();
    setupChatRealtimeBridge();
    setupServiceWorker();

    console.log("✅ PHANTOM HQ SYSTEM READY");
});

/* ========================================================
   6. تحميل وتزامن بيانات السيرفر
   ======================================================== */

async function loadServerData() {
    try {
        const members = await serverGetMembers();
        if (Array.isArray(members)) setStorage("phantom_server_members", members);

        const warnings = await serverGetWarnings();
        if (Array.isArray(warnings)) setStorage("phantom_server_warnings", warnings);

        const leaderboard = await serverGetLeaderboard();
        if (Array.isArray(leaderboard)) setStorage("phantom_server_leaderboard", leaderboard);

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
   7. نظام الموسم وإدارته (20% داتا مؤقتة)
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
        setStorage("phantom_user_points", {});
        addSystemUpdate("تحديث الموسم", `انتهى الموسم السابق وتصفّرت نقاط الصدارة.`);
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
   8. هوية المستخدم والأعضاء
   ======================================================== */

function createIdentity(username) {
    return {
        version: PHANTOM_MEMORY.identityVersion,
        username: username,
        createdAt: Date.now(),
        expiresAt: Date.now() + PHANTOM_MEMORY.identityDurationDays * 24 * 60 * 60 * 1000
    };
}

function saveIdentity(username) {
    if (!username) return false;
    return setStorage(PHANTOM_MEMORY.identityKey, createIdentity(username));
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
    removeStorage("phantom_unlocked");
    removeStorage("phantom_active_username");
    removeStorage("phantom_member_profile");
    removeSession(PHANTOM_MEMORY.founderSessionKey);
}

function getCurrentUsername() {
    const identity = getSavedIdentity();
    if (identity && identity.username) return identity.username;
    return localStorage.getItem("phantom_active_username") || "";
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
        if (member && normalizeName(member.name) === normalized) {
            member.rank = "رئيس";
        }
    });
    setStorage("phantom_custom_roster", localMembers);

    const serverMember = getStorage("phantom_current_server_member", null);
    if (serverMember && serverMember.id) {
        PHANTOM_API.updateRank(serverMember.id, "رئيس").catch(() => {});
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
   9. بوابة الدخول والتسجيل الآلي
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

    if (!gate) return;

    const data = getBasicData();
    const correctPassword = String(data.sitePassword || "888888");

    const savedIdentity = getSavedIdentity();
    if (savedIdentity && savedIdentity.username) {
        const username = savedIdentity.username;
        ensureUserIsMember(username);
        updateMemberLastSeen(username);
        updateCurrentUser(username);
        registerPresence(username);

        gate.classList.add("unlocked");
        syncCurrentUserWithServer(username).catch(() => {});
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
                if (passInput) {
                    passInput.value = "";
                    passInput.focus();
                }
                shakeElement(passInput);
            }
        });
    }

    if (nameForm) {
        nameForm.addEventListener("submit", async event => {
            event.preventDefault();
            const username = nameInput ? nameInput.value.trim() : "";

            if (username.length < 2) {
                if (nameError) nameError.textContent = "اكتب اسمك بشكل صحيح.";
                shakeElement(nameInput);
                return;
            }

            saveIdentity(username);
            setStorage("phantom_unlocked", true);
            setStorage("phantom_active_username", username);

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
        });
    }
}

/* ========================================================
   10. التواجد أونلاين (60% سيرفر)
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

    const currentServerMember = getStorage("phantom_current_server_member", null);
    if (currentServerMember && currentServerMember.id) {
        serverUpdatePresence(currentServerMember.id).catch(() => {});
    }

    renderOnlineUsers();
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
            <span style="color:var(--green-online, #00ff88); font-size:.7rem; font-weight:800;">● متواجد</span>
        </div>
    `).join("");
}

/* ========================================================
   11. التنقل بين الصفحات
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
   12. لوحة القيادة وإعدادات الدرع
   ======================================================== */

function setupAdminPanel() {
    const trigger = getElement("admin-panel-trigger");
    const modal = getElement("admin-modal");
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
            populateEventsSelect();
            checkAdminPermissions();
            renderFounderNotifications();
            renderSystemUpdates();
        });
    }

    if (close && modal) {
        close.addEventListener("click", () => modal.classList.remove("active"));
    }

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

                addSystemUpdate("ترقية قيادية", `تم تسجيل دخول ${currentUser} إلى لوحة الرؤساء وترقيته لرتبة "رئيس".`);

                populateAdminSelects();
                populateEventsSelect();
                checkAdminPermissions();
                renderFounderNotifications();
                renderSystemUpdates();
                
                renderAll();

                showToast(`تم التحقق بنجاح. مرحباً بك يا رئيس (${currentUser}).`, "success");

            } else {
                if (error) error.textContent = "❌ رمز الرؤساء غير صحيح";
                if (input) {
                    input.value = "";
                    input.focus();
                }
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
    restricted.style.display = isFounderSession() ? "flex" : "none";
}

function renderFounderNotifications() {
    const area = getElement("founder-notifications");
    if (!area) return;

    area.innerHTML = `
        <div class="admin-mini-item">
            <span>🛡️ حالة القيادة</span>
            <strong>${isFounderSession() ? "رئيس نشط" : "عضو عادي"}</strong>
        </div>
    `;
}

/* ========================================================
   12 (ب). إعدادات الدعم (روابط الواتس والديسكورد)
   ======================================================== */

function getSupportLinks() {
    const data = getBasicData();
    const fallback = data.supportLinks || { whatsapp: "https://whatsapp.com", discord: "https://discord.gg" };
    return getStorage(PHANTOM_MEMORY.supportLinksKey, fallback);
}

function setupSupportLinks() {
    const saveBtn = getElement("save-support-links-btn");
    const waInput = getElement("support-wa-input");
    const discordInput = getElement("support-discord-input");

    const currentLinks = getSupportLinks();
    if (waInput && currentLinks.whatsapp) waInput.value = currentLinks.whatsapp;
    if (discordInput && currentLinks.discord) discordInput.value = currentLinks.discord;

    if (saveBtn) {
        saveBtn.addEventListener("click", () => {
            const wa = waInput ? waInput.value.trim() : "";
            const dc = discordInput ? discordInput.value.trim() : "";

            const links = { whatsapp: wa, discord: dc };
            setStorage(PHANTOM_MEMORY.supportLinksKey, links);

            addSystemUpdate("روابط الدعم", "تم تحديث لينكات الدعم (واتس و ديسكورد).");
            showToast("✅ تم حفظ لينكات الدعم بنجاح.", "success");
            renderBasicDataUI();
        });
    }
}

/* ========================================================
   12 (ج). إدارة الفاعليات والرومات (حل المشكلة ومنع ظهور alert)
   ======================================================== */

function getEventsList() {
    return getStorage(PHANTOM_MEMORY.eventsKey, []);
}

function setupEventsManager() {
    const createBtn = getElement("create-event-btn");
    const toggleCancelBtn = getElement("toggle-cancel-event-btn");
    const cancelRoomBtn = getElement("cancel-room-btn");
    const cancelContainer = getElement("cancel-event-container");

    if (createBtn) {
        createBtn.addEventListener("click", async () => {
            if (!isFounderSession()) {
                showToast("⚠️ إنشاء الفاعليات مخصص للرؤساء فقط.", "error");
                return;
            }

            const nameInput = getElement("event-name-input");
            const timeInput = getElement("event-time-input");

            const name = nameInput ? nameInput.value.trim() : "";
            const time = timeInput ? timeInput.value.trim() : "";

            // حل المشكلة: لا نستخدم alert إطلاقاً لتفادي الرسالة المنبثقة!
            if (!name || !time) {
                showToast("⚠️ يرجى إدخال اسم الفاعلية والموعد أولاً.", "error");
                if (nameInput && !name) shakeElement(nameInput);
                if (timeInput && !time) shakeElement(timeInput);
                return;
            }

            const newEvent = {
                id: `event_${Date.now()}`,
                name: name,
                time: time,
                createdAt: Date.now(),
                createdBy: getCurrentUsername()
            };

            // الرفع والسحب من السيرفر (60% اعتماد)
            let serverSuccess = false;
            if (PHANTOM_SERVER.isOnline) {
                const res = await PHANTOM_API.createEvent(newEvent);
                if (res && res.success) serverSuccess = true;
            }

            const events = getEventsList();
            events.push(newEvent);
            setStorage(PHANTOM_MEMORY.eventsKey, events);

            if (nameInput) nameInput.value = "";
            if (timeInput) timeInput.value = "";

            // توضيح سبب الحالة للمستخدم في حال غياب السيرفر
            if (!PHANTOM_SERVER.isOnline) {
                addSystemUpdate("إنشاء فاعلية (مؤقت)", `تم إنشاء فاعلية: "${name}" (تنبيه: لا يوجد سيرفر متصل حالياً)`);
                showToast(`🎯 تم إنشاء الفاعلية بنجاح! (السبب: مفيش سيرفر متصل، تم الحفظ محلياً)`, "info");
            } else {
                addSystemUpdate("إنشاء فاعلية", `تم إنشاء فاعلية جديدة عبر السيرفر: "${name}" بموعد: ${time}`);
                showToast("🎯 تم إنشاء الفاعلية أوتوماتيكياً وحفظها في السيرفر!", "success");
            }

            populateEventsSelect();
            renderRooms();
        });
    }

    if (toggleCancelBtn) {
        toggleCancelBtn.addEventListener("click", () => {
            if (cancelContainer) {
                const isHidden = cancelContainer.style.display === "none" || !cancelContainer.style.display;
                cancelContainer.style.display = isHidden ? "block" : "none";
            }
            populateEventsSelect();
        });
    }

    if (cancelRoomBtn) {
        cancelRoomBtn.addEventListener("click", async () => {
            if (!isFounderSession()) {
                showToast("⚠️ إلغاء الفاعليات مخصص للرؤساء فقط.", "error");
                return;
            }

            const select = getElement("cancel-event-select");
            const selectedId = select ? select.value : "";

            if (!selectedId) {
                showToast("⚠️ اختر الفاعلية أو الروم أولاً للإلغاء.", "error");
                return;
            }

            let events = getEventsList();
            const targetEvent = events.find(e => String(e.id) === String(selectedId));

            events = events.filter(e => String(e.id) !== String(selectedId));
            setStorage(PHANTOM_MEMORY.eventsKey, events);

            if (PHANTOM_SERVER.isOnline) {
                await PHANTOM_API.deleteEvent(selectedId).catch(() => {});
            }

            if (targetEvent) {
                addSystemUpdate("إلغاء فاعلية", `تم إلغاء الفاعلية/الروم: "${targetEvent.name}".`);
            }

            showToast("🗑️ تم إلغاء الروم/الفاعلية بنجاح.", "success");
            populateEventsSelect();
            renderRooms();
        });
    }
}

function populateEventsSelect() {
    const select = getElement("cancel-event-select");
    if (!select) return;

    const events = getEventsList();
    if (!events.length) {
        select.innerHTML = `<option value="">لا توجد فاعليات نشطة حالياً</option>`;
        return;
    }

    select.innerHTML = events.map(event => `
        <option value="${escapeHTML(event.id)}">
            🎯 ${escapeHTML(event.name)} (${escapeHTML(event.time)})
        </option>
    `).join("");
}

function renderRooms() {
    const containers = [
        getElement("rooms-list-container"),
        getElement("schedule-list-container"),
        getElement("rooms-list"),
        getElement("rooms-container"),
        getElement("schedule-list"),
        getElement("schedule-container"),
        document.querySelector("#page-rooms .content-area"),
        document.querySelector("#rooms .content-area"),
        document.querySelector(".rooms-list-wrapper")
    ].filter(Boolean);

    if (containers.length === 0) {
        const roomsPage = getElement("page-rooms") || getElement("rooms");
        if (roomsPage) {
            let listDiv = roomsPage.querySelector(".rooms-list") || roomsPage.querySelector(".schedule-list") || roomsPage.querySelector(".rooms-container");
            if (!listDiv) {
                listDiv = document.createElement("div");
                listDiv.id = "rooms-list-container";
                listDiv.className = "rooms-list-container";
                roomsPage.appendChild(listDiv);
            }
            containers.push(listDiv);
        }
    }

    if (containers.length === 0) return;

    const data = getBasicData();
    const staticSchedule = Array.isArray(data.schedule) ? data.schedule : [];
    const dynamicEvents = getEventsList();

    let html = "";

    if (dynamicEvents.length > 0) {
        html += `<div class="events-section-header" style="margin-bottom:12px; font-weight:bold; color:var(--gold-main, #d4af37);">🔥 الفاعليات والرومات النشطة (تحدث أوتوماتيكياً)</div>`;
        html += dynamicEvents.map(ev => `
            <div class="event-card-item" style="padding:12px; background:rgba(212,175,55,0.08); border-right:4px solid var(--gold-main, #d4af37); margin-bottom:10px; border-radius:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <strong style="color:#fff; font-size:1.05rem;">🎯 ${escapeHTML(ev.name)}</strong>
                    <span style="font-size:0.75rem; background:var(--gold-main, #d4af37); color:#000; padding:2px 6px; border-radius:4px; font-weight:bold;">فاعلية نشطة</span>
                </div>
                <small style="color:var(--silver-muted, #aaa); display:block; margin-top:4px;">⏰ الموعد: ${escapeHTML(ev.time)}</small>
            </div>
        `).join("");
    }

    if (staticSchedule.length > 0) {
        html += `<div class="schedule-section-header" style="margin-top:16px; margin-bottom:12px; font-weight:bold; color:var(--silver-muted, #aaa);">📅 جدول الرومات الأساسي</div>`;
        html += staticSchedule.map(item => `
            <div class="schedule-card" style="padding:12px; background:rgba(255,255,255,0.03); border-right:3px solid var(--gold-main, #d4af37); margin-bottom:8px; border-radius:6px;">
                <strong style="color:#fff; font-size:1rem; display:block; margin-bottom:4px;">${escapeHTML(item.title)}</strong>
                <small style="color:var(--silver-muted, #aaa); font-size:0.85rem;">📅 ${escapeHTML(item.day)} - ⏰ ${escapeHTML(item.time)}</small>
            </div>
        `).join("");
    }

    if (!dynamicEvents.length && !staticSchedule.length) {
        html = `<div class="empty-state" style="padding:15px; text-align:center; color:var(--silver-muted, #aaa);">لا توجد رومات أو فاعليات حالياً.</div>`;
    }

    containers.forEach(container => {
        container.innerHTML = html;
    });
}

/* ========================================================
   13. التحديثات المؤتمتة (تُحذف أوتوماتيك بعد 12 ساعة)
   ======================================================== */

function getSystemUpdates() {
    const updates = getStorage("phantom_system_updates", []);
    const TWELVE_HOURS = 12 * 60 * 60 * 1000;
    const now = Date.now();

    const validUpdates = updates.filter(update => {
        if (!update.timestamp) return true;
        return (now - update.timestamp) < TWELVE_HOURS;
    });

    if (validUpdates.length !== updates.length) {
        setStorage("phantom_system_updates", validUpdates);
    }

    return validUpdates;
}

function addSystemUpdate(title, description) {
    const updates = getSystemUpdates();
    updates.push({
        id: Date.now(),
        timestamp: Date.now(),
        title: title,
        description: description,
        date: new Date().toLocaleString("ar-EG")
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
        const TWELVE_HOURS = 12 * 60 * 60 * 1000;
        const now = Date.now();
        const filteredServer = serverUpdates.filter(u => !u.timestamp || (now - u.timestamp < TWELVE_HOURS));
        updates = [...updates, ...filteredServer];
    }

    if (!updates.length) {
        area.innerHTML = `<div class="admin-mini-item"><span>لا توجد تحديثات حالياً (تُحذف الرسائل تلقائياً بعد 12 ساعة).</span></div>`;
        return;
    }

    area.innerHTML = updates.slice(-20).reverse().map(update => `
        <div class="admin-mini-item">
            <div>
                <strong>${escapeHTML(update.title || "تحديث")}</strong><br>
                <small>${escapeHTML(update.description || "")}</small><br>
                <small style="color:var(--silver-muted, #aaa); font-size:0.65rem;">${escapeHTML(update.date || "")}</small>
            </div>
        </div>
    `).join("");
}

/* ========================================================
   14. قائمة الأعضاء والترتيب (60% سيرفر)
   ======================================================== */

function getFullRoster() {
    const serverMembers = getStorage("phantom_server_members", []);
    const custom = getStorage("phantom_custom_roster", []);
    const all = [...serverMembers, ...custom];

    const map = new Map();
    all.forEach(member => {
        if (member && member.name) {
            map.set(normalizeName(member.name), member);
        }
    });

    return Array.from(map.values());
}

function populateAdminSelects() {
    const roster = getFullRoster();
    const selects = ["attendance-member-select", "warning-member-select", "kick-member-select"];

    const html = roster.length ? roster.map(member => `
        <option value="${escapeHTML(member.name)}">
            ${escapeHTML(member.name)} ${member.rank ? ` (${escapeHTML(member.rank)})` : ""}
        </option>
    `).join("") : `<option value="">لا يوجد أعضاء</option>`;

    selects.forEach(id => {
        const select = getElement(id);
        if (select) select.innerHTML = html;
    });

    renderAdminWarnings();
}

function normalizeName(name) {
    if (!name) return "";
    return String(name)
        .toLowerCase()
        .replace(/[『』[\]{}()]/g, "")
        .replace(/ph/g, "")
        .replace(/ə/g, "e")
        .replace(/ê/g, "e")
        .replace(/○/g, "o")
        .replace(/[^a-z0-9أ-ي]/g, "")
        .trim();
}

/* ========================================================
   15. لوحة الصدارة النقاط أوتوماتيك (60% سيرفر)
   ======================================================== */

function getLocalPoints() {
    return getStorage("phantom_user_points", {});
}

function setLocalPoints(points) {
    setStorage("phantom_user_points", points);
}

function addPoints(username, amount) {
    if (!username) return;
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

    let html = sorted.map((item, idx) => {
        const rankNumber = idx + 1;
        let crownIcon = "";
        let rankClass = "";

        if (rankNumber === 1) { crownIcon = "👑 "; rankClass = "rank-1"; }
        else if (rankNumber === 2) { crownIcon = "🥈 "; rankClass = "rank-2"; }
        else if (rankNumber === 3) { crownIcon = "🥉 "; rankClass = "rank-3"; }

        return `
            <div class="leaderboard-card ${rankClass}">
                <div class="rank-badge">#${rankNumber}</div>
                <div class="player-info">
                    <div class="player-name">${crownIcon}${escapeHTML(item.name)}</div>
                    <div class="player-rank">${escapeHTML(item.rank)}</div>
                </div>
                <div class="points-badge">
                    <span>${item.points}</span>
                    <small>نقطة</small>
                </div>
            </div>
        `;
    }).join("");

    const VACANT_SLOTS_COUNT = 29;
    const currentCount = sorted.length;

    for (let i = 1; i <= VACANT_SLOTS_COUNT; i++) {
        const vacantRank = currentCount + i;
        html += `
            <div class="leaderboard-card vacant-slot" style="opacity:0.45; border:1px dashed rgba(212,175,55,0.3); background:rgba(255,255,255,0.01);">
                <div class="rank-badge">#${vacantRank}</div>
                <div class="player-info">
                    <div class="player-name" style="color:var(--silver-muted,#888);">[ مكان فارغ ]</div>
                    <div class="player-rank" style="font-size:0.75rem;">في انتظار تسجيل عضو جديد...</div>
                </div>
                <div class="points-badge">
                    <span>0</span>
                    <small>نقطة</small>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

/* ========================================================
   16. تسجيل الحضور وإضافة النقاط أوتوماتيك
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
        let selectedUsernames = [];

        if (select) {
            selectedUsernames = Array.from(select.selectedOptions).map(opt => opt.value).filter(Boolean);
        }

        if (!selectedUsernames.length) {
            showToast("⚠️ اختر عضواً واحداً على الأقل.", "error");
            return;
        }

        const roster = getFullRoster();

        for (const username of selectedUsernames) {
            const member = roster.find(item => normalizeName(item.name) === normalizeName(username));

            if (member && member.id && !String(member.id).startsWith("local_")) {
                await serverAddAttendance(member.id);
            }

            addPoints(username, 30);
            addSystemUpdate("تسجيل حضور", `تم تسجيل حضور العضو ${username} ومنحه +30 نقطة أوتوماتيكياً.`);
        }

        showToast(`✅ تم تسجيل حضور (${selectedUsernames.join(", ")}) وإضافة +30 نقطة لكل منهم بنجاح.`, "success");
        renderAll();
    });
}

/* ========================================================
   17. نظام الإنذارات (60% سيرفر)
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
        <div class="warning-card-item" style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,0,0,0.08); border-right:4px solid var(--red-danger, #ff4d4d); margin-bottom:8px; border-radius:6px;">
            <div>
                <strong style="color:var(--gold-main, #d4af37); font-size:1rem;">[${escapeHTML(warning.name || warning.memberName || "عضو")}]</strong>
                <span style="color:var(--red-danger, #ff4d4d); font-weight:bold; margin-right:8px;">[أخذ إنذار]</span>
                <br>
                <small style="color:var(--silver-muted, #aaa); font-size:0.75rem;">السبب: ${escapeHTML(warning.reason || "غير محدد")} | ${escapeHTML(warning.date || "")}</small>
            </div>
            <span class="warning-badge" style="background:var(--red-danger, #ff4d4d); color:#fff; padding:2px 8px; border-radius:4px; font-size:0.7rem;">${escapeHTML(warning.type || "إنذار")}</span>
        </div>
    `).join("");
}

function renderAdminWarnings() {
    const container = getElement("admin-warnings-manage-list");
    if (!container) return;

    const warnings = getWarnings();

    if (!warnings.length) {
        container.innerHTML = `<span style="font-size:.75rem; color:var(--silver-muted, #aaa);">لا توجد إنذارات لإزالتها.</span>`;
        return;
    }

    container.innerHTML = warnings.map(warning => `
        <div class="admin-mini-item" style="display:flex; justify-content:space-between; align-items:center;">
            <span>
                <strong>${escapeHTML(warning.name || warning.memberName || "")}</strong> - ${escapeHTML(warning.type || "إنذار")}
            </span>
            <button class="admin-del-btn" type="button" data-warning-id="${escapeHTML(warning.id)}" style="background:var(--red-danger, #ff4d4d); color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;">
                إزالة الإنذار 🗑️
            </button>
        </div>
    `).join("");

    container.querySelectorAll("[data-warning-id]").forEach(button => {
        button.addEventListener("click", async () => {
            if (!isFounderSession()) {
                showToast("⚠️ صلاحية إزالة الإنذار مخصصة للرؤساء فقط.", "error");
                return;
            }

            const id = button.getAttribute("data-warning-id");
            await removeWarning(id);
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

    await PHANTOM_API.deleteWarning(id).catch(() => {});

    if (targetWarning) {
        addSystemUpdate("إزالة إنذار", `تمت إزالة الإنذار عن العضو ${targetWarning.name || targetWarning.memberName}.`);
    }

    showToast("✅ تمت إزالة الإنذار بنجاح أوتوماتيكياً.", "success");

    renderWarnings();
    renderAdminWarnings();
}

/* ========================================================
   18. إضافة واستبعاد الأعضاء (60% سيرفر)
   ======================================================== */

function setupAddMember() {
    const button = getElement("add-member-btn");
    if (!button) return;

    button.addEventListener("click", async () => {
        if (!isFounderSession()) {
            showToast("⚠️ إضافة الأعضاء مخصصة للرؤساء فقط.", "error");
            return;
        }

        const nameInput = getElement("new-member-name");
        const rankInput = getElement("new-member-rank");
        const statusInput = getElement("new-member-verified");

        const name = nameInput ? nameInput.value.trim() : "";
        const rank = rankInput ? rankInput.value.trim() : "عضو";
        const status = statusInput ? statusInput.value : "موثق";

        if (!name) {
            showToast("⚠️ اكتب اسم العضو.", "error");
            return;
        }

        const exists = getFullRoster().some(m => normalizeName(m.name) === normalizeName(name));
        if (exists) {
            showToast("⚠️ العضو موجود بالفعل.", "error");
            return;
        }

        const serverMember = await serverCreateMember(name, rank);

        if (serverMember) {
            serverMember.rank = rank;
            serverMember.status = status;

            let members = getStorage("phantom_server_members", []);
            members.push(serverMember);
            setStorage("phantom_server_members", members);
        } else {
            const members = getStorage("phantom_custom_roster", []);
            members.push({
                id: `local_${Date.now()}`,
                name: name,
                rank: rank,
                status: status,
                points: 0,
                joinedAt: Date.now(),
                lastSeen: null,
                source: "founder"
            });
            setStorage("phantom_custom_roster", members);
        }

        if (nameInput) nameInput.value = "";
        if (rankInput) rankInput.value = "";

        addSystemUpdate("إضافة عضو", `تمت إضافة ${name} برتبة (${rank}) إلى سجل PHANTOM.`);
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

        let members = getStorage("phantom_custom_roster", []);
        members = members.filter(m => normalizeName(m.name) !== normalizeName(name));
        setStorage("phantom_custom_roster", members);

        addSystemUpdate("استبعاد عضو", `تم استبعاد ${name} من السجل.`);
        showToast(`🚫 تم استبعاد ${name}.`, "info");

        renderAll();
        populateAdminSelects();
    });
}

/* ========================================================
   19. الاستطلاعات والتصويت أوتوماتيك (60% سيرفر)
   ======================================================== */

function setupPollCreator() {
    const button = getElement("create-poll-btn");
    const cancelButton = getElement("cancel-poll-btn");

    if (button) {
        button.addEventListener("click", async () => {
            if (!isFounderSession()) {
                showToast("⚠️ إنشاء الاستطلاعات مخصص للرؤساء فقط.", "error");
                return;
            }

            const questionInput = getElement("poll-question-input");
            const optionOneInput = getElement("poll-option-1-input");
            const optionTwoInput = getElement("poll-option-2-input");

            const question = questionInput ? questionInput.value.trim() : "";
            const optionOne = optionOneInput ? optionOneInput.value.trim() : "";
            const optionTwo = optionTwoInput ? optionTwoInput.value.trim() : "";

            if (!question || !optionOne || !optionTwo) {
                showToast("⚠️ اكتب السؤال والاختيارين.", "error");
                return;
            }

            const poll = {
                id: `poll_${Date.now()}`,
                question: question,
                options: [
                    { id: 1, text: optionOne, votes: 0 },
                    { id: 2, text: optionTwo, votes: 0 }
                ],
                voters: [],
                totalVotes: 0,
                createdAt: Date.now(),
                createdBy: getCurrentUsername()
            };

            setStorage(PHANTOM_MEMORY.pollStorageKey, poll);
            removeStorage(PHANTOM_MEMORY.pollVoteKey);

            if (questionInput) questionInput.value = "";
            if (optionOneInput) optionOneInput.value = "";
            if (optionTwoInput) optionTwoInput.value = "";

            updatePollAdminState(poll);
            addSystemUpdate("استطلاع جديد", `تم نشر استطلاع جديد: "${question}"`);
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
            if (!poll) {
                updatePollAdminState(null);
                return;
            }

            removeStorage(PHANTOM_MEMORY.pollStorageKey);
            removeStorage(PHANTOM_MEMORY.pollVoteKey);

            await PHANTOM_API.cancelPoll().catch(() => {});

            updatePollAdminState(null);
            addSystemUpdate("إلغاء استطلاع", "تم إلغاء الاستطلاع النشط بواسطة القيادة.");
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

    status.innerHTML = poll ? `
        <span style="color:var(--green-online, #00ff88);">🟢 يوجد استطلاع نشط: ${escapeHTML(poll.question)}</span>
    ` : `
        <span style="color:var(--silver-muted, #aaa);">⚪ لا يوجد استطلاع نشط حالياً.</span>
    `;
}

function voteInPoll(optionId) {
    const poll = getStorage(PHANTOM_MEMORY.pollStorageKey, null);
    const username = getCurrentUsername();

    if (!poll || !username) return;

    if (Array.isArray(poll.voters) && poll.voters.includes(username)) {
        showToast("⚠️ لقد قمت بالتصويت سابقاً.", "error");
        return;
    }

    const option = poll.options.find(o => o.id === optionId);
    if (option) {
        option.votes = (option.votes || 0) + 1;
        poll.totalVotes = (poll.totalVotes || 0) + 1;
        if (!poll.voters) poll.voters = [];
        poll.voters.push(username);

        setStorage(PHANTOM_MEMORY.pollStorageKey, poll);
        setStorage(PHANTOM_MEMORY.pollVoteKey, optionId);

        if (PHANTOM_SERVER.isOnline) {
            PHANTOM_API.votePoll(optionId).catch(() => {});
        }

        addPoints(username, 10);
        showToast("🗳️ تم تسجيل صوتك ومنحك +10 نقاط!", "success");
        renderPoll();
        renderLeaderboard();
    }
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
    const votedOption = getStorage(PHANTOM_MEMORY.pollVoteKey, null);
    const hasVoted = votedOption !== null || (Array.isArray(poll.voters) && poll.voters.includes(username));

    card.innerHTML = `
        <div class="poll-question" style="font-weight:bold; font-size:1.1rem; margin-bottom:12px;">${escapeHTML(poll.question)}</div>
        <div class="poll-options">
            ${poll.options.map(opt => {
                const percent = poll.totalVotes > 0 ? Math.round((opt.votes / poll.totalVotes) * 100) : 0;
                return `
                    <button class="poll-opt-btn ${hasVoted ? 'voted' : ''}" data-option-id="${opt.id}" ${hasVoted ? 'disabled' : ''} style="width:100%; margin-bottom:8px; padding:10px; border-radius:6px; position:relative; overflow:hidden;">
                        <div class="poll-bar" style="position:absolute; top:0; right:0; bottom:0; width:${hasVoted ? percent : 0}%; background:rgba(212,175,55,0.2); transition:width 0.4s ease;"></div>
                        <span style="position:relative; z-index:2; display:flex; justify-content:space-between;">
                            <span>${escapeHTML(opt.text)}</span>
                            ${hasVoted ? `<strong>${percent}% (${opt.votes})</strong>` : ''}
                        </span>
                    </button>
                `;
            }).join("")}
        </div>
        <small style="color:var(--silver-muted, #aaa); margin-top:8px; display:block;">إجمالي الأصوات: ${poll.totalVotes} | يُسمح بصوت واحد فقط لكل عضو (+10 نقاط للمصوت)</small>
    `;

    if (!hasVoted) {
        card.querySelectorAll("[data-option-id]").forEach(btn => {
            btn.addEventListener("click", () => {
                const optId = Number(btn.getAttribute("data-option-id"));
                voteInPoll(optId);
            });
        });
    }
}

/* ========================================================
   20. الشات العام ومراقبة المحادثات (60% سيرفر)
   ======================================================== */

function setupChat() {
    const form = getElement("chat-form-element");
    const input = getElement("chat-input-field");

    if (!form || !input) return;

    form.addEventListener("submit", async event => {
        event.preventDefault();
        const text = input.value.trim();
        const sender = getCurrentUsername();

        if (!text || !sender) return;

        if (containsForbiddenWords(text)) {
            showToast("⚠️ تنبيه: الكلمة المستخدمة غير مسموح بها في شات المقر.", "error");
            input.value = "";
            return;
        }

        const message = {
            id: `msg_${Date.now()}`,
            sender: sender,
            text: text,
            timestamp: Date.now()
        };

        const localChat = getStorage(PHANTOM_MEMORY.chatStorageKey, []);
        localChat.push(message);
        setStorage(PHANTOM_MEMORY.chatStorageKey, localChat.slice(-100));

        input.value = "";
        renderChat();

        if (PHANTOM_SERVER.isOnline) {
            await serverSendChat(message);
        }
    });
}

function containsForbiddenWords(text) {
    const forbidden = ["سبك", "غبي", "هاك", "تشفير"];
    const lower = text.toLowerCase();
    return forbidden.some(word => lower.includes(word));
}

function setupChatRealtimeBridge() {
    setInterval(async () => {
        if (!PHANTOM_SERVER.isOnline) return;
        const serverMessages = await serverGetChat();
        if (Array.isArray(serverMessages) && serverMessages.length) {
            setStorage(PHANTOM_MEMORY.chatStorageKey, serverMessages);
            renderChat();
        }
    }, 3000);
}

function renderChat() {
    const container = getElement("chat-messages-container");
    if (!container) return;

    const messages = getStorage(PHANTOM_MEMORY.chatStorageKey, []);
    const currentUser = getCurrentUsername();

    if (!messages.length) {
        container.innerHTML = `<div class="empty-state">لا توجد رسائل في الشات. كن أول من يتحدث!</div>`;
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isMe = normalizeName(msg.sender) === normalizeName(currentUser);
        return `
            <div class="chat-bubble ${isMe ? 'mine' : 'others'}" style="margin-bottom:8px; align-self:${isMe ? 'flex-end' : 'flex-start'};">
                <small style="font-weight:bold; color:var(--gold-main, #d4af37); display:block;">${escapeHTML(msg.sender)}</small>
                <div style="font-size:0.95rem;">${escapeHTML(msg.text)}</div>
            </div>
        `;
    }).join("");

    container.scrollTop = container.scrollHeight;
}

/* ========================================================
   21. العدادات وعرض البيانات الأساسية (20% داتا أساسية)
   ======================================================== */

function updateMainCounters() {
    const roster = getFullRoster();
    const totalMembers = roster.length;
    const leadershipCount = roster.filter(m => m && (m.rank === "رئيس" || m.rank === "قائد")).length;

    const totalMembersElem = getElement("total-members-count") || getElement("total-members-box");
    const leadershipElem = getElement("leadership-count") || getElement("leadership-box");

    if (totalMembersElem) totalMembersElem.textContent = `${totalMembers} عضو`;
    if (leadershipElem) leadershipElem.textContent = `${leadershipCount} قيادة`;

    renderMembersLog(roster);
}

function renderMembersLog(roster) {
    const logContainer = getElement("members-log-container") || getElement("custom-roster-list");
    if (!logContainer) return;

    if (!roster.length) {
        logContainer.innerHTML = `<div class="empty-state">لا يوجد أعضاء مسجلين حتى الآن.</div>`;
        return;
    }

    logContainer.innerHTML = roster.map(member => `
        <div class="member-log-item" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; margin-bottom:6px; background:rgba(255,255,255,0.03); border-radius:6px;">
            <div>
                <strong style="color:var(--gold-main, #d4af37);">${escapeHTML(member.name)}</strong>
                <span style="font-size:0.75rem; color:var(--silver-muted, #aaa); margin-right:6px;">(${escapeHTML(member.rank || "عضو")})</span>
            </div>
            <span style="font-size:0.7rem; color:var(--green-online, #00ff88);">● ${escapeHTML(member.status || "موثق")}</span>
        </div>
    `).join("");
}

function renderBasicDataUI() {
    const data = getBasicData();

    // القوانين والعقوبات
    if (data.rules) {
        const generalRules = data.rules.general || [];
        const penaltiesRules = data.rules.penalties || [];

        const generalContainer = getElement("general-rules-list") || getElement("general-rules-container") || getElement("general-rules");
        const penaltiesContainer = getElement("penalties-rules-list") || getElement("penalties-rules-container") || getElement("penalties-rules") || getElement("penalties-list");

        if (generalContainer) {
            generalContainer.innerHTML = generalRules.length 
                ? `<ul style="padding-right:18px; margin:8px 0; line-height:1.7; font-size:0.9rem;">${generalRules.map(r => `<li style="margin-bottom:6px;">${escapeHTML(r)}</li>`).join("")}</ul>`
                : `<div class="empty-state">لا توجد قوانين عامة.</div>`;
        }

        if (penaltiesContainer) {
            penaltiesContainer.innerHTML = penaltiesRules.length 
                ? `<ul style="padding-right:18px; margin:8px 0; line-height:1.7; font-size:0.9rem;">${penaltiesRules.map(p => `<li style="margin-bottom:6px;">${escapeHTML(p)}</li>`).join("")}</ul>`
                : `<div class="empty-state">لا توجد عقوبات مدونة.</div>`;
        }

        const rulesContainer = getElement("rules-list-container") || getElement("rules-container") || getElement("rules-list");
        if (rulesContainer) {
            rulesContainer.innerHTML = `
                <div class="rules-section" style="margin-bottom:15px;">
                    <h4 style="color:var(--gold-main, #d4af37); margin-bottom:8px;">📌 القوانين العامة</h4>
                    <ul style="padding-right:18px; line-height:1.7;">${generalRules.map(r => `<li style="margin-bottom:6px;">${escapeHTML(r)}</li>`).join("")}</ul>
                </div>
                <div class="rules-section">
                    <h4 style="color:var(--red-danger, #ff4d4d); margin-bottom:8px;">⚠️ نظام العقوبات</h4>
                    <ul style="padding-right:18px; line-height:1.7;">${penaltiesRules.map(p => `<li style="margin-bottom:6px;">${escapeHTML(p)}</li>`).join("")}</ul>
                </div>
            `;
        }
    }

    renderRooms();

    // اللينكات والدعم
    const socialContainer = getElement("social-links-container") || getElement("social-container") || getElement("social-links");
    if (socialContainer) {
        const supportLinks = getSupportLinks();
        const baseSocial = Array.isArray(data.socialLinks) ? data.socialLinks : [];

        let html = baseSocial.map(link => `
            <a href="${escapeHTML(link.url)}" target="_blank" class="social-link-btn" style="display:inline-flex; align-items:center; gap:8px; padding:10px 16px; margin:4px; background:rgba(255,255,255,0.05); border:1px solid rgba(212,175,55,0.3); border-radius:6px; color:#fff; text-decoration:none;">
                <span>${link.icon || '🔗'}</span>
                <span>${escapeHTML(link.name)}</span>
            </a>
        `).join("");

        if (supportLinks.whatsapp) {
            html += `
                <a href="${escapeHTML(supportLinks.whatsapp)}" target="_blank" class="social-link-btn" style="display:inline-flex; align-items:center; gap:8px; padding:10px 16px; margin:4px; background:rgba(37,211,102,0.15); border:1px solid #25D366; border-radius:6px; color:#fff; text-decoration:none;">
                    <span>💬</span>
                    <span>الدعم (واتساب)</span>
                </a>
            `;
        }

        if (supportLinks.discord) {
            html += `
                <a href="${escapeHTML(supportLinks.discord)}" target="_blank" class="social-link-btn" style="display:inline-flex; align-items:center; gap:8px; padding:10px 16px; margin:4px; background:rgba(88,101,242,0.15); border:1px solid #5865F2; border-radius:6px; color:#fff; text-decoration:none;">
                    <span>🎮</span>
                    <span>الدعم (ديسكورد)</span>
                </a>
            `;
        }

        socialContainer.innerHTML = html;
    }
}

/* ========================================================
   22. تحديث الواجهة الشامل
   ======================================================== */

function renderAll() {
    renderLeaderboard();
    renderWarnings();
    renderAdminWarnings();
    renderPoll();
    renderChat();
    renderOnlineUsers();
    renderBasicDataUI();
    renderSystemUpdates();
    updateMainCounters();
}

/* ========================================================
   23. Service Worker
   ======================================================== */

function setupServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
}
