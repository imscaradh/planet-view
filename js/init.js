"use strict";

var Node = function () {
    this.children = [];
    this.localMatrix = m4identity();
    this.worldMatrix = m4identity();
};

Node.prototype.setParent = function (parent) {
    // remove us from our parent
    if (this.parent) {
        var ndx = this.parent.children.indexOf(this);
        if (ndx >= 0) {
            this.parent.children.splice(ndx, 1);
        }
    }

    // Add us to our new parent
    if (parent) {
        parent.children.push(this);
    }
    this.parent = parent;
};

Node.prototype.updateWorldMatrix = function (matrix) {
    if (matrix) {
        // a matrix was passed in so do the math
        this.worldMatrix = m4multiply(this.localMatrix, matrix);
    } else {
        // no matrix was passed in so just copy.
        this.worldMatrix = this.localMatrix;
    }

    // now process all the children
    var worldMatrix = this.worldMatrix;
    this.children.forEach(function (child) {
        child.updateWorldMatrix(worldMatrix);
    });
};

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
    // setup GLSL program
    var programInfo = createProgramInfo(gl, ["3d-vertex-shader", "3d-fragment-shader"]);

    // Some camera options
    var fieldOfViewRadians = degToRad(80);
    var cameraAngle = 0;
    var cameraRadius = 100;

    var solarSystemNode = new Node();
    var earthOrbitNode = new Node();
    earthOrbitNode.localMatrix = m4translate(100, 0, 0);

    // Sun related configuration
    var sunNode = new Node();
    sunNode.data = {
        uniforms: {
            u_colorMult: [1, 1, 0.5, 1],
            u_matrix: m4identity()
        },
        bufferInfo: createFlattenedVertices(gl, primitives.createSphereVertices(20, 100, 100)),
        translation: [0, 0, 0],
        rotationAngle: 0
    };

    // Earth related configuration
    var earthNode = new Node();
    earthNode.data = {
        uniforms: {
            u_colorMult: [0.5, 1, 0.5, 1],
            u_matrix: m4identity()
        },
        bufferInfo: createFlattenedVertices(gl, primitives.createSphereVertices(10, 100, 100)),
        translation: [70, 0, 0],
        rotationAngle: 0
    };

    sunNode.setParent(solarSystemNode);
    earthOrbitNode.setParent(solarSystemNode);
    earthNode.setParent(earthOrbitNode);

    var objects = [
        sunNode,
        earthNode
    ];

    var objectsToDraw = [
        sunNode.data,
        earthNode.data
    ];


    requestAnimationFrame(drawScene);

    // Draw the scene.
    function drawScene() {
        // Increase rotation
        earthNode.data.rotationAngle += 0.1;
        sunNode.data.rotationAngle += 0.001;

        // Compute the projection matrix
        var aspect = canvas.clientWidth / canvas.clientHeight;
        var projectionMatrix = makePerspective(fieldOfViewRadians, aspect, 1, 2000);

        // Compute the camera's matrix using look at.
        var cameraPosition = [0, 0, -500];
        var target = [0, 0, 0];
        var up = [1, 0, 0];
        var cameraMatrix = makeLookAt(cameraPosition, target, up);

        // Make a view matrix from the camera matrix.
        var viewMatrix = m4inverse(projectionMatrix);
        var viewProjectionMatrix = m4multiply(viewMatrix, projectionMatrix);

        /* // ------ Draw earth --------------------------------------------------
         earthNode.localMatrix = computeMatrix(
         viewProjectionMatrix,
         earthNode.data.translation,
         [0, 1, 0.8],
         earthNode.data.rotationAngle
         );

         /// ------ Draw sun --------------------------------------------------
         sunNode.localMatrix = computeMatrix(
         viewProjectionMatrix,
         sunNode.data.translation,
         [0, 1, 0],
         sunNode.data.rotationAngle
         );*/

        // update the local matrices for each object.
        earthOrbitNode.localMatrix = m4multiply(earthOrbitNode.localMatrix, m4rotateY(0.01));
        // spin the sun
        sunNode.localMatrix = m4multiply(sunNode.localMatrix, m4rotateY(0.005));
        // spin the earth
        earthNode.localMatrix = m4multiply(earthNode.localMatrix, m4rotateY(0.05));

        // Update all world matrices in the scene graph
        solarSystemNode.updateWorldMatrix();


        // Compute all the matrices for rendering
        objects.forEach(function (object) {
            object.data.uniforms.u_matrix = m4multiply(object.worldMatrix, viewProjectionMatrix);
        });

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        // Clear the canvas AND the depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Compute all the matrices for rendering
        objects.forEach(function (object) {
            object.data.uniforms.u_matrix = m4multiply(object.worldMatrix, viewMatrix);
        });


        // ------ Draw the objects --------

        var lastUsedProgramInfo = null;
        var lastUsedBufferInfo = null;

        objectsToDraw.forEach(function (object) {
            var bufferInfo = object.bufferInfo;
            var bindBuffers = false;

            if (programInfo !== lastUsedProgramInfo) {
                lastUsedProgramInfo = programInfo;
                gl.useProgram(programInfo.program);

                // We have to rebind buffers when changing programs because we
                // only bind buffers the program uses. So if 2 programs use the same
                // bufferInfo but the 1st one uses only positions the when the
                // we switch to the 2nd one some of the attributes will not be on.
                bindBuffers = true;
            }

            // Setup all the needed attributes.
            if (bindBuffers || bufferInfo !== lastUsedBufferInfo) {
                lastUsedBufferInfo = bufferInfo;
                setBuffersAndAttributes(gl, programInfo.attribSetters, bufferInfo);
            }

            // Set the uniforms.
            setUniforms(programInfo.uniformSetters, object.uniforms);

            // Draw
            gl.drawArrays(gl.TRIANGLES, 0, bufferInfo.numElements);
        });

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
        //matrix = m4multiply(matrix, rotationMatrix);
        matrix = m4multiply(matrix, translationMatrix);
        matrix = m4multiply(matrix, viewMatrix);
        matrix = m4multiply(matrix, projectionMatrix);
        return matrix;
    }


}

window.addEventListener('load', main);