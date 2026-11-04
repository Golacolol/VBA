/**
 * Curated current-season overalls for live NBA rosters (espn_* players only).
 * Classic / historic players keep CLASSIC_PEAK_OVR and must never be patched here.
 *
 * Scale (current form, not all-time peak):
 *  95–96  MVP / clear #1
 *  92–94  Superstar tier
 *  88–91  All-NBA / franchise stars
 *  84–87  All-Star / high-end starters
 *  80–83  Solid starters
 *  ≤79    Role / bench (stats-derived, soft-capped)
 */

import { attrsTowardOvr } from "./nbaClassicRatings.mjs";

/** Exact displayName → current overall. */
export const CURRENT_OVR = {
  // MVP / elite
  "Nikola Jokic": 96,
  "Shai Gilgeous-Alexander": 95,
  "Giannis Antetokounmpo": 94,
  "Luka Doncic": 94,
  "Victor Wembanyama": 92,

  // Superstar / All-NBA
  "Anthony Edwards": 91,
  "Jalen Brunson": 90,
  "LeBron James": 90,
  "Stephen Curry": 89,
  "Anthony Davis": 89,
  "Kevin Durant": 89,
  "Jayson Tatum": 88,
  "Donovan Mitchell": 88,
  "Devin Booker": 88,
  "Tyrese Haliburton": 87,
  "Joel Embiid": 87,
  "Kawhi Leonard": 87,
  "Ja Morant": 86,
  "Cade Cunningham": 86,
  "Jaylen Brown": 86,
  "Karl-Anthony Towns": 86,
  "Trae Young": 86,
  "Kyrie Irving": 86,
  "Jamal Murray": 86,
  "Jalen Williams": 86,
  "Tyrese Maxey": 85,
  "Paolo Banchero": 85,
  "Bam Adebayo": 85,
  "Evan Mobley": 85,
  "Chet Holmgren": 85,
  "Domantas Sabonis": 85,
  "Jimmy Butler": 85,
  "Jimmy Butler III": 85,
  "De'Aaron Fox": 85,

  // High-end starters / All-Star fringe
  "Pascal Siakam": 84,
  "James Harden": 84,
  "LaMelo Ball": 84,
  "Zion Williamson": 84,
  "Franz Wagner": 84,
  "Scottie Barnes": 84,
  "Alperen Sengun": 84,
  "Jaren Jackson Jr.": 84,
  "Darius Garland": 84,
  "Derrick White": 84,
  "Damian Lillard": 84,
  "Paul George": 84,
  "Rudy Gobert": 84,
  "Julius Randle": 83,
  "OG Anunoby": 83,
  "Mikal Bridges": 83,
  "Desmond Bane": 83,
  "Austin Reaves": 83,
  "Jrue Holiday": 83,
  "Kristaps Porzingis": 83,
  "DeMar DeRozan": 83,
  "Brandon Miller": 82,
  "Jalen Johnson": 82,
  "Josh Giddey": 82,
  "Zach LaVine": 82,
  "Tyler Herro": 82,
  "Brandon Ingram": 82,
  "Amen Thompson": 82,
  "Myles Turner": 82,
  "Jarrett Allen": 82,
  "Jalen Duren": 82,
  "Aaron Gordon": 82,
  "Draymond Green": 82,
  "Trey Murphy III": 82,
  "Jalen Green": 82,

  // Solid starters
  "Miles Bridges": 81,
  "Dyson Daniels": 81,
  "Coby White": 81,
  "Norman Powell": 81,
  "Payton Pritchard": 81,
  "Michael Porter Jr.": 81,
  "Ivica Zubac": 81,
  "Bradley Beal": 81,
  "Fred VanVleet": 81,
  "Naz Reid": 81,
  "Jaden McDaniels": 81,
  "Luguentz Dort": 81,
  "Alex Caruso": 81,
  "Josh Hart": 81,
  "Jalen Suggs": 81,
  "Devin Vassell": 81,
  "Herbert Jones": 81,
  "Khris Middleton": 81,
  "Walker Kessler": 81,
  "Lauri Markkanen": 83,

  "Anfernee Simons": 80,
  "Christian Braun": 80,
  "RJ Barrett": 80,
  "Immanuel Quickley": 80,
  "Jakob Poeltl": 79,
  "Mark Williams": 80,
  "Nic Claxton": 80,
  "Onyeka Okongwu": 80,
  "Dereck Lively II": 80,
  "Ausar Thompson": 80,
  "Bennedict Mathurin": 80,
  "Andrew Nembhard": 80,
  "Keegan Murray": 80,
  "Deandre Ayton": 80,
  "CJ McCollum": 80,
  "Shaedon Sharpe": 80,
  "Isaiah Hartenstein": 80,
  "Cameron Johnson": 80,
  "Donte DiVincenzo": 80,
  "Jabari Smith Jr.": 80,
  "Klay Thompson": 80,
  "Chris Paul": 80,
  "Brook Lopez": 80,
  "Andrew Wiggins": 80,
  "Rui Hachimura": 80,
  "De'Andre Hunter": 80,

  // Role / lower starters
  "Jordan Poole": 79,
  "John Collins": 79,
  "Tobias Harris": 79,
  "Daniel Gafford": 79,
  "Aaron Nesmith": 79,
  "Malik Monk": 79,
  "Collin Sexton": 79,
  "Jonathan Kuminga": 79,
  "Bobby Portis": 79,
  "Bogdan Bogdanovic": 79,
  "Obi Toppin": 79,
  "Mitchell Robinson": 79,
  "Jaden Ivey": 79,
  "Wendell Carter Jr.": 79,
  "Keldon Johnson": 79,
  "Dillon Brooks": 79,
  "Tari Eason": 79,
  "Russell Westbrook": 79,
  "D'Angelo Russell": 79,
  "Grayson Allen": 79,

  "P.J. Washington": 78,
  "T.J. McConnell": 78,
  "Buddy Hield": 78,
  "Toumani Camara": 78,
  "Scoot Henderson": 78,
  "Keyonte George": 78,
  "Nickeil Alexander-Walker": 78,
  "Mike Conley": 78,
  "Cam Whitmore": 78,
  "Jerami Grant": 78,
  "Al Horford": 78,
  "Brandin Podziemski": 78,
  "Gary Trent Jr.": 77,
  "Kyle Kuzma": 78,
  "Jaime Jaquez Jr.": 78,
  "Jeremy Sochan": 78,
  "Harrison Barnes": 78,
  "Tre Jones": 78,
  "Dennis Schroder": 78,
  "Clint Capela": 78,
  "Caris LeVert": 78,
  "Isaiah Stewart": 78,
  "Jonathan Isaac": 78,
  "Kentavious Caldwell-Pope": 78,
  "Santi Aldama": 78,
  "Brandon Clarke": 78,
  "Zach Edey": 78,
  "Yves Missi": 78,
  "Cooper Flagg": 78,
  "Stephon Castle": 78,
  "Jusuf Nurkic": 78,
  "Kevin Porter Jr.": 78,
  "Terance Mann": 78,

  "Deni Avdija": 81,
  "Sam Hauser": 77,
  "Neemias Queta": 77,
  "Gabe Vincent": 76,
  "Jarred Vanderbilt": 77,
  "Dalton Knecht": 77,
  "Max Christie": 77,
  "Quentin Grimes": 77,
  "Royce O'Neale": 77,
  "Kevin Huerter": 77,
  "Gradey Dick": 77,
  "Cole Anthony": 77,
  "Andre Drummond": 77,
  "Jared McCain": 77,
  "Naji Marshall": 77,
  "Kris Dunn": 77,
  "Zach Collins": 77,
  "Miles McBride": 77,
  "Duncan Robinson": 77,
  "Malik Beasley": 77,
  "Max Strus": 77,

  "Reed Sheppard": 76,
  "Kon Knueppel": 76,
  "Luke Kornet": 76,
  "Moses Moody": 76,
  "Kevon Looney": 76,
  "Trayce Jackson-Davis": 76,
  "Kyle Anderson": 76,
  "Gary Payton II": 76,
  "De'Anthony Melton": 76,
  "Nikola Jovic": 76,
  "Kel'el Ware": 76,
  "Caleb Martin": 76,
  "Precious Achiuwa": 76,
  "Goga Bitadze": 76,
  "Isaac Okoro": 76,
  "Sam Merrill": 76,
  "Anthony Black": 76,
  "Moritz Wagner": 76,
  "GG Jackson": 76,
  "Vince Williams Jr.": 76,
  "Scotty Pippen Jr.": 76,
  "Luke Kennard": 76,
  "Peyton Watson": 76,
  "Spencer Dinwiddie": 76,
  "Davion Mitchell": 76,
  "Jordan Hawkins": 76,
  "Jose Alvarado": 76,
  "Larry Nance Jr.": 76,
  "Tre Mann": 76,
  "Nick Richards": 76,
  "Josh Green": 76,
  "Isaiah Jackson": 76,
  "Cason Wallace": 79,
  "Aaron Wiggins": 78,
  "Isaiah Joe": 78,
  "Jaxson Hayes": 76,
  "Trey Lyles": 76,
  "Keon Ellis": 76,
  "Marcus Sasser": 76,
  "Ron Holland": 76,
  "Simone Fontecchio": 75,
  "Georges Niang": 75,
  "Eric Gordon": 75,
  "Kyle Lowry": 75,
  "Nicolas Batum": 75,
  "Julian Champagnie": 75,
  "Ochai Agbaji": 75,
  "Chris Boucher": 75,
  "Ben Sheppard": 75,
  "Jarace Walker": 75,
  "Zaccharie Risacher": 77,
  "Terrence Shannon Jr.": 75,
  "Rob Dillingham": 75,
  "Jaylen Wells": 75,
  "Ajay Mitchell": 75,
  "Dario Saric": 75,
  "Guerschon Yabusele": 75,
  "Grant Williams": 75,
  "Cody Martin": 75,
  "Kelly Olynyk": 75,
  "Haywood Highsmith": 75,
  "Taurean Prince": 75,
  "Bones Hyland": 75,
  "Amir Coffey": 75,
  "Tristan da Silva": 75,

  "Bronny James": 68,
};

