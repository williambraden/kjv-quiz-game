// ==============================
// 📚 Bible Book Lists
// ==============================

console.log("SCRIPT LOADED");

const books = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth",
  "1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther",
  "Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations",
  "Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah",
  "Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians",
  "2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians",
  "1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John",
  "3 John","Jude","Revelation"
];

const oldTestamentBooks = [
  "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth",
  "1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther",
  "Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations",
  "Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah",
  "Haggai","Zechariah","Malachi"
];

const newTestamentBooks = [
  "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians",
  "2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians",
  "1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John",
  "3 John","Jude","Revelation"
];



// ==============================
// ⚙️ Global Game State
// ==============================

let gameMode = null; 
// "single" or "local-multiplayer"


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



// Points are tracked per player object, so this array may not be needed
// but if you want a separate points array, initialize it after players are set

window.onload = function() {

  const saved = localStorage.getItem("quizSettings");

  if (saved) {
    const settings = JSON.parse(saved);

    rounds = settings.rounds;
    quizType = settings.quizType;
    timerLength = settings.timerLength;
    players = settings.players;
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
    players = [{ name: "Player 1", correct: 0, incorrect: 0, points: 0 }];
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
    players = settings.players;
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

function showScreen(id) {
    const screens = [
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
};



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




    function renderPlayerInputs() {

   const numPlayers = parseInt(document.getElementById("playersInput").value);
   let inputs = "";
   for (let i = 0; i < numPlayers; i++) {
       // If players[i] exists, use its name. Otherwise default to "Player X"
       const existingName = players[i] ? players[i].name : `Player ${i+1}`;
       inputs += `
<label>
               Player ${i+1} Name:
<input type="text" id="playerName${i}" value="${existingName}">
</label><br>
       `;
   }
   document.getElementById("playerNames").innerHTML = inputs;
}

function saveSinglePlayerOptions() {
    console.log("Saving Single Player Options...");

    // Read values from the UI
    const name = document.getElementById("singlePlayerName").value.trim();
    const rounds = parseInt(document.getElementById("singlePlayerRoundsInput").value);
    const quizType = document.getElementById("singlePlayerQuizType").value;
    const testament = document.getElementById("singlePlayerTestament").value;
    const timerEnabled = document.getElementById("singlePlayerTimerToggle").checked;
    const timeBonus = document.getElementById("singlePlayerTimeBonus").checked;
    const timerLength = parseInt(document.getElementById("singlePlayerTimerLength").value);

    // Basic validation
    if (!name) {
        alert("Please enter a player name.");
        return;
    }

    // Store in global variables (you can adjust these names if needed)
    window.singlePlayerSettings = {
        name,
        rounds,
        quizType,
        testament,
        timerEnabled,
        timeBonus,
        timerLength
    };

    console.log("Single Player Settings Saved:", window.singlePlayerSettings);

    alert("Settings saved!");
}

function startSinglePlayerGame() {
    if (!window.singlePlayerSettings) {
        alert("Please save your settings first.");
        return;
    }

    console.log("Starting Single Player Game...");
	showScreen("screenQuiz");
    // Initialize player object
    window.currentPlayer = {
        name: window.singlePlayerSettings.name,
        score: 0,
        correct: 0,
        incorrect: 0,
        fastest: null
    };

    // Set rounds, timer, etc.
    totalRounds = window.singlePlayerSettings.rounds;
    currentRound = 1;
    quizType = window.singlePlayerSettings.quizType;
    testament = window.singlePlayerSettings.testament;
    timerEnabled = window.singlePlayerSettings.timerEnabled;
    timeBonusEnabled = window.singlePlayerSettings.timeBonus;
    timerLength = window.singlePlayerSettings.timerLength;

    // Start the first question
    startTrivia();
}


function saveOptions() {

  console.log("Checkbox state at saveOptions:", document.getElementById("timerEnabled").checked);

  // Read UI values
	rounds = parseInt(document.getElementById("roundsInput").value);
	const numPlayers = parseInt(document.getElementById("playersInput").value);
	quizType = document.getElementById("quizType").value;
	timerLength = parseInt(document.getElementById("timerInput").value);
	testament = document.getElementById("testamentSelect").value;

	timerEnabled = document.getElementById("timerEnabled").checked;
	timeBonusEnabled = document.getElementById("timeBonusCheckbox").checked;
	const startingTalents = parseInt(document.getElementById("talentsInput").value);

  // Rebuild players
  const newPlayers = [];
  for (let i = 0; i < numPlayers; i++) {
    const name = document.getElementById(`playerName${i}`).value || `Player ${i+1}`;
    if (players[i]) {
      newPlayers.push({
  name,
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
      newPlayers.push({ name, 
	  correct: 0, 
	  incorrect: 0, 
	  points: 0, 
	  avgTime: 0, 
	  totalTime: 0, 
	  questionsAnswered: 0, 
	  fastestTime: null, 
	  talents: {
			starting: startingTalents,          // initial amount chosen in options
			current: startingTalents,           // live balance during the match
			gained: 0,                          // earned during the match
			wasted: 0,                          // opportunities passed or lost
			redemptions: 0,                     // attempts made (cost 1 Talent)
			redemptionsSuccessful: 0            // successful attempts
		}

 });
    }
  }

  players = newPlayers;

  // Update UI
  updateScoreboard();

  // Save everything in one place
  persistSettings();
}

function startLocalMultiplayerGame() {
    console.log("Starting Local Multiplayer Game...");

    const numPlayers = parseInt(document.getElementById("playersInput").value);
	const startingTalents = parseInt(document.getElementById("talentsInput").value);


    players = [];
    for (let i = 0; i < numPlayers; i++) {
        const nameField = document.getElementById(`playerName${i}`);
        const name = nameField ? nameField.value.trim() : "";

        if (!name) {
            alert(`Player ${i + 1} must have a name.`);
            return;
        }

        players.push({
			name,
			points: 0,
			correct: 0,
			incorrect: 0,
			avgTime: 0,
			totalTime: 0,
			questionsAnswered: 0,
			fastestTime: null,
			
			talents: {
				starting: startingTalents,          // initial amount chosen in options
				current: startingTalents,           // live balance during the match
				gained: 0,                          // earned during the match
				wasted: 0,                          // opportunities passed or lost
				redemptions: 0,                     // attempts made (cost 1 Talent)
				redemptionsSuccessful: 0            // successful attempts
			}


        });
    }

    // Load settings
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


 
function backToMenu() {
    showScreen("screenMenu");
}

function getActivePlayerName() {
    if (gameMode === "single") {
        return singlePlayerSettings.name;
    }
    return players[currentPlayerIndex].name;
}

function getPlayerCount() {
    return gameMode === "single" ? 1 : players.length;
}

function isMultipleChoice() {
    return (
        quizType === "multiple" ||
        (quizType === "mixed" && currentRoundType === "multiple")
    );
}


function startTrivia() {
	showScreen("screenQuiz");
    questionCount = 0;

    if (gameMode === "single") {
        // Single Player
        currentPlayerIndex = 0; // not really used, but keeps runQuiz happy
        totalQuestions = singlePlayerSettings.rounds;
    } else {
        // Local Multiplayer
        currentPlayerIndex = 0;
        totalQuestions = rounds * players.length;
    }

    runQuiz();
}


async function runQuiz() {
    // Reset leftover state
    currentBlankWord = null;
    scrambledAlreadyChecked = false;
    paused = false;

    const playerCount = getPlayerCount();
    const isSingle = (gameMode === "single");

    // End game check
    if (questionCount >= totalQuestions) {
        endGame();
        return;
    }
    questionCount++;

    // Determine round type (mixed mode)
    if (quizType === "mixed") {
        if ((questionCount - 1) % playerCount === 0) {
            const types = ["multiple", "fill", "scramble"];
            currentRoundType = types[Math.floor(Math.random() * types.length)];
        }
    }

    const typeToUse = quizType === "mixed" ? currentRoundType : quizType;

    // Fetch verse
    let url = "https://bible-api.com/data/kjv/random";
    if (testament === "ot") url = "https://bible-api.com/data/kjv/random/ot";
    else if (testament === "nt") url = "https://bible-api.com/data/kjv/random/nt";

    const response = await fetch(url);
    const verseData = await response.json();
    currentVerse = verseData.random_verse;

    const verseText = currentVerse.text;
    const correctBook = currentVerse.book;

    // Determine round index
    const roundIndex = Math.floor((questionCount - 1) / playerCount) + 1;

    // UI: progress + turn
    document.getElementById("progress").innerHTML =
        `Round ${roundIndex} of ${totalRounds}<br>
         <em>Round Type: ${
            typeToUse === "multiple" ? "Guess the Book" :
            typeToUse === "fill" ? "Fill in the Blank" :
            "Scrambled Verse"
         }</em>`;

    document.getElementById("turn").innerHTML =
        `Turn: ${getActivePlayerName()}`;

    // Render the correct mode
    if (typeToUse === "multiple") {
        renderMultipleChoice(verseText, correctBook);
    } else if (typeToUse === "fill") {
        renderFillInBlank(verseText);
    } else if (typeToUse === "scramble") {
        renderScrambledVerse(verseText);
    }

    // Clear old result + controls
    document.getElementById("result").innerHTML = "";
    document.getElementById("controls").innerHTML = "";

    updateScoreboard();

    // Timer
    startTimer(typeToUse);

    // Pause button
    if (timerEnabled) {
        document.getElementById("controls").innerHTML =
            `<button onclick="togglePause('${typeToUse}')">Pause</button>`;
    }
}

// Globals
let currentlyDraggingTile = null;
let touchClone = null;
let touchOffsetX = 0;
let touchOffsetY = 0;

function renderScrambledVerse(verseText) {
    const MIN_WORDS = 6;
    const HARD_MAX_WORDS = 12;
    const SOFT_MAX_WORDS = 10;

    const tokens = verseText.split(/\s+/);

    const cleanWords = tokens
        .map(t => t.replace(/[^\w\s]/g, ""))
        .filter(w => w.length > 0);

    if (cleanWords.length <= MIN_WORDS) {
        currentScrambleAnswer = cleanWords;
        showScreen("screenQuiz");
        renderScrambleUI(verseText, cleanWords);
        return;
    }

    const punctuationRegex = /[.,;:?!]$/;
    let clauseBoundaries = [];

    tokens.forEach((token, index) => {
        if (punctuationRegex.test(token)) clauseBoundaries.push(index);
    });

    if (clauseBoundaries.length === 0) {
        clauseBoundaries = [tokens.length - 1];
    }

    let scrambleStartTokenIndex = 0;
    let scrambleEndTokenIndex = clauseBoundaries[0];

    let scrambleWords = cleanWords.slice(
        scrambleStartTokenIndex,
        scrambleEndTokenIndex + 1
    );

    let boundaryIndex = 0;
    while (
        scrambleWords.length < MIN_WORDS &&
        boundaryIndex < clauseBoundaries.length - 1 &&
        scrambleWords.length < HARD_MAX_WORDS
    ) {
        boundaryIndex++;
        scrambleEndTokenIndex = clauseBoundaries[boundaryIndex];
        scrambleWords = cleanWords.slice(
            scrambleStartTokenIndex,
            scrambleEndTokenIndex + 1
        );
    }

    if (scrambleWords.length > SOFT_MAX_WORDS) {
        if (scrambleWords.length > HARD_MAX_WORDS) {
            scrambleWords = scrambleWords.slice(0, SOFT_MAX_WORDS);
        }
    }

    currentScrambleAnswer = scrambleWords;

    showScreen("screenQuiz");
    renderScrambleUI(verseText, scrambleWords);
}


// Helper: builds tiles & drop zone, wires drag/drop
function renderScrambleUI(verseText, scrambleWords) {
    const scrambled = [...scrambleWords].sort(() => Math.random() - 0.5);

    let tilesHTML = `<div id="scrambleTiles" class="tile-container">`;
    scrambled.forEach((word, i) => {
        tilesHTML += `
            <div class="tile" draggable="true" data-id="${i}" data-word="${word}">
                ${word}
            </div>`;
    });
    tilesHTML += `</div>`;

    const dropHTML = `<div id="scrambleDrop" class="drop-container"></div>`;

    document.getElementById("result").innerHTML = "";
    document.getElementById("controls").innerHTML = "";

    document.getElementById("quiz").innerHTML = `
        <p><strong>${verseText}</strong></p>
        <p>Reconstruct the first ${scrambleWords.length} words of the verse:</p>
        ${tilesHTML}
        ${dropHTML}
        <button id="submitBtn">Submit</button>
    `;

    document.getElementById("submitBtn").onclick = submitScrambledVerse;

    setupScrambleDragDrop();
}


function setupScrambleDragDrop() {
    const tiles = document.querySelectorAll(".tile");
    const dropZone = document.getElementById("scrambleDrop");
    const tileContainer = document.getElementById("scrambleTiles");

    function updateScrambleFeedback() {
        const placedTiles = Array.from(dropZone.querySelectorAll(".tile"));

        placedTiles.forEach((tile, index) => {
            const word = tile.dataset.word;
            const correctWord = currentScrambleAnswer[index];

            if (word === correctWord) {
                tile.classList.add("correct-word");
                tile.classList.remove("incorrect-word");
            } else {
                tile.classList.add("incorrect-word");
                tile.classList.remove("correct-word");
            }
        });

        tileContainer.querySelectorAll(".tile").forEach(tile => {
            tile.classList.remove("correct-word", "incorrect-word");
        });
    }

    tiles.forEach(tile => {
        // Touch
        tile.addEventListener("touchstart", handleTouchStart, { passive: false });
        tile.addEventListener("touchmove", handleTouchMove, { passive: false });
        tile.addEventListener("touchend", handleTouchEnd, { passive: false });

        // Desktop drag
        tile.addEventListener("dragstart", e => {
            currentlyDraggingTile = tile;
            tile.classList.add("dragging");
            tile.classList.remove("correct-word", "incorrect-word");
            e.dataTransfer.setData("text/id", tile.dataset.id);
        });

        tile.addEventListener("dragend", e => {
            tile.classList.remove("dragging");
            // currentlyDraggingTile cleared in drop handlers
        });

        // Double‑click toggle
        tile.addEventListener("dblclick", () => {
            if (tile.parentElement === tileContainer) {
                dropZone.appendChild(tile);
            } else {
                tileContainer.appendChild(tile);
                tile.classList.remove("correct-word", "incorrect-word");
            }
            updateScrambleFeedback();
        });
    });

    // Desktop drag over drop zone
    dropZone.addEventListener("dragover", e => {
        e.preventDefault();
        if (!currentlyDraggingTile) return;

        const afterElement = getDragAfterElement(dropZone, e.clientX, e.clientY);

        const lastTile = dropZone.lastElementChild;
        if (lastTile) {
            const rect = lastTile.getBoundingClientRect();
            if (e.clientX > rect.right) {
                dropZone.appendChild(currentlyDraggingTile);
                updateScrambleFeedback();
                return;
            }
        }

        if (afterElement == null) {
            dropZone.appendChild(currentlyDraggingTile);
        } else {
            dropZone.insertBefore(currentlyDraggingTile, afterElement);
        }

        updateScrambleFeedback();
    });

    dropZone.addEventListener("drop", e => {
        e.preventDefault();
        currentlyDraggingTile = null;
        updateScrambleFeedback();
    });

    tileContainer.addEventListener("dragover", e => e.preventDefault());

    tileContainer.addEventListener("drop", e => {
        e.preventDefault();
        if (!currentlyDraggingTile) return;
        tileContainer.appendChild(currentlyDraggingTile);
        currentlyDraggingTile.classList.remove("correct-word", "incorrect-word");
        currentlyDraggingTile = null;
        updateScrambleFeedback();
    });

    window._scrambleUpdateFeedback = updateScrambleFeedback;
}



function handleTouchStart(e) {
    e.preventDefault();
    const tile = e.currentTarget;

    currentlyDraggingTile = tile;
    tile.classList.add("dragging");

    const touch = e.touches[0];
    const rect = tile.getBoundingClientRect();

    touchOffsetX = touch.clientX - rect.left;
    touchOffsetY = touch.clientY - rect.top;

    touchClone = tile.cloneNode(true);
    touchClone.style.position = "fixed";
    touchClone.style.left = rect.left + "px";
    touchClone.style.top = rect.top + "px";
    touchClone.style.width = rect.width + "px";
    touchClone.style.opacity = "0.7";
    touchClone.style.pointerEvents = "none";
    touchClone.classList.add("dragging");

    document.body.appendChild(touchClone);
}

function handleTouchMove(e) {
    e.preventDefault();
    if (!touchClone || !currentlyDraggingTile) return;

    const touch = e.touches[0];

    // Move the floating clone
    touchClone.style.left = (touch.clientX - touchOffsetX) + "px";
    touchClone.style.top = (touch.clientY - touchOffsetY) + "px";

    const dropZone = document.getElementById("scrambleDrop");
    const tileContainer = document.getElementById("scrambleTiles");

    // Determine if finger is visually inside drop zone
    const dzRect = dropZone.getBoundingClientRect();
    const insideDropZone =
        touch.clientX >= dzRect.left &&
        touch.clientX <= dzRect.right &&
        touch.clientY >= dzRect.top &&
        touch.clientY <= dzRect.bottom;

    if (insideDropZone) {

        // ⭐ Build row groups (same logic as getDragAfterElement)
        const tiles = [...dropZone.querySelectorAll(".tile:not(.dragging)")];
        const rows = [];
        tiles.forEach(tile => {
            const rect = tile.getBoundingClientRect();
            let row = rows.find(r => Math.abs(r.top - rect.top) < 10);
            if (!row) {
                row = { top: rect.top, tiles: [] };
                rows.push(row);
            }
            row.tiles.push(tile);
        });

        // Find the row closest to the finger
        let targetRow = rows[0];
        let minDist = Infinity;
        rows.forEach(row => {
            const dist = Math.abs(touch.clientY - row.top);
            if (dist < minDist) {
                minDist = dist;
                targetRow = row;
            }
        });

        // ⭐ Find last tile in that row
        const rowTiles = targetRow.tiles;
        const lastTile = rowTiles[rowTiles.length - 1];

        // ⭐ iPhone‑safe drag‑to‑end logic for the active row
        if (lastTile) {
            const rect = lastTile.getBoundingClientRect();
            const lastCenter = rect.left + rect.width / 2;

            if (touch.clientX > lastCenter) {
                dropZone.appendChild(currentlyDraggingTile);
                if (window._scrambleUpdateFeedback) window._scrambleUpdateFeedback();
                return;
            }
        }

        // ⭐ Insert before nearest tile in the active row
        const afterElement = getDragAfterElement(dropZone, touch.clientX, touch.clientY);
        if (afterElement == null) {
            dropZone.appendChild(currentlyDraggingTile);
        } else {
            dropZone.insertBefore(currentlyDraggingTile, afterElement);
        }
    }
    else {
        // Back to tile container
        tileContainer.appendChild(currentlyDraggingTile);
        currentlyDraggingTile.classList.remove("correct-word", "incorrect-word");
    }

    if (window._scrambleUpdateFeedback) window._scrambleUpdateFeedback();
}

function handleTouchEnd(e) {
    e.preventDefault();
    if (touchClone) {
        touchClone.remove();
        touchClone = null;
    }
    if (currentlyDraggingTile) {
        currentlyDraggingTile.classList.remove("dragging");
    }
    currentlyDraggingTile = null;
    if (window._scrambleUpdateFeedback) window._scrambleUpdateFeedback();
}

// Safety for iOS touch cancel
window.addEventListener("touchcancel", handleTouchEnd, { passive: false });



function getDragAfterElement(container, x, y) {
    const tiles = [...container.querySelectorAll(".tile:not(.dragging)")];
    if (tiles.length === 0) return null;

    // Group tiles into rows based on vertical proximity
    const rows = [];
    tiles.forEach(tile => {
        const rect = tile.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;

        let row = rows.find(r => Math.abs(r.midY - midY) < 10);
        if (!row) {
            row = { midY, tiles: [] };
            rows.push(row);
        }
        row.tiles.push(tile);
    });

    // Determine which row the finger is closest to
    let targetRow = rows[0];
    let minDist = Infinity;

    rows.forEach(row => {
        const dist = Math.abs(y - row.midY);
        if (dist < minDist) {
            minDist = dist;
            targetRow = row;
        }
    });

    // Now find nearest tile horizontally within that row
    let closest = null;
    let closestDist = Infinity;

    targetRow.tiles.forEach(tile => {
        const rect = tile.getBoundingClientRect();
        const tileCenterX = rect.left + rect.width / 2;
        const dx = x - tileCenterX;
        const dist = Math.abs(dx);

        if (dist < closestDist) {
            closestDist = dist;
            closest = tile;
        }
    });

    return closest;
}


function renderMultipleChoice(verseText, correctBook) {
    const isOT = oldTestamentBooks.includes(correctBook);
    const pool = isOT ? oldTestamentBooks : newTestamentBooks;

    const distractors = pool.filter(b => b !== correctBook);
    const shuffled = distractors.sort(() => 0.5 - Math.random()).slice(0, 3);

    const options = [...shuffled];
    const insertPos = Math.floor(Math.random() * 4);
    options.splice(insertPos, 0, correctBook);

    let html = `<p><strong>${verseText}</strong></p>`;
    html += `<p>Which book is this verse from?</p>`;

    options.forEach((opt, idx) => {
	html += `<button class="answerBtn" onclick="submitMultipleChoice('${opt}')">${idx+1}. ${opt}</button><br>`;

    });

    document.getElementById("quiz").innerHTML = html;
}

function renderFillInBlank(verseText) {
    const words = verseText.split(/(\W+)/);
    const eligibleIndexes = words
        .map((w, i) => ({ word: w.replace(/[^a-zA-Z]/g, ""), index: i }))
        .filter(obj => obj.word.length >= 4);

    const choice = eligibleIndexes[Math.floor(Math.random() * eligibleIndexes.length)];
    currentBlankWord = choice.word;
    const correctWord = choice.word;

    words[choice.index] = "____";
    const blankVerse = words.join(" ");

    const reference = `${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse}`;

    document.getElementById("quiz").innerHTML =
        `<p><strong>${blankVerse}</strong></p>
         <p><em>Reference: ${reference}</em></p>
         <p>Fill in the blank:</p>
         <input type="text" id="fillAnswer">
         <button id="submitBtn" onclick="submitFillInBlank()">Submit</button>`;

    const input = document.getElementById("fillAnswer");
    const submitBtn = document.getElementById("submitBtn");

    if (input) input.focus();

    if (input && submitBtn) {
        input.addEventListener("keydown", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                if (!submitBtn.disabled) submitBtn.click();
            }
        });
    }
}



	
	function getCorrectWord() {
 // If you stored the blank word during runQuiz, return it here.
 // Example: set a global variable when choosing the blank:
 //   currentBlankWord = choice.word;
	return currentBlankWord || "";
}

function startTimer(typeToUse) {

    // Skip timer entirely if disabled
    if (!timerEnabled) {
        document.getElementById("turn").innerHTML =
            `Turn: ${getActivePlayerName()} — Timer disabled`;
        return;
    }

    timeLeft = timerLength;
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {

        if (!paused) {

            // Display tenths cleanly
            document.getElementById("turn").innerHTML =
                `Turn: ${getActivePlayerName()} — Time left: ${timeLeft.toFixed(1)}s`;

            // Subtract 0.1 seconds
            timeLeft = Math.max(0, timeLeft - 0.1);
            timeLeft = Number(timeLeft.toFixed(1));

            // Timer expired?
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                handleTimerExpired(typeToUse);
                return;
            }

        } else {
            // Paused display
            document.getElementById("turn").innerHTML =
                `Turn: ${getActivePlayerName()} — ⏸ Paused`;
        }

    }, 100); // 100ms = 0.1s precision
}

function handleTimerExpired(typeToUse) {
    // Mark incorrect
    if (gameMode === "single") {
        currentPlayer.incorrect++;
    } else {
        players[currentPlayerIndex].incorrect++;
    }

    recordAnswerTime(false);

    const reference = `${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse}`;

    // Determine correct text based on mode
    let correctText;
    if (typeToUse === "multiple") {
        correctText = `The correct answer was ${currentVerse.book}.`;
    } else if (typeToUse === "fill") {
        const word = currentBlankWord || getCorrectWord() || "(unknown)";
        correctText = `The correct word was "${word}".`;
    } else {
        // Scramble
        correctText = `The correct verse was:<br>${currentVerse.text}`;
    }

    // Show timeout message
    document.getElementById("result").innerHTML =
        `⏰ Time’s up!<br>❌ Incorrect.<br>${correctText}<br><em>Reference: ${reference}</em>`;

    // Disable UI
    if (typeToUse === "multiple") {
        disableOptions();
    } else {
        const input = document.getElementById("fillAnswer");
        const submitBtn = document.getElementById("submitBtn");
        if (input) input.disabled = true;
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = "Submitted";
        }
    }

    // MULTIPLAYER: begin redemption sequence
    if (gameMode !== "single") {

        // Reset redemption tracking for this question
        redemptionAttempted.clear();

        // Find the first eligible redeemer (starting AFTER the turn owner)
        const next = getNextPlayerForRedemption();

        if (next !== null) {
            currentPlayerIndex = next;
            offerRedeemTime();
            return;
        }
    }

    // No redemption possible → end question normally
    if (gameMode !== "single") {
        currentPlayerIndex = (turnOwner + 1) % players.length;
    }

    updateScoreboard();

    document.getElementById("controls").innerHTML =
        `<button onclick="runQuiz()">Next Question</button>`;
}


function togglePause() {
  paused = !paused; // flip the paused state

  if (paused) {
    document.getElementById("turn").innerHTML =
      `Turn: ${players[currentPlayerIndex].name} — ⏸ Paused`;
  } else {
    document.getElementById("turn").innerHTML =
      `Turn: ${players[currentPlayerIndex].name} — ▶️ Resumed`;
    // ✅ No need to call startTimer() again
  }
  // Update button text
  const btn = document.querySelector("#controls button");
  if (btn) {
    btn.textContent = paused ? "Resume" : "Pause";
  }
}




  function disableOptions() {
  const buttons = document.querySelectorAll("#quiz button");
  buttons.forEach(btn => btn.disabled = true);
}
	
	function enableOptions() {
   const buttons = document.querySelectorAll("#quiz button");
   buttons.forEach(btn => btn.disabled = false);
}

function disableFillInputs() {
  const input = document.getElementById("fillAnswer");
  const submitBtn = document.getElementById("submitBtn");
  if (input) input.disabled = true;
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "Submitted";
  }
}


