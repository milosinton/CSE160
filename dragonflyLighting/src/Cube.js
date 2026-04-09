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

  static resetFastGeometry() { Cube._fastVBO = null; }

  static initFastGeometry() {
    if (Cube._fastVBO) return;

    // Interleaved: [x,y,z, u,v, nx,ny,nz] for each vertex = 8 floats per vertex
    // 12 triangles = 36 vertices
    const data = new Float32Array([
      // FRONT (z=0, normal: 0,0,1)
      0,0,0,  0,0,  0,0,1,    1,1,0,  1,1,  0,0,1,    1,0,0,  1,0,  0,0,1,
      0,0,0,  0,0,  0,0,1,    0,1,0,  0,1,  0,0,1,    1,1,0,  1,1,  0,0,1,

      // BACK (z=-1, normal: 0,0,-1)
      0,0,-1, 0,0,  0,0,-1,   1,0,-1, 1,0,  0,0,-1,   1,1,-1, 1,1,  0,0,-1,
      0,0,-1, 0,0,  0,0,-1,   1,1,-1, 1,1,  0,0,-1,   0,1,-1, 0,1,  0,0,-1,

      // TOP (y=1, normal: 0,1,0)
      0,1,0,  0,0,  0,1,0,    1,1,0,  1,0,  0,1,0,    1,1,-1, 1,1,  0,1,0,
      0,1,0,  0,0,  0,1,0,    1,1,-1, 1,1,  0,1,0,    0,1,-1, 0,1,  0,1,0,

      // BOTTOM (y=0, normal: 0,-1,0)
      0,0,0,  0,0,  0,-1,0,   1,0,-1, 1,1,  0,-1,0,   1,0,0,  1,0,  0,-1,0,
      0,0,0,  0,0,  0,-1,0,   0,0,-1, 0,1,  0,-1,0,   1,0,-1, 1,1,  0,-1,0,

      // RIGHT (x=1, normal: 1,0,0)
      1,0,0,  0,0,  1,0,0,    1,1,0,  0,1,  1,0,0,    1,1,-1, 1,1,  1,0,0,
      1,0,0,  0,0,  1,0,0,    1,1,-1, 1,1,  1,0,0,    1,0,-1, 1,0,  1,0,0,

      // LEFT (x=0, normal: -1,0,0)
      0,0,0,  0,0,  -1,0,0,   0,1,-1, 1,1,  -1,0,0,   0,1,0,  1,0,  -1,0,0,
      0,0,0,  0,0,  -1,0,0,   0,0,-1, 0,1,  -1,0,0,   0,1,-1, 1,1,  -1,0,0,
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

    // normal matrix = inverse transpose of model matrix
    var normalMatrix = new Matrix4();
    normalMatrix.setInverseOf(this.matrix);
    normalMatrix.transpose();
    gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);

    // bind shared buffer once per cube
    gl.bindBuffer(gl.ARRAY_BUFFER, Cube._fastVBO);

    const FSIZE = Float32Array.BYTES_PER_ELEMENT;
    const stride = 8 * FSIZE; // x,y,z, u,v, nx,ny,nz

    // position: 3 floats at offset 0
    gl.vertexAttribPointer(a_Position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(a_Position);

    // uv: 2 floats after xyz
    gl.vertexAttribPointer(a_UV, 2, gl.FLOAT, false, stride, 3 * FSIZE);
    gl.enableVertexAttribArray(a_UV);

    // normal: 3 floats after xyz+uv
    gl.vertexAttribPointer(a_Normal, 3, gl.FLOAT, false, stride, 5 * FSIZE);
    gl.enableVertexAttribArray(a_Normal);

    gl.drawArrays(gl.TRIANGLES, 0, Cube._fastCount);
  }

    render(){ 
        var rgba = this.color;
        
        gl.uniform1i(u_whichTexture, this.textureNum);
        gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);
        gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);

        // normal matrix = inverse transpose of model matrix
        var normalMatrix = new Matrix4();
        normalMatrix.setInverseOf(this.matrix);
        normalMatrix.transpose();
        gl.uniformMatrix4fv(u_NormalMatrix, false, normalMatrix.elements);
    
         // Front face (normal: 0,0,1)
        drawTriangle3DUVNormal( [0.0,0.0,0.0,  1.0,1.0,0.0,  1.0,0.0,0.0 ], [0,0, 1,1, 1,0], [0,0,1, 0,0,1, 0,0,1]);
        drawTriangle3DUVNormal( [0.0,0.0,0.0,  0.0,1.0,0.0,  1.0,1.0,0.0 ], [0,0, 0,1, 1,1], [0,0,1, 0,0,1, 0,0,1]);

        // Back face (normal: 0,0,-1)
        drawTriangle3DUVNormal( [0.0,0.0,-1.0,  1.0,0.0,-1.0,  1.0,1.0,-1.0 ], [0,0, 1,0, 1,1], [0,0,-1, 0,0,-1, 0,0,-1]);
        drawTriangle3DUVNormal( [0.0,0.0,-1.0,  1.0,1.0,-1.0,  0.0,1.0,-1.0 ], [0,0, 1,1, 0,1], [0,0,-1, 0,0,-1, 0,0,-1]);

        // Top face (normal: 0,1,0)
        drawTriangle3DUVNormal( [0.0,1.0,0.0,  1.0,1.0,0.0,  1.0,1.0,-1.0 ], [0,0, 1,0, 1,1], [0,1,0, 0,1,0, 0,1,0]);
        drawTriangle3DUVNormal( [0.0,1.0,0.0,  1.0,1.0,-1.0, 0.0,1.0,-1.0 ], [0,0, 1,1, 0,1], [0,1,0, 0,1,0, 0,1,0]);

        // Bottom face (normal: 0,-1,0)
        drawTriangle3DUVNormal( [0.0,0.0,0.0,  1.0,0.0,-1.0,  1.0,0.0,0.0 ], [0,0, 1,1, 1,0], [0,-1,0, 0,-1,0, 0,-1,0]);
        drawTriangle3DUVNormal( [0.0,0.0,0.0,  0.0,0.0,-1.0,  1.0,0.0,-1.0 ], [0,0, 0,1, 1,1], [0,-1,0, 0,-1,0, 0,-1,0]);

        // Right face (normal: 1,0,0)
        drawTriangle3DUVNormal( [1.0,0.0,0.0,  1.0,1.0,0.0,  1.0,1.0,-1.0 ], [0,0, 0,1, 1,1], [1,0,0, 1,0,0, 1,0,0]);
        drawTriangle3DUVNormal( [1.0,0.0,0.0,  1.0,1.0,-1.0, 1.0,0.0,-1.0 ], [0,0, 1,1, 1,0], [1,0,0, 1,0,0, 1,0,0]);

        // Left face (normal: -1,0,0)
        drawTriangle3DUVNormal( [0.0,0.0,0.0,  0.0,1.0,-1.0,  0.0,1.0,0.0 ], [0,0, 1,1, 1,0], [-1,0,0, -1,0,0, -1,0,0]);
        drawTriangle3DUVNormal( [0.0,0.0,0.0,  0.0,0.0,-1.0,  0.0,1.0,-1.0 ], [0,0, 0,1, 1,1], [-1,0,0, -1,0,0, -1,0,0]);

    }
}