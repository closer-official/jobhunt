// cloud/snapshotSync.ts — Firestoreとの全体スナップショット同期
import { doc, getDoc, setDoc } from "firebase/firestore";
import { getCurrentUserFast, getFirestoreDb, isCloudEnabled, waitForAuthReady } from "./firebaseClient";
import type { CompanyRecord, UserSettings } from "../storage/schema";
import { readCompanyMapLocal, replaceAllCompaniesLocal } from "../storage/companyLocal";
import { readSettingsSnapshotLocal, writeSettingsSnapshotLocal } from "../storage/settingsLocal";

export interface CloudSnapshot {
  updatedAt: string;
  settings: UserSettings;
  companies: Record<string, CompanyRecord>;
}

function toMillis(value?: string): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function snapshotTimestamp(snapshot: CloudSnapshot): number {
  let latest = toMillis(snapshot.updatedAt);
  latest = Math.max(latest, toMillis(snapshot.settings.updatedAt));
  for (const record of Object.values(snapshot.companies)) {
    latest = Math.max(latest, toMillis(record.updatedAt ?? record.createdAt));
  }
  return latest;
}

async function buildLocalSnapshot(): Promise<CloudSnapshot> {
  const [settings, companies] = await Promise.all([
    readSettingsSnapshotLocal(),
    readCompanyMapLocal(),
  ]);
  const latestMs = Math.max(
    toMillis(settings.updatedAt),
    ...Object.values(companies).map((record) => toMillis(record.updatedAt ?? record.createdAt))
  );
  return {
    updatedAt: latestMs > 0 ? new Date(latestMs).toISOString() : "",
    settings,
    companies,
  };
}

function hasSnapshotContent(snapshot: CloudSnapshot): boolean {
  return Boolean(
    snapshot.updatedAt ||
      snapshot.settings.updatedAt ||
      Object.keys(snapshot.companies).length > 0 ||
      snapshot.settings.userProfile.resumeBase ||
      snapshot.settings.userProfile.strengthsSummary ||
      snapshot.settings.scoringConditions.industries.length ||
      snapshot.settings.scoringConditions.jobTitles.length ||
      snapshot.settings.scoringConditions.locations.length ||
      snapshot.settings.scoringConditions.priorityKeywords.length ||
      snapshot.settings.scoringConditions.excludeKeywords.length
  );
}

async function writeLocalSnapshot(snapshot: CloudSnapshot): Promise<void> {
  await Promise.all([
    writeSettingsSnapshotLocal(snapshot.settings),
    replaceAllCompaniesLocal(Object.values(snapshot.companies)),
  ]);
}

async function getSnapshotDoc(uid: string) {
  const db = getFirestoreDb();
  if (!db) return null;
  return doc(db, "users", uid, "state", "main");
}

export async function readCloudSnapshot(): Promise<CloudSnapshot | null> {
  if (!isCloudEnabled()) return null;
  const user = await waitForAuthReady();
  if (!user) return null;
  const ref = await getSnapshotDoc(user.uid);
  if (!ref) return null;
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data() as CloudSnapshot;
}

export async function writeCloudSnapshot(snapshot: CloudSnapshot): Promise<void> {
  if (!isCloudEnabled()) return;
  const user = await waitForAuthReady();
  if (!user) return;
  const ref = await getSnapshotDoc(user.uid);
  if (!ref) return;
  await setDoc(ref, snapshot, { merge: true });
}

export async function pushCurrentStateToCloud(): Promise<void> {
  if (!isCloudEnabled()) return;
  const user = getCurrentUserFast();
  if (!user) return;
  const local = await buildLocalSnapshot();
  if (!hasSnapshotContent(local)) return;
  await writeCloudSnapshot({
    ...local,
    updatedAt: new Date(Math.max(snapshotTimestamp(local), Date.now())).toISOString(),
  });
}

export async function syncCloudStateToLocal(): Promise<{ source: "cloud" | "local" | "none" }> {
  if (!isCloudEnabled()) return { source: "none" };
  const user = await waitForAuthReady();
  if (!user) return { source: "none" };

  const [remote, local] = await Promise.all([readCloudSnapshot(), buildLocalSnapshot()]);
  if (!remote) {
    if (hasSnapshotContent(local)) {
      await writeCloudSnapshot({
        ...local,
        updatedAt: new Date(Math.max(snapshotTimestamp(local), Date.now())).toISOString(),
      });
      return { source: "local" };
    }
    return { source: "none" };
  }

  const remoteTs = snapshotTimestamp(remote);
  const localTs = snapshotTimestamp(local);

  if (remoteTs > localTs) {
    await writeLocalSnapshot(remote);
    return { source: "cloud" };
  }

  if (localTs > remoteTs) {
    await writeCloudSnapshot({
      ...local,
      updatedAt: new Date(Math.max(localTs, Date.now())).toISOString(),
    });
    return { source: "local" };
  }

  return { source: "none" };
}