function handleCorrectAnswer(basePoints, timeLeft = 0, isScramble = false) {
    let total = basePoints;

    // Scramble scoring stays special
    if (isScramble) {
        if (timerEnabled) {
            const timeScore = 10 * Math.floor(timeLeft);
            const bonus = timeBonusEnabled ? Math.floor(timeLeft) : 0;
            total = timeScore + bonus;
        } else {
            total = 50;
        }
    } else {
        // Normal scoring (multiple choice or fill)
        // Redemption answers pass timeLeft = 0, so no time bonus is added
        total = basePoints + (timeBonusEnabled ? Math.floor(timeLeft) : 0);
    }

    // Apply score
    if (gameMode === "single") {
        currentPlayer.points += total;
        currentPlayer.correct++;
    } else {
        players[currentPlayerIndex].points += total;
        players[currentPlayerIndex].correct++;
    }

    recordAnswerTime(true);

    const reference = `${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse}`;

    document.getElementById("result").innerHTML =
        `✅ Correct!<br><em>Reference: ${reference}</em><br>+${total} points`;

    disableAllAnswerUI();
    updateScoreboard();

    // Rotate turn (multiplayer only)
    if (gameMode !== "single") {
        currentPlayerIndex = (turnOwner + 1) % players.length;
    }

    document.getElementById("controls").innerHTML =
        `<button onclick="runQuiz()">Next Question</button>`;
}

