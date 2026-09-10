import openNextWorker from "./.open-next/worker.js";
import { authorizeCloudflareAccess } from "./src/features/access/authorize";

function forbiddenResponse(): Response {
  return new Response("Forbidden", {
    status: 403,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const authorization = await authorizeCloudflareAccess(request, {
      audience: process.env.CLOUDFLARE_ACCESS_AUD,
      bypass: process.env.CLOUDFLARE_ACCESS_BYPASS,
      teamDomain: process.env.CLOUDFLARE_ACCESS_TEAM_DOMAIN,
    });

    if (!authorization.authorized) {
      const log = JSON.stringify({
        event: "cloudflare_access_denied",
        path: new URL(request.url).pathname,
        reason: authorization.reason,
      });
      if (authorization.reason === "invalid_configuration") {
        console.error(log);
      } else {
        console.warn(log);
      }
      return forbiddenResponse();
    }

    return openNextWorker.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<CloudflareEnv>;
