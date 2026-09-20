// =====================================================
// RM VIDYA PEETH - AUTH.JS (FIXED)
// Firebase Authentication | Student / Admin / Master Admin
//
// Rules:
// - Sirf Logout button dabane par (ya admin blocked/removed hone par) logout
// - Internet / Firestore ki temporary problem par logout NAHI hoga
// =====================================================

import {
    auth,
    db
} from "./firebase-config.js";

import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// =====================================================
// CONFIG
// =====================================================

const MASTER_EMAIL = "ranjanmishra9026354@gmail.com";

const ADMIN_KEYS = [
    "adminLoggedIn",
    "adminType",
    "adminId",
    "adminName",
    "adminUsername",
    "adminAccess",
    "adminCommands",
    "ssc_logged_in",
    "ssc_login_type",
    "ssc_admin_username",
    "ssc_admin_permissions"
];

const STUDENT_KEYS = [
    "studentLoggedIn",
    "studentUser",
    "studentUid",
    "loggedIn",
    "userLoggedIn",
    "userEmail",
    "userName",
    "loginType"
];


// =====================================================
// HELPERS
// =====================================================

function removeKeys(keys) {
    try {
        keys.forEach(function (key) {
            localStorage.removeItem(key);
        });
    } catch (e) {
        console.warn("Storage clear warning:", e);
    }
}

function clearAdminSession() {
    removeKeys(ADMIN_KEYS);
}

async function safeSignOut() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Firebase Logout Error:", error);
    }
}

function isTransientError(error) {

    const code = (error && error.code) || "";

    return (
        !navigator.onLine ||
        [
            "unavailable",
            "deadline-exceeded",
            "resource-exhausted",
            "cancelled",
            "auth/network-request-failed"
        ].indexOf(code) !== -1
    );
}


// =====================================================
// SAVE SESSIONS
// =====================================================

function saveMasterSession(user) {

    const email = String((user && user.email) || "").trim();

    localStorage.setItem("adminLoggedIn", "true");
    localStorage.setItem("adminType", "master");
    localStorage.setItem("adminId", "master");
    localStorage.setItem("adminName", "Master Admin");
    localStorage.setItem("adminUsername", email);
    localStorage.setItem("adminAccess", "full");

    localStorage.setItem("ssc_logged_in", "true");
    localStorage.setItem("ssc_login_type", "master_admin");
    localStorage.setItem("ssc_admin_username", email);
    localStorage.setItem(
        "ssc_admin_permissions",
        JSON.stringify({ all: true })
    );
}

function saveNormalAdminSession(user, admin) {

    const data = admin.data || {};

    const email = String(
        data.email || (user && user.email) || ""
    ).trim();

    localStorage.setItem("adminLoggedIn", "true");
    localStorage.setItem("adminType", "normal");
    localStorage.setItem("adminId", admin.id);
    localStorage.setItem("adminName", data.name || "Normal Admin");
    localStorage.setItem("adminUsername", email);
    localStorage.setItem("adminAccess", data.access || "limited");

    localStorage.setItem("ssc_logged_in", "true");
    localStorage.setItem("ssc_login_type", "admin");
    localStorage.setItem("ssc_admin_username", email);
    localStorage.setItem(
        "ssc_admin_permissions",
        JSON.stringify(data.permissions || {})
    );

    if (data.commands !== undefined) {
        localStorage.setItem("adminCommands", JSON.stringify(data.commands));
    }
}


// =====================================================
// GET NORMAL ADMIN
// Error aane par null nahi lautata, error throw karta hai
// (pehle error ko "admin registered nahi hai" maan liya jata tha)
// =====================================================

async function getNormalAdmin(user) {

    if (!user || !user.email) return null;

    const email = String(user.email).trim().toLowerCase();

    const snapshot = await getDocs(
        query(
            collection(db, "admins"),
            where("email", "==", email)
        )
    );

    if (snapshot.empty) return null;

    const item = snapshot.docs[0];

    return {
        id: item.id,
        data: item.data() || {}
    };
}


// =====================================================
// VERIFY ADMIN
// =====================================================

