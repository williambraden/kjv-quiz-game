function renderPlayerInputs() {
    const numPlayers = parseInt(document.getElementById("playersInput").value);
    let inputs = "";

    for (let i = 0; i < numPlayers; i++) {
        const existingName = players[i] ? players[i].name : `Player ${i + 1}`;
        const selectedProfileId = players[i]?.profileId || "";
        const profileOptions = [
            `<option value="">Guest / Enter Name</option>`,
            ...availableProfiles.map(profile => `
                <option value="${profile.id}" ${profile.id === selectedProfileId ? "selected" : ""}>
                    ${escapeHTML(profile.name || "Unnamed Profile")}
                </option>
            `)
        ].join("");

        inputs += `
            <div style="margin-bottom:12px;">
                <label>Player ${i + 1} Profile:</label>
                <select id="playerProfile${i}" onchange="applyLocalProfileToPlayer(${i})" style="width:100%;">
                    ${profileOptions}
                </select>
                <label>Name:</label>
                <input type="text" id="playerName${i}" value="${escapeHTML(existingName)}" placeholder="Enter player name" style="width:100%;">
            </div>
        `;
    }

    document.getElementById("playerNames").innerHTML = inputs;
}

async function prepareLocalMultiplayerOptions() {
    availableProfiles = await loadAllProfiles();
    renderPlayerInputs();
}

function applyLocalProfileToPlayer(playerIndex) {
    const profileId = document.getElementById(`playerProfile${playerIndex}`).value;
    const nameInput = document.getElementById(`playerName${playerIndex}`);
    const profile = availableProfiles.find(item => item.id === profileId);

    if (profile) {
        nameInput.value = profile.name || `Player ${playerIndex + 1}`;
    }
}

function saveOptions() {
    console.log("Checkbox state at saveOptions:", document.getElementById("timerEnabled").checked);

    rounds = parseInt(document.getElementById("roundsInput").value);
    const numPlayers = parseInt(document.getElementById("playersInput").value);
    quizType = document.getElementById("quizType").value;
    timerLength = parseInt(document.getElementById("timerInput").value);
    testament = document.getElementById("testamentSelect").value;
    timerEnabled = document.getElementById("timerEnabled").checked;
    timeBonusEnabled = document.getElementById("timeBonusCheckbox").checked;
    const startingTalents = parseInt(document.getElementById("talentsInput").value);

    const newPlayers = [];
    for (let i = 0; i < numPlayers; i++) {
        const name = document.getElementById(`playerName${i}`).value || `Player ${i + 1}`;
        const profileId = document.getElementById(`playerProfile${i}`)?.value || null;

        if (players[i]) {
            newPlayers.push({
                name,
                profileId,
                correct: players[i].correct,
                incorrect: players[i].incorrect,
                points: players[i].points,
                avgTime: players[i].avgTime || 0,
                totalTime: players[i].totalTime || 0,
                questionsAnswered: players[i].questionsAnswered || 0,
                fastestTime: players[i].fastestTime || null,
                talents: players[i].talents || {
                    starting: startingTalents,
                    current: startingTalents,
                    gained: 0,
                    wasted: 0,
                    redemptions: 0,
                    redemptionsSuccessful: 0
                }
            });
        } else {
            newPlayers.push({
                name,
                profileId,
                correct: 0,
                incorrect: 0,
                points: 0,
                avgTime: 0,
                totalTime: 0,
                questionsAnswered: 0,
                fastestTime: null,
                talents: {
                    starting: startingTalents,
                    current: startingTalents,
                    gained: 0,
                    wasted: 0,
                    redemptions: 0,
                    redemptionsSuccessful: 0
                }
            });
        }
    }

    players = newPlayers;
    updateScoreboard();
    persistSettings();
}

async function startLocalMultiplayerGame() {
    console.log("Starting Local Multiplayer Game...");

    const numPlayers = parseInt(document.getElementById("playersInput").value);
    const startingTalents = parseInt(document.getElementById("talentsInput").value);

    if (availableProfiles.length === 0) {
        availableProfiles = await loadAllProfiles();
    }

    players = [];
    for (let i = 0; i < numPlayers; i++) {
        const nameField = document.getElementById(`playerName${i}`);
        const profileId = document.getElementById(`playerProfile${i}`)?.value || null;
        const selectedProfile = availableProfiles.find(profile => profile.id === profileId);
        const enteredName = nameField ? nameField.value.trim() : "";
        const name = selectedProfile?.name || enteredName;

        if (!name) {
            alert(`Player ${i + 1} must have a name.`);
            return;
        }

        players.push({
            name,
            profileId,
            points: 0,
            correct: 0,
            incorrect: 0,
            avgTime: 0,
            totalTime: 0,
            questionsAnswered: 0,
            fastestTime: null,
            talents: {
                starting: startingTalents,
                current: startingTalents,
                gained: 0,
                wasted: 0,
                redemptions: 0,
                redemptionsSuccessful: 0
            }
        });
    }

    totalRounds = parseInt(document.getElementById("roundsInput").value);
    currentRound = 1;
    quizType = document.getElementById("quizType").value;
    testament = document.getElementById("testamentSelect").value;
    timerEnabled = document.getElementById("timerEnabled").checked;
    timeBonusEnabled = document.getElementById("timeBonusCheckbox").checked;
    timerLength = parseInt(document.getElementById("timerInput").value);

    showScreen("screenQuiz");
    currentPlayerIndex = 0;
    startTrivia();
}

function persistSettings() {
    localStorage.setItem("quizSettings", JSON.stringify({
        rounds,
        numPlayers: players.length,
        quizType,
        timerLength,
        players,
        testament,
        timerEnabled,
        timeBonusEnabled,
        startingTalents: parseInt(document.getElementById("talentsInput").value)
    }));
}
