import { useRef, useEffect } from 'react';
import useChatEngine from '../../hooks/useChatEngine';
import MessageBubble from './MessageBubble'; // your existing component

export default function ChatView({ groupId }) {
  const { messages, loadOlderMessages, loadingOlder, hasMore } = useChatEngine(groupId);
  const containerRef = useRef(null);
  const bottomRef = useRef(null);

  // Auto‑scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (el && el.scrollTop === 0 && hasMore && !loadingOlder) {
      loadOlderMessages();
    }
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4"
    >
      {loadingOlder && (
        <div className="text-center text-gray-500 py-2">Loading older messages...</div>
      )}
      {messages.map(msg => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
