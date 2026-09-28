function getActivePlayerName() {
    if (gameMode === "single") {
        return singlePlayerSettings ? singlePlayerSettings.name : (currentPlayer?.name || "Player");
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
        currentPlayerIndex = 0; // not really used in single, but kept consistent
        totalQuestions = singlePlayerSettings.rounds;
    } else {
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
	if (gameMode !== "single") {
	  turnOwner = currentPlayerIndex;
	}
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
    const dzRect = dropZone.getBoundingClientRect();
    const tcRect = tileContainer.getBoundingClientRect();

    // Very forgiving "inside drop zone" check — iPhone-safe
    const insideDropZone =
        touch.clientY >= dzRect.top - 40; // anything below (or near) the top of the drop zone

    if (insideDropZone) {
        const afterElement = getDragAfterElement(dropZone, touch.clientX, touch.clientY);

        if (afterElement == null) {
            dropZone.appendChild(currentlyDraggingTile);
        } else {
            dropZone.insertBefore(currentlyDraggingTile, afterElement);
        }
    } else {
        // Above the drop zone → back to tile container
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

    // Linear, horizontal-only ordering — rows are ignored on purpose.
    return tiles.reduce((closest, tile) => {
        const box = tile.getBoundingClientRect();
        const offset = x - box.left - box.width / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset, element: tile };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
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
         <input type="text" id="fillAnswer" autocomplete="off">
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

function focusFillBlankInput() {
    setTimeout(() => {
        const input = document.getElementById("fillAnswer");
        if (input && !input.disabled) input.focus();
    }, 0);
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

function handleTimerExpired() {
    clearInterval(timerInterval);

    const reference = `${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse}`;

    // SCRAMBLE MODE → no redemption ever
    if (currentRoundType === "scramble" || quizType === "scramble") {
        const correctText = `Time's up!<br>The correct verse was:<br>"${currentVerse.text}"`;
        handleIncorrectAnswer(correctText, /*skipRedemption=*/true);
        return;
    }

    // MULTIPLE CHOICE
    if (currentRoundType === "multiple" || quizType === "multiple") {
        const correctText = `Time's up!<br>The correct answer was ${currentVerse.book}.<br><em>Reference: ${reference}</em>`;
        handleIncorrectAnswer(correctText);
        return;
    }

    // FILL-IN-THE-BLANK
    if (currentRoundType === "fill" || quizType === "fill") {
        const word = currentBlankWord || getCorrectWord() || "(unknown)";
        const correctText = `Time's up!<br>The correct word was "${word}".<br><em>Reference: ${reference}</em>`;
        handleIncorrectAnswer(correctText);
        return;
    }

    // FALLBACK (should never hit)
    const fallbackText = `Time's up!<br><em>Reference: ${reference}</em>`;
    handleIncorrectAnswer(fallbackText);
}


function togglePause() {
    paused = !paused; // flip the paused state

    const name = getActivePlayerName();

    if (paused) {
        document.getElementById("turn").innerHTML =
            `Turn: ${name} — ⏸ Paused`;
    } else {
        document.getElementById("turn").innerHTML =
            `Turn: ${name} — ▶️ Resumed`;
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


    document.getElementById("controls").innerHTML =
        `<button onclick="nextQuestion()">Next Question</button>`;
}


function handleIncorrectAnswer(correctText, skipRedemption = false) {

    // Count incorrect (ONLY here, never in timerExpired)
    if (gameMode === "single") {
        currentPlayer.incorrect++;
    } else {
        players[currentPlayerIndex].incorrect++;
    }

    recordAnswerTime(false);

    const reference = `${currentVerse.book} ${currentVerse.chapter}:${currentVerse.verse}`;

    // Disable all answer UI
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

 
    document.getElementById("controls").innerHTML =
        `<button onclick="nextQuestion()">Next Question</button>`;
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

    if (gameMode === "single") {
        const p = currentPlayer;
        if (!p) return;

        p.totalTime = (p.totalTime || 0) + timeUsed;
        p.questionsAnswered = (p.questionsAnswered || 0) + 1;
        p.avgTime = p.totalTime / p.questionsAnswered;

        if (p.fastestTime === null || p.fastestTime === undefined || timeUsed < p.fastestTime) {
            p.fastestTime = timeUsed;
        }
        return;
    }

    const p = players[currentPlayerIndex];
    p.totalTime += timeUsed;
    p.questionsAnswered++;
    p.avgTime = p.totalTime / p.questionsAnswered;

    if (p.fastestTime === null || timeUsed < p.fastestTime) {
        p.fastestTime = timeUsed;
    }
}




function nextQuestion() {

    // Rotate turn only in multiplayer
    if (gameMode !== "single") {
        turnOwner = (turnOwner + 1) % players.length;
        currentPlayerIndex = turnOwner;
    }

    scrambledAlreadyChecked = false;

    const btn = document.getElementById("submitBtn");
    if (btn) {
        btn.disabled = false;
    }

    runQuiz();
}

function awardPoints(basePoints, timeLeft = 0) {
    let total = basePoints;

    if (timerEnabled && timeBonusEnabled && timeLeft > 0) {
        total += timeLeft;
    }

    if (gameMode === "single") {
        currentPlayer.points += total;
        return;
    }

    players[currentPlayerIndex].points += total;
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
