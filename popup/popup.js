"use strict";
const { api, load, save, loadPresets, savePresets } = ChessAlertStorage;
const tableBody = document.getElementById("thresholds");
const statusText = document.getElementById("status");
const gameStatus = document.getElementById("gameStatus");
const enabled = document.getElementById("enabled");
const resetAlerts = document.getElementById("resetAlertWhenTimeIncreases");
const clockColor = document.getElementById("clockColor");
const username = document.getElementById("username");
const controls = Array.from(document.querySelectorAll("button, input, select"));
let testAudio = null;
const presetSelect = document.getElementById("preset");
const presetBody = document.getElementById("presetThresholds");
const presetName = document.getElementById("presetName");
let presets = [], selectedPresetId = null, editingPresetId = null, presetsAvailable = false;

function feedback(message, kind = "info") {
    statusText.textContent = message;
    statusText.dataset.kind = kind;
}
function setView(view, focus = true) {
    document.body.dataset.view = view;
    document.getElementById("alertsView").hidden = view !== "alerts";
    document.getElementById("playerView").hidden = view !== "settings";
    document.getElementById("presetView").hidden = view !== "preset";
    document.getElementById("backFooter").hidden = view === "alerts";
    document.getElementById("save").textContent = view === "preset" ? "Save preset" : "Save changes";
    document.querySelector("main").scrollTop = 0;
    if (focus) document.getElementById(view === "settings" ? "playerHeading" : view === "preset" ? "presetHeading" : "openSettings").focus({ preventScroll: true });
}
function updateSummary() {
    document.getElementById("enabledLabel").textContent = enabled.checked ? "ON" : "OFF";
    document.getElementById("trackingSummary").textContent = clockColor.value === "auto" ? "Automatic" :
        clockColor.value === "white" ? "White" : "Black";
    const empty = tableBody.rows.length === 0;
    document.getElementById("emptyState").hidden = !empty;
    document.getElementById("alertTable").hidden = empty;
    updatePresetSelect();
}
function markDirty() {
    updateSummary();
    feedback("Unsaved changes. Choose Save changes to apply.");
}
document.getElementById("openSettings").addEventListener("click", () => setView("settings"));
for (const id of ["backTop", "backFooter", "backPreset"]) document.getElementById(id).addEventListener("click", () => setView("alerts"));
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.body.dataset.view !== "alerts") {
        event.preventDefault(); setView("alerts");
    }
});
for (const input of [enabled, resetAlerts, clockColor, username]) input.addEventListener("input", markDirty);

function sortRows(target) {
    const rows = Array.from(target.rows);
    rows.sort((a, b) => {
        const first = a.querySelector(".threshold").valueAsNumber;
        const second = b.querySelector(".threshold").valueAsNumber;
        if (!Number.isFinite(first)) return Number.isFinite(second) ? 1 : 0;
        if (!Number.isFinite(second)) return -1;
        return second - first;
    });
    target.append(...rows);
}

