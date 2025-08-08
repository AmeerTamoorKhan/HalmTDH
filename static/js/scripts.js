// State variables
let uploadedImages = [];
let imageIndex = 0;
let imageCounts = [];
let processedImages = [];
let processedData = [];
let scale = 1;
let translateX = 0;
let translateY = 0;
let initialScale = 1;
// at top
let selectionRects = [];    // one entry per uploadedImages[i]
let processingAborted = false;

// ─── at top of your script ────────────────────────────────────────────────
let selectionChangedIndex = null;

// at top of your script
const RECT_STROKE_COLOR = '#ff0000';  // red
const HANDLE_FILL_COLOR = '#ffff00';  // yellow




// ─── Select‐mode state ────────────────────────────────────────────────────
let selectionRect  = null;    // { x, y, w, h }
let isDraggingRect = false;
let isResizingRect = false;
let dragOffset     = { x:0, y:0 };
let activeHandle   = null;    // 'nw','ne','sw','se'
// Desired on-screen thicknesses (in CSS pixels):
const BORDER_SCREEN_PX = 2;
const HANDLE_SCREEN_PX = 12;
// ─── Select-mode on/off ───────────────────────────────────────────────
let selectionMode = false;
// ─── Image cache for fast redraw in select-mode ───────────────────────────
let lastDrawnImage = null;  // HTMLImageElement

// ─── add at top of your script ─────────────────────────────────────────
let pointers = {};              // active pointers
let isPinching = false;
let initialPinchDistance = 0;
let initialRect = null;


// ─── touch-pinch / touch-drag support for select-mode ──────────────────────
let touchInitialDistanceX = 0;
let touchInitialDistanceY = 0;
let touchInitialRect      = null;




// Element references
const canvas = document.getElementById('previewCanvas');
const ctx = canvas.getContext('2d');
const resultsTable = document.getElementById('resultsTableBody');
const uploadBtn = document.getElementById('uploadBtn');
const countBtn = document.getElementById('countBtn');
const clearBtn = document.getElementById('clearBtn');
const imageInput = document.getElementById('imageInput');
const downloadBtn = document.getElementById('downloadResultBtn');
const cropRadios = document.querySelectorAll('input[name="crop"]');
const headerTable = document.getElementById('resultsTableHeader');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const selectBtn = document.getElementById('selectBtn');
const applyAllCheckbox = document.getElementById('flexCheckDefault');

// ← ADD THESE:
const zoomInBtn    = document.getElementById('zoomInBtn');
const zoomOutBtn   = document.getElementById('zoomOutBtn');



selectBtn.disabled = true;   // start disabled until an image is loaded



// helper to measure distance between two Touches
function getDistanceTouches(t1, t2) {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return Math.hypot(dx, dy);
  }
  
  // convert a single Touch to canvas coords
function getCanvasTouchPos(touch) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (touch.clientX - r.left) * (canvas.width  / r.width),
      y: (touch.clientY - r.top ) * (canvas.height / r.height)
    };
}



// helper to toggle that disable state
function updateSelectButtonState() {
  selectBtn.disabled = !lastDrawnImage;
}


function showSliderButtons() {
    prevBtn.style.display = 'flex';
    nextBtn.style.display = 'flex';
}

function goToImage(newIndex) {
    // ■ save live rect if we’re in select-mode
    if (selectionMode && selectionRect) {
      selectionRects[imageIndex] = { ...selectionRect };
    }
  
    // ■ reset UI state
    selectionMode   = false;
    selectionRect   = null;
    zoomInBtn.disabled = zoomOutBtn.disabled = false;
  
    // ■ switch index & draw
    imageIndex = newIndex;
    drawImageToCanvas(uploadedImages[imageIndex]);
  
    // ■ restore rect if one was saved
    const saved = selectionRects[imageIndex];
    if (saved) {
      selectionRect   = { ...saved };
      selectionMode   = true;
      zoomInBtn.disabled = zoomOutBtn.disabled = true;
      drawSelection();
    }
  }
  


function getCropType() {
    const selectedRadio = document.querySelector('input[name="crop"]:checked');
    if (selectedRadio) {
        return selectedRadio.value.split('/')[0];
    }

    // fallback: infer from page URL
    const url = window.location.pathname.toLowerCase();
    if (url.includes('head')) return 'head';
    if (url.includes('sepal')) return 'sepal';
    if (url.includes('stubble')) return 'stubble';

    // ultimate fallback
    return 'stubble';
}


document.addEventListener('DOMContentLoaded', () => {
    const stubbleRadio = document.querySelector('input[name="crop"][value="stubble"]');
    if (stubbleRadio) {
        stubbleRadio.checked = true;
    }

    applyAllCheckbox.addEventListener('change', () => {
      if (applyAllCheckbox.checked) {
        if (selectionRect) {
          selectionRects = selectionRects.map(() => ({ ...selectionRect }));
          console.log("✅ Applied selectionRect to all images");
        }
        // 🟩 Force the next count to process ALL images
        selectionChangedIndex = null;
      } else {
        selectionRects = selectionRects.map(() => null);
        console.log("❌ Removed selectionRects from all images");

        if (selectionMode) {
          selectionRect = null;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(lastDrawnImage, 0, 0);
          applyZoomAndPan(canvas, scale, translateX, translateY);
        }

        // 🟩 Also: force next count to process ALL images (reset)
        selectionChangedIndex = null;
      }
    });


});



