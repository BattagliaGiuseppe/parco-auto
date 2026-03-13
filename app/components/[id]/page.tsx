<div className="bg-white border rounded-2xl shadow-sm p-5">
  <h2 className="text-lg font-bold text-gray-800 mb-4">Stato attuale</h2>

  <div className="flex flex-col gap-3 text-sm">
    <div>
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${thresholdBadge?.className}`}
      >
        {thresholdBadge?.label}
      </span>
    </div>

    <div>
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 font-semibold ${expiryBadge?.className}`}
      >
        {expiryBadge?.label}
      </span>
    </div>

    <div className="border rounded-xl p-3 bg-gray-50">
      <div className="font-semibold mb-1">Montaggio attuale</div>
      {currentCar ? (
        <div>
          <div>{currentCar.name}</div>
          <div className="text-gray-500 text-xs">
            Telaio: {currentCar.chassis_number || "—"}
          </div>
        </div>
      ) : (
        <div className="text-gray-500">Smontato</div>
      )}
    </div>

    <div className="border rounded-xl p-3 bg-gray-50">
      <div className="font-semibold mb-1">Ultima revisione</div>
      {latestRevision ? (
        <div>
          <div>{formatDate(latestRevision.date)}</div>
          <div className="text-gray-500 text-xs">
            {latestRevision.description || "Revisione registrata"}
          </div>
        </div>
      ) : (
        <div className="text-gray-500">Nessuna revisione</div>
      )}
    </div>
  </div>
</div>