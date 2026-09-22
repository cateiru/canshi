import OAuthProvider from "@cloudflare/workers-oauth-provider";
import { authHandler } from "./auth/handler";
import { CanshiMcp } from "./mcp/agent";

export { CanshiMcp };

export default new OAuthProvider({
  apiRoute: "/mcp",
  apiHandler: CanshiMcp.serve("/mcp"),
  defaultHandler: authHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
