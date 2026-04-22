"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

export default function ChatModal({ isOpen, onClose, profile }: any) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll automatique vers le dernier message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      fetchMessages();

      // ABONNEMENT TEMPS RÉEL
      const channel = supabase.channel('global_chat_realtime')
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'global_chat' }, 
          (payload) => {
            setMessages((prev) => {
              // Évite d'afficher deux fois le même message
              if (prev.find(m => m.id === payload.new.id)) return prev;
              return [...prev, payload.new];
            });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen]);

  // Déclenche le scroll quand la liste de messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from('global_chat')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(100);
    
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    const messageToSend = {
      content: newMessage,
      sender_name: profile.prenom,
      user_id: profile.id,
    };

    // Envoi à Supabase
    const { data, error } = await supabase
      .from('global_chat')
      .insert([messageToSend])
      .select();

    if (error) {
      console.error("Erreur:", error);
    } else if (data) {
      // Ajout immédiat pour la fluidité
      setMessages((prev) => {
        if (prev.find(m => m.id === data[0].id)) return prev;
        return [...prev, data[0]];
      });
      setNewMessage("");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-2 sm:p-4 backdrop-blur-md">
      <div className="bg-white w-full max-w-xl h-[85vh] rounded-[2.5rem] flex flex-col shadow-2xl overflow-hidden border-t-[10px] border-blue-600 animate-in zoom-in duration-300">
        
        {/* HEADER DU CHAT */}
        <div className="p-6 border-b flex justify-between items-center bg-gray-50/50">
          <div>
            <h2 className="font-[900] italic uppercase text-blue-600 text-xl tracking-tighter flex items-center gap-2">
              <span>💬</span> DISCUSSION ÉQUIPE
            </h2>
            <p className="text-[10px] font-black text-gray-400 uppercase italic">Live Feedback & Coaching</p>
          </div>
          <button 
            onClick={onClose} 
            className="bg-gray-200 hover:bg-red-100 hover:text-red-500 transition-all w-10 h-10 rounded-full flex items-center justify-center font-black text-gray-600"
          >
            ✕
          </button>
        </div>
        
        {/* MESSAGES */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#F8F9FA]">
          {messages.map((m, i) => (
            <div key={m.id || i} className={`flex flex-col ${m.user_id === profile.id ? 'items-end' : 'items-start'}`}>
              <span className={`text-[9px] font-[900] uppercase italic mb-1 px-2 ${m.user_id === profile.id ? 'text-blue-500' : 'text-gray-400'}`}>
                {m.sender_name} • {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className={`p-4 rounded-2xl max-w-[85%] shadow-sm font-bold italic text-sm leading-tight ${
                m.user_id === profile.id 
                ? 'bg-blue-600 text-white rounded-tr-none' 
                : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* BARRE D'ENVOI AVEC LE SKIEUR */}
        <div className="p-4 sm:p-6 bg-white border-t flex gap-3 items-center">
          <input 
            value={newMessage} 
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="ÉCRIRE À L'ÉQUIPE..." 
            className="flex-1 bg-gray-100 p-4 rounded-2xl font-black italic uppercase text-xs outline-none focus:ring-4 ring-blue-50 transition-all"
          />
          <button 
            onClick={sendMessage} 
            disabled={!newMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100 transition-all active:scale-90 overflow-hidden"
          >
            {/* Le skieur qui fonce vers la droite */}
            <span className="text-3xl transform scale-x-[-1] translate-x-1 motion-safe:hover:translate-x-3 transition-transform">
              ⛷️
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}