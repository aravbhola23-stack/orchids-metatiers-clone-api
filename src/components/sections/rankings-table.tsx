import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface Mode {
  icon: string;
  tier: string;
}

interface Player {
  rank: number;
  username: string;
  region: 'EU' | 'NA' | 'AS' | 'AU' | 'SA' | 'DU';
  modes: Mode[];
  total_points: number;
}

const allModes = [
  { key: 'vanilla.png', name: 'Vanilla' },
  { key: 'sword.png', name: 'Sword' },
  { key: 'uhc.png', name: 'UHC' },
  { key: 'diapot.png', name: 'DiaPot' },
  { key: 'nethpot.png', name: 'NethPot' },
  { key: 'smp.png', name: 'SMP' },
  { key: 'axe.png', name: 'Axe' },
  { key: 'mace.png', name: 'Mace' },
];

const modeIconMap: Record<string, string> = {
  'vanilla.png': "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/vanilla-2.png",
  'sword.png': "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/sword-3.png",
  'uhc.png': "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/uhc-4.png",
  'diapot.png': "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/diapot-5.png",
  'nethpot.png': "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/nethpot-6.png",
  'smp.png': "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/smp-7.png",
  'axe.png': "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/axe-8.png",
  'mace.png': "https://slelguoygbfzlpylpxfs.supabase.co/storage/v1/object/public/test-clones/7746113a-94b4-445c-9e16-12fb2086c7cf-metatiers-com/assets/icons/mace-9.png",
};


const regionStyles: Record<Player['region'], string> = {
  EU: 'bg-region-eu',
  NA: 'bg-region-na',
  AS: 'bg-region-as',
  AU: 'bg-region-au',
  SA: 'bg-region-sa',
  DU: 'bg-region-du',
};

const getPlayers = async (): Promise<Player[]> => {
  // Mock data simulating API fetch
  return [
    { rank: 1, username: 'LootZero', region: 'EU', total_points: 138, modes: [{ icon: 'vanilla.png', tier: 'LT3' },{ icon: 'sword.png', tier: 'HT1' },{ icon: 'uhc.png', tier: 'HT3' },{ icon: 'diapot.png', tier: 'HT2' },{ icon: 'nethpot.png', tier: 'HT3' },{ icon: 'smp.png', tier: 'HT3' },{ icon: 'axe.png', tier: 'LT3' },{ icon: 'mace.png', tier: 'LT3' }] },
    { rank: 2, username: 'ItsH1', region: 'EU', total_points: 95, modes: [{ icon: 'sword.png', tier: 'HT3' },{ icon: 'uhc.png', tier: 'HT3' },{ icon: 'diapot.png', tier: 'LT3' },{ icon: 'nethpot.png', tier: 'LT3' },{ icon: 'smp.png', tier: 'HT1' },{ icon: 'mace.png', tier: 'LT4' }] },
    { rank: 3, username: 'Ultricia', region: 'EU', total_points: 74, modes: [{ icon: 'vanilla.png', tier: 'LT3' },{ icon: 'sword.png', tier: 'HT3' },{ icon: 'uhc.png', tier: 'LT3' },{ icon: 'diapot.png', tier: 'HT3' },{ icon: 'nethpot.png', tier: 'LT3' },{ icon: 'smp.png', tier: 'LT2' },{ icon: 'axe.png', tier: 'HT3' },{ icon: 'mace.png', tier: 'LT3' }] },
    { rank: 4, username: 'Alternate', region: 'EU', total_points: 71, modes: [{ icon: 'uhc.png', tier: 'LT1' },{ icon: 'smp.png', tier: 'LT2' },{ icon: 'axe.png', tier: 'LT3' }] },
    { rank: 5, username: 'Gpminer17', region: 'NA', total_points: 68, modes: [{ icon: 'vanilla.png', tier: 'LT3' },{ icon: 'sword.png', tier: 'HT3' },{ icon: 'uhc.png', tier: 'HT3' },{ icon: 'diapot.png', tier: 'HT3' },{ icon: 'nethpot.png', tier: 'HT3' },{ icon: 'smp.png', tier: 'HT3' },{ icon: 'axe.png', tier: 'LT3' },{ icon: 'mace.png', tier: 'LT3' }] },
    { rank: 6, username: 'TRSDE', region: 'EU', total_points: 58, modes: [{ icon: 'vanilla.png', tier: 'LT3' },{ icon: 'sword.png', tier: 'LT3' },{ icon: 'uhc.png', tier: 'HT3' },{ icon: 'diapot.png', tier: 'LT3' },{ icon: 'nethpot.png', tier: 'HT4' },{ icon: 'smp.png', tier: 'HT3' },{ icon: 'axe.png', tier: 'HT3' },{ icon: 'mace.png', tier: 'LT3' }] },
    { rank: 7, username: 'swrdd', region: 'NA', total_points: 58, modes: [{ icon: 'diapot.png', tier: 'LT3' },{ icon: 'nethpot.png', tier: 'HT3' },{ icon: 'uhc.png', tier: 'HT3' },{ icon: 'sword.png', tier: 'HT3' },{ icon: 'smp.png', tier: 'HT3' }] },
    { rank: 8, username: 'RivvieeMeow', region: 'EU', total_points: 56, modes: [{ icon: 'smp.png', tier: 'LT2' },{ icon: 'diapot.png', tier: 'HT3' },{ icon: 'nethpot.png', tier: 'HT3' },{ icon: 'axe.png', tier: 'HT3' },{ icon: 'sword.png', tier: 'LT3' }] },
    { rank: 9, username: 'Lightzyzzz', region: 'EU', total_points: 56, modes: [{ icon: 'sword.png', tier: 'LT3' },{ icon: 'axe.png', tier: 'LT3' },{ icon: 'diapot.png', tier: 'LT3' },{ icon: 'smp.png', tier: 'LT3' },{ icon: 'nethpot.png', tier: 'LT3' }] },
    { rank: 10, username: 'Igx', region: 'EU', total_points: 56, modes: [{ icon: 'diapot.png', tier: 'HT3' }, { icon: 'sword.png', tier: 'HT3' }, { icon: 'nethpot.png', tier: 'LT3' }, { icon: 'smp.png', tier: 'LT3' }] },
  ];
};

