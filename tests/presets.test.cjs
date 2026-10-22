const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_PRESETS, normalizePresets } = require('../core.js');

test('default presets include 30/15/5 and preserve the previous suggested list', () => {
    const presets = normalizePresets(DEFAULT_PRESETS);
    assert.deepEqual(presets[0].alerts.map(a => a.threshold), [30, 15, 5]);
    assert.deepEqual(presets[1].alerts.map(a => a.threshold), [30, 10, 5]);
    presets[0].alerts[0].amount = 10;
    assert.equal(DEFAULT_PRESETS[0].alerts[0].amount, 1);
});
test('preset names, identifiers and alert lists are validated before saving', () => {
    const preset = { id: 'test-preset', name: '  Rapid  ', alerts: [{ threshold: 5, amount: 2 }] };
    assert.equal(normalizePresets([preset])[0].name, 'Rapid');
    for (const invalid of [null, {}, { ...preset, name: ' ' }, { ...preset, name: 'x'.repeat(61) },
        { ...preset, id: '' }, { ...preset, alerts: [] }, { ...preset, alerts: [{ threshold: 5, amount: 11 }] }]) {
        assert.throws(() => normalizePresets([invalid]));
    }
    assert.throws(() => normalizePresets([preset, { ...preset, id: 'other', name: 'RAPID' }]), /already exists/);
    assert.throws(() => normalizePresets([preset, { ...preset, name: 'Other' }]), /identifiers/);
    assert.throws(() => normalizePresets(Array(51).fill(preset)), /50 presets/);
    assert.deepEqual(normalizePresets([]), []);
});
