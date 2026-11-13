/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import {
  AdminPermissions,
  AdminUserAccount,
  AidApplication,
  AuditLog,
  CommitteePosition,
  CommitteeTerm,
  FinancialAccount,
  FinancialCorrection,
  FinancialFund,
  FinancialTransaction,
  Member,
  MemberStatus,
  Notice,
  PermissionChangeLog,
  Role,
  SystemSettings,
  TransactionType,
} from '../types.ts';
import {
  DEMO_SANDBOX_ACCOUNTS,
  DEMO_SANDBOX_AID_APPLICATIONS,
  DEMO_SANDBOX_COMMITTEES,
  DEMO_SANDBOX_FUNDS,
  DEMO_SANDBOX_MEMBERS,
  DEMO_SANDBOX_NOTICES,
  DEMO_SANDBOX_TRANSACTIONS,
  INITIAL_ACCOUNTS,
  INITIAL_AID_APPLICATIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_COMMITTEES,
  INITIAL_FUNDS,
  INITIAL_MEMBERS,
  INITIAL_NOTICES,
  INITIAL_ROLE_PERMISSIONS,
  INITIAL_SETTINGS,
  INITIAL_TRANSACTIONS,
} from './initialData.ts';
import { supabase, isSupabaseConfigured } from '../lib/supabase.ts';

const LEGACY_PREFIX_V5 = 'patgram_kalyan_samity_v5_';
const STORAGE_KEY_PREFIX = 'patgram_kalyan_samity_prod_v6_';

export function roundBDT(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// Simple deterministic hash generator for tamper-evident audit chain
function generateHash(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0') + '-' + Date.now().toString(16);
}

// Salted SHA-256 password hashing using browser/Node Web Crypto API
async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  return generateHash(`${salt}:${password}`);
}

export class AppStore {
  private listeners: Set<() => void> = new Set();

  public settings: SystemSettings;
  public rolePermissions: Record<Role, AdminPermissions>;
  public isSandboxDemoActive = false;

  // Auth State
  public isAuthenticated = false;
  public authMode: 'supabase' | 'local' = isSupabaseConfigured ? 'supabase' : 'local';
  public authenticatedRole: Role = 'general_admin';
  public authenticatedEmail = '';
  public currentRole: Role = 'general_admin';
  public currentUser = {
    id: 'guest',
    name: 'অতিথি ব্যবহারকারী',
    email: '',
    role: 'general_admin' as Role,
  };

  public adminAccounts: AdminUserAccount[];
  public funds: FinancialFund[];
  public accounts: FinancialAccount[];
  public transactions: FinancialTransaction[];
  public corrections: FinancialCorrection[];
  public members: Member[];
  public committees: CommitteeTerm[];
  public notices: Notice[];
  public aidApplications: AidApplication[];
  public auditLogs: AuditLog[];
  public permissionChangeLogs: PermissionChangeLog[];

  // Mutex lock to emulate PostgreSQL row-level concurrency lock during writes
  private isLocked = false;

  constructor() {
    this.migrateAuthFromLegacyV5();

    this.settings = this.load('settings', INITIAL_SETTINGS);
    this.rolePermissions = this.load('rolePermissions', INITIAL_ROLE_PERMISSIONS);
    this.isSandboxDemoActive = this.load('isSandboxDemoActive', false);
    this.adminAccounts = this.load('adminAccounts', []);
    this.funds = this.load('funds', INITIAL_FUNDS);
    this.accounts = this.load('accounts', INITIAL_ACCOUNTS);
    this.transactions = this.load('transactions', INITIAL_TRANSACTIONS);
    this.corrections = this.load('corrections', []);
    this.members = this.load('members', INITIAL_MEMBERS);
    this.committees = this.load('committees', INITIAL_COMMITTEES);
    this.notices = this.load('notices', INITIAL_NOTICES);
    this.aidApplications = this.load('aidApplications', INITIAL_AID_APPLICATIONS);
    this.auditLogs = this.load('auditLogs', INITIAL_AUDIT_LOGS);
    this.permissionChangeLogs = this.load('permissionChangeLogs', []);

    if (isSupabaseConfigured && supabase) {
      this.initSupabaseSession();
      this.hydratePublicFromSupabase();
    } else {
      const savedSession = this.load<{
        id: string;
        email: string;
        name: string;
        role: Role;
      } | null>('authSession', null);
      if (savedSession) {
        const account = this.adminAccounts.find(
          (a) => a.id === savedSession.id && a.status === 'active'
        );
        if (account) {
          this.isAuthenticated = true;
          this.authenticatedRole = account.role;
          this.authenticatedEmail = account.email;
          this.currentRole = account.role;
          this.currentUser = {
            id: account.id,
            name: account.fullName,
            email: account.email,
            role: account.role,
          };
        }
      }
    }
  }

  // Migrate registered admin accounts/sessions once from v5 so real accounts survive demo cleanup
  private migrateAuthFromLegacyV5() {
    try {
      if (typeof localStorage === 'undefined') return;
      const alreadyMigrated = localStorage.getItem(STORAGE_KEY_PREFIX + 'migratedFromV5');
      if (alreadyMigrated) return;

      const v5Admins = localStorage.getItem(LEGACY_PREFIX_V5 + 'adminAccounts');
      const v6Admins = localStorage.getItem(STORAGE_KEY_PREFIX + 'adminAccounts');
      if (v5Admins && !v6Admins) {
        localStorage.setItem(STORAGE_KEY_PREFIX + 'adminAccounts', v5Admins);
      }

      const v5Session = localStorage.getItem(LEGACY_PREFIX_V5 + 'authSession');
      const v6Session = localStorage.getItem(STORAGE_KEY_PREFIX + 'authSession');
      if (v5Session && !v6Session) {
        localStorage.setItem(STORAGE_KEY_PREFIX + 'authSession', v5Session);
      }

      const v5Perms = localStorage.getItem(LEGACY_PREFIX_V5 + 'rolePermissions');
      const v6Perms = localStorage.getItem(STORAGE_KEY_PREFIX + 'rolePermissions');
      if (v5Perms && !v6Perms) {
        localStorage.setItem(STORAGE_KEY_PREFIX + 'rolePermissions', v5Perms);
      }

      localStorage.setItem(STORAGE_KEY_PREFIX + 'migratedFromV5', 'true');
    } catch {
      // ignore storage unavailable
    }
  }

