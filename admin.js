// =====================================================
// RM VIDYA PEETH - ADMIN.JS (FIXED)
// Firebase Auth + Firestore | Master / Normal Admin
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
    signOut,
    setPersistence,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// =====================================================
// CONFIG
// =====================================================

const MASTER_EMAIL = "ranjanmishra9026354@gmail.com";
const LOGIN_PAGE = "admin-login.html";

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
// START
// =====================================================

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startAdminPanel);
} else {
    startAdminPanel();
}


// =====================================================
// SMALL HELPERS
// =====================================================

function showNotice(text) {

    const box = document.getElementById("message");

    if (!box) {
        console.warn(text);
        return;
    }

    box.className = "message error";
    box.textContent = text;
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

async function safeSignOut() {
    try {
        await signOut(auth);
    } catch (e) {
        console.warn("Logout warning:", e);
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

function escapeAdminHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// =====================================================
// START ADMIN PANEL
// =====================================================

async function startAdminPanel() {

    // Login ko browser band hone ke baad bhi yaad rakho
    try {
        await setPersistence(auth, browserLocalPersistence);
    } catch (e) {
        console.warn("Persistence warning:", e);
    }

    onAuthStateChanged(auth, async function (user) {

        // ---------------------------------------------
        // Firebase me sach me login nahi hai
        // ---------------------------------------------

        if (!user) {
            clearAdminSession();
            window.location.replace(LOGIN_PAGE);
            return;
        }

        const email = String(user.email || "").trim().toLowerCase();


        // ---------------------------------------------
        // MASTER ADMIN
        // ---------------------------------------------

        if (email === MASTER_EMAIL.toLowerCase()) {
            saveMasterSession(user);
            setupAdminPanel();
            return;
        }


        // ---------------------------------------------
        // NORMAL ADMIN
        // ---------------------------------------------

        const result = await verifyNormalAdmin(email);

        if (result.status === "ok") {
            saveNormalAdminSession(result.admin, email);
            setupAdminPanel();
            return;
        }


        // Temporary problem: logout mat karo
        if (result.status === "error") {

            if (hasCachedNormalSession(email)) {
                showNotice(
                    "⚠️ Server से connect नहीं हो पाया। Saved session से चल रहे हैं।"
                );
                setupAdminPanel();
            } else {
                showNotice(
                    "🌐 Admin verify नहीं हो पाया। Internet check करके page refresh करें।"
                );
            }

            return;
        }


        // Pakka reject (not found / role / inactive / rules)
        await safeSignOut();
        clearAdminSession();
        alert(result.reason);
        window.location.replace(LOGIN_PAGE);
    });
}


// =====================================================
// SESSION SAVE
// =====================================================

function saveMasterSession(user) {

    const email = String(user.email || "");

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

function saveNormalAdminSession(admin, email) {

    localStorage.setItem("adminLoggedIn", "true");
    localStorage.setItem("adminType", "normal");
    localStorage.setItem("adminId", admin.id);
    localStorage.setItem("adminName", admin.name || "Normal Admin");
    localStorage.setItem("adminUsername", admin.email || email);
    localStorage.setItem("adminAccess", admin.access || "limited");

    localStorage.setItem("ssc_logged_in", "true");
    localStorage.setItem("ssc_login_type", "admin");
    localStorage.setItem("ssc_admin_username", admin.email || email);
    localStorage.setItem(
        "ssc_admin_permissions",
        JSON.stringify(admin.permissions || {})
    );

    if (admin.commands !== undefined) {
        localStorage.setItem("adminCommands", JSON.stringify(admin.commands));
    }
}

// Pichla verified session isi email ka hai ya nahi
function hasCachedNormalSession(email) {

    return (
        localStorage.getItem("adminLoggedIn") === "true" &&
        localStorage.getItem("adminType") === "normal" &&
        String(localStorage.getItem("adminUsername") || "")
            .trim()
            .toLowerCase() === email
    );
}


// =====================================================
// VERIFY NORMAL ADMIN
// Sirf apni email wala document padhta hai
// (pehle poori "admins" collection padh rahe the)
// =====================================================

async function verifyNormalAdmin(email) {

    try {

        const snapshot = await getDocs(
            query(
                collection(db, "admins"),
                where("email", "==", email)
            )
        );

        if (snapshot.empty) {
            return {
                status: "rejected",
                reason: "🚫 यह Admin Firestore में registered नहीं है।"
            };
        }

        const item = snapshot.docs[0];
        const admin = { id: item.id, ...item.data() };

        if (String(admin.role || "").trim().toLowerCase() !== "admin") {
            return {
                status: "rejected",
                reason: "🚫 यह account Normal Admin नहीं है।"
            };
        }

        if (String(admin.status || "active").trim().toLowerCase() !== "active") {
            return {
                status: "rejected",
                reason: "🚫 आपका Admin account blocked / inactive है।"
            };
        }

        return { status: "ok", admin: admin };

    } catch (error) {

        console.error("Normal Admin Verification Error:", error);

        if (error && error.code === "permission-denied") {
            return {
                status: "rejected",
                reason: "🚫 Firestore permission denied। Firestore Rules check करें।"
            };
        }

        // Network / unknown error: logout nahi
        return { status: "error", transient: isTransientError(error) };
    }
}


// =====================================================
// SETUP ADMIN PANEL
// =====================================================

function setupAdminPanel() {
    showAdminInfo();
    applyPermissions();
    updateAdminCounts();
}


// =====================================================
// ADMIN TYPE / PERMISSIONS
// =====================================================

function getCurrentAdminType() {

    const adminType = localStorage.getItem("adminType");

    if (adminType === "master") return "master";
    if (adminType === "normal") return "normal";

    const loginType = localStorage.getItem("ssc_login_type");

    if (loginType === "master_admin") return "master";
    if (loginType === "admin") return "normal";

    return null;
}

function hasAdminPermission(permission) {

    const type = getCurrentAdminType();

    if (type === "master") return true;
    if (type !== "normal") return false;

    let permissions = {};

    try {
        permissions = JSON.parse(
            localStorage.getItem("ssc_admin_permissions") || "{}"
        );
    } catch (error) {
        permissions = {};
    }

    return (
        !!permissions &&
        (permissions.all === true || permissions[permission] === true)
    );
}

function requirePermission(permission) {

    if (!hasAdminPermission(permission)) {
        alert("🚫 आपको इस section की permission नहीं दी गई है।");
        return false;
    }

    return true;
}


// =====================================================
// SHOW ADMIN INFO
// =====================================================

function showAdminInfo() {

    const name =
        localStorage.getItem("adminName") ||
        localStorage.getItem("adminUsername") ||
        localStorage.getItem("ssc_admin_username") ||
        "Admin";

    const type = getCurrentAdminType();

    const typeText =
        type === "master" ? "👑 Master Admin" : "👨‍💼 Normal Admin";

    ["adminName", "loggedAdminName"].forEach(function (id) {
        const element = document.getElementById(id);
        if (element) element.textContent = name;
    });

    ["adminType", "loggedAdminType"].forEach(function (id) {
        const element = document.getElementById(id);
        if (element) element.textContent = typeText;
    });

    const info = document.getElementById("adminInfo");

    if (info) {
        info.innerHTML =
            "👨‍💼 <b>" + escapeAdminHTML(name) + "</b><br>" +
            "🔐 " + typeText;
    }
}


// =====================================================
// APPLY PERMISSIONS
// =====================================================

function applyPermissions() {

    // Master Administration section sirf Master Admin ke liye
    const masterSection = document.getElementById("masterSection");

    if (masterSection) {
        masterSection.style.display =
            getCurrentAdminType() === "master" ? "" : "none";
    }

    document
        .querySelectorAll(".permission-card")
        .forEach(function (card) {

            const permission = String(card.dataset.permission || "").trim();

            if (!permission) return;

            if (hasAdminPermission(permission)) {
                card.style.display = "";
                card.classList.remove("disabled");
            } else {
                card.style.display = "none";
            }
        });
}


// =====================================================
// PAGE OPENERS (permission check ke saath)
// =====================================================

function guardedOpen(permission, page) {

    return function () {

        if (!requirePermission(permission)) return;

        window.location.href = page;
    };
}

function openAdminManagement() {

    if (getCurrentAdminType() !== "master") {
        alert("🚫 केवल Master Admin Normal Admin Management कर सकता है।");
        return;
    }

    window.location.href = "admin-management.html";
}

function goHome() {
    window.location.href = "index.html";
}

function openPage(page) {
    if (!page) return;
    window.location.href = page;
}


// =====================================================
// STUDENT LIST
// =====================================================

async function showStudents() {

    if (!requirePermission("students")) return;

    const container = document.getElementById("studentList");

    if (!container) {
        alert("Student List section अभी page में नहीं है।");
        return;
    }

    container.innerHTML = "<p>⏳ Students loading...</p>";

    try {

        const snapshot = await getDocs(collection(db, "students"));

        if (snapshot.empty) {
            container.innerHTML = "<p>अभी कोई Student नहीं है।</p>";
            return;
        }

        container.innerHTML = snapshot.docs
            .map(function (studentDoc) {

                const student = studentDoc.data();

                return `
                    <div style="padding:15px;margin:10px 0;background:white;color:#111827;border-radius:10px;">
                        <b>👨‍🎓 ${escapeAdminHTML(student.name || student.displayName || "Student")}</b><br>
                        📧 ${escapeAdminHTML(student.email || "-")}<br>
                        📱 ${escapeAdminHTML(student.mobile || student.phone || "-")}<br>
                        Status: <b>${escapeAdminHTML(student.status || "active")}</b>
                    </div>
                `;
            })
            .join("");

    } catch (error) {

        console.error("Student Firebase Error:", error);

        container.innerHTML = "<p>❌ Students load नहीं हुए।</p>";
    }
}


// =====================================================
// FIREBASE COUNTS
// =====================================================

async function setCount(collectionName, elementId) {

    const element = document.getElementById(elementId);

    if (!element) return;

    element.textContent = "⏳";

    try {

        const snapshot = await getDocs(collection(db, collectionName));

        element.textContent = snapshot.size;

    } catch (error) {

        console.error(collectionName + " Count Error:", error);

        element.textContent = "0";
    }
}

function updateAdminCounts() {

    setCount("students", "studentCount");
    setCount("courses", "courseCount");
    setCount("mockQuestions", "questionCount");
}


// =====================================================
// ADMIN LOGOUT (sirf yahi asli logout hai)
// =====================================================

async function adminLogout() {

    if (!confirm("क्या आप Admin Logout करना चाहते हैं?")) return;

    await safeSignOut();

    clearAdminSession();

    window.location.replace(LOGIN_PAGE);
}


// =====================================================
// WINDOW FUNCTIONS
// =====================================================

window.openCourses = guardedOpen("courses", "course-management.html");
window.openSubjects = guardedOpen("subjects", "subjects.html");
window.openChapters = guardedOpen("chapters", "chapters.html");
window.openVideos = guardedOpen("videos", "videos.html");
window.openPDFs = guardedOpen("pdfs", "pdfs.html");
window.openMockTests = guardedOpen("mockTests", "test-management.html");
window.openStudents = guardedOpen("students", "Students.html");
window.openLiveClasses = guardedOpen("liveClasses", "live-classes-management.html");
window.openPayments = guardedOpen("payments", "admin-payments.html");
window.openPaymentRequests = guardedOpen("payments", "payment-requests.html");
window.openQuestionSections = guardedOpen("questions", "question-section.html");
window.openQuestionUpload = guardedOpen("questions", "question-upload.html");
window.openQuestions = guardedOpen("questions", "question-section.html");

window.showStudents = showStudents;
window.openAdminManagement = openAdminManagement;
window.goHome = goHome;
window.openPage = openPage;
window.adminLogout = adminLogout;
window.requirePermission = requirePermission;
window.hasAdminPermission = hasAdminPermission;
