(async function () {
    let checks = 0;
    const assert = (condition, message) => { checks++; if (!condition) throw new Error(message); };
    const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
    const click = id => document.getElementById(id).click();
    const input = (selector, value) => {
        const el = document.querySelector(selector); el.value = value; el.dispatchEvent(new Event('input', { bubbles: true }));
        if (el.classList.contains('threshold')) el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const choose = id => { const el = document.getElementById('preset'); el.value = id; el.dispatchEvent(new Event('change', { bubbles: true })); };
    const values = () => Array.from(document.querySelectorAll('#thresholds .threshold'), el => el.valueAsNumber);
    const stableSize = () => {
        const shell = document.querySelector('.app-shell').getBoundingClientRect();
        const footer = document.querySelector('.app-footer').getBoundingClientRect();
        return shell.width === 390 && shell.height === 600 && document.body.scrollHeight === 600 && footer.bottom <= 600;
    };
    const noOverflow = () => {
        const selectors = ['.app-shell', '.threshold-actions', '.preset-group', '#thresholds', '#presetThresholds', '#presetView'];
        return selectors.every(selector => { const el = document.querySelector(selector); return !el.getClientRects().length || el.scrollWidth <= el.clientWidth + 1; }) &&
            document.documentElement.scrollWidth <= window.innerWidth;
    };
    let result;
    try {
        await settle();
        assert(stableSize(), 'Popup starts at a fixed 390 by 600 size');
        assert(document.getElementById('preset').tagName === 'SELECT', 'Presets are a dropdown');
        choose('default-30-15-5');
        assert(values().join() === '30,15,5' && window.__writes.length === 0, 'Choosing preset loads a draft');
        input('#thresholds .threshold', '45');
        choose('__new');
        assert(!document.getElementById('presetView').hidden && document.querySelector('#presetThresholds .threshold').value === '45', 'New preset captures the current alerts');
        assert(stableSize(), 'Opening the preset editor does not resize the popup');
        input('#presetName', 'Rapid'); click('save'); await settle();
        const custom = window.__local.chessAlertPresets.at(-1);
        assert(stableSize(), 'Saving a preset does not resize the popup');
        assert(custom.name === 'Rapid' && custom.alerts[0].threshold === 45 && custom.alerts[1].amount === 2, 'Preset name, times and sounds persist');
        assert(window.__writes.length === 0 && window.__presetWrites.length === 1, 'Saving a preset does not activate live settings');
        assert((await ChessAlertStorage.loadPresets()).at(-1).id === custom.id, 'Saved preset can be read back');
        click('editPreset');
        assert(document.body.dataset.view === 'preset', 'Pencil opens the selected preset editor');
        input('#presetName', 'Rapid edited'); input('#presetThresholds .threshold', '60');
        input('#presetThresholds tr:nth-child(2) .amount', '4');
        click('save'); await settle();
        assert(window.__local.chessAlertPresets.length === 3 && window.__local.chessAlertPresets.at(-1).id === custom.id, 'Edit updates the same preset');
        choose('default-30-10-5'); choose(custom.id);
        assert(values()[0] === 60 && document.querySelector('#thresholds tr:nth-child(2) .amount').value === '4', 'Loading edited preset restores all fields');
        click('editPreset'); input('#presetName', '30 / 15 / 5 s'); click('save'); await settle();
        assert(window.__presetWrites.length === 2 && document.body.dataset.view === 'preset', 'Duplicate names do not overwrite presets');
        input('#presetName', 'Rapid edited');
        const editedThreshold = document.querySelector('#presetThresholds .threshold');
        editedThreshold.value = '0'; editedThreshold.dispatchEvent(new Event('input', { bubbles: true }));
        editedThreshold.dispatchEvent(new Event('change', { bubbles: true })); click('save'); await settle();
        assert(window.__presetWrites.length === 2, 'Invalid preset alerts are rejected');
        editedThreshold.value = '70'; editedThreshold.dispatchEvent(new Event('input', { bubbles: true }));
        editedThreshold.dispatchEvent(new Event('change', { bubbles: true }));
        window.__failPresetWrite = true; click('save'); await settle();
        assert(document.body.dataset.view === 'preset' && window.__local.chessAlertPresets.at(-1).alerts[0].threshold === 60 && document.getElementById('status').textContent.includes('unavailable'), 'Storage error preserves saved data and editor draft');
        assert(stableSize(), 'Save errors keep the same popup size and visible footer');
        window.__failPresetWrite = false; click('backPreset');
        assert(values()[0] === 60, 'Cancel editing keeps the main alert draft');
        click('save'); await settle();
        assert(window.__writes.length === 1 && window.__writes[0].chessAlertSettings.alertSettings[0].threshold === 60, 'Save changes applies the chosen preset');
        await initialize();
        assert(Array.from(document.getElementById('preset').options).some(o => o.value === custom.id && o.textContent === 'Rapid edited'), 'Reopening reloads saved presets');
        choose(custom.id);
        input('#thresholds tr:first-child .amount', '2');
        const presetAction = document.getElementById('editPreset');
        assert(presetAction.dataset.action === 'save' && presetAction.querySelector('.symbol').textContent === 'check', 'Modified preset shows a save checkmark');
        assert(getComputedStyle(presetAction).color === 'rgb(181, 104, 24)', 'Unsaved preset checkmark is orange');
        click('editPreset'); await settle();
        const savedCustom = window.__local.chessAlertPresets.find(preset => preset.id === custom.id);
        assert(savedCustom.alerts[0].amount === 2 && window.__presetWrites.length === 3, 'Checkmark saves changes to the selected preset');
        assert(presetAction.dataset.action === 'edit' && presetAction.querySelector('.symbol').textContent === 'edit', 'Saved preset returns to the pencil action');
        click('clear'); await settle();
        assert(values().length === 0 && window.__local.chessAlertPresets.length === 3, 'Clear does not delete the preset library');
        choose(custom.id); click('editPreset'); click('deletePreset'); await settle();
        assert(window.__local.chessAlertPresets.length === 2 && values()[0] === 60, 'Delete removes only the preset');
        choose('default-30-15-5'); click('editPreset'); input('#presetName', 'Starter edited'); click('save'); await settle();
        assert(window.__local.chessAlertPresets[0].name === 'Starter edited', 'Built-in presets can also be edited');
        click('addButton');
        const focused = document.activeElement;
        // An inactive headless window can suppress :focus-within painting; verify the focused target and its rounded container.
        assert(focused.matches('#thresholds .threshold') && parseFloat(getComputedStyle(focused).borderRadius) > 0 &&
            getComputedStyle(focused.parentElement).borderRadius === getComputedStyle(focused).borderRadius, 'New alert receives a rounded focus ring: ' +
                JSON.stringify({ active: focused.className, radius: getComputedStyle(focused).borderRadius,
                    shadow: getComputedStyle(focused.parentElement).boxShadow }));
        for (let i = values().length; i < 50; i++) click('addButton');
        assert(values().length === 50 && noOverflow(), 'Long alert lists have no horizontal overflow');
        assert(stableSize(), 'Long alert lists scroll inside the fixed popup');
        click('editPreset'); await settle(); click('editPreset');
        input('#presetName', 'Long preset name '.repeat(3));
        assert(noOverflow(), 'Preset editor stays within popup width');
        click('save'); await settle();
        assert(noOverflow() && document.getElementById('preset').selectedOptions[0].textContent.startsWith('Long preset name'), 'Long saved preset names fit in the dropdown');
        document.documentElement.style.width = '375px';
        assert(noOverflow() && document.querySelector('.app-shell').getBoundingClientRect().width <= 375, 'Popup shrinks when a vertical scrollbar reduces available width');
        result = `PASS ${checks} preset checks`;
    } catch (error) { result = `FAIL ${error.message}\n${error.stack}`; }
    void fetch('/__result', { method: 'POST', body: result });
})();
