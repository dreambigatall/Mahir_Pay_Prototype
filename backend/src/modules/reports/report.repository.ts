import type { Pool } from "pg";

export type DashboardReport = {
  active_visits: number;
  waiting_queue: number;
  pending_diagnostics: number;
  due_course_doses: number;
  revenue_today: number;
  outstanding_balance: number;
};

export class ReportRepository {
  constructor(private readonly pool: Pool) {}

  async dashboard(): Promise<DashboardReport> {
    const result = await this.pool.query<DashboardReport>(
      `select
        (select count(*)::int from clinic.visits where status not in ('completed','billed','cancelled')) as active_visits,
        (select count(*)::int from clinic.queue_entries where status in ('waiting','called','in_service')) as waiting_queue,
        (select count(*)::int from clinic.diagnostic_order_items where status in ('requested','in_progress','result_entered')) as pending_diagnostics,
        (select count(*)::int from clinic.treatment_course_doses d join clinic.treatment_courses c on c.id=d.course_id
          where c.status='active' and d.status in ('scheduled','checked_in') and d.scheduled_date <= current_date) as due_course_doses,
        (select coalesce(sum(amount),0)::float8 from clinic.payments where status='completed' and paid_at >= current_date and paid_at < current_date + 1) as revenue_today,
        (select coalesce(sum(total-amount_paid),0)::float8 from clinic.invoices where status in ('issued','partially_paid')) as outstanding_balance`,
    );
    return result.rows[0]!;
  }

  async period(from: string, to: string) {
    const [visitStatuses, revenueMethods, revenueTypes, courseActivity, referralStatuses] = await Promise.all([
      this.pool.query<{ status: string; count: number }>(
        `select status, count(*)::int as count from clinic.visits
         where checked_in_at >= $1 and checked_in_at < $2 group by status order by status`,
        [from, to],
      ),
      this.pool.query<{ method: string; total: number; count: number }>(
        `select method, coalesce(sum(amount),0)::float8 as total, count(*)::int as count
         from clinic.payments where status='completed' and paid_at >= $1 and paid_at < $2
         group by method order by method`,
        [from, to],
      ),
      this.pool.query<{ line_type: string; total: number }>(
        `select l.line_type, coalesce(sum(l.line_total),0)::float8 as total
         from clinic.invoice_lines l join clinic.invoices i on i.id=l.invoice_id
         where i.status <> 'void' and i.issued_at >= $1 and i.issued_at < $2
         group by l.line_type order by l.line_type`,
        [from, to],
      ),
      this.pool.query<{ status: string; count: number }>(
        `select d.status, count(*)::int as count from clinic.treatment_course_doses d
         where d.scheduled_date >= $1::date and d.scheduled_date < $2::date
         group by d.status order by d.status`,
        [from, to],
      ),
      this.pool.query<{ status: string; count: number }>(
        `select status, count(*)::int as count from clinic.referrals
         where created_at >= $1 and created_at < $2 group by status order by status`,
        [from, to],
      ),
    ]);
    return {
      from,
      to,
      visitsByStatus: visitStatuses.rows,
      revenueByPaymentMethod: revenueMethods.rows,
      revenueByLineType: revenueTypes.rows,
      courseDosesByStatus: courseActivity.rows,
      referralsByStatus: referralStatuses.rows,
    };
  }
}

