const NumpyParser = require("numpy-parser");
const NDArray = require("ndarray");

function ajax(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.onload = function(e) {
    var buffer = xhr.response; // not responseText
    var result = NumpyParser.fromArrayBuffer(buffer);
    callback(result);
  };
  xhr.open("GET", url, true);
  xhr.responseType = "arraybuffer";
  xhr.send(null);
}

function loadNumpy(npFile) {
  return new Promise((res, rej) => {
    ajax(npFile, function(data) {
      const result = NDArray(data.data, data.shape);
      res(result);
    });
  });
}


module.exports = {
  loadNumpy: loadNumpy,
};