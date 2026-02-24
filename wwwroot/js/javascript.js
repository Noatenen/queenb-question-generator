// ===============================
// QueenB Chat Quiz – FINAL
// - Spinner fixed (CSS)
// - Feedback white box via CSS classes only
// - Reset wrong marks between attempts
// - Explanation always shows if exists
// - Confetti higher + nicer
// - Hide next button while loading
// ===============================

// מצב גלובלי
var currentQuestion = null;
var MAX_ATTEMPTS = 2;
var attemptsLeft = MAX_ATTEMPTS;
var locked = false;

// שרשור
var previousResponseId = null;

// סוג שאלה שיוגרל
var currentQuestionType = "mcq";

// DOM
var dom = {
    levelSelect: document.getElementById("levelSelect"),
    loadingOverlay: document.getElementById("loadingOverlay"),
    questionCard: document.getElementById("questionCard"),
    questionText: document.getElementById("questionText"),
    questionContentWrapper: document.getElementById("questionContentWrapper"),
    codeContainer: document.getElementById("codeContainer"),
    codeBox: document.getElementById("codeBox"),
    imageContainer: document.getElementById("imageContainer"),
    questionImg: document.getElementById("questionImg"),
    btnAction: document.getElementById("btnAction"),
    mcqArea: document.getElementById("mcqArea"),
    openArea: document.getElementById("openArea"),
    openAnswer: document.getElementById("openAnswer"),
    feedbackBox: document.getElementById("feedbackBox"),
    chatReplies: document.getElementById("chatReplies"),
    confettiLayer: document.getElementById("confettiLayer")
};

// init
(function init() {
    if (!dom.levelSelect) {
        console.error("Missing #levelSelect in HTML");
        return;
    }

    if (dom.questionCard) dom.questionCard.classList.add("is-hidden");
    dom.levelSelect.addEventListener("change", onLevelChanged);
})();

// ===============================
// בחירת רמה
// ===============================
function onLevelChanged() {
    if (!dom.levelSelect.value) return;

    renderUserBubble(dom.levelSelect.options[dom.levelSelect.selectedIndex].text);

    if (dom.questionCard) dom.questionCard.classList.remove("is-hidden");
    if (dom.questionText) dom.questionText.innerText = "";

    hideActionButton();

    currentQuestionType = Math.random() < 0.5 ? "mcq" : "open";

    setTimeout(function () {
        generateQuestion();
    }, 350);
}

function renderUserBubble(text) {
    if (!dom.chatReplies) return;

    dom.chatReplies.innerHTML = "";
    var b = document.createElement("div");
    b.className = "qb-user-bubble";
    b.innerText = text;
    dom.chatReplies.appendChild(b);
}

// ===============================
// יצירת שאלה
// ===============================
async function generateQuestion() {
    if (!dom.levelSelect || !dom.levelSelect.value) return;

    setLoading(true);
    resetUI(true);

    try {
        var requestBody = {
            Level: dom.levelSelect.value,
            QuestionType: currentQuestionType,
            Domain: "JavaScript",
            Concept: "general",
            FileId: null,
            PreviousResponseID: previousResponseId
        };

        var resQuestion = await fetch("/api/GPT/GPTChatFromPdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody)
        });

        if (!resQuestion.ok) {
            var errText = await resQuestion.text();
            console.error("GPTChatFromPdf error:", errText);
            showInlineError("אופס… משהו השתבש. נסי שוב.");
            return;
        }

        var data = await resQuestion.json();
        previousResponseId = data.responseID;

        currentQuestion = JSON.parse(data.text);
        currentQuestion.questionType = currentQuestionType;

        await tryGenerateImage(currentQuestion);

        renderQuestion(currentQuestion);
    } catch (e) {
        console.error("generateQuestion exception:", e);
        showInlineError("אופס… משהו השתבש. נסי שוב.");
    } finally {
        setLoading(false);
    }
}

async function tryGenerateImage(q) {
    try {
        var resImage = await fetch("/api/GPT/Dalle", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt: "QueenB coding girl, " + (q.questionText || "") })
        });

        if (resImage.ok) {
            var url = await resImage.text();
            q.imageUrl = url.replaceAll('"', "");
        }
    } catch (e) {
        // לא מפיל
    }
}

