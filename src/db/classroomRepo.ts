import { and, desc, asc, eq, inArray } from 'drizzle-orm';
import { db } from './index.ts';
import {
  attendance,
  classrooms,
  engagementRecords,
  monitoringSessions,
  participationEvents,
  students,
  teacherSettings,
  users,
} from './schema.ts';
import { getOrCreateSettings, type TeacherRow, type TeacherSettingsRow } from './users.ts';

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

function calculateEngagementScore(
  attentionOrientation: number,
  facePresence: number,
  participationScore: number | null | undefined,
  settings: TeacherSettingsRow
): number {
  const wAtt = settings.attentionWeight;
  const wPres = settings.presenceWeight;
  const wPart = settings.participationWeight;

  if (settings.includeParticipation && participationScore !== null && participationScore !== undefined) {
    const total = wAtt + wPres + wPart;
    if (total <= 0) return 0;
    return round1((attentionOrientation * wAtt + facePresence * wPres + participationScore * wPart) / total);
  }
  const avail = wAtt + wPres;
  if (avail <= 0) return 0;
  return round1((attentionOrientation * wAtt + facePresence * wPres) / avail);
}

function formatSettingsDto(s: TeacherSettingsRow) {
  return {
    attentionWeight: s.attentionWeight,
    presenceWeight: s.presenceWeight,
    participationWeight: s.participationWeight,
    includeParticipation: s.includeParticipation,
    highThreshold: s.highThreshold,
    moderateThreshold: s.moderateThreshold,
    samplingInterval: s.samplingInterval,
    preferredCameraLabel: s.preferredCameraLabel,
    retentionDays: s.retentionDays,
  };
}

export async function listClassroomsForTeacher(teacher: TeacherRow) {
  try {
    const classRows = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.teacherId, teacher.id))
      .orderBy(desc(classrooms.createdAt));

    if (classRows.length === 0) return [];

    const classIds = classRows.map((c) => c.id);
    const [studentRows, sessionRows, attRows] = await Promise.all([
      db.select().from(students).where(inArray(students.classroomId, classIds)),
      db.select().from(monitoringSessions).where(inArray(monitoringSessions.classroomId, classIds)),
      db.select().from(attendance).where(inArray(attendance.classroomId, classIds)),
    ]);

    return classRows.map((c) => {
      const studentCount = studentRows.filter((s) => s.classroomId === c.id).length;
      const validSessions = sessionRows.filter((s) => s.classroomId === c.id && s.averageEngagement > 0);
      const avgEng =
        validSessions.length > 0
          ? round1(validSessions.reduce((a, b) => a + b.averageEngagement, 0) / validSessions.length)
          : 0;
      const classAtt = attRows.filter((a) => a.classroomId === c.id);
      const presentCount = classAtt.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
      const attPct = classAtt.length > 0 ? round1((presentCount * 100) / classAtt.length) : 0;

      return {
        id: c.id,
        classroomName: c.classroomName,
        subject: c.subject,
        section: c.section,
        academicYear: c.academicYear,
        description: c.description,
        teacherName: teacher.name,
        studentCount,
        averageEngagement: avgEng,
        attendancePercentage: attPct,
        isDemo: c.isDemo,
      };
    });
  } catch (error) {
    console.error('Database error listing classrooms:', error);
    throw new Error('Failed to retrieve classrooms. Please try again later.', { cause: error });
  }
}

export async function getClassroomForTeacher(teacher: TeacherRow, classroomId: number) {
  try {
    const rows = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacher.id)))
      .limit(1);
    const c = rows[0];
    if (!c) {
      throw new NotFoundError('Classroom not found.');
    }

    const [studentRows, sessionRows, attRows] = await Promise.all([
      db.select().from(students).where(eq(students.classroomId, c.id)),
      db.select().from(monitoringSessions).where(eq(monitoringSessions.classroomId, c.id)),
      db.select().from(attendance).where(eq(attendance.classroomId, c.id)),
    ]);

    const validSessions = sessionRows.filter((s) => s.averageEngagement > 0);
    const avgEng =
      validSessions.length > 0
        ? round1(validSessions.reduce((a, b) => a + b.averageEngagement, 0) / validSessions.length)
        : 0;
    const presentCount = attRows.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
    const attPct = attRows.length > 0 ? round1((presentCount * 100) / attRows.length) : 0;

    return {
      id: c.id,
      classroomName: c.classroomName,
      subject: c.subject,
      section: c.section,
      academicYear: c.academicYear,
      description: c.description,
      teacherName: teacher.name,
      studentCount: studentRows.length,
      averageEngagement: avgEng,
      attendancePercentage: attPct,
      isDemo: c.isDemo,
    };
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error fetching classroom:', error);
    throw new Error('Failed to fetch classroom details. Please try again later.', { cause: error });
  }
}

export async function createClassroomForTeacher(
  teacher: TeacherRow,
  payload: {
    classroomName: string;
    subject: string;
    section: string;
    academicYear: string;
    description?: string;
    isDemo?: boolean;
  }
) {
  try {
    const inserted = await db
      .insert(classrooms)
      .values({
        classroomName: payload.classroomName.trim(),
        subject: payload.subject.trim(),
        section: payload.section.trim(),
        academicYear: payload.academicYear.trim(),
        description: (payload.description || '').trim(),
        isDemo: Boolean(payload.isDemo),
        teacherId: teacher.id,
      })
      .returning();

    const c = inserted[0];
    return {
      id: c.id,
      classroomName: c.classroomName,
      subject: c.subject,
      section: c.section,
      academicYear: c.academicYear,
      description: c.description,
      teacherName: teacher.name,
      studentCount: 0,
      averageEngagement: 0,
      attendancePercentage: 0,
      isDemo: c.isDemo,
    };
  } catch (error) {
    console.error('Database error creating classroom:', error);
    throw new Error('Failed to create classroom. Please try again later.', { cause: error });
  }
}

export async function updateClassroomForTeacher(
  teacher: TeacherRow,
  classroomId: number,
  payload: {
    classroomName: string;
    subject: string;
    section: string;
    academicYear: string;
    description?: string;
  }
) {
  try {
    const updated = await db
      .update(classrooms)
      .set({
        classroomName: payload.classroomName.trim(),
        subject: payload.subject.trim(),
        section: payload.section.trim(),
        academicYear: payload.academicYear.trim(),
        description: (payload.description || '').trim(),
      })
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacher.id)))
      .returning();

    if (!updated[0]) {
      throw new NotFoundError('Classroom not found.');
    }
    return await getClassroomForTeacher(teacher, classroomId);
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error updating classroom:', error);
    throw new Error('Failed to update classroom. Please try again later.', { cause: error });
  }
}

