/**
 * PHANTOM HQ — Regression test for the two critical call bugs.
 *
 * Bug 1: Direct call participants could not see/hear each other.
 *        Fix = WebRTC signaling over the Supabase Realtime channel `direct_call_{callId}`
 *        (presence broadcast + offer/answer/ICE exchange).
 *
 * Bug 2: Agora rendered "عضو 52286" instead of the real username.
 *        Fix = username passed as join metadata + identity broadcast + members lookup.
 *
 * The test loads the REAL source of the signaling module straight out of script.js
 * and runs two simulated clients against an in-memory Supabase Realtime broker.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');

/* ------------------------------------------------------------------ */
/* Extract the real implementation blocks from script.js               */
/* ------------------------------------------------------------------ */
function extractBetween(startMarker, endMarker) {
    const start = SOURCE.indexOf(startMarker);
    assert.notEqual(start, -1, `start marker not found: ${startMarker}`);
    const end = SOURCE.indexOf(endMarker, start);
    assert.notEqual(end, -1, `end marker not found: ${endMarker}`);
    return SOURCE.slice(start, end + endMarker.length);
}

const SIGNALING_BLOCK = extractBetween(
    '/* ========================================================\n   🔗 الاتصال المباشر (Direct Call) عبر WebRTC',
    'window.teardownDirectCallSignaling = teardownDirectCallSignaling;'
);

const AGORA_NAME_BLOCK = extractBetween(
    'let agoraUserNameMap = new Map();',
    'loadAgoraNameCache();'
);

