/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAppStore } from '../../db/store.ts';
import { Settings, Save, CheckCircle2, Lock, ExternalLink } from 'lucide-react';
import { SystemSettings } from '../../types.ts';

export const AdminSettingsView: React.FC = () => {
  const store = useAppStore();
  const permissions = store.rolePermissions[store.currentRole] || {};

  const [formData, setFormData] = useState<SystemSettings>({ ...store.settings });
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!permissions.can_manage_settings && store.currentRole !== 'super_admin') {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-stone-200">
        <Lock className="w-12 h-12 text-stone-400 mx-auto mb-3" />
        <h3 className="text-base font-bold text-stone-900">সিস্টেম সেটিংস সংরক্ষিত</h3>
        <p className="text-xs text-stone-500">শুধুমাত্র সুপার অ্যাডমিনের জন্য সিস্টেম সেটিংস পরিবর্তনের অনুমতি রয়েছে।</p>
      </div>
    );
  }

  const handleChange = (key: keyof SystemSettings, val: any) => {
    setFormData((prev) => ({ ...prev, [key]: val }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    store.updateSettings(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-700" />
            <span>সিস্টেম সেটিংস ও যোগাযোগের নো-কোড কনফিগারেশন</span>
          </h2>
          <p className="text-xs text-stone-500 mt-1">
            কোনো কোডিং ছাড়াই ফোন নম্বর, ঠিকানা, হোয়াটসঅ্যাপ মেসেজ ও পার্টনার ব্রান্ডিং পরিবর্তন করুন।
          </p>
        </div>

        {savedSuccess && (
          <div className="px-4 py-2 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>সেটিংস সফলভাবে সংরক্ষিত হয়েছে!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-stone-200 shadow-sm space-y-6">
        {/* Section 1: Basic Organization Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-stone-900 pb-2 border-b border-stone-100">
            সংগঠনের প্রাথমিক তথ্য
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                সংগঠনের নাম (বাংলা)
              </label>
              <input
                type="text"
                value={formData.organizationNameBn}
                onChange={(e) => handleChange('organizationNameBn', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Organization Name (English)
              </label>
              <input
                type="text"
                value={formData.organizationNameEn}
                onChange={(e) => handleChange('organizationNameEn', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">প্রতিষ্ঠাকাল (সাল)</label>
              <input
                type="number"
                value={formData.establishedYear}
                onChange={(e) => handleChange('establishedYear', Number(e.target.value))}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">মূল স্লোগান</label>
              <input
                type="text"
                value={formData.sloganBn}
                onChange={(e) => handleChange('sloganBn', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Contact & Hotlines */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-stone-900 pb-2 border-b border-stone-100">
            অফিস ও হটলাইন যোগাযোগ
          </h3>
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">কার্যালয়ের ঠিকানা</label>
            <input
              type="text"
              value={formData.officeAddress}
              onChange={(e) => handleChange('officeAddress', e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">হটলাইন ১ (মোবাইল)</label>
              <input
                type="text"
                value={formData.hotline1}
                onChange={(e) => handleChange('hotline1', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">হটলাইন ২</label>
              <input
                type="text"
                value={formData.hotline2}
                onChange={(e) => handleChange('hotline2', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">অফিসিয়াল ইমেইল</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Section 3: WhatsApp Instant Chat Configuration */}
        <div className="space-y-4 p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200">
          <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
            <span>হোয়াটসঅ্যাপ চ্যাট লিংক ও প্রি-ফিল্ড মেসেজ</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-emerald-900 mb-1">
                হোয়াটসঅ্যাপ নম্বর (আন্তর্জাতিক কোডসহ, যেমন: 8801603526000)
              </label>
              <input
                type="text"
                value={formData.whatsappNumber}
                onChange={(e) => handleChange('whatsappNumber', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-emerald-300 rounded-lg font-mono bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-emerald-900 mb-1">
                চ্যাট বক্সে স্বয়ংক্রিয় রেডিমেড মেসেজ
              </label>
              <input
                type="text"
                value={formData.whatsappPrefilledMessage}
                onChange={(e) => handleChange('whatsappPrefilledMessage', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-emerald-300 rounded-lg bg-white"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Technical Collaboration & Partner Branding */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-stone-900 pb-2 border-b border-stone-100">
            কারিগরি সহযোগিতা ও ব্র্যান্ডিং লিংক (Rangpur247 & NextBD)
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                কারিগরি পার্টনার টেক্সট
              </label>
              <input
                type="text"
                value={formData.technicalPartnerName}
                onChange={(e) => handleChange('technicalPartnerName', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Rangpur247 পোর্টাল লিংক
              </label>
              <input
                type="url"
                value={formData.technicalPartnerUrl}
                onChange={(e) => handleChange('technicalPartnerUrl', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">NextBD লিংক</label>
              <input
                type="url"
                value={formData.nextBdUrl}
                onChange={(e) => handleChange('nextBdUrl', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Facebook Page লিংক</label>
              <input
                type="url"
                value={formData.facebookPageUrl}
                onChange={(e) => handleChange('facebookPageUrl', e.target.value)}
                className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">কপিরাইট নোটিস</label>
            <input
              type="text"
              value={formData.copyrightNotice}
              onChange={(e) => handleChange('copyrightNotice', e.target.value)}
              className="w-full px-3 py-2 text-xs border border-stone-300 rounded-lg"
            />
          </div>
        </div>

        {/* Section 5: Financial Correction Policy Threshold */}
        <div className="space-y-4 p-5 rounded-2xl bg-amber-50/50 border border-amber-200">
          <h3 className="text-sm font-bold text-amber-950">
            আর্থিক সংশোধন অনুমোদন নীতি সীমা
          </h3>
          <div>
            <label className="block text-xs font-semibold text-amber-900 mb-1">
              দ্বৈত অনুমোদন ট্রিগার করার আর্থিক সীমা (টাকায়)
            </label>
            <input
              type="number"
              value={formData.correctionThresholdAmount}
              onChange={(e) => handleChange('correctionThresholdAmount', Number(e.target.value))}
              className="w-full max-w-xs px-3 py-2 text-xs border border-amber-300 rounded-lg font-mono font-bold bg-white"
            />
            <p className="text-[11px] text-amber-800 mt-1">
              যেকোনো আর্থিক এন্ট্রির মূল বা সংশোধিত অঙ্ক এই পরিমাণের (বর্তমানে ৳{formData.correctionThresholdAmount?.toLocaleString()}) বেশি হলে সভাপতি/সাধারণ সম্পাদক/অন্য কর্মকর্তার অনুমোদন বাধ্যতামূলক।
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-stone-100 flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow flex items-center gap-2 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>পরিবর্তন সংরক্ষণ করুন</span>
          </button>
        </div>
      </form>
    </div>
  );
};
