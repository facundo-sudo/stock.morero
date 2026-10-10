# Stock de Semillas · MORERO Semillas y Cereales S.A.

Página web para llevar el stock de semillas (girasol, maíz y sorgo): híbridos, clientes, compras, ventas y reportes.

## Cómo se usa

1. **Híbridos**: cargá cada híbrido con su semillero y grano, o importá un Excel con las columnas *Semillero*, *Híbrido* y *Grano*.
2. **Clientes**: cargalos a mano o importá un Excel con la columna *Nombre* (y opcionalmente CUIT, Localidad, Teléfono, Correo).
3. **Compras**: existencia inicial de campaña, compras, pedidos y mercadería consignada (suman stock) y devoluciones a semillero (restan). Se elige banda (1, 2, 3 o sin banda) y el precio es opcional.
   - **Importar compras de Algoritmo (Excel)**: igual que en ventas, con columna de Proveedor en lugar de Cliente.
     Códigos: PED/OC → pedido; REM y FAC → compra; consignación (CON/RCO) → mercadería consignada; devolución (RDE/DEV) → resta stock.
     Pedido, remitos (o consignación) y factura del mismo híbrido se vinculan para sumar stock una sola vez y mostrar el **saldo a recibir**.
     Mismo control de duplicados y de cantidades modificadas que en ventas.
4. **Ventas**: ventas y reservas. Se busca el cliente por nombre, se elige el híbrido y la banda. Descuentan stock.
   - Tipos: venta, reserva, pedido de cliente (descuentan stock) y devolución de cliente (suma stock).
   - **Importar ventas de Algoritmo (Excel)**: se eligen las columnas de Cliente, Descripción, Cantidad y Código de operación
     (y opcionalmente Fecha y Comprobante); la elección queda recordada.
     - Código de operación: **FAC** y **REM** → venta; **PED** → pedido; **RDE** → devolución (suma stock).
     - Híbrido: se busca en la descripción el híbrido cargado (ej.: «girasol ADV 5407 CL G2 Env. 180.000 Semillas» → ADV 5407).
     - Bandas en girasol: G0, G1, G2 → Banda 1; G3 → Banda 2; G3E, G4 → Banda 3.
     - Si llega un remito o una factura de un cliente e híbrido que ya tienen un pedido, remito o factura anterior con saldo,
       la vista previa pregunta si corresponde a esa operación. Pedido, remitos y factura quedan vinculados como una sola
       operación: el stock se descuenta una sola vez (lo mayor entre pedido, remitido y facturado) y se muestra el
       **saldo a remitir** (ej.: factura 100, remito 50 → la factura queda en 100 con saldo a remitir 50).
     - Los clientes que no existen se agregan solos.
     - **Sin duplicados**: cada renglón se identifica por código de operación + comprobante + cliente + descripción
       (sin mirar la cantidad). Si ya estaba cargado con la misma cantidad, no se vuelve a cargar; si la cantidad cambió
       en Algoritmo, se muestra «antes X, ahora Y» y se elige actualizarla o dejarla. Lo cargado a mano con el mismo
       número de comprobante, cliente e híbrido también se reconoce.
     - Columnas del listado de Algoritmo que se usan: «Nombre del Productor», «Descripción», «Cantidad»,
       «Código Comprobante», «Comprobante» y «Fecha Comprobante» (se reconocen solas).
5. **Posición comercial**: totales ingresados, salidas (ventas, reservas, pedidos de clientes, devoluciones) y saldo a remitir por híbrido y banda, filtrando por grano o por híbridos.
6. **Reporte de stock**: ficha de cada híbrido con todas las operaciones, el saldo y el stock final.
7. Los reportes se pueden **imprimir / guardar en PDF** o **descargar en Excel**.

## Dónde quedan los datos

Todo se guarda **solo en el navegador** de la computadora o celular donde se usa. No hay base de datos ni claves, y los Excel se leen en el navegador sin subirse a ningún servidor.
Por eso conviene usar **Copia de seguridad → Bajar copia** seguido. Con esa misma copia se pueden pasar los datos a otro equipo (**Restaurar una copia**).

## Publicar en Vercel

Importar el repositorio en Vercel y aceptar. No hay que configurar nada: son archivos estáticos (`index.html`, `styles.css`, `app.js`).

La lectura de Excel usa SheetJS (`vendor/xlsx.full.min.js`, licencia Apache 2.0), incluido en el repositorio.
