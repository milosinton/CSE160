class Dodecahedron {
    constructor(){
        this.type = 'dodecahedron';
        this.color = [1.0, 1.0, 1.0, 1.0];
        this.matrix = new Matrix4();
    }

    render(){ 
        var rgba = this.color;

        // Apply the transformation matrix
        gl.uniformMatrix4fv(u_ModelMatrix, false, this.matrix.elements);
        gl.uniform4f(u_FragColor, rgba[0], rgba[1], rgba[2], rgba[3]);

        // Golden ratio for dodecahedron vertices
        var phi = (1 + Math.sqrt(5)) / 2;  // ≈ 1.618
        var invPhi = 1 / phi;               // ≈ 0.618

        // Scale factor to normalize the dodecahedron to unit size
        var scale = 0.5;

        // 20 vertices of a dodecahedron (centered at origin)
        var vertices = [
            // Cube vertices (±1, ±1, ±1)
            [ scale,  scale,  scale],
            [ scale,  scale, -scale],
            [ scale, -scale,  scale],
            [ scale, -scale, -scale],
            [-scale,  scale,  scale],
            [-scale,  scale, -scale],
            [-scale, -scale,  scale],
            [-scale, -scale, -scale],
            
            // Rectangle in xy plane (0, ±1/φ, ±φ)
            [0,  invPhi * scale,  phi * scale],
            [0,  invPhi * scale, -phi * scale],
            [0, -invPhi * scale,  phi * scale],
            [0, -invPhi * scale, -phi * scale],
            
            // Rectangle in xz plane (±1/φ, ±φ, 0)
            [ invPhi * scale,  phi * scale, 0],
            [ invPhi * scale, -phi * scale, 0],
            [-invPhi * scale,  phi * scale, 0],
            [-invPhi * scale, -phi * scale, 0],
            
            // Rectangle in yz plane (±φ, 0, ±1/φ)
            [ phi * scale, 0,  invPhi * scale],
            [ phi * scale, 0, -invPhi * scale],
            [-phi * scale, 0,  invPhi * scale],
            [-phi * scale, 0, -invPhi * scale]
        ];

        // 12 pentagonal faces, each split into 3 triangles
        // Each face is defined by 5 vertex indices
        var faces = [
            [0, 16, 2, 10, 8],
            [0, 8, 4, 14, 12],
            [0, 12, 1, 17, 16],
            [1, 9, 11, 3, 17],
            [1, 12, 14, 5, 9],
            [2, 13, 15, 6, 10],
            [2, 16, 17, 3, 13],
            [3, 11, 7, 15, 13],
            [4, 8, 10, 6, 18],
            [4, 18, 19, 5, 14],
            [5, 19, 7, 11, 9],
            [6, 15, 7, 19, 18]
        ];

        // Draw each pentagonal face as 3 triangles (fan triangulation from first vertex)
        for (var i = 0; i < faces.length; i++) {
            var face = faces[i];
            
            // Get the 5 vertices of this pentagonal face
            var v0 = vertices[face[0]];
            var v1 = vertices[face[1]];
            var v2 = vertices[face[2]];
            var v3 = vertices[face[3]];
            var v4 = vertices[face[4]];
            
            // Add slight color variation per face for visibility
            var faceShade = 0.7 + (i / faces.length) * 0.3;
            gl.uniform4f(u_FragColor, rgba[0] * faceShade, rgba[1] * faceShade, rgba[2] * faceShade, rgba[3]);
            
            // Split pentagon into 3 triangles using fan triangulation
            // Triangle 1: v0, v1, v2
            drawTriangle3D([
                v0[0], v0[1], v0[2],
                v1[0], v1[1], v1[2],
                v2[0], v2[1], v2[2]
            ]);
            
            // Triangle 2: v0, v2, v3
            drawTriangle3D([
                v0[0], v0[1], v0[2],
                v2[0], v2[1], v2[2],
                v3[0], v3[1], v3[2]
            ]);
            
            // Triangle 3: v0, v3, v4
            drawTriangle3D([
                v0[0], v0[1], v0[2],
                v3[0], v3[1], v3[2],
                v4[0], v4[1], v4[2]
            ]);
        }
    }
}