function handleIncorrectAnswer(correctText, skipRedemption = false)
 {
    if (gameMode === "single") {
        currentPlayer.incorrect++;
    } else {
        players[currentPlayerIndex].incorrect++;
    }

    recordAnswerTime(false);

    const reference = `${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse}`;

    // Disable main answer UI
    disableAllAnswerUI();

    // MULTIPLAYER: begin redemption sequence
    if (!skipRedemption && gameMode !== "single") {
    redemptionAttempted.clear();
    const next = getNextPlayerForRedemption();
    if (next !== null) {
        currentPlayerIndex = next;
        offerRedeemTime();
        return;
    }
}


    // No redemption possible → show final incorrect result
    document.getElementById("result").innerHTML =
        `❌ Incorrect.<br>${correctText}<br><em>Reference: ${reference}</em>`;

    updateScoreboard();

    // Rotate turn
    if (gameMode !== "single") {
        currentPlayerIndex = (turnOwner + 1) % players.length;
    }

    document.getElementById("controls").innerHTML =
        `<button onclick="runQuiz()">Next Question</button>`;
}

function submitMultipleChoice(selectedBook) {
    clearInterval(timerInterval);
	clearInterval(redemptionTimer);
	redemptionTimer = null;

    const correctBook = currentVerse.book;
    const isCorrect = (selectedBook === correctBook);
    const timeBonus = timerEnabled ? Math.floor(timeLeft) : 0;

    if (isCorrect) {
    if (redemptionActive) {
        handleSuccessfulRedemption();
    } else {
        handleCorrectAnswer(50, timeBonus, false);
    }
} else {
    if (redemptionActive) {
        handleFailedRedemption();
    } else {
        const correctText = `The correct answer was ${correctBook}.`;
        handleIncorrectAnswer(correctText);
    }
}

}

