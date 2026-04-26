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
  const audioStream = useRef<MediaStream | null>(null);

  const slotId = `${currentWeek}-${profile?.linked_planning || 'standard'}-${day}-${slot.time}`;

  const statusStyles: any = {
    gris: { border: 'border-gray-200', bg: 'bg-gray-100', text: 'text-gray-500' },
    rouge: { border: 'border-red-500', bg: 'bg-red-100', text: 'text-red-700' },
    orange: { border: 'border-orange-500', bg: 'bg-orange-100', text: 'text-orange-700' },
    vert: { border: 'border-green-500', bg: 'bg-green-100', text: 'text-green-700' },
  };

  useEffect(() => {
    if (binomeId) fetchData();
  }, [slotId, binomeId]);

  const fetchData = async () => {
    const { data, error } = await supabase
      .from('submissions')
      .select('*')
      .eq('course_name', slotId)
      .eq('binome_id', binomeId)
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setSubmissions(data);
      setStatus(data[0]?.status?.toLowerCase() || 'gris');
    }
  };

  const performInsert = async (finalStatus: string, finalComment: string, extras = {}) => {
    try {
      const { error } = await supabase.from('submissions').insert({
        course_name: slotId,
        day_name: day.toLowerCase().trim(),
        week_id: currentWeek,
        binome_id: binomeId,
        user_id: profile?.id || 'anonymous',
        author: profile?.prenom || 'Anonyme',
        status: finalStatus.toLowerCase(),
        comment: finalComment, 
        ...extras
      });
      if (error) throw error;
      await fetchData();
    } catch (err: any) {
      console.error("Erreur insertion:", err.message);
    }
  };

  const sendText = async () => {
    if (!comment.trim()) return;
    setLoading(true);
    await performInsert('orange', comment.trim());
    setComment("");
    setLoading(false);
  };

  const sendLink = async () => {
    if (!linkInput.trim()) return;
    setLoading(true);
    let url = linkInput.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    await performInsert('orange', "Lien ajouté", { link_url: url });
    setLinkInput("");
    setLoading(false);
  };

  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    try {
      const fileName = `${Date.now()}-${file.name}`;
      await supabase.storage.from('cours-documents').upload(fileName, file);
      const { data: { publicUrl } } = supabase.storage.from('cours-documents').getPublicUrl(fileName);
      await performInsert('orange', `Fichier : ${file.name}`, { file_url: publicUrl });
    } catch (err) { alert("Erreur upload"); }
    setLoading(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStream.current = stream;
      
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/webm';
      mediaRecorder.current = new MediaRecorder(stream, { mimeType });
      const chunks: Blob[] = [];
      
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        // CORRECTION IPHONE : On coupe le flux immédiatement
        if (audioStream.current) {
          audioStream.current.getTracks().forEach(track => track.stop());
          audioStream.current = null;
        }

        setLoading(true);
        try {
          const extension = mimeType.includes('mp4') ? 'm4a' : 'webm';
          const blob = new Blob(chunks, { type: mimeType });
          const fileName = `audio-${Date.now()}.${extension}`;
          
          await supabase.storage.from('cours-documents').upload(fileName, blob);
          const { data: { publicUrl } } = supabase.storage.from('cours-documents').getPublicUrl(fileName);
          await performInsert('orange', "Note Vocale", { audio_url: publicUrl });
        } catch (err) {
          console.error("Erreur audio:", err);
        } finally {
          setLoading(false);
          setIsRecording(false);
        }
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) { 
      alert("Micro inaccessible."); 
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
    }
  };

  const updateStatus = async (newColor: string) => {
    const color = newColor.toLowerCase().trim();
    await performInsert(color, color); 
  };

  const deleteItem = async (id: string) => {
    if (confirm("Supprimer ?")) {
      await supabase.from('submissions').delete().eq('id', id);
      fetchData();
    }
  };

  return (
    <div className={`bg-white rounded-3xl shadow-md border-l-[10px] flex flex-col h-full min-h-[300px] overflow-hidden transition-all duration-500 ${statusStyles[status]?.border || 'border-gray-200'}`}>
      
      {zoomedImage && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-lg" alt="Zoom" />
        </div>
      )}

      {/* Header */}
      <div className="p-3 border-b flex justify-between items-center bg-white">
        <span className="font-black italic text-xl text-blue-600">{slot.time}</span>
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${statusStyles[status]?.bg} ${statusStyles[status]?.text}`}>
          ● {status}
        </span>
      </div>

      {/* Messages */}
      <div className="p-2 flex-1 overflow-y-auto space-y-2 bg-gray-50">
        {submissions.map((s) => {
          const rawComment = s.comment || "";
          const cleanComment = rawComment.replace(/Statut\s*:\s*/gi, "").trim();
          const low = cleanComment.toLowerCase();

          return (
            <div key={s.id} className="bg-white p-2 rounded-xl shadow-sm border border-gray-100 relative group">
              <button onClick={() => deleteItem(s.id)} className="absolute top-1 right-1 text-red-400 opacity-0 group-hover:opacity-100">✕</button>
              <div className="flex justify-between items-center mb-1 text-[7px] font-black text-blue-400 uppercase italic">
                <span>{s.author}</span>
                <span>{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              
              {rawComment && (
                <p className={`text-[10px] font-bold uppercase italic leading-tight ${
                  low === 'vert' ? 'text-green-600' : 
                  low === 'orange' ? 'text-orange-600' : 'text-gray-800'
                }`}>
                  {cleanComment}
                </p>
              )}

              {s.link_url && <a href={s.link_url} target="_blank" className="mt-2 block w-full bg-blue-600 text-white text-center py-2 rounded-lg text-[8px] font-black uppercase italic shadow-sm">🔗 LIEN</a>}
              
              {s.file_url && (
                <div className="mt-2 flex flex-col gap-1.5">
                  {s.file_url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                    <img src={s.file_url} onClick={() => setZoomedImage(s.file_url)} className="w-full h-32 object-cover rounded-xl border cursor-zoom-in" alt="Fichier" />
                  ) : null}
                  <a href={s.file_url} download target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-blue-50 border border-blue-100 p-2 rounded-xl">
                    <span className="text-xs">📥</span>
                    <span className="text-[8px] font-black text-blue-700 uppercase italic">Télécharger</span>
                  </a>
                </div>
              )}

              {s.audio_url && <audio src={s.audio_url} controls className="h-7 w-full mt-1" />}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-2 bg-white border-t space-y-2">
        {status !== 'vert' ? (
          <>
            <div className="flex gap-1">
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="NOTE..." className="flex-1 p-2 text-[10px] font-bold uppercase italic border rounded-xl bg-gray-50 outline-none" />
              <button onClick={sendText} disabled={!comment.trim() || loading} className="bg-blue-600 text-white px-4 rounded-xl font-black text-[10px]">OK</button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <label className="bg-indigo-500 text-white p-2 rounded-xl text-[9px] font-black text-center cursor-pointer flex items-center justify-center uppercase italic">
                {loading ? "..." : "📎"}
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={loading} />
              </label>
              <button 
                onMouseDown={startRecording} onMouseUp={stopRecording} 
                onTouchStart={startRecording} onTouchEnd={stopRecording} 
                className={`p-2 rounded-xl text-[9px] font-black italic ${isRecording ? 'bg-red-500 animate-pulse text-white' : 'bg-gray-100 text-gray-700'}`}>
                {isRecording ? "REC" : "🎤"}
              </button>
              <button onClick={() => updateStatus(status === 'rouge' ? 'orange' : 'vert')} className={`${status === 'rouge' ? 'bg-orange-500' : 'bg-green-600'} text-white p-2 rounded-xl text-[9px] font-black uppercase italic`}>
                {status === 'rouge' ? 'OUVRIR' : 'FINIR'}
              </button>
            </div>
          </>
        ) : (
          <div onClick={() => updateStatus('orange')} className="bg-green-50 text-green-700 p-2 rounded-xl text-[10px] font-black text-center border border-green-200 cursor-pointer italic uppercase">VALIDÉE ✓</div>
        )}
      </div>
    </div>
  );
}