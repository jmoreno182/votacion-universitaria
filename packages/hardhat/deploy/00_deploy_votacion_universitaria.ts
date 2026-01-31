import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deployVotacionUniversitaria: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  await deploy("VotacionUniversitaria", {
    from: deployer,
    args: [deployer], // ownerInicial
    log: true,
  });
};

export default deployVotacionUniversitaria;
deployVotacionUniversitaria.tags = ["VotacionUniversitaria"];
