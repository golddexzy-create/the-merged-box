export const BAND_MIN = 540;
export const BAND_MAX = 1600;
export const LOCK_KHZ = 48;

export type RadioId = "cathedral" | "tombstone" | "bakelite" | "console";
export type KitId = RadioId | "merge";

export interface Radio {
  id: RadioId;
  year: string;
  shape: string;
  model: string;
  call: string;
  freq: number;
  title: string;
}

export interface Kit {
  bpm: number;
  swing: boolean;
  organ: boolean;
  kick: number[];
  snare: number[];
  hat: number[];
  voice: number[];
  teletype: number[];
  bass: (number | null)[];
  lead: (number | null)[];
}

export const RADIOS: readonly Radio[] = [
  {
    id: "cathedral",
    year: "1931",
    shape: "Cathedral",
    model: "Arch & Hymn",
    call: "WMBX",
    freq: 640,
    title: "Sunday Cabinet",
  },
  {
    id: "tombstone",
    year: "1936",
    shape: "Tombstone",
    model: "Shoulder Set",
    call: "KTMB",
    freq: 860,
    title: "The Bulletin",
  },
  {
    id: "bakelite",
    year: "1947",
    shape: "Bakelite",
    model: "Desk Brick",
    call: "WBZT",
    freq: 1120,
    title: "Protocol Wire",
  },
  {
    id: "console",
    year: "1956",
    shape: "Console",
    model: "Lowboy",
    call: "KGRV",
    freq: 1400,
    title: "Lowboy Groove",
  },
];

const n = (steps: number[]) => steps;

export const KITS: Record<KitId, Kit> = {
  cathedral: {
    bpm: 76,
    swing: true,
    organ: true,
    kick: n([0, 10]),
    snare: n([8]),
    hat: n([2, 6, 12, 14]),
    voice: [],
    teletype: [],
    bass: [0, null, null, null, 2, null, null, null, 4, null, null, 3, 2, null, null, null],
    lead: [null, null, 4, null, null, 5, null, null, 4, null, null, null, 2, null, 0, null],
  },
  tombstone: {
    bpm: 92,
    swing: false,
    organ: false,
    kick: n([0, 8]),
    snare: n([4, 12]),
    hat: n([6, 14]),
    voice: n([0, 2, 3, 6, 8, 11, 12, 14]),
    teletype: n([15]),
    bass: [0, null, null, null, null, null, 0, null, 3, null, null, null, null, null, 2, null],
    lead: [null, null, null, null, 4, null, null, null, null, null, 3, null, null, null, null, null],
  },
  bakelite: {
    bpm: 114,
    swing: false,
    organ: false,
    kick: n([0, 4, 8, 12]),
    snare: n([4, 12]),
    hat: n([2, 6, 10, 14]),
    voice: [],
    teletype: n([0, 2, 4, 6, 8, 10, 12, 14]),
    bass: [0, null, 0, null, 4, null, 3, null, 0, null, 7, null, 5, null, 3, 2],
    lead: [null, null, 7, null, null, null, 5, null, null, 4, null, null, 3, null, null, null],
  },
  console: {
    bpm: 104,
    swing: true,
    organ: false,
    kick: n([0, 8]),
    snare: n([4, 12]),
    hat: n([2, 6, 10, 14, 15]),
    voice: [],
    teletype: [],
    bass: [0, null, 0, null, 3, null, 4, null, 5, null, 4, null, 3, null, 2, 0],
    lead: [4, null, null, 5, null, 7, null, 5, null, 4, null, 3, null, 2, null, null],
  },
  merge: {
    bpm: 102,
    swing: true,
    organ: true,
    kick: n([0, 7, 8]),
    snare: n([4, 12]),
    hat: n([2, 6, 10, 14]),
    voice: n([4, 12]),
    teletype: n([3, 11]),
    bass: [0, null, 3, null, 4, null, 7, null, 5, null, 4, null, 3, null, 2, null],
    lead: [null, null, 4, null, 7, null, null, 5, null, null, 4, null, 2, null, 0, null],
  },
};

