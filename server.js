/* ========================================================
   PHANTOM HQ - SERVER
   server.js | Backend API (Updated & Modernized)
   ======================================================== */

"use strict";

const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = Number(process.env.PORT) || 3000;

/* ========================================================
   1. المسارات والمجلدات
   ======================================================== */
const STORAGE_DIR = path.join(__dirname, "server-storage");
const DATABASE_FILE = path.join(STORAGE_DIR, "phantom-db.json");
const PUBLIC_DIR = fs.existsSync(path.join(__dirname, "public", "index.html"))
    ? path.join(__dirname, "public")
    : __dirname;

/* ========================================================
   2. Middlewares الأمان والتجهيز
   ======================================================== */
app.use(cors({ origin: "*", methods: ["GET", "POST", "DELETE", "PUT"] }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(PUBLIC_DIR));

/* ========================================================
   3. إعداد وقاعدة البيانات (Atomic Save System)
   ======================================================== */
function createEmptyDatabase() {
    return {
        members: [],
        presence: [],
        warnings: [],
        points: {},
        messages: [],
        polls: [],
        attendance: [],
        updates: []
    };
}

function loadDatabase() {
    try {
        if (!fs.existsSync(STORAGE_DIR)) {
            fs.mkdirSync(STORAGE_DIR, { recursive: true });
        }

        if (!fs.existsSync(DATABASE_FILE)) {
            const freshDb = createEmptyDatabase();
            saveDatabase(freshDb);
            return freshDb;
        }

        const raw = fs.readFileSync(DATABASE_FILE, "utf8");
        const parsed = JSON.parse(raw);
        return { ...createEmptyDatabase(), ...parsed };
    } catch (error) {
        console.error("❌ Failed to load PHANTOM database:", error);
        return createEmptyDatabase();
    }
}

function saveDatabase(data = database) {
    try {
        if (!fs.existsSync(STORAGE_DIR)) {
            fs.mkdirSync(STORAGE_DIR, { recursive: true });
        }

        const tempFile = path.join(STORAGE_DIR, `phantom-db-${Date.now()}.tmp`);
        fs.writeFileSync(tempFile, JSON.stringify(data, null, 4), "utf8");
        fs.renameSync(tempFile, DATABASE_FILE);
        return true;
    } catch (error) {
        console.error("❌ Failed to save PHANTOM database:", error);
        return false;
    }
}

const database = loadDatabase();
const serverState = { startedAt: Date.now(), online: true };

/* ========================================================
   4. الأدوات المساعدة (Helpers)
   ======================================================== */
function normalizeName(name) {
    return name ? String(name).trim().toLowerCase() : "";
}

function createId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function trimText(value, maxLength) {
    return String(value || "").trim().slice(0, maxLength);
}

function cleanupPresence() {
    const timeout = 2 * 60 * 1000; // دقيقتين
    const now = Date.now();
    database.presence = database.presence.filter(user => user && user.time && (now - user.time < timeout));
}

/* ========================================================
   5. مسارات النظام (System Routes)
   ======================================================== */
app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        server: "PHANTOM HQ",
        status: serverState.online ? "online" : "offline",
        uptime: Date.now() - serverState.startedAt,
        timestamp: Date.now()
    });
});

app.get("/api/status", (req, res) => {
    res.json({
        success: true,
        server: "PHANTOM HQ",
        members: database.members.length,
        online: database.presence.length,
        messages: database.messages.length,
        warnings: database.warnings.length,
        timestamp: Date.now()
    });
});

/* ========================================================
   6. الأعضاء (Members API)
   ======================================================== */
app.get("/api/members", (req, res) => {
    res.json({ success: true, members: database.members });
});

app.post("/api/members", (req, res) => {
    const name = trimText(req.body.name, 40);
    const rank = trimText(req.body.rank || "مقاتل", 40);
    const status = trimText(req.body.status || "موثق", 30);

    if (name.length < 2) {
        return res.status(400).json({ success: false, message: "اسم العضو غير صالح." });
    }

    const normalized = normalizeName(name);
    if (database.members.some(m => normalizeName(m.name) === normalized)) {
        return res.status(409).json({ success: false, message: "العضو موجود بالفعل." });
    }

    const member = {
        id: createId("member"),
        name,
        rank,
        status,
        points: 0,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
        source: "server",
        normalized
    };

    database.members.push(member);
    database.points[member.id] = 0;
    saveDatabase();

    res.status(201).json({ success: true, member });
});

app.delete("/api/members/:id", (req, res) => {
    const { id } = req.params;
    const index = database.members.findIndex(m => m.id === id);

    if (index === -1) {
        return res.status(404).json({ success: false, message: "العضو غير موجود." });
    }

    const [removed] = database.members.splice(index, 1);
    delete database.points[id];
    database.presence = database.presence.filter(u => u.memberId !== id);
    database.warnings = database.warnings.filter(w => w.memberId !== id);

    saveDatabase();
    res.json({ success: true, member: removed });
});

/* ========================================================
   7. الحضور والنشاط (Presence API)
   ======================================================== */
