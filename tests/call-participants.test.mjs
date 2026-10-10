/**
 * PHANTOM HQ — regression tests for the call system.
 *
 * Covers the two reported call bugs after the move to the Supabase
 * `call_participants` table:
 *
 *   Bug 1 — Direct calls showed only yourself / nobody else.
 *           Presence is now tracked in `call_participants` (insert on join,
 *           delete on leave) and rendered from a Realtime subscription
 *           filtered by call_id.
 *
 *   Bug 2 — Agora rendered "عضو 52286" instead of the real username.
 *           Names are now resolved from `call_participants` (uid ➜ username)
 *           instead of Agora metadata.
 *
 * The real implementation is extracted straight out of script.js and run in
 * a node:vm sandbox against an in-memory fake Supabase client.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');

function extractBetween(startMarker, endMarker) {
    const start = SOURCE.indexOf(startMarker);
    assert.notEqual(start, -1, `start marker not found: ${startMarker}`);
    const end = SOURCE.indexOf(endMarker, start);
    assert.notEqual(end, -1, `end marker not found: ${endMarker}`);
    return SOURCE.slice(start, end + endMarker.length);
}

/* uid ➜ username map (populated from call_participants) */
const AGORA_NAME_BLOCK = extractBetween(
    'let agoraUserNameMap = new Map();',
    'loadAgoraNameCache();'
);

/* the call_participants data layer */
const CALL_PARTICIPANTS_BLOCK = extractBetween(
    '/* ========================================================\n   📋 call_participants',
    'window.refreshCallParticipants = refreshCallParticipants;'
);

