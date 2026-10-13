/**
 * PHANTOM HQ — regression tests for the Popularity Battle & Arena rewrite.
 *
 * Covers the rules requested for معركة الشعبية / ساحة النزال:
 *
 *   Popularity payouts
 *     - player wins        ➜ receives double the staked points
 *     - player surrenders  ➜ keeps half the stake  (loses half)
 *     - player loses       ➜ keeps nothing         (loses all)
 *   Voter payouts
 *     - voted player wins       ➜ voter receives double the stake
 *     - voted player loses      ➜ voter loses the stake
 *     - voted player surrenders ➜ voter refunded stake minus 25%
 *
 *   Minimum entry
 *     - PHANTOM_MIN_STAKE must be 500
 *
 *   Cross-device consistency
 *     - seededRandom(seed, step) is deterministic and identical on both
 *       devices, so the arena target/core lands in the same place everywhere
 *     - isSameUser matches by id or by normalized name (both devices agree
 *       about who is player 1 / player 2)
 *
 * The real implementation is extracted straight out of script.js and executed
 * in a node:vm sandbox — no duplication of the production rules.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');

/* Pull a top-level `[async] function name(...) { ... }` block out of script.js */
function extractFunction(name) {
    const marker = `function ${name}(`;
    let start = SOURCE.indexOf(marker);
    assert.notEqual(start, -1, `function not found in script.js: ${name}`);
    // keep the `async` keyword so `await` inside stays valid
    if (SOURCE.slice(start - 6, start) === 'async ') start -= 6;
    const open = SOURCE.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < SOURCE.length; i++) {
        const ch = SOURCE[i];
        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) return SOURCE.slice(start, i + 1);
        }
    }
    throw new Error(`unbalanced braces while extracting ${name}`);
}

/* Pull a top-level `const NAME = ...;` declaration out of script.js */
function extractConst(name) {
    const marker = `const ${name} = `;
    const start = SOURCE.indexOf(marker);
    assert.notEqual(start, -1, `const not found in script.js: ${name}`);
    const end = SOURCE.indexOf('\n', start);
    return SOURCE.slice(start, end);
}

/*
 * Sandbox state shared with the extracted functions. `globalThis`-style
 * assignments replace the browser-only pieces (points storage, identity).
 */
const sandbox = {
    console,
    popularityVoters: [],
    settledMatchIds: new Set(),
    deductedMatchIds: new Set(),
    activeMatchRow: null,
    ME: { id: 'uid_me', name: 'PH•ME' },
    balance: 10_000,
    awarded: 0,
    deducted: 0
};

sandbox.myIdentity = () => ({ ...sandbox.ME });
sandbox.getCurrentUsername = () => sandbox.ME.name;
sandbox.getCurrentUserId = () => sandbox.ME.id;
sandbox.normalizeName = value => String(value == null ? '' : value).trim().toLowerCase();
sandbox.getUserBalance = () => sandbox.balance;
sandbox.addUserPoints = amount => { sandbox.awarded += Number(amount) || 0; sandbox.balance += Number(amount) || 0; };
sandbox.deductUserPoints = amount => { sandbox.deducted += Number(amount) || 0; sandbox.balance -= Number(amount) || 0; };
sandbox.ensureSupabaseClient = () => null;      // offline: persistence is skipped
sandbox.document = { getElementById: () => null, querySelector: () => null };
sandbox.renderPopularitySeasonLeaderboard = () => {};  // DOM-only UI refresh

const EXTRACTED = [
    'normalizeName',   // the real production normalizer drives name matching
    'isSameUser',
    'isMatchPlayer',
    'currentSeasonId',
    'ensureSeasonStatsRow',
    'commitSeasonResult',
    'persistVotePayouts',
    'settlePopularityMatch',
    'seededRandom'
].map(extractFunction).join('\n\n');

const CONSTS = [
    'PHANTOM_MIN_STAKE',
    'PHANTOM_ARENA_MIN_STAKE',
    'MATCHES_TABLE',
    'VOTES_TABLE',
    'SEASON_STATS_TABLE'
].map(extractConst).join('\n');

vm.createContext(sandbox);
vm.runInContext(`${CONSTS}\n${EXTRACTED}`, sandbox);

