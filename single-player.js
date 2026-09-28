async function startSinglePlayerGame() {
    const profileId = localStorage.getItem("selectedProfileId");
    let profile = null;

    try {
        const savedProfile = localStorage.getItem("selectedProfile");
        profile = savedProfile ? JSON.parse(savedProfile) : null;
    } catch (error) {
        console.warn("Saved profile data was not valid JSON.", error);
    }

    if (!profile && profileId) {
        profile = await loadProfile(profileId);
    }

    if (!profile) {
        alert("Please select a valid profile before starting a game.");
        showProfileSelection();
        return;
    }

    const name = profile.name || "Player";
    const rounds = parseInt(document.getElementById("singlePlayerRoundsInput").value);
    const quizTypeUI = document.getElementById("singlePlayerQuizType").value;
    const testamentUI = document.getElementById("singlePlayerTestament").value;
    const timerEnabledUI = document.getElementById("singlePlayerTimerToggle").checked;
    const timeBonusUI = document.getElementById("singlePlayerTimeBonus").checked;
    const timerLengthUI = parseInt(document.getElementById("singlePlayerTimerLength").value);

    singlePlayerSettings = {
        name,
        rounds,
        quizType: quizTypeUI,
        testament: testamentUI,
        timerEnabled: timerEnabledUI,
        timeBonus: timeBonusUI,
        timerLength: timerLengthUI
    };

    currentPlayer = {
        name,
        profileId: profile.id || profileId,
        points: 0,
        correct: 0,
        incorrect: 0,
        avgTime: 0,
        totalTime: 0,
        questionsAnswered: 0,
        fastestTime: null
    };

    totalRounds = rounds;
    currentRound = 1;
    quizType = quizTypeUI;
    testament = testamentUI;
    timerEnabled = timerEnabledUI;
    timeBonusEnabled = timeBonusUI;
    timerLength = timerLengthUI;

    gameMode = "single";
    showScreen("screenQuiz");
    startTrivia();
}

function endGameSinglePlayer() {

    fadeToBlack(() => {

        // Hide scoreboard for full-screen effect
        document.getElementById("scoreboard").style.display = "none";
        document.getElementById("result").innerHTML = "";
        document.getElementById("controls").innerHTML = "";
        document.getElementById("progress").innerHTML = "";
        document.getElementById("turn").innerHTML = "";

        const p = currentPlayer;

        // Gather round stats
        const roundStats = {
            correct: p.correct,
            incorrect: p.incorrect,
            fastestTime: p.fastestTime,
            averageTime: p.avgTime,
            streakBest: p.bestStreak || 0,
            points: p.points
        };

        // Load selected profile
        const profileId = localStorage.getItem("selectedProfileId");
        if (profileId) {
            loadProfile(profileId).then(profile => {
                if (profile) {
                    const lifetime = profile.lifetimeStats;

                    const gameScore = p.points || 0;
                    const previousGames = lifetime.gamesPlayed || 0;
                    const nextGames = previousGames + 1;
                    const previousScoreTotal = lifetime.totalPoints || 0;
                    const previousAverage = lifetime.averageScore || 0;

                    const updatedStats = {
                        gamesPlayed: nextGames,
                        wins: (lifetime.wins || 0) + (gameScore > 0 ? 1 : 0),
                        losses: (lifetime.losses || 0) + (gameScore <= 0 ? 1 : 0),
                        correct: (lifetime.correct || 0) + roundStats.correct,
                        incorrect: (lifetime.incorrect || 0) + roundStats.incorrect,
                        totalPoints: previousScoreTotal + gameScore,
                        bestScore: Math.max(lifetime.bestScore || 0, gameScore),
                        averageScore:
                            nextGames === 1
                                ? gameScore
                                : ((previousAverage * previousGames) + gameScore) / nextGames,
                        fastestCorrectAnswer:
                            lifetime.fastestCorrectAnswer === null || lifetime.fastestCorrectAnswer === undefined
                                ? (p.fastestTime !== null && p.fastestTime !== undefined ? p.fastestTime : null)
                                : (p.fastestTime !== null && p.fastestTime !== undefined
                                    ? Math.min(lifetime.fastestCorrectAnswer, p.fastestTime)
                                    : lifetime.fastestCorrectAnswer),
                        fastestTime:
                            lifetime.fastestTime === null || lifetime.fastestTime === undefined
                                ? roundStats.fastestTime
                                : Math.min(lifetime.fastestTime, roundStats.fastestTime),
                        averageTime:
                            lifetime.averageTime === null || lifetime.averageTime === undefined
                                ? roundStats.averageTime
                                : (lifetime.averageTime + roundStats.averageTime) / 2,
                        streakBest: Math.max(lifetime.streakBest || 0, roundStats.streakBest || 0),
                        booksCompleted: Array.isArray(lifetime.booksCompleted) ? lifetime.booksCompleted : [],
                        achievementsUnlocked: Array.isArray(lifetime.achievementsUnlocked) ? lifetime.achievementsUnlocked : []
                    };

                    updateLifetimeStats(profileId, updatedStats)
                        .then(() => console.log("Lifetime stats updated"))
                        .catch(err => {
                            console.error("Error updating stats:", err);
                            const notice = document.getElementById("statsSaveNotice");
                            if (notice) notice.textContent = "⚠️ Could not save stats to your profile (offline or permission error).";
                        });
                }
            });
        }

        // Build the single-player results screen
        const accuracy = (p.correct + p.incorrect > 0)
            ? ((p.correct / (p.correct + p.incorrect)) * 100).toFixed(1)
            : 0;

        const fastest = p.fastestTime !== null
            ? p.fastestTime.toFixed(1) + "s"
            : "—";

        const avg = p.avgTime
            ? p.avgTime.toFixed(1) + "s"
            : "0s";

        document.getElementById("quiz").innerHTML = `
            <h2 style="text-align:center; font-size:2em; margin-bottom:20px;">
                🏆 Final Results 🏆
            </h2>

            <div style="
                max-width:500px;
                margin:0 auto;
                padding:20px;
                background:#f7f7f7;
                border-radius:10px;
                box-shadow:0 0 15px rgba(0,0,0,0.2);
                text-align:center;
            ">
                <h3>${p.name}</h3>

                <p><strong>Points:</strong> ${p.points}</p>
                <p><strong>Correct:</strong> ${p.correct}</p>
                <p><strong>Incorrect:</strong> ${p.incorrect}</p>
                <p><strong>Accuracy:</strong> ${accuracy}%</p>
                <p><strong>Average Time:</strong> ${avg}</p>
                <p><strong>Fastest Answer:</strong> ${fastest}</p>
                <p id="statsSaveNotice" style="color:#b00; font-size:0.85em;"></p>
            </div>
        `;

        document.getElementById("controls").innerHTML = `
            <button onclick="startNewGame()">Play Again</button>
            <button onclick="backToMenu()">Back to Menu</button>
        `;
    });
}
