
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

function isProfileUnlocked(profileId) {
    return sessionStorage.getItem("profileUnlocked") === profileId;
}

function unlockProfileSession(profileId) {
    sessionStorage.setItem("profileUnlocked", profileId);
}

function clearProfileUnlock() {
    sessionStorage.removeItem("profileUnlocked");
}

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

function switchProfile() {
    showProfileSelection();
}

function normalizeProfileName(name) {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function rememberProfileOnDevice(profileId) {
    const rememberedIds = JSON.parse(localStorage.getItem("rememberedProfileIds") || "[]");
    if (!rememberedIds.includes(profileId)) {
        rememberedIds.push(profileId);
        localStorage.setItem("rememberedProfileIds", JSON.stringify(rememberedIds));
    }
}

async function loadRememberedProfiles() {
    const rememberedIds = JSON.parse(localStorage.getItem("rememberedProfileIds") || "[]");
    const profiles = await Promise.all(rememberedIds.map(profileId => loadProfile(profileId)));
    return profiles.filter(Boolean);
}

async function showProfileSelection() {
    // Hide all other screens
    document.getElementById("screenMenu").style.display = "none";
    document.getElementById("screenSingleOptions").style.display = "none";
    document.getElementById("screenMultiOptions").style.display = "none";
    document.getElementById("screenQuiz").style.display = "none";

    // Show the profile selection screen
    const container = document.getElementById("profileSelectScreen");
    container.style.display = "block";

    // Load only profiles previously used on this device
    const profiles = await loadRememberedProfiles();
    availableProfiles = profiles;

    // Build the UI
    let html = `
        <h2 style="text-align:center;">Select Your Profile</h2>
        <div style="
            display:flex;
            flex-wrap:wrap;
            gap:15px;
            justify-content:center;
            margin-top:20px;
        ">
    `;

    profiles.forEach(p => {
        html += `
            <div style="
                padding:15px;
                border:1px solid #ccc;
                border-radius:8px;
                width:170px;
                background:#f9f9f9;
                text-align:center;
                transition:0.2s;
            " onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'">
                <div onclick="selectProfile('${p.id}')" style="cursor:pointer;">
                    <div style="font-size:2em;">${p.avatar || "🙂"}</div>
                    <h3 style="margin:10px 0 5px 0;">${p.name}</h3>
                </div>
                <button onclick="viewProfile('${p.id}')" style="width:100%; margin-top:8px;">View</button>
            </div>
        `;
    });

   html += `
    </div>

    <div style="text-align:center; margin-top:25px;">
        <button onclick="showCreateProfileForm()">Create New Profile</button>
        <button onclick="showProfileLoginForm()">Log Into Another Profile</button>
    </div>

    <div style="text-align:center; margin-top:10px;">
        <button onclick="showCreateGroupForm()">Create Group / Become Admin</button>
        <p style="font-size:0.85em; opacity:0.7; margin-top:5px;">
            All group/admin requests must be approved by the Developer.
        </p>
    </div>
`;

    container.innerHTML = html;
}

function showProfileLoginForm() {
    const container = document.getElementById("profileSelectScreen");
    container.style.display = "block";
    container.innerHTML = `
        <h2 style="text-align:center;">Log Into Profile</h2>
        <div style="max-width:320px; margin:20px auto; padding:20px; background:#f9f9f9; border:1px solid #ccc; border-radius:10px;">
            <label>Profile Name:</label><br>
            <input id="loginProfileName" style="width:100%; margin-bottom:12px;"><br>
            <label>PIN:</label><br>
            <input id="loginProfilePin" type="password" maxlength="10" style="width:100%; margin-bottom:16px;"><br>
            <button onclick="loginToProfile()" style="width:100%; margin-bottom:10px;">Log In</button>
            <button onclick="showProfileSelection()" style="width:100%;">Back</button>
        </div>
    `;
}

async function loginToProfile() {
    const name = document.getElementById("loginProfileName").value.trim();
    const pin = document.getElementById("loginProfilePin").value.trim();

    if (!name || !pin) {
        alert("Enter a profile name and PIN.");
        return;
    }

    const profileQuery = query(
        collection(window.db, "profiles"),
        where("nameNormalized", "==", normalizeProfileName(name))
    );
    const snapshot = await getDocs(profileQuery);

    if (snapshot.empty) {
        alert("Profile not found or unavailable for online login.");
        return;
    }

    const matchingProfile = {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
    };

    if (matchingProfile.onlineCapable === false) {
        alert("This profile is local-play only and cannot be logged into from another device.");
        return;
    }

    const enteredHash = await hashPIN(pin);
    if (enteredHash !== matchingProfile.pinHash) {
        alert("Incorrect PIN.");
        return;
    }

    rememberProfileOnDevice(matchingProfile.id);
    await finalizeProfileSelection(matchingProfile.id);
}

function showCreateGroupForm() {
    // Hide all other screens
    document.getElementById("screenMenu").style.display = "none";
    document.getElementById("screenSingleOptions").style.display = "none";
    document.getElementById("screenMultiOptions").style.display = "none";
    document.getElementById("screenQuiz").style.display = "none";

    // Show the profile selection container but replace its contents
    const container = document.getElementById("profileSelectScreen");
    container.style.display = "block";

    container.innerHTML = `
        <h2 style="text-align:center;">Create Group / Become Admin</h2>

        <p style="text-align:center; font-size:0.85em; opacity:0.7; margin-top:-10px;">
            All group/admin requests must be approved by the Developer.
        </p>

        <div style="max-width:400px; margin:20px auto; display:flex; flex-direction:column; gap:12px;">

            <label>Group Name *</label>
            <input id="groupNameInput" maxlength="60">

            <label>Your Name *</label>
            <input id="adminNameInput" maxlength="40">

            <label>Contact (Email or Phone) *</label>
            <input id="contactInput" maxlength="80">

            <label>Admin PIN *</label>
            <input id="pinInput" type="password" maxlength="10">

            <label>Location (optional)</label>
            <input id="locationInput" maxlength="60">

            <label>Short Description (optional)</label>
            <textarea id="descriptionInput" maxlength="200" style="height:70px;"></textarea>

            <label>Choose Icon *</label>
            <div id="iconPicker" style="
                display:flex;
                flex-wrap:wrap;
                gap:10px;
                justify-content:center;
                margin-top:5px;
            "></div>

            <button id="submitGroupRequestBtn" class="menuButton">
                Submit Request
            </button>

            <button class="menuButton" onclick="showProfileSelection()">
                Cancel
            </button>
        </div>
    `;

    renderIconPicker();
    document.getElementById("submitGroupRequestBtn").onclick = submitGroupRequest;
}

const approvedIcons = [
    "📘","📗","📙","📕",
    "⭐","🌿","🌟","🔥",
    "🕊️","🌈","🎯","🏆",
    "👨‍👩‍👧‍👦","⛪","🎓"
];

let selectedIcon = null;

function renderIconPicker() {
    const picker = document.getElementById("iconPicker");
    picker.innerHTML = "";

    approvedIcons.forEach(icon => {
        const btn = document.createElement("button");
        btn.textContent = icon;
        btn.className = "iconOption";
        btn.style.fontSize = "1.6em";
        btn.style.padding = "8px 12px";
        btn.style.border = "1px solid #ccc";
        btn.style.borderRadius = "6px";
        btn.style.cursor = "pointer";
        btn.style.background = "#fff";

        btn.onclick = () => {
            selectedIcon = icon;
            document.querySelectorAll(".iconOption").forEach(b => {
                b.style.border = "1px solid #ccc";
            });
            btn.style.border = "2px solid #007bff";
        };

        picker.appendChild(btn);
    });
}

function renderProfileAvatarPicker(pickerId, inputId, selectedAvatar) {
    const picker = document.getElementById(pickerId);
    const input = document.getElementById(inputId);
    if (!picker || !input) return;

    input.value = approvedIcons.includes(selectedAvatar) ? selectedAvatar : "🙂";
    picker.innerHTML = "";
    picker.style.display = "flex";
    picker.style.flexWrap = "wrap";
    picker.style.gap = "8px";
    picker.style.justifyContent = "center";

    approvedIcons.forEach(icon => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = icon;
        button.title = `Choose ${icon} avatar`;
        button.style.fontSize = "1.5em";
        button.style.padding = "6px 10px";
        button.style.border = icon === input.value ? "2px solid #007bff" : "1px solid #ccc";
        button.style.borderRadius = "6px";
        button.style.cursor = "pointer";
        button.style.background = "#fff";

        button.onclick = () => {
            input.value = icon;
            picker.querySelectorAll("button").forEach(option => {
                option.style.border = "1px solid #ccc";
            });
            button.style.border = "2px solid #007bff";
        };

        picker.appendChild(button);
    });
}

