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
	focusFillBlankInput();
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
	focusFillBlankInput();


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


    // Reset per-question flags
    redemptionAttempted.clear();
    scrambledAlreadyChecked = false;

    // Update scoreboard
    updateScoreboard();

    // Show Next Question button
    document.getElementById("controls").innerHTML =
        `<button onclick="nextQuestion()">Next Question</button>`;
}
