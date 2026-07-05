// sidepanel/components/CaptureStatusBadge.tsx
// 現在アクティブなタブが、この企業のcapturedTextsに取り込み済みかを表示する
import { useEffect, useState } from "preact/hooks";
import { CompanyRecord } from "../../storage/schema";

export function CaptureStatusBadge({ record }: { record: CompanyRecord }) {
  const [activeUrl, setActiveUrl] = useState<string>("");

  useEffect(() => {
    const refresh = () => {
      chrome.tabs
        .query({ active: true, lastFocusedWindow: true })
        .then(([tab]) => setActiveUrl(tab?.url ?? ""))
        .catch(() => setActiveUrl(""));
    };
    refresh();
    const onActivated = () => refresh();
    const onUpdated = (_id: number, info: chrome.tabs.OnUpdatedInfo) => {
      if (info.url || info.status === "complete") refresh();
    };
    chrome.tabs.onActivated.addListener(onActivated);
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  const captured = activeUrl !== "" && record.capturedTexts.some((c) => c.url === activeUrl);

  return (
    <span class={`cap-badge ${captured ? "is-captured" : ""}`}>
      {captured ? "このタブ: 取込済" : "このタブ: 未取込"}
    </span>
  );
}
