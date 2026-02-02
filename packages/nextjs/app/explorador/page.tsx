"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type Hex, parseAbiItem } from "viem";
import { usePublicClient } from "wagmi";
import { useDeployedContractInfo, useScaffoldReadContract } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { notification } from "~~/utils/scaffold-eth";

/**
 * app/explorador/page.tsx
 * Mini “Etherscan” para el contrato (Hardhat → Sepolia)
 * - Tabs: Actividad (eventos), Transacciones, Bloques
 * - Filtros pro (tipo, búsqueda, idVotacion)
 * - Paginación
 * - Links a explorer en Sepolia
 *
 * ✅ Optimización anti-límites RPC:
 * - NO escanea desde despliegue → latest (rango enorme)
 * - Solo consulta logs en los últimos N bloques
 * - Solo muestra los últimos 10 eventos (y timestamps solo para esos)
 */

type Pestaña = "actividad" | "transacciones" | "bloques";
type TipoActividad = "todas" | "VotacionCreada" | "VotoEmitido";

type Actividad = {
  tipo: "VotacionCreada" | "VotoEmitido";
  bloque: bigint;
  txHash: Hex;
  timestamp?: number;

  // Datos comunes
  idVotacion?: bigint;

  // VotacionCreada
  creador?: `0x${string}`;
  titulo?: string;
  fechaFin?: bigint;
  cantidadOpciones?: bigint;

  // VotoEmitido
  votante?: `0x${string}`;
  idOpcion?: bigint;
};

function acortarHash(hash?: string, start = 10, end = 8) {
  if (!hash) return "—";
  if (hash.length <= start + end) return hash;
  return `${hash.slice(0, start)}…${hash.slice(-end)}`;
}

function acortarDireccion(dir?: string) {
  if (!dir) return "—";
  return `${dir.slice(0, 6)}…${dir.slice(-4)}`;
}

function tiempoHace(segundosEpoch?: number) {
  if (!segundosEpoch) return "—";
  const ahora = Math.floor(Date.now() / 1000);
  const diff = Math.max(ahora - segundosEpoch, 0);

  if (diff < 10) return "hace unos segundos";
  if (diff < 60) return `hace ${diff}s`;
  const min = Math.floor(diff / 60);
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  const d = Math.floor(h / 24);
  return `hace ${d}d`;
}

function copiarAlPortapapeles(texto: string) {
  const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : undefined;

  if (clipboard?.writeText) {
    clipboard
      .writeText(texto)
      .then(() => notification.success("Copiado"))
      .catch(() => {
        if (copiarFallback(texto)) notification.success("Copiado");
        else notification.error("No se pudo copiar");
      });
    return;
  }

  if (copiarFallback(texto)) notification.success("Copiado");
  else notification.error("No se pudo copiar");
}

function copiarFallback(texto: string) {
  try {
    const textarea = document.createElement("textarea");
    textarea.value = texto;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "-1000px";
    textarea.style.left = "-1000px";

    document.body.appendChild(textarea);
    textarea.select();

    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);

    return ok;
  } catch {
    return false;
  }
}

function construirLink(explorerBase?: string, tipo?: "tx" | "block" | "address", valor?: string | number | bigint) {
  if (!explorerBase || !tipo || valor === undefined || valor === null) return undefined;
  const base = explorerBase.endsWith("/") ? explorerBase.slice(0, -1) : explorerBase;

  if (tipo === "tx") return `${base}/tx/${String(valor)}`;
  if (tipo === "block") return `${base}/block/${String(valor)}`;
  return `${base}/address/${String(valor)}`;
}

function claseBadgeEstado(tipo: TipoActividad) {
  if (tipo === "VotacionCreada") return "badge-primary";
  if (tipo === "VotoEmitido") return "badge-secondary";
  return "badge-ghost";
}

function normalizarTexto(s: string) {
  return s.trim().toLowerCase();
}

function esNumeroEnteroPositivo(s: string) {
  if (!s) return false;
  const n = Number(s);
  return Number.isInteger(n) && n >= 0;
}

