const canvas = document.getElementById("canvas");
const docElement = document.documentElement;

const maxIterations = 1000;
const minX = -2, maxX = 0.5; // Set projection bounds in the real axis

var posX = (minX + maxX) / 2, posY = 0, zoom = 300;

const pixelToCoordinate = (width, height, pxRe, pxIm) => {
    // Convert pixel coordinates to coordinates on the complex plane,
    // such that the point P(posX, posY) is in the center of the canvas
    return [ (pxRe - width / 2 ) / zoom + posX, (pxIm - height / 2) / zoom + posY ]
}

const getColor = (re, im) => {
    let i = 1, zRe = 0, zIm = 0, zReSquared = 0, zImSquared = 0; // Z0 is 0

    // The point is considered to belong to the Mandelbrot set if the
    // absolute value of Z_n is less than or equal to 2 for all n >= 0.
    for (; i < maxIterations && (zReSquared + zImSquared) <= 4; ++i) {
        // Z_n ^ 2 == (zRe + zIm * i) * (zRe + zIm * i)
        //         == (zRe ^ 2 - zIm ^ 2) + i * (zRe * zIm) ^ 2
        zIm = 2 * zRe * zIm + im;
        zRe = zReSquared - zImSquared + re;
        // Z_n+1 == Z_n ^ 2 + c
        zReSquared = zRe * zRe, zImSquared = zIm * zIm;
    }

    return i == maxIterations ? [0, 0, 0]
                : [(i + 10) % 256, (i + 25) % 256, (i + 50) % 256];
}

const updateCanvas = () => {
    let height = docElement.clientHeight, width = docElement.clientWidth;

    canvas.height = height, canvas.width = width;

    const drawContext = canvas.getContext("2d");
    let pixelArray = new Uint8ClampedArray(width * 4);

    for (let pxIm = 0; pxIm < height; ++pxIm) {
        for (let pxRe = 0; pxRe < width; ++pxRe) {
            let indexBase = pxRe * 4;
            let [re, im] = pixelToCoordinate(width, height, pxRe, pxIm);
            let [red, green, blue] = getColor(re, im);

            pixelArray[indexBase + 0] = red;
            pixelArray[indexBase + 1] = green;
            pixelArray[indexBase + 2] = blue;
            pixelArray[indexBase + 3] = 255;
        }

        let imageData = new ImageData(pixelArray, width);
        drawContext.putImageData(imageData, 0, pxIm);
    }
}

window.onresize = updateCanvas;
updateCanvas();

// canvas.onscroll - TODO: zoom!