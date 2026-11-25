/* Visual rules engine for the Mixed campaign type.

   The configuration is a flat list of conditions. Each condition after the first
   carries the operator (AND/OR) that joins it to the one above, so operators are
   set per pair rather than once for the whole set. */
(function () {
  "use strict";

  /* ------------------------------------------------------------ reference data */

  var CPT = [
    { code: "J0585", label: "Botox (onabotulinumtoxinA), per unit" },
    { code: "J0586", label: "Dysport (abobotulinumtoxinA), per unit" },
    { code: "J0587", label: "Myobloc (rimabotulinumtoxinB), per unit" },
    { code: "J0588", label: "Xeomin (incobotulinumtoxinA), per unit" },
    { code: "11900", label: "Injection, intralesional; up to 7 lesions" },
    { code: "17000", label: "Destruction, premalignant lesion; first" },
    { code: "17110", label: "Destruction, benign lesions; up to 14" },
    { code: "11042", label: "Debridement, subcutaneous tissue" },
    { code: "11102", label: "Tangential biopsy of skin; single lesion" },
    { code: "11104", label: "Punch biopsy of skin; single lesion" },
    { code: "11640", label: "Excision, malignant lesion face/ears; 0.5 cm or less" },
    { code: "17311", label: "Mohs micrographic surgery, first stage" },
    { code: "96910", label: "Photochemotherapy; tar and ultraviolet B" },
    { code: "96920", label: "Laser treatment for psoriasis; under 250 sq cm" },
    { code: "15823", label: "Blepharoplasty, upper eyelid with excess skin" },
  ];

  var ICD = [
    { code: "L70.0", label: "Acne vulgaris" },
    { code: "L40.0", label: "Psoriasis vulgaris" },
    { code: "L20.9", label: "Atopic dermatitis, unspecified" },
    { code: "L30.9", label: "Dermatitis, unspecified" },
    { code: "C43.9", label: "Malignant melanoma of skin, unspecified" },
    { code: "C44.91", label: "Basal cell carcinoma of skin, unspecified" },
    { code: "C44.92", label: "Squamous cell carcinoma of skin, unspecified" },
    { code: "D22.9", label: "Melanocytic nevi, unspecified" },
    { code: "L57.0", label: "Actinic keratosis" },
    { code: "L82.1", label: "Other seborrheic keratosis" },
    { code: "L63.9", label: "Alopecia areata, unspecified" },
    { code: "L71.9", label: "Rosacea, unspecified" },
    { code: "B07.9", label: "Viral wart, unspecified" },
    { code: "L03.90", label: "Cellulitis, unspecified" },
    { code: "Z12.83", label: "Screening for malignant neoplasm of skin" },
  ];

  var APPT = [
    { code: "", label: "Neurotoxin" },
    { code: "", label: "Neurotoxin Follow up" },
    { code: "", label: "Filler" },
    { code: "", label: "Acne Follow up" },
    { code: "", label: "Full Body Skin Exam" },
    { code: "", label: "Skin Cancer Screening" },
    { code: "", label: "Mohs Surgery" },
    { code: "", label: "Mohs Follow up" },
    { code: "", label: "Biopsy" },
    { code: "", label: "Suture Removal" },
    { code: "", label: "Phototherapy" },
    { code: "", label: "Laser Treatment" },
    { code: "", label: "Cosmetic Consult" },
    { code: "", label: "New Patient" },
    { code: "", label: "Established Patient" },
  ];

  /* Condition catalogue. `values` names the vocabulary a condition draws on;
     conditions with values:null take no operand (e.g. no future appointments). */
  var FIELDS = [
    {
      id: "cpt-seen",
      group: "Historical Patient Activity",
      label: "Was seen for CPT code(s)",
      values: "cpt",
      verb: "were seen for CPT",
    },
    {
      id: "icd-seen",
      group: "Historical Patient Activity",
      label: "Was seen with ICD code(s)",
      values: "icd",
      verb: "were seen with ICD",
    },
    {
      id: "future-appt",
      group: "Future Appointment Conditions",
      label: "Has a future appointment for",
      values: "appt",
      verb: "have a future appointment for",
    },
    {
      id: "no-future-appt-type",
      group: "Future Appointment Conditions",
      label: "Has NO future appointment for",
      values: "appt",
      verb: "have NO future appointment for",
      negated: true,
    },
    {
      id: "no-future-appts",
      group: "Future Appointment Conditions",
      label: "Has NO future appointments at all",
      values: null,
      verb: "have no future appointments scheduled at all",
      negated: true,
    },
  ];

  var VOCAB = { cpt: CPT, icd: ICD, appt: APPT };
  var VOCAB_LABEL = { cpt: "CPT codes", icd: "ICD codes", appt: "appointment types" };

  /* ------------------------------------------------------------------- model */

  var uid = 0;
  function nextId() {
    return "n" + ++uid;
  }

  /* `op` is the operator joining this condition to the one above it. It is
     ignored on the first condition in the list. */
  function newCondition(fieldId, op) {
    return {
      id: nextId(),
      field: fieldId || "cpt-seen",
      values: [],
      op: op || "AND",
    };
  }

  // Starts on the Neurotoxin Recall shape from the brief.
  var model = {
    scope: "include",
    rules: [],
  };
  (function seed() {
    var a = newCondition("cpt-seen");
    a.values = ["J0585", "J0586"];
    var b = newCondition("no-future-appt-type", "AND");
    b.values = ["Neurotoxin"];
    model.rules.push(a, b);
  })();

  function findRule(id) {
    for (var i = 0; i < model.rules.length; i++) {
      if (model.rules[i].id === id) return model.rules[i];
    }
    return null;
  }

  function fieldById(id) {
    for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].id === id) return FIELDS[i];
    return FIELDS[0];
  }

  /* -------------------------------------------------------------- validation */

  /* Flags configurations that cannot match any patient, plus incomplete rows.

     A condition is only *forced* on every patient when it and all conditions
     before it are joined by AND. Once an OR appears, the list splits into
     alternative branches, so a later condition is no longer mandatory on its
     own. Contradictions are judged per AND-joined branch. */
  function validate() {
    var problems = [];

    model.rules.forEach(function (r) {
      var f = fieldById(r.field);
      if (f.values && !r.values.length) {
        problems.push(
          "A “" + f.label + "” condition has no " +
            VOCAB_LABEL[f.values] + " selected."
        );
      }
    });

    if (!model.rules.length) {
      problems.push("Add at least one condition to define who this campaign reaches.");
    }

    // Split the list into branches at each OR; everything inside a branch is ANDed.
    var branches = [];
    var current = [];
    model.rules.forEach(function (r, i) {
      if (i > 0 && r.op === "OR") {
        branches.push(current);
        current = [];
      }
      current.push(r);
    });
    if (current.length) branches.push(current);

    branches.forEach(function (branch) {
      var noFutureAll = false;
      var future = {};
      var noFuture = {};
      var seen = {};

      branch.forEach(function (r) {
        var f = fieldById(r.field);
        var sig = r.field + "|" + r.values.slice().sort().join(",");
        if (seen[sig]) {
          problems.push(
            "The same “" + f.label + "” condition is listed twice."
          );
        }
        seen[sig] = true;

        if (r.field === "no-future-appts") noFutureAll = true;
        if (r.field === "future-appt") {
          r.values.forEach(function (v) { future[v] = true; });
        }
        if (r.field === "no-future-appt-type") {
          r.values.forEach(function (v) { noFuture[v] = true; });
        }
      });

      if (noFutureAll && Object.keys(future).length) {
        problems.push(
          "These rules require a patient to have no future appointments at all and " +
            "to have a future appointment. No patient can match both."
        );
      }
      Object.keys(future).forEach(function (t) {
        if (noFuture[t]) {
          problems.push(
            "These rules both require and exclude a future “" + t + "” appointment."
          );
        }
      });
    });

    return problems.filter(function (p, i) {
      return problems.indexOf(p) === i;
    });
  }

  /* ---------------------------------------------------------------- summary */

  function labelFor(vocab, code) {
    var list = VOCAB[vocab] || [];
    for (var i = 0; i < list.length; i++) {
      if ((list[i].code || list[i].label) === code) {
        return list[i].code ? list[i].code : list[i].label;
      }
    }
    return code;
  }

  function describeCondition(c) {
    var f = fieldById(c.field);
    var cls = f.negated ? "cb-t-not" : "";
    var head = '<span class="' + cls + '">' + f.verb + "</span>";

    if (!f.values) return head;
    if (!c.values.length) return head + ' <span class="cb-t-grp">(nothing selected)</span>';

    var vals = c.values
      .map(function (v) {
        return '<span class="cb-t-val">' + labelFor(f.values, v) + "</span>";
      })
      .join(' <span class="cb-t-op">or</span> ');
    return head + " " + vals;
  }

  function summaryHtml() {
    var lead =
      model.scope === "include"
        ? "Include patients who "
        : '<span class="cb-t-not">Exclude</span> patients who ';

    if (!model.rules.length) {
      return lead + '<span class="cb-t-grp">(no conditions yet)</span>.';
    }

    var text = model.rules
      .map(function (r, i) {
        var join =
          i === 0 ? "" : ' <span class="cb-t-op">' + r.op + "</span> ";
        return join + describeCondition(r);
      })
      .join("");

    return lead + text + ".";
  }

  /* -------------------------------------------------- estimated patient count */

  /* Deterministic stand-in for a server-side count, so the figure stays stable
     for a given rule set instead of jumping on every keystroke. */
  function estimate() {
    if (validate().length) return null;

    var n = 0;
    var anyOr = false;
    model.rules.forEach(function (r, i) {
      if (i > 0 && r.op === "OR") anyOr = true;
      var f = fieldById(r.field);
      var base = { "cpt-seen": 820, "icd-seen": 640, "future-appt": 410 }[r.field] || 0;
      if (r.field === "no-future-appts") base = 1500;
      if (r.field === "no-future-appt-type") base = 1180;
      n += base + (f.values ? r.values.length : 1) * 95;
    });

    // ANDing narrows the pool; any OR widens it.
    var count = Math.round((n * (anyOr ? 0.82 : 0.38)) / 10) * 10;
    if (model.scope === "exclude") count = Math.max(0, 16072 - count);
    return count;
  }

  /* ------------------------------------------------------------------ render */

  var host;
  var suppressOpen = false;

  function optionGroupsHtml(selectedId) {
    var groups = {};
    FIELDS.forEach(function (f) {
      (groups[f.group] = groups[f.group] || []).push(f);
    });
    return Object.keys(groups)
      .map(function (g) {
        return (
          '<optgroup label="' + g + '">' +
          groups[g]
            .map(function (f) {
              return (
                '<option value="' + f.id + '"' +
                (f.id === selectedId ? " selected" : "") +
                ">" + f.label + "</option>"
              );
            })
            .join("") +
          "</optgroup>"
        );
      })
      .join("");
  }

  function tokensHtml(c, f) {
    return c.values
      .map(function (v) {
        var item = null;
        (VOCAB[f.values] || []).forEach(function (x) {
          if ((x.code || x.label) === v) item = x;
        });
        var code = item && item.code ? "<code>" + item.code + "</code>" : "";
        var text = item ? item.label : v;
        return (
          '<span class="cb-ms-token">' + code +
          "<span>" + text + "</span>" +
          '<button type="button" data-untoken="' + encodeURIComponent(v) +
          '" data-node="' + c.id + '" title="Remove">&#10005;</button></span>'
        );
      })
      .join("");
  }

  function conditionHtml(c) {
    var f = fieldById(c.field);
    var valueCell;

    if (!f.values) {
      valueCell =
        '<div class="cb-ms"><div class="cb-ms-field is-empty" ' +
        'data-placeholder="No value needed for this condition" ' +
        'style="background:#f8f9fb;cursor:default"></div></div>';
    } else {
      valueCell =
        '<div class="cb-ms" data-ms="' + c.id + '" data-vocab="' + f.values + '">' +
        '<div class="cb-ms-field' + (c.values.length ? "" : " is-empty") + '" ' +
        'data-placeholder="Search ' + VOCAB_LABEL[f.values] + '">' +
        tokensHtml(c, f) +
        '<input class="cb-ms-input" type="text" autocomplete="off" ' +
        'data-node="' + c.id + '" />' +
        "</div>" +
        '<div class="cb-ms-menu" hidden></div>' +
        "</div>";
    }

    return (
      '<div class="cb-rule" data-rule="' + c.id + '">' +
      '<select data-field="' + c.id + '">' + optionGroupsHtml(c.field) + "</select>" +
      '<div style="font-size:13.5px;color:#8692a2;padding-top:9px">' +
      (f.values ? "any of" : "—") +
      "</div>" +
      valueCell +
      '<div class="cb-rule-tools">' +
      '<button type="button" class="cb-rule-del" data-del="' + c.id + '" ' +
      'title="Remove condition">&#10005;</button>' +
      "</div>" +
      "</div>"
    );
  }

  /* The operator between two conditions, switchable in place. */
  function joinerHtml(c) {
    return (
      '<div class="cb-joiner-row">' +
      '<span class="cb-logic cb-logic-sm" data-joiner="' + c.id + '">' +
      '<button type="button" data-setop="AND"' +
      (c.op === "AND" ? ' class="is-active"' : "") + ">AND</button>" +
      '<button type="button" data-setop="OR"' +
      (c.op === "OR" ? ' class="is-active"' : "") + ">OR</button>" +
      "</span>" +
      "</div>"
    );
  }

  function render() {
    var count = estimate();

    var rows = model.rules
      .map(function (r, i) {
        return (i > 0 ? joinerHtml(r) : "") + conditionHtml(r);
      })
      .join("");

    // The count belongs to whichever mode is active, so the other tab reads 0.
    var nInc = model.scope === "include" ? model.rules.length : 0;
    var nExc = model.scope === "exclude" ? model.rules.length : 0;

    host.innerHTML =
      '<div class="cb-tabs cb-scope-tabs">' +
      '<button type="button" class="cb-tab' +
      (model.scope === "include" ? " is-active" : "") +
      '" data-scope="include">' +
      '<span class="cb-tab-tick">&#10003;</span> Include (' + nInc + ")</button>" +
      '<button type="button" class="cb-tab' +
      (model.scope === "exclude" ? " is-active exclude" : "") +
      '" data-scope="exclude">&#10005; Exclude (' + nExc + ")</button>" +
      "</div>" +
      '<div class="cb-rule-list">' +
      '<div class="cb-group-bar"><span class="cb-group-name">PATIENTS WHERE</span></div>' +
      rows +
      '<div class="cb-add-row">' +
      '<button type="button" class="cb-add-btn primary" id="cb-addcond">' +
      "&#43; Add condition</button>" +
      "</div>" +
      "</div>";

    var sum = document.getElementById("cb-rule-summary");
    if (sum) sum.innerHTML = summaryHtml();

    // Keep the header figure in step with the rules on screen.
    var headerCount = document.querySelector(".cb-eligible b");
    if (headerCount) {
      headerCount.textContent = count === null ? "N/A" : count.toLocaleString("en-US");
    }

    // Hand the finished sentence and count to the review step.
    try {
      sessionStorage.setItem("cb-mixed-summary", summaryHtml());
      sessionStorage.setItem("cb-mixed-count", count === null ? "" : String(count));
    } catch (err) {
      /* storage unavailable (file:// in some browsers); summary just won't persist */
    }
  }

  /* ------------------------------------------------------------------ events */

  function openMenu(ms, query) {
    var vocab = ms.getAttribute("data-vocab");
    var nodeId = ms.getAttribute("data-ms");
    var node = findRule(nodeId);
    var menu = ms.querySelector(".cb-ms-menu");
    var q = (query || "").toLowerCase();

    var items = (VOCAB[vocab] || []).filter(function (it) {
      return ((it.code || "") + " " + it.label).toLowerCase().indexOf(q) > -1;
    });

    if (!items.length) {
      menu.innerHTML = '<div class="cb-ms-empty">No matches</div>';
    } else {
      menu.innerHTML = items
        .map(function (it) {
          var val = it.code || it.label;
          var on = node.values.indexOf(val) > -1;
          return (
            '<div class="cb-ms-opt' + (on ? " is-on" : "") + '" ' +
            'data-pick="' + encodeURIComponent(val) + '" data-node="' + nodeId + '">' +
            (it.code ? "<code>" + it.code + "</code>" : "") +
            '<span class="cb-ms-desc">' + it.label + "</span>" +
            (on ? '<span style="margin-left:auto;color:#f5871f">&#10003;</span>' : "") +
            "</div>"
          );
        })
        .join("");
    }
    menu.hidden = false;
  }

  function closeMenus() {
    Array.prototype.forEach.call(document.querySelectorAll(".cb-ms-menu"), function (m) {
      m.hidden = true;
    });
  }

  function onClick(e) {
    var t = e.target;

    var scope = t.closest("[data-scope]");
    if (scope) {
      model.scope = scope.getAttribute("data-scope");
      return render();
    }

    // Operator between this condition and the one above it.
    var setop = t.closest("[data-setop]");
    if (setop) {
      var jid = setop.closest("[data-joiner]").getAttribute("data-joiner");
      findRule(jid).op = setop.getAttribute("data-setop");
      return render();
    }

    if (t.closest("#cb-addcond")) {
      model.rules.push(newCondition("cpt-seen", "AND"));
      return render();
    }

    var del = t.closest("[data-del]");
    if (del) {
      var id = del.getAttribute("data-del");
      model.rules = model.rules.filter(function (r) { return r.id !== id; });
      return render();
    }

    var untoken = t.closest("[data-untoken]");
    if (untoken) {
      var nd = findRule(untoken.getAttribute("data-node"));
      var v = decodeURIComponent(untoken.getAttribute("data-untoken"));
      nd.values = nd.values.filter(function (x) { return x !== v; });
      return render();
    }

    var pick = t.closest("[data-pick]");
    if (pick) {
      var pid = pick.getAttribute("data-node");
      var pv = decodeURIComponent(pick.getAttribute("data-pick"));
      var pnode = findRule(pid);
      var at = pnode.values.indexOf(pv);
      if (at > -1) pnode.values.splice(at, 1);
      else pnode.values.push(pv);
      render();
      // Keep focus in the same field for consecutive picks, but leave the menu
      // closed so it never covers the rule below. Typing reopens it.
      var reopened = document.querySelector('[data-ms="' + pid + '"]');
      if (reopened) {
        var inp = reopened.querySelector(".cb-ms-input");
        if (inp) {
          suppressOpen = true;
          inp.focus();
          suppressOpen = false;
        }
      }
      return;
    }

    if (t.closest(".cb-ms-field")) {
      var ms = t.closest(".cb-ms");
      if (ms && ms.getAttribute("data-ms")) {
        var input = ms.querySelector(".cb-ms-input");
        if (input) input.focus();
      }
      return;
    }

    if (!t.closest(".cb-ms")) closeMenus();
  }

  function onChange(e) {
    var sel = e.target.closest("[data-field]");
    if (!sel) return;
    var node = findRule(sel.getAttribute("data-field"));
    var prev = fieldById(node.field);
    node.field = sel.value;
    var now = fieldById(node.field);
    // Values only carry over when the vocabulary is unchanged.
    if (prev.values !== now.values) node.values = [];
    render();
  }

  function onInput(e) {
    var input = e.target.closest(".cb-ms-input");
    if (!input) return;
    openMenu(input.closest(".cb-ms"), input.value);
  }

  function onFocusIn(e) {
    if (suppressOpen) return;
    var input = e.target.closest(".cb-ms-input");
    if (input) openMenu(input.closest(".cb-ms"), input.value);
  }

  /* Test hook: rebuild the rule list from a compact spec and re-render.
     Used by the automated checks; harmless in normal use. */
  window.__cbTest = {
    setModel: function (spec) {
      model.rules = (spec.rules || []).map(function (r) {
        var c = newCondition(r[0], r[2] || "AND");
        c.values = r[1] || [];
        return c;
      });
      if (spec.scope) model.scope = spec.scope;
      render();
    },
    getSummary: function () {
      return summaryHtml();
    },
    getProblems: function () {
      return validate();
    },
  };

  document.addEventListener("DOMContentLoaded", function () {
    host = document.getElementById("cb-rule-host");
    if (!host) return;
    document.addEventListener("click", onClick);
    document.addEventListener("change", onChange);
    document.addEventListener("input", onInput);
    document.addEventListener("focusin", onFocusIn);
    render();
  });
})();
