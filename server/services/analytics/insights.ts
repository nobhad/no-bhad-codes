/**
 * ===============================================
 * ANALYTICS — BUSINESS INTELLIGENCE, CLIENT INSIGHTS & OPERATIONAL REPORTS
 * ===============================================
 * Revenue breakdowns, pipeline analytics, client LTV, project health, etc.
 */

import { getDatabase } from '../../database/init.js';

// ============================================
// BUSINESS INTELLIGENCE
// ============================================

/**
 * Get revenue breakdown by time period (month/quarter/year)
 */
export async function getRevenueByPeriod(
  period: 'month' | 'quarter' | 'year',
  startDate?: string,
  endDate?: string
): Promise<{ period: string; revenue: number; invoiceCount: number; averageInvoice: number }[]> {
  const db = getDatabase();

  let groupBy: string;

  switch (period) {
  case 'month':
    groupBy = 'strftime(\'%Y-%m\', paid_at)';
    break;
  case 'quarter':
    groupBy =
        'strftime(\'%Y\', paid_at) || \'-Q\' || ((CAST(strftime(\'%m\', paid_at) AS INTEGER) + 2) / 3)';
    break;
  case 'year':
    groupBy = 'strftime(\'%Y\', paid_at)';
    break;
  }

  let query = `
    SELECT
      ${groupBy} as period,
      SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) as revenue,
      COUNT(*) as invoice_count,
      AVG(CASE WHEN status = 'paid' THEN total_amount ELSE NULL END) as average_invoice
    FROM active_invoices
    WHERE paid_at IS NOT NULL
  `;

  const params: string[] = [];

  if (startDate) {
    query += ' AND paid_at >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND paid_at <= ?';
    params.push(endDate);
  }

  query += ` GROUP BY ${groupBy} ORDER BY period DESC LIMIT 24`;

  const results = (await db.all(query, params)) as Array<{
    period: string;
    revenue: number;
    invoice_count: number;
    average_invoice: number | null;
  }>;

  return results.map((r) => ({
    period: r.period,
    revenue: r.revenue || 0,
    invoiceCount: r.invoice_count,
    averageInvoice: r.average_invoice || 0
  }));
}

/**
 * Get project pipeline value (proposals in progress)
 */
export async function getProjectPipelineValue(): Promise<{
  totalValue: number;
  proposalCount: number;
  averageValue: number;
  byStatus: { status: string; value: number; count: number }[];
}> {
  const db = getDatabase();

  const results = (await db.all(`
    SELECT
      status,
      COUNT(*) as count,
      SUM(total_price) as total_value
    FROM proposals
    WHERE status IN ('draft', 'sent', 'viewed')
    GROUP BY status
  `)) as Array<{
    status: string;
    count: number;
    total_value: number | null;
  }>;

  const totalValue = results.reduce((sum, r) => sum + (r.total_value || 0), 0);
  const totalCount = results.reduce((sum, r) => sum + r.count, 0);

  return {
    totalValue,
    proposalCount: totalCount,
    averageValue: totalCount > 0 ? totalValue / totalCount : 0,
    byStatus: results.map((r) => ({
      status: r.status,
      value: r.total_value || 0,
      count: r.count
    }))
  };
}

/**
 * Get client acquisition funnel metrics
 */
