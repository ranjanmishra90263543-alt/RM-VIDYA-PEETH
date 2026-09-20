// =====================================================
// THE HUB - STUDENT DASHBOARD
// FIREBASE AUTH + FIRESTORE
// FINAL VERSION
// =====================================================

import {
    auth,
    db
} from "./firebase-config.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// =====================================================
// GLOBAL STUDENT DATA
// =====================================================

let currentStudent = null;


// =====================================================
// PAGE LOAD
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        setupStudentDashboard();

    }
);


// =====================================================
// FIREBASE AUTH CHECK
// =====================================================

function setupStudentDashboard() {

    onAuthStateChanged(
        auth,
        async function (user) {

            if (!user) {

                localStorage.removeItem(
                    "studentLoggedIn"
                );

                localStorage.removeItem(
                    "studentUser"
                );

                window.location.href =
                    "login.html";

                return;

            }


            try {

                await loadStudentProfile(
                    user.uid
                );

                await loadStudentCourses();

                await loadStudentMockTests();

            } catch (error) {

                console.error(
                    "Dashboard Error:",
                    error
                );

            }

        }
    );

}


// =====================================================
// LOAD STUDENT PROFILE
// =====================================================

async function loadStudentProfile(uid) {

    const studentRef =
        doc(
            db,
            "students",
            uid
        );


    const studentSnap =
        await getDoc(
            studentRef
        );


    if (!studentSnap.exists()) {

        currentStudent = {

            uid: uid,

            name:
                "Student",

            email:
                auth.currentUser?.email || "",

            mobile:
                "",

            username:
                auth.currentUser?.email || "",

            status:
                "active",

            role:
                "student"

        };

    } else {

        const data =
            studentSnap.data();


        // =================================================
        // BLOCK CHECK
        // =================================================

        if (
            data.status === "blocked"
        ) {

            await signOut(
                auth
            );


            localStorage.removeItem(
                "studentLoggedIn"
            );

            localStorage.removeItem(
                "studentUser"
            );


            alert(
                "🚫 आपका Student Account Blocked है।"
            );


            window.location.href =
                "login.html";

            return;

        }


        currentStudent = {

            uid: uid,

            name:
                data.name ||
                "Student",

            email:
                data.email ||
                auth.currentUser?.email ||
                "",

            mobile:
                data.mobile ||
                "",

            username:
                data.username ||
                data.email ||
                auth.currentUser?.email ||
                "",

            role:
                data.role ||
                "student",

            status:
                data.status ||
                "active"

        };

    }


    // =================================================
    // LOCAL SESSION
    // =================================================

    localStorage.setItem(
        "studentUser",
        JSON.stringify(
            currentStudent
        )
    );


    localStorage.setItem(
        "studentLoggedIn",
        "true"
    );


    // =================================================
    // HEADER
    // =================================================

    const studentName =
        document.getElementById(
            "studentName"
        );


    if (studentName) {

        studentName.textContent =
            currentStudent.name ||
            "Student";

    }


    // =================================================
    // PROFILE
    // =================================================

    const profileName =
        document.getElementById(
            "profileName"
        );

    const profileUsername =
        document.getElementById(
            "profileUsername"
        );

    const profileMobile =
        document.getElementById(
            "profileMobile"
        );

    const profileEmail =
        document.getElementById(
            "profileEmail"
        );


    if (profileName) {

        profileName.textContent =
            currentStudent.name ||
            "-";

    }


    if (profileUsername) {

        profileUsername.textContent =
            currentStudent.username ||
            "-";

    }


    if (profileMobile) {

        profileMobile.textContent =
            currentStudent.mobile ||
            "-";

    }


    if (profileEmail) {

        profileEmail.textContent =
            currentStudent.email ||
            "-";

    }

}


// =====================================================
// OPEN COURSES
// =====================================================

window.openCourses =
    function () {

        window.location.href =
            "courses.html";

    };


// =====================================================
// LOAD COURSES
// =====================================================