uploadBtn.addEventListener('click', () => imageInput.click());
downloadBtn.disabled = true;

imageInput.addEventListener('change', (event) => {
    const files = Array.from(event.target.files);
    if (!files.length) return;

    // reset “which image was changed” so first Count processes all
    selectionChangedIndex = null;

    uploadedImages = files;

    processedImages = new Array(files.length).fill(null);
    processedData = new Array(files.length).fill(null);
    imageCounts = new Array(files.length).fill("Loaded");
    imageIndex = 0;

    // one entry per image; null = “full‐image”
    selectionRects = new Array(files.length).fill(null);


    toggleCountButton();
    updateResultsTable(); // build initial table layout based on crop type

    document.getElementById('previewCanvas').style.transform = 'none';
    renderImageSlider();
    showSliderButtons();
    imageInput.value = '';

    // Clear any prior selection
    selectionMode   = false;
    selectionRect   = null;
    selectBtn.classList.remove('active');
    updateSelectButtonState();
});



// prevBtn.addEventListener('click', () => {
//     const prev = (imageIndex - 1 + uploadedImages.length) % uploadedImages.length;
//     goToImage(prev);
//   });
  
//   nextBtn.addEventListener('click', () => {
//     const nxt = (imageIndex + 1) % uploadedImages.length;
//     goToImage(nxt);
//   });
  
  



clearBtn.addEventListener('click', () => {
    // ─── 1) Reset all your image arrays & index ─────────────────────────────
    uploadedImages   = [];
    imageCounts      = [];
    processedImages  = [];
    processedData    = [];
    imageIndex       = 0;
  
    // ─── 2) Clear the canvas pixel buffer & CSS state ────────────────────
    const canvasEl = document.getElementById('previewCanvas');
    const ctx      = canvasEl.getContext('2d');
    ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  
    // remove any lingering transform
    canvasEl.style.transform = 'none';
  
    // ─── 3) Reset select-mode state ───────────────────────────────────────
    selectionMode   = false;
    selectionRect   = null;
    lastDrawnImage  = null;
  
    // ─── 4) Clear only the table *body* ─────────────────────────────────
    document.getElementById('resultsTableBody').innerHTML = '';
  
    // ─── 5) Reset all buttons & inputs ───────────────────────────────────
    cropRadios.forEach(r => r.disabled = false);
    downloadBtn.disabled  = true;
    zoomInBtn.disabled    = false;
    zoomOutBtn.disabled   = false;
    imageInput.value      = '';
    toggleCountButton();
  
    // keep your slider arrows visible
    showSliderButtons();
  
    // ─── Reset selection & image cache ─────────────────────────
    lastDrawnImage = null;
    updateSelectButtonState();

    // clear the “last-changed” flag so next Count is full
    selectionChangedIndex = null;
  });
  
  

