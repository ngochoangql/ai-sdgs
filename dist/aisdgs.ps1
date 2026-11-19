#!/usr/bin/env pwsh
$basedir = Split-Path $MyInvocation.MyCommand.Definition -Parent
& node "$basedir\aisdgs-standalone.mjs" @args
exit $LASTEXITCODE
