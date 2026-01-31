"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { useScaffoldReadContract, useScaffoldWriteContract } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

type FiltroEstado = "todas" | "activas" | "cerradas";
type Orden = "recientes" | "antiguas";

function acortarDireccion(dir?: string) {
  if (!dir) return "No conectado";
  return `${dir.slice(0, 6)}...${dir.slice(-4)}`;
}

function ahoraSegundos() {
  return Math.floor(Date.now() / 1000);
}

function formatearRestante(segundos: number) {
  const s = Math.max(segundos, 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function bigintANumeroSeguro(v: bigint) {
  // Para este caso (demo universitaria) los votos serán pequeños.
  // Si algún día esperas números enormes, lo tratamos distinto.
  return Number(v);
}

function sumarBigints(mapa: Record<number, bigint>) {
  let total = 0n;
  for (const v of Object.values(mapa)) total += v;
  return total;
}

export default function PaginaVotacion() {
  const { address, isConnected } = useAccount();

  // Total
  const { data: totalVotaciones } = useScaffoldReadContract({
    contractName: "VotacionUniversitaria",
    functionName: "contadorVotaciones",
  });

  // Owner del contrato
  const { data: owner } = useScaffoldReadContract({
    contractName: "VotacionUniversitaria",
    functionName: "owner",
  });

  const esOwner = useMemo(() => {
    if (!address || !owner) return false;
    return address.toLowerCase() === owner.toLowerCase();
  }, [address, owner]);

  // UI controls
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todas");
  const [orden, setOrden] = useState<Orden>("recientes");

  // ✅ Escalabilidad: "Cargar más"
  const [cantidadVisible, setCantidadVisible] = useState(8);
  const pasoCarga = 8;

  useEffect(() => {
    // Cuando cambias filtros/orden/búsqueda, volvemos a mostrar menos para mejor UX.
    setCantidadVisible(8);
  }, [busqueda, filtroEstado, orden]);

  const idsOrdenados = useMemo(() => {
    const total = Number(totalVotaciones ?? 0n);
    const base = Array.from({ length: total }, (_, i) => i);
    return orden === "recientes" ? base.reverse() : base;
  }, [totalVotaciones, orden]);

  const idsParaRender = useMemo(() => {
    return idsOrdenados.slice(0, cantidadVisible);
  }, [idsOrdenados, cantidadVisible]);

  return (
    <div className="min-h-screen">
      {/* HERO */}
      <div className="bg-base-200 border-b border-base-300">
        <div className="p-6 max-w-6xl mx-auto">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold">Votación Universitaria</h1>
                <span className="badge badge-outline">Demo dApp</span>
              </div>
              <p className="opacity-70 mt-1">
                Elige una opción, firma la transacción y tu voto queda registrado on-chain.
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className="badge badge-neutral">Red: Hardhat (31337)</span>
                <span className={`badge ${isConnected ? "badge-success" : "badge-warning"}`}>
                  {isConnected ? "Wallet conectada" : "Conecta tu wallet"}
                </span>
                <span className="badge badge-ghost">Total: {totalVotaciones?.toString() ?? "0"}</span>
                {owner && (
                  <span className={`badge ${esOwner ? "badge-primary" : "badge-ghost"}`}>
                    Owner: {acortarDireccion(owner)}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-3">
              <div className="text-right">
                <div className="text-xs opacity-70">Tu cuenta</div>
                <div className="font-mono text-sm">{acortarDireccion(address)}</div>
                {isConnected && (
                  <div className="text-xs opacity-70 mt-1">
                    Rol:{" "}
                    <span className={esOwner ? "text-primary font-semibold" : ""}>
                      {esOwner ? "Owner (admin)" : "Estudiante (votante)"}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controles */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="input input-bordered flex items-center gap-2">
              <span className="opacity-60">🔎</span>
              <input
                className="grow"
                placeholder="Buscar por título…"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
              {busqueda && (
                <button className="btn btn-ghost btn-xs" onClick={() => setBusqueda("")}>
                  Limpiar
                </button>
              )}
            </label>

            <div className="join w-full">
              <button
                className={`btn join-item w-1/3 ${filtroEstado === "todas" ? "btn-active" : "btn-ghost"}`}
                onClick={() => setFiltroEstado("todas")}
              >
                Todas
              </button>
              <button
                className={`btn join-item w-1/3 ${filtroEstado === "activas" ? "btn-active" : "btn-ghost"}`}
                onClick={() => setFiltroEstado("activas")}
              >
                Activas
              </button>
              <button
                className={`btn join-item w-1/3 ${filtroEstado === "cerradas" ? "btn-active" : "btn-ghost"}`}
                onClick={() => setFiltroEstado("cerradas")}
              >
                Cerradas
              </button>
            </div>

            <div className="join w-full md:justify-self-end md:w-auto">
              <button
                className={`btn join-item ${orden === "recientes" ? "btn-active" : "btn-ghost"}`}
                onClick={() => setOrden("recientes")}
              >
                Más recientes
              </button>
              <button
                className={`btn join-item ${orden === "antiguas" ? "btn-active" : "btn-ghost"}`}
                onClick={() => setOrden("antiguas")}
              >
                Más antiguas
              </button>
            </div>
          </div>

          {/* FORMULARIO (solo owner) */}
          {esOwner && <FormularioCrearVotacion />}
        </div>
      </div>

      {/* LISTA */}
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm opacity-70">
            Mostrando <span className="font-semibold">{Math.min(cantidadVisible, idsOrdenados.length)}</span> de{" "}
            <span className="font-semibold">{idsOrdenados.length}</span> votación(es).
            <span className="ml-2 opacity-60">(Los filtros se aplican dentro de cada tarjeta)</span>
          </div>

          {idsOrdenados.length > 0 && (
            <div className="join">
              <button
                className="btn btn-sm join-item"
                onClick={() => setCantidadVisible(8)}
                disabled={cantidadVisible <= 8}
              >
                Reset
              </button>
              <button
                className="btn btn-sm join-item"
                onClick={() => setCantidadVisible(v => Math.min(v + pasoCarga, idsOrdenados.length))}
                disabled={cantidadVisible >= idsOrdenados.length}
              >
                Cargar {pasoCarga} más
              </button>
              <button
                className="btn btn-sm join-item"
                onClick={() => setCantidadVisible(idsOrdenados.length)}
                disabled={cantidadVisible >= idsOrdenados.length}
              >
                Ver todas
              </button>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-4">
          {idsOrdenados.length === 0 ? (
            <div className="alert">
              <span>No hay votaciones creadas todavía.</span>
            </div>
          ) : (
            idsParaRender.map(id => (
              <TarjetaVotacion key={id} idVotacion={id} busqueda={busqueda} filtroEstado={filtroEstado} />
            ))
          )}
        </div>

        {cantidadVisible < idsOrdenados.length && (
          <div className="mt-6 flex justify-center">
            <button
              className="btn btn-primary btn-wide"
              onClick={() => setCantidadVisible(v => Math.min(v + pasoCarga, idsOrdenados.length))}
            >
              Cargar más votaciones
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function FormularioCrearVotacion() {
  type UnidadDuracion = "minutos" | "horas" | "dias" | "semanas";

  const [abierto, setAbierto] = useState(true);
  const [titulo, setTitulo] = useState("");

  // ✅ Opciones como lista (mejor UX)
  const [opciones, setOpciones] = useState<string[]>(["Sí", "No"]);
  const [nuevaOpcion, setNuevaOpcion] = useState("");

  // ✅ Duración avanzada (min/h/d/sem) con tope 30 días
  const MAX_SEGUNDOS = 30 * 24 * 60 * 60; // 30 días (1 mes)
  const [unidadDuracion, setUnidadDuracion] = useState<UnidadDuracion>("minutos");
  const [duracionValor, setDuracionValor] = useState<number>(10);

  const factorUnidad = useMemo(() => {
    if (unidadDuracion === "minutos") return 60;
    if (unidadDuracion === "horas") return 60 * 60;
    if (unidadDuracion === "dias") return 24 * 60 * 60;
    return 7 * 24 * 60 * 60; // semanas
  }, [unidadDuracion]);

  const duracionSegundos = useMemo(() => {
    const v = Number.isFinite(duracionValor) ? duracionValor : 0;
    const bruto = Math.max(0, Math.floor(v * factorUnidad));
    return Math.min(bruto, MAX_SEGUNDOS);
  }, [duracionValor, factorUnidad]);

  const tituloOk = titulo.trim().length > 0;
  const opcionesOk = opciones.filter(o => o.trim().length > 0).length >= 2;
  const duracionOk = duracionSegundos > 0;
  const puedeCrear = tituloOk && opcionesOk && duracionOk;

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "VotacionUniversitaria",
  });

  const agregarOpcion = useCallback(() => {
    const valor = nuevaOpcion.trim();
    if (!valor) return;

    const existe = opciones.some(o => o.trim().toLowerCase() === valor.toLowerCase());
    if (existe) {
      notification.error("Esa opción ya existe.");
      return;
    }

    setOpciones(prev => [...prev, valor]);
    setNuevaOpcion("");
  }, [nuevaOpcion, opciones]);

  const eliminarOpcion = useCallback((idx: number) => {
    setOpciones(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const moverArriba = useCallback((idx: number) => {
    setOpciones(prev => {
      if (idx <= 0) return prev;
      const copia = [...prev];
      [copia[idx - 1], copia[idx]] = [copia[idx], copia[idx - 1]];
      return copia;
    });
  }, []);

  const moverAbajo = useCallback((idx: number) => {
    setOpciones(prev => {
      if (idx >= prev.length - 1) return prev;
      const copia = [...prev];
      [copia[idx + 1], copia[idx]] = [copia[idx], copia[idx + 1]];
      return copia;
    });
  }, []);

  const actualizarOpcion = useCallback((idx: number, valor: string) => {
    setOpciones(prev => {
      const copia = [...prev];
      copia[idx] = valor;
      return copia;
    });
  }, []);

  const limpiar = useCallback(() => {
    setTitulo("");
    setOpciones(["Sí", "No"]);
    setNuevaOpcion("");
    setUnidadDuracion("minutos");
    setDuracionValor(10);
  }, []);

  // ✅ Preview final (limpio + sin vacíos)
  const opcionesFinales = useMemo(() => opciones.map(o => o.trim()).filter(Boolean), [opciones]);

  return (
    <div className="mt-6">
      <div className="card bg-base-100 border border-base-300 shadow">
        <div className="card-body">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="card-title">Panel del owner</h2>
                <span className="badge badge-primary badge-outline">Admin</span>
                <span className="badge badge-ghost">Crear votaciones</span>
              </div>
              <p className="text-sm opacity-70 mt-1">
                Crea votaciones con opciones dinámicas. Se pedirá confirmación en MetaMask.
              </p>
            </div>

            <button className="btn btn-sm btn-ghost" onClick={() => setAbierto(v => !v)}>
              {abierto ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          {abierto && (
            <>
              <div className="divider my-3" />

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-4">
                  <div className="card bg-base-200 border border-base-300">
                    <div className="card-body p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Pregunta / Título</h3>
                        <span className={`text-xs ${tituloOk ? "opacity-60" : "text-error"}`}>
                          {tituloOk ? "OK" : "Requerido"}
                        </span>
                      </div>

                      <input
                        className="input input-bordered w-full mt-2"
                        placeholder="Ej: ¿Debe aprobarse el nuevo reglamento?"
                        value={titulo}
                        onChange={e => setTitulo(e.target.value)}
                        maxLength={120}
                        disabled={isPending}
                      />
                      <div className="text-xs opacity-70 mt-2">
                        Consejo: usa un título corto y específico (máx. 120 caracteres).
                      </div>
                    </div>
                  </div>

                  <div className="card bg-base-200 border border-base-300">
                    <div className="card-body p-4">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold">Opciones de respuesta</h3>
                        <span className={`text-xs ${opcionesOk ? "opacity-60" : "text-error"}`}>
                          {opcionesOk ? `${opcionesFinales.length} opción(es)` : "Mínimo 2"}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-col md:flex-row gap-2">
                        <input
                          className="input input-bordered w-full"
                          placeholder="Escribe una opción y presiona Agregar…"
                          value={nuevaOpcion}
                          onChange={e => setNuevaOpcion(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              agregarOpcion();
                            }
                          }}
                          disabled={isPending}
                        />
                        <button className="btn btn-primary" onClick={agregarOpcion} disabled={isPending}>
                          Agregar
                        </button>
                      </div>

                      <div className="mt-4 space-y-2">
                        {opciones.map((op, idx) => (
                          <div
                            key={`${idx}-${op}`}
                            className="flex items-center gap-2 p-3 rounded-xl bg-base-100 border border-base-300"
                          >
                            <span className="badge badge-ghost">{idx + 1}</span>

                            <input
                              className="input input-bordered input-sm w-full"
                              value={op}
                              onChange={e => actualizarOpcion(idx, e.target.value)}
                              placeholder={`Opción ${idx + 1}`}
                              disabled={isPending}
                            />

                            <div className="join">
                              <button
                                className="btn btn-sm join-item"
                                onClick={() => moverArriba(idx)}
                                disabled={isPending || idx === 0}
                                title="Subir"
                                type="button"
                              >
                                ↑
                              </button>
                              <button
                                className="btn btn-sm join-item"
                                onClick={() => moverAbajo(idx)}
                                disabled={isPending || idx === opciones.length - 1}
                                title="Bajar"
                                type="button"
                              >
                                ↓
                              </button>
                            </div>

                            <button
                              className="btn btn-sm btn-error btn-outline"
                              onClick={() => eliminarOpcion(idx)}
                              disabled={isPending}
                              title="Eliminar"
                              type="button"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 text-xs opacity-70">
                        Tip: usa 2–6 opciones para una demo clara. Puedes reordenar con ↑ ↓.
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="card bg-base-200 border border-base-300">
                    <div className="card-body p-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Duración</h3>
                        <span className={`text-xs ${duracionOk ? "opacity-60" : "text-error"}`}>
                          {duracionOk ? `${duracionSegundos}s` : "Debe ser > 0"}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3">
                        <label className="form-control">
                          <div className="label">
                            <span className="label-text">Unidad</span>
                          </div>
                          <select
                            className="select select-bordered"
                            value={unidadDuracion}
                            onChange={e => setUnidadDuracion(e.target.value as any)}
                            disabled={isPending}
                          >
                            <option value="minutos">Minutos</option>
                            <option value="horas">Horas</option>
                            <option value="dias">Días</option>
                            <option value="semanas">Semanas</option>
                          </select>
                        </label>

                        <label className="form-control">
                          <div className="label">
                            <span className="label-text">Cantidad</span>
                            <span className="label-text-alt opacity-70">Máximo: 30 días (1 mes)</span>
                          </div>

                          <div className="join w-full">
                            <input
                              type="number"
                              className="input input-bordered join-item w-full"
                              min={1}
                              value={duracionValor}
                              onChange={e => setDuracionValor(Number(e.target.value))}
                              disabled={isPending}
                            />
                            <span className="btn join-item btn-ghost pointer-events-none">{unidadDuracion}</span>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              className="btn btn-xs"
                              type="button"
                              onClick={() => {
                                setUnidadDuracion("horas");
                                setDuracionValor(1);
                              }}
                              disabled={isPending}
                            >
                              1 hora
                            </button>
                            <button
                              className="btn btn-xs"
                              type="button"
                              onClick={() => {
                                setUnidadDuracion("dias");
                                setDuracionValor(1);
                              }}
                              disabled={isPending}
                            >
                              1 día
                            </button>
                            <button
                              className="btn btn-xs"
                              type="button"
                              onClick={() => {
                                setUnidadDuracion("semanas");
                                setDuracionValor(1);
                              }}
                              disabled={isPending}
                            >
                              1 semana
                            </button>
                            <button
                              className="btn btn-xs"
                              type="button"
                              onClick={() => {
                                setUnidadDuracion("dias");
                                setDuracionValor(30);
                              }}
                              disabled={isPending}
                            >
                              1 mes (30 días)
                            </button>
                          </div>

                          <div className="text-xs opacity-70 mt-3">
                            Duración efectiva:{" "}
                            <span className="font-mono">{Math.floor(duracionSegundos / 60)} min</span> (tope 30 días)
                          </div>

                          {duracionSegundos === MAX_SEGUNDOS && (
                            <div className="alert alert-warning mt-3">
                              <span>Se aplicó el máximo permitido: 30 días.</span>
                            </div>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="card bg-base-200 border border-base-300">
                    <div className="card-body p-4">
                      <h3 className="font-semibold">Vista previa</h3>

                      <div className="mt-3 p-3 rounded-xl bg-base-100 border border-base-300">
                        <div className="text-sm font-semibold break-words">
                          {tituloOk ? titulo.trim() : "— Escribe un título —"}
                        </div>

                        <div className="mt-3 space-y-2">
                          {(opcionesFinales.length ? opcionesFinales : ["— Agrega al menos 2 opciones —"]).map(
                            (op, idx) => (
                              <div key={`${idx}-${op}`} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="badge badge-ghost">{idx + 1}</span>
                                  <span className="truncate">{op}</span>
                                </div>
                                <span className="badge badge-ghost">0</span>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card bg-base-100 border border-base-300">
                    <div className="card-body p-4">
                      <button
                        className={`btn w-full ${puedeCrear ? "btn-primary" : "btn-disabled"}`}
                        disabled={!puedeCrear || isPending}
                        onClick={async () => {
                          try {
                            const tituloFinal = titulo.trim();

                            await writeContractAsync({
                              functionName: "crearVotacion",
                              args: [tituloFinal, opcionesFinales, BigInt(duracionSegundos)],
                            });

                            notification.success("¡Votación creada con éxito!");
                            limpiar();
                          } catch (e: any) {
                            notification.error(e?.shortMessage ?? e?.message ?? "Error al crear la votación");
                          }
                        }}
                      >
                        {isPending ? (
                          <>
                            <span className="loading loading-spinner loading-xs" /> Creando…
                          </>
                        ) : (
                          "Crear votación"
                        )}
                      </button>

                      <button className="btn btn-ghost w-full mt-2" onClick={limpiar} disabled={isPending}>
                        Limpiar
                      </button>

                      <div className="text-xs opacity-70 mt-3">
                        Se pedirá confirmación en MetaMask. La votación quedará registrada on-chain.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function TarjetaVotacion({
  idVotacion,
  busqueda,
  filtroEstado,
}: {
  idVotacion: number;
  busqueda: string;
  filtroEstado: FiltroEstado;
}) {
  const { address, isConnected } = useAccount();

  // ✅ Estado UI: colapsar/expandir (mejora brutal con muchas votaciones)
  const [expandida, setExpandida] = useState(false);

  // ✅ Reloj en vivo para que el "restante" se actualice
  const [ahora, setAhora] = useState(() => ahoraSegundos());
  useEffect(() => {
    const t = setInterval(() => setAhora(ahoraSegundos()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: votacion } = useScaffoldReadContract({
    contractName: "VotacionUniversitaria",
    functionName: "obtenerVotacion",
    args: [BigInt(idVotacion)],
  });

  const { data: opciones } = useScaffoldReadContract({
    contractName: "VotacionUniversitaria",
    functionName: "obtenerOpciones",
    args: [BigInt(idVotacion)],
  });

  const { data: yaVoto } = useScaffoldReadContract({
    contractName: "VotacionUniversitaria",
    functionName: "yaVoto",
    args: [BigInt(idVotacion), address ?? "0x0000000000000000000000000000000000000000"],
  });

  const titulo = votacion?.[0] ?? "";
  const creador = votacion?.[1] ?? "0x0000000000000000000000000000000000000000";
  const fechaFin = votacion?.[2] ?? 0n;
  const cantidadOpciones = votacion?.[3] ?? 0n;
  const activa = votacion?.[4] ?? false;

  // ✅ Filtros (sin romper hooks): calculamos booleanos y retornamos al final
  const q = busqueda.trim().toLowerCase();
  const tituloLower = titulo.toLowerCase();

  const debeOcultarsePorBusqueda = !!q && !tituloLower.includes(q);
  const debeOcultarsePorEstado = (filtroEstado === "activas" && !activa) || (filtroEstado === "cerradas" && activa);

  const sinDataAun = !votacion;
  const debeOcultarse = sinDataAun || debeOcultarsePorBusqueda || debeOcultarsePorEstado;

  const fin = Number(fechaFin);
  const restante = Math.max(fin - ahora, 0);

  // Heurística visual del tiempo (para que se vea “vida” aunque no tengamos fechaInicio)
  const progresoTiempo = fin <= ahora ? 100 : Math.min(95, Math.max(5, Math.round((1 - restante / 3600) * 100)));

  const estadoBadge = activa ? "badge-success" : "badge-error";

  const totalOpciones = Number(cantidadOpciones);
  const indicesOpciones = useMemo(() => Array.from({ length: totalOpciones }, (_, i) => i), [totalOpciones]);

  // ✅ Guardamos votos por opción para:
  // - calcular total
  // - calcular porcentajes
  // - detectar líder
  const [votosPorOpcion, setVotosPorOpcion] = useState<Record<number, bigint>>({});

  const onVotos = useCallback((idOpcion: number, votos: bigint) => {
    setVotosPorOpcion(prev => {
      if (prev[idOpcion] === votos) return prev;
      return { ...prev, [idOpcion]: votos };
    });
  }, []);

  useEffect(() => {
    setVotosPorOpcion({});
  }, [totalOpciones, idVotacion]);

  const totalVotos = useMemo(() => sumarBigints(votosPorOpcion), [votosPorOpcion]);

  const lider = useMemo(() => {
    let mejorOpcion: number | null = null;
    let mejorVotos = -1n;

    for (const [k, v] of Object.entries(votosPorOpcion)) {
      const idx = Number(k);
      if (v > mejorVotos) {
        mejorVotos = v;
        mejorOpcion = idx;
      }
    }

    if (mejorOpcion === null || mejorVotos <= 0n) return null;
    return { idOpcion: mejorOpcion, votos: mejorVotos };
  }, [votosPorOpcion]);

  // ✅ Importante: el return va al final para no romper reglas de hooks
  if (debeOcultarse) return null;

  return (
    <div className="card bg-base-100 shadow border border-base-200">
      <div className="card-body">
        {/* Header compacto */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="card-title truncate">{titulo}</h3>
              <span className={`badge ${estadoBadge}`}>{activa ? "Activa" : "Cerrada"}</span>
              {yaVoto && <span className="badge badge-warning">Ya votaste</span>}
              {lider && (
                <span className="badge badge-primary">
                  Líder: Opción {lider.idOpcion + 1} · {lider.votos.toString()} voto(s)
                </span>
              )}
            </div>

            <div className="mt-1 text-sm opacity-70">
              <span className="font-semibold">ID:</span> {idVotacion} · <span className="font-semibold">Creador:</span>{" "}
              <span className="font-mono">{acortarDireccion(creador)}</span>
            </div>

            <div className="mt-2">
              <div className="text-xs opacity-70 flex items-center justify-between">
                <span>Tiempo</span>
                <span className="font-mono">{activa ? `Restante: ${formatearRestante(restante)}` : "Finalizada"}</span>
              </div>
              <progress className="progress w-full" value={activa ? progresoTiempo : 100} max={100} />
            </div>

            {/* Resultados mini resumen */}
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="badge badge-ghost">Votos totales: {totalVotos.toString()}</span>
              <button className="btn btn-sm btn-ghost" onClick={() => setExpandida(v => !v)} type="button">
                {expandida ? "Ocultar detalles" : "Ver detalles"}
              </button>
            </div>
          </div>

          <div className="text-right shrink-0">
            <div className="text-sm opacity-70">Opciones</div>
            <div className="text-lg font-semibold">{cantidadOpciones.toString()}</div>
            {!isConnected && <div className="mt-2 text-xs text-warning">Conecta tu wallet para votar.</div>}
          </div>
        </div>

        {/* Detalles (colapsable) */}
        {expandida && (
          <>
            <div className="divider my-3" />

            <div className="grid gap-2">
              {indicesOpciones.map(idx => (
                <FilaOpcion
                  key={`${idVotacion}-${idx}`}
                  idVotacion={idVotacion}
                  idOpcion={idx}
                  nombreOpcion={(opciones ?? [])[idx] ?? `Opción ${idx + 1}`}
                  activa={activa}
                  bloqueado={!!yaVoto || !isConnected}
                  esLider={lider?.idOpcion === idx}
                  onVotos={onVotos}
                  totalVotos={totalVotos}
                />
              ))}
            </div>

            {!isConnected && (
              <div className="alert alert-warning mt-4">
                <span>Conecta tu wallet para poder votar.</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function FilaOpcion({
  idVotacion,
  idOpcion,
  nombreOpcion,
  activa,
  bloqueado,
  esLider,
  onVotos,
  totalVotos,
}: {
  idVotacion: number;
  idOpcion: number;
  nombreOpcion: string;
  activa: boolean;
  bloqueado: boolean;
  esLider: boolean;
  onVotos: (idOpcion: number, votos: bigint) => void;
  totalVotos: bigint;
}) {
  const { data: votos } = useScaffoldReadContract({
    contractName: "VotacionUniversitaria",
    functionName: "obtenerVotos",
    args: [BigInt(idVotacion), BigInt(idOpcion)],
  });

  useEffect(() => {
    if (typeof votos !== "undefined") {
      onVotos(idOpcion, votos);
    }
  }, [votos, idOpcion, onVotos]);

  const { writeContractAsync, isPending } = useScaffoldWriteContract({
    contractName: "VotacionUniversitaria",
  });

  const deshabilitado = !activa || bloqueado || isPending;

  const votosN = useMemo(() => (typeof votos === "undefined" ? 0 : bigintANumeroSeguro(votos)), [votos]);
  const totalN = useMemo(() => bigintANumeroSeguro(totalVotos), [totalVotos]);
  const porcentaje = totalN > 0 ? Math.round((votosN / totalN) * 100) : 0;

  return (
    <div
      className={[
        "p-3 rounded-xl border transition",
        esLider ? "bg-base-100 border-primary shadow-sm" : "bg-base-200 border-base-300",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 w-full">
          <div className="font-semibold truncate flex items-center gap-2">
            <span className="badge badge-ghost">{idOpcion + 1}</span>
            <span className="truncate">{nombreOpcion}</span>
            {esLider && <span className="badge badge-primary badge-sm">Líder</span>}
          </div>

          {/* Resultados: % + barra + votos */}
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs opacity-70">
              <span>{totalN > 0 ? `${porcentaje}%` : "0%"}</span>
              <span className="font-mono">{votos?.toString() ?? "0"} voto(s)</span>
            </div>
            <progress className="progress w-full" value={porcentaje} max={100} />
          </div>
        </div>

        <button
          className={`btn btn-sm ${deshabilitado ? "btn-ghost" : "btn-primary"}`}
          disabled={deshabilitado}
          onClick={async () => {
            try {
              await writeContractAsync({
                functionName: "votar",
                args: [BigInt(idVotacion), BigInt(idOpcion)],
              });
              notification.success("¡Voto emitido con éxito!");
            } catch (e: any) {
              notification.error(e?.shortMessage ?? e?.message ?? "Error al votar");
            }
          }}
        >
          {isPending ? <span className="loading loading-spinner loading-xs" /> : "Votar"}
        </button>
      </div>

      {/* Mensajes UX */}
      {!activa && <div className="mt-2 text-xs opacity-70">Votación cerrada: ya no se aceptan votos.</div>}
      {bloqueado && activa && (
        <div className="mt-2 text-xs text-warning">No puedes votar (ya votaste o no estás conectado).</div>
      )}
    </div>
  );
}
