/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AdminPermissions,
  AidApplication,
  AuditLog,
  CommitteeTerm,
  FinancialAccount,
  FinancialFund,
  FinancialTransaction,
  Member,
  Notice,
  Role,
  SystemSettings,
} from '../types.ts';

export const INITIAL_SETTINGS: SystemSettings = {
  organizationNameBn: 'পাটগ্রাম কল্যাণ সমিতি, রংপুর',
  organizationNameEn: 'Patgram Kalyan Samity, Rangpur',
  establishedYear: 2009,
  sloganBn: 'ঐক্য, ভ্রাতৃত্ব, কল্যাণ ও টেকসই মানবিক উন্নয়ন',
  officeAddress: 'রোড নং-০৩, বাড়ি নং-১২, ধাপ ইঞ্জিনিয়ার্স পাড়া, রংপুর মহানগরী-৫৪০০',
  hotline1: '01717850780',
  hotline2: '+8801603526000',
  whatsappNumber: '8801603526000',
  whatsappPrefilledMessage: 'আসসালামু আলাইকুম, আপনার সেবা সম্পর্কে জানতে চাই।',
  facebookPageUrl: 'https://www.facebook.com/Rangpur247bd/',
  facebookGroupUrl: 'https://www.facebook.com/groups/patgramsamity',
  messengerUrl: 'https://m.me/rangpur247bd',
  email: 'patgramkalyan.rangpur@gmail.com',
  technicalPartnerName: 'Rangpur247 & NextBD',
  technicalPartnerUrl: 'https://rangpur247.pages.dev/',
  nextBdUrl: 'https://nextbd.pages.dev/',
  copyrightNotice: '© 2026 Rangpur247. All Rights Reserved.',
  isCommitteePubliclyVisible: false, // Default unpublished until admin explicitly publishes
  correctionThresholdAmount: 30000,
};

export const INITIAL_ROLE_PERMISSIONS: Record<Role, AdminPermissions> = {
  super_admin: {
    can_view_finance: true,
    can_entry_finance: true,
    can_approve_finance: true,
    can_view_reports: true,
    can_export_reports: true,
    can_correct_finance: true,
    can_view_correction_history: true,
    can_manage_funds: true,
    can_manage_accounts: true,
    can_manage_members: true,
    can_manage_student_wing: true,
    can_manage_committees: true,
    can_manage_notices: true,
    can_manage_settings: true,
    can_export_backup: true,
  },
  finance_secretary: {
    can_view_finance: true,
    can_entry_finance: true,
    can_approve_finance: false,
    can_view_reports: true,
    can_export_reports: true,
    can_correct_finance: true,
    can_view_correction_history: true,
    can_manage_funds: false,
    can_manage_accounts: false,
    can_manage_members: false,
    can_manage_student_wing: false,
    can_manage_committees: false,
    can_manage_notices: true,
    can_manage_settings: false,
    can_export_backup: false,
  },
  president: {
    can_view_finance: true,
    can_entry_finance: false,
    can_approve_finance: true,
    can_view_reports: true,
    can_export_reports: true,
    can_correct_finance: false,
    can_view_correction_history: true,
    can_manage_funds: false,
    can_manage_accounts: false,
    can_manage_members: true,
    can_manage_student_wing: true,
    can_manage_committees: true,
    can_manage_notices: true,
    can_manage_settings: false,
    can_export_backup: true,
  },
  general_secretary: {
    can_view_finance: true,
    can_entry_finance: true,
    can_approve_finance: true,
    can_view_reports: true,
    can_export_reports: true,
    can_correct_finance: false,
    can_view_correction_history: true,
    can_manage_funds: false,
    can_manage_accounts: false,
    can_manage_members: true,
    can_manage_student_wing: true,
    can_manage_committees: true,
    can_manage_notices: true,
    can_manage_settings: false,
    can_export_backup: true,
  },
  general_admin: {
    can_view_finance: false,
    can_entry_finance: false,
    can_approve_finance: false,
    can_view_reports: false,
    can_export_reports: false,
    can_correct_finance: false,
    can_view_correction_history: false,
    can_manage_funds: false,
    can_manage_accounts: false,
    can_manage_members: true,
    can_manage_student_wing: false,
    can_manage_committees: false,
    can_manage_notices: true,
    can_manage_settings: false,
    can_export_backup: false,
  },
  student_admin: {
    can_view_finance: false,
    can_entry_finance: false,
    can_approve_finance: false,
    can_view_reports: false,
    can_export_reports: false,
    can_correct_finance: false,
    can_view_correction_history: false,
    can_manage_funds: false,
    can_manage_accounts: false,
    can_manage_members: false,
    can_manage_student_wing: true,
    can_manage_committees: false,
    can_manage_notices: true,
    can_manage_settings: false,
    can_export_backup: false,
  },
};

