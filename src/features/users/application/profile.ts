import { createUserRepository } from "../infrastructure/userRepository";

/** ユーザーの名前を変える（ユースケース）。ユーザーはログイン中のユーザー（呼び出し側で確かめる） */
export async function renameUser(userId: string, name: string): Promise<void> {
  await createUserRepository().rename(userId, name);
}
