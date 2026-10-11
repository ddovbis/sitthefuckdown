param(
  [ValidateSet('start', 'test', 'qr', 'size', 'verify')]
  [string] $Task = 'start',
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $TaskArgs = @()
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$nativeExitCode = 0
$oldTemp = $env:TEMP
$oldTmp = $env:TMP
$oldChromiumPath = $env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
$nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
$node = if ($nodeCommand) { $nodeCommand.Source } else {
  Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
}

if (-not (Test-Path -LiteralPath $node)) {
  throw 'Node.js 24 LTS (24.19.0 or newer in 24.x) is required. Follow the project setup in README.MD.'
}

$nodeVersionText = & $node --version
if ($LASTEXITCODE -ne 0) { throw 'Cannot read the Node.js version.' }
$nodeVersion = [version] $nodeVersionText.Trim().TrimStart('v')
if ($nodeVersion.Major -ne 24 -or $nodeVersion -lt [version] '24.19.0') {
  throw "Node.js 24 LTS (24.19.0 or newer in 24.x) is required; found $nodeVersion. Fix the Node.js PATH entry using README.MD."
}

Push-Location $repoRoot
try {
  switch ($Task) {
    'start' {
      & $node 'scripts/serve.mjs' @TaskArgs
      $nativeExitCode = $LASTEXITCODE
    }
    'test' {
      if (-not (Test-Path -LiteralPath 'node_modules\playwright\cli.js')) {
        throw 'Install project dependencies first with npm ci.'
      }
      & $node --test 'scripts/verify-live.test.mjs'
      if ($LASTEXITCODE -ne 0) { throw "Live checker tests failed with exit code $LASTEXITCODE." }
      $testTemp = Join-Path $repoRoot '.playwright-tmp'
      New-Item -ItemType Directory -Force -Path $testTemp | Out-Null
      $env:TEMP = $testTemp
      $env:TMP = $testTemp

      if (-not $env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
        $chromeCandidates = @(
          (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
          (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe')
        ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
        if ($chromeCandidates) { $env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = $chromeCandidates[0] }
      }

      # QR pixel decoding can exceed Playwright's 30-second default in the Windows sandbox.
      & $node 'node_modules\playwright\cli.js' test --timeout=120000 @TaskArgs
      $nativeExitCode = $LASTEXITCODE
    }
    'qr' {
      if (-not (Test-Path -LiteralPath 'node_modules\qrcode\package.json')) {
        throw 'Install project dependencies first with npm ci.'
      }
      & $node 'scripts\generate-qr.mjs' @TaskArgs
      $nativeExitCode = $LASTEXITCODE
    }
    'size' {
      & $node 'scripts\size.mjs' @TaskArgs
      $nativeExitCode = $LASTEXITCODE
    }
    'verify' {
      & $node 'scripts\verify-live.mjs' @TaskArgs
      $nativeExitCode = $LASTEXITCODE
    }
  }
}
finally {
  if ($null -eq $oldTemp) { Remove-Item Env:TEMP -ErrorAction SilentlyContinue } else { $env:TEMP = $oldTemp }
  if ($null -eq $oldTmp) { Remove-Item Env:TMP -ErrorAction SilentlyContinue } else { $env:TMP = $oldTmp }
  if ($null -eq $oldChromiumPath) { Remove-Item Env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH -ErrorAction SilentlyContinue } else { $env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = $oldChromiumPath }
  Pop-Location
}

$global:LASTEXITCODE = $nativeExitCode
if ($nativeExitCode -ne 0) { throw "$Task failed with exit code $nativeExitCode." }
