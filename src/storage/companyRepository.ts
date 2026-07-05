// storage/companyRepository.ts — 企業レコードのCRUD（chrome.storage.local）
import { CompanyRecord, STORAGE_KEYS } from "./schema";

type CompanyMap = Record<string, CompanyRecord>;

async function readAll(): Promise<CompanyMap> {
  const res = await chrome.storage.local.get(STORAGE_KEYS.companies);
  return (res[STORAGE_KEYS.companies] as CompanyMap) ?? {};
}

async function writeAll(map: CompanyMap): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.companies]: map });
}

export async function listCompanies(): Promise<CompanyRecord[]> {
  const map = await readAll();
  return Object.values(map).sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return b.matchScore - a.matchScore;
  });
}

export async function getCompany(companyId: string): Promise<CompanyRecord | null> {
  const map = await readAll();
  return map[companyId] ?? null;
}

export async function saveCompany(record: CompanyRecord): Promise<void> {
  const map = await readAll();
  map[record.companyId] = record;
  await writeAll(map);
}

export async function saveCompanies(records: CompanyRecord[]): Promise<void> {
  const map = await readAll();
  for (const r of records) map[r.companyId] = r;
  await writeAll(map);
}

export async function updateCompany(
  companyId: string,
  patch: Partial<CompanyRecord> | ((rec: CompanyRecord) => CompanyRecord)
): Promise<CompanyRecord | null> {
  const map = await readAll();
  const cur = map[companyId];
  if (!cur) return null;
  const next = typeof patch === "function" ? patch(cur) : { ...cur, ...patch };
  map[companyId] = next;
  await writeAll(map);
  return next;
}

export async function deleteCompany(companyId: string): Promise<void> {
  const map = await readAll();
  delete map[companyId];
  await writeAll(map);
}

/** 容量逼迫対策: done かつ指定日数より古いレコードを削除して件数を返す */
export async function pruneOldRecords(days = 60): Promise<number> {
  const map = await readAll();
  const limit = Date.now() - days * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const [id, rec] of Object.entries(map)) {
    if (rec.status === "done" && new Date(rec.createdAt).getTime() < limit) {
      delete map[id];
      removed++;
    }
  }
  if (removed > 0) await writeAll(map);
  return removed;
}

export function newCompanyId(): string {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
