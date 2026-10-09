/* ============================================================
   Agent Activity Report - data model
   Structured around the Inbound Voice Agent Capabilities & QA
   spec: capability taxonomy (section 1), QA scenarios (section 2),
   and the speech / process rules (section 2.10).
   ============================================================ */

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(77);

function fmtNum(n) {
  return Math.round(n).toLocaleString("en-US");
}

function pctStr(n, d, digits) {
  return d ? `${((n / d) * 100).toFixed(digits === undefined ? 1 : digits)}%` : "0%";
}

function fmtDateTime(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  let h = d.getHours();
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()} ${h}:${min} ${ampm}`;
}

function fmtDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function anArticle(word) {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/* ------------------------------------------------------------
   Capability taxonomy - mirrors spec section 1
   ------------------------------------------------------------ */
const CAPABILITIES = [
  { id: "book", group: "Appointments", label: "Book new visit", ref: "1.3" },
  { id: "availability", group: "Appointments", label: "Check availability", ref: "1.3" },
  { id: "list", group: "Appointments", label: "List appointments", ref: "1.3" },
  { id: "reschedule", group: "Appointments", label: "Reschedule visit", ref: "1.3" },
  { id: "cancel", group: "Appointments", label: "Cancel visit", ref: "1.3" },
  { id: "balance", group: "Billing", label: "Balance lookup", ref: "1.4" },
  { id: "howtopay", group: "Billing", label: "How to pay", ref: "1.4" },
  { id: "hours", group: "Practice Info", label: "Office hours", ref: "1.5" },
  { id: "address", group: "Practice Info", label: "Locations and addresses", ref: "1.5" },
  { id: "phonefax", group: "Practice Info", label: "Phone and fax", ref: "1.5" },
  { id: "providers", group: "Practice Info", label: "Provider names", ref: "1.5" },
  { id: "services", group: "Practice Info", label: "Services offered", ref: "1.5" },
  { id: "transfer", group: "Only Staff Transfer", label: "Caller refused the agent", ref: "1.7" },
  { id: "outofscope", group: "Out of Scope", label: "Out-of-scope request", ref: "1.9" },
];
const CAP_BY_ID = Object.fromEntries(CAPABILITIES.map((c) => [c.id, c]));
const CAP_GROUPS = ["Appointments", "Billing", "Practice Info", "Only Staff Transfer", "Out of Scope"];

/* Spec identity rule: name + DOB required for appointments and billing only. */
const IDENTITY_GROUPS = ["Appointments", "Billing"];

const OUTCOME_LABELS = {
  Completed: "Completed by Agent",
  Transferred: "Transferred to Staff",
  Abandoned: "Caller Abandoned",
  Afterhours: "Afterhours Transfer",
  /* The internal key stays "Crashed" so the outcome plumbing is
     untouched; only the spoken-about label changes. */
  Crashed: "Agent Hung Up",
};

/* Call quality indicators, grouped by severity. Critical issues need
   a human to review the call; warnings signal a degraded experience;
   info items are context for coaching and routing. */
const QUALITY_INDICATORS = [
  { id: "noanswer", sev: "critical", label: "Practice No Answer" },
  { id: "unhelpful", sev: "critical", label: "Staff Unhelpful" },
  { id: "rude", sev: "critical", label: "Staff Rude" },
  { id: "profanity", sev: "critical", label: "Profanity Used" },

  { id: "frustrated", sev: "warning", label: "Patient Frustrated" },
  { id: "onhold", sev: "warning", label: "On Hold (3-10m)" },
  { id: "hungup", sev: "warning", label: "Patient Hung Up" },
  { id: "multitransfer", sev: "warning", label: "Multiple Transfers" },
  { id: "angry", sev: "warning", label: "Patient Angry" },

  { id: "confused", sev: "info", label: "Patient Confused" },
  { id: "language", sev: "info", label: "Language Barrier" },
  { id: "escalation", sev: "info", label: "Escalation Required" },
];
const QI_BY_ID = Object.fromEntries(QUALITY_INDICATORS.map((q) => [q.id, q]));
const SEVERITIES = [
  { id: "critical", label: "Critical" },
  { id: "warning", label: "Warning" },
  { id: "info", label: "Info" },
];
/* Rough per-call incidence used to generate the sample data. */
const QI_RATE = {
  noanswer: 0.073, unhelpful: 0.059, rude: 0.039, profanity: 0.022,
  frustrated: 0.132, onhold: 0.123, hungup: 0.104, multitransfer: 0.087, angry: 0.045,
  confused: 0.075, language: 0.067, escalation: 0.051,
};

/* The voice agent's own name, as it introduces itself on a call.
   Declared once so renaming it is a single edit. */
const AGENT_NAME = "Bella";
const PRACTICE_NAME = "Dermatology of Boca";

const FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Cameron", "Jamie", "Drew", "Skyler", "Reese", "Quinn", "Avery", "Harper"];
const LAST_INITIALS = ["B.", "R.", "M.", "T.", "K.", "S.", "L.", "P.", "W.", "G."];
const PROVIDERS = ["Johnston", "Alvarez", "Mehta", "Caldwell", "Rosen"];
const LOCATIONS = ["Boca Raton", "Colchester", "Delray Beach"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const REASONS = ["acne", "mole check", "rash", "eczema follow up", "annual skin exam", "cosmetic consult"];

const INTENT_PHRASES = {
  book: "I need to book an appointment.",
  availability: "What is the soonest you have?",
  list: "What appointments do I have?",
  reschedule: "I need to move my Tuesday appointment.",
  cancel: "Cancel my appointment.",
  balance: "What is my balance?",
  howtopay: "How do I pay?",
  hours: "What are your hours?",
  address: "Where are you located?",
  phonefax: "What is your fax number?",
  providers: "Who are the doctors at that office?",
  services: "Do you do cosmetic dermatology?",
  transfer: "I do not want to talk to a robot. Put me through to a person.",
  outofscope: "I need a refill on my prescription.",
};

/* Summaries must match the real outcome. Spec 1.9 and 4.17: the agent
   never claims an action completed unless it actually succeeded. */
const CAP_SUMMARY = {
  book: (c) =>
    c.outcome === "Completed"
      ? `Booked ${anArticle(c.reason)} ${c.reason} visit with Doctor ${c.provider} at ${c.location}.`
      : `Collected booking details for ${anArticle(c.reason)} ${c.reason} visit at ${c.location}. No appointment was created.`,
  availability: (c) => `Read back open slots with Doctor ${c.provider} at ${c.location}.`,
  list: () => "Read back the caller's upcoming appointments in natural speech.",
  reschedule: (c) =>
    c.outcome === "Completed"
      ? `Moved an existing visit to a new slot with Doctor ${c.provider}.`
      : "Identified the visit to move, but it was not rescheduled.",
  cancel: (c) =>
    c.outcome === "Completed"
      ? "Cancelled an upcoming visit after an explicit confirmation."
      : "Identified the visit to cancel, but no cancellation was made.",
  balance: (c) =>
    c.outcome === "Completed"
      ? `Gave the account balance total of $${c.balance}.`
      : "Could not retrieve the balance, so a staff transfer was offered.",
  howtopay: () => "Offered to text payment instructions instead of reading the link aloud.",
  hours: () => "Gave office hours without asking for identity.",
  address: (c) => `Gave the ${c.location} office address.`,
  phonefax: () => "Gave the office fax number without asking for identity.",
  providers: (c) => `Listed the providers at ${c.location}.`,
  services: () => "Confirmed the practice offers medical and cosmetic dermatology.",
  transfer: (c) =>
    c.outcome === "Transferred"
      ? "Caller refused to work with the agent, so the call was handed to staff."
      : "Caller asked for a person. No transfer was completed.",
  outofscope: (c) =>
    c.outcome === "Transferred"
      ? "Request was out of scope, so the agent transferred the caller to staff."
      : "Request was out of scope. A transfer was offered but not accepted.",
};

/* ------------------------------------------------------------
   Transcript construction with the spec identity flow
   ------------------------------------------------------------ */
function spellOut(name) {
  return name.replace(".", "").split("").join("-").toUpperCase();
}

function buildTranscript(r) {
  const t = [];
  const cap = CAP_BY_ID[r.capability];
  const hr = r.datetime.getHours();
  const greet = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";

  t.push({ s: "Agent", text: `If this is a medical emergency, please hang up and dial 911. ${greet}, this is ${AGENT_NAME}, the automated assistant at ${PRACTICE_NAME}. How can I help you today?` });
  t.push({ s: "Caller", text: INTENT_PHRASES[r.capability] });

  if (r.identityRequired) {
    t.push({ s: "Agent", text: "I can help with that. Can I start with your first name?" });
    t.push({ s: "Caller", text: r.patientFirst });
    t.push({ s: "Agent", text: `Thank you. I have ${spellOut(r.patientFirst)}. Is that right?` });
    t.push({ s: "Caller", text: "Yes." });
    t.push({ s: "Agent", text: "And your last name?" });
    t.push({ s: "Caller", text: r.patientLast });
    t.push({ s: "Agent", text: `That is ${spellOut(r.patientLast)}. Is that correct?` });
    t.push({ s: "Caller", text: "That is correct." });
    t.push({ s: "Agent", text: "And your date of birth?" });
    t.push({ s: "Caller", text: r.dobSpoken });
    t.push({ s: "Agent", text: `I have ${r.dobSpoken}. Is that right?` });
    t.push({ s: "Caller", text: "Yes." });
    if (r.newPatient) {
      t.push({ s: "Agent", text: "I am not finding a record under that name. Have you visited us before?" });
      t.push({ s: "Caller", text: "No, I have not." });
      t.push({ s: "Agent", text: "Since this would be your first visit, I can get you scheduled." });
    }
  }

  if (r.capability === "book" || r.capability === "availability") {
    t.push({ s: "Agent", text: `Which office works better for you, ${LOCATIONS[0]} or ${LOCATIONS[1]}?` });
    t.push({ s: "Caller", text: r.location });
    t.push({ s: "Agent", text: "What would you like to be seen for?" });
    t.push({ s: "Caller", text: r.reason });
    t.push({ s: "Agent", text: `Doctor ${r.provider} has Tuesday at 9:40 AM or 2:15 PM. Which of those works?` });
    t.push({ s: "Caller", text: "Tuesday at 2:15." });
    if (r.capability === "book") {
      t.push({ s: "Agent", text: `Just to confirm, ${anArticle(r.reason)} ${r.reason} visit with Doctor ${r.provider} at ${r.location} on Tuesday at 2:15 PM. Should I book that?` });
      if (r.outcome === "Completed") {
        t.push({ s: "Caller", text: "Yes, please." });
        t.push({ s: "Agent", text: "That is booked. Would you like me to text you the details?" });
        t.push({ s: "Caller", text: r.smsSent ? "Yes, thank you." : "No, that is alright." });
      } else {
        t.push({ s: "Caller", text: "Actually, hold on a second." });
      }
    }
  } else if (r.capability === "list") {
    t.push({ s: "Agent", text: `You have a visit with Doctor ${r.provider} at ${r.location} on Tuesday at 2:15 PM, and one the following month. Would you like the rest?` });
    t.push({ s: "Caller", text: "That is fine for now." });
  } else if (r.capability === "reschedule" || r.capability === "cancel") {
    t.push({ s: "Agent", text: `You have a visit with Doctor ${r.provider} at ${r.location} on Tuesday at 2:15 PM. Is that the one?` });
    t.push({ s: "Caller", text: "Yes, that one." });
    if (r.outcome === "Completed") {
      t.push({ s: "Agent", text: r.capability === "cancel" ? "Just to confirm, you want to cancel that visit. Is that right?" : `Doctor ${r.provider} has Thursday at 11:00 AM. Should I move it there?` });
      t.push({ s: "Caller", text: "Yes, please." });
      t.push({ s: "Agent", text: r.capability === "cancel" ? "That visit is cancelled. Would you like a text confirmation?" : "That is rescheduled. Would you like a text confirmation?" });
      t.push({ s: "Caller", text: r.smsSent ? "Yes, please." : "No, thank you." });
    } else {
      t.push({ s: "Caller", text: "Wait, let me check my calendar first." });
    }
  } else if (r.capability === "balance") {
    if (r.outcome === "Completed") {
      t.push({ s: "Agent", text: `Your current balance is $${r.balance}.` });
      t.push({ s: "Caller", text: "Thanks." });
    } else {
      t.push({ s: "Agent", text: "I am not able to pull that up right now. Would you like me to connect you with a staff member?" });
      t.push({ s: "Caller", text: r.outcome === "Transferred" ? "Yes, please." : "No, I will try later." });
    }
  } else if (r.capability === "howtopay") {
    t.push({ s: "Agent", text: "I can text you payment instructions. Would you like me to send those?" });
    t.push({ s: "Caller", text: r.smsSent ? "Yes, please." : "No thanks." });
  } else if (cap.group === "Practice Info") {
    const info = {
      hours: "We are open Monday through Friday, 8 AM to 5 PM, and Saturday 9 AM to noon.",
      address: `Our ${r.location} office is at 2300 Glades Road, Suite 400.`,
      phonefax: "Our fax number is 561-555-0199.",
      providers: `At ${r.location} we have Doctor ${PROVIDERS[0]}, Doctor ${PROVIDERS[1]}, and Doctor ${PROVIDERS[2]}.`,
      services: "We offer both medical and cosmetic dermatology.",
    };
    t.push({ s: "Agent", text: info[r.capability] });
    if (r.smsOffered) {
      t.push({ s: "Agent", text: "Would you like me to text that to you?" });
      t.push({ s: "Caller", text: r.smsSent ? "Yes, please." : "No, I have it." });
    }
  } else if (r.capability === "outofscope") {
    t.push({ s: "Agent", text: "That is something our staff handles directly. Would you like me to connect you?" });
    t.push({ s: "Caller", text: r.outcome === "Transferred" ? "Yes, please." : "Maybe later." });
  } else if (r.capability === "transfer") {
    t.push({ s: "Agent", text: "I can connect you with a staff member. Would you like me to do that?" });
    t.push({ s: "Caller", text: r.outcome === "Transferred" ? "Yes, a real person please." : "Never mind." });
  }

  if (r.outcome === "Completed") {
    t.push({ s: "Agent", text: "Is there anything else I can help with?" });
    t.push({ s: "Caller", text: "No, that is all. Goodbye." });
    t.push({ s: "Agent", text: "Have a great day!" });
  } else if (r.outcome === "Transferred") {
    t.push({ s: "System", text: "Call connected to front desk staff." });
  } else if (r.outcome === "Abandoned") {
    t.push({ s: "System", text: "Caller disconnected before the request completed." });
  } else if (r.outcome === "Afterhours") {
    t.push({ s: "System", text: "Office closed. Call transferred to the afterhours line." });
  } else if (r.outcome === "Crashed") {
    t.push({ s: "System", text: "Agent ended the call unexpectedly before the request finished." });
  }
  return t;
}

/* ------------------------------------------------------------
   Interaction generation
   ------------------------------------------------------------ */
const CAP_WEIGHTS = [
  ["book", 0.2], ["availability", 0.09], ["list", 0.08], ["reschedule", 0.11], ["cancel", 0.09],
  ["balance", 0.09], ["howtopay", 0.04],
  ["hours", 0.08], ["address", 0.05], ["phonefax", 0.03], ["providers", 0.03], ["services", 0.02],
  ["transfer", 0.05], ["outofscope", 0.04],
];

function pickCapability() {
  const roll = rand();
  let acc = 0;
  for (const [id, w] of CAP_WEIGHTS) {
    acc += w;
    if (roll < acc) return id;
  }
  return "book";
}

function buildInteractions(count) {
  const rows = [];
  const now = new Date(2026, 9, 5, 17, 0);

  /* Hour-of-day weights across the full clock: a morning rush, a lunch
     dip, an afternoon peak, an evening tail, and thin overnight
     traffic. Spread evenly instead, the heatmap would read as noise
     and the afterhours bucket would swamp the real outcomes. */
  const HOUR_WEIGHTS = [
    0.004, 0.003, 0.002, 0.002, 0.003, 0.008, 0.022, 0.045,
    0.082, 0.112, 0.124, 0.105, 0.062, 0.085, 0.108, 0.098,
    0.068, 0.034, 0.018, 0.009, 0.004, 0.002, 0.001, 0.001,
  ];
  /* Day-of-week weights, Mon..Sun. Weekends are open but quiet. */
  const DAY_WEIGHTS = [0.185, 0.19, 0.18, 0.17, 0.155, 0.075, 0.045];

  function pickWeighted(weights) {
    const roll = rand();
    let acc = 0;
    for (let i = 0; i < weights.length; i++) {
      acc += weights[i];
      if (roll < acc) return i;
    }
    return weights.length - 1;
  }

  for (let i = 0; i < count; i++) {
    /* Pick a weekday bucket, then land on a real date in the window
       that falls on that weekday. */
    const wantDow = (pickWeighted(DAY_WEIGHTS) + 1) % 7; // back to 0=Sun
    let dt = null;
    for (let attempt = 0; attempt < 40; attempt++) {
      const daysAgo = Math.floor(rand() * 30);
      const cand = new Date(now.getTime() - daysAgo * 24 * 60 * 60000);
      if (cand.getDay() === wantDow) {
        dt = cand;
        break;
      }
    }
    if (!dt) dt = new Date(now.getTime() - Math.floor(rand() * 30) * 24 * 60 * 60000);
    dt.setHours(pickWeighted(HOUR_WEIGHTS), Math.floor(rand() * 60), 0, 0);
    const capability = pickCapability();
    const cap = CAP_BY_ID[capability];
    /* Office hours are Mon-Fri 8am-5pm and Sat 9am-noon. Outside
       those windows the agent still answers, but a staff transfer can
       only reach the afterhours line. */
    const dow = dt.getDay();
    const hr = dt.getHours();
    const officeOpen =
      dow >= 1 && dow <= 5 ? hr >= 8 && hr <= 17 : dow === 6 ? hr >= 9 && hr < 12 : false;
    const afterHours = !officeOpen;

    /* An afterhours transfer is only possible when the office is
       closed, so it is never drawn for an in-hours call. */
    let outcome;
    const roll = rand();
    if (afterHours) {
      outcome = roll < 0.72 ? "Afterhours" : roll < 0.86 ? "Completed" : roll < 0.97 ? "Abandoned" : "Crashed";
    } else if (capability === "outofscope" || capability === "transfer") {
      outcome = roll < 0.76 ? "Transferred" : roll < 0.9 ? "Completed" : roll < 0.98 ? "Abandoned" : "Crashed";
    } else if (roll < 0.8) outcome = "Completed";
    else if (roll < 0.92) outcome = "Transferred";
    else if (roll < 0.98) outcome = "Abandoned";
    else outcome = "Crashed";

    const identityRequired = IDENTITY_GROUPS.includes(cap.group);
    const identityVerified = identityRequired ? outcome !== "Abandoned" || rand() > 0.5 : null;
    const newPatient = identityRequired && identityVerified && rand() < 0.16;

    const first = FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)];
    const last = LAST_INITIALS[Math.floor(rand() * LAST_INITIALS.length)];
    const anonymous = !identityRequired && rand() < 0.45;

    /* Crashed and afterhours calls end early, so they run short. */
    const duration =
      outcome === "Crashed"
        ? 18 + Math.floor(rand() * 70)
        : outcome === "Afterhours"
        ? 25 + Math.floor(rand() * 60)
        : (identityRequired ? 95 : 35) + Math.floor(rand() * (identityRequired ? 230 : 90));

    let sentiment;
    const sRoll = rand();
    if (outcome === "Abandoned" || outcome === "Crashed") sentiment = "Negative";
    else if (outcome === "Completed") sentiment = sRoll < 0.78 ? "Positive" : sRoll < 0.94 ? "Neutral" : "Negative";
    else sentiment = sRoll < 0.42 ? "Positive" : sRoll < 0.8 ? "Neutral" : "Negative";

    /* Quality indicators detected on the call. Independent draws, so a
       call can carry several, and most carry none. */
    const quality = QUALITY_INDICATORS.filter((q) => {
      let p = QI_RATE[q.id];
      if (outcome === "Abandoned" && (q.id === "hungup" || q.id === "frustrated")) p *= 4;
      if (outcome === "Transferred" && (q.id === "multitransfer" || q.id === "escalation")) p *= 2.5;
      if (outcome === "Afterhours" && q.id === "noanswer") p *= 3;
      if (sentiment === "Negative" && (q.sev === "critical" || q.id === "angry")) p *= 2;
      return rand() < p;
    }).map((q) => q.id);

    /* Appointment actions the agent actually completed. These are
       mutually exclusive: one call carries at most one action, since
       each is tied to the single capability the call was about. */
    const booked = capability === "book" && outcome === "Completed";
    const cancelled = capability === "cancel" && outcome === "Completed";
    const rescheduled = capability === "reschedule" && outcome === "Completed";
    const listed = capability === "list" && outcome === "Completed";
    const checkedAvail = capability === "availability" && outcome === "Completed";

    const smsEligible = ["book", "reschedule", "cancel", "list", "howtopay", "hours", "address", "phonefax"].includes(capability);
    const smsOffered = smsEligible && outcome === "Completed";
    const smsSent = smsOffered && rand() < 0.66;

    const dobDate = new Date(1950 + Math.floor(rand() * 55), Math.floor(rand() * 12), 1 + Math.floor(rand() * 28));

    const row = {
      id: `call-${i}`,
      datetime: dt,
      capability,
      group: cap.group,
      outcome,
      duration,
      sentiment,
      identityRequired,
      identityVerified,
      newPatient,
      anonymous,
      patientFirst: first,
      patientLast: last,
      patient: anonymous ? "Not identified" : `${first} ${last}`,
      mrn: anonymous ? "" : `MRN${100000 + Math.floor(rand() * 899999)}`,
      dob: dobDate,
      dobShort: `${String(dobDate.getMonth() + 1).padStart(2, "0")}/${String(dobDate.getDate()).padStart(2, "0")}/${dobDate.getFullYear()}`,
      dobSpoken: `${MONTHS[dobDate.getMonth()]} ${dobDate.getDate()}th, ${dobDate.getFullYear()}`,
      contact: `(561) 555-${String(1000 + Math.floor(rand() * 8999)).slice(1)}`,
      provider: PROVIDERS[Math.floor(rand() * PROVIDERS.length)],
      location: LOCATIONS[Math.floor(rand() * LOCATIONS.length)],
      reason: REASONS[Math.floor(rand() * REASONS.length)],
      balance: (40 + Math.floor(rand() * 900)) + "." + String(Math.floor(rand() * 100)).padStart(2, "0"),
      quality,
      booked,
      cancelled,
      rescheduled,
      listed,
      checkedAvail,
      smsOffered,
      smsSent,
    };
    row.summary = CAP_SUMMARY[capability](row);
    row.transcript = outcome === "Abandoned" && rand() < 0.35 ? [] : buildTranscript(row);
    /* Stamp each line with an offset from the start of the call.
       Turn length scales with how much was said, then the whole set
       is normalised so the last line lands inside the call duration
       rather than drifting past it. */
    if (row.transcript.length) {
      const weights = row.transcript.map((l) => 1.4 + l.text.length / 22);
      const span = weights.reduce((s, w) => s + w, 0);
      /* Leave a beat at the end so the final line is not flush with
         the hang-up moment. */
      const usable = Math.max(1, duration - 2);
      let acc = 0;
      row.transcript.forEach((l, i) => {
        l.t = Math.min(duration, Math.round((acc / span) * usable));
        acc += weights[i];
      });
    }
    /* Flattened transcript text, so keyword search does not rebuild
       the string on every keystroke. */
    row.transcriptText = row.transcript.map((l) => l.text).join(" ").toLowerCase();
    rows.push(row);
  }
  return rows.sort((a, b) => b.datetime - a.datetime);
}

const ALL_ROWS = buildInteractions(412);

/* ------------------------------------------------------------
   Aggregations for the Overview dashboard
   ------------------------------------------------------------ */

/* Peak conversation hours across the full week and full day. The
   agent answers around the clock, so overnight and weekend traffic
   is real volume worth seeing, not noise to crop out. */
const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HEATMAP_HOURS = Array.from({ length: 24 }, (_, h) => h);

/* Compact hour label for a 24-column header. Every third hour is
   marked with its meridiem so the am and pm halves can be told
   apart; the rest are bare numbers to keep the row narrow. */
function hourLabel(h) {
  if (h === 0) return "12a";
  if (h === 12) return "12p";
  const n = h % 12 || 12;
  return h % 3 === 0 ? `${n}${h < 12 ? "a" : "p"}` : String(n);
}

/* Full hour range, used in tooltips where there is room to be clear. */
function hourRange(h) {
  const fmt = (x) => `${x % 12 || 12}${x >= 12 ? "pm" : "am"}`;
  return `${fmt(h)} to ${fmt((h + 1) % 24)}`;
}

function buildHeatmap(rows) {
  const grid = HEATMAP_DAYS.map(() => HEATMAP_HOURS.map(() => 0));
  rows.forEach((r) => {
    /* getDay() is 0 = Sunday, but the grid runs Mon..Sun, so Sunday
       moves to the last row instead of index -1. */
    const di = (r.datetime.getDay() + 6) % 7;
    const hi = r.datetime.getHours();
    grid[di][hi]++;
  });
  return grid;
}

function qualityCounts(rows) {
  const out = {};
  QUALITY_INDICATORS.forEach((q) => {
    out[q.id] = rows.filter((r) => r.quality.includes(q.id)).length;
  });
  return out;
}
