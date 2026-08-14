/* ========================================================
   PHANTOM HQ - INTERACTIVE SYSTEM SCRIPT ( المحدث بالكامل )
   ======================================================== */

document.addEventListener("DOMContentLoaded", () => {
    // 1. نظام المواسم وتصفير النقاط التلقائي
    setupSeasonSystem();

    // 2. نظام بوابات الأمان والتذكر الذكي
    setupSecurityAndPresenceGate();

    // 3. التنقل للشريط السفلي والكروت
    setupNavigation();

    // 4. لوحة تحكم المؤسسين وصلاحيات القادة
    setupFoundersPanel();

    // 5. نظام شات الكلان والفقاعات
    setupChatSystem();

    // 6. عرض محتويات الصفحات
    renderHomeWidgets();
    renderLeadership();
    renderRoster();
    renderSchedule();
    renderPollSystem();
    renderLeaderboard();
    renderRules();
    renderActiveWarnings();
    renderSocialLinks();
});

// 🗓️ 1. حساب نظام المواسم والتصفير الآلي للنقاط كل شهرين
function setupSeasonSystem() {
    const baseDate = new Date(2026, 7, 1); // أغسطس 2026
    const currentDate = new Date();

    let monthDiff = (currentDate.getFullYear() - baseDate.getFullYear()) * 12 + (currentDate.getMonth() - baseDate.getMonth());
    if (monthDiff < 0) monthDiff = 0;

    const currentSeason = 1 + Math.floor(monthDiff / 2);

    const badge = document.getElementById("season-display-badge");
    if (badge) badge.innerText = `الموسم ${getArabicOrdinal(currentSeason)}`;

    // التحقق من تصفير النقاط لموسم جديد
    const savedSeason = parseInt(localStorage.getItem("phantom_active_season_num") || "1");
    if (currentSeason > savedSeason) {
        localStorage.setItem("phantom_active_season_num", currentSeason.toString());
        // تصفير النقاط المحفوظة للأعضاء
        localStorage.setItem("phantom_user_points", JSON.stringify({}));
        console.log(`[SEASON SYSTEM] تم تصفير النقاط وبدء الموسم ${currentSeason}!`);
    }
}

function getArabicOrdinal(num) {
    const ordinals = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن"];
    return ordinals[num - 1] || `${num}`;
}

// 🔒 2. بوابات الأمان وتذكر الهوية الذكي بـ LocalStorage
function setupSecurityAndPresenceGate() {
    const gateOverlay = document.getElementById("security-gate");
    const step1 = document.getElementById("gate-step-1");
    const step2 = document.getElementById("gate-step-2");

    const passInput = document.getElementById("passcode-input");
    const passForm = document.getElementById("gate-pass-form");
    const passError = document.getElementById("gate-error-msg");

    const nameInput = document.getElementById("username-input");
    const nameForm = document.getElementById("gate-name-form");
    const nameError = document.getElementById("name-error-msg");

    const CORRECT_PASSCODE = (typeof phantomData !== "undefined" && phantomData.sitePassword) ? phantomData.sitePassword : "887788";

    // تذكر الدخول سابقاً عبر local storage لتفادي المطالبة
    const savedUnlocked = localStorage.getItem("phantom_unlocked_perm");
    const savedUser = localStorage.getItem("phantom_active_username");

    if (savedUnlocked === "true" && savedUser) {
        gateOverlay.classList.add("unlocked");
        registerActiveUser(savedUser);
        return;
    }

    // خطوة 1: التحقق من الرقم السري
    passForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (passInput.value.trim() === CORRECT_PASSCODE) {
            step1.classList.remove("active");
            step2.classList.add("active");
            nameInput.focus();
        } else {
            passError.innerText = "رمز الدخول غير صحيح! التواجد مقتصر على أعضاء PHANTOM";
            passInput.value = "";
        }
    });

    // خطوة 2: تسجيل الاسم وتأكيد الحفظ الدائم
    nameForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const userName = nameInput.value.trim();
        if (userName.length >= 2) {
            localStorage.setItem("phantom_unlocked_perm", "true");
            localStorage.setItem("phantom_active_username", userName);
            gateOverlay.classList.add("unlocked");
            registerActiveUser(userName);
        } else {
            nameError.innerText = "يرجى كتابة اسمك بوضوح داخل الكلان";
        }
    });
}

