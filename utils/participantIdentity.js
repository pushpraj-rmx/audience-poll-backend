/** Shared identity helpers for Participant (email + display name). */
function normalizeParticipantName(n) {
  return String(n ?? "").trim();
}

function normalizeParticipantEmail(e) {
  return String(e ?? "").trim().toLowerCase();
}

module.exports = {
  normalizeParticipantName,
  normalizeParticipantEmail,
};
