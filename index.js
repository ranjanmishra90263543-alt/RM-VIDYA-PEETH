// =====================================================
// RM VIDYA PEETH - CLOUD FUNCTIONS (functions/index.js)
//
// 1) adminDeleteStudent  - student ko login account samet poora delete
// 2) parseDigialm        - Digialm response sheet URL se answers nikalta hai
//
// Dono functions ek hi file me hain (firebase deploy ek hi index.js padhta hai).
// Dependencies:  npm i firebase-admin firebase-functions cheerio
// =====================================================

const { onCall, onRequest, HttpsError } =
    require("firebase-functions/v2/https");

const logger = require("firebase-functions/logger");

const admin = require("firebase-admin");

const cheerio = require("cheerio");

admin.initializeApp();


// =====================================================
// 1) ADMIN DELETE STUDENT
// =====================================================

const MASTER_EMAIL = "ranjanmishra9026354@gmail.com";

// Student ke jo related records bhi delete karne hain wo yahan likho.
// field = us collection ka wo field jisme student ka uid/id save hota hai.
// Example:
//   { collection: "testResults", field: "uid" },
//   { collection: "enrollments", field: "studentId" },
// (Payments jaise financial records normally yahan mat daalo.)
const RELATED_COLLECTIONS = [];


async function assertCallerCanManageStudents(request) {

    if (!request.auth) {
        throw new HttpsError("unauthenticated", "Pehle login karein.");
    }

    const email = String(request.auth.token.email || "")
        .trim()
        .toLowerCase();

    if (email === MASTER_EMAIL.toLowerCase()) {
        return { email: email, isMaster: true };
    }

    const snap = await admin
        .firestore()
        .collection("admins")
        .where("email", "==", email)
        .limit(1)
        .get();

    if (snap.empty) {
        throw new HttpsError("permission-denied", "Aap Admin nahi hain.");
    }

    const data = snap.docs[0].data() || {};

    const role = String(data.role || "").trim().toLowerCase();
    const status = String(data.status || "active").trim().toLowerCase();
    const permissions = data.permissions || {};

    if (role !== "admin" || status !== "active") {
        throw new HttpsError("permission-denied", "Aapka Admin account active nahi hai.");
    }

    if (permissions.all !== true && permissions.students !== true) {
        throw new HttpsError("permission-denied", "Aapko Students ki permission nahi hai.");
    }

    return { email: email, isMaster: false };
}


async function findAuthUser(studentId, data) {

    const auth = admin.auth();

    const docEmail = String(data.email || "").trim().toLowerCase();

    // 1) uid se dhundo (students/{uid} ya data.uid)
    const candidates = [data.uid, studentId];

    for (const uid of candidates) {

        if (!uid || typeof uid !== "string") continue;

        try {

            const user = await auth.getUser(uid);

            // Galat account delete na ho: email match hona chahiye
            if (
                docEmail &&
                String(user.email || "").toLowerCase() !== docEmail
            ) {
                throw new HttpsError(
                    "failed-precondition",
                    "Student record aur login account ka email match nahi karta. " +
                    "Firebase Console se manually check karein."
                );
            }

            return user;

        } catch (error) {

            if (error instanceof HttpsError) throw error;

            if (error.code !== "auth/user-not-found") throw error;
        }
    }

    // 2) email se dhundo
    if (docEmail) {

        try {
            return await auth.getUserByEmail(docEmail);
        } catch (error) {
            if (error.code !== "auth/user-not-found") throw error;
        }
    }

    return null;
}