// ─── Count button handler ─────────────────────────────────────────────────
countBtn.addEventListener('click', async () => {
    // 0) If you’re in select‐mode, snapshot the current live rect
    if (selectionMode && selectionRect) {
      selectionRects[imageIndex] = { ...selectionRect };
    }
  
    // Decide which images to (re-)process:
    // If the user just changed one image’s selection, re-process only that one;
    // otherwise process them all.
    const indicesToProcess = uploadedImages.map((_, i) => i)
      .filter(i => selectionRects[i] !== null || selectionChangedIndex === null);

  
    // Reset for the next “full batch” Count click
    selectionChangedIndex = null;
  
    // 1) Disable UI & reset abort flag
    processingAborted = false;
    [downloadBtn, countBtn, clearBtn, uploadBtn, imageInput].forEach(btn => btn.disabled = true);
    cropRadios.forEach(r => r.disabled = true);
    zoomInBtn.disabled = zoomOutBtn.disabled = true;
    const cropType = document.querySelector('input[name="crop"]:checked')?.value || 'stubble';
  
    // 2) Create & prime offscreen canvases
    const offCanvases = uploadedImages.map(() => document.createElement('canvas'));
    const offCtxs     = offCanvases.map(c => c.getContext('2d'));
  
    // 3) Load every base image into its offscreen canvas in parallel
    // Helper to load a single image
    function loadImageToCanvas(file, i) {
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          offCanvases[i].width  = img.width;
          offCanvases[i].height = img.height;
          offCtxs[i].drawImage(img, 0, 0);

          // If it’s the currently visible image, draw it on-screen too
          if (i === imageIndex) {
            canvas.width  = img.width;
            canvas.height = img.height;
            ctx.clearRect(0, 0, img.width, img.height);
            ctx.drawImage(img, 0, 0);
            applyZoomAndPan(canvas, scale, translateX, translateY);
          }
          resolve();
        };
        const reader = new FileReader();
        reader.onload = e => img.src = e.target.result;
        reader.readAsDataURL(file);
      });
    }

    // Load 1 images at a time
    for (let i = 0; i < uploadedImages.length; i++) {
      await loadImageToCanvas(uploadedImages[i], i);
    }

  
    // 4) Process only the needed images in sequence
    for (let idx of indicesToProcess) {
      if (processingAborted) break;
  
      imageCounts[idx]     = 'Processing…';
      processedData[idx]   = null;
      processedImages[idx] = null;
      updateResultsTable();
  
      const rect = selectionRects[idx];
      const sendForm = blob => {
        const fd = new FormData();
        fd.append('image', blob, uploadedImages[idx].name);
        fd.append('crop',  cropType);
        streamAndComposite(fd, idx);
      };
  
      if (rect) {
        // Client-side crop, then upload
        const img = new Image();
        const reader = new FileReader();
        reader.onload = e => img.src = e.target.result;
        reader.readAsDataURL(uploadedImages[idx]);
        await new Promise(resolve => {
          img.onload = () => {
            const tmp = document.createElement('canvas');
            tmp.width  = rect.w;
            tmp.height = rect.h;
            tmp.getContext('2d')
               .drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
            tmp.toBlob(sendForm, 'image/png');
            resolve();
          };
        });
      } else {
        // Full-image upload
        const fd = new FormData();
        fd.append('image', uploadedImages[idx]);
        fd.append('crop',  cropType);
        streamAndComposite(fd, idx);
      }
  
      // Yield so a fast user rect-change can abort before next image
      await new Promise(r => setTimeout(r, 0));
    }
  
    // Helper: stream patches back and composite onto offscreen canvas
    function streamAndComposite(formData, idx) {
      fetch('/stream_patches', { method: 'POST', body: formData })
        .then(res => {
          const reader  = res.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let buffer = '';
          function pump() {
            return reader.read().then(({ done, value }) => {
              if (done) return;
              buffer += decoder.decode(value, { stream: true });
              const parts = buffer.split('\n\n');
              for (let j = 0; j < parts.length - 1; j++) {
                if (!parts[j].startsWith('data:')) continue;
                const patchData = JSON.parse(parts[j].slice(5));
                imageCounts[idx]   = patchData.count;
                processedData[idx] = patchData;
                updateResultsTable();
                const pimg = new Image();
                pimg.onload = () => {
                  const offC   = offCanvases[idx];
                  const offCtx = offCtxs[idx];
                  if (pimg.width === offC.width && pimg.height === offC.height) {
                    offCtx.clearRect(0,0,offC.width,offC.height);
                    offCtx.drawImage(pimg, 0, 0);
                  } else if (selectionRects[idx]) {
                    const r = selectionRects[idx];
                    offCtx.drawImage(pimg, r.x, r.y, r.w, r.h);
                  }
                  processedImages[idx] = offC.toDataURL('image/png');
                  if (idx === imageIndex) {
                    canvas.width  = offC.width;
                    canvas.height = offC.height;
                    ctx.clearRect(0, 0, offC.width, offC.height);
                    ctx.drawImage(offC, 0, 0);
                    if (selectionMode && selectionRects[idx]) drawSelection();
                    applyZoomAndPan(canvas, scale, translateX, translateY);
                  }
                };
                pimg.src = patchData.image;
              }
              buffer = parts[parts.length - 1];
              return pump();
            });
          }
          return pump();
        })
        .catch(console.error)
        // …inside your streamAndComposite’s .finally() block, after re-enabling the UI:
        .finally(() => {
            if (imageCounts.every(c => c !== 'Processing…')) {
            // existing UI re-enable…
            [downloadBtn, countBtn, clearBtn, uploadBtn, imageInput].forEach(b => b.disabled = false);
            cropRadios.forEach(r => r.disabled = false);
            zoomInBtn.disabled = zoomOutBtn.disabled = false;
            updateSelectButtonState();
            if (processedImages[imageIndex]) {
              drawImageToCanvas(uploadedImages[imageIndex]);
              // ✅ If select-mode is still on, redraw the selection overlay
              if (selectionMode && selectionRects[imageIndex]) {
                selectionRect = { ...selectionRects[imageIndex] };
                drawSelection();
              }
            }
            // ─── NEW: reset select‐mode so the button is un-selected ─────────────
            selectionMode   = false;
            selectionRect   = null;
            selectBtn.classList.remove('active');
            updateSelectButtonState();
            }
        });
  
    }
  });
  
  
  
  

function toggleCountButton() {
    const isImageUploaded = uploadedImages.length > 0;
    const isCropSelected = document.querySelector('input[name="crop"]:checked') !== null;
    countBtn.disabled = !(isImageUploaded && isCropSelected);
    countBtn.title = countBtn.disabled ? "Upload an image and select a crop type" : "Click to count";
}

function renderImageSlider() {
    drawImageToCanvas(uploadedImages[imageIndex]);
    bindSliderControls();
    bindZoomAndPanFunctionality();
}

function bindSliderControls() {
    prevBtn.onclick = () => {
      const prev = (imageIndex - 1 + uploadedImages.length) % uploadedImages.length;
      goToImage(prev);
    };
    nextBtn.onclick = () => {
      const nxt = (imageIndex + 1) % uploadedImages.length;
      goToImage(nxt);
    };
  }
  



function drawBase64ImageToCanvas(base64) {
    const canvas = document.getElementById('previewCanvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const container = canvas.parentElement;
        const scaleX = container.clientWidth / img.width;
        const scaleY = container.clientHeight / img.height;
        initialScale = scale = Math.min(scaleX, scaleY, 1);
        translateX = (container.clientWidth - img.width * scale) / 2;
        translateY = (container.clientHeight - img.height * scale) / 2;        
        if (!selectionMode) {
            applyZoomAndPan(canvas, scale, translateX, translateY);
        }
          
    };
    img.src = base64;
}