function escapeHTML(str) {
    return str.replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

async function hashPIN(pin) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pin);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
}

async function submitGroupRequest() {
    const groupName = escapeHTML(document.getElementById("groupNameInput").value.trim());
    const adminName = escapeHTML(document.getElementById("adminNameInput").value.trim());
    const contact = escapeHTML(document.getElementById("contactInput").value.trim());
    const pin = document.getElementById("pinInput").value.trim();
    const location = escapeHTML(document.getElementById("locationInput").value.trim());
    const description = escapeHTML(document.getElementById("descriptionInput").value.trim());

    if (!groupName || !adminName || !contact || !pin || !selectedIcon) {
        alert("Please fill out all required fields.");
        return;
    }

    const pinHash = await hashPIN(pin);
    const uid = window.auth.currentUser.uid;
    const requestId = crypto.randomUUID();

    // 1. Save admin request
    await setDoc(doc(window.db, "adminRequests", requestId), {
        groupName,
        adminName,
        contact,
        icon: selectedIcon,
        pinHash,
        location,
        description,
        requestedAt: Date.now(),
        approved: false,
        createdBy: uid
    });

    // 2. Create provisional admin entry
    await setDoc(doc(window.db, "admins", uid), {
        groupName,
        adminName,
        contact,
        icon: selectedIcon,
        pinHash,
        location,
        description,
        role: "provisionalAdmin",
        approved: false,
        createdAt: Date.now()
    });

    // 3. Create provisional admin profile
    await setDoc(doc(window.db, "profiles", uid), {
        profileId: uid,
        ownerUid: uid,
        name: adminName,
        nameNormalized: normalizeProfileName(adminName),
        avatar: selectedIcon,
        color: "#ffffff",
        role: "provisionalAdmin",
        adminId: uid,
        onlineCapable: true,
        location,
        description,
        lifetimeStats: buildDefaultLifetimeStats(),
        multiplayerStats: buildDefaultMultiplayerStats(),
        createdAt: Date.now(),
        updatedAt: Date.now()
    });

    alert("Your request has been submitted! You now have limited admin access until approved.");
    startMainMenu();
}