export default function PaginaExplorador() {
  // ✅ UI: puedes dejar paginación, pero con 10 eventos realmente será 1 página
  const TAM_PAGINA = 25;

  // ✅ Anti-límites RPC:
  const MAX_EVENTOS_MOSTRAR = 10; // SOLO 10 eventos
  const BLOQUES_LOGS_RECIENTES = 5_000n; // solo últimos 5000 bloques (ajusta 2000–20000)

  const { targetNetwork } = useTargetNetwork();
  const explorerBase = (targetNetwork as any)?.blockExplorerUrl as string | undefined;

  const publicClient = usePublicClient();
  const { data: deployedContractData, isLoading: cargandoContrato } = useDeployedContractInfo({
    contractName: "VotacionUniversitaria",
  });

  const contractAddress = deployedContractData?.address as `0x${string}` | undefined;

  // (lo dejamos por compatibilidad, pero ya no usamos from=despliegue→latest)
  const { data: bloqueDespliegue } = useScaffoldReadContract({
    contractName: "VotacionUniversitaria",
    functionName: "bloqueDespliegue",
  });

  // UI state
  const [pestana, setPestana] = useState<Pestaña>("actividad");

  // Filtros pro
  const [tipoFiltro, setTipoFiltro] = useState<TipoActividad>("todas");
  const [busqueda, setBusqueda] = useState("");
  const [idVotacionFiltro, setIdVotacionFiltro] = useState("");
  const [soloConMiContrato, setSoloConMiContrato] = useState(true);
  const [ordenDesc, setOrdenDesc] = useState(true);

  // Paginación
  const [paginaActividad, setPaginaActividad] = useState(1);
  const [paginaTx, setPaginaTx] = useState(1);

  // Data state
  const [cargando, setCargando] = useState(false);
  const [actividad, setActividad] = useState<Actividad[]>([]);
  const [bloques, setBloques] = useState<any[]>([]);

  const eventoVotacionCreada = useMemo(
    () =>
      parseAbiItem(
        "event VotacionCreada(uint256 indexed idVotacion, address indexed creador, string titulo, uint256 fechaFin, uint256 cantidadOpciones)",
      ),
    [],
  );

  const eventoVotoEmitido = useMemo(
    () => parseAbiItem("event VotoEmitido(uint256 indexed idVotacion, address indexed votante, uint256 idOpcion)"),
    [],
  );

  // Reset paginación cuando cambian filtros relevantes
  useEffect(() => setPaginaActividad(1), [tipoFiltro, busqueda, idVotacionFiltro, ordenDesc]);
  useEffect(() => setPaginaTx(1), [busqueda, idVotacionFiltro, ordenDesc]);

  const recargar = useCallback(async () => {
    if (!publicClient || !contractAddress) return;

    setCargando(true);
    try {
      // ✅ Rango seguro: últimos N bloques
      const ultimoBloque = await publicClient.getBlockNumber();

      const desdePorRango = ultimoBloque > BLOQUES_LOGS_RECIENTES ? ultimoBloque - BLOQUES_LOGS_RECIENTES : 0n;

      // ✅ Si tienes bloqueDespliegue, lo respetamos solo si es más reciente que el rango (evita irte muy atrás)
      const desdeDeploy = BigInt(bloqueDespliegue ?? 0n);
      const desde = desdeDeploy > desdePorRango ? desdeDeploy : desdePorRango;

      // 1) Logs (dos tipos) SOLO en rango pequeño
      const [logsCreada, logsVoto] = await Promise.all([
        publicClient.getLogs({
          address: contractAddress,
          event: eventoVotacionCreada,
          fromBlock: desde,
          toBlock: ultimoBloque,
        }),
        publicClient.getLogs({
          address: contractAddress,
          event: eventoVotoEmitido,
          fromBlock: desde,
          toBlock: ultimoBloque,
        }),
      ]);

      const combinados: Actividad[] = [];

      for (const l of logsCreada) {
        const args: any = l.args;
        combinados.push({
          tipo: "VotacionCreada",
          bloque: l.blockNumber!,
          txHash: l.transactionHash!,
          idVotacion: args?.idVotacion,
          creador: args?.creador,
          titulo: args?.titulo,
          fechaFin: args?.fechaFin,
          cantidadOpciones: args?.cantidadOpciones,
        });
      }

      for (const l of logsVoto) {
        const args: any = l.args;
        combinados.push({
          tipo: "VotoEmitido",
          bloque: l.blockNumber!,
          txHash: l.transactionHash!,
          idVotacion: args?.idVotacion,
          votante: args?.votante,
          idOpcion: args?.idOpcion,
        });
      }

      // Orden base por bloque (desc) y toma SOLO los últimos 10
      combinados.sort((a, b) => {
        if (a.bloque === b.bloque) return a.txHash.localeCompare(b.txHash);
        return Number(b.bloque - a.bloque);
      });

      const ultimos = combinados.slice(0, MAX_EVENTOS_MOSTRAR);

      // 2) Timestamps SOLO para esos 10 eventos (máx 10 bloques únicos)
      const bloquesUnicos = Array.from(new Set(ultimos.map(x => x.bloque.toString()))).map(x => BigInt(x));
      const mapaTs = new Map<string, number>();

      // ✅ Secuencial (evita bursts de requests)
      for (const bn of bloquesUnicos) {
        try {
          const b = await publicClient.getBlock({ blockNumber: bn });
          mapaTs.set(bn.toString(), Number((b as any).timestamp ?? 0n));
        } catch {
          // ignore
        }
      }

      const conTiempo = ultimos.map(x => ({ ...x, timestamp: mapaTs.get(x.bloque.toString()) }));
      setActividad(conTiempo);

      // 3) Bloques recientes (10)
      const cantidadBloques = 10;
      const lista: any[] = [];
      for (let i = 0; i < cantidadBloques; i++) {
        const bn = ultimoBloque - BigInt(i);
        if (bn < 0n) break;
        try {
          const b = await publicClient.getBlock({ blockNumber: bn });
          lista.push(b);
        } catch {
          // ignore
        }
      }
      setBloques(lista);
    } catch (e: any) {
      notification.error(e?.shortMessage ?? e?.message ?? "Error cargando datos del explorador");
    } finally {
      setCargando(false);
    }
  }, [
    publicClient,
    contractAddress,
    bloqueDespliegue,
    eventoVotacionCreada,
    eventoVotoEmitido,
    BLOQUES_LOGS_RECIENTES,
    MAX_EVENTOS_MOSTRAR,
  ]);

  useEffect(() => {
    if (!publicClient || !contractAddress) return;
    recargar();
  }, [publicClient, contractAddress, recargar]);

  // ---- Derivados: conteos ----
  const conteos = useMemo(() => {
    const total = actividad.length;
    const creadas = actividad.filter(a => a.tipo === "VotacionCreada").length;
    const votos = actividad.filter(a => a.tipo === "VotoEmitido").length;
    const txs = new Set(actividad.map(a => a.txHash)).size;
    return { total, creadas, votos, txs };
  }, [actividad]);

  // ---- Filtros pro sobre Actividad ----
  const actividadFiltrada = useMemo(() => {
    let lista = [...actividad];

    if (!soloConMiContrato) {
      // no-op (placeholder)
    }

    if (tipoFiltro !== "todas") {
      lista = lista.filter(a => a.tipo === tipoFiltro);
    }

    const idTxt = idVotacionFiltro.trim();
    if (idTxt) {
      if (esNumeroEnteroPositivo(idTxt)) {
        const id = BigInt(Number(idTxt));
        lista = lista.filter(a => a.idVotacion === id);
      } else {
        lista = [];
      }
    }

    const q = normalizarTexto(busqueda);
    if (q) {
      lista = lista.filter(a => {
        const campos: string[] = [
          a.txHash,
          a.titulo ?? "",
          a.creador ?? "",
          a.votante ?? "",
          a.idVotacion?.toString() ?? "",
          a.idOpcion?.toString() ?? "",
          a.bloque.toString(),
        ];
        return campos.some(c => normalizarTexto(String(c)).includes(q));
      });
    }

    lista.sort((a, b) => {
      if (a.bloque === b.bloque) return a.txHash.localeCompare(b.txHash);
      return ordenDesc ? Number(b.bloque - a.bloque) : Number(a.bloque - b.bloque);
    });

    return lista;
  }, [actividad, tipoFiltro, busqueda, idVotacionFiltro, ordenDesc, soloConMiContrato]);

  // ---- Paginación Actividad ----
  const totalPaginasActividad = useMemo(() => Math.max(1, Math.ceil(actividadFiltrada.length / TAM_PAGINA)), [
    actividadFiltrada.length,
    TAM_PAGINA,
  ]);

  const paginaActividadSegura = useMemo(
    () => Math.min(Math.max(paginaActividad, 1), totalPaginasActividad),
    [paginaActividad, totalPaginasActividad],
  );

  const actividadPagina = useMemo(() => {
    const ini = (paginaActividadSegura - 1) * TAM_PAGINA;
    return actividadFiltrada.slice(ini, ini + TAM_PAGINA);
  }, [actividadFiltrada, paginaActividadSegura, TAM_PAGINA]);

  // ---- Transacciones derivadas (únicas por txHash) + filtros + paginación ----
  const transaccionesFiltradas = useMemo(() => {
    const mapa = new Map<string, Actividad>();
    for (const a of actividadFiltrada) {
      const existente = mapa.get(a.txHash);
      if (!existente) {
        mapa.set(a.txHash, a);
        continue;
      }
      if (existente.tipo === "VotoEmitido" && a.tipo === "VotacionCreada") {
        mapa.set(a.txHash, a);
      }
    }
    const lista = Array.from(mapa.values());

    lista.sort((a, b) => {
      if (a.bloque === b.bloque) return a.txHash.localeCompare(b.txHash);
      return ordenDesc ? Number(b.bloque - a.bloque) : Number(a.bloque - b.bloque);
    });

    return lista;
  }, [actividadFiltrada, ordenDesc]);

  const totalPaginasTx = useMemo(
    () => Math.max(1, Math.ceil(transaccionesFiltradas.length / TAM_PAGINA)),
    [transaccionesFiltradas.length, TAM_PAGINA],
  );

  const paginaTxSegura = useMemo(() => Math.min(Math.max(paginaTx, 1), totalPaginasTx), [paginaTx, totalPaginasTx]);

  const txPagina = useMemo(() => {
    const ini = (paginaTxSegura - 1) * TAM_PAGINA;
    return transaccionesFiltradas.slice(ini, ini + TAM_PAGINA);
  }, [transaccionesFiltradas, paginaTxSegura, TAM_PAGINA]);

  // ---- UI helpers ----
  const tarjetaEstado = useMemo(() => {
    if (cargando) return { texto: "Actualizando…", clase: "badge-warning" };
    return { texto: "Actualizado", clase: "badge-success" };
  }, [cargando]);

  const tieneContracto = !!contractAddress;

  return (
    <div className="p-6 max-w-8xl mx-auto">
      {/* HERO / HEADER */}
      <div className="bg-base-200 border border-base-300 rounded-2xl p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-bold">Explorador del contrato</h1>
              <span className="badge badge-outline">Estilo Etherscan</span>
              <span className={`badge ${tarjetaEstado.clase}`}>{tarjetaEstado.texto}</span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <span className="badge badge-neutral">
                Red: {targetNetwork?.name ?? "—"} ({targetNetwork?.id ?? "—"})
              </span>

              {contractAddress ? (
                <>
                  <span className="badge badge-primary badge-outline">Contrato: {acortarDireccion(contractAddress)}</span>
                  <button className="btn btn-xs btn-ghost" onClick={() => copiarAlPortapapeles(contractAddress)}>
                    Copiar
                  </button>
                  {explorerBase && (
                    <a
                      className="btn btn-xs btn-outline"
                      href={construirLink(explorerBase, "address", contractAddress)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver en Explorer
                    </a>
                  )}
                </>
              ) : (
                <span className="badge badge-warning">Contrato no detectado</span>
              )}

              <span className="badge badge-ghost">Mostrando: {actividad.length} eventos</span>
              <span className="badge badge-ghost">Rango logs: últimos {BLOQUES_LOGS_RECIENTES.toString()} bloques</span>
              <span className="badge badge-ghost">Página: {TAM_PAGINA}</span>
            </div>

            {/* KPIs rápidos */}
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="stat bg-base-100 border border-base-300 rounded-xl p-3">
                <div className="stat-title">Eventos</div>
                <div className="stat-value text-2xl">{conteos.total}</div>
              </div>
              <div className="stat bg-base-100 border border-base-300 rounded-xl p-3">
                <div className="stat-title">Votaciones creadas</div>
                <div className="stat-value text-2xl">{conteos.creadas}</div>
              </div>
              <div className="stat bg-base-100 border border-base-300 rounded-xl p-3">
                <div className="stat-title">Votos emitidos</div>
                <div className="stat-value text-2xl">{conteos.votos}</div>
              </div>
              <div className="stat bg-base-100 border border-base-300 rounded-xl p-3">
                <div className="stat-title">Tx únicas</div>
                <div className="stat-value text-2xl">{conteos.txs}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:items-end">
            <button className={`btn ${cargando ? "btn-disabled" : "btn-primary"}`} onClick={recargar} disabled={cargando}>
              {cargando ? (
                <>
                  <span className="loading loading-spinner loading-xs" /> Recargando…
                </>
              ) : (
                "Recargar"
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Estados base */}
      {cargandoContrato && (
        <div className="mt-6">
          <span className="loading loading-spinner loading-md" /> <span className="opacity-70">Cargando contrato…</span>
        </div>
      )}

      {!tieneContracto && !cargandoContrato && (
        <div className="mt-6 alert alert-warning">
          <span>
            No se encontró <b>VotacionUniversitaria</b> en <b>deployedContracts.ts</b> para la red actual. Deploya en esta
            red y recarga.
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6">
        <div className="tabs tabs-boxed">
          <button className={`tab ${pestana === "actividad" ? "tab-active" : ""}`} onClick={() => setPestana("actividad")}>
            Actividad <span className="ml-2 badge badge-ghost">{actividadFiltrada.length}</span>
          </button>
          <button
            className={`tab ${pestana === "transacciones" ? "tab-active" : ""}`}
            onClick={() => setPestana("transacciones")}
          >
            Transacciones <span className="ml-2 badge badge-ghost">{transaccionesFiltradas.length}</span>
          </button>
          <button className={`tab ${pestana === "bloques" ? "tab-active" : ""}`} onClick={() => setPestana("bloques")}>
            Bloques <span className="ml-2 badge badge-ghost">{bloques.length}</span>
          </button>
        </div>
      </div>

      {/* FILTROS (solo en actividad/tx) */}
      {(pestana === "actividad" || pestana === "transacciones") && (
        <div className="mt-4 card bg-base-100 border border-base-300">
          <div className="card-body p-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="font-semibold">Filtros</h2>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-sm btn-ghost"
                  onClick={() => {
                    setTipoFiltro("todas");
                    setBusqueda("");
                    setIdVotacionFiltro("");
                    setOrdenDesc(true);
                  }}
                  type="button"
                >
                  Limpiar filtros
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Tipo */}
              <label className="form-control">
                <div className="label">
                  <span className="label-text">Tipo</span>
                </div>
                <select
                  className="select select-bordered"
                  value={tipoFiltro}
                  onChange={e => setTipoFiltro(e.target.value as TipoActividad)}
                  disabled={cargando}
                >
                  <option value="todas">Todas</option>
                  <option value="VotacionCreada">Votación creada</option>
                  <option value="VotoEmitido">Voto emitido</option>
                </select>
              </label>

              {/* ID votación */}
              <label className="form-control">
                <div className="label">
                  <span className="label-text">ID Votación</span>
                  <span className="label-text-alt opacity-70">Exacto</span>
                </div>
                <input
                  className="input input-bordered"
                  placeholder="Ej: 0"
                  value={idVotacionFiltro}
                  onChange={e => setIdVotacionFiltro(e.target.value)}
                  disabled={cargando}
                />
              </label>

              {/* Búsqueda */}
              <label className="form-control md:col-span-2">
                <div className="label">
                  <span className="label-text">Búsqueda</span>
                  <span className="label-text-alt opacity-70">Título, txHash, address…</span>
                </div>
                <div className="join w-full">
                  <input
                    className="input input-bordered join-item w-full"
                    placeholder="Buscar…"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    disabled={cargando}
                  />
                  {busqueda ? (
                    <button className="btn join-item" type="button" onClick={() => setBusqueda("")} disabled={cargando}>
                      ✕
                    </button>
                  ) : (
                    <button className="btn join-item btn-ghost pointer-events-none" type="button">
                      🔎
                    </button>
                  )}
                </div>
              </label>

              {/* Orden */}
              <label className="form-control">
                <div className="label">
                  <span className="label-text">Orden</span>
                </div>
                <div className="join w-full">
                  <button
                    className={`btn join-item w-1/2 ${ordenDesc ? "btn-active" : "btn-ghost"}`}
                    onClick={() => setOrdenDesc(true)}
                    type="button"
                    disabled={cargando}
                  >
                    Recientes
                  </button>
                  <button
                    className={`btn join-item w-1/2 ${!ordenDesc ? "btn-active" : "btn-ghost"}`}
                    onClick={() => setOrdenDesc(false)}
                    type="button"
                    disabled={cargando}
                  >
                    Antiguas
                  </button>
                </div>
              </label>

              {/* Placeholder toggle (futuro) */}
              <label className="form-control">
                <div className="label">
                  <span className="label-text">Contrato</span>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" className="toggle toggle-primary" checked={soloConMiContrato} disabled />
                  <span className="text-sm opacity-70">Solo este contrato</span>
                </div>
              </label>

              <div className="md:col-span-3 flex items-center gap-2 flex-wrap">
                <span className={`badge ${claseBadgeEstado(tipoFiltro)}`}>
                  {tipoFiltro === "todas"
                    ? "Todas"
                    : tipoFiltro === "VotacionCreada"
                      ? "Votación creada"
                      : "Voto emitido"}
                </span>
                {idVotacionFiltro.trim() && (
                  <span className={`badge ${esNumeroEnteroPositivo(idVotacionFiltro.trim()) ? "badge-ghost" : "badge-error"}`}>
                    ID: {idVotacionFiltro.trim()}
                  </span>
                )}
                {busqueda.trim() && <span className="badge badge-ghost">Q: {busqueda.trim()}</span>}
                <span className="badge badge-neutral">
                  Resultados: {pestana === "actividad" ? actividadFiltrada.length : transaccionesFiltradas.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO */}
      <div className="mt-4">
        {/* ACTIVIDAD */}
        {pestana === "actividad" && (
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="card-title">Actividad del contrato (eventos)</h2>
                  <p className="text-sm opacity-70">
                    Vista reciente on-chain de <b>VotacionCreada</b> y <b>VotoEmitido</b>. (Optimizado: solo últimos {MAX_EVENTOS_MOSTRAR})
                  </p>
                </div>

                <Paginador
                  pagina={paginaActividadSegura}
                  totalPaginas={totalPaginasActividad}
                  onCambiar={setPaginaActividad}
                  deshabilitado={cargando}
                />
              </div>

              <div className="overflow-x-auto mt-4">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Tipo</th>
                      <th>Edad</th>
                      <th>Bloque</th>
                      <th>Tx</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!tieneContracto ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="opacity-70">Sin contrato detectado.</div>
                        </td>
                      </tr>
                    ) : actividadPagina.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="opacity-70">Sin resultados con estos filtros.</div>
                        </td>
                      </tr>
                    ) : (
                      actividadPagina.map((a, i) => (
                        <tr key={`${a.txHash}-${i}`}>
                          <td>
                            <span className={`badge ${a.tipo === "VotacionCreada" ? "badge-primary" : "badge-secondary"}`}>
                              {a.tipo === "VotacionCreada" ? "Votación creada" : "Voto emitido"}
                            </span>
                          </td>

                          <td className="font-mono text-xs">{tiempoHace(a.timestamp)}</td>

                          <td className="font-mono">
                            {explorerBase ? (
                              <a className="link" href={construirLink(explorerBase, "block", a.bloque)} target="_blank" rel="noreferrer">
                                {a.bloque.toString()}
                              </a>
                            ) : (
                              a.bloque.toString()
                            )}
                          </td>

                          <td className="font-mono">
                            <div className="flex items-center gap-2">
                              {explorerBase ? (
                                <a className="link" href={construirLink(explorerBase, "tx", a.txHash)} target="_blank" rel="noreferrer">
                                  {acortarHash(a.txHash)}
                                </a>
                              ) : (
                                <span>{acortarHash(a.txHash)}</span>
                              )}
                              <button className="btn btn-ghost btn-xs" onClick={() => copiarAlPortapapeles(a.txHash)} type="button">
                                Copiar
                              </button>
                            </div>
                          </td>

                          <td>
                            {a.tipo === "VotacionCreada" ? (
                              <div className="text-sm">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="badge badge-ghost">ID: {a.idVotacion?.toString() ?? "—"}</span>
                                  <span className="badge badge-ghost">Opciones: {a.cantidadOpciones?.toString() ?? "—"}</span>
                                  <span className="badge badge-ghost">Creador: {acortarDireccion(a.creador)}</span>
                                  {a.fechaFin && (
                                    <span className="badge badge-ghost">Fin: {new Date(Number(a.fechaFin) * 1000).toLocaleString()}</span>
                                  )}
                                </div>
                                <div className="mt-2 font-semibold break-words">{a.titulo ?? "—"}</div>
                              </div>
                            ) : (
                              <div className="text-sm">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="badge badge-ghost">ID: {a.idVotacion?.toString() ?? "—"}</span>
                                  <span className="badge badge-ghost">
                                    Opción: {a.idOpcion !== undefined ? (Number(a.idOpcion) + 1).toString() : "—"}
                                  </span>
                                  <span className="badge badge-ghost">Votante: {acortarDireccion(a.votante)}</span>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <Paginador
                  pagina={paginaActividadSegura}
                  totalPaginas={totalPaginasActividad}
                  onCambiar={setPaginaActividad}
                  deshabilitado={cargando}
                />
              </div>

              <div className="text-xs opacity-70 mt-3">
                Tip para defensa: “Esta pantalla muestra la actividad reciente del contrato (últimos eventos) optimizada para no depender de indexadores.”
              </div>
            </div>
          </div>
        )}

        {/* TRANSACCIONES */}
        {pestana === "transacciones" && (
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="card-title">Transacciones del contrato</h2>
                  <p className="text-sm opacity-70">Tx únicas derivadas de los eventos cargados. (Vista reciente optimizada).</p>
                </div>

                <Paginador pagina={paginaTxSegura} totalPaginas={totalPaginasTx} onCambiar={setPaginaTx} deshabilitado={cargando} />
              </div>

              <div className="overflow-x-auto mt-4">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Tx</th>
                      <th>Bloque</th>
                      <th>Edad</th>
                      <th>Acción</th>
                      <th>Referencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!tieneContracto ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="opacity-70">Sin contrato detectado.</div>
                        </td>
                      </tr>
                    ) : txPagina.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="opacity-70">Sin resultados con estos filtros.</div>
                        </td>
                      </tr>
                    ) : (
                      txPagina.map((t, i) => (
                        <tr key={`${t.txHash}-${i}`}>
                          <td className="font-mono">
                            <div className="flex items-center gap-2">
                              {explorerBase ? (
                                <a className="link" href={construirLink(explorerBase, "tx", t.txHash)} target="_blank" rel="noreferrer">
                                  {acortarHash(t.txHash)}
                                </a>
                              ) : (
                                <span>{acortarHash(t.txHash)}</span>
                              )}
                              <button className="btn btn-ghost btn-xs" onClick={() => copiarAlPortapapeles(t.txHash)} type="button">
                                Copiar
                              </button>
                            </div>
                          </td>

                          <td className="font-mono">
                            {explorerBase ? (
                              <a className="link" href={construirLink(explorerBase, "block", t.bloque)} target="_blank" rel="noreferrer">
                                {t.bloque.toString()}
                              </a>
                            ) : (
                              t.bloque.toString()
                            )}
                          </td>

                          <td className="font-mono text-xs">{tiempoHace(t.timestamp)}</td>

                          <td>
                            <span className={`badge ${t.tipo === "VotacionCreada" ? "badge-primary" : "badge-secondary"}`}>
                              {t.tipo === "VotacionCreada" ? "Crear votación" : "Votar"}
                            </span>
                          </td>

                          <td className="text-sm">
                            {t.idVotacion !== undefined ? <span className="badge badge-ghost">ID: {t.idVotacion.toString()}</span> : <span className="opacity-70">—</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex justify-end">
                <Paginador pagina={paginaTxSegura} totalPaginas={totalPaginasTx} onCambiar={setPaginaTx} deshabilitado={cargando} />
              </div>

              <div className="text-xs opacity-70 mt-3">Nota: vista reciente para demo estable en Sepolia.</div>
            </div>
          </div>
        )}

        {/* BLOQUES */}
        {pestana === "bloques" && (
          <div className="card bg-base-100 border border-base-300">
            <div className="card-body">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="card-title">Bloques recientes</h2>
                  <p className="text-sm opacity-70">Últimos bloques de la red actual. (Vista tipo explorer, versión simple).</p>
                </div>
              </div>

              <div className="overflow-x-auto mt-4">
                <table className="table table-zebra">
                  <thead>
                    <tr>
                      <th>Bloque</th>
                      <th>Edad</th>
                      <th>Miner</th>
                      <th>Txs</th>
                      <th>Base fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bloques.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="opacity-70">Sin datos de bloques (recarga).</div>
                        </td>
                      </tr>
                    ) : (
                      bloques.map((b: any) => (
                        <tr key={b.hash}>
                          <td className="font-mono">
                            {explorerBase ? (
                              <a className="link" href={construirLink(explorerBase, "block", b.number)} target="_blank" rel="noreferrer">
                                {String(b.number)}
                              </a>
                            ) : (
                              String(b.number)
                            )}
                          </td>
                          <td className="font-mono text-xs">{tiempoHace(Number(b.timestamp ?? 0n))}</td>
                          <td className="font-mono">{acortarDireccion(b.miner)}</td>
                          <td>{b.transactions?.length ?? "—"}</td>
                          <td className="font-mono text-xs">{b.baseFeePerGas ? `${b.baseFeePerGas.toString()} wei` : "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-xs opacity-70 mt-3">En Hardhat local, el “miner” puede verse distinto. En Sepolia se parece más al explorer real.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Paginador reusable (UI pro, simple y clara) */
function Paginador({
  pagina,
  totalPaginas,
  onCambiar,
  deshabilitado,
}: {
  pagina: number;
  totalPaginas: number;
  onCambiar: (p: number) => void;
  deshabilitado?: boolean;
}) {
  const puedeAtras = pagina > 1;
  const puedeAdelante = pagina < totalPaginas;

  const paginas = useMemo(() => {
    const w = 5;
    const inicio = Math.max(1, pagina - Math.floor(w / 2));
    const fin = Math.min(totalPaginas, inicio + w - 1);
    const inicioAjustado = Math.max(1, fin - w + 1);

    const arr: number[] = [];
    for (let i = inicioAjustado; i <= fin; i++) arr.push(i);
    return arr;
  }, [pagina, totalPaginas]);

  return (
    <div className="join">
      <button className="btn btn-sm join-item" onClick={() => onCambiar(1)} disabled={!puedeAtras || deshabilitado} type="button" title="Primera">
        «
      </button>
      <button
        className="btn btn-sm join-item"
        onClick={() => onCambiar(pagina - 1)}
        disabled={!puedeAtras || deshabilitado}
        type="button"
        title="Anterior"
      >
        ‹
      </button>

      {paginas[0] !== 1 && (
        <>
          <button className="btn btn-sm join-item btn-ghost" onClick={() => onCambiar(1)} disabled={deshabilitado} type="button">
            1
          </button>
          <button className="btn btn-sm join-item btn-ghost pointer-events-none" type="button">
            …
          </button>
        </>
      )}

      {paginas.map(p => (
        <button
          key={p}
          className={`btn btn-sm join-item ${p === pagina ? "btn-active" : "btn-ghost"}`}
          onClick={() => onCambiar(p)}
          disabled={deshabilitado}
          type="button"
        >
          {p}
        </button>
      ))}

      {paginas[paginas.length - 1] !== totalPaginas && (
        <>
          <button className="btn btn-sm join-item btn-ghost pointer-events-none" type="button">
            …
          </button>
          <button className="btn btn-sm join-item btn-ghost" onClick={() => onCambiar(totalPaginas)} disabled={deshabilitado} type="button">
            {totalPaginas}
          </button>
        </>
      )}

      <button
        className="btn btn-sm join-item"
        onClick={() => onCambiar(pagina + 1)}
        disabled={!puedeAdelante || deshabilitado}
        type="button"
        title="Siguiente"
      >
        ›
      </button>
      <button
        className="btn btn-sm join-item"
        onClick={() => onCambiar(totalPaginas)}
        disabled={!puedeAdelante || deshabilitado}
        type="button"
        title="Última"
      >
        »
      </button>
    </div>
  );
}
