// =====================================================
// SSC EXAMS - FINAL SCRIPT.JS
// STUDENT + ADMIN + COURSE + MOCK TEST
// =====================================================

const defaultCourses = [
    {
        id: 1,
        name: "SSC FOUNDATION",
        exam: "SSC",
        subjects: [
            {
                name: "MATHEMATICS",
                chapters: [
                    {
                        name: "PERCENTAGE",
                        contents: [
                            {
                                type: "video",
                                title: "Percentage Class 01",
                                url: "https://www.youtube.com/"
                            },
                            {
                                type: "pdf",
                                title: "Percentage ClassRoom Sheet 01",
                                url: "#"
                            },
                            {
                                type: "pdf",
                                title: "Percentage Class Notes 01",
                                url: "#"
                            }
                        ]
                    },
                    { name: "DISCOUNT", contents: [] },
                    { name: "HCF & LCM", contents: [] },
                    { name: "PROFIT & LOSS", contents: [] },
                    { name: "SIMPLE INTEREST", contents: [] },
                    { name: "COMPOUND INTEREST", contents: [] }
                ]
            }
        ]
    }
];


// =====================================================
// GENERAL HELPERS
// =====================================================

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeJS(value) {
    return String(value ?? "")
        .replace(/\\/g, "\\\\")
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"')
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "");
}

function getStoredJSON(key, fallback) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : fallback;
    } catch (error) {
        console.error("Storage error:", key, error);
        return fallback;
    }
}


// =====================================================
// COURSE DATA
// =====================================================

let savedCourses = getStoredJSON("ssc_courses", []);

const courses =
    Array.isArray(savedCourses) && savedCourses.length
        ? savedCourses
        : JSON.parse(JSON.stringify(defaultCourses));


function saveCourses() {
    localStorage.setItem(
        "ssc_courses",
        JSON.stringify(courses)
    );
}

if (!localStorage.getItem("ssc_courses")) {
    saveCourses();
}


// =====================================================
// COURSE OPEN
// =====================================================

function openCourse(courseId) {

    const course = courses.find(
        c => Number(c.id) === Number(courseId)
    );

    if (!course) {
        alert("Course नहीं मिला।");
        return;
    }

    const subjects = course.subjects || [];

    document.body.innerHTML = `
        <header class="top-header">
            <div class="menu" onclick="location.reload()">←</div>

            <div class="app-name">
                ${escapeHTML(course.name)}
            </div>

            <div>🔔</div>
        </header>

        <main>

            <h2>📚 ${escapeHTML(course.name)}</h2>

            ${
                subjects.length === 0
                    ? `
                        <div class="admin-box">
                            अभी कोई Subject उपलब्ध नहीं है।
                        </div>
                    `
                    : subjects.map((subject, subjectIndex) => {

                        const chapters =
                            subject.chapters || [];

                        return `
                            <section>

                                <h3
                                    style="
                                        margin:20px 0 10px;
                                        color:#08a6c7;
                                    "
                                >
                                    📘 ${escapeHTML(subject.name)}
                                </h3>

                                ${
                                    chapters.length === 0
                                        ? `
                                            <p>
                                                अभी कोई Chapter नहीं है।
                                            </p>
                                        `
                                        : chapters.map(
                                            (chapter, chapterIndex) => `
                                                <div
                                                    onclick="
                                                        openChapter(
                                                            ${Number(course.id)},
                                                            ${subjectIndex},
                                                            ${chapterIndex}
                                                        )
                                                    "
                                                    style="
                                                        background:white;
                                                        padding:18px;
                                                        margin:10px 0;
                                                        border-radius:12px;
                                                        box-shadow:0 2px 8px #0001;
                                                        cursor:pointer;
                                                    "
                                                >
                                                    📖
                                                    <b>
                                                        ${escapeHTML(chapter.name)}
                                                    </b>

                                                    <span
                                                        style="
                                                            float:right;
                                                            color:#08a6c7;
                                                        "
                                                    >
                                                        ›
                                                    </span>
                                                </div>
                                            `
                                        ).join("")
                                }

                            </section>
                        `;
                    }).join("")
            }

        </main>
    `;
}


// =====================================================
// OPEN CHAPTER
// =====================================================

function openChapter(
    courseId,
    subjectIndex,
    chapterIndex
) {

    const course = courses.find(
        c => Number(c.id) === Number(courseId)
    );

    if (!course) return;

    const subject =
        course.subjects?.[subjectIndex];

    if (!subject) return;

    const chapter =
        subject.chapters?.[chapterIndex];

    if (!chapter) return;

    const contents =
        chapter.contents || [];

    document.body.innerHTML = `
        <header class="top-header">

            <div
                class="menu"
                onclick="openCourse(${Number(course.id)})"
            >
                ←
            </div>

            <div class="app-name">
                ${escapeHTML(chapter.name)}
            </div>

            <div>🔔</div>

        </header>

        <main>

            <h2>
                📖 ${escapeHTML(chapter.name)}
            </h2>

            ${
                contents.length === 0
                    ? `
                        <div class="admin-box">
                            अभी कोई Video/PDF उपलब्ध नहीं है।
                        </div>
                    `
                    : contents.map(content => {

                        const type =
                            content.type === "video"
                                ? "🎥"
                                : "📄";

                        return `
                            <div
                                style="
                                    background:white;
                                    padding:16px;
                                    margin:12px 0;
                                    border-radius:12px;
                                    box-shadow:0 2px 8px #0001;
                                "
                            >

                                <h3>
                                    ${type}
                                    ${escapeHTML(content.title)}
                                </h3>

                                ${
                                    content.type === "video"
                                        ? `
                                            <button
                                                class="view-course"
                                                onclick="
                                                    openVideo(
                                                        '${escapeJS(content.url)}'
                                                    )
                                                "
                                            >
                                                ▶ Watch
                                            </button>
                                        `
                                        : `
                                            <button
                                                class="view-course"
                                                onclick="
                                                    window.open(
                                                        '${escapeJS(content.url)}',
                                                        '_blank'
                                                    )
                                                "
                                            >
                                                📄 View PDF
                                            </button>
                                        `
                                }

                            </div>
                        `;
                    }).join("")
            }

        </main>
    `;
}


// =====================================================
// VIDEO
// =====================================================