async function populateAdminDropdown() {
    const admins = await loadAllAdmins();
    const select = document.getElementById("adminSelect");

    select.innerHTML = ""; // clear loading text

    if (admins.length === 0) {
        // No admins exist yet → fallback to developer
        select.innerHTML = `
            <option value="">(No admins found — will assign to developer)</option>
        `;
        return;
    }

    admins.forEach(admin => {
        select.innerHTML += `
            <option value="${admin.id}">
                ${admin.name} (${admin.role})
            </option>
        `;
    });
}

function showCreateProfileForm() {
    // Hide other screens
    document.getElementById("screenMenu").style.display = "none";
    document.getElementById("screenSingleOptions").style.display = "none";
    document.getElementById("screenMultiOptions").style.display = "none";
    document.getElementById("screenQuiz").style.display = "none";

    // Show the profile selection screen container
    const container = document.getElementById("profileSelectScreen");
    container.style.display = "block";

    // Build the Create Profile UI
    container.innerHTML = `
        <h2 style="text-align:center;">Create New Profile</h2>

        <div style="
            max-width:300px;
            margin:20px auto;
            padding:20px;
            background:#f9f9f9;
            border-radius:10px;
            border:1px solid #ccc;
        ">
            <label>Name:</label><br>
            <input id="newProfileName" placeholder="Enter name" style="width:100%; margin-bottom:10px;"><br>

            <label>Choose Avatar:</label><br>
            <input id="newProfileAvatar" type="hidden" value="🙂">
            <div id="newProfileAvatarPicker" style="margin-bottom:15px;"></div>

            <label>Color (optional):</label><br>
            <input id="newProfileColor" placeholder="#4A90E2" style="width:100%; margin-bottom:20px;"><br>

            <label>Profile Access:</label><br>
            <select id="newProfileAccess" style="width:100%; margin-bottom:20px;">
                <option value="online" selected>Online capable</option>
                <option value="local">Local device only</option>
            </select>

            <label>Choose Admin / Group:</label><br>
            <select id="adminSelect" style="width:100%; margin-bottom:20px;">
                <option value="">Loading admins...</option>
            </select>

            <label>Choose a 4‑digit PIN:</label><br>
            <input id="newProfilePin" type="password" maxlength="4"
                   style="width:100%; font-size:20px; text-align:center; margin-bottom:10px;"><br>

            <label>Confirm PIN:</label><br>
            <input id="newProfilePinConfirm" type="password" maxlength="4"
                   style="width:100%; font-size:20px; text-align:center; margin-bottom:20px;"><br>

            <button onclick="createProfileFromForm()" style="width:100%; margin-bottom:10px;">
                Create Profile
            </button>

            <button onclick="showProfileSelection()" style="width:100%;">
                Back
            </button>
        </div>
    `;

    renderProfileAvatarPicker("newProfileAvatarPicker", "newProfileAvatar", "🙂");
    populateAdminDropdown();
}

