// Only loaded by the local browser test server, never packaged in the extension.
(function () {
    const state = { chessAlertSettings: { alertSettings: [], enabled: false } };
    if (new URLSearchParams(location.search).has('layout')) {
        state.chessAlertSettings = { enabled: true, alertSettings: [
            { threshold: 30, amount: 1 }, { threshold: 15, amount: 2 }, { threshold: 5, amount: 3 }
        ] };
    }
    window.__writes = [];
    const local = {};
    window.__local = local;
    window.__presetWrites = [];
    window.__failPresetWrite = false;
    window.browser = {
        storage: {
            sync: { get: async () => structuredClone(state), set: async value => {
                Object.assign(state, structuredClone(value)); window.__writes.push(structuredClone(value));
            } },
            local: { get: async () => structuredClone(local), set: async value => {
                if ('chessAlertPresets' in value && window.__failPresetWrite) throw new Error('Preset storage unavailable');
                Object.assign(local, structuredClone(value));
                if ('chessAlertPresets' in value) window.__presetWrites.push(structuredClone(value));
            } }
        },
        runtime: { getURL: path => '/' + path },
        tabs: { query: async () => [{ id: 1, url: 'https://lichess.org/abcdefgh' }],
            sendMessage: async () => ({ state: 'ready', message: 'Clock detected: white. Your turn.' }) }
    };
})();