function openVideo(url) {

    if (!url) {
        alert("Video URL नहीं मिला।");
        return;
    }

    // Videos are playback-only. Do not expose a download link/button.
    const old = document.getElementById("theHubVideoViewer");
    if (old) old.remove();

    const overlay = document.createElement("div");
    overlay.id = "theHubVideoViewer";
    overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,.94);z-index:99999;" +
        "display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;";

    const box = document.createElement("div");
    box.style.cssText =
        "width:min(1000px,100%);position:relative;background:#000;border-radius:14px;" +
        "overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.5);";

    const close = document.createElement("button");
    close.type = "button";
    close.textContent = "✕ Close";
    close.style.cssText =
        "position:absolute;right:10px;top:10px;z-index:3;border:0;border-radius:8px;" +
        "padding:8px 12px;background:rgba(0,0,0,.75);color:#fff;cursor:pointer;font-weight:bold;";
    close.onclick = () => overlay.remove();

    const lower = String(url).toLowerCase();
    const isYouTube =
        lower.includes("youtube.com/watch") ||
        lower.includes("youtu.be/") ||
        lower.includes("youtube.com/embed");

    if (isYouTube) {
        let embedURL = url;

        try {
            const parsed = new URL(url);
            if (parsed.hostname.includes("youtu.be")) {
                embedURL = "https://www.youtube.com/embed/" +
                    parsed.pathname.replace("/", "") +
                    "?rel=0&modestbranding=1";
            } else if (parsed.pathname === "/watch") {
                const videoId = parsed.searchParams.get("v");
                if (videoId) {
                    embedURL = "https://www.youtube.com/embed/" +
                        videoId +
                        "?rel=0&modestbranding=1";
                }
            }
        } catch (e) {}

        const iframe = document.createElement("iframe");
        iframe.src = embedURL;
        iframe.title = "Course Video";
        iframe.allow =
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        iframe.allowFullscreen = true;
        iframe.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
        iframe.style.cssText =
            "display:block;width:100%;aspect-ratio:16/9;border:0;";
        box.appendChild(iframe);

    } else {
        const video = document.createElement("video");
        video.src = url;
        video.controls = true;
        video.playsInline = true;
        video.preload = "metadata";
        video.setAttribute("controlsList", "nodownload noplaybackrate");
        video.setAttribute("disablePictureInPicture", "");
        video.oncontextmenu = e => e.preventDefault();
        video.style.cssText =
            "display:block;width:100%;max-height:80vh;background:#000;";
        box.appendChild(video);

        // Direct video files keep the app's download option.
        const downloadBtn = document.createElement("a");
        downloadBtn.href = url;
        downloadBtn.download = "";
        downloadBtn.target = "_blank";
        downloadBtn.rel = "noopener noreferrer";
        downloadBtn.textContent = "⬇️ Download Video";
        downloadBtn.style.cssText =
            "display:inline-block;margin:10px;padding:9px 14px;border-radius:8px;" +
            "background:#2563eb;color:#fff;text-decoration:none;font-weight:bold;";
        box.appendChild(downloadBtn);
    }

    box.appendChild(close);
    overlay.appendChild(box);

    overlay.onclick = event => {
        if (event.target === overlay) overlay.remove();
    };

    document.body.appendChild(overlay);
}


// =====================================================
// ADMIN PANEL
// =====================================================

function showAdminPanel() {

    const admin =
        document.getElementById("adminPanel");

    const mockPanel =
        document.getElementById("mockTestSection");

    if (admin) {
        admin.style.display = "block";
    }

    if (mockPanel) {
        mockPanel.style.display = "block";
    }

    loadAdminCourses();
    showAdminContent();
    loadMockExamNames();
    loadMockAdminTests();

    window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth"
    });
}


// =====================================================
// ADMIN COURSE SELECT
// =====================================================

function loadAdminCourses() {

    const select =
        document.getElementById(
            "adminCourseSelect"
        );

    if (!select) return;

    const oldValue = select.value;

    select.innerHTML =
        `<option value="">Select Course</option>`;

    courses.forEach(course => {

        select.innerHTML += `
            <option value="${Number(course.id)}">
                ${escapeHTML(course.name)}
            </option>
        `;

    });

    if (
        [...select.options]
            .some(option => option.value === oldValue)
    ) {
        select.value = oldValue;
    }

    loadAdminSubjects();
}


// =====================================================
// ADMIN DROPDOWN CHANGE
// =====================================================

document.addEventListener(
    "change",
    function(event) {

        if (
            event.target.id ===
            "adminCourseSelect"
        ) {
            loadAdminSubjects();
        }

        if (
            event.target.id ===
            "adminSubjectSelect"
        ) {
            loadAdminChapters();
        }

        if (
            event.target.id ===
            "mockCategory"
        ) {
            loadMockExamNames();
        }
    }
);


// =====================================================
// ADD COURSE
// =====================================================

function addAdminCourse() {

    const nameElement =
        document.getElementById("adminCourse");

    const examElement =
        document.getElementById("adminExam");

    if (!nameElement) return;

    const name =
        nameElement.value.trim();

    const exam =
        examElement?.value.trim() || "SSC";

    if (!name) {
        alert("Course Name डालो");
        return;
    }

    courses.push({
        id: Date.now(),
        name,
        exam,
        subjects: []
    });

    nameElement.value = "";

    if (examElement) {
        examElement.value = "";
    }

    saveCourses();

    loadAdminCourses();
    showStudentCourses();

    alert("✅ Course Successfully Added");
}


// =====================================================
// ADD SUBJECT
// =====================================================

function addAdminSubject() {

    const courseSelect =
        document.getElementById(
            "adminCourseSelect"
        );

    const subjectElement =
        document.getElementById(
            "adminSubject"
        );

    if (!courseSelect || !subjectElement) return;

    const courseId =
        Number(courseSelect.value);

    const subjectName =
        subjectElement.value.trim();

    if (!courseId) {
        alert("पहले Course select करो");
        return;
    }

    if (!subjectName) {
        alert("Subject Name डालो");
        return;
    }

    const course =
        courses.find(
            c => Number(c.id) === courseId
        );

    if (!course) return;

    if (!course.subjects) {
        course.subjects = [];
    }

    course.subjects.push({
        name: subjectName,
        chapters: []
    });

    subjectElement.value = "";

    saveCourses();

    loadAdminSubjects();

    alert("✅ Subject Successfully Added");
}


// =====================================================
// LOAD SUBJECTS
// =====================================================

function loadAdminSubjects() {

    const courseSelect =
        document.getElementById(
            "adminCourseSelect"
        );

    const subjectSelect =
        document.getElementById(
            "adminSubjectSelect"
        );

    if (!subjectSelect) return;

    const courseId =
        Number(courseSelect?.value || 0);

    subjectSelect.innerHTML =
        `<option value="">Select Subject</option>`;

    const course =
        courses.find(
            c => Number(c.id) === courseId
        );

    if (!course) {
        loadAdminChapters();
        return;
    }

    (course.subjects || []).forEach(
        (subject, index) => {

            subjectSelect.innerHTML += `
                <option value="${index}">
                    ${escapeHTML(subject.name)}
                </option>
            `;
        }
    );

    loadAdminChapters();
}


// =====================================================
// ADD CHAPTER
// =====================================================

