let src;                    // src image
let scale;                  // scale factor
let cv;                     // OpenCV
let canvas;                 // canvas element
let ctx;                    // canvas context
const circles = [];         // array of circles
let circlesPerRow = 7;      // number of circles per row
let labelSize = 50;         // size of the label
let labelStrokeWidth = 3;   // stroke width of the label
let labelColor = '#000000'; // color of the label
let font = 'Arial';         // font of the label
let addCircleMode = false;   // add or remove circle mode
let lang = 'zh_cn';         // language

window.onload = function() {
    document.getElementById('languageSelector').dispatchEvent(new Event('change'));
}

function onOpenCvReady() {
    cv = window.cv;
    document.getElementById('fileButton').addEventListener('click', handleFileSelect, false);
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    canvas.addEventListener('click', handleClick);
}

function handleFileSelect(event) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function(event) {
        const file = event.target.files[0];
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0, img.width, img.height);
                circles.length = 0;
                src = cv.imread(canvas);
                // rescale the image
                scale = Math.min(1000 / img.width, 1000 / img.height);
                cv.resize(src, src, {width: 0, height: 0}, scale, scale, cv.INTER_AREA);
                processImage(src.clone());
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

function handleClick(event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;       // Scale factor for the x-coordinate
    const scaleY = canvas.height / rect.height;     // Scale factor for the y-coordinate

    const x = (event.clientX - rect.left) * scaleX;  // Scale mouse coordinates after they have
    const y = (event.clientY - rect.top) * scaleY;   // been adjusted to be relative to element

    if (addCircleMode) {
        circles.push({ x, y, radius: parseInt(canvas.width / circlesPerRow / 2, 10) });
    } else {
        const indexToRemove = circles.findIndex(circle => {
            const dx = circle.x - x;
            const dy = circle.y - y;
            return Math.sqrt(dx * dx + dy * dy) <= circle.radius;
        });
        if (indexToRemove !== -1) {
            circles.splice(indexToRemove, 1);
        }
    }
    redraw();
}

function processImage(img) {
    if (!cv || !cv.imread) {
        console.error('OpenCV not initialized properly.');
        return;
    }
    
    const gray = new cv.Mat();

    const detectedCircles = new cv.Mat();
    
    // Parameters for circle detection
    const minRadius = parseInt((0.6 * img.cols / circlesPerRow) / 2, 10);
    const maxRadius = parseInt((1.1 * img.cols / circlesPerRow) / 2, 10);

    cv.cvtColor(img, gray, cv.COLOR_RGBA2GRAY);
    // constrast
    // cv.threshold(gray, gray, 0, 255, cv.THRESH_TRUNC | cv.THRESH_OTSU);
    // GaussianBlur
    cv.GaussianBlur(gray, gray, {width: 9, height: 9}, 1.5, 1.5);
    cv.imshow('canvas', gray);
    cv.HoughCircles(gray, 
                    detectedCircles, 
                    cv.HOUGH_GRADIENT, 
                    1, 
                    2*minRadius, 
                    30, 
                    30, 
                    minRadius, 
                    maxRadius);

    circles.length = 0;
    for (let i = 0; i < detectedCircles.cols; ++i) {
        const x = detectedCircles.data32F[i * 3];
        const y = detectedCircles.data32F[i * 3 + 1];
        const radius = detectedCircles.data32F[i * 3 + 2];
        circles.push({x, y, radius});
    }
    detectedCircles.delete();
    redraw();
}

function redraw() {
    // check if src is defined
    if (!src) {
        return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const img = new Image();
    let yTolerance = canvas.width / circlesPerRow / 3;
    let numberedCircles = clusterCirclesByRow(circles, yTolerance);
    img.onload = function () {
        cv.imshow('canvas', src);
        numberedCircles.forEach(circle => {
            // Draw the circle
            ctx.beginPath();
            ctx.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI);
            ctx.strokeStyle = 'red';
            ctx.lineWidth = 2;
            ctx.stroke();

            // Draw the number inside the circle
            drawLabel(circle, ctx);
        });
    };
    img.src = canvas.toDataURL();
}

