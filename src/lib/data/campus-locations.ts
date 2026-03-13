/**
 * Campus location data (latitude/longitude) for NCAA Division I schools.
 *
 * Used for site proximity calculations in the lever system. The key is the
 * Torvik team name (as it appears in barttorvik.com data). Coordinates
 * represent the approximate campus location.
 *
 * For teams not found in this lookup, the default center-of-US location
 * (39.8, -98.6) is used — roughly Lebanon, Kansas.
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CampusLocation {
  city: string;
  state: string;
  lat: number;
  lng: number;
}

/** Default location: geographic center of the contiguous US */
export const DEFAULT_CAMPUS_LOCATION: CampusLocation = {
  city: "Lebanon",
  state: "KS",
  lat: 39.8,
  lng: -98.6,
};

// ---------------------------------------------------------------------------
// Campus location lookup — keyed by Torvik team name
// ---------------------------------------------------------------------------

/**
 * Comprehensive campus location lookup for D-1 schools.
 *
 * Coverage: All Power 5 conferences (ACC, Big 12, Big East, Big Ten, SEC),
 * major mid-major conferences (AAC, A-10, MWC, WCC, MVC, etc.), and
 * additional D-1 programs. Roughly 360+ schools.
 */
export const CAMPUS_LOCATIONS: Record<string, CampusLocation> = {
  // =========================================================================
  // ACC (Atlantic Coast Conference)
  // =========================================================================
  "Boston College": { city: "Chestnut Hill", state: "MA", lat: 42.3355, lng: -71.1685 },
  Clemson: { city: "Clemson", state: "SC", lat: 34.6834, lng: -82.8374 },
  Duke: { city: "Durham", state: "NC", lat: 35.9971, lng: -78.9382 },
  "Florida St.": { city: "Tallahassee", state: "FL", lat: 30.4419, lng: -84.2985 },
  "Georgia Tech": { city: "Atlanta", state: "GA", lat: 33.7756, lng: -84.3963 },
  Louisville: { city: "Louisville", state: "KY", lat: 38.2146, lng: -85.7585 },
  Miami: { city: "Coral Gables", state: "FL", lat: 25.7215, lng: -80.2794 },
  "North Carolina": { city: "Chapel Hill", state: "NC", lat: 35.905, lng: -79.047 },
  "NC State": { city: "Raleigh", state: "NC", lat: 35.7847, lng: -78.6821 },
  "Notre Dame": { city: "Notre Dame", state: "IN", lat: 41.7052, lng: -86.2353 },
  Pittsburgh: { city: "Pittsburgh", state: "PA", lat: 40.4444, lng: -79.9532 },
  Syracuse: { city: "Syracuse", state: "NY", lat: 43.0392, lng: -76.1351 },
  Virginia: { city: "Charlottesville", state: "VA", lat: 38.0336, lng: -78.5080 },
  "Virginia Tech": { city: "Blacksburg", state: "VA", lat: 37.2296, lng: -80.4139 },
  "Wake Forest": { city: "Winston-Salem", state: "NC", lat: 36.1335, lng: -80.2774 },
  California: { city: "Berkeley", state: "CA", lat: 37.8719, lng: -122.2585 },
  SMU: { city: "Dallas", state: "TX", lat: 32.8431, lng: -96.7850 },
  Stanford: { city: "Stanford", state: "CA", lat: 37.4275, lng: -122.1697 },

  // =========================================================================
  // Big 12
  // =========================================================================
  Arizona: { city: "Tucson", state: "AZ", lat: 32.2319, lng: -110.9501 },
  "Arizona St.": { city: "Tempe", state: "AZ", lat: 33.4242, lng: -111.9281 },
  Baylor: { city: "Waco", state: "TX", lat: 31.5489, lng: -97.1131 },
  BYU: { city: "Provo", state: "UT", lat: 40.2519, lng: -111.6493 },
  Cincinnati: { city: "Cincinnati", state: "OH", lat: 39.1329, lng: -84.5150 },
  Colorado: { city: "Boulder", state: "CO", lat: 40.0076, lng: -105.2659 },
  Houston: { city: "Houston", state: "TX", lat: 29.7199, lng: -95.3422 },
  "Iowa St.": { city: "Ames", state: "IA", lat: 42.0266, lng: -93.6465 },
  Kansas: { city: "Lawrence", state: "KS", lat: 38.9543, lng: -95.2558 },
  "Kansas St.": { city: "Manhattan", state: "KS", lat: 39.1874, lng: -96.5717 },
  "Oklahoma St.": { city: "Stillwater", state: "OK", lat: 36.1253, lng: -97.0698 },
  "Texas Christian": { city: "Fort Worth", state: "TX", lat: 32.7098, lng: -97.3633 },
  "Texas Tech": { city: "Lubbock", state: "TX", lat: 33.5843, lng: -101.8456 },
  UCF: { city: "Orlando", state: "FL", lat: 28.6024, lng: -81.2001 },
  Utah: { city: "Salt Lake City", state: "UT", lat: 40.7649, lng: -111.8421 },
  "West Virginia": { city: "Morgantown", state: "WV", lat: 39.6350, lng: -79.9545 },

  // =========================================================================
  // Big East
  // =========================================================================
  Butler: { city: "Indianapolis", state: "IN", lat: 39.8390, lng: -86.1695 },
  "Connecticut": { city: "Storrs", state: "CT", lat: 41.8084, lng: -72.2495 },
  Creighton: { city: "Omaha", state: "NE", lat: 41.2565, lng: -95.9345 },
  DePaul: { city: "Chicago", state: "IL", lat: 41.9253, lng: -87.6533 },
  Georgetown: { city: "Washington", state: "DC", lat: 38.9076, lng: -77.0723 },
  Marquette: { city: "Milwaukee", state: "WI", lat: 43.0389, lng: -87.9295 },
  Providence: { city: "Providence", state: "RI", lat: 41.8420, lng: -71.4351 },
  "Seton Hall": { city: "South Orange", state: "NJ", lat: 40.7436, lng: -74.2462 },
  "St. John's": { city: "Queens", state: "NY", lat: 40.7234, lng: -73.7946 },
  Villanova: { city: "Villanova", state: "PA", lat: 40.0348, lng: -75.3371 },
  Xavier: { city: "Cincinnati", state: "OH", lat: 39.1492, lng: -84.4735 },

  // =========================================================================
  // Big Ten
  // =========================================================================
  Illinois: { city: "Champaign", state: "IL", lat: 40.1020, lng: -88.2272 },
  Indiana: { city: "Bloomington", state: "IN", lat: 39.1727, lng: -86.5230 },
  Iowa: { city: "Iowa City", state: "IA", lat: 41.6611, lng: -91.5302 },
  Maryland: { city: "College Park", state: "MD", lat: 38.9869, lng: -76.9426 },
  Michigan: { city: "Ann Arbor", state: "MI", lat: 42.2780, lng: -83.7382 },
  "Michigan St.": { city: "East Lansing", state: "MI", lat: 42.7355, lng: -84.4836 },
  Minnesota: { city: "Minneapolis", state: "MN", lat: 44.9740, lng: -93.2277 },
  Nebraska: { city: "Lincoln", state: "NE", lat: 40.8202, lng: -96.7005 },
  Northwestern: { city: "Evanston", state: "IL", lat: 42.0565, lng: -87.6753 },
  "Ohio St.": { city: "Columbus", state: "OH", lat: 40.0066, lng: -83.0305 },
  Oregon: { city: "Eugene", state: "OR", lat: 44.0448, lng: -123.0726 },
  "Penn St.": { city: "University Park", state: "PA", lat: 40.7982, lng: -77.8599 },
  Purdue: { city: "West Lafayette", state: "IN", lat: 40.4259, lng: -86.9081 },
  Rutgers: { city: "Piscataway", state: "NJ", lat: 40.5008, lng: -74.4474 },
  UCLA: { city: "Los Angeles", state: "CA", lat: 34.0689, lng: -118.4452 },
  USC: { city: "Los Angeles", state: "CA", lat: 34.0224, lng: -118.2851 },
  Washington: { city: "Seattle", state: "WA", lat: 47.6553, lng: -122.3035 },
  Wisconsin: { city: "Madison", state: "WI", lat: 43.0766, lng: -89.4125 },

  // =========================================================================
  // SEC (Southeastern Conference)
  // =========================================================================
  Alabama: { city: "Tuscaloosa", state: "AL", lat: 33.2140, lng: -87.5391 },
  Arkansas: { city: "Fayetteville", state: "AR", lat: 36.0679, lng: -94.1740 },
  Auburn: { city: "Auburn", state: "AL", lat: 32.6034, lng: -85.4808 },
  Florida: { city: "Gainesville", state: "FL", lat: 29.6436, lng: -82.3549 },
  Georgia: { city: "Athens", state: "GA", lat: 33.9480, lng: -83.3773 },
  Kentucky: { city: "Lexington", state: "KY", lat: 38.0317, lng: -84.5040 },
  LSU: { city: "Baton Rouge", state: "LA", lat: 30.4121, lng: -91.1837 },
  Mississippi: { city: "Oxford", state: "MS", lat: 34.3653, lng: -89.5389 },
  "Mississippi St.": { city: "Starkville", state: "MS", lat: 33.4557, lng: -88.7929 },
  Missouri: { city: "Columbia", state: "MO", lat: 38.9404, lng: -92.3277 },
  Oklahoma: { city: "Norman", state: "OK", lat: 35.2058, lng: -97.4457 },
  "South Carolina": { city: "Columbia", state: "SC", lat: 33.9940, lng: -81.0274 },
  Tennessee: { city: "Knoxville", state: "TN", lat: 35.9544, lng: -83.9295 },
  Texas: { city: "Austin", state: "TX", lat: 30.2849, lng: -97.7341 },
  "Texas A&M": { city: "College Station", state: "TX", lat: 30.6187, lng: -96.3365 },
  Vanderbilt: { city: "Nashville", state: "TN", lat: 36.1445, lng: -86.8027 },

  // =========================================================================
  // AAC (American Athletic Conference)
  // =========================================================================
  Charlotte: { city: "Charlotte", state: "NC", lat: 35.3072, lng: -80.7333 },
  "East Carolina": { city: "Greenville", state: "NC", lat: 35.6087, lng: -77.3665 },
  FAU: { city: "Boca Raton", state: "FL", lat: 26.3708, lng: -80.1013 },
  Memphis: { city: "Memphis", state: "TN", lat: 35.1186, lng: -89.9376 },
  "North Texas": { city: "Denton", state: "TX", lat: 33.2098, lng: -97.1526 },
  Rice: { city: "Houston", state: "TX", lat: 29.7174, lng: -95.4018 },
  "South Florida": { city: "Tampa", state: "FL", lat: 28.0614, lng: -82.4132 },
  Temple: { city: "Philadelphia", state: "PA", lat: 39.9812, lng: -75.1498 },
  Tulane: { city: "New Orleans", state: "LA", lat: 29.9394, lng: -90.1215 },
  Tulsa: { city: "Tulsa", state: "OK", lat: 36.1514, lng: -95.9466 },
  UAB: { city: "Birmingham", state: "AL", lat: 33.5022, lng: -86.8094 },
  UTSA: { city: "San Antonio", state: "TX", lat: 29.5830, lng: -98.6199 },
  Wichita: { city: "Wichita", state: "KS", lat: 37.7176, lng: -97.2943 },
  "Wichita St.": { city: "Wichita", state: "KS", lat: 37.7176, lng: -97.2943 },

  // =========================================================================
  // Atlantic 10 (A-10)
  // =========================================================================
  Davidson: { city: "Davidson", state: "NC", lat: 35.4997, lng: -80.8487 },
  Dayton: { city: "Dayton", state: "OH", lat: 39.7408, lng: -84.1792 },
  Duquesne: { city: "Pittsburgh", state: "PA", lat: 40.4362, lng: -79.9925 },
  Fordham: { city: "Bronx", state: "NY", lat: 40.8615, lng: -73.8854 },
  "George Mason": { city: "Fairfax", state: "VA", lat: 38.8316, lng: -77.3103 },
  "George Washington": { city: "Washington", state: "DC", lat: 38.8997, lng: -77.0486 },
  "La Salle": { city: "Philadelphia", state: "PA", lat: 40.0383, lng: -75.1558 },
  "Loyola Chicago": { city: "Chicago", state: "IL", lat: 41.9995, lng: -87.6577 },
  "Massachusetts": { city: "Amherst", state: "MA", lat: 42.3868, lng: -72.5301 },
  "Rhode Island": { city: "Kingston", state: "RI", lat: 41.4804, lng: -71.5260 },
  Richmond: { city: "Richmond", state: "VA", lat: 37.5741, lng: -77.5400 },
  "Saint Joseph's": { city: "Philadelphia", state: "PA", lat: 40.0008, lng: -75.2410 },
  "Saint Louis": { city: "St. Louis", state: "MO", lat: 38.6368, lng: -90.2340 },
  "St. Bonaventure": { city: "Olean", state: "NY", lat: 42.0793, lng: -78.4820 },
  VCU: { city: "Richmond", state: "VA", lat: 37.5488, lng: -77.4530 },

  // =========================================================================
  // Mountain West (MWC)
  // =========================================================================
  "Air Force": { city: "Colorado Springs", state: "CO", lat: 38.9983, lng: -104.8613 },
  "Boise St.": { city: "Boise", state: "ID", lat: 43.6036, lng: -116.2053 },
  "Colorado St.": { city: "Fort Collins", state: "CO", lat: 40.5734, lng: -105.0866 },
  "Fresno St.": { city: "Fresno", state: "CA", lat: 36.8134, lng: -119.7483 },
  Nevada: { city: "Reno", state: "NV", lat: 39.5459, lng: -119.8177 },
  "New Mexico": { city: "Albuquerque", state: "NM", lat: 35.0844, lng: -106.6189 },
  "San Diego St.": { city: "San Diego", state: "CA", lat: 32.7757, lng: -117.0719 },
  "San Jose St.": { city: "San Jose", state: "CA", lat: 37.3352, lng: -121.8811 },
  UNLV: { city: "Las Vegas", state: "NV", lat: 36.1083, lng: -115.1427 },
  "Utah St.": { city: "Logan", state: "UT", lat: 41.7453, lng: -111.8097 },
  Wyoming: { city: "Laramie", state: "WY", lat: 41.3149, lng: -105.5666 },

  // =========================================================================
  // West Coast Conference (WCC)
  // =========================================================================
  Gonzaga: { city: "Spokane", state: "WA", lat: 47.6671, lng: -117.4025 },
  "Loyola Marymount": { city: "Los Angeles", state: "CA", lat: 33.9703, lng: -118.4194 },
  Pacific: { city: "Stockton", state: "CA", lat: 37.9786, lng: -121.3112 },
  Pepperdine: { city: "Malibu", state: "CA", lat: 34.0392, lng: -118.7098 },
  Portland: { city: "Portland", state: "OR", lat: 45.5717, lng: -122.7274 },
  "Saint Mary's": { city: "Moraga", state: "CA", lat: 37.8404, lng: -122.1102 },
  "San Diego": { city: "San Diego", state: "CA", lat: 32.7719, lng: -117.1881 },
  "San Francisco": { city: "San Francisco", state: "CA", lat: 37.7766, lng: -122.4520 },
  "Santa Clara": { city: "Santa Clara", state: "CA", lat: 37.3494, lng: -121.9392 },

  // =========================================================================
  // Missouri Valley (MVC)
  // =========================================================================
  Belmont: { city: "Nashville", state: "TN", lat: 36.1318, lng: -86.7931 },
  Bradley: { city: "Peoria", state: "IL", lat: 40.6969, lng: -89.6160 },
  Drake: { city: "Des Moines", state: "IA", lat: 41.6012, lng: -93.6537 },
  Evansville: { city: "Evansville", state: "IN", lat: 37.9746, lng: -87.5432 },
  "Illinois St.": { city: "Normal", state: "IL", lat: 40.5105, lng: -88.9984 },
  "Indiana St.": { city: "Terre Haute", state: "IN", lat: 39.4685, lng: -87.3953 },
  "Missouri St.": { city: "Springfield", state: "MO", lat: 37.2050, lng: -93.2850 },
  "Murray St.": { city: "Murray", state: "KY", lat: 36.6122, lng: -88.3186 },
  "Northern Iowa": { city: "Cedar Falls", state: "IA", lat: 42.5136, lng: -92.4585 },
  "Southern Illinois": { city: "Carbondale", state: "IL", lat: 37.7136, lng: -89.2168 },
  UIC: { city: "Chicago", state: "IL", lat: 41.8708, lng: -87.6488 },
  Valparaiso: { city: "Valparaiso", state: "IN", lat: 41.4622, lng: -87.0353 },

  // =========================================================================
  // Pac-12 (remaining / realigned members)
  // =========================================================================
  "Oregon St.": { city: "Corvallis", state: "OR", lat: 44.5646, lng: -123.2620 },
  "Washington St.": { city: "Pullman", state: "WA", lat: 46.7298, lng: -117.1817 },

  // =========================================================================
  // Conference USA (C-USA)
  // =========================================================================
  FIU: { city: "Miami", state: "FL", lat: 25.7564, lng: -80.3739 },
  "Jacksonville St.": { city: "Jacksonville", state: "AL", lat: 33.8206, lng: -85.7649 },
  "Kennesaw St.": { city: "Kennesaw", state: "GA", lat: 34.0259, lng: -84.5846 },
  "Liberty": { city: "Lynchburg", state: "VA", lat: 37.3524, lng: -79.1794 },
  "Louisiana Tech": { city: "Ruston", state: "LA", lat: 32.5265, lng: -92.6468 },
  "Middle Tennessee": { city: "Murfreesboro", state: "TN", lat: 35.8489, lng: -86.3901 },
  "New Mexico St.": { city: "Las Cruces", state: "NM", lat: 32.2826, lng: -106.7475 },
  "Sam Houston St.": { city: "Huntsville", state: "TX", lat: 30.7145, lng: -95.5508 },
  "Western Kentucky": { city: "Bowling Green", state: "KY", lat: 36.9866, lng: -86.4414 },

  // =========================================================================
  // MAC (Mid-American Conference)
  // =========================================================================
  Akron: { city: "Akron", state: "OH", lat: 41.0764, lng: -81.5080 },
  "Ball St.": { city: "Muncie", state: "IN", lat: 40.2055, lng: -85.4087 },
  "Bowling Green": { city: "Bowling Green", state: "OH", lat: 41.3783, lng: -83.6273 },
  Buffalo: { city: "Buffalo", state: "NY", lat: 43.0008, lng: -78.7890 },
  "Central Michigan": { city: "Mount Pleasant", state: "MI", lat: 43.5867, lng: -84.7748 },
  "Eastern Michigan": { city: "Ypsilanti", state: "MI", lat: 42.2489, lng: -83.6240 },
  Kent: { city: "Kent", state: "OH", lat: 41.1489, lng: -81.3428 },
  "Kent St.": { city: "Kent", state: "OH", lat: 41.1489, lng: -81.3428 },
  "Miami OH": { city: "Oxford", state: "OH", lat: 39.5078, lng: -84.7452 },
  "Northern Illinois": { city: "DeKalb", state: "IL", lat: 41.9356, lng: -88.7634 },
  Ohio: { city: "Athens", state: "OH", lat: 39.3248, lng: -82.1013 },
  Toledo: { city: "Toledo", state: "OH", lat: 41.6577, lng: -83.6155 },
  "Western Michigan": { city: "Kalamazoo", state: "MI", lat: 42.2833, lng: -85.6137 },

  // =========================================================================
  // Sun Belt
  // =========================================================================
  "App State": { city: "Boone", state: "NC", lat: 36.2126, lng: -81.6827 },
  "Appalachian St.": { city: "Boone", state: "NC", lat: 36.2126, lng: -81.6827 },
  "Arkansas St.": { city: "Jonesboro", state: "AR", lat: 35.8424, lng: -90.6842 },
  "Coastal Carolina": { city: "Conway", state: "SC", lat: 33.7941, lng: -79.0198 },
  "Georgia Southern": { city: "Statesboro", state: "GA", lat: 32.4210, lng: -81.7832 },
  "Georgia St.": { city: "Atlanta", state: "GA", lat: 33.7530, lng: -84.3855 },
  "James Madison": { city: "Harrisonburg", state: "VA", lat: 38.4362, lng: -78.8735 },
  "Little Rock": { city: "Little Rock", state: "AR", lat: 34.7255, lng: -92.2847 },
  Louisiana: { city: "Lafayette", state: "LA", lat: 30.2108, lng: -92.0198 },
  "Marshall": { city: "Huntington", state: "WV", lat: 38.4238, lng: -82.4265 },
  "Old Dominion": { city: "Norfolk", state: "VA", lat: 36.8858, lng: -76.3050 },
  "South Alabama": { city: "Mobile", state: "AL", lat: 30.6962, lng: -88.1828 },
  "Southern Miss": { city: "Hattiesburg", state: "MS", lat: 31.3272, lng: -89.3340 },
  "Southern Mississippi": { city: "Hattiesburg", state: "MS", lat: 31.3272, lng: -89.3340 },
  "Texas State": { city: "San Marcos", state: "TX", lat: 29.8880, lng: -97.9381 },
  Troy: { city: "Troy", state: "AL", lat: 31.7988, lng: -85.9697 },
  "UL Monroe": { city: "Monroe", state: "LA", lat: 32.5291, lng: -92.0721 },

  // =========================================================================
  // CAA (Colonial Athletic Association)
  // =========================================================================
  Campbell: { city: "Buies Creek", state: "NC", lat: 35.4085, lng: -78.7375 },
  Charleston: { city: "Charleston", state: "SC", lat: 32.7834, lng: -79.9371 },
  Delaware: { city: "Newark", state: "DE", lat: 39.6837, lng: -75.7497 },
  Drexel: { city: "Philadelphia", state: "PA", lat: 39.9566, lng: -75.1899 },
  Elon: { city: "Elon", state: "NC", lat: 36.1037, lng: -79.5034 },
  Hampton: { city: "Hampton", state: "VA", lat: 37.0214, lng: -76.3374 },
  Hofstra: { city: "Hempstead", state: "NY", lat: 40.7140, lng: -73.6005 },
  Monmouth: { city: "West Long Branch", state: "NJ", lat: 40.2780, lng: -74.0037 },
  "North Carolina A&T": { city: "Greensboro", state: "NC", lat: 36.0687, lng: -79.7766 },
  Northeastern: { city: "Boston", state: "MA", lat: 42.3398, lng: -71.0892 },
  "Stony Brook": { city: "Stony Brook", state: "NY", lat: 40.9126, lng: -73.1234 },
  Towson: { city: "Towson", state: "MD", lat: 39.3943, lng: -76.6094 },
  "William & Mary": { city: "Williamsburg", state: "VA", lat: 37.2709, lng: -76.7109 },
  UNCW: { city: "Wilmington", state: "NC", lat: 34.2274, lng: -77.8726 },

  // =========================================================================
  // Horizon League
  // =========================================================================
  Cleveland: { city: "Cleveland", state: "OH", lat: 41.5025, lng: -81.6735 },
  "Cleveland St.": { city: "Cleveland", state: "OH", lat: 41.5025, lng: -81.6735 },
  Detroit: { city: "Detroit", state: "MI", lat: 42.3534, lng: -83.0675 },
  "Detroit Mercy": { city: "Detroit", state: "MI", lat: 42.3534, lng: -83.0675 },
  "Green Bay": { city: "Green Bay", state: "WI", lat: 44.5316, lng: -87.9002 },
  IUPUI: { city: "Indianapolis", state: "IN", lat: 39.7741, lng: -86.1756 },
  Milwaukee: { city: "Milwaukee", state: "WI", lat: 43.0766, lng: -87.8812 },
  "Northern Kentucky": { city: "Highland Heights", state: "KY", lat: 39.0326, lng: -84.4588 },
  Oakland: { city: "Rochester", state: "MI", lat: 42.6726, lng: -83.2153 },
  "Robert Morris": { city: "Moon Township", state: "PA", lat: 40.5059, lng: -80.1779 },
  Wright: { city: "Dayton", state: "OH", lat: 39.7813, lng: -84.0605 },
  "Wright St.": { city: "Dayton", state: "OH", lat: 39.7813, lng: -84.0605 },
  Youngstown: { city: "Youngstown", state: "OH", lat: 41.1047, lng: -80.6479 },
  "Youngstown St.": { city: "Youngstown", state: "OH", lat: 41.1047, lng: -80.6479 },
  "Purdue Fort Wayne": { city: "Fort Wayne", state: "IN", lat: 41.1157, lng: -85.1053 },

  // =========================================================================
  // Ivy League
  // =========================================================================
  Brown: { city: "Providence", state: "RI", lat: 41.8268, lng: -71.4025 },
  Columbia: { city: "New York", state: "NY", lat: 40.8075, lng: -73.9626 },
  Cornell: { city: "Ithaca", state: "NY", lat: 42.4534, lng: -76.4735 },
  Dartmouth: { city: "Hanover", state: "NH", lat: 43.7044, lng: -72.2887 },
  Harvard: { city: "Cambridge", state: "MA", lat: 42.3770, lng: -71.1167 },
  Pennsylvania: { city: "Philadelphia", state: "PA", lat: 39.9522, lng: -75.1932 },
  Princeton: { city: "Princeton", state: "NJ", lat: 40.3487, lng: -74.6593 },
  Yale: { city: "New Haven", state: "CT", lat: 41.3111, lng: -72.9267 },

  // =========================================================================
  // MAAC (Metro Atlantic Athletic Conference)
  // =========================================================================
  Canisius: { city: "Buffalo", state: "NY", lat: 42.9370, lng: -78.8553 },
  Fairfield: { city: "Fairfield", state: "CT", lat: 41.1687, lng: -73.2551 },
  Iona: { city: "New Rochelle", state: "NY", lat: 40.8951, lng: -73.7830 },
  Manhattan: { city: "Bronx", state: "NY", lat: 40.8887, lng: -73.9017 },
  Marist: { city: "Poughkeepsie", state: "NY", lat: 41.7270, lng: -73.9326 },
  Niagara: { city: "Lewiston", state: "NY", lat: 43.1380, lng: -79.0275 },
  Quinnipiac: { city: "Hamden", state: "CT", lat: 41.4190, lng: -72.8932 },
  Rider: { city: "Lawrenceville", state: "NJ", lat: 40.2848, lng: -74.7295 },
  Siena: { city: "Loudonville", state: "NY", lat: 42.7165, lng: -73.7580 },
  "Saint Peter's": { city: "Jersey City", state: "NJ", lat: 40.7489, lng: -74.0510 },
  "Mount St. Mary's": { city: "Emmitsburg", state: "MD", lat: 39.7003, lng: -77.3252 },
  "Sacred Heart": { city: "Fairfield", state: "CT", lat: 41.2063, lng: -73.2367 },

  // =========================================================================
  // OVC (Ohio Valley Conference)
  // =========================================================================
  "Austin Peay": { city: "Clarksville", state: "TN", lat: 36.5389, lng: -87.3594 },
  "Eastern Illinois": { city: "Charleston", state: "IL", lat: 39.4817, lng: -88.1754 },
  "Eastern Kentucky": { city: "Richmond", state: "KY", lat: 37.7353, lng: -84.2946 },
  Lindenwood: { city: "St. Charles", state: "MO", lat: 38.7881, lng: -90.4974 },
  "Morehead St.": { city: "Morehead", state: "KY", lat: 38.1867, lng: -83.4382 },
  "SE Missouri St.": { city: "Cape Girardeau", state: "MO", lat: 37.3117, lng: -89.5594 },
  "SIU Edwardsville": { city: "Edwardsville", state: "IL", lat: 38.7954, lng: -89.9868 },
  "Tennessee St.": { city: "Nashville", state: "TN", lat: 36.1676, lng: -86.8316 },
  "Tennessee Tech": { city: "Cookeville", state: "TN", lat: 36.1653, lng: -85.5085 },
  "UT Martin": { city: "Martin", state: "TN", lat: 36.3404, lng: -88.8523 },

  // =========================================================================
  // Patriot League
  // =========================================================================
  "American": { city: "Washington", state: "DC", lat: 38.9365, lng: -77.0892 },
  Army: { city: "West Point", state: "NY", lat: 41.3912, lng: -73.9566 },
  Bucknell: { city: "Lewisburg", state: "PA", lat: 40.9553, lng: -76.8844 },
  Colgate: { city: "Hamilton", state: "NY", lat: 42.8181, lng: -75.5399 },
  "Holy Cross": { city: "Worcester", state: "MA", lat: 42.2376, lng: -71.8083 },
  Lafayette: { city: "Easton", state: "PA", lat: 40.6974, lng: -75.2058 },
  Lehigh: { city: "Bethlehem", state: "PA", lat: 40.6066, lng: -75.3779 },
  "Loyola MD": { city: "Baltimore", state: "MD", lat: 39.3478, lng: -76.6276 },
  "Loyola Maryland": { city: "Baltimore", state: "MD", lat: 39.3478, lng: -76.6276 },
  Navy: { city: "Annapolis", state: "MD", lat: 38.9822, lng: -76.4836 },
  "Boston U.": { city: "Boston", state: "MA", lat: 42.3505, lng: -71.1054 },

  // =========================================================================
  // Southern Conference (SoCon)
  // =========================================================================
  Chattanooga: { city: "Chattanooga", state: "TN", lat: 35.0485, lng: -85.3108 },
  "East Tennessee St.": { city: "Johnson City", state: "TN", lat: 36.3020, lng: -82.3663 },
  ETSU: { city: "Johnson City", state: "TN", lat: 36.3020, lng: -82.3663 },
  Furman: { city: "Greenville", state: "SC", lat: 34.9260, lng: -82.4417 },
  Mercer: { city: "Macon", state: "GA", lat: 32.8310, lng: -83.6460 },
  Samford: { city: "Homewood", state: "AL", lat: 33.4654, lng: -86.7942 },
  "The Citadel": { city: "Charleston", state: "SC", lat: 32.7983, lng: -79.9576 },
  "UNC Greensboro": { city: "Greensboro", state: "NC", lat: 36.0687, lng: -79.8064 },
  VMI: { city: "Lexington", state: "VA", lat: 37.7903, lng: -79.4397 },
  "Western Carolina": { city: "Cullowhee", state: "NC", lat: 35.3091, lng: -83.1803 },
  Wofford: { city: "Spartanburg", state: "SC", lat: 34.9727, lng: -81.9328 },

  // =========================================================================
  // Summit League
  // =========================================================================
  Denver: { city: "Denver", state: "CO", lat: 39.6780, lng: -104.9626 },
  "Kansas City": { city: "Kansas City", state: "MO", lat: 39.0383, lng: -94.5793 },
  UMKC: { city: "Kansas City", state: "MO", lat: 39.0383, lng: -94.5793 },
  "North Dakota": { city: "Grand Forks", state: "ND", lat: 47.9253, lng: -97.0329 },
  "North Dakota St.": { city: "Fargo", state: "ND", lat: 46.8952, lng: -96.8003 },
  "Oral Roberts": { city: "Tulsa", state: "OK", lat: 36.0575, lng: -95.9464 },
  "South Dakota": { city: "Vermillion", state: "SD", lat: 42.7790, lng: -96.9299 },
  "South Dakota St.": { city: "Brookings", state: "SD", lat: 44.3114, lng: -96.7827 },
  "St. Thomas": { city: "St. Paul", state: "MN", lat: 44.9454, lng: -93.1897 },
  "Western Illinois": { city: "Macomb", state: "IL", lat: 40.4677, lng: -90.6724 },
  Omaha: { city: "Omaha", state: "NE", lat: 41.2581, lng: -96.0094 },

  // =========================================================================
  // WAC (Western Athletic Conference)
  // =========================================================================
  "Abilene Christian": { city: "Abilene", state: "TX", lat: 32.4401, lng: -99.7584 },
  "Cal Baptist": { city: "Riverside", state: "CA", lat: 33.9302, lng: -117.4144 },
  "Grand Canyon": { city: "Phoenix", state: "AZ", lat: 33.5086, lng: -112.0966 },
  "Seattle U": { city: "Seattle", state: "WA", lat: 47.6089, lng: -122.3176 },
  "Southern Utah": { city: "Cedar City", state: "UT", lat: 37.6775, lng: -113.0619 },
  "Stephen F. Austin": { city: "Nacogdoches", state: "TX", lat: 31.6202, lng: -94.6542 },
  "Tarleton St.": { city: "Stephenville", state: "TX", lat: 32.2232, lng: -98.2019 },
  "Utah Valley": { city: "Orem", state: "UT", lat: 40.2814, lng: -111.7136 },
  "UT Arlington": { city: "Arlington", state: "TX", lat: 32.7299, lng: -97.1142 },
  "UT Rio Grande Valley": { city: "Edinburg", state: "TX", lat: 26.3032, lng: -98.1659 },

  // =========================================================================
  // Big Sky Conference
  // =========================================================================
  "Eastern Washington": { city: "Cheney", state: "WA", lat: 47.4875, lng: -117.5786 },
  Idaho: { city: "Moscow", state: "ID", lat: 46.7262, lng: -117.0143 },
  "Idaho St.": { city: "Pocatello", state: "ID", lat: 42.8606, lng: -112.4286 },
  Montana: { city: "Missoula", state: "MT", lat: 46.8608, lng: -113.9858 },
  "Montana St.": { city: "Bozeman", state: "MT", lat: 45.6672, lng: -111.0544 },
  "Northern Arizona": { city: "Flagstaff", state: "AZ", lat: 35.1887, lng: -111.6559 },
  "Northern Colorado": { city: "Greeley", state: "CO", lat: 40.4045, lng: -104.6975 },
  "Portland St.": { city: "Portland", state: "OR", lat: 45.5118, lng: -122.6850 },
  "Sacramento St.": { city: "Sacramento", state: "CA", lat: 38.5598, lng: -121.4254 },
  "Weber St.": { city: "Ogden", state: "UT", lat: 41.1886, lng: -111.9447 },

  // =========================================================================
  // Big South Conference
  // =========================================================================
  "Charleston Southern": { city: "Charleston", state: "SC", lat: 32.9739, lng: -80.0573 },
  Gardner: { city: "Boiling Springs", state: "NC", lat: 35.2512, lng: -81.6676 },
  "Gardner Webb": { city: "Boiling Springs", state: "NC", lat: 35.2512, lng: -81.6676 },
  "Gardner-Webb": { city: "Boiling Springs", state: "NC", lat: 35.2512, lng: -81.6676 },
  "High Point": { city: "High Point", state: "NC", lat: 35.9714, lng: -80.0019 },
  Longwood: { city: "Farmville", state: "VA", lat: 37.2994, lng: -78.3953 },
  Presbyterian: { city: "Clinton", state: "SC", lat: 34.4733, lng: -81.8801 },
  Radford: { city: "Radford", state: "VA", lat: 37.1318, lng: -80.5763 },
  "UNC Asheville": { city: "Asheville", state: "NC", lat: 35.6156, lng: -82.5658 },
  Winthrop: { city: "Rock Hill", state: "SC", lat: 34.9392, lng: -81.0308 },

  // =========================================================================
  // Big West Conference
  // =========================================================================
  "Cal Poly": { city: "San Luis Obispo", state: "CA", lat: 35.3025, lng: -120.6625 },
  "Cal St. Bakersfield": { city: "Bakersfield", state: "CA", lat: 35.3488, lng: -119.1043 },
  "Cal St. Fullerton": { city: "Fullerton", state: "CA", lat: 33.8829, lng: -117.8854 },
  "Cal St. Northridge": { city: "Northridge", state: "CA", lat: 34.2400, lng: -118.5297 },
  Hawaii: { city: "Honolulu", state: "HI", lat: 21.2970, lng: -157.8160 },
  "Long Beach St.": { city: "Long Beach", state: "CA", lat: 33.7838, lng: -118.1141 },
  "UC Davis": { city: "Davis", state: "CA", lat: 38.5382, lng: -121.7617 },
  "UC Irvine": { city: "Irvine", state: "CA", lat: 33.6405, lng: -117.8443 },
  "UC Riverside": { city: "Riverside", state: "CA", lat: 33.9737, lng: -117.3281 },
  "UC San Diego": { city: "San Diego", state: "CA", lat: 32.8801, lng: -117.2340 },
  "UC Santa Barbara": { city: "Santa Barbara", state: "CA", lat: 34.4133, lng: -119.8488 },

  // =========================================================================
  // MEAC (Mid-Eastern Athletic Conference)
  // =========================================================================
  "Coppin St.": { city: "Baltimore", state: "MD", lat: 39.3099, lng: -76.6558 },
  "Delaware St.": { city: "Dover", state: "DE", lat: 39.1857, lng: -75.5389 },
  Howard: { city: "Washington", state: "DC", lat: 38.9228, lng: -77.0189 },
  "Maryland Eastern Shore": { city: "Princess Anne", state: "MD", lat: 38.2048, lng: -75.6896 },
  Morgan: { city: "Baltimore", state: "MD", lat: 39.3435, lng: -76.5836 },
  "Morgan St.": { city: "Baltimore", state: "MD", lat: 39.3435, lng: -76.5836 },
  "Norfolk St.": { city: "Norfolk", state: "VA", lat: 36.8857, lng: -76.2671 },
  "South Carolina St.": { city: "Orangeburg", state: "SC", lat: 33.4918, lng: -80.8596 },

  // =========================================================================
  // NEC (Northeast Conference)
  // =========================================================================
  "Central Connecticut": { city: "New Britain", state: "CT", lat: 41.6695, lng: -72.7854 },
  "Central Connecticut St.": { city: "New Britain", state: "CT", lat: 41.6695, lng: -72.7854 },
  Fairleigh: { city: "Teaneck", state: "NJ", lat: 40.8962, lng: -74.0088 },
  "Fairleigh Dickinson": { city: "Teaneck", state: "NJ", lat: 40.8962, lng: -74.0088 },
  LIU: { city: "Brooklyn", state: "NY", lat: 40.6895, lng: -73.9833 },
  "Le Moyne": { city: "Syracuse", state: "NY", lat: 43.0367, lng: -76.0802 },
  Merrimack: { city: "North Andover", state: "MA", lat: 42.6843, lng: -71.1247 },
  "St. Francis PA": { city: "Loretto", state: "PA", lat: 40.5049, lng: -78.6305 },
  "St. Francis Brooklyn": { city: "Brooklyn", state: "NY", lat: 40.6913, lng: -73.9975 },
  Wagner: { city: "Staten Island", state: "NY", lat: 40.5833, lng: -74.1048 },

  // =========================================================================
  // SWAC (Southwestern Athletic Conference)
  // =========================================================================
  "Alabama A&M": { city: "Huntsville", state: "AL", lat: 34.7836, lng: -86.5688 },
  "Alabama St.": { city: "Montgomery", state: "AL", lat: 32.3641, lng: -86.2956 },
  "Alcorn St.": { city: "Lorman", state: "MS", lat: 31.8552, lng: -91.1313 },
  "Bethune-Cookman": { city: "Daytona Beach", state: "FL", lat: 29.1975, lng: -81.0471 },
  "Florida A&M": { city: "Tallahassee", state: "FL", lat: 30.4252, lng: -84.2837 },
  "Grambling St.": { city: "Grambling", state: "LA", lat: 32.5235, lng: -92.7154 },
  "Jackson St.": { city: "Jackson", state: "MS", lat: 32.2959, lng: -90.2122 },
  "Mississippi Valley St.": { city: "Itta Bena", state: "MS", lat: 33.4954, lng: -90.3187 },
  "Prairie View A&M": { city: "Prairie View", state: "TX", lat: 30.0858, lng: -95.9878 },
  "Southern": { city: "Baton Rouge", state: "LA", lat: 30.5168, lng: -91.1917 },
  "Southern U.": { city: "Baton Rouge", state: "LA", lat: 30.5168, lng: -91.1917 },
  "Texas Southern": { city: "Houston", state: "TX", lat: 29.7224, lng: -95.3555 },

  // =========================================================================
  // America East (AE)
  // =========================================================================
  Albany: { city: "Albany", state: "NY", lat: 42.6860, lng: -73.8227 },
  Binghamton: { city: "Binghamton", state: "NY", lat: 42.0899, lng: -75.9686 },
  Bryant: { city: "Smithfield", state: "RI", lat: 41.8431, lng: -71.5243 },
  Maine: { city: "Orono", state: "ME", lat: 44.9003, lng: -68.6719 },
  "New Hampshire": { city: "Durham", state: "NH", lat: 43.1339, lng: -70.9264 },
  NJIT: { city: "Newark", state: "NJ", lat: 40.7425, lng: -74.1788 },
  UMBC: { city: "Baltimore", state: "MD", lat: 39.2550, lng: -76.7109 },
  "UMass Lowell": { city: "Lowell", state: "MA", lat: 42.6541, lng: -71.3245 },
  Vermont: { city: "Burlington", state: "VT", lat: 44.4779, lng: -73.1965 },

  // =========================================================================
  // ASUN (Atlantic Sun Conference)
  // =========================================================================
  Bellarmine: { city: "Louisville", state: "KY", lat: 38.2075, lng: -85.6836 },
  "Central Arkansas": { city: "Conway", state: "AR", lat: 35.0754, lng: -92.4613 },
  "Florida Gulf Coast": { city: "Fort Myers", state: "FL", lat: 26.4617, lng: -81.7699 },
  "Jacksonville": { city: "Jacksonville", state: "FL", lat: 30.3519, lng: -81.6071 },
  "Lipscomb": { city: "Nashville", state: "TN", lat: 36.1114, lng: -86.8010 },
  "North Alabama": { city: "Florence", state: "AL", lat: 34.8071, lng: -87.6756 },
  "North Florida": { city: "Jacksonville", state: "FL", lat: 30.2699, lng: -81.5091 },
  Queens: { city: "Charlotte", state: "NC", lat: 35.1878, lng: -80.8360 },
  Stetson: { city: "DeLand", state: "FL", lat: 29.0350, lng: -81.3025 },

  // =========================================================================
  // Southland Conference
  // =========================================================================
  "Houston Christian": { city: "Houston", state: "TX", lat: 29.7262, lng: -95.3437 },
  Incarnate: { city: "San Antonio", state: "TX", lat: 29.4307, lng: -98.4702 },
  "Incarnate Word": { city: "San Antonio", state: "TX", lat: 29.4307, lng: -98.4702 },
  Lamar: { city: "Beaumont", state: "TX", lat: 30.0496, lng: -94.0766 },
  McNeese: { city: "Lake Charles", state: "LA", lat: 30.2106, lng: -93.2082 },
  "McNeese St.": { city: "Lake Charles", state: "LA", lat: 30.2106, lng: -93.2082 },
  "Nicholls St.": { city: "Thibodaux", state: "LA", lat: 29.7967, lng: -90.8221 },
  "Northwestern St.": { city: "Natchitoches", state: "LA", lat: 31.7579, lng: -93.0863 },
  "Southeastern Louisiana": { city: "Hammond", state: "LA", lat: 30.5125, lng: -90.4623 },
  "Texas A&M Commerce": { city: "Commerce", state: "TX", lat: 33.2473, lng: -95.9011 },
  "Texas A&M Corpus Christi": { city: "Corpus Christi", state: "TX", lat: 27.7140, lng: -97.3279 },

  // =========================================================================
  // Additional notable programs / alternate Torvik names
  // =========================================================================
  UConn: { city: "Storrs", state: "CT", lat: 41.8084, lng: -72.2495 },
  TCU: { city: "Fort Worth", state: "TX", lat: 32.7098, lng: -97.3633 },
  UTEP: { city: "El Paso", state: "TX", lat: 31.7698, lng: -106.5042 },
  "Saint Mary's CA": { city: "Moraga", state: "CA", lat: 37.8404, lng: -122.1102 },
  "Loyola IL": { city: "Chicago", state: "IL", lat: 41.9995, lng: -87.6577 },
  UMES: { city: "Princess Anne", state: "MD", lat: 38.2048, lng: -75.6896 },
  SFA: { city: "Nacogdoches", state: "TX", lat: 31.6202, lng: -94.6542 },
  UMass: { city: "Amherst", state: "MA", lat: 42.3868, lng: -72.5301 },
  "NC A&T": { city: "Greensboro", state: "NC", lat: 36.0687, lng: -79.7766 },
  UNC: { city: "Chapel Hill", state: "NC", lat: 35.905, lng: -79.047 },
  UNCG: { city: "Greensboro", state: "NC", lat: 36.0687, lng: -79.8064 },
  "St. Joseph's": { city: "Philadelphia", state: "PA", lat: 40.0008, lng: -75.2410 },
  Penn: { city: "Philadelphia", state: "PA", lat: 39.9522, lng: -75.1932 },
  GW: { city: "Washington", state: "DC", lat: 38.8997, lng: -77.0486 },
  UCSB: { city: "Santa Barbara", state: "CA", lat: 34.4133, lng: -119.8488 },
  SDSU: { city: "San Diego", state: "CA", lat: 32.7757, lng: -117.0719 },
  Pitt: { city: "Pittsburgh", state: "PA", lat: 40.4444, lng: -79.9532 },

  // =========================================================================
  // Additional D-1 programs commonly appearing in Torvik data
  // =========================================================================
  "SE Louisiana": { city: "Hammond", state: "LA", lat: 30.5125, lng: -90.4623 },
  "Sam Houston": { city: "Huntsville", state: "TX", lat: 30.7145, lng: -95.5508 },
  "Southern Indiana": { city: "Evansville", state: "IN", lat: 37.9585, lng: -87.6791 },
  "Stonehill": { city: "Easton", state: "MA", lat: 42.0543, lng: -71.1066 },
};