exports.adminDeleteStudent = onCall(async function (request) {

    const caller = await assertCallerCanManageStudents(request);

    const studentId = String(
        (request.data && request.data.studentId) || ""
    ).trim();

    if (!studentId || studentId.indexOf("/") !== -1) {
        throw new HttpsError("invalid-argument", "studentId galat hai.");
    }

    const db = admin.firestore();

    const studentRef = db.collection("students").doc(studentId);

    const studentSnap = await studentRef.get();

    const data = studentSnap.exists ? (studentSnap.data() || {}) : {};

    const authUser = await findAuthUser(studentId, data);

    if (!studentSnap.exists && !authUser) {
        throw new HttpsError("not-found", "Student nahi mila.");
    }


    // ---------------- SAFETY CHECKS ----------------

    if (authUser) {

        const targetEmail = String(authUser.email || "").trim().toLowerCase();

        if (targetEmail === MASTER_EMAIL.toLowerCase()) {
            throw new HttpsError("failed-precondition", "Master Admin delete nahi ho sakta.");
        }

        if (authUser.uid === request.auth.uid) {
            throw new HttpsError("failed-precondition", "Aap khud ko delete nahi kar sakte.");
        }

        if (targetEmail) {

            const adminCheck = await db
                .collection("admins")
                .where("email", "==", targetEmail)
                .limit(1)
                .get();

            if (!adminCheck.empty) {
                throw new HttpsError(
                    "failed-precondition",
                    "Ye account Admin hai, Student list se delete nahi ho sakta."
                );
            }
        }
    }


    // ---------------- 1) AUTH ACCOUNT ----------------

    if (authUser) {
        await admin.auth().deleteUser(authUser.uid);
    }


    // ---------------- 2) RELATED RECORDS ----------------

    const key = authUser ? authUser.uid : studentId;

    for (const rel of RELATED_COLLECTIONS) {

        const related = await db
            .collection(rel.collection)
            .where(rel.field, "==", key)
            .get();

        for (const item of related.docs) {
            await db.recursiveDelete(item.ref);
        }
    }


    // ---------------- 3) STUDENT DOCUMENT ----------------

    if (studentSnap.exists) {
        await db.recursiveDelete(studentRef);
    }

    logger.info("Student deleted", { studentId: studentId, by: caller.email });

    return {
        ok: true,
        authDeleted: !!authUser,
        docDeleted: studentSnap.exists
    };
});


// =====================================================
// 2) PARSE DIGIALM
// =====================================================

// true karne par sirf logged-in Firebase user hi function chala payega.
// Client ko header bhejna hoga:  Authorization: Bearer <idToken>
//   const token = await auth.currentUser.getIdToken();
const REQUIRE_LOGIN = false;

const MAX_REDIRECTS = 5;
const MAX_HTML_BYTES = 8 * 1024 * 1024;   // 8 MB
const FETCH_TIMEOUT_MS = 20000;


class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}


// ---------------- HELPERS ----------------

function cleanText(value) {

    return String(value || "")
        .replace(/\s+/g, " ")
        .trim();
}

function optionToIndex(value) {

    if (value === undefined || value === null) {
        return null;
    }

    const v = String(value).trim().toUpperCase();

    if (["1", "2", "3", "4"].includes(v)) {
        return Number(v) - 1;
    }

    if (["A", "B", "C", "D"].includes(v)) {
        return { A: 0, B: 1, C: 2, D: 3 }[v];
    }

    return null;
}


// ---------------- SECURITY ----------------

// SIRF digialm.com aur uske subdomains.
// (pehle endsWith("digialm.com") tha, jisse "evildigialm.com" bhi pass ho jata tha)
function isAllowedDigialmUrl(parsed) {

    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        return false;
    }

    if (parsed.username || parsed.password) {
        return false;
    }

    if (parsed.port && parsed.port !== "80" && parsed.port !== "443") {
        return false;
    }

    const host = parsed.hostname.toLowerCase();

    return host === "digialm.com" || host.endsWith(".digialm.com");
}

