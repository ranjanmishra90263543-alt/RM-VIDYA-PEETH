import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
    getAuth,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    getFirestore,
    collection,
    getDocs,
    getDoc,
    doc,
    addDoc,
    setDoc,
    deleteDoc,
    query,
    where,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


/* =====================================================
   FIREBASE
===================================================== */

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


/* =====================================================
   COLLECTIONS
===================================================== */

const TESTS = "mockTests";
const SERIES = "mockSeries";
const QUESTIONS = "mockQuestions";
const RESULTS = "testResults";
const SERIES_ENROLLMENTS = "testSeriesEnrollments";


/* =====================================================
   GLOBAL STATE
===================================================== */

let firebaseUser = null;

let allTests = [];
let allSeries = [];

let enrolledSeriesIds = new Set();
let enrolledSeriesNames = new Set();
let enrolledTestIds = new Set();

let currentMockType = "free";
let currentCategory = "";
let currentSeries = "";
let currentSeriesObject = null;

let currentTest = null;
let currentQuestions = [];

let answers = {};
let markedQuestions = {};
let currentQuestion = 0;
let questionTimes = {};
let questionStartedAt = 0;

let remainingSeconds = 0;

let timerInterval = null;
let questionTimerInterval = null;

let submitted = false;
let testPaused = false;

/*
   Back-button "Pause & Exit" guard state.
   pauseModalOpen  -> the Pause & Exit confirmation is currently on screen
   testExited      -> user already confirmed Pause & Exit (or test finished),
                      so the back-guard should stop intercepting navigation
*/
let pauseModalOpen = false;
let testExited = false;

let selectedAttempt = null;
let currentAttemptDocs = [];

let selectedTestLanguage =
    localStorage.getItem("mock_test_language") || "hi";

let pendingTestAction = null;


/* =====================================================
   BASIC HELPERS
===================================================== */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getStudentName() {
    return localStorage.getItem("ssc_student_name") ||
           localStorage.getItem("studentName") ||
           "Student";
}

function getStudentUsername() {
    return localStorage.getItem("ssc_student_username") ||
           localStorage.getItem("studentUsername") ||
           firebaseUser?.email ||
           firebaseUser?.uid ||
           "student";
}

function getStudentKey() {
    return localStorage.getItem("ssc_student_key") ||
           localStorage.getItem("studentKey") ||
           localStorage.getItem("ssc_student_username") ||
           localStorage.getItem("studentUsername") ||
           firebaseUser?.email ||
           firebaseUser?.uid ||
           "";
}

function showStatus(message, type = "success") {
    const box = document.getElementById("status");
    if (!box) return;

    box.className = "status show " + type;
    box.textContent = message;

    setTimeout(() => {
        box.className = "status";
    }, 4000);
}


/* =====================================================
   TEST / SERIES ACCESS
===================================================== */

function getMockType(test) {
    return isFreeTest(test) ? "free" : "paid";
}

function getSeriesAccess(series) {
    if (!series) return "free";

    const value =
        series.access ??
        series.seriesAccess ??
        series.accessType ??
        series.paymentType ??
        series.mockType ??
        series.type ??
        "";

    const text = String(value).trim().toLowerCase();

    if (
        [
            "paid",
            "premium",
            "purchase",
            "buy",
            "paid-test-pass"
        ].includes(text)
    ) {
        return "paid";
    }

    if (
        [
            "free",
            "public",
            "test-pass",
            "free-test-pass"
        ].includes(text)
    ) {
        return "free";
    }

    const seriesName = String(
        series.name ??
        series.seriesName ??
        series.title ??
        ""
    ).trim().toLowerCase();

    if (!seriesName) return "free";

    const seriesId = String(
        series.id ??
        series.firestoreId ??
        ""
    );

    const relatedTests = allTests.filter(test => {
        const testSeriesId = getTestSeriesId(test);

        return (
            getSeries(test).trim().toLowerCase() === seriesName ||
            (
                testSeriesId &&
                testSeriesId === seriesId
            )
        );
    });

    return relatedTests.some(test => !isFreeTest(test))
        ? "paid"
        : "free";
}

function normalizeCategory(test) {
    const values = [
        test.testType,
        test.type,
        test.category,
        test.testCategory,
        test.mockType,
        test.examType,
        test.testCategoryName
    ];

    const text = values
        .filter(v => v !== undefined && v !== null)
        .map(v => String(v).toLowerCase())
        .join(" ");

    if (text.includes("chapter")) return "chapter";
    if (text.includes("section")) return "sectional";
    if (text.includes("pyq") || text.includes("previous")) return "pyq";
    if (text.includes("practice")) return "practice";

    return "full";
}

function getSeries(test) {
    const value =
        test.series ??
        test.seriesName ??
        test.testSeries ??
        test.testSeriesName ??
        test.mockSeries ??
        test.mockSeriesName ??
        test.seriesTitle ??
        test.batch ??
        test.batchName ??
        "General Series";

    return String(value).trim() || "General Series";
}

function getTestSeriesId(test) {
    return String(
        test.seriesId ??
        test.mockSeriesId ??
        test.testSeriesId ??
        test.seriesID ??
        ""
    ).trim();
}

function getSeriesName(series) {
    if (!series) return "";

    return String(
        series.name ??
        series.seriesName ??
        series.title ??
        series.mockSeriesName ??
        series.seriesTitle ??
        ""
    ).trim();
}

function isFreeTest(test) {
    if (test.isFree === true) return true;
    if (test.isPaid === true) return false;

    const access = String(
        test.access ??
        test.accessType ??
        test.paymentType ??
        test.mockType ??
        ""
    ).trim().toLowerCase();

    if (
        [
            "paid",
            "premium",
            "purchase",
            "buy",
            "paid-test-pass"
        ].includes(access)
    ) {
        return false;
    }

    return true;
}

function getTestAccessLabel(test) {
    return isFreeTest(test)
        ? {
            text: "🆓 Free",
            className: "free"
        }
        : {
            text: "💎 Paid",
            className: "paid"
        };
}

function getQuestionCount(test) {
    return Number(
        test.totalQuestions ??
        test.questionCount ??
        (
            Array.isArray(test.questionIds)
                ? test.questionIds.length
                : 0
        )
    );
}

function getTestTime(test) {
    return Number(
        test.testTime ??
        test.duration ??
        test.durationMinutes ??
        30
    );
}


/* =====================================================
   SERIES MATCHING
===================================================== */

function isSeriesEnrolled(series) {
    if (!series) return false;

    const id = String(series.id ?? "").trim();
    const firestoreId = String(series.firestoreId ?? "").trim();
    const name = getSeriesName(series).toLowerCase();

    return (
        (id && enrolledSeriesIds.has(id)) ||
        (firestoreId && enrolledSeriesIds.has(firestoreId)) ||
        (name && enrolledSeriesNames.has(name))
    );
}

function findSeriesForTest(test) {
    if (!test) return null;

    const testSeriesId = getTestSeriesId(test);
    const testSeriesName = getSeries(test)
        .trim()
        .toLowerCase();

    if (testSeriesId) {
        const byId = allSeries.find(series =>
            String(series.id ?? "") === testSeriesId ||
            String(series.firestoreId ?? "") === testSeriesId
        );

        if (byId) return byId;
    }

    if (testSeriesName) {
        const byName = allSeries.find(series =>
            getSeriesName(series).toLowerCase() === testSeriesName
        );

        if (byName) return byName;
    }

    return null;
}

function isTestEnrolled(test) {
    if (!test) return false;

    const testId = String(test.id ?? "").trim();

    if (
        testId &&
        enrolledTestIds.has(testId)
    ) {
        return true;
    }

    const series = findSeriesForTest(test);

    if (
        series &&
        isSeriesEnrolled(series)
    ) {
        return true;
    }

    const seriesId = getTestSeriesId(test);

    if (
        seriesId &&
        enrolledSeriesIds.has(seriesId)
    ) {
        return true;
    }

    const seriesName = getSeries(test)
        .trim()
        .toLowerCase();

    return Boolean(
        seriesName &&
        enrolledSeriesNames.has(seriesName)
    );
}


/* =====================================================
   ENROLLMENT VALIDATION
===================================================== */

function isValidEnrollment(data) {
    if (!data) return false;

    const status = String(
        data.status ?? ""
    ).trim().toLowerCase();

    return (
        status === "enrolled" ||
        status === "active" ||
        data.isTestPass === true
    );
}

function processEnrollmentData(data) {
    if (!isValidEnrollment(data)) return;

    const seriesId =
        data.seriesId ??
        data.testSeriesId ??
        data.mockSeriesId ??
        data.seriesID ??
        data.itemId ??
        "";

    if (seriesId) {
        enrolledSeriesIds.add(
            String(seriesId).trim()
        );
    }

    if (data.firestoreSeriesId) {
        enrolledSeriesIds.add(
            String(data.firestoreSeriesId).trim()
        );
    }

    const seriesName =
        data.seriesName ??
        data.testSeriesName ??
        data.mockSeriesName ??
        data.seriesTitle ??
        data.name ??
        data.series ??
        "";

    if (seriesName) {
        enrolledSeriesNames.add(
            String(seriesName)
                .trim()
                .toLowerCase()
        );
    }

    const testId =
        data.testId ??
        data.mockTestId ??
        "";

    if (testId) {
        enrolledTestIds.add(
            String(testId).trim()
        );
    }
}


/* =====================================================
   ENROLLMENT LOADER
===================================================== */

async function loadEnrollments() {
    enrolledSeriesIds = new Set();
    enrolledSeriesNames = new Set();
    enrolledTestIds = new Set();

    if (!firebaseUser) return;

    const enrollmentDocs = new Map();

    const studentKey = String(
        getStudentKey() || ""
    ).trim();

    try {

        if (studentKey) {
            try {
                const snap = await getDocs(
                    query(
                        collection(
                            db,
                            SERIES_ENROLLMENTS
                        ),
                        where(
                            "studentKey",
                            "==",
                            studentKey
                        )
                    )
                );

                snap.forEach(item => {
                    enrollmentDocs.set(
                        item.id,
                        item.data()
                    );
                });

            } catch (error) {
                console.warn(
                    "studentKey query failed:",
                    error
                );
            }
        }

        try {
            const uidSnap = await getDocs(
                query(
                    collection(
                        db,
                        SERIES_ENROLLMENTS
                    ),
                    where(
                        "studentUid",
                        "==",
                        firebaseUser.uid
                    )
                )
            );

            uidSnap.forEach(item => {
                enrollmentDocs.set(
                    item.id,
                    item.data()
                );
            });

        } catch (error) {
            console.warn(
                "studentUid fallback failed:",
                error
            );
        }

        enrollmentDocs.forEach(data => {

            if (!data) return;

            if (
                data.studentUid &&
                String(data.studentUid) !==
                String(firebaseUser.uid)
            ) {
                return;
            }

            if (
                studentKey &&
                data.studentKey &&
                String(data.studentKey) !==
                studentKey
            ) {
                return;
            }

            if (!isValidEnrollment(data)) {
                return;
            }

            processEnrollmentData(data);
        });

    } catch (error) {

        console.error(
            "ENROLLMENT LOAD ERROR:",
            error
        );

        showStatus(
            "Test Pass enrollment load nahi hua: " +
            error.message,
            "error"
        );
    }
}


/* =====================================================
   DATA FETCHING
===================================================== */

