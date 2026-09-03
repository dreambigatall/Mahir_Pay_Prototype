import { AppError } from "../../shared/errors/app-error";
import { NotificationRepository } from "./notification.repository";

export class NotificationService {
  constructor(private readonly repository: NotificationRepository) {}

  list(userId: string, unreadOnly: boolean, limit: number) {
    return this.repository.list(userId, unreadOnly, limit);
  }

  async markRead(id: string, userId: string) {
    const item = await this.repository.markRead(id, userId);
    if (!item) throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification was not found");
    return item;
  }

  markAllRead(userId: string) {
    return this.repository.markAllRead(userId);
  }
}