/* participant list rendering + name resolution */
const PARTICIPANTS_BLOCK = extractBetween(
    'function getCallParticipantName(user) {',
    'function ensureCallTile(grid, participant) {'
).replace(/\n\s*function ensureCallTile\(grid, participant\) \{\s*$/, '');

/* ------------------------------------------------------------------ */
/* In-memory fake of the Supabase client (table + realtime)           */
/* ------------------------------------------------------------------ */
function createFakeSupabase() {
    const tables = { members: [], call_participants: [] };
    const channels = [];
    let nextId = 1;

    function emitTableChange(table, eventType, row) {
        channels.forEach((ch) => {
            (ch._handlers || [])
                .filter(h => h.type === 'postgres_changes' && h.filter && h.filter.table === table)
                .forEach(h => h.cb({ eventType, table, new: row, old: row }));
        });
    }

    class Query {
        constructor(table) {
            this.table = table;
            this.mode = 'select';
            this.filters = [];
            this.payload = null;
            this._limit = null;
        }
        select() { this.mode = 'select'; return this; }
        insert(rows) { this.mode = 'insert'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
        delete() { this.mode = 'delete'; return this; }
        update() { this.mode = 'update'; return this; }
        eq(column, value) { this.filters.push([column, value]); return this; }
        order() { return this; }
        limit(n) { this._limit = n; return this; }
        _matches(row) {
            return this.filters.every(([column, value]) => String(row[column]) === String(value));
        }
        _run() {
            const store = tables[this.table] || (tables[this.table] = []);
            if (this.mode === 'insert') {
                const inserted = this.payload.map((row) => {
                    const copy = { id: nextId++, joined_at: new Date().toISOString(), ...row };
                    store.push(copy);
                    return copy;
                });
                inserted.forEach(row => emitTableChange(this.table, 'INSERT', row));
                return { data: inserted, error: null };
            }
            if (this.mode === 'delete') {
                const removed = store.filter(row => this._matches(row));
                removed.forEach((row) => {
                    const index = store.indexOf(row);
                    if (index >= 0) store.splice(index, 1);
                    emitTableChange(this.table, 'DELETE', row);
                });
                return { data: removed, error: null };
            }
            let data = store.filter(row => this._matches(row));
            if (this._limit != null) data = data.slice(0, this._limit);
            return { data: data.map(row => ({ ...row })), error: null };
        }
        then(resolve, reject) {
            try { resolve(this._run()); } catch (err) { if (reject) reject(err); }
        }
    }

    const client = {
        from(table) { return new Query(table); },
        channel(name) {
            const handlers = [];
            const ch = {
                name,
                _handlers: handlers,
                on(type, filter, cb) { handlers.push({ type, filter, cb }); return ch; },
                subscribe(cb) { if (cb) setTimeout(() => cb('SUBSCRIBED'), 0); return ch; },
                unsubscribe() { const i = channels.indexOf(ch); if (i >= 0) channels.splice(i, 1); return ch; }
            };
            channels.push(ch);
            return ch;
        },
        removeChannel(ch) { const i = channels.indexOf(ch); if (i >= 0) channels.splice(i, 1); }
    };

    return { client, tables, channels };
}

/* ------------------------------------------------------------------ */
/* One simulated browser tab running the real implementation           */
/* ------------------------------------------------------------------ */
function createClient({ id, username, supabase, uid }) {
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout,
        clearTimeout,
        Map,
        Set,
        Array,
        JSON,
        ensureSupabaseClient: () => supabase,
        getCurrentUserId: () => id,
        getCurrentUsername: () => username,
        updateFullCallParticipantsUI: () => {},
        updateCallParticipantsUI: () => {},
        getElementById: () => null,
        document: { getElementById: () => null },
        sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
        activeCallMode: 'direct',
        isAgoraMicMuted: false,
        isInAppMicMuted: false,
        isAgoraCamOff: false,
        agoraLocalVideoTrack: { play() {} },
        agoraRemoteUsers: new Map()
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    const context = vm.createContext(sandbox);
    vm.runInContext(
        `${AGORA_NAME_BLOCK}\n${CALL_PARTICIPANTS_BLOCK}\n${PARTICIPANTS_BLOCK}`,
        context,
        { filename: 'script.js#extracted' }
    );

    return {
        id,
        username,
        uid,
        call: (code) => vm.runInContext(code, context),
        rows: () => vm.runInContext('callParticipantsRows', context),
        participants: () => vm.runInContext('collectCallParticipants()', context),
        join: (callId, uidValue, name) => vm.runInContext(`callParticipantsJoin(${callId}, ${uidValue}, ${JSON.stringify(name)})`, context),
        leave: () => vm.runInContext('callParticipantsLeave()', context)
    };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* TEST 1 — call_id must be a valid bigint before touching the table   */
/* ------------------------------------------------------------------ */
function testNumericCallId() {
    const fake = createFakeSupabase();
    const client = createClient({ id: 'user_a', username: 'Alice', supabase: fake.client, uid: 11111 });

    assert.equal(client.call('toNumericCallId(42)'), 42);
    assert.equal(client.call("toNumericCallId('42')"), 42);
    assert.equal(client.call('toNumericCallId(null)'), null);
    assert.equal(client.call("toNumericCallId('call_agora_123')"), null, 'المعرّفات المؤقتة ليست صالحة لعمود bigint');
    assert.equal(client.call("toNumericCallId('')"), null);
}


/* ------------------------------------------------------------------ */
/* TEST 2 — Bug 1: participants are tracked in call_participants       */
/* ------------------------------------------------------------------ */
async function testParticipantsTable() {
    const fake = createFakeSupabase();
    const alice = createClient({ id: 'user_alice', username: 'Alice', supabase: fake.client, uid: 11111 });
    const bob = createClient({ id: 'user_bob', username: 'Bob', supabase: fake.client, uid: 22222 });

    await alice.join(7, 11111, 'Alice');
    await bob.join(7, 22222, 'Bob');
    await sleep(50);

    // A row per participant, in the shared table
    assert.equal(fake.tables.call_participants.length, 2, 'يجب إدراج صف لكل مشارك');
    const stored = fake.tables.call_participants.map(r => `${r.call_id}:${r.user_id}:${r.username}`).sort();
    assert.deepEqual(stored, ['7:11111:Alice', '7:22222:Bob']);

    // The Realtime subscription is filtered by call_id
    const ch = fake.channels.find(c => String(c.name).includes('call_participants'));
    assert.ok(ch, 'يجب فتح قناة Realtime للجدول');
    assert.equal(ch.name, 'call_participants_7');
    assert.equal(ch._handlers[0].filter.table, 'call_participants');
    assert.equal(ch._handlers[0].filter.filter, 'call_id=eq.7');

    // Both sides see each other in the participant list (this was the bug)
    const aliceList = [...alice.participants()];
    const bobList = [...bob.participants()];
    assert.equal(aliceList.length, 2, 'قائمة Alice يجب أن تحتوي مشاركين');
    assert.equal(bobList.length, 2, 'قائمة Bob يجب أن تحتوي مشاركين');
    assert.deepEqual(aliceList.map(p => p.name).sort(), ['Alice', 'Bob']);
    assert.deepEqual(bobList.map(p => p.name).sort(), ['Alice', 'Bob']);
    assert.equal(aliceList.filter(p => p.isMe).length, 1);

    // Realtime INSERT from another client shows up without a manual refresh
    const carol = createClient({ id: 'user_carol', username: 'Carol', supabase: fake.client, uid: 33333 });
    await carol.join(7, 33333, 'Carol');
    await sleep(400); // debounce is 250ms
    assert.equal(alice.rows().length, 3, 'Alice يجب أن تستقبل العضو الجديد عبر Realtime');
    assert.deepEqual([...alice.participants()].map(p => p.name).sort(), ['Alice', 'Bob', 'Carol']);
}

/* ------------------------------------------------------------------ */
/* TEST 3 — Bug 1: leaving removes the participant for everyone        */
/* ------------------------------------------------------------------ */
async function testLeave() {
    const fake = createFakeSupabase();
    const alice = createClient({ id: 'user_alice', username: 'Alice', supabase: fake.client, uid: 11111 });
    const bob = createClient({ id: 'user_bob', username: 'Bob', supabase: fake.client, uid: 22222 });

    await alice.join(9, 11111, 'Alice');
    await bob.join(9, 22222, 'Bob');
    await sleep(50);
    assert.equal(alice.rows().length, 2);

    await bob.leave();
    await sleep(400);

    assert.equal(fake.tables.call_participants.length, 1, 'صف Bob يجب أن يُحذف');
    assert.equal(fake.tables.call_participants[0].username, 'Alice');
    assert.equal(alice.rows().length, 1, 'Alice يجب أن ترى مغادرة Bob');
    assert.deepEqual([...alice.participants()].map(p => p.name), ['Alice']);

    // The realtime channel is closed on leave
    assert.equal(bob.call('callParticipantsRealtime'), null);
}


/* ------------------------------------------------------------------ */
/* TEST 4 — Bug 2: names come from the table, never "عضو <uid>"        */
/* ------------------------------------------------------------------ */
async function testAgoraNamesFromTable() {
    const fake = createFakeSupabase();
    const me = createClient({ id: 'user_me', username: 'Me', supabase: fake.client, uid: 10000 });
    const them = createClient({ id: 'user_them', username: 'ΔPH 5oMoD', supabase: fake.client, uid: 52286 });

    await me.join(11, 10000, 'Me');
    await them.join(11, 52286, 'ΔPH 5oMoD');
    await sleep(50);

    const resolved = me.call('getCallParticipantNameByUid(52286)');
    assert.equal(resolved, 'ΔPH 5oMoD', 'الاسم يجب أن يأتي من جدول call_participants');

    const remoteUser = { uid: 52286, hasAudio: true, hasVideo: false };
    me.call(`var __remote = ${JSON.stringify(remoteUser)}`);
    const label = me.call('getCallParticipantName(__remote)');
    assert.equal(label, 'ΔPH 5oMoD');
    assert.ok(!label.includes('عضو '), 'لا يجب عرض "عضو <uid>" عندما يكون الاسم معروفاً');

    // Unknown uid still falls back safely
    assert.equal(me.call('getCallParticipantName({ uid: 99999 })'), 'عضو 99999');

    // No Agora-metadata helpers are used any more
    assert.equal(SOURCE.includes('parseAgoraMetadata'), false, 'يجب إزالة الاعتماد على Agora Metadata');
    assert.equal(SOURCE.includes('sendStreamMessage'), false, 'يجب إزالة بث الهوية عبر Agora Stream Message');
}

/* ------------------------------------------------------------------ */
/* TEST 5 — duplicate joins do not duplicate rows                      */
/* ------------------------------------------------------------------ */
async function testNoDuplicateRows() {
    const fake = createFakeSupabase();
    const alice = createClient({ id: 'user_alice', username: 'Alice', supabase: fake.client, uid: 11111 });

    await alice.join(13, 11111, 'Alice');
    await alice.join(13, 11111, 'Alice');
    await sleep(50);

    assert.equal(fake.tables.call_participants.length, 1, 'لا يجب تكرار صف العضو نفسه');
    assert.equal([...alice.participants()].length, 1);
}

/* ------------------------------------------------------------------ */
/* TEST 6 — Direct calls now run on Agora with video enabled           */
/* ------------------------------------------------------------------ */
function testDirectCallUsesAgoraVideo() {
    assert.equal(/directCallPeers|initDirectCallSignaling|RTCPeerConnection/.test(SOURCE), false,
        'يجب إزالة منطق WebRTC من المكالمة المباشرة');

    assert.ok(SOURCE.includes('channel: `direct_call_${numericCallId}`'), 'قناة Agora خاصة بكل مكالمة مباشرة');
    assert.ok(SOURCE.includes("mode: 'direct'"), 'وضع المكالمة المباشرة يجب أن يمرّ إلى joinRtcRoom');
    assert.ok(SOURCE.includes("const withVideo = (mode === 'direct')"), 'الفيديو مُفعّل للمكالمات المباشرة');
    assert.ok(SOURCE.includes('obtainAgoraVideoTrack'), 'يجب نشر مسار فيديو Agora');
}

/* ------------------------------------------------------------------ */
/* Runner                                                             */
/* ------------------------------------------------------------------ */
const tests = [
    ['call_id صالح (bigint) قبل الكتابة في الجدول', testNumericCallId],
    ['Bug 1 — call_participants: تسجيل المشاركين + Realtime + العرض', testParticipantsTable],
    ['Bug 1 — call_participants: المغادرة تحذف الصف للجميع', testLeave],
    ['Bug 2 — الأسماء من الجدول وليست Agora Metadata', testAgoraNamesFromTable],
    ['لا تكرار لصف العضو عند إعادة الانضمام', testNoDuplicateRows],
    ['المكالمة المباشرة تعمل على Agora مع الفيديو', testDirectCallUsesAgoraVideo]
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
    console.log(`\nAll ${tests.length} call regression tests passed.`);
    process.exit(0);
})();