async function loadTests() {

    try {

        showStatus(
            "Test Pass aur Mock Tests load ho rahe hain...",
            "info"
        );

        allSeries = [];

        const seriesSnap = await getDocs(
            collection(db, SERIES)
        );

        seriesSnap.forEach(item => {

            const data = item.data();

            if (data.active === false) return;

            const seriesId =
                data.seriesId ??
                data.id ??
                data.seriesID ??
                item.id;

            const seriesName =
                data.seriesName ??
                data.name ??
                data.title ??
                data.mockSeriesName ??
                data.seriesTitle ??
                data.mockSeriesTitle ??
                "";

            if (!seriesName) return;

            allSeries.push({
                id: String(seriesId),
                firestoreId: item.id,
                name: String(seriesName).trim(),
                ...data
            });
        });

        await loadEnrollments();

        const snap = await getDocs(
            collection(db, TESTS)
        );

        allTests = [];

        snap.forEach(item => {

            const data = item.data();

            if (data.active === false) return;

            allTests.push({
                id: item.id,
                ...data
            });
        });

        allTests.sort((a, b) =>
            Number(
                a.testNumber ??
                a.serialNumber ??
                a.serial ??
                999999
            ) -
            Number(
                b.testNumber ??
                b.serialNumber ??
                b.serial ??
                999999
            )
        );

        updateCounts();

        showStatus(
            "Test Pass aur Mock Tests successfully load ho gaye.",
            "success"
        );

    } catch (error) {

        console.error(
            "LOAD TESTS ERROR:",
            error
        );

        showStatus(
            "Tests load nahi hue: " +
            error.message,
            "error"
        );
    }
}

function updateCounts() {

    const freeSeriesList =
        allSeries.filter(
            series =>
                getSeriesAccess(series) === "free"
        );

    const paidSeriesList =
        allSeries.filter(
            series =>
                getSeriesAccess(series) === "paid"
        );

    const freeTests =
        allTests.filter(
            test =>
                getMockType(test) === "free"
        );

    const paidTests =
        allTests.filter(
            test =>
                getMockType(test) === "paid"
        );

    const freeCount =
        document.getElementById(
            "freeTestCount"
        );

    const paidCount =
        document.getElementById(
            "paidTestCount"
        );

    const oldSeriesCount =
        document.getElementById(
            "allSeriesCount"
        );

    if (freeCount) {
        freeCount.textContent =
            `${freeTests.length} Tests • ${freeSeriesList.length} Series`;
    }

    if (paidCount) {
        paidCount.textContent =
            `${paidTests.length} Tests • ${paidSeriesList.length} Series`;
    }

    if (oldSeriesCount) {
        oldSeriesCount.textContent =
            `${allSeries.length} Series uplabdh`;
    }
}


/* =====================================================
   NAVIGATION
===================================================== */

function isTestBelongToSeries(
    test,
    seriesObject,
    seriesName
) {

    if (!test) return false;

    const testSeriesId =
        getTestSeriesId(test);

    if (testSeriesId && seriesObject) {

        if (
            testSeriesId ===
            String(seriesObject.id ?? "") ||
            testSeriesId ===
            String(seriesObject.firestoreId ?? "")
        ) {
            return true;
        }
    }

    return (
        getSeries(test)
            .trim()
            .toLowerCase() ===
        String(seriesName)
            .trim()
            .toLowerCase()
    );
}

function hideAllSections() {

    [
        "freeHome",
        "seriesBox",
        "seriesCategoryBox",
        "testListBox",
        "testInterface",
        "resultBox"
    ].forEach(id => {

        document
            .getElementById(id)
            ?.classList.add("hidden");
    });

    document
        .getElementById("normalHeader")
        ?.classList.remove("hidden");
}


/* =====================================================
   FREE / PAID SERIES
===================================================== */

window.openMockType = function(type) {

    currentMockType =
        type === "paid"
            ? "paid"
            : "free";

    currentCategory = "";
    currentSeries = "";
    currentSeriesObject = null;

    hideAllSections();

    document
        .getElementById("seriesBox")
        ?.classList.remove("hidden");

    const title =
        currentMockType === "free"
            ? "🆓 Free Test Series"
            : "💎 Paid Test Series";

    const titleEl =
        document.getElementById(
            "seriesTitle"
        );

    if (titleEl) {
        titleEl.textContent = title;
    }

    const breadcrumb =
        document.getElementById(
            "seriesBreadcrumb"
        );

    if (breadcrumb) {

        breadcrumb.innerHTML = `
            <button onclick="backToCategories()">
                🏠 Mock Test
            </button>

            <span>›</span>

            <span>${escapeHTML(title)}</span>
        `;
    }

    renderTypeSeries();
};

function renderTypeSeries() {

    const grid =
        document.getElementById(
            "seriesGrid"
        );

    if (!grid) return;

    const seriesList =
        allSeries.filter(
            series =>
                getSeriesAccess(series) ===
                currentMockType
        );

    if (!seriesList.length) {

        grid.innerHTML = `
            <div class="empty-box">
                Abhi koi
                ${
                    currentMockType === "free"
                        ? "Free"
                        : "Paid"
                }
                Test Series uplabdh nahi hai.
            </div>
        `;

        return;
    }

    grid.innerHTML =
        seriesList.map(series => {

            const seriesName =
                getSeriesName(series) ||
                "Test Series";

            const seriesId =
                String(
                    series.id ??
                    series.firestoreId ??
                    ""
                );

            const relatedTests =
                allTests.filter(test => {

                    const testSeriesId =
                        getTestSeriesId(test);

                    const sameId =
                        testSeriesId &&
                        (
                            testSeriesId ===
                            String(series.id ?? "") ||
                            testSeriesId ===
                            String(series.firestoreId ?? "")
                        );

                    const sameName =
                        getSeries(test)
                            .trim()
                            .toLowerCase() ===
                        seriesName
                            .trim()
                            .toLowerCase();

                    return sameId || sameName;
                });

            const totalTests =
                Number(
                    series.totalTests ??
                    series.testCount ??
                    series.testsCount ??
                    relatedTests.length
                );

            const price =
                series.price ??
                series.seriesPrice ??
                series.amount ??
                0;

            const enrolled =
                isSeriesEnrolled(series);

            return `
                <div class="series-card"
                    ${
                        enrolled
                            ? `onclick='openSeries(${JSON.stringify(seriesName)})'`
                            : ""
                    }>

                    <div class="series-icon">
                        ${
                            currentMockType === "free"
                                ? "🆓"
                                : "💎"
                        }
                    </div>

                    <div class="series-name">
                        ${escapeHTML(seriesName)}
                    </div>

                    ${
                        series.courseName
                        ? `
                            <div class="series-info">
                                📘 ${escapeHTML(series.courseName)}
                            </div>
                        `
                        : ""
                    }

                    ${
                        series.exam
                        ? `
                            <div class="series-info">
                                🎯 ${escapeHTML(series.exam)}
                            </div>
                        `
                        : ""
                    }

                    ${
                        series.subject
                        ? `
                            <div class="series-info">
                                📚 ${escapeHTML(series.subject)}
                            </div>
                        `
                        : ""
                    }

                    ${
                        series.chapter
                        ? `
                            <div class="series-info">
                                📖 ${escapeHTML(series.chapter)}
                            </div>
                        `
                        : ""
                    }

                    <div class="series-info">
                        📝 ${totalTests} Tests
                    </div>

                    ${
                        series.marks !== undefined
                        ? `
                            <div class="series-info">
                                🏆 ${escapeHTML(series.marks)} Marks
                            </div>
                        `
                        : ""
                    }

                    ${
                        series.time !== undefined
                        ? `
                            <div class="series-info">
                                ⏱ ${escapeHTML(series.time)}
                            </div>
                        `
                        : ""
                    }

                    ${
                        currentMockType === "paid"
                        ? `
                            <div class="series-info">
                                💰 ₹${escapeHTML(price)}
                            </div>
                        `
                        : `
                            <div class="series-info">
                                🆓 Free Test Pass
                            </div>
                        `
                    }

                    <div class="series-status">

                        ${
                            enrolled
                            ? `
                                <button
                                    class="start-btn"
                                    type="button"
                                    onclick='event.stopPropagation();openSeries(${JSON.stringify(seriesName)})'>
                                    🔓 Open Test Series
                                </button>
                            `
                            : currentMockType === "free"
                            ? `
                                <button
                                    class="start-btn"
                                    type="button"
                                    onclick='event.stopPropagation();enrollSeriesFromCard(${JSON.stringify(seriesId)})'>
                                    🔒 Enroll Karein
                                </button>
                            `
                            : `
                                <span class="not-enrolled-badge">
                                    💎 Buy Test Pass
                                </span>
                            `
                        }

                    </div>
                </div>
            `;

        }).join("");
}

window.enrollSeriesFromCard =
    async function(seriesId) {

        const success =
            await window.enrollFreeMockSeries(
                seriesId
            );

        if (success) {
            renderTypeSeries();
        }
    };

window.openAllSeries = function() {

    openMockType(
        currentMockType || "free"
    );
};


/* =====================================================
   CATEGORY
===================================================== */

window.openCategory = function(category) {

    currentCategory = category;
    currentSeries = "";
    currentSeriesObject = null;

    hideAllSections();

    document
        .getElementById("seriesBox")
        ?.classList.remove("hidden");

    const tests =
        allTests.filter(test =>
            getMockType(test) === currentMockType &&
            isTestEnrolled(test) &&
            normalizeCategory(test) === category
        );

    const seriesMap = new Map();

    tests.forEach(test => {

        const series = getSeries(test);

        if (!seriesMap.has(series)) {
            seriesMap.set(series, []);
        }

        seriesMap.get(series).push(test);
    });

    const names = {
        chapter: "📘 Chapter Test",
        sectional: "📑 Sectional Test",
        full: "📚 Full Test",
        pyq: "📜 Full PYQ",
        practice: "✍️ Practice Test"
    };

    const title =
        names[category] ||
        "📚 Test Series";

    const titleEl =
        document.getElementById(
            "seriesTitle"
        );

    if (titleEl) {
        titleEl.textContent = title;
    }

    const breadcrumb =
        document.getElementById(
            "seriesBreadcrumb"
        );

    if (breadcrumb) {

        breadcrumb.innerHTML = `
            <button onclick="backToCategories()">
                🏠 Mock Test
            </button>

            <span>›</span>

            <span>${escapeHTML(title)}</span>
        `;
    }

    const grid =
        document.getElementById(
            "seriesGrid"
        );

    if (!grid) return;

    if (!seriesMap.size) {

        grid.innerHTML = `
            <div class="empty-box">
                Is category me koi enrolled
                ${
                    currentMockType === "free"
                        ? "Free"
                        : "Paid"
                }
                Test Series nahi hai.
            </div>
        `;

        return;
    }

    grid.innerHTML =
        [...seriesMap.entries()]
        .map(
            ([series, items]) => `
                <div class="series-card"
                    onclick='openSeries(${JSON.stringify(series)})'>

                    <div class="series-icon">
                        ${
                            currentMockType === "free"
                                ? "🆓"
                                : "💎"
                        }
                    </div>

                    <div class="series-name">
                        ${escapeHTML(series)}
                    </div>

                    <div class="series-info">
                        ${items.length} Test uplabdh
                    </div>

                </div>
            `
        )
        .join("");
};


/* =====================================================
   OPEN SERIES
===================================================== */

