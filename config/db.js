module.exports = {

    if (process.env.OPENSHIFT_MONGODB_DB_URL) {
        url: process.env.OPENSHIFT_MONGODB_DB_URL + 'records'; // connect to our database
    } else {
        url: 'mongodb://127.0.0.1:27017/records'; // connect to our database
    }
}
