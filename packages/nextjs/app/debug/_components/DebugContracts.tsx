"use client";

import { useEffect, useMemo } from "react";
import { ContractUI } from "./ContractUI";
import "@scaffold-ui/debug-contracts/styles.css";
import { useSessionStorage } from "usehooks-ts";
import { BarsArrowUpIcon } from "@heroicons/react/20/solid";
import { ContractName, GenericContract } from "~~/utils/scaffold-eth/contract";
import { useAllContracts } from "~~/utils/scaffold-eth/contractsData";

const selectedContractStorageKey = "scaffoldEth2.selectedContract";

export function DebugContracts() {
  const contractsData = useAllContracts();

  const contractNames = useMemo(
    () =>
      Object.keys(contractsData).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }),
      ) as ContractName[],
    [contractsData],
  );

  const [selectedContract, setSelectedContract] = useSessionStorage<ContractName>(
    selectedContractStorageKey,
    contractNames[0],
    { initializeWithValue: false },
  );

  useEffect(() => {
    if (contractNames.length > 0 && !contractNames.includes(selectedContract)) {
      setSelectedContract(contractNames[0]);
    }
  }, [contractNames, selectedContract, setSelectedContract]);

  if (contractNames.length === 0) {
    return (
      <div className="flex justify-center items-center py-20">
        <p className="text-3xl opacity-70">No contracts found!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-y-6 lg:gap-y-8 py-8 lg:py-12 justify-center items-center">
      {/* Selector de contratos */}
      {contractNames.length > 1 && (
        <div className="flex flex-row gap-2 w-full max-w-7xl pb-1 px-6 lg:px-10 flex-wrap">
          {contractNames.map(contractName => (
            <button
              key={contractName}
              onClick={() => setSelectedContract(contractName)}
              className={`btn btn-secondary btn-sm font-light hover:border-transparent ${
                contractName === selectedContract
                  ? "bg-base-300 hover:bg-base-300 no-animation"
                  : "bg-base-100 hover:bg-secondary"
              }`}
            >
              {contractName}
              {(contractsData[contractName] as GenericContract)?.external && (
                <span className="tooltip tooltip-top tooltip-accent ml-1" data-tip="External contract">
                  <BarsArrowUpIcon className="h-4 w-4 cursor-pointer" />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* UI del contrato seleccionado */}
      <div className="w-full max-w-7xl px-6 lg:px-10">
        <ContractUI contractName={selectedContract} />
      </div>
    </div>
  );
}
