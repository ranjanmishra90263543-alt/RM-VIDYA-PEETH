// =====================================================
// RM VIDYA PEETH - HOME PAGE
// By Ranjan Mishra Sir
// MASTER ADMIN LOGO MANAGEMENT
// FIREBASE STORAGE NOT REQUIRED
// =====================================================

import {
    auth,
    db
} from "./firebase-config.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";

import {
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";


// =====================================================
// LOAD LOGO
// =====================================================

async function loadAppLogo() {

    try {

        const logoRef = doc(
            db,
            "settings",
            "app"
        );

        const logoSnap = await getDoc(logoRef);

        if (logoSnap.exists()) {

            const data = logoSnap.data();

            if (data.logoURL) {

                const logo =
                    document.getElementById(
                        "appLogo"
                    );

                if (logo) {
                    logo.src = data.logoURL;
                }

            }

        }

    } catch (error) {

        console.error(
            "RM Vidya Peeth Logo Load Error:",
            error
        );

    }

}


// =====================================================
// CHECK MASTER ADMIN
// =====================================================

onAuthStateChanged(
    auth,
    async function (user) {

        // पहले logo load करो
        await loadAppLogo();


        // अगर login नहीं है
        if (!user) {
            return;
        }


        try {

            const adminRef = doc(
                db,
                "admins",
                user.uid
            );


            const adminSnap = await getDoc(
                adminRef
            );


            if (!adminSnap.exists()) {
                return;
            }


            const admin = adminSnap.data();


            // केवल Master Admin
            if (admin.role === "master") {

                const box =
                    document.getElementById(
                        "masterLogoBox"
                    );

                if (box) {

                    box.style.display =
                        "block";

                }

            }

        } catch (error) {

            console.error(
                "Admin Check Error:",
                error
            );

        }

    }
);


// =====================================================
// COMPRESS IMAGE
// =====================================================

function compressImage(file) {

    return new Promise(
        (resolve, reject) => {

            const reader =
                new FileReader();


            reader.onload = function (event) {

                const img =
                    new Image();


                img.onload = function () {

                    // Logo को छोटा रखेंगे
                    const maxSize = 300;

                    let width =
                        img.width;

                    let height =
                        img.height;


                    if (width > height) {

                        if (width > maxSize) {

                            height =
                                height *
                                maxSize /
                                width;

                            width =
                                maxSize;

                        }

                    } else {

                        if (height > maxSize) {

                            width =
                                width *
                                maxSize /
                                height;

                            height =
                                maxSize;

                        }

                    }


                    const canvas =
                        document.createElement(
                            "canvas"
                        );


                    canvas.width =
                        width;

                    canvas.height =
                        height;


                    const ctx =
                        canvas.getContext(
                            "2d"
                        );


                    ctx.drawImage(
                        img,
                        0,
                        0,
                        width,
                        height
                    );


                    // JPEG में compress
                    const compressed =
                        canvas.toDataURL(
                            "image/jpeg",
                            0.75
                        );


                    resolve(
                        compressed
                    );

                };


                img.onerror =
                    reject;


                img.src =
                    event.target.result;

            };


            reader.onerror =
                reject;


            reader.readAsDataURL(
                file
            );

        }
    );

}


// =====================================================
// CHANGE APP LOGO
// =====================================================

window.changeAppLogo =
    async function () {

        const input =
            document.getElementById(
                "logoFile"
            );


        if (!input) {

            alert(
                "❌ Logo input नहीं मिला।"
            );

            return;

        }


        const file =
            input.files[0];


        if (!file) {

            alert(
                "⚠️ पहले Logo Image चुनें।"
            );

            return;

        }


        if (
            !file.type.startsWith(
                "image/"
            )
        ) {

            alert(
                "❌ केवल Image File चुनें।"
            );

            return;

        }


        try {

            const user =
                auth.currentUser;


            if (!user) {

                alert(
                    "❌ पहले Master Admin Login करें।"
                );

                return;

            }


            // =================================================
            // VERIFY MASTER ADMIN
            // =================================================

            const adminRef =
                doc(
                    db,
                    "admins",
                    user.uid
                );


            const adminSnap =
                await getDoc(
                    adminRef
                );


            if (!adminSnap.exists()) {

                alert(
                    "🚫 Admin permission नहीं है।"
                );

                return;

            }


            const admin =
                adminSnap.data();


            if (
                admin.role !==
                "master"
            ) {

                alert(
                    "🚫 केवल Master Admin Logo बदल सकता है।"
                );

                return;

            }


            // =================================================
            // COMPRESS IMAGE
            // =================================================

            alert(
                "⏳ RM Vidya Peeth Logo तैयार किया जा रहा है..."
            );


            const logoURL =
                await compressImage(
                    file
                );


            // =================================================
            // SAVE IN FIRESTORE
            // =================================================

            await setDoc(

                doc(
                    db,
                    "settings",
                    "app"
                ),

                {

                    logoURL:
                        logoURL,

                    updatedAt:
                        new Date()
                        .toISOString(),

                    updatedBy:
                        user.uid

                },

                {
                    merge: true
                }

            );


            // =================================================
            // UPDATE PAGE
            // =================================================

            const logo =
                document.getElementById(
                    "appLogo"
                );


            if (logo) {

                logo.src =
                    logoURL;

            }


            input.value = "";


            alert(
                "✅ RM Vidya Peeth App Logo Successfully Changed!"
            );


        } catch (error) {

            console.error(
                "Logo Change Error:",
                error
            );


            alert(
                "❌ Logo Change Failed!\n\n" +
                error.message
            );

        }

    };