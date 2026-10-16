/**
 * PHANTOM HQ — regression tests for the "fix-medium" batch.
 *
 * Covers:
 *   1. Agora auto-rejoin after refresh
 *      - `isSavedCallStillActive()` reads Supabase `active_calls` first (string/number safe).
 *      - `checkAgoraAutoReconnectOnRefresh()` rejoins when the call is still active,
 *        clears the saved session only when the call is really gone, and keeps it
 *        on transient failures so a later retry can still succeed.
 *   2. Founder role persistence via the existing `members.rank` column
 *      - `serverCreateMember()` persists a leadership rank and never downgrades one.
 *      - `isFounderSession()` trusts the persisted `members.rank` over the local cache.
 *      - `restoreFounderStatus()` re-arms the admin session from `members.rank`.
 *
 * The real implementation is extracted straight out of script.js and run in a
 * node:vm sandbox against in-memory stubs.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');

/* استخراج دالة كاملة من script.js عبر مطابقة الأقواس */
function extractFunction(signature) {
    const start = SOURCE.indexOf(signature);
    assert.notEqual(start, -1, `function not found: ${signature}`);
    const braceStart = SOURCE.indexOf('{', start + signature.length - 1);
    assert.notEqual(braceStart, -1, `no body for: ${signature}`);
    let depth = 0;
    for (let i = braceStart; i < SOURCE.length; i++) {
        const ch = SOURCE[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return SOURCE.slice(start, i + 1);
        }
    }
    throw new Error(`unbalanced braces for ${signature}`);
}

/* ------------------------------------------------------------------ */
/* Sandbox with in-memory storage + stubs                             */
/* ------------------------------------------------------------------ */
function createSandbox(overrides = {}) {
    const store = new Map();
    const session = new Map();
    const toasts = [];

    if (overrides.storage) {
        Object.entries(overrides.storage).forEach(([key, value]) => store.set(key, value));
    }

    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        showToast: (msg, type) => { toasts.push({ msg, type }); },
        normalizeName: (name) => String(name || '').trim().toLowerCase(),
        getStorage: (key, fallback) => (store.has(key) ? store.get(key) : fallback),
        setStorage: (key, value) => { store.set(key, value); },
        getCurrentUsername: () => overrides.username || '',
        getFullRoster: () => overrides.roster || [],
        sessionStorage: {
            getItem: (k) => (session.has(k) ? session.get(k) : null),
            setItem: (k, v) => { session.set(k, String(v)); },
            removeItem: (k) => { session.delete(k); },
            clear: () => session.clear()
        },
        fetch: overrides.fetch || (() => Promise.resolve({ ok: false })),
        serverGetActiveCalls: overrides.serverGetActiveCalls || (async () => []),
        joinAgoraRoom: overrides.joinAgoraRoom || (async () => true),
        startInAppCall: overrides.startInAppCall || (async () => true),
        supabaseClient: overrides.supabaseClient || null,
        _store: store,
        _session: session,
        _toasts: toasts
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    return sandbox;
}

function load(sandbox, ...signatures) {
    const code = signatures.map(extractFunction).join('\n\n');
    vm.runInContext(code, sandbox);
}

/* fake chainable Supabase client backed by a plain rows array */
function fakeSupabaseClient(rows) {
    const tables = { members: rows };
    return {
        from(name) {
            const query = {
                _eq: null,
                _patch: null,
                select() { return this; },
                eq(column, value) { this._eq = [column, value]; return this; },
                update(patch) { this._patch = patch; return this; },
                then(resolve) {
                    const list = tables[name] || [];
                    const matched = list.filter(r => String(r[this._eq[0]]) === String(this._eq[1]));
                    if (this._patch) matched.forEach(r => Object.assign(r, this._patch));
                    return Promise.resolve({ data: matched, error: null }).then(resolve);
                }
            };
            return query;
        }
    };
}

/* ------------------------------------------------------------------ */
/* TEST 1 — isLeadershipRank                                          */
/* ------------------------------------------------------------------ */
function testIsLeadershipRank() {
    const sb = createSandbox();
    load(sb, 'function isLeadershipRank(rank)');
    const fn = vm.runInContext('isLeadershipRank', sb);
    assert.equal(fn('رئيس'), true);
    assert.equal(fn('قائد'), true);
    assert.equal(fn('مؤسس'), true);
    assert.equal(fn('عضو'), false);
    assert.equal(fn('محارب'), false);
    assert.equal(fn(undefined), false);
}

