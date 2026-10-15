# Stock de Semillas · MORERO Semillas y Cereales S.A.

Página web para llevar el stock de semillas (girasol, maíz y sorgo): híbridos, clientes, compras, ventas y reportes.

## Cómo se usa

1. **Híbridos**: cargá cada híbrido con su semillero y grano, o importá un Excel con las columnas *Semillero*, *Híbrido* y *Grano*.
2. **Clientes**: cargalos a mano o importá un Excel con la columna *Nombre* (y opcionalmente CUIT, Localidad, Teléfono, Correo).
3. **Compras**: existencia inicial de campaña, compras, pedidos y mercadería consignada (suman stock) y devoluciones a semillero (restan). Se elige banda (1, 2, 3 o sin banda) y el precio es opcional. También se indica el **proveedor**: se completa solo con el semillero del híbrido y se cambia si se compró a otro proveedor (no se pide en la existencia inicial). Al escribir, sugiere los semilleros y los nombres cargados en Clientes. El listado de compras tiene la columna Proveedor y el buscador también busca por proveedor.
   - **Varios híbridos a la vez** (compras y también ventas, reservas, pedidos de cliente y devoluciones): al cargar una operación nueva, después del proveedor o del cliente se elige híbrido, banda, cantidad (y precio) y se toca «Agregar este híbrido»; se repite con los demás y al final «Guardar todo». En ventas, el stock disponible descuenta lo ya agregado y avisa si se supera. Se guardan todos con el mismo tipo, fecha, proveedor y comprobante. Si el último híbrido quedó escrito sin agregar, también se guarda.
   - **Importar compras de Algoritmo (Excel)**: igual que en ventas, con columna de Proveedor en lugar de Cliente.
     Códigos: PED/OC → pedido; REM y FAC → compra; consignación (CON/RCO) → mercadería consignada; devolución (RDE/DEV) → resta stock.
     Pedido, remitos (o consignación) y factura del mismo híbrido se vinculan para sumar stock una sola vez y mostrar el **saldo a recibir**.
     Mismo control de duplicados y de cantidades modificadas que en ventas.
4. **Ventas**: ventas y reservas. Se busca el cliente por nombre, se elige el híbrido y la banda. Descuentan stock.
   - Tipos: venta, reserva, pedido de cliente (descuentan stock) y devolución de cliente (suma stock).
   - **Importar ventas de Algoritmo (Excel)**: se eligen las columnas de Cliente, Descripción, Cantidad y Código de operación
     (y opcionalmente Fecha y Comprobante); la elección queda recordada.
     - Código de operación: **FAC** y **REM** → venta; **PED** → pedido; **RDE** → devolución (suma stock).
     - Híbrido: se busca en la descripción el híbrido cargado (ej.: «girasol ADV 5407 CL G2 Env. 180.000 Semillas» → ADV 5407). Si el nombre no está completo, se asocia por el número del híbrido (ej.: «3970» o «NK3970» → SYN 3970); esas filas quedan marcadas «¿Es el mismo híbrido?» para controlarlas. Si el híbrido no está cargado, en el desplegable de la fila está «＋ Cargar híbrido nuevo…»: abre la carga con grano, semillero y nombre tomados de la descripción (ej.: SYN 3970 CL, Syngenta, Girasol); al guardarlo se asocia a esa fila y a las demás que lo nombran (también «NK 3970»).
     - Bandas en girasol: G0, G1, G2 → Banda 1; G3 → Banda 2; G3E, G4 → Banda 3.
     - Si llega un remito o una factura de un cliente e híbrido que ya tienen un pedido, remito o factura anterior con saldo,
       la vista previa pregunta si corresponde a esa operación. Pedido, remitos y factura quedan vinculados como una sola
       operación: el stock se descuenta una sola vez (lo mayor entre pedido, remitido y facturado) y se muestra el
       **saldo a remitir** (ej.: factura 100, remito 50 → la factura queda en 100 con saldo a remitir 50).
     - Cuando hay una opción clara (una sola operación anterior, o la que coincide justo con la cantidad, o varias que
       juntas suman la cantidad, como una factura que cubre dos remitos) la respuesta ya viene marcada como «sugerido».
       Si queda alguna pregunta sin responder, no se importa nada hasta responderla.
     - Ejemplo: factura 75 + remito 75 → el stock suma 75 una sola vez; la factura figura por 75 con saldo a recibir 0.
       Una factura sin remito suma stock y queda con saldo a recibir (pendiente en físico).
     - Los clientes que no existen se agregan solos.
     - **Sin duplicados**: cada renglón se identifica por código de operación + comprobante + cliente + descripción
       (sin mirar la cantidad). Si ya estaba cargado con la misma cantidad, no se vuelve a cargar; si la cantidad cambió
       en Algoritmo, se muestra «antes X, ahora Y» y se elige actualizarla o dejarla. Lo cargado a mano con el mismo
       número de comprobante, cliente e híbrido también se reconoce.
     - Columnas del listado de Algoritmo que se usan (ventas y compras tienen el mismo formato): «Nombre del Productor»
       (cliente o proveedor), «Descripción», «Cantidad», «Código Comprobante», «Comprobante», «Fecha Comprobante»
       y, opcional, «PRECIO» (precio por bolsa en US$). Se reconocen solas.
     - Si en ventas el cliente es un semillero de la lista, avisa que puede ser un listado de compras.
5. **Posición comercial**: totales ingresados, salidas (ventas, reservas, pedidos de clientes, devoluciones), saldos a recibir y a remitir por híbrido y banda, filtrando por grano o por híbridos. Opción para mostrar solo los híbridos que no están en cero (saldo, a recibir y a remitir en 0).
6. **Reporte de stock**: dos formatos a elegir:
   - **Con detalle de movimientos**: ficha de cada híbrido con todas las operaciones, el saldo y el stock final.
   - **Solo totales**: por híbrido y banda, total ingresado, total salido, saldo y saldos a recibir / a remitir, con total por grano y general.
   Los comprobantes vinculados (pedido, remito, factura) se muestran uno debajo del otro aunque tengan fechas distintas
   (también en las listas de Compras y Ventas).
7. Los reportes se pueden **imprimir / guardar en PDF** o **descargar en Excel**.

## Dónde quedan los datos

Todo se guarda **solo en el navegador** de la computadora o celular donde se usa. No hay base de datos ni claves, y los Excel se leen en el navegador sin subirse a ningún servidor.
Por eso conviene usar **Copia de seguridad → Bajar copia** seguido. Con esa misma copia se pueden pasar los datos a otro equipo (**Restaurar una copia**).

## Publicar en Vercel

Importar el repositorio en Vercel y aceptar. No hay que configurar nada: son archivos estáticos (`index.html`, `styles.css`, `app.js`).

La lectura de Excel usa SheetJS (`vendor/xlsx.full.min.js`, licencia Apache 2.0), incluido en el repositorio.
