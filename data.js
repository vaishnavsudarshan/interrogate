// Fact sheets for each game mode.
// Countries: geography from countries-raw.js, plus hand-kept lists below.
// States: fully hand-kept below.
// A "note" on a fact marks a judgement call. The AI never uses its lie on one,
// and neither can the player.

const L = s => new Set(s.trim().split(/\s+/));

/* ---------------- COUNTRIES ---------------- */

const C_LISTS = {
  island: L("ATG BHS BHR BRB BRN CPV COM CUB CYP DMA DOM FJI GRD HTI ISL IDN IRL JAM JPN KIR MDG MDV MLT MHL MUS FSM NRU NZL PLW PNG PHL KNA LCA VCT WSM STP SYC SGP SLB LKA TLS TON TTO TUV GBR VUT"),
  med: L("ESP FRA MCO ITA MLT SVN HRV BIH MNE ALB GRC TUR CYP SYR LBN ISR PSE EGY LBY TUN DZA MAR"),
  equator: L("ECU COL BRA STP GAB COG COD UGA KEN SOM MDV IDN KIR"),
  p100: L("CHN IND USA IDN PAK NGA BRA BGD RUS ETH MEX JPN EGY PHL COD VNM"),
  p50extra: L("IRN TUR DEU THA GBR FRA TZA ZAF ITA KEN MMR COL KOR SDN"),
  p100k: L("VAT TUV NRU PLW SMR MCO LIE MHL KNA DMA AND ATG"),
  p1: L("VAT TUV NRU PLW SMR MCO LIE MHL KNA DMA AND ATG SYC TON FSM GRD VCT KIR LCA WSM STP VUT BRB ISL MDV BLZ BHS BRN MLT CPV SUR MNE LUX SLB BTN COM GUY FJI"),
  monarchy: L("AND ATG AUS BHS BHR BEL BLZ BTN BRN KHM CAN DNK SWZ GRD JAM JPN JOR KWT LSO LIE LUX MYS MCO MAR NLD NZL NOR OMN PNG QAT KNA LCA VCT SAU SLB ESP SWE THA TON TUV ARE GBR VAT"),
  eu: L("AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX MLT NLD POL PRT ROU SVK SVN ESP SWE"),
  nato: L("ALB BEL BGR CAN HRV CZE DNK EST FIN FRA DEU GRC HUN ISL ITA LVA LTU LUX MNE NLD MKD NOR POL PRT ROU SVK SVN ESP SWE TUR GBR USA"),
  commonwealth: L("ATG AUS BHS BGD BRB BLZ BWA BRN CMR CAN CYP DMA SWZ FJI GAB GMB GHA GRD GUY IND JAM KEN KIR LSO MWI MYS MDV MLT MUS MOZ NAM NRU NZL NGA PAK PNG RWA KNA LCA VCT WSM SYC SLE SGP SLB ZAF LKA TZA TGO TON TTO TUV UGA GBR VUT ZMB"),
  g20: L("ARG AUS BRA CAN CHN FRA DEU IND IDN ITA JPN KOR MEX RUS SAU ZAF TUR GBR USA"),
  left: L("ATG AUS BHS BGD BRB BTN BWA BRN CYP DMA SWZ FJI GRD GUY IND IDN IRL JAM JPN KEN KIR LSO MWI MYS MDV MLT MUS MOZ NAM NRU NPL NZL PAK PNG KNA LCA VCT WSM SYC SGP SLB ZAF LKA SUR TZA THA TLS TON TTO TUV UGA GBR ZMB ZWE"),
  olympics: L("GRC FRA USA GBR SWE BEL NLD DEU FIN AUS ITA JPN MEX CAN RUS KOR ESP CHN BRA"),
  worldcup: L("URY ITA FRA BRA CHE SWE CHL GBR MEX DEU ARG ESP USA JPN KOR ZAF RUS QAT CAN"),
  middleEast: L("BHR EGY IRN IRQ ISR JOR KWT LBN OMN PSE QAT SAU SYR TUR ARE YEM"),
  southAsia: L("AFG BGD BTN IND MDV NPL PAK LKA"),
  nordic: L("DNK FIN ISL NOR SWE"),
};

