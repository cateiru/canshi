import { z } from "zod";

/** `PushManager.subscribe()` の戻り値（`PushSubscriptionJSON`）から Server Action に渡す形 */
export const pushSubscribeSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(500).optional(),
});

export type PushSubscribeInput = z.infer<typeof pushSubscribeSchema>;
