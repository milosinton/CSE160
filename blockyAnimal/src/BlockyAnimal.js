// BlockyAnimal.js

// Vertex shader program
var VSHADER_SOURCE = `
  attribute vec4 a_Position;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_GlobalRotateMatrix;
  void main() {
    gl_Position = u_GlobalRotateMatrix * u_ModelMatrix * a_Position;
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
let u_ModelMatrix;


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

  var identityM = new Matrix4();
  gl.uniformMatrix4fv(u_ModelMatrix, false, identityM.elements);
}

let g_globalAngleX = 0;  // Camera rotation up/down (pitch)
let g_globalAngleY = 0;  // Camera rotation side-to-side (yaw)
let g_idleAnimation = false;   // toggle if you want
let g_legSwayA = 0;              // joint 1 sway (hip)
let g_legSwayB = 0;              // joint 2 sway (knee)
let g_legSwayC = 0;              // joint 3 sway (ankle)
let g_bodyBob = 0;

let g_hipRotate = 0;
let g_kneeRotate = 0;
let g_footRotate = 0;

let g_wingAnimation = false;  // toggle for wing flapping
let g_wingAngle1_3 = 0;       // angle for wings 1 and 3
let g_wingAngle2_4 = 0;       // angle for wings 2 and 4

let g_isDragging = false;
let g_lastMouseX = 0;
let g_lastMouseY = 0;


function addActionsForHtmlUI() {

  document.getElementById('animationOnButton').onclick = function() {g_idleAnimation = true;};
  document.getElementById('animationOffButton').onclick = function() {g_idleAnimation = false;};

  document.getElementById('reset').onclick = function() {g_hipRotate = 0; g_kneeRotate = 0; g_footRotate = 0; renderAllShapes(); 

    hipSlide.value = 0;
    kneeSlide.value = 0;
    footSlide.value = 0;
    
  };
 
  document.getElementById('angleSlideX').addEventListener('mousemove', function() {g_globalAngleX = this.value; renderAllShapes(); });
  document.getElementById('angleSlideY').addEventListener('mousemove', function() {g_globalAngleY = this.value; renderAllShapes(); });

  document.getElementById('hipSlide').addEventListener('mousemove', function() {g_hipRotate = this.value; renderAllShapes(); });
  document.getElementById('kneeSlide').addEventListener('mousemove', function() {g_kneeRotate = this.value; renderAllShapes(); });
  document.getElementById('footSlide').addEventListener('mousemove', function() {g_footRotate = this.value; renderAllShapes(); });

}

function initMouseEvents() {
  // Mouse down - start dragging
  canvas.onmousedown = function(ev) {
    if (ev.shiftKey) {
      // Shift-click toggles wing animation
      g_wingAnimation = !g_wingAnimation;
    } else {
      g_isDragging = true;
      g_lastMouseX = ev.clientX;
      g_lastMouseY = ev.clientY;
    }
  };

  // Mouse up - stop dragging
  canvas.onmouseup = function(ev) {
    g_isDragging = false;
  };

  // Mouse move - rotate camera if dragging
  canvas.onmousemove = function(ev) {
    if (g_isDragging) {
      // Calculate how much the mouse moved
      let deltaX = ev.clientX - g_lastMouseX;
      let deltaY = ev.clientY - g_lastMouseY;

      // Update camera angles based on mouse movement
      // Horizontal mouse movement rotates around Y axis (side-to-side)
      g_globalAngleY -= deltaX * 0.5;  // Multiply by sensitivity factor
      
      // Vertical mouse movement rotates around X axis (up-down)
      g_globalAngleX -= deltaY * 0.5;  // Multiply by sensitivity factor

      // Clamp X rotation to prevent flipping upside down
      if (g_globalAngleX > 90) g_globalAngleX = 90;
      if (g_globalAngleX < -90) g_globalAngleX = -90;

      // Update slider values to match
      document.getElementById('angleSlideX').value = g_globalAngleX;
      document.getElementById('angleSlideY').value = g_globalAngleY;

      // Store current mouse position for next frame
      g_lastMouseX = ev.clientX;
      g_lastMouseY = ev.clientY;
    }
  };

  // Mouse leave canvas - stop dragging
  canvas.onmouseleave = function(ev) {
    g_isDragging = false;
  };
}

function main() {
  
  setUpWebGL();

  connectVariablesToGLSL();

  addActionsForHtmlUI();

  initMouseEvents();

  // Register function (event handler) to be called on a mouse press
  //canvas.onmousedown = click;
  //canvas.onmousemove = function(ev) {if(ev.buttons == 1) { click(ev) }};

  // Specify the color for clearing <canvas>
  gl.clearColor(0.9, 1, 0.9, 1.0);

  // Clear <canvas>
  //gl.clear(gl.COLOR_BUFFER_BIT);
  requestAnimationFrame(tick);
}

var g_startTime = performance.now()/1000.0;
var g_seconds = performance.now()/1000.0 - g_startTime;

function tick() {

  g_seconds = performance.now()/1000.0 - g_startTime;

  //console.log(g_seconds);

  updateAnimationAngles();
  renderAllShapes();
  requestAnimationFrame(tick);

}

function updateAnimationAngles() {
  if (g_idleAnimation) {
    // "wing flap" feel: faster, a little punchier at the peak
    const t = g_seconds;
    const base = Math.sin(t * 5.0);         // main flap rhythm
    const flap = base;

    // lag the joints by phase-shifting time (same frequency, delayed)
    const lagB = Math.sin((t - 0.08) * 3.0) + 0.35 * Math.sin((t - 0.08) * 6.0);
    const lagC = Math.sin((t - 0.16) * 3.0) + 0.35 * Math.sin((t - 0.16) * 6.0);

    // degrees (keep subtle)
    g_legSwayA = 5 * flap;   // hip
    g_legSwayB = 5.5 * lagB;   // knee (lags)
    g_legSwayC = 6 * lagC;   // ankle (lags more)

    g_bodyBob = 0.02 * Math.sin(g_seconds * 3.0);

  } else {
    g_legSwayA = g_legSwayB = g_legSwayC = 0;
    g_bodyBob = 0;
  }

  if (g_wingAnimation) {
    const t = g_seconds;
    const flapSpeed = 8.0;  // Fast flapping like a real dragonfly
    
    // Wings 1 and 3 flap together
    g_wingAngle1_3 = 30 * Math.sin(t * flapSpeed);
    
    // Wings 2 and 4 flap together, but offset by a phase
    g_wingAngle2_4 = 30 * Math.sin((t * flapSpeed) + Math.PI / 3);  // 60 degree phase offset
  } else {
    g_wingAngle1_3 = 0;
    g_wingAngle2_4 = 0;
  }

}

function renderAllShapes() {

  var startTime = performance.now();

  var globalRotMat = new Matrix4();
  globalRotMat.rotate(g_globalAngleX, 1, 0, 0);  // Rotate around X axis (up/down)
  globalRotMat.rotate(g_globalAngleY, 0, 1, 0);  // Rotate around Y axis (side-to-side)
  gl.uniformMatrix4fv(u_GlobalRotateMatrix, false, globalRotMat.elements);

  // Clear <canvas>
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);


  //dragonfly time!!!

  //colors:

  //[0.486, 0.588, 0.294, 1.0]
  //[0.42, 0.812, 0.725, 1.0]
  const green = [0.47, 0.67, 0.18, 1.0];
  const teal = [0.47, 0.67, 0.18, 1.0];
  const light = [0.8, 0.969, 1.0, 0.8];
  const dark = [0.098, 0.125, 0.176, 1.0];
  const darker = [0.059, 0.078, 0.118, 1.0];
  const lightdark = [0.14, 0.18, 0.25, 1.0];

  //draw main body
var body = new Cube();
body.color = green;
body.matrix.rotate(-10,1,0,0);
body.matrix.translate(0, g_bodyBob, 0);

var bodyCoordinatesSeg = new Matrix4(body.matrix); 

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


var bodyCoordinatesTop = new Matrix4(body.matrix);  // Save coordinates
var bodyCoordinatesBottom = new Matrix4(body.matrix); 
var bodyCoordinatesFront = new Matrix4(body.matrix); 
var bodyCoordinatesBack = new Matrix4(body.matrix); 
var bodyCoordinatesRight = new Matrix4(body.matrix); 
var bodyCoordinatesLeft = new Matrix4(body.matrix); 

body.render();

//top of body
var body1 = new Cube();
body1.color = green;
body1.matrix = bodyCoordinatesTop;
body1.matrix.translate(0.05, 0.93, -0.05);
body1.matrix.scale(0.9, 0.15, 0.9); 

var body1Coordinates = new Matrix4(body1.matrix);
body1.render();

var body12 = new Cube();
body12.color = green;
body12.matrix = body1Coordinates;
body12.matrix.translate(0.08, 1.0, -0.08);
body12.matrix.scale(0.85, 0.6, 0.85); 

var body12Coordinates = new Matrix4(body12.matrix);
body12.render();

var body13 = new Cube();
body13.color = green;
body13.matrix = body12Coordinates;
body13.matrix.translate(0.08, 1.0, -0.08);
body13.matrix.scale(0.85, 0.9, 0.85); 

var body13Coordinates = new Matrix4(body13.matrix);
body13.render();

//underside of body
var body2 = new Cube();
body2.color = green;  // Darker color so you can see it
body2.matrix = bodyCoordinatesBottom;
body2.matrix.translate(0.05, -0.1, -0.05);
body2.matrix.scale(0.9, 0.15, 0.9); 

var body2Coordinates = new Matrix4(body2.matrix);
body2.render();

var body22 = new Cube();
body22.color = green;  // Even darker
body22.matrix = body2Coordinates;
body22.matrix.translate(0.08, -0.5, -0.08);
body22.matrix.scale(0.85, 0.6, 0.85); 

var body22Coordinates = new Matrix4(body22.matrix);
body22.render();

//front of body

var body3 = new Cube();
body3.color = green;
body3.matrix = bodyCoordinatesFront;
body3.matrix.translate(0.05, 0.0, -0.9);
body3.matrix.scale(0.9, 0.9, 0.15); 

var body3Coordinates = new Matrix4(body3.matrix);
body3.render();

var body32 = new Cube();
body32.color = green;
body32.matrix = body3Coordinates;
body32.matrix.translate(0.05, 0.05, -0.85);
body32.matrix.scale(0.9, 0.9, 0.4);

var body32Coordinates = new Matrix4(body32.matrix);
body32.render();

var body33 = new Cube();
body33.color = green;
body33.matrix = body32Coordinates;
body33.matrix.translate(0.05, 0.05, -0.5);
body33.matrix.scale(0.9, 0.9, 1); 

var body33Coordinates = new Matrix4(body33.matrix);
body33.render();

//back of body

var body4 = new Cube();
body4.color = green;
body4.matrix = bodyCoordinatesBack;
body4.matrix.translate(0.05, 0.0, 0.05);
body4.matrix.scale(0.9, 0.9, 0.15); 

var body4Coordinates = new Matrix4(body4.matrix);
body4.render();

var body42 = new Cube();
body42.color = green;
body42.matrix = body4Coordinates;
body42.matrix.translate(0.05, 0.05, 0.23);
body42.matrix.scale(0.9, 0.9, 0.4);

var body42Coordinates = new Matrix4(body42.matrix);
body42.render();

//right of body
var body5 = new Cube();
body5.color = green;
body5.matrix = bodyCoordinatesRight;
body5.matrix.translate(1, 0.05, -0.03);
body5.matrix.scale(0.05, 0.9, 0.95); 

var body5Coordinates = new Matrix4(body5.matrix);
body5.render();

//left of body
var body6 = new Cube();
body6.color = green;
body6.matrix = bodyCoordinatesLeft;
body6.matrix.translate(-0.05, 0.05, -0.03);
body6.matrix.scale(0.05, 0.9, 0.95); 

var body6Coordinates = new Matrix4(body6.matrix);
body6.render();






//segmented back portion of body!

var seg = new Cube();
seg.color = teal;
seg.matrix = bodyCoordinatesSeg;
seg.matrix.rotate(20, 1, 0, 0);
seg.matrix.scale(0.12, 0.08, 0.7);
seg.matrix.translate(-0.5, -0.5, 1);

var segCoordinates = new Matrix4(seg.matrix);
var segCoordinatesBottom = new Matrix4(seg.matrix);
var segCoordinatesBack = new Matrix4(seg.matrix);
seg.render();

var seg2 = new Cube();
seg2.color = teal;
seg2.matrix = segCoordinates;
seg2.matrix.translate(0.03, 1.0, -0.08);
seg2.matrix.scale(0.9, 0.13, 0.9); 

var seg2Coordinates = new Matrix4(seg2.matrix);
seg2.render();

var seg3 = new Cube();
seg3.color = teal;
seg3.matrix = seg2Coordinates;
seg3.matrix.translate(0.08, 1.0, -0.08);
seg3.matrix.scale(0.9, 0.9, 0.9); 

var seg3Coordinates = new Matrix4(seg3.matrix);
seg3.render();

//bottom of segmented portion

var seg1 = new Cube();
seg1.color = teal;
seg1.matrix = segCoordinatesBottom;
seg1.matrix.translate(0.03, -0.13, -0.08);
seg1.matrix.scale(0.9, 1, 0.9);

seg1.render();

//back of segmented portion
var segBack = new Cube();
segBack.color = [0.30, 0.52, 0.11, 1.0];
segBack.matrix = segCoordinatesBack;
segBack.matrix.translate(0.03, 0.0, 0.05); 
segBack.matrix.scale(0.9, 0.9, 0.05);

var segBackCoordinates = new Matrix4(segBack.matrix);
segBack.render();

var segBack2 = new Cube();
segBack2.color = lightdark;
segBack2.matrix = segBackCoordinates
segBack2.matrix.translate(0.1, 0.01, 1);
segBack2.matrix.scale(0.8, 0.8, 3);

segBack2.render();




const SWAY_R = 1.2;   // right side legs (x > 0): legs 1,3,5
const SWAY_L = -1.2;  // left side legs  (x < 0): legs 2,4,6

//legssss

//first leg

var leg1 = new Cube();
leg1.color = darker;
leg1.matrix = bodyCoordinatesLeg1;
leg1.matrix.translate(0.12, -0.2, -0.38);
leg1.matrix.rotate(40 + SWAY_R * g_legSwayA + parseFloat(g_hipRotate), 1, 0, 1);

var leg1Coordinates = new Matrix4(leg1.matrix);
leg1.matrix.scale(0.03, 0.18, 0.03);

leg1.render();

var leg12 = new Cube();
leg12.color = dark;
leg12.matrix = leg1Coordinates;
leg12.matrix.translate(-0.04, -0.10, 0);
leg12.matrix.rotate(-20 + SWAY_R * g_legSwayB + parseFloat(g_kneeRotate), 0, 0, 1);

var leg12Coordinates = new Matrix4(leg12.matrix);
leg12.matrix.scale(0.025, 0.12, 0.025);

leg12.render();

var leg13 = new Cube();
leg13.color = lightdark;
leg13.matrix = leg12Coordinates;
leg13.matrix.translate(0.04, -0.10, 0);
leg13.matrix.rotate(20 + SWAY_R * g_legSwayC + parseFloat(g_footRotate), 0, 0, 1);
leg13.matrix.scale(0.015, 0.12, 0.022);

leg13.render();



//leg2
var leg2 = new Cube();
leg2.color = darker;
leg2.matrix = bodyCoordinatesLeg2;
leg2.matrix.translate(-0.14, -0.2, -0.39);
leg2.matrix.rotate(40 + SWAY_L * g_legSwayA, 1, 0, -1);

var leg2Coordinates = new Matrix4(leg2.matrix);
leg2.matrix.scale(0.03, 0.18, 0.03);

leg2.render();

var leg22 = new Cube();
leg22.color = dark;
leg22.matrix = leg2Coordinates;
leg22.matrix.translate(0.04, -0.10, 0);
leg22.matrix.rotate(20 + SWAY_L * g_legSwayB, 0, 0, 1);

var leg22Coordinates = new Matrix4(leg22.matrix);
leg22.matrix.scale(0.025, 0.12, 0.025);

leg22.render();

var leg23 = new Cube();
leg23.color = lightdark;
leg23.matrix = leg22Coordinates;
leg23.matrix.translate(-0.04, -0.10, 0);
leg23.matrix.rotate(-20 + SWAY_L * g_legSwayC, 0, 0, 1);
leg23.matrix.scale(0.015, 0.12, 0.022);

leg23.render();



//leg3
var leg3 = new Cube();
leg3.color = darker;
leg3.matrix = bodyCoordinatesLeg3;
leg3.matrix.translate(0.14, -0.23, -0.2);
leg3.matrix.rotate(40 + SWAY_R * g_legSwayA, 1, 0, 1);
leg3.matrix.rotate(-20, 1, 0, 0);

var leg3Coordinates = new Matrix4(leg3.matrix);
leg3.matrix.scale(0.03, 0.18, 0.03);

leg3.render();

var leg32 = new Cube();
leg32.color = dark;
leg32.matrix = leg3Coordinates;
leg32.matrix.translate(-0.04, -0.10, 0);
leg32.matrix.rotate(-20 + SWAY_R * g_legSwayB, 0, 0, 1);

var leg32Coordinates = new Matrix4(leg32.matrix);
leg32.matrix.scale(0.025, 0.12, 0.025);

leg32.render();

var leg33 = new Cube();
leg33.color = lightdark;
leg33.matrix = leg32Coordinates;
leg33.matrix.translate(0.04, -0.10, 0);
leg33.matrix.rotate(20 + SWAY_R * g_legSwayC, 0, 0, 1);
leg33.matrix.scale(0.015, 0.12, 0.022);

leg33.render();


//leg4
var leg4 = new Cube();
leg4.color = darker;
leg4.matrix = bodyCoordinatesLeg4;
leg4.matrix.translate(-0.17, -0.23, -0.2);
leg4.matrix.rotate(40 + SWAY_L * g_legSwayA, 1, 0, -1);
leg4.matrix.rotate(-20, 1, 0, 0);

var leg4Coordinates = new Matrix4(leg4.matrix);
leg4.matrix.scale(0.03, 0.18, 0.03);

leg4.render();

var leg42 = new Cube();
leg42.color = dark;
leg42.matrix = leg4Coordinates;
leg42.matrix.translate(0.04, -0.10, 0);
leg42.matrix.rotate(20 + SWAY_L * g_legSwayB, 0, 0, 1);

var leg42Coordinates = new Matrix4(leg42.matrix);
leg42.matrix.scale(0.025, 0.12, 0.025);

leg42.render();

var leg43 = new Cube();
leg43.color = lightdark;
leg43.matrix = leg42Coordinates;
leg43.matrix.translate(-0.04, -0.10, 0);
leg43.matrix.rotate(-20 + SWAY_L * g_legSwayC, 0, 0, 1);
leg43.matrix.scale(0.015, 0.12, 0.022);

leg43.render();

//leg5
var leg5 = new Cube();
leg5.color = darker;
leg5.matrix = bodyCoordinatesLeg5;
leg5.matrix.translate(0.125, -0.22, -0.03);
leg5.matrix.rotate(40 + SWAY_R * g_legSwayA, 1, 0, 1);
leg5.matrix.rotate(-50, 1, 0, 0);

var leg5Coordinates = new Matrix4(leg5.matrix);
leg5.matrix.scale(0.03, 0.18, 0.03);

leg5.render();

var leg52 = new Cube();
leg52.color = dark;
leg52.matrix = leg5Coordinates;
leg52.matrix.translate(-0.04, -0.10, 0);
leg52.matrix.rotate(-20 + SWAY_R * g_legSwayB, 0, 0, 1);

var leg52Coordinates = new Matrix4(leg52.matrix);
leg52.matrix.scale(0.025, 0.12, 0.025);

leg52.render();

var leg53 = new Cube();
leg53.color = lightdark;
leg53.matrix = leg52Coordinates;
leg53.matrix.translate(0.04, -0.10, 0);
leg53.matrix.rotate(20 + SWAY_R * g_legSwayC, 0, 0, 1);
leg53.matrix.scale(0.015, 0.12, 0.022);

leg53.render();

//leg6
var leg6 = new Cube();
leg6.color = darker;
leg6.matrix = bodyCoordinatesLeg6;
leg6.matrix.translate(-0.155, -0.22, -0.03);
leg6.matrix.rotate(40 + SWAY_L * g_legSwayA, 1, 0, -1);
leg6.matrix.rotate(-50, 1, 0, 0);

var leg6Coordinates = new Matrix4(leg6.matrix);
leg6.matrix.scale(0.03, 0.18, 0.03);

leg6.render();

var leg62 = new Cube();
leg62.color = dark;
leg62.matrix = leg6Coordinates;
leg62.matrix.translate(0.04, -0.10, 0);
leg62.matrix.rotate(20 + SWAY_L * g_legSwayB, 0, 0, 1);

var leg62Coordinates = new Matrix4(leg62.matrix);
leg62.matrix.scale(0.025, 0.12, 0.025);

leg62.render();

var leg63 = new Cube();
leg63.color = lightdark;
leg63.matrix = leg62Coordinates;
leg63.matrix.translate(-0.04, -0.10, 0);
leg63.matrix.rotate(-20 + SWAY_L * g_legSwayC, 0, 0, 1);
leg63.matrix.scale(0.015, 0.12, 0.022);

leg63.render();


//head! using dodecahedrons :)

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
eye1.matrix = headCoordinates1
eye1.matrix.translate(0.5, 0.2, -0.2);
eye1.matrix.scale(0.7,0.7,0.7);
eye1.render();

var eye2 = new Dodecahedron();
eye2.color = [0.30, 0.52, 0.11, 1.0];
eye2.matrix = headCoordinates2
eye2.matrix.translate(-0.5, 0.2, -0.2);
eye2.matrix.scale(0.7,0.7,0.7);
eye2.render();





//wingssss



//first wing

var wing1 = new Cube();
wing1.color = light;
wing1.matrix = bodyCoordinatesWing1;
wing1.matrix.translate(0.1, 0.05, -0.1); 
wing1.matrix.rotate(20 + g_wingAngle1_3, 0, 0, 1);

var wing1Coordinates = new Matrix4(wing1.matrix)
wing1.matrix.scale(0.95, 0.02, -0.05); 
wing1.render();

var wing12 = new Cube();
wing12.color = light;
wing12.matrix = wing1Coordinates;
wing12.matrix.translate(0, 0.0, -0.03); 

var wing12Coordinates = new Matrix4(wing12.matrix)
wing12.matrix.scale(0.85, 0.02, -0.04); 
wing12.render();

var wing13 = new Cube();
wing13.color = light;
wing13.matrix = wing12Coordinates;
wing13.matrix.translate(0.04, 0.0, -0.02); 

var wing13Coordinates = new Matrix4(wing13.matrix)
wing13.matrix.scale(0.73, 0.02, -0.03); 
wing13.render();

var wing14 = new Cube();
wing14.color = light;
wing14.matrix = wing13Coordinates;
wing14.matrix.translate(-0.1, 0, 0.1); 

var wing14Coordinates = new Matrix4(wing14.matrix)
wing14.matrix.scale(0.93, 0.02, -0.02);
wing14.render();

var wing15 = new Cube();
wing15.color = light;
wing15.matrix = wing14Coordinates;
wing15.matrix.translate(0.25, 0, -0.12); 

var wing15Coordinates = new Matrix4(wing15.matrix)
wing15.matrix.scale(0.5, 0.02, -0.02);
wing15.render();

var wing16 = new Cube();
wing16.color = light;
wing16.matrix = wing15Coordinates;
wing16.matrix.translate(-0.19, 0, 0.14); 

var wing16Coordinates = new Matrix4(wing16.matrix)
wing16.matrix.scale(0.8, 0.02, -0.02);
wing16.render();

//second wing

var wing2 = new Cube();
wing2.color = light;
wing2.matrix = bodyCoordinatesWing2;
wing2.matrix.translate(0.1, 0.05, -0.15); 
wing2.matrix.rotate(10 + g_wingAngle2_4, 0, 0, 1);
wing2.matrix.rotate(10, 0, 1, 0);

var wing2Coordinates = new Matrix4(wing2.matrix)
wing2.matrix.scale(0.95, 0.02, -0.05); 
wing2.render();

var wing22 = new Cube();
wing22.color = light;
wing22.matrix = wing2Coordinates;
wing22.matrix.translate(0, 0.0, -0.03); 

var wing22Coordinates = new Matrix4(wing22.matrix)
wing22.matrix.scale(0.85, 0.02, -0.04); 
wing22.render();

var wing23 = new Cube();
wing23.color = light;
wing23.matrix = wing22Coordinates;
wing23.matrix.translate(0.04, 0.0, -0.02); 

var wing23Coordinates = new Matrix4(wing23.matrix)
wing23.matrix.scale(0.73, 0.02, -0.03); 
wing23.render();

var wing24 = new Cube();
wing24.color = light;
wing24.matrix = wing23Coordinates;
wing24.matrix.translate(-0.1, 0, 0.1); 

var wing24Coordinates = new Matrix4(wing24.matrix)
wing24.matrix.scale(0.93, 0.02, -0.02);
wing24.render();

var wing25 = new Cube();
wing25.color = light;
wing25.matrix = wing24Coordinates;
wing25.matrix.translate(0.25, 0, -0.12); 

var wing25Coordinates = new Matrix4(wing25.matrix)
wing25.matrix.scale(0.5, 0.02, -0.02);
wing25.render();

var wing26 = new Cube();
wing26.color = light;
wing26.matrix = wing25Coordinates;
wing26.matrix.translate(-0.19, 0, 0.14); 

var wing26Coordinates = new Matrix4(wing26.matrix)
wing26.matrix.scale(0.8, 0.02, -0.02);
wing26.render();


//wing 3

var wing3 = new Cube();
wing3.color = light;
wing3.matrix = bodyCoordinatesWing3;
wing3.matrix.translate(-0.1, 0.05, -0.1);   // mirrored X
wing3.matrix.rotate(160 - g_wingAngle1_3, 0, 0, 1);          // mirrored Z-rotation

var wing3Coordinates = new Matrix4(wing3.matrix);
wing3.matrix.scale(0.95, 0.02, -0.05);
wing3.render();

var wing32 = new Cube();
wing32.color = light;
wing32.matrix = wing3Coordinates;
wing32.matrix.translate(0, 0.0, -0.03);

var wing32Coordinates = new Matrix4(wing32.matrix);
wing32.matrix.scale(0.85, 0.02, -0.04);
wing32.render();

var wing33 = new Cube();
wing33.color = light;
wing33.matrix = wing32Coordinates;
wing33.matrix.translate(0.04, 0.0, -0.02);

var wing33Coordinates = new Matrix4(wing33.matrix);
wing33.matrix.scale(0.73, 0.02, -0.03);
wing33.render();

var wing34 = new Cube();
wing34.color = light;
wing34.matrix = wing33Coordinates;
wing34.matrix.translate(-0.1, 0, 0.1);

var wing34Coordinates = new Matrix4(wing34.matrix);
wing34.matrix.scale(0.93, 0.02, -0.02);
wing34.render();

var wing35 = new Cube();
wing35.color = light;
wing35.matrix = wing34Coordinates;
wing35.matrix.translate(0.25, 0, -0.12);

var wing35Coordinates = new Matrix4(wing35.matrix);
wing35.matrix.scale(0.5, 0.02, -0.02);
wing35.render();

var wing36 = new Cube();
wing36.color = light;
wing36.matrix = wing35Coordinates;
wing36.matrix.translate(-0.19, 0, 0.14);

var wing36Coordinates = new Matrix4(wing36.matrix);
wing36.matrix.scale(0.8, 0.02, -0.02);
wing36.render();


//wing 4

var wing4 = new Cube();
wing4.color = light;
wing4.matrix = bodyCoordinatesWing4;
wing4.matrix.translate(-0.1, 0.05, -0.15);  // mirrored X
wing4.matrix.rotate(170 - g_wingAngle2_4, 0, 0, 1);          // mirrored Z-rotation
wing4.matrix.rotate(10, 0, 1, 0);          // mirrored Y-rotation

var wing4Coordinates = new Matrix4(wing4.matrix);
wing4.matrix.scale(0.95, 0.02, -0.05);
wing4.render();

var wing42 = new Cube();
wing42.color = light;
wing42.matrix = wing4Coordinates;
wing42.matrix.translate(0, 0.0, -0.03);

var wing42Coordinates = new Matrix4(wing42.matrix);
wing42.matrix.scale(0.85, 0.02, -0.04);
wing42.render();

var wing43 = new Cube();
wing43.color = light;
wing43.matrix = wing42Coordinates;
wing43.matrix.translate(0.04, 0.0, -0.02);

var wing43Coordinates = new Matrix4(wing43.matrix);
wing43.matrix.scale(0.73, 0.02, -0.03);
wing43.render();

var wing44 = new Cube();
wing44.color = light;
wing44.matrix = wing43Coordinates;
wing44.matrix.translate(-0.1, 0, 0.1);

var wing44Coordinates = new Matrix4(wing44.matrix);
wing44.matrix.scale(0.93, 0.02, -0.02);
wing44.render();

var wing45 = new Cube();
wing45.color = light;
wing45.matrix = wing44Coordinates;
wing45.matrix.translate(0.25, 0, -0.12);

var wing45Coordinates = new Matrix4(wing45.matrix);
wing45.matrix.scale(0.5, 0.02, -0.02);
wing45.render();

var wing46 = new Cube();
wing46.color = light;
wing46.matrix = wing45Coordinates;
wing46.matrix.translate(-0.19, 0, 0.14);

var wing46Coordinates = new Matrix4(wing46.matrix);
wing46.matrix.scale(0.8, 0.02, -0.02);
wing46.render();



  var duration = performance.now() - startTime;
  sendTextToHTML(" ms: " + Math.floor(duration) + " fps: " + Math.floor(10000/duration), "performance");

}

function sendTextToHTML(text, htmlID) {
  var htmlElm = document.getElementById(htmlID);
  if (!htmlElm) {
    console.log("Failed to get " + htmlID + " from HTML");
    return;
  }

  htmlElm.innerHTML = text;
}

