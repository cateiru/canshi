import type { MediaRecordType } from "@/features/media/recordTypes";

/**
 * media_assets.record_type に使う識別子。プロフィール画像は猫そのものに紐付くため、
 * record_id・cat_id はどちらも猫の ID になる
 */
export const CAT_PROFILE_MEDIA_TYPE: MediaRecordType = "cat_profile";