const RankingsTable = async () => {
  const players = await getPlayers();

  return (
    <div className="overflow-x-auto bg-[#0f1117]">
      <table className="min-w-full w-full border-separate" style={{ borderSpacing: '0 0.25rem' }}>
        <thead className="">
          <tr>
            <th className="p-3 text-left text-xs font-semibold uppercase text-muted-foreground w-[60px]">#</th>
            <th className="p-3 text-left text-xs font-semibold uppercase text-muted-foreground">Player</th>
            <th className="p-3 text-left text-xs font-semibold uppercase text-muted-foreground w-[120px]">Region</th>
            <th className="p-3 text-left text-xs font-semibold uppercase text-muted-foreground">Tiers</th>
          </tr>
        </thead>
        <tbody>
          {players.map(player => (
            <tr key={player.rank} className="bg-[#1a1d29] hover:bg-[#1f2937] transition-colors duration-150">
              <td className="p-4 font-bold text-lg text-primary rounded-l-lg">#{player.rank}</td>
              <td className="p-4">
                <div className="flex items-center gap-4">
                  <Image
                    src={`https://render.crafty.gg/3d/bust/${player.username}`}
                    alt={player.username}
                    width={48}
                    height={48}
                    className="rounded-md"
                    unoptimized
                  />
                  <div>
                    <div className="text-base font-bold text-foreground">{player.username}</div>
                    <div className="text-sm text-secondary-foreground">{player.total_points} points</div>
                  </div>
                </div>
              </td>
              <td className="p-4">
                <span className={cn(
                  'inline-block px-3 py-1.5 text-[11px] font-semibold text-white rounded-full leading-none',
                  regionStyles[player.region]
                )}>
                  {player.region}
                </span>
              </td>
              <td className="p-4 rounded-r-lg">
                <div className="flex flex-wrap items-center gap-1.5">
                  {allModes.map((mode) => {
                    const playerMode = player.modes.find(m => m.icon === mode.key);
                    if (playerMode) {
                      return (
                        <div key={mode.key} className="flex items-center gap-1 px-2 py-1 rounded-md bg-tier-pill-bg">
                          <Image
                            src={modeIconMap[mode.key]}
                            alt={mode.name}
                            width={16}
                            height={16}
                            unoptimized
                          />
                          <span className="text-xs font-semibold text-white uppercase">{playerMode.tier}</span>
                        </div>
                      );
                    }
                    return (
                      <div key={mode.key} className="w-[58px] h-[28px] rounded-md bg-muted/30" />
                    );
                  })}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RankingsTable;