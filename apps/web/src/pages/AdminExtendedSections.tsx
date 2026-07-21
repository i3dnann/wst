import { useEffect, useMemo, useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Activity,
  ArchiveRestore,
  FileImage,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/data/StatusState";
import { Button } from "@/components/ui/button";
import { ApiError, api } from "@/lib/api";

type Row = Record<string, unknown> & { id: string };

function text(
  row: Record<string, unknown> | null | undefined,
  key: string,
  fallback = "—",
) {
  const value = row?.[key];
  return typeof value === "string" && value ? value : fallback;
}

function numberValue(
  row: Record<string, unknown> | null | undefined,
  key: string,
  fallback = 0,
): number {
  const value = row?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function displayValue(value: unknown, fallback = "—"): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : fallback;
}

function relation(
  row: Record<string, unknown>,
  key: string,
): Record<string, unknown> | null {
  const value = row[key];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function message(error: Error) {
  if (error instanceof ApiError && error.requestId)
    return `${error.message} (request ${error.requestId})`;
  return error.message;
}

function queryErrorMessage(...errors: unknown[]) {
  const error = errors.find((value): value is Error => value instanceof Error);
  return error ? message(error) : "The admin data could not be loaded.";
}

function date(value: unknown): string {
  if (typeof value !== "string" && !(value instanceof Date))
    return "Not available";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf())
    ? "Not available"
    : parsed.toLocaleString();
}

async function invalidateOperations(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["admin-overview"] }),
    queryClient.invalidateQueries({ queryKey: ["admin-records"] }),
    queryClient.invalidateQueries({ queryKey: ["home"] }),
    queryClient.invalidateQueries({ queryKey: ["gangs"] }),
    queryClient.invalidateQueries({ queryKey: ["tournaments"] }),
    queryClient.invalidateQueries({ queryKey: ["rankings"] }),
  ]);
}

