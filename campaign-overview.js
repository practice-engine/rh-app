function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fmtNum(n) {
  return Math.round(n).toLocaleString("en-US");
}
function fmtMoney(n) {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function buildCampaign(seedVal, config) {
  const rand = mulberry32(seedVal);
  const contacted = Math.round(9000 + rand() * 6000);
  const contactedOk = Math.round(contacted * (0.7 + rand() * 0.15));
  const contactedFail = contacted - contactedOk;

  const created = Math.round(contactedOk * (0.22 + rand() * 0.14));
  const completed = Math.round(created * (0.65 + rand() * 0.2));
  const conversion = contactedOk ? (completed / contactedOk) * 100 : 0;

  const revenue = Math.round(completed * (250 + rand() * 60));
  const billed = Math.round(revenue * (1.4 + rand() * 0.2));
  const collected = Math.round(revenue * (0.6 + rand() * 0.15));

  const smsSent = Math.round(contacted * 2.1 + rand() * 500);
  const smsDeliveredPct = 0.82 + rand() * 0.1;
  const smsDelivered = Math.round(smsSent * smsDeliveredPct);
  const smsOptOuts = Math.round(smsSent * (0.03 + rand() * 0.03));

  const emailSent = Math.round(contacted * 1.3 + rand() * 400);
  const emailDeliveredPct = 0.8 + rand() * 0.12;
  const emailDelivered = Math.round(emailSent * emailDeliveredPct);
  const emailOptOuts = Math.round(emailSent * (0.01 + rand() * 0.015));
  const emailOpened = Math.round(emailDelivered * (0.55 + rand() * 0.25));
  const emailClicked = Math.round(emailOpened * (0.25 + rand() * 0.25));
  const emailSpam = Math.round(emailDelivered * (rand() * 0.008));

  const attempts = [];
  let remainingContacts = contacted;
  let remainingCreated = created;
  let remainingCompleted = completed;
  for (let i = 1; i <= 7; i++) {
    const share = i === 1 ? 0.62 : Math.pow(0.4, i - 1);
    const contacts = i === 7 ? Math.max(remainingContacts, 0) : Math.round(contacted * share * (0.85 + rand() * 0.3));
    const email = Math.round(contacts * (0.34 + rand() * 0.06));
    const text = Math.round(contacts * (0.62 + rand() * 0.08));
    const createdN = i === 7 ? Math.max(remainingCreated, 0) : Math.round(created * share * (0.85 + rand() * 0.3));
    const completedN = Math.min(createdN, Math.round(createdN * (0.6 + rand() * 0.25)));
    remainingContacts -= contacts;
    remainingCreated -= createdN;
    remainingCompleted -= completedN;
    attempts.push({ attempt: i, contacts, email, text, created: createdN, completed: completedN });
    if (contacts <= 5 && i > 3) break;
  }

  return {
    id: config.id,
    name: config.name,
    status: config.status,
    type: config.type,
    practice: config.practice,
    activated: config.activated,
    eligible: config.eligible,
    locations: config.locations,
    providers: config.providers,
    phone: config.phone,
    target: config.target,
    condition: config.condition,
    diagnosis: config.diagnosis,
    contacted,
    contactedOk,
    contactedFail,
    created,
    completed,
    conversion,
    revenue,
    billed,
    collected,
    smsSent,
    smsDeliveredPct,
    smsDelivered,
    smsOptOuts,
    emailSent,
    emailDeliveredPct,
    emailDelivered,
    emailOptOuts,
    emailOpened,
    emailClicked,
    emailSpam,
    attempts,
  };
}

const CAMPAIGNS = [
  buildCampaign(101, {
    id: "derm-boca-go-live",
    name: "DERM OF BOCA GO LIVE",
    status: "Active",
    type: "Clinical → Diagnosis Based",
    practice: "Dermatology of Boca",
    activated: "06/23/2025",
    eligible: "7,374",
    locations: { total: 1, active: 1, inactive: 0 },
    providers: { total: 2, active: 2, inactive: 0 },
    phone: "(561) 362-8000",
    target: "Appointments in Jan 1, 2019 to 14 month.",
    condition: "No future appointment scheduled.",
    diagnosis: "N/A",
  }),
  buildCampaign(202, {
    id: "miami-beach-skin-exam",
    name: "MIAMI BEACH ANNUAL SKIN EXAM",
    status: "Active",
    type: "Wellness → Recall Based",
    practice: "Miami Beach Dermatology",
    activated: "02/10/2025",
    eligible: "5,120",
    locations: { total: 2, active: 2, inactive: 0 },
    providers: { total: 4, active: 3, inactive: 1 },
    phone: "(305) 674-1200",
    target: "Appointments in Jan 1, 2018 to 18 month.",
    condition: "No future appointment scheduled.",
    diagnosis: "Full Body Skin Exam",
  }),
  buildCampaign(303, {
    id: "boca-regional-mohs",
    name: "BOCA REGIONAL MOHS FOLLOW-UP",
    status: "Paused",
    type: "Clinical → Diagnosis Based",
    practice: "Boca Raton Regional Hospital",
    activated: "11/02/2024",
    eligible: "1,842",
    locations: { total: 1, active: 0, inactive: 1 },
    providers: { total: 3, active: 2, inactive: 1 },
    phone: "(561) 955-4400",
    target: "Appointments in Jun 1, 2020 to 6 month.",
    condition: "No future appointment scheduled.",
    diagnosis: "Mohs Surgery",
  }),
];

function renderChart(attempts) {
  const svg = document.getElementById("attempt-chart");
  const width = 640;
  const height = 320;
  const padding = { top: 10, right: 10, bottom: 30, left: 46 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxVal = Math.max(...attempts.map((a) => a.created + a.completed), 100);
  const niceMax = Math.ceil(maxVal / 500) * 500 || 500;

  const barSlot = chartW / attempts.length;
  const barWidth = barSlot * 0.4;

  let gridLines = "";
  let axisLabels = "";
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const v = (niceMax / steps) * i;
    const y = padding.top + chartH - (v / niceMax) * chartH;
    gridLines += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#eee" stroke-width="1" />`;
    axisLabels += `<text x="${padding.left - 8}" y="${y + 4}" font-size="11" fill="#6b7280" text-anchor="end">${fmtNum(v)}</text>`;
  }

  let bars = "";
  attempts.forEach((a, i) => {
    const x = padding.left + i * barSlot + (barSlot - barWidth) / 2;
    const createdH = (a.created / niceMax) * chartH;
    const completedH = (a.completed / niceMax) * chartH;
    const yCreated = padding.top + chartH - createdH;
    const yCompleted = yCreated - completedH;
    bars += `<rect x="${x}" y="${yCreated}" width="${barWidth}" height="${createdH}" fill="#f5871f" />`;
    bars += `<rect x="${x}" y="${yCompleted}" width="${barWidth}" height="${completedH}" fill="#7a1f1f" />`;
    axisLabels += `<text x="${x + barWidth / 2}" y="${height - 8}" font-size="11" fill="#6b7280" text-anchor="middle">Attempt ${a.attempt}</text>`;
  });

  svg.innerHTML = gridLines + bars + axisLabels;
}

function renderAttemptTable(attempts) {
  const tbody = document.getElementById("attempt-table-body");
  tbody.innerHTML = attempts
    .map(
      (a) => `
      <tr>
        <td><span class="attempt-num"><span class="attempt-dot"></span>#${a.attempt}</span></td>
        <td>${fmtNum(a.contacts)}</td>
        <td>${fmtNum(a.email)}</td>
        <td>${fmtNum(a.text)}</td>
        <td class="attempt-created">${fmtNum(a.created)}</td>
        <td>${fmtNum(a.completed)}</td>
      </tr>`
    )
    .join("");
}

function renderCampaign(c) {
  document.getElementById("c-name").textContent = c.name;
  const statusEl = document.getElementById("c-status");
  statusEl.textContent = c.status;
  statusEl.className = "badge " + (c.status === "Active" ? "badge-active" : "badge-type");
  document.getElementById("c-type").textContent = c.type;
  document.getElementById("c-practice").textContent = c.practice;
  document.getElementById("c-activated").textContent = c.activated;
  document.getElementById("c-eligible").textContent = c.eligible;

  document.getElementById("s-contacted").textContent = fmtNum(c.contacted);
  document.getElementById("s-contacted-ok").textContent = fmtNum(c.contactedOk);
  document.getElementById("s-contacted-fail").textContent = fmtNum(c.contactedFail);
  document.getElementById("s-contacted-bar").style.width = `${(c.contactedOk / c.contacted) * 100}%`;

  document.getElementById("s-created").textContent = fmtNum(c.created);
  const createdRate = (c.created / c.contactedOk) * 100;
  document.getElementById("s-created-rate").textContent = `${createdRate.toFixed(1)}%`;
  document.getElementById("s-created-bar").style.width = `${createdRate}%`;

  document.getElementById("s-completed").textContent = fmtNum(c.completed);
  const completedRate = (c.completed / c.created) * 100;
  document.getElementById("s-completed-rate").textContent = `${completedRate.toFixed(1)}%`;
  document.getElementById("s-completed-bar").style.width = `${completedRate}%`;

  document.getElementById("s-conversion").textContent = `${c.conversion.toFixed(1)}%`;
  document.getElementById("s-conversion-bar").style.width = `${c.conversion}%`;

  document.getElementById("f-revenue").textContent = fmtMoney(c.revenue);
  document.getElementById("f-billed").textContent = fmtMoney(c.billed);
  document.getElementById("f-collected").textContent = fmtMoney(c.collected);

  document.getElementById("ch-sms-sent").textContent = fmtNum(c.smsSent);
  document.getElementById("ch-sms-optout").textContent = fmtNum(c.smsOptOuts);
  document.getElementById("ch-sms-bar").style.width = `${c.smsDeliveredPct * 100}%`;

  document.getElementById("ch-email-sent").textContent = fmtNum(c.emailSent);
  document.getElementById("ch-email-optout").textContent = fmtNum(c.emailOptOuts);
  document.getElementById("ch-email-bar").style.width = `${c.emailDeliveredPct * 100}%`;

  document.getElementById("ch-email-opened").textContent = fmtNum(c.emailOpened);
  document.getElementById("ch-email-clicked").textContent = fmtNum(c.emailClicked);
  document.getElementById("ch-email-spam").textContent = fmtNum(c.emailSpam);

  renderChart(c.attempts);
  renderAttemptTable(c.attempts);
  renderContactLog(c);

  document.getElementById("i-locations").textContent = c.locations.total;
  document.getElementById("i-locations-active").textContent = `${c.locations.active} Active`;
  document.getElementById("i-locations-inactive").textContent = `${c.locations.inactive} Inactive`;
  document.getElementById("i-providers").textContent = c.providers.total;
  document.getElementById("i-providers-active").textContent = `${c.providers.active} Active`;
  document.getElementById("i-providers-inactive").textContent = `${c.providers.inactive} Inactive`;
  document.getElementById("i-phone").textContent = c.phone;

  document.getElementById("l-target").textContent = c.target;
  document.getElementById("l-condition").textContent = c.condition;
  document.getElementById("l-diagnosis").textContent = c.diagnosis;
}

function fmtDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

const FIRST_NAMES = ["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Cameron", "Jamie", "Drew", "Skyler"];
const LAST_INITIALS = ["B.", "R.", "M.", "T.", "K.", "S.", "L.", "P.", "W.", "G."];

function statusForMethod(rand, method) {
  const failed = rand() < 0.12;
  if (failed) {
    return { label: "Delivery Failed", cls: "status-failed" };
  }
  if (method === "Email") {
    const roll = rand();
    if (roll < 0.06) return { label: "Reported Spam", cls: "status-spam" };
    if (roll < 0.4) return { label: "Clicked", cls: "status-clicked" };
    if (roll < 0.75) return { label: "Opened", cls: "status-opened" };
    return { label: "Delivered Successfully", cls: "status-success" };
  }
  return { label: "Delivered Successfully", cls: "status-success" };
}

function renderContactLog(c) {
  const rand = mulberry32(c.name.length * 7 + 13);
  const rows = [];
  const today = new Date(2026, 8, 15);
  const rowCount = 60;
  for (let i = 0; i < rowCount; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - Math.floor(i / 6));
    const method = rand() < 0.6 ? "Text" : "Email";
    const attempt = 1 + Math.floor(rand() * 6);
    const age = 20 + Math.floor(rand() * 70);
    const status = statusForMethod(rand, method);
    const name = `${FIRST_NAMES[Math.floor(rand() * FIRST_NAMES.length)]} ${LAST_INITIALS[Math.floor(rand() * LAST_INITIALS.length)]}`;
    const mrn = `MRN-${100000 + Math.floor(rand() * 899999)}`;
    const failureReason = status.label === "Delivery Failed" ? (method === "Email" ? "Invalid email address" : "Invalid phone number") : "";
    rows.push({ date: d, name, mrn, age, method, attempt, status, failureReason });
  }

  const tbody = document.getElementById("contact-log-body");
  tbody.innerHTML = rows
    .map(
      (r) => `
      <tr>
        <td>${fmtDate(r.date)}</td>
        <td>${r.name}</td>
        <td>${r.mrn}</td>
        <td>${r.age}</td>
        <td>${r.method}</td>
        <td>${r.attempt}</td>
        <td><span class="status-pill ${r.status.cls}">${r.status.label}</span></td>
        <td>${r.failureReason}</td>
      </tr>`
    )
    .join("");
}

function initTabs() {
  const tabs = document.querySelectorAll(".tabs > .tab[data-tab]");
  tabs.forEach((tab) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      document.querySelectorAll(".tab-panel").forEach((panel) => panel.classList.add("hidden"));
      document.getElementById(`tab-${tab.dataset.tab}`).classList.remove("hidden");
    });
  });
}

function init() {
  renderCampaign(CAMPAIGNS[0]);
  initTabs();
}

init();
