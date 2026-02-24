import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface Category {
  name: string;
  href: string;
  iconUrl: string;
  active: boolean;
}

const categoriesData: Category[] = [
  { name: 'Overall', href: '/rankings/overall', iconUrl: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/overall-1.png', active: true },
  { name: 'Vanilla', href: '/rankings/crystal', iconUrl: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/vanilla-2.png', active: false },
  { name: 'Sword', href: '/rankings/sword', iconUrl: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/sword-3.png', active: false },
  { name: 'UHC', href: '/rankings/uhc', iconUrl: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/uhc-4.png', active: false },
  { name: 'DiaPot', href: '/rankings/diapot', iconUrl: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/diapot-5.png', active: false },
  { name: 'NethPot', href: '/rankings/nethpot', iconUrl: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/nethpot-6.png', active: false },
  { name: 'SMP', href: '/rankings/smp', iconUrl: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/smp-7.png', active: false },
  { name: 'Axe', href: '/rankings/axe', iconUrl: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/axe-8.png', active: false },
  { name: 'Mace', href: '/rankings/mace', iconUrl: 'https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/mace-9.png', active: false },
];

const CategoryNavigation = () => {
  return (
    <div className="flex flex-wrap items-center gap-4 mt-5 mb-[10px]">
      {categoriesData.map((category) => (
        <Link
          key={category.name}
          href={category.href}
          className={cn(
            'flex items-center gap-2 py-[10px] px-[20px] rounded-[12px] text-[19.2px] font-medium transition-all duration-200',
            category.active
              ? 'bg-[#ffb912] text-[#111111] shadow-[0_3px_8px_0_rgba(255,180,0,0.4)]'
              : 'bg-[#1a1d24] text-[#aaaaaa] shadow-[0_2px_6px_0_rgba(0,0,0,0.4)] hover:brightness-110',
          )}
        >
          <Image
            src={category.iconUrl}
            alt={category.name}
            width={23}
            height={23}
          />
          {category.name}
        </Link>
      ))}
    </div>
  );
};

export default CategoryNavigation;