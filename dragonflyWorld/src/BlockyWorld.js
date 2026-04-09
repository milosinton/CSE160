// BlockyWorld.js

// Vertex shader program
var VSHADER_SOURCE = `
  precision mediump float;
  attribute vec4 a_Position;
  attribute vec2 a_UV;
  varying vec2 v_UV;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  uniform mat4 u_ViewMatrix;
  uniform mat4 u_ProjectionMatrix;
  void main() {
    gl_Position = u_ProjectionMatrix * u_ViewMatrix * u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
    v_UV = a_UV;
  }`

// Fragment shader program
var FSHADER_SOURCE = `
  precision mediump float;
  varying vec2 v_UV;
  uniform vec4 u_FragColor;
  uniform sampler2D u_Sampler0;
  uniform sampler2D u_Sampler1;
  uniform sampler2D u_Sampler2;
  uniform sampler2D u_Sampler3;
  uniform int u_whichTexture;
  void main() {

     if (u_whichTexture == -3) {

      // distance from center in UV (0 at center, ~0.5 at edges)
      vec2 p = v_UV - vec2(0.5);
      float d = max(abs(p.x), abs(p.y)); // square-ish falloff
      float edge = smoothstep(0.20, 0.52, d); // 0 center -> 1 edges

      // colors 
      vec3 centerCol = vec3(0.06, 0.09, 0.18); // dark blue
      vec3 edgeCol   = vec3(0.01, 0.01, 0.02); // near-black

      vec3 base = mix(centerCol, edgeCol, edge);

      // subtle highlight for "metal"
      float highlight = pow(1.0 - d, 18.0) * 0.25;
      base += highlight;

      gl_FragColor = vec4(base, 1.0);
      return;
    }

    if (u_whichTexture == -2) {
      gl_FragColor = u_FragColor;

    } else if (u_whichTexture == -1) {
      gl_FragColor = vec4(v_UV, 1.0, 1.0);

    } else if (u_whichTexture == 0) {
      gl_FragColor = texture2D(u_Sampler0, v_UV);

    } else if (u_whichTexture == 1) {
      gl_FragColor = texture2D(u_Sampler1, v_UV);

    } else if (u_whichTexture == 2) {
      gl_FragColor = texture2D(u_Sampler2, v_UV);

    } else if (u_whichTexture == 3) {
      gl_FragColor = texture2D(u_Sampler3, v_UV);

    } else {
        gl_FragColor = vec4(1, 0.2, 0.2, 1.0);
    }

  }`

let canvas;
let gl;
let a_Position;
let a_UV;
let u_FragColor;
let u_Size;
let u_ModelMatrix;
let u_ProjectionMatrix;
let u_ViewMatrix;
let u_GlobalRotateMatrix;
let u_Sampler0;
let u_Sampler1;
let u_Sampler2;
let u_Sampler3;
let u_whichTexture;
let g_crosshairBuffer = null;
let g_shiftDown = false;
let g_overlay = null;
let g_closeBtn = null;

window.g_uiOverlayOpen = false;

let g_legSwayA = 0, g_legSwayB = 0, g_legSwayC = 0;
let g_bodyBob = 0;
let g_wingAngle1_3 = 0;
let g_wingAngle2_4 = 0;

// permanently running (no toggles)
const g_idleAnimation = true;
const g_wingAnimation = true;

// ---------- block interaction helpers ----------
const WORLD_SIZE = 32;
const FLOOR_Y = -0.75;
const MAX_HEIGHT = 10;

// ---------- player collision ----------
const PLAYER_RADIUS = 0.25;   // how close you can get to walls
const EYE_HEIGHT = 0.6;     
const MOVE_STEP = 0.20;      

let g_dragonAngle = 0; // radians
let g_dragon = {
  x: 1.5,
  y: FLOOR_Y + 2.2,
  z: -4.0,
  scale: 2.5,
  yaw: 180,
};

// center of the 32x32 world 
const DRAGON_CENTER = { x: -0.5, z: -0.5 };

// blocks spawned by clicking dragonfly (plain color)
let g_flowerBlocks = []; // each: { r, c, h }

function initControlsOverlay() {
  g_overlay = document.getElementById("controlsOverlay");
  g_closeBtn = document.getElementById("closeOverlayBtn");
  const canvasEl = document.getElementById("webgl");

  if (!g_overlay || !g_closeBtn || !canvasEl) {
    console.log("Overlay elements not found. Check your HTML ids.");
    return;
  }

  function openOverlay() {
    g_overlay.classList.remove("hidden");
    window.g_uiOverlayOpen = true;

    if (document.pointerLockElement === canvasEl) document.exitPointerLock();
  }

  function closeOverlay() {
    g_overlay.classList.add("hidden");
    window.g_uiOverlayOpen = false;
    canvasEl.focus();
  }

  function toggleOverlay() {
    if (g_overlay.classList.contains("hidden")) openOverlay();
    else closeOverlay();
  }

document.addEventListener("keydown", (e) => {
  if (e.key === "h" || e.key === "H") {
    e.preventDefault();
    toggleOverlay();
    return;
  }

  if (e.key === "Escape" && !g_overlay.classList.contains("hidden")) {
    closeOverlay();
  }
});

  // Block interaction while overlay is open
  document.addEventListener("keydown", (e) => {
  if (!window.g_uiOverlayOpen) return;

  const allowed =
    e.key === "Escape" ||
    e.key === "h" || e.key === "H";

  if (!allowed) e.preventDefault();
}, true);

  // Block mouse clicks on canvas while overlay open
  canvasEl.addEventListener("mousedown", (e) => {
    if (window.g_uiOverlayOpen) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // Click outside the card closes
  g_overlay.addEventListener("mousedown", (e) => {
    if (e.target === g_overlay) closeOverlay();
  });

  // X button closes
  g_closeBtn.addEventListener("click", closeOverlay);
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

  gl.enable(gl.DEPTH_TEST);
}

function connectVariablesToGLSL() {

   // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log('Failed to intialize shaders.');
    return;
  }

   // Get the storage location of a_Position
  a_Position = gl.getAttribLocation(gl.program, 'a_Position');
  if (a_Position < 0) {
    console.log('Failed to get the storage location of a_Position');
    return;
  }

  a_UV = gl.getAttribLocation(gl.program, 'a_UV');
  if (a_UV < 0) {
    console.log('Failed to get the storage location of a_UV');
    return;
  }
  // Get the storage location of u_FragColor
  u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
  if (!u_FragColor) {
    console.log('Failed to get the storage location of u_FragColor');
    return;
  }

  u_ModelMatrix = gl.getUniformLocation(gl.program, 'u_ModelMatrix');
  if (!u_ModelMatrix) {
    console.log("Failed to get the storage location of u_ModelMatrix");
    return;
  }

  u_GlobalRotateMatrix = gl.getUniformLocation(gl.program, 'u_GlobalRotateMatrix');
  if (!u_GlobalRotateMatrix){
    console.log("Failed to get the storage location of u_GlobalRotateMatrix");
    return;
  }

    // Get the storage location of u_Sampler
  u_Sampler0 = gl.getUniformLocation(gl.program, 'u_Sampler0');
  if (!u_Sampler0) {
    console.log('Failed to get the storage location of u_Sampler0');
    return false;
  }

  u_Sampler1 = gl.getUniformLocation(gl.program, 'u_Sampler1');
  if (!u_Sampler1) {
    console.log('Failed to get the storage location of u_Sampler1');
    return false;
}

 u_Sampler2 = gl.getUniformLocation(gl.program, 'u_Sampler2');
  if (!u_Sampler2) {
    console.log('Failed to get the storage location of u_Sampler2');
    return false;
}

u_Sampler3 = gl.getUniformLocation(gl.program, 'u_Sampler3');
if (!u_Sampler3) {
  console.log('Failed to get the storage location of u_Sampler3');
  return false;
}

  u_whichTexture = gl.getUniformLocation(gl.program, 'u_whichTexture');
  if (!u_whichTexture) {
    console.log('Failed to get the storage location of u_whichTexture');
    return false;
  }


  u_ViewMatrix = gl.getUniformLocation(gl.program, 'u_ViewMatrix');
  if (!u_ViewMatrix){
    console.log("Failed to get the storage location of u_ViewMatrix");
    return;
  }

  u_ProjectionMatrix = gl.getUniformLocation(gl.program, 'u_ProjectionMatrix');
  if (!u_ProjectionMatrix){
    console.log("Failed to get the storage location of u_ProjectionMatrix");
    return;
  }
    

  var identityM = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identityM.elements);
}

