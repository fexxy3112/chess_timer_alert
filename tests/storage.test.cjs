const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../core.js');
function storage(sync = {}, local = {}, failures = {}) {
    const api = { storage: {} };
    for (const [area, data] of Object.entries({ sync, local })) {
        api.storage[area] = {
            async get() { if (failures[area + 'Get']) throw new Error(area + ' unavailable'); return data; },
            async set(value) { if (failures[area + 'Set']) throw new Error(area + ' write failed'); Object.assign(data, value); }
        };
    }
    const context = vm.createContext({ browser: api, ChessAlert: core });
    vm.runInContext(fs.readFileSync(require.resolve('../settings.js'), 'utf8'), context);
    return context.ChessAlertStorage;
}
test('legacy sync and local settings are loaded without discarding explicit empty sync data', async () => {
    const legacy = { alertSettings: [{ threshold: 5, amount: 2 }], resetAlertOnTimeIncrease: false };
    assert.deepEqual(await storage(legacy).load(), core.normalizeSettings(legacy));
    assert.deepEqual(await storage({}, legacy).load(), core.normalizeSettings(legacy));
    assert.deepEqual((await storage({ alertSettings: [] }, legacy).load()).alertSettings, []);
});
test('clear saves a tombstone so legacy settings cannot return', async () => {
    const sync = { alertSettings: core.PRESET }, local = { alertSettings: core.PRESET };
    const store = storage(sync, local);
    await store.save({ enabled: false, alertSettings: [] });
    assert.deepEqual((await store.load()).alertSettings, []);
    assert.equal((await store.load()).enabled, false);
    assert.deepEqual(sync[store.KEY], local[store.KEY]);
});
test('unavailable sync uses a local backup, but reports failure when both are unavailable', async () => {
    const value = { chessAlertSettings: { alertSettings: core.PRESET } };
    assert.deepEqual((await storage({}, value, { syncGet: true }).load()).alertSettings, core.PRESET);
    await assert.rejects(storage({}, {}, { syncGet: true }).load(), /sync unavailable/);
});
test('save errors are not reported as success or copied into local storage', async () => {
    const local = {};
    const store = storage({}, local, { syncSet: true });
    await assert.rejects(store.save({ alertSettings: core.PRESET }), /sync write failed/);
    assert.deepEqual(local, {});
    assert.match(await storage({}, {}, { localSet: true }).save({ alertSettings: core.PRESET }), /backup/);
});
test('malformed stored thresholds fail closed with a useful error', async () => {
    await assert.rejects(storage({ chessAlertSettings: { alertSettings: [{ threshold: null, amount: 1 }] } }).load(), /Row 1/);
});
test('preset creation, edit and deletion survive a new storage session without changing live alerts', async () => {
    const sync = { chessAlertSettings: core.normalizeSettings({ alertSettings: core.PRESET }) }, local = {};
    const before = JSON.stringify(sync);
    const first = storage(sync, local);
    const library = await first.loadPresets();
    const custom = { id: 'custom', name: 'Rapid', alerts: [{ threshold: 20, amount: 3 }] };
    await first.savePresets([...library, custom]);
    const reopened = storage(sync, local);
    assert.deepEqual((await reopened.loadPresets()).at(-1), custom);
    custom.name = 'Rapid edited'; custom.alerts[0].amount = 4;
    await reopened.savePresets([custom]);
    assert.deepEqual(await storage(sync, local).loadPresets(), [custom]);
    await reopened.savePresets([]);
    assert.deepEqual(await storage(sync, local).loadPresets(), []);
    assert.equal(JSON.stringify(sync), before);
});
test('preset write errors keep the previous library and corrupt data is not silently replaced', async () => {
    const local = { chessAlertPresets: core.normalizePresets(core.DEFAULT_PRESETS) };
    const before = JSON.stringify(local);
    await assert.rejects(storage({}, local, { localSet: true }).savePresets([]), /write failed/);
    assert.equal(JSON.stringify(local), before);
    await assert.rejects(storage({}, { chessAlertPresets: null }).loadPresets(), /50 presets/);
});
