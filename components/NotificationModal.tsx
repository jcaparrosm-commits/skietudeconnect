"use client";
import { supabase } from '@/lib/supabase';

export default function NotificationModal({ isOpen, onClose, notifications, onRefresh }: any) {
  if (!isOpen) return null;

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    onRefresh();
  };

  const markAllRead = async () => {
    if (notifications.length === 0) return;
    const ids = notifications.map((n: any) => n.id);
    await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    onRefresh();
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        <div className="p-6 border-b flex justify-between items-center bg-blue-600 text-white">
          <h2 className="font-black italic uppercase tracking-tighter">notifications</h2>
          <button onClick={markAllRead} className="text-[10px] font-black uppercase underline">Tout lire</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {notifications.length === 0 ? (
            <p className="text-center text-gray-400 font-bold italic py-10 uppercase text-xs">Aucune nouvelle notification</p>
          ) : (
            notifications.map((n: any) => (
              <div key={n.id} className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex flex-col gap-1">
                <div className="flex justify-between items-start">
                  <span className="font-black text-blue-600 text-[10px] uppercase italic">{n.sender_name}</span>
                  <span className="text-[8px] text-gray-400 font-bold">{new Date(n.created_at).toLocaleDateString()}</span>
                </div>
                <p className="text-xs font-bold text-blue-900">{n.content}</p>
                <button 
                  onClick={() => markAsRead(n.id)}
                  className="mt-2 text-left text-[9px] font-black text-blue-500 uppercase italic underline"
                >
                  Marquer comme lu
                </button>
              </div>
            ))
          )}
        </div>
        
        <button onClick={onClose} className="p-4 bg-gray-100 font-black uppercase italic text-xs text-gray-500 hover:bg-gray-200">Fermer</button>
      </div>
    </div>
  );
}