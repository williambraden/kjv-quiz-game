function renderPlayerInputs() {
    const numPlayers = parseInt(document.getElementById("playersInput").value);
    let inputs = "";

    for (let i = 0; i < numPlayers; i++) {
        const existingName = players[i] ? players[i].name : `Player ${i + 1}`;
        const selectedProfileId = players[i]?.profileId || "";
        const isGuest = !selectedProfileId;
        const profileOptions = [
            `<option value="">Guest / Enter Name</option>`,
            ...availableProfiles.map(profile => `
                <option value="${profile.id}" ${profile.id === selectedProfileId ? "selected" : ""}>
                    ${escapeHTML(profile.name || "Unnamed Profile")}
                </option>
            `)
        ].join("");

        inputs += `
            <div style="margin-bottom:12px; max-width:320px;">
                <label>Player ${i + 1} Profile:</label>
                <select id="playerProfile${i}" onchange="applyLocalProfileToPlayer(${i})" style="width:100%;">
                    ${profileOptions}
                </select>
                <div id="playerNameRow${i}" style="display:${isGuest ? "block" : "none"};">
                    <label>Name:</label>
                    <input type="text" id="playerName${i}" value="${escapeHTML(existingName)}" placeholder="Enter player name" style="width:100%;">
                </div>
            </div>
        `;
    }

    document.getElementById("playerNames").innerHTML = inputs;
}

async function prepareLocalMultiplayerOptions() {
    availableProfiles = await loadAllProfiles();
    renderPlayerInputs();
}

async function applyLocalProfileToPlayer(playerIndex) {
    const select = document.getElementById(`playerProfile${playerIndex}`);
    const profileId = select.value;
    const nameInput = document.getElementById(`playerName${playerIndex}`);
    const nameRow = document.getElementById(`playerNameRow${playerIndex}`);
    const profile = availableProfiles.find(item => item.id === profileId);

    if (!profile) {
        // Guest slot: manual name entry required
        if (nameRow) nameRow.style.display = "block";
        return;
    }

    // Require the profile's PIN before letting it play in local multiplayer
    const pin = prompt(`Enter PIN for ${profile.name}:`);
    if (pin === null) {
        select.value = "";
        if (nameRow) nameRow.style.display = "block";
        return;
    }

    const enteredHash = await hashPIN(pin);
    if (enteredHash !== profile.pinHash) {
        alert("Incorrect PIN.");
        select.value = "";
        if (nameRow) nameRow.style.display = "block";
        return;
    }

    nameInput.value = profile.name || `Player ${playerIndex + 1}`;
    if (nameRow) nameRow.style.display = "none";
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

function resetScores() {
    if (gameMode !== "local-multiplayer") {
        return;
    }

    players.forEach(p => {
        p.points = 0;
        p.correct = 0;
        p.incorrect = 0;
    });
    persistSettings();
    updateScoreboard();

    // Grab the reset button
    const btn = document.getElementById("resetBtn");
    if (btn) {
        const originalText = btn.textContent;

        // Show feedback directly on the button
        btn.textContent = "🔄 Scores reset!";
        btn.style.transition = "opacity 1s"; // smooth fade
        btn.style.opacity = "1"; // ensure visible

        // Start fade after a short delay
        setTimeout(() => {
            btn.style.opacity = "0"; // fade out
        }, 1000); // wait 1 seconds before fading

        // Restore original text and fade back in
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.opacity = "1"; // fade back in
        }, 3000); // total 3 seconds
    }
}

