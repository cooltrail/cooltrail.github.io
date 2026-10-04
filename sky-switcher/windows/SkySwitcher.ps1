# Sky Switcher for Windows. Double-click Sky Switcher.bat.
param(
    [string]$SkyDir,
    [switch]$Restore,
    [switch]$QuitRoblox,
    [switch]$SelfTest
)

$ErrorActionPreference = "Stop"

$script:SkyIds = @(
    "a564ec8aeef3614e788d02f0090089d8",
    "7328622d2d509b95dd4dd2c721d1ca8b",
    "a50f6563c50ca4d5dcb255ee5cfab097",
    "6c94b9385e52d221f0538aadaceead2d",
    "9244e00ff9fd6cee0bb40a262bb35d31",
    "78cb2e93aee0cdbd79b15a866bc93a54"
)
$script:Faces = @("bk", "dn", "ft", "lf", "rt", "up")
$script:FaceTitles = @(
    @{ Code = "up"; Title = "Up" },
    @{ Code = "dn"; Title = "Down" },
    @{ Code = "lf"; Title = "Left" },
    @{ Code = "rt"; Title = "Right" },
    @{ Code = "ft"; Title = "Front" },
    @{ Code = "bk"; Title = "Back" }
)
$script:OldDate = "Fri, 13 Dec 2024 23:03:48 GMT"
$script:TemplateB64 = (
    "UkJYSAIAAAA2AAAAaHR0cHM6Ly9jMC5yYnhjZG4uY29tLzRkYTJmZmMyZTZkNzBiMGJhMTk1NmYxNGMzZDZmNTNm" +
    "AMgAAAADAwAAr3LVTeUAAABaZumlAwAAAHgtYW16LWlkLTI6IDNzVnkyTjloTkFMV2FjNG1Bc0xpUTc1UnM2WjZG" +
    "MFBRMnN2WWl4djdRamFBWEcwdkZBTGtva0M4N2NvZktYZFcyMzlhKy9tRXVyRT0NCngtYW16LXJlcXVlc3QtaWQ6" +
    "IDU4SkgxR0VNSkNCNVRNNUINCngtYW16LXJlcGxpY2F0aW9uLXN0YXR1czogQ09NUExFVEVEDQpMYXN0LU1vZGlm" +
    "aWVkOiBUaHUsIDI1IEp1bCAyMDI0IDIxOjU3OjUyIEdNVA0KRVRhZzogIjRkYTJmZmMyZTZkNzBiMGJhMTk1NmYx" +
    "NGMzZDZmNTNmIg0KeC1hbXotc2VydmVyLXNpZGUtZW5jcnlwdGlvbjogQUVTMjU2DQpDb250ZW50LUVuY29kaW5n" +
    "OiBnemlwDQp4LWFtei12ZXJzaW9uLWlkOiB0U2VseEVzbTd2VklaamxsOTk1Ty5Db2NMUDZDS3ppQg0KQWNjZXB0" +
    "LVJhbmdlczogYnl0ZXMNCkNvbnRlbnQtVHlwZTogYXBwbGljYXRpb24vb2N0ZXQtc3RyZWFtDQpTZXJ2ZXI6IEFt" +
    "YXpvblMzDQpDb250ZW50LUxlbmd0aDogMTQwDQpDYWNoZS1Db250cm9sOiBwdWJsaWMsIG1heC1hZ2U9MjY1MTQ3" +
    "OTINCkRhdGU6IEZyaSwgMTMgRGVjIDIwMjQgMjM6MDM6NDggR01UDQpDb25uZWN0aW9uOiBrZWVwLWFsaXZlDQpW" +
    "YXJ5OiBBY2NlcHQtRW5jb2RpbmcNClJieC1DZG4tUHJvdmlkZXI6IGFrDQpBY2Nlc3MtQ29udHJvbC1FeHBvc2Ut" +
    "SGVhZGVyczogUmJ4LUNkbi1Qcm92aWRlcixBa2FtYWktUmVxdWVzdC1CQw0KQWNjZXNzLUNvbnRyb2wtQWxsb3ct" +
    "TWV0aG9kczogR0VUDQpBY2Nlc3MtQ29udHJvbC1BbGxvdy1PcmlnaW46ICoNClRpbWluZy1BbGxvdy1PcmlnaW46" +
    "ICoNCnZlcnNpb24gNC4wMQoYAAQABAAAAAIAAAACAAAAAAAAAAAAAQAyR8O+Pk2MwRRHwz70BDW/UHgnM/IENb8A" +
    "AIA/AAAAAH8Af/7/////Q0fDvjxNjEFlR8M+9AQ1v1B4JzPyBDW/AAAAAAAAAAB/AH/+/////zJHwz48TYxBFEfD" +
    "vvQENb9QeCcz8gQ1vwAAAAAAAIA/fwB//v////9DR8M+Pk2MwWVHw770BDW/UHgnM/IENb8AAIA/AACAP38Af/7/" +
    "////AAAAAAEAAAACAAAAAAAAAAIAAAADAAAAAAAAAAIAAAA="
)
$script:Library = Join-Path $env:LOCALAPPDATA "SkySwitcher\skies"
$script:Original = Join-Path $env:LOCALAPPDATA "SkySwitcher\original-sky"
$script:Database = Join-Path $env:LOCALAPPDATA "Roblox\rbx-storage.db"
$script:slots = @{}
$script:skies = @()
$script:chosen = $null
$script:loading = $false

function Unblock-Bundle {
    Get-ChildItem -LiteralPath $PSScriptRoot -File -ErrorAction SilentlyContinue |
        Unblock-File -ErrorAction SilentlyContinue
}

