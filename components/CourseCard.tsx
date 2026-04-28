"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Download } from 'lucide-react';

export default function CourseCard({ slot, profile, currentWeek, day, binomeId }: any) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('gris'); 
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [comment, setComment] = useState("");
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
    // 1. Filtrage SQL : On ne télécharge pas les logs de statut
    const { data: messages, error: errorMessages } = await supabase
      .from('submissions')
      .select('*')
      .eq('course_name', slotId)
      .eq('binome_id', binomeId)
      .not('comment', 'ilike', '%statut%')
      .not('comment', 'ilike', 'HIDDEN_LOG:%')
      .order('created_at', { ascending: false });
    
    // 2. Récupération du statut réel pour la couleur
    const { data: statusData, error: errorStatus } = await supabase
      .from('submissions')
      .select('status')
      .eq('course_name', slotId)
      .eq('binome_id', binomeId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (!errorMessages && messages) {
      setSubmissions(messages);
    }

    if (!errorStatus && statusData && statusData.length > 0) {
      setStatus(statusData[0].status?.toLowerCase() || 'gris');
    }
  };

  const performInsert = async (finalStatus: string, finalComment: string, extras = {}) => {
    try {
      const { error: insertError } = await supabase.from('submissions').insert({
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

      if (insertError) throw insertError;

      const { data: binomeData } = await supabase
        .from('binomes')
        .select('skieur_id, collaborateur_id')
        .eq('id', binomeId)
        .single();

      if (binomeData) {
        const targetId = profile.id === binomeData.skieur_id 
          ? binomeData.collaborateur_id 
          : binomeData.skieur_id;

        if (targetId) {
          await supabase.from('notifications').insert({
            user_id: targetId,
            sender_name: profile?.prenom || 'Ton binôme',
            content: finalComment.startsWith('HIDDEN_LOG:') 
              ? `Nouveau statut : ${finalStatus}` 
              : `Modif sur ${day} (${slot.time}) : ${finalComment.substring(0, 30)}...`,
            link: day
          });
        }
      }

      await fetchData();
    } catch (err: any) {
      console.error("Erreur insertion:", err.message);
    }
  };

  const sendText = async () => {
    if (!comment.trim()) return;
    setLoading(true);
    await performInsert(status, comment.trim());
    setComment("");
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
      await performInsert(status, `Fichier : ${file.name}`, { file_url: publicUrl });
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
      mediaRecorder.current.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      mediaRecorder.current.onstop = async () => {
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
          await performInsert(status, "Note Vocale", { audio_url: publicUrl });
        } catch (err) { console.error("Erreur audio:", err); }
        setLoading(false);
        setIsRecording(false);
      };
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (err) { alert("Micro inaccessible."); }
  };

  const stopRecording = () => { if (mediaRecorder.current && isRecording) mediaRecorder.current.stop(); };

  const updateStatus = async (newColor: string) => {
    const color = newColor.toLowerCase().trim();
    await performInsert(color, `HIDDEN_LOG: Statut passé à ${color}`); 
  };

  const deleteItem = async (id: string) => {
    if (confirm("Supprimer ce message ?")) {
      await supabase.from('submissions').delete().eq('id', id);
      fetchData();
    }
  };

  // Fonction utilitaire pour filtrer l'affichage côté client
  const filteredSubmissions = submissions.filter(s => 
    !s.comment.includes("HIDDEN_LOG:") && 
    !s.comment.toLowerCase().includes("statut mis à jour")
  );

  return (
    <div className={`bg-white rounded-3xl shadow-md border-l-[10px] flex flex-col h-full min-h-[350px] overflow-hidden transition-all duration-500 ${statusStyles[status]?.border || 'border-gray-200'}`}>
      
      {zoomedImage && (
        <div className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="Zoom" />
        </div>
      )}

      {/* Header */}
      <div className="p-3 border-b flex justify-between items-center bg-white">
        <span className="font-black italic text-xl text-blue-600 tracking-tighter">{slot.time}</span>
        <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${statusStyles[status]?.bg} ${statusStyles[status]?.text}`}>
          ● {status}
        </span>
      </div>

      {/* Liste des messages filtrée à l'affichage */}
      <div className="p-2 flex-1 overflow-y-auto space-y-2 bg-gray-50/50">
        {filteredSubmissions.length === 0 && (
          <div className="h-full flex items-center justify-center text-[10px] font-bold text-gray-300 uppercase italic">Aucune activité</div>
        )}
        {filteredSubmissions.map((s) => (
          <div key={s.id} className="bg-white p-2.5 rounded-2xl shadow-sm border border-gray-100 relative group animate-in fade-in slide-in-from-bottom-1">
            <button onClick={() => deleteItem(s.id)} className="absolute top-1 right-1 text-red-400 opacity-0 group-hover:opacity-100 p-1 transition-opacity">✕</button>
            <div className="flex justify-between items-center mb-1 text-[7px] font-black text-blue-400 uppercase italic tracking-widest">
              <span>{s.author}</span>
              <span>{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <p className="text-[10px] font-bold uppercase italic leading-tight text-gray-800">{s.comment}</p>
            
            {s.file_url && (
              <div className="mt-2 space-y-2">
                {s.file_url.match(/\.(jpeg|jpg|gif|png)$/i) ? (
                  <div className="relative group/img">
                    <img 
                      src={s.file_url} 
                      onClick={() => setZoomedImage(s.file_url)} 
                      className="w-full h-32 object-cover rounded-xl border border-gray-100 cursor-zoom-in" 
                      alt="Doc" 
                    />
                    <a 
                      href={s.file_url} 
                      download 
                      target="_blank"
                      className="flex items-center justify-center gap-1 mt-1 bg-gray-900/80 text-white p-2 rounded-xl text-[8px] font-black uppercase italic tracking-tighter"
                    >
                      <Download size={10} /> Enregistrer la photo
                    </a>
                  </div>
                ) : (
                  <a 
                    href={s.file_url} 
                    target="_blank" 
                    download
                    className="flex items-center justify-center gap-2 bg-blue-600 p-2.5 rounded-xl text-[8px] font-black text-white text-center uppercase tracking-widest border border-blue-700 shadow-sm"
                  >
                    <Download size={12} /> Télécharger le document
                  </a>
                )}
              </div>
            )}
            
            {s.audio_url && <audio src={s.audio_url} controls className="h-7 w-full mt-2" />}
          </div>
        ))}
      </div>

      {/* Actions Footer */}
      <div className="p-3 bg-white border-t space-y-2">
        {status !== 'vert' ? (
          <>
            <div className="flex gap-1.5">
              <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="AJOUTER UNE NOTE..." className="flex-1 p-3 text-[10px] font-black uppercase italic border-2 border-gray-100 rounded-2xl bg-gray-50 focus:border-blue-600 outline-none transition-all" />
              <button onClick={sendText} disabled={!comment.trim() || loading} className="bg-blue-600 text-white px-5 rounded-2xl font-black text-[10px] shadow-lg shadow-blue-200 disabled:opacity-50">OK</button>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <label className="bg-indigo-500 text-white p-3 rounded-2xl text-[10px] font-black text-center cursor-pointer flex items-center justify-center uppercase italic shadow-md">
                {loading ? "..." : "📎"}
                <input type="file" className="hidden" onChange={handleFileUpload} disabled={loading} />
              </label>
              <button 
                onMouseDown={startRecording} onMouseUp={stopRecording} 
                onTouchStart={startRecording} onTouchEnd={stopRecording} 
                className={`p-3 rounded-2xl text-[10px] font-black italic shadow-md transition-all ${isRecording ? 'bg-red-500 animate-pulse text-white scale-95' : 'bg-gray-100 text-gray-700'}`}>
                {isRecording ? "REC..." : "🎤"}
              </button>
              <button onClick={() => updateStatus(status === 'rouge' ? 'orange' : 'vert')} className={`${status === 'rouge' ? 'bg-orange-500 shadow-orange-200' : 'bg-green-600 shadow-green-200'} text-white p-3 rounded-2xl text-[10px] font-black uppercase italic shadow-md`}>
                {status === 'rouge' ? 'REPRENDRE' : 'VALIDER'}
              </button>
            </div>
          </>
        ) : (
          <button onClick={() => updateStatus('orange')} className="w-full bg-green-50 text-green-700 p-4 rounded-2xl text-[11px] font-black text-center border-2 border-green-200 italic uppercase shadow-inner tracking-tighter">
            ✓ SÉANCE TERMINÉE (MODIFIER)
          </button>
        )}
      </div>
    </div>
  );
}