// تسجّيل وتحديث المتواجد بالموقع
function registerActiveUser(username) {
    const userDisplay = document.getElementById("current-user-display");
    if (userDisplay) userDisplay.innerText = `المقاتل: ${username}`;

    let activeUsers = JSON.parse(localStorage.getItem("phantom_site_presence")) || [];

    const existingIndex = activeUsers.findIndex(u => u.name === username);
    if (existingIndex !== -1) {
        activeUsers[existingIndex].time = Date.now();
    } else {
        activeUsers.push({ name: username, time: Date.now() });
    }

    localStorage.setItem("phantom_site_presence", JSON.stringify(activeUsers));
    renderOnlineUsersList();
}

function renderOnlineUsersList() {
    const onlineContainer = document.getElementById("online-members-list");
    const onlineBadge = document.getElementById("online-count-badge");
    
    let activeUsers = JSON.parse(localStorage.getItem("phantom_site_presence")) || [];
    const now = Date.now();
    activeUsers = activeUsers.filter(u => (now - u.time) < 30 * 60 * 1000);

    if (onlineBadge) onlineBadge.innerText = `${activeUsers.length} متواجد الآن`;

    if (onlineContainer) {
        onlineContainer.innerHTML = activeUsers.map(user => `
            <div class="online-user-item">
                <div>
                    <div class="online-user-name">${user.name}</div>
                    <div class="online-user-status">متصفح للموقع الإلكتروني</div>
                </div>
                <span style="font-size:0.7rem; color:var(--green-online); font-weight:800;">● متواجد الآن</span>
            </div>
        `).join('');
    }
}

// 🏠 3. الصفحة الرئيسية وسجل الأعضاء
function renderHomeWidgets() {
    if (typeof phantomData === "undefined") return;

    const fullRoster = getCombinedRoster();

    const totalBadge = document.getElementById("total-count-badge");
    const verifiedStat = document.getElementById("stat-verified-count");
    const leadersStat = document.getElementById("stat-leaders-count");
    const rosterPreview = document.getElementById("roster-preview-list");

    const totalCount = fullRoster.length;
    const verifiedCount = fullRoster.filter(m => m.status === "موثق").length;
    const leadersCount = phantomData.leadership ? phantomData.leadership.length : 0;

    if (totalBadge) totalBadge.innerText = `${totalCount} عضو`;
    if (verifiedStat) verifiedStat.innerText = verifiedCount;
    if (leadersStat) leadersStat.innerText = leadersCount;

    if (rosterPreview) {
        rosterPreview.innerHTML = fullRoster.slice(0, 6).map(member => `
            <span class="roster-chip">${member.name}</span>
        `).join('') + (totalCount > 6 ? `<span class="roster-chip" style="color:var(--cyan-accent);">+${totalCount - 6} آخرين</span>` : '');
    }
}

function getCombinedRoster() {
    const baseRoster = (typeof phantomData !== "undefined" && phantomData.roster) ? phantomData.roster : [];
    const customMembers = JSON.parse(localStorage.getItem("phantom_custom_roster")) || [];
    return [...baseRoster, ...customMembers];
}

