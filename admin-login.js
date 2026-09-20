// =====================================================
// RM VIDYA PEETH - ADMIN LOGIN
// Firebase Email + Password | Master Admin + Normal Admin
//
// IMPORTANT:
// - Login persistent rahta hai (browserLocalPersistence)
// - Galat password / network error par purana session CLEAR nahi hota
// - Sirf Logout button dabane par hi logout hoga
// =====================================================

import {
    auth,
    db
} from "./firebase-config.js";

import {
    signInWithEmailAndPassword,
    signOut,
    setPersistence,
    browserLocalPersistence,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// =====================================================
// CONFIG
// =====================================================

const MASTER_EMAIL = "ranjanmishra9026354@gmail.com";

const MASTER_PAGE = "master-admin.html";
const ADMIN_PAGE = "admin.html";

const SESSION_KEYS = [
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


// =====================================================
// ELEMENTS
// =====================================================

const form = document.getElementById("adminLoginForm");
const emailInput = document.getElementById("adminEmail");
const passwordInput = document.getElementById("adminPassword");
const button = document.getElementById("loginButton");
const messageBox = document.getElementById("loginMessage");

if (!form || !emailInput || !passwordInput || !button) {
    console.error("❌ Admin login form के elements नहीं मिले।");
} else {
    init();
}


// =====================================================
// HELPERS
// =====================================================

function showMessage(text, success = false) {
    if (!messageBox) return;
    messageBox.textContent = text;
    messageBox.style.color = success ? "#86efac" : "#fca5a5";
}

function clearAdminSession() {
    try {
        SESSION_KEYS.forEach(function (key) {
            localStorage.removeItem(key);
        });
    } catch (e) {
        console.warn("Session clear warning:", e);
    }
}

function saveAdminSession(s) {

    clearAdminSession();

    localStorage.setItem("adminLoggedIn", "true");
    localStorage.setItem("adminType", s.adminType);
    localStorage.setItem("adminId", s.adminId);
    localStorage.setItem("adminName", s.adminName);
    localStorage.setItem("adminUsername", s.adminUsername);
    localStorage.setItem("adminAccess", s.adminAccess);

    // Old session compatibility
    localStorage.setItem("ssc_logged_in", "true");
    localStorage.setItem("ssc_login_type", s.loginType);
    localStorage.setItem("ssc_admin_username", s.adminUsername);
    localStorage.setItem(
        "ssc_admin_permissions",
        JSON.stringify(s.permissions || {})
    );

    if (s.commands !== undefined) {
        localStorage.setItem("adminCommands", JSON.stringify(s.commands));
    }
}

async function safeSignOut() {
    try {
        await signOut(auth);
    } catch (e) {
        console.warn("Logout warning:", e);
    }
}

// Browser को localStorage / IndexedDB अपने आप delete करने से रोकने की कोशिश
async function requestPersistentStorage() {
    try {
        if (navigator.storage && navigator.storage.persist) {
            await navigator.storage.persist();
        }
    } catch (e) { }
}

function getErrorMessage(error) {

    switch (error && error.code) {

        case "auth/invalid-credential":
        case "auth/invalid-login-credentials":
            return "❌ Email या Password गलत है।";

        case "auth/user-not-found":
            return "❌ यह Email Firebase Authentication में registered नहीं है।";

        case "auth/wrong-password":
            return "❌ Password गलत है।";

        case "auth/invalid-email":
            return "❌ Email सही format में डालें।";

        case "auth/user-disabled":
            return "🚫 यह Firebase account disabled है।";

        case "auth/too-many-requests":
            return "⚠️ बहुत ज्यादा login attempts हुए हैं। थोड़ी देर बाद कोशिश करें।";

        case "auth/network-request-failed":
            return "🌐 Internet connection check करें।";

        case "permission-denied":
            return "🚫 Firestore permission denied। Firestore Rules check करें।";

        case "failed-precondition":
            return "⚠️ Firestore query के लिए configuration/index की जरूरत हो सकती है।";

        case "unavailable":
            return "🌐 Server से connect नहीं हो पाया। Internet check करें।";

        default:
            return "❌ Login Failed: " +
                ((error && error.message) || "Unknown error");
    }
}


// =====================================================
// ADMIN VERIFY
// Firebase user को check करता है और session data लौटाता है
// =====================================================

async function verifyAdmin(user) {

    const authEmail = String(user.email || "").trim().toLowerCase();


    // ---------------- MASTER ADMIN ----------------

    if (authEmail === MASTER_EMAIL.toLowerCase()) {

        return {
            ok: true,
            page: MASTER_PAGE,
            session: {
                adminType: "master",
                adminId: "master",   // auth.js requireMasterAdmin() इसी को check करता है
                adminName: "Master Admin",
                adminUsername: authEmail,
                adminAccess: "full",
                loginType: "master_admin",
                permissions: { all: true }
            }
        };
    }


    // ---------------- NORMAL ADMIN ----------------

    const snapshot = await getDocs(
        query(
            collection(db, "admins"),
            where("email", "==", authEmail)
        )
    );

    if (snapshot.empty) {
        return {
            ok: false,
            reason: "🚫 यह Email Normal Admin के रूप में registered नहीं है।"
        };
    }

    const adminDoc = snapshot.docs[0];
    const adminData = adminDoc.data();

    if (String(adminData.role || "").toLowerCase() !== "admin") {
        return {
            ok: false,
            reason: "🚫 यह account Normal Admin नहीं है।"
        };
    }

    if (String(adminData.status || "active").toLowerCase() !== "active") {
        return {
            ok: false,
            reason: "🚫 आपका Admin account blocked / inactive है।"
        };
    }

    return {
        ok: true,
        page: ADMIN_PAGE,
        session: {
            adminType: "normal",
            adminId: adminDoc.id,
            adminName: adminData.name || "Normal Admin",
            adminUsername: adminData.email || authEmail,
            adminAccess: adminData.access || "limited",
            loginType: "admin",
            permissions: adminData.permissions || {},
            commands: adminData.commands
        }
    };
}


// =====================================================
// INIT
// =====================================================

function init() {

    let loginInProgress = false;
    let redirecting = false;


    // -------------------------------------------------
    // AUTO RESTORE
    // अगर Firebase में पहले से login है, तो दोबारा login
    // माँगे बिना सीधे dashboard खोल दो।
    // (localStorage clear हो गया हो तब भी session वापस बन जाएगा)
    // -------------------------------------------------

    let restoreHandled = false;

    onAuthStateChanged(auth, async function (user) {

        if (restoreHandled) return;
        restoreHandled = true;

        if (!user || loginInProgress) return;

        try {

            showMessage("⏳ Session जाँच रहे हैं...", true);

            const result = await verifyAdmin(user);

            // Admin नहीं है (शायद student login है) -> कुछ मत छेड़ो
            if (!result.ok) {
                showMessage("");
                return;
            }

            saveAdminSession(result.session);

            redirecting = true;

            showMessage("✅ पहले से Login है! Dashboard खोल रहे हैं...", true);

            window.location.replace(result.page);

        } catch (error) {

            // Network/Firestore error: session बिल्कुल clear नहीं करना
            console.warn("Auto restore warning:", error);

            showMessage("");
        }
    });


    // -------------------------------------------------
    // LOGIN SUBMIT
    // -------------------------------------------------

    form.addEventListener("submit", async function (event) {

        event.preventDefault();

        if (loginInProgress) return;

        const email = emailInput.value.trim().toLowerCase();
        const password = passwordInput.value;

        if (!email) {
            showMessage("📧 Admin Email डालें।");
            emailInput.focus();
            return;
        }

        if (!password) {
            showMessage("🔐 Password डालें।");
            passwordInput.focus();
            return;
        }

        loginInProgress = true;

        button.disabled = true;
        button.textContent = "⏳ Login हो रहा है...";
        showMessage("");

        try {

            // Login को browser बंद होने के बाद भी याद रखो
            try {
                await setPersistence(auth, browserLocalPersistence);
            } catch (e) {
                console.warn("Persistence warning:", e);
            }

            const credential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            const result = await verifyAdmin(credential.user);

            if (!result.ok) {
                await safeSignOut();
                clearAdminSession();
                showMessage(result.reason);
                return;
            }

            saveAdminSession(result.session);

            requestPersistentStorage();

            redirecting = true;

            showMessage(
                result.session.adminType === "master"
                    ? "✅ Master Admin Login सफल! खोल रहे हैं..."
                    : "✅ Admin Login सफल! Dashboard खोल रहे हैं...",
                true
            );

            setTimeout(function () {
                window.location.replace(result.page);
            }, 300);

        } catch (error) {

            console.error("ADMIN LOGIN ERROR:", error);

            // "auth/..." error = Firebase login हुआ ही नहीं (galat password आदि)
            //   -> पुराना session वैसा ही रहने दो।
            // बाकी error = login हो गया पर Firestore check fail हुआ
            //   -> अधूरा session साफ करो।
            const code = (error && error.code) || "";

            if (code.indexOf("auth/") !== 0) {
                await safeSignOut();
                clearAdminSession();
            }

            showMessage(getErrorMessage(error));

        } finally {

            loginInProgress = false;

            if (!redirecting) {
                button.disabled = false;
                button.textContent = "🔐 Login";
            }
        }
    });
}
