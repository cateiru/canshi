import { z } from "zod";

/**
 * リリースノート1件分の形式。`release-notes.json` はこのスキーマで検証される。
 */
export const releaseNoteSchema = z.object({
  version: z.string().trim().min(1),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "日付は YYYY-MM-DD 形式にすること"),
  title: z.string().trim().min(1),
  items: z.array(z.string().trim().min(1)).min(1),
});

export const releaseNotesSchema = z.array(releaseNoteSchema);

export type ReleaseNote = z.infer<typeof releaseNoteSchema>;
