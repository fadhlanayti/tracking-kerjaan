'use client';

import { useState } from 'react';
import { FaLinkedinIn, FaTwitter, FaInstagram, FaGithub } from 'react-icons/fa';
import { cn } from '@/lib/utils';

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  image: string;
  social?: {
    twitter?: string;
    linkedin?: string;
    instagram?: string;
    github?: string;
  };
}

const DEFAULT_MEMBERS: TeamMember[] = [
  {
    id: '1',
    name: 'Fadhlan',
    role: 'Fullstack Lead Developer',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80',
    social: { linkedin: '#', github: '#' },
  },
  {
    id: '2',
    name: 'Ahmad Rizky',
    role: 'Creative Director',
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    social: { instagram: '#', linkedin: '#' },
  },
  {
    id: '3',
    name: 'Siti Sarah',
    role: 'Lead UI/UX Designer',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=600&q=80',
    social: { instagram: '#', linkedin: '#' },
  },
  {
    id: '4',
    name: 'Budi Santoso',
    role: 'Backend Engineer',
    image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=600&q=80',
    social: { github: '#', linkedin: '#' },
  },
  {
    id: '5',
    name: 'Dewi Lestari',
    role: 'Project Manager',
    image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=600&q=80',
    social: { linkedin: '#', twitter: '#' },
  },
  {
    id: '6',
    name: 'Kevin Pratama',
    role: 'Frontend Developer',
    image: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?auto=format&fit=crop&w=600&q=80',
    social: { github: '#', linkedin: '#' },
  },
];

interface TeamShowcaseProps {
  members?: TeamMember[];
}

export default function TeamShowcase({ members = DEFAULT_MEMBERS }: TeamShowcaseProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const col1 = members.filter((_, i) => i % 3 === 0);
  const col2 = members.filter((_, i) => i % 3 === 1);
  const col3 = members.filter((_, i) => i % 3 === 2);

  return (
    <div className="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 md:gap-10 lg:gap-14 select-none w-full max-w-5xl mx-auto py-8 px-4 md:px-6 font-sans">
      {/* ── Left: photo grid ── */}
      <div className="flex gap-2.5 md:gap-3 flex-shrink-0 overflow-visible p-2 justify-center">
        {/* Column 1 */}
        <div className="flex flex-col gap-2.5 md:gap-3">
          {col1.map((member) => (
            <PhotoCard
              key={member.id}
              member={member}
              className="w-[110px] h-[120px] sm:w-[130px] sm:h-[140px] md:w-[155px] md:h-[165px]"
              hoveredId={hoveredId}
              onHover={setHoveredId}
            />
          ))}
        </div>

        {/* Column 2 */}
        <div className="flex flex-col gap-2.5 md:gap-3 mt-[44px] sm:mt-[52px] md:mt-[60px]">
          {col2.map((member) => (
            <PhotoCard
              key={member.id}
              member={member}
              className="w-[122px] h-[132px] sm:w-[145px] sm:h-[155px] md:w-[172px] md:h-[182px]"
              hoveredId={hoveredId}
              onHover={setHoveredId}
            />
          ))}
        </div>

        {/* Column 3 */}
        <div className="flex flex-col gap-2.5 md:gap-3 mt-[20px] sm:mt-[24px] md:mt-[28px]">
          {col3.map((member) => (
            <PhotoCard
              key={member.id}
              member={member}
              className="w-[115px] h-[125px] sm:w-[136px] sm:h-[146px] md:w-[162px] md:h-[172px]"
              hoveredId={hoveredId}
              onHover={setHoveredId}
            />
          ))}
        </div>
      </div>

      {/* ── Right: member name list ── */}
      <div className="flex flex-col sm:grid sm:grid-cols-2 lg:flex lg:flex-col gap-4 md:gap-5 pt-2 flex-1 w-full max-w-md">
        {members.map((member) => (
          <MemberRow
            key={member.id}
            member={member}
            hoveredId={hoveredId}
            onHover={setHoveredId}
          />
        ))}
      </div>
    </div>
  );
}

