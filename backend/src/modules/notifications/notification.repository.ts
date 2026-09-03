import type { Pool } from "pg";

export type Notification = {
  id: string;
  kind: string;
  title: string;
  message: string;
  resource_type: string | null;
  resource_id: string | null;
  available_at: Date;
  read_at: Date | null;
  created_at: Date;
};

export class NotificationRepository {
  constructor(private readonly pool: Pool) {}

  async list(recipientUserId: string, unreadOnly: boolean, limit: number): Promise<Notification[]> {
    const result = await this.pool.query<Notification>(
      `select id, kind, title, message, resource_type, resource_id, available_at, read_at, created_at
       from clinic.notifications where recipient_user_id=$1 and available_at <= now()
         and ($2::boolean=false or read_at is null)
       order by created_at desc, id desc limit $3`,
      [recipientUserId, unreadOnly, limit],
    );
    return result.rows;
  }

  async markRead(id: string, recipientUserId: string): Promise<Notification | null> {
    const result = await this.pool.query<Notification>(
      `update clinic.notifications set read_at=coalesce(read_at,now())
       where id=$1 and recipient_user_id=$2 and available_at <= now()
       returning id, kind, title, message, resource_type, resource_id, available_at, read_at, created_at`,
      [id, recipientUserId],
    );
    return result.rows[0] ?? null;
  }

  async markAllRead(recipientUserId: string): Promise<number> {
    const result = await this.pool.query(
      `update clinic.notifications set read_at=now()
       where recipient_user_id=$1 and read_at is null and available_at <= now()`,
      [recipientUserId],
    );
    return result.rowCount ?? 0;
  }
}

