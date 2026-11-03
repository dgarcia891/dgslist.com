(function () {
  "use strict";

  var state = { data: null, cat: "all", q: "" };
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Tiny, safe markdown: paragraphs, line breaks, **bold**, *italic*, [text](url), bare URLs.
  function md(text) {
    var safe = esc(text || "");
    safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    safe = safe.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    return safe.split(/\n{2,}/).map(function (p) { return "<p>" + p.replace(/\n/g, "<br>") + "</p>"; }).join("");
  }

  function host(url) {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch (e) { return ""; }
  }

  function catOf(id) {
    return state.data.categories.find(function (c) { return c.id === id; }) || { name: "", emoji: "★" };
  }

  function mediaHTML(item, cls) {
    var c = catOf(item.category);
    var inner = item.image
      ? '<img src="' + esc(item.image) + '" alt="" loading="lazy">'
      : '<span class="emoji" aria-hidden="true">' + esc(c.emoji) + "</span>";
    return inner;
  }

  function matches(item) {
    if (state.cat !== "all" && item.category !== state.cat) return false;
    if (!state.q) return true;
    var hay = [item.title, item.blurb, item.note, (item.tags || []).join(" "), catOf(item.category).name].join(" ").toLowerCase();
    return state.q.split(/\s+/).every(function (w) { return hay.indexOf(w) !== -1; });
  }

  function renderTabs() {
    var items = state.data.items;
    var tabs = [{ id: "all", name: "Everything", emoji: "" }].concat(state.data.categories);
    $("tabs").innerHTML = tabs.map(function (t) {
      var n = t.id === "all" ? items.length : items.filter(function (i) { return i.category === t.id; }).length;
      return '<button class="tab" type="button" data-cat="' + esc(t.id) + '" aria-pressed="' + (state.cat === t.id) + '">' +
        (t.emoji ? esc(t.emoji) + " " : "") + esc(t.name) + '<span class="n">' + n + "</span></button>";
    }).join("");
  }

  function renderGrid() {
    var list = state.data.items.filter(matches);
    $("grid").innerHTML = list.map(function (item) {
      var c = catOf(item.category);
      return '<button class="card" type="button" data-id="' + esc(item.id) + '">' +
        '<div class="media">' + mediaHTML(item) + (item.top ? '<span class="badge">★ Top pick</span>' : "") + "</div>" +
        '<div class="card-body">' +
          '<p class="cat">' + esc(c.emoji) + " " + esc(c.name) + "</p>" +
          "<h3>" + esc(item.title) + "</h3>" +
          (item.blurb ? '<p class="blurb">' + esc(item.blurb) + "</p>" : "") +
          ((item.tags || []).length ? '<div class="tags">' + item.tags.map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("") + "</div>" : "") +
        "</div></button>";
    }).join("");
    $("empty").hidden = list.length > 0;
    $("count").textContent = list.length === 1 ? "1 recommendation" : list.length + " recommendations";
  }

  function render() { renderTabs(); renderGrid(); }

  function openItem(id, push) {
    var item = state.data.items.find(function (i) { return i.id === id; });
    if (!item) return;
    var c = catOf(item.category);
    $("d-media").innerHTML = mediaHTML(item);
    $("d-cat").textContent = c.emoji + " " + c.name + (item.top ? "  ·  ★ Top pick" : "");
    $("d-title").textContent = item.title;
    $("d-note").innerHTML = md(item.note || item.blurb);
    $("d-tags").innerHTML = (item.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + "</span>"; }).join("");
    var link = $("d-link");
    if (item.link) {
      link.hidden = false;
      link.href = item.link;
      link.textContent = (item.linkLabel || ("Open " + host(item.link))) + " ↗";
    } else {
      link.hidden = true;
    }
    $("d-share").textContent = "Copy link to share";
    $("d-share").dataset.id = item.id;
    if (push) history.replaceState(null, "", "#" + encodeURIComponent(item.id));
    var dlg = $("detail");
    if (!dlg.open) dlg.showModal();
  }

  function closeItem() {
    var dlg = $("detail");
    if (dlg.open) dlg.close();
  }

  function bind() {
    $("tabs").addEventListener("click", function (e) {
      var b = e.target.closest(".tab");
      if (!b) return;
      state.cat = b.dataset.cat;
      render();
    });
    $("q").addEventListener("input", function (e) {
      state.q = e.target.value.trim().toLowerCase();
      renderGrid();
    });
    $("grid").addEventListener("click", function (e) {
      var card = e.target.closest(".card");
      if (card) openItem(card.dataset.id, true);
    });
    var dlg = $("detail");
    dlg.addEventListener("click", function (e) {
      if (e.target === dlg || e.target.hasAttribute("data-close")) closeItem();
    });
    dlg.addEventListener("close", function () {
      if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    });
    $("d-share").addEventListener("click", function () {
      var btn = this;
      var url = location.origin + location.pathname + "#" + encodeURIComponent(btn.dataset.id);
      var done = function () { btn.textContent = "Link copied ✓"; };
      if (navigator.share && matchMedia("(max-width: 700px)").matches) {
        navigator.share({ title: $("d-title").textContent, url: url }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(done, function () { prompt("Copy this link:", url); });
      } else {
        prompt("Copy this link:", url);
      }
    });
    window.addEventListener("hashchange", function () {
      var id = decodeURIComponent(location.hash.slice(1));
      if (id) openItem(id, false); else closeItem();
    });
  }

  function start(data) {
    state.data = data;
    $("sample-banner").hidden = !data.sample;
    if (data.updated) {
      var d = new Date(data.updated);
      $("updated").textContent = "Last updated " + d.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }) + ". Questions? Just ask me.";
    }
    if (data.disclosure) { $("disclosure").hidden = false; $("disclosure").textContent = data.disclosure; }
    bind();
    render();
    var id = decodeURIComponent(location.hash.slice(1));
    if (id) openItem(id, false);
  }

  fetch("data/recs.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(start)
    .catch(function () {
      $("grid").innerHTML = "";
      $("empty").hidden = false;
      $("empty").textContent = "Couldn't load the list right now. Try refreshing in a minute.";
    });
})();