async function viewCurrentProfile() {
    const profileId = localStorage.getItem("selectedProfileId");
    if (!profileId) {
        showProfileSelection();
        return;
    }
    await viewProfile(profileId);
}

async function showLeaderboard() {
    showScreen("leaderboardScreen");

    const container = document.getElementById("leaderboardScreen");
    container.style.display = "block";

    const profiles = await loadAllProfiles();
    const currentProfileId = localStorage.getItem("selectedProfileId");

    const rankedProfiles = profiles
        .map(profile => ({
            ...profile,
            stats: normalizeLifetimeStats(profile.lifetimeStats || {})
        }))
        .sort((a, b) => {
            if ((b.stats.totalPoints || 0) !== (a.stats.totalPoints || 0)) {
                return (b.stats.totalPoints || 0) - (a.stats.totalPoints || 0);
            }
            if ((b.stats.wins || 0) !== (a.stats.wins || 0)) {
                return (b.stats.wins || 0) - (a.stats.wins || 0);
            }
            return (b.stats.bestScore || 0) - (a.stats.bestScore || 0);
        });

    let html = `
        <h2 style="text-align:center;">Leaderboard</h2>
        <div style="max-width:800px; margin:20px auto; padding:20px; background:#f9f9f9; border:1px solid #ccc; border-radius:10px;">
            <table style="width:100%; border-collapse:collapse; text-align:left;">
                <thead>
                    <tr style="border-bottom:1px solid #ccc;">
                        <th style="padding:8px;">Rank</th>
                        <th style="padding:8px;">Profile</th>
                        <th style="padding:8px;">Points</th>
                        <th style="padding:8px;">Wins</th>
                        <th style="padding:8px;">Best</th>
                    </tr>
                </thead>
                <tbody>
    `;

    if (rankedProfiles.length === 0) {
        html += `
            <tr>
                <td colspan="5" style="padding:18px; text-align:center; opacity:0.7;">No profiles have recorded stats yet.</td>
            </tr>
        `;
    } else {
        rankedProfiles.forEach((profile, index) => {
            const isCurrent = profile.id === currentProfileId;
            html += `
                <tr style="border-bottom:1px solid #eee; ${isCurrent ? "background:#ecfdf5;" : ""}">
                    <td style="padding:10px 8px; font-weight:${isCurrent ? "bold" : "normal"};">#${index + 1}</td>
                    <td style="padding:10px 8px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <span style="font-size:1.6em;">${profile.avatar || "🙂"}</span>
                            <span>${profile.name || "Unnamed Profile"}${isCurrent ? " (You)" : ""}</span>
                        </div>
                    </td>
                    <td style="padding:10px 8px;">${profile.stats.totalPoints || 0}</td>
                    <td style="padding:10px 8px;">${profile.stats.wins || 0}</td>
                    <td style="padding:10px 8px;">${profile.stats.bestScore || 0}</td>
                </tr>
            `;
        });
    }

    html += `
                </tbody>
            </table>
        </div>
        <div style="text-align:center; margin-top:20px;">
            <button onclick="startMainMenu()">Back</button>
        </div>
    `;

    container.innerHTML = html;
}