function Find-Bytes([byte[]]$Data, [byte[]]$Needle) {
    $last = $Data.Length - $Needle.Length
    for ($i = 0; $i -le $last; $i++) {
        $match = $true
        for ($j = 0; $j -lt $Needle.Length; $j++) {
            if ($Data[$i + $j] -ne $Needle[$j]) {
                $match = $false
                break
            }
        }
        if ($match) { return $i }
    }
    return -1
}

function Get-FreshPayload {
    $data = [Convert]::FromBase64String($script:TemplateB64)
    if ($data.Length -lt 4 -or $data[0] -ne 82 -or $data[1] -ne 66 -or $data[2] -ne 88 -or $data[3] -ne 72) {
        throw "Sky cache template is invalid."
    }
    $old = [Text.Encoding]::ASCII.GetBytes($script:OldDate)
    $stampText = [DateTime]::UtcNow.ToString("ddd, dd MMM yyyy HH:mm:ss 'GMT'", [Globalization.CultureInfo]::InvariantCulture)
    $stamp = [Text.Encoding]::ASCII.GetBytes($stampText)
    if ($stamp.Length -ne $old.Length) {
        throw "Replacement date has the wrong length."
    }
    $marker = [Text.Encoding]::ASCII.GetBytes("Date: ")
    $at = Find-Bytes $data $marker
    if ($at -lt 0) { throw "Cache template has no Date header." }
    $start = $at + $marker.Length
    for ($i = 0; $i -lt $old.Length; $i++) {
        if ($data[$start + $i] -ne $old[$i]) { throw "Unexpected Date header." }
        $data[$start + $i] = $stamp[$i]
    }
    return $data
}

function Test-RobloxRunning {
    $found = Get-Process -Name "RobloxPlayerBeta", "RobloxPlayer", "RobloxCrashHandler" -ErrorAction SilentlyContinue
    return [bool]$found
}

function Stop-Roblox {
    Get-Process -Name "RobloxPlayerBeta", "RobloxPlayer", "RobloxCrashHandler", "RobloxPlayerLauncher" -ErrorAction SilentlyContinue |
        Stop-Process -Force -ErrorAction SilentlyContinue
    for ($i = 0; $i -lt 20; $i++) {
        if (-not (Test-RobloxRunning)) { return }
        Start-Sleep -Milliseconds 250
    }
    if (Test-RobloxRunning) { throw "Roblox is still running. Quit it, then try again." }
}

function Get-LaunchHint {
    if (Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA "Bloxstrap")) { return "Open the game from Bloxstrap." }
    if (Test-Path -LiteralPath (Join-Path $env:LOCALAPPDATA "Fishstrap")) { return "Open the game from Fishstrap." }
    return "Open Roblox."
}

function Get-RobloxVersionDirs {
    $roots = @(
        (Join-Path $env:LOCALAPPDATA "Roblox\Versions"),
        (Join-Path ${env:ProgramFiles(x86)} "Roblox\Versions"),
        (Join-Path $env:ProgramFiles "Roblox\Versions")
    )
    $found = @()
    foreach ($root in $roots) {
        if (-not $root -or -not (Test-Path -LiteralPath $root)) { continue }
        foreach ($dir in @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue)) {
            $exe = Join-Path $dir.FullName "RobloxPlayerBeta.exe"
            if (Test-Path -LiteralPath $exe) { $found += $dir.FullName }
        }
    }
    Write-Output -NoEnumerate $found
}

function Get-ExistingSkyDirs {
    $dirs = @()
    foreach ($version in @(Get-RobloxVersionDirs)) {
        foreach ($rel in @("PlatformContent\pc\textures\sky", "content\textures\sky")) {
            $path = Join-Path $version $rel
            if (Test-Path -LiteralPath $path) { $dirs += $path }
        }
    }
    foreach ($modRoot in @(Get-ModRoots)) {
        foreach ($rel in @("PlatformContent\pc\textures\sky", "content\textures\sky")) {
            $path = Join-Path $modRoot $rel
            if (Test-Path -LiteralPath $path) { $dirs += $path }
        }
    }
    Write-Output -NoEnumerate $dirs
}

function Get-SkyDirs([string]$VersionDir) {
    $found = @()
    foreach ($rel in @("PlatformContent\pc\textures\sky", "content\textures\sky")) {
        $path = Join-Path $VersionDir $rel
        if (Test-Path -LiteralPath $path) { $found += $path }
    }
    if ($found.Count -eq 0) {
        $path = Join-Path $VersionDir "PlatformContent\pc\textures\sky"
        New-Item -ItemType Directory -Force -Path $path | Out-Null
        $found += $path
    }
    Write-Output -NoEnumerate $found
}

function Get-ModRoots {
    $roots = @()
    foreach ($name in @("Bloxstrap", "Fishstrap")) {
        $parent = Join-Path $env:LOCALAPPDATA $name
        if (Test-Path -LiteralPath $parent) {
            $roots += (Join-Path $parent "Modifications")
        }
    }
    Write-Output -NoEnumerate $roots
}

function Get-SkyDestinations {
    $dirs = @()
    foreach ($version in @(Get-RobloxVersionDirs)) {
        foreach ($sky in @(Get-SkyDirs $version)) { $dirs += $sky }
    }
    foreach ($modRoot in @(Get-ModRoots)) {
        foreach ($rel in @("PlatformContent\pc\textures\sky", "content\textures\sky")) {
            $path = Join-Path $modRoot $rel
            if (-not (Test-Path -LiteralPath $path)) {
                New-Item -ItemType Directory -Force -Path $path | Out-Null
            }
            $dirs += $path
        }
    }
    Write-Output -NoEnumerate $dirs
}

