      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
          <Cog size={32} className="text-yellow-500" /> Componenti
        </h1>

        <div className="flex flex-wrap gap-3 items-center">
          {/* Ricerca e filtri */}
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca per tipo, identificativo o auto..."
              className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm pl-9 focus:ring-2 focus:ring-yellow-400"
            />
            <Search
              size={16}
              className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400"
            />
          </div>

          <select
            value={filterCar}
            onChange={(e) => setFilterCar(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-yellow-400"
          >
            <option value="">Tutte le auto</option>
            <option value="unassigned">Smontati</option>
            {[...new Set(
              components.map((c) => c.car_id?.name).filter(Boolean)
            )].map((car) => (
              <option key={car} value={car}>
                {car}
              </option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-yellow-400"
          >
            <option value="">Tutti i tipi</option>
            {[...new Set(
              components.map((c) => c.type).filter(Boolean)
            )].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="border rounded-lg px-3 py-2 text-sm bg-white shadow-sm focus:ring-2 focus:ring-yellow-400"
          >
            <option value="all">Tutti</option>
            <option value="expiring">In scadenza (≤ 6 mesi)</option>
            <option value="expired">Scaduti</option>
          </select>

          <button
            onClick={() => {
              setEditing(null);
              setFormData({
                type: "",
                identifier: "",
                work_hours: 0,
                expiry_date: "",
                car_name: "",
              });
              setModalOpen(true);
            }}
            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm"
          >
            <PlusCircle size={18} /> Aggiungi
          </button>
        </div>
      </div>

      {/* Lista componenti */}
      {loading ? (
        <p>Caricamento...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredComponents.map((comp) => (
            <div
              key={comp.id}
              className="bg-gray-100 shadow-md rounded-2xl overflow-hidden border border-gray-200 hover:shadow-xl transition"
            >
              <div className="bg-black text-yellow-500 px-4 py-3 flex justify-between items-center">
                <div>
                  <h2 className="text-lg font-bold capitalize">{comp.type}</h2>
                  <span className="text-sm opacity-80">
                    {comp.car_id?.name || "Smontato"}
                  </span>
                </div>
                <Wrench size={20} />
              </div>

              <div className="p-4 flex flex-col gap-3">
                <p className="text-gray-700 text-sm">
                  <span className="font-semibold">Identificativo:</span>{" "}
                  {comp.identifier}
                </p>
                <p className="text-gray-700 text-sm">
                  <span className="font-semibold">Ore lavoro:</span>{" "}
                  {comp.work_hours}
                </p>

                {comp.expiry_date && (
                  <p className={`text-sm ${getExpiryColor(comp.expiry_date)}`}>
                    <span className="font-semibold">Scadenza:</span>{" "}
                    {new Date(comp.expiry_date).toLocaleDateString("it-IT")}
                  </p>
                )}

                {/* Pulsanti azione */}
                <div className="flex justify-end gap-2 flex-wrap">
                  <button
                    onClick={() => openEditModal(comp)}
                    className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold px-3 py-2 rounded-lg flex items-center gap-2 shadow-sm"
                  >
                    <Edit size={16} /> Modifica
                  </button>

                  {!comp.car_id ? (
                    <button
                      onClick={() => {
                        setSelectedComponent(comp);
                        setMountModal(true);
                      }}
                      className="bg-green-400 hover:bg-green-500 text-gray-900 font-semibold px-3 py-2 rounded-lg shadow-sm"
                    >
                      🧩 Monta
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleUnmountComponent(comp.id)}
                        className="bg-red-500 hover:bg-red-600 text-white font-semibold px-3 py-2 rounded-lg shadow-sm"
                      >
                        ❌ Smonta
                      </button>
                      <button
                        onClick={() => {
                          setSelectedComponent(comp);
                          setRemountModal(true);
                        }}
                        className="bg-blue-400 hover:bg-blue-500 text-white font-semibold px-3 py-2 rounded-lg shadow-sm flex items-center gap-1"
                      >
                        <RotateCcw size={16} /> Rimonta
                      </button>
                    </>
                  )}
                </div>

                {/* Storico montaggi */}
                {history[comp.id]?.length > 0 && (
                  <div className="mt-3 border-t pt-2">
                    <h3 className="font-semibold text-sm mb-1">
                      Storico Montaggi:
                    </h3>
                    <table className="w-full text-xs border">
                      <thead className="bg-gray-200 text-gray-700">
                        <tr>
                          <th className="p-1 text-left">Auto</th>
                          <th className="p-1 text-left">Stato</th>
                          <th className="p-1 text-left">Da</th>
                          <th className="p-1 text-left">A</th>
                          <th className="p-1 text-left">Ore</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history[comp.id].map((h) => (
                          <tr key={h.id} className="border-t">
                            <td className="p-1">{h.car_id?.name || "—"}</td>
                            <td className="p-1">
                              {h.status === "mounted"
                                ? "🟢 Montato"
                                : "⚪️ Smontato"}
                            </td>
                            <td className="p-1">
                              {h.mounted_at
                                ? new Date(h.mounted_at).toLocaleDateString(
                                    "it-IT"
                                  )
                                : "—"}
                            </td>
                            <td className="p-1">
                              {h.removed_at
                                ? new Date(h.removed_at).toLocaleDateString(
                                    "it-IT"
                                  )
                                : "—"}
                            </td>
                            <td className="p-1">
                              {h.hours_used?.toFixed(1) || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modale Montaggio */}
      {mountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">
              Monta {selectedComponent?.identifier} su un'auto
            </h2>

            <select
              value={selectedCarId}
              onChange={(e) => setSelectedCarId(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full mb-6 focus:ring-2 focus:ring-yellow-400"
            >
              <option value="">-- Seleziona auto --</option>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMountModal(false)}
                className="px-4 py-2 rounded-lg border"
              >
                Annulla
              </button>
              <button
                onClick={handleMountComponent}
                className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
              >
                Monta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Rimontaggio */}
      {remountModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">
              Rimonta {selectedComponent?.identifier} su una nuova auto
            </h2>

            <select
              value={selectedCarId}
              onChange={(e) => setSelectedCarId(e.target.value)}
              className="border rounded-lg px-3 py-2 w-full mb-6 focus:ring-2 focus:ring-yellow-400"
            >
              <option value="">-- Seleziona auto --</option>
              {cars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRemountModal(false)}
                className="px-4 py-2 rounded-lg border"
              >
                Annulla
              </button>
              <button
                onClick={handleRemountComponent}
                className="px-4 py-2 rounded-lg bg-blue-400 hover:bg-blue-500 text-white font-semibold"
              >
                Rimonta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div
          className={`fixed bottom-6 right-6 px-4 py-3 rounded-lg shadow-lg text-sm flex items-center gap-2 z-[999]
          ${
            toast.type === "success"
              ? "bg-green-600 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle size={18} />
          ) : (
            <XCircle size={18} />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}
