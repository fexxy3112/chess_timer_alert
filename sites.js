(function (root) {
    "use strict";
    const visible = element => element && element.getClientRects().length > 0;
    const queryVisible = (root, selector) => Array.from(root.querySelectorAll(selector)).find(visible);
    function usernameFromLink(link, location) {
        if (!link) return "";
        try {
            const path = new URL(link.getAttribute("href"), location.href).pathname;
            return decodeURIComponent(path.match(/\/(?:@|member)\/([^/]+)/i)?.[1] || "").toLowerCase();
        } catch (_) { return ""; }
    }
    function clockColor(clock, site) {
        if (clock.classList.contains(site === "lichess" ? "rclock-white" : "clock-white")) return "white";
        if (clock.classList.contains(site === "lichess" ? "rclock-black" : "clock-black")) return "black";
        return null;
    }
    function read(settings, document, location) {
        const lichess = location.hostname === "lichess.org";
        const site = lichess ? "lichess" : "chess";
        // Deliberately exclude analysis boards and standalone clock widgets.
        const root = lichess ? document.querySelector(".round__app") :
            Array.from(document.querySelectorAll("#board-layout-main, .board-layout-main, #board-layout-player, .board-layout-player, .board-layout-component"))
                .find(candidate => candidate.querySelector(".clock-top") && candidate.querySelector(".clock-bottom"));
        if (!root) return { state: "waiting", message: "Waiting for a live game." };
        const clocks = ["top", "bottom"].map(position => {
            const clock = queryVisible(root, lichess ? `.rclock-${position}` : `.clock-${position}`);
            if (!clock) return null;
            const userRoot = queryVisible(document, lichess ? `.ruser-${position}` : `#player-${position}, .player-${position}`);
            const link = userRoot?.querySelector(lichess ? 'a[href^="/@/"]' : 'a[href*="/member/"]');
            return { clock, position, color: clockColor(clock, site), user: usernameFromLink(link, location) };
        }).filter(Boolean);
        if (clocks.length !== 2) return { state: "missing", message: "Game clocks not detected. The site layout may have changed." };
        const account = settings.username.toLowerCase() || (lichess ?
            document.querySelector("#user_tag")?.textContent.trim().toLowerCase() :
            usernameFromLink(document.querySelector('a[data-test-element="user-menu-profile"], #navigation-profile'), location));
        const selected = settings.clockColor === "auto" ? clocks.find(c => account && c.user === account) :
            clocks.find(c => c.color === settings.clockColor);
        if (!selected) return { state: "identity", message: "Your clock is not identified. Enter your username or select your color in settings." };
        const ended = !!queryVisible(document, lichess ? ".round__app .result-wrap" :
            ".game-over-modal, .game-over-component, [data-game-status='finished']");
        const runningClass = lichess ? "running" : "clock-player-turn";
        const active = clocks.some(c => c.clock.classList.contains(runningClass));
        const timeNode = selected.clock.querySelector(lichess ? ".time" : ".clock-time-monospace, .clock-time, [data-test-element='clock-time']");
        const seconds = ChessAlert.parseTime(timeNode?.textContent);
        const gameId = root.getAttribute("data-game-id") || document.querySelector("[data-game-id]")?.getAttribute("data-game-id") || "";
        const key = [location.origin, location.pathname, gameId,
            clocks.map(c => `${c.color}:${c.user}`).sort().join("|"), selected.color || selected.user].join(":");
        const times = [...clocks].sort((a, b) => (a.color || a.position).localeCompare(b.color || b.position))
            .map(c => ChessAlert.parseTime(c.clock.querySelector(lichess ? ".time" : ".clock-time-monospace, .clock-time, [data-test-element='clock-time']")?.textContent));
        // Lichess obfuscates move tag names; navigation ply attributes are more stable.
        const moves = lichess ? Math.max(0, ...Array.from(root.querySelectorAll("[data-ply]"),
            element => Number(element.getAttribute("data-ply")) || 0)) :
            document.querySelectorAll(".vertical-move-list .node").length;
        return { key, seconds, ended, active, times, moves, running: selected.clock.classList.contains(runningClass),
            state: ended ? "ended" : seconds === null ? "format" : "ready",
            message: ended ? "Game finished." : seconds === null ? "Unsupported clock format (including verbal accessibility clocks)." :
                `Clock detected${selected.color ? `: ${selected.color}` : ""}${selected.clock.classList.contains(runningClass) ? ". Your turn." : ". Waiting for your turn."}` };
    }

    root.ChessAlertSites = { read };
})(globalThis);
