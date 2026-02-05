// developer-dashboard.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ---------- Firebase config ----------
const firebaseConfig = {
    apiKey: "AIzaSyCoS4UP2YNd3RG-5KEf6t1xr890MV2bG1A",
    authDomain: "biblequizgame.firebaseapp.com",
    projectId: "biblequizgame",
    storageBucket: "biblequizgame.firebasestorage.app",
    messagingSenderId: "165417801422",
    appId: "1:165417801422:web:e07ba29e4b0f8cb3dde29f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Developer UID
const DEVELOPER_UID = "QANElecfZHe2n1BmtQ39Q7E9bNu1";

// ---------- Tabs ----------
const tabButtons = document.querySelectorAll("#tabs button");
const tabContents = document.querySelectorAll(".tabContent");

tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        const tabId = btn.getAttribute("data-tab");
        tabButtons.forEach(b => b.classList.remove("active"));
        tabContents.forEach(c => c.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(tabId).classList.add("active");
    });
});

// ---------- Modal helpers ----------
const modalOverlay = document.getElementById("modalOverlay");
const modalBox = document.getElementById("modalBox");
const modalContent = document.getElementById("modalContent");
const modalClose = document.getElementById("modalClose");

function openModal(html) {
    modalContent.innerHTML = html;
    modalOverlay.style.display = "flex";
}

function closeModal() {
    modalOverlay.style.display = "none";
    modalContent.innerHTML = "";
}

modalClose.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
});

// ---------- Auth gate ----------
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("Not signed in. Redirecting to admin login.");
        window.location.href = "admin-login.html";
        return;
    }

    if (user.uid !== DEVELOPER_UID) {
        alert("Access denied. You are not the developer.");
        window.location.href = "index.html";
        return;
    }

    await Promise.all([
        loadPendingRequests(),
        loadAdmins(),
        loadGroups(),
        loadMembers(),
        loadProfiles()
    ]);

    setupTools();
    setupProfilesSearch();
    setupFixMissingFields();
});

function decodePinHash(pinHash) {
    try {
        return atob(pinHash);
    } catch {
        return "—";
    }
}