async function verifyAdminUser(user) {

    if (!user) {
        return { valid: false, type: null, reason: "no_user" };
    }

    const email = String(user.email || "").trim().toLowerCase();


    // ---------------- MASTER ----------------

    if (email === MASTER_EMAIL.toLowerCase()) {

        saveMasterSession(user);

        return { valid: true, type: "master" };
    }


    // ---------------- NORMAL ----------------

    let admin;

    try {
        admin = await getNormalAdmin(user);
    } catch (error) {

        console.error("Get Normal Admin Error:", error);

        if (error && error.code === "permission-denied") {
            return { valid: false, type: null, reason: "permission_denied" };
        }

        // network / unknown = temporary problem (logout nahi)
        return {
            valid: false,
            type: null,
            reason: "error",
            transient: isTransientError(error)
        };
    }

    if (!admin) {
        return { valid: false, type: null, reason: "not_registered" };
    }

    const data = admin.data || {};

    if (String(data.role || "").trim().toLowerCase() !== "admin") {
        return { valid: false, type: null, reason: "invalid_role" };
    }

    if (String(data.status || "active").trim().toLowerCase() !== "active") {
        return { valid: false, type: null, reason: "inactive" };
    }

    saveNormalAdminSession(user, admin);

    return { valid: true, type: "normal", admin: admin };
}


// =====================================================
// ADMIN SESSION READERS
// =====================================================

function getAdminType() {

    const type = localStorage.getItem("adminType");

    if (type === "master") return "master";
    if (type === "normal") return "normal";

    const loginType = localStorage.getItem("ssc_login_type");

    if (loginType === "master_admin") return "master";
    if (loginType === "admin") return "normal";

    return null;
}

function isAdminLoggedIn() {

    const type = getAdminType();

    return (
        localStorage.getItem("adminLoggedIn") === "true" &&
        (type === "master" || type === "normal")
    );
}

function getAdminId() {
    return localStorage.getItem("adminId") || "";
}

function getAdminName() {
    return (
        localStorage.getItem("adminName") ||
        localStorage.getItem("adminUsername") ||
        "Admin"
    );
}

function getAdminPermissions() {

    if (getAdminType() === "master") {
        return { all: true };
    }

    try {
        return JSON.parse(
            localStorage.getItem("ssc_admin_permissions") || "{}"
        ) || {};
    } catch (error) {
        console.error("Permission Parse Error:", error);
        return {};
    }
}

function hasAdminPermission(permission) {

    const type = getAdminType();

    if (type === "master") return true;
    if (type !== "normal") return false;

    const permissions = getAdminPermissions();

    return permissions.all === true || permissions[permission] === true;
}

function requireAdminPermission(permission) {

    if (!hasAdminPermission(permission)) {
        alert("🚫 आपको इस section की permission नहीं दी गई है।");
        return false;
    }

    return true;
}

// Pichla verified session isi email ka hai ya nahi
function hasCachedAdminSession(email) {

    return (
        isAdminLoggedIn() &&
        String(localStorage.getItem("adminUsername") || "")
            .trim()
            .toLowerCase() === email
    );
}


// =====================================================
// AUTH ERROR BOX
// =====================================================

function showAuthError(text) {

    const errorBox = document.getElementById("authError");

    if (!errorBox) {
        alert(text);
        return;
    }

    errorBox.textContent = text;
    errorBox.style.display = "block";
}

function getStudentLoginErrorMessage(error) {

    switch (error && error.code) {

        case "auth/invalid-credential":
        case "auth/invalid-login-credentials":
            return "❌ Email या Password गलत है।";

        case "auth/user-not-found":
            return "❌ यह account मौजूद नहीं है।";

        case "auth/wrong-password":
            return "❌ Password गलत है।";

        case "auth/invalid-email":
            return "❌ Email सही नहीं है।";

        case "auth/too-many-requests":
            return "❌ बहुत ज्यादा login attempts हुए हैं। थोड़ी देर बाद कोशिश करें।";

        case "auth/network-request-failed":
            return "❌ Network/Firebase connection problem है।";

        case "permission-denied":
            return "❌ Firestore permission denied है।";

        default:
            return (error && error.message)
                ? "❌ " + error.message
                : "❌ Login नहीं हुआ।";
    }
}