function updateResultsTable() {
    const cropType = getCropType();

    console.log("Updating results table with crop type:", cropType);
    headerTable.innerHTML = '';
    resultsTable.innerHTML = '';

    const headerRow = document.createElement('tr');
    if (cropType === 'stubble') {
        headerRow.innerHTML = `<th>Image</th><th>Count</th><th>#</th><th>D(cm)</th><th>T(mm)</th>`;
    } else {
        headerRow.innerHTML = `<th>Image</th><th>Count</th>`;
    }
    headerTable.appendChild(headerRow);

    uploadedImages.forEach((file, i) => {
        const data = processedData[i];
        const objects = Array.isArray(data?.objects) ? data.objects : [];
        const count = imageCounts[i] ?? data?.count ?? (objects.length || 0);

        if (cropType === 'stubble') {
            if (!objects.length || count === "Loaded" || count === "Processing...") {
                const row = document.createElement('tr');
                row.innerHTML = `<td>${file.name}</td><td>${count}</td><td>—</td><td>—</td><td>—</td>`;
                resultsTable.appendChild(row);
                return;
            }

            objects.forEach((obj, index) => {
                const row = document.createElement('tr');
                if (index === 0) {
                    row.innerHTML += `<td rowspan="${count}">${file.name}</td><td rowspan="${count}">${count}</td>`;
                }
                row.innerHTML += `<td>${index + 1}</td><td>${obj.diameter_cm ?? '—'}</td><td>${obj.thickness_mm ?? '—'}</td>`;
                resultsTable.appendChild(row);
            });
        } else {
            const row = document.createElement('tr');
            row.innerHTML = `<td>${file.name}</td><td>${count}</td>`;
            resultsTable.appendChild(row);
        }
    });
}





function drawImageToCanvas(file) {
    const img = new Image();
    img.onload = () => {
      // clear any old CSS tweaks
      canvas.style.transform = 'none';
  
      // 1) draw at natural size & cache it
      canvas.width  = img.width;
      canvas.height = img.height;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(img, 0,0);
      lastDrawnImage = img;

      // Update Select Button State:
      updateSelectButtonState();
  
      // 2) compute your “fit” scale & translate
      const container = canvas.parentElement;
      const scaleX    = container.clientWidth  / img.width;
      const scaleY    = container.clientHeight / img.height;
      initialScale    = scale = Math.min(scaleX, scaleY, 1);
      translateX      = (container.clientWidth  - img.width  * scale) / 2;
      translateY      = (container.clientHeight - img.height * scale) / 2;
  
      // 3) **always** re-apply that transform
      applyZoomAndPan(canvas, scale, translateX, translateY);
  
      // 4) if we’re already in select-mode, draw the box on top
      if (selectionMode && selectionRect) {
        drawSelection();
      }
    };
  
    // load either your processed base64 or the raw File
    if (processedImages[imageIndex]) {
      img.src = processedImages[imageIndex];
    } else {
      const reader = new FileReader();
      reader.onload = e => img.src = e.target.result;
      reader.readAsDataURL(file);
    }

  }
  
  




document.getElementById('downloadResultBtn').addEventListener('click', async () => {
    if (!uploadedImages.length || !processedData.length) return;

    const cropTypeFull = document.querySelector('input[name="crop"]:checked')?.value || 'stubble';
    const cropType = cropTypeFull.split('/')[0];

    const zip = new JSZip();
    const imgFolder = zip.folder("predictedImgs");
    const csvLines = [];

    const header = cropType === 'stubble'
        ? ['Image', 'Count', '#', 'D(cm)', 'T(mm)']
        : ['Image', 'Count'];
    csvLines.push(header.join(','));

    // Disable download while processing
    const downloadBtn = document.getElementById('downloadResultBtn');
    downloadBtn.disabled = true;

    for (let i = 0; i < uploadedImages.length; i++) {
        const file = uploadedImages[i];
        const imageName = file.name;
        const data = processedData[i];
        const count = data?.objects?.length || 0;

        // ✅ Load the annotated base64 image from processedImages
        const annotatedBase64 = processedImages[i];
        const img = new Image();

        await new Promise((resolve) => {
            img.onload = resolve;
            img.src = annotatedBase64;
        });

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        tempCtx.drawImage(img, 0, 0);
        const blob = await new Promise(res => tempCanvas.toBlob(res, 'image/png'));

        // Save the image in the zip
        imgFolder.file(imageName.replace(/\.[^/.]+$/, '.png'), blob);

        // Prepare CSV lines
        if (cropType === 'stubble') {
            const lines = data.objects.map(obj => {
                const id = obj.id ?? '';
                const d = obj.diameter_cm ?? '';
                const t = obj.thickness_mm ?? '';
                return [`"${imageName}"`, count, id, d, t].join(',');
            });
            csvLines.push(...lines);
        } else {
            csvLines.push([`"${imageName}"`, count].join(','));
        }
    }

    // Add CSV file to zip
    zip.file("result.csv", csvLines.join("\n"));
    const finalBlob = await zip.generateAsync({ type: "blob" });
    saveAs(finalBlob, "results_package.zip");

    // Re-enable button
    downloadBtn.disabled = false;
});



