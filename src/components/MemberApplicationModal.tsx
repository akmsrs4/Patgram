/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from '../db/store.ts';
import { X, UserPlus, CheckCircle, GraduationCap, ShieldCheck, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { MemberType } from '../types.ts';

interface MemberApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MemberApplicationModal: React.FC<MemberApplicationModalProps> = ({ isOpen, onClose }) => {
  const store = useAppStore();

  const [memberType, setMemberType] = useState<MemberType>('general');
  const [fullNameBn, setFullNameBn] = useState('');
  const [fullNameEn, setFullNameEn] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bloodGroup, setBloodGroup] = useState('A+');
  const [patgramVillage, setPatgramVillage] = useState('');
  const [patgramUnion, setPatgramUnion] = useState('');
  const [patgramWard, setPatgramWard] = useState('');
  const [rangpurArea, setRangpurArea] = useState('');
  const [rangpurThana, setRangpurThana] = useState('কোতোয়ালী');
  const [profession, setProfession] = useState('');
  const [institution, setInstitution] = useState('');
  const [department, setDepartment] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullNameBn.trim() || !phone.trim() || !patgramVillage.trim() || !rangpurArea.trim()) {
      setError('অনুগ্রহ করে নাম, মোবাইল নম্বর, পাটগ্রামের ঠিকানা ও রংপুরের ঠিকানা পূরণ করুন।');
      return;
    }

    const res = store.addMemberApplication({
      type: memberType,
      fullNameBn: fullNameBn.trim(),
      fullNameEn: fullNameEn.trim() || fullNameBn.trim(),
      phone: phone.trim(),
      email: email.trim(),
      bloodGroup,
      patgramAddress: {
        village: patgramVillage.trim(),
        union: patgramUnion.trim() || 'পাটগ্রাম',
        ward: patgramWard.trim(),
      },
      rangpurAddress: {
        area: rangpurArea.trim(),
        thana: rangpurThana,
      },
      professionOrDesignation: memberType === 'general' ? profession.trim() : undefined,
      institution: memberType === 'student' ? institution.trim() : undefined,
      department: memberType === 'student' ? department.trim() : undefined,
      academicYear: memberType === 'student' ? academicYear.trim() : undefined,
    });

    if (res.success) {
      setSubmittedId(res.membershipId);
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Safe fallback
      }
    }
  };

  const handleReset = () => {
    setSubmittedId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl my-8">
        {submittedId ? (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900">
              সদস্যপদ আবেদন সফলভাবে গৃহীত হয়েছে!
            </h3>
            <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto">
              আপনার প্রাথমিক আবেদনটি পর্যালোচনা ও অনুমোদনের জন্য কেন্দ্রীয় অ্যাডমিন প্যানেলে প্রেরিত হয়েছে। আপনার ট্র্যাকিং রেফারেন্স আইডি:
            </p>
            <div className="inline-block p-3 bg-emerald-50 text-emerald-900 font-mono font-bold text-base rounded-xl border border-emerald-200">
              {submittedId}
            </div>
            <p className="text-xs text-stone-500">
              আপনার প্রদত্ত ফোন নম্বরে পরবর্তীতে অনুমোদনের বিষয়টি জানানো হবে।
            </p>
            <div className="pt-4">
              <button
                onClick={handleReset}
                className="px-6 py-2.5 rounded-xl bg-emerald-800 text-white font-semibold text-sm hover:bg-emerald-700 transition-all cursor-pointer"
              >
                ঠিক আছে (বন্ধ করুন)
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-stone-100 mb-6">
              <div>
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md mb-2">
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>ডিজিটাল সদস্যপদ ফর্ম</span>
                </div>
                <h3 className="text-xl font-bold text-stone-900">
                  পাটগ্রাম কল্যাণ সমিতি, রংপুর — সদস্য হওয়ার আবেদন
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs mb-5 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Member Type Selection */}
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-2">
                  সদস্যপদের ধরন নির্বাচন করুন:
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setMemberType('general')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      memberType === 'general'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div className="font-bold text-sm text-stone-900">সাধারণ সদস্য</div>
                    <div className="text-[11px] text-stone-500">
                      রংপুরে বসবাসকারী পাটগ্রামের চাকরিজীবী, ব্যবসায়ী বা স্থায়ী অধিবাসী (আজীবন)।
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMemberType('student')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      memberType === 'student'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-600/20'
                        : 'border-stone-200 hover:bg-stone-50'
                    }`}
                  >
                    <div className="font-bold text-sm text-stone-900 flex items-center gap-1">
                      <span>ছাত্র সদস্য</span>
                      <GraduationCap className="w-4 h-4 text-emerald-700" />
                    </div>
                    <div className="text-[11px] text-stone-500">
                      রংপুরের বিভিন্ন প্রতিষ্ঠানে অধ্যয়নরত পাটগ্রামের শিক্ষার্থী।
                    </div>
                  </button>
                </div>
              </div>

              {/* Personal Information */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    পূর্ণ নাম (বাংলায়) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="উদা: মো. রফিকুল ইসলাম"
                    value={fullNameBn}
                    onChange={(e) => setFullNameBn(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Full Name (English)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Md. Rofiqul Islam"
                    value={fullNameEn}
                    onChange={(e) => setFullNameEn(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    মোবাইল নম্বর *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="০১৭১১..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    ইমেইল (যদি থাকে)
                  </label>
                  <input
                    type="email"
                    placeholder="example@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    রক্তের গ্রুপ
                  </label>
                  <select
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600 bg-white"
                  >
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Student specific fields */}
              {memberType === 'student' ? (
                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-3">
                  <div className="text-xs font-bold text-emerald-900">শিক্ষাগত তথ্য:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] text-stone-600 mb-1">শিক্ষা প্রতিষ্ঠান</label>
                      <input
                        type="text"
                        placeholder="উদা: বেরোবি / কারমাইকেল"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-stone-600 mb-1">বিভাগ / বিষয়</label>
                      <input
                        type="text"
                        placeholder="উদা: বাংলা / রসায়ন"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-stone-600 mb-1">বর্ষ / সেমিস্টার</label>
                      <input
                        type="text"
                        placeholder="উদা: ৩য় বর্ষ"
                        value={academicYear}
                        onChange={(e) => setAcademicYear(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    পেশা ও পদবি (সাধারণ সদস্যদের জন্য)
                  </label>
                  <input
                    type="text"
                    placeholder="উদা: সহকারী শিক্ষক, রংপুর সরকারি উচ্চ বিদ্যালয়"
                    value={profession}
                    onChange={(e) => setProfession(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg focus:outline-none focus:border-emerald-600"
                  />
                </div>
              )}

              {/* Addresses */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <div className="text-xs font-bold text-stone-800">পাটগ্রাম উপজেলার স্থায়ী ঠিকানা *</div>
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="গ্রামের নাম *"
                      value={patgramVillage}
                      onChange={(e) => setPatgramVillage(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md mb-2"
                    />
                    <input
                      type="text"
                      placeholder="ইউনিয়ন / পৌরসভা"
                      value={patgramUnion}
                      onChange={(e) => setPatgramUnion(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md"
                    />
                  </div>
                </div>

                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                  <div className="text-xs font-bold text-stone-800">রংপুর মহানগরীর বর্তমান ঠিকানা *</div>
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="এলাকা / মহল্লা (উদা: ধাপ ইঞ্জিনিয়ার্স পাড়া) *"
                      value={rangpurArea}
                      onChange={(e) => setRangpurArea(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md mb-2"
                    />
                    <select
                      value={rangpurThana}
                      onChange={(e) => setRangpurThana(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-stone-300 rounded-md"
                    >
                      <option value="কোতোয়ালী">কোতোয়ালী থানা</option>
                      <option value="তাজহাট">তাজহাট থানা</option>
                      <option value="হারাগাছ">হারাগাছ থানা</option>
                      <option value="মাহিগঞ্জ">মাহিগঞ্জ থানা</option>
                      <option value="পরশুরাম">পরশুরাম থানা</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-lg cursor-pointer"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-800 hover:bg-emerald-700 rounded-xl shadow transition-all cursor-pointer flex items-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>আবেদনপত্র জমা দিন</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