// 🛠️ 4. لوحة تحكم المؤسسين ومطابقة القادة وصلاحية الطرد (Strict Roles)
function setupFoundersPanel() {
    const triggerBtn = document.getElementById("admin-panel-trigger");
    const adminModal = document.getElementById("admin-modal");
    const closeBtn = document.getElementById("close-admin-btn");

    const authStep = document.getElementById("admin-auth-step");
    const toolsStep = document.getElementById("admin-tools-step");
    
    const adminPassInput = document.getElementById("admin-pass-input");
    const adminLoginBtn = document.getElementById("admin-login-btn");
    const adminAuthError = document.getElementById("admin-auth-error");

    const ADMIN_PASSCODE = (typeof phantomData !== "undefined" && phantomData.adminPanelCode) ? phantomData.adminPanelCode : "990099";

    triggerBtn.addEventListener("click", () => {
        adminModal.classList.add("active");
    });

    closeBtn.addEventListener("click", () => {
        adminModal.classList.remove("active");
    });

    adminLoginBtn.addEventListener("click", () => {
        if (adminPassInput.value.trim() === ADMIN_PASSCODE) {
            authStep.style.display = "none";
            toolsStep.style.display = "block";
            adminAuthError.innerText = "";

            populateAdminMemberSelects();
            checkRestrictedPermissions();
        } else {
            adminAuthError.innerText = "رمز حماية الأدمن غير صحيح!";
        }
    });

    // 1. تسجّيل حضور الروم (+30 نقطة)
    document.getElementById("mark-attendance-btn").addEventListener("click", () => {
        const select = document.getElementById("attendance-member-select");
        const memberName = select.value;
        if (memberName) {
            addPointsToUser(memberName, 30);
            alert(`تم تسجيل حضور ${memberName} وإضافة +30 نقطة لحسابه في لوحة الصدارة!`);
            renderLeaderboard();
        }
    });

    // 2. إضافة كرت أصفر / إنذار
    document.getElementById("issue-warning-btn").addEventListener("click", () => {
        const select = document.getElementById("warning-member-select");
        const typeSelect = document.getElementById("warning-type-select");
        const reasonInput = document.getElementById("warning-reason-input");

        const memberName = select.value;
        const infractionType = typeSelect.value;
        const reason = reasonInput.value.trim();

        if (memberName && reason) {
            let warnings = JSON.parse(localStorage.getItem("phantom_warnings")) || [];
            warnings.push({
                id: Date.now(),
                name: memberName,
                type: infractionType,
                reason: reason,
                date: new Date().toLocaleDateString('ar-EG')
            });
            localStorage.setItem("phantom_warnings", JSON.stringify(warnings));

            alert(`تم إصدار الكرت الأصفر بنجاح بحق العضو ${memberName}`);
            reasonInput.value = "";
            renderActiveWarnings();
            renderAdminWarningsList();
        } else {
            alert("يرجى كتابة سبب الإنذار أولاً!");
        }
    });

    // 3. إنشاء استطلاع رأي لمواعيد الرومات
    document.getElementById("create-poll-btn").addEventListener("click", () => {
        const question = document.getElementById("poll-question-input").value.trim();
        const optionsRaw = document.getElementById("poll-options-input").value.trim();

        if (question && optionsRaw) {
            const options = optionsRaw.split(",").map((opt, idx) => ({
                id: idx,
                text: opt.trim(),
                votes: 0
            }));

            const pollData = { question, options, totalVotes: 0 };
            localStorage.setItem("phantom_active_poll", JSON.stringify(pollData));
            localStorage.removeItem("phantom_user_voted_id");

            alert("تم نشر الاستطلاع بنجاح في قسم الرومات!");
            document.getElementById("poll-question-input").value = "";
            document.getElementById("poll-options-input").value = "";

            renderPollSystem();
        }
    });

    // 4. إضافة عضو جديد ديناميكياً
    document.getElementById("add-member-btn").addEventListener("click", () => {
        const name = document.getElementById("new-member-name").value.trim();
        const rank = document.getElementById("new-member-rank").value.trim();
        const verified = document.getElementById("new-member-verified").value;

        if (name && rank) {
            const customMembers = JSON.parse(localStorage.getItem("phantom_custom_roster")) || [];
            customMembers.push({ name, rank, status: verified });
            localStorage.setItem("phantom_custom_roster", JSON.stringify(customMembers));

            alert(`تمت إضافة العضو ${name} بنجاح!`);
            document.getElementById("new-member-name").value = "";
            document.getElementById("new-member-rank").value = "";

            renderRoster();
            renderHomeWidgets();
            populateAdminMemberSelects();
        }
    });

    // 5. طرد/استبعاد عضو (حبيس للقائد ونائبه)
    document.getElementById("kick-member-btn").addEventListener("click", () => {
        const kickSelect = document.getElementById("kick-member-select");
        const memberName = kickSelect.value;

        if (memberName && confirm(`هل أنت ألكيد من طرد واستبعاد العضو ${memberName} من سجل الكتيبة؟`)) {
            let customMembers = JSON.parse(localStorage.getItem("phantom_custom_roster")) || [];
            customMembers = customMembers.filter(m => m.name !== memberName);
            localStorage.setItem("phantom_custom_roster", JSON.stringify(customMembers));

            alert(`تم استبعاد العضو ${memberName} بنجاح.`);
            renderRoster();
            renderHomeWidgets();
            populateAdminMemberSelects();
        }
    });
}

// دالة لتغذية القوائم المنسدلة بالأدمن
function populateAdminMemberSelects() {
    const fullRoster = getCombinedRoster();
    const optionsHtml = fullRoster.map(m => `<option value="${m.name}">${m.name} (${m.rank})</option>`).join('');

    document.getElementById("attendance-member-select").innerHTML = optionsHtml;
    document.getElementById("warning-member-select").innerHTML = optionsHtml;
    document.getElementById("kick-member-select").innerHTML = optionsHtml;

    renderAdminWarningsList();
}