/* ------------------------------------------------------------------ */
/* TEST 2 — isFounderSession trusts the persisted members.rank        */
/* ------------------------------------------------------------------ */
function testFounderSessionUsesPersistedRank() {
    // الكاش المحلي قديم (عضو) لكن الرتبة الرسمية في members هي "رئيس"
    const sb = createSandbox({
        username: 'PH Leader',
        roster: [{ name: 'PH Leader', rank: 'عضو' }],
        storage: { phantom_server_members: [{ name: 'PH Leader', rank: 'رئيس' }] }
    });
    load(sb, 'function isLeadershipRank(rank)', 'function isFounderSession()');
    assert.equal(vm.runInContext('isFounderSession', sb)(), true,
        'رتبة القيادة المحفوظة في members لها الأولوية');

    const plain = createSandbox({
        username: 'PH Member',
        roster: [{ name: 'PH Member', rank: 'عضو' }],
        storage: { phantom_server_members: [{ name: 'PH Member', rank: 'عضو' }] }
    });
    load(plain, 'function isLeadershipRank(rank)', 'function isFounderSession()');
    assert.equal(vm.runInContext('isFounderSession', plain)(), false);
}

/* ------------------------------------------------------------------ */
/* TEST 3 — restoreFounderStatus re-arms the admin session            */
/* ------------------------------------------------------------------ */
function testRestoreFounderStatus() {
    const leader = createSandbox({
        username: 'Founder',
        storage: { phantom_server_members: [{ name: 'Founder', rank: 'مؤسس' }] }
    });
    load(leader, 'function isLeadershipRank(rank)', 'function restoreFounderStatus()');
    assert.equal(vm.runInContext('restoreFounderStatus', leader)(), true);
    assert.equal(leader._session.get('admin_authenticated'), 'true');

    const member = createSandbox({
        username: 'Plain',
        storage: { phantom_server_members: [{ name: 'Plain', rank: 'عضو' }] }
    });
    load(member, 'function isLeadershipRank(rank)', 'function restoreFounderStatus()');
    assert.equal(vm.runInContext('restoreFounderStatus', member)(), false);
    assert.equal(member._session.get('admin_authenticated'), undefined);
}
/* ------------------------------------------------------------------ */
/* TEST 4 — serverCreateMember persists rank without downgrading      */
/* ------------------------------------------------------------------ */
async function testServerCreateMemberRank() {
    // لا تخفيض لرتبة قيادية
    const keepRows = [{ id: 1, name: 'Leader', rank: 'رئيس', userId: 'u1', gameId: 'g1' }];
    const keep = createSandbox({ supabaseClient: fakeSupabaseClient(keepRows) });
    load(keep, 'function isLeadershipRank(rank)', 'async function serverCreateMember(');
    const keptMember = await vm.runInContext('serverCreateMember', keep)('Leader', 'عضو', 'u1', 'g1');
    assert.equal(keptMember.rank, 'رئيس', 'لا يجب تخفيض رتبة القائد');
    assert.equal(keepRows[0].rank, 'رئيس');

    // ترقية عضو إلى رئيس
    const upRows = [{ id: 2, name: 'NewLead', rank: 'عضو' }];
    const up = createSandbox({ supabaseClient: fakeSupabaseClient(upRows) });
    load(up, 'function isLeadershipRank(rank)', 'async function serverCreateMember(');
    const upMember = await vm.runInContext('serverCreateMember', up)('NewLead', 'رئيس');
    assert.equal(upMember.rank, 'رئيس', 'يجب تثبيت رتبة القيادة في members.rank');
    assert.equal(upRows[0].rank, 'رئيس');
}

/* ------------------------------------------------------------------ */
/* TEST 5 — isSavedCallStillActive (Supabase first, string/number)    */
/* ------------------------------------------------------------------ */
async function testIsSavedCallStillActive() {
    const sb = createSandbox({
        serverGetActiveCalls: async () => [{ id: 42 }],
        fetch: () => Promise.resolve({ ok: false })
    });
    load(sb, 'async function isSavedCallStillActive(');
    const fn = vm.runInContext('isSavedCallStillActive', sb);
    assert.equal(await fn('42'), true, 'يطابق الـ id كنص ورقم');
    assert.equal(await fn(42), true);
    assert.equal(await fn(99), false);

    // الاحتياطي: خادم Express المؤقت
    const fb = createSandbox({
        serverGetActiveCalls: async () => [],
        fetch: () => Promise.resolve({ ok: true, json: async () => ({ activeCalls: [{ id: '7', status: 'active' }] }) })
    });
    load(fb, 'async function isSavedCallStillActive(');
    const fbFn = vm.runInContext('isSavedCallStillActive', fb);
    assert.equal(await fbFn(7), true, 'يعتمد على /api/calls/active كاحتياطي');
    assert.equal(await fbFn(8), false);
}

