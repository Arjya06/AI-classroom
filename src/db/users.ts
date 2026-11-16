import { eq } from 'drizzle-orm';
import { db } from './index.ts';
import { teacherSettings, users } from './schema.ts';

export type TeacherRow = typeof users.$inferSelect;
export type TeacherSettingsRow = typeof teacherSettings.$inferSelect;

export async function getOrCreateUser(uid: string, email: string, name?: string): Promise<TeacherRow> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const fallbackName =
      (name && name.trim()) || cleanEmail.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Teacher';

    const existing = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    if (existing.length > 0) {
      const current = existing[0];
      if (current.email !== cleanEmail) {
        const updated = await db
          .update(users)
          .set({ email: cleanEmail })
          .where(eq(users.uid, uid))
          .returning();
        return updated[0];
      }
      return current;
    }

    const inserted = await db
      .insert(users)
      .values({
        uid,
        email: cleanEmail,
        name: fallbackName,
        role: 'TEACHER',
        department: 'Computer Science & Engineering',
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email: cleanEmail,
        },
      })
      .returning();

    const user = inserted[0];
    await getOrCreateSettings(user.id);
    return user;
  } catch (error) {
    console.error('Database error synchronizing teacher account:', error);
    throw new Error('Failed to synchronize teacher account. Please try again later.', { cause: error });
  }
}

export async function updateUserProfile(
  teacherId: number,
  name: string,
  department: string
): Promise<TeacherRow> {
  try {
    const updated = await db
      .update(users)
      .set({
        name: name.trim(),
        department: department.trim() || 'Computer Science & Engineering',
      })
      .where(eq(users.id, teacherId))
      .returning();
    if (!updated[0]) {
      throw new Error('Teacher profile not found.');
    }
    return updated[0];
  } catch (error) {
    console.error('Database error updating teacher profile:', error);
    throw new Error('Failed to update teacher profile. Please try again later.', { cause: error });
  }
}

export async function getOrCreateSettings(teacherId: number): Promise<TeacherSettingsRow> {
  try {
    const existing = await db
      .select()
      .from(teacherSettings)
      .where(eq(teacherSettings.teacherId, teacherId))
      .limit(1);
    if (existing.length > 0) {
      return existing[0];
    }

    const inserted = await db
      .insert(teacherSettings)
      .values({
        teacherId,
        attentionWeight: 50,
        presenceWeight: 30,
        participationWeight: 20,
        includeParticipation: true,
        highThreshold: 75,
        moderateThreshold: 50,
        samplingInterval: 3,
        preferredCameraLabel: 'Default Classroom Camera',
        retentionDays: 90,
      })
      .onConflictDoNothing({ target: teacherSettings.teacherId })
      .returning();

    if (inserted.length > 0) {
      return inserted[0];
    }

    const fallback = await db
      .select()
      .from(teacherSettings)
      .where(eq(teacherSettings.teacherId, teacherId))
      .limit(1);
    return fallback[0];
  } catch (error) {
    console.error('Database error reading teacher settings:', error);
    throw new Error('Failed to load teacher settings. Please try again later.', { cause: error });
  }
}
