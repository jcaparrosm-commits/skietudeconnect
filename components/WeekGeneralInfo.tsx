"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function WeekGeneralInfo({ currentWeek, day }: any) {
  const [infos, setInfos] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const COACH_EMAIL = 'jcaparrosm@educand.ad'.toLowerCase().trim();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
      } catch (err) {
        console.error("Erreur auth:", err);
      } finally {
        setAuthLoaded(true);
      }
    };

    checkUser();
    fetchInfos();
  }, [currentWeek, day]);

  const isAdmin = user?.email && user.email.toLowerCase().trim() === COACH_EMAIL;
  
  // Les élèves peuvent écrire si on est sur un jour précis, pas sur le "Général" de la semaine
  const canWrite = isAdmin || (day && day !== 'Général');

  const fetchInfos = async () => {
    if (!supabase || !currentWeek) return;
    try {
      const { data, error } = await supabase
        .from('week_infos')
        .select('id, created_at, week_id, day_name, content, type, status, author_id')
        .eq('week_id', currentWeek)
        .eq('day_name', day || 'Général')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setInfos(data || []);
    } catch (e) {
      console.error("Erreur fetch week_infos:", e);
    }
  };

  const uploadToDB = async (content: string, type: string) => {
    if (!canWrite) return;
    try {
      const { error } = await supabase.from('week_infos').insert({
        week_id: currentWeek,
        day_name: day || 'Général',
        content: content,
        type: type,
        status: 'sent',
        author_id: user?.id // On enregistre qui a écrit
      });
      if (error) throw error;
      fetchInfos();
    } catch (err: any) {
      console.error("Erreur insertion table week_infos:", err.message);
    }
  };

  const startRecording = async () => {
    if (!canWrite) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.current.push(e.data); };
      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: mimeType });
        const path = `week_infos/${Date.now()}.${mimeType.includes('webm') ? 'webm' : 'm4a'}`;
        const { error: upErr } = await supabase.storage.from('session-files').upload(path, audioBlob);
        if (upErr) throw upErr;
        const { data: { publicUrl } } = supabase.storage.from('session-files').getPublicUrl(path);
        await uploadToDB(publicUrl, 'audio');
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (e) { alert("Micro inaccessible"); }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const handlePhotoUpload = async (e: any) => {
    if (!canWrite) return;
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const path = `week_infos/${Date.now()}-${file.name.replace(/\s/g, '_')}`;
      const { error: upErr } = await supabase.storage.from('session-files').upload(path, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('session-files').getPublicUrl(path);
      await uploadToDB(publicUrl, 'photo');
    } catch (err: any) { console.error(err); } finally { setLoading(false); }
  };

  if (!authLoaded) return <div className="h-[450px] flex items-center justify-center text-blue-400 italic">Chargement...</div>;

  return (
    <div className="bg-blue-900 text-white rounded-[2.5rem] p-6 shadow-2xl flex flex-col border-4 border-blue-400 min-h-[450px] relative">
      <div className="mb-4">
        <h2 className="text-xl font-black italic uppercase leading-none">
          {day === 'Général' || !day ? 'Notes de la semaine' : `Notes du ${day}`}
        </h2>
        <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">{day || 'Général'}</span>
      </div>

      <div className="flex-1 space-y-3 mb-6 overflow-y-auto max-h-[400px] pr-2 scrollbar-hide">
        {infos.map((info) => (
          <div key={info.id} className="relative group bg-blue-800/50 p-3 rounded-2xl border border-blue-700/50">
            {info.type === 'text' && <p className="text-xs font-bold italic">{info.content}</p>}
            {info.type === 'audio' && <audio src={info.content} controls className="w-full h-8 invert opacity-70" />}
            {info.type === 'photo' && (
              <img src={info.content} onClick={() => setSelectedPhoto(info.content)} className="w-full rounded-xl cursor-zoom-in" alt="Note" />
            )}
            
            {/* Suppression : Admin peut tout supprimer, l'élève seulement sa propre note */}
            {(isAdmin || (user && user.id === info.author_id)) && (
              <button 
                onClick={async () => { 
                  await supabase.from('week_infos').delete().eq('id', info.id); 
                  fetchInfos(); 
                }} 
                className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 text-[8px] flex items-center justify-center"
              >✕</button>
            )}
          </div>
        ))}
      </div>

      {canWrite ? (
        <div className="mt-auto">
          <div className="grid grid-cols-3 gap-2">
            <button onMouseDown={startRecording} onMouseUp={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording}
              className={`py-4 rounded-2xl flex items-center justify-center ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-700'}`}>
              🎙️
            </button>
            <label className="bg-blue-700 py-4 rounded-2xl flex items-center justify-center cursor-pointer">
              {loading ? "..." : "📸"} <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={loading} />
            </label>
            <button onClick={() => setIsTyping(!isTyping)} className={`py-4 rounded-2xl flex items-center justify-center ${isTyping ? 'bg-white text-blue-900' : 'bg-blue-600'}`}>
              📝
            </button>
          </div>

          {isTyping && (
            <form onSubmit={(e) => { e.preventDefault(); if(inputValue.trim()) { uploadToDB(inputValue, 'text'); setInputValue(""); setIsTyping(false); } }} className="mt-3 flex gap-2">
              <input autoFocus value={inputValue} onChange={e => setInputValue(e.target.value)} className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none" placeholder="Ajouter une note..." />
              <button type="submit" className="bg-white text-blue-900 px-4 rounded-xl font-black text-[10px]">OK</button>
            </form>
          )}
        </div>
      ) : (
        <div className="mt-auto py-3 text-center border-t border-blue-400/20">
          <p className="text-[10px] font-bold text-blue-400 opacity-60 uppercase italic tracking-widest">Lecture Seule (Semaine)</p>
        </div>
      )}

      {selectedPhoto && (
        <div className="fixed inset-0 z-[999] bg-black/95 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <img src={selectedPhoto} className="max-w-full max-h-full object-contain" alt="Zoom" />
        </div>
      )}
    </div>
  );
}