const C_NAMES = {
  TUR: ["Turkey", "Türkiye|Turkiye"],
  COD: ["DR Congo", "Democratic Republic of the Congo|Congo-Kinshasa|DRC"],
  COG: [null, "Congo-Brazzaville|Congo Republic"],
  CIV: [null, "Côte d'Ivoire|Cote d'Ivoire"],
  CZE: [null, "Czech Republic"],
  MMR: [null, "Burma"],
  SWZ: [null, "Swaziland"],
  MKD: [null, "Macedonia"],
  CPV: [null, "Cabo Verde"],
  GMB: [null, "The Gambia"],
  BHS: [null, "The Bahamas"],
  USA: [null, "USA|US|United States of America"],
  GBR: [null, "UK|Britain|Great Britain|England"],
  VAT: [null, "Holy See|Vatican"],
  FSM: [null, "Federated States of Micronesia"],
  NLD: [null, "Holland"],
};

const DEFACTO = "No law makes it official, but it's the language of government: counted as yes.";
const C_NOTES = {
  RUS: { c_as: "Spans Europe and Asia: yes to both.", c_eu: "Spans Europe and Asia: yes to both." },
  TUR: { c_as: "Spans Europe and Asia: yes to both.", c_eu: "Spans Europe and Asia: yes to both.", r_me: "Usually counted as part of the Middle East: yes." },
  KAZ: { c_as: "A small part lies west of the Ural River: yes to both Europe and Asia.", c_eu: "A small part lies west of the Ural River: yes to both Europe and Asia." },
  EGY: { c_as: "The Sinai Peninsula is in Asia, but Egypt counts as Africa only.", r_me: "Usually counted as part of the Middle East: yes." },
  CYP: { c_eu: "An EU member on an island off Asia: counted as Europe.", c_as: "An EU member on an island off Asia: counted as Europe, not Asia." },
  GEO: { c_eu: "Sits between Europe and Asia. Counted as Asia, following the UN." },
  ARM: { c_eu: "Sits between Europe and Asia. Counted as Asia, following the UN." },
  AZE: { c_eu: "Sits between Europe and Asia. Counted as Asia, following the UN.", l_ru: "Only Azerbaijani is official: no." },
  IRN: { r_me: "Usually counted as part of the Middle East: yes.", r_sas: "Counted as the Middle East, not South Asia." },
  COD: { south: "Most of its land lies south of the equator: yes." },
  KEN: { south: "Judged by its center point, which is just north of the equator: no." },
  MDV: { equator: "The equator passes between its southern atolls: counted as yes.", tiny: "Exactly 300 km²: counted as no." },
  KIR: { equator: "The equator runs through its island groups: counted as yes." },
  STP: { equator: "The equator crosses its small islet Ilhéu das Rolas: counted as yes." },
  GNQ: { equator: "The equator passes over its sea, not its land: no." },
  AUS: { island: "Counted as a continent, not an island nation: no.", l_en: DEFACTO },
  BRN: { island: "It shares Borneo with Malaysia and Indonesia, but it's entirely on an island: yes." },
  GBR: { l_en: DEFACTO, worldcup: "England hosted in 1966: yes." },
  NZL: { l_en: DEFACTO },
  USA: { l_en: "Made official by executive order in 2025: yes." },
  MEX: { l_es: DEFACTO },
  ISR: { l_ar: "Arabic has a 'special status' but isn't official since 2018: no." },
  LBN: { l_fr: "French is widely used but not official: no." },
  MYS: { l_en: "English is widely used but only Malay is official: no." },
  TJK: { l_ru: "Russian is a 'language of interethnic communication', not official: no." },
  KAZ_l: null,
  ERI: { l_ar: "Eritrea has no official language. Arabic and English are working languages: counted as yes.", l_en: "Eritrea has no official language. Arabic and English are working languages: counted as yes." },
  NAM: { l_de: "German is a recognized minority language, not official: no." },
  TON: { p100k: "About 100,000 people, right on the line: counted as no." },
  VCT: { p100k: "About 100,000 people, right on the line: counted as no." },
  SDN: { p50: "About 50 million people, right on the line: counted as yes." },
  AND: { monarchy: "Ruled by two co-princes (France's president and a Spanish bishop): yes." },
  VAT: { monarchy: "The Pope is an elected absolute monarch: yes." },
  DEU: { olympics: "Berlin 1936 and Munich 1972: yes.", worldcup: "West Germany 1974 and Germany 2006: yes." },
  CAN: { worldcup: "Co-hosted the 2026 World Cup: yes." },
  FRA: { "b:BRA": "Only through French Guiana, an overseas region: counted as no." },
  BRA: { "b:FRA": "Only through French Guiana, an overseas region: counted as no." },
  ESP: { "b:MAR": "Through Ceuta and Melilla in North Africa: yes." },
  MAR: { "b:ESP": "Through Ceuta and Melilla in North Africa: yes." },
  BIH: { med: "A 20 km stretch of coast at Neum: yes." },
  GNB: { n2: "Hyphenated names count as one word." },
  TLS: { n2: "Hyphenated names count as one word." },
  CIV: { nvow: "Judged by its English name, Ivory Coast: yes." },
};
C_NOTES.KAZ.l_ru = "Russian is used officially alongside Kazakh: yes.";
delete C_NOTES.KAZ_l;

