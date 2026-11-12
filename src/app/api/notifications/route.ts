import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session";
import {
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/notifications/service";

export async function GET() {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await getUserNotifications(session.userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getSessionContext();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      notificationId?: string;
      markAll?: boolean;
    };

    if (body.markAll) {
      await markAllNotificationsAsRead(session.userId);
    } else if (body.notificationId) {
      const updated = await markNotificationAsRead(
        body.notificationId,
        session.userId
      );
      if (!updated) {
        return NextResponse.json(
          { error: "Notification not found" },
          { status: 404 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Provide notificationId or markAll: true" },
        { status: 400 }
      );
    }

    const result = await getUserNotifications(session.userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to update notifications:", error);
    return NextResponse.json(
      { error: "Failed to update notification state" },
      { status: 500 }
    );
  }
}