window.openSeries = function(series) {

    currentSeries = String(series);

    currentSeriesObject =
        allSeries.find(item =>
            getSeriesName(item)
                .trim()
                .toLowerCase() ===
            currentSeries
                .trim()
                .toLowerCase()
        ) || null;

    document
        .getElementById("seriesBox")
        ?.classList.add("hidden");

    document
        .getElementById("seriesCategoryBox")
        ?.classList.remove("hidden");

    if (!isSeriesEnrolled(currentSeriesObject)) {

        const title =
            document.getElementById(
                "seriesCategoryTitle"
            );

        if (title) {
            title.textContent =
                "🔒 " + currentSeries;
        }

        const grid =
            document.getElementById(
                "seriesCategoryGrid"
            );

        if (grid) {

            grid.innerHTML = `
                <div class="empty-box">

                    <h3>🔒 Test Series Locked</h3>

                    <p>
                        Is Series ke sabhi Tests
                        kholne ke liye pehle
                        Test Pass me Enroll karein.
                    </p>

                    ${
                        currentMockType === "free" &&
                        currentSeriesObject
                        ? `
                            <button
                                class="start-btn"
                                onclick='enrollFreeMockSeries(${JSON.stringify(currentSeriesObject.id)})'>
                                🔓 Enroll Karein
                            </button>
                        `
                        : ""
                    }

                </div>
            `;
        }

        return;
    }

    const tests =
        allTests.filter(test =>
            getMockType(test) === currentMockType &&
            isTestBelongToSeries(
                test,
                currentSeriesObject,
                currentSeries
            ) &&
            isTestEnrolled(test)
        );

    const categoryMap = new Map();

    tests.forEach(test => {

        const category =
            normalizeCategory(test);

        if (!categoryMap.has(category)) {
            categoryMap.set(category, []);
        }

        categoryMap.get(category).push(test);
    });

    const categoryBreadcrumb =
        document.getElementById(
            "categoryBreadcrumb"
        );

    if (categoryBreadcrumb) {

        categoryBreadcrumb.innerHTML = `
            <button onclick="backToCategories()">
                🏠 Mock Test
            </button>

            <span>›</span>

            <button onclick="openMockType('${currentMockType}')">
                ${
                    currentMockType === "free"
                        ? "🆓 Free Mock Test"
                        : "💎 Paid Mock Test"
                }
            </button>

            <span>›</span>

            <span>
                ${escapeHTML(currentSeries)}
            </span>
        `;
    }

    const title =
        document.getElementById(
            "seriesCategoryTitle"
        );

    if (title) {
        title.textContent =
            "📂 " + currentSeries;
    }

    const grid =
        document.getElementById(
            "seriesCategoryGrid"
        );

    if (!grid) return;

    const categoryNames = {
        chapter: "📘 Chapter Test",
        sectional: "📑 Sectional Test",
        full: "📚 Full Test",
        pyq: "📜 Full PYQ",
        practice: "✍️ Practice Test"
    };

    if (!categoryMap.size) {

        grid.innerHTML = `
            <div class="empty-box">
                Is Series me abhi koi Mock Test uplabdh nahi hai.
            </div>
        `;

        return;
    }

    const order = [
        "chapter",
        "sectional",
        "full",
        "pyq",
        "practice"
    ];

    const entries =
        [...categoryMap.entries()]
        .sort((a, b) => {

            const ai =
                order.indexOf(a[0]);

            const bi =
                order.indexOf(b[0]);

            return (
                (ai === -1 ? 999 : ai) -
                (bi === -1 ? 999 : bi)
            );
        });

    grid.innerHTML =
        entries
        .map(
            ([category, items]) => `
                <div
                    class="category-card"
                    onclick="openSeriesCategory('${category}')">

                    <div class="category-icon">
                        ${
                            categoryNames[category]
                                ? categoryNames[category].split(" ")[0]
                                : "📂"
                        }
                    </div>

                    <div class="category-name">
                        ${escapeHTML(
                            categoryNames[category] ||
                            category
                        )}
                    </div>

                    <div class="category-count">
                        ${items.length} Test uplabdh
                    </div>

                </div>
            `
        )
        .join("");
};


/* =====================================================
   OPEN SERIES CATEGORY
===================================================== */

window.openSeriesCategory =
    function(category) {

        currentCategory = category;

        document
            .getElementById(
                "seriesCategoryBox"
            )
            ?.classList.add("hidden");

        document
            .getElementById("testListBox")
            ?.classList.remove("hidden");

        if (
            !isSeriesEnrolled(
                currentSeriesObject
            )
        ) {

            const list =
                document.getElementById(
                    "testList"
                );

            if (list) {

                list.innerHTML = `
                    <div class="empty-box">
                        🔒 Pehle is Test Series me Enroll karein.
                    </div>
                `;
            }

            return;
        }

        const tests =
            allTests.filter(test =>
                getMockType(test) === currentMockType &&
                isTestEnrolled(test) &&
                normalizeCategory(test) === currentCategory &&
                isTestBelongToSeries(
                    test,
                    currentSeriesObject,
                    currentSeries
                )
            );

        const categoryNames = {
            chapter: "📘 Chapter Test",
            sectional: "📑 Sectional Test",
            full: "📚 Full Test",
            pyq: "📜 Full PYQ",
            practice: "✍️ Practice Test"
        };

        const categoryTitle =
            categoryNames[currentCategory] ||
            currentCategory;

        const breadcrumb =
            document.getElementById(
                "testBreadcrumb"
            );

        if (breadcrumb) {

            breadcrumb.innerHTML = `
                <button onclick="backToCategories()">
                    🏠 Mock Test
                </button>

                <span>›</span>

                <button onclick="openMockType('${currentMockType}')">
                    ${
                        currentMockType === "free"
                            ? "🆓 Free Mock Test"
                            : "💎 Paid Mock Test"
                    }
                </button>

                <span>›</span>

                <button onclick='openSeries(${JSON.stringify(currentSeries)})'>
                    ${escapeHTML(currentSeries)}
                </button>

                <span>›</span>

                <span>
                    ${escapeHTML(categoryTitle)}
                </span>
            `;
        }

        const listTitle =
            document.getElementById(
                "listTitle"
            );

        if (listTitle) {
            listTitle.textContent =
                `📝 ${currentSeries} - ${categoryTitle}`;
        }

        renderTests(tests);
    };


/* =====================================================
   TEST LIST
===================================================== */

async function renderTests(tests) {

    const list =
        document.getElementById(
            "testList"
        );

    if (!list) return;

    if (!tests.length) {

        list.innerHTML = `
            <div class="empty-box">
                Is category me koi Test uplabdh nahi hai.
            </div>
        `;

        return;
    }

    list.innerHTML = `
        <div class="loading-box">
            Tests taiyar ho rahe hain...
        </div>
    `;

    const attempts =
        await loadAttemptsForTests(
            tests.map(t => t.id)
        );

    const grouped = {};

    attempts.forEach(a => {

        const id =
            String(a.testId);

        if (!grouped[id]) {
            grouped[id] = [];
        }

        grouped[id].push(a);
    });

    list.innerHTML =
        tests.map(test => {

            const testAttempts =
                grouped[String(test.id)] || [];

            testAttempts.sort(sortAttempts);

            const latest =
                testAttempts[0];

            let buttonText =
                "▶ Start Test";

            let buttonClass =
                "start-btn";

            if (
                latest?.status ===
                "paused"
            ) {

                buttonText = "▶ Resume";

                buttonClass +=
                    " resume-btn";

            } else if (
                latest?.status ===
                "submitted"
            ) {

                buttonText =
                    "🔄 Reattempt";

                buttonClass +=
                    " reattempt-btn";
            }

            const name =
                test.testName ??
                test.name ??
                "Untitled Test";

            const qCount =
                getQuestionCount(test);

            const time =
                getTestTime(test);

            const access =
                getTestAccessLabel(test);

            return `
                <div class="test-item">

                    <div class="test-name">
                        ${escapeHTML(name)}

                        <span
                            class="test-access-badge ${access.className}">
                            ${access.text}
                        </span>
                    </div>

                    <div class="test-meta">

                        <span class="meta-badge">
                            Q ${qCount}
                        </span>

                        <span class="meta-badge">
                            ⏱ ${time} Min
                        </span>

                        <span class="meta-badge">
                            ${escapeHTML(
                                getSeries(test)
                            )}
                        </span>

                    </div>

                    <div class="test-actions">

                        <button
                            class="${buttonClass}"
                            onclick="handleTestButton('${test.id}')">
                            ${buttonText}
                        </button>

                        ${
                            testAttempts.length
                            ? `
                                <button
                                    class="history-btn"
                                    onclick="openAttemptHistory('${test.id}')">
                                    Attempts
                                    ${testAttempts.length}
                                </button>
                            `
                            : ""
                        }

                    </div>

                </div>
            `;

        }).join("");
}


/* =====================================================
   ATTEMPTS
===================================================== */

async function loadAttemptsForTests(testIds) {

    if (
        !firebaseUser ||
        !testIds.length
    ) {
        return [];
    }

    try {

        const snap = await getDocs(
            query(
                collection(
                    db,
                    RESULTS
                ),
                where(
                    "studentUid",
                    "==",
                    firebaseUser.uid
                )
            )
        );

        const allowed =
            new Set(
                testIds.map(
                    id => String(id)
                )
            );

        const arr = [];

        snap.forEach(item => {

            const data =
                item.data();

            if (
                allowed.has(
                    String(data.testId)
                )
            ) {

                arr.push({
                    id: item.id,
                    ...data
                });
            }
        });

        return arr;

    } catch (error) {

        console.error(
            "ATTEMPTS LOAD ERROR:",
            error
        );

        return [];
    }
}

function sortAttempts(a, b) {

    const aa =
        a.createdAt?.seconds ??
        a.submittedAt?.seconds ??
        0;

    const bb =
        b.createdAt?.seconds ??
        b.submittedAt?.seconds ??
        0;

    return bb - aa;
}

async function loadAttempts(testId) {

    if (!firebaseUser) return [];

    try {

        const snap = await getDocs(
            query(
                collection(
                    db,
                    RESULTS
                ),
                where(
                    "studentUid",
                    "==",
                    firebaseUser.uid
                ),
                where(
                    "testId",
                    "==",
                    String(testId)
                )
            )
        );

        const arr = [];

        snap.forEach(item => {

            arr.push({
                id: item.id,
                ...item.data()
            });
        });

        arr.sort(sortAttempts);

        return arr;

    } catch (error) {

        console.error(
            "ATTEMPT LOAD ERROR:",
            error
        );

        return [];
    }
}


/* =====================================================
   INSTRUCTIONS
===================================================== */

function createLanguageInstructionPage() {

    let page =
        document.getElementById(
            "languageInstructionPage"
        );

    if (page) return page;

    page =
        document.createElement("div");

    page.id =
        "languageInstructionPage";

    page.className =
        "hidden language-instruction-page";

    page.innerHTML = `
        <div
            id="languageInstructionInner"
            class="language-instruction-inner">
        </div>
    `;

    document.body.appendChild(page);

    return page;
}

