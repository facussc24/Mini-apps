# Aplicación de Balanceo de Líneas

Esta es una herramienta web para calcular métricas clave en el balanceo de líneas de producción, como el tiempo de ciclo (Takt Time), el contenido total de trabajo y el número mínimo de estaciones. También genera un diagrama de precedencias visual para las tareas.

## ¿Cómo Empezar?

Para usar la aplicación, necesitas iniciar un pequeño servidor local que la ponga en funcionamiento.

### 1. Inicia el Servidor:

- **Si usas Windows**: Haz doble clic en el archivo `iniciar.bat`.
- **Si usas Mac o Linux**: Abre una terminal y ejecuta el comando `sh iniciar.sh`.

Aparecerá una ventana de terminal. **No la cierres**. Mientras esta ventana esté abierta, el servidor estará funcionando.

### 2. Abre la Aplicación:

- Abre tu navegador web (Chrome, Firefox, etc.).
- Ve a la siguiente dirección: [http://localhost:3000](http://localhost:3000)

## ¿Cómo Usar la Aplicación?

1.  **Ingresa los Parámetros de Producción**:
    - **Demanda Diaria**: La cantidad de unidades que necesitas producir por día.
    - **Tiempo de Producción Disponible**: El total de minutos de trabajo efectivo en un día.
    - Haz clic en **"Calcular Tiempo de Ciclo"** para obtener el Takt Time en segundos.

2.  **Agrega Tareas**:
    - Completa el formulario de **"Captura de Tiempos Estándar"** con la información de cada tarea (ID, descripción, tiempo, etc.).
    - Si una tarea depende de otra, especifica el ID de la tarea predecesora.
    - Haz clic en **"Agregar Tarea"**. La tarea aparecerá en la tabla y el diagrama de precedencias se actualizará automáticamente.

3.  **Calcula las Estaciones Mínimas**:
    - Una vez que hayas agregado todas las tareas y calculado el tiempo de ciclo, haz clic en **"Calcular Estaciones Mínimas"** para determinar el número mínimo teórico de estaciones de trabajo que necesitas.

## ¿Cómo Detener la Aplicación?

Simplemente cierra la ventana de la terminal que abriste en el primer paso. Esto detendrá el servidor.