async function viewProfile(profileId) {
    const profile = await loadProfile(profileId);
    if (!profile) {
        alert("Profile not found.");
        showProfileSelection();
        return;
    }

    document.getElementById("screenMenu").style.display = "none";
    document.getElementById("screenSingleOptions").style.display = "none";
    document.getElementById("screenMultiOptions").style.display = "none";
    document.getElementById("screenQuiz").style.display = "none";

    const container = document.getElementById("profileSelectScreen");
    container.style.display = "block";

    const singleStats = normalizeLifetimeStats(profile.lifetimeStats || {});
    const multiplayerStats = normalizeLifetimeStats(profile.multiplayerStats || {});
    const stats = combineProfileStats(singleStats, multiplayerStats);

    container.innerHTML = `
        <h2 style="text-align:center;">Profile Details</h2>

        <div style="max-width:600px; margin:20px auto; padding:20px; background:#f9f9f9; border:1px solid #ccc; border-radius:10px;">
            <div style="display:flex; align-items:center; gap:16px; margin-bottom:20px;">
                <div style="font-size:3em;">${profile.avatar || "🙂"}</div>
                <div>
                    <h3 style="margin:0;">${profile.name || "Unnamed Profile"}</h3>
                    <p style="margin:4px 0 0 0; opacity:0.7;">Role: ${profile.role || "member"}</p>
                </div>
            </div>

            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:20px;">
                <div><strong>Single Player Points:</strong> ${singleStats.totalPoints}</div>
                <div><strong>Local Multiplayer Points:</strong> ${multiplayerStats.totalPoints}</div>
                <div><strong>Combined Points:</strong> ${stats.totalPoints}</div>
                <h3 style="grid-column:1/-1; margin:8px 0 0;">Combined Stats</h3>
                <div><strong>Combined Games:</strong> ${stats.gamesPlayed}</div>
                <div><strong>Combined Wins:</strong> ${stats.wins}</div>
                <div><strong>Combined Losses:</strong> ${stats.losses}</div>
                <div><strong>Combined Correct:</strong> ${stats.correct}</div>
                <div><strong>Combined Incorrect:</strong> ${stats.incorrect}</div>
                <div><strong>Combined Points:</strong> ${stats.totalPoints}</div>
                <div><strong>Combined Best Score:</strong> ${stats.bestScore}</div>
                <div><strong>Combined Average Score:</strong> ${formatStat(stats.averageScore)}</div>
                <div><strong>Combined Fastest Correct:</strong> ${stats.fastestCorrectAnswer ?? "—"}</div>
                <div><strong>Combined Best Streak:</strong> ${stats.streakBest}</div>
            </div>

            <h3 style="margin:20px 0 10px;">Local Multiplayer Stats</h3>
            <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:12px; margin-bottom:20px;">
                <div><strong>Games:</strong> ${multiplayerStats.gamesPlayed}</div>
                <div><strong>Wins:</strong> ${multiplayerStats.wins}</div>
                <div><strong>Losses:</strong> ${multiplayerStats.losses}</div>
                <div><strong>Correct:</strong> ${multiplayerStats.correct}</div>
                <div><strong>Incorrect:</strong> ${multiplayerStats.incorrect}</div>
                <div><strong>Best Score:</strong> ${multiplayerStats.bestScore}</div>
                <div><strong>Average Score:</strong> ${formatStat(multiplayerStats.averageScore)}</div>
                <div><strong>Fastest Answer:</strong> ${multiplayerStats.fastestCorrectAnswer ?? "—"}</div>
            </div>

            <div style="margin-bottom:20px;">
                <p><strong>Group:</strong> ${profile.groupName || "No group joined"}</p>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">
                <button onclick="editProfile('${profileId}')">Edit Profile</button>
                <button onclick="showCreateGroupForm()">Create / Join Group</button>
                <button onclick="leaveGroup('${profileId}')">Leave Group</button>
                <button onclick="startMainMenu()">Back</button>
            </div>
        </div>
    `;
}

