# Run this from PowerShell on your Windows machine.
# Finishes the three installs Claude could not complete from its sandbox.
#
# Usage:
#   1. Open PowerShell
#   2. cd C:\Users\dhiaz\Downloads\BViral-Control-Center-master\BViral-Control-Center-master
#   3. .\install-extras.ps1

$ErrorActionPreference = "Stop"

Write-Host "==> Step 1/3: Fetching motion (registered in artifacts/bviral-dashboard/package.json)" -ForegroundColor Cyan
pnpm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "pnpm install failed. If pnpm is missing, run: npm install -g pnpm" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "==> Step 2/3: Installing ui-ux-pro-max skill globally for Claude Code" -ForegroundColor Cyan
Write-Host "    (project-local copy is already in .claude/skills/ui-ux-pro-max/)" -ForegroundColor DarkGray
npm install -g uipro-cli
uipro init --ai claude --global

Write-Host ""
Write-Host "==> Step 3/3: Adding the 21st-dev Magic MCP to Claude Code" -ForegroundColor Cyan
Write-Host "    SECURITY: rotate the API key you pasted in chat at https://21st.dev/ before running." -ForegroundColor Yellow
$apiKey = Read-Host "Paste your 21st-dev Magic API key"
if ([string]::IsNullOrWhiteSpace($apiKey)) {
    Write-Host "No key given, skipping MCP add." -ForegroundColor Yellow
    Write-Host "Run manually later:" -ForegroundColor Yellow
    Write-Host '  claude mcp add magic --scope user --env API_KEY="YOUR_KEY" -- npx -y "@21st-dev/magic@latest"' -ForegroundColor DarkGray
} else {
    claude mcp add magic --scope user --env "API_KEY=$apiKey" -- npx -y "@21st-dev/magic@latest"
}

Write-Host ""
Write-Host "All done. Verify with:" -ForegroundColor Green
Write-Host "  claude mcp list           # Magic should appear" -ForegroundColor DarkGray
Write-Host "  uipro versions            # Confirm ui-ux-pro-max installed" -ForegroundColor DarkGray
Write-Host "  pnpm list motion          # Confirm motion is installed" -ForegroundColor DarkGray
