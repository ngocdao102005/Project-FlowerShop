param(
  [string]$MysqlHome = $env:FLOWERY_MYSQL_HOME,
  [string]$ConfigFile = $env:FLOWERY_MYSQL_CONFIG
)

if (-not $MysqlHome) {
  throw 'Hãy đặt FLOWERY_MYSQL_HOME tới thư mục mysql-8.4.x-winx64.'
}
if (-not $ConfigFile) {
  $ConfigFile = Join-Path $MysqlHome 'my.ini'
}

$server = Join-Path $MysqlHome 'bin\mysqld.exe'
if (-not (Test-Path -LiteralPath $server)) {
  throw "Không tìm thấy mysqld.exe tại $server"
}

$process = Start-Process -FilePath $server `
  -ArgumentList "--defaults-file=$ConfigFile", '--console' `
  -WindowStyle Hidden -PassThru
Write-Host "MySQL Flowery đã khởi động (PID $($process.Id))."

