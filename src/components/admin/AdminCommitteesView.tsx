/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import {
  Shield,
  PlusCircle,
  Eye,
  EyeOff,
  Lock,
  Archive,
  Printer,
} from 'lucide-react';

export const AdminCommitteesView: React.FC = () => {
  const store = useAppStore();
  const permissions = store.rolePermissions[store.currentRole] || {};

  const [selectedTermId, setSelectedTermId] = useState<string>(
    store.committees[0]?.id || ''
  );

  useEffect(() => {
    if (!store.committees.some((c) => c.id === selectedTermId)) {
      setSelectedTermId(store.committees[0]?.id || '');
    }
  }, [store.committees, selectedTermId]);

  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [showAddTermModal, setShowAddTermModal] = useState(false);

  // New Position Form State (Privacy default: unpublished until admin toggles)
  const [posTitle, setPosTitle] = useState('');
  const [posMemberName, setPosMemberName] = useState('');
  const [posPhone, setPosPhone] = useState('');
  const [posPriority, setPosPriority] = useState(10);
  const [posIsPublished, setPosIsPublished] = useState(false);

  // New Term Form State
  const [termTitle, setTermTitle] = useState('');
  const [termWing, setTermWing] = useState<'central' | 'student_wing' | 'advisory'>('central');
  const [termStartYear, setTermStartYear] = useState(new Date().getFullYear());
  const [termEndYear, setTermEndYear] = useState(new Date().getFullYear() + 2);
  const [termIsCurrent, setTermIsCurrent] = useState(true);

  if (!permissions.can_manage_committees) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
        <Lock className="w-12 h-12 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-stone-900">কমিটি প্রশাসন সুরক্ষিত</h3>
        <p className="text-xs text-stone-500">আপনার বর্তমান রোলের জন্য কমিটি পরিচালনার অনুমতি নেই।</p>
      </div>
    );
  }

  const selectedTerm = store.committees.find((c) => c.id === selectedTermId);

  const handleAddPositionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!posTitle.trim() || !posMemberName.trim()) return;

    store.addCommitteePosition(selectedTermId, {
      title: posTitle.trim(),
      memberNameBn: posMemberName.trim(),
      phone: posPhone.trim(),
      priority: Number(posPriority),
      isPublished: posIsPublished,
    });

    setShowAddPositionModal(false);
    setPosTitle('');
    setPosMemberName('');
    setPosPhone('');
    setPosIsPublished(false);
  };

  const handleAddTermSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termTitle.trim()) return;

    const res = store.addCommitteeTerm({
      title: termTitle.trim(),
      wing: termWing,
      startYear: Number(termStartYear),
      endYear: Number(termEndYear),
      isCurrent: termIsCurrent,
      positions: [],
    });

    if (res.term) {
      setSelectedTermId(res.term.id);
    }
    setShowAddTermModal(false);
    setTermTitle('');
  };

  return (
    <div className="space-y-6">
      {selectedTerm && (
        <div className="print-only border-b-2 border-stone-800 pb-3 mb-4 text-center">
          <h1 className="text-xl font-bold text-stone-900">{store.settings.organizationNameBn}</h1>
          <p className="text-xs text-stone-600">
            {selectedTerm.title} ({selectedTerm.startYear}–{selectedTerm.endYear}) — কর্মকর্তা ও পদবি তালিকা | তারিখ:{' '}
            {new Date().toISOString().substring(0, 10)}
          </p>
        </div>
      )}

      {/* Top Banner */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-emerald-700" />
            <span>কমিটি ও কার্যকরী পরিষদ প্রশাসন</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            নতুন কমিটি তৈরি, পদবি সংযোজন এবং পাবলিক সাইটে নাম-ছবি প্রকাশের নো-কোড টগল ব্যবস্থাপনা।
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedTerm && (
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs shadow flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-amber-300" />
              <span>কমিটি তালিকা PDF</span>
            </button>
          )}
          <button
            onClick={() => setShowAddTermModal(true)}
            className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow flex items-center gap-1.5 cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>+ নতুন কমিটি তৈরি</span>
          </button>
        </div>
      </div>

      {/* Term Selector Strip */}
      <div className="no-print flex flex-wrap items-center gap-2 bg-white p-3 rounded-2xl border border-stone-200">
        <span className="text-xs font-semibold text-stone-500 mr-2">কমিটি নির্বাচন:</span>
        {store.committees.map((term) => (
          <button
            key={term.id}
            onClick={() => setSelectedTermId(term.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedTermId === term.id
                ? 'bg-emerald-800 text-white shadow-sm'
                : 'bg-stone-50 text-stone-700 hover:bg-stone-100'
            }`}
          >
            <span>{term.title}</span>
            {term.isCurrent && (
              <span className="px-1.5 py-0.2 bg-emerald-600 text-white text-[9px] font-bold rounded">
                সক্রিয়
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Active Committee Details */}
      {selectedTerm ? (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-stone-900">{selectedTerm.title}</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-stone-100 text-stone-700">
                  {selectedTerm.wing === 'central'
                    ? 'মূল কার্যকরী পরিষদ'
                    : selectedTerm.wing === 'student_wing'
                    ? 'পাটগ্রাম ছাত্র কল্যাণ সমিতি'
                    : 'উপদেষ্টা পরিষদ'}
                </span>
                {selectedTerm.isCurrent ? (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                    বর্তমান সক্রিয় মেয়াদ
                  </span>
                ) : (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 font-bold flex items-center gap-1">
                    <Archive className="w-3 h-3" /> আর্কাইভকৃত ইতিহাস
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-1">
                মেয়াদকাল: {selectedTerm.startYear} - {selectedTerm.endYear} · মোট পদবি: {selectedTerm.positions.length}টি
              </p>
            </div>

            <button
              onClick={() => setShowAddPositionModal(true)}
              className="no-print px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs border border-emerald-200 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-700" />
              <span>+ নতুন পদ যুক্ত করুন</span>
            </button>
          </div>

          {/* Positions Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-stone-50 text-stone-600 font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">পদমর্যাদা (ক্রম)</th>
                  <th className="py-3 px-4">পদবির নাম</th>
                  <th className="py-3 px-4">দায়িত্বপ্রাপ্ত কর্মকর্তার নাম</th>
                  <th className="py-3 px-4">ফোন নম্বর</th>
                  <th className="py-3 px-4 text-center">পাবলিক ডিসপ্লে স্থিতি</th>
                  <th className="py-3 px-4 text-center no-print">টগল অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {selectedTerm.positions.map((pos) => (
                  <tr key={pos.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono text-stone-500">{pos.priority}</td>
                    <td className="py-3 px-4 font-bold text-stone-900">{pos.title}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-900">{pos.memberNameBn}</td>
                    <td className="py-3 px-4 font-mono text-stone-600">{pos.phone || '-'}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          pos.isPublished
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {pos.isPublished ? 'পাবলিকে প্রদর্শিত' : 'অপ্রকাশিত / গোপন'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center no-print">
                      <button
                        onClick={() => store.togglePositionVisibility(selectedTerm.id, pos.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 mx-auto transition-all cursor-pointer ${
                          pos.isPublished
                            ? 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                            : 'bg-emerald-800 text-white hover:bg-emerald-700'
                        }`}
                      >
                        {pos.isPublished ? (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            <span>লুকান</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            <span>প্রকাশ করুন</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center text-stone-500">কোনো কমিটি পাওয়া যায়নি।</div>
      )}

      {/* Add Position Modal */}
      {showAddPositionModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-900 mb-4">কমিটিতে নতুন পদবি ও সদস্য যুক্ত করুন</h3>
            <form onSubmit={handleAddPositionSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">পদবির নাম *</label>
                <input
                  type="text"
                  required
                  placeholder="উদা: প্রচার সম্পাদক / উপ-কোষাধ্যক্ষ"
                  value={posTitle}
                  onChange={(e) => setPosTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">দায়িত্বপ্রাপ্তের নাম *</label>
                <input
                  type="text"
                  required
                  placeholder="উদা: মো. তারিকুল ইসলাম"
                  value={posMemberName}
                  onChange={(e) => setPosMemberName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">ফোন নম্বর</label>
                <input
                  type="tel"
                  placeholder="০১৭১১..."
                  value={posPhone}
                  onChange={(e) => setPosPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">ক্রম নম্বর (Priority)</label>
                <input
                  type="number"
                  min="1"
                  value={posPriority}
                  onChange={(e) => setPosPriority(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="posPublish"
                  checked={posIsPublished}
                  onChange={(e) => setPosIsPublished(e.target.checked)}
                  className="rounded text-emerald-800"
                />
                <label htmlFor="posPublish" className="text-xs text-stone-700 cursor-pointer">
                  পাবলিক ওয়েবসাইটে নাম ও পদবি প্রকাশ করুন
                </label>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddPositionModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 text-white rounded-lg text-xs font-bold"
                >
                  পদবি সংরক্ষণ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Term Modal */}
      {showAddTermModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-base font-bold text-stone-900 mb-4">নতুন কমিটি বা পরিষদ তৈরি করুন</h3>
            <form onSubmit={handleAddTermSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">কমিটির শিরোনাম *</label>
                <input
                  type="text"
                  required
                  placeholder="উদা: কার্যকরী পরিষদ (২০২৭-২০২৯)"
                  value={termTitle}
                  onChange={(e) => setTermTitle(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">উইং / শাখা</label>
                <select
                  value={termWing}
                  onChange={(e) => setTermWing(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg bg-white"
                >
                  <option value="central">মূল কার্যকরী পরিষদ (পাটগ্রাম কল্যাণ সমিতি)</option>
                  <option value="student_wing">পাটগ্রাম ছাত্র কল্যাণ সমিতি, রংপুর</option>
                  <option value="advisory">উপদেষ্টা পরিষদ</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">শুরুর সাল</label>
                  <input
                    type="number"
                    value={termStartYear}
                    onChange={(e) => setTermStartYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">শেষের সাল</label>
                  <input
                    type="number"
                    value={termEndYear}
                    onChange={(e) => setTermEndYear(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="termCurrent"
                  checked={termIsCurrent}
                  onChange={(e) => setTermIsCurrent(e.target.checked)}
                  className="rounded text-emerald-800"
                />
                <label htmlFor="termCurrent" className="text-xs text-stone-700 cursor-pointer">
                  এটিকে বর্তমান সক্রিয় পরিষদ হিসেবে নির্ধারণ করুন (পূর্বেরটি স্বয়ংক্রিয়ভাবে আর্কাইভে সংরক্ষিত থাকবে)
                </label>
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddTermModal(false)}
                  className="px-3 py-1.5 text-xs text-stone-600"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-800 text-white rounded-lg text-xs font-bold"
                >
                  কমিটি তৈরি করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
