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

Node.prototype.performTranslation = function (x, y, z) {
    var translation = m4translate(x, y, z);
    this.localMatrix = m4multiply(this.localMatrix, translation);
};

Node.prototype.performRotation = function (rotationAxisVector, rotationAngle) {
    // This rotation matrices represents a rotation for each axis (euler method)
    //var xRotationMatrix = m4rotateX(xRotation);
    //var yRotationMatrix = m4rotateY(yRotation);
    //var zRotationMatrix = m4rotateZ(zRotation);

    // Here we have a rotation using quaternions
    var quaternion = makequaternion(rotationAxisVector, rotationAngle);
    var rotationMatrix = quaternion.makeRotationMatrix();

    //FIXME: Something is not correct with this kind of rotation
    //var rotationMatrix = rodriguesRotation(rotationAxisVector, rotationAngle);
    this.localMatrix = m4multiply(this.localMatrix, rotationMatrix);
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

    var solarSystemNode = new Node();
    var earthOrbitNode = new Node();
    earthOrbitNode.performTranslation(100, 0, 0);

    var moonOrbitNode = new Node();
    moonOrbitNode.performTranslation(30, 0, 0);

    var marsOrbitNode = new Node();
    marsOrbitNode.performTranslation(180, 0, 0);

    // Sun related configuration
    var sunNode = new Node();
    sunNode.data = {
        uniforms: {
            u_colorMult: [1, 1, 0.5, 1],
            u_matrix: m4identity()
        },
        bufferInfo: createFlattenedVertices(gl, primitives.createSphereVertices(30, 100, 100))
    };

    // Earth related configuration
    var earthNode = new Node();
    earthNode.data = {
        uniforms: {
            u_colorMult: [0.5, 1, 0.5, 1],
            u_matrix: m4identity()
        },
        bufferInfo: createFlattenedVertices(gl, primitives.createSphereVertices(10, 100, 100))
    };

    // Moon related configuration
    var moonNode = new Node();
    moonNode.data = {
        uniforms: {
            u_colorMult: [0.5, 1, 1, 1],
            u_matrix: m4identity()
        },
        bufferInfo: createFlattenedVertices(gl, primitives.createSphereVertices(3, 100, 100))
    };

    // Mars related configuration
    var marsNode = new Node();
    marsNode.data = {
        uniforms: {
            u_colorMult: [1, 0.5, 1, 1],
            u_matrix: m4identity()
        },
        bufferInfo: createFlattenedVertices(gl, primitives.createSphereVertices(9, 100, 100))
    };

    sunNode.setParent(solarSystemNode);

    earthOrbitNode.setParent(solarSystemNode);
    earthNode.setParent(earthOrbitNode);

    moonOrbitNode.setParent(earthNode);
    moonNode.setParent(moonOrbitNode);

    marsOrbitNode.setParent(solarSystemNode);
    marsNode.setParent(marsOrbitNode);

    // Some camera options
    var fieldOfViewRadians = degToRad(20);
    var cameraRadius = 600;

    // static camera view with lookAt
    var cameraMatrix = m4translate(0, 600, cameraRadius * 1.5);
    var cameraPosition = [
        cameraMatrix[12],
        cameraMatrix[13],
        cameraMatrix[14]];

    var target = [0, 0, 0];
    var up = [0.3, 1, 0];

    cameraMatrix = makeLookAt(cameraPosition, target, up);

    var objects = [
        sunNode,
        earthNode,
        moonNode,
        marsNode
    ];

    var objectsToDraw = [
        sunNode.data,
        earthNode.data,
        moonNode.data,
        marsNode.data
    ];

    requestAnimationFrame(drawScene);

    // Draw the scene.
    function drawScene() {
        // Compute the projection matrix
        var aspect = canvas.clientWidth / canvas.clientHeight;
        var projectionMatrix = makePerspective(fieldOfViewRadians, aspect, 1, 2000);

        // attach camera to objects
        //cameraMatrix = earthNode.worldMatrix;

        // Make a view matrix from the camera matrix.
        var viewMatrix = m4inverse(cameraMatrix);
        var viewProjectionMatrix = m4multiply(viewMatrix, projectionMatrix);

        // update the local matrices for each object.
        earthOrbitNode.performRotation([0, 1, 0], 0.01);
        moonOrbitNode.performRotation([0, 1, 0.5], 0.134);
        marsOrbitNode.performRotation([0, 1, 0], 0.00531);

        // spin the sun
        //sunNode.performRotation([0, 1, 0], 100);

        // spin the earth
        earthNode.performRotation([0, 1, 0.1], -0.03);

        // spin the mars
        marsNode.performRotation([0, 1, 0.1], -0.03);

        // Update all world matrices in the scene graph
        solarSystemNode.updateWorldMatrix();

        gl.enable(gl.CULL_FACE);
        gl.enable(gl.DEPTH_TEST);

        // Clear the canvas AND the depth buffer.
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // Compute all the matrices for rendering
        objects.forEach(function (object) {
            object.data.uniforms.u_matrix = m4multiply(object.worldMatrix, viewProjectionMatrix);
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
}

window.addEventListener('load', main);