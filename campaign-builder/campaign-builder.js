/* Shared chrome for the Campaign Builder module.
   Each step page sets window.CB_STEP (0-6) before loading this file; the script
   renders the sidebar, topbar and stepper so all pages stay identical. */
(function () {
  "use strict";

  var STEPS = [
    { label: "Campaign Type", icon: "&#128363;&#65038;", file: "step-1-campaign-type.html" },
    { label: "Practice", icon: "&#127970;&#65038;", file: "step-2-practice.html" },
    { label: "Locations", icon: "&#9679;", file: "step-3-locations.html" },
    { label: "Providers", icon: "&#9787;&#65038;", file: "step-4-providers.html" },
    { label: "Configurations", icon: "&#9881;&#65038;", file: "step-5-configurations.html" },
    { label: "Workflow", icon: "&#9735;&#65038;", file: "step-6-workflow.html" },
    { label: "Review", icon: "&#10003;", file: "step-7-review.html" },
  ];

  // Per-step header figures, matching the reference screenshots.
  var ELIGIBLE = [null, "N/A", "16,072", "16,072", "294", "294", "294"];
  var BADGES = { 2: "1", 3: "3", 4: "3", 5: "3", 6: "3" };

  var step = typeof window.CB_STEP === "number" ? window.CB_STEP : 0;

  /* The chosen campaign type rides along in the query string so each step knows
     which configuration page to send the user to. */
  function campaignType() {
    var m = /[?&]type=([^&]+)/.exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : "";
  }
  var TYPE = campaignType();
  var QS = TYPE ? "?type=" + encodeURIComponent(TYPE) : "";

  // Mixed campaigns get their own rule-builder configuration page.
  if (TYPE === "mixed") {
    STEPS[4].file = "step-5-mixed-configurations.html";
    ELIGIBLE[4] = "1,284";
    ELIGIBLE[5] = "1,284";
    ELIGIBLE[6] = "1,284";
  }

  // Carry the type through every in-wizard link.
  function withType(href) {
    if (!QS || href.indexOf("step-") !== 0) return href;
    return href.indexOf("?") > -1 ? href : href + QS;
  }

  function sidebarHtml() {
    var items = [
      ["&#9638;", "Dashboard", false],
      ["&#128226;", "Campaigns", false],
      ["&#128101;", "Patients", false],
      ["&#128222;", "Outreach &amp; Calls", true],
      ["&#128200;", "Performance", true],
      ["&#128197;", "Appointments", true],
      ["&#36;", "Financials", true],
      ["&#9881;", "Settings", true],
    ];
    return (
      '<aside class="cb-sidebar">' +
      '<div class="cb-logo"><span class="cb-logo-text"><span>Recall</span> Health</span>' +
      '<span class="cb-pin">&#128204;</span></div>' +
      '<nav class="cb-nav">' +
      items
        .map(function (it) {
          return (
            '<a class="cb-nav-item" href="../campaign-overview.html">' +
            '<span class="cb-ico">' +
            it[0] +
            "</span>" +
            it[1] +
            (it[2] ? '<span class="cb-caret">&#9662;</span>' : "") +
            "</a>"
          );
        })
        .join("") +
      "</nav></aside>"
    );
  }

  function topbarHtml() {
    return (
      '<header class="cb-topbar">' +
      '<a class="btn-create" href="step-1-campaign-type.html">&#43; Create Campaign</a>' +
      '<div class="cb-user">' +
      '<div><div class="cb-user-name">Shweta Singh</div>' +
      '<div class="cb-user-role">Global Admin</div></div>' +
      '<div class="cb-avatar">&#129489;&#8205;&#9877;&#65039;</div>' +
      "</div>" +
      '<a class="cb-power" href="../campaign-overview.html" title="Exit builder">&#9211;</a>' +
      "</header>"
    );
  }

  function stepperHtml() {
    return (
      '<div class="cb-stepper">' +
      STEPS.map(function (s, i) {
        var cls = "cb-step";
        if (i === step) cls += " is-active";
        else if (i < step) cls += " is-done";
        if (i < step) cls += " is-line-done";

        var badge =
          BADGES[step] && (i === 2 || i === 3) && i <= step
            ? '<span class="cb-step-badge">' + (i === 2 ? "1" : "3") + "</span>"
            : "";

        // Completed steps stay clickable so you can jump back.
        var tag = i <= step ? "a" : "span";
        var href = i <= step ? ' href="' + withType(s.file) + '"' : "";

        return (
          "<" + tag + ' class="' + cls + '"' + href + ">" +
          badge +
          '<span class="cb-step-dot">' + s.icon + "</span>" +
          '<span class="cb-step-label">' + s.label + "</span>" +
          "</" + tag + ">"
        );
      }).join("") +
      "</div>"
    );
  }

  function headHtml() {
    var val = ELIGIBLE[step];
    return (
      '<div class="cb-head"><h1>CAMPAIGN BUILDER</h1>' +
      (val === null
        ? "<div></div>"
        : '<div class="cb-eligible"><span class="cb-ep-icon">&#128101;&#65038;</span>' +
          "Eligible Patients: <b>" +
          val +
          "</b></div>") +
      "</div>"
    );
  }

  document.addEventListener("DOMContentLoaded", function () {
    var shell = document.querySelector(".cb-shell");
    if (!shell) return;

    // The page supplies only its panel; chrome is injected around it.
    var panel = shell.innerHTML;
    shell.innerHTML =
      sidebarHtml() +
      '<div class="cb-main">' +
      topbarHtml() +
      '<div class="cb-body">' +
      headHtml() +
      stepperHtml() +
      '<div class="cb-panel">' +
      panel +
      "</div></div></div>";

    retargetLinks();
    applyMixedReview();
    wireInteractions();
  });

  /* On the review step, a Mixed campaign reports its rule sentence and the
     count the builder worked out, instead of the appointment-type target.
     Later steps also echo the count the rule builder arrived at. */
  function applyMixedReview() {
    if (TYPE !== "mixed") return;

    var name = document.querySelector("[data-cb-type-name]");
    if (name) name.textContent = "Mixed (Advanced Scheduling)";

    var summary = "";
    var count = "";
    try {
      summary = sessionStorage.getItem("cb-mixed-summary") || "";
      count = sessionStorage.getItem("cb-mixed-count") || "";
    } catch (err) {
      /* no storage: fall back to the generic copy already in the page */
    }

    // Steps after the rule builder show the count it produced.
    if (count && step > 4) {
      var hdr = document.querySelector(".cb-eligible b");
      if (hdr) hdr.textContent = Number(count).toLocaleString("en-US");
    }

    var target = document.querySelector("[data-cb-target]");
    if (target && summary) {
      target.querySelector("p").innerHTML =
        summary + " Seen within <b>Jan 1, 2019</b> and <b>Nov 23, 2025</b>.";
    }

    if (count) {
      var eligible = document.querySelector(".cb-eligible b");
      if (eligible) eligible.textContent = Number(count).toLocaleString("en-US");
      Array.prototype.forEach.call(document.querySelectorAll(".cb-kv"), function (dl) {
        if (/Eligible Patients/.test(dl.textContent)) {
          dl.querySelector("dd").innerHTML =
            "<u>" + Number(count).toLocaleString("en-US") + "</u>";
        }
      });
    }
  }

  /* Rewrite step links so the campaign type follows the user, and so the
     Configurations step resolves to the right page for this type. */
  function retargetLinks() {
    if (!QS) return;
    Array.prototype.forEach.call(document.querySelectorAll("a[href]"), function (a) {
      var href = a.getAttribute("href");
      if (href.indexOf("step-") !== 0) return;
      // Footer links to the generic config page go to the Mixed one instead.
      if (TYPE === "mixed" && href.indexOf("step-5-configurations.html") === 0) {
        href = "step-5-mixed-configurations.html";
      }
      a.setAttribute("href", withType(href));
    });
  }

  /* ------------------------------------------------- per-page behaviour */

  function wireInteractions() {
    // Select-all checkboxes toggle every box in their grid.
    var all = document.querySelector("[data-select-all]");
    if (all) {
      var boxes = document.querySelectorAll(".cb-pick-grid .cb-check");
      all.addEventListener("change", function () {
        Array.prototype.forEach.call(boxes, function (b) {
          b.checked = all.checked;
          syncPick(b);
        });
      });
      Array.prototype.forEach.call(boxes, function (b) {
        b.addEventListener("change", function () {
          syncPick(b);
          all.checked =
            document.querySelectorAll(".cb-pick-grid .cb-check:checked").length ===
            boxes.length;
        });
      });
    }

    // Include / Exclude and patient-source tab switching.
    Array.prototype.forEach.call(document.querySelectorAll(".cb-tabs"), function (group) {
      var tabs = group.querySelectorAll(".cb-tab");
      Array.prototype.forEach.call(tabs, function (tab) {
        tab.addEventListener("click", function () {
          Array.prototype.forEach.call(tabs, function (t) {
            t.classList.remove("is-active");
          });
          tab.classList.add("is-active");
        });
      });
    });

    // Billing cycle toggle on the review page.
    var billing = document.querySelectorAll("[data-billing]");
    Array.prototype.forEach.call(billing, function (b) {
      b.addEventListener("click", function () {
        Array.prototype.forEach.call(billing, function (x) {
          x.classList.remove("is-active");
        });
        b.classList.add("is-active");
      });
    });

    // Appointment-type list opens on focus, closes on outside click.
    var search = document.getElementById("cb-appt-search");
    var list = document.getElementById("cb-appt-list");
    var chips = document.getElementById("cb-appt-chips");
    if (search && list) {
      search.addEventListener("focus", function () {
        list.hidden = false;
        if (chips) chips.hidden = true;
      });
      document.addEventListener("click", function (e) {
        if (!e.target.closest("#cb-appt-list") && !e.target.closest("#cb-appt-search")) {
          list.hidden = true;
          if (chips) chips.hidden = false;
        }
      });
      search.addEventListener("input", function () {
        var q = search.value.toLowerCase();
        Array.prototype.forEach.call(list.querySelectorAll(".cb-opt"), function (o) {
          o.style.display = o.textContent.toLowerCase().indexOf(q) > -1 ? "" : "none";
        });
      });
    }

    // Chip removal and Clear All.
    Array.prototype.forEach.call(document.querySelectorAll("[data-rmchip]"), function (b) {
      b.addEventListener("click", function () {
        b.closest(".cb-chip").remove();
      });
    });
    var clear = document.getElementById("cb-clear-appts");
    if (clear) {
      clear.addEventListener("click", function () {
        var box = document.getElementById("cb-appt-chips");
        if (box) box.hidden = true;
      });
    }
  }

  function syncPick(box) {
    var card = box.closest(".cb-pick");
    if (card) card.classList.toggle("is-selected", box.checked);
  }
})();
