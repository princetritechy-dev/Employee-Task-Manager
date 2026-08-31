/*
|--------------------------------------------------------------------------
| PRESENCE — lightweight in-memory online tracking
|--------------------------------------------------------------------------
| Not persisted to the database on purpose — presence is inherently
| ephemeral, and every authenticated request already tells us "this user
| is active right now" for free (see middleware/auth.js). A user counts
| as online if we've seen a request from them in the last ONLINE_WINDOW.
|
| Note: this is per-process. If you ever run multiple server instances
| behind a load balancer, this would need to move to something shared
| (Redis, etc). Fine for a single-instance deployment.
|--------------------------------------------------------------------------
*/

const ONLINE_WINDOW_MS = 45 * 1000;

const lastSeen = new Map();

function touch(userId) {
  lastSeen.set(String(userId), Date.now());
}

function isOnline(userId) {
  const t = lastSeen.get(String(userId));
  return !!t && Date.now() - t < ONLINE_WINDOW_MS;
}

module.exports = { touch, isOnline };
