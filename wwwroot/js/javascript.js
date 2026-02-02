// ===============================
// מצב גלובלי
// ===============================
var currentQuestion = null;

// MCQ attempts
var MAX_ATTEMPTS = 2;
var attemptsLeft = MAX_ATTEMPTS;
var locked = false;

// מאגרי נושאים לפי רמה (אפשר להרחיב)
var juniorPool = [
    { domain: "JavaScript", concept: "variables" },
    { domain: "JavaScript", concept: "input_output" },
    { domain: "JavaScript", concept: "conditions" },
    { domain: "JavaScript", concept: "functions" },
    { domain: "JavaScript", concept: "loops" },
    { domain: "JavaScript", concept: "arrays" },
    { domain: "HTML", concept: "basic_tags" },
    { domain: "CSS", concept: "basic_selectors" }
];

var seniorPool = [
    { domain: "JavaScript", concept: "functions" },
    { domain: "JavaScript", concept: "arrays" },
    { domain: "JavaScript", concept: "objects" },
    { domain: "JavaScript", concept: "events" },
    { domain: "JavaScript", concept: "dom" }
];

// ===============================
// DOM Ready
// ===============================
document.addEventListener("DOMContentLoaded", function () {
    var btn = document.getElementById("btnGenerate");
    if (btn) {
        btn.addEventListener("click", function () {
            generateQuestion();
        });
    }

    // מצב התחלתי של כפתורי משוב
    setActionButtons(false, false);
});

// ===============================
// עזר: רנדומלי
// ===============================
function pickRandom(arr) {
    var i = Math.floor(Math.random() * arr.length);
    return arr[i];
}

// ===============================
// מצב טעינה
// ===============================
function setLoadingState(isLoading) {
    var btn = document.getElementById("btnGenerate");
    var qTitle = document.getElementById("questionTitle");
    var qText = document.getElementById("questionText");
    var codeBox = document.getElementById("codeBox");

    if (!btn || !qTitle || !qText || !codeBox) return;

    if (isLoading) {
        btn.disabled = true;
        btn.innerText = "מייצרת שאלה...";
        qTitle.innerText = "טוענת שאלה...";
        qText.innerText = "עוד רגע 🙂";
        codeBox.innerText = "// טוען קוד...";
    } else {
        btn.disabled = false;
        btn.innerText = "צור שאלה";
    }
}

// ===============================
// כפתורי משוב (נסי שוב / שאלה נוספת)
// ===============================
function setActionButtons(showRetry, showNext) {
    var actions = document.getElementById("feedbackActions");
    var btnRetry = document.getElementById("btnRetry");
    var btnNext = document.getElementById("btnNext");

    if (!actions || !btnRetry || !btnNext) return;

    actions.style.display = (showRetry || showNext) ? "flex" : "none";
    btnRetry.style.display = showRetry ? "inline-block" : "none";
    btnNext.style.display = showNext ? "inline-block" : "none";
}

// ===============================
// נעילה / פתיחה תשובות
// ===============================
function lockAnswers() {
    locked = true;
    for (var i = 0; i < 3; i++) {
        var b = document.getElementById("ans" + i);
        if (b) b.classList.add("is-disabled");
    }
}

function unlockAnswers() {
    locked = false;
    for (var i = 0; i < 3; i++) {
        var b = document.getElementById("ans" + i);
        if (b) b.classList.remove("is-disabled");
    }
}

function resetAnswerStyles() {
    for (var i = 0; i < 3; i++) {
        var b = document.getElementById("ans" + i);
        if (!b) continue;
        b.classList.remove("is-correct", "is-wrong");
    }
}

function markAnswer(index, isCorrect) {
    var b = document.getElementById("ans" + index);
    if (!b) return;
    if (isCorrect) b.classList.add("is-correct");
    else b.classList.add("is-wrong");
}

// ===============================
// נסי שוב
// ===============================
function retryQuestion() {
    hideFeedback();
    setActionButtons(false, false);
    resetAnswerStyles();
    unlockAnswers();
}

