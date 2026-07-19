// social/manualAssetAcceptance.ts — 手動投稿用完成素材の受入検査

export const SOCIAL_CHANNELS = [
  "note",
  "x",
  "instagram_reels",
  "threads",
  "tiktok",
  "youtube_shorts",
] as const;

export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];

export interface ManualSocialAsset {
  channel: SocialChannel;
  caption: string;
  prLabel: "PR" | "PRなし";
  sourceNote: string;
  checkedOn: string;
  copyText?: string;
  imageFile?: string;
  videoFile?: string;
  coverImageFile?: string;
}

export function validateManualSocialPack(
  assets: ManualSocialAsset[]
): string[] {
  const errors: string[] = [];
  for (const channel of SOCIAL_CHANNELS) {
    const item = assets.find((asset) => asset.channel === channel);
    if (!item) {
      errors.push(`${channel} の完成素材がありません。`);
      continue;
    }
    if (!item.caption.trim()) {
      errors.push(`${channel} の投稿文がありません。`);
    }
    if (!item.sourceNote.trim()) {
      errors.push(`${channel} の根拠メモがありません。`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(item.checkedOn)) {
      errors.push(`${channel} の確認日が不正です。`);
    }
    if (
      channel === "note"
      || channel === "x"
      || channel === "threads"
    ) {
      if (!item.copyText?.trim()) {
        errors.push(`${channel} のコピペ本文がありません。`);
      }
    } else {
      if (!item.videoFile?.toLowerCase().endsWith(".mp4")) {
        errors.push(`${channel} の投稿用MP4がありません。`);
      }
      if (!item.coverImageFile?.trim()) {
        errors.push(`${channel} の表紙画像がありません。`);
      }
    }
  }
  return errors;
}
