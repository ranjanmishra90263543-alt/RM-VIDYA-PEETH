import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    getDoc,
    doc,
    query,
    where,
    updateDoc,
    deleteDoc,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

/* =========================================================
   FIREBASE
========================================================= */

const firebaseConfig = {
    apiKey: "AIzaSyAqsesw3BWaHK7G1Y1jw0K9kr9suZ1pPV4",
    authDomain: "ssc-courses.firebaseapp.com",
    projectId: "ssc-courses",
    storageBucket: "ssc-courses.firebasestorage.app",
    messagingSenderId: "886294132394",
    appId: "1:886294132394:web:58b82a2a49f9cd1e0f02d3",
    measurementId: "G-9QSCEVYSE5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const SERIES = "mockSeries";
const QUESTIONS = "mockQuestions";
const TESTS = "mockTests";

/* =========================================================
   TRANSLATOR
========================================================= */

const MYMEMORY_TRANSLATE_URL =
    "https://api.mymemory.translated.net/get";

const MYMEMORY_LANGPAIR = "hi|en";

// Retry a transient translation failure this many times
// before pausing the whole run and asking the admin to resume.
const TRANSLATOR_MAX_ATTEMPTS = 3;
const TRANSLATOR_RETRY_DELAY_MS = 1500;

let questions = [];
let seriesList = [];

let editingQuestionId = null;
let editingTestId = null;
let editingSeriesId = null;

let firebaseUser = null;

let currentSeriesId =
    localStorage.getItem("THE_HUB_CURRENT_SERIES") || "";

let currentTestSessionId =
    localStorage.getItem("THE_HUB_CURRENT_TEST_SESSION");

let translatorDocs = [];

// FIX: resume position is now tracked by the last successfully
// translated document's Firestore ID, not by array index.
// Firestore snapshot order is not guaranteed to stay stable
// between page loads, so an index-based resume could silently
// point at the wrong question after a refresh.
let translatorLastId =
    localStorage.getItem("THE_HUB_TRANSLATOR_LAST_ID") || null;

let translatorIndex = 0; // in-memory pointer for the current run only

let translatorRunning = false;
let translatorStopRequested = false;

/* =========================================================
   BASIC HELPERS
========================================================= */

function createId(prefix) {
    return prefix + "_" +
        Date.now() + "_" +
        Math.random().toString(36).substring(2, 10);
}

function createTestSessionId() {
    return createId("TEST");
}

function ensureTestSession() {

    if (!currentTestSessionId) {

        currentTestSessionId =
            createTestSessionId();

        localStorage.setItem(
            "THE_HUB_CURRENT_TEST_SESSION",
            currentTestSessionId
        );
    }

    updateSessionDisplay();

    return currentTestSessionId;
}

function updateSessionDisplay() {

    const sessionEl =
        document.getElementById("sessionIdText");

    if (sessionEl) {
        sessionEl.textContent =
            currentTestSessionId || "-";
    }

    const s =
        seriesList.find(x => x.id === currentSeriesId);

    const seriesEl =
        document.getElementById("sessionSeriesText");

    if (seriesEl) {
        seriesEl.textContent =
            s ? s.seriesName : "Standalone Test";
    }
}

function showStatus(message, type = "success") {

    const box =
        document.getElementById("status");

    if (!box) return;

    box.className =
        "status show " + type;

    box.textContent = message;

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    setTimeout(() => {
        box.className = "status";
    }, 7000);
}

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function validityText(data) {

    const type =
        data?.validityType || "unlimited";

    if (type === "days") {
        return "📅 " +
            Number(data.validityDays || 0) +
            " Days";
    }

    if (type === "date-range") {
        return "🗓️ " +
            (data.startDate || "-") +
            " → " +
            (data.expiryDate || "-");
    }

    return "♾️ Unlimited";
}

/* =========================================================
   TOGGLES
========================================================= */

window.toggleSeriesValidity = function() {

    const type =
        document.getElementById(
            "seriesValidityType"
        ).value;

    document.getElementById(
        "seriesDaysBox"
    ).classList.toggle(
        "hidden",
        type !== "days"
    );

    document.getElementById(
        "seriesDateBox"
    ).classList.toggle(
        "hidden",
        type !== "date-range"
    );
};

window.toggleTestValidity = function() {

    const type =
        document.getElementById(
            "testValidityType"
        ).value;

    document.getElementById(
        "testDaysBox"
    ).classList.toggle(
        "hidden",
        type !== "days"
    );

    document.getElementById(
        "testDateBox"
    ).classList.toggle(
        "hidden",
        type !== "date-range"
    );
};

window.toggleSeriesPrice = function() {

    const paid =
        document.getElementById(
            "seriesAccess"
        ).value === "paid";

    document.getElementById(
        "seriesPriceBox"
    ).classList.toggle(
        "hidden",
        !paid
    );

    if (!paid) {
        document.getElementById(
            "seriesPrice"
        ).value = "";
    }

    updateSeriesPricePreview();
};

function updateSeriesPricePreview() {

    const p =
        Number(
            document.getElementById(
                "seriesPrice"
            ).value
        ) || 0;

    document.getElementById(
        "seriesPricePreview"
    ).textContent =
        "💰 Price: ₹" +
        p.toFixed(2);
}

document.getElementById(
    "seriesPrice"
)?.addEventListener(
    "input",
    updateSeriesPricePreview
);

window.togglePriceField = function() {

    const paid =
        document.getElementById(
            "access"
        ).value === "paid";

    document.getElementById(
        "priceBox"
    ).classList.toggle(
        "hidden",
        !paid
    );

    if (!paid) {
        document.getElementById(
            "price"
        ).value = "";
    }

    updatePricePreview();
};

function updatePricePreview() {

    const p =
        Number(
            document.getElementById(
                "price"
            ).value
        ) || 0;

    document.getElementById(
        "pricePreview"
    ).textContent =
        "💰 Price: ₹" +
        p.toFixed(2);
}

document.getElementById(
    "price"
)?.addEventListener(
    "input",
    updatePricePreview
);

/* =========================================================
   AUTH
========================================================= */

window.firebaseAdminLogin = async function() {

    const email =
        document.getElementById(
            "authEmail"
        ).value.trim();

    const password =
        document.getElementById(
            "authPassword"
        ).value;

    if (!email) {
        return showStatus(
            "Admin Email भरें।",
            "error"
        );
    }

    if (!password) {
        return showStatus(
            "Password भरें।",
            "error"
        );
    }

    try {

        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        showStatus(
            "✅ Firebase Admin Login successful."
        );

    } catch (e) {

        showStatus(
            "Firebase Login failed: " +
            e.message,
            "error"
        );
    }
};

window.firebaseAdminLogout = async function() {

    try {

        await signOut(auth);

        showStatus(
            "Firebase Admin logout हो गया।",
            "info"
        );

    } catch (e) {

        showStatus(
            "Logout failed: " +
            e.message,
            "error"
        );
    }
};

onAuthStateChanged(
    auth,
    async user => {

        firebaseUser = user;

        const authBox =
            document.getElementById(
                "authBox"
            );

        const userBox =
            document.getElementById(
                "userBox"
            );

        const appContent =
            document.getElementById(
                "appContent"
            );

        if (!user) {

            authBox.classList.remove(
                "hidden"
            );

            userBox.classList.add(
                "hidden"
            );

            appContent.classList.add(
                "hidden"
            );

            return;
        }

        authBox.classList.add(
            "hidden"
        );

        userBox.classList.remove(
            "hidden"
        );

        appContent.classList.remove(
            "hidden"
        );

        document.getElementById(
            "userEmail"
        ).textContent =
            user.email || user.uid;

        ensureTestSession();

        window.togglePriceField();
        window.toggleSeriesPrice();
        window.toggleSeriesValidity();
        window.toggleTestValidity();

        try {

            await loadSeries();
            await loadCurrentTestQuestions();
            await loadTests();
            await window.refreshTranslationStats();

        } catch (e) {

            showStatus(
                "Firestore load error: " +
                e.message,
                "error"
            );
        }
    }
);

/* =========================================================
   SERIES
========================================================= */

function getSeriesFormData() {

    const access =
        document.getElementById(
            "seriesAccess"
        ).value;

    const type =
        document.getElementById(
            "seriesValidityType"
        ).value;

    return {

        seriesName:
            document.getElementById(
                "seriesName"
            ).value.trim(),

        course:
            document.getElementById(
                "seriesCourse"
            ).value.trim(),

        examName:
            document.getElementById(
                "seriesExamName"
            ).value.trim(),

        category:
            document.getElementById(
                "seriesCategory"
            ).value.trim(),

        subject:
            document.getElementById(
                "seriesSubject"
            ).value.trim(),

        access,

        price:
            access === "paid"
                ? Number(
                    document.getElementById(
                        "seriesPrice"
                    ).value
                  ) || 0
                : 0,

        description:
            document.getElementById(
                "seriesDescription"
            ).value.trim(),

        validityType: type,

        validityDays:
            type === "days"
                ? Number(
                    document.getElementById(
                        "seriesValidityDays"
                    ).value
                  ) || 0
                : null,

        startDate:
            type === "date-range"
                ? document.getElementById(
                    "seriesStartDate"
                  ).value || null
                : null,

        expiryDate:
            type === "date-range"
                ? document.getElementById(
                    "seriesExpiryDate"
                  ).value || null
                : null
    };
}

window.saveSeries = async function() {

    if (!firebaseUser) {
        return showStatus(
            "पहले Firebase Admin Login करें।",
            "error"
        );
    }

    const data =
        getSeriesFormData();

    if (
        !data.seriesName ||
        !data.course ||
        !data.examName ||
        !data.subject
    ) {
        return showStatus(
            "Series Name, Course, Exam और Subject भरना अनिवार्य है।",
            "error"
        );
    }

    if (
        data.access === "paid" &&
        data.price <= 0
    ) {
        return showStatus(
            "Paid Series के लिए valid Price दर्ज करें।",
            "error"
        );
    }

    try {

        if (editingSeriesId) {

            await updateDoc(
                doc(
                    db,
                    SERIES,
                    editingSeriesId
                ),
                {
                    ...data,
                    isPaid:
                        data.access === "paid",
                    isFree:
                        data.access === "free",
                    updatedBy:
                        firebaseUser.uid,
                    updatedAt:
                        serverTimestamp()
                }
            );

            // FIX: previously the series you had just edited did NOT
            // become the "active" series shown on screen — the page
            // kept whatever series was active before you clicked Edit.
            // Now editing a series makes it the active one, which is
            // what an admin expects right after saving changes to it.
            currentSeriesId = editingSeriesId;

            localStorage.setItem(
                "THE_HUB_CURRENT_SERIES",
                currentSeriesId
            );

            showStatus(
                "✅ Series successfully update हो गई।"
            );

        } else {

            const seriesId =
                createId("SERIES");

            const ref =
                await addDoc(
                    collection(
                        db,
                        SERIES
                    ),
                    {
                        seriesId,
                        ...data,
                        isPaid:
                            data.access === "paid",
                        isFree:
                            data.access === "free",
                        active: true,
                        totalTests: 0,
                        createdBy:
                            firebaseUser.uid,
                        updatedBy:
                            firebaseUser.uid,
                        createdAt:
                            serverTimestamp(),
                        updatedAt:
                            serverTimestamp()
                    }
                );

            currentSeriesId = ref.id;

            localStorage.setItem(
                "THE_HUB_CURRENT_SERIES",
                currentSeriesId
            );

            showStatus(
                "✅ Series successfully create हो गई।"
            );
        }

        window.clearSeriesForm();

        await loadSeries();

        document.getElementById(
            "seriesSelect"
        ).value =
            currentSeriesId;

        window.selectSeries();

    } catch (e) {

        showStatus(
            "Series save error: " +
            e.message,
            "error"
        );
    }
};

async function loadSeries() {

    const snap =
        await getDocs(
            collection(db, SERIES)
        );

    seriesList = [];

    snap.forEach(x => {
        seriesList.push({
            id: x.id,
            ...x.data()
        });
    });

    seriesList.reverse();

    const select =
        document.getElementById(
            "seriesSelect"
        );

    select.innerHTML =
        `<option value="">
            -- Standalone Test / कोई Series नहीं --
        </option>`;

    seriesList.forEach(s => {

        const o =
            document.createElement(
                "option"
            );

        o.value = s.id;

        o.textContent =
            (s.seriesName ||
                "Unnamed Series") +
            " " +
            (s.access === "paid"
                ? "💳"
                : "🆓");

        select.appendChild(o);
    });

    if (currentSeriesId) {
        select.value =
            currentSeriesId;
    }

    window.selectSeries();

    renderAllSeries();
}

window.selectSeries = function() {

    currentSeriesId =
        document.getElementById(
            "seriesSelect"
        ).value;

    if (currentSeriesId) {

        localStorage.setItem(
            "THE_HUB_CURRENT_SERIES",
            currentSeriesId
        );

    } else {

        localStorage.removeItem(
            "THE_HUB_CURRENT_SERIES"
        );
    }

    const s =
        seriesList.find(
            x => x.id === currentSeriesId
        );

    const box =
        document.getElementById(
            "activeSeriesBox"
        );

    if (!s) {

        box.classList.add(
            "hidden"
        );

    } else {

        box.classList.remove(
            "hidden"
        );

        document.getElementById(
            "activeSeriesName"
        ).textContent =
            s.seriesName || "-";

        document.getElementById(
            "activeSeriesId"
        ).textContent =
            s.seriesId || s.id;

        document.getElementById(
            "activeSeriesAccess"
        ).textContent =
            s.access === "paid"
                ? "💳 Paid"
                : "🆓 Free";

        document.getElementById(
            "activeSeriesPrice"
        ).textContent =
            "₹" +
            Number(s.price || 0)
                .toFixed(2);

        document.getElementById(
            "activeSeriesValidity"
        ).textContent =
            validityText(s);
    }

    updateSessionDisplay();
    loadSeriesTests();
};

function renderAllSeries() {

    const box =
        document.getElementById(
            "allSeriesList"
        );

    if (!seriesList.length) {

        box.innerHTML =
            `<div class="empty">
                अभी कोई Series नहीं बनी है।
            </div>`;

        return;
    }

    box.innerHTML =
        seriesList.map(s => `

        <div class="series-item">

            <div class="series-title">
                📚 ${escapeHTML(
                    s.seriesName ||
                    "Unnamed Series"
                )}
            </div>

            <div class="test-meta">

                <span class="badge badge-purple">
                    SERIES
                </span>

                ${
                    s.access === "paid"
                    ?
                    `<span class="badge badge-orange">
                        💳 PAID ₹${Number(
                            s.price || 0
                        ).toFixed(2)}
                    </span>`
                    :
                    `<span class="badge badge-green">
                        🆓 FREE
                    </span>`
                }

                <br><br>

                📘 Course:
                ${escapeHTML(s.course || "-")}<br>

                🏛️ Exam:
                ${escapeHTML(s.examName || "-")}<br>

                📖 Subject:
                ${escapeHTML(s.subject || "-")}<br>

                📚 Tests:
                ${Number(s.totalTests || 0)}<br>

                ⏳ Validity:
                ${escapeHTML(validityText(s))}

            </div>

            <div class="small-buttons">

                <button class="small-btn blue"
                    onclick="useSeries('${s.id}')">
                    📚 Use
                </button>

                <button class="small-btn yellow"
                    onclick="editSeries('${s.id}')">
                    ✏️ Edit
                </button>

                <button class="small-btn red"
                    onclick="deleteSeries('${s.id}')">
                    🗑️ Delete
                </button>

            </div>

        </div>

    `).join("");
}

window.useSeries = function(id) {

    currentSeriesId = id;

    localStorage.setItem(
        "THE_HUB_CURRENT_SERIES",
        id
    );

    document.getElementById(
        "seriesSelect"
    ).value = id;

    window.selectSeries();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    showStatus(
        "📚 Series select हो गई।"
    );
};

window.editSeries = function(id) {

    const s =
        seriesList.find(
            x => x.id === id
        );

    if (!s) return;

    editingSeriesId = id;

    document.getElementById(
        "seriesName"
    ).value =
        s.seriesName || "";

    document.getElementById(
        "seriesCourse"
    ).value =
        s.course || "";

    document.getElementById(
        "seriesExamName"
    ).value =
        s.examName || "";

    document.getElementById(
        "seriesCategory"
    ).value =
        s.category || "";

    document.getElementById(
        "seriesSubject"
    ).value =
        s.subject || "";

    document.getElementById(
        "seriesAccess"
    ).value =
        s.access || "free";

    document.getElementById(
        "seriesPrice"
    ).value =
        s.price || "";

    document.getElementById(
        "seriesDescription"
    ).value =
        s.description || "";

    document.getElementById(
        "seriesValidityType"
    ).value =
        s.validityType || "unlimited";

    document.getElementById(
        "seriesValidityDays"
    ).value =
        s.validityDays || "";

    document.getElementById(
        "seriesStartDate"
    ).value =
        s.startDate || "";

    document.getElementById(
        "seriesExpiryDate"
    ).value =
        s.expiryDate || "";

    window.toggleSeriesPrice();
    window.toggleSeriesValidity();

    document.getElementById(
        "seriesSaveBtn"
    ).textContent =
        "💾 Update Series";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
};

window.deleteSeries = async function(id) {

    if (!confirm(
        "क्या यह Series delete करनी है? (इसके tests delete नहीं होंगे)"
    )) return;

    try {

        await deleteDoc(
            doc(db, SERIES, id)
        );

        if (currentSeriesId === id) {

            currentSeriesId = "";

            localStorage.removeItem(
                "THE_HUB_CURRENT_SERIES"
            );
        }

        await loadSeries();

        showStatus(
            "✅ Series delete हो गई।"
        );

    } catch (e) {

        showStatus(
            "Series delete failed: " +
            e.message,
            "error"
        );
    }
};

window.clearSeriesForm = function() {

    editingSeriesId = null;

    [
        "seriesName",
        "seriesCourse",
        "seriesExamName",
        "seriesCategory",
        "seriesSubject",
        "seriesPrice",
        "seriesDescription",
        "seriesValidityDays",
        "seriesStartDate",
        "seriesExpiryDate"
    ].forEach(id => {

        document.getElementById(id).value = "";

    });

    document.getElementById(
        "seriesAccess"
    ).value = "free";

    document.getElementById(
        "seriesValidityType"
    ).value = "unlimited";

    document.getElementById(
        "seriesSaveBtn"
    ).textContent =
        "📚 Create Series";

    window.toggleSeriesPrice();
    window.toggleSeriesValidity();
};

/* =========================================================
   TEST VALIDATION
========================================================= */

function validateTestBasicData() {

    const access =
        document.getElementById(
            "access"
        ).value;

    const type =
        document.getElementById(
            "testValidityType"
        ).value;

    const data = {

        testType:
            document.getElementById(
                "testType"
            ).value,

        access,

        price:
            access === "paid"
                ? Number(
                    document.getElementById(
                        "price"
                    ).value
                  ) || 0
                : 0,

        course:
            document.getElementById(
                "course"
            ).value.trim(),

        examName:
            document.getElementById(
                "examName"
            ).value.trim(),

        category:
            document.getElementById(
                "category"
            ).value.trim(),

        subject:
            document.getElementById(
                "subject"
            ).value.trim(),

        chapter:
            document.getElementById(
                "chapter"
            ).value.trim(),

        section:
            document.getElementById(
                "section"
            ).value.trim(),

        testNumber:
            Number(
                document.getElementById(
                    "testNumber"
                ).value
            ) || 1,

        testName:
            document.getElementById(
                "testName"
            ).value.trim(),

        testTime:
            Number(
                document.getElementById(
                    "testTime"
                ).value
            ) || 30,

        marksPerQuestion:
            Number(
                document.getElementById(
                    "marksPerQuestion"
                ).value
            ) || 1,

        negativeMarks:
            Number(
                document.getElementById(
                    "negativeMarks"
                ).value
            ) || 0,

        validityType: type,

        validityDays:
            type === "days"
                ? Number(
                    document.getElementById(
                        "testValidityDays"
                    ).value
                  ) || 0
                : null,

        startDate:
            type === "date-range"
                ? document.getElementById(
                    "testStartDate"
                  ).value || null
                : null,

        expiryDate:
            type === "date-range"
                ? document.getElementById(
                    "testExpiryDate"
                  ).value || null
                : null
    };

    if (
        !data.course ||
        !data.examName ||
        !data.subject ||
        !data.testName
    ) {

        showStatus(
            "Course, Exam, Subject और Test Name भरना जरूरी है।",
            "error"
        );

        return null;
    }

    if (
        data.access === "paid" &&
        data.price <= 0
    ) {

        showStatus(
            "Paid Test के लिए Price भरना अनिवार्य है।",
            "error"
        );

        return null;
    }

    return data;
}

/* =========================================================
   QUESTION HELPERS
========================================================= */

function getInput(id) {

    return String(
        document.getElementById(id)?.value || ""
    ).trim();
}

function getHindiQuestionForm() {

    return {
        question: getInput("question"),
        A: getInput("optionA"),
        B: getInput("optionB"),
        C: getInput("optionC"),
        D: getInput("optionD"),
        solution: getInput("solution")
    };
}

function getEnglishQuestionForm() {

    return {
        questionEn: getInput("questionEn"),
        AEn: getInput("optionAEn"),
        BEn: getInput("optionBEn"),
        CEn: getInput("optionCEn"),
        DEn: getInput("optionDEn"),
        solutionEn: getInput("solutionEn")
    };
}

/* =========================================================
   ADD / UPDATE QUESTION
========================================================= */

window.addQuestion = async function() {

    if (!firebaseUser) {
        return showStatus(
            "पहले Firebase Admin Login करें।",
            "error"
        );
    }

    const sessionId =
        ensureTestSession();

    const testData =
        validateTestBasicData();

    if (!testData) return;

    const fileName =
        getInput("fileName");

    const hi =
        getHindiQuestionForm();

    const en =
        getEnglishQuestionForm();

    const answer =
        Number(
            document.getElementById(
                "correctAnswer"
            ).value
        );

    const marks =
        Number(
            document.getElementById(
                "questionMarks"
            ).value
        ) ||
        testData.marksPerQuestion;

    if (
        !fileName ||
        !hi.question ||
        !hi.A ||
        !hi.B ||
        !hi.C ||
        !hi.D ||
        ![1, 2, 3, 4].includes(answer)
    ) {

        return showStatus(
            "Hindi Question, Options A-D और Correct Answer भरना जरूरी है।",
            "error"
        );
    }

    try {

        const payload = {

            testSessionId: sessionId,

            seriesId:
                currentSeriesId || null,

            fileName,

            /* Hindi */
            question: hi.question,
            A: hi.A,
            B: hi.B,
            C: hi.C,
            D: hi.D,

            options: [
                hi.A,
                hi.B,
                hi.C,
                hi.D
            ],

            solution: hi.solution,
            explanation: hi.solution,

            /* English */
            questionEn: en.questionEn,
            AEn: en.AEn,
            BEn: en.BEn,
            CEn: en.CEn,
            DEn: en.DEn,
            solutionEn: en.solutionEn,

            optionsEn: [
                en.AEn,
                en.BEn,
                en.CEn,
                en.DEn
            ],

            marks,

            ...testData,

            correctAnswer: answer,
            answerFormat: "1-based",

            updatedBy:
                firebaseUser.uid,

            updatedAt:
                serverTimestamp()
        };

        if (editingQuestionId) {

            await updateDoc(
                doc(
                    db,
                    QUESTIONS,
                    editingQuestionId
                ),
                payload
            );

            showStatus(
                "✅ Question successfully update हो गया।"
            );

        } else {

            await addDoc(
                collection(
                    db,
                    QUESTIONS
                ),
                {
                    ...payload,
                    createdBy:
                        firebaseUser.uid,
                    createdAt:
                        serverTimestamp()
                }
            );

            showStatus(
                "✅ Question Current Test में save हो गया।"
            );
        }

        window.clearQuestionForm();

        await loadCurrentTestQuestions();
        await window.refreshTranslationStats();

    } catch (e) {

        showStatus(
            "Question save failed: " +
            e.message,
            "error"
        );
    }
};

/* =========================================================
   LOAD CURRENT QUESTIONS
========================================================= */

// FIX: this used to fetch the ENTIRE mockQuestions collection every
// time (every add, edit, delete, page load) and filter it in JS.
// That gets slower and more expensive as the bank grows. It now
// asks Firestore directly for just this test session's questions.
window.loadCurrentTestQuestions = async function() {

    if (!firebaseUser) return;

    const sessionId =
        ensureTestSession();

    const snap =
        await getDocs(
            query(
                collection(db, QUESTIONS),
                where("testSessionId", "==", sessionId)
            )
        );

    questions = [];

    snap.forEach(x => {

        questions.push({
            id: x.id,
            ...x.data()
        });
    });

    renderQuestions();
};

function renderQuestions() {

    const box =
        document.getElementById(
            "questionList"
        );

    document.getElementById(
        "questionCount"
    ).textContent =
        questions.length;

    document.getElementById(
        "firestoreQuestionCount"
    ).textContent =
        questions.length;

    if (!questions.length) {

        box.innerHTML =
            `<div class="empty">
                इस Current Test में अभी कोई question नहीं है।
            </div>`;

        return;
    }

    box.innerHTML =
        questions.map((q, i) => {

            const op =
                Array.isArray(q.options)
                    ? q.options
                    : [
                        q.A || "",
                        q.B || "",
                        q.C || "",
                        q.D || ""
                    ];

            const correct =
                Number(q.correctAnswer);

            let letter =
                ["A", "B", "C", "D"]
                [correct - 1] || "-";

            if (
                !(correct >= 1 &&
                  correct <= 4)
            ) {

                const raw =
                    String(
                        q.Answer ||
                        q.answer ||
                        ""
                    )
                    .trim()
                    .toUpperCase();

                letter =
                    {
                        A: "A",
                        B: "B",
                        C: "C",
                        D: "D"
                    }[raw] || "-";
            }

            const englishAvailable =
                Boolean(
                    q.questionEn &&
                    q.AEn &&
                    q.BEn &&
                    q.CEn &&
                    q.DEn &&
                    q.solutionEn
                );

            return `

            <div class="question-box">

                <div class="question-number">
                    Question ${i + 1}
                </div>

                <div class="question-text">
                    🇮🇳 ${escapeHTML(
                        q.question ||
                        q.Question ||
                        "-"
                    )}
                </div>

                <div class="option">
                    A. ${escapeHTML(op[0])}
                </div>

                <div class="option">
                    B. ${escapeHTML(op[1])}
                </div>

                <div class="option">
                    C. ${escapeHTML(op[2])}
                </div>

                <div class="option">
                    D. ${escapeHTML(op[3])}
                </div>

                <div class="option correct">
                    ✅ Correct Answer: ${letter}
                </div>

                <div class="meta">

                    📁 File:
                    ${escapeHTML(
                        q.fileName || "-"
                    )}<br>

                    🎯 Marks:
                    ${Number(q.marks || 0)}<br>

                    💡 Hindi Solution:
                    ${escapeHTML(
                        q.solution ||
                        q.Solution ||
                        q.explanation ||
                        "-"
                    )}<br>

                    🇬🇧 English:
                    ${
                        englishAvailable
                        ?
                        `<span class="badge badge-green">
                            ✅ Available
                        </span>`
                        :
                        `<span class="badge badge-orange">
                            ⏳ Pending
                        </span>`
                    }

                </div>

                <div class="small-buttons">

                    <button
                        class="small-btn blue"
                        onclick="editQuestion('${q.id}')">
                        ✏️ Edit
                    </button>

                    <button
                        class="small-btn cyan"
                        onclick="translateQuestionById('${q.id}')">
                        🌐 Translate
                    </button>

                    <button
                        class="small-btn red"
                        onclick="deleteQuestion('${q.id}')">
                        🗑️ Delete
                    </button>

                </div>

            </div>

            `;

        }).join("");
}

/* =========================================================
   EDIT QUESTION
========================================================= */

window.editQuestion = function(id) {

    const q =
        questions.find(
            x => x.id === id
        );

    if (!q) return;

    editingQuestionId = id;

    const op =
        Array.isArray(q.options)
            ? q.options
            : [
                q.A || "",
                q.B || "",
                q.C || "",
                q.D || ""
            ];

    document.getElementById(
        "fileName"
    ).value =
        q.fileName || "";

    document.getElementById(
        "question"
    ).value =
        q.question ||
        q.Question ||
        "";

    document.getElementById(
        "optionA"
    ).value =
        op[0] || "";

    document.getElementById(
        "optionB"
    ).value =
        op[1] || "";

    document.getElementById(
        "optionC"
    ).value =
        op[2] || "";

    document.getElementById(
        "optionD"
    ).value =
        op[3] || "";

    document.getElementById(
        "questionEn"
    ).value =
        q.questionEn ||
        q.englishQuestion ||
        "";

    document.getElementById(
        "optionAEn"
    ).value =
        q.AEn ||
        q.englishA ||
        "";

    document.getElementById(
        "optionBEn"
    ).value =
        q.BEn ||
        q.englishB ||
        "";

    document.getElementById(
        "optionCEn"
    ).value =
        q.CEn ||
        q.englishC ||
        "";

    document.getElementById(
        "optionDEn"
    ).value =
        q.DEn ||
        q.englishD ||
        "";

    document.getElementById(
        "solutionEn"
    ).value =
        q.solutionEn ||
        q.englishSolution ||
        "";

    let ans =
        Number(q.correctAnswer);

    if (!(ans >= 1 && ans <= 4)) {

        const raw =
            String(
                q.Answer ||
                q.answer ||
                ""
            )
            .trim()
            .toUpperCase();

        ans =
            {
                A: 1,
                B: 2,
                C: 3,
                D: 4
            }[raw] ||
            Number(raw) ||
            "";
    }

    document.getElementById(
        "correctAnswer"
    ).value =
        ans >= 1 && ans <= 4
            ? String(ans)
            : "";

    document.getElementById(
        "solution"
    ).value =
        q.solution ||
        q.Solution ||
        q.explanation ||
        "";

    document.getElementById(
        "questionMarks"
    ).value =
        q.marks || 1;

    document.getElementById(
        "questionSaveBtn"
    ).textContent =
        "💾 Update Question";

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
};

/* =========================================================
   DELETE QUESTION
========================================================= */

window.deleteQuestion = async function(id) {

    if (!confirm(
        "क्या यह question permanently delete करना है?"
    )) return;

    try {

        await deleteDoc(
            doc(
                db,
                QUESTIONS,
                id
            )
        );

        await loadCurrentTestQuestions();
        await window.refreshTranslationStats();

        showStatus(
            "✅ Question delete हो गया।"
        );

    } catch (e) {

        showStatus(
            "Question delete error: " +
            e.message,
            "error"
        );
    }
};

/* =========================================================
   CLEAR QUESTION
========================================================= */

window.clearQuestionForm = function() {

    editingQuestionId = null;

    [
        "fileName",
        "question",
        "optionA",
        "optionB",
        "optionC",
        "optionD",
        "solution",
        "questionEn",
        "optionAEn",
        "optionBEn",
        "optionCEn",
        "optionDEn",
        "solutionEn"
    ].forEach(id => {

        const el =
            document.getElementById(id);

        if (el) el.value = "";
    });

    document.getElementById(
        "correctAnswer"
    ).value = "";

    document.getElementById(
        "questionMarks"
    ).value = "1";

    document.getElementById(
        "questionSaveBtn"
    ).textContent =
        "➕ Add Question";
};

/* =========================================================
   BULK PARSER
========================================================= */

function parseBulkText(text) {

    const blocks =
        text
            .replace(/\r\n/g, "\n")
            .split(/\n\s*---+\s*\n/g)
            .map(x => x.trim())
            .filter(Boolean);

    const result = [];

    blocks.forEach(block => {

        let f = "";
        let q = "";
        let qEn = "";

        let A = "";
        let B = "";
        let C = "";
        let D = "";

        let AEn = "";
        let BEn = "";
        let CEn = "";
        let DEn = "";

        let ans = "";

        let sol = "";
        let solEn = "";

        let field = "";

        block.split("\n").forEach(line => {

            line = line.trim();

            if (!line) return;

            const m =
                line.match(
                    /^(FileName|QuestionEn|Question|AEn|A|BEn|B|CEn|C|DEn|D|Answer|SolutionEn|Solution)\s*:\s*(.*)$/i
                );

            if (m) {

                field =
                    m[1].toLowerCase();

                const v =
                    m[2].trim();

                if (field === "filename")
                    f = v;

                else if (field === "question")
                    q = v;

                else if (field === "questionen")
                    qEn = v;

                else if (field === "a")
                    A = v;

                else if (field === "aen")
                    AEn = v;

                else if (field === "b")
                    B = v;

                else if (field === "ben")
                    BEn = v;

                else if (field === "c")
                    C = v;

                else if (field === "cen")
                    CEn = v;

                else if (field === "d")
                    D = v;

                else if (field === "den")
                    DEn = v;

                else if (field === "answer")
                    ans = v.toUpperCase();

                else if (field === "solution")
                    sol = v;

                else if (field === "solutionen")
                    solEn = v;

                return;
            }

            if (field === "question")
                q += "\n" + line;

            else if (field === "questionen")
                qEn += "\n" + line;

            else if (field === "a")
                A += "\n" + line;

            else if (field === "aen")
                AEn += "\n" + line;

            else if (field === "b")
                B += "\n" + line;

            else if (field === "ben")
                BEn += "\n" + line;

            else if (field === "c")
                C += "\n" + line;

            else if (field === "cen")
                CEn += "\n" + line;

            else if (field === "d")
                D += "\n" + line;

            else if (field === "den")
                DEn += "\n" + line;

            else if (field === "solution")
                sol += "\n" + line;

            else if (field === "solutionen")
                solEn += "\n" + line;
        });

        const n =
            {
                A: 1,
                B: 2,
                C: 3,
                D: 4
            }[ans] ||
            Number(ans) ||
            0;

        if (
            f &&
            q &&
            A &&
            B &&
            C &&
            D &&
            n >= 1 &&
            n <= 4
        ) {

            result.push({

                fileName: f.trim(),

                question: q.trim(),

                questionEn:
                    qEn.trim(),

                options: [
                    A.trim(),
                    B.trim(),
                    C.trim(),
                    D.trim()
                ],

                optionsEn: [
                    AEn.trim(),
                    BEn.trim(),
                    CEn.trim(),
                    DEn.trim()
                ],

                A: A.trim(),
                B: B.trim(),
                C: C.trim(),
                D: D.trim(),

                AEn: AEn.trim(),
                BEn: BEn.trim(),
                CEn: CEn.trim(),
                DEn: DEn.trim(),

                correctAnswer: n,

                answerFormat: "1-based",

                solution:
                    sol.trim(),

                solutionEn:
                    solEn.trim(),

                explanation:
                    sol.trim(),

                marks:
                    Number(
                        document.getElementById(
                            "marksPerQuestion"
                        ).value
                    ) || 1
            });
        }
    });

    return result;
}

/* =========================================================
   BULK UPLOAD
========================================================= */

window.uploadBulkQuestions = async function() {

    if (!firebaseUser) {
        return showStatus(
            "पहले Firebase Admin Login करें।",
            "error"
        );
    }

    const sessionId =
        ensureTestSession();

    const testData =
        validateTestBasicData();

    if (!testData) return;

    let text =
        document.getElementById(
            "bulkText"
        ).value.trim();

    const file =
        document.getElementById(
            "questionFile"
        ).files[0];

    if (!text && file) {

        try {

            text =
                await file.text();

        } catch {

            return showStatus(
                "File read error",
                "error"
            );
        }
    }

    if (!text) {

        return showStatus(
            "Questions paste करें या file select करें।",
            "error"
        );
    }

    const parsed =
        parseBulkText(text);

    if (!parsed.length) {

        return showStatus(
            "एक भी valid question नहीं मिला। Format check करें।",
            "error"
        );
    }

    if (!confirm(
        `${parsed.length} questions upload होंगे। जारी रखें?`
    )) return;

    try {

        let batch =
            writeBatch(db);

        let count = 0;

        for (const q of parsed) {

            const ref =
                doc(
                    collection(
                        db,
                        QUESTIONS
                    )
                );

            batch.set(
                ref,
                {
                    testSessionId:
                        sessionId,

                    seriesId:
                        currentSeriesId ||
                        null,

                    ...q,
                    ...testData,

                    createdBy:
                        firebaseUser.uid,

                    updatedBy:
                        firebaseUser.uid,

                    createdAt:
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp()
                }
            );

            count++;

            if (count % 400 === 0) {

                await batch.commit();

                batch =
                    writeBatch(db);
            }
        }

        if (count % 400 !== 0) {
            await batch.commit();
        }

        window.clearBulk();

        await loadCurrentTestQuestions();
        await window.refreshTranslationStats();

        showStatus(
            `✅ ${parsed.length} questions upload हो गए।`
        );

    } catch (e) {

        showStatus(
            "Bulk upload error: " +
            e.message,
            "error"
        );
    }
};

window.clearBulk = function() {

    document.getElementById(
        "bulkText"
    ).value = "";

    document.getElementById(
        "questionFile"
    ).value = "";
};

/* =========================================================
   FIRESTORE HINDI / ENGLISH HELPERS
========================================================= */

function getHindiFields(q) {

    return {

        question:
            String(
                q.question ||
                q.Question ||
                ""
            ).trim(),

        A:
            String(
                q.A || ""
            ).trim(),

        B:
            String(
                q.B || ""
            ).trim(),

        C:
            String(
                q.C || ""
            ).trim(),

        D:
            String(
                q.D || ""
            ).trim(),

        solution:
            String(
                q.solution ||
                q.Solution ||
                q.explanation ||
                ""
            ).trim()
    };
}

function getEnglishFields(q) {

    return {

        question:
            String(
                q.questionEn ||
                q.englishQuestion ||
                ""
            ).trim(),

        A:
            String(
                q.AEn ||
                q.englishA ||
                ""
            ).trim(),

        B:
            String(
                q.BEn ||
                q.englishB ||
                ""
            ).trim(),

        C:
            String(
                q.CEn ||
                q.englishC ||
                ""
            ).trim(),

        D:
            String(
                q.DEn ||
                q.englishD ||
                ""
            ).trim(),

        solution:
            String(
                q.solutionEn ||
                q.englishSolution ||
                ""
            ).trim()
    };
}

function needsTranslation(q) {

    const hi =
        getHindiFields(q);

    const en =
        getEnglishFields(q);

    return Boolean(

        (hi.question &&
            !en.question) ||

        (hi.A &&
            !en.A) ||

        (hi.B &&
            !en.B) ||

        (hi.C &&
            !en.C) ||

        (hi.D &&
            !en.D) ||

        (hi.solution &&
            !en.solution)
    );
}

/* =========================================================
   MYMEMORY TRANSLATION
========================================================= */

async function translateSingleText(text) {

    const source =
        String(text || "").trim();

    if (!source) return "";

    const url =
        `${MYMEMORY_TRANSLATE_URL}?q=${
            encodeURIComponent(source)
        }&langpair=${
            encodeURIComponent(
                MYMEMORY_LANGPAIR
            )
        }`;

    const response =
        await fetch(
            url,
            {
                method: "GET",
                headers: {
                    "Accept":
                        "application/json"
                }
            }
        );

    if (!response.ok) {
        throw new Error(
            "HTTP Status " +
            response.status
        );
    }

    const data =
        await response.json();

    if (
        data?.responseStatus &&
        Number(data.responseStatus) !== 200
    ) {

        throw new Error(
            data.responseDetails ||
            "API Limit Exceeded"
        );
    }

    const res =
        String(
            data?.responseData
                ?.translatedText ||
            ""
        ).trim();

    if (
        !res ||
        res.toLowerCase()
            .includes("quota") ||
        res.toLowerCase()
            .includes("warning")
    ) {

        throw new Error(
            "Translation rate limited / invalid"
        );
    }

    return res;
}

// Translates every missing English field on one question document
// and returns the partial `updates` object. Throws on the first
// field that fails so the caller can retry the whole question.
async function translateQuestionFields(hi, en) {

    const updates = {};

    if (hi.question && !en.question) {
        updates.questionEn =
            await translateSingleText(hi.question);
    }

    if (hi.A && !en.A) {
        updates.AEn =
            await translateSingleText(hi.A);
    }

    if (hi.B && !en.B) {
        updates.BEn =
            await translateSingleText(hi.B);
    }

    if (hi.C && !en.C) {
        updates.CEn =
            await translateSingleText(hi.C);
    }

    if (hi.D && !en.D) {
        updates.DEn =
            await translateSingleText(hi.D);
    }

    if (hi.solution && !en.solution) {
        updates.solutionEn =
            await translateSingleText(hi.solution);
    }

    return updates;
}

/* =========================================================
   MANUAL CURRENT QUESTION TRANSLATION
========================================================= */

window.translateCurrentQuestion =
async function() {

    if (!firebaseUser) {
        return showStatus(
            "पहले Login करें।",
            "error"
        );
    }

    const hi =
        getHindiQuestionForm();

    if (
        !hi.question &&
        !hi.A &&
        !hi.B &&
        !hi.C &&
        !hi.D &&
        !hi.solution
    ) {

        return showStatus(
            "पहले Hindi Question भरें।",
            "error"
        );
    }

    try {

        showStatus(
            "🌐 Translation शुरू हो रही है...",
            "info"
        );

        const fields = [
            ["question", "questionEn"],
            ["A", "optionAEn"],
            ["B", "optionBEn"],
            ["C", "optionCEn"],
            ["D", "optionDEn"],
            ["solution", "solutionEn"]
        ];

        const values = {
            question:
                hi.question,

            A:
                hi.A,

            B:
                hi.B,

            C:
                hi.C,

            D:
                hi.D,

            solution:
                hi.solution
        };

        for (const [hiKey, enId] of fields) {

            const currentEnglish =
                getInput(enId);

            if (
                values[hiKey] &&
                !currentEnglish
            ) {

                const translated =
                    await translateSingleText(
                        values[hiKey]
                    );

                document.getElementById(
                    enId
                ).value =
                    translated;

                await new Promise(
                    r => setTimeout(r, 500)
                );
            }
        }

        showStatus(
            "✅ English translation fields भर दिए गए। अब Question Save करें।"
        );

    } catch (e) {

        showStatus(
            "Translation failed: " +
            e.message,
            "error"
        );
    }
};

/* =========================================================
   TRANSLATE EXISTING QUESTION
========================================================= */

window.translateQuestionById =
async function(id) {

    if (!firebaseUser) {
        return showStatus(
            "पहले Login करें।",
            "error"
        );
    }

    const q =
        questions.find(
            x => x.id === id
        );

    if (!q) {

        return showStatus(
            "Question नहीं मिला।",
            "error"
        );
    }

    if (!needsTranslation(q)) {

        return showStatus(
            "✅ इस Question का English translation पहले से complete है।"
        );
    }

    try {

        showStatus(
            "🌐 Question translation शुरू...",
            "info"
        );

        const hi =
            getHindiFields(q);

        const en =
            getEnglishFields(q);

        const updates =
            await translateQuestionFields(hi, en);

        if (
            Object.keys(updates).length
        ) {

            updates.optionsEn = [
                updates.AEn ||
                    en.A ||
                    "",

                updates.BEn ||
                    en.B ||
                    "",

                updates.CEn ||
                    en.C ||
                    "",

                updates.DEn ||
                    en.D ||
                    ""
            ];

            updates.translatedAt =
                serverTimestamp();

            updates.translatedBy =
                firebaseUser.uid;

            await updateDoc(
                doc(
                    db,
                    QUESTIONS,
                    id
                ),
                updates
            );
        }

        await loadCurrentTestQuestions();
        await window.refreshTranslationStats();

        showStatus(
            "✅ Question English में translate हो गया।"
        );

    } catch (e) {

        showStatus(
            "Translation failed: " +
            e.message,
            "error"
        );
    }
};

/* =========================================================
   TRANSLATION STATS
========================================================= */

// NOTE: this intentionally reads the whole mockQuestions collection,
// because the translator needs a global pending/done count across
// every question in the bank — there's no way around a full read
// for that particular number. Everything else in this file that
// used to do a full read has been scoped down (see loadCurrentTestQuestions,
// loadSeriesTests, editExistingTest, deleteTest below).
window.refreshTranslationStats =
async function() {

    if (!firebaseUser) return;

    try {

        const snap =
            await getDocs(
                collection(
                    db,
                    QUESTIONS
                )
            );

        translatorDocs =
            snap.docs.map(
                x => ({
                    id: x.id,
                    ...x.data()
                })
            );

        const total =
            translatorDocs.length;

        const done =
            translatorDocs.filter(
                q => !needsTranslation(q)
            ).length;

        const pending =
            Math.max(
                0,
                total - done
            );

        document.getElementById(
            "trTotal"
        ).textContent =
            total;

        document.getElementById(
            "trDone"
        ).textContent =
            done;

        document.getElementById(
            "trPending"
        ).textContent =
            pending;

        const perc =
            total
                ? Math.min(
                    100,
                    (done / total) * 100
                  )
                : 0;

        document.getElementById(
            "trProgressBar"
        ).style.width =
            perc + "%";

        document.getElementById(
            "trProgressText"
        ).textContent =
            `${done} / ${total}`;

        document.getElementById(
            "translatorStatus"
        ).textContent =
            "🔄 Stats Refreshed.";

    } catch (e) {

        document.getElementById(
            "translatorStatus"
        ).textContent =
            "❌ " +
            e.message;
    }
};

/* =========================================================
   START / RESUME TRANSLATION
========================================================= */

window.startTranslation =
async function() {

    if (!firebaseUser) {
        return showStatus(
            "पहले Login करें।",
            "error"
        );
    }

    if (translatorRunning) return;

    await window.refreshTranslationStats();

    // FIX: resume position is found by looking up the last
    // successfully translated document's ID in the freshly
    // loaded list, instead of trusting a raw array index that
    // could point at a totally different question after reload.
    let startIndex = 0;

    if (translatorLastId) {

        const lastIdx =
            translatorDocs.findIndex(
                q => q.id === translatorLastId
            );

        if (lastIdx !== -1) {
            startIndex = lastIdx + 1;
        }
    }

    const firstPending =
        translatorDocs.findIndex(
            (q, i) =>
                i >= startIndex &&
                needsTranslation(q)
        );

    if (firstPending !== -1) {

        translatorIndex =
            firstPending;

    } else {

        const anyPending =
            translatorDocs.findIndex(
                q => needsTranslation(q)
            );

        translatorIndex =
            anyPending;
    }

    if (
        translatorIndex === -1 ||
        translatorIndex >=
            translatorDocs.length
    ) {

        document.getElementById(
            "translatorStatus"
        ).textContent =
            "🎉 सभी Questions already translated हैं।";

        return;
    }

    translatorRunning = true;
    translatorStopRequested = false;

    document.getElementById(
        "translatorStatus"
    ).textContent =
        "🟢 Translating started...";

    while (
        translatorRunning &&
        !translatorStopRequested &&
        translatorIndex <
            translatorDocs.length
    ) {

        const current =
            translatorDocs[
                translatorIndex
            ];

        document.getElementById(
            "translatorCurrent"
        ).textContent =
            `Question ${
                translatorIndex + 1
            } / ${
                translatorDocs.length
            }`;

        if (!needsTranslation(current)) {

            translatorIndex++;

            translatorLastId = current.id;

            localStorage.setItem(
                "THE_HUB_TRANSLATOR_LAST_ID",
                translatorLastId
            );

            continue;
        }

        const hi =
            getHindiFields(current);

        const en =
            getEnglishFields(current);

        // FIX: a single transient failure (rate limit blip, flaky
        // network) used to stop the ENTIRE run and force the admin
        // to manually click Resume. Now each question gets a few
        // automatic retries with a short backoff before we give up
        // and pause, so short-lived hiccups don't interrupt a long
        // bulk-translation session.
        let attempt = 0;
        let success = false;
        let lastError = null;
        let updates = {};

        while (
            attempt < TRANSLATOR_MAX_ATTEMPTS &&
            !success
        ) {

            try {

                updates =
                    await translateQuestionFields(hi, en);

                success = true;

            } catch (err) {

                lastError = err;
                attempt++;

                if (attempt < TRANSLATOR_MAX_ATTEMPTS) {

                    document.getElementById(
                        "translatorStatus"
                    ).textContent =
                        `⚠️ Retry ${attempt}/${
                            TRANSLATOR_MAX_ATTEMPTS - 1
                        } after error: ${err.message}`;

                    await new Promise(
                        r => setTimeout(
                            r,
                            TRANSLATOR_RETRY_DELAY_MS * attempt
                        )
                    );
                }
            }
        }

        if (!success) {

            translatorRunning = false;

            document.getElementById(
                "translatorStatus"
            ).textContent =
                `❌ Stopped after ${TRANSLATOR_MAX_ATTEMPTS} tries: ${
                    lastError.message
                }. Hit Resume to retry.`;

            return;
        }

        try {

            if (
                Object.keys(updates).length
            ) {

                updates.optionsEn = [
                    updates.AEn ||
                        en.A ||
                        "",

                    updates.BEn ||
                        en.B ||
                        "",

                    updates.CEn ||
                        en.C ||
                        "",

                    updates.DEn ||
                        en.D ||
                        ""
                ];

                updates.translatedAt =
                    serverTimestamp();

                updates.translatedBy =
                    firebaseUser.uid;

                await updateDoc(
                    doc(
                        db,
                        QUESTIONS,
                        current.id
                    ),
                    updates
                );

                Object.assign(
                    current,
                    updates
                );
            }

            translatorIndex++;

            translatorLastId = current.id;

            localStorage.setItem(
                "THE_HUB_TRANSLATOR_LAST_ID",
                translatorLastId
            );

            document.getElementById(
                "translatorStatus"
            ).textContent =
                `✅ Question ${
                    translatorIndex
                } Translated.`;

            await window.refreshTranslationStats();

        } catch (err) {

            translatorRunning = false;

            document.getElementById(
                "translatorStatus"
            ).textContent =
                `❌ Stopped while saving: ${
                    err.message
                }. Hit Resume to retry.`;

            return;
        }

        await new Promise(
            r => setTimeout(r, 600)
        );
    }

    translatorRunning = false;

    if (
        translatorIndex >=
        translatorDocs.length
    ) {

        document.getElementById(
            "translatorStatus"
        ).textContent =
            "🎉 Translation complete!";
    }
};

/* =========================================================
   PAUSE / STOP
========================================================= */

window.pauseTranslation =
function() {

    translatorRunning = false;
    translatorStopRequested = true;

    document.getElementById(
        "translatorStatus"
    ).textContent =
        "⏸️ Translation paused.";
};

window.stopTranslation =
function() {

    translatorRunning = false;
    translatorStopRequested = true;

    document.getElementById(
        "translatorStatus"
    ).textContent =
        "⏹️ Translation stopped.";
};

/* =========================================================
   SAVE TEST
========================================================= */

window.saveTest = async function() {

    if (!firebaseUser) {
        return showStatus(
            "पहले Firebase Admin Login करें।",
            "error"
        );
    }

    const sessionId =
        ensureTestSession();

    const testData =
        validateTestBasicData();

    if (!testData) return;

    await loadCurrentTestQuestions();

    if (!questions.length) {

        return showStatus(
            "इस Test में अभी कोई question नहीं है।",
            "error"
        );
    }

    const series =
        seriesList.find(
            x => x.id === currentSeriesId
        );

    try {

        const questionIds =
            questions.map(
                q => q.id
            );

        const payload = {

            testSessionId:
                sessionId,

            seriesId:
                currentSeriesId ||
                null,

            seriesName:
                series
                    ? series.seriesName
                    : null,

            ...testData,

            isPaid:
                testData.access === "paid",

            isFree:
                testData.access === "free",

            questionIds,

            totalQuestions:
                questionIds.length,

            totalMarks:
                questionIds.length *
                testData.marksPerQuestion,

            allowReattempt: true,

            maxAttempts: null,

            attemptsAllowed:
                "unlimited",

            updatedAt:
                serverTimestamp(),

            updatedBy:
                firebaseUser.uid
        };

        if (editingTestId) {

            await updateDoc(
                doc(
                    db,
                    TESTS,
                    editingTestId
                ),
                payload
            );

            showStatus(
                "✅ Test successfully update हो गया।"
            );

        } else {

            const ref =
                await addDoc(
                    collection(
                        db,
                        TESTS
                    ),
                    {
                        ...payload,
                        createdAt:
                            serverTimestamp(),
                        createdBy:
                            firebaseUser.uid
                    }
                );

            editingTestId =
                ref.id;

            if (series) {

                await updateDoc(
                    doc(
                        db,
                        SERIES,
                        currentSeriesId
                    ),
                    {
                        totalTests:
                            Number(
                                series.totalTests ||
                                0
                            ) + 1,

                        updatedAt:
                            serverTimestamp()
                    }
                );
            }

            showStatus(
                `✅ Test save हो गया। ${
                    questionIds.length
                } questions जुड़े हैं।`
            );
        }

        await loadSeries();
        await loadTests();

    } catch (e) {

        showStatus(
            "Test save error: " +
            e.message,
            "error"
        );
    }
};

/* =========================================================
   LOAD ALL TESTS
========================================================= */

// This one is intentionally a full read — it powers the
// "All Firestore Tests" dashboard list, which by definition
// needs every test. loadSeriesTests below (a filtered subset)
// no longer piggybacks on this full fetch.
async function loadTests() {

    const snap =
        await getDocs(
            collection(
                db,
                TESTS
            )
        );

    const list = [];

    snap.forEach(x => {

        list.push({
            id: x.id,
            ...x.data()
        });
    });

    list.reverse();

    const box =
        document.getElementById(
            "testList"
        );

    if (!list.length) {

        box.innerHTML =
            `<div class="empty">
                Firestore में अभी कोई Test नहीं है।
            </div>`;

        return;
    }

    box.innerHTML =
        list.map(t => `

        <div class="test-item">

            <div class="test-title">
                ${escapeHTML(
                    t.testName ||
                    "Unnamed Test"
                )}
            </div>

            <div class="test-meta">

                <span class="badge badge-blue">
                    ${escapeHTML(
                        t.testType || "-"
                    )}
                </span>

                ${
                    t.seriesId
                    ?
                    `<span class="badge badge-purple">
                        📚 SERIES
                    </span>`
                    :
                    `<span class="badge badge-cyan">
                        STANDALONE
                    </span>`
                }

                ${
                    t.access === "paid"
                    ?
                    `<span class="badge badge-orange">
                        💳 PAID ₹${Number(
                            t.price || 0
                        ).toFixed(2)}
                    </span>`
                    :
                    `<span class="badge badge-green">
                        🆓 FREE
                    </span>`
                }

                <br><br>

                📚 Series:
                ${escapeHTML(
                    t.seriesName ||
                    "Standalone"
                )}<br>

                📘 Course:
                ${escapeHTML(
                    t.course || "-"
                )}<br>

                🏛️ Exam:
                ${escapeHTML(
                    t.examName || "-"
                )}<br>

                ❓ Questions:
                ${Number(
                    t.totalQuestions || 0
                )}<br>

                🎯 Total Marks:
                ${Number(
                    t.totalMarks || 0
                )}<br>

                ⏱️ Time:
                ${Number(
                    t.testTime || 0
                )} Min

            </div>

            <div class="small-buttons">

                <button
                    class="small-btn blue"
                    onclick="editExistingTest('${t.id}')">
                    ✏️ Open / Edit
                </button>

                <button
                    class="small-btn red"
                    onclick="deleteTest('${t.id}')">
                    🗑️ Delete
                </button>

            </div>

        </div>

    `).join("");

    await loadSeriesTests();
}

/* =========================================================
   SERIES TESTS
========================================================= */

// FIX: previously fetched EVERY test in the whole collection just
// to find the ones belonging to the current series. Now scoped
// with a `where("seriesId","==",...)` query.
async function loadSeriesTests() {

    const box =
        document.getElementById(
            "seriesTestList"
        );

    if (!currentSeriesId) {

        box.innerHTML =
            `<div class="empty">
                कोई Series select नहीं है।
            </div>`;

        return;
    }

    const snap =
        await getDocs(
            query(
                collection(db, TESTS),
                where("seriesId", "==", currentSeriesId)
            )
        );

    const list = [];

    snap.forEach(x => {

        list.push({
            id: x.id,
            ...x.data()
        });
    });

    list.sort(
        (a, b) =>
            Number(a.testNumber || 0) -
            Number(b.testNumber || 0)
    );

    if (!list.length) {

        box.innerHTML =
            `<div class="empty">
                इस Series में अभी कोई Test नहीं है।
            </div>`;

        return;
    }

    box.innerHTML =
        list.map(t => `

        <div class="test-item">

            <div class="test-title">
                📝 Test ${
                    Number(
                        t.testNumber || 1
                    )
                } -
                ${escapeHTML(
                    t.testName ||
                    "Unnamed Test"
                )}
            </div>

            <div class="test-meta">

                🎯 Total Marks:
                ${Number(
                    t.totalMarks || 0
                )}

                |

                ❓ Questions:
                ${Number(
                    t.totalQuestions || 0
                )}

                |

                ⏱️ Time:
                ${Number(
                    t.testTime || 0
                )} Min

            </div>

            <div class="small-buttons">

                <button
                    class="small-btn blue"
                    onclick="editExistingTest('${t.id}')">
                    ✏️ Open / Edit
                </button>

                <button
                    class="small-btn red"
                    onclick="deleteTest('${t.id}')">
                    🗑️ Delete
                </button>

            </div>

        </div>

    `).join("");
}

/* =========================================================
   EDIT EXISTING TEST
========================================================= */

// FIX: previously fetched the ENTIRE mockTests collection to find
// one document by ID. A single getDoc() call does exactly the
// same job with one document read instead of N.
window.editExistingTest =
async function(id) {

    try {

        const snap =
            await getDoc(
                doc(db, TESTS, id)
            );

        if (!snap.exists()) {

            return showStatus(
                "Test नहीं मिला।",
                "error"
            );
        }

        const found = {
            id: snap.id,
            ...snap.data()
        };

        editingTestId = id;

        currentTestSessionId =
            found.testSessionId;

        currentSeriesId =
            found.seriesId || "";

        localStorage.setItem(
            "THE_HUB_CURRENT_TEST_SESSION",
            currentTestSessionId
        );

        document.getElementById(
            "seriesSelect"
        ).value =
            currentSeriesId;

        window.selectSeries();

        document.getElementById(
            "testType"
        ).value =
            found.testType ||
            "Chapter";

        document.getElementById(
            "access"
        ).value =
            found.access ||
            "free";

        document.getElementById(
            "price"
        ).value =
            found.price || "";

        document.getElementById(
            "course"
        ).value =
            found.course || "";

        document.getElementById(
            "examName"
        ).value =
            found.examName || "";

        document.getElementById(
            "category"
        ).value =
            found.category || "";

        document.getElementById(
            "subject"
        ).value =
            found.subject || "";

        document.getElementById(
            "chapter"
        ).value =
            found.chapter || "";

        document.getElementById(
            "section"
        ).value =
            found.section || "";

        document.getElementById(
            "testNumber"
        ).value =
            found.testNumber || 1;

        document.getElementById(
            "testName"
        ).value =
            found.testName || "";

        document.getElementById(
            "testTime"
        ).value =
            found.testTime || 30;

        document.getElementById(
            "marksPerQuestion"
        ).value =
            found.marksPerQuestion || 1;

        document.getElementById(
            "negativeMarks"
        ).value =
            found.negativeMarks || 0;

        document.getElementById(
            "testValidityType"
        ).value =
            found.validityType ||
            "unlimited";

        document.getElementById(
            "testValidityDays"
        ).value =
            found.validityDays || "";

        document.getElementById(
            "testStartDate"
        ).value =
            found.startDate || "";

        document.getElementById(
            "testExpiryDate"
        ).value =
            found.expiryDate || "";

        window.togglePriceField();
        window.toggleTestValidity();

        await loadCurrentTestQuestions();

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

        showStatus(
            "✏️ Existing Test session load हो गया।"
        );

    } catch (e) {

        showStatus(
            "Test open failed: " +
            e.message,
            "error"
        );
    }
};

/* =========================================================
   DELETE TEST
========================================================= */

// FIX: previously fetched the ENTIRE mockTests collection just to
// read one test's seriesId before deleting it. Now uses getDoc()
// for that single lookup.
window.deleteTest =
async function(id) {

    if (!confirm(
        "क्या यह Test delete करना है?"
    )) return;

    try {

        const snap =
            await getDoc(
                doc(db, TESTS, id)
            );

        const target =
            snap.exists()
                ? snap.data()
                : null;

        await deleteDoc(
            doc(
                db,
                TESTS,
                id
            )
        );

        if (target?.seriesId) {

            const s =
                seriesList.find(
                    x =>
                        x.id ===
                        target.seriesId
                );

            if (s) {

                await updateDoc(
                    doc(
                        db,
                        SERIES,
                        target.seriesId
                    ),
                    {
                        totalTests:
                            Math.max(
                                0,
                                Number(
                                    s.totalTests ||
                                    0
                                ) - 1
                            ),

                        updatedAt:
                            serverTimestamp()
                    }
                );
            }
        }

        await loadSeries();
        await loadTests();

        showStatus(
            "✅ Test delete हो गया।"
        );

    } catch (e) {

        showStatus(
            "Test delete failed: " +
            e.message,
            "error"
        );
    }
};

/* =========================================================
   NEW TEST
========================================================= */

window.newTest = function() {

    if (
        questions.length &&
        !confirm(
            "Current session reset होगा। Continue?"
        )
    ) return;

    editingTestId = null;
    editingQuestionId = null;

    currentTestSessionId =
        createTestSessionId();

    localStorage.setItem(
        "THE_HUB_CURRENT_TEST_SESSION",
        currentTestSessionId
    );

    questions = [];

    renderQuestions();

    [
        "course",
        "examName",
        "category",
        "subject",
        "chapter",
        "section",
        "testName",
        "price",
        "testValidityDays",
        "testStartDate",
        "testExpiryDate"
    ].forEach(id => {

        document.getElementById(
            id
        ).value = "";
    });

    document.getElementById(
        "testType"
    ).value = "Chapter";

    document.getElementById(
        "access"
    ).value = "free";

    document.getElementById(
        "testNumber"
    ).value = "1";

    document.getElementById(
        "testTime"
    ).value = "30";

    document.getElementById(
        "marksPerQuestion"
    ).value = "1";

    document.getElementById(
        "negativeMarks"
    ).value = "0";

    document.getElementById(
        "testValidityType"
    ).value = "unlimited";

    window.clearQuestionForm();
    window.clearBulk();

    window.togglePriceField();
    window.toggleTestValidity();

    updateSessionDisplay();

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });

    showStatus(
        "➕ नया Session तैयार है।"
    );
};

