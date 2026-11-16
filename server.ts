import express from 'express';
import type { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ZipArchive } from 'archiver';
import dotenv from 'dotenv';
import { requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import { updateUserProfile } from './src/db/users.ts';
import {
  NotFoundError,
  ValidationError,
  createClassroomForTeacher,
  createStudentForTeacher,
  deleteClassroomForTeacher,
  deleteSessionForTeacher,
  deleteStudentForTeacher,
  getAttendanceReportForTeacher,
  getClassroomForTeacher,
  getDashboardAnalyticsForTeacher,
  getEngagementReportForTeacher,
  getEngagementTrendsForTeacher,
  getSessionAnalyticsForTeacher,
  getSessionForTeacher,
  getSessionReportForTeacher,
  getSettingsDtoForTeacher,
  getStudentAnalyticsForTeacher,
  getStudentForTeacher,
  listAttendanceForTeacher,
  listClassroomsForTeacher,
  listSessionsForTeacher,
  listStudentsForTeacher,
  markAttendanceForTeacher,
  recordParticipationEvent,
  recordSessionMetrics,
  seedDemoWorkspaceForTeacher,
  startMonitoringSession,
  updateAttendanceRecordForTeacher,
  updateClassroomForTeacher,
  updateSessionLifecycle,
  updateSettingsForTeacher,
  updateStudentForTeacher,
} from './src/db/classroomRepo.ts';

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

function handleRouteError(res: Response, err: unknown, fallbackMessage: string) {
  if (err instanceof NotFoundError) {
    res.status(404).json({ message: err.message });
    return;
  }
  if (err instanceof ValidationError) {
    res.status(400).json({ message: err.message });
    return;
  }
  console.error(fallbackMessage, err);
  const safeMessage = err instanceof Error ? err.message : fallbackMessage;
  res.status(500).json({ message: safeMessage || fallbackMessage });
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Authenticated Teacher Profile Routes (Firebase Auth + PostgreSQL)
  app.get('/api/auth/me', requireAuth, (req: AuthRequest, res) => {
    const teacher = req.teacher!;
    res.json({
      id: teacher.id,
      name: teacher.name,
      email: teacher.email,
      role: teacher.role,
      department: teacher.department,
    });
  });

  app.put('/api/auth/profile', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { name, department } = req.body || {};
      if (!name || !String(name).trim()) {
        res.status(400).json({ message: 'Teacher name is required.' });
        return;
      }
      const updated = await updateUserProfile(
        req.teacherId!,
        String(name),
        String(department || 'Computer Science & Engineering')
      );
      res.json({
        id: updated.id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
        department: updated.department,
      });
    } catch (err) {
      handleRouteError(res, err, 'Failed to update teacher profile.');
    }
  });

  // Classrooms
  app.get('/api/classrooms', requireAuth, async (req: AuthRequest, res) => {
    try {
      const list = await listClassroomsForTeacher(req.teacher!);
      res.json(list);
    } catch (err) {
      handleRouteError(res, err, 'Failed to load classrooms.');
    }
  });

  app.post('/api/classrooms', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { classroomName, subject, section, academicYear, description, isDemo } = req.body || {};
      if (!classroomName || !subject || !section || !academicYear) {
        res.status(400).json({
          message: 'Classroom name, subject, section, and academic year are required.',
        });
        return;
      }
      const created = await createClassroomForTeacher(req.teacher!, {
        classroomName: String(classroomName),
        subject: String(subject),
        section: String(section),
        academicYear: String(academicYear),
        description: description ? String(description) : '',
        isDemo: Boolean(isDemo),
      });
      res.status(201).json(created);
    } catch (err) {
      handleRouteError(res, err, 'Failed to create classroom.');
    }
  });

  app.get('/api/classrooms/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const classroom = await getClassroomForTeacher(req.teacher!, Number(req.params.id));
      res.json(classroom);
    } catch (err) {
      handleRouteError(res, err, 'Failed to load classroom.');
    }
  });

  app.put('/api/classrooms/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { classroomName, subject, section, academicYear, description } = req.body || {};
      if (!classroomName || !subject || !section || !academicYear) {
        res.status(400).json({ message: 'All required classroom fields must be provided.' });
        return;
      }
      const updated = await updateClassroomForTeacher(req.teacher!, Number(req.params.id), {
        classroomName: String(classroomName),
        subject: String(subject),
        section: String(section),
        academicYear: String(academicYear),
        description: description ? String(description) : '',
      });
      res.json(updated);
    } catch (err) {
      handleRouteError(res, err, 'Failed to update classroom.');
    }
  });

  app.delete('/api/classrooms/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      await deleteClassroomForTeacher(req.teacherId!, Number(req.params.id));
      res.status(204).send();
    } catch (err) {
      handleRouteError(res, err, 'Failed to delete classroom.');
    }
  });

  // Students
  app.get('/api/students', requireAuth, async (req: AuthRequest, res) => {
    try {
      const list = await listStudentsForTeacher(req.teacherId!);
      res.json(list);
    } catch (err) {
      handleRouteError(res, err, 'Failed to load students.');
    }
  });

  app.post('/api/students', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { studentName, email, rollNumber, classroomId, enrollmentDate, isDemo } = req.body || {};
      if (!studentName || !email || !rollNumber || !classroomId) {
        res.status(400).json({
          message: 'Student name, email, roll number, and classroom are required.',
        });
        return;
      }
      const created = await createStudentForTeacher(req.teacherId!, {
        studentName: String(studentName),
        email: String(email),
        rollNumber: String(rollNumber),
        classroomId: Number(classroomId),
        enrollmentDate: enrollmentDate ? String(enrollmentDate) : undefined,
        isDemo: Boolean(isDemo),
      });
      res.status(201).json(created);
    } catch (err) {
      handleRouteError(res, err, 'Failed to add student.');
    }
  });

  app.get('/api/students/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const student = await getStudentForTeacher(req.teacherId!, Number(req.params.id));
      res.json(student);
    } catch (err) {
      handleRouteError(res, err, 'Failed to load student.');
    }
  });

  app.put('/api/students/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { studentName, email, rollNumber, classroomId, enrollmentDate } = req.body || {};
      if (!classroomId) {
        res.status(400).json({ message: 'Classroom is required.' });
        return;
      }
      const updated = await updateStudentForTeacher(req.teacherId!, Number(req.params.id), {
        studentName: studentName ? String(studentName) : undefined,
        email: email ? String(email) : undefined,
        rollNumber: rollNumber ? String(rollNumber) : undefined,
        classroomId: Number(classroomId),
        enrollmentDate: enrollmentDate ? String(enrollmentDate) : undefined,
      });
      res.json(updated);
    } catch (err) {
      handleRouteError(res, err, 'Failed to update student.');
    }
  });

  app.delete('/api/students/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      await deleteStudentForTeacher(req.teacherId!, Number(req.params.id));
      res.status(204).send();
    } catch (err) {
      handleRouteError(res, err, 'Failed to delete student.');
    }
  });

  // Monitoring Sessions
  app.post('/api/sessions/start', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { classroomId, sessionTitle, mode } = req.body || {};
      if (!classroomId || !sessionTitle) {
        res.status(400).json({ message: 'Classroom and session title are required.' });
        return;
      }
      const session = await startMonitoringSession(req.teacherId!, {
        classroomId: Number(classroomId),
        sessionTitle: String(sessionTitle),
        mode: mode ? String(mode) : 'LIVE',
      });
      res.status(201).json(session);
    } catch (err) {
      handleRouteError(res, err, 'Failed to start monitoring session.');
    }
  });

  app.post('/api/sessions/:id/metrics', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        studentId,
        facePresenceScore,
        attentionOrientationScore,
        participationScore,
        detectedFacesCount,
        dataQualityStatus,
      } = req.body || {};
      const record = await recordSessionMetrics(req.teacherId!, Number(req.params.id), {
        studentId: studentId ? Number(studentId) : null,
        facePresenceScore: Number(facePresenceScore ?? 0),
        attentionOrientationScore: Number(attentionOrientationScore ?? 0),
        participationScore:
          participationScore !== undefined && participationScore !== null
            ? Number(participationScore)
            : null,
        detectedFacesCount: Number(detectedFacesCount ?? 0),
        dataQualityStatus: dataQualityStatus ? String(dataQualityStatus) : 'RELIABLE',
      });
      res.json(record);
    } catch (err) {
      handleRouteError(res, err, 'Failed to record engagement metrics.');
    }
  });

  app.post('/api/sessions/:id/participation', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { studentId, eventType, scoreValue } = req.body || {};
      await recordParticipationEvent(req.teacherId!, Number(req.params.id), {
        studentId: studentId ? Number(studentId) : null,
        eventType: eventType ? String(eventType) : undefined,
        scoreValue: scoreValue !== undefined ? Number(scoreValue) : undefined,
      });
      res.json({ message: 'Participation event recorded.' });
    } catch (err) {
      handleRouteError(res, err, 'Failed to record participation event.');
    }
  });

  app.post('/api/sessions/:id/pause', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updateSessionLifecycle(req.teacherId!, Number(req.params.id), 'PAUSE');
      res.json(updated);
    } catch (err) {
      handleRouteError(res, err, 'Failed to pause session.');
    }
  });

  app.post('/api/sessions/:id/resume', requireAuth, async (req: AuthRequest, res) => {
    try {
      const updated = await updateSessionLifecycle(req.teacherId!, Number(req.params.id), 'RESUME');
      res.json(updated);
    } catch (err) {
      handleRouteError(res, err, 'Failed to resume session.');
    }
  });

  app.post('/api/sessions/:id/stop', requireAuth, async (req: AuthRequest, res) => {
    try {
      const durationSeconds = req.body?.durationSeconds ? Number(req.body.durationSeconds) : undefined;
      const updated = await updateSessionLifecycle(
        req.teacherId!,
        Number(req.params.id),
        'STOP',
        durationSeconds
      );
      res.json(updated);
    } catch (err) {
      handleRouteError(res, err, 'Failed to stop session.');
    }
  });

  app.get('/api/sessions', requireAuth, async (req: AuthRequest, res) => {
    try {
      const list = await listSessionsForTeacher(req.teacherId!);
      res.json(list);
    } catch (err) {
      handleRouteError(res, err, 'Failed to load sessions.');
    }
  });

  app.get('/api/sessions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const session = await getSessionForTeacher(req.teacherId!, Number(req.params.id));
      res.json(session);
    } catch (err) {
      handleRouteError(res, err, 'Failed to load session.');
    }
  });

  app.delete('/api/sessions/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      await deleteSessionForTeacher(req.teacherId!, Number(req.params.id));
      res.status(204).send();
    } catch (err) {
      handleRouteError(res, err, 'Failed to delete session.');
    }
  });

  // Attendance
  app.get('/api/attendance', requireAuth, async (req: AuthRequest, res) => {
    try {
      const classroomId = req.query.classroomId ? Number(req.query.classroomId) : null;
      const date = req.query.date ? String(req.query.date) : null;
      const list = await listAttendanceForTeacher(req.teacherId!, { classroomId, date });
      res.json(list);
    } catch (err) {
      handleRouteError(res, err, 'Failed to load attendance.');
    }
  });

  app.get('/api/attendance/classroom/:classroomId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const cid = Number(req.params.classroomId);
      await getClassroomForTeacher(req.teacher!, cid);
      const list = await listAttendanceForTeacher(req.teacherId!, { classroomId: cid });
      res.json(list);
    } catch (err) {
      handleRouteError(res, err, 'Failed to load classroom attendance.');
    }
  });

  app.post('/api/attendance', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { studentId, classroomId, date, status } = req.body || {};
      const normStatus = String(status || '').trim().toUpperCase();
      if (!studentId || !classroomId || !date || !['PRESENT', 'ABSENT', 'LATE'].includes(normStatus)) {
        res.status(400).json({
          message: 'Student, classroom, date, and valid status (PRESENT, ABSENT, LATE) are required.',
        });
        return;
      }
      const saved = await markAttendanceForTeacher(req.teacherId!, {
        studentId: Number(studentId),
        classroomId: Number(classroomId),
        date: String(date),
        status: normStatus as 'PRESENT' | 'ABSENT' | 'LATE',
      });
      res.status(201).json(saved);
    } catch (err) {
      handleRouteError(res, err, 'Failed to mark attendance.');
    }
  });

  app.put('/api/attendance/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const normStatus = String(req.body?.status || '').trim().toUpperCase();
      if (!['PRESENT', 'ABSENT', 'LATE'].includes(normStatus)) {
        res.status(400).json({ message: 'Status must be PRESENT, ABSENT, or LATE.' });
        return;
      }
      const updated = await updateAttendanceRecordForTeacher(
        req.teacherId!,
        Number(req.params.id),
        normStatus as 'PRESENT' | 'ABSENT' | 'LATE'
      );
      res.json(updated);
    } catch (err) {
      handleRouteError(res, err, 'Failed to update attendance.');
    }
  });

  // Analytics
  app.get('/api/analytics/dashboard', requireAuth, async (req: AuthRequest, res) => {
    try {
      const analytics = await getDashboardAnalyticsForTeacher(req.teacher!);
      res.json(analytics);
    } catch (err) {
      handleRouteError(res, err, 'Failed to load dashboard analytics.');
    }
  });

  app.get('/api/analytics/engagement', requireAuth, async (req: AuthRequest, res) => {
    try {
      const trends = await getEngagementTrendsForTeacher(req.teacherId!);
      res.json(trends);
    } catch (err) {
      handleRouteError(res, err, 'Failed to load engagement trends.');
    }
  });

  app.get('/api/analytics/classrooms', requireAuth, async (req: AuthRequest, res) => {
    try {
      const list = await listClassroomsForTeacher(req.teacher!);
      res.json(list);
    } catch (err) {
      handleRouteError(res, err, 'Failed to load classroom analytics.');
    }
  });

  app.get('/api/analytics/students/:studentId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getStudentAnalyticsForTeacher(req.teacherId!, Number(req.params.studentId));
      res.json(data);
    } catch (err) {
      handleRouteError(res, err, 'Failed to load student analytics.');
    }
  });

  app.get('/api/analytics/sessions/:sessionId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const data = await getSessionAnalyticsForTeacher(req.teacherId!, Number(req.params.sessionId));
      res.json(data);
    } catch (err) {
      handleRouteError(res, err, 'Failed to load session analytics.');
    }
  });

  // Reports
  app.get('/api/reports/engagement', requireAuth, async (req: AuthRequest, res) => {
    try {
      const classroomId = req.query.classroomId ? Number(req.query.classroomId) : null;
      const report = await getEngagementReportForTeacher(req.teacher!, classroomId);
      res.json(report);
    } catch (err) {
      handleRouteError(res, err, 'Failed to generate engagement report.');
    }
  });

  app.get('/api/reports/attendance', requireAuth, async (req: AuthRequest, res) => {
    try {
      const classroomId = req.query.classroomId ? Number(req.query.classroomId) : null;
      const report = await getAttendanceReportForTeacher(req.teacherId!, classroomId);
      res.json(report);
    } catch (err) {
      handleRouteError(res, err, 'Failed to generate attendance report.');
    }
  });

  app.get('/api/reports/session/:sessionId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const report = await getSessionReportForTeacher(req.teacherId!, Number(req.params.sessionId));
      res.json(report);
    } catch (err) {
      handleRouteError(res, err, 'Failed to generate session report.');
    }
  });

  // Settings
  app.get('/api/settings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const settings = await getSettingsDtoForTeacher(req.teacherId!);
      res.json(settings);
    } catch (err) {
      handleRouteError(res, err, 'Failed to load settings.');
    }
  });

  app.put('/api/settings', requireAuth, async (req: AuthRequest, res) => {
    try {
      const {
        attentionWeight,
        presenceWeight,
        participationWeight,
        includeParticipation,
        highThreshold,
        moderateThreshold,
        samplingInterval,
        preferredCameraLabel,
        retentionDays,
      } = req.body || {};

      const wAtt = Number(attentionWeight);
      const wPres = Number(presenceWeight);
      const wPart = Number(participationWeight);
      const incPart = Boolean(includeParticipation);
      const hi = Number(highThreshold);
      const mod = Number(moderateThreshold);

      if (incPart) {
        if (Math.abs(wAtt + wPres + wPart - 100) > 0.1) {
          res.status(400).json({
            message: 'Scoring weights must sum to 100% when participation is enabled.',
          });
          return;
        }
      } else if (wAtt + wPres <= 0 || Math.abs(wAtt + wPres - 100) > 0.1) {
        res.status(400).json({
          message: 'Attention and Presence weights must sum to 100% when participation is excluded.',
        });
        return;
      }

      if (mod >= hi) {
        res.status(400).json({ message: 'Moderate threshold must be lower than High threshold.' });
        return;
      }

      const updated = await updateSettingsForTeacher(req.teacherId!, {
        attentionWeight: wAtt,
        presenceWeight: wPres,
        participationWeight: wPart,
        includeParticipation: incPart,
        highThreshold: hi,
        moderateThreshold: mod,
        samplingInterval: samplingInterval !== undefined ? Number(samplingInterval) : undefined,
        preferredCameraLabel: preferredCameraLabel ? String(preferredCameraLabel) : undefined,
        retentionDays: retentionDays !== undefined ? Number(retentionDays) : undefined,
      });
      res.json(updated);
    } catch (err) {
      handleRouteError(res, err, 'Failed to save settings.');
    }
  });

  // Seed Demo Data for Authenticated Teacher
  app.post('/api/demo/seed', requireAuth, async (req: AuthRequest, res) => {
    try {
      const result = await seedDemoWorkspaceForTeacher(req.teacherId!);
      res.status(201).json(result);
    } catch (err) {
      handleRouteError(res, err, 'Failed to seed demo data.');
    }
  });

  // Download Complete Spring Boot + MySQL + React Project ZIP
  app.get('/api/project/download-zip', (_req, res) => {
    const projectRoot = path.resolve(process.cwd(), 'AI-Classroom-Engagement-Analytics');
    if (!fs.existsSync(projectRoot)) {
      res.status(404).json({ message: 'Project export directory not found.' });
      return;
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="AI-Classroom-Engagement-Analytics.zip"'
    );

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', (err: Error) => {
      if (!res.headersSent) {
        res.status(500).json({ message: 'Failed to create ZIP archive: ' + err.message });
      }
    });
    archive.pipe(res);

    archive.directory(path.join(projectRoot, 'backend'), 'AI-Classroom-Engagement-Analytics/backend');
    archive.directory(path.join(projectRoot, 'database'), 'AI-Classroom-Engagement-Analytics/database');
    archive.file(path.join(projectRoot, 'README.md'), {
      name: 'AI-Classroom-Engagement-Analytics/README.md',
    });

    archive.directory(path.resolve(process.cwd(), 'src'), 'AI-Classroom-Engagement-Analytics/frontend/src');
    if (fs.existsSync(path.resolve(process.cwd(), 'public'))) {
      archive.directory(
        path.resolve(process.cwd(), 'public'),
        'AI-Classroom-Engagement-Analytics/frontend/public'
      );
    }
    archive.file(path.resolve(process.cwd(), 'index.html'), {
      name: 'AI-Classroom-Engagement-Analytics/frontend/index.html',
    });
    archive.file(path.resolve(process.cwd(), 'vite.config.ts'), {
      name: 'AI-Classroom-Engagement-Analytics/frontend/vite.config.ts',
    });
    archive.file(path.resolve(process.cwd(), 'tsconfig.json'), {
      name: 'AI-Classroom-Engagement-Analytics/frontend/tsconfig.json',
    });

    const frontendPkg = {
      name: 'ai-classroom-engagement-frontend',
      private: true,
      version: '1.0.0',
      type: 'module',
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview',
      },
      dependencies: {
        '@mediapipe/tasks-vision': '^0.10.22-rc.20250304',
        axios: '^1.7.9',
        'lucide-react': '^0.546.0',
        react: '^19.0.1',
        'react-dom': '^19.0.1',
        'react-router-dom': '^7.1.5',
        recharts: '^2.15.1',
      },
      devDependencies: {
        '@tailwindcss/vite': '^4.3.3',
        '@types/react': '^19.0.0',
        '@types/react-dom': '^19.0.0',
        '@vitejs/plugin-react': '^6.1.1',
        tailwindcss: '^4.3.3',
        typescript: '^5.7.2',
        vite: '^6.0.0',
      },
    };
    archive.append(JSON.stringify(frontendPkg, null, 2), {
      name: 'AI-Classroom-Engagement-Analytics/frontend/package.json',
    });
    archive.append('VITE_API_BASE_URL=http://localhost:8080/api\n', {
      name: 'AI-Classroom-Engagement-Analytics/frontend/.env.example',
    });

    archive.finalize();
  });

  // Vite middleware for React SPA
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
