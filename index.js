const canvas = document.getElementById("canvas");
const docElement = document.documentElement;

const maxIterations = 1000;
const minRe = -2, maxRe = 0.5; // Set projection bounds in the real axis

const updateCanvasDistance = 2;
const updateCanvasZoom = 10;

const tileScale = 1 + 2 * updateCanvasDistance;

let posRe = (minRe + maxRe) / 2, posIm = 0, zoom = 300;
let pixelArray;

const pixelToCoordinate = (width, height, posX, posY) => {
    // Convert pixel coordinates to coordinates on the complex plane,
    // such that the point P(posX, posY) is in the center of the canvas.
    return [ (posX - width * tileScale / 2)  / zoom + posRe,
             (posY - height * tileScale / 2) / zoom - posIm ];
}

const getColor = (re, im) => {
    let zRe = 0, zIm = 0, zReSquared = 0, zImSquared = 0; // Z0 is 0

    // The point is considered to belong to the Mandelbrot set if the
    // absolute value of Z_n is less than or equal to 2 for all n >= 0.
    for (var i = 0; i < maxIterations && (zReSquared + zImSquared) <= 4; ++i) {
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

const updateCanvas = () => {
    const height = docElement.clientHeight, width = docElement.clientWidth;
    canvas.height = height, canvas.width = width;

    // Update event handlers with the current zoom level and canvas size,
    // so that dragging and zoomint actions behave correctly.
    updateEventHandlers(posRe, posIm, zoom);

    const drawContext = canvas.getContext("2d");
    const pixelArraySize = height * tileScale * width * tileScale * 4;

    if (!pixelArray || pixelArray.length !== pixelArraySize) {
        pixelArray = new Uint8ClampedArray(pixelArraySize)
    }

    for (let posY = 0; posY < height * tileScale; ++posY) {
        for (let posX = 0; posX < width * tileScale; ++posX) {
            let indexBase = (posY * width * tileScale + posX) * 4;
            let [re, im] = pixelToCoordinate(width, height, posX, posY);
            let [red, green, blue] = getColor(re, im);

            pixelArray[indexBase + 0] = red;
            pixelArray[indexBase + 1] = green;
            pixelArray[indexBase + 2] = blue;
            pixelArray[indexBase + 3] = 255;
        }

    }

    let imageData = new ImageData(pixelArray, width * tileScale, height * tileScale);

    let offsetX = updateCanvasDistance * width, offsetY = updateCanvasDistance * height;
    // dirtyX and dirtyY parameters shift the destination image as well as the source,
    // so -offsetX/Y has to be supplied to dx and dy args to draw the destination at (0, 0)
    drawContext.putImageData(imageData, -offsetX, -offsetY, offsetX, offsetY, width, height);
}

const transformCanvas = (diffX, diffY, zoomFactor) => {
    const height = canvas.height, width = canvas.width;

    // FIXME: offsetX/Y is not calculated correctly while zooming!
    const offsetX = updateCanvasDistance * width  * zoomFactor + diffX;
    const offsetY = updateCanvasDistance * height * zoomFactor - diffY;

    const drawContext = canvas.getContext("2d");
    // The default transformation has to be set, because calling scale()
    // would otherwise multiply the previous scale by zoomFactor, not set it
    drawContext.setTransform(1, 0, 0, 1, 0, 0);
    drawContext.scale(zoomFactor, zoomFactor);

    let imageData = new ImageData(pixelArray, width * tileScale, height * tileScale);
    createImageBitmap(
        imageData, offsetX, offsetY,
        width / zoomFactor, height / zoomFactor
    ).then((bitmap) => {
        drawContext.drawImage(bitmap, 0, 0, width / zoomFactor, height / zoomFactor);
    });
}

const updateEventHandlers = (lastRe, lastIm, lastZoom) => {
    canvas.onmousedown = (event) => {
        const width = canvas.width, height = canvas.height;
        const preRe = posRe, preIm = posIm;
        const preX = event.clientX, preY = event.clientY;

        canvas.onmousemove = (event) => {
            const postX = event.clientX, postY = event.clientY;
            posRe = preRe - (postX - preX) / zoom, posIm = preIm + (postY - preY) / zoom;

            const diffX = (posRe - lastRe) * zoom, diffY = (posIm - lastIm) * zoom;
            if (Math.abs(diffX) > updateCanvasDistance * width ||
                Math.abs(diffY) > updateCanvasDistance * height) {
                updateCanvas();
            } else {
                transformCanvas(diffX, diffY, zoom / lastZoom);
            }
        }

        canvas.onmouseup = () => {
            canvas.onmousemove = null;
        }
    }

    canvas.onwheel = (event) => {
        if (event.deltaY) {
            zoom = zoom * (100 - event.deltaY) / 100;
            if (zoom / lastZoom > updateCanvasZoom) {
                updateCanvas();
            } else {
                const diffX = (posRe - lastRe) * zoom, diffY = (posIm - lastIm) * zoom;
                transformCanvas(diffX, diffY, zoom / lastZoom);
            }
        }
    }
}

window.onresize = updateCanvas;
updateCanvas();