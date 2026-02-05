
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
        "profileSelectScreen",
        "profilePinScreen",
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


function startMainMenu() {
    showScreen("screenMenu");

    // Add Developer Dashboard button if developer is logged in
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

async function showProfileSelection() {
    // Hide all other screens
    document.getElementById("screenMenu").style.display = "none";
    document.getElementById("screenSingleOptions").style.display = "none";
    document.getElementById("screenMultiOptions").style.display = "none";
    document.getElementById("screenQuiz").style.display = "none";

    // Show the profile selection screen
    const container = document.getElementById("profileSelectScreen");
    container.style.display = "block";

    // Load all profiles from Firestore
    const profiles = await loadAllProfiles();

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
            <div onclick="selectProfile('${p.id}')" style="
                padding:15px;
                border:1px solid #ccc;
                border-radius:8px;
                cursor:pointer;
                width:150px;
                background:#f9f9f9;
                text-align:center;
                transition:0.2s;
            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                <div style="font-size:2em;">${p.avatar || "🙂"}</div>
                <h3 style="margin:10px 0 5px 0;">${p.name}</h3>
            </div>
        `;
    });

   html += `
    </div>

    <div style="text-align:center; margin-top:25px;">
        <button onclick="showCreateProfileForm()">Create New Profile</button>
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
        name: adminName,
        avatar: selectedIcon,
        color: "#ffffff",
        role: "provisionalAdmin",
        adminId: uid,
        location,
        description,
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

            <label>Avatar (emoji):</label><br>
            <input id="newProfileAvatar" placeholder="🙂" style="width:100%; margin-bottom:10px;"><br>

            <label>Color (optional):</label><br>
            <input id="newProfileColor" placeholder="#4A90E2" style="width:100%; margin-bottom:20px;"><br>

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

    populateAdminDropdown();
}

async function editProfile() {
    const profileId = localStorage.getItem("selectedProfileId");
    if (!profileId) return;

    const profile = await loadProfile(profileId);
    const container = document.getElementById("profileSelectScreen");

    // Hide other screens
    document.getElementById("screenMenu").style.display = "none";
    document.getElementById("screenSingleOptions").style.display = "none";
    document.getElementById("screenMultiOptions").style.display = "none";
    document.getElementById("screenQuiz").style.display = "none";

    container.style.display = "block";

    container.innerHTML = `
        <h2 style="text-align:center;">Edit Profile</h2>

        <div style="
            max-width:300px;
            margin:20px auto;
            padding:20px;
            background:#f9f9f9;
            border-radius:10px;
            border:1px solid #ccc;
        ">
            <label>Name:</label><br>
            <input id="editProfileName" value="${profile.name}" style="width:100%; margin-bottom:10px;"><br>

            <label>Avatar (emoji):</label><br>
            <input id="editProfileAvatar" value="${profile.avatar}" style="width:100%; margin-bottom:10px;"><br>

            <label>Color:</label><br>
            <input id="editProfileColor" value="${profile.color}" style="width:100%; margin-bottom:20px;"><br>

            <button onclick="saveProfileEdits('${profileId}')" style="width:100%; margin-bottom:10px;">
                Save Changes
            </button>

            <button onclick="startMainMenu()" style="width:100%;">
                Cancel
            </button>
        </div>
    `;
}

async function saveProfileEdits(profileId) {
    const name = document.getElementById("editProfileName").value.trim();
    const avatar = document.getElementById("editProfileAvatar").value.trim();
    const color = document.getElementById("editProfileColor").value.trim();

    if (!name) {
        alert("Name cannot be empty");
        return;
    }

    const ref = doc(window.db, "profiles", profileId);

    await setDoc(ref, {
	  name,
	  avatar,
	  color,
	  role: "member",          // default for now
	  adminId: window.auth.currentUser.uid,  // temporary until admin selection UI
	  lifetimeStats: {
		gamesPlayed: 0,
		correct: 0,
		incorrect: 0,
		fastestTime: null,
		averageTime: null,
		streakBest: 0
	  },
	  createdAt: Date.now(),
	  updatedAt: Date.now()
	});

    startMainMenu();
}

async function createProfileFromForm() {
    const name = document.getElementById("newProfileName").value.trim();
    const avatar = document.getElementById("newProfileAvatar").value.trim() || "🙂";
    const color = document.getElementById("newProfileColor").value.trim() || "#4A90E2";
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
    const profileId = await createPlayerProfile(name, avatar, color, pin, adminId);

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

    // Unlock this profile for the current session
    unlockProfileSession(profileId);

    // Load the profile from Firestore
    const profile = await loadProfile(profileId);

    if (!profile) {
        console.error("Profile not found:", profileId);
        showProfileSelection();
        return;
    }

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

    if (hash(pin) === profile.pinHash) {
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

function startSinglePlayerGame() {

    // Get selected profile
    const profile = JSON.parse(localStorage.getItem("selectedProfile"));
    const name = profile ? profile.name : "Player";

    const rounds = parseInt(document.getElementById("singlePlayerRoundsInput").value);
    const quizTypeUI = document.getElementById("singlePlayerQuizType").value;
    const testamentUI = document.getElementById("singlePlayerTestament").value;
    const timerEnabledUI = document.getElementById("singlePlayerTimerToggle").checked;
    const timeBonusUI = document.getElementById("singlePlayerTimeBonus").checked;
    const timerLengthUI = parseInt(document.getElementById("singlePlayerTimerLength").value);

    // Store settings
    singlePlayerSettings = {
        name,
        rounds,
        quizType: quizTypeUI,
        testament: testamentUI,
        timerEnabled: timerEnabledUI,
        timeBonus: timeBonusUI,
        timerLength: timerLengthUI
    };

    // Initialize player object
    currentPlayer = {
        name,
        profileId: profile.id,
        points: 0,
        correct: 0,
        incorrect: 0,
        avgTime: 0,
        totalTime: 0,
        questionsAnswered: 0,
        fastestTime: null
    };

    // Apply settings globally
    totalRounds = rounds;
    currentRound = 1;
    quizType = quizTypeUI;
    testament = testamentUI;
    timerEnabled = timerEnabledUI;
    timeBonusEnabled = timeBonusUI;
    timerLength = timerLengthUI;

    // Start the game
    gameMode = "single";
    showScreen("screenQuiz");
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

                    const updatedStats = {
                        gamesPlayed: (lifetime.gamesPlayed || 0) + 1,
                        correct: (lifetime.correct || 0) + roundStats.correct,
                        incorrect: (lifetime.incorrect || 0) + roundStats.incorrect,
                        fastestTime:
                            lifetime.fastestTime === null
                                ? roundStats.fastestTime
                                : Math.min(lifetime.fastestTime, roundStats.fastestTime),
                        averageTime:
                            lifetime.averageTime === null
                                ? roundStats.averageTime
                                : (lifetime.averageTime + roundStats.averageTime) / 2,
                        streakBest: Math.max(lifetime.streakBest || 0, roundStats.streakBest || 0)
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

async function createPlayerProfile(name, avatar, color, pin, adminId) {
    const ref = doc(collection(window.db, "profiles"));

    const pinHash = btoa(pin);

    const profileData = {
        name,
        avatar,
        color,
        pinHash,
        ownerType: "pin",
        role: "member",        // ⭐ restored role
        adminId: adminId || null,

        lifetimeStats: {
            gamesPlayed: 0,
            correct: 0,
            incorrect: 0,
            fastestTime: null,
            averageTime: null,
            streakBest: 0
        },

        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    await setDoc(ref, profileData);
    return ref.id;
}

function hash(str) {
    return btoa(str); // not secure, but works for testing
}

async function loadAllProfiles() {
    const profilesCol = collection(window.db, "profiles");
    const snapshot = await getDocs(profilesCol);

    const profiles = [];
    snapshot.forEach(doc => {
        profiles.push({ id: doc.id, ...doc.data() });
    });

    return profiles;
}

async function loadProfile(profileId) {
    const ref = doc(window.db, "profiles", profileId);
    const snapshot = await getDoc(ref);

    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function loadAllAdmins() {
    const adminsRef = collection(window.db, "admins");
    const snapshot = await getDocs(adminsRef);
    const admins = [];

    snapshot.forEach(doc => {
        admins.push({ id: doc.id, ...doc.data() });
    });

    return admins;
}

function isAdmin(profile) {
  return profile.role === "admin";
}

function isDeveloper(profile) {
  return profile.role === "developer";
}

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

async function updateLifetimeStats(profileId, updates, pinHash) {
    const ref = doc(window.db, "profiles", profileId);

    await updateDoc(ref, {
        lifetimeStats: updates,
        updatedAt: Date.now(),
        pinHashProvided: pinHash
    });
}





