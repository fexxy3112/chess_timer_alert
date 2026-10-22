/* Site integration; pure settings and threshold logic live in core.js. */
(function () {
    "use strict";
    const { api, load, KEY } = ChessAlertStorage;
    const engine = new ChessAlert.AlertEngine();
    let settings = engine.settings, observer, interval, scheduled = false, loadVersion = 0;
    let session = new ChessAlert.GameSession(), soundError = "", retryAt = 0;
    let audio = null, soundGeneration = 0;
    let status = { state: "loading", message: "Loading settings…" };

    function cancelSound() {
        soundGeneration++;
        if (audio) { audio.pause(); audio.src = ""; audio = null; }
    }
    async function playSeries(alert) {
        cancelSound();
        const generation = soundGeneration;
        try {
            for (let i = 0; i < alert.amount && generation === soundGeneration; i++) {
                const current = new Audio(api.runtime.getURL("sounds/alert.wav"));
                audio = current;
                const ended = new Promise((resolve, reject) => {
                    current.onended = resolve;
                    current.onerror = () => reject(new Error("Audio resource unavailable"));
                    current.onabort = resolve;
                    current.onemptied = resolve;
                });
                ended.catch(() => {});
                await current.play();
                if (generation !== soundGeneration) { current.pause(); return; }
                soundError = "";
                await ended;
                if (generation === soundGeneration) audio = null;
            }
        } catch (_) {
            if (generation !== soundGeneration) return;
            soundError = "Sound blocked or unavailable. Allow site audio and use Test sound.";
            engine.retry(alert);
            retryAt = Date.now() + 5000;
        }
    }


    function check() {
        scheduled = false;
        if (!settings.enabled || !settings.alertSettings.length) {
            cancelSound();
            status = { state: "disabled", message: "Alerts disabled. Save at least one threshold and enable alerts." };
            return;
        }
        const game = ChessAlertSites.read(settings, document, location);
        if (session.update(game)) {
            cancelSound(); engine.reset();
        }
        status = { state: game.state, message: soundError || game.message };
        if (game.state !== "ready" || !game.active || game.seconds === 0) { cancelSound(); return; }
        if (!game.running) cancelSound();
        if (Date.now() < retryAt) return;
        const alert = engine.sample(game.seconds, game.running);
        if (alert) void playSeries(alert);
    }
    function schedule() {
        if (!scheduled) {
            scheduled = true;
            queueMicrotask(() => { scheduled = false; if (observer) check(); });
        }
    }
    function stop() {
        observer?.disconnect(); observer = null;
        clearInterval(interval); interval = null;
        cancelSound();
    }
    function start() {
        if (!settings.enabled || !settings.alertSettings.length) { check(); return; }
        observer = new MutationObserver(schedule);
        observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true,
            attributes: true, attributeFilter: ["class", "data-game-id"] });
        // Fallback also notices URL changes without a DOM mutation.
        interval = setInterval(check, 250);
        check();
    }
    async function reload() {
        const version = ++loadVersion;
        try {
            const next = await load();
            if (version !== loadVersion) return;
            if (JSON.stringify(next) === JSON.stringify(settings) && interval) return;
            stop(); settings = next; engine.configure(next); soundError = ""; retryAt = 0;
            session = new ChessAlert.GameSession(); start();
        } catch (error) {
            if (version !== loadVersion) return;
            stop();
            status = { state: "error", message: `Settings unavailable: ${error.message}` };
        }
    }
    api.storage.onChanged.addListener((changes, area) => {
        if (["sync", "local"].includes(area) && [KEY, "alertSettings", "resetAlertOnTimeIncrease"].some(k => k in changes)) void reload();
    });
    api.runtime.onMessage.addListener(message => {
        if (message?.type === "chess-alert-status") return Promise.resolve(status);
        return undefined;
    });
    window.addEventListener("pagehide", stop);
    window.addEventListener("pageshow", event => { if (event.persisted) void reload(); });
    void reload();
})();