function bindZoomAndPanFunctionality() {
    const zoomInBtn  = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const canvasEl   = document.getElementById('previewCanvas');
  
    let isPanning = false;
    let startX = 0, startY = 0;
  
    // ─── Zoom In ─────────────────────────────────────────────────────────────
    zoomInBtn.addEventListener('click', () => {
      if (selectionMode) return;
      const r = canvasEl.getBoundingClientRect();
      zoomImage(1.1, r.left + r.width/2, r.top + r.height/2);
    });
  
    // ─── Zoom Out ────────────────────────────────────────────────────────────
    zoomOutBtn.addEventListener('click', () => {
      if (selectionMode) return;
      const r = canvasEl.getBoundingClientRect();
      zoomImage(0.9, r.left + r.width/2, r.top + r.height/2);
    });
  
    // ─── Wheel Zoom ──────────────────────────────────────────────────────────
    canvasEl.addEventListener('wheel', e => {
      if (selectionMode) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const r = canvasEl.getBoundingClientRect();
      zoomImage(factor, e.clientX - r.left, e.clientY - r.top);
    });
  
    // ─── Start Pan ───────────────────────────────────────────────────────────
    canvasEl.addEventListener('mousedown', e => {
      if (selectionMode) return;
      isPanning = true;
      startX = e.clientX - translateX;
      startY = e.clientY - translateY;
      canvasEl.style.cursor = 'grabbing';
    });
  
    // ─── Perform Pan ─────────────────────────────────────────────────────────
    window.addEventListener('mousemove', e => {
      if (selectionMode || !isPanning) return;
      translateX = e.clientX - startX;
      translateY = e.clientY - startY;
      // apply directly so we don’t re-draw the image
      canvasEl.style.transform       = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
      canvasEl.style.transformOrigin = 'top left';
    });
  
    // ─── End Pan ──────────────────────────────────────────────────────────────
    window.addEventListener('mouseup', () => {
      if (selectionMode) return;
      isPanning = false;
      canvasEl.style.cursor = 'default';
        // user just changed the rect — abort the rest of the batch
      processingAborted = true;
    });

    // Touch: start pan
    canvasEl.addEventListener('touchstart', e => {
        if (selectionMode || e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        isPanning = true;
        startX = t.clientX - translateX;
        startY = t.clientY - translateY;
    }, { passive: false });

    // Touch: perform pan
    canvasEl.addEventListener('touchmove', e => {
        if (selectionMode || !isPanning || e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        translateX = t.clientX - startX;
        translateY = t.clientY - startY;
        canvasEl.style.transform       = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
        canvasEl.style.transformOrigin = 'top left';
    }, { passive: false });

    // Touch: end pan
    canvasEl.addEventListener('touchend', e => {
        if (selectionMode) return;
        isPanning = false;
        processingAborted = true;
    });

  }
  
  

function zoomImage(factor, screenX = null, screenY = null) {
    const rect = canvas.getBoundingClientRect();

    // Fallback to center of the canvas
    const cx = screenX ?? rect.width / 2;
    const cy = screenY ?? rect.height / 2;

    // Convert screen point to canvas point before zoom
    const x = (cx - rect.left - translateX) / scale;
    const y = (cy - rect.top - translateY) / scale;

    const newScale = Math.max(0.1, scale * factor);
    const deltaScale = newScale / scale;

    // Recalculate translateX/Y so that the zoom centers on (x, y)
    translateX -= x * (deltaScale - 1) * scale;
    translateY -= y * (deltaScale - 1) * scale;
    scale = newScale;

    if (!selectionMode) {
        applyZoomAndPan(canvas, scale, translateX, translateY);
      }
      
}




function applyZoomAndPan(image, scale, tx, ty) {
    image.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
    image.style.transformOrigin = 'top left';
    image.parentElement.style.overflow = scale > 1 ? 'scroll' : 'hidden';
}


















// ─── Helper for select‐mode ───────────────────────────────────────────────────
function getMousePos(evt) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (evt.clientX - r.left) * (canvas.width  / r.width),
      y: (evt.clientY - r.top ) * (canvas.height / r.height)
    };
  }
  
  function handleCoords(pos) {
    switch(pos) {
      case 'nw': return { x: selectionRect.x,             y: selectionRect.y             };
      case 'ne': return { x: selectionRect.x + selectionRect.w, y: selectionRect.y       };
      case 'sw': return { x: selectionRect.x,             y: selectionRect.y + selectionRect.h };
      case 'se': return { x: selectionRect.x + selectionRect.w, y: selectionRect.y + selectionRect.h };
    }
  }
  
  function getHandleUnderMouse(mx, my) {
    return ['nw','ne','sw','se'].find(pos => {
      const { x, y } = handleCoords(pos);
      const hs = HANDLE_SCREEN_PX / scale;
      return Math.abs(mx - x) <= hs/2 && Math.abs(my - y) <= hs/2;      ;
    }) || null;
  }
  
