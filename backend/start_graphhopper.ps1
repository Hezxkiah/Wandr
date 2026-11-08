param(
    [string]$GraphHopperHome = (Join-Path $env:USERPROFILE "graphhopper"),
    [string]$JavaExecutable = "C:\Program Files\Java\jdk-25.0.5.0.2\bin\java.exe",
    [string]$MapFile = "C:\Users\annie\Downloads\texas-261107.osm.pbf"
)

$jar = Join-Path $GraphHopperHome "graphhopper-web-11.1.jar"
$config = Join-Path $PSScriptRoot "graphhopper.yml"

if (-not (Test-Path -LiteralPath $JavaExecutable)) {
    throw "Java 25 was not found at $JavaExecutable"
}

if (-not (Test-Path -LiteralPath $jar)) {
    throw "GraphHopper 11.1 was not found at $jar"
}

$resolvedMapFile = [System.IO.Path]::GetFullPath($MapFile)

if (-not (Test-Path -LiteralPath $resolvedMapFile)) {
    throw "The OSM map was not found at $resolvedMapFile"
}

Push-Location $GraphHopperHome
try {
    & $JavaExecutable `
        "-Ddw.graphhopper.datareader.file=$resolvedMapFile" `
        -jar $jar `
        server $config
}
finally {
    Pop-Location
}
