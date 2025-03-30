// deno-lint-ignore-file no-window no-window-prefix
// --- DOM Elements ---
const startCameraButton = document.getElementById("startCameraButton");
const cameraViewContainer = document.getElementById("cameraViewContainer");
const liveVideo = document.getElementById("liveVideo");
const captureButton = document.getElementById("captureButton");
const cropContainer = document.getElementById("cropContainer");
const imageToCrop = document.getElementById("imageToCrop");
const retakeButton = document.getElementById("retakeButton"); // New button
const cropButton = document.getElementById("cropButton");
const statusDiv = document.getElementById("status");
const resultDiv = document.getElementById("result");
const extractedTextP = document.getElementById("extractedText");
const extractedNumberP = document.getElementById("extractedNumber");
const dialLink = document.getElementById("dialLink"); // Keep ref, but hide

// --- Constants ---
// Not using USSD prefix/suffix in current implementation, but keep if needed
// const USSD_PREFIX = "*123*";
// const USSD_SUFFIX = "#"; // Will be encoded later

// --- State Variables ---
let cropper = null;
let currentStream = null; // To hold the MediaStream object

// --- Event Listeners ---

// 1. Start Camera Button
startCameraButton.addEventListener("click", startCamera);

// 2. Capture Button (takes photo from video stream)
captureButton.addEventListener("click", captureFrame);

// 3. Retake Button (discards capture, restarts camera)
retakeButton.addEventListener("click", handleRetake); // New listener

// 4. Crop Button (processes the cropped area)
cropButton.addEventListener("click", processCroppedImage);

// --- Core Functions ---

// Function to start the camera stream
async function startCamera() {
  resetUI(true); // Reset fully before starting camera
  statusDiv.textContent = "Requesting camera access...";
  startCameraButton.disabled = true; // Prevent double clicks

  try {
    const constraints = {
      video: {
        facingMode: "environment",
        // Optional: Add resolution constraints if needed
        // width: { ideal: 1920 },
        // height: { ideal: 1080 }
      },
      audio: false,
    };

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia is not supported by this browser.");
    }

    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    liveVideo.srcObject = currentStream;

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
    // Only re-enable start button if it's visible (i.e., camera failed to start)
    if (startCameraButton.style.display !== "none") {
      startCameraButton.disabled = false;
    }
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

  const canvas = document.createElement("canvas");
  canvas.width = liveVideo.videoWidth;
  canvas.height = liveVideo.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(liveVideo, 0, 0, canvas.width, canvas.height);

  stopCameraStream();

  const imageDataUrl = canvas.toDataURL("image/jpeg", 0.9);

  imageToCrop.src = imageDataUrl;
  cropContainer.style.display = "block";

  cameraViewContainer.style.display = "none";
  captureButton.style.display = "none";
  captureButton.disabled = false; // Re-enable for next time

  statusDiv.textContent = "Image captured. Select area to scan or retake.";

  if (cropper) {
    cropper.destroy();
  }
  cropper = new Cropper(imageToCrop, {
    aspectRatio: NaN,
    viewMode: 1,
    dragMode: "crop",
    background: false,
    autoCropArea: 0.8,
    responsive: true,
  });

  retakeButton.style.display = "inline-block"; // Show Retake button
  cropButton.style.display = "inline-block"; // Show Crop button
}

// Function to handle Retake button click
function handleRetake() {
  console.log("Retake requested");
  // No need to reset fully, just go back to camera mode
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
  imageToCrop.src = "#"; // Clear image source
  cropContainer.style.display = "none";
  retakeButton.style.display = "none";
  cropButton.style.display = "none";
  resultDiv.style.display = "none"; // Hide previous results if any

  // Restart the camera
  startCamera();
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
  retakeButton.disabled = true; // Disable retake during processing

  const croppedCanvas = cropper.getCroppedCanvas({
    // maxWidth: 1024, maxHeight: 1024 // Optional constraints
  });

  // Hide Cropper UI immediately after getting canvas
  cropContainer.style.display = "none";
  cropButton.style.display = "none";
  retakeButton.style.display = "none"; // Hide retake button too
  cropButton.disabled = false; // Re-enable for future use
  retakeButton.disabled = false; // Re-enable for future use

  if (cropper) {
    cropper.destroy();
    cropper = null;
  }

  // Send cropped canvas to Tesseract
  recognizeText(croppedCanvas);
}

