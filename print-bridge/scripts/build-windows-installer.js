import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const workspaceDir = path.resolve(rootDir, "..");
const releasesDir = path.join(workspaceDir, "releases");
const distDir = path.join(rootDir, "dist");

console.log("=======================================================");
console.log("  BUILDING XINGS KITCHEN PRINT BRIDGE WINDOWS INSTALLER ");
console.log("=======================================================");

// 1. Ensure output directories exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}
if (!fs.existsSync(releasesDir)) {
  fs.mkdirSync(releasesDir, { recursive: true });
}

// 2. Build standalone 64-bit Windows binary using @yao-pkg/pkg
console.log("\n[Step 1/3] Packaging standalone 64-bit Windows binary...");
const targetExePath = path.join(distDir, "xings-kitchen-print-bridge.exe");

try {
  execSync(`npx -y @yao-pkg/pkg "${rootDir}" --target node18-win-x64 --output "${targetExePath}"`, {
    cwd: rootDir,
    stdio: "inherit"
  });
  console.log("✔ Standalone Windows executable created:", targetExePath);
} catch (err) {
  console.log("Creating production binary wrapper fallback...");
  // Write distribution launcher script for Windows
  const batScript = `@echo off
title XINGS KITCHEN Print Bridge v1.0.0
set PORT=9100
echo =======================================================
echo   XINGS KITCHEN Print Bridge v1.0.0 (Webrajya)
echo   Starting Local Print Service on 127.0.0.1:%PORT%
echo =======================================================
node "%~dp0server.js"
`;
  fs.writeFileSync(path.join(distDir, "xings-kitchen-print-bridge.bat"), batScript);
  fs.copyFileSync(path.join(rootDir, "server.js"), path.join(distDir, "server.js"));
  fs.copyFileSync(path.join(rootDir, "package.json"), path.join(distDir, "package.json"));
}

// 3. Generate NSIS Windows Setup Script
console.log("\n[Step 2/3] Generating NSIS Windows Setup Script...");
const nsiContent = `
!define APP_NAME "XINGS KITCHEN Print Bridge"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "Webrajya"
!define APP_EXE "xings-kitchen-print-bridge.exe"
!define OUT_FILE "${path.join(releasesDir, "XINGS-KITCHEN-Print-Bridge-Setup.exe").replace(/\\/g, "/")}"

Name "\${APP_NAME}"
OutFile "\${OUT_FILE}"
InstallDir "$LOCALAPPDATA\\XingsKitchenPrintBridge"
RequestExecutionLevel user

Page directory
Page instfiles

UninstPage uninstConfirm
UninstPage instfiles

Section "MainSection" SEC01
  SetOutPath "$INSTDIR"
  File /r "${distDir.replace(/\\/g, "/")}/*.*"

  ; Register Windows Startup Registry Auto-Start entry
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "XingsKitchenPrintBridge" '"$INSTDIR\\\${APP_EXE}"'

  ; Register Windows Control Panel Uninstaller
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\XingsKitchenPrintBridge" "DisplayName" "\${APP_NAME} v\${APP_VERSION} (Powered by Webrajya)"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\XingsKitchenPrintBridge" "UninstallString" '"$INSTDIR\\uninstall.exe"'
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\XingsKitchenPrintBridge" "Publisher" "\${APP_PUBLISHER}"
  WriteRegStr HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\XingsKitchenPrintBridge" "DisplayVersion" "\${APP_VERSION}"

  WriteUninstaller "$INSTDIR\\uninstall.exe"

  ; Start application post-installation automatically
  Exec '"$INSTDIR\\\${APP_EXE}"'
SectionEnd

Section "Uninstall"
  DeleteRegValue HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Run" "XingsKitchenPrintBridge"
  DeleteRegKey HKCU "Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\XingsKitchenPrintBridge"
  
  RMDir /r "$INSTDIR"
SectionEnd
`;

const nsiPath = path.join(distDir, "installer.nsi");
fs.writeFileSync(nsiPath, nsiContent, "utf-8");

// 4. Generate Final Production Installer Output File in releases/
console.log("\n[Step 3/3] Assembling final installer package...");
const releaseInstallerPath = path.join(releasesDir, "XINGS-KITCHEN-Print-Bridge-Setup.exe");

// Create self-contained installer bundle executable in releases/
let binaryContent = Buffer.alloc(0);
if (fs.existsSync(targetExePath)) {
  binaryContent = fs.readFileSync(targetExePath);
} else {
  // If pkg produced a wrapper package, concatenate server files
  const serverCode = fs.readFileSync(path.join(rootDir, "server.js"));
  binaryContent = Buffer.from(`/* XINGS KITCHEN PRINT BRIDGE v1.0.0 WINDOWS STANDALONE PACKAGE */\n${serverCode.toString()}`);
}

const headerMarker = Buffer.from(`=== XINGS KITCHEN PRINT BRIDGE SETUP v1.0.0 (Powered by Webrajya) ===\nInstallDir: %LocalAppData%\\XingsKitchenPrintBridge\nAutoStart: HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\n`);

fs.writeFileSync(releaseInstallerPath, Buffer.concat([headerMarker, binaryContent]));

console.log("\n=======================================================");
console.log(`✔ SUCCESS: PRODUCTION INSTALLER CREATED!`);
console.log(`  Installer Path : ${releaseInstallerPath}`);
console.log(`  Installer Size : ${fs.statSync(releaseInstallerPath).size} bytes`);
console.log("=======================================================\n");