// Redirect ko manually follow karta hai, har step par domain check hota hai
// (warna digialm ka koi redirect hume kisi bhi dusri site/internal address par bhej sakta hai)
async function fetchDigialmHtml(startUrl) {

    let current = startUrl;

    for (let i = 0; i <= MAX_REDIRECTS; i++) {

        let parsed;

        try {
            parsed = new URL(current);
        } catch (error) {
            throw new HttpError(400, "Invalid URL.");
        }

        if (!isAllowedDigialmUrl(parsed)) {
            throw new HttpError(400, "Only Digialm URLs are allowed.");
        }

        const response = await fetch(parsed.toString(), {
            method: "GET",
            redirect: "manual",
            signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
                "Accept":
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9"
            }
        });

        if ([301, 302, 303, 307, 308].includes(response.status)) {

            const location = response.headers.get("location");

            if (!location) {
                throw new HttpError(502, "Digialm redirect invalid.");
            }

            current = new URL(location, parsed).toString();

            continue;
        }

        if (!response.ok) {
            throw new HttpError(
                502,
                `Digialm server returned HTTP ${response.status}. ` +
                `The URL may require the candidate's session/cookies or may block server requests.`
            );
        }

        const length = Number(response.headers.get("content-length") || 0);

        if (length > MAX_HTML_BYTES) {
            throw new HttpError(413, "Digialm page too large.");
        }

        const html = await response.text();

        if (!html) {
            throw new HttpError(502, "Empty Digialm response.");
        }

        if (html.length > MAX_HTML_BYTES) {
            throw new HttpError(413, "Digialm page too large.");
        }

        return html;
    }

    throw new HttpError(502, "Too many redirects.");
}

async function verifyLogin(req) {

    const header = String(req.headers.authorization || "");

    const match = header.match(/^Bearer\s+(.+)$/i);

    if (!match) {
        throw new HttpError(401, "Login token missing.");
    }

    try {
        return await admin.auth().verifyIdToken(match[1]);
    } catch (error) {
        throw new HttpError(401, "Invalid login token.");
    }
}


// ---------------- PARSER ----------------

// Sirf ye exact class names "sahi option" maane jaate hain.
// (pehle "right" / "answer" / "green" jaise words par match hota tha,
//  jisse "text-right" ya "answer-block" jaisi classes galat pakdi jati thi)
const CORRECT_CLASS_TOKENS = [
    "rightans", "right-ans", "right_ans", "rightanswer", "right-answer",
    "correctans", "correct-ans", "correct_ans", "correctanswer",
    "correct-answer", "correctoption", "correct-option"
];

function ownText($, el) {

    return $(el)
        .contents()
        .toArray()
        .filter(function (node) {
            return node.type === "text";
        })
        .map(function (node) {
            return node.data;
        })
        .join(" ");
}

function countLabelsIn($, node, labels) {

    let count = 0;

    for (const label of labels) {

        if (label === node || $.contains(node, label)) {
            count++;
        }
    }

    return count;
}

function findQuestionId($, labelEl, labels) {

    let node = labelEl;

    for (let i = 0; i < 4 && node && node.type === "tag"; i++) {

        if (i > 0 && countLabelsIn($, node, labels) !== 1) {
            break;
        }

        const match = cleanText($(node).text())
            .match(/Question\s*ID\s*[:\-]?\s*(\d+)/i);

        if (match) {
            return match[1];
        }

        node = node.parent;
    }

    return null;
}

// Ek question ka sabse bada wo block jisme sirf ek hi "Question ID" ho
function findQuestionContainer($, labelEl, labels) {

    let container = labelEl;

    while (
        container.parent &&
        container.parent.type === "tag" &&
        container.parent.name !== "body" &&
        container.parent.name !== "html" &&
        countLabelsIn($, container.parent, labels) === 1
    ) {
        container = container.parent;
    }

    return container;
}

function detectCorrectOption($, container, text) {

    let correct = null;

    $(container).find("*").each(function () {

        if (correct !== null) return;

        const classes = String($(this).attr("class") || "")
            .toLowerCase()
            .split(/\s+/);

        const isCorrect = classes.some(function (name) {
            return CORRECT_CLASS_TOKENS.includes(name);
        });

        if (!isCorrect) return;

        // "2. option text" jaisa label
        const label = cleanText($(this).text())
            .match(/^([1-4A-D])\s*[.)\]:\-]/i);

        if (label) {
            correct = optionToIndex(label[1]);
            return;
        }

        // Label na mile to option ki position (sirf 4 options hon tab)
        const siblings = $(this).parent().children();

        if (siblings.length === 4) {

            const index = siblings.index(this);

            if (index >= 0 && index < 4) {
                correct = index;
            }
        }
    });

    if (correct !== null) {
        return correct;
    }

    // Text me "Correct Option : 2" jaisa likha ho
    const textMatch = text.match(
        /(?:Correct|Right)\s*(?:Option|Answer|Ans)\s*[:\-]\s*([1-4A-D])(?![A-Za-z0-9])/i
    );

    return textMatch ? optionToIndex(textMatch[1]) : null;
}

