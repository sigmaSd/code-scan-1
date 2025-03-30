// --- DOM Elements ---
const startCameraButton = document.getElementById("startCameraButton");
const cameraViewContainer = document.getElementById("cameraViewContainer");
const liveVideo = document.getElementById("liveVideo");
const captureButton = document.getElementById("captureButton");
const cropContainer = document.getElementById("cropContainer");
const imageToCrop = document.getElementById("imageToCrop");
const cropButton = document.getElementById("cropButton");
const statusDiv = document.getElementById("status");
const resultDiv = document.getElementById("result");
const extractedTextP = document.getElementById("extractedText");
const extractedNumberP = document.getElementById("extractedNumber");
const dialLink = document.getElementById("dialLink");

// --- Constants ---
const USSD_PREFIX = "*123*";
const USSD_SUFFIX = "#"; // Will be encoded later

// --- State Variables ---
let cropper = null;
let currentStream = null; // To hold the MediaStream object

// --- Event Listeners ---

// 1. Start Camera Button
startCameraButton.addEventListener("click", startCamera);

// 2. Capture Button (takes photo from video stream)
captureButton.addEventListener("click", captureFrame);

// 3. Crop Button (processes the cropped area)
cropButton.addEventListener("click", processCroppedImage);

// --- Core Functions ---

// Function to start the camera stream
async function startCamera() {
  resetUI(true); // Reset fully before starting camera
  statusDiv.textContent = "Requesting camera access...";
  startCameraButton.disabled = true; // Prevent double clicks

  try {
    // Prefer the back camera ('environment')
    const constraints = {
      video: {
        facingMode: "environment",
        // Optional: Add resolution constraints if needed, but be careful
        // width: { ideal: 1280 },
        // height: { ideal: 720 }
      },
      audio: false,
    };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia is not supported by this browser.");
    }

    currentStream = await navigator.mediaDevices.getUserMedia(constraints);

    liveVideo.srcObject = currentStream;
    // Wait for video metadata to load to get dimensions if needed (often not strictly necessary here)
    // liveVideo.onloadedmetadata = () => { console.log('Video metadata loaded'); };

    // Update UI
    cameraViewContainer.style.display = "block";
    captureButton.style.display = "inline-block";
    startCameraButton.style.display = "none"; // Hide the start button
    statusDiv.textContent = "Camera active. Point at the number and capture.";
  } catch (err) {
    console.error("Error accessing camera:", err);
    let message = "Could not access camera. ";
    if (err.name === "NotAllowedError") {
      message += "Permission denied.";
    } else if (
      err.name === "NotFoundError" || err.name === "DevicesNotFoundError"
    ) {
      message += "No suitable camera found.";
    } else if (err.name === "NotReadableError") {
      message += "Camera might be in use by another app.";
    } else {
      message += `Error: ${err.message}`;
    }
    statusDiv.textContent = message;
    resetUI(false); // Reset but keep the start button visible/enabled
  } finally {
    startCameraButton.disabled = false;
  }
}

// Function to capture a frame from the video stream
function captureFrame() {
  if (!currentStream || !liveVideo.srcObject) {
    statusDiv.textContent = "Camera stream not available.";
    return;
  }

  statusDiv.textContent = "Capturing...";
  captureButton.disabled = true; // Prevent double clicks

  // Create a canvas to draw the frame onto
  const canvas = document.createElement("canvas");
  canvas.width = liveVideo.videoWidth; // Use actual video dimensions
  canvas.height = liveVideo.videoHeight;
  const ctx = canvas.getContext("2d");

  // Draw the current video frame to the canvas
  ctx.drawImage(liveVideo, 0, 0, canvas.width, canvas.height);

  // Stop the camera stream
  stopCameraStream();

  // Get the image data from the canvas
  const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9); // Use JPEG for potentially smaller size

  // Prepare for cropping
  imageToCrop.src = imageDataUrl;
  cropContainer.style.display = "block"; // Show cropping area

  // Hide camera view
  cameraViewContainer.style.display = "none";
  captureButton.style.display = "none";
  captureButton.disabled = false; // Re-enable for next time

  statusDiv.textContent = "Image captured. Select area to scan.";

  // Initialize Cropper.js
  if (cropper) {
    cropper.destroy(); // Destroy previous instance if any
  }
  cropper = new Cropper(imageToCrop, {
    aspectRatio: NaN,
    viewMode: 1,
    dragMode: "crop",
    background: false,
    autoCropArea: 0.8,
    responsive: true,
    // No need for checkOrientation here as we captured directly
  });

  cropButton.style.display = "inline-block"; // Show the crop button
}