async function loadStudentCourses() {

    const container =
        document.getElementById(
            "studentCourses"
        );


    if (!container) {

        return;

    }


    container.innerHTML =
        "<p>📚 Courses loading...</p>";


    try {

        const coursesRef =
            collection(
                db,
                "courses"
            );


        const snapshot =
            await getDocs(
                coursesRef
            );


        if (snapshot.empty) {

            const localCourses =
                getLocalArray(
                    "courses"
                );


            if (localCourses.length) {

                renderCourses(
                    container,
                    localCourses
                );

            } else {

                container.innerHTML = `
                    <p>
                        अभी कोई Course available नहीं है।
                    </p>
                `;

            }

            return;

        }


        const courses =
            snapshot.docs.map(
                function (courseDoc) {

                    return {

                        id:
                            courseDoc.id,

                        ...courseDoc.data()

                    };

                }
            );


        renderCourses(
            container,
            courses
        );


    } catch (error) {

        console.error(
            "Course Loading Error:",
            error
        );


        const localCourses =
            getLocalArray(
                "courses"
            );


        if (localCourses.length) {

            renderCourses(
                container,
                localCourses
            );

        } else {

            container.innerHTML = `
                <p>
                    ❌ Courses load नहीं हो पाए।
                </p>
            `;

        }

    }

}


// =====================================================
// RENDER COURSES
// =====================================================

function renderCourses(
    container,
    courses
) {

    if (
        !Array.isArray(courses) ||
        courses.length === 0
    ) {

        container.innerHTML = `
            <p>
                अभी कोई Course available नहीं है।
            </p>
        `;

        return;

    }


    container.innerHTML =
        courses.map(
            function (course) {

                const courseName =
                    course.courseName ||
                    course.name ||
                    course.title ||
                    "Course";


                const exam =
                    course.courseExam ||
                    course.exam ||
                    course.category ||
                    "";


                return `

                    <div
                        style="
                            background:#0f172a;
                            border:1px solid #334155;
                            padding:16px;
                            margin-top:12px;
                            border-radius:12px;
                        "
                    >

                        <h3>
                            📚
                            ${escapeHTML(
                                courseName
                            )}
                        </h3>


                        ${
                            exam
                                ? `
                                    <p
                                        style="
                                            color:#cbd5e1;
                                        "
                                    >
                                        🏛️
                                        ${escapeHTML(
                                            exam
                                        )}
                                    </p>
                                `
                                : ""
                        }


                        <button
                            style="
                                width:100%;
                                padding:10px;
                                border:none;
                                border-radius:8px;
                                background:#2563eb;
                                color:white;
                                font-weight:bold;
                                cursor:pointer;
                            "
                            onclick="
                                openCourse(
                                    '${escapeAttribute(
                                        course.id || ""
                                    )}'
                                )
                            "
                        >
                            📖 Open Course
                        </button>

                    </div>

                `;

            }
        ).join("");

}


// =====================================================
// OPEN SINGLE COURSE
// =====================================================

window.openCourse =
    function (courseId) {

        if (!courseId) {

            window.location.href =
                "courses.html";

            return;

        }


        localStorage.setItem(
            "selectedCourseId",
            courseId
        );


        window.location.href =
            "courses.html";

    };


// =====================================================
// OPEN MOCK TEST PAGE
// =====================================================

window.openMockTests =
    function () {

        window.location.href =
            "mock-test.html";

    };


// =====================================================
// LOAD MOCK TESTS FROM FIRESTORE
// =====================================================

