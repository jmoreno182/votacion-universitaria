// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title VotacionUniversitaria
 * @notice dApp: Votación Universitaria (educativa)
 * @dev
 * - SOLO el owner (deployer) puede crear votaciones
 * - Cualquier usuario puede votar UNA sola vez por votación
 * - Opciones dinámicas (strings)
 * - Cierre automático por tiempo (no requiere finalizar on-chain)
 * - Eventos para histórico (timeline off-chain)
 * - Incluye bloqueDespliegue (immutable) para reconstruir logs desde el bloque real de despliegue
 *
 * Requisitos de interfaz (UI):
 * - contadorVotaciones()
 * - owner()
 * - obtenerVotacion(id)
 * - obtenerOpciones(id)
 * - obtenerVotos(id, opcion)
 * - yaVoto(id, address)
 *
 * Eventos (deben coincidir EXACTAMENTE):
 * - VotacionCreada(idVotacion, creador, titulo, fechaFin, cantidadOpciones)
 * - VotoEmitido(idVotacion, votante, idOpcion)
 */
contract VotacionUniversitaria is Ownable {
    // -----------------------------
    // Errores (claros y cortos)
    // -----------------------------
    error VotacionNoExiste();
    error VotacionCerrada();
    error OpcionInvalida();
    error YaVotaste();
    error ParametrosInvalidos();

    // -----------------------------
    // Eventos (EXACTOS)
    // -----------------------------
    event VotacionCreada(
        uint256 indexed idVotacion,
        address indexed creador,
        string titulo,
        uint256 fechaFin,
        uint256 cantidadOpciones
    );

    event VotoEmitido(
        uint256 indexed idVotacion,
        address indexed votante,
        uint256 idOpcion
    );

    // -----------------------------
    // Estructuras / Storage
    // -----------------------------
    struct Votacion {
        address creador;
        uint40 fechaFin;          // timestamps por décadas
        uint16 cantidadOpciones;  // suficiente para demo universitaria
        bool existe;
        string titulo;            // slot independiente
    }

    uint256 public contadorVotaciones; // getter auto: contadorVotaciones()

    // idVotacion => Votacion
    mapping(uint256 => Votacion) private votaciones;

    // idVotacion => opciones (strings)
    mapping(uint256 => string[]) private opcionesPorVotacion;

    // idVotacion => idOpcion => votos
    mapping(uint256 => mapping(uint256 => uint256)) private votosPorOpcion;

    // idVotacion => votante => ya votó
    mapping(uint256 => mapping(address => bool)) private yaVotoPorVotacion;

    // Bloque real de despliegue (para reconstrucción de eventos)
    uint64 public immutable bloqueDespliegue;

    constructor(address ownerInicial) Ownable(ownerInicial) {
        bloqueDespliegue = uint64(block.number);
    }

    // -----------------------------
    // Escritura (solo owner crea)
    // -----------------------------
    function crearVotacion(
        string calldata titulo,
        string[] calldata opciones,
        uint256 duracionSegundos
    ) external onlyOwner {
        uint256 cantidad = opciones.length;

        // Validaciones mínimas (cortas) para no inflar bytecode
        if (bytes(titulo).length == 0 || cantidad < 2 || duracionSegundos == 0) revert ParametrosInvalidos();
        if (cantidad > type(uint16).max) revert ParametrosInvalidos();

        uint256 id = contadorVotaciones;
        contadorVotaciones = id + 1;

        uint256 fechaFin_ = block.timestamp + duracionSegundos;

        Votacion storage v = votaciones[id];
        v.creador = msg.sender;
        v.fechaFin = uint40(fechaFin_);
        v.cantidadOpciones = uint16(cantidad);
        v.existe = true;
        v.titulo = titulo;

        // Guardamos opciones una sola vez (loop solo en creación).
        string[] storage arr = opcionesPorVotacion[id];
        for (uint256 i = 0; i < cantidad; i++) {
            arr.push(opciones[i]);
        }

        emit VotacionCreada(id, msg.sender, titulo, fechaFin_, cantidad);
    }

    function votar(uint256 idVotacion, uint256 idOpcion) external {
        Votacion storage v = votaciones[idVotacion];
        if (!v.existe) revert VotacionNoExiste();

        if (block.timestamp >= uint256(v.fechaFin)) revert VotacionCerrada();
        if (idOpcion >= uint256(v.cantidadOpciones)) revert OpcionInvalida();
        if (yaVotoPorVotacion[idVotacion][msg.sender]) revert YaVotaste();

        yaVotoPorVotacion[idVotacion][msg.sender] = true;
        unchecked {
            votosPorOpcion[idVotacion][idOpcion] += 1;
        }

        emit VotoEmitido(idVotacion, msg.sender, idOpcion);
    }

    // -----------------------------
    // Lecturas para UI (claras)
    // -----------------------------
    function obtenerVotacion(uint256 idVotacion)
        external
        view
        returns (
            string memory titulo,
            address creador,
            uint256 fechaFin,
            uint256 cantidadOpciones,
            bool activa
        )
    {
        Votacion storage v = votaciones[idVotacion];
        if (!v.existe) revert VotacionNoExiste();

        titulo = v.titulo;
        creador = v.creador;
        fechaFin = uint256(v.fechaFin);
        cantidadOpciones = uint256(v.cantidadOpciones);
        activa = (block.timestamp < uint256(v.fechaFin));
    }

    function obtenerOpciones(uint256 idVotacion) external view returns (string[] memory) {
        Votacion storage v = votaciones[idVotacion];
        if (!v.existe) revert VotacionNoExiste();
        return opcionesPorVotacion[idVotacion];
    }

    function obtenerVotos(uint256 idVotacion, uint256 opcion) external view returns (uint256) {
        Votacion storage v = votaciones[idVotacion];
        if (!v.existe) revert VotacionNoExiste();
        if (opcion >= uint256(v.cantidadOpciones)) revert OpcionInvalida();
        return votosPorOpcion[idVotacion][opcion];
    }

    function yaVoto(uint256 idVotacion, address cuenta) external view returns (bool) {
        Votacion storage v = votaciones[idVotacion];
        if (!v.existe) revert VotacionNoExiste();
        return yaVotoPorVotacion[idVotacion][cuenta];
    }
}