const C_QUESTIONS = [
  ["c_eu", "Is it in Europe?", "Where"],
  ["c_as", "Is it in Asia?", "Where"],
  ["c_af", "Is it in Africa?", "Where"],
  ["c_na", "Is it in North America?", "Where", "Includes Central America and the Caribbean."],
  ["c_sa", "Is it in South America?", "Where"],
  ["c_oc", "Is it in Oceania?", "Where"],
  ["south", "Is it in the Southern Hemisphere?", "Where", "Judged by the country's center point."],
  ["equator", "Does the equator pass through it?", "Where"],
  ["r_me", "Is it in the Middle East?", "Regions"],
  ["r_carib", "Is it in the Caribbean?", "Regions"],
  ["r_camer", "Is it in Central America?", "Regions", "Mexico counts as North America."],
  ["r_sea", "Is it in Southeast Asia?", "Regions"],
  ["r_sas", "Is it in South Asia?", "Regions"],
  ["r_cas", "Is it in Central Asia?", "Regions", "The five '-stan' countries north of Afghanistan."],
  ["r_eas", "Is it in East Asia?", "Regions"],
  ["r_nordic", "Is it a Nordic country?", "Regions"],
  ["r_naf", "Is it in North Africa?", "Regions"],
  ["r_waf", "Is it in West Africa?", "Regions"],
  ["r_eaf", "Is it in East Africa?", "Regions", "Follows the UN grouping, which includes Zambia, Zimbabwe, Malawi, Mozambique and Madagascar."],
  ["r_maf", "Is it in Central Africa?", "Regions"],
  ["r_saf", "Is it in Southern Africa?", "Regions", "Follows the UN grouping: South Africa, Namibia, Botswana, Lesotho, Eswatini."],
  ["r_pac", "Is it a Pacific island nation?", "Regions", "Not counting Australia or New Zealand."],
  ["ll", "Is it landlocked?", "Land"],
  ["island", "Is it an island nation?", "Land", "Made up entirely of islands, even if it shares one."],
  ["med", "Does it have a Mediterranean coast?", "Land"],
  ["big", "Is it bigger than 1 million km²?", "Land"],
  ["gtuk", "Is it bigger than the United Kingdom?", "Land"],
  ["small", "Is it smaller than 10,000 km²?", "Land"],
  ["tiny", "Is it smaller than 300 km²?", "Land"],
  ["nb0", "Does it have no land borders at all?", "Land"],
  ["nb5", "Does it border 5 or more countries?", "Land"],
  ["p100", "Does it have over 100 million people?", "People"],
  ["p50", "Does it have over 50 million people?", "People"],
  ["p1", "Does it have under 1 million people?", "People"],
  ["p100k", "Does it have under 100,000 people?", "People"],
  ["l_en", "Is English an official language?", "Language"],
  ["l_es", "Is Spanish an official language?", "Language"],
  ["l_fr", "Is French an official language?", "Language"],
  ["l_ar", "Is Arabic an official language?", "Language"],
  ["l_pt", "Is Portuguese an official language?", "Language"],
  ["l_ru", "Is Russian an official language?", "Language"],
  ["l_de", "Is German an official language?", "Language"],
  ["monarchy", "Is it a monarchy?", "Politics", "Includes countries whose head of state is King Charles III."],
  ["eu", "Is it in the European Union?", "Politics"],
  ["nato", "Is it in NATO?", "Politics"],
  ["commonwealth", "Is it in the Commonwealth?", "Politics"],
  ["g20", "Is it a G20 member?", "Politics"],
  ["left", "Do people drive on the left?", "Culture"],
  ["olympics", "Has it hosted the Summer Olympics?", "Culture"],
  ["worldcup", "Has it hosted the men's World Cup?", "Culture"],
  ["n2", "Is its name more than one word?", "Name", "Uses the name shown in this game."],
  ["nvow", "Does its name start with a vowel?", "Name"],
  ["nia", "Does its name end in -ia?", "Name"],
  ["nstan", "Does its name end in -stan?", "Name"],
];