// ---------- Pending Requests ----------
async function loadPendingRequests() {
    const container = document.getElementById("pendingRequestsContainer");
    container.innerHTML = "Loading...";

    const qReq = query(collection(db, "adminRequests"), where("approved", "==", false));
    const snap = await getDocs(qReq);

    if (snap.empty) {
        container.innerHTML = "<p>No pending requests.</p>";
        return;
    }

    container.innerHTML = "";
    snap.forEach(docSnap => {
        const r = docSnap.data();
        const id = docSnap.id;

        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <div style="font-size:2em;">${r.icon || "👤"}</div>
            <h3>${r.groupName || "(No group name)"}</h3>
            <p><strong>Admin Name:</strong> ${r.adminName || "—"}</p>
            <p><strong>Contact:</strong> ${r.contact || "—"}</p>
            <p><strong>Location:</strong> ${r.location || "—"}</p>
            <p><strong>Description:</strong> ${r.description || "—"}</p>
            <p class="small"><strong>Created By UID:</strong> ${r.createdBy || "—"}</p>
        `;

        const approveBtn = document.createElement("button");
        approveBtn.textContent = "Approve";
        approveBtn.onclick = () => approveAdminRequest(id, r.createdBy, r);

        const denyBtn = document.createElement("button");
        denyBtn.textContent = "Deny";
        denyBtn.onclick = () => denyAdminRequest(id, r.createdBy);

        card.appendChild(approveBtn);
        card.appendChild(denyBtn);

        container.appendChild(card);
    });
}

async function approveAdminRequest(requestId, userUid, requestData) {
    if (!userUid) {
        alert("Request has no createdBy UID. Cannot approve.");
        return;
    }

    const adminRef = doc(db, "admins", userUid);
    const adminSnap = await getDoc(adminRef);

    const adminData = {
        groupName: requestData.groupName || "",
        adminName: requestData.adminName || "",
        contact: requestData.contact || "",
        icon: requestData.icon || "👤",
        description: requestData.description || "",
        role: "admin",
        approved: true,
        approvedAt: Date.now(),
        approvedBy: DEVELOPER_UID
    };

    if (!adminSnap.exists()) {
        await setDoc(adminRef, adminData);
    } else {
        await updateDoc(adminRef, adminData);
    }

    const profileRef = doc(db, "profiles", userUid);
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
        await updateDoc(profileRef, {
            role: "admin",
            adminId: userUid,
            updatedAt: Date.now()
        });
    }

    const reqRef = doc(db, "adminRequests", requestId);
    await updateDoc(reqRef, {
        approved: true,
        approvedAt: Date.now(),
        approvedBy: DEVELOPER_UID
    });

    alert("Admin approved.");
    await loadPendingRequests();
    await loadAdmins();
    await loadGroups();
}

async function denyAdminRequest(requestId, userUid) {
    const reqRef = doc(db, "adminRequests", requestId);
    await updateDoc(reqRef, {
        approved: false,
        denied: true,
        deniedAt: Date.now(),
        deniedBy: DEVELOPER_UID
    });

    if (userUid) {
        const adminRef = doc(db, "admins", userUid);
        const adminSnap = await getDoc(adminRef);
        if (adminSnap.exists()) {
            await deleteDoc(adminRef);
        }

        const profileRef = doc(db, "profiles", userUid);
        const profileSnap = await getDoc(profileRef);
        if (profileSnap.exists()) {
            await updateDoc(profileRef, {
                role: "member",
                updatedAt: Date.now()
            });
        }
    }

    alert("Admin request denied.");
    await loadPendingRequests();
    await loadAdmins();
    await loadGroups();
}

// ---------- Admins ----------

async function loadAdmins() {
    const container = document.getElementById("adminsContainer");
    container.innerHTML = "Loading...";

    const snap = await getDocs(collection(db, "admins"));
    if (snap.empty) {
        container.innerHTML = "<p>No admins found.</p>";
        return;
    }

    container.innerHTML = "";
    for (const docSnap of snap.docs) {
        const a = docSnap.data();
        const uid = docSnap.id;

        const card = document.createElement("div");
        card.className = "card";

        // Fetch profile to get PIN hash
        const profileRef = doc(db, "profiles", uid);
        const profileSnap = await getDoc(profileRef);
        let pinHash = "—";
        let pin = "—";

        if (profileSnap.exists()) {
            pinHash = profileSnap.data().pinHash || "—";
            pin = decodePinHash(pinHash);
        }

        card.innerHTML = `
            <div style="font-size:2em;">${a.icon || "👤"}</div>
            <h3>${a.groupName || "(No group name)"}</h3>
            <p><strong>Admin Name:</strong> ${a.adminName || "—"}</p>
            <p><strong>Contact:</strong> ${a.contact || "—"}</p>
            <p><strong>Role:</strong> ${a.role || "—"}</p>
            <p><strong>PIN:</strong> ${pin}</p>
            <p><strong>PIN Hash:</strong> ${pinHash}</p>
            <p class="small"><strong>Admin UID:</strong> ${uid}</p>
        `;

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit Group Info";
        editBtn.onclick = () => editAdminGroupInfo(uid, a);

        const resetPinBtn = document.createElement("button");
        resetPinBtn.textContent = "Reset PIN (manual)";
        resetPinBtn.onclick = () => {
            alert("Implement PIN reset flow here (e.g., set new pinHash on profile).");
        };

        const viewMembersBtn = document.createElement("button");
        viewMembersBtn.textContent = "View Members";
        viewMembersBtn.onclick = () => {
            document.querySelector('#tabs button[data-tab="membersTab"]').click();
            const filter = document.getElementById("memberAdminFilter");
            filter.value = uid;
            loadMembers();
        };

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete Admin";
        deleteBtn.onclick = () => deleteAdmin(uid);

        card.appendChild(editBtn);
        card.appendChild(resetPinBtn);
        card.appendChild(viewMembersBtn);
        card.appendChild(deleteBtn);

        container.appendChild(card);
    }

    await populateMemberAdminFilter();
}
async function editAdminGroupInfo(adminUid, adminData) {
    const newName = prompt("New group name:", adminData.groupName || "");
    if (newName === null) return;

    const newContact = prompt("New contact:", adminData.contact || "");
    if (newContact === null) return;

    const newDesc = prompt("New description:", adminData.description || "");
    if (newDesc === null) return;

    await updateDoc(doc(db, "admins", adminUid), {
        groupName: newName,
        contact: newContact,
        description: newDesc,
        updatedAt: Date.now()
    });

    alert("Group info updated.");
    await loadAdmins();
    await loadGroups();
}

async function deleteAdmin(adminUid) {
    const confirmDelete = confirm(
        "Delete this admin? Members will still reference this adminId unless you reassign them manually."
    );
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "admins", adminUid));

    const profileRef = doc(db, "profiles", adminUid);
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
        await updateDoc(profileRef, {
            role: "member",
            updatedAt: Date.now()
        });
    }

    alert("Admin deleted.");
    await loadAdmins();
    await loadGroups();
    await loadMembers();
}

// ---------- Groups ----------
async function loadGroups() {
    const container = document.getElementById("groupsContainer");
    container.innerHTML = "Loading...";

    const snap = await getDocs(collection(db, "admins"));
    if (snap.empty) {
        container.innerHTML = "<p>No groups found.</p>";
        return;
    }

    container.innerHTML = "";
    const admins = [];
    snap.forEach(docSnap => {
        admins.push({ id: docSnap.id, ...docSnap.data() });
    });

    for (const admin of admins) {
        const card = document.createElement("div");
        card.className = "card";

        const qMembers = query(
            collection(db, "profiles"),
            where("adminId", "==", admin.id)
        );
        const membersSnap = await getDocs(qMembers);
        const memberCount = membersSnap.size;

        card.innerHTML = `
            <div style="font-size:2em;">${admin.icon || "👤"}</div>
            <h3>${admin.groupName || "(No group name)"}</h3>
            <p><strong>Admin Name:</strong> ${admin.adminName || "—"}</p>
            <p><strong>Members:</strong> ${memberCount}</p>
            <p class="small"><strong>Admin UID:</strong> ${admin.id}</p>
        `;

        const viewMembersBtn = document.createElement("button");
        viewMembersBtn.textContent = "View Members";
        viewMembersBtn.onclick = () => {
            document.querySelector('#tabs button[data-tab="membersTab"]').click();
            const filter = document.getElementById("memberAdminFilter");
            filter.value = admin.id;
            loadMembers();
        };

        card.appendChild(viewMembersBtn);
        container.appendChild(card);
    }
}

// ---------- Members ----------
async function populateMemberAdminFilter() {
    const select = document.getElementById("memberAdminFilter");
    select.innerHTML = '<option value="">All admins</option>';

    const snap = await getDocs(collection(db, "admins"));
    snap.forEach(docSnap => {
        const a = docSnap.data();
        const opt = document.createElement("option");
        opt.value = docSnap.id;
        opt.textContent = a.groupName ? `${a.groupName} (${docSnap.id})` : docSnap.id;
        select.appendChild(opt);
    });

    select.onchange = () => loadMembers();
}

async function loadMembers() {
    const container = document.getElementById("membersContainer");
    container.innerHTML = "Loading...";

    const filterAdminId = document.getElementById("memberAdminFilter").value;

    let qProfiles;
    if (filterAdminId) {
        qProfiles = query(
            collection(db, "profiles"),
            where("adminId", "==", filterAdminId)
        );
    } else {
        qProfiles = collection(db, "profiles");
    }

    const snap = await getDocs(qProfiles);
    if (snap.empty) {
        container.innerHTML = "<p>No members found.</p>";
        return;
    }

    container.innerHTML = "";
    snap.forEach(docSnap => {
        const p = docSnap.data();
        const uid = docSnap.id;

        const pinHash = p.pinHash || "—";
        const pin = decodePinHash(pinHash);

        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <h3>${p.name || "(No name)"} ${p.role === "admin" ? "⭐" : ""}</h3>
            <p><strong>Role:</strong> ${p.role || "—"}</p>
            <p><strong>AdminId:</strong> ${p.adminId || "—"}</p>
            <p><strong>PIN:</strong> ${pin}</p>
            <p><strong>PIN Hash:</strong> ${pinHash}</p>
            <p><strong>Games Played:</strong> ${p.lifetimeStats?.gamesPlayed ?? p.gamesPlayed ?? 0}</p>
            <p><strong>Correct:</strong> ${p.lifetimeStats?.correct ?? p.correct ?? 0}</p>
            <p><strong>Incorrect:</strong> ${p.lifetimeStats?.incorrect ?? p.incorrect ?? 0}</p>
            <p class="small"><strong>Profile UID:</strong> ${uid}</p>
        `;

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit Profile";
        editBtn.onclick = () => openProfileEditor(uid, p);

        const reassignBtn = document.createElement("button");
        reassignBtn.textContent = "Reassign to Admin";
        reassignBtn.onclick = () => reassignMember(uid, p);

        const resetStatsBtn = document.createElement("button");
        resetStatsBtn.textContent = "Reset Stats";
        resetStatsBtn.onclick = () => resetMemberStats(uid);

        const deleteBtn = document.createElement("button");
        deleteBtn.textContent = "Delete Member";
        deleteBtn.onclick = () => deleteMember(uid);

        card.appendChild(editBtn);
        card.appendChild(reassignBtn);
        card.appendChild(resetStatsBtn);
        card.appendChild(deleteBtn);

        container.appendChild(card);
    });
}