function parseQuestionBlock($, container, questionId) {

    const text = cleanText($(container).text());

    // ---------- Chosen option ----------

    const chosenMatch = text.match(
        /Chosen\s*Option\s*[:\-]\s*(--|[1-4A-D])(?![A-Za-z0-9])/i
    );

    const chosenOption =
        chosenMatch ? optionToIndex(chosenMatch[1]) : null;

    // ---------- Status ----------

    const statusMatch = text.match(
        /Status\s*[:\-]\s*(.{0,60}?)(?=\s*(?:Chosen\s*Option|Question\s*ID|$))/i
    );

    const statusText = statusMatch ? cleanText(statusMatch[1]) : "";

    const rawStatus = statusText.toLowerCase();

    let status = "unknown";

    if (chosenOption !== null) {
        status = "answered";
    } else if (chosenMatch) {
        status = "not_attempted";        // "Chosen Option : --"
    } else if (/not\s*(answered|attempted)/.test(rawStatus)) {
        status = "not_attempted";
    } else if (/answered/.test(rawStatus)) {
        status = "answered";
    }

    return {
        questionId: questionId,
        status: status,
        statusText: statusText,
        chosenOption: chosenOption,
        correctOption: detectCorrectOption($, container, text)
    };
}

function parseDigialmHTML(html) {

    const $ = cheerio.load(html);

    // Un elements ko dhundo jinke apne text me "Question ID" likha hai
    const labels = [];

    $("body *").each(function () {

        if (/Question\s*ID/i.test(ownText($, this))) {
            labels.push(this);
        }
    });

    const questions = [];
    const seen = new Set();

    for (const label of labels) {

        const questionId = findQuestionId($, label, labels);

        if (!questionId || seen.has(questionId)) {
            continue;
        }

        seen.add(questionId);

        const container = findQuestionContainer($, label, labels);

        questions.push(parseQuestionBlock($, container, questionId));
    }

    return questions;
}


// ---------------- HTTP FUNCTION ----------------

exports.parseDigialm = onRequest(
    {
        region: "asia-south1",
        cors: true,
        timeoutSeconds: 60,
        memory: "512MiB",
        maxInstances: 10
    },

    async function (req, res) {

        try {

            if (req.method !== "POST") {
                throw new HttpError(405, "POST request required.");
            }

            if (REQUIRE_LOGIN) {
                await verifyLogin(req);
            }

            const url = String((req.body && req.body.url) || "").trim();

            if (!url) {
                throw new HttpError(400, "Digialm URL missing.");
            }

            if (url.length > 2000) {
                throw new HttpError(400, "URL too long.");
            }

            logger.info("Fetching Digialm URL");

            const html = await fetchDigialmHtml(url);

            const questions = parseDigialmHTML(html);

            if (!questions.length) {
                throw new HttpError(
                    422,
                    "Questions could not be detected from this Digialm page."
                );
            }

            const count = function (fn) {
                return questions.filter(fn).length;
            };

            return res.status(200).json({
                success: true,
                totalQuestions: questions.length,
                answered: count(function (q) { return q.status === "answered"; }),
                notAttempted: count(function (q) { return q.status === "not_attempted"; }),
                correctAnswersDetected: count(function (q) { return q.correctOption !== null; }),
                questions: questions
            });

        } catch (error) {

            if (error instanceof HttpError) {
                return res.status(error.status).json({ error: error.message });
            }

            logger.error("Digialm parser error", error);

            return res.status(500).json({ error: "Internal parser error." });
        }
    }
);