export async function getAcquisitionFunnel(
  startDate?: string,
  endDate?: string
): Promise<{
  contacts: number;
  leads: number;
  proposals: number;
  clients: number;
  conversionRates: {
    contactToLead: number;
    leadToProposal: number;
    proposalToClient: number;
    overall: number;
  };
}> {
  const db = getDatabase();

  let dateFilter = '';
  const params: string[] = [];

  if (startDate) {
    dateFilter = ' AND created_at >= ?';
    params.push(startDate);
  }
  if (endDate) {
    dateFilter += ' AND created_at <= ?';
    params.push(endDate);
  }

  const [contacts, leads, proposals, clients] = (await Promise.all([
    db.get(
      `SELECT COUNT(*) as count FROM active_projects WHERE status IN ('pending', 'new')${dateFilter}`,
      params
    ),
    db.get(
      `SELECT COUNT(*) as count FROM active_projects WHERE status IN ('pending', 'new', 'in-progress')${dateFilter}`,
      params
    ),
    db.get(`SELECT COUNT(*) as count FROM proposals WHERE 1=1${dateFilter}`, params),
    db.get(`SELECT COUNT(*) as count FROM active_clients WHERE 1=1${dateFilter}`, params)
  ])) as Array<{ count: number } | undefined>;

  const contactCount = contacts?.count || 0;
  const leadCount = leads?.count || 0;
  const proposalCount = proposals?.count || 0;
  const clientCount = clients?.count || 0;

  return {
    contacts: contactCount,
    leads: leadCount,
    proposals: proposalCount,
    clients: clientCount,
    conversionRates: {
      contactToLead: contactCount > 0 ? (leadCount / contactCount) * 100 : 0,
      leadToProposal: leadCount > 0 ? (proposalCount / leadCount) * 100 : 0,
      proposalToClient: proposalCount > 0 ? (clientCount / proposalCount) * 100 : 0,
      overall: contactCount > 0 ? (clientCount / contactCount) * 100 : 0
    }
  };
}

/**
 * Get project statistics (average value, duration, popular types)
 */
export async function getProjectStatistics(): Promise<{
  averageValue: number;
  averageDuration: number;
  popularTypes: { type: string; count: number; totalValue: number }[];
  statusBreakdown: { status: string; count: number }[];
}> {
  const db = getDatabase();

  const [avgStats, typeStats, statusStats] = (await Promise.all([
    db.get(`
      SELECT
        AVG(COALESCE(budget, 0)) as average_value,
        AVG(JULIANDAY(COALESCE(end_date, date('now'))) - JULIANDAY(start_date)) as average_duration
      FROM active_projects
      WHERE status != 'cancelled' AND start_date IS NOT NULL
    `),
    db.all(`
      SELECT
        project_type as type,
        COUNT(*) as count,
        SUM(COALESCE(budget, 0)) as total_value
      FROM active_projects
      WHERE status != 'cancelled'
      GROUP BY project_type
      ORDER BY count DESC
      LIMIT 10
    `),
    db.all(`
      SELECT status, COUNT(*) as count
      FROM active_projects
      GROUP BY status
      ORDER BY count DESC
    `)
  ])) as [
    { average_value: number | null; average_duration: number | null } | undefined,
    Array<{ type: string; count: number; total_value: number }>,
    Array<{ status: string; count: number }>,
  ];

  return {
    averageValue: avgStats?.average_value || 0,
    averageDuration: avgStats?.average_duration || 0,
    popularTypes: typeStats.map((t) => ({
      type: t.type || 'Unknown',
      count: t.count,
      totalValue: t.total_value || 0
    })),
    statusBreakdown: statusStats.map((s) => ({
      status: s.status,
      count: s.count
    }))
  };
}

// ============================================
// CLIENT INSIGHTS
// ============================================

/**
 * Calculate client lifetime value
 */
export async function getClientLifetimeValue(limit: number = 20): Promise<
  Array<{
    clientId: number;
    clientName: string;
    totalRevenue: number;
    projectCount: number;
    averageProjectValue: number;
    firstProjectDate: string;
    lastProjectDate: string;
    lifetimeMonths: number;
    monthlyValue: number;
  }>