async function reassignMember(profileUid, profileData) {
    const newAdminId = prompt("New admin UID for this member:", profileData.adminId || "");
    if (!newAdminId) return;

    await updateDoc(doc(db, "profiles", profileUid), {
        adminId: newAdminId,
        updatedAt: Date.now()
    });

    alert("Member reassigned.");
    await loadMembers();
    await loadGroups();
}

async function resetMemberStats(profileUid) {
    const confirmReset = confirm("Reset this member's lifetime stats?");
    if (!confirmReset) return;

    const profileRef = doc(db, "profiles", profileUid);
    const profileSnap = await getDoc(profileRef);
    if (!profileSnap.exists()) {
        alert("Profile not found.");
        return;
    }

    const data = profileSnap.data();
    const lifetimeStats = data.lifetimeStats || {};

    const resetStats = {
        ...lifetimeStats,
        correct: 0,
        incorrect: 0,
        gamesPlayed: 0,
        averageTime: null,
        fastestTime: null,
        streakBest: 0
    };

    await updateDoc(profileRef, {
        lifetimeStats: resetStats,
        updatedAt: Date.now()
    });

    alert("Member stats reset.");
    await loadMembers();
}

async function deleteMember(profileUid) {
    const confirmDelete = confirm("Delete this member profile?");
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "profiles", profileUid));
    alert("Member deleted.");
    await loadMembers();
    await loadGroups();
}