function resetDefaults() {
    // Default starting talents (choose your preferred default)
    const defaultStartingTalents = 3;

    // Reset players back to defaults
    players = [
        {
            name: "Player 1",
            correct: 0,
            incorrect: 0,
            points: 0,
            avgTime: 0,
            totalTime: 0,
            questionsAnswered: 0,
            fastestTime: null,
            talents: {
                starting: defaultStartingTalents,
                current: defaultStartingTalents,
                gained: 0,
                wasted: 0,
                redemptions: 0,
                redemptionsSuccessful: 0
            }
        },
        {
            name: "Player 2",
            correct: 0,
            incorrect: 0,
            points: 0,
            avgTime: 0,
            totalTime: 0,
            questionsAnswered: 0,
            fastestTime: null,
            talents: {
                starting: defaultStartingTalents,
                current: defaultStartingTalents,
                gained: 0,
                wasted: 0,
                redemptions: 0,
                redemptionsSuccessful: 0
            }
        }
    ];

    // Reset quiz/game settings
    quizType = "multiple";
    testament = "both";
    rounds = 3;
    questionCount = 0;
    totalQuestions = players.length * rounds;
    currentPlayerIndex = 0;
    paused = false;

    // Reset timer
    timerLength = 30;
    timeLeft = timerLength;
    clearInterval(timerInterval);
    timerInterval = null;

    timerEnabled = true;
    document.getElementById("timerEnabled").checked = timerEnabled;

    timeBonusEnabled = true;
    document.getElementById("timeBonusCheckbox").checked = true;

    // Reset talents input box
    document.getElementById("talentsInput").value = defaultStartingTalents;

    // Push defaults into the options form
    document.getElementById("roundsInput").value = rounds;
    document.getElementById("roundsOutput").value = rounds;
    document.getElementById("playersInput").value = players.length;
    document.getElementById("playersOutput").value = players.length;
    document.getElementById("quizType").value = quizType;
    document.getElementById("timerInput").value = timerLength;
    document.getElementById("testamentSelect").value = testament;

    // Refresh player name inputs
    renderPlayerInputs();

    // Clear UI
    document.getElementById("quiz").innerHTML = "";
    document.getElementById("result").innerHTML = "";
    document.getElementById("progress").innerHTML = "";
    document.getElementById("controls").innerHTML = "";
    document.getElementById("turn").innerHTML = "";

    // Reset redemption tracking
    if (typeof redemptionAttempted !== "undefined") {
        redemptionAttempted.clear();
    }

    // Update scoreboard
    updateScoreboard();
    persistSettings();

    // Feedback for reset button
    const btn = document.getElementById("resetDefaultsBtn");
    if (btn) {
        const originalText = btn.textContent;
        btn.textContent = "✅ Defaults restored!";
        setTimeout(() => {
            btn.textContent = originalText;
        }, 3000);
    }
}