function buildCountries() {
  const valid = new Set(RAW_COUNTRIES.map(r => r[0]));
  const lang = { eng: "l_en", spa: "l_es", fra: "l_fr", ara: "l_ar", por: "l_pt", rus: "l_ru", deu: "l_de" };
  const langFix = { AUT: ["+deu"], CHE: ["+deu"], BDI: ["+eng"], AZE: ["-rus"], TKM: ["-rus"], UZB: ["-rus"], TJK: ["-rus"], ISR: ["-ara"], LBN: ["-fra"], MYS: ["-eng"], BLZ: ["-spa"], NAM: ["-deu"] };
  const subMap = { "Caribbean": "r_carib", "Central America": "r_camer", "South-Eastern Asia": "r_sea", "Central Asia": "r_cas", "Eastern Asia": "r_eas", "Northern Africa": "r_naf", "Western Africa": "r_waf", "Eastern Africa": "r_eaf", "Middle Africa": "r_maf", "Southern Africa": "r_saf", "Melanesia": "r_pac", "Micronesia": "r_pac", "Polynesia": "r_pac" };
  const ents = RAW_COUNTRIES.map(([id, rawName, region, sub0, ll, bor, area, lat, langs, alts]) => {
    const [nm, extra] = C_NAMES[id] || [];
    const name = nm || rawName;
    const sub = id === "SSD" ? "Eastern Africa" : sub0;
    const aliases = [...(alts ? alts.split("|") : []), ...(extra ? extra.split("|") : []), ...(nm ? [rawName] : [])];
    const f = new Set();
    if (region === "Americas") f.add(sub === "South America" ? "c_sa" : "c_na");
    else f.add({ Europe: "c_eu", Asia: "c_as", Africa: "c_af", Oceania: "c_oc" }[region]);
    if (id === "RUS") f.add("c_as");
    if (id === "TUR" || id === "KAZ") f.add("c_eu");
    if (subMap[sub]) f.add(subMap[sub]);
    for (const k of ["middleEast", "southAsia", "nordic"]) if (C_LISTS[k].has(id)) f.add({ middleEast: "r_me", southAsia: "r_sas", nordic: "r_nordic" }[k]);
    if (lat < 0 || id === "COD") f.add("south");
    if (ll) f.add("ll");
    for (const k of ["island", "med", "equator", "p100", "p1", "p100k","monarchy", "eu", "nato", "commonwealth", "g20", "left", "olympics", "worldcup"]) if (C_LISTS[k].has(id)) f.add(k);
    if (C_LISTS.p100.has(id) || C_LISTS.p50extra.has(id)) f.add("p50");
    if (area > 1e6) f.add("big");
    if (area > 242900) f.add("gtuk");
    if (area < 10000) f.add("small");
    if (area < 300) f.add("tiny");
    // The source lists a Sri Lanka–India border; they only share a sea boundary.
    const rawBor = id === "LKA" ? "" : bor;
    const nb = rawBor ? rawBor.split(",").filter(b => valid.has(b) && b !== id && !(b === "LKA")) : [];
    if (!rawBor) f.add("nb0");
    if (nb.length >= 5) f.add("nb5");
    const ls = new Set(langs ? langs.split(",") : []);
    for (const fx of langFix[id] || []) fx[0] === "+" ? ls.add(fx.slice(1)) : ls.delete(fx.slice(1));
    for (const l of ls) if (lang[l]) f.add(lang[l]);
    if (name.includes(" ")) f.add("n2");
    if (/^[AEIOU]/.test(name)) f.add("nvow");
    if (/ia$/.test(name)) f.add("nia");
    if (/stan$/.test(name)) f.add("nstan");
    return { id, name, aliases, f, nb, notes: C_NOTES[id] || {} };
  });
  return {
    key: "countries", label: "Countries", noun: "country", symbol: "🌍",
    ents, questions: C_QUESTIONS.map(([k, t, g, hint]) => ({ k, t, g, hint })),
    borderText: n => `Does it border ${n}?`,
    rules: [
      "The list is the 193 UN member states plus the two UN observer states, Vatican City and Palestine.",
      "Continents and regions mostly follow the UN's groupings. Russia, Turkey and Kazakhstan count as both Europe and Asia.",
      "Borders are land borders between countries on the list. Overseas territories don't count.",
      "Population cutoffs use recent estimates. The few countries close to a line say so on their fact sheet.",
    ],
  };
}

