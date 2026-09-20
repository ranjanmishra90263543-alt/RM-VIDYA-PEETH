// =====================================================
// THE HUB - FIREBASE CONFIG
// AUTH + FIRESTORE + STORAGE
// =====================================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";

import {
    getAuth
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    getFirestore
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

import {
    getStorage
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-storage.js";


// =====================================================
// FIREBASE CONFIG
// =====================================================

const firebaseConfig = {

    apiKey:
        "AIzaSyAqsesw3BWaHK7G1Y1jw0K9kr9suZ1pPV4",

    authDomain:
        "ssc-courses.firebaseapp.com",

    projectId:
        "ssc-courses",

    storageBucket:
        "ssc-courses.firebasestorage.app",

    messagingSenderId:
        "886294132394",

    appId:
        "1:886294132394:web:58b82a2a49f9cd1e0f02d3",

    measurementId:
        "G-9QSCEVYSE5"

};


// =====================================================
// INITIALIZE
// =====================================================

const app =
    initializeApp(
        firebaseConfig
    );


// =====================================================
// AUTH
// =====================================================

const auth =
    getAuth(
        app
    );


// =====================================================
// FIRESTORE
// =====================================================

const db =
    getFirestore(
        app
    );


// =====================================================
// STORAGE
// =====================================================

const storage =
    getStorage(
        app
    );


// =====================================================
// EXPORT
// =====================================================

export {
    app,
    auth,
    db,
    storage
};