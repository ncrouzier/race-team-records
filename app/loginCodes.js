// The 6-digit code sent with each login link (POST /api/login/magic). A link
// opens in the phone's browser, which on an iPhone does not share its login
// with the site saved to the home screen; the code can be typed there instead
// (POST /api/login/magic-code). Same 15 minutes and single use as the link.
// Only good with the email it was sent to, and a few wrong tries cancel it,
// so it cannot be guessed (a million codes, MAX_ATTEMPTS tries).

const crypto = require('crypto');

const MAX_ATTEMPTS = 5;

// Six digits, leading zeros kept ("042917")
function makeCode() {
    return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// Stored hashed, and tied to the account: the same code on another account
// hashes differently
function hashCode(userId, code) {
    return crypto.createHash('sha256').update(String(userId) + ':' + String(code)).digest('hex');
}

// Spaces and dashes typed with it are fine ("042 917")
function cleanCode(code) {
    return String(code == null ? '' : code).replace(/[\s-]/g, '');
}

/**
 * Checks a typed code against the account's.
 * user: { _id, magicLoginCodeHash, magicLoginCodeAttempts, magicLoginTokenExpires }
 * Returns 'ok', 'wrong' (one more try used), 'expired' (none, or too old) or
 * 'locked' (too many tries: the code is cancelled).
 */
function checkCode(user, code, now) {
    if (!user || !user.magicLoginCodeHash || !user.magicLoginTokenExpires) return 'expired';
    if (new Date(user.magicLoginTokenExpires).getTime() <= (now || Date.now())) return 'expired';
    if ((user.magicLoginCodeAttempts || 0) >= MAX_ATTEMPTS) return 'locked';
    const typed = cleanCode(code);
    if (!/^\d{6}$/.test(typed)) return 'wrong';
    const expected = Buffer.from(user.magicLoginCodeHash, 'hex');
    const given = Buffer.from(hashCode(user._id, typed), 'hex');
    return expected.length === given.length && crypto.timingSafeEqual(expected, given) ? 'ok' : 'wrong';
}

module.exports = { MAX_ATTEMPTS, makeCode, hashCode, cleanCode, checkCode };