async function editProfile(profileIdOverride) {
    const profileId = profileIdOverride || localStorage.getItem("selectedProfileId");
    if (!profileId) return;

    const profile = await loadProfile(profileId);
    const container = document.getElementById("profileSelectScreen");

    document.getElementById("screenMenu").style.display = "none";
    document.getElementById("screenSingleOptions").style.display = "none";
    document.getElementById("screenMultiOptions").style.display = "none";
    document.getElementById("screenQuiz").style.display = "none";

    container.style.display = "block";

    container.innerHTML = `
        <h2 style="text-align:center;">Edit Profile</h2>

        <div style="
            max-width:350px;
            margin:20px auto;
            padding:20px;
            background:#f9f9f9;
            border-radius:10px;
            border:1px solid #ccc;
        ">
            <label>Name:</label><br>
            <input id="editProfileName" value="${profile.name}" style="width:100%; margin-bottom:10px;"><br>

            <label>Choose Avatar:</label><br>
            <input id="editProfileAvatar" type="hidden" value="${profile.avatar || "🙂"}">
            <div id="editProfileAvatarPicker" style="margin-bottom:15px;"></div>

            <label>Color:</label><br>
            <input id="editProfileColor" value="${profile.color}" style="width:100%; margin-bottom:10px;"><br>

            <label>Profile Access:</label><br>
            <select id="editProfileAccess" style="width:100%; margin-bottom:20px;">
                <option value="online" ${profile.onlineCapable !== false ? "selected" : ""}>Online capable</option>
                <option value="local" ${profile.onlineCapable === false ? "selected" : ""}>Local device only</option>
            </select>

            <label>New 4-digit PIN:</label><br>
            <input id="editProfilePin" type="password" maxlength="4" style="width:100%; font-size:20px; text-align:center; margin-bottom:10px;"><br>

            <label>Confirm New PIN:</label><br>
            <input id="editProfilePinConfirm" type="password" maxlength="4" style="width:100%; font-size:20px; text-align:center; margin-bottom:20px;"><br>

            <button onclick="saveProfileEdits('${profileId}')" style="width:100%; margin-bottom:10px;">
                Save Changes
            </button>

            <button onclick="viewProfile('${profileId}')" style="width:100%; margin-bottom:10px;">
                Profile View
            </button>

            <button onclick="startMainMenu()" style="width:100%;">
                Cancel
            </button>
        </div>
    `;

    renderProfileAvatarPicker("editProfileAvatarPicker", "editProfileAvatar", profile.avatar || "🙂");
}

async function leaveGroup(profileId) {
    const ref = doc(window.db, "profiles", profileId);
    await updateDoc(ref, {
        groupId: null,
        groupName: null,
        updatedAt: Date.now()
    });
    alert("You left the group.");
    await viewProfile(profileId);
}

async function saveProfileEdits(profileId) {
    const name = document.getElementById("editProfileName").value.trim();
    const avatar = document.getElementById("editProfileAvatar").value.trim();
    const color = document.getElementById("editProfileColor").value.trim();
    const onlineCapable = document.getElementById("editProfileAccess").value === "online";
    const newPin = document.getElementById("editProfilePin")?.value.trim() || "";
    const confirmPin = document.getElementById("editProfilePinConfirm")?.value.trim() || "";

    if (!name) {
        alert("Name cannot be empty");
        return;
    }

    if (newPin || confirmPin) {
        if (!/^\d{4}$/.test(newPin)) {
            alert("New PIN must be exactly 4 digits.");
            return;
        }
        if (newPin !== confirmPin) {
            alert("New PINs do not match.");
            return;
        }
    }

    const user = window.auth.currentUser;
    if (!user) {
        alert("You must be signed in to edit a profile.");
        return;
    }

    const ref = doc(window.db, "profiles", profileId);
    const updates = {
        name,
        nameNormalized: normalizeProfileName(name),
        avatar,
        color,
        onlineCapable,
        ownerUid: user.uid,
        adminId: user.uid,
        role: "member",
        updatedAt: Date.now()
    };

    if (newPin) {
        updates.pinHash = await hashPIN(newPin);
    }

    await updateDoc(ref, updates);

    startMainMenu();
}