function Backup-OriginalSky($DestDirs) {
    $marker = Join-Path $script:Original "sky512_up.tex"
    if (Test-Path -LiteralPath $marker) { return }
    foreach ($dir in @($DestDirs)) {
        $up = Join-Path $dir "sky512_up.tex"
        if (-not (Test-Path -LiteralPath $up)) { continue }
        New-Item -ItemType Directory -Force -Path $script:Original | Out-Null
        foreach ($file in @(Get-ChildItem -LiteralPath $dir -Filter *.tex -File -ErrorAction SilentlyContinue)) {
            Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $script:Original $file.Name) -Force
        }
        return
    }
}

function Copy-TexFile([string]$Source, [string]$Dest) {
    $parent = Split-Path -Parent $Dest
    if (-not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
    }
    if (Test-Path -LiteralPath $Dest) {
        $item = Get-Item -LiteralPath $Dest -Force
        $item.Attributes = $item.Attributes -band (-bnot [IO.FileAttributes]::ReadOnly)
    }
    Copy-Item -LiteralPath $Source -Destination $Dest -Force
}

function Get-DefaultFaceFile([string]$Face) {
    $saved = Join-Path $script:Original "sky512_$Face.tex"
    if (Test-Path -LiteralPath $saved) { return $saved }
    return $null
}

function Install-Textures([string]$SourceDir, $DestDirs) {
    if (@($DestDirs).Count -eq 0) {
        throw "Roblox is not installed. Install Roblox, open it once, quit it, then try again."
    }
    Backup-OriginalSky $DestDirs
    foreach ($dest in @($DestDirs)) {
        foreach ($face in $script:Faces) {
            $src = Join-Path $SourceDir "sky512_$face.tex"
            if (-not (Test-Path -LiteralPath $src)) { $src = Get-DefaultFaceFile $face }
            if (-not $src) { throw "No default sky is saved for a blank side. Drop a picture on that panel." }
            Copy-TexFile $src (Join-Path $dest "sky512_$face.tex")
            Copy-TexFile $src (Join-Path $dest "indoor512_$face.tex")
        }
    }
}

function Get-CacheRoots {
    $roots = @((Join-Path $env:LOCALAPPDATA "Roblox\rbx-storage"))
    $tempRoblox = Join-Path $env:TEMP "Roblox"
    if (Test-Path -LiteralPath $tempRoblox) {
        $roots += (Join-Path $tempRoblox "rbx-storage")
    }
    Write-Output -NoEnumerate $roots
}

function Write-CacheFiles([byte[]]$Payload) {
    foreach ($root in @(Get-CacheRoots)) {
        foreach ($id in $script:SkyIds) {
            $dir = Join-Path $root $id.Substring(0, 2)
            if (-not (Test-Path -LiteralPath $dir)) {
                New-Item -ItemType Directory -Force -Path $dir | Out-Null
            }
            $file = Join-Path $dir $id
            if (Test-Path -LiteralPath $file) {
                $item = Get-Item -LiteralPath $file -Force
                $item.Attributes = $item.Attributes -band (-bnot [IO.FileAttributes]::ReadOnly)
            }
            [IO.File]::WriteAllBytes($file, $Payload)
            (Get-Item -LiteralPath $file -Force).Attributes = [IO.FileAttributes]::ReadOnly
        }
    }
}

function Remove-CacheFiles {
    foreach ($root in @(Get-CacheRoots)) {
        foreach ($id in $script:SkyIds) {
            $file = Join-Path $root (Join-Path $id.Substring(0, 2) $id)
            if (-not (Test-Path -LiteralPath $file)) { continue }
            $item = Get-Item -LiteralPath $file -Force
            $item.Attributes = $item.Attributes -band (-bnot [IO.FileAttributes]::ReadOnly)
            Remove-Item -LiteralPath $file -Force
        }
    }
}

function Invoke-Sqlite([string]$Sql) {
    $sqlite = Join-Path $PSScriptRoot "sqlite3.exe"
    if (-not (Test-Path -LiteralPath $sqlite)) {
        throw "sqlite3.exe is missing. Unzip the whole Sky Switcher Windows folder and run Sky Switcher.bat from inside it."
    }
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $sqlite
    $psi.Arguments = "-batch -bail `"$($script:Database)`""
    $psi.UseShellExecute = $false
    $psi.RedirectStandardInput = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true
    $process = New-Object System.Diagnostics.Process
    $process.StartInfo = $psi
    [void]$process.Start()
    $outTask = $process.StandardOutput.ReadToEndAsync()
    $errTask = $process.StandardError.ReadToEndAsync()
    $process.StandardInput.Write($Sql)
    $process.StandardInput.Close()
    $process.WaitForExit()
    $stdout = $outTask.Result
    $stderr = $errTask.Result
    if ($process.ExitCode -ne 0) {
        $detail = ($stderr + $stdout).Trim()
        if (-not $detail) { $detail = "SQLite exited with code $($process.ExitCode)." }
        throw "Could not update the Roblox cache. Quit Roblox and try again. $detail"
    }
}

function Update-CacheDatabase([byte[]]$Payload) {
    if (-not (Test-Path -LiteralPath $script:Database)) { return $false }
    $payloadPath = Join-Path $env:TEMP "sky-switcher-cache.bin"
    [IO.File]::WriteAllBytes($payloadPath, $Payload)
    $sqlPath = ($payloadPath -replace "\\", "/").Replace("'", "''")
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("PRAGMA wal_checkpoint(TRUNCATE);") | Out-Null
    foreach ($id in $script:SkyIds) {
        $lines.Add("UPDATE files SET content = readfile('$sqlPath'), size = length(readfile('$sqlPath')) WHERE id = X'$id';") | Out-Null
        $lines.Add("INSERT INTO files (id, content, size, hits, atime, category, score, ttl) SELECT X'$id', readfile('$sqlPath'), length(readfile('$sqlPath')), 0, 0, 10, 0, 0 WHERE NOT EXISTS (SELECT 1 FROM files WHERE id = X'$id');") | Out-Null
    }
    Invoke-Sqlite ($lines -join "`n")
    return $true
}