function addAdminChapter() {

    const courseSelect =
        document.getElementById(
            "adminCourseSelect"
        );

    const subjectSelect =
        document.getElementById(
            "adminSubjectSelect"
        );

    const chapterElement =
        document.getElementById(
            "adminChapter"
        );

    if (
        !courseSelect ||
        !subjectSelect ||
        !chapterElement
    ) return;

    const courseId =
        Number(courseSelect.value);

    const subjectValue =
        subjectSelect.value;

    const chapterName =
        chapterElement.value.trim();

    if (!courseId) {
        alert("Course select करो");
        return;
    }

    if (subjectValue === "") {
        alert("Subject select करो");
        return;
    }

    if (!chapterName) {
        alert("Chapter Name डालो");
        return;
    }

    const course =
        courses.find(
            c => Number(c.id) === courseId
        );

    if (!course) return;

    const subject =
        course.subjects?.[
            Number(subjectValue)
        ];

    if (!subject) {
        alert("Subject नहीं मिला।");
        return;
    }

    if (!subject.chapters) {
        subject.chapters = [];
    }

    subject.chapters.push({
        name: chapterName,
        contents: []
    });

    chapterElement.value = "";

    saveCourses();

    loadAdminChapters();

    alert("✅ Chapter Successfully Added");
}


// =====================================================
// LOAD CHAPTERS
// =====================================================

function loadAdminChapters() {

    const courseSelect =
        document.getElementById(
            "adminCourseSelect"
        );

    const subjectSelect =
        document.getElementById(
            "adminSubjectSelect"
        );

    const chapterSelect =
        document.getElementById(
            "adminChapterSelect"
        );

    if (!chapterSelect) return;

    const courseId =
        Number(courseSelect?.value || 0);

    const subjectValue =
        subjectSelect?.value ?? "";

    chapterSelect.innerHTML =
        `<option value="">Select Chapter</option>`;

    if (
        !courseId ||
        subjectValue === ""
    ) return;

    const course =
        courses.find(
            c => Number(c.id) === courseId
        );

    if (!course) return;

    const subject =
        course.subjects?.[
            Number(subjectValue)
        ];

    if (!subject) return;

    (subject.chapters || []).forEach(
        (chapter, index) => {

            chapterSelect.innerHTML += `
                <option value="${index}">
                    ${escapeHTML(chapter.name)}
                </option>
            `;

        }
    );
}


// =====================================================
// ADD VIDEO / PDF
// =====================================================

function addAdminContent() {

    const courseSelect =
        document.getElementById(
            "adminCourseSelect"
        );

    const subjectSelect =
        document.getElementById(
            "adminSubjectSelect"
        );

    const chapterSelect =
        document.getElementById(
            "adminChapterSelect"
        );

    const titleElement =
        document.getElementById(
            "contentTitle"
        );

    const typeElement =
        document.getElementById(
            "contentType"
        );

    const urlElement =
        document.getElementById(
            "contentURL"
        );

    if (
        !courseSelect ||
        !subjectSelect ||
        !chapterSelect ||
        !titleElement ||
        !typeElement ||
        !urlElement
    ) return;

    const courseId =
        Number(courseSelect.value);

    const subjectValue =
        subjectSelect.value;

    const chapterValue =
        chapterSelect.value;

    const title =
        titleElement.value.trim();

    const type =
        typeElement.value;

    const url =
        urlElement.value.trim();

    if (!courseId) {
        alert("Course select करो");
        return;
    }

    if (subjectValue === "") {
        alert("Subject select करो");
        return;
    }

    if (chapterValue === "") {
        alert("Chapter select करो");
        return;
    }

    if (!title || !url) {
        alert("Title और URL दोनों डालो");
        return;
    }

    const course =
        courses.find(
            c => Number(c.id) === courseId
        );

    const subject =
        course?.subjects?.[
            Number(subjectValue)
        ];

    const chapter =
        subject?.chapters?.[
            Number(chapterValue)
        ];

    if (!chapter) {
        alert("Chapter नहीं मिला।");
        return;
    }

    if (!chapter.contents) {
        chapter.contents = [];
    }

    chapter.contents.push({
        type,
        title,
        url
    });

    titleElement.value = "";
    urlElement.value = "";

    saveCourses();

    showAdminContent();

    alert("✅ Video / PDF Successfully Added");
}


// =====================================================
// SHOW ADMIN CONTENT
// =====================================================

function showAdminContent() {

    const list =
        document.getElementById(
            "adminList"
        );

    if (!list) return;

    let html = "";

    courses.forEach(course => {

        (course.subjects || []).forEach(subject => {

            (subject.chapters || []).forEach(chapter => {

                (chapter.contents || []).forEach(content => {

                    html += `
                        <div class="admin-item">

                            <b>
                                ${escapeHTML(course.name)}
                            </b>

                            <br>

                            📘
                            ${escapeHTML(subject.name)}

                            <br>

                            📖
                            ${escapeHTML(chapter.name)}

                            <br>

                            ${
                                content.type === "video"
                                    ? "🎥 Video"
                                    : "📄 PDF"
                            }

                            :
                            ${escapeHTML(content.title)}

                        </div>
                    `;

                });

            });

        });

    });

    list.innerHTML =
        html ||
        "<p>अभी कोई content नहीं है।</p>";
}


// =====================================================
// STUDENT COURSES
// =====================================================

function showStudentCourses() {

    const container =
        document.getElementById(
            "studentCourses"
        );

    if (!container) return;

    container.innerHTML = "";

    if (!courses.length) {

        container.innerHTML =
            "<p>अभी कोई Course उपलब्ध नहीं है।</p>";

        return;
    }

    courses.forEach(course => {

        container.innerHTML += `
            <div class="course-card">

                <div class="course-image">

                    📚

                    <h2>
                        ${escapeHTML(course.name)}
                    </h2>

                </div>

                <div class="course-info">

                    <h3>
                        ${escapeHTML(course.name)}
                    </h3>

                    <p>
                        Exam:
                        ${escapeHTML(course.exam || "SSC")}
                    </p>

                    <button
                        class="view-course"
                        onclick="
                            openCourse(${Number(course.id)})
                        "
                    >
                        View Course
                    </button>

                </div>

            </div>
        `;
    });
}


// =====================================================
// MOCK EXAM DATA
// =====================================================

let mockExamData =
    getStoredJSON(
        "mockExamData",
        {
            SSC: [
                "SSC CGL",
                "SSC CHSL",
                "SSC MTS",
                "SSC GD"
            ],

            Railway: [
                "RRB NTPC",
                "RRB Group D",
                "RRB ALP",
                "RRB Technician"
            ],

            "State Exams": [
                "10th",
                "12th",
                "Arts",
                "Science",
                "Math"
            ]
        }
    );


// =====================================================
// MOCK VARIABLES
// =====================================================

let activeMockTest = null;

let currentQuestionIndex = 0;

