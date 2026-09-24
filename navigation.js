function showScreen(id) {
    const screens = [
        "profileSelectScreen",
        "profilePinScreen",
        "leaderboardScreen",
        "screenMenu",
        "screenSingleOptions",
        "screenMultiOptions",
        "screenQuiz"
    ];

    screens.forEach(screen => {
        document.getElementById(screen).style.display =
            (screen === id) ? "block" : "none";
    });
}

document.getElementById("singlePlayerBtn").onclick = () => {
    gameMode = "single";
    showScreen("screenSingleOptions");
};

document.getElementById("localMultiplayerBtn").onclick = () => {
    gameMode = "local-multiplayer";
    showScreen("screenMultiOptions");
    prepareLocalMultiplayerOptions();
};

function startMainMenu() {
    showScreen("screenMenu");

    if (window.isDeveloper) {
        let existing = document.getElementById("developerDashboardBtn");
        if (!existing) {
            const btn = document.createElement("button");
            btn.id = "developerDashboardBtn";
            btn.textContent = "Developer Dashboard";
            btn.onclick = showDeveloperDashboard;

            document.getElementById("modeSelector").appendChild(btn);
        }
    }

    updateActiveProfileDisplay();
}
