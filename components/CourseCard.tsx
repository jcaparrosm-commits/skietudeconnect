"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function CourseCard({ slot, profile, currentWeek, day, binomeId }: any) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('gris'); 
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [comment, setComment] = useState("");
  const [linkInput, setLinkInput] = useState(""); 
  const [isRecording, setIsRecording] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  
  const mediaRecorder = useRef<MediaRecorder | null>(null);

  // ID UNIQUE : SEMAINE + PLANNING + JOUR + HEURE
  const slotId = `${currentWeek}-${profile.linked_planning}-${day}-${slot.time}`;

  const statusStyles: any = {
    gris: { border: 'border-gray-200', bg: 'bg-gray-100', text: 'text-gray-500' },
    rouge: { border: 'border-red-500', bg: 'bg-red-100', text: 'text-red-700' },
    orange: { border: 'border-orange-500', bg: 'bg-orange-100', text: 'text-orange-700' },
    vert: { border: 'border-green-500', bg: 'bg-green-100', text: 'text-green-700' },
  };

  useEffect(() => {
    if (binomeId) {
      fetchData();
    }
  }, [slotId, binomeId]);

  const fetchData = async () => {
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .eq('course_name', slotId)
      .eq('binome_id', binomeId)
      .order('created_at', { ascending: false });
    
    if (data) {
      setSubmissions(data);
      if (data.length > 0) {
        const lastStatus = data[0].status;
        setStatus(lastStatus || 'gris');
      } else {
        setStatus('gris');
      }
    }
  };

  const saveSubmission = async (payload: any) => {
    const newStatus = status === 'gris' ? 'rouge' : status;
    try {
      const { error } = await supabase.from('submissions').insert([{ 
        course_name: slotId, 
        status: newStatus, 
        author: profile.prenom, 
        user_id: profile.id || 'anonymous',
        binome_id: binomeId,
        ...payload 
      }]);
      if (error) throw error;
      setStatus(newStatus);
      await fetchData();
    } catch (err: any) {
      alert("Erreur : " + err.message);
    }
  };

  const sendText = async () => {
    if (!comment.trim()) return;
    setLoading(true);
    await saveSubmission({ comment: comment });
    setComment("");
    setLoading(false);
  };

  const sendLink = async () => {
    if (!linkInput.trim()) return;
    setLoading(true);
    // On s'assure que le lien commence par http si l'utilisateur l'oublie
    let url = linkInput.trim();
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    await saveSubmission({ link_url: url, comment: "🔗 Lien ajouté" });
    setLinkInput("");
    setLoading(false);
  };

  const uploadPhoto = async (event: any) => {
    const file = event.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('cours-documents').upload(fileName, file);
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from('cours-documents').getPublicUrl(fileName);
      await saveSubmission({ file_url: publicUrl });
    } catch (err: any) {
      alert("Erreur photo : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mediaRecorder.current.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const fileName = `audio-${Date.now()}.webm`;
        setLoading(true);
        try {
          const { error: upErr } = await supabase.storage.from('cours-documents').upload(fileName, blob);
          if (upErr) throw upErr;
          const { data: { publicUrl } } = supabase.storage.from('cours-documents').getPublicUrl(fileName);
          await saveSubmission({ audio_url: publicUrl });
        } catch (err: any) {
          alert("Erreur audio : " + err.message);
        } finally {
          setLoading(false);
          setIsRecording(false);
        }
      };
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) { alert("Micro bloqué"); }
  };

  const updateStatus = async (newStat: string) => {
    await saveSubmission({ comment: `Statut modifié en ${newStat}`, status: newStat });
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Supprimer ?")) return;
    await supabase.from('submissions').delete().eq('id', id);
    fetchData();
  };

  return (
    <div className={`bg-white rounded-3xl shadow-md border-l-[10px] flex flex-col h-full min-h-[280px] overflow-hidden transition-all duration-500 ${statusStyles[status].border}`}>
      
      {zoomedImage && (
        <div className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        </div>
      )}

      {/* HEADER */}
      <div className="p-3 border-b flex justify-between items-center bg-white">
        <span className="font-[900] italic text-xl text-blue-600 tracking-tighter">{slot.time}</span>
        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${statusStyles[status].bg} ${statusStyles[status].text}`}>
          ● {status}
        </span>
      </div>

      {/* HISTORIQUE DES MESSAGES */}
      <div className="p-2 flex-1 overflow-y-auto space-y-2 bg-[#F9FAFB]">
        {submissions.map((s) => (
          <div key={s.id} className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 relative group animate-in fade-in slide-in-from-bottom-2">
            <button onClick={() => deleteItem(s.id)} className="absolute top-1 right-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
            <div className="flex justify-between items-center mb-1 text-[7px] font-black text-blue-400 uppercase italic">
              <span>{s.author}</span>
              <span>{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            
            {s.comment && <p className="text-[9px] font-bold text-gray-800 uppercase italic leading-tight">{s.comment}</p>}
            
            {/* BOUTON LIEN DANS LE MESSAGE */}
            {s.link_url && (
              <a href={s.link_url} target="_blank" rel="noopener noreferrer" className="mt-2 block w-full bg-blue-600 text-white text-center py-2 rounded-lg text-[8px] font-black uppercase italic tracking-widest hover:bg-blue-700 transition-all shadow-sm">
                🔗 Ouvrir le lien
              </a>
            )}

            {s.file_url && <img src={s.file_url} onClick={() => setZoomedImage(s.file_url)} className="w-full h-20 object-cover rounded-lg mt-1 cursor-zoom-in" />}
            {s.audio_url && <audio src={s.audio_url} controls className="h-6 w-full mt-1" />}
          </div>
        ))}
        {submissions.length === 0 && <p className="text-[8px] text-gray-300 italic text-center mt-10 uppercase font-black">Disponible</p>}
      </div>

      {/* ZONE DE SAISIE */}
      <div className="p-2 bg-white border-t space-y-1.5">
        {status !== 'vert' ? (
          <>
            {/* Input Note Texte */}
            <div className="flex gap-1">
              <input 
                value={comment} 
                onChange={(e) => setComment(e.target.value)} 
                placeholder="NOTE..." 
                className="flex-1 p-2 text-[10px] font-bold uppercase italic border rounded-xl bg-gray-50 outline-none focus:border-blue-300" 
              />
              <button onClick={sendText} disabled={!comment.trim() || loading} className="bg-blue-600 text-white px-3 rounded-xl font-black text-[9px] uppercase active:scale-95 transition-transform shadow-md">OK</button>
            </div>

            {/* Input Lien Direct */}
            <div className="flex gap-1">
              <input 
                value={linkInput} 
                onChange={(e) => setLinkInput(e.target.value)} 
                placeholder="LIEN (HTTP...)" 
                className="flex-1 p-2 text-[10px] font-bold uppercase italic border border-sky-100 rounded-xl bg-sky-50 outline-none focus:border-sky-400" 
              />
              <button onClick={sendLink} disabled={!linkInput.trim() || loading} className="bg-sky-500 text-white px-3 rounded-xl font-black text-[9px] uppercase active:scale-95 transition-transform shadow-md">🔗</button>
            </div>

            {/* Boutons Actions (Photo, Micro, Status) */}
            <div className="grid grid-cols-3 gap-1">
              <label className="bg-indigo-500 text-white p-2 rounded-xl text-[8px] font-[900] text-center cursor-pointer active:scale-95 transition-all uppercase italic shadow-sm">
                {loading ? "..." : "📸"}
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={uploadPhoto} disabled={loading} />
              </label>
              
              <button 
                onMouseDown={startRecording} onMouseUp={() => mediaRecorder.current?.stop()} 
                onTouchStart={startRecording} onTouchEnd={() => mediaRecorder.current?.stop()}
                className={`p-2 rounded-xl text-[8px] font-[900] transition-all active:scale-95 italic shadow-sm ${isRecording ? 'bg-red-500 animate-pulse text-white' : 'bg-gray-100 text-gray-700'}`}>
                {isRecording ? "REC" : "🎤"}
              </button>

              <button 
                onClick={() => updateStatus(status === 'rouge' ? 'orange' : 'vert')} 
                className={`${status === 'rouge' ? 'bg-orange-500' : 'bg-green-600'} text-white p-2 rounded-xl text-[8px] font-[900] uppercase italic active:scale-95 shadow-md`}>
                {status === 'rouge' ? 'OUVRIR' : 'FINIR'}
              </button>
            </div>
          </>
        ) : (
          <div onClick={() => updateStatus('orange')} className="bg-green-50 text-green-700 p-2 rounded-xl text-[9px] font-black text-center border border-green-200 cursor-pointer italic uppercase">VALIDÉE ✓</div>
        )}
      </div>
    </div>
  );
}