// ===============================
// 1) יצירת שאלה מהשרת
// ===============================
async function generateQuestion() {
    hideFeedback();
    setActionButtons(false, false);
    setLoadingState(true);

    // reset state
    attemptsLeft = MAX_ATTEMPTS;
    locked = false;
    resetAnswerStyles();
    unlockAnswers();

    var levelEl = document.getElementById("levelSelect");
    var typeEl = document.getElementById("typeSelect");

    if (!levelEl || !typeEl) {
        showFeedback("חסר שדה רמה או סוג שאלה בדף.");
        setLoadingState(false);
        return;
    }

    var level = levelEl.value; // junior / senior
    var qType = typeEl.value;  // mcq / open

    var pool = (level === "senior") ? seniorPool : juniorPool;
    var picked = pickRandom(pool);

    var body = {
        domain: picked.domain,
        concept: picked.concept,
        questionType: qType,
        level: level
    };

    var url = "/api/GPT/GPTChat";

    try {
        var res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            var errText = await res.text();
            showFeedback("יש בעיה בבקשה לשרת:\n" + errText);
            setLoadingState(false);
            return;
        }

        var data = await res.json();
        currentQuestion = data;

        renderQuestion(data);
        setLoadingState(false);

        await generateImageForQuestion(body, data);

    } catch (e) {
        showFeedback("אופס 😅 משהו השתבש (בדקי Console).");
        console.log(e);
        setLoadingState(false);
    }
}

// ===============================
// 2) הצגת השאלה במסך
// ===============================
function renderQuestion(q) {
    var titleEl = document.getElementById("questionTitle");
    var textEl = document.getElementById("questionText");
    var codeEl = document.getElementById("codeBox");

    if (titleEl) titleEl.innerText = q.title || "שאלה";
    if (textEl) textEl.innerText = q.questionText || "";
    if (codeEl) codeEl.innerText = q.code || "";

    var mcqArea = document.getElementById("mcqArea");
    var openArea = document.getElementById("openArea");

    if (mcqArea) mcqArea.style.display = "none";
    if (openArea) openArea.style.display = "none";

    // איפוס תמונה
    resetQuestionImageUI();

    // MCQ
    if (q.questionType === "mcq") {
        if (mcqArea) mcqArea.style.display = "flex";

        var opt0 = document.getElementById("opt0");
        var opt1 = document.getElementById("opt1");
        var opt2 = document.getElementById("opt2");

        if (q.options && q.options.length >= 3) {
            if (opt0) opt0.innerText = q.options[0];
            if (opt1) opt1.innerText = q.options[1];
            if (opt2) opt2.innerText = q.options[2];
        } else {
            if (opt0) opt0.innerText = "";
            if (opt1) opt1.innerText = "";
            if (opt2) opt2.innerText = "";
        }
    }

    // OPEN
    if (q.questionType === "open") {
        if (openArea) openArea.style.display = "block";
        var openAnswer = document.getElementById("openAnswer");
        if (openAnswer) openAnswer.value = "";
    }
}

// ===============================
// 3) בחירת תשובה אמריקאית – 2 ניסיונות + כפתורים
// ===============================
function chooseOption(index) {
    if (!currentQuestion) return;
    if (currentQuestion.questionType !== "mcq") return;
    if (locked) return;

    resetAnswerStyles();

    var isCorrect = (index === currentQuestion.correctIndex);

    if (isCorrect) {
        markAnswer(index, true);
        lockAnswers();
        popConfetti(index);
        showFeedback("אלופה! ✅ תשובה נכונה\n\n" + (currentQuestion.explanation || ""));
        setActionButtons(false, true); // שאלה נוספת
        return;
    }

    // טעות
    attemptsLeft = attemptsLeft - 1;
    markAnswer(index, false);

    if (attemptsLeft > 0) {
        lockAnswers();
        showFeedback("כמעט 🙂 ❌ לא נכון.\nיש לך עוד ניסיון אחד.");
        setActionButtons(true, false); // נסי שוב
        return;
    }

    // ניסיון 2: מסמנים גם את הנכונה
    lockAnswers();
    markAnswer(currentQuestion.correctIndex, true);
    showFeedback("לא נורא 💗 הפעם זה לא זה.\n\n" + (currentQuestion.explanation || ""));
    setActionButtons(false, true); // שאלה נוספת
}

// ===============================
// 4) שאלה פתוחה (משוב מקומי)
// ===============================
function submitOpen() {
    if (!currentQuestion) return;
    if (currentQuestion.questionType !== "open") return;

    var userTextEl = document.getElementById("openAnswer");
    if (!userTextEl) return;

    var userText = userTextEl.value;

    if (!userText || userText.trim().length < 2) {
        showFeedback("כתבי תשובה קצרה לפני שליחה 🙂");
        return;
    }

    var msg = "קיבלתי 🙌\n\n";

    if (currentQuestion.openAnswerExample) {
        msg += "דוגמת תשובה:\n" + currentQuestion.openAnswerExample + "\n\n";
    }

    if (currentQuestion.expectedKeyPoints && currentQuestion.expectedKeyPoints.length > 0) {
        msg += "נקודות שכדאי שיהיו בתשובה:\n";
        for (var i = 0; i < currentQuestion.expectedKeyPoints.length; i++) {
            msg += "• " + currentQuestion.expectedKeyPoints[i] + "\n";
        }
        msg += "\n";
    }

    msg += (currentQuestion.explanation || "");
    showFeedback(msg);
    setActionButtons(false, true); // שאלה נוספת
}