export async function deleteClassroomForTeacher(teacherId: number, classroomId: number) {
  try {
    const deleted = await db
      .delete(classrooms)
      .where(and(eq(classrooms.id, classroomId), eq(classrooms.teacherId, teacherId)))
      .returning({ id: classrooms.id });

    if (!deleted[0]) {
      throw new NotFoundError('Classroom not found.');
    }
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error deleting classroom:', error);
    throw new Error('Failed to delete classroom. Please try again later.', { cause: error });
  }
}

function buildStudentDtoFromRows(
  st: typeof students.$inferSelect,
  classroom: typeof classrooms.$inferSelect | undefined,
  recs: Array<typeof engagementRecords.$inferSelect>,
  atts: Array<typeof attendance.$inferSelect>,
  settings: TeacherSettingsRow
) {
  const avgEng =
    recs.length > 0
      ? round1(recs.reduce((a, b) => a + b.finalEngagementScore, 0) / recs.length)
      : 0;
  const presentCount = atts.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
  const attPct = atts.length > 0 ? round1((presentCount * 100) / atts.length) : 0;
  const sessionsAttended = new Set(recs.map((r) => r.sessionId)).size;

  let engagementCategory: 'High' | 'Moderate' | 'Low' | 'No Data' = 'No Data';
  if (recs.length > 0) {
    if (avgEng >= settings.highThreshold) engagementCategory = 'High';
    else if (avgEng >= settings.moderateThreshold) engagementCategory = 'Moderate';
    else engagementCategory = 'Low';
  }

  return {
    id: st.id,
    studentName: st.studentName,
    email: st.email,
    rollNumber: st.rollNumber,
    classroomId: st.classroomId,
    classroomName: classroom?.classroomName || 'Unknown Classroom',
    section: classroom?.section || '',
    enrollmentDate: st.enrollmentDate,
    averageEngagement: avgEng,
    attendancePercentage: attPct,
    sessionsAttended,
    engagementCategory,
    isDemo: st.isDemo,
  };
}

export async function listStudentsForTeacher(teacherId: number) {
  try {
    const settings = await getOrCreateSettings(teacherId);
    const classRows = await db.select().from(classrooms).where(eq(classrooms.teacherId, teacherId));
    if (classRows.length === 0) return [];

    const classMap = new Map(classRows.map((c) => [c.id, c]));
    const classIds = classRows.map((c) => c.id);

    const studentRows = await db
      .select()
      .from(students)
      .where(inArray(students.classroomId, classIds))
      .orderBy(asc(students.studentName));

    if (studentRows.length === 0) return [];

    const studentIds = studentRows.map((s) => s.id);
    const [recRows, attRows] = await Promise.all([
      db.select().from(engagementRecords).where(inArray(engagementRecords.studentId, studentIds)),
      db.select().from(attendance).where(inArray(attendance.studentId, studentIds)),
    ]);

    return studentRows.map((st) =>
      buildStudentDtoFromRows(
        st,
        classMap.get(st.classroomId),
        recRows.filter((r) => r.studentId === st.id),
        attRows.filter((a) => a.studentId === st.id),
        settings
      )
    );
  } catch (error) {
    console.error('Database error listing students:', error);
    throw new Error('Failed to retrieve students. Please try again later.', { cause: error });
  }
}

export async function getStudentForTeacher(teacherId: number, studentId: number) {
  try {
    const stRows = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    const st = stRows[0];
    if (!st) throw new NotFoundError('Student not found.');

    const classRows = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, st.classroomId), eq(classrooms.teacherId, teacherId)))
      .limit(1);
    if (!classRows[0]) throw new NotFoundError('Student not found.');

    const settings = await getOrCreateSettings(teacherId);
    const [recRows, attRows] = await Promise.all([
      db.select().from(engagementRecords).where(eq(engagementRecords.studentId, st.id)),
      db.select().from(attendance).where(eq(attendance.studentId, st.id)),
    ]);

    return buildStudentDtoFromRows(st, classRows[0], recRows, attRows, settings);
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error getting student:', error);
    throw new Error('Failed to retrieve student details. Please try again later.', { cause: error });
  }
}

export async function createStudentForTeacher(
  teacherId: number,
  payload: {
    studentName: string;
    email: string;
    rollNumber: string;
    classroomId: number;
    enrollmentDate?: string;
    isDemo?: boolean;
  }
) {
  try {
    const classRows = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, payload.classroomId), eq(classrooms.teacherId, teacherId)))
      .limit(1);
    const classroom = classRows[0];
    if (!classroom) {
      throw new NotFoundError('Selected classroom not found.');
    }

    const existingStudents = await db
      .select({ rollNumber: students.rollNumber })
      .from(students)
      .where(eq(students.classroomId, classroom.id));
    const normRoll = payload.rollNumber.trim();
    if (existingStudents.some((s) => s.rollNumber.toLowerCase() === normRoll.toLowerCase())) {
      throw new ValidationError('A student with this roll number already exists in the selected classroom.');
    }

    const inserted = await db
      .insert(students)
      .values({
        studentName: payload.studentName.trim(),
        email: payload.email.trim().toLowerCase(),
        rollNumber: normRoll,
        classroomId: classroom.id,
        enrollmentDate: payload.enrollmentDate || new Date().toISOString().slice(0, 10),
        isDemo: Boolean(payload.isDemo) || classroom.isDemo,
      })
      .returning();

    const settings = await getOrCreateSettings(teacherId);
    return buildStudentDtoFromRows(inserted[0], classroom, [], [], settings);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
    console.error('Database error creating student:', error);
    throw new Error('Failed to create student. Please try again later.', { cause: error });
  }
}

export async function updateStudentForTeacher(
  teacherId: number,
  studentId: number,
  payload: {
    studentName?: string;
    email?: string;
    rollNumber?: string;
    classroomId: number;
    enrollmentDate?: string;
  }
) {
  try {
    const existingRows = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    const st = existingRows[0];
    if (!st) throw new NotFoundError('Student not found.');

    const ownedClass = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, st.classroomId), eq(classrooms.teacherId, teacherId)))
      .limit(1);
    if (!ownedClass[0]) throw new NotFoundError('Student not found.');

    const targetClassRows = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, payload.classroomId), eq(classrooms.teacherId, teacherId)))
      .limit(1);
    if (!targetClassRows[0]) throw new NotFoundError('Target classroom not found.');

    const nextRoll = (payload.rollNumber || st.rollNumber).trim();
    const classmates = await db
      .select({ id: students.id, rollNumber: students.rollNumber })
      .from(students)
      .where(eq(students.classroomId, targetClassRows[0].id));
    if (classmates.some((c) => c.id !== studentId && c.rollNumber.toLowerCase() === nextRoll.toLowerCase())) {
      throw new ValidationError('A student with this roll number already exists in the selected classroom.');
    }

    await db
      .update(students)
      .set({
        studentName: (payload.studentName || st.studentName).trim(),
        email: (payload.email || st.email).trim().toLowerCase(),
        rollNumber: nextRoll,
        classroomId: targetClassRows[0].id,
        enrollmentDate: payload.enrollmentDate || st.enrollmentDate,
      })
      .where(eq(students.id, studentId));

    return await getStudentForTeacher(teacherId, studentId);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
    console.error('Database error updating student:', error);
    throw new Error('Failed to update student. Please try again later.', { cause: error });
  }
}

