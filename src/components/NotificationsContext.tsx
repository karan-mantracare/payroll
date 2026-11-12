"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export type NotificationCategory =
  | "GENERAL"
  | "ATTENDANCE"
  | "SHIFT"
  | "LEAVE"
  | "PAYROLL"
  | "TRAINING"
  | "SYSTEM";

export interface NotificationItem {
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

interface NotificationsContextValue {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  isUpdating: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  isUpdating: false,
  refreshNotifications: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
});

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await fetch("/payrol/api/notifications", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        notifications?: NotificationItem[];
        unreadCount?: number;
      };
      if (Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
        setUnreadCount(
          typeof data.unreadCount === "number"
            ? data.unreadCount
            : data.notifications.filter((n) => n.isRead === 0).length
        );
      }
    } catch {
      // Silently ignore background polling network errors
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshNotifications();
    const intervalId = setInterval(() => {
      void refreshNotifications();
    }, 60000);
    const onFocus = () => {
      void refreshNotifications();
    };
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshNotifications]);

  const markAsRead = useCallback(async (notificationId: string) => {
    setNotifications((prev) => {
      const next = prev.map((n) =>
        n.id === notificationId ? { ...n, isRead: 1, readAt: Date.now() } : n
      );
      setUnreadCount(next.filter((n) => n.isRead === 0).length);
      return next;
    });

    setIsUpdating(true);
    try {
      const res = await fetch("/payrol/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          notifications?: NotificationItem[];
          unreadCount?: number;
        };
        if (Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
          setUnreadCount(
            typeof data.unreadCount === "number"
              ? data.unreadCount
              : data.notifications.filter((n) => n.isRead === 0).length
          );
        }
      }
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => (n.isRead === 0 ? { ...n, isRead: 1, readAt: Date.now() } : n))
    );
    setUnreadCount(0);

    setIsUpdating(true);
    try {
      const res = await fetch("/payrol/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          notifications?: NotificationItem[];
          unreadCount?: number;
        };
        if (Array.isArray(data.notifications)) {
          setNotifications(data.notifications);
          setUnreadCount(
            typeof data.unreadCount === "number"
              ? data.unreadCount
              : data.notifications.filter((n) => n.isRead === 0).length
          );
        }
      }
    } finally {
      setIsUpdating(false);
    }
  }, []);

  return (
    <NotificationsContext.Provider
      value={{
        notifications,
        unreadCount,
        isLoading,
        isUpdating,
        refreshNotifications,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}

