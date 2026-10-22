const test = require('node:test');
const assert = require('node:assert/strict');
const { parseTime, normalizeSettings, validateAlerts, AlertEngine, GameSession, PRESET } = require('../core.js');
const settings = (extra = {}) => ({ alertSettings: PRESET, ...extra });

test('clock formats include hours, tenths, hundredths and directional markers', () => {
    for (const [input, expected] of [['01:00:00', 3600], ['1:02:03.5', 3723.5], ['02:05', 125],
        ['00:00.75', .75], ['0,5', .5], ['\u200e00:05.1\u200f', 5.1], ['00 : 05', 5], ['0', 0]]) {
        assert.equal(parseTime(input), expected, input);
    }
});
test('unknown, negative and malformed clocks never become low time', () => {
    for (const input of ['', ' ', null, 'NaN', '-1', '1:60', '1:60:00', '1:2:3:4', '5 seconds', 'Infinity', '5.']) {
        assert.equal(parseTime(input), null, String(input));
    }
});
test('settings reject invalid amounts, thresholds, duplicates and excessive lists', () => {
    for (const alert of [{ threshold: NaN, amount: 1 }, { threshold: null, amount: 1 },
        { threshold: 0, amount: 1 }, { threshold: 5.1, amount: 1 }, { threshold: 5, amount: 0 },
        { threshold: 5, amount: 11 }, { threshold: 5, amount: 1.5 }, { threshold: '5', amount: 1 }]) {
        assert.throws(() => validateAlerts([alert]));
    }
    assert.throws(() => validateAlerts([{ threshold: 5, amount: 1 }, { threshold: 5, amount: 2 }]));
    assert.throws(() => validateAlerts(Array(51).fill(PRESET[0])));
    const original = [{ threshold: 5, amount: 1 }, { threshold: 10, amount: 2 }];
    assert.equal(validateAlerts(original)[0].threshold, 10);
    assert.equal(original[0].threshold, 5);
    assert.equal(normalizeSettings({ enabled: false }).enabled, false);
});
test('late entry and skipped thresholds play only the most urgent series once', () => {
    const engine = new AlertEngine(settings());
    assert.deepEqual(engine.sample(2), PRESET[2]);
    assert.equal(engine.sample(1), null);
    assert.equal(engine.sample(0), null);
});
test('normal countdown and increments rearm only thresholds exceeded', () => {
    const engine = new AlertEngine(settings());
    assert.equal(engine.sample(31), null);
    assert.equal(engine.sample(30).threshold, 30);
    assert.equal(engine.sample(10).threshold, 10);
    assert.equal(engine.sample(5).threshold, 5);
    assert.equal(engine.sample(8, false), null);
    assert.equal(engine.sample(5).threshold, 5);
    assert.equal(engine.sample(4), null);
});
test('non-rearming mode still resets for a new game', () => {
    const engine = new AlertEngine(settings({ resetAlertOnTimeIncrease: false }));
    engine.sample(2); engine.sample(300);
    assert.equal(engine.sample(2), null);
    engine.reset();
    assert.equal(engine.sample(2).threshold, 5);
});
test('paused, zero, invalid and disabled clocks do not consume alerts', () => {
    const engine = new AlertEngine(settings());
    for (const value of [0, NaN, -1, Infinity]) assert.equal(engine.sample(value), null);
    assert.equal(engine.sample(5, false), null);
    assert.equal(engine.sample(5).threshold, 5);
    engine.configure(settings({ enabled: false }));
    assert.equal(engine.sample(5), null);
});
test('failed playback can retry without replaying skipped thresholds', () => {
    const engine = new AlertEngine(settings());
    const alert = engine.sample(2);
    engine.retry(alert);
    assert.equal(engine.sample(1).threshold, 5);
    assert.equal(engine.sample(1), null);
});
test('configuration changes apply immediately, including empty and disabled settings', () => {
    const engine = new AlertEngine(settings());
    engine.sample(5);
    engine.configure({ alertSettings: [{ threshold: 7, amount: 2 }] });
    assert.equal(engine.sample(6).threshold, 7);
    engine.configure({ alertSettings: [] });
    assert.equal(engine.sample(1), null);
});
test('session changes, rematches and board flips', () => {
    const tracker = new GameSession();
    const game = { key: 'game-1:white:alice', active: true, ended: false, moves: 20, times: [2, 4] };
    assert.equal(tracker.update(game), true);
    assert.equal(tracker.update({ ...game }), false); // same identity after a board flip
    assert.equal(tracker.update({ ...game, times: [30, 4] }), false); // increment
    assert.equal(tracker.update({ ...game, ended: true, active: false }), false);
    assert.equal(tracker.update({ ...game, moves: 0, times: [300, 300] }), true);
    assert.equal(tracker.update({ ...game, key: 'game-2:white:alice' }), true);
});
test('same-route rematch resets on move list reset and both clocks rising, not one increment', () => {
    const tracker = new GameSession();
    tracker.update({ key: 'same-route', moves: 40, times: [2, 3] });
    assert.equal(tracker.update({ key: 'same-route', moves: 0, times: [300, 300] }), true);
    tracker.update({ key: 'same-route', moves: 40, times: [2, 3] });
    assert.equal(tracker.update({ key: 'same-route', moves: 0, times: [5, 3] }), false);
});
test('rematch detection tolerates the move list resetting before the clocks', () => {
    const tracker = new GameSession();
    tracker.update({ key: 'same-route', moves: 40, times: [2, 3] });
    assert.equal(tracker.update({ key: 'same-route', moves: 0, times: [2, 3] }), false);
    assert.equal(tracker.update({ key: 'same-route', moves: 0, times: [300, 300] }), true);
    assert.equal(tracker.update({ key: 'same-route', moves: 0, times: [300, 300] }), false);
});