function initTextures() {

  var image = new Image();  // Create the image object
  if (!image) {
    console.log('Failed to create the image object');
    return false;
  }
  // Register the event handler to be called on loading an image
  image.onload = function(){ sendImageToTEXTURE0(image); };
  // Tell the browser to load an image
  image.src = '../resources/nightSky.jpg';

  return true;
}

function sendImageToTEXTURE0(image) {

  var texture = gl.createTexture();   // Create a texture object
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit0
  gl.activeTexture(gl.TEXTURE0);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  // Set the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  
  // Set the texture unit 0 to the sampler
  gl.uniform1i(u_Sampler0, 0);
  
  //gl.clear(gl.COLOR_BUFFER_BIT);   // Clear <canvas>
  //gl.drawArrays(gl.TRIANGLE_STRIP, 0, n); // Draw the rectangle
  console.log('finished texture0');
}

function initTextures1() {
  var image = new Image();  // Create the image object
  if (!image) {
    console.log('Failed to create the image object');
    return false;
  }
  // Register the event handler to be called on loading an image
  image.onload = function(){ sendImageToTEXTURE1(image); };
  // Tell the browser to load an image
  image.src = '../resources/floor.jpg';  

  return true;
}

function sendImageToTEXTURE1(image) {

  var texture = gl.createTexture();   // Create a texture object
  if (!texture) {
    console.log('Failed to create the texture object');
    return false;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1); // Flip the image's y axis
  // Enable texture unit1
  gl.activeTexture(gl.TEXTURE1);
  // Bind the texture object to the target
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  // Set the texture parameters
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

  // Set the texture image
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);

  // Set the texture unit 1 to the sampler1
  gl.uniform1i(u_Sampler1, 1);

  console.log('finished texture1');
}

function initTextures2() {
  var image = new Image();
  if (!image) {
    console.log("Failed to create the image object");
    return false;
  }
  image.onload = function () { sendImageToTEXTURE2(image); };
  image.src = "../resources/vines.jpg";
  return true;
}

function sendImageToTEXTURE2(image) {
  var texture = gl.createTexture();
  if (!texture) {
    console.log("Failed to create the texture object");
    return false;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  gl.uniform1i(u_Sampler2, 2);

  console.log("finished texture2");
}

function initTextures3() {
  var image = new Image();
  if (!image) {
    console.log("Failed to create the image object");
    return false;
  }
  image.onload = function () { sendImageToTEXTURE3(image); };


  image.src = "../resources/flower.jpg";

  return true;
}

function sendImageToTEXTURE3(image) {
  var texture = gl.createTexture();
  if (!texture) {
    console.log("Failed to create the texture object");
    return false;
  }

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

  // Use texture unit 3
  gl.activeTexture(gl.TEXTURE3);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  // Safe defaults (works for NPOT images too)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  // Bind sampler3 to texture unit 3
  gl.uniform1i(u_Sampler3, 3);

  console.log("finished texture3");
}


// degrees per pixel (tune this)
let g_mouseSensitivity = 0.2;

let g_camera;

function onMouseDown(ev) {
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock();
    return;
  }
  if (ev.button !== 0) return; // left click only

  // FIRST: if we hit the dragonfly, spawn flower block and stop
  if (rayHitsDragonfly(12.0)) {
    spawnFlowerBlockUnderDragonfly();
    renderAllShapes();
    return;
  }

  // Otherwise do normal block interaction
  handleBlockClick(ev.shiftKey);
}

function onMove(ev) {
  if (document.pointerLockElement !== canvas) return;

  const dx = ev.movementX;
  const dy = ev.movementY;

  if (dx === 0 && dy === 0) return;

  g_camera.pan(-dx * g_mouseSensitivity);
  g_camera.tilt(-dy * g_mouseSensitivity);

  renderAllShapes();
}



function main() {
  
  setUpWebGL();

  connectVariablesToGLSL();

  initControlsOverlay();

   // Initialize camera
  g_camera = new Camera();
  g_camera.setProjectionMatrix(canvas);
  clampToFloor();
  g_camera.updateViewMatrix();

  document.onkeydown = keydown;

  // Mouse controls
canvas.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMove);

document.addEventListener('keyup', (ev) => {
  if (ev.keyCode === 16) g_shiftDown = false;
});

canvas.addEventListener('click', () => {
  // helpful: keeps focus on canvas for key controls
  canvas.focus?.();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());


  initTextures();
  initTextures1();
  initTextures2();
  initTextures3();
  // Specify the color for clearing <canvas>
  gl.clearColor(0, 0, 0, 1.0);

  // Clear <canvas>
  //gl.clear(gl.COLOR_BUFFER_BIT);
  requestAnimationFrame(tick);
}

function keydown(ev) {

  if (window.g_uiOverlayOpen) return;

  if (ev.keyCode === 16) { // shift pressed
  g_shiftDown = true;
  }
  // forward direction (flattened to XZ so you don't fly when looking up/down)
  let f = new Vector3();
  f.set(g_camera.at);
  f.sub(g_camera.eye);
  f.elements[1] = 0;
  f.normalize();

  // right direction
  let r = Vector3.cross(f, g_camera.up);
  r.normalize();

  if (ev.keyCode == 87) { // W
    tryMoveCamera(f.elements[0] * MOVE_STEP, f.elements[2] * MOVE_STEP);
  } else if (ev.keyCode == 83) { // S
    tryMoveCamera(-f.elements[0] * MOVE_STEP, -f.elements[2] * MOVE_STEP);
  } else if (ev.keyCode == 65) { // A
    tryMoveCamera(-r.elements[0] * MOVE_STEP, -r.elements[2] * MOVE_STEP);
  } else if (ev.keyCode == 68) { // D
    tryMoveCamera(r.elements[0] * MOVE_STEP, r.elements[2] * MOVE_STEP);
  } else if (ev.keyCode == 81) { // Q
    g_camera.panLeft();
  } else if (ev.keyCode == 69) { // E
    g_camera.panRight();
  } else if (ev.keyCode == 32) { // SPACE
  const step = 0.2;
  tryMoveVertical(g_shiftDown ? -step : step);
  }

  renderAllShapes();
}