let mockTimerInterval = null;

let mockStartTime = 0;

let questionStartTime = 0;

let adminMockQuestions = [];


// =====================================================
// MOCK EXAM NAMES
// =====================================================

function loadMockExamNames() {

    const category =
        document.getElementById(
            "mockCategory"
        );

    const examSelect =
        document.getElementById(
            "mockExamName"
        );

    if (!category || !examSelect) return;

    examSelect.innerHTML =
        `<option value="">Select Exam</option>`;

    const exams =
        mockExamData[category.value] || [];

    exams.forEach(exam => {

        examSelect.innerHTML += `
            <option value="${escapeHTML(exam)}">
                ${escapeHTML(exam)}
            </option>
        `;

    });
}


// =====================================================
// ADD EXAM
// =====================================================

function addMockExamName() {

    const category =
        document.getElementById(
            "mockCategory"
        )?.value;

    const input =
        document.getElementById(
            "newMockExamName"
        );

    if (!category) {
        alert("पहले Exam Category select करो।");
        return;
    }

    const examName =
        input?.value.trim();

    if (!examName) {
        alert("New Exam Name डालो।");
        return;
    }

    if (!mockExamData[category]) {
        mockExamData[category] = [];
    }

    if (
        mockExamData[category]
            .includes(examName)
    ) {
        alert("यह Exam पहले से मौजूद है।");
        return;
    }

    mockExamData[category].push(examName);

    localStorage.setItem(
        "mockExamData",
        JSON.stringify(mockExamData)
    );

    input.value = "";

    loadMockExamNames();

    alert(
        "✅ " +
        examName +
        " Successfully Added!"
    );
}


// =====================================================
// DELETE EXAM
// =====================================================

function deleteMockExamName() {

    const category =
        document.getElementById(
            "mockCategory"
        )?.value;

    const examSelect =
        document.getElementById(
            "mockExamName"
        );

    if (!category) {
        alert("पहले Category select करो।");
        return;
    }

    const examName =
        examSelect?.value;

    if (!examName) {
        alert("पहले Exam select करो।");
        return;
    }

    if (
        !confirm(
            examName +
            " delete करना है?"
        )
    ) {
        return;
    }

    mockExamData[category] =
        (mockExamData[category] || [])
            .filter(
                exam => exam !== examName
            );

    localStorage.setItem(
        "mockExamData",
        JSON.stringify(mockExamData)
    );

    loadMockExamNames();

    alert("🗑️ Exam Deleted Successfully!");
}


// =====================================================
// ADD MOCK QUESTION
// =====================================================

function addDynamicMockQuestion() {

    const category =
        document.getElementById(
            "mockCategory"
        )?.value;

    const exam =
        document.getElementById(
            "mockExamName"
        )?.value;

    const testType =
        document.getElementById(
            "mockTestType"
        )?.value;

    const testName =
        document.getElementById(
            "mockTestName"
        )?.value.trim();

    const subject =
        document.getElementById(
            "mockSubject"
        )?.value.trim();

    const chapter =
        document.getElementById(
            "mockChapter"
        )?.value.trim();

    const time =
        Number(
            document.getElementById(
                "mockTestTime"
            )?.value
        );

    const question =
        document.getElementById(
            "mockQuestion"
        )?.value.trim();

    const options = [
        document.getElementById("mockOptionA")?.value.trim(),
        document.getElementById("mockOptionB")?.value.trim(),
        document.getElementById("mockOptionC")?.value.trim(),
        document.getElementById("mockOptionD")?.value.trim()
    ];

    const correctAnswer =
        document.getElementById(
            "mockCorrectAnswer"
        )?.value;

    const solution =
        document.getElementById(
            "mockSolution"
        )?.value.trim();

    if (!category) {
        alert("Exam Category select करो।");
        return;
    }

    if (!exam) {
        alert("Exam Name select करो।");
        return;
    }

    if (!testType) {
        alert("Test Type select करो।");
        return;
    }

    if (!testName) {
        alert("Test Name डालो।");
        return;
    }

    if (!time || time < 1) {
        alert("Test Time डालो।");
        return;
    }

    if (!question) {
        alert("Question डालो।");
        return;
    }

    if (options.some(option => !option)) {
        alert("चारों Options डालो।");
        return;
    }

    if (correctAnswer === "") {
        alert("Correct Answer select करो।");
        return;
    }

    adminMockQuestions.push({

        question,

        options,

        correctAnswer:
            Number(correctAnswer),

        solution: solution || "",

        subject: subject || "",

        chapter: chapter || ""

    });

    renderAdminMockQuestions();

    document.getElementById(
        "mockQuestion"
    ).value = "";

    [
        "mockOptionA",
        "mockOptionB",
        "mockOptionC",
        "mockOptionD",
        "mockSolution"
    ].forEach(id => {

        const element =
            document.getElementById(id);

        if (element) {
            element.value = "";
        }

    });

    alert(
        "✅ Question Added. अब अगला Question डाल सकते हो।"
    );
}


// =====================================================
// RENDER CURRENT QUESTIONS
// =====================================================

function renderAdminMockQuestions() {

    const list =
        document.getElementById(
            "dynamicMockQuestionList"
        );

    if (!list) return;

    if (!adminMockQuestions.length) {

        list.innerHTML =
            "<p>अभी कोई Current Question नहीं है।</p>";

        return;
    }

    list.innerHTML = `
        <h3>📝 Current Questions</h3>

        ${
            adminMockQuestions.map(
                (question, index) => `

                    <div
                        style="
                            background:white;
                            padding:15px;
                            margin:10px 0;
                            border-radius:12px;
                        "
                    >

                        <b>
                            Q${index + 1}.
                        </b>

                        ${escapeHTML(question.question)}

                        <br><br>

                        A. ${escapeHTML(question.options[0])}
                        <br>

                        B. ${escapeHTML(question.options[1])}
                        <br>

                        C. ${escapeHTML(question.options[2])}
                        <br>

                        D. ${escapeHTML(question.options[3])}

                        <br><br>

                        <b>
                            Correct:
                            ${String.fromCharCode(
                                65 +
                                Number(question.correctAnswer)
                            )}
                        </b>

                    </div>
                `
            ).join("")
        }
    `;
}


// =====================================================
// SAVE COMPLETE MOCK TEST
// =====================================================

