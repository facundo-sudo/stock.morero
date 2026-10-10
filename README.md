# Stock de Semillas · MORERO Semillas y Cereales S.A.

Página web para llevar el stock de semillas (girasol, maíz y sorgo): híbridos, clientes, compras, ventas y reportes.

## Cómo se usa

1. **Híbridos**: cargá cada híbrido con su semillero y grano, o importá un Excel con las columnas *Semillero*, *Híbrido* y *Grano*.
2. **Clientes**: cargalos a mano o importá un Excel con la columna *Nombre* (y opcionalmente CUIT, Localidad, Teléfono, Correo).
3. **Compras**: existencia inicial de campaña, compras, pedidos y mercadería consignada. Suman stock. Se elige banda (1, 2, 3 o sin banda) y el precio es opcional.
4. **Ventas**: ventas y reservas. Se busca el cliente por nombre, se elige el híbrido y la banda. Descuentan stock.
   - **Importar ventas de Algoritmo (Excel)**: se eligen las columnas de Cliente, Descripción y Cantidad (y opcionalmente Fecha y Comprobante); la elección queda recordada.
     La página busca en la descripción el híbrido cargado (ej.: «girasol ADV 5407 CL G2 Env. 180.000 Semillas» → ADV 5407) y en girasol define la banda:
     G0, G1, G2 → Banda 1; G3 → Banda 2; G3E, G4 → Banda 3. Antes de guardar se muestra una vista previa para corregir.
     Los clientes que no existen se agregan solos, y las filas ya importadas antes se saltean.
5. **Posición comercial**: totales ingresados y salidas por híbrido y banda, filtrando por grano o por híbridos.
6. **Reporte de stock**: ficha de cada híbrido con todas las operaciones, el saldo y el stock final.
7. Los reportes se pueden **imprimir / guardar en PDF** o **descargar en Excel**.

## Dónde quedan los datos

Todo se guarda **solo en el navegador** de la computadora o celular donde se usa. No hay base de datos ni claves, y los Excel se leen en el navegador sin subirse a ningún servidor.
Por eso conviene usar **Copia de seguridad → Bajar copia** seguido. Con esa misma copia se pueden pasar los datos a otro equipo (**Restaurar una copia**).

## Publicar en Vercel

Importar el repositorio en Vercel y aceptar. No hay que configurar nada: son archivos estáticos (`index.html`, `styles.css`, `app.js`).

La lectura de Excel usa SheetJS (`vendor/xlsx.full.min.js`, licencia Apache 2.0), incluido en el repositorio.
