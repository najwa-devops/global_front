# Docker Installation (Windows PC)

## 1. Enable required Windows features (run PowerShell as Administrator)

```powershell
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
```

Restart your PC after these commands.

## 2. Install WSL2 and Ubuntu

```powershell
wsl --install -d Ubuntu
```

Restart your PC if requested.

## 3. Install Docker Desktop using Winget

```powershell
winget install -e --id Docker.DockerDesktop
```

## 4. Start Docker Desktop

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

Wait until Docker Desktop shows `Engine running`.

## 5. Verify Docker installation

```powershell
docker version
docker info
docker run hello-world
```

## 6. Fix if Docker Engine is stopped

```powershell
wsl --shutdown
Restart-Service LxssManager
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
```

## 7. Run this frontend project with Docker

```powershell
cd "d:\pt\InvoivesFrontend - Copie\frontend 24-02-2026\frontend 24-02-2026"
docker compose --progress=plain build
docker compose up -d
docker compose ps
```

Open: `http://localhost:3000`
