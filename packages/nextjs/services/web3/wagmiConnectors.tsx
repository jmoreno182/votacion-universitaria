import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  ledgerWallet,
  metaMaskWallet,
  rainbowWallet,
  safeWallet,
  walletConnectWallet, // 🚫 baseAccount REMOVIDO: causa "telemetry script" + Runtime Error undefined
} from "@rainbow-me/rainbowkit/wallets";
import { rainbowkitBurnerWallet } from "burner-connector";
import * as chains from "viem/chains";
import scaffoldConfig from "~~/scaffold.config";

const { onlyLocalBurnerWallet, targetNetworks } = scaffoldConfig;

/**
 * ✅ Burner Wallet:
 * - Se muestra SOLO si:
 *   a) estás 100% en hardhat (no hay redes externas), o
 *   b) onlyLocalBurnerWallet es false (como ya lo tienes ahora)
 */
const shouldIncludeBurner =
  !targetNetworks.some(network => network.id !== (chains.hardhat as chains.Chain).id) || !onlyLocalBurnerWallet;

/**
 * ✅ Lista de wallets (sin Base Smart Account para evitar errores de telemetría)
 */
const wallets = [
  metaMaskWallet,
  walletConnectWallet,
  ledgerWallet,
  rainbowWallet,
  safeWallet,
  ...(shouldIncludeBurner ? [rainbowkitBurnerWallet] : []),
];

/**
 * wagmi connectors for the wagmi context
 */
export const wagmiConnectors = () => {
  // Only create connectors on client-side to avoid SSR issues
  // TODO: update when https://github.com/rainbow-me/rainbowkit/issues/2476 is resolved
  if (typeof window === "undefined") {
    return [];
  }

  return connectorsForWallets(
    [
      {
        groupName: "Wallets compatibles",
        wallets,
      },
    ],
    {
      // ✅ Nombre más coherente para tu dApp (no afecta nada, solo UX)
      appName: "Votación Universitaria",
      projectId: scaffoldConfig.walletConnectProjectId,
    },
  );
};