export async function deleteStudentForTeacher(teacherId: number, studentId: number) {
  try {
    const stRows = await db.select().from(students).where(eq(students.id, studentId)).limit(1);
    const st = stRows[0];
    if (!st) throw new NotFoundError('Student not found.');

    const ownedClass = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, st.classroomId), eq(classrooms.teacherId, teacherId)))
      .limit(1);
    if (!ownedClass[0]) throw new NotFoundError('Student not found.');

    await db.delete(students).where(eq(students.id, studentId));
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error deleting student:', error);
    throw new Error('Failed to delete student. Please try again later.', { cause: error });
  }
}

function serializeSession(
  s: typeof monitoringSessions.$inferSelect,
  classroom?: typeof classrooms.$inferSelect,
  records?: Array<{
    id: number;
    sessionId: number;
    studentId: number | null;
    studentName: string | null;
    timestamp: string;
    facePresenceScore: number;
    attentionOrientationScore: number;
    participationScore: number | null;
    finalEngagementScore: number;
    detectedFacesCount: number;
    dataQualityStatus: string;
  }>
) {
  return {
    id: s.id,
    sessionTitle: s.sessionTitle,
    classroomId: s.classroomId,
    teacherId: s.teacherId,
    startTime: s.startTime.toISOString(),
    endTime: s.endTime ? s.endTime.toISOString() : null,
    duration: s.duration,
    averageEngagement: s.averageEngagement,
    attendancePercentage: s.attendancePercentage,
    status: s.status as 'ACTIVE' | 'PAUSED' | 'COMPLETED',
    mode: s.mode as 'LIVE' | 'DEMO',
    isDemo: s.isDemo,
    classroomName: classroom?.classroomName || 'Unknown Classroom',
    subject: classroom?.subject || '',
    records: records ?? [],
  };
}

export async function startMonitoringSession(
  teacherId: number,
  payload: { classroomId: number; sessionTitle: string; mode?: string }
) {
  try {
    const classRows = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, payload.classroomId), eq(classrooms.teacherId, teacherId)))
      .limit(1);
    const classroom = classRows[0];
    if (!classroom) throw new NotFoundError('Selected classroom not found.');

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayAtt = await db
      .select()
      .from(attendance)
      .where(and(eq(attendance.classroomId, classroom.id), eq(attendance.date, todayStr)));
    const presentCount = todayAtt.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
    const attPct = todayAtt.length > 0 ? round1((presentCount * 100) / todayAtt.length) : 0;

    const sessionMode = payload.mode === 'DEMO' ? 'DEMO' : 'LIVE';
    const inserted = await db
      .insert(monitoringSessions)
      .values({
        sessionTitle: payload.sessionTitle.trim(),
        classroomId: classroom.id,
        teacherId,
        startTime: new Date(),
        endTime: null,
        duration: 0,
        averageEngagement: 0,
        attendancePercentage: attPct,
        status: 'ACTIVE',
        mode: sessionMode,
        isDemo: sessionMode === 'DEMO' || classroom.isDemo,
      })
      .returning();

    return serializeSession(inserted[0], classroom, []);
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error starting monitoring session:', error);
    throw new Error('Failed to start monitoring session. Please try again later.', { cause: error });
  }
}

export async function recordSessionMetrics(
  teacherId: number,
  sessionId: number,
  payload: {
    studentId?: number | null;
    facePresenceScore?: number;
    attentionOrientationScore?: number;
    participationScore?: number | null;
    detectedFacesCount?: number;
    dataQualityStatus?: string;
  }
) {
  try {
    const sessRows = await db
      .select()
      .from(monitoringSessions)
      .where(and(eq(monitoringSessions.id, sessionId), eq(monitoringSessions.teacherId, teacherId)))
      .limit(1);
    const session = sessRows[0];
    if (!session) throw new NotFoundError('Monitoring session not found.');
    if (session.status !== 'ACTIVE') {
      throw new ValidationError(`Session is ${session.status} and cannot accept metrics.`);
    }

    const settings = await getOrCreateSettings(teacherId);
    const partScore =
      payload.participationScore !== undefined && payload.participationScore !== null
        ? Number(payload.participationScore)
        : null;
    const faceScore = Number(payload.facePresenceScore ?? 0);
    const attScore = Number(payload.attentionOrientationScore ?? 0);
    const finalScore = calculateEngagementScore(attScore, faceScore, partScore, settings);

    const inserted = await db
      .insert(engagementRecords)
      .values({
        sessionId: session.id,
        studentId: payload.studentId ? Number(payload.studentId) : null,
        timestamp: new Date(),
        facePresenceScore: faceScore,
        attentionOrientationScore: attScore,
        participationScore: partScore,
        finalEngagementScore: finalScore,
        detectedFacesCount: Number(payload.detectedFacesCount ?? 0),
        dataQualityStatus: payload.dataQualityStatus || 'RELIABLE',
      })
      .returning();

    const record = inserted[0];

    const allSessionRecords = await db
      .select()
      .from(engagementRecords)
      .where(eq(engagementRecords.sessionId, session.id));
    const reliable = allSessionRecords.filter(
      (r) => r.dataQualityStatus !== 'INSUFFICIENT_VISUAL_DATA'
    );
    if (reliable.length > 0) {
      const avg = round1(
        reliable.reduce((a, b) => a + b.finalEngagementScore, 0) / reliable.length
      );
      await db
        .update(monitoringSessions)
        .set({ averageEngagement: avg })
        .where(eq(monitoringSessions.id, session.id));
    }

    let studentName: string | null = null;
    if (record.studentId) {
      const st = await db
        .select({ studentName: students.studentName })
        .from(students)
        .where(eq(students.id, record.studentId))
        .limit(1);
      studentName = st[0]?.studentName || null;
    }

    return {
      id: record.id,
      sessionId: record.sessionId,
      studentId: record.studentId,
      studentName,
      timestamp: record.timestamp.toISOString(),
      facePresenceScore: record.facePresenceScore,
      attentionOrientationScore: record.attentionOrientationScore,
      participationScore: record.participationScore,
      finalEngagementScore: record.finalEngagementScore,
      detectedFacesCount: record.detectedFacesCount,
      dataQualityStatus: record.dataQualityStatus,
    };
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
    console.error('Database error recording session metrics:', error);
    throw new Error('Failed to record engagement metrics. Please try again later.', { cause: error });
  }
}

