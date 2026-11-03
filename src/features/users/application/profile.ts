import { createUserRepository } from "../infrastructure/userRepository";

/** ユーザーの名前を変える（ユースケース）。ユーザーはログイン中のユーザー（呼び出し側で確かめる） */
export async function renameUser(
  userId: string,
  name: string,
  d1?: D1Database,
): Promise<void> {
  await createUserRepository(d1).rename(userId, name);
}