async function loadStudentMockTests() {

    const container =
        document.getElementById(
            "studentMockTests"
        );


    if (!container) {

        return;

    }


    container.innerHTML =
        "<p>📝 Mock Tests loading...</p>";


    try {

        // =================================================
        // FIRESTORE COLLECTION
        // =================================================

        const questionsRef =
            collection(
                db,
                "mockQuestions"
            );


        const snapshot =
            await getDocs(
                questionsRef
            );


        console.log(
            "🔥 Firestore Mock Questions:",
            snapshot.size
        );


        // =================================================
        // NO QUESTIONS
        // =================================================

        if (
            snapshot.empty
        ) {

            container.innerHTML = `
                <div
                    style="
                        background:#0f172a;
                        border:1px solid #334155;
                        padding:18px;
                        border-radius:12px;
                        text-align:center;
                    "
                >
                    📝 अभी कोई Mock Test available नहीं है।
                </div>
            `;

            return;

        }


        // =================================================
        // FIRESTORE QUESTIONS
        // =================================================

        const questions =
            snapshot.docs.map(
                function (questionDoc) {

                    return {

                        id:
                            questionDoc.id,

                        ...questionDoc.data()

                    };

                }
            );


        console.log(
            "Questions Loaded:",
            questions
        );


        // =================================================
        // CREATE UNIQUE TEST LIST
        // =================================================

        const tests = [];


        questions.forEach(
            function (question) {

                // -----------------------------------------
                // SESSION ID
                // -----------------------------------------

                const sessionId =
                    question.sessionId ||
                    question.session ||
                    "";


                // -----------------------------------------
                // TEST NAME
                // -----------------------------------------

                const testName =
                    question.testName ||
                    question.test ||
                    "Mock Test";


                // -----------------------------------------
                // GROUP BY SESSION
                // -----------------------------------------

                const key =
                    sessionId ||
                    [
                        question.category || "",
                        question.examName || "",
                        question.testType || "",
                        testName
                    ].join("|");


                const existing =
                    tests.find(
                        function (test) {

                            return test.key === key;

                        }
                    );


                if (existing) {

                    existing.questionCount++;


                } else {

                    tests.push({

                        key:
                            key,

                        sessionId:
                            sessionId,

                        category:
                            question.category ||
                            "",

                        examName:
                            question.examName ||
                            "",

                        testType:
                            question.testType ||
                            "",

                        testName:
                            testName,

                        subject:
                            question.subject ||
                            "",

                        chapter:
                            question.chapter ||
                            "",

                        testTime:
                            question.testTime ||
                            question.duration ||
                            0,

                        questionCount:
                            1

                    });

                }

            }
        );


        // =================================================
        // NO VALID TEST
        // =================================================

        if (
            tests.length === 0
        ) {

            container.innerHTML = `
                <div
                    style="
                        background:#0f172a;
                        padding:18px;
                        border-radius:12px;
                        text-align:center;
                    "
                >
                    📝 कोई Test नहीं मिला।
                </div>
            `;

            return;

        }


        // =================================================
        // RENDER TESTS
        // =================================================

        container.innerHTML =
            tests.map(
                function (
                    test,
                    index
                ) {

                    return `

                        <div
                            style="
                                background:#0f172a;
                                border:1px solid #334155;
                                padding:16px;
                                margin-top:12px;
                                border-radius:12px;
                            "
                        >

                            <h3
                                style="
                                    color:#60a5fa;
                                    margin-top:0;
                                "
                            >
                                📝
                                ${escapeHTML(
                                    test.testName ||
                                    "Mock Test " +
                                    (index + 1)
                                )}
                            </h3>


                            ${
                                test.category
                                    ? `
                                        <p
                                            style="
                                                color:#cbd5e1;
                                            "
                                        >
                                            🏛️
                                            ${escapeHTML(
                                                test.category
                                            )}
                                        </p>
                                    `
                                    : ""
                            }


                            ${
                                test.examName
                                    ? `
                                        <p
                                            style="
                                                color:#cbd5e1;
                                            "
                                        >
                                            📋
                                            ${escapeHTML(
                                                test.examName
                                            )}
                                        </p>
                                    `
                                    : ""
                            }


                            ${
                                test.testType
                                    ? `
                                        <p
                                            style="
                                                color:#cbd5e1;
                                            "
                                        >
                                            📝
                                            ${escapeHTML(
                                                test.testType
                                            )}
                                        </p>
                                    `
                                    : ""
                            }


                            ${
                                test.subject
                                    ? `
                                        <p
                                            style="
                                                color:#cbd5e1;
                                            "
                                        >
                                            📚
                                            ${escapeHTML(
                                                test.subject
                                            )}
                                        </p>
                                    `
                                    : ""
                            }


                            ${
                                test.chapter
                                    ? `
                                        <p
                                            style="
                                                color:#cbd5e1;
                                            "
                                        >
                                            📖
                                            ${escapeHTML(
                                                test.chapter
                                            )}
                                        </p>
                                    `
                                    : ""
                            }


                            <p
                                style="
                                    color:#cbd5e1;
                                "
                            >
                                ❓
                                <b>
                                    ${test.questionCount}
                                </b>
                                Questions
                            </p>


                            ${
                                test.testTime
                                    ? `
                                        <p
                                            style="
                                                color:#cbd5e1;
                                            "
                                        >
                                            ⏱️
                                            ${escapeHTML(
                                                test.testTime
                                            )}
                                            Minutes
                                        </p>
                                    `
                                    : ""
                            }


                            ${
                                test.sessionId
                                    ? `
                                        <p
                                            style="
                                                color:#64748b;
                                                font-size:12px;
                                                word-break:break-all;
                                            "
                                        >
                                            🔐 Session:
                                            ${escapeHTML(
                                                test.sessionId
                                            )}
                                        </p>
                                    `
                                    : ""
                            }


                            <button
                                style="
                                    width:100%;
                                    padding:12px;
                                    border:none;
                                    border-radius:8px;
                                    background:#16a34a;
                                    color:white;
                                    font-weight:bold;
                                    cursor:pointer;
                                    font-size:15px;
                                "
                                onclick="
                                    openMockTest(
                                        '${escapeAttribute(
                                            test.testName
                                        )}',
                                        '${escapeAttribute(
                                            test.sessionId
                                        )}'
                                    )
                                "
                            >
                                ▶️ Start Test
                            </button>

                        </div>

                    `;

                }
            ).join("");


    } catch (error) {

        console.error(
            "🔥 Firestore Mock Test Error:",
            error
        );


        // =================================================
        // LOCAL STORAGE FALLBACK
        // =================================================

        const localQuestions =
            getLocalArray(
                "mockQuestions"
            );


        if (
            localQuestions.length
        ) {

            console.log(
                "Using local mockQuestions fallback"
            );


            renderLocalMockTests(
                container,
                localQuestions
            );


            return;

        }


        container.innerHTML = `

            <div
                style="
                    background:#450a0a;
                    border:1px solid #dc2626;
                    padding:18px;
                    border-radius:12px;
                "
            >

                ❌ Mock Tests load नहीं हो पाए।

                <br><br>

                कृपया Internet/Firebase connection check करें।

            </div>

        `;

    }

}


