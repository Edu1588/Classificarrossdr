import React from 'react';
import ChatWidget from '../components/ChatWidget';

export default function HomePage() {
  return (
    <div 
      className="min-h-screen w-full bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url("https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=2070&auto=format&fit=crop")' }}
    >
      {/* Chat Widget */}
      <ChatWidget />
    </div>
  );
}
