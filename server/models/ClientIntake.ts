/**
 * ===============================================
 * CLIENT INTAKE MODEL
 * ===============================================
 * @file server/models/ClientIntake.ts
 * 
 * Model for client intake form submissions.
 */

import { BaseModel } from '../database/model.js';

export interface ClientIntakeAttributes {
  id?: number;
  name: string;
  email: string;
  company_name?: string;
  phone?: string;
  project_type: 'simple-site' | 'business-site' | 'portfolio' | 'e-commerce' | 'web-app' | 'browser-extension' | 'other';
  budget_range: 'under-2k' | '2k-5k' | '5k-10k' | '10k-plus' | 'discuss';
  timeline: 'asap' | '1-3-months' | '3-6-months' | 'flexible';
  description: string;
  features?: string[];
  hosting_preferences?: string;
  content_status?: 'ready' | 'partially-ready' | 'needs-created';
  design_preferences?: string;
  inspiration_sites?: string;
  maintenance_guide?: 'yes-basic' | 'yes-intermediate' | 'yes-advanced' | 'no';
  additional_notes?: string;
  status: 'pending' | 'reviewed' | 'quoted' | 'approved' | 'rejected' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_hours?: number;
  quoted_price?: number;
  reviewed_by?: number; // User ID
  reviewed_at?: string;
  created_at?: string;
  updated_at?: string;
}

export class ClientIntake extends BaseModel<ClientIntakeAttributes> {
  protected static config = {
    tableName: 'client_intakes',
    primaryKey: 'id',
    timestamps: true,
    softDeletes: false,
    fillable: [
      'name',
      'email',
      'company_name',
      'phone',
      'project_type',
      'budget_range',
      'timeline',
      'description',
      'features',
      'hosting_preferences',
      'content_status',
      'design_preferences',
      'inspiration_sites',
      'maintenance_guide',
      'additional_notes',
      'status',
      'priority',
      'estimated_hours',
      'quoted_price'
    ],
    hidden: [],
    casts: {
      id: 'number' as const,
      features: 'json' as const,
      estimated_hours: 'number' as const,
      quoted_price: 'number' as const,
      reviewed_by: 'number' as const,
      reviewed_at: 'date' as const,
      created_at: 'date' as const,
      updated_at: 'date' as const
    }
  };

  // Accessor methods
  getId(): number | undefined {
    return this.get('id');
  }

  getName(): string {
    return this.get('name');
  }

  getEmail(): string {
    return this.get('email');
  }

  getCompanyName(): string | undefined {
    return this.get('company_name');
  }

  getProjectType(): ClientIntakeAttributes['project_type'] {
    return this.get('project_type');
  }

  getBudgetRange(): ClientIntakeAttributes['budget_range'] {
    return this.get('budget_range');
  }

  getTimeline(): ClientIntakeAttributes['timeline'] {
    return this.get('timeline');
  }

  getDescription(): string {
    return this.get('description');
  }

  getFeatures(): string[] {
    return this.get('features') || [];
  }

  getStatus(): ClientIntakeAttributes['status'] {
    return this.get('status') || 'pending';
  }

  getPriority(): ClientIntakeAttributes['priority'] {
    return this.get('priority') || 'medium';
  }

  getEstimatedHours(): number | undefined {
    return this.get('estimated_hours');
  }

  getQuotedPrice(): number | undefined {
    return this.get('quoted_price');
  }

  // Status checks
  isPending(): boolean {
    return this.getStatus() === 'pending';
  }

  isReviewed(): boolean {
    return ['reviewed', 'quoted', 'approved', 'rejected', 'completed'].includes(this.getStatus());
  }

  isApproved(): boolean {
    return this.getStatus() === 'approved';
  }

  isCompleted(): boolean {
    return this.getStatus() === 'completed';
  }

  // Mutator methods
  setStatus(status: ClientIntakeAttributes['status']): this {
    return this.set('status', status);
  }

  setPriority(priority: ClientIntakeAttributes['priority']): this {
    return this.set('priority', priority);
  }

  setEstimatedHours(hours: number): this {
    return this.set('estimated_hours', hours);
  }

  setQuotedPrice(price: number): this {
    return this.set('quoted_price', price);
  }

  markAsReviewed(reviewerId: number): this {
    return this
      .set('status', 'reviewed')
      .set('reviewed_by', reviewerId)
      .set('reviewed_at', new Date().toISOString());
  }

  markAsQuoted(price: number, hours?: number): this {
    this.set('status', 'quoted');
    this.set('quoted_price', price);
    
    if (hours) {
      this.set('estimated_hours', hours);
    }

    return this;
  }

  approve(): this {
    return this.set('status', 'approved');
  }

  reject(): this {
    return this.set('status', 'rejected');
  }

  complete(): this {
    return this.set('status', 'completed');
  }

  // Business logic methods
  calculateComplexityScore(): number {
    let score = 0;

    // Project type complexity
    const typeScores = {
      'simple-site': 1,
      'portfolio': 2,
      'business-site': 3,
      'e-commerce': 4,
      'web-app': 5,
      'browser-extension': 4,
      'other': 3
    };
    score += typeScores[this.getProjectType()] || 3;

    // Features complexity
    const features = this.getFeatures();
    score += features.length * 0.5;

    // Timeline urgency
    const timelineScores = {
      'asap': 2,
      '1-3-months': 1,
      '3-6-months': 0.5,
      'flexible': 0
    };
    score += timelineScores[this.getTimeline()] || 0;

    // Budget range (lower budget = higher complexity to deliver value)
    const budgetScores = {
      'under-2k': 2,
      '2k-5k': 1,
      '5k-10k': 0.5,
      '10k-plus': 0,
      'discuss': 1
    };
    score += budgetScores[this.getBudgetRange()] || 1;

    return Math.round(score * 10) / 10; // Round to 1 decimal
  }

