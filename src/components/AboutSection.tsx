/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAppStore } from '../db/store.ts';
import { Landmark, Compass, Award, BookOpen, Layers, CheckCircle2 } from 'lucide-react';

export const AboutSection: React.FC = () => {
  const store = useAppStore();
  const settings = store.settings;

  const objectives = [
    {
      title: 'ঐক্য ও ভ্রাতৃত্ববোধ সৃষ্টি',
      desc: 'রংপুর মহানগরীতে বসবাসরত, কর্মরত এবং অধ্যয়নরত পাটগ্রাম উপজেলার মানুষের মধ্যে পারস্পরিক যোগাযোগ, সৌহার্দ্য ও ভ্রাতৃত্ব স্থাপন।',
    },
    {
      title: 'দরিদ্র ও সুবিধাবঞ্চিতদের কল্যাণ',
      desc: 'পাটগ্রাম উপজেলার প্রত্যন্ত এলাকার অসহায়, সুবিধাবঞ্চিত ও দুস্থ পরিবারের পাশে দাঁড়ানো এবং তাদের জীবনমান উন্নয়নে কাজ করা।',
    },
    {
      title: 'শিক্ষা সহায়তা ও মেধা বিকাশ',
      desc: 'দরিদ্র ও মেধাবী শিক্ষার্থীদের উপবৃত্তি, বই-পুস্তক, উচ্চশিক্ষা ও ভর্তি পরীক্ষায় গাইডলাইন প্রদান এবং নিয়মিত সম্মাননা প্রদান।',
    },
    {
      title: 'জরুরি স্বাস্থ্য ও মানবিক ত্রাণ',
      desc: 'গুরুতর অসুস্থ রোগীদের চিকিৎসা সহায়তা, রক্তদান নেটওয়ার্ক এবং বন্যা বা প্রাকৃতিক দুর্যোগকালীন তাৎক্ষণিক ত্রাণ তৎপরতা।',
    },
    {
      title: 'তরুণ ও শিক্ষার্থীদের দিকনির্দেশনা',
      desc: 'পাটগ্রামের নতুন প্রজন্মের শিক্ষার্থীদের ক্যারিয়ার ও দক্ষতা উন্নয়নে পাটগ্রাম ছাত্র কল্যাণ সমিতির মাধ্যমে বিশেষ সেমিনার আয়োজন।',
    },
    {
      title: 'ডিজিটাল ও স্বচ্ছ সাংগঠনিক ব্যবস্থাপনা',
      desc: 'সংগঠনের সদস্যপদ, প্রতিটি আর্থিক তহবিল এবং কার্যবিবরণীকে আধুনিক প্রযুক্তির মাধ্যমে সম্পূর্ণ স্বচ্ছ ও জবাবদিহিতামূলক করা।',
    },
  ];

  return (
    <div className="py-16 bg-stone-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-12">
          <div className="text-xs font-semibold text-emerald-800 tracking-wider uppercase mb-2">
            পরিচিতি ও পটভূমি
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
            ঐতিহ্যবাহী সূচনা থেকে আধুনিক ডিজিটাল রূপান্তর
          </h2>
          <p className="mt-3 text-stone-600 text-sm sm:text-base leading-relaxed">
            পাটগ্রাম কল্যাণ সমিতি, রংপুর কোনো সাধারণ সংগঠন নয়—এটি রংপুর বিভাগে পাটগ্রামবাসীর আত্মিক বন্ধন ও পারস্পরিক সহযোগিতার বিশ্বস্ত ঠিকানা।
          </p>
        </div>

        {/* 2009 Founding Story Box */}
        <div className="bg-white rounded-2xl border border-stone-200 p-8 sm:p-10 mb-12 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0 border border-emerald-200">
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-stone-900 mb-2">
                প্রতিষ্ঠাকাল ২০০৯ ও পুনর্গঠনের ঐতিহাসিক প্রেক্ষাপট
              </h3>
              <p className="text-sm text-stone-600 leading-relaxed mb-4">
                ২০০৯ সালে রংপুর মহানগরীতে বসবাসকারী পাটগ্রামের প্রবীণ মুরব্বী, সরকারি-বেসরকারি কর্মকর্তা, শিক্ষক, আইনজীবী এবং সচেতন নাগরিকদের ঐকান্তিক প্রচেষ্টায় <strong>“পাটগ্রাম কল্যাণ সমিতি, রংপুর”</strong> আনুষ্ঠানিকভাবে প্রতিষ্ঠা লাভ করে।
              </p>
              <p className="text-sm text-stone-600 leading-relaxed mb-4">
                প্রতিষ্ঠার পর কিছু সময় সাংগঠনিক কার্যক্রম কিছুটা স্থবির ছিল। পরবর্তীতে ২০২৬ সালে সকল ভেদাভেদ ভুলে সংগঠনটিকে পুনর্গঠন, সম্প্রসারণ ও আধুনিক প্রযুক্তির ছোঁয়ায় পূর্ণাঙ্গ ডিজিটাল ব্যবস্থাপনার আওতায় নিয়ে আসার যুগান্তকারী উদ্যোগ গ্রহণ করা হয়।
              </p>
              <div className="flex flex-wrap gap-3 pt-2 text-xs">
                <span className="px-3 py-1 bg-stone-100 text-stone-700 rounded-md font-medium border border-stone-200">
                  মূল নীতি: মানবকল্যাণ ও আঞ্চলিক সংহতি
                </span>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-800 rounded-md font-medium border border-emerald-200">
                  স্বতন্ত্র ছাত্র উইং: পাটগ্রাম ছাত্র কল্যাণ সমিতি
                </span>
                <span className="px-3 py-1 bg-amber-50 text-amber-800 rounded-md font-medium border border-amber-200">
                  গঠনতন্ত্র: পরিবর্তনযোগ্য ও কনফিগারেশন নির্ভর
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Objectives Grid */}
        <div className="mb-14">
          <h3 className="text-2xl font-bold text-stone-900 mb-6 flex items-center gap-2">
            <Compass className="w-6 h-6 text-emerald-700" />
            <span>সংগঠনের মূল লক্ষ্য ও উদ্দেশ্যসমূহ</span>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {objectives.map((obj, i) => (
              <div
                key={i}
                className="bg-white p-6 rounded-xl border border-stone-200 hover:border-emerald-500/50 hover:shadow-md transition-all space-y-3"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-800 text-amber-400 flex items-center justify-center text-xs font-bold">
                  ০{i + 1}
                </div>
                <h4 className="text-base font-bold text-stone-900">{obj.title}</h4>
                <p className="text-xs text-stone-600 leading-relaxed">{obj.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Organizational Philosophy */}
        <div className="bg-emerald-950 text-emerald-100 rounded-2xl p-8 sm:p-10 border border-emerald-900">
          <div className="flex items-center gap-3 mb-4">
            <Layers className="w-6 h-6 text-amber-400" />
            <h3 className="text-xl font-bold text-white">
              দীর্ঘমেয়াদি ডিজিটাল দর্শন (Modular & Scalable Architecture)
            </h3>
          </div>
          <p className="text-sm text-emerald-200 leading-relaxed mb-6">
            এই প্ল্যাটফর্মটি এমনভাবে ডিজাইন করা হয়েছে যাতে ভবিষ্যতে সংগঠনের গঠনতন্ত্র, সাংগঠনিক কাঠামো, সদস্যের ধরন, কমিটির পদবি বা নীতিমালায় পরিবর্তন আসলেও কোনো কোড এডিট করার প্রয়োজন না পড়ে। অ্যাডমিন ড্যাশবোর্ড থেকে সুপার অ্যাডমিন সরাসরি নতুন পদ, নতুন ফান্ড ও নতুন কর্মসূচি যুক্ত করতে পারবেন।
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs text-emerald-100">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>কোডিং ছাড়াই নতুন সদস্য ও পদবি সংযোজন</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>বিগত সকল কমিটির ঐতিহাসিক আর্কাইভ</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>১০০% ক্লাউড ডাটাবেজ ব্যাকআপ ও রিস্টোর</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