// =====================================================
// STUDENT LOGIN
// =====================================================

async function studentLoginNew() {

    const emailInput = document.getElementById("studentLoginEmail");
    const passwordInput = document.getElementById("studentLoginPassword");
    const button = document.getElementById("studentLoginBtn");
    const errorBox = document.getElementById("authError");

    if (!emailInput || !passwordInput) return;

    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;

    if (errorBox) {
        errorBox.style.display = "none";
        errorBox.textContent = "";
    }

    if (!email) {
        showAuthError("❌ Email डालें।");
        return;
    }

    if (!password) {
        showAuthError("❌ Password डालें।");
        return;
    }

    if (button) {
        button.disabled = true;
        button.textContent = "⏳ Logging in...";
    }

    try {

        // Login ko browser band hone ke baad bhi yaad rakho
        try {
            await setPersistence(auth, browserLocalPersistence);
        } catch (e) {
            console.warn("Persistence warning:", e);
        }

        const userCredential = await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        const user = userCredential.user;

        console.log("✅ Firebase Login Successful:", user.uid);


        // ---------------- students/{uid} ----------------

        const studentSnap = await getDoc(doc(db, "students", user.uid));

        let studentData = {
            uid: user.uid,
            email: user.email || email,
            name: user.displayName || "Student",
            fullName: user.displayName || "Student",
            displayName: user.displayName || "Student",
            username: user.email || email,
            role: "student",
            status: "active"
        };

        if (studentSnap.exists()) {

            const firestoreData = studentSnap.data() || {};

            studentData = {
                ...studentData,
                ...firestoreData,
                uid: user.uid,
                email: firestoreData.email || user.email || email
            };
        }


        // ---------------- STATUS ----------------

        const status = String(studentData.status || "active")
            .trim()
            .toLowerCase();

        if (status !== "active") {

            await safeSignOut();

            showAuthError("❌ आपका student account inactive है।");

            if (button) {
                button.disabled = false;
                button.textContent = "🔐 Login";
            }

            return;
        }


        // ---------------- SAVE STUDENT SESSION ----------------

        clearAdminSession();

        localStorage.setItem("studentUser", JSON.stringify(studentData));

        // Purane pages: loggedIn / userLoggedIn
        // Naye course pages: studentLoggedIn
        localStorage.setItem("studentLoggedIn", "true");
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("userLoggedIn", "true");

        localStorage.setItem("userEmail", studentData.email);
        localStorage.setItem(
            "userName",
            studentData.name || studentData.fullName || "Student"
        );

        localStorage.setItem("studentUid", user.uid);
        localStorage.setItem("loginType", "student");

        if (button) {
            button.textContent = "✅ Login Successful";
        }

        window.location.replace("./dashboard.html");

    } catch (error) {

        console.error("🔥 Student Login Error:", error);

        showAuthError(getStudentLoginErrorMessage(error));

        if (button) {
            button.disabled = false;
            button.textContent = "🔐 Login";
        }
    }
}


// =====================================================
// FORGOT PASSWORD
// =====================================================

async function resetStudentPassword() {

    const input = document.getElementById("forgotEmail");
    const info = document.getElementById("resetInfo");

    if (!input) return;

    const email = input.value.trim().toLowerCase();

    if (!email) {

        if (info) {
            info.textContent = "❌ Registered Email डालें।";
            info.style.color = "#d32f2f";
        }

        return;
    }

    try {

        await sendPasswordResetEmail(auth, email);

        if (info) {
            info.textContent =
                "✅ Password reset link आपके Email पर भेज दिया गया है।";
            info.style.color = "#2e7d32";
        }

    } catch (error) {

        console.error("Password Reset Error:", error);

        if (info) {
            info.textContent =
                "❌ " + (error.message || "Reset link नहीं भेजा जा सका।");
            info.style.color = "#d32f2f";
        }
    }
}


// =====================================================
// LOGOUT (sirf yahi asli logout hai)
// =====================================================

