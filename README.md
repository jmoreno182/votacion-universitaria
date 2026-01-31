# 🏗 Scaffold-ETH 2

# 🗳️ Votación Universitaria – dApp en Blockchain

dApp educativa desarrollada como proyecto académico para permitir la creación y participación en votaciones universitarias de forma **transparente**, **segura** y **on-chain**, utilizando tecnología blockchain.

Cada voto queda registrado en la red Ethereum (Sepolia), garantizando integridad y verificabilidad de los resultados.

---

## 🚀 Demo en Producción (Vercel)

🔗 https://votacion-universitaria-nextjs.vercel.app/

> Conecta MetaMask y selecciona la red **Sepolia** para interactuar con la dApp.

---

## 📂 Repositorio GitHub

🔗 https://github.com/jmoreno182/votacion-universitaria

---

## 🔐 Contrato Inteligente

- **Nombre:** VotacionUniversitaria  
- **Red:** Ethereum Sepolia (testnet)  
- **Framework:** Hardhat  
- **Lenguaje:** Solidity ^0.8.x  

📌 **Contract Address (Sepolia):**  
`0xB79Ce2e12B8C7Ab70A3F79618710CcdAE77c107f`

> El contrato permite la creación de votaciones y el registro de votos de manera transparente.  
> Solo el **owner** puede crear votaciones.

---

## 🧱 Tecnologías Utilizadas

### Backend / Blockchain
- Solidity
- Hardhat
- Ethereum (Sepolia Testnet)

### Frontend
- Next.js
- React
- TypeScript
- Scaffold-ETH 2
- Wagmi + Viem
- TailwindCSS / DaisyUI

### Infraestructura
- Alchemy (RPC Provider)
- Vercel (Deploy Frontend)
- GitHub (Control de versiones)

---

## 🖥️ Ejecución Local

### 1️⃣ Clonar el repositorio
```bash
git clone https://github.com/jmoreno182/votacion-universitaria.git
cd votacion-universitaria
```
### 2️⃣ Instalar dependencias
```bash
yarn install

```
### 3️⃣ Configurar variables de entorno (Frontend)
Crear el archivo:
```bash
git clone https://github.com/jmoreno182/votacion-universitaria.git
cd votacion-universitaria
```
Con el contenido:
```env
NEXT_PUBLIC_ALCHEMY_API_KEY=TU_API_KEY_DE_ALCHEMY
```
### 4️⃣ Iniciar el frontend
```bash
yarn start
```
La aplicación estará disponible en:
```arduino
http://localhost:3000
```
## 🧪 Red de Pruebas

Esta aplicación utiliza Sepolia Testnet.
Es necesario contar con ETH de prueba y MetaMask configurado en dicha red.

## 🎓 Contexto Académico

Proyecto desarrollado con fines educativos para la asignatura de Desarrollo de Aplicaciones Descentralizadas (dApps), como parte del programa de Postgrado / Maestría.

## ✍️ Autor

José Gregorio Moreno Marcano
GitHub: https://github.com/jmoreno182
