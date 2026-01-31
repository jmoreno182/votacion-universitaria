"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Address } from "@scaffold-ui/components";
import type { NextPage } from "next";
import { hardhat } from "viem/chains";
import { useAccount } from "wagmi";
import {
  BugAntIcon,
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
} from "@heroicons/react/24/outline";
import { useTargetNetwork } from "~~/hooks/scaffold-eth";
import { useScaffoldReadContract } from "~~/hooks/scaffold-eth";

function acortarDireccion(dir?: string) {
  if (!dir) return "No conectado";
  return `${dir.slice(0, 6)}...${dir.slice(-4)}`;
}

const Home: NextPage = () => {
  const { address: connectedAddress, isConnected } = useAccount();
  const { targetNetwork } = useTargetNetwork();

  // Total de votaciones
  const { data: totalVotaciones } = useScaffoldReadContract({
    contractName: "VotacionUniversitaria",
    functionName: "contadorVotaciones",
  });

  // Owner del contrato
  const { data: owner } = useScaffoldReadContract({
    contractName: "VotacionUniversitaria",
    functionName: "owner",
  });

  const ownerStr = useMemo(() => {
    // Asegura string (evita reventar por tipos raros)
    if (!owner) return "";
    return String(owner);
  }, [owner]);

  const esOwner = useMemo(() => {
    if (!connectedAddress || !ownerStr) return false;
    return connectedAddress.toLowerCase() === ownerStr.toLowerCase();
  }, [connectedAddress, ownerStr]);

  const totalStr = useMemo(() => {
    // Evita overflow y mantiene UI consistente
    if (totalVotaciones === undefined || totalVotaciones === null) return "";
    try {
      return (totalVotaciones as bigint).toString();
    } catch {
      return String(totalVotaciones);
    }
  }, [totalVotaciones]);

  const redEtiqueta = useMemo(() => {
    if (targetNetwork?.id === hardhat.id) return "Hardhat local (31337)";
    if (targetNetwork?.name) return `${targetNetwork.name} (${targetNetwork.id})`;
    return "Red desconocida";
  }, [targetNetwork]);

  const isHardhat = targetNetwork?.id === hardhat.id;

  return (
    <div className="min-h-screen">
      {/* HERO */}
      <div className="relative overflow-hidden bg-base-200 border-b border-base-300">
        <div className="absolute inset-0 opacity-40 pointer-events-none">
          <div className="h-full w-full bg-[radial-gradient(circle_at_top,rgba(0,0,0,0.12),transparent_55%)]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-6 py-10 md:py-14">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="badge badge-outline">dApp educativa</span>
                <span className="badge badge-ghost">On-chain</span>
                <span className="badge badge-ghost">Scaffold-ETH 2</span>
              </div>

              <h1 className="mt-3 text-4xl md:text-5xl font-extrabold leading-tight">Votación Universitaria</h1>

              <p className="mt-3 text-base md:text-lg opacity-80">
                Bienvenido a la dApp de votación universitaria. Permite que los estudiantes voten de forma transparente:
                cada voto queda registrado en la blockchain.
              </p>

              {/* CTA principal adaptativo */}
              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/votacion"
                  className={`btn ${isConnected ? "btn-primary" : "btn-outline"}`}
                  aria-label="Ir al módulo de votación"
                >
                  {isConnected ? "Ir a votar / ver encuestas" : "Ver encuestas (conecta para votar)"}
                </Link>

                {/* Debug solo para owner */}
                {isConnected && esOwner ? (
                  <Link href="/debug" className="btn btn-ghost" aria-label="Abrir debug para administrador">
                    Debug (admin)
                  </Link>
                ) : (
                  <button className="btn btn-ghost btn-disabled" title="Disponible solo para el owner" aria-disabled>
                    Debug (admin)
                  </button>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className={`badge ${isConnected ? "badge-success" : "badge-warning"}`}>
                  {isConnected ? "Wallet conectada" : "Conecta tu wallet"}
                </span>
                <span className="badge badge-neutral">Red objetivo: {redEtiqueta}</span>
                <span className="badge badge-ghost">
                  Rol:{" "}
                  <span className={esOwner ? "font-semibold text-primary" : "opacity-80"}>
                    {isConnected ? (esOwner ? "Owner (admin)" : "Estudiante (votante)") : "—"}
                  </span>
                </span>
              </div>
            </div>

            {/* Panel Wallet */}
            <div className="w-full md:w-[420px]">
              <div className="card bg-base-100 border border-base-300 shadow">
                <div className="card-body">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="card-title text-base">Estado de tu wallet</h2>
                      <p className="text-sm opacity-70">Tu identidad en la dApp</p>
                    </div>
                    <div className={`badge ${isConnected ? "badge-success" : "badge-warning"}`}>
                      {isConnected ? "Conectada" : "Desconectada"}
                    </div>
                  </div>

                  <div className="divider my-3" />

                  <div className="space-y-3">
                    <div>
                      <div className="text-xs opacity-70">Dirección</div>
                      {connectedAddress ? (
                        <Address
                          address={connectedAddress}
                          chain={targetNetwork}
                          blockExplorerAddressLink={
                            isHardhat ? `/blockexplorer/address/${connectedAddress}` : undefined
                          }
                        />
                      ) : (
                        <div className="font-mono text-sm opacity-70">{acortarDireccion(undefined)}</div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-base-300 bg-base-200 p-3">
                        <div className="text-xs opacity-70">Owner del contrato</div>
                        <div className="font-mono text-sm mt-1">
                          {ownerStr ? acortarDireccion(ownerStr) : <span className="skeleton h-4 w-28 inline-block" />}
                        </div>
                      </div>
                      <div className="rounded-xl border border-base-300 bg-base-200 p-3">
                        <div className="text-xs opacity-70">Tu rol</div>
                        <div className="text-sm mt-1 font-semibold">
                          {isConnected ? (esOwner ? "Owner (admin)" : "Estudiante") : "—"}
                        </div>
                      </div>
                    </div>

                    {isHardhat ? (
                      <div className="text-xs opacity-70">
                        Tip: estás en Hardhat (31337). Usa el Block Explorer local para ver TX, bloques y eventos.
                      </div>
                    ) : (
                      <div className="text-xs opacity-70">
                        Tip: si estás en una testnet, revisa el explorador de bloques de esa red para ver tus TX.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DASHBOARD MINI */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <span className="text-sm opacity-70">Votaciones creadas</span>
                  <Squares2X2Icon className="h-5 w-5 opacity-70" />
                </div>
                <div className="text-3xl font-bold mt-1">
                  {totalStr ? totalStr : <span className="skeleton h-8 w-16 inline-block" />}
                </div>
                <div className="text-xs opacity-60 mt-1">Total en el contrato</div>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <span className="text-sm opacity-70">Transparencia</span>
                  <ChartBarIcon className="h-5 w-5 opacity-70" />
                </div>
                <div className="text-base font-semibold mt-1">Resultados on-chain</div>
                <div className="text-xs opacity-60 mt-1">Lecturas directas del contrato</div>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <span className="text-sm opacity-70">Seguridad</span>
                  <ShieldCheckIcon className="h-5 w-5 opacity-70" />
                </div>
                <div className="text-base font-semibold mt-1">Solo owner crea</div>
                <div className="text-xs opacity-60 mt-1">Acceso con Ownable</div>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <span className="text-sm opacity-70">Estado</span>
                  {isConnected ? (
                    <CheckCircleIcon className="h-5 w-5 opacity-70" />
                  ) : (
                    <ClockIcon className="h-5 w-5 opacity-70" />
                  )}
                </div>
                <div className="text-base font-semibold mt-1">
                  {isConnected ? "Listo para votar" : "Pendiente de wallet"}
                </div>
                <div className="text-xs opacity-60 mt-1">
                  {isConnected ? "Puedes interactuar con la dApp" : "Conecta MetaMask para comenzar"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN DE ACCESOS RÁPIDOS */}
      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold">Accesos rápidos</h2>
            <p className="opacity-70 mt-1">Herramientas útiles para la demo y la presentación</p>
          </div>
          <Link href="/votacion" className="btn btn-outline" aria-label="Abrir módulo de votación">
            Abrir módulo de votación
          </Link>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <BugAntIcon className="h-7 w-7" />
                <div>
                  <h3 className="font-semibold text-lg">Debug Contracts</h3>
                  <p className="text-sm opacity-70">Probar funciones del contrato (crear/votar/lecturas).</p>
                </div>
              </div>
              <div className="mt-4">
                {isConnected && esOwner ? (
                  <Link href="/debug" className="btn btn-primary w-full">
                    Abrir Debug
                  </Link>
                ) : (
                  <button
                    className="btn btn-primary w-full btn-disabled"
                    title="Solo el owner puede acceder"
                    aria-disabled
                  >
                    Abrir Debug
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 shadow-sm">
            <div className="card-body">
              <div className="flex items-center gap-3">
                <MagnifyingGlassIcon className="h-7 w-7" />
                <div>
                  <h3 className="font-semibold text-lg">Block Explorer {isHardhat ? "(local)" : ""}</h3>
                  <p className="text-sm opacity-70">
                    {isHardhat
                      ? "Ver transacciones y bloques en Hardhat."
                      : "Revisa transacciones en el explorador de tu red."}
                  </p>
                </div>
              </div>
              <div className="mt-4">
                {isHardhat ? (
                  <Link href="/blockexplorer" className="btn btn-outline w-full">
                    Abrir Block Explorer
                  </Link>
                ) : (
                  <button
                    className="btn btn-outline w-full btn-disabled"
                    title="Disponible cuando uses Hardhat local"
                    aria-disabled
                  >
                    Abrir Block Explorer
                  </button>
                )}
              </div>
              <div className="text-xs opacity-60 mt-3">
                Ideal para mostrar evidencia en tu presentación (TX hash, bloques, eventos).
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 text-center text-xs opacity-60">
          Proyecto académico · Votación Universitaria · Scaffold-ETH 2 · Solidity ^0.8.20
        </div>
      </div>
    </div>
  );
};

export default Home;
