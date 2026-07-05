// storage/companyRepository.ts — 企業レコードのCRUD（chrome.storage.local）
import { pushCurrentStateToCloud } from "../cloud/snapshotSync";
import { CompanyRecord } from "./schema";
import {
  listCompaniesLocal,
  readCompanyMapLocal,
  replaceAllCompaniesLocal,
  writeCompanyMapLocal,
} from "./companyLocal";

export async function listCompanies(): Promise<CompanyRecord[]> {
  return listCompaniesLocal();
}

export async function getCompany(companyId: string): Promise<CompanyRecord | null> {
  const map = await readCompanyMapLocal();
  return map[companyId] ?? null;
}

export async function saveCompany(record: CompanyRecord): Promise<void> {
  const map = await readCompanyMapLocal();
  map[record.companyId] = {
    ...record,
    updatedAt: record.updatedAt ?? new Date().toISOString(),
  };
  await writeCompanyMapLocal(map);
  await pushCurrentStateToCloud().catch(() => {});
}

export async function saveCompanies(records: CompanyRecord[]): Promise<void> {
  const map = await readCompanyMapLocal();
  for (const r of records) {
    map[r.companyId] = {
      ...r,
      updatedAt: r.updatedAt ?? new Date().toISOString(),
    };
  }
  await writeCompanyMapLocal(map);
  await pushCurrentStateToCloud().catch(() => {});
}

export async function updateCompany(
  companyId: string,
  patch: Partial<CompanyRecord> | ((rec: CompanyRecord) => CompanyRecord)
): Promise<CompanyRecord | null> {
  const map = await readCompanyMapLocal();
  const cur = map[companyId];
  if (!cur) return null;
  const next = {
    ...(typeof patch === "function" ? patch(cur) : { ...cur, ...patch }),
    updatedAt: new Date().toISOString(),
  };
  map[companyId] = next;
  await writeCompanyMapLocal(map);
  await pushCurrentStateToCloud().catch(() => {});
  return next;
}

export async function deleteCompany(companyId: string): Promise<void> {
  const map = await readCompanyMapLocal();
  delete map[companyId];
  await writeCompanyMapLocal(map);
  await pushCurrentStateToCloud().catch(() => {});
}

/** 容量逼迫対策: done かつ指定日数より古いレコードを削除して件数を返す */
export async function pruneOldRecords(days = 60): Promise<number> {
  const map = await readCompanyMapLocal();
  const limit = Date.now() - days * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const [id, rec] of Object.entries(map)) {
    if (rec.status === "done" && new Date(rec.createdAt).getTime() < limit) {
      delete map[id];
      removed++;
    }
  }
  if (removed > 0) {
    await writeCompanyMapLocal(map);
    await pushCurrentStateToCloud().catch(() => {});
  }
  return removed;
}

export function newCompanyId(): string {
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function replaceAllCompanies(records: CompanyRecord[]): Promise<void> {
  await replaceAllCompaniesLocal(records);
}
