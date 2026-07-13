param(
  [string]$ApiKey = $env:HERMES_API_KEY,
  [int]$BasePort = 8650
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  $ApiKey = "judge-jury-local-dev-key"
}

$profiles = @(
  @{ Name = "crown"; Port = $BasePort + 0; Description = "Fair prosecution advocate for Judge and Jury. Tests proof in the public interest without arguing to win at all costs." },
  @{ Name = "defence"; Port = $BasePort + 1; Description = "Defence advocate for Judge and Jury. Protects the accused position, challenges proof, and raises reasonable doubt." },
  @{ Name = "judge"; Port = $BasePort + 2; Description = "Neutral judge for Judge and Jury. Controls procedure, rules on evidence, charges the jury, and writes final synthesis." },
  @{ Name = "clerk"; Port = $BasePort + 3; Description = "Court clerk for Judge and Jury. Maintains transcript labels, stage metadata, and procedural record without legal argument." },
  @{ Name = "evidence_clerk"; Port = $BasePort + 4; Description = "Evidence clerk for Judge and Jury. Marks exhibits, summarizes disclosure, and guards citation hygiene." },
  @{ Name = "witness"; Port = $BasePort + 5; Description = "Witness agent for Judge and Jury. Answers only from witness statements and admitted exhibits." },
  @{ Name = "jury_orchestrator"; Port = $BasePort + 6; Description = "Jury coordinator for Judge and Jury. Coordinates private juror votes and deliberation from the admitted record only." }
)

function Get-ProfileHome {
  param([string]$Name)
  $output = & hermes -p $Name config env-path
  return Split-Path -Parent $output.Trim()
}

function Set-EnvValue {
  param(
    [string]$Path,
    [string]$Name,
    [string]$Value
  )

  $line = "$Name=$Value"
  if (-not (Test-Path $Path)) {
    Set-Content -Path $Path -Value $line -Encoding utf8
    return
  }

  $content = Get-Content -Path $Path
  $updated = $false
  $escaped = [regex]::Escape($Name)
  $content = $content | ForEach-Object {
    if ($_ -match "^$escaped=") {
      $updated = $true
      $line
    } else {
      $_
    }
  }

  if (-not $updated) {
    $content = @($content) + $line
  }

  Set-Content -Path $Path -Value $content -Encoding utf8
}

$profileList = & hermes profile list

foreach ($profile in $profiles) {
  $name = $profile.Name
  $description = $profile.Description
  $exists = $profileList -match "(^|\s)$name(\s|$)"

  if (-not $exists) {
    & hermes profile create $name --clone --description $description | Out-Host
  } else {
    & hermes profile describe $name --text $description | Out-Host
  }

  $profileHome = Get-ProfileHome -Name $name
  $envPath = Join-Path $profileHome ".env"
  Set-EnvValue -Path $envPath -Name "API_SERVER_ENABLED" -Value "true"
  Set-EnvValue -Path $envPath -Name "API_SERVER_HOST" -Value "127.0.0.1"
  Set-EnvValue -Path $envPath -Name "API_SERVER_PORT" -Value ([string]$profile.Port)
  Set-EnvValue -Path $envPath -Name "API_SERVER_KEY" -Value $ApiKey
  Set-EnvValue -Path $envPath -Name "API_SERVER_MODEL_NAME" -Value $name
}

Write-Host "Hermes courtroom profiles are configured on ports $BasePort-$($BasePort + $profiles.Count - 1)."