function Clear-CacheDatabase {
    if (-not (Test-Path -LiteralPath $script:Database)) { return }
    $lines = New-Object System.Collections.Generic.List[string]
    $lines.Add("PRAGMA wal_checkpoint(TRUNCATE);") | Out-Null
    foreach ($id in $script:SkyIds) {
        $lines.Add("DELETE FROM files WHERE id = X'$id';") | Out-Null
    }
    Invoke-Sqlite ($lines -join "`n")
}

function Install-Sky([string]$SourceDir) {
    if (-not (Test-Path -LiteralPath $SourceDir -PathType Container)) {
        throw "Sky folder not found: $SourceDir"
    }
    $destinations = @(Get-SkyDestinations)
    $payload = Get-FreshPayload
    Install-Textures $SourceDir $destinations
    Write-CacheFiles $payload
    $usedDatabase = Update-CacheDatabase $payload
    $name = Split-Path -Leaf $SourceDir
    $where = "folder cache"
    if ($usedDatabase) { $where = "folder cache and Roblox database" }
    return "Installed $name ($where). $(Get-LaunchHint)"
}

function Restore-Original {
    $marker = Join-Path $script:Original "sky512_up.tex"
    if (-not (Test-Path -LiteralPath $marker)) {
        throw "Original sky backup was not found. Switch a sky once before using Restore."
    }
    $destinations = @(Get-SkyDestinations)
    if ($destinations.Count -eq 0) {
        throw "Roblox is not installed. Install Roblox, open it once, quit it, then try again."
    }
    foreach ($dest in $destinations) {
        foreach ($file in @(Get-ChildItem -LiteralPath $script:Original -Filter *.tex -File)) {
            Copy-TexFile $file.FullName (Join-Path $dest $file.Name)
        }
    }
    Remove-CacheFiles
    Clear-CacheDatabase
    return "Restored the original sky. $(Get-LaunchHint)"
}

function Test-SkyFolder([string]$Folder) {
    foreach ($face in $script:Faces) {
        if (-not (Test-Path -LiteralPath (Join-Path $Folder "sky512_$face.tex"))) { return $false }
    }
    return $true
}

function Test-AnyFace([string]$Folder) {
    foreach ($face in $script:Faces) {
        if (Test-Path -LiteralPath (Join-Path $Folder "sky512_$face.tex")) { return $true }
    }
    return $false
}

function Get-PreviewPath([string]$Folder) {
    foreach ($name in @("! SCREENSHOT.png", "SCREENSHOT.png", "screenshot.png")) {
        $path = Join-Path $Folder $name
        if (Test-Path -LiteralPath $path) { return $path }
    }
    return $null
}

function Copy-SkyFolder([string]$Folder, [string]$Name) {
    $safe = [regex]::Replace($Name, '[<>:"/\\|?*]', "-").Trim()
    if (-not $safe) { throw "That sky needs a name." }
    New-Item -ItemType Directory -Force -Path $script:Library | Out-Null
    $dest = Join-Path $script:Library $safe
    if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $dest | Out-Null
    foreach ($face in $script:Faces) {
        $src = Join-Path $Folder "sky512_$face.tex"
        if (Test-Path -LiteralPath $src) {
            Copy-Item -LiteralPath $src -Destination (Join-Path $dest "sky512_$face.tex")
        }
    }
    $shot = Get-PreviewPath $Folder
    if ($shot) { Copy-Item -LiteralPath $shot -Destination (Join-Path $dest (Split-Path -Leaf $shot)) }
    return $safe
}

function Get-SkyEntries {
    $roots = @()
    $ruptic = Join-Path $env:USERPROFILE "Downloads\Ruptic\ALL SKYBOXES\ALL SKYBOXES"
    if (Test-Path -LiteralPath $ruptic) { $roots += $ruptic }
    $beside = Join-Path $PSScriptRoot "skies"
    if (Test-Path -LiteralPath $beside) { $roots += $beside }
    $roots += $script:Library
    $map = @{}
    foreach ($root in $roots) {
        if (-not (Test-Path -LiteralPath $root)) { continue }
        foreach ($dir in @(Get-ChildItem -LiteralPath $root -Directory -ErrorAction SilentlyContinue)) {
            if (Test-AnyFace $dir.FullName) { $map[$dir.Name] = $dir.FullName }
        }
    }
    $entries = @()
    foreach ($name in ($map.Keys | Sort-Object)) {
        $entries += @{ Name = $name; Path = $map[$name] }
    }
    Write-Output -NoEnumerate $entries
}

function Get-InstalledUpHash {
    foreach ($dir in @(Get-ExistingSkyDirs)) {
        $up = Join-Path $dir "sky512_up.tex"
        if (Test-Path -LiteralPath $up) {
            return (Get-FileHash -LiteralPath $up -Algorithm SHA256).Hash
        }
    }
    return $null
}

function Show-Info([string]$Text) {
    [void][System.Windows.Forms.MessageBox]::Show($Text, "Sky Switcher")
}

function Ask-Name {
    $name = [Microsoft.VisualBasic.Interaction]::InputBox(
        "This name shows up in the list. Use this sky installs it into Roblox.",
        "Name this sky",
        "My sky"
    )
    if ([string]::IsNullOrWhiteSpace($name)) { return $null }
    return $name.Trim()
}

function Load-ImageFile([string]$Path) {
    $bytes = [IO.File]::ReadAllBytes($Path)
    $stream = New-Object IO.MemoryStream(,$bytes)
    try {
        $image = [System.Drawing.Image]::FromStream($stream, $true, $true)
        try {
            $bitmap = New-Object System.Drawing.Bitmap $image.Width, $image.Height
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            try {
                $graphics.DrawImage($image, 0, 0, $image.Width, $image.Height)
            } finally {
                $graphics.Dispose()
            }
            return $bitmap
        } finally {
            $image.Dispose()
        }
    } finally {
        $stream.Dispose()
    }
}

