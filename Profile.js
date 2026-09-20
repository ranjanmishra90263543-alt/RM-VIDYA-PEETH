// =====================================================
// THE HUB - STUDENT PROFILE
// FIREBASE AUTH + FIRESTORE
// COLLECTION: students
// DOCUMENT: Firebase Auth UID
// =====================================================


import {
    auth,
    db
} from "./firebase-config.js";


import {
    updateProfile,
    signOut
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";


import {
    doc,
    getDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// =====================================================
// FIRESTORE COLLECTION
// =====================================================

const STUDENTS_COLLECTION = "students";


// =====================================================
// SAFE TEXT
// =====================================================

function setText(id, value){

    const element =
        document.getElementById(id);

    if(element){

        element.textContent =
            value ?? "-";

    }

}


// =====================================================
// FORMAT JOIN DATE
// =====================================================

function formatJoinDate(value){

    if(!value){

        return "Student Account";

    }


    try{

        if(
            value &&
            typeof value.toDate === "function"
        ){

            return value
                .toDate()
                .toLocaleDateString(
                    "en-IN",
                    {
                        day:"2-digit",
                        month:"short",
                        year:"numeric"
                    }
                );

        }


        const date =
            new Date(value);


        if(
            !Number.isNaN(
                date.getTime()
            )
        ){

            return date.toLocaleDateString(
                "en-IN",
                {
                    day:"2-digit",
                    month:"short",
                    year:"numeric"
                }
            );

        }

    }
    catch(error){

        console.log(
            "Date format error:",
            error
        );

    }


    return "Student Account";

}


// =====================================================
// UPDATE PROFILE PAGE
// =====================================================

function updatePage(
    name,
    email,
    phone,
    joined
){

    const safeName =
        String(
            name || "Student"
        ).trim();


    setText(
        "profileName",
        safeName
    );


    setText(
        "profileEmail",
        email || "-"
    );


    setText(
        "profilePhone",
        phone || "-"
    );


    setText(
        "userType",
        "Student"
    );


    setText(
        "joinDate",
        formatJoinDate(joined)
    );


    const initial =
        safeName
            .charAt(0)
            .toUpperCase() ||
        "S";


    setText(
        "profileInitial",
        initial
    );

}


// =====================================================
// LOCAL STORAGE
// =====================================================

function getSavedUser(){

    const savedData =
        localStorage.getItem(
            "studentUser"
        );


    if(!savedData){

        return {};

    }


    try{

        return JSON.parse(
            savedData
        );

    }
    catch(error){

        console.log(
            "Local user data error:",
            error
        );

        return {};

    }

}


// =====================================================
// SAVE LOCAL USER
// =====================================================

function saveLocalUser(user){

    localStorage.setItem(
        "studentUser",
        JSON.stringify(user)
    );


    localStorage.setItem(
        "studentLoggedIn",
        "true"
    );

}


// =====================================================
// LOAD PROFILE
// =====================================================

async function loadStudentProfile(){

    const savedUser =
        getSavedUser();


    const firebaseUser =
        auth.currentUser;


    // =================================================
    // AUTH USER UID
    // =================================================

    const uid =
        firebaseUser?.uid ||
        savedUser.uid ||
        "";


    // =================================================
    // NO USER
    // =================================================

    if(!uid){

        window.location.replace(
            "login.html"
        );

        return;

    }


    // =================================================
    // LOCAL DATA FIRST
    // =================================================

    const localName =
        firebaseUser?.displayName ||
        savedUser.displayName ||
        savedUser.name ||
        savedUser.fullName ||
        "Student";


    const localEmail =
        firebaseUser?.email ||
        savedUser.email ||
        "";


    const localPhone =
        savedUser.mobile ||
        savedUser.phone ||
        savedUser.phoneNumber ||
        firebaseUser?.phoneNumber ||
        "";


    updatePage(
        localName,
        localEmail,
        localPhone,
        savedUser.joinedAt ||
        savedUser.createdAt
    );


    // =================================================
    // KEEP LOCAL SESSION
    // =================================================

    saveLocalUser({

        ...savedUser,

        uid:uid,

        name:localName,

        fullName:localName,

        displayName:localName,

        username:localEmail,

        email:localEmail,

        mobile:localPhone,

        phone:localPhone,

        role:"student",

        status:"active"

    });


    // =================================================
    // FIRESTORE LOAD
    // =================================================

    try{

        const studentRef =
            doc(
                db,
                STUDENTS_COLLECTION,
                uid
            );


        const snapshot =
            await getDoc(
                studentRef
            );


        // =================================================
        // NO FIRESTORE DOCUMENT
        // =================================================

        if(!snapshot.exists()){

            console.log(
                "Student document not found:",
                uid
            );

            return;

        }


        const data =
            snapshot.data();


        // =================================================
        // FIRESTORE DATA
        // =================================================

        const name =
            data.name ||
            data.fullName ||
            data.displayName ||
            localName ||
            "Student";


        const email =
            data.email ||
            localEmail ||
            "";


        const phone =
            data.mobile ||
            data.phone ||
            data.phoneNumber ||
            localPhone ||
            "";


        const joined =
            data.joinedAt ||
            data.createdAt ||
            data.createdDate ||
            savedUser.joinedAt ||
            savedUser.createdAt;


        // =================================================
        // UPDATE SCREEN
        // =================================================

        updatePage(
            name,
            email,
            phone,
            joined
        );


        // =================================================
        // UPDATE LOCAL STORAGE
        // =================================================

        saveLocalUser({

            ...savedUser,

            uid:uid,

            name:name,

            fullName:name,

            displayName:name,

            username:email,

            email:email,

            mobile:phone,

            phone:phone,

            role:"student",

            status:"active",

            joinedAt:joined || ""

        });


        console.log(
            "THE HUB Profile Loaded:",
            data
        );

    }
    catch(error){

        console.error(
            "Firestore Profile Error:",
            error
        );

    }

}


// =====================================================
// EDIT PROFILE NAME
// =====================================================

window.editProfileName =
async function(){

    const firebaseUser =
        auth.currentUser;


    const savedUser =
        getSavedUser();


    const oldName =
        firebaseUser?.displayName ||
        savedUser.name ||
        savedUser.fullName ||
        "Student";


    const newName =
        prompt(
            "अपना नया नाम डालें:",
            oldName
        );


    if(newName === null){

        return;

    }


    const name =
        newName.trim();


    if(!name){

        alert(
            "❌ नाम खाली नहीं हो सकता।"
        );

        return;

    }


    const uid =
        firebaseUser?.uid ||
        savedUser.uid ||
        "";


    if(!uid){

        alert(
            "❌ Student login session नहीं मिला।"
        );

        return;

    }


    try{

        // =================================================
        // FIREBASE AUTH NAME
        // =================================================

        if(firebaseUser){

            await updateProfile(
                firebaseUser,
                {
                    displayName:name
                }
            );

        }


        // =================================================
        // UPDATE SCREEN
        // =================================================

        updatePage(
            name,
            firebaseUser?.email ||
            savedUser.email ||
            "",
            savedUser.mobile ||
            savedUser.phone ||
            "",
            savedUser.joinedAt ||
            savedUser.createdAt
        );


        // =================================================
        // UPDATE LOCAL STORAGE
        // =================================================

        const updatedUser = {

            ...savedUser,

            uid:uid,

            name:name,

            fullName:name,

            displayName:name,

            username:
                firebaseUser?.email ||
                savedUser.email ||
                "",

            email:
                firebaseUser?.email ||
                savedUser.email ||
                "",

            mobile:
                savedUser.mobile ||
                savedUser.phone ||
                "",

            phone:
                savedUser.phone ||
                savedUser.mobile ||
                "",

            role:"student",

            status:"active"

        };


        saveLocalUser(
            updatedUser
        );


        // =================================================
        // FIRESTORE UPDATE
        // =================================================

        const studentRef =
            doc(
                db,
                STUDENTS_COLLECTION,
                uid
            );


        try{

            await updateDoc(
                studentRef,
                {
                    name:name,
                    fullName:name,
                    displayName:name
                }
            );

        }
        catch(error){

            console.log(
                "Firestore update failed:",
                error
            );

        }


        alert(
            "✅ Profile Name Successfully Updated!"
        );

    }
    catch(error){

        console.error(
            "Profile Name Error:",
            error
        );


        alert(
            "❌ Name update नहीं हुआ.\n\n" +
            error.message
        );

    }

};


// =====================================================
// LOGOUT
// =====================================================

window.logoutProfile =
async function(){

    try{

        await signOut(
            auth
        );

    }
    catch(error){

        console.log(
            "Firebase Logout Error:",
            error
        );

    }


    localStorage.removeItem(
        "studentLoggedIn"
    );


    localStorage.removeItem(
        "studentUser"
    );


    window.location.replace(
        "login.html"
    );

};


// =====================================================
// DASHBOARD
// =====================================================

window.goDashboard =
function(){

    window.location.href =
        "dashboard.html";

};


// =====================================================
// COURSES
// =====================================================

window.goCourses =
function(){

    window.location.href =
        "courses.html";

};


// =====================================================
// MOCK TESTS
// =====================================================

window.goMockTests =
function(){

    window.location.href =
        "mock-test.html";

};


// =====================================================
// HOME
// =====================================================

window.goHome =
function(){

    window.location.href =
        "index.html";

};


// =====================================================
// PAGE LOAD
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function(){

        loadStudentProfile();

    }
);