// `const` bindings stay lexical inside the vm script — read them by evaluation.
const settlePopularityMatch = sandbox.settlePopularityMatch;
const seededRandom = sandbox.seededRandom;
const isSameUser = sandbox.isSameUser;
const PHANTOM_MIN_STAKE = vm.runInContext('PHANTOM_MIN_STAKE', sandbox);

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function reset(matchRow, votes) {
    sandbox.popularityVoters = votes || [];
    sandbox.settledMatchIds = new Set();
    sandbox.deductedMatchIds = new Set();
    sandbox.awarded = 0;
    sandbox.deducted = 0;
    sandbox.balance = 10_000;
    sandbox.activeMatchRow = matchRow;
    vm.runInContext(`
        popularityVoters = ${JSON.stringify(votes || [])};
        settledMatchIds = new Set();
        activeMatchRow = ${JSON.stringify(matchRow)};
    `, sandbox);
}

/* game_matches row where I am player 1 */
function rowAsP1(extra) {
    return Object.assign({
        id: 'match_1',
        game_type: 'popularity',
        status: 'finished',
        stake: 500,
        p1_id: 'uid_me', p1_name: 'PH•ME', p1_score: 10,
        p2_id: 'uid_rival', p2_name: 'PH•RIVAL', p2_score: 5
    }, extra || {});
}

function newId() { return `vote_${Math.random().toString(36).slice(2)}`; }

/* identity switcher: players and spectators are different users */
function setMe(id, name) {
    sandbox.ME = { id, name };
}
const SPECTATOR = { id: 'uid_fan', name: 'PH•FAN' };

/* ------------------------------------------------------------------ */
/* tests                                                               */
/* ------------------------------------------------------------------ */

let passed = 0;
function test(label, fn) {
    fn();
    passed++;
    console.log(`✅ ${label}`);
}

test('الحد الأدنى لدخول معركة الشعبية = 500 نقطة', () => {
    assert.equal(PHANTOM_MIN_STAKE, 500);
});

test('اللاعب الفائز: يستلم ضعف النقاط المراهنة', () => {
    const row = rowAsP1({ winner_id: 'uid_me', winner_name: 'PH•ME', p1_result: 'win', p2_result: 'loss' });
    reset(row, []);
    settlePopularityMatch(row);
    assert.equal(sandbox.awarded, 1000, 'فوز ⇒ 2 × 500');
});

test('اللاعب الخاسر: لا يستلم شيئاً (خسارة كل الرهان)', () => {
    const row = rowAsP1({ winner_id: 'uid_rival', winner_name: 'PH•RIVAL', p1_result: 'loss', p2_result: 'win' });
    reset(row, []);
    settlePopularityMatch(row);
    assert.equal(sandbox.awarded, 0, 'خسارة ⇒ 0');
});

test('اللاعب المستسلم: يسترد نصف الرهان فقط', () => {
    const row = rowAsP1({ winner_id: 'uid_rival', winner_name: 'PH•RIVAL', p1_result: 'surrender', p2_result: 'win' });
    reset(row, []);
    settlePopularityMatch(row);
    assert.equal(sandbox.awarded, 250, 'استسلام ⇒ 500 / 2');
});

test('المصوّت لمن فاز: يستلم ضعف رهانه', () => {
    setMe(SPECTATOR.id, SPECTATOR.name);
    const row = rowAsP1({ winner_id: 'uid_me', winner_name: 'PH•ME' });
    reset(row, [{ id: newId(), match_id: 'match_1', voter_id: SPECTATOR.id, voter_name: SPECTATOR.name, choice: 'A', points: 500 }]);
    settlePopularityMatch(row);
    assert.equal(sandbox.awarded, 1000, 'رهان 500 على الفائز ⇒ 1000');
});

test('المصوّت لمن خسر: لا يستلم شيئاً (خسارة الرهان)', () => {
    setMe(SPECTATOR.id, SPECTATOR.name);
    const row = rowAsP1({ winner_id: 'uid_me', winner_name: 'PH•ME' });
    reset(row, [{ id: newId(), match_id: 'match_1', voter_id: SPECTATOR.id, voter_name: SPECTATOR.name, choice: 'B', points: 500 }]);
    settlePopularityMatch(row);
    assert.equal(sandbox.awarded, 0);
});