function Set-SlotImage([string]$Code, $Image) {
    $box = $script:slots[$Code].Box
    $old = $box.Image
    $box.Image = $Image
    $script:slots[$Code].Empty.Visible = ($null -eq $Image)
    if ($old) { $old.Dispose() }
}

function Set-PreviewImage($Image) {
    $old = $script:previewBox.Image
    $script:previewBox.Image = $Image
    if ($old) { $old.Dispose() }
}

function Select-Face([string]$Code) {
    $script:chosen = $Code
    foreach ($key in @($script:slots.Keys)) {
        if ($key -eq $Code) {
            $script:slots[$key].Panel.BackColor = [System.Drawing.Color]::FromArgb(204, 228, 255)
        } else {
            $script:slots[$key].Panel.BackColor = [System.Drawing.Color]::White
        }
    }
    $image = $script:slots[$Code].Box.Image
    if ($image) {
        Set-PreviewImage (New-Object System.Drawing.Bitmap $image)
    }
    $script:status.Text = "$($script:slots[$Code].Title) is selected. Delete removes this picture."
}

function Show-Sky($Sky) {
    $script:chosen = $null
    foreach ($face in $script:Faces) {
        $script:slots[$face].Panel.BackColor = [System.Drawing.Color]::White
        $file = Join-Path $Sky.Path "sky512_$face.tex"
        if (Test-Path -LiteralPath $file) {
            try {
                Set-SlotImage $face (Load-ImageFile $file)
            } catch {
                Set-SlotImage $face $null
            }
        } else {
            Set-SlotImage $face $null
        }
    }
    $shot = Get-PreviewPath $Sky.Path
    if ($shot) {
        Set-PreviewImage (Load-ImageFile $shot)
    } elseif ($script:slots["up"].Box.Image) {
        Set-PreviewImage (New-Object System.Drawing.Bitmap $script:slots["up"].Box.Image)
    } else {
        Set-PreviewImage $null
    }
    $script:editorTitle.Text = "Pictures in $($Sky.Name)"
}

function Update-List([string]$SelectName) {
    $script:loading = $true
    $script:list.Items.Clear()
    $script:skies = @(Get-SkyEntries)
    $installed = Get-InstalledUpHash
    $selectIndex = -1
    $matchIndex = -1
    for ($i = 0; $i -lt $script:skies.Count; $i++) {
        $sky = $script:skies[$i]
        $label = $sky.Name
        $upFile = Join-Path $sky.Path "sky512_up.tex"
        $hash = $null
        if (Test-Path -LiteralPath $upFile) {
            $hash = (Get-FileHash -LiteralPath $upFile -Algorithm SHA256).Hash
        }
        if ($installed -and $hash -eq $installed) {
            $label = "$($sky.Name) - in use"
            $matchIndex = $i
        }
        [void]$script:list.Items.Add($label)
        if ($SelectName -and $sky.Name -eq $SelectName) { $selectIndex = $i }
    }
    $index = $selectIndex
    if ($index -lt 0) { $index = $matchIndex }
    if ($index -lt 0 -and $script:skies.Count -gt 0) { $index = 0 }
    if ($index -ge 0) { $script:list.SelectedIndex = $index }
    $script:loading = $false
    if ($index -ge 0) {
        Show-Sky $script:skies[$index]
        if ($matchIndex -ge 0) {
            $script:status.Text = "$($script:skies[$matchIndex].Name) is the sky Roblox will use. $(Get-LaunchHint)"
        }
    } elseif ($script:skies.Count -eq 0) {
        $script:status.Text = "No skies yet. Drop pictures on the six sides, or drop a finished sky folder."
    }
}

function Import-Paths($Paths) {
    $names = @()
    foreach ($path in @($Paths)) {
        if (-not (Test-Path -LiteralPath $path -PathType Container)) { continue }
        if (Test-AnyFace $path) {
            $names += (Copy-SkyFolder $path (Split-Path -Leaf $path))
            continue
        }
        foreach ($child in @(Get-ChildItem -LiteralPath $path -Directory -ErrorAction SilentlyContinue)) {
            if (Test-AnyFace $child.FullName) {
                $names += (Copy-SkyFolder $child.FullName $child.Name)
            }
        }
    }
    $loose = @($Paths | Where-Object { (Test-Path -LiteralPath $_ -PathType Leaf) -and ([IO.Path]::GetExtension($_).ToLowerInvariant() -eq ".tex") })
    if ($loose.Count -eq 6 -and $names.Count -eq 0) {
        $name = Ask-Name
        if ($name) {
            $safe = [regex]::Replace($name, '[<>:"/\\|?*]', "-").Trim()
            New-Item -ItemType Directory -Force -Path $script:Library | Out-Null
            $dest = Join-Path $script:Library $safe
            if (Test-Path -LiteralPath $dest) { Remove-Item -LiteralPath $dest -Recurse -Force }
            New-Item -ItemType Directory -Force -Path $dest | Out-Null
            foreach ($file in $loose) {
                Copy-Item -LiteralPath $file -Destination (Join-Path $dest (Split-Path -Leaf $file)) -Force
            }
            if (Test-SkyFolder $dest) { $names += $safe }
        }
    }
    if ($names.Count -eq 0) {
        New-BlankSky
        $script:status.Text = "No sky files in that drop. Blank panels use the default sky. Drop a picture on a panel to change that side."
        return
    }
    Update-List $names[-1]
    $script:status.Text = "Added $($names -join ', '). A blank side uses the default sky."
}