function insertRow(threshold = 5, amount = 1, target = tableBody) {
    const row = document.createElement("tr");
    for (const field of [
        { name: "threshold", value: threshold, min: 0.5, max: 86400, step: 0.5, label: "Threshold in seconds" },
        { name: "amount", value: amount, min: 1, max: 10, step: 1, label: "Number of sounds" }
    ]) {
        const cell = document.createElement("td");
        const input = document.createElement("input");
        Object.assign(input, { type: "number", className: field.name, value: field.value,
            min: field.min, max: field.max, step: field.step, required: true });
        input.setAttribute("aria-label", field.label);
        const wrapper = document.createElement("div");
        wrapper.className = field.name + "-field";
        const unit = document.createElement("span");
        unit.className = field.name === "threshold" ? "unit" : "amount-unit";
        unit.textContent = field.name === "threshold" ? "s" : Number(amount) === 1 ? "sound" : "sounds";
        unit.setAttribute("aria-hidden", "true");
        input.addEventListener("input", () => {
            input.setCustomValidity("");
            if (field.name === "amount") unit.textContent = input.valueAsNumber === 1 ? "sound" : "sounds";
            if (target === tableBody) markDirty(); else feedback("Unsaved preset changes. Choose Save preset to keep them.");
        });
        if (field.name === "threshold") input.addEventListener("change", () => sortRows(target));
        wrapper.append(input, unit); cell.append(wrapper); row.append(cell);
    }
    const cell = document.createElement("td");
    const remove = document.createElement("button");
    remove.type = "button"; remove.className = "remove";
    const removeIcon = document.createElement("span");
    removeIcon.className = "symbol"; removeIcon.textContent = "delete"; removeIcon.setAttribute("aria-hidden", "true");
    remove.append(removeIcon);
    remove.setAttribute("aria-label", "Remove threshold");
    remove.title = "Remove threshold";
    remove.addEventListener("click", () => {
        row.remove();
        if (target === tableBody) markDirty(); else feedback("Unsaved preset changes. Choose Save preset to keep them.");
        document.getElementById(target === tableBody ? "addButton" : "addPresetAlert").focus();
    });
    cell.append(remove); row.append(cell); target.append(row);
    sortRows(target);
    return row;
}
function render(settings) {
    if (!settings.alertSettings.length) selectedPresetId = null;
    tableBody.replaceChildren();
    settings.alertSettings.forEach(a => insertRow(a.threshold, a.amount));
    enabled.checked = settings.enabled;
    resetAlerts.checked = settings.resetAlertOnTimeIncrease;
    clockColor.value = settings.clockColor;
    username.value = settings.username;
    updateSummary();
}
function collectAlerts(target = tableBody) {
    const seen = new Set();
    const alerts = Array.from(target.rows).map(row => {
        const threshold = row.querySelector(".threshold");
        const amount = row.querySelector(".amount");
        threshold.setCustomValidity(""); amount.setCustomValidity("");
        const view = target === tableBody ? "alerts" : "preset";
        if (!threshold.checkValidity()) { setView(view, false); threshold.reportValidity(); throw new Error("Check the highlighted threshold."); }
        if (!amount.checkValidity()) { setView(view, false); amount.reportValidity(); throw new Error("Enter a whole number of sounds from 1 to 10."); }
        if (seen.has(threshold.valueAsNumber)) {
            setView(view, false);
            threshold.setCustomValidity("Each threshold must be unique."); threshold.reportValidity();
            throw new Error("Remove or change the duplicate threshold.");
        }
        seen.add(threshold.valueAsNumber);
        return { threshold: threshold.valueAsNumber, amount: amount.valueAsNumber };
    });
    return ChessAlert.validateAlerts(alerts);
}
function collect() {
    const alerts = collectAlerts();
    if (enabled.checked && !alerts.length) { setView("alerts"); throw new Error("Add a threshold or disable alerts before saving."); }
    return ChessAlert.normalizeSettings({ alertSettings: alerts, enabled: enabled.checked,
        resetAlertOnTimeIncrease: resetAlerts.checked, clockColor: clockColor.value, username: username.value });
}
async function persist(settings) {
    const buttons = Array.from(document.querySelectorAll("button"));
    buttons.forEach(b => b.disabled = true);
    try {
        const warning = await save(settings);
        render(settings);
        if (document.body.dataset.view === "settings") setView("alerts");
        feedback(warning || "Saved. Open games update automatically.", warning ? "warning" : "success");
        await refreshStatus();
    } catch (error) { feedback(`Could not save: ${error.message}`, "error"); }
    finally { buttons.forEach(b => b.disabled = false); updatePresetSelect(); }
}
document.getElementById("save").addEventListener("click", () => {
    try {
        if (document.body.dataset.view === "preset") void persistPreset();
        else void persist(collect());
    }
    catch (error) { feedback(error.message, "error"); }
});
document.getElementById("clear").addEventListener("click", () => {
    void persist({ ...ChessAlert.DEFAULTS, enabled: false, alertSettings: [] });
});
function addAlert(target) {
    if (target.rows.length >= 50) { feedback("Use at most 50 thresholds.", "error"); return; }
    const used = new Set(Array.from(target.querySelectorAll(".threshold"), input => input.valueAsNumber));
    let next = 5;
    while (used.has(next)) next += 5;
    const row = insertRow(next, 1, target);
    if (target === tableBody) markDirty(); else feedback("Unsaved preset changes. Choose Save preset to keep them.");
    row.querySelector(".threshold").focus();
}
document.getElementById("addButton").addEventListener("click", () => addAlert(tableBody));
document.getElementById("addPresetAlert").addEventListener("click", () => addAlert(presetBody));