// ===============================
// תמונה – UI
// ===============================
function resetQuestionImageUI() {
    var img = document.getElementById("questionImg");
    var hint = document.getElementById("imgHint");

    if (!img || !hint) return;

    img.style.display = "none";
    img.src = "";
    hint.style.display = "block";
    hint.innerText = "מכינה תמונה לשאלה...";
}

// ===============================
// 5) DALLE
// ===============================
async function generateImageForQuestion(bodyForQuestion, questionFromGPT) {
    var img = document.getElementById("questionImg");
    var hint = document.getElementById("imgHint");

    if (!img || !hint) return;

    img.style.display = "none";
    hint.style.display = "block";
    hint.innerText = "מייצרת תמונה...";

    var prompt = buildImageHint(bodyForQuestion, questionFromGPT);

    var body = { prompt: prompt };
    var url = "/api/GPT/Dalle";

    try {
        var res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        if (!res.ok) {
            var err = await res.text();
            hint.style.display = "block";
            hint.innerText = "לא הצלחתי לייצר תמונה 😅";
            console.log(err);
            return;
        }

        var imageUrl = await res.text();
        imageUrl = imageUrl.replaceAll("\"", "");

        img.src = imageUrl;
        img.style.display = "block";
        hint.style.display = "none";

    } catch (e) {
        hint.style.display = "block";
        hint.innerText = "לא הצלחתי לייצר תמונה 😅";
        console.log(e);
    }
}

function buildImageHint(bodyForQuestion, q) {
    var base =
        "Cute flat vector illustration of a teen girl programmer with a laptop, pastel pink background, purple accents, " +
        "friendly educational vibe, clean simple shapes, NO text, NO letters, NO logos, NO watermark. ";

    var d = bodyForQuestion && bodyForQuestion.domain ? bodyForQuestion.domain : "";
    var c = bodyForQuestion && bodyForQuestion.concept ? bodyForQuestion.concept : "";

    if (d === "HTML") return base + "Add a simple browser window and webpage layout icons (no text).";
    if (d === "CSS") return base + "Add a color palette, layout grid, and styled card icons (no text).";

    if (c === "arrays") return base + "Add small boxes in a row representing an array.";
    if (c === "objects") return base + "Add small key-value cards icons (no text).";
    if (c === "functions") return base + "Add flow arrows and connected blocks icons.";
    if (c === "conditions") return base + "Add branching arrows and decision sign icons.";
    if (c === "loops") return base + "Add circular arrows icons.";

    return base + "Simple coding-themed background elements.";
}

// ===============================
// קונפטי
// ===============================
function popConfetti(answerIndex) {
    var btn = document.getElementById("ans" + answerIndex);
    if (!btn) return;

    // ניצור 18 חלקיקים
    for (var i = 0; i < 18; i++) {
        var p = document.createElement("span");
        p.className = "qb-confetti";

        // צבעים אקראיים נעימים
        var colors = ["#6d5efc", "#ff4d6d", "#20c997", "#ffd43b", "#7dd3fc"];
        p.style.background = colors[Math.floor(Math.random() * colors.length)];

        // נגדיר את המשתנים שה־CSS מחפש (וככה גם ה־IDE פחות יתלונן)
        var dx = (Math.random() * 160 - 80).toFixed(0) + "px";
        var dy = (Math.random() * 160 - 80).toFixed(0) + "px";
        var rot = (Math.random() * 260 - 130).toFixed(0) + "deg";

        p.style.setProperty("--dx", dx);
        p.style.setProperty("--dy", dy);
        p.style.setProperty("--rot", rot);

        btn.appendChild(p);

        // ניקוי
        (function (node) {
            setTimeout(function () {
                if (node && node.parentNode) node.parentNode.removeChild(node);
            }, 800);
        })(p);
    }
}

// ===============================
// משוב
// ===============================
function showFeedback(text) {
    var box = document.getElementById("feedbackBox");
    if (!box) return;

    box.style.display = "block";
    box.innerText = text;
}

function hideFeedback() {
    var box = document.getElementById("feedbackBox");
    if (!box) return;

    box.style.display = "none";
    box.innerText = "";
}
