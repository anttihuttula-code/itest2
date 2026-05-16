(function () {
  "use strict";

  /** @typedef {'available'|'busy'|'on_trip'} DriverStatus */

  /**
   * @typedef {Object} Driver
   * @property {string} id
   * @property {string} name
   * @property {string} type
   * @property {number} rating
   * @property {number} distanceKm
   * @property {DriverStatus} status
   * @property {string[]} languages
   * @property {string} style
   * @property {string} vehicle
   * @property {boolean} [promoted]
   * @property {string} phone
   * @property {string} intro
   * @property {string} [photoEmoji]
   */

  /**
   * @typedef {Object} CallCenter
   * @property {string} id
   * @property {string} name
   * @property {string} availability
   * @property {string[]} languages
   * @property {string} phone
   * @property {boolean} [phoneBooking]
   */

  const drivers = [
    {
      id: "drv_1",
      name: "Mikko",
      type: "Independent Driver",
      rating: 4.8,
      distanceKm: 1.2,
      status: "available",
      languages: ["Finnish", "English"],
      style: "Calm ride",
      vehicle: "Sedan",
      promoted: true,
      phone: "+358401234567",
      intro: "I drive calmly and specialize in airport rides.",
      photoEmoji: "🚕",
    },
    {
      id: "drv_2",
      name: "Liisa",
      type: "Independent Driver",
      rating: 4.5,
      distanceKm: 2.0,
      status: "available",
      languages: ["Finnish", "English", "Swedish"],
      style: "Airport runs",
      vehicle: "Estate",
      promoted: false,
      phone: "+358409001100",
      intro: "Card preferred; quiet cabin on request.",
      photoEmoji: "🚙",
    },
    {
      id: "drv_3",
      name: "Matias",
      type: "Independent Driver",
      rating: 4.6,
      distanceKm: 2.9,
      status: "busy",
      languages: ["Finnish", "English"],
      style: "Direct hires",
      vehicle: "Sedan",
      promoted: false,
      phone: "+358407777721",
      intro: "Short notice when available — text if I am driving.",
      photoEmoji: "🚕",
    },
    {
      id: "drv_4",
      name: "Juuso",
      type: "Independent Driver",
      rating: 4.3,
      distanceKm: 4.2,
      status: "on_trip",
      languages: ["Finnish", "English"],
      style: "Night shifts",
      vehicle: "Sedan",
      promoted: false,
      phone: "+358408004420",
      intro: "Night-time visibility in the app when on shift.",
      photoEmoji: "🌙",
    },
  ];

  const callCenters = [
    {
      id: "cc_1",
      name: "Turku Taksi",
      availability: "24/7",
      languages: ["Finnish", "English"],
      phone: "+35820000000",
      phoneBooking: true,
    },
    {
      id: "cc_2",
      name: "Helsinki Taxi Booking",
      availability: "24/7",
      languages: ["Finnish", "Swedish", "English"],
      phone: "+35810055555",
      phoneBooking: true,
    },
  ];

  const taxiCompanies = [
    {
      id: "co_1",
      name: "Cityline Cooperative",
      availability: "Mon–Sun",
      languages: ["Finnish", "English"],
      phone: "+358401232211",
      phoneBooking: true,
    },
    {
      id: "co_2",
      name: "Harbor Rank Stand",
      availability: "Peak hours",
      languages: ["Finnish", "English"],
      phone: "+358402221199",
      phoneBooking: false,
    },
  ];

  var STATUS_META = {
    available: { emoji: "🟢", label: "Available", cls: "text-emerald-400" },
    busy: { emoji: "🟡", label: "Busy", cls: "text-amber-300" },
    on_trip: { emoji: "🔴", label: "On trip", cls: "text-rose-400/90" },
  };

  var FAV_KEY = "taxiRadar_favorites_v2";
  var SHARE_FALLBACK =
    "Taxi Radar — see nearby drivers and call centers in your area. ";

  var state = {
    areaLabel: "Helsinki center (sample)",
    radiusKm: 2.5,
    workingDrivers: [],
    forceEmpty: false,
    modalDriverId: null,
  };

  var el = {
    areaLabel: document.getElementById("areaLabel"),
    countDrivers: document.getElementById("countDrivers"),
    countOperators: document.getElementById("countOperators"),
    geoNotice: document.getElementById("geoNotice"),
    recommended: document.getElementById("recommended"),
    emptyDrivers: document.getElementById("emptyDrivers"),
    allNearbyDrivers: document.getElementById("allNearbyDrivers"),
    companiesList: document.getElementById("companiesList"),
    btnLocate: document.getElementById("btnLocate"),
    btnSearchArea: document.getElementById("btnSearchArea"),
    searchPanel: document.getElementById("searchPanel"),
    searchInput: document.getElementById("searchInput"),
    searchApply: document.getElementById("searchApply"),
    searchCancel: document.getElementById("searchCancel"),
    btnShowCallCenters: document.getElementById("btnShowCallCenters"),
    btnExpandRadius: document.getElementById("btnExpandRadius"),
    btnShare: document.getElementById("btnShare"),
    loadingOverlay: document.getElementById("loadingOverlay"),
    driverModal: document.getElementById("driverModal"),
    driverModalBody: document.getElementById("driverModalBody"),
    toast: document.getElementById("toast"),
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function cloneDrivers() {
    return drivers.map(function (d) {
      return Object.assign({}, d, { languages: d.languages.slice() });
    });
  }

  function getFavoriteIds() {
    try {
      var raw = localStorage.getItem(FAV_KEY);
      var a = raw ? JSON.parse(raw) : [];
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }

  function isFavorite(id) {
    return getFavoriteIds().indexOf(id) !== -1;
  }

  function setFavorite(id, on) {
    var cur = getFavoriteIds().filter(function (x) {
      return x !== id;
    });
    if (on) cur.push(id);
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(cur));
    } catch (e) {}
  }

  function toggleFavorite(id) {
    setFavorite(id, !isFavorite(id));
    render();
    if (state.modalDriverId === id) renderModalBody();
  }

  function formatLangs(arr) {
    return arr.join(" / ");
  }

  function formatDistance(km) {
    if (km < 1) return Math.round(km * 1000) + " m";
    return km.toFixed(1) + " km";
  }

  function formatRating(r) {
    return (Math.round(r * 10) / 10).toFixed(1);
  }

  function visibleDrivers() {
    if (state.forceEmpty) return [];
    return state.workingDrivers.filter(function (d) {
      return d.distanceKm <= state.radiusKm;
    });
  }

  function operatorsMerged() {
    return taxiCompanies.concat(callCenters);
  }

  function showLoading(ms, done) {
    el.loadingOverlay.classList.remove("hidden");
    el.loadingOverlay.classList.add("flex", "flex-col");
    el.loadingOverlay.setAttribute("aria-hidden", "false");
    window.setTimeout(function () {
      el.loadingOverlay.classList.add("hidden");
      el.loadingOverlay.classList.remove("flex", "flex-col");
      el.loadingOverlay.setAttribute("aria-hidden", "true");
      if (done) done();
    }, ms);
  }

  function showToast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.remove("hidden");
    window.clearTimeout(showToast._t);
    showToast._t = window.setTimeout(function () {
      el.toast.classList.add("hidden");
    }, 3200);
  }

  function copyShareFallback(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          showToast("Link copied — paste to share.");
        },
        function () {
          window.prompt("Copy to share:", text);
        }
      );
    } else {
      window.prompt("Copy to share:", text);
    }
  }

  function getRecommendedDrivers() {
    var v = visibleDrivers().slice();
    v.sort(function (a, b) {
      var ap = a.promoted ? 1 : 0;
      var bp = b.promoted ? 1 : 0;
      if (ap !== bp) return bp - ap;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return a.distanceKm - b.distanceKm;
    });
    return v.slice(0, 3);
  }

  function renderRecommended() {
    el.recommended.replaceChildren();
    var picks = getRecommendedDrivers();
    if (picks.length === 0) {
      var p = document.createElement("p");
      p.className = "rounded-2xl border border-dashed border-zinc-800 bg-zinc-900 px-4 py-6 text-center text-xs text-zinc-500";
      p.textContent = "No drivers in the current radius — expand the area or browse call centers below.";
      el.recommended.appendChild(p);
      return;
    }
    picks.forEach(function (d) {
      var art = document.createElement("article");
      art.className =
        "rounded-2xl border border-zinc-800 bg-zinc-900 p-4 " +
        (d.promoted ? "ring-1 ring-amber-500/35" : "");
      var st = STATUS_META[d.status] || STATUS_META.available;
      var prom =
        d.promoted &&
        '<div class="mt-2 inline-flex items-center gap-1 rounded-lg border border-amber-500/50 bg-amber-950/40 px-2 py-1 text-[0.65rem] font-semibold text-amber-200" title="Paid placement — visibility in this row is sponsored.">' +
        '<span aria-hidden="true">🚀</span> Promoted</div>';
      art.innerHTML =
        '<div class="flex gap-3">' +
        '<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-950 text-2xl" aria-hidden="true">' +
        escapeHtml(d.photoEmoji || "🚕") +
        "</div>" +
        '<div class="min-w-0 flex-1">' +
        '<h3 class="truncate text-base font-semibold text-zinc-50">' +
        escapeHtml(d.name) +
        "</h3>" +
        '<p class="mt-0.5 text-xs text-zinc-500">' +
        escapeHtml(d.type) +
        "</p>" +
        '<p class="mt-2 text-sm text-zinc-200"><span aria-hidden="true">⭐</span> <span class="font-semibold tabular-nums">' +
        escapeHtml(formatRating(d.rating)) +
        '</span> <span class="text-zinc-600">·</span> <span class="tabular-nums text-zinc-400">' +
        escapeHtml(formatDistance(d.distanceKm)) +
        "</span></p>" +
        '<p class="mt-1 text-xs text-zinc-500"><span class="' +
        st.cls +
        '">' +
        escapeHtml(st.emoji + " " + st.label) +
        "</span> · " +
        escapeHtml(d.style) +
        " · " +
        escapeHtml(formatLangs(d.languages)) +
        "</p>" +
        (prom || "") +
        "</div></div>" +
        '<div class="mt-4 flex gap-2 border-t border-zinc-800 pt-3">' +
        '<a href="tel:' +
        escapeHtml(d.phone) +
        '" class="touch-btn inline-flex flex-1 min-w-0 items-center justify-center rounded-xl bg-zinc-100 py-3 text-sm font-semibold text-zinc-900 hover:bg-white">Call</a>' +
        '<button type="button" data-open-driver="' +
        escapeHtml(d.id) +
        '" class="touch-btn inline-flex flex-1 min-w-0 items-center justify-center rounded-xl border border-zinc-600 bg-zinc-800 py-3 text-sm font-semibold text-zinc-100 hover:bg-zinc-800/90">View</button>' +
        "</div>";
      el.recommended.appendChild(art);
    });
  }

  function renderDriverRows() {
    el.allNearbyDrivers.replaceChildren();
    var list = visibleDrivers().slice();
    list.sort(function (a, b) {
      return a.distanceKm - b.distanceKm;
    });
    if (list.length === 0) {
      el.emptyDrivers.classList.remove("hidden");
      return;
    }
    el.emptyDrivers.classList.add("hidden");
    list.forEach(function (d) {
      var st = STATUS_META[d.status] || STATUS_META.available;
      var fav = isFavorite(d.id);
      var row = document.createElement("div");
      row.className =
        "flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5";
      row.setAttribute("role", "group");
      row.setAttribute(
        "aria-label",
        d.name + ", " + st.label + ", " + formatDistance(d.distanceKm)
      );
      row.innerHTML =
        '<div class="min-w-0 flex-1">' +
        '<p class="truncate text-sm font-medium text-zinc-100">' +
        escapeHtml(d.name) +
        "</p>" +
        '<p class="mt-0.5 truncate text-[0.7rem] text-zinc-500" aria-hidden="true">' +
        '<span class="' +
        st.cls +
        '">' +
        escapeHtml(st.emoji + " " + st.label) +
        "</span> · " +
        escapeHtml(formatDistance(d.distanceKm)) +
        "</p></div>" +
        '<div class="flex shrink-0 items-center gap-1.5">' +
        '<a href="tel:' +
        escapeHtml(d.phone) +
        '" class="touch-btn rounded-lg bg-zinc-100 px-3 py-2 text-xs font-semibold text-zinc-900 hover:bg-white">Call</a>' +
        '<button type="button" data-open-driver="' +
        escapeHtml(d.id) +
        '" class="touch-btn rounded-lg border border-zinc-600 px-2.5 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-800">View</button>' +
        '<button type="button" data-fav-driver="' +
        escapeHtml(d.id) +
        '" class="touch-btn flex h-9 w-9 items-center justify-center rounded-lg border text-lg ' +
        (fav
          ? "border-rose-500/50 bg-rose-950/30 text-rose-300"
          : "border-zinc-600 bg-zinc-950 text-zinc-500") +
        '" aria-pressed="' +
        (fav ? "true" : "false") +
        '" aria-label="' +
        escapeHtml(fav ? "Remove favorite" : "Add favorite") +
        '"><span aria-hidden="true">' +
        (fav ? "♥" : "♡") +
        "</span></button></div>";
      el.allNearbyDrivers.appendChild(row);
    });
  }

  function renderCompanies() {
    el.companiesList.replaceChildren();
    operatorsMerged().forEach(function (op) {
      var card = document.createElement("article");
      card.className = "rounded-2xl border border-zinc-800 bg-zinc-900 p-4";
      var booking =
        op.phoneBooking !== false
          ? '<p class="mt-2 flex items-center gap-2 text-xs text-zinc-400"><span aria-hidden="true">📞</span> Phone booking available</p>'
          : '<p class="mt-2 text-xs text-zinc-500">Walk-up / rank — phone optional.</p>';
      card.innerHTML =
        '<h3 class="text-base font-semibold text-zinc-50">' +
        escapeHtml(op.name) +
        "</h3>" +
        '<p class="mt-1 text-sm text-zinc-400">' +
        escapeHtml(op.availability + " · " + formatLangs(op.languages)) +
        "</p>" +
        booking +
        '<a href="tel:' +
        escapeHtml(op.phone) +
        '" class="touch-btn mt-4 inline-flex w-full items-center justify-center rounded-xl bg-zinc-100 py-3.5 text-sm font-semibold text-zinc-900 hover:bg-white">Call</a>';
      el.companiesList.appendChild(card);
    });
  }

  function findDriver(id) {
    for (var i = 0; i < state.workingDrivers.length; i++) {
      if (state.workingDrivers[i].id === id) return state.workingDrivers[i];
    }
    return null;
  }

  function openDriverModal(id) {
    state.modalDriverId = id;
    el.driverModal.classList.remove("hidden");
    el.driverModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("overflow-hidden");
    renderModalBody();
  }

  function closeDriverModal() {
    state.modalDriverId = null;
    el.driverModal.classList.add("hidden");
    el.driverModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("overflow-hidden");
    el.driverModalBody.replaceChildren();
  }

  function renderModalBody() {
    var d = state.modalDriverId ? findDriver(state.modalDriverId) : null;
    el.driverModalBody.replaceChildren();
    if (!d) return;
    var st = STATUS_META[d.status] || STATUS_META.available;
    var fav = isFavorite(d.id);
    var prom =
      d.promoted &&
      '<div class="mb-3 inline-flex items-center gap-1 rounded-lg border border-amber-500/50 bg-amber-950/40 px-2.5 py-1.5 text-xs font-semibold text-amber-200" title="Paid placement in the recommended row.">🚀 Promoted</div>';
    el.driverModalBody.innerHTML =
      '<div class="flex flex-col items-center text-center">' +
      '<div class="flex h-20 w-20 items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-950 text-4xl" aria-hidden="true">' +
      escapeHtml(d.photoEmoji || "🚕") +
      "</div>" +
      '<h2 id="driverModalTitle" class="mt-4 text-xl font-semibold text-zinc-50">' +
      escapeHtml(d.name) +
      "</h2>" +
      '<p class="mt-1 text-sm text-zinc-400"><span aria-hidden="true">⭐</span> ' +
      escapeHtml(formatRating(d.rating)) +
      "</p>" +
      '<p class="mt-3 text-sm text-zinc-300">' +
      escapeHtml(d.vehicle) +
      " · " +
      escapeHtml(formatLangs(d.languages)) +
      "</p>" +
      '<p class="mt-1 text-xs ' +
      st.cls +
      '">' +
      escapeHtml(st.emoji + " " + st.label + " · " + formatDistance(d.distanceKm)) +
      "</p>" +
      (prom || "") +
      '<p class="mt-5 max-w-sm text-left text-sm leading-relaxed text-zinc-400">“' +
      escapeHtml(d.intro) +
      '”</p></div>' +
      '<div class="mt-6 flex flex-col gap-2">' +
      '<a href="tel:' +
      escapeHtml(d.phone) +
      '" class="touch-btn flex w-full items-center justify-center rounded-2xl bg-zinc-100 py-3.5 text-sm font-semibold text-zinc-900 hover:bg-white">Call ' +
      escapeHtml(d.name) +
      "</a>" +
      '<button type="button" id="modalFavBtn" class="touch-btn w-full rounded-2xl border border-zinc-600 bg-zinc-800 py-3.5 text-sm font-semibold text-zinc-100 hover:bg-zinc-800/90">' +
      escapeHtml(fav ? "Remove from favorites" : "Save as favorite") +
      "</button></div>";

    var fb = document.getElementById("modalFavBtn");
    if (fb) {
      fb.addEventListener("click", function () {
        toggleFavorite(d.id);
      });
    }
  }

  function updateCounts() {
    el.areaLabel.textContent = state.areaLabel;
    el.countDrivers.textContent = String(visibleDrivers().length);
    el.countOperators.textContent = String(operatorsMerged().length);
  }

  function render() {
    updateCounts();
    renderRecommended();
    renderDriverRows();
    renderCompanies();
  }

  function initFromUrl() {
    if (window.location.search.indexOf("empty=1") !== -1) {
      state.forceEmpty = true;
      state.radiusKm = 0.5;
    }
  }

  function bind() {
    el.recommended.addEventListener("click", onDelegatedClick);
    el.allNearbyDrivers.addEventListener("click", onDelegatedClick);
    el.driverModal.addEventListener("click", function (ev) {
      if (ev.target && ev.target.closest("[data-close-modal]")) closeDriverModal();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !el.driverModal.classList.contains("hidden")) closeDriverModal();
    });

    el.btnLocate.addEventListener("click", function () {
      if (!navigator.geolocation) {
        el.geNotice.classList.remove("hidden");
        el.geNotice.textContent = "Location not available in this browser. Sample listings stay visible.";
        return;
      }
      el.btnLocate.disabled = true;
      el.btnLocate.textContent = "Locating…";
      navigator.geolocation.getCurrentPosition(
        function () {
          showLoading(1200, function () {
            state.areaLabel = "Near you (sample grid)";
            state.workingDrivers = cloneDrivers();
            state.forceEmpty = false;
            el.geNotice.classList.remove("hidden");
            el.geNotice.textContent =
              "Using a rough position label. Listings remain sample data — swap in your registry feed.";
            el.btnLocate.disabled = false;
            el.btnLocate.textContent = "Use my location";
            render();
          });
        },
        function () {
          el.btnLocate.disabled = false;
          el.btnLocate.textContent = "Use my location";
          el.geNotice.classList.remove("hidden");
          el.geNotice.textContent = "Location not shared. Sample listings stay visible.";
        },
        { enableHighAccuracy: false, maximumAge: 120000, timeout: 15000 }
      );
    });

    el.btnSearchArea.addEventListener("click", function () {
      el.searchPanel.classList.remove("hidden");
      el.searchInput.focus();
    });
    el.searchCancel.addEventListener("click", function () {
      el.searchPanel.classList.add("hidden");
    });
    el.searchApply.addEventListener("click", function () {
      var v = el.searchInput.value.trim();
      if (v) state.areaLabel = v;
      el.searchPanel.classList.add("hidden");
      el.geNotice.classList.add("hidden");
      render();
    });

    el.btnShowCallCenters.addEventListener("click", function () {
      document.getElementById("taxi-companies-heading").scrollIntoView({ behavior: "smooth", block: "start" });
    });
    el.btnExpandRadius.addEventListener("click", function () {
      state.forceEmpty = false;
      state.radiusKm = Math.max(state.radiusKm, 25);
      render();
    });

    el.btnShare.addEventListener("click", function () {
      var url = window.location.href;
      var text = SHARE_FALLBACK + url;
      if (navigator.share) {
        navigator
          .share({
            title: "Taxi Radar",
            text: "See nearby drivers and call centers on Taxi Radar.",
            url: url,
          })
          .then(function () {})
          .catch(function (e) {
            if (e && e.name === "AbortError") return;
            copyShareFallback(text);
          });
        return;
      }
      copyShareFallback(text);
    });
  }

  function onDelegatedClick(ev) {
    var open = ev.target && ev.target.closest("[data-open-driver]");
    if (open) {
      var id = open.getAttribute("data-open-driver");
      if (id) openDriverModal(id);
      return;
    }
    var fav = ev.target && ev.target.closest("[data-fav-driver]");
    if (fav) {
      var fid = fav.getAttribute("data-fav-driver");
      if (fid) toggleFavorite(fid);
    }
  }

  function bootstrap() {
    initFromUrl();
    state.workingDrivers = cloneDrivers();
    bind();
    render();
  }

  bootstrap();
})();