function Open-Face([string]$Code) {
    Select-Face $Code
    $dialog = New-Object System.Windows.Forms.OpenFileDialog
    $dialog.Title = $script:slots[$Code].Title
    $dialog.Filter = "Pictures (*.png;*.jpg;*.jpeg;*.bmp)|*.png;*.jpg;*.jpeg;*.bmp;*.tex"
    $dialog.Multiselect = $false
    try {
        if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { return }
        Set-SlotImage $Code (Load-ImageFile $dialog.FileName)
        Select-Face $Code
        $script:status.Text = "$($script:slots[$Code].Title) is set. Click Rotate under it to turn the picture."
    } catch {
        Show-Info "That file is not a picture Sky Switcher can open. Use a PNG or JPG."
    } finally {
        $dialog.Dispose()
    }
}

function Save-SquarePng($Image, [string]$Path) {
    $side = 1024
    $bitmap = New-Object System.Drawing.Bitmap $side, $side
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $crop = [Math]::Min($Image.Width, $Image.Height)
        $sx = [int](($Image.Width - $crop) / 2)
        $sy = [int](($Image.Height - $crop) / 2)
        $dest = New-Object System.Drawing.Rectangle 0, 0, $side, $side
        $src = New-Object System.Drawing.Rectangle $sx, $sy, ([int]$crop), ([int]$crop)
        $graphics.DrawImage($Image, $dest, $src, [System.Drawing.GraphicsUnit]::Pixel)
    } finally {
        $graphics.Dispose()
    }
    $bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
}

function Get-EmptyPanelTitles {
    $missing = @()
    foreach ($face in $script:FaceTitles) {
        if (-not $script:slots[$face.Code].Box.Image) { $missing += $face.Title }
    }
    return $missing
}

function Save-PanelImages([string]$Dest) {
    if (Test-Path -LiteralPath $Dest) { Remove-Item -LiteralPath $Dest -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $Dest | Out-Null
    foreach ($face in $script:Faces) {
        $image = $script:slots[$face].Box.Image
        if (-not $image) { continue }
        $out = Join-Path $Dest "sky512_$face.tex"
        Save-SquarePng $image $out
        if ($face -eq "up") {
            Copy-Item -LiteralPath $out -Destination (Join-Path $Dest "! SCREENSHOT.png") -Force
        }
    }
}

function Save-CustomSky {
    $filled = @($script:Faces | Where-Object { $script:slots[$_].Box.Image })
    if ($filled.Count -eq 0) {
        $script:status.Text = "Every panel is blank, so this sky is the default. Drop a picture on a panel to change that side."
        return
    }
    $name = Ask-Name
    if (-not $name) { return }
    $safe = [regex]::Replace($name, '[<>:"/\\|?*]', "-").Trim()
    if (-not $safe) { return }
    New-Item -ItemType Directory -Force -Path $script:Library | Out-Null
    Save-PanelImages (Join-Path $script:Library $safe)
    Update-List $safe
    $empty = @(Get-EmptyPanelTitles)
    if ($empty.Count -eq 0) {
        $script:status.Text = "Saved $safe. Click Use this sky to put it in Roblox."
    } else {
        $script:status.Text = "Saved $safe. $($empty -join ', ') stays the default sky."
    }
}

function Use-SelectedSky {
    $index = $script:list.SelectedIndex
    $selected = $null
    if ($index -ge 0 -and $index -lt $script:skies.Count) { $selected = $script:skies[$index] }
    $empty = @(Get-EmptyPanelTitles)
    $folder = $null
    $skyName = $null
    if ($selected -and (Test-SkyFolder $selected.Path) -and $empty.Count -eq 0) {
        $folder = $selected.Path
        $skyName = $selected.Name
    } else {
        if ($selected) {
            $skyName = $selected.Name
        } elseif ($empty.Count -eq 6) {
            $skyName = "Default"
        } else {
            $name = Ask-Name
            if (-not $name) { return }
            $skyName = [regex]::Replace($name, '[<>:"/\\|?*]', "-").Trim()
            if (-not $skyName) { return }
        }
        New-Item -ItemType Directory -Force -Path $script:Library | Out-Null
        $folder = Join-Path $script:Library $skyName
        Save-PanelImages $folder
    }
    if (Test-RobloxRunning) {
        $answer = [System.Windows.Forms.MessageBox]::Show(
            "Roblox is open. It has to quit before the sky can change.",
            "Quit Roblox and use ${skyName}?",
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Warning
        )
        if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { return }
        Stop-Roblox
    }
    $message = Install-Sky $folder
    Update-List $skyName
    if ($empty.Count -eq 0) {
        $script:status.Text = $message
    } else {
        $script:status.Text = "$message $($empty -join ', ') uses the default sky."
    }
}

function Restore-FromButton {
    $answer = [System.Windows.Forms.MessageBox]::Show(
        "This puts back the sky saved the first time you switched, and lets the game download its own sky again.",
        "Restore the original sky?",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { return }
    if (Test-RobloxRunning) { Stop-Roblox }
    $message = Restore-Original
    Update-List
    $script:status.Text = $message
}

function Remove-Selected {
    if ($script:chosen) {
        $title = $script:slots[$script:chosen].Title
        Set-SlotImage $script:chosen $null
        $script:slots[$script:chosen].Panel.BackColor = [System.Drawing.Color]::White
        $script:chosen = $null
        Set-PreviewImage $null
        $script:status.Text = "$title is the default sky again. Click Use this sky to apply it."
        return
    }
    $index = $script:list.SelectedIndex
    if ($index -lt 0 -or $index -ge $script:skies.Count) { return }
    $sky = $script:skies[$index]
    $answer = [System.Windows.Forms.MessageBox]::Show(
        "This removes $($sky.Name) from the list. The sky already in Roblox stays until you switch.",
        "Delete $($sky.Name)?",
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Warning
    )
    if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) { return }
    Remove-Item -LiteralPath $sky.Path -Recurse -Force
    foreach ($face in $script:Faces) { Set-SlotImage $face $null }
    Set-PreviewImage $null
    $script:editorTitle.Text = "Make your own"
    Update-List
    $script:status.Text = "Deleted $($sky.Name)."
}

function New-BlankSky {
    $script:chosen = $null
    foreach ($face in $script:Faces) {
        Set-SlotImage $face $null
        $script:slots[$face].Panel.BackColor = [System.Drawing.Color]::White
    }
    Set-PreviewImage $null
    $script:editorTitle.Text = "Make your own"
    $script:loading = $true
    $script:list.ClearSelected()
    $script:loading = $false
    $script:status.Text = "Blank panels use the default sky. Drop a picture on a side you want to change, then click Use this sky."
}

function Add-FaceDrop([System.Windows.Forms.Control]$Control) {
    $Control.AllowDrop = $true
    $Control.Add_DragEnter({
        if ($_.Data.GetDataPresent([Windows.Forms.DataFormats]::FileDrop)) {
            $_.Effect = [Windows.Forms.DragDropEffects]::Copy
        }
    })
    $Control.Add_DragDrop({
        $face = [string]$this.Tag
        $files = @($_.Data.GetData([Windows.Forms.DataFormats]::FileDrop))
        $dirs = @($files | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Container) })
        if ($dirs.Count -gt 0) {
            Import-Paths $files
            return
        }
        if (-not $face -or -not $files -or $files.Count -lt 1 -or -not $files[0]) { return }
        try {
            Set-SlotImage $face (Load-ImageFile $files[0])
            Select-Face $face
            $script:status.Text = "$($script:slots[$face].Title) updated. Rotate turns it again. Save my sky keeps it."
        } catch {
            Show-Info "That file is not a picture Sky Switcher can open. Use a PNG or JPG."
        }
    })
}

