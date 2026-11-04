/** Shared NBA franchise metadata for seed / refresh scripts. */

export const NBA_TEAMS = [
  { id: "nba_atl", espnId: "1", abbr: "atl", name: "Atlanta Hawks", city: "Atlanta", conference: "EAST", arena: "State Farm Arena", primary: "#E03A3E", secondary: "#C1D32F" },
  { id: "nba_bos", espnId: "2", abbr: "bos", name: "Boston Celtics", city: "Boston", conference: "EAST", arena: "TD Garden", primary: "#007A33", secondary: "#BA9653" },
  { id: "nba_bkn", espnId: "17", abbr: "bkn", name: "Brooklyn Nets", city: "Brooklyn", conference: "EAST", arena: "Barclays Center", primary: "#000000", secondary: "#FFFFFF" },
  { id: "nba_cha", espnId: "30", abbr: "cha", name: "Charlotte Hornets", city: "Charlotte", conference: "EAST", arena: "Spectrum Center", primary: "#1D1160", secondary: "#00788C" },
  { id: "nba_chi", espnId: "4", abbr: "chi", name: "Chicago Bulls", city: "Chicago", conference: "EAST", arena: "United Center", primary: "#CE1141", secondary: "#000000" },
  { id: "nba_cle", espnId: "5", abbr: "cle", name: "Cleveland Cavaliers", city: "Cleveland", conference: "EAST", arena: "Rocket Mortgage FieldHouse", primary: "#860038", secondary: "#FDBB30" },
  { id: "nba_det", espnId: "8", abbr: "det", name: "Detroit Pistons", city: "Detroit", conference: "EAST", arena: "Little Caesars Arena", primary: "#C8102E", secondary: "#1D42BA" },
  { id: "nba_ind", espnId: "11", abbr: "ind", name: "Indiana Pacers", city: "Indiana", conference: "EAST", arena: "Gainbridge Fieldhouse", primary: "#002D62", secondary: "#FDBB30" },
  { id: "nba_mia", espnId: "14", abbr: "mia", name: "Miami Heat", city: "Miami", conference: "EAST", arena: "Kaseya Center", primary: "#98002E", secondary: "#F9A01B" },
  { id: "nba_mil", espnId: "15", abbr: "mil", name: "Milwaukee Bucks", city: "Milwaukee", conference: "EAST", arena: "Fiserv Forum", primary: "#00471B", secondary: "#EEE1C6" },
  { id: "nba_nyk", espnId: "18", abbr: "nyk", name: "New York Knicks", city: "New York", conference: "EAST", arena: "Madison Square Garden", primary: "#006BB6", secondary: "#F58426" },
  { id: "nba_orl", espnId: "19", abbr: "orl", name: "Orlando Magic", city: "Orlando", conference: "EAST", arena: "Kia Center", primary: "#0077C0", secondary: "#C4CED4" },
  { id: "nba_phi", espnId: "20", abbr: "phi", name: "Philadelphia 76ers", city: "Philadelphia", conference: "EAST", arena: "Wells Fargo Center", primary: "#006BB6", secondary: "#ED174C" },
  { id: "nba_tor", espnId: "28", abbr: "tor", name: "Toronto Raptors", city: "Toronto", conference: "EAST", arena: "Scotiabank Arena", primary: "#CE1141", secondary: "#000000" },
  { id: "nba_was", espnId: "27", abbr: "was", name: "Washington Wizards", city: "Washington", conference: "EAST", arena: "Capital One Arena", primary: "#002B5C", secondary: "#E31837" },
  { id: "nba_dal", espnId: "6", abbr: "dal", name: "Dallas Mavericks", city: "Dallas", conference: "WEST", arena: "American Airlines Center", primary: "#00538C", secondary: "#002B5E" },
  { id: "nba_den", espnId: "7", abbr: "den", name: "Denver Nuggets", city: "Denver", conference: "WEST", arena: "Ball Arena", primary: "#0E2240", secondary: "#FEC524" },
  { id: "nba_gsw", espnId: "9", abbr: "gsw", name: "Golden State Warriors", city: "San Francisco", conference: "WEST", arena: "Chase Center", primary: "#1D428A", secondary: "#FFC72C" },
  { id: "nba_hou", espnId: "10", abbr: "hou", name: "Houston Rockets", city: "Houston", conference: "WEST", arena: "Toyota Center", primary: "#CE1141", secondary: "#000000" },
  { id: "nba_lac", espnId: "12", abbr: "lac", name: "LA Clippers", city: "Los Angeles", conference: "WEST", arena: "Intuit Dome", primary: "#C8102E", secondary: "#1D428A" },
  { id: "nba_lal", espnId: "13", abbr: "lal", name: "Los Angeles Lakers", city: "Los Angeles", conference: "WEST", arena: "Crypto.com Arena", primary: "#552583", secondary: "#FDB927" },
  { id: "nba_mem", espnId: "29", abbr: "mem", name: "Memphis Grizzlies", city: "Memphis", conference: "WEST", arena: "FedExForum", primary: "#5D76A9", secondary: "#12173F" },
  { id: "nba_min", espnId: "16", abbr: "min", name: "Minnesota Timberwolves", city: "Minnesota", conference: "WEST", arena: "Target Center", primary: "#0C2340", secondary: "#236192" },
  { id: "nba_nop", espnId: "3", abbr: "nop", name: "New Orleans Pelicans", city: "New Orleans", conference: "WEST", arena: "Smoothie King Center", primary: "#0C2340", secondary: "#C8102E" },
  { id: "nba_okc", espnId: "25", abbr: "okc", name: "Oklahoma City Thunder", city: "Oklahoma City", conference: "WEST", arena: "Paycom Center", primary: "#007AC1", secondary: "#EF3B24" },
  { id: "nba_phx", espnId: "21", abbr: "phx", name: "Phoenix Suns", city: "Phoenix", conference: "WEST", arena: "Mortgage Matchup Center", primary: "#1D1160", secondary: "#E56020" },
  { id: "nba_por", espnId: "22", abbr: "por", name: "Portland Trail Blazers", city: "Portland", conference: "WEST", arena: "Moda Center", primary: "#E03A3E", secondary: "#000000" },
  { id: "nba_sac", espnId: "23", abbr: "sac", name: "Sacramento Kings", city: "Sacramento", conference: "WEST", arena: "Golden 1 Center", primary: "#5A2D81", secondary: "#63727A" },
  { id: "nba_sas", espnId: "24", abbr: "sas", name: "San Antonio Spurs", city: "San Antonio", conference: "WEST", arena: "Frost Bank Center", primary: "#C4CED4", secondary: "#000000" },
  { id: "nba_uta", espnId: "26", abbr: "uta", name: "Utah Jazz", city: "Utah", conference: "WEST", arena: "Delta Center", primary: "#002B5C", secondary: "#00471B" },
];