// ─── Hit-test for inside the rect body (accounting for dynamic handle size) ───
function isInsideRect(mx, my) {
    const hs = HANDLE_SCREEN_PX / scale;
    return (
    mx >  selectionRect.x + hs &&
    mx <  selectionRect.x + selectionRect.w  - hs &&
    my >  selectionRect.y + hs &&
    my <  selectionRect.y + selectionRect.h - hs
    );
}
  
  function drawSelection() {
    if (!selectionRect) return;
  
    // Convert screen px → canvas px
    const lw = BORDER_SCREEN_PX / scale;
    const hs = HANDLE_SCREEN_PX / scale;
  
    ctx.save();
    ctx.lineWidth   = lw;
    ctx.strokeStyle = RECT_STROKE_COLOR;
    ctx.strokeRect(selectionRect.x, selectionRect.y, selectionRect.w, selectionRect.h);
  
    // Draw handles at each corner
    ['nw','ne','sw','se'].forEach(pos => {
      const { x, y } = handleCoords(pos);
      ctx.fillStyle = HANDLE_FILL_COLOR;
      ctx.fillRect(x - hs/2, y - hs/2, hs, hs);
    });
    ctx.restore();
  }
  

  



















window.addEventListener('DOMContentLoaded', () => {
    bindZoomAndPanFunctionality();

    cropRadios.forEach(radio => {
        radio.addEventListener('change', toggleCountButton);
    });

    // ✅ Add the canvas render-complete listener here
    canvas.addEventListener('render-complete', () => {
        canvas.style.display = 'none';
        canvas.offsetHeight; // Force reflow
        canvas.style.display = 'block';
        console.log("✅ Canvas render completed — labels and masks should now be visible");
    });


    // ─── Select‐mode event listeners ──────────────────────────────────────────────

    selectBtn.addEventListener('click', () => {
      if (!lastDrawnImage) return;

      selectionMode = !selectionMode;
      zoomInBtn.disabled  = zoomOutBtn.disabled = selectionMode;

      if (selectionMode) {
        // ✅ Load existing rect for this image if it exists
        const saved = selectionRects[imageIndex];
        if (saved) {
          selectionRect = { ...saved };
        } else {
          // Create a new default rect if none exists
          const c = canvas.parentElement.getBoundingClientRect();
          const boxW = (c.width * 0.5) / scale;
          const boxH = (c.height * 0.5) / scale;
          selectionRect = {
            x: (canvas.width - boxW)/2,
            y: (canvas.height - boxH)/2,
            w: boxW,
            h: boxH
          };
        }
        drawSelection();
      } else {
        document.getElementById('flexCheckDefault').checked = false; // Uncheck Apply All
        // Save this rect for the current image
        selectionRects[imageIndex] = { ...selectionRect };
        selectionRect = null;

        // Redraw the image without rect
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(lastDrawnImage, 0, 0);
        applyZoomAndPan(canvas, scale, translateX, translateY);
      }
    });



             
      
      
      
    
    // ─── Mouse down: start drag or resize ───────────────────────────────────────
    canvas.addEventListener('mousedown', e => {
        if (!selectionMode || !selectionRect) return;
        const { x: mx, y: my } = getMousePos(e);
    
        const handle = getHandleUnderMouse(mx, my);
        if (handle) {
        isResizingRect = true;
        activeHandle  = handle;
        } else if (isInsideRect(mx, my)) {
        isDraggingRect = true;
        dragOffset.x   = mx - selectionRect.x;
        dragOffset.y   = my - selectionRect.y;
        }
    });
        
    // ─── Mouse move: drag or resize and redraw ─────────────────────────────────
    canvas.addEventListener('mousemove', e => {
        if (!selectionMode || (!isDraggingRect && !isResizingRect)) return;
        const { x: mx, y: my } = getMousePos(e);
    
        if (isDraggingRect) {
        // Move the whole box
        selectionRect.x = mx - dragOffset.x;
        selectionRect.y = my - dragOffset.y;
    
        } else if (isResizingRect) {
        // Resize by corner
        switch (activeHandle) {
            case 'nw': {
            const newW = selectionRect.w + (selectionRect.x - mx);
            const newH = selectionRect.h + (selectionRect.y - my);
            if (newW > 0 && newH > 0) {
                selectionRect.x = mx;
                selectionRect.y = my;
                selectionRect.w = newW;
                selectionRect.h = newH;
            }
            break;
            }
            case 'ne': {
            const newW = mx - selectionRect.x;
            const newH = selectionRect.h + (selectionRect.y - my);
            if (newW > 0 && newH > 0) {
                selectionRect.y = my;
                selectionRect.w = newW;
                selectionRect.h = newH;
            }
            break;
            }
            case 'sw': {
            const newW = selectionRect.w + (selectionRect.x - mx);
            const newH = my - selectionRect.y;
            if (newW > 0 && newH > 0) {
                selectionRect.x = mx;
                selectionRect.w = newW;
                selectionRect.h = newH;
            }
            break;
            }
            case 'se': {
            const newW = mx - selectionRect.x;
            const newH = my - selectionRect.y;
            if (newW > 0 && newH > 0) {
                selectionRect.w = newW;
                selectionRect.h = newH;
            }
            break;
            }
        }
        }
    
        // Synchronously redraw
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(lastDrawnImage, 0, 0);
        drawSelection();
    });
    
    // ─── in your select-mode mouseup handler ─────────────────────────────────
    window.addEventListener('mouseup', () => {
      if (!selectionMode) return;

      const applyAll = document.getElementById('flexCheckDefault').checked;

      if (isDraggingRect || isResizingRect) {
        if (applyAll) {
          // Copy the rect to ALL images
          selectionRects = selectionRects.map(() => ({ ...selectionRect }));
          console.log("Applied selectionRect to all images.");
        } else {
          // Save rect only for this image
          selectionRects[imageIndex] = { ...selectionRect };
          selectionChangedIndex = imageIndex;
        }
      }

      isDraggingRect = false;
      isResizingRect = false;
      activeHandle   = null;
    });


  
});








