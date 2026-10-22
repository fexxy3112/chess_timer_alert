/* Shared, dependency-free settings and threshold logic. */
(function (root) {
    "use strict";
    const DEFAULTS = { alertSettings: [], enabled: true, resetAlertOnTimeIncrease: true, clockColor: "auto", username: "" };
    const PRESET = [{ threshold: 30, amount: 1 }, { threshold: 10, amount: 2 }, { threshold: 5, amount: 3 }];
    const DEFAULT_PRESETS = [
        { id: "default-30-15-5", name: "30 / 15 / 5 s", alerts: [{ threshold: 30, amount: 1 }, { threshold: 15, amount: 2 }, { threshold: 5, amount: 3 }] },
        { id: "default-30-10-5", name: "30 / 10 / 5 s", alerts: PRESET }
    ];
    function normalizePresets(presets) {
        if (!Array.isArray(presets) || presets.length > 50) throw new Error("Use at most 50 presets.");
        const ids = new Set(), names = new Set();
        return presets.map(preset => {
            if (!preset || typeof preset.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(preset.id) || ids.has(preset.id))
                throw new Error("Preset identifiers must be unique.");
            const name = typeof preset.name === "string" ? preset.name.trim() : "";
            if (!name || name.length > 60) throw new Error("Enter a preset name from 1 to 60 characters.");
            const normalizedName = name.toLowerCase();
            if (names.has(normalizedName)) throw new Error("A preset with this name already exists.");
            const alerts = validateAlerts(preset.alerts);
            if (!alerts.length) throw new Error("A preset needs at least one alert.");
            ids.add(preset.id); names.add(normalizedName);
            return { id: preset.id, name, alerts };
        });
    }
    function validateAlerts(alerts) {
        if (!Array.isArray(alerts) || alerts.length > 50) throw new Error("Use at most 50 thresholds.");
        const seen = new Set();
        return alerts.map((alert, index) => {
            const { threshold, amount } = alert || {};
            if (!Number.isFinite(threshold) || threshold < 0.5 || threshold > 86400 || threshold * 2 % 1 !== 0)
                throw new Error(`Row ${index + 1}: enter seconds from 0.5 to 86400, in steps of 0.5.`);
            if (!Number.isInteger(amount) || amount < 1 || amount > 10) throw new Error(`Row ${index + 1}: enter 1–10 sounds.`);
            if (seen.has(threshold)) throw new Error(`Row ${index + 1}: duplicate threshold ${threshold}.`);
            seen.add(threshold);
            return { threshold, amount };
        }).sort((a, b) => b.threshold - a.threshold);
    }
    function normalizeSettings(value = {}) {
        return { ...DEFAULTS, alertSettings: validateAlerts(value.alertSettings ?? []), enabled: value.enabled !== false,
            resetAlertOnTimeIncrease: value.resetAlertOnTimeIncrease !== false,
            clockColor: ["auto", "white", "black"].includes(value.clockColor) ? value.clockColor : "auto",
            username: typeof value.username === "string" ? value.username.trim().slice(0, 100) : "" };
    }
    function parseTime(text) {
        if (typeof text !== "string") return null;
        const clean = text.replace(/[\s\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(",", ".");
        if (!/^\d+(?::\d{1,2}){0,2}(?:\.\d{1,3})?$/.test(clean)) return null;
        const parts = clean.split(":").map(Number);
        if (parts.slice(1).some(n => n >= 60)) return null;
        const seconds = parts.reduce((total, n) => total * 60 + n, 0);
        return Number.isFinite(seconds) ? seconds : null;
    }
    class AlertEngine {
        constructor(settings = DEFAULTS) { this.configure(settings); }
        configure(settings) { this.settings = normalizeSettings(settings); this.reset(); }
        reset() { this.played = new Set(); }
        sample(seconds, running = true) {
            if (!this.settings.enabled || !Number.isFinite(seconds) || seconds < 0) return null;
            if (this.settings.resetAlertOnTimeIncrease) {
                for (const a of this.settings.alertSettings) if (seconds > a.threshold) this.played.delete(a.threshold);
            }
            if (!running || seconds === 0) return null;
            const reached = this.settings.alertSettings.filter(a => seconds <= a.threshold && !this.played.has(a.threshold));
            if (!reached.length) return null;
            // Consume skipped thresholds, but play only the most urgent series.
            reached.forEach(a => this.played.add(a.threshold));
            return reached[reached.length - 1];
        }
        retry(alert) { this.played.delete(alert.threshold); }
    }
    class GameSession {
        constructor() { this.key = null; this.ended = false; this.last = null; this.pendingReset = null; }
        update(game) {
            if (!game.key) return false;
            // A move-list reset plus BOTH clocks rising distinguishes a rematch from an increment.
            if (this.last?.moves > 1 && game.moves <= 1) this.pendingReset = this.last;
            if (game.moves > 1) this.pendingReset = null;
            const resetBoard = this.pendingReset && game.moves <= 1 &&
                game.times?.length === 2 && game.times.every((t, i) => Number.isFinite(t) &&
                    Number.isFinite(this.pendingReset.times?.[i]) && t > this.pendingReset.times[i] + 2);
            const changed = game.key !== this.key || (this.ended && !game.ended && game.active) || !!resetBoard;
            if (changed) { this.key = game.key; this.ended = false; this.pendingReset = null; }
            if (game.ended) this.ended = true;
            this.last = game;
            return changed;
        }
    }
    const api = { DEFAULTS, PRESET, DEFAULT_PRESETS, normalizePresets, validateAlerts, normalizeSettings, parseTime, AlertEngine, GameSession };
    root.ChessAlert = api;
    if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