  suggestEstimatedHours(): number {
    const complexity = this.calculateComplexityScore();
    const baseHours = {
      'simple-site': 8,
      'portfolio': 20,
      'business-site': 40,
      'e-commerce': 80,
      'web-app': 120,
      'browser-extension': 60,
      'other': 40
    };

    const base = baseHours[this.getProjectType()] || 40;
    const adjusted = Math.round(base * (1 + complexity / 10));

    return Math.max(8, adjusted); // Minimum 8 hours
  }

  suggestQuotedPrice(): number {
    const estimatedHours = this.getEstimatedHours() || this.suggestEstimatedHours();
    const hourlyRate = 100; // Base hourly rate
    
    // Adjust rate based on project type
    const rateMultipliers = {
      'simple-site': 0.8,
      'portfolio': 0.9,
      'business-site': 1.0,
      'e-commerce': 1.2,
      'web-app': 1.3,
      'browser-extension': 1.1,
      'other': 1.0
    };

    const multiplier = rateMultipliers[this.getProjectType()] || 1.0;
    const adjustedRate = hourlyRate * multiplier;

    return Math.round(estimatedHours * adjustedRate);
  }

  // Query scopes
  static async findPending(): Promise<ClientIntake[]> {
    const result = await this.query()
      .where('status', '=', 'pending')
      .orderBy('created_at', 'DESC')
      .get();
    
    return result.rows.map(row => {
      const intake = new this();
      intake.setAttributes(row as any, true);
      return intake;
    });
  }

  static async findByStatus(status: ClientIntakeAttributes['status']): Promise<ClientIntake[]> {
    const result = await this.query()
      .where('status', '=', status)
      .orderBy('created_at', 'DESC')
      .get();
    
    return result.rows.map(row => {
      const intake = new this();
      intake.setAttributes(row as any, true);
      return intake;
    });
  }

  static async findByPriority(priority: ClientIntakeAttributes['priority']): Promise<ClientIntake[]> {
    const result = await this.query()
      .where('priority', '=', priority)
      .orderBy('created_at', 'DESC')
      .get();
    
    return result.rows.map(row => {
      const intake = new this();
      intake.setAttributes(row as any, true);
      return intake;
    });
  }

  static async findByEmail(email: string): Promise<ClientIntake[]> {
    const result = await this.query()
      .where('email', '=', email.toLowerCase())
      .orderBy('created_at', 'DESC')
      .get();
    
    return result.rows.map(row => {
      const intake = new this();
      intake.setAttributes(row as any, true);
      return intake;
    });
  }

  static async findByProjectType(projectType: ClientIntakeAttributes['project_type']): Promise<ClientIntake[]> {
    const result = await this.query()
      .where('project_type', '=', projectType)
      .orderBy('created_at', 'DESC')
      .get();
    
    return result.rows.map(row => {
      const intake = new this();
      intake.setAttributes(row as any, true);
      return intake;
    });
  }

  static async findRecentlyCreated(days: number = 7): Promise<ClientIntake[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const result = await this.query()
      .where('created_at', '>=', cutoffDate.toISOString())
      .orderBy('created_at', 'DESC')
      .get();
    
    return result.rows.map(row => {
      const intake = new this();
      intake.setAttributes(row as any, true);
      return intake;
    });
  }

  // Statistics methods
  static async getStatusStats(): Promise<Record<string, number>> {
    const result = await this.raw(`
      SELECT status, COUNT(*) as count 
      FROM ${this.getTableName()} 
      GROUP BY status
    `);

    const stats: Record<string, number> = {};
    result.rows.forEach((row: any) => {
      stats[row.status] = row.count;
    });

    return stats;
  }

  static async getProjectTypeStats(): Promise<Record<string, number>> {
    const result = await this.raw(`
      SELECT project_type, COUNT(*) as count 
      FROM ${this.getTableName()} 
      GROUP BY project_type
    `);

    const stats: Record<string, number> = {};
    result.rows.forEach((row: any) => {
      stats[row.project_type] = row.count;
    });

    return stats;
  }

  static async getAverageQuoteByProjectType(): Promise<Record<string, number>> {
    const result = await this.raw(`
      SELECT project_type, AVG(quoted_price) as avg_price 
      FROM ${this.getTableName()} 
      WHERE quoted_price IS NOT NULL 
      GROUP BY project_type
    `);

    const stats: Record<string, number> = {};
    result.rows.forEach((row: any) => {
      stats[row.project_type] = Math.round(row.avg_price);
    });

    return stats;
  }

  // Validation
  static validateProjectType(projectType: string): boolean {
    const validTypes = ['simple-site', 'business-site', 'portfolio', 'e-commerce', 'web-app', 'browser-extension', 'other'];
    return validTypes.includes(projectType);
  }

  static validateBudgetRange(budgetRange: string): boolean {
    const validRanges = ['under-2k', '2k-5k', '5k-10k', '10k-plus', 'discuss'];
    return validRanges.includes(budgetRange);
  }

  static validateTimeline(timeline: string): boolean {
    const validTimelines = ['asap', '1-3-months', '3-6-months', 'flexible'];
    return validTimelines.includes(timeline);
  }
}