function getInstructionTexts() {

    if (selectedTestLanguage === "en") {

        return {

            title:
                "Test Instructions & Rules",

            language:
                "Select Language",

            hindi:
                "Hindi",

            english:
                "English",

            rulesTitle:
                "Rules & Regulations",

            rules: [
                "Read all questions carefully before answering.",
                "The test timer will start after you click Start Test.",
                "Once the test starts, the timer will continue according to the test duration.",
                "You can move between questions using Previous, Save & Next and the Question Menu.",
                "You can mark questions for review and return to them later.",
                "Unattempted questions will be counted as skipped.",
                "Negative marking will be applied according to the test settings.",
                "Do not refresh or close the page unnecessarily during the test.",
                "Your answers and test result will be saved after submission.",
                "After submitting the test, you can view your result, analysis and answer review."
            ],

            agreement:
                "I have read and understood all the instructions.",

            start:
                "🚀 Start Test",

            resume:
                "▶ Resume Test",

            back:
                "← Back",

            questions:
                "Questions",

            marks:
                "Marks",

            time:
                "Time",

            subject:
                "Subject",

            series:
                "Series",

            negative:
                "Negative Marking"
        };
    }

    return {

        title:
            "परीक्षा निर्देश एवं नियम",

        language:
            "भाषा चुनें",

        hindi:
            "हिन्दी",

        english:
            "English",

        rulesTitle:
            "📋 नियम एवं शर्तें",

        rules: [
            "उत्तर देने से पहले प्रत्येक प्रश्न को ध्यानपूर्वक पढ़ें।",
            "Start Test बटन दबाने के बाद Test का Timer शुरू हो जाएगा।",
            "Test शुरू होने के बाद निर्धारित समय के अनुसार Timer चलता रहेगा।",
            "Previous, Save & Next और Question Menu से आप Questions के बीच जा सकते हैं।",
            "किसी प्रश्न को Mark For Review करके बाद में दोबारा देख सकते हैं।",
            "बिना उत्तर दिए गए प्रश्न Skipped माने जाएंगे।",
            "Negative Marking Test की निर्धारित settings के अनुसार लागू होगी।",
            "Test के दौरान अनावश्यक रूप से page refresh या close न करें।",
            "Test submit करने के बाद आपके answers और result save किए जाएंगे।",
            "Submit करने के बाद Result, Analysis और Answer Review देख सकते हैं।"
        ],

        agreement:
            "मैंने सभी निर्देश एवं नियम पढ़ और समझ लिए हैं।",

        start:
            "🚀 Test शुरू करें",

        resume:
            "▶ Test Resume करें",

        back:
            "← वापस जाएँ",

        questions:
            "प्रश्न",

        marks:
            "अंक",

        time:
            "समय",

        subject:
            "विषय",

        series:
            "Series",

        negative:
            "Negative Marking"
    };
}

function showLanguageInstructionPage(
    test,
    action
) {

    currentTest = test;
    pendingTestAction = action;

    const page =
        createLanguageInstructionPage();

    const texts =
        getInstructionTexts();

    const totalQuestions =
        getQuestionCount(test);

    const time =
        getTestTime(test);

    const marks =
        test.totalMarks ??
        test.marks ??
        (
            totalQuestions *
            Number(
                test.marksPerQuestion ?? 1
            )
        );

    const negative =
        test.negativeMarks ?? 0;

    page.innerHTML = `

        <div class="language-instruction-inner">

            <div class="instruction-header">

                <div>

                    <div class="instruction-title">
                        ${escapeHTML(texts.title)}
                    </div>

                    <div class="instruction-test-name">
                        ${escapeHTML(
                            test.testName ??
                            test.name ??
                            "Mock Test"
                        )}
                    </div>

                </div>

                <button
                    type="button"
                    class="instruction-back-btn"
                    onclick="closeLanguageInstructionPage()">

                    ${escapeHTML(texts.back)}

                </button>

            </div>


            <div class="instruction-language-box">

                <div class="instruction-section-title">
                    🌐 ${escapeHTML(texts.language)}
                </div>

                <div class="language-buttons">

                    <button
                        id="languageHindiBtn"
                        type="button"
                        class="language-btn ${
                            selectedTestLanguage === "hi"
                                ? "active"
                                : ""
                        }"
                        onclick="selectTestLanguage('hi')">

                        🇮🇳 ${escapeHTML(texts.hindi)}

                    </button>

                    <button
                        id="languageEnglishBtn"
                        type="button"
                        class="language-btn ${
                            selectedTestLanguage === "en"
                                ? "active"
                                : ""
                        }"
                        onclick="selectTestLanguage('en')">

                        🇬🇧 ${escapeHTML(texts.english)}

                    </button>

                </div>

            </div>


            <div class="instruction-stats">

                <div class="instruction-stat">
                    📝 <b>${escapeHTML(texts.questions)}</b><br>
                    ${totalQuestions}
                </div>

                <div class="instruction-stat">
                    🏆 <b>${escapeHTML(texts.marks)}</b><br>
                    ${escapeHTML(marks)}
                </div>

                <div class="instruction-stat">
                    ⏱ <b>${escapeHTML(texts.time)}</b><br>
                    ${time} Min
                </div>

                <div class="instruction-stat">
                    ➖ <b>${escapeHTML(texts.negative)}</b><br>
                    ${escapeHTML(negative)}
                </div>

            </div>


            <div class="instruction-rules">

                <h3>
                    ${escapeHTML(texts.rulesTitle)}
                </h3>

                <ol>

                    ${
                        texts.rules
                        .map(
                            rule =>
                                `<li>${escapeHTML(rule)}</li>`
                        )
                        .join("")
                    }

                </ol>

            </div>


            <label class="instruction-agreement">

                <input
                    id="instructionAgreement"
                    type="checkbox">

                <span>
                    ${escapeHTML(texts.agreement)}
                </span>

            </label>


            <button
                id="instructionStartBtn"
                type="button"
                class="instruction-start-btn"
                onclick="confirmLanguageInstruction()"
                disabled>

                ${
                    action === "resume"
                        ? texts.resume
                        : texts.start
                }

            </button>


            <div class="instruction-footer">

                ${
                    selectedTestLanguage === "en"
                        ? "Select your language before starting the test."
                        : "Test शुरू करने से पहले अपनी भाषा चुनें।"
                }

            </div>

        </div>
    `;

    page.classList.remove("hidden");
    page.style.display = "block";

    const checkbox =
        document.getElementById(
            "instructionAgreement"
        );

    if (checkbox) {

        checkbox.addEventListener(
            "change",
            updateInstructionStartButton
        );
    }

    updateInstructionStartButton();

    window.scrollTo(0, 0);
}

window.selectTestLanguage =
    function(language) {

        selectedTestLanguage =
            language === "en"
                ? "en"
                : "hi";

        localStorage.setItem(
            "mock_test_language",
            selectedTestLanguage
        );

        if (
            currentTest &&
            pendingTestAction
        ) {

            showLanguageInstructionPage(
                currentTest,
                pendingTestAction
            );
        }
    };

function updateInstructionStartButton() {

    const checkbox =
        document.getElementById(
            "instructionAgreement"
        );

    const button =
        document.getElementById(
            "instructionStartBtn"
        );

    if (!checkbox || !button) return;

    button.disabled =
        !checkbox.checked;
}

window.closeLanguageInstructionPage =
    function() {

        const page =
            document.getElementById(
                "languageInstructionPage"
            );

        if (page) {

            page.classList.add("hidden");
            page.style.display = "none";
        }

        pendingTestAction = null;
    };

window.confirmLanguageInstruction =
    async function() {

        const checkbox =
            document.getElementById(
                "instructionAgreement"
            );

        if (
            !checkbox ||
            !checkbox.checked
        ) {
            return;
        }

        const action =
            pendingTestAction;

        pendingTestAction = null;

        closeLanguageInstructionPage();

        if (action === "resume") {

            await resumeExistingAttempt(
                window._pendingResumeAttempt
            );

            window._pendingResumeAttempt = null;

            return;
        }

        await startNewAttempt();
    };


/* =====================================================
   QUESTION TEXT
   (Firestore schema: question = Hindi, questionEn = English)
===================================================== */

function getQuestionText(q) {

    if (!q) return "-";

    if (selectedTestLanguage === "en") {

        if (
            q.questionEn !== undefined &&
            q.questionEn !== null &&
            String(q.questionEn).trim() !== ""
        ) {
            return q.questionEn;
        }
    }

    return q.question || "-";
}


/* =====================================================
   SOLUTION
   (Firestore schema: solution = Hindi, solutionEn = English)
===================================================== */

function getSolutionText(q) {

    if (!q) return "";

    if (selectedTestLanguage === "en") {

        if (
            q.solutionEn !== undefined &&
            q.solutionEn !== null &&
            String(q.solutionEn).trim() !== ""
        ) {
            return q.solutionEn;
        }
    }

    return q.solution || "";
}


/* =====================================================
   OPTIONS
   Firestore schema: options is a plain array
   options[0] = A
   options[1] = B
   options[2] = C
   options[3] = D
===================================================== */

function getLocalizedOption(q, index) {

    if (!q || !Array.isArray(q.options)) {
        return "";
    }

    const value = q.options[index];

    if (
        value === undefined ||
        value === null
    ) {
        return "";
    }

    return String(value);
}

function getOptions(q) {

    return [
        getLocalizedOption(q, 0),
        getLocalizedOption(q, 1),
        getLocalizedOption(q, 2),
        getLocalizedOption(q, 3)
    ];
}


/* =====================================================
   CORRECT ANSWER
   Firestore schema: correctAnswer is a 1-based
   index into the options array
   (1=A, 2=B, 3=C, 4=D)
===================================================== */

function getCorrectIndex(q) {

    if (!q) return -1;

    if (
        q.correctAnswer !== undefined &&
        q.correctAnswer !== null &&
        q.correctAnswer !== ""
    ) {

        const numberValue =
            Number(q.correctAnswer);

        /*
           correctAnswer is stored 1-based in Firestore:
           1 = A, 2 = B, 3 = C, 4 = D
           Convert to internal 0-based index.
        */

        if (
            Number.isInteger(numberValue) &&
            numberValue >= 1 &&
            numberValue <= 4
        ) {
            return numberValue - 1;
        }
    }

    return -1;
}


/* =====================================================
   SELECTED ANSWER
   CURRENT FORMAT:
   1=A
   2=B
   3=C
   4=D

   INTERNAL RESULT:
   0=A
   1=B
   2=C
   3=D
===================================================== */

function normalizeSelectedIndex(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return -1;
    }


    const text =
        String(value)
            .trim()
            .toUpperCase();


    /* ---------------------------------------------
       LETTER FORMAT
    --------------------------------------------- */

    if (text === "A") return 0;
    if (text === "B") return 1;
    if (text === "C") return 2;
    if (text === "D") return 3;


    /* ---------------------------------------------
       CURRENT 1-BASED FORMAT
       1=A
       2=B
       3=C
       4=D
    --------------------------------------------- */

    if (text === "1") return 0;
    if (text === "2") return 1;
    if (text === "3") return 2;
    if (text === "4") return 3;


    return -1;
}


/* =====================================================
   OLD ATTEMPT COMPATIBILITY
===================================================== */

/*
   New saved attempt:
   selectedAnswer = 1..4
   selectedOption = A/B/C/D

   Old saved attempt:
   selectedAnswer = 0..3

   If selectedOption exists, it gets priority.
   Otherwise old numeric value is interpreted
   as old 0-based value.
*/

