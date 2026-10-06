(() => {
  const MODEL_URL = "./Modelo/model.json";
  const METADATA_URL = "./Modelo/metadata.json";

  const imageInput = document.getElementById("image-input");
  const imagePreview = document.getElementById("image-preview");
  const placeholder = document.getElementById("placeholder");
  const webcamContainer = document.getElementById("webcam-container");
  const startCameraButton = document.getElementById("start-camera");
  const stopCameraButton = document.getElementById("stop-camera");
  const status = document.getElementById("status");
  const predictions = document.getElementById("predictions");

  let model;
  let modelPromise;
  let webcam;
  let animationFrame;
  let imageUrl;
  let predictionRun = 0;

  function setStatus(message, state = "") {
    status.textContent = message;
    status.dataset.state = state;
  }

  function showMedia(kind) {
    placeholder.hidden = true;
    imagePreview.hidden = kind !== "image";
    webcamContainer.hidden = kind !== "camera";
  }

  function loadModel() {
    if (model) return Promise.resolve(model);
    if (!modelPromise) {
      setStatus("Cargando el modelo…");
      modelPromise = tmImage.load(MODEL_URL, METADATA_URL)
        .then((loadedModel) => {
          model = loadedModel;
          return model;
        })
        .catch((error) => {
          modelPromise = undefined;
          throw error;
        });
    }
    return modelPromise;
  }

  function showPredictions(results) {
    const sortedResults = [...results].sort((a, b) => b.probability - a.probability);
    predictions.replaceChildren();

    for (const [index, result] of sortedResults.entries()) {
      const probability = Math.max(0, Math.min(1, result.probability));
      const row = document.createElement("div");
      row.className = `prediction${index === 0 ? " prediction-top" : ""}`;

      const label = document.createElement("div");
      label.className = "prediction-label";
      const name = document.createElement("span");
      name.textContent = result.className;
      const value = document.createElement("span");
      value.className = "prediction-value";
      value.textContent = `${Math.round(probability * 100)}%`;
      label.append(name, value);

      const track = document.createElement("div");
      track.className = "prediction-track";
      const bar = document.createElement("div");
      bar.className = "prediction-bar";
      bar.style.width = `${probability * 100}%`;
      track.append(bar);

      row.append(label, track);
      predictions.append(row);
    }

    const best = sortedResults[0];
    if (best) {
      setStatus(`Predicción principal: ${best.className}`, "success");
    }
  }

  async function classifyImage(image) {
    stopCamera();
    const run = ++predictionRun;
    showMedia("image");
    setStatus("Analizando imagen…");
    try {
      const loadedModel = await loadModel();
      const results = await loadedModel.predict(image);
      if (run === predictionRun) showPredictions(results);
    } catch (error) {
      if (run === predictionRun) {
        setStatus(`No se pudo clasificar la imagen: ${error.message}`, "error");
      }
      console.error("Error al clasificar la imagen:", error);
    }
  }

  function stopCamera() {
    predictionRun += 1;
    if (animationFrame !== undefined) {
      cancelAnimationFrame(animationFrame);
      animationFrame = undefined;
    }
    if (webcam) {
      webcam.stop();
      webcam = undefined;
    }
    webcamContainer.replaceChildren();
    webcamContainer.hidden = true;
    stopCameraButton.hidden = true;
    startCameraButton.hidden = false;
  }

  async function predictFromCamera(run) {
    if (!webcam || run !== predictionRun) return;
    webcam.update();
    try {
      const results = await model.predict(webcam.canvas);
      if (run !== predictionRun) return;
      showPredictions(results);
      animationFrame = requestAnimationFrame(() => predictFromCamera(run));
    } catch (error) {
      if (run === predictionRun) {
        setStatus(`No se pudo analizar la cámara: ${error.message}`, "error");
        stopCamera();
      }
      console.error("Error al analizar la cámara:", error);
    }
  }

  async function startCamera() {
    stopCamera();
    const run = ++predictionRun;
    setStatus("Preparando la cámara…");
    startCameraButton.disabled = true;
    try {
      const loadedModel = await loadModel();
      if (run !== predictionRun) return;
      webcam = new tmImage.Webcam(320, 240, true);
      await webcam.setup();
      if (run !== predictionRun) {
        webcam.stop();
        webcam = undefined;
        return;
      }
      await webcam.play();
      if (run !== predictionRun) {
        webcam.stop();
        webcam = undefined;
        return;
      }
      model = loadedModel;
      showMedia("camera");
      webcamContainer.append(webcam.canvas);
      startCameraButton.hidden = true;
      stopCameraButton.hidden = false;
      setStatus("Cámara activa. Apunta a un objeto para clasificarlo.");
      animationFrame = requestAnimationFrame(() => predictFromCamera(run));
    } catch (error) {
      if (run === predictionRun) {
        setStatus(`No se pudo iniciar la cámara: ${error.message}`, "error");
      }
      console.error("Error al iniciar la cámara:", error);
      if (webcam) {
        webcam.stop();
        webcam = undefined;
      }
    } finally {
      startCameraButton.disabled = false;
    }
  }

  imageInput.addEventListener("change", () => {
    const file = imageInput.files && imageInput.files[0];
    if (!file) return;
    imageInput.value = "";
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = URL.createObjectURL(file);
    imagePreview.onload = () => classifyImage(imagePreview);
    imagePreview.onerror = () => {
      setStatus("No se pudo abrir este archivo como imagen.", "error");
      console.error("No se pudo cargar el archivo de imagen seleccionado.");
    };
    imagePreview.src = imageUrl;
  });

  startCameraButton.addEventListener("click", startCamera);
  stopCameraButton.addEventListener("click", () => {
    stopCamera();
    placeholder.hidden = false;
    setStatus("Cámara detenida. Elige una imagen o vuelve a iniciar la cámara.");
  });

  window.addEventListener("beforeunload", () => {
    stopCamera();
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  });
})();