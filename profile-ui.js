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

    // Load only profiles previously used on this device
    let profiles = [];
    try {
        profiles = await loadRememberedProfiles();
    } catch (err) {
        console.error("Failed to load profiles:", err);
        container.innerHTML = `
            <h2 style="text-align:center;">Unable to Load Profiles</h2>
            <p style="text-align:center; opacity:0.75;">Check your internet connection and try again.</p>
            <div style="text-align:center; margin-top:20px;">
                <button onclick="showProfileSelection()">Retry</button>
            </div>
        `;
        return;
    }
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
    let profile;
    try {
        profile = await loadProfile(profileId);
    } catch (err) {
        console.error("Failed to load profile (offline?):", err);
        showProfileSelection();
        return;
    }

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
