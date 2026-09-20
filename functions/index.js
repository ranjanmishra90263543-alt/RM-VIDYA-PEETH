const { onRequest } =
    require("firebase-functions/v2/https");

const logger =
    require("firebase-functions/logger");

const cheerio =
    require("cheerio");


/* =========================================
   HELPERS
========================================= */

function cleanText(value){

    return String(value || "")
        .replace(/\s+/g," ")
        .trim();
}


function optionToIndex(value){

    if(value === undefined ||
       value === null){

        return null;
    }


    const v =
        String(value)
        .trim()
        .toUpperCase();


    if(
        ["1","2","3","4"]
        .includes(v)
    ){

        return Number(v)-1;
    }


    if(
        ["A","B","C","D"]
        .includes(v)
    ){

        return {
            A:0,
            B:1,
            C:2,
            D:3
        }[v];

    }


    return null;
}


/* =========================================
   FIND OPTION INDEX FROM ELEMENT
========================================= */

function detectCorrectOption(
    element,
    $
){

    if(!element){
        return null;
    }


    const text =
        cleanText(
            $(element).text()
        );


    const attrs = [

        $(element).attr("class"),
        $(element).attr("style"),
        $(element).attr("data-correct"),
        $(element).attr("data-answer"),
        $(element).attr("aria-label")

    ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();


    /*
       Common correct-answer indicators
    */

    const correctWords = [

        "correct",
        "right",
        "answer",
        "green",
        "success"

    ];


    const hasCorrect =
        correctWords.some(
            word =>
                attrs.includes(word)
        );


    if(!hasCorrect){

        return null;
    }


    /*
       Search option number
    */

    const numberMatch =
        attrs.match(
            /(?:option|answer|choice)[^\d]{0,10}([1-4])/i
        );


    if(numberMatch){

        return Number(
            numberMatch[1]
        ) - 1;
    }


    /*
       Search A/B/C/D
    */

    const letterMatch =
        attrs.match(
            /(?:option|answer|choice)[^\w]{0,10}([abcd])/i
        );


    if(letterMatch){

        return optionToIndex(
            letterMatch[1]
        );
    }


    /*
       Try parent/nearby element
    */

    const parent =
        $(element).parent();


    if(parent.length){

        const parentClass =
            String(
                parent.attr("class") || ""
            ).toLowerCase();


        if(
            parentClass.includes("correct")
            ||
            parentClass.includes("green")
        ){

            const children =
                parent.find(
                    "input,li,label,div"
                );


            for(let i=0;i<children.length;i++){

                const child =
                    children.eq(i);


                const childClass =
                    String(
                        child.attr("class") || ""
                    ).toLowerCase();


                if(
                    childClass.includes(
                        "correct"
                    )
                    ||
                    childClass.includes(
                        "green"
                    )
                ){

                    return i % 4;
                }

            }

        }

    }


    return null;
}


/* =========================================
   PARSE DIGIALM HTML
========================================= */

function parseDigialmHTML(
    html
){

    const $ =
        cheerio.load(html);


    const questions=[];


    /*
       Search elements containing
       "Question ID"
    */

    $("body *").each(
        function(){

            const node =
                $(this);


            const text =
                cleanText(
                    node.text()
                );


            if(
                !text.includes(
                    "Question ID"
                )
            ){

                return;
            }


            /*
               Avoid very large parent
            */

            if(
                text.length > 20000
            ){

                return;
            }


            const idMatch =
                text.match(
                    /Question\s*ID\s*[:\-]\s*(\d+)/i
                );


            if(!idMatch){

                return;
            }


            const questionId =
                idMatch[1];


            /*
               Status
            */

            let status =
                "unknown";


            const statusMatch =
                text.match(
                    /Status\s*[:\-]\s*([A-Za-z ]+)/i
                );


            if(statusMatch){

                const statusText =
                    cleanText(
                        statusMatch[1]
                    ).toLowerCase();


                if(
                    statusText.includes(
                        "not answered"
                    )
                ){

                    status =
                        "not_attempted";

                }else if(
                    statusText.includes(
                        "answered"
                    )
                ){

                    status =
                        "answered";
                }
            }


            /*
               Chosen Option
            */

            let chosenOption=null;


            const chosenMatch =
                text.match(
                    /Chosen\s*Option\s*[:\-]\s*([1-4ABCD\-]+)/i
                );


            if(chosenMatch){

                chosenOption =
                    optionToIndex(
                        chosenMatch[1]
                    );
            }


            /*
               Correct option
            */

            let correctOption =
                detectCorrectOption(
                    this,
                    $
                );


            /*
               Search descendants
            */

            if(correctOption === null){

                const descendants =
                    node.find("*");


                descendants.each(
                    function(){

                        if(
                            correctOption !== null
                        ){

                            return;
                        }


                        const detected =
                            detectCorrectOption(
                                this,
                                $
                            );


                        if(
                            detected !== null
                        ){

                            correctOption =
                                detected;
                        }

                    }
                );

            }


            /*
               Only keep meaningful question
            */

            if(
                questionId &&
                !questions.some(
                    q =>
                        q.questionId ===
                        questionId
                )
            ){

                questions.push({

                    questionId,

                    status,

                    chosenOption,

                    correctOption

                });

            }

        }
    );


    /*
       Sort by Question ID occurrence
       / leave original extraction order
    */

    return questions;
}


/* =========================================
   FIREBASE HTTP FUNCTION
========================================= */

exports.parseDigialm =
    onRequest(
        {
            region:"asia-south1",

            cors:true,

            timeoutSeconds:60,

            memory:"512MiB"
        },

        async(req,res)=>{

            try{

                if(
                    req.method !== "POST"
                ){

                    return res
                        .status(405)
                        .json({
                            error:
                                "POST request required."
                        });
                }


                const url =
                    String(
                        req.body?.url || ""
                    ).trim();


                if(!url){

                    return res
                        .status(400)
                        .json({
                            error:
                                "Digialm URL missing."
                        });
                }


                /*
                   Security:
                   Only Digialm domains
                */

                let parsedUrl;


                try{

                    parsedUrl =
                        new URL(url);

                }catch(error){

                    return res
                        .status(400)
                        .json({
                            error:
                                "Invalid URL."
                        });
                }


                const hostname =
                    parsedUrl.hostname
                    .toLowerCase();


                if(
                    !hostname.endsWith(
                        "digialm.com"
                    )
                ){

                    return res
                        .status(400)
                        .json({
                            error:
                                "Only Digialm URLs are allowed."
                        });
                }


                logger.info(
                    "Fetching Digialm URL",
                    {
                        hostname
                    }
                );


                /*
                   Fetch page
                */

                const response =
                    await fetch(
                        url,
                        {
                            method:"GET",

                            redirect:"follow",

                            headers:{

                                "User-Agent":
                                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",

                                "Accept":
                                "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

                                "Accept-Language":
                                "en-US,en;q=0.9"

                            }
                        }
                    );


                if(!response.ok){

                    return res
                        .status(502)
                        .json({

                            error:
                            `Digialm server returned HTTP ${response.status}. The URL may require the candidate's session/cookies or may block server requests.`

                        });
                }


                const html =
                    await response.text();


                if(!html){

                    return res
                        .status(502)
                        .json({
                            error:
                                "Empty Digialm response."
                        });
                }


                /*
                   Parse
                */

                const questions =
                    parseDigialmHTML(
                        html
                    );


                if(!questions.length){

                    return res
                        .status(422)
                        .json({

                            error:
                            "Questions could not be detected from this Digialm page."

                        });
                }


                const answered =
                    questions.filter(
                        q =>
                            q.status ===
                            "answered"
                    ).length;


                const notAttempted =
                    questions.filter(
                        q =>
                            q.status ===
                            "not_attempted"
                    ).length;


                const correctDetected =
                    questions.filter(
                        q =>
                            q.correctOption !==
                            null
                    ).length;


                return res
                    .status(200)
                    .json({

                        success:true,

                        totalQuestions:
                            questions.length,

                        answered,

                        notAttempted,

                        correctAnswersDetected:
                            correctDetected,

                        questions

                    });


            }catch(error){

                logger.error(
                    "Digialm parser error",
                    error
                );


                return res
                    .status(500)
                    .json({

                        error:
                        error.message ||
                        "Internal parser error."

                    });
            }

        }
    );