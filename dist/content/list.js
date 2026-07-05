"use strict";
(() => {
  // src/content-scripts/parsers/parserRouter.ts
  function detectSite(url) {
    try {
      const host = new URL(url).hostname;
      if (/(^|\.)wantedly\.com$/.test(host)) return "wantedly";
      if (/(^|\.)onecareer\.jp$/.test(host)) return "onecareer";
      if (/(^|\.)(openwork\.jp|vorkers\.com)$/.test(host)) return "openwork";
      if (/(^|\.)offerbox\.jp$/.test(host)) return "offerbox";
      if (/(^|\.)mynavi\./.test(host)) return "mynavi";
    } catch {
    }
    return "unknown";
  }
  function isListSource(site) {
    return site === "wantedly" || site === "onecareer" || site === "mynavi";
  }

  // src/content-scripts/parsers/wantedlyListParser.ts
  var CARD_SELECTORS = [
    "section.projects-index-single",
    // 一番安定している素のクラス
    "section[class*='ProjectListJobPostItem__Base']",
    "[class*='ProjectListJobPostsMobile__ProjectListItem'] section"
  ];
  var TITLE_SELECTORS = [
    "[class*='ProjectListJobPostItem__TitleText']",
    // Mobile/Desktop両対応の部分一致
    "h2"
  ];
  var COMPANY_SELECTORS = [
    "[class*='CompanyNameText']",
    // JobPostCompanyWithWorkingConnectedUser__CompanyNameText
    "a[href^='/companies/']"
  ];
  var DESC_SELECTORS = ["[class*='ProjectListJobPostItem__DescriptionText']"];
  var LINK_SELECTORS = [
    "a[class*='ProjectListJobPostItem__ProjectLink']",
    "a[href^='/projects/']"
  ];
  function pickText(root, selectors) {
    for (const sel of selectors) {
      const t = root.querySelector(sel)?.textContent?.trim();
      if (t) return t;
    }
    return "";
  }
  function pickHref(root, selectors) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el?.href) return el.href;
      const rel = el?.getAttribute("href");
      if (rel) return new URL(rel, location.origin).toString();
    }
    return "";
  }
  function parseWantedlyList(doc = document) {
    let nodes = [];
    for (const sel of CARD_SELECTORS) {
      nodes = Array.from(doc.querySelectorAll(sel));
      if (nodes.length > 0) break;
    }
    const cards = [];
    for (const node of nodes) {
      const jobTitle = pickText(node, TITLE_SELECTORS);
      const detailUrl = pickHref(node, LINK_SELECTORS);
      if (!jobTitle || !detailUrl) continue;
      const tags = Array.from(node.querySelectorAll("[class*='FeatureTagList__TagLabel']")).map((el) => el.textContent?.trim() ?? "").filter(Boolean).join(" / ");
      const desc = pickText(node, DESC_SELECTORS);
      cards.push({
        jobTitle,
        detailUrl,
        companyName: pickText(node, COMPANY_SELECTORS) || "\uFF08\u4F01\u696D\u540D\u4E0D\u660E\uFF09",
        location: "",
        // Wantedly一覧カードには勤務地表記がない（詳細取得時に補完される）
        salary: "",
        // Wantedlyは給与非掲載ポリシー
        snippet: `${tags} ${desc} ${(node.textContent ?? "").replace(/\s+/g, " ")}`.trim().slice(0, 1200)
      });
    }
    return cards;
  }

  // src/content-scripts/parsers/onecareerListParser.ts
  var CARD_SELECTORS2 = [".company-list__content", ".company-list__list-item"];
  function cleanUrl(href) {
    try {
      const u = new URL(href, location.origin);
      return `${u.origin}${u.pathname}`;
    } catch {
      return href;
    }
  }
  function resolveCompanyUrl(card) {
    const anchor = card.querySelector("a[href*='/companies/']") ?? card.closest("a[href*='/companies/']");
    if (anchor) {
      const href = anchor.href || anchor.getAttribute("href") || "";
      if (href) return cleanUrl(href);
    }
    const logo = card.querySelector("img[src*='square_logo']");
    const id = logo?.getAttribute("src")?.match(/square_logo\/(\d+)\//)?.[1];
    if (id) return `https://www.onecareer.jp/companies/${id}`;
    return "";
  }
  function parseOnecareerList(doc = document) {
    let nodes = [];
    for (const sel of CARD_SELECTORS2) {
      nodes = Array.from(doc.querySelectorAll(sel));
      nodes = nodes.filter((n) => n.querySelector("h3"));
      if (nodes.length > 0) break;
    }
    const cards = [];
    const seen = /* @__PURE__ */ new Set();
    for (const node of nodes) {
      const name = node.querySelector("h3.oc-heading, h3[role='heading'], h3")?.textContent?.trim() ?? "";
      const detailUrl = resolveCompanyUrl(node);
      if (!name || !detailUrl || seen.has(detailUrl)) continue;
      seen.add(detailUrl);
      const category = node.querySelector(".company-list__category, label[class*='oc-label']")?.textContent?.trim() ?? "";
      const rating = node.querySelector(".company-list__rating")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      cards.push({
        companyName: name,
        jobTitle: name,
        // 企業一覧のため職種は無い。企業名をタイトル扱いにする
        location: "",
        salary: "",
        detailUrl,
        snippet: `${category} \u8A55\u4FA1${rating} ${(node.textContent ?? "").replace(/\s+/g, " ")}`.trim().slice(0, 1e3)
      });
    }
    if (cards.length === 0) {
      for (const a of Array.from(doc.querySelectorAll("a[href*='/companies/']"))) {
        const url = cleanUrl(a.href || a.getAttribute("href") || "");
        const block = a.closest("li,article,div");
        const name = block?.querySelector("h3")?.textContent?.trim() || a.textContent?.trim() || "";
        if (!name || name.length < 2 || !url || seen.has(url)) continue;
        seen.add(url);
        cards.push({
          companyName: name,
          jobTitle: name,
          location: "",
          salary: "",
          detailUrl: url,
          snippet: (block?.textContent ?? name).replace(/\s+/g, " ").slice(0, 1e3)
        });
      }
    }
    return cards;
  }

  // src/content-scripts/parsers/mynaviListParser.ts
  var KNOWN_SETS = [
    {
      // マイナビ転職
      card: ".recruit",
      title: [".occName", "h3 a", ".recruit__name a"],
      company: [".companyName", ".recruit__company"],
      location: [".tableCondition .place", ".jobPointArea"],
      salary: [".tableCondition .salary"],
      link: ["h3 a", ".occName a", "a.js__linkArea"]
    },
    {
      // マイナビ新卒（20XX）
      card: ".boxSearchresultEach, .js-add-examination-list-header",
      title: [".heading3 a", "h3 a"],
      company: [".heading3 a", ".corpNameLink"],
      location: [".addressArea", ".area"],
      salary: [".salary"],
      link: [".heading3 a", "h3 a"]
    }
  ];
  function pickText2(root, selectors) {
    for (const sel of selectors) {
      const t = root.querySelector(sel)?.textContent?.trim();
      if (t) return t;
    }
    return "";
  }
  function pickHref2(root, selectors) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      if (el?.href) return el.href;
      const rel = el?.getAttribute("href");
      if (rel) return new URL(rel, location.origin).toString();
    }
    return "";
  }
  function heuristicParse(doc) {
    const anchors = Array.from(
      doc.querySelectorAll("a[href*='/jobinfo'], a[href*='corpInfo'], a[href*='/shukatsu/corp']")
    );
    const cards = [];
    const seen = /* @__PURE__ */ new Set();
    for (const a of anchors) {
      const url = a.href;
      const title = a.textContent?.trim() ?? "";
      if (!url || !title || title.length < 2 || seen.has(url)) continue;
      seen.add(url);
      const block = a.closest("li, article, section, div");
      const snippet = (block?.textContent ?? title).replace(/\s+/g, " ").trim().slice(0, 1e3);
      cards.push({
        companyName: title,
        jobTitle: title,
        location: "",
        salary: "",
        detailUrl: url,
        snippet
      });
    }
    return cards;
  }
  function parseMynaviList(doc = document) {
    for (const set of KNOWN_SETS) {
      const nodes = Array.from(doc.querySelectorAll(set.card));
      if (nodes.length === 0) continue;
      const cards = [];
      for (const node of nodes) {
        const detailUrl = pickHref2(node, set.link);
        const jobTitle = pickText2(node, set.title);
        if (!detailUrl || !jobTitle) continue;
        cards.push({
          jobTitle,
          detailUrl,
          companyName: pickText2(node, set.company) || jobTitle,
          location: pickText2(node, set.location),
          salary: pickText2(node, set.salary),
          snippet: (node.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 1e3)
        });
      }
      if (cards.length > 0) return cards;
    }
    return heuristicParse(doc);
  }

  // src/content-scripts/capture/captureController.ts
  function sendResult(msg) {
    try {
      chrome.runtime.sendMessage(msg);
    } catch {
    }
  }

  // src/content-scripts/entryList.ts
  (() => {
    try {
      const site = detectSite(location.href);
      let cards = [];
      if (site === "wantedly") cards = parseWantedlyList();
      else if (site === "onecareer") cards = parseOnecareerList();
      else if (site === "mynavi") cards = parseMynaviList();
      sendResult({
        type: "CS_LIST_RESULT",
        ok: cards.length > 0,
        cards,
        url: location.href,
        error: cards.length > 0 ? void 0 : !isListSource(site) ? "\u3053\u306E\u30DA\u30FC\u30B8\u306F\u4E00\u89A7\u306E\u8D77\u70B9\u306B\u3067\u304D\u307E\u305B\u3093\u3002Wantedly\u306E\u52DF\u96C6\u4E00\u89A7 \u304B ONE CAREER\u306E\u4F01\u696D\u4E00\u89A7 \u3092\u958B\u3044\u3066\u304F\u3060\u3055\u3044" : "\u30AB\u30FC\u30C9\u3092\u691C\u51FA\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F\uFF08\u30DA\u30FC\u30B8\u69CB\u9020\u304C\u5909\u308F\u3063\u305F\u53EF\u80FD\u6027\u304C\u3042\u308A\u307E\u3059\uFF09"
      });
    } catch (e) {
      sendResult({
        type: "CS_LIST_RESULT",
        ok: false,
        cards: [],
        url: location.href,
        error: e instanceof Error ? e.message : String(e)
      });
    }
  })();
})();
