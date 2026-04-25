"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import CourseCard from '@/components/CourseCard';
import ChatModal from '@/components/ChatModal';
import WeekGeneralInfo from '@/components/WeekGeneralInfo';

// --- UTILITAIRES ---
const getWeekIdentifier = (date: Date) => {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7) + 1;
  return `${d.getFullYear()}-W${weekNum < 10 ? '0' + weekNum : weekNum}`;
};

const getWeekRangeLabel = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return `${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`;
};

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [binomes, setBinomes] = useState<any[]>([]);
  const [selectedBinomeId, setSelectedBinomeId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(new Date());
  const [currentWeekId, setCurrentWeekId] = useState(getWeekIdentifier(new Date()));
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  const [orangeDays, setOrangeDays] = useState<string[]>([]);
  const [greenDays, setGreenDays] = useState<string[]>([]);
  
  const router = useRouter();

  // --- RÉCUPÉRATION DES STATUTS (FIX: SANS LA COLONNE TIME) ---
  const fetchModifications = async (binomeId: string, weekId: string) => {
    if (!binomeId || binomeId === "null") return;

    // On ne demande que day_name et status qui existent bien en base
    const { data, error } = await supabase
      .from('submissions')
      .select('day_name, status') 
      .eq('binome_id', binomeId)
      .eq('week_id', weekId);

    if (error) {
      console.error("❌ Erreur Supabase:", error.message);
      return;
    }

    if (data) {
      const oranges: string[] = [];
      const greens: string[] = [];
      const daysList = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];

      daysList.forEach(day => {
        const dayEntries = data.filter(item => 
          item.day_name && item.day_name.trim().toLowerCase() === day
        );

        if (dayEntries.length > 0) {
          // Si une ligne est orange ou rouge -> bouton orange
          const hasAlert = dayEntries.some(e => {
            const s = e.status?.toLowerCase();
            return s === 'orange' || s === 'rouge';
          });

          if (hasAlert) {
            oranges.push(day);
          } else {
            // Sinon si une ligne est verte -> bouton vert
            const hasGreen = dayEntries.some(e => e.status?.toLowerCase() === 'vert');
            if (hasGreen) greens.push(day);
          }
        }
      });

      setOrangeDays(oranges);
      setGreenDays(greens);
    }
  };

  // --- AUTH & PROFIL ---
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);

      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const userProfile = prof || { prenom: user.email?.split('@')[0], id: user.id, role: 'skieur' };
      setProfile(userProfile);

      if (userProfile.role === 'admin') {
        const { data: allBinomes } = await supabase.from('binomes').select('*').order('nom_binome');
        setBinomes(allBinomes || []);
        if (allBinomes && allBinomes.length > 0) setSelectedBinomeId(allBinomes[0].id);
      } else {
        const { data: myBinome } = await supabase.from('binomes').select('id').or(`skieur_id.eq.${user.id},collaborateur_id.eq.${user.id}`).single();
        if (myBinome) setSelectedBinomeId(myBinome.id);
      }
      setLoading(false);
    };
    checkUser();
  }, [router]);

  // --- SURVEILLANCE ---
  useEffect(() => {
    if (selectedBinomeId) {
      fetchModifications(selectedBinomeId, currentWeekId);
    }
  }, [selectedBinomeId, currentWeekId, selectedDay]);

  const changeWeek = (offset: number) => {
    const newDate = new Date(viewDate);
    newDate.setDate(newDate.getDate() + (offset * 7));
    setViewDate(newDate);
    setCurrentWeekId(getWeekIdentifier(newDate));
  };

  if (loading) return <div className="h-screen flex items-center justify-center bg-[#F0F2F5] font-black text-blue-600 italic text-2xl uppercase">Chargement...</div>;

  const daysMenu = ["lundi", "mardi", "mercredi", "jeudi", "vendredi"];
  const morningSlots = ["08:30", "09:30", "10:30", "11:30", "12:30"];
  const afternoonSlots = ["13:30", "14:30", "15:30", "16:30"];

  return (
    <main className="min-h-screen bg-[#F0F2F5] pb-10">
      <header className="bg-white p-4 shadow-md border-b-[6px] border-blue-600 sticky top-0 z-[100]">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center">
          <div className="flex flex-col">
            <h1 className="font-[900] text-blue-600 italic text-xl uppercase tracking-tighter leading-none">SKI ETUDE CONNECT</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-black text-blue-900 uppercase italic tracking-widest">{profile?.prenom}</span>
              {profile?.role === 'admin' && <span className="bg-red-500 text-white text-[8px] px-2 py-0.5 rounded-full font-black uppercase ml-2">ADMIN</span>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {profile?.role === 'admin' && binomes.length > 0 && (
              <div className="flex items-center gap-2 bg-blue-50 p-2 px-3 rounded-xl border border-blue-100">
                <span className="hidden sm:inline text-[9px] font-black text-blue-600 uppercase">Élève :</span>
                <select 
                  value={selectedBinomeId || ""} 
                  onChange={(e) => setSelectedBinomeId(e.target.value)}
                  className="bg-transparent text-blue-900 font-bold text-xs outline-none cursor-pointer"
                >
                  {binomes.map(b => (
                    <option key={b.id} value={b.id}>{b.nom_binome}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={() => setIsChatOpen(true)} className="bg-blue-600 text-white p-2.5 px-4 rounded-xl font-black text-[10px] uppercase italic hover:bg-blue-700 transition-colors">💬 CHAT</button>
              <button onClick={() => window.open('https://meet.google.com/new', '_blank')} className="bg-emerald-500 text-white p-2.5 px-4 rounded-xl font-black text-[10px] uppercase italic hover:bg-emerald-600 transition-colors">📹 MEET</button>
              <button onClick={() => supabase.auth.signOut().then(() => router.push('/login'))} className="text-[9px] font-black text-red-500 border-2 border-red-500 px-3 py-2 rounded-xl uppercase italic hover:bg-red-500 hover:text-white transition-all">Quitter</button>
            </div>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b sticky top-[82px] z-[90] mb-6">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between px-6 py-4">
          <button onClick={() => changeWeek(-1)} className="font-black italic text-[10px] bg-gray-100 p-3 px-5 rounded-xl text-blue-600 uppercase">←</button>
          <span className="font-[900] text-blue-600 uppercase italic text-[14px]">{getWeekRangeLabel(viewDate)}</span>
          <button onClick={() => changeWeek(1)} className="font-black italic text-[10px] bg-gray-100 p-3 px-5 rounded-xl text-blue-600 uppercase">→</button>
        </div>
      </nav>

      <div className="max-w-[1600px] mx-auto p-4 flex flex-col lg:flex-row gap-6">
        <aside className="w-full lg:w-[400px] flex-shrink-0 lg:sticky lg:top-[168px] self-start">
          <WeekGeneralInfo currentWeek={currentWeekId} day={selectedDay || "Général"} binomeId={selectedBinomeId} />
        </aside>

        <section className="flex-1">
          {!selectedDay ? (
            <div className="space-y-4">
              {daysMenu.map(day => {
                const isOrange = orangeDays.includes(day);
                const isGreen = greenDays.includes(day) && !isOrange;

                let cardStyle = "bg-white border-gray-200 hover:border-blue-600";
                let textColor = "text-blue-900 group-hover:text-blue-600";
                let dotColor = "bg-blue-600";
                let label = null;

                if (isOrange) {
                  cardStyle = "bg-orange-50 border-orange-500 shadow-orange-100 shadow-sm";
                  textColor = "text-orange-600";
                  dotColor = "bg-orange-500";
                  label = <span className="bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase italic animate-pulse">Modifié</span>;
                } else if (isGreen) {
                  cardStyle = "bg-green-50 border-green-500 shadow-green-100 shadow-sm";
                  textColor = "text-green-600";
                  dotColor = "bg-green-500";
                  label = <span className="bg-green-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase italic">Terminé ✓</span>;
                }

                return (
                  <button key={day} onClick={() => setSelectedDay(day)} className={`w-full p-10 rounded-[2.5rem] shadow-lg flex justify-between items-center border-b-[8px] transition-all group ${cardStyle}`}>
                    <div className="flex items-center gap-4">
                      <span className={`text-4xl sm:text-5xl font-[900] italic uppercase tracking-tighter transition-colors ${textColor}`}>{day}</span>
                      {label}
                    </div>
                    <div className={`${dotColor} h-12 w-12 sm:h-14 sm:w-14 rounded-full flex items-center justify-center text-white text-3xl font-bold transition-transform group-hover:rotate-12`}>→</div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="animate-in fade-in duration-500">
              <button onClick={() => setSelectedDay(null)} className="mb-6 font-black italic uppercase text-[10px] bg-blue-900 text-white p-3 px-8 rounded-full">← RETOUR</button>
              <h2 className="text-5xl sm:text-6xl font-[900] italic uppercase text-blue-600 mb-10 tracking-tighter">{selectedDay}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <div className="bg-blue-600 text-white p-5 rounded-[2rem] text-center font-[900] italic uppercase tracking-widest shadow-xl">☀️ MATIN</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {morningSlots.map(time => (
                      <CourseCard key={time} slot={{ time }} profile={profile} currentWeek={currentWeekId} day={selectedDay} binomeId={selectedBinomeId} />
                    ))}
                  </div>
                </div>
                <div className="space-y-5">
                  <div className="bg-blue-900 text-white p-5 rounded-[2rem] text-center font-[900] italic uppercase tracking-widest shadow-xl">🌙 APRÈS-MIDI</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {afternoonSlots.map(time => (
                      <CourseCard key={time} slot={{ time }} profile={profile} currentWeek={currentWeekId} day={selectedDay} binomeId={selectedBinomeId} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
      <ChatModal isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} profile={profile} />
    </main>
  );
}