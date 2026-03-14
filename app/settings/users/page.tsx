"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCurrentTeamContext } from "@/lib/teamContext";
import { Shield, UserPlus, Trash2 } from "lucide-react";

type TeamUser = {
  id: string;
  user_id: string;
  role: string;
  can_edit_hours: boolean;
  can_manage_components: boolean;
  can_manage_events: boolean;
  can_manage_users: boolean;
};

export default function TeamUsersPage() {
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    const ctx = await getCurrentTeamContext();

    const { data, error } = await supabase
      .from("team_users")
      .select("*")
      .eq("team_id", ctx.teamId);

    if (!error) setUsers(data || []);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const inviteUser = async () => {
    if (!email) return;

    setLoading(true);

    const ctx = await getCurrentTeamContext();

    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);

    if (error) {
      alert(error.message);
      setLoading(false);
      return;
    }

    await supabase.from("team_users").insert([
      {
        user_id: data.user.id,
        team_id: ctx.teamId,
        role: "mechanic",
      },
    ]);

    setEmail("");
    setLoading(false);
    fetchUsers();
  };

  const updatePermission = async (
    userId: string,
    field: string,
    value: boolean
  ) => {
    await supabase
      .from("team_users")
      .update({ [field]: value })
      .eq("id", userId);

    fetchUsers();
  };

  const updateRole = async (userId: string, role: string) => {
    await supabase.from("team_users").update({ role }).eq("id", userId);
    fetchUsers();
  };

  const removeUser = async (userId: string) => {
    if (!confirm("Rimuovere utente dal team?")) return;

    await supabase.from("team_users").delete().eq("id", userId);

    fetchUsers();
  };

  return (
    <div className="p-6 flex flex-col gap-6">

      <div className="flex items-center gap-3">
        <Shield size={28} className="text-yellow-500" />
        <h1 className="text-3xl font-bold">Gestione Utenti Team</h1>
      </div>

      {/* Invita utente */}

      <div className="bg-white border rounded-xl p-4 flex gap-3">
        <input
          type="email"
          placeholder="Email utente"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="border p-2 rounded-lg flex-1"
        />

        <button
          onClick={inviteUser}
          className="bg-yellow-500 px-4 py-2 rounded-lg font-semibold flex items-center gap-2"
        >
          <UserPlus size={16} />
          Invita
        </button>
      </div>

      {/* Tabella utenti */}

      <div className="bg-white border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">

          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">User ID</th>
              <th className="p-2 text-left">Ruolo</th>
              <th className="p-2 text-left">Edit ore</th>
              <th className="p-2 text-left">Componenti</th>
              <th className="p-2 text-left">Eventi</th>
              <th className="p-2 text-left">Utenti</th>
              <th className="p-2"></th>
            </tr>
          </thead>

          <tbody>

            {users.map((user) => (
              <tr key={user.id} className="border-t">

                <td className="p-2 text-xs">{user.user_id}</td>

                <td className="p-2">

                  <select
                    value={user.role}
                    onChange={(e) =>
                      updateRole(user.id, e.target.value)
                    }
                    className="border p-1 rounded"
                  >
                    <option value="admin">admin</option>
                    <option value="engineer">engineer</option>
                    <option value="mechanic">mechanic</option>
                    <option value="viewer">viewer</option>
                  </select>

                </td>

                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={user.can_edit_hours}
                    onChange={(e) =>
                      updatePermission(
                        user.id,
                        "can_edit_hours",
                        e.target.checked
                      )
                    }
                  />
                </td>

                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={user.can_manage_components}
                    onChange={(e) =>
                      updatePermission(
                        user.id,
                        "can_manage_components",
                        e.target.checked
                      )
                    }
                  />
                </td>

                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={user.can_manage_events}
                    onChange={(e) =>
                      updatePermission(
                        user.id,
                        "can_manage_events",
                        e.target.checked
                      )
                    }
                  />
                </td>

                <td className="p-2">
                  <input
                    type="checkbox"
                    checked={user.can_manage_users}
                    onChange={(e) =>
                      updatePermission(
                        user.id,
                        "can_manage_users",
                        e.target.checked
                      )
                    }
                  />
                </td>

                <td className="p-2">
                  <button
                    onClick={() => removeUser(user.id)}
                    className="text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>

              </tr>
            ))}

          </tbody>
        </table>
      </div>
    </div>
  );
}