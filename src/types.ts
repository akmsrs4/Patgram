/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Role = 
  | 'super_admin'
  | 'finance_secretary'
  | 'president'
  | 'general_secretary'
  | 'general_admin'
  | 'student_admin';

export interface AdminPermissions {
  can_view_finance: boolean;
  can_entry_finance: boolean;
  can_approve_finance: boolean;
  can_view_reports: boolean;
  can_export_reports: boolean;
  can_correct_finance: boolean;
  can_view_correction_history: boolean;
  can_manage_funds: boolean;
  can_manage_accounts: boolean;
  can_manage_members: boolean;
  can_manage_student_wing: boolean;
  can_manage_committees: boolean;
  can_manage_notices: boolean;
  can_manage_settings: boolean;
  can_export_backup: boolean;
}

export interface PermissionChangeLog {
  id: string;
  targetUserId: string;
  targetRole: Role;
  changedByRole: Role;
  changedByName: string;
  permissionKey: keyof AdminPermissions;
  oldValue: boolean;
  newValue: boolean;
  timestamp: string;
  reason?: string;
}

export interface AdminUserAccount {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  role: Role;
  status: 'active' | 'pending_approval' | 'suspended';
  passwordHash?: string; // Stored only as SHA-256 hash in local mode
  salt?: string;
  createdAt: string;
}

export type MemberType = 'general' | 'student' | 'alumni' | 'custom';
export type MemberStatus = 'pending' | 'active' | 'inactive' | 'rejected';

export interface Member {
  id: string;
  membershipId: string; // e.g. PKS-GEN-2026-001 or PKS-STU-2026-001
  type: MemberType;
  fullNameBn: string;
  fullNameEn: string;
  phone: string;
  email: string;
  bloodGroup: string;
  patgramAddress: {
    village: string;
    union: string;
    ward?: string;
  };
  rangpurAddress: {
    area: string;
    thana: string;
    roadOrHolding?: string;
  };
  professionOrDesignation?: string;
  institution?: string; // For students
  department?: string; // For students
  academicYear?: string; // For students
  photoUrl?: string;
  status: MemberStatus;
  joinedDate: string;
  notes?: string;
}

export interface CommitteePosition {
  id: string;
  title: string; // সভাপতি, সাধারণ সম্পাদক, etc.
  memberId?: string;
  memberNameBn: string;
  memberNameEn?: string;
  phone?: string;
  photoUrl?: string;
  priority: number;
  isPublished: boolean; // Admin can toggle whether to display this member publicly
}

export interface CommitteeTerm {
  id: string;
  title: string; // e.g. "কার্যকরী পরিষদ ২০২৬-২০২৮"
  wing: 'central' | 'student_wing' | 'advisory';
  startYear: number;
  endYear: number;
  isCurrent: boolean;
  positions: CommitteePosition[];
}

export interface FinancialFund {
  id: string;
  name: string; // e.g. সাধারণ পরিচালন তহবিল, শিক্ষা সহায়তা তহবিল
  code: string; // GEN, EDU, MED, RELIEF, SOC, STU, RES
  description: string;
  currentBalance: number;
  isActive: boolean;
  isDefault: boolean;
}

export interface FinancialAccount {
  id: string;
  name: string; // e.g. সোনালী ব্যাংক, নগদ হাতে (ক্যাশ), বিকাশ মার্চেন্ট
  type: 'bank' | 'cash' | 'mobile_banking' | 'other';
  accountNumber?: string;
  currentBalance: number;
  isActive: boolean;
}

export type TransactionType = 'income' | 'expense' | 'fund_transfer';
export type TransactionStatus = 'pending_approval' | 'approved' | 'rejected' | 'corrected';

export interface FinancialTransaction {
  id: string;
  transactionCode: string; // TXN-2026-XXXX
  voucherNo: string;
  type: TransactionType;
  fundId: string;
  toFundId?: string; // Only for fund_transfer
  accountId: string;
  toAccountId?: string; // Only for fund_transfer
  amount: number;
  category: string;
  donorOrPayee: string;
  description: string;
  receiptUrl?: string;
  status: TransactionStatus;
  createdByRole: Role;
  createdByName: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
}

export interface FinancialCorrection {
  id: string;
  correctionCode: string; // CORR-2026-XXXX
  originalTransactionId: string;
  previousAmount: number;
  correctedAmount: number;
  previousCategory: string;
  correctedCategory: string;
  previousFundId: string;
  correctedFundId: string;
  previousAccountId: string;
  correctedAccountId: string;
  originalSnapshot: Partial<FinancialTransaction>;
  correctedSnapshot: Partial<FinancialTransaction>;
  correctionReason: string; // Mandatory!
  correctedById?: string;
  correctedByRole: Role;
  correctedByName: string;
  createdAt: string;
  requiresDualApproval: boolean;
  approvalStatus: 'approved' | 'pending_approval' | 'rejected';
  approvedBy?: string;
  approvedAt?: string;
  approvalNote?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actorRole: Role;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  metadata?: Record<string, any>;
  previousHash?: string;
  currentHash: string;
}

export interface Notice {
  id: string;
  title: string;
  category: 'general' | 'urgent' | 'meeting' | 'student' | 'election' | 'press';
  content: string;
  publishDate: string;
  isPinned: boolean;
  author: string;
  attachmentUrl?: string;
}

export interface AidApplication {
  id: string;
  applicantName: string;
  phone: string;
  email?: string;
  type: 'education_scholarship' | 'medical_assistance' | 'emergency_relief';
  patgramAddress: string;
  currentAddress: string;
  requestedAmount: number;
  reason: string;
  status: 'submitted' | 'under_review' | 'approved' | 'disbursed' | 'rejected';
  submittedAt: string;
  reviewedBy?: string;
  allocatedFundId?: string;
}

export interface SystemSettings {
  organizationNameBn: string;
  organizationNameEn: string;
  establishedYear: number;
  sloganBn: string;
  officeAddress: string;
  hotline1: string;
  hotline2: string;
  whatsappNumber: string;
  whatsappPrefilledMessage: string;
  facebookPageUrl: string;
  facebookGroupUrl: string;
  messengerUrl: string;
  email: string;
  technicalPartnerName: string;
  technicalPartnerUrl: string;
  nextBdUrl: string;
  copyrightNotice: string;
  isCommitteePubliclyVisible: boolean; // Default setting toggleable by admin
  correctionThresholdAmount: number; // 30,000 BDT
}