// ---------- Profiles Tab ----------
async function loadProfiles() {
    const container = document.getElementById("profilesContainer");
    container.innerHTML = "Loading...";

    const snap = await getDocs(collection(db, "profiles"));
    if (snap.empty) {
        container.innerHTML = "<p>No profiles found.</p>";
        return;
    }

    container.innerHTML = "";
    snap.forEach(docSnap => {
        const p = docSnap.data();
        const uid = docSnap.id;

        const pinHash = p.pinHash || "—";
        const pin = decodePinHash(pinHash);

        const card = document.createElement("div");
        card.className = "card";

        card.innerHTML = `
            <h3>${p.name || "(No name)"} ${p.role === "admin" ? "⭐" : ""}</h3>
            <p><strong>Role:</strong> ${p.role || "member"}</p>
            <p><strong>AdminId:</strong> ${p.adminId || "—"}</p>
            <p><strong>OwnerType:</strong> ${p.ownerType || "pin"}</p>
            <p><strong>PIN:</strong> ${pin}</p>
            <p><strong>PIN Hash:</strong> ${pinHash}</p>
            <p class="small"><strong>Profile UID:</strong> ${uid}</p>
        `;

        const editBtn = document.createElement("button");
        editBtn.textContent = "Edit Profile";
        editBtn.onclick = () => openProfileEditor(uid, p);

        card.appendChild(editBtn);
        container.appendChild(card);
    });
}

