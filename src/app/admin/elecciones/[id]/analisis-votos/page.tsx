import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, Binary, Clock3, Eye, Fingerprint, Network, Search, ShieldAlert, Users } from "lucide-react";
import { AdminPageHeader, MetricCard } from "@/components/admin-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { can, PERMISSIONS, requirePermission } from "@/lib/auth/permissions";
import { ELECTION_STATUS_LABELS, VOTE_STATUS_LABELS, statusLabel } from "@/lib/elections";

type Query = {
  status?: string;
  discord?: string;
  receipt?: string;
  from?: string;
  to?: string;
  signal?: string;
};

type VoteRow = {
  id: string;
  receipt_code: string;
  source: string;
  discord_username: string | null;
  discord_id: string | null;
  discord_normalized: string | null;
  visible_name: string | null;
  roblox_username: string | null;
  status: string;
  duplicate_candidate: boolean;
  submitted_at: string;
  created_at: string;
  reviewed_at: string | null;
  ip_hash: string | null;
  user_agent_hash: string | null;
  device_hint_hash: string | null;
  selected: { candidate_name: string | null; option_number: number | null; is_blank_vote: boolean | null } | { candidate_name: string | null; option_number: number | null; is_blank_vote: boolean | null }[] | null;
};

type SignalGroup = {
  key: string;
  label: string;
  reason: string;
  votes: VoteRow[];
};

export default async function SuspiciousVoteAnalysisPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Query> }) {
  const [{ id }, query, session] = await Promise.all([params, searchParams, requirePermission(PERMISSIONS.electionsView)]);
  const { supabase, profile } = session;
  const [canViewVotes, canAnalyzeVotes] = await Promise.all([
    can(profile, "ver_votos", "elecciones", { supabase }),
    can(profile, "analizar_votos", "elecciones", { supabase }),
  ]);

  if (!canViewVotes || !canAnalyzeVotes) {
    await supabase.rpc("log_security_event", {
      p_action: "PERMISSION_DENIED",
      p_table: "elecciones",
      p_record_id: id,
      p_description: "Intento de consultar análisis de votos sin permisos requeridos",
      p_metadata: { required: ["elecciones:ver", "elecciones:ver_votos", "elecciones:analizar_votos"] },
    });
    redirect("/no-autorizado");
  }

  const [{ data: election }, { data: votes }] = await Promise.all([
    supabase.from("elections").select("id,title,status,office,slug").eq("id", id).maybeSingle(),
    supabase
      .from("election_votes")
      .select("id,receipt_code,source,discord_username,discord_id,discord_normalized,visible_name,roblox_username,status,duplicate_candidate,submitted_at,created_at,reviewed_at,ip_hash,user_agent_hash,device_hint_hash,selected:election_options(candidate_name,option_number,is_blank_vote)")
      .eq("election_id", id)
      .order("submitted_at", { ascending: true }),
  ]);

  if (!election) notFound();

  const allVotes = ((votes ?? []) as VoteRow[]).sort((a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime());
  const repeatedDiscord = groupsBy(allVotes, (vote) => clean(vote.discord_normalized || vote.discord_id || vote.discord_username), "Mismo Discord usado más de una vez", (key) => key).filter((group) => group.votes.length > 1);
  const similarDiscord = similarDiscordGroups(allVotes);
  const rapidWindows = rapidVoteWindows(allVotes);
  const ipGroups = groupsBy(allVotes, (vote) => vote.ip_hash, "Mismo IP hash usado en varios votos", (key) => shortHash(key)).filter((group) => group.votes.length > 1);
  const deviceGroups = [
    ...groupsBy(allVotes, (vote) => vote.device_hint_hash, "Mismo dispositivo/sesión usado en varios votos", (key) => shortHash(key)),
    ...groupsBy(allVotes, (vote) => vote.user_agent_hash, "Mismo navegador/user-agent usado en varios votos", (key) => shortHash(key)),
  ].filter((group) => group.votes.length > 1);
  const nameGroups = [
    ...groupsBy(allVotes, (vote) => clean(vote.visible_name), "Mismo nombre visible reutilizado", (key) => key),
    ...groupsBy(allVotes, (vote) => clean(vote.roblox_username), "Mismo usuario Roblox reutilizado", (key) => key),
  ].filter((group) => group.votes.length > 1);
  const observedVotes = allVotes.filter((vote) => vote.duplicate_candidate || ["observed", "pending_validation", "rejected", "annulled", "duplicate"].includes(vote.status));

  const signalVoteIds = signalIds(query.signal, { repeatedDiscord, similarDiscord, rapidWindows, ipGroups, deviceGroups, nameGroups, observedVotes });
  const filteredVotes = allVotes.filter((vote) => matchesFilters(vote, query, signalVoteIds));
  const visibleVotes = filteredVotes.slice(0, 100);
  const hasIpData = allVotes.some((vote) => Boolean(vote.ip_hash));
  const hasDeviceData = allVotes.some((vote) => Boolean(vote.user_agent_hash || vote.device_hint_hash));

  return (
    <>
      <AdminPageHeader
        title="Análisis de votos sospechosos"
        description="Revisión posterior solo lectura. Este panel analiza votos ya registrados y no modifica resultados."
        action={<div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}`}>Volver</Link></Button><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}/escrutinio`}>Escrutinio</Link></Button><Button asChild variant="outline"><Link href={`/admin/elecciones/${id}/resultados`}>Conteo electoral</Link></Button></div>}
      />

      <section className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <p className="font-semibold">Este panel detecta patrones sospechosos en votos ya registrados. No prueba fraude por sí solo.</p>
        <p>Si el sistema no registró IP o dispositivo al momento del voto, esos datos no estarán disponibles para votos antiguos.</p>
        <p>Las señales son para revisión humana. Ningún voto se modifica desde esta página.</p>
      </section>

      <section className="mb-5 rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.12em] text-muted-foreground">Elección analizada</p>
            <h2 className="mt-1 text-xl font-semibold text-[#153553]">{election.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{election.office} · {statusLabel(ELECTION_STATUS_LABELS, election.status)}</p>
          </div>
          <Badge variant="outline" className="border-slate-300 bg-slate-50">Solo lectura</Badge>
        </div>
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total votos analizados" value={String(allVotes.length)} detail="Filas leídas desde election_votes" icon={<Eye className="size-5" />} />
        <MetricCard label="Discord repetidos" value={String(repeatedDiscord.length)} detail="Grupos con el mismo Discord normalizado" icon={<Users className="size-5" />} />
        <MetricCard label="Discord parecidos" value={String(similarDiscord.length)} detail="Variantes posibles; no fraude confirmado" icon={<Binary className="size-5" />} />
        <MetricCard label="Votos rápidos" value={String(rapidWindows.length)} detail="Ventanas de 3/2 min o 5/10 min" icon={<Clock3 className="size-5" />} />
        <MetricCard label="Mismo IP hash" value={hasIpData ? String(ipGroups.length) : "N/D"} detail={hasIpData ? "Hash corto; nunca IP cruda" : "Sin datos históricos registrados"} icon={<Network className="size-5" />} />
        <MetricCard label="Mismo dispositivo" value={hasDeviceData ? String(deviceGroups.length) : "N/D"} detail={hasDeviceData ? "Hash de navegador/dispositivo" : "Sin datos históricos registrados"} icon={<Fingerprint className="size-5" />} />
        <MetricCard label="Observados/pendientes" value={String(observedVotes.length)} detail="Estados o banderas que requieren revisión" icon={<ShieldAlert className="size-5" />} />
        <MetricCard label="Limitaciones de datos" value={String((hasIpData ? 0 : 1) + (hasDeviceData ? 0 : 1))} detail="IP/dispositivo pueden no existir en votos antiguos" icon={<AlertTriangle className="size-5" />} />
      </div>

      <form className="mb-5 grid gap-3 rounded-xl border bg-white p-4 md:grid-cols-6">
        <Input name="discord" defaultValue={query.discord} placeholder="Discord" />
        <Input name="receipt" defaultValue={query.receipt} placeholder="Comprobante" />
        <select name="status" defaultValue={query.status ?? ""} className="h-9 rounded-md border px-3 text-sm">
          <option value="">Todos los estados</option>
          {Object.entries(VOTE_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <select name="signal" defaultValue={query.signal ?? ""} className="h-9 rounded-md border px-3 text-sm">
          <option value="">Todas las señales</option>
          <option value="repeated_discord">Discord repetido</option>
          <option value="similar_discord">Discord parecido</option>
          <option value="rapid">Ventana rápida</option>
          <option value="ip">IP hash</option>
          <option value="device">Dispositivo/navegador</option>
          <option value="name">Nombre/Roblox repetido</option>
          <option value="observed">Observado o pendiente</option>
        </select>
        <Input type="datetime-local" name="from" defaultValue={query.from} />
        <div className="flex gap-2"><Input type="datetime-local" name="to" defaultValue={query.to} /><Button type="submit" size="sm"><Search className="mr-1 size-4" />Filtrar</Button></div>
      </form>

      <AnalysisSection title="Discord repetidos" empty="No se detectaron Discord normalizados reutilizados.">
        {repeatedDiscord.map((group) => <GroupCard key={group.key} group={group} />)}
      </AnalysisSection>
      <AnalysisSection title="Discord parecidos" empty="No se detectaron variaciones evidentes por puntos, guiones, mayúsculas o @.">
        {similarDiscord.map((group) => <GroupCard key={group.key} group={group} />)}
      </AnalysisSection>
      <AnalysisSection title="Votos rápidos" empty="No se detectaron ventanas rápidas con los umbrales configurados.">
        {rapidWindows.map((group) => <GroupCard key={group.key} group={group} />)}
      </AnalysisSection>
      <AnalysisSection title="IP / red, si existe" empty={hasIpData ? "No se detectaron IP hash reutilizados." : "No hay datos de IP/dispositivo para votos anteriores porque no fueron registrados al momento del voto."}>
        {ipGroups.map((group) => <GroupCard key={group.key} group={group} />)}
      </AnalysisSection>
      <AnalysisSection title="Dispositivo / navegador, si existe" empty={hasDeviceData ? "No se detectaron hashes de dispositivo o navegador reutilizados." : "No hay datos de IP/dispositivo para votos anteriores porque no fueron registrados al momento del voto."}>
        {deviceGroups.map((group) => <GroupCard key={group.key} group={group} />)}
      </AnalysisSection>
      <AnalysisSection title="Nombres visibles / Roblox repetidos" empty="No se detectaron nombres visibles o usuarios Roblox reutilizados.">
        {nameGroups.map((group) => <GroupCard key={group.key} group={group} />)}
      </AnalysisSection>

      <section className="mb-5 rounded-xl border bg-white p-5">
        <h2 className="text-lg font-semibold text-[#153553]">Votos observados o pendientes</h2>
        {observedVotes.length ? <div className="mt-4 grid gap-2">{observedVotes.map((vote) => <VoteLine key={vote.id} vote={vote} showSelection />)}</div> : <p className="mt-3 text-sm text-muted-foreground">No hay votos observados, pendientes, rechazados, anulados o duplicados.</p>}
      </section>

      <section className="overflow-x-auto rounded-xl border bg-white">
        <div className="border-b p-5">
          <h2 className="text-lg font-semibold text-[#153553]">Tabla general de votos online</h2>
          <p className="mt-1 text-sm text-muted-foreground">Solo lectura. Los filtros no alteran votos, estados ni resultados. Se muestran hasta 100 filas para mantener la revisión fluida.</p>
        </div>
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead><tr className="border-b bg-slate-50"><th className="p-3">Comprobante</th><th className="p-3">Discord</th><th className="p-3">Nombre / Roblox</th><th className="p-3">Estado</th><th className="p-3">Fecha</th><th className="p-3">Selección</th><th className="p-3">Hashes</th><th className="p-3">Señales</th></tr></thead>
          <tbody>
            {visibleVotes.map((vote) => <tr key={vote.id} className="interactive-row border-b align-top"><td className="p-3 font-mono text-xs">{vote.receipt_code}</td><td className="p-3">{vote.discord_username || vote.discord_id || "—"}<p className="font-mono text-[11px] text-muted-foreground">{vote.discord_normalized || "sin normalizar"}</p></td><td className="p-3">{vote.visible_name || "—"}<p className="text-xs text-muted-foreground">{vote.roblox_username || "Sin Roblox"}</p></td><td className="p-3"><Badge variant="outline">{statusLabel(VOTE_STATUS_LABELS, vote.status)}</Badge>{vote.duplicate_candidate && <Badge variant="outline" className="ml-1 border-amber-200 bg-amber-50">duplicado candidato</Badge>}</td><td className="p-3">{formatDate(vote.submitted_at)}</td><td className="p-3">{selectedLabel(vote)}</td><td className="p-3 font-mono text-[11px] text-muted-foreground">IP: {shortHash(vote.ip_hash)}<br />UA: {shortHash(vote.user_agent_hash)}<br />Dev: {shortHash(vote.device_hint_hash)}</td><td className="p-3">{voteSignals(vote, { repeatedDiscord, similarDiscord, rapidWindows, ipGroups, deviceGroups, nameGroups, observedVotes }).join(" · ") || "—"}</td></tr>)}
          </tbody>
        </table>
        {!filteredVotes.length && <p className="p-8 text-center text-sm text-muted-foreground">No hay votos con los filtros actuales.</p>}
        {filteredVotes.length > visibleVotes.length && <p className="border-t p-4 text-xs text-muted-foreground">Hay {filteredVotes.length.toLocaleString("es-CO")} votos con los filtros actuales; se muestran los primeros {visibleVotes.length.toLocaleString("es-CO")} para mantener la página ágil.</p>}
      </section>
    </>
  );
}

function AnalysisSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const hasChildren = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return <section className="mb-5 rounded-xl border bg-white p-5"><h2 className="text-lg font-semibold text-[#153553]">{title}</h2>{hasChildren ? <div className="mt-4 grid gap-3">{children}</div> : <p className="mt-3 text-sm text-muted-foreground">{empty}</p>}</section>;
}

function GroupCard({ group }: { group: SignalGroup }) {
  return <div className="rounded-lg border bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-[#153553]">{group.label}</p><p className="mt-1 text-sm text-muted-foreground">{group.reason} · {group.votes.length} votos</p></div><Badge variant="outline">{group.votes.length} coincidencias</Badge></div><div className="mt-3 grid gap-2">{group.votes.map((vote) => <VoteLine key={vote.id} vote={vote} showSelection />)}</div></div>;
}

function VoteLine({ vote, showSelection }: { vote: VoteRow; showSelection?: boolean }) {
  return <div className="grid gap-2 rounded border bg-white p-3 text-xs md:grid-cols-[160px_1fr_170px_150px]"><span className="font-mono">{vote.receipt_code}</span><span>{vote.discord_username || vote.discord_id || "Sin Discord"} · {vote.visible_name || "Sin nombre"} · {vote.roblox_username || "Sin Roblox"}</span><span>{statusLabel(VOTE_STATUS_LABELS, vote.status)}</span><span>{formatDate(vote.submitted_at)}</span>{showSelection && <span className="text-muted-foreground md:col-span-4">Selección interna: {selectedLabel(vote)}</span>}</div>;
}

function groupsBy(votes: VoteRow[], keyFn: (vote: VoteRow) => string | null | undefined, reason: string, labelFn: (key: string) => string): SignalGroup[] {
  const map = new Map<string, VoteRow[]>();
  for (const vote of votes) {
    const key = keyFn(vote);
    if (!key) continue;
    map.set(key, [...(map.get(key) ?? []), vote]);
  }
  return [...map.entries()].map(([key, groupVotes]) => ({ key, label: labelFn(key), reason, votes: groupVotes })).sort((a, b) => b.votes.length - a.votes.length);
}

function similarDiscordGroups(votes: VoteRow[]) {
  return groupsBy(votes, (vote) => discordVariantKey(vote.discord_normalized || vote.discord_id || vote.discord_username), "Posible variación del mismo Discord", (key) => key)
    .filter((group) => group.votes.length > 1 && new Set(group.votes.map((vote) => clean(vote.discord_normalized || vote.discord_id || vote.discord_username))).size > 1);
}

function rapidVoteWindows(votes: VoteRow[]) {
  const windows = new Map<string, SignalGroup>();
  for (let i = 0; i < votes.length; i += 1) {
    for (const [minutes, threshold] of [[2, 3], [10, 5]] as const) {
      const start = new Date(votes[i].submitted_at).getTime();
      const cluster = votes.filter((vote) => {
        const timestamp = new Date(vote.submitted_at).getTime();
        return timestamp >= start && timestamp <= start + minutes * 60_000;
      });
      if (cluster.length >= threshold) {
        const key = `${minutes}-${new Date(start).toISOString()}`;
        windows.set(key, { key, label: `${formatDate(new Date(start).toISOString())} · ${minutes} min`, reason: `${cluster.length} votos en ${minutes} minutos`, votes: cluster });
      }
    }
  }
  return [...windows.values()].sort((a, b) => b.votes.length - a.votes.length).slice(0, 20);
}

function signalIds(signal: string | undefined, groups: { repeatedDiscord: SignalGroup[]; similarDiscord: SignalGroup[]; rapidWindows: SignalGroup[]; ipGroups: SignalGroup[]; deviceGroups: SignalGroup[]; nameGroups: SignalGroup[]; observedVotes: VoteRow[] }) {
  if (!signal) return null;
  const selected = signal === "repeated_discord" ? groups.repeatedDiscord : signal === "similar_discord" ? groups.similarDiscord : signal === "rapid" ? groups.rapidWindows : signal === "ip" ? groups.ipGroups : signal === "device" ? groups.deviceGroups : signal === "name" ? groups.nameGroups : [];
  const ids = new Set(selected.flatMap((group) => group.votes.map((vote) => vote.id)));
  if (signal === "observed") for (const vote of groups.observedVotes) ids.add(vote.id);
  return ids;
}

function matchesFilters(vote: VoteRow, query: Query, signalVoteIds: Set<string> | null) {
  const text = `${vote.discord_username ?? ""} ${vote.discord_id ?? ""} ${vote.discord_normalized ?? ""}`.toLowerCase();
  const receipt = vote.receipt_code.toLowerCase();
  const timestamp = new Date(vote.submitted_at).getTime();
  const from = query.from ? new Date(query.from).getTime() : null;
  const to = query.to ? new Date(query.to).getTime() : null;
  return (!query.status || vote.status === query.status)
    && (!query.discord || text.includes(query.discord.toLowerCase()))
    && (!query.receipt || receipt.includes(query.receipt.toLowerCase()))
    && (!from || timestamp >= from)
    && (!to || timestamp <= to)
    && (!signalVoteIds || signalVoteIds.has(vote.id));
}

function voteSignals(vote: VoteRow, groups: { repeatedDiscord: SignalGroup[]; similarDiscord: SignalGroup[]; rapidWindows: SignalGroup[]; ipGroups: SignalGroup[]; deviceGroups: SignalGroup[]; nameGroups: SignalGroup[]; observedVotes: VoteRow[] }) {
  const signals: string[] = [];
  const inGroup = (list: SignalGroup[]) => list.some((group) => group.votes.some((item) => item.id === vote.id));
  if (inGroup(groups.repeatedDiscord)) signals.push("Discord repetido");
  if (inGroup(groups.similarDiscord)) signals.push("Discord parecido");
  if (inGroup(groups.rapidWindows)) signals.push("Ventana rápida");
  if (inGroup(groups.ipGroups)) signals.push("IP hash");
  if (inGroup(groups.deviceGroups)) signals.push("Dispositivo/navegador");
  if (inGroup(groups.nameGroups)) signals.push("Nombre/Roblox");
  if (groups.observedVotes.some((item) => item.id === vote.id)) signals.push("Observado/pendiente");
  return signals;
}

function selectedLabel(vote: VoteRow) {
  const selected = one(vote.selected);
  if (!selected) return "Selección oculta por permisos.";
  return selected.is_blank_vote ? "Voto en blanco" : selected.candidate_name || `Tarjeta ${selected.option_number ?? ""}`;
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function clean(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase().replace(/^@+/, "").replace(/\s+/g, " ");
  return normalized || null;
}

function discordVariantKey(value: string | null | undefined) {
  return clean(value)?.replace(/[._-]/g, "").replace(/\s+/g, "") || null;
}

function shortHash(value: string | null | undefined) {
  return value ? `${value.slice(0, 10)}…` : "No registrado";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