async function createProfileFromForm() {
    const name = document.getElementById("newProfileName").value.trim();
    const avatar = document.getElementById("newProfileAvatar").value.trim() || "🙂";
    const color = document.getElementById("newProfileColor").value.trim() || "#4A90E2";
    const onlineCapable = document.getElementById("newProfileAccess").value === "online";
    const adminId = document.getElementById("adminSelect").value;

    const pin = document.getElementById("newProfilePin").value.trim();
    const pinConfirm = document.getElementById("newProfilePinConfirm").value.trim();

    if (!name) {
        alert("Please enter a name.");
        return;
    }

    if (!/^\d{4}$/.test(pin)) {
        alert("PIN must be exactly 4 digits.");
        return;
    }

    if (pin !== pinConfirm) {
        alert("PINs do not match.");
        return;
    }

    // Create the profile
    const profileId = await createPlayerProfile(name, avatar, color, pin, adminId, onlineCapable);

    // Unlock for this session
    sessionUnlockedProfileId = profileId;

    // Go to main menu
    await finalizeProfileSelection(profileId);
}


async function selectProfile(profileId) {
    console.log("Selecting profile:", profileId);

    // If this profile is already unlocked this session, skip PIN
    if (isProfileUnlocked(profileId)) {
        console.log("Profile already unlocked this session.");
        await finalizeProfileSelection(profileId);
        return;
    }

    // Otherwise, show PIN screen
    showPinEntryScreen(profileId);
}

async function finalizeProfileSelection(profileId) {
    console.log("Finalizing profile selection:", profileId);

    // Save selected profile for reloads
    localStorage.setItem("selectedProfileId", profileId);
    rememberProfileOnDevice(profileId);

    // Unlock this profile for the current session
    unlockProfileSession(profileId);

    // Load the profile from Firestore
    const profile = await loadProfile(profileId);

    if (!profile) {
        console.error("Profile not found:", profileId);
        showProfileSelection();
        return;
    }

    // Persist compatibility value used by older single-player startup logic
    localStorage.setItem("selectedProfile", JSON.stringify(profile));

    // Store it globally so the rest of the app can use it
    window.currentProfile = profile;

    // Continue to main menu
    startMainMenu(profileId);
}

function showPinEntryScreen(profileId) {
    showScreen("profilePinScreen");

    const screen = document.getElementById("profilePinScreen");
    screen.dataset.profileId = profileId;
}

async function submitProfilePin() {
    const screen = document.getElementById("profilePinScreen");
    const profileId = screen.dataset.profileId;
    const pin = document.getElementById("profilePinInput").value.trim();

    const profile = await loadProfile(profileId);

    if (!profile || !profile.pinHash) {
        alert("Profile missing PIN.");
        return;
    }

    const enteredHash = await hashPIN(pin);
    if (enteredHash === profile.pinHash) {
        sessionUnlockedProfileId = profileId; // unlock for this session
        await finalizeProfileSelection(profileId);
    } else {
        alert("Incorrect PIN.");
    }
}

async function updateActiveProfileDisplay() {
    const profileId = localStorage.getItem("selectedProfileId");
    const display = document.getElementById("activeProfileDisplay");

    if (!profileId) {
        display.innerHTML = "";
        return;
    }

    const profile = await loadProfile(profileId);

    if (!profile) {
        display.innerHTML = "";
        return;
    }

    display.innerHTML = `
        <div style="display:flex; justify-content:center; align-items:center; gap:10px;">
            <span style="font-size:1.8em;">${profile.avatar}</span>
            <span style="font-size:1.2em; font-weight:bold;">${profile.name}</span>
            <span style="font-size:0.9em; opacity:0.7;">(${profile.role})</span>
        </div>
    `;
}
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

 
function backToMenu() {
    showScreen("screenMenu");
	  // Show scoreboard again
  document.getElementById("scoreboard").style.display = "block";
}

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
    let closest = null;
    let closestOffset = Number.NEGATIVE_INFINITY;

    tiles.forEach(tile => {
        const rect = tile.getBoundingClientRect();
        const tileCenterX = rect.left + rect.width / 2;
        const offset = x - tileCenterX;

        // We want the closest tile whose center is to the RIGHT of the finger
        if (offset < 0 && offset > closestOffset) {
            closestOffset = offset;
            closest = tile;
        }
    });

    return closest; // null means "append at end"
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