// =====================================================
// LOCAL FALLBACK RENDER
// =====================================================

function renderLocalMockTests(
    container,
    questions
) {

    const tests = [];


    questions.forEach(
        function (question) {

            const sessionId =
                question.sessionId ||
                question.session ||
                "";


            const testName =
                question.testName ||
                question.test ||
                "Mock Test";


            const key =
                sessionId ||
                [
                    question.category || "",
                    question.examName || "",
                    question.testType || "",
                    testName
                ].join("|");


            const existing =
                tests.find(
                    function (test) {

                        return test.key === key;

                    }
                );


            if (existing) {

                existing.questionCount++;

            } else {

                tests.push({

                    key:
                        key,

                    sessionId:
                        sessionId,

                    category:
                        question.category ||
                        "",

                    examName:
                        question.examName ||
                        "",

                    testType:
                        question.testType ||
                        "",

                    testName:
                        testName,

                    subject:
                        question.subject ||
                        "",

                    chapter:
                        question.chapter ||
                        "",

                    testTime:
                        question.testTime ||
                        0,

                    questionCount:
                        1

                });

            }

        }
    );


    container.innerHTML =
        tests.map(
            function (
                test,
                index
            ) {

                return `

                    <div
                        style="
                            background:#0f172a;
                            border:1px solid #334155;
                            padding:16px;
                            margin-top:12px;
                            border-radius:12px;
                        "
                    >

                        <h3>
                            📝
                            ${escapeHTML(
                                test.testName ||
                                "Mock Test " +
                                (index + 1)
                            )}
                        </h3>

                        <p
                            style="
                                color:#cbd5e1;
                            "
                        >
                            🏛️
                            ${escapeHTML(
                                test.category
                            )}

                            <br>

                            📋
                            ${escapeHTML(
                                test.examName
                            )}

                            <br>

                            📝
                            ${escapeHTML(
                                test.testType
                            )}

                            <br>

                            📚
                            ${escapeHTML(
                                test.subject
                            )}

                            ${
                                test.chapter
                                    ? `
                                        <br>
                                        📖
                                        ${escapeHTML(
                                            test.chapter
                                        )}
                                    `
                                    : ""
                            }

                            <br>

                            ❓
                            ${test.questionCount}
                            Questions

                        </p>


                        <button
                            style="
                                width:100%;
                                padding:10px;
                                border:none;
                                border-radius:8px;
                                background:#16a34a;
                                color:white;
                                font-weight:bold;
                            "
                            onclick="
                                openMockTest(
                                    '${escapeAttribute(
                                        test.testName
                                    )}',
                                    '${escapeAttribute(
                                        test.sessionId
                                    )}'
                                )
                            "
                        >
                            ▶️ Start Test
                        </button>

                    </div>

                `;

            }
        ).join("");

}