function setupProfilesSearch() {
    const input = document.getElementById("profileSearchInput");
    if (!input) return;

    input.addEventListener("input", async () => {
        const term = input.value.trim().toLowerCase();
        const container = document.getElementById("profilesContainer");
        container.innerHTML = "Searching...";

        const snap = await getDocs(collection(db, "profiles"));
        if (snap.empty) {
            container.innerHTML = "<p>No profiles found.</p>";
            return;
        }

        container.innerHTML = "";
        snap.forEach(docSnap => {
            const p = docSnap.data();
            const uid = docSnap.id;

            const haystack = [
                p.name || "",
                uid,
                p.adminId || ""
            ].join(" ").toLowerCase();

            if (term && !haystack.includes(term)) return;

            const pinHash = p.pinHash || "—";
            const pin = decodePinHash(pinHash);

            const card = document.createElement("div");
            card.className = "card";

            card.innerHTML = `
                <h3>${p.name || "(No name)"} ${p.role === "admin" ? "⭐" : ""}</h3>
                <p><strong>Role:</strong> ${p.role || "member"}</p>
                <p><strong>AdminId:</strong> ${p.adminId || "—"}</p>
                <p><strong>OwnerType:</strong> ${p.ownerType || "pin"}</p>
                <p><strong>PIN:</strong> ${pin}</p>
                <p><strong>PIN Hash:</strong> ${pinHash}</p>
                <p class="small"><strong>Profile UID:</strong> ${uid}</p>
            `;

            const editBtn = document.createElement("button");
            editBtn.textContent = "Edit Profile";
            editBtn.onclick = () => openProfileEditor(uid, p);

            card.appendChild(editBtn);
            container.appendChild(card);
        });
    });
}

// ---------- Profile Editor Modal ----------
function openProfileEditor(profileUid, profileData) {
    const p = profileData || {};
    const lifetime = p.lifetimeStats || {};

    const html = `
        <h2>Edit Profile</h2>
        <p class="small">UID: ${profileUid}</p>

        <label>Name</label>
        <input id="editName" value="${p.name || ""}">

        <label>Role</label>
        <select id="editRole">
            <option value="member" ${p.role === "member" || !p.role ? "selected" : ""}>member</option>
            <option value="admin" ${p.role === "admin" ? "selected" : ""}>admin</option>
        </select>

        <label>AdminId</label>
        <input id="editAdminId" value="${p.adminId || ""}">

        <label>Owner Type</label>
        <input id="editOwnerType" value="${p.ownerType || "pin"}">

        <label>New PIN (leave blank to keep current)</label>
        <input id="editNewPin" 
       type="password" 
       placeholder="New PIN"
       maxlength="4"
       pattern="[0-9]{4}"
       inputmode="numeric">

        <h3>Stats</h3>
        <label>Games Played</label>
        <input id="editGamesPlayed" type="number" value="${lifetime.gamesPlayed ?? 0}">

        <label>Correct</label>
        <input id="editCorrect" type="number" value="${lifetime.correct ?? 0}">

        <label>Incorrect</label>
        <input id="editIncorrect" type="number" value="${lifetime.incorrect ?? 0}">

        <label>Streak Best</label>
        <input id="editStreakBest" type="number" value="${lifetime.streakBest ?? 0}">

        <button id="saveProfileBtn">Save</button>
        <button id="resetStatsBtnModal">Reset Stats</button>
        <button id="deleteProfileBtn" style="float:right; background:#c62828; color:#fff;">Delete</button>
    `;

    openModal(html);

    document.getElementById("saveProfileBtn").onclick = async () => {
        const name = document.getElementById("editName").value.trim();
        const role = document.getElementById("editRole").value;
        const adminId = document.getElementById("editAdminId").value.trim() || null;
        const ownerType = document.getElementById("editOwnerType").value.trim() || "pin";
        const newPin = document.getElementById("editNewPin").value.trim();

        const gamesPlayed = Number(document.getElementById("editGamesPlayed").value) || 0;
        const correct = Number(document.getElementById("editCorrect").value) || 0;
        const incorrect = Number(document.getElementById("editIncorrect").value) || 0;
        const streakBest = Number(document.getElementById("editStreakBest").value) || 0;

        const profileRef = doc(db, "profiles", profileUid);
        const updateData = {
            name,
            role,
            adminId,
            ownerType,
            lifetimeStats: {
                gamesPlayed,
                correct,
                incorrect,
                streakBest,
                averageTime: p.lifetimeStats?.averageTime ?? null,
                fastestTime: p.lifetimeStats?.fastestTime ?? null
            },
            updatedAt: Date.now()
        };

        if (newPin) {
            updateData.pinHash = btoa(newPin);
        }

        await updateDoc(profileRef, updateData);
        alert("Profile updated.");
        closeModal();
        await loadProfiles();
        await loadMembers();
    };

    document.getElementById("resetStatsBtnModal").onclick = async () => {
        await resetMemberStats(profileUid);
        alert("Stats reset.");
        closeModal();
        await loadProfiles();
        await loadMembers();
    };

    document.getElementById("deleteProfileBtn").onclick = async () => {
        const confirmDelete = confirm("Delete this profile?");
        if (!confirmDelete) return;
        await deleteMember(profileUid);
        closeModal();
        await loadProfiles();
    };
}

