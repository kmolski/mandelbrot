const canvas = document.getElementById("canvas");
const docElement = document.documentElement;

const maxIterations = 1000;
const minRe = -2, maxRe = 0.5; // Set projection bounds in the real axis

const updateCanvasDistance = 2;
const updateCanvasZoom = 10;

const tileEdge = 320;

let posRe = (minRe + maxRe) / 2, posIm = 0;
let pixelArray = new Uint8ClampedArray(tileEdge * tileEdge * 4);

const pixelToCoordinate = (width, height, zoom, posX, posY) => {
    // Convert pixel coordinates to coordinates on the complex plane,
    // such that the point P(posX, posY) is in the center of the canvas.
    return [ posRe + (posX - width  / 2) * zoom / tileEdge,
             posIm - (posY - height / 2) * zoom / tileEdge ];
}

const coordinateToPixel = (width, height, zoom, pRe, pIm) => {
    return [ (pRe - posRe) * tileEdge / zoom + width  / 2,
            -(pIm - posIm) * tileEdge / zoom + height / 2 ];
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

const updateCanvas = (width, height, zoom, tiles) => {
    let drawContext = canvas.getContext("2d");

    canvas.width = width, canvas.height = height;

    if (!tiles[zoom]) {
        tiles[zoom] = [];
    }

    let [lowRe, highIm] = pixelToCoordinate(width, height, zoom, 0, 0);
    let [highRe, lowIm] = pixelToCoordinate(width, height, zoom, width, height);
    lowRe = Math.floor(lowRe * zoom) / zoom, highIm = Math.ceil(highIm * zoom) / zoom;

    drawContext.setTransform(1, 0, 0, 1, 0, 0);
    drawContext.scale(zoom, zoom);

    for (let posIm = highIm; posIm > lowIm; posIm -= (1 / zoom)) {
        if (!tiles[zoom][posIm]) {
            tiles[zoom][posIm] = [];
        }

        for (let posRe = lowRe; posRe < highRe; posRe += (1 / zoom)) {
            let [startX, startY] = coordinateToPixel(width, height, zoom, posRe, posIm).map(Math.round);

            if (!tiles[zoom][posIm][posRe]) {
                for (let posY = 0; posY < tileEdge; ++posY) {
                    for (let posX = 0; posX < tileEdge; ++posX) {
                        let indexBase = (posY * tileEdge + posX) * 4;
                        let [re, im] = pixelToCoordinate(width, height, zoom, startX + posX, startY + posY);
                        let [red, green, blue] = getColor(re, im);

                        pixelArray[indexBase + 0] = red;
                        pixelArray[indexBase + 1] = green;
                        pixelArray[indexBase + 2] = blue;
                        pixelArray[indexBase + 3] = 255;
                    }
                }

                let imageData = new ImageData(pixelArray, tileEdge, tileEdge);
                createImageBitmap(imageData, 0, 0, tileEdge, tileEdge)
                    .then((bitmap) => {
                        tiles[zoom][posIm][posRe] = bitmap;
                        drawContext.drawImage(bitmap, startX, startY, tileEdge, tileEdge);
                    });
            } else {
                drawContext.drawImage(tiles[zoom][posIm][posRe], startX, startY, tileEdge, tileEdge);
            }
        }
    }
}

//window.onresize = (window, event) => { console.log(event.width, event.height); };
updateCanvas(docElement.clientWidth, docElement.clientHeight, 1, []);