async function adminLogout(redirect = true) {

    await safeSignOut();

    clearAdminSession();

    if (redirect) {
        window.location.replace("admin-login.html");
    }
}

async function logoutUser(redirect = true) {

    await safeSignOut();

    clearAdminSession();

    removeKeys(STUDENT_KEYS);

    if (redirect) {
        window.location.replace("login.html");
    }
}


// =====================================================
// AUTH STATE
// =====================================================

function watchAuthState(callback) {

    return onAuthStateChanged(auth, async function (user) {

        if (typeof callback === "function") {
            await callback(user);
        }
    });
}


// =====================================================
// ADMIN PAGE PROTECTION
// =====================================================

function protectAdminPage() {

    return onAuthStateChanged(auth, async function (user) {

        // Firebase me sach me login nahi hai
        if (!user) {
            clearAdminSession();
            window.location.replace("admin-login.html");
            return;
        }

        const email = String(user.email || "").trim().toLowerCase();

        const result = await verifyAdminUser(user);

        if (result.valid) return;


        // ---------- Temporary problem: logout NAHI ----------

        if (result.reason === "error") {

            if (hasCachedAdminSession(email)) {
                console.warn("Admin verify nahi hua, saved session use ho raha hai");
                return;
            }

            alert(
                "🌐 Admin verify नहीं हो पाया। Internet check करके page refresh करें।"
            );

            return;
        }


        // ---------- Pakka reject: tabhi logout ----------

        await safeSignOut();

        clearAdminSession();

        if (result.reason === "inactive") {
            alert("🚫 आपका Admin account blocked / inactive है।");
        } else if (result.reason === "not_registered") {
            alert("🚫 यह account Admin के रूप में registered नहीं है।");
        } else if (result.reason === "permission_denied") {
            alert("🚫 Firestore permission denied। Firestore Rules check करें।");
        } else {
            alert("🚫 आपको Admin access नहीं है।");
        }

        window.location.replace("admin-login.html");
    });
}


// =====================================================
// ADMIN INFO
// =====================================================

function updateAdminInfo() {

    const name = getAdminName();

    const typeText =
        getAdminType() === "master" ? "👑 Master Admin" : "👨‍💼 Normal Admin";

    ["adminName", "loggedAdminName"].forEach(function (id) {
        const element = document.getElementById(id);
        if (element) element.textContent = name;
    });

    ["adminType", "loggedAdminType"].forEach(function (id) {
        const element = document.getElementById(id);
        if (element) element.textContent = typeText;
    });
}


// =====================================================
// LOGOUT BUTTONS
// =====================================================

function setupLogoutButtons() {

    document
        .querySelectorAll("[data-admin-logout]")
        .forEach(function (button) {
            button.addEventListener("click", function () {
                adminLogout(true);
            });
        });

    ["logoutButton", "logoutBottom"].forEach(function (id) {

        const element = document.getElementById(id);

        if (element) {
            element.addEventListener("click", function () {
                adminLogout(true);
            });
        }
    });
}


// =====================================================
// AUTO INIT
// =====================================================

document.addEventListener("DOMContentLoaded", function () {
    updateAdminInfo();
    setupLogoutButtons();
});


// =====================================================
// GLOBAL FUNCTIONS
// =====================================================

window.studentLoginNew = studentLoginNew;
window.resetStudentPassword = resetStudentPassword;
window.showAuthError = showAuthError;
window.verifyAdminUser = verifyAdminUser;
window.getAdminType = getAdminType;
window.getAdminId = getAdminId;
window.getAdminName = getAdminName;
window.getAdminPermissions = getAdminPermissions;
window.isAdminLoggedIn = isAdminLoggedIn;
window.hasAdminPermission = hasAdminPermission;
window.requireAdminPermission = requireAdminPermission;
window.adminLogout = adminLogout;
window.logoutUser = logoutUser;
window.watchAuthState = watchAuthState;
window.protectAdminPage = protectAdminPage;
window.updateAdminInfo = updateAdminInfo;

console.log("✅ RM Vidya Peeth auth.js loaded successfully");
