// Resolves personalization tokens in a question's text, from the point of
// view of whoever is currently looking at it (quiz-taker or results viewer).
//
// Tokens:
//   {partner}            -> the other person's nickname, always
//   {actor} / {recipient} -> only valid on questions with an "actor" field
//                            ("a" or "b"), identifying which quiz role
//                            performs the action. Resolves to "you" for
//                            whichever role is currently viewing, and to
//                            the other person's nickname otherwise.
//
// nicknames shape: { A: "nicknameA", B: "nicknameB" }
// viewerRole: "a" or "b"
export function resolveText(question, viewerRole, nicknames) {
  let text = question.text;
  const otherRole = viewerRole === "a" ? "b" : "a";

  if (question.actor) {
    const actorRole = question.actor;
    const recipientRole = actorRole === "a" ? "b" : "a";
    const viewerIsActor = viewerRole === actorRole;
    const actorText = viewerIsActor ? "you" : nicknames[actorRole.toUpperCase()];
    const recipientText = viewerIsActor ? nicknames[recipientRole.toUpperCase()] : "you";
    text = text.replace(/{actor}/g, actorText).replace(/{recipient}/g, recipientText);
  }

  text = text.replace(/{partner}/g, nicknames[otherRole.toUpperCase()]);
  text = text.replace(/{you}/g, "you");

  // Capitalize the first letter, since a resolved token ("you"/"jordan")
  // may now be sitting at the start of the sentence.
  return text.charAt(0).toUpperCase() + text.slice(1);
}
