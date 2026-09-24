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