function normalizeAttemptSelectedAnswer(answer) {

    if (!answer) {
        return -1;
    }


    /* ---------------------------------------------
       BEST SOURCE:
       selectedOption A/B/C/D
    --------------------------------------------- */

    if (
        answer.selectedOption !== undefined &&
        answer.selectedOption !== null
    ) {

        const option =
            String(
                answer.selectedOption
            )
            .trim()
            .toUpperCase();

        if (option === "A") return 0;
        if (option === "B") return 1;
        if (option === "C") return 2;
        if (option === "D") return 3;
    }


    /* ---------------------------------------------
       NEW 1-BASED FORMAT
    --------------------------------------------- */

    if (
        answer.optionNumber !== undefined &&
        answer.optionNumber !== null
    ) {

        const n =
            Number(
                answer.optionNumber
            );

        if (
            Number.isInteger(n) &&
            n >= 1 &&
            n <= 4
        ) {
            return n - 1;
        }
    }


    /*
       If format explicitly says 1-based
    */

    if (
        answer.indexing === "1-based" ||
        answer.answerIndexing === "1-based"
    ) {

        const n =
            Number(
                answer.selectedAnswer
            );

        if (
            Number.isInteger(n) &&
            n >= 1 &&
            n <= 4
        ) {
            return n - 1;
        }
    }


    /*
       Old result:
       selectedAnswer 0,1,2,3
    */

    const raw =
        answer.selectedAnswer;

    const n =
        Number(raw);

    if (
        Number.isInteger(n) &&
        n >= 0 &&
        n <= 3
    ) {
        return n;
    }

    return -1;
}


/* =====================================================
   TEST START
===================================================== */

window.handleTestButton =
    async function(id) {

        const test =
            allTests.find(
                t =>
                    String(t.id) ===
                    String(id)
            );

        if (!test) return;

        if (!isTestEnrolled(test)) {

            showStatus(
                "❌ Pehle is Test Pass me Enroll karein.",
                "error"
            );

            return;
        }

        currentTest = test;

        const attempts =
            await loadAttempts(id);

        const latest =
            attempts[0];

        if (
            latest?.status ===
            "paused"
        ) {

            window._pendingResumeAttempt =
                latest;

            showLanguageInstructionPage(
                test,
                "resume"
            );

            return;
        }

        showLanguageInstructionPage(
            test,
            "start"
        );
    };


/* =====================================================
   QUESTION LOADING
===================================================== */

async function loadQuestions() {

    currentQuestions = [];

    const ids =
        Array.isArray(
            currentTest?.questionIds
        )
            ? currentTest.questionIds
            : [];

    if (ids.length) {

        const promises =
            ids.map(async id => {

                try {

                    const snap =
                        await getDoc(
                            doc(
                                db,
                                QUESTIONS,
                                String(id)
                            )
                        );

                    return snap.exists()
                        ? {
                            id: snap.id,
                            ...snap.data()
                        }
                        : null;

                } catch (error) {

                    console.error(
                        "Question error:",
                        id,
                        error
                    );

                    return null;
                }
            });

        const result =
            await Promise.all(promises);

        currentQuestions =
            result.filter(Boolean);
    }


    if (!currentQuestions.length) {

        try {

            const snap =
                await getDocs(
                    query(
                        collection(
                            db,
                            QUESTIONS
                        ),
                        where(
                            "testId",
                            "==",
                            String(
                                currentTest.id
                            )
                        )
                    )
                );

            snap.forEach(item => {

                currentQuestions.push({
                    id: item.id,
                    ...item.data()
                });

            });

        } catch (error) {

            console.error(
                "Question query error:",
                error
            );
        }
    }


    currentQuestions.sort(
        (a, b) =>
            Number(
                a.serialNumber ??
                a.questionNumber ??
                a.serial ??
                999999
            ) -
            Number(
                b.serialNumber ??
                b.questionNumber ??
                b.serial ??
                999999
            )
    );
}


/* =====================================================
   NEW ATTEMPT
===================================================== */

async function startNewAttempt() {

    currentQuestions = [];

    answers = {};
    markedQuestions = {};
    questionTimes = {};

    currentQuestion = 0;

    submitted = false;
    testPaused = false;
    testExited = false;
    pauseModalOpen = false;

    questionStartedAt = 0;

    showLoadingTest();

    await loadQuestions();

    if (!currentQuestions.length) {

        hideTestInterface();

        showStatus(
            "Is Test ke questions nahi mile.",
            "error"
        );

        return;
    }

    showTestInterface();

    remainingSeconds =
        getTestTime(currentTest) * 60;

    startMainTimer();
    startQuestionTimer();
}

function showLoadingTest() {

    hideAllSections();

    document
        .getElementById("normalHeader")
        ?.classList.add("hidden");

    document
        .getElementById("testInterface")
        ?.classList.remove("hidden");

    const area =
        document.getElementById(
            "questionArea"
        );

    if (area) {

        area.innerHTML = `
            <div class="loading-box">
                ⏳ Test load ho raha hai...
            </div>
        `;
    }
}

function showTestInterface() {

    hideAllSections();

    document
        .getElementById("normalHeader")
        ?.classList.add("hidden");

    document
        .getElementById("testInterface")
        ?.classList.remove("hidden");

    const heading =
        document.getElementById(
            "testHeadingTitle"
        );

    if (heading) {

        heading.textContent =
            currentTest.testName ??
            currentTest.name ??
            "Mock Test";
    }

    updateQuestionLangToggleBtn();

    /*
       Back-button guard: push a history entry so
       the browser/mobile back button triggers our
       "Pause & Exit" confirmation instead of leaving
       the test straight away.
    */
    armBackGuard();

    renderCurrentQuestion();
}

function hideTestInterface() {

    document
        .getElementById("testInterface")
        ?.classList.add("hidden");

    document
        .getElementById("normalHeader")
        ?.classList.remove("hidden");
}


/* =====================================================
   PER-QUESTION LANGUAGE TOGGLE
   (button next to the timer inside the test —
   translates only the question currently on screen,
   without affecting the timer or answers already given)
===================================================== */

window.toggleQuestionLanguage =
    function() {

        selectedTestLanguage =
            selectedTestLanguage === "hi"
                ? "en"
                : "hi";

        localStorage.setItem(
            "mock_test_language",
            selectedTestLanguage
        );

        updateQuestionLangToggleBtn();

        /*
           Only re-render the current question —
           timer, answers and progress stay untouched.
        */
        renderCurrentQuestion();
    };

function updateQuestionLangToggleBtn() {

    const btn =
        document.getElementById(
            "questionLangToggleBtn"
        );

    if (!btn) return;

    btn.textContent =
        selectedTestLanguage === "hi"
            ? "🌐 EN"
            : "🌐 हिं";

    btn.title =
        selectedTestLanguage === "hi"
            ? "Question ko English me dekhein"
            : "प्रश्न को हिंदी में देखें";
}


/* =====================================================
   BACK BUTTON "PAUSE & EXIT" GUARD
===================================================== */

function isTestActive() {

    const testInterfaceEl =
        document.getElementById(
            "testInterface"
        );

    return Boolean(
        currentTest &&
        !submitted &&
        !testExited &&
        testInterfaceEl &&
        !testInterfaceEl.classList.contains(
            "hidden"
        )
    );
}

function armBackGuard() {

    try {

        history.pushState(
            {
                mockTestGuard: true,
                ts: Date.now()
            },
            "",
            location.href
        );

    } catch (error) {

        console.warn(
            "Back guard push failed:",
            error
        );
    }
}

window.addEventListener(
    "popstate",
    function() {

        if (
            isTestActive() &&
            !pauseModalOpen
        ) {

            /*
               Re-arm the guard immediately so the
               real back navigation does not go
               through while our confirmation is
               still showing.
            */
            armBackGuard();

            openPauseExitModal();
        }
    }
);


/* =====================================================
   AUTO SUBMIT ON TAB SWITCH / MINIMIZE / CLOSE
===================================================== */

document.addEventListener(
    "visibilitychange",
    function() {

        if (
            document.visibilityState ===
                "hidden" &&
            isTestActive() &&
            !testPaused
        ) {

            /*
               Student left the test (tab switch,
               app minimize, tab/browser close)
               without using Pause & Exit, so we
               submit whatever has been attempted
               so far.
            */

            saveCurrentQuestionTime();

            submitTest();
        }
    }
);


/* =====================================================
   RESUME ATTEMPT
===================================================== */

async function resumeExistingAttempt(
    attempt
) {

    if (!attempt) return;

    currentQuestions = [];

    answers = {};
    markedQuestions = {};
    questionTimes = {};

    currentQuestion = 0;

    submitted = false;
    testPaused = false;
    testExited = false;
    pauseModalOpen = false;

    showLoadingTest();

    await loadQuestions();

    if (!currentQuestions.length) {

        hideTestInterface();

        showStatus(
            "Is Test ke questions nahi mile.",
            "error"
        );

        return;
    }


    /* ---------------------------------------------
       RESUME ANSWERS
    --------------------------------------------- */

    if (Array.isArray(attempt.answers)) {

        attempt.answers.forEach(a => {

            if (
                a.questionNumber !== undefined
            ) {

                const questionIndex =
                    Number(
                        a.questionNumber
                    ) - 1;

                const selected =
                    normalizeAttemptSelectedAnswer(
                        a
                    );

                if (
                    questionIndex >= 0 &&
                    questionIndex <
                    currentQuestions.length &&
                    selected >= 0 &&
                    selected <= 3
                ) {

                    /*
                       IMPORTANT:
                       Internal runtime also stores
                       1-based answer now.
                    */

                    answers[
                        questionIndex
                    ] =
                        selected + 1;
                }
            }
        });
    }


    /* ---------------------------------------------
       QUESTION TIMES
    --------------------------------------------- */

    if (
        Array.isArray(
            attempt.questionTimes
        )
    ) {

        attempt.questionTimes
            .forEach(t => {

                const index =
                    Number(
                        t.questionNo
                    ) - 1;

                if (index >= 0) {

                    questionTimes[index] =
                        Number(
                            t.timeSpentSeconds
                        ) || 0;
                }
            });
    }


    /* ---------------------------------------------
       RESUME EXACT QUESTION
       (so the student lands back on the exact
       question they paused on)
    --------------------------------------------- */

    const savedIndex =
        Number(
            attempt.currentQuestionIndex
        );

    if (
        Number.isInteger(savedIndex) &&
        savedIndex >= 0 &&
        savedIndex < currentQuestions.length
    ) {

        currentQuestion = savedIndex;
    }


    remainingSeconds =
        Number(
            attempt.remainingSeconds ??
            (
                getTestTime(
                    currentTest
                ) * 60
            )
        );

    showTestInterface();

    startMainTimer();
    startQuestionTimer();
}


/* =====================================================
   QUESTION INTERFACE
===================================================== */

