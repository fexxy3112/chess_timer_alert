const saveBtn = document.getElementById("save");
const clearBtn = document.getElementById("clear");
// const testSoundBtn = document.getElementById("testSound");
const status = document.getElementById("status");
const addButton = document.getElementById("addButton");
const table = document.getElementById("alertTable");
const resetAlertInput = document.getElementById("resetAlertWhenTimeIncreases");


function insertRow(thresholdValue = 5.0, amountValue = 1) {
    const newRow = document.createElement("tr");
    newRow.classList.add("data");

    const thresholdCell = document.createElement("td");
    const amountCell = document.createElement("td");

    // Threshold cell
    const thresholdInput = document.createElement("input");
    thresholdInput.type = "number";
    thresholdInput.classList.add("threshold");
    thresholdInput.min = "0.5";
    thresholdInput.step = "0.5";
    thresholdInput.value = thresholdValue;
    thresholdCell.appendChild(thresholdInput);

    // Amount cell
    const amountInput = document.createElement("input");
    amountInput.type = "number";
    amountInput.classList.add("amount");
    amountInput.min = "1";
    amountInput.max = "10";
    amountInput.value = amountValue;
    amountCell.appendChild(amountInput);


    thresholdCell.querySelector('input').addEventListener('change', sortTableByThreshold);
    amountCell.querySelector('input').addEventListener('change', sortTableByThreshold);

    newRow.appendChild(thresholdCell);
    newRow.appendChild(amountCell);

    const addButtonRow = addButton.parentNode;
    const tbody = addButtonRow.parentNode;
    tbody.insertBefore(newRow, addButtonRow);
}

function sortTableByThreshold() {
    const rows = Array.from(table.querySelectorAll("tr.data"));

    rows.sort((a, b) => {
        const aVal = parseFloat(a.querySelector(".threshold").value);
        const bVal = parseFloat(b.querySelector(".threshold").value);
        return bVal - aVal;
    });

    const addButtonRow = addButton.parentNode;
    const tbody = addButtonRow.parentNode;
    rows.forEach(row => tbody.insertBefore(row, addButtonRow));
}

document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.sync.get(["alertSettings", "resetAlertOnTimeIncrease"], (data) => {
        let alerts = (data && data.alertSettings) || null;
        let resetAlerts = data?.resetAlertOnTimeIncrease ?? true;

        if (!alerts || alerts.length === 0) {
            chrome.storage.local.get(["alertSettings", "resetAlertOnTimeIncrease"], (localData) => {
                alerts = (localData && localData.alertSettings) || [];
                let resetAlerts = localData?.resetAlertOnTimeIncrease ?? true;
                alerts.forEach(item => insertRow(item.threshold, item.amount));
                resetAlertInput.checked = resetAlerts;
            });
        } else {
            alerts.forEach(item => insertRow(item.threshold, item.amount));
            resetAlertInput.checked = resetAlerts;
        }
    });
});

saveBtn.addEventListener("click", () => {
    let thresholdInputs = document.querySelectorAll("input.threshold");
    let amountInputs = document.querySelectorAll("input.amount");

    if (amountInputs.length === 0 || thresholdInputs.length === 0) {
        status.textContent = "Please set up at least one threshold.";
        return;
    }

    if (thresholdInputs.length !== amountInputs.length) {
        status.textContent = "An error occurred during saving.";
        return;
    }

    let storageData = [];
    for (let i = 0; i < thresholdInputs.length; i++) {
        storageData.push({
            threshold: parseFloat(thresholdInputs[i].value),
            amount: parseInt(amountInputs[i].value)
        });

    }

    storageData.sort((a, b) => b.threshold - a.threshold);

    chrome.storage.sync.set({
        alertSettings: storageData,
        resetAlertOnTimeIncrease: resetAlertInput.checked
    }, () => {
        chrome.storage.local.set({
            alertSettings: storageData,
            resetAlertOnTimeIncrease: resetAlertInput.checked
        }, () => {
            status.textContent = "Saved! Good Luck!";
            setTimeout(() => {
                status.textContent = "";
            }, 2000);
        });
    });
});

clearBtn.addEventListener("click", () => {
    chrome.storage.sync.remove("alertSettings", () => {
        chrome.storage.local.remove("alertSettings", () => {
            const rows = table.querySelectorAll("tr.data");
            rows.forEach(row => {
                row.remove();
            });
            status.textContent = "Settings reset!";
            setTimeout(() => {
                status.textContent = "";
            }, 2000);
        });
    });
});

// testSoundBtn.addEventListener("click", () => {
//     const audio = new Audio(chrome.runtime.getURL("sounds/alert.wav"));
//     audio.play();
// });

addButton.addEventListener("click",
    () => {
        insertRow();
    }
);