const PARTICIPANTS_BLOCK = extractBetween(
    'function getCallParticipantName(user) {',
    'function ensureCallTile(grid, participant) {'
).replace(/\n\s*function ensureCallTile\(grid, participant\) \{\s*$/, '');

/* ------------------------------------------------------------------ */
/* Minimal browser / WebRTC / Supabase stubs                           */
/* ------------------------------------------------------------------ */
class MockMediaStream {
    constructor(tracks = []) { this._tracks = [...tracks]; }
    addTrack(t) { if (!this._tracks.includes(t)) this._tracks.push(t); return this; }
    removeTrack(t) { this._tracks = this._tracks.filter(x => x !== t); }
    getTracks() { return [...this._tracks]; }
    getAudioTracks() { return this._tracks.filter(t => t.kind === 'audio'); }
    getVideoTracks() { return this._tracks.filter(t => t.kind === 'video'); }
}

function makeTrack(kind, owner) {
    return { kind, id: `${owner}-${kind}`, enabled: true, readyState: 'live', stop() { this.readyState = 'ended'; } };
}

/**
 * A tiny but semantically faithful RTCPeerConnection: it keeps the real
 * signaling state machine, so the "perfect negotiation" logic in script.js
 * is genuinely exercised (including offer glare).
 */
class MockRTCPeerConnection {
    constructor() {
        this.signalingState = 'stable';
        this.localDescription = null;
        this.remoteDescription = null;
        this.connectionState = 'new';
        this.onicecandidate = null;
        this.ontrack = null;
        this.onnegotiationneeded = null;
        this.onconnectionstatechange = null;
        this._senders = [];
        this._transceivers = [];
        this._candidates = [];
        this._iceSent = false;
        this._pendingNegotiation = false;
    }
    addTrack(track, stream) {
        const sender = { track, __stream: stream };
        this._senders.push(sender);
        this._transceivers.push({});
        if (!this._pendingNegotiation) {
            this._pendingNegotiation = true;
            setTimeout(() => {
                this._pendingNegotiation = false;
                if (typeof this.onnegotiationneeded === 'function') this.onnegotiationneeded();
            }, 0);
        }
        return sender;
    }
    getSenders() { return [...this._senders]; }
    getTransceivers() { return [...this._transceivers]; }
    async setLocalDescription(desc) {
        if (desc) throw new Error('MockRTCPeerConnection only supports implicit setLocalDescription()');
        if (this.signalingState === 'stable') {
            this.localDescription = { type: 'offer', sdp: 'offer-sdp', __tracks: this._senders.map(s => s.track) };
            this.signalingState = 'have-local-offer';
        } else if (this.signalingState === 'have-remote-offer') {
            this.localDescription = { type: 'answer', sdp: 'answer-sdp', __tracks: this._senders.map(s => s.track) };
            this.signalingState = 'stable';
        } else {
            throw new Error(`cannot setLocalDescription in state ${this.signalingState}`);
        }
        this._emitIce();
        return this.localDescription;
    }
    async setRemoteDescription(desc) {
        if (!desc || !desc.type) throw new Error('invalid remote description');
        if (desc.type === 'offer') {
            this.remoteDescription = desc;
            this.signalingState = 'have-remote-offer';
        } else if (desc.type === 'answer') {
            this.remoteDescription = desc;
            this.signalingState = 'stable';
        }
        this._deliverRemoteTracks(desc);
        this._maybeConnected();
    }
    async addIceCandidate(candidate) {
        if (!this.remoteDescription) throw new Error('addIceCandidate before setRemoteDescription');
        if (!candidate) throw new Error('invalid candidate');
        this._candidates.push(candidate);
        this._maybeConnected();
    }
    _emitIce() {
        if (this._iceSent || typeof this.onicecandidate !== 'function') return;
        this._iceSent = true;
        const candidate = { candidate: 'candidate:1 1 udp 1 127.0.0.1 1 typ host' };
        this.onicecandidate({ candidate: { ...candidate, toJSON: () => candidate } });
    }
    _deliverRemoteTracks(desc) {
        (desc.__tracks || []).forEach((track) => {
            if (typeof this.ontrack === 'function') this.ontrack({ track, streams: [new MockMediaStream([track])] });
        });
    }
    _maybeConnected() {
        if (this.connectionState === 'connected') return;
        if (this.remoteDescription && this._candidates.length > 0) {
            this.connectionState = 'connected';
            if (typeof this.onconnectionstatechange === 'function') this.onconnectionstatechange();
        }
    }
    restartIce() {}
    close() { this.connectionState = 'closed'; }
}

/* ------------------------------------------------------------------ */
/* In-memory Supabase Realtime broker (broadcast + presence)           */
/* ------------------------------------------------------------------ */
function createBroker() {
    const rooms = new Map(); // name -> { stubs: Set, presence: Map }

    function room(name) {
        if (!rooms.has(name)) rooms.set(name, { stubs: new Set(), presence: new Map() });
        return rooms.get(name);
    }

    function emitPresence(roomObj, event, presences) {
        roomObj.stubs.forEach((stub) => {
            stub._handlers
                .filter(h => h.type === 'presence' && h.filter && h.filter.event === event)
                .forEach(h => {
                    if (event === 'join') h.cb({ newPresences: presences });
                    else if (event === 'leave') h.cb({ leftPresences: presences });
                });
            stub._handlers
                .filter(h => h.type === 'presence' && h.filter && h.filter.event === 'sync')
                .forEach(h => h.cb({}));
        });
    }

    function channelStub(name) {
        const r = room(name);
        const handlers = [];
        const self = {
            name,
            _handlers: handlers,
            on(type, filter, cb) { handlers.push({ type, filter, cb }); return self; },
            subscribe(cb) {
                if (cb) setTimeout(() => cb('SUBSCRIBED'), 0);
                return self;
            },
            unsubscribe() { r.stubs.delete(self); return self; },
            async track(payload) {
                r.presence.set(payload.userId, payload);
                emitPresence(r, 'join', [payload]);
                return 'ok';
            },
            async untrack() {
                const gone = [...r.presence.values()].filter(p => p.userId === self._lastTracked);
                r.presence.delete(self._lastTracked);
                if (gone.length) emitPresence(r, 'leave', gone);
                return 'ok';
            },
            presenceState() {
                const state = {};
                r.presence.forEach((p, key) => { state[key] = [p]; });
                return state;
            },
            send(message) {
                if (message && message.type === 'broadcast') {
                    r.stubs.forEach((other) => {
                        if (other === self) return; // broadcast self:false
                        other._handlers
                            .filter(h => h.type === 'broadcast' && h.filter && h.filter.event === message.event)
                            .forEach(h => h.cb({ event: message.event, payload: message.payload }));
                    });
                }
            }
        };
        // remember our own presence key so untrack() removes the right entry
        const originalTrack = self.track;
        self.track = async function (payload) { self._lastTracked = payload.userId; return originalTrack.call(self, payload); };
        r.stubs.add(self);
        return self;
    }

    return {
        client: {
            channel(name) { return channelStub(name); },
            removeChannel() {}
        },
        rooms
    };
}



/* ------------------------------------------------------------------ */
/* One simulated browser tab running the real signaling module         */
/* ------------------------------------------------------------------ */
function createClient({ id, username, supabase, audioTrack, videoTrack }) {
    const uiCalls = [];
    const sandbox = {
        console: { log() {}, warn() {}, error() {} },
        setTimeout,
        clearTimeout,
        Map,
        Set,
        Array,
        MediaStream: MockMediaStream,
        RTCPeerConnection: MockRTCPeerConnection,
        TextDecoder,
        ensureSupabaseClient: () => supabase,
        getCurrentUserId: () => id,
        getCurrentUsername: () => username,
        updateFullCallParticipantsUI: () => { uiCalls.push(Date.now()); },
        getElementById: () => null,
        document: { getElementById: () => null },
        inAppMediaStream: new MockMediaStream([audioTrack, videoTrack]),
        activeCallMode: 'direct',
        isInAppMicMuted: false,
        isInAppCamOff: false,
        isAgoraMicMuted: false,
        agoraRemoteUsers: new Map(),
        sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    const context = vm.createContext(sandbox);
    vm.runInContext(`${SIGNALING_BLOCK}\n${AGORA_NAME_BLOCK}\n${PARTICIPANTS_BLOCK}`, context, { filename: 'script.js#extracted' });

    return {
        id,
        username,
        uiCalls,
        call: (code) => vm.runInContext(code, context),
        state: () => vm.runInContext('directCallPeers', context),
        participants: () => vm.runInContext('collectCallParticipants()', context),
        signalingId: () => vm.runInContext('directCallSignalingId', context)
    };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ------------------------------------------------------------------ */
/* TEST 1 — two users on the same direct call discover each other      */
/* ------------------------------------------------------------------ */
async function testDirectCallTwoParticipants() {
    const broker = createBroker();
    const alice = createClient({
        id: 'user_alice',
        username: 'Alice',
        supabase: broker.client,
        audioTrack: makeTrack('audio', 'alice'),
        videoTrack: makeTrack('video', 'alice')
    });
    const bob = createClient({
        id: 'user_bob',
        username: 'Bob',
        supabase: broker.client,
        audioTrack: makeTrack('audio', 'bob'),
        videoTrack: makeTrack('video', 'bob')
    });

    const started = await Promise.all([
        alice.call("initDirectCallSignaling('call_42', 'Alice', true)"),
        bob.call("initDirectCallSignaling('call_42', 'Bob', false)")
    ]);
    assert.deepEqual(started, [true, true], 'both clients must subscribe to the signaling channel');

    await sleep(1500);

    // Both clients must use the same channel name: direct_call_{callId}
    assert.equal(alice.signalingId(), 'call_42');
    assert.equal(bob.signalingId(), 'call_42');
    assert.ok(broker.rooms.has('direct_call_call_42'), 'signaling channel direct_call_{callId} must exist');

    // Each side must see exactly one remote participant
    assert.equal(alice.state().size, 1, 'Alice must see 1 remote participant');
    assert.equal(bob.state().size, 1, 'Bob must see 1 remote participant');

    // ...with the real names, not placeholders
    const alicePeer = [...alice.state().values()][0];
    const bobPeer = [...bob.state().values()][0];
    assert.equal(alicePeer.name, 'Bob', "Alice must resolve Bob's name from presence");
    assert.equal(bobPeer.name, 'Alice', "Bob must resolve Alice's name from presence");

    // WebRTC handshake completed on both sides
    assert.equal(alicePeer.pc.connectionState, 'connected', 'Alice -> Bob peer connection must connect');
    assert.equal(bobPeer.pc.connectionState, 'connected', 'Bob -> Alice peer connection must connect');

    // Remote media actually arrived (audio + video from the other side)
    assert.equal(alicePeer.stream.getAudioTracks().length, 1, "Alice must receive Bob's audio");
    assert.equal(alicePeer.stream.getVideoTracks().length, 1, "Alice must receive Bob's video");
    assert.equal(bobPeer.stream.getAudioTracks().length, 1, "Bob must receive Alice's audio");
    assert.equal(bobPeer.stream.getVideoTracks().length, 1, "Bob must receive Alice's video");

    // ICE candidates were exchanged both ways
    assert.ok(alicePeer.pc._candidates.length >= 1, "Alice must have applied Bob's ICE candidate");
    assert.ok(bobPeer.pc._candidates.length >= 1, "Bob must have applied Alice's ICE candidate");

    // Participant list = me + the remote peer (this is the reported bug)
    const aliceList = alice.participants();
    assert.equal(aliceList.length, 2, "Alice's call grid must contain 2 participants");
    assert.deepEqual([...aliceList].map(p => p.name), ['Alice', 'Bob']);
    assert.equal([...aliceList].filter(p => p.isMe).length, 1);

    // UI was refreshed so the tiles render
    assert.ok(alice.uiCalls.length > 0, 'participants UI must be refreshed');
    assert.ok(bob.uiCalls.length > 0, 'participants UI must be refreshed');

    return { alice, bob };
}


/* ------------------------------------------------------------------ */
/* TEST 2 — a late joiner is added to the participant list of everyone */
/* ------------------------------------------------------------------ */
async function testLateJoinerAndLeave() {
    const broker = createBroker();
    const mk = (id, username) => createClient({
        id, username, supabase: broker.client,
        audioTrack: makeTrack('audio', id), videoTrack: makeTrack('video', id)
    });
    const alice = mk('user_alice', 'Alice');
    const bob = mk('user_bob', 'Bob');
    const carol = mk('user_carol', 'Carol');

    await Promise.all([
        alice.call("initDirectCallSignaling('call_7', 'Alice', true)"),
        bob.call("initDirectCallSignaling('call_7', 'Bob', false)")
    ]);
    await sleep(1200);
    assert.equal(alice.state().size, 1);
    assert.equal(bob.state().size, 1);

    // Carol joins the same call later
    await carol.call("initDirectCallSignaling('call_7', 'Carol', false)");
    await sleep(1500);

    assert.equal(alice.state().size, 2, 'Alice must see Bob and Carol');
    assert.equal(bob.state().size, 2, 'Bob must see Alice and Carol');
    assert.equal(carol.state().size, 2, 'Carol must see Alice and Bob');

    const names = [...carol.state().values()].map(p => p.name).sort();
    assert.deepEqual(names, ['Alice', 'Bob'], 'Carol must resolve both names');
    assert.equal(carol.participants().length, 3, 'Carol must have 3 tiles in the call grid');

    // Bob hangs up -> everyone drops him from the list
    await bob.call('teardownDirectCallSignaling(true)');
    await sleep(300);

    assert.equal(alice.state().size, 1, 'Alice must drop Bob after he leaves');
    assert.equal(carol.state().size, 1, 'Carol must drop Bob after he leaves');
    assert.equal(alice.state().has('user_bob'), false, 'Bob must be removed from Alice\'s peer map');
    assert.equal([...alice.state().values()][0].name, 'Carol', 'Carol must remain in Alice\'s list');
    assert.equal(alice.participants().length, 2, 'Alice must be back to 2 tiles');
}

/* ------------------------------------------------------------------ */
/* TEST 3 — Bug 2: Agora participants are shown by real username       */
/* ------------------------------------------------------------------ */
function testAgoraParticipantNames() {
    const broker = createBroker();
    const client = createClient({
        id: 'user_me', username: 'Me', supabase: broker.client,
        audioTrack: makeTrack('audio', 'me'), videoTrack: makeTrack('video', 'me')
    });

    // Name resolved from the map that join-metadata / broadcasts populate
    client.call("agoraUserNameMap.set('52286', 'ΔPH 5oMoD')");
    const remoteUser = { uid: 52286, hasAudio: true, hasVideo: false };
    client.call(`var __remote = ${JSON.stringify(remoteUser)}`);
    const resolved = client.call('getCallParticipantName(__remote)');
    assert.equal(resolved, 'ΔPH 5oMoD', 'Agora participant must show the real username, not "عضو 52286"');
    assert.ok(!resolved.includes('عضو '), 'placeholder name must not be used when a real name is known');

    // Without any mapping, the placeholder is still the fallback (no crash)
    const fallback = client.call("getCallParticipantName({ uid: 99999 })");
    assert.equal(fallback, 'عضو 99999');

    // rememberAgoraUserName rejects placeholder names coming from the wire
    assert.equal(client.call("rememberAgoraUserName(1, 'عضو 12345')"), false);
    assert.equal(client.call("rememberAgoraUserName(2, 'RealName')"), true);
    assert.equal(client.call("agoraUserNameMap.get('2')"), 'RealName');
}

/* ------------------------------------------------------------------ */
/* Runner                                                             */
/* ------------------------------------------------------------------ */
const tests = [
    ['Bug 1 — direct call: two devices see & hear each other', testDirectCallTwoParticipants],
    ['Bug 1 — direct call: late joiner + leave handling', testLateJoinerAndLeave],
    ['Bug 2 — Agora: real usernames instead of "عضو <uid>"', testAgoraParticipantNames]
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
    console.log(`\nAll ${tests.length} call-bug regression tests passed.`);
    process.exit(0);
})();