export async function recordParticipationEvent(
  teacherId: number,
  sessionId: number,
  payload: { studentId?: number | null; eventType?: string; scoreValue?: number }
) {
  try {
    const sessRows = await db
      .select()
      .from(monitoringSessions)
      .where(and(eq(monitoringSessions.id, sessionId), eq(monitoringSessions.teacherId, teacherId)))
      .limit(1);
    if (!sessRows[0]) throw new NotFoundError('Monitoring session not found.');

    await db.insert(participationEvents).values({
      studentId: payload.studentId ? Number(payload.studentId) : null,
      sessionId,
      eventType: payload.eventType || 'CLASSROOM_INTERACTION',
      scoreValue: Number(payload.scoreValue ?? 85),
      timestamp: new Date(),
      recordedBy: teacherId,
    });
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error recording participation event:', error);
    throw new Error('Failed to record participation event. Please try again later.', { cause: error });
  }
}

export async function updateSessionLifecycle(
  teacherId: number,
  sessionId: number,
  action: 'PAUSE' | 'RESUME' | 'STOP',
  durationSeconds?: number
) {
  try {
    const sessRows = await db
      .select()
      .from(monitoringSessions)
      .where(and(eq(monitoringSessions.id, sessionId), eq(monitoringSessions.teacherId, teacherId)))
      .limit(1);
    const session = sessRows[0];
    if (!session) throw new NotFoundError('Monitoring session not found.');
    if (session.status === 'COMPLETED') {
      throw new ValidationError('Session is already stopped.');
    }

    const classRows = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, session.classroomId))
      .limit(1);

    if (action === 'PAUSE') {
      const updated = await db
        .update(monitoringSessions)
        .set({ status: 'PAUSED' })
        .where(eq(monitoringSessions.id, sessionId))
        .returning();
      return serializeSession(updated[0], classRows[0]);
    }

    if (action === 'RESUME') {
      const updated = await db
        .update(monitoringSessions)
        .set({ status: 'ACTIVE' })
        .where(eq(monitoringSessions.id, sessionId))
        .returning();
      return serializeSession(updated[0], classRows[0]);
    }

    const endTime = new Date();
    const elapsed = durationSeconds
      ? Number(durationSeconds)
      : Math.max(1, Math.round((endTime.getTime() - session.startTime.getTime()) / 1000));

    const updated = await db
      .update(monitoringSessions)
      .set({
        endTime,
        duration: elapsed,
        status: 'COMPLETED',
      })
      .where(eq(monitoringSessions.id, sessionId))
      .returning();

    const recs = await getSessionRecordsWithNames(sessionId);
    return serializeSession(updated[0], classRows[0], recs);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
    console.error('Database error updating session lifecycle:', error);
    throw new Error('Failed to update monitoring session state. Please try again later.', {
      cause: error,
    });
  }
}

async function getSessionRecordsWithNames(sessionId: number) {
  const recs = await db
    .select()
    .from(engagementRecords)
    .where(eq(engagementRecords.sessionId, sessionId))
    .orderBy(asc(engagementRecords.timestamp));
  const studentIds = Array.from(
    new Set(recs.map((r) => r.studentId).filter((id): id is number => id !== null))
  );
  const studentRows =
    studentIds.length > 0
      ? await db
          .select({ id: students.id, studentName: students.studentName })
          .from(students)
          .where(inArray(students.id, studentIds))
      : [];
  const studentMap = new Map(studentRows.map((s) => [s.id, s.studentName]));

  return recs.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    studentId: r.studentId,
    studentName: r.studentId ? studentMap.get(r.studentId) || null : null,
    timestamp: r.timestamp.toISOString(),
    facePresenceScore: r.facePresenceScore,
    attentionOrientationScore: r.attentionOrientationScore,
    participationScore: r.participationScore,
    finalEngagementScore: r.finalEngagementScore,
    detectedFacesCount: r.detectedFacesCount,
    dataQualityStatus: r.dataQualityStatus,
  }));
}

export async function listSessionsForTeacher(teacherId: number) {
  try {
    const sessRows = await db
      .select()
      .from(monitoringSessions)
      .where(eq(monitoringSessions.teacherId, teacherId))
      .orderBy(desc(monitoringSessions.startTime));

    if (sessRows.length === 0) return [];
    const classRows = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.teacherId, teacherId));
    const classMap = new Map(classRows.map((c) => [c.id, c]));

    return sessRows.map((s) => serializeSession(s, classMap.get(s.classroomId), []));
  } catch (error) {
    console.error('Database error listing sessions:', error);
    throw new Error('Failed to load monitoring sessions. Please try again later.', { cause: error });
  }
}

export async function getSessionForTeacher(teacherId: number, sessionId: number) {
  try {
    const sessRows = await db
      .select()
      .from(monitoringSessions)
      .where(and(eq(monitoringSessions.id, sessionId), eq(monitoringSessions.teacherId, teacherId)))
      .limit(1);
    const session = sessRows[0];
    if (!session) throw new NotFoundError('Monitoring session not found.');

    const classRows = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, session.classroomId))
      .limit(1);
    const recs = await getSessionRecordsWithNames(session.id);
    return serializeSession(session, classRows[0], recs);
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error getting session:', error);
    throw new Error('Failed to fetch monitoring session. Please try again later.', { cause: error });
  }
}

export async function deleteSessionForTeacher(teacherId: number, sessionId: number) {
  try {
    const deleted = await db
      .delete(monitoringSessions)
      .where(and(eq(monitoringSessions.id, sessionId), eq(monitoringSessions.teacherId, teacherId)))
      .returning({ id: monitoringSessions.id });
    if (!deleted[0]) throw new NotFoundError('Session not found.');
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error deleting session:', error);
    throw new Error('Failed to delete session. Please try again later.', { cause: error });
  }
}

export async function listAttendanceForTeacher(
  teacherId: number,
  filters?: { classroomId?: number | null; date?: string | null }
) {
  try {
    const classRows = await db.select().from(classrooms).where(eq(classrooms.teacherId, teacherId));
    if (classRows.length === 0) return [];

    const classMap = new Map(classRows.map((c) => [c.id, c]));
    let targetClassIds = classRows.map((c) => c.id);
    if (filters?.classroomId) {
      if (!classMap.has(filters.classroomId)) return [];
      targetClassIds = [filters.classroomId];
    }

    const attRows = filters?.date
      ? await db
          .select()
          .from(attendance)
          .where(and(inArray(attendance.classroomId, targetClassIds), eq(attendance.date, filters.date)))
          .orderBy(desc(attendance.date))
      : await db
          .select()
          .from(attendance)
          .where(inArray(attendance.classroomId, targetClassIds))
          .orderBy(desc(attendance.date));

    if (attRows.length === 0) return [];
    const studentIds = Array.from(new Set(attRows.map((a) => a.studentId)));
    const studentRows = await db
      .select()
      .from(students)
      .where(inArray(students.id, studentIds));
    const studentMap = new Map(studentRows.map((s) => [s.id, s]));

    return attRows.map((a) => {
      const st = studentMap.get(a.studentId);
      const cl = classMap.get(a.classroomId);
      return {
        id: a.id,
        studentId: a.studentId,
        studentName: st?.studentName || 'Unknown',
        rollNumber: st?.rollNumber || '',
        classroomId: a.classroomId,
        classroomName: cl?.classroomName || 'Unknown',
        date: a.date,
        status: a.status as 'PRESENT' | 'ABSENT' | 'LATE',
        isDemo: a.isDemo,
        updatedAt: a.updatedAt.toISOString(),
      };
    });
  } catch (error) {
    console.error('Database error listing attendance:', error);
    throw new Error('Failed to load attendance records. Please try again later.', { cause: error });
  }
}

