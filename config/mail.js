// config/mail.js

//set env variables on server
module.exports = function(nodemailer) {

    transport = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        auth: {
            user: process.env.BREVO_SMTP_USER,
            pass: process.env.BREVO_SMTP_KEY
        }
    });

};
