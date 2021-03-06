const canvas = document.getElementById("canvas");
const docElement = document.documentElement;

const renderingPopupBg = document.getElementById("renderingPopupBg");
const settingsPopup = document.getElementById("settingsPopup");

const reInputField = document.getElementById("reInput");
const imInputField = document.getElementById("imInput");
const zoomInputField = document.getElementById("zoomInput");
const zoomAndPositionForm = document.getElementById("zoomAndPosition");

const renderSettingsFields = {
    maxIterations: document.getElementById("maxIterInput"),
    modLimit:      document.getElementById("modLimitInput"),
    sampleCount:   document.getElementById("sampleCountInput"),
    zoomSpeed:     document.getElementById("zoomSpeedInput"),
};
const renderSettingsForm = document.getElementById("renderSettings");

const autoTable = (depth) => new Proxy([], {
    get: (arr, i) => i in arr ? arr[i] : (depth ? arr[i] = autoTable(depth - 1) : undefined)
});

const bytesPerPixel = 4;
const tileEdge = 320;
const minRe = -2.0, maxRe = 0.5; // Set projection bounds in the real axis
const initRe = (minRe + maxRe) / 2, initIm = 0;

const initSettings = {
    maxIterations: 1000, modLimit: 1000, sampleCount: 2, zoomSpeed: 100
};

const pixelToCoordinate = (width, height, zoom, posX, posY, posRe, posIm) => {
    // Convert pixel coordinates to coordinates on the complex plane,
    // such that the point P(posRe, posIm) is in the center of the canvas.
    return [ posRe + (posX - width  / 2) / zoom / tileEdge,
             posIm - (posY - height / 2) / zoom / tileEdge ];
}

const coordinateToPixel = (width, height, zoom, re, im, posRe, posIm) => {
    // Convert complex plane coordinates to pixel coordinates on the canvas,
    // such that the point P(posRe, posIm) is in the center of the plane.
    return [ (re - posRe) * zoom * tileEdge + width  / 2,
             (posIm - im) * zoom * tileEdge + height / 2 ];
}

const getColor = (re, im, {maxIterations, modLimit}) => {
    let zRe = 0, zIm = 0, zReSquared = 0, zImSquared = 0; // Z0 is 0

    // The point is considered to belong to the Mandelbrot set if the absolute
    // value of Z_n is less than or equal to R (modLimit) for all n >= 0, R >= 2.
    for (var i = 0; i < maxIterations && (zReSquared + zImSquared) <= modLimit ** 2; ++i) {
        //  Z_n+1  = Z_n ^ 2 + c
        // Z_n ^ 2 = (zRe + zIm * i) * (zRe + zIm * i)
        //         = (zRe ^ 2 - zIm ^ 2) + (2 * zRe * zIm) * i
        zIm = 2 * zRe * zIm + im;
        zRe = zReSquared - zImSquared + re;
        zReSquared = zRe * zRe, zImSquared = zIm * zIm;
    }

    const potentialVal = Math.log(Math.log(zReSquared + zImSquared) / (2 ** i));
    const colorFn = (mult) => Math.round(Math.cos(potentialVal + mult * Math.PI) * 127) + 128;

    return i == maxIterations ? [0, 0, 0] : [ colorFn(0.5), colorFn(1.0), colorFn(1.5) ];
}

const makeTile = async (nZoom, re, im, settings) => {
    const {sampleCount} = settings;
    const sTileEdge = tileEdge * sampleCount;
    const pixelArray = new Uint8ClampedArray(sTileEdge * sTileEdge * bytesPerPixel);

    for (let posY = 0; posY < sTileEdge; ++posY) {
        for (let posX = 0; posX < sTileEdge; ++posX) {
            const indexBase = (posY * sTileEdge + posX) * bytesPerPixel;
            const [red, green, blue] = getColor(
                re + posX / nZoom / sTileEdge, im - posY / nZoom / sTileEdge, settings
            );

            pixelArray[indexBase + 0] = red;
            pixelArray[indexBase + 1] = green;
            pixelArray[indexBase + 2] = blue;
            pixelArray[indexBase + 3] = 255;
        }
    }

    const imageData = new ImageData(pixelArray, sTileEdge, sTileEdge);
    return createImageBitmap(imageData, 0, 0, sTileEdge, sTileEdge);
};

