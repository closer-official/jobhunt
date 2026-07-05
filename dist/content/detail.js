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

  // src/content-scripts/capture/extractPageText.ts
  var NOISE_SELECTORS = [
    "nav",
    "footer",
    "header",
    "aside",
    "script",
    "style",
    "noscript",
    "iframe",
    "svg",
    "form[role='search']",
    "[role='navigation']",
    "[role='banner']",
    "[role='contentinfo']",
    "[aria-hidden='true']",
    ".global-nav",
    ".breadcrumb",
    ".cookie",
    "#cookie-banner"
  ].join(",");
  var MAX_CAPTURE_CHARS = 2e4;
  function extractPageText(doc = document) {
    const clone = doc.body.cloneNode(true);
    clone.querySelectorAll(NOISE_SELECTORS).forEach((el) => el.remove());
    clone.style.position = "fixed";
    clone.style.left = "-99999px";
    clone.style.top = "0";
    doc.body.appendChild(clone);
    let text = "";
    try {
      text = clone.innerText || clone.textContent || "";
    } finally {
      clone.remove();
    }
    text = text.replace(/[ \t\u3000]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (text.length > MAX_CAPTURE_CHARS) {
      text = text.slice(0, MAX_CAPTURE_CHARS) + "\n\u2026\uFF08\u4EE5\u964D\u7701\u7565\uFF09";
    }
    return text;
  }

  // src/content-scripts/parsers/mynaviDetailParser.ts
  var SECTION_KEYWORDS = [
    "\u4ED5\u4E8B\u5185\u5BB9",
    "\u696D\u52D9\u5185\u5BB9",
    "\u4E8B\u696D\u5185\u5BB9",
    "\u52DF\u96C6\u8981\u9805",
    "\u5FDC\u52DF\u8CC7\u683C",
    "\u6C42\u3081\u308B\u4EBA\u7269\u50CF",
    "\u6C42\u3081\u308B\u4EBA\u6750",
    "\u5BFE\u8C61\u3068\u306A\u308B\u65B9",
    "\u52E4\u52D9\u5730",
    "\u7D66\u4E0E",
    "\u9078\u8003",
    "\u798F\u5229\u539A\u751F",
    "\u4F01\u696D\u60C5\u5831"
  ];
  function extractDefinitionPairs(doc) {
    const out = [];
    doc.querySelectorAll("dl").forEach((dl) => {
      const dts = dl.querySelectorAll("dt");
      const dds = dl.querySelectorAll("dd");
      dts.forEach((dt, i) => {
        const key = dt.textContent?.trim() ?? "";
        const val = dds[i]?.textContent?.trim() ?? "";
        if (key && val && SECTION_KEYWORDS.some((k) => key.includes(k))) {
          out.push(`\u3010${key}\u3011
${val}`);
        }
      });
    });
    doc.querySelectorAll("table tr").forEach((tr) => {
      const key = tr.querySelector("th")?.textContent?.trim() ?? "";
      const val = tr.querySelector("td")?.textContent?.trim() ?? "";
      if (key && val && SECTION_KEYWORDS.some((k) => key.includes(k))) {
        out.push(`\u3010${key}\u3011
${val}`);
      }
    });
    return out;
  }
  function parseMynaviDetail(doc = document) {
    const parts = [];
    const title = doc.querySelector("h1")?.textContent?.trim();
    if (title) parts.push(`\u3010\u30DA\u30FC\u30B8\u30BF\u30A4\u30C8\u30EB\u3011${title}`);
    const sections = extractDefinitionPairs(doc);
    if (sections.length >= 2) {
      parts.push(...sections);
    } else {
      parts.push(`\u3010\u30DA\u30FC\u30B8\u672C\u6587(\u6C4E\u7528\u62BD\u51FA)\u3011
${extractPageText(doc)}`);
    }
    return parts.join("\n\n").slice(0, 2e4);
  }

  // src/content-scripts/parsers/openworkParser.ts
  var METRIC_KEYWORDS = [
    "\u7DCF\u5408\u8A55\u4FA1",
    "\u6B8B\u696D\u6642\u9593",
    "\u6709\u7D66\u4F11\u6687\u6D88\u5316\u7387",
    "\u6709\u7D66\u6D88\u5316\u7387",
    "\u5E73\u5747\u5E74\u53CE",
    "\u56DE\u7B54\u8005\u306E\u5E73\u5747\u5E74\u53CE",
    "\u793E\u54E1\u30AF\u30C1\u30B3\u30DF",
    "\u5F85\u9047\u9762\u306E\u6E80\u8DB3\u5EA6",
    "\u793E\u54E1\u306E\u58EB\u6C17",
    "\u98A8\u901A\u3057\u306E\u826F\u3055",
    "\u793E\u54E1\u306E\u76F8\u4E92\u5C0A\u91CD",
    "20\u4EE3\u6210\u9577\u74B0\u5883",
    "\u4EBA\u6750\u306E\u9577\u671F\u80B2\u6210",
    "\u6CD5\u4EE4\u9806\u5B88\u610F\u8B58",
    "\u4EBA\u4E8B\u8A55\u4FA1\u306E\u9069\u6B63\u611F"
  ];
  var REVIEW_CATEGORY_KEYWORDS = [
    "\u7D44\u7E54\u4F53\u5236\u30FB\u4F01\u696D\u6587\u5316",
    "\u5165\u793E\u7406\u7531\u3068\u5165\u793E\u5F8C\u30AE\u30E3\u30C3\u30D7",
    "\u50CD\u304D\u304C\u3044\u30FB\u6210\u9577",
    "\u5973\u6027\u306E\u50CD\u304D\u3084\u3059\u3055",
    "\u30EF\u30FC\u30AF\u30FB\u30E9\u30A4\u30D5\u30FB\u30D0\u30E9\u30F3\u30B9",
    "\u9000\u8077\u691C\u8A0E\u7406\u7531",
    "\u4F01\u696D\u5206\u6790",
    "\u7D4C\u55B6\u8005\u3078\u306E\u63D0\u8A00",
    "\u5E74\u53CE\u30FB\u7D66\u4E0E"
  ];
  function extractMetrics(doc) {
    const out = [];
    const all = Array.from(doc.querySelectorAll("dt, th, dd, td, span, p, h3, h4, div"));
    const found = /* @__PURE__ */ new Set();
    for (const el of all) {
      const own = (el.childNodes.length <= 3 ? el.textContent : "")?.trim() ?? "";
      for (const kw of METRIC_KEYWORDS) {
        if (found.has(kw) || !own.includes(kw) || own.length > kw.length + 25) continue;
        const block = el.closest("dl, tr, li, div") ?? el.parentElement;
        const blockText = block?.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (blockText && blockText.length < 200) {
          out.push(blockText);
          found.add(kw);
        }
      }
    }
    return out;
  }
  function extractReviews(doc) {
    const out = [];
    doc.querySelectorAll("dl").forEach((dl) => {
      const dt = dl.querySelector("dt")?.textContent?.trim() ?? "";
      if (!REVIEW_CATEGORY_KEYWORDS.some((k) => dt.includes(k))) return;
      const dd = dl.querySelector("dd")?.textContent?.replace(/\s+/g, " ").trim() ?? "";
      if (dd.length > 30) out.push(`\u3010${dt}\u3011
${dd.slice(0, 1500)}`);
    });
    if (out.length === 0) {
      doc.querySelectorAll("article").forEach((a) => {
        const t = a.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (t.length > 80) out.push(t.slice(0, 1500));
      });
    }
    return out.slice(0, 12);
  }
  function parseOpenwork(doc = document) {
    const parts = [];
    const title = doc.querySelector("h1")?.textContent?.trim() || doc.title;
    if (title) parts.push(`\u3010OpenWork\u30DA\u30FC\u30B8\u3011${title}`);
    const metrics = extractMetrics(doc);
    if (metrics.length > 0) {
      parts.push(`\u3010\u8A55\u4FA1\u30B9\u30B3\u30A2\u30FB\u5F85\u9047\u30C7\u30FC\u30BF\u3011
${metrics.join("\n")}`);
    }
    const reviews = extractReviews(doc);
    if (reviews.length > 0) {
      parts.push(`\u3010\u793E\u54E1\u30AF\u30C1\u30B3\u30DF\u3011
${reviews.join("\n\n")}`);
    }
    if (metrics.length + reviews.length < 2) {
      parts.push(`\u3010\u30DA\u30FC\u30B8\u672C\u6587\uFF08\u6C4E\u7528\u62BD\u51FA\uFF09\u3011
${extractPageText(doc)}`);
    }
    return parts.join("\n\n").slice(0, 2e4);
  }

  // src/content-scripts/parsers/onecareerExperienceParser.ts
  var SECTION_KEYWORDS2 = [
    "\u30A8\u30F3\u30C8\u30EA\u30FC\u30B7\u30FC\u30C8",
    "ES",
    "\u8A2D\u554F",
    "\u9762\u63A5",
    "\u4E00\u6B21\u9762\u63A5",
    "\u4E8C\u6B21\u9762\u63A5",
    "\u6700\u7D42\u9762\u63A5",
    "\u30B0\u30EB\u30FC\u30D7\u30C7\u30A3\u30B9\u30AB\u30C3\u30B7\u30E7\u30F3",
    "GD",
    "Web\u30C6\u30B9\u30C8",
    "\u30C6\u30B9\u30C8\u5F62\u5F0F",
    "\u9078\u8003\u30D5\u30ED\u30FC",
    "\u9078\u8003\u30B9\u30C6\u30C3\u30D7",
    "\u30A4\u30F3\u30BF\u30FC\u30F3",
    "\u5185\u5B9A",
    "\u5FD7\u671B\u52D5\u6A5F",
    "\u30AC\u30AF\u30C1\u30AB",
    "\u81EA\u5DF1PR",
    "\u805E\u304B\u308C\u305F\u8CEA\u554F",
    "\u5BFE\u7B56"
  ];
  function parseOnecareerExperience(doc = document) {
    const parts = [];
    const title = doc.querySelector("h1")?.textContent?.trim() || doc.title;
    if (title) parts.push(`\u3010ONE CAREER\u30DA\u30FC\u30B8\u3011${title}`);
    const headings = Array.from(doc.querySelectorAll("h2, h3, h4"));
    let structured = 0;
    for (const h of headings) {
      const ht = h.textContent?.trim() ?? "";
      if (!ht || !SECTION_KEYWORDS2.some((k) => ht.includes(k))) continue;
      const bodyParts = [];
      let node = h.nextElementSibling;
      let hops = 0;
      while (node && hops < 6 && !/^H[2-4]$/.test(node.tagName)) {
        const t = node.textContent?.replace(/\s+/g, " ").trim() ?? "";
        if (t) bodyParts.push(t);
        node = node.nextElementSibling;
        hops++;
      }
      const body = bodyParts.join("\n").slice(0, 2e3);
      if (body.length > 20) {
        parts.push(`\u3010${ht.slice(0, 60)}\u3011
${body}`);
        structured++;
      }
      if (structured >= 15) break;
    }
    if (structured < 2) {
      parts.push(`\u3010\u30DA\u30FC\u30B8\u672C\u6587\uFF08\u6C4E\u7528\u62BD\u51FA\uFF09\u3011
${extractPageText(doc)}`);
    }
    return parts.join("\n\n").slice(0, 2e4);
  }

  // src/content-scripts/parsers/genericParser.ts
  function parseGenericPage(doc = document) {
    const article = doc.querySelector("article");
    const articleText = article?.innerText?.trim();
    const text = articleText && articleText.length > 200 ? articleText.slice(0, 2e4) : extractPageText(doc);
    return { title: doc.title ?? "", text };
  }

  // src/content-scripts/capture/captureController.ts
  function sendResult(msg) {
    try {
      chrome.runtime.sendMessage(msg);
    } catch {
    }
  }

  // src/content-scripts/entryDetail.ts
  (() => {
    try {
      const site = detectSite(location.href);
      let text;
      switch (site) {
        case "onecareer":
          text = parseOnecareerExperience();
          break;
        case "openwork":
          text = parseOpenwork();
          break;
        case "mynavi":
          text = parseMynaviDetail();
          break;
        default: {
          const { title, text: body } = parseGenericPage();
          text = title ? `\u3010\u30DA\u30FC\u30B8\u30BF\u30A4\u30C8\u30EB\u3011${title}

${body}` : body;
        }
      }
      sendResult({
        type: "CS_DETAIL_RESULT",
        ok: text.trim().length > 50,
        text,
        url: location.href,
        error: text.trim().length > 50 ? void 0 : "\u672C\u6587\u3092\u307B\u3068\u3093\u3069\u62BD\u51FA\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F"
      });
    } catch (e) {
      sendResult({
        type: "CS_DETAIL_RESULT",
        ok: false,
        text: "",
        url: location.href,
        error: e instanceof Error ? e.message : String(e)
      });
    }
  })();
})();
