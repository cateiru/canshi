import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  createHouseholdInvitation,
  householdInvitationPath,
  listPendingHouseholdInvitations,
  revokeHouseholdInvitation,
} from "@/features/households/invitations";
import {
  removeHouseholdMember,
  renameHousehold,
} from "@/features/households/management";
import { transferHouseholdOwnership } from "@/features/households/ownership";
import {
  getHouseholdForUser,
  listHouseholdMembers,
} from "@/features/households/queries";
import { householdNameFormSchema } from "@/features/households/schema";
import { parseFormValues } from "../formValues";
import {
  errorResult,
  jsonResult,
  type McpToolContext,
  resolveHouseholdOperation,
} from "./context";

const householdIdField = z
  .string()
  .describe("家の ID（list_households で取得できる）");

const memberUserIdField = z
  .string()
  .describe("メンバーのユーザー ID（list_household_members で取得できる）");

const OWNER_ONLY_DESCRIPTION =
  "CANSHI の画面と同じく、ユーザーが家のオーナーのときだけ行える。";

/**
 * 家の名前・メンバー・招待のツールを登録する。扱えるのは、読み取りを許可している家で、
 * その操作を許可している家に限る。家の作成・削除と、家から抜ける・招待を受ける操作は扱わない
 */
export function registerHouseholdTools(server: McpServer, ctx: McpToolContext) {
  server.registerTool(
    "update_household",
    {
      title: "家の名前を変更",
      description: `家の名前を変更する。${OWNER_ONLY_DESCRIPTION}`,
      inputSchema: {
        householdId: householdIdField,
        name: z.string().describe("家の名前（50文字以内）"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async ({ householdId, name }) => {
      const resolved = await resolveHouseholdOperation(
        ctx,
        householdId,
        "household:update",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const parsed = parseFormValues(householdNameFormSchema, { name });
      if ("error" in parsed) {
        return errorResult(parsed.error);
      }
      const result = await renameHousehold(
        householdId,
        resolved.connection.userId,
        parsed.data.name,
        ctx.env.DB,
      );
      if (!result.ok) {
        return errorResult(result.error);
      }
      return jsonResult({ id: householdId, name: parsed.data.name });
    },
  );

  server.registerTool(
    "list_household_members",
    {
      title: "家のメンバーの一覧を取得",
      description:
        "家のメンバーを、オーナーを先頭に所属した順で取得する。" +
        "role は owner=オーナー、member=メンバー。isMe はツールを使っているユーザー本人か。",
      inputSchema: { householdId: householdIdField },
      annotations: { readOnlyHint: true },
    },
    async ({ householdId }) => {
      const resolved = await resolveHouseholdOperation(
        ctx,
        householdId,
        "householdMember:read",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const members = await listHouseholdMembers(householdId, ctx.env.DB);
      return jsonResult({
        members: members.map((member) => ({
          userId: member.userId,
          name: member.name,
          role: member.role,
          joinedAt: member.joinedAt.toISOString(),
          isMe: member.userId === resolved.connection.userId,
        })),
      });
    },
  );

  server.registerTool(
    "remove_household_member",
    {
      title: "家のメンバーを外す",
      description:
        "家からメンバーを外す。外したメンバーは、その家の猫を見られなくなる。" +
        "オーナーは外せない。" +
        OWNER_ONLY_DESCRIPTION,
      inputSchema: { householdId: householdIdField, userId: memberUserIdField },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ householdId, userId }) => {
      const resolved = await resolveHouseholdOperation(
        ctx,
        householdId,
        "householdMember:update",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const result = await removeHouseholdMember(
        householdId,
        resolved.connection.userId,
        userId,
        ctx.env.DB,
      );
      if (!result.ok) {
        return errorResult(result.error);
      }
      return jsonResult({ householdId, userId, removed: true });
    },
  );

  server.registerTool(
    "transfer_household_ownership",
    {
      title: "家のオーナーを移譲",
      description:
        "家のオーナーを、同じ家の別のメンバーへ移譲する。移譲すると、ユーザー本人は" +
        "オーナーでなくなり、オーナーだけが行える操作をできなくなる。" +
        OWNER_ONLY_DESCRIPTION,
      inputSchema: { householdId: householdIdField, userId: memberUserIdField },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    async ({ householdId, userId }) => {
      const resolved = await resolveHouseholdOperation(
        ctx,
        householdId,
        "householdMember:update",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const result = await transferHouseholdOwnership(
        householdId,
        resolved.connection.userId,
        userId,
        ctx.env.DB,
      );
      if (!result.ok) {
        return errorResult(result.error);
      }
      return jsonResult({ householdId, ownerUserId: userId });
    },
  );

  server.registerTool(
    "list_household_invitations",
    {
      title: "家への招待の一覧を取得",
      description:
        "家への招待のうち、まだ使われておらず期限内のものを新しい順に取得する。" +
        "招待 URL は発行したときにしか分からないため含まない。" +
        OWNER_ONLY_DESCRIPTION,
      inputSchema: { householdId: householdIdField },
      annotations: { readOnlyHint: true },
    },
    async ({ householdId }) => {
      const resolved = await resolveHouseholdOperation(
        ctx,
        householdId,
        "householdInvitation:read",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      // 画面と同じく、招待の一覧はオーナーにだけ見せる
      const household = await getHouseholdForUser(
        resolved.connection.userId,
        householdId,
        ctx.env.DB,
      );
      if (household?.role !== "owner") {
        return errorResult("招待の一覧を見られるのはオーナーだけです");
      }
      const invitations = await listPendingHouseholdInvitations(
        householdId,
        ctx.env.DB,
      );
      return jsonResult({
        invitations: invitations.map((invitation) => ({
          id: invitation.id,
          createdByName: invitation.createdByName,
          createdAt: invitation.createdAt.toISOString(),
          expiresAt: invitation.expiresAt.toISOString(),
        })),
      });
    },
  );

  server.registerTool(
    "create_household_invitation",
    {
      title: "家への招待 URL を発行",
      description:
        "家への招待 URL を発行する。URL を開いてログインした人が 1 人だけ家に参加でき、" +
        "有効期限は発行から 7 日。URL はこのときにしか分からないため、そのままユーザーに伝える。" +
        OWNER_ONLY_DESCRIPTION,
      inputSchema: { householdId: householdIdField },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    async ({ householdId }) => {
      const resolved = await resolveHouseholdOperation(
        ctx,
        householdId,
        "householdInvitation:create",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const result = await createHouseholdInvitation(
        householdId,
        resolved.connection.userId,
        ctx.env.DB,
      );
      if (!result.ok) {
        return errorResult(result.error);
      }
      return jsonResult({
        url: new URL(householdInvitationPath(result.token), ctx.origin).href,
        expiresAt: result.expiresAt.toISOString(),
      });
    },
  );

  server.registerTool(
    "revoke_household_invitation",
    {
      title: "家への招待を無効化",
      description:
        "まだ使われていない家への招待を無効化する。無効化した招待の URL では家に参加できない。" +
        OWNER_ONLY_DESCRIPTION,
      inputSchema: {
        householdId: householdIdField,
        invitationId: z
          .string()
          .describe("招待の ID（list_household_invitations で取得できる）"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      },
    },
    async ({ householdId, invitationId }) => {
      const resolved = await resolveHouseholdOperation(
        ctx,
        householdId,
        "householdInvitation:delete",
      );
      if ("error" in resolved) {
        return errorResult(resolved.error);
      }
      const result = await revokeHouseholdInvitation(
        householdId,
        resolved.connection.userId,
        invitationId,
        ctx.env.DB,
      );
      if (!result.ok) {
        return errorResult(result.error);
      }
      return jsonResult({ id: invitationId, revoked: true });
    },
  );
}