const updateCanvas = (() => {
    // This lock ensures that the canvas is only modified by one event handler at a time.
    let locked = false;

    return async (zoom, posRe, posIm, tiles, settings) => {
        if (locked) return;
        locked = true;

        // sIndex is used to select the correct tile set for the current zoom level
        const sIndex = Math.round(Math.log2(zoom)), nZoom = 2 ** sIndex;
        const sFactor = zoom / nZoom, sEdge = Math.ceil(tileEdge * sFactor);
        const width = docElement.clientWidth, height = docElement.clientHeight;

        let [lowRe, highIm] = pixelToCoordinate(width, height, zoom, 0, 0, posRe, posIm);
        let [highRe, lowIm] = pixelToCoordinate(width, height, zoom, width, height, posRe, posIm);
        lowRe = Math.floor(lowRe * nZoom) / nZoom, highIm = Math.ceil(highIm * nZoom) / nZoom;

        for (let im = highIm; im > lowIm; im -= (1 / nZoom)) {
            for (let re = lowRe; re < highRe; re += (1 / nZoom)) {
                if (!tiles[sIndex][im][re]) {
                    renderingPopupBg.style.visibility = "visible";
                    renderingPopupBg.style.opacity = 1;
                    tiles[sIndex][im][re] = await makeTile(nZoom, re, im, settings);
                }
            }
        }

        canvas.width = width, canvas.height = height;
        const drawContext = canvas.getContext("2d");
        const [baseX, baseY] = coordinateToPixel(
            width, height, zoom, lowRe, highIm, posRe, posIm
        ).map(Math.round);

        for (let im = highIm, destY = baseY; im > lowIm; im -= (1 / nZoom), destY += sEdge) {
            for (let re = lowRe, destX = baseX; re < highRe; re += (1 / nZoom), destX += sEdge) {
                drawContext.drawImage(tiles[sIndex][im][re], destX, destY, sEdge, sEdge);
            }
        }

        renderingPopupBg.style.opacity = 0;
        setTimeout(() => { renderingPopupBg.style.visibility = "hidden"; }, 200);

        updateEventHandlers(width, height, zoom, posRe, posIm, tiles, settings);
        updateSettingsPopup(width, height, zoom, posRe, posIm, tiles, settings);
        locked = false;
    }
})();

const updateEventHandlers = (width, height, zoom, posRe, posIm, tiles, settings) => {
    const {zoomSpeed} = settings;

    window.onresize = async () => {
        await updateCanvas(zoom, posRe, posIm, tiles, settings);
    }

    canvas.onmousedown = (event) => {
        const initX = event.clientX, initY = event.clientY;

        canvas.onmousemove = async (event) => {
            const newRe = posRe + (initX - event.clientX) / zoom / tileEdge;
            const newIm = posIm - (initY - event.clientY) / zoom / tileEdge;
            await updateCanvas(zoom, newRe, newIm, tiles, settings);
        }

        canvas.onmouseup = () => {
            canvas.onmousemove = null;
        }
    }

    canvas.onwheel = async (event) => {
        if (event.deltaY) {
            const newZoom = zoom * (1 - event.deltaY / zoomSpeed);
            if (newZoom < 1) return;
            // Shift the position so that the cursor points at the same
            // coordinates on the complex plane before and after zooming.
            const offsetDivisor = (1 - zoomSpeed / event.deltaY) * zoom * tileEdge;
            const [newRe, newIm] = [ posRe + (event.clientX - width / 2)  / offsetDivisor,
                                     posIm + (height / 2 - event.clientY) / offsetDivisor ];

            await updateCanvas(newZoom, newRe, newIm, tiles, settings);
            // Update canvas.onmousemove() so that dragging after zooming works correctly.
            if (canvas.onmousemove) { canvas.onmousedown(event); }
        }
    }

    const changeZoom = async (zoomDiff) => {
        const newZoom = Math.max(zoom * (1 + zoomDiff), 1);
        await updateCanvas(newZoom, posRe, posIm, tiles, settings);
    }

    document.getElementById("zoomIn").onclick  = async () => changeZoom(+0.5);
    document.getElementById("zoomOut").onclick = async () => changeZoom(-0.5);
}

const updateSettingsPopup = (width, height, zoom, posRe, posIm, tiles, settings) => {
    reInputField.value = posRe, imInputField.value = posIm, zoomInputField.value = zoom;
    Object.entries(settings).forEach(([k, v]) => { renderSettingsFields[k].value = v; });

    zoomAndPositionForm.onsubmit = async () => {
        const newZoom = Number(zoomInputField.value);
        const newRe = Number(reInputField.value), newIm = Number(imInputField.value);
        await updateCanvas(newZoom, newRe, newIm, tiles, settings);
    }

    renderSettingsForm.onsubmit = async () => {
        const newSettings = Object.fromEntries(
            Object.entries(renderSettingsFields).map(([k, f]) => [k, Number(f.value)])
        );
        // Changing the rendering settings invalidates all previously rendered
        // tiles, so the tile array needs to be replaced by a new one.
        await updateCanvas(zoom, posRe, posIm, autoTable(2), newSettings);
    }
}

document.getElementById("openSettings").onclick = () => {
    if (settingsPopup.style.visibility === "visible") {
        settingsPopup.style.opacity = 0;
        setTimeout(() => { settingsPopup.style.visibility = "hidden"; }, 200);
    } else {
        settingsPopup.style.visibility = "visible";
        settingsPopup.style.opacity = 1;
    }
}

updateCanvas(1, initRe, initIm, autoTable(2), initSettings);