/* ------------------------------------------------------------------ */
/* TEST 6 — checkAgoraAutoReconnectOnRefresh behaviour                */
/* ------------------------------------------------------------------ */
async function testAgoraAutoReconnect() {
    const SESSION_KEY = 'phantom_active_agora_session';

    // (أ) المكالمة نشطة → إعادة انضمام + بقاء الجلسة
    const calls = [];
    const ok = createSandbox({
        username: 'PH Member',
        serverGetActiveCalls: async () => [{ id: 5 }],
        joinAgoraRoom: async (...args) => { calls.push(args); return true; }
    });
    ok._session.set(SESSION_KEY, JSON.stringify({ mode: 'agora', channel: 'phantom_hq', callId: 5, host: 'H', room: 'R' }));
    load(ok, 'async function isSavedCallStillActive(', 'async function checkAgoraAutoReconnectOnRefresh(');
    await vm.runInContext('checkAgoraAutoReconnectOnRefresh', ok)();
    assert.deepEqual(calls[0], ['phantom_hq', 5, 'H', 'R'], 'يجب إعادة الانضمام بنفس القناة والـ id');
    assert.ok(ok._session.has(SESSION_KEY), 'الجلسة تبقى بعد إعادة الاتصال');

    // (ب) المكالمة انتهت → مسح الجلسة
    const gone = createSandbox({
        username: 'PH Member',
        serverGetActiveCalls: async () => [],
        fetch: () => Promise.resolve({ ok: false })
    });
    gone._session.set(SESSION_KEY, JSON.stringify({ mode: 'agora', callId: 9 }));
    load(gone, 'async function isSavedCallStillActive(', 'async function checkAgoraAutoReconnectOnRefresh(');
    await vm.runInContext('checkAgoraAutoReconnectOnRefresh', gone)();
    assert.equal(gone._session.has(SESSION_KEY), false, 'تُمسح الجلسة عندما تنتهي المكالمة فعلاً');

    // (ج) فشل مؤقت في إعادة الانضمام → تبقى الجلسة
    const transient = createSandbox({
        username: 'PH Member',
        serverGetActiveCalls: async () => [{ id: 3 }],
        joinAgoraRoom: async () => false
    });
    transient._session.set(SESSION_KEY, JSON.stringify({ mode: 'agora', callId: 3 }));
    load(transient, 'async function isSavedCallStillActive(', 'async function checkAgoraAutoReconnectOnRefresh(');
    await vm.runInContext('checkAgoraAutoReconnectOnRefresh', transient)();
    assert.ok(transient._session.has(SESSION_KEY), 'تبقى الجلسة عند الفشل المؤقت لإعادة المحاولة لاحقاً');

    // (د) لم يسجّل الدخول بعد → لا شيء يحدث
    const guest = createSandbox({ username: '', serverGetActiveCalls: async () => [{ id: 3 }] });
    guest._session.set(SESSION_KEY, JSON.stringify({ mode: 'agora', callId: 3 }));
    load(guest, 'async function isSavedCallStillActive(', 'async function checkAgoraAutoReconnectOnRefresh(');
    await vm.runInContext('checkAgoraAutoReconnectOnRefresh', guest)();
    assert.ok(guest._session.has(SESSION_KEY), 'لا نعيد الاتصال قبل تسجيل الدخول');
}

/* ------------------------------------------------------------------ */
/* Runner                                                             */
/* ------------------------------------------------------------------ */
const tests = [
    ['isLeadershipRank: الرتب القيادية', testIsLeadershipRank],
    ['استرجاع رتبة القيادة من members.rank (isFounderSession)', testFounderSessionUsesPersistedRank],
    ['restoreFounderStatus: تثبيت صلاحية القيادة في الجلسة', testRestoreFounderStatus],
    ['serverCreateMember: تثبيت rank دون تخفيض القيادة', testServerCreateMemberRank],
    ['isSavedCallStillActive: Supabase أولاً ثم الاحتياطي', testIsSavedCallStillActive],
    ['checkAgoraAutoReconnectOnRefresh: إعادة الاتصال بعد Refresh', testAgoraAutoReconnect]
];

(async () => {
    let failed = 0;
    for (const [name, fn] of tests) {
        try {
            await fn();
            console.log(`✅ ${name}`);
        } catch (err) {
            failed++;
            console.error(`❌ ${name}\n   ${err && err.message ? err.message : err}`);
        }
    }
    if (failed > 0) {
        console.error(`\n${failed} test(s) failed.`);
        process.exit(1);
    }
    console.log(`\nAll ${tests.length} fix-medium regression tests passed.`);
    process.exit(0);
})();