// CLEAN PRODUCTION FUNDS STRUCTURE (All balances start strictly at ৳0)
export const INITIAL_FUNDS: FinancialFund[] = [
  {
    id: 'fund-1',
    name: 'সাধারণ পরিচালন তহবিল',
    code: 'GEN',
    description: 'সদস্যদের নিয়মিত চাঁদা, ভর্তি ফি এবং সংগঠনের দৈনন্দিন প্রাতিষ্ঠানিক পরিচালনা ব্যয়।',
    currentBalance: 0,
    isActive: true,
    isDefault: true,
  },
  {
    id: 'fund-2',
    name: 'শিক্ষা সহায়তা তহবিল',
    code: 'EDU',
    description: 'দরিদ্র ও মেধাবী শিক্ষার্থীদের বৃত্তি, বই খাতা, ফরম পূরণ ও উচ্চশিক্ষা সহায়তা।',
    currentBalance: 0,
    isActive: true,
    isDefault: false,
  },
  {
    id: 'fund-3',
    name: 'চিকিৎসা ও জরুরি সহায়তা তহবিল',
    code: 'MED',
    description: 'অসুস্থ, অসহায় ও জরুরি চিকিৎসার প্রয়োজন রয়েছে এমন পাটগ্রামবাসীর মানবিক সহায়তা।',
    currentBalance: 0,
    isActive: true,
    isDefault: false,
  },
  {
    id: 'fund-4',
    name: 'দুর্যোগ ও মানবিক সহায়তা তহবিল',
    code: 'RELIEF',
    description: 'বন্যা, শীতবস্ত্র, অগ্নিকাণ্ড ও প্রাকৃতিক দুর্যোগকালীন অসহায় পরিবারের ত্রাণ কার্যক্রম।',
    currentBalance: 0,
    isActive: true,
    isDefault: false,
  },
  {
    id: 'fund-5',
    name: 'সমাজকল্যাণ ও উন্নয়ন তহবিল',
    code: 'SOC',
    description: 'পাটগ্রাম উপজেলার সামাজিক উন্নয়ন, পাঠাগার উন্নয়ন ও জনকল্যাণমূলক দীর্ঘমেয়াদি উদ্যোগ।',
    currentBalance: 0,
    isActive: true,
    isDefault: false,
  },
  {
    id: 'fund-6',
    name: 'ছাত্রকল্যাণ তহবিল',
    code: 'STU',
    description: 'পাটগ্রাম ছাত্র কল্যাণ সমিতি, রংপুরের শিক্ষা, ক্যারিয়ার ও সাংস্কৃতিক কার্যক্রম তহবিল।',
    currentBalance: 0,
    isActive: true,
    isDefault: false,
  },
  {
    id: 'fund-7',
    name: 'স্থায়ী বা সংরক্ষিত তহবিল',
    code: 'RES',
    description: 'সংগঠনের দীর্ঘমেয়াদি স্থায়িত্ব, স্থায়ী কার্যালয় ও ভবিষ্যৎ নিরাপত্তার জন্য সংরক্ষিত অর্থ।',
    currentBalance: 0,
    isActive: true,
    isDefault: false,
  },
];

// CLEAN PRODUCTION ACCOUNTS STRUCTURE (All balances start strictly at ৳0)
export const INITIAL_ACCOUNTS: FinancialAccount[] = [
  {
    id: 'acc-1',
    name: 'ব্যাংক অ্যাকাউন্ট (প্রধান তহবিল)',
    type: 'bank',
    accountNumber: 'অ্যাডমিন প্যানেল থেকে যুক্ত করুন',
    currentBalance: 0,
    isActive: true,
  },
  {
    id: 'acc-2',
    name: 'নগদ হাতে ক্যাশ (কোষাধ্যক্ষ)',
    type: 'cash',
    accountNumber: 'ক্যাশ ব্যালেন্স',
    currentBalance: 0,
    isActive: true,
  },
  {
    id: 'acc-3',
    name: 'মোবাইল ব্যাংকিং ওয়ালেট (বিকাশ / নগদ)',
    type: 'mobile_banking',
    accountNumber: '০১৬০৩৫২৬০০০',
    currentBalance: 0,
    isActive: true,
  },
];

