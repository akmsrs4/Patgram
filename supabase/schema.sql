-- ====================================================================
-- পাটগ্রাম কল্যাণ সমিতি, রংপুর (স্থাপিত: ২০০৯)
-- Central PostgreSQL Database Schema & Security Architecture
-- Target: Supabase Free Tier (PostgreSQL 15+)
-- Date: 12 November 2026
-- Description: Single unified script. Safe to run in Supabase SQL Editor.
-- ====================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Custom Role & Status Enums (Safe Creation)
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'super_admin',
    'finance_secretary',
    'president',
    'general_secretary',
    'general_admin',
    'student_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE member_type AS ENUM ('general', 'student', 'alumni', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE member_status AS ENUM ('pending', 'active', 'inactive', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE txn_type AS ENUM ('income', 'expense', 'fund_transfer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE txn_status AS ENUM ('pending_approval', 'approved', 'rejected', 'corrected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE correction_status AS ENUM ('approved', 'pending_approval', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Profiles Table (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  phone TEXT,
  role user_role NOT NULL DEFAULT 'general_admin',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Granular Admin Permissions Table (No-Code Security Matrix)
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  can_view_finance BOOLEAN NOT NULL DEFAULT FALSE,
  can_entry_finance BOOLEAN NOT NULL DEFAULT FALSE,
  can_approve_finance BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_reports BOOLEAN NOT NULL DEFAULT FALSE,
  can_export_reports BOOLEAN NOT NULL DEFAULT FALSE,
  can_correct_finance BOOLEAN NOT NULL DEFAULT FALSE,
  can_view_correction_history BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_funds BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_accounts BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_members BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_student_wing BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_committees BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_notices BOOLEAN NOT NULL DEFAULT FALSE,
  can_manage_settings BOOLEAN NOT NULL DEFAULT FALSE,
  can_export_backup BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Permission Change History Log Table
CREATE TABLE IF NOT EXISTS public.permission_change_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  target_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_role user_role NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.profiles(id),
  permission_key TEXT NOT NULL,
  old_value BOOLEAN NOT NULL,
  new_value BOOLEAN NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Members Table (100% PRIVATE: Zero Public Exposure)
CREATE TABLE IF NOT EXISTS public.members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  membership_id TEXT NOT NULL UNIQUE,
  type member_type NOT NULL DEFAULT 'general',
  full_name_bn TEXT NOT NULL,
  full_name_en TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  blood_group TEXT,
  patgram_village TEXT NOT NULL,
  patgram_union TEXT NOT NULL,
  patgram_ward TEXT,
  rangpur_area TEXT NOT NULL,
  rangpur_thana TEXT NOT NULL,
  profession TEXT,
  institution TEXT, -- For student wing members
  department TEXT, -- For student wing members
  academic_year TEXT, -- For student wing members
  photo_url TEXT,
  status member_status NOT NULL DEFAULT 'pending',
  joined_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Committee Terms Table
CREATE TABLE IF NOT EXISTS public.committees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL, -- e.g. "কার্যকরী পরিষদ (২০২৫-২০২৭)"
  wing TEXT NOT NULL DEFAULT 'central', -- 'central' | 'student_wing' | 'advisory'
  start_year INT NOT NULL,
  end_year INT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Committee Positions Table
-- Default is_published = FALSE: Names & photos hidden by default until admin publishes!
CREATE TABLE IF NOT EXISTS public.committee_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  committee_id UUID NOT NULL REFERENCES public.committees(id) ON DELETE CASCADE,
  title TEXT NOT NULL, -- সভাপতি, সাধারণ সম্পাদক, ইত্যাদি
  member_name_bn TEXT NOT NULL,
  member_name_en TEXT,
  phone TEXT, -- Private: Not exposed in public views
  photo_url TEXT,
  priority INT NOT NULL DEFAULT 99,
  is_published BOOLEAN NOT NULL DEFAULT FALSE, -- Privacy toggle: defaults to FALSE!
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Secure Public View for Committee Members
-- Excludes phone and private contact information completely!
CREATE OR REPLACE VIEW public.public_committee_members AS
SELECT 
  cp.id,
  cp.committee_id,
  c.title AS committee_title,
  c.wing,
  cp.title AS position_title,
  cp.member_name_bn,
  cp.member_name_en,
  cp.photo_url,
  cp.priority
FROM public.committee_positions cp
JOIN public.committees c ON c.id = cp.committee_id
WHERE cp.is_published = TRUE;

-- 10. Financial Funds Table (Overdraft Prevention: balance >= 0)
CREATE TABLE IF NOT EXISTS public.funds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (current_balance >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Financial Accounts Table (Bank, Cash, Mobile Banking: balance >= 0)
CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL, -- 'bank' | 'cash' | 'mobile_banking' | 'other'
  account_number TEXT,
  current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (current_balance >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. Financial Transactions Ledger
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_code TEXT NOT NULL UNIQUE,
  voucher_no TEXT NOT NULL UNIQUE,
  type txn_type NOT NULL,
  fund_id UUID NOT NULL REFERENCES public.funds(id),
  to_fund_id UUID REFERENCES public.funds(id), -- Only for fund_transfer
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  to_account_id UUID REFERENCES public.accounts(id), -- Only for fund_transfer
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  donor_or_payee TEXT NOT NULL,
  description TEXT NOT NULL,
  receipt_url TEXT,
  status txn_status NOT NULL DEFAULT 'pending_approval',
  created_by UUID REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

-- 13. Financial Corrections Table
-- Implements Decision 1.খ: Delta = ABS(corrected_amount - previous_amount)
CREATE TABLE IF NOT EXISTS public.financial_corrections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  correction_code TEXT NOT NULL UNIQUE,
  original_transaction_id UUID NOT NULL REFERENCES public.transactions(id),
  previous_amount NUMERIC(14, 2) NOT NULL,
  corrected_amount NUMERIC(14, 2) NOT NULL CHECK (corrected_amount > 0),
  delta_amount NUMERIC(14, 2) GENERATED ALWAYS AS (ABS(corrected_amount - previous_amount)) STORED,
  previous_category TEXT NOT NULL,
  corrected_category TEXT NOT NULL,
  previous_fund_id UUID NOT NULL REFERENCES public.funds(id),
  corrected_fund_id UUID NOT NULL REFERENCES public.funds(id),
  previous_account_id UUID NOT NULL REFERENCES public.accounts(id),
  corrected_account_id UUID NOT NULL REFERENCES public.accounts(id),
  original_snapshot JSONB NOT NULL,
  corrected_snapshot JSONB NOT NULL,
  correction_reason TEXT NOT NULL CHECK (LENGTH(TRIM(correction_reason)) >= 5),
  requires_dual_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approval_status correction_status NOT NULL DEFAULT 'pending_approval',
  corrected_by UUID NOT NULL REFERENCES public.profiles(id),
  approved_by UUID REFERENCES public.profiles(id),
  approval_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

-- 14. Immutable Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id UUID REFERENCES public.profiles(id),
  actor_role user_role NOT NULL,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  previous_hash TEXT,
  current_hash TEXT NOT NULL
);

-- Immutability trigger for Audit Logs
CREATE OR REPLACE FUNCTION public.enforce_audit_immutability()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Audit logs are permanent and immutable. Modification or deletion is strictly forbidden.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_immutable ON public.audit_logs;
CREATE TRIGGER trg_audit_immutable
BEFORE UPDATE OR DELETE ON public.audit_logs
FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_immutability();

-- 15. Notices Table
CREATE TABLE IF NOT EXISTS public.notices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL,
  publish_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  author TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16. Aid Applications Table
CREATE TABLE IF NOT EXISTS public.aid_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  applicant_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  type TEXT NOT NULL, -- 'education_scholarship' | 'medical_assistance' | 'emergency_relief'
  patgram_address TEXT NOT NULL,
  current_address TEXT NOT NULL,
  requested_amount NUMERIC(12, 2) NOT NULL CHECK (requested_amount > 0),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  reviewed_by TEXT,
  allocated_fund_id UUID REFERENCES public.funds(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aid_applications ENABLE ROW LEVEL SECURITY;

-- Helper security function: Check if current authenticated user is Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin' AND status = 'active'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper security function: Check user granular permission
CREATE OR REPLACE FUNCTION public.has_permission(p_column TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_has BOOLEAN := FALSE;
BEGIN
  IF public.is_super_admin() THEN
    RETURN TRUE;
  END IF;

  EXECUTE format(
    'SELECT %I FROM public.admin_permissions WHERE user_id = $1',
    p_column
  ) INTO v_has USING auth.uid();

  RETURN COALESCE(v_has, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- --- Profiles RLS ---
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
ON public.profiles FOR SELECT
USING (id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Super Admin can manage all profiles" ON public.profiles;
CREATE POLICY "Super Admin can manage all profiles"
ON public.profiles FOR ALL
USING (public.is_super_admin());

-- --- Admin Permissions RLS ---
DROP POLICY IF EXISTS "Users can read own permissions" ON public.admin_permissions;
CREATE POLICY "Users can read own permissions"
ON public.admin_permissions FOR SELECT
USING (user_id = auth.uid() OR public.is_super_admin());

DROP POLICY IF EXISTS "Super Admin can update permissions" ON public.admin_permissions;
CREATE POLICY "Super Admin can update permissions"
ON public.admin_permissions FOR ALL
USING (public.is_super_admin());

-- --- Permission Change Logs RLS ---
DROP POLICY IF EXISTS "Super Admin can view permission change logs" ON public.permission_change_logs;
CREATE POLICY "Super Admin can view permission change logs"
ON public.permission_change_logs FOR SELECT
USING (public.is_super_admin());

DROP POLICY IF EXISTS "Super Admin can insert permission change logs" ON public.permission_change_logs;
CREATE POLICY "Super Admin can insert permission change logs"
ON public.permission_change_logs FOR INSERT
WITH CHECK (public.is_super_admin());

-- --- Members RLS (Strictly Private) ---
-- Public can ONLY submit pending membership application (INSERT)
DROP POLICY IF EXISTS "Public can submit membership application" ON public.members;
CREATE POLICY "Public can submit membership application"
ON public.members FOR INSERT
WITH CHECK (status = 'pending');

-- Only authorized admins can view or manage member records
DROP POLICY IF EXISTS "Authorized admins can view members" ON public.members;
CREATE POLICY "Authorized admins can view members"
ON public.members FOR SELECT
USING (public.has_permission('can_manage_members'));

DROP POLICY IF EXISTS "Authorized admins can update members" ON public.members;
CREATE POLICY "Authorized admins can update members"
ON public.members FOR UPDATE
USING (public.has_permission('can_manage_members'));

-- --- Committees & Positions RLS ---
DROP POLICY IF EXISTS "Public can view committees" ON public.committees;
CREATE POLICY "Public can view committees"
ON public.committees FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "Committee managers can manage committees" ON public.committees;
CREATE POLICY "Committee managers can manage committees"
ON public.committees FOR ALL
USING (public.has_permission('can_manage_committees'));

-- Public can view committee positions only if is_published is true
DROP POLICY IF EXISTS "Public can view published positions" ON public.committee_positions;
CREATE POLICY "Public can view published positions"
ON public.committee_positions FOR SELECT
USING (is_published = TRUE OR public.has_permission('can_manage_committees'));

DROP POLICY IF EXISTS "Committee managers can manage positions" ON public.committee_positions;
CREATE POLICY "Committee managers can manage positions"
ON public.committee_positions FOR ALL
USING (public.has_permission('can_manage_committees'));

-- --- Funds & Accounts RLS ---
DROP POLICY IF EXISTS "Finance viewers can see funds" ON public.funds;
CREATE POLICY "Finance viewers can see funds"
ON public.funds FOR SELECT
USING (public.has_permission('can_view_finance'));

DROP POLICY IF EXISTS "Fund managers can manage funds" ON public.funds;
CREATE POLICY "Fund managers can manage funds"
ON public.funds FOR ALL
USING (public.has_permission('can_manage_funds'));

DROP POLICY IF EXISTS "Finance viewers can see accounts" ON public.accounts;
CREATE POLICY "Finance viewers can see accounts"
ON public.accounts FOR SELECT
USING (public.has_permission('can_view_finance'));

DROP POLICY IF EXISTS "Account managers can manage accounts" ON public.accounts;
CREATE POLICY "Account managers can manage accounts"
ON public.accounts FOR ALL
USING (public.has_permission('can_manage_accounts'));

-- --- Transactions RLS ---
DROP POLICY IF EXISTS "Finance viewers can see transactions" ON public.transactions;
CREATE POLICY "Finance viewers can see transactions"
ON public.transactions FOR SELECT
USING (public.has_permission('can_view_finance'));

DROP POLICY IF EXISTS "Finance creators can insert transactions" ON public.transactions;
CREATE POLICY "Finance creators can insert transactions"
ON public.transactions FOR INSERT
WITH CHECK (public.has_permission('can_entry_finance'));

DROP POLICY IF EXISTS "Finance approvers can update transactions" ON public.transactions;
CREATE POLICY "Finance approvers can update transactions"
ON public.transactions FOR UPDATE
USING (public.has_permission('can_approve_finance'));

-- --- Financial Corrections RLS ---
DROP POLICY IF EXISTS "Authorized can view corrections" ON public.financial_corrections;
CREATE POLICY "Authorized can view corrections"
ON public.financial_corrections FOR SELECT
USING (public.has_permission('can_view_correction_history'));

DROP POLICY IF EXISTS "Authorized can propose corrections" ON public.financial_corrections;
CREATE POLICY "Authorized can propose corrections"
ON public.financial_corrections FOR INSERT
WITH CHECK (public.has_permission('can_correct_finance'));

DROP POLICY IF EXISTS "Authorized can approve corrections" ON public.financial_corrections;
CREATE POLICY "Authorized can approve corrections"
ON public.financial_corrections FOR UPDATE
USING (public.has_permission('can_approve_finance') OR public.is_super_admin());

-- --- Notices RLS ---
DROP POLICY IF EXISTS "Public can view notices" ON public.notices;
CREATE POLICY "Public can view notices"
ON public.notices FOR SELECT
USING (TRUE);

DROP POLICY IF EXISTS "Notice managers can manage notices" ON public.notices;
CREATE POLICY "Notice managers can manage notices"
ON public.notices FOR ALL
USING (public.has_permission('can_manage_notices'));

-- --- Aid Applications RLS ---
DROP POLICY IF EXISTS "Public can submit aid application" ON public.aid_applications;
CREATE POLICY "Public can submit aid application"
ON public.aid_applications FOR INSERT
WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Authorized can view and manage aid applications" ON public.aid_applications;
CREATE POLICY "Authorized can view and manage aid applications"
ON public.aid_applications FOR ALL
USING (public.has_permission('can_manage_funds') OR public.is_super_admin());

-- --- Audit Logs RLS ---
DROP POLICY IF EXISTS "Super Admin can view audit logs" ON public.audit_logs;
CREATE POLICY "Super Admin can view audit logs"
ON public.audit_logs FOR SELECT
USING (public.is_super_admin());

-- ====================================================================
-- STORED PROCEDURES & INTEGRITY CHECKS
-- ====================================================================

-- Procedure to apply approved transaction balances atomically
CREATE OR REPLACE FUNCTION public.fn_process_approved_transaction(p_txn_id UUID)
RETURNS VOID AS $$
DECLARE
  v_txn public.transactions%ROWTYPE;
BEGIN
  SELECT * INTO v_txn FROM public.transactions WHERE id = p_txn_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction ID not found: %', p_txn_id;
  END IF;

  IF v_txn.status <> 'approved' THEN
    RAISE EXCEPTION 'Transaction must be approved to affect ledger balance.';
  END IF;

  IF v_txn.type = 'income' THEN
    UPDATE public.funds SET current_balance = current_balance + v_txn.amount WHERE id = v_txn.fund_id;
    UPDATE public.accounts SET current_balance = current_balance + v_txn.amount WHERE id = v_txn.account_id;
  ELSIF v_txn.type = 'expense' THEN
    UPDATE public.funds SET current_balance = current_balance - v_txn.amount WHERE id = v_txn.fund_id;
    UPDATE public.accounts SET current_balance = current_balance - v_txn.amount WHERE id = v_txn.account_id;
  ELSIF v_txn.type = 'fund_transfer' THEN
    UPDATE public.funds SET current_balance = current_balance - v_txn.amount WHERE id = v_txn.fund_id;
    UPDATE public.funds SET current_balance = current_balance + v_txn.amount WHERE id = v_txn.to_fund_id;
    UPDATE public.accounts SET current_balance = current_balance - v_txn.amount WHERE id = v_txn.account_id;
    UPDATE public.accounts SET current_balance = current_balance + v_txn.amount WHERE id = v_txn.to_account_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Procedure to verify that Total Funds Balance equals Total Accounts Balance
CREATE OR REPLACE FUNCTION public.fn_verify_dual_balance_integrity()
RETURNS TABLE (
  total_funds NUMERIC,
  total_accounts NUMERIC,
  is_matched BOOLEAN,
  discrepancy NUMERIC
) AS $$
DECLARE
  v_funds NUMERIC := 0;
  v_accounts NUMERIC := 0;
BEGIN
  SELECT COALESCE(SUM(current_balance), 0) INTO v_funds FROM public.funds WHERE is_active = TRUE;
  SELECT COALESCE(SUM(current_balance), 0) INTO v_accounts FROM public.accounts WHERE is_active = TRUE;

  RETURN QUERY SELECT 
    v_funds, 
    v_accounts, 
    (v_funds = v_accounts), 
    ABS(v_funds - v_accounts);
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- FIRST SUPER ADMIN AUTO-BOOTSTRAP & OFFICER REGISTRATION TRIGGER
-- ====================================================================

-- Safe check for frontend login screen: returns TRUE only when 0 profiles exist
CREATE OR REPLACE FUNCTION public.is_first_admin_setup()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_first_admin_setup() TO anon, authenticated;

-- Automatically creates profile & permissions on Supabase Auth signup:
-- 1st user ever becomes 'super_admin' (active, full permissions)
-- Subsequent users become 'pending_approval' until Super Admin approves them
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_user_count INT;
  v_role user_role;
  v_status TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(99887766);

  SELECT COUNT(*) INTO v_user_count FROM public.profiles;

  IF v_user_count = 0 THEN
    v_role := 'super_admin';
    v_status := 'active';
  ELSE
    v_role := 'general_admin';
    v_status := 'pending_approval';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    v_role,
    v_status
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.admin_permissions (
    user_id,
    can_view_finance, can_entry_finance, can_approve_finance,
    can_view_reports, can_export_reports, can_correct_finance,
    can_view_correction_history, can_manage_funds, can_manage_accounts,
    can_manage_members, can_manage_student_wing, can_manage_committees,
    can_manage_notices, can_manage_settings, can_export_backup
  ) VALUES (
    NEW.id,
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin'),
    (v_role = 'super_admin'), (v_role = 'super_admin'), (v_role = 'super_admin')
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- INITIAL SEED DATA (FUNDS & ACCOUNTS - CLEAN 0.00 STARTING BALANCES)
-- ====================================================================

INSERT INTO public.funds (name, code, description, current_balance, is_active, is_default)
VALUES
  ('সাধারণ পরিচালন তহবিল', 'GEN', 'সংগঠনের সার্বিক প্রশাসনিক ও সাধারণ ব্যয় নির্বাহের মূল তহবিল।', 0.00, TRUE, TRUE),
  ('শিক্ষা ও মেধা বৃত্তি তহবিল', 'EDU', 'পাটগ্রামের অস্বচ্ছল ও মেধাবী শিক্ষার্থীদের মাসিক উপবৃত্তি ও এককালীন অনুদান।', 0.00, TRUE, FALSE),
  ('চিকিৎসা সহায়তা তহবিল', 'MED', 'দুরারোগ্য ব্যাধিতে আক্রান্ত ও জরুরি চিকিৎসার জন্য আর্থিক অনুদান তহবিল।', 0.00, TRUE, FALSE),
  ('জরুরি দুর্যোগ ও ত্রাণ তহবিল', 'RELIEF', 'শীতবস্ত্র বিতরণ, বন্যা ও জরুরি প্রাকৃতিক দুর্যোগে দ্রুত সহায়তার বিশেষ তহবিল।', 0.00, TRUE, FALSE),
  ('সামাজিক ও যুব কল্যাণ তহবিল', 'SOC', 'কমিউনিটি উন্নয়ন, ক্রীড়া ও পাঠাগার সংক্রান্ত কার্যক্রম তহবিল।', 0.00, TRUE, FALSE),
  ('ছাত্র সংগঠন কল্যাণ তহবিল', 'STU', 'পাটগ্রাম ছাত্র কল্যাণ সমিতি রংপুর-এর নিজস্ব কর্মসূচি ও সভা সংক্রান্ত তহবিল।', 0.00, TRUE, FALSE),
  ('স্থায়ী আমানত ও রিজার্ভ তহবিল', 'RES', 'সংগঠনের দীর্ঘমেয়াদি স্থায়িত্ব ও ভবিষ্যৎ নিজস্ব কার্যালয় প্রতিষ্ঠার সংরক্ষিত তহবিল।', 0.00, TRUE, FALSE)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.accounts (name, type, account_number, current_balance, is_active)
VALUES
  ('ব্যাংক অ্যাকাউন্ট (প্রধান তহবিল)', 'bank', 'PENDING-SETUP', 0.00, TRUE),
  ('হাতে নগদ ক্যাশ (কোষাধ্যক্ষ)', 'cash', 'CASH-IN-HAND', 0.00, TRUE),
  ('মোবাইল ব্যাংকিং ওয়ালেট (বিকাশ / নগদ)', 'mobile_banking', '01603526000', 0.00, TRUE)
ON CONFLICT (name) DO NOTHING;
