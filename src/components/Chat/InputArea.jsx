import { useState, useEffect } from 'react';
import useChatEngine from '../../hooks/useChatEngine';
import { addToOfflineQueue, getAndClearOfflineQueue } from '../../utils/offlineQueue';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';

export default function InputArea({ groupId }) {
  const [text, setText] = useState('');
  const { sendMessage } = useChatEngine(groupId);
  const { workspaceId } = useWorkspace();
  const { user } = useAuth();

  // Sync offline queue when coming online
  useEffect(() => {
    const handleOnline = async () => {
      const queued = await getAndClearOfflineQueue();
      for (const msg of queued) {
        await sendMessage(msg.text);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [sendMessage]);

  const handleSend = async () => {
    if (!text.trim()) return;
    if (navigator.onLine) {
      await sendMessage(text);
    } else {
      await addToOfflineQueue({
        text,
        groupId,
        workspaceId,
        senderUid: user.uid,
        timestamp: Date.now(),
      });
      alert('Message saved. It will be sent when you are online.');
    }
    setText('');
  };

  return (
    <div className="p-2 border-t flex">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 p-2 border rounded"
        placeholder="Type a message..."
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
      />
      <button onClick={handleSend} className="ml-2 bg-blue-500 text-white px-4 py-2 rounded">
        Send
      </button>
    </div>
  );
}
