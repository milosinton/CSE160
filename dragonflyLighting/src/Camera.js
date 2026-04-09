class Camera {
  constructor(){
    this.fov = 60;
    this.eye = new Vector3([0, 0, 3]);
    this.at  = new Vector3([0, 0, 2]);
    this.up  = new Vector3([0, 1, 0]);

    this.viewMatrix = new Matrix4();
    this.updateViewMatrix();

    this.projectionMatrix = new Matrix4();

    // for pitch clamping (FPS-style)
    this.pitch = 0;
  }

  setProjectionMatrix(canvas) {
    this.projectionMatrix.setPerspective(this.fov, canvas.width/canvas.height, 0.1, 1000);
  }

  updateViewMatrix() {
    this.viewMatrix.setLookAt(
      this.eye.elements[0], this.eye.elements[1], this.eye.elements[2],
      this.at.elements[0],  this.at.elements[1],  this.at.elements[2],
      this.up.elements[0],  this.up.elements[1],  this.up.elements[2]
    );
  }

  // --- NEW: yaw by arbitrary degrees (replaces fixed 5deg QE turning)
  pan(alphaDegrees) {
    // forward f = at - eye
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);

    // rotate forward around "up" axis
    let rot = new Matrix4();
    rot.setRotate(alphaDegrees, this.up.elements[0], this.up.elements[1], this.up.elements[2]);
    let f2 = rot.multiplyVector3(f);

    // at = eye + rotated forward
    this.at.set(this.eye);
    this.at.add(f2);

    this.updateViewMatrix();
  }

  // --- NEW: pitch by arbitrary degrees (look up/down)
  tilt(alphaDegrees) {
    // clamp pitch so camera doesn't flip
    let nextPitch = this.pitch + alphaDegrees;
    if (nextPitch > 89) nextPitch = 89;
    if (nextPitch < -89) nextPitch = -89;

    // only apply the allowed delta
    alphaDegrees = nextPitch - this.pitch;
    this.pitch = nextPitch;

    // forward f = at - eye
    let f = new Vector3();
    f.set(this.at);
    f.sub(this.eye);

    // right axis = f x up
    let right = Vector3.cross(f, this.up);
    right.normalize();

    // rotate forward around right axis
    let rot = new Matrix4();
    rot.setRotate(alphaDegrees, right.elements[0], right.elements[1], right.elements[2]);
    let f2 = rot.multiplyVector3(f);

    // at = eye + rotated forward
    this.at.set(this.eye);
    this.at.add(f2);

    this.updateViewMatrix();
  }

  // keep your old API working
  panLeft()  { this.pan( 5); }
  panRight() { this.pan(-5); }

    moveForward() {
        let speed = 0.3;
        
        // Compute forward vector f = at - eye
        let f = new Vector3();
        f.set(this.at);
        f.sub(this.eye);
        
        // Normalize f
        f.normalize();
        
        // Scale f by speed
        f.mul(speed);
        
        // Add forward vector to both eye and at
        this.eye.add(f);
        this.at.add(f);
        
        // Update view matrix
        this.updateViewMatrix();
    }

    moveBackwards() {
        let speed = 0.1;
        
        // Compute backward vector b = eye - at
        let b = new Vector3();
        b.set(this.eye);
        b.sub(this.at);
        
        // Normalize b
        b.normalize();
        
        // Scale b by speed
        b.mul(speed);
        
        // Add backward vector to both eye and at
        this.eye.add(b);
        this.at.add(b);
        
        // Update view matrix
        this.updateViewMatrix();
    }

    moveLeft() {
        let speed = 0.1;
        
        // Compute forward vector f = at - eye
        let f = new Vector3();
        f.set(this.at);
        f.sub(this.eye);
        
        // Compute side vector s = up x f
        let s = Vector3.cross(this.up, f);
        
        // Normalize s
        s.normalize();
        
        // Scale s by speed
        s.mul(speed);
        
        // Add side vector to both eye and at
        this.eye.add(s);
        this.at.add(s);
        
        // Update view matrix
        this.updateViewMatrix();
    }

    moveRight() {
        let speed = 0.1;
        
        // Compute forward vector f = at - eye
        let f = new Vector3();
        f.set(this.at);
        f.sub(this.eye);
        
        // Compute side vector s = f x up
        let s = Vector3.cross(f, this.up);
        
        // Normalize s
        s.normalize();
        
        // Scale s by speed
        s.mul(speed);
        
        // Add side vector to both eye and at
        this.eye.add(s);
        this.at.add(s);
        
        // Update view matrix
        this.updateViewMatrix();
    }
}