document.addEventListener("DOMContentLoaded", () => {
  const messageInput = document.getElementById("message");
  const effectSelect = document.getElementById("effect");
  const speedSelect = document.getElementById("speed");
  const invertCheck = document.getElementById("invert");
  const flashCheck = document.getElementById("flash");
  const marqueeCheck = document.getElementById("marquee");
  const sendBtn = document.getElementById("send-btn");
  const statusDiv = document.getElementById("status");
  const ledMatrix = document.getElementById("led-matrix");
  const fontSelect = document.getElementById("font-family");
  const iconPicker = document.getElementById("icon-picker");
  const speedSlider = document.getElementById("speedSlider");
  const speedDisplay = document.getElementById("speed-display");

  // Animation state
  let animationInterval = null;
  let currentBoolArray = null;
  let scrollOffset = 0;

  // Tab Setup
  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(btn.dataset.tab).classList.add("active");
    });
  });

  // Visual Select Grids (Transition & Animation)
  // Both control the exact same "effect/mode" value under the hood
  const visualSelectBtns = document.querySelectorAll(".visual-select-btn");
  visualSelectBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      // Clear active from ALL visual select buttons across both grids
      visualSelectBtns.forEach((b) => b.classList.remove("active"));

      btn.classList.add("active");
      effectSelect.value = btn.dataset.value;
      generateDataChunk();
    });
  });

  // Visual Effect Toggles (Flash, Marquee, Invert)
  const visualEffectBtns = document.querySelectorAll(".visual-effect-btn");
  visualEffectBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const effectName = btn.dataset.effect;
      const checkbox = document.getElementById(effectName);
      if (checkbox) {
        checkbox.checked = !checkbox.checked;
        if (checkbox.checked) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
        generateDataChunk();
      }
    });
  });

  window.svgsHexCache = {};

  // SVG Cache & Canvas for rendering
  const svgsHexCache = {};
  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = 44; // Give it max badge width
  renderCanvas.height = 11; // Badge height
  const ctx = renderCanvas.getContext("2d", { willReadFrequently: true });
  // High-res canvas for block-based sampling (each LED = one block; keeps shapes recognizable)
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
  const BLOCK = 4; // each LED = BLOCK×BLOCK pixels; 11 rows × BLOCK = 44px render height

  // Removed duplicate Tab Setup that was causing SyntaxError

  // LED Grid Setup - 11 rows by 44 columns
  const ROWS = 11;
  const COLS = 44;
  const pixels = [];

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const pixel = document.createElement("div");
      pixel.className = "led-pixel";
      ledMatrix.appendChild(pixel);
      pixels.push(pixel);
    }
  }

  // Speed Dial Logic
  function updateSpeedDial() {
    const val = parseInt(speedSlider.value, 10);
    speedDisplay.textContent = val;

    // Mirror to hidden select
    const speedMapping = [0, 16, 32, 48, 64, 80, 96, 112];
    speedSelect.value = speedMapping[val - 1];

    // Regenerate data
    generateDataChunk();
  }

  speedSlider.addEventListener("input", updateSpeedDial);

  const SERVICE_UUID = "0000fee0-0000-1000-8000-00805f9b34fb";
  const CHARACTERISTIC_UUID = "0000fee1-0000-1000-8000-00805f9b34fb";
  const MAX_MESSAGES = 8;
  const PACKET_STARTHex = "77616E670000";

  // Initialize Speed Dial
  updateSpeedDial();

  // Hidden canvas for font rendering
  const fontCanvas = document.createElement("canvas");
  fontCanvas.height = 11;
  const fontCtx = fontCanvas.getContext("2d", { willReadFrequently: true });

  function toHex(num, padding = 2) {
    return num.toString(16).padStart(padding, "0").toUpperCase();
  }

  function setStatus(msg, type = "info") {
    statusDiv.textContent = msg;
    statusDiv.className = `status-message status-${type}`;
  }

  async function connectAndSend() {
    try {
      if (!navigator.bluetooth) {
        throw new Error("Web Bluetooth is not supported in this browser.");
      }

      setStatus("Requesting Bluetooth Device...", "info");
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "LSLED" }, { services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID],
      });

      setStatus(`Connecting to ${device.name}...`, "info");
      device.addEventListener("gattserverdisconnected", () => {
        setStatus("Device disconnected", "info");
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      const characteristic =
        await service.getCharacteristic(CHARACTERISTIC_UUID);

      setStatus("Generating payload...", "info");
      const dataChunks = generateDataChunk();

      setStatus("Sending data to badge...", "info");
      for (let i = 0; i < dataChunks.length; i++) {
        // Many BLE devices drop packets if written without response
        if (typeof characteristic.writeValueWithResponse === "function") {
          await characteristic
            .writeValueWithResponse(dataChunks[i])
            .catch(async (e) => {
              // Fallback just in case
              await characteristic.writeValue(dataChunks[i]);
            });
        } else {
          await characteristic.writeValue(dataChunks[i]);
        }
        await new Promise((resolve) => setTimeout(resolve, 50)); // 50ms delay between chunks
      }

      setStatus("Successfully updated Badge!", "success");
      setTimeout(() => {
        if (device.gatt.connected) {
          device.gatt.disconnect();
        }
      }, 1000);
    } catch (error) {
      console.error(error);
      setStatus(`Error: ${error.message}`, "error");
    }
  }

  function generateDataChunk() {
    const textStr = (messageInput.value || "HELLO WORLD").trim();
    const isFlash = flashCheck.checked;
    const isMarquee = marqueeCheck.checked;
    const speedVal = parseInt(speedSelect.value, 10);
    const effectVal = parseInt(effectSelect.value, 10);

    const selectedFont = fontSelect.value;

    // Convert string characters to Hex
    // Bit-packing row by row to ensure zero-gap kerning
    const rows = Array.from({ length: 11 }, () => []);

    const appendBitsToRows = (bitsMatrix) => {
      // bitsMatrix is an array of 11 arrays (one per row)
      for (let r = 0; r < 11; r++) {
        rows[r].push(...bitsMatrix[r]);
      }
    };

    const hexToBitsMatrix = (hex) => {
      const matrix = Array.from({ length: 11 }, () => []);
      // Icons can be multiple 11-byte blocks (8 cols per block); decode all blocks so right column is not cut off
      const numBlocks = hex.length / 22;
      for (let r = 0; r < 11; r++) {
        for (let block = 0; block < numBlocks; block++) {
          const byteIdx = block * 11 + r;
          const byteHex = hex.substring(byteIdx * 2, byteIdx * 2 + 2);
          const byteVal = parseInt(byteHex, 16);
          for (let b = 7; b >= 0; b--) {
            matrix[r].push(((byteVal >> b) & 1) === 1);
          }
        }
      }
      return matrix;
    };

    let i = 0;
    while (i < textStr.length) {
      if (textStr.slice(i, i + 2) === "<<") {
        const endIdx = textStr.indexOf(">>", i + 2);
        if (endIdx !== -1) {
          const iconName = textStr.slice(i + 2, endIdx);
          if (window.svgsHexCache[iconName]) {
            appendBitsToRows(hexToBitsMatrix(window.svgsHexCache[iconName]));
            i = endIdx + 2;
            continue;
          }
        }
      }

      // Handle text segment
      let nextIconIdx = textStr.indexOf("<<", i);
      let textSegment =
        nextIconIdx === -1 ? textStr.slice(i) : textStr.slice(i, nextIconIdx);

      if (textSegment.length > 0) {
        if (selectedFont === "default") {
          for (const char of textSegment) {
            let charHex = window.FONT_ROM[char];
            if (!charHex && char.match(/[a-zA-Z]/)) {
              charHex =
                window.FONT_ROM[char.toUpperCase()] || window.FONT_ROM["?"];
            } else if (!charHex) {
              charHex =
                char === " " ? window.FONT_ROM[" "] : window.FONT_ROM["?"];
            }
            appendBitsToRows(hexToBitsMatrix(charHex));
          }
        } else {
          // Custom font: render entire segment for natural kerning
          appendBitsToRows(renderTextToBitsMatrix(textSegment, selectedFont));
        }
      }
      i += textSegment.length;
    }

    // Convert packed bits back to messageHex (8-bit chunks)
    let messageHex = "";
    const totalCols = rows[0].length;
    const numSlots = Math.ceil(totalCols / 8);

    for (let s = 0; s < numSlots; s++) {
      for (let r = 0; r < 11; r++) {
        let byteVal = 0;
        for (let b = 0; b < 8; b++) {
          const colIdx = s * 8 + b;
          if (colIdx < totalCols && rows[r][colIdx]) {
            byteVal |= 1 << (7 - b);
          }
        }
        messageHex += byteVal.toString(16).padStart(2, "0").toUpperCase();
      }
    }

    const charCount = numSlots; // Each 11-byte slot is a "character" in protocol terms

    // Handle Invert logic on the hexadecimal string
    if (invertCheck && invertCheck.checked) {
      let invertedHex = "";
      for (let i = 0; i < messageHex.length; i++) {
        const charCode = parseInt(messageHex[i], 16);
        const invertedChar = (~charCode & 0xf).toString(16).toUpperCase();
        invertedHex += invertedChar;
      }
      messageHex = invertedHex;
    }

    // Update live preview based on the generated messageHex
    updateLedPreview(messageHex);

    // 1. Flash (1 byte)
    const flashHex = toHex(isFlash ? 1 : 0);

    // 2. Marquee (1 byte)
    const marqueeHex = toHex(isMarquee ? 1 : 0);

    // 3. Options (8 bytes: 1 byte per message)
    const optionsByte = speedVal | effectVal;
    let optionsHex = toHex(optionsByte);
    optionsHex = optionsHex.padEnd(8 * 2, "0");

    // 4. Sizes (16 bytes: 2 bytes per message)
    // number of 11-byte segments (characters)
    let sizesHex = toHex((charCount >> 8) & 0xff) + toHex(charCount & 0xff);
    sizesHex = sizesHex.padEnd(16 * 2, "0");

    // 5. Zeroes (6 bytes)
    const zeros6 = "000000000000";

    // 6. Timestamp (6 bytes)
    const now = new Date();
    // Dart explicitly accesses now.month (1-indexed) and then adds 1
    const year = now.getFullYear() & 0xff;
    const month = (now.getMonth() + 2) & 0xff;
    const day = now.getDate() & 0xff;
    const hour = now.getHours() & 0xff;
    const minute = now.getMinutes() & 0xff;
    const second = now.getSeconds() & 0xff;
    const timeHex =
      toHex(year) +
      toHex(month) +
      toHex(day) +
      toHex(hour) +
      toHex(minute) +
      toHex(second);

    // 7. Zeroes (20 bytes)
    const zeros20 = "00".repeat(20);

    let finalHex =
      PACKET_STARTHex +
      flashHex +
      marqueeHex +
      optionsHex +
      sizesHex +
      zeros6 +
      timeHex +
      zeros20 +
      messageHex;

    // Pad to multiple of 16 bytes (32 hex chars)
    const length = finalHex.length;
    const paddingNeededHexChars = (Math.floor(length / 32) + 1) * 32 - length;
    finalHex += "0".repeat(paddingNeededHexChars);

    // Split into chunks of 16 bytes (32 hex chars)
    const chunks = [];
    for (let i = 0; i < finalHex.length; i += 32) {
      const hexChunk = finalHex.substring(i, i + 32);
      const byteArr = new Uint8Array(16);
      for (let j = 0; j < 16; j++) {
        byteArr[j] = parseInt(hexChunk.substring(j * 2, j * 2 + 2), 16);
      }
      chunks.push(byteArr);
    }

    return chunks;
  }

  function updateLedPreview(hexString) {
    // Clear the grid and any existing animation
    if (animationInterval) {
      clearInterval(animationInterval);
      animationInterval = null;
    }
    pixels.forEach((p) => p.classList.remove("on"));

    if (!hexString) return;

    // Convert hex string to binary array mapping (row-based)
    let boolArray = Array.from({ length: 11 }, () => []);
    let rowIndex = 0;
    for (let i = 0; i < hexString.length; i += 2) {
      const byteVal = parseInt(hexString.substring(i, i + 2), 16);
      for (let bit = 7; bit >= 0; bit--) {
        boolArray[rowIndex].push(((byteVal >> bit) & 1) === 1);
      }
      rowIndex = (rowIndex + 1) % 11;
    }

    // Append a significant gap (88 columns) to ensure it clears the screen visibly
    for (let r = 0; r < 11; r++) {
      for (let g = 0; g < 88; g++) {
        boolArray[r].push(false);
      }
    }

    currentBoolArray = boolArray;
    scrollOffset = 0;
    startScrollingAnimation();
  }

  function renderFrame(offset) {
    pixels.forEach((p) => p.classList.remove("on"));
    const effectVal = parseInt(effectSelect.value, 10);
    const isFlash = flashCheck.checked;
    const isMarquee = marqueeCheck.checked;

    // 1. Handle Flash Effect (blink on even offsets)
    if (isFlash && Math.floor(offset / 4) % 2 === 0) {
      return;
    }

    const totalLength = currentBoolArray[0].length;
    const msgLength = totalLength - 88;

    // Create a temporary 11x44 grid buffer
    const buffer = Array.from({ length: 11 }, () => Array(44).fill(false));

    // Fill buffer based on effectVal
    if (effectVal === 0) {
      // Left
      for (let r = 0; r < 11; r++) {
        for (let c = 0; c < 44; c++) {
          const sourceC = (c + offset) % totalLength;
          buffer[r][c] = currentBoolArray[r][sourceC];
        }
      }
    } else if (effectVal === 1) {
      // Right
      for (let r = 0; r < 11; r++) {
        for (let c = 0; c < 44; c++) {
          const sourceC =
            (totalLength + c - (offset % totalLength)) % totalLength;
          buffer[r][c] = currentBoolArray[r][sourceC];
        }
      }
    } else if (effectVal === 2) {
      // Up
      for (let r = 0; r < 11; r++) {
        for (let c = 0; c < 44; c++) {
          const sourceR = (r + offset) % 11;
          if (c < msgLength) buffer[r][c] = currentBoolArray[sourceR][c];
        }
      }
    } else if (effectVal === 3) {
      // Down
      for (let r = 0; r < 11; r++) {
        for (let c = 0; c < 44; c++) {
          const sourceR = (11 + r - (offset % 11)) % 11;
          if (c < msgLength) buffer[r][c] = currentBoolArray[sourceR][c];
        }
      }
    } else if (effectVal === 6) {
      // Snowflake
      const totalSnowLen = 11 * 16;
      const frame = offset % totalSnowLen;
      const horizontalOffset = Math.floor((44 - msgLength) / 2);
      if (frame < 11 * 4) {
        // Phase 1: Falling in
        for (let r = 10; r >= 0; r--) {
          let fallPos = frame - (10 - r) * 2;
          if (fallPos > r) fallPos = r;
          if (fallPos >= 0 && fallPos < 11) {
            for (let c = 0; c < 44; c++) {
              const sourceC = c - horizontalOffset;
              if (sourceC >= 0 && sourceC < msgLength) {
                buffer[fallPos][c] = currentBoolArray[r][sourceC];
              }
            }
          }
        }
      } else if (frame < 11 * 8) {
        // Phase 2: Falling out
        for (let r = 10; r >= 0; r--) {
          const outStart = (10 - r) * 2;
          const outPos = r + (frame - 44 - outStart);
          if (outPos < r) {
            for (let c = 0; c < 44; c++) {
              const sourceC = c - horizontalOffset;
              if (sourceC >= 0 && sourceC < msgLength)
                buffer[r][c] = currentBoolArray[r][sourceC];
            }
          }
          if (outPos >= r && outPos < 11) {
            for (let c = 0; c < 44; c++) {
              const sourceC = c - horizontalOffset;
              if (sourceC >= 0 && sourceC < msgLength)
                buffer[outPos][c] = currentBoolArray[r][sourceC];
            }
          }
        }
      } else {
        // Static
        for (let r = 0; r < 11; r++) {
          for (let c = 0; c < 44; c++) {
            const sourceC = c - horizontalOffset;
            if (sourceC >= 0 && sourceC < msgLength)
              buffer[r][c] = currentBoolArray[r][sourceC];
          }
        }
      }
    } else if (effectVal === 7) {
      // Picture (Curtain)
      const frame = offset % 44;
      const scanPos = frame % 22;
      const leftPos = 21 - scanPos;
      const rightPos = 22 + scanPos;
      const horizontalOffset = Math.floor((44 - msgLength) / 2);
      const firstHalf = frame < 22;
      for (let r = 0; r < 11; r++) {
        for (let c = 0; c < 44; c++) {
          const sourceC = c - horizontalOffset;
          const isWithin = sourceC >= 0 && sourceC < msgLength;
          if (c === leftPos || c === rightPos) {
            buffer[r][c] = true;
          } else if (firstHalf) {
            if (isWithin && c > leftPos && c < rightPos)
              buffer[r][c] = currentBoolArray[r][sourceC];
          } else {
            if (isWithin && (c < leftPos || c > rightPos))
              buffer[r][c] = currentBoolArray[r][sourceC];
          }
        }
      }
    } else if (effectVal === 8) {
      // Laser (Matches Flutter's ani_laser.dart)
      const framesCount = Math.ceil(msgLength / 44) || 1;
      const currentFrame = Math.floor(offset / 88) % framesCount;
      const startCol = currentFrame * 44;
      const frameIndex = offset % 88;
      const firstHalf = frameIndex < 44;
      const index = frameIndex % 44;
      const horizontalOffset =
        msgLength < 44 ? Math.floor((44 - msgLength) / 2) : 0;

      for (let r = 0; r < 11; r++) {
        const sourceRowChar = r;
        const sourceColChar = startCol + index - horizontalOffset;
        const isCharPixelOn =
          sourceColChar >= 0 && sourceColChar < msgLength
            ? currentBoolArray[r][sourceColChar]
            : false;

        if (firstHalf) {
          // 1. Draw horizontal laser line to the right if character pixel is on
          if (isCharPixelOn) {
            for (let c = index; c < 44; c++) {
              buffer[r][c] = true;
            }
          }
          // 2. Persist character content to the left of the laser
          for (let c = 0; c < index; c++) {
            const sc = startCol + c - horizontalOffset;
            if (sc >= 0 && sc < msgLength) {
              buffer[r][c] = currentBoolArray[r][sc];
            }
          }
        } else {
          // 1. Draw all character content for this frame
          for (let c = 0; c < 44; c++) {
            const sc = startCol + c - horizontalOffset;
            if (sc >= 0 && sc < msgLength) {
              buffer[r][c] = currentBoolArray[r][sc];
            }
          }
          // 2. Draw horizontal laser line to the left
          if (isCharPixelOn) {
            for (let c = 0; c <= index; c++) {
              buffer[r][c] = true;
            }
          } else {
            // Clearing effect like Flutter
            for (let c = 0; c <= index; c++) {
              buffer[r][c] = false;
            }
          }
        }
      }
    } else if (effectVal === 5) {
      // Animation (Frame Switch)
      const framesCount = Math.ceil(msgLength / 44) || 1;
      const switchFrame = Math.floor(offset / 6) % framesCount;
      const startCol = switchFrame * 44;
      for (let r = 0; r < 11; r++) {
        for (let c = 0; c < 44; c++) {
          const sourceC = startCol + c;
          if (sourceC >= 0 && sourceC < msgLength)
            buffer[r][c] = currentBoolArray[r][sourceC];
        }
      }
    } else {
      // Fixed / Default
      const horizontalOffset = Math.floor((44 - msgLength) / 2);
      for (let r = 0; r < 11; r++) {
        for (let c = 0; c < 44; c++) {
          const sourceC = c - horizontalOffset;
          if (sourceC >= 0 && sourceC < msgLength)
            buffer[r][c] = currentBoolArray[r][sourceC];
        }
      }
    }

    // 2. Handle Marquee Border
    if (isMarquee) {
      const marqueeOffset = offset % 110;
      for (let c = 0; c < 44; c++) {
        if ((c + marqueeOffset * 2) % 6 === 0) {
          buffer[0][c] = true;
          buffer[10][c] = true;
        }
      }
      for (let r = 0; r < 11; r++) {
        if ((r + marqueeOffset * 2) % 6 === 0) {
          buffer[r][0] = true;
          buffer[r][43] = true;
        }
      }
    }

    // 3. Render buffer to pixels
    for (let r = 0; r < 11; r++) {
      for (let c = 0; c < 44; c++) {
        if (buffer[r][c]) {
          pixels[r * 44 + c].classList.add("on");
        }
      }
    }
  }

  function startScrollingAnimation() {
    const speedMapping = [250, 200, 150, 100, 60, 40, 25, 15]; // ms per frame (snappier, matching Flutter)
    const speedIdx = parseInt(speedSlider.value, 10) - 1;
    const interval = speedMapping[speedIdx] || 100;

    animationInterval = setInterval(() => {
      scrollOffset++;
      renderFrame(scrollOffset);
    }, interval);
  }

  // SVG Icon Processing
  function processSvgs() {
    if (!window.VECTOR_SVGS) return;

    for (const [name, svgString] of Object.entries(window.VECTOR_SVGS)) {
      // 1. Create a DOM element for the icon picker
      const iconDiv = document.createElement("div");
      iconDiv.className = "icon-item";

      // Change black to currentColor for CSS theming
      let svgMarkup = svgString.replace(
        /fill="#000000"/g,
        'fill="currentColor"',
      );
      iconDiv.innerHTML = svgMarkup;
      iconDiv.title = name;
      iconPicker.appendChild(iconDiv);

      // 2. Render SVG onto canvas to extract binary matrix
      renderSvgToHex(name, svgString).then((hex) => {
        if (hex) window.svgsHexCache[name] = hex;
      });

      // 3. Click handler to insert into message
      iconDiv.addEventListener("click", () => {
        const cursorPos = messageInput.selectionStart;
        const textBefore = messageInput.value.substring(0, cursorPos);
        const textAfter = messageInput.value.substring(cursorPos);
        messageInput.value = textBefore + `<<${name}>>` + textAfter;
        // trigger update
        generateDataChunk();
      });
    }
  }

  function renderTextToBitsMatrix(text, fontFamily) {
    if (!text) return Array.from({ length: 11 }, () => []);

    // 1. Setup font
    let weight = "700";
    let fontSize = "14px";

    // Pixel-specific tuning
    if (fontFamily === "Press Start 2P") {
      fontSize = "8px";
      weight = "400";
    } else if (fontFamily === "Silkscreen") {
      fontSize = "8px";
      weight = "700";
    }

    const fontSpec = `${weight} ${fontSize} "${fontFamily}"`;

    fontCtx.font = fontSpec;
    const metrics = fontCtx.measureText(text);
    const width = Math.max(1, Math.ceil(metrics.width));

    fontCanvas.width = width;
    fontCanvas.height = 11;

    // Re-set font after resize
    fontCtx.font = fontSpec;
    fontCtx.textBaseline = "middle";
    fontCtx.fillStyle = "black";

    // Disable smoothing for pixel-perfect fonts
    const isPixelFont = ["Press Start 2P", "Silkscreen"].includes(fontFamily);
    fontCtx.imageSmoothingEnabled = !isPixelFont;

    // 2. Draw
    fontCtx.clearRect(0, 0, width, 11);

    // Scaling/Offset tuning
    let yOffset = 5.5;
    if (fontFamily === "Orbitron") yOffset = 5.8;
    if (fontFamily === "VT323") yOffset = 5.2; // VT323 is top-heavy

    fontCtx.fillText(text, 0, yOffset);

    // 3. Extract bits
    const imgData = fontCtx.getImageData(0, 0, width, 11).data;
    const matrix = Array.from({ length: 11 }, () => []);

    for (let r = 0; r < 11; r++) {
      for (let c = 0; c < width; c++) {
        const idx = (r * width + c) * 4;
        const alpha = imgData[idx + 3];
        // Threshold: 100 instead of 128 to catch finer details of thin fonts
        const isOn = alpha > 100;
        matrix[r].push(isOn);
      }
    }
    return matrix;
  }
  function renderSvgToHex(name, svgString) {
    return new Promise((resolve) => {
      const img = new Image();
      const svg = new Blob([svgString], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(svg);

      img.onload = () => {
        // Block-based sampling: render at 4× (44px height), then each LED = one 4×4 block
        // Coverage per block (not single-pixel threshold) keeps shapes readable on 11×44
        const targetRows = 11;
        const renderHeight = targetRows * BLOCK; // 44
        const scale = renderHeight / img.height;
        const renderWidth = Math.max(BLOCK, Math.round(img.width * scale) + BLOCK);

        tempCanvas.width = renderWidth;
        tempCanvas.height = renderHeight;
        tempCtx.clearRect(0, 0, renderWidth, renderHeight);
        tempCtx.drawImage(img, 0, 0, renderWidth, renderHeight);

        const imageData = tempCtx.getImageData(0, 0, renderWidth, renderHeight);
        const data = imageData.data;
        const stride = renderWidth * 4;

        const outCols = Math.ceil(renderWidth / BLOCK);
        const pixels2D = [];
        let left = outCols,
          right = 0;
        let foundAny = false;
        const coverageThreshold = 0.32; // block "on" if ≥32% covered (tunable for shape vs density)

        for (let ry = 0; ry < targetRows; ry++) {
          const row = [];
          for (let cx = 0; cx < outCols; cx++) {
            let sum = 0;
            for (let dy = 0; dy < BLOCK; dy++) {
              for (let dx = 0; dx < BLOCK; dx++) {
                const px = cx * BLOCK + dx;
                const py = ry * BLOCK + dy;
                if (px < renderWidth && py < renderHeight) {
                  sum += data[(py * renderWidth + px) * 4 + 3];
                }
              }
            }
            const coverage = sum / (BLOCK * BLOCK * 255);
            const isSet = coverage >= coverageThreshold ? 1 : 0;
            row.push(isSet);
            if (isSet) {
              foundAny = true;
              if (cx < left) left = cx;
              if (cx > right) right = cx;
            }
          }
          pixels2D.push(row);
        }

        if (!foundAny) {
          resolve(null);
          return;
        }

        const trimmedWidth = right - left + 1;

        // Re-encode into the 11-byte row-based HEX format `convertBitmapToLEDHex`
        // 11 bytes = 1 character block.
        // If wider than 8px, it needs multiple 11-byte blocks.
        const numBlocks = Math.ceil(trimmedWidth / 8);
        let finalHex = "";

        for (let block = 0; block < numBlocks; block++) {
          let blockHex = "";
          const startX = left + block * 8;

          // 11 Rows
          for (let y = 0; y < 11; y++) {
            let byteVal = 0;
            // 8 Columns per row in this block
            for (let bit = 0; bit < 8; bit++) {
              const pxX = startX + bit;
              if (pxX <= right && pixels2D[y][pxX] === 1) {
                byteVal |= 1 << (7 - bit);
              }
            }
            blockHex += toHex(byteVal);
          }
          finalHex += blockHex;
        }

        resolve(finalHex);
        URL.revokeObjectURL(url);
      };

      img.onerror = () => {
        resolve(null);
      };

      img.src = url;
    });
  }

  processSvgs();

  // Initial preview render
  generateDataChunk();

  // Listeners for live update
  messageInput.addEventListener("input", generateDataChunk);
  effectSelect.addEventListener("change", generateDataChunk);
  speedSelect.addEventListener("change", generateDataChunk);
  if (invertCheck) invertCheck.addEventListener("change", generateDataChunk);
  flashCheck.addEventListener("change", generateDataChunk);
  marqueeCheck.addEventListener("change", generateDataChunk);

  fontSelect.addEventListener("change", () => {
    // Update input display
    if (fontSelect.value === "default") {
      messageInput.style.fontFamily = "inherit";
    } else {
      messageInput.style.fontFamily = `'${fontSelect.value}', sans-serif`;
    }
    generateDataChunk();
  });

  sendBtn.addEventListener("click", connectAndSend);
});
