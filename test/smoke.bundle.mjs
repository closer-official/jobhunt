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
export {
  parseOnecareerList,
  parseOpenwork,
  parseWantedlyList
};