export function nearestRadio(freq: number): { radio: Radio; dist: number } {
  let best: Radio = RADIOS[0];
  let dist = Infinity;
  for (const radio of RADIOS) {
    const d = Math.abs(radio.freq - freq);
    if (d < dist) {
      dist = d;
      best = radio;
    }
  }
  return { radio: best, dist };
}

export function lockAmount(freq: number, merged: boolean): number {
  if (merged) return 1;
  const { dist } = nearestRadio(freq);
  const t = 1 - dist / LOCK_KHZ;
  if (t <= 0) return 0;
  return t * t * (3 - 2 * t);
}

export interface ScriptBook {
  desk: string;
  lines: readonly string[];
}

export const SCRIPTS: Record<KitId, ScriptBook> = {
  cathedral: {
    desk: "Parlor",
    lines: [
      "The Arch & Hymn cabinet is open. Organ fifths sit under a slow swing. Protocol three — nobody talks over the harmony.",
      "Front room to the floor. Keep the parlor lamp low. Ellis stays off this shot unless the tally calls him.",
      "Sunday cabinet, weekday wire. The old arch still tunes. Let it breathe before you cue the desk.",
    ],
  },
  tombstone: {
    desk: "News desk",
    lines: [
      "Good evening. River gauge is down a foot at the junction. The late freight is holding. Read it once, then let the cameraman mark.",
      "City desk to the floor. Tombstone cabinet on 860. The bulletin is cold copy — do not color it.",
      "Shoulder set is live. Cam 1 has the ribbon mic. Protocol six: the tally is law. Quiet behind Ellis.",
    ],
  },
  bakelite: {
    desk: "Business floor",
    lines: [
      "Desk to floor. The close is firm. Clerks hold Protocol fourteen until Camera 3 clears the teletype. Numbers do not move early.",
      "Bakelite brick on the night board. Wheat wire unchanged. Lamp oil steady. Merger docket stays open.",
      "Business place is in session. Marlow holds the clerks wide. No one rips the tape while the groove is counting.",
    ],
  },
  console: {
    desk: "After the close",
    lines: [
      "Lowboy is walking. If you are on the floor, you are in the groove — stay out of Inez's lens.",
      "1956 console, the wide cabinet. After the close the house finally moves. Keep the cable taped.",
      "KGRV has the night. Brush and bass. The news desk is dark. The business lamps stay up.",
    ],
  },
  merge: {
    desk: "All desks",
    lines: [
      "All four boxes, one cabinet. Cathedral, tombstone, bakelite, lowboy — phased. This is the groove lock. The floor is hot.",
      "Merged wire. News copy under the business tape, parlor fifths under both. Inez holds the wide. Do not reframe.",
      "Protocol seventeen. Four cabinets, one groove. Cameramen mark together. The old days are playing at once.",
    ],
  },
};

export const CAMERAS = [
  {
    id: "CAM 1",
    op: "Ellis",
    role: "Anchor",
    shot: "left",
    call: "Ellis marks the anchor. Ribbon mic. Eyes to lens.",
  },
  {
    id: "CAM 2",
    op: "Inez",
    role: "The box",
    shot: "mid",
    call: "Inez pedestals down. The merged cabinet fills the finder.",
  },
  {
    id: "CAM 3",
    op: "Marlow",
    role: "Business",
    shot: "right",
    call: "Marlow racks to the teletype. Business desk stays in the wide.",
  },
] as const;

export type CamId = (typeof CAMERAS)[number]["id"];

export const MOVES: readonly { cam: CamId; line: string }[] = [
  { cam: "CAM 1", line: "Ellis pans off the ribbon mic and holds the anchor's eyes." },
  { cam: "CAM 2", line: "Inez creeps the pedestal in. The cabinet fills her finder." },
  { cam: "CAM 3", line: "Marlow racks toward the teletype. The clerks stay in the wide." },
  { cam: "CAM 1", line: "Ellis marks. Tally hot. Nobody crosses the lens." },
  { cam: "CAM 2", line: "Inez waits on the merge. She will not reframe until the boxes lock." },
  { cam: "CAM 3", line: "Marlow holds Desk 14. Protocol fourteen — the numbers wait." },
  { cam: "CAM 2", line: "Inez eases back to a house wide. News desk and business floor in one frame." },
  { cam: "CAM 1", line: "Ellis takes a breath on the copy. Cam 1 is the only live tally." },
];