// التحقق من صلاحية الطرد (القائد ونائبه فقط)
function checkRestrictedPermissions() {
    const currentUser = localStorage.getItem("phantom_active_username") || "";
    const restrictedSection = document.getElementById("restricted-kick-section");

    if (isLeaderOrVice(currentUser)) {
        restrictedSection.style.display = "block";
    } else {
        restrictedSection.style.display = "none";
    }
}

// مطابقة الأسماء الذكية (Fuzzy Match / Normalizer)
function normalizeName(str) {
    if (!str) return "";
    return str.toLowerCase()
        .replace(/『ph』|eph|ph|\[egy\]|○|§|ê|ə/g, "")
        .replace(/[^a-z0-9أ-ي]/g, "")
        .trim();
}

function isLeaderOrVice(username) {
    const norm = normalizeName(username);
    // المطابقة مع BLACK و 5ĤMƏD / 5HMED
    return norm.includes("black") || norm.includes("5hmed") || norm.includes("5omod") || norm.includes("أحمد") || norm.includes("احمد");
}

// ⚠️ 5. عرض وتعيين الكروت الصفراء والإنذارات
function renderActiveWarnings() {
    const container = document.getElementById("active-warnings-public-list");
    if (!container) return;

    const warnings = JSON.parse(localStorage.getItem("phantom_warnings")) || [];

    if (warnings.length === 0) {
        container.innerHTML = `<div style="font-size:0.8rem; color:var(--silver-muted); padding: 8px;">✅ لا توجد إنذارات أو كروت صفراء نشطة حالياً. الكلان في حالة انضباط تامة!</div>`;
        return;
    }

    container.innerHTML = warnings.map(w => `
        <div class="warning-card-item">
            <div class="warning-card-header">
                <span class="warning-card-name">${w.name}</span>
                <span class="warning-card-type">${w.type}</span>
            </div>
            <div class="warning-card-reason">⚠️ السبب: ${w.reason} (${w.date})</div>
        </div>
    `).join('');
}

function renderAdminWarningsList() {
    const list = document.getElementById("admin-warnings-manage-list");
    if (!list) return;

    const warnings = JSON.parse(localStorage.getItem("phantom_warnings")) || [];

    if (warnings.length === 0) {
        list.innerHTML = `<span style="font-size:0.75rem; color:var(--silver-muted);">لا توجد إنذارات مسجلة.</span>`;
        return;
    }

    list.innerHTML = warnings.map(w => `
        <div class="admin-mini-item">
            <span><strong>${w.name}</strong> - ${w.type}</span>
            <button class="admin-del-btn" onclick="removeWarning(${w.id})">🗑️ مسح</button>
        </div>
    `).join('');
}

window.removeWarning = function(warningId) {
    let warnings = JSON.parse(localStorage.getItem("phantom_warnings")) || [];
    warnings = warnings.filter(w => w.id !== warningId);
    localStorage.setItem("phantom_warnings", JSON.stringify(warnings));

    renderActiveWarnings();
    renderAdminWarningsList();
};

// 🏆 6. حساب وإضافة النقاط ولوحة الصدارة المدمجة
function addPointsToUser(username, ptsToAdd) {
    let userPoints = JSON.parse(localStorage.getItem("phantom_user_points")) || {};
    const currentPts = userPoints[username] || 0;
    userPoints[username] = currentPts + ptsToAdd;
    localStorage.setItem("phantom_user_points", JSON.stringify(userPoints));
}

