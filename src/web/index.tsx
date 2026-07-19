import { render } from "preact";
import { useMemo, useState } from "preact/hooks";
import { DRAFT_SUBSCRIPTION_PLANS } from "../billing/planModel";

type View = "home" | "companies" | "documents" | "plans" | "account";

const PLAN_LABELS = {
  free: "無料",
  light: "Light",
  standard: "Standard",
  pro: "Pro",
} as const;

const NAV_ITEMS: { id: View; label: string }[] = [
  { id: "home", label: "ホーム" },
  { id: "companies", label: "企業" },
  { id: "documents", label: "書類" },
  { id: "plans", label: "プラン" },
  { id: "account", label: "アカウント" },
];

function HomeView({ onNavigate }: { onNavigate: (view: View) => void }) {
  return (
    <>
      <section class="hero">
        <div class="hero__copy">
          <span class="eyebrow">JOB HUNTING WORKSPACE</span>
          <h1>
            調べる。考える。伝える。
            <br />
            就活を、一つの流れに。
          </h1>
          <p>
            企業発見からES、面接準備までを整理します。
            最終判断は、学生本人が行います。
          </p>
          <div class="hero__actions">
            <button
              class="button button--primary"
              onClick={() => onNavigate("companies")}
            >
              企業を調べる
            </button>
            <button
              class="button button--secondary"
              onClick={() => onNavigate("documents")}
            >
              書類を整理する
            </button>
          </div>
        </div>
        <div class="hero__panel" aria-label="就活の流れ">
          <span class="hero__panel-label">YOUR FLOW</span>
          {[
            ["01", "自分を整理", "経験と価値観を言葉にする"],
            ["02", "企業を研究", "根拠と出典を確かめる"],
            ["03", "応募を準備", "ESと面接へつなげる"],
          ].map(([number, title, detail]) => (
            <div class="flow-row" key={number}>
              <span>{number}</span>
              <div>
                <strong>{title}</strong>
                <small>{detail}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section class="section">
        <div class="section__heading">
          <span class="eyebrow">TODAY</span>
          <h2>今日やることを、迷わない。</h2>
        </div>
        <div class="action-grid">
          <button class="action-card" onClick={() => onNavigate("companies")}>
            <span class="action-card__number">01</span>
            <strong>企業を探す</strong>
            <p>共有カタログから候補を探します。</p>
            <span class="action-card__link">開く →</span>
          </button>
          <button class="action-card" onClick={() => onNavigate("documents")}>
            <span class="action-card__number">02</span>
            <strong>ESを整える</strong>
            <p>自分の経験と企業研究をつなぎます。</p>
            <span class="action-card__link">開く →</span>
          </button>
          <button class="action-card" onClick={() => onNavigate("documents")}>
            <span class="action-card__number">03</span>
            <strong>面接を準備する</strong>
            <p>質問と回答の根拠を整理します。</p>
            <span class="action-card__link">開く →</span>
          </button>
        </div>
      </section>
    </>
  );
}

function CompaniesView() {
  const [companyName, setCompanyName] = useState("");
  const [requests, setRequests] = useState<string[]>([]);
  const normalized = companyName.trim();

  const addRequest = (event: Event) => {
    event.preventDefault();
    if (!normalized) return;
    setRequests((current) => (
      current.includes(normalized) ? current : [normalized, ...current]
    ));
    setCompanyName("");
  };

  return (
    <section class="workspace-section">
      <div class="section__heading section__heading--wide">
        <span class="eyebrow">COMPANY RESEARCH</span>
        <h1>気になる企業を、根拠から調べる。</h1>
        <p>企業名を入力し、共有カタログを探します。</p>
      </div>
      <form class="company-search" onSubmit={addRequest}>
        <label for="company-name">企業名</label>
        <div>
          <input
            id="company-name"
            value={companyName}
            onInput={(event) => (
              setCompanyName((event.target as HTMLInputElement).value)
            )}
            placeholder="企業名を入力"
          />
          <button class="button button--primary" type="submit">
            調べる
          </button>
        </div>
      </form>
      <p class="system-note">
        現在はローカル試作です。
        検索、AI、Firebaseへの送信は行いません。
      </p>

      <div class="empty-panel">
        {requests.length === 0 ? (
          <>
            <span class="empty-panel__mark">＋</span>
            <h2>調べたい企業を入力してください</h2>
            <p>未掲載企業は、運営確認後に共有候補となります。</p>
          </>
        ) : (
          <>
            <h2>ローカル下書き</h2>
            <p>外部へ送信していない企業名です。</p>
            <ul class="request-list">
              {requests.map((request) => <li key={request}>{request}</li>)}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}

function DocumentsView() {
  const documents = [
    ["履歴書", "基本情報と学歴を整理します。"],
    ["職務経歴書", "経験を再利用できる形で保存します。"],
    ["ES", "企業研究と本人の経験をつなぎます。"],
    ["面接準備", "想定質問と回答の根拠を残します。"],
  ];
  return (
    <section class="workspace-section">
      <div class="section__heading section__heading--wide">
        <span class="eyebrow">DOCUMENTS</span>
        <h1>応募書類を、使い捨てにしない。</h1>
        <p>入力した経験を、書類と面接へ再利用します。</p>
      </div>
      <div class="document-grid">
        {documents.map(([title, detail], index) => (
          <article class="document-card" key={title}>
            <span>0{index + 1}</span>
            <h2>{title}</h2>
            <p>{detail}</p>
            <button class="button button--secondary" disabled>
              保存機能の接続前
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function PlansView() {
  return (
    <section class="workspace-section">
      <div class="section__heading section__heading--wide">
        <span class="eyebrow">PLANS</span>
        <h1>無料版と有料版を、最初から選べる。</h1>
        <p>有料版を招待制にはしません。</p>
      </div>
      <div class="plan-grid">
        {DRAFT_SUBSCRIPTION_PLANS.map((plan) => (
          <article
            class={`web-plan ${plan.id === "standard" ? "is-featured" : ""}`}
            key={plan.id}
          >
            <div class="web-plan__head">
              <h2>{PLAN_LABELS[plan.id]}</h2>
              {plan.id === "standard" ? <span>候補</span> : null}
            </div>
            <strong class="web-plan__price">
              {plan.monthlyPriceJpy === 0
                ? "0円"
                : "料金策定中"}
            </strong>
            <ul>
              <li>
                月次AI枠 {
                  plan.monthlyCredits === 0
                    ? "なし"
                    : "実測後に確定"
                }
              </li>
              <li>
                保存上限 {plan.cloudSavedItemLimit || "端末保存"}
              </li>
              <li>招待不要</li>
            </ul>
            <button class="button button--secondary" disabled>
              {plan.paidFeaturesEnabled ? "決済接続前" : "認証接続前"}
            </button>
          </article>
        ))}
      </div>
      <p class="system-note">
        価格とAI枠は候補です。
        実測と公開前確認後に確定します。
      </p>
    </section>
  );
}

function AccountView() {
  return (
    <section class="workspace-section">
      <div class="section__heading section__heading--wide">
        <span class="eyebrow">ACCOUNT</span>
        <h1>自分のデータは、自分の領域へ。</h1>
        <p>共有企業データと学生データを分離します。</p>
      </div>
      <div class="account-panel">
        <div>
          <span>認証</span>
          <strong>未接続</strong>
        </div>
        <div>
          <span>Firebase</span>
          <strong>実接続前</strong>
        </div>
        <div>
          <span>外部AI</span>
          <strong>送信なし</strong>
        </div>
      </div>
      <p class="system-note">
        実利用者データは保存していません。
      </p>
    </section>
  );
}

function App() {
  const [view, setView] = useState<View>("home");
  const currentLabel = useMemo(
    () => NAV_ITEMS.find((item) => item.id === view)?.label ?? "",
    [view]
  );

  return (
    <div class="web-app">
      <header class="site-header">
        <button class="brand" onClick={() => setView("home")}>
          <span class="brand__mark">企</span>
          <span>
            <strong>企業リサーチ</strong>
            <small>JOB HUNTING WORKSPACE</small>
          </span>
        </button>
        <nav aria-label="メインナビゲーション">
          {NAV_ITEMS.map((item) => (
            <button
              class={view === item.id ? "is-active" : ""}
              onClick={() => setView(item.id)}
              key={item.id}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <span class="header-status">LOCAL PREVIEW</span>
      </header>

      <main aria-label={currentLabel}>
        {view === "home" ? <HomeView onNavigate={setView} /> : null}
        {view === "companies" ? <CompaniesView /> : null}
        {view === "documents" ? <DocumentsView /> : null}
        {view === "plans" ? <PlansView /> : null}
        {view === "account" ? <AccountView /> : null}
      </main>

      <footer>
        <strong>企業リサーチ</strong>
        <span>学生の判断を支えるWebアプリ</span>
        <span>外部接続なし・ローカル試作</span>
      </footer>
    </div>
  );
}

render(<App />, document.getElementById("root")!);