function saveDynamicMockTest() {

    const category =
        document.getElementById(
            "mockCategory"
        )?.value;

    const exam =
        document.getElementById(
            "mockExamName"
        )?.value;

    const testType =
        document.getElementById(
            "mockTestType"
        )?.value;

    const testName =
        document.getElementById(
            "mockTestName"
        )?.value.trim();

    const subject =
        document.getElementById(
            "mockSubject"
        )?.value.trim();

    const chapter =
        document.getElementById(
            "mockChapter"
        )?.value.trim();

    const time =
        Number(
            document.getElementById(
                "mockTestTime"
            )?.value
        );

    if (!category) {
        alert("Category select करो।");
        return;
    }

    if (!exam) {
        alert("Exam select करो।");
        return;
    }

    if (!testType) {
        alert("Test Type select करो।");
        return;
    }

    if (!testName) {
        alert("Test Name डालो।");
        return;
    }

    if (!time || time < 1) {
        alert("Test Time डालो।");
        return;
    }

    if (!adminMockQuestions.length) {
        alert("कम से कम एक Question add करो।");
        return;
    }

    const savedTests =
        getStoredJSON("mockTests", []);

    const newTest = {

        id: Date.now(),

        category,

        exam,

        testType,

        testName,

        subject: subject || "",

        chapter: chapter || "",

        time,

        questions:
            JSON.parse(
                JSON.stringify(
                    adminMockQuestions
                )
            )

    };

    savedTests.push(newTest);

    localStorage.setItem(
        "mockTests",
        JSON.stringify(savedTests)
    );

    adminMockQuestions = [];

    renderAdminMockQuestions();

    loadMockAdminTests();

    alert(
        "✅ पूरा Mock Test Successfully Saved!"
    );
}


// =====================================================
// LOAD SAVED MOCK TESTS
// =====================================================

function loadMockAdminTests() {

    const container =
        document.getElementById(
            "dynamicMockQuestionList"
        );

    if (!container) return;

    const tests =
        getStoredJSON("mockTests", []);

    let html = "";

    if (tests.length) {

        html += `
            <h3 style="margin-top:20px;">
                💾 Saved Mock Tests
            </h3>
        `;

        tests.forEach((test, index) => {

            html += `
                <div
                    style="
                        background:white;
                        padding:15px;
                        margin:10px 0;
                        border-radius:12px;
                        box-shadow:0 2px 8px #0001;
                    "
                >

                    <b>
                        ${escapeHTML(test.testName)}
                    </b>

                    <br>

                    ${escapeHTML(test.exam)}
                    •
                    ${escapeHTML(test.testType)}

                    <br>

                    ${test.questions?.length || 0}
                    Questions
                    •
                    ${test.time || 0}
                    Minutes

                    <br><br>

                    <button
                        onclick="
                            deleteMockTest(${index})
                        "
                        style="
                            background:#e53935;
                        "
                    >
                        🗑️ Delete Test
                    </button>

                </div>
            `;

        });

    }

    if (adminMockQuestions.length) {

        html += `
            <h3>
                📝 Current Questions
            </h3>
        `;

        html += adminMockQuestions.map(
            (question, index) => `
                <div
                    style="
                        background:white;
                        padding:15px;
                        margin:10px 0;
                        border-radius:12px;
                    "
                >
                    Q${index + 1}.
                    ${escapeHTML(question.question)}
                </div>
            `
        ).join("");
    }

    container.innerHTML =
        html ||
        "<p>अभी कोई Mock Test नहीं है।</p>";
}


// =====================================================
// DELETE MOCK TEST
// =====================================================

function deleteMockTest(index) {

    const tests =
        getStoredJSON(
            "mockTests",
            []
        );

    const test =
        tests[index];

    if (!test) return;

    if (
        !confirm(
            test.testName +
            " delete करना है?"
        )
    ) {
        return;
    }

    tests.splice(index, 1);

    localStorage.setItem(
        "mockTests",
        JSON.stringify(tests)
    );

    loadMockAdminTests();

    alert("🗑️ Test Deleted Successfully!");
}


// =====================================================
// STUDENT MOCK DASHBOARD
// =====================================================

function openStudentMockTests() {

    const savedTests =
        getStoredJSON(
            "mockTests",
            []
        );

    const exams = [
        ...new Set(
            savedTests
                .map(test => test.exam)
                .filter(Boolean)
        )
    ];

    if (!exams.length) {

        alert(
            "अभी कोई Mock Test उपलब्ध नहीं है।"
        );

        return;
    }

    document.body.innerHTML = `

        <header class="top-header">

            <div
                class="menu"
                onclick="location.reload()"
            >
                ←
            </div>

            <div class="app-name">
                📚 Test Pass
            </div>

            <div>📝</div>

        </header>

        <main>

            <h2>
                📝 Select Exam
            </h2>

            ${
                exams.map(
                    exam => `

                        <div
                            class="mock-type-card"
                            onclick="
                                openMockTests(
                                    '${escapeJS(exam)}'
                                )
                            "
                            style="
                                background:white;
                                padding:18px;
                                margin:12px 0;
                                border-radius:12px;
                                box-shadow:0 2px 8px #0001;
                                cursor:pointer;
                            "
                        >

                            📚

                            <b>
                                ${escapeHTML(exam)}
                            </b>

                            <span
                                style="
                                    float:right;
                                    color:#08a6c7;
                                "
                            >
                                ›
                            </span>

                        </div>
                    `
                ).join("")
            }

        </main>
    `;
}


// =====================================================
// MOCK TEST TYPES
// =====================================================

function openMockTests(exam) {

    document.body.innerHTML = `

        <header class="top-header">

            <div
                class="menu"
                onclick="openStudentMockTests()"
            >
                ←
            </div>

            <div class="app-name">
                ${escapeHTML(exam)} Mock Test
            </div>

            <div>📝</div>

        </header>

        <main>

            <h2>
                📝 ${escapeHTML(exam)} Mock Test
            </h2>

            ${[
                ["Chapter", "📖", "Chapter Test"],
                ["Sectional", "📚", "Sectional Test"],
                ["Full", "📝", "Full Test"],
                ["PYQ", "📜", "PYQ Test"]
            ].map(
                item => `
                    <div
                        class="mock-type-card"
                        onclick="
                            selectMockType(
                                '${escapeJS(exam)}',
                                '${item[0]}'
                            )
                        "
                        style="
                            background:white;
                            padding:18px;
                            margin:12px 0;
                            border-radius:12px;
                            box-shadow:0 2px 8px #0001;
                            cursor:pointer;
                        "
                    >

                        ${item[1]}

                        <b>
                            ${item[2]}
                        </b>

                        <span style="float:right;">
                            ›
                        </span>

                    </div>
                `
            ).join("")}

        </main>
    `;
}


// =====================================================
// SELECT MOCK TYPE
// =====================================================