function submitFillInBlank() {
    clearInterval(timerInterval);
	clearInterval(redemptionTimer);
	redemptionTimer = null;


    const input = document.getElementById("fillAnswer");
    const guess = input.value.trim().toLowerCase();
    const correct = getCorrectWord().toLowerCase();
    const timeBonus = timerEnabled ? Math.floor(timeLeft) : 0;

    if (guess === correct) {
    if (redemptionActive) {
        handleSuccessfulRedemption();
    } else {
        handleCorrectAnswer(75, timeBonus, false);
    }
} else {
    if (redemptionActive) {
        handleFailedRedemption();
    } else {
        const correctText = `The correct word was "${correct}".`;
        handleIncorrectAnswer(correctText);
    }
}

}


function submitScrambledVerse() {
    const dropZone = document.getElementById("scrambleDrop");
    const tiles = [...dropZone.querySelectorAll(".tile")];

	// Always clear previous highlighting
	document.querySelectorAll(".tile").forEach(tile => {
		tile.classList.remove("correct-word", "incorrect-word");
	});


    if (tiles.length !== currentScrambleAnswer.length) {
        document.getElementById("result").innerHTML =
            `Place all the words before submitting.`;
        return;
    }

    const submittedWords = tiles.map(t => t.dataset.word);
    const isCorrect = submittedWords.join(" ") === currentScrambleAnswer.join(" ");

    // Highlight correctness
    tiles.forEach((tile, index) => {
        const word = tile.dataset.word;
        const correctWord = currentScrambleAnswer[index];

        if (word === correctWord) {
            tile.classList.add("correct-word");
            tile.classList.remove("incorrect-word");
        } else {
            tile.classList.add("incorrect-word");
            tile.classList.remove("correct-word");
        }
    });

    if (scrambledAlreadyChecked) return;
    scrambledAlreadyChecked = true;

    clearInterval(timerInterval);

    const timeBonus = timerEnabled ? Math.floor(timeLeft) : 0;

    if (isCorrect) {
        handleCorrectAnswer(75, timeBonus, true);
    } else {
        // ⭐ NO REDEMPTION IN SCRAMBLED MODE
        const correctText = `The correct verse was:<br>"${currentVerse.text}"`;
        handleIncorrectAnswer(correctText, /*skipRedemption=*/true);
    }
}