export async function markAttendanceForTeacher(
  teacherId: number,
  payload: { studentId: number; classroomId: number; date: string; status: 'PRESENT' | 'ABSENT' | 'LATE' }
) {
  try {
    const classRows = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, payload.classroomId), eq(classrooms.teacherId, teacherId)))
      .limit(1);
    const classroom = classRows[0];

    const studentRows = await db
      .select()
      .from(students)
      .where(and(eq(students.id, payload.studentId), eq(students.classroomId, payload.classroomId)))
      .limit(1);
    const student = studentRows[0];

    if (!classroom || !student) {
      throw new NotFoundError('Student or classroom not found.');
    }

    const upserted = await db
      .insert(attendance)
      .values({
        studentId: student.id,
        classroomId: classroom.id,
        date: payload.date,
        status: payload.status,
        isDemo: classroom.isDemo || student.isDemo,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [attendance.studentId, attendance.date],
        set: {
          status: payload.status,
          classroomId: classroom.id,
          updatedAt: new Date(),
        },
      })
      .returning();

    const row = upserted[0];
    return {
      id: row.id,
      studentId: row.studentId,
      studentName: student.studentName,
      rollNumber: student.rollNumber,
      classroomId: row.classroomId,
      classroomName: classroom.classroomName,
      date: row.date,
      status: row.status as 'PRESENT' | 'ABSENT' | 'LATE',
      isDemo: row.isDemo,
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error marking attendance:', error);
    throw new Error('Failed to save attendance record. Please try again later.', { cause: error });
  }
}