export const CAMERA_WASH = [
  "P-02  CAM 2 STAND BY ON THE BOX",
  "P-06  TALLY IS LAW",
  "P-08  ELLIS MARK THE ANCHOR",
  "P-09  INEZ FRAME THE CABINET",
  "P-10  MARLOW STAY WIDE ON THE CLERKS",
  "P-13  IDENT ONLY ON CUE",
  "P-18  DO NOT WALK THE CABLE",
  "P-19  ANCHOR EYES TO CAM 1",
  "P-01  QUIET ON THE FLOOR",
  "P-20  FLOOR MANAGER HAS THE BOOK",
] as const;

export const BUSINESS_WASH = [
  "P-04  BUSINESS DESK HOLD THE CLOSE",
  "P-05  TELETYPE CLEAR — DO NOT RIP",
  "P-07  NO CROSS-TALK ON THE WIRE",
  "P-11  PROTOCOL BINDER TO THE RAIL",
  "P-14  NUMBERS WAIT FOR THE DROP",
  "P-16  MERGER DESK CONFIRM PHASE",
  "P-17  FOUR CABINETS ONE GROOVE",
  "P-21  BAKELITE DESK SEND THE WIRE",
  "P-22  LOWBOY OPEN AFTER THE CLOSE",
  "P-24  SIGN THE LOG THEN BREATHE",
] as const;

export const BOOK = [
  "P-01  Quiet on the floor",
  "P-03  Cue talent — ribbon mic",
  "P-06  Tally is law",
  "P-12  House lights to tungsten",
  "P-14  Numbers wait for the drop",
  "P-15  Crackle is picture — leave it",
  "P-17  Four cabinets, one groove",
  "P-18  Do not walk the cable",
  "P-23  Cathedral fifths under",
  "P-24  Sign the log, then breathe",
] as const;

export const WIRE = [
  "JUNCTION FREIGHT  ·  HOLDING",
  "RIVER GAUGE  ·  DOWN ONE FOOT",
  "THE CLOSE  ·  FIRM",
  "DESK 14  ·  PROTOCOL BOUND",
  "NIGHT BOARD  ·  IN SESSION",
  "WHEAT WIRE  ·  UNCHANGED",
  "LAMP OIL  ·  STEADY",
  "CAM CABLE  ·  CLEAR",
  "MERGER DOCKET  ·  OPEN",
  "TALLY  ·  LAW OF THE FLOOR",
] as const;

export const GHOSTS = [
  "STAND BY",
  "CUE TALENT",
  "PROTOCOL",
  "QUIET",
  "ON THE WIRE",
  "MARK",
] as const;

export interface BoxState {
  powered: boolean;
  freq: number;
  volume: number;
  merged: boolean;
  cue: number;
}

export const INITIAL_BOX: BoxState = {
  powered: false,
  freq: 1400,
  volume: 0.78,
  merged: false,
  cue: 0,
};

export function clampFreq(freq: number): number {
  return Math.min(BAND_MAX, Math.max(BAND_MIN, freq));
}

export function scriptFor(box: BoxState): { desk: string; line: string; title: string; call: string } {
  if (!box.powered) {
    return {
      desk: "Rehearsal",
      title: "Copy on the spike",
      call: "HOUSE",
      line: "The floor is dark. Four old cabinets wait in one box. Power them, then merge the days into a groove.",
    };
  }
  if (box.merged) {
    const book = SCRIPTS.merge;
    return {
      desk: book.desk,
      title: "Groove lock",
      call: "WGRV",
      line: book.lines[box.cue % book.lines.length] ?? book.lines[0],
    };
  }
  const { radio, dist } = nearestRadio(box.freq);
  if (dist > LOCK_KHZ) {
    return {
      desk: "Seeking",
      title: "Between cabinets",
      call: "——",
      line: "Static in the dial. Drift toward a cabinet — 640 parlor, 860 news, 1120 business, 1400 the lowboy — or merge them all.",
    };
  }
  const book = SCRIPTS[radio.id];
  return {
    desk: book.desk,
    title: radio.title,
    call: radio.call,
    line: book.lines[box.cue % book.lines.length] ?? book.lines[0],
  };
}
