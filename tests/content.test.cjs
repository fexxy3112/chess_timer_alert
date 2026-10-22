const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ChessAlert = require('../core.js');
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
function harness(initial = {}, failPlay = false) {
    let settings = ChessAlert.normalizeSettings(initial), change, message, interval, observer;
    let game = { key: 'game-1', active: true, running: true, seconds: 5, state: 'ready', message: 'Clock ready' };
    let plays = 0, pauses = 0, failLoad = false;
    const api = { runtime: { getURL: p => p, onMessage: { addListener: fn => message = fn } },
        storage: { onChanged: { addListener: fn => change = fn } } };
    class Audio {
        play() { plays++; return failPlay ? Promise.reject(new Error('blocked')) : Promise.resolve(); }
        pause() { pauses++; }
        set src(_) { this.onemptied?.(); }
    }
    const context = vm.createContext({ ChessAlert, ChessAlertStorage: { api, KEY: 'chessAlertSettings',
        load: async () => { if (failLoad) throw new Error('invalid configuration'); return settings; } },
        ChessAlertSites: { read: () => game }, Audio,
        MutationObserver: class { constructor(fn) { observer = fn; } observe() {} disconnect() {} },
        document: { documentElement: {} }, location: {}, window: { addEventListener() {} },
        setInterval: fn => { interval = fn; return 1; }, clearInterval: () => { interval = null; }, queueMicrotask, Date });
    vm.runInContext(fs.readFileSync(require.resolve('../content.js'), 'utf8'), context);
    return {
        update: async value => { settings = ChessAlert.normalizeSettings(value); change({ chessAlertSettings: {} }, 'sync'); await flush(); },
        tick: async value => { if (value) game = { ...game, ...value }; interval?.(); await flush(); },
        status: () => message({ type: 'chess-alert-status' }),
        fail: async () => { failLoad = true; change({ chessAlertSettings: {} }, 'sync'); await flush(); },
        observe: async () => { observer?.(); await flush(); },
        plays: () => plays, pauses: () => pauses, polling: () => !!interval
    };
}
test('saving starts an initially unconfigured tab; clear cancels sounds and stops polling', async () => {
    const app = harness(); await flush();
    assert.equal(app.polling(), false);
    await app.update({ alertSettings: [{ threshold: 5, amount: 3 }] });
    assert.equal(app.plays(), 1);
    assert.equal(app.polling(), true);
    await app.update({ alertSettings: [], enabled: false });
    assert.equal(app.polling(), false);
    assert.ok(app.pauses() >= 1);
    await app.observe();
    assert.equal(app.plays(), 1);
    assert.equal((await app.status()).state, 'disabled');
});
test('duplicate backup events do not reset played alerts or replay audio', async () => {
    const value = { alertSettings: [{ threshold: 5, amount: 1 }] };
    const app = harness(value); await flush();
    await app.update(value); await app.tick();
    assert.equal(app.plays(), 1);
});
test('new game resets consumed alerts even with increment rearming disabled', async () => {
    const app = harness({ alertSettings: [{ threshold: 5, amount: 1 }], resetAlertOnTimeIncrease: false });
    await flush(); await app.tick({ seconds: 300 }); await app.tick({ seconds: 5 });
    assert.equal(app.plays(), 1);
    await app.tick({ key: 'game-2', seconds: 5 });
    assert.equal(app.plays(), 2);
});
test('playback failures are surfaced and retried with a delay rather than every mutation', async () => {
    const app = harness({ alertSettings: [{ threshold: 5, amount: 1 }] }, true); await flush();
    await app.tick(); await app.observe();
    assert.equal(app.plays(), 1);
    assert.match((await app.status()).message, /Sound blocked/);
});
test('ended games cancel queued sound and corrupt settings stop the controller', async () => {
    const app = harness({ alertSettings: [{ threshold: 5, amount: 3 }] }); await flush();
    await app.tick({ ended: true, state: 'ended', active: false });
    assert.ok(app.pauses() >= 1);
    assert.equal(app.plays(), 1);
    await app.fail();
    assert.equal(app.polling(), false);
    assert.equal((await app.status()).state, 'error');
});