app.post("/api/presence", (req, res) => {
    const name = trimText(req.body.name, 40);
    if (name.length < 2) {
        return res.status(400).json({ success: false, message: "اسم المستخدم غير صالح." });
    }

    const normalized = normalizeName(name);
    let member = database.members.find(m => normalizeName(m.name) === normalized);

    if (!member) {
        member = {
            id: createId("member"),
            name,
            rank: "مقاتل",
            status: "موثق",
            points: 0,
            joinedAt: Date.now(),
            lastSeen: Date.now(),
            source: "auto",
            normalized
        };
        database.members.push(member);
        database.points[member.id] = 0;
    } else {
        member.name = name;
        member.lastSeen = Date.now();
    }

    const presenceObj = { memberId: member.id, name: member.name, time: Date.now() };
    const existingIndex = database.presence.findIndex(u => u.memberId === member.id);

    if (existingIndex !== -1) {
        database.presence[existingIndex] = presenceObj;
    } else {
        database.presence.push(presenceObj);
    }

    cleanupPresence();
    saveDatabase();

    res.json({ success: true, member, online: database.presence });
});

app.get("/api/presence", (req, res) => {
    cleanupPresence();
    res.json({ success: true, users: database.presence });
});

app.post("/api/members/:id/presence", (req, res) => {
    const member = database.members.find(m => m.id === req.params.id);
    if (!member) {
        return res.status(404).json({ success: false, message: "العضو غير موجود." });
    }

    member.lastSeen = Date.now();
    const presenceObj = { memberId: member.id, name: member.name, time: Date.now() };
    const existingIndex = database.presence.findIndex(u => u.memberId === member.id);

    if (existingIndex === -1) {
        database.presence.push(presenceObj);
    } else {
        database.presence[existingIndex] = presenceObj;
    }

    cleanupPresence();
    saveDatabase();

    res.json({ success: true, member });
});

/* ========================================================
   8. النقاط ولوحة الصدارة (Points & Leaderboard)
   ======================================================== */
app.post("/api/members/:id/points", (req, res) => {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount)) {
        return res.status(400).json({ success: false, message: "قيمة النقاط غير صحيحة." });
    }

    const member = database.members.find(m => m.id === req.params.id);
    if (!member) {
        return res.status(404).json({ success: false, message: "العضو غير موجود." });
    }

    member.points = (Number(member.points) || 0) + amount;
    database.points[member.id] = member.points;
    saveDatabase();

    res.json({ success: true, member });
});

app.get("/api/leaderboard", (req, res) => {
    const leaderboard = [...database.members]
        .sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0))
        .map((m, idx) => ({
            rank: idx + 1,
            id: m.id,
            name: m.name,
            points: Number(m.points) || 0
        }));

    res.json({ success: true, leaderboard });
});

app.post("/api/attendance", (req, res) => {
    const memberId = String(req.body.memberId || "");
    const member = database.members.find(m => m.id === memberId);

    if (!member) {
        return res.status(404).json({ success: false, message: "العضو غير موجود." });
    }

    const attendance = {
        id: createId("attendance"),
        memberId: member.id,
        memberName: member.name,
        points: 30,
        timestamp: Date.now()
    };

    database.attendance.push(attendance);
    member.points = (Number(member.points) || 0) + 30;
    database.points[member.id] = member.points;

    saveDatabase();
    res.status(201).json({ success: true, attendance, member });
});

/* ========================================================
   9. الإنذارات (Warnings)
   ======================================================== */
app.get("/api/warnings", (req, res) => {
    res.json({ success: true, warnings: database.warnings });
});

app.post("/api/warnings", (req, res) => {
    const memberId = String(req.body.memberId || "");
    const type = trimText(req.body.type || "إنذار", 50);
    const reason = trimText(req.body.reason, 200);

    if (!memberId || !reason) {
        return res.status(400).json({ success: false, message: "بيانات الإنذار ناقصة." });
    }

    const member = database.members.find(m => m.id === memberId);
    if (!member) {
        return res.status(404).json({ success: false, message: "العضو غير موجود." });
    }

    const warning = {
        id: createId("warning"),
        memberId: member.id,
        memberName: member.name,
        type,
        reason,
        date: new Date().toLocaleDateString("ar-EG"),
        createdAt: Date.now()
    };

    database.warnings.push(warning);
    saveDatabase();

    res.status(201).json({ success: true, warning });
});

app.delete("/api/warnings/:id", (req, res) => {
    const index = database.warnings.findIndex(w => w.id === req.params.id);
    if (index === -1) {
        return res.status(404).json({ success: false, message: "الإنذار غير موجود." });
    }

    const [removed] = database.warnings.splice(index, 1);
    saveDatabase();

    res.json({ success: true, warning: removed });
});

/* ========================================================
   10. الشات واستطلاعات الرأي (Chat & Polls)
   ======================================================== */
app.get("/api/chat", (req, res) => {
    res.json({ success: true, messages: database.messages });
});

