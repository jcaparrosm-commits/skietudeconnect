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

  // ID UNIQUE : SEMAINE + PLANNING + JOUR + HEURE (Sécurisé avec ?)
  const slotId = `${currentWeek}-${profile?.linked_planning || 'standard'}-${day}-${slot.time}`;

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
        setStatus(data[0].status || 'gris');
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
    let url = linkInput.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    await saveSubmission({ link_url: url, comment: "🔗 Lien ajouté" });
    setLinkInput("");
    setLoading(false);
  };

  // NOUVEAU : GESTION MULTI-FICHIERS (PHOTO OU DOCUMENT)
  const handleFileUpload = async (event: any) => {
    const file = event.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const { error: upErr } = await supabase.storage.from('cours-documents').upload(fileName, file);
      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage.from('cours-documents').getPublicUrl(fileName);
      
      const isImage = file.name.match(/\.(jpeg|jpg|gif|png)$/i);
      await saveSubmission({ 
        file_url: publicUrl, 
        comment: isImage ? "" : `📄 Doc: ${file.name}` 
      });
    } catch (err: any) {
      alert("Erreur upload : " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // CORRECTIF AUDIO : MULTI-PLATEFORME (iOS/Android)
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      
      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        const extension = mimeType.includes('webm') ? 'webm' : 'm4a';
        const blob = new Blob(chunks, { type: mimeType });
        const fileName = `audio-${Date.now()}.${extension}`;
        
        setLoading(true);
        try {
          const { error: upErr } = await supabase.storage.from('cours-documents').upload(fileName, blob, { contentType: mimeType });
          if (upErr) throw upErr;
          const { data: { publicUrl } } = supabase.storage.from('cours-documents').getPublicUrl(fileName);
          await saveSubmission({ audio_url: publicUrl });
        } catch (err: any) {
          alert("Erreur audio : " + err.message);
        } finally {
          setLoading(false);
          setIsRecording(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };
      
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) { alert("Micro bloqué ou non supporté"); }
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
    <div className={`bg-white rounded-3xl shadow-md border-l-[10px] flex flex-col h-full min-h-[300px] overflow-hidden transition-all duration-500 ${statusStyles[status].border}`}>
      
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

      {/* HISTORIQUE / SUBMISSIONS MAP */}
      <div className="p-2 flex-1 overflow-y-auto space-y-2 bg-[#F9FAFB]">
        {submissions.map((s) => (
          <div key={s.id} className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 relative group animate-in fade-in slide-in-from-bottom-2">
            <button onClick={() => deleteItem(s.id)} className="absolute top-1 right-1 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
            <div className="flex justify-between items-center mb-1 text-[7px] font-black text-blue-400 uppercase italic">
              <span>{s.author}</span>
              <span>{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            
            {s.comment && <p className="text-[9px] font-bold text-gray-800 uppercase italic leading-tight">{s.comment}</p>}
            
            {s.link_url && (
              <a href={s.link_url} target="_blank" rel="noopener noreferrer" className="mt-2 block w-full bg-blue-600 text-white text-center py-2 rounded-lg text-[8px] font-black uppercase italic tracking-widest hover:bg-blue-700 transition-all shadow-sm">
                🔗 Ouvrir le lien
              </a>
            )}

            {/* GESTION PHOTO ET DOCUMENTS */}
            {s.file_url && (
              <div className="mt-2 relative">
                {s.file_url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                  <div className="relative group">
                    <img src={s.file_url} onClick={() => setZoomedImage(s.file_url)} className="w-full h-32 object-cover rounded-xl cursor-zoom-in" />
                    <a href={s.file_url} target="_blank" download className="absolute bottom-2 right-2 bg-white/90 p-2 rounded-lg shadow-md flex items-center gap-1 active:scale-95 transition-all">
                      <span className="text-[10px]">📥</span>
                      <span className="text-[7px] font-black uppercase text-blue-600">Enregistrer</span>
                    </a>
                  </div>
                ) : (
                  <a href={s.file_url} target="_blank" download className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg border border-blue-100 hover:bg-blue-100 transition-all">
                    <span className="text-xl">📄</span>
                    <span className="text-[8px] font-black text-blue-700 uppercase italic">Télécharger le document</span>
                  </a>
                )}
              </div>
            )}

            {s.audio_url && <audio src={s.audio_url} controls className="h-7 w-full mt-1" />}
          </div>
        ))}
        {submissions.length === 0 && <p className="text-[8px] text-gray-300 italic text-center mt-10 uppercase font-black">Disponible</p>}
      </div>

      {/* ZONE DE SAISIE */}
      <div className="p-2 bg-white border-t space-y-1.5">
        {status !== 'vert' ? (
          <>
            <div className="flex gap-1">
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="NOTE..." className="flex-1 p-2 text-[10px] font-bold uppercase italic border rounded-xl bg-gray-50 outline-none" />
              <button onClick={sendText} disabled={!comment.trim() || loading} className="bg-blue-600 text-white px-3 rounded-xl font-black text-[9px]">OK</button>
            </div>

            <div className="flex gap-1">
              <input value={linkInput} onChange={(e) => setLinkInput(e.target.value)} placeholder="LIEN..." className="flex-1 p-2 text-[10px] font-bold uppercase italic border border-sky-100 rounded-xl bg-sky-50 outline-none" />
              <button onClick={sendLink} disabled={!linkInput.trim() || loading} className="bg-sky-500 text-white px-3 rounded-xl font-black text-[9px]">🔗</button>
            </div>

            <div className="grid grid-cols-3 gap-1">
              <label className="bg-indigo-500 text-white p-2 rounded-xl text-[8px] font-[900] text-center cursor-pointer active:scale-95 uppercase italic shadow-sm flex items-center justify-center">
                {loading ? "..." : "📎 JOINDRE"}
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={loading} />
              </label>
              
              <button 
                onMouseDown={startRecording} onMouseUp={() => mediaRecorder.current?.stop()} 
                onTouchStart={startRecording} onTouchEnd={() => mediaRecorder.current?.stop()}
                className={`p-2 rounded-xl text-[8px] font-[900] transition-all active:scale-95 italic shadow-sm ${isRecording ? 'bg-red-500 animate-pulse text-white' : 'bg-gray-100 text-gray-700'}`}>
                {isRecording ? "REC" : "🎤"}
              </button>

              <button onClick={() => updateStatus(status === 'rouge' ? 'orange' : 'vert')} className={`${status === 'rouge' ? 'bg-orange-500' : 'bg-green-600'} text-white p-2 rounded-xl text-[8px] font-[900] uppercase italic shadow-md`}>
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