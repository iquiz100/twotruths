import { db, doc, getDoc } from "./db.js";
import { getParams } from "./util.js";
import { classify, isHardLimit } from "./matching.js";
import { resolveText } from "./templating.js";

const params = getParams();
const sessionId = params.get("session");
const role = params.get("role");

const panels = {
  loading: document.getElementById("loading-panel"),
  error: document.getElementById("error-panel"),
  waiting: document.getElementById("waiting-panel"),
  results: document.getElementById("results-panel"),
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
const OtherRole = role === "a" ? "B" : "A";

let categories = [];
let questions = [];

async function load() {
  showOnly("loading");
  let sessionSnap;
  try {
    [categories, questions, sessionSnap] = await Promise.all([
      categories.length ? categories : fetch("data/categories.json").then((r) => r.json()),
      questions.length ? questions : fetch("data/questions.json").then((r) => r.json()),
      getDoc(doc(db, "sessions", sessionId)),
    ]);
  } catch (err) {
    console.error(err);
    showError("Couldn't load results. Check your connection and try again.");
    return;
  }

  if (!sessionSnap.exists()) {
    showError("This quiz session doesn't exist. Double-check the link.");
    return;
  }

  const data = sessionSnap.data();

  if (!(data.completedA && data.completedB)) {
    const waitingOn = data[`completed${OtherRole}`] ? "you" : data[`nickname${OtherRole}`];
    document.getElementById("waiting-text").textContent = data[`completed${OtherRole}`]
      ? "Your partner is waiting on you \u2014 finish your quiz to see results."
      : `Waiting on ${waitingOn} to finish their quiz. This page will show your results as soon as they're done.`;
    showOnly("waiting");
    return;
  }

  render(data);
}

function render(data) {
  const myAnswers = data[`answers${Role}`] || {};
  const theirAnswers = data[`answers${OtherRole}`] || {};
  const myNickname = data[`nickname${Role}`];
  const partnerNickname = data[`nickname${OtherRole}`];
  const nicknames = { A: data.nicknameA, B: data.nicknameB };

  document.getElementById("results-intro").textContent =
    `Hi ${myNickname} \u2014 here's everything you and ${partnerNickname} are both open to, grouped by category.`;

  const byCategory = new Map(categories.map((c) => [c, []]));
  const otherCategory = [];

  questions.forEach((q) => {
    const match = classify(myAnswers[q.id], theirAnswers[q.id]);
    if (!match) return;
    const bucket = byCategory.has(q.category) ? byCategory.get(q.category) : otherCategory;
    bucket.push({ ...q, match });
  });

  const body = document.getElementById("results-body");
  body.innerHTML = "";

  let anyMatches = false;
  for (const [category, items] of byCategory) {
    if (items.length === 0) continue;
    anyMatches = true;
    body.appendChild(renderCategoryBlock(category, items, nicknames));
  }
  if (otherCategory.length > 0) {
    anyMatches = true;
    body.appendChild(renderCategoryBlock("More", otherCategory, nicknames));
  }

  if (!anyMatches) {
    const p = document.createElement("p");
    p.className = "empty-note";
    p.textContent = "No shared matches yet \u2014 that's okay, plenty of couples land here on a first pass. Consider it a conversation starter.";
    body.appendChild(p);
  }

  // Private section: things the OTHER person marked as a hard limit (Never).
  const hardLimits = questions.filter((q) => isHardLimit(theirAnswers[q.id]));
  if (hardLimits.length > 0) {
    const section = document.createElement("div");
    section.className = "private-section";
    const h2 = document.createElement("h2");
    h2.textContent = "For your eyes only";
    const p = document.createElement("p");
    p.className = "lede";
    p.style.marginBottom = "16px";
    p.textContent = `${partnerNickname} marked these as a hard limit. This section only shows on your results page \u2014 they won't know you've seen it. Good to know before you bring something up.`;
    section.appendChild(h2);
    section.appendChild(p);
    hardLimits.forEach((q) => {
      const row = document.createElement("div");
      row.className = "result-item";
      const span = document.createElement("span");
      span.className = "item-text";
      span.textContent = resolveText(q, role, nicknames);
      row.appendChild(span);
      section.appendChild(row);
    });
    body.appendChild(section);
  }

  showOnly("results");
}

function renderCategoryBlock(category, items, nicknames) {
  const wrap = document.createElement("div");
  wrap.className = "result-category";
  const h3 = document.createElement("h3");
  h3.textContent = category;
  wrap.appendChild(h3);

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "result-item";
    const span = document.createElement("span");
    span.className = "item-text";
    span.textContent = resolveText(item, role, nicknames);
    const pill = document.createElement("span");
    pill.className = `pill ${item.match === "real" ? "pill-real" : "pill-fantasy"}`;
    pill.textContent = item.match === "real" ? "Yes" : "Fantasy";
    row.appendChild(span);
    row.appendChild(pill);
    wrap.appendChild(row);
  });

  return wrap;
}

document.getElementById("refresh-btn").addEventListener("click", load);

load();