// ---------------------------------------------------------------------------
// Lookup helper
// ---------------------------------------------------------------------------

/**
 * Looks up the campus location for a given team name.
 *
 * Handles naming discrepancies between data sources by trying the original
 * name first, then common variants ("State" ↔ "St.", "Saint" ↔ "St.").
 * Falls back to the default center-of-US location if not found.
 *
 * @param teamName - The team name from any data source.
 * @returns The campus location with city, state, lat, lng.
 */
export function getCampusLocation(teamName: string): CampusLocation {
  // Try exact match first
  if (CAMPUS_LOCATIONS[teamName]) return CAMPUS_LOCATIONS[teamName];

  // Try "State" → "St." variant (e.g., "Utah State" → "Utah St.")
  if (/\sState$/.test(teamName)) {
    const stVariant = teamName.replace(/\sState$/, " St.");
    if (CAMPUS_LOCATIONS[stVariant]) return CAMPUS_LOCATIONS[stVariant];
  }

  // Try "St." → "State" variant (e.g., "Utah St." → "Utah State")
  if (/\sSt\.$/.test(teamName)) {
    const stateVariant = teamName.replace(/\sSt\.$/, " State");
    if (CAMPUS_LOCATIONS[stateVariant]) return CAMPUS_LOCATIONS[stateVariant];
  }

  // Try "Saint" → "St." prefix variant (e.g., "Saint Mary's" → "St. Mary's")
  if (/^Saint\s/.test(teamName)) {
    const stPrefixVariant = teamName.replace(/^Saint\s/, "St. ");
    if (CAMPUS_LOCATIONS[stPrefixVariant]) return CAMPUS_LOCATIONS[stPrefixVariant];
  }

  // Try "St." → "Saint" prefix variant (e.g., "St. Mary's" → "Saint Mary's")
  if (/^St\.\s/.test(teamName)) {
    const saintVariant = teamName.replace(/^St\.\s/, "Saint ");
    if (CAMPUS_LOCATIONS[saintVariant]) return CAMPUS_LOCATIONS[saintVariant];
  }

  // Try middle "State" → "St." (e.g., "Cal State Bakersfield" → "Cal St. Bakersfield")
  if (/\sState\s/.test(teamName)) {
    const midStVariant = teamName.replace(/\sState\s/, " St. ");
    if (CAMPUS_LOCATIONS[midStVariant]) return CAMPUS_LOCATIONS[midStVariant];
  }

  return DEFAULT_CAMPUS_LOCATION;
}
