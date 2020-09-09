const canvas = document.getElementById("canvas");
const docElement = document.documentElement;

const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");

const autoTable = (depth) => new Proxy([], {
    get: (arr, i) => i in arr ? arr[i] : (depth ? arr[i] = autoTable(depth - 1) : undefined)
});
const bytesPerPixel = 4;

const maxIterations = 1000;
const modLimit = 1000;
const sampleCount = 2;
const zoomSpeed = 100;
const tileEdge = 320;

const minRe = -2, maxRe = 0.5; // Set projection bounds in the real axis
const initRe = (minRe + maxRe) / 2, initIm = 0;

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

const getColor = (re, im) => {
    let zRe = 0, zIm = 0, zReSquared = 0, zImSquared = 0; // Z0 is 0

    // The point is considered to belong to the Mandelbrot set if the absolute
    // value of Z_n is less than or equal to R (modLimit) for all n >= 0, R >= 2.
    for (var i = 0; i < maxIterations && (zReSquared + zImSquared) < modLimit * modLimit; ++i) {
        //  Z_n+1  = Z_n ^ 2 + c
        // Z_n ^ 2 = (zRe + zIm * i) * (zRe + zIm * i)
        //         = (zRe ^ 2 - zIm ^ 2) + (2 * zRe * zIm) * i
        zIm = 2 * zRe * zIm + im;
        zRe = zReSquared - zImSquared + re;
        zReSquared = zRe * zRe, zImSquared = zIm * zIm;
    }

    return i == maxIterations ? [0, 0, 0]
                : [(i + 10) % 256, (i + 25) % 256, (i + 50) % 256];
}

const makeTile = async (width, height, nZoom, re, im, posRe, posIm) => {
    const sTileEdge = tileEdge * sampleCount;
    const pixelArray = new Uint8ClampedArray(sTileEdge * sTileEdge * bytesPerPixel);

    const [baseX, baseY] = coordinateToPixel(
        width, height, nZoom * sampleCount, re, im, posRe, posIm
    ).map(Math.round);

    for (let posY = 0; posY < sTileEdge; ++posY) {
        for (let posX = 0; posX < sTileEdge; ++posX) {
            const indexBase = (posY * sTileEdge + posX) * bytesPerPixel;
            const [re, im] = pixelToCoordinate(
                width, height, nZoom * sampleCount, baseX + posX, baseY + posY, posRe, posIm
            );
            const [red, green, blue] = getColor(re, im);

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
    let locked = false;

    return async (width, height, zoom, posRe, posIm, tiles) => {
        if (locked) return;
        locked = true;

        const sIndex = Math.round(Math.log2(zoom)), nZoom = Math.pow(2, sIndex);
        const sFactor = zoom / nZoom, sEdge = Math.ceil(tileEdge * sFactor);

        let [lowRe, highIm] = pixelToCoordinate(width, height, zoom, 0, 0, posRe, posIm);
        let [highRe, lowIm] = pixelToCoordinate(width, height, zoom, width, height, posRe, posIm);
        lowRe = Math.floor(lowRe * nZoom) / nZoom, highIm = Math.ceil(highIm * nZoom) / nZoom;

        for (let im = highIm; im > lowIm; im -= (1 / nZoom)) {
            for (let re = lowRe; re < highRe; re += (1 / nZoom)) {
                if (!tiles[sIndex][im][re]) {
                    tiles[sIndex][im][re] = await makeTile(
                        width, height, nZoom, re, im, posRe, posIm
                    );
                }
            }
        }

        canvas.width = width, canvas.height = height;
        const drawContext = canvas.getContext("2d");
        const [baseX, baseY] = coordinateToPixel(
            width, height, zoom, lowRe, highIm, posRe, posIm
        ).map(Math.floor);

        for (let im = highIm, destY = baseY; im > lowIm; im -= (1 / nZoom), destY += sEdge) {
            for (let re = lowRe, destX = baseX; re < highRe; re += (1 / nZoom), destX += sEdge) {
                drawContext.drawImage(
                    tiles[sIndex][im][re], destX, destY, sEdge, sEdge
                );
            }
        }

        updateEventHandlers(width, height, zoom, posRe, posIm, tiles);
        locked = false;
    }
})();

const updateEventHandlers = (width, height, zoom, posRe, posIm, tiles) => {
    window.onresize = async () => {
        const newWidth = docElement.clientWidth, newHeight = docElement.clientHeight;
        await updateCanvas(newWidth, newHeight, zoom, posRe, posIm, tiles);
    }

    canvas.onmousedown = (event) => {
        const initX = event.clientX, initY = event.clientY;

        canvas.onmousemove = async (event) => {
            const newRe = posRe + (initX - event.clientX) / zoom / tileEdge;
            const newIm = posIm - (initY - event.clientY) / zoom / tileEdge;
            await updateCanvas(width, height, zoom, newRe, newIm, tiles);
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

            await updateCanvas(width, height, newZoom, newRe, newIm, tiles);
            // Update canvas.onmousemove() so that dragging after zooming works correctly.
            if (canvas.onmousemove) { canvas.onmousedown(event); }
        }
    }

    const changeZoom = async (zoomDiff) => {
        const newZoom = Math.max(zoom * (1 + zoomDiff), 1);
        await updateCanvas(width, height, newZoom, posRe, posIm, tiles);
    }

    zoomInBtn.onclick  = async () => changeZoom(0.5);
    zoomOutBtn.onclick = async () => changeZoom(-0.5);

    setZoom = (newZoom) => {
        updateCanvas(width, height, newZoom, posRe, posIm, tiles);
    }
}

const initWidth = docElement.clientWidth, initHeight = docElement.clientHeight;
updateCanvas(initWidth, initHeight, 1, initRe, initIm, autoTable(2));
