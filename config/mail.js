// config/mail.js

//set env variables on server
module.exports = function(nodemailer) {

    transport = nodemailer.createTransport({
        service: "gmail", // sets automatically host, port and connection security settings
        auth: {
            user: process.env.MCRRC_EMAIL_ADDRESS,
            pass: process.env.MCRRC_EMAIL_PASSWORD
        }
    });

};
