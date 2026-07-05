// storage/companyLocal.ts — 企業レコードのローカルCRUD共通処理
import { CompanyRecord, STORAGE_KEYS } from "./schema";

export type CompanyMap = Record<string, CompanyRecord>;

export async function readCompanyMapLocal(): Promise<CompanyMap> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.companies);
  return (res[STORAGE_KEYS.companies] as CompanyMap) ?? {};
}

export async function writeCompanyMapLocal(map: CompanyMap): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.companies]: map });
}

export async function listCompaniesLocal(): Promise<CompanyRecord[]> {
  const map = await readCompanyMapLocal();
  return Object.values(map).sort((a, b) => {
    const aTime = new Date(a.updatedAt ?? a.createdAt).getTime();
    const bTime = new Date(b.updatedAt ?? b.createdAt).getTime();
    if (aTime !== bTime) return bTime - aTime;
    return b.matchScore - a.matchScore;
  });
}

export async function replaceAllCompaniesLocal(records: CompanyRecord[]): Promise<void> {
  const map: CompanyMap = {};
  for (const record of records) {
    map[record.companyId] = record;
  }
  await writeCompanyMapLocal(map);
}