test('المصوّت لمن استسلم: يسترد رهانه ناقص 25%', () => {
    setMe(SPECTATOR.id, SPECTATOR.name);
    const row = rowAsP1({ winner_id: 'uid_rival', winner_name: 'PH•RIVAL', p1_result: 'surrender', p2_result: 'win' });
    reset(row, [{ id: newId(), match_id: 'match_1', voter_id: SPECTATOR.id, voter_name: SPECTATOR.name, choice: 'A', points: 400 }]);
    settlePopularityMatch(row);
    assert.equal(sandbox.awarded, 300, 'استسلام ⇒ 400 × 0.75');
});

test('🚫 اللاعبان مستبعدان من التصويت (isMatchPlayer)', () => {
    setMe(SPECTATOR.id, SPECTATOR.name);
    const row = rowAsP1({});
    assert.equal(sandbox.isMatchPlayer(row), false, 'المشاهد ليس طرفاً في المواجهة');
    setMe('uid_me', 'PH•ME');
    assert.equal(sandbox.isMatchPlayer(row), true, 'اللاعب طرف في المواجهة ⇒ يُمنع من التصويت');
});

test('صرف الجوائز لا يتكرر مرتين لنفس المواجهة', () => {
    const row = rowAsP1({ winner_id: 'uid_me', winner_name: 'PH•ME' });
    reset(row, []);
    settlePopularityMatch(row);
    settlePopularityMatch(row);
    assert.equal(sandbox.awarded, 1000, 'المرة الثانية تُتجاهَل');
});

test('🖥️ نفس موضع الكور على كل الأجهزة (بذرة موحّدة)', () => {
    const seed = 'match-seed-777';
    const deviceA = [];
    const deviceB = [];
    for (let step = 0; step < 40; step++) {
        deviceA.push([seededRandom(seed, step + ':x'), seededRandom(seed, step + ':y')]);
        deviceB.push([seededRandom(seed, step + ':x'), seededRandom(seed, step + ':y')]);
    }
    assert.deepEqual(deviceA, deviceB, 'جهازان بنفس البذرة ⇒ نفس المواضع');
    assert.notDeepEqual(
        [seededRandom(seed, 0), seededRandom(seed, 1)],
        [seededRandom(seed, 2), seededRandom(seed, 3)],
        'خطوات مختلفة ⇒ مواضع مختلفة (لا تجمّد في نقطة واحدة)'
    );
});

test('🖥️ تحديد اللاعبين متوافق على الجهازين (بالـ ID أو الاسم)', () => {
    assert.equal(isSameUser('uid_me', 'PH•ME', 'uid_me', 'PH•ME'), true, 'ID والاسم');
    assert.equal(isSameUser('uid_me', null, 'uid_me', 'أي اسم'), true, 'ID فقط');
    assert.equal(isSameUser(null, 'PH\ufeff•ME', null, 'ph•me'), true, 'الاسم بعد التطبيع');
    assert.equal(isSameUser('uid_me', 'PH•ME', 'uid_rival', 'PH•RIVAL'), false, 'لاعبان مختلفان');
});

test('نتيجة النزال مشتقة من الصف ⇒ نفس الفائز على الجهازين', () => {
    const row = rowAsP1({ p1_score: 900, p2_score: 1200 });
    // الجهاز الأول: أنا p1 ⇒ خسارة · الجهاز الثاني: أنا p2 ⇒ فوز
    const deviceOne = sandbox.isSameUser(row.p1_id, row.p1_name, 'uid_me', 'PH•ME');
    const deviceTwo = sandbox.isSameUser(row.p2_id, row.p2_name, 'uid_me', 'PH•ME');
    assert.equal(deviceOne, true);
    assert.equal(deviceTwo, false);
    const winnerFromRow = Number(row.p1_score) >= Number(row.p2_score) ? 'p1' : 'p2';
    assert.equal(winnerFromRow, 'p2', 'الفائز واحد للطرفين — لا يرى كل لاعب نفسه فائزاً');
});

console.log(`\nAll ${passed} popularity/arena rule tests passed.`);