function New-FacePanel([string]$Code, [string]$Title, [int]$X, [int]$Y) {
    $panel = New-Object System.Windows.Forms.Panel
    $panel.Location = New-Object System.Drawing.Point($X, $Y)
    $panel.Size = New-Object System.Drawing.Size(230, 176)
    $panel.BackColor = [System.Drawing.Color]::White
    $panel.BorderStyle = "FixedSingle"
    $panel.Tag = $Code

    $box = New-Object System.Windows.Forms.PictureBox
    $box.Location = New-Object System.Drawing.Point(6, 6)
    $box.Size = New-Object System.Drawing.Size(216, 124)
    $box.SizeMode = "Zoom"
    $box.BackColor = [System.Drawing.Color]::FromArgb(245, 245, 245)
    $box.Tag = $Code
    $panel.Controls.Add($box)

    $empty = New-Object System.Windows.Forms.Label
    $empty.Text = "Default"
    $empty.TextAlign = "MiddleCenter"
    $empty.ForeColor = [System.Drawing.Color]::Gray
    $empty.Location = New-Object System.Drawing.Point(6, 56)
    $empty.Size = New-Object System.Drawing.Size(216, 24)
    $empty.Tag = $Code
    $panel.Controls.Add($empty)
    $empty.BringToFront()

    $caption = New-Object System.Windows.Forms.Label
    $caption.Text = $Title
    $caption.AutoSize = $true
    $caption.Location = New-Object System.Drawing.Point(8, 140)
    $panel.Controls.Add($caption)

    $rotate = New-Object System.Windows.Forms.Button
    $rotate.Text = "Rotate"
    $rotate.Location = New-Object System.Drawing.Point(140, 136)
    $rotate.Size = New-Object System.Drawing.Size(80, 28)
    $rotate.Tag = $Code
    $rotate.Add_Click({
        $face = [string]$this.Tag
        $image = $script:slots[$face].Box.Image
        if (-not $image) { return }
        $copy = New-Object System.Drawing.Bitmap $image
        $copy.RotateFlip([System.Drawing.RotateFlipType]::Rotate90FlipNone)
        Set-SlotImage $face $copy
        Select-Face $face
        $script:status.Text = "$($script:slots[$face].Title) updated. Rotate turns it again. Save my sky keeps it."
    })
    $panel.Controls.Add($rotate)

    $open = {
        $face = [string]$this.Tag
        if (-not $face -and $this.Parent) { $face = [string]$this.Parent.Tag }
        if ($face) { Open-Face $face }
    }
    $box.Add_Click($open)
    $empty.Add_Click($open)
    $panel.Add_Click($open)
    Add-FaceDrop $panel
    Add-FaceDrop $box
    Add-FaceDrop $empty

    $script:slots[$Code] = @{ Box = $box; Empty = $empty; Title = $Title; Panel = $panel }
    return $panel
}

function New-ActionButton([string]$Text, [int]$X, [int]$Y, [int]$Width, [string]$HandlerName) {
    $button = New-Object System.Windows.Forms.Button
    $button.Text = $Text
    $button.Location = New-Object System.Drawing.Point($X, $Y)
    $button.Size = New-Object System.Drawing.Size($Width, 32)
    $button.Tag = $HandlerName
    $button.Add_Click({
        try {
            & ([scriptblock]::Create([string]$this.Tag))
        } catch {
            Show-Info $_.Exception.Message
        }
    })
    return $button
}