function disableAllAnswerUI() {
    disableOptions();

    const input = document.getElementById("fillAnswer");
    const submitBtn = document.getElementById("submitBtn");

    if (input) input.disabled = true;
    if (submitBtn) submitBtn.disabled = true;
}

function enableAnswerUI() {
    // Multiple choice
    document.querySelectorAll(".answerBtn").forEach(btn => {
        btn.disabled = false;
    });

    // Fill-in
    const input = document.getElementById("fillAnswer");
    const submitBtn = document.getElementById("submitBtn");

    if (input) {
        input.disabled = false;
        input.value = "";
    }

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit";
    }
}



function recordAnswerTime(isCorrect) {
  if (!timerEnabled) return;

  const timeUsed = timerLength - timeLeft;

  players[currentPlayerIndex].totalTime += timeUsed;
players[currentPlayerIndex].questionsAnswered++;
players[currentPlayerIndex].avgTime =
    players[currentPlayerIndex].totalTime / players[currentPlayerIndex].questionsAnswered;

if (players[currentPlayerIndex].fastestTime === null ||
    timeUsed < players[currentPlayerIndex].fastestTime) {
    players[currentPlayerIndex].fastestTime = timeUsed;
}
    }
  




function nextQuestion() {
  currentPlayerIndex = (turnOwner + 1) % players.length;
  persistSettings();

  scrambledAlreadyChecked = false;

  const btn = document.getElementById("submitBtn");
  if (btn) {
      btn.disabled = false;
  }

  runQuiz();
}