function renderLeaderboard() {
    const container = document.getElementById("leaderboard-list");
    if (!container || typeof phantomData === "undefined") return;

    const savedPoints = JSON.parse(localStorage.getItem("phantom_user_points")) || {};
    const baseBoard = phantomData.leaderboard || [];

    // دمج نقاط الكود الأساسية مع النقاط الديناميكية الحالية
    let leaderboardMap = {};

    baseBoard.forEach(item => {
        const basePtsNum = parseInt(item.points) || 1000;
        leaderboardMap[item.name] = basePtsNum;
    });

    Object.keys(savedPoints).forEach(user => {
        leaderboardMap[user] = (leaderboardMap[user] || 500) + savedPoints[user];
    });

    // تحويل لكائن وترتيب تنازلي حسب النقاط
    let sortedList = Object.keys(leaderboardMap).map(name => ({
        name: name,
        points: leaderboardMap[name]
    })).sort((a, b) => b.points - a.points);

    container.innerHTML = sortedList.map((item, index) => {
        const rank = index + 1;
        let rankClass = "";
        let crownIcon = "";

        if (rank === 1) { rankClass = "rank-1"; crownIcon = "👑 "; }
        else if (rank === 2) { rankClass = "rank-2"; crownIcon = "🥈 "; }
        else if (rank === 3) { rankClass = "rank-3"; crownIcon = "🥉 "; }

        return `
            <div class="compact-leaderboard-item ${rankClass}">
                <div class="member-info">
                    <span class="rank-badge-pill">#${rank}</span>
                    <span class="member-name-text">${crownIcon}${item.name}</span>
                </div>
                <span class="points-badge">${item.points} نقطة</span>
            </div>
        `;
    }).join('');
}

// 🗳️ 7. استطلاع الرأي والتصويت (+10 نقاط)
function renderPollSystem() {
    const pollWrapper = document.getElementById("poll-section-wrapper");
    const pollCard = document.getElementById("active-poll-card");

    const savedPoll = JSON.parse(localStorage.getItem("phantom_active_poll"));
    if (!savedPoll) {
        if (pollWrapper) pollWrapper.style.display = "none";
        return;
    }

    pollWrapper.style.display = "block";
    const userVotedId = localStorage.getItem("phantom_user_voted_id");

    pollCard.innerHTML = `
        <div class="poll-question">📊 ${savedPoll.question}</div>
        <div class="poll-options">
            ${savedPoll.options.map(opt => {
                const percent = savedPoll.totalVotes > 0 ? Math.round((opt.votes / savedPoll.totalVotes) * 100) : 0;
                return `
                    <button class="poll-option-btn" onclick="voteInPoll(${opt.id})" ${userVotedId !== null ? 'disabled' : ''}>
                        <div class="poll-progress-bar" style="width: ${percent}%;"></div>
                        <div class="poll-option-text">
                            <span>${opt.text}</span>
                            <span><strong>${percent}%</strong> (${opt.votes} صوت)</span>
                        </div>
                    </button>
                `;
            }).join('')}
        </div>
        <div style="font-size:0.75rem; color:var(--silver-muted); margin-top:8px;">إجمالي الأصوات: ${savedPoll.totalVotes} • تصويتك يمنحك (+10 نقاط) بصدارتك</div>
    `;
}

window.voteInPoll = function(optionId) {
    let savedPoll = JSON.parse(localStorage.getItem("phantom_active_poll"));
    if (!savedPoll || localStorage.getItem("phantom_user_voted_id") !== null) return;

    savedPoll.options[optionId].votes += 1;
    savedPoll.totalVotes += 1;

    localStorage.setItem("phantom_active_poll", JSON.stringify(savedPoll));
    localStorage.setItem("phantom_user_voted_id", optionId);

    // إضافة 10 نقاط للمصوت
    const activeUser = localStorage.getItem("phantom_active_username");
    if (activeUser) {
        addPointsToUser(activeUser, 10);
        renderLeaderboard();
    }

    renderPollSystem();
};

// 💬 8. شات الكلان التفاعلي بفقاعات الواتساب
function setupChatSystem() {
    const form = document.getElementById("chat-input-form");
    const input = document.getElementById("chat-message-input");

    if (!form) return;

    renderChatMessages();

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        const sender = localStorage.getItem("phantom_active_username") || "مقاتل مجهول";

        if (text) {
            let messages = JSON.parse(localStorage.getItem("phantom_chat_messages")) || [];
            messages.push({
                sender: sender,
                text: text,
                time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
                isLeader: isLeaderOrVice(sender)
            });

            localStorage.setItem("phantom_chat_messages", JSON.stringify(messages));
            input.value = "";
            renderChatMessages();
        }
    });
}

