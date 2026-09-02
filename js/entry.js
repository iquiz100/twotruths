import { db, doc, setDoc } from "./db.js";
import { generateSessionId, buildLink } from "./util.js";

const form = document.getElementById("setup-form");
const setupPanel = document.getElementById("setup-panel");
const linksPanel = document.getElementById("links-panel");
const errorPanel = document.getElementById("error-panel");
const errorText = document.getElementById("error-text");
const createBtn = document.getElementById("create-btn");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const nicknameA = document.getElementById("nickname-a").value.trim();
  const nicknameB = document.getElementById("nickname-b").value.trim();
  if (!nicknameA || !nicknameB) return;

  createBtn.disabled = true;
  createBtn.textContent = "Creating\u2026";

  try {
    const sessionId = generateSessionId();
    await setDoc(doc(db, "sessions", sessionId), {
      nicknameA,
      nicknameB,
      createdAt: Date.now(),
      completedA: false,
      completedB: false,
      answersA: null,
      answersB: null,
    });

    const linkA = buildLink("quiz.html", { session: sessionId, role: "a" });
    const linkB = buildLink("quiz.html", { session: sessionId, role: "b" });

    document.getElementById("link-a").value = linkA;
    document.getElementById("link-b").value = linkB;
    document.getElementById("go-link").href = linkA;

    setupPanel.style.display = "none";
    linksPanel.style.display = "block";
  } catch (err) {
    console.error(err);
    errorText.textContent =
      "Something went wrong creating your quiz (" + err.message + "). Check that Firebase is configured correctly.";
    errorPanel.style.display = "block";
    createBtn.disabled = false;
    createBtn.textContent = "Create your quiz links";
  }
});

document.querySelectorAll("[data-copy]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const input = document.getElementById(btn.dataset.copy);
    await navigator.clipboard.writeText(input.value);
    const original = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = original), 1500);
  });
});
