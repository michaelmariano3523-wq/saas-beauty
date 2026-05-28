import * as React from 'react';

export default function TechsView({ shopId, onNavigate, maxTechs }: { shopId: string; onNavigate: (v: string) => void; maxTechs: number }) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Barbeadores</h2>
      <p className="text-gray-500">Modulo em desenvolvimento.</p>
    </div>
  );
}
