/**
 * Automated Audit & Financial Integrity Verification Suite
 * Run with: npx tsx scripts/verify_audit.ts
 */

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`ASSERTION FAILED: ${message}`);
  }
}

function assertEqual<T>(actual: T, expected: T, message: string) {
  if (actual !== expected) {
    throw new Error(`ASSERTION FAILED: ${message} (expected=${String(expected)}, actual=${String(actual)})`);
  }
}

// Install clean in-memory localStorage mock before importing store
const memoryStorage = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    memoryStorage.set(key, String(value));
  },
  removeItem: (key: string) => {
    memoryStorage.delete(key);
  },
  clear: () => {
    memoryStorage.clear();
  },
  key: (index: number) => Array.from(memoryStorage.keys())[index] ?? null,
  get length() {
    return memoryStorage.size;
  },
};

(globalThis as unknown as { localStorage: Storage }).localStorage = mockLocalStorage as unknown as Storage;

async function runAuditTests() {
  const { store, roundBDT } = await import('../src/db/store.ts');

  console.log('1. Verifying clean initial production state (0 demo data)...');
  assertEqual(store.isSandboxDemoActive, false, 'Sandbox mode must be OFF initially');
  assertEqual(store.isAuthenticated, false, 'User must be logged out initially');
  assertEqual(store.members.length, 0, 'Initial members must be 0');
  assertEqual(store.committees.length, 0, 'Initial committees must be 0');
  assertEqual(store.notices.length, 0, 'Initial notices must be 0');
  assertEqual(store.transactions.length, 0, 'Initial transactions must be 0');
  assertEqual(store.aidApplications.length, 0, 'Initial aid applications must be 0');
  assertEqual(store.settings.isCommitteePubliclyVisible, false, 'Committee must default to unpublished');

  const initFundSum = roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0));
  const initAccSum = roundBDT(store.accounts.reduce((s, a) => s + a.currentBalance, 0));
  assertEqual(initFundSum, 0, 'Initial funds sum must be 0 BDT');
  assertEqual(initAccSum, 0, 'Initial accounts sum must be 0 BDT');

  console.log('2. Verifying unauthenticated RBAC blocks...');
  assertEqual(
    store.addTransaction({
      voucherNo: 'UNAUTH-01',
      type: 'income',
      fundId: 'fund-gen',
      accountId: 'acc-bank',
      amount: 500,
      category: 'Test',
      donorOrPayee: 'Tester',
      description: 'Should fail',
    }).success,
    false,
    'Unauthenticated addTransaction must fail'
  );
  assertEqual(
    store.addNotice({ title: 'Hack', category: 'general', content: 'Test', isPinned: false, author: 'Anon' }).success,
    false,
    'Unauthenticated addNotice must fail'
  );
  assertEqual(
    store.addFund({ name: 'Hack Fund', code: 'HACK', description: 'X', isActive: true, isDefault: false }).success,
    false,
    'Unauthenticated addFund must fail'
  );
  assertEqual(store.loadDemoSandboxData().success, false, 'Unauthenticated sandbox toggle must fail');
  assertEqual(store.resetToCleanProduction().success, false, 'Unauthenticated reset must fail');

  console.log('3. Verifying first-time Super Admin bootstrap & officer approval flow...');
  const regSuper = await store.registerAdminLocal({
    fullName: 'মাস্টার সুপার অ্যাডমিন',
    email: 'super@patgram.test',
    password: 'Password@123',
  });
  assert(regSuper.success && regSuper.isFirstSuperAdmin, 'First account must become active Super Admin');
  assertEqual(store.authenticatedRole, 'super_admin', 'Authenticated role must be super_admin');

  // Register pending officer (finance_secretary)
  await store.logout();
  const regFin = await store.registerAdminLocal({
    fullName: 'অর্থ সম্পাদক',
    email: 'finance@patgram.test',
    password: 'Password@123',
    requestedRole: 'finance_secretary',
  });
  assert(regFin.success && regFin.pendingApproval, 'Second registration must require Super Admin approval');

  const pendingLogin = await store.loginAdminLocal('finance@patgram.test', 'Password@123');
  assertEqual(pendingLogin.success, false, 'Pending officer must NOT be able to login');

  // Login Super Admin with wrong password vs right password
  const wrongLogin = await store.loginAdminLocal('super@patgram.test', 'WrongPass');
  assertEqual(wrongLogin.success, false, 'Wrong password must be rejected');
  const superLogin = await store.loginAdminLocal('super@patgram.test', 'Password@123');
  assertEqual(superLogin.success, true, 'Super Admin login with valid password must succeed');

  // Approve finance_secretary and create president
  const finAccount = store.adminAccounts.find((a) => a.email === 'finance@patgram.test');
  assert(finAccount, 'Finance account must exist');
  assertEqual(store.updateAdminAccount(finAccount.id, { status: 'active' }).success, true, 'Super Admin can activate officer');

  const createPres = await store.createOfficerBySuperAdmin({
    fullName: 'সমিতি সভাপতি',
    email: 'president@patgram.test',
    role: 'president',
    password: 'Password@123',
  });
  assertEqual(createPres.success, true, 'Super Admin can create active President account');

  console.log('4. Verifying financial engine, overdraft prevention, dual-balance & decimal accuracy...');
  // Expense on 0 balance must fail
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-ZERO-EXP',
      type: 'expense',
      fundId: 'fund-1',
      accountId: 'acc-1',
      amount: 100,
      category: 'অফিস খরচ',
      donorOrPayee: 'দোকান',
      description: 'Test zero balance expense',
      autoApprove: true,
    }).success,
    false,
    'Expense on zero balance must be rejected'
  );

  // Transfer on 0 balance must fail
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-ZERO-TRN',
      type: 'fund_transfer',
      fundId: 'fund-1',
      accountId: 'acc-1',
      toFundId: 'fund-2',
      toAccountId: 'acc-2',
      amount: 100,
      category: 'স্থানান্তর',
      donorOrPayee: 'অভ্যন্তরীণ',
      description: 'Test zero transfer',
      autoApprove: true,
    }).success,
    false,
    'Fund transfer on zero balance must be rejected'
  );

  // Pending transaction should not change balances until approved
  const pendingInc = store.addTransaction({
    voucherNo: 'V-PEND-01',
    type: 'income',
    fundId: 'fund-1',
    accountId: 'acc-1',
    amount: 500,
    category: 'চাঁদা',
    donorOrPayee: 'সদস্য ক',
    description: 'Pending income',
    autoApprove: false,
  });
  assert(pendingInc.success && pendingInc.transaction, `Pending income creation succeeds: ${pendingInc.error}`);
  assertEqual(
    store.funds.find((f) => f.id === 'fund-1')?.currentBalance,
    0,
    'Balance must stay 0 before approval'
  );

  // Reject with short reason fails, valid reason succeeds & balance remains 0
  assertEqual(store.rejectTransaction(pendingInc.transaction.id, 'no').success, false, 'Short reject reason rejected');
  assertEqual(
    store.rejectTransaction(pendingInc.transaction.id, 'তথ্য অসম্পূর্ণ ছিল').success,
    true,
    'Valid reject succeeds'
  );
  assertEqual(
    store.funds.find((f) => f.id === 'fund-1')?.currentBalance,
    0,
    'Rejected transaction must not affect balance'
  );

  // Income 1000 (approved)
  const inc1 = store.addTransaction({
    voucherNo: 'V-INC-1000',
    type: 'income',
    fundId: 'fund-1',
    accountId: 'acc-1',
    amount: 1000,
    category: 'মাসিক চাঁদা',
    donorOrPayee: 'রহিম উদ্দিন',
    description: 'Initial deposit',
    autoApprove: true,
  });
  assert(inc1.success && inc1.transaction, `Approved 1000 income must succeed: ${inc1.error}`);
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 1000, 'fund-1 = 1000');
  assertEqual(store.accounts.find((a) => a.id === 'acc-1')?.currentBalance, 1000, 'acc-1 = 1000');

  // Duplicate voucher blocked
  assertEqual(
    store.addTransaction({
      voucherNo: 'v-inc-1000',
      type: 'income',
      fundId: 'fund-1',
      accountId: 'acc-1',
      amount: 100,
      category: 'Test',
      donorOrPayee: 'Dup',
      description: 'Duplicate check',
      autoApprove: true,
    }).success,
    false,
    'Case-insensitive duplicate voucherNo must be rejected'
  );

  // Expense 300 -> 700
  const exp1 = store.addTransaction({
    voucherNo: 'V-EXP-300',
    type: 'expense',
    fundId: 'fund-1',
    accountId: 'acc-1',
    amount: 300,
    category: 'কার্যালয় ব্যয়',
    donorOrPayee: 'ভেন্ডর',
    description: 'Office expense',
    autoApprove: true,
  });
  assertEqual(exp1.success, true, 'Expense 300 must succeed');
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 700, 'fund-1 = 700');

  // Overdraft Expense 1200 -> rejected, stays 700
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-EXP-1200',
      type: 'expense',
      fundId: 'fund-1',
      accountId: 'acc-1',
      amount: 1200,
      category: 'অতিরিক্ত খরচ',
      donorOrPayee: 'ভেন্ডর',
      description: 'Overdraft test',
      autoApprove: true,
    }).success,
    false,
    'Overdraft expense 1200 must be rejected'
  );
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 700, 'Balance stays 700 after failed overdraft');

  // Transfer 200 (fund-1/acc-1 -> fund-2/acc-2)
  const trn1 = store.addTransaction({
    voucherNo: 'V-TRN-200',
    type: 'fund_transfer',
    fundId: 'fund-1',
    accountId: 'acc-1',
    toFundId: 'fund-2',
    toAccountId: 'acc-2',
    amount: 200,
    category: 'তহবিল স্থানান্তর',
    donorOrPayee: 'অভ্যন্তরীণ',
    description: 'Edu allocation',
    autoApprove: true,
  });
  assertEqual(trn1.success, true, 'Fund transfer 200 must succeed');
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 500, 'fund-1 = 500');
  assertEqual(store.funds.find((f) => f.id === 'fund-2')?.currentBalance, 200, 'fund-2 = 200');
  assertEqual(store.accounts.find((a) => a.id === 'acc-1')?.currentBalance, 500, 'acc-1 = 500');
  assertEqual(store.accounts.find((a) => a.id === 'acc-2')?.currentBalance, 200, 'acc-2 = 200');

  // Same source & dest rejected
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-TRN-SAME',
      type: 'fund_transfer',
      fundId: 'fund-1',
      accountId: 'acc-1',
      toFundId: 'fund-1',
      toAccountId: 'acc-1',
      amount: 50,
      category: 'Test',
      donorOrPayee: 'Self',
      description: 'Same src/dest',
      autoApprove: true,
    }).success,
    false,
    'Identical source and destination transfer must be rejected'
  );

  // Decimal precision check
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-DEC-1',
      type: 'income',
      fundId: 'fund-3',
      accountId: 'acc-3',
      amount: 100.15,
      category: 'অনুদান',
      donorOrPayee: 'দাতা ১',
      description: 'Float test 1',
      autoApprove: true,
    }).success,
    true,
    'Decimal income 100.15 succeeds'
  );
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-DEC-2',
      type: 'income',
      fundId: 'fund-3',
      accountId: 'acc-3',
      amount: 200.25,
      category: 'অনুদান',
      donorOrPayee: 'দাতা ২',
      description: 'Float test 2',
      autoApprove: true,
    }).success,
    true,
    'Decimal income 200.25 succeeds'
  );
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-DEC-3',
      type: 'expense',
      fundId: 'fund-3',
      accountId: 'acc-3',
      amount: 50.4,
      category: 'চিকিৎসা',
      donorOrPayee: 'রোগী',
      description: 'Float test 3',
      autoApprove: true,
    }).success,
    true,
    'Decimal expense 50.40 succeeds'
  );
  assertEqual(store.funds.find((f) => f.id === 'fund-3')?.currentBalance, 250, 'Decimal arithmetic must equal exact 250');

  // Dual balance parity check
  const midFundSum = roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0));
  const midAccSum = roundBDT(store.accounts.reduce((s, a) => s + a.currentBalance, 0));
  assertEqual(midFundSum, 950, 'Total funds must equal 950');
  assertEqual(midAccSum, 950, 'Total accounts must equal 950');

  console.log('5. Verifying Financial Correction workflow, 30,000 BDT threshold, Super Admin bypass & Overdraft Guard...');
  // Add 50,000 income first as Super Admin
  const bigInc = store.addTransaction({
    voucherNo: 'V-BIG-50K',
    type: 'income',
    fundId: 'fund-1',
    accountId: 'acc-1',
    amount: 50000,
    category: 'বিশেষ অনুদান',
    donorOrPayee: 'বড় দাতা',
    description: 'Large donation',
    autoApprove: true,
  });
  assert(bigInc.success && bigInc.transaction, `50,000 income must succeed: ${bigInc.error}`);

  // Switch to Finance Secretary login
  await store.logout();
  assertEqual((await store.loginAdminLocal('finance@patgram.test', 'Password@123')).success, true, 'Finance Sec logs in');

  // Finance sec cannot call Super Admin tools
  assertEqual(
    store.updateRolePermission('general_admin', 'can_approve_finance', true).success,
    false,
    'Finance Secretary cannot edit role permissions'
  );

  // Reason validation
  assertEqual(
    store.requestCorrection({
      originalTransactionId: inc1.transaction.id,
      correctedAmount: 1500,
      correctedCategory: inc1.transaction.category,
      correctedFundId: inc1.transaction.fundId,
      correctedAccountId: inc1.transaction.accountId,
      correctedDonorOrPayee: inc1.transaction.donorOrPayee,
      correctedDescription: inc1.transaction.description,
      correctionReason: 'ok',
    }).success,
    false,
    'Correction reason < 5 chars must be rejected'
  );

  // Overdraft correction test on fund-4 with 1000 in, 600 out => 400 left
  await store.logout();
  await store.loginAdminLocal('super@patgram.test', 'Password@123');
  const reliefInc = store.addTransaction({
    voucherNo: 'V-REL-1000',
    type: 'income',
    fundId: 'fund-4',
    accountId: 'acc-3',
    amount: 1000,
    category: 'ত্রাণ',
    donorOrPayee: 'দাতা',
    description: 'Relief in',
    autoApprove: true,
  });
  assert(reliefInc.success && reliefInc.transaction, 'Relief 1000 income ok');
  assertEqual(
    store.addTransaction({
      voucherNo: 'V-REL-EXP-600',
      type: 'expense',
      fundId: 'fund-4',
      accountId: 'acc-3',
      amount: 600,
      category: 'ত্রাণ বিতরণ',
      donorOrPayee: 'সুবিধাভোগী',
      description: 'Relief out',
      autoApprove: true,
    }).success,
    true,
    'Relief 600 expense ok'
  );
  // fund-4 now has 400. Correcting V-REL-1000 down to 200 would yield 400 - 1000 + 200 = -400 -> MUST FAIL!
  assertEqual(
    store.requestCorrection({
      originalTransactionId: reliefInc.transaction.id,
      correctedAmount: 200,
      correctedCategory: 'ত্রাণ',
      correctedFundId: 'fund-4',
      correctedAccountId: 'acc-3',
      correctedDonorOrPayee: 'দাতা',
      correctedDescription: 'Overdraft correction test',
      correctionReason: 'ভুলবশত বেশি এন্ট্রি হয়েছিল সমন্বয় করছি',
    }).success,
    false,
    'Correction causing negative balance (-400) MUST BE REJECTED'
  );
  assertEqual(store.funds.find((f) => f.id === 'fund-4')?.currentBalance, 400, 'fund-4 remains 400');

  // Now switch back to Finance Secretary to test <=30k direct vs >30k pending dual approval
  await store.logout();
  await store.loginAdminLocal('finance@patgram.test', 'Password@123');

  const smallCorr = store.requestCorrection({
    originalTransactionId: inc1.transaction.id,
    correctedAmount: 1500, // delta = 500 <= 30000
    correctedCategory: inc1.transaction.category,
    correctedFundId: inc1.transaction.fundId,
    correctedAccountId: inc1.transaction.accountId,
    correctedDonorOrPayee: inc1.transaction.donorOrPayee,
    correctedDescription: 'Updated 1500',
    correctionReason: 'রসিদ অনুযায়ী প্রকৃত আদায় ১,৫০০ টাকা',
  });
  assert(smallCorr.success && smallCorr.correction, `Small correction <=30k succeeds: ${smallCorr.error}`);
  assertEqual(smallCorr.correction.approvalStatus, 'approved', 'Delta <= 30,000 is directly approved');
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 51000, 'fund-1 updated by +500 to 51,000');

  // Large correction delta = 40,000 > 30,000
  const bigCorr = store.requestCorrection({
    originalTransactionId: bigInc.transaction.id,
    correctedAmount: 90000,
    correctedCategory: bigInc.transaction.category,
    correctedFundId: bigInc.transaction.fundId,
    correctedAccountId: bigInc.transaction.accountId,
    correctedDonorOrPayee: bigInc.transaction.donorOrPayee,
    correctedDescription: 'Updated 90k',
    correctionReason: 'ব্যাংক স্টেটমেন্ট অনুযায়ী অনুদান ৯০,০০০ টাকা ছিল',
  });
  assert(bigCorr.success && bigCorr.correction, `Large correction proposal succeeds: ${bigCorr.error}`);
  assertEqual(bigCorr.correction.requiresDualApproval, true, 'Delta > 30,000 must require dual approval');
  assertEqual(bigCorr.correction.approvalStatus, 'pending_approval', 'Large correction must stay pending_approval');
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 51000, 'Balance MUST NOT change before dual approval');

  // Duplicate pending correction on same txn blocked
  assertEqual(
    store.requestCorrection({
      originalTransactionId: bigInc.transaction.id,
      correctedAmount: 85000,
      correctedCategory: bigInc.transaction.category,
      correctedFundId: bigInc.transaction.fundId,
      correctedAccountId: bigInc.transaction.accountId,
      correctedDonorOrPayee: bigInc.transaction.donorOrPayee,
      correctedDescription: 'Dup pending',
      correctionReason: 'দ্বিতীয় সংশোধনী প্রস্তাবের চেষ্টা',
    }).success,
    false,
    'Concurrent duplicate pending correction on same transaction must be blocked'
  );

  // Even if Finance Sec had can_approve_finance enabled, self-approval must be blocked
  await store.logout();
  await store.loginAdminLocal('super@patgram.test', 'Password@123');
  store.updateRolePermission('finance_secretary', 'can_approve_finance', true);
  await store.logout();
  await store.loginAdminLocal('finance@patgram.test', 'Password@123');
  assertEqual(
    store.approveCorrection(bigCorr.correction.id).success,
    false,
    'Proposer MUST NOT be allowed to self-approve their own correction'
  );

  // Restore finance_secretary can_approve_finance = false, then approve as President
  await store.logout();
  await store.loginAdminLocal('super@patgram.test', 'Password@123');
  store.updateRolePermission('finance_secretary', 'can_approve_finance', false);
  await store.logout();
  await store.loginAdminLocal('president@patgram.test', 'Password@123');
  assertEqual(store.approveCorrection(bigCorr.correction.id, 'যাচাইকৃত').success, true, 'President approves >30k correction');
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 91000, 'fund-1 updated to 91,000 (+40k)');

  // Super Admin direct large correction (Decision 2.ক)
  await store.logout();
  await store.loginAdminLocal('super@patgram.test', 'Password@123');
  const superCorr = store.requestCorrection({
    originalTransactionId: bigInc.transaction.id,
    correctedAmount: 45000, // delta 45,000 > 30,000
    correctedCategory: bigInc.transaction.category,
    correctedFundId: bigInc.transaction.fundId,
    correctedAccountId: bigInc.transaction.accountId,
    correctedDonorOrPayee: bigInc.transaction.donorOrPayee,
    correctedDescription: 'Super admin direct fix',
    correctionReason: 'সুপার অ্যাডমিন চূড়ান্ত ব্যাংক রিকনসিলিয়েশন সমন্বয়',
  });
  assert(superCorr.success && superCorr.correction, 'Super Admin direct large correction succeeds');
  assertEqual(superCorr.correction.approvalStatus, 'approved', 'Super Admin correction is directly approved (Decision 2.ক)');
  assertEqual(store.funds.find((f) => f.id === 'fund-1')?.currentBalance, 46000, 'fund-1 = 46,000 after Super Admin correction');

  console.log('6. Verifying Sandbox Demo isolation & Real Data Snapshot restore...');
  const realTotalBeforeSandbox = roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0));
  const realTxnCountBeforeSandbox = store.transactions.length;

  assertEqual(store.loadDemoSandboxData().success, true, 'Super Admin can activate Demo Sandbox');
  assertEqual(store.isSandboxDemoActive, true, 'Sandbox flag is active');
  assertEqual(
    roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0)),
    687500,
    'Sandbox loads isolated 687,500 BDT demo dataset'
  );
  assertEqual(store.notices.length > 0, true, 'Sandbox loads sample notices');

  assertEqual(store.exitDemoSandboxData().success, true, 'Super Admin can exit Demo Sandbox');
  assertEqual(store.isSandboxDemoActive, false, 'Sandbox flag is cleared');
  assertEqual(
    roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0)),
    realTotalBeforeSandbox,
    'Real fund total restored identically after exiting sandbox'
  );
  assertEqual(store.transactions.length, realTxnCountBeforeSandbox, 'Real transactions restored identically');

  console.log('7. Verifying Backup JSON export, validation, corruption rejection & full restore...');
  const backupJson = store.exportFullBackupJSON();
  const validCheck = store.validateBackupJSON(backupJson);
  assert(validCheck.isValid && validCheck.summary?.isDualBalanceMatched, 'Exported backup passes dry-run & dual balance parity');

  // Corrupt negative balance check
  const parsedForCorrupt = JSON.parse(backupJson);
  parsedForCorrupt.data.funds[0].currentBalance = -50;
  assertEqual(
    store.validateBackupJSON(JSON.stringify(parsedForCorrupt)).isValid,
    false,
    'Backup with negative balance must fail validation'
  );

  // Corrupt duplicate voucher check
  const parsedForDup = JSON.parse(backupJson);
  if (parsedForDup.data.transactions.length >= 2) {
    parsedForDup.data.transactions[1].voucherNo = parsedForDup.data.transactions[0].voucherNo;
    assertEqual(
      store.validateBackupJSON(JSON.stringify(parsedForDup)).isValid,
      false,
      'Backup with duplicate voucherNo must fail validation'
    );
  }

  // Clean reset & restore check
  assertEqual(store.resetToCleanProduction().success, true, 'Clean production reset succeeds');
  assertEqual(
    roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0)),
    0,
    'Clean production reset clears all balances to 0'
  );
  assertEqual(store.transactions.length, 0, 'Clean production reset clears transactions');

  assertEqual(store.restoreFromBackupJSON(backupJson).success, true, 'Restore from valid backup JSON succeeds');
  assertEqual(
    roundBDT(store.funds.reduce((s, f) => s + f.currentBalance, 0)),
    realTotalBeforeSandbox,
    'Restored fund sum matches pre-reset real balance exactly'
  );
  assertEqual(
    roundBDT(store.accounts.reduce((s, a) => s + a.currentBalance, 0)),
    realTotalBeforeSandbox,
    'Restored account sum matches pre-reset real balance exactly'
  );

  console.log('\nALL AUDIT & FINANCIAL INTEGRITY TESTS PASSED SUCCESSFULLY!');
}

runAuditTests().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
