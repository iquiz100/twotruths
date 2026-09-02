import { db, doc, getDoc, updateDoc } from "./db.js";
import { getParams, buildLink } from "./util.js";
import { ANSWER_OPTIONS } from "./options.js";
import { resolveText } from "./templating.js";

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
let pages = []; // [{ category, items: [question, ...] }, ...]
let currentIndex = 0; // now indexes into `pages`, not individual questions
let answers = {};
let nicknames = { A: "your partner", B: "your partner" };

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
  nicknames = { A: data.nicknameA, B: data.nicknameB };
  if (data[`completed${Role}`]) {
    document.getElementById("already-done-results-link").href = buildLink("results.html", {
      session: sessionId,
      role,
    });
    showOnly("alreadyDone");
    return;
  }

  pages = buildPages(questions, categories);

  const draft = loadDraft();
  if (draft) {
    answers = draft.answers || {};
    currentIndex = Math.min(draft.index || 0, pages.length - 1);
  }

  showOnly("consent");
}

// Groups questions into one page per category, in category order (any
// question whose category isn't in categories.json lands on a trailing
// "More" page).
function buildPages(qs, cats) {
  const byCategory = new Map(cats.map((c) => [c, []]));
  const other = [];
  qs.forEach((q) => {
    const bucket = byCategory.has(q.category) ? byCategory.get(q.category) : other;
    bucket.push(q);
  });
  const result = [];
  for (const [category, items] of byCategory) {
    if (items.length > 0) result.push({ category, items });
  }
  if (other.length > 0) result.push({ category: "More", items: other });
  return result;
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
  renderPage();
});

// --- Quiz rendering ---
const questionsList = document.getElementById("questions-list");
const pageCategoryEl = document.getElementById("page-category");
const backBtn = document.getElementById("back-btn");
const nextBtn = document.getElementById("next-btn");

function renderPage() {
  const page = pages[currentIndex];
  const totalPages = pages.length;

  document.getElementById("progress-fill").style.width = `${(currentIndex / totalPages) * 100}%`;
  document.getElementById("progress-label").textContent = `Section ${currentIndex + 1} of ${totalPages}`;
  pageCategoryEl.textContent = page.category;

  questionsList.innerHTML = "";
  page.items.forEach((q) => {
    questionsList.appendChild(buildQuestionBlock(q));
  });

  backBtn.disabled = currentIndex === 0;
  updateNextState();
  nextBtn.textContent = currentIndex === totalPages - 1 ? "Finish" : "Next";

  // On mobile, the tapped Next/Back button stays focused, and once the new
  // (often shorter) content lays out, the browser scrolls that focused
  // button back into view — which cancels a scroll-to-top called earlier.
  // Blurring it and deferring a frame avoids that fight.
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
}

function buildQuestionBlock(q) {
  const block = document.createElement("div");
  block.className = "question-block";
  block.dataset.questionId = q.id;

  const textEl = document.createElement("div");
  textEl.className = "question-text";
  textEl.textContent = resolveText(q, role, nicknames);
  block.appendChild(textEl);

  if (q.note) {
    const noteEl = document.createElement("div");
    noteEl.className = "question-note";
    noteEl.textContent = q.note;
    block.appendChild(noteEl);
  }

  const grid = document.createElement("div");
  grid.className = "answer-grid";
  ANSWER_OPTIONS.forEach((opt) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer-btn";
    btn.dataset.tier = opt.tier;
    btn.dataset.code = opt.code;
    if (answers[q.id] === opt.code) btn.classList.add("selected");
    btn.innerHTML = `<span class="label">${opt.label}</span>`;
    btn.addEventListener("click", () => selectAnswer(q.id, opt.code, grid));
    grid.appendChild(btn);
  });
  block.appendChild(grid);

  return block;
}

function updateNextState() {
  const page = pages[currentIndex];
  nextBtn.disabled = !page.items.every((q) => answers[q.id]);
}

function selectAnswer(qId, code, grid) {
  answers[qId] = code;
  saveDraft();
  [...grid.children].forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.code === code);
  });
  updateNextState();
}

backBtn.addEventListener("click", () => {
  if (currentIndex === 0) return;
  currentIndex -= 1;
  saveDraft();
  renderPage();
});

nextBtn.addEventListener("click", async () => {
  const isLast = currentIndex === pages.length - 1;
  if (!isLast) {
    currentIndex += 1;
    saveDraft();
    renderPage();
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