function awardPoints(basePoints, timeLeft = 0, isSteal = false) {
    let total = basePoints;

    if (isSteal) {
        total = 25;
    }

    if (timerEnabled && timeBonusEnabled && timeLeft > 0) {
        total += timeLeft;
    }

    if (gameMode === "single") {
        currentPlayer.points += total;
        return;
    }

    players[currentPlayerIndex].points += total;
}


function animateScore(element, start, end, duration = 800) {
  let range = end - start;
  if (range === 0) {
    element.textContent = end;
    return;
  }

  let stepTime = Math.max(Math.floor(duration / Math.abs(range)), 10);
  let current = start;
  let increment = end > start ? 1 : -1;

  let timer = setInterval(() => {
    current += increment;
    element.textContent = current;
    if (current === end) {
      clearInterval(timer);
      element.classList.add("score-glow");
      setTimeout(() => element.classList.remove("score-glow"), 500);
    }
  }, stepTime);
}

function updateScoreboard() {
    const scoreboard = document.getElementById("scoreboard");

    // SINGLE PLAYER MODE
    if (gameMode === "single") {
        const p = currentPlayer;

        scoreboard.innerHTML = `
            <div style="text-align:center; margin-bottom:15px;">
                <h2 style="
                    font-family:'Trebuchet MS', sans-serif;
                    font-weight:bold;
                    color:#BB0000;
                    letter-spacing:2px;
                    margin:0;
                ">
                    KJV Quiz Challenge
                </h2>
                <hr style="
                    width:60%;
                    border:0;
                    height:3px;
                    background:linear-gradient(to right, #BB0000, #666666);
                    margin:8px auto;
                ">
                <p style="
                    font-style:italic;
                    color:#666666;
                    margin:0;
                ">
                    Who will wear the crown?
                </p>
            </div>

            <p class="active-player">
                ${p.name}: Points: <span id="player0Points">${p.points}</span>
            </p>
        `;

        return;
    }

    // MULTIPLAYER MODE
    const oldValues = {};
    players.forEach((p, idx) => {
        const oldEl = document.getElementById(`player${idx}Points`);
        oldValues[idx] = oldEl ? parseInt(oldEl.textContent) : p.points;
    });

    // Leader(s)
    const maxPoints = Math.max(...players.map(p => p.points));
    const leaders = players.filter(p => p.points === maxPoints);

    // HEADER
    scoreboard.innerHTML = `
        <div style="text-align:center; margin-bottom:15px;">
            <h2 style="
                font-family:'Trebuchet MS', sans-serif;
                font-weight:bold;
                color:#BB0000;
                letter-spacing:2px;
                margin:0;
            ">
                KJV Quiz Challenge
            </h2>
            <hr style="
                width:60%;
                border:0;
                height:3px;
                background:linear-gradient(to right, #BB0000, #666666);
                margin:8px auto;
            ">
            <p style="
                font-style:italic;
                color:#666666;
                margin:0;
            ">
                Who will wear the crown?
            </p>
        </div>
    `;

    // PLAYER ROWS
    players.forEach((p, idx) => {
        const isActive = (idx === currentPlayerIndex);

        const playerP = document.createElement("p");
        if (isActive) playerP.classList.add("active-player");

        const crown = leaders.includes(p) ? " 👑" : "";

        playerP.innerHTML = `
            <strong>${p.name}${crown}</strong>: Points: 
            <span id="player${idx}Points"></span>
            <br>
            <span style="font-size:0.85em; color:#444;">
                Talents: ${p.talents.current} / ${p.talents.starting}
                &nbsp;|&nbsp; Redeems: ${p.talents.redemptions}
                &nbsp;|&nbsp; Success: ${p.talents.redemptionsSuccessful}
                &nbsp;|&nbsp; Wasted: ${p.talents.wasted}
            </span>
        `;

        const pointsSpan = playerP.querySelector(`#player${idx}Points`);
        animateScore(pointsSpan, oldValues[idx], p.points);

        scoreboard.appendChild(playerP);
    });
}


