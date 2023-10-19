const fs = require("fs");
const util = require("util");
const readFile = util.promisify(fs.readFile);
const randomString = require("randomstring")


const imports = {
  env: {
    hNHD: () => {
      return true;
    },
    iR: () => {
      return true;
    },
    cL: (ptr, len) => {
      return 0;
    },
    qqss: (ptr, len, callbackPtr) => {
      return 0;
    },
  },
  wasi_snapshot_preview1: {
    fd_close: (fd) => {
      return 0;
    },
    fd_write: (fd, iov, iovcnt, pnum) => {
      return 0;
    },
    fd_seek: (fd, offset, whence, newOffset) => {
      return 0;
    },
  },
  js: {},
};

async function loadAndInstantiateWasm(filename) {
  const wasmBinary = await readFile(filename);
  const wasmModule = await WebAssembly.compile(wasmBinary);
  const wasmInstance = await WebAssembly.instantiate(wasmModule, imports);

  return wasmInstance.exports;
}

async function loadMemoryDump(filename) {
  const dumpContents = await readFile(filename, "utf8"); // loading memory dump because I'm too lazy to reverse engineer further
  const hexArray = dumpContents.trim().split(/\s+/);
  return new Uint8Array(hexArray.map((hex) => parseInt(hex, 16)));
}

function generateNonce(length = 40) {
  return "n_".concat(randomString.generate(40));
}

async function main(method, endpoint, params, nonce, ts) {
  function allocAndCopyToMemory(data) {
    const ptr = wasmExports.malloc(data.length);
    const memory = new Uint8Array(wasmExports.memory.buffer);
    memory.set(data, ptr);
    return ptr;
  }

  const wasmExports = await loadAndInstantiateWasm(
    "debank.wasm"
  );
  const memoryBuffer = await loadMemoryDump(
    "dump.txt"
  );
  const wasmMemoryBuffer = new Uint8Array(wasmExports.memory.buffer);
  wasmMemoryBuffer.set(memoryBuffer);

  const encoder = new TextEncoder();

  const methodBytes = new Uint8Array(encoder.encode(method));
  const endpointBytes = new Uint8Array(encoder.encode(endpoint));
  const paramsBytes = new Uint8Array(encoder.encode(params));
  const nonceBytes = new Uint8Array(encoder.encode(nonce));
  const tsBytes = new Uint8Array(encoder.encode(ts));

  const outputArray = new Uint8Array(64);

  const outputPtr = allocAndCopyToMemory(outputArray);
  const methodPtr = allocAndCopyToMemory(methodBytes);
  const endpointPtr = allocAndCopyToMemory(endpointBytes);
  const paramsPtr = allocAndCopyToMemory(paramsBytes);
  const noncePtr = allocAndCopyToMemory(nonceBytes);
  const tsPtr = allocAndCopyToMemory(tsBytes);

  wasmExports.c_s_f(
    methodPtr,
    endpointPtr,
    paramsPtr,
    noncePtr,
    tsPtr,
    outputPtr
  );

  const memory = new Uint8Array(wasmExports.memory.buffer);
  outputArray.set(memory.slice(outputPtr, outputPtr + outputArray.length));

  const decoder = new TextDecoder("utf-8");
  console.log(decoder.decode(outputArray));
}

nonce = generateNonce()
console.log("Generated nonce:", nonce)

main(
  "GET",
  "/chat/message_count",
  "",
  nonce,
  "1680301103"
).catch(console.error);
// => 7171177458c1cb19aa5e0ca12863f984386cdf5396f0a17a8bc7ff7abde09fc5