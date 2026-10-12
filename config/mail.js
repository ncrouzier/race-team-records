// config/mail.js

// Sends through Brevo's HTTPS API rather than SMTP: the droplet's provider blocks
// outbound SMTP ports, while 443 is open. Exposed as a nodemailer custom transport so
// every existing transport.sendMail(options, callback) call works unchanged.

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

module.exports = function(nodemailer) {

    transport = nodemailer.createTransport({
        name: 'brevo-api',
        version: '1.0.0',
        send: function (mail, callback) {
            const data = mail.data;
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

            fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'content-type': 'application/json',
                    'api-key': process.env.BREVO_API_KEY
                },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(15000)
            }).then(async function (res) {
                const body = await res.text();
                if (!res.ok) {
                    return callback(new Error('Brevo API error ' + res.status + ': ' + body));
                }
                let messageId;
                try { messageId = JSON.parse(body).messageId; } catch (e) { /* non-JSON success body */ }
                callback(null, { messageId: messageId, envelope: mail.message.getEnvelope(), response: body });
            }).catch(callback);
        }
    });

};
