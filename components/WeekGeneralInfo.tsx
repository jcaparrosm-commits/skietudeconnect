"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// AJOUT : Réception de binomeId dans les props
export default function WeekGeneralInfo({ currentWeek, day, binomeId }: any) {
  const [infos, setInfos] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const fetchInfos = async () => {
    // MODIFICATION : On vérifie qu'on a bien un binomeId avant de charger
    if (!supabase || !currentWeek || !binomeId) return;
    try {
      const { data, error } = await supabase
        .from('week_infos')
        .select('*')
        .eq('week_id', currentWeek)
        .eq('day_name', day || 'Général')
        .eq('binome_id', binomeId) // FILTRE : Uniquement le binôme sélectionné
        .order('created_at', { ascending: true });
      if (error) throw error;
      setInfos(data || []);
    } catch (e) { console.error(e); }
  };

  // AJOUT : On surveille binomeId pour rafraîchir quand on change d'élève
  useEffect(() => { fetchInfos(); }, [currentWeek, day, binomeId]);

  const uploadToDB = async (content: string, type: string) => {
    try {
      const { error } = await supabase.from('week_infos').insert({
        week_id: currentWeek,
        day_name: day || 'Général',
        content: content,
        type: type,
        status: 'sent',
        binome_id: binomeId // ENREGISTREMENT : On lie la note au binôme
      });
      if (error) throw error;
      fetchInfos();
    } catch (err: any) { console.error(err.message); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
        const path = `week_infos/${Date.now()}.webm`;
        await supabase.storage.from('session-files').upload(path, audioBlob);
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
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    const path = `week_infos/${Date.now()}.jpg`;
    await supabase.storage.from('session-files').upload(path, file);
    const { data: { publicUrl } } = supabase.storage.from('session-files').getPublicUrl(path);
    await uploadToDB(publicUrl, 'photo');
    setLoading(false);
  };

  return (
    <div className="bg-blue-900 text-white rounded-[2.5rem] p-6 shadow-2xl flex flex-col border-4 border-blue-400 min-h-[450px] relative">
      <div className="mb-4">
        <h2 className="text-xl font-black italic uppercase leading-none">Notes Générales</h2>
        <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">{day}</span>
      </div>

      <div className="flex-1 space-y-3 mb-6 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
        {infos.map((info) => (
          <div key={info.id} className="relative group bg-blue-800/50 p-3 rounded-2xl border border-blue-700/50">
            {info.type === 'text' && <p className="text-xs font-bold italic">{info.content}</p>}
            {info.type === 'audio' && <audio src={info.content} controls className="w-full h-8 invert opacity-70" />}
            {info.type === 'photo' && (
              <img 
                src={info.content} 
                onClick={() => setSelectedPhoto(info.content)}
                className="w-full rounded-xl cursor-zoom-in hover:scale-[1.02] transition-transform shadow-lg" 
              />
            )}
            <button onClick={async () => { await supabase.from('week_infos').delete().eq('id', info.id); fetchInfos(); }} className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 text-[8px] opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
          </div>
        ))}
        {infos.length === 0 && <p className="text-[8px] text-blue-300 italic text-center mt-10 uppercase font-black">Aucune note pour ce binôme</p>}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-auto">
        <button onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} className={`py-4 rounded-2xl flex items-center justify-center transition-all shadow-xl ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-700'}`}>🎙️</button>
        <label className="bg-blue-700 py-4 rounded-2xl flex items-center justify-center cursor-pointer shadow-xl">
          📸 <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </label>
        <button onClick={() => setIsTyping(!isTyping)} className="bg-blue-600 py-4 rounded-2xl flex items-center justify-center text-xl shadow-xl">📝</button>
      </div>

      {isTyping && (
        <form onSubmit={(e) => { e.preventDefault(); uploadToDB(inputValue, 'text'); setInputValue(""); setIsTyping(false); }} className="mt-3 flex gap-2">
          <input value={inputValue} onChange={e => setInputValue(e.target.value)} className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none border border-white/20" placeholder="Note..." />
          <button type="submit" className="bg-white text-blue-900 px-3 rounded-xl font-black text-[10px] uppercase">OK</button>
        </form>
      )}

      {selectedPhoto && (
        <div className="fixed inset-0 z-[999] bg-black/95 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <img src={selectedPhoto} className="max-w-full max-h-full object-contain rounded-lg animate-in zoom-in duration-200" />
          <button className="absolute top-6 right-6 bg-white/20 text-white p-4 rounded-full font-black text-xl">✕</button>
        </div>
      )}
    </div>
  );
}