  private async initSupabaseSession() {
    if (!supabase) return;
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        await this.syncSupabaseProfile(data.session.user.id, data.session.user.email || '');
      }
      supabase.auth.onAuthStateChange(async (_event, session) => {
        if (session?.user) {
          await this.syncSupabaseProfile(session.user.id, session.user.email || '');
        } else {
          this.clearAuthSessionState();
        }
      });
    } catch (e) {
      console.error('Supabase session init error:', e);
    }
  }

  // Hydrate strictly public non-sensitive tables from Supabase (no private members/phones)
  private async hydratePublicFromSupabase() {
    if (!supabase) return;
    try {
      const [noticesRes, committeesRes, publicPosRes] = await Promise.all([
        supabase.from('notices').select('*').order('publish_date', { ascending: false }),
        supabase.from('committees').select('*').order('start_year', { ascending: false }),
        supabase.from('public_committee_members').select('*').order('priority', { ascending: true }),
      ]);

      if (!noticesRes.error && noticesRes.data) {
        this.notices = noticesRes.data.map((n: Record<string, unknown>) => ({
          id: String(n.id),
          title: String(n.title),
          category: (n.category as Notice['category']) || 'general',
          content: String(n.content),
          publishDate: String(n.publish_date || '').substring(0, 10),
          isPinned: Boolean(n.is_pinned),
          author: String(n.author || ''),
          attachmentUrl: n.attachment_url ? String(n.attachment_url) : undefined,
        }));
        this.save('notices', this.notices);
      }

      if (!committeesRes.error && committeesRes.data) {
        const positions = (publicPosRes.data || []) as Record<string, unknown>[];
        this.committees = committeesRes.data.map((c: Record<string, unknown>) => ({
          id: String(c.id),
          title: String(c.title),
          wing: (c.wing as CommitteeTerm['wing']) || 'central',
          startYear: Number(c.start_year),
          endYear: Number(c.end_year),
          isCurrent: Boolean(c.is_current),
          positions: positions
            .filter((p) => String(p.committee_id) === String(c.id))
            .map((p) => ({
              id: String(p.id),
              title: String(p.position_title),
              memberNameBn: String(p.member_name_bn),
              memberNameEn: p.member_name_en ? String(p.member_name_en) : undefined,
              photoUrl: p.photo_url ? String(p.photo_url) : undefined,
              priority: Number(p.priority),
              isPublished: true,
            })),
        }));
        this.save('committees', this.committees);
      }
      this.notify();
    } catch {
      // keep local cache if network unavailable
    }
  }

  public async syncSupabaseProfile(userId: string, email: string): Promise<{ success: boolean; error?: string }> {
    if (!supabase) return { success: false, error: 'Supabase সংযুক্ত নয়।' };
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return {
        success: false,
        error: 'আপনার প্রোফাইল পাওয়া যায়নি। দয়া করে schema.sql চালানো হয়েছে কি না নিশ্চিত করুন।',
      };
    }

    if (profile.status !== 'active') {
      await supabase.auth.signOut();
      this.clearAuthSessionState();
      return {
        success: false,
        error: 'আপনার অ্যাকাউন্টটি এখনো সুপার অ্যাডমিনের অনুমোদনের অপেক্ষায় রয়েছে (Pending Approval)।',
      };
    }

    this.isAuthenticated = true;
    this.authenticatedRole = profile.role as Role;
    this.authenticatedEmail = profile.email || email;
    this.currentRole = profile.role as Role;
    this.currentUser = {
      id: profile.id,
      name: profile.full_name,
      email: profile.email || email,
      role: profile.role as Role,
    };

    await this.hydrateAdminDataFromSupabase();
    this.notify();
    return { success: true };
  }

  private async hydrateAdminDataFromSupabase() {
    if (!supabase || !this.isAuthenticated) return;
    try {
      const [fundsRes, accRes, txnRes, corrRes, memRes, aidRes] = await Promise.all([
        supabase.from('funds').select('*'),
        supabase.from('accounts').select('*'),
        supabase.from('transactions').select('*').order('created_at', { ascending: false }),
        supabase.from('financial_corrections').select('*').order('created_at', { ascending: false }),
        supabase.from('members').select('*').order('created_at', { ascending: false }),
        supabase.from('aid_applications').select('*').order('created_at', { ascending: false }),
      ]);

      if (!fundsRes.error && fundsRes.data && fundsRes.data.length > 0) {
        this.funds = fundsRes.data.map((f: Record<string, unknown>) => ({
          id: String(f.id),
          name: String(f.name),
          code: String(f.code),
          description: String(f.description || ''),
          currentBalance: roundBDT(Number(f.current_balance || 0)),
          isActive: Boolean(f.is_active),
          isDefault: Boolean(f.is_default),
        }));
        this.save('funds', this.funds);
      }

      if (!accRes.error && accRes.data && accRes.data.length > 0) {
        this.accounts = accRes.data.map((a: Record<string, unknown>) => ({
          id: String(a.id),
          name: String(a.name),
          type: (a.type as FinancialAccount['type']) || 'bank',
          accountNumber: a.account_number ? String(a.account_number) : undefined,
          currentBalance: roundBDT(Number(a.current_balance || 0)),
          isActive: Boolean(a.is_active),
        }));
        this.save('accounts', this.accounts);
      }

      if (!txnRes.error && txnRes.data) {
        this.transactions = txnRes.data.map((t: Record<string, unknown>) => ({
          id: String(t.id),
          transactionCode: String(t.transaction_code),
          voucherNo: String(t.voucher_no),
          type: t.type as TransactionType,
          fundId: String(t.fund_id),
          toFundId: t.to_fund_id ? String(t.to_fund_id) : undefined,
          accountId: String(t.account_id),
          toAccountId: t.to_account_id ? String(t.to_account_id) : undefined,
          amount: roundBDT(Number(t.amount)),
          category: String(t.category),
          donorOrPayee: String(t.donor_or_payee),
          description: String(t.description),
          receiptUrl: t.receipt_url ? String(t.receipt_url) : undefined,
          status: t.status as FinancialTransaction['status'],
          createdByRole: 'finance_secretary',
          createdByName: String(t.created_by || 'কর্মকর্তা'),
          createdAt: String(t.created_at || '').replace('T', ' ').substring(0, 19),
          approvedBy: t.approved_by ? String(t.approved_by) : undefined,
          approvedAt: t.approved_at ? String(t.approved_at).replace('T', ' ').substring(0, 19) : undefined,
          rejectionReason: t.rejection_reason ? String(t.rejection_reason) : undefined,
        }));
        this.save('transactions', this.transactions);
      }

      if (!corrRes.error && corrRes.data) {
        this.corrections = corrRes.data.map((c: Record<string, unknown>) => ({
          id: String(c.id),
          correctionCode: String(c.correction_code),
          originalTransactionId: String(c.original_transaction_id),
          previousAmount: roundBDT(Number(c.previous_amount)),
          correctedAmount: roundBDT(Number(c.corrected_amount)),
          previousCategory: String(c.previous_category),
          correctedCategory: String(c.corrected_category),
          previousFundId: String(c.previous_fund_id),
          correctedFundId: String(c.corrected_fund_id),
          previousAccountId: String(c.previous_account_id),
          correctedAccountId: String(c.corrected_account_id),
          originalSnapshot: (c.original_snapshot as Partial<FinancialTransaction>) || {},
          correctedSnapshot: (c.corrected_snapshot as Partial<FinancialTransaction>) || {},
          correctionReason: String(c.correction_reason),
          correctedById: c.corrected_by ? String(c.corrected_by) : undefined,
          correctedByRole: 'finance_secretary',
          correctedByName: String(c.corrected_by || 'কর্মকর্তা'),
          createdAt: String(c.created_at || '').replace('T', ' ').substring(0, 19),
          requiresDualApproval: Boolean(c.requires_dual_approval),
          approvalStatus: c.approval_status as FinancialCorrection['approvalStatus'],
          approvedBy: c.approved_by ? String(c.approved_by) : undefined,
          approvedAt: c.approved_at ? String(c.approved_at).replace('T', ' ').substring(0, 19) : undefined,
          approvalNote: c.approval_note ? String(c.approval_note) : undefined,
        }));
        this.save('corrections', this.corrections);
      }

      if (!memRes.error && memRes.data) {
        this.members = memRes.data.map((m: Record<string, unknown>) => ({
          id: String(m.id),
          membershipId: String(m.membership_id),
          type: (m.type as Member['type']) || 'general',
          fullNameBn: String(m.full_name_bn),
          fullNameEn: String(m.full_name_en),
          phone: String(m.phone),
          email: String(m.email || ''),
          bloodGroup: String(m.blood_group || ''),
          patgramAddress: {
            village: String(m.patgram_village || ''),
            union: String(m.patgram_union || ''),
            ward: m.patgram_ward ? String(m.patgram_ward) : undefined,
          },
          rangpurAddress: {
            area: String(m.rangpur_area || ''),
            thana: String(m.rangpur_thana || ''),
          },
          professionOrDesignation: m.profession ? String(m.profession) : undefined,
          institution: m.institution ? String(m.institution) : undefined,
          department: m.department ? String(m.department) : undefined,
          academicYear: m.academic_year ? String(m.academic_year) : undefined,
          photoUrl: m.photo_url ? String(m.photo_url) : undefined,
          status: m.status as MemberStatus,
          joinedDate: String(m.joined_date || ''),
          notes: m.notes ? String(m.notes) : undefined,
        }));
        this.save('members', this.members);
      }

      if (!aidRes.error && aidRes.data) {
        this.aidApplications = aidRes.data.map((a: Record<string, unknown>) => ({
          id: String(a.id),
          applicantName: String(a.applicant_name),
          phone: String(a.phone),
          email: a.email ? String(a.email) : undefined,
          type: a.type as AidApplication['type'],
          patgramAddress: String(a.patgram_address),
          currentAddress: String(a.current_address),
          requestedAmount: roundBDT(Number(a.requested_amount)),
          reason: String(a.reason),
          status: a.status as AidApplication['status'],
          submittedAt: String(a.created_at || '').replace('T', ' ').substring(0, 19),
          reviewedBy: a.reviewed_by ? String(a.reviewed_by) : undefined,
          allocatedFundId: a.allocated_fund_id ? String(a.allocated_fund_id) : undefined,
        }));
        this.save('aidApplications', this.aidApplications);
      }
    } catch {
      // safe fallback
    }
  }

  public hasAnySuperAdminLocal(): boolean {
    return this.adminAccounts.some((a) => a.role === 'super_admin' && a.status === 'active');
  }

  public async registerAdminLocal(params: {
    fullName: string;
    email: string;
    phone?: string;
    password: string;
    requestedRole?: Role;
  }): Promise<{ success: boolean; error?: string; isFirstSuperAdmin?: boolean; pendingApproval?: boolean }> {
    const normalizedEmail = params.email.trim().toLowerCase();
    if (!normalizedEmail || !params.fullName.trim() || params.password.length < 6) {
      return { success: false, error: 'নাম, বৈধ ইমেইল/ইউজার আইডি এবং কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।' };
    }

    if (this.adminAccounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
      return { success: false, error: 'এই ইমেইল / ইউজার আইডি দিয়ে ইতোমধ্যেই একটি অ্যাকাউন্ট নিবন্ধিত রয়েছে।' };
    }

    const isFirst = !this.hasAnySuperAdminLocal();
    const salt = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const passwordHash = await hashPassword(params.password, salt);

    const assignedRole: Role = isFirst
      ? 'super_admin'
      : params.requestedRole && params.requestedRole !== 'super_admin'
        ? params.requestedRole
        : 'general_admin';
    const assignedStatus: AdminUserAccount['status'] = isFirst ? 'active' : 'pending_approval';

    const newAccount: AdminUserAccount = {
      id: `admin-${Date.now()}`,
      email: normalizedEmail,
      fullName: params.fullName.trim(),
      phone: params.phone?.trim(),
      role: assignedRole,
      status: assignedStatus,
      passwordHash,
      salt,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };

    this.adminAccounts = [...this.adminAccounts, newAccount];
    this.save('adminAccounts', this.adminAccounts);

    if (isFirst) {
      this.isAuthenticated = true;
      this.authenticatedRole = 'super_admin';
      this.authenticatedEmail = newAccount.email;
      this.currentRole = 'super_admin';
      this.currentUser = {
        id: newAccount.id,
        name: newAccount.fullName,
        email: newAccount.email,
        role: 'super_admin',
      };
      this.save('authSession', {
        id: newAccount.id,
        email: newAccount.email,
        name: newAccount.fullName,
        role: 'super_admin',
      });
      this.logAudit(
        'REGISTER_SUPER_ADMIN',
        'user',
        newAccount.id,
        `প্রথম সুপার অ্যাডমিন অ্যাকাউন্ট "${newAccount.fullName}" (${newAccount.email}) নিবন্ধিত ও সক্রিয় হয়েছে।`
      );
      this.notify();
      return { success: true, isFirstSuperAdmin: true };
    } else {
      this.logAudit(
        'REGISTER_OFFICER_PENDING',
        'user',
        newAccount.id,
        `নতুন কর্মকর্তা "${newAccount.fullName}" (${newAccount.email}) নিবন্ধন করেছেন (সুপার অ্যাডমিনের অনুমোদনের অপেক্ষায়)।`
      );
      this.notify();
      return { success: true, pendingApproval: true };
    }
  }

  public async loginAdminLocal(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const normalizedEmail = email.trim().toLowerCase();
    const account = this.adminAccounts.find((a) => a.email.toLowerCase() === normalizedEmail);
    if (!account) {
      return { success: false, error: 'এই ইমেইল / ইউজার আইডি দিয়ে কোনো নিবন্ধিত অ্যাডমিন অ্যাকাউন্ট পাওয়া যায়নি।' };
    }

    if (account.status === 'pending_approval') {
      return { success: false, error: 'আপনার অ্যাকাউন্টটি এখনো সুপার অ্যাডমিনের অনুমোদনের অপেক্ষায় রয়েছে।' };
    }
    if (account.status === 'suspended') {
      return { success: false, error: 'আপনার অ্যাকাউন্টটি স্থগিত করা হয়েছে। সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।' };
    }

    const computedHash = await hashPassword(password, account.salt || '');
    if (computedHash !== account.passwordHash) {
      return { success: false, error: 'পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে আবার চেষ্টা করুন।' };
    }

    this.isAuthenticated = true;
    this.authenticatedRole = account.role;
    this.authenticatedEmail = account.email;
    this.currentRole = account.role;
    this.currentUser = {
      id: account.id,
      name: account.fullName,
      email: account.email,
      role: account.role,
    };
    this.save('authSession', {
      id: account.id,
      email: account.email,
      name: account.fullName,
      role: account.role,
    });
    this.logAudit('ADMIN_LOGIN', 'user', account.id, `${account.fullName} (${account.role}) সফলভাবে লগইন করেছেন।`);
    this.notify();
    return { success: true };
  }

  public async createOfficerBySuperAdmin(params: {
    fullName: string;
    email: string;
    phone?: string;
    role: Role;
    password: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন নতুন কর্মকর্তা অ্যাকাউন্ট তৈরি করতে পারেন।' };
    }
    const normalizedEmail = params.email.trim().toLowerCase();
    if (!normalizedEmail || !params.fullName.trim() || params.password.length < 6) {
      return { success: false, error: 'সব তথ্য ও কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।' };
    }
    if (this.adminAccounts.some((a) => a.email.toLowerCase() === normalizedEmail)) {
      return { success: false, error: 'এই ইমেইল ইতোমধ্যে ব্যবহৃত হয়েছে।' };
    }

    const salt = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const passwordHash = await hashPassword(params.password, salt);

    const newAccount: AdminUserAccount = {
      id: `admin-${Date.now()}`,
      email: normalizedEmail,
      fullName: params.fullName.trim(),
      phone: params.phone?.trim(),
      role: params.role,
      status: 'active',
      passwordHash,
      salt,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    this.adminAccounts = [...this.adminAccounts, newAccount];
    this.save('adminAccounts', this.adminAccounts);
    this.logAudit(
      'CREATE_OFFICER_ACCOUNT',
      'user',
      newAccount.id,
      `সুপার অ্যাডমিন "${newAccount.fullName}"-কে "${newAccount.role}" ভূমিকায় সক্রিয় অ্যাকাউন্ট তৈরি করে দিয়েছেন।`
    );
    this.notify();
    return { success: true };
  }

  public updateAdminAccount(
    accountId: string,
    updates: { role?: Role; status?: AdminUserAccount['status'] }
  ): { success: boolean; error?: string } {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন অ্যাকাউন্ট পরিবর্তন করতে পারেন।' };
    }
    this.adminAccounts = this.adminAccounts.map((acc) =>
      acc.id === accountId ? { ...acc, ...updates } : acc
    );
    this.save('adminAccounts', this.adminAccounts);
    this.logAudit(
      'UPDATE_ADMIN_ACCOUNT',
      'user',
      accountId,
      `কর্মকর্তা অ্যাকাউন্ট আপডেট করা হয়েছে: ${JSON.stringify(updates)}`
    );
    this.notify();
    return { success: true };
  }

  public async logout() {
    if (this.isAuthenticated) {
      this.logAudit('ADMIN_LOGOUT', 'user', this.currentUser.id, `${this.currentUser.name} লগআউট করেছেন।`);
    }
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    this.clearAuthSessionState();
  }

  private clearAuthSessionState() {
    this.isAuthenticated = false;
    this.authenticatedRole = 'general_admin';
    this.authenticatedEmail = '';
    this.currentRole = 'general_admin';
    this.currentUser = {
      id: 'guest',
      name: 'অতিথি ব্যবহারকারী',
      email: '',
      role: 'general_admin',
    };
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_PREFIX + 'authSession');
      }
    } catch {
      // ignore
    }
    this.notify();
  }

  private load<T>(key: string, defaultValue: T): T {
    try {
      if (typeof localStorage === 'undefined') return defaultValue;
      const saved = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      return saved ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private save<T>(key: string, value: T) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      console.error(`Failed to persist ${key}:`, e);
    }
  }

  public subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  // --- Audit Logger ---
  public logAudit(
    action: string,
    entityType: string,
    entityId: string,
    description: string,
    metadata?: Record<string, unknown>
  ) {
    const lastLog = this.auditLogs[this.auditLogs.length - 1];
    const prevHash = lastLog ? lastLog.currentHash : 'GENESIS_2009';
    const payload = `${prevHash}|${action}|${entityType}|${entityId}|${Date.now()}`;
    const newHash = generateHash(payload);

    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      actorRole: this.currentUser.role,
      actorName: this.currentUser.name,
      action,
      entityType,
      entityId,
      description,
      metadata,
      previousHash: prevHash,
      currentHash: newHash,
    };

    this.auditLogs = [...this.auditLogs, newLog];
    this.save('auditLogs', this.auditLogs);
    this.notify();
  }

  // --- Switch Active Role Preview (Only allowed for verified Super Admin) ---
  public switchRole(role: Role) {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') return;
    this.currentRole = role;
    const names: Record<Role, string> = {
      super_admin: this.currentUser.email ? `${this.currentUser.name}` : 'সুপার অ্যাডমিন (মাস্টার কন্ট্রোল)',
      finance_secretary: 'অর্থ সম্পাদক (প্রিভিউ মোড)',
      president: 'সভাপতি (প্রিভিউ মোড)',
      general_secretary: 'সাধারণ সম্পাদক (প্রিভিউ মোড)',
      general_admin: 'সাধারণ সদস্য অ্যাডমিন (প্রিভিউ মোড)',
      student_admin: 'ছাত্র সংগঠন অ্যাডমিন (প্রিভিউ মোড)',
    };
    this.currentUser = {
      ...this.currentUser,
      role,
      name:
        role === 'super_admin'
          ? this.adminAccounts.find((a) => a.email === this.authenticatedEmail)?.fullName || 'সুপার অ্যাডমিন'
          : names[role],
    };
    this.logAudit('SWITCH_ROLE_PREVIEW', 'user', role, `সুপার অ্যাডমিন "${role}" রোল প্রিভিউ মোডে প্রবেশ করেছেন।`);
    this.notify();
  }

  // --- FINANCIAL ENGINE & DUAL-BALANCE CONTROL ---

  public isVoucherDuplicate(voucherNo: string, excludeId?: string): boolean {
    return this.transactions.some(
      (t) => t.voucherNo.trim().toLowerCase() === voucherNo.trim().toLowerCase() && t.id !== excludeId
    );
  }

  public addTransaction(params: {
    voucherNo: string;
    type: TransactionType;
    fundId: string;
    toFundId?: string;
    accountId: string;
    toAccountId?: string;
    amount: number;
    category: string;
    donorOrPayee: string;
    description: string;
    receiptUrl?: string;
    autoApprove?: boolean;
  }): { success: boolean; error?: string; transaction?: FinancialTransaction } {
    if (!this.isAuthenticated || !this.rolePermissions[this.currentUser.role]?.can_entry_finance) {
      return { success: false, error: 'আপনার আর্থিক লেনদেন এন্ট্রি করার অনুমতি নেই।' };
    }
    if (this.isLocked) {
      return { success: false, error: 'অন্য একটি লেনদেন প্রক্রিয়াকরণ হচ্ছে, অনুগ্রহ করে পুনরায় চেষ্টা করুন।' };
    }
    this.isLocked = true;

    try {
      const {
        voucherNo,
        type,
        fundId,
        toFundId,
        accountId,
        toAccountId,
        amount,
        category,
        donorOrPayee,
        description,
        receiptUrl,
        autoApprove = false,
      } = params;

      if (!voucherNo || !voucherNo.trim()) {
        return { success: false, error: 'ভাউচার নম্বর দেওয়া বাধ্যতামূলক।' };
      }
      if (this.isVoucherDuplicate(voucherNo)) {
        return { success: false, error: `ভাউচার নম্বর "${voucherNo}" ইতোমধ্যে বিদ্যমান। নতুন ভাউচার নম্বর দিন।` };
      }
      if (!Number.isFinite(amount)) {
        return { success: false, error: 'অবৈধ সংখ্যা দেওয়া হয়েছে।' };
      }
      const cleanAmount = roundBDT(amount);
      if (cleanAmount <= 0) {
        return { success: false, error: 'লেনদেনের পরিমাণ অবশ্যই শূন্যের চেয়ে বেশি হতে হবে।' };
      }
      if (!category || !category.trim()) {
        return { success: false, error: 'লেনদেনের খাত/ক্যাটাগরি দেওয়া বাধ্যতামূলক।' };
      }

      const sourceFund = this.funds.find((f) => f.id === fundId && f.isActive);
      const sourceAccount = this.accounts.find((a) => a.id === accountId && a.isActive);

      if (!sourceFund) return { success: false, error: 'নির্বাচিত সক্রিয় তহবিল খুঁজে পাওয়া যায়নি।' };
      if (!sourceAccount) return { success: false, error: 'নির্বাচিত সক্রিয় পেমেন্ট অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।' };

      if (type === 'expense' || type === 'fund_transfer') {
        if (sourceFund.currentBalance < cleanAmount) {
          return {
            success: false,
            error: `তহবিলে অপর্যাপ্ত ব্যালেন্স: "${sourceFund.name}" তহবিলে বর্তমান ব্যালেন্স ৳${sourceFund.currentBalance.toLocaleString()} কিন্তু আপনি ৳${cleanAmount.toLocaleString()} খরচ/স্থানান্তর করতে চাচ্ছেন।`,
          };
        }
        if (sourceAccount.currentBalance < cleanAmount) {
          return {
            success: false,
            error: `অ্যাকাউন্টে অপর্যাপ্ত ব্যালেন্স: "${sourceAccount.name}" অ্যাকাউন্টে বর্তমান ব্যালেন্স ৳${sourceAccount.currentBalance.toLocaleString()} কিন্তু আপনি ৳${cleanAmount.toLocaleString()} দাবি করছেন।`,
          };
        }
      }

      if (type === 'fund_transfer') {
        if (!toFundId || !toAccountId) {
          return { success: false, error: 'ফান্ড স্থানান্তরের জন্য গন্তব্য তহবিল ও গন্তব্য অ্যাকাউন্ট উভয়ই নির্বাচন করুন।' };
        }
        const destFund = this.funds.find((f) => f.id === toFundId && f.isActive);
        const destAccount = this.accounts.find((a) => a.id === toAccountId && a.isActive);
        if (!destFund) return { success: false, error: 'নির্বাচিত গন্তব্য তহবিল খুঁজে পাওয়া যায়নি।' };
        if (!destAccount) return { success: false, error: 'নির্বাচিত গন্তব্য পেমেন্ট অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।' };
        if (fundId === toFundId && accountId === toAccountId) {
          return { success: false, error: 'উৎস ও গন্তব্য একই হতে পারে না।' };
        }
      }

      const txnCode = `TXN-${new Date().getFullYear()}-${(this.transactions.length + 1).toString().padStart(4, '0')}`;
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const canApprove = Boolean(autoApprove && this.rolePermissions[this.currentUser.role]?.can_approve_finance);

      const newTxn: FinancialTransaction = {
        id: `txn-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        transactionCode: txnCode,
        voucherNo: voucherNo.trim(),
        type,
        fundId,
        toFundId: type === 'fund_transfer' ? toFundId : undefined,
        accountId,
        toAccountId: type === 'fund_transfer' ? toAccountId : undefined,
        amount: cleanAmount,
        category: category.trim(),
        donorOrPayee: donorOrPayee.trim() || 'পাটগ্রাম কল্যাণ সমিতি',
        description: description.trim(),
        receiptUrl,
        status: canApprove ? 'approved' : 'pending_approval',
        createdByRole: this.currentUser.role,
        createdByName: this.currentUser.name,
        createdAt: nowStr,
        approvedBy: canApprove ? this.currentUser.name : undefined,
        approvedAt: canApprove ? nowStr : undefined,
      };

      this.transactions = [newTxn, ...this.transactions];
      this.save('transactions', this.transactions);

      if (canApprove) {
        this.applyBalanceChange(newTxn);
      }

      this.logAudit(
        'CREATE_TRANSACTION',
        'transaction',
        newTxn.id,
        `নতুন আর্থিক এন্ট্রি ${newTxn.transactionCode} (${newTxn.voucherNo}): ৳${cleanAmount.toLocaleString()} [${type === 'income' ? 'আয়' : type === 'expense' ? 'ব্যয়' : 'স্থানান্তর'}] তৈরি হয়েছে (${newTxn.status})।`
      );

      this.notify();
      return { success: true, transaction: newTxn };
    } finally {
      this.isLocked = false;
    }
  }

  public approveTransaction(txnId: string): { success: boolean; error?: string } {
    if (!this.isAuthenticated || !this.rolePermissions[this.currentUser.role]?.can_approve_finance) {
      return { success: false, error: 'আপনার আর্থিক লেনদেন চূড়ান্ত অনুমোদন করার অনুমতি নেই।' };
    }
    if (this.isLocked) {
      return { success: false, error: 'অন্য একটি লেনদেন প্রক্রিয়াকরণ হচ্ছে, অনুগ্রহ করে পুনরায় চেষ্টা করুন।' };
    }
    this.isLocked = true;

    try {
      const txn = this.transactions.find((t) => t.id === txnId);
      if (!txn) return { success: false, error: 'লেনদেন খুঁজে পাওয়া যায়নি।' };
      if (txn.status !== 'pending_approval') {
        return { success: false, error: 'লেনদেনটি অনুমোদনের অপেক্ষায় নেই।' };
      }

      if (txn.type === 'expense' || txn.type === 'fund_transfer') {
        const fund = this.funds.find((f) => f.id === txn.fundId && f.isActive);
        const acc = this.accounts.find((a) => a.id === txn.accountId && a.isActive);
        if (!fund || fund.currentBalance < txn.amount) {
          return { success: false, error: 'অনুমোদনের মুহূর্তে তহবিলে পর্যাপ্ত ব্যালেন্স পাওয়া যায়নি।' };
        }
        if (!acc || acc.currentBalance < txn.amount) {
          return { success: false, error: 'অনুমোদনের মুহূর্তে অ্যাকাউন্টে পর্যাপ্ত ব্যালেন্স পাওয়া যায়নি।' };
        }
      }

      if (txn.type === 'fund_transfer') {
        const destFund = this.funds.find((f) => f.id === txn.toFundId && f.isActive);
        const destAcc = this.accounts.find((a) => a.id === txn.toAccountId && a.isActive);
        if (!destFund || !destAcc) {
          return { success: false, error: 'গন্তব্য তহবিল বা অ্যাকাউন্ট সক্রিয় পাওয়া যায়নি।' };
        }
      }

      const approvedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
      const updatedTxn: FinancialTransaction = {
        ...txn,
        status: 'approved',
        approvedBy: this.currentUser.name,
        approvedAt,
      };

      this.transactions = this.transactions.map((t) => (t.id === txnId ? updatedTxn : t));
      this.applyBalanceChange(updatedTxn);
      this.save('transactions', this.transactions);

      this.logAudit(
        'APPROVE_TRANSACTION',
        'transaction',
        txn.id,
        `আর্থিক এন্ট্রি ${txn.transactionCode} ৳${txn.amount.toLocaleString()} চূড়ান্ত অনুমোদিত হয়েছে।`
      );

      this.notify();
      return { success: true };
    } finally {
      this.isLocked = false;
    }
  }

  public rejectTransaction(txnId: string, reason: string): { success: boolean; error?: string } {
    if (!this.isAuthenticated || !this.rolePermissions[this.currentUser.role]?.can_approve_finance) {
      return { success: false, error: 'আপনার এই লেনদেন বাতিল করার অনুমতি নেই।' };
    }
    if (!reason || reason.trim().length < 3) {
      return { success: false, error: 'লেনদেন বাতিলের কারণ কমপক্ষে ৩ অক্ষরে উল্লেখ করুন।' };
    }
    if (this.isLocked) {
      return { success: false, error: 'অন্য একটি লেনদেন প্রক্রিয়াকরণ হচ্ছে।' };
    }
    this.isLocked = true;

    try {
      const txn = this.transactions.find((t) => t.id === txnId);
      if (!txn) return { success: false, error: 'লেনদেন খুঁজে পাওয়া যায়নি।' };
      if (txn.status !== 'pending_approval') {
        return { success: false, error: 'শুধুমাত্র অপেক্ষমাণ লেনদেন বাতিল করা যায়।' };
      }

      const rejectedTxn: FinancialTransaction = {
        ...txn,
        status: 'rejected',
        rejectionReason: reason.trim(),
      };
      this.transactions = this.transactions.map((t) => (t.id === txnId ? rejectedTxn : t));

      this.save('transactions', this.transactions);
      this.logAudit('REJECT_TRANSACTION', 'transaction', txn.id, `আর্থিক এন্ট্রি ${txn.transactionCode} বাতিল করা হয়েছে। কারণ: ${reason.trim()}`);
      this.notify();
      return { success: true };
    } finally {
      this.isLocked = false;
    }
  }

  // Compute simulated balance deltas on funds & accounts without mutating state
  private computeBalanceDelta(
    txn: FinancialTransaction,
    isReversal: boolean,
    fundBalances: Map<string, number>,
    accountBalances: Map<string, number>
  ) {
    const factor = isReversal ? -1 : 1;
    const delta = roundBDT(txn.amount * factor);

    if (txn.type === 'income') {
      fundBalances.set(txn.fundId, roundBDT((fundBalances.get(txn.fundId) || 0) + delta));
      accountBalances.set(txn.accountId, roundBDT((accountBalances.get(txn.accountId) || 0) + delta));
    } else if (txn.type === 'expense') {
      fundBalances.set(txn.fundId, roundBDT((fundBalances.get(txn.fundId) || 0) - delta));
      accountBalances.set(txn.accountId, roundBDT((accountBalances.get(txn.accountId) || 0) - delta));
    } else if (txn.type === 'fund_transfer' && txn.toFundId && txn.toAccountId) {
      fundBalances.set(txn.fundId, roundBDT((fundBalances.get(txn.fundId) || 0) - delta));
      fundBalances.set(txn.toFundId, roundBDT((fundBalances.get(txn.toFundId) || 0) + delta));
      accountBalances.set(txn.accountId, roundBDT((accountBalances.get(txn.accountId) || 0) - delta));
      accountBalances.set(txn.toAccountId, roundBDT((accountBalances.get(txn.toAccountId) || 0) + delta));
    }
  }

  // Prevent overdraft or negative fund/account balances caused by reversing/correcting a transaction
  private wouldCorrectionCauseNegativeBalance(
    originalTxn: FinancialTransaction,
    updatedTxn: FinancialTransaction
  ): { ok: boolean; error?: string } {
    const fundBalances = new Map(this.funds.map((f) => [f.id, f.currentBalance]));
    const accountBalances = new Map(this.accounts.map((a) => [a.id, a.currentBalance]));

    this.computeBalanceDelta(originalTxn, true, fundBalances, accountBalances);
    this.computeBalanceDelta(updatedTxn, false, fundBalances, accountBalances);

    for (const [fId, bal] of fundBalances.entries()) {
      if (bal < 0) {
        const fundName = this.funds.find((f) => f.id === fId)?.name || fId;
        return {
          ok: false,
          error: `সংশোধন প্রত্যাখ্যান: এটি কার্যকর করলে "${fundName}" তহবিলের ব্যালেন্স ঋণাত্মক (৳${bal.toLocaleString()}) হয়ে যাবে। আগে সমন্বয় লেনদেন সম্পন্ন করুন।`,
        };
      }
    }

    for (const [aId, bal] of accountBalances.entries()) {
      if (bal < 0) {
        const accName = this.accounts.find((a) => a.id === aId)?.name || aId;
        return {
          ok: false,
          error: `সংশোধন প্রত্যাখ্যান: এটি কার্যকর করলে "${accName}" অ্যাকাউন্টের ব্যালেন্স ঋণাত্মক (৳${bal.toLocaleString()}) হয়ে যাবে।`,
        };
      }
    }

    return { ok: true };
  }

  private applyBalanceChange(txn: FinancialTransaction, isReversal = false) {
    const fundBalances = new Map(this.funds.map((f) => [f.id, f.currentBalance]));
    const accountBalances = new Map(this.accounts.map((a) => [a.id, a.currentBalance]));

    this.computeBalanceDelta(txn, isReversal, fundBalances, accountBalances);

    this.funds = this.funds.map((f) => ({
      ...f,
      currentBalance: fundBalances.get(f.id) ?? f.currentBalance,
    }));
    this.accounts = this.accounts.map((a) => ({
      ...a,
      currentBalance: accountBalances.get(a.id) ?? a.currentBalance,
    }));

    this.save('funds', this.funds);
    this.save('accounts', this.accounts);
  }

  // --- FINANCIAL CORRECTION WORKFLOW ---
  // Decision 1.খ: Delta = ABS(correctedAmount - previousAmount) > 30,000 BDT triggers dual-approval
  // Decision 2.ক: Super Admin can directly execute corrections with mandatory reason
  public requestCorrection(params: {
    originalTransactionId: string;
    correctedAmount: number;
    correctedCategory: string;
    correctedFundId: string;
    correctedAccountId: string;
    correctedToFundId?: string;
    correctedToAccountId?: string;
    correctedDonorOrPayee: string;
    correctedDescription: string;
    correctionReason: string;
  }): { success: boolean; error?: string; correction?: FinancialCorrection } {
    if (!this.isAuthenticated || !this.rolePermissions[this.currentUser.role]?.can_correct_finance) {
      return { success: false, error: 'আপনার আর্থিক সংশোধন প্রস্তাব করার অনুমতি নেই।' };
    }
    if (this.isLocked) {
      return { success: false, error: 'অন্য একটি প্রক্রিয়া চলছে, অনুগ্রহ করে একটু পর চেষ্টা করুন।' };
    }
    this.isLocked = true;

    try {
      const {
        originalTransactionId,
        correctedAmount,
        correctedCategory,
        correctedFundId,
        correctedAccountId,
        correctedToFundId,
        correctedToAccountId,
        correctedDonorOrPayee,
        correctedDescription,
        correctionReason,
      } = params;

      if (!correctionReason || correctionReason.trim().length < 5) {
        return { success: false, error: 'আর্থিক সংশোধনের বিস্তারিত ও সুনির্দিষ্ট কারণ লেখা বাধ্যতামূলক (কমপক্ষে ৫ অক্ষর)।' };
      }
      if (!Number.isFinite(correctedAmount)) {
        return { success: false, error: 'সংশোধিত পরিমাণ বৈধ সংখ্যা হতে হবে।' };
      }
      const cleanCorrectedAmount = roundBDT(correctedAmount);
      if (cleanCorrectedAmount <= 0) {
        return { success: false, error: 'সংশোধিত পরিমাণ অবশ্যই শূন্যের চেয়ে বেশি হতে হবে।' };
      }

      const originalTxn = this.transactions.find((t) => t.id === originalTransactionId);
      if (!originalTxn) return { success: false, error: 'মূল লেনদেন খুঁজে পাওয়া যায়নি।' };
      if (originalTxn.status !== 'approved' && originalTxn.status !== 'corrected') {
        return { success: false, error: 'শুধুমাত্র অনুমোদিত লেনদেনের সংশোধন প্রস্তাব করা যায়।' };
      }

      const alreadyPending = this.corrections.some(
        (c) => c.originalTransactionId === originalTransactionId && c.approvalStatus === 'pending_approval'
      );
      if (alreadyPending) {
        return {
          success: false,
          error: 'এই লেনদেনের বিপরীতে ইতোমধ্যে একটি সংশোধনী অনুমোদনের অপেক্ষায় রয়েছে। সেটি নিষ্পত্তি না হওয়া পর্যন্ত নতুন প্রস্তাব করা যাবে না।',
        };
      }

      if (!this.funds.some((f) => f.id === correctedFundId)) {
        return { success: false, error: 'সংশোধিত তহবিল খুঁজে পাওয়া যায়নি।' };
      }
      if (!this.accounts.some((a) => a.id === correctedAccountId)) {
        return { success: false, error: 'সংশোধিত পেমেন্ট অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।' };
      }

      const resolvedToFundId = originalTxn.type === 'fund_transfer' ? (correctedToFundId || originalTxn.toFundId) : undefined;
      const resolvedToAccountId = originalTxn.type === 'fund_transfer' ? (correctedToAccountId || originalTxn.toAccountId) : undefined;

      const updatedTxnCandidate: FinancialTransaction = {
        ...originalTxn,
        amount: cleanCorrectedAmount,
        category: correctedCategory.trim() || originalTxn.category,
        fundId: correctedFundId,
        accountId: correctedAccountId,
        toFundId: resolvedToFundId,
        toAccountId: resolvedToAccountId,
        donorOrPayee: correctedDonorOrPayee.trim() || originalTxn.donorOrPayee,
        description: correctedDescription.trim(),
        status: 'corrected',
      };

      const simCheck = this.wouldCorrectionCauseNegativeBalance(originalTxn, updatedTxnCandidate);
      if (!simCheck.ok) {
        return { success: false, error: simCheck.error };
      }

      const threshold = this.settings.correctionThresholdAmount || 30000;
      const delta = roundBDT(Math.abs(cleanCorrectedAmount - originalTxn.amount));
      const isSuperAdmin = this.currentUser.role === 'super_admin' && this.authenticatedRole === 'super_admin';
      const requiresDualApproval = !isSuperAdmin && delta > threshold;

      const corrCode = `CORR-${new Date().getFullYear()}-${(this.corrections.length + 1).toString().padStart(4, '0')}`;
      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

      const originalSnapshot: Partial<FinancialTransaction> = { ...originalTxn };
      const correctedSnapshot: Partial<FinancialTransaction> = { ...updatedTxnCandidate };

      const isDirectlyApproved = isSuperAdmin || !requiresDualApproval;

      const newCorrection: FinancialCorrection = {
        id: `corr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        correctionCode: corrCode,
        originalTransactionId,
        previousAmount: originalTxn.amount,
        correctedAmount: cleanCorrectedAmount,
        previousCategory: originalTxn.category,
        correctedCategory: updatedTxnCandidate.category,
        previousFundId: originalTxn.fundId,
        correctedFundId,
        previousAccountId: originalTxn.accountId,
        correctedAccountId,
        originalSnapshot,
        correctedSnapshot,
        correctionReason: correctionReason.trim(),
        correctedById: this.currentUser.id,
        correctedByRole: this.currentUser.role,
        correctedByName: this.currentUser.name,
        createdAt: nowStr,
        requiresDualApproval,
        approvalStatus: isDirectlyApproved ? 'approved' : 'pending_approval',
        approvedBy: isDirectlyApproved ? this.currentUser.name : undefined,
        approvedAt: isDirectlyApproved ? nowStr : undefined,
      };

      this.corrections = [newCorrection, ...this.corrections];
      this.save('corrections', this.corrections);

      if (isDirectlyApproved) {
        this.applyBalanceChange(originalTxn, true);
        this.applyBalanceChange(updatedTxnCandidate, false);
        this.transactions = this.transactions.map((t) => (t.id === originalTxn.id ? updatedTxnCandidate : t));
        this.save('transactions', this.transactions);
      }

      this.logAudit(
        'REQUEST_CORRECTION',
        'correction',
        newCorrection.id,
        `আর্থিক সংশোধন ${newCorrection.correctionCode} মূল লেনদেন ${originalTxn.transactionCode}-এর বিপরীতে তৈরি হয়েছে। কারণ: "${correctionReason.trim()}" (অবস্থা: ${newCorrection.approvalStatus}, পার্থক্য: ৳${delta.toLocaleString()})।`
      );

      this.notify();
      return { success: true, correction: newCorrection };
    } finally {
      this.isLocked = false;
    }
  }

  public approveCorrection(corrId: string, note?: string): { success: boolean; error?: string } {
    if (
      !this.isAuthenticated ||
      (!this.rolePermissions[this.currentUser.role]?.can_approve_finance &&
        !(this.currentUser.role === 'super_admin' && this.authenticatedRole === 'super_admin'))
    ) {
      return { success: false, error: 'আপনার আর্থিক সংশোধন অনুমোদনের অনুমতি নেই।' };
    }
    if (this.isLocked) {
      return { success: false, error: 'অন্য একটি প্রক্রিয়া চলছে, অনুগ্রহ করে একটু পর চেষ্টা করুন।' };
    }
    this.isLocked = true;

    try {
      const corr = this.corrections.find((c) => c.id === corrId);
      if (!corr) return { success: false, error: 'সংশোধনী রেকর্ড খুঁজে পাওয়া যায়নি।' };
      if (corr.approvalStatus !== 'pending_approval') {
        return { success: false, error: 'সংশোধনীটি অনুমোদনের অপেক্ষায় নেই।' };
      }

      const isMasterSuperAdmin = this.currentUser.role === 'super_admin' && this.authenticatedRole === 'super_admin';
      const isSameProposer =
        (corr.correctedById && corr.correctedById === this.currentUser.id) ||
        corr.correctedByName === this.currentUser.name;

      if (isSameProposer && !isMasterSuperAdmin) {
        return {
          success: false,
          error: 'যিনি সংশোধন প্রস্তাব করেছেন তিনি নিজে এটি অনুমোদন করতে পারবেন না; অন্য একজন দায়িত্বপ্রাপ্তের অনুমোদন প্রয়োজন।',
        };
      }

      const originalTxn = this.transactions.find((t) => t.id === corr.originalTransactionId);
      if (!originalTxn) return { success: false, error: 'মূল লেনদেন খুঁজে পাওয়া যায়নি।' };

      const updatedTxn: FinancialTransaction = {
        ...originalTxn,
        ...(corr.correctedSnapshot as FinancialTransaction),
        status: 'corrected',
      };

      const simCheck = this.wouldCorrectionCauseNegativeBalance(originalTxn, updatedTxn);
      if (!simCheck.ok) {
        return { success: false, error: simCheck.error };
      }

      const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

      this.applyBalanceChange(originalTxn, true);
      this.applyBalanceChange(updatedTxn, false);

      const approvedCorr: FinancialCorrection = {
        ...corr,
        approvalStatus: 'approved',
        approvedBy: this.currentUser.name,
        approvedAt: nowStr,
        approvalNote: note,
      };

      this.corrections = this.corrections.map((c) => (c.id === corrId ? approvedCorr : c));
      this.transactions = this.transactions.map((t) => (t.id === originalTxn.id ? updatedTxn : t));
      this.save('transactions', this.transactions);
      this.save('corrections', this.corrections);

      this.logAudit(
        'APPROVE_CORRECTION',
        'correction',
        corr.id,
        `আর্থিক সংশোধন ${corr.correctionCode} (মূল ${originalTxn.transactionCode}) ৳${corr.previousAmount.toLocaleString()} -> ৳${corr.correctedAmount.toLocaleString()} অনুমোদিত হয়েছে। অনুমোদনকারী: ${this.currentUser.name}।`
      );

      this.notify();
      return { success: true };
    } finally {
      this.isLocked = false;
    }
  }

  // --- MEMBERSHIP MANAGEMENT ---
  public addMemberApplication(params: Omit<Member, 'id' | 'membershipId' | 'status' | 'joinedDate'>): {
    success: boolean;
    membershipId: string;
  } {
    const prefix = params.type === 'student' ? 'PKS-STU' : 'PKS-GEN';
    const year = new Date().getFullYear();
    const count = this.members.filter((m) => m.type === params.type).length + 1;
    const membershipId = `${prefix}-${year}-${count.toString().padStart(3, '0')}`;

    const newMember: Member = {
      ...params,
      id: `mem-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      membershipId,
      status: 'pending',
      joinedDate: new Date().toISOString().substring(0, 10),
    };

    this.members = [newMember, ...this.members];
    this.save('members', this.members);

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('members')
        .insert({
          membership_id: newMember.membershipId,
          type: newMember.type,
          full_name_bn: newMember.fullNameBn,
          full_name_en: newMember.fullNameEn,
          phone: newMember.phone,
          email: newMember.email || null,
          blood_group: newMember.bloodGroup,
          patgram_village: newMember.patgramAddress.village,
          patgram_union: newMember.patgramAddress.union,
          patgram_ward: newMember.patgramAddress.ward || null,
          rangpur_area: newMember.rangpurAddress.area,
          rangpur_thana: newMember.rangpurAddress.thana,
          profession: newMember.professionOrDesignation || null,
          institution: newMember.institution || null,
          department: newMember.department || null,
          academic_year: newMember.academicYear || null,
          status: 'pending',
        })
        .then(() => {
          // persisted cleanly
        });
    }

    this.logAudit(
      'APPLY_MEMBERSHIP',
      'member',
      newMember.id,
      `${newMember.fullNameBn} (${newMember.membershipId}) নতুন সদস্যপদের আবেদন জমা দিয়েছেন।`
    );

    this.notify();
    return { success: true, membershipId };
  }

  public updateMemberStatus(memberId: string, status: MemberStatus, notes?: string): { success: boolean; error?: string } {
    const perms = this.rolePermissions[this.currentUser.role];
    if (!this.isAuthenticated || (!perms?.can_manage_members && !perms?.can_manage_student_wing)) {
      return { success: false, error: 'সদস্যের অবস্থান পরিবর্তনের অনুমতি নেই।' };
    }
    this.members = this.members.map((m) => (m.id === memberId ? { ...m, status, notes: notes || m.notes } : m));
    this.save('members', this.members);

    const member = this.members.find((m) => m.id === memberId);
    this.logAudit(
      'UPDATE_MEMBER_STATUS',
      'member',
      memberId,
      `সদস্য ${member?.fullNameBn} (${member?.membershipId})-এর স্ট্যাটাস "${status}" করা হয়েছে।`
    );

    this.notify();
    return { success: true };
  }

  // --- COMMITTEES & POSITION TOGGLES ---
  public togglePositionVisibility(termId: string, positionId: string): boolean {
    if (!this.isAuthenticated || !this.rolePermissions[this.currentUser.role]?.can_manage_committees) {
      return false;
    }
    let updatedVal = false;
    this.committees = this.committees.map((term) => {
      if (term.id === termId) {
        return {
          ...term,
          positions: term.positions.map((pos) => {
            if (pos.id === positionId) {
              updatedVal = !pos.isPublished;
              return { ...pos, isPublished: updatedVal };
            }
            return pos;
          }),
        };
      }
      return term;
    });

    this.save('committees', this.committees);
    this.logAudit(
      'TOGGLE_COMMITTEE_VISIBILITY',
      'committee',
      positionId,
      `কমিটির পদবির পাবলিক প্রদর্শন স্ট্যাটাস "${updatedVal ? 'প্রকাশিত' : 'অপ্রকাশিত'}" করা হয়েছে।`
    );
    this.notify();
    return updatedVal;
  }

  public addCommitteePosition(termId: string, positionData: Omit<CommitteePosition, 'id'>): { success: boolean; error?: string } {
    if (!this.isAuthenticated || !this.rolePermissions[this.currentUser.role]?.can_manage_committees) {
      return { success: false, error: 'কমিটিতে পদবি যুক্ত করার অনুমতি নেই।' };
    }
    const newPos: CommitteePosition = {
      ...positionData,
      id: `pos-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };

    this.committees = this.committees.map((term) => {
      if (term.id === termId) {
        return {
          ...term,
          positions: [...term.positions, newPos].sort((a, b) => a.priority - b.priority),
        };
      }
      return term;
    });

    this.save('committees', this.committees);
    this.logAudit('ADD_POSITION', 'committee', newPos.id, `কমিটিতে নতুন পদ "${newPos.title}" যুক্ত হয়েছে।`);
    this.notify();
    return { success: true };
  }

  public addCommitteeTerm(termData: Omit<CommitteeTerm, 'id'>): { success: boolean; term?: CommitteeTerm; error?: string } {
    if (!this.isAuthenticated || !this.rolePermissions[this.currentUser.role]?.can_manage_committees) {
      return { success: false, error: 'নতুন কমিটি তৈরি করার অনুমতি নেই।' };
    }
    const newTerm: CommitteeTerm = {
      ...termData,
      id: `comm-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };

    if (newTerm.isCurrent) {
      this.committees = this.committees.map((t) => (t.wing === newTerm.wing ? { ...t, isCurrent: false } : t));
    }

    this.committees = [newTerm, ...this.committees];
    this.save('committees', this.committees);
    this.logAudit('CREATE_COMMITTEE', 'committee', newTerm.id, `নতুন কমিটি "${newTerm.title}" তৈরি হয়েছে (আগের কমিটি সংরক্ষিত)।`);
    this.notify();
    return { success: true, term: newTerm };
  }

  // --- AID APPLICATIONS ---
  public submitAidApplication(data: Omit<AidApplication, 'id' | 'status' | 'submittedAt'>): { success: boolean; error?: string } {
    if (!Number.isFinite(data.requestedAmount) || data.requestedAmount <= 0) {
      return { success: false, error: 'সাহায্যের সঠিক পরিমাণ উল্লেখ করুন।' };
    }
    const newAid: AidApplication = {
      ...data,
      requestedAmount: roundBDT(data.requestedAmount),
      id: `aid-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      status: 'submitted',
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    this.aidApplications = [newAid, ...this.aidApplications];
    this.save('aidApplications', this.aidApplications);

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('aid_applications')
        .insert({
          applicant_name: newAid.applicantName,
          phone: newAid.phone,
          email: newAid.email || null,
          type: newAid.type,
          patgram_address: newAid.patgramAddress,
          current_address: newAid.currentAddress,
          requested_amount: newAid.requestedAmount,
          reason: newAid.reason,
          status: 'submitted',
        })
        .then(() => {
          // persisted cleanly
        });
    }

    this.logAudit('SUBMIT_AID', 'aid', newAid.id, `${newAid.applicantName} ৳${newAid.requestedAmount} সহায়তার আবেদন করেছেন।`);
    this.notify();
    return { success: true };
  }

  public updateAidStatus(aidId: string, status: AidApplication['status'], fundId?: string): { success: boolean; error?: string } {
    const perms = this.rolePermissions[this.currentUser.role];
    if (
      !this.isAuthenticated ||
      (!perms?.can_manage_funds && !perms?.can_manage_student_wing && this.currentUser.role !== 'super_admin')
    ) {
      return { success: false, error: 'সহায়তা আবেদন অনুমোদনের অনুমতি নেই।' };
    }
    this.aidApplications = this.aidApplications.map((a) =>
      a.id === aidId ? { ...a, status, reviewedBy: this.currentUser.name, allocatedFundId: fundId || a.allocatedFundId } : a
    );
    this.save('aidApplications', this.aidApplications);
    this.logAudit('UPDATE_AID_STATUS', 'aid', aidId, `সহায়তা আবেদনের অবস্থা "${status}" করা হয়েছে।`);
    this.notify();
    return { success: true };
  }

  // --- NOTICES MANAGEMENT ---
  public addNotice(notice: Omit<Notice, 'id' | 'publishDate'>): { success: boolean; error?: string } {
    if (!this.isAuthenticated || !this.rolePermissions[this.currentUser.role]?.can_manage_notices) {
      return { success: false, error: 'নোটিশ প্রকাশের অনুমতি নেই।' };
    }
    const newNotice: Notice = {
      ...notice,
      id: `not-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      publishDate: new Date().toISOString().substring(0, 10),
    };
    this.notices = [newNotice, ...this.notices];
    this.save('notices', this.notices);
    this.logAudit('ADD_NOTICE', 'notice', newNotice.id, `নতুন নোটিশ "${newNotice.title}" প্রকাশিত হয়েছে।`);
    this.notify();
    return { success: true };
  }

  public deleteNotice(noticeId: string): { success: boolean; error?: string } {
    if (!this.isAuthenticated || !this.rolePermissions[this.currentUser.role]?.can_manage_notices) {
      return { success: false, error: 'নোটিশ মোছার অনুমতি নেই।' };
    }
    this.notices = this.notices.filter((n) => n.id !== noticeId);
    this.save('notices', this.notices);
    this.logAudit('DELETE_NOTICE', 'notice', noticeId, `নোটিশ মোছা হয়েছে।`);
    this.notify();
    return { success: true };
  }

  // --- FUNDS & ACCOUNTS MANAGEMENT ---
  public addFund(fund: Omit<FinancialFund, 'id' | 'currentBalance'>): { success: boolean; error?: string } {
    if (!this.isAuthenticated || !this.rolePermissions[this.currentUser.role]?.can_manage_funds) {
      return { success: false, error: 'নতুন তহবিল তৈরি করার অনুমতি নেই।' };
    }
    const codeUpper = fund.code.trim().toUpperCase();
    if (this.funds.some((f) => f.code.toUpperCase() === codeUpper || f.name.trim() === fund.name.trim())) {
      return { success: false, error: 'একই নাম বা কোডের তহবিল ইতোমধ্যে বিদ্যমান।' };
    }
    const newFund: FinancialFund = {
      ...fund,
      code: codeUpper,
      name: fund.name.trim(),
      id: `fund-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      currentBalance: 0,
    };
    this.funds = [...this.funds, newFund];
    this.save('funds', this.funds);
    this.logAudit('ADD_FUND', 'fund', newFund.id, `নতুন তহবিল "${newFund.name}" তৈরি হয়েছে।`);
    this.notify();
    return { success: true };
  }

  public addAccount(account: Omit<FinancialAccount, 'id' | 'currentBalance'>): { success: boolean; error?: string } {
    if (!this.isAuthenticated || !this.rolePermissions[this.currentUser.role]?.can_manage_accounts) {
      return { success: false, error: 'নতুন অ্যাকাউন্ট তৈরি করার অনুমতি নেই।' };
    }
    if (this.accounts.some((a) => a.name.trim() === account.name.trim())) {
      return { success: false, error: 'একই নামের অ্যাকাউন্ট ইতোমধ্যে বিদ্যমান।' };
    }
    const newAccount: FinancialAccount = {
      ...account,
      name: account.name.trim(),
      id: `acc-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      currentBalance: 0,
    };
    this.accounts = [...this.accounts, newAccount];
    this.save('accounts', this.accounts);
    this.logAudit('ADD_ACCOUNT', 'account', newAccount.id, `নতুন অ্যাকাউন্ট "${newAccount.name}" তৈরি হয়েছে।`);
    this.notify();
    return { success: true };
  }

  // --- SYSTEM SETTINGS & NO-CODE PERMISSIONS ---
  public updateSettings(newSettings: Partial<SystemSettings>): { success: boolean; error?: string } {
    if (
      !this.isAuthenticated ||
      (!this.rolePermissions[this.currentUser.role]?.can_manage_settings && this.currentUser.role !== 'super_admin')
    ) {
      return { success: false, error: 'সিস্টেম সেটিংস পরিবর্তনের অনুমতি নেই।' };
    }
    this.settings = { ...this.settings, ...newSettings };
    this.save('settings', this.settings);
    this.logAudit('UPDATE_SETTINGS', 'settings', 'sys-config', 'সিস্টেম সেটিংস ও যোগাযোগের তথ্য আপডেট করা হয়েছে।');
    this.notify();
    return { success: true };
  }

  public updateRolePermission(role: Role, permissionKey: keyof AdminPermissions, value: boolean): { success: boolean; error?: string } {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin' || this.currentUser.role !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন রোল পারমিশন পরিবর্তন করতে পারেন।' };
    }
    if (role === 'super_admin') {
      return { success: false, error: 'সুপার অ্যাডমিনের ক্ষমতা অপরিবর্তনযোগ্য।' };
    }
    const oldValue = this.rolePermissions[role]?.[permissionKey] ?? false;
    this.rolePermissions = {
      ...this.rolePermissions,
      [role]: {
        ...this.rolePermissions[role],
        [permissionKey]: value,
      },
    };
    this.save('rolePermissions', this.rolePermissions);

    const logEntry: PermissionChangeLog = {
      id: `perm-log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      targetUserId: `role-${role}`,
      targetRole: role,
      changedByRole: this.currentUser.role,
      changedByName: this.currentUser.name,
      permissionKey,
      oldValue,
      newValue: value,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      reason: 'অ্যাডমিন ড্যাশবোর্ড থেকে নো-কোড পারমিশন পরিবর্তন করা হয়েছে।',
    };
    this.permissionChangeLogs = [logEntry, ...this.permissionChangeLogs];
    this.save('permissionChangeLogs', this.permissionChangeLogs);

    this.logAudit(
      'UPDATE_PERMISSION',
      'role',
      role,
      `রোল "${role}"-এর পারমিশন "${permissionKey}" -> ${value ? 'চালু' : 'বন্ধ'} করা হয়েছে। (পরিবর্তনকারী: ${this.currentUser.name})`
    );
    this.notify();
    return { success: true };
  }

  // --- ISOLATED DEMO SANDBOX & CLEAN PRODUCTION RESET ---
  public loadDemoSandboxData(): { success: boolean; error?: string } {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন ডেমো স্যান্ডবক্স মোড চালু করতে পারেন।' };
    }
    if (this.isSandboxDemoActive) {
      return { success: false, error: 'স্যান্ডবক্স ডেমো মোড ইতোমধ্যেই চালু রয়েছে।' };
    }

    // Snapshot current real data before entering sandbox
    this.save('realSnapshotBeforeDemo', {
      funds: this.funds,
      accounts: this.accounts,
      transactions: this.transactions,
      corrections: this.corrections,
      members: this.members,
      committees: this.committees,
      notices: this.notices,
      aidApplications: this.aidApplications,
    });

    this.funds = DEMO_SANDBOX_FUNDS.map((f) => ({ ...f }));
    this.accounts = DEMO_SANDBOX_ACCOUNTS.map((a) => ({ ...a }));
    this.transactions = DEMO_SANDBOX_TRANSACTIONS.map((t) => ({ ...t }));
    this.corrections = [];
    this.members = DEMO_SANDBOX_MEMBERS.map((m) => ({ ...m }));
    this.committees = DEMO_SANDBOX_COMMITTEES.map((c) => ({ ...c, positions: c.positions.map((p) => ({ ...p })) }));
    this.notices = DEMO_SANDBOX_NOTICES.map((n) => ({ ...n }));
    this.aidApplications = DEMO_SANDBOX_AID_APPLICATIONS.map((a) => ({ ...a }));
    this.isSandboxDemoActive = true;

    this.persistAllOperationalState();
    this.logAudit('ENABLE_DEMO_SANDBOX', 'system', 'sandbox', 'সুপার অ্যাডমিন টেস্ট স্যান্ডবক্স (ডেমো ডেটা) চালু করেছেন।');
    this.notify();
    return { success: true };
  }

  public exitDemoSandboxData(): { success: boolean; error?: string } {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন স্যান্ডবক্স বন্ধ করতে পারেন।' };
    }
    if (!this.isSandboxDemoActive) {
      return { success: false, error: 'বর্তমানে কোনো ডেমো স্যান্ডবক্স চালু নেই।' };
    }

    const snapshot = this.load<{
      funds?: FinancialFund[];
      accounts?: FinancialAccount[];
      transactions?: FinancialTransaction[];
      corrections?: FinancialCorrection[];
      members?: Member[];
      committees?: CommitteeTerm[];
      notices?: Notice[];
      aidApplications?: AidApplication[];
    } | null>('realSnapshotBeforeDemo', null);

    this.funds = snapshot?.funds || INITIAL_FUNDS.map((f) => ({ ...f }));
    this.accounts = snapshot?.accounts || INITIAL_ACCOUNTS.map((a) => ({ ...a }));
    this.transactions = snapshot?.transactions || [];
    this.corrections = snapshot?.corrections || [];
    this.members = snapshot?.members || [];
    this.committees = snapshot?.committees || [];
    this.notices = snapshot?.notices || [];
    this.aidApplications = snapshot?.aidApplications || [];
    this.isSandboxDemoActive = false;

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_PREFIX + 'realSnapshotBeforeDemo');
      }
    } catch {
      // ignore
    }

    this.persistAllOperationalState();
    this.logAudit('EXIT_DEMO_SANDBOX', 'system', 'sandbox', 'ডেমো স্যান্ডবক্স বন্ধ করে আসল প্রোডাকশন ডেটাবেজ পুনরুদ্ধার করা হয়েছে।');
    this.notify();
    return { success: true };
  }

  public resetToCleanProduction(): { success: boolean; error?: string } {
    if (!this.isAuthenticated || this.authenticatedRole !== 'super_admin') {
      return { success: false, error: 'শুধুমাত্র সুপার অ্যাডমিন ক্লিন রিসেট করতে পারেন।' };
    }

    this.funds = INITIAL_FUNDS.map((f) => ({ ...f }));
    this.accounts = INITIAL_ACCOUNTS.map((a) => ({ ...a }));
    this.transactions = [];
    this.corrections = [];
    this.members = [];
    this.committees = [];
    this.notices = [];
    this.aidApplications = [];
    this.isSandboxDemoActive = false;

    this.persistAllOperationalState();
    this.logAudit('RESET_CLEAN_PRODUCTION', 'system', 'core', 'সব ডেমো/পরীক্ষামূলক তথ্য মুছে ক্লিন প্রোডাকশন অবস্থা (৳০) পুনঃস্থাপন করা হয়েছে।');
    this.notify();
    return { success: true };
  }

  private persistAllOperationalState() {
    this.save('isSandboxDemoActive', this.isSandboxDemoActive);
    this.save('funds', this.funds);
    this.save('accounts', this.accounts);
    this.save('transactions', this.transactions);
    this.save('corrections', this.corrections);
    this.save('members', this.members);
    this.save('committees', this.committees);
    this.save('notices', this.notices);
    this.save('aidApplications', this.aidApplications);
  }

  // --- BACKUP & DRY-RUN RESTORE VALIDATOR ---
  public exportFullBackupJSON(): string {
    const backupData = {
      version: '6.0',
      exportedAt: new Date().toISOString(),
      organization: this.settings.organizationNameBn,
      metadata: {
        totalMembers: this.members.length,
        totalFunds: this.funds.length,
        totalAccounts: this.accounts.length,
        totalTransactions: this.transactions.length,
        totalCorrections: this.corrections.length,
        totalPermissionLogs: this.permissionChangeLogs.length,
        fundsTotalBalance: roundBDT(this.funds.reduce((acc, f) => acc + f.currentBalance, 0)),
        accountsTotalBalance: roundBDT(this.accounts.reduce((acc, a) => acc + a.currentBalance, 0)),
      },
      data: {
        settings: this.settings,
        rolePermissions: this.rolePermissions,
        funds: this.funds,
        accounts: this.accounts,
        transactions: this.transactions,
        corrections: this.corrections,
        members: this.members,
        committees: this.committees,
        notices: this.notices,
        aidApplications: this.aidApplications,
        auditLogs: this.auditLogs,
        permissionChangeLogs: this.permissionChangeLogs,
      },
    };
    this.logAudit('EXPORT_BACKUP', 'system', 'backup', 'সম্পূর্ণ ডাটাবেজ ব্যাকআপ (JSON) এক্সপোর্ট করা হয়েছে।');
    return JSON.stringify(backupData, null, 2);
  }

  public validateBackupJSON(jsonStr: string): {
    isValid: boolean;
    error?: string;
    summary?: {
      membersCount: number;
      transactionsCount: number;
      fundsCount: number;
      accountsCount: number;
      fundBalanceSum: number;
      accountBalanceSum: number;
      isDualBalanceMatched: boolean;
    };
  } {
    try {
      const parsed = JSON.parse(jsonStr);
      if (
        !parsed.data ||
        !Array.isArray(parsed.data.funds) ||
        !Array.isArray(parsed.data.accounts) ||
        !Array.isArray(parsed.data.transactions) ||
        !Array.isArray(parsed.data.members)
      ) {
        return { isValid: false, error: 'অকার্যকর ব্যাকআপ ফাইল: ডাটাবেজের মূল টেবিলসমূহ অনুপস্থিত বা অবৈধ।' };
      }

      const funds = parsed.data.funds as FinancialFund[];
      const accounts = parsed.data.accounts as FinancialAccount[];
      const members = parsed.data.members as Member[];
      const transactions = parsed.data.transactions as FinancialTransaction[];

      if (funds.some((f) => !Number.isFinite(f.currentBalance) || f.currentBalance < 0)) {
        return { isValid: false, error: 'ত্রুটিপূর্ণ ব্যাকআপ: কোনো তহবিলের ব্যালেন্স ঋণাত্মক বা অকার্যকর পাওয়া গেছে।' };
      }
      if (accounts.some((a) => !Number.isFinite(a.currentBalance) || a.currentBalance < 0)) {
        return { isValid: false, error: 'ত্রুটিপূর্ণ ব্যাকআপ: কোনো অ্যাকাউন্টের ব্যালেন্স ঋণাত্মক বা অকার্যকর পাওয়া গেছে।' };
      }
      if (transactions.some((t) => !Number.isFinite(t.amount) || t.amount <= 0)) {
        return { isValid: false, error: 'ত্রুটিপূর্ণ ব্যাকআপ: কোনো লেনদেনের পরিমাণ শূন্য বা ঋণাত্মক পাওয়া গেছে।' };
      }

      const voucherSet = new Set<string>();
      for (const t of transactions) {
        const key = String(t.voucherNo || '').trim().toLowerCase();
        if (!key || voucherSet.has(key)) {
          return { isValid: false, error: `ত্রুটিপূর্ণ ব্যাকআপ: ডুপ্লিকেট বা খালি ভাউচার নম্বর (${t.voucherNo}) শনাক্ত হয়েছে।` };
        }
        voucherSet.add(key);
      }

      const fundSum = roundBDT(funds.reduce((acc, f) => acc + (f.currentBalance || 0), 0));
      const accSum = roundBDT(accounts.reduce((acc, a) => acc + (a.currentBalance || 0), 0));
      const isDualBalanceMatched = Math.abs(fundSum - accSum) < 0.01;

      return {
        isValid: true,
        summary: {
          membersCount: members.length,
          transactionsCount: transactions.length,
          fundsCount: funds.length,
          accountsCount: accounts.length,
          fundBalanceSum: fundSum,
          accountBalanceSum: accSum,
          isDualBalanceMatched,
        },
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { isValid: false, error: 'JSON পার্সিং ত্রুটি: ' + msg };
    }
  }

  public restoreFromBackupJSON(jsonStr: string): { success: boolean; error?: string } {
    if (
      !this.isAuthenticated ||
      (!this.rolePermissions[this.currentUser.role]?.can_export_backup && this.currentUser.role !== 'super_admin')
    ) {
      return { success: false, error: 'ব্যাকআপ রিস্টোর করার অনুমতি শুধুমাত্র অনুমোদিত প্রশাসকের।' };
    }

    const validation = this.validateBackupJSON(jsonStr);
    if (!validation.isValid) {
      return { success: false, error: validation.error };
    }

    try {
      const parsed = JSON.parse(jsonStr);
      const d = parsed.data;
      if (d.settings) this.settings = d.settings;
      if (d.rolePermissions) this.rolePermissions = d.rolePermissions;
      if (d.funds) this.funds = d.funds;
      if (d.accounts) this.accounts = d.accounts;
      if (d.transactions) this.transactions = d.transactions;
      if (d.corrections) this.corrections = d.corrections;
      if (d.members) this.members = d.members;
      if (d.committees) this.committees = d.committees;
      if (d.notices) this.notices = d.notices;
      if (d.aidApplications) this.aidApplications = d.aidApplications;
      if (d.auditLogs) this.auditLogs = d.auditLogs;
      if (d.permissionChangeLogs) this.permissionChangeLogs = d.permissionChangeLogs;

      this.save('settings', this.settings);
      this.save('rolePermissions', this.rolePermissions);
      this.save('funds', this.funds);
      this.save('accounts', this.accounts);
      this.save('transactions', this.transactions);
      this.save('corrections', this.corrections);
      this.save('members', this.members);
      this.save('committees', this.committees);
      this.save('notices', this.notices);
      this.save('aidApplications', this.aidApplications);
      this.save('auditLogs', this.auditLogs);
      this.save('permissionChangeLogs', this.permissionChangeLogs);

      this.logAudit('RESTORE_BACKUP', 'system', 'backup', 'ব্যাকআপ ফাইল থেকে সম্পূর্ণ ডাটাবেজ সফলভাবে রিস্টোর করা হয়েছে।');
      this.notify();
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { success: false, error: 'রিস্টোর ব্যর্থ: ' + msg };
    }
  }
}

export const store = new AppStore();

export function useAppStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return store.subscribe(() => setTick((t) => t + 1));
  }, []);

  return store;
}