/* ---------------- US STATES ---------------- */

// code, name, aliases, kind (S=state D=district T=territory), census region, statehood year, neighbors
const S_RAW = [
  ["AL", "Alabama", "", "S", "so", 1819, "FL GA MS TN"],
  ["AK", "Alaska", "", "S", "we", 1959, ""],
  ["AZ", "Arizona", "", "S", "we", 1912, "CA NV UT NM"],
  ["AR", "Arkansas", "", "S", "so", 1836, "LA MO MS OK TN TX"],
  ["CA", "California", "", "S", "we", 1850, "AZ NV OR"],
  ["CO", "Colorado", "", "S", "we", 1876, "KS NE NM OK UT WY"],
  ["CT", "Connecticut", "", "S", "ne", 1788, "MA NY RI"],
  ["DE", "Delaware", "", "S", "so", 1787, "MD NJ PA"],
  ["FL", "Florida", "", "S", "so", 1845, "AL GA"],
  ["GA", "Georgia", "", "S", "so", 1788, "AL FL NC SC TN"],
  ["HI", "Hawaii", "", "S", "we", 1959, ""],
  ["ID", "Idaho", "", "S", "we", 1890, "MT NV OR UT WA WY"],
  ["IL", "Illinois", "", "S", "mw", 1818, "IN IA KY MO WI"],
  ["IN", "Indiana", "", "S", "mw", 1816, "IL KY MI OH"],
  ["IA", "Iowa", "", "S", "mw", 1846, "IL MN MO NE SD WI"],
  ["KS", "Kansas", "", "S", "mw", 1861, "CO MO NE OK"],
  ["KY", "Kentucky", "", "S", "so", 1792, "IL IN MO OH TN VA WV"],
  ["LA", "Louisiana", "", "S", "so", 1812, "AR MS TX"],
  ["ME", "Maine", "", "S", "ne", 1820, "NH"],
  ["MD", "Maryland", "", "S", "so", 1788, "DE PA VA WV DC"],
  ["MA", "Massachusetts", "", "S", "ne", 1788, "CT NH NY RI VT"],
  ["MI", "Michigan", "", "S", "mw", 1837, "IN OH WI"],
  ["MN", "Minnesota", "", "S", "mw", 1858, "IA ND SD WI"],
  ["MS", "Mississippi", "", "S", "so", 1817, "AL AR LA TN"],
  ["MO", "Missouri", "", "S", "mw", 1821, "AR IL IA KS KY NE OK TN"],
  ["MT", "Montana", "", "S", "we", 1889, "ID ND SD WY"],
  ["NE", "Nebraska", "", "S", "mw", 1867, "CO IA KS MO SD WY"],
  ["NV", "Nevada", "", "S", "we", 1864, "AZ CA ID OR UT"],
  ["NH", "New Hampshire", "", "S", "ne", 1788, "ME MA VT"],
  ["NJ", "New Jersey", "", "S", "ne", 1787, "DE NY PA"],
  ["NM", "New Mexico", "", "S", "we", 1912, "AZ CO OK TX"],
  ["NY", "New York", "", "S", "ne", 1788, "CT MA NJ PA VT"],
  ["NC", "North Carolina", "", "S", "so", 1789, "GA SC TN VA"],
  ["ND", "North Dakota", "", "S", "mw", 1889, "MN MT SD"],
  ["OH", "Ohio", "", "S", "mw", 1803, "IN KY MI PA WV"],
  ["OK", "Oklahoma", "", "S", "so", 1907, "AR CO KS MO NM TX"],
  ["OR", "Oregon", "", "S", "we", 1859, "CA ID NV WA"],
  ["PA", "Pennsylvania", "", "S", "ne", 1787, "DE MD NJ NY OH WV"],
  ["RI", "Rhode Island", "", "S", "ne", 1790, "CT MA"],
  ["SC", "South Carolina", "", "S", "so", 1788, "GA NC"],
  ["SD", "South Dakota", "", "S", "mw", 1889, "IA MN MT NE ND WY"],
  ["TN", "Tennessee", "", "S", "so", 1796, "AL AR GA KY MS MO NC VA"],
  ["TX", "Texas", "", "S", "so", 1845, "AR LA NM OK"],
  ["UT", "Utah", "", "S", "we", 1896, "AZ CO ID NV WY"],
  ["VT", "Vermont", "", "S", "ne", 1791, "MA NH NY"],
  ["VA", "Virginia", "", "S", "so", 1788, "KY MD NC TN WV DC"],
  ["WA", "Washington", "Washington State", "S", "we", 1889, "ID OR"],
  ["WV", "West Virginia", "", "S", "so", 1863, "KY MD OH PA VA"],
  ["WI", "Wisconsin", "", "S", "mw", 1848, "IL IA MI MN"],
  ["WY", "Wyoming", "", "S", "we", 1890, "CO ID MT NE SD UT"],
  ["DC", "Washington, D.C.", "DC|District of Columbia|Washington DC", "D", "so", 0, "MD VA"],
  ["PR", "Puerto Rico", "", "T", "", 0, ""],
  ["GU", "Guam", "", "T", "", 0, ""],
  ["AS", "American Samoa", "Samoa", "T", "", 0, ""],
  ["VI", "U.S. Virgin Islands", "US Virgin Islands|USVI|Virgin Islands", "T", "", 0, ""],
  ["MP", "Northern Mariana Islands", "Marianas|CNMI|Saipan", "T", "", 0, ""],
];

