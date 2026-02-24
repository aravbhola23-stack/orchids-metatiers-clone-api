"use client";

import Image from 'next/image';
import Link from 'next/link';
import { Home, Search, Trophy } from 'lucide-react';
import React from 'react';

const DiscordIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M19.54 0c-1.35.66-2.9 1.4-4.22 1.92C14.04 1.44 12.87.82 11.95 0H11.5c-1.22.99-2.27 2.01-3.14 3.23-2.12.2-4.39.49-6.32 1.05C.53 5.48 0 7.27 0 9.15c0 3.07.91 6.07 2.65 8.68.85 1.32 1.83 2.52 2.94 3.55.22.2.46.38.71.53A14 14 0 0 0 11 24a13.92 13.92 0 0 0 5.18-1.07.69.69 0 0 0 .43-.2 12.7 12.7 0 0 0 3-3.65c1.78-2.64 2.87-5.74 2.87-8.84 0-1.93-.53-3.71-1.84-4.88ZM8.43 13.8c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Zm7.14 0c-1.1 0-2-1-2-2.2s.9-2.2 2-2.2 2 1 2 2.2-.9 2.2-2 2.2Z"/>
  </svg>
);

const NavigationBar = () => {
  return (
    <nav className="relative flex items-center bg-[#0f1117] text-white py-5 px-6 rounded-xl shadow-[0_4px_12px_0_rgba(0,0,0,0.6)]">
      <div className="flex flex-1 items-center gap-x-8">
        <Link href="/">
          <Image
            src="https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/images/metatiers-1.png"
            alt="MetaTiers Logo"
            width={112}
            height={50}
            className="h-[50px] w-auto"
            priority
          />
        </Link>
        <div className="flex items-center space-x-8">
          <a href="/rankings/overall" className="flex items-center gap-x-2 text-[#ccc] hover:text-white transition-colors text-[18.4px]">
            <Trophy className="w-[20.7px] h-[18.4px]" />
            <span>Rankings</span>
          </a>
          <a href="https://discord.gg/StKjhp2BGd" target="_blank" rel="noopener noreferrer" className="flex items-center gap-x-2 text-[#ccc] hover:text-white transition-colors text-[18.4px]">
            <DiscordIcon className="w-[23px] h-[18.4px]" />
            <span>Discord</span>
          </a>
          <a href="/" className="flex items-center gap-x-2 text-[#666] text-[18.4px] pointer-events-none">
            <Home className="w-[20.7px] h-[18.4px]" />
            <span>Home</span>
          </a>
        </div>
      </div>

      <div className="relative">
        <form className="flex items-center bg-[#10141a] rounded-full py-[3px] px-2 h-[35px] w-[190px]">
          <input
            id="searchInput"
            name="searchInput"
            type="text"
            placeholder="Search Player..."
            className="flex-grow bg-transparent text-white text-[15.2px] placeholder:text-muted-foreground px-3 border-none outline-none focus:ring-0"
          />
          <button type="button" className="flex-shrink-0 text-gray-400 hover:text-white transition-colors pr-1">
            <Search className="w-4 h-4" />
          </button>
        </form>
        <div className="hidden absolute top-full mt-2 right-0 bg-[#d32f2f] text-white text-[14.4px] py-1.5 px-3 rounded-md whitespace-nowrap z-10">
          Player not found
        </div>
      </div>
    </nav>
  );
};

export default NavigationBar;