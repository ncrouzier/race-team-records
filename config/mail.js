// config/mail.js

// Sends through Brevo's HTTPS API rather than SMTP: the droplet's provider blocks
// outbound SMTP ports, while 443 is open. Sets the global `transport` the routes use:
//
//   transport.sendMail({ from, to, cc, bcc, replyTo, subject, text, html }, callback)
//
// Addresses are 'a@x.org', 'a@x.org, b@x.org', { name, address } or an array of
// these. The callback gets (err, info); without one, sendMail returns a promise.

function toAddressList(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.flatMap(toAddressList);
    if (typeof value === 'string') {
        return value.split(',').map(s => s.trim()).filter(Boolean).map(email => ({ email }));
    }
    if (value.address) {
        return value.name ? [{ email: value.address, name: value.name }] : [{ email: value.address }];
    }
    return [];
}

async function send(data) {
    const payload = {
        sender: toAddressList(data.from)[0],
        to: toAddressList(data.to),
        subject: data.subject
    };
    if (data.text) payload.textContent = data.text;
    if (data.html) payload.htmlContent = data.html;
    const cc = toAddressList(data.cc);
    if (cc.length) payload.cc = cc;
    const bcc = toAddressList(data.bcc);
    if (bcc.length) payload.bcc = bcc;
    const replyTo = toAddressList(data.replyTo)[0];
    if (replyTo) payload.replyTo = replyTo;

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'api-key': process.env.BREVO_API_KEY
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000)
    });
    const body = await res.text();
    if (!res.ok) throw new Error('Brevo API error ' + res.status + ': ' + body);
    let messageId;
    try { messageId = JSON.parse(body).messageId; } catch (e) { /* non-JSON success body */ }
    return { messageId: messageId, response: body };
}

function sendMail(data, callback) {
    const sent = send(data);
    if (!callback) return sent;
    // Two handlers rather than .then().catch(): an error thrown by the callback
    // itself must not come back into it as a send failure. It is logged instead.
    sent.then(info => callback(null, info), err => callback(err))
        .catch(err => console.error('Error in an email callback:', err));
}

module.exports = function () {
    global.transport = { sendMail: sendMail };
};

module.exports.toAddressList = toAddressList;
