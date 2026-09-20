/* =====================================================
   RM VIDYA PEETH - DASHBOARD.JS (FIXED)
   By Ranjan Mishra Sir
   ===================================================== */

import {
    startStudentGuard,
    logoutStudent,
    getStoredStudent
} from "./student-session.js";


// Personal WhatsApp number (Contact Us yahi use karta hai)
const DEFAULT_WHATSAPP = "9958522950";

// Bottom nav ka "WhatsApp" button ye link kholega.
// Channel link:  https://whatsapp.com/channel/XXXXXXXXXXXX
// Group link:    https://chat.whatsapp.com/XXXXXXXXXXXX
const WHATSAPP_CHANNEL_URL = "https://whatsapp.com/channel/0029VbDUtRr2ZjCmD8wTSb0Z";


/* =====================================================
   HELPERS
===================================================== */

function setText(id, text) {

    const element = document.getElementById(id);

    if (element) {
        element.textContent = text;
    }
}

function showNotice(text) {

    const box = document.getElementById("dashboardNotice");

    if (!box) {
        console.warn(text);
        return;
    }

    box.textContent = text;
    box.hidden = false;
}

function getStudentName(user) {

    return (
        user.name ||
        user.displayName ||
        user.fullName ||
        user.username ||
        localStorage.getItem("ssc_student_name") ||
        "Student"
    );
}


/* =====================================================
   STUDENT INFO
===================================================== */

function loadStudentInfo(student) {

    const user = student || getStoredStudent();

    const name = getStudentName(user);

    const email = user.email || user.username || "Student Account";

    setText("studentName", name);
    setText("sideMenuStudentName", name);
    setText("sideMenuStudentEmail", email);
}


/* =====================================================
   SIDE MENU
===================================================== */

window.openSideMenu = function () {

    const menu = document.getElementById("sideMenu");
    const overlay = document.getElementById("sideMenuOverlay");

    if (menu) menu.classList.add("open");
    if (overlay) overlay.classList.add("show");

    document.body.style.overflow = "hidden";
};

window.closeSideMenu = function () {

    const menu = document.getElementById("sideMenu");
    const overlay = document.getElementById("sideMenuOverlay");

    if (menu) menu.classList.remove("open");
    if (overlay) overlay.classList.remove("show");

    document.body.style.overflow = "";
};


/* =====================================================
   WHATSAPP
===================================================== */

function getWhatsAppNumber() {

    let saved = "";

    try {
        saved = localStorage.getItem("whatsappNumber") || "";
    } catch (e) { }

    const clean = String(saved || DEFAULT_WHATSAPP).replace(/\D/g, "");

    if (!clean) return "";

    return clean.length === 10 ? "91" + clean : clean;
}

function openWhatsAppChat(text) {

    const number = getWhatsAppNumber();

    if (!number) {
        alert("WhatsApp number उपलब्ध नहीं है।");
        return;
    }

    let url = "https://wa.me/" + number;

    if (text) {
        url += "?text=" + encodeURIComponent(text);
    }

    window.open(url, "_blank", "noopener");
}

window.openContactUs = function () {

    window.closeSideMenu();

    openWhatsAppChat("Hello RM Vidya Peeth, मुझे सहायता चाहिए।");
};

function getWhatsAppChannelUrl() {

    const url = String(WHATSAPP_CHANNEL_URL || "").trim();

    // Sirf asli WhatsApp Channel ya Group invite link hi maana jayega
    const valid =
        /^https:\/\/(www\.)?whatsapp\.com\/channel\/[A-Za-z0-9_-]+\/?(\?.*)?$/i.test(url) ||
        /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9_-]+\/?(\?.*)?$/i.test(url);

    return valid ? url : "";
}

// Bottom nav "WhatsApp" -> WhatsApp Channel / Group link
// (link set na ho to personal chat khulega)
window.openWhatsApp = function () {

    const channelUrl = getWhatsAppChannelUrl();

    if (channelUrl) {
        window.open(channelUrl, "_blank", "noopener");
        return;
    }

    openWhatsAppChat("");
};


/* =====================================================
   REFER & EARN
   (पहले ये message institute के ही WhatsApp number पर जा रहा था;
    अब student अपने दोस्त को share करता है)
===================================================== */

window.openReferEarn = async function () {

    window.closeSideMenu();

    const name = getStudentName(getStoredStudent());

    const link = new URL("./", window.location.href).href;

    const text =
        "🎁 RM Vidya Peeth\n\n" +
        "Hello! मैं " + name + " RM Vidya Peeth पर पढ़ाई और mock tests कर रहा/रही हूँ। " +
        "आप भी join करें:\n" + link;

    if (navigator.share) {

        try {

            await navigator.share({
                title: "RM Vidya Peeth",
                text: text
            });

            return;

        } catch (error) {

            // Student ने share cancel किया
            if (error && error.name === "AbortError") {
                return;
            }
        }
    }

    window.open(
        "https://wa.me/?text=" + encodeURIComponent(text),
        "_blank",
        "noopener"
    );
};


/* =====================================================
   LOGOUT
   (Firebase से भी signOut होता है + पूरा student session साफ होता है)
===================================================== */

window.logoutStudent = async function () {

    if (!confirm("क्या आप Logout करना चाहते हैं?")) {
        return;
    }

    await logoutStudent();
};


/* =====================================================
   MOCK TEST NAVIGATION
   Dashboard केवल page खोलेगा।
   Firestore का पूरा काम mock-test.html करेगा।
===================================================== */

window.openMockTests = function (mode) {

    const selectedMode =
        String(mode || "free").toLowerCase().trim() === "paid"
            ? "paid"
            : "free";

    window.location.href =
        "mock-test.html?mode=" + encodeURIComponent(selectedMode);
};


/* =====================================================
   DASHBOARD SEARCH
===================================================== */

function initDashboardSearch() {

    const search = document.getElementById("dashboardSearch");

    if (!search) return;

    const cards = Array.from(document.querySelectorAll(".feature"));

    search.addEventListener("input", function () {

        const q = this.value.toLowerCase().trim();

        cards.forEach(function (card) {

            const text = card.innerText.toLowerCase();

            card.style.display = (!q || text.includes(q)) ? "" : "none";
        });
    });
}


/* =====================================================
   INITIALIZE
===================================================== */

function initDashboard() {

    // Pehle saved data se turant dikhao
    loadStudentInfo();

    initDashboardSearch();

    // Phir Firebase se verify karo (logout sirf tab jab pakka zaroori ho)
    startStudentGuard({
        onReady: loadStudentInfo,
        onNotice: showNotice
    });
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDashboard);
} else {
    initDashboard();
}


/* =====================================================
   ESC KEY
===================================================== */

document.addEventListener("keydown", function (event) {

    if (event.key === "Escape") {
        window.closeSideMenu();
    }
});
