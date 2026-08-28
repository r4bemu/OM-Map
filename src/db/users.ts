import { db } from './index.ts';
import { users } from './schema.ts';

export async function getOrCreateUser(uid: string, email: string, name?: string, role?: string) {
  try {
    const result = await db.insert(users)
      .values({
        uid,
        email,
        name: name || '',
        role: role || 'Viewer',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(name ? { name } : {}),
          ...(role ? { role } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();

    return result[0];
  } catch (error) {
    console.error("Database query getOrCreateUser failed:", error);
    throw new Error("Failed to register or retrieve user record.", { cause: error });
  }
}
