"use strict";

function main() {
    // Get A WebGL context
    var canvas = document.getElementById("canvas");
    var gl = getWebGLContext(canvas);
    if (!gl) {
        return;
    }

    var createFlattenedVertices = function (gl, vertices) {
        return createBufferInfoFromArrays(
            gl,
            primitives.makeRandomVertexColors(
                primitives.deindexVertices(vertices),
                {
                    vertsPerColor: 6,
                    rand: function (ndx, channel) {
                        return channel < 3 ? ((128 + Math.random() * 128) | 0) : 255;
                    }
                })
        );
    };

    var earthBufferInfo = createFlattenedVertices(gl, primitives.createSphereVertices(10, 100, 100));
    var sunBufferInfo = createFlattenedVertices(gl, primitives.createSphereVertices(30, 100, 100));


    // setup GLSL program
    var programInfo = createProgramInfo(gl, ["3d-vertex-shader", "3d-fragment-shader"]);

    var fieldOfViewRadians = degToRad(60);
    var cameraHeight = 50;
    var cameraAngle = 0;
    var cameraRadius = 100;

    // Earth
    var earthUniforms = {
        u_colorMult: [0.5, 1, 0.5, 1],
        u_matrix: m4identity()
    };
    var sphereTranslation = [70, 0, 0];

    // Sun
    var sunUniforms = {
        u_colorMult: [1, 1, 0.5, 1],
        u_matrix: m4identity()
    };
    var sunTranslation = [0, 0, 0];


    var planetRot = 0;
    requestAnimationFrame(drawScene);

    // Draw the scene.
    function drawScene() {
        planetRot += 0.1;
        cameraAngle += 0.01;

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        // Clear the canvas AND the depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Compute the projection matrix
        var aspect = canvas.clientWidth / canvas.clientHeight;
        var projectionMatrix =
            makePerspective(fieldOfViewRadians, aspect, 1, 2000);

        // Use matrix math to compute a position on the circle.
        var cameraMatrix = m4translate(0, 0, cameraRadius * 1.5);
        cameraMatrix = m4multiply(cameraMatrix, m4rotateY(cameraAngle));

        gl.useProgram(programInfo.program);

        // Make a view matrix from the camera matrix.
        var viewMatrix = m4inverse(cameraMatrix);

        // ------ Draw earth --------------------------------------------------
        var earthXRotation = 0;
        var earthYRotation = planetRot;

        var earthZRotation = degToRad(23.5);

        // Setup all the needed attributes.
        setBuffersAndAttributes(gl, programInfo.attribSetters, earthBufferInfo);

        earthUniforms.u_matrix = computeMatrix(
            viewMatrix,
            projectionMatrix,
            sphereTranslation,
            earthXRotation,
            earthYRotation,
            earthZRotation
        );

        // Set the uniforms we just computed
        setUniforms(programInfo.uniformSetters, earthUniforms);

        gl.drawArrays(gl.TRIANGLES, 0, earthBufferInfo.numElements);


        /// ------ Draw sun --------------------------------------------------
        var sunXRotation = 0;
        var sunYRotation = planetRot;
        var sunZRotation = 0;

        // Setup all the needed attributes.
        setBuffersAndAttributes(gl, programInfo.attribSetters, sunBufferInfo);

        sunUniforms.u_matrix = computeMatrix(
            viewMatrix,
            projectionMatrix,
            sunTranslation,
            sunXRotation,
            sunYRotation,
            sunZRotation
        );

        // Set the uniforms we just computed
        setUniforms(programInfo.uniformSetters, sunUniforms);

        gl.drawArrays(gl.TRIANGLES, 0, sunBufferInfo.numElements);

        requestAnimationFrame(drawScene);
    }

    function computeMatrix(viewMatrix, projectionMatrix, translation, xRotation, yRotation, zRotation) {
        var xRotationMatrix = m4rotateX(xRotation);
        var yRotationMatrix = m4rotateY(yRotation);
        var zRotationMatrix = m4rotateZ(zRotation);
        var translationMatrix = m4translate(translation[0], translation[1], translation[2]);
        var matrix = m4identity();
        matrix = m4multiply(matrix, xRotationMatrix);
        matrix = m4multiply(matrix, yRotationMatrix);
        matrix = m4multiply(matrix, zRotationMatrix);
        var worldMatrix = m4multiply(matrix, translationMatrix);
        matrix = m4multiply(worldMatrix, viewMatrix);
        return m4multiply(matrix, projectionMatrix);
    }
}

window.addEventListener('load', main);