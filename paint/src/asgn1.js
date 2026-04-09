// ColoredPoint.js

// Vertex shader program
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform float u_Size;
  void main() {
    gl_Position = a_Position;
    gl_PointSize = u_Size;
  }`

// Fragment shader program
var FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_FragColor;
  void main() {
    gl_FragColor = u_FragColor;
  }`

let canvas;
let gl;
let a_Position;
let u_FragColor;
let u_Size;


// ---------- Palette helpers ----------
function hslToRgb(h, s, l) {
  const c = (1 - Math.abs(2*l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r1=0, g1=0, b1=0;

  if (0 <= hp && hp < 1) { r1=c; g1=x; b1=0; }
  else if (1 <= hp && hp < 2) { r1=x; g1=c; b1=0; }
  else if (2 <= hp && hp < 3) { r1=0; g1=c; b1=x; }
  else if (3 <= hp && hp < 4) { r1=0; g1=x; b1=c; }
  else if (4 <= hp && hp < 5) { r1=x; g1=0; b1=c; }
  else { r1=c; g1=0; b1=x; }

  const m = l - c/2;
  return [r1+m, g1+m, b1+m];
}

function setSelectedColor01(r, g, b, a) {
  g_selectedColor[0] = r;
  g_selectedColor[1] = g;
  g_selectedColor[2] = b;
  g_selectedColor[3] = a;

  // keep the brush preview in sync
  if (typeof updateBrushPreview === "function") updateBrushPreview();
}

function setSlidersFromColor01(r, g, b, a) {
  document.getElementById('redSlide').value = Math.round(r * 100);
  document.getElementById('greenSlide').value = Math.round(g * 100);
  document.getElementById('blueSlide').value = Math.round(b * 100);
  document.getElementById('alphaSlide').value = Math.round(a * 100);
}

function buildNeonPalette() {
  const paletteEl = document.getElementById('palette');
  if (!paletteEl) return;

  paletteEl.innerHTML = "";

const N = 40;

// Neon but controlled
const baseS = 0.90;      // baseline saturation
const satBoost = 0.08;   // extra pop on some swatches
const baseL = 0.68;      // KEEP THIS (you said you like it)
const a = 1.0;

// Hue range: coral → magenta → purple → blue → cyan → green
const startHue = 345;    // coral-pink (not red)
const endHue   = 140;    // green

  for (let i = 0; i < N; i++) {
  const t = i / (N - 1);

  // Hue interpolation (warm → cool, no yellow zone)
  const h = startHue + (endHue - startHue) * t;

  // Lightness stays basically the same (very subtle wave)
  const l = baseL + 0.03 * Math.sin(t * Math.PI);

  // NEW: saturation variation for extra punch
  const s = baseS + satBoost * Math.sin(t * Math.PI);

  const [r, g, b] = hslToRgb((h + 360) % 360, s, l);

  const sw = document.createElement("div");
  sw.className = "paletteSwatch";

  const rr = Math.round(r * 255);
  const gg = Math.round(g * 255);
  const bb = Math.round(b * 255);

  sw.style.background = `rgb(${rr}, ${gg}, ${bb})`;

  sw.addEventListener("click", () => {
    const all = paletteEl.querySelectorAll(".paletteSwatch");
    all.forEach(x => x.classList.remove("selected"));
    sw.classList.add("selected");

    setSelectedColor01(r, g, b, a);
    setSlidersFromColor01(r, g, b, a);
    updateBrushPreview();
  });

  if (i === 0) sw.classList.add("selected");
  paletteEl.appendChild(sw);
}


  // OPTIONAL: force brush to first palette color at load:
  const first = paletteEl.querySelector(".paletteSwatch.selected");
  if (first) first.click();
}


function setUpWebGL (){
  // Retrieve <canvas> element
  canvas = document.getElementById('webgl');

  // Get the rendering context for WebGL
  gl = canvas.getContext("webgl", { preserveDrawingBuffer: true});
  if (!gl) {
    console.log('Failed to get the rendering context for WebGL');
    return;
  }
}

function connectVariablesToGLSL() {

   // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

   // // Get the storage location of a_Position
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }

  // Get the storage location of u_FragColor
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

  u_Size = gl.getUniformLocation(gl.program, 'u_Size');
  if (!u_Size) {
    console.log("Failed to get the storage location of u_Size");
    return;
  }
}

const POINT = 0;
const TRIANGLE = 1;
const CIRCLE = 2;

let g_selectedColor = [1.0, 0.0, 1.0, 1.0];
let g_selectedSize = 5;
let g_selectedType = POINT;
let g_selectedSegment = 5;

function updateBrushPreview() {
  const r = Number(document.getElementById('redSlide').value);
  const g = Number(document.getElementById('greenSlide').value);
  const b = Number(document.getElementById('blueSlide').value);
  const a = Number(document.getElementById('alphaSlide').value);

  const rr = Math.round((r / 100) * 255);
  const gg = Math.round((g / 100) * 255);
  const bb = Math.round((b / 100) * 255);
  const aa = (a / 100).toFixed(2);

  document.getElementById('brushSwatch').style.background = `rgba(${rr},${gg},${bb},${aa})`;
  document.getElementById('brushSwatchText').textContent = `rgba(${rr}, ${gg}, ${bb}, ${aa})`;
}

function addActionsForHtmlUI() {


    document.getElementById('clearButton').onclick = function() {g_shapesList = []; renderAllShapes();};
    document.getElementById('pictureButton').onclick = function() {drawPicture()};

    document.getElementById('pointButton').onclick = function() {g_selectedType = POINT};
    document.getElementById('triButton').onclick = function() {g_selectedType = TRIANGLE};
    document.getElementById('circleButton').onclick = function() {g_selectedType = CIRCLE};

    document.getElementById('redSlide').addEventListener('mouseup', function() { g_selectedColor[0] = this.value/100; });
    document.getElementById('greenSlide').addEventListener('mouseup', function() { g_selectedColor[1] = this.value/100; });
    document.getElementById('blueSlide').addEventListener('mouseup', function() { g_selectedColor[2] = this.value/100; });

    document.getElementById('alphaSlide').addEventListener('input', function() { g_selectedColor[3] = this.value / 100;
    updateBrushPreview(); 
    });

    document.getElementById('sizeSlide').addEventListener('mouseup', function() { g_selectedSize = this.value; });
    document.getElementById('segmentSlide').addEventListener('mouseup', function() { g_selectedSegment = this.value; });

    document.getElementById('redSlide').addEventListener('input', updateBrushPreview);
    document.getElementById('greenSlide').addEventListener('input', updateBrushPreview);
    document.getElementById('blueSlide').addEventListener('input', updateBrushPreview);

    // call once on load so it matches defaults
    updateBrushPreview();
    buildNeonPalette();

    const refBtn = document.getElementById("referenceButton");
    const refWrap = document.getElementById("referenceWrap");

    refBtn.onclick = () => {
        const isVisible = refWrap.style.display !== "none";
        refWrap.style.display = isVisible ? "none" : "block";
      };
    
}

function main() {
  
  setUpWebGL();

  connectVariablesToGLSL();

  addActionsForHtmlUI();

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Register function (event handler) to be called on a mouse press
  canvas.onmousedown = click;
  canvas.onmousemove = function(ev) {if(ev.buttons == 1) { click(ev) }};

  // Specify the color for clearing <canvas>
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT);
}


