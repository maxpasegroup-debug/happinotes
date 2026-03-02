import { Router, Request, Response } from 'express';
import { User } from '../models';

const router = Router();

/**
 * GET /api/dev/list-users
 * Temporary dev route: returns all users with only email, role, createdAt.
 * Does NOT return password.
 */
router.get('/dev/list-users', async (_req: Request, res: Response): Promise<void> => {
  const users = await User.find({})
    .select('email role createdAt')
    .lean();
  res.json({
    success: true,
    users: users.map((u) => ({
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
    })),
  });
});

export default router;
