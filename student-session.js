// =====================================================
// RM VIDYA PEETH - STUDENT-SESSION.JS  (shared)
//
// Har student page par ye guard laga sakte ho:
//   import { startStudentGuard } from "./student-session.js";
//   startStudentGuard();
//
// Rules:
// - Student sirf Logout dabane par (ya blocked hone par) logout hoga
// - Internet / Firestore ki temporary problem par logout NAHI hoga
// - localStorage clear ho jaye tab bhi Firebase se session wapas ban jata hai
// =====================================================

import {
    auth,
    db
} from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// =====================================================
// CONFIG
// =====================================================

const LOGIN_PAGE = "login.html";

// false = auth.js jaisa: students/{uid} document na ho to bhi student chal jayega.
// true  = document na mile to account "delete" maana jayega aur logout ho jayega.
//         (true karne se pehle confirm karo ki signup students/{uid} banata hai)
const REQUIRE_STUDENT_DOC = false;

const STUDENT_KEYS = [
    "studentLoggedIn",
    "studentUser",
    "studentUid",
    "loggedIn",
    "userLoggedIn",
    "userEmail",
    "userName",
    "loginType",
    "currentUser",
    "user",
    "ssc_student_name",
    "selectedDynamicTest",
    "selectedTestTime"
];

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

async function safeSignOut() {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Firebase Logout Error:", error);
    }
}

export function getStoredStudent() {

    try {

        return JSON.parse(
            localStorage.getItem("studentUser") ||
            localStorage.getItem("currentUser") ||
            localStorage.getItem("user") ||
            "{}"
        ) || {};

    } catch (error) {

        console.error("User data error:", error);

        return {};
    }
}

function clearStudentSession() {
    removeKeys(STUDENT_KEYS);
}

function defaultStudent(user) {

    const email = user.email || "";

    return {
        uid: user.uid,
        email: email,
        name: user.displayName || "Student",
        fullName: user.displayName || "Student",
        displayName: user.displayName || "Student",
        username: email,
        role: "student",
        status: "active"
    };
}

function saveStudentSession(student) {

    try {

        localStorage.setItem("studentUser", JSON.stringify(student));

        // Purane pages: loggedIn / userLoggedIn
        // Naye pages: studentLoggedIn
        localStorage.setItem("studentLoggedIn", "true");
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("userLoggedIn", "true");

        localStorage.setItem("userEmail", student.email || "");
        localStorage.setItem(
            "userName",
            student.name || student.fullName || "Student"
        );

        localStorage.setItem("studentUid", student.uid || "");
        localStorage.setItem("loginType", "student");

    } catch (e) {
        console.warn("Session save warning:", e);
    }
}

// Pichla verified session isi Firebase user ka hai ya nahi
function hasCachedStudentSession(user) {

    return (
        localStorage.getItem("studentLoggedIn") === "true" &&
        localStorage.getItem("studentUid") === user.uid
    );
}


// =====================================================
// VERIFY STUDENT
//   ok       -> student sahi hai
//   rejected -> pakka reject (blocked / inactive / deleted)
//   error    -> temporary problem (logout NAHI karna)
// =====================================================

async function verifyStudent(user) {

    try {

        const snap = await getDoc(doc(db, "students", user.uid));

        if (!snap.exists()) {

            if (REQUIRE_STUDENT_DOC) {
                return {
                    status: "rejected",
                    reason: "🚫 आपका account मौजूद नहीं है। कृपया दोबारा registration करें।"
                };
            }

            return { status: "ok", student: defaultStudent(user) };
        }

        const data = snap.data() || {};

        const status = String(data.status || "active")
            .trim()
            .toLowerCase();

        if (status !== "active") {
            return {
                status: "rejected",
                reason: "🚫 आपका student account blocked / inactive है। Admin से संपर्क करें।"
            };
        }

        return {
            status: "ok",
            student: {
                ...defaultStudent(user),
                ...data,
                uid: user.uid,
                email: data.email || user.email || ""
            }
        };

    } catch (error) {

        console.error("Student verify error:", error);

        return { status: "error" };
    }
}


// =====================================================
// RESTORE (login.html ke liye)
// Firebase me pehle se login ho to session wapas bana deta hai.
//
//   const r = await restoreStudentSession();
//   if (r.status === "ok") window.location.replace("dashboard.html");
// =====================================================

function waitForFirebaseUser() {

    return new Promise(function (resolve) {

        let done = false;
        let unsubscribe = null;

        unsubscribe = onAuthStateChanged(auth, function (user) {

            if (done) return;

            done = true;

            if (unsubscribe) unsubscribe();

            resolve(user);
        });
    });
}

export async function restoreStudentSession() {

    const user = await waitForFirebaseUser();

    if (!user) {
        return { status: "no_user" };
    }

    const result = await verifyStudent(user);

    if (result.status === "ok") {
        saveStudentSession(result.student);
    }

    return result;
}


// =====================================================
// GUARD (student pages ke liye)
// =====================================================

export function startStudentGuard(options) {

    const opts = options || {};

    const onReady =
        typeof opts.onReady === "function" ? opts.onReady : function () { };

    const onNotice =
        typeof opts.onNotice === "function"
            ? opts.onNotice
            : function (text) { console.warn(text); };

    // Login ko browser band hone ke baad bhi yaad rakho
    setPersistence(auth, browserLocalPersistence).catch(function (e) {
        console.warn("Persistence warning:", e);
    });

    return onAuthStateChanged(auth, async function (user) {

        // Firebase me sach me login nahi hai
        if (!user) {
            clearStudentSession();
            window.location.replace(LOGIN_PAGE);
            return;
        }

        const result = await verifyStudent(user);

        if (result.status === "ok") {
            saveStudentSession(result.student);
            onReady(result.student);
            return;
        }

        // Temporary problem: logout NAHI
        if (result.status === "error") {

            if (hasCachedStudentSession(user)) {
                onNotice("⚠️ Server से connect नहीं हो पाया। Saved session से चल रहे हैं।");
                onReady(getStoredStudent());
            } else {
                onNotice("🌐 Account verify नहीं हो पाया। Internet check करके page refresh करें।");
            }

            return;
        }

        // Pakka reject: tabhi logout
        await safeSignOut();

        clearStudentSession();

        alert(result.reason);

        window.location.replace(LOGIN_PAGE);
    });
}


// =====================================================
// LOGOUT (asli logout: Firebase + saara local session)
// =====================================================

export async function logoutStudent() {

    await safeSignOut();

    removeKeys(STUDENT_KEYS.concat(ADMIN_KEYS));

    window.location.replace(LOGIN_PAGE);
}