var g_startTime = performance.now()/1000.0;
var g_seconds = performance.now()/1000.0 - g_startTime;

var g_map = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
  [1,0,0,0,1,2,4,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,1,2,1,5,4,2,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,1,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
  [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,3,0,0,0,0,0,0,1],
  [1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,5,4,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

// Draw the world based on the map array
function drawMap() {
  for (let x = 0; x < 32; x++) {
    for (let y = 0; y < 32; y++) {
      // Get height from map (y is row, x is column)
      let height = g_map[y][x];
      
      // Only draw if there's a wall (height > 0)
      if (height > 0) {
        // Stack cubes vertically based on height
        for (let h = 0; h < height; h++) {
          let body = new Cube();
          body.color = [0.8, 1.0, 1.0, 1.0];
          body.textureNum = -3;
          
          // Position: center the map at origin
          // x - 16 centers X axis, y - 16 centers Z axis
          body.matrix.translate(x - 16, h - 0.75, y - 16);
          body.matrix.scale(1, 1, 1);
          
          body.renderFast();
        }
      }
    }
  }
}



function clampToFloor() {
  const minEyeY = FLOOR_Y + EYE_HEIGHT;
  if (g_camera.eye.elements[1] < minEyeY) {
    const dy = minEyeY - g_camera.eye.elements[1];
    g_camera.eye.elements[1] += dy;
    g_camera.at.elements[1] += dy;
  }
}

// out of bounds counts as a wall so you can't leave the map
function isSolidCell(r, c) {
  if (!inBoundsRC(r, c)) return true;
  return g_map[r][c] > 0;
}

function hitsWallXZ(x, z) {
  const samples = [
    [x, z],
    [x + PLAYER_RADIUS, z],
    [x - PLAYER_RADIUS, z],
    [x, z + PLAYER_RADIUS],
    [x, z - PLAYER_RADIUS],
  ];
  for (const [sx, sz] of samples) {
    const { r, c } = worldToRC(sx, sz);
    if (isSolidCell(r, c)) return true;
  }
  return false;
}

function tryMoveCamera(dx, dz) {
  // try X then Z for nice sliding
  const ex = g_camera.eye.elements[0];
  const ez = g_camera.eye.elements[2];

  const newX = ex + dx;
  if (!hitsWallXZ(newX, ez)) {
    g_camera.eye.elements[0] = newX;
    g_camera.at.elements[0] += dx;
  }

  const newZ = ez + dz;
  if (!hitsWallXZ(g_camera.eye.elements[0], newZ)) {
    g_camera.eye.elements[2] = newZ;
    g_camera.at.elements[2] += dz;
  }

  clampToFloor();
  g_camera.updateViewMatrix();
}

function tryMoveVertical(dy) {
  const newY = g_camera.eye.elements[1] + dy;

  const minEyeY = FLOOR_Y + EYE_HEIGHT;
  if (newY < minEyeY) return;

  // optional cap
  const maxY = MAX_HEIGHT + 2;
  if (newY > maxY) return;

  g_camera.eye.elements[1] += dy;
  g_camera.at.elements[1] += dy;

  g_camera.updateViewMatrix();
}

function inBoundsRC(r, c) {
  return r >= 0 && r < WORLD_SIZE && c >= 0 && c < WORLD_SIZE;
}

function worldToRC(wx, wz) {
  const c = Math.floor(wx + 16);  
  const r = Math.floor(wz + 17);     
  return { r, c };
}

function worldYToH(wy) {
  return Math.floor(wy + 0.75);
}

function raycastHeightMap(maxDist = 8, step = 0.05) {
  const ex = g_camera.eye.elements[0];
  const ey = g_camera.eye.elements[1];
  const ez = g_camera.eye.elements[2];

  // direction = normalize(at - eye)
  const dx0 = g_camera.at.elements[0] - ex;
  const dy0 = g_camera.at.elements[1] - ey;
  const dz0 = g_camera.at.elements[2] - ez;
  const len = Math.hypot(dx0, dy0, dz0) || 1;
  const dx = dx0 / len, dy = dy0 / len, dz = dz0 / len;

  let prev = null;

  for (let t = 0; t <= maxDist; t += step) {
    const wx = ex + dx * t;
    const wy = ey + dy * t;
    const wz = ez + dz * t;

    const { r, c } = worldToRC(wx, wz);
    const h = worldYToH(wy);

    if (!inBoundsRC(r, c)) {
      // treat out of bounds as "stop" (no placement)
      return { hit: false };
    }

    // a column is solid at height
    if (h >= 0 && h < g_map[r][c]) {
      return {
        hit: true,
        r, c,
        hHit: h,
        prev 
      };
    }

    prev = { r, c, h };
  }

  return { hit: false };
}

function addBlockAt(r, c, h) {
  if (!inBoundsRC(r, c)) return;
  // heightmap: to have a cube at level h, the column height must be at least h+1
  g_map[r][c] = Math.min(MAX_HEIGHT, g_map[r][c] + 1);
}

function deleteBlockAt(r, c) {
  if (!inBoundsRC(r, c)) return;
  g_map[r][c] = Math.max(0, g_map[r][c] - 1);
}

function handleBlockClick(isShift) {
  const hitInfo = raycastHeightMap(10, 0.05);

  // SHIFT + click = delete (only if we're looking at a block)
  if (isShift) {
    if (hitInfo.hit) {
      deleteBlockAt(hitInfo.r, hitInfo.c);
      renderAllShapes();
    }
    return;
  }

  // Normal click = add
  if (hitInfo.hit) {
    // If looking at a block column, stack on top:
    // heightmap means "add one more cube to this column"
    g_map[hitInfo.r][hitInfo.c] = Math.min(MAX_HEIGHT, g_map[hitInfo.r][hitInfo.c] + 1);

    renderAllShapes();
    return;
  }

  // If not looking at a block, place on floor where you're looking (ray-plane intersection)
  const ex = g_camera.eye.elements[0];
  const ey = g_camera.eye.elements[1];
  const ez = g_camera.eye.elements[2];
  const dx0 = g_camera.at.elements[0] - ex;
  const dy0 = g_camera.at.elements[1] - ey;
  const dz0 = g_camera.at.elements[2] - ez;
  const len = Math.hypot(dx0, dy0, dz0) || 1;
  const dx = dx0 / len, dy = dy0 / len, dz = dz0 / len;

  if (Math.abs(dy) < 1e-6) return;

  const t = (FLOOR_Y - ey) / dy;
  if (t <= 0 || t > 10) return;

  const wx = ex + dx * t;
  const wz = ez + dz * t;

  const { r, c } = worldToRC(wx, wz);
  if (!inBoundsRC(r, c)) return;

  // place first block in empty column
  g_map[r][c] = Math.max(g_map[r][c], 1);
  renderAllShapes();
}



let g_prevSeconds = 0;

function tick() {
  const now = performance.now() / 1000.0;
  g_seconds = now - g_startTime;

  const dt = g_seconds - g_prevSeconds;
  g_prevSeconds = g_seconds;

  updateDragonflyAnimationAngles();
  updateDragonflyMotion(dt);

  renderAllShapes();
  requestAnimationFrame(tick);
}

function updateDragonflyAnimationAngles() {
  const t = g_seconds;

  // legs + body bob
  {
    const base = Math.sin(t * 5.0);
    const flap = base;

    const lagB = Math.sin((t - 0.08) * 3.0) + 0.35 * Math.sin((t - 0.08) * 6.0);
    const lagC = Math.sin((t - 0.16) * 3.0) + 0.35 * Math.sin((t - 0.16) * 6.0);

    g_legSwayA = 5.0 * flap;
    g_legSwayB = 5.5 * lagB;
    g_legSwayC = 6.0 * lagC;

    g_bodyBob = 0.02 * Math.sin(t * 3.0);
  }

  // wings
  {
    const flapSpeed = 8.0;
    g_wingAngle1_3 = 30.0 * Math.sin(t * flapSpeed);
    g_wingAngle2_4 = 30.0 * Math.sin(t * flapSpeed + Math.PI / 3);
  }
}

// ---------------- DRAGONFLY (ported from BlockyAnimal.js) ----------------
function drawDragonflyWorld(x = 0, y = FLOOR_Y + 0.35, z = 0, scale = 2.5, yawDeg = 0) {
  // Colors from BlockyAnimal.js
  const green = [0.47, 0.67, 0.18, 1.0];
  const teal = [0.47, 0.67, 0.18, 1.0];
  const light = [0.8, 0.969, 1.0, 0.8];
  const dark = [0.098, 0.125, 0.176, 1.0];
  const darker = [0.059, 0.078, 0.118, 1.0];
  const lightdark = [0.14, 0.18, 0.25, 1.0];

  // helper: in BlockyWorld shader, -2 means "use u_FragColor"
  function solid(cube) {
    cube.textureNum = -2;
    return cube;
  }

  // Base placement in the voxel world
  const base = new Matrix4();
  base.translate(x, y, z);
  base.rotate(yawDeg, 0, 1, 0);
  base.scale(scale, scale, scale);

  // --- main body (same structure as BlockyAnimal.js) ---
  var body = solid(new Cube());
  body.color = green;
  body.matrix = new Matrix4(base);
  body.matrix.rotate(-10, 1, 0, 0);
  body.matrix.translate(0, g_bodyBob, 0);

  var bodyCoordinatesSeg  = new Matrix4(body.matrix);
  var bodyCoordinatesHead = new Matrix4(body.matrix);

  var bodyCoordinatesLeg1 = new Matrix4(body.matrix);
  var bodyCoordinatesLeg2 = new Matrix4(body.matrix);
  var bodyCoordinatesLeg3 = new Matrix4(body.matrix);
  var bodyCoordinatesLeg4 = new Matrix4(body.matrix);
  var bodyCoordinatesLeg5 = new Matrix4(body.matrix);
  var bodyCoordinatesLeg6 = new Matrix4(body.matrix);

  var bodyCoordinatesWing1 = new Matrix4(body.matrix);
  var bodyCoordinatesWing2 = new Matrix4(body.matrix);
  var bodyCoordinatesWing3 = new Matrix4(body.matrix);
  var bodyCoordinatesWing4 = new Matrix4(body.matrix);

  body.matrix.scale(0.2, 0.15, 0.25);
  body.matrix.translate(-0.5, -0.5, 0.0);

  var bodyCoordinatesTop    = new Matrix4(body.matrix);
  var bodyCoordinatesBottom = new Matrix4(body.matrix);
  var bodyCoordinatesFront  = new Matrix4(body.matrix);
  var bodyCoordinatesBack   = new Matrix4(body.matrix);
  var bodyCoordinatesRight  = new Matrix4(body.matrix);
  var bodyCoordinatesLeft   = new Matrix4(body.matrix);

  body.renderFast();

  // top of body
  var body1 = solid(new Cube());
  body1.color = green;
  body1.matrix = bodyCoordinatesTop;
  body1.matrix.translate(0.05, 0.93, -0.05);
  body1.matrix.scale(0.9, 0.15, 0.9);
  var body1Coordinates = new Matrix4(body1.matrix);
  body1.renderFast();

  var body12 = solid(new Cube());
  body12.color = green;
  body12.matrix = body1Coordinates;
  body12.matrix.translate(0.08, 1.0, -0.08);
  body12.matrix.scale(0.85, 0.6, 0.85);
  var body12Coordinates = new Matrix4(body12.matrix);
  body12.renderFast();

  var body13 = solid(new Cube());
  body13.color = green;
  body13.matrix = body12Coordinates;
  body13.matrix.translate(0.08, 1.0, -0.08);
  body13.matrix.scale(0.85, 0.9, 0.85);
  var body13Coordinates = new Matrix4(body13.matrix);
  body13.renderFast();

  // underside of body
  var body2 = solid(new Cube());
  body2.color = green;
  body2.matrix = bodyCoordinatesBottom;
  body2.matrix.translate(0.05, -0.1, -0.05);
  body2.matrix.scale(0.9, 0.15, 0.9);
  var body2Coordinates = new Matrix4(body2.matrix);
  body2.renderFast();

  var body22 = solid(new Cube());
  body22.color = green;
  body22.matrix = body2Coordinates;
  body22.matrix.translate(0.08, -0.5, -0.08);
  body22.matrix.scale(0.85, 0.6, 0.85);
  var body22Coordinates = new Matrix4(body22.matrix);
  body22.renderFast();

  // front of body
  var body3 = solid(new Cube());
  body3.color = green;
  body3.matrix = bodyCoordinatesFront;
  body3.matrix.translate(0.05, 0.0, -0.9);
  body3.matrix.scale(0.9, 0.9, 0.15);
  var body3Coordinates = new Matrix4(body3.matrix);
  body3.renderFast();

  var body32 = solid(new Cube());
  body32.color = green;
  body32.matrix = body3Coordinates;
  body32.matrix.translate(0.05, 0.05, -0.85);
  body32.matrix.scale(0.9, 0.9, 0.4);
  var body32Coordinates = new Matrix4(body32.matrix);
  body32.renderFast();

  var body33 = solid(new Cube());
  body33.color = green;
  body33.matrix = body32Coordinates;
  body33.matrix.translate(0.05, 0.05, -0.5);
  body33.matrix.scale(0.9, 0.9, 1);
  var body33Coordinates = new Matrix4(body33.matrix);
  body33.renderFast();

  // back of body
  var body4 = solid(new Cube());
  body4.color = green;
  body4.matrix = bodyCoordinatesBack;
  body4.matrix.translate(0.05, 0.0, 0.05);
  body4.matrix.scale(0.9, 0.9, 0.15);
  var body4Coordinates = new Matrix4(body4.matrix);
  body4.renderFast();

  var body42 = solid(new Cube());
  body42.color = green;
  body42.matrix = body4Coordinates;
  body42.matrix.translate(0.05, 0.05, 0.23);
  body42.matrix.scale(0.9, 0.9, 0.4);
  var body42Coordinates = new Matrix4(body42.matrix);
  body42.renderFast();

  // right of body
  var body5 = solid(new Cube());
  body5.color = green;
  body5.matrix = bodyCoordinatesRight;
  body5.matrix.translate(1, 0.05, -0.03);
  body5.matrix.scale(0.05, 0.9, 0.95);
  var body5Coordinates = new Matrix4(body5.matrix);
  body5.renderFast();

  // left of body
  var body6 = solid(new Cube());
  body6.color = green;
  body6.matrix = bodyCoordinatesLeft;
  body6.matrix.translate(-0.05, 0.05, -0.03);
  body6.matrix.scale(0.05, 0.9, 0.95);
  var body6Coordinates = new Matrix4(body6.matrix);
  body6.renderFast();

  // segmented back portion
  var seg = solid(new Cube());
  seg.color = teal;
  seg.matrix = bodyCoordinatesSeg;
  seg.matrix.rotate(20, 1, 0, 0);
  seg.matrix.scale(0.12, 0.08, 0.7);
  seg.matrix.translate(-0.5, -0.5, 1);

  var segCoordinates = new Matrix4(seg.matrix);
  var segCoordinatesBottom = new Matrix4(seg.matrix);
  var segCoordinatesBack = new Matrix4(seg.matrix);
  seg.renderFast();

  var seg2 = solid(new Cube());
  seg2.color = teal;
  seg2.matrix = segCoordinates;
  seg2.matrix.translate(0.03, 1.0, -0.08);
  seg2.matrix.scale(0.9, 0.13, 0.9);
  var seg2Coordinates = new Matrix4(seg2.matrix);
  seg2.renderFast();

  var seg3 = solid(new Cube());
  seg3.color = teal;
  seg3.matrix = seg2Coordinates;
  seg3.matrix.translate(0.08, 1.0, -0.08);
  seg3.matrix.scale(0.9, 0.9, 0.9);
  var seg3Coordinates = new Matrix4(seg3.matrix);
  seg3.renderFast();

  var seg1 = solid(new Cube());
  seg1.color = teal;
  seg1.matrix = segCoordinatesBottom;
  seg1.matrix.translate(0.03, -0.13, -0.08);
  seg1.matrix.scale(0.9, 1, 0.9);
  seg1.renderFast();

  var segBack = solid(new Cube());
  segBack.color = [0.30, 0.52, 0.11, 1.0];
  segBack.matrix = segCoordinatesBack;
  segBack.matrix.translate(0.03, 0.0, 0.05);
  segBack.matrix.scale(0.9, 0.9, 0.05);
  var segBackCoordinates = new Matrix4(segBack.matrix);
  segBack.renderFast();

  var segBack2 = solid(new Cube());
  segBack2.color = lightdark;
  segBack2.matrix = segBackCoordinates;
  segBack2.matrix.translate(0.1, 0.01, 1);
  segBack2.matrix.scale(0.8, 0.8, 3);
  segBack2.renderFast();


  const SWAY_R = 1.2;
  const SWAY_L = -1.2;

  // leg1
  var leg1 = solid(new Cube());
  leg1.color = darker;
  leg1.matrix = bodyCoordinatesLeg1;
  leg1.matrix.translate(0.12, -0.2, -0.38);
  leg1.matrix.rotate(40 + SWAY_R * g_legSwayA, 1, 0, 1);
  var leg1Coordinates = new Matrix4(leg1.matrix);
  leg1.matrix.scale(0.03, 0.18, 0.03);
  leg1.renderFast();

  var leg12 = solid(new Cube());
  leg12.color = dark;
  leg12.matrix = leg1Coordinates;
  leg12.matrix.translate(-0.04, -0.10, 0);
  leg12.matrix.rotate(-20 + SWAY_R * g_legSwayB, 0, 0, 1);
  var leg12Coordinates = new Matrix4(leg12.matrix);
  leg12.matrix.scale(0.025, 0.12, 0.025);
  leg12.renderFast();

  var leg13 = solid(new Cube());
  leg13.color = lightdark;
  leg13.matrix = leg12Coordinates;
  leg13.matrix.translate(0.04, -0.10, 0);
  leg13.matrix.rotate(20 + SWAY_R * g_legSwayC, 0, 0, 1);
  leg13.matrix.scale(0.015, 0.12, 0.022);
  leg13.renderFast();

  // leg2
  var leg2 = solid(new Cube());
  leg2.color = darker;
  leg2.matrix = bodyCoordinatesLeg2;
  leg2.matrix.translate(-0.14, -0.2, -0.39);
  leg2.matrix.rotate(40 + SWAY_L * g_legSwayA, 1, 0, -1);
  var leg2Coordinates = new Matrix4(leg2.matrix);
  leg2.matrix.scale(0.03, 0.18, 0.03);
  leg2.renderFast();

  var leg22 = solid(new Cube());
  leg22.color = dark;
  leg22.matrix = leg2Coordinates;
  leg22.matrix.translate(0.04, -0.10, 0);
  leg22.matrix.rotate(20 + SWAY_L * g_legSwayB, 0, 0, 1);
  var leg22Coordinates = new Matrix4(leg22.matrix);
  leg22.matrix.scale(0.025, 0.12, 0.025);
  leg22.renderFast();

  var leg23 = solid(new Cube());
  leg23.color = lightdark;
  leg23.matrix = leg22Coordinates;
  leg23.matrix.translate(-0.04, -0.10, 0);
  leg23.matrix.rotate(-20 + SWAY_L * g_legSwayC, 0, 0, 1);
  leg23.matrix.scale(0.015, 0.12, 0.022);
  leg23.renderFast();

  // leg3
  var leg3 = solid(new Cube());
  leg3.color = darker;
  leg3.matrix = bodyCoordinatesLeg3;
  leg3.matrix.translate(0.14, -0.23, -0.2);
  leg3.matrix.rotate(40 + SWAY_R * g_legSwayA, 1, 0, 1);
  leg3.matrix.rotate(-20, 1, 0, 0);
  var leg3Coordinates = new Matrix4(leg3.matrix);
  leg3.matrix.scale(0.03, 0.18, 0.03);
  leg3.renderFast();

  var leg32 = solid(new Cube());
  leg32.color = dark;
  leg32.matrix = leg3Coordinates;
  leg32.matrix.translate(-0.04, -0.10, 0);
  leg32.matrix.rotate(-20 + SWAY_R * g_legSwayB, 0, 0, 1);
  var leg32Coordinates = new Matrix4(leg32.matrix);
  leg32.matrix.scale(0.025, 0.12, 0.025);
  leg32.renderFast();

  var leg33 = solid(new Cube());
  leg33.color = lightdark;
  leg33.matrix = leg32Coordinates;
  leg33.matrix.translate(0.04, -0.10, 0);
  leg33.matrix.rotate(20 + SWAY_R * g_legSwayC, 0, 0, 1);
  leg33.matrix.scale(0.015, 0.12, 0.022);
  leg33.renderFast();

  // leg4
  var leg4 = solid(new Cube());
  leg4.color = darker;
  leg4.matrix = bodyCoordinatesLeg4;
  leg4.matrix.translate(-0.17, -0.23, -0.2);
  leg4.matrix.rotate(40 + SWAY_L * g_legSwayA, 1, 0, -1);
  leg4.matrix.rotate(-20, 1, 0, 0);
  var leg4Coordinates = new Matrix4(leg4.matrix);
  leg4.matrix.scale(0.03, 0.18, 0.03);
  leg4.renderFast();

  var leg42 = solid(new Cube());
  leg42.color = dark;
  leg42.matrix = leg4Coordinates;
  leg42.matrix.translate(0.04, -0.10, 0);
  leg42.matrix.rotate(20 + SWAY_L * g_legSwayB, 0, 0, 1);
  var leg42Coordinates = new Matrix4(leg42.matrix);
  leg42.matrix.scale(0.025, 0.12, 0.025);
  leg42.renderFast();

  var leg43 = solid(new Cube());
  leg43.color = lightdark;
  leg43.matrix = leg42Coordinates;
  leg43.matrix.translate(-0.04, -0.10, 0);
  leg43.matrix.rotate(-20 + SWAY_L * g_legSwayC, 0, 0, 1);
  leg43.matrix.scale(0.015, 0.12, 0.022);
  leg43.renderFast();

  // leg5
  var leg5 = solid(new Cube());
  leg5.color = darker;
  leg5.matrix = bodyCoordinatesLeg5;
  leg5.matrix.translate(0.15, -0.22, -0.03);
  leg5.matrix.rotate(40 + SWAY_R * g_legSwayA, 1, 0, 1);
  leg5.matrix.rotate(-50, 1, 0, 0);
  var leg5Coordinates = new Matrix4(leg5.matrix);
  leg5.matrix.scale(0.03, 0.18, 0.03);
  leg5.renderFast();

  var leg52 = solid(new Cube());
  leg52.color = dark;
  leg52.matrix = leg5Coordinates;
  leg52.matrix.translate(-0.04, -0.10, 0);
  leg52.matrix.rotate(-20 + SWAY_R * g_legSwayB, 0, 0, 1);
  var leg52Coordinates = new Matrix4(leg52.matrix);
  leg52.matrix.scale(0.025, 0.12, 0.025);
  leg52.renderFast();

  var leg53 = solid(new Cube());
  leg53.color = lightdark;
  leg53.matrix = leg52Coordinates;
  leg53.matrix.translate(0.04, -0.10, 0);
  leg53.matrix.rotate(20 + SWAY_R * g_legSwayC, 0, 0, 1);
  leg53.matrix.scale(0.015, 0.12, 0.022);
  leg53.renderFast();

  // leg6
  var leg6 = solid(new Cube());
  leg6.color = darker;
  leg6.matrix = bodyCoordinatesLeg6;
  leg6.matrix.translate(-0.155, -0.22, -0.03);
  leg6.matrix.rotate(40 + SWAY_L * g_legSwayA, 1, 0, -1);
  leg6.matrix.rotate(-50, 1, 0, 0);
  var leg6Coordinates = new Matrix4(leg6.matrix);
  leg6.matrix.scale(0.03, 0.18, 0.03);
  leg6.renderFast();

  var leg62 = solid(new Cube());
  leg62.color = dark;
  leg62.matrix = leg6Coordinates;
  leg62.matrix.translate(0.04, -0.10, 0);
  leg62.matrix.rotate(20 + SWAY_L * g_legSwayB, 0, 0, 1);
  var leg62Coordinates = new Matrix4(leg62.matrix);
  leg62.matrix.scale(0.025, 0.12, 0.025);
  leg62.renderFast();

  var leg63 = solid(new Cube());
  leg63.color = lightdark;
  leg63.matrix = leg62Coordinates;
  leg63.matrix.translate(-0.04, -0.10, 0);
  leg63.matrix.rotate(-20 + SWAY_L * g_legSwayC, 0, 0, 1);
  leg63.matrix.scale(0.015, 0.12, 0.022);
  leg63.renderFast();

  // head + eyes (Dodecahedron uses normal render, per your request)
  var head = new Dodecahedron();
  head.color = teal;
  head.matrix = bodyCoordinatesHead;
  head.matrix.translate(0, 0.0, -0.35);
  head.matrix.scale(0.12, 0.12, 0.12);

  var headCoordinates1 = new Matrix4(head.matrix);
  var headCoordinates2 = new Matrix4(head.matrix);
  head.render();

  var eye1 = new Dodecahedron();
  eye1.color = [0.30, 0.52, 0.11, 1.0];
  eye1.matrix = headCoordinates1;
  eye1.matrix.translate(0.5, 0.2, -0.2);
  eye1.matrix.scale(0.7, 0.7, 0.7);
  eye1.render();

  var eye2 = new Dodecahedron();
  eye2.color = [0.30, 0.52, 0.11, 1.0];
  eye2.matrix = headCoordinates2;
  eye2.matrix.translate(-0.5, 0.2, -0.2);
  eye2.matrix.scale(0.7, 0.7, 0.7);
  eye2.render();

  // wings (all cubes renderFast)
  // wing 1
  var wing1 = solid(new Cube());
  wing1.color = light;
  wing1.matrix = bodyCoordinatesWing1;
  wing1.matrix.translate(0.1, 0.05, -0.1);
  wing1.matrix.rotate(20 + g_wingAngle1_3, 0, 0, 1);
  var wing1Coordinates = new Matrix4(wing1.matrix);
  wing1.matrix.scale(0.95, 0.02, -0.05);
  wing1.renderFast();

  var wing12 = solid(new Cube());
  wing12.color = light;
  wing12.matrix = wing1Coordinates;
  wing12.matrix.translate(0, 0.0, -0.03);
  var wing12Coordinates = new Matrix4(wing12.matrix);
  wing12.matrix.scale(0.85, 0.02, -0.04);
  wing12.renderFast();

  var wing13 = solid(new Cube());
  wing13.color = light;
  wing13.matrix = wing12Coordinates;
  wing13.matrix.translate(0.04, 0.0, -0.02);
  var wing13Coordinates = new Matrix4(wing13.matrix);
  wing13.matrix.scale(0.73, 0.02, -0.03);
  wing13.renderFast();

  var wing14 = solid(new Cube());
  wing14.color = light;
  wing14.matrix = wing13Coordinates;
  wing14.matrix.translate(-0.1, 0, 0.1);
  var wing14Coordinates = new Matrix4(wing14.matrix);
  wing14.matrix.scale(0.93, 0.02, -0.02);
  wing14.renderFast();

  var wing15 = solid(new Cube());
  wing15.color = light;
  wing15.matrix = wing14Coordinates;
  wing15.matrix.translate(0.25, 0, -0.12);
  var wing15Coordinates = new Matrix4(wing15.matrix);
  wing15.matrix.scale(0.5, 0.02, -0.02);
  wing15.renderFast();

  var wing16 = solid(new Cube());
  wing16.color = light;
  wing16.matrix = wing15Coordinates;
  wing16.matrix.translate(-0.19, 0, 0.14);
  var wing16Coordinates = new Matrix4(wing16.matrix);
  wing16.matrix.scale(0.8, 0.02, -0.02);
  wing16.renderFast();

  // wing 2
  var wing2 = solid(new Cube());
  wing2.color = light;
  wing2.matrix = bodyCoordinatesWing2;
  wing2.matrix.translate(0.1, 0.05, -0.15);
  wing2.matrix.rotate(10 + g_wingAngle2_4, 0, 0, 1);
  wing2.matrix.rotate(10, 0, 1, 0);
  var wing2Coordinates = new Matrix4(wing2.matrix);
  wing2.matrix.scale(0.95, 0.02, -0.05);
  wing2.renderFast();

  var wing22 = solid(new Cube());
  wing22.color = light;
  wing22.matrix = wing2Coordinates;
  wing22.matrix.translate(0, 0.0, -0.03);
  var wing22Coordinates = new Matrix4(wing22.matrix);
  wing22.matrix.scale(0.85, 0.02, -0.04);
  wing22.renderFast();

  var wing23 = solid(new Cube());
  wing23.color = light;
  wing23.matrix = wing22Coordinates;
  wing23.matrix.translate(0.04, 0.0, -0.02);
  var wing23Coordinates = new Matrix4(wing23.matrix);
  wing23.matrix.scale(0.73, 0.02, -0.03);
  wing23.renderFast();

  var wing24 = solid(new Cube());
  wing24.color = light;
  wing24.matrix = wing23Coordinates;
  wing24.matrix.translate(-0.1, 0, 0.1);
  var wing24Coordinates = new Matrix4(wing24.matrix);
  wing24.matrix.scale(0.93, 0.02, -0.02);
  wing24.renderFast();

  var wing25 = solid(new Cube());
  wing25.color = light;
  wing25.matrix = wing24Coordinates;
  wing25.matrix.translate(0.25, 0, -0.12);
  var wing25Coordinates = new Matrix4(wing25.matrix);
  wing25.matrix.scale(0.5, 0.02, -0.02);
  wing25.renderFast();

  var wing26 = solid(new Cube());
  wing26.color = light;
  wing26.matrix = wing25Coordinates;
  wing26.matrix.translate(-0.19, 0, 0.14);
  var wing26Coordinates = new Matrix4(wing26.matrix);
  wing26.matrix.scale(0.8, 0.02, -0.02);
  wing26.renderFast();

  // wing 3 (mirrored)
  var wing3 = solid(new Cube());
  wing3.color = light;
  wing3.matrix = bodyCoordinatesWing3;
  wing3.matrix.translate(-0.1, 0.05, -0.1);
  wing3.matrix.rotate(160 - g_wingAngle1_3, 0, 0, 1);
  var wing3Coordinates = new Matrix4(wing3.matrix);
  wing3.matrix.scale(0.95, 0.02, -0.05);
  wing3.renderFast();

  var wing32 = solid(new Cube());
  wing32.color = light;
  wing32.matrix = wing3Coordinates;
  wing32.matrix.translate(0, 0.0, -0.03);
  var wing32Coordinates = new Matrix4(wing32.matrix);
  wing32.matrix.scale(0.85, 0.02, -0.04);
  wing32.renderFast();

  var wing33 = solid(new Cube());
  wing33.color = light;
  wing33.matrix = wing32Coordinates;
  wing33.matrix.translate(0.04, 0.0, -0.02);
  var wing33Coordinates = new Matrix4(wing33.matrix);
  wing33.matrix.scale(0.73, 0.02, -0.03);
  wing33.renderFast();

  var wing34 = solid(new Cube());
  wing34.color = light;
  wing34.matrix = wing33Coordinates;
  wing34.matrix.translate(-0.1, 0, 0.1);
  var wing34Coordinates = new Matrix4(wing34.matrix);
  wing34.matrix.scale(0.93, 0.02, -0.02);
  wing34.renderFast();

  var wing35 = solid(new Cube());
  wing35.color = light;
  wing35.matrix = wing34Coordinates;
  wing35.matrix.translate(0.25, 0, -0.12);
  var wing35Coordinates = new Matrix4(wing35.matrix);
  wing35.matrix.scale(0.5, 0.02, -0.02);
  wing35.renderFast();

  var wing36 = solid(new Cube());
  wing36.color = light;
  wing36.matrix = wing35Coordinates;
  wing36.matrix.translate(-0.19, 0, 0.14);
  var wing36Coordinates = new Matrix4(wing36.matrix);
  wing36.matrix.scale(0.8, 0.02, -0.02);
  wing36.renderFast();

  // wing 4 (mirrored)
  var wing4 = solid(new Cube());
  wing4.color = light;
  wing4.matrix = bodyCoordinatesWing4;
  wing4.matrix.translate(-0.1, 0.05, -0.15);
  wing4.matrix.rotate(170 - g_wingAngle2_4, 0, 0, 1);
  wing4.matrix.rotate(10, 0, 1, 0);
  var wing4Coordinates = new Matrix4(wing4.matrix);
  wing4.matrix.scale(0.95, 0.02, -0.05);
  wing4.renderFast();

  var wing42 = solid(new Cube());
  wing42.color = light;
  wing42.matrix = wing4Coordinates;
  wing42.matrix.translate(0, 0.0, -0.03);
  var wing42Coordinates = new Matrix4(wing42.matrix);
  wing42.matrix.scale(0.85, 0.02, -0.04);
  wing42.renderFast();

  var wing43 = solid(new Cube());
  wing43.color = light;
  wing43.matrix = wing42Coordinates;
  wing43.matrix.translate(0.04, 0.0, -0.02);
  var wing43Coordinates = new Matrix4(wing43.matrix);
  wing43.matrix.scale(0.73, 0.02, -0.03);
  wing43.renderFast();

  var wing44 = solid(new Cube());
  wing44.color = light;
  wing44.matrix = wing43Coordinates;
  wing44.matrix.translate(-0.1, 0, 0.1);
  var wing44Coordinates = new Matrix4(wing44.matrix);
  wing44.matrix.scale(0.93, 0.02, -0.02);
  wing44.renderFast();

  var wing45 = solid(new Cube());
  wing45.color = light;
  wing45.matrix = wing44Coordinates;
  wing45.matrix.translate(0.25, 0, -0.12);
  var wing45Coordinates = new Matrix4(wing45.matrix);
  wing45.matrix.scale(0.5, 0.02, -0.02);
  wing45.renderFast();

  var wing46 = solid(new Cube());
  wing46.color = light;
  wing46.matrix = wing45Coordinates;
  wing46.matrix.translate(-0.19, 0, 0.14);
  var wing46Coordinates = new Matrix4(wing46.matrix);
  wing46.matrix.scale(0.8, 0.02, -0.02);
  wing46.renderFast();
}

function isEmptyCellAtWorldXZ(wx, wz) {
  const { r, c } = worldToRC(wx, wz);
  if (!inBoundsRC(r, c)) return false;
  return g_map[r][c] === 0;
}

function updateDragonflyMotion(dt) {
  // base loop size + speed (tune these)
  const speed = 0.35;        // radians/sec
  const radiusX = 10.0;      // loop width
  const radiusZ = 8.0;       // loop depth
  const maxTries = 60;       // how many small nudges to avoid walls

  g_dragonAngle += dt * speed;

  // Try candidate positions. If it would hover over a solid cell, nudge angle forward.
  let a = g_dragonAngle;
  let found = false;

  for (let k = 0; k < maxTries; k++) {
    const candX = DRAGON_CENTER.x + Math.cos(a) * radiusX;
    const candZ = DRAGON_CENTER.z + Math.sin(a) * radiusZ;

    if (isEmptyCellAtWorldXZ(candX, candZ)) {
      g_dragon.x = candX;
      g_dragon.z = candZ;
      found = true;
      g_dragonAngle = a; 
      break;
    }

    // small forward nudge (about ~1 degree)
    a += (Math.PI / 180) * 1.0;
  }

  // If we somehow never found an empty cell (rare), just keep moving anyway.
  if (!found) {
    g_dragon.x = DRAGON_CENTER.x + Math.cos(g_dragonAngle) * radiusX;
    g_dragon.z = DRAGON_CENTER.z + Math.sin(g_dragonAngle) * radiusZ;
  }

  // Face direction of travel: tangent angle (plus 180 because your model was backwards)
  const travelYaw = (Math.atan2(
    Math.cos(g_dragonAngle) * radiusX,   // dx/dt ~ -sin; using tangent trick
    -Math.sin(g_dragonAngle) * radiusZ   // dz/dt ~ cos
  ) * 180 / Math.PI);

  g_dragon.yaw = 180 + travelYaw;

  // Keep hover height (you can add a little extra bob here if you want)
  g_dragon.y = FLOOR_Y + 2.2;
}

function rayHitsDragonfly(maxDist = 12.0) {
  const ex = g_camera.eye.elements[0];
  const ey = g_camera.eye.elements[1];
  const ez = g_camera.eye.elements[2];

  // normalized ray dir
  const dx0 = g_camera.at.elements[0] - ex;
  const dy0 = g_camera.at.elements[1] - ey;
  const dz0 = g_camera.at.elements[2] - ez;
  const len = Math.hypot(dx0, dy0, dz0) || 1;
  const dx = dx0 / len, dy = dy0 / len, dz = dz0 / len;

  // sphere around dragonfly (center slightly up into the body)
  const cx = g_dragon.x;
  const cy = g_dragon.y + 0.35 * g_dragon.scale;
  const cz = g_dragon.z;

  const radius = 0.65 * g_dragon.scale; // tune if needed

  // Ray-sphere intersection: (o + t d - c)^2 = r^2
  const ox = ex - cx;
  const oy = ey - cy;
  const oz = ez - cz;

  const b = 2 * (ox * dx + oy * dy + oz * dz);
  const c = (ox * ox + oy * oy + oz * oz) - radius * radius;

  const disc = b * b - 4 * c; // a=1 since d normalized
  if (disc < 0) return false;

  const sqrtDisc = Math.sqrt(disc);
  const t0 = (-b - sqrtDisc) / 2;
  const t1 = (-b + sqrtDisc) / 2;

  // hit if either intersection is in front of camera and within range
  const hitT = (t0 > 0) ? t0 : t1;
  return hitT > 0 && hitT <= maxDist;
}

function spawnFlowerBlockUnderDragonfly() {
  const { r, c } = worldToRC(g_dragon.x, g_dragon.z);
  if (!inBoundsRC(r, c)) return;

  // put it on top of whatever column exists there (usually 0 since dragon avoids walls)
  const h = g_map[r][c];

  g_flowerBlocks.push({ r, c, h });
}

function drawFlowerBlocks() {
  for (const b of g_flowerBlocks) {
    const cube = new Cube();
    cube.textureNum = 3;

    // match drawMap placement: x is col, y is row
    cube.matrix.translate(b.c - 16, b.h - 0.75, b.r - 16);
    cube.matrix.scale(1, 1, 1);

    cube.renderFast();
  }
}




function renderAllShapes() {

  var startTime = performance.now();

// Use camera's projection matrix
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, g_camera.projectionMatrix.elements);

  // Use camera's view matrix
  gl.uniformMatrix4fv(u_ViewMatrix, false, g_camera.viewMatrix.elements);


 var globalRotMat = new Matrix4();
globalRotMat.setIdentity();  // No rotation
gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRotMat.elements);

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


//sky!
var sky = new Cube();
sky.color = [0.5, 0.7, 1.0, 1.0];
sky.textureNum = 0; //night sky!

// Prevent sky from messing with depth
gl.depthMask(false);

sky.matrix.translate(
  g_camera.eye.elements[0],
  g_camera.eye.elements[1],
  g_camera.eye.elements[2]
);

sky.matrix.scale(-1000, 1000, 1000);

sky.matrix.translate(-0.5, -0.5, +0.5);

sky.renderFast();
gl.depthMask(true);


//ground!
var floor = new Cube();
floor.color = [0.3, 0.6, 0.3, 1.0];
floor.textureNum = 1;

floor.matrix.translate(0, -0.75, 0);
floor.matrix.scale(32, 0.01, 32);

floor.matrix.translate(-0.5, 0, +0.5);

floor.renderFast();


  // Draw the voxel world from the map
  drawMap();
  drawFlowerBlocks();

  drawDragonflyWorld(g_dragon.x, g_dragon.y, g_dragon.z, g_dragon.scale, g_dragon.yaw);


  var duration = performance.now() - startTime;
  sendTextToHTML(" ms: " + Math.floor(duration) + " fps: " + Math.floor(10000/duration), "performance");

  drawCrosshair();

}

