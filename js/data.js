document.addEventListener("DOMContentLoaded", () => {
  const dataForm = document.getElementById("data-form");
  const sesionDateInput = document.getElementById("sesion-fecha");
  const sesionPlaceInput = document.getElementById("sesion-lugar");
  const sesionTableInput = document.getElementById("sesion-tabla");
  const sesionWavesInput = document.getElementById("sesion-olas");
  const tableBody = document.getElementById("table-body");
  const addSesionBtn = document.getElementById("add-sesion-btn");
  const updateSesionBtn = document.getElementById("update-sesion-btn");
  const loadingIndicator = document.getElementById("loading-indicator");
  const statusMessage = document.getElementById("status-message");

  // Modal de confirmación
  const confirmationModal = document.getElementById("confirmation-modal");
  const confirmDeleteBtn = confirmationModal.querySelector(".confirm-btn");
  const cancelDeleteBtn = confirmationModal.querySelector(".cancel-btn");
  let sesionToDeleteId = null;
  // Para almacenar el ID de la sesión a eliminar

  let editingSesionId = null;
  // Para almacenar el ID de la sesión que se está editando

  // Base de Mock API
  const API_BASE_URL =
    "https://69bb60a50915748735b9079a.mockapi.io/api/v1/sesion";

  // Función para mostrar mensajes de estado (error/éxito)
  function showMessage(element, message, type = "error") {
    element.textContent = message;
    element.classList.remove("hidden", "error", "success");
    element.classList.add(type); // Añadir la clase de tipo
    setTimeout(() => {
      element.classList.add("hidden");
    }, 5000); // Ocultar mensaje después de 5 segundos
  }

  // Función para manejar errores de la API con reintentos (exponential backoff)
  async function fetchWithRetry(url, options = {}, retries = 3, delay = 1000) {
    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, options);
        if (!response.ok) {
          // Intenta leer el mensaje de error del cuerpo de la respuesta si
          // está disponible
          const errorText = await response.text();
          throw new Error(
            "HTTP error! status: " +
              response.status +
              " - " +
              (errorText || response.statusText),
          );
        }
        return response;
      } catch (error) {
        if (i < retries - 1) {
          console.warn(
            "Intento " +
              (i + 1) +
              " fallido. Reintentando en " +
              delay / 1000 +
              " segundos...",
            error,
          );
          await new Promise((res) => setTimeout(res, delay));
          delay *= 2; // Duplicar el retraso para el siguiente intento
        } else {
          throw error; // Lanzar el error si se agotaron los reintentos
        }
      }
    }
  }

  function setEditingSesion(id) {
    sesionToDeleteId = null;
    editingSesionId = id;
    addSesionBtn.style.display = "none";
    updateSesionBtn.style.display = "inline-block";
  }

  function resetEditingSesion() {
    editingSesionId = null;
    addSesionBtn.style.display = "inline-block";
    updateSesionBtn.style.display = "none";
  }

  // Función para renderizar la tabla con los datos
  function renderTable(data) {
    tableBody.innerHTML = ""; // Limpiar tabla
    if (data.length === 0) {
      const row = document.createElement("tr");
      const empty = document.createElement("td");
      empty.setAttribute("colspan", 6);
      empty.classList.add("empty");
      empty.textContent = "No hay sesiones para mostrar.";
      row.appendChild(empty);
      tableBody.appendChild(row);
      return;
    }
    data.forEach((sesion) => {
      const row = document.createElement("tr");

      //agregamos 3 campos al row, id, name y value
      ["id", "date", "place", "table", "waves"].forEach((attr) => {
        const td = document.createElement("td");
        td.textContent = sesion[attr];
        row.appendChild(td);
      });

      //agregamos un campo con 2 botones, editar y eliminar
      const actions = document.createElement("td");
      actions.classList.add("table-actions");
      const edit = document.createElement("button");
      edit.classList.add("edit-btn");
      edit.textContent = "Editar";
      edit.addEventListener("click", (e) => {
        setEditingSesion(sesion.id);
        sesionDateInput.value = sesion.date;
        sesionPlaceInput.value = sesion.place;
        sesionTableInput.value = sesion.table;
        sesionWavesInput.value = sesion.waves;
      });
      actions.appendChild(edit);

      const del = document.createElement("button");
      del.classList.add("delete-btn");
      del.textContent = "Eliminar";
      del.addEventListener("click", (e) => {
        sesionToDeleteId = sesion.id;
        resetEditingSesion();
        dataForm.reset();
        confirmationModal.style.display = "flex"; // Muestra el modal
      });
      actions.appendChild(del);
      row.appendChild(actions);
      tableBody.appendChild(row);
    });
  }

  // Función para cargar datos desde la API
  async function loadData() {
    loadingIndicator.classList.remove("hidden");
    try {
      const response = await fetchWithRetry(API_BASE_URL);
      const data = await response.json();
      renderTable(data);
    } catch (error) {
      console.error("Error al cargar los datos:", error);
      showMessage(statusMessage, `Error al cargar los datos: ${error.message}`);
    } finally {
      loadingIndicator.classList.add("hidden");
    }
  }

  // Manejar el envío del formulario (Agregar/Actualizar)
  dataForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const date = sesionDateInput.value;
    const place = sesionPlaceInput.value.trim();
    const table = sesionTableInput.value.trim();
    const waves = parseInt(sesionWavesInput.value);

    if (!date || !place || !table || isNaN(waves) || waves < 0) {
      showMessage(
        statusMessage,
        "Por favor, introduce una fecha, lugar, tabla y número de olas válidos.",
        "error",
      );
      return;
    }

    const sesionData = { date, place, table, waves };

    loadingIndicator.classList.remove("hidden");

    try {
      let response;
      if (editingSesionId) {
        // Actualizar elemento existente (PUT)
        response = await fetchWithRetry(`${API_BASE_URL}/${editingSesionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sesionData),
        });
        showMessage(statusMessage, "Sesion actualizada con éxito.", "success");
      } else {
        // Agregar nueva sesion (POST)
        response = await fetchWithRetry(API_BASE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sesionData),
        });
        showMessage(statusMessage, "Sesion agregada con éxito.", "success");
      }
      await response.json(); // Consumir la respuesta
      resetEditingSesion();
      dataForm.reset();
      loadData(); // Recargar datos después de la operación
    } catch (error) {
      console.error("Error al guardar la sesion:", error);
      showMessage(
        statusMessage,
        "Error al guardar la sesion: " + error.message,
      );
    } finally {
      loadingIndicator.classList.add("hidden");
    }
  });

  dataForm.addEventListener("reset", resetEditingSesion);

  // Lógica del modal de confirmación
  confirmDeleteBtn.addEventListener("click", async () => {
    confirmationModal.style.display = "none"; // Oculta el modal

    if (sesionToDeleteId) {
      loadingIndicator.classList.remove("hidden");
      try {
        const response = await fetchWithRetry(
          `${API_BASE_URL}/${sesionToDeleteId}`,
          {
            method: "DELETE",
          },
        );
        if (response.ok) {
          showMessage(statusMessage, "Sesion eliminada con éxito.", "success");
          loadData(); // Recargar datos después de eliminar
        } else {
          throw new Error("No se pudo eliminar la sesion.");
        }
      } catch (error) {
        console.error("Error al eliminar la sesion:", error);
        showMessage(
          statusMessage,
          "Error al eliminar la sesion: " + error.message,
        );
      } finally {
        loadingIndicator.classList.add("hidden");
        sesionToDeleteId = null; // Limpiar el ID después de la operación
      }
    }
  });

  cancelDeleteBtn.addEventListener("click", () => {
    confirmationModal.style.display = "none"; // Oculta el modal
    sesionToDeleteId = null; // Limpiar el ID
  });

  // Cargar los datos iniciales al cargar la página
  loadData();
});
