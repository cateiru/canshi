import { Alert, Button, Modal, Slider } from "@canshi/shared/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import common from "../common.module.css";
import styles from "./ImageCropModal.module.css";

/** 切り抜き中の元画像と、切り抜く正方形の中心（元画像の px）・ズーム倍率 */
type CropView = {
  bitmap: ImageBitmap;
  zoom: number;
  centerX: number;
  centerY: number;
};

const MAX_ZOOM = 3;
const CANVAS_SIZE = 640;
const JPEG_QUALITY = 0.85;

/** 切り抜く正方形の一辺（元画像の px）。ズーム 1 倍で短辺いっぱいになる */
function cropSide(view: CropView) {
  return Math.min(view.bitmap.width, view.bitmap.height) / view.zoom;
}

/** 切り抜く正方形が元画像からはみ出さないよう、中心を寄せる */
function clampView(view: CropView): CropView {
  const half = cropSide(view) / 2;
  return {
    ...view,
    centerX: Math.min(view.bitmap.width - half, Math.max(half, view.centerX)),
    centerY: Math.min(view.bitmap.height - half, Math.max(half, view.centerY)),
  };
}

function cropRect(view: CropView) {
  const side = cropSide(view);
  return { x: view.centerX - side / 2, y: view.centerY - side / 2, side };
}

/** 白で塗ってから描く（透過部分は JPEG にすると黒くなるため） */
function drawCrop(
  canvas: HTMLCanvasElement,
  bitmap: ImageBitmap,
  rect: ReturnType<typeof cropRect>,
) {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("画像を描けませんでした");
  }
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(
    bitmap,
    rect.x,
    rect.y,
    rect.side,
    rect.side,
    0,
    0,
    canvas.width,
    canvas.height,
  );
}

/** 一辺 `maxEdge` px 以下の正方形の JPEG に書き出す（EXIF の位置情報なども落ちる） */
async function exportJpeg(view: CropView, maxEdge: number, fileName: string) {
  const rect = cropRect(view);
  const size = Math.max(1, Math.min(maxEdge, Math.round(rect.side)));
  const output = document.createElement("canvas");
  output.width = size;
  output.height = size;
  drawCrop(output, view.bitmap, rect);
  const blob = await new Promise<Blob | null>((resolve) =>
    output.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) {
    throw new Error("JPEG に書き出せませんでした");
  }
  const base = fileName.replace(/\.[^.]*$/, "") || "image";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

/**
 * 選んだ画像を正方形に切り抜くダイアログ。ドラッグ・矢印キーで位置を、ホイール・スライダーで
 * ズームを調整し、決定すると一辺 `maxEdge` px 以下の JPEG を返す。読み込めなかったとき・
 * 書き出せなかったときは理由を表示する
 */
export function ImageCropModal(props: {
  /** 切り抜く元の画像。null のときは閉じる */
  file: File | null;
  maxEdge: number;
  onClose: () => void;
  onCropped: (file: File) => void;
}) {
  const { file } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [view, setView] = useState<CropView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const dragRef = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    setView(null);
    setError(null);
    if (!file) {
      return;
    }
    let bitmap: ImageBitmap | null = null;
    let cancelled = false;
    createImageBitmap(file, { imageOrientation: "from-image" }).then(
      (loaded) => {
        if (cancelled) {
          loaded.close();
          return;
        }
        bitmap = loaded;
        setView({
          bitmap: loaded,
          zoom: 1,
          centerX: loaded.width / 2,
          centerY: loaded.height / 2,
        });
      },
      () => {
        if (!cancelled) {
          setError("画像を読み込めませんでした。別の画像を選んでください。");
        }
      },
    );
    return () => {
      cancelled = true;
      bitmap?.close();
    };
  }, [file]);

  useEffect(() => {
    if (view && canvasRef.current) {
      drawCrop(canvasRef.current, view.bitmap, cropRect(view));
    }
  }, [view]);

  const setZoom = useCallback((zoom: number) => {
    setView((current) =>
      current
        ? clampView({ ...current, zoom: Math.min(MAX_ZOOM, Math.max(1, zoom)) })
        : current,
    );
  }, []);

  /** 画面上の移動量（CSS px）だけ画像を動かす */
  const pan = useCallback((dx: number, dy: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const width = canvas.getBoundingClientRect().width || CANVAS_SIZE;
    setView((current) => {
      if (!current) {
        return current;
      }
      const ratio = cropSide(current) / width;
      return clampView({
        ...current,
        centerX: current.centerX - dx * ratio,
        centerY: current.centerY - dy * ratio,
      });
    });
  }, []);

  // ホイールでページがスクロールしないよう、passive でないリスナーで受ける
  const hasView = view !== null;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasView) {
      return;
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setView((current) =>
        current
          ? clampView({
              ...current,
              zoom: Math.min(
                MAX_ZOOM,
                Math.max(1, current.zoom * Math.exp(-event.deltaY * 0.002)),
              ),
            })
          : current,
      );
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [hasView]);

  const confirm = async () => {
    if (!file || !view) {
      return;
    }
    setIsExporting(true);
    setError(null);
    try {
      props.onCropped(await exportJpeg(view, props.maxEdge, file.name));
    } catch {
      setError("画像を切り抜けませんでした。別の画像を選んでください。");
    } finally {
      setIsExporting(false);
    }
  };

  const close = () => {
    if (!isExporting) {
      props.onClose();
    }
  };

  return (
    <Modal open={file !== null} title="商品画像の範囲を選ぶ" onClose={close}>
      <div className={common.stack}>
        <p className={common.muted}>
          ドラッグ・矢印キーで位置を調整、ホイール・スライダーでズーム
        </p>
        <canvas
          ref={canvasRef}
          className={styles.canvas}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          tabIndex={0}
          role="img"
          aria-label="切り抜く範囲"
          onPointerDown={(event) => {
            if (!view) {
              return;
            }
            dragRef.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const drag = dragRef.current;
            if (!drag || drag.id !== event.pointerId) {
              return;
            }
            pan(event.clientX - drag.x, event.clientY - drag.y);
            drag.x = event.clientX;
            drag.y = event.clientY;
          }}
          onPointerUp={() => {
            dragRef.current = null;
          }}
          onPointerCancel={() => {
            dragRef.current = null;
          }}
          onKeyDown={(event) => {
            // 矢印キーでも画像を動かせるようにする（Shift で大きく動かす）
            const step = event.shiftKey ? 40 : 10;
            const moves: Record<string, [number, number]> = {
              ArrowLeft: [-step, 0],
              ArrowRight: [step, 0],
              ArrowUp: [0, -step],
              ArrowDown: [0, step],
            };
            const move = moves[event.key];
            if (!move || !view) {
              return;
            }
            event.preventDefault();
            pan(move[0], move[1]);
          }}
        />
        <Slider
          label="ズーム"
          minValue={1}
          maxValue={MAX_ZOOM}
          step={0.01}
          value={view?.zoom ?? 1}
          onChange={setZoom}
          isDisabled={!view}
          formatValue={(zoom) => `${zoom.toFixed(2)}倍`}
        />
        {error ? (
          <Alert color="error" role="alert">
            {error}
          </Alert>
        ) : null}
        <div className={styles.buttons}>
          <Button
            variant="primary"
            isDisabled={!view || isExporting}
            onPress={confirm}
          >
            {isExporting ? "切り抜き中..." : "この範囲で決定する"}
          </Button>
          <Button variant="secondary" isDisabled={isExporting} onPress={close}>
            キャンセル
          </Button>
        </div>
      </div>
    </Modal>
  );
}
