/* ============================================================
   Outbound Agent Report - rendering and interaction
   Depends on agent-activity-data.js
   ============================================================ */

/* Series colors follow the entity, never its rank, so filtering and
   re-sorting never repaint the survivors. */
const SERIES = {
  Appointments: "var(--s-appointments)",
  Billing: "var(--s-billing)",
  "Practice Info": "var(--s-practice)",
  "Only Staff Transfer": "var(--s-transfer)",
  "Out of Scope": "var(--s-oos)",
};

/* The hue sequence the palette was validated against on the adjacent
   pairlist. Charts render in this order so neighbors stay separable
   under protan, deutan, and tritan vision. */
const VIZ_ORDER = [
  "Appointments",
  "Practice Info",
  "Out of Scope",
  "Billing",
  "Only Staff Transfer",
];

/* Completed, transferred, and abandoned carry status meaning, so they
   use the reserved status tokens. Afterhours and crashed are states
   rather than good/bad verdicts, so they take chart tokens. */
const OUTCOME_COLOR = {
  Completed: "var(--st-good)",
  Transferred: "var(--st-warn)",
  Abandoned: "var(--st-crit)",
  Afterhours: "var(--chart-2)",
  Crashed: "var(--chart-3)",
};

const OUTCOME_ORDER = ["Completed", "Transferred", "Abandoned", "Afterhours", "Crashed"];

let activeTab = "overview";
let sortKey = "datetime";
let sortDir = "desc";
let qiSeverity = "critical";

/* ------------------------------------------------------------
   Filtering - one filter row scopes every tab
   ------------------------------------------------------------ */
function getFilters() {
  return {
    group: document.getElementById("f-group").value,
    outcome: document.getElementById("f-outcome").value,
    quality: document.getElementById("f-quality").value,
    sentiment: document.getElementById("f-sentiment").value,
    patient: document.getElementById("f-patient").value.trim().toLowerCase(),
    keyword: document.getElementById("f-keyword").value.trim().toLowerCase(),
  };
}

function applyFilters(rows) {
  const f = getFilters();
  return rows.filter((r) => {
    if (f.group && r.group !== f.group) return false;
    if (f.outcome && r.outcome !== f.outcome) return false;
    if (f.sentiment && r.sentiment !== f.sentiment) return false;

    if (f.quality) {
      if (f.quality === "none" && r.quality.length) return false;
      if (f.quality === "any" && !r.quality.length) return false;
      if (["critical", "warning", "info"].includes(f.quality)) {
        const sevs = r.quality.map((q) => QI_BY_ID[q].sev);
        if (!sevs.includes(f.quality)) return false;
      }
    }

    /* Patient search spans name, MRN, and date of birth. */
    if (f.patient) {
      const hay = `${r.patient} ${r.mrn} ${r.dobShort} ${r.contact}`.toLowerCase();
      if (!hay.includes(f.patient)) return false;
    }

    /* Keyword search runs against what was actually said on the call. */
    if (f.keyword && !r.transcriptText.includes(f.keyword)) return false;

    return true;
  });
}

/* ------------------------------------------------------------
   Chart builders (plain HTML/CSS, hover layer included)
   ------------------------------------------------------------ */
function hBarChart(data, opts) {
  const o = opts || {};
  const total = data.reduce((s, d) => s + d.value, 0);
  const max = o.maxOverride
    ? Math.max(o.maxOverride, 1)
    : o.scaleToMax
    ? Math.max(...data.map((d) => d.value), 1)
    : Math.max(total, 1);
  return `<div class="hbar-chart">${data
    .map((d) => {
      const denom = o.denom || total;
      const w = (d.value / max) * 100;
      const share = denom ? ((d.value / denom) * 100).toFixed(1) : "0.0";
      const tip = `${esc(d.label)}: ${fmtNum(d.value)} ${o.unit || "calls"} (${share}% of ${o.denomLabel || "shown"})`;
      return `
      <div class="hbar-row" tabindex="0" role="img" aria-label="${tip}" data-tip="${tip}">
        <div class="hbar-label">${esc(d.label)}</div>
        <div class="hbar-track">
          <div class="hbar-fill" style="width:${w}%;background:${d.color || "var(--s-appointments)"}"></div>
        </div>
        <div class="hbar-value">${fmtNum(d.value)}${o.showPct ? ` <span class="hbar-pct">${share}%</span>` : ""}</div>
      </div>`;
    })
    .join("")}</div>`;
}

