angular.module('mcrrcApp').factory('UtilsService', ['Restangular', 'MemoryCacheService', function (Restangular, MemoryCacheService) {

    var locationinfos = Restangular.all('locationinfos');
    var factory = {};
    var user;

    // Cache name for MemoryCacheService
    var CACHE_NAME = 'locationInfo';

    factory.calculateAge = function (birthday) { // birthday is a date
        var bd = new Date(birthday);
        var ageDifMs = Date.now() - bd.getTime();
        var ageDate = new Date(ageDifMs); // miliseconds from epoch
        return Math.abs(ageDate.getUTCFullYear() - 1970);
    };


    factory.getAgeGrade = function (params) {
        return Restangular.one('agegrade').get(params).then(function (agegrade) {
            return agegrade;
        });

    };

    factory.getLocationInfo = function (params) {
        var key = JSON.stringify(params);
        var cachedData = MemoryCacheService.get(CACHE_NAME, key);
        if (cachedData) {
            return Promise.resolve(cachedData);
        }
        return Restangular.one('locations').get(params).then(function (results) {
            MemoryCacheService.set(CACHE_NAME, key, results);
            return results;
        });
    };


    factory.getStateNameFromCode = function (code) {
        if (!code) return null;
        var state = factory.states.find(function (s) {
            return s.code.toLowerCase() === code.toLowerCase();
        });
        return state ? state.name : code;
    };

    factory.getCountryNameFromCode = function (code) {
        if (!code) return null;
        var country = factory.countries.find(function (c) {
            return c.code.toLowerCase() === code.toLowerCase();
        });
        return country ? country.name : code;
    };

    factory.getStateFlag = function (code) {
        if (!code) return '';
        // US state flags - using SVG image files
        var stateFlags = {
            'AL': 'images/us_state_flags/AL.svg', 'AK': 'images/us_state_flags/AK.svg', 'AZ': 'images/us_state_flags/AZ.svg', 'AR': 'images/us_state_flags/AR.svg', 'CA': 'images/us_state_flags/CA.svg',
            'CO': 'images/us_state_flags/CO.svg', 'CT': 'images/us_state_flags/CT.svg', 'DE': 'images/us_state_flags/DE.svg', 'FL': 'images/us_state_flags/FL.svg', 'GA': 'images/us_state_flags/GA.svg',
            'HI': 'images/us_state_flags/HI.svg', 'ID': 'images/us_state_flags/ID.svg', 'IL': 'images/us_state_flags/IL.svg', 'IN': 'images/us_state_flags/IN.svg', 'IA': 'images/us_state_flags/IA.svg',
            'KS': 'images/us_state_flags/KS.svg', 'KY': 'images/us_state_flags/KY.svg', 'LA': 'images/us_state_flags/LA.svg', 'ME': 'images/us_state_flags/ME.svg', 'MD': 'images/us_state_flags/MD.svg',
            'MA': 'images/us_state_flags/MA.svg', 'MI': 'images/us_state_flags/MI.svg', 'MN': 'images/us_state_flags/MN.svg', 'MS': 'images/us_state_flags/MS.svg', 'MO': 'images/us_state_flags/MO.svg',
            'MT': 'images/us_state_flags/MT.svg', 'NE': 'images/us_state_flags/NE.svg', 'NV': 'images/us_state_flags/NV.svg', 'NH': 'images/us_state_flags/NH.svg', 'NJ': 'images/us_state_flags/NJ.svg',
            'NM': 'images/us_state_flags/NM.svg', 'NY': 'images/us_state_flags/NY.svg', 'NC': 'images/us_state_flags/NC.svg', 'ND': 'images/us_state_flags/ND.svg', 'OH': 'images/us_state_flags/OH.svg',
            'OK': 'images/us_state_flags/OK.svg', 'OR': 'images/us_state_flags/OR.svg', 'PA': 'images/us_state_flags/PA.svg', 'RI': 'images/us_state_flags/RI.svg', 'SC': 'images/us_state_flags/SC.svg',
            'SD': 'images/us_state_flags/SD.svg', 'TN': 'images/us_state_flags/TN.svg', 'TX': 'images/us_state_flags/TX.svg', 'UT': 'images/us_state_flags/UT.svg', 'VT': 'images/us_state_flags/VT.svg',
            'VA': 'images/us_state_flags/VA.svg', 'WA': 'images/us_state_flags/WA.svg', 'WV': 'images/us_state_flags/WV.svg', 'WI': 'images/us_state_flags/WI.svg', 'WY': 'images/us_state_flags/WY.svg',
            'DC': 'images/us_state_flags/DC.svg' // District of Columbia
        };
        return stateFlags[code.toUpperCase()] || '';
    };

    factory.getCountryFlag = function (code) {
        if (!code) return '';
        // Country flag emojis using ISO country codes
        var countryFlags = {
            'USA': '🇺🇸', 'CAN': '🇨🇦', 'MEX': '🇲🇽', 'GBR': '🇬🇧', 'FRA': '🇫🇷',
            'DEU': '🇩🇪', 'ITA': '🇮🇹', 'ESP': '🇪🇸', 'NLD': '🇳🇱', 'BEL': '🇧🇪',
            'CHE': '🇨🇭', 'AUT': '🇦🇹', 'SWE': '🇸🇪', 'NOR': '🇳🇴', 'DNK': '🇩🇰',
            'FIN': '🇫🇮', 'POL': '🇵🇱', 'CZE': '🇨🇿', 'HUN': '🇭🇺', 'ROU': '🇷🇴',
            'BGR': '🇧🇬', 'HRV': '🇭🇷', 'SVN': '🇸🇮', 'SVK': '🇸🇰', 'LTU': '🇱🇹',
            'LVA': '🇱🇻', 'EST': '🇪🇪', 'GRC': '🇬🇷', 'PRT': '🇵🇹', 'IRL': '🇮🇪',
            'ISL': '🇮🇸', 'LUX': '🇱🇺', 'MLT': '🇲🇹', 'CYP': '🇨🇾', 'AUS': '🇦🇺',
            'NZL': '🇳🇿', 'JPN': '🇯🇵', 'KOR': '🇰🇷', 'CHN': '🇨🇳', 'TWN': '🇹🇼',
            'HKG': '🇭🇰', 'SGP': '🇸🇬', 'THA': '🇹🇭', 'VNM': '🇻🇳', 'MYS': '🇲🇾',
            'IDN': '🇮🇩', 'PHL': '🇵🇭', 'IND': '🇮🇳', 'PAK': '🇵🇰', 'BGD': '🇧🇩',
            'LKA': '🇱🇰', 'NPL': '🇳🇵', 'BTN': '🇧🇹', 'MMR': '🇲🇲', 'KHM': '🇰🇭',
            'LAO': '🇱🇦', 'BRN': '🇧🇳', 'MNG': '🇲🇳', 'RUS': '🇷🇺', 'KAZ': '🇰🇿',
            'UZB': '🇺🇿', 'KGZ': '🇰🇬', 'TJK': '🇹🇯', 'TKM': '🇹🇲', 'AFG': '🇦🇫',
            'IRN': '🇮🇷', 'IRQ': '🇮🇶', 'SYR': '🇸🇾', 'LBN': '🇱🇧', 'ISR': '🇮🇱',
            'PSE': '🇵🇸', 'JOR': '🇯🇴', 'SAU': '🇸🇦', 'YEM': '🇾🇪', 'OMN': '🇴🇲',
            'ARE': '🇦🇪', 'QAT': '🇶🇦', 'BHR': '🇧🇭', 'KWT': '🇰🇼', 'EGY': '🇪🇬',
            'LBY': '🇱🇾', 'TUN': '🇹🇳', 'DZA': '🇩🇿', 'MAR': '🇲🇦', 'SDN': '🇸🇩',
            'SSD': '🇸🇸', 'ETH': '🇪🇹', 'ERI': '🇪🇷', 'DJI': '🇩🇯', 'SOM': '🇸🇴',
            'KEN': '🇰🇪', 'UGA': '🇺🇬', 'TZA': '🇹🇿', 'RWA': '🇷🇼', 'BDI': '🇧🇮',
            'COD': '🇨🇩', 'COG': '🇨🇬', 'GAB': '🇬🇦', 'GNQ': '🇬🇶', 'CMR': '🇨🇲',
            'NGA': '🇳🇬', 'NER': '🇳🇪', 'TCD': '🇹🇩', 'MLI': '🇲🇱', 'BFA': '🇧🇫',
            'GIN': '🇬🇳', 'GNB': '🇬🇼', 'SEN': '🇸🇳', 'GMB': '🇬🇲', 'SLE': '🇸🇱',
            'LBR': '🇱🇷', 'CIV': '🇨🇮', 'GHA': '🇬🇭', 'TGO': '🇹🇬', 'BEN': '🇧🇯',
            'CAF': '🇨🇫', 'GEO': '🇬🇪', 'ARM': '🇦🇲', 'AZE': '🇦🇿', 'TUR': '🇹🇷',
            'BRA': '🇧🇷', 'ARG': '🇦🇷', 'CHL': '🇨🇱', 'PER': '🇵🇪', 'BOL': '🇧🇴',
            'ECU': '🇪🇨', 'COL': '🇨🇴', 'VEN': '🇻🇪', 'GUY': '🇬🇾', 'SUR': '🇸🇷',
            'PRY': '🇵🇾', 'URY': '🇺🇾', 'ZAF': '🇿🇦', 'NAM': '🇳🇦', 'BWA': '🇧🇼',
            'ZWE': '🇿🇼', 'ZMB': '🇿🇲', 'MWI': '🇲🇼', 'MOZ': '🇲🇿', 'MDG': '🇲🇬',
            'MUS': '🇲🇺', 'SYC': '🇸🇨', 'COM': '🇰🇲', 'SWZ': '🇸🇿', 'LSO': '🇱🇸',
            'UKR': '🇺🇦', 'SLV': '🇸🇻'
        };
        return countryFlags[code.toUpperCase()] || '🏳️';
    };

    factory.states = window.raceLocations.states;

    factory.countries = window.raceLocations.countries;

    // Get countries list
    factory.getCountries = function () {
        return Promise.resolve(factory.countries);
    };

    // Get states list
    factory.getStates = function () {
        return Promise.resolve(factory.states);
    };

    return factory;

}]);
