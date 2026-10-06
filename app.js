// Mock data generator for the Outreach Report, seeded so numbers stay stable across reloads.
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);

function buildRows(days) {
  const rows = [];
  const today = new Date(2026, 8, 15); // Sep 15, 2026
  for (let i = 0; i < days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);

    const textAttempts = Math.round(20 + rand() * 140);
    const textDelivered = Math.round(textAttempts * (0.75 + rand() * 0.2));

    const emailAttempts = Math.round(15 + rand() * 140);
    const emailDelivered = Math.round(emailAttempts * (0.75 + rand() * 0.2));
    const emailOpened = Math.round(emailDelivered * (0.55 + rand() * 0.25));
    const emailClicked = Math.round(emailOpened * (0.25 + rand() * 0.25));
    const emailSpam = Math.round(emailDelivered * (rand() * 0.008));

    rows.push({
      date: d,
      textAttempts,
      textDelivered,
      emailAttempts,
      emailDelivered,
      emailOpened,
      emailClicked,
      emailSpam,
    });
  }
  return rows;
}

function fmtDate(d) {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function fmtNum(n) {
  return n.toLocaleString("en-US");
}

const ROWS = buildRows(296);

function renderTable(rows) {
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = rows
    .slice(0, 30)
    .map(
      (r) => `
      <tr>
        <td class="col-date"><span class="row-caret">▸</span>${fmtDate(r.date)}</td>
        <td>${fmtNum(r.textAttempts)}</td>
        <td>${fmtNum(r.textDelivered)}</td>
        <td>${fmtNum(r.emailAttempts)}</td>
        <td>${fmtNum(r.emailDelivered)}</td>
        <td>${fmtNum(r.emailOpened)}</td>
        <td>${fmtNum(r.emailClicked)}</td>
        <td class="${r.emailSpam > 0 ? "metric-flag" : ""}">${fmtNum(r.emailSpam)}</td>
      </tr>`
    )
    .join("");
}

function renderTotals(rows) {
  const totals = rows.reduce(
    (acc, r) => {
      acc.textAttempts += r.textAttempts;
      acc.textDelivered += r.textDelivered;
      acc.emailAttempts += r.emailAttempts;
      acc.emailDelivered += r.emailDelivered;
      acc.emailOpened += r.emailOpened;
      acc.emailClicked += r.emailClicked;
      acc.emailSpam += r.emailSpam;
      return acc;
    },
    {
      textAttempts: 0,
      textDelivered: 0,
      emailAttempts: 0,
      emailDelivered: 0,
      emailOpened: 0,
      emailClicked: 0,
      emailSpam: 0,
    }
  );

  document.getElementById("m-text-attempts").textContent = fmtNum(totals.textAttempts);
  document.getElementById("m-text-delivered").textContent = fmtNum(totals.textDelivered);
  document.getElementById("m-email-attempts").textContent = fmtNum(totals.emailAttempts);
  document.getElementById("m-email-delivered").textContent = fmtNum(totals.emailDelivered);
  document.getElementById("m-email-opened").textContent = fmtNum(totals.emailOpened);
  document.getElementById("m-email-clicked").textContent = fmtNum(totals.emailClicked);
  document.getElementById("m-email-spam").textContent = fmtNum(totals.emailSpam);
}

renderTable(ROWS);
renderTotals(ROWS);

document.getElementById("expand-all").addEventListener("click", (e) => {
  e.preventDefault();
});