function Start-Window {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    Add-Type -AssemblyName Microsoft.VisualBasic
    [System.Windows.Forms.Application]::EnableVisualStyles()

    $form = New-Object System.Windows.Forms.Form
    $form.Text = "Sky Switcher 2"
    $form.ClientSize = New-Object System.Drawing.Size(980, 700)
    $form.FormBorderStyle = "FixedDialog"
    $form.MaximizeBox = $false
    $form.StartPosition = "CenterScreen"
    $form.Font = New-Object System.Drawing.Font("Segoe UI", 9)

    $script:list = New-Object System.Windows.Forms.ListBox
    $script:list.Location = New-Object System.Drawing.Point(16, 16)
    $script:list.Size = New-Object System.Drawing.Size(210, 560)
    $script:list.IntegralHeight = $false
    $script:list.Add_SelectedIndexChanged({
        if ($script:loading) { return }
        $index = $script:list.SelectedIndex
        if ($index -lt 0 -or $index -ge $script:skies.Count) { return }
        Show-Sky $script:skies[$index]
        $empty = @(Get-EmptyPanelTitles)
        if ($empty.Count -eq 0) {
            $script:status.Text = "Showing the pictures in $($script:skies[$index].Name). Click one, then Delete to remove that picture."
        } else {
            $script:status.Text = "$($empty -join ', ') is the default sky. Drop a picture on a panel to change that side."
        }
    })
    $script:list.Add_DoubleClick({
        try { Use-SelectedSky } catch { Show-Info $_.Exception.Message }
    })
    $form.Controls.Add($script:list)

    $script:previewBox = New-Object System.Windows.Forms.PictureBox
    $script:previewBox.Location = New-Object System.Drawing.Point(242, 16)
    $script:previewBox.Size = New-Object System.Drawing.Size(722, 120)
    $script:previewBox.SizeMode = "Zoom"
    $script:previewBox.BackColor = [System.Drawing.Color]::FromArgb(32, 32, 32)
    $script:previewBox.BorderStyle = "FixedSingle"
    $form.Controls.Add($script:previewBox)

    $script:editorTitle = New-Object System.Windows.Forms.Label
    $script:editorTitle.Text = "Make your own"
    $script:editorTitle.AutoSize = $true
    $script:editorTitle.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
    $script:editorTitle.Location = New-Object System.Drawing.Point(242, 146)
    $form.Controls.Add($script:editorTitle)

    $xPositions = @(242, 484, 726)
    for ($i = 0; $i -lt $script:FaceTitles.Count; $i++) {
        $face = $script:FaceTitles[$i]
        $row = [Math]::Floor($i / 3)
        $col = $i % 3
        $panel = New-FacePanel $face.Code $face.Title $xPositions[$col] (176 + ($row * 186))
        $form.Controls.Add($panel)
    }

    $drop = New-Object System.Windows.Forms.Panel
    $drop.Location = New-Object System.Drawing.Point(242, 548)
    $drop.Size = New-Object System.Drawing.Size(722, 36)
    $drop.BorderStyle = "FixedSingle"
    $drop.AllowDrop = $true
    $dropText = New-Object System.Windows.Forms.Label
    $dropText.Text = "Or drop a finished sky folder here"
    $dropText.TextAlign = "MiddleCenter"
    $dropText.Dock = "Fill"
    $dropText.ForeColor = [System.Drawing.Color]::DimGray
    $dropText.Enabled = $false
    $drop.Controls.Add($dropText)
    $drop.Add_DragEnter({
        if ($_.Data.GetDataPresent([Windows.Forms.DataFormats]::FileDrop)) {
            $_.Effect = [Windows.Forms.DragDropEffects]::Copy
        }
    })
    $drop.Add_DragDrop({
        $files = @($_.Data.GetData([Windows.Forms.DataFormats]::FileDrop))
        Import-Paths $files
    })
    $form.Controls.Add($drop)

    $script:status = New-Object System.Windows.Forms.Label
    $script:status.AutoSize = $false
    $script:status.Location = New-Object System.Drawing.Point(16, 596)
    $script:status.Size = New-Object System.Drawing.Size(948, 36)
    $script:status.ForeColor = [System.Drawing.Color]::DimGray
    $script:status.Text = "Pick a sky, or drop your own pictures."
    $form.Controls.Add($script:status)

    $form.Controls.Add((New-ActionButton "Delete" 16 644 90 "Remove-Selected"))
    $form.Controls.Add((New-ActionButton "New sky" 114 644 90 "New-BlankSky"))
    $form.Controls.Add((New-ActionButton "Restore original sky" 470 644 160 "Restore-FromButton"))
    $form.Controls.Add((New-ActionButton "Save my sky" 638 644 110 "Save-CustomSky"))
    $use = New-ActionButton "Use this sky" 756 644 208 "Use-SelectedSky"
    $form.Controls.Add($use)
    $form.AcceptButton = $use

    Update-List
    [void]$form.ShowDialog()
}

Unblock-Bundle

if ($SelfTest) {
    $payload = Get-FreshPayload
    if ($payload.Length -ne 1091) { throw "payload length $($payload.Length)" }
    $header = [Text.Encoding]::ASCII.GetString($payload)
    if ($header -notmatch "Date: [A-Za-z]{3}, [0-9]{2} [A-Za-z]{3} [0-9]{4} ") {
        throw "fresh date header is missing"
    }
    $root = Join-Path $script:Library "Test Sky"
    New-Item -ItemType Directory -Force -Path $root | Out-Null
    foreach ($face in $script:Faces) {
        [IO.File]::WriteAllText((Join-Path $root "sky512_$face.tex"), "x")
    }
    $entries = @(Get-SkyEntries)
    if ($entries.Count -ne 1 -or $entries[0].Name -ne "Test Sky") {
        throw "sky list came back as $($entries.Count) items"
    }
    Remove-Item -LiteralPath $root -Recurse -Force
    Write-Output "ok"
    exit 0
}

if ($Restore -or $SkyDir) {
    try {
        if (Test-RobloxRunning) {
            if (-not $QuitRoblox) { throw "Quit Roblox completely, then run this again." }
            Stop-Roblox
        }
        if ($Restore) {
            Write-Output (Restore-Original)
        } else {
            Write-Output (Install-Sky $SkyDir)
        }
        exit 0
    } catch {
        [Console]::Error.WriteLine($_.Exception.Message)
        exit 1
    }
}

try {
    Start-Window
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
}