/* Photo card */
function PhotoCard({
  member,
  className,
  hoveredId,
  onHover,
}: {
  member: TeamMember;
  className: string;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  const isActive = hoveredId === member.id;
  const isDimmed = hoveredId !== null && !isActive;

  return (
    <div
      className={cn(
        'rounded-2xl cursor-pointer flex-shrink-0 transition-all duration-300 shadow-md bg-zinc-900 border-2',
        className,
        isDimmed ? 'opacity-60 scale-98' : 'opacity-100 scale-100',
        isActive ? 'border-[var(--accent)] shadow-lg shadow-[var(--accent)]/20' : 'border-white/10'
      )}
      onMouseEnter={() => onHover(member.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="w-full h-full rounded-[14px] overflow-hidden">
        <img
          src={member.image}
          alt={member.name}
          className="w-full h-full object-cover transition-[filter,transform] duration-500 hover:scale-105"
          style={{
            filter: isActive ? 'grayscale(0) brightness(1.05)' : 'grayscale(0.9) brightness(0.8)',
          }}
        />
      </div>
    </div>
  );
}

/* Member name section */
function MemberRow({
  member,
  hoveredId,
  onHover,
}: {
  member: TeamMember;
  hoveredId: string | null;
  onHover: (id: string | null) => void;
}) {
  const isActive = hoveredId === member.id;
  const isDimmed = hoveredId !== null && !isActive;
  const hasSocial = member.social?.twitter || member.social?.linkedin || member.social?.instagram || member.social?.github;

  return (
    <div
      className={cn(
        'cursor-pointer transition-all duration-300 p-3 rounded-2xl',
        isActive
          ? 'bg-zinc-900/90 shadow-md border border-zinc-700/60'
          : isDimmed
          ? 'opacity-40 hover:opacity-75'
          : 'opacity-85 hover:opacity-100 hover:bg-zinc-900/40',
      )}
      onMouseEnter={() => onHover(member.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* Name + social */}
      <div className="flex items-center gap-2.5">
        <span
          className={cn(
            'w-4 h-2.5 rounded-full flex-shrink-0 transition-all duration-300',
            isActive ? 'bg-[var(--accent)] w-7' : 'bg-zinc-950/40',
          )}
        />
        <span
          className={cn(
            'text-base md:text-lg font-black leading-none tracking-tight transition-colors duration-300',
            isActive ? 'text-[var(--accent)]' : 'text-zinc-900',
          )}
        >
          {member.name}
        </span>

        {/* Social icons */}
        {hasSocial && (
          <div
            className={cn(
              'flex items-center gap-1.5 ml-2 transition-all duration-200',
              isActive
                ? 'opacity-100 translate-x-0'
                : 'opacity-0 -translate-x-2 pointer-events-none',
            )}
          >
            {member.social?.github && (
              <a
                href={member.social.github.startsWith('http') ? member.social.github : `https://${member.social.github}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-all duration-150 hover:scale-110"
                title="GitHub"
              >
                <FaGithub size={13} />
              </a>
            )}
            {member.social?.linkedin && (
              <a
                href={member.social.linkedin.startsWith('http') ? member.social.linkedin : `https://${member.social.linkedin}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-all duration-150 hover:scale-110"
                title="LinkedIn"
              >
                <FaLinkedinIn size={13} />
              </a>
            )}
            {member.social?.instagram && (
              <a
                href={member.social.instagram.startsWith('http') ? member.social.instagram : `https://${member.social.instagram}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-all duration-150 hover:scale-110"
                title="Instagram"
              >
                <FaInstagram size={13} />
              </a>
            )}
            {member.social?.twitter && (
              <a
                href={member.social.twitter.startsWith('http') ? member.social.twitter : `https://${member.social.twitter}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 rounded-lg text-zinc-300 hover:text-white hover:bg-white/10 transition-all duration-150 hover:scale-110"
                title="Twitter"
              >
                <FaTwitter size={13} />
              </a>
            )}
          </div>
        )}
      </div>

      {/* Role / Position */}
      <p
        className={cn(
          'mt-1 pl-[26px] text-[11px] md:text-xs font-bold uppercase tracking-[0.16em] transition-colors duration-300',
          isActive ? 'text-zinc-300' : 'text-zinc-800'
        )}
      >
        {member.role}
      </p>
    </div>
  );
}