function sendTextToHTML(text, htmlID) {
  var htmlElm = document.getElementById(htmlID);
  if (!htmlElm) {
    console.log("Failed to get " + htmlID + " from HTML");
    return;
  }

  htmlElm.innerHTML = text;
}

function drawCrosshair() {
  // size in pixels
  const s = 8;

  // Convert pixels -> clip space (-1..1)
  const dx = (s / canvas.width) * 2.0;
  const dy = (s / canvas.height) * 2.0;

  // 4 points = two lines (horizontal + vertical), centered at (0,0)
  const verts = new Float32Array([
    -dx,  0,   dx,  0,   // horizontal line
     0, -dy,   0,  dy    // vertical line
  ]);

  if (!g_crosshairBuffer) {
    g_crosshairBuffer = gl.createBuffer();
  }

  // Draw on top of everything
  gl.disable(gl.DEPTH_TEST);

  // Solid black
  gl.uniform1i(u_whichTexture, -2);
  gl.uniform4f(u_FragColor, 1.0, 1.0, 1.0, 1.0);

  // Identity matrices so clip coords pass through unchanged
  const I = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, I.elements);
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, I.elements);
  gl.uniformMatrix4fv(u_ViewMatrix, false, I.elements);
  gl.uniformMatrix4fv(u_ProjectionMatrix, false, I.elements);

  // Feed positions
  gl.bindBuffer(gl.ARRAY_BUFFER, g_crosshairBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);

  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(a_Position);

  gl.disableVertexAttribArray(a_UV);

  gl.drawArrays(gl.LINES, 0, 4);

  // Re-enable for normal rendering next frame
   gl.enableVertexAttribArray(a_UV);
  gl.enable(gl.DEPTH_TEST);
}