function renderChatMessages() {
    const container = document.getElementById("chat-messages-container");
    if (!container) return;

    const messages = JSON.parse(localStorage.getItem("phantom_chat_messages")) || [
        { sender: "『PH』 BLACK", text: "أهلاً بالرجالة في شات المقر السري للكتيبة! 🚀", time: "10:00 م", isLeader: true },
        { sender: "ƏPH 5○M○D", text: "منورين يا شباب، الالتزام بالرومات والتعليمات ضروري ⚔️", time: "10:05 م", isLeader: true }
    ];

    const currentUser = localStorage.getItem("phantom_active_username") || "";

    container.innerHTML = messages.map(msg => {
        const isMe = msg.sender === currentUser;
        const bubbleClass = isMe ? "me" : "other";
        const leaderBadge = msg.isLeader ? `<span class="leader-tag-badge">قيادة</span>` : "";

        return `
            <div class="chat-bubble ${bubbleClass}">
                <div class="sender-name">${msg.sender} ${leaderBadge}</div>
                <div>${msg.text}</div>
                <div class="message-time">${msg.time}</div>
            </div>
        `;
    }).join('');

    container.scrollTop = container.scrollHeight;
}

// 🧭 9. التنقل وإظهار الصفحات
function setupNavigation() {
    const clickableElements = document.querySelectorAll("[data-target]");
    const pageViews = document.querySelectorAll(".page-view");
    const dockItems = document.querySelectorAll(".dock-item");

    clickableElements.forEach(element => {
        element.addEventListener("click", (e) => {
            e.preventDefault();
            const targetPageId = element.getAttribute("data-target");
            if (!targetPageId) return;

            pageViews.forEach(page => page.classList.toggle("active", page.id === targetPageId));
            dockItems.forEach(item => item.classList.toggle("active", item.getAttribute("data-target") === targetPageId));

            window.scrollTo({ top: 0, behavior: "smooth" });
        });
    });
}

// عرض القيادة
function renderLeadership() {
    const container = document.getElementById("leadership-grid");
    if (!container || typeof phantomData === "undefined") return;

    container.innerHTML = phantomData.leadership.map(leader => `
        <div class="leadership-card">
            <span class="rank-badge">${leader.rank}</span>
            <div class="leader-name">${leader.name}</div>
            <div class="leader-role">${leader.role}</div>
            <div style="font-size:0.75rem; color:var(--silver-muted); margin-top:4px;">${leader.tag}</div>
        </div>
    `).join('');
}

// عرض سجل الأعضاء
function renderRoster() {
    const container = document.getElementById("roster-grid");
    if (!container) return;

    const fullRoster = getCombinedRoster();

    container.innerHTML = fullRoster.map(member => `
        <div class="roster-card">
            <div class="roster-header">
                <span class="roster-name">${member.name}</span>
                <span class="tag-verified">✔ ${member.status}</span>
            </div>
            <div style="font-size:0.78rem; color:var(--silver-muted);">الرتبة: ${member.rank}</div>
        </div>
    `).join('');
}

// عرض جدول الرومات بدون دبوس 📌
function renderSchedule() {
    const container = document.getElementById("schedule-grid");
    if (!container || typeof phantomData === "undefined") return;

    container.innerHTML = phantomData.schedule.map(slot => `
        <div class="schedule-card">
            <div class="schedule-day">${slot.day}</div>
            <div style="font-weight:700; margin-bottom:4px;">${slot.mode}</div>
            <div style="color:var(--silver-muted); font-size:0.8rem;">⏱️ ${slot.time}</div>
            <div style="font-size:0.73rem; color:var(--cyan-accent); margin-top:4px;">${slot.notes}</div>
        </div>
    `).join('');
}

// عرض القوانين
function renderRules() {
    const generalContainer = document.getElementById("general-rules-list");
    const clearanceContainer = document.getElementById("clearance-system-list");

    if (typeof phantomData === "undefined") return;

    if (generalContainer && phantomData.rules.general) {
        generalContainer.innerHTML = phantomData.rules.general.map(rule => `<li>${rule}</li>`).join('');
    }

    if (clearanceContainer && phantomData.rules.penalties) {
        clearanceContainer.innerHTML = phantomData.rules.penalties.map(item => `
            <div class="clearance-item">
                <strong>⚠️ ${item.infraction}:</strong> ${item.duration}
            </div>
        `).join('');
    }
}

// عرض روابط التواصل والدعم
function renderSocialLinks() {
    const container = document.getElementById("links-grid");
    if (!container || typeof phantomData === "undefined") return;

    container.innerHTML = phantomData.socialLinks.map(link => `
        <a href="${link.url}" target="_blank" class="link-card">
            <div class="link-icon">${link.icon}</div>
            <div>
                <h4 style="font-size:0.95rem; font-weight:800;">${link.title}</h4>
                <p style="font-size:0.75rem; color:var(--silver-muted);">${link.subtitle}</p>
            </div>
        </a>
    `).join('');
}
