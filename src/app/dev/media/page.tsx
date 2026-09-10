"use client";

import { notFound } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, FormField } from "@/components/ui";
import { deleteMediaAssetAction } from "@/features/media/actions";
import { DEV_MEDIA_RECORD_TYPE } from "@/features/media/recordTypes";
import { uploadMedia } from "@/features/media/upload";
import type { MediaAssetView } from "@/features/media/view";
import styles from "./page.module.css";

type UploadLog = {
  key: string;
  fileName: string;
  asset?: MediaAssetView;
  error?: string;
};

/**
 * メディアアップロード基盤の動作確認用ページ。
 * 記録に紐付けずに R2 へのアップロード・配信・削除を試せる。本番では表示しない
 */
export default function MediaDevPage() {
  const [recordId, setRecordId] = useState(() => crypto.randomUUID());
  const [logs, setLogs] = useState<UploadLog[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    setIsUploading(true);
    for (const file of Array.from(files)) {
      const key = crypto.randomUUID();
      try {
        const asset = await uploadMedia({
          file,
          recordType: DEV_MEDIA_RECORD_TYPE,
          recordId,
        });
        setLogs((current) => [{ key, fileName: file.name, asset }, ...current]);
      } catch (error) {
        setLogs((current) => [
          {
            key,
            fileName: file.name,
            error: error instanceof Error ? error.message : String(error),
          },
          ...current,
        ]);
      }
    }
    setIsUploading(false);
  };

  const handleDelete = async (log: UploadLog) => {
    if (!log.asset) {
      return;
    }
    const result = await deleteMediaAssetAction(log.asset.id);
    if (result.error) {
      setLogs((current) =>
        current.map((item) =>
          item.key === log.key ? { ...item, error: result.error } : item,
        ),
      );
      return;
    }
    setLogs((current) => current.filter((item) => item.key !== log.key));
  };

  return (
    <main className={styles.main}>
      <h1>メディアアップロード確認</h1>
      <p>
        開発時のみ表示される、R2 へのアップロード・配信・削除の確認用ページ。
        記録種別 <code>{DEV_MEDIA_RECORD_TYPE}</code>{" "}
        として保存するため、実在する記録には紐付かない。
      </p>

      <Card title="アップロード">
        <div className={styles.form}>
          <FormField
            name="recordId"
            label="記録 ID（オブジェクトキーのプレフィックス）"
            value={recordId}
            onChange={setRecordId}
          />
          <label className={styles.fileLabel}>
            <span>ファイル（画像・動画、複数可）</span>
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              disabled={isUploading}
              onChange={(event) => {
                void handleFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          {isUploading ? <p>アップロード中...</p> : null}
        </div>
      </Card>

      <section className={styles.results}>
        {logs.map((log) => (
          <Card key={log.key} title={log.fileName}>
            {log.error ? <Alert color="error">{log.error}</Alert> : null}
            {log.asset ? (
              <div className={styles.result}>
                <a href={log.asset.url} target="_blank" rel="noreferrer">
                  <img
                    src={log.asset.thumbnailUrl}
                    alt={log.fileName}
                    className={styles.thumbnail}
                    width={log.asset.width ?? undefined}
                    height={log.asset.height ?? undefined}
                  />
                </a>
                <pre className={styles.json}>
                  {JSON.stringify(log.asset, null, 2)}
                </pre>
                <div>
                  <Button variant="danger" onPress={() => handleDelete(log)}>
                    削除する
                  </Button>
                </div>
              </div>
            ) : null}
          </Card>
        ))}
      </section>
    </main>
  );
}