app.post("/api/chat", (req, res) => {
    const sender = trimText(req.body.sender, 40);
    const text = trimText(req.body.text, 300);

    if (!sender || !text) {
        return res.status(400).json({ success: false, message: "الرسالة ناقصة." });
    }

    const message = {
        id: createId("message"),
        sender,
        text,
        timestamp: Date.now(),
        time: new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    };

    database.messages.push(message);
    if (database.messages.length > 200) {
        database.messages = database.messages.slice(-200);
    }

    saveDatabase();
    res.status(201).json({ success: true, message });
});

app.get("/api/poll", (req, res) => {
    const poll = database.polls.find(p => p.active === true) || null;
    res.json({ success: true, poll });
});

app.post("/api/poll", (req, res) => {
    const question = trimText(req.body.question, 150);
    const optionOne = trimText(req.body.optionOne, 100);
    const optionTwo = trimText(req.body.optionTwo, 100);

    if (!question || !optionOne || !optionTwo) {
        return res.status(400).json({ success: false, message: "السؤال والاختياران مطلوبون." });
    }

    database.polls.forEach(p => { p.active = false; });

    const poll = {
        id: createId("poll"),
        question,
        options: [
            { id: 1, text: optionOne, votes: 0, voters: [] },
            { id: 2, text: optionTwo, votes: 0, voters: [] }
        ],
        totalVotes: 0,
        active: true,
        createdAt: Date.now()
    };

    database.polls.push(poll);
    saveDatabase();

    res.status(201).json({ success: true, poll });
});

app.post("/api/poll/vote", (req, res) => {
    const poll = database.polls.find(p => p.active === true);
    if (!poll) {
        return res.status(404).json({ success: false, message: "لا يوجد استطلاع نشط." });
    }

    const optionId = Number(req.body.optionId);
    const voter = trimText(req.body.username, 40);

    if (!voter) {
        return res.status(400).json({ success: false, message: "اسم المصوت مطلوب." });
    }

    const option = poll.options.find(o => o.id === optionId);
    if (!option) {
        return res.status(400).json({ success: false, message: "اختيار غير صالح." });
    }

    const voterNormalized = normalizeName(voter);
    const alreadyVoted = poll.options.some(o => Array.isArray(o.voters) && o.voters.includes(voterNormalized));

    if (alreadyVoted) {
        return res.status(409).json({ success: false, message: "لقد صوت هذا المستخدم بالفعل." });
    }

    option.voters.push(voterNormalized);
    option.votes += 1;
    poll.totalVotes += 1;

    saveDatabase();
    res.json({ success: true, poll, vote: option });
});

app.delete("/api/poll", (req, res) => {
    const poll = database.polls.find(p => p.active === true);
    if (!poll) {
        return res.json({ success: true, message: "لا يوجد استطلاع نشط." });
    }

    poll.active = false;
    saveDatabase();
    res.json({ success: true, poll });
});

/* ========================================================
   11. التحديثات والجدولة (Updates & Cron Jobs)
   ======================================================== */
app.get("/api/updates", (req, res) => {
    res.json({ success: true, updates: database.updates });
});

app.post("/api/updates", (req, res) => {
    const title = trimText(req.body.title, 100);
    const description = trimText(req.body.description, 300);

    if (!title || !description) {
        return res.status(400).json({ success: false, message: "بيانات التحديث ناقصة." });
    }

    const update = {
        id: createId("update"),
        title,
        description,
        createdAt: Date.now(),
        date: new Date().toLocaleDateString("ar-EG")
    };

    database.updates.push(update);
    if (database.updates.length > 100) {
        database.updates = database.updates.slice(-100);
    }

    saveDatabase();
    res.status(201).json({ success: true, update });
});

// تنظيف دوري المتواجدين كل دقيقة
setInterval(() => {
    const before = database.presence.length;
    cleanupPresence();
    if (before !== database.presence.length) {
        saveDatabase();
    }
}, 60 * 1000);

/* ========================================================
   12. معالجة الصفحات والأخطاء (Routing & Error Handling)
   ======================================================== */
app.use("/api", (req, res) => {
    res.status(404).json({ success: false, message: "PHANTOM API endpoint not found." });
});

app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) {
        return next();
    }

    const indexFile = path.join(PUBLIC_DIR, "index.html");
    if (fs.existsSync(indexFile)) {
        return res.sendFile(indexFile);
    }
    next();
});

app.use((error, req, res, next) => {
    console.error("❌ PHANTOM SERVER ERROR:", error);
    if (res.headersSent) {
        return next(error);
    }
    res.status(500).json({ success: false, message: "حدث خطأ داخلي في السيرفر." });
});

/* ========================================================
   13. التشغيل
   ======================================================== */
app.listen(PORT, () => {
    console.log("======================================");
    console.log("⚡ PHANTOM HQ SERVER (ONLINE)");
    console.log("======================================");
    console.log(`🚀 Port: ${PORT}`);
    console.log(`🌐 URL: http://localhost:${PORT}`);
    console.log(`💾 Database: ${DATABASE_FILE}`);
    console.log(`📁 Site Dir: ${PUBLIC_DIR}`);
    console.log("======================================");
});