function endGame() {
    if (gameMode === "single") {
        return endGameSinglePlayer();
    }

    fadeToBlack(() => {

        // Hide scoreboard for full-screen effect
        document.getElementById("scoreboard").style.display = "none";
        document.getElementById("result").innerHTML = "";

        // Sort players by points
        const sorted = [...players].sort((a, b) => b.points - a.points);
        const top = sorted.slice(0, Math.min(3, sorted.length));

        recordLocalMultiplayerStats()
            .then(() => console.log("Local multiplayer stats updated"))
            .catch(err => {
                console.error("Error updating multiplayer stats:", err);
                const notice = document.getElementById("statsSaveNotice");
                if (notice) notice.textContent = "⚠️ Could not save stats for one or more profiles (offline or permission error).";
            });

        // Build the podium container (mobile-friendly)
        document.getElementById("quiz").innerHTML = `
          <h2 style="text-align:center; font-size:2em; margin-bottom:20px;">
            🏆 Final Results 🏆
          </h2>

          <p id="statsSaveNotice" style="text-align:center; color:#b00; font-size:0.85em;"></p>

          <div id="podiumArea" style="
            display:flex;
            justify-content:center;
            align-items:flex-end;
            gap:20px;
            margin-top:30px;
            text-align:center;
            flex-wrap: wrap;        /* ⭐ allows wrapping on small screens */
            max-width: 100%;        /* ⭐ prevents overflow */
          ">
            <div id="bronzeSlot"></div>
            <div id="goldSlot"></div>
            <div id="silverSlot"></div>
          </div>
        `;

        // Cache slot references (fixes appendChild null errors)
        const bronzeSlot = document.getElementById("bronzeSlot");
        const goldSlot   = document.getElementById("goldSlot");
        const silverSlot = document.getElementById("silverSlot");

        document.getElementById("progress").innerHTML = "";
        document.getElementById("turn").innerHTML = "";
        document.getElementById("controls").innerHTML = "";

        // Podium height + color definitions
        const podiumStyles = {
            3: { color: "#9a4d22", height: 120 }, // Bronze
            2: { color: "#aeb7c2", height: 150 }, // Silver
            1: { color: "#f2b705", height: 200 }  // Gold
        };

        const podiumEntries = top.map((p, index) => ({
            player: p,
            place: top.length === 1
                ? 1
                : top.length === 2
                    ? (index === 0 ? 1 : 2)
                    : (index === 0 ? 1 : index === 1 ? 2 : 3)
        })).sort((a, b) => b.place - a.place);

        // Reveal order: 3rd → 2nd → 1st
        podiumEntries.forEach(({ player: p, place }, index) => {

            const podium = podiumStyles[place];

            setTimeout(() => {

                const div = document.createElement("div");
                div.style.position = "relative";
                div.style.width = "min(220px, 90vw)";  // ⭐ mobile-friendly width
                div.style.padding = "20px";
                div.style.borderRadius = "10px";
                div.style.background = podium.color;
                div.style.color = "#000";
                div.style.fontWeight = "bold";
                div.style.boxShadow = "0 0 15px rgba(0,0,0,0.3)";
                div.style.transition = "all 0.8s ease";
                div.style.wordWrap = "break-word";
                div.style.overflow = "visible";
                div.style.display = "flex";
                div.style.flexDirection = "column";
                div.style.justifyContent = "flex-end";
                div.style.textAlign = "center";

                // Entrance animation
                if (place === 3) div.style.transform = "translateX(-150%) scale(0.8)";
                else if (place === 2) div.style.transform = "translateX(150%) scale(0.8)";
                else div.style.transform = "translateY(80px) scale(0.8)";

                // Podium content + base
                div.innerHTML = `
                  <div class="podiumContent">
                    <h3 style="font-size:1.4em; margin-bottom:10px;">
                      ${place === 1 ? "🥇" : place === 2 ? "🥈" : "🥉"} ${p.name}
                    </h3>

                    <p>Points: ${p.points}</p>

                    <p>Accuracy: ${
                      p.correct + p.incorrect > 0
                        ? ((p.correct / (p.correct + p.incorrect)) * 100).toFixed(1)
                        : 0
                    }%</p>

                    <p>Avg Time: ${p.avgTime ? p.avgTime.toFixed(1) : 0}s</p>

                    <p>Fastest Answer: ${
                      p.fastestTime !== null ? p.fastestTime.toFixed(1) + "s" : "—"
                    }</p>
                  </div>

                  <div class="podiumBase" style="
                    width: 100%;
                    height: ${podium.height}px;
                    background: rgba(0,0,0,0.15);
                    border-radius: 0 0 10px 10px;
                    margin-top: 10px;
                  "></div>
                `;

                // Append to correct slot (using cached references)
                if (place === 3) bronzeSlot.appendChild(div);
                if (place === 1) goldSlot.appendChild(div);
                if (place === 2) silverSlot.appendChild(div);

                // Animate into final position
                setTimeout(() => {
                    div.style.transform = "translateX(0) translateY(0) scale(1)";
                }, 50);

                // After last reveal, show buttons
                if (index === top.length - 1) {
                    setTimeout(() => {
                        document.getElementById("controls").innerHTML = `
                          <button onclick="startNewGame()">Play Again</button>
                          <button onclick="backToMenu()">Back to Menu</button>
                        `;
                    }, 1200);
                }

            }, index * 3500);
        });

    });
}

function startNewGame() {
    // Reset question counters
    questionCount = 0;
    currentPlayerIndex = 0;

    // Clear UI
    document.getElementById("result").innerHTML = "";
    document.getElementById("controls").innerHTML = "";
    document.getElementById("quiz").innerHTML = "";

    // Show scoreboard again
    document.getElementById("scoreboard").style.display = "block";

    // Start fresh
    runQuiz();
}
