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
    // Set when the job was at one of the team's races. eventName then mirrors
    // the race name, so everything that reads eventName keeps working, and
    // jobDate starts as the race date but may differ (set-up the day before,
    // packet pickup, ...). Jobs elsewhere have no race and a typed eventName.
    race: {
        _id: mongoose.Schema.Types.ObjectId,
        racename: String,
        racedate: Date
    },
    eventName: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    createdAt: Date,
    updatedAt: Date
});

// Add indexes for common queries
volunteerJobSchema.index({ 'member._id': 1 });
volunteerJobSchema.index({ jobDate: 1 });
volunteerJobSchema.index({ 'race._id': 1 });

// keep track of when volunteer jobs are updated and created
volunteerJobSchema.pre('save', function() {
    const currentDate = Date.now();

    if (this.isNew) {
        this.createdAt = currentDate;
    }
    this.updatedAt = currentDate;
    volunteerJobSchema.methods.updateSystemInfo('mcrrc', currentDate);
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
