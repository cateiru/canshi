"use client";

import { MediaGallery, type MediaGalleryProps } from "./MediaGallery";

export type MediaThumbnailStripProps = Omit<MediaGalleryProps, "variant">;

/**
 * タイムラインなど小さな領域向けの横並びサムネイル。タップで MediaGallery と同じモーダルを開く
 */
export function MediaThumbnailStrip(props: MediaThumbnailStripProps) {
  return <MediaGallery {...props} variant="strip" />;
}