function stackedBar(data, opts) {
  const o = opts || {};
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const bar = `
    <div class="stack-bar">
      ${data
        .filter((d) => d.value > 0)
        .map((d) => {
          const w = (d.value / total) * 100;
          const tip = `${esc(d.label)}: ${fmtNum(d.value)} (${w.toFixed(1)}%)`;
          return `<div class="stack-seg" style="width:${w}%;background:${d.color}" tabindex="0" role="img" aria-label="${tip}" data-tip="${tip}"></div>`;
        })
        .join("")}
    </div>`;
  if (o.noLegend) return bar;
  return (
    bar +
    `<div class="legend stack-legend">
      ${data
        .map(
          (d) => `<span class="legend-item"><span class="dot" style="background:${d.color}"></span>${esc(d.label)} <strong>${fmtNum(d.value)}</strong></span>`
        )
        .join("")}
    </div>`
  );
}

/* Donut for part-to-whole at a glance. Kept to <= 6 segments, with a
   labelled value list beside it so no value is color-gated. */
function donutChart(data, centerValue, centerLabel) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const R = 70;
  const STROKE = 26;
  const C = 2 * Math.PI * R;
  let offset = 0;

  const arcs = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const frac = total ? d.value / total : 0;
      /* 2px visual gap between adjacent arcs. */
      const len = Math.max(0, frac * C - 2);
      const seg = `<circle class="donut-arc" r="${R}" cx="100" cy="100"
        fill="none" stroke="${d.color}" stroke-width="${STROKE}"
        stroke-dasharray="${len} ${C - len}"
        stroke-dashoffset="${-offset}"
        tabindex="0" role="img"
        aria-label="${esc(d.label)}: ${fmtNum(d.value)} (${(frac * 100).toFixed(1)}%)"
        data-tip="${esc(d.label)}: ${fmtNum(d.value)} (${(frac * 100).toFixed(1)}%)"></circle>`;
      offset += frac * C;
      return seg;
    })
    .join("");

  return `
    <div class="donut-wrap">
      <div class="donut-figure">
        <svg viewBox="0 0 200 200" class="donut-svg" role="group" aria-label="${esc(centerLabel)}">
          <circle r="${R}" cx="100" cy="100" fill="none" stroke="var(--grid)" stroke-width="${STROKE}"></circle>
          <g transform="rotate(-90 100 100)">${arcs}</g>
        </svg>
        <div class="donut-center">
          <div class="donut-center-value">${fmtNum(centerValue)}</div>
          <div class="donut-center-label">${esc(centerLabel)}</div>
        </div>
      </div>
      <div class="donut-legend">
        ${data
          .map((d) => {
            const share = total ? ((d.value / total) * 100).toFixed(1) : "0.0";
            return `
          <div class="donut-item">
            <span class="dot" style="background:${d.color}"></span>
            <span class="donut-item-label">${esc(d.label)}</span>
            <span class="donut-item-value">${fmtNum(d.value)}</span>
            <span class="donut-item-share">${share}%</span>
          </div>`;
          })
          .join("")}
      </div>
    </div>`;
}

function columnChart(days) {
  const max = Math.max(...days.map((d) => d.total), 1);
  return `
    <div class="col-chart">
      ${days
        .map((d) => {
          const tip = `${d.label}: ${fmtNum(d.total)} calls, ${fmtNum(d.completed)} handled by the agent`;
          const hTotal = (d.total / max) * 100;
          const hDone = d.total ? (d.completed / d.total) * hTotal : 0;
          return `
          <div class="col-slot" tabindex="0" role="img" aria-label="${tip}" data-tip="${tip}">
            <div class="col-stack">
              <div class="col-bar-total" style="height:${hTotal}%">
                <div class="col-bar-done" style="height:${hTotal ? (hDone / hTotal) * 100 : 0}%"></div>
              </div>
            </div>
            <div class="col-tick">${d.tick}</div>
          </div>`;
        })
        .join("")}
    </div>
    <div class="legend stack-legend">
      <span class="legend-item"><span class="dot" style="background:var(--st-good)"></span>Handled by agent</span>
      <span class="legend-item"><span class="dot" style="background:var(--s-practice)"></span>All other outcomes</span>
    </div>`;
}

/* Peak conversation hours. One sequential hue, light to dark, with a
   scale legend; the value sits in each cell so color is never the
   only way to read it. */