function clusterCirclesByRow(circles, yTolerance) {
    startNumber = document.getElementById('initialNumber').value || 1;

    // Sort circles by their y position
    circles.sort((a, b) => a.y - b.y);

    let clusters = [];
    let currentCluster = [];
    let lastY = null;

    // Initial clustering based on y tolerance
    circles.forEach(circle => {
        if (lastY === null || Math.abs(circle.y - lastY) <= yTolerance) {
            currentCluster.push(circle);
        } else {
            clusters.push(currentCluster);
            currentCluster = [circle];
        }
        lastY = circle.y;
    });
    if (currentCluster.length > 0) {
        clusters.push(currentCluster);
    }

    // Sort clusters by mean y value
    clusters = clusters.map(cluster => {
        const meanY = cluster.reduce((acc, curr) => acc + curr.y, 0) / cluster.length;
        return { cluster, meanY };
    }).sort((a, b) => a.meanY - b.meanY);

    // Sort circles within each cluster by x value
    let globalNumber = parseInt(startNumber, 10) - 1; 
    clusters.forEach(clusterItem => {
        clusterItem.cluster.sort((a, b) => a.x - b.x);
        clusterItem.cluster.forEach(circle => {
            globalNumber++; // Increment before assigning to continue numbering
            circle.number = globalNumber;
        });
    });

    return clusters.map(item => item.cluster).flat(); // Flatten the array of arrays into a single array
}

function downloadImage() {
    if (!src) {
        return;
    }
    let offScreenCanvas = document.createElement('canvas');
    offScreenCanvas.width = canvas.width;
    offScreenCanvas.height = canvas.height;

    let offCtx = offScreenCanvas.getContext('2d');

    let yTolerance = canvas.width / circlesPerRow / 3;
    let numberedCircles = clusterCirclesByRow(circles, yTolerance);

    cv.imshow(offScreenCanvas, src);
    numberedCircles.forEach(circle => {
        drawLabel(circle, offCtx);
    });


    // Convert the canvas to a data URL and download it
    let image = offScreenCanvas.toDataURL("image/png").replace("image/png", "image/octet-stream");

    const link = document.createElement('a');
    link.download = 'numbered-image.png';
    link.href = image;
    link.click();
}

function drawLabel(circle, ctx) {
        // Draw the number inside the circle
        ctx.font = `${labelSize}px ` + font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = labelColor;
        ctx.strokeStyle = 'white';
        ctx.lineWidth = labelStrokeWidth; // Adjust stroke width to your preference
        // Draw filled text
        ctx.fillText(circle.number, circle.x, circle.y);
        if (labelStrokeWidth > 0) {
            // Draw stroke text for outline
            ctx.strokeText(circle.number, circle.x, circle.y);
        }
}


document.getElementById('switch').addEventListener('change', function() {
    addCircleMode = !addCircleMode;
    document.getElementById('switch-label').innerText = addCircleMode ? translations[lang].addCircle : translations[lang].removeCircle;
});

document.getElementById('initialNumber').addEventListener('input', function() {
    redraw();
});

document.getElementById('labelSize').addEventListener('input', function() {
    labelSize = this.value;
    redraw();
});

document.getElementById('labelStrokeSize').addEventListener('input', function() {
    labelStrokeWidth = this.value;
    redraw();
});

document.getElementById('maxCircles').addEventListener('input', function() {
    circlesPerRow = this.value;
});

document.getElementById('processButton').addEventListener('click', function() {
    processImage(src);
});

document.getElementById('saveButton').addEventListener('click', downloadImage);

document.getElementById("color").addEventListener("input", function() {
    labelColor = this.value;
    redraw();
});

document.getElementById("font").addEventListener("input", function() {
    font = this.value;
    redraw();
});

document.getElementById('languageSelector').addEventListener('change', function() {
    lang = this.value;
    document.querySelector('label[for="initialNumber"]').textContent = translations[lang].startCountLabel;
    document.getElementById('processButton').textContent = translations[lang].processButton;
    document.getElementById('saveButton').textContent = translations[lang].saveButton;
    document.getElementById('fileButton').textContent = translations[lang].FileButton;
    document.getElementById('switch-label').textContent = addCircleMode ? translations[lang].addCircle : translations[lang].removeCircle;
    document.querySelector('label[for="labelSize"]').textContent = translations[lang].labelSize;
    document.querySelector('label[for="labelStrokeSize"]').textContent = translations[lang].labelStrokeSize;
    document.querySelector('label[for="maxCircles"]').textContent = translations[lang].maxCircles;
    document.querySelector('label[for="color"]').textContent = translations[lang].color;
    document.querySelector('label[for="font"]').textContent = translations[lang].font;
});