function selectMockType(
    exam,
    testType
) {

    const savedTests =
        getStoredJSON(
            "mockTests",
            []
        );

    const tests =
        savedTests.filter(
            test =>
                test.exam === exam &&
                test.testType === testType
        );

    window.currentStudentMockTests =
        tests;

    document.body.innerHTML = `

        <header class="top-header">

            <div
                class="menu"
                onclick="
                    openMockTests(
                        '${escapeJS(exam)}'
                    )
                "
            >
                ←
            </div>

            <div class="app-name">
                ${escapeHTML(exam)}
                -
                ${escapeHTML(testType)}
            </div>

            <div>📝</div>

        </header>

        <main>

            <h2>
                ${escapeHTML(testType)} Tests
            </h2>

            ${
                !tests.length

                    ? `
                        <div class="admin-box">
                            अभी कोई
                            ${escapeHTML(testType)}
                            उपलब्ध नहीं है।
                        </div>
                    `

                    : tests.map(
                        (test, index) => `

                            <div
                                class="mock-type-card"
                                onclick="
                                    prepareMockTest(${index})
                                "
                                style="
                                    background:white;
                                    padding:18px;
                                    margin:12px 0;
                                    border-radius:12px;
                                    box-shadow:0 2px 8px #0001;
                                    cursor:pointer;
                                "
                            >

                                <div>

                                    📝

                                    <b>
                                        ${
                                            escapeHTML(
                                                test.testName ||
                                                "Test " +
                                                (index + 1)
                                            )
                                        }
                                    </b>

                                    <br>

                                    <small>

                                        ${
                                            test.questions?.length || 0
                                        }
                                        Questions

                                        •

                                        ${
                                            test.time || 0
                                        }
                                        Minutes

                                    </small>

                                </div>

                                <span>
                                    ›
                                </span>

                            </div>
                        `
                    ).join("")
            }

        </main>
    `;
}


// =====================================================
// PREPARE TEST
// =====================================================

function prepareMockTest(index) {

    const tests =
        window.currentStudentMockTests || [];

    const test =
        tests[index];

    if (!test) {

        alert("Test नहीं मिला।");
        return;
    }

    startMockTest(test);
}


// =====================================================
// START TEST
// =====================================================

function startMockTest(test) {

    if (
        !test ||
        !test.questions ||
        !test.questions.length
    ) {

        alert(
            "इस Mock Test में अभी कोई Question नहीं है।"
        );

        return;
    }

    clearInterval(mockTimerInterval);

    activeMockTest =
        JSON.parse(
            JSON.stringify(test)
        );

    currentQuestionIndex = 0;

    activeMockTest.answers =
        new Array(
            activeMockTest.questions.length
        ).fill(null);

    activeMockTest.questionTimes =
        new Array(
            activeMockTest.questions.length
        ).fill(0);

    activeMockTest.totalTime =
        Math.max(
            1,
            Number(activeMockTest.time || 10)
        ) * 60;

    activeMockTest.remainingTime =
        activeMockTest.totalTime;

    mockStartTime =
        Date.now();

    questionStartTime =
        Date.now();

    showMockQuestion();

    startMockTimer();
}


// =====================================================
// TIMER
// =====================================================

function startMockTimer() {

    clearInterval(mockTimerInterval);

    updateMockTimer();

    mockTimerInterval =
        setInterval(() => {

            if (!activeMockTest) {

                clearInterval(
                    mockTimerInterval
                );

                return;
            }

            const elapsed =
                Math.floor(
                    (
                        Date.now() -
                        mockStartTime
                    ) / 1000
                );

            activeMockTest.remainingTime =
                activeMockTest.totalTime -
                elapsed;

            updateMockTimer();

            if (
                activeMockTest.remainingTime <= 0
            ) {

                clearInterval(
                    mockTimerInterval
                );

                finishMockTest(true);
            }

        }, 1000);
}


function updateMockTimer() {

    const timer =
        document.getElementById(
            "mockTimer"
        );

    if (!timer || !activeMockTest) return;

    let seconds =
        Math.max(
            0,
            activeMockTest.remainingTime
        );

    const minutes =
        Math.floor(seconds / 60);

    seconds %= 60;

    timer.innerText =
        "⏱️ Time Left: " +
        String(minutes).padStart(2, "0") +
        ":" +
        String(seconds).padStart(2, "0");
}


// =====================================================
// SHOW QUESTION
// =====================================================

function showMockQuestion() {

    if (!activeMockTest) return;

    const question =
        activeMockTest.questions[
            currentQuestionIndex
        ];

    if (!question) {

        finishMockTest(false);
        return;
    }

    document.body.innerHTML = `

        <header class="top-header">

            <div
                class="menu"
                onclick="confirmExitMockTest()"
            >
                ←
            </div>

            <div class="app-name">
                ${escapeHTML(
                    activeMockTest.testName ||
                    "Mock Test"
                )}
            </div>

            <div id="mockTimer">
                ⏱️ 00:00
            </div>

        </header>

        <main>

            <div
                style="
                    background:white;
                    padding:15px;
                    border-radius:12px;
                    margin-bottom:15px;
                "
            >
                <b>
                    Question
                    ${currentQuestionIndex + 1}
                    /
                    ${activeMockTest.questions.length}
                </b>
            </div>

            <div
                style="
                    background:white;
                    padding:20px;
                    border-radius:12px;
                    box-shadow:0 2px 8px #0001;
                "
            >

                <h3>
                    ${escapeHTML(question.question)}
                </h3>

                <div id="mockOptions">

                    ${
                        (question.options || [])
                            .map(
                                (option, index) => {

                                    const selected =
                                        Number(
                                            activeMockTest.answers[
                                                currentQuestionIndex
                                            ]
                                        ) === index;

                                    return `
                                        <button
                                            class="mock-option"
                                            onclick="
                                                selectMockAnswer(
                                                    ${index}
                                                )
                                            "
                                            style="
                                                width:100%;
                                                margin:7px 0;
                                                ${
                                                    selected
                                                        ? "background:#dff6ff;"
                                                        : ""
                                                }
                                            "
                                        >
                                            ${String.fromCharCode(
                                                65 + index
                                            )}.
                                            ${escapeHTML(option)}
                                        </button>
                                    `;
                                }
                            ).join("")
                    }

                </div>

                <div
                    style="
                        display:flex;
                        gap:10px;
                        margin-top:20px;
                    "
                >

                    <button
                        onclick="previousMockQuestion()"
                        style="flex:1;"
                    >
                        ← Previous
                    </button>

                    <button
                        onclick="nextMockQuestion()"
                        style="flex:1;"
                    >
                        ${
                            currentQuestionIndex ===
                            activeMockTest.questions.length - 1
                                ? "Submit Test"
                                : "Next →"
                        }
                    </button>

                </div>

                <button
                    onclick="finishMockTest(false)"
                    style="
                        width:100%;
                        margin-top:12px;
                        background:#e53935;
                    "
                >
                    📝 Submit Test
                </button>

            </div>

        </main>
    `;

    updateMockTimer();
}


// =====================================================
// SELECT ANSWER
// =====================================================

function selectMockAnswer(index) {

    if (!activeMockTest) return;

    activeMockTest.answers[
        currentQuestionIndex
    ] = index;

    showMockQuestion();
}