function currentAlerts() {
    return Array.from(tableBody.rows, row => ({ threshold: row.querySelector(".threshold").valueAsNumber,
        amount: row.querySelector(".amount").valueAsNumber })).sort((a, b) => b.threshold - a.threshold);
}
function updatePresetSelect() {
    const current = currentAlerts();
    const exact = presets.find(p => JSON.stringify(p.alerts) === JSON.stringify(current));
    if (!selectedPresetId || !presets.some(p => p.id === selectedPresetId)) selectedPresetId = exact?.id || null;
    presetSelect.replaceChildren(new Option(current.length ? "Custom alerts" : "Choose preset", ""));
    for (const preset of presets) presetSelect.add(new Option(preset.name, preset.id));
    const actions = document.createElement("optgroup"); actions.label = "Manage presets";
    actions.append(new Option("Save current as new preset...", "__new")); presetSelect.append(actions);
    const selected = presets.find(p => p.id === selectedPresetId);
    if (selected && JSON.stringify(selected.alerts) === JSON.stringify(current)) presetSelect.value = selected.id;
    else if (selected) {
        presetSelect.options[0].textContent = `${selected.name} (modified)`;
        presetSelect.value = "";
    }
    presetSelect.disabled = !presetsAvailable;
    const edit = document.getElementById("editPreset");
    const modified = !!selected && JSON.stringify(selected.alerts) !== JSON.stringify(current);
    edit.disabled = !presetsAvailable || !selected || (modified && !current.length);
    edit.dataset.action = modified ? "save" : "edit";
    edit.querySelector(".symbol").textContent = modified ? "check" : "edit";
    edit.setAttribute("aria-label", modified ? `Save changes to ${selected.name}` : "Edit selected preset");
    edit.title = modified ? `Save changes to ${selected.name}` : selected ? `Edit preset: ${selected.name}` : "Select a preset to edit it";
}
function openPresetEditor(id = null) {
    try {
        const preset = id ? presets.find(p => p.id === id) : null;
        const alerts = preset ? preset.alerts : collectAlerts();
        if (!alerts.length) throw new Error("Add at least one alert before saving a new preset.");
        if (!preset && presets.length >= 50) throw new Error("Use at most 50 presets.");
        editingPresetId = preset?.id || null;
        presetName.value = preset?.name || "";
        presetName.setCustomValidity("");
        presetBody.replaceChildren(); alerts.forEach(a => insertRow(a.threshold, a.amount, presetBody));
        document.getElementById("presetHeading").textContent = preset ? "Edit preset" : "New preset";
        document.getElementById("deletePreset").hidden = !preset;
        feedback("Save preset stores this list. Save changes applies it to your games.");
        setView("preset"); presetName.focus();
    } catch (error) { feedback(error.message, "error"); }
}
presetSelect.addEventListener("change", () => {
    const value = presetSelect.value;
    if (value === "__new") { updatePresetSelect(); openPresetEditor(); return; }
    const preset = presets.find(p => p.id === value);
    if (!preset) return;
    selectedPresetId = preset.id;
    tableBody.replaceChildren(); preset.alerts.forEach(a => insertRow(a.threshold, a.amount));
    enabled.checked = true; updateSummary();
    feedback("Preset loaded. Choose Save changes to apply.");
});
document.getElementById("editPreset").addEventListener("click", () => {
    if (document.getElementById("editPreset").dataset.action === "save") void saveSelectedPreset();
    else openPresetEditor(selectedPresetId);
});
presetName.addEventListener("input", () => { presetName.setCustomValidity(""); feedback("Unsaved preset changes. Choose Save preset to keep them."); });
async function persistPreset() {
    try {
        presetName.setCustomValidity("");
        if (!presetName.checkValidity() || !presetName.value.trim()) {
            presetName.setCustomValidity("Enter a preset name."); presetName.reportValidity(); return;
        }
        const alerts = collectAlerts(presetBody);
        if (!alerts.length) throw new Error("A preset needs at least one alert.");
        const preset = { id: editingPresetId || crypto.randomUUID(), name: presetName.value.trim(), alerts };
        const next = editingPresetId ? presets.map(p => p.id === editingPresetId ? preset : p) : [...presets, preset];
        await storePresetLibrary(next);
        selectedPresetId = preset.id;
        tableBody.replaceChildren(); alerts.forEach(a => insertRow(a.threshold, a.amount));
        updateSummary(); setView("alerts");
        feedback("Preset saved. Choose Save changes to apply these alerts.", "success");
    } catch (error) { feedback(`Could not save preset: ${error.message}`, "error"); }
}
async function saveSelectedPreset() {
    const existing = presets.find(p => p.id === selectedPresetId);
    if (!existing) return;
    try {
        const updated = { ...existing, alerts: collectAlerts() };
        await storePresetLibrary(presets.map(p => p.id === updated.id ? updated : p));
        feedback(`Preset “${updated.name}” updated. Choose Save changes to apply it to your games.`, "success");
    } catch (error) { feedback(`Could not save preset: ${error.message}`, "error"); }
}
async function storePresetLibrary(next) {
    const inputs = Array.from(document.querySelectorAll("button, input, select"));
    inputs.forEach(input => input.disabled = true);
    try { presets = await savePresets(next); }
    finally { inputs.forEach(input => input.disabled = false); updatePresetSelect(); }
}
document.getElementById("deletePreset").addEventListener("click", async () => {
    try {
        await storePresetLibrary(presets.filter(p => p.id !== editingPresetId));
        selectedPresetId = null; updatePresetSelect(); setView("alerts");
        feedback("Preset deleted. Your current alerts are unchanged.", "success");
    } catch (error) { feedback(`Could not delete preset: ${error.message}`, "error"); }
});
document.getElementById("testSound").addEventListener("click", async () => {
    testAudio?.pause();
    testAudio = new Audio(api.runtime.getURL("sounds/alert.wav"));
    try {
        await testAudio.play();
        feedback("Test playing. Allow site audio in the game tab too.", "success");
    } catch (_) { feedback("Sound could not play. Check Firefox audio settings.", "error"); }
});
function showConnection(state, source, message) {
    const titles = { ready: "Your clock is connected", disabled: "Alerts are switched off", waiting: "Waiting for a live game",
        identity: "Which clock is yours?", missing: "Your clock wasn't found", format: "Clock format not supported",
        ended: "Game finished", error: "Your alerts need attention", loading: "Checking your clock" };
    const attention = ["error", "identity", "missing", "format"].includes(state);
    document.getElementById("connection").dataset.state = state;
    document.getElementById("connectionIcon").textContent = attention ? "warning" : state === "ready" ? "check_circle" : "info";
    document.getElementById("connectionSource").textContent = source;
    document.getElementById("connectionTitle").textContent = titles[state] || titles.waiting;
    document.getElementById("connectionBadge").textContent = attention ? "CHECK" : state === "ready" ? "READY" : state === "disabled" ? "OFF" : "WAIT";
    gameStatus.textContent = message;
    gameStatus.hidden = state === "ready";
}
async function refreshStatus() {
    try {
        const [tab] = await api.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !/^https?:\/\/(www\.chess\.com|lichess\.org)\//.test(tab.url || "")) {
            showConnection("waiting", "Chess.com & Lichess", "Open a game to check your clock."); return;
        }
        const result = await api.tabs.sendMessage(tab.id, { type: "chess-alert-status" });
        const site = new URL(tab.url).hostname === "lichess.org" ? "Lichess" : "Chess.com";
        const color = result?.message?.match(/Clock detected:\s*(white|black)/i)?.[1];
        const source = site + (color ? ` · ${color[0].toUpperCase()}${color.slice(1).toLowerCase()}` : "");
        // Content reports playback errors in the message while the clock itself stays ready.
        const state = result?.state === "ready" && /Sound blocked|unavailable/i.test(result.message || "") ? "error" : result?.state || "waiting";
        showConnection(state, source, result?.message || "Waiting for game status.");
    } catch (_) { showConnection("missing", "Chess.com & Lichess", "Reload the game tab after installing or updating this extension."); }
}
async function initialize() {
    presetsAvailable = false;
    controls.forEach(c => c.disabled = true);
    try {
        const [settingsResult, presetsResult] = await Promise.allSettled([load(), loadPresets()]);
        if (presetsResult.status === "fulfilled") { presets = presetsResult.value; presetsAvailable = true; }
        if (settingsResult.status === "rejected") throw settingsResult.reason;
        const settings = settingsResult.value; render(settings);
        if (presetsResult.status === "rejected") feedback(`Could not load presets: ${presetsResult.reason.message}`, "error");
        else if (!settings.alertSettings.length) feedback("Choose a preset or add your own alerts, then Save changes.");
    } catch (error) {
        render({ ...ChessAlert.DEFAULTS, enabled: false });
        feedback(`Could not load settings: ${error.message}. Correct and save settings to recover.`, "error");
    } finally { controls.forEach(c => c.disabled = false); updatePresetSelect(); }
    await refreshStatus();
}
window.addEventListener("pagehide", () => { testAudio?.pause(); });
setInterval(refreshStatus, 1000);
void initialize();
