/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { useAppStore } from '../db/store.ts';
import { Users, Lock } from 'lucide-react';

export const CommitteeView: React.FC = () => {
  const store = useAppStore();
  const centralTerms = store.committees.filter((c) => c.wing === 'central');
  const [selectedTermId, setSelectedTermId] = useState<string>(
    centralTerms.find((c) => c.isCurrent)?.id || centralTerms[0]?.id || ''
  );

  useEffect(() => {
    if (!centralTerms.some((c) => c.id === selectedTermId)) {
      setSelectedTermId(centralTerms.find((c) => c.isCurrent)?.id || centralTerms[0]?.id || '');
    }
  }, [centralTerms, selectedTermId]);

  const selectedTerm = centralTerms.find((c) => c.id === selectedTermId);

  // Privacy enforcement: filter only published positions & never render phone/personal contact
  const publishedPositions = (selectedTerm?.positions || []).filter((pos) => pos.isPublished);

  return (
    <div className="py-16 bg-white min-h-[70vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="max-w-3xl mb-10">
          <div className="text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-2">
            সাংগঠনিক নেতৃত্ব ও ইতিহাস
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            কার্যকরী পরিষদ ও বিগত কমিটির আর্কাইভ
          </h2>
          <p className="mt-2 text-stone-600 text-sm leading-relaxed">
            সংগঠনের ২০০৯ সালের প্রতিষ্ঠাকালীন আহ্বায়ক কমিটি থেকে শুরু করে বর্তমান কার্যকরী পরিষদ পর্যন্ত অনুমোদিত ও প্রকাশিত দায়িত্বপ্রাপ্ত নেতৃবৃন্দের তথ্য এখানে সংরক্ষিত থাকে।
          </p>
        </div>

        {/* Data Privacy Badge Notice */}
        <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs mb-8 flex items-start gap-3">
          <Lock className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">সদস্য তথ্যের গোপনীয়তা সুরক্ষা নীতি:</span> সাধারণ ও ছাত্র সদস্যদের ব্যক্তিগত তথ্য এবং কমিটির সদস্যদের মোবাইল নম্বর ও ব্যক্তিগত ঠিকানা পাবলিক ওয়েবসাইটে প্রকাশ করা হয় না। কেবল অ্যাডমিন কর্তৃক অনুমোদিত নাম, পদবি ও ছবি প্রদর্শিত হয়।
          </div>
        </div>

        {/* Committee Term Switcher Tabs */}
        {centralTerms.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-8 pb-4 border-b border-stone-200">
            {centralTerms.map((term) => (
              <button
                key={term.id}
                onClick={() => setSelectedTermId(term.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 ${
                  selectedTermId === term.id
                    ? 'bg-emerald-800 text-white shadow-sm'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                <span>{term.title}</span>
                {term.isCurrent && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                    বর্তমান পরিষদ
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Committee Members Grid */}
        {selectedTerm ? (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-stone-900">{selectedTerm.title}</h3>
                <p className="text-xs text-stone-500">
                  কার্যকাল: {selectedTerm.startYear} - {selectedTerm.endYear}
                </p>
              </div>
              <div className="text-xs text-stone-500">
                প্রকাশিত পদসংখ্যা: <strong className="text-stone-900">{publishedPositions.length}</strong>
              </div>
            </div>

            {publishedPositions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {publishedPositions.map((pos) => (
                  <div
                    key={pos.id}
                    className="bg-white rounded-xl border border-stone-200 overflow-hidden hover:border-emerald-600/40 hover:shadow-md transition-all p-5 flex flex-col items-center text-center group"
                  >
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-100 to-stone-200 border-2 border-emerald-700/20 flex items-center justify-center text-emerald-800 font-bold text-xl mb-4 group-hover:scale-105 transition-transform overflow-hidden">
                      {pos.photoUrl ? (
                        <img
                          src={pos.photoUrl}
                          alt={pos.memberNameBn}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <span>{pos.memberNameBn.substring(0, 2)}</span>
                      )}
                    </div>

                    <div className="inline-block px-3 py-1 rounded-md bg-emerald-50 text-emerald-800 text-xs font-bold mb-2 border border-emerald-100">
                      {pos.title}
                    </div>

                    <h4 className="text-base font-bold text-stone-900 mb-1 leading-snug">
                      {pos.memberNameBn}
                    </h4>

                    <div className="text-[11px] text-stone-400 mt-1">
                      পাটগ্রাম কল্যাণ সমিতি, রংপুর
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-300">
                <Users className="w-10 h-10 text-stone-400 mx-auto mb-3" />
                <h4 className="text-sm font-semibold text-stone-700">
                  এই কমিটির পদবির তথ্য এখনো পাবলিক সাইটে প্রকাশিত করা হয়নি
                </h4>
                <p className="text-xs text-stone-500 mt-1">
                  অ্যাডমিন প্যানেল থেকে দায়িত্বপ্রাপ্ত প্রশাসক অনুমোদন দিলে এখানে নাম ও ছবি প্রদর্শিত হবে।
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-12 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-300">
            <Users className="w-10 h-10 text-stone-400 mx-auto mb-3" />
            <h4 className="text-sm font-semibold text-stone-700">
              কার্যকরী পরিষদের তালিকা এখনো প্রকাশিত হয়নি
            </h4>
            <p className="text-xs text-stone-500 mt-1">
              অ্যাডমিন প্যানেল থেকে নতুন কমিটি যুক্ত ও অনুমোদন করা হলে এখানে প্রদর্শিত হবে।
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