/* =========================================================
   DELETE ALL QUESTIONS
========================================================= */

window.deleteAllQuestions =
async function() {

    if (!confirm(
        "⚠️ mockQuestions के सभी questions permanently delete होंगे?"
    )) return;

    if (!confirm(
        "FINAL CONFIRMATION: Are you absolutely sure?"
    )) return;

    try {

        const snap =
            await getDocs(
                collection(
                    db,
                    QUESTIONS
                )
            );

        let batch =
            writeBatch(db);

        let count = 0;

        for (
            const item of snap.docs
        ) {

            batch.delete(
                item.ref
            );

            count++;

            if (count % 400 === 0) {

                await batch.commit();

                batch =
                    writeBatch(db);
            }
        }

        if (count % 400 !== 0) {
            await batch.commit();
        }

        questions = [];

        renderQuestions();

        // FIX: deleting every question invalidates the saved
        // translator resume position, so clear it instead of
        // leaving a stale ID pointing at a doc that no longer exists.
        translatorLastId = null;

        localStorage.removeItem(
            "THE_HUB_TRANSLATOR_LAST_ID"
        );

        await window.refreshTranslationStats();

        showStatus(
            `✅ ${count} questions permanently delete हो गए।`
        );

    } catch (e) {

        showStatus(
            "Delete error: " +
            e.message,
            "error"
        );
    }
};

/* =========================================================
   BACK
========================================================= */

window.goBack = function() {

    window.location.href =
        "admin-dashboard.html";
};
