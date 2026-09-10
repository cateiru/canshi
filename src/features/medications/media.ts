import type { MediaRecordType } from "@/features/media/recordTypes";

/** media_assets.record_type に使う識別子（服薬予定 medications に添付する。投薬実績には添付しない） */
export const MEDICATION_MEDIA_TYPE: MediaRecordType = "medication";