export function GangOrganizationManager() {
  const queryClient = useQueryClient();
  const [gangs, players] = useQueries({
    queries: [
      { queryKey: ["admin-records", "gang"], queryFn: api.adminGangs },
      { queryKey: ["admin-records", "player"], queryFn: api.adminPlayers },
    ],
  });
  const gangRows = useMemo(
    () => (gangs.data?.data ?? []) as Row[],
    [gangs.data?.data],
  );
  const playerRows = (players.data?.data ?? []) as Row[];
  const [gangId, setGangId] = useState("");
  useEffect(() => {
    if (!gangId && gangRows[0]) setGangId(gangRows[0].id);
  }, [gangId, gangRows]);
  const roles = useQuery({
    queryKey: ["gang-roles", gangId],
    queryFn: () => api.gangRoles(gangId),
    enabled: Boolean(gangId),
  });
  const memberships = useQuery({
    queryKey: ["gang-memberships", gangId],
    queryFn: () => api.gangMemberships(gangId),
    enabled: Boolean(gangId),
  });
  const roleRows = (roles.data?.data ?? []) as Row[];
  const memberRows = (memberships.data?.data ?? []) as Row[];
  const [editingRoleId, setEditingRoleId] = useState("");
  const [role, setRole] = useState({
    name: "",
    hierarchyLevel: "10",
    sortOrder: "0",
    public: true,
    leadership: false,
  });
  const [member, setMember] = useState({
    playerId: "",
    gangRoleId: "",
    callsign: "",
    joinedAt: new Date().toISOString().slice(0, 10),
  });
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["gang-roles", gangId] }),
      queryClient.invalidateQueries({ queryKey: ["gang-memberships", gangId] }),
      invalidateOperations(queryClient),
    ]);
  };
  const saveRole = useMutation({
    mutationFn: () => {
      const input = {
        ...role,
        hierarchyLevel: Number(role.hierarchyLevel),
        sortOrder: Number(role.sortOrder),
        status: "ACTIVE",
      };
      return editingRoleId
        ? api.updateGangRole(gangId, editingRoleId, input)
        : api.createGangRole(gangId, input);
    },
    onSuccess: () => {
      toast.success(
        editingRoleId ? "Gang role updated." : "Gang role created.",
      );
      setEditingRoleId("");
      setRole({
        name: "",
        hierarchyLevel: "10",
        sortOrder: "0",
        public: true,
        leadership: false,
      });
      void refresh();
    },
    onError: (error) => toast.error(message(error)),
  });
  const archiveRole = useMutation({
    mutationFn: (roleId: string) => api.archiveGangRole(gangId, roleId),
    onSuccess: () => {
      toast.success("Gang role archived.");
      void refresh();
    },
    onError: (error) => toast.error(message(error)),
  });
  const saveMember = useMutation({
    mutationFn: () =>
      api.createGangMembership(gangId, {
        ...member,
        callsign: member.callsign || undefined,
        joinedAt: new Date(member.joinedAt).toISOString(),
      }),
    onSuccess: () => {
      toast.success("Player assigned to gang.");
      setMember((value) => ({ ...value, playerId: "", callsign: "" }));
      void refresh();
    },
    onError: (error) => toast.error(message(error)),
  });
  const updateMember = useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Record<string, unknown>;
    }) => api.updateGangMembership(gangId, id, input),
    onSuccess: () => {
      toast.success("Membership updated.");
      void refresh();
    },
    onError: (error) => toast.error(message(error)),
  });
  const removeMember = useMutation({
    mutationFn: (id: string) => api.removeGangMembership(gangId, id),
    onSuccess: () => {
      toast.success("Membership moved to history.");
      void refresh();
    },
    onError: (error) => toast.error(message(error)),
  });
  return (
    <section className="admin-dataset admin-extended-section">
      <header className="admin-dataset-heading">
        <div>
          <h2>Gang Roles & Members</h2>
          <p>
            Manage hierarchy, active membership, callsigns, and preserved
            membership history.
          </p>
        </div>
        <Button variant="outline" onClick={() => void refresh()}>
          <RefreshCw /> Refresh
        </Button>
      </header>
      {gangs.isError ||
      players.isError ||
      roles.isError ||
      memberships.isError ? (
        <ErrorState
          compact
          title="Gang organization could not load"
          message={queryErrorMessage(
            gangs.error,
            players.error,
            roles.error,
            memberships.error,
          )}
          retry={() => void refresh()}
        />
      ) : null}
      <label className="admin-wide-select">
        Gang
        <select
          value={gangId}
          onChange={(event) => setGangId(event.target.value)}
        >
          {gangRows.map((gang) => (
            <option key={gang.id} value={gang.id}>
              {text(gang, "name")} [{text(gang, "tag")}]
            </option>
          ))}
        </select>
      </label>
      <div className="admin-extended-grid">
        <form
          className="admin-form-grid admin-card"
          onSubmit={(event) => {
            event.preventDefault();
            saveRole.mutate();
          }}
        >
          <h3 className="full-width">Add Gang Role</h3>
          <label>
            Role name
            <input
              required
              value={role.name}
              onChange={(event) =>
                setRole((value) => ({ ...value, name: event.target.value }))
              }
            />
          </label>
          <label>
            Hierarchy
            <input
              type="number"
              min="0"
              value={role.hierarchyLevel}
              onChange={(event) =>
                setRole((value) => ({
                  ...value,
                  hierarchyLevel: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Sort order
            <input
              type="number"
              min="0"
              value={role.sortOrder}
              onChange={(event) =>
                setRole((value) => ({
                  ...value,
                  sortOrder: event.target.value,
                }))
              }
            />
          </label>
          <label className="admin-toggle-field">
            <input
              type="checkbox"
              checked={role.public}
              onChange={(event) =>
                setRole((value) => ({ ...value, public: event.target.checked }))
              }
            />
            <span>Public role</span>
          </label>
          <label className="admin-toggle-field">
            <input
              type="checkbox"
              checked={role.leadership}
              onChange={(event) =>
                setRole((value) => ({
                  ...value,
                  leadership: event.target.checked,
                }))
              }
            />
            <span>Leadership</span>
          </label>
          <Button type="submit" disabled={!gangId || saveRole.isPending}>
            <Save /> {editingRoleId ? "Save Role" : "Create Role"}
          </Button>
          {editingRoleId ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setEditingRoleId("");
                setRole({
                  name: "",
                  hierarchyLevel: "10",
                  sortOrder: "0",
                  public: true,
                  leadership: false,
                });
              }}
            >
              Cancel Edit
            </Button>
          ) : null}
          <div className="compact-record-list full-width">
            {roleRows.map((item) => (
              <article key={item.id}>
                <div>
                  <strong>{text(item, "name")}</strong>
                  <small>
                    Level {numberValue(item, "hierarchyLevel")} ·{" "}
                    {text(item, "status")}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRoleId(item.id);
                    setRole({
                      name: text(item, "name", ""),
                      hierarchyLevel: String(
                        numberValue(item, "hierarchyLevel"),
                      ),
                      sortOrder: String(numberValue(item, "sortOrder")),
                      public: item.public === true,
                      leadership: item.leadership === true,
                    });
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  disabled={archiveRole.isPending || item.status === "ARCHIVED"}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Archive the ${text(item, "name")} gang role? Existing membership history is preserved.`,
                      )
                    )
                      archiveRole.mutate(item.id);
                  }}
                >
                  <Trash2 />
                </button>
              </article>
            ))}
          </div>
        </form>
        <form
          className="admin-form-grid admin-card"
          onSubmit={(event) => {
            event.preventDefault();
            saveMember.mutate();
          }}
        >
          <h3 className="full-width">Assign Player</h3>
          <label>
            Player
            <select
              required
              value={member.playerId}
              onChange={(event) =>
                setMember((value) => ({
                  ...value,
                  playerId: event.target.value,
                }))
              }
            >
              <option value="">Select player</option>
              {playerRows.map((player) => (
                <option key={player.id} value={player.id}>
                  {text(player, "displayName")}
                </option>
              ))}
            </select>
          </label>
          <label>
            Role
            <select
              required
              value={member.gangRoleId}
              onChange={(event) =>
                setMember((value) => ({
                  ...value,
                  gangRoleId: event.target.value,
                }))
              }
            >
              <option value="">Select role</option>
              {roleRows
                .filter((item) => item.status === "ACTIVE")
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {text(item, "name")}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Callsign
            <input
              value={member.callsign}
              onChange={(event) =>
                setMember((value) => ({
                  ...value,
                  callsign: event.target.value,
                }))
              }
            />
          </label>
          <label>
            Joined
            <input
              required
              type="date"
              value={member.joinedAt}
              onChange={(event) =>
                setMember((value) => ({
                  ...value,
                  joinedAt: event.target.value,
                }))
              }
            />
          </label>
          <Button type="submit" disabled={!gangId || saveMember.isPending}>
            <UserPlus /> Assign Player
          </Button>
        </form>
      </div>
      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Role</th>
              <th>Callsign</th>
              <th>Joined / left</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {memberRows.map((item) => {
              const player = relation(item, "player");
              const itemRole = relation(item, "gangRole");
              return (
                <tr key={item.id}>
                  <td>
                    <strong>{text(player, "displayName")}</strong>
                  </td>
                  <td>
                    <select
                      value={text(itemRole, "id", "")}
                      disabled={!item.active}
                      onChange={(event) =>
                        updateMember.mutate({
                          id: item.id,
                          input: { gangRoleId: event.target.value },
                        })
                      }
                    >
                      {roleRows
                        .filter((entry) => entry.status === "ACTIVE")
                        .map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {text(entry, "name")}
                          </option>
                        ))}
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label={`${text(player, "displayName")} callsign`}
                      defaultValue={text(item, "callsign", "")}
                      disabled={!item.active}
                      onBlur={(event) =>
                        updateMember.mutate({
                          id: item.id,
                          input: { callsign: event.target.value || null },
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      aria-label={`${text(player, "displayName")} joined date`}
                      type="date"
                      defaultValue={new Date(String(item.joinedAt))
                        .toISOString()
                        .slice(0, 10)}
                      disabled={!item.active}
                      onChange={(event) =>
                        updateMember.mutate({
                          id: item.id,
                          input: {
                            joinedAt: new Date(
                              event.target.value,
                            ).toISOString(),
                          },
                        })
                      }
                    />{" "}
                    {item.leftAt
                      ? `— ${new Date(text(item, "leftAt", "")).toLocaleDateString()}`
                      : ""}
                  </td>
                  <td>{item.active ? "ACTIVE" : "FORMER"}</td>
                  <td>
                    {item.active ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (
                            window.confirm(
                              `Move ${text(player, "displayName")} to former members? Membership history will be preserved.`,
                            )
                          )
                            removeMember.mutate(item.id);
                        }}
                      >
                        Remove
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          updateMember.mutate({
                            id: item.id,
                            input: { active: true },
                          })
                        }
                      >
                        <ArchiveRestore /> Restore
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const scoringDefaults = {
  win: 3,
  draw: 1,
  loss: 0,
  kill: 1,
  mvp: 3,
  tournamentVictory: 20,
};

export function SeasonsManager() {
  const queryClient = useQueryClient();
  const seasons = useQuery({
    queryKey: ["admin-seasons"],
    queryFn: api.seasons,
  });
  const [form, setForm] = useState({
    name: "",
    slug: "",
    startsAt: "",
    endsAt: "",
    status: "DRAFT",
    ...scoringDefaults,
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin-seasons"] });
  const create = useMutation({
    mutationFn: () =>
      api.createSeason({
        ...form,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        startsAt: new Date(form.startsAt).toISOString(),
        scoringConfigSnapshot: Object.fromEntries(
          Object.keys(scoringDefaults).map((key) => [
            key,
            form[key as keyof typeof scoringDefaults],
          ]),
        ),
      }),
    onSuccess: () => {
      toast.success("Season created.");
      setForm({
        name: "",
        slug: "",
        startsAt: "",
        endsAt: "",
        status: "DRAFT",
        ...scoringDefaults,
      });
      void refresh();
    },
    onError: (error) => toast.error(message(error)),
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateSeason(id, { status }),
    onSuccess: () => {
      toast.success("Season status updated.");
      void refresh();
    },
    onError: (error) => toast.error(message(error)),
  });
  const recalculate = useMutation({
    mutationFn: api.recalculateSeason,
    onSuccess: () => {
      toast.success(
        "Gang and player rankings recalculated from finalized results.",
      );
      void refresh();
      void invalidateOperations(queryClient);
    },
    onError: (error) => toast.error(message(error)),
  });
  return (
    <section className="admin-dataset admin-extended-section">
      <header className="admin-dataset-heading">
        <div>
          <h2>Seasons & Ranking Rules</h2>
          <p>
            Only one season can be active; activating another closes the
            previous season.
          </p>
        </div>
      </header>
      {seasons.isError ? (
        <ErrorState
          compact
          title="Seasons could not load"
          message={queryErrorMessage(seasons.error)}
          retry={() => void seasons.refetch()}
        />
      ) : null}
      <form
        className="admin-form-grid admin-card"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <label>
          Season name
          <input
            required
            value={form.name}
            onChange={(event) =>
              setForm((value) => ({
                ...value,
                name: event.target.value,
                slug:
                  value.slug ||
                  event.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-")
                    .replace(/^-|-$/g, ""),
              }))
            }
          />
        </label>
        <label>
          Slug
          <input
            required
            value={form.slug}
            onChange={(event) =>
              setForm((value) => ({ ...value, slug: event.target.value }))
            }
          />
        </label>
        <label>
          Starts
          <input
            required
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) =>
              setForm((value) => ({ ...value, startsAt: event.target.value }))
            }
          />
        </label>
        <label>
          Ends
          <input
            type="datetime-local"
            value={form.endsAt}
            onChange={(event) =>
              setForm((value) => ({ ...value, endsAt: event.target.value }))
            }
          />
        </label>
        {Object.keys(scoringDefaults).map((key) => (
          <label key={key}>
            {key.replace(/([A-Z])/g, " $1")} points
            <input
              type="number"
              value={form[key as keyof typeof scoringDefaults]}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  [key]: Number(event.target.value),
                }))
              }
            />
          </label>
        ))}
        <Button type="submit" disabled={create.isPending}>
          <Save /> Create Season
        </Button>
      </form>
      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Season</th>
              <th>Dates</th>
              <th>Status</th>
              <th>Statistics</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {((seasons.data?.data ?? []) as Row[]).map((season) => {
              const count = relation(season, "_count");
              return (
                <tr key={season.id}>
                  <td>
                    <strong>{text(season, "name")}</strong>
                    <small>/{text(season, "slug")}</small>
                  </td>
                  <td>
                    {new Date(String(season.startsAt)).toLocaleDateString()}
                  </td>
                  <td>{text(season, "status")}</td>
                  <td>
                    {numberValue(count, "gangStats")} gangs ·{" "}
                    {numberValue(count, "playerStats")} players
                  </td>
                  <td>
                    <div className="admin-row-actions">
                      <select
                        value={text(season, "status")}
                        onChange={(event) =>
                          update.mutate({
                            id: season.id,
                            status: event.target.value,
                          })
                        }
                      >
                        {["DRAFT", "ACTIVE", "CLOSED", "ARCHIVED"].map(
                          (status) => (
                            <option key={status}>{status}</option>
                          ),
                        )}
                      </select>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={recalculate.isPending}
                        onClick={() => recalculate.mutate(season.id)}
                      >
                        <RefreshCw /> Recalculate
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RolesPermissionsManager() {
  const queryClient = useQueryClient();
  const data = useQuery({ queryKey: ["admin-roles"], queryFn: api.roles });
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () => api.createRole({ name, status: "ACTIVE" }),
    onSuccess: () => {
      toast.success("Role created.");
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (error) => toast.error(message(error)),
  });
  const updatePermissions = useMutation({
    mutationFn: ({
      roleId,
      permissionIds,
    }: {
      roleId: string;
      permissionIds: string[];
    }) => api.updateRolePermissions(roleId, permissionIds),
    onSuccess: () => {
      toast.success(
        "Permissions updated and will apply on the next token refresh.",
      );
      void queryClient.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (error) => toast.error(message(error)),
  });
  const permissionRows = (data.data?.data.permissions ?? []) as Row[];
  return (
    <section className="admin-dataset admin-extended-section">
      <header className="admin-dataset-heading">
        <div>
          <h2>Roles & Permissions</h2>
          <p>
            Backend permission checks remain authoritative; sidebar visibility
            follows the same grants.
          </p>
        </div>
        <form
          className="inline-admin-form"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <input
            required
            placeholder="New role name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit">
            <ShieldCheck /> Add Role
          </Button>
        </form>
      </header>
      {data.isError ? (
        <ErrorState
          compact
          title="Roles and permissions could not load"
          message={queryErrorMessage(data.error)}
          retry={() => void data.refetch()}
        />
      ) : null}
      <div className="permission-role-grid">
        {((data.data?.data.roles ?? []) as Row[]).map((role) => {
          const assignments = Array.isArray(role.permissions)
            ? (role.permissions as Array<Record<string, unknown>>)
            : [];
          const selected = new Set(
            assignments.map((assignment) =>
              text(relation(assignment, "permission"), "id", ""),
            ),
          );
          const protectedRole = text(role, "name") === "Super Administrator";
          return (
            <form
              className="admin-card"
              key={role.id}
              onSubmit={(event) => {
                event.preventDefault();
                const values = new FormData(event.currentTarget)
                  .getAll("permissionId")
                  .map(String);
                updatePermissions.mutate({
                  roleId: role.id,
                  permissionIds: values,
                });
              }}
            >
              <h3>{text(role, "name")}</h3>
              <p>
                {numberValue(relation(role, "_count"), "users")} assigned
                administrators
              </p>
              <div className="permission-checklist">
                {permissionRows.map((permission) => (
                  <label key={permission.id}>
                    <input
                      name="permissionId"
                      type="checkbox"
                      value={permission.id}
                      defaultChecked={
                        protectedRole || selected.has(permission.id)
                      }
                      disabled={protectedRole}
                    />
                    <span>{text(permission, "key")}</span>
                  </label>
                ))}
              </div>
              {protectedRole ? (
                <small>Seed-controlled full access</small>
              ) : (
                <Button type="submit" disabled={updatePermissions.isPending}>
                  <Save /> Save Permissions
                </Button>
              )}
            </form>
          );
        })}
      </div>
    </section>
  );
}

const defaultSettings = {
  websiteName: "World Star Registry",
  shortName: "WST",
  description: "The official World Star gang and tournament registry.",
  logoUrl: "",
  faviconUrl: "",
  defaultLanguage: "en",
  timeZone: "Europe/Berlin",
  maintenanceMode: false,
  heroTitle: "WORLD STAR CFW",
  heroSubtitle:
    "Where every rivalry becomes history. Follow verified matches, live tournaments, gang rankings, events, and streams from one official command center.",
  heroMediaUrl: "",
  announcement: "",
  rulesTitle: "Rules of Engagement",
  rulesIntro:
    "Clear competition starts with one shared standard for rosters, evidence, disputes, and verified results.",
  rulesContent:
    "Every participant is responsible for following the published tournament and server rules. Rosters must be accurate before check-in, match evidence must be complete, and disputes must be submitted inside the allowed review window.\n\nAdministrator decisions are recorded through the protected command center so every result remains traceable and consistent.",
  aboutTitle: "Built for the official record",
  aboutIntro:
    "World Star brings gangs, tournaments, rankings, events, streams, and verified match history into one trusted registry.",
  aboutContent:
    "The public website gives every player a clear view of competition while the protected administrator workspace controls publishing, permissions, brackets, results, and platform settings.\n\nEvery surface is connected to the same live records, creating a reliable home for rivalries, achievements, and tournament history.",
  defaultBestOf: 1,
  defaultParticipantCapacity: 16,
  registrationRules: "",
  checkInDurationMinutes: 30,
  resultSubmissionMinutes: 60,
  primaryColor: "#c51f38",
  secondaryColor: "#6f0d1c",
  accentColor: "#ef4058",
  backgroundMediaUrl: "",
  animationIntensity: "NORMAL",
  discord: "",
  youtube: "",
  twitch: "",
  kick: "",
  tiktok: "",
  twitter: "",
  instagram: "",
};

const legacySettingsColors: Record<string, string> = {
  "#b88a44": "#c51f38",
  "#c89a52": "#c51f38",
  "#5b3a20": "#6f0d1c",
  "#d3ad68": "#ef4058",
  "#d7c7a1": "#ef4058",
};

function modernSettingsColor(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  return legacySettingsColors[value.toLowerCase()] || value;
}

export function WebsiteSettingsManager() {
  const queryClient = useQueryClient();
  const settings = useQuery({
    queryKey: ["website-settings"],
    queryFn: api.websiteSettings,
  });
  const [form, setForm] = useState(defaultSettings);
  useEffect(() => {
    const value = settings.data?.data;
    if (!value) return;
    const general = relation(value, "general");
    const homepage = relation(value, "homepage");
    const pages = relation(value, "pages");
    const tournament = relation(value, "tournament");
    const branding = relation(value, "branding");
    const social = relation(value, "social");
    setForm((current) => ({
      ...current,
      ...general,
      ...homepage,
      ...pages,
      ...tournament,
      ...branding,
      ...social,
      heroTitle:
        typeof homepage?.heroTitle === "string"
          ? homepage.heroTitle === "WORLD STAR" ||
            homepage.heroTitle === "Where gangs compete. Legends rule."
            ? defaultSettings.heroTitle
            : homepage.heroTitle
          : current.heroTitle,
      heroSubtitle:
        typeof homepage?.heroSubtitle === "string"
          ? homepage.heroSubtitle ===
            "Live tournaments, verified match records, rankings, events, and streams—managed from one protected admin system."
            ? defaultSettings.heroSubtitle
            : homepage.heroSubtitle
          : current.heroSubtitle,
      primaryColor: modernSettingsColor(
        branding?.primaryColor,
        current.primaryColor,
      ),
      secondaryColor: modernSettingsColor(
        branding?.secondaryColor,
        current.secondaryColor,
      ),
      accentColor: modernSettingsColor(
        branding?.accentColor,
        current.accentColor,
      ),
    }));
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () =>
      api.updateWebsiteSettings({
        general: {
          websiteName: form.websiteName,
          shortName: form.shortName,
          description: form.description,
          logoUrl: form.logoUrl,
          faviconUrl: form.faviconUrl,
          defaultLanguage: form.defaultLanguage,
          timeZone: form.timeZone,
          maintenanceMode: form.maintenanceMode,
        },
        homepage: {
          heroTitle: form.heroTitle,
          heroSubtitle: form.heroSubtitle,
          heroMediaUrl: form.heroMediaUrl,
          announcement: form.announcement,
        },
        pages: {
          rulesTitle: form.rulesTitle,
          rulesIntro: form.rulesIntro,
          rulesContent: form.rulesContent,
          aboutTitle: form.aboutTitle,
          aboutIntro: form.aboutIntro,
          aboutContent: form.aboutContent,
        },
        tournament: {
          defaultBestOf: form.defaultBestOf,
          defaultParticipantCapacity: form.defaultParticipantCapacity,
          registrationRules: form.registrationRules,
          checkInDurationMinutes: form.checkInDurationMinutes,
          resultSubmissionMinutes: form.resultSubmissionMinutes,
        },
        branding: {
          primaryColor: form.primaryColor,
          secondaryColor: form.secondaryColor,
          accentColor: form.accentColor,
          backgroundMediaUrl: form.backgroundMediaUrl,
          animationIntensity: form.animationIntensity,
        },
        social: {
          discord: form.discord,
          youtube: form.youtube,
          twitch: form.twitch,
          kick: form.kick,
          tiktok: form.tiktok,
          twitter: form.twitter,
          instagram: form.instagram,
        },
      }),
    onSuccess: () => {
      toast.success("Website settings saved.");
      void queryClient.invalidateQueries({ queryKey: ["website-settings"] });
      void queryClient.invalidateQueries({ queryKey: ["public-settings"] });
    },
    onError: (error) => toast.error(message(error)),
  });
  const field = (key: keyof typeof form, label: string, type = "text") => (
    <label>
      {label}
      <input
        type={type}
        value={String(form[key])}
        onChange={(event) =>
          setForm((value) => ({
            ...value,
            [key]:
              type === "number"
                ? Number(event.target.value)
                : event.target.value,
          }))
        }
      />
    </label>
  );
  return (
    <section className="admin-dataset admin-extended-section">
      <header className="admin-dataset-heading">
        <div>
          <h2>Website Settings</h2>
          <p>
            Typed branding, homepage, tournament defaults, and social
            configuration.
          </p>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          <Save /> Save Settings
        </Button>
      </header>
      {settings.isError ? (
        <ErrorState
          compact
          title="Website settings could not load"
          message={queryErrorMessage(settings.error)}
          retry={() => void settings.refetch()}
        />
      ) : null}
      <div className="settings-card-grid">
        <section className="admin-card admin-form-grid">
          <h3 className="full-width">General</h3>
          {field("websiteName", "Website name")}
          {field("shortName", "Short name")}
          {field("logoUrl", "Logo URL", "url")}
          {field("faviconUrl", "Favicon URL", "url")}
          {field("defaultLanguage", "Language")}
          {field("timeZone", "Time zone")}
          <label className="admin-toggle-field">
            <input
              type="checkbox"
              checked={form.maintenanceMode}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  maintenanceMode: event.target.checked,
                }))
              }
            />
            <span>Maintenance mode</span>
          </label>
          <label className="full-width">
            Description
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  description: event.target.value,
                }))
              }
            />
          </label>
        </section>
        <section className="admin-card admin-form-grid">
          <h3 className="full-width">Homepage & Branding</h3>
          {field("heroTitle", "Hero title")}
          {field("heroSubtitle", "Hero subtitle")}
          {field("heroMediaUrl", "Hero media", "url")}
          {field("announcement", "Announcement")}
          {field("primaryColor", "Primary", "color")}
          {field("secondaryColor", "Secondary", "color")}
          {field("accentColor", "Accent", "color")}
          {field("backgroundMediaUrl", "Background media", "url")}
          <label>
            Animation
            <select
              value={form.animationIntensity}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  animationIntensity: event.target.value,
                }))
              }
            >
              <option>NONE</option>
              <option>REDUCED</option>
              <option>NORMAL</option>
            </select>
          </label>
        </section>
        <section className="admin-card admin-form-grid">
          <h3 className="full-width">Tournament Defaults</h3>
          {field("defaultBestOf", "Best of", "number")}
          {field("defaultParticipantCapacity", "Capacity", "number")}
          {field("checkInDurationMinutes", "Check-in minutes", "number")}
          {field("resultSubmissionMinutes", "Result window minutes", "number")}
          <label className="full-width">
            Registration rules
            <textarea
              value={form.registrationRules}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  registrationRules: event.target.value,
                }))
              }
            />
          </label>
        </section>
        <section className="admin-card admin-form-grid settings-content-pages">
          <h3 className="full-width">Rules Page</h3>
          {field("rulesTitle", "Page title")}
          <label className="full-width">
            Introduction
            <textarea
              value={form.rulesIntro}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  rulesIntro: event.target.value,
                }))
              }
            />
          </label>
          <label className="full-width">
            Page content
            <textarea
              rows={9}
              value={form.rulesContent}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  rulesContent: event.target.value,
                }))
              }
            />
          </label>
        </section>
        <section className="admin-card admin-form-grid settings-content-pages">
          <h3 className="full-width">About Page</h3>
          {field("aboutTitle", "Page title")}
          <label className="full-width">
            Introduction
            <textarea
              value={form.aboutIntro}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  aboutIntro: event.target.value,
                }))
              }
            />
          </label>
          <label className="full-width">
            Page content
            <textarea
              rows={9}
              value={form.aboutContent}
              onChange={(event) =>
                setForm((value) => ({
                  ...value,
                  aboutContent: event.target.value,
                }))
              }
            />
          </label>
        </section>
        <section className="admin-card admin-form-grid">
          <h3 className="full-width">Social Links</h3>
          {(
            [
              "discord",
              "youtube",
              "twitch",
              "kick",
              "tiktok",
              "twitter",
              "instagram",
            ] as const
          ).map((key) =>
            field(key, key.charAt(0).toUpperCase() + key.slice(1), "url"),
          )}
        </section>
      </div>
    </section>
  );
}

function uploadWithProgress(
  url: string,
  file: File,
  mimeType: string,
  onProgress: (value: number) => void,
) {
  return new Promise<void>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("Content-Type", mimeType);
    request.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable)
        onProgress(Math.round((event.loaded / event.total) * 100));
    });
    request.addEventListener("load", () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(
            new Error(`Upload failed with HTTP ${String(request.status)}.`),
          ),
    );
    request.addEventListener("error", () =>
      reject(new Error("The media upload connection failed.")),
    );
    request.send(file);
  });
}

async function imageDimensions(file: File) {
  const bitmap = await createImageBitmap(file);
  const dimensions = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  if (dimensions.width < 64 || dimensions.height < 64)
    throw new Error("Images must be at least 64 by 64 pixels.");
  return dimensions;
}

export function MediaManager() {
  const queryClient = useQueryClient();
  const media = useQuery({ queryKey: ["admin-media"], queryFn: api.media });
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("website-media");
  const [progress, setProgress] = useState(0);
  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Choose an image first.");
      const dimensions = await imageDimensions(file);
      const intent = await api.mediaUploadIntent({
        category,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
      });
      const uploadUrl = text(intent.data, "uploadUrl", "");
      const mediaAssetId = text(intent.data, "mediaAssetId", "");
      await uploadWithProgress(uploadUrl, file, file.type, setProgress);
      return api.completeMediaUpload({ mediaAssetId, ...dimensions });
    },
    onSuccess: () => {
      toast.success("Media uploaded and queued for approval.");
      setFile(null);
      setProgress(0);
      void queryClient.invalidateQueries({ queryKey: ["admin-media"] });
    },
    onError: (error) => toast.error(message(error)),
  });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.updateMedia(id, status),
    onSuccess: () => {
      toast.success("Media status updated.");
      void queryClient.invalidateQueries({ queryKey: ["admin-media"] });
    },
    onError: (error) => toast.error(message(error)),
  });
  const remove = useMutation({
    mutationFn: api.deleteMedia,
    onSuccess: () => {
      toast.success("Unreferenced media record deleted.");
      void queryClient.invalidateQueries({ queryKey: ["admin-media"] });
    },
    onError: (error) => toast.error(message(error)),
  });
  return (
    <section className="admin-dataset admin-extended-section">
      <header className="admin-dataset-heading">
        <div>
          <h2>Media Library</h2>
          <p>
            Signed image uploads, moderation, preview, public URL copy, archive,
            and safe deletion.
          </p>
        </div>
      </header>
      {media.isError ? (
        <ErrorState
          compact
          title="Media library could not load"
          message={queryErrorMessage(media.error)}
          retry={() => void media.refetch()}
        />
      ) : null}
      <form
        className="media-upload-card admin-card"
        onSubmit={(event) => {
          event.preventDefault();
          upload.mutate();
        }}
      >
        <FileImage />
        <label>
          Category
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {[
              "gang-logo",
              "gang-banner",
              "player-avatar",
              "tournament-banner",
              "event-image",
              "website-media",
              "match-evidence",
            ].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          Image
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <Button type="submit" disabled={upload.isPending}>
          {upload.isPending ? `Uploading ${String(progress)}%` : "Upload Image"}
        </Button>
      </form>
      <div className="media-admin-grid">
        {((media.data?.data ?? []) as Row[]).map((item) => (
          <article className="admin-card" key={item.id}>
            <img src={text(item, "publicUrl", "")} alt="" />
            <div>
              <strong>{text(item, "originalFilename")}</strong>
              <small>
                {text(item, "category")} · {text(item, "status")}
              </small>
            </div>
            <div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(
                    text(item, "publicUrl", ""),
                  );
                }}
              >
                Copy URL
              </Button>
              {item.status !== "APPROVED" ? (
                <Button
                  size="sm"
                  onClick={() =>
                    update.mutate({ id: item.id, status: "APPROVED" })
                  }
                >
                  Approve
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  update.mutate({ id: item.id, status: "ARCHIVED" })
                }
              >
                Archive
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="danger-button"
                onClick={() => remove.mutate(item.id)}
              >
                <Trash2 />
              </Button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ResultsDisputesManager() {
  const queryClient = useQueryClient();
  const [matches, players, assignees] = useQueries({
    queries: [
      { queryKey: ["admin-records", "match"], queryFn: api.adminMatches },
      { queryKey: ["admin-records", "player"], queryFn: api.adminPlayers },
      { queryKey: ["dispute-assignees"], queryFn: api.disputeAssignees },
    ],
  });
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const [disputeNotes, setDisputeNotes] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [winnerGangId, setWinnerGangId] = useState("");
  const [resultNotes, setResultNotes] = useState("");
  const [reopenImpact, setReopenImpact] = useState<Row[] | null>(null);
  const [stats, setStats] = useState<
    Array<{
      key: string;
      playerId: string;
      gangId: string;
      kills: number;
      deaths: number;
      assists: number;
      score: number;
      roundsPlayed: number;
      mvp: boolean;
      played: boolean;
      notes: string;
    }>
  >([]);
  const rows = (matches.data?.data ?? []) as Row[];
  const playerRows = (players.data?.data ?? []) as Row[];
  const assigneeRows = (assignees.data?.data ?? []) as Row[];
  const selected = rows.find((row) => row.id === selectedId);
  const selectedGangA = selected ? relation(selected, "gangA") : null;
  const selectedGangB = selected ? relation(selected, "gangB") : null;
  useEffect(() => {
    setScoreA(String(numberValue(selected, "gangAScore")));
    setScoreB(String(numberValue(selected, "gangBScore")));
    setWinnerGangId(text(relation(selected ?? {}, "winnerGang"), "id", ""));
    setResultNotes(text(selected, "resultNotes", ""));
    setStats([]);
  }, [selected]);
  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["admin-records", "match"],
    });
    await invalidateOperations(queryClient);
  };
  const dispute = useMutation({
    mutationFn: () =>
      api.disputeMatch(selectedId, {
        reason,
        notes: disputeNotes || undefined,
        assignedUserId: assignedUserId || null,
      }),
    onSuccess: () => {
      toast.success("Dispute opened; winner progression is blocked.");
      setReason("");
      setDisputeNotes("");
      void refresh();
    },
    onError: (error) => toast.error(message(error)),
  });
  const resolve = useMutation({
    mutationFn: () => api.resolveMatchDispute(selectedId, reason),
    onSuccess: () => {
      toast.success("Dispute resolved; the match awaits a corrected result.");
      setReason("");
      void refresh();
    },
    onError: (error) => toast.error(message(error)),
  });
  const reopen = useMutation({
    mutationFn: () =>
      api.reopenMatch(selectedId, {
        version: Number(selected?.version ?? 0),
        reason,
      }),
    onSuccess: () => {
      toast.success(
        "Result reopened and invalid downstream progression cleared.",
      );
      setReason("");
      setReopenImpact(null);
      void refresh();
    },
    onError: (error) => toast.error(message(error)),
  });
  const previewReopen = useMutation({
    mutationFn: () => api.matchDownstreamImpact(selectedId),
    onSuccess: (response) => {
      const affected = response.data.affected;
      setReopenImpact(Array.isArray(affected) ? (affected as Row[]) : []);
    },
    onError: (error) => toast.error(message(error)),
  });
  const finalize = useMutation({
    mutationFn: () =>
      api.finalizeMatch(selectedId, {
        version: Number(selected?.version ?? 0),
        gangAScore: Number(scoreA),
        gangBScore: Number(scoreB),
        winnerGangId,
        resultNotes: resultNotes || undefined,
        playerStats: stats.map((stat) => ({
          playerId: stat.playerId,
          gangId: stat.gangId,
          kills: stat.kills,
          deaths: stat.deaths,
          assists: stat.assists,
          score: stat.score,
          roundsPlayed: stat.roundsPlayed,
          mvp: stat.mvp,
          played: stat.played,
          notes: stat.notes || undefined,
        })),
      }),
    onSuccess: () => {
      toast.success(
        "Result finalized, statistics saved, and winner progressed.",
      );
      void refresh();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "VERSION_CONFLICT") {
        toast.error(
          `${message(error)} Current match data is being reloaded; your unsaved score and player rows are preserved.`,
        );
        void refresh();
        return;
      }
      toast.error(message(error));
    },
  });
  const updateStat = (
    key: string,
    field: string,
    value: string | number | boolean,
  ) =>
    setStats((current) =>
      current.map((stat) =>
        stat.key === key ? { ...stat, [field]: value } : stat,
      ),
    );
  return (
    <section className="admin-dataset admin-extended-section">
      <header className="admin-dataset-heading">
        <div>
          <h2>Results & Disputes</h2>
          <p>
            Record player statistics, finalize results, resolve disputes, and
            reopen with recursive downstream cleanup.
          </p>
        </div>
      </header>
      {matches.isError || players.isError || assignees.isError ? (
        <ErrorState
          compact
          title="Results and disputes could not load"
          message={queryErrorMessage(
            matches.error,
            players.error,
            assignees.error,
          )}
          retry={() => {
            void matches.refetch();
            void players.refetch();
            void assignees.refetch();
          }}
        />
      ) : null}
      <div className="admin-table-scroll">
        <table className="admin-data-table">
          <thead>
            <tr>
              <th>Match</th>
              <th>Tournament / round</th>
              <th>Status</th>
              <th>Score</th>
              <th>Version</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const gangA = relation(item, "gangA");
              const gangB = relation(item, "gangB");
              const tournament = relation(item, "tournament");
              const round = relation(item, "bracketRound");
              return (
                <tr key={item.id}>
                  <td>
                    <strong>
                      {text(gangA, "name", "TBD")} vs{" "}
                      {text(gangB, "name", "TBD")}
                    </strong>
                  </td>
                  <td>
                    {text(tournament, "name", "Independent")} ·{" "}
                    {text(round, "name", "No round")}
                  </td>
                  <td>{text(item, "status")}</td>
                  <td>
                    {displayValue(item.gangAScore)} –{" "}
                    {displayValue(item.gangBScore)}
                  </td>
                  <td>{numberValue(item, "version")}</td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedId(item.id)}
                    >
                      Manage
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {selected ? (
        <form
          className="admin-card result-action-card"
          onSubmit={(event) => {
            event.preventDefault();
            finalize.mutate();
          }}
        >
          <h3>
            {text(selectedGangA, "name", "TBD")} vs{" "}
            {text(selectedGangB, "name", "TBD")}
          </h3>
          <div className="result-score-grid">
            <label>
              {text(selectedGangA, "name", "Gang A")} score
              <input
                type="number"
                min="0"
                required
                value={scoreA}
                onChange={(event) => setScoreA(event.target.value)}
              />
            </label>
            <label>
              {text(selectedGangB, "name", "Gang B")} score
              <input
                type="number"
                min="0"
                required
                value={scoreB}
                onChange={(event) => setScoreB(event.target.value)}
              />
            </label>
            <label>
              Winner
              <select
                required
                value={winnerGangId}
                onChange={(event) => setWinnerGangId(event.target.value)}
              >
                <option value="">Select winner</option>
                {[selectedGangA, selectedGangB].filter(Boolean).map((gang) => (
                  <option key={text(gang, "id")} value={text(gang, "id")}>
                    {text(gang, "name")}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Result notes
            <textarea
              value={resultNotes}
              onChange={(event) => setResultNotes(event.target.value)}
            />
          </label>
          <div className="player-stat-editor">
            <header>
              <strong>Player statistics</strong>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setStats((current) => [
                    ...current,
                    {
                      key: crypto.randomUUID(),
                      playerId: "",
                      gangId: text(selectedGangA, "id", ""),
                      kills: 0,
                      deaths: 0,
                      assists: 0,
                      score: 0,
                      roundsPlayed: 1,
                      mvp: false,
                      played: true,
                      notes: "",
                    },
                  ])
                }
              >
                <UserPlus /> Add Player
              </Button>
            </header>
            {stats.map((stat) => (
              <div className="player-stat-row" key={stat.key}>
                <select
                  required
                  value={stat.playerId}
                  onChange={(event) =>
                    updateStat(stat.key, "playerId", event.target.value)
                  }
                >
                  <option value="">Player</option>
                  {playerRows.map((player) => (
                    <option key={player.id} value={player.id}>
                      {text(player, "displayName")}
                    </option>
                  ))}
                </select>
                <select
                  required
                  value={stat.gangId}
                  onChange={(event) =>
                    updateStat(stat.key, "gangId", event.target.value)
                  }
                >
                  {[selectedGangA, selectedGangB]
                    .filter(Boolean)
                    .map((gang) => (
                      <option key={text(gang, "id")} value={text(gang, "id")}>
                        {text(gang, "name")}
                      </option>
                    ))}
                </select>
                {(
                  [
                    "kills",
                    "deaths",
                    "assists",
                    "score",
                    "roundsPlayed",
                  ] as const
                ).map((field) => (
                  <label key={field}>
                    {field}
                    <input
                      type="number"
                      min="0"
                      value={stat[field]}
                      onChange={(event) =>
                        updateStat(stat.key, field, Number(event.target.value))
                      }
                    />
                  </label>
                ))}
                <label className="admin-toggle-field">
                  <input
                    type="checkbox"
                    checked={stat.mvp}
                    onChange={(event) =>
                      updateStat(stat.key, "mvp", event.target.checked)
                    }
                  />
                  <span>MVP</span>
                </label>
                <input
                  aria-label="Player notes"
                  placeholder="Notes"
                  value={stat.notes}
                  onChange={(event) =>
                    updateStat(stat.key, "notes", event.target.value)
                  }
                />
                <button
                  type="button"
                  aria-label="Remove player statistic"
                  onClick={() =>
                    setStats((current) =>
                      current.filter((entry) => entry.key !== stat.key),
                    )
                  }
                >
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
          <label>
            Dispute / reopen reason
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="result-score-grid">
            <label>
              Dispute assignee
              <select
                value={assignedUserId}
                onChange={(event) => setAssignedUserId(event.target.value)}
              >
                <option value="">Unassigned</option>
                {assigneeRows.map((administrator) => (
                  <option key={administrator.id} value={administrator.id}>
                    {text(administrator, "displayName")} (
                    {text(administrator, "email")})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Internal dispute notes
              <textarea
                value={disputeNotes}
                onChange={(event) => setDisputeNotes(event.target.value)}
                placeholder="Evidence media URLs and private review notes"
              />
            </label>
          </div>
          <div>
            {selected.status === "DISPUTED" ? (
              <Button
                type="button"
                disabled={reason.length < 5 || resolve.isPending}
                onClick={() => resolve.mutate()}
              >
                Resolve Dispute
              </Button>
            ) : (
              <Button
                type="button"
                disabled={
                  reason.length < 5 ||
                  dispute.isPending ||
                  selected.status === "COMPLETED"
                }
                onClick={() => dispute.mutate()}
              >
                Open Dispute
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={
                reason.length < 5 ||
                reopen.isPending ||
                (selected.status !== "COMPLETED" &&
                  selected.status !== "DISPUTED")
              }
              onClick={() => previewReopen.mutate()}
            >
              <ArchiveRestore /> Reopen & Undo Progression
            </Button>
            <Button
              type="submit"
              disabled={
                !winnerGangId ||
                finalize.isPending ||
                selected.status === "COMPLETED" ||
                selected.status === "DISPUTED"
              }
            >
              <Save /> Finalize Result
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelectedId("")}
            >
              Close
            </Button>
          </div>
        </form>
      ) : null}
      {reopenImpact ? (
        <div
          className="admin-confirm-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reopen-impact-title"
        >
          <div className="admin-confirm-dialog">
            <h3 id="reopen-impact-title">
              Reopen result and reset progression?
            </h3>
            <p>
              The selected match will be reopened. These downstream matches will
              have invalid teams, scores, winners, and finalization metadata
              cleared:
            </p>
            {reopenImpact.length ? (
              <ol>
                {reopenImpact.map((match) => (
                  <li key={match.id}>
                    <strong>
                      {text(
                        relation(match, "bracketRound"),
                        "name",
                        "Future round",
                      )}
                    </strong>
                    <span>
                      {text(relation(match, "gangA"), "name", "TBD")} vs{" "}
                      {text(relation(match, "gangB"), "name", "TBD")}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p>This result has no downstream matches.</p>
            )}
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setReopenImpact(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="danger-button"
                disabled={reopen.isPending}
                onClick={() => reopen.mutate()}
              >
                Reopen &amp; Reset Listed Matches
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function SystemHealthManager() {
  const health = useQuery({
    queryKey: ["system-health"],
    queryFn: api.systemHealth,
    refetchInterval: 30_000,
  });
  const data = health.data?.data;
  const entries = useMemo(
    () =>
      data
        ? Object.entries(data).filter(
            ([, value]) => typeof value !== "object" || value === null,
          )
        : [],
    [data],
  );
  const providerRows = data
    ? Object.entries(relation(data, "providers") ?? {})
    : [];
  const migration = relation(data ?? {}, "migration");
  const streamErrors = Array.isArray(data?.streamErrors)
    ? (data.streamErrors as Row[])
    : [];
  return (
    <section className="admin-dataset admin-extended-section">
      <header className="admin-dataset-heading">
        <div>
          <h2>System Health</h2>
          <p>
            Safe API, database, integration, storage, migration, and provider
            readiness.
          </p>
        </div>
        <Button variant="outline" onClick={() => void health.refetch()}>
          <RefreshCw /> Check Now
        </Button>
      </header>
      {health.isError ? (
        <div className="status-state" role="alert">
          <strong>Health check failed</strong>
          <p>{message(health.error)}</p>
        </div>
      ) : (
        <>
          <div className="health-metric-grid">
            {entries.map(([key, value]) => (
              <article key={key}>
                <Activity />
                <span>{key.replace(/([A-Z])/g, " $1")}</span>
                <strong>{displayValue(value, "not available")}</strong>
              </article>
            ))}
            {migration ? (
              <article>
                <Activity />
                <span>Latest migration</span>
                <strong>{text(migration, "name", "Not available")}</strong>
                <small>{date(migration.finishedAt)}</small>
              </article>
            ) : null}
            {providerRows.map(([provider, configured]) => (
              <article key={provider}>
                <Activity />
                <span>{provider} provider</span>
                <strong>{configured ? "Configured" : "Not configured"}</strong>
              </article>
            ))}
          </div>
          <section className="admin-card">
            <h3>Recent stream-provider failures</h3>
            {streamErrors.length ? (
              <ul>
                {streamErrors.map((error) => (
                  <li key={error.id}>
                    <strong>{text(error, "streamerName")}</strong>
                    <span>
                      {text(error, "platform")} · {date(error.lastCheckedAt)}
                    </span>
                    <p>{text(error, "lastStatusError")}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No recent provider failures.</p>
            )}
          </section>
        </>
      )}
    </section>
  );
}
