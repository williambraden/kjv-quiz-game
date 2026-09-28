
window.DEVELOPER_UID = "QANElecfZHe2n1BmtQ39Q7E9bNu1";

window.addEventListener("firebase-ready", async () => {
    const user = window.auth.currentUser;

    // Detect developer login
    if (user && user.uid === window.DEVELOPER_UID) {
        window.isDeveloper = true;
        console.log("Developer mode active");
    } else {
        window.isDeveloper = false;
    }

    // Continue with your normal startup
    const profileId = localStorage.getItem("selectedProfileId");

    // No profile selected → show profile selection
    if (!profileId) {
        showProfileSelection();
        return;
    }

    // Profile selected AND unlocked → go straight to main menu
    if (isProfileUnlocked(profileId)) {
        await finalizeProfileSelection(profileId);
        return;
    }

    // Profile selected BUT not unlocked → show profile selection (NOT PIN)
    showProfileSelection();
});


console.log("SCRIPT LOADED");



// ==============================
// ⚙️ Global Game State
// ==============================

let gameMode = null; 
// "single" or "local-multiplayer"
let singlePlayerSettings = null;
let totalRounds = 3;
let currentRound = 1;

let rounds = 3;
let players = [];                // array of player objects
let currentPlayerIndex = 0;   // multiplayer
let currentPlayer = {};       // single player object
let turnOwner = 0;               // original owner of the turn

let currentVerse = null;         // verse object for current question
let currentBlankWord = null;     // word removed for fill-in-the-blank

let questionCount = 0;
let totalQuestions = 0;

let quizType = "multiple";       // "multiple" or "fill"
let currentRoundType = "multiple";

let testament = "both";          // "old", "new", or "both"

let timerLength = 20;            // seconds per turn
let timeLeft = 0;
let timerInterval = null;
let paused = false;


let redemptionActive = false;
let redemptionAttempted = new Set();


let timerEnabled = true; // default: timer ON
let timeBonusEnabled = true; // default: give time bonus
let redemptionTimer = null;
let redemptionTimeLeft = 0;   // if you use this


let scrambledAlreadyChecked = false;
let currentVerseWords = [];
let currentScrambleAnswer = [];

let sessionUnlockedProfileId = null;
let availableProfiles = [];



// Points are tracked per player object, so this array may not be needed
// but if you want a separate points array, initialize it after players are set

function normalizeLocalPlayers(savedPlayers, startingTalents = 3) {
    return (Array.isArray(savedPlayers) ? savedPlayers : []).map(player => {
        const talents = player.talents || {};
        const starting = Number(talents.starting ?? startingTalents);

        return {
            ...player,
            talents: {
                starting,
                current: Number(talents.current ?? starting),
                gained: Number(talents.gained ?? 0),
                wasted: Number(talents.wasted ?? 0),
                redemptions: Number(talents.redemptions ?? 0),
                redemptionsSuccessful: Number(talents.redemptionsSuccessful ?? 0)
            }
        };
    });
}

window.onload = function() {

  const saved = localStorage.getItem("quizSettings");

  if (saved) {
    const settings = JSON.parse(saved);

    rounds = settings.rounds;
    quizType = settings.quizType;
    timerLength = settings.timerLength;
    players = normalizeLocalPlayers(settings.players, Number(settings.startingTalents ?? 3));
    testament = settings.testament || "both";

    timerEnabled = Boolean(settings.timerEnabled);
    timeBonusEnabled = Boolean(settings.timeBonusEnabled);

    // UI sync
    document.getElementById("testamentSelect").value = testament;
    document.getElementById("roundsInput").value = rounds;
    document.getElementById("roundsOutput").value = rounds;
    document.getElementById("playersInput").value = settings.numPlayers;
    document.getElementById("playersOutput").value = settings.numPlayers;
    document.getElementById("quizType").value = quizType;
    document.getElementById("timerInput").value = timerLength;
    document.getElementById("timerEnabled").checked = timerEnabled;
    document.getElementById("timeBonusCheckbox").checked = timeBonusEnabled;
	
    // ⭐ Restore starting talents safely
    if (settings.startingTalents !== undefined) {
        document.getElementById("talentsInput").value = settings.startingTalents;
    }

    renderPlayerInputs();
    settings.players.forEach((p, i) => {
      document.getElementById(`playerName${i}`).value = p.name;
    });

    updateScoreboard();
  } 
  else {
    // Defaults
    rounds = 3;
    quizType = "mixed";
    timerLength = 30;
        players = normalizeLocalPlayers([
            { name: "Player 1", correct: 0, incorrect: 0, points: 0 }
        ]);
    testament = "both";
    timerEnabled = true;
    timeBonusEnabled = true;

    // UI sync
    document.getElementById("roundsInput").value = rounds;
    document.getElementById("playersInput").value = players.length;
    document.getElementById("quizType").value = quizType;
    document.getElementById("timerInput").value = timerLength;
    document.getElementById("testamentSelect").value = testament;
    document.getElementById("timerEnabled").checked = timerEnabled;
    document.getElementById("timeBonusCheckbox").checked = timeBonusEnabled;

    // ⭐ Set default starting talents explicitly
    document.getElementById("talentsInput").value = 3; // or whatever your default is

    renderPlayerInputs();
    updateScoreboard();
    persistSettings();
  }
};

window.addEventListener("DOMContentLoaded", () => {
    const rounds = parseInt(document.getElementById("roundsInput").value);
    const talentsSlider = document.getElementById("talentsInput");
    const talentsOutput = document.getElementById("talentsOutput");

    const newMax = Math.min(10, rounds);
    talentsSlider.max = newMax;
    talentsSlider.value = Math.min(talentsSlider.value, newMax);
    talentsOutput.value = talentsSlider.value;
});


function continueGame() {

  const saved = localStorage.getItem("quizSettings");
  if (saved) {
    const settings = JSON.parse(saved);

    rounds = settings.rounds;
    quizType = settings.quizType;
    timerLength = settings.timerLength;
    players = normalizeLocalPlayers(settings.players, Number(settings.startingTalents ?? 3));
    testament = settings.testament;

    timerEnabled = Boolean(settings.timerEnabled);
    timeBonusEnabled = Boolean(settings.timeBonusEnabled);

    document.getElementById("timerEnabled").checked = timerEnabled;
    document.getElementById("timeBonusCheckbox").checked = timeBonusEnabled;
	
	if (settings.startingTalents !== undefined) {
    document.getElementById("talentsInput").value = settings.startingTalents;
	}


    document.getElementById("menu").style.display = "none";
    document.getElementById("localMultiplayerOptions").style.display = "none";
    document.getElementById("quizArea").style.display = "block";

	currentPlayerIndex = 0;
    questionCount = 0;
    totalQuestions = rounds * players.length;

    updateScoreboard();
    runQuiz();
  }
}

document.getElementById("roundsInput").addEventListener("input", function () {
    const rounds = parseInt(this.value);

    // Update rounds display
    document.getElementById("roundsOutput").value = rounds;

    // Update talents max
    const talentsSlider = document.getElementById("talentsInput");
    const talentsOutput = document.getElementById("talentsOutput");

    const newMax = Math.min(10, rounds);
    talentsSlider.max = newMax;

    // ⭐ Force the slider to visually clamp immediately
    talentsSlider.value = Math.min(parseInt(talentsSlider.value), newMax);
	
	talentsSlider.dispatchEvent(new Event("input"));

    // Update the displayed value
    talentsOutput.value = talentsSlider.value;
});

function backToMenu() {
    showScreen("screenMenu");
	  // Show scoreboard again
  document.getElementById("scoreboard").style.display = "block";
}