// Clean empty production arrays (zero fake demo data exposed publicly)
export const INITIAL_MEMBERS: Member[] = [];
export const INITIAL_COMMITTEES: CommitteeTerm[] = [];
export const INITIAL_TRANSACTIONS: FinancialTransaction[] = [];
export const INITIAL_NOTICES: Notice[] = [];
export const INITIAL_AID_APPLICATIONS: AidApplication[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

// =========================================================================
// ISOLATED DEMO SANDBOX DATA (Loaded ONLY when Super Admin explicitly activates Sandbox Mode)
// =========================================================================
export const DEMO_SANDBOX_FUNDS: FinancialFund[] = INITIAL_FUNDS.map((f, idx) => ({
  ...f,
  currentBalance: [75500, 120000, 85000, 50000, 65000, 42000, 250000][idx] ?? 0,
}));

export const DEMO_SANDBOX_ACCOUNTS: FinancialAccount[] = [
  {
    id: 'acc-1',
    name: '[ডেমো] সোনালী ব্যাংক পিএলসি (ধাপ শাখা, রংপুর)',
    type: 'bank',
    accountNumber: 'DEMO-01220345',
    currentBalance: 395500,
    isActive: true,
  },
  {
    id: 'acc-2',
    name: '[ডেমো] নগদ হাতে ক্যাশ (কোষাধ্যক্ষ)',
    type: 'cash',
    accountNumber: 'DEMO-CASH',
    currentBalance: 142000,
    isActive: true,
  },
  {
    id: 'acc-3',
    name: '[ডেমো] মোবাইল ব্যাংকিং ওয়ালেট (বিকাশ / নগদ)',
    type: 'mobile_banking',
    accountNumber: 'DEMO-MFS',
    currentBalance: 150000,
    isActive: true,
  },
];

export const DEMO_SANDBOX_MEMBERS: Member[] = [
  {
    id: 'demo-mem-1',
    membershipId: 'DEMO-GEN-001',
    type: 'general',
    fullNameBn: '[ডেমো] নমুনা সাধারণ সদস্য',
    fullNameEn: '[DEMO] Sample General Member',
    phone: '01700000001',
    email: 'demo-member1@example.test',
    bloodGroup: 'A+',
    patgramAddress: { village: 'নমুনা গ্রাম', union: 'পাটগ্রাম', ward: '০১' },
    rangpurAddress: { area: 'ধাপ', thorough: 'কোতোয়ালী', thana: 'কোতোয়ালী' } as unknown as Member['rangpurAddress'],
    professionOrDesignation: 'টেস্ট ডেমো প্রোফাইল',
    status: 'active',
    joinedDate: '2026-01-01',
  },
  {
    id: 'demo-mem-2',
    membershipId: 'DEMO-STU-001',
    type: 'student',
    fullNameBn: '[ডেমো] নমুনা ছাত্র সদস্য',
    fullNameEn: '[DEMO] Sample Student Member',
    phone: '01700000002',
    email: 'demo-student@example.test',
    bloodGroup: 'O+',
    patgramAddress: { village: 'নমুনা গ্রাম', union: 'দহগ্রাম' },
    rangpurAddress: { area: 'লালবাগ', thana: 'তাজহাট' },
    institution: 'নমুনা বিশ্ববিদ্যালয়, রংপুর',
    department: 'কম্পিউটার সায়েন্স',
    academicYear: '৩য় বর্ষ',
    status: 'pending',
    joinedDate: '2026-11-01',
  },
];

export const DEMO_SANDBOX_COMMITTEES: CommitteeTerm[] = [
  {
    id: 'demo-comm-1',
    title: '[ডেমো] নমুনা কার্যকরী পরিষদ (টেস্ট)',
    wing: 'central',
    startYear: 2025,
    endYear: 2027,
    isCurrent: true,
    positions: [
      {
        id: 'demo-pos-1',
        title: 'সভাপতি (ডেমো)',
        memberNameBn: '[ডেমো] নমুনা সভাপতি',
        phone: '01700000001',
        priority: 1,
        isPublished: false,
      },
    ],
  },
];

export const DEMO_SANDBOX_TRANSACTIONS: FinancialTransaction[] = [
  {
    id: 'demo-txn-1',
    transactionCode: 'DEMO-TXN-0001',
    voucherNo: 'DEMO-V-01',
    type: 'income',
    fundId: 'fund-1',
    accountId: 'acc-1',
    amount: 50000,
    category: '[ডেমো] নমুনা অনুদান',
    donorOrPayee: 'নমুনা দাতা',
    description: 'এটি শুধুমাত্র পরীক্ষার জন্য ডেমো লেনদেন।',
    status: 'approved',
    createdByRole: 'super_admin',
    createdByName: 'ডেমো সিস্টেম',
    createdAt: '2026-11-01 10:00:00',
    approvedBy: 'ডেমো সিস্টেম',
    approvedAt: '2026-11-01 10:05:00',
  },
];

export const DEMO_SANDBOX_NOTICES: Notice[] = [
  {
    id: 'demo-not-1',
    title: '[ডেমো বিজ্ঞপ্তি] এটি সিস্টেম পরীক্ষার একটি নমুনা নোটিশ',
    category: 'general',
    content: 'সুপার অ্যাডমিন প্যানেলের স্যান্ডবক্স টেস্ট মোড চালু থাকায় এই নমুনা নোটিশটি দেখা যাচ্ছে।',
    publishDate: '2026-11-12',
    isPinned: false,
    author: 'স্যান্ডবক্স টেস্ট সিস্টেম',
  },
];

export const DEMO_SANDBOX_AID_APPLICATIONS: AidApplication[] = [
  {
    id: 'demo-aid-1',
    applicantName: '[ডেমো] নমুনা আবেদনকারী',
    phone: '01700000009',
    type: 'education_scholarship',
    patgramAddress: 'নমুনা গ্রাম, পাটগ্রাম',
    currentAddress: 'রংপুর',
    requestedAmount: 10000,
    reason: 'সিস্টেম পরীক্ষার জন্য নমুনা সহায়তা আবেদন।',
    status: 'submitted',
    submittedAt: '2026-11-10 12:00:00',
    allocatedFundId: 'fund-2',
  },
];
