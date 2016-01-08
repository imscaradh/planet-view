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

    // This will creates our simple spheres
    var earthBufferInfo = createFlattenedVertices(gl, primitives.createSphereVertices(10, 100, 100));
    var sunBufferInfo = createFlattenedVertices(gl, primitives.createSphereVertices(20, 100, 100));

    // setup GLSL program
    var programInfo = createProgramInfo(gl, ["3d-vertex-shader", "3d-fragment-shader"]);

    // Some camera options
    var fieldOfViewRadians = degToRad(60);
    var cameraAngle = 0;
    var cameraRadius = 100;

    // Earth related configuration
    var earthData = {
        u_colorMult: [0.5, 1, 0.5, 1],
        u_matrix: m4identity(),
        translation: [70, 0, 0],
        rotationAngle: 0
    };
    // Sun related configuration
    var sunData = {
        u_colorMult: [1, 1, 0.5, 1],
        u_matrix: m4identity(),
        translation: [0, 0, 0],
        rotationAngle: 0
    };

    requestAnimationFrame(drawScene);

    // Draw the scene.
    function drawScene() {
        // Increase rotation
        earthData.rotationAngle += 0.1;
        sunData.rotationAngle += 0.001;

        // Ugly workaround: Rotate with camera around whole system
        cameraAngle += 0.01;

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        // Clear the canvas AND the depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Compute the projection matrix
        var aspect = canvas.clientWidth / canvas.clientHeight;
        var projectionMatrix = makePerspective(fieldOfViewRadians, aspect, 1, 2000);

        // Use matrix math to compute a position on the circle.
        var cameraMatrix = m4translate(0, 0, cameraRadius * 1.5);
        cameraMatrix = m4multiply(cameraMatrix, m4rotateY(cameraAngle));

        gl.useProgram(programInfo.program);

        // Make a view matrix from the camera matrix.
        var viewMatrix = m4inverse(cameraMatrix);

        // ------ Draw earth --------------------------------------------------

        // Setup all the needed attributes.
        setBuffersAndAttributes(gl, programInfo.attribSetters, earthBufferInfo);

        earthData.u_matrix = computeMatrix(
            viewMatrix,
            projectionMatrix,
            earthData.translation,
            [0, 1, 0.8],
            earthData.rotationAngle
        );

        // Set the uniforms we just computed
        setUniforms(programInfo.uniformSetters, earthData);

        gl.drawArrays(gl.TRIANGLES, 0, earthBufferInfo.numElements);


        /// ------ Draw sun --------------------------------------------------

        // Setup all the needed attributes.
        setBuffersAndAttributes(gl, programInfo.attribSetters, sunBufferInfo);

        sunData.u_matrix = computeMatrix(
            viewMatrix,
            projectionMatrix,
            sunData.translation,
            [0, 1, 0],
            sunData.rotationAngle
        );

        // Set the uniforms we just computed
        setUniforms(programInfo.uniformSetters, sunData);

        gl.drawArrays(gl.TRIANGLES, 0, sunBufferInfo.numElements);

        requestAnimationFrame(drawScene);
    }

    function computeMatrix(viewMatrix, projectionMatrix, translation, rotationAxisVector, rotationAngle) {
        // This rotation matrices represents a rotation for each axis (euler method)
        //var xRotationMatrix = m4rotateX(xRotation);
        //var yRotationMatrix = m4rotateY(yRotation);
        //var zRotationMatrix = m4rotateZ(zRotation);

        // Here we have a rotation using quaternions
        var quaternion = makequaternion(rotationAxisVector, rotationAngle);
        var rotationMatrix = quaternion.makeRotationMatrix();

        //FIXME: Something is not correct with this kind of rotation
        //var rotationMatrix = rodriguesRotation(rotationAxisVector, rotationAngle);

        var translationMatrix = m4translate(translation[0], translation[1], translation[2]);
        var matrix = m4identity();
        matrix = m4multiply(matrix, rotationMatrix);
        var worldMatrix = m4multiply(matrix, translationMatrix);
        matrix = m4multiply(worldMatrix, viewMatrix);
        return m4multiply(matrix, projectionMatrix);
    }
}

window.addEventListener('load', main);