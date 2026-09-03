import { apiRequest } from "@/lib/api/client";

export type NotificationDto = {
  id: string;
  kind: string;
  title: string;
  message: string;
  resource_type: string | null;
  resource_id: string | null;
  read_at: string | null;
  created_at: string;
};

export function listNotifications(unreadOnly = false) {
  return apiRequest<{ items: NotificationDto[] }>(`/notifications?unreadOnly=${unreadOnly}`);
}

export function markNotificationRead(id: string) {
  return apiRequest<{ item: NotificationDto }>(`/notifications/${id}/read`, { method: "PATCH" });
}

export function markAllNotificationsRead() {
  return apiRequest<{ updated: number }>("/notifications/read-all", { method: "PATCH" });
}