export async function updateAttendanceRecordForTeacher(
  teacherId: number,
  attendanceId: number,
  status: 'PRESENT' | 'ABSENT' | 'LATE'
) {
  try {
    const rows = await db.select().from(attendance).where(eq(attendance.id, attendanceId)).limit(1);
    const att = rows[0];
    if (!att) throw new NotFoundError('Attendance record not found.');

    const classRows = await db
      .select()
      .from(classrooms)
      .where(and(eq(classrooms.id, att.classroomId), eq(classrooms.teacherId, teacherId)))
      .limit(1);
    const classroom = classRows[0];
    if (!classroom) throw new NotFoundError('Attendance record not found.');

    const updated = await db
      .update(attendance)
      .set({ status, updatedAt: new Date() })
      .where(eq(attendance.id, attendanceId))
      .returning();

    const stRows = await db.select().from(students).where(eq(students.id, att.studentId)).limit(1);
    const row = updated[0];

    return {
      id: row.id,
      studentId: row.studentId,
      studentName: stRows[0]?.studentName || '',
      rollNumber: stRows[0]?.rollNumber || '',
      classroomId: row.classroomId,
      classroomName: classroom.classroomName,
      date: row.date,
      status: row.status as 'PRESENT' | 'ABSENT' | 'LATE',
      isDemo: row.isDemo,
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error updating attendance:', error);
    throw new Error('Failed to update attendance record. Please try again later.', { cause: error });
  }
}

export async function getDashboardAnalyticsForTeacher(teacher: TeacherRow) {
  try {
    const [settings, classRows, studentDtos, sessRows] = await Promise.all([
      getOrCreateSettings(teacher.id),
      db.select().from(classrooms).where(eq(classrooms.teacherId, teacher.id)),
      listStudentsForTeacher(teacher.id),
      db
        .select()
        .from(monitoringSessions)
        .where(eq(monitoringSessions.teacherId, teacher.id))
        .orderBy(desc(monitoringSessions.startTime)),
    ]);

    const classMap = new Map(classRows.map((c) => [c.id, c]));
    const classIds = classRows.map((c) => c.id);
    const attRows =
      classIds.length > 0
        ? await db.select().from(attendance).where(inArray(attendance.classroomId, classIds))
        : [];

    const validSessions = sessRows.filter((s) => s.averageEngagement > 0);
    const avgEngagement =
      validSessions.length > 0
        ? round1(validSessions.reduce((a, b) => a + b.averageEngagement, 0) / validSessions.length)
        : 0;
    const presentCount = attRows.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length;
    const avgAttendance = attRows.length > 0 ? round1((presentCount * 100) / attRows.length) : 0;

    const highCount = studentDtos.filter((s) => s.engagementCategory === 'High').length;
    const modCount = studentDtos.filter((s) => s.engagementCategory === 'Moderate').length;
    const lowCount = studentDtos.filter((s) => s.engagementCategory === 'Low').length;

    const studentsRequiringAttention = studentDtos.filter(
      (s) => s.sessionsAttended > 0 && s.averageEngagement < settings.moderateThreshold
    );

    return {
      totalStudents: studentDtos.length,
      totalClassrooms: classRows.length,
      averageEngagement: avgEngagement,
      averageAttendance: avgAttendance,
      sessionsConducted: sessRows.length,
      hasDemoData: classRows.some((c) => c.isDemo) || sessRows.some((s) => s.isDemo),
      distribution: [
        { name: 'High Engagement', value: highCount },
        { name: 'Moderate Engagement', value: modCount },
        { name: 'Low Engagement', value: lowCount },
      ],
      recentSessions: sessRows.slice(0, 6).map((s) => ({
        id: s.id,
        sessionTitle: s.sessionTitle,
        classroomId: s.classroomId,
        classroomName: classMap.get(s.classroomId)?.classroomName || '',
        startTime: s.startTime.toISOString(),
        duration: s.duration,
        averageEngagement: s.averageEngagement,
        attendancePercentage: s.attendancePercentage,
        status: s.status,
        mode: s.mode,
        isDemo: s.isDemo,
      })),
      studentsRequiringAttention,
    };
  } catch (error) {
    console.error('Database error computing dashboard analytics:', error);
    throw new Error('Failed to load dashboard analytics. Please try again later.', { cause: error });
  }
}

export async function getEngagementTrendsForTeacher(teacherId: number) {
  try {
    const [sessRows, classRows] = await Promise.all([
      db
        .select()
        .from(monitoringSessions)
        .where(eq(monitoringSessions.teacherId, teacherId))
        .orderBy(asc(monitoringSessions.startTime)),
      db.select().from(classrooms).where(eq(classrooms.teacherId, teacherId)),
    ]);
    const classMap = new Map(classRows.map((c) => [c.id, c]));

    return {
      trends: sessRows.map((s) => ({
        sessionId: s.id,
        sessionTitle: s.sessionTitle,
        classroomName: classMap.get(s.classroomId)?.classroomName || '',
        date: s.startTime.toISOString(),
        averageEngagement: s.averageEngagement,
        attendancePercentage: s.attendancePercentage,
        duration: s.duration,
        isDemo: s.isDemo,
      })),
    };
  } catch (error) {
    console.error('Database error computing engagement trends:', error);
    throw new Error('Failed to load engagement trends. Please try again later.', { cause: error });
  }
}

export async function getStudentAnalyticsForTeacher(teacherId: number, studentId: number) {
  try {
    const studentDto = await getStudentForTeacher(teacherId, studentId);
    const recs = await db
      .select()
      .from(engagementRecords)
      .where(eq(engagementRecords.studentId, studentId))
      .orderBy(asc(engagementRecords.timestamp));

    const sessionIds = Array.from(new Set(recs.map((r) => r.sessionId)));
    const sessRows =
      sessionIds.length > 0
        ? await db
            .select()
            .from(monitoringSessions)
            .where(inArray(monitoringSessions.id, sessionIds))
        : [];
    const sessMap = new Map(sessRows.map((s) => [s.id, s]));

    const history = recs.map((r) => {
      const sess = sessMap.get(r.sessionId);
      return {
        recordId: r.id,
        sessionId: r.sessionId,
        sessionTitle: sess?.sessionTitle || `Session #${r.sessionId}`,
        timestamp: r.timestamp.toISOString(),
        facePresenceScore: r.facePresenceScore,
        attentionOrientationScore: r.attentionOrientationScore,
        participationScore: r.participationScore,
        finalEngagementScore: r.finalEngagementScore,
        dataQualityStatus: r.dataQualityStatus,
        isDemo: sess?.isDemo || false,
      };
    });

    return { student: studentDto, history };
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error getting student analytics:', error);
    throw new Error('Failed to load student analytics. Please try again later.', { cause: error });
  }
}

export async function getSessionAnalyticsForTeacher(teacherId: number, sessionId: number) {
  try {
    const sessRows = await db
      .select()
      .from(monitoringSessions)
      .where(and(eq(monitoringSessions.id, sessionId), eq(monitoringSessions.teacherId, teacherId)))
      .limit(1);
    const session = sessRows[0];
    if (!session) throw new NotFoundError('Session not found.');

    const recs = await db
      .select()
      .from(engagementRecords)
      .where(eq(engagementRecords.sessionId, session.id));
    const scores = recs.map((r) => r.finalEngagementScore);

    return {
      sessionId: session.id,
      sessionTitle: session.sessionTitle,
      duration: session.duration,
      averageEngagement: session.averageEngagement,
      highestEngagement: scores.length ? Math.max(...scores) : 0,
      lowestEngagement: scores.length ? Math.min(...scores) : 0,
      attendancePercentage: session.attendancePercentage,
      recordsCount: recs.length,
    };
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error getting session analytics:', error);
    throw new Error('Failed to load session analytics. Please try again later.', { cause: error });
  }
}

export async function getEngagementReportForTeacher(teacher: TeacherRow, classroomId?: number | null) {
  try {
    const allClassrooms = await listClassroomsForTeacher(teacher);
    const filteredClassrooms = classroomId
      ? allClassrooms.filter((c) => c.id === classroomId)
      : allClassrooms;
    const classMap = new Map(allClassrooms.map((c) => [c.id, c]));

    const sessRows = classroomId
      ? await db
          .select()
          .from(monitoringSessions)
          .where(
            and(
              eq(monitoringSessions.teacherId, teacher.id),
              eq(monitoringSessions.classroomId, classroomId)
            )
          )
          .orderBy(desc(monitoringSessions.startTime))
      : await db
          .select()
          .from(monitoringSessions)
          .where(eq(monitoringSessions.teacherId, teacher.id))
          .orderBy(desc(monitoringSessions.startTime));

    return {
      reportType: 'CLASSROOM_ENGAGEMENT_REPORT',
      generatedAt: new Date().toISOString(),
      classrooms: filteredClassrooms,
      sessions: sessRows.map((s) => ({
        id: s.id,
        sessionTitle: s.sessionTitle,
        classroomId: s.classroomId,
        teacherId: s.teacherId,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime ? s.endTime.toISOString() : null,
        duration: s.duration,
        averageEngagement: s.averageEngagement,
        attendancePercentage: s.attendancePercentage,
        status: s.status,
        mode: s.mode,
        isDemo: s.isDemo,
        classroomName: classMap.get(s.classroomId)?.classroomName || '',
      })),
      methodology:
        'Engagement Score = 50% Attention Orientation + 30% Face Presence + 20% Participation (renormalized when participation data is unavailable). Visual indicators are approximate signals for teacher review and never proof of mental focus.',
    };
  } catch (error) {
    console.error('Database error generating engagement report:', error);
    throw new Error('Failed to generate engagement report. Please try again later.', { cause: error });
  }
}

export async function getAttendanceReportForTeacher(teacherId: number, classroomId?: number | null) {
  try {
    const records = await listAttendanceForTeacher(teacherId, { classroomId });
    const presentCount = records.filter((r) => r.status === 'PRESENT').length;
    const lateCount = records.filter((r) => r.status === 'LATE').length;
    const absentCount = records.filter((r) => r.status === 'ABSENT').length;
    const attendanceRate =
      records.length > 0 ? round1(((presentCount + lateCount) * 100) / records.length) : 0;

    return {
      reportType: 'ATTENDANCE_REPORT',
      generatedAt: new Date().toISOString(),
      totalRecords: records.length,
      presentCount,
      lateCount,
      absentCount,
      attendanceRate,
      records,
    };
  } catch (error) {
    console.error('Database error generating attendance report:', error);
    throw new Error('Failed to generate attendance report. Please try again later.', { cause: error });
  }
}

export async function getSessionReportForTeacher(teacherId: number, sessionId: number) {
  try {
    const sessionDto = await getSessionForTeacher(teacherId, sessionId);
    const records = sessionDto.records || [];
    const scores = records.map((r) => r.finalEngagementScore);

    return {
      reportType: 'SESSION_SUMMARY_REPORT',
      generatedAt: new Date().toISOString(),
      session: sessionDto,
      analytics: {
        highestEngagement: scores.length ? Math.max(...scores) : 0,
        lowestEngagement: scores.length ? Math.min(...scores) : 0,
        recordsCount: records.length,
      },
      methodology:
        'MediaPipe Face Landmarker extracts facial presence and head orientation indicators locally in the browser; no raw video frames or facial images are stored.',
    };
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    console.error('Database error generating session report:', error);
    throw new Error('Failed to generate session report. Please try again later.', { cause: error });
  }
}

export async function getSettingsDtoForTeacher(teacherId: number) {
  const s = await getOrCreateSettings(teacherId);
  return formatSettingsDto(s);
}

export async function updateSettingsForTeacher(
  teacherId: number,
  payload: {
    attentionWeight: number;
    presenceWeight: number;
    participationWeight: number;
    includeParticipation: boolean;
    highThreshold: number;
    moderateThreshold: number;
    samplingInterval?: number;
    preferredCameraLabel?: string;
    retentionDays?: number;
  }
) {
  try {
    await getOrCreateSettings(teacherId);
    const updated = await db
      .update(teacherSettings)
      .set({
        attentionWeight: payload.attentionWeight,
        presenceWeight: payload.presenceWeight,
        participationWeight: payload.participationWeight,
        includeParticipation: payload.includeParticipation,
        highThreshold: payload.highThreshold,
        moderateThreshold: payload.moderateThreshold,
        samplingInterval: Math.max(1, Math.min(30, Number(payload.samplingInterval || 3))),
        preferredCameraLabel: payload.preferredCameraLabel || 'Default Classroom Camera',
        retentionDays: Math.max(7, Math.min(365, Number(payload.retentionDays || 90))),
      })
      .where(eq(teacherSettings.teacherId, teacherId))
      .returning();

    return formatSettingsDto(updated[0]);
  } catch (error) {
    console.error('Database error updating teacher settings:', error);
    throw new Error('Failed to update settings. Please try again later.', { cause: error });
  }
}

export async function seedDemoWorkspaceForTeacher(teacherId: number) {
  try {
    const existingDemo = await db
      .select({ id: classrooms.id })
      .from(classrooms)
      .where(and(eq(classrooms.teacherId, teacherId), eq(classrooms.isDemo, true)))
      .limit(1);

    if (existingDemo.length > 0) {
      return { message: 'Demo classroom and sample data already present in your workspace.' };
    }

    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
    const todayStr = now.toISOString().slice(0, 10);
    const yestStr = daysAgo(1).toISOString().slice(0, 10);

    const insertedClasses = await db
      .insert(classrooms)
      .values([
        {
          classroomName: 'CS-301 Data Structures & Algorithms [DEMO]',
          subject: 'Data Structures & Algorithms',
          section: 'CSE-A',
          academicYear: '2026-27',
          description:
            'Demonstration classroom with historical simulated session metrics for academic review.',
          isDemo: true,
          teacherId,
          createdAt: daysAgo(20),
        },
        {
          classroomName: 'CS-402 Machine Learning Foundations [DEMO]',
          subject: 'Machine Learning',
          section: 'CSE-B',
          academicYear: '2026-27',
          description:
            'Upper-division seminar classroom used for simulated engagement trend comparison.',
          isDemo: true,
          teacherId,
          createdAt: daysAgo(15),
        },
      ])
      .returning();

    const c1 = insertedClasses[0];
    const c2 = insertedClasses[1];

    const insertedStudents = await db
      .insert(students)
      .values([
        { studentName: 'Aarav Kulkarni', email: 'aarav.k@student.edu', rollNumber: '23CSE001', classroomId: c1.id, enrollmentDate: '2026-08-01', isDemo: true, createdAt: daysAgo(20) },
        { studentName: 'Diya Menon', email: 'diya.m@student.edu', rollNumber: '23CSE002', classroomId: c1.id, enrollmentDate: '2026-08-01', isDemo: true, createdAt: daysAgo(20) },
        { studentName: 'Rohan Deshmukh', email: 'rohan.d@student.edu', rollNumber: '23CSE003', classroomId: c1.id, enrollmentDate: '2026-08-01', isDemo: true, createdAt: daysAgo(20) },
        { studentName: 'Meera Nair', email: 'meera.n@student.edu', rollNumber: '23CSE004', classroomId: c1.id, enrollmentDate: '2026-08-01', isDemo: true, createdAt: daysAgo(20) },
        { studentName: 'Kabir Verma', email: 'kabir.v@student.edu', rollNumber: '23CSE005', classroomId: c1.id, enrollmentDate: '2026-08-01', isDemo: true, createdAt: daysAgo(20) },
        { studentName: 'Sanya Iyer', email: 'sanya.i@student.edu', rollNumber: '23CSE006', classroomId: c1.id, enrollmentDate: '2026-08-01', isDemo: true, createdAt: daysAgo(20) },
        { studentName: 'Vikram Joshi', email: 'vikram.j@student.edu', rollNumber: '22CSE101', classroomId: c2.id, enrollmentDate: '2026-08-01', isDemo: true, createdAt: daysAgo(15) },
        { studentName: 'Priya Kapoor', email: 'priya.k@student.edu', rollNumber: '22CSE102', classroomId: c2.id, enrollmentDate: '2026-08-01', isDemo: true, createdAt: daysAgo(15) },
        { studentName: 'Ishaan Gupta', email: 'ishaan.g@student.edu', rollNumber: '22CSE103', classroomId: c2.id, enrollmentDate: '2026-08-01', isDemo: true, createdAt: daysAgo(15) },
        { studentName: 'Neha Chatterjee', email: 'neha.c@student.edu', rollNumber: '22CSE104', classroomId: c2.id, enrollmentDate: '2026-08-01', isDemo: true, createdAt: daysAgo(15) },
      ])
      .returning();

    const [st1, st2, st3, st4, st5, st6, st7, st8, st9, st10] = insertedStudents;

    const insertedSessions = await db
      .insert(monitoringSessions)
      .values([
        {
          sessionTitle: 'Graph Traversal & BFS/DFS [DEMO]',
          classroomId: c1.id,
          teacherId,
          startTime: daysAgo(6),
          endTime: daysAgo(6),
          duration: 2700,
          averageEngagement: 72.7,
          attendancePercentage: 83.3,
          status: 'COMPLETED',
          mode: 'DEMO',
          isDemo: true,
        },
        {
          sessionTitle: 'Dynamic Programming Memoization [DEMO]',
          classroomId: c1.id,
          teacherId,
          startTime: daysAgo(3),
          endTime: daysAgo(3),
          duration: 3000,
          averageEngagement: 64.4,
          attendancePercentage: 83.3,
          status: 'COMPLETED',
          mode: 'DEMO',
          isDemo: true,
        },
        {
          sessionTitle: 'Linear Regression & Gradient Descent [DEMO]',
          classroomId: c2.id,
          teacherId,
          startTime: daysAgo(2),
          endTime: daysAgo(2),
          duration: 2400,
          averageEngagement: 81.7,
          attendancePercentage: 100.0,
          status: 'COMPLETED',
          mode: 'DEMO',
          isDemo: true,
        },
      ])
      .returning();

    const [sess1, sess2, sess3] = insertedSessions;

    await db.insert(engagementRecords).values([
      { sessionId: sess1.id, studentId: st1.id, timestamp: daysAgo(6), facePresenceScore: 94, attentionOrientationScore: 86, participationScore: 85, finalEngagementScore: 88.2, detectedFacesCount: 1, dataQualityStatus: 'SIMULATED_DEMO' },
      { sessionId: sess1.id, studentId: st2.id, timestamp: daysAgo(6), facePresenceScore: 96, attentionOrientationScore: 88, participationScore: 90, finalEngagementScore: 90.8, detectedFacesCount: 1, dataQualityStatus: 'SIMULATED_DEMO' },
      { sessionId: sess1.id, studentId: st3.id, timestamp: daysAgo(6), facePresenceScore: 62, attentionOrientationScore: 44, participationScore: null, finalEngagementScore: 50.8, detectedFacesCount: 1, dataQualityStatus: 'SIMULATED_DEMO' },
      { sessionId: sess1.id, studentId: st4.id, timestamp: daysAgo(6), facePresenceScore: 85, attentionOrientationScore: 76, participationScore: 80, finalEngagementScore: 79.5, detectedFacesCount: 1, dataQualityStatus: 'SIMULATED_DEMO' },
      { sessionId: sess1.id, studentId: st5.id, timestamp: daysAgo(6), facePresenceScore: 54, attentionOrientationScore: 38, participationScore: null, finalEngagementScore: 44.0, detectedFacesCount: 1, dataQualityStatus: 'SIMULATED_DEMO' },
      { sessionId: sess1.id, studentId: st6.id, timestamp: daysAgo(6), facePresenceScore: 90, attentionOrientationScore: 82, participationScore: 75, finalEngagementScore: 83.0, detectedFacesCount: 1, dataQualityStatus: 'SIMULATED_DEMO' },
      { sessionId: sess2.id, studentId: st1.id, timestamp: daysAgo(3), facePresenceScore: 90, attentionOrientationScore: 82, participationScore: 85, finalEngagementScore: 85.0, detectedFacesCount: 1, dataQualityStatus: 'SIMULATED_DEMO' },
      { sessionId: sess2.id, studentId: st2.id, timestamp: daysAgo(3), facePresenceScore: 92, attentionOrientationScore: 84, participationScore: 80, finalEngagementScore: 85.6, detectedFacesCount: 1, dataQualityStatus: 'SIMULATED_DEMO' },
      { sessionId: sess2.id, studentId: st3.id, timestamp: daysAgo(3), facePresenceScore: 55, attentionOrientationScore: 40, participationScore: null, finalEngagementScore: 45.6, detectedFacesCount: 1, dataQualityStatus: 'SIMULATED_DEMO' },
      { sessionId: sess2.id, studentId: st5.id, timestamp: daysAgo(3), facePresenceScore: 50, attentionOrientationScore: 36, participationScore: null, finalEngagementScore: 41.3, detectedFacesCount: 1, dataQualityStatus: 'SIMULATED_DEMO' },
      { sessionId: sess3.id, studentId: st7.id, timestamp: daysAgo(2), facePresenceScore: 92, attentionOrientationScore: 85, participationScore: 88, finalEngagementScore: 87.7, detectedFacesCount: 1, dataQualityStatus: 'SIMULATED_DEMO' },
      { sessionId: sess3.id, studentId: st8.id, timestamp: daysAgo(2), facePresenceScore: 88, attentionOrientationScore: 80, participationScore: 75, finalEngagementScore: 81.4, detectedFacesCount: 1, dataQualityStatus: 'SIMULATED_DEMO' },
      { sessionId: sess3.id, studentId: st9.id, timestamp: daysAgo(2), facePresenceScore: 80, attentionOrientationScore: 74, participationScore: null, finalEngagementScore: 76.3, detectedFacesCount: 1, dataQualityStatus: 'SIMULATED_DEMO' },
      { sessionId: sess3.id, studentId: st10.id, timestamp: daysAgo(2), facePresenceScore: 86, attentionOrientationScore: 78, participationScore: 82, finalEngagementScore: 81.2, detectedFacesCount: 1, dataQualityStatus: 'SIMULATED_DEMO' },
    ]);

    await db.insert(attendance).values([
      { studentId: st1.id, classroomId: c1.id, date: todayStr, status: 'PRESENT', isDemo: true, updatedAt: now },
      { studentId: st2.id, classroomId: c1.id, date: todayStr, status: 'PRESENT', isDemo: true, updatedAt: now },
      { studentId: st3.id, classroomId: c1.id, date: todayStr, status: 'LATE', isDemo: true, updatedAt: now },
      { studentId: st4.id, classroomId: c1.id, date: todayStr, status: 'PRESENT', isDemo: true, updatedAt: now },
      { studentId: st5.id, classroomId: c1.id, date: todayStr, status: 'ABSENT', isDemo: true, updatedAt: now },
      { studentId: st6.id, classroomId: c1.id, date: todayStr, status: 'PRESENT', isDemo: true, updatedAt: now },
      { studentId: st7.id, classroomId: c2.id, date: todayStr, status: 'PRESENT', isDemo: true, updatedAt: now },
      { studentId: st8.id, classroomId: c2.id, date: todayStr, status: 'PRESENT', isDemo: true, updatedAt: now },
      { studentId: st9.id, classroomId: c2.id, date: todayStr, status: 'PRESENT', isDemo: true, updatedAt: now },
      { studentId: st10.id, classroomId: c2.id, date: todayStr, status: 'LATE', isDemo: true, updatedAt: now },
      { studentId: st1.id, classroomId: c1.id, date: yestStr, status: 'PRESENT', isDemo: true, updatedAt: daysAgo(1) },
      { studentId: st2.id, classroomId: c1.id, date: yestStr, status: 'PRESENT', isDemo: true, updatedAt: daysAgo(1) },
      { studentId: st3.id, classroomId: c1.id, date: yestStr, status: 'ABSENT', isDemo: true, updatedAt: daysAgo(1) },
      { studentId: st4.id, classroomId: c1.id, date: yestStr, status: 'PRESENT', isDemo: true, updatedAt: daysAgo(1) },
      { studentId: st5.id, classroomId: c1.id, date: yestStr, status: 'ABSENT', isDemo: true, updatedAt: daysAgo(1) },
      { studentId: st6.id, classroomId: c1.id, date: yestStr, status: 'PRESENT', isDemo: true, updatedAt: daysAgo(1) },
    ]);

    return { message: 'Sample demonstration classroom and metrics added.' };
  } catch (error) {
    console.error('Database error seeding demo workspace:', error);
    throw new Error('Failed to load sample demonstration data. Please try again later.', { cause: error });
  }
}