function renderCurrentQuestion() {

    const q =
        currentQuestions[
            currentQuestion
        ];

    if (!q) return;

    const options =
        getOptions(q);

    /*
       answers[currentQuestion]
       is now 1-based:
       1=A
       2=B
       3=C
       4=D
    */

    const selected =
        Number(
            answers[currentQuestion]
        ) || 0;

    const questionArea =
        document.getElementById(
            "questionArea"
        );

    if (!questionArea) return;

    questionArea.innerHTML = `

        <div class="question-top">

            <div class="question-number-box">

                <div class="question-number">
                    Question
                    ${currentQuestion + 1}
                </div>

                <div class="question-time">
                    ⏱️
                    <span id="currentQuestionTime">
                        ${formatSeconds(
                            getQuestionTime(
                                currentQuestion
                            )
                        )}
                    </span>
                </div>

            </div>

        </div>


        <div class="question-text">
            ${escapeHTML(
                getQuestionText(q)
            )}
        </div>


        <div class="options">

            ${
                options.map(
                    (option, index) => {

                        /*
                           UI option number is 1-based.
                           index 0 => value 1 => A
                           index 1 => value 2 => B
                           index 2 => value 3 => C
                           index 3 => value 4 => D
                        */

                        const optionNumber =
                            index + 1;

                        const isSelected =
                            selected ===
                            optionNumber;

                        return `

                            <label
                                class="option ${
                                    isSelected
                                        ? "selected"
                                        : ""
                                }">

                                <input
                                    type="radio"
                                    name="currentQuestion"
                                    value="${optionNumber}"
                                    ${
                                        isSelected
                                            ? "checked"
                                            : ""
                                    }
                                    onchange="selectAnswer(${optionNumber})">

                                <div class="option-text">

                                    <b>
                                        ${
                                            ["A","B","C","D"][index]
                                        }.
                                    </b>

                                    ${escapeHTML(option)}

                                </div>

                            </label>
                        `;
                    }
                ).join("")
            }

        </div>
    `;


    const prevBtn =
        document.getElementById(
            "previousBtn"
        );

    if (prevBtn) {

        prevBtn.disabled =
            currentQuestion === 0;
    }


    const reviewBtn =
        document.getElementById(
            "reviewBtn"
        );

    if (reviewBtn) {

        reviewBtn.textContent =
            markedQuestions[
                currentQuestion
            ]
                ? "Unmark Review"
                : "Mark For Review";
    }


    const nextBtn =
        document.getElementById(
            "nextBtn"
        );

    if (nextBtn) {

        nextBtn.textContent =
            currentQuestion ===
            currentQuestions.length - 1
                ? "Save & Submit"
                : "Save & Next";
    }


    const counter =
        document.getElementById(
            "questionCounter"
        );

    if (counter) {

        counter.textContent =
            `${currentQuestion + 1}/${currentQuestions.length}`;
    }

    updateAnsweredCount();
    renderQuestionMenu();
}


/* =====================================================
   SELECT ANSWER
   INPUT IS 1-BASED
===================================================== */

window.selectAnswer =
    function(optionNumber) {

        const value =
            Number(optionNumber);

        if (
            !Number.isInteger(value) ||
            value < 1 ||
            value > 4
        ) {
            return;
        }

        /*
           Store 1-based:
           A=1
           B=2
           C=3
           D=4
        */

        answers[currentQuestion] =
            value;

        renderCurrentQuestion();
    };


/* =====================================================
   TIMERS
===================================================== */

function startQuestionTimer() {

    questionStartedAt =
        Date.now();

    if (!questionTimerInterval) {

        questionTimerInterval =
            setInterval(() => {

                const el =
                    document.getElementById(
                        "currentQuestionTime"
                    );

                if (
                    el &&
                    !testPaused &&
                    !submitted
                ) {

                    el.textContent =
                        formatSeconds(
                            getQuestionTime(
                                currentQuestion
                            )
                        );
                }

            }, 1000);
    }
}

function saveCurrentQuestionTime() {

    if (!questionStartedAt) return;

    const elapsed =
        Math.floor(
            (
                Date.now() -
                questionStartedAt
            ) / 1000
        );

    if (elapsed > 0) {

        questionTimes[
            currentQuestion
        ] =
            (
                Number(
                    questionTimes[
                        currentQuestion
                    ]
                ) || 0
            ) + elapsed;
    }

    questionStartedAt =
        Date.now();
}

function getQuestionTime(index) {

    let total =
        Number(
            questionTimes[index]
        ) || 0;

    if (
        index === currentQuestion &&
        questionStartedAt &&
        !testPaused &&
        !submitted
    ) {

        total += Math.floor(
            (
                Date.now() -
                questionStartedAt
            ) / 1000
        );
    }

    return total;
}

function formatSeconds(seconds) {

    seconds =
        Number(seconds) || 0;

    const min =
        Math.floor(
            seconds / 60
        );

    const sec =
        seconds % 60;

    return (
        String(min).padStart(2, "0") +
        ":" +
        String(sec).padStart(2, "0")
    );
}

function startMainTimer() {

    stopTimer();

    testPaused = false;

    if (!remainingSeconds) {

        remainingSeconds =
            getTestTime(
                currentTest
            ) * 60;
    }

    updateTimer();

    timerInterval =
        setInterval(() => {

            if (testPaused) return;

            remainingSeconds--;

            updateTimer();

            if (
                remainingSeconds <= 0
            ) {

                remainingSeconds = 0;

                stopTimer();

                saveCurrentQuestionTime();

                submitTest();
            }

        }, 1000);
}

function stopTimer() {

    if (timerInterval) {

        clearInterval(
            timerInterval
        );

        timerInterval = null;
    }

    if (questionTimerInterval) {

        clearInterval(
            questionTimerInterval
        );

        questionTimerInterval = null;
    }
}

function updateTimer() {

    const el =
        document.getElementById(
            "testTimer"
        );

    if (!el) return;

    el.textContent =
        formatSeconds(
            remainingSeconds
        );

    el.classList.remove(
        "warning",
        "danger"
    );

    if (
        remainingSeconds <= 300
    ) {

        el.classList.add(
            "danger"
        );

    } else if (
        remainingSeconds <= 600
    ) {

        el.classList.add(
            "warning"
        );
    }
}


/* =====================================================
   QUESTION CONTROLS
===================================================== */

window.previousQuestion =
    function() {

        if (currentQuestion <= 0) {
            return;
        }

        saveCurrentQuestionTime();

        currentQuestion--;

        startQuestionTimer();

        renderCurrentQuestion();
    };

window.saveAndNext =
    function() {

        saveCurrentQuestionTime();

        if (
            currentQuestion <
            currentQuestions.length - 1
        ) {

            currentQuestion++;

            startQuestionTimer();

            renderCurrentQuestion();

        } else {

            openSubmitModal();
        }
    };

window.toggleReview =
    function() {

        markedQuestions[
            currentQuestion
        ] =
            !markedQuestions[
                currentQuestion
            ];

        renderCurrentQuestion();
    };


/* =====================================================
   QUESTION MENU
===================================================== */

window.openQuestionMenu =
    function() {

        renderQuestionMenu();

        document
            .getElementById("menuOverlay")
            ?.classList.add("show");
    };

window.closeMenu =
    function(event) {

        if (
            event.target.id ===
            "menuOverlay"
        ) {

            closeQuestionMenu();
        }
    };

window.closeQuestionMenu =
    function() {

        document
            .getElementById("menuOverlay")
            ?.classList.remove("show");
    };

function renderQuestionMenu() {

    const grid =
        document.getElementById(
            "menuQuestionGrid"
        );

    if (!grid) return;

    grid.innerHTML =
        currentQuestions.map(
            (q, index) => `

                <button
                    class="menu-q-btn
                        ${
                            index === currentQuestion
                                ? "current"
                                : ""
                        }
                        ${
                            answers[index] !== undefined
                                ? "answered"
                                : ""
                        }
                        ${
                            markedQuestions[index]
                                ? "review"
                                : ""
                        }"
                    onclick="goQuestion(${index})">

                    ${index + 1}

                </button>
            `
        ).join("");
}

window.goQuestion =
    function(index) {

        if (
            index < 0 ||
            index >= currentQuestions.length
        ) {
            return;
        }

        saveCurrentQuestionTime();

        currentQuestion = index;

        closeQuestionMenu();

        startQuestionTimer();

        renderCurrentQuestion();
    };

window.submitFromMenu =
    function() {

        closeQuestionMenu();

        openSubmitModal();
    };

function updateAnsweredCount() {

    const count =
        Object.values(answers)
        .filter(
            value => {

                const n =
                    Number(value);

                return (
                    Number.isInteger(n) &&
                    n >= 1 &&
                    n <= 4
                );
            }
        )
        .length;

    const el =
        document.getElementById(
            "answeredCount"
        );

    if (el) {
        el.textContent = count;
    }
}


/* =====================================================
   SUBMIT MODAL
===================================================== */

function openSubmitModal() {

    saveCurrentQuestionTime();

    testPaused = true;

    stopTimer();

    const answered =
        Object.values(answers)
        .filter(
            value => {

                const n =
                    Number(value);

                return (
                    Number.isInteger(n) &&
                    n >= 1 &&
                    n <= 4
                );
            }
        )
        .length;

    const msg =
        document.getElementById(
            "submitMessage"
        );

    if (msg) {

        msg.textContent =
            selectedTestLanguage === "en"
                ? `You have attempted ${answered}/${currentQuestions.length} questions. Do you want to submit the test?`
                : `आपने ${answered}/${currentQuestions.length} questions attempt किए हैं। क्या आप Test submit करना चाहते हैं?`;
    }

    document
        .getElementById("submitModal")
        ?.classList.add("show");
}

window.closeSubmitModal =
    function() {

        document
            .getElementById("submitModal")
            ?.classList.remove("show");

        if (!submitted) {

            testPaused = false;

            questionStartedAt =
                Date.now();

            startMainTimer();
        }
    };

window.confirmSubmit =
    function() {

        document
            .getElementById("submitModal")
            ?.classList.remove("show");

        submitTest();
    };


/* =====================================================
   PAUSE & EXIT MODAL (back button)
===================================================== */

window.openPauseExitModal =
    function() {

        if (!isTestActive()) return;

        pauseModalOpen = true;

        saveCurrentQuestionTime();

        testPaused = true;

        stopTimer();

        document
            .getElementById("pauseExitModal")
            ?.classList.add("show");
    };

window.cancelPauseExit =
    function() {

        pauseModalOpen = false;

        document
            .getElementById("pauseExitModal")
            ?.classList.remove("show");

        if (!submitted && !testExited) {

            testPaused = false;

            questionStartedAt =
                Date.now();

            startMainTimer();
            startQuestionTimer();
        }
    };

window.confirmPauseExit =
    async function() {

        pauseModalOpen = false;

        document
            .getElementById("pauseExitModal")
            ?.classList.remove("show");

        try {

            await savePausedAttempt();

            showStatus(
                selectedTestLanguage === "en"
                    ? "⏸️ Test paused. You can resume from the same question later."
                    : "⏸️ Test pause ho gaya। Aap baad me isi question se dobara resume kar sakte hain।",
                "success"
            );

        } catch (error) {

            console.error(
                "PAUSE SAVE ERROR:",
                error
            );

            showStatus(
                "Pause save nahi hua: " +
                error.message,
                "error"
            );
        }

        testExited = true;
        testPaused = true;

        stopTimer();

        hideTestInterface();

        await backToAvailableTests();
    };


/* =====================================================
   RESULT CALCULATION
===================================================== */

async function submitTest() {

    if (submitted) return;

    saveCurrentQuestionTime();

    submitted = true;
    testPaused = true;

    stopTimer();

    const result =
        calculateResult();

    try {

        await saveSubmittedResult(
            result
        );

        await deletePausedAttempt();

        showStatus(
            "✅ Test submitted successfully.",
            "success"
        );

    } catch (error) {

        console.error(
            "RESULT SAVE ERROR:",
            error
        );

        showStatus(
            "Result save nahi hua: " +
            error.message,
            "error"
        );
    }

    document
        .getElementById(
            "testInterface"
        )
        ?.classList.add("hidden");

    document
        .getElementById(
            "normalHeader"
        )
        ?.classList.remove("hidden");

    await openAttemptHistory(
        currentTest.id,
        true
    );
}