var g_shapesList = [];

function click(ev) {

  let [x,y] = convertCoordinatesEventToGL(ev);

  let point;

  if (g_selectedType == POINT){
    point = new Point();
  } else if (g_selectedType == TRIANGLE){
    point = new Triangle();
  } else {
    point = new Circle();
    point.segments = g_selectedSegment;
  }

  point.position = [x,y];
  point.color = g_selectedColor.slice();
  point.size = g_selectedSize;
  g_shapesList.push(point);

  renderAllShapes();
}

function convertCoordinatesEventToGL(ev) {
  var x = ev.clientX; // x coordinate of a mouse pointer
  var y = ev.clientY; // y coordinate of a mouse pointer
  var rect = ev.target.getBoundingClientRect();

  x = ((x - rect.left) - canvas.width/2)/(canvas.width/2);
  y = (canvas.height/2 - (y - rect.top))/(canvas.height/2);

  return([x,y]);
}

function renderAllShapes() {
  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT);

  var len = g_shapesList.length;

  for(var i = 0; i < len; i++) {
    g_shapesList[i].render();
  }
}

function drawPicture() {

  g_shapesList = [];
  gl.clear(gl.COLOR_BUFFER_BIT);

  function addTri(verts, color) {
    let t = new Triangle();
    t.vertices = verts;
    t.color = color.slice();
    g_shapesList.push(t);
  }

  const color = [1.0, 0.9, 1.0, 1.0];
  const magentaHighlight = [1.0, 0.4, 1.0, 1.0];
  const magentaMid       = [0.8, 0.2, 0.8, 1.0];
  const magentaShadow    = [0.55, 0.0, 0.55, 1.0];  

  //mushroom outline!

  addTri( [-0.05, 0.55,   -0.2, 0.5,   -0.1, 0.5], magentaMid);

  addTri( [-0.05, 0.55,   0.05, 0.5,   0.2, 0.5], magentaHighlight);
  addTri( [0.2, 0.5,   0.25, 0.45,   0.35, 0.45], magentaMid);
  addTri( [0.35, 0.45,   0.4, 0.4,   0.55, 0.45], magentaHighlight);
  addTri( [0.55, 0.45,   0.6, 0.4,   0.7, 0.45], magentaMid);
  addTri( [0.7, 0.45,   0.65, 0.4,   0.7, 0.35], magentaHighlight);
  addTri( [0.7, 0.35,   0.6, 0.3,   0.6, 0.25], magentaMid);
  addTri( [0.6, 0.25,   0.5, 0.25,   0.45, 0.15], magentaHighlight);
  addTri( [0.45, 0.15,   0.4, 0.15,   0.3, 0.05], magentaMid);
  addTri( [0.3, 0.05,   0.05, 0.05,   0.1, 0.0], magentaHighlight);

  addTri( [-0.2, 0.5,   -0.3, 0.4,   -0.35, 0.4], magentaHighlight);
  addTri( [-0.35, 0.4,   -0.45, 0.25,   -0.6, 0.15], magentaMid);
  addTri( [-0.6, 0.15,   -0.65, 0.1,   -0.65, 0.05], magentaHighlight);
  addTri( [-0.65, 0.05,   -0.55, 0.05,   -0.5, 0.0], magentaMid);
  addTri( [-0.5, 0.0,   -0.4, 0.05,   -0.35, 0.0], magentaHighlight);
  addTri( [-0.35, 0.0,   -0.25, 0.05,   -0.2, 0.0], magentaMid);
  addTri( [-0.2, 0.0,   -0.15, 0.05,   -0.1, 0.0], magentaHighlight);

  //stem

  addTri( [-0.1, 0.1,   -0.05, -0.1,   -0.1, -0.15], magentaMid);
  addTri( [-0.1, -0.15,   -0.1, -0.3,   -0.15, -0.35], magentaShadow);
  addTri( [-0.15, -0.35,   -0.1, -0.45,   -0.15, -0.55], magentaMid);
  addTri( [-0.15, -0.55,   -0.1, -0.6,   -0.1, -0.65], magentaShadow);
  addTri( [-0.1, -0.65,   0.0, -0.65, 0.05, -0.7],magentaMid);
  addTri( [0.05, -0.7,   0.1, -0.65, 0.2, -0.7], magentaShadow);
  addTri( [0.2, -0.7,   0.15, -0.55, 0.15, -0.5], magentaMid);
  addTri( [0.15, -0.5,   0.1, -0.4, 0.1, -0.25], magentaShadow);
  addTri( [0.1, -0.25,   0.05, -0.15, 0.1, 0.0], magentaMid);
  addTri( [0.1, 0.0,   0.05, 0.05, 0.1, 0.1], magentaShadow);

  //inner shroom

  addTri( [-0.6, 0.15,   -0.35, 0.2,   -0.3, 0.15], magentaMid);
  addTri( [-0.3, 0.15,   -0.1, 0.15,   -0.05, 0.1], magentaMid);
  addTri( [-0.05, 0.1,   0.05, 0.15,   0.15, 0.1], magentaMid);
  addTri( [0.15, 0.1,   0.2, 0.15,   0.3, 0.15], magentaMid);
  addTri( [0.3, 0.15,   0.3, 0.25,   0.4, 0.3], magentaMid);
  addTri( [0.4, 0.3,   0.4, 0.35,   0.55, 0.45],magentaMid);

  //spikes!

  addTri( [-0.55, 0.15,   -0.5, 0.05,   -0.5, 0.15], magentaShadow);
  addTri( [-0.45, 0.15,   -0.4, 0.05,   -0.4, 0.15], magentaShadow);
  addTri( [-0.35, 0.15,   -0.25, 0.05,   -0.3, 0.15], magentaShadow);
  addTri( [-0.25, 0.15,   -0.15, 0.05,   -0.18, 0.13], magentaShadow);
  addTri( [0.1, 0.1,   0.15, 0.05,   0.15, 0.1], magentaShadow);
  addTri( [0.25, 0.05,   0.25, 0.1,   0.3, 0.15], magentaShadow);
  addTri( [0.4, 0.15,   0.35, 0.2,   0.4, 0.3], magentaShadow);
  addTri( [0.5, 0.25,   0.45, 0.35,   0.5, 0.4], magentaShadow);
  addTri( [0.6, 0.35,   0.5, 0.4,   0.55, 0.45], magentaShadow);

  //Initials MS!

  addTri( [-0.2, 0.2,   -0.2, 0.4,   -0.15, 0.3], color);
  addTri( [-0.2, 0.4,   -0.15, 0.35,   -0.1, 0.35], color);
  addTri( [-0.1, 0.35,   -0.1, 0.3,   -0.05, 0.45], color);
  addTri( [-0.05, 0.45,   -0.05, 0.2,   0.0, 0.15], color);

  addTri( [0.05, 0.2,  0.1, 0.2,   0.15, 0.15], color);
  addTri( [0.15, 0.15,  0.15, 0.2,   0.2, 0.2], color);
  addTri( [0.2, 0.2,  0.15, 0.225,   0.2, 0.25], color);
  addTri( [0.2, 0.25,  0.15, 0.325,   0.05, 0.35], color);
  addTri( [0.05, 0.35,  0.1, 0.375,   0.05, 0.4], color);
  addTri( [0.05, 0.4,  0.1, 0.4,   0.1, 0.45], color);
  addTri( [0.1, 0.45,  0.125, 0.4,   0.2, 0.4], color);

  //stem sparkles

  addTri( [-0.05, -0.3,  -0.05, -0.5,   0.0, -0.5], color);
  addTri( [0.0, -0.55,  0.0, -0.6,   0.05, -0.6], color);





  // Draw everything we just created
  renderAllShapes();


}