function heatmap(grid) {
  const flat = grid.flat();
  const max = Math.max(...flat, 1);
  const STEPS = 5;
  const stepFor = (v) => (v === 0 ? -1 : Math.min(STEPS - 1, Math.floor((v / max) * STEPS)));

  return `
    <div class="heat-wrap">
      <table class="heat-table">
        <thead>
          <tr>
            <th class="heat-corner"></th>
            ${HEATMAP_HOURS.map((h) => `<th class="heat-hour">${hourLabel(h)}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${grid
            .map(
              (row, di) => `
            <tr>
              <th class="heat-day${di >= 5 ? " heat-day-weekend" : ""}">${HEATMAP_DAYS[di]}</th>
              ${row
                .map((v, hi) => {
                  const s = stepFor(v);
                  const tip = `${HEATMAP_DAYS[di]} ${hourRange(HEATMAP_HOURS[hi])}: ${fmtNum(v)} calls`;
                  if (s < 0) {
                    return `<td class="heat-cell"><div class="heat-box heat-empty" tabindex="0" role="img" aria-label="${tip}" data-tip="${tip}">0</div></td>`;
                  }
                  return `<td class="heat-cell"><div class="heat-box heat-s${s}" tabindex="0" role="img" aria-label="${tip}" data-tip="${tip}">${fmtNum(v)}</div></td>`;
                })
                .join("")}
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
      <div class="heat-legend">
        <span class="heat-legend-label">Lower volume</span>
        <div class="heat-swatches">
          ${Array.from({ length: STEPS }, (_, i) => `<span class="heat-box heat-s${i} heat-swatch"></span>`).join("")}
        </div>
        <span class="heat-legend-label">Higher volume</span>
      </div>
    </div>`;
}

/* ------------------------------------------------------------
   Tab 1: Overview
   ------------------------------------------------------------ */
function renderOverview(rows) {
  const total = rows.length;
  const completed = rows.filter((r) => r.outcome === "Completed").length;
  const transferred = rows.filter((r) => r.outcome === "Transferred").length;
  const abandoned = rows.filter((r) => r.outcome === "Abandoned").length;
  const afterhours = rows.filter((r) => r.outcome === "Afterhours").length;
  const crashed = rows.filter((r) => r.outcome === "Crashed").length;

  const booked = rows.filter((r) => r.booked).length;
  const cancelled = rows.filter((r) => r.cancelled).length;
  const rescheduled = rows.filter((r) => r.rescheduled).length;
  const listed = rows.filter((r) => r.listed).length;
  const checkedAvail = rows.filter((r) => r.checkedAvail).length;

  const critical = rows.filter((r) => r.quality.some((q) => QI_BY_ID[q].sev === "critical")).length;
  const anyIssue = rows.filter((r) => r.quality.length).length;
  const avg = total ? Math.round(rows.reduce((s, r) => s + r.duration, 0) / total) : 0;

  document.getElementById("kpi-total").textContent = fmtNum(total);
  document.getElementById("kpi-total-sub").textContent = `${fmtNum(anyIssue)} with a quality flag`;
  document.getElementById("kpi-automation").textContent = pctStr(completed, total);
  document.getElementById("kpi-automation-sub").textContent = `${fmtNum(completed)} of ${fmtNum(total)} resolved with no staff`;
  document.getElementById("kpi-transfer").textContent = pctStr(transferred, total);
  document.getElementById("kpi-transfer-sub").textContent = `${fmtNum(transferred)} handed to staff`;
  /* Each figure is its own independent count, so the sub-line names
     the metric rather than listing sibling numbers that could read
     as a breakdown of the headline. */
  document.getElementById("kpi-booked").textContent = fmtNum(booked);
  document.getElementById("kpi-booked-sub").textContent = "New visits added to the schedule";
  document.getElementById("kpi-act").textContent = fmtDuration(avg);
  document.getElementById("kpi-review").textContent = fmtNum(critical);
  document.getElementById("kpi-review-sub").textContent = critical
    ? `${pctStr(critical, total)} of calls hit a critical issue`
    : "No critical issues detected";

  /* How calls ended */
  const outcomeData = OUTCOME_ORDER.map((o) => ({
    label: OUTCOME_LABELS[o],
    value: rows.filter((r) => r.outcome === o).length,
    color: OUTCOME_COLOR[o],
  }));
  const outcomeNotes = {
    Completed: "Request finished with no staff involvement.",
    Transferred: "Handed to staff on request, out of scope, or a failed lookup.",
    Abandoned: "Caller hung up before the request finished.",
    Afterhours: "Office closed, routed to the afterhours line.",
    Crashed: "Agent ended the call itself, before the request finished.",
  };
  document.getElementById("chart-outcome").innerHTML =
    stackedBar(outcomeData, { noLegend: true }) +
    `<div class="outcome-detail">${OUTCOME_ORDER.map((o, i) => {
      const d = outcomeData[i];
      return `
      <div class="outcome-row">
        <span class="dot" style="background:${d.color}"></span>
        <div class="outcome-text">
          <div class="outcome-name">${esc(d.label)}</div>
          <div class="outcome-note">${esc(outcomeNotes[o])}</div>
        </div>
        <div class="outcome-figs">
          <span class="outcome-count">${fmtNum(d.value)}</span>
          <span class="outcome-share">${pctStr(d.value, total)}</span>
        </div>
      </div>`;
    }).join("")}</div>`;

  /* Appointment work the agent completed, across all five of the
     Appointments capabilities. Mutually exclusive, so these sum to
     the donut total. */
  const apptData = [
    { label: "Booked", value: booked, color: "var(--chart-1)" },
    { label: "Rescheduled", value: rescheduled, color: "var(--chart-2)" },
    { label: "Cancelled", value: cancelled, color: "var(--chart-3)" },
    { label: "Availability checked", value: checkedAvail, color: "var(--chart-4)" },
    { label: "Appointments listed", value: listed, color: "var(--chart-5)" },
  ];
  const apptTotal = apptData.reduce((s, d) => s + d.value, 0);
  document.getElementById("chart-appointments").innerHTML = apptTotal
    ? donutChart(apptData, apptTotal, "completed")
    : `<div class="empty-note">No appointment work in this slice.</div>`;

  /* Peak conversation hours */
  document.getElementById("chart-heatmap").innerHTML = total
    ? heatmap(buildHeatmap(rows))
    : `<div class="empty-note">No calls in this slice.</div>`;

  /* What callers asked for */
  const groupData = VIZ_ORDER.map((g) => ({
    label: g,
    value: rows.filter((r) => r.group === g).length,
    color: SERIES[g],
  }));
  document.getElementById("chart-groups").innerHTML = hBarChart(groupData, { showPct: true });

  /* Daily volume */
  const byDay = {};
  rows.forEach((r) => {
    const k = `${r.datetime.getFullYear()}-${r.datetime.getMonth()}-${r.datetime.getDate()}`;
    if (!byDay[k]) byDay[k] = { d: r.datetime, total: 0, completed: 0 };
    byDay[k].total++;
    if (r.outcome === "Completed") byDay[k].completed++;
  });
  const days = Object.values(byDay)
    .sort((a, b) => a.d - b.d)
    .slice(-14)
    .map((v) => ({
      label: v.d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      tick: v.d.getDate(),
      total: v.total,
      completed: v.completed,
    }));
  document.getElementById("chart-daily").innerHTML = days.length
    ? columnChart(days)
    : `<div class="empty-note">No calls in this slice.</div>`;

  renderQualityIndicators(rows);
}

/* Call quality indicators, three severity tabs */
function renderQualityIndicators(rows) {
  const counts = qualityCounts(rows);
  const sevTotal = (sev) =>
    QUALITY_INDICATORS.filter((q) => q.sev === sev).reduce((s, q) => s + counts[q.id], 0);

  document.getElementById("qi-tabs").innerHTML = SEVERITIES.map(
    (s) => `
    <a href="#" class="tab qi-tab ${s.id === qiSeverity ? "active" : ""}" data-sev="${s.id}">
      ${s.label} <span class="qi-badge qi-badge-${s.id}">${fmtNum(sevTotal(s.id))}</span>
    </a>`
  ).join("");

  const items = QUALITY_INDICATORS.filter((q) => q.sev === qiSeverity)
    .map((q) => ({ q, value: counts[q.id] }))
    .sort((a, b) => b.value - a.value);

  document.getElementById("qi-list").innerHTML = items.length
    ? `<div class="qi-items">${items
        .map(
          (it) => `
      <div class="qi-item qi-item-${qiSeverity}">
        <span class="qi-dot qi-dot-${qiSeverity}"></span>
        <span class="qi-label">${esc(it.q.label)}</span>
        <button class="qi-count" data-qi="${it.q.id}"
          ${it.value ? "" : "disabled"}
          aria-label="Open the ${fmtNum(it.value)} calls flagged ${esc(it.q.label)}">${fmtNum(it.value)}</button>
      </div>`
        )
        .join("")}</div>`
    : `<div class="empty-note">No indicators in this group.</div>`;

  document.querySelectorAll("#qi-tabs .qi-tab").forEach((t) => {
    t.addEventListener("click", (e) => {
      e.preventDefault();
      qiSeverity = t.dataset.sev;
      renderQualityIndicators(rows);
    });
  });

  /* The count itself opens the matching calls in a modal, so a
     stakeholder can read the evidence without leaving the dashboard. */
  document.querySelectorAll("#qi-list .qi-count").forEach((el) => {
    el.addEventListener("click", () => {
      if (!el.disabled) openCallsModal(el.dataset.qi, rows);
    });
  });
}

/* ------------------------------------------------------------
   Calls-list modal, opened from a quality indicator count
   ------------------------------------------------------------ */
function openCallsModal(qiId, rows) {
  const qi = QI_BY_ID[qiId];
  const matches = rows.filter((r) => r.quality.includes(qiId));

  document.getElementById("calls-modal-title").textContent = qi.label;
  document.getElementById("calls-modal-sub").innerHTML =
    `<span class="qi-chip qi-chip-${qi.sev}"><span class="qi-dot qi-dot-${qi.sev}"></span>${esc(SEVERITIES.find((s) => s.id === qi.sev).label)}</span>
     <span class="calls-modal-count">${fmtNum(matches.length)} call${matches.length === 1 ? "" : "s"} flagged</span>`;

  document.getElementById("calls-modal-body").innerHTML = matches.length
    ? `<table class="calls-mini-table">
        <thead>
          <tr>
            <th class="cm-dt">Date / Time</th>
            <th>Patient</th>
            <th>Capability</th>
            <th>Outcome</th>
            <th class="col-num">Duration</th>
            <th class="col-action"></th>
          </tr>
        </thead>
        <tbody>
          ${matches
            .slice(0, 60)
            .map(
              (r) => `
            <tr data-id="${r.id}">
              <td class="cm-dt">${fmtDateTime(r.datetime)}</td>
              <td>
                <div class="pt-name">${esc(r.patient)}</div>
                ${r.mrn ? `<div class="cap-ref">${esc(r.mrn)}</div>` : ""}
              </td>
              <td>${esc(CAP_BY_ID[r.capability].label)}</td>
              <td>${outcomePill(r.outcome)}</td>
              <td class="col-num">${fmtDuration(r.duration)}</td>
              <td class="col-action"><button class="link-btn">Transcript</button></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
      ${matches.length > 60 ? `<p class="panel-note">Showing the 60 most recent of ${fmtNum(matches.length)} flagged calls.</p>` : ""}`
    : `<div class="empty-note">No calls carry this indicator in the current filter.</div>`;

  /* Drilling from this list into a single transcript swaps modals. */
  document.querySelectorAll("#calls-modal-body tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => {
      closeCallsModal();
      openModal(tr.dataset.id);
    });
  });

  document.getElementById("calls-modal-overlay").classList.remove("hidden");
  document.getElementById("calls-modal-close").focus();
}

function closeCallsModal() {
  document.getElementById("calls-modal-overlay").classList.add("hidden");
}

/* ------------------------------------------------------------
/* Nice round axis maximum and a tick step that lands on clean
   numbers, so gridlines read as 0 / 90 / 180 rather than 0 / 84. */
function axisScale(peak, ticks) {
  const n = ticks || 4;
  if (peak <= 0) return { max: n, step: 1 };
  const rough = peak / n;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  /* Counts are whole calls, so the step never goes fractional and
     2.5x is dropped below 10 (it would yield ticks like 2.5 / 5). */
  const candidates = [1, 2, 2.5, 5, 10].map((m) => m * mag).filter((s) => s >= 1 && Number.isInteger(s));
  let step = candidates.find((s) => s >= rough) || Math.max(1, Math.ceil(rough));
  /* Shrink the tick count rather than overshoot the axis: a peak of
     412 should top out near 450, not 800. */
  let max = step * n;
  while (max - step >= peak && max - step > 0) max -= step;
  return { max, step };
}

/* Vertical stacked columns: one chart per capability group, one
   column per capability, each column split by how its calls ended.
   Each chart carries its own y-axis because group peaks differ by
   4x, and a shared scale would flatten the smaller groups. */
function stackedColumnChart(items, opts) {
  const o = opts || {};
  const peak = Math.max(...items.map((it) => it.total), 0);
  const { max, step } = axisScale(peak);
  const ticks = [];
  for (let v = max; v >= 0; v -= step) ticks.push(v);

  return `
    <div class="scol-chart">
      <div class="scol-axis">
        ${ticks.map((v) => `<div class="scol-tick"><span>${fmtNum(v)}</span></div>`).join("")}
      </div>
      <div class="scol-plot">
        <div class="scol-grid">
          ${ticks.map(() => `<div class="scol-gridline"></div>`).join("")}
        </div>
        <div class="scol-cols">
          ${items
            .map((it) => {
              const mix = it.segments.filter((s) => s.value > 0);
              const mixTip = mix.map((s) => `${s.label}: ${fmtNum(s.value)}`).join(" • ");
              const tip = `${it.label} • ${fmtNum(it.total)} calls • ${mixTip}`;
              return `
              <div class="scol-slot">
                <div class="scol-colwrap">
                  <div class="scol-col" style="height:${(it.total / max) * 100}%"
                    tabindex="0" role="img" aria-label="${tip}" data-tip="${tip}">
                    <div class="scol-total">${fmtNum(it.total)}</div>
                    ${mix
                      /* Drawn top-down, so the first outcome in the
                         order sits at the bottom of the column. */
                      .slice()
                      .reverse()
                      .map((s) => {
                        const segTip = `${it.label} • ${s.label}: ${fmtNum(s.value)} of ${fmtNum(it.total)} (${((s.value / it.total) * 100).toFixed(1)}%)`;
                        return `<div class="scol-seg" style="height:${(s.value / it.total) * 100}%;background:${s.color}"
                          tabindex="0" role="img" aria-label="${segTip}" data-tip="${segTip}"></div>`;
                      })
                      .join("")}
                  </div>
                </div>
                <div class="scol-label" title="${esc(it.label)}">${esc(it.label)}</div>
              </div>`;
            })
            .join("")}
        </div>
      </div>
    </div>
    ${o.footNote ? `<div class="scol-foot">${o.footNote}</div>` : ""}`;
}

/* ------------------------------------------------------------
   Tab 2: Capabilities

   One chart per capability group, one stacked column per
   capability, split by how those calls ended. The outcome legend
   appears once for the whole tab, since every chart shares it.
   ------------------------------------------------------------ */
function renderCapabilities(rows) {
  const host = document.getElementById("cap-groups");

  if (!rows.length) {
    host.innerHTML = `<section class="panel"><div class="empty-note">No calls match these filters.</div></section>`;
    return;
  }

  const charts = VIZ_ORDER.map((g) => {
    const groupRows = rows.filter((r) => r.group === g);
    const identity = IDENTITY_GROUPS.includes(g);
    /* For transfer and out-of-scope work, handing the caller to staff
       IS the correct result, so those are scored on correct handling
       rather than on completion. */
    const transferIsSuccess = g === "Only Staff Transfer" || g === "Out of Scope";

    const items = CAPABILITIES.filter((c) => c.group === g)
      .map((c) => {
        const sub = rows.filter((r) => r.capability === c.id);
        const done = sub.filter((r) => r.outcome === "Completed").length;
        const tr = sub.filter((r) => r.outcome === "Transferred").length;
        const good = transferIsSuccess ? done + tr : done;
        return {
          label: c.label,
          total: sub.length,
          good,
          rate: sub.length ? (good / sub.length) * 100 : 0,
          segments: OUTCOME_ORDER.map((o) => ({
            label: OUTCOME_LABELS[o],
            value: sub.filter((r) => r.outcome === o).length,
            color: OUTCOME_COLOR[o],
          })),
        };
      })
      .sort((a, b) => b.total - a.total);

    const groupGood = items.reduce((s, it) => s + it.good, 0);

    return `
      <section class="panel scol-panel">
        <div class="scol-head">
          <div class="scol-head-main">
            <h3 class="scol-title">
              <span class="dot" style="background:${SERIES[g]}"></span>${esc(g)}
            </h3>
            <div class="scol-sub">
              ${fmtNum(groupRows.length)} calls &middot;
              ${pctStr(groupGood, groupRows.length)} ${transferIsSuccess ? "handled correctly" : "resolved by agent"}
            </div>
          </div>
          <div class="scol-head-right">
            <span class="capgroup-id ${identity ? "id-on" : "id-off"}"
              data-tip="${identity ? "Name and date of birth are required before the agent can act on these requests." : "These requests are answered without verifying patient identity."}">
              ${identity ? "ID required" : "no ID"}
            </span>
            <button class="link-btn" data-drill-group="${esc(g)}">View calls</button>
          </div>
        </div>
        ${stackedColumnChart(items, {
          footNote: transferIsSuccess
            ? "For these requests, transferring the caller to staff is the correct outcome."
            : "",
        })}
      </section>`;
  }).join("");

  host.innerHTML = `
    <div class="scol-legendbar">
      <span class="scol-legendbar-label">How calls ended</span>
      <div class="legend scol-legend">
        ${OUTCOME_ORDER.filter((o) => rows.some((r) => r.outcome === o))
          .map(
            (o) =>
              `<span class="legend-item"><span class="dot" style="background:${OUTCOME_COLOR[o]}"></span>${esc(OUTCOME_LABELS[o])}</span>`
          )
          .join("")}
      </div>
    </div>
    <div class="scol-grid-outer">${charts}</div>`;

  host.querySelectorAll("[data-drill-group]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      document.getElementById("f-group").value = b.dataset.drillGroup;
      switchTab("log");
      refresh();
    });
  });
}

/* ------------------------------------------------------------
   Tab 3: Calls log
   ------------------------------------------------------------ */
function outcomePill(outcome) {
  const map = {
    Completed: "outcome-completed",
    Transferred: "outcome-transferred",
    Abandoned: "outcome-abandoned",
    Afterhours: "outcome-afterhours",
    Crashed: "outcome-crashed",
  };
  return `<span class="outcome-pill ${map[outcome]}">${OUTCOME_LABELS[outcome]}</span>`;
}

function qualityCell(r) {
  if (!r.quality.length) return '<span class="status-chip chip-pass">Clean</span>';
  const sevs = r.quality.map((q) => QI_BY_ID[q].sev);
  const worst = sevs.includes("critical") ? "critical" : sevs.includes("warning") ? "warning" : "info";
  const cls = worst === "critical" ? "chip-fail" : worst === "warning" ? "chip-warn" : "chip-info";
  return `<span class="status-chip ${cls}">${r.quality.length} issue${r.quality.length > 1 ? "s" : ""}</span>`;
}

function sortRows(rows) {
  const dir = sortDir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let av = a[sortKey];
    let bv = b[sortKey];
    if (sortKey === "datetime") {
      av = av.getTime();
      bv = bv.getTime();
    } else if (sortKey === "capability") {
      av = CAP_BY_ID[av].label;
      bv = CAP_BY_ID[bv].label;
    }
    if (typeof av === "string") {
      av = av.toLowerCase();
      bv = bv.toLowerCase();
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function renderLog(rows) {
  const sorted = sortRows(rows);
  const tbody = document.getElementById("aa-table-body");

  tbody.innerHTML = sorted.length
    ? sorted
        .map(
          (r) => `
      <tr data-id="${r.id}">
        <td class="col-dt">${fmtDateTime(r.datetime)}</td>
        <td>
          <div class="pt-name">${esc(r.patient)}${r.newPatient ? ' <span class="tag-new">New</span>' : ""}</div>
          ${r.mrn ? `<div class="cap-ref">${esc(r.mrn)} &middot; ${esc(r.dobShort)}</div>` : ""}
        </td>
        <td>
          <div class="cap-name">${esc(CAP_BY_ID[r.capability].label)}</div>
          <div class="cap-ref">${esc(r.group)}</div>
        </td>
        <td class="col-identity">${r.identityRequired ? (r.identityVerified ? '<span class="status-chip chip-pass">Verified</span>' : '<span class="status-chip chip-fail">Not verified</span>') : '<span class="muted-dash">Not required</span>'}</td>
        <td>${outcomePill(r.outcome)}</td>
        <td class="col-num">${fmtDuration(r.duration)}</td>
        <td class="col-quality">${qualityCell(r)}</td>
        <td class="col-action"><button class="link-btn">View details</button></td>
      </tr>`
        )
        .join("")
    : `<tr><td colspan="8"><div class="empty-note">No calls match these filters.</div></td></tr>`;

  tbody.querySelectorAll("tr[data-id]").forEach((tr) => {
    tr.addEventListener("click", () => openModal(tr.dataset.id));
  });

  document.getElementById("aa-table-footer").textContent =
    `Showing ${fmtNum(sorted.length)} of ${fmtNum(ALL_ROWS.length)} calls`;
}

/* ------------------------------------------------------------
   Detail modal
   ------------------------------------------------------------ */
function openModal(id) {
  const r = ALL_ROWS.find((x) => x.id === id);
  if (!r) return;
  const cap = CAP_BY_ID[r.capability];

  document.getElementById("modal-patient").textContent = r.patient;
  document.getElementById("modal-meta").textContent =
    `${fmtDateTime(r.datetime)} • ${fmtDuration(r.duration)} • ${r.contact}`;
  document.getElementById("modal-capability").textContent = cap.label;
  document.getElementById("modal-capability-ref").textContent = `${r.group} • spec ${cap.ref}`;
  document.getElementById("modal-outcome").textContent = OUTCOME_LABELS[r.outcome];
  document.getElementById("modal-sentiment").textContent = r.sentiment;

  const idEl = document.getElementById("modal-identity");
  idEl.textContent = r.identityRequired
    ? r.identityVerified
      ? `Verified${r.newPatient ? " (new patient)" : ""}`
      : "Not verified"
    : "Not required";
  idEl.className = "modal-info-value " + (r.identityRequired ? (r.identityVerified ? "val-good" : "val-bad") : "val-muted");

  /* Patient record, only where the caller was actually identified. */
  const rec = document.getElementById("modal-patient-record");
  rec.innerHTML = r.anonymous
    ? '<span class="muted-dash">Caller was not identified. This request type does not require it.</span>'
    : `<div class="kv"><span class="kv-k">MRN</span><span class="kv-v">${esc(r.mrn)}</span></div>
       <div class="kv"><span class="kv-k">Date of birth</span><span class="kv-v">${esc(r.dobShort)}</span></div>
       <div class="kv"><span class="kv-k">Phone</span><span class="kv-v">${esc(r.contact)}</span></div>
       <div class="kv"><span class="kv-k">Location</span><span class="kv-v">${esc(r.location)}</span></div>`;

  document.getElementById("modal-summary").textContent = r.summary;
  document.getElementById("modal-identity-note").textContent = r.identityRequired
    ? "Name and date of birth are required for this request type."
    : "This request type is answered without patient identity.";

  const sms = document.getElementById("modal-sms");
  sms.innerHTML = !r.smsOffered
    ? '<span class="muted-dash">No confirmation text was offered for this request.</span>'
    : r.smsSent
    ? '<span class="status-chip chip-pass">Offered and sent after consent</span>'
    : '<span class="status-chip chip-warn">Offered, caller declined. Nothing sent.</span>';

  const q = document.getElementById("modal-quality");
  q.innerHTML = r.quality.length
    ? `<div class="modal-qi">${r.quality
        .map((id) => {
          const qi = QI_BY_ID[id];
          return `<span class="qi-chip qi-chip-${qi.sev}"><span class="qi-dot qi-dot-${qi.sev}"></span>${esc(qi.label)}</span>`;
        })
        .join("")}</div>`
    : '<div class="comp-clean">&#10003; No quality issues detected on this call.</div>';

  const tb = document.getElementById("modal-transcript");
  const kw = document.getElementById("f-keyword").value.trim();
  tb.innerHTML = r.transcript.length
    ? r.transcript
        .map(
          (l) => `
      <div class="transcript-line transcript-${l.s.toLowerCase()}">
        <span class="transcript-speaker">${esc(l.s)}</span>
        <span class="transcript-text">${highlight(l.text, kw)}</span>
      </div>`
        )
        .join("")
    : `<div class="empty-note">No transcript available. The caller disconnected before the agent could respond.</div>`;

  document.getElementById("aa-modal-overlay").classList.remove("hidden");
  document.getElementById("modal-close").focus();
}

/* Mark the searched keyword in the transcript so the match is findable
   without re-reading the whole call. */
function highlight(text, kw) {
  const safe = esc(text);
  if (!kw) return safe;
  const needle = esc(kw).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return safe.replace(new RegExp(needle, "gi"), (m) => `<mark>${m}</mark>`);
}

function closeModal() {
  document.getElementById("aa-modal-overlay").classList.add("hidden");
}

/* ------------------------------------------------------------
   Tabs, filters, wiring
   ------------------------------------------------------------ */
function switchTab(name) {
  activeTab = name;
  document.querySelectorAll(".tabs > .tab[data-tab]").forEach((t) => {
    t.classList.toggle("active", t.dataset.tab === name);
  });
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.toggle("hidden", p.id !== `tab-${name}`);
  });
}

function refresh() {
  const filtered = applyFilters(ALL_ROWS);
  renderOverview(filtered);
  renderCapabilities(filtered);
  renderLog(filtered);
}

function initTabs() {
  document.querySelectorAll(".tabs > .tab[data-tab]").forEach((t) => {
    t.addEventListener("click", (e) => {
      e.preventDefault();
      switchTab(t.dataset.tab);
    });
  });
}

function initFilters() {
  ["f-group", "f-outcome", "f-quality", "f-sentiment"].forEach((id) => {
    document.getElementById(id).addEventListener("change", refresh);
  });
  ["f-patient", "f-keyword"].forEach((id) => {
    document.getElementById(id).addEventListener("input", refresh);
  });

  document.getElementById("clear-filters").addEventListener("click", (e) => {
    e.preventDefault();
    ["f-group", "f-outcome", "f-quality", "f-sentiment"].forEach((id) => {
      document.getElementById(id).value = "";
    });
    ["f-patient", "f-keyword"].forEach((id) => {
      document.getElementById(id).value = "";
    });
    refresh();
  });
}

function initSorting() {
  document.querySelectorAll("#aa-table th.sortable").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (sortKey === key) sortDir = sortDir === "asc" ? "desc" : "asc";
      else {
        sortKey = key;
        sortDir = "asc";
      }
      document.querySelectorAll("#aa-table th.sortable").forEach((h) => h.classList.remove("sort-asc", "sort-desc"));
      th.classList.add(sortDir === "asc" ? "sort-asc" : "sort-desc");
      refresh();
    });
  });
}

function initModal() {
  document.getElementById("modal-close").addEventListener("click", closeModal);
  document.getElementById("aa-modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "aa-modal-overlay") closeModal();
  });

  document.getElementById("calls-modal-close").addEventListener("click", closeCallsModal);
  document.getElementById("calls-modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "calls-modal-overlay") closeCallsModal();
  });

  /* Escape closes the topmost modal only, so stepping from the list
     into a transcript and back out behaves as expected. */
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!document.getElementById("aa-modal-overlay").classList.contains("hidden")) closeModal();
    else closeCallsModal();
  });
}

/* Shared hover tooltip for every chart mark */
function initTooltip() {
  const tip = document.getElementById("viz-tip");
  function show(e) {
    const el = e.target.closest("[data-tip]");
    if (!el) return;
    tip.textContent = el.dataset.tip;
    tip.classList.remove("hidden");
    const r = el.getBoundingClientRect();
    tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 12, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
    tip.style.top = `${Math.max(8, r.top - tip.offsetHeight - 8)}px`;
  }
  function hide(e) {
    if (e.target.closest && e.target.closest("[data-tip]")) tip.classList.add("hidden");
  }
  document.addEventListener("mouseover", show);
  document.addEventListener("mouseout", hide);
  document.addEventListener("focusin", show);
  document.addEventListener("focusout", hide);
}

initTabs();
initFilters();
initSorting();
initModal();
initTooltip();
refresh();
switchTab("overview");