document.getElementById('downloadSampleBtn').addEventListener('click', async () => {
    const baseSamples = {
        head: {
            spring_barley_heads: ['DJI_0101_1.png', 'DJI_0183.JPG', 'DJI_0189.JPG', 'DJI_0208_3.jpg', 'DJI_0208_6.jpg', 'DJI_0215_3.jpg', 'DJI_0233_1.jpg'],
            spring_wheat_heads: ['DJI_0101_13.png', 'DJI_0101_14.png', 'DJI_0101_15.png', 'DJI_0101_16.png', 'DJI_0101_17.png'],
            winter_rye_heads: ['DJI_20240614115013_0572_D_crop_1.png', 'DJI_20240614115013_0572_D_crop_2.png', 'DJI_20240614115013_0572_D_crop_3.png', 'DJI_20240614115013_0572_D_crop_4.png', 'DJI_20240614115013_0572_D_crop_5.png'],
            winter_triticale_heads: ['DJI_20240614114701_0481_D_crop_13.png', 'DJI_20240614114701_0481_D_crop_15.png', 'DJI_20240614114701_0481_D_crop_18.png', 'DJI_20240614114701_0481_D_crop_19.png', 'DJI_20240614114701_0481_D_crop_20.png'],
            winter_wheat_heads: ['DJI_20240614114054_0307_D_crop_2.png', 'DJI_20240614114054_0307_D_crop_3.png', 'DJI_20240614114054_0307_D_crop_4.png', 'DJI_20240614114054_0307_D_crop_5.png', 'DJI_20240614114054_0307_D_crop_7.png']
        },
        sepal: {
            spring_barley_sepal: [
                '0aaa37d9-45c8-4f2e-8c4d-08df001bfaae.jpg', '0b74b891-7a8c-4efd-86b0-3afee9b56686.jpg', '0c0c7e4d-7a9d-4463-84fd-a1bbc9a6de32.jpg',
                '0c62780a-e168-47b7-bb5e-fc3abdb2bd21.jpg', '0c439669-4578-461c-a16f-f3de87cf23a9.jpg'
            ],
            spring_wheat_sepal: [
                '00bb6cd9-5816-44c9-ac0a-d39dc6bf8bd8.jpg', '00c0ec85-eaef-4818-b6e1-73b1df46e868.jpg',
                '0c1ae109-8bf3-43b6-bd37-8e5514fcbd1f.jpg', '0d1e1425-9629-4826-9a1b-0cbd70981adb.jpg',
                '0f4df07b-e7fa-4953-b455-82a91d37906e.jpg'
            ],
            // winter_rye_sepal: [
            //     '1a_crop_0_0.jpg', '1a.JPG', '1b_crop_3_5.jpg', '1b.JPG', '2a_crop_0_5.jpg', '2b_crop_0_7.jpg'
            // ],
            // winter_triticale_sepal: [
            //     '1a_crop_0_0.jpg', '1a_crop_0_1.jpg', '1b_crop_1_6.jpg', '1b_crop_1_7.jpg', '2a_crop_0_2.jpg'
            // ],
            // winter_wheat_sepal: [
            //     '1a_crop_0_1.jpg', '1b_crop_0_6.jpg', '2a_crop_0_0.jpg', '2b_crop_0_6.jpg', '3a_crop_0_4.jpg'
            // ]
        },
        stubble: ['20240816_084004_8aa711e3ed19a72d_6.jpeg', '20240816_084058_8aa711e3ed19a72d_48.jpeg', '20240816_084101_8aa711e3ed19a72d_52.jpeg']
    };

    const cropType = document.getElementById('downloadSampleBtn')?.getAttribute('data-type') || 'stubble';
    const folders = baseSamples[cropType] || {};
    const folderNames = Object.keys(folders).filter(folder => folders[folder].length > 0);
    if (!folderNames.length) return alert(`No sample folders with images for crop type: ${cropType}`);

    const folder = folderNames[Math.floor(Math.random() * folderNames.length)];
    let imageUrl;
    let randomImage;

    if (cropType === 'stubble') {
        randomImage = baseSamples.stubble[Math.floor(Math.random() * baseSamples.stubble.length)];
        imageUrl = `/static/downloads/stubble/${randomImage}`;
    } else {
        const images = folders[folder];
        randomImage = images[Math.floor(Math.random() * images.length)];
        imageUrl = `/static/downloads/${cropType}/${folder}/${randomImage}`;
    }`/static/downloads/${cropType}/${folder}/${randomImage}`;

    try {
        const fileBlob = await fetch(imageUrl).then(res => res.blob());
        const file = new File([fileBlob], randomImage, { type: fileBlob.type });

        // Auto-select matching radio button if applicable
        let composedId = folder.replace(/_(heads|sepal)s?$/, '');
        if (cropType === 'stubble') composedId = 'stubble';
        const radio = document.querySelector(`input[type="radio"][id*="${composedId}"]`);
        if (radio) radio.checked = true;

        console.log("Sample image loaded:", imageUrl);

        uploadedImages = [file];
        processedImages = [null];
        processedData   = [null];
        imageCounts     = ['Loaded'];
        imageIndex      = 0;
      
        // ⬇️ CLEAR OLD SELECTIONS:
        selectionRects         = [null];
        selectionChangedIndex  = null;
        selectionMode          = false;
        selectionRect          = null;
        selectBtn.classList.remove('active');
        updateSelectButtonState();
      
        renderImageSlider();
        updateResultsTable();
        toggleCountButton();

    } catch (err) {
        console.error(err);
        alert('Failed to load sample image.');
    }
});























