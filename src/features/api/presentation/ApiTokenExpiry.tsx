import { Badge } from "@/components/ui";
import { formatDateTimeUtc, getNaiveUtcNow } from "@/features/shared/datetime";
import { isApiTokenExpired } from "../domain/apiToken";
import { API_TOKEN_EXPIRATION_LABEL } from "../domain/labels";
import styles from "./ApiTokenExpiry.module.css";

type ApiTokenExpiryProps = {
  expiresAt: Date | null;
  now: Date;
};

/** API トークンの有効期限。切れていれば、そのことも表示する */
export function ApiTokenExpiry({ expiresAt, now }: ApiTokenExpiryProps) {
  if (!expiresAt) {
    return API_TOKEN_EXPIRATION_LABEL.none;
  }
  return (
    <span className={styles.expiry}>
      {formatDateTimeUtc(getNaiveUtcNow(expiresAt))}
      {isApiTokenExpired({ expiresAt }, now) ? (
        <Badge color="error">期限切れ</Badge>
      ) : null}
    </span>
  );
}
