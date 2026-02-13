# Afirma Radio — Generador de Comentarios

## Resumen

Herramienta interna para Afirma Radio que genera comentarios realistas de oyentes a partir de contenido de programas de radio, ya sea subiendo un archivo de audio o escuchando la transmisión en vivo.

## Identidad Visual

- Logo de Afirma Radio centrado en el encabezado (asset proporcionado por el usuario)
- Paleta: morado `#793d87`, rosa-magenta `#ae4b77`, negro y blanco
- Estilo limpio, minimalista, profesional con tipografía sans-serif moderna o montserrat 

## Pantalla Principal (vista única)

### 1. Encabezado

- Logo de Afirma Radio centrado
- Título "Generar Comentarios" en negrita

### 2. Zona de Entrada de Audio

Contenedor con borde punteado con dos opciones mutuamente excluyentes:

**Opción A — Subir archivo de audio**

- Área de drag & drop para archivos `.mp3`, `.wav`, `.m4a`
- Muestra nombre y duración del archivo cargado
- Botón para eliminar el archivo

**Opción B — Escuchar transmisión en vivo**

- Se conecta al stream HLS de Afirma Radio usando `hls.js`
- Panel de grabación inline con botón de stop, visualizador de waveform y contador de tiempo (máx 90 min) con efecto en movimiento de que esta escuchando en vivo
- Botón "← Atrás" para cancelar
- Al presionar stop, el audio se transcribe automáticamente y se elimina de memoria

### 3. Campos de Configuración

- **Programa** (ej: Padres Invencibles)
- **Conductores** (ej: Eustolia y Moy)
- **Ciudades** (ej: Barcelona, Guadalajara, Mendoza)
- Toggle "Ciudades de México" que genera ciudades mexicanas aleatorias

### 4. Cantidad de Comentarios

- Slider de 5 a 25, valor por defecto 10
- Etiquetas: Mínimo (5) — Recomendado (10) — Máximo (25)
- Nota informativa sobre tiempo de generación

### 5. Botón "Generar Comentarios"

- Degradado morado a rosa-magenta, ancho completo
- Estado de carga con spinner
- Deshabilitado si no hay audio procesado

### 6. Tarjetas de Resultados

- Cada tarjeta muestra: nombre ficticio, ciudad y comentario
- Botones "Copiar" y "Editar" por tarjeta
- Edición inline con botón "Guardar"
- Botones globales: "Copiar todos" y "Regenerar"

## Backend (Lovable Cloud)

### Edge Function: Transcripción de Audio

- Recibe el archivo de audio y lo envía a la API de Whisper de OpenAI para transcripción
- Retorna el texto transcrito al frontend

### Edge Function: Generación de Comentarios

- Recibe la transcripción + parámetros (programa, conductores, ciudades, cantidad)
- Usa Lovable AI con el prompt detallado del sistema para generar comentarios realistas en JSON
- Retorna el array de comentarios al frontend

## Flujo del Usuario

1. Sube un MP3 o escucha la transmisión en vivo
2. El audio se transcribe automáticamente (Whisper API) y se elimina de memoria
3. Llena los campos: programa, conductores, ciudades y cantidad
4. Clic en "Generar Comentarios"
5. Se muestran las tarjetas con comentarios generados
6. Puede copiar, editar individualmente, copiar todos o regenerar

## Notas Importantes

- Sin persistencia de datos: no hay login, base de datos ni almacenamiento
- El audio solo existe en memoria durante el procesamiento
- La transcripción nunca se muestra al usuario
- Diseño responsivo para móvil y escritorio