canvas.addEventListener('touchstart', e => {
    if (!selectionMode) return;
  
    if (e.touches.length === 2) {
      // Begin pinch
      e.preventDefault();
      const [t0, t1] = e.touches;
      touchInitialDistanceX = Math.abs(t1.clientX - t0.clientX);
      touchInitialDistanceY = Math.abs(t1.clientY - t0.clientY);
      touchInitialRect      = { ...selectionRect };
    }
    else if (e.touches.length === 1 && selectionRect) {
      // Begin drag or corner‐resize
      e.preventDefault();
      const pos    = getCanvasTouchPos(e.touches[0]);
      const handle = getHandleUnderMouse(pos.x, pos.y);
      if (handle) {
        isResizingRect = true;
        activeHandle   = handle;
      } else if (isInsideRect(pos.x, pos.y)) {
        isDraggingRect = true;
        dragOffset.x   = pos.x - selectionRect.x;
        dragOffset.y   = pos.y - selectionRect.y;
      }
    }
  }, { passive: false });
  
  canvas.addEventListener('touchmove', e => {
    if (!selectionMode) return;
  
    if (e.touches.length === 2 && touchInitialRect) {
      // Pinch → stretch horizontally or vertically
      e.preventDefault();
      const [t0, t1] = e.touches;
      const currX = Math.abs(t1.clientX - t0.clientX);
      const currY = Math.abs(t1.clientY - t0.clientY);
      const cx = touchInitialRect.x + touchInitialRect.w / 2;
      const cy = touchInitialRect.y + touchInitialRect.h / 2;
  
      if (currX > currY) {
        // Horizontal stretch
        const factor = currX / touchInitialDistanceX;
        selectionRect.w = touchInitialRect.w * factor;
        selectionRect.h = touchInitialRect.h;
        selectionRect.x = cx - selectionRect.w / 2;
        selectionRect.y = touchInitialRect.y;
      } else {
        // Vertical stretch
        const factor = currY / touchInitialDistanceY;
        selectionRect.h = touchInitialRect.h * factor;
        selectionRect.w = touchInitialRect.w;
        selectionRect.y = cy - selectionRect.h / 2;
        selectionRect.x = touchInitialRect.x;
      }
  
      // Redraw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(lastDrawnImage, 0, 0);
      drawSelection();
    }
    else if (e.touches.length === 1 && (isDraggingRect || isResizingRect)) {
      // Drag or corner‐resize exactly like your mouse code
      e.preventDefault();
      const { x: mx, y: my } = getCanvasTouchPos(e.touches[0]);
  
      if (isDraggingRect) {
        selectionRect.x = mx - dragOffset.x;
        selectionRect.y = my - dragOffset.y;
      } else {
        // Copy your existing corner‐resize switch here:
        switch (activeHandle) {
          case 'nw': {
            const newW = selectionRect.w + (selectionRect.x - mx);
            const newH = selectionRect.h + (selectionRect.y - my);
            if (newW > 0 && newH > 0) {
              selectionRect.x = mx;
              selectionRect.y = my;
              selectionRect.w = newW;
              selectionRect.h = newH;
            }
            break;
          }
          case 'ne': {
            const newW = mx - selectionRect.x;
            const newH = selectionRect.h + (selectionRect.y - my);
            if (newW > 0 && newH > 0) {
              selectionRect.y = my;
              selectionRect.w = newW;
              selectionRect.h = newH;
            }
            break;
          }
          case 'sw': {
            const newW = selectionRect.w + (selectionRect.x - mx);
            const newH = my - selectionRect.y;
            if (newW > 0 && newH > 0) {
              selectionRect.x = mx;
              selectionRect.w = newW;
              selectionRect.h = newH;
            }
            break;
          }
          case 'se': {
            const newW = mx - selectionRect.x;
            const newH = my - selectionRect.y;
            if (newW > 0 && newH > 0) {
              selectionRect.w = newW;
              selectionRect.h = newH;
            }
            break;
          }
        }
      }
  
      // Redraw
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(lastDrawnImage, 0, 0);
      drawSelection();
    }
  }, { passive: false });
  
  canvas.addEventListener('touchend', e => {
    if (!selectionMode) return;
  
    if (touchInitialRect && e.touches.length < 2) {
      // Pinch ended
      touchInitialRect      = null;
      touchInitialDistanceX = 0;
      touchInitialDistanceY = 0;
      selectionChangedIndex = imageIndex;
    }
    if (isDraggingRect || isResizingRect) {
      // Drag/resize ended
      isDraggingRect = false;
      isResizingRect = false;
      activeHandle   = null;
      selectionChangedIndex = imageIndex;
    }
  });

