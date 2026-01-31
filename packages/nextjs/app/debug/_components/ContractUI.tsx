"use client";

// @refresh reset
import { useEffect, useState } from "react";
import { Contract } from "@scaffold-ui/debug-contracts";
import { useDeployedContractInfo } from "~~/hooks/scaffold-eth";
import { useTargetNetwork } from "~~/hooks/scaffold-eth/useTargetNetwork";
import { ContractName } from "~~/utils/scaffold-eth/contract";

type ContractUIProps = {
  contractName: ContractName;
  className?: string;
};

/**
 * UI component to interface with deployed contracts.
 **/
export const ContractUI = ({ contractName }: ContractUIProps) => {
  const { targetNetwork } = useTargetNetwork();
  const { data: deployedContractData, isLoading: deployedContractLoading } = useDeployedContractInfo({ contractName });

  // ✅ Evita hydration mismatch en Next 15 (debug-contracts)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Spinner mientras carga o antes de montar (SSR->CSR)
  if (deployedContractLoading || !mounted) {
    return (
      <div className="mt-14 flex justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!deployedContractData) {
    return (
      <div className="mt-14">
        <p className="text-3xl">
          No contract found by the name of {contractName} on chain {targetNetwork.name}!
        </p>
      </div>
    );
  }

  return <Contract contractName={contractName as string} contract={deployedContractData} chainId={targetNetwork.id} />;
};