// ---------- Tools ----------
function setupTools() {
    const resetMemberBtn = document.getElementById("resetMemberStatsBtn");
    const resetAllBtn = document.getElementById("resetAllStatsBtn");

    resetMemberBtn.onclick = async () => {
        const uid = document.getElementById("resetMemberUid").value.trim();
        if (!uid) {
            alert("Enter a profile UID.");
            return;
        }
        await resetMemberStats(uid);
    };

    resetAllBtn.onclick = async () => {
        const confirmAll = confirm("Reset stats for ALL members? This cannot be undone.");
        if (!confirmAll) return;

        const snap = await getDocs(collection(db, "profiles"));
        for (const docSnap of snap.docs) {
            const uid = docSnap.id;
            await resetMemberStats(uid);
        }

        alert("All member stats reset.");
        await loadMembers();
        await loadProfiles();
    };
}

function setupFixMissingFields() {
    const btn = document.getElementById("fixMissingFieldsBtn");
    if (!btn) return;

    btn.onclick = async () => {
        const confirmFix = confirm("Fix missing fields on ALL profiles? This will update many documents.");
        if (!confirmFix) return;

        const snap = await getDocs(collection(db, "profiles"));
        for (const docSnap of snap.docs) {
            const uid = docSnap.id;
            const data = docSnap.data();
            const updateData = {};

            if (!("role" in data)) {
                updateData.role = "member";
            }
            if (!("ownerType" in data)) {
                updateData.ownerType = "pin";
            }
            if (!("adminId" in data)) {
                updateData.adminId = null;
            }
            if (!("lifetimeStats" in data)) {
                updateData.lifetimeStats = {
                    gamesPlayed: data.gamesPlayed ?? 0,
                    correct: data.correct ?? 0,
                    incorrect: data.incorrect ?? 0,
                    fastestTime: data.fastestTime ?? null,
                    averageTime: data.averageTime ?? null,
                    streakBest: data.streakBest ?? 0
                };
            }

            if (Object.keys(updateData).length > 0) {
                updateData.updatedAt = Date.now();
                await updateDoc(doc(db, "profiles", uid), updateData);
            }
        }

        alert("All profiles normalized.");
        await loadProfiles();
        await loadMembers();
    };
}

