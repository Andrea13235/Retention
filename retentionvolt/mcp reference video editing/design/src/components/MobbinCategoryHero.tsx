'use client';

import React from 'react';

interface MobbinCategoryHeroProps {
  selectedNiche?: string;
  onSelectNiche: (niche: string) => void;
}

export const MobbinCategoryHero: React.FC<MobbinCategoryHeroProps> = ({
  selectedNiche = 'all',
  onSelectNiche,
}) => {
  const categories = [
    { id: 'tech',          label: 'Technology' },
    { id: 'entertainment', label: 'Entertainment' },
    { id: 'science',       label: 'Science' },
    { id: 'finance',       label: 'Finance' },
    { id: 'storytelling',  label: 'Storytelling' },
    { id: 'podcast',       label: 'Podcast' },
    { id: 'productivity',  label: 'Productivity' },
    { id: 'fitness',       label: 'Fitness' },
    { id: 'filmmaking',    label: 'Filmmaking' },
    { id: 'motivation',    label: 'Motivation' },
  ];

  return (
    <div className="w-full pt-6 pb-7 border-b border-[#1c1c1c]">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-8">

        {/* Section Label */}
        <span className="text-[10px] font-medium text-[#5a5a5a] tracking-widest block mb-4 uppercase">
          Categories
        </span>

        {/* 5-col grid, equal cells, text centered → optically uniform spacing */}
        <div className="grid grid-cols-5 gap-y-4 w-full">
          {categories.map((cat) => {
            const isSelected = selectedNiche === cat.id;
            return (
              <div key={cat.id} className="flex justify-center">
                <button
                  onClick={() => onSelectNiche(cat.id)}
                  className={`relative pb-1.5 font-bold tracking-tight transition-all duration-150 text-lg sm:text-2xl lg:text-3xl whitespace-nowrap ${
                    isSelected
                      ? 'text-white after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:bg-white after:rounded-full'
                      : 'text-[#5a5a5a] hover:text-[#e0e0e0]'
                  }`}
                >
                  {cat.label}
                </button>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
};
