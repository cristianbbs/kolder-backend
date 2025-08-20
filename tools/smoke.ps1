param()

function Invoke-Json {
  param([string]$Method,[string]$Url,[hashtable]$Headers=@{},$Body=$null)
  try {
    if ($Body -ne $null) {
      irm -Method $Method -Uri $Url -Headers $Headers -Body ($Body | ConvertTo-Json) -ContentType 'application/json' -ErrorAction Stop
    } else {
      irm -Method $Method -Uri $Url -Headers $Headers -ErrorAction Stop
    }
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $sr = New-Object IO.StreamReader($resp.GetResponseStream())
      $body = $sr.ReadToEnd()
      [int]$code = [int]$resp.StatusCode
      Write-Host "HTTP $code"
      Write-Host $body
    } else { throw }
  }
}

$API = 'http://localhost:4000'
Write-Host "Health:" (irm "$API/health")

$uToken  = (irm -Method POST "$API/auth/login" -Body (@{ email="user1@demo.cl";       password="TuPass123" }       | ConvertTo-Json) -ContentType 'application/json').token
$u2Token = (irm -Method POST "$API/auth/login" -Body (@{ email="user2@demo.cl";       password="NuevaSegura123!" } | ConvertTo-Json) -ContentType 'application/json').token
$caToken = (irm -Method POST "$API/auth/login" -Body (@{ email="responsable@demo.cl"; password="TuPass123" }       | ConvertTo-Json) -ContentType 'application/json').token

# Catálogo para USER1 (el que crea el pedido)
$cat = irm -Headers @{ Authorization = "Bearer $uToken" } "$API/products/catalog"
$allowedCount = ($cat.categories | ForEach-Object { $_.products.Count } | Measure-Object -Sum).Sum
Write-Host "Allowed products (USER1):" $allowedCount
if ($allowedCount -lt 1) { Write-Host "No hay productos habilitados, abortando"; exit 1 }

# Toma un productId válido (usa variable NO reservada)
$prodId = [int]($cat.categories | ForEach-Object { $_.products } | Select-Object -First 1).id
Write-Host "Producto a pedir:" $prodId

# Crear pedido con USER1
$body = @{ items=@(@{productId=$prodId;quantity=1}); note="smoke" }
$o    = irm -Method POST -Headers @{ Authorization = "Bearer $uToken" } "$API/orders" -Body ($body|ConvertTo-Json) -ContentType 'application/json'
$id   = [int]$o.id
Write-Host "Order created:" $id
if (-not $id) { Write-Host "No se creó el pedido, abortando"; exit 1 }

# Cross-scope: USER2 no debe ver el pedido de USER1
try {
  irm -Headers @{ Authorization = "Bearer $u2Token" } "$API/orders/$id"
  Write-Host "ERROR: cross-scope read allowed"
} catch {
  Write-Host "Cross-scope GET blocked ✅"
}

# Transiciones válidas por COMPANY_ADMIN
Invoke-Json -Method PUT -Url "$API/orders/$id/status" -Headers @{ Authorization = "Bearer $caToken" } -Body @{ status="PREPARING" } | Out-Null
Invoke-Json -Method PUT -Url "$API/orders/$id/status" -Headers @{ Authorization = "Bearer $caToken" } -Body @{ status="EN_ROUTE" }  | Out-Null
Invoke-Json -Method PUT -Url "$API/orders/$id/status" -Headers @{ Authorization = "Bearer $caToken" } -Body @{ status="DELIVERED" } | Out-Null

# Detalle y timeline (USER1)
$detail = irm -Headers @{ Authorization = "Bearer $uToken" } "$API/orders/$id"
Write-Host "Final status:" $detail.order.status
$detail.order.statusLogs | Select-Object -Last 4 | Format-Table
