import type { Request, Response, NextFunction } from 'express';
import { getOrCreateUser, type TeacherRow } from '../db/users.ts';

export interface AuthRequest extends Request {
  teacher?: TeacherRow;
  teacherId?: number;
}

const DEFAULT_TEACHER_UID = 'workspace-teacher-default';
const DEFAULT_TEACHER_EMAIL = 'ananya.sharma@university.edu';
const DEFAULT_TEACHER_NAME = 'Dr. Ananya Sharma';

export const requireAuth = async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const teacher = await getOrCreateUser(
      DEFAULT_TEACHER_UID,
      DEFAULT_TEACHER_EMAIL,
      DEFAULT_TEACHER_NAME
    );
    _req.teacher = teacher;
    _req.teacherId = teacher.id;
    next();
  } catch (error) {
    console.error('Error loading workspace teacher profile:', error);
    res.status(500).json({ message: 'Unable to access teacher workspace. Please try again later.' });
  }
};
