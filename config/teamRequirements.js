var teamRequirements = {
    defaults: {
        minRaceCount: 8,                // races only — volunteer jobs are tracked but no longer count toward eligibility
        minAgeGrade: 70                 // percentage
    },
    // Year-specific overrides (merged on top of defaults)
    yearOverrides: {
        // 2025: { minRaceCount: 6 }
    }
};

teamRequirements.getForYear = function (year) {
    var config = {};
    for (var key in teamRequirements.defaults) {
        config[key] = teamRequirements.defaults[key];
    }
    var overrides = teamRequirements.yearOverrides[year];
    if (overrides) {
        for (var key in overrides) {
            config[key] = overrides[key];
        }
    }
    config.year = year;
    return config;
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = teamRequirements;
}
