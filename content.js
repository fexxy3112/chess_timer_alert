function playAlert() {
    const audio = new Audio(chrome.runtime.getURL("sounds/alert.wav"));
    audio.play();
}

function startTimer(alertThresholds, resetAlertOnTimeIncrease) {
    alertThresholds.sort((a, b) => b.threshold - a.threshold);

    const playedAlerts = new Set();
    let alertCounter = 0;
    setInterval(() => {
        let timeText = null;

        // chess.com
        const chessClock = document.querySelector(".clock-bottom .clock-time-monospace");
        if (chessClock) timeText = chessClock.textContent.trim();

        // lichess.org
        const lichessClock = document.querySelector(".rclock-bottom .time");
        if (!timeText && lichessClock) timeText = lichessClock.textContent.trim();

        if (!timeText) return;

        const parts = timeText.split(":").map(Number);
        const seconds = parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];


        if (resetAlertOnTimeIncrease) {
            //Resets alert if the time goes up the threshold
            alertThresholds.forEach(alert => {
                const { threshold, amount } = alert;
                const wasPlayed = playedAlerts.has(threshold);

                if (seconds > 0 && seconds <= threshold && !wasPlayed) {
                    for (let i = 0; i < amount; i++) setTimeout(playAlert, i * 100);
                    playedAlerts.add(threshold);
                } else if (seconds > threshold && wasPlayed) {
                    playedAlerts.delete(threshold);
                }
            });
        } else {
            //Alerts go only down
            const currentAlert = alertThresholds[alertCounter];
            if (!currentAlert) return;

            const { threshold, amount } = currentAlert;
            if (seconds > 0 && seconds <= threshold) {
                for (let i = 0; i < amount; i++) setTimeout(playAlert, i * 100);
                alertCounter++;
            }
        }
    }, 500);
}

chrome.storage.sync.get(["alertSettings","resetAlertOnTimeIncrease"], (data) => {
    let alerts = (data && data.alertSettings) || [];
    let resetAlerts = data?.resetAlertOnTimeIncrease ?? true;

    if (alerts.length === 0) {

        chrome.storage.local.get(["alertSettings","resetAlertOnTimeIncrease"], (localData) => {
            alerts = (localData && localData.alertSettings) || [];
            let resetAlerts = localData?.resetAlertOnTimeIncrease ?? true;

            if (alerts.length > 0) startTimer(alerts,resetAlerts);
        });

    } else {
        startTimer(alerts,resetAlerts);
    }
});
