(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
"use strict"

function iota(n) {
  var result = new Array(n)
  for(var i=0; i<n; ++i) {
    result[i] = i
  }
  return result
}

module.exports = iota
},{}],2:[function(require,module,exports){
/*!
 * Determine if an object is a Buffer
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */

// The _isBuffer check is for Safari 5-7 support, because it's missing
// Object.prototype.constructor. Remove this eventually
module.exports = function (obj) {
  return obj != null && (isBuffer(obj) || isSlowBuffer(obj) || !!obj._isBuffer)
}

function isBuffer (obj) {
  return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
}

// For Node v0.10 support. Remove this eventually.
function isSlowBuffer (obj) {
  return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isBuffer(obj.slice(0, 0))
}

},{}],3:[function(require,module,exports){
var iota = require("iota-array")
var isBuffer = require("is-buffer")

var hasTypedArrays  = ((typeof Float64Array) !== "undefined")

function compare1st(a, b) {
  return a[0] - b[0]
}

function order() {
  var stride = this.stride
  var terms = new Array(stride.length)
  var i
  for(i=0; i<terms.length; ++i) {
    terms[i] = [Math.abs(stride[i]), i]
  }
  terms.sort(compare1st)
  var result = new Array(terms.length)
  for(i=0; i<result.length; ++i) {
    result[i] = terms[i][1]
  }
  return result
}

function compileConstructor(dtype, dimension) {
  var className = ["View", dimension, "d", dtype].join("")
  if(dimension < 0) {
    className = "View_Nil" + dtype
  }
  var useGetters = (dtype === "generic")

  if(dimension === -1) {
    //Special case for trivial arrays
    var code =
      "function "+className+"(a){this.data=a;};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return -1};\
proto.size=0;\
proto.dimension=-1;\
proto.shape=proto.stride=proto.order=[];\
proto.lo=proto.hi=proto.transpose=proto.step=\
function(){return new "+className+"(this.data);};\
proto.get=proto.set=function(){};\
proto.pick=function(){return null};\
return function construct_"+className+"(a){return new "+className+"(a);}"
    var procedure = new Function(code)
    return procedure()
  } else if(dimension === 0) {
    //Special case for 0d arrays
    var code =
      "function "+className+"(a,d) {\
this.data = a;\
this.offset = d\
};\
var proto="+className+".prototype;\
proto.dtype='"+dtype+"';\
proto.index=function(){return this.offset};\
proto.dimension=0;\
proto.size=1;\
proto.shape=\
proto.stride=\
proto.order=[];\
proto.lo=\
proto.hi=\
proto.transpose=\
proto.step=function "+className+"_copy() {\
return new "+className+"(this.data,this.offset)\
};\
proto.pick=function "+className+"_pick(){\
return TrivialArray(this.data);\
};\
proto.valueOf=proto.get=function "+className+"_get(){\
return "+(useGetters ? "this.data.get(this.offset)" : "this.data[this.offset]")+
"};\
proto.set=function "+className+"_set(v){\
return "+(useGetters ? "this.data.set(this.offset,v)" : "this.data[this.offset]=v")+"\
};\
return function construct_"+className+"(a,b,c,d){return new "+className+"(a,d)}"
    var procedure = new Function("TrivialArray", code)
    return procedure(CACHED_CONSTRUCTORS[dtype][0])
  }

  var code = ["'use strict'"]

  //Create constructor for view
  var indices = iota(dimension)
  var args = indices.map(function(i) { return "i"+i })
  var index_str = "this.offset+" + indices.map(function(i) {
        return "this.stride[" + i + "]*i" + i
      }).join("+")
  var shapeArg = indices.map(function(i) {
      return "b"+i
    }).join(",")
  var strideArg = indices.map(function(i) {
      return "c"+i
    }).join(",")
  code.push(
    "function "+className+"(a," + shapeArg + "," + strideArg + ",d){this.data=a",
      "this.shape=[" + shapeArg + "]",
      "this.stride=[" + strideArg + "]",
      "this.offset=d|0}",
    "var proto="+className+".prototype",
    "proto.dtype='"+dtype+"'",
    "proto.dimension="+dimension)

  //view.size:
  code.push("Object.defineProperty(proto,'size',{get:function "+className+"_size(){\
return "+indices.map(function(i) { return "this.shape["+i+"]" }).join("*"),
"}})")

  //view.order:
  if(dimension === 1) {
    code.push("proto.order=[0]")
  } else {
    code.push("Object.defineProperty(proto,'order',{get:")
    if(dimension < 4) {
      code.push("function "+className+"_order(){")
      if(dimension === 2) {
        code.push("return (Math.abs(this.stride[0])>Math.abs(this.stride[1]))?[1,0]:[0,1]}})")
      } else if(dimension === 3) {
        code.push(
"var s0=Math.abs(this.stride[0]),s1=Math.abs(this.stride[1]),s2=Math.abs(this.stride[2]);\
if(s0>s1){\
if(s1>s2){\
return [2,1,0];\
}else if(s0>s2){\
return [1,2,0];\
}else{\
return [1,0,2];\
}\
}else if(s0>s2){\
return [2,0,1];\
}else if(s2>s1){\
return [0,1,2];\
}else{\
return [0,2,1];\
}}})")
      }
    } else {
      code.push("ORDER})")
    }
  }

  //view.set(i0, ..., v):
  code.push(
"proto.set=function "+className+"_set("+args.join(",")+",v){")
  if(useGetters) {
    code.push("return this.data.set("+index_str+",v)}")
  } else {
    code.push("return this.data["+index_str+"]=v}")
  }

  //view.get(i0, ...):
  code.push("proto.get=function "+className+"_get("+args.join(",")+"){")
  if(useGetters) {
    code.push("return this.data.get("+index_str+")}")
  } else {
    code.push("return this.data["+index_str+"]}")
  }

  //view.index:
  code.push(
    "proto.index=function "+className+"_index(", args.join(), "){return "+index_str+"}")

  //view.hi():
  code.push("proto.hi=function "+className+"_hi("+args.join(",")+"){return new "+className+"(this.data,"+
    indices.map(function(i) {
      return ["(typeof i",i,"!=='number'||i",i,"<0)?this.shape[", i, "]:i", i,"|0"].join("")
    }).join(",")+","+
    indices.map(function(i) {
      return "this.stride["+i + "]"
    }).join(",")+",this.offset)}")

  //view.lo():
  var a_vars = indices.map(function(i) { return "a"+i+"=this.shape["+i+"]" })
  var c_vars = indices.map(function(i) { return "c"+i+"=this.stride["+i+"]" })
  code.push("proto.lo=function "+className+"_lo("+args.join(",")+"){var b=this.offset,d=0,"+a_vars.join(",")+","+c_vars.join(","))
  for(var i=0; i<dimension; ++i) {
    code.push(
"if(typeof i"+i+"==='number'&&i"+i+">=0){\
d=i"+i+"|0;\
b+=c"+i+"*d;\
a"+i+"-=d}")
  }
  code.push("return new "+className+"(this.data,"+
    indices.map(function(i) {
      return "a"+i
    }).join(",")+","+
    indices.map(function(i) {
      return "c"+i
    }).join(",")+",b)}")

  //view.step():
  code.push("proto.step=function "+className+"_step("+args.join(",")+"){var "+
    indices.map(function(i) {
      return "a"+i+"=this.shape["+i+"]"
    }).join(",")+","+
    indices.map(function(i) {
      return "b"+i+"=this.stride["+i+"]"
    }).join(",")+",c=this.offset,d=0,ceil=Math.ceil")
  for(var i=0; i<dimension; ++i) {
    code.push(
"if(typeof i"+i+"==='number'){\
d=i"+i+"|0;\
if(d<0){\
c+=b"+i+"*(a"+i+"-1);\
a"+i+"=ceil(-a"+i+"/d)\
}else{\
a"+i+"=ceil(a"+i+"/d)\
}\
b"+i+"*=d\
}")
  }
  code.push("return new "+className+"(this.data,"+
    indices.map(function(i) {
      return "a" + i
    }).join(",")+","+
    indices.map(function(i) {
      return "b" + i
    }).join(",")+",c)}")

  //view.transpose():
  var tShape = new Array(dimension)
  var tStride = new Array(dimension)
  for(var i=0; i<dimension; ++i) {
    tShape[i] = "a[i"+i+"]"
    tStride[i] = "b[i"+i+"]"
  }
  code.push("proto.transpose=function "+className+"_transpose("+args+"){"+
    args.map(function(n,idx) { return n + "=(" + n + "===undefined?" + idx + ":" + n + "|0)"}).join(";"),
    "var a=this.shape,b=this.stride;return new "+className+"(this.data,"+tShape.join(",")+","+tStride.join(",")+",this.offset)}")

  //view.pick():
  code.push("proto.pick=function "+className+"_pick("+args+"){var a=[],b=[],c=this.offset")
  for(var i=0; i<dimension; ++i) {
    code.push("if(typeof i"+i+"==='number'&&i"+i+">=0){c=(c+this.stride["+i+"]*i"+i+")|0}else{a.push(this.shape["+i+"]);b.push(this.stride["+i+"])}")
  }
  code.push("var ctor=CTOR_LIST[a.length+1];return ctor(this.data,a,b,c)}")

  //Add return statement
  code.push("return function construct_"+className+"(data,shape,stride,offset){return new "+className+"(data,"+
    indices.map(function(i) {
      return "shape["+i+"]"
    }).join(",")+","+
    indices.map(function(i) {
      return "stride["+i+"]"
    }).join(",")+",offset)}")

  //Compile procedure
  var procedure = new Function("CTOR_LIST", "ORDER", code.join("\n"))
  return procedure(CACHED_CONSTRUCTORS[dtype], order)
}

function arrayDType(data) {
  if(isBuffer(data)) {
    return "buffer"
  }
  if(hasTypedArrays) {
    switch(Object.prototype.toString.call(data)) {
      case "[object Float64Array]":
        return "float64"
      case "[object Float32Array]":
        return "float32"
      case "[object Int8Array]":
        return "int8"
      case "[object Int16Array]":
        return "int16"
      case "[object Int32Array]":
        return "int32"
      case "[object Uint8Array]":
        return "uint8"
      case "[object Uint16Array]":
        return "uint16"
      case "[object Uint32Array]":
        return "uint32"
      case "[object Uint8ClampedArray]":
        return "uint8_clamped"
    }
  }
  if(Array.isArray(data)) {
    return "array"
  }
  return "generic"
}

var CACHED_CONSTRUCTORS = {
  "float32":[],
  "float64":[],
  "int8":[],
  "int16":[],
  "int32":[],
  "uint8":[],
  "uint16":[],
  "uint32":[],
  "array":[],
  "uint8_clamped":[],
  "buffer":[],
  "generic":[]
}

;(function() {
  for(var id in CACHED_CONSTRUCTORS) {
    CACHED_CONSTRUCTORS[id].push(compileConstructor(id, -1))
  }
});

function wrappedNDArrayCtor(data, shape, stride, offset) {
  if(data === undefined) {
    var ctor = CACHED_CONSTRUCTORS.array[0]
    return ctor([])
  } else if(typeof data === "number") {
    data = [data]
  }
  if(shape === undefined) {
    shape = [ data.length ]
  }
  var d = shape.length
  if(stride === undefined) {
    stride = new Array(d)
    for(var i=d-1, sz=1; i>=0; --i) {
      stride[i] = sz
      sz *= shape[i]
    }
  }
  if(offset === undefined) {
    offset = 0
    for(var i=0; i<d; ++i) {
      if(stride[i] < 0) {
        offset -= (shape[i]-1)*stride[i]
      }
    }
  }
  var dtype = arrayDType(data)
  var ctor_list = CACHED_CONSTRUCTORS[dtype]
  while(ctor_list.length <= d+1) {
    ctor_list.push(compileConstructor(dtype, ctor_list.length-1))
  }
  var ctor = ctor_list[d+1]
  return ctor(data, shape, stride, offset)
}

module.exports = wrappedNDArrayCtor

},{"iota-array":1,"is-buffer":2}],4:[function(require,module,exports){

function asciiDecode(buffer) {
  const castBuffer = new Uint8Array(buffer);
  return String.fromCharCode(...castBuffer);
}

function readUint16LE(buffer) {
    const view = new DataView(buffer);
    var value = view.getUint8(0);
    value |= view.getUint8(1) << 8;
    return value;
}

function typedArrayFromBuffer(dtype, buffer, offset) {
  switch (dtype) {
    // Unsigned Integer
    case '|u1':
      return new Uint8Array(buffer, offset);
    case '<u2':
      return new UInt16Array(buffer, offset);
    case '<u4':
      return new UInt32Array(buffer, offset);
    // Integer
    case '|i1':
      return new Int8Array(buffer, offset);
    case '<i2':
      return new Int16rray(buffer, offset);
    case '<i4':
      return new Int32Array(buffer, offset);
    // Floating Point
    case '<f4':
      return new Float32Array(buffer, offset);
    case '<f8':
      return new Float64Array(buffer, offset);

    default:
      throw new Error('unknown numeric dtype: ' + header.descr);
  }
}

function fromArrayBuffer(buffer) {
  // check the magic number
  const magic = asciiDecode(buffer.slice(0,6));
  if (magic.slice(1,6) != 'NUMPY') {
      throw new Error(`unknown file type: "${magic}"`);
  }

  // read the header
  const version = new Uint8Array(buffer.slice(6, 8)),
        headerLength = readUint16LE(buffer.slice(8, 10)),
        headerStr = asciiDecode(buffer.slice(10, 10 + headerLength)),
        offsetBytes = 10 + headerLength;
  const jsonHeader = headerStr
    .toLowerCase() // fixes boolean literals: False -> false
    .replace('(','[').replace('),',']') // shape tuple to array: (10,) -> [10,]
    .replace('[,','[1,]').replace(',]',',1]') // implicit dimensions: [10,] -> [10,1]
    .replace(/'/g, '"'); // fixes single quotes
  const header = JSON.parse(jsonHeader);
  if (header.fortran_order) {
    // TODO: figure out if/how to handle this
    throw new Error('file is in Fortran byte order; giving up')
  }

  // Intepret the bytes according to the specified dtype
  const data = typedArrayFromBuffer(header.descr, buffer, offsetBytes);

  return { data: data, shape: header.shape };
}

module.exports = {
    fromArrayBuffer: fromArrayBuffer
};

},{}],5:[function(require,module,exports){
// const {loadNumpy} = require('./util.js')
const NumpyParser = require("numpy-parser");
const NDArray = require("ndarray");


const voxelSize = 1

if (!Detector.webgl) Detector.addGetWebGLMessage();

var container, stats;
var camera, scene, renderer, mesh, controls;
var offsetAttribute, occupancyAttribute;

var lastTime = 0;

const MIN_OCCUPANCY = 1;

const occupancies = [];
const variances = [];
const errors = [];
const offsets = [];

// var voxelSize;
// var xMin;
// var xMax;
// var yMin;
// var yMax;
// var zMin;
// var zMax;

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
    function(e) {
      arrayBuffer = reader.result;
      const data = NumpyParser.fromArrayBuffer(arrayBuffer);
      const map = NDArray(data.data, data.shape);


      // var view = new DataView(arrayBuffer);
      // var ptr = 0;
      // mapVersion = view.getUint32(ptr, true);
      // ptr += 4;
      // mapType = view.getUint32(ptr, true);
      // if (mapType > mapTypes.length) mapType = 0;
      // ptr += 4;
      // var readParticles = view.getUint32(ptr, true);
      // ptr += 4;

      // voxelSize = view.getFloat64(ptr, true);
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
            let occupancy = map.get(x,y,z)
            if(x > 100 || y > 100)
              continue;
            if ( occupancy > MIN_OCCUPANCY) {
              occupancies.push(occupancy/255);
              offsets.push(
                xMin + x * voxelSize,
                zMin + z * voxelSize,
                yMin + y * voxelSize
              );
              // if (occupancies.length > 10000)
              //   break;
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


function loadMap_old() {
  var reader = new FileReader();
  reader.addEventListener(
    "load",
    function(e) {
      arrayBuffer = reader.result;
      var view = new DataView(arrayBuffer);
      var ptr = 0;
      mapVersion = view.getUint32(ptr, true);
      ptr += 4;
      mapType = view.getUint32(ptr, true);
      if (mapType > mapTypes.length) mapType = 0;
      ptr += 4;
      var readParticles = view.getUint32(ptr, true);
      ptr += 4;

      voxelSize = view.getFloat64(ptr, true);
      ptr += 8;
      xMin = view.getFloat64(ptr, true);
      ptr += 8;
      xMax = view.getFloat64(ptr, true);
      ptr += 8;
      yMin = view.getFloat64(ptr, true);
      ptr += 8;
      yMax = view.getFloat64(ptr, true);
      ptr += 8;
      zMin = view.getFloat64(ptr, true);
      ptr += 8;
      zMax = view.getFloat64(ptr, true);
      ptr += 8;
      var numParticles = view.getUint32(56, true);
      ptr += 4;
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
        "  | numParticles",
        numParticles
      );
      var voxelsX = Math.floor((xMax - xMin) / voxelSize);
      var voxelsY = Math.floor((yMax - yMin) / voxelSize);
      var voxelsZ = Math.floor((zMax - zMin) / voxelSize);
      for (var x = 0; x < voxelsX; ++x) {
        for (var y = 0; y < voxelsY; ++y) {
          for (var z = 0; z < voxelsZ; ++z) {
            var occupancy = view.getFloat64(ptr, true);
            ptr += 8;

            if (mapType == 3 && occupancy > MIN_OCCUPANCY)
              occupancies.push(occupancy * 0.5);
            else if (mapType != 3) {
              // maps other than ground truth map
              var variance = view.getFloat64(ptr, true);
              ptr += 8;
              if (readParticles == 1) ptr += 8 * numParticles;
              var error = view.getFloat64(ptr, true);
              ptr += 8;

              if (occupancy > MIN_OCCUPANCY) {
                occupancies.push(occupancy);
                variances.push(variance);
                errors.push(error);
              }
            }
            if (occupancy > MIN_OCCUPANCY)
              offsets.push(
                xMin + x * voxelSize,
                zMin + z * voxelSize,
                yMin + y * voxelSize
              );
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
        mapTypes[mapType] +
        " map (" +
        String(voxelsX * voxelsY * voxelsZ) +
        " voxels, v" +
        String(mapVersion) +
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
    0.001,
    1000
  );
  camera.position.z = 20;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x888888);

  // geometry
  console.log("occupancies", occupancies.length);

  var instances = 10000000;

  var bufferGeometry = new THREE.BoxBufferGeometry(
    voxelSize,
    voxelSize,
    voxelSize
  );

  // copying data from a simple box geometry, but you can specify a custom geometry if you want

  var geometry = new THREE.InstancedBufferGeometry();
  geometry.index = bufferGeometry.index;
  geometry.attributes.position = bufferGeometry.attributes.position;
  geometry.attributes.uv = bufferGeometry.attributes.uv;
  geometry.attributes.normal = bufferGeometry.attributes.normal;

  // per instance data

  // var orientations = [];

  var vector = new THREE.Vector4();
  var x, y, z, w;

  offsetAttribute = new THREE.InstancedBufferAttribute(
    new Float32Array(offsets),
    3
  );
  // orientationAttribute = new THREE.InstancedBufferAttribute( new Float32Array( orientations ), 4 ).setDynamic( true );
  occupancyAttribute = new THREE.InstancedBufferAttribute(
    new Float32Array(occupancies),
    1
  );
  varianceAttribute = new THREE.InstancedBufferAttribute(
    new Float32Array(variances),
    1
  );
  errorAttribute = new THREE.InstancedBufferAttribute(
    new Float32Array(errors),
    1
  );

  geometry.addAttribute("offset", offsetAttribute);
  // geometry.addAttribute( 'orientation', orientationAttribute );
  // geometry.addAttribute("occupancy", occupancyAttribute);
  // geometry.addAttribute("variance", varianceAttribute);
  // geometry.addAttribute("error", errorAttribute);

  // var material = new THREE.MeshLambertMaterial({color: 0xff0000 }); //, transparent: true, opacity: 0.5});
  let vertexShader = [
    "precision highp float;",
    "",
    "uniform mat4 modelViewMatrix;",
    "uniform mat4 projectionMatrix;",
    "",
    "attribute vec3 position;",
    "attribute vec3 offset;",
    "",
    "void main() {",
    "",
    "	gl_Position = projectionMatrix * modelViewMatrix * vec4( offset + position, 1.0 );",
    "",
    "}"
  ].join("\n");
  let fragmentShader = [
    "precision highp float;",
    "",
    "void main() {",
    "",
    "	gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);",
    "",
    "}"
  ].join("\n");
  // var material = new THREE.MeshBasicMaterial({color: 0x7777ff});
  var material = new THREE.RawShaderMaterial({
    uniforms: {},
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    side: THREE.DoubleSide,
    transparent: false
  });
  var material = new THREE.RawShaderMaterial({
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

  mesh = new THREE.Mesh(geometry, material);

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
    screenshot: function() {
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
    mode: "occupancy",
    highlightErrors: true,
    errorThreshold: 0.3
  };
  gui
    .add(params, "threshold")
    .min(MIN_OCCUPANCY)
    .max(1.0)
    .step(0.01)
    .onChange(function(threshold) {
      mesh.material.uniforms.threshold.value = threshold;
    });
  gui
    .add(params, "mode", { occupancy: 0, variance: 1, inconsistency: 2 })
    .onChange(function(mode) {
      mesh.material.uniforms.mode.value = mode;
    });
  gui.add(params, "highlightErrors").onChange(function(highlightErrors) {
    mesh.material.uniforms.highlightErrors.value = highlightErrors;
  });
  gui
    .add(params, "errorThreshold")
    .min(0.0)
    .max(1.0)
    .step(0.01)
    .onChange(function(errorThreshold) {
      mesh.material.uniforms.errorThreshold.value = errorThreshold;
    });
  var slicing = gui.addFolder("Slicing");
  slicing
    .add(params, "xMin")
    .min(xMin)
    .max(xMax)
    .step(0.01)
    .onChange(function(v) {
      mesh.material.uniforms.xMin.value = v;
    });
  slicing
    .add(params, "xMax")
    .min(xMin)
    .max(xMax)
    .step(0.01)
    .onChange(function(v) {
      mesh.material.uniforms.xMax.value = v;
    });
  slicing
    .add(params, "yMin")
    .min(yMin)
    .max(yMax)
    .step(0.01)
    .onChange(function(v) {
      mesh.material.uniforms.yMin.value = v;
    });
  slicing
    .add(params, "yMax")
    .min(yMin)
    .max(yMax)
    .step(0.01)
    .onChange(function(v) {
      mesh.material.uniforms.yMax.value = v;
    });
  slicing
    .add(params, "zMin")
    .min(zMin)
    .max(zMax)
    .step(0.01)
    .onChange(function(v) {
      mesh.material.uniforms.zMin.value = v;
    });
  slicing
    .add(params, "zMax")
    .min(zMin)
    .max(zMax)
    .step(0.01)
    .onChange(function(v) {
      mesh.material.uniforms.zMax.value = v;
    });

  gui.add(params, "screenshot");
  var rendering = gui.addFolder("Rendering");
  rendering.addColor(params, "backgroundColor").onChange(function(v) {
    scene.background = new THREE.Color(v);
  });

  rendering
    .add(params, "lightX")
    .min(-10)
    .max(10)
    .step(0.01)
    .onChange(function(v) {
      mesh.material.uniforms.lightX.value = v;
    });
  rendering
    .add(params, "lightY")
    .min(-10)
    .max(10)
    .step(0.01)
    .onChange(function(v) {
      mesh.material.uniforms.lightY.value = v;
    });
  rendering
    .add(params, "lightZ")
    .min(-10)
    .max(10)
    .step(0.01)
    .onChange(function(v) {
      mesh.material.uniforms.lightZ.value = v;
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
  rendering.add(params, "showBoundingBox").onChange(function(showBoundingBox) {
    cube.visible = showBoundingBox;
  });

  scene.add(mesh);

  var axesHelper = new THREE.AxesHelper(5);
  axesHelper.rotation.x = -Math.PI / 2;
  axesHelper.scale.y = -1;

  scene.add(axesHelper);

  rendering.add(params, "showAxes").onChange(function(showAxes) {
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

},{"ndarray":3,"numpy-parser":4}]},{},[5]);
