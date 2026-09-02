import { db, doc, getDoc, updateDoc } from "./db.js";
import { getParams, buildLink } from "./util.js";
import { ANSWER_OPTIONS } from "./options.js";

const params = getParams();
const sessionId = params.get("session");
const role = params.get("role"); // "a" or "b"

const panels = {
  loading: document.getElementById("loading-panel"),
  error: document.getElementById("error-panel"),
  alreadyDone: document.getElementById("already-done-panel"),
  consent: document.getElementById("consent-panel"),
  quiz: document.getElementById("quiz-panel"),
  done: document.getElementById("done-panel"),
};

function showOnly(name) {
  Object.entries(panels).forEach(([key, el]) => {
    el.style.display = key === name ? "block" : "none";
  });
}

function showError(message) {
  document.getElementById("error-text").textContent = message;
  showOnly("error");
}

if (!sessionId || !(role === "a" || role === "b")) {
  showError("This link looks incomplete. Ask for a fresh link from whoever set up the quiz.");
  throw new Error("invalid params");
}

const Role = role === "a" ? "A" : "B";
const draftKey = `quiz_draft_${sessionId}_${role}`;

let categories = [];
let questions = [];
let orderedQuestions = [];
let currentIndex = 0;
let answers = {};

async function init() {
  let sessionSnap;
  try {
    [categories, questions, sessionSnap] = await Promise.all([
      fetch("data/categories.json").then((r) => r.json()),
      fetch("data/questions.json").then((r) => r.json()),
      getDoc(doc(db, "sessions", sessionId)),
    ]);
  } catch (err) {
    console.error(err);
    showError("Couldn't load the quiz. Check your connection and try again.");
    return;
  }

  if (!sessionSnap.exists()) {
    showError("This quiz session doesn't exist. Double-check the link.");
    return;
  }

  const data = sessionSnap.data();
  if (data[`completed${Role}`]) {
    document.getElementById("already-done-results-link").href = buildLink("results.html", {
      session: sessionId,
      role,
    });
    showOnly("alreadyDone");
    return;
  }

  orderedQuestions = orderByCategory(questions, categories);

  const draft = loadDraft();
  if (draft) {
    answers = draft.answers || {};
    currentIndex = Math.min(draft.index || 0, orderedQuestions.length - 1);
  }

  showOnly("consent");
}

function orderByCategory(qs, cats) {
  const rank = new Map(cats.map((c, i) => [c, i]));
  return [...qs].sort((a, b) => {
    const ra = rank.has(a.category) ? rank.get(a.category) : cats.length;
    const rb = rank.has(b.category) ? rank.get(b.category) : cats.length;
    return ra - rb;
  });
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(draftKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft() {
  try {
    localStorage.setItem(draftKey, JSON.stringify({ index: currentIndex, answers }));
  } catch {
    /* ignore storage errors */
  }
}

// --- Consent gate ---
const checkbox = document.getElementById("consent-checkbox");
const beginBtn = document.getElementById("begin-btn");
checkbox.addEventListener("change", () => {
  beginBtn.disabled = !checkbox.checked;
});
beginBtn.addEventListener("click", () => {
  showOnly("quiz");
  renderQuestion();
});

// --- Quiz rendering ---
const answerGrid = document.getElementById("answer-grid");
const backBtn = document.getElementById("back-btn");
const nextBtn = document.getElementById("next-btn");

function renderQuestion() {
  const q = orderedQuestions[currentIndex];
  const total = orderedQuestions.length;

  document.getElementById("progress-fill").style.width = `${(currentIndex / total) * 100}%`;
  document.getElementById("progress-label").textContent = `Question ${currentIndex + 1} of ${total}`;
  document.getElementById("question-category").textContent = q.category;
  document.getElementById("question-text").textContent = q.text;

  const noteEl = document.getElementById("question-note");
  if (q.note) {
    noteEl.textContent = q.note;
    noteEl.style.display = "block";
  } else {
    noteEl.style.display = "none";
  }

  answerGrid.innerHTML = "";
  ANSWER_OPTIONS.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer-btn";
    btn.dataset.tier = opt.tier;
    btn.dataset.code = opt.code;
    if (answers[q.id] === opt.code) btn.classList.add("selected");
    btn.innerHTML = `<span class="label">${opt.label}</span>`;
    btn.addEventListener("click", () => selectAnswer(q.id, opt.code));
    answerGrid.appendChild(btn);
  });

  backBtn.disabled = currentIndex === 0;
  nextBtn.disabled = !answers[q.id];
  nextBtn.textContent = currentIndex === total - 1 ? "Finish" : "Next";
}

function selectAnswer(qId, code) {
  answers[qId] = code;
  saveDraft();
  [...answerGrid.children].forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.code === code);
  });
  nextBtn.disabled = false;
}

backBtn.addEventListener("click", () => {
  if (currentIndex === 0) return;
  currentIndex -= 1;
  saveDraft();
  renderQuestion();
});

nextBtn.addEventListener("click", async () => {
  const isLast = currentIndex === orderedQuestions.length - 1;
  if (!isLast) {
    currentIndex += 1;
    saveDraft();
    renderQuestion();
    return;
  }
  await submitQuiz();
});

async function submitQuiz() {
  nextBtn.disabled = true;
  nextBtn.textContent = "Saving\u2026";
  try {
    await updateDoc(doc(db, "sessions", sessionId), {
      [`answers${Role}`]: answers,
      [`completed${Role}`]: true,
      [`completedAt${Role}`]: Date.now(),
    });
    localStorage.removeItem(draftKey);

    const resultsLink = buildLink("results.html", { session: sessionId, role });
    document.getElementById("results-link").value = resultsLink;
    document.getElementById("results-go-link").href = resultsLink;
    document.getElementById("done-message").textContent =
      "Your answers are saved privately. Once your partner finishes too, this link will show your shared results.";
    showOnly("done");
  } catch (err) {
    console.error(err);
    nextBtn.disabled = false;
    nextBtn.textContent = "Finish";
    alert("Couldn't save your answers. Check your connection and try again.");
  }
}

init();
