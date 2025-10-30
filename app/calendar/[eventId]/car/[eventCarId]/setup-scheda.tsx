'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { createClient } from '@/utils/supabase/client';
import dayjs from 'dayjs';

export default function SetupScheda({ eventCarId }: { eventCarId: string }) {
  const supabase = createClient();
  const [infoGenerali, setInfoGenerali] = useState({
    campo1: '',
    campo2: '',
    campo3: '',
  });
  const [storico, setStorico] = useState<any[]>([]);

  // 🔹 Carica ultimi 3 salvataggi
  useEffect(() => {
    const fetchStorico = async () => {
      const { data, error } = await supabase
        .from('event_car_setup')
        .select('*')
        .eq('event_car_id', eventCarId)
        .order('created_at', { ascending: false })
        .limit(3);
      if (!error && data) setStorico(data);
    };
    fetchStorico();
  }, [eventCarId]);

  // 🔹 Salvataggio
  const handleSave = async () => {
    const { error } = await supabase.from('event_car_setup').insert({
      event_car_id: eventCarId,
      section: 'setup',
      data: infoGenerali,
      created_at: new Date().toISOString(),
    });
    if (!error) {
      alert('💾 Setup salvato con successo');
      // Aggiorna storico dopo salvataggio
      const { data } = await supabase
        .from('event_car_setup')
        .select('*')
        .eq('event_car_id', eventCarId)
        .order('created_at', { ascending: false })
        .limit(3);
      setStorico(data || []);
    }
  };

  // 🔹 Elimina salvataggio
  const handleDelete = async (id: string) => {
    if (confirm('Vuoi eliminare questo salvataggio?')) {
      await supabase.from('event_car_setup').delete().eq('id', id);
      setStorico((prev) => prev.filter((s) => s.id !== id));
    }
  };

  // 🔹 Apri salvataggio
  const handleOpen = (data: any) => {
    setInfoGenerali(data.data);
  };

  return (
    <div className="space-y-6">
      {/* Info Generali */}
      <Card className="p-4">
        <CardHeader>
          <h2 className="text-lg font-bold">Info Generali</h2>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input
            placeholder="Campo 1"
            value={infoGenerali.campo1}
            onChange={(e) =>
              setInfoGenerali({ ...infoGenerali, campo1: e.target.value })
            }
            className="w-[250%]" // 🔸 aumentata larghezza
          />
          <Input
            placeholder="Campo 2"
            value={infoGenerali.campo2}
            onChange={(e) =>
              setInfoGenerali({ ...infoGenerali, campo2: e.target.value })
            }
            className="w-[250%]" // 🔸 aumentata larghezza
          />
          <Input
            placeholder="Campo 3"
            value={infoGenerali.campo3}
            onChange={(e) =>
              setInfoGenerali({ ...infoGenerali, campo3: e.target.value })
            }
            className="w-[250%]" // 🔸 aumentata larghezza
          />
        </CardContent>
      </Card>

      {/* Pulsante Salva */}
      <div className="flex justify-end">
        <Button onClick={handleSave} className="bg-yellow-500 hover:bg-yellow-600">
          💾 Salva
        </Button>
      </div>

      {/* Storico ultimi 3 salvataggi */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-bold">Storico Setup</h2>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {storico.length === 0 ? (
            <p className="text-sm text-gray-500">Nessun salvataggio recente</p>
          ) : (
            storico.map((s) => (
              <div
                key={s.id}
                className="flex justify-between items-center border-b pb-2"
              >
                <span className="text-sm">
                  {dayjs(s.created_at).format('DD/MM/YYYY HH:mm')}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpen(s)}
                  >
                    Apri
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(s.id)}
                  >
                    Elimina
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
