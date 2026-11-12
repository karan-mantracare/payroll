"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Check, CheckCheck, ExternalLink, RefreshCw } from "lucide-react";
import {
  useNotifications,
  type NotificationCategory,
} from "@/components/NotificationsContext";

type FilterTab = "ALL" | "UNREAD" | "READ";

const CATEGORY_BADGE_CLASSES: Record<NotificationCategory, string> = {
  GENERAL: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ATTENDANCE: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  SHIFT: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  LEAVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  PAYROLL: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  TRAINING: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  SYSTEM: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
};

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationsCenter({
  portalLabel,
}: {
  portalLabel: "Admin Portal" | "Employee Portal";
}) {
  const {
    notifications,
    unreadCount,
    isLoading,
    isUpdating,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
  } = useNotifications();
  const [filter, setFilter] = useState<FilterTab>("ALL");

  const readCount = notifications.length - unreadCount;

  const filteredNotifications = useMemo(() => {
    if (filter === "UNREAD") return notifications.filter((n) => n.isRead === 0);
    if (filter === "READ") return notifications.filter((n) => n.isRead === 1);
    return notifications;
  }, [notifications, filter]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#293381] text-white flex items-center justify-center shadow-sm">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#293381] dark:text-white tracking-tight">
                Notifications Center
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {portalLabel} • Attendance alerts, shift schedule approvals, and system updates
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void refreshNotifications()}
            disabled={isLoading || isUpdating}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => void markAllAsRead()}
            disabled={unreadCount === 0 || isUpdating}
            data-testid="notifications-mark-all-read"
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
              unreadCount > 0
                ? "bg-[#293381] text-white hover:bg-[#1e2663] shadow-sm"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800 cursor-default"
            }`}
          >
            <CheckCheck className="w-4 h-4" />
            {unreadCount > 0 ? `Mark All as Read (${unreadCount})` : "All Caught Up"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Total Notifications
          </div>
          <div className="mt-1 text-2xl font-bold text-[#293381] dark:text-white">
            {notifications.length}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-rose-500">
            Unread Notifications
          </div>
          <div
            data-testid="notifications-center-unread-count"
            className="mt-1 text-2xl font-bold text-rose-600 dark:text-rose-400"
          >
            {unreadCount}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Marked as Read
          </div>
          <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {readCount}
          </div>
        </div>
      </div>

      {/* Filter Tabs & Feed */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            {(
              [
                { key: "ALL", label: `All (${notifications.length})` },
                { key: "UNREAD", label: `Unread (${unreadCount})` },
                { key: "READ", label: `Read (${readCount})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  filter === tab.key
                    ? "bg-[#293381] text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
            Loading notifications...
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Bell className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {filter === "UNREAD"
                ? "No unread notifications"
                : filter === "READ"
                  ? "No read notifications yet"
                  : "No notifications available"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              New activity across attendance, shifts, payroll, and training will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredNotifications.map((item) => {
              const isUnread = item.isRead === 0;
              const badgeClass =
                CATEGORY_BADGE_CLASSES[item.category] ??
                CATEGORY_BADGE_CLASSES.GENERAL;

              return (
                <div
                  key={item.id}
                  data-testid={`center-notification-item-${item.id}`}
                  className={`p-5 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 ${
                    isUnread
                      ? "bg-[#EBF7FF]/55 dark:bg-sky-950/20"
                      : "bg-white dark:bg-slate-900"
                  }`}
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isUnread && (
                        <span
                          className="w-2.5 h-2.5 rounded-full bg-[#36B4FF] shrink-0"
                          title="Unread notification"
                        />
                      )}
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}
                      >
                        {item.category}
                      </span>
                      <span className="text-xs text-slate-400 dark:text-slate-500">
                        {formatDateTime(item.createdAt)}
                      </span>
                      {!isUnread && item.readAt && (
                        <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                          • Read
                        </span>
                      )}
                    </div>

                    <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {item.message}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.actionUrl && (
                      <Link
                        href={item.actionUrl}
                        onClick={() => {
                          if (isUnread) {
                            void markAsRead(item.id);
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-[#293381] dark:text-[#36B4FF] hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                      >
                        View
                        <ExternalLink className="w-3.5 h-3.5" />
                      </Link>
                    )}

                    {isUnread ? (
                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => void markAsRead(item.id)}
                        data-testid={`center-mark-read-${item.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#293381] text-white text-xs font-semibold hover:bg-[#1e2663] transition disabled:opacity-50"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Mark as Read
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 text-xs font-semibold">
                        <CheckCheck className="w-3.5 h-3.5" />
                        Read
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