// =====================================================
// QUESTION TIME
// =====================================================

function saveCurrentQuestionTime() {

    if (!activeMockTest) return;

    const spent =
        Math.floor(
            (
                Date.now() -
                questionStartTime
            ) / 1000
        );

    activeMockTest.questionTimes[
        currentQuestionIndex
    ] += Math.max(0, spent);

    questionStartTime =
        Date.now();
}


// =====================================================
// NEXT
// =====================================================

function nextMockQuestion() {

    if (!activeMockTest) return;

    saveCurrentQuestionTime();

    if (
        currentQuestionIndex >=
        activeMockTest.questions.length - 1
    ) {

        finishMockTest(false);
        return;
    }

    currentQuestionIndex++;

    questionStartTime =
        Date.now();

    showMockQuestion();
}


// =====================================================
// PREVIOUS
// =====================================================

function previousMockQuestion() {

    if (!activeMockTest) return;

    if (currentQuestionIndex <= 0) return;

    saveCurrentQuestionTime();

    currentQuestionIndex--;

    questionStartTime =
        Date.now();

    showMockQuestion();
}


// =====================================================
// EXIT TEST
// =====================================================

function confirmExitMockTest() {

    if (!activeMockTest) {

        location.reload();
        return;
    }

    if (
        confirm(
            "Test छोड़ना है? आपका current test submit नहीं होगा।"
        )
    ) {

        clearInterval(
            mockTimerInterval
        );

        mockTimerInterval = null;

        activeMockTest = null;

        location.reload();
    }
}


// =====================================================
// FINISH TEST
// =====================================================

function finishMockTest(
    autoSubmit = false
) {

    if (!activeMockTest) return;

    saveCurrentQuestionTime();

    clearInterval(
        mockTimerInterval
    );

    mockTimerInterval = null;

    const questions =
        activeMockTest.questions;

    let correct = 0;
    let attempted = 0;

    questions.forEach(
        (question, index) => {

            const answer =
                activeMockTest.answers[index];

            if (
                answer !== null &&
                answer !== undefined
            ) {
                attempted++;
            }

            if (
                Number(answer) ===
                Number(question.correctAnswer)
            ) {
                correct++;
            }
        }
    );

    const wrong =
        attempted - correct;

    const unattempted =
        questions.length - attempted;

    const usedTime =
        activeMockTest.totalTime -
        Math.max(
            0,
            activeMockTest.remainingTime
        );

    showMockResult(
        correct,
        wrong,
        unattempted,
        attempted,
        usedTime,
        autoSubmit
    );
}


// =====================================================
// RESULT
// =====================================================

function showMockResult(
    correct,
    wrong,
    unattempted,
    attempted,
    usedTime,
    autoSubmit
) {

    if (!activeMockTest) return;

    const questions =
        activeMockTest.questions;

    const percentage =
        questions.length
            ? Math.round(
                (
                    correct /
                    questions.length
                ) * 100
            )
            : 0;

    const minutes =
        Math.floor(
            usedTime / 60
        );

    const seconds =
        usedTime % 60;

    document.body.innerHTML = `

        <header class="top-header">

            <div class="app-name">
                🏆 Test Result
            </div>

        </header>

        <main>

            <div
                style="
                    background:white;
                    padding:25px;
                    border-radius:15px;
                    text-align:center;
                    box-shadow:0 2px 8px #0001;
                "
            >

                <h2>
                    🎉 Test Completed
                </h2>

                ${
                    autoSubmit
                        ? `
                            <p>
                                ⏰ Time समाप्त होने के कारण
                                Test automatically submit हुआ।
                            </p>
                        `
                        : ""
                }

                <h3>
                    Score:
                    ${correct}
                    /
                    ${questions.length}
                </h3>

                <p>
                    ✅ Correct:
                    ${correct}
                </p>

                <p>
                    ❌ Wrong:
                    ${wrong}
                </p>

                <p>
                    ⏭️ Skipped:
                    ${unattempted}
                </p>

                <p>
                    📊 Percentage:
                    ${percentage}%
                </p>

                <p>
                    ⏱️ Time:
                    ${String(minutes).padStart(2, "0")}:
                    ${String(seconds).padStart(2, "0")}
                </p>

            </div>

            <h2 style="margin-top:25px;">
                📋 Question Analysis
            </h2>

            ${
                questions.map(
                    (question, index) => {

                        const answer =
                            activeMockTest.answers[index];

                        const correctAnswer =
                            Number(
                                question.correctAnswer
                            );

                        const userAnswer =
                            answer === null ||
                            answer === undefined
                                ? null
                                : Number(answer);

                        let status;

                        if (
                            userAnswer === null
                        ) {
                            status = "⏭️ Skipped";
                        }
                        else if (
                            userAnswer ===
                            correctAnswer
                        ) {
                            status = "✅ Correct";
                        }
                        else {
                            status = "❌ Wrong";
                        }

                        const time =
                            activeMockTest
                                .questionTimes[index] || 0;

                        return `
                            <div
                                style="
                                    background:white;
                                    padding:16px;
                                    margin:10px 0;
                                    border-radius:12px;
                                    box-shadow:0 2px 8px #0001;
                                "
                            >

                                <b>
                                    Q${index + 1}
                                    -
                                    ${status}
                                </b>

                                <p>
                                    ⏱️ Time Taken:
                                    <b>
                                        ${time} sec
                                    </b>
                                </p>

                                <p>
                                    Your Answer:
                                    ${
                                        userAnswer === null
                                            ? "Skipped"
                                            : String.fromCharCode(
                                                65 +
                                                userAnswer
                                            )
                                    }
                                </p>

                                <p>
                                    Correct Answer:
                                    ${String.fromCharCode(
                                        65 +
                                        correctAnswer
                                    )}
                                </p>

                                <button
                                    onclick="
                                        showMockSolution(
                                            ${index}
                                        )
                                    "
                                >
                                    💡 Solution & Analysis
                                </button>

                            </div>
                        `;
                    }
                ).join("")
            }

            <button
                onclick="location.reload()"
                style="
                    width:100%;
                    margin-top:20px;
                "
            >
                🏠 Back to Home
            </button>

        </main>
    `;
}


// =====================================================
// SHOW SOLUTION
// =====================================================