function resetScores() {
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

function advanceTurn() {
    if (gameMode === "single") {
        return; // no rotation needed
    }

    currentPlayerIndex = (currentPlayerIndex + 1) % players.length;
}

function offerRedeemTime() {
    const player = players[currentPlayerIndex];
	redemptionActive = true;
    // If they have no talents, show the alternate screen
    if (player.talents.current <= 0) {
        showNoTalentsPrompt(player);
        return;
    }

    // Otherwise show the normal redemption prompt
    showRedeemPrompt(player);
}


function showRedeemPrompt(player) {
    const box = document.getElementById("redeemBox");

    box.innerHTML = `
        <p><strong>${player.name}</strong>, Spend a Talent to Redeem the Time?</p>
        <button onclick="acceptRedeemTime()">Accept</button>
        <button onclick="passRedeemTime()">Pass</button>
    `;

    document.getElementById("redeemOverlay").style.display = "flex";
}

function showNoTalentsPrompt(player) {
    const box = document.getElementById("redeemBox");

    box.innerHTML = `
        <p><strong>${player.name}</strong></p>
        <p>You have no Talents to redeem.</p>
        <button onclick="acknowledgeNoTalents()">Continue</button>
    `;

    document.getElementById("redeemOverlay").style.display = "flex";
}

function acknowledgeNoTalents() {
    document.getElementById("redeemOverlay").style.display = "none";

    redemptionAttempted.add(currentPlayerIndex);

    const next = getNextPlayerForRedemption();
    if (next !== null) {
        currentPlayerIndex = next;
        offerRedeemTime();
        return;
    }

    endQuestionNoSteal();
}


function acceptRedeemTime() {
    const player = players[currentPlayerIndex];

    player.talents.current--;
    player.talents.redemptions++;
    redemptionAttempted.add(currentPlayerIndex);

    updateScoreboard();   // ⭐ NEW

    startRedemptionTimer();
    enableAnswerUI();
    document.getElementById("redeemOverlay").style.display = "none";
}

function passRedeemTime() {
    redemptionAttempted.add(currentPlayerIndex);

    const next = getNextPlayerForRedemption();
document.getElementById("redeemOverlay").style.display = "none";

    if (next !== null) {
        currentPlayerIndex = next;
        offerRedeemTime();
        return;
    }

    // No more redemption candidates
    endQuestionNoSteal();
}


function startRedemptionTimer() {
    redemptionTimeLeft = 15; // or whatever you choose

    updateRedemptionUI();
	enableAnswerUI();


    redemptionTimer = setInterval(() => {
        redemptionTimeLeft--;
        updateRedemptionUI();

        if (redemptionTimeLeft <= 0) {
            clearInterval(redemptionTimer);
            handleFailedRedemption();
        }
    }, 1000);
}

function updateRedemptionUI() {
    const ui = document.getElementById("result");

    ui.innerHTML = `
        <div class="redeemTimerBox">
            <p>Redeem the Time! ⏳ ${redemptionTimeLeft}s</p>
            <p>Answer now!</p>
        </div>
    `;
}


function handleSuccessfulRedemption() {
    const player = players[currentPlayerIndex];

    player.talents.redemptionsSuccessful++;


    redemptionActive = false;
    updateScoreboard();

    document.getElementById("redeemOverlay").style.display = "none";

    // Award redemption points
    handleCorrectAnswer(25, 0, false);
}

function handleFailedRedemption() {
    const player = players[currentPlayerIndex];

    player.talents.wasted++;     // Only increment wasted on WRONG redemption
    
    redemptionAttempted.add(currentPlayerIndex);

    updateScoreboard();

    document.getElementById("redeemOverlay").style.display = "none";

    const next = getNextPlayerForRedemption();
    if (next !== null) {
        currentPlayerIndex = next;
        offerRedeemTime();
        return;
    }

    endQuestionNoSteal();
}


function getNextPlayerForRedemption() {
    const total = players.length;
    const start = turnOwner;

    for (let i = 1; i < total; i++) {
        const idx = (start + i) % total;

        // Skip original player
        if (idx === turnOwner) continue;

        // Skip players who already had their chance
        if (redemptionAttempted.has(idx)) continue;

        // This player should be visited next (talents or not)
        return idx;
    }

    return null;
}



function endQuestionNoSteal() {
    // Stop all timers
    clearInterval(timerInterval);
    clearInterval(redemptionTimer);

	redemptionActive = false;

    // Determine question type
    const isMultiple = isMultipleChoice();


    // Build correct answer text
    const reference = `${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse}`;

    let correctText;
    if (isMultiple) {
        correctText = `The correct answer was ${currentVerse.book}.`;
    } else {
        const word = currentBlankWord || getCorrectWord() || "(unknown)";
        correctText = `The correct word was "${word}".`;
    }

    // Show result
    document.getElementById("result").innerHTML =
        `❌ No more attempts.<br>${correctText}<br><em>Reference: ${reference}</em>`;

    // Disable answer UI
    disableOptions();

    const input = document.getElementById("fillAnswer");
    const submitBtn = document.getElementById("submitBtn");
    if (input) input.disabled = true;
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitted";
    }

    // Advance turn owner
    turnOwner = (turnOwner + 1) % players.length;
    currentPlayerIndex = turnOwner;

    // Reset per-question flags
    redemptionAttempted.clear();
    scrambledAlreadyChecked = false;

    // Update scoreboard
    updateScoreboard();

    // Show Next Question button
    document.getElementById("controls").innerHTML =
        `<button onclick="runQuiz()">Next Question</button>`;
}