export function kit(primary, secondary) {
  const light = secondary === "#FFFFFF" || secondary === "#EEE1C6" || secondary === "#C4CED4" || secondary === "#FEC524" || secondary === "#FDB927" || secondary === "#FDBB30" || secondary === "#F9A01B" || secondary === "#C1D32F";
  return {
    shirt: primary,
    shorts: secondary,
    socks: primary,
    trim: secondary,
    numberColor: light ? "#111111" : "#FFFFFF",
  };
}

/** Map ESPN G/F/C (+ height inches) onto PG/SG/SF/PF/C. */
export function mapEspnPosition(abbr, heightInches) {
  const a = (abbr || "G").toUpperCase();
  const h = Number(heightInches) || 76;
  if (a === "C" || a === "C-F" || a === "FC") return "C";
  if (a === "F-C") return h >= 82 ? "C" : "PF";
  if (a === "PF" || a === "F-G" && h >= 80) return "PF";
  if (a === "SF" || a === "F") return h >= 80 ? "PF" : "SF";
  if (a === "SG" || a === "G-F") return h >= 77 ? "SG" : "PG";
  if (a === "PG") return "PG";
  if (a === "G") return h <= 74 ? "PG" : "SG";
  return h >= 82 ? "C" : h >= 79 ? "PF" : h >= 77 ? "SF" : h >= 75 ? "SG" : "PG";
}

export function shortDisplayName(fullName) {
  const parts = String(fullName || "").trim().split(/\s+/);
  if (parts.length < 2) return fullName || "Player";
  const last = parts[parts.length - 1];
  const first = parts[0][0] ? `${parts[0][0]}.` : "";
  return `${first} ${last}`.trim();
}