// --- Tesseract Function (Modified for Auto-Dial) ---
async function recognizeText(imageSource) {
  try {
    statusDiv.textContent =
      "Starting OCR on selected area (this may take a moment)...";
    resultDiv.style.display = "none"; // Hide result area initially
    extractedTextP.textContent = ""; // Clear previous results
    extractedNumberP.textContent = ""; // Clear previous results
    dialLink.style.display = "none"; // Ensure dial link is hidden

    const { data: { text } } = await Tesseract.recognize(
      imageSource,
      "eng", // Use 'eng' for English numbers
      {
        logger: (m) => {
          console.log(m);
          if (m.status === "recognizing text") {
            statusDiv.textContent = `Recognizing: ${
              Math.round(m.progress * 100)
            }%`;
          }
        },
        // Add whitelist for digits and common USSD characters if helpful
        // BUT BE CAREFUL: this might exclude valid variations
        // tessedit_char_whitelist: '0123456789*#',
      },
    );

    statusDiv.textContent = "OCR Complete.";
    // Basic cleaning: remove spaces, newlines, common OCR errors like 'O' for '0'
    const cleanedText = text.replace(/\s+/g, "") // Remove all whitespace
      .replace(/O/gi, "0"); // Replace O/o with 0 (common OCR issue)

    extractedTextP.textContent = `Raw Text from Area: ${text}`; // Show original raw

    // More robust number extraction (adjust regex as needed)
    // This example looks for a sequence of 5 or more digits, potentially with * or #
    const numberMatch = cleanedText.match(/[*#\d]{5,}/); // Find sequences of digits, *, # (at least 5 chars long)
    const extractedNumber = numberMatch ? numberMatch[0] : null;

    if (extractedNumber) {
      extractedNumberP.textContent = `Extracted Number: ${extractedNumber}`;
      resultDiv.style.display = "block"; // Show the result area
      statusDiv.textContent =
        `Number found! Attempting to dial: ${extractedNumber}`;

      // --- Auto-Dial ---
      console.log(`Attempting to dial: tel:${extractedNumber}`);
      // Small delay can sometimes help ensure UI updates before navigation
      setTimeout(() => {
        window.location.href = `tel:${extractedNumber}`;
      }, 100); // 100ms delay
    } else {
      extractedNumberP.textContent =
        "Could not extract a suitable number from the selected area.";
      resultDiv.style.display = "block"; // Show the result area (with the failure message)
      statusDiv.textContent =
        "OCR finished, but no suitable number sequence found.";
    }
  } catch (error) {
    console.error("OCR Error:", error);
    statusDiv.textContent = "Error during OCR processing. Please try again.";
    resultDiv.style.display = "none";
  } finally {
    // Show the start button again after processing is complete or failed
    startCameraButton.style.display = "inline-block";
    startCameraButton.disabled = false;
    // Ensure other intermediate buttons remain hidden
    captureButton.style.display = "none";
    cropButton.style.display = "none";
    retakeButton.style.display = "none";
    cropContainer.style.display = "none";
    // Don't hide resultDiv here, it's handled within try/catch
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
  retakeButton.style.display = "none"; // Hide retake button
  cropButton.style.display = "none";
  resultDiv.style.display = "none";

  // Reset image sources/text
  imageToCrop.src = "#";
  extractedTextP.textContent = "";
  extractedNumberP.textContent = "";
  dialLink.href = "#"; // Reset href
  dialLink.style.display = "none"; // Ensure hidden

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
// Attempt to stop the stream if the user navigates away or hides the tab
window.addEventListener("pagehide", stopCameraStream);
window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    // Consider stopping the stream to save resources, especially on mobile
    // stopCameraStream(); // Uncomment if desired, but test UX
  }
});

// Initial UI state on load
resetUI(false);
