/*
|--------------------------------------------------------------------------
| TYPING INDICATORS — lightweight in-memory tracking
|--------------------------------------------------------------------------
| Same "not worth persisting" reasoning as presence.js — a typing signal
| is stale within seconds anyway. Keyed by conversationKey ("team" or
| "dm:<idA>:<idB>" sorted) so both participants of a DM look at the same
| bucket.
|--------------------------------------------------------------------------
*/

const TYPING_WINDOW_MS = 4000;

const typingByConversation = new Map();

function setTyping(conversationKey, userId, name) {
  if (!typingByConversation.has(conversationKey)) {
    typingByConversation.set(conversationKey, new Map());
  }
  typingByConversation.get(conversationKey).set(String(userId), {
    name,
    at: Date.now(),
  });
}

function getTyping(conversationKey, excludeUserId) {
  const map = typingByConversation.get(conversationKey);
  if (!map) return [];

  const now = Date.now();
  const result = [];

  for (const [userId, info] of map.entries()) {
    if (userId === String(excludeUserId)) continue;
    if (now - info.at < TYPING_WINDOW_MS) {
      result.push({ userId, name: info.name });
    }
  }

  return result;
}

function dmKey(userIdA, userIdB) {
  return `dm:${[String(userIdA), String(userIdB)].sort().join(":")}`;
}

module.exports = { setTyping, getTyping, dmKey };
