import { relations } from 'drizzle-orm';
import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull().default('TEACHER'),
  department: text('department').notNull().default('Computer Science & Engineering'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const teacherSettings = pgTable('teacher_settings', {
  id: serial('id').primaryKey(),
  teacherId: integer('teacher_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  attentionWeight: doublePrecision('attention_weight').notNull().default(50),
  presenceWeight: doublePrecision('presence_weight').notNull().default(30),
  participationWeight: doublePrecision('participation_weight').notNull().default(20),
  includeParticipation: boolean('include_participation').notNull().default(true),
  highThreshold: doublePrecision('high_threshold').notNull().default(75),
  moderateThreshold: doublePrecision('moderate_threshold').notNull().default(50),
  samplingInterval: integer('sampling_interval').notNull().default(3),
  preferredCameraLabel: text('preferred_camera_label')
    .notNull()
    .default('Default Classroom Camera'),
  retentionDays: integer('retention_days').notNull().default(90),
});

export const classrooms = pgTable('classrooms', {
  id: serial('id').primaryKey(),
  classroomName: text('classroom_name').notNull(),
  subject: text('subject').notNull(),
  section: text('section').notNull(),
  academicYear: text('academic_year').notNull(),
  description: text('description').notNull().default(''),
  isDemo: boolean('is_demo').notNull().default(false),
  teacherId: integer('teacher_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const students = pgTable(
  'students',
  {
    id: serial('id').primaryKey(),
    studentName: text('student_name').notNull(),
    email: text('email').notNull(),
    rollNumber: text('roll_number').notNull(),
    classroomId: integer('classroom_id')
      .references(() => classrooms.id, { onDelete: 'cascade' })
      .notNull(),
    enrollmentDate: text('enrollment_date').notNull(),
    isDemo: boolean('is_demo').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('students_classroom_roll_idx').on(table.classroomId, table.rollNumber)]
);

export const monitoringSessions = pgTable('monitoring_sessions', {
  id: serial('id').primaryKey(),
  sessionTitle: text('session_title').notNull(),
  classroomId: integer('classroom_id')
    .references(() => classrooms.id, { onDelete: 'cascade' })
    .notNull(),
  teacherId: integer('teacher_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  startTime: timestamp('start_time', { withTimezone: true }).defaultNow().notNull(),
  endTime: timestamp('end_time', { withTimezone: true }),
  duration: integer('duration').notNull().default(0),
  averageEngagement: doublePrecision('average_engagement').notNull().default(0),
  attendancePercentage: doublePrecision('attendance_percentage').notNull().default(0),
  status: text('status').notNull().default('ACTIVE'),
  mode: text('mode').notNull().default('LIVE'),
  isDemo: boolean('is_demo').notNull().default(false),
});

export const engagementRecords = pgTable('engagement_records', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .references(() => monitoringSessions.id, { onDelete: 'cascade' })
    .notNull(),
  studentId: integer('student_id').references(() => students.id, { onDelete: 'set null' }),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  facePresenceScore: doublePrecision('face_presence_score').notNull().default(0),
  attentionOrientationScore: doublePrecision('attention_orientation_score').notNull().default(0),
  participationScore: doublePrecision('participation_score'),
  finalEngagementScore: doublePrecision('final_engagement_score').notNull().default(0),
  detectedFacesCount: integer('detected_faces_count').notNull().default(0),
  dataQualityStatus: text('data_quality_status').notNull().default('RELIABLE'),
});

export const attendance = pgTable(
  'attendance',
  {
    id: serial('id').primaryKey(),
    studentId: integer('student_id')
      .references(() => students.id, { onDelete: 'cascade' })
      .notNull(),
    classroomId: integer('classroom_id')
      .references(() => classrooms.id, { onDelete: 'cascade' })
      .notNull(),
    date: text('date').notNull(),
    status: text('status').notNull(),
    isDemo: boolean('is_demo').notNull().default(false),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('attendance_student_date_idx').on(table.studentId, table.date)]
);

export const participationEvents = pgTable('participation_events', {
  id: serial('id').primaryKey(),
  studentId: integer('student_id').references(() => students.id, { onDelete: 'set null' }),
  sessionId: integer('session_id')
    .references(() => monitoringSessions.id, { onDelete: 'cascade' })
    .notNull(),
  eventType: text('event_type').notNull().default('CLASSROOM_INTERACTION'),
  scoreValue: doublePrecision('score_value').notNull().default(85),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  recordedBy: integer('recorded_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  settings: one(teacherSettings, {
    fields: [users.id],
    references: [teacherSettings.teacherId],
  }),
  classrooms: many(classrooms),
  sessions: many(monitoringSessions),
}));

export const classroomsRelations = relations(classrooms, ({ one, many }) => ({
  teacher: one(users, {
    fields: [classrooms.teacherId],
    references: [users.id],
  }),
  students: many(students),
  sessions: many(monitoringSessions),
  attendanceRecords: many(attendance),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [students.classroomId],
    references: [classrooms.id],
  }),
  engagementRecords: many(engagementRecords),
  attendanceRecords: many(attendance),
}));

export const sessionsRelations = relations(monitoringSessions, ({ one, many }) => ({
  classroom: one(classrooms, {
    fields: [monitoringSessions.classroomId],
    references: [classrooms.id],
  }),
  teacher: one(users, {
    fields: [monitoringSessions.teacherId],
    references: [users.id],
  }),
  records: many(engagementRecords),
  participationEvents: many(participationEvents),
}));