// ===============================
// רינדור שאלה
// ===============================
function renderQuestion(q) {
    if (!q) return;

    if (dom.questionText) dom.questionText.innerText = q.questionText || "";

    var hasContent = false;

    if (q.code && dom.codeContainer && dom.codeBox) {
        dom.codeBox.innerText = q.code;
        dom.codeContainer.style.display = "block";
        hasContent = true;
    }

    if (q.imageUrl && dom.imageContainer && dom.questionImg) {
        dom.questionImg.src = q.imageUrl;
        dom.imageContainer.style.display = "flex";
        hasContent = true;
    }

    if (dom.questionContentWrapper) {
        dom.questionContentWrapper.style.display = hasContent ? "block" : "none";
    }

    attemptsLeft = MAX_ATTEMPTS;
    locked = false;

    resetAnswerStyles();

    if (q.questionType === "mcq") showMCQ(q);
    else showOpen();
}

function showMCQ(q) {
    if (dom.mcqArea) dom.mcqArea.style.display = "flex";
    if (dom.openArea) dom.openArea.style.display = "none";

    hideActionButton();

    for (var i = 0; i < 3; i++) {
        var optSpan = document.getElementById("opt" + i);
        if (optSpan) optSpan.innerText = (q.options && q.options[i] != null) ? q.options[i] : "";
    }

    for (var j = 0; j < 3; j++) {
        var btn = document.getElementById("ans" + j);
        if (btn) btn.style.pointerEvents = "auto";
    }
}

function showOpen() {
    if (dom.openArea) dom.openArea.style.display = "block";
    if (dom.mcqArea) dom.mcqArea.style.display = "none";

    showActionButton("שלחי תשובה ✅", "submit-open");
}

// ===============================
// בחירת תשובה (MCQ)
// ===============================
function chooseOption(index) {
    if (locked || !currentQuestion) return;

    // בכל ניסיון חדש – לנקות רק אדומים קודמים
    clearWrongMarksOnly();

    var btn = document.getElementById("ans" + index);
    if (!btn) return;

    var isCorrect = (index === currentQuestion.correctIndex);

    if (isCorrect) {
        btn.classList.add("is-correct");
        locked = true;

        showFeedback("אלופה! תשובה נכונה 🎉", "success", getExplanationText(currentQuestion, true));
        popConfetti();
        showNextButton();
    } else {
        attemptsLeft--;
        btn.classList.add("is-wrong");

        if (attemptsLeft > 0) {
            showFeedback("לא בדיוק… יש לך עוד ניסיון 💪", "try", "");
        } else {
            locked = true;

            var rightBtn = document.getElementById("ans" + currentQuestion.correctIndex);
            if (rightBtn) rightBtn.classList.add("is-correct");

            showFeedback("הפעם לא, אבל לא נורא!", "error", getExplanationText(currentQuestion, false));
            showNextButton();
        }
    }
}

// ===============================
// כפתור פעולה
// ===============================
function handleActionButtonClick() {
    if (!dom.btnAction) return;

    var state = dom.btnAction.dataset.state;

    if (state === "next") {
        currentQuestionType = Math.random() < 0.5 ? "mcq" : "open";
        generateQuestion();
    } else if (state === "submit-open") {
        var val = dom.openAnswer ? dom.openAnswer.value.trim() : "";
        if (!val) {
            showFeedback("אל תשכחי לכתוב משהו 😉", "try", "");
            return;
        }

        showFeedback("קיבלתי!", "success", getExplanationText(currentQuestion, true));
        popConfetti();
        showNextButton();
    }
}

function showNextButton() {
    showActionButton("לשאלה הבאה ⬅️", "next");

    for (var i = 0; i < 3; i++) {
        var b = document.getElementById("ans" + i);
        if (b) b.style.pointerEvents = "none";
    }
}

function showActionButton(text, state) {
    if (!dom.btnAction) return;
    dom.btnAction.style.display = "block";
    dom.btnAction.innerText = text;
    dom.btnAction.dataset.state = state;
}

