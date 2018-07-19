// const {loadNumpy} = require('./util.js')
//@ts-check
const NumpyParser = require("numpy-parser");
const NDArray = require("ndarray");


const voxelSize = 1

if (!Detector.webgl) Detector.addGetWebGLMessage();

var container, stats;
var camera, scene, renderer, terrain_mesh, controls;
var offsetAttribute, occupancyAttribute;

var lastTime = 0;

const MIN_OCCUPANCY = 254;
const TERRAIN_OCCUPANCY = 255;
const BUIDLING_OCCUPANCY = 254;

const terrain_occupancies = [];
const terrain_offsets = [];
const building_occupanceis = [];
const building_offsets = [];
const variances = [];
const errors = [];


let xMin;
let xMax;
let yMin;
let yMax;
let zMin;
let zMax;

// var mapVersion;
// var mapType;
// var mapTypes = ["Unknown", "CRM", "Log-Odds", "GroundTruth"];

var lightX = 10;
var lightY = 10;
var lightZ = 10;

function loadMap() {
  var reader = new FileReader();
  reader.addEventListener(
    "load",
    function (e) {
      arrayBuffer = reader.result;
      const data = NumpyParser.fromArrayBuffer(arrayBuffer);
      const map = NDArray(data.data, data.shape);

      xMin = 0
      xMax = map.shape[0]
      yMin = 0
      yMax = map.shape[1]
      zMin = 0
      zMax = map.shape[2]
      console.log(
        "voxelSize",
        voxelSize,
        "  | xMin",
        xMin,
        "  | xMax",
        xMax,
        "  | yMin",
        yMin,
        "  | yMax",
        yMax,
        "  | zMin",
        zMin,
        "  | zMax",
        zMax,
      );
      let voxelsX = Math.floor((xMax - xMin) / voxelSize);
      let voxelsY = Math.floor((yMax - yMin) / voxelSize);
      let voxelsZ = Math.floor((zMax - zMin) / voxelSize);
      for (let x = 0; x < voxelsX; ++x) {
        for (let y = 0; y < voxelsY; ++y) {
          for (let z = 0; z < voxelsZ; ++z) {
            let occupancy = map.get(x, y, z)
            // if(x > 400 || y > 400)
            //   continue;
            if (occupancy === TERRAIN_OCCUPANCY) {
              terrain_occupancies.push(occupancy / 255);
              terrain_offsets.push(
                xMin + x * voxelSize,
                zMin + z * voxelSize,
                yMin + y * voxelSize
              )
            } else if(occupancy === BUIDLING_OCCUPANCY) {
              building_occupanceis.push(occupancy / 255);
              building_offsets.push(
                xMin + x * voxelSize,
                zMin + z * voxelSize,
                yMin + y * voxelSize
              )
            }
          }
        }
      }

      document.getElementById("info").innerHTML =
        "<p>" +
        fileopener.files[0].name +
        " - " +
        String(voxelsX) +
        "x" +
        String(voxelsZ) +
        "x" +
        String(voxelsY) +
        " " +
        " map (" +
        String(voxelsX * voxelsY * voxelsZ) +
        " voxels, v" +
        ")</p>";
      // setTimeout(function() {
      // 	var element = document.getElementById("info");
      // 	element.outerHTML = "";
      // 	delete element;
      // }, 8000);

      init();
      animate();
    },
    false
  );
  reader.readAsArrayBuffer(document.getElementById("fileopener").files[0]);
}



window.loadMap = loadMap

