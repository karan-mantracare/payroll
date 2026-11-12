"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck, ExternalLink } from "lucide-react";
import { useNotifications, type NotificationCategory } from "./NotificationsContext";

function formatRelativeTime(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

const CATEGORY_BADGE_CLASSES: Record<NotificationCategory, string> = {
  GENERAL: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ATTENDANCE: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  SHIFT: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  LEAVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  PAYROLL: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  TRAINING: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  SYSTEM: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

export function NotificationBell({
  portal,
}: {
  portal: "Admin Portal" | "Employee Portal";
}) {
  const { notifications, unreadCount, isUpdating, markAsRead, markAllAsRead } =
    useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const notificationsPageHref =
    portal === "Admin Portal" ? "/admin/notifications" : "/dash/notifications";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const recentNotifications = notifications.slice(0, 6);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-1.5 rounded-lg text-[#293381] hover:bg-[#EBF7FF] dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-[#36B4FF]"
        title={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}`
            : "Notifications"
        }
        aria-label="Notifications"
        aria-expanded={isOpen}
        data-testid="navbar-notifications-bell"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span
            data-testid="navbar-notifications-unread-badge"
            className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-[17px] text-center shadow-sm ring-2 ring-white dark:ring-slate-900"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          data-testid="navbar-notifications-popover"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/60">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-[#293381] dark:text-white">
                Notifications
              </span>
              <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-[#36B4FF]/15 text-[#293381] dark:text-[#36B4FF]">
                {unreadCount} unread
              </span>
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => void markAllAsRead()}
                data-testid="popover-mark-all-read-btn"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#293381] hover:text-[#36B4FF] dark:text-[#36B4FF] dark:hover:text-white transition disabled:opacity-50"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification Items */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {recentNotifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                No notifications yet. You are all caught up!
              </div>
            ) : (
              recentNotifications.map((item) => {
                const isUnread = item.isRead === 0;
                const badgeClass =
                  CATEGORY_BADGE_CLASSES[item.category] ??
                  CATEGORY_BADGE_CLASSES.GENERAL;
                return (
                  <div
                    key={item.id}
                    data-testid={`popover-notification-item-${item.id}`}
                    className={`px-4 py-3 transition ${
                      isUnread
                        ? "bg-[#EBF7FF]/65 dark:bg-sky-950/25"
                        : "bg-white dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isUnread && (
                          <span
                            className="w-2 h-2 rounded-full bg-[#36B4FF] shrink-0"
                            title="Unread"
                          />
                        )}
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${badgeClass}`}
                        >
                          {item.category}
                        </span>
                        <span className="text-[11px] text-slate-400 dark:text-slate-500">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>

                      {isUnread ? (
                        <button
                          type="button"
                          disabled={isUpdating}
                          onClick={() => void markAsRead(item.id)}
                          data-testid={`popover-mark-read-${item.id}`}
                          className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#293381] text-white hover:bg-[#1e2663] transition disabled:opacity-50"
                          title="Mark as Read"
                        >
                          <Check className="w-3 h-3" />
                          Mark as Read
                        </button>
                      ) : (
                        <span className="shrink-0 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          Read
                        </span>
                      )}
                    </div>

                    <div className="mt-1.5">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white leading-snug">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2">
                        {item.message}
                      </p>
                    </div>

                    {item.actionUrl && (
                      <div className="mt-1.5">
                        <Link
                          href={item.actionUrl}
                          onClick={() => {
                            if (isUnread) {
                              void markAsRead(item.id);
                            }
                            setIsOpen(false);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#293381] hover:text-[#36B4FF] dark:text-[#36B4FF]"
                        >
                          Open details
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 flex items-center justify-between">
            <Link
              href={notificationsPageHref}
              onClick={() => setIsOpen(false)}
              className="w-full text-center text-xs font-bold text-[#293381] hover:text-[#36B4FF] dark:text-[#36B4FF] transition"
            >
              View All Notifications →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