function hideActionButton() {
    if (!dom.btnAction) return;
    dom.btnAction.style.display = "none";
}

// ===============================
// UI helpers
// ===============================
function resetUI(isNewQuestion) {
    if (dom.questionContentWrapper) dom.questionContentWrapper.style.display = "none";
    if (dom.codeContainer) dom.codeContainer.style.display = "none";
    if (dom.imageContainer) dom.imageContainer.style.display = "none";
    if (dom.mcqArea) dom.mcqArea.style.display = "none";
    if (dom.openArea) dom.openArea.style.display = "none";

    if (dom.openAnswer) dom.openAnswer.value = "";

    if (dom.feedbackBox) {
        dom.feedbackBox.style.display = "none";
        dom.feedbackBox.innerText = "";
        dom.feedbackBox.classList.remove("is-success", "is-error", "is-try");
    }

    if (isNewQuestion) {
        resetAnswerStyles();
        hideActionButton();
    }
}

function resetAnswerStyles() {
    for (var i = 0; i < 3; i++) {
        var btn = document.getElementById("ans" + i);
        if (btn) {
            btn.classList.remove("is-correct", "is-wrong");
            btn.style.pointerEvents = "auto";
        }
    }
}

function clearWrongMarksOnly() {
    for (var i = 0; i < 3; i++) {
        var btn = document.getElementById("ans" + i);
        if (btn) btn.classList.remove("is-wrong");
    }
}

function setLoading(isLoading) {
    if (dom.loadingOverlay) dom.loadingOverlay.classList.toggle("active", isLoading);

    // בזמן טעינה: לא להראות כפתור "לשאלה הבאה"
    if (isLoading) hideActionButton();
}

function showFeedback(titleText, type, explanationText) {
    if (!dom.feedbackBox) return;

    var finalText = titleText;
    if (explanationText) finalText += "\n" + explanationText;

    dom.feedbackBox.innerText = finalText;
    dom.feedbackBox.style.display = "block";

    dom.feedbackBox.classList.remove("is-success", "is-error", "is-try");
    if (type === "success") dom.feedbackBox.classList.add("is-success");
    else if (type === "try") dom.feedbackBox.classList.add("is-try");
    else dom.feedbackBox.classList.add("is-error");
}

function showInlineError(msg) {
    if (dom.questionText) dom.questionText.innerText = msg;
    showActionButton("נסי שוב 🔄", "next");
}

// ===============================
// Explanation extractor (robust)
// ===============================
function getExplanationText(q, isSuccess) {
    if (!q) return "";

    var exp =
        q.explanation ||
        q.explain ||
        q.solution ||
        q.feedback ||
        q.rationale ||
        "";

    if (typeof exp === "object" && exp) {
        if (isSuccess && exp.correct) return String(exp.correct);
        if (!isSuccess && exp.wrong) return String(exp.wrong);
        try { return JSON.stringify(exp); } catch (e) { return ""; }
    }

    return String(exp || "").trim();
}

// ===============================
// Confetti (higher burst)
// ===============================
function popConfetti() {
    if (!dom.confettiLayer) return;

    dom.confettiLayer.innerHTML = "";

    for (var i = 0; i < 22; i++) {
        var p = document.createElement("span");
        p.className = "qb-confetti";

        p.style.right = (10 + Math.random() * 80) + "%";

        p.style.width = (7 + Math.random() * 6) + "px";
        p.style.height = (10 + Math.random() * 10) + "px";

        var colors = ["#6d5efc", "#ff7fa0", "#20c997", "#ffd43b", "#ff4d6d"];
        p.style.background = colors[Math.floor(Math.random() * colors.length)];

        var rise = 160 + Math.random() * 120;      // יותר גבוה
        var drift = (Math.random() * 140) - 70;    // יותר סטייה

        p.style.setProperty("--rise", rise + "px");
        p.style.setProperty("--drift", drift + "px");

        p.style.animationDelay = (Math.random() * 120) + "ms";

        dom.confettiLayer.appendChild(p);
    }

    setTimeout(function () {
        if (dom.confettiLayer) dom.confettiLayer.innerHTML = "";
    }, 1400);
}