function endGame() {
  fadeToBlack(() => {

    // Hide scoreboard for full-screen effect
    document.getElementById("scoreboard").style.display = "none";
    document.getElementById("result").innerHTML = "";

    // Sort players by points
    const sorted = [...players].sort((a, b) => b.points - a.points);
    const top = sorted.slice(0, Math.min(3, sorted.length));

    // Build the podium container (mobile-friendly)
    document.getElementById("quiz").innerHTML = `
      <h2 style="text-align:center; font-size:2em; margin-bottom:20px;">
        🏆 Final Results 🏆
      </h2>

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
      3: { color: "#cd7f32", height: 120 }, // Bronze
      2: { color: "#c0c0c0", height: 150 }, // Silver
      1: { color: "#ffd700", height: 200 }  // Gold
    };

    // Reveal order: 3rd → 2nd → 1st
    top.reverse().forEach((p, index) => {

      const place = index === 0 ? 3 : index === 1 ? 2 : 1;
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

  // Reset per-round state
  stealMode = false;
  stealIndex = 0;

  // Clear UI
  document.getElementById("result").innerHTML = "";
  document.getElementById("controls").innerHTML = "";
  document.getElementById("quiz").innerHTML = "";

  // Show scoreboard again
  document.getElementById("scoreboard").style.display = "block";

  // Start fresh
  runQuiz();
}


function fadeToBlack(callback) {
  const overlay = document.getElementById("fadeOverlay");
  overlay.style.opacity = "1";

  setTimeout(() => {
    callback();
    overlay.style.opacity = "0";
  }, 2000); // 2 second fade
}

	
	document.addEventListener("keydown", function(event) {
  // Check specifically for the Right Shift key
  if (event.code === "ShiftRight") {
    event.preventDefault(); // just in case, stops odd side effects
    togglePause(currentRoundType || quizType);
  }
});

	