const S_LISTS = {
  coast: L("AL AK CA CT DE FL GA HI LA ME MD MA MS NH NJ NY NC OR RI SC TX VA WA PR GU AS VI MP"),
  atl: L("ME NH MA RI CT NY NJ DE MD VA NC SC GA FL PR VI"),
  pac: L("CA OR WA AK HI GU AS MP"),
  gulf: L("TX LA MS AL FL"),
  glakes: L("MN WI IL IN MI OH PA NY"),
  canada: L("AK WA ID MT ND MN MI OH PA NY VT NH ME"),
  mexico: L("CA AZ NM TX"),
  p10: L("CA TX FL NY PA IL OH GA NC MI"),
  p5: L("CA TX FL NY PA IL OH GA NC MI NJ VA WA AZ TN MA IN MD MO WI CO MN SC AL"),
  p1: L("WY VT DC AK ND SD GU AS VI MP"),
  big: L("AK TX CA MT NM AZ NV CO"),
  orig13: L("NH MA RI CT NY NJ PA DE MD VA NC SC GA"),
  newEng: L("CT ME MA NH RI VT"),
  pacisl: L("HI GU AS MP"),
  carib: L("PR VI"),
  missr: L("MN WI IA IL MO KY TN AR MS LA"),
};

const S_NOTES = {
  DC: { st: "A federal district, not a state: no.", terr: "A federal district, not a territory: no.", s_so: "The Census Bureau puts DC in the South: yes.", before1800: "Not a state: no.", after1850: "Not a state: no." },
  MI: { canada: "The border runs through the Great Lakes and rivers: counted as yes." },
  OH: { canada: "The border runs through Lake Erie: counted as yes." },
  PA: { canada: "The border runs through Lake Erie: counted as yes.", coast: "Philadelphia's port is on a river, not the coast: no." },
  VI: { atl: "Its northern shores face the Atlantic: yes." },
  AS: { n2: "Two words: yes." },
};
for (const t of ["PR", "GU", "AS", "VI", "MP"]) {
  S_NOTES[t] = Object.assign(S_NOTES[t] || {}, {
    s_ne: "Territories aren't in any Census region: no.", s_mw: "Territories aren't in any Census region: no.",
    s_so: "Territories aren't in any Census region: no.", s_we: "Territories aren't in any Census region: no.",
    before1800: "Not a state: no.", after1850: "Not a state: no.",
  });
}

