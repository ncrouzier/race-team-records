var dbname = process.env.OPENSHIFT_MONGODB_DB_URL+"/records";
module.exports = {
	url : dbname || 'mongodb://127.0.0.1:27017/records'
}