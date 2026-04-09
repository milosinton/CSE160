class Cube {
  constructor(){
    this.type='cube';
    this.color = [1.0, 1.0, 1.0, 1.0];
    this.matrix = new Matrix4();
    this.textureNum = 0;
  }

  // ---------- STATIC (shared) fast-geometry ----------
  static _fastVBO = null;
  static _fastCount = 0;

  static initFastGeometry() {
    if (Cube._fastVBO) return;

    // Interleaved: [x,y,z, u,v] for each vertex
    // 12 triangles = 36 vertices
    const data = new Float32Array([
      // FRONT (z=0)
      0,0,0,  0,0,   1,1,0,  1,1,   1,0,0,  1,0,
      0,0,0,  0,0,   0,1,0,  0,1,   1,1,0,  1,1,

      // BACK (z=-1)
      0,0,-1, 0,0,   1,0,-1, 1,0,   1,1,-1, 1,1,
      0,0,-1, 0,0,   1,1,-1, 1,1,   0,1,-1, 0,1,

      // TOP (y=1)
      0,1,0,  0,0,   1,1,0,  1,0,   1,1,-1, 1,1,
      0,1,0,  0,0,   1,1,-1, 1,1,   0,1,-1, 0,1,

      // BOTTOM (y=0)
      0,0,0,  0,0,   1,0,-1, 1,1,   1,0,0,  1,0,
      0,0,0,  0,0,   0,0,-1, 0,1,   1,0,-1, 1,1,

      // RIGHT (x=1)
      1,0,0,  0,0,   1,1,0,  0,1,   1,1,-1, 1,1,
      1,0,0,  0,0,   1,1,-1, 1,1,   1,0,-1, 1,0,

      // LEFT (x=0)
      0,0,0,  0,0,   0,1,-1, 1,1,   0,1,0,  1,0,
      0,0,0,  0,0,   0,0,-1, 0,1,   0,1,-1, 1,1,
    ]);

    Cube._fastCount = 36;

    Cube._fastVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, Cube._fastVBO);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }

  // ---------- FAST RENDER ----------
  renderFast() {
    Cube.initFastGeometry();

    // uniforms (same as your render())
    gl.uniform1i(u_whichTexture, this.textureNum);
    gl.uniform4f(u_FragColor, this.color[0], this.color[1], this.color[2], this.color[3]);
    gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

    // bind shared buffer once per cube
    gl.bindBuffer(gl.ARRAY_BUFFER, Cube._fastVBO);

    const FSIZE = Float32Array.BYTES_PER_ELEMENT;
    const stride = 5 * FSIZE;

    // position: 3 floats starting at 0
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(a_Position);

    // uv: 2 floats starting after xyz
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, stride, 3 * FSIZE);
    gl.enableVertexAttribArray(a_UV);

    gl.drawArrays(gl.TRIANGLES, 0, Cube._fastCount);
  }

    render(){ 
        //var xy = this.position;
        var rgba = this.color;
        //var size = this.size;
        //var segments = this.segment
        
        gl.uniform1i(u_whichTexture, this.textureNum);

        gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);
        gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
    
         // Front face (brightest - this faces toward you)
        drawTriangle3DUV( [0.0,0.0,0.0,  1.0,1.0,0.0,  1.0,0.0,0.0 ], [0,0, 1,1, 1,0]);
        drawTriangle3DUV( [0.0,0.0,0.0,  0.0,1.0,0.0,  1.0,1.0,0.0 ], [0,0, 0,1, 1,1]);

        // Back face (darkest - this faces away)
        //gl.uniform4f(u_FragColor, rgba[0]*1.0, rgba[1]*1.0, rgba[2]*1.0, rgba[3]);
        drawTriangle3DUV( [0.0,0.0,-1.0,  1.0,0.0,-1.0,  1.0,1.0,-1.0 ], [0,0, 1,0, 1,1]);
        drawTriangle3DUV( [0.0,0.0,-1.0,  1.0,1.0,-1.0,  0.0,1.0,-1.0 ], [0,0, 1,1, 0,1]);

        // Top face (bright - often visible)
        //gl.uniform4f(u_FragColor, rgba[0]*0.9, rgba[1]*0.9, rgba[2]*0.9, rgba[3]);
        drawTriangle3DUV( [0.0,1.0,0.0,  1.0,1.0,0.0,  1.0,1.0,-1.0 ], [0,0, 1,0, 1,1]);
        drawTriangle3DUV( [0.0,1.0,0.0,  1.0,1.0,-1.0, 0.0,1.0,-1.0 ], [0,0, 1,1, 0,1]);

        // Bottom face (darker)
        //gl.uniform4f(u_FragColor, rgba[0]*0.6, rgba[1]*0.6, rgba[2]*0.6, rgba[3]);
        drawTriangle3DUV( [0.0,0.0,0.0,  1.0,0.0,-1.0,  1.0,0.0,0.0 ], [0,0, 1,1, 1,0]);
        drawTriangle3DUV( [0.0,0.0,0.0,  0.0,0.0,-1.0,  1.0,0.0,-1.0 ], [0,0, 0,1, 1,1]);

        // Right face (medium-bright - side face)
        //gl.uniform4f(u_FragColor, rgba[0]*0.8, rgba[1]*0.8, rgba[2]*0.8, rgba[3]);
        drawTriangle3DUV( [1.0,0.0,0.0,  1.0,1.0,0.0,  1.0,1.0,-1.0 ], [0,0, 0,1, 1,1]);
        drawTriangle3DUV( [1.0,0.0,0.0,  1.0,1.0,-1.0, 1.0,0.0,-1.0 ], [0,0, 1,1, 1,0]);

        // Left face (medium - side face)
        //gl.uniform4f(u_FragColor, rgba[0]*0.7, rgba[1]*0.7, rgba[2]*0.7, rgba[3]);
        drawTriangle3DUV( [0.0,0.0,0.0,  0.0,1.0,-1.0,  0.0,1.0,0.0 ], [0,0, 1,1, 1,0]);
        drawTriangle3DUV( [0.0,0.0,0.0,  0.0,0.0,-1.0,  0.0,1.0,-1.0 ], [0,0, 0,1, 1,1]);

    }
}