/** Soft ceiling for non-curated current players (keeps role bigs under stars). */
export const CURRENT_UNCATEGORIZED_MAX = 81;

/**
 * Resolve curated current OVR by exact or loose display-name match.
 * @param {string} name
 * @returns {number | null}
 */
export function currentOvrFor(name) {
  if (!name) return null;
  if (CURRENT_OVR[name] != null) return CURRENT_OVR[name];
  const stripped = name.replace(/\s+(Jr\.|Sr\.|III|II|IV)$/i, "").trim();
  if (stripped !== name && CURRENT_OVR[stripped] != null) return CURRENT_OVR[stripped];
  const key = Object.keys(CURRENT_OVR).find(
    (k) => name === k || name.startsWith(`${k} `) || stripped === k.replace(/\s+(Jr\.|Sr\.|III|II|IV)$/i, "").trim(),
  );
  return key ? CURRENT_OVR[key] : null;
}

/**
 * Attrs for a current-roster player aimed at curated (or capped) overall.
 * @param {string} pos
 * @param {string} name
 * @param {number} target
 * @param {{ jitter?: () => number }} [opts]
 */
export function currentAttrsFor(pos, name, target, opts = {}) {
  return attrsTowardOvr(pos, target, { name, jitter: opts.jitter });
}

/**
 * Compress an inflated stats-derived overall into the role-player band.
 * @param {number} provisional
 */
export function compressUncategorizedOvr(provisional) {
  const p = Number(provisional) || 70;
  if (p <= 78) return Math.round(p);
  // 79→75 … 85→78 … 90→81
  return Math.min(CURRENT_UNCATEGORIZED_MAX, Math.round(68 + (p - 70) * 0.6));
}
