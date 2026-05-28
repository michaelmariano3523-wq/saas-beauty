import * as React from 'react';

export default function ClientesView({ shopId, onNavigate }: { shopId: string; onNavigate: (v: string) => void }) {
  return (
    <div className="p-6">
      <h2 className="text-xl font-bold mb-4">Clientes</h2>
      <p className="text-gray-500">Modulo em desenvolvimento.</p>
    </div>
  );
}
