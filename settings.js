(function (root) {
    "use strict";
    const api = typeof browser !== "undefined" ? browser : chrome;
    const KEY = "chessAlertSettings";
    const PRESETS_KEY = "chessAlertPresets";
    const keys = [KEY, "alertSettings", "resetAlertOnTimeIncrease"];
    function unpack(data) {
        if (Object.prototype.hasOwnProperty.call(data, KEY)) return data[KEY];
        if (Object.prototype.hasOwnProperty.call(data, "alertSettings")) return data;
        return null;
    }
    async function load() {
        let data;
        try { data = unpack(await api.storage.sync.get(keys)); }
        catch (error) {
            const local = unpack(await api.storage.local.get(keys));
            if (local === null) throw error;
            return ChessAlert.normalizeSettings(local);
        }
        if (data === null) data = unpack(await api.storage.local.get(keys));
        return ChessAlert.normalizeSettings(data ?? {});
    }
    async function save(settings) {
        const clean = ChessAlert.normalizeSettings(settings);
        // A single key makes changes atomic; an empty list prevents legacy fallback resurrection.
        await api.storage.sync.set({ [KEY]: clean });
        try { await api.storage.local.set({ [KEY]: clean }); return null; }
        catch (_) { return "Saved, but the local backup could not be updated."; }
    }
    async function loadPresets() {
        const data = await api.storage.local.get(PRESETS_KEY);
        return ChessAlert.normalizePresets(Object.prototype.hasOwnProperty.call(data, PRESETS_KEY) ? data[PRESETS_KEY] : ChessAlert.DEFAULT_PRESETS);
    }
    async function savePresets(presets) {
        const clean = ChessAlert.normalizePresets(presets);
        // Presets are independent of live settings and avoid sync's per-item size quota.
        await api.storage.local.set({ [PRESETS_KEY]: clean });
        return clean;
    }
    root.ChessAlertStorage = { api, KEY, PRESETS_KEY, load, save, loadPresets, savePresets };
})(globalThis);
