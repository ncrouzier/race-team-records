module.exports = {
	url : process.env.OPENSHIFT_MONGODB_DB_URL+'/records' || 'mongodb://127.0.0.1:27017/records'
}