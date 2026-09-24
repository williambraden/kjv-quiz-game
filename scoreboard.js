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

    const oldValues = {};
    players.forEach((p, idx) => {
        const oldEl = document.getElementById(`player${idx}Points`);
        oldValues[idx] = oldEl ? parseInt(oldEl.textContent) : p.points;
    });

    const maxPoints = Math.max(...players.map(p => p.points));
    const leaders = players.filter(p => p.points === maxPoints);

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