function calculateResult() {

    const positive =
        Number(
            currentTest.marksPerQuestion ??
            1
        );

    const negative =
        Number(
            currentTest.negativeMarks ??
            0
        );

    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let score = 0;
    let totalMarks = 0;

    currentQuestions.forEach(
        (q, index) => {

            const marks =
                Number(
                    q.marks ??
                    positive
                );

            totalMarks += marks;


            /*
               answers[index] is 1-based.
               Convert to internal 0-based.
            */

            const rawSelected =
                answers[index];

            const selected =
                normalizeSelectedIndex(
                    rawSelected
                );

            if (selected === -1) {

                skipped++;

                return;
            }

            const correctIndex =
                getCorrectIndex(q);

            if (
                selected === correctIndex &&
                correctIndex !== -1
            ) {

                correct++;

                score += marks;

            } else {

                wrong++;

                score -= negative;
            }
        }
    );

    return {

        correct,
        wrong,
        skipped,

        attempted:
            correct + wrong,

        score,

        totalMarks,

        percentage:
            totalMarks
                ? (
                    score /
                    totalMarks
                ) * 100
                : 0
    };
}


/* =====================================================
   PAUSED ATTEMPT DOC ID
===================================================== */

function getPausedDocId() {

    if (
        !firebaseUser ||
        !currentTest
    ) {
        return "";
    }

    return (
        firebaseUser.uid +
        "_" +
        String(currentTest.id) +
        "_paused"
    );
}


/* =====================================================
   SAVE PAUSED ATTEMPT
===================================================== */

async function savePausedAttempt() {

    if (
        !firebaseUser ||
        !currentTest
    ) {
        return;
    }

    const questionTimesArray =
        currentQuestions.map(
            (q, index) => ({

                questionNo:
                    index + 1,

                questionId:
                    q.id || "",

                timeSpentSeconds:
                    Number(
                        questionTimes[index]
                    ) || 0,

                timeSpent:
                    formatSeconds(
                        Number(
                            questionTimes[index]
                        ) || 0
                    )
            })
        );

    const savedAnswers =
        Object.keys(answers)
        .map(index => {

            const question =
                currentQuestions[
                    Number(index)
                ];

            const selectedOneBased =
                Number(
                    answers[index]
                );

            if (
                !question ||
                !Number.isInteger(
                    selectedOneBased
                ) ||
                selectedOneBased < 1 ||
                selectedOneBased > 4
            ) {
                return null;
            }

            const selectedIndex =
                selectedOneBased - 1;

            return {

                questionId:
                    question.id || "",

                questionNumber:
                    Number(index) + 1,

                selectedAnswer:
                    selectedOneBased,

                selectedAnswerIndexing:
                    "1-based",

                selectedOption:
                    ["A", "B", "C", "D"][
                        selectedIndex
                    ]
            };

        })
        .filter(Boolean);

    await setDoc(
        doc(
            db,
            RESULTS,
            getPausedDocId()
        ),
        {

            studentUid:
                firebaseUser.uid,

            studentEmail:
                firebaseUser.email || "",

            studentUsername:
                getStudentUsername(),

            studentName:
                getStudentName(),

            testId:
                currentTest.id,

            testName:
                currentTest.testName ??
                currentTest.name ??
                "",

            series:
                getSeries(currentTest),

            seriesId:
                getTestSeriesId(
                    currentTest
                ),

            testType:
                currentTest.testType ??
                currentTest.category ??
                "",

            mockType:
                getMockType(
                    currentTest
                ),

            category:
                normalizeCategory(
                    currentTest
                ),

            subject:
                currentTest.subject ??
                "",

            language:
                selectedTestLanguage,

            status:
                "paused",

            currentQuestionIndex:
                currentQuestion,

            remainingSeconds:
                remainingSeconds,

            answers:
                savedAnswers,

            questionTimes:
                questionTimesArray,

            createdAt:
                serverTimestamp(),

            pausedAt:
                serverTimestamp(),

            updatedAt:
                serverTimestamp()
        },
        {
            merge: true
        }
    );
}

async function deletePausedAttempt() {

    const pausedId =
        getPausedDocId();

    if (!pausedId) return;

    try {

        await deleteDoc(
            doc(
                db,
                RESULTS,
                pausedId
            )
        );

    } catch (error) {

        console.warn(
            "Paused attempt cleanup failed:",
            error
        );
    }
}

/* =====================================================
   SAVE RESULT
===================================================== */

async function saveSubmittedResult(
    resultData
) {

    if (!firebaseUser) return;

    const questionTimesArray =
        currentQuestions.map(
            (q, index) => ({

                questionNo:
                    index + 1,

                questionId:
                    q.id || "",

                timeSpentSeconds:
                    Number(
                        questionTimes[index]
                    ) || 0,

                timeSpent:
                    formatSeconds(
                        Number(
                            questionTimes[index]
                        ) || 0
                    )
            })
        );


    const savedAnswers =
        Object.keys(answers)
        .map(index => {

            const question =
                currentQuestions[
                    Number(index)
                ];

            const selectedOneBased =
                Number(
                    answers[index]
                );

            if (
                !question ||
                !Number.isInteger(
                    selectedOneBased
                ) ||
                selectedOneBased < 1 ||
                selectedOneBased > 4
            ) {
                return null;
            }

            const selectedIndex =
                selectedOneBased - 1;

            const correctIndex =
                getCorrectIndex(
                    question
                );

            /*
               correctAnswer is saved 1-based.
               If no correct answer exists,
               save null instead of invalid 0.
            */

            const correctOneBased =
                correctIndex >= 0 &&
                correctIndex <= 3
                    ? correctIndex + 1
                    : null;

            return {

                questionId:
                    question.id || "",

                questionNumber:
                    Number(index) + 1,

                /*
                   FINAL 1-BASED
                */
                selectedAnswer:
                    selectedOneBased,

                /*
                   Explicit indexing information
                */
                selectedAnswerIndexing:
                    "1-based",

                selectedOption:
                    ["A", "B", "C", "D"][
                        selectedIndex
                    ],

                /*
                   FINAL 1-BASED
                */
                correctAnswer:
                    correctOneBased,

                correctAnswerIndexing:
                    "1-based",

                correctOption:
                    correctIndex >= 0
                        ? ["A", "B", "C", "D"][
                            correctIndex
                        ]
                        : ""
            };

        })
        .filter(Boolean);


    await addDoc(
        collection(
            db,
            RESULTS
        ),
        {

            studentUid:
                firebaseUser.uid,

            studentEmail:
                firebaseUser.email || "",

            studentUsername:
                getStudentUsername(),

            studentName:
                getStudentName(),

            testId:
                currentTest.id,

            testName:
                currentTest.testName ??
                currentTest.name ??
                "",

            series:
                getSeries(currentTest),

            seriesId:
                getTestSeriesId(
                    currentTest
                ),

            testType:
                currentTest.testType ??
                currentTest.category ??
                "",

            mockType:
                getMockType(
                    currentTest
                ),

            category:
                normalizeCategory(
                    currentTest
                ),

            subject:
                currentTest.subject ??
                "",

            language:
                selectedTestLanguage,

            status:
                "submitted",

            correct:
                resultData.correct,

            wrong:
                resultData.wrong,

            skipped:
                resultData.skipped,

            attempted:
                resultData.attempted,

            score:
                resultData.score,

            totalMarks:
                resultData.totalMarks,

            percentage:
                resultData.percentage,

            remainingSeconds:
                remainingSeconds,

            /*
               FINAL ANSWERS:
               selectedAnswer = 1..4
               correctAnswer = 1..4
            */
            answers:
                savedAnswers,

            questionTimes:
                questionTimesArray,

            createdAt:
                serverTimestamp(),

            submittedAt:
                serverTimestamp()
        }
    );
}


/* =====================================================
   RESULT HISTORY
===================================================== */

window.openAttemptHistory =
    async function(
        testId,
        showLatest = false
    ) {

        const test =
            allTests.find(
                t =>
                    String(t.id) ===
                    String(testId)
            );

        if (!test) return;

        currentTest = test;

        currentAttemptDocs =
            await loadAttempts(
                testId
            );

        const submittedAttempts =
            currentAttemptDocs.filter(
                a =>
                    a.status ===
                    "submitted"
            );

        if (!submittedAttempts.length) {

            if (!showLatest) {

                showStatus(
                    "Is Test ka koi submitted attempt nahi hai.",
                    "info"
                );
            }

            backToAvailableTests();

            return;
        }

        selectedAttempt =
            submittedAttempts[0];

        if (
            selectedAttempt.language ===
            "en" ||
            selectedAttempt.language ===
            "hi"
        ) {

            selectedTestLanguage =
                selectedAttempt.language;
        }

        renderAttemptResult(
            submittedAttempts
        );
    };

function renderAttemptResult(
    attempts
) {

    hideAllSections();

    document
        .getElementById("resultBox")
        ?.classList.remove("hidden");

    const tabs =
        document.getElementById(
            "attemptTabs"
        );

    if (tabs) {

        tabs.innerHTML =
            attempts.map(
                (a, index) => `

                    <button
                        class="attempt-tab ${
                            a.id ===
                            selectedAttempt.id
                                ? "active"
                                : ""
                        }"
                        onclick="selectAttempt('${a.id}')">

                        Attempt
                        ${attempts.length - index}

                    </button>
                `
            ).join("");
    }

    renderSelectedAttempt();
}

window.selectAttempt =
    function(id) {

        selectedAttempt =
            currentAttemptDocs.find(
                a =>
                    String(a.id) ===
                    String(id)
            );

        renderAttemptResult(
            currentAttemptDocs.filter(
                a =>
                    a.status ===
                    "submitted"
            )
        );
    };

function renderSelectedAttempt() {

    const a =
        selectedAttempt;

    if (!a) return;

    const score =
        document.getElementById(
            "scoreDisplay"
        );

    if (score) {

        score.textContent =
            Number(
                a.score || 0
            ).toFixed(2);
    }


    const grid =
        document.getElementById(
            "resultGrid"
        );

    if (grid) {

        grid.innerHTML = `

            <div class="result-box">
                <div class="result-label">
                    Correct
                </div>
                <div class="result-value">
                    ${a.correct || 0}
                </div>
            </div>

            <div class="result-box">
                <div class="result-label">
                    Wrong
                </div>
                <div class="result-value">
                    ${a.wrong || 0}
                </div>
            </div>

            <div class="result-box">
                <div class="result-label">
                    Skipped
                </div>
                <div class="result-value">
                    ${a.skipped || 0}
                </div>
            </div>

            <div class="result-box">
                <div class="result-label">
                    Attempted
                </div>
                <div class="result-value">
                    ${a.attempted || 0}
                </div>
            </div>

            <div class="result-box">
                <div class="result-label">
                    Total Marks
                </div>
                <div class="result-value">
                    ${Number(
                        a.totalMarks || 0
                    ).toFixed(2)}
                </div>
            </div>

            <div class="result-box">
                <div class="result-label">
                    Percentage
                </div>
                <div class="result-value">
                    ${Number(
                        a.percentage || 0
                    ).toFixed(2)}%
                </div>
            </div>

        `;
    }

    document
        .getElementById("analysisBox")
        ?.classList.add("hidden");

    document
        .getElementById("answerBox")
        ?.classList.add("hidden");
}


/* =====================================================
   ANALYSIS
===================================================== */

