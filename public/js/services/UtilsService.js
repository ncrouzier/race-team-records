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

    factory.states = [
        { "name": "Alabama", "code": "AL" },
        { "name": "Alaska", "code": "AK" },
        { "name": "American Samoa", "code": "AS" },
        { "name": "Arizona", "code": "AZ" },
        { "name": "Arkansas", "code": "AR" },
        { "name": "California", "code": "CA" },
        { "name": "Colorado", "code": "CO" },
        { "name": "Connecticut", "code": "CT" },
        { "name": "Delaware", "code": "DE" },
        { "name": "District Of Columbia", "code": "DC" },
        { "name": "Federated States Of Micronesia", "code": "FM" },
        { "name": "Florida", "code": "FL" },
        { "name": "Georgia", "code": "GA" },
        { "name": "Guam", "code": "GU" },
        { "name": "Hawaii", "code": "HI" },
        { "name": "Idaho", "code": "ID" },
        { "name": "Illinois", "code": "IL" },
        { "name": "Indiana", "code": "IN" },
        { "name": "Iowa", "code": "IA" },
        { "name": "Kansas", "code": "KS" },
        { "name": "Kentucky", "code": "KY" },
        { "name": "Louisiana", "code": "LA" },
        { "name": "Maine", "code": "ME" },
        { "name": "Marshall Islands", "code": "MH" },
        { "name": "Maryland", "code": "MD" },
        { "name": "Massachusetts", "code": "MA" },
        { "name": "Michigan", "code": "MI" },
        { "name": "Minnesota", "code": "MN" },
        { "name": "Mississippi", "code": "MS" },
        { "name": "Missouri", "code": "MO" },
        { "name": "Montana", "code": "MT" },
        { "name": "Nebraska", "code": "NE" },
        { "name": "Nevada", "code": "NV" },
        { "name": "New Hampshire", "code": "NH" },
        { "name": "New Jersey", "code": "NJ" },
        { "name": "New Mexico", "code": "NM" },
        { "name": "New York", "code": "NY" },
        { "name": "North Carolina", "code": "NC" },
        { "name": "North Dakota", "code": "ND" },
        { "name": "Northern Mariana Islands", "code": "MP" },
        { "name": "Ohio", "code": "OH" },
        { "name": "Oklahoma", "code": "OK" },
        { "name": "Oregon", "code": "OR" },
        { "name": "Palau", "code": "PW" },
        { "name": "Pennsylvania", "code": "PA" },
        { "name": "Puerto Rico", "code": "PR" },
        { "name": "Rhode Island", "code": "RI" },
        { "name": "South Carolina", "code": "SC" },
        { "name": "South Dakota", "code": "SD" },
        { "name": "Tennessee", "code": "TN" },
        { "name": "Texas", "code": "TX" },
        { "name": "Utah", "code": "UT" },
        { "name": "Vermont", "code": "VT" },
        { "name": "Virgin Islands", "code": "VI" },
        { "name": "Virginia", "code": "VA" },
        { "name": "Washington", "code": "WA" },
        { "name": "West Virginia", "code": "WV" },
        { "name": "Wisconsin", "code": "WI" },
        { "name": "Wyoming", "code": "WY" }];

    factory.countries = [
        { "name": "Afghanistan", "code": "AFG" },
        { "name": "Aland Islands", "code": "ALA" },
        { "name": "Albania", "code": "ALB" },
        { "name": "Algeria", "code": "DZA" },
        { "name": "American Samoa", "code": "ASM" },
        { "name": "Andorra", "code": "AND" },
        { "name": "Angola", "code": "AGO" },
        { "name": "Anguilla", "code": "AIA" },
        { "name": "Antarctica", "code": "ATA" },
        { "name": "Antigua and Barbuda", "code": "ATG" },
        { "name": "Argentina", "code": "ARG" },
        { "name": "Armenia", "code": "ARM" },
        { "name": "Aruba", "code": "ABW" },
        { "name": "Australia", "code": "AUS" },
        { "name": "Austria", "code": "AUT" },
        { "name": "Azerbaijan", "code": "AZE" },
        { "name": "Bahamas", "code": "BHS" },
        { "name": "Bahrain", "code": "BHR" },
        { "name": "Bangladesh", "code": "BGD" },
        { "name": "Barbados", "code": "BRB" },
        { "name": "Belarus", "code": "BLR" },
        { "name": "Belgium", "code": "BEL" },
        { "name": "Belize", "code": "BLZ" },
        { "name": "Benin", "code": "BEN" },
        { "name": "Bermuda", "code": "BMU" },
        { "name": "Bhutan", "code": "BTN" },
        { "name": "Bolivia (Plurinational State of)", "code": "BOL" },
        { "name": "Bonaire, Sint Eustatius and Saba", "code": "BES" },
        { "name": "Bosnia and Herzegovina", "code": "BIH" },
        { "name": "Botswana", "code": "BWA" },
        { "name": "Bouvet Island", "code": "BVT" },
        { "name": "Brazil", "code": "BRA" },
        { "name": "British Indian Ocean Territory", "code": "IOT" },
        { "name": "Brunei Darussalam", "code": "BRN" },
        { "name": "Bulgaria", "code": "BGR" },
        { "name": "Burkina Faso", "code": "BFA" },
        { "name": "Burundi", "code": "BDI" },
        { "name": "Cambodia", "code": "KHM" },
        { "name": "Cameroon", "code": "CMR" },
        { "name": "Canada", "code": "CAN" },
        { "name": "Cabo Verde", "code": "CPV" },
        { "name": "Cayman Islands", "code": "CYM" },
        { "name": "Central African Republic", "code": "CAF" },
        { "name": "Chad", "code": "TCD" },
        { "name": "Chile", "code": "CHL" },
        { "name": "China", "code": "CHN" },
        { "name": "Christmas Island", "code": "CXR" },
        { "name": "Cocos (Keeling) Islands", "code": "CCK" },
        { "name": "Colombia", "code": "COL" },
        { "name": "Comoros", "code": "COM" },
        { "name": "Congo", "code": "COG" },
        { "name": "Congo (Democratic Republic of the)", "code": "COD" },
        { "name": "Cook Islands", "code": "COK" },
        { "name": "Costa Rica", "code": "CRI" },
        { "name": "Cote dIvoire", "code": "CIV" },
        { "name": "Croatia", "code": "HRV" },
        { "name": "Cuba", "code": "CUB" },
        { "name": "Curaçao", "code": "CUW" },
        { "name": "Cyprus", "code": "CYP" },
        { "name": "Czech Republic", "code": "CZE" },
        { "name": "Denmark", "code": "DNK" },
        { "name": "Djibouti", "code": "DJI" },
        { "name": "Dominica", "code": "DMA" },
        { "name": "Dominican Republic", "code": "DOM" },
        { "name": "Ecuador", "code": "ECU" },
        { "name": "Egypt", "code": "EGY" },
        { "name": "El Salvador", "code": "SLV" },
        { "name": "Equatorial Guinea", "code": "GNQ" },
        { "name": "Eritrea", "code": "ERI" },
        { "name": "Estonia", "code": "EST" },
        { "name": "Ethiopia", "code": "ETH" },
        { "name": "Falkland Islands (Malvinas)", "code": "FLK" },
        { "name": "Faroe Islands", "code": "FRO" },
        { "name": "Fiji", "code": "FJI" },
        { "name": "Finland", "code": "FIN" },
        { "name": "France", "code": "FRA" },
        { "name": "French Guiana", "code": "GUF" },
        { "name": "French Polynesia", "code": "PYF" },
        { "name": "French Southern Territories", "code": "ATF" },
        { "name": "Gabon", "code": "GAB" },
        { "name": "Gambia", "code": "GMB" },
        { "name": "Georgia", "code": "GEO" },
        { "name": "Germany", "code": "DEU" },
        { "name": "Ghana", "code": "GHA" },
        { "name": "Gibraltar", "code": "GIB" },
        { "name": "Greece", "code": "GRC" },
        { "name": "Greenland", "code": "GRL" },
        { "name": "Grenada", "code": "GRD" },
        { "name": "Guadeloupe", "code": "GLP" },
        { "name": "Guam", "code": "GUM" },
        { "name": "Guatemala", "code": "GTM" },
        { "name": "Guernsey", "code": "GGY" },
        { "name": "Guinea", "code": "GIN" },
        { "name": "Guinea-Bissau", "code": "GNB" },
        { "name": "Guyana", "code": "GUY" },
        { "name": "Haiti", "code": "HTI" },
        { "name": "Heard Island and McDonald Islands", "code": "HMD" },
        { "name": "Holy See", "code": "VAT" },
        { "name": "Honduras", "code": "HND" },
        { "name": "Hong Kong", "code": "HKG" },
        { "name": "Hungary", "code": "HUN" },
        { "name": "Iceland", "code": "ISL" },
        { "name": "India", "code": "IND" },
        { "name": "Indonesia", "code": "IDN" },
        { "name": "Iran", "code": "IRN" },
        { "name": "Iraq", "code": "IRQ" },
        { "name": "Ireland", "code": "IRL" },
        { "name": "Isle of Man", "code": "IMN" },
        { "name": "Israel", "code": "ISR" },
        { "name": "Italy", "code": "ITA" },
        { "name": "Jamaica", "code": "JAM" },
        { "name": "Japan", "code": "JPN" },
        { "name": "Jersey", "code": "JEY" },
        { "name": "Jordan", "code": "JOR" },
        { "name": "Kazakhstan", "code": "KAZ" },
        { "name": "Kenya", "code": "KEN" },
        { "name": "Kiribati", "code": "KIR" },
        { "name": "North Korea", "code": "PRK" },
        { "name": "South Korea", "code": "KOR" },
        { "name": "Kuwait", "code": "KWT" },
        { "name": "Kyrgyzstan", "code": "KGZ" },
        { "name": "Laos", "code": "LAO" },
        { "name": "Latvia", "code": "LVA" },
        { "name": "Lebanon", "code": "LBN" },
        { "name": "Lesotho", "code": "LSO" },
        { "name": "Liberia", "code": "LBR" },
        { "name": "Libya", "code": "LBY" },
        { "name": "Liechtenstein", "code": "LIE" },
        { "name": "Lithuania", "code": "LTU" },
        { "name": "Luxembourg", "code": "LUX" },
        { "name": "Macao", "code": "MAC" },
        { "name": "Republic of Macedonia", "code": "MKD" },
        { "name": "Madagascar", "code": "MDG" },
        { "name": "Malawi", "code": "MWI" },
        { "name": "Malaysia", "code": "MYS" },
        { "name": "Maldives", "code": "MDV" },
        { "name": "Mali", "code": "MLI" },
        { "name": "Malta", "code": "MLT" },
        { "name": "Marshall Islands", "code": "MHL" },
        { "name": "Martinique", "code": "MTQ" },
        { "name": "Mauritania", "code": "MRT" },
        { "name": "Mauritius", "code": "MUS" },
        { "name": "Mayotte", "code": "MYT" },
        { "name": "Mexico", "code": "MEX" },
        { "name": "Micronesia (Federated States of)", "code": "FSM" },
        { "name": "Moldova", "code": "MDA" },
        { "name": "Monaco", "code": "MCO" },
        { "name": "Mongolia", "code": "MNG" },
        { "name": "Montenegro", "code": "MNE" },
        { "name": "Montserrat", "code": "MSR" },
        { "name": "Morocco", "code": "MAR" },
        { "name": "Mozambique", "code": "MOZ" },
        { "name": "Myanmar", "code": "MMR" },
        { "name": "Namibia", "code": "NAM" },
        { "name": "Nauru", "code": "NRU" },
        { "name": "Nepal", "code": "NPL" },
        { "name": "Netherlands", "code": "NLD" },
        { "name": "New Caledonia", "code": "NCL" },
        { "name": "New Zealand", "code": "NZL" },
        { "name": "Nicaragua", "code": "NIC" },
        { "name": "Niger", "code": "NER" },
        { "name": "Nigeria", "code": "NGA" },
        { "name": "Niue", "code": "NIU" },
        { "name": "Norfolk Island", "code": "NFK" },
        { "name": "Northern Mariana Islands", "code": "MNP" },
        { "name": "Norway", "code": "NOR" },
        { "name": "Oman", "code": "OMN" },
        { "name": "Pakistan", "code": "PAK" },
        { "name": "Palau", "code": "PLW" },
        { "name": "Palestine, State of", "code": "PSE" },
        { "name": "Panama", "code": "PAN" },
        { "name": "Papua New Guinea", "code": "PNG" },
        { "name": "Paraguay", "code": "PRY" },
        { "name": "Peru", "code": "PER" },
        { "name": "Philippines", "code": "PHL" },
        { "name": "Pitcairn", "code": "PCN" },
        { "name": "Poland", "code": "POL" },
        { "name": "Portugal", "code": "PRT" },
        { "name": "Puerto Rico", "code": "PRI" },
        { "name": "Qatar", "code": "QAT" },
        { "name": "Reunion", "code": "REU" },
        { "name": "Romania", "code": "ROU" },
        { "name": "Russian Federation", "code": "RUS" },
        { "name": "Rwanda", "code": "RWA" },
        { "name": "Saint Barthélemy", "code": "BLM" },
        { "name": "Saint Helena, Ascension and Tristan da Cunha", "code": "SHN" },
        { "name": "Saint Kitts and Nevis", "code": "KNA" },
        { "name": "Saint Lucia", "code": "LCA" },
        { "name": "Saint Martin (French part)", "code": "MAF" },
        { "name": "Saint Pierre and Miquelon", "code": "SPM" },
        { "name": "Saint Vincent and the Grenadines", "code": "VCT" },
        { "name": "Samoa", "code": "WSM" },
        { "name": "San Marino", "code": "SMR" },
        { "name": "Sao Tome and Principe", "code": "STP" },
        { "name": "Saudi Arabia", "code": "SAU" },
        { "name": "Senegal", "code": "SEN" },
        { "name": "Serbia", "code": "SRB" },
        { "name": "Seychelles", "code": "SYC" },
        { "name": "Sierra Leone", "code": "SLE" },
        { "name": "Singapore", "code": "SGP" },
        { "name": "Sint Maarten (Dutch part)", "code": "SXM" },
        { "name": "Slovakia", "code": "SVK" },
        { "name": "Slovenia", "code": "SVN" },
        { "name": "Solomon Islands", "code": "SLB" },
        { "name": "Somalia", "code": "SOM" },
        { "name": "South Africa", "code": "ZAF" },
        { "name": "South Georgia and the South Sandwich Islands", "code": "SGS" },
        { "name": "South Sudan", "code": "SSD" },
        { "name": "Spain", "code": "ESP" },
        { "name": "Sri Lanka", "code": "LKA" },
        { "name": "Sudan", "code": "SDN" },
        { "name": "Suriname", "code": "SUR" },
        { "name": "Svalbard and Jan Mayen", "code": "SJM" },
        { "name": "Swaziland", "code": "SWZ" },
        { "name": "Sweden", "code": "SWE" },
        { "name": "Switzerland", "code": "CHE" },
        { "name": "Syria", "code": "SYR" },
        { "name": "Taiwan, Province of China", "code": "TWN" },
        { "name": "Tajikistan", "code": "TJK" },
        { "name": "Tanzania", "code": "TZA" },
        { "name": "Thailand", "code": "THA" },
        { "name": "Timor-Leste", "code": "TLS" },
        { "name": "Togo", "code": "TGO" },
        { "name": "Tokelau", "code": "TKL" },
        { "name": "Tonga", "code": "TON" },
        { "name": "Trinidad and Tobago", "code": "TTO" },
        { "name": "Tunisia", "code": "TUN" },
        { "name": "Turkey", "code": "TUR" },
        { "name": "Turkmenistan", "code": "TKM" },
        { "name": "Turks and Caicos Islands", "code": "TCA" },
        { "name": "Tuvalu", "code": "TUV" },
        { "name": "Uganda", "code": "UGA" },
        { "name": "Ukraine", "code": "UKR" },
        { "name": "United Arab Emirates", "code": "ARE" },
        { "name": "United Kingdom of Great Britain and Northern Ireland", "code": "GBR" },
        { "name": "United States of America", "code": "USA" },
        { "name": "United States Minor Outlying Islands", "code": "UMI" },
        { "name": "Uruguay", "code": "URY" },
        { "name": "Uzbekistan", "code": "UZB" },
        { "name": "Vanuatu", "code": "VUT" },
        { "name": "Venezuela", "code": "VEN" },
        { "name": "Viet Nam", "code": "VNM" },
        { "name": "Virgin Islands (British)", "code": "VGB" },
        { "name": "Virgin Islands (U.S.)", "code": "VIR" },
        { "name": "Wallis and Futuna", "code": "WLF" },
        { "name": "Western Sahara", "code": "ESH" },
        { "name": "Yemen", "code": "YEM" },
        { "name": "Zambia", "code": "ZMB" },
        { "name": "Zimbabwe", "code": "ZWE" }];

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
