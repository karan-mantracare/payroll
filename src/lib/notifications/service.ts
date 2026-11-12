import crypto from "crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { employees, notifications, userRoles } from "../db/schema";

export type NotificationCategory =
  | "GENERAL"
  | "ATTENDANCE"
  | "SHIFT"
  | "LEAVE"
  | "PAYROLL"
  | "TRAINING"
  | "SYSTEM";

export interface NotificationRecord {
  id: string;
  recipientUserId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  actionUrl: string | null;
  isRead: number;
  readAt: number | null;
  createdAt: number;
}

export interface CreateNotificationInput {
  recipientUserId: string;
  title: string;
  message: string;
  category?: NotificationCategory;
  actionUrl?: string | null;
}

const ADMIN_ROLE_KEYS = ["SUPER_ADMIN", "ADMIN", "HR_MANAGER"];

async function seedStarterNotificationsIfEmpty(userId: string): Promise<void> {
  const existing = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(eq(notifications.recipientUserId, userId))
    .limit(1);

  if (existing.length > 0) {
    return;
  }

  const now = Date.now();
  const starterItems = [
    {
      id: crypto.randomUUID(),
      recipientUserId: userId,
      title: "Auto Check-Out Rule Updated",
      message:
        "Missing check-outs are now automatically reconciled 5 hours after shift end time using your assigned shift schedule.",
      category: "ATTENDANCE" as const,
      actionUrl: "/dash/attendance",
      isRead: 0,
      readAt: null,
      createdAt: now - 10 * 60 * 1000,
    },
    {
      id: crypto.randomUUID(),
      recipientUserId: userId,
      title: "Shift & Schedule Change Workflow Active",
      message:
        "You can now submit shift schedule modification requests directly from My Shifts for admin approval.",
      category: "SHIFT" as const,
      actionUrl: "/dash/shifts",
      isRead: 0,
      readAt: null,
      createdAt: now - 45 * 60 * 1000,
    },
    {
      id: crypto.randomUUID(),
      recipientUserId: userId,
      title: "Welcome to Mantra Notification Center",
      message:
        "Real-time alerts for attendance reports, shift approvals, leave updates, and payroll releases appear here.",
      category: "SYSTEM" as const,
      actionUrl: "/dash/notifications",
      isRead: 0,
      readAt: null,
      createdAt: now - 2 * 60 * 60 * 1000,
    },
  ];

  await db.insert(notifications).values(starterItems);
}

/**
 * Creates a persistent notification for a specific user.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<NotificationRecord> {
  const row: NotificationRecord = {
    id: crypto.randomUUID(),
    recipientUserId: input.recipientUserId,
    title: input.title,
    message: input.message,
    category: input.category ?? "GENERAL",
    actionUrl: input.actionUrl ?? null,
    isRead: 0,
    readAt: null,
    createdAt: Date.now(),
  };

  await db.insert(notifications).values(row);
  return row;
}

/**
 * Resolves the userId mapped to an employeeId.
 */
export async function resolveUserIdForEmployee(employeeId: string): Promise<string | null> {
  const rows = await db
    .select({ userId: employees.userId })
    .from(employees)
    .where(eq(employees.id, employeeId))
    .limit(1);
  return rows[0]?.userId ?? null;
}

/**
 * Broadcasts a notification to all admin / HR manager users.
 */
export async function notifyAdmins(params: {
  title: string;
  message: string;
  category?: NotificationCategory;
  actionUrl?: string | null;
  excludeUserId?: string;
}): Promise<void> {
  const adminRows = await db
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(inArray(userRoles.roleKey, ADMIN_ROLE_KEYS));

  const uniqueUserIds = Array.from(new Set(adminRows.map((r) => r.userId))).filter(
    (uid) => uid && uid !== params.excludeUserId
  );

  if (uniqueUserIds.length === 0) return;

  const now = Date.now();
  await db.insert(notifications).values(
    uniqueUserIds.map((recipientUserId) => ({
      id: crypto.randomUUID(),
      recipientUserId,
      title: params.title,
      message: params.message,
      category: params.category ?? "GENERAL",
      actionUrl: params.actionUrl ?? null,
      isRead: 0,
      readAt: null,
      createdAt: now,
    }))
  );
}

/**
 * Returns all notifications for the user (newest first) along with unread count.
 */
export async function getUserNotifications(userId: string): Promise<{
  notifications: NotificationRecord[];
  unreadCount: number;
}> {
  await seedStarterNotificationsIfEmpty(userId);

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientUserId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(100);

  const mapped: NotificationRecord[] = rows.map((row) => ({
    id: row.id,
    recipientUserId: row.recipientUserId,
    title: row.title,
    message: row.message,
    category: (row.category || "GENERAL") as NotificationCategory,
    actionUrl: row.actionUrl ?? null,
    isRead: row.isRead,
    readAt: row.readAt ?? null,
    createdAt: row.createdAt,
  }));

  const unreadCount = mapped.filter((n) => n.isRead === 0).length;
  return { notifications: mapped, unreadCount };
}

/**
 * Marks a single notification belonging to the user as read.
 */
export async function markNotificationAsRead(
  notificationId: string,
  userId: string
): Promise<boolean> {
  const existing = await db
    .select({ id: notifications.id, isRead: notifications.isRead })
    .from(notifications)
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.recipientUserId, userId)
      )
    )
    .limit(1);

  if (existing.length === 0) {
    return false;
  }

  if (existing[0].isRead === 1) {
    return true;
  }

  await db
    .update(notifications)
    .set({ isRead: 1, readAt: Date.now() })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.recipientUserId, userId)
      )
    );

  return true;
}

/**
 * Marks all unread notifications for the user as read.
 */
export async function markAllNotificationsAsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ isRead: 1, readAt: Date.now() })
    .where(
      and(
        eq(notifications.recipientUserId, userId),
        eq(notifications.isRead, 0)
      )
    );
}

