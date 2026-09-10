import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * R2 のオブジェクトを HTTP レスポンスとしてストリーミング配信する。
 *
 * - `Range`・`If-None-Match` などの条件付きリクエストに対応する（動画のシーク・キャッシュ検証に必要）。
 *   R2 は `Headers` をそのまま受け取れるが、next dev のバインディングプロキシ（Miniflare）は
 *   `Headers` をシリアライズできないため、プレーンなオブジェクトに変換して渡す
 * - オブジェクトは ID ごとに不変のため長期キャッシュを許可するが、Cloudflare Access の保護対象のため
 *   共有キャッシュ（CDN）には載せない
 */
export async function serveR2Object(
  request: Request,
  objectKey: string,
  contentType: string,
): Promise<Response> {
  const { env } = getCloudflareContext();
  const range = parseRangeHeader(request.headers.get("range"));
  const onlyIf = parseConditionalHeaders(request.headers);

  let object: R2Object | R2ObjectBody | null;
  try {
    object = await env.MEDIA_BUCKET.get(objectKey, {
      ...(range ? { range } : {}),
      ...(onlyIf ? { onlyIf } : {}),
    });
  } catch (error) {
    // 範囲外の Range 指定などで R2 が取得を拒否した場合
    console.error("R2 からの取得に失敗しました", error);
    return new Response("Range Not Satisfiable", { status: 416 });
  }
  if (!object) {
    return new Response("Not Found", { status: 404 });
  }

  // `object.writeHttpMetadata(headers)` も next dev のプロキシ境界を越えられないため、
  // 必要なヘッダは自前で組み立てる（Content-Type は DB に保存した判定結果を使う）
  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("ETag", object.httpEtag);
  headers.set("Cache-Control", "private, max-age=31536000, immutable");
  headers.set("Accept-Ranges", "bytes");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Disposition", "inline");

  // onlyIf の条件に合致しなかった場合は body を持たない R2Object が返る
  if (!("body" in object) || object.body == null) {
    return new Response(null, { status: 304, headers });
  }

  // R2 が返す object.range は実装により未使用のフィールドが undefined で埋まることがあるため、
  // 自前で解釈した Range から Content-Range を組み立てる
  const resolvedRange = range ? resolveRange(range, object.size) : null;
  if (resolvedRange) {
    headers.set(
      "Content-Range",
      `bytes ${resolvedRange.offset}-${
        resolvedRange.offset + resolvedRange.length - 1
      }/${object.size}`,
    );
    headers.set("Content-Length", String(resolvedRange.length));
    return new Response(object.body, { status: 206, headers });
  }

  headers.set("Content-Length", String(object.size));
  return new Response(object.body, { status: 200, headers });
}

/**
 * `Range: bytes=start-end` を R2Range に変換する。
 * 複数範囲や不正な形式は無視して全体を返す（null）
 */
export function parseRangeHeader(value: string | null): R2Range | null {
  if (!value) {
    return null;
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, startText, endText] = match;
  if (startText === "" && endText === "") {
    return null;
  }
  if (startText === "") {
    const suffix = Number(endText);
    return suffix > 0 ? { suffix } : null;
  }
  const offset = Number(startText);
  if (endText === "") {
    return { offset };
  }
  const end = Number(endText);
  if (end < offset) {
    return null;
  }
  return { offset, length: end - offset + 1 };
}

/**
 * ETag ヘッダの値から比較用の ETag を 1 つ取り出す。
 * 型定義上 R2Conditional は配列も受け付けるが、workerd の実装は文字列しか受け付けないため
 * 先頭の 1 件だけを使う（オブジェクトは不変で ETag も 1 つのため実用上は十分）
 */
function parseFirstEtag(value: string): string | null {
  const etags = value
    .split(",")
    .map((etag) => etag.trim().replace(/^W\//, "").replace(/^"|"$/g, ""))
    .filter((etag) => etag !== "" && etag !== "*");
  return etags[0] ?? null;
}

/**
 * `If-None-Match`・`If-Match`・`If-Modified-Since`・`If-Unmodified-Since` を R2Conditional に変換する
 */
export function parseConditionalHeaders(
  headers: Headers,
): R2Conditional | null {
  const conditional: R2Conditional = {};
  let hasCondition = false;

  const ifNoneMatch = headers.get("if-none-match");
  if (ifNoneMatch) {
    const etag = parseFirstEtag(ifNoneMatch);
    if (etag) {
      conditional.etagDoesNotMatch = etag;
      hasCondition = true;
    }
  }
  const ifMatch = headers.get("if-match");
  if (ifMatch) {
    const etag = parseFirstEtag(ifMatch);
    if (etag) {
      conditional.etagMatches = etag;
      hasCondition = true;
    }
  }
  const ifModifiedSince = headers.get("if-modified-since");
  if (ifModifiedSince) {
    const date = new Date(ifModifiedSince);
    if (!Number.isNaN(date.getTime())) {
      conditional.uploadedAfter = date;
      hasCondition = true;
    }
  }
  const ifUnmodifiedSince = headers.get("if-unmodified-since");
  if (ifUnmodifiedSince) {
    const date = new Date(ifUnmodifiedSince);
    if (!Number.isNaN(date.getTime())) {
      conditional.uploadedBefore = date;
      hasCondition = true;
    }
  }
  return hasCondition ? conditional : null;
}

/** 要求した Range をオブジェクトのサイズに合わせて実際の offset・length に解決する */
export function resolveRange(
  range: R2Range,
  size: number,
): { offset: number; length: number } {
  if ("suffix" in range) {
    const length = Math.min(range.suffix, size);
    return { offset: size - length, length };
  }
  const offset = range.offset ?? 0;
  const length = Math.min(range.length ?? size - offset, size - offset);
  return { offset, length };
}