window.showSelectedAnalysis =
    function() {

        const a =
            selectedAttempt;

        if (!a) return;

        const box =
            document.getElementById(
                "analysisBox"
            );

        if (!box) return;

        box.classList.remove(
            "hidden"
        );

        const en =
            selectedTestLanguage ===
            "en";

        box.innerHTML = `

            <h3>
                📊 Attempt Analysis
            </h3>

            <p>
                <b>
                    ${
                        en
                            ? "Total Questions:"
                            : "कुल प्रश्न:"
                    }
                </b>
                ${currentQuestions.length}
            </p>

            <p>
                <b>Attempted:</b>
                ${a.attempted || 0}
            </p>

            <p>
                <b>Correct:</b>
                ${a.correct || 0}
            </p>

            <p>
                <b>Wrong:</b>
                ${a.wrong || 0}
            </p>

            <p>
                <b>Skipped:</b>
                ${a.skipped || 0}
            </p>

            <p>
                <b>Score:</b>
                ${Number(
                    a.score || 0
                ).toFixed(2)}
            </p>

            <p>
                <b>Percentage:</b>
                ${Number(
                    a.percentage || 0
                ).toFixed(2)}%
            </p>

        `;
    };

/* =====================================================
   ANSWER REVIEW
===================================================== */

window.showSelectedAnswers =
    async function() {

        const a =
            selectedAttempt;

        if (!a) return;

        const box =
            document.getElementById(
                "answerBox"
            );

        if (!box) return;

        box.classList.remove(
            "hidden"
        );

        box.innerHTML = `
            <div class="analysis-card">
                <h3>
                    📖 Answer Analysis
                </h3>
                Loading...
            </div>
        `;

        await loadQuestionsForReview();

        const en =
            selectedTestLanguage ===
            "en";

        box.innerHTML =
            currentQuestions.map(
                (q, index) => {

                    const options =
                        getOptions(q);

                    const correct =
                        getCorrectIndex(q);

                    const answer =
                        (
                            a.answers || []
                        ).find(
                            x =>
                                Number(
                                    x.questionNumber
                                ) ===
                                index + 1
                        );

                    /*
                       Old + new attempt compatible
                    */

                    const selected =
                        normalizeAttemptSelectedAnswer(
                            answer
                        );

                    return `

                        <div class="review-card">

                            <b>
                                Q${index + 1}.
                            </b>

                            <div class="review-question-text">
                                ${escapeHTML(
                                    getQuestionText(q)
                                )}
                            </div>

                            ${
                                options.map(
                                    (
                                        option,
                                        optIndex
                                    ) => {

                                        let cls =
                                            "review-option";

                                        if (
                                            optIndex ===
                                            correct
                                        ) {
                                            cls +=
                                                " review-correct";
                                        }

                                        if (
                                            selected ===
                                                optIndex &&
                                            selected !==
                                                correct
                                        ) {
                                            cls +=
                                                " review-wrong";
                                        }

                                        return `

                                            <div class="${cls}">

                                                <b>
                                                    ${
                                                        ["A","B","C","D"][
                                                            optIndex
                                                        ]
                                                    }.
                                                </b>

                                                ${escapeHTML(
                                                    option
                                                )}

                                                ${
                                                    optIndex ===
                                                    correct
                                                        ? (
                                                            en
                                                                ? " ✅ Correct"
                                                                : " ✅ सही उत्तर"
                                                        )
                                                        : ""
                                                }

                                                ${
                                                    selected ===
                                                        optIndex &&
                                                    selected !==
                                                        correct
                                                        ? (
                                                            en
                                                                ? " ❌ Your Answer"
                                                                : " ❌ आपका उत्तर"
                                                        )
                                                        : ""
                                                }

                                            </div>
                                        `;
                                    }
                                ).join("")
                            }

                            ${
                                getSolutionText(q)
                                    ? `
                                        <div class="solution">

                                            <b>
                                                💡 ${
                                                    en
                                                        ? "Solution:"
                                                        : "समाधान:"
                                                }
                                            </b>

                                            ${escapeHTML(
                                                getSolutionText(q)
                                            )}

                                        </div>
                                    `
                                    : ""
                            }

                        </div>
                    `;
                }
            ).join("");
    };

async function loadQuestionsForReview() {

    if (!currentQuestions.length) {

        await loadQuestions();
    }
}


/* =====================================================
   REATTEMPT / BACK
===================================================== */

window.reattemptTest =
    async function() {

        document
            .getElementById("resultBox")
            ?.classList.add("hidden");

        if (!currentTest) return;

        showLanguageInstructionPage(
            currentTest,
            "start"
        );
    };

window.backToCategories =
    function() {

        stopTimer();

        hideAllSections();

        document
            .getElementById("freeHome")
            ?.classList.remove("hidden");

        currentSeries = "";
        currentCategory = "";
        currentSeriesObject = null;
    };

window.backToAvailableTests =
    async function() {

        document
            .getElementById("resultBox")
            ?.classList.add("hidden");

        document
            .getElementById("testInterface")
            ?.classList.add("hidden");

        document
            .getElementById("normalHeader")
            ?.classList.remove("hidden");

        if (currentSeries) {

            openSeriesCategory(
                currentCategory
            );

        } else {

            openMockType(
                currentMockType
            );
        }
    };


/* =====================================================
   FREE SERIES ENROLLMENT
===================================================== */

window.enrollFreeMockSeries =
    async function(seriesId) {

        if (!firebaseUser) {

            showStatus(
                "❌ Pehle student login karein.",
                "error"
            );

            return false;
        }

        const series =
            allSeries.find(
                item =>
                    String(item.id) ===
                    String(seriesId) ||
                    String(
                        item.firestoreId
                    ) ===
                    String(seriesId)
            );

        if (!series) {

            showStatus(
                "❌ Test Series nahi mili.",
                "error"
            );

            return false;
        }

        if (
            getSeriesAccess(series) !==
            "free"
        ) {

            showStatus(
                "❌ Yeh Free Test Series nahi hai.",
                "error"
            );

            return false;
        }

        if (
            isSeriesEnrolled(series)
        ) {

            showStatus(
                "✅ Aap is Test Series me pehle se enrolled hain.",
                "success"
            );

            return true;
        }

        const seriesName =
            getSeriesName(series);

        const seriesRealId =
            String(
                series.id ??
                series.firestoreId ??
                ""
            );

        const studentKey =
            getStudentKey();

        const enrollmentId =
            firebaseUser.uid +
            "_" +
            seriesRealId;

        try {

            await setDoc(
                doc(
                    db,
                    SERIES_ENROLLMENTS,
                    enrollmentId
                ),
                {

                    studentKey:
                        studentKey,

                    studentUid:
                        firebaseUser.uid,

                    studentEmail:
                        firebaseUser.email ||
                        "",

                    studentName:
                        getStudentName(),

                    seriesId:
                        seriesRealId,

                    seriesName:
                        seriesName,

                    status:
                        "enrolled",

                    access:
                        "free",

                    type:
                        "test-pass",

                    paymentType:
                        "test-pass",

                    isTestPass:
                        true,

                    firestoreSeriesId:
                        String(
                            series.firestoreId ??
                            ""
                        ),

                    testSeriesId:
                        seriesRealId,

                    testSeriesName:
                        seriesName,

                    enrolledAt:
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp()

                },
                {
                    merge: true
                }
            );

            enrolledSeriesIds.add(
                seriesRealId
            );

            if (series.firestoreId) {

                enrolledSeriesIds.add(
                    String(
                        series.firestoreId
                    )
                );
            }

            if (seriesName) {

                enrolledSeriesNames.add(
                    seriesName
                        .trim()
                        .toLowerCase()
                );
            }

            updateCounts();

            showStatus(
                "✅ Free Test Pass me enrollment ho gaya.",
                "success"
            );

            if (
                currentSeriesObject &&
                (
                    String(
                        currentSeriesObject.id
                    ) ===
                    seriesRealId ||

                    String(
                        currentSeriesObject.firestoreId
                    ) ===
                    seriesRealId ||

                    getSeriesName(
                        currentSeriesObject
                    )
                        .toLowerCase() ===
                    seriesName
                        .toLowerCase()
                )
            ) {

                openSeries(
                    seriesName
                );
            }

            return true;

        } catch (error) {

            console.error(
                "FREE SERIES ENROLL ERROR:",
                error
            );

            showStatus(
                "Enrollment nahi hua: " +
                error.message,
                "error"
            );

            return false;
        }
    };


/* =====================================================
   FREE TEST ENROLLMENT
===================================================== */

window.enrollFreeMockTest =
    async function(testId) {

        if (!firebaseUser) {

            showStatus(
                "❌ Pehle student login karein.",
                "error"
            );

            return false;
        }

        const test =
            allTests.find(
                t =>
                    String(t.id) ===
                    String(testId)
            );

        if (!test) {

            showStatus(
                "❌ Test nahi mila.",
                "error"
            );

            return false;
        }

        if (!isFreeTest(test)) {

            showStatus(
                "❌ Yeh Free Test nahi hai.",
                "error"
            );

            return false;
        }

        const series =
            findSeriesForTest(test);

        if (series) {

            return await window
                .enrollFreeMockSeries(
                    series.id
                );
        }

        const enrollmentId =
            firebaseUser.uid +
            "_" +
            String(test.id);

        try {

            await setDoc(
                doc(
                    db,
                    SERIES_ENROLLMENTS,
                    enrollmentId
                ),
                {

                    studentKey:
                        getStudentKey(),

                    studentUid:
                        firebaseUser.uid,

                    studentName:
                        getStudentName(),

                    studentEmail:
                        firebaseUser.email ||
                        "",

                    testId:
                        String(test.id),

                    testName:
                        test.testName ??
                        test.name ??
                        "",

                    testType:
                        "free",

                    series:
                        getSeries(test),

                    seriesName:
                        getSeries(test),

                    category:
                        normalizeCategory(
                            test
                        ),

                    subject:
                        test.subject ??
                        "",

                    status:
                        "enrolled",

                    access:
                        "free",

                    type:
                        "test-pass",

                    paymentType:
                        "test-pass",

                    isTestPass:
                        true,

                    enrolledAt:
                        serverTimestamp(),

                    updatedAt:
                        serverTimestamp()

                },
                {
                    merge: true
                }
            );

            enrolledTestIds.add(
                String(test.id)
            );

            updateCounts();

            showStatus(
                "✅ Free Mock Test me enrollment ho gaya.",
                "success"
            );

            return true;

        } catch (error) {

            console.error(
                "FREE TEST ENROLL ERROR:",
                error
            );

            showStatus(
                "Enrollment nahi hua: " +
                error.message,
                "error"
            );

            return false;
        }
    };


/* =====================================================
   REFRESH ENROLLMENTS
===================================================== */

window.refreshMockTestEnrollments =
    async function() {

        await loadEnrollments();

        updateCounts();

        if (currentSeries) {

            openSeries(
                currentSeries
            );

        } else {

            renderTypeSeries();
        }
    };


/* =====================================================
   AUTH LISTENER
===================================================== */

onAuthStateChanged(
    auth,
    async user => {

        firebaseUser = user;

        const student =
            document.getElementById(
                "studentName"
            );

        if (student) {

            student.textContent =
                getStudentName();
        }

        await loadTests();

        if (!user) {

            enrolledTestIds =
                new Set();

            enrolledSeriesIds =
                new Set();

            enrolledSeriesNames =
                new Set();

            updateCounts();

            renderTypeSeries();
        }
    }
);


/* =====================================================
   INITIAL STUDENT NAME
===================================================== */

const student =
    document.getElementById(
        "studentName"
    );

  if (student) {

    student.textContent =
        getStudentName();
  }
