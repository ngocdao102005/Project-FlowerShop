param([string]$MysqlHome = $env:FLOWERY_MYSQL_HOME)

if (-not $MysqlHome) {
  throw 'Hãy đặt FLOWERY_MYSQL_HOME tới thư mục mysql-8.4.x-winx64.'
}

$admin = Join-Path $MysqlHome 'bin\mysqladmin.exe'
if (-not (Test-Path -LiteralPath $admin)) {
  throw "Không tìm thấy mysqladmin.exe tại $admin"
}

& $admin --host=127.0.0.1 --port=3306 --user=root --password shutdown