function awardPoints(basePoints, timeLeft = 0, ) {
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
                        .catch(err => console.error("Error updating stats:", err));
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
            </div>
        `;

        document.getElementById("controls").innerHTML = `
            <button onclick="startNewGame()">Play Again</button>
            <button onclick="backToMenu()">Back to Menu</button>
        `;
    });
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
        .catch(err => console.error("Error updating multiplayer stats:", err));

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

async function showDeveloperDashboard() {
    // Hide other screens
    document.getElementById("screenMenu").style.display = "none";
    document.getElementById("screenSingleOptions").style.display = "none";
    document.getElementById("screenMultiOptions").style.display = "none";
    document.getElementById("screenQuiz").style.display = "none";

    const container = document.getElementById("profileSelectScreen");
    container.style.display = "block";

    // Load pending admin requests
    const q = query(collection(window.db, "adminRequests"), where("approved", "==", false));
    const snap = await getDocs(q);

    let html = `
        <h2 style="text-align:center;">Developer Dashboard</h2>
        <h3 style="text-align:center; margin-top:-10px;">Pending Admin Requests</h3>
        <div style="max-width:600px; margin:20px auto;">
    `;

    if (snap.empty) {
        html += `<p style="text-align:center; opacity:0.7;">No pending requests.</p>`;
    } else {
        snap.forEach(docSnap => {
            const r = docSnap.data();

            html += `
                <div style="
                    border:1px solid #ccc;
                    padding:15px;
                    border-radius:8px;
                    margin-bottom:15px;
                    background:#fafafa;
                ">
                    <div style="font-size:2em;">${r.icon}</div>
                    <h3>${r.groupName}</h3>
                    <p><strong>Admin Name:</strong> ${r.adminName}</p>
                    <p><strong>Contact:</strong> ${r.contact}</p>
                    <p><strong>Location:</strong> ${r.location || "—"}</p>
                    <p><strong>Description:</strong> ${r.description || "—"}</p>

                    <button onclick="approveAdminRequest('${docSnap.id}', '${r.createdBy}')">
                        Approve
                    </button>
                    <button onclick="denyAdminRequest('${docSnap.id}', '${r.createdBy}')">
                        Deny
                    </button>
                </div>
            `;
        });
    }

    html += `
        </div>
        <div style="text-align:center;">
            <button onclick="startMainMenu()">Back</button>
        </div>
    `;

    container.innerHTML = html;
}

async function approveAdminRequest(requestId, userUid) {
    const reqRef = doc(window.db, "adminRequests", requestId);
    const reqSnap = await getDoc(reqRef);

    if (!reqSnap.exists()) {
        alert("Request not found.");
        return;
    }

    const r = reqSnap.data();

    // 1. Update admin doc
    await updateDoc(doc(window.db, "admins", userUid), {
        role: "admin",
        approved: true,
        approvedAt: Date.now(),
        approvedBy: window.DEVELOPER_UID
    });

    // 2. Update profile
    await updateDoc(doc(window.db, "profiles", userUid), {
        role: "admin",
        updatedAt: Date.now()
    });

    // 3. Mark request approved
    await updateDoc(reqRef, {
        approved: true,
        approvedAt: Date.now(),
        approvedBy: window.DEVELOPER_UID
    });

    alert("Admin approved successfully.");
    showDeveloperDashboard();
}

async function denyAdminRequest(requestId, userUid) {
    const reqRef = doc(window.db, "adminRequests", requestId);

    // 1. Mark request denied
    await updateDoc(reqRef, {
        approved: false,
        denied: true,
        deniedAt: Date.now(),
        deniedBy: window.DEVELOPER_UID
    });

    // 2. Remove provisional admin doc
    await deleteDoc(doc(window.db, "admins", userUid));

    // 3. Convert profile back to normal member
    await updateDoc(doc(window.db, "profiles", userUid), {
        role: "member",
        adminId: window.DEVELOPER_UID, // fallback
        updatedAt: Date.now()
    });

    alert("Admin request denied.");
    showDeveloperDashboard();
}

// Multiplayer stats are recorded by profile-stats-service.js.





