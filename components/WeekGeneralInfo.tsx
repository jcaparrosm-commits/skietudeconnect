"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function WeekGeneralInfo({ currentWeek, day }: any) {
  const [infos, setInfos] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  // --- RÉCUPÉRATION DES DONNÉES (CORRIGÉ) ---
  const fetchInfos = async () => {
    if (!supabase || !currentWeek) return;
    try {
      // On liste explicitement les colonnes pour éviter l'erreur 400 (column time/tiem)
      const { data, error } = await supabase
        .from('week_infos')
        .select('id, created_at, week_id, day_name, content, type, status')
        .eq('week_id', currentWeek)
        .eq('day_name', day || 'Général')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setInfos(data || []);
    } catch (e) {
      console.error("Erreur fetch week_infos:", e);
    }
  };

  useEffect(() => {
    fetchInfos();
  }, [currentWeek, day]);

  // --- SAUVEGARDE EN BASE ---
  const uploadToDB = async (content: string, type: string) => {
    try {
      const { error } = await supabase.from('week_infos').insert({
        week_id: currentWeek,
        day_name: day || 'Général',
        content: content,
        type: type,
        status: 'sent'
      });
      if (error) throw error;
      fetchInfos();
    } catch (err: any) {
      console.error("Erreur insertion week_infos:", err.message);
    }
  };

  // --- GESTION AUDIO ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      
      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      audioChunks.current = [];
      
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: mimeType });
        const extension = mimeType.includes('webm') ? 'webm' : 'm4a';
        const path = `week_infos/${Date.now()}.${extension}`;
        
        const { error: upErr } = await supabase.storage.from('session-files').upload(path, audioBlob);
        if (upErr) throw upErr;

        const { data: { publicUrl } } = supabase.storage.from('session-files').getPublicUrl(path);
        await uploadToDB(publicUrl, 'audio');
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (e) {
      alert("Micro inaccessible");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  // --- GESTION PHOTO ---
  const handlePhotoUpload = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const path = `week_infos/${Date.now()}.jpg`;
      const { error: upErr } = await supabase.storage.from('session-files').upload(path, file);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from('session-files').getPublicUrl(path);
      await uploadToDB(publicUrl, 'photo');
    } catch (err: any) {
      alert("Erreur upload photo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-blue-900 text-white rounded-[2.5rem] p-6 shadow-2xl flex flex-col border-4 border-blue-400 min-h-[450px] relative">
      <div className="mb-4">
        <h2 className="text-xl font-black italic uppercase leading-none">Notes Générales</h2>
        <span className="text-[10px] font-bold text-blue-300 uppercase tracking-widest">{day || 'Général'}</span>
      </div>

      <div className="flex-1 space-y-3 mb-6 overflow-y-auto max-h-[400px] pr-2 scrollbar-hide">
        {infos.map((info) => (
          <div key={info.id} className="relative group bg-blue-800/50 p-3 rounded-2xl border border-blue-700/50 animate-in fade-in slide-in-from-bottom-2">
            {info.type === 'text' && <p className="text-xs font-bold italic">{info.content}</p>}
            {info.type === 'audio' && <audio src={info.content} controls className="w-full h-8 invert opacity-70" />}
            {info.type === 'photo' && (
              <img 
                src={info.content} 
                onClick={() => setSelectedPhoto(info.content)}
                className="w-full rounded-xl cursor-zoom-in hover:scale-[1.02] transition-transform shadow-lg border border-white/10" 
              />
            )}
            <button 
              onClick={async () => { 
                await supabase.from('week_infos').delete().eq('id', info.id); 
                fetchInfos(); 
              }} 
              className="absolute -top-1 -right-1 bg-red-500 rounded-full w-5 h-5 text-[8px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow-md"
            >
              ✕
            </button>
          </div>
        ))}
        {infos.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-blue-400 opacity-30 italic">
            <span className="text-2xl mb-1">📝</span>
            <span className="text-[8px] font-black uppercase tracking-tighter">Aucune note</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mt-auto">
        <button 
          onMouseDown={startRecording} 
          onMouseUp={stopRecording} 
          onMouseLeave={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          className={`py-4 rounded-2xl flex items-center justify-center transition-all shadow-xl active:scale-95 ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-blue-700 hover:bg-blue-600'}`}
        >
          🎙️
        </button>
        <label className="bg-blue-700 py-4 rounded-2xl flex items-center justify-center cursor-pointer shadow-xl hover:bg-blue-600 transition-all active:scale-95">
          📸 <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
        </label>
        <button 
          onClick={() => setIsTyping(!isTyping)} 
          className={`py-4 rounded-2xl flex items-center justify-center text-xl shadow-xl transition-all active:scale-95 ${isTyping ? 'bg-white text-blue-900' : 'bg-blue-600 hover:bg-blue-500'}`}
        >
          📝
        </button>
      </div>

      {isTyping && (
        <form 
          onSubmit={(e) => { 
            e.preventDefault(); 
            if(inputValue.trim()) {
              uploadToDB(inputValue, 'text'); 
              setInputValue(""); 
              setIsTyping(false); 
            }
          }} 
          className="mt-3 flex gap-2 animate-in slide-in-from-top-2"
        >
          <input 
            autoFocus
            value={inputValue} 
            onChange={e => setInputValue(e.target.value)} 
            className="flex-1 bg-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none border border-white/20 placeholder:text-blue-300" 
            placeholder="Écrire une note..." 
          />
          <button type="submit" className="bg-white text-blue-900 px-4 rounded-xl font-black text-[10px] uppercase italic">OK</button>
        </form>
      )}

      {/* MODAL ZOOM PHOTO */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-[999] bg-black/95 flex items-center justify-center p-4" onClick={() => setSelectedPhoto(null)}>
          <img src={selectedPhoto} className="max-w-full max-h-full object-contain rounded-lg animate-in zoom-in duration-200" />
          <button className="absolute top-6 right-6 bg-white/20 text-white p-4 rounded-full font-black text-xl hover:bg-white/40 transition-all">✕</button>
        </div>
      )}
    </div>
  );
}