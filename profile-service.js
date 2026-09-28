async function createPlayerProfile(name, avatar, color, pin, adminId, onlineCapable = true) {
    const ref = doc(collection(window.db, "profiles"));
    const user = window.auth?.currentUser;
    const pinHash = await hashPIN(pin);

    const profileData = {
        profileId: ref.id,
        ownerUid: user ? user.uid : null,
        name,
        nameNormalized: normalizeProfileName(name),
        avatar,
        color,
        pinHash,
        onlineCapable,
        ownerType: "pin",
        role: "member",
        adminId: adminId || null,
        isGuest: false,
        groupId: null,
        groupName: null,
        lifetimeStats: buildDefaultLifetimeStats(),
        multiplayerStats: buildDefaultMultiplayerStats(),
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    await setDoc(ref, profileData);
    return ref.id;
}

async function hash(str) {
    return hashPIN(str);
}

async function loadAllProfiles() {
    const profilesCol = collection(window.db, "profiles");
    const snapshot = await getDocs(profilesCol);

    const profiles = [];
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        profiles.push({
            id: docSnap.id,
            ...data,
            onlineCapable: data.onlineCapable !== false,
            lifetimeStats: normalizeLifetimeStats(data.lifetimeStats || {}),
            multiplayerStats: normalizeLifetimeStats(data.multiplayerStats || {})
        });
    });

    return profiles;
}

async function loadProfile(profileId) {
    const ref = doc(window.db, "profiles", profileId);
    const snapshot = await getDoc(ref);

    if (!snapshot.exists()) return null;

    const data = snapshot.data();
    return {
        id: snapshot.id,
        ...data,
        onlineCapable: data.onlineCapable !== false,
        lifetimeStats: normalizeLifetimeStats(data.lifetimeStats || {}),
        multiplayerStats: normalizeLifetimeStats(data.multiplayerStats || {})
    };
}

async function loadAllAdmins() {
    const adminsRef = collection(window.db, "admins");
    const snapshot = await getDocs(adminsRef);
    const admins = [];

    snapshot.forEach(adminSnapshot => {
        admins.push({ id: adminSnapshot.id, ...adminSnapshot.data() });
    });

    return admins;
}

function isAdmin(profile) {
    return profile.role === "admin";
}

function isDeveloper(profile) {
    return profile.role === "developer";
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

function isProfileUnlocked(profileId) {
    return sessionStorage.getItem("profileUnlocked") === profileId;
}

function unlockProfileSession(profileId) {
    sessionStorage.setItem("profileUnlocked", profileId);
}

function clearProfileUnlock() {
    sessionStorage.removeItem("profileUnlocked");
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
    const profiles = await Promise.all(rememberedIds.map(profileId =>
        loadProfile(profileId).catch(err => {
            console.error("Failed to load remembered profile", profileId, err);
            return null;
        })
    ));
    return profiles.filter(Boolean);
}