function showMockSolution(index) {

    if (!activeMockTest) return;

    const question =
        activeMockTest.questions?.[index];

    if (!question) {

        alert("Question नहीं मिला।");
        return;
    }

    const userAnswer =
        activeMockTest.answers?.[index];

    const correctAnswer =
        Number(question.correctAnswer);

    const questionTime =
        activeMockTest.questionTimes?.[index] || 0;

    const isSkipped =
        userAnswer === null ||
        userAnswer === undefined;

    const isCorrect =
        !isSkipped &&
        Number(userAnswer) ===
        correctAnswer;

    const status =
        isSkipped
            ? "⏭️ Skipped"
            : isCorrect
                ? "✅ Correct"
                : "❌ Wrong";

    const userAnswerText =
        isSkipped
            ? "Skipped"
            : (
                String.fromCharCode(
                    65 + Number(userAnswer)
                ) +
                ". " +
                (
                    question.options?.[
                        Number(userAnswer)
                    ] || ""
                )
            );

    const correctAnswerText =
        String.fromCharCode(
            65 + correctAnswer
        ) +
        ". " +
        (
            question.options?.[
                correctAnswer
            ] || ""
        );

    const solution =
        question.solution?.trim();

    document.body.innerHTML = `

        <header class="top-header">

            <div
                class="menu"
                onclick="
                    returnToMockResult()
                "
            >
                ←
            </div>

            <div class="app-name">
                Solution & Analysis
            </div>

            <div>💡</div>

        </header>

        <main>

            <div
                style="
                    background:white;
                    padding:20px;
                    border-radius:15px;
                    box-shadow:0 2px 8px #0001;
                "
            >

                <h2>
                    Q${index + 1}.
                    ${escapeHTML(question.question)}
                </h2>

                <div
                    style="
                        margin:15px 0;
                        padding:12px;
                        border-radius:10px;
                        background:
                            ${
                                isSkipped
                                    ? "#fff8e1"
                                    : isCorrect
                                        ? "#e8f5e9"
                                        : "#ffebee"
                            };
                    "
                >
                    <b>
                        ${status}
                    </b>
                </div>

                <p>
                    ⏱️ Time Taken:
                    <b>
                        ${questionTime} sec
                    </b>
                </p>

                <hr>

                <h3>
                    📝 Options
                </h3>

                ${
                    (question.options || [])
                        .map(
                            (option, optionIndex) => {

                                const correctOption =
                                    optionIndex ===
                                    correctAnswer;

                                const userOption =
                                    !isSkipped &&
                                    optionIndex ===
                                    Number(userAnswer);

                                let background =
                                    "white";

                                if (correctOption) {
                                    background =
                                        "#e8f5e9";
                                }
                                else if (userOption) {
                                    background =
                                        "#ffebee";
                                }

                                return `
                                    <div
                                        style="
                                            padding:13px;
                                            margin:8px 0;
                                            border-radius:10px;
                                            background:${background};
                                            border:1px solid #ddd;
                                        "
                                    >

                                        <b>
                                            ${String.fromCharCode(
                                                65 +
                                                optionIndex
                                            )}.
                                        </b>

                                        ${escapeHTML(option)}

                                        ${
                                            correctOption
                                                ? `
                                                    <span
                                                        style="
                                                            float:right;
                                                            color:green;
                                                            font-weight:bold;
                                                        "
                                                    >
                                                        ✅ Correct
                                                    </span>
                                                `
                                                : userOption
                                                    ? `
                                                        <span
                                                            style="
                                                                float:right;
                                                                color:red;
                                                                font-weight:bold;
                                                            "
                                                        >
                                                            ❌ Your Answer
                                                        </span>
                                                    `
                                                    : ""
                                        }

                                    </div>
                                `;
                            }
                        ).join("")
                }

                <div
                    style="
                        margin-top:20px;
                        padding:15px;
                        background:#f5f5f5;
                        border-radius:10px;
                    "
                >

                    <p>
                        <b>Your Answer:</b>
                        ${escapeHTML(userAnswerText)}
                    </p>

                    <p>
                        <b>Correct Answer:</b>
                        ${escapeHTML(correctAnswerText)}
                    </p>

                </div>

                ${
                    solution
                        ? `
                            <div
                                style="
                                    background:#f1faff;
                                    padding:15px;
                                    border-radius:10px;
                                    margin-top:15px;
                                "
                            >

                                <h3>
                                    💡 Solution
                                </h3>

                                <p>
                                    ${escapeHTML(solution)}
                                </p>

                            </div>
                        `
                        : `
                            <div
                                style="
                                    background:#fff8e1;
                                    padding:15px;
                                    border-radius:10px;
                                    margin-top:15px;
                                "
                            >

                                <b>
                                    💡 Solution उपलब्ध नहीं है।
                                </b>

                                <p>
                                    Admin ने इस Question के लिए
                                    Solution add नहीं किया है।
                                </p>

                            </div>
                        `
                }

            </div>

            <div
                style="
                    display:flex;
                    gap:10px;
                    margin-top:20px;
                "
            >

                ${
                    index > 0
                        ? `
                            <button
                                onclick="
                                    showMockSolution(
                                        ${index - 1}
                                    )
                                "
                                style="flex:1;"
                            >
                                ← Previous
                            </button>
                        `
                        : ""
                }

                ${
                    index <
                    activeMockTest.questions.length - 1
                        ? `
                            <button
                                onclick="
                                    showMockSolution(
                                        ${index + 1}
                                    )
                                "
                                style="flex:1;"
                            >
                                Next →
                            </button>
                        `
                        : ""
                }

            </div>

            <button
                onclick="returnToMockResult()"
                style="
                    width:100%;
                    margin-top:15px;
                "
            >
                ← Back to Result
            </button>

        </main>
    `;
}


// =====================================================
// RETURN TO RESULT
// =====================================================

function returnToMockResult() {

    if (!activeMockTest) {

        location.reload();
        return;
    }

    showMockResult(
        calculateMockCorrect(),
        calculateMockWrong(),
        calculateMockUnattempted(),
        calculateMockAttempted(),
        calculateMockUsedTime(),
        false
    );
}


// =====================================================
// RESULT HELPERS
// =====================================================

function calculateMockCorrect() {

    if (!activeMockTest) return 0;

    let correct = 0;

    activeMockTest.questions.forEach(
        (question, index) => {

            if (
                Number(
                    activeMockTest.answers[index]
                ) ===
                Number(
                    question.correctAnswer
                )
            ) {
                correct++;
            }

        }
    );

    return correct;
}


function calculateMockAttempted() {

    if (!activeMockTest) return 0;

    return activeMockTest.answers.filter(
        answer =>
            answer !== null &&
            answer !== undefined
    ).length;
}


function calculateMockWrong() {

    return (
        calculateMockAttempted() -
        calculateMockCorrect()
    );
}


function calculateMockUnattempted() {

    if (!activeMockTest) return 0;

    return (
        activeMockTest.questions.length -
        calculateMockAttempted()
    );
}


function calculateMockUsedTime() {

    if (!activeMockTest) return 0;

    return (
        activeMockTest.totalTime -
        Math.max(
            0,
            activeMockTest.remainingTime
        )
    );
}


// =====================================================
// PAGE LOAD
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        showStudentCourses();

        loadAdminCourses();

        showAdminContent();

        loadMockExamNames();

        loadMockAdminTests();

    }
);