// Function to process the cropped image
function processCroppedImage() {
  if (!cropper) {
    console.error("Cropper not initialized!");
    statusDiv.textContent = "Error: Cropper not ready.";
    return;
  }

  statusDiv.textContent = "Processing cropped area...";
  cropButton.disabled = true; // Prevent double clicks

  const croppedCanvas = cropper.getCroppedCanvas({
    // maxWidth: 1024, maxHeight: 1024 // Optional constraints
  });

  // Hide Cropper UI
  cropContainer.style.display = "none";
  cropButton.style.display = "none";
  cropButton.disabled = false; // Re-enable
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }

  // Send cropped canvas to Tesseract
  recognizeText(croppedCanvas);
}

// --- Tesseract Function (Mostly Unchanged) ---
async function recognizeText(imageSource) {
  try {
    statusDiv.textContent =
      "Starting OCR on selected area (this may take a moment)...";
    resultDiv.style.display = "none";

    const { data: { text } } = await Tesseract.recognize(
      imageSource,
      "eng",
      {
        logger: (m) => {
          console.log(m);
          if (m.status === "recognizing text") {
            statusDiv.textContent = `Recognizing: ${
              Math.round(m.progress * 100)
            }%`;
          }
        },
      },
    );

    statusDiv.textContent = "OCR Complete.";
    extractedTextP.textContent = `Raw Text from Area: ${text}`;

    const extractedNumber = text.replaceAll(/\s+/g, "");

    if (extractedNumber) {
      dialLink.href = `tel:${extractedNumber}`;
      resultDiv.style.display = "block";
      statusDiv.textContent = "Number found in selected area!";
    } else {
      extractedNumberP.textContent =
        "Could not extract a suitable number from the selected area.";
      resultDiv.style.display = "block";
      dialLink.href = "#";
      statusDiv.textContent = "OCR finished, but no number found in the area.";
    }
  } catch (error) {
    console.error("OCR Error:", error);
    statusDiv.textContent = "Error during OCR processing. Please try again.";
    resultDiv.style.display = "none";
  } finally {
    // Show the start button again after processing is complete or failed
    startCameraButton.style.display = "inline-block";
    startCameraButton.disabled = false;
    // Ensure other intermediate buttons are hidden
    captureButton.style.display = "none";
    cropButton.style.display = "none";
    cropContainer.style.display = "none";
  }
}

// --- Utility Functions ---

// Function to stop the current camera stream
function stopCameraStream() {
  if (currentStream) {
    currentStream.getTracks().forEach((track) => track.stop());
    liveVideo.srcObject = null;
    currentStream = null;
    console.log("Camera stream stopped.");
  }
}

// Function to reset the UI to its initial or intermediate state
function resetUI(isStartingCamera = false) {
  stopCameraStream(); // Always stop stream on reset

  if (cropper) {
    cropper.destroy();
    cropper = null;
  }

  // Hide dynamic elements
  cameraViewContainer.style.display = "none";
  captureButton.style.display = "none";
  cropContainer.style.display = "none";
  cropButton.style.display = "none";
  resultDiv.style.display = "none";

  // Reset image sources/text
  imageToCrop.src = "#";
  extractedTextP.textContent = "";
  extractedNumberP.textContent = "";
  dialLink.href = "#";

  // Show the initial button unless we are in the process of starting the camera
  if (!isStartingCamera) {
    startCameraButton.style.display = "inline-block";
    startCameraButton.disabled = false;
    statusDiv.textContent = "Click 'Open Camera' to start.";
  } else {
    startCameraButton.style.display = "none"; // Hide if starting
  }
}

// --- Cleanup ---
// Attempt to stop the stream if the user navigates away
window.addEventListener("pagehide", stopCameraStream);
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    // Optional: You might want to stop the stream immediately when hidden,
    // but this could be annoying if the user quickly switches apps.
    // Consider the UX implications.
    // stopCameraStream();
  } else {
    // Optional: If stopped when hidden, you might need logic
    // to restart or prompt the user upon returning.
  }
});

// Initial UI state on load
resetUI(false);