var clock;
function init() {
  var gui = new dat.GUI({
    height: 5 * 32 - 1,
    width: 300
  });

  clock = new THREE.Clock();

  container = document.getElementById("container");

  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    10000
  );
  camera.position.z = 20;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x888888);

  // geometry
  console.log("occupancies", terrain_occupancies.length);

  var instances = 10000000;

  var bufferGeometry = new THREE.BoxBufferGeometry(
    voxelSize,
    voxelSize,
    voxelSize
  );

  // copying data from a simple box geometry, but you can specify a custom geometry if you want

  var terrain_geometry = new THREE.InstancedBufferGeometry();
  terrain_geometry.index = bufferGeometry.index;
  terrain_geometry.attributes.position = bufferGeometry.attributes.position;
  terrain_geometry.attributes.uv = bufferGeometry.attributes.uv;
  terrain_geometry.attributes.normal = bufferGeometry.attributes.normal;

  let building_geometry = new THREE.InstancedBufferGeometry();
  building_geometry.index = bufferGeometry.index;
  building_geometry.attributes.position = bufferGeometry.attributes.position;
  building_geometry.attributes.uv = bufferGeometry.attributes.uv;
  building_geometry.attributes.normal = bufferGeometry.attributes.normal;

  // per instance data

  // var orientations = [];

  var x, y, z, w;

  offsetAttribute = new THREE.InstancedBufferAttribute(
    new Float32Array(terrain_offsets),
    3
  );
  // orientationAttribute = new THREE.InstancedBufferAttribute( new Float32Array( orientations ), 4 ).setDynamic( true );
  occupancyAttribute = new THREE.InstancedBufferAttribute(
    new Float32Array(terrain_occupancies),
    1
  );

  let offsetAttribute_building = new THREE.InstancedBufferAttribute(
    new Float32Array(building_offsets),
    3
  );
  // varianceAttribute = new THREE.InstancedBufferAttribute(
  //   new Float32Array(variances),
  //   1
  // );
  // errorAttribute = new THREE.InstancedBufferAttribute(
  //   new Float32Array(errors),
  //   1
  // );

  terrain_geometry.addAttribute("offset", offsetAttribute);
  building_geometry.addAttribute("offset", offsetAttribute_building);

  var terrain_material = new THREE.RawShaderMaterial({
    uniforms: {
      threshold: { value: 0.5 },
      xMin: { value: xMin },
      xMax: { value: xMax },
      yMin: { value: yMin },
      yMax: { value: yMax },
      zMin: { value: zMin },
      zMax: { value: zMax },
      lightX: { value: lightX },
      lightY: { value: lightY },
      lightZ: { value: lightZ },
      mode: { value: 0 },
      highlightErrors: { value: false },
      errorThreshold: { value: 0.3 }
    },
    vertexShader: document.getElementById("vertexShader").textContent,
    fragmentShader: document.getElementById("fragmentShader").textContent
  });

  var building_material = new THREE.RawShaderMaterial({
    uniforms: {
      xMin: { value: xMin },
      xMax: { value: xMax },
      yMin: { value: yMin },
      yMax: { value: yMax },
      zMin: { value: zMin },
      zMax: { value: zMax },
      lightX: { value: lightX },
      lightY: { value: lightY },
      lightZ: { value: lightZ },
    },
    vertexShader: document.getElementById("vertexShader_building").textContent,
    fragmentShader: document.getElementById("fragmentShader_building").textContent
  });

  

  terrain_mesh = new THREE.Mesh(terrain_geometry, terrain_material);
  let building_mesh = new THREE.Mesh(building_geometry, building_material);

  var params = {
    threshold: 0.5,
    showAxes: true,
    showBoundingBox: true,
    xMin: xMin,
    xMax: xMax,
    yMin: yMin,
    yMax: yMax,
    zMin: zMin,
    zMax: zMax,
    lightX: lightX,
    lightY: lightY,
    lightZ: lightZ,
    screenshot: function () {
      renderer.render(scene, camera);
      var imgData = renderer.domElement.toDataURL();
      // var imgNode = document.createElement("img");
      // imgNode.src = imgData;
      var element = document.createElement("a");
      element.setAttribute("href", imgData); // 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
      element.setAttribute("download", "screenshot.png");

      element.style.display = "none";
      document.body.appendChild(element);

      element.click();
    },
    backgroundColor: "#888888",
  };
  gui
    .add(params, "mode", { occupancy: 0, variance: 1, inconsistency: 2 })
    .onChange(function (mode) {
      terrain_mesh.material.uniforms.mode.value = mode;
    });
  gui.add(params, "highlightErrors").onChange(function (highlightErrors) {
    terrain_mesh.material.uniforms.highlightErrors.value = highlightErrors;
  });
  gui
    .add(params, "errorThreshold")
    .min(0.0)
    .max(1.0)
    .step(0.01)
    .onChange(function (errorThreshold) {
      terrain_mesh.material.uniforms.errorThreshold.value = errorThreshold;
    });
  var slicing = gui.addFolder("Slicing");
  slicing
    .add(params, "xMin")
    .min(xMin)
    .max(xMax)
    .step(0.01)
    .onChange(function (v) {
      terrain_mesh.material.uniforms.xMin.value = v;
    });
  slicing
    .add(params, "xMax")
    .min(xMin)
    .max(xMax)
    .step(0.01)
    .onChange(function (v) {
      terrain_mesh.material.uniforms.xMax.value = v;
    });
  slicing
    .add(params, "yMin")
    .min(yMin)
    .max(yMax)
    .step(0.01)
    .onChange(function (v) {
      terrain_mesh.material.uniforms.yMin.value = v;
    });
  slicing
    .add(params, "yMax")
    .min(yMin)
    .max(yMax)
    .step(0.01)
    .onChange(function (v) {
      terrain_mesh.material.uniforms.yMax.value = v;
    });
  slicing
    .add(params, "zMin")
    .min(zMin)
    .max(zMax)
    .step(0.01)
    .onChange(function (v) {
      terrain_mesh.material.uniforms.zMin.value = v;
    });
  slicing
    .add(params, "zMax")
    .min(zMin)
    .max(zMax)
    .step(0.01)
    .onChange(function (v) {
      terrain_mesh.material.uniforms.zMax.value = v;
    });

  gui.add(params, "screenshot");
  var rendering = gui.addFolder("Rendering");
  rendering.addColor(params, "backgroundColor").onChange(function (v) {
    scene.background = new THREE.Color(v);
  });

  rendering
    .add(params, "lightX")
    .min(-10)
    .max(10)
    .step(0.01)
    .onChange(function (v) {
      terrain_mesh.material.uniforms.lightX.value = v;
    });
  rendering
    .add(params, "lightY")
    .min(-10)
    .max(10)
    .step(0.01)
    .onChange(function (v) {
      terrain_mesh.material.uniforms.lightY.value = v;
    });
  rendering
    .add(params, "lightZ")
    .min(-10)
    .max(10)
    .step(0.01)
    .onChange(function (v) {
      terrain_mesh.material.uniforms.lightZ.value = v;
    });

  var cube = new THREE.LineSegments(
    new THREE.EdgesGeometry(
      new THREE.CubeGeometry(xMax - xMin, zMax - zMin, yMax - yMin)
    ),
    new THREE.LineBasicMaterial({
      color: 0xff8010
    })
  );
  cube.translateX((xMax + xMin) / 2 - voxelSize / 2);
  cube.translateZ((yMax + yMin) / 2 - voxelSize / 2);
  cube.translateY((zMax + zMin) / 2 - voxelSize / 2);
  camera.lookAt((xMax + xMin) / 2, (yMax + yMin) / 2, (zMax + zMin) / 2);

  scene.add(cube);
  rendering.add(params, "showBoundingBox").onChange(function (showBoundingBox) {
    cube.visible = showBoundingBox;
  });

  scene.add(terrain_mesh);
  scene.add(building_mesh);

  var axesHelper = new THREE.AxesHelper(5);
  axesHelper.rotation.x = -Math.PI / 2;
  axesHelper.scale.y = -1;

  scene.add(axesHelper);

  rendering.add(params, "showAxes").onChange(function (showAxes) {
    axesHelper.visible = showAxes;
  });

  gui.remember(params);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  // controls.lookSpeed = 0.04;
  //       controls.movementSpeed = 1;
  //       controls.noFly = true;
  //       controls.lookVertical = true;
  //       controls.constrainVertical = true;
  //       controls.verticalMin = 1.0;
  //       controls.verticalMax = 2.0;
  //       controls.lon = 250;
  //       controls.lat = 120;
  //       controls.activeLook = false;

  container.appendChild(renderer.domElement);

  if (renderer.extensions.get("ANGLE_instanced_arrays") === false) {
    document.getElementById("notSupported").style.display = "";
    return;
  }

  stats = new Stats();
  container.appendChild(stats.dom);

  window.addEventListener("resize", onWindowResize, false);
}

function onWindowResize(event) {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  var delta = clock.getDelta();
  controls.update(delta);

  requestAnimationFrame(animate);

  render();
  stats.update();
}

function render() {
  var time = performance.now();

  lastTime = time;

  renderer.render(scene, camera);
}

function screenshot() {
  renderer.render(scene, camera);
  var imgData = renderer.domElement.toDataURL();
  // var imgNode = document.createElement("img");
  // imgNode.src = imgData;
  element.setAttribute("href", imgData); // 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute("download", filename);

  element.style.display = "none";
  document.body.appendChild(element);

  element.click();
}
