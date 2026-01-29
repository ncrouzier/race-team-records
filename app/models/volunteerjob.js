var mongoose = require('mongoose');
const SystemInfo = require('./systeminfo');

// define the schema for volunteer job model
var volunteerJobSchema = mongoose.Schema({
    member: {
        _id: mongoose.Schema.Types.ObjectId,
        firstname: String,
        lastname: String,
        username: String,
        sex: String,
        dateofbirth: Date
    },
    jobDate: { type: Date, required: true },
    eventName: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    createdAt: Date,
    updatedAt: Date
});

// Add indexes for common queries
volunteerJobSchema.index({ 'member._id': 1 });
volunteerJobSchema.index({ jobDate: 1 });

// keep track of when volunteer jobs are updated and created
volunteerJobSchema.pre('save', function(next, done) {
    const currentDate = Date.now();

    if (this.isNew) {
        this.createdAt = currentDate;
    }
    this.updatedAt = currentDate;
    volunteerJobSchema.methods.updateSystemInfo('mcrrc', currentDate);
    next();
});

volunteerJobSchema.methods.updateSystemInfo = function(name, date) {
    try {
        SystemInfo.findOne({
            name: name
        }).then(systemInfo => {
            if (systemInfo) {
                systemInfo.volunteerJobUpdate = date;
                systemInfo.save().then(err => {
                    if (!err) {
                        console.log("error fetching systemInfo", err);
                    }
                });
            }
        });
    } catch(SystemInfoFindOneErr) {
        console.log("error fetching systemInfo")
    }
};

// create the model and expose it to our app
module.exports = mongoose.model('VolunteerJob', volunteerJobSchema);