// =====================================================
// OPEN MOCK TEST
// =====================================================

window.openMockTest =
    function (
        testName,
        sessionId
    ) {

        // ===============================================
        // SAVE TEST NAME
        // ===============================================

        localStorage.setItem(
            "selectedMockTest",
            testName || ""
        );


        // ===============================================
        // SAVE SESSION ID
        // ===============================================

        if (sessionId) {

            localStorage.setItem(
                "selectedMockSession",
                sessionId
            );

        } else {

            localStorage.removeItem(
                "selectedMockSession"
            );

        }


        // ===============================================
        // OPEN TEST
        // ===============================================

        window.location.href =
            "mock-test.html";

    };


// =====================================================
// OPEN PROFILE
// =====================================================

window.openProfile =
    function () {

        hideAllSections();


        const section =
            document.getElementById(
                "profileSection"
            );


        if (section) {

            section.classList.add(
                "active"
            );

        }

    };


// =====================================================
// OPEN DOWNLOADS
// =====================================================

window.openDownloads =
    function () {

        hideAllSections();


        const section =
            document.getElementById(
                "downloadsSection"
            );


        if (section) {

            section.classList.add(
                "active"
            );

        }

    };


// =====================================================
// SHOW MAIN DASHBOARD
// =====================================================

window.showMainDashboard =
    function () {

        hideAllSections();


        const dashboard =
            document.getElementById(
                "mainDashboard"
            );


        if (dashboard) {

            dashboard.style.display =
                "grid";

        }

    };


// =====================================================
// HIDE ALL SECTIONS
// =====================================================

function hideAllSections() {

    const sections =
        document.querySelectorAll(
            ".section"
        );


    sections.forEach(
        function (section) {

            section.classList.remove(
                "active"
            );

        }
    );


    const dashboard =
        document.getElementById(
            "mainDashboard"
        );


    if (dashboard) {

        dashboard.style.display =
            "none";

    }

}


// =====================================================
// LOGOUT
// =====================================================

window.studentLogout =
    async function () {

        try {

            await signOut(
                auth
            );

        } catch (error) {

            console.error(
                "Logout Error:",
                error
            );

        }


        localStorage.removeItem(
            "studentLoggedIn"
        );


        localStorage.removeItem(
            "studentUser"
        );


        localStorage.removeItem(
            "selectedCourseId"
        );


        localStorage.removeItem(
            "selectedMockTest"
        );


        localStorage.removeItem(
            "selectedMockSession"
        );


        window.location.href =
            "login.html";

    };


// =====================================================
// LOCAL STORAGE ARRAY
// =====================================================

function getLocalArray(key) {

    try {

        const data =
            JSON.parse(
                localStorage.getItem(
                    key
                ) || "[]"
            );


        return Array.isArray(
            data
        )
            ? data
            : [];

    } catch (error) {

        return [];

    }

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(value) {

    return String(
        value ?? ""
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// =====================================================
// ESCAPE ATTRIBUTE
// =====================================================

function escapeAttribute(value) {

    return String(
        value ?? ""
    )
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /'/g,
            "\\'"
        )
        .replace(
            /"/g,
            "&quot;"
        );

}