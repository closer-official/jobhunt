// sidepanel/hooks/useCompanyQueue.ts — 企業キューの購読フック
import { useEffect, useState } from "preact/hooks";
import { CompanyRecord, STORAGE_KEYS } from "../../storage/schema";
import { listCompanies } from "../../storage/companyRepository";

export function useCompanyQueue(): { companies: CompanyRecord[]; reload: () => void } {
  const [companies, setCompanies] = useState<CompanyRecord[]>([]);

  const reload = () => {
    listCompanies().then(setCompanies);
  };

  useEffect(() => {
    reload();
    const listener = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === "local" && changes[STORAGE_KEYS.companies]) reload();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return { companies, reload };
}
