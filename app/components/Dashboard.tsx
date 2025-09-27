import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar as BigCalendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { it } from "date-fns/locale";

// Configurazione localizzatore
const locales = {
  it: it,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

export default function Dashboard() {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase.from("events").select("*");
      if (data) {
        setEvents(
          data.map((e) => ({
            id: e.id,
            title: e.title,
            start: new Date(e.start_date),
            end: new Date(e.end_date),
          }))
        );
      }
    };

    fetchEvents();
  }, []);

  return (
    <div className="bg-white shadow-lg rounded-2xl p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <CalendarIcon size={20} /> Calendario Eventi
      </h2>
      <div className="h-[500px]">
        <BigCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ height: "100%" }}
          views={["month", "week", "day"]}
          messages={{
            next: "Avanti",
            previous: "Indietro",
            today: "Oggi",
            month: "Mese",
            week: "Settimana",
            day: "Giorno",
          }}
        />
      </div>
    </div>
  );
}
