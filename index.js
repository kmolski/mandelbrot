const canvas = document.getElementById("canvas");
const docElement = document.documentElement;

const maxIterations = 1000;
const tileEdge = 320;

const minRe = -2, maxRe = 0.5; // Set projection bounds in the real axis
const initRe = (minRe + maxRe) / 2, initIm = 0;

let pixelArray = new Uint8ClampedArray(tileEdge * tileEdge * 4);

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
            -(im - posIm) * zoom * tileEdge + height / 2 ];
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

const updateCanvas = async (width, height, zoom, posRe, posIm, tiles) => {
    canvas.width = width, canvas.height = height;

    let drawContext = canvas.getContext("2d");

    let sIndex = Math.round(Math.log2(zoom));
    let nZoom = Math.pow(2, sIndex);
    let sFactor = zoom / nZoom;

    let [lowRe, highIm] = pixelToCoordinate(width, height, zoom, 0, 0, posRe, posIm);
    let [highRe, lowIm] = pixelToCoordinate(width, height, zoom, width, height, posRe, posIm);
    lowRe = Math.floor(lowRe * nZoom) / nZoom, highIm = Math.ceil(highIm * nZoom) / nZoom;
    console.log(lowRe, highIm, 1 / nZoom);

    if (!tiles[sIndex]) {
        removeEventHandlers();
        tiles[sIndex] = [];
    }
    let newTiles = 0;

    for (let currIm = highIm; currIm > lowIm; currIm -= (1 / nZoom)) {
        if (!tiles[sIndex][currIm]) { tiles[sIndex][currIm] = []; }

        for (let currRe = lowRe; currRe < highRe; currRe += (1 / nZoom)) {
            let [startX, startY] = coordinateToPixel(
                width, height, zoom, currRe, currIm, posRe, posIm
            ).map(Math.round);

            if (!tiles[sIndex][currIm][currRe]) {
                let [baseX, baseY] = coordinateToPixel(
                    width, height, nZoom, currRe, currIm, posRe, posIm
                ).map(Math.round);

                console.log("Making tile no.", ++newTiles);

                for (let posY = 0; posY < tileEdge; ++posY) {
                    for (let posX = 0; posX < tileEdge; ++posX) {
                        let indexBase = (posY * tileEdge + posX) * 4;
                        let [re, im] = pixelToCoordinate(
                            width, height, nZoom, baseX + posX, baseY + posY, posRe, posIm
                        );
                        let [red, green, blue] = getColor(re, im);

                        pixelArray[indexBase + 0] = red;
                        pixelArray[indexBase + 1] = green;
                        pixelArray[indexBase + 2] = blue;
                        pixelArray[indexBase + 3] = 255;
                    }
                }

                let imageData = new ImageData(pixelArray, tileEdge, tileEdge);
                tiles [sIndex][currIm][currRe] = await createImageBitmap(
                    imageData, 0, 0, tileEdge, tileEdge
                );
            }
            drawContext.drawImage(
                tiles[sIndex][currIm][currRe], startX, startY, tileEdge * sFactor, tileEdge * sFactor
            );
        }
    }

    updateEventHandlers(width, height, zoom, posRe, posIm, tiles);
}

const updateEventHandlers = (width, height, zoom, posRe, posIm, tiles) => {
    window.onresize = async () => {
        let newWidth = docElement.clientWidth, newHeight = docElement.clientHeight;
        await updateCanvas(newWidth, newHeight, zoom, posRe, posIm, tiles);
    }

    canvas.onmousedown = (event) => {
        let initX = event.clientX, initY = event.clientY;

        canvas.onmousemove = async (event) => {
            let newRe = posRe + (initX - event.clientX) / zoom / tileEdge;
            let newIm = posIm - (initY - event.clientY) / zoom / tileEdge;
            await updateCanvas(width, height, zoom, newRe, newIm, tiles);
        }

        canvas.onmouseup = () => {
            canvas.onmousemove = null;
        }
    }


    canvas.onwheel = async (event) => {
        if (event.deltaY) {
            let newZoom = (100 * zoom - event.deltaY) / 100;
            await updateCanvas(width, height, newZoom, posRe, posIm, tiles);
        }
    }

    setZoom = (newZoom) => {
        updateCanvas(width, height, newZoom, posRe, posIm, tiles);
    }
}

const removeEventHandlers = () => {
    window.onresize = () => {};
    canvas.onmousedown = () => {};
    canvas.onmousemove = () => {};
    canvas.onwheel = () => {};
}

let initWidth = docElement.clientWidth, initHeight = docElement.clientHeight;
updateEventHandlers(initWidth, initHeight, 1 , initRe, initIm, []);
updateCanvas(initWidth, initHeight, 1, initRe, initIm, []);