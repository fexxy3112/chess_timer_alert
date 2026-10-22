/* Real DOM checks against representative layouts, not captured live-site snapshots. */
(function () {
    const fixture = document.getElementById("fixture");
    const result = document.getElementById("result");
    let checks = 0;
    function assert(condition, message) { checks++; if (!condition) throw new Error(message); }
    const settings = { ...ChessAlert.DEFAULTS, username: "alice" };
    const lichess = new URL("https://lichess.org/abcdefgh1234");
    const chess = new URL("https://www.chess.com/game/live/123456");
    try {
        fixture.innerHTML = `<div class="round__app"><div class="ruser-top"><a href="/@/bob">Bob</a></div>
            <div class="rclock-top rclock-black"><div class="time">01:00:00</div></div>
            <div class="ruser-bottom"><a href="/@/alice">Alice</a></div>
            <div class="rclock-bottom rclock-white running"><div class="time">00<sep>:</sep>05<tenths><sep>.</sep>5</tenths></div></div></div>`;
        let game = ChessAlertSites.read(settings, document, lichess);
        assert(game.state === "ready" && game.seconds === 5.5 && game.running, "Lichess nested tenths and username");
        const key = game.key;
        for (const prefix of ["ruser", "rclock"]) {
            const top = fixture.querySelector(`.${prefix}-top`), bottom = fixture.querySelector(`.${prefix}-bottom`);
            top.classList.replace(`${prefix}-top`, `${prefix}-bottom`);
            bottom.classList.replace(`${prefix}-bottom`, `${prefix}-top`);
        }
        game = ChessAlertSites.read(settings, document, lichess);
        assert(game.key === key && game.seconds === 5.5 && game.running, "Flipping does not change player or session");
        game = ChessAlertSites.read({ ...settings, clockColor: "black" }, document, lichess);
        assert(game.seconds === 3600 && !game.running, "Manual color follows color, not screen position");
        game = ChessAlertSites.read({ ...settings, username: "viewer" }, document, lichess);
        assert(game.state === "identity", "Spectators do not get another player's automatic alerts");
        fixture.querySelector(".round__app").insertAdjacentHTML("beforeend", '<div class="result-wrap">1-0</div>');
        assert(ChessAlertSites.read(settings, document, lichess).ended, "Lichess game end");
        fixture.querySelector(".rclock-white .time").textContent = "five seconds";
        fixture.querySelector(".result-wrap").remove();
        assert(ChessAlertSites.read(settings, document, lichess).state === "format", "Unknown formats fail closed");
        fixture.innerHTML = `<div class="board-layout-component"><div id="board-layout-main"></div><div id="board-layout-player">
            <div id="player-top"><a href="/member/alice">Alice</a></div>
            <div class="clock-top clock-black clock-player-turn"><span class="clock-time-monospace">0:04.9</span></div>
            <div id="player-bottom"><a href="/member/bob">Bob</a></div>
            <div class="clock-bottom clock-white"><span class="clock-time-monospace">1:25</span></div></div></div>`;
        game = ChessAlertSites.read(settings, document, chess);
        assert(game.state === "ready" && game.seconds === 4.9 && game.running, "Chess.com top player and nested layout");
        fixture.insertAdjacentHTML("beforeend", '<div class="game-over-component">Game over</div>');
        assert(ChessAlertSites.read(settings, document, chess).ended, "Chess.com game end");
        fixture.innerHTML = '<div class="analysis"><div class="clock-bottom"><span class="clock-time">0:01</span></div></div>';
        assert(ChessAlertSites.read(settings, document, chess).state === "waiting", "Ignore standalone analysis clocks");
        result.textContent = `PASS ${checks} DOM checks`;
    } catch (error) { result.textContent = `FAIL ${error.stack}`; }
    if (location.protocol === "http:" && location.hostname === "127.0.0.1") {
        void fetch("/__result", { method: "POST", body: result.textContent });
    }
})();