> {
  const db = getDatabase();

  const results = (await db.all(
    `
    SELECT
      c.id as client_id,
      COALESCE(c.contact_name, c.company_name) as client_name,
      SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END) as total_revenue,
      COUNT(DISTINCT p.id) as project_count,
      MIN(p.created_at) as first_project_date,
      MAX(p.created_at) as last_project_date
    FROM active_clients c
    LEFT JOIN active_projects p ON c.id = p.client_id
    LEFT JOIN active_invoices i ON p.id = i.project_id
    GROUP BY c.id, COALESCE(c.contact_name, c.company_name)
    HAVING total_revenue > 0
    ORDER BY total_revenue DESC
    LIMIT ?
  `,
    [limit]
  )) as Array<{
    client_id: number;
    client_name: string;
    total_revenue: number;
    project_count: number;
    first_project_date: string | null;
    last_project_date: string | null;
  }>;

  return results.map((r) => {
    const firstDate = r.first_project_date ? new Date(r.first_project_date) : new Date();
    const lastDate = r.last_project_date ? new Date(r.last_project_date) : new Date();
    const lifetimeMonths = Math.max(
      1,
      Math.ceil((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
    );

    return {
      clientId: r.client_id,
      clientName: r.client_name,
      totalRevenue: r.total_revenue || 0,
      projectCount: r.project_count,
      averageProjectValue: r.project_count > 0 ? (r.total_revenue || 0) / r.project_count : 0,
      firstProjectDate: r.first_project_date || '',
      lastProjectDate: r.last_project_date || '',
      lifetimeMonths,
      monthlyValue: (r.total_revenue || 0) / lifetimeMonths
    };
  });
}

/**
 * Calculate client activity scores
 */
export async function getClientActivityScores(limit: number = 20): Promise<
  Array<{
    clientId: number;
    clientName: string;
    score: number;
    factors: {
      responseTime: number;
      approvalSpeed: number;
      paymentSpeed: number;
      engagement: number;
    };
    lastActivity: string;
    riskLevel: 'low' | 'medium' | 'high';
  }>
> {
  const db = getDatabase();

  const results = (await db.all(
    `
    SELECT
      c.id as client_id,
      COALESCE(c.contact_name, c.company_name) as client_name,
      c.updated_at as last_activity,
      (SELECT COUNT(*) FROM active_messages m JOIN active_message_threads t ON m.thread_id = t.id WHERE t.client_id = c.id AND m.created_at > datetime('now', '-30 days')) as recent_messages,
      (SELECT COUNT(*) FROM active_invoices i WHERE i.client_id = c.id AND i.status = 'paid') as paid_invoices,
      (SELECT AVG(JULIANDAY(i.paid_at) - JULIANDAY(i.due_date))
       FROM active_invoices i WHERE i.client_id = c.id AND i.status = 'paid' AND i.paid_at IS NOT NULL) as avg_payment_days
    FROM active_clients c
    ORDER BY c.updated_at DESC
    LIMIT ?
  `,
    [limit]
  )) as Array<{
    client_id: number;
    client_name: string;
    last_activity: string;
    recent_messages: number;
    paid_invoices: number;
    avg_payment_days: number | null;
  }>;

  return results.map((r) => {
    const engagementScore = Math.min(25, (r.recent_messages || 0) * 5);
    const paymentScore =
      r.avg_payment_days !== null
        ? Math.max(0, 25 - Math.max(0, r.avg_payment_days * 1.5))
        : 12.5;
    const responseScore = 12.5;
    const approvalScore = 12.5;

    const totalScore = responseScore + approvalScore + paymentScore + engagementScore;

    return {
      clientId: r.client_id,
      clientName: r.client_name,
      score: Math.round(totalScore),
      factors: {
        responseTime: Math.round(responseScore),
        approvalSpeed: Math.round(approvalScore),
        paymentSpeed: Math.round(paymentScore),
        engagement: Math.round(engagementScore)
      },
      lastActivity: r.last_activity || '',
      riskLevel: totalScore >= 70 ? 'low' : totalScore >= 40 ? 'medium' : 'high'
    };
  });
}

/**
 * Get upsell opportunities (clients without certain services)
 */
export async function getUpsellOpportunities(): Promise<
  Array<{
    clientId: number;
    clientName: string;
    currentServices: string[];
    missingServices: string[];
    recommendedService: string;
    potentialValue: number;
    lastContact: string;
  }>
  > {
  const db = getDatabase();

  const clients = (await db.all(`
    SELECT
      c.id as client_id,
      COALESCE(c.contact_name, c.company_name) as client_name,
      c.updated_at as last_contact,
      GROUP_CONCAT(DISTINCT p.project_type) as project_types,
      (SELECT COUNT(*) FROM active_projects WHERE client_id = c.id AND project_type = 'maintenance') as has_maintenance
    FROM active_clients c
    LEFT JOIN active_projects p ON c.id = p.client_id
    GROUP BY c.id, COALESCE(c.contact_name, c.company_name)
    HAVING has_maintenance = 0
  `)) as Array<{
    client_id: number;
    client_name: string;
    last_contact: string;
    project_types: string | null;
    has_maintenance: number;
  }>;

  const allServices = [
    'website',
    'web-app',
    'mobile',
    'branding',
    'maintenance',
    'seo',
    'hosting'
  ];

  return clients.map((c) => {
    const currentServices = (c.project_types || '').split(',').filter(Boolean);
    const missingServices = allServices.filter((s) => !currentServices.includes(s));

    const recommendedService = !currentServices.includes('maintenance')
      ? 'maintenance'
      : missingServices[0] || 'consultation';

    return {
      clientId: c.client_id,
      clientName: c.client_name,
      currentServices,
      missingServices,
      recommendedService,
      potentialValue: recommendedService === 'maintenance' ? 500 : 2000,
      lastContact: c.last_contact || ''
    };
  });
}

// ============================================
// OPERATIONAL REPORTS
// ============================================

/**
 * Get overdue invoices report
 */
export async function getOverdueInvoicesReport(): Promise<
  Array<{
    invoiceId: number;
    invoiceNumber: string;
    clientName: string;
    amount: number;
    dueDate: string;
    daysOverdue: number;
    remindersSent: number;
  }>
  > {
  const db = getDatabase();

  const results = (await db.all(`
    SELECT
      i.id as invoice_id,
      i.invoice_number,
      COALESCE(c.contact_name, c.company_name) as client_name,
      i.total_amount as amount,
      i.due_date,
      CAST(JULIANDAY('now') - JULIANDAY(i.due_date) AS INTEGER) as days_overdue,
      (SELECT COUNT(*) FROM invoice_reminders WHERE invoice_id = i.id) as reminders_sent
    FROM active_invoices i
    JOIN active_clients c ON i.client_id = c.id
    WHERE i.status IN ('sent', 'overdue')
      AND i.due_date < date('now')
    ORDER BY days_overdue DESC
  `)) as Array<{
    invoice_id: number;
    invoice_number: string;
    client_name: string;
    amount: number;
    due_date: string;
    days_overdue: number;
    reminders_sent: number;
  }>;

  return results.map((r) => ({
    invoiceId: r.invoice_id,
    invoiceNumber: r.invoice_number || `INV-${r.invoice_id}`,
    clientName: r.client_name,
    amount: r.amount || 0,
    dueDate: r.due_date,
    daysOverdue: r.days_overdue,
    remindersSent: r.reminders_sent || 0
  }));
}

/**
 * Get pending approvals aging report
 */
export async function getPendingApprovalsReport(): Promise<
  Array<{
    id: number;
    type: string;
    entityName: string;
    clientName: string;
    requestedDate: string;
    daysWaiting: number;
    remindersSent: number;
  }>
  > {
  const db = getDatabase();

  const results = (await db.all(`
    SELECT
      a.id,
      a.entity_type as type,
      COALESCE(p.project_name, d.name, 'Unknown') as entity_name,
      COALESCE(c.contact_name, c.company_name) as client_name,
      a.created_at as requested_date,
      CAST(JULIANDAY('now') - JULIANDAY(a.created_at) AS INTEGER) as days_waiting,
      (SELECT COUNT(*) FROM approval_reminders WHERE approval_id = a.id) as reminders_sent
    FROM approvals a
    LEFT JOIN active_projects p ON a.entity_type = 'project' AND a.entity_id = p.id
    LEFT JOIN active_deliverables d ON a.entity_type = 'deliverable' AND a.entity_id = d.id
    LEFT JOIN active_clients c ON COALESCE(p.client_id, (SELECT project_id FROM active_deliverables WHERE id = a.entity_id)) IN (SELECT id FROM active_projects WHERE client_id = c.id)
    WHERE a.status = 'pending'
    ORDER BY days_waiting DESC
  `)) as Array<{
    id: number;
    type: string;
    entity_name: string;
    client_name: string;
    requested_date: string;
    days_waiting: number;
    reminders_sent: number;
  }>;

  return results.map((r) => ({
    id: r.id,
    type: r.type,
    entityName: r.entity_name,
    clientName: r.client_name || 'Unknown',
    requestedDate: r.requested_date,
    daysWaiting: r.days_waiting,
    remindersSent: r.reminders_sent || 0
  }));
}

/**
 * Get document request status report
 */
export async function getDocumentRequestsStatusReport(): Promise<{
  pending: number;
  submitted: number;
  approved: number;
  overdue: number;
  byClient: { clientId: number; clientName: string; pending: number; overdue: number }[];
}> {
  const db = getDatabase();

  const [statusCounts, byClient] = (await Promise.all([
    db.get(`
      SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
        SUM(CASE WHEN status = 'pending' AND due_date < date('now') THEN 1 ELSE 0 END) as overdue
      FROM active_document_requests
    `),
    db.all(`
      SELECT
        c.id as client_id,
        COALESCE(c.contact_name, c.company_name) as client_name,
        SUM(CASE WHEN dr.status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN dr.status = 'pending' AND dr.due_date < date('now') THEN 1 ELSE 0 END) as overdue
      FROM active_clients c
      JOIN active_document_requests dr ON dr.client_id = c.id
      GROUP BY c.id, COALESCE(c.contact_name, c.company_name)
      HAVING pending > 0
      ORDER BY overdue DESC, pending DESC
    `)
  ])) as [
    { pending: number; submitted: number; approved: number; overdue: number } | undefined,
    Array<{ client_id: number; client_name: string; pending: number; overdue: number }>,
  ];

  return {
    pending: statusCounts?.pending || 0,
    submitted: statusCounts?.submitted || 0,
    approved: statusCounts?.approved || 0,
    overdue: statusCounts?.overdue || 0,
    byClient: byClient.map((c) => ({
      clientId: c.client_id,
      clientName: c.client_name,
      pending: c.pending,
      overdue: c.overdue
    }))
  };
}

/**
 * Get project health summary
 */
export async function getProjectHealthSummary(): Promise<{
  onTrack: number;
  atRisk: number;
  overdue: number;
  projects: Array<{
    projectId: number;
    projectName: string;
    clientName: string;
    status: 'on_track' | 'at_risk' | 'overdue';
    dueDate: string;
    completionPercent: number;
    issues: string[];
  }>;
}> {
  const db = getDatabase();

  const projects = (await db.all(`
    SELECT
      p.id as project_id,
      p.project_name as project_name,
      COALESCE(c.contact_name, c.company_name) as client_name,
      p.status,
      p.estimated_end_date as due_date,
      p.created_at,
      (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status = 'completed') as completed_tasks,
      (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id) as total_tasks,
      (SELECT COUNT(*) FROM project_tasks WHERE project_id = p.id AND status != 'completed' AND due_date < date('now')) as overdue_tasks,
      (SELECT COUNT(*) FROM active_invoices WHERE project_id = p.id AND status IN ('sent', 'overdue') AND due_date < date('now')) as overdue_invoices
    FROM active_projects p
    JOIN active_clients c ON p.client_id = c.id
    WHERE p.status IN ('active', 'in_progress', 'review')
    ORDER BY p.estimated_end_date ASC
  `)) as Array<{
    project_id: number;
    project_name: string;
    client_name: string;
    status: string;
    due_date: string | null;
    created_at: string;
    completed_tasks: number;
    total_tasks: number;
    overdue_tasks: number;
    overdue_invoices: number;
  }>;

  let onTrack = 0;
  let atRisk = 0;
  let overdue = 0;

  const projectList = projects.map((p) => {
    const completionPercent =
      p.total_tasks > 0 ? Math.round((p.completed_tasks / p.total_tasks) * 100) : 0;

    const issues: string[] = [];
    let healthStatus: 'on_track' | 'at_risk' | 'overdue' = 'on_track';

    if (p.overdue_tasks > 0) {
      issues.push(`${p.overdue_tasks} overdue task(s)`);
      healthStatus = 'at_risk';
    }

    if (p.overdue_invoices > 0) {
      issues.push(`${p.overdue_invoices} overdue invoice(s)`);
      healthStatus = 'at_risk';
    }

    if (p.due_date && new Date(p.due_date) < new Date()) {
      issues.push('Project past due date');
      healthStatus = 'overdue';
    }

    if (healthStatus === 'on_track') onTrack++;
    else if (healthStatus === 'at_risk') atRisk++;
    else overdue++;

    return {
      projectId: p.project_id,
      projectName: p.project_name,
      clientName: p.client_name,
      status: healthStatus,
      dueDate: p.due_date || '',
      completionPercent,
      issues
    };
  });

  return {
    onTrack,
    atRisk,
    overdue,
    projects: projectList
  };
}

// =====================================================
// ADMIN KPI ANALYTICS (business dashboard)
// =====================================================

/** Calculate percentage change between two values */
function calcChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

/**
 * Get full admin analytics KPI data for the admin analytics dashboard.
 * Includes KPIs with period-over-period change, revenue chart, project chart, leads chart,
 * and source breakdown.
 */
export async function getAdminKPIAnalytics(daysBack: number): Promise<Record<string, unknown>> {
  const db = getDatabase();

  const now = new Date();
  const currentStart = new Date();
  currentStart.setDate(currentStart.getDate() - daysBack);
  const previousStart = new Date();
  previousStart.setDate(previousStart.getDate() - (daysBack * 2));

  const currentStartStr = currentStart.toISOString().split('T')[0];
  const previousStartStr = previousStart.toISOString().split('T')[0];
  const nowStr = now.toISOString().split('T')[0];

  // Revenue
  const currentRevenue = await db.get(`
    SELECT COALESCE(SUM(amount_total), 0) as value
    FROM invoices
    WHERE status = 'paid' AND DATE(COALESCE(paid_date, updated_at)) >= ? AND DATE(COALESCE(paid_date, updated_at)) <= ?
  `, [currentStartStr, nowStr]);
  const previousRevenue = await db.get(`
    SELECT COALESCE(SUM(amount_total), 0) as value
    FROM invoices
    WHERE status = 'paid' AND DATE(COALESCE(paid_date, updated_at)) >= ? AND DATE(COALESCE(paid_date, updated_at)) < ?
  `, [previousStartStr, currentStartStr]);

  // Clients
  const currentClients = await db.get('SELECT COUNT(*) as value FROM clients WHERE deleted_at IS NULL');
  const newClientsCurrentPeriod = await db.get(
    'SELECT COUNT(*) as value FROM clients WHERE deleted_at IS NULL AND DATE(created_at) >= ?',
    [currentStartStr]
  );
  const newClientsPreviousPeriod = await db.get(
    'SELECT COUNT(*) as value FROM clients WHERE deleted_at IS NULL AND DATE(created_at) >= ? AND DATE(created_at) < ?',
    [previousStartStr, currentStartStr]
  );

  // Projects
  const activeProjects = await db.get(`
    SELECT COUNT(*) as value FROM projects
    WHERE status IN ('active', 'in-progress', 'in_progress') AND deleted_at IS NULL
  `);
  const newProjectsCurrentPeriod = await db.get(
    'SELECT COUNT(*) as value FROM projects WHERE deleted_at IS NULL AND DATE(created_at) >= ?',
    [currentStartStr]
  );
  const newProjectsPreviousPeriod = await db.get(
    'SELECT COUNT(*) as value FROM projects WHERE deleted_at IS NULL AND DATE(created_at) >= ? AND DATE(created_at) < ?',
    [previousStartStr, currentStartStr]
  );

  // Invoices
  const invoicesSent = await db.get(
    'SELECT COUNT(*) as value FROM invoices WHERE DATE(created_at) >= ?', [currentStartStr]
  );
  const invoicesSentPrevious = await db.get(
    'SELECT COUNT(*) as value FROM invoices WHERE DATE(created_at) >= ? AND DATE(created_at) < ?',
    [previousStartStr, currentStartStr]
  );

  // Conversion rate
  const leadsStats = await db.get(`
    SELECT COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status IN ('active', 'in-progress', 'in_progress', 'completed') THEN 1 ELSE 0 END), 0) as converted
    FROM projects WHERE deleted_at IS NULL
  `);
  const leadsStatsPrevious = await db.get(`
    SELECT COUNT(*) as total,
      COALESCE(SUM(CASE WHEN status IN ('active', 'in-progress', 'in_progress', 'completed') THEN 1 ELSE 0 END), 0) as converted
    FROM projects WHERE deleted_at IS NULL AND DATE(created_at) < ?
  `, [currentStartStr]);

  const cr = (leadsStats as Record<string, unknown>) || {};
  const crp = (leadsStatsPrevious as Record<string, unknown>) || {};
  const currentConversionRate = (Number(cr.total) || 0) > 0
    ? Math.round((Number(cr.converted) / Number(cr.total)) * 100) : 0;
  const previousConversionRate = (Number(crp.total) || 0) > 0
    ? Math.round((Number(crp.converted) / Number(crp.total)) * 100) : 0;

  // Avg project value
  const avgProjectValue = await db.get(
    'SELECT COALESCE(AVG(expected_value), 0) as value FROM projects WHERE deleted_at IS NULL AND expected_value > 0'
  );
  const avgProjectValuePrevious = await db.get(
    'SELECT COALESCE(AVG(expected_value), 0) as value FROM projects WHERE deleted_at IS NULL AND expected_value > 0 AND DATE(created_at) < ?',
    [currentStartStr]
  );

  // Charts
  const revenueChartData = await db.all(`
    SELECT strftime('%Y-%m-%d', COALESCE(paid_date, updated_at)) as date, SUM(amount_total) as revenue
    FROM invoices WHERE status = 'paid' AND DATE(COALESCE(paid_date, updated_at)) >= ?
    GROUP BY strftime('%Y-%m-%d', COALESCE(paid_date, updated_at)) ORDER BY date ASC
  `, [currentStartStr]) as Array<{ date: string; revenue: number }>;

  const projectsByStatus = await db.all(
    'SELECT status, COUNT(*) as count FROM projects WHERE deleted_at IS NULL GROUP BY status'
  ) as Array<{ status: string; count: number }>;

  const leadFunnelData = await db.all(`
    SELECT status, COUNT(*) as count FROM projects WHERE deleted_at IS NULL GROUP BY status
    ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'active' THEN 2 WHEN 'in_progress' THEN 3
      WHEN 'in-progress' THEN 3 WHEN 'completed' THEN 4 WHEN 'cancelled' THEN 5 ELSE 6 END
  `) as Array<{ status: string; count: number }>;

  const sourceBreakdownData = await db.all(
    "SELECT 'Direct' as source, COUNT(*) as count FROM projects WHERE deleted_at IS NULL"
  ) as Array<{ source: string; count: number }>;

  const totalLeads = sourceBreakdownData.reduce((sum, s) => sum + s.count, 0);

  const v = (row: Record<string, unknown> | null | undefined) => Number((row as Record<string, unknown>)?.value) || 0;

  return {
    kpis: {
      revenue: { value: v(currentRevenue as Record<string, unknown>), change: calcChange(v(currentRevenue as Record<string, unknown>), v(previousRevenue as Record<string, unknown>)) },
      clients: { value: v(currentClients as Record<string, unknown>), change: calcChange(v(newClientsCurrentPeriod as Record<string, unknown>), v(newClientsPreviousPeriod as Record<string, unknown>)) },
      projects: { value: v(activeProjects as Record<string, unknown>), change: calcChange(v(newProjectsCurrentPeriod as Record<string, unknown>), v(newProjectsPreviousPeriod as Record<string, unknown>)) },
      invoices: { value: v(invoicesSent as Record<string, unknown>), change: calcChange(v(invoicesSent as Record<string, unknown>), v(invoicesSentPrevious as Record<string, unknown>)) },
      conversionRate: { value: currentConversionRate, change: currentConversionRate - previousConversionRate },
      avgProjectValue: { value: Math.round(v(avgProjectValue as Record<string, unknown>)), change: calcChange(v(avgProjectValue as Record<string, unknown>), v(avgProjectValuePrevious as Record<string, unknown>)) }
    },
    revenueChart: {
      labels: revenueChartData.map(d => d.date),
      datasets: [{ label: 'Revenue', data: revenueChartData.map(d => d.revenue), color: 'var(--status-completed)' }]
    },
    projectsChart: {
      labels: projectsByStatus.map(p => p.status),
      datasets: [{ label: 'Projects', data: projectsByStatus.map(p => p.count), color: 'var(--color-brand-primary)' }]
    },
    leadsChart: {
      labels: leadFunnelData.map(l => l.status),
      datasets: [{ label: 'Leads', data: leadFunnelData.map(l => l.count), color: 'var(--status-pending)' }]
    },
    sourceBreakdown: sourceBreakdownData.map(s => ({
      source: s.source,
      count: s.count,
      percentage: totalLeads > 0 ? Math.round((s.count / totalLeads) * 100) : 0
    }))
  };
}