const S_QUESTIONS = [
  ["st", "Is it one of the 50 states?", "Status"],
  ["terr", "Is it a territory?", "Status"],
  ["s_ne", "Is it in the Northeast?", "Where", "Census Bureau regions."],
  ["s_mw", "Is it in the Midwest?", "Where", "Census Bureau regions."],
  ["s_so", "Is it in the South?", "Where", "Census Bureau regions."],
  ["s_we", "Is it in the West?", "Where", "Census Bureau regions."],
  ["newEng", "Is it in New England?", "Where"],
  ["pacisl", "Is it an island in the Pacific?", "Where"],
  ["carib", "Is it in the Caribbean?", "Where"],
  ["missr", "Does the Mississippi River touch it?", "Where"],
  ["coast", "Does it have an ocean or Gulf coast?", "Land", "The Great Lakes don't count."],
  ["atl", "Does it touch the Atlantic?", "Land"],
  ["pac", "Does it touch the Pacific?", "Land"],
  ["gulf", "Is it on the Gulf of Mexico?", "Land", "Also called the Gulf of America."],
  ["glakes", "Does it touch a Great Lake?", "Land"],
  ["canada", "Does it border Canada?", "Land"],
  ["mexico", "Does it border Mexico?", "Land"],
  ["big", "Is it over 100,000 square miles?", "Land"],
  ["nb0", "Does it border no other state?", "Land", "DC counts as a neighbor."],
  ["nb5", "Does it border 5 or more?", "Land", "Counting states and DC."],
  ["p10", "Does it have over 10 million people?", "People"],
  ["p5", "Does it have over 5 million people?", "People"],
  ["p1", "Does it have under 1 million people?", "People"],
  ["orig13", "Was it one of the 13 original colonies?", "History"],
  ["before1800", "Did it become a state before 1800?", "History"],
  ["after1850", "Did it become a state after 1850?", "History"],
  ["n2", "Is its name more than one word?", "Name"],
  ["nNew", "Does its name start with 'New'?", "Name"],
  ["ncomp", "Does its name have North, South or West in it?", "Name"],
  ["nvow", "Does its name start with a vowel?", "Name"],
];

function buildStates() {
  const ents = S_RAW.map(([id, name, al, kind, reg, year, nbs]) => {
    const f = new Set();
    if (kind === "S") f.add("st");
    if (kind === "T") f.add("terr");
    if (reg) f.add("s_" + reg);
    for (const k in S_LISTS) if (S_LISTS[k].has(id)) f.add(k);
    if (year && year < 1800) f.add("before1800");
    if (year > 1850) f.add("after1850");
    const nb = nbs ? nbs.split(" ") : [];
    if (!nb.length) f.add("nb0");
    if (nb.length >= 5) f.add("nb5");
    const plain = name.replace(/\./g, "");
    if (plain.includes(" ")) f.add("n2");
    if (/^New /.test(name)) f.add("nNew");
    if (/\b(North|South|West)\b/.test(name)) f.add("ncomp");
    if (/^[AEIOU]/.test(name)) f.add("nvow");
    return { id, name, aliases: al ? al.split("|") : [], f, nb, notes: S_NOTES[id] || {} };
  });
  return {
    key: "states", label: "US states", noun: "state or territory", symbol: "🇺🇸",
    ents, questions: S_QUESTIONS.map(([k, t, g, hint]) => ({ k, t, g, hint })),
    borderText: n => `Does it border ${n}?`,
    rules: [
      "The list is the 50 states, Washington, D.C., and the 5 inhabited territories: Puerto Rico, Guam, American Samoa, the U.S. Virgin Islands and the Northern Mariana Islands.",
      "Regions follow the Census Bureau. DC counts as the South. Territories aren't in any region.",
      "Corners don't count as borders, so Arizona doesn't border Colorado at Four Corners.",
      "Population cutoffs use recent estimates.",
    ],
  };
}
