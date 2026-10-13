'use client';

import { useState, useEffect } from 'react';
import TeamShowcase, { TeamMember } from '@/components/ui/team-showcase';
import { Sparkles, Users, Loader2 } from 'lucide-react';

export default function TeamsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/users/team')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setMembers(data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="w-full flex flex-col items-center justify-center min-h-[calc(100vh-8rem)] py-6">
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-3 text-zinc-800 py-24">
          <Loader2 size={36} className="animate-spin text-zinc-900" />
          <p className="text-sm font-semibold tracking-wide">Memuat profil tim Weball Creative...</p>
        </div>
      ) : (
        <TeamShowcase members={members.length > 0 ? members : undefined} />
      )}
    </div>
  );
}
