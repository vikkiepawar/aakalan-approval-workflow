// @ts-ignore -- Express types are resolved from the server's runtime dependencies.
import { Router, Response } from 'express';
import { queryOne, queryAll, runSql } from '../db.js';
import { authenticate, AuthenticatedRequest } from '../auth.js';

export const notificationsRouter = Router();

// Get in-app notifications
notificationsRouter.get('/', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const notifications = queryAll<any>(
      `SELECT * FROM notifications
       WHERE (recipient_user_id = ? OR recipient_role = ? OR recipient_role = 'ALL')
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.id, user.role || 'ALL']
    );

    const unreadResult = queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM notifications
       WHERE (recipient_user_id = ? OR recipient_role = ? OR recipient_role = 'ALL') AND is_read = 0`,
      [user.id, user.role || 'ALL']
    );

    const unreadCount = unreadResult ? unreadResult.count : 0;

    res.json({ notifications: notifications || [], unreadCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve notifications', notifications: [], unreadCount: 0 });
  }
});

// Mark single notification as read
notificationsRouter.patch('/:id/read', authenticate, (req: AuthenticatedRequest & { params: { id: string } }, res: Response): void => {
  try {
    const { id } = req.params;
    runSql('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
    res.json({ message: 'Notification marked as read.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

// Mark all notifications as read
notificationsRouter.post('/mark-all-read', authenticate, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    runSql(
      'UPDATE notifications SET is_read = 1 WHERE (recipient_user_id = ? OR recipient_role = ?)',
      [user.id, user.role || 'ALL']
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});
